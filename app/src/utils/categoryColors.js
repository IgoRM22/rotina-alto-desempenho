// Paleta "seed" das categorias de vida (agenda/tarefas) — cada hex aqui
// corresponde 1:1 a uma variável de :root em index.css (--sage, --blue etc.),
// então mudar a identidade visual é editar as variáveis lá E este mapa aqui,
// nunca um hex solto espalhado por página. Usada como valor inicial da lista
// editável de categorias (o usuário pode renomear/recolorir depois em
// Configurações — ver scheduleCategories no firestore.js).
export const DEFAULT_CATEGORIES = [
  { value: 'saude', color: '#8FAE83' },    // --sage
  { value: 'corp', color: '#6C93B8' },     // --blue
  { value: 'projeto', color: '#E06445' },  // --coral
  { value: 'mente', color: '#9084C9' },    // --violet
  { value: 'estudo', color: '#C97B93' },   // --pink
  { value: 'familia', color: '#D6A54C' },  // --gold
  { value: 'trem', color: '#7A7570' },     // --muted
  { value: 'pessoal', color: '#9084C9' },  // --violet
]

export const colorForCategory = (value, categories = DEFAULT_CATEGORIES) =>
  categories.find((c) => c.value === value)?.color || '#7A7570'
