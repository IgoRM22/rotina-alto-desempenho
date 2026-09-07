import React from 'react'

const URL_RE = /(https?:\/\/[^\s<>"']+)/g

// Texto livre (nota de tarefa, prévia de nota) às vezes é só uma URL colada —
// sem isso, ficava como texto puro, sem como tocar/clicar.
export default function Linkify({ text }) {
  if (!text) return null
  const parts = String(text).split(URL_RE)

  return parts.map((part, i) => (
    /^https?:\/\//.test(part)
      ? (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      )
      : <React.Fragment key={i}>{part}</React.Fragment>
  ))
}
