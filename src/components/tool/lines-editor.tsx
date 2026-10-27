import { Trash2 } from 'lucide-react'

import { Picker } from '#/components/tool/picker'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import {
  defaultLineUnit,
  ingredientLineCost,
  lineUnits,
  piecesHint,
  premixLineCost,
} from '#/lib/cost-engine'
import type { EngineIngredient, Family } from '#/lib/cost-engine'
import { UNITS, formatPrice, formatQuantity, parseDecimal } from '#/lib/costs'
import type { CostUnit } from '#/lib/costs'

export type IngredientOption = EngineIngredient & {
  id: string
  name: string
  kind: 'INGREDIENT' | 'PACKAGING'
  archived: boolean
}

export type PremixOption = {
  id: string
  name: string
  archived: boolean
  family: Family
  perBase: number | null
  yieldUnit: CostUnit
}

// Un renglón mientras se edita: la cantidad es el texto que escribe la persona.
export type Line = {
  key: string
  kind: 'ingredient' | 'premix'
  refId: string
  quantity: string
  unit: CostUnit
}

let counter = 0
export const newKey = () => `l${Date.now()}-${counter++}`

// Unidades en las que se puede escribir la cantidad de una premezcla (las de lo que rinde).
const premixUnits = (family: Family): CostUnit[] =>
  family === 'volume' ? ['ML', 'L'] : ['G', 'KG']

// Qué cuesta un renglón (null mientras falte algo) y la nota "≈ 6 pzas de 57 g" del flexible.
export function lineResult(
  line: Line,
  ingredients: Map<string, IngredientOption>,
  premixes: Map<string, PremixOption>,
) {
  const quantity = parseDecimal(line.quantity)
  if (!quantity || !line.refId) return { cost: null, hint: null }
  if (line.kind === 'ingredient') {
    const ing = ingredients.get(line.refId)
    if (!ing) return { cost: null, hint: null }
    const hint = piecesHint(ing, quantity, line.unit)
    return {
      cost: ingredientLineCost(ing, quantity, line.unit),
      hint: hint
        ? `≈ ${formatQuantity(Math.round(hint.pieces * 10) / 10)} pzas de ${formatQuantity(Math.round(hint.avgGrams))} g`
        : null,
    }
  }
  const premix = premixes.get(line.refId)
  if (!premix) return { cost: null, hint: null }
  return {
    cost: premixLineCost(premix.perBase, premix.family, quantity, line.unit),
    hint: null,
  }
}

