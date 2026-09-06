import React from 'react'

// Raio geométrico próprio — motivo visual da marca (nav, Foco, streaks).
export default function BoltIcon({ size = 18, color = 'var(--coral)', strokeWidth = 1.5, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={style}
      aria-hidden="true"
    >
      <path
        d="M13 2L4 14H11L9 22L20 9H12L13 2Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  )
}
