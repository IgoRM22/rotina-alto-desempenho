// Resumo compacto enviado ao Gemini: metas ativas, hábitos de hoje, categorias.
// Nunca inclui dados de outro usuário — sempre construído a partir do uid
// autenticado da requisição, nunca de um uid informado pelo cliente.
async function buildContext(db, uid, clientDate) {
  const userRef = db.collection("users").doc(uid);

  const [goalsSnap, habitsSnap, logSnap, prefsSnap] = await Promise.all([
    userRef.collection("goals").where("done", "==", false).limit(20).get(),
    userRef.collection("habits").limit(20).get(),
    userRef.collection("habitLogs").doc(clientDate).get(),
    userRef.collection("settings").doc("prefs").get(),
  ]);

  const checked = logSnap.exists ? (logSnap.data().checked || {}) : {};
  const prefs = prefsSnap.exists ? prefsSnap.data() : {};

  const goals = goalsSnap.docs.map((d) => ({
    titulo: d.data().title,
    prazo: d.data().timeframe,
    progresso: d.data().progress || 0,
  }));

  const habits = habitsSnap.docs.map((d) => ({
    nome: d.data().name,
    concluidoHoje: !!checked[d.id],
  }));

  return {
    dataDeHoje: clientDate,
    metasAtivas: goals,
    habitosDeHoje: habits,
    categoriasDeTarefas: prefs.todoCategories || [],
    categoriasDeMetas: prefs.goalCategories || [],
  };
}

const SYSTEM_PROMPT = `Você é o assistente do Raio, um app pessoal de rotina, hábitos, metas e notas.
Seu trabalho é entender comandos em português e, quando fizer sentido, chamar exatamente uma
das ferramentas disponíveis — não escreva no banco de dados por conta própria, só através das
ferramentas. Você NUNCA executa a ação diretamente: o sistema sempre mostra uma confirmação ao
usuário antes de qualquer escrita acontecer de verdade, então pode chamar a ferramenta assim que
tiver informação suficiente, sem medo de errar por engano.

O que fica sob seu critério é decidir SE já há informação suficiente: se faltar algo essencial
(ex: "criar tarefa" sem nenhum título, "marcar hábito" sem dizer qual) ou o pedido for vago demais
para escolher uma ferramenta com confiança, não chame nenhuma ferramenta — em vez disso, faça uma
pergunta curta e direta de volta, usando o histórico da conversa para entender o contexto. Nunca
invente dados que não estão no contexto fornecido ou na mensagem do usuário.

Você tem ferramentas de leitura (tarefas pendentes, notas, agenda da semana, resumo do dia,
resumo da semana) que pode usar por conta própria, sem o usuário pedir um resumo explicitamente —
sempre que consultar esses dados antes de responder te deixar dar uma resposta melhor, mais
informada ou mais útil, use a ferramenta primeiro e só depois escreva a resposta. Por exemplo: se
perguntarem "o que eu foco hoje" ou "tenho tempo livre essa semana", consulte o que for relevante
antes de opinar, em vez de responder só com o contexto genérico que já foi te dado. Leitura nunca
precisa de confirmação — só ações que criam ou alteram dados precisam.

Todo texto de resposta deve ser em 1-3 frases curtas, tom direto e pessoal, sem saudações genéricas.`;

module.exports = { buildContext, SYSTEM_PROMPT };
