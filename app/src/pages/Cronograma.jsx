import React, { useEffect, useMemo, useState } from 'react'
import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiCalendar2Line,
  RiCalendarScheduleLine,
  RiDeleteBinLine,
  RiFileCopyLine,
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
} from '../services/firestore'
import Modal from '../components/Modal'
import Toast from '../components/Toast'

const DAYS = ['Segunda', 'Ter\u00E7a', 'Quarta', 'Quinta', 'Sexta', 'S\u00E1bado', 'Domingo']
const DAYS_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'S\u00E1b', 'Dom']
const MONTH_LABELS = Array.from(
  { length: 12 },
  (_, month) => new Date(2024, month, 1).toLocaleDateString('pt-BR', { month: 'long' }),
)

const CATEGORIES = [
  { value: 'saude', label: 'Sa\u00FAde / Treino' },
  { value: 'corp', label: 'Trabalho' },
  { value: 'projeto', label: 'Projeto / Fundador' },
  { value: 'mente', label: 'Mente / Planejamento' },
  { value: 'estudo', label: 'Estudo / Leitura' },
  { value: 'familia', label: 'Familia' },
  { value: 'trem', label: 'Deslocamento' },
  { value: 'pessoal', label: 'Pessoal' },
]

const REPEAT_OPTIONS = [
  { value: '', label: 'Dia especifico' },
  { value: 'daily', label: 'Todos os dias' },
  { value: 'weekdays', label: 'Dias uteis (Seg-Sex)' },
  { value: 'weekend', label: 'Fim de semana' },
  { value: 'custom', label: 'Personalizado...' },
]

const IMPORTANT_TYPES = [
  { value: 'feriado', label: 'Feriado' },
  { value: 'aniversario', label: 'Aniversario' },
  { value: 'ferias', label: 'Ferias' },
  { value: 'importante', label: 'Data importante' },
]

const EMPTY_FORM = {
  timeStart: '',
  timeEnd: '',
  day: 'Segunda',
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
}

const DEFAULT_EVENT_MINUTES = 45
const MIN_EVENT_MINUTES = 20
const BAR_EVENT_PX_PER_MINUTE = 0.42
const BAR_GAP_PX_PER_MINUTE = 0.28
const BAR_MIN_EVENT_HEIGHT = 36
const BAR_MIN_CLUSTER_HEIGHT = 42

const pad2 = (v) => String(v).padStart(2, '0')

