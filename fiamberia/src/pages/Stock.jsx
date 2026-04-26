import { useState, useEffect } from 'react'
import { doc, updateDoc, addDoc, collection, Timestamp, increment } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { getProductos } from '../firebase/db.js'
import { updateCacheItem } from '../firebase/cache.js'

export default function Stock() {
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [modalCarga, setModalCarga] = useState(null)
  const [cantidadCarga, setCantidadCarga] = useState('')
  const [toast, setToast] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar(force = false) {
    setLoading(true)
    setProductos(await getProductos(force))
    setLoading(false)
  }

  function getEstado(p) {
    if (p.stock <= 0) return 'sin'
    if (p.stock <= (p.stockMinimo || 0)) return 'bajo'
    return 'ok'
  }

  const filtrados = productos.filter(p => {
    const estado = getEstado(p)
    const matchFiltro = filtro === 'todos' || estado === filtro
    const matchBusqueda = !busqueda || p.nombre?.toLowerCase().includes(busqueda.toLowerCase())
    return matchFiltro && matchBusqueda
  })

  const counts = {
    todos: productos.length,
    sin:   productos.filter(p => p.stock <= 0).length,
    bajo:  productos.filter(p => p.stock > 0 && p.stock <= (p.stockMinimo||0)).length,
    ok:    productos.filter(p => p.stock > (p.stockMinimo||0)).length,
  }

  async function cargarStock() {
    const cant = parseFloat(cantidadCarga.replace(',','.'))
    if (!cant || cant <= 0) return
    try {
      await updateDoc(doc(db, 'productos', modalCarga.id), { stock: increment(cant) })
      await addDoc(collection(db, 'movimientos'), {
        productoId: modalCarga.id, productoNombre: modalCarga.nombre,
        tipo: 'carga', cantidad: cant, unidad: modalCarga.unidad, fecha: Timestamp.now()
      })
      // Actualizar caché sin re-leer Firestore
      updateCacheItem('productos', modalCarga.id, p => ({ ...p, stock: p.stock + cant }))
      setProductos(await getProductos(false))
      mostrarToast(`✅ +${cant} ${modalCarga.unidad==='kg'?'kg':'u.'} agregado`, 'success')
      setModalCarga(null); setCantidadCarga('')
    } catch { mostrarToast('❌ Error al actualizar stock', 'danger') }
  }

  function mostrarToast(msg, tipo) { setToast({ msg, tipo }); setTimeout(() => setToast(null), 3000) }
  function formatStock(p) { return p.unidad==='kg' ? `${p.stock} kg` : `${p.stock} u.` }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Stock</h1>
        <p className="page-subtitle">Control de inventario</p>
      </div>

      {counts.sin > 0 && <div className="alert alert-danger">⛔ <strong>{counts.sin} producto{counts.sin>1?'s':''} sin stock</strong></div>}
      {counts.bajo > 0 && <div className="alert alert-warning">⚠️ <strong>{counts.bajo} con stock bajo</strong> — revisá y cargá mercadería</div>}

      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        {[['todos',`Todos (${counts.todos})`],['sin',`Sin stock (${counts.sin})`],['bajo',`Bajo (${counts.bajo})`],['ok',`OK (${counts.ok})`]].map(([k,l]) => (
          <button key={k} className={`btn btn-sm ${filtro===k?'btn-primary':'btn-outline'}`} onClick={() => setFiltro(k)}>{l}</button>
        ))}
        <input className="form-control" style={{ maxWidth:220, marginLeft:'auto' }} placeholder="Buscar..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        <button className="btn btn-outline btn-sm" onClick={() => cargar(true)} title="Actualizar desde servidor">🔄</button>
      </div>

      <div className="card" style={{ padding:0 }}>
        <div className="table-wrap">
          {loading ? <div className="loading">Cargando...</div>
          : filtrados.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📦</div><p>No hay productos en esta categoría</p></div>
          ) : (
            <table>
              <thead><tr><th>Producto</th><th>Categoría</th><th>Unidad</th><th>Stock actual</th><th>Mínimo</th><th>Estado</th><th>Acción</th></tr></thead>
              <tbody>
                {filtrados.map(p => {
                  const estado = getEstado(p)
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight:600 }}>{p.nombre}</td>
                      <td>{p.categoria || '—'}</td>
                      <td><span className="badge badge-ok">{p.unidad==='kg'?'kg':'unidad'}</span></td>
                      <td style={{ fontWeight:700 }}>{formatStock(p)}</td>
                      <td style={{ color:'var(--muted)' }}>{p.stockMinimo||0} {p.unidad==='kg'?'kg':'u.'}</td>
                      <td>
                        <span className={`badge ${estado==='ok'?'badge-ok':estado==='bajo'?'badge-warning':'badge-danger'}`}>
                          {estado==='ok'?'✓ OK':estado==='bajo'?'⚠ Bajo':'⛔ Sin stock'}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-sm btn-outline" onClick={() => { setModalCarga(p); setCantidadCarga('') }}>+ Cargar</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalCarga && (
        <div className="modal-overlay" onClick={() => setModalCarga(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Cargar stock — {modalCarga.nombre}</h3>
              <button className="modal-close" onClick={() => setModalCarga(null)}>✕</button>
            </div>
            <p style={{ fontSize:'0.85rem', color:'var(--muted)', marginBottom:16 }}>Stock actual: <strong>{formatStock(modalCarga)}</strong></p>
            <div className="form-group">
              <label>Cantidad a agregar ({modalCarga.unidad==='kg'?'kg':'unidades'})</label>
              <input className="form-control" style={{ fontSize:'1.2rem', textAlign:'center' }}
                type="number" step={modalCarga.unidad==='kg'?'0.1':'1'} min="0"
                placeholder={modalCarga.unidad==='kg'?'Ej: 5.5':'Ej: 12'}
                value={cantidadCarga} onChange={e => setCantidadCarga(e.target.value)}
                onKeyDown={e => e.key==='Enter' && cargarStock()} autoFocus />
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-outline" style={{flex:1}} onClick={() => setModalCarga(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{flex:1}} onClick={cargarStock}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className={`toast toast-${toast.tipo}`}>{toast.msg}</div>}
    </div>
  )
}
