import { useState, useEffect, useRef } from 'react'
import { collection, query, where, onSnapshot, updateDoc, doc, writeBatch } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { useApp } from '../context/AppContext.jsx'

// Campanita de notificaciones para el admin — avisa en tiempo real cuando
// alguien abre la caja con un saldo distinto al del cierre anterior.
export default function NotificationBell() {
  const { isAdmin } = useApp()
  const [notis, setNotis] = useState([])
  const [abierto, setAbierto] = useState(false)
  const vistos = useRef(new Set())
  const primerCarga = useRef(true)

  useEffect(() => {
    if (!isAdmin) return
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    const q = query(collection(db, 'notificaciones'), where('leida', '==', false))
    const unsub = onSnapshot(q, snap => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      lista.sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0))
      if (!primerCarga.current) {
        const nuevas = lista.filter(n => !vistos.current.has(n.id))
        if (nuevas.length && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          nuevas.forEach(n => new Notification('🔔 La Picadita — Caja', { body: n.mensaje }))
        }
      }
      primerCarga.current = false
      lista.forEach(n => vistos.current.add(n.id))
      setNotis(lista)
    })
    return () => unsub()
  }, [isAdmin])

  async function marcarLeida(id) {
    await updateDoc(doc(db, 'notificaciones', id), { leida: true })
  }

  async function marcarTodasLeidas() {
    const batch = writeBatch(db)
    notis.forEach(n => batch.update(doc(db, 'notificaciones', n.id), { leida: true }))
    await batch.commit()
  }

  if (!isAdmin) return null

  return (
    <div style={{ position:'fixed', top:14, right:16, zIndex:200 }}>
      <button onClick={() => setAbierto(a => !a)} style={{
        position:'relative', width:42, height:42, borderRadius:'50%', border:'none',
        background:'#fff', boxShadow:'0 2px 8px rgba(0,0,0,0.18)', fontSize:'1.2rem', cursor:'pointer'
      }}>
        🔔
        {notis.length > 0 && (
          <span style={{
            position:'absolute', top:-2, right:-2, background:'#d64545', color:'#fff',
            borderRadius:'50%', minWidth:18, height:18, fontSize:'0.68rem', fontWeight:700,
            display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px'
          }}>{notis.length}</span>
        )}
      </button>
      {abierto && (
        <div style={{
          position:'absolute', top:50, right:0, width:320, maxHeight:420, overflowY:'auto',
          background:'#fff', borderRadius:10, boxShadow:'0 6px 24px rgba(0,0,0,0.22)', padding:12
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <strong style={{ fontSize:'0.9rem' }}>Notificaciones</strong>
            {notis.length > 0 && (
              <button onClick={marcarTodasLeidas} style={{ fontSize:'0.75rem', background:'none', border:'none', color:'#2563eb', cursor:'pointer' }}>
                Marcar todas leídas
              </button>
            )}
          </div>
          {notis.length === 0 && <p style={{ fontSize:'0.8rem', color:'#888' }}>Sin novedades</p>}
          {notis.map(n => (
            <div key={n.id} style={{ padding:'8px 0', borderBottom:'1px solid #eee', fontSize:'0.82rem' }}>
              <div>{n.mensaje}</div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:4 }}>
                <span style={{ color:'#999', fontSize:'0.72rem' }}>
                  {n.fecha?.toDate ? n.fecha.toDate().toLocaleString('es-AR') : ''}
                </span>
                <button onClick={() => marcarLeida(n.id)} style={{ fontSize:'0.72rem', background:'none', border:'none', color:'#999', cursor:'pointer' }}>
                  ✓ leída
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
