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
import Toast from './Toast'

const MILESTONES = [7, 30, 100, 365]

const computeStreak = (habitId, logsByDate, today) => {
  const cursor = new Date(`${today}T00:00:00`)
  if (!logsByDate.get(today)?.[habitId]) {
    cursor.setDate(cursor.getDate() - 1)
  }

  let streak = 0
  while (true) {
    const key = dateKeyFromDate(cursor)
    if (!logsByDate.get(key)?.[habitId]) break
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

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
    const newStreak = computeStreak(habit.id, simulated, today)
    const best = habit.bestStreak || 0

    if (newStreak > best) {
      updateHabit(habit.id, { bestStreak: newStreak })
    }
    if (MILESTONES.includes(newStreak)) {
      showToast(`🔥 ${newStreak} dias seguidos em "${habit.name}"!`)
    }
  }

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) { setAdding(false); return }
    await addHabit({ name })
    setNewName('')
    setAdding(false)
  }

  return (
    <div className="habit-list">
      {habits.map(habit => {
        const checked = !!todayChecked[habit.id]
        const streak = computeStreak(habit.id, logsByDate, today)
        const record = Math.max(habit.bestStreak || 0, streak)
        const isOpen = expanded.has(habit.id)

        return (
          <div key={habit.id} className="habit-row">
            <div className="habit-row-main">
              <button
                type="button"
                className="todo-check"
                style={checked ? { background: 'var(--coral)', borderColor: 'var(--coral)' } : undefined}
                onClick={() => toggle(habit)}
                aria-label={checked ? `Desmarcar ${habit.name}` : `Marcar ${habit.name}`}
              >
                {checked && <RiCheckLine size={11} style={{ color: '#fff' }} />}
              </button>
              <button type="button" className="habit-name habit-name-btn" onClick={() => toggleExpand(habit.id)}>
                {habit.name}
              </button>
              <span className={`habit-streak ${streak === 0 ? 'is-zero' : ''}`}>
                <RiFireLine size={13} /> {streak}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon"
                onClick={() => toggleExpand(habit.id)}
                aria-label={isOpen ? 'Recolher progresso' : 'Ver progresso'}
              >
                {isOpen ? <RiArrowUpSLine size={14} /> : <RiArrowDownSLine size={14} />}
              </button>
            </div>

            {isOpen && (
              <div className="habit-details">
                <div className="habit-details-stats">
                  <span><RiFireLine size={13} /> sequência atual: <strong>{streak}</strong></span>
                  <span><RiTrophyLine size={13} /> recorde: <strong>{record}</strong></span>
                </div>
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
          <button className="btn btn-primary btn-sm btn-icon" onClick={handleAdd} aria-label="Salvar">
            <RiCheckLine size={14} />
          </button>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setAdding(false); setNewName('') }} aria-label="Cancelar">
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
