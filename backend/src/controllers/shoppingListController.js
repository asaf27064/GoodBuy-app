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
    if (!Array.isArray(changes)) {
      return res.status(400).json({ error: 'changes must be an array' })
    }

    const list = await ShoppingList.findById(listId)
    if (!list) return res.status(404).json({ error: 'List not found' })
    if (!list.members.map(id => id.toString()).includes(uid)) {
      return res.status(403).json({ error: 'Not permitted' })
    }

    // Collapse N serial updateOne calls into a single bulkWrite round-trip.
    // ordered: true preserves the client's chronological intent (e.g. add-then-
    // remove of the same item still applies in that order). The editLog push
    // rides along as the final op so the whole save is atomic on the wire.
    const ops = []
    const ackOps = []  // ackOps[i] = ackId of the i-th change that produced an op
    for (const c of changes) {
      if (!c || !c.product?.itemCode) continue
      if (c.action === 'added') {
        ops.push({
          updateOne: {
            filter: { _id: listId, 'products.product.itemCode': { $ne: c.product.itemCode } },
            update: { $push: { products: { product: c.product, numUnits: 1 } } }
          }
        })
        ackOps.push(c.ackId)
      } else if (c.action === 'removed') {
        ops.push({
          updateOne: {
            filter: { _id: listId },
            update: { $pull: { products: { 'product.itemCode': c.product.itemCode } } }
          }
        })
        ackOps.push(c.ackId)
      } else if (c.action === 'updated') {
        ops.push({
          updateOne: {
            filter: { _id: listId, 'products.product.itemCode': c.product.itemCode },
            update: { $inc: { 'products.$.numUnits': c.difference } }
          }
        })
        ackOps.push(c.ackId)
      }
    }

    let bulkOk = true
    if (ops.length) {
      ops.push({
        updateOne: {
          filter: { _id: listId },
          update: { $push: { editLog: { $each: changes } } }
        }
      })
      try {
        await ShoppingList.bulkWrite(ops, { ordered: true })
      } catch (err) {
        bulkOk = false
        console.error('updateListProducts bulkWrite error:', err)
      }
    }

    // Acks: 'ok' if the whole bulk succeeded, 'error' otherwise. We don't try to
    // map individual writeErrors back to ackIds — the mobile client rolls back
    // from its pre-change snapshot when it sees an error, which is the right
    // behaviour whether one op or many failed.
    const ackStatus = bulkOk ? 'ok' : 'error'
    for (const ackId of ackOps) {
      if (ackId) global.io.to(`user:${uid}`).emit('listAck', { ackId, status: ackStatus })
    }

    const updated = await ShoppingList.findById(listId)
    global.io.to(`list:${listId}`).emit('listUpdated', updated)
    return res.json({ message: 'ok', list: updated })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
