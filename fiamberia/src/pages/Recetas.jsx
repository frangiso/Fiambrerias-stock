import { useState, useEffect } from 'react'
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { invalidateCache } from '../firebase/cache.js'

const EMPTY_RECETA = { nombre: '', descripcion: '', precio: '', ingredientes: [] }

export default function Recetas() {
  const [recetas, setRecetas] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY_RECETA)
  const [editId, setEditId] = useState(null)
  const [toast, setToast] = useState(null)
  const [guardando, setGuardando] = useState(false)
  // Para agregar ingrediente
  const [ingBusqueda, setIngBusqueda] = useState('')
  const [ingCantidad, setIngCantidad] = useState('')
  const [ingSugerencias, setIngSugerencias] = useState([])

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [rSnap, pSnap] = await Promise.all([
      getDocs(collection(db, 'recetas')),
      getDocs(collection(db, 'productos'))
    ])
    setRecetas(rSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    setProductos(pSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    setLoading(false)
  }

  // Buscar producto para agregar como ingrediente
  useEffect(() => {
    if (!ingBusqueda.trim()) { setIngSugerencias([]); return }
    const q = ingBusqueda.toLowerCase()
    setIngSugerencias(productos.filter(p =>
      p.nombre?.toLowerCase().includes(q) &&
      !form.ingredientes.find(i => i.productoId === p.id)
    ).slice(0, 5))
  }, [ingBusqueda, productos, form.ingredientes])

  function agregarIngrediente(prod) {
    const cant = parseFloat(ingCantidad.replace(',', '.'))
    if (!cant || cant <= 0) { mostrarToast('Ingresá la cantidad primero', 'danger'); return }
    setForm(f => ({
      ...f,
      ingredientes: [...f.ingredientes, {
        productoId: prod.id,
        productoNombre: prod.nombre,
        cantidad: cant,
        unidad: prod.unidad
      }]
    }))
    setIngBusqueda('')
    setIngCantidad('')
    setIngSugerencias([])
  }

  function quitarIngrediente(prodId) {
    setForm(f => ({ ...f, ingredientes: f.ingredientes.filter(i => i.productoId !== prodId) }))
  }

  function abrirNuevo() { setForm(EMPTY_RECETA); setEditId(null); setModal(true) }

  function abrirEditar(r) {
    setForm({ nombre: r.nombre, descripcion: r.descripcion || '', precio: r.precio || '', ingredientes: r.ingredientes || [] })
    setEditId(r.id); setModal(true)
  }

  async function guardar() {
    if (!form.nombre.trim()) { mostrarToast('El nombre es obligatorio', 'danger'); return }
    if (!form.ingredientes.length) { mostrarToast('Agregá al menos un ingrediente', 'danger'); return }
    setGuardando(true)
    const data = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim(),
      precio: parseFloat(form.precio) || 0,
      ingredientes: form.ingredientes
    }
    try {
      if (editId) { await updateDoc(doc(db, 'recetas', editId), data); mostrarToast('✅ Receta actualizada', 'success') }
      else { await addDoc(collection(db, 'recetas'), data); mostrarToast('✅ Receta creada', 'success') }
      invalidateCache('recetas')
      setModal(false); cargar()
    } catch { mostrarToast('❌ Error al guardar', 'danger') }
    setGuardando(false)
  }

  async function eliminar(r) {
    if (!confirm(`¿Eliminar "${r.nombre}"?`)) return
    await deleteDoc(doc(db, 'recetas', r.id))
    invalidateCache('recetas')
    mostrarToast('Receta eliminada', 'warning'); cargar()
  }

  function mostrarToast(msg, tipo) { setToast({ msg, tipo }); setTimeout(() => setToast(null), 3000) }

  function formatCant(cant, unidad) {
    if (unidad === 'kg') return cant >= 1 ? `${cant} kg` : `${cant * 1000}g`
    return `${cant} u.`
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Recetas / Productos compuestos</h1>
          <p className="page-subtitle">Pizza, picadas, combos — al vender descuenta cada ingrediente del stock</p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}>+ Nueva receta</button>
      </div>

      <div className="alert alert-warning" style={{ marginBottom: 20 }}>
        💡 <strong>¿Cómo funciona?</strong> Cuando vendés una "Picada Grande" desde el Panel de Ventas, el sistema descuenta automáticamente del stock todos los ingredientes que definiste acá (ej: 0.150kg de salame, 0.100kg de queso, etc.)
      </div>

      {loading ? <div className="loading">Cargando...</div>
      : recetas.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🍕</div>
          <p>No hay recetas todavía.<br />Creá una para productos como pizza, picada, combo, etc.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {recetas.map(r => (
            <div key={r.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 2 }}>{r.nombre}</h3>
                  {r.descripcion && <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{r.descripcion}</p>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-sm btn-outline" onClick={() => abrirEditar(r)}>Editar</button>
                  <button className="btn btn-sm btn-danger" onClick={() => eliminar(r)}>Borrar</button>
                </div>
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', marginBottom: 10 }}>
                Precio de venta: ${(r.precio || 0).toLocaleString('es-AR')}
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Ingredientes</p>
                {(r.ingredientes || []).map((ing, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: '0.84rem' }}>
                    <span>{ing.productoNombre}</span>
                    <span style={{ fontWeight: 700, color: 'var(--muted)' }}>{formatCant(ing.cantidad, ing.unidad)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editId ? 'Editar receta' : 'Nueva receta'}</h3>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>

            <div className="form-group">
              <label>Nombre del producto compuesto *</label>
              <input className="form-control" value={form.nombre} onChange={e => setForm(f => ({...f, nombre: e.target.value}))} placeholder="Ej: Picada Grande, Pizza Especial, Combo Fiambres" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>Descripción</label>
                <input className="form-control" value={form.descripcion} onChange={e => setForm(f => ({...f, descripcion: e.target.value}))} placeholder="Opcional" />
              </div>
              <div className="form-group">
                <label>Precio de venta ($)</label>
                <input className="form-control" type="number" min="0" value={form.precio} onChange={e => setForm(f => ({...f, precio: e.target.value}))} placeholder="0" />
              </div>
            </div>

            {/* Ingredientes actuales */}
            {form.ingredientes.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Ingredientes agregados</p>
                <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  {form.ingredientes.map((ing, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', borderBottom: i < form.ingredientes.length - 1 ? '1px solid var(--border)' : 'none', fontSize: '0.86rem' }}>
                      <span style={{ fontWeight: 600 }}>{ing.productoNombre}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ color: 'var(--muted)', fontWeight: 700 }}>{formatCant(ing.cantidad, ing.unidad)}</span>
                        <button onClick={() => quitarIngrediente(ing.productoId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '1rem' }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Agregar ingrediente */}
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 14, marginBottom: 14 }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Agregar ingrediente</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 8 }}>
                <div style={{ position: 'relative' }}>
                  <input
                    className="form-control"
                    value={ingBusqueda}
                    onChange={e => setIngBusqueda(e.target.value)}
                    placeholder="Buscar producto del stock..."
                    style={{ marginBottom: 0 }}
                  />
                  {ingSugerencias.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--border)', borderRadius: 8, zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                      {ingSugerencias.map(p => (
                        <div key={p.id}
                          style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.85rem', borderBottom: '1px solid var(--border)' }}
                          onClick={() => { setIngBusqueda(p.nombre); setIngSugerencias([]) }}
                          onMouseDown={e => e.preventDefault()}
                        >
                          <strong>{p.nombre}</strong> — <span style={{ color: 'var(--muted)' }}>Stock: {p.stock} {p.unidad === 'kg' ? 'kg' : 'u.'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  className="form-control"
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="Cantidad"
                  value={ingCantidad}
                  onChange={e => setIngCantidad(e.target.value)}
                  style={{ width: 100 }}
                />
              </div>
              <button
                className="btn btn-outline btn-sm"
                style={{ width: '100%' }}
                onClick={() => {
                  const prod = productos.find(p => p.nombre.toLowerCase() === ingBusqueda.toLowerCase())
                  if (!prod) { mostrarToast('Seleccioná un producto válido de la lista', 'danger'); return }
                  agregarIngrediente(prod)
                }}
              >
                + Agregar ingrediente
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline" style={{flex:1}} onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{flex:1}} onClick={guardar} disabled={guardando}>
                {guardando ? 'Guardando...' : editId ? 'Guardar cambios' : 'Crear receta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast toast-${toast.tipo}`}>{toast.msg}</div>}
    </div>
  )
}
