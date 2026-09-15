import React from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { RiArrowDownSLine } from '@remixicon/react'
import Tabs from '../../components/Tabs'
import FocusShortcut from '../../components/FocusShortcut'

const TABS = [
  { key: 'agenda', label: 'Agenda', to: 'agenda' },
  { key: 'tarefas', label: 'Tarefas', to: 'tarefas' },
  { key: 'metas', label: 'Metas & Hábitos', to: 'metas' },
]

export default function Planejar() {
  const location = useLocation()
  const navigate = useNavigate()
  // Foco não é mais uma sub-aba (ver App.jsx) — chegar lá pelo personagem,
  // pelo FocusShortcut ou pela nav ainda passa por dentro de <Planejar>,
  // então sem essa checagem o título "Planejar" + abas Agenda/Tarefas/
  // Metas ficavam em cima do Foco, que deveria ser uma tela própria, sem
  // esse cabeçalho estranho por cima.
  const isFoco = location.pathname.endsWith('/foco')
  const current = TABS.find(t => location.pathname.endsWith(`/${t.to}`))?.key || TABS[0].key

  if (isFoco) return <Outlet />

  return (
    <div className="page">
      {/* Mesmo lugar/aparência do Hoje e da Revisão Semanal — sempre antes
          do título da tela, ver FocusShortcut.jsx. */}
      <FocusShortcut />

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
