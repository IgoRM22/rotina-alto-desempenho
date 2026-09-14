import React, { useEffect, useMemo, useRef, useState } from 'react'
import AssistantModal from './AssistantModal'
import CharacterCreatorModal from './CharacterCreatorModal'
import PixelCharacter from './PixelCharacter'
import {
  listenCharacter, listenTodos, listenHabits, listenHabitLogs, listenFocusSessions, listenGoals,
} from '../services/firestore'
import { computeXp } from '../utils/gamification'

const STORAGE_KEY = 'raiodesk-assistant-fab-pos'
const FAB_SIZE = 64
const DRAG_THRESHOLD = 6

const loadPos = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const savePos = (pos) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)) } catch { /* ignore */ }
}

const clampPos = (pos) => {
  const margin = 6
  const maxX = Math.max(margin, window.innerWidth - FAB_SIZE - margin)
  const maxY = Math.max(margin, window.innerHeight - FAB_SIZE - margin)
  return {
    x: Math.min(Math.max(margin, pos.x), maxX),
    y: Math.min(Math.max(margin, pos.y), maxY),
  }
}

// Ícone flutuante, presente em qualquer tela — atalho fixo para o assistente.
// Segurar e arrastar move a bolinha pra qualquer lugar da tela (igual ao
// balão de suporte do Mercado Pago) — a posição fica salva no aparelho, então
// não some ao trocar de página nem ao recarregar.
export default function AssistantFab() {
  const [open, setOpen] = useState(false)
  const [scrolling, setScrolling] = useState(false)
  const [pos, setPos] = useState(loadPos)
  const [dragging, setDragging] = useState(false)
  const [character, setCharacter] = useState(null)
  const [editingCharacter, setEditingCharacter] = useState(false)
  const [todos, setTodos] = useState([])
  const [habits, setHabits] = useState([])
  const [habitLogs, setHabitLogs] = useState([])
  const [focusSessions, setFocusSessions] = useState([])
  const [goals, setGoals] = useState([])
  const idleTimer = useRef(null)
  const btnRef = useRef(null)
  const dragRef = useRef(null)

  useEffect(() => {
    const unsub = listenCharacter(setCharacter)
    return unsub
  }, [])

  // Mesmos dados usados no cálculo de XP do Hoje (ver utils/gamification.js)
  // — o personagem precisa saber o nível em QUALQUER página, já que a
  // bolinha flutua no app inteiro, não só na Home.
  useEffect(() => {
    const u1 = listenTodos(setTodos)
    const u2 = listenHabits(setHabits)
    const u3 = listenHabitLogs(setHabitLogs, 60)
    const u4 = listenFocusSessions(setFocusSessions, 500)
    const u5 = listenGoals(setGoals)
    return () => { u1(); u2(); u3(); u4(); u5() }
  }, [])

  const level = useMemo(
    () => computeXp({ todos, habitLogs, focusSessions, goals, habits }).level,
    [todos, habitLogs, focusSessions, goals, habits],
  )

  useEffect(() => {
    const onScroll = () => {
      setScrolling(true)
      clearTimeout(idleTimer.current)
      idleTimer.current = setTimeout(() => setScrolling(false), 500)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      clearTimeout(idleTimer.current)
    }
  }, [])

  // Se a janela muda de tamanho (ex: gira o celular) com uma posição
  // arrastada salva, reclampa pra ela não ficar presa fora da tela.
  useEffect(() => {
    if (!pos) return
    const onResize = () => setPos((p) => (p ? clampPos(p) : p))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [pos])

  const handlePointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    const rect = btnRef.current.getBoundingClientRect()
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: rect.left,
      originY: rect.top,
      moved: false,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e) => {
    const drag = dragRef.current
    if (!drag) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    if (!drag.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      drag.moved = true
      setDragging(true)
    }
    if (drag.moved) {
      e.preventDefault()
      setPos(clampPos({ x: drag.originX + dx, y: drag.originY + dy }))
    }
  }

  const endDrag = () => {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    setDragging(false)
    if (drag.moved) {
      setPos((p) => {
        if (p) savePos(p)
        return p
      })
    } else {
      setOpen(true)
    }
  }

  const style = pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : undefined

  // null = ainda carregando (não decide nada ainda); {} = doc não existe,
  // ou seja, é a primeira vez — pede pra criar o personagem antes de
  // mostrar a bolinha.
  if (character === null) return null
  if (!character.body) return <CharacterCreatorModal onCreated={() => {}} />

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`assistant-fab ${scrolling ? 'is-scrolling' : ''} ${dragging ? 'is-dragging' : ''}`}
        style={style}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={(e) => { if (e.detail === 0) setOpen(true) }}
        aria-label={`Abrir ${character.name || 'assistente'} (segure e arraste para mover)`}
      >
        <PixelCharacter character={character} level={level} size={62} variant="face" />
      </button>
      {open && (
        <AssistantModal
          character={character}
          level={level}
          onClose={() => setOpen(false)}
          onEditCharacter={() => setEditingCharacter(true)}
        />
      )}
      {editingCharacter && (
        <CharacterCreatorModal
          initial={character}
          level={level}
          onCreated={() => setEditingCharacter(false)}
          onCancel={() => setEditingCharacter(false)}
        />
      )}
    </>
  )
}
