// ════════════════════════════════════════════════════════════════════════════
// 🛡️ WAVE 4817 — GATEKEEPER LINTER  (FASE 2: El Validador Ético)
// ════════════════════════════════════════════════════════════════════════════
//  Auditor estático del átomo `LfxClipInstance`. Aplica las reglas reales
//  del Gatekeeper / SafetyMiddleware extraídas en SELENE-REALITY-MAPPING.md
//  ANTES de que el clip se exporte o registre. Devuelve `LinterResult` con
//  warnings/errores estructurados (UI consume luego).
//
//  Doctrina:
//   - Cualquier `error` o `critical` bloquea el guardado (`canSave === false`).
//   - Los `warning` se muestran pero no bloquean.
//   - Las reglas son puras: validateClip() es zero-side-effect y no muta el clip.
//
//  Referencias:
//   - docs/blueprints/WAVE-4816-UX-BLUEPRINT.md §5 (las 12 reglas + UX)
//   - docs/SELENE-REALITY-MAPPING.md             (umbrales y motores reales)
// ════════════════════════════════════════════════════════════════════════════
import { ENERGY_ZONES, ARCHETYPE_BIAS_MAP } from './LfxClipInstance';
// ─── CONSTANTES (umbrales reales mapeados de SELENE-REALITY-MAPPING) ───────
const AMBIENT_AGGRESSION_HARD_CEILING = 0.35;
const STROBE_FREQ_MAX_SAFE_HZ = 25;
const STROBE_FREQ_MIN_RECOMMENDED_HZ = 3; // < 3Hz no califica como strobe perceptual
/** Zonas "duras" donde un efecto HEAVY/STROBE/DIVINE debe tener al menos una entrada. */
const HARD_ZONES = new Set([
    'active',
    'intense',
    'peak',
]);
/** Zonas bajas donde un efecto AMBIENT/UTILITY-low se siente natural. */
const LOW_ZONES = new Set([
    'silence',
    'valley',
    'ambient',
    'gentle',
]);
// ─── BUILDERS DE WARNINGS ───────────────────────────────────────────────────
function summarize(warnings) {
    let info = 0, warning = 0, error = 0, critical = 0;
    for (const w of warnings) {
        if (w.severity === 'info')
            info++;
        else if (w.severity === 'warning')
            warning++;
        else if (w.severity === 'error')
            error++;
        else if (w.severity === 'critical')
            critical++;
    }
    return Object.freeze({ info, warning, error, critical });
}
function hasAnyHardZone(zones) {
    for (const z of zones)
        if (HARD_ZONES.has(z))
            return true;
    return false;
}
function hasAnyLowZone(zones) {
    for (const z of zones)
        if (LOW_ZONES.has(z))
            return true;
    return false;
}
/**
 * R0 factory — validates the RAW (pre-bake) ACO triad against the
 * ARCHETYPE_BIAS_MAP envelope for the given clip's archetype.
 *
 * CRITICAL DESIGN NOTE:
 *   LfxClipInstance.bakeCognitiveDNA() clamps the acoTriad **in the
 *   constructor** before the linter ever reads it. Therefore, reading
 *   `clip.acoTriad` always yields a value that already satisfies the
 *   constraints — the violation is invisible to the linter.
 *
 *   Solution: the factory receives the UNCLAMPED `rawAco` (straight from
 *   the UI slider state) as a closure parameter, so the comparison is
 *   always against what the user actually typed, not what the engine
 *   silently corrected.
 */
