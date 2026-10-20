import { useState, useEffect } from 'react'
import { Timestamp } from 'firebase/firestore'
import { getMovimientosAuditoria } from '../firebase/db.js'

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

// Etiquetas legibles para los tipos que vienen de la colección "movimientos"
// (ventas y anulaciones se arman aparte, desde "ventas", para no duplicar
// una fila por cada producto del carrito).
const ICONOS = {
  carga: '📦', merma: '🗑️', baja_producto: '❌', alta_producto: '🆕',
  ajuste_precio: '💲', aumento_masivo: '📈', cambio_rol: '🔑',
  apertura: '🔓', cierre: '🔒', ingreso: '➕', egreso: '➖',
  venta_registrada: '🛒', venta_anulada: '↩️',
}

function detalleMovimiento(m) {
  switch (m.tipo) {
    case 'carga': return `${m.productoNombre} — +${m.cantidad} ${m.unidad==='kg'?'kg':'u.'}`
    case 'merma': return `${m.productoNombre} — -${m.cantidad} ${m.unidad==='kg'?'kg':'u.'}${m.motivo?` · Motivo: ${m.motivo}`:''}`
    case 'baja_producto': return `${m.productoNombre}${m.motivo?` · Motivo: ${m.motivo}`:''}`
    case 'alta_producto': return `${m.productoNombre} — stock inicial ${m.stockInicial} ${m.unidad==='kg'?'kg':'u.'}`
    case 'ajuste_precio': return `${m.productoNombre} — $${m.precioAnterior} → $${m.precioNuevo}`
    case 'aumento_masivo': return `${m.cantidadProductos} productos (${m.rubro}) — ${m.tipoAjuste==='porcentaje'?`+${m.valor}%`:`+$${m.valor}`}`
    case 'cambio_rol': return `${m.usuarioAfectado}: ${m.rolAnterior} → ${m.rolNuevo}`
    default: return ''
  }
}

const TIPOS_RELEVANTES = ['carga','merma','baja_producto','alta_producto','ajuste_precio','aumento_masivo','cambio_rol']

