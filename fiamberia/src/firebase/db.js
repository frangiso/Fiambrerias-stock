// ══════════════════════════════════════════════════════
// Capa de acceso a datos — centraliza lecturas a Firestore
// con caché inteligente para minimizar lecturas
// ══════════════════════════════════════════════════════
import { collection, getDocs, query, where, orderBy, limit, Timestamp, doc, increment, writeBatch } from 'firebase/firestore'
import { db } from './config.js'
import { getCache, setCache, invalidateCache } from './cache.js'

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

// ── Clientes (cuenta corriente / fiado)
export async function getClientes(forceRefresh = false) {
  const key = 'clientes'
  if (!forceRefresh) {
    const cached = getCache(key)
    if (cached) return cached
  }
  const snap = await getDocs(collection(db, 'clientes'))
  const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  lista.sort((a, b) => a.nombre?.localeCompare(b.nombre))
  setCache(key, lista)
  return lista
}

// ── Anular venta: revierte stock, caja/cuenta corriente y deja registro de auditoría.
// No borra nada — la venta original queda marcada como anulada y se agregan
// movimientos/caja compensatorios para mantener la trazabilidad completa.
export async function anularVenta(venta, motivo, usuarioEmail) {
  const batch = writeBatch(db)

  batch.update(doc(db, 'ventas', venta.id), {
    anulada: true,
    motivoAnulacion: motivo,
    anuladaPor: usuarioEmail,
    anuladaFecha: Timestamp.now(),
  })

  for (const item of venta.items) {
    if (item.esReceta) {
      for (const ing of (item.ingredientes || [])) {
        const cantTotal = ing.cantidad * item.cantidad
        batch.update(doc(db, 'productos', ing.productoId), { stock: increment(cantTotal) })
        const movRef = doc(collection(db, 'movimientos'))
        batch.set(movRef, {
          productoId: ing.productoId, productoNombre: ing.productoNombre, tipo: 'anulacion',
          cantidad: cantTotal, unidad: ing.unidad, ventaId: venta.id, fecha: Timestamp.now()
        })
      }
    } else {
      batch.update(doc(db, 'productos', item.id), { stock: increment(item.cantidad) })
      const movRef = doc(collection(db, 'movimientos'))
      batch.set(movRef, {
        productoId: item.id, productoNombre: item.nombre, tipo: 'anulacion',
        cantidad: item.cantidad, unidad: item.unidad, ventaId: venta.id, fecha: Timestamp.now()
      })
    }
  }

  if (venta.medioPago === 'Fiado' && venta.clienteId) {
    batch.update(doc(db, 'clientes', venta.clienteId), { saldo: increment(-venta.total) })
  } else {
    const cajaRef = doc(collection(db, 'caja'))
    batch.set(cajaRef, {
      concepto: `Anulación de venta — ${motivo}`,
      monto: venta.total, tipo: 'egreso', subtipo: 'Anulación de venta',
      ventaId: venta.id, fecha: Timestamp.now()
    })
  }

  await batch.commit()
  invalidateCache('productos', 'caja', 'reportes', 'clientes')
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
