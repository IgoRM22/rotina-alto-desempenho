import React from 'react'
import { Outlet } from 'react-router-dom'
import Tabs from '../../components/Tabs'

const TABS = [
  { key: 'noturno', label: 'Noturno', to: 'noturno' },
  { key: 'agenda', label: 'Agenda', to: 'agenda' },
  { key: 'tarefas', label: 'Tarefas', to: 'tarefas' },
  { key: 'metas', label: 'Metas', to: 'metas' },
  { key: 'habitos', label: 'Hábitos', to: 'habitos' },
  { key: 'revisao', label: 'Revisão', to: 'revisao' },
]

export default function Planejar() {
  return (
    <div className="page">
      <div className="page-header">
        <span className="page-kicker">Organização</span>
        <h1 className="page-title">Planejar</h1>
      </div>

      <Tabs items={TABS} as="link" scroll />

      <Outlet />
    </div>
  )
}
