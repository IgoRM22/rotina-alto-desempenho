import { addDays } from './date'

export const IMPORTANT_TYPES = [
  { value: 'feriado', label: 'Feriado' },
  { value: 'aniversario', label: 'Aniversario' },
  { value: 'ferias', label: 'Ferias' },
  { value: 'importante', label: 'Data importante' },
  { value: 'outros', label: 'Outros' },
]

export const RECURRENCE_OPTIONS = [
  { value: '', label: 'Não repete' },
  { value: 'weekly', label: 'Toda semana' },
  { value: 'monthly', label: 'Todo mês' },
  { value: 'yearly', label: 'Todo ano' },
]

const parseDateKey = (key) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

const durationDays = (item) => {
  if (!item.endDate || item.endDate < item.startDate) return 0
  const start = parseDateKey(item.startDate)
  const end = parseDateKey(item.endDate)
  return Math.round((end - start) / 86400000)
}

// Returns [{ start: Date, end: Date }] occurrences of `item` overlapping [rangeStart, rangeEnd] (inclusive, whole days).
export function getOccurrencesInRange(item, rangeStart, rangeEnd) {
  if (!item.startDate) return []
  const anchor = parseDateKey(item.startDate)
  const span = durationDays(item)
  const recurrence = item.recurrence || ''
  const from = startOfDay(rangeStart)
  const to = startOfDay(rangeEnd)
  const occurrences = []

  const pushIfOverlaps = (occStart) => {
    if (occStart < anchor) return
    const occEnd = addDays(occStart, span)
    if (occEnd >= from && occStart <= to) {
      occurrences.push({ start: occStart, end: occEnd })
    }
  }

  if (!recurrence) {
    pushIfOverlaps(anchor)
    return occurrences
  }

  if (recurrence === 'weekly') {
    let cursor = new Date(anchor)
    const diffDays = Math.floor((from - cursor) / 86400000)
    if (diffDays > 0) cursor = addDays(cursor, Math.floor(diffDays / 7) * 7)
    for (let guard = 0; guard < 600 && cursor <= to; guard++) {
      pushIfOverlaps(cursor)
      cursor = addDays(cursor, 7)
    }
    return occurrences
  }

  if (recurrence === 'monthly') {
    const day = anchor.getDate()
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1)
    for (let guard = 0; guard < 200 && cursor <= to; guard++) {
      const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
      pushIfOverlaps(new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(day, daysInMonth)))
      cursor.setMonth(cursor.getMonth() + 1)
    }
    return occurrences
  }

  if (recurrence === 'yearly') {
    for (let year = from.getFullYear(); year <= to.getFullYear(); year++) {
      pushIfOverlaps(new Date(year, anchor.getMonth(), anchor.getDate()))
    }
    return occurrences
  }

  return occurrences
}

export function expandImportantDatesForRange(items, rangeStart, rangeEnd) {
  const result = []
  items.forEach((item) => {
    getOccurrencesInRange(item, rangeStart, rangeEnd).forEach((occ) => {
      result.push({ ...item, occurrenceStart: occ.start, occurrenceEnd: occ.end })
    })
  })
  return result
}
