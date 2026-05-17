/**
 * Regression tests for two access-control fixes from PR #1:
 *
 *   1. POST /api/system/price-refresh was un-authenticated and would spawn
 *      the scraper pipeline. Now requires auth (and after PR #9 just writes
 *      to the queue — the worker picks it up).
 *   2. GET /api/Purchases/:user_id was un-authenticated and leaked any
 *      user's purchase history. Now self-only.
 */

const { startTestEnv, wipeDb, withAuth } = require('./setup/testEnv')

let api
beforeAll(async () => { api = await startTestEnv() })
beforeEach(wipeDb)

const userA = { email: 'a@x.com', username: 'aaa', password: 'Str0ng!Passw' }
const userB = { email: 'b@x.com', username: 'bbb', password: 'Str0ng!Passw' }

async function bootstrap(user) {
  await api.post('/auth/register', user)
  const { body } = await api.post('/auth/login', {
    username: user.username, password: user.password,
  })
  const me = await withAuth(api, body.accessToken).get('/auth/me')
  return { ...body, id: me.body.user.id }
}

describe('POST /api/system/price-refresh', () => {
  test('401 without auth', async () => {
    const res = await api.post('/api/system/price-refresh', {})
    expect(res.status).toBe(401)
  })

  test('200 with auth — enqueues by writing requestedAt to SystemMeta', async () => {
    const a = await bootstrap(userA)
    const res = await withAuth(api, a.accessToken).post('/api/system/price-refresh', {})
    expect(res.status).toBe(200)
    expect(res.body.message).toBe('Triggered')

    const SystemMeta = require('../models/SystemMeta')
    const meta = await SystemMeta.findById('price-refresh').lean()
    expect(meta.requestedAt).toBeDefined()
  })
})

describe('GET /api/system/price-status', () => {
  test('401 without auth', async () => {
    const res = await api.get('/api/system/price-status')
    expect(res.status).toBe(401)
  })
})

describe('GET /api/Purchases/:user_id', () => {
  test('401 without auth', async () => {
    const res = await api.get('/api/Purchases/some-id')
    expect(res.status).toBe(401)
  })

  test('403 when reading another user\'s history', async () => {
    const a = await bootstrap(userA)
    const b = await bootstrap(userB)
    const res = await withAuth(api, a.accessToken).get(`/api/Purchases/${b.id}`)
    expect(res.status).toBe(403)
  })

  test('200 with empty history when reading self', async () => {
    const a = await bootstrap(userA)
    const res = await withAuth(api, a.accessToken).get(`/api/Purchases/${a.id}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body).toEqual([])
  })
})

describe('GET /api/Purchases/history is not shadowed by /:user_id', () => {
  // Pre-PR #1, /history was declared AFTER /:user_id and never reached.
  test('returns 200 with self history (not a 404 / not a 403 from /:user_id)', async () => {
    const a = await bootstrap(userA)
    const res = await withAuth(api, a.accessToken).get('/api/Purchases/history')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})
