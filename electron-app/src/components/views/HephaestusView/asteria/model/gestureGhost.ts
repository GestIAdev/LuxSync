/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 GESTURE GHOST — WAVE 8150-F4: TARGETS DE LA CAPA SELECCIONADA
 *
 * Resuelve qué nodeIds domina un gesto del stack — para el ghosting del
 * lienzo cuando el operador selecciona una capa en el Gesture Stack.
 *
 *   - base   → todo el rig (la capa fondo cubre el atlas entero)
 *   - manual → entries[].nodeId (las entries SON el campo)
 *   - resto  → mask.nodeIds (la máscara persistida del gesto)
 *
 * Zero-Alloc honesto: los gestos son INMUTABLES (cada patch crea objeto
 * nuevo) → WeakMap<Gesture, {atlas, ids}> cachea la resolución por
 * identidad; las entradas de gestos borrados las recoge el GC solo.
 *
 * @module HephaestusView/asteria/model/gestureGhost
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { Gesture, GestureKind } from './AsteriaProject'
import type { NodeAtlas } from '../store/useAsteriaStore'

// ─────────────────────────────────────────────────────────────────────────────
// PALETA POR KIND — coherente con KIND_ICON del GestureStackPanel
// ─────────────────────────────────────────────────────────────────────────────

/** Color del anillo fantasma por kind de gesto (RGB para alpha variable). */
export const GHOST_RGB: Record<GestureKind, readonly [number, number, number]> = {
  base:   [230, 225, 255], // violeta-hielo — el suelo del campo
  wave:   [ 92, 225, 255], // cian — frente de onda
  chrono: [255,  92, 225], // magenta — pincel temporal
  glyph:  [255, 195,  92], // ámbar — tinta del texto
  slice:  [125, 255, 154], // verde — rebanado
  manual: [255, 255, 255], // blanco — cirugía directa
  noise:  [255, 138,  92], // naranja — lo orgánico
}

// ─────────────────────────────────────────────────────────────────────────────
// RESOLVER CON CACHÉ POR IDENTIDAD
// ─────────────────────────────────────────────────────────────────────────────

const _cache = new WeakMap<Gesture, { atlas: NodeAtlas | null; ids: Set<string> }>()

/**
 * nodeIds targeteados por el gesto, contra el atlas vivo.
 * Cacheado por identidad del objeto gesto + referencia del atlas —
 * el RAF la llama a 60fps sin pagar el coste tras el primer hit.
 */
export function gestureGhostIds(
  g: Gesture,
  atlas: NodeAtlas | null,
): ReadonlySet<string> {
  const hit = _cache.get(g)
  if (hit && hit.atlas === atlas) return hit.ids

  const ids = new Set<string>()
  if (g.kind === 'base') {
    // BASE no lleva máscara — domina el rig entero (honesto: así lo
    // interpreta el field engine, el ghost dice la verdad).
    if (atlas) {
      const entries = atlas.entries
      for (let i = 0; i < entries.length; i++) ids.add(entries[i].nodeId)
    }
  } else if (g.kind === 'manual') {
    for (const en of g.entries) ids.add(en.nodeId)
  } else {
    for (const id of g.mask.nodeIds) ids.add(id)
  }

  _cache.set(g, { atlas, ids })
  return ids
}

/** Color del ghosting por kind. */
export function gestureGhostColor(
  g: Gesture,
): readonly [number, number, number] {
  return GHOST_RGB[g.kind]
}
