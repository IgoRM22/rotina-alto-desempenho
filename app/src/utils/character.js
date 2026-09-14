// Personagem estilo RPG — sprites reais do projeto Liberated Pixel Cup (LPC),
// a mesma base usada em incontáveis jogos indie em pixel art. Licença
// CC-BY-SA 3.0 / GPL 3.0 conforme o arquivo de cada artista original — ver
// créditos em Configurações. Assets ficam em app/public/lpc/, baixados uma
// vez do repositório oficial (github.com/LiberatedPixelCup) — sem geração
// dinâmica nem serviço externo em runtime, só imagens estáticas compostas em
// canvas.
//
// O corpo do LPC é só do pescoço pra baixo por design (pensado pra caber
// várias cabeças/raças) — a cabeça é uma camada própria (spritesheets/head),
// sem ela o personagem fica sem rosto.
export const FRAME_SIZE = 64
export const FRAME_COLS = 9
export const FRAME_ROW = 2 // linha 2 da folha "walk" = de frente (0=costas,1=esquerda,2=frente,3=direita)

// Dois jeitos de recortar o mesmo quadro de 64x64: "rosto" (zoom na cabeça —
// pra bolinha flutuante, pequena, onde o corpo inteiro só vira ruído) e
// "corpo" (o personagem inteiro, cortando a margem vazia do topo do quadro
// pra ficar centralizado de verdade num círculo, em vez de "afundado").
export const FACE_CROP = { x: 14, y: 9, w: 34, h: 34 }
export const BODY_CROP = { x: 6, y: 4, w: 52, h: 56 }

// Cada tipo de corpo tem sua própria silhueta — usar a calça "macho" (mais
// larga nos ombros, mais estreita no quadril) em cima de um corpo diferente
// é exatamente o que fazia ela "vazar pra fora" nos tipos Guerreira/Colosso/
// Aprendiz. Cada um usa a calça/bota desenhada pra sua própria silhueta.
export const BODY_TYPES = [
  { value: 'male', label: 'Guerreiro', head: 'male', legs: 'pants', feet: 'boots' },
  { value: 'female', label: 'Guerreira', head: 'female', legs: 'pants_thin', feet: 'boots_thin' },
  { value: 'muscular', label: 'Colosso', head: 'male', legs: 'pants_muscular', feet: 'boots' },
  { value: 'teen', label: 'Aprendiz', head: 'male', legs: 'pants_thin', feet: 'boots_thin' },
]

export const HAIR_STYLES = [
  { value: 'plain', label: 'Liso' },
  { value: 'long', label: 'Longo' },
  { value: 'bangs', label: 'Franja' },
  { value: 'pixie', label: 'Curto' },
  { value: 'bedhead', label: 'Bagunçado' },
]

// Tons de pele reais (não recolorem o sprite pra qualquer cor arbitrária —
// ficam dentro da faixa de tom de pele humano, senão o multiply distorce a
// sombra/luz já desenhada no sprite e fica estranho).
export const SKIN_TONES = [
  '#ffdbac', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5a3825',
]

// O cabelo usa uma técnica diferente da pele/roupa (colorize — troca de
// matiz preservando a luz/sombra original, ver getColorized em
// PixelCharacter.jsx) porque o sprite nasce ruivo e um simples multiply não
// consegue virar azul/verde/rosa a partir disso (só escurece o laranja).
// Com colorize, QUALQUER cor funciona — a paleta abaixo é só sugestão de
// atalho, mas o seletor de cor livre aceita qualquer hex.
export const HAIR_COLORS = [
  '#0d0906', '#5b3a1e', '#d4a017', '#E06445', '#6C93B8',
]

// Branco puro multiplicado por qualquer cor não muda nada (255*x/255 = x) —
// é o sentinela "sem tinta", pra quem já tinha um personagem ANTES dessa
// funcionalidade existir continuar exatamente igual até escolher uma cor de
// propósito, em vez de ver a cor mudar sozinha na próxima vez que abrir o app.
const NO_TINT = '#ffffff'

export const DEFAULT_CHARACTER = {
  name: '',
  body: 'male',
  hair: 'plain',
  skinColor: NO_TINT,
  hairColor: NO_TINT,
}

