// Frases variadas pro momento de concluir algo — nunca a mesma toda vez.
// Pela pesquisa de reforço variável (vs. recompensa fixa e previsível), uma
// mensagem que muda sustenta mais atenção no longo prazo do que sempre
// "Feito!" — e evita que o feedback vire ruído que a pessoa aprende a ignorar.
const HABIT_PHRASES = [
  'Mais um dia no lugar certo.',
  'Consistência é isso.',
  'Sequência mantida.',
  'Isso que é hábito de verdade.',
  'Um tijolo a mais.',
]

const TASK_PHRASES = [
  'Feito.',
  'Uma a menos na lista.',
  'Boa.',
  'Riscado.',
  'Avançando.',
]

const pick = (list) => list[Math.floor(Math.random() * list.length)]

export const habitCelebration = () => pick(HABIT_PHRASES)
export const taskCelebration = () => pick(TASK_PHRASES)
