const RecommendationService = require('../services/recommendationService');
const ShoppingList = require('../models/shoppingListModel');
const Purchase = require('../models/purchaseModel');
const Product = require('../models/productModel');

const LIMIT = 10; // last N purchases

exports.getRecs = async (req, res) => {
  try {
    const userId = req.user.id;
    const showAllAI = req.query.showAllAI === 'true';
    const list = await ShoppingList.findById(req.query.listId);
    if (!list) return res.status(404).json({ error: 'List not found' });

    // optional: ensure access
    if (!list.members.map(String).includes(String(userId))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // gather user-related listIds
    const listIds = await ShoppingList.find({ members: userId }).distinct('_id');

    // compact recent history
    const history = await Purchase.find({
      $or: [
        { purchasedBy: userId },
        { membersSnapshot: userId },
        { listId: { $in: listIds } }
      ]
    })
      .sort({ timeStamp: -1 })
      .limit(LIMIT);

    // recommend
    const recsResponse = await RecommendationService.recommend(
      userId,
      list.products,
      history,
      5,
      showAllAI
    );

    // support array or object
    const mainRecs = Array.isArray(recsResponse) ? recsResponse : recsResponse.main;
    const supplementaryAI = recsResponse.supplementaryAI || [];
    const supplementaryOther = recsResponse.supplementaryOther || [];

    // collect codes
    const allItemCodes = [
      ...mainRecs.map(r => r.itemCode),
      ...supplementaryAI.map(r => r.itemCode),
      ...supplementaryOther.map(r => r.itemCode)
    ];

    const docs = await Product.find({ _id: { $in: allItemCodes } }).lean();
    const prodMap = Object.fromEntries(docs.map(p => [p._id.toString(), p]));

    // pre-index history for quick name/image
    const histMap = new Map();
    history.forEach(b => {
      b.products?.forEach(p => {
        const code = p.product?.itemCode;
        if (code && !histMap.has(code)) histMap.set(code, p.product);
      });
    });

    const formatRecommendation = (r) => {
      const meta = prodMap[r.itemCode] || {};
      const seen = histMap.get(r.itemCode);
      const name = r.method === 'ai' ? r.suggestionName : (seen?.name || meta.name || r.itemCode);
      return {
        itemCode: r.itemCode,
        score: r.score,
        method: r.method,
        lastPurchased: r.lastPurchased,
        name,
        image: seen?.image || meta.image || null,
        suggestionReason: r.suggestionReason,
        isSupplementary: r.isSupplementary || false
      };
    };

    const mainDetailed = mainRecs.map(formatRecommendation);

    // no extra AI filtering here; service already applied it
    const supplementaryAIDetailed = supplementaryAI.map(formatRecommendation);
    const supplementaryOtherDetailed = supplementaryOther.map(formatRecommendation);

    const response = {
      main: mainDetailed,
      supplementaryAI: [
        ...supplementaryAIDetailed,
        ...supplementaryOtherDetailed
      ],
      stats: {
        totalAIGenerated: recsResponse.totalAIGenerated || 0,
        aiUsedInMain: recsResponse.aiUsedInMain || mainDetailed.filter(r => r.method === 'ai').length,
        supplementaryCount: supplementaryAIDetailed.length + supplementaryOtherDetailed.length,
        pureAISupplementary: supplementaryAIDetailed.length,
        otherMethodsSupplementary: supplementaryOtherDetailed.length
      }
    };

    console.log('📊 recs stats:', response.stats);
    res.json(response);
  } catch (error) {
    console.error('Recommendation error:', error);
    res.status(500).json({ error: error.message });
  }
};
