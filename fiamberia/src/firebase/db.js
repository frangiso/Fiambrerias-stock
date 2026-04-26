// ══════════════════════════════════════════════════════
// Capa de acceso a datos — centraliza lecturas a Firestore
// con caché inteligente para minimizar lecturas
// ══════════════════════════════════════════════════════
import { collection, getDocs, query, where, orderBy, limit, Timestamp } from 'firebase/firestore'
import { db } from './config.js'
import { getCache, setCache } from './cache.js'

// ── Productos (más leído de todo el sistema)
export async function getProductos(forceRefresh = false) {
  const key = 'productos'
  if (!forceRefresh) {
    const cached = getCache(key)
    if (cached) return cached
  }
  const snap = await getDocs(collection(db, 'productos'))
  const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  lista.sort((a, b) => a.nombre?.localeCompare(b.nombre))
  setCache(key, lista)
  return lista
}

// ── Rubros
export async function getRubros(forceRefresh = false) {
  const key = 'rubros'
  if (!forceRefresh) {
    const cached = getCache(key)
    if (cached) return cached
  }
  const snap = await getDocs(collection(db, 'rubros'))
  const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  setCache(key, lista)
  return lista
}

// ── Recetas
export async function getRecetas(forceRefresh = false) {
  const key = 'recetas'
  if (!forceRefresh) {
    const cached = getCache(key)
    if (cached) return cached
  }
  const snap = await getDocs(collection(db, 'recetas'))
  const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  setCache(key, lista)
  return lista
}

// ── Caja del día (filtrada, con caché por fecha)
export async function getCajaDelDia(fecha, forceRefresh = false) {
  const key = `caja_${fecha}`
  if (!forceRefresh) {
    const cached = getCache(key)
    if (cached) return cached
  }
  const partes = fecha.split('-').map(Number)
  const dInicio = new Date(partes[0], partes[1]-1, partes[2], 0, 0, 0, 0)
  const dFin    = new Date(partes[0], partes[1]-1, partes[2], 23, 59, 59, 999)
  const snap = await getDocs(query(
    collection(db, 'caja'),
    where('fecha', '>=', Timestamp.fromDate(dInicio)),
    where('fecha', '<=', Timestamp.fromDate(dFin))
  ))
  const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  lista.sort((a, b) => (a.fecha?.seconds || 0) - (b.fecha?.seconds || 0))
  setCache(key, lista)
  return lista
}

// ── Compras (paginadas — solo las últimas 50)
export async function getCompras(forceRefresh = false) {
  const key = 'compras'
  if (!forceRefresh) {
    const cached = getCache(key)
    if (cached) return cached
  }
  const snap = await getDocs(query(
    collection(db, 'compras'),
    orderBy('fecha', 'desc'),
    limit(50)
  ))
  const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  setCache(key, lista)
  return lista
}

// ── Reportes (filtrados por rango — con caché por clave única)
export async function getReportes(desde, hasta, cacheKey, forceRefresh = false) {
  const key = `reportes_${cacheKey}`
  if (!forceRefresh) {
    const cached = getCache(key)
    if (cached) return cached
  }
  const [movSnap, venSnap, cajaSnap] = await Promise.all([
    getDocs(query(collection(db, 'movimientos'),
      where('tipo', '==', 'venta'), // solo ventas, no cargas
      where('fecha', '>=', desde),
      where('fecha', '<=', hasta)
    )),
    getDocs(query(collection(db, 'ventas'),
      where('fecha', '>=', desde),
      where('fecha', '<=', hasta)
    )),
    getDocs(query(collection(db, 'caja'),
      where('fecha', '>=', desde),
      where('fecha', '<=', hasta)
    ))
  ])
  const result = {
    movimientos: movSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    ventas:      venSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    caja:        cajaSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  }
  setCache(key, result)
  return result
}
