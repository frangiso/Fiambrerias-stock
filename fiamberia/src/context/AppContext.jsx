import { createContext, useContext, useState, useEffect } from 'react'
import { auth, db } from '../firebase/config.js'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'

const AppContext = createContext()

export function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [rol, setRol] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      setUser(u)
      if (u) await cargarRol(u)
      else setRol(null)
      setAuthLoading(false)
    })
    return unsub
  }, [])

  // El rol se guarda en la colección "usuarios" (doc id = uid).
  // Un usuario nuevo se crea siempre como "cajero" — el rol "admin" solo
  // lo puede otorgar otro admin (o se asigna a mano en Firebase Console
  // la primera vez), así lo exigen las reglas de Firestore.
  async function cargarRol(u) {
    const ref = doc(db, 'usuarios', u.uid)
    const snap = await getDoc(ref)
    if (snap.exists()) {
      setRol(snap.data().rol || 'cajero')
    } else {
      await setDoc(ref, { email: u.email, rol: 'cajero', creadoEn: serverTimestamp() })
      setRol('cajero')
    }
  }

  async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password)
  }

  async function logout() {
    return signOut(auth)
  }

  return (
    <AppContext.Provider value={{ user, rol, isAdmin: rol === 'admin', authLoading, login, logout }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() { return useContext(AppContext) }
