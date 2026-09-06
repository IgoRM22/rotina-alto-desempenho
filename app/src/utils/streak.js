import { dateKeyFromDate } from './date'

// Sequência atual de um hábito: conta para trás a partir de hoje (ou de ontem,
// se hoje ainda não foi marcado — o dia em andamento não quebra a sequência).
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

// Melhor sequência atual entre todos os hábitos (para o hero da Home).
export const bestCurrentStreak = (habits, logsByDate, today) => {
  let best = null
  habits.forEach((habit) => {
    const streak = computeStreak(habit.id, logsByDate, today)
    if (!best || streak > best.streak) best = { habit, streak }
  })
  return best
}
