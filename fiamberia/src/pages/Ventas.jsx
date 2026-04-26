import { useState, useEffect, useRef } from 'react'
import { collection, doc, Timestamp, increment, writeBatch } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { getProductos, getRecetas } from '../firebase/db.js'
import { invalidateCache, updateCacheItem } from '../firebase/cache.js'
import './Ventas.css'

function parsearCodigoBalanza(codigo) {
  const str = codigo.toString().replace(/\D/g, '')
  if (str.length === 13 && str.startsWith('2')) {
    const codigoProd = str.substring(1, 6).replace(/^0+/, '')
    const pesoKg = parseInt(str.substring(6, 11)) / 1000
    return { codigoProd, pesoKg }
  }
  return null
}

function imprimirTicket(venta, nombreLocal) {
  const fecha = new Date().toLocaleString('es-AR')
  const items = venta.items.map(i => {
    const qty = i.unidad === 'kg'
      ? (i.cantidad >= 1 ? `${i.cantidad.toFixed(3)} kg` : `${(i.cantidad*1000).toFixed(0)} g`)
      : `${i.cantidad} u.`
    const sub = (i.precio * i.cantidad).toLocaleString('es-AR', { minimumFractionDigits:2 })
    return `<tr>
      <td style="padding:4px 8px;border-bottom:1px dashed #ccc">${i.nombre}</td>
      <td style="padding:4px 8px;border-bottom:1px dashed #ccc;text-align:center">${qty}</td>
      <td style="padding:4px 8px;border-bottom:1px dashed #ccc;text-align:right">$${i.precio.toLocaleString('es-AR')}</td>
      <td style="padding:4px 8px;border-bottom:1px dashed #ccc;text-align:right;font-weight:700">$${sub}</td>
    </tr>`
  }).join('')
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ticket</title>
  <style>body{font-family:monospace;font-size:13px;max-width:300px;margin:0 auto;padding:10px}
  h2{text-align:center;font-size:16px;margin-bottom:2px}.sub{text-align:center;color:#666;font-size:11px;margin-bottom:10px}
  .sep{border:none;border-top:2px dashed #333;margin:8px 0}table{width:100%;border-collapse:collapse;font-size:12px}
  th{text-align:left;padding:4px 8px;border-bottom:2px solid #333;font-size:11px}
  .total-row{display:flex;justify-content:space-between;font-size:15px;font-weight:900;margin-top:10px;padding-top:8px;border-top:2px solid #333}
  .gracias{text-align:center;margin-top:12px;font-size:11px;color:#666}</style>
  </head><body>
  <h2>${nombreLocal||'Fiambería La Picadita'}</h2>
  <div class="sub">${fecha}</div><hr class="sep">
  <table><thead><tr><th>Producto</th><th style="text-align:center">Cant.</th><th style="text-align:right">P.Unit</th><th style="text-align:right">Subtotal</th></tr></thead>
  <tbody>${items}</tbody></table>
  <div class="total-row"><span>TOTAL</span><span>$${venta.total.toLocaleString('es-AR',{minimumFractionDigits:2})}</span></div>
  <div class="gracias">¡Gracias por su compra!</div></body></html>`
  const win = window.open('','_blank','width=400,height=600')
  win.document.write(html); win.document.close(); win.focus()
  setTimeout(() => win.print(), 400)
}

export default function Ventas() {
  const [productos, setProductos] = useState([])
  const [recetas, setRecetas] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [carrito, setCarrito] = useState([])
  const [sugerencias, setSugerencias] = useState([])
  const [modalKg, setModalKg] = useState(null)
  const [cantidadKg, setCantidadKg] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [nombreLocal, setNombreLocal] = useState(localStorage.getItem('nombreLocal') || 'Fiambería La Picadita')
  const [ultimaVenta, setUltimaVenta] = useState(null)
  const inputRef = useRef()
  const barcodeBuffer = useRef('')
  const barcodeTimer = useRef(null)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos(force = false) {
    // Usa caché — no re-lee si no es necesario
    const [prods, recs] = await Promise.all([
      getProductos(force),
      getRecetas(force)
    ])
    setProductos(prods)
    setRecetas(recs)
  }

  useEffect(() => {
    function onKeyPress(e) {
      if (e.key === 'Enter') {
        if (barcodeBuffer.current.length >= 8) procesarCodigoBarra(barcodeBuffer.current)
        barcodeBuffer.current = ''; clearTimeout(barcodeTimer.current); return
      }
      barcodeBuffer.current += e.key
      clearTimeout(barcodeTimer.current)
      barcodeTimer.current = setTimeout(() => { barcodeBuffer.current = '' }, 100)
    }
    window.addEventListener('keypress', onKeyPress)
    return () => window.removeEventListener('keypress', onKeyPress)
  }, [productos])

  function procesarCodigoBarra(codigo) {
    const balanza = parsearCodigoBalanza(codigo)
    if (balanza) {
      const prod = productos.find(p => p.codigo === balanza.codigoProd || p.codigoBarra?.endsWith(balanza.codigoProd))
      if (prod) { agregarAlCarrito(prod, balanza.pesoKg); mostrarToast(`⚖️ ${prod.nombre} — ${(balanza.pesoKg*1000).toFixed(0)}g`, 'success'); return }
    }
    const prod = productos.find(p => p.codigoBarra === codigo || p.codigo === codigo)
    if (prod) {
      if (prod.unidad === 'kg') { setModalKg(prod); setCantidadKg('') }
      else agregarAlCarrito(prod, 1)
      mostrarToast(`✓ ${prod.nombre}`, 'success')
    } else {
      mostrarToast(`⚠️ Código "${codigo}" no encontrado`, 'danger')
    }
  }

  useEffect(() => {
    if (!busqueda.trim()) { setSugerencias([]); return }
    const q = busqueda.toLowerCase()
    const prods = productos.filter(p => p.nombre?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q)).map(p => ({ ...p, tipo:'producto' }))
    const recs  = recetas.filter(r => r.nombre?.toLowerCase().includes(q)).map(r => ({ ...r, tipo:'receta', unidad:'unidad' }))
    setSugerencias([...prods, ...recs].slice(0, 8))
  }, [busqueda, productos, recetas])

  function seleccionarItem(item) {
    setBusqueda(''); setSugerencias([])
    if (item.tipo === 'receta') { agregarAlCarrito({ ...item, esReceta:true }, 1); return }
    if (item.unidad === 'kg') { setModalKg(item); setCantidadKg('') }
    else agregarAlCarrito(item, 1)
    inputRef.current?.focus()
  }

  function agregarAlCarrito(prod, cantidad) {
    setCarrito(prev => {
      const existe = prev.find(i => i.id === prod.id)
      if (existe) return prev.map(i => i.id === prod.id ? { ...i, cantidad: i.cantidad + cantidad } : i)
      return [...prev, { ...prod, cantidad }]
    })
  }

  function confirmarKg() {
    const kg = parseFloat(cantidadKg.replace(',','.'))
    if (!kg || kg <= 0) return
    agregarAlCarrito(modalKg, kg); setModalKg(null); setCantidadKg('')
  }

  function cambiarCantidad(id, delta) {
    setCarrito(prev => prev.map(i => {
      if (i.id !== id) return i
      const nueva = i.unidad === 'kg'
        ? Math.max(0.05, parseFloat((i.cantidad + delta * 0.1).toFixed(3)))
        : Math.max(1, i.cantidad + delta)
      return { ...i, cantidad: nueva }
    }))
  }

  function quitarItem(id) { setCarrito(prev => prev.filter(i => i.id !== id)) }
  function calcularTotal() { return carrito.reduce((acc, i) => acc + (i.precio||0) * i.cantidad, 0) }

  async function confirmarVenta() {
    if (!carrito.length) return
    setLoading(true)
    const totalFinal = calcularTotal()
    const itemsSnapshot = [...carrito]

    try {
      // Verificar stock
      for (const item of itemsSnapshot) {
        if (item.esReceta) {
          for (const ing of (item.ingredientes || [])) {
            const prod = productos.find(p => p.id === ing.productoId)
            if (prod && prod.stock < ing.cantidad * item.cantidad) {
              mostrarToast(`⚠️ Stock insuficiente de ${prod.nombre}`, 'danger')
              setLoading(false); return
            }
          }
        } else {
          const prod = productos.find(p => p.id === item.id)
          if (prod && prod.stock < item.cantidad) {
            mostrarToast(`⚠️ Stock insuficiente: ${prod.nombre}`, 'danger')
            setLoading(false); return
          }
        }
      }

      // Batch: descontar stock + movimientos + venta + caja en UNA sola operación
      const batch = writeBatch(db)

      for (const item of itemsSnapshot) {
        if (item.esReceta) {
          for (const ing of (item.ingredientes || [])) {
            const cantTotal = ing.cantidad * item.cantidad
            batch.update(doc(db, 'productos', ing.productoId), { stock: increment(-cantTotal) })
            const movRef = doc(collection(db, 'movimientos'))
            batch.set(movRef, { productoId: ing.productoId, productoNombre: ing.productoNombre, tipo:'venta', cantidad: cantTotal, unidad: ing.unidad, fecha: Timestamp.now() })
          }
        } else {
          batch.update(doc(db, 'productos', item.id), { stock: increment(-item.cantidad) })
          const movRef = doc(collection(db, 'movimientos'))
          batch.set(movRef, { productoId: item.id, productoNombre: item.nombre, tipo:'venta', cantidad: item.cantidad, unidad: item.unidad, fecha: Timestamp.now() })
        }
      }

      // Venta
      const ventaRef = doc(collection(db, 'ventas'))
      batch.set(ventaRef, {
        items: itemsSnapshot.map(i => ({ id:i.id, nombre:i.nombre, cantidad:i.cantidad, unidad:i.unidad, precio:i.precio||0, esReceta:i.esReceta||false })),
        total: totalFinal, fecha: Timestamp.now()
      })

      // Caja — ingreso automático
      const cajaRef = doc(collection(db, 'caja'))
      batch.set(cajaRef, {
        concepto: `Venta — ${itemsSnapshot.map(i => i.nombre).join(', ')}`,
        monto: totalFinal, tipo:'ingreso', subtipo:'Venta mostrador', fecha: Timestamp.now()
      })

      await batch.commit()

      // Actualizar caché de productos localmente sin re-leer Firestore
      itemsSnapshot.forEach(item => {
        if (!item.esReceta) {
          updateCacheItem('productos', item.id, p => ({ ...p, stock: Math.max(0, p.stock - item.cantidad) }))
        } else {
          (item.ingredientes || []).forEach(ing => {
            updateCacheItem('productos', ing.productoId, p => ({ ...p, stock: Math.max(0, p.stock - ing.cantidad * item.cantidad) }))
          })
        }
      })
      // Invalidar caja y reportes (nueva venta)
      invalidateCache('caja', 'reportes')

      const ventaData = { items: itemsSnapshot, total: totalFinal }
      setUltimaVenta(ventaData)
      setCarrito([])
      // Refrescar productos desde caché actualizada (sin leer Firestore)
      setProductos(await getProductos(false))
      mostrarToast('✅ Venta registrada', 'success')
    } catch (e) {
      console.error('confirmarVenta error:', e)
      mostrarToast('❌ Error: ' + (e.message || 'Error al registrar'), 'danger')
    }
    setLoading(false)
  }

  function mostrarToast(msg, tipo) { setToast({ msg, tipo }); setTimeout(() => setToast(null), 3500) }

  function formatCantidad(item) {
    if (item.unidad === 'kg') return item.cantidad >= 1 ? `${item.cantidad.toFixed(3)} kg` : `${(item.cantidad*1000).toFixed(0)} g`
    return `${item.cantidad} u.`
  }

  return (
    <div className="ventas-layout">
      <div className="ventas-left">
        <div className="page-header">
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
            <div>
              <h1 className="page-title">Panel de Ventas</h1>
              <p className="page-subtitle">Buscá, tipeá código o escaneá</p>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input style={{ padding:'6px 10px', border:'1px solid var(--border)', borderRadius:8, fontSize:'0.82rem', width:200 }}
                placeholder="Nombre del local"
                value={nombreLocal}
                onChange={e => { setNombreLocal(e.target.value); localStorage.setItem('nombreLocal', e.target.value) }} />
              {ultimaVenta && (
                <button className="btn btn-outline btn-sm" onClick={() => imprimirTicket(ultimaVenta, nombreLocal)}>🖨️ Reimprimir</button>
              )}
            </div>
          </div>
        </div>

        <div className="buscador-wrap">
          <input ref={inputRef} className="form-control buscador-input"
            placeholder="🔍  Nombre o código del producto..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            onKeyDown={e => { if(e.key==='Enter' && sugerencias.length===1) seleccionarItem(sugerencias[0]) }}
            autoFocus />
          {sugerencias.length > 0 && (
            <div className="sugerencias">
              {sugerencias.map(p => (
                <button key={p.id} className="sugerencia-item" onClick={() => seleccionarItem(p)}>
                  <div className="sug-info">
                    <span className="sug-nombre">{p.tipo==='receta' && '🍕 '}{p.nombre}</span>
                    <span className="sug-codigo">{p.tipo==='receta' ? 'Producto compuesto' : p.codigo}</span>
                  </div>
                  <div className="sug-right">
                    <span className="sug-precio">${(p.precio||0).toLocaleString('es-AR')}/{p.unidad==='kg'?'kg':'u.'}</span>
                    {p.tipo !== 'receta' && (
                      <span className={`sug-stock ${p.stock<=(p.stockMinimo||0)?'bajo':''}`}>Stock: {p.stock}{p.unidad==='kg'?' kg':' u.'}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="productos-grid">
          {recetas.map(r => (
            <button key={r.id} className="prod-chip receta-chip" onClick={() => seleccionarItem({...r, tipo:'receta', unidad:'unidad'})}>
              <span className="prod-chip-cat">🍕 Receta</span>
              <span className="prod-chip-nombre">{r.nombre}</span>
              <span className="prod-chip-precio">${(r.precio||0).toLocaleString('es-AR')}</span>
            </button>
          ))}
          {productos.slice(0,16).map(p => (
            <button key={p.id} className={`prod-chip ${p.stock<=0?'sin-stock':''}`}
              onClick={() => seleccionarItem({...p, tipo:'producto'})} disabled={p.stock<=0}>
              <span className="prod-chip-nombre">{p.nombre}</span>
              <span className="prod-chip-precio">${(p.precio||0).toLocaleString('es-AR')}/{p.unidad==='kg'?'kg':'u.'}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="ventas-right">
        <div className="carrito-header">
          <h2 className="carrito-title">Carrito</h2>
          {carrito.length > 0 && <button className="btn btn-outline btn-sm" onClick={() => setCarrito([])}>Limpiar</button>}
        </div>
        {carrito.length === 0 ? (
          <div className="carrito-empty"><span>🛒</span><p>Seleccioná productos para agregar</p></div>
        ) : (
          <div className="carrito-items">
            {carrito.map(item => (
              <div key={item.id} className="carrito-item">
                <div className="ci-info">
                  <span className="ci-nombre">{item.esReceta?'🍕 ':''}{item.nombre}</span>
                  <span className="ci-precio">${(item.precio||0).toLocaleString('es-AR')}/{item.unidad==='kg'?'kg':'u.'}</span>
                </div>
                {item.esReceta && (
                  <div style={{ fontSize:'0.72rem', color:'var(--muted)', marginBottom:6 }}>
                    Descuenta: {item.ingredientes?.map(i => `${i.productoNombre} (${i.cantidad}${i.unidad==='kg'?'kg':'u.'})`).join(', ')}
                  </div>
                )}
                <div className="ci-controls">
                  <button className="qty-btn" onClick={() => cambiarCantidad(item.id,-1)}>−</button>
                  <span className="ci-qty">{formatCantidad(item)}</span>
                  <button className="qty-btn" onClick={() => cambiarCantidad(item.id,1)}>+</button>
                  <button className="qty-btn remove" onClick={() => quitarItem(item.id)}>✕</button>
                </div>
                <div className="ci-subtotal">${((item.precio||0)*item.cantidad).toLocaleString('es-AR',{minimumFractionDigits:2})}</div>
              </div>
            ))}
          </div>
        )}
        <div className="carrito-footer">
          <div className="total-row">
            <span>Total</span>
            <span className="total-amount">${calcularTotal().toLocaleString('es-AR',{minimumFractionDigits:2})}</span>
          </div>
          <button className="btn btn-primary btn-block confirmar-btn" onClick={confirmarVenta} disabled={!carrito.length||loading}>
            {loading ? 'Registrando...' : '✅ Confirmar Venta'}
          </button>
          {ultimaVenta && (
            <button className="btn btn-outline btn-block" style={{ marginTop:8 }} onClick={() => imprimirTicket(ultimaVenta, nombreLocal)}>
              🖨️ Imprimir último ticket
            </button>
          )}
        </div>
      </div>

      {modalKg && (
        <div className="modal-overlay" onClick={() => setModalKg(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Cantidad — {modalKg.nombre}</h3>
              <button className="modal-close" onClick={() => setModalKg(null)}>✕</button>
            </div>
            <p className="kg-hint">Ingresá en kilos (ej: 0.350 = 350g)</p>
            <input className="form-control kg-input" type="number" step="0.001" min="0.001"
              placeholder="Ej: 0.350" value={cantidadKg}
              onChange={e => setCantidadKg(e.target.value)}
              onKeyDown={e => e.key==='Enter' && confirmarKg()} autoFocus />
            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <button className="btn btn-outline" style={{flex:1}} onClick={() => setModalKg(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{flex:1}} onClick={confirmarKg}>Agregar</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className={`toast toast-${toast.tipo}`}>{toast.msg}</div>}
    </div>
  )
}
