import { useEffect } from 'react'
import {
  getHabitsOnce,
  getHabitLogsOnce,
  getDailyLogsForDates,
  getLastArchivedWeek,
  setLastArchivedWeek,
  listenNotebooks,
  addNotebook,
  addNote,
} from '../services/firestore'
import { getWeekDates, getWeekLabel, getWeekKey, dateKeyFromDate, addDays } from '../utils/date'
import { buildHabitWeekTable, collectAnnotations, formatWeekSummaryText } from '../utils/weekSummary'

const ARCHIVE_NOTEBOOK_NAME = 'Revisões Semanais'

const ensureArchiveNotebook = () => new Promise((resolve) => {
  const unsub = listenNotebooks(async (notebooks) => {
    unsub()
    const existing = notebooks.find(nb => nb.name === ARCHIVE_NOTEBOOK_NAME)
    if (existing) { resolve(existing.id); return }
    const ref = await addNotebook({ name: ARCHIVE_NOTEBOOK_NAME, emoji: '🗓️', color: '#4B8FD4' })
    resolve(ref.id)
  })
})

// Runs once per session: if a full week has passed without being archived to Notes, archive it.
export function useWeekArchive(enabled) {
  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    const run = async () => {
      const lastWeekDate = addDays(new Date(), -7)
      const lastWeekKey = getWeekKey(lastWeekDate)
      const already = await getLastArchivedWeek()
      if (cancelled || already === lastWeekKey) return

      const weekDates = getWeekDates(lastWeekDate)
      const dateKeys = weekDates.map(dateKeyFromDate)

      const [habits, habitLogs, dailyLogs] = await Promise.all([
        getHabitsOnce(),
        getHabitLogsOnce(dateKeys),
        getDailyLogsForDates(dateKeys),
      ])

      const hasData = habitLogs.length > 0 || dailyLogs.length > 0
      if (!hasData) {
        // Nothing happened that week — don't create an empty note, but don't retry every load either.
        await setLastArchivedWeek(lastWeekKey)
        return
      }

      const table = buildHabitWeekTable(habits, habitLogs, weekDates)
      const funcionou = collectAnnotations(dailyLogs, 'funcionou')
      const ajustar = collectAnnotations(dailyLogs, 'ajustar')
      const rabiscos = collectAnnotations(dailyLogs, 'rabisco')
      const weekLabel = getWeekLabel(lastWeekDate)
      const content = formatWeekSummaryText(weekLabel, table, funcionou, ajustar, rabiscos)

      if (cancelled) return
      const notebookId = await ensureArchiveNotebook()
      if (cancelled) return

      await addNote({
        title: `Revisão — ${weekLabel}`,
        content,
        importance: 'media',
        notebookId,
      })
      await setLastArchivedWeek(lastWeekKey)
    }

    run().catch(() => {})

    return () => { cancelled = true }
  }, [enabled])
}
