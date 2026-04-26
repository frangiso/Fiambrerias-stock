import { useState, useEffect } from 'react'
import { collection, addDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { getCajaDelDia } from '../firebase/db.js'
import { invalidateCache, addCacheItem } from '../firebase/cache.js'

const TIPOS_INGRESO = ['Venta mostrador','Venta a crédito','Otro ingreso']
const TIPOS_EGRESO  = ['Compra mercadería','Gasto operativo','Retiro de caja','Pago proveedor','Otro egreso']

export default function Caja() {
  const [movimientos, setMovimientos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ concepto:'', monto:'', tipo:'' })
  const [toast, setToast] = useState(null)
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [cajaAbierta, setCajaAbierta] = useState(false)
  const [cajaCerrada, setCajaCerrada] = useState(false)
  const [montoApertura, setMontoApertura] = useState('')

  useEffect(() => { cargar() }, [fecha])

  async function cargar(force = false) {
    setLoading(true)
    const lista = await getCajaDelDia(fecha, force)
    setMovimientos(lista)
    const apertura = lista.find(m => m.tipo === 'apertura')
    setCajaAbierta(!!apertura)
    const ultimo = lista[lista.length - 1]
    setCajaCerrada(!!(ultimo && ultimo.tipo === 'cierre'))
    setLoading(false)
  }

  async function abrirCaja() {
    const monto = parseFloat(montoApertura) || 0
    const nuevo = { concepto:'Apertura de caja', monto, tipo:'apertura', fecha: Timestamp.now() }
    await addDoc(collection(db, 'caja'), nuevo)
    invalidateCache(`caja_${fecha}`)
    mostrarToast('✅ Caja abierta', 'success')
    setModal(null); setMontoApertura('')
    cargar(true)
  }

  async function cerrarCaja() {
    if (!confirm('¿Cerrar la caja? Podés reabrirla cuando quieras.')) return
    const nuevo = { concepto:`Cierre de caja — Saldo: $${saldo.toLocaleString('es-AR')}`, monto: saldo, tipo:'cierre', fecha: Timestamp.now() }
    await addDoc(collection(db, 'caja'), nuevo)
    invalidateCache(`caja_${fecha}`)
    mostrarToast('🔒 Caja cerrada', 'success')
    cargar(true)
  }

  async function guardarMovimiento() {
    const monto = parseFloat(form.monto)
    if (!monto || monto <= 0) { mostrarToast('Ingresá un monto válido', 'danger'); return }
    if (!form.concepto.trim()) { mostrarToast('Ingresá un concepto', 'danger'); return }
    const nuevo = { concepto: form.concepto.trim(), monto, tipo: modal, subtipo: form.tipo, fecha: Timestamp.now() }
    await addDoc(collection(db, 'caja'), nuevo)
    invalidateCache(`caja_${fecha}`, 'reportes')
    mostrarToast(`✅ ${modal==='ingreso'?'Ingreso':'Egreso'} registrado`, 'success')
    setModal(null); setForm({ concepto:'', monto:'', tipo:'' })
    cargar(true)
  }

  function mostrarToast(msg, tipo) { setToast({ msg, tipo }); setTimeout(() => setToast(null), 3000) }

  const ingresos = movimientos.filter(m => m.tipo==='ingreso'||m.tipo==='apertura').reduce((a,m) => a+m.monto, 0)
  const egresos  = movimientos.filter(m => m.tipo==='egreso').reduce((a,m) => a+m.monto, 0)
  const saldo    = ingresos - egresos

  function formatFecha(ts) {
    if (!ts) return '—'
    return ts.toDate().toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' })
  }

  const hoy = new Date().toISOString().split('T')[0]

  return (
    <div>
      <div className="page-header" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 className="page-title">Caja</h1>
          <p className="page-subtitle">Control de entradas y salidas</p>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            style={{ padding:'8px 12px', border:'1px solid var(--border)', borderRadius:9, fontSize:'0.88rem' }} />
          {(!cajaAbierta || cajaCerrada) && fecha === hoy && (
            <button className="btn btn-primary" onClick={() => setModal('apertura')}>
              🔓 {cajaCerrada ? 'Reabrir caja' : 'Abrir caja'}
            </button>
          )}
          {cajaAbierta && !cajaCerrada && (
            <>
              <button className="btn btn-primary" onClick={() => { setForm({ concepto:'', monto:'', tipo:TIPOS_INGRESO[0] }); setModal('ingreso') }}>+ Ingreso</button>
              <button className="btn btn-danger" onClick={() => { setForm({ concepto:'', monto:'', tipo:TIPOS_EGRESO[0] }); setModal('egreso') }}>− Egreso</button>
              <button className="btn btn-outline" onClick={cerrarCaja}>🔒 Cerrar caja</button>
            </>
          )}
          {cajaCerrada && <span style={{ fontSize:'0.85rem', color:'var(--muted)', background:'var(--bg)', padding:'8px 14px', borderRadius:8 }}>🔒 Caja cerrada</span>}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:24 }}>
        <div className="card" style={{ borderTop:'3px solid var(--primary)' }}>
          <div style={{ fontSize:'1.6rem', fontWeight:800, color:'var(--primary)' }}>${ingresos.toLocaleString('es-AR',{minimumFractionDigits:2})}</div>
          <div style={{ fontSize:'0.75rem', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:4 }}>Total ingresos</div>
        </div>
        <div className="card" style={{ borderTop:'3px solid var(--danger)' }}>
          <div style={{ fontSize:'1.6rem', fontWeight:800, color:'var(--danger)' }}>${egresos.toLocaleString('es-AR',{minimumFractionDigits:2})}</div>
          <div style={{ fontSize:'0.75rem', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:4 }}>Total egresos</div>
        </div>
        <div className="card" style={{ borderTop:`3px solid ${saldo>=0?'var(--primary)':'var(--danger)'}` }}>
          <div style={{ fontSize:'1.6rem', fontWeight:800, color:saldo>=0?'var(--primary)':'var(--danger)' }}>${saldo.toLocaleString('es-AR',{minimumFractionDigits:2})}</div>
          <div style={{ fontSize:'0.75rem', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:4 }}>Saldo del día</div>
        </div>
      </div>

      <div className="card" style={{ padding:0 }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', fontWeight:700, fontSize:'0.95rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span>Movimientos — {new Date(fecha+'T12:00:00').toLocaleDateString('es-AR',{weekday:'long',day:'2-digit',month:'long'})}</span>
          <button className="btn btn-outline btn-sm" onClick={() => cargar(true)}>🔄</button>
        </div>
        {loading ? <div className="loading">Cargando...</div>
        : movimientos.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💰</div>
            <p>{fecha===hoy?'Abrí la caja para empezar a registrar movimientos.':'Sin movimientos este día.'}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Hora</th><th>Concepto</th><th>Tipo</th><th>Ingreso</th><th>Egreso</th></tr></thead>
              <tbody>
                {movimientos.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontFamily:'monospace', fontSize:'0.82rem', color:'var(--muted)' }}>{formatFecha(m.fecha)}</td>
                    <td style={{ fontWeight:600 }}>{m.concepto}</td>
                    <td><span className="badge badge-ok" style={{ fontSize:'0.68rem' }}>{m.subtipo||m.tipo}</span></td>
                    <td style={{ fontWeight:700, color:'var(--primary)' }}>
                      {(m.tipo==='ingreso'||m.tipo==='apertura')?'$'+m.monto.toLocaleString('es-AR',{minimumFractionDigits:2}):'—'}
                    </td>
                    <td style={{ fontWeight:700, color:'var(--danger)' }}>
                      {m.tipo==='egreso'?'$'+m.monto.toLocaleString('es-AR',{minimumFractionDigits:2}):'—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal === 'apertura' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">🔓 {cajaCerrada?'Reapertura':'Apertura'} de caja</h3>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="form-group">
              <label>Saldo inicial (efectivo en caja)</label>
              <input className="form-control" type="number" min="0" value={montoApertura}
                onChange={e => setMontoApertura(e.target.value)}
                placeholder="0" style={{ fontSize:'1.3rem', textAlign:'center' }} autoFocus />
            </div>
            <div style={{ display:'flex', gap:10, marginTop:8 }}>
              <button className="btn btn-outline" style={{flex:1}} onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{flex:1}} onClick={abrirCaja}>Abrir caja</button>
            </div>
          </div>
        </div>
      )}

      {(modal==='ingreso'||modal==='egreso') && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{modal==='ingreso'?'💰 Nuevo ingreso':'💸 Nuevo egreso'}</h3>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="form-group">
              <label>Tipo</label>
              <select className="form-control" value={form.tipo} onChange={e => setForm(f => ({...f, tipo:e.target.value}))}>
                {(modal==='ingreso'?TIPOS_INGRESO:TIPOS_EGRESO).map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Concepto</label>
              <input className="form-control" value={form.concepto}
                onChange={e => setForm(f => ({...f, concepto:e.target.value}))} placeholder="Descripción" />
            </div>
            <div className="form-group">
              <label>Monto ($)</label>
              <input className="form-control" type="number" min="0" step="0.01"
                value={form.monto} onChange={e => setForm(f => ({...f, monto:e.target.value}))}
                placeholder="0" style={{ fontSize:'1.2rem', textAlign:'center' }} autoFocus />
            </div>
            <div style={{ display:'flex', gap:10, marginTop:8 }}>
              <button className="btn btn-outline" style={{flex:1}} onClick={() => setModal(null)}>Cancelar</button>
              <button className={`btn ${modal==='ingreso'?'btn-primary':'btn-danger'}`} style={{flex:1}} onClick={guardarMovimiento}>
                Registrar {modal==='ingreso'?'ingreso':'egreso'}
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className={`toast toast-${toast.tipo}`}>{toast.msg}</div>}
    </div>
  )
}
