import { auth } from '../firebase'
import { ASSISTANT_API_URL } from '../config'

// requestId gerado no cliente: garante que uma retentativa de rede (timeout,
// reconexão) nunca faz o backend executar a mesma ação duas vezes.
const genRequestId = () => (
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
)

const callAssistant = async (body) => {
  const user = auth.currentUser
  if (!user) throw new Error('not-authenticated')

  const idToken = await user.getIdToken()

  const res = await fetch(ASSISTANT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ ...body, requestId: genRequestId() }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `assistant_error_${res.status}`)
  }
  return data
}

// history: últimas mensagens da conversa (texto puro), para o modelo manter
// contexto entre turnos — perguntas de acompanhamento, correções, etc.
// image (opcional): { data: base64 sem prefixo, mimeType } — ex: foto de um
// extrato, já redimensionada no cliente antes de chegar aqui.
export const runAssistantCommand = (command, clientDate, history, image) =>
  callAssistant({ command, clientDate, history, image })

// Executa de verdade uma ou mais ações que o usuário já confirmou no chat —
// sem tocar o Gemini, só o Firestore. `actions`: [{ tool, args }, ...].
export const confirmAssistantActions = (actions, clientDate) =>
  callAssistant({ confirm: true, actions, clientDate })
