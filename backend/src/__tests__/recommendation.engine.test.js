/**
 * Unit tests for the recommendation engine's pure-logic functions.
 *
 * calcRF, detectHabits, findCo, applyGlobalBoost, ensureMethodAvailability,
 * and guaranteeMethodDiversity have no I/O — they're deterministic given
 * their inputs. calcCF and getGlobalPopularity hit PurchaseModel; those are
 * mocked via jest.mock so the suite stays fast and DB-independent.
 */

jest.mock('../models/purchaseModel', () => ({
  find: jest.fn(),
  aggregate: jest.fn(),
}))

const PurchaseModel = require('../models/purchaseModel')
const {
  calcRF,
  detectHabits,
  findCo,
  calcCF,
  getGlobalPopularity,
  applyGlobalBoost,
  ensureMethodAvailability,
  guaranteeMethodDiversity,
} = require('../services/recommendation/engine')

// Constants matching what services/recommendation/index.js passes to engine.
const C = {
  MIN_HABITS: 2,
  CO_OCCURRENCE_ALPHA: 0.5,
  SIMILAR_USERS_LIMIT: 10,
  GLOBAL_BOOST_RATIO: 0.2,
  HALF_LIFE_DAYS: 30,
  DECAY_EPSILON: 0.1,
}

// Helper: build a fake purchase document with the shape engine.js expects.
const purchase = (timeStamp, productsArr, opts = {}) => ({
  _id: opts._id,
  purchasedBy: opts.purchasedBy,
  timeStamp,
  products: productsArr.map(([itemCode, numUnits]) => ({
    product: { itemCode },
    numUnits,
  })),
})

beforeEach(() => {
  jest.clearAllMocks()
})

// --- calcRF ----------------------------------------------------------------

describe('calcRF', () => {
  test('returns empty maps for empty history', () => {
    const { scores, lastTimes } = calcRF([], Date.now(), C)
    expect(scores).toEqual({})
    expect(lastTimes).toEqual({})
  })

  test('a single recent purchase scores roughly numUnits (decay ≈ 1)', () => {
    const now = Date.now()
    const history = [purchase(new Date(now), [['milk', 3]])]
    const { scores, lastTimes } = calcRF(history, now, C)
    // decay = exp(-lambda * 0) = 1, so score = 1 * 3
    expect(scores.milk).toBeCloseTo(3, 5)
    expect(lastTimes.milk).toBe(now)
  })

  test('decays exponentially with half-life', () => {
    const now = Date.now()
    const oneHalfLifeAgo = now - C.HALF_LIFE_DAYS * 24 * 3600 * 1000
    const history = [purchase(new Date(oneHalfLifeAgo), [['milk', 4]])]
    const { scores } = calcRF(history, now, C)
    // After one half-life, weight = 0.5 → score = 0.5 * 4 = 2
    expect(scores.milk).toBeCloseTo(2, 3)
  })

  test('decay is clamped at DECAY_EPSILON for very old purchases', () => {
    const now = Date.now()
    const longAgo = now - 365 * 100 * 24 * 3600 * 1000 // 100 years ago
    const history = [purchase(new Date(longAgo), [['milk', 5]])]
    const { scores } = calcRF(history, now, C)
    // weight floor is DECAY_EPSILON (0.1) → score = 0.1 * 5 = 0.5
    expect(scores.milk).toBeCloseTo(0.5, 3)
  })

  test('accumulates across purchases and tracks latest timestamp', () => {
    const t1 = Date.now() - 1000
    const t2 = Date.now()
    const history = [
      purchase(new Date(t1), [['milk', 1]]),
      purchase(new Date(t2), [['milk', 2]]),
    ]
    const { scores, lastTimes } = calcRF(history, t2, C)
    expect(scores.milk).toBeGreaterThan(2)   // sum of two terms
    expect(lastTimes.milk).toBe(t2)          // latest wins
  })

  test('numUnits defaults to 1 for non-positive/NaN', () => {
    const now = Date.now()
    const history = [purchase(new Date(now), [['milk', 0], ['bread', NaN]])]
    const { scores } = calcRF(history, now, C)
    expect(scores.milk).toBeCloseTo(1, 5)
    expect(scores.bread).toBeCloseTo(1, 5)
  })

  test('skips entries with invalid timeStamp', () => {
    const history = [
      { timeStamp: 'not-a-date', products: [{ product: { itemCode: 'x' }, numUnits: 1 }] },
    ]
    const { scores } = calcRF(history, Date.now(), C)
    expect(scores).toEqual({})
  })
})

// --- detectHabits ----------------------------------------------------------

