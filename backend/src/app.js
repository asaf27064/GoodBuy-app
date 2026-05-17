// Express app factory — separated from server.js so tests (and any other
// caller) can mount the API without opening a port or connecting to MongoDB.
//
// server.js remains the runtime entrypoint and continues to build its own
// app inline; this file just exposes the same wiring for callers that need
// the app *without* the listen/socket/mongoose side effects.

const express = require('express')
const cors    = require('cors')

function createApp() {
  const app = express()

  // Same CORS + body-size policy as server.js.
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean)
  app.use(cors(allowedOrigins.length ? { origin: allowedOrigins, credentials: true } : {}))
  app.use(express.json({ limit: '256kb' }))

  // Routes — same mounts as server.js.
  app.use('/api/Users',           require('./routes/userRoutes'))
  app.use('/api/ShoppingLists',   require('./routes/shoppingListRoutes'))
  app.use('/api/Stores',          require('./routes/storeRoutes'))
  app.use('/api/Products',        require('./routes/productRoutes'))
  app.use('/api/Purchases',       require('./routes/purchaseRoutes'))
  app.use('/api/Recommendations', require('./routes/recommendationRoutes'))
  app.use('/api/system',          require('./routes/system'))
  app.use('/auth',                require('./routes/auth'))

  return app
}

module.exports = { createApp }
