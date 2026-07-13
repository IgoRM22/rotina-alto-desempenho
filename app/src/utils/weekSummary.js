import { dateKeyFromDate } from './date'

export function buildHabitWeekTable(habits, habitLogs, weekDates) {
  const logsByDate = new Map(habitLogs.map(l => [l.date, l.checked || {}]))
  const dateKeys = weekDates.map(dateKeyFromDate)

  return habits.map(habit => ({
    habit,
    cells: dateKeys.map(key => !!logsByDate.get(key)?.[habit.id]),
  }))
}

export function collectAnnotations(dailyLogsOfWeek, tag) {
  return dailyLogsOfWeek
    .filter(log => Array.isArray(log.annotations) && log.annotations.length)
    .flatMap(log => log.annotations
      .filter(a => a.tag === tag)
      .map(a => ({ date: log.date, text: a.text })))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
}

export function computeWeekCompletionPct(habitWeekTable, daysElapsed) {
  if (!habitWeekTable.length || !daysElapsed) return 0
  const total = habitWeekTable.length * daysElapsed
  const done = habitWeekTable.reduce((sum, row) => {
    return sum + row.cells.slice(0, daysElapsed).filter(Boolean).length
  }, 0)
  return Math.round((done / total) * 100)
}

export function formatWeekSummaryText(weekLabel, habitWeekTable, funcionou, ajustar, rabiscos) {
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
  lines.push('')

  lines.push('O que funcionou:')
  lines.push(...(funcionou.length ? funcionou.map(a => `- ${a.text}`) : ['- (nada registrado)']))
  lines.push('')

  lines.push('O que ajustar:')
  lines.push(...(ajustar.length ? ajustar.map(a => `- ${a.text}`) : ['- (nada registrado)']))
  lines.push('')

  lines.push('Rabiscos:')
  lines.push(...(rabiscos.length ? rabiscos.map(a => `- ${a.text}`) : ['- (nada registrado)']))

  return lines.join('\n')
}
