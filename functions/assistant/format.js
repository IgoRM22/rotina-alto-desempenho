// Ferramentas de "leitura" precisam do modelo para transformar dados em prosa —
// as de escrita não: o resultado já é estruturado o bastante para uma frase
// determinística, o que evita uma segunda chamada ao Gemini (e metade da
// latência) na grande maioria dos comandos.
const READ_TOOLS = new Set(["consultarResumoDoDia", "resumirSemana"]);

const isReadTool = (name) => READ_TOOLS.has(name);

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
    case "marcarHabito":
      return `"${result.name}" registrado como cumprido${result.date ? ` em ${result.date}` : ""}.`;
    case "criarNota":
      return `Nota "${result.title}" criada${result.notebook ? ` em ${result.notebook}` : ""}.`;
    case "criarMeta":
      return `Meta "${result.title}" criada.`;
    case "atualizarProgressoMeta":
      return `"${result.title}" agora em ${result.progress}%.`;
    case "criarItemAgenda":
      return `"${result.name}" adicionado à agenda de ${result.day}.`;
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
    case "marcarHabito":
      return `Confirma registrar "${result.name}" como cumprido${result.date ? ` em ${result.date}` : ""}?`;
    case "criarNota":
      return `Confirma criar a nota "${result.title}"${result.notebook ? ` em ${result.notebook}` : ""}?`;
    case "criarMeta":
      return `Confirma criar a meta "${result.title}"?`;
    case "atualizarProgressoMeta":
      return `Confirma atualizar "${result.title}" para ${result.progress}%?`;
    case "criarItemAgenda":
      return `Confirma adicionar "${result.name}" à agenda de ${result.day}${args.horarioInicio ? ` às ${args.horarioInicio}` : ""}?`;
    default:
      return "Confirma essa ação?";
  }
}

module.exports = { isReadTool, formatWriteConfirmation, formatConfirmationPrompt };
