import React, { useEffect, useMemo, useRef, useState } from 'react'
import { RiDeleteBinLine, RiPauseLine, RiPlayLine, RiStopLine } from '@remixicon/react'
import {
  listenGoals, listenFocusSessions, addFocusSession, deleteFocusSession,
  listenPrefs, savePrefs, listenNotebooks, addNote, addTodo,
} from '../../services/firestore'
import { todayKey, dateKeyFromDate, addDays } from '../../utils/date'
import { playChime, vibrateDevice, notifyPhaseEnd, updateLiveFocusNotification, closeLiveFocusNotification } from '../../utils/focusAlerts'
import BoltIcon from '../../components/BoltIcon'
import Toast from '../../components/Toast'
import Modal from '../../components/Modal'

const STORAGE_KEY = 'raio-foco-session'
const TARGET_OPTIONS = [30, 45, 60, 90, 120]
const WORK_OPTIONS = [15, 20, 25, 30, 45, 50]
const BREAK_OPTIONS = [5, 10, 15, 20]
// Foco deixa de ser só "cronômetro rodando" — cada sessão carrega uma
// intenção (o quê) desde o início e fecha com uma reflexão (o que descobri),
// pra atenção virar compreensão em vez de só minutos acumulados.

const loadStored = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const store = (session) => {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    else localStorage.removeItem(STORAGE_KEY)
  } catch { /* storage indisponível — timer segue só em memória */ }
}

const heatmapLevel = (ratio) => {
  if (ratio <= 0) return 0
  if (ratio < 0.34) return 1
  if (ratio < 0.67) return 2
  if (ratio < 1) return 3
  return 4
}

