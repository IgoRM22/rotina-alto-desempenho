import React, { useState, useEffect } from 'react'
import {
  listenSchedule,
  addScheduleItem,
  updateScheduleItem,
  deleteScheduleItem,
} from '../services/firestore'
import Modal from '../components/Modal'
import Toast from '../components/Toast'

const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
const DAYS_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const CATEGORIES = [
  { value: 'saude', label: 'Saúde / Treino' },
  { value: 'corp', label: 'Trabalho' },
  { value: 'projeto', label: 'Projeto / Fundador' },
  { value: 'mente', label: 'Mente / Planejamento' },
  { value: 'estudo', label: 'Estudo / Leitura' },
  { value: 'familia', label: 'Família' },
  { value: 'trem', label: 'Deslocamento' },
  { value: 'pessoal', label: 'Pessoal' },
]

const REPEAT_OPTIONS = [
  { value: '', label: 'Dia específico' },
  { value: 'daily', label: 'Todos os dias' },
  { value: 'weekdays', label: 'Dias úteis (Seg–Sex)' },
  { value: 'weekend', label: 'Fim de semana' },
  { value: 'custom', label: 'Personalizado...' },
]

const EMPTY_FORM = {
  timeStart: '', timeEnd: '', day: 'Segunda',
  name: '', description: '', category: 'projeto',
  repeat: '', repeatDays: [],
}

