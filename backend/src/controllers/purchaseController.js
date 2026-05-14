const Purchase = require('../models/purchaseModel');
const shoppingListService = require('../services/shoppingListService');
const ShoppingList = require('../models/shoppingListModel');

// Get purchase history for a user (self only)
exports.getUserPurchases = async (req, res) => {
  try {
    const { user_id } = req.params;
    const requesterId = String(req.user?._id || req.user?.id || req.user?.sub || '');
    if (!requesterId || String(user_id) !== requesterId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    let listIds = [];
    try {
      const userLists = await shoppingListService.getListsByUserId(user_id);
      listIds = (userLists || []).map(l => l._id);
    } catch (_) {
    }

    // Snapshot-aware query:
    // - purchases made by the user
    // - OR purchases where user appeared in membersSnapshot at purchase time
    // - OR purchases tied to lists the user currently belongs to
    const purchaseHistory = await Purchase.find({
      $or: [
        { purchasedBy: user_id },
        { membersSnapshot: user_id },
        ...(listIds.length ? [{ listId: { $in: listIds } }] : [])
      ]
    })
      .populate('listId', 'title')
      .sort({ timeStamp: -1 });

    // Return empty array instead of 404 for empty history (mobile already
    // handles arrays; 404 was being swallowed and produced no UI signal).
    res.json(purchaseHistory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create a new purchase and capture membersSnapshot
exports.createPurchase = async (req, res) => {
  try {
    const { listId, timestamp, purchasedProducts } = req.body;
    const userId = req.user.id;

    // Clear list contents & log
    const updatedList = await shoppingListService.emptyProductsAndEditLog(listId);
    if (!updatedList) return res.status(404).json({ error: 'List not found' });

    // Ensure we have the members of the list to snapshot
    let members = updatedList.members;
    if (!members || !members.length) {
      const fresh = await ShoppingList.findById(listId).select('members');
      members = fresh?.members || [];
    }

    const newPurchase = new Purchase({
      listId,
      timeStamp: timestamp,
      purchasedBy: userId,
      membersSnapshot: members,
      products: purchasedProducts
    });

    await newPurchase.save();
    res.status(201).json(newPurchase);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Current user’s own history
exports.getHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    const history = await Purchase.find({
      $or: [
        { purchasedBy: userId },
        { membersSnapshot: userId }
      ]
    })
      .sort({ timeStamp: -1 });

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
