import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  RiCalendarScheduleLine,
  RiFlashlightFill,
  RiHome5Line,
  RiLogoutBoxRLine,
  RiSettings3Line,
  RiStickyNoteLine,
  RiMoneyDollarCircleLine,
} from '@remixicon/react'
import { useAuth } from '../context/AuthContext'

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const location = useLocation()

  return (
    <div className="app-layout">
      <nav className="nav">
        <NavLink to="/" className="nav-brand">
          <RiFlashlightFill size={16} style={{ color: 'var(--coral)' }} aria-hidden="true" /> Raio
        </NavLink>

        <ul className="nav-links">
          <li><NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>Hoje</NavLink></li>
          <li><NavLink to="/planejar" className={({ isActive }) => isActive ? 'active' : ''}>Planejar</NavLink></li>
          <li><NavLink to="/notes" className={({ isActive }) => isActive ? 'active' : ''}>Notas</NavLink></li>
          <li><NavLink to="/financas" className={({ isActive }) => isActive ? 'active' : ''}>Finanças</NavLink></li>
          <li><NavLink to="/config" className={({ isActive }) => isActive ? 'active' : ''}>Ajustes</NavLink></li>
        </ul>

        <div className="nav-right">
          <span className="nav-user">{user?.email}</span>
          <button className="btn-logout btn-icon" onClick={logout} aria-label="Sair">
            <RiLogoutBoxRLine size={16} />
          </button>
        </div>
      </nav>

      <main key={location.pathname} className="page-fade">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="mobile-nav">
        <ul className="mobile-nav-list">
          <li><NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="mobile-nav-icon"><RiHome5Line size={18} aria-hidden="true" /></span>
            <span className="mobile-nav-label">Hoje</span>
          </NavLink></li>
          <li><NavLink to="/planejar" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="mobile-nav-icon"><RiCalendarScheduleLine size={18} aria-hidden="true" /></span>
            <span className="mobile-nav-label">Planejar</span>
          </NavLink></li>
          <li><NavLink to="/notes" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="mobile-nav-icon"><RiStickyNoteLine size={18} aria-hidden="true" /></span>
            <span className="mobile-nav-label">Notas</span>
          </NavLink></li>
          <li><NavLink to="/financas" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="mobile-nav-icon"><RiMoneyDollarCircleLine size={18} aria-hidden="true" /></span>
            <span className="mobile-nav-label">Finanças</span>
          </NavLink></li>
          <li><NavLink to="/config" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="mobile-nav-icon"><RiSettings3Line size={18} aria-hidden="true" /></span>
            <span className="mobile-nav-label">Ajustes</span>
          </NavLink></li>
        </ul>
      </nav>
    </div>
  )
}
