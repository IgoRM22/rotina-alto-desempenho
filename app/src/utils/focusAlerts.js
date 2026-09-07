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
