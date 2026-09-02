import { useState, useEffect } from 'react'
import { collection, addDoc, doc, updateDoc, deleteDoc, increment, Timestamp } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { getClientes } from '../firebase/db.js'
import { invalidateCache } from '../firebase/cache.js'

const EMPTY = { nombre: '', telefono: '' }

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [modalPago, setModalPago] = useState(null)
  const [montoPago, setMontoPago] = useState('')
  const [toast, setToast] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar(force = false) {
    setLoading(true)
    setClientes(await getClientes(force))
    setLoading(false)
  }

  function abrirNuevo() { setForm(EMPTY); setEditId(null); setModal(true) }
  function abrirEditar(c) { setForm({ nombre: c.nombre || '', telefono: c.telefono || '' }); setEditId(c.id); setModal(true) }

  async function guardar() {
    if (!form.nombre.trim()) { mostrarToast('El nombre es obligatorio', 'danger'); return }
    setGuardando(true)
    try {
      if (editId) {
        await updateDoc(doc(db, 'clientes', editId), { nombre: form.nombre.trim(), telefono: form.telefono.trim() })
        mostrarToast('✅ Cliente actualizado', 'success')
      } else {
        await addDoc(collection(db, 'clientes'), { nombre: form.nombre.trim(), telefono: form.telefono.trim(), saldo: 0, fecha: Timestamp.now() })
        mostrarToast('✅ Cliente creado', 'success')
      }
      invalidateCache('clientes')
      setModal(false); cargar(true)
    } catch { mostrarToast('❌ Error al guardar', 'danger') }
    setGuardando(false)
  }

  async function eliminar(c) {
    if (c.saldo > 0) { mostrarToast('No se puede borrar: tiene saldo pendiente', 'danger'); return }
    if (!confirm(`¿Eliminar cliente "${c.nombre}"?`)) return
    await deleteDoc(doc(db, 'clientes', c.id))
    invalidateCache('clientes')
    mostrarToast('Cliente eliminado', 'warning'); cargar(true)
  }

  async function registrarPago() {
    const monto = parseFloat(String(montoPago).replace(',', '.'))
    if (!monto || monto <= 0) { mostrarToast('Ingresá un monto válido', 'danger'); return }
    setGuardando(true)
    try {
      await updateDoc(doc(db, 'clientes', modalPago.id), { saldo: increment(-monto) })
      await addDoc(collection(db, 'caja'), {
        concepto: `Cobro cuenta corriente — ${modalPago.nombre}`, monto, tipo: 'ingreso',
        subtipo: 'Cobro cuenta corriente', clienteId: modalPago.id, fecha: Timestamp.now()
      })
      invalidateCache('clientes', 'caja', 'reportes')
      setModalPago(null); setMontoPago('')
      cargar(true)
      mostrarToast('✅ Pago registrado', 'success')
    } catch { mostrarToast('❌ Error al registrar el pago', 'danger') }
    setGuardando(false)
  }

  function mostrarToast(msg, tipo) { setToast({ msg, tipo }); setTimeout(() => setToast(null), 3000) }

  const filtrados = clientes.filter(c => !busqueda || c.nombre?.toLowerCase().includes(busqueda.toLowerCase()))
  const deudaTotal = clientes.reduce((a, c) => a + (c.saldo || 0), 0)

  return (
    <div>
      <div className="page-header" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 className="page-title">Clientes / Cuenta corriente</h1>
          <p className="page-subtitle">Gestioná el fiado — deuda total: <strong>${deudaTotal.toLocaleString('es-AR',{minimumFractionDigits:2})}</strong></p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}>+ Nuevo cliente</button>
      </div>

      <input className="form-control" style={{ maxWidth:280, marginBottom:16 }} placeholder="Buscar cliente..."
        value={busqueda} onChange={e => setBusqueda(e.target.value)} />

      <div className="card" style={{ padding:0 }}>
        <div className="table-wrap">
          {loading ? <div className="loading">Cargando...</div>
          : filtrados.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">🧾</div><p>No hay clientes cargados.</p></div>
          ) : (
            <table>
              <thead><tr><th>Nombre</th><th>Teléfono</th><th>Saldo (debe)</th><th></th></tr></thead>
              <tbody>
                {filtrados.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight:600 }}>{c.nombre}</td>
                    <td style={{ color:'var(--muted)' }}>{c.telefono || '—'}</td>
                    <td style={{ fontWeight:800, color: c.saldo > 0 ? 'var(--danger)' : 'var(--primary)' }}>
                      ${(c.saldo || 0).toLocaleString('es-AR',{minimumFractionDigits:2})}
                    </td>
                    <td>
                      <div style={{ display:'flex', gap:8 }}>
                        {c.saldo > 0 && (
                          <button className="btn btn-sm btn-primary" onClick={() => { setModalPago(c); setMontoPago('') }}>💵 Registrar pago</button>
                        )}
                        <button className="btn btn-sm btn-outline" onClick={() => abrirEditar(c)}>Editar</button>
                        <button className="btn btn-sm btn-danger" onClick={() => eliminar(c)}>Borrar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editId ? 'Editar cliente' : 'Nuevo cliente'}</h3>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>
            <div className="form-group">
              <label>Nombre *</label>
              <input className="form-control" value={form.nombre} onChange={e => setForm(f => ({...f, nombre: e.target.value}))} placeholder="Ej: Juan Pérez" autoFocus />
            </div>
            <div className="form-group">
              <label>Teléfono</label>
              <input className="form-control" value={form.telefono} onChange={e => setForm(f => ({...f, telefono: e.target.value}))} placeholder="Opcional" />
            </div>
            <div style={{ display:'flex', gap:10, marginTop:8 }}>
              <button className="btn btn-outline" style={{flex:1}} onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{flex:1}} onClick={guardar} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {modalPago && (
        <div className="modal-overlay" onClick={() => setModalPago(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">💵 Registrar pago — {modalPago.nombre}</h3>
              <button className="modal-close" onClick={() => setModalPago(null)}>✕</button>
            </div>
            <p style={{ fontSize:'0.85rem', color:'var(--muted)', marginBottom:16 }}>
              Debe: <strong>${(modalPago.saldo||0).toLocaleString('es-AR',{minimumFractionDigits:2})}</strong>
            </p>
            <div className="form-group">
              <label>Monto a cobrar ($)</label>
              <input className="form-control" type="number" min="0" step="0.01" value={montoPago}
                onChange={e => setMontoPago(e.target.value)} onKeyDown={e => e.key==='Enter' && registrarPago()}
                style={{ fontSize:'1.2rem', textAlign:'center' }} autoFocus />
            </div>
            <div style={{ display:'flex', gap:10, marginTop:8 }}>
              <button className="btn btn-outline" style={{flex:1}} onClick={() => setModalPago(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{flex:1}} onClick={registrarPago} disabled={guardando}>Confirmar cobro</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast toast-${toast.tipo}`}>{toast.msg}</div>}
    </div>
  )
}
