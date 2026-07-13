import React, { useState, useEffect } from 'react'
import {
  RiAddLine,
  RiCheckboxBlankLine,
  RiDeleteBinLine,
  RiInboxLine,
  RiPencilLine,
  RiStarFill,
  RiStarLine,
} from '@remixicon/react'
import {
  listenTodos, addTodo, updateTodo, deleteTodo, listenTodoCategories,
  listenFolders, addFolder, updateFolder, deleteFolder,
} from '../../services/firestore'
import { deadlineBadge } from '../../utils/deadline'
import { useDeadlineNotifications } from '../../hooks/useDeadlineNotifications'
import { todayKey, MAX_TODAY_TASKS } from '../../utils/date'
import Modal from '../../components/Modal'
import Toast from '../../components/Toast'
import Tabs from '../../components/Tabs'

const PRIORITIES = [
  { value: 'alta', label: 'Alta', color: 'var(--coral)' },
  { value: 'media', label: 'Média', color: 'var(--gold)' },
  { value: 'baixa', label: 'Baixa', color: 'var(--text3)' },
]

const DEFAULT_CATEGORIES = ['trabalho', 'projeto', 'pessoal', 'saude', 'familia', 'estudo']

const EMPTY_FORM = { title: '', note: '', priority: 'media', category: 'projeto', dueDate: '', folderId: null }
const EMPTY_FOLDER_FORM = { name: '' }

