import React, { useId } from 'react'

// Ícone de "IA" — duas estrelas de 4 pontas (grande + pequena), o desenho
// clássico de assistentes de IA. Usa a própria paleta do app (coral → violet)
// em vez de uma cor genérica, para casar com a identidade do Raio.
export default function SparkleIcon({ size = 20, className, twinkle = false }) {
  const gradientId = useId()

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="3" y1="16" x2="16" y2="3" gradientUnits="userSpaceOnUse">
          <stop offset="0%" style={{ stopColor: 'var(--coral)' }} />
          <stop offset="100%" style={{ stopColor: 'var(--violet)' }} />
        </linearGradient>
      </defs>
      <path
        d="M16,9.5 C11,11 11,11 9.5,16 C8,11 8,11 3,9.5 C8,8 8,8 9.5,3 C11,8 11,8 16,9.5 Z"
        fill={`url(#${gradientId})`}
      />
      <path
        className={twinkle ? 'sparkle-small-twinkle' : undefined}
        d="M21,18 C18.7,18.7 18.7,18.7 18,21 C17.3,18.7 17.3,18.7 15,18 C17.3,17.3 17.3,17.3 18,15 C18.7,17.3 18.7,17.3 21,18 Z"
        fill="var(--gold)"
      />
    </svg>
  )
}
