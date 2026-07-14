import React from 'react'
import Modal from './Modal'

const PRIORITY_LABELS = { alta: 'Alta', media: 'Média', baixa: 'Baixa' }

export default function TaskDetailModal({ todo, onClose }) {
  if (!todo) return null

  return (
    <Modal title={todo.title} onClose={onClose} onSave={onClose} saveLabel="Fechar" hideCancel>
      <div className="task-detail-meta">
        {todo.category && <span className={`pill pill-${todo.category}`}>{todo.category}</span>}
        {todo.priority && <span className="task-detail-priority">{PRIORITY_LABELS[todo.priority] || todo.priority}</span>}
        {todo.dueDate && (
          <span className="task-detail-due">
            {new Date(`${todo.dueDate}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </span>
        )}
      </div>
      <div className="task-detail-note">
        {todo.note ? todo.note : <span className="task-detail-empty">Sem descrição.</span>}
      </div>
    </Modal>
  )
}
