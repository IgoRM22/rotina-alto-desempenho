import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { RiAddLine, RiCheckboxBlankLine } from '@remixicon/react'
import { listenTodos, updateTodo, listenWeekFocus } from '../services/firestore'
import HabitChecklist from '../components/HabitChecklist'
import DailyLogCard from '../components/DailyLogCard'
import { todayKey, getWeekKey } from '../utils/date'

const WEEKDAY_LABELS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
const MONTH_LABELS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export default function Home() {
  const [todos, setTodos] = useState([])
  const [focus, setFocus] = useState(null)

  useEffect(() => {
    const unsub = listenTodos(setTodos)
    return unsub
  }, [])

  const weekKey = getWeekKey()

  useEffect(() => {
    const unsub = listenWeekFocus(weekKey, setFocus)
    return unsub
  }, [weekKey])

  const dateKey = todayKey()
  const todayTodos = todos.filter(t => t.todayDate === dateKey)
  const suggestions = todos.filter(t => !t.done && t.todayDate !== dateKey && t.dueDate && t.dueDate <= dateKey)
  const now = new Date()
  const focusItems = focus?.items || []

  const toggle = (todo) => updateTodo(todo.id, { done: !todo.done })
  const pullToToday = (todo) => updateTodo(todo.id, { todayDate: dateKey })

  return (
    <div className="page">
      <div className="page-header">
        <span className="page-kicker">{WEEKDAY_LABELS[now.getDay()]}</span>
        <h1 className="page-title">
          Hoje<br />
          <em style={{ fontStyle: 'italic', color: 'var(--text2)' }}>{now.getDate()} de {MONTH_LABELS[now.getMonth()]}</em>
        </h1>
      </div>

      {focusItems.length > 0 && (
        <section className="hoje-section">
          <div className="hoje-section-head">
            <h2 className="hoje-section-title">Foco da semana</h2>
            <Link to="/planejar/revisao" className="hoje-section-link">revisão semanal</Link>
          </div>
          <ul className="nb-focus-list" style={{ marginBottom: 0 }}>
            {focusItems.map(item => <li key={item.id}><span>{item.text}</span></li>)}
          </ul>
        </section>
      )}

      <section className="hoje-section">
        <div className="hoje-section-head">
          <h2 className="hoje-section-title">Tarefas do dia</h2>
          <Link to="/planejar/tarefas" className="hoje-section-link">gerenciar tarefas</Link>
        </div>

        {todayTodos.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><RiCheckboxBlankLine size={28} /></div>
            Nenhuma tarefa marcada para hoje.<br />
            <Link to="/planejar/tarefas" className="hoje-section-link">Escolha até 6 em Tarefas →</Link>
          </div>
        ) : (
          <div>
            {todayTodos.map(todo => (
              <div key={todo.id} className="todo-item">
                <input
                  type="checkbox"
                  className="todo-check"
                  checked={todo.done}
                  onChange={() => toggle(todo)}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className={`todo-text ${todo.done ? 'done' : ''}`}>{todo.title}</div>
                  {todo.category && (
                    <div className="todo-meta">
                      <span className={`pill pill-${todo.category}`}>{todo.category}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {suggestions.length > 0 && (
        <section className="hoje-section">
          <div className="hoje-section-head">
            <h2 className="hoje-section-title">Sugestões</h2>
            <span className="subpage-controls-note" style={{ marginRight: 0 }}>vencidas ou vencendo hoje</span>
          </div>
          <div>
            {suggestions.map(todo => (
              <div key={todo.id} className="todo-item">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="todo-text">{todo.title}</div>
                  <div className="todo-meta">
                    {todo.category && <span className={`pill pill-${todo.category}`}>{todo.category}</span>}
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {new Date(todo.dueDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                </div>
                <div className="todo-actions" style={{ opacity: 1 }}>
                  <button className="btn btn-primary btn-sm btn-icon" onClick={() => pullToToday(todo)} aria-label="Adicionar em hoje" title="Adicionar em hoje">
                    <RiAddLine size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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
    </div>
  )
}
