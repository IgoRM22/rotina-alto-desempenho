import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  RiCalendarScheduleLine,
  RiCheckboxCircleLine,
  RiFlag2Line,
  RiHome5Line,
  RiLogoutBoxRLine,
  RiSettings3Line,
  RiStickyNoteLine,
} from '@remixicon/react'
import { useAuth } from '../context/AuthContext'

export default function Layout({ children }) {
  const { user, logout } = useAuth()

  return (
    <div className="app-layout">
      <nav className="nav">
        <NavLink to="/" className="nav-brand">Rotina ↗</NavLink>

        <ul className="nav-links">
          <li><NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>Home</NavLink></li>
          <li><NavLink to="/cronograma" className={({ isActive }) => isActive ? 'active' : ''}>Cronograma</NavLink></li>
          <li><NavLink to="/todos" className={({ isActive }) => isActive ? 'active' : ''}>Tarefas</NavLink></li>
          <li><NavLink to="/metas" className={({ isActive }) => isActive ? 'active' : ''}>Metas</NavLink></li>
          <li><NavLink to="/notes" className={({ isActive }) => isActive ? 'active' : ''}>Notes</NavLink></li>
          <li><NavLink to="/config" className={({ isActive }) => isActive ? 'active' : ''}>Config</NavLink></li>
        </ul>

        <div className="nav-right">
          <span className="nav-user">{user?.email}</span>
          <button className="btn-logout btn-icon" onClick={logout} aria-label="Sair">
            <RiLogoutBoxRLine size={16} />
          </button>
        </div>
      </nav>

      <main>
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="mobile-nav">
        <ul className="mobile-nav-list">
          <li><NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="mobile-nav-icon"><RiHome5Line size={18} aria-hidden="true" /></span>
            <span className="mobile-nav-label">Home</span>
          </NavLink></li>
          <li><NavLink to="/cronograma" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="mobile-nav-icon"><RiCalendarScheduleLine size={18} aria-hidden="true" /></span>
            <span className="mobile-nav-label">Agenda</span>
          </NavLink></li>
          <li><NavLink to="/todos" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="mobile-nav-icon"><RiCheckboxCircleLine size={18} aria-hidden="true" /></span>
            <span className="mobile-nav-label">Tarefas</span>
          </NavLink></li>
          <li><NavLink to="/metas" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="mobile-nav-icon"><RiFlag2Line size={18} aria-hidden="true" /></span>
            <span className="mobile-nav-label">Metas</span>
          </NavLink></li>
          <li><NavLink to="/notes" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="mobile-nav-icon"><RiStickyNoteLine size={18} aria-hidden="true" /></span>
            <span className="mobile-nav-label">Notas</span>
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
