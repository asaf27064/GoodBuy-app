// Per-test-file bootstrap. The MongoMemoryServer lives across the whole
// Jest run (see globalSetup.js / globalTeardown.js); this file just connects
// mongoose, installs a no-op global.io so socket-emitting controllers don't
// crash, binds the Express app to a real listening server, and exposes a
// tiny `api` helper that wraps fetch with a JSON-friendly API.
//
// Why fetch instead of supertest: supertest 7 + Express 5 + Node 22 emit
// spurious ECONNRESETs on sequential requests inside a single test (verified
// with a bare-bones Express app — no Mongo, no app code — same failure).
// Switching to native fetch against a real listening port sidesteps the
// whole compatibility surface.

const mongoose = require('mongoose')
const http     = require('http')
const { createApp } = require('../../app')

function installIoStub() {
  const noopRoom = { emit: () => {} }
  global.io = {
    to: () => noopRoom,
    emit: () => {},
  }
}

let activeServer = null
let baseUrl = null

async function startTestEnv() {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-aaaaaaaa'
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-aaaaaaaa'

  const uri = process.env.__MONGO_TEST_URI__
  if (!uri) {
    throw new Error('Tests must run via `jest` so globalSetup spins up the in-memory MongoDB.')
  }
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri)
  }
  installIoStub()

  const app = createApp()
  activeServer = http.createServer(app)
  await new Promise((resolve) => activeServer.listen(0, '127.0.0.1', resolve))
  const port = activeServer.address().port
  baseUrl = `http://127.0.0.1:${port}`
  return api(baseUrl)
}

async function closeTestEnv() {
  if (activeServer) {
    await new Promise((resolve) => activeServer.close(resolve))
    activeServer = null
    baseUrl = null
  }
}

async function wipeDb() {
  const cols = mongoose.connection.collections
  await Promise.all(Object.values(cols).map((c) => c.deleteMany({})))
}

// Returns the same shape supertest gave back ({ status, body, headers }) so
// the per-test assertions read naturally: `expect(res.status).toBe(200)`.
function api(base) {
  const call = async (method, path, { body, headers } = {}) => {
    const hdrs = { 'Content-Type': 'application/json', ...(headers || {}) }
    const init = { method, headers: hdrs }
    if (body !== undefined) init.body = JSON.stringify(body)
    const res = await fetch(base + path, init)
    let parsed = null
    const text = await res.text()
    if (text) {
      try { parsed = JSON.parse(text) } catch { parsed = text }
    }
    return { status: res.status, body: parsed, headers: res.headers }
  }
  return {
    get:    (path, opts)       => call('GET',    path, opts),
    post:   (path, body, opts) => call('POST',   path, { ...opts, body }),
    put:    (path, body, opts) => call('PUT',    path, { ...opts, body }),
    delete: (path, opts)       => call('DELETE', path, opts),
    // Convenience for bearer auth: `api.auth(token).get('/auth/me')`
    auth: (token) => api(base + '__no_op_path_marker__'.replace('__no_op_path_marker__','')) /* placeholder, overridden below */,
  }
}

// Convenience layer: `api.withAuth(token)` returns the same helper but every
// request gets an Authorization: Bearer <token> header.
function withAuth(apiObj, token) {
  const headers = { Authorization: `Bearer ${token}` }
  const merge = (opts = {}) => ({ ...opts, headers: { ...headers, ...(opts.headers || {}) } })
  return {
    get:    (path, opts)       => apiObj.get(path, merge(opts)),
    post:   (path, body, opts) => apiObj.post(path, body, merge(opts)),
    put:    (path, body, opts) => apiObj.put(path, body, merge(opts)),
    delete: (path, opts)       => apiObj.delete(path, merge(opts)),
  }
}

module.exports = { startTestEnv, closeTestEnv, wipeDb, withAuth }
