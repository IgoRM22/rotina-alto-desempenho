import React, { useEffect, useMemo, useState } from 'react'
import {
  RiAddLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiCheckLine,
  RiCloseLine,
  RiDeleteBinLine,
  RiPencilLine,
} from '@remixicon/react'
import { listenHabits, addHabit, updateHabit, deleteHabit, listenHabitLogs } from '../../services/firestore'
import { dateKeyFromDate, getWeekStart, addDays, todayKey } from '../../utils/date'
import Toast from '../../components/Toast'

const HEATMAP_WEEKS = 14
const WEEKDAY_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

const heatmapLevel = (ratio) => {
  if (ratio <= 0) return 0
  if (ratio < 0.34) return 1
  if (ratio < 0.67) return 2
  if (ratio < 1) return 3
  return 4
}

const buildMonthCells = (year, month) => {
  const first = new Date(year, month, 1)
  const startOffset = first.getDay()
  const totalDays = new Date(year, month + 1, 0).getDate()

  return Array.from({ length: 42 }, (_, idx) => {
    const dayNumber = idx - startOffset + 1
    const dayDate = new Date(year, month, dayNumber)
    const inMonth = dayNumber >= 1 && dayNumber <= totalDays
    return {
      key: dateKeyFromDate(dayDate),
      dayNumber: dayDate.getDate(),
      inMonth,
      isToday: dateKeyFromDate(dayDate) === todayKey(),
    }
  })
}

export default function Habitos() {
  const [habits, setHabits] = useState([])
  const [logs, setLogs] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [calendarCursor, setCalendarCursor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [toast, setToast] = useState(null)

  useEffect(() => {
    const u1 = listenHabits(setHabits)
    const u2 = listenHabitLogs(setLogs, 400)
    return () => { u1(); u2() }
  }, [])

  useEffect(() => {
    if (!selectedId && habits.length) setSelectedId(habits[0].id)
  }, [habits, selectedId])

  const logsByDate = useMemo(() => new Map(logs.map(l => [l.date, l.checked || {}])), [logs])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const heatmapDays = useMemo(() => {
    const start = getWeekStart(addDays(new Date(), -(HEATMAP_WEEKS - 1) * 7))
    return Array.from({ length: HEATMAP_WEEKS * 7 }, (_, i) => addDays(start, i))
  }, [])

  const today = todayKey()
  const activeHabitCount = habits.length

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) { setAdding(false); return }
    await addHabit({ name })
    setNewName('')
    setAdding(false)
    showToast('Hábito criado!')
  }

  const startRename = (habit) => {
    setEditingId(habit.id)
    setEditingName(habit.name)
  }

  const saveRename = async () => {
    const name = editingName.trim()
    if (name) await updateHabit(editingId, { name })
    setEditingId(null)
  }

  const handleDelete = async (habit) => {
    const proceed = window.confirm(`Excluir o hábito "${habit.name}"? O histórico de marcações não é apagado, mas deixa de aparecer.`)
    if (!proceed) return
    await deleteHabit(habit.id)
    if (selectedId === habit.id) setSelectedId(null)
    showToast('Hábito removido.')
  }

  const selectedHabit = habits.find(h => h.id === selectedId)
  const calendarYear = calendarCursor.getFullYear()
  const calendarMonth = calendarCursor.getMonth()
  const monthCells = useMemo(() => buildMonthCells(calendarYear, calendarMonth), [calendarYear, calendarMonth])
  const monthLabel = calendarCursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <>
      <div className="habitos-section">
        <div className="hoje-section-head">
          <h2 className="hoje-section-title">Últimas {HEATMAP_WEEKS} semanas</h2>
          <span className="subpage-controls-note" style={{ marginRight: 0 }}>intensidade = % de hábitos concluídos no dia</span>
        </div>
        <div className="habit-heatmap-wrap">
          <div className="habit-heatmap-weekdays">
            {WEEKDAY_SHORT.map((d, i) => <span key={i}>{d}</span>)}
          </div>
          <div className="habit-heatmap-grid">
            {heatmapDays.map(day => {
              const key = dateKeyFromDate(day)
              const isFuture = key > today
              const checked = logsByDate.get(key) || {}
              const doneCount = Object.values(checked).filter(Boolean).length
              const ratio = activeHabitCount > 0 ? doneCount / activeHabitCount : 0
              const level = isFuture ? -1 : heatmapLevel(ratio)
              return (
                <div
                  key={key}
                  className={`habit-heatmap-cell ${level >= 0 ? `level-${level}` : 'is-future'}`}
                  title={isFuture ? '' : `${day.toLocaleDateString('pt-BR')} — ${doneCount}/${activeHabitCount}`}
                />
              )
            })}
          </div>
        </div>
      </div>

      <div className="habitos-section">
        <div className="hoje-section-head">
          <h2 className="hoje-section-title">Seus hábitos</h2>
        </div>
        <div className="habit-manage-list">
          {habits.map(habit => (
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
                  <button className="btn btn-primary btn-sm btn-icon" onClick={saveRename} aria-label="Salvar"><RiCheckLine size={13} /></button>
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setEditingId(null)} aria-label="Cancelar"><RiCloseLine size={13} /></button>
                </>
              ) : (
                <>
                  <button type="button" className="habit-manage-name" onClick={() => setSelectedId(habit.id)}>
                    {habit.name}
                  </button>
                  <span className="subpage-controls-note" style={{ marginRight: 0 }}>recorde: {habit.bestStreak || 0}</span>
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => startRename(habit)} aria-label="Renomear"><RiPencilLine size={13} /></button>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(habit)} aria-label="Excluir"><RiDeleteBinLine size={13} /></button>
                </>
              )}
            </div>
          ))}

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
              <button className="btn btn-primary btn-sm btn-icon" onClick={handleAdd} aria-label="Salvar"><RiCheckLine size={14} /></button>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setAdding(false); setNewName('') }} aria-label="Cancelar"><RiCloseLine size={14} /></button>
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
            <h2 className="hoje-section-title">Histórico — {selectedHabit.name}</h2>
          </div>
          <div className="month-calendar-wrap">
            <div className="month-calendar-toolbar">
              <div className="month-calendar-nav">
                <button type="button" className="month-calendar-arrow" onClick={() => setCalendarCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1))} aria-label="Mês anterior">
                  <RiArrowLeftSLine size={16} />
                </button>
                <div className="month-calendar-period">{monthLabel}</div>
                <button type="button" className="month-calendar-arrow" onClick={() => setCalendarCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1))} aria-label="Próximo mês">
                  <RiArrowRightSLine size={16} />
                </button>
              </div>
              <div className="month-calendar-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => { const n = new Date(); setCalendarCursor(new Date(n.getFullYear(), n.getMonth(), 1)) }}>Hoje</button>
              </div>
            </div>

            <div className="month-calendar-grid">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                <div key={i} className="month-weekday">{d}</div>
              ))}
              {monthCells.map(cell => {
                const checked = !!logsByDate.get(cell.key)?.[selectedHabit.id]
                return (
                  <div key={cell.key} className={`month-cell habit-month-cell ${cell.inMonth ? '' : 'is-outside'} ${cell.isToday ? 'is-today' : ''}`}>
                    <span className="month-cell-day" style={{ cursor: 'default' }}>{cell.dayNumber}</span>
                    {cell.inMonth && checked && <span className="habit-month-check"><RiCheckLine size={14} /></span>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </>
  )
}
