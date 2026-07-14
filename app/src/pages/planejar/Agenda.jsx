import React, { useEffect, useMemo, useState } from 'react'
import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiCalendar2Line,
  RiCalendarScheduleLine,
  RiDeleteBinLine,
  RiFileCopyLine,
  RiHistoryLine,
  RiMoreLine,
  RiRepeat2Line,
  RiStackLine,
  RiSubtractLine,
  RiTimeLine,
} from '@remixicon/react'
import {
  listenSchedule,
  addScheduleItem,
  updateScheduleItem,
  deleteScheduleItem,
  listenImportantDates,
  addImportantDate,
  updateImportantDate,
  deleteImportantDate,
  listenScheduleCategories,
} from '../../services/firestore'
import { IMPORTANT_TYPES, RECURRENCE_OPTIONS, expandImportantDatesForRange } from '../../utils/importantDates'
import { addDays } from '../../utils/date'
import Modal from '../../components/Modal'
import Toast from '../../components/Toast'
import Tabs from '../../components/Tabs'
import MarqueeText from '../../components/MarqueeText'

const DAYS = ['Domingo', 'Segunda', 'Ter\u00E7a', 'Quarta', 'Quinta', 'Sexta', 'S\u00E1bado']
const DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'S\u00E1b']
const MONTH_LABELS = Array.from(
  { length: 12 },
  (_, month) => new Date(2024, month, 1).toLocaleDateString('pt-BR', { month: 'long' }),
)

const CATEGORIES = [
  { value: 'saude', color: '#5BA689' },
  { value: 'corp', color: '#4B8FD4' },
  { value: 'projeto', color: '#E06445' },
  { value: 'mente', color: '#8B7EC4' },
  { value: 'estudo', color: '#C4607A' },
  { value: 'familia', color: '#C49A3A' },
  { value: 'trem', color: '#7A7570' },
  { value: 'pessoal', color: '#8B7EC4' },
]

const REPEAT_OPTIONS = [
  { value: '', label: 'Dia especifico' },
  { value: 'daily', label: 'Todos os dias' },
  { value: 'weekdays', label: 'Dias uteis (Seg-Sex)' },
  { value: 'weekend', label: 'Fim de semana' },
  { value: 'custom', label: 'Personalizado...' },
]

const EMPTY_FORM = {
  timeStart: '',
  timeEnd: '',
  day: 'Domingo',
  name: '',
  description: '',
  category: 'projeto',
  repeat: '',
  repeatDays: [],
}

const EMPTY_IMPORTANT_FORM = {
  title: '',
  type: 'feriado',
  startDate: '',
  endDate: '',
  description: '',
  recurrence: '',
}

const DEFAULT_EVENT_MINUTES = 45
const BAR_EVENT_PX_PER_MINUTE = 0.42
const BAR_GAP_PX_PER_MINUTE = 0.28
const BAR_MIN_EVENT_HEIGHT = 36
const MAX_VISIBLE_LANES = 3

const pad2 = (v) => String(v).padStart(2, '0')

