/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 RIG DRIFT — WAVE 8050 · M3: EL ESCENARIO CAMBIÓ ENTRE SESIONES
 *
 * Blueprint §Persistencia: al abrir se compara `project.rigFingerprint`
 * con la huella del atlas vivo. Si difiere → Rig Drift Report:
 *
 *   "El rig ha cambiado: [X] nodos de esta pila ya no existen,
 *    [Y] nodos nuevos sin asignar"
 *
 *   · Remapear por proximidad — cada nodo perdido hereda su coreografía
 *     al nodo nuevo más cercano en el plano XZ (posiciones selladas en
 *     `project.nodePositions` cuando se creó el documento).
 *   · Descartar huérfanos — los ids muertos salen de máscaras/entries.
 *   · Solo lectura — el proyecto se abre sin tocar; NUNCA un recompile
 *     silencioso (el compilador se bloquea mientras haya drift).
 *
 * La huella es un hash — los nodeIds se recuperan de la PROPIA pila
 * (máscaras de gestos + entries manuales), que es donde viven los ids
 * estables. "Nodos de esta pila" = los referenciados por el documento.
 *
 * Puro y síncrono — patch-time only, cero dependencias.
 *
 * @module HephaestusView/asteria/model/rigDrift
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { AsteriaProject, Gesture } from './AsteriaProject'
import type { NodeAtlas } from '../store/useAsteriaStore'
import { computeRigFingerprint } from './rigFingerprint'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface RigDrift {
  /** nodeIds que la pila referencia y ya no existen en el atlas. */
  readonly missing: readonly string[]
  /** nodeIds del atlas actual que ninguna máscara/entry toca. */
  readonly unassigned: readonly string[]
}

/** Resultado de un remapeo por proximidad. */
export interface RigRemapResult {
  readonly project: AsteriaProject
  /** Par (id perdido → id nuevo asignado). */
  readonly remapped: ReadonlyMap<string, string>
  /** Perdidos sin posición sellada — imposible mapear por proximidad. */
  readonly unmappable: readonly string[]
}

// ═══════════════════════════════════════════════════════════════════════════
// DETECCIÓN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * nodeIds referenciados por el documento: ∪ máscaras de gestos +
 * entries de gestos `manual` (orden de aparición, deduplicado).
 */
export function stackNodeIds(project: AsteriaProject): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const g of project.stack) {
    if (g.kind === 'manual') {
      for (const e of g.entries) {
        if (!seen.has(e.nodeId)) { seen.add(e.nodeId); out.push(e.nodeId) }
      }
    } else if ('mask' in g && g.mask) {
      for (const id of g.mask.nodeIds) {
        if (!seen.has(id)) { seen.add(id); out.push(id) }
      }
    }
  }
  return out
}

/**
 * Compara el proyecto con el atlas vivo. Devuelve null cuando no hay
 * drift: atlas ausente, huella no sellada (proyecto recién creado — la
 * sella `setNodeAtlas`) o huella idéntica.
 */
export function computeRigDrift(
  project: AsteriaProject,
  atlas: NodeAtlas | null,
): RigDrift | null {
  if (!atlas || project.rigFingerprint === '') return null
  const fp = computeRigFingerprint(atlas.entries.map((e) => e.nodeId))
  if (fp === project.rigFingerprint) return null

  const atlasIds = new Set(atlas.entries.map((e) => e.nodeId))
  const stackIds = new Set(stackNodeIds(project))
  const missing = [...stackIds].filter((id) => !atlasIds.has(id))
  const unassigned = atlas.entries
    .map((e) => e.nodeId)
    .filter((id) => !stackIds.has(id))
  return { missing, unassigned }
}

// ═══════════════════════════════════════════════════════════════════════════
// REESCRITURA DE IDS — máscaras de gestos + entries manuales
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Aplica `fn` a cada nodeId referenciado por la pila. `fn` devuelve el
 * id sustituto, el mismo id, o null para eliminar la referencia.
 */
