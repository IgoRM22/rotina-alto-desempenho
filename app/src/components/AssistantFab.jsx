import React, { useState } from 'react'
import AssistantModal from './AssistantModal'
import SparkleIcon from './SparkleIcon'

// Ícone flutuante, presente em qualquer tela — atalho fixo para o assistente.
export default function AssistantFab() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" className="assistant-fab" onClick={() => setOpen(true)} aria-label="Abrir assistente">
        <SparkleIcon size={26} twinkle />
      </button>
      {open && <AssistantModal onClose={() => setOpen(false)} />}
    </>
  )
}
