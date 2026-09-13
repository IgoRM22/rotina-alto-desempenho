import React, { useState } from 'react'
import { RiCheckLine, RiLockLine, RiShuffleLine } from '@remixicon/react'
import { saveCharacter } from '../services/firestore'
import { BODY_TYPES, HAIR_STYLES, DEFAULT_CHARACTER, SLOTS, UNLOCKS, unlockedForSlot, resolveEquipped } from '../utils/character'
import PixelCharacter from './PixelCharacter'
import Modal from './Modal'

const randomOf = (list) => list[Math.floor(Math.random() * list.length)].value

const SLOT_LABELS = { torso: 'Peito', hat: 'Cabeça', weapon: 'Arma', shield: 'Escudo' }

// Primeiro contato com o app: em vez de um ícone genérico de assistente,
// a pessoa cria seu personagem de RPG — corpo e cabelo agora, o resto
// (armadura, capacete, arma, escudo) vai sendo revelado conforme ela sobe
// de nível de verdade usando o app (ver utils/character.js: UNLOCKS).
export default function CharacterCreatorModal({ initial, level = 1, onCreated, onCancel }) {
  const isEditing = !!onCancel
  const [form, setForm] = useState({ ...DEFAULT_CHARACTER, ...initial })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await saveCharacter({ ...form, name: form.name.trim() || 'Aventureiro' })
    setSaving(false)
    onCreated()
  }

  return (
    <Modal
      title={isEditing ? 'Editar personagem' : 'Crie seu personagem'}
      onClose={onCancel || (() => {})}
      onSave={handleSave}
      saveLabel={saving ? 'Salvando...' : (isEditing ? 'Salvar' : 'Começar a jornada')}
      hideCancel={!isEditing}
      hideClose={!isEditing}
    >
      <p className="character-creator-intro">
        Ele vai te acompanhar em todo o app, no lugar do ícone de assistente — e ganha armadura,
        capacete e arma de verdade conforme você sobe de nível.
      </p>

      <div className="character-creator-preview">
        <PixelCharacter character={form} level={level} size={112} />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setForm((f) => ({ ...f, body: randomOf(BODY_TYPES), hair: randomOf(HAIR_STYLES) }))}
        >
          <RiShuffleLine size={14} /> Aleatório
        </button>
      </div>

      <div className="field">
        <label>Nome</label>
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Dê um nome a ele"
          maxLength={24}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="field">
          <label>Tipo</label>
          <select value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}>
            {BODY_TYPES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Cabelo</label>
          <select value={form.hair} onChange={(e) => setForm((f) => ({ ...f, hair: e.target.value }))}>
            {HAIR_STYLES.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
          </select>
        </div>
      </div>

      {isEditing && (
        <div className="field">
          <label>Equipamento</label>
          {SLOTS.every((slot) => unlockedForSlot(slot, level).length === 0) ? (
            <p className="character-creator-intro" style={{ margin: 0 }}>
              Ainda nada desbloqueado — suba de nível pra ganhar a primeira peça.
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {SLOTS.map((slot) => {
                const options = unlockedForSlot(slot, level)
                if (!options.length) return null
                const resolved = resolveEquipped(form, level)[slot]
                const current = form.equipped?.[slot] || resolved?.item || 'none'
                return (
                  <div key={slot} className="field" style={{ marginBottom: 0 }}>
                    <label>{SLOT_LABELS[slot]}</label>
                    <select
                      value={current}
                      onChange={(e) => setForm((f) => ({ ...f, equipped: { ...f.equipped, [slot]: e.target.value } }))}
                    >
                      <option value="none">Nenhum</option>
                      {options.map((o) => <option key={o.item} value={o.item}>{o.label}</option>)}
                    </select>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div className="field" style={{ marginBottom: 0 }}>
        <label>Progressão</label>
        <div className="battlepass-list">
          {UNLOCKS.map((u) => {
            const earned = level >= u.level
            return (
              <div key={`${u.slot}-${u.item}`} className={`battlepass-row ${earned ? 'is-earned' : ''}`}>
                <span className="battlepass-level">{u.level}</span>
                <span className="battlepass-label">{u.label}</span>
                <span className="battlepass-icon">{earned ? <RiCheckLine size={14} /> : <RiLockLine size={13} />}</span>
              </div>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}
