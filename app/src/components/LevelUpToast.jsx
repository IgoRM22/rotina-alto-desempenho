import React, { useEffect } from 'react'
import PixelCharacter from './PixelCharacter'
import BoltIcon from './BoltIcon'

// Celebração de subir de nível — separada do Toast genérico porque merece
// mais destaque (é um marco, não um aviso), mas ainda discreta o bastante
// pra não travar a tela: aparece, respira um instante, some sozinha.
export default function LevelUpToast({ level, unlocked, character, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4200)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div className="levelup-toast" onClick={onClose} role="status">
      <div className="levelup-toast-avatar">
        {character?.body ? (
          <PixelCharacter character={character} level={level} size={44} variant="face" />
        ) : (
          <BoltIcon size={20} color="#fff" />
        )}
        <span className="levelup-toast-badge">{level}</span>
      </div>
      <div className="levelup-toast-body">
        <p className="levelup-toast-title">Nível {level}</p>
        <p className="levelup-toast-detail">
          {unlocked ? <>Novo item desbloqueado: <strong>{unlocked.label}</strong></> : 'Continue assim — o próximo desbloqueio está chegando.'}
        </p>
      </div>
    </div>
  )
}
