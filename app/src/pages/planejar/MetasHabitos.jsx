import React, { useState, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import {
  RiAddLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiCheckLine,
  RiCloseLine,
  RiDeleteBinLine,
  RiFlagLine,
  RiPencilLine,
  RiRefreshLine,
} from '@remixicon/react'
import {
  listenGoals, addGoal, updateGoal, deleteGoal, listenGoalCategories, listenHabits, listenHabitLogs, listenTodos,
  addHabit, updateHabit, deleteHabit,
} from '../../services/firestore'
import { XP_PER_GOAL_DONE } from '../../utils/gamification'
import { getWeekDates, dateKeyFromDate, todayKey, getWeekStart, addDays } from '../../utils/date'
import { deadlineBadge } from '../../utils/deadline'
import { useDeadlineNotifications } from '../../hooks/useDeadlineNotifications'
import { isDailyHabit, computeStreak, computeWeeklyStreak, weekProgress } from '../../utils/streak'
import Modal from '../../components/Modal'
import Toast from '../../components/Toast'
import Tabs from '../../components/Tabs'
import Dropdown from '../../components/Dropdown'

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
  commitment: '',
  linkedHabitIds: [],
  timeframe: 'mes',
  category: 'projeto',
  progress: 0,
  targetDate: '',
  year: INIT.year,
  week: INIT.week,
  month: INIT.month,
  quarter: INIT.quarter,
}

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

const WEEKDAY_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const MONTH_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const RECENT_DAYS = 60
const FREQUENCY_OPTIONS = [
  { value: 7, label: 'Todos os dias' },
  { value: 5, label: '5x por semana' },
  { value: 4, label: '4x por semana' },
  { value: 3, label: '3x por semana' },
  { value: 2, label: '2x por semana' },
  { value: 1, label: '1x por semana' },
]
const PERIOD_OPTIONS = [
  { value: 14, label: '14 semanas' },
  { value: 13, label: '3 meses' },
  { value: 26, label: '6 meses' },
]

const heatmapLevel = (ratio) => {
  if (ratio <= 0) return 0
  if (ratio < 0.25) return 1
  if (ratio < 0.5) return 2
  if (ratio < 0.75) return 3
  return 4
}

const habitCreatedKey = (habit) => (
  habit.createdAt?.toDate ? dateKeyFromDate(habit.createdAt.toDate()) : null
)

const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

// Metas e Hábitos viviam em abas separadas do Planejar, mas são a mesma
// conversa (uma meta puxa hábitos, um hábito empurra uma meta) — juntar as
// duas na mesma tela, com um seletor por dentro, evita pular de aba toda
// hora só pra conferir os dois lados da mesma coisa.
export default function MetasHabitos() {
  const location = useLocation()
  // /planejar/habitos ainda existe como rota própria (links/assistente que
  // apontavam pra lá) — decide a aba inicial por ela, em vez de sempre cair
  // em Metas.
  const [subview, setSubview] = useState(location.pathname.endsWith('/habitos') ? 'habitos' : 'metas')
  const [goals, setGoals] = useState([])
  const [habits, setHabits] = useState([])
  const [recentHabitLogs, setRecentHabitLogs] = useState([])
  const [heatmapLogs, setHeatmapLogs] = useState([])
  const [todos, setTodos] = useState([])
  const [categories, setCategories] = useState(['projeto', 'saude', 'corp', 'estudo', 'familia', 'pessoal'])
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    const u1 = listenGoals(setGoals)
    const u2 = listenGoalCategories(setCategories)
    const u3 = listenHabits(setHabits)
    const u4 = listenHabitLogs(setRecentHabitLogs, 10)
    const u5 = listenTodos(setTodos)
    const u6 = listenHabitLogs(setHeatmapLogs, 400)
    return () => { u1(); u2(); u3(); u4(); u5(); u6() }
  }, [])

  return (
    <>
      <Tabs
        variant="segmented"
        items={[{ key: 'metas', label: 'Metas' }, { key: 'habitos', label: 'Hábitos' }]}
        active={subview}
        onChange={setSubview}
      />
      <div style={{ marginTop: 20 }}>
        {subview === 'metas' ? (
          <MetasView
            goals={goals} habits={habits} habitLogs={recentHabitLogs} todos={todos}
            categories={categories} showToast={showToast}
          />
        ) : (
          <HabitosView
            habits={habits} logs={heatmapLogs} showToast={showToast}
          />
        )}
      </div>
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </>
  )
}

