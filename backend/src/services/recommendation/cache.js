// Tiny single-flight TTL cache for read-mostly recommendation lookups.
// Each entry stores either a resolved value with an expiry timestamp,
// or an in-flight promise that subsequent callers wait on (so a burst
// of concurrent recommendation requests collapses to one DB hit).
//
// Process-local on purpose — the recommendation engine is read-mostly,
// the dataset turns over slowly (Product catalog refreshes once a day
// via the scraper; purchase popularity is stable over short windows),
// and a 60-second TTL is plenty to absorb request bursts without
// introducing visible staleness.

const cache = new Map() // key -> { value?, expiresAt?, promise? }

function getOrLoad(key, ttlMs, loader) {
  const now = Date.now()
  const hit = cache.get(key)

  if (hit && hit.value !== undefined && hit.expiresAt > now) {
    return Promise.resolve(hit.value)
  }
  if (hit && hit.promise) {
    return hit.promise
  }

  const promise = (async () => {
    try {
      const value = await loader()
      cache.set(key, { value, expiresAt: Date.now() + ttlMs })
      return value
    } catch (err) {
      // Don't cache failures — let the next caller retry.
      cache.delete(key)
      throw err
    }
  })()

  cache.set(key, { promise })
  return promise
}

function invalidate(key) {
  if (key === undefined) cache.clear()
  else cache.delete(key)
}

module.exports = { getOrLoad, invalidate }
