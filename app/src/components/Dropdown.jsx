import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { RiArrowDownSLine } from '@remixicon/react'

// Select nativo do navegador ignora boa parte do tema escuro no popup de
// opções (fundo branco, sem como estilizar de verdade) — esse componente
// substitui por um painel nosso, desenhado num portal direto no body (mesma
// técnica do menu "..." da Agenda), sempre no tema certo e sempre visível.
export default function Dropdown({ value, options, onChange, className = '', ariaLabel }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)

  const current = options.find((o) => o.value === value)

  const toggle = () => {
    if (open) { setOpen(false); return }
    const rect = btnRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return undefined
    const close = () => setOpen(false)
    const onKeyDown = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`dropdown-trigger ${className}`}
        onClick={toggle}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{current?.label ?? ''}</span>
        <RiArrowDownSLine size={13} aria-hidden="true" />
      </button>
      {open && pos && createPortal(
        <>
          <div className="dropdown-backdrop" onClick={() => setOpen(false)} />
          <div
            className="dropdown-panel"
            role="listbox"
            style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: pos.width }}
          >
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                className={`dropdown-option ${o.value === value ? 'active' : ''}`}
                onClick={() => { onChange(o.value); setOpen(false) }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </>
  )
}
