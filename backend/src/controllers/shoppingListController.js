const mongoose = require('mongoose')
const ShoppingList = require('../models/shoppingListModel')
const User = require('../models/userModel')

exports.getAllUserShoppingLists = async (req, res) => {
  try {
    const uid = (req.user.sub || req.user._id).toString()
    const lists = await ShoppingList.find({ members: uid }).populate('members', '-passwordHash')
    return res.json(lists)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

exports.createList = async (req, res) => {
  try {
    const uid = (req.user.sub || req.user._id).toString()
    const { title, importantList, members } = req.body
    const safeTitle = typeof title === 'string' ? title.slice(0, 200) : ''
    const rawMembers = Array.isArray(members) ? members : []
    const candidateIds = rawMembers
      .map(m => (m == null ? '' : String(m)))
      .filter(id => mongoose.isValidObjectId(id))
    // Only accept member ids that correspond to real users
    const verified = candidateIds.length
      ? (await User.find({ _id: { $in: candidateIds } }).select('_id').lean()).map(u => String(u._id))
      : []
    const allMembers = Array.from(new Set([uid, ...verified]))
    const list = await ShoppingList.create({ title: safeTitle, importantList: !!importantList, members: allMembers, products: [], editLog: [] })
    const populated = await list.populate('members', '-passwordHash')
    const creatorName = req.user.username || req.user.email || String(req.user._id)
    const now = new Date().toISOString()
    const events = (allMembers || [])
      .filter(id => String(id) !== String(uid))
      .map(id => ({
        action: 'member-added',
        timeStamp: now,
        changedBy: creatorName,
        targetUser: String(id)
      }))
    if (events.length) {
      await ShoppingList.updateOne(
        { _id: list._id },
        { $push: { editLog: { $each: events } } }
      )
    }
    global.io.to(allMembers.map(id => `user:${id}`)).emit('listCreated', populated)
    return res.status(201).json(populated)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

exports.leaveList = async (req, res) => {
  try {
    const uid = (req.user.sub || req.user._id).toString()
    const listId = req.params.id
    const list = await ShoppingList.findById(listId)
    if (!list) return res.status(404).json({ error: 'List not found' })
    const isMember = list.members.map(String).includes(uid)
    if (!isMember) return res.status(403).json({ error: 'You are not a member of this list' })
    list.members = list.members.filter(m => m.toString() !== uid)
    list.editLog.push({ action: 'member-left', user: uid, ts: new Date() })
    await list.save()
    if (global && global.io) {
      global.io.to(`list:${listId}`).emit('listUpdated', list)
      global.io.to(`user:${uid}`).emit('listLeft', { listId })
    }
    return res.json({ message: 'Left list', list })
  } catch (e) {
    return res.status(500).json({ error: e.message })
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
