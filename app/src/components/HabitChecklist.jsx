import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  RiAddLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiCheckLine,
  RiCloseLine,
  RiFireLine,
  RiTrophyLine,
} from '@remixicon/react'
import {
  listenHabits,
  addHabit,
  updateHabit,
  listenHabitLogs,
  setHabitChecked,
} from '../services/firestore'
import { todayKey, dateKeyFromDate } from '../utils/date'
import { computeStreak, computeWeeklyStreak, weekProgress, isDailyHabit } from '../utils/streak'
import Toast from './Toast'

const MILESTONES = [7, 30, 100, 365]
const FREQUENCY_OPTIONS = [
  { value: 7, label: 'Todos os dias' },
  { value: 5, label: '5x por semana' },
  { value: 4, label: '4x por semana' },
  { value: 3, label: '3x por semana' },
  { value: 2, label: '2x por semana' },
  { value: 1, label: '1x por semana' },
]

const last14Days = () => Array.from({ length: 14 }, (_, i) => {
  const d = new Date()
  d.setDate(d.getDate() - (13 - i))
  return dateKeyFromDate(d)
})

export default function HabitChecklist() {
  const [habits, setHabits] = useState([])
  const [logs, setLogs] = useState([])
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newFrequency, setNewFrequency] = useState(7)
  const [expanded, setExpanded] = useState(() => new Set())
  const [toast, setToast] = useState(null)

  useEffect(() => {
    const u1 = listenHabits(setHabits)
    const u2 = listenHabitLogs(setLogs, 60)
    return () => { u1(); u2() }
  }, [])

  const today = todayKey()
  const logsByDate = new Map(logs.map(l => [l.date, l.checked || {}]))
  const todayChecked = logsByDate.get(today) || {}
  const dotDays = last14Days()

  const showToast = (msg) => {
    setToast({ msg, type: 'success' })
    setTimeout(() => setToast(null), 3500)
  }

  const toggleExpand = (habitId) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(habitId) ? next.delete(habitId) : next.add(habitId)
      return next
    })
  }

  const toggle = async (habit) => {
    const checked = !!todayChecked[habit.id]
    const nextChecked = !checked
    await setHabitChecked(today, habit.id, nextChecked)
    if (!nextChecked) return

    const simulated = new Map(logsByDate)
    simulated.set(today, { ...(simulated.get(today) || {}), [habit.id]: true })

    if (isDailyHabit(habit)) {
      const newStreak = computeStreak(habit.id, simulated, today)
      const best = habit.bestStreak || 0
      if (newStreak > best) updateHabit(habit.id, { bestStreak: newStreak })
      if (MILESTONES.includes(newStreak)) {
        showToast(`🔥 ${newStreak} dias seguidos em "${habit.name}"!`)
      }
      return
    }

    const newWeeklyStreak = computeWeeklyStreak(habit.id, simulated, today, habit.weeklyTarget)
    const bestWeekly = habit.bestWeeklyStreak || 0
    if (newWeeklyStreak > bestWeekly) updateHabit(habit.id, { bestWeeklyStreak: newWeeklyStreak })
    const doneThisWeek = weekProgress(habit.id, simulated, today)
    if (doneThisWeek === habit.weeklyTarget) {
      showToast(`✅ Meta da semana batida em "${habit.name}"!`)
    }
  }

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) { setAdding(false); return }
    await addHabit({ name, weeklyTarget: newFrequency })
    setNewName('')
    setNewFrequency(7)
    setAdding(false)
  }

  return (
    <div className="habit-list">
      {habits.map(habit => {
        const checked = !!todayChecked[habit.id]
        const daily = isDailyHabit(habit)
        const streak = daily ? computeStreak(habit.id, logsByDate, today) : computeWeeklyStreak(habit.id, logsByDate, today, habit.weeklyTarget)
        const record = daily
          ? Math.max(habit.bestStreak || 0, streak)
          : Math.max(habit.bestWeeklyStreak || 0, streak)
        const weekDone = daily ? null : weekProgress(habit.id, logsByDate, today)
        const isOpen = expanded.has(habit.id)

        return (
          <div key={habit.id} className="habit-row">
            <div className="habit-row-main">
              <button
                type="button"
                className="todo-check"
                style={checked ? { background: 'var(--sage)', borderColor: 'var(--sage)' } : undefined}
                onClick={() => toggle(habit)}
                aria-label={checked ? `Desmarcar ${habit.name}` : `Marcar ${habit.name}`}
              >
                {checked && <RiCheckLine size={11} style={{ color: '#fff' }} />}
              </button>
              <button type="button" className="habit-name habit-name-btn" onClick={() => toggleExpand(habit.id)}>
                {habit.name}
              </button>
              {!daily && (
                <span
                  className={`habit-week-progress ${weekDone >= habit.weeklyTarget ? 'is-met' : ''}`}
                  title="Progresso desta semana"
                >
                  {weekDone}/{habit.weeklyTarget} semana
                </span>
              )}
              <span className={`habit-streak ${streak === 0 ? 'is-zero' : ''}`} title={daily ? 'Sequência atual (dias)' : 'Sequência atual (semanas)'}>
                <RiFireLine size={13} /> {streak}
              </span>
              <span className="habit-record" title="Recorde">
                <RiTrophyLine size={13} /> {record}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon"
                onClick={() => toggleExpand(habit.id)}
                aria-label={isOpen ? 'Recolher dias' : 'Ver dias'}
              >
                {isOpen ? <RiArrowUpSLine size={14} /> : <RiArrowDownSLine size={14} />}
              </button>
            </div>

            {isOpen && (
              <div className="habit-details">
                <div className="habit-dot-strip">
                  {dotDays.map(key => (
                    <span
                      key={key}
                      className={`habit-dot ${logsByDate.get(key)?.[habit.id] ? 'filled' : ''}`}
                      title={key}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {habits.length === 0 && !adding && (
        <div className="empty-state" style={{ padding: '24px 0' }}>
          Nenhum hábito ainda. Comece com 3 a 5.
        </div>
      )}

      {adding ? (
        <div className="habit-add-row">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Nome do hábito (ex: Dormir 7h+)"
          />
          <select
            className="calendar-select"
            value={newFrequency}
            onChange={e => setNewFrequency(Number(e.target.value))}
            aria-label="Frequência"
          >
            {FREQUENCY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <button className="btn btn-primary btn-sm btn-icon" onClick={handleAdd} aria-label="Salvar">
            <RiCheckLine size={14} />
          </button>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setAdding(false); setNewName(''); setNewFrequency(7) }} aria-label="Cancelar">
            <RiCloseLine size={14} />
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>
            <RiAddLine size={14} /> Adicionar hábito
          </button>
          <Link to="/planejar/habitos" className="hoje-section-link">gerenciar hábitos →</Link>
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  )
}
