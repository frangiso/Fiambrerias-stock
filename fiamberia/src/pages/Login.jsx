import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'

export default function Login() {
  const { login } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
    } catch {
      setError('Email o contraseña incorrectos')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F0EDE6' }}>
      <div style={{ background:'white', borderRadius:20, padding:40, width:'100%', maxWidth:380, boxShadow:'0 8px 32px rgba(0,0,0,0.1)', border:'1px solid #E2D9C8' }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontSize:'2.5rem', marginBottom:8 }}>🥩</div>
          <h1 style={{ fontFamily:'serif', fontSize:'1.6rem', fontWeight:800, marginBottom:4 }}>Fiambería La Picadita</h1>
          <p style={{ color:'#8A8070', fontSize:'0.85rem' }}>Sistema de Stock y Ventas</p>
        </div>
        {error && (
          <div style={{ background:'#FDECEA', border:'1px solid #F5A0A0', color:'#C0392B', padding:'10px 14px', borderRadius:10, fontSize:'0.85rem', marginBottom:16 }}>
            {error}
          </div>
        )}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:'0.75rem', fontWeight:700, color:'#8A8070', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:5 }}>Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              style={{ width:'100%', padding:'11px 13px', border:'1.5px solid #E2D9C8', borderRadius:10, fontSize:'0.93rem', outline:'none' }}
              placeholder="usuario@email.com" />
          </div>
          <div style={{ marginBottom:24 }}>
            <label style={{ display:'block', fontSize:'0.75rem', fontWeight:700, color:'#8A8070', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:5 }}>Contraseña</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              style={{ width:'100%', padding:'11px 13px', border:'1.5px solid #E2D9C8', borderRadius:10, fontSize:'0.93rem', outline:'none' }}
              placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading}
            style={{ width:'100%', padding:'13px', background:'#2A5C45', color:'white', border:'none', borderRadius:10, fontSize:'0.95rem', fontWeight:700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
