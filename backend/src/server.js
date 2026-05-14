const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })
const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const http = require('http')
const socketIo = require('socket.io')
const jwt = require('jsonwebtoken')
// The price-refresh cron + pipeline live in a separate worker process now
// (backend/src/jobs/worker.js). The API only enqueues — see
// routes/system.js POST /price-refresh.

const app = express()
// CORS — allow restricting origins via env without breaking dev (defaults to permissive only when unset)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins, credentials: true } : {}))
// JSON body size cap — guards against accidental memory abuse on the public API
app.use(express.json({ limit: '256kb' }))

mongoose.connect(process.env.MONGO_URI).then(() => console.log('Connected to MongoDB')).catch(err => console.error(err))

const server = http.createServer(app)
const io = socketIo(server, {
  cors: allowedOrigins.length ? { origin: allowedOrigins, credentials: true } : { origin: '*' }
})
global.io = io

// Require a valid JWT on every socket connection; without it we drop the connection.
const ShoppingListModel = require('./models/shoppingListModel')
io.use((socket, next) => {
  const token = socket.handshake.auth?.token
  if (!token) return next(new Error('unauthorized'))
  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET)
    return next()
  } catch {
    return next(new Error('unauthorized'))
  }
})

io.on('connection', socket => {
  const uid = socket.user?.sub
  if (uid) socket.join(`user:${uid}`)

  // Only allow joining a list room if the user is actually a member of that list.
  socket.on('joinList', async ({ listId }) => {
    try {
      if (!uid || !listId) return
      const list = await ShoppingListModel.findById(listId).select('members').lean()
      if (!list) return
      if (!list.members.map(String).includes(String(uid))) return
      socket.join(`list:${listId}`)
    } catch {}
  })
  socket.on('leaveList', ({ listId }) => listId && socket.leave(`list:${listId}`))

  // Only forward editing presence if the socket has already joined that list room.
  socket.on('editingStart', d => {
    if (!d?.listId || !socket.rooms.has(`list:${d.listId}`)) return
    io.to(`list:${d.listId}`).emit('editingUsers', { user: d.user, type: 'add' })
  })
  socket.on('editingStop', d => {
    if (!d?.listId || !socket.rooms.has(`list:${d.listId}`)) return
    io.to(`list:${d.listId}`).emit('editingUsers', { user: d.user, type: 'remove' })
  })
})

const userRoutes = require('./routes/userRoutes')
const shoppingListRoutes = require('./routes/shoppingListRoutes')
const storeRoutes = require('./routes/storeRoutes')
const productRoutes = require('./routes/productRoutes')
const purchaseRoutes = require('./routes/purchaseRoutes')
const recommendationRoutes = require('./routes/recommendationRoutes')
const systemRoutes = require('./routes/system')
const authRoutes = require('./routes/auth')

app.use('/api/Users', userRoutes)
app.use('/api/ShoppingLists', shoppingListRoutes)
app.use('/api/Stores', storeRoutes)
app.use('/api/Products', productRoutes)
app.use('/api/Purchases', purchaseRoutes)
app.use('/api/Recommendations', recommendationRoutes)
app.use('/api/system', systemRoutes)
app.use('/auth', authRoutes)

const PORT = process.env.PORT || 3000
server.listen(PORT, () => console.log(`Server running on port ${PORT}`))
