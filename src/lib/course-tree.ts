type Node = {
  id: string
  parentId: string | null
  kind: 'BLOCK' | 'CHAPTER' | 'LESSON'
}

// Dónde queda un elemento arrastrado: dentro de `parentId`, como primer hijo
// (`first`) o junto a un hermano (`before` / `after` de `anchorId`).
export type Placement =
  | { parentId: string | null; mode: 'first' }
  | { parentId: string | null; mode: 'before' | 'after'; anchorId: string }

// Reglas de arrastrar un elemento (`id`) sobre otro (`overId`):
//  - bloque: se mueve entero junto al bloque donde cae;
//  - sobre un bloque, un capítulo o lección pasa a ser su primer hijo;
//  - capítulo: cae junto a otro capítulo, o junto al capítulo/lección donde cae, dentro de su bloque;
//  - lección sobre un capítulo: pasa a ser su primera lección; sobre otra lección: queda junto a ella.
// Cada elemento solo puede quedar donde el árbol lo permite (bloque en la raíz,
// capítulo en un bloque, lección en un bloque o capítulo). Devuelve null si no hay movimiento.
export function resolveMove(
  nodes: Node[],
  id: string,
  overId: string,
  after: boolean,
): Placement | null {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const x = byId.get(id)
  const y = byId.get(overId)
  if (!x || !y || x.id === y.id) return null

  const parent = (n: Node) => (n.parentId ? byId.get(n.parentId) : undefined)
  const blockOf = (n: Node): Node =>
    n.kind === 'BLOCK' ? n : blockOf(parent(n) as Node)
  const mode = after ? 'after' : 'before'

  let placement: Placement
  if (x.kind === 'BLOCK') {
    placement = { parentId: null, mode, anchorId: blockOf(y).id }
  } else if (y.kind === 'BLOCK') {
    placement = { parentId: y.id, mode: 'first' }
  } else if (x.kind === 'CHAPTER') {
    const block = blockOf(y)
    const anchor = y.kind === 'CHAPTER' ? y : (parent(y) as Node)
    placement = {
      parentId: block.id,
      mode,
      anchorId: anchor.kind === 'BLOCK' ? y.id : anchor.id,
    }
  } else if (y.kind === 'CHAPTER') {
    placement = { parentId: y.id, mode: 'first' }
  } else {
    placement = { parentId: y.parentId, mode, anchorId: y.id }
  }

  // Soltar sobre sí mismo o sobre algo suyo no mueve nada.
  if ('anchorId' in placement && placement.anchorId === x.id) return null
  return placement
}
