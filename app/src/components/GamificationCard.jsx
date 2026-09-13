import React from 'react'
import PixelCharacter from './PixelCharacter'

const RADIUS = 46
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// Cartão de nível/XP com anel de progresso e o personagem em pixel art no
// centro — o ponto de maior impacto visual do Hoje, de propósito: é o único
// lugar do app que usa gradiente + glow, reservado pro elemento que resume
// "como você está indo" e mostra o que você já conquistou de verdade.
export default function GamificationCard({ level, xp, xpToNext, pct, badges, character, nextUnlock }) {
  const offset = CIRCUMFERENCE * (1 - pct / 100)
  const earnedBadges = badges.filter((b) => b.earned)

  return (
    <div className="gami-card reveal" style={{ '--d': 0.08 }}>
      <div className="gami-ring-wrap">
        <svg className="gami-ring" viewBox="0 0 108 108">
          <circle className="gami-ring-bg" cx="54" cy="54" r={RADIUS} />
          <circle
            className="gami-ring-fg"
            cx="54" cy="54" r={RADIUS}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="gami-ring-center">
          {character?.body ? (
            <PixelCharacter character={character} level={level} size={76} />
          ) : (
            <span className="gami-ring-level">{level}</span>
          )}
        </div>
        <span className="gami-ring-badge">{level}</span>
      </div>

      <div className="gami-info">
        <div className="gami-xp-row">
          <span className="gami-xp-num">{xp.toLocaleString('pt-BR')} XP</span>
          <span className="gami-xp-next">faltam {xpToNext} para o nível {level + 1}</span>
        </div>

        {nextUnlock && (
          <p className="gami-next-unlock">Próximo desbloqueio: <strong>{nextUnlock.label}</strong> no nível {nextUnlock.level}</p>
        )}

        {earnedBadges.length > 0 ? (
          <div className="gami-badges">
            {earnedBadges.map((b) => (
              <span key={b.id} className="gami-badge is-earned" title={b.label}>{b.emoji}</span>
            ))}
          </div>
        ) : (
          <p className="gami-next-unlock">Suas primeiras conquistas aparecem aqui conforme você usa o app.</p>
        )}
      </div>
    </div>
  )
}
