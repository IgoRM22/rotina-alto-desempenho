import React, { useEffect, useState } from 'react'
import {
  RiAddLine,
  RiArrowRightLine,
  RiDeleteBinLine,
  RiInboxLine,
} from '@remixicon/react'
import { listenTodos, addTodo, updateTodo, deleteTodo, listenDailyLog, saveDailyAnnotations, listenImportantDates } from '../../services/firestore'
import { todayKey, addDays, dateKeyFromDate, MAX_TODAY_TASKS } from '../../utils/date'
import { expandImportantDatesForRange } from '../../utils/importantDates'
import HabitChecklist from '../../components/HabitChecklist'
import DailyLogCard from '../../components/DailyLogCard'
import CommitmentList from '../../components/CommitmentList'
import Modal from '../../components/Modal'
import Toast from '../../components/Toast'
import TaskDetailModal from '../../components/TaskDetailModal'

const TAGS = [
  { value: 'funcionou', label: '✅ Funcionou' },
  { value: 'ajustar', label: '🔧 Ajustar' },
  { value: 'rabisco', label: '📝 Rabisco' },
]

export default function Noturno() {
  const [todos, setTodos] = useState([])
  const [dailyLog, setDailyLog] = useState(null)
  const [importantDates, setImportantDates] = useState([])
  const [newTomorrowTask, setNewTomorrowTask] = useState('')
  const [annotationText, setAnnotationText] = useState('')
  const [showParkingModal, setShowParkingModal] = useState(false)
  const [viewingTodo, setViewingTodo] = useState(null)
  const [toast, setToast] = useState(null)

  const now = new Date()
  const tomorrowDate = addDays(now, 1)
  const today = todayKey()
  const tomorrow = dateKeyFromDate(tomorrowDate)

  useEffect(() => {
    const unsub = listenTodos(setTodos)
    return unsub
  }, [])

  useEffect(() => {
    const unsub = listenDailyLog(today, setDailyLog)
    return unsub
  }, [today])

  useEffect(() => {
    const unsub = listenImportantDates(setImportantDates)
    return unsub
  }, [])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const todayTasks = todos.filter(t => t.todayDate === today)
  const todayPending = todayTasks.filter(t => !t.done)
  const tomorrowTasks = todos.filter(t => t.todayDate === tomorrow)
  const tomorrowSuggestions = todos.filter(t => !t.done && t.todayDate !== tomorrow && t.dueDate && t.dueDate <= tomorrow)
  const parkingLotTasks = todos.filter(t => !t.done && !t.folderId && t.todayDate !== today && t.todayDate !== tomorrow)
  const annotations = dailyLog?.annotations || []

  const commitments = expandImportantDatesForRange(importantDates, now, tomorrowDate)
    .map(occ => ({ ...occ, tag: dateKeyFromDate(occ.occurrenceStart) === today ? 'hoje' : 'amanhã' }))

  const toggleDone = (todo) => updateTodo(todo.id, { done: !todo.done })
  const removeTask = (todo) => deleteTodo(todo.id)

  const moveToTomorrow = async (todo) => {
    if (tomorrowTasks.length >= MAX_TODAY_TASKS) {
      showToast(`Amanhã já tem ${MAX_TODAY_TASKS} tarefas.`, 'error')
      return
    }
    await updateTodo(todo.id, { todayDate: tomorrow, done: false })
  }

  const moveAllPendingToTomorrow = async () => {
    const room = MAX_TODAY_TASKS - tomorrowTasks.length
    if (room <= 0) {
      showToast(`Amanhã já tem ${MAX_TODAY_TASKS} tarefas.`, 'error')
      return
    }
    const toMove = todayPending.slice(0, room)
    await Promise.all(toMove.map(t => updateTodo(t.id, { todayDate: tomorrow, done: false })))
    showToast(`${toMove.length} tarefa(s) movida(s) para amanhã.`)
  }

  const addTomorrowTask = async () => {
    const title = newTomorrowTask.trim()
    if (!title) return
    if (tomorrowTasks.length >= MAX_TODAY_TASKS) {
      showToast(`Amanhã já tem ${MAX_TODAY_TASKS} tarefas.`, 'error')
      return
    }
    await addTodo({ title, todayDate: tomorrow, priority: 'media', category: 'projeto' })
    setNewTomorrowTask('')
  }

  const unmarkTomorrow = (todo) => updateTodo(todo.id, { todayDate: null })

  const addAnnotation = async (tag) => {
    const text = annotationText.trim()
    if (!text) return
    const next = [...annotations, { id: `${Date.now()}`, text, tag }]
    await saveDailyAnnotations(today, next)
    setAnnotationText('')
  }

  const removeAnnotation = async (id) => {
    await saveDailyAnnotations(today, annotations.filter(a => a.id !== id))
  }

  return (
    <>
      {commitments.length > 0 && (
        <section className="hoje-section">
          <div className="hoje-section-head">
            <h2 className="hoje-section-title">Compromissos</h2>
          </div>
          <CommitmentList items={commitments} />
        </section>
      )}

      <section className="hoje-section">
        <div className="hoje-section-head">
          <h2 className="hoje-section-title">Fechar o dia de hoje</h2>
          {todayPending.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={moveAllPendingToTomorrow}>
              <RiArrowRightLine size={13} /> mover pendentes p/ amanhã
            </button>
          )}
        </div>

        {todayTasks.length === 0 ? (
          <div className="empty-state">Nenhuma tarefa marcada para hoje.</div>
        ) : (
          <div>
            {todayTasks.map(todo => (
              <div key={todo.id} className="todo-item">
                <input type="checkbox" className="todo-check" checked={todo.done} onChange={() => toggleDone(todo)} />
                <div className="todo-content-clickable" onClick={() => setViewingTodo(todo)}>
                  <div className={`todo-text ${todo.done ? 'done' : ''}`}>{todo.title}</div>
                </div>
                <div className="todo-actions" style={{ opacity: 1 }}>
                  {!todo.done && (
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => moveToTomorrow(todo)} aria-label="Mover para amanhã" title="Mover para amanhã">
                      <RiArrowRightLine size={14} />
                    </button>
                  )}
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeTask(todo)} aria-label="Excluir">
                    <RiDeleteBinLine size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="hoje-section">
        <div className="hoje-section-head">
          <h2 className="hoje-section-title">Tarefas de amanhã</h2>
          <span className="subpage-controls-note" style={{ marginRight: 0 }}>{tomorrowTasks.length}/{MAX_TODAY_TASKS}</span>
        </div>

        {tomorrowTasks.map(todo => (
          <div key={todo.id} className="todo-item todo-item--no-check">
            <div className="todo-content-clickable" onClick={() => setViewingTodo(todo)}>
              <div className="todo-text">{todo.title}</div>
            </div>
            <div className="todo-actions" style={{ opacity: 1 }}>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => unmarkTomorrow(todo)} aria-label="Remover de amanhã" title="Remover de amanhã">
                <RiDeleteBinLine size={14} />
              </button>
            </div>
          </div>
        ))}

        {tomorrowSuggestions.length > 0 && (
          <div style={{ marginTop: 4, marginBottom: 4 }}>
            <span className="subpage-controls-note" style={{ marginRight: 0 }}>sugestões (vencidas ou vencendo amanhã)</span>
            {tomorrowSuggestions.map(todo => (
              <div key={todo.id} className="todo-item todo-item--no-check">
                <div className="todo-content-clickable" onClick={() => setViewingTodo(todo)}>
                  <div className="todo-text">{todo.title}</div>
                </div>
                <div className="todo-actions" style={{ opacity: 1 }}>
                  <button className="btn btn-primary btn-sm btn-icon" onClick={() => moveToTomorrow(todo)} aria-label="Adicionar em amanhã" title="Adicionar em amanhã">
                    <RiAddLine size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 4, marginBottom: 4 }} onClick={() => setShowParkingModal(true)}>
          <RiInboxLine size={13} /> Puxar do Parking Lot{parkingLotTasks.length > 0 ? ` (${parkingLotTasks.length})` : ''}
        </button>

        {tomorrowTasks.length < MAX_TODAY_TASKS && (
          <div className="habit-add-row">
            <input
              value={newTomorrowTask}
              onChange={e => setNewTomorrowTask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTomorrowTask()}
              placeholder="Nova tarefa para amanhã..."
            />
            <button className="btn btn-primary btn-sm btn-icon" onClick={addTomorrowTask} aria-label="Adicionar">
              <RiAddLine size={14} />
            </button>
          </div>
        )}
      </section>

      <section className="hoje-section">
        <div className="hoje-section-head">
          <h2 className="hoje-section-title">Hábitos</h2>
        </div>
        <HabitChecklist />
      </section>

      <section className="hoje-section">
        <div className="hoje-section-head">
          <h2 className="hoje-section-title">Registro do dia</h2>
        </div>
        <DailyLogCard />
      </section>

      <section className="hoje-section">
        <div className="hoje-section-head">
          <h2 className="hoje-section-title">Anotações</h2>
        </div>
        <div className="daily-log-card">
          <div className="field" style={{ marginBottom: 10 }}>
            <textarea
              rows={2}
              value={annotationText}
              onChange={e => setAnnotationText(e.target.value)}
              placeholder="O que aconteceu hoje?"
            />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: annotations.length ? 16 : 0 }}>
            {TAGS.map(tag => (
              <button key={tag.value} className="btn btn-ghost btn-sm" onClick={() => addAnnotation(tag.value)}>
                {tag.label}
              </button>
            ))}
          </div>
          {annotations.length > 0 && (
            <div>
              {annotations.map(a => (
                <div key={a.id} className="annotation-row">
                  <span className={`annotation-tag annotation-tag--${a.tag}`}>{TAGS.find(t => t.value === a.tag)?.label}</span>
                  <span className="annotation-text">{a.text}</span>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeAnnotation(a.id)} aria-label="Remover">
                    <RiDeleteBinLine size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {showParkingModal && (
        <Modal
          title="Puxar do Parking Lot"
          onClose={() => setShowParkingModal(false)}
          onSave={() => setShowParkingModal(false)}
          saveLabel="Concluído"
          hideCancel
        >
          {parkingLotTasks.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px 0' }}>
              Parking Lot vazio — nada pra priorizar por aqui.
            </div>
          ) : (
            <div>
              {parkingLotTasks.map(todo => (
                <div key={todo.id} className="todo-item todo-item--no-check">
                  <div className="todo-content-clickable" onClick={() => setViewingTodo(todo)}>
                    <div className="todo-text">{todo.title}</div>
                    {todo.category && (
                      <div className="todo-meta">
                        <span className={`pill pill-${todo.category}`}>{todo.category}</span>
                      </div>
                    )}
                  </div>
                  <div className="todo-actions" style={{ opacity: 1 }}>
                    <button className="btn btn-primary btn-sm btn-icon" onClick={() => moveToTomorrow(todo)} aria-label="Priorizar para amanhã" title="Priorizar para amanhã">
                      <RiAddLine size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      <TaskDetailModal todo={viewingTodo} onClose={() => setViewingTodo(null)} />

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </>
  )
}
