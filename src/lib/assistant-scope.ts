// Alcance del asistente de IA: solo repostería, la lección y el negocio de repostería. Reglas
// puras (sin base de datos ni modelo). Dos barreras: un filtro previo que no gasta nada
// (`prefilter`) y la marca que el modelo pone en una pregunta ajena (`OFF_TOPIC_MARK`).

// La marca con la que el modelo avisa que la pregunta es de otro tema. Va en las instrucciones.
// (Probado: pedirle clasificar TODAS las preguntas con una marca de tema empeoró mucho: rechazó
// una de cada tres preguntas de repostería, como si "la lección no lo dice" fuera "otro tema".)
export const OFF_TOPIC_MARK = '[FUERA_DE_TEMA]'

// Lo que ve la alumna. No ofrece mandarla a la chef: la bandeja de la chef es para dudas del curso.
export const OFF_TOPIC_MESSAGE =
  'Solo puedo ayudarte con repostería y con lo que se explica en tus lecciones, y esta pregunta parece de otro tema. Cuenta como una de tus preguntas de hoy; si me equivoqué, escríbela de otra forma.'
export const NO_LETTERS_MESSAGE =
  'Escribe tu pregunta con palabras para que pueda ayudarte. Cuenta como una de tus preguntas de hoy.'

export type PrefilterReason = 'code' | 'link' | 'injection' | 'noletters'

// Sin acentos y en minúsculas, para comparar frases.
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

// Palabras de programación (en mayúsculas o minúsculas, tal cual se escriben en código). Solo
// cuentan junto a símbolos de código: una receta no lleva `{`, `;` ni `=>`.
const CODE_WORDS =
  /\b(?:def|function|class|import|const|let|var|return|public|private|void|print|println|console|echo|SELECT|INSERT|UPDATE|DELETE|DROP|sudo)\b/
const CODE_SYMBOLS = /[{}();=<>[\]]/g
const COMMANDS =
  /\b(?:npm|pnpm|pip|yarn|apt|chmod|git) (?:install|add|run|clone|-)/i

const LINK =
  /\bhttps?:\/\/|\bwww\.|\b[a-z0-9-]+\.(?:com|mx|net|org|io|dev|app|ly)\b/i

const INJECTION = [
  /(ignora|olvida|omite|descarta)\w* (todas )?(tus|las|todas las|mis) (instrucciones|indicaciones|reglas|ordenes)/,
  /(muestra|revela|dime|repite|imprime|escribe|dame)\w* (tu|el|tus|las) (prompt|instrucciones|indicaciones|reglas)/,
  /(system|developer) prompt|prompt del sistema|mensaje del sistema/,
  /ignore (all |your |the |previous |prior )*(instructions|rules)/,
  /(a partir de ahora|desde ahora) (eres|seras|actua|responde)/,
  /(finge|pretende|simula|imagina) (que )?(eres|ser)/,
  /\b(jailbreak|modo desarrollador|developer mode|modo dios)\b/,
]

// Filtro previo, sin modelo: descarta lo que claramente no es una pregunta de repostería. Es
// fácil de evadir a propósito: solo atrapa lo obvio y gratis; lo demás lo decide el modelo.
export function prefilter(
  text: string,
): { ok: true } | { ok: false; reason: PrefilterReason } {
  if (!/\p{L}/u.test(text)) return { ok: false, reason: 'noletters' }
  if (text.includes('```') || /<\/?[a-z][^>]*>/i.test(text)) {
    return { ok: false, reason: 'code' }
  }
  if (CODE_WORDS.test(text) && (text.match(CODE_SYMBOLS)?.length ?? 0) >= 2) {
    return { ok: false, reason: 'code' }
  }
  if (COMMANDS.test(text)) return { ok: false, reason: 'code' }
  if (LINK.test(text)) return { ok: false, reason: 'link' }
  const folded = fold(text)
  if (INJECTION.some((pattern) => pattern.test(folded))) {
    return { ok: false, reason: 'injection' }
  }
  return { ok: true }
}

export const prefilterMessage = (reason: PrefilterReason) =>
  reason === 'noletters' ? NO_LETTERS_MESSAGE : OFF_TOPIC_MESSAGE

// La marca puede venir sola o con texto alrededor: si aparece, la pregunta es ajena y no se
// publica nada de lo que el modelo haya escrito (podría ofrecer mandarla a la chef).
export const isOffTopic = (modelText: string) =>
  modelText.includes(OFF_TOPIC_MARK)