describe('detectHabits', () => {
  test('finds codes purchased ≥ MIN_HABITS times on today\'s weekday', () => {
    const monday1 = new Date('2026-01-05T10:00:00Z') // Monday
    const monday2 = new Date('2026-01-12T10:00:00Z') // Monday
    const history = [
      purchase(monday1, [['milk', 1]]),
      purchase(monday2, [['milk', 1]]),
    ]
    const todayWd = 1 // Monday
    const result = detectHabits(history, todayWd, new Set(), C)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ code: 'milk', score: 2, method: 'habit' })
  })

  test('excludes codes already in the current list', () => {
    const monday = new Date('2026-01-05T10:00:00Z')
    const history = [purchase(monday, [['milk', 1]]), purchase(monday, [['milk', 1]])]
    const result = detectHabits(history, 1, new Set(['milk']), C)
    expect(result).toEqual([])
  })

  test('falls back to overall-max weekday count when nothing matches today', () => {
    // Two Tuesday purchases of bread, but today is Friday.
    const tue = new Date('2026-01-06T10:00:00Z') // Tuesday
    const history = [purchase(tue, [['bread', 1]]), purchase(tue, [['bread', 1]])]
    const result = detectHabits(history, 5, new Set(), C) // Friday
    expect(result).toHaveLength(1)
    expect(result[0].code).toBe('bread')
  })

  test('returns empty when no code has ≥ MIN_HABITS purchases', () => {
    const history = [purchase(new Date(), [['rare', 1]])]
    expect(detectHabits(history, new Date().getDay(), new Set(), C)).toEqual([])
  })
})

// --- findCo ----------------------------------------------------------------

describe('findCo', () => {
  test('counts items co-purchased with codes in current list', () => {
    const t = new Date()
    const history = [
      purchase(t, [['milk', 1], ['bread', 1]]),
      purchase(t, [['milk', 1], ['eggs', 1]]),
    ]
    const result = findCo(history, new Set(['milk']), {}, C)
    const codes = result.map(r => r.code).sort()
    expect(codes).toEqual(['bread', 'eggs'])
    // Each appears once next to 'milk', and userScores is empty so score = 1.
    result.forEach(r => expect(r.score).toBeCloseTo(1, 5))
  })

  test('skips baskets that do not include any code from current list', () => {
    const t = new Date()
    const history = [purchase(t, [['unrelated1', 1], ['unrelated2', 1]])]
    expect(findCo(history, new Set(['milk']), {}, C)).toEqual([])
  })

  test('boosts co-occurrence by user RF score via CO_OCCURRENCE_ALPHA', () => {
    const t = new Date()
    const history = [purchase(t, [['milk', 1], ['bread', 1]])]
    const userScores = { bread: 10 }
    const [r] = findCo(history, new Set(['milk']), userScores, C)
    // score = co * (1 + alpha * userScore) = 1 * (1 + 0.5 * 10) = 6
    expect(r.code).toBe('bread')
    expect(r.score).toBeCloseTo(6, 5)
  })
})

// --- calcCF (DB-mocked) ----------------------------------------------------

describe('calcCF', () => {
  test('returns [] when user has no purchase history', async () => {
    PurchaseModel.find.mockReturnValue({ lean: () => Promise.resolve([]) })
    const result = await calcCF([], 'me', new Set(), C)
    expect(result).toEqual([])
    expect(PurchaseModel.find).not.toHaveBeenCalled()
  })

  test('recommends items from similar users (Jaccard)', async () => {
    const t = new Date()
    const myHistory = [purchase(t, [['milk', 1], ['bread', 1]])]
    // Another user bought milk + bread + eggs → high similarity, recommends eggs.
    PurchaseModel.find.mockReturnValue({
      lean: () => Promise.resolve([
        { purchasedBy: 'other', products: [
          { product: { itemCode: 'milk' } },
          { product: { itemCode: 'bread' } },
          { product: { itemCode: 'eggs' } },
        ] },
      ])
    })
    const result = await calcCF(myHistory, 'me', new Set(['milk', 'bread']), C)
    expect(result.find(r => r.code === 'eggs')).toBeDefined()
    expect(result.every(r => r.method === 'cf')).toBe(true)
  })

  test('excludes codes already in current list', async () => {
    const t = new Date()
    const myHistory = [purchase(t, [['milk', 1]])]
    PurchaseModel.find.mockReturnValue({
      lean: () => Promise.resolve([
        { purchasedBy: 'other', products: [
          { product: { itemCode: 'milk' } },
          { product: { itemCode: 'eggs' } },
        ] },
      ])
    })
    const result = await calcCF(myHistory, 'me', new Set(['eggs']), C)
    expect(result.find(r => r.code === 'eggs')).toBeUndefined()
  })

  test('queries with $ne: userId so the user is not their own neighbour', async () => {
    PurchaseModel.find.mockReturnValue({ lean: () => Promise.resolve([]) })
    const myHistory = [purchase(new Date(), [['milk', 1]])]
    await calcCF(myHistory, 'me', new Set(), C)
    expect(PurchaseModel.find).toHaveBeenCalledWith({ purchasedBy: { $ne: 'me' } })
  })
})

