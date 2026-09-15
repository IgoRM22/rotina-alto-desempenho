import { useEffect } from 'react'
import {
  getHabitsOnce,
  getHabitLogsOnce,
  getLastArchivedWeek,
  setLastArchivedWeek,
  listenNotebooks,
  addNotebook,
  addNote,
} from '../services/firestore'
import { getWeekDates, getWeekLabel, getWeekKey, dateKeyFromDate, addDays } from '../utils/date'
import { buildHabitWeekTable, formatWeekSummaryText } from '../utils/weekSummary'

// Exportado — Notes.jsx filtra esse caderno da lista normal (não é uma nota
// "de verdade", é um arquivo automático) e RevisaoSemanal.jsx o lê direto
// pra mostrar as revisões passadas num lugar próprio, sem misturar os dois.
export const ARCHIVE_NOTEBOOK_NAME = 'Revisões Semanais'

const ensureArchiveNotebook = () => new Promise((resolve) => {
  const unsub = listenNotebooks(async (notebooks) => {
    unsub()
    const existing = notebooks.find(nb => nb.name === ARCHIVE_NOTEBOOK_NAME)
    if (existing) { resolve(existing.id); return }
    const ref = await addNotebook({ name: ARCHIVE_NOTEBOOK_NAME, emoji: '🗓️', color: '#6C93B8' })
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

      const [habits, habitLogs] = await Promise.all([
        getHabitsOnce(),
        getHabitLogsOnce(dateKeys),
      ])

      if (habitLogs.length === 0) {
        // Nada marcado essa semana — não cria uma nota vazia, mas não tenta
        // de novo a cada carregamento.
        await setLastArchivedWeek(lastWeekKey)
        return
      }

      const table = buildHabitWeekTable(habits, habitLogs, weekDates)
      const weekLabel = getWeekLabel(lastWeekDate)
      const content = formatWeekSummaryText(weekLabel, table)

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