// Cada item pertence a um "slot" (uma peça do corpo) e desbloqueia num
// nível de personagem — o mesmo nível calculado em utils/gamification.js.
// Cada slot tem sua própria trilha de progressão (peça mais fraca → mais
// forte), então subir de nível troca a peça de cada slot em separado, sem
// dois itens do mesmo nível competindo entre si.
export const UNLOCKS = [
  { level: 2, slot: 'torso', item: 'leather', label: 'Armadura de couro' },
  { level: 3, slot: 'hat', item: 'hood', label: 'Capuz' },
  { level: 4, slot: 'weapon', item: 'longsword', label: 'Espada longa' },
  { level: 5, slot: 'hat', item: 'bascinet', label: 'Bacinete' },
  { level: 6, slot: 'hat', item: 'norman', label: 'Elmo normando' },
  { level: 7, slot: 'shield', item: 'round', label: 'Escudo redondo' },
  { level: 8, slot: 'hat', item: 'horned', label: 'Elmo com chifres' },
  { level: 9, slot: 'torso', item: 'legion', label: 'Armadura de legionário' },
  { level: 10, slot: 'weapon', item: 'katana', label: 'Katana' },
  { level: 11, slot: 'hat', item: 'barbarian', label: 'Elmo bárbaro' },
  { level: 12, slot: 'hat', item: 'kettle', label: 'Elmo de aba' },
  { level: 13, slot: 'torso', item: 'plate', label: 'Armadura de placas' },
  { level: 15, slot: 'hat', item: 'wizard', label: 'Chapéu de mago' },
]

// import.meta.env.BASE_URL já vem com "/" no final (config `base` do Vite,
// ver vite.config.js) — sem isso, um caminho absoluto "/lpc/..." ignora a
// base e busca na raiz do domínio em vez de dentro do app.
const LPC_BASE = `${import.meta.env.BASE_URL}lpc`

const ASSET_PATH = {
  body: (v) => `${LPC_BASE}/body/${v}.png`,
  head: (v) => `${LPC_BASE}/head/${v}.png`,
  hair: (v) => `${LPC_BASE}/hair/${v}.png`,
  legs: (v) => `${LPC_BASE}/legs/${v}.png`,
  feet: (v) => `${LPC_BASE}/feet/${v}.png`,
  torso: (v) => `${LPC_BASE}/torso/${v}.png`,
  hat: (v) => `${LPC_BASE}/hat/${v}.png`,
  weapon: (v) => `${LPC_BASE}/weapon/${v}.png`,
  shield: (v) => `${LPC_BASE}/shield/${v}.png`,
}

// A armadura também é desenhada pra uma silhueta de corpo específica — mesmo
// problema da calça. "male" e "muscular" tomam emprestado o corte macho
// (não existe variante própria pra colosso na fonte); female/teen usam o
// arquivo próprio, baixado à parte.
const TORSO_BODY_SUFFIX = { male: '', muscular: '', female: '_female', teen: '_teen' }
const torsoFile = (item, bodyValue) => `${item}${TORSO_BODY_SUFFIX[bodyValue] ?? ''}`

// Roupa básica (camiseta) que todo personagem já nasce vestindo, antes de
// desbloquear a primeira armadura no nível 2 — sem isso o boneco ficava sem
// camisa até subir de nível, o que lia como "sem roupa" mesmo sendo só um
// espaço vazio na progressão. Some só se a pessoa escolher "ver sem
// equipamento" no editor (sentinela "bare", ver buildLayers) ou tiver uma
// armadura de verdade equipada por cima.
const BASE_TORSO_ITEM = 'shirt'

export const SLOTS = ['torso', 'hat', 'weapon', 'shield']

// A peça mais forte já desbloqueada em cada slot — null pra slot ainda sem
// nada desbloqueado nesse nível. Usado como padrão até a pessoa escolher
// outra coisa em "Equipamento" (ver resolveEquipped).
export function equipmentForLevel(level) {
  const bySlot = {}
  UNLOCKS.filter((u) => u.level <= level).forEach((u) => {
    if (!bySlot[u.slot] || bySlot[u.slot].level < u.level) bySlot[u.slot] = u
  })
  return bySlot
}

// Todas as peças de um slot já desbloqueadas nesse nível, da mais fraca pra
// mais forte — é a lista que vira o seletor em "Equipamento".
export function unlockedForSlot(slot, level) {
  return UNLOCKS.filter((u) => u.slot === slot && u.level <= level).sort((a, b) => a.level - b.level)
}

export function nextUnlock(level) {
  return UNLOCKS.filter((u) => u.level > level).sort((a, b) => a.level - b.level)[0] || null
}

