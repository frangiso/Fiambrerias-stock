import { useState, useEffect } from 'react'
import { collection, getDocs, addDoc, updateDoc, doc, increment, Timestamp, writeBatch } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { invalidateCache } from '../firebase/cache.js'

export default function Compras() {
  const [productos, setProductos] = useState([])
  const [compras, setCompras] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [toast, setToast] = useState(null)
  const [guardando, setGuardando] = useState(false)
  // Form compra
  const [proveedor, setProveedor] = useState('')
  const [nroFactura, setNroFactura] = useState('')
  const [items, setItems] = useState([])
  // Agregar item
  const [busqProd, setBusqProd] = useState('')
  const [cantItem, setCantItem] = useState('')
  const [costoItem, setCostoItem] = useState('')
  const [sugerencias, setSugerencias] = useState([])
  const [prodSelec, setProdSelec] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [pSnap, cSnap] = await Promise.all([
      getDocs(collection(db, 'productos')),
      getDocs(collection(db, 'compras'))
    ])
    setProductos(pSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    const lista = cSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    lista.sort((a,b) => (b.fecha?.seconds||0) - (a.fecha?.seconds||0))
    setCompras(lista)
    setLoading(false)
  }

  // Buscador de producto
  useEffect(() => {
    if (!busqProd.trim()) { setSugerencias([]); return }
    const q = busqProd.toLowerCase()
    setSugerencias(productos.filter(p =>
      p.nombre?.toLowerCase().includes(q) || p.codigo?.includes(q)
    ).slice(0, 6))
  }, [busqProd, productos])

  function seleccionarProducto(p) {
    setProdSelec(p)
    setBusqProd(p.nombre)
    setSugerencias([])
    // Autocompletar costo con precio actual si existe
    if (p.precioCompra) setCostoItem(p.precioCompra)
  }

  function agregarItem() {
    // Si no hay producto seleccionado, intentar encontrarlo por nombre
    let prod = prodSelec
    if (!prod && busqProd.trim()) {
      prod = productos.find(p =>
        p.nombre.toLowerCase() === busqProd.toLowerCase() ||
        p.nombre.toLowerCase().includes(busqProd.toLowerCase())
      )
      if (prod) setProdSelec(prod)
    }
    if (!prod) { mostrarToast('Seleccioná un producto de la lista', 'danger'); return }
    const cant = parseFloat(String(cantItem).replace(',','.')) || 0
    const costo = parseFloat(String(costoItem).replace(',','.')) || 0
    if (!cant || cant <= 0) { mostrarToast('Ingresá la cantidad', 'danger'); return }
    if (costo < 0) { mostrarToast('El costo no puede ser negativo', 'danger'); return }
    const existe = items.find(i => i.productoId === prod.id)
    if (existe) { mostrarToast('Ese producto ya está en la compra', 'danger'); return }
    setItems(prev => [...prev, {
      productoId: prod.id,
      productoNombre: prod.nombre,
      unidad: prod.unidad,
      cantidad: cant,
      costoUnitario: costo,
      subtotal: cant * costo
    }])
    setProdSelec(null); setBusqProd(''); setCantItem(''); setCostoItem('')
  }

  function quitarItem(id) { setItems(prev => prev.filter(i => i.productoId !== id)) }

  const totalCompra = items.reduce((a, i) => a + i.subtotal, 0)

  async function confirmarCompra() {
    if (!items.length) { mostrarToast('Agregá al menos un producto', 'danger'); return }
    setGuardando(true)
    try {
      const batch = writeBatch(db)
      // Sumar stock y actualizar precio de compra de cada producto
      for (const item of items) {
        batch.update(doc(db, 'productos', item.productoId), {
          stock: increment(item.cantidad),
          precioCompra: item.costoUnitario
        })
        // Movimiento de stock
        const movRef = doc(collection(db, 'movimientos'))
        batch.set(movRef, {
          productoId: item.productoId,
          productoNombre: item.productoNombre,
          tipo: 'carga',
          cantidad: item.cantidad,
          unidad: item.unidad,
          fecha: Timestamp.now()
        })
      }
      // Registrar la compra
      const compraRef = doc(collection(db, 'compras'))
      batch.set(compraRef, {
        proveedor: proveedor.trim(),
        nroFactura: nroFactura.trim(),
        items: items,
        total: totalCompra,
        fecha: Timestamp.now()
      })
      // Registrar en caja como egreso (no bloquea si la caja está cerrada)
      try {
        const cajaRef = doc(collection(db, 'caja'))
        await addDoc(collection(db, 'caja'), {
          concepto: `Compra a ${proveedor || 'proveedor'}${nroFactura ? ` — Fact. ${nroFactura}` : ''}`,
          monto: totalCompra,
          tipo: 'egreso',
          subtipo: 'Compra mercadería',
          fecha: Timestamp.now()
        })
      } catch(e) {
        // Si falla el registro en caja, la compra igual se guarda
        console.warn('No se pudo registrar en caja:', e)
      }
      await batch.commit()
      invalidateCache('productos')
      mostrarToast('✅ Compra registrada y stock actualizado', 'success')
      setModal(false)
      setProveedor(''); setNroFactura(''); setItems([])
      cargar()
    } catch(e) {
      mostrarToast('❌ Error al registrar la compra', 'danger')
    }
    setGuardando(false)
  }

  function formatFecha(ts) {
    if (!ts) return '—'
    return ts.toDate().toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
  }

  function formatCant(cant, unidad) {
    return unidad === 'kg' ? `${cant} kg` : `${cant} u.`
  }

  const totalGastado = compras.reduce((a,c) => a + (c.total||0), 0)

  return (
    <div>
      <div className="page-header" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <h1 className="page-title">Compras</h1>
          <p className="page-subtitle">Registrá facturas de proveedores — actualiza el stock automáticamente</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Nueva compra</button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:24 }}>
        <div className="card" style={{ textAlign:'center' }}>
          <div style={{ fontSize:'1.5rem', fontWeight:800, color:'var(--danger)' }}>${totalGastado.toLocaleString('es-AR',{minimumFractionDigits:2})}</div>
          <div style={{ fontSize:'0.72rem', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:4 }}>Total comprado</div>
        </div>
        <div className="card" style={{ textAlign:'center' }}>
          <div style={{ fontSize:'1.5rem', fontWeight:800, color:'var(--primary)' }}>{compras.length}</div>
          <div style={{ fontSize:'0.72rem', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:4 }}>Compras registradas</div>
        </div>
        <div className="card" style={{ textAlign:'center' }}>
          <div style={{ fontSize:'1.5rem', fontWeight:800, color:'var(--primary)' }}>
            ${compras.length ? Math.round(totalGastado/compras.length).toLocaleString('es-AR') : 0}
          </div>
          <div style={{ fontSize:'0.72rem', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:4 }}>Promedio por compra</div>
        </div>
      </div>

      {/* Lista compras */}
      <div className="card" style={{ padding:0 }}>
        <div className="table-wrap">
          {loading ? <div className="loading">Cargando...</div>
          : compras.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🛒</div>
              <p>No hay compras registradas todavía.<br />Registrá una factura con el botón "Nueva compra".</p>
            </div>
          ) : (
            <table>
              <thead><tr><th>Fecha</th><th>Proveedor</th><th>Nro. Factura</th><th>Ítems</th><th>Total</th></tr></thead>
              <tbody>
                {compras.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontSize:'0.82rem', color:'var(--muted)' }}>{formatFecha(c.fecha)}</td>
                    <td style={{ fontWeight:600 }}>{c.proveedor || '—'}</td>
                    <td style={{ fontFamily:'monospace', fontSize:'0.82rem' }}>{c.nroFactura || '—'}</td>
                    <td>
                      <div style={{ fontSize:'0.78rem', color:'var(--muted)' }}>
                        {(c.items||[]).map(i => `${i.productoNombre} (${formatCant(i.cantidad, i.unidad)})`).join(', ')}
                      </div>
                    </td>
                    <td style={{ fontWeight:800, color:'var(--danger)' }}>${(c.total||0).toLocaleString('es-AR',{minimumFractionDigits:2})}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL NUEVA COMPRA */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" style={{ maxWidth:600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">🛒 Nueva compra / factura</h3>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label>Proveedor</label>
                <input className="form-control" value={proveedor} onChange={e => setProveedor(e.target.value)} placeholder="Nombre del proveedor" />
              </div>
              <div className="form-group">
                <label>Nro. de factura</label>
                <input className="form-control" value={nroFactura} onChange={e => setNroFactura(e.target.value)} placeholder="Ej: 0001-00012345" />
              </div>
            </div>

            {/* Agregar producto */}
            <div style={{ background:'var(--bg)', borderRadius:10, padding:14, marginBottom:14 }}>
              <p style={{ fontSize:'0.75rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Agregar producto</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:8, marginBottom:8 }}>
                <div style={{ position:'relative' }}>
                  <input className="form-control" value={busqProd}
                    onChange={e => { setBusqProd(e.target.value); setProdSelec(null) }}
                    placeholder="Buscar producto..." style={{ marginBottom:0 }} />
                  {sugerencias.length > 0 && (
                    <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'white', border:'1px solid var(--border)', borderRadius:8, zIndex:10, boxShadow:'0 4px 12px rgba(0,0,0,0.1)' }}>
                      {sugerencias.map(p => (
                        <div key={p.id}
                          style={{ padding:'8px 12px', cursor:'pointer', fontSize:'0.85rem', borderBottom:'1px solid var(--border)' }}
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => seleccionarProducto(p)}>
                          <strong>{p.nombre}</strong> <span style={{ color:'var(--muted)' }}>· Stock: {p.stock} {p.unidad==='kg'?'kg':'u.'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <input className="form-control" type="number" step="0.001" min="0"
                  placeholder="Cantidad" value={cantItem}
                  onChange={e => setCantItem(e.target.value)}
                  style={{ width:90 }} />
                <input className="form-control" type="number" step="0.01" min="0"
                  placeholder="Costo $" value={costoItem}
                  onChange={e => setCostoItem(e.target.value)}
                  onKeyDown={e => { if(e.key === 'Enter') agregarItem() }}
                  style={{ width:100 }} />
              </div>
              <button className="btn btn-outline btn-sm" style={{ width:'100%' }} onClick={agregarItem}>
                + Agregar a la compra
              </button>
            </div>

            {/* Items agregados */}
            {items.length > 0 && (
              <div style={{ marginBottom:16 }}>
                <p style={{ fontSize:'0.75rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Ítems de la compra</p>
                <div style={{ border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
                  {items.map((item,i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderBottom: i<items.length-1?'1px solid var(--border)':'none', fontSize:'0.85rem' }}>
                      <div style={{ flex:1 }}>
                        <span style={{ fontWeight:700 }}>{item.productoNombre}</span>
                        <span style={{ color:'var(--muted)', marginLeft:8 }}>{formatCant(item.cantidad, item.unidad)} × ${item.costoUnitario.toLocaleString('es-AR')}</span>
                      </div>
                      <span style={{ fontWeight:800, color:'var(--danger)' }}>${item.subtotal.toLocaleString('es-AR',{minimumFractionDigits:2})}</span>
                      <button onClick={() => quitarItem(item.productoId)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--danger)', fontSize:'1rem' }}>✕</button>
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px 0', fontWeight:800, fontSize:'1.1rem' }}>
                  <span>Total compra</span>
                  <span style={{ color:'var(--danger)' }}>${totalCompra.toLocaleString('es-AR',{minimumFractionDigits:2})}</span>
                </div>
              </div>
            )}

            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-outline" style={{flex:1}} onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{flex:1}} onClick={confirmarCompra} disabled={!items.length||guardando}>
                {guardando ? 'Registrando...' : '✅ Confirmar compra y actualizar stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast toast-${toast.tipo}`}>{toast.msg}</div>}
    </div>
  )
}
