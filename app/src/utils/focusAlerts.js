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

export const notifyPhaseEnd = (title, body) => {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    new Notification(title, { body, icon: '/rotina-alto-desempenho/icons/icon-192.png', tag: 'raio-pomodoro' })
  } catch { /* notificação local é só um extra — nunca deve quebrar o timer */ }
}

// Notificação do cronômetro em andamento — só funciona de verdade enquanto a
// aba está aberta (mesmo que em segundo plano): o navegador congela o JS de
// abas fechadas/suspensas, então isso não sobrevive fechar o app. Trocar o
// texto de uma notificação existente com `new Notification` no mesmo `tag`
// substitui a anterior em vez de empilhar uma nova a cada segundo.
let liveNotification = null

export const updateLiveFocusNotification = (title, body) => {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    liveNotification = new Notification(title, {
      body,
      icon: '/rotina-alto-desempenho/icons/icon-192.png',
      tag: 'raio-foco-live',
      silent: true,
      renotify: false,
    })
  } catch { /* segue sem notificação — o cronômetro em tela continua valendo */ }
}

export const closeLiveFocusNotification = () => {
  try {
    liveNotification?.close()
  } catch { /* nada a fazer */ }
  liveNotification = null
}
