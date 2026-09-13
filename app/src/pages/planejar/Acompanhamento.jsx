import React, { useEffect, useMemo, useState } from 'react'
import { RiBarChartLine, RiFireLine, RiPieChartLine, RiTimeLine } from '@remixicon/react'
import {
  listenFocusSessions, listenGoals, listenHabits, listenHabitLogs, listenSchedule,
} from '../../services/firestore'
import { dateKeyFromDate, getWeekDates, todayKey } from '../../utils/date'
import { isDailyHabit, computeStreak, computeWeeklyStreak, weekProgress } from '../../utils/streak'

const PERIOD_OPTIONS = [
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: 'month', label: 'Este mês' },
  { value: 'year', label: 'Este ano' },
]

// Períodos "rolantes" (7/30 dias) e períodos de calendário (mês/ano corrente)
// pedem lógicas de corte diferentes — isso centraliza os dois num só lugar,
// incluindo o período anterior equivalente pra comparação (usado no insight).
const getPeriodRange = (period, now) => {
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0)
    return { startKey: dateKeyFromDate(start), prevStartKey: dateKeyFromDate(prevStart), prevEndKey: dateKeyFromDate(prevEnd) }
  }
  if (period === 'year') {
    const start = new Date(now.getFullYear(), 0, 1)
    const prevStart = new Date(now.getFullYear() - 1, 0, 1)
    const prevEnd = new Date(now.getFullYear() - 1, 11, 31)
    return { startKey: dateKeyFromDate(start), prevStartKey: dateKeyFromDate(prevStart), prevEndKey: dateKeyFromDate(prevEnd) }
  }
  const days = Number(period)
  const start = new Date(now.getTime() - (days - 1) * 86400000)
  const prevEnd = new Date(now.getTime() - days * 86400000)
  const prevStart = new Date(now.getTime() - (days * 2 - 1) * 86400000)
  return { startKey: dateKeyFromDate(start), prevStartKey: dateKeyFromDate(prevStart), prevEndKey: dateKeyFromDate(prevEnd) }
}

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

// Mesma lógica de expansão de dias usada na Agenda (repeat/day/repeatDays),
// duplicada aqui porque é pequena e a Agenda não a exporta — evita acoplar
// esta página à implementação interna daquela.
const getItemDays = (item) => {
  if (!item.repeat) return [item.day]
  if (item.repeat === 'daily') return DAYS
  if (item.repeat === 'weekdays') return ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']
  if (item.repeat === 'weekend') return ['Domingo', 'Sábado']
  if (item.repeat === 'custom' && item.repeatDays?.length) return item.repeatDays
  return [item.day]
}

