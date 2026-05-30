import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AuthScreen from './pages/AuthScreen'
import Layout from './components/Layout'
import Home from './pages/Home'
import Cronograma from './pages/Cronograma'
import Todos from './pages/Todos'
import Metas from './pages/Metas'
import Settings from './pages/Settings'

export default function App() {
  const { user } = useAuth()

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
        <Route path="/cronograma" element={<Cronograma />} />
        <Route path="/todos" element={<Todos />} />
        <Route path="/metas" element={<Metas />} />
        <Route path="/config" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
