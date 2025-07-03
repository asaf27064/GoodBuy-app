const Purchase = require('../models/purchaseModel');
const shoppingListService = require('../services/shoppingListService');



exports.getUserPurchases = async (req, res) => {
  try {
    const { user_id } = req.params;

    const userLists = await shoppingListService.getListsByUserId(user_id);
    if (!userLists || !userLists.length) {
      return res.status(404).json({ error: 'No shopping lists found for user' });
    }

    const listIds = userLists.map(list => list._id);

    const purchaseHistory = await Purchase.find({
      listId: { $in: listIds }
    })
    .populate('listId', 'title')
    .sort('-timestamp');
    if (!purchaseHistory.length) {
      return res.status(404).json({ error: 'Purchase history not found' });
    }

    res.json(purchaseHistory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createPurchase = async (req, res) => {
  try {
    const { listId, timestamp, purchasedProducts } = req.body
    const userId = req.user.id

    const updatedList = await shoppingListService.emptyProductsAndEditLog(listId)
    if (!updatedList) return res.status(404).json({ error: 'List not found' })

    const newPurchase = new Purchase({
      listId,
      timeStamp: timestamp,
      purchasedBy: userId,
      products: purchasedProducts
    })

    await newPurchase.save()
    res.status(201).json(newPurchase)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

exports.getHistory = async (req, res) => {
  const userId = req.user.id
  const history = await Purchase.find({ purchasedBy: userId }).sort('-timeStamp')
  res.json(history)
}