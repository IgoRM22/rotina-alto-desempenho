export function dateKeyFromDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayKey() {
  return dateKeyFromDate(new Date())
}

export const MAX_TODAY_TASKS = 6

const DAY_SHORT_LABELS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']

export function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

// Monday-anchored week — distinct from Agenda's Sunday-anchored schedule weeks.
export function getWeekStart(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const isoDay = d.getDay() === 0 ? 7 : d.getDay() // 1=Mon..7=Sun
  d.setDate(d.getDate() - (isoDay - 1))
  return d
}

export function getWeekDates(date = new Date()) {
  const start = getWeekStart(date)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function getWeekKey(date = new Date()) {
  return `W-${dateKeyFromDate(getWeekStart(date))}`
}

export function getWeekLabel(date = new Date()) {
  const dates = getWeekDates(date)
  const fmt = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  return `Semana ${fmt(dates[0])} – ${fmt(dates[6])}`
}

export function weekDayShortLabel(index) {
  return DAY_SHORT_LABELS[index] || ''
}
