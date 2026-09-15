// Som e vibração de fim de ciclo — gerados na hora (Web Audio), sem precisar
// de nenhum arquivo de áudio. Cada função falha em silêncio se a API não
// existir ou o navegador bloquear (ex: sem interação do usuário ainda).
export const playChime = () => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const beep = (freq, startAt, duration) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.001, ctx.currentTime + startAt)
      gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + startAt + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + duration)
      osc.start(ctx.currentTime + startAt)
      osc.stop(ctx.currentTime + startAt + duration)
    }
    beep(880, 0, 0.35)
    beep(1108, 0.18, 0.45)
    setTimeout(() => ctx.close().catch(() => {}), 900)
  } catch { /* sem suporte a Web Audio — segue sem som */ }
}

export const vibrateDevice = () => {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([200, 100, 200])
  } catch { /* iOS Safari nunca implementou a Vibration API — silenciosamente ignora */ }
}

// Navegadores mobile (Chrome/Android incluso, e qualquer PWA instalado) não
// implementam o construtor `new Notification(...)` — só desktop aceita. Sem
// isso, a notificação nunca aparecia no celular (o try/catch engolia o erro
// silenciosamente, então nem dava pra perceber que tinha quebrado). Em
// qualquer lugar com service worker é preciso passar pelo registro dele
// (`showNotification`) — ver o mesmo padrão em useDeadlineNotifications.js.
const showViaServiceWorker = async (title, options) => {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready
      await registration.showNotification(title, options)
      return
    }
    // eslint-disable-next-line no-new
    new Notification(title, options)
  } catch { /* notificação local é só um extra — nunca deve quebrar o timer */ }
}

export const notifyPhaseEnd = (title, body) => {
  showViaServiceWorker(title, { body, icon: '/rotina-alto-desempenho/icons/icon-192.png', tag: 'raio-pomodoro' })
}

// Notificação do cronômetro em andamento — só funciona de verdade enquanto a
// aba está aberta (mesmo que em segundo plano): o navegador congela o JS de
// abas fechadas/suspensas, então isso não sobrevive fechar o app. Mesmo
// `tag` substitui a notificação anterior em vez de empilhar uma nova a cada
// segundo — via service worker isso funciona pelo `tag` da própria opção,
// sem precisar guardar referência ao objeto (que `showNotification` não
// retorna, ao contrário do construtor `new Notification`).
export const updateLiveFocusNotification = (title, body) => {
  showViaServiceWorker(title, {
    body,
    icon: '/rotina-alto-desempenho/icons/icon-192.png',
    tag: 'raio-foco-live',
    silent: true,
    renotify: false,
  })
}

export const closeLiveFocusNotification = () => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  navigator.serviceWorker.ready
    .then((registration) => registration.getNotifications({ tag: 'raio-foco-live' }))
    .then((notifications) => notifications.forEach((n) => n.close()))
    .catch(() => {})
}
