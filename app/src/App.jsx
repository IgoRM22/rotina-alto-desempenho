import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useWeekArchive } from './hooks/useWeekArchive'
import AuthScreen from './pages/AuthScreen'
import Layout from './components/Layout'
import Home from './pages/Home'
import Planejar from './pages/planejar/Planejar'
import Noturno from './pages/planejar/Noturno'
import Agenda from './pages/planejar/Agenda'
import Tarefas from './pages/planejar/Tarefas'
import PlanejarMetas from './pages/planejar/Metas'
import Habitos from './pages/planejar/Habitos'
import Revisao from './pages/planejar/Revisao'
import Settings from './pages/Settings'
import Notes from './pages/Notes'
import Finances from './pages/Finances'

export default function App() {
  const { user } = useAuth()

  useWeekArchive(!!user)

  if (user === undefined) {
    return (
      <div className="auth-screen">
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>Carregando...</div>
      </div>
    )
  }

  if (!user) return <AuthScreen />

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />

        <Route path="/planejar" element={<Planejar />}>
          <Route index element={<Navigate to="noturno" replace />} />
          <Route path="noturno" element={<Noturno />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="tarefas" element={<Tarefas />} />
          <Route path="metas" element={<PlanejarMetas />} />
          <Route path="habitos" element={<Habitos />} />
          <Route path="revisao" element={<Revisao />} />
        </Route>

        <Route path="/notes" element={<Notes />} />
        <Route path="/financas" element={<Finances />} />
        <Route path="/config" element={<Settings />} />

        {/* redirects de rotas antigas — mantém atalhos/PWA instalado funcionando */}
        <Route path="/cronograma" element={<Navigate to="/planejar/agenda" replace />} />
        <Route path="/todos" element={<Navigate to="/planejar/tarefas" replace />} />
        <Route path="/metas" element={<Navigate to="/planejar/metas" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
