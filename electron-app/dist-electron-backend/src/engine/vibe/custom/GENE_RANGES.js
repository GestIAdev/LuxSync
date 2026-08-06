/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📐 GENE_RANGES.ts — LOS LÍMITES FÍSICOS DE CADA GEN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * SSOT (Single Source Of Truth) de los rangos válidos de cada parámetro
 * mutable de un `.luxvibe`.
 *
 * ── DOS CONSUMIDORES, UNA TABLA ────────────────────────────────────────────
 *   1. `VibeFusionResolver` — clampea cada valor a `[min, max]` y emite un
 *      diagnostic `'warn'` cuando lo hace.
 *   2. La UI (`GeneSlider`, `TwinGeneSlider`, `geneRegistry`) — deriva de aquí
 *      los límites del slider, el `step`, y si el gen se muestra en modo
 *      SHIELDED (`tier: 'safe'`) o sólo en RAW (`tier: 'raw'`).
 *
 * Mantener una sola tabla garantiza que la UI nunca permita arrastrar un slider
 * a un valor que el resolver luego rechace en silencio.
 *
 * ── CONVENCIÓN DE RUTAS ────────────────────────────────────────────────────
 * Las claves son rutas dot-notation relativas al documento `CustomVibeOverride`.
 * Los 6 envelopes comparten los mismos 17 rangos, así que se declaran una sola
 * vez con el comodín `envelopes.*` y se expanden en runtime por
 * `expandEnvelopeRanges()`. Esto evita 102 entradas repetidas y garantiza que
 * las 6 cámaras no divergan por un typo.
 *
 * ── SOBRE `danger` ─────────────────────────────────────────────────────────
 * Sub-rango opcional que la UI pinta en rojo sobre el track del slider.
 * NO bloquea: el usuario puede entrar, pero recibe un aviso. Marca zonas
 * técnicamente legales pero que suelen producir resultados indeseables
 * (parpadeo, congelación, barro cromático, estrés mecánico).
 *
 * @module engine/vibe/custom/GENE_RANGES
 * @version FASE 1A — The Genome Typings
 */
import { ENVELOPE_SLOTS } from '../../../types/CustomVibe';
// ═══════════════════════════════════════════════════════════════════════════
// ENVELOPE — los 17 genes compartidos por las 6 cámaras
// Fuente: hal/physics/LiquidEnvelope.ts (LiquidEnvelopeConfig)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Rangos de UN envelope. Se expanden a las 6 cámaras en `GENE_RANGES`.
 * Claves relativas a `physics.envelopes.<slot>.`
 */
