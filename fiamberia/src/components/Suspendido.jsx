import { useState, useEffect } from 'react'

// Interruptor de suspensión: lee /estado.json (archivo estático del proyecto,
// no consume lecturas de Firestore). Para suspender o reactivar el sistema se
// cambia "suspendido" en public/estado.json y se publica. Si el archivo no se
// puede leer (sin internet, error) NO se bloquea nada, así una falla de red
// nunca frena las ventas.
export function useEstadoSistema() {
  const [estado, setEstado] = useState({ suspendido: false, mensaje: '' })

  useEffect(() => {
    let activo = true
    async function consultar() {
      try {
        const res = await fetch(`/estado.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (activo) setEstado({ suspendido: data.suspendido === true, mensaje: data.mensaje || '' })
      } catch { /* sin conexión: dejamos el estado anterior */ }
    }
    consultar()
    const id = setInterval(consultar, 60000)
    // Al volver a la pestaña también se re-chequea, para que no quede una
    // pestaña vieja abierta vendiendo.
    const alVolver = () => { if (document.visibilityState === 'visible') consultar() }
    document.addEventListener('visibilitychange', alVolver)
    return () => { activo = false; clearInterval(id); document.removeEventListener('visibilitychange', alVolver) }
  }, [])

  return estado
}

// Ventana de error a pantalla completa: tapa toda la app (todas las pestañas
// y el login) y no se puede cerrar.
export default function Suspendido({ mensaje }) {
  return (
    <div role="alertdialog" aria-modal="true" style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'#fff', borderRadius:14, maxWidth:420, width:'100%', padding:'28px 24px', textAlign:'center', borderTop:'6px solid #C0392B', boxShadow:'0 10px 40px rgba(0,0,0,0.4)' }}>
        <div style={{ fontSize:'3rem', marginBottom:8 }}>⛔</div>
        <h1 style={{ fontSize:'1.35rem', color:'#C0392B', marginBottom:10 }}>Error: sistema suspendido</h1>
        <p style={{ color:'#444', fontSize:'0.95rem', lineHeight:1.5 }}>{mensaje || 'El sistema está suspendido temporalmente.'}</p>
      </div>
    </div>
  )
}
