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

const EMPTY_FORM = { time: '', day: 'Segunda', name: '', description: '', category: 'projeto' }

const SEED_ITEMS = [
  { time: '5h50–7h30', day: 'Segunda', name: 'Treino', description: 'Musculação ou tênis antes do trabalho', category: 'saude' },
  { time: '7h30–8h15', day: 'Segunda', name: '✦ Hora do Fundador', description: 'Projeto pessoal — mente fresca, sem distrações', category: 'projeto' },
  { time: '9h–17h30', day: 'Segunda', name: 'Trabalho', description: '', category: 'corp' },
  { time: '17h30–18h15', day: 'Segunda', name: 'Planejamento', description: 'Organizar o dia seguinte', category: 'mente' },
  { time: '5h50–7h30', day: 'Terça', name: 'Treino ↑cedo', description: '', category: 'saude' },
  { time: '7h30–8h30', day: 'Terça', name: 'Trem → Trabalho', description: 'Podcast / leitura de produto', category: 'trem' },
  { time: '9h–17h30', day: 'Terça', name: 'Trabalho', description: '', category: 'corp' },
  { time: '17h30–18h30', day: 'Terça', name: 'Trem → Casa', description: 'Descompressão', category: 'trem' },
  { time: '18h30–19h', day: 'Terça', name: 'Projeto 30min', description: '', category: 'projeto' },
]

export default function Cronograma() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [toast, setToast] = useState(null)
  const [activeDay, setActiveDay] = useState('Todos')

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
