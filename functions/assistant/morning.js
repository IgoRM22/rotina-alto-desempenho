// Dados brutos do "bom dia" — mesma ideia do signals.js (server decide o
// que existe, o Gemini só transforma em texto). Só retorna algo quando há
// pelo menos uma tarefa, hábito diário ou compromisso hoje — sem isso não
// há "o que tem no dia" pra mostrar, então nem vale acordar o usuário.
const base = (db, uid, col) => db.collection("users").doc(uid).collection(col);

const isDailyHabit = (habit) => !habit.weeklyTarget || habit.weeklyTarget >= 7;

// Versão simplificada de expandImportantDatesForRange (app/src/utils/importantDates.js)
// só pra "ocorre hoje?" — não precisa da expansão de intervalo completa que
// o cliente usa pra desenhar a agenda inteira.
const occursToday = (item, todayKey) => {
  if (!item.startDate || item.startDate > todayKey) return false;
  const recurrence = item.recurrence || "";
  if (!recurrence) return item.startDate === todayKey;

  const [ty, tm, td] = todayKey.split("-").map(Number);
  const [sy, sm, sd] = item.startDate.split("-").map(Number);
  if (recurrence === "yearly") return tm === sm && td === sd;
  if (recurrence === "monthly") return td === sd;
  if (recurrence === "weekly") {
    const start = new Date(sy, sm - 1, sd);
    const today = new Date(ty, tm - 1, td);
    const diffDays = Math.round((today - start) / 86400000);
    return diffDays >= 0 && diffDays % 7 === 0;
  }
  return false;
};

async function buildMorningData(db, uid, todayKey) {
  const [todosSnap, habitsSnap, datesSnap, dailyLogSnap] = await Promise.all([
    base(db, uid, "todos").where("todayDate", "==", todayKey).where("done", "==", false).get(),
    base(db, uid, "habits").get(),
    base(db, uid, "importantDates").get(),
    base(db, uid, "dailyLogs").doc(todayKey).get(),
  ]);

  const tasks = todosSnap.docs.map((d) => d.data());
  const dailyHabits = habitsSnap.docs.map((d) => d.data()).filter(isDailyHabit);
  const events = datesSnap.docs.map((d) => d.data()).filter((item) => occursToday(item, todayKey));
  const intention = dailyLogSnap.exists ? (dailyLogSnap.data().intention || null) : null;

  if (tasks.length === 0 && dailyHabits.length === 0 && events.length === 0 && !intention) {
    return null;
  }

  return {
    taskCount: tasks.length,
    taskTitles: tasks.slice(0, 3).map((t) => t.title),
    habitCount: dailyHabits.length,
    eventTitles: events.slice(0, 2).map((e) => e.title),
    intention,
  };
}

module.exports = {buildMorningData};
