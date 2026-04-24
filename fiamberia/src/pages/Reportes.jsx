import { useState, useEffect } from 'react'
import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore'
import { db } from '../firebase/config.js'

export default function Reportes() {
  const [movimientos, setMovimientos] = useState([])
  const [ventas, setVentas] = useState([])
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState('hoy')

  useEffect(() => { cargar() }, [periodo])

  function getFechaDesde() {
    const now = new Date()
    if (periodo === 'hoy') {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate())
    }
    if (periodo === 'semana') {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      return d
    }
    if (periodo === 'mes') {
      return new Date(now.getFullYear(), now.getMonth(), 1)
    }
    return new Date(0)
  }

  async function cargar() {
    setLoading(true)
    const desde = Timestamp.fromDate(getFechaDesde())
    try {
      const [movSnap, venSnap] = await Promise.all([
        getDocs(query(collection(db, 'movimientos'), where('fecha', '>=', desde))),
        getDocs(query(collection(db, 'ventas'), where('fecha', '>=', desde)))
      ])
      setMovimientos(movSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setVentas(venSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch {
      setMovimientos([])
      setVentas([])
    }
    setLoading(false)
  }

  // Calcular top ventas por producto
  const topProductos = Object.values(
    movimientos
      .filter(m => m.tipo === 'venta')
      .reduce((acc, m) => {
        if (!acc[m.productoId]) acc[m.productoId] = { nombre: m.productoNombre, cantidad: 0, unidad: m.unidad }
        acc[m.productoId].cantidad += m.cantidad
        return acc
      }, {})
  ).sort((a, b) => b.cantidad - a.cantidad).slice(0, 10)

  const totalVentas = ventas.reduce((acc, v) => acc + (v.total || 0), 0)
  const cantVentas = ventas.length

  function formatFecha(ts) {
    if (!ts) return '—'
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Reportes</h1>
        <p className="page-subtitle">Movimientos y estadísticas</p>
      </div>

      {/* Filtro período */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        {[
          { key: 'hoy', label: 'Hoy' },
          { key: 'semana', label: 'Última semana' },
          { key: 'mes', label: 'Este mes' },
          { key: 'todo', label: 'Todo' },
        ].map(p => (
          <button
            key={p.key}
            className={`btn btn-sm ${periodo === p.key ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setPeriodo(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? <div className="loading">Cargando...</div> : (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 16, marginBottom: 28 }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>
                ${totalVentas.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>
                Total vendido
              </div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>{cantVentas}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>
                Ventas realizadas
              </div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>
                {movimientos.filter(m => m.tipo === 'carga').length}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>
                Cargas de stock
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
            {/* Top productos */}
            <div className="card">
              <h3 style={{ marginBottom: 16, fontSize: '1rem' }}>🏆 Más vendidos</h3>
              {topProductos.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Sin datos en este período</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {topProductos.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--muted)', width: 20 }}>#{i + 1}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{p.nombre}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                          {p.unidad === 'kg' ? `${p.cantidad.toFixed(2)} kg` : `${p.cantidad} u.`}
                        </div>
                      </div>
                      <div style={{ height: 6, width: `${(p.cantidad / topProductos[0].cantidad) * 80}px`, background: 'var(--primary)', borderRadius: 3, opacity: 0.6 }} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Últimas ventas */}
            <div className="card">
              <h3 style={{ marginBottom: 16, fontSize: '1rem' }}>🧾 Últimas ventas</h3>
              {ventas.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Sin ventas en este período</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto' }}>
                  {ventas.slice().reverse().slice(0, 15).map(v => (
                    <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{formatFecha(v.fecha)}</div>
                        <div style={{ fontSize: '0.8rem' }}>{v.items?.length || 0} ítem{v.items?.length !== 1 ? 's' : ''}</div>
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--primary)' }}>
                        ${(v.total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Historial de movimientos */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '1rem' }}>📋 Historial de movimientos</h3>
            </div>
            <div className="table-wrap">
              {movimientos.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📋</div>
                  <p>Sin movimientos en este período</p>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Producto</th>
                      <th>Tipo</th>
                      <th>Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.slice().reverse().map(m => (
                      <tr key={m.id}>
                        <td style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{formatFecha(m.fecha)}</td>
                        <td style={{ fontWeight: 600 }}>{m.productoNombre}</td>
                        <td>
                          <span className={`badge ${m.tipo === 'venta' ? 'badge-danger' : 'badge-ok'}`}>
                            {m.tipo === 'venta' ? '↓ Venta' : '↑ Carga'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700 }}>
                          {m.tipo === 'venta' ? '-' : '+'}{m.unidad === 'kg' ? `${m.cantidad} kg` : `${m.cantidad} u.`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