// O que vestir de fato em cada slot: respeita a escolha salva em
// character.equipped[slot] (inclusive "nenhum", pra poder tirar o capacete)
// desde que ainda esteja desbloqueada nesse nível; sem escolha salva (ou se
// o nível baixou e a peça escolhida não existe mais), cai na mais forte
// disponível — o comportamento automático de antes, agora só como padrão.
export function resolveEquipped(character, level) {
  const auto = equipmentForLevel(level)
  const chosen = character?.equipped || {}
  const result = {}
  SLOTS.forEach((slot) => {
    const pick = chosen[slot]
    if (pick === 'none' || pick === 'bare') { result[slot] = null; return }
    if (pick) {
      const match = UNLOCKS.find((u) => u.slot === slot && u.item === pick && u.level <= level)
      if (match) { result[slot] = match; return }
    }
    result[slot] = auto[slot] || null
  })
  return result
}

// A calça/bota "de fábrica" do LPC vem num bege muito perto do tom de pele —
// em tamanho pequeno isso lia como uma mancha confusa em vez de roupa.
// Recolorindo (multiply) pra um marrom de couro fica claramente "roupa" —
// e as DUAS com a MESMA cor de propósito: os sprites de calça e bota não se
// encostam de verdade (sobra uma tira de perna nua entre eles), o que só não
// aparecia porque ambos vinham no mesmo bege; cores iguais escondem a costura
// de novo, cores diferentes expõem ela.
const TINTS = {
  legs: '#6b4f36',
  feet: '#2e2015',
}

// A perna do sprite de corpo (body) é mais LARGA que a calça do LPC nessa
// altura (a mão descansa perto do quadril, então um corte horizontal "daqui
// pra baixo é perna" também pintava a mão/braço de marrom — ficava um borrão
// enorme). A correção certa: usar a SILHUETA da própria calça como molde —
// só as colunas de x onde a calça realmente tem pixel (em qualquer altura do
// quadro, o que já exclui as colunas do braço) — esticadas pra baixo até a
// bota. Ver getLegTinted em PixelCharacter.jsx.
export const LEG_TINT_Y = 44 // onde a calça começa no quadro de 64px
export const LEG_TINT_COLOR = TINTS.legs

// Ordem de camadas de baixo pra cima: corpo (com a perna pré-pintada, usando
// a calça como molde) → calça/bota (por cima, dão a textura/silhueta) →
// armadura no peito → cabeça → cabelo → capacete (por cima do cabelo) →
// escudo → arma na frente. Cada camada é {src, tint?} — tint recolore
// (multiply) o sprite inteiro; legTint+legMaskSrc (só na camada do corpo)
// recolorem apenas as colunas da perna, usando a calça como molde da largura.
// Ver PixelCharacter.jsx.
export function buildLayers(character, level) {
  const cfg = { ...DEFAULT_CHARACTER, ...character }
  const bodyDef = BODY_TYPES.find((b) => b.value === cfg.body) || BODY_TYPES[0]
  const equipped = resolveEquipped(character, level)
  const layers = [
    {
      src: ASSET_PATH.body(cfg.body),
      skinTint: cfg.skinColor,
      legTint: LEG_TINT_COLOR,
      legMaskSrc: ASSET_PATH.legs(bodyDef.legs),
    },
    { src: ASSET_PATH.legs(bodyDef.legs), tint: TINTS.legs },
    { src: ASSET_PATH.feet(bodyDef.feet), tint: TINTS.feet },
    ...(equipped.torso
      ? [{ src: ASSET_PATH.torso(torsoFile(equipped.torso.item, cfg.body)) }]
      : character?.equipped?.torso === 'bare'
        ? []
        : [{ src: ASSET_PATH.torso(torsoFile(BASE_TORSO_ITEM, cfg.body)) }]),
    { src: ASSET_PATH.head(bodyDef.head), tint: cfg.skinColor },
    { src: ASSET_PATH.hair(cfg.hair), colorize: cfg.hairColor === NO_TINT ? null : cfg.hairColor },
    ...(equipped.hat ? [{ src: ASSET_PATH.hat(equipped.hat.item) }] : []),
    ...(equipped.shield ? [{ src: ASSET_PATH.shield(equipped.shield.item) }] : []),
    ...(equipped.weapon ? [{ src: ASSET_PATH.weapon(equipped.weapon.item) }] : []),
  ]
  return layers
}
