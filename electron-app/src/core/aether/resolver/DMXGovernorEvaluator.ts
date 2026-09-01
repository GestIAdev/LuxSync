/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏛️  DMX GOVERNOR ENGINE — Zero-Allocation Last-Mile Evaluator
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Función pura y sin estado evaluada por canal en _writeNode() a 44Hz.
 *
 * CONTRATO ZERO-ALLOC:
 * - Sin `new`, sin `.filter()`, sin `.map()`, sin spread en hot-path.
 * - Toda la evaluación es booleana por cortocircuito vía for-loops secuenciales.
 * - El array `governors` llega pre-congelado desde patch time (IDeviceDefinition).
 *
 * @module core/aether/resolver/DMXGovernorEvaluator
 */

import type { IDMXGovernor, GovernorIntentType } from '../device'

/**
 * Mapeo de ChannelType → GovernorIntentType para el matching de condiciones.
 * Lookup O(1) mediante objeto plano — zero-alloc.
 * Canales no presentes resuelven a 'fallback' (solo reglas wildcard los interceptan).
 */
const CHANNEL_TO_INTENT: Record<string, GovernorIntentType> = {
  dimmer:            'intensity',
  strobe:            'strobe',
  shutter:           'shutter',
  prism:             'prism',
  'prism-rotation':  'prism-rotation',
  gobo:              'gobo',
  'gobo-rotation':   'gobo',
  frost:             'frost',
  zoom:              'zoom',
  focus:             'focus',
  // 🚨 WAVE 7737: SAFETY INTENTS — habilita HARD_SAFETY_GOVERNORS
  // (types/FixtureDefinition.ts) para estos ChannelType.
  emission_gate:     'emission',
  fire_valve:        'fire',
  fire_ignite:       'fire',
  smoke_pump:        'smoke',
  smoke_density:     'smoke',
}

/**
 * Precomputa un mapa O(1) de gobernadores indexado por channelOffset.
 *
 * Construido en patch time (registerDevice). El array resultante tiene
 * 512 slots; cada slot contiene el IDMXGovernor cuyo channelIndex coincide
 * con ese offset, o undefined si no hay gobernador para ese canal.
 *
 * @param governors  Array desde IDeviceDefinition.dmxGovernors (congelado en patch time).
 * @returns          Array de 512 slots con IDMXGovernor | undefined.
 */
export function buildGovernorLookupMap(
  governors: readonly IDMXGovernor[],
): readonly (IDMXGovernor | undefined)[] {
  const map = new Array<IDMXGovernor | undefined>(512).fill(undefined)
  for (let gi = 0; gi < governors.length; gi++) {
    const gov = governors[gi]
    if (gov.channelIndex >= 0 && gov.channelIndex < 512 && map[gov.channelIndex] === undefined) {
      map[gov.channelIndex] = gov
    }
  }
  return map
}

/**
 * Evalúa la cadena de gobernadores DMX para un único write de canal.
 *
 * Algoritmo (sin allocations, O(1) lookup + O(rules) evaluación):
 *  1. Derivar intentType desde channelType via lookup O(1).
 *  2. Indexar govMap[channelOffset] — O(1) en lugar de scan lineal.
 *  3. Si hay gobernador, evaluar sus rules[] en orden.
 *  4. Primera regla cuya condición pase → aplicar acción y retornar.
 *  5. Si ningún match → retornar computedByte sin modificar.
 *
 * @param govMap        Precomputed lookup map from buildGovernorLookupMap().
 * @param channelOffset chDef.dmxOffset (0-based, relativo a la dirección base del device).
 * @param channelType   chDef.type (tipo semántico del canal).
 * @param normalized    rawNormalized (0.0-1.0, valor semántico pre-calibración).
 * @param computedByte  safeDmxValue (0-255, tras todos los transforms previos).
 * @returns             Byte DMX final [0-255].
 */
export function applyDMXGovernors(
  govMap:        readonly (IDMXGovernor | undefined)[],
  channelOffset: number,
  channelType:   string,
  normalized:    number,
  computedByte:  number,
): number {
  const intentType: GovernorIntentType = CHANNEL_TO_INTENT[channelType] ?? 'fallback'

  const gov = govMap[channelOffset]
  if (gov === undefined) return computedByte

  // Gobernador encontrado — evaluar sus reglas.
  for (let ri = 0; ri < gov.rules.length; ri++) {
      const rule = gov.rules[ri]
      const cond = rule.when

      // Condición de tipo: 'fallback' es comodín, cualquier otro debe coincidir exactamente.
      if (cond.intentType !== 'fallback' && cond.intentType !== intentType) continue
      // Condición de rango inferior (inclusive).
      if (cond.min !== undefined && normalized < cond.min) continue
      // Condición de rango superior (exclusivo).
      if (cond.max !== undefined && normalized >= cond.max) continue

      // ── Match confirmado → aplicar acción ──────────────────────────────
      const act = rule.then

      // forceByte: máxima precedencia, retorno inmediato.
      if (act.forceByte !== undefined) return act.forceByte

      // mapToRange: re-mapear input normalizado al rango físico declarado.
      let result = computedByte
      if (act.mapToRange !== undefined) {
        result = Math.round(act.mapToRange[0] + normalized * (act.mapToRange[1] - act.mapToRange[0]))
      }

      // clampMin: elevar el suelo físico si hay intent activo.
      if (act.clampMin !== undefined && result > 0 && result < act.clampMin) {
        result = act.clampMin
      }

      return result
    }

  return computedByte
}
