/**
 * /auth/* integration tests — register, login, refresh (with rotation),
 * logout, /me. Runs against the real Express app + in-memory MongoDB so the
 * auth middleware, mongoose models, and refresh-token rotation logic are all
 * exercised end-to-end.
 */

const { startTestEnv, wipeDb, withAuth } = require('./setup/testEnv')

let api

const valid = {
  email: 'alice@example.com',
  username: 'alice',
  password: 'Str0ng!Passw',
}

beforeAll(async () => { api = await startTestEnv() })
beforeEach(wipeDb)

const register = (over = {}) => api.post('/auth/register', { ...valid, ...over })
const login    = (over = {}) => api.post('/auth/login', {
  username: valid.username,
  password: valid.password,
  ...over,
})

describe('POST /auth/register', () => {
  test('201 on a fresh, valid payload', async () => {
    const res = await register()
    expect(res.status).toBe(201)
    expect(res.body.message).toBeTruthy()
  })

  test('409 when the email or username is taken', async () => {
    await register()
    const dup = await register()
    expect(dup.status).toBe(409)
  })

  test('400 on an invalid email', async () => {
    const res = await register({ email: 'not-an-email' })
    expect(res.status).toBe(400)
  })

  test('400 when the password fails complexity rules', async () => {
    const res = await register({ password: 'short' })
    expect(res.status).toBe(400)
  })

  test('400 when the username uses disallowed chars', async () => {
    const res = await register({ username: 'has spaces' })
    expect(res.status).toBe(400)
  })
})

describe('POST /auth/login', () => {
  beforeEach(async () => { await register() })

  test('returns { accessToken, refreshToken } on success', async () => {
    const res = await login()
    expect(res.status).toBe(200)
    expect(res.body.accessToken).toBeTruthy()
    expect(res.body.refreshToken).toBeTruthy()
  })

  test('401 on wrong password', async () => {
    const res = await login({ password: 'Wr0ng!Passw' })
    expect(res.status).toBe(401)
  })

  test('401 on unknown user', async () => {
    const res = await login({ username: 'nobody' })
    expect(res.status).toBe(401)
  })
})

describe('GET /auth/me', () => {
  test('401 without a token', async () => {
    const res = await api.get('/auth/me')
    expect(res.status).toBe(401)
  })

  test('401 with an invalid token', async () => {
    const res = await withAuth(api, 'not-a-jwt').get('/auth/me')
    expect(res.status).toBe(401)
  })

  test('returns the current user with their access token', async () => {
    await register()
    const { body } = await login()
    const res = await withAuth(api, body.accessToken).get('/auth/me')
    expect(res.status).toBe(200)
    expect(res.body.user.username).toBe(valid.username)
    expect(res.body.user.email).toBe(valid.email)
    expect(res.body.user.passwordHash).toBeUndefined()
    expect(res.body.user.refreshToken).toBeUndefined()
  })
})

describe('POST /auth/refresh (rotation)', () => {
  test('returns a new access token AND a rotated refresh token', async () => {
    await register()
    const { body: tokens } = await login()
    // Sleep so the JWT iat claim ticks past one second — otherwise the
    // "rotated" RT is byte-identical to the original (same sub, same iat,
    // same secret), which would mask whether rotation actually happened.
    await new Promise(r => setTimeout(r, 1100))
    const res = await api.post('/auth/refresh', { refreshToken: tokens.refreshToken })
    expect(res.status).toBe(200)
    expect(res.body.accessToken).toBeTruthy()
    expect(res.body.refreshToken).toBeTruthy()
    expect(res.body.refreshToken).not.toBe(tokens.refreshToken)
  })

  test('reusing the old refresh token after rotation is rejected', async () => {
    await register()
    const { body: tokens } = await login()
    await new Promise(r => setTimeout(r, 1100))
    await api.post('/auth/refresh', { refreshToken: tokens.refreshToken })
    const replay = await api.post('/auth/refresh', { refreshToken: tokens.refreshToken })
    expect(replay.status).toBe(403)
  })

  test('401 when refresh token is missing', async () => {
    const res = await api.post('/auth/refresh', {})
    expect(res.status).toBe(401)
  })

  test('403 when refresh token signature is invalid', async () => {
    const res = await api.post('/auth/refresh', { refreshToken: 'bogus' })
    expect(res.status).toBe(403)
  })
})

describe('POST /auth/logout', () => {
  test('clears the refresh token server-side; subsequent refresh fails', async () => {
    await register()
    const { body: tokens } = await login()
    const logout = await withAuth(api, tokens.accessToken).post('/auth/logout', {})
    expect(logout.status).toBe(200)
    const replay = await api.post('/auth/refresh', { refreshToken: tokens.refreshToken })
    expect(replay.status).toBe(403)
  })

  test('401 when called without auth', async () => {
    const res = await api.post('/auth/logout', {})
    expect(res.status).toBe(401)
  })
})
