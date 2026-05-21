// ════════════════════════════════════════════════════════════════════════════
// 🔬 WAVE 4817 — INFER ARCHETYPES  (FASE 3: El Inversor Semántico)
// ════════════════════════════════════════════════════════════════════════════
//  Reverse-lookup: dado un vector ACO crudo (movido manualmente por el usuario
//  o producido por el Genesis Engine), devuelve la etiqueta semántica
//  `UserArchetype` que mejor describe ese punto en el cubo.
//
//  Algoritmo principal: distancia euclidiana ponderada al centroide canónico
//  de cada arquetipo, con una capa de "zone containment" para desempates.
//
//  Por qué esto importa:
//   - Cuando el Genesis Engine muta un clip y ajusta ACO directamente, la UI
//     puede mostrar la etiqueta semántica más cercana sin perder legibilidad.
//   - Cuando el operador arrastra los sliders en Expert Mode, la etiqueta
//     se actualiza en tiempo real, con animación de "morphing".
//
//  Referencias:
//   - docs/blueprints/WAVE-4816-UX-BLUEPRINT.md §3.3 `inferArchetypes()`
//   - src/core/arsenal/LfxClipInstance.ts ARCHETYPE_BIAS_MAP (centroides)
// ════════════════════════════════════════════════════════════════════════════

import {
  USER_ARCHETYPES,
  ARCHETYPE_BIAS_MAP,
  ENERGY_ZONES,
  type UserArchetype,
  type AcoTriad,
  type EnergyZoneId,
} from './LfxClipInstance'

// ─── TIPOS PÚBLICOS ─────────────────────────────────────────────────────────

/** Resultado enriquecido del reverse-lookup. */
export interface ArchetypeInference {
  /** La etiqueta semántica más cercana. */
  readonly archetype: UserArchetype
  /** Distancia euclidiana al centroide del arquetipo ganador [0..√3]. */
  readonly distance: number
  /** Confianza normalizada en [0..1] (1 = exactamente en el centroide). */
  readonly confidence: number
  /** Si la confianza es < 0.4, el punto está en tierra de nadie. */
  readonly isAmbiguous: boolean
  /** Ranking completo, ordenado por distancia ascendente. */
  readonly ranking: readonly ArchetypeCandidate[]
}

export interface ArchetypeCandidate {
  readonly archetype: UserArchetype
  readonly distance: number
  readonly confidence: number
}

// ─── CONSTANTES ─────────────────────────────────────────────────────────────

/** √3 ≈ 1.7320… — distancia máxima posible en el cubo unitario [0,1]³. */
const MAX_DISTANCE = Math.SQRT2 * Math.SQRT2 * Math.sqrt(3) / Math.sqrt(3)
// Equivalente a: Math.sqrt(1² + 1² + 1²) = √3

/**
 * Pesos dimensionales para la distancia.
 * `aggression` tiene peso ligeramente mayor porque discrimina mejor entre
 * 'ambient' y 'heavy'/'strobe'/'divine'. `organicity` diferencia 'divine'
 * de 'strobe' (mismo agression high, organicity distinta).
 */
const AXIS_WEIGHTS: Readonly<AcoTriad> = Object.freeze({
  aggression: 1.2,
  chaos: 0.9,
  organicity: 1.0,
})

const AMBIGUITY_THRESHOLD = 0.4

// ─── HELPERS INTERNOS ───────────────────────────────────────────────────────

/** Distancia euclidiana ponderada entre dos puntos en [0,1]³. */
function weightedDistance(a: AcoTriad, b: Readonly<AcoTriad>): number {
  const dA = (a.aggression - b.aggression) * AXIS_WEIGHTS.aggression
  const dC = (a.chaos - b.chaos) * AXIS_WEIGHTS.chaos
  const dO = (a.organicity - b.organicity) * AXIS_WEIGHTS.organicity
  return Math.sqrt(dA * dA + dC * dC + dO * dO)
}

