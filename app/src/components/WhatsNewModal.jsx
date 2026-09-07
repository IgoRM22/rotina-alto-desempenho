import React, { useState } from 'react'
import Modal from './Modal'
import SparkleIcon from './SparkleIcon'

// Versão do conteúdo — mude essa string quando quiser que o aviso reapareça
// pra todo mundo (ex: depois de uma leva grande de recursos novos).
const WHATS_NEW_ID = '2026-09-foco-financas-notificacoes'
const STORAGE_KEY = 'raio-whats-new-seen'

const hasSeenLatest = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === WHATS_NEW_ID
  } catch {
    return true // sem localStorage, melhor não incomodar do que travar
  }
}

const markSeen = () => {
  try {
    localStorage.setItem(STORAGE_KEY, WHATS_NEW_ID)
  } catch { /* silenciosamente ignora — não é crítico */ }
}

const ITEMS = [
  { title: 'Assistente de IA', text: 'Toque na estrela flutuante — cria tarefas, marca hábitos, consulta finanças e mais, sempre pedindo sua confirmação antes de gravar algo.' },
  { title: 'Foco', text: 'Nova aba em Planejar — timer de sessão vinculado a metas, com histórico dos últimos 14 dias.' },
  { title: 'Finanças mais completas', text: 'Agora dá pra fechar o mês e comparar o saldo com o mês anterior.' },
  { title: 'Notificações proativas', text: 'Ative em Ajustes — o assistente avisa quando algo realmente precisa da sua atenção, sem lembrete genérico.' },
]

export default function WhatsNewModal() {
  const [open, setOpen] = useState(() => !hasSeenLatest())

  if (!open) return null

  const dismiss = () => {
    markSeen()
    setOpen(false)
  }

  return (
    <Modal title="Novidades no Raio" onClose={dismiss} onSave={dismiss} saveLabel="Entendi" hideCancel>
      <div className="whats-new-list">
        {ITEMS.map((item) => (
          <div key={item.title} className="whats-new-item">
            <span className="whats-new-icon"><SparkleIcon size={16} /></span>
            <div>
              <p className="whats-new-item-title">{item.title}</p>
              <p className="whats-new-item-text">{item.text}</p>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}
