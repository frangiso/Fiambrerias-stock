import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Ventas from './pages/Ventas.jsx'
import Stock from './pages/Stock.jsx'
import Productos from './pages/Productos.jsx'
import Recetas from './pages/Recetas.jsx'
import Reportes from './pages/Reportes.jsx'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <nav className="sidebar">
          <div className="sidebar-logo">
            <span className="logo-icon">🥩</span>
            <span className="logo-text">Fiambería</span>
          </div>
          <NavLink to="/" end className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}>
            <span>🛒</span> Ventas
          </NavLink>
          <NavLink to="/stock" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}>
            <span>📦</span> Stock
          </NavLink>
          <NavLink to="/productos" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}>
            <span>✏️</span> Productos
          </NavLink>
          <NavLink to="/recetas" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}>
            <span>🍕</span> Recetas
          </NavLink>
          <NavLink to="/reportes" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}>
            <span>📊</span> Reportes
          </NavLink>
        </nav>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Ventas />} />
            <Route path="/stock" element={<Stock />} />
            <Route path="/productos" element={<Productos />} />
            <Route path="/recetas" element={<Recetas />} />
            <Route path="/reportes" element={<Reportes />} />
          </Routes>
        </main>

        <nav className="bottom-nav">
          <NavLink to="/" end className={({isActive}) => isActive ? 'bnav-item active' : 'bnav-item'}>
            <span>🛒</span><small>Ventas</small>
          </NavLink>
          <NavLink to="/stock" className={({isActive}) => isActive ? 'bnav-item active' : 'bnav-item'}>
            <span>📦</span><small>Stock</small>
          </NavLink>
          <NavLink to="/productos" className={({isActive}) => isActive ? 'bnav-item active' : 'bnav-item'}>
            <span>✏️</span><small>Productos</small>
          </NavLink>
          <NavLink to="/recetas" className={({isActive}) => isActive ? 'bnav-item active' : 'bnav-item'}>
            <span>🍕</span><small>Recetas</small>
          </NavLink>
          <NavLink to="/reportes" className={({isActive}) => isActive ? 'bnav-item active' : 'bnav-item'}>
            <span>📊</span><small>Reportes</small>
          </NavLink>
        </nav>
      </div>
    </BrowserRouter>
  )
}
