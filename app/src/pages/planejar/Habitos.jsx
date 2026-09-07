import React, { useEffect, useMemo, useState } from 'react'
import {
  RiAddLine,
  RiCheckLine,
  RiCloseLine,
  RiDeleteBinLine,
  RiPencilLine,
} from '@remixicon/react'
import { listenHabits, addHabit, updateHabit, deleteHabit, listenHabitLogs } from '../../services/firestore'
import { dateKeyFromDate, getWeekStart, addDays, todayKey } from '../../utils/date'
import { isDailyHabit, computeStreak, computeWeeklyStreak, weekProgress } from '../../utils/streak'
import Toast from '../../components/Toast'
import Modal from '../../components/Modal'

const WEEKDAY_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const MONTH_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const RECENT_DAYS = 60
const FREQUENCY_OPTIONS = [
  { value: 7, label: 'Todos os dias' },
  { value: 5, label: '5x por semana' },
  { value: 4, label: '4x por semana' },
  { value: 3, label: '3x por semana' },
  { value: 2, label: '2x por semana' },
  { value: 1, label: '1x por semana' },
]
const PERIOD_OPTIONS = [
  { value: 14, label: '14 semanas' },
  { value: 13, label: '3 meses' },
  { value: 26, label: '6 meses' },
]

const heatmapLevel = (ratio) => {
  if (ratio <= 0) return 0
  if (ratio < 0.25) return 1
  if (ratio < 0.5) return 2
  if (ratio < 0.75) return 3
  return 4
}

const habitCreatedKey = (habit) => (
  habit.createdAt?.toDate ? dateKeyFromDate(habit.createdAt.toDate()) : null
)

const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