export const ENVELOPE_GENE_RANGES = {
    gateOn: { min: 0, max: 1, step: 0.005, tier: 'safe', danger: [0.6, 1] },
    boost: { min: 0, max: 20, step: 0.1, tier: 'safe', danger: [15, 20] },
    crushExponent: { min: 0.1, max: 5, step: 0.05, tier: 'raw' },
    decayBase: { min: 0, max: 1, step: 0.005, tier: 'safe', danger: [0.995, 1] },
    decayRange: { min: 0, max: 1, step: 0.005, tier: 'safe' },
    maxIntensity: { min: 0, max: 1, step: 0.01, tier: 'safe' },
    squelchBase: { min: 0, max: 1, step: 0.005, tier: 'raw', danger: [0.7, 1] },
    squelchSlope: { min: 0, max: 1, step: 0.005, tier: 'raw' },
    ghostCap: { min: 0, max: 1, step: 0.005, tier: 'safe' },
    gateMargin: { min: 0, max: 0.5, step: 0.005, tier: 'raw' },
    attackSlopeMin: { min: -0.1, max: 0.5, step: 0.005, tier: 'raw' },
    riseRate: { min: 0, max: 1, step: 0.005, tier: 'raw', danger: [0, 0.02] },
    sustainedSquelchStartFrames: { min: 0, max: 9999, step: 1, tier: 'raw', unit: 'frames' },
    sustainedSquelchRisePerFrame: { min: 0, max: 0.1, step: 0.001, tier: 'raw' },
    sustainedSquelchMaxBoost: { min: 0, max: 1, step: 0.01, tier: 'raw' },
    sustainedFlatVelocityMax: { min: 0, max: 1, step: 0.005, tier: 'raw' },
    adaptiveNoiseAlpha: { min: 0, max: 1, step: 0.005, tier: 'raw' },
};
// ═══════════════════════════════════════════════════════════════════════════
// PHYSICS — parámetros globales del perfil OmniLiquid
// Fuente: hal/physics/profiles/ILiquidProfile.ts
// ═══════════════════════════════════════════════════════════════════════════
const PHYSICS_RANGES = {
    // ── THE SCHWARZENEGGER (transient shaper, Back R) ──
    'physics.transient.percMidSubtract': { min: 0, max: 5, step: 0.05, tier: 'raw' },
    'physics.transient.percGate': { min: 0, max: 0.5, step: 0.005, tier: 'safe' },
    'physics.transient.percBoost': { min: 0, max: 10, step: 0.1, tier: 'safe', danger: [8, 10] },
    'physics.transient.percExponent': { min: 0.1, max: 3, step: 0.05, tier: 'raw' },
    // ── THE SEPARATION MATRIX (cross-filters) ──
    'physics.separation.bassSubtractBase': { min: 0, max: 1, step: 0.01, tier: 'raw' },
    'physics.separation.bassSubtractRange': { min: 0, max: 1, step: 0.01, tier: 'raw' },
    'physics.separation.moverRTrebleSub': { min: -1, max: 1, step: 0.01, tier: 'raw' },
    'physics.separation.backLLowMidWeight': { min: 0, max: 2, step: 0.01, tier: 'raw' },
    'physics.separation.backLMidWeight': { min: 0, max: 2, step: 0.01, tier: 'raw' },
    'physics.separation.backLTrebleSub': { min: -1, max: 1, step: 0.01, tier: 'raw' },
    'physics.separation.backLBassSub': { min: 0, max: 1, step: 0.01, tier: 'raw' },
    'physics.separation.moverLHighMidWeight': { min: 0, max: 3, step: 0.01, tier: 'raw' },
    'physics.separation.moverLTrebleWeight': { min: 0, max: 2, step: 0.01, tier: 'raw' },
    'physics.separation.moverLMidWeight': { min: 0, max: 2, step: 0.01, tier: 'raw' },
    'physics.separation.moverLTonalThreshold': { min: 0, max: 1, step: 0.01, tier: 'raw' },
    // ── THE GUILLOTINE (sidechain) ──
    // 999 = "imposible": desactiva el ducking (valor usado por Chill).
    'physics.sidechain.sidechainThreshold': { min: 0, max: 999, step: 0.01, tier: 'safe' },
    'physics.sidechain.sidechainDepth': { min: 0, max: 1, step: 0.01, tier: 'safe' },
    'physics.sidechain.snareSidechainDepth': { min: 0, max: 1, step: 0.01, tier: 'safe' },
    'physics.sidechain.frontKickSidechainThreshold': { min: 0, max: 1, step: 0.01, tier: 'raw' },
    'physics.sidechain.auraCapBase': { min: 0, max: 1, step: 0.01, tier: 'raw' },
    'physics.sidechain.auraCapExponent': { min: 0, max: 5, step: 0.05, tier: 'raw' },
    // ── THE FLASH GATE (strobe) ──
    // ⚠️ El resolver impone además el techo de 12 Hz efectivos (anti-epilepsia).
    'physics.strobe.strobeThreshold': { min: 0, max: 999, step: 0.01, tier: 'safe' },
    'physics.strobe.strobeDuration': { min: 1, max: 1000, step: 1, tier: 'safe', unit: 'ms', danger: [1, 40] },
    'physics.strobe.strobeNoiseDiscount': { min: 0, max: 1, step: 0.01, tier: 'raw' },
    // ── MODES (Acid / Noise / Apocalypse) ──
    'physics.modes.harshnessAcidThreshold': { min: 0, max: 1, step: 0.01, tier: 'raw' },
    'physics.modes.flatnessNoiseThreshold': { min: 0, max: 1, step: 0.01, tier: 'raw' },
    'physics.modes.apocalypseHarshness': { min: 0, max: 1, step: 0.01, tier: 'raw' },
    'physics.modes.apocalypseFlatness': { min: 0, max: 1, step: 0.01, tier: 'raw' },
    // ── MORPHOLOGY ── (invariante morphFloor < morphCeiling, corregido por resolver)
    'physics.morph.morphFloor': { min: 0, max: 1, step: 0.01, tier: 'safe' },
    'physics.morph.morphCeiling': { min: 0, max: 1, step: 0.01, tier: 'safe' },
    // ── THE METRONOME (kick detection) ──
    'physics.kick.kickEdgeMinInterval': { min: 1, max: 999999, step: 1, tier: 'raw', unit: 'ms' },
    'physics.kick.kickVetoFrames': { min: 0, max: 20, step: 1, tier: 'raw', unit: 'frames' },
    // ── VISCOSITY (ambient EMA) ──
    'physics.ambient.ambientAttackMs': { min: 1, max: 10000, step: 10, tier: 'safe', unit: 'ms' },
    'physics.ambient.ambientReleaseMs': { min: 1, max: 60000, step: 50, tier: 'safe', unit: 'ms' },
    'physics.ambient.ambientMidWeight': { min: 0, max: 2, step: 0.01, tier: 'raw' },
    'physics.ambient.ambientGain': { min: 0, max: 5, step: 0.05, tier: 'raw' },
};
// ═══════════════════════════════════════════════════════════════════════════
// COLOR — Selene Color Engine
// Fuente: engine/color/SeleneColorEngine.ts (GenerationOptions)
// ═══════════════════════════════════════════════════════════════════════════
const COLOR_RANGES = {
    // ── THE FORBIDDEN WHEEL ──
    // Nota: forbiddenHueRanges / allowedHueRanges / hueRemapping son ARRAYS y no
    // tienen rango escalar. Se editan con ChromaticWheel / TransmutationTable.
    // Los componentes de cada tupla se validan con HUE_COMPONENT_RANGE (abajo).
    'color.hue.elasticRotation': { min: 1, max: 90, step: 1, tier: 'raw', unit: '°', danger: [1, 3] },
    // ── THERMAL GRAVITY ──
    // Zona neutral 5800-6200K: sin arrastre. Fuera de ella, la gravedad tira.
    'color.thermal.atmosphericTemp': { min: 2000, max: 10000, step: 50, tier: 'safe', unit: 'K' },
    'color.thermal.thermalGravityStrength': { min: 0, max: 1, step: 0.01, tier: 'safe' },
    // ── THE LUMINANCE GATE ── (tuplas [min,max]; el resolver garantiza min<=max)
    'color.luminance.saturationRange': { min: 0, max: 100, step: 1, tier: 'safe', unit: '%' },
    'color.luminance.lightnessRange': { min: 0, max: 100, step: 1, tier: 'safe', unit: '%' },
    // ── MUD GUARD ──
    'color.mudGuard.minLightness': { min: 0, max: 100, step: 1, tier: 'raw', unit: '%' },
    'color.mudGuard.minSaturation': { min: 0, max: 100, step: 1, tier: 'raw', unit: '%' },
    // ── NEON PROTOCOL ──
    'color.neonProtocol.minSaturation': { min: 0, max: 100, step: 1, tier: 'raw', unit: '%' },
    'color.neonProtocol.minLightness': { min: 0, max: 100, step: 1, tier: 'raw', unit: '%' },
    // ── THE HARMONY ENGINE ──
    // Default del motor ≈ 222.5° (PHI_ROTATION). La constante está sellada, pero
    // el override del ángulo es legítimo: Latino usa 137.5°, Chill 100°.
    'color.harmony.fibonacciRotationDeg': { min: 0, max: 360, step: 0.5, tier: 'raw', unit: '°' },
    // ── THE ACCENT REACTOR ──
    'color.accent.kickPunch.l': { min: 0, max: 100, step: 1, tier: 'raw', unit: '%' },
    'color.accent.pulseConfig.duration': { min: 1, max: 60000, step: 100, tier: 'safe', unit: 'ms' },
    'color.accent.pulseConfig.amplitude': { min: 0, max: 1, step: 0.01, tier: 'safe' },
    // ── THE GLACIER ── (invariante min<=max, corregido por resolver)
    'color.transitions.minDuration': { min: 1, max: 60000, step: 100, tier: 'safe', unit: 'ms' },
    'color.transitions.maxDuration': { min: 1, max: 60000, step: 100, tier: 'safe', unit: 'ms' },
    // ── DIMMING ── (invariante floor<=ceiling, corregido por resolver)
    'color.dimming.floor': { min: 0, max: 1, step: 0.01, tier: 'safe' },
    'color.dimming.ceiling': { min: 0, max: 1, step: 0.01, tier: 'safe' },
    // ── THE SIDEREAL CAROUSEL ──
    'color.siderealClock.slotDurationMs': { min: 1000, max: 3600000, step: 1000, tier: 'safe', unit: 'ms' },
    // ── THE ABYSS (oceanic modulation) ──
    'color.oceanicModulation.hueInfluence': { min: 0, max: 360, step: 1, tier: 'raw', unit: '°' },
    'color.oceanicModulation.hueInfluenceStrength': { min: 0, max: 1, step: 0.01, tier: 'raw' },
    'color.oceanicModulation.saturationMod': { min: -30, max: 30, step: 1, tier: 'raw' },
    'color.oceanicModulation.lightnessMod': { min: -20, max: 20, step: 1, tier: 'raw' },
    'color.oceanicModulation.breathingFactor': { min: 0.85, max: 1.15, step: 0.01, tier: 'raw' },
};
/**
 * Rango de un componente de hue suelto (elementos de `HueRange`, `HueRemapRule`,
 * y el campo `h` de cualquier `HslTriplet`). No es una entrada de `GENE_RANGES`
 * porque no tiene ruta fija: se aplica a arrays de longitud variable.
 */