// Los renglones de una premezcla o de una receta: elegir el ingrediente (o la premezcla), escribir
// la cantidad y su unidad, y ver cuánto cuesta. El total lo pone quien lo usa.
export function LinesEditor({
  lines,
  onChange,
  ingredients,
  premixes,
  invalid,
  labels,
}: {
  lines: Line[]
  onChange: (lines: Line[]) => void
  ingredients: IngredientOption[]
  premixes?: PremixOption[]
  // Claves de renglones con algo mal (se marcan después de intentar guardar).
  invalid?: Set<string>
  // Textos cuando no son ingredientes (por ejemplo, el empaque de un producto).
  labels?: {
    column: string
    add: string
    placeholder: string
    search: string
    empty: string
  }
}) {
  const ingById = new Map(ingredients.map((i) => [i.id, i]))
  const premixById = new Map((premixes ?? []).map((p) => [p.id, p]))
  const update = (key: string, patch: Partial<Line>) =>
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
        <Table className="min-w-130 tabular-nums">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">
                {labels?.column ??
                  (premixes ? 'Ingrediente o premezcla' : 'Ingrediente')}
              </TableHead>
              <TableHead className="w-52">Cantidad</TableHead>
              <TableHead className="w-24 text-right">Costo</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => {
              const result = lineResult(line, ingById, premixById)
              const isPremix = line.kind === 'premix'
              const ing = ingById.get(line.refId)
              const premix = premixById.get(line.refId)
              const units = isPremix
                ? premix
                  ? premixUnits(premix.family)
                  : (['G'] as CostUnit[])
                : ing
                  ? lineUnits(ing)
                  : (['G'] as CostUnit[])
              const bad = invalid?.has(line.key)
              return (
                <TableRow key={line.key}>
                  <TableCell className="py-2 pl-4 align-top">
                    <div className="flex items-center gap-2">
                      <Picker
                        aria-label={
                          labels?.column ??
                          (isPremix ? 'Premezcla' : 'Ingrediente')
                        }
                        items={
                          isPremix
                            ? (premixes ?? [])
                                .filter(
                                  (p) => !p.archived || p.id === line.refId,
                                )
                                .map((p) => ({ id: p.id, label: p.name }))
                            : ingredients
                                .filter(
                                  (i) => !i.archived || i.id === line.refId,
                                )
                                .map((i) => ({
                                  id: i.id,
                                  label: i.name,
                                  hint:
                                    i.kind === 'PACKAGING'
                                      ? 'Empaque'
                                      : undefined,
                                }))
                        }
                        value={line.refId}
                        onChange={(id) => {
                          const next = isPremix
                            ? premixUnits(
                                premixById.get(id)?.family ?? 'weight',
                              )[0]
                            : ingById.get(id)
                              ? defaultLineUnit(ingById.get(id)!)
                              : line.unit
                          update(line.key, { refId: id, unit: next })
                        }}
                        placeholder={
                          labels?.placeholder ??
                          (isPremix
                            ? 'Elige una premezcla'
                            : 'Elige un ingrediente')
                        }
                        searchPlaceholder={
                          labels?.search ??
                          (isPremix ? 'Buscar premezcla' : 'Buscar ingrediente')
                        }
                        invalid={bad && !line.refId}
                      />
                    </div>
                    {isPremix && (
                      <Badge variant="secondary" className="mt-1">
                        Premezcla
                      </Badge>
                    )}
                    {result.hint && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {result.hint}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="py-2 align-top">
                    <div className="flex gap-2">
                      <Input
                        aria-label="Cantidad"
                        inputMode="decimal"
                        value={line.quantity}
                        onChange={(e) =>
                          update(line.key, { quantity: e.target.value })
                        }
                        aria-invalid={bad && !parseDecimal(line.quantity)}
                        className="w-24"
                      />
                      {units.length > 1 ? (
                        <Select
                          value={line.unit}
                          onValueChange={(u) =>
                            update(line.key, { unit: u as CostUnit })
                          }
                        >
                          <SelectTrigger aria-label="Unidad" className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {units.map((u) => (
                              <SelectItem key={u} value={u}>
                                {UNITS[u].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="flex h-9 items-center px-1 text-muted-foreground">
                          {UNITS[units[0]].label}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-2 text-right align-top">
                    <span className="flex h-9 items-center justify-end">
                      {result.cost === null ? '—' : formatPrice(result.cost)}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 pr-3 align-top">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Quitar renglón"
                      onClick={() =>
                        onChange(lines.filter((l) => l.key !== line.key))
                      }
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
            {lines.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="px-4 py-6 text-center text-muted-foreground"
                >
                  {labels?.empty ??
                    'Aún no hay nada. Agrega el primero con los botones de abajo.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onChange([
              ...lines,
              {
                key: newKey(),
                kind: 'ingredient',
                refId: '',
                quantity: '',
                unit: 'G',
              },
            ])
          }
        >
          {labels?.add ?? '+ Agregar ingrediente'}
        </Button>
        {premixes && (
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              onChange([
                ...lines,
                {
                  key: newKey(),
                  kind: 'premix',
                  refId: '',
                  quantity: '',
                  unit: 'G',
                },
              ])
            }
          >
            + Agregar premezcla
          </Button>
        )}
      </div>
    </div>
  )
}

// Cuántos renglones están completos y bien escritos: cantidad mayor a 0 y algo elegido.
export function lineProblems(lines: Line[]) {
  const bad = new Set<string>()
  for (const l of lines) {
    const q = parseDecimal(l.quantity)
    if (!l.refId || !q) bad.add(l.key)
  }
  return bad
}
