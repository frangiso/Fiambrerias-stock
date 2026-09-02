import { useState, useEffect } from 'react'
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { useApp } from '../context/AppContext.jsx'

export default function Usuarios() {
  const { user } = useApp()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const snap = await getDocs(collection(db, 'usuarios'))
    setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    setLoading(false)
  }

  async function cambiarRol(u, nuevoRol) {
    if (u.id === user.uid && nuevoRol !== 'admin') {
      mostrarToast('No podés quitarte el rol de admin a vos mismo', 'danger')
      return
    }
    await updateDoc(doc(db, 'usuarios', u.id), { rol: nuevoRol })
    mostrarToast('✅ Rol actualizado', 'success')
    cargar()
  }

  function mostrarToast(msg, tipo) { setToast({ msg, tipo }); setTimeout(() => setToast(null), 3000) }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Usuarios</h1>
        <p className="page-subtitle">Gestioná quién puede hacer operaciones sensibles (borrar, aumentos masivos, anular ventas)</p>
      </div>

      <div className="alert alert-warning">
        💡 Un usuario nuevo aparece acá recién después de iniciar sesión por primera vez, y empieza siempre como <strong>cajero</strong>. Solo otro admin puede ascenderlo.
      </div>

      <div className="card" style={{ padding:0 }}>
        <div className="table-wrap">
          {loading ? <div className="loading">Cargando...</div>
          : usuarios.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">👤</div><p>Todavía no hay usuarios registrados.</p></div>
          ) : (
            <table>
              <thead><tr><th>Email</th><th>Rol</th><th></th></tr></thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight:600 }}>{u.email}{u.id===user.uid && <span style={{ color:'var(--muted)', fontWeight:400 }}> (vos)</span>}</td>
                    <td><span className={`badge ${u.rol==='admin'?'badge-ok':'badge-warning'}`}>{u.rol}</span></td>
                    <td>
                      {u.rol === 'admin'
                        ? <button className="btn btn-sm btn-outline" onClick={() => cambiarRol(u, 'cajero')}>Quitar admin</button>
                        : <button className="btn btn-sm btn-primary" onClick={() => cambiarRol(u, 'admin')}>Hacer admin</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {toast && <div className={`toast toast-${toast.tipo}`}>{toast.msg}</div>}
    </div>
  )
}
