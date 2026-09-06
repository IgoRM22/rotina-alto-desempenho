const { Type } = require("@google/genai");

// Cada ferramenta mapeia 1:1 para uma ação que já existe na UI do Raio.
// Nada destrutivo (excluir, resetar streak) fica de fora por design —
// a superfície de risco de um comando mal-interpretado apagar algo fica fechada.
const TOOLS = [
  {
    name: "criarTarefa",
    description: "Cria uma nova tarefa (todo) para o usuário.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        titulo: { type: Type.STRING, description: "Título da tarefa." },
        categoria: { type: Type.STRING, description: "Categoria existente da tarefa, se aplicável." },
        prazo: { type: Type.STRING, description: "Data limite no formato YYYY-MM-DD, se houver." },
        prioridade: { type: Type.STRING, enum: ["alta", "media", "baixa"] },
        marcarParaHoje: { type: Type.BOOLEAN, description: "Se true, já marca a tarefa para o dia de hoje." },
      },
      required: ["titulo"],
    },
  },
  {
    name: "concluirTarefa",
    description: "Marca uma tarefa existente (pendente) como concluída, buscando pelo título.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        titulo: { type: Type.STRING, description: "Título (ou parte dele) da tarefa pendente a concluir." },
      },
      required: ["titulo"],
    },
  },
  {
    name: "marcarHabito",
    description: "Registra um hábito como cumprido em uma data (padrão: hoje).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        nome: { type: Type.STRING, description: "Nome (ou parte dele) do hábito." },
        data: { type: Type.STRING, description: "Data YYYY-MM-DD; se omitida, usa hoje." },
      },
      required: ["nome"],
    },
  },
  {
    name: "criarNota",
    description: "Cria uma nova nota pessoal.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        titulo: { type: Type.STRING },
        conteudo: { type: Type.STRING },
        caderno: { type: Type.STRING, description: "Nome de um caderno (notebook) existente." },
        importancia: { type: Type.STRING, enum: ["alta", "media", "baixa"] },
      },
      required: ["titulo"],
    },
  },
  {
    name: "criarMeta",
    description: "Cria uma nova meta (goal) para o usuário.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        titulo: { type: Type.STRING },
        categoria: { type: Type.STRING },
        periodo: { type: Type.STRING, enum: ["semana", "mes", "trimestre", "ano", "longo_prazo"] },
        compromisso: { type: Type.STRING, description: "Frase pessoal de por que essa meta importa." },
        prazoAlvo: { type: Type.STRING, description: "Data alvo YYYY-MM-DD, se houver." },
      },
      required: ["titulo"],
    },
  },
  {
    name: "atualizarProgressoMeta",
    description: "Ajusta o progresso (0 a 100) de uma meta existente, buscando pelo título.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        titulo: { type: Type.STRING, description: "Título (ou parte dele) da meta." },
        progresso: { type: Type.NUMBER, description: "Novo progresso, de 0 a 100." },
      },
      required: ["titulo", "progresso"],
    },
  },
  {
    name: "criarItemAgenda",
    description: "Cria um item no cronograma semanal (agenda) do usuário.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        nome: { type: Type.STRING },
        dia: {
          type: Type.STRING,
          enum: ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"],
          description: "Dia da semana; se omitido, usa o dia de hoje.",
        },
        horarioInicio: { type: Type.STRING, description: "Formato HH:MM." },
        horarioFim: { type: Type.STRING, description: "Formato HH:MM, opcional." },
        categoria: { type: Type.STRING },
        recorrencia: {
          type: Type.STRING,
          enum: ["daily", "weekdays", "weekend"],
          description: "Omitir se o item não se repete (dia específico apenas).",
        },
      },
      required: ["nome"],
    },
  },
  {
    name: "consultarResumoDoDia",
    description: "Leitura — retorna as tarefas de hoje e o estado dos hábitos de hoje.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "resumirSemana",
    description: "Leitura — retorna metas ativas e a taxa de conclusão de hábitos dos últimos 7 dias.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
];

module.exports = { TOOLS };
