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
export const runAssistantCommand = (command, clientDate, history) =>
  callAssistant({ command, clientDate, history })

// Executa de verdade uma ação que o usuário já confirmou no chat — sem
// tocar o Gemini, só o Firestore.
export const confirmAssistantAction = (tool, args, clientDate) =>
  callAssistant({ confirm: true, tool, args, clientDate })
