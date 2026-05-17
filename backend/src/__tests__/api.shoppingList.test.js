/**
 * Integration tests for /api/ShoppingLists — the main interactive feature.
 * Covers auth-gating, membership-based access control, the bulkWrite path
 * in updateListProducts, and the "verified members only" guard in createList.
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

describe('POST /api/ShoppingLists (createList)', () => {
  test('401 without auth', async () => {
    const res = await api.post('/api/ShoppingLists', { title: 'x' })
    expect(res.status).toBe(401)
  })

  test('creates a list with the caller auto-included as a member', async () => {
    const a = await bootstrap(userA)
    const res = await withAuth(api, a.accessToken).post('/api/ShoppingLists', { title: 'Weekly groceries' })
    expect(res.status).toBe(201)
    expect(res.body.title).toBe('Weekly groceries')
    expect(res.body.members.map(m => m._id || m)).toContain(a.id)
  })

  test('rejects fake member ids — only real users end up in members', async () => {
    const a = await bootstrap(userA)
    const fakeId = '507f1f77bcf86cd799439011' // valid ObjectId, no such user
    const res = await withAuth(api, a.accessToken).post('/api/ShoppingLists', {
      title: 'Fake friends', members: [fakeId],
    })
    expect(res.status).toBe(201)
    const ids = res.body.members.map(m => String(m._id || m))
    expect(ids).toContain(a.id)
    expect(ids).not.toContain(fakeId)
  })

  test('accepts a real second user as a member', async () => {
    const a = await bootstrap(userA)
    const b = await bootstrap(userB)
    const res = await withAuth(api, a.accessToken).post('/api/ShoppingLists', {
      title: 'Shared list', members: [b.id],
    })
    expect(res.status).toBe(201)
    const ids = res.body.members.map(m => String(m._id || m))
    expect(ids).toEqual(expect.arrayContaining([a.id, b.id]))
  })

  test('caps absurdly long titles instead of storing them verbatim', async () => {
    const a = await bootstrap(userA)
    const huge = 'x'.repeat(5000)
    const res = await withAuth(api, a.accessToken).post('/api/ShoppingLists', { title: huge })
    expect(res.status).toBe(201)
    expect(res.body.title.length).toBeLessThanOrEqual(200)
  })
})

describe('GET /api/ShoppingLists', () => {
  test('only returns lists the user is a member of', async () => {
    const a = await bootstrap(userA)
    const b = await bootstrap(userB)
    await withAuth(api, a.accessToken).post('/api/ShoppingLists', { title: 'A only' })
    await withAuth(api, b.accessToken).post('/api/ShoppingLists', { title: 'B only' })

    const aRes = await withAuth(api, a.accessToken).get('/api/ShoppingLists')
    const titles = aRes.body.map(l => l.title)
    expect(titles).toEqual(['A only'])
  })
})

describe('GET /api/ShoppingLists/:id', () => {
  test('403 when fetching a list the user is not a member of', async () => {
    const a = await bootstrap(userA)
    const b = await bootstrap(userB)
    const { body: list } = await withAuth(api, a.accessToken).post('/api/ShoppingLists', { title: 'A only' })
    const res = await withAuth(api, b.accessToken).get(`/api/ShoppingLists/${list._id}`)
    expect(res.status).toBe(403)
  })
})

describe('POST /api/ShoppingLists/:id/leave', () => {
  test('removes the caller from members; non-member gets 403', async () => {
    const a = await bootstrap(userA)
    const b = await bootstrap(userB)
    const { body: list } = await withAuth(api, a.accessToken).post('/api/ShoppingLists', {
      title: 'Shared', members: [b.id],
    })

    const leaveRes = await withAuth(api, b.accessToken).post(`/api/ShoppingLists/${list._id}/leave`, {})
    expect(leaveRes.status).toBe(200)

    const readBack = await withAuth(api, b.accessToken).get(`/api/ShoppingLists/${list._id}`)
    expect(readBack.status).toBe(403)

    const nonMember = await bootstrap({ email: 'c@x.com', username: 'ccc', password: 'Str0ng!Passw' })
    const stray = await withAuth(api, nonMember.accessToken).post(`/api/ShoppingLists/${list._id}/leave`, {})
    expect(stray.status).toBe(403)
  })
})

describe('PUT /api/ShoppingLists/:id (bulkWrite path)', () => {
  test('applies added / updated / removed in a single bulk and persists', async () => {
    const a = await bootstrap(userA)
    const { body: list } = await withAuth(api, a.accessToken).post('/api/ShoppingLists', { title: 'Edits' })

    const changes = [
      { action: 'added',   product: { itemCode: '111', name: 'Milk' } },
      { action: 'added',   product: { itemCode: '222', name: 'Bread' } },
      { action: 'updated', product: { itemCode: '111', name: 'Milk' }, difference: 2 },
      { action: 'removed', product: { itemCode: '222', name: 'Bread' } },
    ]
    const res = await withAuth(api, a.accessToken).put(`/api/ShoppingLists/${list._id}`, { changes })
    expect(res.status).toBe(200)

    const products = res.body.list.products
    expect(products).toHaveLength(1)
    expect(products[0].product.itemCode).toBe('111')
    expect(products[0].numUnits).toBe(3) // 1 initial + 2 increment
  })

  test('400 when `changes` is not an array', async () => {
    const a = await bootstrap(userA)
    const { body: list } = await withAuth(api, a.accessToken).post('/api/ShoppingLists', { title: 'X' })
    const res = await withAuth(api, a.accessToken).put(`/api/ShoppingLists/${list._id}`, { changes: 'not-an-array' })
    expect(res.status).toBe(400)
  })

  test('403 when non-member tries to update', async () => {
    const a = await bootstrap(userA)
    const b = await bootstrap(userB)
    const { body: list } = await withAuth(api, a.accessToken).post('/api/ShoppingLists', { title: 'A only' })
    const res = await withAuth(api, b.accessToken).put(`/api/ShoppingLists/${list._id}`, { changes: [] })
    expect(res.status).toBe(403)
  })
})
