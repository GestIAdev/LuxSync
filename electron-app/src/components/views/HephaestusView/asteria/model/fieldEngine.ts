/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 FIELD ENGINE — WAVE 8030-P2: EL MOTOR DE CAMPOS
 *
 * Evalúa el Gesture Stack a un campo escalar por nodo — la representación
 * intermedia entre la pila no destructiva y el AsteriaCompiler:
 *
 *   stack: Gesture[]  ──►  fieldEngine.evaluate()  ──►  FieldSnapshot
 *                          O(N·G) ~0.2 ms                 delayMs[i]
 *                          N=400, G=8                     gain[i]
 *                                                        mask[i]
 *
 * DOGMA ZERO-ALLOC: `createFieldEngine(atlas)` devuelve un closure que
 * pre-asigna TODOS los TypedArrays una sola vez (sized to atlas) y los
 * muta in-place en cada evaluate. La evaluación es patch-time (commit de
 * gesto / cambio de parámetro), pero ni aún así se tolera churn: los
 * buffers se reutilizan y el snapshot devuelto es SIEMPRE la misma
 * referencia — los consumidores deben leer antes del próximo evaluate().
 *
 * Índices: el campo se indexa por POSICIÓN en `atlas.entries` (0..N-1),
 * no por nodeId — el índice nodeId→i se pre-construye una vez al crear
 * el engine (el atlas es una referencia estable del store).
 *
 * WAVE 8030-P2: solo `base` escribe delay/gain. El resto de kinds resuelve
 * su máscara de cobertura (mask[i]=1 — la huella espacial ya es visible en
 * el canvas) pero su matemática llega en P3: wave (distancia/velocidad),
 * chrono (trazo temporal), glyph (raster), slice (bucketing), noise
 * (Perlin), manual (entries directas).
 *
 * @module HephaestusView/asteria/model/fieldEngine
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { NodeAtlas } from '../store/useAsteriaStore'
import type { NodeAtlasEntry } from '../../../../../core/aether/types'
import type { Gesture, BaseGesture, NodeMask, BlendOp } from './AsteriaProject'

// ═══════════════════════════════════════════════════════════════════════════
// FIELD SNAPSHOT — el campo evaluado (buffers compartidos del engine)
// ═══════════════════════════════════════════════════════════════════════════

export interface FieldSnapshot {
  /** Número de nodos (= atlas.entries.length). */
  readonly count: number
  /** Retardo por nodo en ms — el eje temporal del campo. */
  readonly delayMs: Float32Array
  /** Ganancia por nodo [0..∞], identidad = 1 — el eje de intensidad. */
  readonly gain: Float32Array
  /** Cobertura: 1 si algún gesto reclamó el nodo, 0 si no. */
  readonly mask: Uint8Array
}

export interface FieldEngine {
  /** Evalúa la pila completa in-place y devuelve el snapshot compartido. */
  evaluate(stack: readonly Gesture[]): FieldSnapshot
  /** Índice del nodo en los buffers, o -1 si no está en el atlas. */
  indexOf(nodeId: string): number
  /** Número de nodos del atlas que este engine cubre. */
  readonly size: number
}

// ═══════════════════════════════════════════════════════════════════════════
// BLEND — operaciones del stack sobre el campo (usado por 'base' hoy;
// wave/chrono/glyph/slice/noise/manual lo consumen en P3)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Combina (d, g) sobre el nodo `i` según el BlendOp del gesto.
 * - delay: replace/min/max/add operan sobre delayMs; 'mul' escala.
 * - gain:  replace/min/max/add/mul operan sobre gain.
 */
