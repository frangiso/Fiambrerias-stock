import { useState, useEffect } from 'react'
import { Timestamp } from 'firebase/firestore'
import { getReportes } from '../firebase/db.js'

export default function Reportes() {
  const [data, setData] = useState({ movimientos:[], ventas:[], caja:[] })
  const [loading, setLoading] = useState(true)
  const [tipoPeriodo, setTipoPeriodo] = useState('dia')
  const [fechaDia, setFechaDia] = useState(new Date().toISOString().split('T')[0])
  const [fechaMes, setFechaMes] = useState(new Date().toISOString().slice(0,7))

  useEffect(() => { cargar() }, [tipoPeriodo, fechaDia, fechaMes])

  function getRango() {
    if (tipoPeriodo === 'dia') {
      return {
        desde: Timestamp.fromDate(new Date(fechaDia + 'T00:00:00')),
        hasta: Timestamp.fromDate(new Date(fechaDia + 'T23:59:59')),
        key: `dia_${fechaDia}`
      }
    }
    if (tipoPeriodo === 'mes') {
      const [a, m] = fechaMes.split('-').map(Number)
      return {
        desde: Timestamp.fromDate(new Date(a, m-1, 1)),
        hasta: Timestamp.fromDate(new Date(a, m, 0, 23, 59, 59)),
        key: `mes_${fechaMes}`
      }
    }
    // semana
    const hoy = new Date()
    const d7 = new Date(hoy); d7.setDate(d7.getDate()-7); d7.setHours(0,0,0,0)
    hoy.setHours(23,59,59,999)
    return { desde: Timestamp.fromDate(d7), hasta: Timestamp.fromDate(hoy), key: 'semana' }
  }

  async function cargar() {
    setLoading(true)
    const { desde, hasta, key } = getRango()
    const result = await getReportes(desde, hasta, key)
    setData(result)
    setLoading(false)
  }

  const { movimientos, ventas, caja } = data
  const totalVentas  = ventas.reduce((a,v) => a+(v.total||0), 0)
  const cantVentas   = ventas.length
  const ingresosCaja = caja.filter(m => m.tipo==='ingreso'||m.tipo==='apertura').reduce((a,m) => a+m.monto, 0)
  const egresosCaja  = caja.filter(m => m.tipo==='egreso').reduce((a,m) => a+m.monto, 0)
  const saldoCaja    = ingresosCaja - egresosCaja

  // Top productos vendidos (solo movimientos de venta)
  const topProductos = Object.values(
    movimientos.reduce((acc, m) => {
      if (!acc[m.productoId]) acc[m.productoId] = { nombre: m.productoNombre, cantidad:0, unidad: m.unidad }
      acc[m.productoId].cantidad += m.cantidad
      return acc
    }, {})
  ).sort((a,b) => b.cantidad - a.cantidad).slice(0,10)

  function formatFecha(ts) {
    if (!ts) return '—'
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})
  }

  const labelPeriodo = tipoPeriodo === 'dia'
    ? new Date(fechaDia+'T12:00:00').toLocaleDateString('es-AR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})
    : tipoPeriodo === 'mes'
    ? new Date(fechaMes+'-15').toLocaleDateString('es-AR',{month:'long',year:'numeric'})
    : 'Última semana'

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Reportes</h1>
        <p className="page-subtitle">{labelPeriodo}</p>
      </div>

      {/* Selector período */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', gap:6 }}>
          {[['dia','Día'],['semana','Semana'],['mes','Mes']].map(([k,l]) => (
            <button key={k} className={`btn btn-sm ${tipoPeriodo===k?'btn-primary':'btn-outline'}`} onClick={() => setTipoPeriodo(k)}>{l}</button>
          ))}
        </div>
        {tipoPeriodo === 'dia' && (
          <input type="date" value={fechaDia} onChange={e => setFechaDia(e.target.value)}
            style={{ padding:'7px 12px', border:'1px solid var(--border)', borderRadius:9, fontSize:'0.88rem' }} />
        )}
        {tipoPeriodo === 'mes' && (
          <input type="month" value={fechaMes} onChange={e => setFechaMes(e.target.value)}
            style={{ padding:'7px 12px', border:'1px solid var(--border)', borderRadius:9, fontSize:'0.88rem' }} />
        )}
        <button className="btn btn-outline btn-sm" onClick={cargar}>🔄 Actualizar</button>
      </div>

      {loading ? <div className="loading">Cargando...</div> : (
        <>
          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:14, marginBottom:24 }}>
            {[
              { label:'Total vendido',      val:`$${totalVentas.toLocaleString('es-AR',{minimumFractionDigits:2})}`, color:'var(--primary)' },
              { label:'Transacciones',      val:cantVentas,  color:'var(--primary)' },
              { label:'Ticket promedio',    val:`$${cantVentas ? Math.round(totalVentas/cantVentas).toLocaleString('es-AR') : 0}`, color:'var(--gold)' },
              { label:'Ingresos caja',      val:`$${ingresosCaja.toLocaleString('es-AR',{minimumFractionDigits:2})}`, color:'var(--primary)' },
              { label:'Egresos caja',       val:`$${egresosCaja.toLocaleString('es-AR',{minimumFractionDigits:2})}`, color:'var(--danger)' },
              { label:'Saldo caja',         val:`$${saldoCaja.toLocaleString('es-AR',{minimumFractionDigits:2})}`,   color: saldoCaja>=0?'var(--primary)':'var(--danger)' },
            ].map((s,i) => (
              <div key={i} className="card" style={{ textAlign:'center' }}>
                <div style={{ fontSize:'1.3rem', fontWeight:800, color:s.color, lineHeight:1, marginBottom:4 }}>{s.val}</div>
                <div style={{ fontSize:'0.7rem', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18, marginBottom:20 }}>
            {/* Top productos */}
            <div className="card">
              <h3 style={{ marginBottom:14, fontSize:'1rem', fontWeight:700 }}>🏆 Más vendidos</h3>
              {topProductos.length === 0
                ? <p style={{ color:'var(--muted)', fontSize:'0.85rem' }}>Sin datos en este período</p>
                : topProductos.map((p,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                    <span style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--muted)', width:22 }}>#{i+1}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, fontSize:'0.85rem' }}>{p.nombre}</div>
                      <div style={{ fontSize:'0.72rem', color:'var(--muted)' }}>
                        {p.unidad==='kg'?`${p.cantidad.toFixed(2)} kg`:`${p.cantidad} u.`}
                      </div>
                    </div>
                    <div style={{ height:5, width:`${(p.cantidad/topProductos[0].cantidad*80).toFixed(0)}px`, minWidth:4, background:'var(--sage-light)', borderRadius:3 }} />
                  </div>
                ))
              }
            </div>

            {/* Últimas ventas */}
            <div className="card">
              <h3 style={{ marginBottom:14, fontSize:'1rem', fontWeight:700 }}>🧾 Ventas del período</h3>
              {ventas.length === 0
                ? <p style={{ color:'var(--muted)', fontSize:'0.85rem' }}>Sin ventas en este período</p>
                : <div style={{ maxHeight:280, overflowY:'auto' }}>
                    {ventas.slice().reverse().slice(0,20).map(v => (
                      <div key={v.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:'1px solid var(--border)', fontSize:'0.82rem' }}>
                        <div>
                          <div style={{ fontSize:'0.76rem', color:'var(--muted)' }}>{formatFecha(v.fecha)}</div>
                          <div style={{ fontSize:'0.8rem' }}>{v.items?.length||0} ítem{v.items?.length!==1?'s':''}</div>
                        </div>
                        <div style={{ fontWeight:800, color:'var(--primary)' }}>${(v.total||0).toLocaleString('es-AR',{minimumFractionDigits:2})}</div>
                      </div>
                    ))}
                  </div>
              }
            </div>
          </div>

          {/* Movimientos de stock — solo ventas */}
          <div className="card" style={{ padding:0 }}>
            <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', fontWeight:700, fontSize:'0.95rem' }}>
              📋 Movimientos de stock (ventas)
            </div>
            <div className="table-wrap">
              {movimientos.length === 0
                ? <div className="empty-state"><div className="empty-icon">📋</div><p>Sin movimientos en este período</p></div>
                : <table>
                    <thead><tr><th>Fecha</th><th>Producto</th><th>Cantidad vendida</th></tr></thead>
                    <tbody>
                      {movimientos.slice().reverse().map(m => (
                        <tr key={m.id}>
                          <td style={{ color:'var(--muted)', fontSize:'0.8rem' }}>{formatFecha(m.fecha)}</td>
                          <td style={{ fontWeight:600 }}>{m.productoNombre}</td>
                          <td style={{ fontWeight:700, color:'var(--danger)' }}>
                            -{m.unidad==='kg'?`${m.cantidad} kg`:`${m.cantidad} u.`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              }
            </div>
          </div>
        </>
      )}
    </div>
  )
}