// Parse "HH:MM" → minutes
const toMin = (t) => {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
// Format minute gap → "1h 30min"
const fmtDuration = (min) => {
  if (min <= 0) return ''
  const h = Math.floor(min / 60), m = min % 60
  if (h > 0 && m > 0) return `${h}h ${m}min`
  return h > 0 ? `${h}h` : `${m}min`
}
// Days an item should appear
const getItemDays = (item) => {
  if (!item.repeat) return [item.day]
  if (item.repeat === 'daily') return DAYS
  if (item.repeat === 'weekdays') return ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']
  if (item.repeat === 'weekend') return ['Sábado', 'Domingo']
  if (item.repeat === 'custom' && item.repeatDays?.length) return item.repeatDays
  return [item.day]
}
// Display time string (supports both new timeStart/timeEnd and old text `time`)
const fmtTime = (item) => {
  if (item.timeStart) return item.timeEnd ? `${item.timeStart}–${item.timeEnd}` : item.timeStart
  return item.time || ''
}
// Sort key
const sortKey = (item) => toMin(item.timeStart)
// Insert gap entries between consecutive items
const withGaps = (dayItems) => {
  const result = []
  for (let i = 0; i < dayItems.length; i++) {
    result.push({ type: 'item', data: dayItems[i] })
    if (i < dayItems.length - 1 && dayItems[i].timeEnd && dayItems[i + 1].timeStart) {
      const gap = toMin(dayItems[i + 1].timeStart) - toMin(dayItems[i].timeEnd)
      if (gap >= 30) result.push({ type: 'gap', start: dayItems[i].timeEnd, end: dayItems[i + 1].timeStart, duration: gap })
    }
  }
  return result
}

export default function Cronograma() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [toast, setToast] = useState(null)
  const [activeDay, setActiveDay] = useState('Todos')
  const [view, setView] = useState('lista')

  useEffect(() => {
    const unsub = listenSchedule((data) => {
      setItems(data)
      setLoading(false)
    })
    return unsub
  }, [])

  const grouped = DAYS.reduce((acc, day) => {
    acc[day] = items.filter(i => getItemDays(i).includes(day)).sort((a, b) => sortKey(a) - sortKey(b))
    return acc
  }, {})

  const visibleDays = activeDay === 'Todos'
    ? DAYS.filter(d => grouped[d]?.length > 0)
    : (grouped[activeDay]?.length > 0 ? [activeDay] : [])

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

  const handleSave = async () => {
    if (!form.name.trim()) return
    try {
      const data = { ...form }
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

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const renderItem = (item) => (
    <div key={item.id} className="schedule-item">
      <div className="schedule-time">{fmtTime(item)}</div>
      <div className={`schedule-bar bar-${item.category || 'default'}`} />
      <div className="schedule-body">
        <div className="schedule-name">{item.name}</div>
        {item.description && <div className="schedule-desc">{item.description}</div>}
        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className={`pill pill-${item.category || 'pessoal'}`}>
            {CATEGORIES.find(c => c.value === item.category)?.label || item.category}
          </span>
          {item.repeat ? (
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>
              ↻ {REPEAT_OPTIONS.find(r => r.value === item.repeat)?.label || ''}
            </span>
          ) : null}
        </div>
      </div>
      <div className="schedule-actions">
        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(item)}>editar</button>
        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(item.id)}>×</button>
      </div>
    </div>
  )

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <span className="page-kicker">Planejamento Semanal</span>
          <h1 className="page-title">Cronograma</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="view-toggle">
            <button className={`view-btn ${view === 'lista' ? 'active' : ''}`} onClick={() => setView('lista')}>Lista</button>
            <button className={`view-btn ${view === 'semanal' ? 'active' : ''}`} onClick={() => setView('semanal')}>Semanal</button>
          </div>
          <button className="btn btn-primary" onClick={openAdd}>+ Adicionar</button>
        </div>
      </div>

      {view === 'lista' && (
        <>
          <div className="tabs-scroll">
            {['Todos', ...DAYS].map(day => (
              <button
                key={day}
                className={`tab-btn ${activeDay === day ? 'active' : ''}`}
                onClick={() => setActiveDay(day)}
              >
                {day}
              </button>
            ))}
          </div>
          {visibleDays.map(day => (
            <div key={day} className="schedule-group">
              <div className="schedule-day-label">{day}</div>
              {withGaps(grouped[day] || []).map((entry, idx) =>
                entry.type === 'gap' ? (
                  <div key={`gap-${idx}`} className="schedule-gap">
                    <span className="gap-label">◌ Livre — {fmtDuration(entry.duration)}</span>
                    <span className="gap-time">{entry.start} → {entry.end}</span>
                  </div>
                ) : renderItem(entry.data)
              )}
            </div>
          ))}
          {visibleDays.length === 0 && !loading && (
            <div className="empty-state">
              <div className="empty-state-icon">⊞</div>
              Nenhum item para este dia.
            </div>
          )}
        </>
      )}

      {view === 'semanal' && (
        <div className="calendar-week">
          {DAYS.map((day, di) => (
            <div key={day} className="calendar-col">
              <div className="calendar-col-header">{DAYS_SHORT[di]}</div>
              <div className="calendar-col-body">
                {(grouped[day] || []).length === 0 ? (
                  <div className="calendar-empty">—</div>
                ) : (
                  withGaps(grouped[day] || []).map((entry, idx) =>
                    entry.type === 'gap' ? (
                      <div key={`gap-${idx}`} className="cal-gap-block">
                        ◌ {fmtDuration(entry.duration)}
                      </div>
                    ) : (
                      <div
                        key={entry.data.id}
                        className={`cal-item cal-cat-${entry.data.category || 'default'}`}
                        onClick={() => openEdit(entry.data)}
                      >
                        <div className="cal-item-time">{fmtTime(entry.data)}</div>
                        <div className="cal-item-name">{entry.data.name}</div>
                      </div>
                    )
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal
          title={editing ? 'Editar item' : 'Novo item'}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        >
          <div className="field">
            <label>Nome</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Hora do Fundador" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Início</label>
              <input type="time" value={form.timeStart} onChange={e => setForm(f => ({ ...f, timeStart: e.target.value }))} />
            </div>
            <div className="field">
              <label>Fim</label>
              <input type="time" value={form.timeEnd} onChange={e => setForm(f => ({ ...f, timeEnd: e.target.value }))} />
            </div>
          </div>
          <div className="field">
            <label>Repetição</label>
            <select value={form.repeat} onChange={e => setForm(f => ({ ...f, repeat: e.target.value }))}>
              {REPEAT_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          {(!form.repeat || form.repeat === '') && (
            <div className="field">
              <label>Dia</label>
              <select value={form.day} onChange={e => setForm(f => ({ ...f, day: e.target.value }))}>
                {DAYS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
          )}
          {form.repeat === 'custom' && (
            <div className="field">
              <label>Dias específicos</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {DAYS.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    className={`day-toggle ${form.repeatDays.includes(d) ? 'active' : ''}`}
                    onClick={() => setForm(f => ({
                      ...f,
                      repeatDays: f.repeatDays.includes(d)
                        ? f.repeatDays.filter(x => x !== d)
                        : [...f.repeatDays, d]
                    }))}
                  >
                    {DAYS_SHORT[i]}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="field">
            <label>Categoria</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Descrição (opcional)</label>
            <textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  )
}

  useEffect(() => {
    const unsub = listenSchedule((data) => {
      if (data.length === 0 && loading) {
        Promise.all(SEED_ITEMS.map(i => addScheduleItem(i)))
      } else {
        setItems(data)
        setLoading(false)
      }
    })
    return unsub
  }, [])

  const grouped = DAYS.reduce((acc, day) => {
    const dayItems = items.filter(i => i.day === day)
    if (dayItems.length > 0) acc[day] = dayItems
    return acc
  }, {})

  const visibleDays = activeDay === 'Todos' ? Object.keys(grouped) : (grouped[activeDay] ? [activeDay] : [])

  const openAdd = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM, day: activeDay !== 'Todos' ? activeDay : 'Segunda' })
    setShowModal(true)
  }

  const openEdit = (item) => {
    setEditing(item)
    setForm({ time: item.time, day: item.day, name: item.name, description: item.description || '', category: item.category || 'projeto' })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    try {
      if (editing) {
        await updateScheduleItem(editing.id, form)
        showToast('Atualizado!')
      } else {
        await addScheduleItem(form)
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

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <span className="page-kicker">Planejamento Semanal</span>
          <h1 className="page-title">Cronograma</h1>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Adicionar</button>
      </div>

      {/* Day filter tabs */}
      <div className="tabs" style={{ overflowX: 'auto' }}>
        {['Todos', ...DAYS].map(day => (
          <button
            key={day}
            className={`tab-btn ${activeDay === day ? 'active' : ''}`}
            onClick={() => setActiveDay(day)}
          >
            {day}
          </button>
        ))}
      </div>

      {visibleDays.map(day => (
        <div key={day} className="schedule-group">
          <div className="schedule-day-label">{day}</div>
          {grouped[day].map(item => (
            <div key={item.id} className="schedule-item">
              <div className="schedule-time">{item.time}</div>
              <div className={`schedule-bar bar-${item.category || 'default'}`} />
              <div className="schedule-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span className={`pill pill-${item.category || 'pessoal'}`}>{CATEGORIES.find(c => c.value === item.category)?.label || item.category}</span>
                </div>
                <div className="schedule-name">{item.name}</div>
                {item.description && <div className="schedule-desc">{item.description}</div>}
              </div>
              <div className="schedule-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(item)}>editar</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(item.id)}>×</button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {visibleDays.length === 0 && !loading && (
        <div className="empty-state">
          <div className="empty-state-icon">⊞</div>
          Nenhum item no cronograma para este dia.
        </div>
      )}

      {showModal && (
        <Modal
          title={editing ? 'Editar item' : 'Novo item'}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        >
          <div className="field">
            <label>Dia</label>
            <select value={form.day} onChange={e => setForm(f => ({ ...f, day: e.target.value }))}>
              {DAYS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Horário</label>
            <input value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} placeholder="Ex: 7h30–8h15" />
          </div>
          <div className="field">
            <label>Categoria</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Nome</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Hora do Fundador" />
          </div>
          <div className="field">
            <label>Descrição (opcional)</label>
            <textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  )
}
