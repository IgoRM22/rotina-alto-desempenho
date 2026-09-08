// Ferramentas de "leitura" precisam do modelo para transformar dados em prosa —
// as de escrita não: o resultado já é estruturado o bastante para uma frase
// determinística, o que evita uma segunda chamada ao Gemini (e metade da
// latência) na grande maioria dos comandos.
const READ_TOOLS = new Set([
  "consultarResumoDoDia",
  "resumirSemana",
  "consultarTarefasPendentes",
  "consultarNotas",
  "consultarAgendaSemana",
  "consultarResumoFinanceiro",
  "consultarCompromissosImportantes",
  "consultarPlanoAlimentar",
  "consultarResumoFoco",
]);

const isReadTool = (name) => READ_TOOLS.has(name);

const brlFormatter = new Intl.NumberFormat("pt-BR", {style: "currency", currency: "BRL"});
const brl = (n) => brlFormatter.format(Number(n) || 0);

const IMPORTANT_TYPE_LABELS = {
  feriado: "feriado",
  aniversario: "aniversário",
  ferias: "férias",
  importante: "data importante",
  outros: "evento",
};
const typeLabel = (type) => IMPORTANT_TYPE_LABELS[type] || "evento";

const changeSummary = (changes) => {
  const parts = [];
  if (changes.dueDate) parts.push(`prazo ${changes.dueDate}`);
  if (changes.priority) parts.push(`prioridade ${changes.priority}`);
  if (changes.category) parts.push(`categoria ${changes.category}`);
  return parts.join(", ");
};

const dailyLogSummary = (result) => {
  const parts = [];
  if (result.sleepQuality) parts.push(`sono ${result.sleepQuality}/5`);
  if (result.energy) parts.push(`energia ${result.energy}/5`);
  if (result.note) parts.push("nota registrada");
  return parts.join(", ");
};

const ANNOTATION_TAG_LABELS = {funcionou: "o que funcionou", ajustar: "o que ajustar", rabisco: "rabisco"};

const goalChangeSummary = (changes) => {
  const parts = [];
  if (changes.title) parts.push(`título "${changes.title}"`);
  if (changes.description !== undefined) parts.push("descrição atualizada");
  if (changes.commitment !== undefined) parts.push("compromisso atualizado");
  if (changes.category) parts.push(`categoria ${changes.category}`);
  if (changes.targetDate) parts.push(`prazo ${changes.targetDate}`);
  return parts.join(", ");
};

const agendaChangeSummary = (changes) => {
  const parts = [];
  if (changes.name) parts.push(`nome "${changes.name}"`);
  if (changes.day) parts.push(`dia ${changes.day}`);
  if (changes.timeStart) parts.push(`início ${changes.timeStart}`);
  if (changes.timeEnd) parts.push(`fim ${changes.timeEnd}`);
  if (changes.category) parts.push(`categoria ${changes.category}`);
  return parts.join(", ");
};

const importantDateChangeSummary = (changes) => {
  const parts = [];
  if (changes.title) parts.push(`título "${changes.title}"`);
  if (changes.type) parts.push(`tipo ${typeLabel(changes.type)}`);
  if (changes.startDate) parts.push(`data ${changes.startDate}`);
  if (changes.endDate) parts.push(`até ${changes.endDate}`);
  if (changes.description !== undefined) parts.push("descrição atualizada");
  return parts.join(", ");
};

const mealItemChangeSummary = (changes) => {
  const parts = [];
  if (changes.quantity) parts.push(`quantidade ${changes.quantity}`);
  if (changes.grams) parts.push(changes.grams);
  if (changes.type) parts.push(`tipo ${changes.type}`);
  return parts.join(", ");
};

