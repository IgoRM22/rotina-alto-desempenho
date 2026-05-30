import React, { useState, useEffect } from 'react'
import { listenGoals, addGoal, updateGoal, deleteGoal } from '../services/firestore'
import Modal from '../components/Modal'
import Toast from '../components/Toast'

const TIMEFRAMES = ['Esta semana', 'Este mês', 'Este trimestre', 'Este ano', 'Longo prazo']
const CATEGORIES = ['projeto', 'saude', 'corp', 'estudo', 'familia', 'pessoal']

const EMPTY_FORM = { title: '', description: '', timeframe: 'Este mês', category: 'projeto', progress: 0, targetDate: '' }

export default function Metas() {
  const [goals, setGoals] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [toast, setToast] = useState(null)
  const [filter, setFilter] = useState('Todos')

  useEffect(() => {
    const unsub = listenGoals(setGoals)
    return unsub
  }, [])

  const filters = ['Todos', ...TIMEFRAMES]
  const filtered = filter === 'Todos' ? goals : goals.filter(g => g.timeframe === filter)

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const openEdit = (item) => {
    setEditing(item)
    setForm({
      title: item.title,
      description: item.description || '',
      timeframe: item.timeframe || 'Este mês',
      category: item.category || 'projeto',
      progress: item.progress || 0,
      targetDate: item.targetDate || '',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) return
    try {
      const data = { ...form, progress: Number(form.progress) }
      if (editing) {
        await updateGoal(editing.id, data)
        showToast('Meta atualizada!')
      } else {
        await addGoal(data)
        showToast('Meta adicionada!')
      }
      setShowModal(false)
    } catch {
      showToast('Erro ao salvar.', 'error')
    }
  }

  const handleDelete = async (id) => {
    await deleteGoal(id)
    showToast('Removido.')
  }

  const toggleDone = async (goal) => {
    await updateGoal(goal.id, { done: !goal.done, progress: goal.done ? goal.progress : 100 })
  }

  const updateProgress = async (goal, value) => {
    await updateGoal(goal.id, { progress: Number(value) })
  }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const done = goals.filter(g => g.done).length

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <span className="page-kicker">Metas & Objetivos</span>
          <h1 className="page-title">Metas</h1>
          {goals.length > 0 && (
            <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 8 }}>
              {done} de {goals.length} concluídas
            </p>
          )}
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Nova meta</button>
      </div>

      <div className="tabs goals-tabs">
        {filters.map(f => (
          <button key={f} className={`tab-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>

      <div>
        {filtered.map(goal => (
          <div key={goal.id} className="goal-item">
            <div className="goal-header">
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span className={`pill pill-${goal.category || 'pessoal'}`}>{goal.category}</span>
                  {goal.timeframe && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{goal.timeframe}</span>}
                  {goal.targetDate && <span style={{ fontSize: 11, color: 'var(--text3)' }}>→ {goal.targetDate}</span>}
                </div>
                <h3 className={`goal-title ${goal.done ? 'done' : ''}`}>{goal.title}</h3>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button
                  className={`btn btn-sm ${goal.done ? 'btn-ghost' : 'btn-primary'}`}
                  onClick={() => toggleDone(goal)}
                  title={goal.done ? 'Reabrir' : 'Concluir'}
                >
                  {goal.done ? '↩ reabrir' : '✓ concluir'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(goal)}>editar</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(goal.id)}>×</button>
              </div>
            </div>

            {goal.description && <p className="goal-desc">{goal.description}</p>}

            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${goal.progress || 0}%` }} />
            </div>
            <div className="progress-label">
              <span>Progresso</span>
              <span>{goal.progress || 0}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={goal.progress || 0}
              onChange={e => updateProgress(goal, e.target.value)}
              style={{ width: '100%', marginTop: 8, accentColor: 'var(--coral)', cursor: 'pointer' }}
            />
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">◎</div>
            Nenhuma meta aqui.
          </div>
        )}
      </div>

      {showModal && (
        <Modal
          title={editing ? 'Editar meta' : 'Nova meta'}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        >
          <div className="field">
            <label>Título</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Qual é a meta?" />
          </div>
          <div className="field">
            <label>Descrição</label>
            <textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Prazo</label>
              <select value={form.timeframe} onChange={e => setForm(f => ({ ...f, timeframe: e.target.value }))}>
                {TIMEFRAMES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Categoria</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Data alvo (opcional)</label>
            <input type="date" value={form.targetDate} onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))} />
          </div>
          <div className="field">
            <label>Progresso inicial: {form.progress}%</label>
            <input type="range" min="0" max="100" value={form.progress} onChange={e => setForm(f => ({ ...f, progress: e.target.value }))} style={{ accentColor: 'var(--coral)' }} />
          </div>
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  )
}