export const HUE_COMPONENT_RANGE = {
    min: 0, max: 360, step: 1, tier: 'safe', unit: '°',
};
/** Rango de un componente de saturación o luminosidad suelto (`s`, `l`). */
export const PERCENT_COMPONENT_RANGE = {
    min: 0, max: 100, step: 1, tier: 'safe', unit: '%',
};
/** Rango de un canal RGB de 8 bits (`strobeColor`). */
export const RGB_COMPONENT_RANGE = {
    min: 0, max: 255, step: 1, tier: 'safe',
};
// ═══════════════════════════════════════════════════════════════════════════
// MOVEMENT — VMM + presets de movimiento / óptica
// Fuente: engine/movement/VibeMovementManager.ts + VibeMovementPresets.ts
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Rangos del scheduler de UN patrón. Se expanden a los 22 patrones en
 * `GENE_RANGES` mediante `expandSchedulerRanges()`.
 * Claves relativas a `movement.scheduler.<pattern>.`
 */
export const SCHEDULER_GENE_RANGES = {
    // Chill usa hasta 512 beats (drift): 1 ciclo ≈ 128 compases.
    cycleBeats: { min: 8, max: 512, step: 1, tier: 'safe', unit: 'beats' },
    phraseDuration: { min: 16, max: 1024, step: 1, tier: 'safe', unit: 'beats' },
    transitionBeats: { min: 1, max: 8, step: 1, tier: 'safe', unit: 'beats' },
    safeHarborPhase: { min: 0, max: 6.283185307179586, step: 0.01, tier: 'raw', unit: 'rad' },
    safeHarborWindow: { min: 0, max: 3.141592653589793, step: 0.01, tier: 'raw', unit: 'rad' },
    hardDeadlineExtra: { min: 8, max: 128, step: 1, tier: 'raw', unit: 'beats' },
};
const MOVEMENT_RANGES = {
    // ── THE REACH (amplitud) ──
    'movement.kinematics.panScale': { min: 0, max: 1, step: 0.01, tier: 'safe', danger: [0, 0.05] },
    'movement.kinematics.tiltScale': { min: 0, max: 1, step: 0.01, tier: 'safe', danger: [0, 0.05] },
    'movement.kinematics.baseFrequency': { min: 0, max: 1, step: 0.01, tier: 'raw', unit: 'Hz' },
    // ── THE ENSEMBLE (simetría estéreo) ──
    'movement.stereo.offset': { min: 0, max: 3.141592653589793, step: 0.01, tier: 'safe', unit: 'rad' },
    // ── Audience bias ── (sólo efectivo en montaje floor)
    'movement.tiltOffset': { min: -0.5, max: 0, step: 0.01, tier: 'safe' },
    // ── THE GEARBOX (física del driver) ──
    // ⚠️ maxAcceleration/maxVelocity los capa SAFETY_CAP (900 / 400) en runtime.
    'movement.physics.maxAcceleration': { min: 6, max: 900, step: 1, tier: 'safe', unit: 'DMX/s²' },
    'movement.physics.maxVelocity': { min: 12, max: 400, step: 1, tier: 'safe', unit: 'DMX/s' },
    'movement.physics.friction': { min: 0, max: 1, step: 0.01, tier: 'safe' },
    'movement.physics.arrivalThreshold': { min: 0.5, max: 8, step: 0.1, tier: 'raw', unit: 'DMX' },
    'movement.physics.snapFactor': { min: 0, max: 1, step: 0.01, tier: 'safe' },
    'movement.physics.revLimitPanPerSec': { min: 15, max: 300, step: 1, tier: 'safe', unit: 'DMX/s' },
    'movement.physics.revLimitTiltPerSec': { min: 10, max: 240, step: 1, tier: 'safe', unit: 'DMX/s' },
    // ── THE LENS (óptica) ──
    'movement.optics.zoomDefault': { min: 0, max: 255, step: 1, tier: 'safe' },
    'movement.optics.zoomRange': { min: 0, max: 255, step: 1, tier: 'safe' },
    'movement.optics.focusDefault': { min: 0, max: 255, step: 1, tier: 'safe' },
    'movement.optics.focusRange': { min: 0, max: 255, step: 1, tier: 'safe' },
    'movement.optics.irisDefault': { min: 0, max: 255, step: 1, tier: 'raw' },
    // ── THE INSTINCT (conducta) ──
    'movement.behavior.smoothFactor': { min: 0, max: 1, step: 0.01, tier: 'safe' },
    // ── THE FAN ARRAY (targeting espacial IK) ──
    'movement.spatial.fanAmplitude': { min: 0, max: 10, step: 0.1, tier: 'safe', unit: 'm' },
    // ── GRANDMASTER ──
    'movement.grandMaster.globalSpeedMultiplier': { min: 0.1, max: 2, step: 0.05, tier: 'safe', unit: '×' },
    'movement.grandMaster.globalChaosAmount': { min: 0, max: 1, step: 0.01, tier: 'safe' },
};
// ═══════════════════════════════════════════════════════════════════════════
// EXPANSIÓN Y ENSAMBLAJE
// ═══════════════════════════════════════════════════════════════════════════
/** Los 22 patrones. Duplicado local para no crear un ciclo de imports. */
const PATTERN_IDS = [
    'scan_x', 'square', 'diamond', 'botstep', 'darkspin', 'laser_grid', 'industrial_pendulum',
    'figure8', 'wave_y', 'ballyhoo', 'cadera_libre', 'espiral_conga',
    'circle_big', 'cancan', 'dual_sweep',
    'drift', 'sway', 'breath',
    'slow_pan', 'tilt_nod', 'figure_of_4', 'chase_position',
];
/**
 * Expande `ENVELOPE_GENE_RANGES` a las 6 cámaras.
 * Genera 17 × 6 = 102 entradas bajo `physics.envelopes.<slot>.<gene>`.
 * Incluye también las rutas de `overrides41` (mismos rangos).
 */
