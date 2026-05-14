const RecommendationService = require('../services/recommendation');
const ShoppingList = require('../models/shoppingListModel');
const Purchase = require('../models/purchaseModel');
const Product = require('../models/productModel');

const DEFAULT_HISTORY_LIMIT = 10;

exports.getRecs = async (req, res) => {
  try {
    const userId = req.user.id;
    const listId = req.query.listId;
    const showAllAI = req.query.showAllAI === 'true';
    const historyLimit = Math.max(1, Number(req.query.historyLimit) || DEFAULT_HISTORY_LIMIT);
    const topN = Math.max(1, Number(req.query.topN) || 5);

    const list = await ShoppingList.findById(listId);
    if (!list) return res.status(404).json({ error: 'List not found' });
    if (!list.members.map(String).includes(String(userId))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const listIds = await ShoppingList.find({ members: userId }).distinct('_id');

    const history = await Purchase.find({
      $or: [
        { membersSnapshot: userId },
        { listId: { $in: listIds } }
      ]
    })
      .sort({ timeStamp: -1 })
      .limit(historyLimit);

    const recsResponse = await RecommendationService.recommend(
      userId,
      list.products,
      history,
      topN,
      showAllAI
    );

    const mainRecs = Array.isArray(recsResponse) ? recsResponse : recsResponse.main;
    const supplementaryAI = recsResponse.supplementaryAI || [];
    const supplementaryOther = recsResponse.supplementaryOther || [];

    const allCodes = [
      ...new Set([
        ...mainRecs.map(r => r.itemCode),
        ...supplementaryAI.map(r => r.itemCode),
        ...supplementaryOther.map(r => r.itemCode),
      ])
    ];
    const docs = await Product.find({ _id: { $in: allCodes } }).lean();
    const prodMap = Object.fromEntries(docs.map(p => [p._id.toString(), p]));

    const histMap = new Map();
    history.forEach(b => {
      b.products?.forEach(p => {
        const code = p.product?.itemCode;
        if (code && !histMap.has(code)) histMap.set(code, p.product);
      });
    });

    const fmt = (r) => {
      const meta = prodMap[r.itemCode] || {};
      const seen = histMap.get(r.itemCode);
      const name = r.method === 'ai'
        ? r.suggestionName
        : (seen?.name || meta.name || r.itemCode);
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

    const main = mainRecs.map(fmt);
    const supplementary = [...supplementaryAI.map(fmt), ...supplementaryOther.map(fmt)];

    const response = {
      main,
      supplementaryAI: supplementary,
      stats: {
        totalAIGenerated: recsResponse.totalAIGenerated || 0,
        aiUsedInMain: recsResponse.aiUsedInMain || main.filter(r => r.method === 'ai').length,
        supplementaryCount: supplementary.length,
        pureAISupplementary: supplementary.filter(r => r.method === 'ai').length,
        otherMethodsSupplementary: supplementary.filter(r => r.method !== 'ai').length
      },
      debug: recsResponse.debug
    };

    res.json(response);
  } catch (err) {
    console.error('getRecs error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