/** Distancia máxima posible con los pesos actuales (corner-to-corner). */
const MAX_WEIGHTED_DISTANCE = weightedDistance(
  { aggression: 0, chaos: 0, organicity: 0 },
  { aggression: 1, chaos: 1, organicity: 1 },
)

/**
 * Comprueba si el punto cae dentro de la región de "containment" del bias.
 * Un punto está "contenido" si cumple TODOS los bounds presentes en el bias.
 * (Bonus de desempate: +0.1 de confianza si está contenido.)
 */
function isContainedByBias(aco: AcoTriad, arch: UserArchetype): boolean {
  const bias = ARCHETYPE_BIAS_MAP[arch]
  if (bias.aggressionMin != null && aco.aggression < bias.aggressionMin) return false
  if (bias.aggressionMax != null && aco.aggression > bias.aggressionMax) return false
  if (bias.chaosMin != null && aco.chaos < bias.chaosMin) return false
  if (bias.chaosMax != null && aco.chaos > bias.chaosMax) return false
  if (bias.organicityMin != null && aco.organicity < bias.organicityMin) return false
  if (bias.organicityMax != null && aco.organicity > bias.organicityMax) return false
  return true
}

/**
 * Verifica si `zones` tiene al menos una zona en la `allowedZones` del bias.
 * Si se pasan zonas, aplica bonus a la confianza.
 * Si no se pasan zonas, este factor es neutral.
 */
function zoneCompatibility(
  zones: readonly EnergyZoneId[] | undefined,
  arch: UserArchetype,
): number {
  if (!zones || zones.length === 0) return 0
  const allowed = ARCHETYPE_BIAS_MAP[arch].allowedZones
  if (!allowed || allowed.length === 0) return 0.05  // utility bonus pequeño
  const allowedSet = new Set(allowed)
  const match = zones.some(z => allowedSet.has(z))
  return match ? 0.08 : -0.05
}

// ─── API PÚBLICA ─────────────────────────────────────────────────────────────

/**
 * Inferencia principal. Devuelve el arquetipo que mejor describe el punto ACO.
 *
 * @param aco     Tríada ACO cruda (valores en [0..1]). Si algún valor está
 *                fuera de rango se clampea internamente sin lanzar.
 * @param zones   Opcional: las zonas activas en el clip, usadas como tie-
 *                breaker en caso de empate cercano.
 */
export function inferArchetypeFromACO(
  aco: { aggression: number; chaos: number; organicity: number },
  zones?: readonly EnergyZoneId[],
): ArchetypeInference {
  // Clamp defensivo (no debe lanzar — se llama en hot path de sliders)
  const safe: AcoTriad = {
    aggression: Math.max(0, Math.min(1, Number.isFinite(aco.aggression) ? aco.aggression : 0.5)),
    chaos: Math.max(0, Math.min(1, Number.isFinite(aco.chaos) ? aco.chaos : 0.5)),
    organicity: Math.max(0, Math.min(1, Number.isFinite(aco.organicity) ? aco.organicity : 0.5)),
  }

  // Calcular distancia + bonuses para cada arquetipo
  const candidates: Array<{ archetype: UserArchetype; rawScore: number }> = []

  for (const arch of USER_ARCHETYPES) {
    const centroid = ARCHETYPE_BIAS_MAP[arch].centroid
    const dist = weightedDistance(safe, centroid)

    // Normalizar a [0..1] (0 = en el centroide exacto)
    const normalized = Math.min(1, dist / MAX_WEIGHTED_DISTANCE)

    // Confidence base = 1 - normalized
    let confidence = 1 - normalized

    // Bonus: punto dentro del region de bias
    if (isContainedByBias(safe, arch)) confidence += 0.10

    // Bonus/malus: zonas compatibles
    confidence += zoneCompatibility(zones, arch)

    // Clamp final
    confidence = Math.max(0, Math.min(1, confidence))

    candidates.push({ archetype: arch, rawScore: confidence })
  }

  // Ordenar por confianza descendente
  candidates.sort((a, b) => b.rawScore - a.rawScore)

  const winner = candidates[0]
  const winnerDist = weightedDistance(safe, ARCHETYPE_BIAS_MAP[winner.archetype].centroid)

  const ranking: readonly ArchetypeCandidate[] = Object.freeze(
    candidates.map(c => Object.freeze({
      archetype: c.archetype,
      distance: weightedDistance(safe, ARCHETYPE_BIAS_MAP[c.archetype].centroid),
      confidence: c.rawScore,
    })),
  )

  return Object.freeze({
    archetype: winner.archetype,
    distance: winnerDist,
    confidence: winner.rawScore,
    isAmbiguous: winner.rawScore < AMBIGUITY_THRESHOLD,
    ranking,
  })
}

