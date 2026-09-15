import React, { useEffect, useMemo, useRef, useState } from 'react'
import { RiCheckLine } from '@remixicon/react'
import { listenHabits, listenHabitLogs, listenImportantDates } from '../services/firestore'
import { getWeekDates, getWeekLabel, dateKeyFromDate, todayKey, weekDayShortLabel } from '../utils/date'
import { buildHabitWeekTable, computeWeekCompletionPct } from '../utils/weekSummary'
import { expandImportantDatesForRange } from '../utils/importantDates'
import CommitmentList from './CommitmentList'

export default function RevisaoSemanal() {
  const [habits, setHabits] = useState([])
  const [habitLogs, setHabitLogs] = useState([])
  const [importantDates, setImportantDates] = useState([])

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
    </>
  )
}
