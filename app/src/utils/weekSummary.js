import { dateKeyFromDate } from './date'

export function buildHabitWeekTable(habits, habitLogs, weekDates) {
  const logsByDate = new Map(habitLogs.map(l => [l.date, l.checked || {}]))
  const dateKeys = weekDates.map(dateKeyFromDate)

  return habits.map(habit => ({
    habit,
    cells: dateKeys.map(key => !!logsByDate.get(key)?.[habit.id]),
  }))
}

export function computeWeekCompletionPct(habitWeekTable, daysElapsed) {
  if (!habitWeekTable.length || !daysElapsed) return 0
  const total = habitWeekTable.length * daysElapsed
  const done = habitWeekTable.reduce((sum, row) => {
    return sum + row.cells.slice(0, daysElapsed).filter(Boolean).length
  }, 0)
  return Math.round((done / total) * 100)
}

export function formatWeekSummaryText(weekLabel, habitWeekTable) {
  const lines = [`${weekLabel}`, '']

  lines.push('Hábitos da semana:')
  if (habitWeekTable.length === 0) {
    lines.push('- (nenhum hábito cadastrado)')
  } else {
    habitWeekTable.forEach(({ habit, cells }) => {
      const done = cells.filter(Boolean).length
      lines.push(`- ${habit.name}: ${done}/7 dias`)
    })
  }

  return lines.join('\n')
}
