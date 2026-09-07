const { FieldValue } = require("firebase-admin/firestore");

const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const pad2 = (v) => String(v).padStart(2, "0");
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

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

// Finanças usa um formato diferente do resto do app: um único doc com
// arrays dentro (banks/incomes/fixedExpenses/goals), indexados por posição
// em vez de subcoleção com IDs — espelha services/finances.js do frontend.
const financesDoc = (db, uid) => db.collection("users").doc(uid).collection("finances").doc("main");

const emptyFinances = () => ({ emergencyFund: 0, banks: [], incomes: [], fixedExpenses: [], goals: [] });

// Mesma lógica do findBestMatch, mas devolve o índice no array (necessário
// pra update/splice num array plano, sem IDs de documento).
const findArrayMatch = (list, field, query) => {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return {index: -1, reason: "empty"};

  const exactIdx = list.findIndex((item) => String(item[field] || "").trim().toLowerCase() === q);
  if (exactIdx !== -1) return {index: exactIdx, item: list[exactIdx], reason: "ok"};

  const partialIdxs = list
      .map((item, i) => i)
      .filter((i) => String(list[i][field] || "").toLowerCase().includes(q));
  if (partialIdxs.length === 1) return {index: partialIdxs[0], item: list[partialIdxs[0]], reason: "ok"};
  if (partialIdxs.length > 1) {
    return {index: -1, reason: "ambiguous", candidates: partialIdxs.map((i) => list[i][field])};
  }
  return {index: -1, reason: "not_found"};
};

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

    case "consultarTarefasPendentes": {
      const snap = await base(db, uid, "todos").where("done", "==", false).get();
      const todos = snap.docs.map((d) => ({
        title: d.data().title,
        category: d.data().category || null,
        dueDate: d.data().dueDate || null,
        priority: d.data().priority || null,
      }));
      return {ok: true, todos};
    }

    case "consultarNotas": {
      const [notesSnap, notebooksSnap] = await Promise.all([
        base(db, uid, "notes").orderBy("createdAt", "desc").limit(15).get(),
        base(db, uid, "notebooks").get(),
      ]);
      const notebookNames = new Map(notebooksSnap.docs.map((d) => [d.id, d.data().name]));
      const notes = notesSnap.docs.map((d) => ({
        title: d.data().title,
        preview: String(d.data().content || "").slice(0, 140),
        importance: d.data().importance || "media",
        notebook: notebookNames.get(d.data().notebookId) || null,
      }));
      return {ok: true, notes};
    }

    case "consultarAgendaSemana": {
      const {planKey} = weekMetaFor(clientDate);
      const snap = await base(db, uid, "schedule").get();
      const items = snap.docs
          .map((d) => d.data())
          .filter((item) => (!item.planScope || item.planScope === "week") && (!item.planKey || item.planKey === planKey))
          .map((item) => ({
            name: item.name,
            day: item.day || null,
            timeStart: item.timeStart || null,
            timeEnd: item.timeEnd || null,
            category: item.category || null,
            repeat: item.repeat || null,
          }));
      return {ok: true, items};
    }

    case "registrarDespesaFixa": {
      const description = String(args.descricao || "").trim();
      const amount = Number(args.valor);
      if (!description || !Number.isFinite(amount)) return {ok: false, error: "dados inválidos"};
      if (dryRun) return {ok: true, description, amount};

      const snap = await financesDoc(db, uid).get();
      const current = snap.exists ? snap.data() : emptyFinances();
      const fixedExpenses = [...(current.fixedExpenses || [])];
      fixedExpenses.push({description, amount, bank: args.banco || "", updatedAt: new Date().toISOString()});
      await financesDoc(db, uid).set({fixedExpenses}, {merge: true});
      return {ok: true, description, amount};
    }

    case "registrarRenda": {
      const description = String(args.descricao || "").trim();
      const gross = Number(args.valorBruto);
      const deductions = Number(args.descontos) || 0;
      if (!description || !Number.isFinite(gross)) return {ok: false, error: "dados inválidos"};
      const net = gross - deductions;
      if (dryRun) return {ok: true, description, net};

      const snap = await financesDoc(db, uid).get();
      const current = snap.exists ? snap.data() : emptyFinances();
      const incomes = [...(current.incomes || [])];
      incomes.push({description, gross, deductions, net, updatedAt: new Date().toISOString()});
      await financesDoc(db, uid).set({incomes}, {merge: true});
      return {ok: true, description, net};
    }

    case "atualizarSaldoBanco": {
      const bankName = String(args.banco || "").trim();
      const newBalance = Number(args.novoSaldo);
      if (!bankName || !Number.isFinite(newBalance)) return {ok: false, error: "dados inválidos"};

      const snap = await financesDoc(db, uid).get();
      const current = snap.exists ? snap.data() : emptyFinances();
      const banks = [...(current.banks || [])];
      const found = findArrayMatch(banks, "name", bankName);

      if (found.reason === "ambiguous") return {ok: false, error: found.reason, candidates: found.candidates};

      const isNew = found.index === -1;
      const resolvedName = isNew ? bankName : found.item.name;
      if (dryRun) return {ok: true, bankName: resolvedName, isNew, newBalance};

      if (isNew) {
        banks.push({name: bankName, balance: newBalance, updatedAt: new Date().toISOString()});
      } else {
        banks[found.index] = {...banks[found.index], balance: newBalance, updatedAt: new Date().toISOString()};
      }
      await financesDoc(db, uid).set({banks}, {merge: true});
      return {ok: true, bankName: resolvedName, isNew, newBalance};
    }

    case "criarMetaFinanceira": {
      const title = String(args.titulo || "").trim();
      const targetAmount = Number(args.valorAlvo);
      if (!title || !Number.isFinite(targetAmount)) return {ok: false, error: "dados inválidos"};
      const currentAmount = Number(args.valorAtual) || 0;
      if (dryRun) return {ok: true, title, targetAmount};

      const snap = await financesDoc(db, uid).get();
      const current = snap.exists ? snap.data() : emptyFinances();
      const goals = [...(current.goals || [])];
      goals.push({title, targetAmount, currentAmount, targetDate: args.prazoAlvo || "", updatedAt: new Date().toISOString()});
      await financesDoc(db, uid).set({goals}, {merge: true});
      return {ok: true, title, targetAmount};
    }

    case "consultarResumoFinanceiro": {
      const snap = await financesDoc(db, uid).get();
      const data = snap.exists ? snap.data() : emptyFinances();
      const totalBanks = (data.banks || []).reduce((sum, b) => sum + (b.balance || 0), 0);
      const totalIncome = (data.incomes || []).reduce((sum, i) => sum + (i.net || 0), 0);
      const totalExpenses = (data.fixedExpenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);
      return {
        ok: true,
        emergencyFund: data.emergencyFund || 0,
        totalBanks,
        totalIncome,
        totalExpenses,
        monthlyBalance: totalIncome - totalExpenses,
        goals: (data.goals || []).map((g) => ({title: g.title, currentAmount: g.currentAmount, targetAmount: g.targetAmount})),
      };
    }

    case "criarCompromissoImportante": {
      const title = String(args.titulo || "").trim();
      const startDate = args.dataInicio || "";
      if (!title || !DATE_KEY_RE.test(startDate)) return {ok: false, error: "dados inválidos"};
      if (dryRun) return {ok: true, title, startDate, type: args.tipo || "importante"};

      const data = {
        title,
        type: args.tipo || "importante",
        startDate,
        endDate: DATE_KEY_RE.test(args.dataFim || "") ? args.dataFim : "",
        description: args.descricao ? String(args.descricao).trim() : "",
        recurrence: ["weekly", "monthly", "yearly"].includes(args.recorrencia) ? args.recorrencia : "",
        createdAt: FieldValue.serverTimestamp(),
      };
      const ref = await base(db, uid, "importantDates").add(data);
      return {ok: true, id: ref.id, title, startDate, type: data.type};
    }

    case "consultarCompromissosImportantes": {
      const snap = await base(db, uid, "importantDates").orderBy("startDate", "asc").limit(30).get();
      const items = snap.docs.map((d) => ({
        title: d.data().title,
        type: d.data().type,
        startDate: d.data().startDate,
        endDate: d.data().endDate || null,
        recurrence: d.data().recurrence || null,
      }));
      return {ok: true, items};
    }

    case "criarRefeicao": {
      const title = String(args.titulo || "").trim();
      if (!title) return {ok: false, error: "título vazio"};
      if (dryRun) return {ok: true, title, time: args.horario || ""};

      const ref = await base(db, uid, "mealTables").add({
        time: args.horario || "",
        title,
        items: [],
        order: Date.now(),
        createdAt: FieldValue.serverTimestamp(),
      });
      return {ok: true, id: ref.id, title};
    }

    case "adicionarItemRefeicao": {
      const snap = await base(db, uid, "mealTables").get();
      const tables = snap.docs.map((d) => ({id: d.id, ...d.data()}));
      const found = findBestMatch(tables, "title", args.refeicao);
      if (!found.match) return {ok: false, error: found.reason, candidates: found.candidates};

      const itemName = String(args.nome || "").trim();
      if (!itemName) return {ok: false, error: "nome do alimento vazio"};
      if (dryRun) return {ok: true, mealTitle: found.match.title, itemName};

      const newItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        quantity: args.quantidade || "",
        name: itemName,
        grams: args.gramas || "",
        type: args.tipo || "",
      };
      await base(db, uid, "mealTables").doc(found.match.id).update({
        items: FieldValue.arrayUnion(newItem),
      });
      return {ok: true, mealTitle: found.match.title, itemName};
    }

    case "consultarPlanoAlimentar": {
      const snap = await base(db, uid, "mealTables").orderBy("order", "asc").get();
      const tables = snap.docs.map((d) => {
        const items = d.data().items || [];
        return {
          title: d.data().title,
          time: d.data().time || null,
          itemCount: items.length,
          items: items.slice(0, 6).map((i) => i.name),
        };
      });
      return {ok: true, tables};
    }

    case "registrarSessaoFoco": {
      const minutes = Math.round(Number(args.minutos));
      if (!Number.isFinite(minutes) || minutes <= 0) return {ok: false, error: "duração inválida"};

      let goalId = null;
      let goalTitle = null;
      if (args.meta) {
        const goalsSnap = await base(db, uid, "goals").where("done", "==", false).get();
        const goals = goalsSnap.docs.map((d) => ({id: d.id, ...d.data()}));
        const found = findBestMatch(goals, "title", args.meta);
        if (found.match) {
          goalId = found.match.id;
          goalTitle = found.match.title;
        }
      }

      if (dryRun) return {ok: true, minutes, goalTitle};

      await base(db, uid, "focusSessions").add({
        date: clientDate,
        minutes,
        goalId,
        createdAt: FieldValue.serverTimestamp(),
      });
      return {ok: true, minutes, goalTitle};
    }

    case "consultarResumoFoco": {
      const weekAgo = new Date(`${clientDate}T00:00:00`);
      weekAgo.setDate(weekAgo.getDate() - 6);
      const [sessionsSnap, goalsSnap] = await Promise.all([
        base(db, uid, "focusSessions").orderBy("createdAt", "desc").limit(200).get(),
        base(db, uid, "goals").get(),
      ]);
      const goalTitles = new Map(goalsSnap.docs.map((d) => [d.id, d.data().title]));
      const sessions = sessionsSnap.docs
          .map((d) => d.data())
          .filter((s) => s.date && s.date >= `${weekAgo.getFullYear()}-${pad2(weekAgo.getMonth() + 1)}-${pad2(weekAgo.getDate())}`);

      const todayMinutes = sessions.filter((s) => s.date === clientDate).reduce((sum, s) => sum + (s.minutes || 0), 0);
      const byGoal = new Map();
      sessions.forEach((s) => {
        const key = s.goalId ? (goalTitles.get(s.goalId) || "meta removida") : "sem meta vinculada";
        byGoal.set(key, (byGoal.get(key) || 0) + (s.minutes || 0));
      });

      return {
        ok: true,
        todayMinutes,
        weekByGoal: Array.from(byGoal.entries()).map(([title, minutes]) => ({title, minutes})),
      };
    }

    default:
      return {ok: false, error: `ferramenta desconhecida: ${name}`};
  }
}

module.exports = {executeTool, findBestMatch};
