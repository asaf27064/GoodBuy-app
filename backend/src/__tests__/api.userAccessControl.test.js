/**
 * Access-control regression tests for /api/Users.
 *
 * The original repo allowed any authenticated user to PUT /api/Users/<other_id>
 * with `{ password: "x" }` and take over the victim's account. PR #1 locked
 * everything self-only. These tests pin that behaviour so it can't regress.
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

describe('GET /api/Users', () => {
  test('401 without auth', async () => {
    const res = await api.get('/api/Users')
    expect(res.status).toBe(401)
  })

  test('returns the directory of OTHER users (id + username only, no PII)', async () => {
    const a = await bootstrap(userA)
    await bootstrap(userB)
    const res = await withAuth(api, a.accessToken).get('/api/Users')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.find((u) => u._id === a.id)).toBeUndefined()
    const other = res.body.find((u) => u.username === userB.username)
    expect(other).toBeDefined()
    expect(other.email).toBeUndefined()
    expect(other.passwordHash).toBeUndefined()
    expect(other.refreshToken).toBeUndefined()
  })
})

describe('PUT /api/Users/:id — the critical BAC fix', () => {
  test('403 when trying to update ANOTHER user', async () => {
    const a = await bootstrap(userA)
    const b = await bootstrap(userB)
    const res = await withAuth(api, a.accessToken).put(`/api/Users/${b.id}`, { password: 'H4cker!Pass' })
    expect(res.status).toBe(403)
  })

  test('200 when updating self', async () => {
    const a = await bootstrap(userA)
    const res = await withAuth(api, a.accessToken).put(`/api/Users/${a.id}`, { location: 'Tel Aviv' })
    expect(res.status).toBe(200)
    expect(res.body.location).toBe('Tel Aviv')
    expect(res.body.passwordHash).toBeUndefined()
  })
})

describe('GET /api/Users/:id', () => {
  test('403 when fetching another user', async () => {
    const a = await bootstrap(userA)
    const b = await bootstrap(userB)
    const res = await withAuth(api, a.accessToken).get(`/api/Users/${b.id}`)
    expect(res.status).toBe(403)
  })

  test('200 when fetching self', async () => {
    const a = await bootstrap(userA)
    const res = await withAuth(api, a.accessToken).get(`/api/Users/${a.id}`)
    expect(res.status).toBe(200)
    expect(res.body.username).toBe(userA.username)
  })
})

describe('DELETE /api/Users/:id', () => {
  test('403 when deleting another user', async () => {
    const a = await bootstrap(userA)
    const b = await bootstrap(userB)
    const res = await withAuth(api, a.accessToken).delete(`/api/Users/${b.id}`)
    expect(res.status).toBe(403)
  })
})
