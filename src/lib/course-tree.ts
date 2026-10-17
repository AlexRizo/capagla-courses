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

// Zona de la fila donde se suelta: arriba (`before`), en medio (`inside`) o abajo (`after`).
export type DropZone = 'before' | 'inside' | 'after'

// Zona según dónde está el puntero dentro de la fila (`ratio`: 0 arriba, 1 abajo).
// Una fila que puede contener lo arrastrado (un capítulo para una lección) tiene tres zonas;
// las demás, mitad y mitad.
export function zoneFor(
  nodes: Node[],
  id: string,
  overId: string,
  ratio: number,
): DropZone {
  const x = nodes.find((n) => n.id === id)
  const y = nodes.find((n) => n.id === overId)
  if (x?.kind === 'LESSON' && y?.kind === 'CHAPTER') {
    return ratio < 0.3 ? 'before' : ratio > 0.7 ? 'after' : 'inside'
  }
  return ratio < 0.5 ? 'before' : 'after'
}

// Reglas de arrastrar un elemento (`id`) sobre otro (`overId`) en una `zone`:
//  - bloque: se mueve entero antes o después del bloque donde cae;
//  - sobre un bloque, un capítulo o lección pasa a ser su primer hijo (en cualquier zona);
//  - capítulo: cae antes o después de otro capítulo, o del capítulo en que está la lección
//    donde cae (dentro de su bloque);
//  - lección sobre un capítulo: arriba queda antes del capítulo y abajo después de él (fuera,
//    en el bloque); en medio pasa a ser su primera lección;
//  - lección sobre otra lección: antes o después de ella, en su mismo capítulo o bloque
//    (así se suelta al final de un capítulo).
// Cada elemento solo puede quedar donde el árbol lo permite (bloque en la raíz,
// capítulo en un bloque, lección en un bloque o capítulo). Devuelve null si no hay movimiento.
export function resolveDrop(
  nodes: Node[],
  id: string,
  overId: string,
  zone: DropZone,
): Placement | null {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const x = byId.get(id)
  const y = byId.get(overId)
  if (!x || !y || x.id === y.id) return null

  const parent = (n: Node) => (n.parentId ? byId.get(n.parentId) : undefined)
  const blockOf = (n: Node): Node =>
    n.kind === 'BLOCK' ? n : blockOf(parent(n) as Node)
  // Sin zona "en medio", se cae en la mitad más cercana.
  const mode = zone === 'after' ? 'after' : 'before'

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
    placement =
      zone === 'inside'
        ? { parentId: y.id, mode: 'first' }
        : { parentId: y.parentId, mode, anchorId: y.id }
  } else {
    placement = { parentId: y.parentId, mode, anchorId: y.id }
  }

  // Soltar sobre sí mismo o sobre algo suyo no mueve nada.
  if ('anchorId' in placement && placement.anchorId === x.id) return null
  return placement
}
