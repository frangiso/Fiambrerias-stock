// Cache en memoria para minimizar lecturas a Firestore
const cache = {}
const TTL = 5 * 60 * 1000 // 5 minutos

export function getCache(key) {
  const entry = cache[key]
  if (!entry) return null
  if (Date.now() - entry.ts > TTL) { delete cache[key]; return null }
  return entry.data
}

export function setCache(key, data) {
  cache[key] = { data, ts: Date.now() }
}

export function invalidateCache(key) {
  delete cache[key]
}

export function invalidateAll() {
  Object.keys(cache).forEach(k => delete cache[k])
}
