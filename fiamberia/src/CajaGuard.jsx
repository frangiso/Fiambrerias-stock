import { useCaja } from '../context/CajaContext.jsx'
import { useNavigate } from 'react-router-dom'

export default function CajaGuard({ children, accion = 'realizar esta operación' }) {
  const { cajaAbierta, cajaLoading } = useCaja()
  const navigate = useNavigate()

  if (cajaLoading) {
    return <div className="loading">Verificando estado de caja...</div>
  }

  if (!cajaAbierta) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh', padding:20 }}>
        <div style={{ background:'white', border:'1.5px solid var(--border)', borderRadius:20, padding:'48px 40px', maxWidth:420, textAlign:'center', boxShadow:'0 8px 32px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize:'3.5rem', marginBottom:16 }}>🔒</div>
          <h2 style={{ fontFamily:'serif', fontSize:'1.5rem', fontWeight:800, marginBottom:10, color:'var(--ink)' }}>
            Caja cerrada
          </h2>
          <p style={{ fontSize:'0.9rem', color:'var(--muted)', lineHeight:1.6, marginBottom:28 }}>
            Para poder <strong>{accion}</strong> necesitás abrir la caja del día primero.
          </p>
          <button className="btn btn-primary" style={{ width:'100%', padding:14, fontSize:'0.95rem' }} onClick={() => navigate('/caja')}>
            🔓 Ir a abrir la caja
          </button>
        </div>
      </div>
    )
  }

  return children
}
