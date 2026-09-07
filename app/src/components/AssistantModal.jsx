import React, { useEffect, useRef, useState } from 'react'
import { RiCloseLine, RiDeleteBin6Line, RiImageAddLine, RiMicLine, RiSendPlaneFill } from '@remixicon/react'
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
// Cada foto em base64 facilmente passa de 100KB, e localStorage tem cota
// limitada (geralmente ~5-10MB no total do site) — guardar só as fotos mais
// recentes evita estourar a cota enquanto ainda mantém o anexo visível ao
// reabrir o chat, em vez de sumir sempre que a página recarrega.
const MAX_STORED_IMAGES = 4

const loadStoredMessages = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const dropOldImages = (messages) => {
  let imagesKept = 0
  return messages
    .slice()
    .reverse()
    .map((m) => {
      if (!m.image) return m
      imagesKept += 1
      if (imagesKept > MAX_STORED_IMAGES) {
        const { image, ...rest } = m
        return rest
      }
      return m
    })
    .reverse()
}

const storeMessages = (messages) => {
  const trimmed = messages.slice(-MAX_STORED_MESSAGES)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dropOldImages(trimmed)))
  } catch {
    try {
      // Cota estourou mesmo com o corte — tenta de novo sem nenhuma imagem,
      // já que o texto sozinho é o que realmente não pode se perder.
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed.map(({ image, ...rest }) => rest)))
    } catch {
      // localStorage indisponível (aba privada) — histórico só não persiste, sem quebrar o chat
    }
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
  // Imagem "em foco" da conversa — sem isso, uma pergunta de acompanhamento
  // ("qual dia?", "inclui o nome dele") chegava ao Gemini só com texto, sem a
  // imagem, e ele esquecia o que tinha acabado de ver. Continua sendo
  // reenviada em turnos seguintes até a ação ser confirmada/cancelada ou uma
  // imagem nova ser anexada.
  const [activeImage, setActiveImage] = useState(null)
  const [imageBusy, setImageBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [waveMeterFailed, setWaveMeterFailed] = useState(false)
  const WAVE_BARS = 5
  const [waveLevels, setWaveLevels] = useState(() => Array(WAVE_BARS).fill(0.15))
  const inputRef = useRef(null)
  const bodyRef = useRef(null)
  const fileInputRef = useRef(null)
  const recognitionRef = useRef(null)
  const micStreamRef = useRef(null)
  const audioCtxRef = useRef(null)
  const rafRef = useRef(null)

  // Transcrição de voz é feita no navegador (Web Speech API) — grátis, sem
  // gastar token nenhum, e o resultado vira texto normal, reaproveitando o
  // mesmo caminho de sempre. Só existe no Chrome/Edge; some sem quebrar nada
  // quando o navegador não suporta.
  const speechSupported = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  // Barrinhas reagindo ao volume de verdade (igual o WhatsApp) — pede o
  // microfone separado do SpeechRecognition (que não expõe o stream bruto)
  // só pra medir o nível e animar. Se a permissão falhar por algum motivo,
  // a transcrição em si continua funcionando normalmente, só sem a animação.
  const startWaveMeter = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      micStreamRef.current = stream
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      const ctx = new AudioCtx()
      audioCtxRef.current = ctx
      // Criado depois de um await, fora do gesto de clique síncrono — o
      // navegador entrega o contexto em estado "suspended" por padrão, e sem
      // resume() o analyser nunca recebe áudio de verdade (era por isso que
      // as barras ficavam paradas, mesmo com o microfone funcionando).
      if (ctx.state === 'suspended') await ctx.resume()

      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 64
      analyser.smoothingTimeConstant = 0.4
      source.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)

      // rAF roda a ~60fps — empurrando uma amostra por frame, as 5 barras
      // enchem com o MESMO instante em ~80ms, então todas pulavam juntas pra
      // cheio em vez de formar uma onda. Espaçando as amostras a cada 90ms,
      // as 5 barras passam a cobrir quase meio segundo de histórico de
      // verdade — aí sim parece uma onda, igual o WhatsApp.
      const SAMPLE_INTERVAL_MS = 90
      let lastSampleAt = 0
      const tick = (now) => {
        if (now - lastSampleAt >= SAMPLE_INTERVAL_MS) {
          lastSampleAt = now
          analyser.getByteFrequencyData(data)
          const avg = data.reduce((sum, v) => sum + v, 0) / data.length
          const level = Math.min(1, avg / 70)
          setWaveLevels((prev) => [...prev.slice(1), level])
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch {
      // Segunda captura de mic bloqueada (ou sem suporte) — a transcrição em
      // si segue funcionando normal via SpeechRecognition; aqui só troca pra
      // um pulso simples via CSS, pra nunca ficar sem nenhum feedback visual.
      setWaveMeterFailed(true)
    }
  }

  const stopWaveMeter = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {})
    audioCtxRef.current = null
    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    micStreamRef.current = null
    setWaveLevels(Array(WAVE_BARS).fill(0.15))
    setWaveMeterFailed(false)
  }

  useEffect(() => () => { recognitionRef.current?.stop(); stopWaveMeter() }, [])

  const toggleListening = () => {
    if (!speechSupported) return
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognitionCtor()
    recognition.lang = 'pt-BR'
    recognition.interimResults = false
    recognition.continuous = false
    recognition.onresult = (event) => {
      let finalTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript
      }
      if (finalTranscript.trim()) {
        setText((prev) => (prev.trim() ? `${prev.trim()} ${finalTranscript.trim()}` : finalTranscript.trim()))
      }
    }
    recognition.onerror = () => { setListening(false); stopWaveMeter() }
    recognition.onend = () => { setListening(false); stopWaveMeter() }
    recognitionRef.current = recognition
    try {
      recognition.start()
      setListening(true)
      startWaveMeter()
    } catch {
      setListening(false)
    }
  }

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

  // Cresce a caixa de texto junto com o conteúdo (em vez de rolar escondendo
  // o começo do que foi digitado) — reage a qualquer mudança em `text`, não
  // só ao digitar, então também funciona ao reaproveitar uma mensagem antiga
  // ou usar uma sugestão, e volta ao tamanho mínimo quando o texto é limpo.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [text])

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => { storeMessages(messages) }, [messages])

  const historyPayload = () => messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, text: m.text }))

  const send = async (command, explicitImage) => {
    const imageForRequest = explicitImage || activeImage
    if ((!command && !imageForRequest) || loading || !online) return

    const history = historyPayload()
    setMessages((prev) => [...prev, {
      role: 'user',
      text: command || '(imagem enviada)',
      // Só mostra a miniatura na bolha quando é um anexo novo desta
      // mensagem — nos turnos seguintes a imagem viaja escondida, só pro
      // Gemini, sem repetir a foto visualmente no chat.
      image: explicitImage?.previewUrl,
    }])
    setText('')
    setPendingImage(null)
    if (explicitImage) setActiveImage(explicitImage)
    setLoading(true)

    try {
      const data = await runAssistantCommand(
        command, todayKey(), history,
        imageForRequest ? { data: imageForRequest.data, mimeType: imageForRequest.mimeType } : undefined,
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
      setActiveImage(null)
      return
    }

    const { actions } = target.pending
    setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, pending: 'done' } : m)))
    setLoading(true)
    try {
      const data = await confirmAssistantActions(actions, todayKey())
      setMessages((prev) => [...prev, { role: 'assistant', text: data.message }])
      setActiveImage(null)
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'error', text: displayError(err) }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="assistant-modal-overlay">
      <div className="assistant-modal">
        <div className="assistant-modal-header">
          <div>
            <span className="assistant-modal-title"><SparkleIcon size={19} /> Assistente</span>
            <p className="assistant-modal-subtitle">peça para criar, marcar ou atualizar algo</p>
          </div>
          <div className="assistant-modal-header-actions">
            {messages.length > 0 && (
              <button className="btn-icon assistant-modal-clear" onClick={() => { setMessages([]); setActiveImage(null) }} aria-label="Limpar conversa" title="Limpar conversa">
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

        {!pendingImage && activeImage && (
          <div className="assistant-image-preview">
            <img src={activeImage.previewUrl} alt="prévia do anexo em foco" />
            <span className="assistant-image-preview-name">ainda olhando essa imagem — some ao confirmar/cancelar</span>
            <button type="button" className="assistant-image-remove" onClick={() => setActiveImage(null)} aria-label="Parar de considerar a imagem">
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
          {speechSupported && (
            <button
              type="button"
              className={`assistant-mic-btn ${listening ? 'is-listening' : ''}`}
              onClick={toggleListening}
              disabled={!online}
              aria-label={listening ? 'Parar gravação' : 'Falar em vez de digitar'}
              title={listening ? 'Parar gravação' : 'Falar em vez de digitar'}
            >
              {listening ? (
                <span className={`assistant-mic-wave ${waveMeterFailed ? 'is-fallback' : ''}`} aria-hidden="true">
                  {waveLevels.map((lvl, i) => (
                    <span key={i} className="assistant-mic-wave-bar" style={{ height: `${4 + lvl * 15}px` }} />
                  ))}
                </span>
              ) : <RiMicLine size={19} />}
            </button>
          )}
          <textarea
            ref={inputRef}
            value={text}
            rows={1}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
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
