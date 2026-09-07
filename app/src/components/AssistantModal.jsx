import React, { useEffect, useRef, useState } from 'react'
import { RiCloseLine, RiDeleteBin6Line, RiImageAddLine, RiSendPlaneFill } from '@remixicon/react'
import { runAssistantCommand, confirmAssistantActions } from '../services/assistant'
import { todayKey } from '../utils/date'
import { resizeImageFile } from '../utils/imageResize'
import SparkleIcon from './SparkleIcon'

// O backend já manda mensagens específicas em português (limite de uso,
// sobrecarga, etc.) — só cai no texto genérico quando o erro é técnico
// demais pra mostrar direto (rede caiu antes de chegar ao servidor).
const displayError = (err) => {
  const msg = err?.message || ''
  if (!msg || msg.startsWith('assistant_error_') || msg === 'Failed to fetch' || msg === 'not-authenticated') {
    return 'Não consegui completar isso agora. Tente de novo em instantes.'
  }
  return msg
}

const SUGGESTIONS = [
  'Resumo do meu dia',
  'Resumo da minha semana',
  'Criar tarefa: ',
  'Marcar hábito: ',
]

const MAX_HISTORY = 8
const STORAGE_KEY = 'raio-assistant-chat'
const MAX_STORED_MESSAGES = 60

const loadStoredMessages = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const storeMessages = (messages) => {
  try {
    // A miniatura da imagem não entra no localStorage — cada foto em base64
    // facilmente passa de 100KB, e 60 mensagens guardadas assim estourariam
    // a cota rápido. Ela só vive na sessão atual, em memória.
    const trimmed = messages.slice(-MAX_STORED_MESSAGES).map(({ image, ...rest }) => rest)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // localStorage indisponível (aba privada, cota cheia) — histórico só não persiste, sem quebrar o chat
  }
}

