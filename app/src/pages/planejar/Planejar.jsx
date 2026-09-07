import React from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { RiArrowDownSLine } from '@remixicon/react'
import Tabs from '../../components/Tabs'

const TABS = [
  { key: 'noturno', label: 'Noturno', to: 'noturno' },
  { key: 'agenda', label: 'Agenda', to: 'agenda' },
  { key: 'tarefas', label: 'Tarefas', to: 'tarefas' },
  { key: 'metas', label: 'Metas', to: 'metas' },
  { key: 'habitos', label: 'Hábitos', to: 'habitos' },
  { key: 'foco', label: 'Foco', to: 'foco' },
  { key: 'alimentacao', label: 'Alimentação', to: 'alimentacao' },
]

export default function Planejar() {
  const location = useLocation()
  const navigate = useNavigate()
  const current = TABS.find(t => location.pathname.endsWith(`/${t.to}`))?.key || TABS[0].key

  return (
    <div className="page">
      <div className="page-header">
        <span className="page-kicker">Organização</span>
        <h1 className="page-title">Planejar</h1>
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
