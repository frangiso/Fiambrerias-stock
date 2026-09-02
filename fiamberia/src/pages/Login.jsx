import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'

const ERRORES_FIREBASE = {
  'auth/email-already-in-use': 'Ese email ya tiene una cuenta creada',
  'auth/invalid-email': 'El email no es válido',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
  'auth/invalid-credential': 'Email o contraseña incorrectos',
  'auth/user-not-found': 'No hay ninguna cuenta con ese email',
}

export default function Login() {
  const { login, registro, resetPassword } = useApp()
  const [modo, setModo] = useState('login') // 'login' | 'registro' | 'recuperar'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  function cambiarModo(m) {
    setModo(m); setError(''); setInfo(''); setPassword(''); setPassword2('')
  }

  async function handleLogin(e) {
    e.preventDefault()
    setError(''); setInfo('')
    setLoading(true)
    try {
      if (modo === 'registro') {
        if (password !== password2) { setError('Las contraseñas no coinciden'); setLoading(false); return }
        if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); setLoading(false); return }
        await registro(email, password)
      } else if (modo === 'recuperar') {
        await resetPassword(email)
        setInfo('Te enviamos un email para restablecer la contraseña. Revisá tu bandeja de entrada (y spam).')
      } else {
        await login(email, password)
      }
    } catch (err) {
      setError(ERRORES_FIREBASE[err.code] || (modo === 'registro' ? 'No se pudo crear la cuenta' : modo === 'recuperar' ? 'No se pudo enviar el email' : 'Email o contraseña incorrectos'))
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
        {modo === 'registro' && (
          <div style={{ background:'#EFF6F0', border:'1px solid #BFE0C8', color:'#2A5C45', padding:'10px 14px', borderRadius:10, fontSize:'0.8rem', marginBottom:16 }}>
            💡 La cuenta se crea con rol <strong>cajero</strong>. Para dar permisos de administrador hay que cambiarlo desde Firestore (colección "usuarios") o pedírselo a otro admin.
          </div>
        )}
        {info && (
          <div style={{ background:'#EFF6F0', border:'1px solid #BFE0C8', color:'#2A5C45', padding:'10px 14px', borderRadius:10, fontSize:'0.85rem', marginBottom:16 }}>
            {info}
          </div>
        )}
        {error && (
          <div style={{ background:'#FDECEA', border:'1px solid #F5A0A0', color:'#C0392B', padding:'10px 14px', borderRadius:10, fontSize:'0.85rem', marginBottom:16 }}>
            {error}
          </div>
        )}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: modo==='recuperar' ? 24 : 14 }}>
            <label style={{ display:'block', fontSize:'0.75rem', fontWeight:700, color:'#8A8070', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:5 }}>Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              style={{ width:'100%', padding:'11px 13px', border:'1.5px solid #E2D9C8', borderRadius:10, fontSize:'0.93rem', outline:'none' }}
              placeholder="usuario@email.com" />
          </div>
          {modo !== 'recuperar' && (
            <div style={{ marginBottom: modo==='registro' ? 14 : 24 }}>
              <label style={{ display:'block', fontSize:'0.75rem', fontWeight:700, color:'#8A8070', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:5 }}>Contraseña</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                style={{ width:'100%', padding:'11px 13px', border:'1.5px solid #E2D9C8', borderRadius:10, fontSize:'0.93rem', outline:'none' }}
                placeholder="••••••••" />
            </div>
          )}
          {modo === 'registro' && (
            <div style={{ marginBottom:24 }}>
              <label style={{ display:'block', fontSize:'0.75rem', fontWeight:700, color:'#8A8070', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:5 }}>Repetir contraseña</label>
              <input type="password" required value={password2} onChange={e => setPassword2(e.target.value)}
                style={{ width:'100%', padding:'11px 13px', border:'1.5px solid #E2D9C8', borderRadius:10, fontSize:'0.93rem', outline:'none' }}
                placeholder="••••••••" />
            </div>
          )}
          {modo === 'login' && (
            <div style={{ textAlign:'right', marginTop:-14, marginBottom:20 }}>
              <button type="button" onClick={() => cambiarModo('recuperar')} style={{ background:'none', border:'none', color:'#8A8070', fontSize:'0.78rem', cursor:'pointer', padding:0 }}>¿Olvidaste tu contraseña?</button>
            </div>
          )}
          <button type="submit" disabled={loading}
            style={{ width:'100%', padding:'13px', background:'#2A5C45', color:'white', border:'none', borderRadius:10, fontSize:'0.95rem', fontWeight:700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading
              ? (modo==='registro' ? 'Creando cuenta...' : modo==='recuperar' ? 'Enviando...' : 'Ingresando...')
              : (modo==='registro' ? 'Crear cuenta' : modo==='recuperar' ? 'Enviar email de recuperación' : 'Ingresar')}
          </button>
        </form>
        <p style={{ textAlign:'center', marginTop:18, fontSize:'0.83rem', color:'#8A8070' }}>
          {modo === 'login' && (
            <>¿No tenés cuenta? <button type="button" onClick={() => cambiarModo('registro')} style={{ background:'none', border:'none', color:'#2A5C45', fontWeight:700, cursor:'pointer', padding:0, fontSize:'inherit' }}>Creá una acá</button></>
          )}
          {modo === 'registro' && (
            <>¿Ya tenés cuenta? <button type="button" onClick={() => cambiarModo('login')} style={{ background:'none', border:'none', color:'#2A5C45', fontWeight:700, cursor:'pointer', padding:0, fontSize:'inherit' }}>Iniciá sesión</button></>
          )}
          {modo === 'recuperar' && (
            <>¿Te acordaste? <button type="button" onClick={() => cambiarModo('login')} style={{ background:'none', border:'none', color:'#2A5C45', fontWeight:700, cursor:'pointer', padding:0, fontSize:'inherit' }}>Iniciá sesión</button></>
          )}
        </p>
      </div>
    </div>
  )
}