// --- getGlobalPopularity (DB-mocked, also cache-aware) ---------------------

describe('getGlobalPopularity', () => {
  beforeEach(() => {
    // Wipe the singleton cache between cases so test ordering doesn't matter.
    const { invalidate } = require('../services/recommendation/cache')
    invalidate()
  })

  test('aggregates and returns counts + maxCount', async () => {
    PurchaseModel.aggregate.mockResolvedValue([
      { _id: 'milk', count: 5 },
      { _id: 'bread', count: 2 },
    ])
    const { counts, maxCount } = await getGlobalPopularity(C)
    expect(counts).toEqual({ milk: 5, bread: 2 })
    expect(maxCount).toBe(5)
  })

  test('handles empty aggregation (maxCount falls back to 1)', async () => {
    PurchaseModel.aggregate.mockResolvedValue([])
    const { counts, maxCount } = await getGlobalPopularity(C)
    expect(counts).toEqual({})
    expect(maxCount).toBe(1)
  })

  test('is cached within TTL (one DB hit for N calls)', async () => {
    PurchaseModel.aggregate.mockResolvedValue([{ _id: 'milk', count: 3 }])
    await Promise.all([getGlobalPopularity(C), getGlobalPopularity(C), getGlobalPopularity(C)])
    expect(PurchaseModel.aggregate).toHaveBeenCalledTimes(1)
  })
})

// --- applyGlobalBoost ------------------------------------------------------

describe('applyGlobalBoost', () => {
  test('leaves score unchanged when item has zero global count', () => {
    const out = applyGlobalBoost([{ code: 'x', score: 10 }], {}, 100, C)
    expect(out[0].score).toBe(10)
  })

  test('boosts proportionally to globalCount / maxCount', () => {
    // boost = (count/max) * GLOBAL_BOOST_RATIO * score
    // = (50/100) * 0.2 * 10 = 1 → new score = 11
    const out = applyGlobalBoost([{ code: 'milk', score: 10 }], { milk: 50 }, 100, C)
    expect(out[0].score).toBeCloseTo(11, 5)
  })

  test('does not mutate input', () => {
    const input = [{ code: 'x', score: 10 }]
    applyGlobalBoost(input, { x: 100 }, 100, C)
    expect(input[0].score).toBe(10)
  })
})

// --- ensureMethodAvailability ----------------------------------------------

describe('ensureMethodAvailability', () => {
  test('fills empty pools using popularity, skipping items in current list', () => {
    const pools = { habit: [], co: [], cf: [], personal: [] }
    const counts = { a: 10, b: 8, c: 6, d: 4, e: 2, f: 1 }
    ensureMethodAvailability(pools, counts, new Set(['a']), C)
    // 'a' filtered out; remaining order by count desc: b, c, d, e, f
    expect(pools.personal.length).toBeGreaterThan(0)
    expect(pools.personal.every(p => p.code !== 'a')).toBe(true)
  })

  test('does not overwrite non-empty pools', () => {
    const existing = [{ code: 'habit-pre', score: 99, method: 'habit' }]
    const pools = { habit: existing, co: [], cf: [], personal: [] }
    ensureMethodAvailability(pools, { a: 1 }, new Set(), C)
    expect(pools.habit).toBe(existing)
  })
})

// --- guaranteeMethodDiversity ---------------------------------------------

describe('guaranteeMethodDiversity', () => {
  test('picks one per method up to topN, AI first', () => {
    const pools = {
      ai: [{ code: 'ai1', score: 5, method: 'ai' }],
      habit: [{ code: 'h1', score: 4, method: 'habit' }],
      co: [{ code: 'c1', score: 3, method: 'co' }],
      cf: [{ code: 'cf1', score: 2, method: 'cf' }],
      personal: [{ code: 'p1', score: 1, method: 'personal' }],
    }
    const result = guaranteeMethodDiversity(pools, 5)
    expect(result.map(r => r.method)).toEqual(['ai', 'habit', 'co', 'cf', 'personal'])
  })

  test('never duplicates an item across pools', () => {
    const dup = { code: 'shared', score: 5, method: 'co' }
    const pools = {
      ai: [{ code: 'shared', score: 9, method: 'ai' }],
      habit: [],
      co: [dup],
      cf: [],
      personal: [{ code: 'shared', score: 1, method: 'personal' }],
    }
    const result = guaranteeMethodDiversity(pools, 5)
    const codes = result.map(r => r.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  test('respects topN cap even with abundant pools', () => {
    const pools = {
      ai: [{ code: 'a', score: 1, method: 'ai' }],
      habit: Array.from({ length: 3 }, (_, i) => ({ code: 'h' + i, score: 1, method: 'habit' })),
      co: Array.from({ length: 3 }, (_, i) => ({ code: 'c' + i, score: 1, method: 'co' })),
      cf: [], personal: [],
    }
    expect(guaranteeMethodDiversity(pools, 3)).toHaveLength(3)
  })
})
