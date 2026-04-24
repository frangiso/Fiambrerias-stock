import { useState, useEffect } from 'react'
import { collection, getDocs, addDoc, query, where, orderBy, Timestamp, writeBatch, doc } from 'firebase/firestore'
import { db } from '../firebase/config.js'

const TIPOS_INGRESO = ['Venta mostrador','Venta a crédito','Otro ingreso']
const TIPOS_EGRESO  = ['Compra mercadería','Gasto operativo','Retiro de caja','Pago proveedor','Otro egreso']

function hoyInicio() {
  const d = new Date(); d.setHours(0,0,0,0); return Timestamp.fromDate(d)
}
function hoyFin() {
  const d = new Date(); d.setHours(23,59,59,999); return Timestamp.fromDate(d)
}

export default function Caja() {
  const [movimientos, setMovimientos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // 'ingreso' | 'egreso' | 'apertura'
  const [form, setForm] = useState({ concepto:'', monto:'', tipo:'' })
  const [toast, setToast] = useState(null)
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [cajaAbierta, setCajaAbierta] = useState(false)
  const [cajaCerrada, setCajaCerrada] = useState(false)
  const [saldoApertura, setSaldoApertura] = useState(0)
  const [montoApertura, setMontoApertura] = useState('')

  useEffect(() => { cargar() }, [fecha])

  async function cargar() {
    setLoading(true)
    const d = new Date(fecha + 'T00:00:00')
    const dFin = new Date(fecha + 'T23:59:59')
    const snap = await getDocs(query(
      collection(db, 'caja'),
      where('fecha', '>=', Timestamp.fromDate(d)),
      where('fecha', '<=', Timestamp.fromDate(dFin))
    ))
    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    lista.sort((a,b) => a.fecha?.seconds - b.fecha?.seconds)
    setMovimientos(lista)
    const apertura = lista.find(m => m.tipo === 'apertura')
    setCajaAbierta(!!apertura)
    setCajaCerrada(!!(lista.find(m => m.tipo === 'cierre')))
    setSaldoApertura(apertura?.monto || 0)
    setLoading(false)
  }

  async function abrirCaja() {
    const monto = parseFloat(montoApertura) || 0
    await addDoc(collection(db, 'caja'), {
      concepto: 'Apertura de caja',
      monto,
      tipo: 'apertura',
      fecha: Timestamp.now()
    })
    mostrarToast('✅ Caja abierta', 'success')
    setModal(null)
    setMontoApertura('')
    cargar()
  }

  async function cerrarCaja() {
    if (!confirm('¿Cerrar la caja del día? Podrás ver los movimientos pero no agregar más.')) return
    await addDoc(collection(db, 'caja'), {
      concepto: `Cierre de caja — Saldo: $${saldo.toLocaleString('es-AR')}`,
      monto: saldo,
      tipo: 'cierre',
      fecha: Timestamp.now()
    })
    mostrarToast('🔒 Caja cerrada', 'success')
    cargar()
  }

  async function guardarMovimiento() {
    const monto = parseFloat(form.monto)
    if (!monto || monto <= 0) { mostrarToast('Ingresá un monto válido', 'danger'); return }
    if (!form.concepto.trim()) { mostrarToast('Ingresá un concepto', 'danger'); return }
    await addDoc(collection(db, 'caja'), {
      concepto: form.concepto.trim(),
      monto,
      tipo: modal,
      subtipo: form.tipo,
      fecha: Timestamp.now()
    })
    mostrarToast(`✅ ${modal === 'ingreso' ? 'Ingreso' : 'Egreso'} registrado`, 'success')
    setModal(null)
    setForm({ concepto:'', monto:'', tipo:'' })
    cargar()
  }

  function mostrarToast(msg, tipo) { setToast({ msg, tipo }); setTimeout(() => setToast(null), 3000) }

  // Calcular totales
  const ingresos = movimientos.filter(m => m.tipo === 'ingreso' || m.tipo === 'apertura').reduce((a,m) => a + m.monto, 0)
  const egresos  = movimientos.filter(m => m.tipo === 'egreso').reduce((a,m) => a + m.monto, 0)
  const saldo    = ingresos - egresos

  function formatFecha(ts) {
    if (!ts) return '—'
    return ts.toDate().toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' })
  }

  return (
    <div>
      <div className="page-header" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 className="page-title">Caja</h1>
          <p className="page-subtitle">Control de entradas y salidas</p>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            style={{ padding:'8px 12px', border:'1px solid var(--border)', borderRadius:9, fontSize:'0.88rem' }} />
          {!cajaAbierta && fecha === new Date().toISOString().split('T')[0] && (
            <button className="btn btn-primary" onClick={() => setModal('apertura')}>🔓 Abrir caja</button>
          )}
          {cajaAbierta && !cajaCerrada && (
            <>
              <button className="btn btn-primary" onClick={() => { setForm({ concepto:'', monto:'', tipo: TIPOS_INGRESO[0] }); setModal('ingreso') }}>+ Ingreso</button>
              <button className="btn btn-danger" onClick={() => { setForm({ concepto:'', monto:'', tipo: TIPOS_EGRESO[0] }); setModal('egreso') }}>− Egreso</button>
              <button className="btn btn-outline" onClick={cerrarCaja}>🔒 Cerrar caja</button>
            </>
          )}
          {cajaCerrada && (
            <span style={{ fontSize:'0.85rem', color:'var(--muted)', background:'var(--bg)', padding:'8px 14px', borderRadius:8 }}>🔒 Caja cerrada</span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:24 }}>
        <div className="card" style={{ borderTop:'3px solid var(--primary)' }}>
          <div style={{ fontSize:'1.6rem', fontWeight:800, color:'var(--primary)' }}>${ingresos.toLocaleString('es-AR', { minimumFractionDigits:2 })}</div>
          <div style={{ fontSize:'0.75rem', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:4 }}>Total ingresos</div>
        </div>
        <div className="card" style={{ borderTop:'3px solid var(--danger)' }}>
          <div style={{ fontSize:'1.6rem', fontWeight:800, color:'var(--danger)' }}>${egresos.toLocaleString('es-AR', { minimumFractionDigits:2 })}</div>
          <div style={{ fontSize:'0.75rem', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:4 }}>Total egresos</div>
        </div>
        <div className="card" style={{ borderTop:`3px solid ${saldo >= 0 ? 'var(--primary)' : 'var(--danger)'}` }}>
          <div style={{ fontSize:'1.6rem', fontWeight:800, color: saldo >= 0 ? 'var(--primary)' : 'var(--danger)' }}>${saldo.toLocaleString('es-AR', { minimumFractionDigits:2 })}</div>
          <div style={{ fontSize:'0.75rem', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:4 }}>Saldo del día</div>
        </div>
      </div>

      {/* Tabla movimientos */}
      <div className="card" style={{ padding:0 }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', fontWeight:700, fontSize:'0.95rem' }}>
          Movimientos — {new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday:'long', day:'2-digit', month:'long' })}
        </div>
        {loading ? <div className="loading">Cargando...</div>
        : movimientos.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💰</div>
            <p>{fecha === new Date().toISOString().split('T')[0] ? 'Abrí la caja para empezar a registrar movimientos.' : 'Sin movimientos este día.'}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Hora</th><th>Concepto</th><th>Subtipo</th><th>Ingreso</th><th>Egreso</th></tr>
              </thead>
              <tbody>
                {movimientos.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontFamily:'monospace', fontSize:'0.82rem', color:'var(--muted)' }}>{formatFecha(m.fecha)}</td>
                    <td style={{ fontWeight:600 }}>{m.concepto}</td>
                    <td><span className="badge badge-ok" style={{ fontSize:'0.68rem' }}>{m.subtipo || m.tipo}</span></td>
                    <td style={{ fontWeight:700, color:'var(--primary)' }}>
                      {(m.tipo === 'ingreso' || m.tipo === 'apertura') ? '$' + m.monto.toLocaleString('es-AR', { minimumFractionDigits:2 }) : '—'}
                    </td>
                    <td style={{ fontWeight:700, color:'var(--danger)' }}>
                      {m.tipo === 'egreso' ? '$' + m.monto.toLocaleString('es-AR', { minimumFractionDigits:2 }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal apertura */}
      {modal === 'apertura' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">🔓 Apertura de caja</h3>
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

      {/* Modal ingreso/egreso */}
      {(modal === 'ingreso' || modal === 'egreso') && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{modal === 'ingreso' ? '💰 Nuevo ingreso' : '💸 Nuevo egreso'}</h3>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="form-group">
              <label>Tipo</label>
              <select className="form-control" value={form.tipo} onChange={e => setForm(f => ({...f, tipo: e.target.value}))}>
                {(modal === 'ingreso' ? TIPOS_INGRESO : TIPOS_EGRESO).map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Concepto / Detalle</label>
              <input className="form-control" value={form.concepto}
                onChange={e => setForm(f => ({...f, concepto: e.target.value}))}
                placeholder="Descripción del movimiento" />
            </div>
            <div className="form-group">
              <label>Monto ($)</label>
              <input className="form-control" type="number" min="0" step="0.01"
                value={form.monto} onChange={e => setForm(f => ({...f, monto: e.target.value}))}
                placeholder="0" style={{ fontSize:'1.2rem', textAlign:'center' }} autoFocus />
            </div>
            <div style={{ display:'flex', gap:10, marginTop:8 }}>
              <button className="btn btn-outline" style={{flex:1}} onClick={() => setModal(null)}>Cancelar</button>
              <button className={`btn ${modal === 'ingreso' ? 'btn-primary' : 'btn-danger'}`} style={{flex:1}} onClick={guardarMovimiento}>
                Registrar {modal === 'ingreso' ? 'ingreso' : 'egreso'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast toast-${toast.tipo}`}>{toast.msg}</div>}
    </div>
  )
}
