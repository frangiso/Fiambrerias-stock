import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext.jsx'
import { CajaProvider } from './context/CajaContext.jsx'
import CajaGuard from './components/CajaGuard.jsx'
import NotificationBell from './components/NotificationBell.jsx'
import Login from './pages/Login.jsx'
import Ventas from './pages/Ventas.jsx'
import Stock from './pages/Stock.jsx'
import Productos from './pages/Productos.jsx'
import Recetas from './pages/Recetas.jsx'
import Rubros from './pages/Rubros.jsx'
import Caja from './pages/Caja.jsx'
import Compras from './pages/Compras.jsx'
import Reportes from './pages/Reportes.jsx'
import Movimientos from './pages/Movimientos.jsx'
import Clientes from './pages/Clientes.jsx'
import Usuarios from './pages/Usuarios.jsx'
import './App.css'

function AppInner() {
  const { user, authLoading, logout, isAdmin } = useApp()

  if (authLoading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#F0EDE6' }}>
      <div style={{ fontSize:'2rem' }}>🥩</div>
    </div>
  )

  if (!user) return <Login />

  return (
    <div className="app-layout">
      <NotificationBell />
      <nav className="sidebar">
        <div className="sidebar-logo">
          <span className="logo-icon">🥩</span>
          <span className="logo-text">La Picadita</span>
        </div>
        <div className="nav-section">Operación</div>
        <NavLink to="/" end className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}><span>🛒</span> Ventas</NavLink>
        <NavLink to="/caja" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}><span>💰</span> Caja</NavLink>
        {isAdmin && <>
          <NavLink to="/compras" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}><span>🛒</span> Compras</NavLink>
          <NavLink to="/stock" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}><span>📦</span> Stock</NavLink>
          <NavLink to="/clientes" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}><span>🧾</span> Clientes</NavLink>
          <div className="nav-section">Gestión</div>
          <NavLink to="/productos" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}><span>✏️</span> Productos</NavLink>
          <NavLink to="/rubros" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}><span>🏷️</span> Rubros</NavLink>
          <NavLink to="/recetas" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}><span>🍕</span> Recetas</NavLink>
          <NavLink to="/reportes" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}><span>📊</span> Reportes</NavLink>
          <NavLink to="/movimientos" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}><span>🕵️</span> Movimientos</NavLink>
          <NavLink to="/usuarios" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}><span>👤</span> Usuarios</NavLink>
        </>}
        <div style={{ marginTop:'auto', padding:'12px 0' }}>
          <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.35)', padding:'0 12px', marginBottom:6 }}>{user.email}</div>
          <button onClick={logout} className="nav-link" style={{ color:'rgba(255,255,255,0.45)', width:'100%', textAlign:'left' }}>
            <span>🚪</span> Cerrar sesión
          </button>
        </div>
      </nav>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<CajaGuard accion="registrar ventas"><Ventas /></CajaGuard>} />
          <Route path="/caja" element={<Caja />} />
          <Route path="/compras" element={isAdmin ? <CajaGuard accion="registrar compras"><Compras /></CajaGuard> : <Navigate to="/" />} />
          <Route path="/stock" element={isAdmin ? <Stock /> : <Navigate to="/" />} />
          <Route path="/clientes" element={isAdmin ? <Clientes /> : <Navigate to="/" />} />
          <Route path="/productos" element={isAdmin ? <Productos /> : <Navigate to="/" />} />
          <Route path="/rubros" element={isAdmin ? <Rubros /> : <Navigate to="/" />} />
          <Route path="/recetas" element={isAdmin ? <Recetas /> : <Navigate to="/" />} />
          <Route path="/reportes" element={isAdmin ? <Reportes /> : <Navigate to="/" />} />
          <Route path="/movimientos" element={isAdmin ? <Movimientos /> : <Navigate to="/" />} />
          <Route path="/usuarios" element={isAdmin ? <Usuarios /> : <Navigate to="/" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      <nav className="bottom-nav">
        <NavLink to="/" end className={({isActive}) => isActive ? 'bnav-item active' : 'bnav-item'}><span>🛒</span><small>Ventas</small></NavLink>
        <NavLink to="/caja" className={({isActive}) => isActive ? 'bnav-item active' : 'bnav-item'}><span>💰</span><small>Caja</small></NavLink>
        {isAdmin && <>
          <NavLink to="/compras" className={({isActive}) => isActive ? 'bnav-item active' : 'bnav-item'}><span>🛍️</span><small>Compras</small></NavLink>
          <NavLink to="/stock" className={({isActive}) => isActive ? 'bnav-item active' : 'bnav-item'}><span>📦</span><small>Stock</small></NavLink>
          <NavLink to="/clientes" className={({isActive}) => isActive ? 'bnav-item active' : 'bnav-item'}><span>🧾</span><small>Clientes</small></NavLink>
          <NavLink to="/productos" className={({isActive}) => isActive ? 'bnav-item active' : 'bnav-item'}><span>✏️</span><small>Productos</small></NavLink>
          <NavLink to="/rubros" className={({isActive}) => isActive ? 'bnav-item active' : 'bnav-item'}><span>🏷️</span><small>Rubros</small></NavLink>
          <NavLink to="/recetas" className={({isActive}) => isActive ? 'bnav-item active' : 'bnav-item'}><span>🍕</span><small>Recetas</small></NavLink>
          <NavLink to="/reportes" className={({isActive}) => isActive ? 'bnav-item active' : 'bnav-item'}><span>📊</span><small>Reportes</small></NavLink>
          <NavLink to="/movimientos" className={({isActive}) => isActive ? 'bnav-item active' : 'bnav-item'}><span>🕵️</span><small>Movimientos</small></NavLink>
        </>}
      </nav>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <CajaProvider>
          <AppInner />
        </CajaProvider>
      </BrowserRouter>
    </AppProvider>
  )
}
