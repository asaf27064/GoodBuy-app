const User = require('../models/userModel')
const bcrypt = require('bcrypt')

const getRequesterId = (req) => String(req.user?._id || req.user?.id || req.user?.sub || '')
const isSelf = (req) => String(req.params.id) === getRequesterId(req)

exports.createUser = async (req, res) => {
  const { email, password, username, location } = req.body
  if (!email || !password) return res.status(400).end()
  if (await User.findOne({ $or: [{ email }, ...(username ? [{ username }] : [])] })) {
    return res.status(409).end()
  }
  const passwordHash = await bcrypt.hash(password, 12)
  const user = await User.create({ email, passwordHash, username, location })
  const safe = user.toObject()
  delete safe.passwordHash
  delete safe.refreshToken
  res.status(201).json(safe)
}

exports.listUsers = async (req, res) => {
  // Minimal directory for the "add member to list" picker — id + username only.
  // No email, no location, no timestamps, no password hash. Excludes the caller.
  const me = getRequesterId(req)
  const users = await User.find({ _id: { $ne: me } }, { username: 1 }).lean()
  res.json(users)
}

exports.getUser = async (req, res) => {
  if (!isSelf(req)) return res.status(403).end()
  const user = await User.findById(req.params.id).select('-passwordHash -refreshToken')
  if (!user) return res.status(404).end()
  res.json(user)
}

exports.updateUser = async (req, res) => {
  if (!isSelf(req)) return res.status(403).end()
  const { password, email, username, location } = req.body
  const rest = {}
  if (typeof email === 'string') rest.email = email
  if (typeof username === 'string') rest.username = username
  if (typeof location === 'string') rest.location = location
  if (password) rest.passwordHash = await bcrypt.hash(password, 12)
  const user = await User.findByIdAndUpdate(req.params.id, rest, { new: true })
    .select('-passwordHash -refreshToken')
  if (!user) return res.status(404).end()
  res.json(user)
}

exports.deleteUser = async (req, res) => {
  if (!isSelf(req)) return res.status(403).end()
  const user = await User.findByIdAndDelete(req.params.id).select('-passwordHash -refreshToken')
  if (!user) return res.status(404).end()
  res.json({ id: user._id })
}
