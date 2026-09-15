import React, { useState } from 'react'
import { RiCheckLine, RiLockLine, RiShuffleLine } from '@remixicon/react'
import { saveCharacter } from '../services/firestore'
import {
  BODY_TYPES, HAIR_STYLES, SKIN_TONES, HAIR_COLORS, DEFAULT_CHARACTER,
  SLOTS, UNLOCKS, BEHAVIOR_UNLOCKS, unlockedForSlot, resolveEquipped,
} from '../utils/character'
import { XP_PER_TASK, XP_PER_HABIT_CHECK, XP_PER_FOCUS_MINUTE, XP_PER_GOAL_DONE } from '../utils/gamification'

// Fonte da verdade visível: os MESMOS números usados no cálculo real (ver
// computeXp em utils/gamification.js) — nunca um valor solto digitado aqui
// à parte, que poderia desalinhar se a taxa mudasse num lugar só.
const XP_RATES = [
  { label: 'Concluir uma tarefa', amount: XP_PER_TASK },
  { label: 'Marcar um hábito', amount: XP_PER_HABIT_CHECK },
  { label: 'Cada minuto de foco', amount: XP_PER_FOCUS_MINUTE },
  { label: 'Concluir uma meta', amount: XP_PER_GOAL_DONE },
]
import PixelCharacter from './PixelCharacter'
import Modal from './Modal'

const randomOf = (list) => list[Math.floor(Math.random() * list.length)].value

const SLOT_LABELS = { torso: 'Peito', hat: 'Cabeça', feet: 'Pés', weapon: 'Arma', shield: 'Escudo' }
// "feet" fica de fora — sem isso, isolar QUALQUER outro slot (ex: prévia do
// chapéu) também zerava o sapato, virando pé descalço em toda prévia que
// não fosse a do próprio slot "Pés".
const EMPTY_EQUIPPED = { torso: 'none', hat: 'none', weapon: 'none', shield: 'none' }

// Linha de opções com preview de verdade (o personagem inteiro com aquela
// escolha aplicada) em vez de um <select> de texto — pra "tipo", "cabelo" e
// equipamento, ver o nome não diz nada, ver o boneco diz tudo.
function PreviewOptionRow({ options, activeValue, onSelect, buildPreviewCharacter, previewLevel = 1 }) {
  return (
    <div className="character-option-row">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`character-option ${activeValue === opt.value ? 'active' : ''}`}
          onClick={() => onSelect(opt.value)}
          title={opt.label}
        >
          {/* variant="full" força o corpo inteiro mesmo em 44px — sem isso,
              44 cai no limiar que troca pra zoom no rosto (ver
              FACE_VARIANT_MAX_SIZE em PixelCharacter.jsx), cortando pés e
              pernas fora da prévia. */}
          <PixelCharacter character={buildPreviewCharacter(opt.value)} level={previewLevel} size={44} variant="full" animated={false} />
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  )
}

