import { useState, useEffect } from 'react'
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { invalidateCache } from '../firebase/cache.js'

const COLORES = ['#2A5C45','#C9736A','#C9A84C','#4A7AB5','#8B5CF6','#EC4899','#F97316','#64748B']

export default function Rubros() {
  const [rubros, setRubros] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ nombre: '', color: COLORES[0], icono: '📦' })
  const [editId, setEditId] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const snap = await getDocs(collection(db, 'rubros'))
    setRubros(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    setLoading(false)
  }

  function abrirNuevo() { setForm({ nombre: '', color: COLORES[0], icono: '📦' }); setEditId(null); setModal(true) }
  function abrirEditar(r) { setForm({ nombre: r.nombre, color: r.color || COLORES[0], icono: r.icono || '📦' }); setEditId(r.id); setModal(true) }

  async function guardar() {
    if (!form.nombre.trim()) { mostrarToast('El nombre es obligatorio', 'danger'); return }
    const data = { nombre: form.nombre.trim(), color: form.color, icono: form.icono }
    if (editId) await updateDoc(doc(db, 'rubros', editId), data)
    else await addDoc(collection(db, 'rubros'), data)
    invalidateCache('rubros')
    mostrarToast('✅ Rubro guardado', 'success')
    setModal(false)
    cargar()
  }

  async function eliminar(r) {
    if (!confirm(`¿Eliminar rubro "${r.nombre}"? Los productos de este rubro quedarán sin categoría.`)) return
    await deleteDoc(doc(db, 'rubros', r.id))
    invalidateCache('rubros')
    mostrarToast('Rubro eliminado', 'warning')
    cargar()
  }

  function mostrarToast(msg, tipo) { setToast({ msg, tipo }); setTimeout(() => setToast(null), 3000) }

  const ICONOS = ['📦','🥩','🧀','🍖','🥤','🛒','🥛','🍞','🧹','❄️','🐟','🥚','🌽','🫙','🍕']

  return (
    <div>
      <div className="page-header" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <h1 className="page-title">Rubros / Categorías</h1>
          <p className="page-subtitle">Gestioná las categorías de productos</p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}>+ Nuevo rubro</button>
      </div>

      {loading ? <div className="loading">Cargando...</div>
      : rubros.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏷️</div>
          <p>No hay rubros todavía.<br />Creá los rubros para organizar tus productos.</p>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:14 }}>
          {rubros.map(r => (
            <div key={r.id} className="card" style={{ borderLeft:`4px solid ${r.color || '#2A5C45'}`, display:'flex', alignItems:'center', gap:14 }}>
              <span style={{ fontSize:'1.8rem' }}>{r.icono || '📦'}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:'0.95rem' }}>{r.nombre}</div>
                <div style={{ fontSize:'0.72rem', color:'var(--muted)', marginTop:2 }}>{r.color}</div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <button className="btn btn-sm btn-outline" onClick={() => abrirEditar(r)}>✏️</button>
                <button className="btn btn-sm btn-danger" onClick={() => eliminar(r)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editId ? 'Editar rubro' : 'Nuevo rubro'}</h3>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>
            <div className="form-group">
              <label>Nombre *</label>
              <input className="form-control" value={form.nombre} onChange={e => setForm(f => ({...f, nombre: e.target.value}))} placeholder="Ej: Fiambres, Quesos, Bebidas..." />
            </div>
            <div className="form-group">
              <label>Ícono</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {ICONOS.map(ic => (
                  <button key={ic} onClick={() => setForm(f => ({...f, icono: ic}))}
                    style={{ width:40, height:40, borderRadius:8, border: form.icono === ic ? '2px solid #2A5C45' : '1px solid #E2D9C8', background: form.icono === ic ? '#D4EAE0' : 'white', fontSize:'1.3rem', cursor:'pointer' }}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Color</label>
              <div style={{ display:'flex', gap:8 }}>
                {COLORES.map(c => (
                  <button key={c} onClick={() => setForm(f => ({...f, color: c}))}
                    style={{ width:32, height:32, borderRadius:'50%', background:c, border: form.color === c ? '3px solid #1A1A18' : '2px solid white', cursor:'pointer', boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }} />
                ))}
              </div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:8 }}>
              <button className="btn btn-outline" style={{flex:1}} onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{flex:1}} onClick={guardar}>Guardar</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className={`toast toast-${toast.tipo}`}>{toast.msg}</div>}
    </div>
  )
}
