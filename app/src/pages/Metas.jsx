import React, { useState, useEffect, useMemo } from 'react'
import { listenGoals, addGoal, updateGoal, deleteGoal, listenGoalCategories } from '../services/firestore'
import Modal from '../components/Modal'
import Toast from '../components/Toast'

const TIMEFRAME_OPTIONS = [
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mês' },
  { value: 'trimestre', label: 'Trimestre' },
  { value: 'ano', label: 'Ano' },
  { value: 'longo_prazo', label: 'Longo Prazo' },
]

const FULL_MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const SHORT_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const getISOWeek = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

const getISOWeeksInYear = (year) => {
  const dec31 = new Date(year, 11, 31)
  const w = getISOWeek(dec31)
  return w === 1 ? getISOWeek(new Date(year, 11, 24)) : w
}

const getQuarter = (month) => Math.ceil((month + 1) / 3)

const todayDate = new Date()
const INIT = {
  year: todayDate.getFullYear(),
  week: getISOWeek(todayDate),
  month: todayDate.getMonth(),
  quarter: getQuarter(todayDate.getMonth()),
}

const EMPTY_FORM = {
  title: '',
  description: '',
  timeframe: 'mes',
  category: 'projeto',
  progress: 0,
  targetDate: '',
  year: INIT.year,
  week: INIT.week,
  month: INIT.month,
  quarter: INIT.quarter,
}

const PROGRESS_MARKS = [0, 25, 50, 75, 100]
const clampProgress = (value) => Math.max(0, Math.min(100, Number(value) || 0))

const fmtTimeframe = (goal) => {
  const tf = goal.timeframe
  if (tf === 'longo_prazo') return 'Longo Prazo'
  if (tf === 'semana') return `Sem ${goal.week ?? ''}/${goal.year ?? ''}`
  if (tf === 'mes') return `${SHORT_MONTHS[goal.month ?? 0]}/${goal.year ?? ''}`
  if (tf === 'trimestre') return `Q${goal.quarter ?? ''}/${goal.year ?? ''}`
  if (tf === 'ano') return `${goal.year ?? ''}`
  return tf
}

