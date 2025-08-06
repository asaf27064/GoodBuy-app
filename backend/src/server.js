const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })
const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const http = require('http')
const socketIo = require('socket.io')
const jwt = require('jsonwebtoken')
require('./scheduler/priceRefreshScheduler');

const app = express()
app.use(cors())
app.use(express.json())

mongoose.connect(process.env.MONGO_URI).then(() => console.log('Connected to MongoDB')).catch(err => console.error(err))

const server = http.createServer(app)
const io = socketIo(server, { cors: { origin: '*' } })
global.io = io

io.use((socket, next) => {
  const token = socket.handshake.auth?.token
  try { if (token) socket.user = jwt.verify(token, process.env.JWT_SECRET) } catch {}
  next()
})

io.on('connection', socket => {
  if (socket.user?.sub) socket.join(`user:${socket.user.sub}`)
  socket.on('joinList', ({ listId }) => socket.join(`list:${listId}`))
  socket.on('leaveList', ({ listId }) => socket.leave(`list:${listId}`))
  socket.on('editingStart', d => io.to(`list:${d.listId}`).emit('editingUsers', { user: d.user, type: 'add' }))
  socket.on('editingStop',  d => io.to(`list:${d.listId}`).emit('editingUsers', { user: d.user, type: 'remove' }))
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
