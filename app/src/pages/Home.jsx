import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { RiAddLine, RiCheckboxBlankLine } from '@remixicon/react'
import { listenTodos, updateTodo, listenWeekFocus, listenHabits, listenHabitLogs, listenImportantDates } from '../services/firestore'
import HabitChecklist from '../components/HabitChecklist'
import DailyLogCard from '../components/DailyLogCard'
import RevisaoSemanal from '../components/RevisaoSemanal'
import CommitmentList from '../components/CommitmentList'
import Tabs from '../components/Tabs'
import { todayKey, getWeekKey } from '../utils/date'
import { expandImportantDatesForRange } from '../utils/importantDates'

const WEEKDAY_LABELS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
const MONTH_LABELS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export default function Home() {
  const [view, setView] = useState('hoje')
  const [todos, setTodos] = useState([])
  const [focus, setFocus] = useState(null)
  const [habits, setHabits] = useState([])
  const [habitLogs, setHabitLogs] = useState([])
  const [importantDates, setImportantDates] = useState([])

  useEffect(() => {
    const unsub = listenTodos(setTodos)
    return unsub
  }, [])

  useEffect(() => {
    const unsub = listenImportantDates(setImportantDates)
    return unsub
  }, [])

  useEffect(() => {
    const unsub = listenHabits(setHabits)
    return unsub
  }, [])

  useEffect(() => {
    const unsub = listenHabitLogs(setHabitLogs, 2)
    return unsub
  }, [])

  const weekKey = getWeekKey()

  useEffect(() => {
    const unsub = listenWeekFocus(weekKey, setFocus)
    return unsub
  }, [weekKey])

  const dateKey = todayKey()
  const todayTodos = todos.filter(t => t.todayDate === dateKey)
  const todayDone = todayTodos.filter(t => t.done).length
  const suggestions = todos.filter(t => !t.done && t.todayDate !== dateKey && t.dueDate && t.dueDate <= dateKey)
  const now = new Date()
  const focusItems = focus?.items || []

  const todayHabitChecked = habitLogs.find(l => l.date === dateKey)?.checked || {}
  const habitsDone = habits.filter(h => todayHabitChecked[h.id]).length

  const toggle = (todo) => updateTodo(todo.id, { done: !todo.done })
  const pullToToday = (todo) => updateTodo(todo.id, { todayDate: dateKey })

  const allTasksDone = todayTodos.length > 0 && todayDone === todayTodos.length
  const todayCommitments = expandImportantDatesForRange(importantDates, now, now)

  return (
    <div className="page">
      <div className="page-header">
        <span className="page-kicker">{view === 'hoje' ? WEEKDAY_LABELS[now.getDay()] : 'Esta semana'}</span>
        <h1 className="page-title">
          {view === 'hoje' ? `${now.getDate()} de ${MONTH_LABELS[now.getMonth()]}` : 'Revisão semanal'}
        </h1>
        <div style={{ marginTop: 20 }}>
          <Tabs
            variant="segmented"
            items={[{ key: 'hoje', label: 'Hoje' }, { key: 'revisao', label: 'Revisão semanal' }]}
            active={view}
            onChange={setView}
          />
        </div>
      </div>

      {view === 'revisao' ? (
        <RevisaoSemanal />
      ) : (
        <>
          {(todayTodos.length > 0 || habits.length > 0) && (
            <div className="hoje-status-strip">
              {todayTodos.length > 0 && (
                <span className="hoje-status-item"><strong>{todayDone}</strong>/{todayTodos.length} tarefas</span>
              )}
              {todayTodos.length > 0 && habits.length > 0 && <span className="hoje-status-sep">·</span>}
              {habits.length > 0 && (
                <span className="hoje-status-item"><strong>{habitsDone}</strong>/{habits.length} hábitos</span>
              )}
            </div>
          )}

          {todayCommitments.length > 0 && (
            <section className="hoje-section">
              <div className="hoje-section-head">
                <h2 className="hoje-section-title">Compromissos de hoje</h2>
                <Link to="/planejar/agenda" className="hoje-section-link">ver agenda</Link>
              </div>
              <CommitmentList items={todayCommitments} />
            </section>
          )}

          <div className="hoje-grid">
            <div>
              <section className="hoje-section">
                <div className="hoje-section-head">
                  <h2 className="hoje-section-title">Tarefas do dia</h2>
                  <Link to="/planejar/tarefas" className="hoje-section-link">gerenciar tarefas</Link>
                </div>

                {allTasksDone && <div className="hoje-celebrate">Tudo feito por hoje 🎉</div>}

                {todayTodos.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon"><RiCheckboxBlankLine size={28} /></div>
                    Nenhuma tarefa marcada para hoje.<br />
                    <Link to="/planejar/tarefas" className="hoje-section-link">Escolha até 6 em Tarefas →</Link>
                  </div>
                ) : (
                  <div>
                    {todayTodos.map(todo => (
                      <div key={todo.id} className="todo-item">
                        <input
                          type="checkbox"
                          className="todo-check"
                          checked={todo.done}
                          onChange={() => toggle(todo)}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className={`todo-text ${todo.done ? 'done' : ''}`}>{todo.title}</div>
                          {todo.category && (
                            <div className="todo-meta">
                              <span className={`pill pill-${todo.category}`}>{todo.category}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {suggestions.length > 0 && (
                  <>
                    <div className="hoje-suggest-divider">Sugestões · vencidas ou vencendo hoje</div>
                    <div>
                      {suggestions.map(todo => (
                        <div key={todo.id} className="todo-item todo-item--no-check">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="todo-text">{todo.title}</div>
                            <div className="todo-meta">
                              {todo.category && <span className={`pill pill-${todo.category}`}>{todo.category}</span>}
                              <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                                {new Date(todo.dueDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                              </span>
                            </div>
                          </div>
                          <div className="todo-actions" style={{ opacity: 1 }}>
                            <button className="btn btn-primary btn-sm btn-icon" onClick={() => pullToToday(todo)} aria-label="Adicionar em hoje" title="Adicionar em hoje">
                              <RiAddLine size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>
            </div>

            <div>
              <section className="hoje-section">
                <div className="hoje-section-head">
                  <h2 className="hoje-section-title">Hábitos</h2>
                </div>
                <HabitChecklist />
              </section>

              <section className="hoje-section">
                <div className="hoje-section-head">
                  <h2 className="hoje-section-title">Registro do dia</h2>
                </div>
                <DailyLogCard />
              </section>
            </div>
          </div>

          {focusItems.length > 0 && (
            <section className="hoje-section">
              <div className="hoje-section-head">
                <h2 className="hoje-section-title">Foco da semana</h2>
                <button type="button" className="hoje-section-link" onClick={() => setView('revisao')}>revisão semanal</button>
              </div>
              <ul className="nb-focus-list" style={{ marginBottom: 0 }}>
                {focusItems.map(item => <li key={item.id}><span>{item.text}</span></li>)}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
