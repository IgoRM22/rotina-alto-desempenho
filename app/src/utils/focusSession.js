// Sessão de foco em andamento vive só no localStorage do aparelho (não no
// Firestore) — por isso o assistente não consegue "iniciar" um foco como
// consegue criar uma tarefa: ele não tem acesso ao localStorage do servidor.
// O jeito de fazer isso funcionar pelo chat é o cliente (AssistantModal)
// escrever aqui e navegar pra página Foco, que lê essa mesma chave ao montar.
export const FOCUS_STORAGE_KEY = 'raio-foco-session'
// Disparado sempre que a sessão muda por fora da própria página Foco (ex: o
// assistente iniciando uma pelo chat enquanto a página já está montada) —
// `storage` (nativo) só dispara em OUTRAS abas, nunca na mesma aba que
// escreveu, então um evento custom é o único jeito de a página Foco notar.
export const FOCUS_SESSION_EVENT = 'raio-focus-session-changed'

export const loadStoredFocusSession = () => {
  try {
    const raw = localStorage.getItem(FOCUS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const storeFocusSession = (session) => {
  try {
    if (session) localStorage.setItem(FOCUS_STORAGE_KEY, JSON.stringify(session))
    else localStorage.removeItem(FOCUS_STORAGE_KEY)
  } catch { /* storage indisponível — timer segue só em memória */ }
  window.dispatchEvent(new Event(FOCUS_SESSION_EVENT))
}

// Sessão livre nova, substituindo qualquer sessão em andamento.
export const startLocalFocusSession = (goalId = null, habitId = null) => {
  const session = { mode: 'livre', startedAt: Date.now(), accumulatedSec: 0, goalId: goalId || null, habitId: habitId || null }
  storeFocusSession(session)
  return session
}

// Pomodoro novo (fase "foco"), usado pelo atalho de início rápido no menu —
// a duração de cada fase não mora na sessão, é lida de prefs ao vivo pela
// própria página Foco (ver Foco.jsx), então não precisa ser passada aqui.
export const startLocalPomodoroSession = (goalId = null, habitId = null) => {
  const session = {
    mode: 'pomodoro',
    phase: 'work',
    phaseStartedAt: Date.now(),
    phaseAccumulatedSec: 0,
    cyclesCompleted: 0,
    goalId: goalId || null,
    habitId: habitId || null,
  }
  storeFocusSession(session)
  return session
}

export const listenLocalFocusSession = (cb) => {
  const handler = () => cb(loadStoredFocusSession())
  window.addEventListener(FOCUS_SESSION_EVENT, handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener(FOCUS_SESSION_EVENT, handler)
    window.removeEventListener('storage', handler)
  }
}