function expandEnvelopeRanges() {
    const out = {};
    for (const slot of ENVELOPE_SLOTS) {
        for (const [gene, range] of Object.entries(ENVELOPE_GENE_RANGES)) {
            out[`physics.envelopes.${slot}.${gene}`] = range;
            out[`physics.overrides41.envelopes.${slot}.${gene}`] = range;
        }
    }
    return out;
}
/**
 * Expande `SCHEDULER_GENE_RANGES` a los 22 patrones.
 * Genera 6 × 22 = 132 entradas bajo `movement.scheduler.<pattern>.<gene>`.
 */
function expandSchedulerRanges() {
    const out = {};
    for (const pattern of PATTERN_IDS) {
        for (const [gene, range] of Object.entries(SCHEDULER_GENE_RANGES)) {
            out[`movement.scheduler.${pattern}.${gene}`] = range;
        }
    }
    return out;
}
/**
 * Expande los rangos escalares de `overrides41` (transient / separation /
 * sidechain), reutilizando los rangos de la capa base.
 */
function expandOverrides41Ranges() {
    const out = {};
    const groups = ['transient', 'separation', 'sidechain'];
    for (const [path, range] of Object.entries(PHYSICS_RANGES)) {
        for (const group of groups) {
            const prefix = `physics.${group}.`;
            if (path.startsWith(prefix)) {
                out[`physics.overrides41.${group}.${path.slice('physics.'.length + group.length + 1)}`] = range;
            }
        }
    }
    return out;
}
/**
 * LA TABLA COMPLETA.
 *
 * Ruta dot-notation → límites físicos + tier de exposición.
 *
 * Composición (verificada en runtime, total = 437):
 *   - 102 genes de envelope           (17 × 6 cámaras)
 *   - 102 genes de envelope en 4.1    (17 × 6)
 *   -  36 genes globales de physics   (transient 4, separation 11, sidechain 6,
 *                                      strobe 3, modes 4, morph 2, kick 2, ambient 4)
 *   -  21 genes escalares en 4.1      (transient 4, separation 11, sidechain 6)
 *   -  23 genes de color
 *   - 132 genes de scheduler          (6 × 22 patrones)
 *   -  21 genes de movement
 *
 * Reparto por tier: 183 `safe` / 254 `raw`.
 *
 * NOTA: 437 > los ~282 citados en el blueprint. La diferencia es real y
 * esperada: el blueprint contaba parámetros CONCEPTUALES (p.ej. "17 params de
 * envelope"), mientras esta tabla enumera cada RUTA concreta (17 × 6 cámaras,
 * 6 × 22 patrones). Es la misma superficie, enumerada de forma exhaustiva.
 */
