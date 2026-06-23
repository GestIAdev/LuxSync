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
/**
 * Mapeo de ChannelType → GovernorIntentType para el matching de condiciones.
 * Lookup O(1) mediante objeto plano — zero-alloc.
 * Canales no presentes resuelven a 'fallback' (solo reglas wildcard los interceptan).
 */
const CHANNEL_TO_INTENT = {
    dimmer: 'intensity',
    strobe: 'strobe',
    shutter: 'shutter',
    prism: 'prism',
    'prism-rotation': 'prism-rotation',
    gobo: 'gobo',
    'gobo-rotation': 'gobo',
    frost: 'frost',
    zoom: 'zoom',
    focus: 'focus',
};
/**
 * Evalúa la cadena de gobernadores DMX para un único write de canal.
 *
 * Algoritmo (sin allocations, todos O(n) loops secuenciales):
 *  1. Derivar intentType desde channelType via lookup O(1).
 *  2. Recorrer governors[] buscando channelOffset coincidente.
 *  3. Al primer gobernador con match de canal, evaluar sus rules[].
 *  4. Primera regla cuya condición pase → aplicar acción y retornar.
 *  5. Si ningún match → retornar computedByte sin modificar.
 *
 * @param governors     Array desde IDeviceDefinition.dmxGovernors (congelado en patch time).
 * @param channelOffset chDef.dmxOffset (0-based, relativo a la dirección base del device).
 * @param channelType   chDef.type (tipo semántico del canal).
 * @param normalized    rawNormalized (0.0-1.0, valor semántico pre-calibración).
 * @param computedByte  safeDmxValue (0-255, tras todos los transforms previos).
 * @returns             Byte DMX final [0-255].
 */
export function applyDMXGovernors(governors, channelOffset, channelType, normalized, computedByte) {
    const intentType = CHANNEL_TO_INTENT[channelType] ?? 'fallback';
    for (let gi = 0; gi < governors.length; gi++) {
        const gov = governors[gi];
        if (gov.channelIndex !== channelOffset)
            continue;
        // Primer gobernador con channelIndex coincidente — evaluar sus reglas.
        for (let ri = 0; ri < gov.rules.length; ri++) {
            const rule = gov.rules[ri];
            const cond = rule.when;
            // Condición de tipo: 'fallback' es comodín, cualquier otro debe coincidir exactamente.
            if (cond.intentType !== 'fallback' && cond.intentType !== intentType)
                continue;
            // Condición de rango inferior (inclusive).
            if (cond.min !== undefined && normalized < cond.min)
                continue;
            // Condición de rango superior (exclusivo).
            if (cond.max !== undefined && normalized >= cond.max)
                continue;
            // ── Match confirmado → aplicar acción ──────────────────────────────
            const act = rule.then;
            // forceByte: máxima precedencia, retorno inmediato.
            if (act.forceByte !== undefined)
                return act.forceByte;
            // mapToRange: re-mapear input normalizado al rango físico declarado.
            let result = computedByte;
            if (act.mapToRange !== undefined) {
                result = Math.round(act.mapToRange[0] + normalized * (act.mapToRange[1] - act.mapToRange[0]));
            }
            // clampMin: elevar el suelo físico si hay intent activo.
            if (act.clampMin !== undefined && result > 0 && result < act.clampMin) {
                result = act.clampMin;
            }
            return result;
        }
        break; // El primer gobernador que coincide con channelOffset es autoritativo.
        // Ningún otro gobernador del mismo índice se evalúa.
    }
    return computedByte;
}
