import React, { useEffect, useMemo, useRef, useState } from 'react'
import { RiDeleteBinLine, RiPauseLine, RiPlayLine, RiStopLine } from '@remixicon/react'
import {
  listenGoals, listenFocusSessions, addFocusSession, deleteFocusSession,
  listenPrefs, savePrefs,
} from '../../services/firestore'
import { todayKey } from '../../utils/date'
import BoltIcon from '../../components/BoltIcon'
import Toast from '../../components/Toast'

const STORAGE_KEY = 'raio-foco-session'
const TARGET_OPTIONS = [30, 45, 60, 90, 120]

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

const fmtClock = (totalSec) => {
  const m = Math.floor(totalSec / 60)
  const s = Math.floor(totalSec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function Foco() {
  const [goals, setGoals] = useState([])
  const [sessions, setSessions] = useState([])
  const [prefs, setPrefs] = useState({})
  // { startedAt: ms | null (pausado), accumulatedSec, goalId }
  const [session, setSession] = useState(loadStored)
  const [tick, setTick] = useState(0)
  const [toast, setToast] = useState(null)
  const dischargeRef = useRef(null)

  useEffect(() => {
    const u1 = listenGoals(setGoals)
    const u2 = listenFocusSessions(setSessions, 300)
    const u3 = listenPrefs(setPrefs)
    return () => { u1(); u2(); u3() }
  }, [])

  const running = !!session?.startedAt

  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(timer)
  }, [running])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const target = TARGET_OPTIONS.includes(prefs.focusDailyTarget) ? prefs.focusDailyTarget : 60
  const today = todayKey()

  const elapsedSec = session
    ? session.accumulatedSec + (session.startedAt ? (Date.now() - session.startedAt) / 1000 : 0)
    : 0
  const elapsedMin = elapsedSec / 60

  const todaySessions = sessions.filter(s => s.date === today)
  const todayMinutes = todaySessions.reduce((sum, s) => sum + (s.minutes || 0), 0)
  const chargePct = Math.min(100, ((todayMinutes + elapsedMin) / target) * 100)

  const activeGoals = goals.filter(g => !g.done)
  const goalTitle = (id) => goals.find(g => g.id === id)?.title || null
  const linkedGoal = session ? goalTitle(session.goalId) : null

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

  const start = (goalId) => {
    setAndStore({ startedAt: Date.now(), accumulatedSec: 0, goalId: goalId || null })
  }

  const pause = () => {
    if (!session?.startedAt) return
    setAndStore({
      ...session,
      startedAt: null,
      accumulatedSec: session.accumulatedSec + (Date.now() - session.startedAt) / 1000,
    })
  }

  const resume = () => {
    if (!session || session.startedAt) return
    setAndStore({ ...session, startedAt: Date.now() })
  }

  const finish = async () => {
    if (!session) return
    const minutes = Math.max(1, Math.round(elapsedSec / 60))
    await addFocusSession({ date: today, minutes, goalId: session.goalId || null })
    setAndStore(null)
    showToast(`Sessão de ${minutes} min registrada.`)
    // traço de conexão foco → meta (único momento de celebração do app)
    const svg = dischargeRef.current
    if (svg) {
      svg.classList.remove('draw')
      void svg.getBoundingClientRect()
      svg.classList.add('draw')
    }
  }

  const discard = () => {
    setAndStore(null)
    showToast('Sessão descartada.')
  }

  const removeSession = async (s) => {
    await deleteFocusSession(s.id)
    showToast('Registro removido.')
  }

  const changeGoal = (goalId) => {
    if (session) setAndStore({ ...session, goalId: goalId || null })
  }

  return (
    <>
      <div className="foco-wrap">
        <div className={`foco-charge ${running ? 'is-active' : ''}`}>
          <div className="foco-charge-fill" style={{ height: `${chargePct}%` }} />
          <BoltIcon size={22} color="var(--text)" />
        </div>

        <div className="foco-info">
          <div className="foco-info-label">{running ? 'sessão em andamento' : session ? 'sessão pausada' : 'foco de hoje'}</div>
          <div className="foco-time">
            {session ? fmtClock(elapsedSec) : `${todayMinutes} min`}
            <small> · {todayMinutes + Math.floor(elapsedMin)}/{target} min hoje</small>
          </div>
          {session ? (
            linkedGoal
              ? <div className="foco-linked">vinculado a: {linkedGoal}</div>
              : <div className="foco-linked" style={{ color: 'var(--text3)' }}>sem meta vinculada</div>
          ) : (
            <div className="foco-linked" style={{ color: 'var(--text3)' }}>
              cada minuto focado conta para a meta que você escolher
            </div>
          )}
        </div>

        <div className="foco-actions">
          {!session && (
            <>
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
              <button className="btn btn-primary" onClick={finish}><RiStopLine size={14} /> Concluir</button>
              <button className="btn btn-danger btn-sm" onClick={discard}>descartar</button>
            </>
          )}
        </div>

        <svg ref={dischargeRef} className="foco-discharge" viewBox="0 0 280 70" aria-hidden="true">
          <path d="M20 40 Q90 10 150 35 T260 30" fill="none" stroke="var(--gold)" strokeWidth="2" />
        </svg>
      </div>

      <div className="subpage-controls" style={{ marginBottom: 32 }}>
        <span className="subpage-controls-note">alvo diário de foco</span>
        <select
          className="calendar-select"
          value={target}
          onChange={e => savePrefs({ focusDailyTarget: Number(e.target.value) })}
        >
          {TARGET_OPTIONS.map(v => <option key={v} value={v}>{v} min</option>)}
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
                <div key={s.id} className="foco-session-row">
                  <span className="foco-session-min">{s.minutes} min</span>
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

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </>
  )
}