// Primeiro contato com o app: em vez de um ícone genérico de assistente,
// a pessoa cria seu personagem de RPG — corpo, cabelo e cores agora, o resto
// (armadura, capacete, arma, escudo) vai sendo revelado conforme ela sobe
// de nível de verdade usando o app (ver utils/character.js: UNLOCKS).
export default function CharacterCreatorModal({ initial, level = 1, stats, onCreated, onCancel }) {
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
      wide
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
          onClick={() => setForm((f) => ({
            ...f,
            body: randomOf(BODY_TYPES),
            hair: randomOf(HAIR_STYLES),
            skinColor: randomOf(SKIN_TONES),
            hairColor: randomOf(HAIR_COLORS),
          }))}
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

      <div className="field">
        <label>Tipo</label>
        <PreviewOptionRow
          options={BODY_TYPES}
          activeValue={form.body}
          onSelect={(v) => setForm((f) => ({ ...f, body: v }))}
          buildPreviewCharacter={(v) => ({ ...form, body: v })}
        />
      </div>

      <div className="field">
        <label>Cabelo</label>
        <PreviewOptionRow
          options={HAIR_STYLES}
          activeValue={form.hair}
          onSelect={(v) => setForm((f) => ({ ...f, hair: v }))}
          buildPreviewCharacter={(v) => ({ ...form, hair: v })}
        />
      </div>

      <div className="field">
        <label>Tom de pele</label>
        <div className="character-swatch-row">
          {SKIN_TONES.map((hex) => (
            <button
              key={hex}
              type="button"
              className={`character-swatch ${form.skinColor === hex ? 'active' : ''}`}
              style={{ background: hex }}
              onClick={() => setForm((f) => ({ ...f, skinColor: hex }))}
              aria-label={`Tom de pele ${hex}`}
            />
          ))}
        </div>
      </div>

      <div className="field">
        <label>Cor do cabelo</label>
        <div className="character-swatch-row">
          {HAIR_COLORS.map((hex) => (
            <button
              key={hex}
              type="button"
              className={`character-swatch ${form.hairColor === hex ? 'active' : ''}`}
              style={{ background: hex }}
              onClick={() => setForm((f) => ({ ...f, hairColor: hex }))}
              aria-label={`Cor de cabelo ${hex}`}
            />
          ))}
          <label className="character-swatch character-swatch-custom" title="Qualquer cor">
            <input
              type="color"
              value={form.hairColor === '#ffffff' ? '#000000' : form.hairColor}
              onChange={(e) => setForm((f) => ({ ...f, hairColor: e.target.value }))}
            />
          </label>
        </div>
      </div>

      <div className="field">
        <label>Equipamento</label>
          {SLOTS.every((slot) => unlockedForSlot(slot, level, stats).length === 0) ? (
            <p className="character-creator-intro" style={{ margin: 0 }}>
              Ainda nada desbloqueado — suba de nível pra ganhar a primeira peça.
            </p>
          ) : (
            SLOTS.map((slot) => {
              const options = unlockedForSlot(slot, level, stats)
              if (!options.length) return null
              const resolved = resolveEquipped(form, level)[slot]
              // Torso e pés sempre vestem alguma coisa por padrão (ver
              // buildLayers em utils/character.js) — "Nenhum" nesses dois
              // não muda nada de verdade, só duplicava a primeira opção com
              // outro nome. Cabeça/arma/escudo continuam podendo ficar vazios.
              const hasNoneOption = slot !== 'torso' && slot !== 'feet'
              const current = form.equipped?.[slot] || resolved?.item || (slot === 'feet' ? 'boots' : (hasNoneOption ? 'none' : options[0]?.item))
              const selectOptions = [
                ...(hasNoneOption ? [{ value: 'none', label: 'Nenhum' }] : []),
                ...options.map((o) => ({ value: o.item, label: o.label })),
              ]
              return (
                <div key={slot} style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {SLOT_LABELS[slot]}
                  </label>
                  <PreviewOptionRow
                    options={selectOptions}
                    activeValue={current}
                    onSelect={(v) => setForm((f) => ({ ...f, equipped: { ...f.equipped, [slot]: v } }))}
                    buildPreviewCharacter={(v) => ({ ...form, equipped: { ...EMPTY_EQUIPPED, [slot]: v } })}
                    previewLevel={level}
                  />
                </div>
              )
            })
          )}
      </div>

      <div className="field">
        <label>Como ganhar XP</label>
        <div className="xp-rate-list">
          {XP_RATES.map((r) => (
            <div key={r.label} className="xp-rate-row">
              <span>{r.label}</span>
              <strong>+{r.amount} XP</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="field" style={{ marginBottom: 0 }}>
        <label>Progressão</label>
        <div className="battlepass-list">
          {UNLOCKS.map((u) => {
            const earned = level >= u.level
            const altUnlock = !earned ? BEHAVIOR_UNLOCKS.find((b) => b.item === u.item) : null
            // Personagem isolado só com ESTA peça (as outras "nenhum"), pra
            // dar pra ver exatamente o item, sem o resto do equipamento
            // atual competindo com a prévia. Corpo/cor seguem o form atual,
            // então a peça já aparece do jeito que vai ficar de verdade.
            const previewCharacter = { ...form, equipped: { ...EMPTY_EQUIPPED, [u.slot]: u.item } }
            return (
              <div key={`${u.slot}-${u.item}`} className={`battlepass-row ${earned ? 'is-earned' : ''}`}>
                <span className="battlepass-level">{u.level}</span>
                <div className="battlepass-preview">
                  <PixelCharacter character={previewCharacter} level={u.level} size={36} variant="full" animated={false} />
                </div>
                <span className="battlepass-label">
                  {u.label}
                  {altUnlock && <span className="battlepass-alt"> ou {altUnlock.requirementLabel}</span>}
                </span>
                <span className="battlepass-icon">{earned ? <RiCheckLine size={14} /> : <RiLockLine size={13} />}</span>
              </div>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}
