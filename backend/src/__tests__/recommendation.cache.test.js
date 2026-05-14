/**
 * Tests for the single-flight TTL cache used by the recommendation engine.
 * No mocks needed — the cache is a pure in-memory utility.
 */

const { getOrLoad, invalidate } = require('../services/recommendation/cache')

beforeEach(() => {
  invalidate() // wipe every entry between tests
})

describe('getOrLoad', () => {
  test('returns the loader\'s value on a miss', async () => {
    const value = await getOrLoad('k', 60_000, async () => 42)
    expect(value).toBe(42)
  })

  test('returns the cached value on a hit (loader not re-invoked)', async () => {
    const loader = jest.fn(async () => 'cached')
    await getOrLoad('k', 60_000, loader)
    await getOrLoad('k', 60_000, loader)
    await getOrLoad('k', 60_000, loader)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  test('expires after TTL', async () => {
    const loader = jest.fn(async () => Math.random())
    await getOrLoad('k', 50, loader)
    await new Promise(r => setTimeout(r, 80)) // wait past TTL
    await getOrLoad('k', 50, loader)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  test('single-flight: concurrent misses collapse to one loader call', async () => {
    let started = 0
    const loader = jest.fn(async () => {
      started++
      await new Promise(r => setTimeout(r, 30))
      return 'shared'
    })
    const results = await Promise.all([
      getOrLoad('k', 60_000, loader),
      getOrLoad('k', 60_000, loader),
      getOrLoad('k', 60_000, loader),
      getOrLoad('k', 60_000, loader),
      getOrLoad('k', 60_000, loader),
    ])
    expect(results).toEqual(['shared', 'shared', 'shared', 'shared', 'shared'])
    expect(loader).toHaveBeenCalledTimes(1)
    expect(started).toBe(1)
  })

  test('does NOT cache failures — next call retries', async () => {
    let attempt = 0
    const loader = jest.fn(async () => {
      attempt++
      if (attempt === 1) throw new Error('first call always fails')
      return 'recovered'
    })
    await expect(getOrLoad('k', 60_000, loader)).rejects.toThrow('first call always fails')
    const value = await getOrLoad('k', 60_000, loader)
    expect(value).toBe('recovered')
    expect(loader).toHaveBeenCalledTimes(2)
  })

  test('different keys do not interfere', async () => {
    const aLoader = jest.fn(async () => 'A')
    const bLoader = jest.fn(async () => 'B')
    const [a, b] = await Promise.all([
      getOrLoad('a', 60_000, aLoader),
      getOrLoad('b', 60_000, bLoader),
    ])
    expect(a).toBe('A')
    expect(b).toBe('B')
    expect(aLoader).toHaveBeenCalledTimes(1)
    expect(bLoader).toHaveBeenCalledTimes(1)
  })
})

describe('invalidate', () => {
  test('invalidate(key) removes one entry', async () => {
    const loader = jest.fn(async () => 'v')
    await getOrLoad('k', 60_000, loader)
    invalidate('k')
    await getOrLoad('k', 60_000, loader)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  test('invalidate() with no key clears everything', async () => {
    const a = jest.fn(async () => 'A')
    const b = jest.fn(async () => 'B')
    await getOrLoad('a', 60_000, a)
    await getOrLoad('b', 60_000, b)
    invalidate()
    await getOrLoad('a', 60_000, a)
    await getOrLoad('b', 60_000, b)
    expect(a).toHaveBeenCalledTimes(2)
    expect(b).toHaveBeenCalledTimes(2)
  })
})