export default function Tarefas() {
  const [todos, setTodos] = useState([])
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES)
  const [folders, setFolders] = useState([])
  const [activeFolder, setActiveFolder] = useState('parking')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [editingFolder, setEditingFolder] = useState(null)
  const [folderForm, setFolderForm] = useState(EMPTY_FOLDER_FORM)
  const [toast, setToast] = useState(null)
  const [filter, setFilter] = useState('pendentes')

  useEffect(() => {
    const u1 = listenTodos(setTodos)
    const u2 = listenTodoCategories(setCategories)
    const u3 = listenFolders(setFolders)
    return () => { u1(); u2(); u3() }
  }, [])

  useDeadlineNotifications(todos)

  const dateKey = todayKey()
  const todayCount = todos.filter(t => t.todayDate === dateKey).length

  const parkingPendingCount = todos.filter(t => !t.folderId && !t.done).length
  const folderPendingCount = (id) => todos.filter(t => t.folderId === id && !t.done).length

  const folderFiltered = todos.filter(t => activeFolder === 'parking' ? !t.folderId : t.folderId === activeFolder)
  const filtered = folderFiltered.filter(t => {
    if (filter === 'pendentes') return !t.done
    if (filter === 'concluídos') return t.done
    return true
  })

  const toggle = async (todo) => {
    await updateTodo(todo.id, { done: !todo.done })
  }

  const toggleToday = async (todo) => {
    const isToday = todo.todayDate === dateKey
    if (!isToday && todayCount >= MAX_TODAY_TASKS) {
      showToast(`Máximo de ${MAX_TODAY_TASKS} tarefas para hoje.`, 'error')
      return
    }
    await updateTodo(todo.id, { todayDate: isToday ? null : dateKey })
    showToast(isToday ? 'Removida de hoje.' : 'Marcada para hoje!')
  }

  const openAdd = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM, folderId: activeFolder === 'parking' ? null : activeFolder })
    setShowModal(true)
  }

  const openEdit = (item) => {
    setEditing(item)
    setForm({
      title: item.title,
      note: item.note || '',
      priority: item.priority || 'media',
      category: item.category || 'projeto',
      dueDate: item.dueDate || '',
      folderId: item.folderId || null,
    })
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

  const openAddFolder = () => {
    setEditingFolder(null)
    setFolderForm(EMPTY_FOLDER_FORM)
    setShowFolderModal(true)
  }

  const openEditFolder = (folder) => {
    setEditingFolder(folder)
    setFolderForm({ name: folder.name })
    setShowFolderModal(true)
  }

  const handleSaveFolder = async () => {
    if (!folderForm.name.trim()) return
    try {
      if (editingFolder) {
        await updateFolder(editingFolder.id, folderForm)
        showToast('Pasta atualizada!')
      } else {
        await addFolder(folderForm)
        showToast('Pasta criada!')
      }
      setShowFolderModal(false)
    } catch {
      showToast('Erro ao salvar pasta.', 'error')
    }
  }

  const handleDeleteFolder = async () => {
    await deleteFolder(editingFolder.id)
    if (activeFolder === editingFolder.id) setActiveFolder('parking')
    setShowFolderModal(false)
    showToast('Pasta removida. As tarefas voltaram para o Parking Lot.')
  }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const done = todos.filter(t => t.done).length

  return (
    <>
      <div className="subpage-controls">
        {todos.length > 0 && (
          <span className="subpage-controls-note">{done} de {todos.length} concluídas · {todayCount}/{MAX_TODAY_TASKS} para hoje</span>
        )}
        <button className="btn btn-primary" onClick={openAdd}>
          <RiAddLine size={15} /> Nova tarefa
        </button>
      </div>

      <div className="notebooks-bar">
        <button
          className={`notebook-tab ${activeFolder === 'parking' ? 'active' : ''}`}
          onClick={() => setActiveFolder('parking')}
        >
          <RiInboxLine size={13} /> Parking Lot <span className="nb-count">{parkingPendingCount}</span>
        </button>
        {folders.map(folder => (
          <button
            key={folder.id}
            className={`notebook-tab ${activeFolder === folder.id ? 'active' : ''}`}
            onClick={() => setActiveFolder(folder.id)}
            onContextMenu={e => { e.preventDefault(); openEditFolder(folder) }}
            title="Clique com o botão direito para editar"
          >
            {folder.name}
            <span className="nb-count">{folderPendingCount(folder.id)}</span>
          </button>
        ))}
        <button className="notebook-tab-add" onClick={openAddFolder}>
          <RiAddLine size={13} /> Pasta
        </button>
      </div>

      <Tabs
        items={['pendentes', 'concluídos', 'todos'].map(f => ({ key: f, label: f.charAt(0).toUpperCase() + f.slice(1) }))}
        active={filter}
        onChange={setFilter}
      />

      <div>
        {filtered.map(todo => {
          const badge = deadlineBadge(todo.dueDate)
          const isToday = todo.todayDate === dateKey
          return (
            <div key={todo.id} className="todo-item">
              <input
                type="checkbox"
                className="todo-check"
                checked={todo.done}
                onChange={() => toggle(todo)}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className={`todo-text ${todo.done ? 'done' : ''}`}>{todo.title}</div>
                {todo.note && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{todo.note}</div>}
                <div className="todo-meta">
                  {todo.category && <span className={`pill pill-${todo.category}`}>{todo.category}</span>}
                  {todo.priority && (
                    <span style={{ color: PRIORITIES.find(p => p.value === todo.priority)?.color || 'var(--text3)', fontSize: 11 }}>
                      {todo.priority}
                    </span>
                  )}
                  {todo.dueDate && !todo.done && (
                    <>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                        {new Date(todo.dueDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </span>
                      {badge && (
                        <span className={`deadline-badge deadline-badge--${badge.variant}`}>
                          {badge.text}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="todo-actions">
                <button
                  className={`btn btn-sm btn-icon ${isToday ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => toggleToday(todo)}
                  aria-label={isToday ? 'Remover de hoje' : 'Marcar para hoje'}
                  title={isToday ? 'Remover de hoje' : 'Marcar para hoje'}
                >
                  {isToday ? <RiStarFill size={14} /> : <RiStarLine size={14} />}
                </button>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(todo)} aria-label="Editar">
                  <RiPencilLine size={14} />
                </button>
                <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(todo.id)} aria-label="Apagar">
                  <RiDeleteBinLine size={14} />
                </button>
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon"><RiCheckboxBlankLine size={32} /></div>
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
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Pasta</label>
              <select value={form.folderId || ''} onChange={e => setForm(f => ({ ...f, folderId: e.target.value || null }))}>
                <option value="">Parking Lot</option>
                {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Data limite (opcional)</label>
              <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            </div>
          </div>
        </Modal>
      )}

      {showFolderModal && (
        <Modal
          title={editingFolder ? 'Editar pasta' : 'Nova pasta'}
          onClose={() => setShowFolderModal(false)}
          onSave={handleSaveFolder}
        >
          <div className="field">
            <label>Nome da pasta</label>
            <input value={folderForm.name} onChange={e => setFolderForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Trabalho" />
          </div>
          {editingFolder && (
            <button className="btn btn-danger" style={{ marginTop: 12, width: '100%' }} onClick={handleDeleteFolder}>
              <RiDeleteBinLine size={14} /> Excluir pasta (tarefas voltam ao Parking Lot)
            </button>
          )}
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </>
  )
}
