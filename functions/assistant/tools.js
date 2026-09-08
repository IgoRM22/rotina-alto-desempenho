const { Type } = require("@google/genai");

// Cada ferramenta mapeia 1:1 para uma ação que já existe na UI do Raio.
// Ferramentas "excluir*" também existem — a rede de segurança contra um
// comando mal-interpretado apagar algo não é "não oferecer a ferramenta",
// é a confirmação explícita que toda escrita (inclusive exclusão) já passa
// antes de gravar de verdade (ver "Regra central" no SYSTEM_PROMPT).
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
    name: "reagendarTarefa",
    description: "Altera o prazo, prioridade ou categoria de uma tarefa pendente já existente, buscando pelo título.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        titulo: { type: Type.STRING, description: "Título (ou parte dele) da tarefa pendente." },
        novoPrazo: { type: Type.STRING, description: "Nova data limite, formato YYYY-MM-DD." },
        novaPrioridade: { type: Type.STRING, enum: ["alta", "media", "baixa"] },
        novaCategoria: { type: Type.STRING },
      },
      required: ["titulo"],
    },
  },
  {
    name: "excluirTarefa",
    description: "Exclui (apaga de vez) uma tarefa existente, pendente ou concluída, buscando pelo título.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        titulo: { type: Type.STRING, description: "Título (ou parte dele) da tarefa a excluir." },
      },
      required: ["titulo"],
    },
  },
  {
    name: "criarHabito",
    description: "Cria um novo hábito para acompanhar. Por padrão é diário, mas pode ter uma meta semanal (ex: ir à academia 3x por semana, sem precisar ser todo dia).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        nome: { type: Type.STRING },
        vezesPorSemana: {
          type: Type.NUMBER,
          description: "Quantas vezes por semana, de 1 a 7. Omitir (ou usar 7) para um hábito diário.",
        },
      },
      required: ["nome"],
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
    name: "desmarcarHabito",
    description: "Desfaz a marcação de um hábito numa data (padrão: hoje) — para corrigir uma marcação feita por engano.",
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
    name: "excluirHabito",
    description: "Exclui (apaga de vez, com todo o histórico de sequência) um hábito existente, buscando pelo nome.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        nome: { type: Type.STRING, description: "Nome (ou parte dele) do hábito a excluir." },
      },
      required: ["nome"],
    },
  },
  {
    name: "registrarLogDiario",
    description: "Registra sono, energia e/ou uma nota livre sobre o dia (registro diário), padrão hoje. Pode informar só um dos campos.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        sono: { type: Type.NUMBER, description: "Qualidade do sono, de 1 (pouco) a 5 (ótimo)." },
        energia: { type: Type.NUMBER, description: "Nível de energia, de 1 (baixa) a 5 (alta)." },
        nota: { type: Type.STRING, description: "Nota livre sobre como foi o dia." },
        data: { type: Type.STRING, description: "Data YYYY-MM-DD; se omitida, usa hoje." },
      },
    },
  },
  {
    name: "registrarAnotacaoSemanal",
    description: "Adiciona uma anotação do dia marcada como 'o que funcionou', 'o que ajustar' ou um rabisco livre — aparece na Revisão Semanal.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        texto: { type: Type.STRING },
        tipo: { type: Type.STRING, enum: ["funcionou", "ajustar", "rabisco"] },
        data: { type: Type.STRING, description: "Data YYYY-MM-DD; se omitida, usa hoje." },
      },
      required: ["texto", "tipo"],
    },
  },
  {
    name: "adicionarFocoSemana",
    description: "Adiciona um item à lista de 'Foco da próxima semana' (Revisão Semanal).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        texto: { type: Type.STRING },
      },
      required: ["texto"],
    },
  },
  {
    name: "removerFocoSemana",
    description: "Remove um item da lista de 'Foco da próxima semana', buscando pelo texto.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        texto: { type: Type.STRING, description: "Texto (ou parte dele) do item a remover." },
      },
      required: ["texto"],
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
    name: "editarNota",
    description: "Edita o conteúdo, caderno ou importância de uma nota já existente, buscando pelo título.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        titulo: { type: Type.STRING, description: "Título (ou parte dele) da nota existente." },
        novoConteudo: { type: Type.STRING },
        novoCaderno: { type: Type.STRING },
        novaImportancia: { type: Type.STRING, enum: ["alta", "media", "baixa"] },
      },
      required: ["titulo"],
    },
  },
  {
    name: "excluirNota",
    description: "Exclui (apaga de vez) uma nota existente, buscando pelo título.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        titulo: { type: Type.STRING, description: "Título (ou parte dele) da nota a excluir." },
      },
      required: ["titulo"],
    },
  },
  {
    name: "criarCaderno",
    description: "Cria um novo caderno (notebook) para organizar notas.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        nome: { type: Type.STRING },
      },
      required: ["nome"],
    },
  },
  {
    name: "excluirCaderno",
    description: "Exclui um caderno (notebook) existente, buscando pelo nome. As notas dentro dele NÃO são apagadas — voltam a ficar sem caderno.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        nome: { type: Type.STRING, description: "Nome (ou parte dele) do caderno a excluir." },
      },
      required: ["nome"],
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
    name: "editarMeta",
    description: "Edita título, descrição, compromisso, categoria ou prazo de uma meta de vida já existente, buscando pelo título.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        titulo: { type: Type.STRING, description: "Título (ou parte dele) da meta existente." },
        novoTitulo: { type: Type.STRING },
        novaDescricao: { type: Type.STRING },
        novoCompromisso: { type: Type.STRING },
        novaCategoria: { type: Type.STRING },
        novoPrazoAlvo: { type: Type.STRING, description: "Nova data alvo YYYY-MM-DD." },
      },
      required: ["titulo"],
    },
  },
  {
    name: "excluirMeta",
    description: "Exclui (apaga de vez) uma meta de vida existente, buscando pelo título.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        titulo: { type: Type.STRING, description: "Título (ou parte dele) da meta a excluir." },
      },
      required: ["titulo"],
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
        semana: {
          type: Type.STRING,
          enum: ["atual", "proxima"],
          description: "Em qual semana criar o item. Omitir para a semana atual.",
        },
      },
      required: ["nome"],
    },
  },
  {
    name: "editarItemAgenda",
    description: "Edita nome, dia, horário ou categoria de um item da agenda já existente, buscando pelo nome.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        nome: { type: Type.STRING, description: "Nome (ou parte dele) do item já cadastrado." },
        novoNome: { type: Type.STRING },
        novoDia: {
          type: Type.STRING,
          enum: ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"],
        },
        novoHorarioInicio: { type: Type.STRING, description: "Formato HH:MM." },
        novoHorarioFim: { type: Type.STRING, description: "Formato HH:MM." },
        novaCategoria: { type: Type.STRING },
        semana: {
          type: Type.STRING,
          enum: ["atual", "proxima"],
          description: "Em qual semana buscar o item a editar. Omitir para a semana atual.",
        },
      },
      required: ["nome"],
    },
  },
  {
    name: "excluirItemAgenda",
    description: "Exclui (remove de vez) um item do cronograma semanal (agenda), buscando pelo nome.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        nome: { type: Type.STRING, description: "Nome (ou parte dele) do item a excluir." },
        semana: {
          type: Type.STRING,
          enum: ["atual", "proxima"],
          description: "Em qual semana buscar o item. Omitir para a semana atual.",
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
    description: "Leitura — retorna os compromissos da agenda (cronograma semanal) da semana atual ou da próxima. Use por conta própria quando a pergunta envolver tempo disponível, horários, o que já está agendado, ou quando o usuário mencionar cancelar/mudar um plano — para achar o item antes de dizer que não entendeu.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        semana: {
          type: Type.STRING,
          enum: ["atual", "proxima"],
          description: "Qual semana consultar. Omitir para a semana atual.",
        },
      },
    },
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
    name: "fecharMes",
    description: "Fecha o mês financeiro atual, guardando uma foto dos totais (saldo em bancos, renda, despesas, saldo mensal) pra comparar com o próximo mês.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "excluirFechamentoMensal",
    description: "Exclui um fechamento mensal já salvo, buscando pelo mês (formato YYYY-MM).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        mes: { type: Type.STRING, description: "Mês no formato YYYY-MM, ex: 2026-09." },
      },
      required: ["mes"],
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
    name: "editarDataImportante",
    description: "Edita título, tipo, data ou descrição de uma data importante já existente, buscando pelo título.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        titulo: { type: Type.STRING, description: "Título (ou parte dele) da data importante existente." },
        novoTitulo: { type: Type.STRING },
        novoTipo: { type: Type.STRING, enum: ["feriado", "aniversario", "ferias", "importante", "outros"] },
        novaDataInicio: { type: Type.STRING, description: "Nova data YYYY-MM-DD." },
        novaDataFim: { type: Type.STRING },
        novaDescricao: { type: Type.STRING },
      },
      required: ["titulo"],
    },
  },
  {
    name: "excluirCompromissoImportante",
    description: "Exclui (apaga de vez) uma data importante/compromisso já cadastrado, buscando pelo título.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        titulo: { type: Type.STRING, description: "Título (ou parte dele) do compromisso a excluir." },
      },
      required: ["titulo"],
    },
  },
  {
    name: "consultarCompromissosImportantes",
    description: "Leitura — retorna as próximas datas importantes cadastradas (feriados, aniversários, férias, eventos). Use por conta própria quando a pergunta envolver datas, prazos ou eventos futuros, ou quando o usuário mencionar cancelar/mudar um plano — para achar o compromisso antes de dizer que não entendeu.",
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
    name: "editarItemRefeicao",
    description: "Edita a quantidade, gramas ou tipo de um alimento já lançado numa refeição, buscando a refeição e o item pelo nome.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        refeicao: { type: Type.STRING, description: "Nome (ou parte dele) da refeição." },
        item: { type: Type.STRING, description: "Nome (ou parte dele) do alimento já lançado." },
        novaQuantidade: { type: Type.STRING },
        novasGramas: { type: Type.STRING },
        novoTipo: {
          type: Type.STRING,
          enum: ["proteina", "carboidrato", "gordura", "fruta", "vegetal", "laticinio", "bebida", "outros"],
        },
      },
      required: ["refeicao", "item"],
    },
  },
  {
    name: "removerItemRefeicao",
    description: "Remove um alimento de uma refeição, buscando a refeição e o item pelo nome.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        refeicao: { type: Type.STRING, description: "Nome (ou parte dele) da refeição." },
        item: { type: Type.STRING, description: "Nome (ou parte dele) do alimento a remover." },
      },
      required: ["refeicao", "item"],
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
