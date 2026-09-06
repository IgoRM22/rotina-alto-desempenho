const { FieldValue } = require("firebase-admin/firestore");

const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const pad2 = (v) => String(v).padStart(2, "0");

// Semana domingo-início, mesma convenção usada em Agenda.jsx (planKey "SW-<domingo>").
const weekMetaFor = (clientDate) => {
  const d = new Date(`${clientDate}T00:00:00`);
  const weekStart = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
  const key = `${weekStart.getFullYear()}-${pad2(weekStart.getMonth() + 1)}-${pad2(weekStart.getDate())}`;
  return { planKey: `SW-${key}` };
};

const getISOWeek = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

// Primeiro tenta correspondência exata (case-insensitive); senão, uma única
// correspondência parcial. Ambíguo ou ausente vira null — o modelo relata
// isso de volta ao usuário em vez de adivinhar qual item foi citado.
const findBestMatch = (list, field, query) => {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return { match: null, reason: "empty" };

  const exact = list.filter((item) => String(item[field] || "").trim().toLowerCase() === q);
  if (exact.length === 1) return { match: exact[0], reason: "ok" };

  const partial = list.filter((item) => String(item[field] || "").toLowerCase().includes(q));
  if (partial.length === 1) return { match: partial[0], reason: "ok" };
  if (partial.length > 1) return { match: null, reason: "ambiguous", candidates: partial.map((i) => i[field]) };
  return { match: null, reason: "not_found" };
};

const base = (db, uid, col) => db.collection("users").doc(uid).collection(col);