export default function Habitos() {
  const [habits, setHabits] = useState([])
  const [logs, setLogs] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [periodWeeks, setPeriodWeeks] = useState(14)
  const [selectedDayKey, setSelectedDayKey] = useState(null)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newFrequency, setNewFrequency] = useState(7)
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [editingFrequency, setEditingFrequency] = useState(7)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    const u1 = listenHabits(setHabits)
    const u2 = listenHabitLogs(setLogs, 400)
    return () => { u1(); u2() }
  }, [])

  useEffect(() => {
    if (!selectedId && habits.length) setSelectedId(habits[0].id)
  }, [habits, selectedId])

  const logsByDate = useMemo(() => new Map(logs.map(l => [l.date, l.checked || {}])), [logs])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const heatmapDays = useMemo(() => {
    const start = getWeekStart(addDays(new Date(), -(periodWeeks - 1) * 7))
    return Array.from({ length: periodWeeks * 7 }, (_, i) => addDays(start, i))
  }, [periodWeeks])

  const today = todayKey()
  // O heatmap é sobre "o que era esperado no dia" — hábitos com meta semanal
  // (3x/semana etc) não entram nem no numerador nem no denominador, senão um
  // dia sem ir à academia (esperado) contava como intensidade baixa mesmo
  // fazendo tudo que precisava.
  const dailyHabits = useMemo(() => habits.filter(isDailyHabit), [habits])
  const dailyHabitIds = useMemo(() => new Set(dailyHabits.map(h => h.id)), [dailyHabits])
  // Quantos hábitos diários já existiam em CADA dia (não só hoje) — sem
  // isso, criar um hábito novo fazia as 14 semanas inteiras parecerem mais
  // "vazias" retroativamente, e não dava pra distinguir "não tinha hábito
  // ainda" de "tinha hábito e não fez".
  const dailyHabitsMeta = useMemo(
    () => dailyHabits.map(h => ({ id: h.id, createdKey: habitCreatedKey(h) })),
    [dailyHabits],
  )
  const activeCountForDayKey = (dayKey) => dailyHabitsMeta.filter(h => !h.createdKey || h.createdKey <= dayKey).length
  const activeHabitCount = dailyHabitIds.size

  // Uma linha por dia com tudo que a grade e o resumo precisam — calculado
  // uma vez só e reaproveitado (grade, métricas, insight, popover do dia).
  const heatmapInfo = useMemo(() => heatmapDays.map((day) => {
    const key = dateKeyFromDate(day)
    const isFuture = key > today
    const dayActiveCount = activeCountForDayKey(key)
    const hasData = dayActiveCount > 0
    const checked = logsByDate.get(key) || {}
    const doneHabitIds = Object.entries(checked).filter(([id, v]) => v && dailyHabitIds.has(id)).map(([id]) => id)
    const doneCount = doneHabitIds.length
    const ratio = hasData ? doneCount / dayActiveCount : 0
    const level = isFuture ? -1 : (hasData ? heatmapLevel(ratio) : -2)
    return { day, key, isFuture, hasData, dayActiveCount, doneCount, doneHabitIds, ratio, level }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [heatmapDays, logsByDate, dailyHabitIds, dailyHabitsMeta, today])

  const pastDays = useMemo(() => heatmapInfo.filter(d => !d.isFuture && d.hasData), [heatmapInfo])
  const hasEnoughData = dailyHabits.length > 0 && pastDays.length >= 5

  const consistencyPct = useMemo(() => {
    const possible = pastDays.reduce((sum, d) => sum + d.dayActiveCount, 0)
    const done = pastDays.reduce((sum, d) => sum + d.doneCount, 0)
    return possible > 0 ? Math.round((done / possible) * 100) : 0
  }, [pastDays])

  const activeDaysCount = useMemo(() => pastDays.filter(d => d.doneCount > 0).length, [pastDays])

  // Sequência atual = dias seguidos (contando de hoje pra trás) com pelo
  // menos 1 hábito diário concluído — o dia de hoje ainda em andamento não
  // quebra a sequência, igual ao streak por hábito.
  const currentStreakDays = useMemo(() => {
    let streak = 0
    for (let i = pastDays.length - 1; i >= 0; i--) {
      if (pastDays[i].doneCount > 0) streak += 1
      else break
    }
    return streak
  }, [pastDays])

  const bestWeekPct = useMemo(() => {
    let best = 0
    for (let w = 0; w < periodWeeks; w++) {
      const slice = heatmapInfo.slice(w * 7, w * 7 + 7).filter(d => !d.isFuture && d.hasData)
      if (!slice.length) continue
      const possible = slice.reduce((sum, d) => sum + d.dayActiveCount, 0)
      const done = slice.reduce((sum, d) => sum + d.doneCount, 0)
      if (possible > 0) best = Math.max(best, done / possible)
    }
    return Math.round(best * 100)
  }, [heatmapInfo, periodWeeks])

  // Compara a última semana com a anterior — só fala algo quando há dado
  // suficiente pra isso fazer sentido, nunca inventa tendência com amostra
  // pequena.
  const insightMessage = useMemo(() => {
    if (pastDays.length < 14) return null
    const avg = (arr) => {
      const possible = arr.reduce((sum, d) => sum + d.dayActiveCount, 0)
      if (!possible) return null
      return arr.reduce((sum, d) => sum + d.doneCount, 0) / possible
    }
    const last7 = avg(pastDays.slice(-7))
    const prior7 = avg(pastDays.slice(-14, -7))
    if (last7 === null || prior7 === null) return null
    const diff = last7 - prior7
    if (diff >= 0.15) return 'Boa retomada — seu ritmo subiu nos últimos 7 dias.'
    if (diff <= -0.15) return 'Seu ritmo caiu nos últimos 7 dias em relação à semana anterior.'
    if (last7 >= 0.7) return 'Você está mantendo um ritmo forte.'
    return null
  }, [pastDays])

  const monthLabelCells = useMemo(() => {
    let lastMonth = null
    const cells = []
    heatmapDays.forEach((day, i) => {
      if (i % 7 !== 0) return
      const month = day.getMonth()
      if (month !== lastMonth) {
        cells.push({ col: i / 7, label: MONTH_ABBR[month] })
        lastMonth = month
      }
    })
    return cells
  }, [heatmapDays])

  const selectedDayInfo = selectedDayKey ? heatmapInfo.find(d => d.key === selectedDayKey) : null
  const selectedDayHabitNames = selectedDayInfo
    ? habits.filter(h => selectedDayInfo.doneHabitIds.includes(h.id)).map(h => h.name)
    : []

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) { setAdding(false); return }
    await addHabit({ name, weeklyTarget: newFrequency })
    setNewName('')
    setNewFrequency(7)
    setAdding(false)
    showToast('Hábito criado!')
  }

  const startRename = (habit) => {
    setEditingId(habit.id)
    setEditingName(habit.name)
    setEditingFrequency(habit.weeklyTarget || 7)
  }

  const saveRename = async () => {
    const name = editingName.trim()
    if (name) await updateHabit(editingId, { name, weeklyTarget: editingFrequency })
    setEditingId(null)
  }

  const confirmDeleteHabit = async () => {
    const habit = confirmDelete
    if (!habit) return
    await deleteHabit(habit.id)
    if (selectedId === habit.id) setSelectedId(null)
    setConfirmDelete(null)
    showToast('Hábito removido.')
  }

  const selectedHabit = habits.find(h => h.id === selectedId)
  const recentDays = useMemo(
    () => Array.from({ length: RECENT_DAYS }, (_, i) => addDays(new Date(), i - (RECENT_DAYS - 1))),
    [],
  )

  return (
    <>
      <div className="habitos-section habit-consistency-card">
        {dailyHabits.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            Comece marcando um hábito diário hoje pra construir seu histórico aqui.
          </div>
        ) : (
          <>
            <div className="habit-consistency-header">
              <div>
                <h2 className="hoje-section-title">Seu ritmo nas últimas {PERIOD_OPTIONS.find(p => p.value === periodWeeks)?.label}</h2>
                {hasEnoughData ? (
                  <>
                    <div className="habit-consistency-primary">
                      {consistencyPct}% <span>de consistência</span>
                    </div>
                    <div className="habit-consistency-stats">
                      {activeDaysCount} dias ativos · sequência atual {currentStreakDays} dia{currentStreakDays === 1 ? '' : 's'} · melhor semana {bestWeekPct}%
                    </div>
                  </>
                ) : (
                  <p className="habit-heatmap-explainer">
                    Você tem {pastDays.length} dia{pastDays.length === 1 ? '' : 's'} registrado{pastDays.length === 1 ? '' : 's'}. O gráfico fica mais útil conforme seu histórico cresce.
                  </p>
                )}
              </div>
              <select
                className="calendar-select"
                value={periodWeeks}
                onChange={e => { setPeriodWeeks(Number(e.target.value)); setSelectedDayKey(null) }}
                aria-label="Período"
              >
                {PERIOD_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>

            <div className="habit-heatmap-center">
              <div className="habit-heatmap-row habit-heatmap-months">
                <span className="habit-heatmap-weekdays" aria-hidden="true" style={{ visibility: 'hidden', height: 12, overflow: 'hidden' }}>D</span>
                <div className="habit-heatmap-months-grid" style={{ gridTemplateColumns: `repeat(${periodWeeks}, 12px)` }}>
                  {monthLabelCells.map(({ col, label }) => (
                    <span key={col} style={{ gridColumnStart: col + 1 }}>{label}</span>
                  ))}
                </div>
              </div>

              <div className="habit-heatmap-row habit-heatmap-wrap">
                <div className="habit-heatmap-weekdays">
                  {WEEKDAY_SHORT.map((d, i) => <span key={i}>{d}</span>)}
                </div>
                <div className="habit-heatmap-grid">
                  {heatmapInfo.map((info, i) => {
                    const { day, key, isFuture, hasData, dayActiveCount, doneCount, level } = info
                    const stateClass = level >= 0 ? `level-${level}` : (level === -2 ? 'is-nodata' : 'is-future')
                    const label = isFuture
                      ? ''
                      : hasData
                        ? `${day.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })} — ${doneCount} de ${dayActiveCount} hábitos concluídos`
                        : `${day.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })} — sem hábitos cadastrados`
                    return (
                      <button
                        type="button"
                        key={key}
                        className={`habit-heatmap-cell wave-in ${stateClass} ${selectedDayKey === key ? 'is-selected' : ''}`}
                        style={{ animationDelay: `${Math.floor(i / 7) * 40 + (i % 7) * 8}ms` }}
                        title={label}
                        aria-label={label}
                        disabled={isFuture || !hasData}
                        onClick={() => setSelectedDayKey(prev => (prev === key ? null : key))}
                      />
                    )
                  })}
                </div>
              </div>

              <div className="habit-heatmap-legend">
                <span>menos concluído</span>
                <span className="habit-heatmap-cell level-0" />
                <span className="habit-heatmap-cell level-1" />
                <span className="habit-heatmap-cell level-2" />
                <span className="habit-heatmap-cell level-3" />
                <span className="habit-heatmap-cell level-4" />
                <span>mais concluído</span>
              </div>
            </div>

            {selectedDayInfo && (
              <div className="habit-heatmap-detail">
                <strong>{capFirst(selectedDayInfo.day.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }))}</strong>
                <span>{selectedDayInfo.doneCount} de {selectedDayInfo.dayActiveCount} hábitos concluídos</span>
                {selectedDayHabitNames.length > 0 && (
                  <ul>
                    {selectedDayHabitNames.map(name => <li key={name}>{name}</li>)}
                  </ul>
                )}
              </div>
            )}

            {insightMessage && <p className="habit-heatmap-insight">{insightMessage}</p>}
          </>
        )}
      </div>

      <div className="habitos-section">
        <div className="hoje-section-head">
          <h2 className="hoje-section-title">Seus hábitos</h2>
        </div>
        <div className="habit-manage-list">
          {habits.map(habit => {
            const daily = isDailyHabit(habit)
            const streak = daily ? computeStreak(habit.id, logsByDate, today) : computeWeeklyStreak(habit.id, logsByDate, today, habit.weeklyTarget)
            const record = daily ? Math.max(habit.bestStreak || 0, streak) : Math.max(habit.bestWeeklyStreak || 0, streak)
            const weekDone = daily ? null : weekProgress(habit.id, logsByDate, today)

            return (
              <div key={habit.id} className={`habit-manage-row ${selectedId === habit.id ? 'active' : ''}`}>
                {editingId === habit.id ? (
                  <>
                    <input
                      className="inline-edit-input"
                      autoFocus
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveRename()}
                    />
                    <select
                      className="calendar-select"
                      value={editingFrequency}
                      onChange={e => setEditingFrequency(Number(e.target.value))}
                      aria-label="Frequência"
                    >
                      {FREQUENCY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                    <button className="btn btn-primary btn-sm btn-icon" onClick={saveRename} aria-label="Salvar"><RiCheckLine size={13} /></button>
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setEditingId(null)} aria-label="Cancelar"><RiCloseLine size={13} /></button>
                  </>
                ) : (
                  <>
                    <button type="button" className="habit-manage-name" onClick={() => setSelectedId(habit.id)}>
                      {habit.name}
                    </button>
                    {!daily && (
                      <span className={`habit-week-progress ${weekDone >= habit.weeklyTarget ? 'is-met' : ''}`}>
                        {weekDone}/{habit.weeklyTarget} semana
                      </span>
                    )}
                    <span className="subpage-controls-note" style={{ marginRight: 0 }}>
                      recorde: {record} {daily ? 'dias' : 'semanas'}
                    </span>
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => startRename(habit)} aria-label="Renomear"><RiPencilLine size={13} /></button>
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => setConfirmDelete(habit)} aria-label="Excluir"><RiDeleteBinLine size={13} /></button>
                  </>
                )}
              </div>
            )
          })}

          {habits.length === 0 && !adding && (
            <div className="empty-state" style={{ padding: '20px 0' }}>Nenhum hábito cadastrado ainda.</div>
          )}

          {adding ? (
            <div className="habit-add-row">
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="Nome do hábito"
              />
              <select
                className="calendar-select"
                value={newFrequency}
                onChange={e => setNewFrequency(Number(e.target.value))}
                aria-label="Frequência"
              >
                {FREQUENCY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
              <button className="btn btn-primary btn-sm btn-icon" onClick={handleAdd} aria-label="Salvar"><RiCheckLine size={14} /></button>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setAdding(false); setNewName(''); setNewFrequency(7) }} aria-label="Cancelar"><RiCloseLine size={14} /></button>
            </div>
          ) : (
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => setAdding(true)}>
              <RiAddLine size={14} /> Adicionar hábito
            </button>
          )}
        </div>
      </div>

      {selectedHabit && (
        <div className="habitos-section">
          <div className="hoje-section-head">
            <h2 className="hoje-section-title">{selectedHabit.name}</h2>
            <span className="subpage-controls-note" style={{ marginRight: 0 }}>últimos {RECENT_DAYS} dias</span>
          </div>
          <div className="habit-recent-strip">
            {recentDays.map(day => {
              const key = dateKeyFromDate(day)
              const checked = !!logsByDate.get(key)?.[selectedHabit.id]
              return (
                <span
                  key={key}
                  className={`habit-dot ${checked ? 'filled' : ''}`}
                  title={`${day.toLocaleDateString('pt-BR')}${checked ? ' — feito' : ''}`}
                />
              )
            })}
          </div>
        </div>
      )}

      {confirmDelete && (
        <Modal
          title="Excluir hábito"
          onClose={() => setConfirmDelete(null)}
          onSave={confirmDeleteHabit}
          saveLabel="Excluir"
        >
          <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
            Excluir o hábito <strong>"{confirmDelete.name}"</strong>?
            O histórico de marcações não é apagado, mas deixa de aparecer.
          </p>
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </>
  )
}
