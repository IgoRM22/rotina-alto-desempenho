// Sistema de XP/nível/conquistas — tudo DERIVADO dos dados que já existem
// (tarefas concluídas, check-ins de hábito, minutos de foco, metas batidas),
// sem nenhuma coleção nova no Firestore. Isso evita duplicar estado (o XP
// nunca pode "dessincronizar" do que realmente aconteceu) e segue o achado
// da pesquisa de gamificação ética: recompensa progresso, nunca subtrai por
// falha (perder uma sequência não tira XP já ganho).
// Exportados pra UI poder mostrar "+X XP" no exato instante da ação (toast
// de tarefa/hábito/foco/meta) — o valor mostrado é sempre o mesmo usado no
// cálculo real, nunca um número solto digitado à parte em outro arquivo.
export const XP_PER_TASK = 5
export const XP_PER_HABIT_CHECK = 8
export const XP_PER_FOCUS_MINUTE = 0.5
export const XP_PER_GOAL_DONE = 40
export const XP_PER_BEST_STREAK_DAY = 2 // bônus só pelo recorde já alcançado, não recalculado toda vez

const LEVEL_STEP = 400 // XP necessário por nível (curva linear simples, previsível)

export function computeXp({ todos = [], habitLogs = [], focusSessions = [], goals = [], habits = [] }) {
  const tasksXp = todos.filter((t) => t.done).length * XP_PER_TASK

  const habitChecksXp = habitLogs.reduce((sum, log) => {
    const checked = log.checked || {}
    return sum + Object.values(checked).filter(Boolean).length
  }, 0) * XP_PER_HABIT_CHECK

  const focusMinutes = focusSessions.reduce((sum, s) => sum + (s.minutes || 0), 0)
  const focusXp = Math.round(focusMinutes * XP_PER_FOCUS_MINUTE)

  const goalsXp = goals.filter((g) => g.done || (g.progress || 0) >= 100).length * XP_PER_GOAL_DONE

  const streakXp = habits.reduce((sum, h) => sum + Math.max(h.bestStreak || 0, h.bestWeeklyStreak || 0), 0) * XP_PER_BEST_STREAK_DAY

  const xp = tasksXp + habitChecksXp + focusXp + goalsXp + streakXp
  const level = Math.floor(xp / LEVEL_STEP) + 1
  const xpIntoLevel = xp % LEVEL_STEP
  const pct = Math.round((xpIntoLevel / LEVEL_STEP) * 100)

  return { xp, level, xpIntoLevel, xpToNext: LEVEL_STEP - xpIntoLevel, pct, breakdown: { tasksXp, habitChecksXp, focusXp, goalsXp, streakXp }, focusMinutes }
}

// Conquistas só de progresso positivo — nenhuma "você falhou". Uma vez
// ganha, fica ganha (não existe des-conquistar).
export function computeBadges({ todos = [], habits = [], focusSessions = [], goals = [] }) {
  const tasksDone = todos.filter((t) => t.done).length
  const focusMinutes = focusSessions.reduce((sum, s) => sum + (s.minutes || 0), 0)
  const bestStreakOverall = habits.reduce((max, h) => Math.max(max, h.bestStreak || 0, h.bestWeeklyStreak || 0), 0)
  const goalsDone = goals.filter((g) => g.done || (g.progress || 0) >= 100).length

  return [
    { id: 'primeira-semana', label: '7 dias seguidos', emoji: '🔥', earned: bestStreakOverall >= 7 },
    { id: 'um-mes', label: '30 dias seguidos', emoji: '🏆', earned: bestStreakOverall >= 30 },
    { id: 'cem-dias', label: '100 dias seguidos', emoji: '💎', earned: bestStreakOverall >= 100 },
    { id: 'produtivo', label: '50 tarefas concluídas', emoji: '✅', earned: tasksDone >= 50 },
    { id: 'muito-produtivo', label: '200 tarefas concluídas', emoji: '⚡', earned: tasksDone >= 200 },
    { id: 'foco-10h', label: '10h de foco', emoji: '🎯', earned: focusMinutes >= 600 },
    { id: 'foco-50h', label: '50h de foco', emoji: '🧠', earned: focusMinutes >= 3000 },
    { id: 'meta-batida', label: 'Primeira meta batida', emoji: '🚀', earned: goalsDone >= 1 },
    { id: 'metas-x5', label: '5 metas batidas', emoji: '🏅', earned: goalsDone >= 5 },
  ]
}