function MetasView({ goals, habits, habitLogs, todos, categories, showToast }) {
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })

  const [selectedYear, setSelectedYear] = useState(INIT.year)
  const [activeFilter, setActiveFilter] = useState('Todos')
  const [selectedWeek, setSelectedWeek] = useState(INIT.week)
  const [selectedMonth, setSelectedMonth] = useState(INIT.month)
  const [selectedQuarter, setSelectedQuarter] = useState(INIT.quarter)

  const linkedTodosProgress = useMemo(() => {
    const byGoal = new Map()
    goals.forEach(g => {
      const linked = todos.filter(t => t.goalId === g.id)
      if (linked.length === 0) return
      const doneCount = linked.filter(t => t.done).length
      byGoal.set(g.id, { total: linked.length, done: doneCount, pct: Math.round((doneCount / linked.length) * 100) })
    })
    return byGoal
  }, [goals, todos])

  const habitWeekCounts = useMemo(() => {
    const logsByDate = new Map(habitLogs.map(l => [l.date, l.checked || {}]))
    const today = todayKey()
    const weekKeys = getWeekDates().map(dateKeyFromDate).filter(k => k <= today)
    const counts = new Map()
    habits.forEach(h => {
      counts.set(h.id, weekKeys.filter(k => logsByDate.get(k)?.[h.id]).length)
    })
    return counts
  }, [habits, habitLogs])

  useDeadlineNotifications(goals)

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
      commitment: item.commitment || '',
      linkedHabitIds: item.linkedHabitIds || [],
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
        commitment: (form.commitment || '').trim(),
        linkedHabitIds: form.linkedHabitIds || [],
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
    showToast(`🚀 Meta batida! +${XP_PER_GOAL_DONE} XP`)
  }

  const updateProgress = async (goal, value) => {
    const safe = clampProgress(value)
    const justCompleted = safe >= 100 && !goal.done
    await updateGoal(goal.id, { progress: safe, done: safe >= 100 })
    if (justCompleted) showToast(`🚀 Meta batida! +${XP_PER_GOAL_DONE} XP`)
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
    <>
      <div className="subpage-controls">
        <div className="year-switch">
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setSelectedYear(y => y - 1)} aria-label="Ano anterior">
            <RiArrowLeftSLine size={16} />
          </button>
          <span className="year-label">{selectedYear}</span>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setSelectedYear(y => y + 1)} aria-label="Próximo ano">
            <RiArrowRightSLine size={16} />
          </button>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={resetToToday}>Hoje</button>
        <button className="btn btn-primary" onClick={openAdd}>
          <RiAddLine size={15} /> Nova meta
        </button>
      </div>

      <Tabs
        scroll
        items={[['Todos', 'Todos'], ['semana', 'Semana'], ['mes', 'Mês'], ['trimestre', 'Trimestre'], ['ano', 'Ano'], ['longo_prazo', 'Longo Prazo']].map(([key, label]) => ({ key, label }))}
        active={activeFilter}
        onChange={setActiveFilter}
      />

      {activeFilter === 'semana' && (
        <div className="period-nav">
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setSelectedWeek(w => w > 1 ? w - 1 : weeksInYear)} aria-label="Semana anterior">
            <RiArrowLeftSLine size={16} />
          </button>
          <span className="period-nav-label">Semana {selectedWeek}</span>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setSelectedWeek(w => w < weeksInYear ? w + 1 : 1)} aria-label="Próxima semana">
            <RiArrowRightSLine size={16} />
          </button>
        </div>
      )}
      {activeFilter === 'mes' && (
        <div className="period-nav">
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setSelectedMonth(m => m > 0 ? m - 1 : 11)} aria-label="Mês anterior">
            <RiArrowLeftSLine size={16} />
          </button>
          <span className="period-nav-label">{FULL_MONTHS[selectedMonth]}</span>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setSelectedMonth(m => m < 11 ? m + 1 : 0)} aria-label="Próximo mês">
            <RiArrowRightSLine size={16} />
          </button>
        </div>
      )}
      {activeFilter === 'trimestre' && (
        <div className="period-nav">
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setSelectedQuarter(q => q > 1 ? q - 1 : 4)} aria-label="Trimestre anterior">
            <RiArrowLeftSLine size={16} />
          </button>
          <span className="period-nav-label">Q{selectedQuarter} — {selectedYear}</span>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setSelectedQuarter(q => q < 4 ? q + 1 : 1)} aria-label="Próximo trimestre">
            <RiArrowRightSLine size={16} />
          </button>
        </div>
      )}

      {filtered.length > 0 && (
        <p className="metas-count">{done} de {filtered.length} concluída{filtered.length !== 1 ? 's' : ''}</p>
      )}

      <div>
        {filtered.map(goal => {
          const badge = deadlineBadge(goal.targetDate)
          return (
            <div key={goal.id} className="goal-item">
              <div className="goal-header">
                <div className="goal-header-info">
                  <div className="goal-meta-row">
                    <span className={`pill pill-${goal.category || 'pessoal'}`}>{goal.category}</span>
                    <span className="goal-timeframe-badge">{fmtTimeframe(goal)}</span>
                    {badge && !goal.done && (
                      <span className={`deadline-badge deadline-badge--${badge.variant}`}>
                        {badge.text}
                      </span>
                    )}
                  </div>
                  <h3 className={`goal-title ${goal.done ? 'done' : ''}`}>{goal.title}</h3>
                </div>
                <div className="goal-actions">
                  <button
                    className={`btn btn-sm btn-icon ${goal.done ? 'btn-ghost' : 'btn-primary'}`}
                    onClick={() => toggleDone(goal)}
                    title={goal.done ? 'Reabrir' : 'Concluir'}
                    aria-label={goal.done ? 'Reabrir meta' : 'Concluir meta'}
                  >
                    {goal.done ? <RiRefreshLine size={14} /> : <RiCheckLine size={14} />}
                  </button>
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(goal)} aria-label="Editar">
                    <RiPencilLine size={14} />
                  </button>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(goal.id)} aria-label="Apagar">
                    <RiDeleteBinLine size={14} />
                  </button>
                </div>
              </div>

              {goal.commitment && <p className="goal-commitment">"{goal.commitment}"</p>}

              {goal.description && <p className="goal-desc">{goal.description}</p>}

              {((goal.linkedHabitIds || []).length > 0 || linkedTodosProgress.get(goal.id)) && (
                <div className="goal-linked-habits">
                  {(goal.linkedHabitIds || []).map(hid => {
                    const habit = habits.find(h => h.id === hid)
                    if (!habit) return null
                    return (
                      <span key={hid} className="goal-linked-habit">
                        {habit.name} · {habitWeekCounts.get(hid) || 0}× esta semana
                      </span>
                    )
                  })}
                  {linkedTodosProgress.get(goal.id) && (
                    <>
                      <span className="goal-linked-habit">
                        {linkedTodosProgress.get(goal.id).done}/{linkedTodosProgress.get(goal.id).total} tarefas concluídas
                      </span>
                      {linkedTodosProgress.get(goal.id).pct !== clampProgress(goal.progress) && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => updateProgress(goal, linkedTodosProgress.get(goal.id).pct)}
                        >
                          usar {linkedTodosProgress.get(goal.id).pct}% das tarefas
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

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
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon"><RiFlagLine size={32} /></div>
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
          <div className="field">
            <label>Compromisso — por que isso importa (na sua voz)</label>
            <textarea
              rows={2}
              value={form.commitment}
              onChange={e => setForm(f => ({ ...f, commitment: e.target.value }))}
              placeholder='Ex: "Prometi estudar inglês 4x por semana até dezembro."'
            />
          </div>
          {habits.length > 0 && (
            <div className="field">
              <label>Hábitos vinculados (empurram esta meta)</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {habits.map(h => (
                  <button
                    key={h.id}
                    type="button"
                    className={`day-toggle ${(form.linkedHabitIds || []).includes(h.id) ? 'active' : ''}`}
                    onClick={() => setForm(f => ({
                      ...f,
                      linkedHabitIds: (f.linkedHabitIds || []).includes(h.id)
                        ? f.linkedHabitIds.filter(id => id !== h.id)
                        : [...(f.linkedHabitIds || []), h.id],
                    }))}
                  >
                    {h.name}
                  </button>
                ))}
              </div>
            </div>
          )}
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
                <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => setForm(f => ({ ...f, year: f.year - 1 }))} aria-label="Ano anterior">
                  <RiArrowLeftSLine size={16} />
                </button>
                <span style={{ fontSize: 14, minWidth: 40, textAlign: 'center' }}>{form.year}</span>
                <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => setForm(f => ({ ...f, year: f.year + 1 }))} aria-label="Próximo ano">
                  <RiArrowRightSLine size={16} />
                </button>
              </div>
            </div>
          )}

          {form.timeframe === 'semana' && (
            <div className="field">
              <label>Semana</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => setForm(f => ({ ...f, week: f.week > 1 ? f.week - 1 : getISOWeeksInYear(f.year) }))} aria-label="Semana anterior">
                  <RiArrowLeftSLine size={16} />
                </button>
                <span style={{ fontSize: 14, minWidth: 56, textAlign: 'center' }}>Sem {form.week}</span>
                <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => setForm(f => ({ ...f, week: f.week < getISOWeeksInYear(f.year) ? f.week + 1 : 1 }))} aria-label="Próxima semana">
                  <RiArrowRightSLine size={16} />
                </button>
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
          <div className="field" style={{ marginBottom: 0 }}>
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
          </div>
        </Modal>
      )}
    </>
  )
}

