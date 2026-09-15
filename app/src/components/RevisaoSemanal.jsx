import React, { useEffect, useMemo, useRef, useState } from 'react'
import { RiCheckLine, RiTimeLine } from '@remixicon/react'
import {
  listenHabits, listenHabitLogs, listenImportantDates, listenFocusSessions, listenGoals,
  listenNotebooks, listenNotes,
} from '../services/firestore'
import { getWeekDates, getWeekLabel, dateKeyFromDate, todayKey, weekDayShortLabel } from '../utils/date'
import { buildHabitWeekTable, computeWeekCompletionPct } from '../utils/weekSummary'
import { expandImportantDatesForRange } from '../utils/importantDates'
import { ARCHIVE_NOTEBOOK_NAME } from '../hooks/useWeekArchive'
import CommitmentList from './CommitmentList'

const fmtHours = (minutes) => {
  const safe = Math.max(0, Math.round(minutes))
  const h = Math.floor(safe / 60)
  const m = safe % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}`
}

export default function RevisaoSemanal() {
  const [habits, setHabits] = useState([])
  const [habitLogs, setHabitLogs] = useState([])
  const [importantDates, setImportantDates] = useState([])
  const [sessions, setSessions] = useState([])
  const [goals, setGoals] = useState([])
  const [archivedReviews, setArchivedReviews] = useState([])

  const weekDates = useMemo(() => getWeekDates(), [])
  const weekLabel = getWeekLabel()
  const dateKeys = useMemo(() => weekDates.map(dateKeyFromDate), [weekDates])

  useEffect(() => {
    const unsub = listenHabits(setHabits)
    return unsub
  }, [])

  useEffect(() => {
    const unsub = listenHabitLogs(setHabitLogs, 14)
    return unsub
  }, [])

  useEffect(() => {
    const unsub = listenImportantDates(setImportantDates)
    return unsub
  }, [])

  useEffect(() => {
    const unsub = listenFocusSessions(setSessions, 200)
    return unsub
  }, [])

  useEffect(() => {
    const unsub = listenGoals(setGoals)
    return unsub
  }, [])

  // O arquivo automático de revisões passadas (uma nota por semana, gerada
  // sozinha em useWeekArchive.js) mora num caderno próprio, escondido da
  // tela de Notas — pra não misturar com as notas de verdade da pessoa —
  // e só aparece aqui, dentro da própria Revisão Semanal.
  useEffect(() => {
    let unsubNotes = () => {}
    const unsubNb = listenNotebooks((notebooks) => {
      const archive = notebooks.find((nb) => nb.name === ARCHIVE_NOTEBOOK_NAME)
      unsubNotes()
      if (!archive) { setArchivedReviews([]); unsubNotes = () => {}; return }
      unsubNotes = listenNotes((notes) => {
        setArchivedReviews(
          notes
            .filter((n) => n.notebookId === archive.id)
            .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)),
        )
      })
    })
    return () => { unsubNb(); unsubNotes() }
  }, [])

  // "Onde você vem se dedicando" — herdado da extinta tela de Métricas, só
  // que preso à semana em revisão (sem seletor de período — aqui o período
  // já é sempre "esta semana"). Hábito vinculado tem prioridade sobre meta
  // por ser mais específico ("Inglês" diz mais que "Aprender idiomas").
  const weekSessions = useMemo(() => sessions.filter(s => dateKeys.includes(s.date)), [sessions, dateKeys])
  const weekFocusMinutes = useMemo(() => weekSessions.reduce((sum, s) => sum + (s.minutes || 0), 0), [weekSessions])
  const dedicationRanking = useMemo(() => {
    const habitById = new Map(habits.map(h => [h.id, h.name]))
    const goalById = new Map(goals.map(g => [g.id, g.title]))
    const totals = new Map()
    weekSessions.forEach(s => {
      const label = (s.habitId && habitById.get(s.habitId))
        || (s.goalId && goalById.get(s.goalId))
        || (s.category ? s.category.charAt(0).toUpperCase() + s.category.slice(1) : null)
        || 'Sem tema'
      totals.set(label, (totals.get(label) || 0) + (s.minutes || 0))
    })
    return Array.from(totals.entries())
      .map(([label, minutes]) => ({ label, minutes }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 4)
  }, [weekSessions, habits, goals])
  const maxDedicationMinutes = dedicationRanking[0]?.minutes || 1

  const commitments = useMemo(
    () => expandImportantDatesForRange(importantDates, weekDates[0], weekDates[6]).map(occ => {
      const idx = dateKeys.indexOf(dateKeyFromDate(occ.occurrenceStart))
      const dateLabel = occ.occurrenceStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      return { ...occ, tag: idx >= 0 ? `${weekDayShortLabel(idx)} ${dateLabel}` : dateLabel }
    }),
    [importantDates, weekDates, dateKeys],
  )

  const table = useMemo(() => buildHabitWeekTable(habits, habitLogs, weekDates), [habits, habitLogs, weekDates])

  const todayIdx = dateKeys.indexOf(todayKey())
  const daysElapsed = todayIdx === -1 ? 7 : todayIdx + 1
  const pct = computeWeekCompletionPct(table, daysElapsed)

  // Sem isso, a tabela cortava sáb/dom no mobile sem nenhuma pista de que
  // dava pra arrastar pra ver o resto — mesmo problema que as abas já
  // tinham antes de ganhar esse fade.
  const weekTableRef = useRef(null)
  const [weekTableFade, setWeekTableFade] = useState({ left: false, right: false })

  useEffect(() => {
    const el = weekTableRef.current
    if (!el) return undefined
    const update = () => {
      setWeekTableFade({
        left: el.scrollLeft > 4,
        right: el.scrollLeft < el.scrollWidth - el.clientWidth - 4,
      })
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [table])

  return (
    <>
      {commitments.length > 0 && (
        <section className="hoje-section">
          <div className="hoje-section-head">
            <h2 className="hoje-section-title">Compromissos da semana</h2>
          </div>
          <CommitmentList items={commitments} />
        </section>
      )}

      <section className="hoje-section">
        <div className="hoje-section-head">
          <h2 className="hoje-section-title">{weekLabel}</h2>
          <span className="subpage-controls-note" style={{ marginRight: 0 }}>{pct}% dos hábitos concluídos até agora</span>
        </div>

        {table.length === 0 ? (
          <div className="empty-state">Nenhum hábito cadastrado ainda.</div>
        ) : (
          <div className="tabs-scroll-wrap">
            <div className="week-table-wrap" ref={weekTableRef}>
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
            {weekTableFade.left && <div className="tabs-scroll-fade tabs-scroll-fade--left" aria-hidden="true" />}
            {weekTableFade.right && <div className="tabs-scroll-fade tabs-scroll-fade--right" aria-hidden="true" />}
          </div>
        )}
      </section>

      {weekFocusMinutes > 0 && (
        <section className="hoje-section">
          <div className="hoje-section-head">
            <h2 className="hoje-section-title">Foco da semana</h2>
            <span className="subpage-controls-note" style={{ marginRight: 0 }}>
              <RiTimeLine size={12} /> {fmtHours(weekFocusMinutes)} registrado
            </span>
          </div>
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
        </section>
      )}

      {archivedReviews.length > 0 && (
        <section className="hoje-section">
          <div className="hoje-section-head">
            <h2 className="hoje-section-title">Revisões anteriores</h2>
          </div>
          <div className="archived-review-list">
            {archivedReviews.map((note) => (
              <details key={note.id} className="archived-review-item">
                <summary>{note.title}</summary>
                <pre className="archived-review-content">{note.content}</pre>
              </details>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