const fmtClock = (totalSec) => {
  const m = Math.floor(totalSec / 60)
  const s = Math.floor(totalSec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function Foco() {
  const [goals, setGoals] = useState([])
  const [sessions, setSessions] = useState([])
  const [prefs, setPrefs] = useState({})
  // Livre: { mode: 'livre', startedAt: ms | null (pausado), accumulatedSec, goalId }
  // Pomodoro: { mode: 'pomodoro', phase: 'work'|'break', phaseStartedAt: ms | null,
  //             phaseAccumulatedSec, cyclesCompleted, goalId }
  const [session, setSession] = useState(loadStored)
  const [pendingMode, setPendingMode] = useState('livre')
  const [tick, setTick] = useState(0)
  const [toast, setToast] = useState(null)
  // Guarda os dados da sessão que acabou de terminar (Livre) enquanto pede
  // a reflexão de fechamento — só grava de verdade depois que a pessoa
  // responde (ou pula) "o que descobri" / "próximo passo".
  const [pendingFinish, setPendingFinish] = useState(null)
  const [resultDraft, setResultDraft] = useState('')
  const [nextStepDraft, setNextStepDraft] = useState('')
  const [notebooks, setNotebooks] = useState([])
  const [reflectionTopicId, setReflectionTopicId] = useState('')
  const dischargeRef = useRef(null)

  useEffect(() => {
    const u1 = listenGoals(setGoals)
    const u2 = listenFocusSessions(setSessions, 300)
    const u3 = listenPrefs(setPrefs)
    const u4 = listenNotebooks(setNotebooks)
    return () => { u1(); u2(); u3(); u4() }
  }, [])

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  const isPomodoro = session?.mode === 'pomodoro'
  const running = isPomodoro ? !!session?.phaseStartedAt : !!session?.startedAt

  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(timer)
  }, [running])

  // Notificação com o cronômetro contando em tempo real enquanto a sessão
  // está rodando — some assim que pausa, termina ou a fase muda. Não retorna
  // cleanup a cada tick: fechar e recriar a notificação todo segundo faria
  // ela piscar/vibrar no Android em vez de só atualizar o texto.
  useEffect(() => {
    if (!running) {
      closeLiveFocusNotification()
      return
    }
    if (isPomodoro) {
      updateLiveFocusNotification(
        session.phase === 'work' ? 'Foco em andamento' : 'Pausa em andamento',
        fmtClock(remainingSec) + ' restantes',
      )
    } else {
      updateLiveFocusNotification('Foco em andamento', fmtClock(elapsedSec) + ' decorridos')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, tick, isPomodoro, session?.phase])

  useEffect(() => () => closeLiveFocusNotification(), [])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const target = TARGET_OPTIONS.includes(prefs.focusDailyTarget) ? prefs.focusDailyTarget : 60
  const workMin = WORK_OPTIONS.includes(prefs.pomodoroWork) ? prefs.pomodoroWork : 25
  const breakMin = BREAK_OPTIONS.includes(prefs.pomodoroBreak) ? prefs.pomodoroBreak : 5
  const today = todayKey()

  const elapsedSec = (session && !isPomodoro)
    ? session.accumulatedSec + (session.startedAt ? (Date.now() - session.startedAt) / 1000 : 0)
    : 0
  const elapsedMin = elapsedSec / 60

  const phaseDurationSec = isPomodoro ? (session.phase === 'work' ? workMin : breakMin) * 60 : 0
  const phaseElapsedSec = isPomodoro
    ? session.phaseAccumulatedSec + (session.phaseStartedAt ? (Date.now() - session.phaseStartedAt) / 1000 : 0)
    : 0
  const remainingSec = isPomodoro ? Math.max(0, phaseDurationSec - phaseElapsedSec) : 0

  const todaySessions = sessions.filter(s => s.date === today)
  const todayMinutes = todaySessions.reduce((sum, s) => sum + (s.minutes || 0), 0)
  const chargePct = isPomodoro
    ? Math.min(100, (phaseElapsedSec / phaseDurationSec) * 100)
    : Math.min(100, ((todayMinutes + elapsedMin) / target) * 100)

  const activeGoals = goals.filter(g => !g.done)
  const goalTitle = (id) => goals.find(g => g.id === id)?.title || null
  const linkedGoal = session ? goalTitle(session.goalId) : null

  // Hábitos tem o heatmap de 14 semanas pra dar aquele "estou mantendo isso?"
  // de relance — Foco não tinha nada parecido, só a lista plana de sessões.
  const last14Trend = useMemo(() => {
    const minutesByDate = new Map()
    sessions.forEach(s => {
      if (!s.date) return
      minutesByDate.set(s.date, (minutesByDate.get(s.date) || 0) + (s.minutes || 0))
    })
    const now = new Date()
    return Array.from({ length: 14 }, (_, i) => {
      const day = addDays(now, i - 13)
      const key = dateKeyFromDate(day)
      const minutes = minutesByDate.get(key) || 0
      return { key, day, minutes, level: heatmapLevel(minutes / target) }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, target])

  const goalTotals = useMemo(() => {
    const totals = new Map()
    sessions.forEach(s => {
      const key = s.goalId || '__none'
      totals.set(key, (totals.get(key) || 0) + (s.minutes || 0))
    })
    return Array.from(totals.entries())
      .map(([goalId, minutes]) => ({
        goalId,
        minutes,
        title: goalId === '__none' ? 'Sem meta vinculada' : (goalTitle(goalId) || 'Meta removida'),
      }))
      .sort((a, b) => b.minutes - a.minutes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, goals])

  const setAndStore = (next) => { setSession(next); store(next) }

  const celebrate = () => {
    const svg = dischargeRef.current
    if (svg) {
      svg.classList.remove('draw')
      void svg.getBoundingClientRect()
      svg.classList.add('draw')
    }
  }

  const start = (goalId) => {
    if (pendingMode === 'pomodoro') {
      setAndStore({
        mode: 'pomodoro',
        phase: 'work',
        phaseStartedAt: Date.now(),
        phaseAccumulatedSec: 0,
        cyclesCompleted: 0,
        goalId: goalId || null,
      })
    } else {
      setAndStore({ mode: 'livre', startedAt: Date.now(), accumulatedSec: 0, goalId: goalId || null })
    }
  }

  const pause = () => {
    if (!session) return
    if (isPomodoro) {
      if (!session.phaseStartedAt) return
      setAndStore({
        ...session,
        phaseStartedAt: null,
        phaseAccumulatedSec: session.phaseAccumulatedSec + (Date.now() - session.phaseStartedAt) / 1000,
      })
    } else {
      if (!session.startedAt) return
      setAndStore({
        ...session,
        startedAt: null,
        accumulatedSec: session.accumulatedSec + (Date.now() - session.startedAt) / 1000,
      })
    }
  }

  const resume = () => {
    if (!session) return
    if (isPomodoro) {
      if (session.phaseStartedAt) return
      setAndStore({ ...session, phaseStartedAt: Date.now() })
    } else {
      if (session.startedAt) return
      setAndStore({ ...session, startedAt: Date.now() })
    }
  }

  const finish = () => {
    if (!session || isPomodoro) return
    const minutes = Math.max(1, Math.round(elapsedSec / 60))
    // Não grava ainda — primeiro pergunta o que saiu da sessão. A sessão
    // "acabou" na tela (some o timer), mas o registro só vira dado quando
    // a reflexão é respondida ou pulada, logo abaixo.
    setPendingFinish({ minutes, goalId: session.goalId || null, category: session.category || null, objective: session.objective || null })
    setResultDraft('')
    setNextStepDraft('')
    setReflectionTopicId('')
    setAndStore(null)
  }

  const saveReflection = async (skip) => {
    if (!pendingFinish) return
    const result = skip ? null : (resultDraft.trim() || null)
    const nextStep = skip ? null : (nextStepDraft.trim() || null)
    await addFocusSession({ date: today, ...pendingFinish, result, nextStep })

    let extra = ''
    if (!skip && result && reflectionTopicId) {
      await addNote({
        title: pendingFinish.objective || `Sessão de foco — ${today}`,
        content: result,
        notebookId: reflectionTopicId,
        importance: 'media',
      })
      extra += ' Nota criada no tema.'
    }
    if (!skip && nextStep) {
      await addTodo({ title: nextStep, category: 'projeto' })
      extra += ' Próximo passo virou tarefa.'
    }

    showToast(`Sessão de ${pendingFinish.minutes} min registrada.${extra}`)
    setPendingFinish(null)
    // traço de conexão foco → meta (único momento de celebração do app)
    celebrate()
  }

  const discard = () => {
    setAndStore(null)
    showToast('Sessão descartada.')
  }

  const stopPomodoro = () => {
    const cycles = session?.cyclesCompleted || 0
    setAndStore(null)
    showToast(cycles > 0 ? `Pomodoro encerrado — ${cycles} ciclo(s) completo(s).` : 'Pomodoro encerrado.')
  }

  // Fim de fase automático: cada vez que remainingSec chega a 0 com a fase
  // rodando, toca o alarme, vibra e avança pra próxima fase sozinho — igual
  // a um pomodoro de verdade, sem precisar tocar em nada.
  useEffect(() => {
    if (!isPomodoro || !running || remainingSec > 0) return
    playChime()
    vibrateDevice()

    if (session.phase === 'work') {
      const minutes = workMin
      addFocusSession({ date: today, minutes, goalId: session.goalId || null }).then(() => {
        celebrate()
      })
      showToast(`Ciclo de ${minutes} min concluído — hora da pausa.`)
      notifyPhaseEnd('Foco concluído', `${minutes} min registrados. Hora da pausa de ${breakMin} min.`)
      setAndStore({
        ...session,
        phase: 'break',
        phaseStartedAt: Date.now(),
        phaseAccumulatedSec: 0,
        cyclesCompleted: (session.cyclesCompleted || 0) + 1,
      })
    } else {
      showToast('Pausa terminada — de volta ao foco.')
      notifyPhaseEnd('Pausa terminada', `Bora voltar ao foco por ${workMin} min.`)
      setAndStore({
        ...session,
        phase: 'work',
        phaseStartedAt: Date.now(),
        phaseAccumulatedSec: 0,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  const removeSession = async (s) => {
    await deleteFocusSession(s.id)
    showToast('Registro removido.')
  }

  const changeGoal = (goalId) => {
    if (session) setAndStore({ ...session, goalId: goalId || null })
  }

  const phaseLabel = isPomodoro ? (session.phase === 'work' ? 'foco' : 'pausa') : null

  return (
    <>
      <div className="foco-wrap">
        <div className={`foco-charge ${running ? 'is-active' : ''}`}>
          <div className="foco-charge-fill" style={{ height: `${chargePct}%` }} />
          <BoltIcon size={22} color="var(--text)" />
        </div>

        <div className="foco-info">
          <div className="foco-info-label">
            {isPomodoro
              ? `${phaseLabel}${running ? '' : ' · pausado'} · ciclo ${(session.cyclesCompleted || 0) + 1}`
              : (running ? 'sessão em andamento' : session ? 'sessão pausada' : 'foco de hoje')}
          </div>
          <div className="foco-time">
            {isPomodoro ? fmtClock(remainingSec) : (session ? fmtClock(elapsedSec) : `${todayMinutes} min`)}
            <small>
              {isPomodoro
                ? ` · ${session.cyclesCompleted || 0} ciclo(s) hoje`
                : ` · ${todayMinutes + Math.floor(elapsedMin)}/${target} min hoje`}
            </small>
          </div>
          {session ? (
            <>
              {session.objective && <div className="foco-linked">{session.category ? `${session.category.toLowerCase()} · ` : ''}"{session.objective}"</div>}
              {linkedGoal
                ? <div className="foco-linked">vinculado a: {linkedGoal}</div>
                : <div className="foco-linked" style={{ color: 'var(--text3)' }}>sem meta vinculada</div>}
            </>
          ) : (
            <div className="foco-linked" style={{ color: 'var(--text3)' }}>
              cada minuto focado conta para a meta que você escolher
            </div>
          )}
        </div>

        <div className="foco-actions">
          {!session && (
            <>
              <div className="view-toggle">
                <button
                  type="button"
                  className={`view-btn ${pendingMode === 'livre' ? 'active' : ''}`}
                  onClick={() => setPendingMode('livre')}
                >
                  Livre
                </button>
                <button
                  type="button"
                  className={`view-btn ${pendingMode === 'pomodoro' ? 'active' : ''}`}
                  onClick={() => setPendingMode('pomodoro')}
                >
                  Pomodoro
                </button>
              </div>
              <select
                className="calendar-select"
                style={{ height: 30, minHeight: 30 }}
                defaultValue=""
                id="foco-goal-select"
              >
                <option value="">Sem meta</option>
                {activeGoals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
              <button
                className="btn btn-primary"
                onClick={() => start(document.getElementById('foco-goal-select')?.value)}
              >
                <RiPlayLine size={14} /> Iniciar sessão
              </button>
            </>
          )}

          {session && (
            <>
              <select
                className="calendar-select"
                style={{ height: 30, minHeight: 30 }}
                value={session.goalId || ''}
                onChange={e => changeGoal(e.target.value)}
              >
                <option value="">Sem meta</option>
                {activeGoals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
              {running ? (
                <button className="btn btn-ghost" onClick={pause}><RiPauseLine size={14} /> Pausar</button>
              ) : (
                <button className="btn btn-primary" onClick={resume}><RiPlayLine size={14} /> Retomar</button>
              )}
              {isPomodoro ? (
                <button className="btn btn-danger btn-sm" onClick={stopPomodoro}><RiStopLine size={14} /> Parar</button>
              ) : (
                <>
                  <button className="btn btn-primary" onClick={finish}><RiStopLine size={14} /> Concluir</button>
                  <button className="btn btn-danger btn-sm" onClick={discard}>descartar</button>
                </>
              )}
            </>
          )}
        </div>

        <svg ref={dischargeRef} className="foco-discharge" viewBox="0 0 280 70" aria-hidden="true">
          <path d="M20 40 Q90 10 150 35 T260 30" fill="none" stroke="var(--gold)" strokeWidth="2" />
        </svg>
      </div>

      <div className="foco-trend">
        <span className="foco-trend-label">últimos 14 dias</span>
        <div className="foco-trend-strip">
          {last14Trend.map(({ key, day, minutes, level }) => (
            <span
              key={key}
              className={`foco-trend-cell level-${level}`}
              title={`${day.toLocaleDateString('pt-BR')} — ${minutes} min`}
            />
          ))}
        </div>
      </div>

      <div className="subpage-controls" style={{ marginBottom: 12, flexWrap: 'wrap', gap: '8px 16px' }}>
        <span className="subpage-controls-note">alvo diário (livre)</span>
        <select
          className="calendar-select"
          value={target}
          onChange={e => savePrefs({ focusDailyTarget: Number(e.target.value) })}
        >
          {TARGET_OPTIONS.map(v => <option key={v} value={v}>{v} min</option>)}
        </select>
      </div>

      <div className="subpage-controls" style={{ marginBottom: 32, flexWrap: 'wrap', gap: '8px 16px' }}>
        <span className="subpage-controls-note">pomodoro: foco</span>
        <select
          className="calendar-select"
          value={workMin}
          onChange={e => savePrefs({ pomodoroWork: Number(e.target.value) })}
        >
          {WORK_OPTIONS.map(v => <option key={v} value={v}>{v} min</option>)}
        </select>
        <span className="subpage-controls-note">pausa</span>
        <select
          className="calendar-select"
          value={breakMin}
          onChange={e => savePrefs({ pomodoroBreak: Number(e.target.value) })}
        >
          {BREAK_OPTIONS.map(v => <option key={v} value={v}>{v} min</option>)}
        </select>
      </div>

      <div className="hoje-grid" style={{ gap: '0 56px' }}>
        <section className="hoje-section">
          <div className="hoje-section-head">
            <h2 className="hoje-section-title">Sessões recentes</h2>
          </div>
          {sessions.length === 0 ? (
            <div className="empty-state">Nenhuma sessão ainda. O esforço invisível começa a aparecer aqui.</div>
          ) : (
            <div>
              {sessions.slice(0, 12).map(s => (
                <div
                  key={s.id}
                  className="foco-session-row"
                  title={[s.objective, s.result && `descoberta: ${s.result}`, s.nextStep && `próximo passo: ${s.nextStep}`].filter(Boolean).join(' · ') || undefined}
                >
                  <span className="foco-session-min">{s.minutes} min</span>
                  {s.category && <span className="foco-session-goal">{s.category}</span>}
                  {s.goalId && <span className="foco-session-goal">{goalTitle(s.goalId) || 'meta removida'}</span>}
                  <span className="foco-session-date">
                    {s.date ? new Date(`${s.date}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''}
                  </span>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeSession(s)} aria-label="Remover registro">
                    <RiDeleteBinLine size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="hoje-section">
          <div className="hoje-section-head">
            <h2 className="hoje-section-title">Total por meta</h2>
          </div>
          {goalTotals.length === 0 ? (
            <div className="empty-state">Vincule sessões a metas para ver o acumulado.</div>
          ) : (
            <div>
              {goalTotals.map(t => (
                <div key={t.goalId} className="foco-goal-total">
                  <span>{t.title}</span>
                  <strong>{t.minutes >= 60 ? `${Math.floor(t.minutes / 60)}h ${t.minutes % 60}min` : `${t.minutes} min`}</strong>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {pendingFinish && (
        <Modal
          title="Sessão concluída"
          onClose={() => saveReflection(true)}
          onSave={() => saveReflection(false)}
          saveLabel="Salvar"
          hideCancel
        >
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>
            {pendingFinish.minutes} min registrados{pendingFinish.objective ? ` — "${pendingFinish.objective}"` : ''}. Vale a pena fechar com uma reflexão rápida (ou só salvar sem ela).
          </p>
          <div className="field">
            <label>O que descobri?</label>
            <textarea rows={2} value={resultDraft} onChange={e => setResultDraft(e.target.value)} placeholder="Opcional" />
          </div>
          {resultDraft.trim() && notebooks.length > 0 && (
            <div className="field">
              <label>Salvar como nota em qual tema?</label>
              <select
                className="calendar-select"
                style={{ width: '100%' }}
                value={reflectionTopicId}
                onChange={e => setReflectionTopicId(e.target.value)}
              >
                <option value="">Não salvar como nota</option>
                {notebooks.map(nb => <option key={nb.id} value={nb.id}>{nb.emoji ? `${nb.emoji} ` : ''}{nb.name}</option>)}
              </select>
            </div>
          )}
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Qual é o próximo passo?</label>
            <textarea rows={2} value={nextStepDraft} onChange={e => setNextStepDraft(e.target.value)} placeholder="Opcional — vira uma tarefa" />
          </div>
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </>
  )
}