function HabitosView({ habits, logs, showToast }) {
  const [selectedId, setSelectedId] = useState(null)
  const [periodWeeks, setPeriodWeeks] = useState(14)
  const [selectedDayKey, setSelectedDayKey] = useState(null)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newFrequency, setNewFrequency] = useState(7)
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [editingFrequency, setEditingFrequency] = useState(7)
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => {
    if (!selectedId && habits.length) setSelectedId(habits[0].id)
  }, [habits, selectedId])

  const logsByDate = useMemo(() => new Map(logs.map(l => [l.date, l.checked || {}])), [logs])

  const heatmapDays = useMemo(() => {
    const start = getWeekStart(addDays(new Date(), -(periodWeeks - 1) * 7))
    return Array.from({ length: periodWeeks * 7 }, (_, i) => addDays(start, i))
  }, [periodWeeks])

  const today = todayKey()
  const dailyHabits = useMemo(() => habits.filter(isDailyHabit), [habits])
  const dailyHabitIds = useMemo(() => new Set(dailyHabits.map(h => h.id)), [dailyHabits])
  const dailyHabitsMeta = useMemo(
    () => dailyHabits.map(h => ({ id: h.id, createdKey: habitCreatedKey(h) })),
    [dailyHabits],
  )
  const activeCountForDayKey = (dayKey) => dailyHabitsMeta.filter(h => !h.createdKey || h.createdKey <= dayKey).length

  const heatmapInfo = useMemo(() => heatmapDays.map((day) => {
    const key = dateKeyFromDate(day)
    const isFuture = key > today
    const dayActiveCount = activeCountForDayKey(key)
    const hasData = dayActiveCount > 0
    const checked = logsByDate.get(key) || {}
    const doneHabitIds = Object.entries(checked).filter(([id, v]) => v && dailyHabitIds.has(id)).map(([id]) => id)
    const doneCount = doneHabitIds.length
    const ratio = hasData ? doneCount / dayActiveCount : 0
    const level = isFuture ? -1 : (hasData ? heatmapLevel(ratio) : -2)
    return { day, key, isFuture, hasData, dayActiveCount, doneCount, doneHabitIds, ratio, level }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [heatmapDays, logsByDate, dailyHabitIds, dailyHabitsMeta, today])

  const pastDays = useMemo(() => heatmapInfo.filter(d => !d.isFuture && d.hasData), [heatmapInfo])
  const hasEnoughData = dailyHabits.length > 0 && pastDays.length >= 5

  const consistencyPct = useMemo(() => {
    const possible = pastDays.reduce((sum, d) => sum + d.dayActiveCount, 0)
    const done = pastDays.reduce((sum, d) => sum + d.doneCount, 0)
    return possible > 0 ? Math.round((done / possible) * 100) : 0
  }, [pastDays])

  const activeDaysCount = useMemo(() => pastDays.filter(d => d.doneCount > 0).length, [pastDays])

  const currentStreakDays = useMemo(() => {
    let streak = 0
    for (let i = pastDays.length - 1; i >= 0; i--) {
      if (pastDays[i].doneCount > 0) streak += 1
      else break
    }
    return streak
  }, [pastDays])

  const bestWeekPct = useMemo(() => {
    let best = 0
    for (let w = 0; w < periodWeeks; w++) {
      const slice = heatmapInfo.slice(w * 7, w * 7 + 7).filter(d => !d.isFuture && d.hasData)
      if (!slice.length) continue
      const possible = slice.reduce((sum, d) => sum + d.dayActiveCount, 0)
      const done = slice.reduce((sum, d) => sum + d.doneCount, 0)
      if (possible > 0) best = Math.max(best, done / possible)
    }
    return Math.round(best * 100)
  }, [heatmapInfo, periodWeeks])

  const insightMessage = useMemo(() => {
    if (pastDays.length < 14) return null
    const avg = (arr) => {
      const possible = arr.reduce((sum, d) => sum + d.dayActiveCount, 0)
      if (!possible) return null
      return arr.reduce((sum, d) => sum + d.doneCount, 0) / possible
    }
    const last7 = avg(pastDays.slice(-7))
    const prior7 = avg(pastDays.slice(-14, -7))
    if (last7 === null || prior7 === null) return null
    const diff = last7 - prior7
    if (diff >= 0.15) return 'Boa retomada — seu ritmo subiu nos últimos 7 dias.'
    if (diff <= -0.15) return 'Seu ritmo caiu nos últimos 7 dias em relação à semana anterior.'
    if (last7 >= 0.7) return 'Você está mantendo um ritmo forte.'
    return null
  }, [pastDays])

  const monthLabelCells = useMemo(() => {
    let lastMonth = null
    const cells = []
    heatmapDays.forEach((day, i) => {
      if (i % 7 !== 0) return
      const month = day.getMonth()
      if (month !== lastMonth) {
        cells.push({ col: i / 7, label: MONTH_ABBR[month] })
        lastMonth = month
      }
    })
    return cells
  }, [heatmapDays])

  const selectedDayInfo = selectedDayKey ? heatmapInfo.find(d => d.key === selectedDayKey) : null
  const selectedDayHabitNames = selectedDayInfo
    ? habits.filter(h => selectedDayInfo.doneHabitIds.includes(h.id)).map(h => h.name)
    : []

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) { setAdding(false); return }
    await addHabit({ name, weeklyTarget: newFrequency })
    setNewName('')
    setNewFrequency(7)
    setAdding(false)
    showToast('Hábito criado!')
  }

  const startRename = (habit) => {
    setEditingId(habit.id)
    setEditingName(habit.name)
    setEditingFrequency(habit.weeklyTarget || 7)
  }

  const saveRename = async () => {
    const name = editingName.trim()
    const habit = habits.find(h => h.id === editingId)
    if (name) {
      const data = habit?.scheduleItemId ? { name } : { name, weeklyTarget: editingFrequency }
      await updateHabit(editingId, data)
    }
    setEditingId(null)
  }

  const confirmDeleteHabit = async () => {
    const habit = confirmDelete
    if (!habit) return
    await deleteHabit(habit.id)
    if (selectedId === habit.id) setSelectedId(null)
    setConfirmDelete(null)
    showToast('Hábito removido.')
  }

  const selectedHabit = habits.find(h => h.id === selectedId)
  const recentDays = useMemo(
    () => Array.from({ length: RECENT_DAYS }, (_, i) => addDays(new Date(), i - (RECENT_DAYS - 1))),
    [],
  )

  return (
    <>
      <div className="habitos-section habit-consistency-card">
        {dailyHabits.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            Comece marcando um hábito diário hoje pra construir seu histórico aqui.
          </div>
        ) : (
          <>
            <div className="habit-consistency-header">
              <div>
                <h2 className="hoje-section-title">Seu ritmo nas últimas {PERIOD_OPTIONS.find(p => p.value === periodWeeks)?.label}</h2>
                {hasEnoughData ? (
                  <>
                    <div className="habit-consistency-primary">
                      {consistencyPct}% <span>de consistência</span>
                    </div>
                    <div className="habit-consistency-stats">
                      {activeDaysCount} dias ativos · sequência atual {currentStreakDays} dia{currentStreakDays === 1 ? '' : 's'} · melhor semana {bestWeekPct}%
                    </div>
                  </>
                ) : (
                  <p className="habit-heatmap-explainer">
                    Você tem {pastDays.length} dia{pastDays.length === 1 ? '' : 's'} registrado{pastDays.length === 1 ? '' : 's'}. O gráfico fica mais útil conforme seu histórico cresce.
                  </p>
                )}
              </div>
              <Dropdown
                className="calendar-select"
                value={periodWeeks}
                options={PERIOD_OPTIONS}
                onChange={v => { setPeriodWeeks(v); setSelectedDayKey(null) }}
                ariaLabel="Período"
              />
            </div>

            <div className="habit-heatmap-center">
              <div className="habit-heatmap-row habit-heatmap-months">
                <span className="habit-heatmap-weekdays" aria-hidden="true" style={{ visibility: 'hidden', height: 12, overflow: 'hidden' }}>D</span>
                <div className="habit-heatmap-months-grid" style={{ gridTemplateColumns: `repeat(${periodWeeks}, 12px)` }}>
                  {monthLabelCells.map(({ col, label }) => (
                    <span key={col} style={{ gridColumnStart: col + 1 }}>{label}</span>
                  ))}
                </div>
              </div>

              <div className="habit-heatmap-row habit-heatmap-wrap">
                <div className="habit-heatmap-weekdays">
                  {WEEKDAY_SHORT.map((d, i) => <span key={i}>{d}</span>)}
                </div>
                <div className="habit-heatmap-grid">
                  {heatmapInfo.map((info, i) => {
                    const { day, key, isFuture, hasData, dayActiveCount, doneCount, level } = info
                    const stateClass = level >= 0 ? `level-${level}` : (level === -2 ? 'is-nodata' : 'is-future')
                    const label = isFuture
                      ? ''
                      : hasData
                        ? `${day.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })} — ${doneCount} de ${dayActiveCount} hábitos concluídos`
                        : `${day.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })} — sem hábitos cadastrados`
                    return (
                      <button
                        type="button"
                        key={key}
                        className={`habit-heatmap-cell wave-in ${stateClass} ${selectedDayKey === key ? 'is-selected' : ''}`}
                        style={{ animationDelay: `${Math.floor(i / 7) * 40 + (i % 7) * 8}ms` }}
                        title={label}
                        aria-label={label}
                        disabled={isFuture || !hasData}
                        onClick={() => setSelectedDayKey(prev => (prev === key ? null : key))}
                      />
                    )
                  })}
                </div>
              </div>

              <div className="habit-heatmap-legend">
                <span>menos concluído</span>
                <span className="habit-heatmap-cell level-0" />
                <span className="habit-heatmap-cell level-1" />
                <span className="habit-heatmap-cell level-2" />
                <span className="habit-heatmap-cell level-3" />
                <span className="habit-heatmap-cell level-4" />
                <span>mais concluído</span>
              </div>
            </div>

            {selectedDayInfo && (
              <div className="habit-heatmap-detail">
                <strong>{capFirst(selectedDayInfo.day.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }))}</strong>
                <span>{selectedDayInfo.doneCount} de {selectedDayInfo.dayActiveCount} hábitos concluídos</span>
                {selectedDayHabitNames.length > 0 && (
                  <ul>
                    {selectedDayHabitNames.map(name => <li key={name}>{name}</li>)}
                  </ul>
                )}
              </div>
            )}

            {insightMessage && <p className="habit-heatmap-insight">{insightMessage}</p>}
          </>
        )}
      </div>

      <div className="habitos-section">
        <div className="hoje-section-head">
          <h2 className="hoje-section-title">Seus hábitos</h2>
        </div>
        <div className="habit-manage-list">
          {habits.map(habit => {
            const daily = isDailyHabit(habit)
            const streak = daily ? computeStreak(habit.id, logsByDate, today) : computeWeeklyStreak(habit.id, logsByDate, today, habit.weeklyTarget)
            const record = daily ? Math.max(habit.bestStreak || 0, streak) : Math.max(habit.bestWeeklyStreak || 0, streak)
            const weekDone = daily ? null : weekProgress(habit.id, logsByDate, today)

            return (
              <div key={habit.id} className={`habit-manage-row ${selectedId === habit.id ? 'active' : ''}`}>
                {editingId === habit.id ? (
                  <>
                    <input
                      className="inline-edit-input"
                      autoFocus
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveRename()}
                    />
                    {habit.scheduleItemId ? (
                      <span className="subpage-controls-note" style={{ marginRight: 0 }}>frequência vem da agenda</span>
                    ) : (
                      <Dropdown
                        className="calendar-select"
                        value={editingFrequency}
                        options={FREQUENCY_OPTIONS}
                        onChange={setEditingFrequency}
                        ariaLabel="Frequência"
                      />
                    )}
                    <button className="btn btn-primary btn-sm btn-icon" onClick={saveRename} aria-label="Salvar"><RiCheckLine size={13} /></button>
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setEditingId(null)} aria-label="Cancelar"><RiCloseLine size={13} /></button>
                  </>
                ) : (
                  <>
                    <button type="button" className="habit-manage-name" onClick={() => setSelectedId(habit.id)}>
                      {habit.name}
                    </button>
                    {habit.scheduleItemId && (
                      <span className="habit-linked-badge" title="Frequência vinculada a um item da agenda semanal">na agenda</span>
                    )}
                    {!daily && (
                      <span className={`habit-week-progress ${weekDone >= habit.weeklyTarget ? 'is-met' : ''}`}>
                        {weekDone}/{habit.weeklyTarget} semana
                      </span>
                    )}
                    <span className="subpage-controls-note" style={{ marginRight: 0 }}>
                      recorde: {record} {daily ? 'dias' : 'semanas'}
                    </span>
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => startRename(habit)} aria-label="Renomear"><RiPencilLine size={13} /></button>
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => setConfirmDelete(habit)} aria-label="Excluir"><RiDeleteBinLine size={13} /></button>
                  </>
                )}
              </div>
            )
          })}

          {habits.length === 0 && !adding && (
            <div className="empty-state" style={{ padding: '20px 0' }}>Nenhum hábito cadastrado ainda.</div>
          )}

          {adding ? (
            <div className="habit-add-row">
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="Nome do hábito"
              />
              <Dropdown
                className="calendar-select"
                value={newFrequency}
                options={FREQUENCY_OPTIONS}
                onChange={setNewFrequency}
                ariaLabel="Frequência"
              />
              <button className="btn btn-primary btn-sm btn-icon" onClick={handleAdd} aria-label="Salvar"><RiCheckLine size={14} /></button>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setAdding(false); setNewName(''); setNewFrequency(7) }} aria-label="Cancelar"><RiCloseLine size={14} /></button>
            </div>
          ) : (
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => setAdding(true)}>
              <RiAddLine size={14} /> Adicionar hábito
            </button>
          )}
        </div>
      </div>

      {selectedHabit && (
        <div className="habitos-section">
          <div className="hoje-section-head">
            <h2 className="hoje-section-title">{selectedHabit.name}</h2>
            <span className="subpage-controls-note" style={{ marginRight: 0 }}>últimos {RECENT_DAYS} dias</span>
          </div>
          <div className="habit-recent-strip">
            {recentDays.map(day => {
              const key = dateKeyFromDate(day)
              const checked = !!logsByDate.get(key)?.[selectedHabit.id]
              return (
                <span
                  key={key}
                  className={`habit-dot ${checked ? 'filled' : ''}`}
                  title={`${day.toLocaleDateString('pt-BR')}${checked ? ' — feito' : ''}`}
                />
              )
            })}
          </div>
        </div>
      )}

      {confirmDelete && (
        <Modal
          title="Excluir hábito"
          onClose={() => setConfirmDelete(null)}
          onSave={confirmDeleteHabit}
          saveLabel="Excluir"
        >
          <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
            Excluir o hábito <strong>"{confirmDelete.name}"</strong>?
            O histórico de marcações não é apagado, mas deixa de aparecer.
          </p>
        </Modal>
      )}
    </>
  )
}
