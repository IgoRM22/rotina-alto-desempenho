import React, { createContext, useCallback, useContext, useState } from 'react'

const XpContext = createContext(null)
let uid = 0

// Popup discreto de "+N XP" — em qualquer tela, não só no Hoje (onde mora o
// anel de XP) — sem travar nada (some sozinho) e empilha se disparar mais
// de um seguido (ex: marcar 2 hábitos rápido). O XP em si já estava sempre
// certo (é sempre derivado dos dados reais, ver computeXp em
// utils/gamification.js) — isso só deixa visível NA HORA quanto cada ação
// valeu, sem precisar abrir o Hoje pra descobrir.
export function XpProvider({ children }) {
  const [bubbles, setBubbles] = useState([])

  const grantXp = useCallback((amount, label) => {
    if (!amount) return
    const id = ++uid
    setBubbles((prev) => [...prev, { id, amount, label }])
    setTimeout(() => {
      setBubbles((prev) => prev.filter((b) => b.id !== id))
    }, 1900)
  }, [])

  return (
    <XpContext.Provider value={grantXp}>
      {children}
      <div className="xp-bubble-stack" aria-live="polite">
        {bubbles.map((b) => (
          <div key={b.id} className="xp-bubble">
            <span className="xp-bubble-amount">+{b.amount} XP</span>
            {b.label && <span className="xp-bubble-label">{b.label}</span>}
          </div>
        ))}
      </div>
    </XpContext.Provider>
  )
}

// const grantXp = useXp(); grantXp(8, 'hábito marcado') — chama de onde a
// ação acontece. Precisa estar dentro de <XpProvider> (montado em main.jsx).
export function useXp() {
  const ctx = useContext(XpContext)
  if (!ctx) throw new Error('useXp precisa estar dentro de <XpProvider>')
  return ctx
}
