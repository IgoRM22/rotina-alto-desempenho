// Itens da Agenda (Planejar → Agenda) que caem em um dia específico. Mesma
// regra de semana/repetição usada pela própria Agenda, resumida para a Home.
const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const pad2 = (v) => String(v).padStart(2, '0')
const keyOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

const isoWeekKey = (baseDate) => {
  const utc = new Date(Date.UTC(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate()))
  utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7))
  const isoYear = utc.getUTCFullYear()
  const week = Math.ceil((((utc - new Date(Date.UTC(isoYear, 0, 1))) / 86400000) + 1) / 7)
  return `W-${isoYear}-${pad2(week)}`
}

const itemDays = (item) => {
  if (!item.repeat) return [item.day]
  if (item.repeat === 'daily') return DAYS
  if (item.repeat === 'weekdays') return DAYS.slice(1, 6)
  if (item.repeat === 'weekend') return ['Domingo', 'Sábado']
  if (item.repeat === 'custom' && item.repeatDays?.length) return item.repeatDays
  return [item.day]
}

const toMin = (t) => {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export const itemStart = (item) => item.timeStart || item.time || ''
export const itemTimeLabel = (item) => {
  const s = itemStart(item)
  if (!s) return ''
  return item.timeEnd ? `${s}–${item.timeEnd}` : s
}

export function scheduleForDate(items, date) {
  const weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay())
  const weekKey = `SW-${keyOf(weekStart)}`
  const legacy = new Set()
  for (let i = 0; i < 7; i += 1) {
    legacy.add(isoWeekKey(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)))
  }
  const dayName = DAYS[date.getDay()]
  return items
    .filter((item) => {
      if (item.planScope && item.planScope !== 'week') return false
      // Sem planKey o item vale para a semana corrente (comportamento da Agenda).
      if (item.planKey && item.planKey !== weekKey && !legacy.has(item.planKey)) return false
      return itemDays(item).includes(dayName)
    })
    .sort((a, b) => toMin(itemStart(a)) - toMin(itemStart(b)))
}