export default function Metas() {
  const [goals, setGoals] = useState([])
  const [categories, setCategories] = useState(['projeto', 'saude', 'corp', 'estudo', 'familia', 'pessoal'])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [toast, setToast] = useState(null)

  const [selectedYear, setSelectedYear] = useState(INIT.year)
  const [activeFilter, setActiveFilter] = useState('Todos')
  const [selectedWeek, setSelectedWeek] = useState(INIT.week)
  const [selectedMonth, setSelectedMonth] = useState(INIT.month)
  const [selectedQuarter, setSelectedQuarter] = useState(INIT.quarter)

  useEffect(() => {
    const u1 = listenGoals(setGoals)
    const u2 = listenGoalCategories(setCategories)
    return () => { u1(); u2() }
  }, [])

  const weeksInYear = useMemo(() => getISOWeeksInYear(selectedYear), [selectedYear])

  const filtered = useMemo(() => {
    if (activeFilter === 'Todos') return goals
    if (activeFilter === 'longo_prazo') return goals.filter(g => g.timeframe === 'longo_prazo')
    if (activeFilter === 'semana') return goals.filter(g => g.timeframe === 'semana' && g.year === selectedYear && g.week === selectedWeek)
    if (activeFilter === 'mes') return goals.filter(g => g.timeframe === 'mes' && g.year === selectedYear && g.month === selectedMonth)
    if (activeFilter === 'trimestre') return goals.filter(g => g.timeframe === 'trimestre' && g.year === selectedYear && g.quarter === selectedQuarter)
    if (activeFilter === 'ano') return goals.filter(g => g.timeframe === 'ano' && g.year === selectedYear)
    return goals
  }, [goals, activeFilter, selectedYear, selectedWeek, selectedMonth, selectedQuarter])

  const openAdd = () => {
    setEditing(null)
    const base = { ...EMPTY_FORM, year: selectedYear, week: selectedWeek, month: selectedMonth, quarter: selectedQuarter }
    if (activeFilter !== 'Todos') base.timeframe = activeFilter === 'longo_prazo' ? 'longo_prazo' : activeFilter
    setForm(base)
    setShowModal(true)
  }

  const openEdit = (item) => {
    setEditing(item)
    setForm({
      title: item.title || '',
      description: item.description || '',
      timeframe: item.timeframe || 'mes',
      category: item.category || 'projeto',
      progress: item.progress || 0,
      targetDate: item.targetDate || '',
      year: item.year ?? selectedYear,
      week: item.week ?? selectedWeek,
      month: item.month ?? selectedMonth,
      quarter: item.quarter ?? selectedQuarter,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) return
    try {
      const safeProgress = clampProgress(form.progress)
      const data = {
        title: form.title.trim(),
        description: form.description,
        timeframe: form.timeframe,
        category: form.category,
        progress: safeProgress,
        done: safeProgress >= 100,
        targetDate: form.targetDate,
      }
      if (form.timeframe !== 'longo_prazo') {
        data.year = form.year
        if (form.timeframe === 'semana') data.week = form.week
        if (form.timeframe === 'mes') data.month = form.month
        if (form.timeframe === 'trimestre') data.quarter = form.quarter
      }
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
    if (goal.done) {
      const reopenedProgress = clampProgress(goal.progress) >= 100 ? 95 : clampProgress(goal.progress)
      await updateGoal(goal.id, { done: false, progress: reopenedProgress })
      return
    }
    await updateGoal(goal.id, { done: true, progress: 100 })
  }

  const updateProgress = async (goal, value) => {
    const safe = clampProgress(value)
    await updateGoal(goal.id, { progress: safe, done: safe >= 100 })
  }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const done = filtered.filter(g => g.done).length

  const periodLabel = useMemo(() => {
    if (activeFilter === 'semana') return `Semana ${selectedWeek} / ${selectedYear}`
    if (activeFilter === 'mes') return `${FULL_MONTHS[selectedMonth]} / ${selectedYear}`
    if (activeFilter === 'trimestre') return `Q${selectedQuarter} / ${selectedYear}`
    if (activeFilter === 'ano') return `Ano ${selectedYear}`
    if (activeFilter === 'longo_prazo') return 'Longo Prazo'
    return ''
  }, [activeFilter, selectedWeek, selectedMonth, selectedQuarter, selectedYear])

  const resetToToday = () => {
    const now = new Date()
    setSelectedYear(now.getFullYear())
    setSelectedWeek(getISOWeek(now))
    setSelectedMonth(now.getMonth())
    setSelectedQuarter(getQuarter(now.getMonth()))
  }

  return (
    <div className="page">
      <div className="page-header metas-page-header">
        <div>
          <span className="page-kicker">Metas & Objetivos</span>
          <h1 className="page-title">Metas</h1>
        </div>
        <div className="metas-header-right">
          <div className="year-switch">
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setSelectedYear(y => y - 1)} aria-label="Ano anterior">‹</button>
            <span className="year-label">{selectedYear}</span>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setSelectedYear(y => y + 1)} aria-label="Próximo ano">›</button>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={resetToToday}>Hoje</button>
          <button className="btn btn-primary" onClick={openAdd}>+ Nova meta</button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="tabs goals-tabs">
        {[['Todos', 'Todos'], ['semana', 'Semana'], ['mes', 'Mês'], ['trimestre', 'Trimestre'], ['ano', 'Ano'], ['longo_prazo', 'Longo Prazo']].map(([val, label]) => (
          <button key={val} className={`tab-btn ${activeFilter === val ? 'active' : ''}`} onClick={() => setActiveFilter(val)}>
            {label}
          </button>
        ))}
      </div>

      {/* Sub-period selectors */}
      {activeFilter === 'semana' && (
        <div className="period-nav">
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setSelectedWeek(w => w > 1 ? w - 1 : weeksInYear)}>‹</button>
          <span className="period-nav-label">Semana {selectedWeek}</span>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setSelectedWeek(w => w < weeksInYear ? w + 1 : 1)}>›</button>
        </div>
      )}
      {activeFilter === 'mes' && (
        <div className="period-nav">
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setSelectedMonth(m => m > 0 ? m - 1 : 11)}>‹</button>
          <span className="period-nav-label">{FULL_MONTHS[selectedMonth]}</span>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setSelectedMonth(m => m < 11 ? m + 1 : 0)}>›</button>
        </div>
      )}
      {activeFilter === 'trimestre' && (
        <div className="period-nav">
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setSelectedQuarter(q => q > 1 ? q - 1 : 4)}>‹</button>
          <span className="period-nav-label">Q{selectedQuarter} — {selectedYear}</span>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setSelectedQuarter(q => q < 4 ? q + 1 : 1)}>›</button>
        </div>
      )}

      {filtered.length > 0 && (
        <p className="metas-count">{done} de {filtered.length} concluída{filtered.length !== 1 ? 's' : ''}</p>
      )}

      <div>
        {filtered.map(goal => (
          <div key={goal.id} className="goal-item">
            <div className="goal-header">
              <div className="goal-header-info">
                <div className="goal-meta-row">
                  <span className={`pill pill-${goal.category || 'pessoal'}`}>{goal.category}</span>
                  <span className="goal-timeframe-badge">{fmtTimeframe(goal)}</span>
                  {goal.targetDate && <span className="goal-timeframe-badge">→ {goal.targetDate}</span>}
                </div>
                <h3 className={`goal-title ${goal.done ? 'done' : ''}`}>{goal.title}</h3>
              </div>
              <div className="goal-actions">
                <button
                  className={`btn btn-sm ${goal.done ? 'btn-ghost' : 'btn-primary'}`}
                  onClick={() => toggleDone(goal)}
                  title={goal.done ? 'Reabrir' : 'Concluir'}
                >
                  {goal.done ? '↩' : '✓'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(goal)}>editar</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(goal.id)}>×</button>
              </div>
            </div>

            {goal.description && <p className="goal-desc">{goal.description}</p>}

            <div className="goal-progress-row">
              <span className="goal-progress-pct">Progresso: {clampProgress(goal.progress)}%</span>
            </div>

            <div className="goal-progress-row goal-progress-slider">
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={clampProgress(goal.progress)}
                onChange={e => updateProgress(goal, e.target.value)}
                className="goal-range"
                style={{ '--goal-progress': `${clampProgress(goal.progress)}%` }}
              />
            </div>

            <div className="goal-progress-scale" aria-hidden="true">
              {PROGRESS_MARKS.map((mark) => (
                <span key={mark}>{mark}</span>
              ))}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">◎</div>
            Nenhuma meta aqui.
            {activeFilter !== 'Todos' && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)' }}>
                Clique em "+ Nova meta" para adicionar uma meta para {periodLabel}.
              </div>
            )}
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
                {TIMEFRAME_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Categoria</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {form.timeframe !== 'longo_prazo' && (
            <div className="field">
              <label>Ano</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => setForm(f => ({ ...f, year: f.year - 1 }))}>‹</button>
                <span style={{ fontSize: 14, minWidth: 40, textAlign: 'center' }}>{form.year}</span>
                <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => setForm(f => ({ ...f, year: f.year + 1 }))}>›</button>
              </div>
            </div>
          )}

          {form.timeframe === 'semana' && (
            <div className="field">
              <label>Semana</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => setForm(f => ({ ...f, week: f.week > 1 ? f.week - 1 : getISOWeeksInYear(f.year) }))}>‹</button>
                <span style={{ fontSize: 14, minWidth: 56, textAlign: 'center' }}>Sem {form.week}</span>
                <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => setForm(f => ({ ...f, week: f.week < getISOWeeksInYear(f.year) ? f.week + 1 : 1 }))}>›</button>
              </div>
            </div>
          )}

          {form.timeframe === 'mes' && (
            <div className="field">
              <label>Mês</label>
              <select value={form.month} onChange={e => setForm(f => ({ ...f, month: Number(e.target.value) }))}>
                {FULL_MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            </div>
          )}

          {form.timeframe === 'trimestre' && (
            <div className="field">
              <label>Trimestre</label>
              <select value={form.quarter} onChange={e => setForm(f => ({ ...f, quarter: Number(e.target.value) }))}>
                {[1, 2, 3, 4].map(q => (
                  <option key={q} value={q}>Q{q} — {FULL_MONTHS[(q - 1) * 3]} a {FULL_MONTHS[(q - 1) * 3 + 2]}</option>
                ))}
              </select>
            </div>
          )}

          <div className="field">
            <label>Data alvo (opcional)</label>
            <input type="date" value={form.targetDate} onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))} />
          </div>
          <div className="field">
            <label>Progresso: {form.progress}%</label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={clampProgress(form.progress)}
              onChange={e => setForm(f => ({ ...f, progress: Number(e.target.value) }))}
              className="goal-range"
              style={{ '--goal-progress': `${clampProgress(form.progress)}%` }}
            />
            <div className="goal-progress-scale" aria-hidden="true" style={{ marginTop: 8 }}>
              {PROGRESS_MARKS.map((mark) => (
                <span key={mark}>{mark}</span>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  )
}

