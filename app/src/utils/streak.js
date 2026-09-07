import { dateKeyFromDate } from './date'

// Um hábito "diário" (weeklyTarget 7 ou sem o campo, pra não quebrar hábitos
// criados antes dessa feature) usa sequência em dias — os outros (ex: 3x por
// semana) usam sequência em semanas, calculada mais abaixo.
export const isDailyHabit = (habit) => !habit.weeklyTarget || habit.weeklyTarget >= 7

// Sequência atual de um hábito diário: conta para trás a partir de hoje (ou
// de ontem, se hoje ainda não foi marcado — o dia em andamento não quebra a
// sequência).
export const computeStreak = (habitId, logsByDate, today) => {
  const cursor = new Date(`${today}T00:00:00`)
  if (!logsByDate.get(today)?.[habitId]) {
    cursor.setDate(cursor.getDate() - 1)
  }

  let streak = 0
  while (true) {
    const key = dateKeyFromDate(cursor)
    if (!logsByDate.get(key)?.[habitId]) break
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

const weekStartOf = (date) => {
  const start = new Date(date)
  start.setDate(start.getDate() - start.getDay())
  start.setHours(0, 0, 0, 0)
  return start
}

// Quantos dias marcados um hábito tem numa semana (domingo-sábado) — se
// `limitDate` for passado, para de contar depois dele (usado pra semana
// atual, que ainda não terminou).
const countCheckedInWeek = (habitId, logsByDate, weekStart, limitDate) => {
  let count = 0
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    if (limitDate && d > limitDate) break
    if (logsByDate.get(dateKeyFromDate(d))?.[habitId]) count += 1
  }
  return count
}

// Progresso da semana atual (domingo até hoje) — o que sustenta o "2/3 essa
// semana" na UI em vez de um checkbox diário pra hábitos não-diários.
export const weekProgress = (habitId, logsByDate, today) => {
  const todayDate = new Date(`${today}T00:00:00`)
  const start = weekStartOf(todayDate)
  return countCheckedInWeek(habitId, logsByDate, start, todayDate)
}

// Sequência em semanas consecutivas batendo a meta — equivalente ao "streak"
// de dias, só que pra hábitos com frequência semanal. A semana atual conta
// assim que a meta é atingida (não precisa esperar acabar a semana); semanas
// anteriores só contam se realmente bateram a meta com os 7 dias completos.
export const computeWeeklyStreak = (habitId, logsByDate, today, weeklyTarget) => {
  const todayDate = new Date(`${today}T00:00:00`)
  const currentWeekStart = weekStartOf(todayDate)

  let streak = 0
  if (countCheckedInWeek(habitId, logsByDate, currentWeekStart, todayDate) >= weeklyTarget) {
    streak += 1
  }

  const cursor = new Date(currentWeekStart)
  cursor.setDate(cursor.getDate() - 7)
  while (true) {
    if (countCheckedInWeek(habitId, logsByDate, cursor, null) < weeklyTarget) break
    streak += 1
    cursor.setDate(cursor.getDate() - 7)
  }
  return streak
}

// Melhor sequência atual entre os hábitos DIÁRIOS (para o hero da Home) —
// hábitos com meta semanal ficam de fora aqui de propósito: misturar "12
// dias seguidos" com "3 semanas seguidas" na mesma métrica não faz sentido.
export const bestCurrentStreak = (habits, logsByDate, today) => {
  let best = null
  habits.filter(isDailyHabit).forEach((habit) => {
    const streak = computeStreak(habit.id, logsByDate, today)
    if (!best || streak > best.streak) best = { habit, streak }
  })
  return best
}