function makeBiasRule(rawAco) {
    return (clip) => {
        const bias = ARCHETYPE_BIAS_MAP[clip.userArchetype];
        if (!bias)
            return null;
        const { aggression, chaos, organicity } = rawAco;
        const violations = [];
        if (bias.aggressionMin !== undefined && aggression < bias.aggressionMin)
            violations.push(`aggression=${aggression.toFixed(2)} < min ${bias.aggressionMin.toFixed(2)}`);
        if (bias.aggressionMax !== undefined && aggression > bias.aggressionMax)
            violations.push(`aggression=${aggression.toFixed(2)} > max ${bias.aggressionMax.toFixed(2)}`);
        if (bias.chaosMin !== undefined && chaos < bias.chaosMin)
            violations.push(`chaos=${chaos.toFixed(2)} < min ${bias.chaosMin.toFixed(2)}`);
        if (bias.chaosMax !== undefined && chaos > bias.chaosMax)
            violations.push(`chaos=${chaos.toFixed(2)} > max ${bias.chaosMax.toFixed(2)}`);
        if (bias.organicityMin !== undefined && organicity < bias.organicityMin)
            violations.push(`organicity=${organicity.toFixed(2)} < min ${bias.organicityMin.toFixed(2)}`);
        if (bias.organicityMax !== undefined && organicity > bias.organicityMax)
            violations.push(`organicity=${organicity.toFixed(2)} > max ${bias.organicityMax.toFixed(2)}`);
        if (violations.length === 0)
            return null;
        return Object.freeze({
            id: 'ARCHETYPE_BIAS_VIOLATION',
            severity: 'error',
            title: 'Archetype Bias Violation',
            message: `Archetype "${clip.userArchetype}" requires an ACO envelope that the current triad ` +
                `violates: ${violations.join(' · ')}. ` +
                `Adjust the sliders to satisfy the bias constraints, or choose a different archetype.`,
            affectedFields: Object.freeze(['userArchetype', 'acoTriad']),
            seleneCorrelation: Object.freeze({
                engine: 'EnergyConsciousness',
                rule: 'archetype_bias_clamp',
            }),
        });
    };
}
/** R1: archetype='ambient' con aggression > 0.35 → peligro físico. */
const ruleAmbientAggressionOverflow = (clip) => {
    if (clip.userArchetype !== 'ambient')
        return null;
    if (clip.acoTriad.aggression <= AMBIENT_AGGRESSION_HARD_CEILING)
        return null;
    return Object.freeze({
        id: 'AMBIENT_AGGRESSION_OVERFLOW',
        severity: 'critical',
        title: 'Ambient archetype with aggressive ACO',
        message: `Archetype is "ambient" but aggression=${clip.acoTriad.aggression.toFixed(2)} ` +
            `exceeds the hard ceiling ${AMBIENT_AGGRESSION_HARD_CEILING.toFixed(2)}. ` +
            `Physical engines may overdrive movers and fixtures will receive harsh deltas ` +
            `that contradict the ambient intent.`,
        affectedFields: Object.freeze(['userArchetype', 'acoTriad.aggression']),
        seleneCorrelation: Object.freeze({
            engine: 'EnergyConsciousness',
            rule: 'ambient_aggression_ceiling',
            threshold: AMBIENT_AGGRESSION_HARD_CEILING,
        }),
    });
};
/** R2: archetype='strobe' y maxStrobeFreqHz > 25 → bloquea (epilepsia safety). */
const ruleStrobeFreqDangerous = (clip) => {
    if (clip.userArchetype !== 'strobe')
        return null;
    if (clip.maxStrobeFreqHz <= STROBE_FREQ_MAX_SAFE_HZ)
        return null;
    return Object.freeze({
        id: 'STROBE_FREQ_DANGEROUS',
        severity: 'critical',
        title: 'Strobe frequency above safe ceiling',
        message: `maxStrobeFreqHz=${clip.maxStrobeFreqHz}Hz exceeds the safety ceiling ` +
            `(${STROBE_FREQ_MAX_SAFE_HZ}Hz). Selene's SafetyMiddleware will reject this clip ` +
            `at ingest (Gate G6 — epilepsy risk).`,
        affectedFields: Object.freeze(['maxStrobeFreqHz']),
        seleneCorrelation: Object.freeze({
            engine: 'SafetyMiddleware',
            rule: 'G6_strobe_frequency',
            threshold: STROBE_FREQ_MAX_SAFE_HZ,
        }),
    });
};
/** R3: archetype='strobe' pero maxStrobeFreqHz=0 → declaración faltante. */
const ruleStrobeFreqUndeclared = (clip) => {
    if (clip.userArchetype !== 'strobe')
        return null;
    if (clip.maxStrobeFreqHz > 0)
        return null;
    return Object.freeze({
        id: 'STROBE_FREQ_UNDECLARED',
        severity: 'error',
        title: 'Strobe archetype without declared frequency',
        message: `Archetype "strobe" requires maxStrobeFreqHz > 0. Selene cannot route this clip ` +
            `through the strobe-safe path without a declared frequency.`,
        affectedFields: Object.freeze(['maxStrobeFreqHz']),
        seleneCorrelation: Object.freeze({
            engine: 'SafetyMiddleware',
            rule: 'G6_strobe_declaration',
        }),
    });
};
/** R3b: strobe declarado bajo (< 3Hz) → no funcionará como strobe. */
const ruleStrobeLowFreq = (clip) => {
    if (clip.userArchetype !== 'strobe')
        return null;
    if (clip.maxStrobeFreqHz === 0)
        return null; // ya cubierto por R3
    if (clip.maxStrobeFreqHz >= STROBE_FREQ_MIN_RECOMMENDED_HZ)
        return null;
    return Object.freeze({
        id: 'STROBE_LOW_FREQ_FOR_ARCHETYPE',
        severity: 'warning',
        title: 'Strobe frequency too low to be perceptual',
        message: `maxStrobeFreqHz=${clip.maxStrobeFreqHz}Hz is below the perceptual strobe threshold ` +
            `(${STROBE_FREQ_MIN_RECOMMENDED_HZ}Hz). Consider archetype "heavy" or "utility" instead.`,
        affectedFields: Object.freeze(['maxStrobeFreqHz', 'userArchetype']),
        seleneCorrelation: Object.freeze({
            engine: 'EffectDreamSimulator',
            rule: 'strobe_perceptual_floor',
            threshold: STROBE_FREQ_MIN_RECOMMENDED_HZ,
        }),
    });
};
/** R4: incoherencia zona vs naturaleza del arquetipo. */
const ruleZoneIncoherent = (clip) => {
    if (clip.energyZones.length === 0)
        return null;
    const arch = clip.userArchetype;
    if (arch === 'heavy' && !hasAnyHardZone(clip.energyZones)) {
        return Object.freeze({
            id: 'HEAVY_IN_LOW_ZONE',
            severity: 'error',
            title: 'Heavy archetype mapped to low energy zones only',
            message: `Archetype "heavy" was mapped to zones [${clip.energyZones.join(', ')}] which contain ` +
                `no hard zone (active/intense/peak). Selene's DNAAnalyzer will never select this clip ` +
                `during high-energy sections.`,
            affectedFields: Object.freeze(['energyZones', 'userArchetype']),
            seleneCorrelation: Object.freeze({
                engine: 'DNAAnalyzer',
                rule: 'archetype_zone_coherence',
            }),
        });
    }
    if (arch === 'divine') {
        // Divine debe estar SOLO en peak (idealmente) o como mucho peak+intense.
        const hasNonPeakIntense = clip.energyZones.some((z) => z !== 'peak' && z !== 'intense');
        if (hasNonPeakIntense) {
            return Object.freeze({
                id: 'DIVINE_NOT_PEAK_ONLY',
                severity: 'error',
                title: 'Divine archetype outside peak/intense',
                message: `Archetype "divine" must live in peak/intense zones only. Current zones ` +
                    `[${clip.energyZones.join(', ')}] contain off-band entries. Selene's drop-logic ` +
                    `will block this clip in non-peak sections.`,
                affectedFields: Object.freeze(['energyZones', 'userArchetype']),
                seleneCorrelation: Object.freeze({
                    engine: 'DNAAnalyzer',
                    rule: 'divine_peak_only',
                }),
            });
        }
    }
    if (arch === 'ambient' && !hasAnyLowZone(clip.energyZones)) {
        return Object.freeze({
            id: 'ZONE_INCOHERENT_FOR_ARCHETYPE',
            severity: 'warning',
            title: 'Ambient archetype without any low zone',
            message: `Archetype "ambient" was mapped to [${clip.energyZones.join(', ')}] without any low zone ` +
                `(silence/valley/ambient/gentle). The clip will likely never trigger.`,
            affectedFields: Object.freeze(['energyZones', 'userArchetype']),
            seleneCorrelation: Object.freeze({
                engine: 'DNAAnalyzer',
                rule: 'archetype_zone_coherence',
            }),
        });
    }
    return null;
};
/** R5: ningún energyZone declarado → invisible para Selene. */
const ruleEmptyZones = (clip) => {
    if (clip.energyZones.length > 0)
        return null;
    return Object.freeze({
        id: 'EMPTY_ENERGY_ZONES',
        severity: 'error',
        title: 'No energy zones declared',
        message: `The clip has no energyZones. Selene's DNAAnalyzer cannot match it against any ` +
            `musical context and the clip will be permanently dormant.`,
        affectedFields: Object.freeze(['energyZones']),
        seleneCorrelation: Object.freeze({
            engine: 'DNAAnalyzer',
            rule: 'requires_at_least_one_zone',
        }),
    });
};
/** R6: ninguna vibe declarada → visible solo en fallback. */
const ruleEmptyVibes = (clip) => {
    if (clip.compatibleVibes.length > 0)
        return null;
    return Object.freeze({
        id: 'EMPTY_VIBE_LIST',
        severity: 'warning',
        title: 'No compatible vibes declared',
        message: `compatibleVibes is empty. Selene will only consider this clip in the universal ` +
            `fallback bucket — heavily deprioritized vs. vibe-tagged effects.`,
        affectedFields: Object.freeze(['compatibleVibes']),
        seleneCorrelation: Object.freeze({
            engine: 'DNAAnalyzer',
            rule: 'vibe_specialist_priority',
        }),
    });
};
// R0 (bias) is NOT in this array — it is built dynamically per call
// because it needs the rawAco captured before bakeCognitiveDNA() runs.
const STATIC_RULES = Object.freeze([
    ruleAmbientAggressionOverflow,
    ruleStrobeFreqDangerous,
    ruleStrobeFreqUndeclared,
    ruleStrobeLowFreq,
    ruleZoneIncoherent,
    ruleEmptyZones,
    ruleEmptyVibes,
]);
// ─── API PÚBLICA ────────────────────────────────────────────────────────────
/**
 * Audita estáticamente el clip y devuelve la lista completa de warnings.
 * Función pura. No muta el clip. Idempotente.
 *
 * @param clip     La instancia ya horneada (bakeCognitiveDNA ha corrido).
 * @param rawAco   Los valores crudos del slider ANTES del bake. Necesarios
 *                 para detectar violaciones de bias (R0), ya que el bake las
 *                 silencia corrigiéndolas automáticamente. Si se omite, R0
 *                 cae back a los valores baked (sin detección real de bias).
 */
export function validateClip(clip, rawAco) {
    const warnings = [];
    // R0: bias check against RAW values (pre-bake)
    const biasRule = makeBiasRule(rawAco ?? clip.acoTriad);
    const biasWarning = biasRule(clip);
    if (biasWarning !== null)
        warnings.push(biasWarning);
    // R1-R6: static rules (operate on the baked instance, which is correct)
    for (const rule of STATIC_RULES) {
        const w = rule(clip);
        if (w !== null)
            warnings.push(w);
    }
    const summary = summarize(warnings);
    const canSave = summary.error === 0 && summary.critical === 0;
    return Object.freeze({
        warnings: Object.freeze(warnings),
        canSave,
        summary,
    });
}
/**
 * Helper: lista compacta de IDs de regla disparadas (útil para tests / logs).
 */
export function listFiredRules(clip) {
    return validateClip(clip).warnings.map((w) => w.id);
}
// ─── RE-EXPORT auxiliar (para consumidores que solo importan el linter) ─────
export { ENERGY_ZONES };
