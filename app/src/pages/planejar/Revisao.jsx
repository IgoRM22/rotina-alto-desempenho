import React, { useEffect, useMemo, useState } from 'react'
import { RiAddLine, RiCheckLine, RiCloseLine } from '@remixicon/react'
import { listenHabits, listenHabitLogs, listenDailyLogsForDates, listenWeekFocus, saveWeekFocus } from '../../services/firestore'
import { getWeekDates, getWeekLabel, getWeekKey, dateKeyFromDate, addDays, todayKey, weekDayShortLabel } from '../../utils/date'
import { buildHabitWeekTable, collectAnnotations, computeWeekCompletionPct } from '../../utils/weekSummary'
import Tabs from '../../components/Tabs'

export default function Revisao() {
  const [habits, setHabits] = useState([])
  const [habitLogs, setHabitLogs] = useState([])
  const [dailyLogs, setDailyLogs] = useState([])
  const [focus, setFocus] = useState(null)
  const [newFocusItem, setNewFocusItem] = useState('')
  const [activeTab, setActiveTab] = useState('funcionou')

  const weekDates = useMemo(() => getWeekDates(), [])
  const weekLabel = getWeekLabel()
  const dateKeys = useMemo(() => weekDates.map(dateKeyFromDate), [weekDates])
  const nextWeekKey = useMemo(() => getWeekKey(addDays(new Date(), 7)), [])

  useEffect(() => {
    const unsub = listenHabits(setHabits)
    return unsub
  }, [])

  useEffect(() => {
    const unsub = listenHabitLogs(setHabitLogs, 14)
    return unsub
  }, [])

  useEffect(() => {
    const unsub = listenDailyLogsForDates(dateKeys, setDailyLogs)
    return unsub
  }, [dateKeys])

  useEffect(() => {
    const unsub = listenWeekFocus(nextWeekKey, setFocus)
    return unsub
  }, [nextWeekKey])

  const table = useMemo(() => buildHabitWeekTable(habits, habitLogs, weekDates), [habits, habitLogs, weekDates])
  const funcionou = useMemo(() => collectAnnotations(dailyLogs, 'funcionou'), [dailyLogs])
  const ajustar = useMemo(() => collectAnnotations(dailyLogs, 'ajustar'), [dailyLogs])

  const todayIdx = dateKeys.indexOf(todayKey())
  const daysElapsed = todayIdx === -1 ? 7 : todayIdx + 1
  const pct = computeWeekCompletionPct(table, daysElapsed)

  const focusItems = focus?.items || []

  const addFocusItem = () => {
    const text = newFocusItem.trim()
    if (!text) return
    saveWeekFocus(nextWeekKey, [...focusItems, { id: `${Date.now()}`, text }])
    setNewFocusItem('')
  }

  const removeFocusItem = (id) => {
    saveWeekFocus(nextWeekKey, focusItems.filter(i => i.id !== id))
  }

  const list = activeTab === 'funcionou' ? funcionou : ajustar

  return (
    <>
      <section className="hoje-section">
        <div className="hoje-section-head">
          <h2 className="hoje-section-title">{weekLabel}</h2>
          <span className="subpage-controls-note" style={{ marginRight: 0 }}>{pct}% dos hábitos concluídos até agora</span>
        </div>

        {table.length === 0 ? (
          <div className="empty-state">Nenhum hábito cadastrado ainda.</div>
        ) : (
          <div className="week-table-wrap">
            <table className="week-table">
              <thead>
                <tr>
                  <th className="week-table-habit">Hábito</th>
                  {weekDates.map((d, i) => (
                    <th key={i} className={dateKeyFromDate(d) === todayKey() ? 'is-today' : ''}>{weekDayShortLabel(i)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.map(({ habit, cells }) => (
                  <tr key={habit.id}>
                    <td className="week-table-habit">{habit.name}</td>
                    {cells.map((done, i) => (
                      <td key={i} className={dateKeyFromDate(weekDates[i]) === todayKey() ? 'is-today' : ''}>
                        {done && <RiCheckLine size={14} className="week-table-check" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="hoje-section">
        <Tabs
          items={[{ key: 'funcionou', label: 'O que funcionou' }, { key: 'ajustar', label: 'O que ajustar' }]}
          active={activeTab}
          onChange={setActiveTab}
        />
        {list.length === 0 ? (
          <div className="empty-state">Nada registrado ainda essa semana.</div>
        ) : (
          <div>
            {list.map((item, i) => (
              <div key={i} className="annotation-row">
                <span className="subpage-controls-note" style={{ marginRight: 0 }}>
                  {new Date(item.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </span>
                <span className="annotation-text">{item.text}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="hoje-section">
        <div className="hoje-section-head">
          <h2 className="hoje-section-title">Foco da próxima semana</h2>
        </div>
        {focusItems.length > 0 && (
          <ul className="nb-focus-list">
            {focusItems.map(item => (
              <li key={item.id}>
                <span>{item.text}</span>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removeFocusItem(item.id)} aria-label="Remover">
                  <RiCloseLine size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="habit-add-row">
          <input
            value={newFocusItem}
            onChange={e => setNewFocusItem(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addFocusItem()}
            placeholder="Adicionar foco para a próxima semana..."
          />
          <button className="btn btn-primary btn-sm btn-icon" onClick={addFocusItem} aria-label="Adicionar">
            <RiAddLine size={14} />
          </button>
        </div>
      </section>
    </>
  )
}
