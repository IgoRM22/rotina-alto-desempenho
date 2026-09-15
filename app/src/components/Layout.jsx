import React from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  RiCalendarScheduleLine,
  RiHome5Line,
  RiLogoutBoxRLine,
  RiSettings3Line,
  RiStickyNoteLine,
  RiMoneyDollarCircleLine,
  RiTimerLine,
} from '@remixicon/react'
import { loadStoredFocusSession, startLocalPomodoroSession } from '../utils/focusSession'

const NAV_ITEMS = [
  { to: '/', end: true, icon: RiHome5Line, label: 'Hoje' },
  { to: '/planejar', end: false, icon: RiCalendarScheduleLine, label: 'Planejar' },
  { to: '/notes', end: false, icon: RiStickyNoteLine, label: 'Notas' },
  { to: '/financas', end: false, icon: RiMoneyDollarCircleLine, label: 'Finanças' },
]
import { useAuth } from '../context/AuthContext'
import BoltIcon from './BoltIcon'
import AssistantFab from './AssistantFab'
import WhatsNewModal from './WhatsNewModal'

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  // Foco saiu do menu do Planejar — vira um atalho direto na nav: se já não
  // tem sessão rodando, começa um pomodoro na hora (mesmo mecanismo que o
  // assistente usa pelo chat, ver utils/focusSession.js); se já tem uma
  // rodando, só leva pra tela de Foco em vez de substituir o que já estava
  // em andamento.
  const goToFocus = () => {
    if (!loadStoredFocusSession()) startLocalPomodoroSession()
    navigate('/planejar/foco')
  }
  // Só a seção de topo entra na key (ex: "/planejar"), não o caminho
  // inteiro — trocar de Noturno pra Agenda pra Tarefas é a MESMA seção,
  // então não precisa remontar tudo (cabeçalho, abas) e piscar a cada
  // clique. Só remonta de verdade ao trocar de seção (Hoje → Planejar).
  const section = '/' + (location.pathname.split('/')[1] || '')

  const handleLogout = () => {
    if (window.confirm('Tem certeza que deseja sair do app?')) logout()
  }

  return (
    <div className="app-layout">
      <nav className="nav">
        <NavLink to="/" className="nav-brand">
          <BoltIcon size={17} /> <span>RaioDesk</span>
        </NavLink>

        <ul className="nav-links">
          <li><NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>Hoje</NavLink></li>
          <li><NavLink to="/planejar" className={({ isActive }) => isActive ? 'active' : ''}>Planejar</NavLink></li>
          <li>
            <button type="button" className="nav-pomodoro-btn" onClick={goToFocus} title="Iniciar pomodoro">
              <RiTimerLine size={15} aria-hidden="true" />
            </button>
          </li>
          <li><NavLink to="/notes" className={({ isActive }) => isActive ? 'active' : ''}>Notas</NavLink></li>
          <li><NavLink to="/financas" className={({ isActive }) => isActive ? 'active' : ''}>Finanças</NavLink></li>
        </ul>

        <div className="nav-right">
          <span className="nav-user">{user?.email}</span>
          <NavLink to="/config" className={({ isActive }) => `btn-icon nav-settings ${isActive ? 'active' : ''}`} aria-label="Ajustes" title="Ajustes">
            <RiSettings3Line size={17} />
          </NavLink>
          <button className="btn-logout btn-icon" onClick={handleLogout} aria-label="Sair">
            <RiLogoutBoxRLine size={16} />
          </button>
        </div>
      </nav>

      {/* Sidebar só existe (visualmente) a partir de 1024px — em telas
          estreitas o topo + a nav inferior já resolvem bem, então a sidebar
          fica escondida via CSS em vez de duplicar lógica de navegação. */}
      <nav className="sidebar">
        <NavLink to="/" className="sidebar-brand">
          <BoltIcon size={19} /> <span>RaioDesk</span>
        </NavLink>

        <ul className="sidebar-links">
          {NAV_ITEMS.map(({ to, end, icon: Icon, label }) => (
            <React.Fragment key={to}>
              <li>
                <NavLink to={to} end={end} className={({ isActive }) => isActive ? 'active' : ''}>
                  <Icon size={18} aria-hidden="true" />
                  <span>{label}</span>
                </NavLink>
              </li>
              {to === '/planejar' && (
                <li>
                  <button type="button" className="sidebar-footer-btn nav-pomodoro-btn" onClick={goToFocus}>
                    <RiTimerLine size={16} aria-hidden="true" /> <span>Pomodoro</span>
                  </button>
                </li>
              )}
            </React.Fragment>
          ))}
        </ul>

        <div className="sidebar-footer">
          <span className="sidebar-user" title={user?.email}>{user?.email}</span>
          <NavLink to="/config" className={({ isActive }) => `sidebar-footer-btn ${isActive ? 'active' : ''}`}>
            <RiSettings3Line size={16} aria-hidden="true" /> <span>Ajustes</span>
          </NavLink>
          <button className="sidebar-footer-btn" onClick={handleLogout}>
            <RiLogoutBoxRLine size={16} aria-hidden="true" /> <span>Sair</span>
          </button>
        </div>
      </nav>

      <main key={section} className="page-fade">
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
          <li><button type="button" className="mobile-nav-pomodoro" onClick={goToFocus}>
            <span className="mobile-nav-icon"><RiTimerLine size={18} aria-hidden="true" /></span>
            <span className="mobile-nav-label">Pomodoro</span>
          </button></li>
          <li><NavLink to="/notes" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="mobile-nav-icon"><RiStickyNoteLine size={18} aria-hidden="true" /></span>
            <span className="mobile-nav-label">Notas</span>
          </NavLink></li>
          <li><NavLink to="/financas" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="mobile-nav-icon"><RiMoneyDollarCircleLine size={18} aria-hidden="true" /></span>
            <span className="mobile-nav-label">Finanças</span>
          </NavLink></li>
        </ul>
      </nav>

      <AssistantFab />
      <WhatsNewModal />
    </div>
  )
}