// dryRun=true resolve e valida tudo (inclusive leituras de correspondência
// fuzzy) mas nunca escreve no Firestore — é o "preview" mostrado antes da
// confirmação. dryRun=false é a execução de verdade, chamada só depois que
// o usuário confirma explicitamente no chat.
async function executeTool(db, uid, clientDate, name, args, {dryRun = false} = {}) {
  switch (name) {
    case "criarTarefa": {
      const title = String(args.titulo || "").trim();
      if (!title) return {ok: false, error: "título vazio"};
      if (dryRun) {
        return {
          ok: true,
          title,
          preview: {
            category: args.categoria || null,
            dueDate: args.prazo || null,
            priority: args.prioridade || null,
            today: !!args.marcarParaHoje,
          },
        };
      }
      const data = {title, done: false, createdAt: FieldValue.serverTimestamp()};
      if (args.categoria) data.category = String(args.categoria).trim().toLowerCase();
      if (args.prazo) data.dueDate = args.prazo;
      if (args.prioridade) data.priority = args.prioridade;
      if (args.marcarParaHoje) data.todayDate = clientDate;
      const ref = await base(db, uid, "todos").add(data);
      return {ok: true, id: ref.id, title};
    }

    case "concluirTarefa": {
      const snap = await base(db, uid, "todos").where("done", "==", false).get();
      const todos = snap.docs.map((d) => ({id: d.id, ...d.data()}));
      const found = findBestMatch(todos, "title", args.titulo);
      if (!found.match) return {ok: false, error: found.reason, candidates: found.candidates};
      if (!dryRun) await base(db, uid, "todos").doc(found.match.id).update({done: true});
      return {ok: true, title: found.match.title};
    }

    case "marcarHabito": {
      const snap = await base(db, uid, "habits").get();
      const habits = snap.docs.map((d) => ({id: d.id, ...d.data()}));
      const found = findBestMatch(habits, "name", args.nome);
      if (!found.match) return {ok: false, error: found.reason, candidates: found.candidates};
      const date = args.data || clientDate;
      if (!dryRun) {
        await base(db, uid, "habitLogs").doc(date).set(
            {date, checked: {[found.match.id]: true}, updatedAt: FieldValue.serverTimestamp()},
            {merge: true},
        );
      }
      return {ok: true, name: found.match.name, date};
    }

    case "criarNota": {
      const title = String(args.titulo || "").trim();
      if (!title) return {ok: false, error: "título vazio"};

      let notebookId = null;
      let notebookName = null;
      if (args.caderno) {
        const nbSnap = await base(db, uid, "notebooks").get();
        const notebooks = nbSnap.docs.map((d) => ({id: d.id, ...d.data()}));
        const found = findBestMatch(notebooks, "name", args.caderno);
        if (found.match) {
          notebookId = found.match.id;
          notebookName = found.match.name;
        }
      }

      if (dryRun) return {ok: true, title, notebook: notebookName};

      const data = {
        title,
        content: args.conteudo ? String(args.conteudo) : "",
        importance: args.importancia || "media",
        notebookId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      const ref = await base(db, uid, "notes").add(data);
      return {ok: true, id: ref.id, title, notebook: notebookName};
    }

    case "criarMeta": {
      const title = String(args.titulo || "").trim();
      if (!title) return {ok: false, error: "título vazio"};
      if (dryRun) return {ok: true, title};

      const timeframe = args.periodo || "mes";
      const data = {
        title,
        description: "",
        commitment: args.compromisso ? String(args.compromisso).trim() : "",
        linkedHabitIds: [],
        timeframe,
        category: args.categoria ? String(args.categoria).trim().toLowerCase() : "projeto",
        progress: 0,
        done: false,
        targetDate: args.prazoAlvo || "",
        createdAt: FieldValue.serverTimestamp(),
      };
      if (timeframe !== "longo_prazo") {
        const d = new Date(`${clientDate}T00:00:00`);
        data.year = d.getFullYear();
        if (timeframe === "semana") data.week = getISOWeek(d);
        if (timeframe === "mes") data.month = d.getMonth();
        if (timeframe === "trimestre") data.quarter = Math.ceil((d.getMonth() + 1) / 3);
      }
      const ref = await base(db, uid, "goals").add(data);
      return {ok: true, id: ref.id, title};
    }

    case "atualizarProgressoMeta": {
      const snap = await base(db, uid, "goals").where("done", "==", false).get();
      const goals = snap.docs.map((d) => ({id: d.id, ...d.data()}));
      const found = findBestMatch(goals, "title", args.titulo);
      if (!found.match) return {ok: false, error: found.reason, candidates: found.candidates};
      const progress = Math.max(0, Math.min(100, Number(args.progresso) || 0));
      if (!dryRun) {
        await base(db, uid, "goals").doc(found.match.id).update({
          progress,
          done: progress >= 100,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      return {ok: true, title: found.match.title, progress};
    }

    case "criarItemAgenda": {
      const name = String(args.nome || "").trim();
      if (!name) return {ok: false, error: "nome vazio"};
      const day = DAYS.includes(args.dia) ? args.dia : DAYS[new Date(`${clientDate}T00:00:00`).getDay()];
      if (dryRun) return {ok: true, name, day};

      const {planKey} = weekMetaFor(clientDate);
      const data = {
        name,
        day,
        timeStart: args.horarioInicio || "",
        timeEnd: args.horarioFim || "",
        category: args.categoria ? String(args.categoria).trim().toLowerCase() : "projeto",
        description: "",
        repeat: ["daily", "weekdays", "weekend"].includes(args.recorrencia) ? args.recorrencia : "",
        repeatDays: [],
        planScope: "week",
        planKey,
        createdAt: FieldValue.serverTimestamp(),
      };
      const ref = await base(db, uid, "schedule").add(data);
      return {ok: true, id: ref.id, name, day};
    }

    case "consultarResumoDoDia": {
      const [todosSnap, habitsSnap, logSnap] = await Promise.all([
        base(db, uid, "todos").where("todayDate", "==", clientDate).get(),
        base(db, uid, "habits").get(),
        base(db, uid, "habitLogs").doc(clientDate).get(),
      ]);
      const todos = todosSnap.docs.map((d) => ({title: d.data().title, done: d.data().done}));
      const checked = logSnap.exists ? (logSnap.data().checked || {}) : {};
      const habits = habitsSnap.docs.map((d) => ({name: d.data().name, done: !!checked[d.id]}));
      return {ok: true, date: clientDate, todos, habits};
    }

    case "resumirSemana": {
      const weekAgo = new Date(`${clientDate}T00:00:00`);
      weekAgo.setDate(weekAgo.getDate() - 6);
      const weekKeys = Array.from({length: 7}, (_, i) => {
        const d = new Date(weekAgo);
        d.setDate(d.getDate() + i);
        return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
      });

      const [goalsSnap, habitsSnap, logsSnap] = await Promise.all([
        base(db, uid, "goals").where("done", "==", false).get(),
        base(db, uid, "habits").get(),
        weekKeys.length
          ? base(db, uid, "habitLogs").where("__name__", "in", weekKeys).get()
          : Promise.resolve({docs: []}),
      ]);

      const goals = goalsSnap.docs.map((d) => ({title: d.data().title, progress: d.data().progress || 0}));
      const logsByDate = new Map(logsSnap.docs.map((d) => [d.id, d.data().checked || {}]));
      const habits = habitsSnap.docs.map((d) => {
        const doneDays = weekKeys.filter((k) => logsByDate.get(k)?.[d.id]).length;
        return {name: d.data().name, doneDays, totalDays: weekKeys.length};
      });

      return {ok: true, goals, habits};
    }

    default:
      return {ok: false, error: `ferramenta desconhecida: ${name}`};
  }
}

module.exports = {executeTool, findBestMatch};