const toDateKey = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`

const fromDateKey = (dateKey) => {
  if (!dateKey) return null
  const [y, m, d] = dateKey.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

const toMin = (t) => {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

const formatMinuteClock = (minute) => {
  const safe = Math.max(0, Math.min(24 * 60, minute))
  const h = Math.floor(safe / 60)
  const m = safe % 60
  return `${pad2(h)}:${pad2(m)}`
}

const fmtDuration = (min) => {
  if (min <= 0) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h > 0 && m > 0) return `${h}h ${m}min`
  return h > 0 ? `${h}h` : `${m}min`
}

const colorWithAlpha = (hex, alpha, fallback = `rgba(224,100,69,${alpha})`) => {
  if (typeof hex !== 'string') return fallback
  const clean = hex.trim()
  if (!/^#[0-9a-fA-F]{6}$/.test(clean)) return fallback
  const r = parseInt(clean.slice(1, 3), 16)
  const g = parseInt(clean.slice(3, 5), 16)
  const b = parseInt(clean.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

const formatCategoryValue = (value) => {
  const safe = String(value || '').trim()
  if (!safe) return ''
  return safe.charAt(0).toUpperCase() + safe.slice(1)
}

const getItemDays = (item) => {
  if (!item.repeat) return [item.day]
  if (item.repeat === 'daily') return DAYS
  if (item.repeat === 'weekdays') return ['Segunda', 'Ter\u00E7a', 'Quarta', 'Quinta', 'Sexta']
  if (item.repeat === 'weekend') return ['Domingo', 'S\u00E1bado']
  if (item.repeat === 'custom' && item.repeatDays?.length) return item.repeatDays
  return [item.day]
}

const fmtTime = (item) => {
  if (item.timeStart) return item.timeEnd ? `${item.timeStart}-${item.timeEnd}` : item.timeStart
  return item.time || ''
}

// Only a start with no end has nothing to size a proportional block by, so it
// renders as a flat point marker instead - positioned in the flow by its start
// time rather than lumped together with items that have no time at all.
const hasTimeRange = (item) => Boolean((item.timeStart || item.time) && item.timeEnd)
const hasStartOnly = (item) => Boolean((item.timeStart || item.time) && !item.timeEnd)
const hasNoTime = (item) => !(item.timeStart || item.time)

const sortKey = (item) => toMin(item.timeStart || item.time)

const normalizeEventRange = (item) => {
  const startMin = Math.max(0, toMin(item.timeStart || item.time || '00:00'))
  let endMin = toMin(item.timeEnd)

  if (!item.timeEnd || endMin <= startMin) endMin = startMin + DEFAULT_EVENT_MINUTES
  endMin = Math.min(24 * 60, endMin)

  return { startMin, endMin }
}

const getIsoWeekMeta = (baseDate) => {
  const date = new Date(baseDate)
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = utc.getUTCDay() || 7
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum)

  const isoYear = utc.getUTCFullYear()
  const yearStart = new Date(Date.UTC(isoYear, 0, 1))
  const week = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7)

  const mondayUtc = new Date(utc)
  mondayUtc.setUTCDate(utc.getUTCDate() - ((utc.getUTCDay() || 7) - 1))
  const sundayUtc = new Date(mondayUtc)
  sundayUtc.setUTCDate(mondayUtc.getUTCDate() + 6)

  const monday = new Date(mondayUtc.getUTCFullYear(), mondayUtc.getUTCMonth(), mondayUtc.getUTCDate())
  const sunday = new Date(sundayUtc.getUTCFullYear(), sundayUtc.getUTCMonth(), sundayUtc.getUTCDate())

  return {
    scope: 'week',
    key: `W-${isoYear}-${pad2(week)}`,
    label: `Semana ${pad2(week)} - ${monday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} - ${sunday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`,
  }
}

const getWeekMeta = (baseDate) => {
  const date = new Date(baseDate)
  const weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  weekStart.setHours(0, 0, 0, 0)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)

  const legacyKeySet = new Set()
  const cursor = new Date(weekStart)
  while (cursor <= weekEnd) {
    legacyKeySet.add(getIsoWeekMeta(cursor).key)
    cursor.setDate(cursor.getDate() + 1)
  }

  return {
    scope: 'week',
    key: `SW-${toDateKey(weekStart)}`,
    label: `Semana ${weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} - ${weekEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`,
    legacyKeys: Array.from(legacyKeySet),
  }
}

const shiftPlanDate = (baseDate, step) => {
  const next = new Date(baseDate)
  next.setDate(next.getDate() + (step * 7))
  return next
}

const buildMonthCells = (year, month) => {
  const first = new Date(year, month, 1)
  const startOffset = first.getDay()
  const totalDays = new Date(year, month + 1, 0).getDate()

  return Array.from({ length: 42 }, (_, idx) => {
    const dayNumber = idx - startOffset + 1
    const dayDate = new Date(year, month, dayNumber)
    const inMonth = dayNumber >= 1 && dayNumber <= totalDays

    return {
      key: toDateKey(dayDate),
      dayNumber: dayDate.getDate(),
      inMonth,
      isToday: toDateKey(dayDate) === toDateKey(new Date()),
    }
  })
}

const toCluster = (events) => {
  const ordered = [...events].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin)
  const laneEnds = []

  const positioned = ordered.map((event) => {
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= event.startMin)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(event.endMin)
    } else {
      laneEnds[lane] = event.endMin
    }
    return { ...event, lane }
  })

  const startMin = Math.min(...ordered.map((event) => event.startMin))
  const endMin = Math.max(...ordered.map((event) => event.endMin))

  return {
    type: 'cluster',
    startMin,
    endMin,
    duration: endMin - startMin,
    laneCount: Math.max(1, laneEnds.length),
    events: positioned,
  }
}

const buildDayClusters = (dayItems) => {
  const events = dayItems
    .map((item) => {
      const { startMin, endMin } = normalizeEventRange(item)
      return { item, startMin, endMin }
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin)

  if (events.length === 0) return []

  const clusters = []
  let group = [events[0]]
  let groupStartMin = events[0].startMin
  let groupEnd = events[0].endMin

  for (let i = 1; i < events.length; i++) {
    const current = events[i]
    // Encavalamento somente quando os itens iniciam no mesmo minuto.
    if (current.startMin === groupStartMin) {
      group.push(current)
      groupEnd = Math.max(groupEnd, current.endMin)
      continue
    }
    clusters.push(toCluster(group))
    group = [current]
    groupStartMin = current.startMin
    groupEnd = current.endMin
  }
  clusters.push(toCluster(group))

  return clusters
}

const buildDayFlow = (dayItems) => {
  const clusters = buildDayClusters(dayItems)
  if (clusters.length === 0) return []

  const flow = []
  for (let i = 0; i < clusters.length; i++) {
    if (i > 0) {
      const gap = clusters[i].startMin - clusters[i - 1].endMin
      if (gap > 0) {
        flow.push({
          type: 'gap',
          duration: gap,
          start: clusters[i - 1].endMin,
          end: clusters[i].startMin,
        })
      }
    }
    flow.push(clusters[i])
  }

  return flow
}

const entryBoundaryEnd = (entry) => {
  if (entry.type === 'gap') return entry.end
  if (entry.type === 'point') return entry.startMin
  if (entry.type === 'now') return entry.minute
  return entry.endMin
}

const entryBoundaryStart = (entry) => {
  if (entry.type === 'gap') return entry.start
  if (entry.type === 'point') return entry.startMin
  if (entry.type === 'now') return entry.minute
  return entry.startMin
}

// Items with only a start time (no end) have no duration to size a block by,
// but they still happened at a specific moment - so they're spliced into the
// flow as flat point markers instead of being lumped together out of order.
// Positioned against each entry's own start (not end) so a point that lands
// on another block's end - e.g. "Dormir" at 22:00 right after an item that
// runs until 22:00 - lands after it instead of splitting it from what follows.
const insertPointMarkers = (flow, pointItems) => {
  const sorted = [...pointItems].sort((a, b) => toMin(a.timeStart || a.time) - toMin(b.timeStart || b.time))

  return sorted.reduce((acc, item) => {
    const startMin = toMin(item.timeStart || item.time)
    const marker = { type: 'point', item, startMin }
    const index = acc.findIndex((entry) => startMin < entryBoundaryStart(entry))
    return index === -1 ? [...acc, marker] : [...acc.slice(0, index), marker, ...acc.slice(index)]
  }, flow)
}

const insertNowMarker = (day, flow, todayDay, nowMin, nowLabel) => {
  if (day !== todayDay) return flow

  const marker = { type: 'now', minute: nowMin, label: nowLabel }
  const index = flow.findIndex((entry) => nowMin <= entryBoundaryEnd(entry))

  if (index === -1) return [...flow, marker]
  return [...flow.slice(0, index), marker, ...flow.slice(index)]
}

const importantTypeLabel = (type) => IMPORTANT_TYPES.find((entry) => entry.value === type)?.label || 'Data importante'

export default function Cronograma() {
  const [items, setItems] = useState([])
  const [importantDates, setImportantDates] = useState([])
  const [categories, setCategories] = useState(CATEGORIES)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showImportantModal, setShowImportantModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [editingImportant, setEditingImportant] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [importantForm, setImportantForm] = useState(EMPTY_IMPORTANT_FORM)
  const [toast, setToast] = useState(null)
  const [activeDay, setActiveDay] = useState('Todos')
  const [view, setView] = useState('lista')
  const [now, setNow] = useState(new Date())
  const [planDate, setPlanDate] = useState(new Date())
  const [showHistory, setShowHistory] = useState(false)
  const [calendarCursor, setCalendarCursor] = useState(() => {
    const current = new Date()
    return new Date(current.getFullYear(), current.getMonth(), 1)
  })

  const currentWeekMeta = useMemo(() => getWeekMeta(now), [now])
  const legacyWeekKey = useMemo(() => getIsoWeekMeta(new Date()).key, [])

  useEffect(() => {
    const unsub = listenSchedule((data) => {
      setItems(data)
      setLoading(false)
    })
    return unsub
  }, [])

  useEffect(() => {
    const unsub = listenImportantDates((data) => {
      setImportantDates(data)
    })
    return unsub
  }, [])

  useEffect(() => {
    const unsub = listenScheduleCategories(setCategories)
    return unsub
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])

  const nowMin = now.getHours() * 60 + now.getMinutes()
  const nowLabel = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const todayDay = DAYS[now.getDay()]

  const planMeta = useMemo(() => getWeekMeta(planDate), [planDate])
  const isCurrentWeek = useMemo(() => planMeta.key === currentWeekMeta.key, [planMeta.key, currentWeekMeta.key])

  const planWeekDates = useMemo(() => {
    const weekStart = new Date(planDate.getFullYear(), planDate.getMonth(), planDate.getDate())
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    return DAYS.map((_, idx) => {
      const day = new Date(weekStart)
      day.setDate(weekStart.getDate() + idx)
      return day
    })
  }, [planDate])

  const todayIndex = now.getDay()
  const isPastDay = (day) => isCurrentWeek && DAYS.indexOf(day) < todayIndex
  const orderedDays = isCurrentWeek ? [...DAYS.slice(todayIndex), ...DAYS.slice(0, todayIndex)] : DAYS

  const calendarYear = calendarCursor.getFullYear()
  const calendarMonth = calendarCursor.getMonth()
  const calendarLabel = calendarCursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const start = Math.min(currentYear - 8, calendarYear - 4)
    const end = Math.max(currentYear + 8, calendarYear + 4)
    const options = []
    for (let year = start; year <= end; year++) options.push(year)
    return options
  }, [calendarYear])

  const scopedItems = useMemo(() => {
    return items.filter((item) => {
      if (item.planScope && item.planScope !== 'week') return false
      if (item.planKey) return item.planKey === planMeta.key || planMeta.legacyKeys.includes(item.planKey)
      return planMeta.key === currentWeekMeta.key || planMeta.legacyKeys.includes(legacyWeekKey)
    })
  }, [items, planMeta.key, planMeta.legacyKeys, currentWeekMeta.key, legacyWeekKey])

  const grouped = useMemo(() => {
    return DAYS.reduce((acc, day) => {
      acc[day] = scopedItems
        .filter((item) => getItemDays(item).includes(day) && hasTimeRange(item))
        .sort((a, b) => sortKey(a) - sortKey(b))
      return acc
    }, {})
  }, [scopedItems])

  const pointGrouped = useMemo(() => {
    return DAYS.reduce((acc, day) => {
      acc[day] = scopedItems.filter((item) => getItemDays(item).includes(day) && hasStartOnly(item))
      return acc
    }, {})
  }, [scopedItems])

  const untimedGrouped = useMemo(() => {
    return DAYS.reduce((acc, day) => {
      acc[day] = scopedItems.filter((item) => getItemDays(item).includes(day) && hasNoTime(item))
      return acc
    }, {})
  }, [scopedItems])

  const dayFlows = useMemo(() => {
    return DAYS.reduce((acc, day) => {
      const flow = insertPointMarkers(buildDayFlow(grouped[day] || []), pointGrouped[day] || [])
      acc[day] = isCurrentWeek
        ? insertNowMarker(day, flow, todayDay, nowMin, nowLabel)
        : flow
      return acc
    }, {})
  }, [grouped, pointGrouped, todayDay, nowMin, nowLabel, isCurrentWeek])

  const categoryOptions = useMemo(() => {
    const input = Array.isArray(categories) ? categories : []
    const seen = new Set()
    const result = []

    input.forEach((entry) => {
      let value = ''
      let color = ''

      if (typeof entry === 'string') {
        value = entry.trim().toLowerCase()
        color = CATEGORIES.find((cat) => cat.value === value)?.color || '#E06445'
      } else {
        value = String(entry?.value || '').trim().toLowerCase()
        color = String(entry?.color || '').trim() || CATEGORIES.find((cat) => cat.value === value)?.color || '#E06445'
      }

      if (!value || seen.has(value)) return
      seen.add(value)
      result.push({ value, color })
    })

    return result.length ? result : CATEGORIES
  }, [categories])

  const categoryColorMap = useMemo(() => {
    return categoryOptions.reduce((acc, entry) => {
      acc[entry.value] = entry.color || '#E06445'
      return acc
    }, {})
  }, [categoryOptions])

  const getCategoryColor = (value) => {
    const key = String(value || '').trim().toLowerCase()
    return categoryColorMap[key] || '#E06445'
  }

  const dayHasContent = (day) => grouped[day]?.length > 0 || pointGrouped[day]?.length > 0 || untimedGrouped[day]?.length > 0

  const todosDaysWithContent = orderedDays.filter((day) => dayHasContent(day) || day === todayDay)
  const hiddenPastDays = todosDaysWithContent.filter((day) => isPastDay(day))

  const visibleDays = activeDay === 'Todos'
    ? (showHistory ? todosDaysWithContent : todosDaysWithContent.filter((day) => !isPastDay(day)))
    : (dayHasContent(activeDay) || activeDay === todayDay ? [activeDay] : [])

  const monthCells = useMemo(() => buildMonthCells(calendarYear, calendarMonth), [calendarYear, calendarMonth])

  const importantByDay = useMemo(() => {
    const byDay = {}
    monthCells.forEach((cell) => {
      byDay[cell.key] = []
    })

    if (monthCells.length === 0) return byDay

    const rangeStart = fromDateKey(monthCells[0].key)
    const rangeEnd = fromDateKey(monthCells[monthCells.length - 1].key)
    const occurrences = expandImportantDatesForRange(importantDates, rangeStart, rangeEnd)

    occurrences.forEach((occ) => {
      let current = occ.occurrenceStart
      let guard = 0
      while (current <= occ.occurrenceEnd && guard < 800) {
        const key = toDateKey(current)
        if (byDay[key]) byDay[key].push(occ)
        current = addDays(current, 1)
        guard += 1
      }
    })

    Object.keys(byDay).forEach((key) => {
      byDay[key].sort((a, b) => {
        if ((a.startDate || '') !== (b.startDate || '')) return (a.startDate || '').localeCompare(b.startDate || '')
        return (a.title || '').localeCompare(b.title || '')
      })
    })

    return byDay
  }, [importantDates, monthCells])

  const weekImportantByDay = useMemo(() => {
    const byDay = {}
    DAYS.forEach((day) => { byDay[day] = [] })

    const rangeStart = planWeekDates[0]
    const rangeEnd = planWeekDates[6]
    const occurrences = expandImportantDatesForRange(importantDates, rangeStart, rangeEnd)

    occurrences.forEach((occ) => {
      let current = occ.occurrenceStart < rangeStart ? rangeStart : occ.occurrenceStart
      const last = occ.occurrenceEnd > rangeEnd ? rangeEnd : occ.occurrenceEnd
      let guard = 0
      while (current <= last && guard < 14) {
        byDay[DAYS[current.getDay()]].push(occ)
        current = addDays(current, 1)
        guard += 1
      }
    })

    return byDay
  }, [importantDates, planWeekDates])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const openAdd = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM, day: activeDay !== 'Todos' ? activeDay : 'Domingo' })
    setShowModal(true)
  }

  const openEdit = (item) => {
    setEditing(item)
    setForm({
      timeStart: item.timeStart || '',
      timeEnd: item.timeEnd || '',
      day: item.day,
      name: item.name,
      description: item.description || '',
      category: item.category || 'projeto',
      repeat: item.repeat || '',
      repeatDays: item.repeatDays || [],
    })
    setShowModal(true)
  }

  const movePlan = (dir) => {
    setPlanDate((prev) => shiftPlanDate(prev, dir))
    setShowHistory(false)
  }
  const resetPlanToCurrent = () => {
    setPlanDate(new Date())
    setShowHistory(false)
    const current = new Date()
    setCalendarCursor(new Date(current.getFullYear(), current.getMonth(), 1))
  }

  const handleCloneWeek = async () => {
    if (scopedItems.length === 0) {
      showToast('Nao ha itens para clonar nesta semana.', 'error')
      return
    }

    const targetDate = shiftPlanDate(planDate, 1)
    const targetMeta = getWeekMeta(targetDate)
    const existingOnTarget = items.filter(
      (item) => item.planKey === targetMeta.key || targetMeta.legacyKeys.includes(item.planKey),
    ).length

    if (existingOnTarget > 0) {
      const proceed = window.confirm(
        `${targetMeta.label} ja possui ${existingOnTarget} item(ns). Deseja clonar mesmo assim?`,
      )
      if (!proceed) return
    }

    try {
      const payloads = scopedItems.map((item) => {
        const { id, createdAt, updatedAt, ...rest } = item
        return {
          ...rest,
          planScope: 'week',
          planKey: targetMeta.key,
          planLabel: targetMeta.label,
        }
      })

      await Promise.all(payloads.map((data) => addScheduleItem(data)))
      setPlanDate(targetDate)
      showToast(`${payloads.length} item(ns) clonados para a proxima semana.`)
    } catch {
      showToast('Erro ao clonar semana.', 'error')
    }
  }

  const handleSave = async () => {
    if (!form.name.trim()) return

    try {
      const data = {
        ...form,
        planScope: 'week',
        planKey: planMeta.key,
        planLabel: planMeta.label,
      }

      if (data.repeat !== 'custom') data.repeatDays = []

      if (editing) {
        await updateScheduleItem(editing.id, data)
        showToast('Atualizado!')
      } else {
        await addScheduleItem(data)
        showToast('Adicionado!')
      }

      setShowModal(false)
    } catch {
      showToast('Erro ao salvar.', 'error')
    }
  }

  const handleDelete = async (id) => {
    await deleteScheduleItem(id)
    showToast('Removido.')
  }

  const handleDeleteFromModal = async () => {
    if (!editing) return
    await handleDelete(editing.id)
    setShowModal(false)
  }

  const moveCalendarMonth = (step) => {
    setCalendarCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + step, 1))
  }

  const openAddImportantDate = (dateKey) => {
    setEditingImportant(null)
    setImportantForm({
      ...EMPTY_IMPORTANT_FORM,
      startDate: dateKey,
    })
    setShowImportantModal(true)
  }

  const openAddImportantForVisibleMonth = () => {
    const todayKey = toDateKey(new Date())
    const monthPrefix = `${calendarYear}-${pad2(calendarMonth + 1)}`
    const suggested = todayKey.startsWith(monthPrefix) ? todayKey : `${monthPrefix}-01`
    openAddImportantDate(suggested)
  }

  const openEditImportantDate = (item) => {
    setEditingImportant(item)
    setImportantForm({
      title: item.title || '',
      type: item.type || 'importante',
      startDate: item.startDate || '',
      endDate: item.endDate || '',
      description: item.description || '',
      recurrence: item.recurrence || '',
    })
    setShowImportantModal(true)
  }

  const handleSaveImportantDate = async () => {
    const title = importantForm.title.trim()
    if (!title || !importantForm.startDate) {
      showToast('Preencha titulo e data inicial.', 'error')
      return
    }

    if (importantForm.endDate && importantForm.endDate < importantForm.startDate) {
      showToast('Data final deve ser maior ou igual a data inicial.', 'error')
      return
    }

    const data = {
      title,
      type: importantForm.type || 'importante',
      startDate: importantForm.startDate,
      endDate: importantForm.endDate || '',
      description: importantForm.description.trim(),
      recurrence: importantForm.recurrence || '',
    }

    try {
      if (editingImportant) {
        await updateImportantDate(editingImportant.id, data)
        showToast('Data importante atualizada!')
      } else {
        await addImportantDate(data)
        showToast('Data importante adicionada!')
      }
      setShowImportantModal(false)
    } catch {
      showToast('Erro ao salvar data importante.', 'error')
    }
  }

  const handleDeleteImportantDate = async (id) => {
    const proceed = window.confirm('Excluir esta data importante?')
    if (!proceed) return

    try {
      await deleteImportantDate(id)
      setShowImportantModal(false)
      showToast('Data importante removida.')
    } catch {
      showToast('Erro ao remover data importante.', 'error')
    }
  }

  const renderItem = (item, options = {}) => {
    const key = options.key || item.id
    const categoryColor = getCategoryColor(item.category)
    const categoryPillStyle = {
      color: categoryColor,
      background: colorWithAlpha(categoryColor, 0.14),
      border: `1px solid ${colorWithAlpha(categoryColor, 0.42)}`,
    }

    return (
      <div key={key} className={`schedule-item ${options.compact ? 'is-compact' : ''}`}>
        <div className="schedule-time">{fmtTime(item)}</div>
        <div className="schedule-bar" style={{ background: categoryColor }} />
        <div className="schedule-body">
          <div className="schedule-name">{item.name}</div>
          {item.description && <div className="schedule-desc">{item.description}</div>}
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="pill" style={categoryPillStyle}>
              {formatCategoryValue(item.category) || 'Categoria'}
            </span>
            {item.repeat ? (
              <span className="schedule-repeat">
                <RiRepeat2Line size={13} aria-hidden="true" />
                {REPEAT_OPTIONS.find((entry) => entry.value === item.repeat)?.label || ''}
              </span>
            ) : null}
          </div>
        </div>
        <div className="schedule-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(item)}>editar</button>
          <button
            className="btn btn-danger btn-sm btn-icon"
            onClick={() => handleDelete(item.id)}
            aria-label="Excluir item"
            title="Excluir item"
          >
            <RiDeleteBinLine size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    )
  }

  const renderListCluster = (cluster, day, idx) => {
    if (cluster.laneCount <= 1) {
      return renderItem(cluster.events[0].item, { key: `${day}-single-${idx}` })
    }

    return (
      <div key={`${day}-overlap-${idx}`} className="schedule-overlap-group">
        <div className="schedule-overlap-head">
          <span className="schedule-overlap-title">
            <RiStackLine size={13} aria-hidden="true" />
            Encavalados ({cluster.events.length})
          </span>
          <span className="schedule-overlap-range">
            {formatMinuteClock(cluster.startMin)} - {formatMinuteClock(cluster.endMin)}
          </span>
        </div>
        <div className="schedule-overlap-list">
          {cluster.events.map((event) => renderItem(event.item, { key: `${event.item.id}-${event.lane}`, compact: true }))}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="subpage-controls schedule-page-header">
        {view !== 'calendario' && (
          <div className="schedule-plan-nav">
            <button className="btn btn-ghost btn-sm btn-icon plan-nav-btn" onClick={() => movePlan(-1)} aria-label="Semana anterior">
              <RiArrowLeftSLine size={16} aria-hidden="true" />
            </button>
            <div className="schedule-plan-label">
              <RiCalendar2Line size={13} aria-hidden="true" />
              {planMeta.label}
            </div>
            <button className="btn btn-ghost btn-sm btn-icon plan-nav-btn" onClick={() => movePlan(1)} aria-label="Proxima semana">
              <RiArrowRightSLine size={16} aria-hidden="true" />
            </button>
            <button className="btn btn-ghost btn-sm plan-nav-today" onClick={resetPlanToCurrent}>Hoje</button>
            <details className="plan-more-menu">
              <summary className="btn btn-ghost btn-sm btn-icon" aria-label="Mais ações">
                <RiMoreLine size={16} aria-hidden="true" />
              </summary>
              <div className="plan-more-menu-panel">
                <button type="button" className="plan-more-menu-item" onClick={handleCloneWeek}>
                  <RiFileCopyLine size={14} aria-hidden="true" /> Clonar semana
                </button>
              </div>
            </details>
          </div>
        )}

        <div className="schedule-view-actions">
          <Tabs
            variant="segmented"
            items={[{ key: 'lista', label: 'Lista' }, { key: 'semanal', label: 'Semanal' }, { key: 'calendario', label: 'Calendário' }]}
            active={view}
            onChange={setView}
          />
          <button className="btn btn-primary" onClick={view === 'calendario' ? openAddImportantForVisibleMonth : openAdd}>
            {view === 'calendario' ? '+ Data importante' : '+ Adicionar'}
          </button>
        </div>
      </div>

      {view === 'lista' && (
        <>
          <Tabs
            scroll
            items={['Todos', ...DAYS].map((day) => ({ key: day, label: day }))}
            active={activeDay}
            onChange={setActiveDay}
          />

          {activeDay === 'Todos' && isCurrentWeek && hiddenPastDays.length > 0 && (
            <button
              type="button"
              className="btn btn-ghost btn-sm schedule-history-toggle"
              onClick={() => setShowHistory((prev) => !prev)}
            >
              <RiHistoryLine size={14} aria-hidden="true" />
              {showHistory ? 'Ocultar dias anteriores' : `Ver dias anteriores (${hiddenPastDays.length})`}
            </button>
          )}

          {visibleDays.map((day) => {
            const segments = dayFlows[day] || []
            const isToday = isCurrentWeek && day === todayDay
            return (
              <div key={day} className={`schedule-group ${isPastDay(day) ? 'is-past' : ''}`}>
                <div className="schedule-day-label">
                  {day}
                  {isToday && <span className="schedule-today-badge">Hoje</span>}
                </div>
                {(weekImportantByDay[day] || []).map((occ, idx) => (
                  <button
                    key={`imp-${occ.id}-${idx}`}
                    type="button"
                    className={`schedule-important-banner imp-${occ.type || 'importante'}`}
                    onClick={() => openEditImportantDate(occ)}
                  >
                    {occ.recurrence && <RiRepeat2Line size={11} aria-hidden="true" />}
                    <MarqueeText text={occ.title} />
                  </button>
                ))}
                {(untimedGrouped[day] || []).map((item) => {
                  const categoryColor = getCategoryColor(item.category)
                  return (
                    <button
                      key={`untimed-${item.id}`}
                      type="button"
                      className="schedule-untimed-row"
                      style={{ borderLeftColor: categoryColor, color: categoryColor }}
                      onClick={() => openEdit(item)}
                    >
                      <MarqueeText text={item.name} />
                    </button>
                  )
                })}
                {segments.map((entry, idx) => {
                  if (entry.type === 'now') {
                    return (
                      <div key={`now-${day}-${idx}`} className="schedule-now-marker" aria-label={`Agora ${entry.label}`}>
                        <span className="schedule-now-time">Agora {entry.label}</span>
                        <span className="schedule-now-line" />
                      </div>
                    )
                  }

                  if (entry.type === 'gap') {
                    return (
                      <div key={`gap-${day}-${idx}`} className="schedule-gap">
                        <span className="gap-label"><RiTimeLine size={13} aria-hidden="true" /> Livre - {fmtDuration(entry.duration)}</span>
                        <span className="gap-time">{formatMinuteClock(entry.start)}{' -> '}{formatMinuteClock(entry.end)}</span>
                      </div>
                    )
                  }

                  if (entry.type === 'point') {
                    const categoryColor = getCategoryColor(entry.item.category)
                    return (
                      <button
                        key={`point-${day}-${idx}`}
                        type="button"
                        className="schedule-untimed-row"
                        style={{ borderLeftColor: categoryColor, color: categoryColor }}
                        onClick={() => openEdit(entry.item)}
                      >
                        <span className="schedule-time-inline">{fmtTime(entry.item)}</span>
                        <MarqueeText text={entry.item.name} />
                      </button>
                    )
                  }

                  return renderListCluster(entry, day, idx)
                })}
              </div>
            )
          })}

          {visibleDays.length === 0 && !loading && (
            <div className="empty-state">
              <div className="empty-state-icon"><RiCalendarScheduleLine size={28} aria-hidden="true" /></div>
              Nenhum item para esta semana.
            </div>
          )}
        </>
      )}

      {view === 'semanal' && (
        <div className="calendar-week-bars" role="grid" aria-label="Cronograma semanal em barras">
          {DAYS.map((day, dayIndex) => {
            const segments = dayFlows[day] || []
            const dateLabel = planWeekDates[dayIndex].toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
            const isToday = isCurrentWeek && day === todayDay

            return (
              <section key={day} className={`calendar-bars-day ${isToday ? 'is-today' : ''}`} role="row">
                <div className="calendar-bars-header" role="columnheader" aria-label={`${day} ${dateLabel}`}>
                  <span className="calendar-bars-short">{DAYS_SHORT[dayIndex]}</span>
                  <span className="calendar-bars-date">{dateLabel}</span>
                </div>

                {(weekImportantByDay[day] || []).map((occ, idx) => (
                  <button
                    key={`imp-${occ.id}-${idx}`}
                    type="button"
                    className={`calendar-bars-important imp-${occ.type || 'importante'}`}
                    onClick={() => openEditImportantDate(occ)}
                  >
                    {occ.recurrence && <RiRepeat2Line size={9} aria-hidden="true" />}
                    <MarqueeText text={occ.title} />
                  </button>
                ))}

                {(untimedGrouped[day] || []).map((item) => {
                  const categoryColor = getCategoryColor(item.category)
                  return (
                    <button
                      key={`untimed-${item.id}`}
                      type="button"
                      className="calendar-bars-untimed"
                      style={{ borderLeftColor: categoryColor, color: categoryColor }}
                      onClick={() => openEdit(item)}
                    >
                      <MarqueeText text={item.name} />
                    </button>
                  )
                })}

                <div className="calendar-bars-track">
                  {segments.length === 0 && (untimedGrouped[day] || []).length === 0 && (
                    <div className="calendar-empty-day">
                      <RiSubtractLine size={16} aria-hidden="true" />
                      <span>Sem tarefas</span>
                    </div>
                  )}

                  {segments.map((segment, idx) => {
                    // The "now" marker is just an overlay, not a real schedule gap, so
                    // adjacency is checked against the next/previous non-"now" segment.
                    const nextReal = segments.slice(idx + 1).find((entry) => entry.type !== 'now') || null
                    const prevReal = [...segments.slice(0, idx)].reverse().find((entry) => entry.type !== 'now') || null

                    // Back-to-back clusters (one ends exactly when the next starts) stay
                    // glued with no gap; everything else keeps the normal breathing room.
                    const glued = segment.type === 'now'
                      ? prevReal?.type === 'cluster' && nextReal?.type === 'cluster' && prevReal.endMin === nextReal.startMin
                      : segment.type === 'cluster' && nextReal?.type === 'cluster' && segment.endMin === nextReal.startMin
                    const spacing = idx < segments.length - 1 ? (glued ? 0 : 10) : 0

                    if (segment.type === 'now') {
                      return (
                        <div key={`bar-now-${day}-${idx}`} className="calendar-bars-now" style={{ marginBottom: spacing }} aria-label={`Agora ${segment.label}`}>
                          <span className="calendar-bars-now-pill">Agora {segment.label}</span>
                          <span className="calendar-bars-now-line" />
                        </div>
                      )
                    }

                    if (segment.type === 'gap') {
                      const gapHeight = Math.max(10, segment.duration * BAR_GAP_PX_PER_MINUTE)
                      return (
                        <div key={`bar-gap-${day}-${idx}`} className="calendar-bars-gap" style={{ height: `${gapHeight}px`, marginBottom: spacing }}>
                          {segment.duration >= 45 && <span>{fmtDuration(segment.duration)}</span>}
                        </div>
                      )
                    }

                    if (segment.type === 'point') {
                      const categoryColor = getCategoryColor(segment.item.category)
                      return (
                        <button
                          key={`bar-point-${day}-${idx}`}
                          type="button"
                          className="calendar-bars-untimed"
                          style={{ borderLeftColor: categoryColor, color: categoryColor, marginBottom: spacing }}
                          onClick={() => openEdit(segment.item)}
                        >
                          <span className="schedule-time-inline">{fmtTime(segment.item)}</span>
                          <MarqueeText text={segment.item.name} />
                        </button>
                      )
                    }

                    const eventVisuals = segment.events.map((event) => {
                      const top = (event.startMin - segment.startMin) * BAR_EVENT_PX_PER_MINUTE
                      const height = Math.max(BAR_MIN_EVENT_HEIGHT, (event.endMin - event.startMin) * BAR_EVENT_PX_PER_MINUTE)
                      return { ...event, top, height }
                    })

                    // No BAR_MIN_CLUSTER_HEIGHT floor here: each event already enforces
                    // BAR_MIN_EVENT_HEIGHT on its own, so the cluster box hugs it exactly -
                    // otherwise a short event leaves a sliver of empty space below its bar,
                    // which reads as an unwanted gap before the next glued item.
                    const clusterHeight = Math.max(
                      segment.duration * BAR_EVENT_PX_PER_MINUTE,
                      ...eventVisuals.map((event) => event.top + event.height),
                    )

                    const isOverflowing = segment.laneCount > MAX_VISIBLE_LANES
                    const overflowLane = MAX_VISIBLE_LANES - 1
                    const effectiveLaneCount = isOverflowing ? MAX_VISIBLE_LANES : segment.laneCount
                    const laneWidth = 100 / effectiveLaneCount
                    const visibleEvents = isOverflowing
                      ? eventVisuals.filter((event) => event.lane < overflowLane)
                      : eventVisuals
                    const overflowEvents = isOverflowing
                      ? eventVisuals.filter((event) => event.lane >= overflowLane)
                      : []

                    return (
                      <div
                        key={`bar-cluster-${day}-${idx}`}
                        className={`calendar-bars-cluster ${segment.laneCount > 1 ? 'is-overlap' : ''}`}
                        style={{ height: `${clusterHeight}px`, marginBottom: spacing }}
                      >
                        {visibleEvents.map((event) => {
                          const left = event.lane * laneWidth
                          const eventColor = getCategoryColor(event.item.category)
                          return (
                            <button
                              key={`${event.item.id}-${event.lane}`}
                              type="button"
                              className="calendar-bar-item"
                              style={{
                                top: `${event.top}px`,
                                height: `${event.height}px`,
                                left: `calc(${left}% + 2px)`,
                                width: `calc(${laneWidth}% - 4px)`,
                                borderLeftColor: eventColor,
                                background: colorWithAlpha(eventColor, 0.18),
                              }}
                              title={`${fmtTime(event.item)} - ${event.item.name}`}
                              onClick={() => openEdit(event.item)}
                            >
                              <div className="calendar-bar-time">{fmtTime(event.item)}</div>
                              <MarqueeText text={event.item.name} className="calendar-bar-name" />
                            </button>
                          )
                        })}
                        {overflowEvents.length > 0 && (
                          <details
                            className="calendar-bar-overflow"
                            style={{
                              top: `${Math.min(...overflowEvents.map((event) => event.top))}px`,
                              height: `${Math.max(...overflowEvents.map((event) => event.top + event.height)) - Math.min(...overflowEvents.map((event) => event.top))}px`,
                              left: `calc(${overflowLane * laneWidth}% + 2px)`,
                              width: `calc(${laneWidth}% - 4px)`,
                            }}
                          >
                            <summary className="calendar-bar-overflow-summary">+{overflowEvents.length} mais</summary>
                            <div className="calendar-bar-overflow-panel">
                              {overflowEvents.map((event) => (
                                <button
                                  key={`overflow-${event.item.id}-${event.lane}`}
                                  type="button"
                                  className="calendar-bar-overflow-item"
                                  onClick={() => openEdit(event.item)}
                                >
                                  {fmtTime(event.item)} · {event.item.name}
                                </button>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {view === 'calendario' && (
        <div className="month-calendar-wrap">
          <div className="month-calendar-toolbar">
            <div className="month-calendar-nav" aria-label="Navegacao mensal">
              <button
                type="button"
                className="month-calendar-arrow"
                onClick={() => moveCalendarMonth(-1)}
                aria-label="Mes anterior"
              >
                <RiArrowLeftSLine size={16} aria-hidden="true" />
              </button>
              <details className="month-calendar-picker">
                <summary className="month-calendar-period" aria-live="polite">{calendarLabel}</summary>
                <div className="month-calendar-picker-panel">
                  <select
                    className="calendar-select"
                    value={calendarMonth}
                    onChange={(e) => setCalendarCursor(new Date(calendarYear, Number(e.target.value), 1))}
                    aria-label="Mes"
                  >
                    {MONTH_LABELS.map((month, index) => (
                      <option key={month} value={index}>{month}</option>
                    ))}
                  </select>

                  <select
                    className="calendar-select"
                    value={calendarYear}
                    onChange={(e) => setCalendarCursor(new Date(Number(e.target.value), calendarMonth, 1))}
                    aria-label="Ano"
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </details>
              <button
                type="button"
                className="month-calendar-arrow"
                onClick={() => moveCalendarMonth(1)}
                aria-label="Proximo mes"
              >
                <RiArrowRightSLine size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="month-calendar-grid" role="grid" aria-label="Calendario mensal">
            {DAYS_SHORT.map((shortDay) => (
              <div key={`weekday-${shortDay}`} className="month-weekday">{shortDay}</div>
            ))}

            {monthCells.map((cell) => {
              const dayItems = importantByDay[cell.key] || []
              return (
                <div key={cell.key} className={`month-cell ${cell.inMonth ? '' : 'is-outside'} ${cell.isToday ? 'is-today' : ''}`}>
                  <button
                    type="button"
                    className="month-cell-day"
                    onClick={() => openAddImportantDate(cell.key)}
                    title="Adicionar data importante"
                  >
                    {cell.dayNumber}
                  </button>

                  <div className="month-cell-items">
                    {dayItems.slice(0, 3).map((entry) => (
                      <button
                        key={`${entry.id}-${cell.key}`}
                        type="button"
                        className={`month-item-pill imp-${entry.type || 'importante'}`}
                        onClick={() => openEditImportantDate(entry)}
                        title={`${entry.title}${entry.endDate ? ` (${entry.startDate} ate ${entry.endDate})` : ''}`}
                      >
                        {entry.recurrence && <RiRepeat2Line size={9} aria-hidden="true" />}
                        <MarqueeText text={entry.title} />
                      </button>
                    ))}

                    {dayItems.length > 3 && (
                      <span className="month-item-more">+{dayItems.length - 3}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="month-calendar-legend">
            {IMPORTANT_TYPES.map((type) => (
              <span key={type.value} className={`month-legend-item imp-${type.value}`}>{type.label}</span>
            ))}
            <span className="month-calendar-note">Clique no numero do dia para criar. Clique em um item para editar.</span>
          </div>
        </div>
      )}

      {showModal && (
        <Modal
          title={editing ? 'Editar item' : 'Novo item'}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        >
          {!editing && (
            <div className="schedule-week-note">
              Este item sera salvo somente nesta semana: {planMeta.label}
            </div>
          )}

          <div className="field">
            <label>Nome</label>
            <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Ex: Hora do Fundador" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Inicio</label>
              <input type="time" value={form.timeStart} onChange={(e) => setForm((prev) => ({ ...prev, timeStart: e.target.value }))} />
            </div>
            <div className="field">
              <label>Fim</label>
              <input type="time" value={form.timeEnd} onChange={(e) => setForm((prev) => ({ ...prev, timeEnd: e.target.value }))} />
            </div>
          </div>

          <div className="field">
            <label>Repeticao</label>
            <select value={form.repeat} onChange={(e) => setForm((prev) => ({ ...prev, repeat: e.target.value }))}>
              {REPEAT_OPTIONS.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
            </select>
          </div>

          {(!form.repeat || form.repeat === '') && (
            <div className="field">
              <label>Dia</label>
              <select value={form.day} onChange={(e) => setForm((prev) => ({ ...prev, day: e.target.value }))}>
                {DAYS.map((day) => <option key={day}>{day}</option>)}
              </select>
            </div>
          )}

          {form.repeat === 'custom' && (
            <div className="field">
              <label>Dias especificos</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {DAYS.map((day, idx) => (
                  <button
                    key={day}
                    type="button"
                    className={`day-toggle ${form.repeatDays.includes(day) ? 'active' : ''}`}
                    onClick={() => setForm((prev) => ({
                      ...prev,
                      repeatDays: prev.repeatDays.includes(day)
                        ? prev.repeatDays.filter((entry) => entry !== day)
                        : [...prev.repeatDays, day],
                    }))}
                  >
                    {DAYS_SHORT[idx]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="field">
            <label>Categoria</label>
            <select value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}>
              {categoryOptions.map((category) => (
                <option key={category.value} value={category.value}>{formatCategoryValue(category.value)}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Descricao (opcional)</label>
            <textarea rows={2} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
          </div>

          {editing && (
            <div className="important-modal-actions">
              <button className="btn btn-danger btn-sm" onClick={handleDeleteFromModal}>
                <RiDeleteBinLine size={14} aria-hidden="true" /> Excluir item
              </button>
            </div>
          )}
        </Modal>
      )}

      {showImportantModal && (
        <Modal
          title={editingImportant ? 'Editar data importante' : 'Nova data importante'}
          onClose={() => setShowImportantModal(false)}
          onSave={handleSaveImportantDate}
        >
          <div className="field">
            <label>Titulo</label>
            <input
              value={importantForm.title}
              onChange={(e) => setImportantForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Ex: Aniversario da Maria"
            />
          </div>

          <div className="field">
            <label>Tipo</label>
            <select
              value={importantForm.type}
              onChange={(e) => setImportantForm((prev) => ({ ...prev, type: e.target.value }))}
            >
              {IMPORTANT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Data inicial</label>
              <input
                type="date"
                value={importantForm.startDate}
                onChange={(e) => setImportantForm((prev) => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div className="field">
              <label>Data final (opcional)</label>
              <input
                type="date"
                value={importantForm.endDate}
                onChange={(e) => setImportantForm((prev) => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="field">
            <label>Repete</label>
            <select
              value={importantForm.recurrence}
              onChange={(e) => setImportantForm((prev) => ({ ...prev, recurrence: e.target.value }))}
            >
              {RECURRENCE_OPTIONS.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
            </select>
          </div>

          <div className="field">
            <label>Descricao (opcional)</label>
            <textarea
              rows={2}
              value={importantForm.description}
              onChange={(e) => setImportantForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          {editingImportant && (
            <div className="important-modal-actions">
              <button className="btn btn-danger btn-sm" onClick={() => handleDeleteImportantDate(editingImportant.id)}>
                Excluir data
              </button>
              <span>{importantTypeLabel(editingImportant.type)}</span>
            </div>
          )}
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </>
  )
}