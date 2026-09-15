import React from 'react'
import { Link } from 'react-router-dom'
import { RiTimerLine } from '@remixicon/react'

// Mesmo cartão, mesmo lugar (logo abaixo do cabeçalho/topbar) nas 3 telas
// que levam pro Foco — Hoje, Revisão Semanal e Planejar — pra não trocar de
// posição/aparência ao navegar entre elas e quebrar a expectativa de onde
// ele está. Antes cada tela tinha sua própria versão copiada.
export default function FocusShortcut() {
  return (
    <Link to="/planejar/foco" className="hero-focus-card focus-shortcut">
      <span className="hero-focus-icon"><RiTimerLine size={20} /></span>
      <span className="hero-focus-text">
        <span className="hero-focus-title">Iniciar foco</span>
        <span className="hero-focus-sub">cada minuto conta para uma meta</span>
      </span>
    </Link>
  )
}