function formatWriteConfirmation(name, result) {
  if (!result.ok) {
    if (result.reason === "ambiguous") {
      return `Encontrei mais de uma correspondência (${(result.candidates || []).join(", ")}) — seja mais específico.`;
    }
    if (result.reason === "not_found") {
      return "Não encontrei nada parecido com isso. Confere o nome e tenta de novo?";
    }
    return "Não consegui completar isso — tenta reformular o comando?";
  }

  switch (name) {
    case "criarTarefa":
      return `Tarefa "${result.title}" criada.`;
    case "concluirTarefa":
      return `"${result.title}" marcada como concluída.`;
    case "reagendarTarefa":
      return `"${result.title}" atualizada (${changeSummary(result.changes)}).`;
    case "excluirTarefa":
      return `Tarefa "${result.title}" excluída.`;
    case "criarHabito":
      return `Hábito "${result.name}" criado${result.weeklyTarget < 7 ? ` (${result.weeklyTarget}x por semana)` : ""}.`;
    case "excluirHabito":
      return `Hábito "${result.name}" excluído.`;
    case "marcarHabito":
      return `"${result.name}" registrado como cumprido${result.date ? ` em ${result.date}` : ""}.`;
    case "desmarcarHabito":
      return `"${result.name}" desmarcado${result.date ? ` em ${result.date}` : ""}.`;
    case "registrarLogDiario":
      return `Registro do dia atualizado (${dailyLogSummary(result)}).`;
    case "registrarAnotacaoSemanal":
      return `Anotação de "${ANNOTATION_TAG_LABELS[result.tag]}" registrada.`;
    case "adicionarFocoSemana":
      return `"${result.text}" adicionado ao foco da próxima semana.`;
    case "removerFocoSemana":
      return `"${result.text}" removido do foco da semana.`;
    case "criarNota":
      return `Nota "${result.title}" criada${result.notebook ? ` em ${result.notebook}` : ""}.`;
    case "editarNota":
      return `Nota "${result.title}" atualizada${result.notebook ? ` (movida para ${result.notebook})` : ""}.`;
    case "excluirNota":
      return `Nota "${result.title}" excluída.`;
    case "criarCaderno":
      return `Caderno "${result.name}" criado.`;
    case "excluirCaderno":
      return `Caderno "${result.name}" excluído.`;
    case "criarMeta":
      return `Meta "${result.title}" criada.`;
    case "atualizarProgressoMeta":
      return `"${result.title}" agora em ${result.progress}%.`;
    case "editarMeta":
      return `"${result.title}" atualizada (${goalChangeSummary(result.changes)}).`;
    case "excluirMeta":
      return `Meta "${result.title}" excluída.`;
    case "criarItemAgenda":
      return `"${result.name}" adicionado à agenda de ${result.day}.`;
    case "editarItemAgenda":
      return `"${result.name}" atualizado (${agendaChangeSummary(result.changes)}).`;
    case "excluirItemAgenda":
      return `"${result.name}" removido da agenda.`;
    case "registrarDespesaFixa":
      return `Despesa "${result.description}" (${brl(result.amount)}/mês) registrada.`;
    case "registrarDespesasEmLote":
      return `${result.count} despesa${result.count > 1 ? "s" : ""} registrada${result.count > 1 ? "s" : ""} (total ${brl(result.total)}/mês).`;
    case "registrarRenda":
      return `Renda "${result.description}" registrada (líquido ${brl(result.net)}).`;
    case "atualizarSaldoBanco":
      return `${result.isNew ? "Banco criado" : "Saldo atualizado"}: "${result.bankName}" agora em ${brl(result.newBalance)}.`;
    case "criarMetaFinanceira":
      return `Meta financeira "${result.title}" criada (${brl(result.targetAmount)}).`;
    case "atualizarFundoEmergencia":
      return `Reserva de emergência atualizada para ${brl(result.amount)}.`;
    case "atualizarMetaFinanceira":
      return `"${result.title}" atualizada para ${brl(result.currentAmount)} de ${brl(result.targetAmount)}.`;
    case "criarCompromissoImportante":
      return `"${result.title}" (${typeLabel(result.type)}) criado para ${result.startDate}.`;
    case "editarDataImportante":
      return `"${result.title}" atualizado (${importantDateChangeSummary(result.changes)}).`;
    case "excluirCompromissoImportante":
      return `"${result.title}" excluído.`;
    case "criarRefeicao":
      return `Refeição "${result.title}" criada.`;
    case "adicionarItemRefeicao":
      return `"${result.itemName}" adicionado em "${result.mealTitle}".`;
    case "editarItemRefeicao":
      return `"${result.itemName}" atualizado em "${result.mealTitle}" (${mealItemChangeSummary(result.changes)}).`;
    case "removerItemRefeicao":
      return `"${result.itemName}" removido de "${result.mealTitle}".`;
    case "registrarSessaoFoco":
      return `Sessão de ${result.minutes} min registrada${result.goalTitle ? ` em "${result.goalTitle}"` : ""}.`;
    case "iniciarFoco":
      return `Foco iniciado${result.goalTitle ? ` — vinculado a "${result.goalTitle}"` : ""}.`;
    case "fecharMes":
      return `Mês ${result.month} fechado (saldo ${brl(result.monthlyBalance)}).`;
    case "excluirFechamentoMensal":
      return `Fechamento de ${result.month} removido.`;
    default:
      return "Feito.";
  }
}

