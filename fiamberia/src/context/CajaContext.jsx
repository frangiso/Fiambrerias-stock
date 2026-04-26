import { createContext, useContext, useState, useEffect } from 'react'
import { getCajaDelDia } from '../firebase/db.js'

const CajaContext = createContext()

function getFechaHoy() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`
}

export function CajaProvider({ children }) {
  const [cajaAbierta, setCajaAbierta] = useState(false)
  const [cajaLoading, setCajaLoading] = useState(true)

  useEffect(() => { verificarCaja() }, [])

  async function verificarCaja() {
    setCajaLoading(true)
    try {
      const hoy = getFechaHoy()
      const movs = await getCajaDelDia(hoy, true)
      const apertura = movs.find(m => m.tipo === 'apertura')
      const ultimo   = movs[movs.length - 1]
      const cerrada  = !!(ultimo && ultimo.tipo === 'cierre')
      setCajaAbierta(!!apertura && !cerrada)
    } catch {
      setCajaAbierta(false)
    }
    setCajaLoading(false)
  }

  return (
    <CajaContext.Provider value={{ cajaAbierta, cajaLoading, verificarCaja }}>
      {children}
    </CajaContext.Provider>
  )
}

export function useCaja() { return useContext(CajaContext) }