function rewriteStackIds(
  stack: readonly Gesture[],
  fn: (id: string) => string | null,
): Gesture[] {
  const mapIds = (ids: readonly string[]): string[] => {
    const out: string[] = []
    for (const id of ids) {
      const r = fn(id)
      if (r !== null && !out.includes(r)) out.push(r)
    }
    return out
  }
  return stack.map((g) => {
    if (g.kind === 'manual') {
      const entries = g.entries
        .map((e) => {
          const r = fn(e.nodeId)
          return r === null ? null : { ...e, nodeId: r }
        })
        .filter((e): e is NonNullable<typeof e> => e !== null)
      return { ...g, entries }
    }
    if ('mask' in g && g.mask) {
      return { ...g, mask: { nodeIds: mapIds(g.mask.nodeIds) } }
    }
    return g
  })
}

/** Sello fresco del atlas vivo (huella + posiciones para futuros drift). */
export function sealRig(atlas: NodeAtlas): {
  rigFingerprint: string
  nodePositions: Record<string, { x: number; z: number }>
} {
  const nodePositions: Record<string, { x: number; z: number }> = {}
  for (const e of atlas.entries) {
    if (e.position) nodePositions[e.nodeId] = { x: e.position.x, z: e.position.z }
  }
  return {
    rigFingerprint: computeRigFingerprint(atlas.entries.map((e) => e.nodeId)),
    nodePositions,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ACCIONES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * REMAPEAR POR PROXIMIDAD: cada nodo perdido cede sus referencias al
 * nodo sin asignar más cercano en XZ. La posición del perdido se lee de
 * `project.nodePositions` (sellada al crear el documento) — sin ella el
 * nodo es `unmappable` y se reporta honestamente (sus ids quedan en la
 * pila; el fieldEngine los ignora hasta que el operador decida).
 * Cada nodo nuevo se consume UNA sola vez (desempate: suffix idéntico).
 */
export function remapByProximity(
  project: AsteriaProject,
  atlas: NodeAtlas,
  drift: RigDrift,
): RigRemapResult {
  const remapped = new Map<string, string>()
  const unmappable: string[] = []
  const available = drift.unassigned.filter(
    (id) => atlas.byNodeId.get(id)?.position !== undefined,
  )

  for (const lostId of drift.missing) {
    const pos = project.nodePositions?.[lostId]
    if (!pos) { unmappable.push(lostId); continue }
    let best: string | null = null
    let bestD = Infinity
    let bestSuffixHit = false
    const lostSuffix = lostId.slice(lostId.indexOf(':') + 1)
    for (const cand of available) {
      const cp = atlas.byNodeId.get(cand)!.position!
      const d = (cp.x - pos.x) ** 2 + (cp.z - pos.z) ** 2
      const suffixHit = cand.slice(cand.indexOf(':') + 1) === lostSuffix
      // Suffix idéntico gana a distancias similares; si no, distancia pura
      if (
        best === null ||
        (suffixHit && !bestSuffixHit) ||
        (suffixHit === bestSuffixHit && d < bestD)
      ) {
        best = cand
        bestD = d
        bestSuffixHit = suffixHit
      }
    }
    if (best === null) { unmappable.push(lostId); continue }
    remapped.set(lostId, best)
    available.splice(available.indexOf(best), 1)
  }

  const stack = rewriteStackIds(
    project.stack,
    (id) => remapped.get(id) ?? id,
  )
  return {
    project: { ...project, stack, ...sealRig(atlas) },
    remapped,
    unmappable,
  }
}

/**
 * DESCARTAR HUÉRFANOS: los ids muertos salen de máscaras y entries.
 * La pila queda limpia sobre el rig actual — se sella la huella nueva.
 */
export function discardOrphans(
  project: AsteriaProject,
  atlas: NodeAtlas,
  drift: RigDrift,
): AsteriaProject {
  const dead = new Set(drift.missing)
  const stack = rewriteStackIds(
    project.stack,
    (id) => (dead.has(id) ? null : id),
  )
  return { ...project, stack, ...sealRig(atlas) }
}