// Pergunta de confirmação mostrada ANTES de qualquer escrita — o usuário
// precisa aprovar explicitamente (botão no chat) antes da ação acontecer de
// verdade. `result` aqui é sempre o retorno de executeTool em modo dryRun.
function formatConfirmationPrompt(name, args, result) {
  switch (name) {
    case "criarTarefa": {
      const extra = [];
      if (args.prazo) extra.push(`prazo ${args.prazo}`);
      if (args.categoria) extra.push(`categoria ${args.categoria}`);
      if (args.marcarParaHoje) extra.push("marcada para hoje");
      return `Confirma criar a tarefa "${result.title}"${extra.length ? ` (${extra.join(", ")})` : ""}?`;
    }
    case "concluirTarefa":
      return `Confirma marcar "${result.title}" como concluída?`;
    case "reagendarTarefa":
      return `Confirma atualizar "${result.title}" (${changeSummary(result.changes)})?`;
    case "excluirTarefa":
      return `Confirma excluir a tarefa "${result.title}"? Essa ação não pode ser desfeita.`;
    case "criarHabito":
      return `Confirma criar o hábito "${result.name}"${result.weeklyTarget < 7 ? ` (${result.weeklyTarget}x por semana)` : ""}?`;
    case "excluirHabito":
      return `Confirma excluir o hábito "${result.name}"? O histórico de sequência dele se perde.`;
    case "marcarHabito":
      return `Confirma registrar "${result.name}" como cumprido${result.date ? ` em ${result.date}` : ""}?`;
    case "desmarcarHabito":
      return `Confirma desmarcar "${result.name}"${result.date ? ` em ${result.date}` : ""}?`;
    case "registrarLogDiario":
      return `Confirma registrar (${dailyLogSummary(result)})${result.note ? ` — nota: "${result.note}"` : ""}?`;
    case "registrarAnotacaoSemanal":
      return `Confirma registrar em "${ANNOTATION_TAG_LABELS[result.tag]}": "${result.text}"?`;
    case "adicionarFocoSemana":
      return `Confirma adicionar "${result.text}" ao foco da próxima semana?`;
    case "removerFocoSemana":
      return `Confirma remover "${result.text}" do foco da semana?`;
    case "criarNota":
      return `Confirma criar a nota "${result.title}"${result.notebook ? ` em ${result.notebook}` : ""}?`;
    case "editarNota":
      return `Confirma atualizar a nota "${result.title}"${result.notebook ? ` (mover para ${result.notebook})` : ""}?`;
    case "excluirNota":
      return `Confirma excluir a nota "${result.title}"? Essa ação não pode ser desfeita.`;
    case "criarCaderno":
      return `Confirma criar o caderno "${result.name}"?`;
    case "excluirCaderno":
      return `Confirma excluir o caderno "${result.name}"? As notas dentro dele não são apagadas, só ficam sem caderno.`;
    case "criarMeta":
      return `Confirma criar a meta "${result.title}"?`;
    case "atualizarProgressoMeta":
      return `Confirma atualizar "${result.title}" para ${result.progress}%?`;
    case "editarMeta":
      return `Confirma atualizar "${result.title}" (${goalChangeSummary(result.changes)})?`;
    case "excluirMeta":
      return `Confirma excluir a meta "${result.title}"? Essa ação não pode ser desfeita.`;
    case "criarItemAgenda":
      return `Confirma adicionar "${result.name}" à agenda de ${result.day}${args.horarioInicio ? ` às ${args.horarioInicio}` : ""}${args.semana === "proxima" ? " (semana que vem)" : ""}?`;
    case "editarItemAgenda":
      return `Confirma atualizar "${result.name}" (${agendaChangeSummary(result.changes)})?`;
    case "excluirItemAgenda":
      return `Confirma remover "${result.name}" da agenda? Essa ação não pode ser desfeita.`;
    case "registrarDespesaFixa":
      return `Confirma registrar a despesa "${result.description}" de ${brl(result.amount)}/mês?`;
    case "registrarDespesasEmLote": {
      const lines = result.items.map((it) => `• ${it.description} — ${brl(it.amount)}`).join("\n");
      return `Encontrei ${result.count} despesa${result.count > 1 ? "s" : ""} (total ${brl(result.total)}/mês):\n${lines}\nConfirma registrar todas?`;
    }
    case "registrarRenda":
      return `Confirma registrar a renda "${result.description}" (líquido ${brl(result.net)})?`;
    case "atualizarSaldoBanco":
      return result.isNew
        ? `Não achei o banco "${result.bankName}" — confirma criar com saldo de ${brl(result.newBalance)}?`
        : `Confirma atualizar o saldo de "${result.bankName}" para ${brl(result.newBalance)}?`;
    case "criarMetaFinanceira":
      return `Confirma criar a meta financeira "${result.title}" de ${brl(result.targetAmount)}?`;
    case "atualizarFundoEmergencia":
      return `Confirma atualizar a reserva de emergência para ${brl(result.amount)}?`;
    case "atualizarMetaFinanceira":
      return `Confirma atualizar "${result.title}" para ${brl(result.currentAmount)} de ${brl(result.targetAmount)}?`;
    case "criarCompromissoImportante":
      return `Confirma criar "${result.title}" (${typeLabel(result.type)}) em ${result.startDate}?`;
    case "editarDataImportante":
      return `Confirma atualizar "${result.title}" (${importantDateChangeSummary(result.changes)})?`;
    case "excluirCompromissoImportante":
      return `Confirma excluir "${result.title}"? Essa ação não pode ser desfeita.`;
    case "criarRefeicao":
      return `Confirma criar a refeição "${result.title}"${result.time ? ` às ${result.time}` : ""}?`;
    case "adicionarItemRefeicao":
      return `Confirma adicionar "${result.itemName}" em "${result.mealTitle}"?`;
    case "editarItemRefeicao":
      return `Confirma atualizar "${result.itemName}" em "${result.mealTitle}" (${mealItemChangeSummary(result.changes)})?`;
    case "removerItemRefeicao":
      return `Confirma remover "${result.itemName}" de "${result.mealTitle}"?`;
    case "registrarSessaoFoco":
      return `Confirma registrar ${result.minutes} min de foco${result.goalTitle ? ` em "${result.goalTitle}"` : " (sem meta vinculada)"}?`;
    case "iniciarFoco":
      return `Confirma iniciar uma sessão de foco agora${result.goalTitle ? ` vinculada a "${result.goalTitle}"` : ""}?`;
    case "fecharMes":
      return `Confirma fechar o mês ${result.month} (saldo ${brl(result.monthlyBalance)})?`;
    case "excluirFechamentoMensal":
      return `Confirma excluir o fechamento de ${result.month}?`;
    default:
      return "Confirma essa ação?";
  }
}

module.exports = { isReadTool, formatWriteConfirmation, formatConfirmationPrompt };
