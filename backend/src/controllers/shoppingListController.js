const ShoppingList = require('../models/shoppingListModel')


// Select all shopping lists in which the user is a member from DB.
exports.getAllUserShoppingLists = async (req, res) => {
  try {
    const uid = (req.user.sub || req.user._id).toString();
    const lists = await ShoppingList.find({ members: uid }).populate('members', '-passwordHash');
    return res.json(lists);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// Add new shopping list to DB.
exports.createList = async (req, res) => {
  try {
    const uid = (req.user.sub || req.user._id).toString();
    const { title, importantList, members } = req.body;
    const allMembers = Array.from(new Set([uid, ...(members || []).map(m => m.toString())]));
    const list = await ShoppingList.create({ title, importantList, members: allMembers, products: [], editLog: [] });
    const populated = await list.populate('members', '-passwordHash');

    // Emit "listCreated" to all members of the list (will update their shopping lists page).
    global.io.to(allMembers.map(id => `user:${id}`)).emit('listCreated', populated);
    return res.status(201).json(populated);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

exports.getShoppingList = async (req, res) => {
  try {
    const uid = (req.user.sub || req.user._id).toString()
    const list = await ShoppingList.findById(req.params.id)
    if (!list) return res.status(404).json({ error: 'List not found' })
    if (!list.members.map(id => id.toString()).includes(uid)) return res.status(403).json({ error: 'Not permitted' })
    return res.json(list)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

exports.updateListProducts = async (req, res) => {
  try {
    const uid = (req.user.sub || req.user._id).toString()
    const listId = req.params.id
    const { changes = [] } = req.body
    const list = await ShoppingList.findById(listId)
    if (!list) return res.status(404).json({ error: 'List not found' })
    if (!list.members.map(id => id.toString()).includes(uid)) return res.status(403).json({ error: 'Not permitted' })

    for (const c of changes) {
      try {
        if (c.action === 'added') {
          await ShoppingList.updateOne(
            { _id: listId, 'products.product.itemCode': { $ne: c.product.itemCode } },
            { $push: { products: { product: c.product, numUnits: 1 } } }
          )
        }
        if (c.action === 'removed') {
          await ShoppingList.updateOne(
            { _id: listId },
            { $pull: { products: { 'product.itemCode': c.product.itemCode } } }
          )
        }
      if (c.action === 'updated') {
        await ShoppingList.updateOne(
          { _id: listId, 'products.product.itemCode': c.product.itemCode },
          { $inc: { 'products.$.numUnits': c.difference } }
        )
      }
        if (c.ackId) global.io.to(`user:${uid}`).emit('listAck', { ackId: c.ackId, status: 'ok' })
      } catch (err) {
        if (c.ackId) global.io.to(`user:${uid}`).emit('listAck', { ackId: c.ackId, status: 'error' })
      }
    }

    if (changes.length) {
      await ShoppingList.updateOne({ _id: listId }, { $push: { editLog: { $each: changes } } })
    }

    const updated = await ShoppingList.findById(listId)
    global.io.to(`list:${listId}`).emit('listUpdated', updated)
    return res.json({ message: 'ok', list: updated })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
