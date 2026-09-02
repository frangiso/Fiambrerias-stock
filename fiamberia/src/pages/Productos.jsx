import { useState, useEffect } from 'react'
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch, Timestamp } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { getCache, setCache, invalidateCache } from '../firebase/cache.js'
import { useApp } from '../context/AppContext.jsx'

const EMPTY = { nombre: '', categoria: '', precio: '', stock: '', stockMinimo: '', unidad: 'unidad', fechaVencimiento: '' }

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

function generarCodigo(productos) {
  const nums = productos.map(p => parseInt(p.codigo || '0')).filter(n => !isNaN(n) && isFinite(n))
  const max = nums.length > 0 ? Math.max(...nums) : 0
  return String(max + 1).padStart(4, '0')
}

export default function Productos() {
  const { isAdmin, user } = useApp()
  const [productos, setProductos] = useState([])
  const [rubros, setRubros] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [modalAumento, setModalAumento] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroCat, setFiltroCat] = useState('Todos')
  const [toast, setToast] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [aumentoCat, setAumentoCat] = useState('Todos')
  const [aumentoPct, setAumentoPct] = useState('')
  const [aumentoTipo, setAumentoTipo] = useState('porcentaje')
  const [preview, setPreview] = useState([])

  useEffect(() => { cargar() }, [])

  const RUBROS_DEFAULT = [
    { nombre:'Fiambres',    icono:'🥩', color:'#C9736A' },
    { nombre:'Quesos',      icono:'🧀', color:'#C9A84C' },
    { nombre:'Embutidos',   icono:'🍖', color:'#C0392B' },
    { nombre:'Bebidas',     icono:'🥤', color:'#4A7AB5' },
    { nombre:'Almacén',     icono:'🛒', color:'#2A5C45' },
    { nombre:'Lácteos',     icono:'🥛', color:'#8B5CF6' },
    { nombre:'Panificados', icono:'🍞', color:'#F97316' },
    { nombre:'Limpieza',    icono:'🧹', color:'#64748B' },
    { nombre:'Otro',        icono:'📦', color:'#888880' },
  ]

  async function cargar() {
    setLoading(true)
    const cachedRubros = getCache('rubros')
    if (cachedRubros) {
      setRubros(cachedRubros)
    } else {
      const rSnap = await getDocs(collection(db, 'rubros'))
      let lista = rSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      if (lista.length === 0) {
        const batch = writeBatch(db)
        RUBROS_DEFAULT.forEach(r => { const ref = doc(collection(db, 'rubros')); batch.set(ref, r) })
        await batch.commit()
        const rSnap2 = await getDocs(collection(db, 'rubros'))
        lista = rSnap2.docs.map(d => ({ id: d.id, ...d.data() }))
      }
      setRubros(lista)
      setCache('rubros', lista)
    }
    const snap = await getDocs(collection(db, 'productos'))
    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    lista.sort((a, b) => a.nombre?.localeCompare(b.nombre))
    setProductos(lista)
    setLoading(false)
  }

  function abrirNuevo() { setForm(EMPTY); setEditId(null); setModal(true) }

  function abrirEditar(p) {
    setForm({ nombre: p.nombre||'', categoria: p.categoria||'', precio: p.precio||'', stock: p.stock||'', stockMinimo: p.stockMinimo||'', unidad: p.unidad||'unidad', fechaVencimiento: p.fechaVencimiento||'' })
    setEditId(p.id); setModal(true)
  }

  async function guardar() {
    if (!form.nombre.trim()) { mostrarToast('El nombre es obligatorio', 'danger'); return }
    setGuardando(true)
    const data = {
      nombre: form.nombre.trim(),
      categoria: form.categoria,
      precio: parseFloat(form.precio)||0,
      stock: parseFloat(form.stock)||0,
      stockMinimo: parseFloat(form.stockMinimo)||0,
      unidad: form.unidad,
      fechaVencimiento: form.fechaVencimiento || null
    }
    try {
      if (editId) {
        await updateDoc(doc(db, 'productos', editId), data)
        mostrarToast('✅ Producto actualizado', 'success')
      } else {
        // Auto-generar código interno único
        data.codigo = generarCodigo(productos)
        await addDoc(collection(db, 'productos'), data)
        mostrarToast(`✅ Producto creado — Código: ${data.codigo}`, 'success')
      }
      invalidateCache('productos')
      setModal(false); cargar()
    } catch { mostrarToast('❌ Error al guardar', 'danger') }
    setGuardando(false)
  }

  async function actualizarPrecioDirecto(id, nuevoPrecio) {
    const precio = parseFloat(nuevoPrecio)
    if (isNaN(precio) || precio < 0) return
    await updateDoc(doc(db, 'productos', id), { precio })
    setProductos(prev => prev.map(p => p.id === id ? { ...p, precio } : p))
    mostrarToast('✅ Precio actualizado', 'success')
  }

  useEffect(() => {
    const pct = parseFloat(aumentoPct)
    if (!pct) { setPreview([]); return }
    const filtrados = productos.filter(p => aumentoCat === 'Todos' || p.categoria === aumentoCat)
    setPreview(filtrados.map(p => ({
      ...p,
      nuevoPrecio: aumentoTipo === 'porcentaje'
        ? Math.round(p.precio * (1 + pct / 100))
        : Math.round(p.precio + pct)
    })))
  }, [aumentoCat, aumentoPct, aumentoTipo, productos])

  async function aplicarAumento() {
    if (!preview.length) return
    setGuardando(true)
    try {
      const batch = writeBatch(db)
      preview.forEach(p => batch.update(doc(db, 'productos', p.id), { precio: p.nuevoPrecio }))
      await batch.commit()
      mostrarToast(`✅ ${preview.length} productos actualizados`, 'success')
      setModalAumento(false); setAumentoPct(''); setPreview([]); cargar()
    } catch { mostrarToast('❌ Error al actualizar', 'danger') }
    setGuardando(false)
  }

  async function eliminar(p) {
    const motivo = prompt(`Vas a eliminar "${p.nombre}" (stock actual: ${p.stock} ${p.unidad==='kg'?'kg':'u.'}).\nEsta acción queda registrada. Indicá el motivo de la baja:`)
    if (motivo === null) return
    if (!motivo.trim()) { mostrarToast('Debés indicar un motivo para eliminar el producto', 'danger'); return }
    if (!confirm(`Confirmá: eliminar "${p.nombre}" por "${motivo.trim()}"`)) return
    try {
      await addDoc(collection(db, 'movimientos'), {
        productoId: p.id, productoNombre: p.nombre, codigo: p.codigo || null,
        categoria: p.categoria || null, precio: p.precio || 0,
        stockFinal: p.stock || 0, unidad: p.unidad || 'unidad',
        tipo: 'baja_producto', motivo: motivo.trim(),
        registradoPor: user?.email || null, fecha: Timestamp.now()
      })
      await deleteDoc(doc(db, 'productos', p.id))
      invalidateCache('productos')
      mostrarToast('Producto eliminado y baja registrada', 'warning'); cargar()
    } catch { mostrarToast('❌ Error al eliminar el producto', 'danger') }
  }

  function mostrarToast(msg, tipo) { setToast({ msg, tipo }); setTimeout(() => setToast(null), 3500) }

  const filtrados = productos.filter(p => {
    const matchCat = filtroCat === 'Todos' || p.categoria === filtroCat
    const matchBusq = !busqueda || p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || p.codigo?.includes(busqueda)
    return matchCat && matchBusq
  })

  return (
    <div>
      <div className="page-header" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 className="page-title">Productos</h1>
          <p className="page-subtitle">El código interno se genera automáticamente · El precio es editable directo en la tabla</p>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button className="btn btn-outline" onClick={() => exportarCSV(
            productos,
            [
              { label:'Código', get: p => p.codigo||'' },
              { label:'Nombre', get: p => p.nombre||'' },
              { label:'Categoría', get: p => p.categoria||'' },
              { label:'Unidad', get: p => p.unidad||'' },
              { label:'Precio', get: p => p.precio||0 },
              { label:'Stock', get: p => p.stock||0 },
              { label:'Stock mínimo', get: p => p.stockMinimo||0 },
              { label:'Vencimiento', get: p => p.fechaVencimiento||'' },
            ],
            'productos.csv'
          )}>⬇️ CSV</button>
          {isAdmin && <button className="btn btn-outline" onClick={() => setModalAumento(true)}>📈 Actualizar precios</button>}
          <button className="btn btn-primary" onClick={abrirNuevo}>+ Nuevo producto</button>
        </div>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        {['Todos', ...rubros.map(r => r.nombre)].map(c => (
          <button key={c} className={`btn btn-sm ${filtroCat===c?'btn-primary':'btn-outline'}`} onClick={() => setFiltroCat(c)}>{c}</button>
        ))}
        <input className="form-control" style={{ maxWidth:220, marginLeft:'auto' }} placeholder="Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      </div>

      <div className="card" style={{ padding:0 }}>
        <div className="table-wrap">
          {loading ? <div className="loading">Cargando...</div>
          : filtrados.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📋</div><p>No hay productos.</p></div>
          ) : (
            <table>
              <thead>
                <tr><th>Cód.</th><th>Nombre</th><th>Categoría</th><th>Unidad</th><th>Precio ($) — editable</th><th>Stock</th><th>Mín.</th><th>Vencimiento</th><th></th></tr>
              </thead>
              <tbody>
                {filtrados.map(p => {
                  const vencido = p.fechaVencimiento && new Date(p.fechaVencimiento) < new Date(new Date().toDateString())
                  const porVencer = !vencido && p.fechaVencimiento && (new Date(p.fechaVencimiento) - new Date(new Date().toDateString())) <= 3*24*60*60*1000
                  return (
                  <tr key={p.id}>
                    <td style={{ fontFamily:'monospace', color:'var(--muted)', fontSize:'0.82rem', fontWeight:700 }}>{p.codigo || '—'}</td>
                    <td style={{ fontWeight:600 }}>{p.nombre}</td>
                    <td>{p.categoria || '—'}</td>
                    <td><span className="badge badge-ok">{p.unidad==='kg'?'kg':'unidad'}</span></td>
                    <td>
                      <input type="number" defaultValue={p.precio} min="0"
                        style={{ width:100, padding:'5px 8px', border:'1.5px solid var(--border)', borderRadius:7, fontSize:'0.9rem', fontWeight:700, background:'#FFFBF0' }}
                        onBlur={e => actualizarPrecioDirecto(p.id, e.target.value)}
                        onKeyDown={e => { if(e.key==='Enter') e.target.blur() }}
                        title="Editá y presioná Enter para guardar" />
                    </td>
                    <td style={{ fontWeight:700 }}>{p.stock} {p.unidad==='kg'?'kg':'u.'}</td>
                    <td style={{ color:'var(--muted)' }}>{p.stockMinimo||0}</td>
                    <td>
                      {p.fechaVencimiento
                        ? <span className={`badge ${vencido?'badge-danger':porVencer?'badge-warning':'badge-ok'}`}>{p.fechaVencimiento}</span>
                        : <span style={{ color:'var(--muted)' }}>—</span>}
                    </td>
                    <td>
                      <div style={{ display:'flex', gap:8 }}>
                        <button className="btn btn-sm btn-outline" onClick={() => abrirEditar(p)}>Editar</button>
                        {isAdmin && <button className="btn btn-sm btn-danger" onClick={() => eliminar(p)}>Borrar</button>}
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL NUEVO/EDITAR */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editId ? 'Editar producto' : 'Nuevo producto'}</h3>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>
            {!editId && (
              <div className="alert alert-warning" style={{ marginBottom:14, fontSize:'0.82rem' }}>
                💡 El código interno se genera automáticamente al guardar
              </div>
            )}
            <div className="form-group">
              <label>Nombre *</label>
              <input className="form-control" value={form.nombre} onChange={e => setForm(f => ({...f, nombre: e.target.value}))} placeholder="Ej: Salame Casero" />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label>Categoría</label>
                <select className="form-control" value={form.categoria} onChange={e => setForm(f => ({...f, categoria: e.target.value}))}>
                  <option value="">Seleccionar...</option>
                  {rubros.map(r => <option key={r.id} value={r.nombre}>{r.icono||''} {r.nombre}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Unidad</label>
                <select className="form-control" value={form.unidad} onChange={e => setForm(f => ({...f, unidad: e.target.value}))}>
                  <option value="unidad">Por unidad</option>
                  <option value="kg">Por kg / gramo</option>
                </select>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label>Precio</label>
                <input className="form-control" type="number" min="0" step="0.01" value={form.precio} onChange={e => setForm(f => ({...f, precio: e.target.value}))} placeholder="0" />
              </div>
              <div className="form-group">
                <label>Stock actual</label>
                <input className="form-control" type="number" min="0" value={form.stock} onChange={e => setForm(f => ({...f, stock: e.target.value}))} placeholder="0" />
              </div>
              <div className="form-group">
                <label>Stock mínimo</label>
                <input className="form-control" type="number" min="0" value={form.stockMinimo} onChange={e => setForm(f => ({...f, stockMinimo: e.target.value}))} placeholder="0" />
              </div>
            </div>
            <div className="form-group">
              <label>Fecha de vencimiento (opcional)</label>
              <input className="form-control" type="date" value={form.fechaVencimiento} onChange={e => setForm(f => ({...f, fechaVencimiento: e.target.value}))} />
            </div>
            <div style={{ display:'flex', gap:10, marginTop:8 }}>
              <button className="btn btn-outline" style={{flex:1}} onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{flex:1}} onClick={guardar} disabled={guardando}>
                {guardando ? 'Guardando...' : editId ? 'Guardar cambios' : 'Crear producto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AUMENTO MASIVO */}
      {modalAumento && (
        <div className="modal-overlay" onClick={() => setModalAumento(false)}>
          <div className="modal" style={{ maxWidth:580 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">📈 Actualizar precios</h3>
              <button className="modal-close" onClick={() => setModalAumento(false)}>✕</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label>Rubro a actualizar</label>
                <select className="form-control" value={aumentoCat} onChange={e => setAumentoCat(e.target.value)}>
                  <option value="Todos">Todos los productos</option>
                  {rubros.map(r => <option key={r.id} value={r.nombre}>{r.icono||''} {r.nombre}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Tipo de ajuste</label>
                <select className="form-control" value={aumentoTipo} onChange={e => setAumentoTipo(e.target.value)}>
                  <option value="porcentaje">Porcentaje (%)</option>
                  <option value="fijo">Monto fijo ($)</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>{aumentoTipo==='porcentaje' ? 'Porcentaje (ej: 15 = +15%)' : 'Monto fijo a agregar ($)'}</label>
              <input className="form-control" type="number" step="0.1" value={aumentoPct}
                onChange={e => setAumentoPct(e.target.value)}
                placeholder={aumentoTipo==='porcentaje' ? 'Ej: 15' : 'Ej: 500'}
                style={{ fontSize:'1.1rem', textAlign:'center' }} />
            </div>
            {preview.length > 0 && (
              <div style={{ marginBottom:16 }}>
                <p style={{ fontSize:'0.8rem', color:'var(--muted)', marginBottom:8, fontWeight:600 }}>Vista previa — {preview.length} productos afectados:</p>
                <div style={{ maxHeight:200, overflowY:'auto', border:'1px solid var(--border)', borderRadius:10 }}>
                  <table style={{ fontSize:'0.81rem' }}>
                    <thead><tr><th>Producto</th><th>Actual</th><th>Nuevo</th><th>Dif.</th></tr></thead>
                    <tbody>
                      {preview.map(p => (
                        <tr key={p.id}>
                          <td style={{ fontWeight:600 }}>{p.nombre}</td>
                          <td style={{ color:'var(--muted)' }}>${p.precio.toLocaleString('es-AR')}</td>
                          <td style={{ fontWeight:700, color:'var(--primary)' }}>${p.nuevoPrecio.toLocaleString('es-AR')}</td>
                          <td style={{ color:'var(--sage)', fontSize:'0.76rem' }}>+${(p.nuevoPrecio-p.precio).toLocaleString('es-AR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-outline" style={{flex:1}} onClick={() => setModalAumento(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{flex:1}} onClick={aplicarAumento} disabled={!preview.length||guardando}>
                {guardando ? 'Aplicando...' : `✅ Aplicar a ${preview.length} productos`}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast toast-${toast.tipo}`}>{toast.msg}</div>}
    </div>
  )
}