export const GENE_RANGES = {
    ...expandEnvelopeRanges(),
    ...expandOverrides41Ranges(),
    ...PHYSICS_RANGES,
    ...COLOR_RANGES,
    ...expandSchedulerRanges(),
    ...MOVEMENT_RANGES,
};
// ═══════════════════════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════════════════════
/** Recupera el rango de un gen, o `undefined` si la ruta no está registrada. */
export function getGeneRange(path) {
    return GENE_RANGES[path];
}
/**
 * Clampea un valor al rango de su gen.
 *
 * @returns El valor clampeado y si hubo recorte. Si la ruta no está registrada
 *          devuelve el valor intacto con `clamped: false` (el resolver lo
 *          reportará como gen desconocido).
 */
export function clampGene(path, value) {
    const range = GENE_RANGES[path];
    if (!range)
        return { value, clamped: false };
    if (!Number.isFinite(value))
        return { value: range.min, clamped: true, range };
    const clampedValue = Math.min(range.max, Math.max(range.min, value));
    return { value: clampedValue, clamped: clampedValue !== value, range };
}
/** `true` si el valor cae en la zona de riesgo declarada del gen. */
export function isInDangerZone(path, value) {
    const danger = GENE_RANGES[path]?.danger;
    if (!danger)
        return false;
    return value >= danger[0] && value <= danger[1];
}
/** Todas las rutas de un tier concreto (para construir la UI por modo). */
export function getGenePathsByTier(tier) {
    return Object.keys(GENE_RANGES).filter((p) => GENE_RANGES[p].tier === tier);
}
/** Total de genes numéricos registrados. Verificado por test. */
export const GENE_RANGES_COUNT = Object.keys(GENE_RANGES).length;