// Chat com o assistente: cada mensagem sua vira um comando enviado à Cloud
// Function. Ações de escrita nunca acontecem direto — o assistente propõe,
// e só executa de verdade depois que você confirma no chat.
export default function AssistantModal({ onClose }) {
  // { role: 'user' | 'assistant' | 'error', text, pending?: { tool, args } | 'done' | 'cancelled' }
  // Persistido no localStorage do navegador — sobrevive a fechar o modal e a
  // recarregar a página (é por dispositivo, não sincroniza entre aparelhos).
  const [messages, setMessages] = useState(loadStoredMessages)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  // { data (base64 sem prefixo), mimeType, previewUrl } — anexo pendente, ex: foto de um extrato
  const [pendingImage, setPendingImage] = useState(null)
  const [imageBusy, setImageBusy] = useState(false)
  const inputRef = useRef(null)
  const bodyRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    document.body.classList.add('has-modal-open')
    return () => document.body.classList.remove('has-modal-open')
  }, [])

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => { storeMessages(messages) }, [messages])

  const historyPayload = () => messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, text: m.text }))

  const send = async (command, image) => {
    if ((!command && !image) || loading || !online) return

    const history = historyPayload()
    setMessages((prev) => [...prev, {
      role: 'user',
      text: command || '(imagem enviada)',
      image: image?.previewUrl,
    }])
    setText('')
    setPendingImage(null)
    setLoading(true)

    try {
      const data = await runAssistantCommand(
        command, todayKey(), history,
        image ? { data: image.data, mimeType: image.mimeType } : undefined,
      )
      setMessages((prev) => [...prev, {
        role: 'assistant',
        text: data.message,
        pending: data.needsConfirmation ? { actions: data.pendingActions || [] } : undefined,
      }])
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'error', text: displayError(err) }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const submit = () => send(text.trim(), pendingImage)

  const pickImage = () => fileInputRef.current?.click()

  const onImageSelected = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    setImageBusy(true)
    try {
      const resized = await resizeImageFile(file)
      setPendingImage(resized)
    } catch {
      setMessages((prev) => [...prev, { role: 'error', text: 'Não consegui ler essa imagem. Tenta outra?' }])
    } finally {
      setImageBusy(false)
    }
  }

  // Sem isso, um comando digitado errado (typo, etc.) só podia ser corrigido
  // mandando outra mensagem do zero — tocar na sua própria mensagem já
  // devolve o texto pra caixa, pronto pra ajustar e reenviar.
  const reuseMessage = (msgText) => {
    setText(msgText)
    inputRef.current?.focus()
  }

  const useSuggestion = (s) => {
    if (s.endsWith(': ')) {
      setText(s)
      inputRef.current?.focus()
    } else {
      send(s)
    }
  }

  const respondToPending = async (index, action) => {
    const target = messages[index]
    if (!target?.pending || typeof target.pending !== 'object') return

    if (action === 'cancel') {
      setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, pending: 'cancelled' } : m)))
      return
    }

    const { actions } = target.pending
    setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, pending: 'done' } : m)))
    setLoading(true)
    try {
      const data = await confirmAssistantActions(actions, todayKey())
      setMessages((prev) => [...prev, { role: 'assistant', text: data.message }])
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'error', text: displayError(err) }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="assistant-modal-overlay" onClick={onClose}>
      <div className="assistant-modal" onClick={(e) => e.stopPropagation()}>
        <div className="assistant-modal-header">
          <div>
            <span className="assistant-modal-title"><SparkleIcon size={19} /> Assistente</span>
            <p className="assistant-modal-subtitle">peça para criar, marcar ou atualizar algo</p>
          </div>
          <div className="assistant-modal-header-actions">
            {messages.length > 0 && (
              <button className="btn-icon assistant-modal-clear" onClick={() => setMessages([])} aria-label="Limpar conversa" title="Limpar conversa">
                <RiDeleteBin6Line size={17} />
              </button>
            )}
            <button className="modal-close btn-icon" onClick={onClose} aria-label="Fechar">
              <RiCloseLine size={18} />
            </button>
          </div>
        </div>

        <div className="assistant-modal-body" ref={bodyRef}>
          {messages.length === 0 && (
            <div className="assistant-modal-empty">
              <SparkleIcon size={30} />
              <p>Comece com um comando ou toque em uma sugestão.</p>
              <div className="assistant-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" className="assistant-suggestion-chip" onClick={() => useSuggestion(s)}>
                    {s.trim().replace(/:$/, '')}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`assistant-row assistant-row--${m.role}`}>
              {m.role !== 'user' && (
                <span className="assistant-avatar"><SparkleIcon size={15} /></span>
              )}
              <div
                className={`assistant-msg assistant-msg--${m.role}`}
                onClick={m.role === 'user' ? () => reuseMessage(m.text) : undefined}
                title={m.role === 'user' ? 'Toque para editar e reenviar' : undefined}
              >
                {m.image && <img className="assistant-msg-image" src={m.image} alt="anexo enviado" />}
                {m.text}
                {m.pending && typeof m.pending === 'object' && (
                  <div className="assistant-confirm-row">
                    <button type="button" className="assistant-confirm-btn assistant-confirm-btn--yes" onClick={() => respondToPending(i, 'confirm')}>
                      Confirmar
                    </button>
                    <button type="button" className="assistant-confirm-btn assistant-confirm-btn--no" onClick={() => respondToPending(i, 'cancel')}>
                      Cancelar
                    </button>
                  </div>
                )}
                {m.pending === 'cancelled' && <div className="assistant-confirm-status">cancelado</div>}
              </div>
            </div>
          ))}

          {loading && (
            <div className="assistant-row assistant-row--assistant">
              <span className="assistant-avatar"><SparkleIcon size={15} /></span>
              <div className="assistant-msg assistant-msg--assistant assistant-typing">
                <span /><span /><span />
              </div>
            </div>
          )}
        </div>

        {!online && <div className="assistant-offline">Você está offline — tente novamente em instantes.</div>}

        {pendingImage && (
          <div className="assistant-image-preview">
            <img src={pendingImage.previewUrl} alt="prévia do anexo" />
            <span className="assistant-image-preview-name">imagem anexada — ex: extrato ou comprovante</span>
            <button type="button" className="assistant-image-remove" onClick={() => setPendingImage(null)} aria-label="Remover imagem">
              <RiCloseLine size={16} />
            </button>
          </div>
        )}

        <div className="assistant-modal-composer">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={onImageSelected}
          />
          <button
            type="button"
            className="assistant-attach-btn"
            onClick={pickImage}
            disabled={!online || imageBusy}
            aria-label="Anexar imagem"
            title="Anexar imagem (ex: extrato)"
          >
            <RiImageAddLine size={19} />
          </button>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            disabled={!online}
            placeholder={online ? 'ex: criar tarefa comprar pão amanhã' : 'sem conexão...'}
          />
          <button className="assistant-send-btn" onClick={submit} disabled={loading || !online || (!text.trim() && !pendingImage)} aria-label="Enviar">
            <RiSendPlaneFill size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
