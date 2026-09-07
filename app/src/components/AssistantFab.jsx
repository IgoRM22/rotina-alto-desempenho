import React, { useEffect, useRef, useState } from 'react'
import AssistantModal from './AssistantModal'
import SparkleIcon from './SparkleIcon'

// Ícone flutuante, presente em qualquer tela — atalho fixo para o assistente.
export default function AssistantFab() {
  const [open, setOpen] = useState(false)
  const [scrolling, setScrolling] = useState(false)
  const idleTimer = useRef(null)

  // Em várias telas (listas longas, tabelas) a posição fixa acaba caindo em
  // cima de botões de verdade (editar, excluir, adicionar). Em vez de mudar
  // a posição tela a tela, ela encolhe e fica translúcida enquanto a página
  // se move, e só volta ao tamanho normal ~500ms depois de parar de rolar —
  // nunca fica de fato bloqueando um clique parado embaixo dela.
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

  return (
    <>
      <button
        type="button"
        className={`assistant-fab ${scrolling ? 'is-scrolling' : ''}`}
        onClick={() => setOpen(true)}
        aria-label="Abrir assistente"
      >
        <SparkleIcon size={22} twinkle />
      </button>
      {open && <AssistantModal onClose={() => setOpen(false)} />}
    </>
  )
}
