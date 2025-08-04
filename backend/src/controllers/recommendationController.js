const RecommendationService = require('../services/recommendationService');
const ShoppingList          = require('../models/shoppingListModel');
const Purchase              = require('../models/purchaseModel');
const Product               = require('../models/productModel');

const MIN_AI_SCORE = 1; // Minimum score for supplementary AI recommendations

exports.getRecs = async (req, res) => {
  try {
    const userId   = req.user.id;
    const showAllAI = req.query.showAllAI === 'true';    // Get from query param
    const list      = await ShoppingList.findById(req.query.listId);
    if (!list) return res.status(404).json({ error: 'List not found' });

    /*
       1.  Find every list that contains this user in its `members` array.
       2.  Pull purchases that are:
           recorded by the user
           linked to one of those lists
    */
   
    const listIds = await ShoppingList
      .find({ members: userId })
      .distinct('_id');                     // returns plain ObjectId array

    const history = await Purchase.find({
      $or: [
        { purchasedBy: userId },            // your own receipts
        { listId: { $in: listIds } }        // shared-list receipts
      ]
    });

    console.time('recommendation');
    const recsResponse = await RecommendationService.recommend(
      userId,
      list.products,
      history,
      5,
      showAllAI                                          // Pass the showAllAI parameter
    );
    console.timeEnd('recommendation');

    // Log the full response for debugging
    console.log('🔍 Full recommendation response:', JSON.stringify(recsResponse, null, 2));

    // Handle both old format (array) and new format (object)
    const mainRecs          = Array.isArray(recsResponse) ? recsResponse : recsResponse.main;
    const supplementaryAI    = recsResponse.supplementaryAI || [];
    const supplementaryOther = recsResponse.supplementaryOther || [];
    
    // Get all item codes for database lookup
    const allItemCodes = [
      ...mainRecs.map(r => r.itemCode),
      ...supplementaryAI.map(r => r.itemCode),
      ...supplementaryOther.map(r => r.itemCode)
    ];

    const docs     = await Product.find({ _id: { $in: allItemCodes } }).lean();
    const prodMap  = Object.fromEntries(docs.map(p => [p._id.toString(), p]));

    // Helper function to format recommendation items
    const formatRecommendation = (r) => {
      const meta  = prodMap[r.itemCode] || {};
      const match = history
        .flatMap(b => b.products)
        .find(p => p.product.itemCode === r.itemCode);

      const name = r.method === 'ai'
        ? r.suggestionName
        : (match?.product.name || meta.name || r.itemCode);

      return {
        itemCode: r.itemCode,
        score: r.score,
        method: r.method,
        lastPurchased: r.lastPurchased,
        name,
        image: match?.product.image || meta.image || null,
        suggestionReason: r.suggestionReason,
        isSupplementary: r.isSupplementary || false
      };
    };

    // Format main recommendations
    const mainDetailed = mainRecs.map(formatRecommendation);
    
    // Format supplementary AI recommendations (only AI)
    const supplementaryAIDetailed = supplementaryAI
      .filter(r => r.score >= MIN_AI_SCORE)
      .map(formatRecommendation);

    // Format supplementary other recommendations (non-AI methods)
    const supplementaryOtherDetailed = supplementaryOther
      .map(formatRecommendation);

    // Prepare response
    const response = {
      main: mainDetailed,
      supplementaryAI: [
        ...supplementaryAIDetailed,
        ...supplementaryOtherDetailed     // Combined for backward compatibility
      ],
      stats: {
        totalAIGenerated:     recsResponse.totalAIGenerated || 0,
        aiUsedInMain:         recsResponse.aiUsedInMain     || mainDetailed.filter(r => r.method === 'ai').length,
        supplementaryCount:   supplementaryAIDetailed.length + supplementaryOtherDetailed.length,
        pureAISupplementary:  supplementaryAIDetailed.length,
        otherMethodsSupplementary: supplementaryOtherDetailed.length
      }
    };

    console.log('📊 Response stats:', response.stats);
    res.json(response);

  } catch (error) {
    console.error('Recommendation error:', error);
    res.status(500).json({ error: error.message });
  }
};
