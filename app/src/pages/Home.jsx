import React, { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  RiAddLine, RiCheckboxBlankLine, RiTimerLine, RiArrowRightLine, RiDeleteBinLine, RiInboxLine,
} from '@remixicon/react'
import {
  listenTodos, updateTodo, deleteTodo, addTodo, listenWeekFocus, listenHabits, listenHabitLogs,
  listenImportantDates, listenGoals, listenPrefs,
  listenDailyLog, saveDailyLog, saveDailyAnnotations,
} from '../services/firestore'
import HabitChecklist from '../components/HabitChecklist'
import DailyLogCard from '../components/DailyLogCard'
import RevisaoSemanal from '../components/RevisaoSemanal'
import CommitmentList from '../components/CommitmentList'
import Tabs from '../components/Tabs'
import TaskDetailModal from '../components/TaskDetailModal'
import Modal from '../components/Modal'
import Toast from '../components/Toast'
import BoltIcon from '../components/BoltIcon'
import { todayKey, getWeekKey, dateKeyFromDate, addDays, MAX_TODAY_TASKS } from '../utils/date'
import { bestCurrentStreak, isDailyHabit } from '../utils/streak'
import { expandImportantDatesForRange } from '../utils/importantDates'

const WEEKDAY_LABELS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
const MONTH_LABELS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const STALLED_GOAL_DAYS = 10

const ANNOTATION_TAGS = [
  { value: 'funcionou', label: '✅ Funcionou' },
  { value: 'ajustar', label: '🔧 Ajustar' },
  { value: 'rabisco', label: '📝 Rabisco' },
]

const dayOfYear = (date) => {
  const start = new Date(date.getFullYear(), 0, 0)
  return Math.floor((date - start) / 86400000)
}