const toMin = (t) => {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

const fmtHours = (minutes) => {
  const safe = Math.max(0, Math.round(minutes))
  const h = Math.floor(safe / 60)
  const m = safe % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}`
}

// Janela de vigília usada pra estimar tempo livre — não é sono real (não
// temos essa hora salva), é uma referência fixa razoável (7h às 23h) só pra
// dar uma noção de "quanto da semana ainda não tem nada marcado".
const WAKING_MINUTES_PER_DAY = 16 * 60

export default function Acompanhamento() {
  const [sessions, setSessions] = useState([])
  const [goals, setGoals] = useState([])
  const [habits, setHabits] = useState([])
  const [habitLogs, setHabitLogs] = useState([])
  const [schedule, setSchedule] = useState([])
  const [period, setPeriod] = useState('7')

  useEffect(() => {
    const u1 = listenFocusSessions(setSessions, 500)
    const u2 = listenGoals(setGoals)
    const u3 = listenHabits(setHabits)
    const u4 = listenHabitLogs(setHabitLogs, 60)
    const u5 = listenSchedule(setSchedule)
    return () => { u1(); u2(); u3(); u4(); u5() }
  }, [])

  const today = todayKey()

  const range = useMemo(() => getPeriodRange(period, new Date()), [period])

  const periodSessions = useMemo(
    () => sessions.filter(s => s.date && s.date >= range.startKey),
    [sessions, range],
  )

  const totalMinutes = useMemo(
    () => periodSessions.reduce((sum, s) => sum + (s.minutes || 0), 0),
    [periodSessions],
  )

  const previousPeriodMinutes = useMemo(() => sessions
    .filter(s => s.date && s.date >= range.prevStartKey && s.date <= range.prevEndKey)
    .reduce((sum, s) => sum + (s.minutes || 0), 0), [sessions, range])

  // Ranking de "onde venho me dedicando" — cada sessão vira um rótulo (o
  // hábito vinculado ganha prioridade sobre a meta, porque tende a ser mais
  // específico: "Inglês" diz mais que "Aprender idiomas"), somado por minuto.
  const dedicationRanking = useMemo(() => {
    const habitById = new Map(habits.map(h => [h.id, h.name]))
    const goalById = new Map(goals.map(g => [g.id, g.title]))
    const totals = new Map()
    periodSessions.forEach(s => {
      const label = (s.habitId && habitById.get(s.habitId))
        || (s.goalId && goalById.get(s.goalId))
        || (s.category ? s.category.charAt(0).toUpperCase() + s.category.slice(1) : null)
        || 'Sem tema'
      totals.set(label, (totals.get(label) || 0) + (s.minutes || 0))
    })
    return Array.from(totals.entries())
      .map(([label, minutes]) => ({ label, minutes }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 6)
  }, [periodSessions, habits, goals])

  const topDedication = dedicationRanking[0]

  // Tempo livre estimado da semana atual: soma os minutos já ocupados pela
  // agenda (expandindo repetição pra cada um dos 7 dias) e compara com uma
  // janela de vigília fixa — dá uma leitura aproximada, não uma métrica de
  // precisão (não sabemos a hora real que a pessoa dorme).
  const freeTimeThisWeek = useMemo(() => {
    const weekDates = getWeekDates()
    const scheduledByDay = {}
    DAYS.forEach(d => { scheduledByDay[d] = 0 })

    schedule.forEach(item => {
      if (!item.timeStart) return
      const duration = item.timeEnd ? Math.max(0, toMin(item.timeEnd) - toMin(item.timeStart)) : 30
      getItemDays(item).forEach(day => {
        if (scheduledByDay[day] !== undefined) scheduledByDay[day] += duration
      })
    })

    const totalScheduled = weekDates.reduce((sum, d) => sum + (scheduledByDay[DAYS[d.getDay()]] || 0), 0)
    const totalWaking = WAKING_MINUTES_PER_DAY * 7
    return { free: Math.max(0, totalWaking - totalScheduled), scheduled: totalScheduled, waking: totalWaking }
  }, [schedule])

  // Consistência de hábitos — reaproveita exatamente o cálculo de streak já
  // usado em Hábitos/HabitChecklist, só ordenado pelo mais consistente.
  const habitConsistency = useMemo(() => {
    const logsByDate = new Map(habitLogs.map(l => [l.date, l.checked || {}]))
    return habits
      .filter(h => h.active !== false)
      .map(h => {
        const daily = isDailyHabit(h)
        const streak = daily
          ? computeStreak(h.id, logsByDate, today)
          : computeWeeklyStreak(h.id, logsByDate, today, h.weeklyTarget)
        const weekDone = daily ? null : weekProgress(h.id, logsByDate, today)
        return { habit: h, daily, streak, weekDone }
      })
      .sort((a, b) => b.streak - a.streak)
      .slice(0, 5)
  }, [habits, habitLogs, today])

  const insight = useMemo(() => {
    if (totalMinutes === 0) return 'Nenhuma sessão de foco registrada nesse período ainda — que tal começar uma agora?'
    const parts = []
    if (topDedication) {
      const pct = Math.round((topDedication.minutes / totalMinutes) * 100)
      parts.push(`"${topDedication.label}" é onde você mais se dedicou (${pct}% do seu tempo de foco).`)
    }
    if (previousPeriodMinutes > 0) {
      const delta = totalMinutes - previousPeriodMinutes
      const pct = Math.round((Math.abs(delta) / previousPeriodMinutes) * 100)
      if (Math.abs(pct) >= 10) {
        parts.push(delta > 0
          ? `Isso é ${pct}% mais foco que no período anterior — bom ritmo.`
          : `Isso é ${pct}% menos foco que no período anterior.`)
      }
    }
    const bestHabit = habitConsistency[0]
    if (bestHabit && bestHabit.streak > 0) {
      parts.push(`"${bestHabit.habit.name}" está com sua melhor sequência (${bestHabit.streak} ${bestHabit.daily ? 'dias' : 'semanas'}).`)
    }
    return parts.join(' ')
  }, [totalMinutes, topDedication, previousPeriodMinutes, habitConsistency])

  const maxDedicationMinutes = dedicationRanking[0]?.minutes || 1

  return (
    <div className="acompanhamento-page">
      <div className="hoje-section-head">
        <h2 className="hoje-section-title">Foco no período</h2>
        <select
          className="calendar-select"
          value={period}
          onChange={e => setPeriod(e.target.value)}
          aria-label="Período"
        >
          {PERIOD_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>

      <div className="metric-grid">
        <div className="metric-card accent-coral">
          <span className="metric-icon"><RiTimeLine size={18} aria-hidden="true" /></span>
          <span className="metric-value">{fmtHours(totalMinutes)}</span>
          <span className="metric-label">de foco registrado</span>
        </div>
        <div className="metric-card accent-violet">
          <span className="metric-icon"><RiPieChartLine size={18} aria-hidden="true" /></span>
          <span className="metric-value">{topDedication ? topDedication.label : '—'}</span>
          <span className="metric-label">principal dedicação</span>
        </div>
        <div className="metric-card accent-gold">
          <span className="metric-icon"><RiFireLine size={18} aria-hidden="true" /></span>
          <span className="metric-value">{habitConsistency[0]?.streak || 0}</span>
          <span className="metric-label">
            melhor sequência{habitConsistency[0] ? ` — ${habitConsistency[0].habit.name}` : ''}
          </span>
        </div>
        <div className="metric-card accent-sage">
          <span className="metric-icon"><RiBarChartLine size={18} aria-hidden="true" /></span>
          <span className="metric-value">{fmtHours(freeTimeThisWeek.free)}</span>
          <span className="metric-label">tempo livre estimado (semana)</span>
        </div>
      </div>

      {insight && (
        <div className="insight-panel acompanhamento-insight">
          <span className="insight-panel-icon">✨</span>
          <p>{insight}</p>
        </div>
      )}

      <div className="habitos-section">
        <div className="hoje-section-head">
          <h2 className="hoje-section-title">Onde você vem se dedicando</h2>
        </div>
        {dedicationRanking.length === 0 ? (
          <div className="empty-state" style={{ padding: '20px 0' }}>
            Nenhuma sessão de foco nesse período ainda.
          </div>
        ) : (
          <div className="rank-list">
            {dedicationRanking.map(entry => (
              <div key={entry.label} className="rank-row">
                <div className="rank-row-head">
                  <span className="rank-row-label">{entry.label}</span>
                  <span className="rank-row-value">{fmtHours(entry.minutes)}</span>
                </div>
                <div className="rank-bar-track">
                  <div
                    className="rank-bar-fill"
                    style={{ width: `${Math.max(4, (entry.minutes / maxDedicationMinutes) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="habitos-section">
        <div className="hoje-section-head">
          <h2 className="hoje-section-title">Consistência de hábitos</h2>
        </div>
        {habitConsistency.length === 0 ? (
          <div className="empty-state" style={{ padding: '20px 0' }}>
            Nenhum hábito ativo ainda.
          </div>
        ) : (
          <div className="habit-manage-list">
            {habitConsistency.map(({ habit, daily, streak, weekDone }) => (
              <div key={habit.id} className="habit-manage-row">
                <span className="habit-manage-name" style={{ cursor: 'default' }}>{habit.name}</span>
                {!daily && (
                  <span className={`habit-week-progress ${weekDone >= habit.weeklyTarget ? 'is-met' : ''}`}>
                    {weekDone}/{habit.weeklyTarget} semana
                  </span>
                )}
                <span className="subpage-controls-note" style={{ marginRight: 0 }}>
                  sequência: {streak} {daily ? 'dias' : 'semanas'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="acompanhamento-footnote">
        Tempo livre é uma estimativa (considera uma janela de {WAKING_MINUTES_PER_DAY / 60}h de vigília por dia
        menos o que está marcado na agenda desta semana) — não leva em conta sono real ou imprevistos.
      </p>
    </div>
  )
}