function blendInto(
  delayMs: Float32Array,
  gain: Float32Array,
  i: number,
  op: BlendOp,
  d: number,
  g: number,
): void {
  switch (op) {
    case 'replace':
      delayMs[i] = d
      gain[i] = g
      break
    case 'min':
      if (d < delayMs[i]) delayMs[i] = d
      gain[i] *= g
      break
    case 'max':
      if (d > delayMs[i]) delayMs[i] = d
      gain[i] *= g
      break
    case 'add':
      delayMs[i] += d
      gain[i] *= g
      break
    case 'mul':
      delayMs[i] *= d
      gain[i] *= g
      break
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE FACTORY — closure con buffers pre-asignados
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Crea el motor para un atlas concreto. Pre-asigna:
 *   delayMs / gain / mask          — el snapshot (salida)
 *   posX / posZ / hasPosition      — geometría plana (P3: matemática espacial
 *                                    sin desreferenciar objetos en el loop)
 *   indexByNodeId                  — resolución O(1) de máscaras por NodeId
 *   scratchIdx                     — lista de índices cubiertos por gesto
 *
 * Re-crear el engine cuando cambie el atlas (topology_changed → nuevo
 * NodeAtlas) — los buffers dependen del tamaño N.
 */
export function createFieldEngine(atlas: NodeAtlas): FieldEngine {
  const n = atlas.entries.length

  const delayMs = new Float32Array(n)
  const gain = new Float32Array(n)
  const mask = new Uint8Array(n)

  // Geometría plana pre-extraída — los gestos espaciales (P3) iteran
  // Float32Arrays, nunca objetos NodeAtlasEntry.
  const posX = new Float32Array(n)
  const posZ = new Float32Array(n)
  const hasPosition = new Uint8Array(n)

  const indexByNodeId = new Map<string, number>()
  const entries: readonly NodeAtlasEntry[] = atlas.entries
  for (let i = 0; i < n; i++) {
    const e = entries[i]
    indexByNodeId.set(e.nodeId, i)
    if (e.position) {
      posX[i] = e.position.x
      posZ[i] = e.position.z
      hasPosition[i] = 1
    }
  }

  // Scratch: índices cubiertos por el gesto en curso (reutilizado por gesto)
  const scratchIdx = new Uint32Array(n)

  const snapshot: FieldSnapshot = { count: n, delayMs, gain, mask }

  /**
   * Resuelve una NodeMask a índices en scratchIdx. Devuelve el count.
   * NodeIds huérfanos (rig drift, atlas re-patcheado) se ignoran — el
   * fingerprint del proyecto los reporta por separado (§5.3).
   */
  function resolveMask(m: NodeMask): number {
    let cnt = 0
    const ids = m.nodeIds
    for (let k = 0; k < ids.length; k++) {
      const i = indexByNodeId.get(ids[k])
      if (i !== undefined) scratchIdx[cnt++] = i
    }
    return cnt
  }

  /** BASE: suelo uniforme — replace implícito, sin máscara (cubre todo). */
  function applyBase(g: BaseGesture): void {
    for (let i = 0; i < n; i++) {
      blendInto(delayMs, gain, i, 'replace', g.delayMs, g.gain)
      mask[i] = 1
    }
  }

  function evaluate(stack: readonly Gesture[]): FieldSnapshot {
    // Reset a la identidad: delay 0, gain 1, sin cobertura
    delayMs.fill(0)
    gain.fill(1)
    mask.fill(0)

    for (let g = 0; g < stack.length; g++) {
      const gesture = stack[g]
      switch (gesture.kind) {
        case 'base':
          applyBase(gesture)
          break

        // WAVE 8030-P3: matemática espacial por kind.
        // De momento solo se resuelve la HUELLA (mask) — el canvas puede
        // visualizar qué nodos cubre cada gesto antes de que exista el
        // campo de valores.
        case 'manual': {
          // manual no tiene mask propia: su cobertura son sus entries
          const list = gesture.entries
          for (let k = 0; k < list.length; k++) {
            const i = indexByNodeId.get(list[k].nodeId)
            if (i !== undefined) mask[i] = 1
          }
          break
        }
        default: {
          const cnt = resolveMask(gesture.mask)
          for (let k = 0; k < cnt; k++) mask[scratchIdx[k]] = 1
          break
        }
      }
    }

    return snapshot
  }

  return {
    evaluate,
    indexOf: (nodeId) => indexByNodeId.get(nodeId) ?? -1,
    size: n,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVENIENCE — evaluación one-shot (aloca buffers por llamada; para uso
// repetido crear el engine y reusar)
// ═══════════════════════════════════════════════════════════════════════════

export function evaluateStack(stack: readonly Gesture[], atlas: NodeAtlas): FieldSnapshot {
  return createFieldEngine(atlas).evaluate(stack)
}
