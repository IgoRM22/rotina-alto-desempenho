import React from 'react'
import { RiFireFill, RiSparklingFill } from '@remixicon/react'
import PixelCharacter from './PixelCharacter'
import BoltIcon from './BoltIcon'
import CountUp from './CountUp'

const RADIUS = 46
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// mood conta uma coisa só, de relance, sobre COMO vai o dia — não é mais
// um selo de conquista solto (o "fogo desconectado de tudo" que existia
// antes): agora o mesmo ícone que muda o selo do nível também tinge o anel
// inteiro, então a cor e o ícone contam a mesma história junto.
const MOOD = {
  streak: { Icon: RiFireFill, title: (n) => `sequência de ${n} dia${n === 1 ? '' : 's'} — hoje ainda não marcado` },
  complete: { Icon: RiSparklingFill, title: () => 'tudo em dia hoje' },
}

// Cartão de nível/XP com anel de progresso e o personagem em pixel art no
// centro — o ponto de maior impacto visual do Hoje, de propósito: é o único
// lugar do app que usa gradiente + glow, reservado pro elemento que resume
// "como você está indo".
export default function GamificationCard({ level, xp, xpToNext, pct, character, mood, streakDays, onCharacterClick }) {
  const offset = CIRCUMFERENCE * (1 - pct / 100)
  const moodDef = mood && MOOD[mood]

  return (
    <div className={`gami-card reveal ${moodDef ? `gami-card--${mood}` : ''}`} style={{ '--d': 0.08 }}>
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
        <button
          type="button"
          className="gami-ring-center"
          onClick={onCharacterClick}
          disabled={!onCharacterClick}
          aria-label="Editar personagem"
          title={onCharacterClick ? 'Editar personagem' : undefined}
        >
          {character?.body ? (
            <PixelCharacter character={character} level={level} size={76} />
          ) : (
            <span className="gami-ring-level">{level}</span>
          )}
        </button>
        <span className="gami-ring-badge" title={moodDef ? moodDef.title(streakDays) : undefined}>
          {moodDef ? <moodDef.Icon size={11} color="#fff" /> : <BoltIcon size={11} color="#fff" />}
          {level}
        </span>
      </div>

      <div className="gami-info">
        <div className="gami-xp-row">
          <span className="gami-xp-num"><CountUp value={xp} format={(v) => Math.round(v).toLocaleString('pt-BR')} /> XP</span>
          <span className="gami-xp-next">faltam {xpToNext} para o nível {level + 1}</span>
        </div>
      </div>
    </div>
  )
}