export default function Movimientos() {
  const [data, setData] = useState({ movimientos:[], ventas:[], caja:[] })
  const [loading, setLoading] = useState(true)
  const [tipoPeriodo, setTipoPeriodo] = useState('dia')
  const [fechaDia, setFechaDia] = useState((() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}` })())
  const [fechaMes, setFechaMes] = useState(new Date().toISOString().slice(0,7))
  const [filtroUsuario, setFiltroUsuario] = useState('Todos')

  useEffect(() => { cargar() }, [tipoPeriodo, fechaDia, fechaMes])

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
    const hoy = new Date(); hoy.setHours(23,59,59,999)
    const d7  = new Date(); d7.setDate(d7.getDate()-7); d7.setHours(0,0,0,0)
    return { desde: Timestamp.fromDate(d7), hasta: Timestamp.fromDate(hoy), key: 'semana' }
  }

  // Trae solo los tipos de movimiento relevantes para auditoría (filtrado
  // en Firestore, no en el cliente) — así no se paga una lectura por cada
  // ítem de cada venta del período, que acá no se usa para nada.
  async function cargar(force = false) {
    setLoading(true)
    const { desde, hasta, key } = getRango()
    const result = await getMovimientosAuditoria(desde, hasta, key, force)
    setData(result)
    setLoading(false)
  }

  function formatFecha(ts) {
    if (!ts) return '—'
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})
  }

  const { movimientos, ventas, caja } = data

  // Arma una lista única de "acciones" a partir de las 3 colecciones ya
  // traídas por getReportes — sin ninguna lectura adicional a Firestore.
  const acciones = [
    ...caja.map(m => ({
      fecha: m.fecha, registradoPor: m.registradoPor || 'Sin identificar', tipo: m.tipo,
      detalle: `${m.concepto || ''}${m.monto ? ` — $${m.monto.toLocaleString('es-AR')}` : ''}`,
    })),
    ...movimientos.filter(m => TIPOS_RELEVANTES.includes(m.tipo)).map(m => ({
      fecha: m.fecha, registradoPor: m.registradoPor || 'Sin identificar', tipo: m.tipo,
      detalle: detalleMovimiento(m),
    })),
    ...ventas.map(v => ({
      fecha: v.fecha, registradoPor: v.registradoPor || 'Sin identificar', tipo: 'venta_registrada',
      detalle: `$${(v.total||0).toLocaleString('es-AR')} — ${v.items?.length||0} ítem${v.items?.length!==1?'s':''} · ${v.medioPago||'Efectivo'}`,
    })),
    ...ventas.filter(v => v.anulada).map(v => ({
      fecha: v.anuladaFecha || v.fecha, registradoPor: v.anuladaPor || 'Sin identificar', tipo: 'venta_anulada',
      detalle: `$${(v.total||0).toLocaleString('es-AR')}${v.motivoAnulacion?` · Motivo: ${v.motivoAnulacion}`:''}`,
    })),
  ].sort((a,b) => (b.fecha?.seconds||0) - (a.fecha?.seconds||0))

  const usuarios = [...new Set(acciones.map(a => a.registradoPor))].sort()
  const resumenPorUsuario = usuarios.map(u => ({ usuario: u, total: acciones.filter(a => a.registradoPor===u).length }))
    .sort((a,b) => b.total - a.total)

  const accionesFiltradas = filtroUsuario === 'Todos' ? acciones : acciones.filter(a => a.registradoPor === filtroUsuario)

  const TIPO_LABEL = {
    carga:'Carga de stock', merma:'Merma', baja_producto:'Baja de producto', alta_producto:'Alta de producto',
    ajuste_precio:'Ajuste de precio', aumento_masivo:'Aumento masivo', cambio_rol:'Cambio de rol',
    apertura:'Apertura de caja', cierre:'Cierre de caja', ingreso:'Ingreso de caja', egreso:'Egreso de caja',
    venta_registrada:'Venta registrada', venta_anulada:'Venta anulada',
  }

  const labelPeriodo = tipoPeriodo === 'dia'
    ? new Date(fechaDia+'T12:00:00').toLocaleDateString('es-AR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})
    : tipoPeriodo === 'mes'
    ? new Date(fechaMes+'-15').toLocaleDateString('es-AR',{month:'long',year:'numeric'})
    : 'Última semana'

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Movimientos</h1>
        <p className="page-subtitle">Quién hizo qué en el sistema — ventas, caja, stock, precios y cambios de rol</p>
      </div>

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
        {usuarios.length > 0 && (
          <select className="form-control" style={{ width:'auto', padding:'7px 12px', fontSize:'0.88rem' }}
            value={filtroUsuario} onChange={e => setFiltroUsuario(e.target.value)}>
            <option value="Todos">Todos los usuarios</option>
            {usuarios.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        )}
        <button className="btn btn-outline btn-sm" onClick={() => cargar(true)}>🔄 Actualizar</button>
        {accionesFiltradas.length > 0 && (
          <button className="btn btn-outline btn-sm" onClick={() => exportarCSV(
            accionesFiltradas,
            [
              { label:'Fecha', get: a => formatFecha(a.fecha) },
              { label:'Usuario', get: a => a.registradoPor },
              { label:'Acción', get: a => TIPO_LABEL[a.tipo] || a.tipo },
              { label:'Detalle', get: a => a.detalle },
            ],
            `movimientos_${labelPeriodo}.csv`
          )}>⬇️ CSV</button>
        )}
      </div>

      {loading ? <div className="loading">Cargando...</div> : (
        <>
          {resumenPorUsuario.length > 0 && (
            <div className="card" style={{ marginBottom:20 }}>
              <p style={{ fontSize:'0.75rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>
                Resumen por usuario — {labelPeriodo}
              </p>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {resumenPorUsuario.map(r => (
                  <div key={r.usuario} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', borderRadius:9, background:'var(--bg)', border:'1px solid var(--border)' }}>
                    <span style={{ fontWeight:700, fontSize:'0.85rem' }}>{r.usuario}</span>
                    <span className="badge badge-ok" style={{ fontSize:'0.7rem' }}>{r.total} acción{r.total!==1?'es':''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card" style={{ padding:0 }}>
            <div className="table-wrap">
              {accionesFiltradas.length === 0
                ? <div className="empty-state"><div className="empty-icon">📋</div><p>Sin movimientos en este período</p></div>
                : <table>
                    <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead>
                    <tbody>
                      {accionesFiltradas.map((a,i) => (
                        <tr key={i}>
                          <td style={{ color:'var(--muted)', fontSize:'0.8rem', whiteSpace:'nowrap' }}>{formatFecha(a.fecha)}</td>
                          <td style={{ fontSize:'0.82rem', fontWeight:600 }}>{a.registradoPor}</td>
                          <td><span className="badge badge-warning" style={{ fontSize:'0.72rem' }}>{ICONOS[a.tipo]||''} {TIPO_LABEL[a.tipo] || a.tipo}</span></td>
                          <td style={{ fontSize:'0.82rem' }}>{a.detalle}</td>
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
