import React from 'react'
import { NavLink } from 'react-router-dom'
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
          <button className="btn-logout" onClick={logout}>Sair</button>
        </div>
      </nav>

      <main>
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="mobile-nav">
        <ul className="mobile-nav-list">
          <li><NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="mobile-nav-icon">✦</span>Home
          </NavLink></li>
          <li><NavLink to="/cronograma" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="mobile-nav-icon">⊞</span>Agenda
          </NavLink></li>
          <li><NavLink to="/todos" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="mobile-nav-icon">☑</span>Tarefas
          </NavLink></li>
          <li><NavLink to="/metas" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="mobile-nav-icon">◎</span>Metas
          </NavLink></li>
          <li><NavLink to="/notes" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="mobile-nav-icon">✎</span>Notes
          </NavLink></li>
          <li><NavLink to="/config" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="mobile-nav-icon">⚙</span>Config
          </NavLink></li>
        </ul>
      </nav>
    </div>
  )
}