// Manhã e noite são o mesmo dia visto de dois ângulos — de manhã a página
// ajuda a entrar no dia, à noite ajuda a fechá-lo e plantar o de amanhã. Por
// isso é a mesma tela com saudação e seções que mudam com o horário, em vez
// de duas páginas (Hoje / Noturno) que competiam pelo mesmo espaço mental.
const greetingFor = (hour) => {
  if (hour < 5) return 'boa noite'
  if (hour < 12) return 'bom dia'
  if (hour < 18) return 'boa tarde'
  return 'boa noite'
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
  // Intenção do dia: renovada toda manhã (ou plantada pelo Noturno da noite
  // anterior). "O que merece atenção hoje" — não é sobre tarefas, é sobre
  // direção. A "pergunta em aberto" NÃO mora aqui — isso é a pergunta
  // central de um caderno/tema em Notas, não um campo solto sem conexão
  // com nada.
  const [dailyLog, setDailyLog] = useState(null)
  const [intentionDraft, setIntentionDraft] = useState('')
  const [tomorrowLog, setTomorrowLog] = useState(null)
  const [tomorrowIntentionDraft, setTomorrowIntentionDraft] = useState('')
  const [newTomorrowTask, setNewTomorrowTask] = useState('')
  const [annotationText, setAnnotationText] = useState('')
  const [showParkingModal, setShowParkingModal] = useState(false)
  const [toast, setToast] = useState(null)
  // Só existe para a página re-renderizar e o relógio do hero avançar sozinho.
  const [, setClockTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setClockTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const u1 = listenTodos(setTodos)
    const u2 = listenImportantDates(setImportantDates)
    const u3 = listenHabits(setHabits)
    const u4 = listenHabitLogs(setHabitLogs, 120)
    const u5 = listenGoals(setGoals)
    const u6 = listenPrefs(setPrefs)
    const u7 = listenDailyLog(todayKey(), setDailyLog)
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7() }
  }, [])

  useEffect(() => { setIntentionDraft(dailyLog?.intention || '') }, [dailyLog])

  const saveIntention = () => {
    if (intentionDraft.trim() !== (dailyLog?.intention || '')) {
      saveDailyLog(todayKey(), { intention: intentionDraft.trim() })
    }
  }

  const weekKey = getWeekKey()

  useEffect(() => {
    const unsub = listenWeekFocus(weekKey, setFocus)
    return unsub
  }, [weekKey])

  const dateKey = todayKey()
  const now = new Date()
  const isEvening = now.getHours() >= 18 || now.getHours() < 5
  const greeting = greetingFor(now.getHours())
  const timeLabel = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const tomorrowDate = addDays(now, 1)
  const tomorrow = dateKeyFromDate(tomorrowDate)

  useEffect(() => {
    const unsub = listenDailyLog(tomorrow, setTomorrowLog)
    return unsub
  }, [tomorrow])

  useEffect(() => { setTomorrowIntentionDraft(tomorrowLog?.intention || '') }, [tomorrowLog])

  // Intenção de amanhã é o mesmo campo que esta página lê como "seu
  // compromisso" quando amanhã virar hoje — o fechamento da noite planta o
  // dia seguinte, sem duplicar dado.
  const saveTomorrowIntention = () => {
    if (tomorrowIntentionDraft.trim() !== (tomorrowLog?.intention || '')) {
      saveDailyLog(tomorrow, { intention: tomorrowIntentionDraft.trim() })
    }
  }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }
  const todayTodos = todos.filter(t => t.todayDate === dateKey)
  const todayDone = todayTodos.filter(t => t.done).length
  const suggestions = todos.filter(t => !t.done && t.todayDate !== dateKey && t.dueDate && t.dueDate <= dateKey)
  const focusItems = focus?.items || []

  const logsByDate = useMemo(() => new Map(habitLogs.map(l => [l.date, l.checked || {}])), [habitLogs])
  const todayHabitChecked = logsByDate.get(dateKey) || {}
  // Hábitos com meta semanal (ex: 3x por semana) não são "esperados hoje" —
  // contar eles junto dos diários deixava a contagem "N/M hábitos hoje"
  // sempre incompleta mesmo em dias em que nada ficou de fora.
  const dailyHabits = useMemo(() => habits.filter(isDailyHabit), [habits])
  const habitsDone = dailyHabits.filter(h => todayHabitChecked[h.id]).length

  const toggle = (todo) => updateTodo(todo.id, { done: !todo.done })
  const pullToToday = (todo) => updateTodo(todo.id, { todayDate: dateKey })

  const allTasksDone = todayTodos.length > 0 && todayDone === todayTodos.length
  const todayCommitments = expandImportantDatesForRange(importantDates, now, tomorrowDate)
    .map(occ => ({ ...occ, tag: dateKeyFromDate(occ.occurrenceStart) === dateKey ? 'hoje' : 'amanhã' }))

  // ── Fechamento do dia / planejamento de amanhã (herdado do antigo Noturno) ──
  const todayPending = todayTodos.filter(t => !t.done)
  const tomorrowTasks = todos.filter(t => t.todayDate === tomorrow)
  const tomorrowSuggestions = todos.filter(t => !t.done && t.todayDate !== tomorrow && t.dueDate && t.dueDate <= tomorrow)
  const parkingLotTasks = todos.filter(t => !t.done && !t.folderId && t.todayDate !== dateKey && t.todayDate !== tomorrow)
  const annotations = dailyLog?.annotations || []

  const removeTask = (todo) => deleteTodo(todo.id)

  const moveToTomorrow = async (todo) => {
    if (tomorrowTasks.length >= MAX_TODAY_TASKS) {
      showToast(`Amanhã já tem ${MAX_TODAY_TASKS} tarefas.`, 'error')
      return
    }
    const postponeCount = (todo.postponeCount || 0) + 1
    await updateTodo(todo.id, { todayDate: tomorrow, done: false, postponeCount })
    if (postponeCount === 3) {
      showToast(`"${todo.title}" já foi adiada 3 vezes — ela ainda importa?`, 'error')
    }
  }

  const moveAllPendingToTomorrow = async () => {
    const room = MAX_TODAY_TASKS - tomorrowTasks.length
    if (room <= 0) {
      showToast(`Amanhã já tem ${MAX_TODAY_TASKS} tarefas.`, 'error')
      return
    }
    const toMove = todayPending.slice(0, room)
    await Promise.all(toMove.map(t => updateTodo(t.id, {
      todayDate: tomorrow,
      done: false,
      postponeCount: (t.postponeCount || 0) + 1,
    })))
    showToast(`${toMove.length} tarefa(s) movida(s) para amanhã.`)
  }

  const addTomorrowTask = async () => {
    const title = newTomorrowTask.trim()
    if (!title) return
    if (tomorrowTasks.length >= MAX_TODAY_TASKS) {
      showToast(`Amanhã já tem ${MAX_TODAY_TASKS} tarefas.`, 'error')
      return
    }
    await addTodo({ title, todayDate: tomorrow, priority: 'media', category: 'projeto' })
    setNewTomorrowTask('')
  }

  const unmarkTomorrow = (todo) => updateTodo(todo.id, { todayDate: null })

  const addAnnotation = async (tag) => {
    const text = annotationText.trim()
    if (!text) return
    const next = [...annotations, { id: `${Date.now()}`, text, tag }]
    await saveDailyAnnotations(dateKey, next)
    setAnnotationText('')
  }

  const removeAnnotation = async (id) => {
    await saveDailyAnnotations(dateKey, annotations.filter(a => a.id !== id))
  }

  // ── Hero: melhor sequência atual + sparkline da semana ──
  const best = useMemo(
    () => (dailyHabits.length ? bestCurrentStreak(dailyHabits, logsByDate, dateKey) : null),
    [dailyHabits, logsByDate, dateKey],
  )

  const sparkPoints = useMemo(() => {
    if (!dailyHabits.length) return null
    const days = Array.from({ length: 7 }, (_, i) => dateKeyFromDate(addDays(now, i - 6)))
    return days
      .map((key, i) => {
        const checked = logsByDate.get(key) || {}
        const done = dailyHabits.filter(h => checked[h.id]).length
        const ratio = done / dailyHabits.length
        const x = (i * (200 / 6)).toFixed(1)
        const y = (44 - ratio * 38).toFixed(1)
        return `${x},${y}`
      })
      .join(' ')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyHabits, logsByDate, dateKey])

  // ── Compromisso pessoal (Ajustes → Seus compromissos), rotaciona por dia ──
  const commitments = Array.isArray(prefs.commitments) ? prefs.commitments.filter(c => c?.text) : []
  const commitment = commitments.length ? commitments[dayOfYear(now) % commitments.length] : null

  // ── Sinal de desvio: mostra o mais urgente, mas conta quantos outros
  // também estão pedindo atenção — senão, resolver o primeiro escondia os
  // demais até você voltar a esbarrar neles um por um. ──
  const signal = useMemo(() => {
    const candidates = []

    const overdue = todos.filter(t => !t.done && t.dueDate && t.dueDate < dateKey)
    if (overdue.length > 0) {
      candidates.push({
        variant: 'is-coral',
        text: <>Você tem <strong>{overdue.length} tarefa{overdue.length > 1 ? 's' : ''} vencida{overdue.length > 1 ? 's' : ''}</strong> esperando decisão — concluir, reagendar ou soltar.</>,
        to: '/planejar/tarefas',
        cta: 'Ver tarefas',
      })
    }

    if (now.getHours() >= 18 && dailyHabits.length) {
      const atRisk = dailyHabits
        .map(h => ({ habit: h, streak: bestCurrentStreak([h], logsByDate, dateKey)?.streak || 0 }))
        .filter(({ habit, streak }) => streak >= 3 && !todayHabitChecked[habit.id])
        .sort((a, b) => b.streak - a.streak)[0]
      if (atRisk) {
        candidates.push({
          variant: '',
          text: <>Sua sequência de <strong>{atRisk.streak} dias</strong> em <strong>"{atRisk.habit.name}"</strong> está em risco — ainda dá tempo hoje.</>,
          to: '/planejar/habitos',
          cta: 'Marcar agora',
        })
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
      candidates.push({
        variant: '',
        text: <>Sua meta <strong>"{stalled.goal.title}"</strong> está parada há <strong>{days} dias</strong> — nenhum progresso registrado.</>,
        to: '/planejar/metas',
        cta: 'Retomar',
      })
    }

    if (!dailyLog?.intention?.trim()) {
      candidates.push({
        variant: '',
        text: <>Você ainda não escreveu seu <strong>compromisso de hoje</strong> — uma frase já ajuda a direcionar o dia.</>,
      })
    }

    if (candidates.length > 0) {
      const [primary, ...rest] = candidates
      return { ...primary, otherCount: rest.length }
    }

    if (allTasksDone && dailyHabits.length > 0 && habitsDone === dailyHabits.length) {
      return {
        variant: 'is-sage',
        text: <>Dia redondo — <strong>todas as tarefas e hábitos</strong> concluídos. Nada fora do rumo.</>,
      }
    }

    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todos, goals, dailyHabits, logsByDate, dateKey, allTasksDone, habitsDone, dailyLog])

  return (
    <div className="page">
      {/* Fica fora do branch hoje/revisão de propósito: se cada visão renderizasse
          o próprio toggle dentro do seu layout, ele pulava de posição ao trocar
          (um ficava dentro do page-header, o outro solto no topo). Assim é sempre
          o mesmo lugar, nas duas visões, mobile ou desktop. */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Tabs
          variant="segmented"
          items={[{ key: 'hoje', label: 'Hoje' }, { key: 'revisao', label: 'Revisão semanal' }]}
          active={view}
          onChange={setView}
        />
      </div>

      {view === 'revisao' ? (
        <>
          <div className="page-header">
            <span className="page-kicker">Esta semana</span>
            <h1 className="page-title">Revisão semanal</h1>
          </div>
          <RevisaoSemanal />
        </>
      ) : (
        <>
          <div className="hero">
            <div className="hero-date reveal" style={{ '--d': 0 }}>
              <div className="hero-greeting"><span className="hero-greeting-word">{greeting}</span><span className="hero-greeting-time">{timeLabel}</span></div>
              <div className="hero-day">{String(now.getDate()).padStart(2, '0')}</div>
              <div className="hero-month">{MONTH_LABELS[now.getMonth()]}</div>
              <div className="hero-weekday">{WEEKDAY_LABELS[now.getDay()]}</div>
              <div className="hero-commitment">
                <div className="hero-commitment-label">seu compromisso</div>
                <input
                  className="hero-commitment-input"
                  value={intentionDraft}
                  onChange={e => setIntentionDraft(e.target.value)}
                  onBlur={saveIntention}
                  onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                  placeholder={commitment ? `"${commitment.text}"` : 'O que merece sua atenção hoje?'}
                />
                {!commitment && !intentionDraft && (
                  <Link to="/config" className="hero-commitment-hint">ou escreva seus compromissos fixos em Ajustes →</Link>
                )}
              </div>
            </div>
            <div className="hero-side reveal" style={{ '--d': 0.25 }}>
              <Link to="/planejar/foco" className="hero-focus-card">
                <span className="hero-focus-icon"><RiTimerLine size={20} /></span>
                <span className="hero-focus-text">
                  <span className="hero-focus-title">Iniciar foco</span>
                  <span className="hero-focus-sub">cada minuto conta para uma meta</span>
                </span>
              </Link>
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
              {dailyHabits.length > 0 && (
                <span className="status-pill is-sage"><span className="dot" />{habitsDone}/{dailyHabits.length} hábitos hoje</span>
              )}
              {focusItems.length > 0 && (
                <span className="status-pill is-violet"><span className="dot" />{focusItems.length} priorida{focusItems.length > 1 ? 'des' : 'de'} da semana</span>
              )}
            </div>
          )}

          {signal && (
            <div className={`hoje-signal reveal ${signal.variant}`} style={{ '--d': 0.5 }}>
              <div>
                <p>{signal.text}</p>
                {signal.otherCount > 0 && (
                  <p className="hoje-signal-more">+{signal.otherCount} outra{signal.otherCount > 1 ? 's' : ''} coisa{signal.otherCount > 1 ? 's' : ''} pedindo atenção</p>
                )}
              </div>
              {signal.to && <Link to={signal.to} className="btn btn-ghost btn-sm">{signal.cta}</Link>}
            </div>
          )}

          {todayCommitments.length > 0 && (
            <section className="hoje-section">
              <div className="hoje-section-head">
                <h2 className="hoje-section-title">Compromissos</h2>
                <Link to="/planejar/agenda" className="hoje-section-link">ver agenda</Link>
              </div>
              <CommitmentList items={todayCommitments} />
            </section>
          )}

          <div className="hoje-grid">
            <div>
              <section className="hoje-section">
                <div className="hoje-section-head">
                  <h2 className="hoje-section-title">Tarefas de hoje</h2>
                  {isEvening && todayPending.length > 0 ? (
                    <button className="btn btn-ghost btn-sm" onClick={moveAllPendingToTomorrow}>
                      <RiArrowRightLine size={13} /> mover pendentes p/ amanhã
                    </button>
                  ) : (
                    <Link to="/planejar/tarefas" className="hoje-section-link">gerenciar tarefas</Link>
                  )}
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
                        {isEvening && !todo.done && (
                          <div className="todo-actions" style={{ opacity: 1 }}>
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => moveToTomorrow(todo)} aria-label="Mover para amanhã" title="Mover para amanhã">
                              <RiArrowRightLine size={14} />
                            </button>
                          </div>
                        )}
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
                <h2 className="hoje-section-title">Prioridades da semana</h2>
                <button type="button" className="hoje-section-link" onClick={() => setView('revisao')}>revisão semanal</button>
              </div>
              <ul className="nb-focus-list" style={{ marginBottom: 0 }}>
                {focusItems.map(item => <li key={item.id}><span>{item.text}</span></li>)}
              </ul>
            </section>
          )}

          {/* Fechamento do dia — só aparece à noite, é quando faz sentido
              olhar pra amanhã. De dia essas seções somem sozinhas. */}
          {isEvening && (
            <>
              <section className="hoje-section hoje-section--tomorrow">
                <div className="hoje-section-head">
                  <h2 className="hoje-section-title">Tarefas de amanhã</h2>
                  <span className="subpage-controls-note" style={{ marginRight: 0 }}>{tomorrowTasks.length}/{MAX_TODAY_TASKS}</span>
                </div>

                {tomorrowTasks.map(todo => (
                  <div key={todo.id} className="todo-item todo-item--no-check">
                    <div className="todo-content-clickable" onClick={() => setViewingTodo(todo)}>
                      <div className="todo-text">{todo.title}</div>
                      {(todo.postponeCount || 0) >= 3 && (
                        <div className="todo-meta">
                          <span className="todo-postponed">adiada {todo.postponeCount}× — ainda importa, ou é hora de soltar?</span>
                        </div>
                      )}
                    </div>
                    <div className="todo-actions" style={{ opacity: 1 }}>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => unmarkTomorrow(todo)} aria-label="Remover de amanhã" title="Remover de amanhã">
                        <RiDeleteBinLine size={14} />
                      </button>
                    </div>
                  </div>
                ))}

                {tomorrowSuggestions.length > 0 && (
                  <div style={{ marginTop: 4, marginBottom: 4 }}>
                    <span className="subpage-controls-note" style={{ marginRight: 0 }}>sugestões (vencidas ou vencendo amanhã)</span>
                    {tomorrowSuggestions.map(todo => (
                      <div key={todo.id} className="todo-item todo-item--no-check">
                        <div className="todo-content-clickable" onClick={() => setViewingTodo(todo)}>
                          <div className="todo-text">{todo.title}</div>
                        </div>
                        <div className="todo-actions" style={{ opacity: 1 }}>
                          <button className="btn btn-primary btn-sm btn-icon" onClick={() => moveToTomorrow(todo)} aria-label="Adicionar em amanhã" title="Adicionar em amanhã">
                            <RiAddLine size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 4, marginBottom: 4 }} onClick={() => setShowParkingModal(true)}>
                  <RiInboxLine size={13} /> Puxar do Parking Lot{parkingLotTasks.length > 0 ? ` (${parkingLotTasks.length})` : ''}
                </button>

                {tomorrowTasks.length < MAX_TODAY_TASKS && (
                  <div className="habit-add-row">
                    <input
                      value={newTomorrowTask}
                      onChange={e => setNewTomorrowTask(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addTomorrowTask()}
                      placeholder="Nova tarefa para amanhã..."
                    />
                    <button className="btn btn-primary btn-sm btn-icon" onClick={addTomorrowTask} aria-label="Adicionar">
                      <RiAddLine size={14} />
                    </button>
                  </div>
                )}
              </section>

              <section className="hoje-section">
                <div className="hoje-section-head">
                  <h2 className="hoje-section-title">Anotações</h2>
                </div>
                <div className="daily-log-card">
                  <div className="field" style={{ marginBottom: 10 }}>
                    <textarea
                      rows={2}
                      value={annotationText}
                      onChange={e => setAnnotationText(e.target.value)}
                      placeholder="O que aconteceu hoje?"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: annotations.length ? 16 : 0 }}>
                    {ANNOTATION_TAGS.map(tag => (
                      <button key={tag.value} className="btn btn-ghost btn-sm" onClick={() => addAnnotation(tag.value)}>
                        {tag.label}
                      </button>
                    ))}
                  </div>
                  {annotations.length > 0 && (
                    <div>
                      {annotations.map(a => (
                        <div key={a.id} className="annotation-row">
                          <span className={`annotation-tag annotation-tag--${a.tag}`}>{ANNOTATION_TAGS.find(t => t.value === a.tag)?.label}</span>
                          <span className="annotation-text">{a.text}</span>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeAnnotation(a.id)} aria-label="Remover">
                            <RiDeleteBinLine size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="hoje-section">
                <div className="hoje-section-head">
                  <h2 className="hoje-section-title">Intenção de amanhã</h2>
                </div>
                <div className="direction-field">
                  <label htmlFor="tomorrow-intention">o que vai merecer sua atenção amanhã?</label>
                  <input
                    id="tomorrow-intention"
                    value={tomorrowIntentionDraft}
                    onChange={e => setTomorrowIntentionDraft(e.target.value)}
                    onBlur={saveTomorrowIntention}
                    onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                    placeholder="Aparece amanhã como seu compromisso"
                  />
                </div>
              </section>
            </>
          )}
        </>
      )}

      {showParkingModal && (
        <Modal
          title="Puxar do Parking Lot"
          onClose={() => setShowParkingModal(false)}
          onSave={() => setShowParkingModal(false)}
          saveLabel="Concluído"
          hideCancel
        >
          {parkingLotTasks.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px 0' }}>
              Parking Lot vazio — nada pra priorizar por aqui.
            </div>
          ) : (
            <div>
              {parkingLotTasks.map(todo => (
                <div key={todo.id} className="todo-item todo-item--no-check">
                  <div className="todo-content-clickable" onClick={() => setViewingTodo(todo)}>
                    <div className="todo-text">{todo.title}</div>
                    {todo.category && (
                      <div className="todo-meta">
                        <span className={`pill pill-${todo.category}`}>{todo.category}</span>
                      </div>
                    )}
                  </div>
                  <div className="todo-actions" style={{ opacity: 1 }}>
                    <button className="btn btn-primary btn-sm btn-icon" onClick={() => moveToTomorrow(todo)} aria-label="Priorizar para amanhã" title="Priorizar para amanhã">
                      <RiAddLine size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      <TaskDetailModal todo={viewingTodo} onClose={() => setViewingTodo(null)} />
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  )
}