const toDateKey = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`

const fromDateKey = (dateKey) => {
  if (!dateKey) return null
  const [y, m, d] = dateKey.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

const addDaysToDateKey = (dateKey, days) => {
  const parsed = fromDateKey(dateKey)
  if (!parsed) return dateKey
  parsed.setDate(parsed.getDate() + days)
  return toDateKey(parsed)
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

const getItemDays = (item) => {
  if (!item.repeat) return [item.day]
  if (item.repeat === 'daily') return DAYS
  if (item.repeat === 'weekdays') return ['Segunda', 'Ter\u00E7a', 'Quarta', 'Quinta', 'Sexta']
  if (item.repeat === 'weekend') return ['S\u00E1bado', 'Domingo']
  if (item.repeat === 'custom' && item.repeatDays?.length) return item.repeatDays
  return [item.day]
}

const fmtTime = (item) => {
  if (item.timeStart) return item.timeEnd ? `${item.timeStart}-${item.timeEnd}` : item.timeStart
  return item.time || ''
}

const sortKey = (item) => toMin(item.timeStart || item.time)

const normalizeEventRange = (item) => {
  const startMin = Math.max(0, toMin(item.timeStart || item.time || '00:00'))
  let endMin = toMin(item.timeEnd)

  if (!item.timeEnd || endMin <= startMin) endMin = startMin + DEFAULT_EVENT_MINUTES
  endMin = Math.min(24 * 60, Math.max(startMin + MIN_EVENT_MINUTES, endMin))

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

const shiftPlanDate = (baseDate, step) => {
  const next = new Date(baseDate)
  next.setDate(next.getDate() + (step * 7))
  return next
}

const buildMonthCells = (year, month) => {
  const first = new Date(year, month, 1)
  const startOffset = (first.getDay() + 6) % 7
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
  let groupEnd = events[0].endMin

  for (let i = 1; i < events.length; i++) {
    const current = events[i]
    if (current.startMin < groupEnd) {
      group.push(current)
      groupEnd = Math.max(groupEnd, current.endMin)
      continue
    }
    clusters.push(toCluster(group))
    group = [current]
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

const insertNowMarker = (day, flow, todayDay, nowMin, nowLabel) => {
  if (day !== todayDay) return flow

  const marker = { type: 'now', minute: nowMin, label: nowLabel }
  const index = flow.findIndex((entry) => {
    if (entry.type === 'gap') return nowMin <= entry.end
    return nowMin <= entry.endMin
  })

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
  const [calendarCursor, setCalendarCursor] = useState(() => {
    const current = new Date()
    return new Date(current.getFullYear(), current.getMonth(), 1)
  })

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
  const todayDay = DAYS[(now.getDay() + 6) % 7]

  const planMeta = useMemo(() => getIsoWeekMeta(planDate), [planDate])
  const isCurrentWeek = useMemo(() => planMeta.key === getIsoWeekMeta(new Date()).key, [planMeta.key])
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
      if (item.planKey) return item.planKey === planMeta.key
      return planMeta.key === legacyWeekKey
    })
  }, [items, planMeta.key, legacyWeekKey])

  const grouped = useMemo(() => {
    return DAYS.reduce((acc, day) => {
      acc[day] = scopedItems
        .filter((item) => getItemDays(item).includes(day))
        .sort((a, b) => sortKey(a) - sortKey(b))
      return acc
    }, {})
  }, [scopedItems])

  const dayFlows = useMemo(() => {
    return DAYS.reduce((acc, day) => {
      const flow = buildDayFlow(grouped[day] || [])
      acc[day] = isCurrentWeek
        ? insertNowMarker(day, flow, todayDay, nowMin, nowLabel)
        : flow
      return acc
    }, {})
  }, [grouped, todayDay, nowMin, nowLabel, isCurrentWeek])

  const visibleDays = activeDay === 'Todos'
    ? DAYS.filter((day) => grouped[day]?.length > 0 || day === todayDay)
    : (grouped[activeDay]?.length > 0 || activeDay === todayDay ? [activeDay] : [])

  const monthCells = useMemo(() => buildMonthCells(calendarYear, calendarMonth), [calendarYear, calendarMonth])

  const importantByDay = useMemo(() => {
    const byDay = {}
    monthCells.forEach((cell) => {
      byDay[cell.key] = []
    })

    importantDates.forEach((item) => {
      if (!item.startDate) return
      const safeEnd = item.endDate && item.endDate >= item.startDate ? item.endDate : item.startDate
      let current = item.startDate
      let guard = 0

      while (current <= safeEnd && guard < 800) {
        if (byDay[current]) byDay[current].push(item)
        current = addDaysToDateKey(current, 1)
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

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const openAdd = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM, day: activeDay !== 'Todos' ? activeDay : 'Segunda' })
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

  const movePlan = (dir) => setPlanDate((prev) => shiftPlanDate(prev, dir))
  const resetPlanToCurrent = () => setPlanDate(new Date())

  const handleCloneWeek = async () => {
    if (scopedItems.length === 0) {
      showToast('Nao ha itens para clonar nesta semana.', 'error')
      return
    }

    const targetDate = shiftPlanDate(planDate, 1)
    const targetMeta = getIsoWeekMeta(targetDate)
    const existingOnTarget = items.filter((item) => item.planKey === targetMeta.key).length

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

  const moveCalendarMonth = (step) => {
    setCalendarCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + step, 1))
  }

  const resetCalendarToCurrent = () => {
    const current = new Date()
    setCalendarCursor(new Date(current.getFullYear(), current.getMonth(), 1))
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
    return (
      <div key={key} className={`schedule-item ${options.compact ? 'is-compact' : ''}`}>
        <div className="schedule-time">{fmtTime(item)}</div>
        <div className={`schedule-bar bar-${item.category || 'default'}`} />
        <div className="schedule-body">
          <div className="schedule-name">{item.name}</div>
          {item.description && <div className="schedule-desc">{item.description}</div>}
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className={`pill pill-${item.category || 'pessoal'}`}>
              {categories.find((category) => category.value === item.category)?.label || item.category}
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
    <div className="page">
      <div className="page-header schedule-page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <span className="page-kicker">Planejamento de Rotina</span>
          <h1 className="page-title">Cronograma</h1>
        </div>

        <div className="schedule-header-tools">
          <div className="schedule-plan-toolbar">
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
              <button className="btn btn-ghost btn-sm" onClick={resetPlanToCurrent}>Hoje</button>
              <button className="btn btn-ghost btn-sm plan-nav-clone" onClick={handleCloneWeek}>
                <RiFileCopyLine size={14} aria-hidden="true" />
                <span className="plan-clone-text">Clonar +1 semana</span>
              </button>
            </div>
          </div>

          <div className="schedule-view-actions">
            <div className="view-toggle">
              <button className={`view-btn ${view === 'lista' ? 'active' : ''}`} onClick={() => setView('lista')}>Lista</button>
              <button className={`view-btn ${view === 'semanal' ? 'active' : ''}`} onClick={() => setView('semanal')}>Semanal</button>
              <button className={`view-btn ${view === 'calendario' ? 'active' : ''}`} onClick={() => setView('calendario')}>Calendario</button>
            </div>
            <button className="btn btn-primary" onClick={view === 'calendario' ? openAddImportantForVisibleMonth : openAdd}>
              {view === 'calendario' ? '+ Data importante' : '+ Adicionar'}
            </button>
          </div>
        </div>
      </div>

      {view === 'lista' && (
        <>
          <div className="tabs-scroll">
            {['Todos', ...DAYS].map((day) => (
              <button
                key={day}
                className={`tab-btn ${activeDay === day ? 'active' : ''}`}
                onClick={() => setActiveDay(day)}
              >
                {day}
              </button>
            ))}
          </div>

          {visibleDays.map((day) => {
            const segments = dayFlows[day] || []
            return (
              <div key={day} className="schedule-group">
                <div className="schedule-day-label">{day}</div>
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
            const isToday = day === todayDay

            return (
              <section key={day} className={`calendar-bars-day ${isToday ? 'is-today' : ''}`} role="row">
                <div className="calendar-bars-header" role="columnheader" aria-label={day}>
                  <span className="calendar-bars-short">{DAYS_SHORT[dayIndex]}</span>
                  <span className="calendar-bars-name">{day}</span>
                </div>

                <div className="calendar-bars-track">
                  {segments.length === 0 && (
                    <div className="calendar-empty-day">
                      <RiSubtractLine size={16} aria-hidden="true" />
                      <span>Sem tarefas</span>
                    </div>
                  )}

                  {segments.map((segment, idx) => {
                    if (segment.type === 'now') {
                      return (
                        <div key={`bar-now-${day}-${idx}`} className="calendar-bars-now" aria-label={`Agora ${segment.label}`}>
                          <span className="calendar-bars-now-pill">Agora {segment.label}</span>
                          <span className="calendar-bars-now-line" />
                        </div>
                      )
                    }

                    if (segment.type === 'gap') {
                      const gapHeight = Math.max(8, segment.duration * BAR_GAP_PX_PER_MINUTE)
                      return (
                        <div key={`bar-gap-${day}-${idx}`} className="calendar-bars-gap" style={{ height: `${gapHeight}px` }}>
                          {segment.duration >= 45 && <span>{fmtDuration(segment.duration)}</span>}
                        </div>
                      )
                    }

                    const eventVisuals = segment.events.map((event) => {
                      const top = (event.startMin - segment.startMin) * BAR_EVENT_PX_PER_MINUTE
                      const height = Math.max(BAR_MIN_EVENT_HEIGHT, (event.endMin - event.startMin) * BAR_EVENT_PX_PER_MINUTE)
                      return { ...event, top, height }
                    })

                    const clusterHeight = Math.max(
                      BAR_MIN_CLUSTER_HEIGHT,
                      segment.duration * BAR_EVENT_PX_PER_MINUTE,
                      ...eventVisuals.map((event) => event.top + event.height),
                    )

                    return (
                      <div
                        key={`bar-cluster-${day}-${idx}`}
                        className={`calendar-bars-cluster ${segment.laneCount > 1 ? 'is-overlap' : ''}`}
                        style={{ height: `${clusterHeight}px` }}
                      >
                        {eventVisuals.map((event) => {
                          const laneWidth = 100 / segment.laneCount
                          const left = event.lane * laneWidth
                          return (
                            <button
                              key={`${event.item.id}-${event.lane}`}
                              type="button"
                              className={`calendar-bar-item cal-cat-${event.item.category || 'default'}`}
                              style={{
                                top: `${event.top}px`,
                                height: `${event.height}px`,
                                left: `calc(${left}% + 2px)`,
                                width: `calc(${laneWidth}% - 4px)`,
                              }}
                              title={`${fmtTime(event.item)} - ${event.item.name}`}
                              onClick={() => openEdit(event.item)}
                            >
                              <div className="calendar-bar-time">{fmtTime(event.item)}</div>
                              <div className="calendar-bar-name">{event.item.name}</div>
                            </button>
                          )
                        })}
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
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => moveCalendarMonth(-1)} aria-label="Mes anterior">
              <RiArrowLeftSLine size={16} aria-hidden="true" />
            </button>
            <div className="schedule-plan-label">
              <RiCalendar2Line size={13} aria-hidden="true" />
              {calendarLabel}
            </div>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => moveCalendarMonth(1)} aria-label="Proximo mes">
              <RiArrowRightSLine size={16} aria-hidden="true" />
            </button>

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

            <button className="btn btn-ghost btn-sm" onClick={resetCalendarToCurrent}>Hoje</button>
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
                        {entry.title}
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
              {categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
            </select>
          </div>

          <div className="field">
            <label>Descricao (opcional)</label>
            <textarea rows={2} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
          </div>
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
    </div>
  )
}