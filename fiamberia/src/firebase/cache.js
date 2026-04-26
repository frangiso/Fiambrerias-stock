// ══════════════════════════════════════════════════════
// Cache en memoria — minimiza lecturas a Firestore
// TTL diferenciado: datos estáticos vs datos dinámicos
// ══════════════════════════════════════════════════════
const cache = {}

const TTL = {
  productos: 10 * 60 * 1000,  // 10 min — cambian poco
  rubros:    30 * 60 * 1000,  // 30 min — casi nunca cambian
  recetas:   15 * 60 * 1000,  // 15 min
  compras:    5 * 60 * 1000,  // 5 min
  caja:       2 * 60 * 1000,  // 2 min — cambia seguido
  reportes:   3 * 60 * 1000,  // 3 min
  default:    5 * 60 * 1000,
}

function getTTL(key) {
  const type = Object.keys(TTL).find(t => key.startsWith(t))
  return TTL[type] || TTL.default
}

export function getCache(key) {
  const entry = cache[key]
  if (!entry) return null
  if (Date.now() - entry.ts > getTTL(key)) { delete cache[key]; return null }
  return entry.data
}

export function setCache(key, data) {
  cache[key] = { data, ts: Date.now() }
}

export function invalidateCache(...keys) {
  keys.forEach(k => {
    // Invalida todas las claves que empiecen con k
    Object.keys(cache).forEach(ck => {
      if (ck === k || ck.startsWith(k)) delete cache[ck]
    })
  })
}

export function invalidateAll() {
  Object.keys(cache).forEach(k => delete cache[k])
}

// Actualizar un item dentro de una colección cacheada sin re-leer
export function updateCacheItem(key, id, updater) {
  const entry = cache[key]
  if (!entry) return
  entry.data = entry.data.map(item => item.id === id ? updater(item) : item)
}

export function addCacheItem(key, item) {
  const entry = cache[key]
  if (!entry) return
  entry.data = [...entry.data, item]
}

export function removeCacheItem(key, id) {
  const entry = cache[key]
  if (!entry) return
  entry.data = entry.data.filter(item => item.id !== id)
}
