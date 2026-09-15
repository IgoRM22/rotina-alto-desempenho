import React from 'react'
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import { RiArrowDownSLine, RiTimerLine } from '@remixicon/react'
import Tabs from '../../components/Tabs'

const TABS = [
  { key: 'agenda', label: 'Agenda', to: 'agenda' },
  { key: 'tarefas', label: 'Tarefas', to: 'tarefas' },
  { key: 'metas', label: 'Metas & Hábitos', to: 'metas' },
]

export default function Planejar() {
  const location = useLocation()
  const navigate = useNavigate()
  const current = TABS.find(t => location.pathname.endsWith(`/${t.to}`))?.key || TABS[0].key

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <span className="page-kicker">Organização</span>
          <h1 className="page-title">Planejar</h1>
        </div>
        <Link to="/planejar/foco" className="hero-focus-card">
          <span className="hero-focus-icon"><RiTimerLine size={20} /></span>
          <span className="hero-focus-text">
            <span className="hero-focus-title">Iniciar foco</span>
            <span className="hero-focus-sub">cada minuto conta para uma meta</span>
          </span>
        </Link>
      </div>

      {/* Sete sub-abas era demais pra rolar horizontalmente no mobile —
          uma lista suspensa é mais rápida de usar com o polegar. No
          desktop tem espaço de sobra, então mantém as abas normais. */}
      <div className="planejar-subnav-select-wrap">
        <select
          className="planejar-subnav-select"
          value={current}
          onChange={e => navigate(TABS.find(t => t.key === e.target.value)?.to || TABS[0].to)}
        >
          {TABS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <RiArrowDownSLine size={18} className="planejar-subnav-select-chevron" aria-hidden="true" />
      </div>

      <div className="planejar-subnav-tabs">
        <Tabs items={TABS} as="link" scroll />
      </div>

      <Outlet />
    </div>
  )
}
