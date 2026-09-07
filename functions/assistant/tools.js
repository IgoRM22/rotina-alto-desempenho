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
  {
    name: "consultarTarefasPendentes",
    description: "Leitura — retorna todas as tarefas pendentes do usuário (não só as de hoje), com categoria, prazo e prioridade. Use isto por conta própria sempre que ajudar a dar uma resposta melhor sobre o que priorizar, mesmo sem o usuário pedir um resumo.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "consultarNotas",
    description: "Leitura — retorna títulos e prévias das notas mais recentes/importantes do usuário. Use por conta própria quando a pergunta parecer se beneficiar do que já foi anotado.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "consultarAgendaSemana",
    description: "Leitura — retorna os compromissos da semana atual na agenda. Use por conta própria quando a pergunta envolver tempo disponível, horários ou o que já está agendado.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "registrarDespesaFixa",
    description: "Registra uma nova despesa fixa mensal.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        descricao: { type: Type.STRING },
        valor: { type: Type.NUMBER, description: "Valor mensal da despesa." },
        banco: { type: Type.STRING, description: "Nome do banco de onde a despesa sai, se souber." },
      },
      required: ["descricao", "valor"],
    },
  },
  {
    name: "registrarDespesasEmLote",
    description: "Registra várias despesas fixas de uma vez. Use quando o usuário mandar uma imagem de extrato/fatura com vários lançamentos — extraia cada item visível (descrição e valor) em vez de pedir um por um.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        despesas: {
          type: Type.ARRAY,
          description: "Lista de despesas encontradas.",
          items: {
            type: Type.OBJECT,
            properties: {
              descricao: { type: Type.STRING },
              valor: { type: Type.NUMBER },
              banco: { type: Type.STRING, description: "Nome do banco/cartão de onde saiu, se souber." },
            },
            required: ["descricao", "valor"],
          },
        },
      },
      required: ["despesas"],
    },
  },
  {
    name: "registrarRenda",
    description: "Registra uma nova fonte de renda mensal.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        descricao: { type: Type.STRING },
        valorBruto: { type: Type.NUMBER },
        descontos: { type: Type.NUMBER, description: "Descontos mensais, se houver. Padrão 0." },
      },
      required: ["descricao", "valorBruto"],
    },
  },
  {
    name: "atualizarSaldoBanco",
    description: "Atualiza o saldo de um banco existente (buscando pelo nome) ou cria um banco novo se não existir nenhum com esse nome.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        banco: { type: Type.STRING, description: "Nome do banco." },
        novoSaldo: { type: Type.NUMBER, description: "Novo saldo atual." },
      },
      required: ["banco", "novoSaldo"],
    },
  },
  {
    name: "atualizarFundoEmergencia",
    description: "Atualiza o valor total guardado na reserva de emergência.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        valor: { type: Type.NUMBER, description: "Novo valor total da reserva de emergência." },
      },
      required: ["valor"],
    },
  },
  {
    name: "atualizarMetaFinanceira",
    description: "Atualiza o valor já guardado (progresso) de uma meta financeira EXISTENTE, buscando pelo título. Use isto em vez de criarMetaFinanceira quando a meta já existir no resumo financeiro.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        titulo: { type: Type.STRING, description: "Título (ou parte dele) da meta financeira já existente." },
        valorAtual: { type: Type.NUMBER, description: "Novo valor já guardado." },
      },
      required: ["titulo", "valorAtual"],
    },
  },
  {
    name: "criarMetaFinanceira",
    description: "Cria uma nova meta financeira (valor alvo a atingir).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        titulo: { type: Type.STRING },
        valorAlvo: { type: Type.NUMBER },
        valorAtual: { type: Type.NUMBER, description: "Valor já acumulado. Padrão 0." },
        prazoAlvo: { type: Type.STRING, description: "Data alvo YYYY-MM-DD, se houver." },
      },
      required: ["titulo", "valorAlvo"],
    },
  },
  {
    name: "consultarResumoFinanceiro",
    description: "Leitura — retorna fundo de emergência, saldo total em bancos, renda líquida mensal, despesas fixas mensais, saldo mensal e metas financeiras. Use por conta própria quando a pergunta envolver dinheiro, gastos, saldo ou orçamento.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "criarCompromissoImportante",
    description: "Cria uma data importante (feriado, aniversário, férias, evento) que aparece no calendário e nos compromissos da Home.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        titulo: { type: Type.STRING },
        tipo: { type: Type.STRING, enum: ["feriado", "aniversario", "ferias", "importante", "outros"] },
        dataInicio: { type: Type.STRING, description: "Data YYYY-MM-DD." },
        dataFim: { type: Type.STRING, description: "Data final YYYY-MM-DD, se for um período (ex: férias)." },
        recorrencia: {
          type: Type.STRING,
          enum: ["weekly", "monthly", "yearly"],
          description: "Omitir se o evento não se repete (ex: aniversário geralmente é yearly).",
        },
        descricao: { type: Type.STRING },
      },
      required: ["titulo", "tipo", "dataInicio"],
    },
  },
  {
    name: "consultarCompromissosImportantes",
    description: "Leitura — retorna as próximas datas importantes cadastradas (feriados, aniversários, férias, eventos). Use por conta própria quando a pergunta envolver datas, prazos ou eventos futuros.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "criarRefeicao",
    description: "Cria uma nova tabela/horário de refeição no plano alimentar (ex: Café da manhã, Almoço).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        titulo: { type: Type.STRING, description: "Nome da refeição, ex: Almoço." },
        horario: { type: Type.STRING, description: "Horário HH:MM, se souber." },
      },
      required: ["titulo"],
    },
  },
  {
    name: "adicionarItemRefeicao",
    description: "Adiciona um alimento a uma refeição já existente no plano alimentar, buscando a refeição pelo nome.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        refeicao: { type: Type.STRING, description: "Nome (ou parte dele) da refeição já cadastrada." },
        nome: { type: Type.STRING, description: "Nome do alimento." },
        quantidade: { type: Type.STRING, description: "Ex: '1 unidade', '2 colheres de sopa'." },
        gramas: { type: Type.STRING, description: "Ex: '50g', '200ml'." },
        tipo: {
          type: Type.STRING,
          enum: ["proteina", "carboidrato", "gordura", "fruta", "vegetal", "laticinio", "bebida", "outros"],
        },
      },
      required: ["refeicao", "nome"],
    },
  },
  {
    name: "consultarPlanoAlimentar",
    description: "Leitura — retorna as refeições cadastradas e os alimentos de cada uma. Use por conta própria quando a pergunta envolver dieta, refeições ou alimentação.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "registrarSessaoFoco",
    description: "Registra manualmente uma sessão de foco já concluída (quando o usuário não usou o timer do app).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        minutos: { type: Type.NUMBER, description: "Duração da sessão em minutos." },
        meta: { type: Type.STRING, description: "Título (ou parte dele) da meta vinculada, se houver." },
      },
      required: ["minutos"],
    },
  },
  {
    name: "consultarResumoFoco",
    description: "Leitura — retorna minutos de foco de hoje e o total por meta na última semana. Use por conta própria quando a pergunta envolver foco, concentração ou tempo dedicado a metas.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
];

module.exports = { TOOLS };
