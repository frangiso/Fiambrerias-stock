import { useState, useEffect } from 'react'
import { Timestamp } from 'firebase/firestore'
import { getReportes, anularVenta, getProductos, getClientes } from '../firebase/db.js'
import { useApp } from '../context/AppContext.jsx'

function exportarCSV(filas, columnas, nombreArchivo) {
  const header = columnas.map(c => c.label).join(',')
  const rows = filas.map(f => columnas.map(c => `"${String(c.get(f) ?? '').replace(/"/g,'""')}"`).join(','))
  const csv = [header, ...rows].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nombreArchivo; a.click()
  URL.revokeObjectURL(url)
}

export default function Reportes() {
  const { isAdmin, user } = useApp()
  const [data, setData] = useState({ movimientos:[], ventas:[], caja:[] })
  const [loading, setLoading] = useState(true)
  const [tipoPeriodo, setTipoPeriodo] = useState('dia')
  const [fechaDia, setFechaDia] = useState((() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}` })())
  const [fechaMes, setFechaMes] = useState(new Date().toISOString().slice(0,7))
  const [toast, setToast] = useState(null)
  const [productosMap, setProductosMap] = useState({})
  const [backupCargando, setBackupCargando] = useState(false)

  useEffect(() => { cargar() }, [tipoPeriodo, fechaDia, fechaMes])

  // Costos actuales de los productos, para estimar margen — usa la misma
  // caché que el resto de la app, no genera lecturas extra de Firestore.
  useEffect(() => {
    if (!isAdmin) return
    getProductos(false).then(lista => setProductosMap(Object.fromEntries(lista.map(p => [p.id, p]))))
  }, [isAdmin])

  function getRango() {
    if (tipoPeriodo === 'dia') {
      const p = fechaDia.split('-').map(Number)
      return {
        desde: Timestamp.fromDate(new Date(p[0], p[1]-1, p[2], 0, 0, 0)),
        hasta: Timestamp.fromDate(new Date(p[0], p[1]-1, p[2], 23, 59, 59)),
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
    const hoy = new Date(); hoy.setHours(23,59,59,999)
    const d7  = new Date(); d7.setDate(d7.getDate()-7); d7.setHours(0,0,0,0)
    return { desde: Timestamp.fromDate(d7), hasta: Timestamp.fromDate(hoy), key: 'semana' }
  }

  async function cargar(force = false) {
    setLoading(true)
    const { desde, hasta, key } = getRango()
    const result = await getReportes(desde, hasta, key, force)
    setData(result)
    setLoading(false)
  }

  async function handleAnular(venta) {
    const motivo = prompt(`Anular venta de $${(venta.total||0).toLocaleString('es-AR')}.\n¿Motivo? (queda registrado en la auditoría)`)
    if (motivo === null) return
    if (!motivo.trim()) { mostrarToast('Necesitás indicar un motivo', 'danger'); return }
    if (!confirm('¿Confirmás anular esta venta? Se repone el stock y se revierte el movimiento de caja/cuenta corriente. La venta original queda visible pero marcada como anulada.')) return
    try {
      await anularVenta(venta, motivo.trim(), user?.email)
      mostrarToast('✅ Venta anulada', 'success')
      cargar(true)
    } catch (e) {
      console.error('anularVenta error:', e)
      mostrarToast('❌ Error al anular: ' + (e.message||''), 'danger')
    }
  }

  function mostrarToast(msg, tipo) { setToast({ msg, tipo }); setTimeout(() => setToast(null), 3500) }

  const { movimientos, ventas, caja } = data
  const ventasValidas = ventas.filter(v => !v.anulada)
  const ventasAnuladasIds = new Set(ventas.filter(v => v.anulada).map(v => v.id))
  const totalVentas  = ventasValidas.reduce((a,v) => a+(v.total||0), 0)
  const cantVentas   = ventasValidas.length
  const ingresosCaja = caja.filter(m => m.tipo==='ingreso'||m.tipo==='apertura').reduce((a,m) => a+m.monto, 0)
  const egresosCaja  = caja.filter(m => m.tipo==='egreso').reduce((a,m) => a+m.monto, 0)
  const saldoCaja    = ingresosCaja - egresosCaja

  // Top productos vendidos (solo movimientos de venta, excluyendo ventas anuladas)
  const movimientosValidos = movimientos.filter(m => m.tipo==='venta' && !ventasAnuladasIds.has(m.ventaId))
  const topProductos = Object.values(
    movimientosValidos.reduce((acc, m) => {
      if (!acc[m.productoId]) acc[m.productoId] = { nombre: m.productoNombre, cantidad:0, unidad: m.unidad }
      acc[m.productoId].cantidad += m.cantidad
      return acc
    }, {})
  ).sort((a,b) => b.cantidad - a.cantidad).slice(0,10)

  // Auditoría — mermas y bajas de productos (posible fuente de robo/pérdidas encubiertas)
  const movimientosAuditoria = movimientos
    .filter(m => m.tipo === 'merma' || m.tipo === 'baja_producto')
    .slice().reverse()

  // Ranking por empleado — si una misma persona concentra muchas más mermas
  // o bajas que el resto, es una señal de alerta a investigar.
  const rankingAuditoria = Object.values(
    movimientosAuditoria.reduce((acc, m) => {
      const key = m.registradoPor || 'Sin identificar'
      if (!acc[key]) acc[key] = { registradoPor: key, mermas: 0, bajas: 0, total: 0 }
      if (m.tipo === 'merma') acc[key].mermas++
      else acc[key].bajas++
      acc[key].total++
      return acc
    }, {})
  ).sort((a,b) => b.total - a.total)

  // Margen bruto estimado — ingresos de ventas vs. costo cargado en productos.
  // Es una estimación: usa el costo actual, no el histórico al momento de la venta.
  let ingresosPorVenta = 0, costoPorVenta = 0
  if (isAdmin) {
    ventasValidas.forEach(v => {
      (v.items || []).forEach(i => {
        ingresosPorVenta += (i.precio || 0) * i.cantidad
        if (i.esReceta) {
          (i.ingredientes || []).forEach(ing => {
            costoPorVenta += (productosMap[ing.productoId]?.costo || 0) * ing.cantidad * i.cantidad
          })
        } else {
          costoPorVenta += (productosMap[i.id]?.costo || 0) * i.cantidad
        }
      })
    })
  }
  const margenBruto = ingresosPorVenta - costoPorVenta
  const margenPct = ingresosPorVenta > 0 ? (margenBruto / ingresosPorVenta * 100) : 0
  const hayCostosCargados = Object.values(productosMap).some(p => p.costo > 0)

  async function descargarBackup() {
    setBackupCargando(true)
    try {
      const [productosLista, clientesLista] = await Promise.all([getProductos(false), getClientes(false)])
      exportarCSV(productosLista, [
        { label:'Código', get: p => p.codigo||'' },
        { label:'Nombre', get: p => p.nombre||'' },
        { label:'Categoría', get: p => p.categoria||'' },
        { label:'Unidad', get: p => p.unidad||'' },
        { label:'Precio', get: p => p.precio||0 },
        { label:'Costo', get: p => p.costo||0 },
        { label:'Stock', get: p => p.stock||0 },
        { label:'Stock mínimo', get: p => p.stockMinimo||0 },
        { label:'Vencimiento', get: p => p.fechaVencimiento||'' },
      ], 'backup_productos.csv')
      exportarCSV(clientesLista, [
        { label:'Nombre', get: c => c.nombre||'' },
        { label:'Teléfono', get: c => c.telefono||'' },
        { label:'Saldo', get: c => c.saldo||0 },
      ], 'backup_clientes.csv')
      exportarCSV(ventas, [
        { label:'Fecha', get: v => formatFecha(v.fecha) },
        { label:'Items', get: v => v.items?.length||0 },
        { label:'Total', get: v => v.total ?? 0 },
        { label:'Medio de pago', get: v => v.medioPago || 'Efectivo' },
        { label:'Registrado por', get: v => v.registradoPor || '' },
        { label:'Anulada', get: v => v.anulada ? 'SI' : 'NO' },
      ], `backup_ventas_${labelPeriodo}.csv`)
      exportarCSV(movimientosAuditoria, [
        { label:'Fecha', get: m => formatFecha(m.fecha) },
        { label:'Tipo', get: m => m.tipo },
        { label:'Producto', get: m => m.productoNombre || '' },
        { label:'Motivo', get: m => m.motivo || '' },
        { label:'Registrado por', get: m => m.registradoPor || '' },
      ], `backup_auditoria_${labelPeriodo}.csv`)
      mostrarToast('✅ Backup descargado (4 archivos CSV)', 'success')
    } catch (e) {
      console.error('backup error:', e)
      mostrarToast('❌ Error al generar el backup', 'danger')
    }
    setBackupCargando(false)
  }

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
      <div className="page-header" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 className="page-title">Reportes</h1>
          <p className="page-subtitle">{labelPeriodo}</p>
        </div>
        {isAdmin && (
          <button className="btn btn-outline" onClick={descargarBackup} disabled={backupCargando}>
            {backupCargando ? 'Generando...' : '📦 Backup completo (CSV)'}
          </button>
        )}
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
              ...(isAdmin && hayCostosCargados ? [
                { label:'Margen bruto estimado', val:`$${margenBruto.toLocaleString('es-AR',{minimumFractionDigits:2})} (${margenPct.toFixed(0)}%)`, color: margenBruto>=0?'var(--primary)':'var(--danger)' },
              ] : []),
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
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <h3 style={{ fontSize:'1rem', fontWeight:700 }}>🧾 Ventas del período</h3>
                {ventas.length > 0 && (
                  <button className="btn btn-outline btn-sm" onClick={() => exportarCSV(
                    ventas.slice().reverse(),
                    [
                      { label:'Fecha', get: v => formatFecha(v.fecha) },
                      { label:'Items', get: v => v.items?.length||0 },
                      { label:'Subtotal', get: v => v.subtotal ?? v.total ?? 0 },
                      { label:'Descuento', get: v => v.descuento ?? 0 },
                      { label:'Total', get: v => v.total ?? 0 },
                      { label:'Medio de pago', get: v => v.medioPago || 'Efectivo' },
                      { label:'Cliente', get: v => v.clienteNombre || '' },
                      { label:'Registrado por', get: v => v.registradoPor || '' },
                      { label:'Anulada', get: v => v.anulada ? 'SI' : 'NO' },
                      { label:'Motivo anulación', get: v => v.motivoAnulacion || '' },
                    ],
                    `ventas_${labelPeriodo}.csv`
                  )}>⬇️ CSV</button>
                )}
              </div>
              {ventas.length === 0
                ? <p style={{ color:'var(--muted)', fontSize:'0.85rem' }}>Sin ventas en este período</p>
                : <div style={{ maxHeight:280, overflowY:'auto' }}>
                    {ventas.slice().reverse().slice(0,20).map(v => (
                      <div key={v.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:'1px solid var(--border)', fontSize:'0.82rem', opacity: v.anulada ? 0.55 : 1 }}>
                        <div>
                          <div style={{ fontSize:'0.76rem', color:'var(--muted)' }}>{formatFecha(v.fecha)}</div>
                          <div style={{ fontSize:'0.8rem', textDecoration: v.anulada ? 'line-through' : 'none' }}>
                            {v.items?.length||0} ítem{v.items?.length!==1?'s':''}
                            {' '}<span className="badge" style={{ marginLeft:4, fontSize:'0.65rem' }}>{v.medioPago || 'Efectivo'}</span>
                            {v.anulada && <span className="badge badge-danger" style={{ marginLeft:4, fontSize:'0.65rem' }}>ANULADA</span>}
                          </div>
                          {v.anulada && v.motivoAnulacion && (
                            <div style={{ fontSize:'0.7rem', color:'var(--danger)' }}>Motivo: {v.motivoAnulacion}</div>
                          )}
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ fontWeight:800, color:'var(--primary)', textDecoration: v.anulada ? 'line-through' : 'none' }}>${(v.total||0).toLocaleString('es-AR',{minimumFractionDigits:2})}</div>
                          {isAdmin && !v.anulada && (
                            <button className="btn btn-sm btn-outline" style={{ color:'var(--danger)', borderColor:'var(--danger)' }} onClick={() => handleAnular(v)}>Anular</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
              }
            </div>
          </div>

          {/* Movimientos de stock — solo ventas */}
          <div className="card" style={{ padding:0, marginBottom: isAdmin ? 20 : 0 }}>
            <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', fontWeight:700, fontSize:'0.95rem' }}>
              📋 Movimientos de stock (ventas)
            </div>
            <div className="table-wrap">
              {movimientosValidos.length === 0
                ? <div className="empty-state"><div className="empty-icon">📋</div><p>Sin movimientos en este período</p></div>
                : <table>
                    <thead><tr><th>Fecha</th><th>Producto</th><th>Cantidad vendida</th></tr></thead>
                    <tbody>
                      {movimientosValidos.slice().reverse().map(m => (
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

          {/* Auditoría — mermas y bajas de productos (solo admin) */}
          {isAdmin && (
            <div className="card" style={{ padding:0 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 20px', borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontWeight:700, fontSize:'0.95rem' }}>🕵️ Auditoría — mermas y bajas de stock</span>
                {movimientosAuditoria.length > 0 && (
                  <button className="btn btn-outline btn-sm" onClick={() => exportarCSV(
                    movimientosAuditoria,
                    [
                      { label:'Fecha', get: m => formatFecha(m.fecha) },
                      { label:'Tipo', get: m => m.tipo === 'baja_producto' ? 'Baja de producto' : 'Merma' },
                      { label:'Producto', get: m => m.productoNombre || '' },
                      { label:'Cantidad', get: m => m.tipo === 'baja_producto' ? m.stockFinal : m.cantidad },
                      { label:'Unidad', get: m => m.unidad || '' },
                      { label:'Motivo', get: m => m.motivo || '' },
                      { label:'Registrado por', get: m => m.registradoPor || '' },
                    ],
                    `auditoria_${labelPeriodo}.csv`
                  )}>⬇️ CSV</button>
                )}
              </div>
              {rankingAuditoria.length > 0 && (
                <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)' }}>
                  <p style={{ fontSize:'0.78rem', color:'var(--muted)', fontWeight:600, marginBottom:8, textTransform:'uppercase', letterSpacing:'0.04em' }}>
                    Por empleado — si alguien concentra muchas más mermas/bajas que el resto, conviene revisar
                  </p>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {rankingAuditoria.map(r => (
                      <div key={r.registradoPor} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', borderRadius:9, background:'var(--bg)', border: r.total >= 3 && r.total === rankingAuditoria[0].total ? '1.5px solid var(--danger)' : '1px solid var(--border)' }}>
                        <span style={{ fontWeight:700, fontSize:'0.85rem' }}>{r.registradoPor}</span>
                        <span style={{ fontSize:'0.75rem', color:'var(--muted)' }}>{r.mermas} merma{r.mermas!==1?'s':''} · {r.bajas} baja{r.bajas!==1?'s':''}</span>
                        <span className="badge badge-warning" style={{ fontSize:'0.7rem' }}>{r.total} total</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="table-wrap">
                {movimientosAuditoria.length === 0
                  ? <div className="empty-state"><div className="empty-icon">🕵️</div><p>Sin mermas ni bajas en este período</p></div>
                  : <table>
                      <thead><tr><th>Fecha</th><th>Tipo</th><th>Producto</th><th>Cantidad</th><th>Motivo</th><th>Registrado por</th></tr></thead>
                      <tbody>
                        {movimientosAuditoria.map(m => (
                          <tr key={m.id}>
                            <td style={{ color:'var(--muted)', fontSize:'0.8rem' }}>{formatFecha(m.fecha)}</td>
                            <td>
                              <span className={`badge ${m.tipo==='baja_producto'?'badge-danger':'badge-warning'}`}>
                                {m.tipo==='baja_producto' ? 'Baja de producto' : 'Merma'}
                              </span>
                            </td>
                            <td style={{ fontWeight:600 }}>{m.productoNombre}</td>
                            <td style={{ fontWeight:700, color:'var(--danger)' }}>
                              -{m.tipo==='baja_producto' ? m.stockFinal : m.cantidad} {m.unidad==='kg'?'kg':'u.'}
                            </td>
                            <td style={{ fontSize:'0.82rem' }}>{m.motivo || '—'}</td>
                            <td style={{ fontSize:'0.76rem', color:'var(--muted)' }}>{m.registradoPor || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                }
              </div>
            </div>
          )}
        </>
      )}
      {toast && <div className={`toast toast-${toast.tipo}`}>{toast.msg}</div>}
    </div>
  )
}
