import React, { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { RiAddLine, RiCheckboxBlankLine } from '@remixicon/react'
import {
  listenTodos, updateTodo, listenWeekFocus, listenHabits, listenHabitLogs,
  listenImportantDates, listenGoals, listenPrefs,
} from '../services/firestore'
import HabitChecklist from '../components/HabitChecklist'
import DailyLogCard from '../components/DailyLogCard'
import RevisaoSemanal from '../components/RevisaoSemanal'
import CommitmentList from '../components/CommitmentList'
import Tabs from '../components/Tabs'
import TaskDetailModal from '../components/TaskDetailModal'
import BoltIcon from '../components/BoltIcon'
import { todayKey, getWeekKey, dateKeyFromDate, addDays } from '../utils/date'
import { bestCurrentStreak } from '../utils/streak'
import { expandImportantDatesForRange } from '../utils/importantDates'

const WEEKDAY_LABELS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
const MONTH_LABELS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const STALLED_GOAL_DAYS = 10

const dayOfYear = (date) => {
  const start = new Date(date.getFullYear(), 0, 0)
  return Math.floor((date - start) / 86400000)
}

export default function Home() {
  // Fica na URL (?view=revisao) em vez de estado local — assim QUALQUER link
  // pra "Hoje" (inclusive o ícone da nav inferior no mobile) realmente volta
  // pra visão Hoje, mesmo se a pessoa estiver presa rolada lá embaixo na
  // Revisão Semanal. Com estado local puro, clicar em "Hoje" na nav inferior
  // não fazia nada — já estava na mesma rota "/", React Router não navegava.
  const [searchParams, setSearchParams] = useSearchParams()
  const view = searchParams.get('view') === 'revisao' ? 'revisao' : 'hoje'
  const setView = (next) => setSearchParams(next === 'revisao' ? { view: 'revisao' } : {})

  // Trocar Hoje <-> Revisão semanal não muda de página inteira, então o
  // navegador não rola pro topo sozinho — sem isso, o toggle no topo da nova
  // visão poderia ficar fora da tela se a pessoa estivesse rolada.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [view])
  const [todos, setTodos] = useState([])
  const [focus, setFocus] = useState(null)
  const [habits, setHabits] = useState([])
  const [habitLogs, setHabitLogs] = useState([])
  const [importantDates, setImportantDates] = useState([])
  const [goals, setGoals] = useState([])
  const [prefs, setPrefs] = useState({})
  const [viewingTodo, setViewingTodo] = useState(null)

  useEffect(() => {
    const u1 = listenTodos(setTodos)
    const u2 = listenImportantDates(setImportantDates)
    const u3 = listenHabits(setHabits)
    const u4 = listenHabitLogs(setHabitLogs, 120)
    const u5 = listenGoals(setGoals)
    const u6 = listenPrefs(setPrefs)
    return () => { u1(); u2(); u3(); u4(); u5(); u6() }
  }, [])

  const weekKey = getWeekKey()

  useEffect(() => {
    const unsub = listenWeekFocus(weekKey, setFocus)
    return unsub
  }, [weekKey])

  const dateKey = todayKey()
  const now = new Date()
  const todayTodos = todos.filter(t => t.todayDate === dateKey)
  const todayDone = todayTodos.filter(t => t.done).length
  const suggestions = todos.filter(t => !t.done && t.todayDate !== dateKey && t.dueDate && t.dueDate <= dateKey)
  const focusItems = focus?.items || []

  const logsByDate = useMemo(() => new Map(habitLogs.map(l => [l.date, l.checked || {}])), [habitLogs])
  const todayHabitChecked = logsByDate.get(dateKey) || {}
  const habitsDone = habits.filter(h => todayHabitChecked[h.id]).length

  const toggle = (todo) => updateTodo(todo.id, { done: !todo.done })
  const pullToToday = (todo) => updateTodo(todo.id, { todayDate: dateKey })

  const allTasksDone = todayTodos.length > 0 && todayDone === todayTodos.length
  const todayCommitments = expandImportantDatesForRange(importantDates, now, now)

  // ── Hero: melhor sequência atual + sparkline da semana ──
  const best = useMemo(
    () => (habits.length ? bestCurrentStreak(habits, logsByDate, dateKey) : null),
    [habits, logsByDate, dateKey],
  )

  const sparkPoints = useMemo(() => {
    if (!habits.length) return null
    const days = Array.from({ length: 7 }, (_, i) => dateKeyFromDate(addDays(now, i - 6)))
    return days
      .map((key, i) => {
        const checked = logsByDate.get(key) || {}
        const done = habits.filter(h => checked[h.id]).length
        const ratio = done / habits.length
        const x = (i * (200 / 6)).toFixed(1)
        const y = (44 - ratio * 38).toFixed(1)
        return `${x},${y}`
      })
      .join(' ')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habits, logsByDate, dateKey])

  // ── Compromisso pessoal (Ajustes → Seus compromissos), rotaciona por dia ──
  const commitments = Array.isArray(prefs.commitments) ? prefs.commitments.filter(c => c?.text) : []
  const commitment = commitments.length ? commitments[dayOfYear(now) % commitments.length] : null

  // ── Sinal de desvio: 1 por vez, na ordem de urgência ──
  const signal = useMemo(() => {
    const overdue = todos.filter(t => !t.done && t.dueDate && t.dueDate < dateKey)
    if (overdue.length > 0) {
      return {
        variant: 'is-coral',
        text: <>Você tem <strong>{overdue.length} tarefa{overdue.length > 1 ? 's' : ''} vencida{overdue.length > 1 ? 's' : ''}</strong> esperando decisão — concluir, reagendar ou soltar.</>,
        to: '/planejar/tarefas',
        cta: 'Ver tarefas',
      }
    }

    if (now.getHours() >= 18 && habits.length) {
      const atRisk = habits
        .map(h => ({ habit: h, streak: bestCurrentStreak([h], logsByDate, dateKey)?.streak || 0 }))
        .filter(({ habit, streak }) => streak >= 3 && !todayHabitChecked[habit.id])
        .sort((a, b) => b.streak - a.streak)[0]
      if (atRisk) {
        return {
          variant: '',
          text: <>Sua sequência de <strong>{atRisk.streak} dias</strong> em <strong>"{atRisk.habit.name}"</strong> está em risco — ainda dá tempo hoje.</>,
          to: '/planejar/habitos',
          cta: 'Marcar agora',
        }
      }
    }

    const cutoff = Date.now() / 1000 - STALLED_GOAL_DAYS * 86400
    const stalled = goals
      .filter(g => !g.done)
      .map(g => ({ goal: g, ts: g.updatedAt?.seconds ?? g.createdAt?.seconds ?? null }))
      .filter(({ ts }) => ts !== null && ts < cutoff)
      .sort((a, b) => a.ts - b.ts)[0]
    if (stalled) {
      const days = Math.floor((Date.now() / 1000 - stalled.ts) / 86400)
      return {
        variant: '',
        text: <>Sua meta <strong>"{stalled.goal.title}"</strong> está parada há <strong>{days} dias</strong> — nenhum progresso registrado.</>,
        to: '/planejar/metas',
        cta: 'Retomar',
      }
    }

    if (allTasksDone && habits.length > 0 && habitsDone === habits.length) {
      return {
        variant: 'is-sage',
        text: <>Dia redondo — <strong>todas as tarefas e hábitos</strong> concluídos. Nada fora do rumo.</>,
      }
    }

    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todos, goals, habits, logsByDate, dateKey, allTasksDone, habitsDone])

  return (
    <div className="page">
      {view === 'revisao' ? (
        <>
          <div className="page-header">
            <span className="page-kicker">Esta semana</span>
            <h1 className="page-title">Revisão semanal</h1>
            <div style={{ marginTop: 20 }}>
              <Tabs
                variant="segmented"
                items={[{ key: 'hoje', label: 'Hoje' }, { key: 'revisao', label: 'Revisão semanal' }]}
                active={view}
                onChange={setView}
              />
            </div>
          </div>
          <RevisaoSemanal />
        </>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <Tabs
              variant="segmented"
              items={[{ key: 'hoje', label: 'Hoje' }, { key: 'revisao', label: 'Revisão semanal' }]}
              active={view}
              onChange={setView}
            />
          </div>

          <div className="hero">
            <div className="hero-date reveal" style={{ '--d': 0 }}>
              <div className="hero-day">{String(now.getDate()).padStart(2, '0')}</div>
              <div className="hero-month">{MONTH_LABELS[now.getMonth()]}</div>
              <div className="hero-weekday">{WEEKDAY_LABELS[now.getDay()]}</div>
              <div className="hero-commitment">
                <div className="hero-commitment-label">seu compromisso</div>
                {commitment ? (
                  <p>"{commitment.text}"</p>
                ) : (
                  <Link to="/config">Escreva seus compromissos em Ajustes — eles aparecem aqui todos os dias →</Link>
                )}
              </div>
            </div>
            <div className="hero-side reveal" style={{ '--d': 0.25 }}>
              {best && best.streak > 0 ? (
                <div className="hero-streak">
                  <BoltIcon size={16} color="var(--gold)" />
                  <span className="hero-streak-num">{best.streak}</span>
                  <span className="hero-streak-txt">dias seguidos — {best.habit.name}</span>
                </div>
              ) : (
                <div className="hero-streak">
                  <BoltIcon size={16} color="var(--text3)" />
                  <span className="hero-streak-txt">nenhuma sequência ativa ainda</span>
                </div>
              )}
              {sparkPoints && (
                <div>
                  <div className="hero-spark-label">hábitos nos últimos 7 dias</div>
                  <div className="hero-spark">
                    <svg viewBox="0 0 200 50" preserveAspectRatio="none">
                      <polyline points={sparkPoints} fill="none" stroke="var(--coral)" strokeWidth="2" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </div>

          {(todayTodos.length > 0 || habits.length > 0) && (
            <div className="hoje-pills reveal" style={{ '--d': 0.35 }}>
              {todayTodos.length > 0 && (
                <span className="status-pill is-coral"><span className="dot" />{todayDone}/{todayTodos.length} tarefas hoje</span>
              )}
              {habits.length > 0 && (
                <span className="status-pill is-sage"><span className="dot" />{habitsDone}/{habits.length} hábitos hoje</span>
              )}
              {focusItems.length > 0 && (
                <span className="status-pill is-violet"><span className="dot" />{focusItems.length} foco{focusItems.length > 1 ? 's' : ''} da semana</span>
              )}
            </div>
          )}

          {signal && (
            <div className={`hoje-signal reveal ${signal.variant}`} style={{ '--d': 0.5 }}>
              <p>{signal.text}</p>
              {signal.to && <Link to={signal.to} className="btn btn-ghost btn-sm">{signal.cta}</Link>}
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
                        <div className="todo-content-clickable" onClick={() => setViewingTodo(todo)}>
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
                          <div className="todo-content-clickable" onClick={() => setViewingTodo(todo)}>
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

      <TaskDetailModal todo={viewingTodo} onClose={() => setViewingTodo(null)} />
    </div>
  )
}
