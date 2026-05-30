import React, { useState, useEffect } from 'react'
import { listenTodos, addTodo, updateTodo, deleteTodo } from '../services/firestore'
import Modal from '../components/Modal'
import Toast from '../components/Toast'

const PRIORITIES = [
  { value: 'alta', label: 'Alta', color: 'var(--coral)' },
  { value: 'media', label: 'Média', color: 'var(--gold)' },
  { value: 'baixa', label: 'Baixa', color: 'var(--text3)' },
]

const CATEGORIES = ['trabalho', 'projeto', 'pessoal', 'saude', 'familia', 'estudo']

const EMPTY_FORM = { title: '', note: '', priority: 'media', category: 'projeto', dueDate: '' }

export default function Todos() {
  const [todos, setTodos] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [toast, setToast] = useState(null)
  const [filter, setFilter] = useState('pendentes')

  useEffect(() => {
    const unsub = listenTodos(setTodos)
    return unsub
  }, [])

  const filtered = todos.filter(t => {
    if (filter === 'pendentes') return !t.done
    if (filter === 'concluídos') return t.done
    return true
  })

  const toggle = async (todo) => {
    await updateTodo(todo.id, { done: !todo.done })
  }

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const openEdit = (item) => {
    setEditing(item)
    setForm({ title: item.title, note: item.note || '', priority: item.priority || 'media', category: item.category || 'projeto', dueDate: item.dueDate || '' })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) return
    try {
      if (editing) {
        await updateTodo(editing.id, form)
        showToast('Atualizado!')
      } else {
        await addTodo(form)
        showToast('Tarefa adicionada!')
      }
      setShowModal(false)
    } catch {
      showToast('Erro ao salvar.', 'error')
    }
  }

  const handleDelete = async (id) => {
    await deleteTodo(id)
    showToast('Removido.')
  }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const done = todos.filter(t => t.done).length

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <span className="page-kicker">Gestão de Tarefas</span>
          <h1 className="page-title">Tarefas</h1>
          {todos.length > 0 && (
            <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 8 }}>
              {done} de {todos.length} concluídas
            </p>
          )}
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Nova tarefa</button>
      </div>

      <div className="tabs">
        {['pendentes', 'concluídos', 'todos'].map(f => (
          <button key={f} className={`tab-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div>
        {filtered.map(todo => (
          <div key={todo.id} className="todo-item">
            <input
              type="checkbox"
              className="todo-check"
              checked={todo.done}
              onChange={() => toggle(todo)}
            />
            <div>
              <div className={`todo-text ${todo.done ? 'done' : ''}`}>{todo.title}</div>
              {todo.note && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{todo.note}</div>}
              <div className="todo-meta">
                {todo.category && <span className={`pill pill-${todo.category}`}>{todo.category}</span>}
                {todo.priority && (
                  <span style={{ color: PRIORITIES.find(p => p.value === todo.priority)?.color || 'var(--text3)', fontSize: 11 }}>
                    {todo.priority}
                  </span>
                )}
                {todo.dueDate && <span>até {todo.dueDate}</span>}
              </div>
            </div>
            <div className="todo-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => openEdit(todo)}>editar</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(todo.id)}>×</button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">☑</div>
            {filter === 'pendentes' ? 'Nenhuma tarefa pendente.' : 'Nenhuma tarefa aqui.'}
          </div>
        )}
      </div>

      {showModal && (
        <Modal
          title={editing ? 'Editar tarefa' : 'Nova tarefa'}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        >
          <div className="field">
            <label>Título</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="O que precisa ser feito?" />
          </div>
          <div className="field">
            <label>Nota (opcional)</label>
            <textarea rows={2} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Prioridade</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Categoria</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Data limite (opcional)</label>
            <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
          </div>
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  )
}
