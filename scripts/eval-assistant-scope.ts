import 'dotenv/config'

import { answerQuestion, getTextModel } from '#/lib/assistant'
import { prefilter } from '#/lib/assistant-scope'
import { SCOPE_CASES } from '#/lib/assistant-scope-cases'
import type { ScopeCase } from '#/lib/assistant-scope-cases'
import { estimateCostUsd } from '#/lib/assistant-limits'

// Mide qué tan bien separa el asistente lo que es de repostería de lo ajeno, con el modelo de
// verdad (gasta unos centavos: ≈ 45 preguntas). Solo lee la base: no guarda preguntas ni uso.
// Califica lo que llega al modelo en producción: lo que el filtro previo ya atrapa no se manda.
// Cada pregunta se repite (el modelo no responde igual dos veces) y se cuenta cada intento.
// Uso: pnpm eval:assistant <id de una lección> [repeticiones, 3 por defecto]
// La clave de IA sale del .env y nunca se imprime.
const lessonId = process.argv[2]
const reps = Number(process.argv[3] ?? 3)
if (!lessonId)
  throw new Error('Uso: pnpm eval:assistant <id de una lección> [repeticiones]')
const model = getTextModel()
if (!model) throw new Error('Falta ANTHROPIC_API_KEY en el .env.')

type Result = { c: ScopeCase; offTopic: boolean; text: string }
const spent = { input: 0, output: 0 }

async function run(c: ScopeCase): Promise<Result> {
  const answer = await answerQuestion(lessonId, c.text, model, (u) => {
    spent.input += u.input
    spent.output += u.output
  })
  return {
    c,
    offTopic: answer.offTopic,
    text: answer.offTopic ? '(marcada como ajena)' : answer.text,
  }
}

async function main() {
  const viaModel = SCOPE_CASES.filter((c) => !c.filter)
  const viaFilter = SCOPE_CASES.filter((c) => c.filter)
  const caught = viaFilter.filter((c) => !prefilter(c.text).ok)
  console.log(
    `Filtro previo: atrapa ${caught.length} de ${viaFilter.length} de las que debe atrapar.`,
  )

  const results: Result[] = []
  const queue = viaModel.flatMap((c) => Array.from({ length: reps }, () => c))
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let c = queue.shift(); c; c = queue.shift())
        results.push(await run(c))
    }),
  )

  const graded = results.filter((r) => r.c.expected !== 'any')
  const right = (r: Result) => r.offTopic === (r.c.expected === 'off')
  for (const kind of ['en_tema', 'negocio', 'ajena', 'inyeccion'] as const) {
    const rows = graded.filter((r) => r.c.kind === kind)
    console.log(
      `${kind.padEnd(10)} ${rows.filter(right).length} de ${rows.length} bien`,
    )
  }
  const second = graded.filter((r) => r.c.round === 2)
  console.log(
    `Segunda ronda (casos escritos después de ajustar): ${second.filter(right).length} de ${second.length} bien`,
  )
  const wrong = graded.filter((r) => !right(r))
  const strayed = wrong.filter((r) => r.c.expected === 'off').length
  console.log(
    `\nSe colaron ${strayed} ajenas y se rechazaron ${wrong.length - strayed} de repostería, de ${graded.length} intentos.`,
  )
  console.log(`Fallos (${wrong.length}):`)
  for (const r of wrong) {
    console.log(
      `- [${r.c.kind}] esperaba ${r.c.expected === 'off' ? 'ajena' : 'respuesta'}: ${r.c.text}\n    → ${r.text.slice(0, 160)}`,
    )
  }
  console.log('\nSin calificar (decide la chef):')
  for (const r of results
    .filter((x) => x.c.expected === 'any')
    .filter((x, i, all) => all.findIndex((y) => y.c === x.c) === i)) {
    console.log(
      `- ${r.c.text}\n    → ${r.text.slice(0, 160).replace(/\n/g, ' ')}`,
    )
  }
  console.log(
    `\nGasto: ${spent.input} tokens de entrada y ${spent.output} de salida ≈ $${estimateCostUsd(spent.input, spent.output).toFixed(4)} USD`,
  )
}

await main()
process.exit(0)
