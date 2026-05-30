import React, { useState, useRef, useEffect } from 'react'
import { exportAll, importAll, listenTodoCategories, saveTodoCategories, listenScheduleCategories, saveScheduleCategories, listenGoalCategories, saveGoalCategories } from '../services/firestore'
import { useAuth } from '../context/AuthContext'
import Toast from '../components/Toast'

export default function Settings() {
  const { user, logout } = useAuth()
  const [toast, setToast] = useState(null)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef()
  const [categories, setCategories] = useState([])
  const [newCat, setNewCat] = useState('')
  const [scheduleCategories, setScheduleCategories] = useState([])
  const [newSchedCatValue, setNewSchedCatValue] = useState('')
  const [newSchedCatLabel, setNewSchedCatLabel] = useState('')
  const [goalCategories, setGoalCategories] = useState([])
  const [newGoalCat, setNewGoalCat] = useState('')

  useEffect(() => {
    const u1 = listenTodoCategories(setCategories)
    const u2 = listenScheduleCategories(setScheduleCategories)
    const u3 = listenGoalCategories(setGoalCategories)
    return () => { u1(); u2(); u3() }
  }, [])

  const addCategory = async () => {
    const v = newCat.trim().toLowerCase()
    if (!v || categories.includes(v)) return
    await saveTodoCategories([...categories, v])
    setNewCat('')
  }

  const removeCategory = async (cat) => {
    await saveTodoCategories(categories.filter(c => c !== cat))
  }

  const addSchedCategory = async () => {
    const v = newSchedCatValue.trim().toLowerCase()
    const l = newSchedCatLabel.trim()
    if (!v || !l || scheduleCategories.some(c => c.value === v)) return
    await saveScheduleCategories([...scheduleCategories, { value: v, label: l }])
    setNewSchedCatValue('')
    setNewSchedCatLabel('')
  }

  const removeSchedCategory = async (val) => {
    await saveScheduleCategories(scheduleCategories.filter(c => c.value !== val))
  }

  const addGoalCategory = async () => {
    const v = newGoalCat.trim().toLowerCase()
    if (!v || goalCategories.includes(v)) return
    await saveGoalCategories([...goalCategories, v])
    setNewGoalCat('')
  }

  const removeGoalCategory = async (cat) => {
    await saveGoalCategories(goalCategories.filter(c => c !== cat))
  }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const handleExport = async () => {
    try {
      const data = await exportAll()
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rotina-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      showToast('Backup exportado com sucesso!')
    } catch (e) {
      showToast('Erro ao exportar: ' + e.message, 'error')
    }
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      await importAll(json)
      showToast('Dados importados com sucesso!')
    } catch (e) {
      showToast('Erro ao importar: verifique o arquivo JSON. ' + e.message, 'error')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <span className="page-kicker">Configurações</span>
        <h1 className="page-title">Configurações</h1>
      </div>

      {/* Account */}
      <div className="settings-section">
        <h2 className="settings-section-title">Conta</h2>
        <div className="settings-row">
          <div className="settings-row-info">
            <h4>Usuário autenticado</h4>
            <p>{user?.email}</p>
          </div>
        </div>
        <div className="settings-row">
          <div className="settings-row-info">
            <h4>UID</h4>
            <p style={{ fontFamily: 'monospace', fontSize: 12 }}>{user?.uid}</p>
          </div>
        </div>
        <div className="settings-row">
          <div className="settings-row-info">
            <h4>Encerrar sessão</h4>
            <p>Você precisará fazer login novamente.</p>
          </div>
          <button className="btn btn-ghost" onClick={logout}>Sair</button>
        </div>
      </div>

      {/* Backup */}
      <div className="settings-section">
        <h2 className="settings-section-title">Backup & Restauração</h2>

        <div className="settings-row">
          <div className="settings-row-info">
            <h4>Exportar tudo</h4>
            <p>Baixa um arquivo JSON com todas as suas inspirações, tarefas, metas e cronograma.</p>
          </div>
          <button className="btn btn-primary" onClick={handleExport}>
            ↓ Exportar JSON
          </button>
        </div>

        <div className="settings-row">
          <div className="settings-row-info">
            <h4>Importar backup</h4>
            <p>Faz upload de um JSON exportado anteriormente. Dados existentes com mesmo ID serão sobrescritos.</p>
          </div>
          {/* marker for categories section injection */}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImport}
            />
            <button
              className="btn btn-ghost"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
            >
              {importing ? 'Importando...' : '↑ Importar JSON'}
            </button>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="settings-section">
        <h2 className="settings-section-title">Categorias de Tarefas</h2>
        <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
          Categorias usadas nas tarefas. Edite à vontade — as mudanças refletem em tempo real.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {categories.map(cat => (
            <div key={cat} className="cat-tag">
              <span>{cat}</span>
              <button className="cat-tag-remove" onClick={() => removeCategory(cat)}>×</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="cat-input"
            value={newCat}
            onChange={e => setNewCat(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCategory()}
            placeholder="Nova categoria..."
          />
          <button className="btn btn-primary" onClick={addCategory}>Adicionar</button>
        </div>
      </div>

      {/* Schedule Categories */}
      <div className="settings-section">
        <h2 className="settings-section-title">Categorias do Cronograma</h2>
        <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
          Categorias usadas nos eventos do cronograma. Cada categoria tem um valor interno e um rótulo exibido.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {scheduleCategories.map(cat => (
            <div key={cat.value} className="cat-tag">
              <span>{cat.label} <em style={{ opacity: 0.5, fontSize: 11 }}>({cat.value})</em></span>
              <button className="cat-tag-remove" onClick={() => removeSchedCategory(cat.value)}>×</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            className="cat-input"
            value={newSchedCatValue}
            onChange={e => setNewSchedCatValue(e.target.value)}
            placeholder="valor (ex: treino)"
            style={{ flex: '1 1 120px' }}
          />
          <input
            className="cat-input"
            value={newSchedCatLabel}
            onChange={e => setNewSchedCatLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSchedCategory()}
            placeholder="rótulo (ex: Treino)"
            style={{ flex: '1 1 120px' }}
          />
          <button className="btn btn-primary" onClick={addSchedCategory}>Adicionar</button>
        </div>
      </div>

      {/* Goal Categories */}
      <div className="settings-section">
        <h2 className="settings-section-title">Categorias das Metas</h2>
        <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
          Categorias usadas nas metas e objetivos.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {goalCategories.map(cat => (
            <div key={cat} className="cat-tag">
              <span>{cat}</span>
              <button className="cat-tag-remove" onClick={() => removeGoalCategory(cat)}>×</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="cat-input"
            value={newGoalCat}
            onChange={e => setNewGoalCat(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addGoalCategory()}
            placeholder="Nova categoria..."
          />
          <button className="btn btn-primary" onClick={addGoalCategory}>Adicionar</button>
        </div>
      </div>

      {/* PWA */}
      <div className="settings-section">
        <h2 className="settings-section-title">App</h2>
        <div className="settings-row">
          <div className="settings-row-info">
            <h4>Instalar como app</h4>
            <p>No mobile: toque em "Adicionar à tela inicial". No desktop: clique no ícone de instalar na barra de endereço.</p>
          </div>
        </div>
        <div className="settings-row">
          <div className="settings-row-info">
            <h4>Versão</h4>
            <p>1.0.0 — Rotina de Alto Desempenho</p>
          </div>
        </div>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  )
}
