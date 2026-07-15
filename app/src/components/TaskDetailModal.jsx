import React, { useEffect, useState } from 'react'
import Modal from './Modal'
import { updateTodo } from '../services/firestore'

const PRIORITY_LABELS = { alta: 'Alta', media: 'Média', baixa: 'Baixa' }

export default function TaskDetailModal({ todo, onClose }) {
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (todo) {
      setTitle(todo.title || '')
      setNote(todo.note || '')
    }
  }, [todo])

  if (!todo) return null

  const handleSave = async () => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return
    if (trimmedTitle !== todo.title || note !== (todo.note || '')) {
      await updateTodo(todo.id, { title: trimmedTitle, note })
    }
    onClose()
  }

  return (
    <Modal title="Detalhes da tarefa" onClose={onClose} onSave={handleSave} saveLabel="Salvar">
      <div className="field">
        <label>Título</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="task-detail-meta">
        {todo.category && <span className={`pill pill-${todo.category}`}>{todo.category}</span>}
        {todo.priority && <span className="task-detail-priority">{PRIORITY_LABELS[todo.priority] || todo.priority}</span>}
        {todo.dueDate && (
          <span className="task-detail-due">
            {new Date(`${todo.dueDate}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </span>
        )}
      </div>

      <div className="field" style={{ marginBottom: 0 }}>
        <label>Descrição</label>
        <textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Sem descrição." />
      </div>
    </Modal>
  )
}
