import React, { useEffect, useRef, useState } from 'react'

// Número que conta do zero até o valor real (~700ms) — o "reveal" único de Finanças.
// Respeita prefers-reduced-motion: nesse caso mostra o valor direto.
export default function CountUp({ value, format = (v) => Math.round(v), duration = 700 }) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef(null)

  useEffect(() => {
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    if (reduce || !value) {
      setDisplay(value || 0)
      return
    }

    const t0 = performance.now()
    const step = (ts) => {
      const p = Math.min((ts - t0) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(value * eased)
      if (p < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, duration])

  return <>{format(display)}</>
}
