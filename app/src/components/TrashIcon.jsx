import React from 'react'

// Lixeira desenhada com o mesmo traço fino usado em BoltIcon/SparkleIcon —
// tampa + balde + duas linhas internas, em vez do ícone denso de biblioteca.
export default function TrashIcon({ size = 16, color = 'currentColor', strokeWidth = 1.6 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4.5 7h15M9.5 7V5.2a1.2 1.2 0 011.2-1.2h2.6a1.2 1.2 0 011.2 1.2V7"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 7l.9 12.1a1.6 1.6 0 001.6 1.5h6a1.6 1.6 0 001.6-1.5L17.5 7"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10.3 10.6l.4 7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d="M13.7 10.6l-.4 7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  )
}
