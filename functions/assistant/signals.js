// Mesma lógica de "vale a pena avisar" que já existe no banner da Home
// (client-side), só que rodando no servidor pra decidir se um push vale a
// pena mandar. Prioridade igual à da Home: tarefa vencida > hábito em risco
// > meta parada. Um sinal por dia, nunca mais — sem spam, sem genérico.
const STALLED_GOAL_DAYS = 10;
const HABIT_AT_RISK_MIN_STREAK = 3;

const base = (db, uid, col) => db.collection("users").doc(uid).collection(col);

const computeStreak = (habitId, logsByDate, today) => {
  const cursor = new Date(`${today}T00:00:00`);
  if (!logsByDate.get(today)?.[habitId]) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (true) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    const key = `${y}-${m}-${d}`;
    if (!logsByDate.get(key)?.[habitId]) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

// Retorna null (nada digno de nota hoje) ou { kind, data } com o fato bruto
// — quem transforma isso em texto é o Gemini, no chamador.
async function detectSignal(db, uid, clientDate) {
  const [todosSnap, habitsSnap, logSnap, goalsSnap] = await Promise.all([
    base(db, uid, "todos").where("done", "==", false).get(),
    base(db, uid, "habits").get(),
    base(db, uid, "habitLogs").doc(clientDate).get(),
    base(db, uid, "goals").where("done", "==", false).get(),
  ]);

  const overdue = todosSnap.docs
      .map((d) => d.data())
      .filter((t) => t.dueDate && t.dueDate < clientDate);
  if (overdue.length > 0) {
    return {kind: "overdue_tasks", data: {count: overdue.length, titles: overdue.slice(0, 3).map((t) => t.title)}};
  }

  const checked = logSnap.exists ? (logSnap.data().checked || {}) : {};
  const habits = habitsSnap.docs.map((d) => ({id: d.id, ...d.data()}));
  if (habits.length > 0) {
    const logsSnap = await base(db, uid, "habitLogs").orderBy("date", "desc").limit(60).get();
    const logsByDate = new Map(logsSnap.docs.map((d) => [d.id, d.data().checked || {}]));
    logsByDate.set(clientDate, checked);

    const atRisk = habits
        .map((h) => ({habit: h, streak: computeStreak(h.id, logsByDate, clientDate)}))
        .filter(({habit, streak}) => streak >= HABIT_AT_RISK_MIN_STREAK && !checked[habit.id])
        .sort((a, b) => b.streak - a.streak)[0];
    if (atRisk) {
      return {kind: "habit_at_risk", data: {name: atRisk.habit.name, streak: atRisk.streak}};
    }
  }

  const cutoffSec = Date.now() / 1000 - STALLED_GOAL_DAYS * 86400;
  const stalled = goalsSnap.docs
      .map((d) => ({title: d.data().title, ts: d.data().updatedAt?.seconds ?? d.data().createdAt?.seconds ?? null}))
      .filter(({ts}) => ts !== null && ts < cutoffSec)
      .sort((a, b) => a.ts - b.ts)[0];
  if (stalled) {
    const days = Math.floor((Date.now() / 1000 - stalled.ts) / 86400);
    return {kind: "stalled_goal", data: {title: stalled.title, days}};
  }

  return null;
}

module.exports = {detectSignal};