/**
 * Variante simplificada que devuelve solo el `UserArchetype` ganador.
 * Equivalente al contrato declarado en `LfxClipInstance.inferArchetypes()`.
 */
export function inferArchetype(
  aco: { aggression: number; chaos: number; organicity: number },
  zones?: readonly EnergyZoneId[],
): UserArchetype {
  return inferArchetypeFromACO(aco, zones).archetype
}

/**
 * Batch: infiere el arquetipo para un array de snapshots ACO.
 * Útil para el Genesis Engine cuando evalúa una generación completa.
 */
export function inferArchetypesBatch(
  items: ReadonlyArray<{
    aco: { aggression: number; chaos: number; organicity: number }
    zones?: readonly EnergyZoneId[]
  }>,
): readonly ArchetypeInference[] {
  return Object.freeze(items.map(({ aco, zones }) => inferArchetypeFromACO(aco, zones)))
}

/**
 * Devuelve una frase semántica corta (en inglés) para un valor de eje.
 * Usada por la UI para la lectura textual bajo los sliders ACO.
 *
 * Tabla:
 *   aggression: [0..0.25] gentle · [0.25..0.50] balanced · [0.50..0.75] aggressive · [0.75..1] brutal
 *   chaos:      [0..0.25] steady  · [0.25..0.50] measured · [0.50..0.75] erratic · [0.75..1] chaotic
 *   organicity: [0..0.25] synthetic · [0.25..0.50] structured · [0.50..0.75] organic · [0.75..1] alive
 */
export function semanticLabel(
  axis: 'aggression' | 'chaos' | 'organicity',
  value: number,
): string {
  const v = Math.max(0, Math.min(1, value))

  if (axis === 'aggression') {
    if (v < 0.25) return 'gentle touch'
    if (v < 0.50) return 'balanced heart'
    if (v < 0.75) return 'aggressive push'
    return 'brutal force'
  }

  if (axis === 'chaos') {
    if (v < 0.25) return 'steady rhythm'
    if (v < 0.50) return 'measured swing'
    if (v < 0.75) return 'erratic pulse'
    return 'pure chaos'
  }

  // organicity
  if (v < 0.25) return 'cold machine'
  if (v < 0.50) return 'structured flow'
  if (v < 0.75) return 'warm flesh'
  return 'pure organism'
}

/**
 * Genera una descripción narrativa de una línea combinando los tres ejes.
 * Ejemplos:
 *   {A:0.92, C:0.50, O:0.50} → "Brutal force / Measured swing / Structured flow"
 *   {A:0.20, C:0.20, O:0.75} → "Gentle touch / Steady rhythm / Warm flesh"
 */
export function narrativeDescription(aco: {
  aggression: number
  chaos: number
  organicity: number
}): string {
  return [
    semanticLabel('aggression', aco.aggression),
    semanticLabel('chaos', aco.chaos),
    semanticLabel('organicity', aco.organicity),
  ].join(' · ')
}
