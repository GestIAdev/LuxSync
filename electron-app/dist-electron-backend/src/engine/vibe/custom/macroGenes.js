/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎛️ macroGenes.ts — LOS 5 MACRO GENES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Definición de los 5 Macro Genes del modo SHIELDED. Un Macro Gene es un
 * único slider 0..1 que mueve VARIOS genes subyacentes con curvas
 * predefinidas, agrupándolos en una intención musical semántica.
 *
 * ── FILOSOFÍA ──────────────────────────────────────────────────────────────
 * El usuario medio no sabe qué es `percBoost` ni `decayBase`, pero entiende
 * "AGGRESSION". El Macro Gene traduce esa intención en las mutaciones
 * correlacionadas correctas. Al pasar a modo RAW, el usuario ve exactamente
 * qué genes movió el macro y puede afinarlos individualmente.
 *
 * ── CÓMO FUNCIONA ──────────────────────────────────────────────────────────
 * Cada Macro Gene define una lista de `MacroGeneTarget`:
 *   - `path`: ruta dot-notation del gen subyacente.
 *   - `curve`: función `(t: number) => number` que mapea 0..1 al rango del gen.
 *   - `direction`: `'positive' | 'negative'` — informativo, para la UI.
 *
 * El `applyMacro` del store llama a `expandMacro(id, value)` que devuelve un
 * array de `{ path, value }` listo para `setGene` en lote.
 *
 * Las curvas están en UNIDADES DEL GEN (no en 0..1): leen el rango de
 * `GENE_RANGES` y interpolan. Así el macro respeta los límites físicos.
 *
 * @module engine/vibe/custom/macroGenes
 * @version FASE 1B — The Fusion Core
 */
import { GENE_RANGES, getGeneRange } from './GENE_RANGES';
// ═══════════════════════════════════════════════════════════════════════════
// HELPERS DE CURVA
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Interpolación lineal dentro del rango de un gen.
 * `t=0 → min`, `t=1 → max`. Respeta los límites físicos del gen.
 */
function lerpRange(path) {
    const range = getGeneRange(path);
    if (!range) {
        // Gen no registrado: no deberíamos llegar aquí, pero devolvemos una
        // curva identidad segura para no romper el store.
        return (t) => t;
    }
    return (t) => range.min + (range.max - range.min) * t;
}
/**
 * Interpolación invertida: `t=0 → max`, `t=1 → min`.
 * Para genes que deben BAJAR cuando el macro sube (p.ej. `percGate` en AGGRESSION).
 */
function lerpRangeInverse(path) {
    const range = getGeneRange(path);
    if (!range)
        return (t) => 1 - t;
    return (t) => range.max - (range.max - range.min) * t;
}
/**
 * Curva exponencial cúbica: `t³`. Da control fino en el rango bajo y
 * empuje fuerte en el alto. Ideal para "aggression" donde el usuario
 * quiere sensibilidad cerca de 0 y punch cerca de 1.
 */
function easeInCubic(base) {
    return (t) => base(t * t * t);
}
/**
 * Curva ease-out cúbica: `1 - (1-t)³`. Da punch rápido en el rango bajo
 * y control fino en el alto. Ideal para "viscosity" donde el usuario
 * quiere respuesta inmediata al empezar a subir.
 */
function easeOutCubic(base) {
    return (t) => base(1 - Math.pow(1 - t, 3));
}
// ═══════════════════════════════════════════════════════════════════════════
// LOS 5 MACRO GENES
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Tabla de los 5 Macro Genes.
 *
 * Mapeo verificado contra `GENE_RANGES` — todas las rutas existen.
 * Las curvas se construyen en runtime leyendo los rangos de la SSOT, así
 * si un rango cambia, el macro se adapta sin tocar este archivo.
 */
export const MACRO_GENES = {
    // ── AGGRESSION ──────────────────────────────────────────────────────────
    // "Golpe más duro, decay más corto, menos fricción, snap más agresivo."
    // Subir el macro = más punch, menos suavizado. Curva ease-in cúbica para
    // control fino en el rango bajo (no quieres volverse agresivo de golpe).
    aggression: {
        id: 'aggression',
        label: 'Aggression',
        icon: 'Zap',
        accentHex: '#ff3b30',
        description: 'Golpe más duro, decay más corto, menos fricción. Sube el punch transitorio.',
        targets: [
            { path: 'physics.transient.percBoost', curve: easeInCubic(lerpRange('physics.transient.percBoost')), direction: 'positive' },
            { path: 'physics.transient.percGate', curve: easeInCubic(lerpRangeInverse('physics.transient.percGate')), direction: 'negative' },
            { path: 'physics.envelopes.envelopeKick.decayBase', curve: easeInCubic(lerpRangeInverse('physics.envelopes.envelopeKick.decayBase')), direction: 'negative' },
            { path: 'movement.physics.snapFactor', curve: easeInCubic(lerpRange('movement.physics.snapFactor')), direction: 'positive' },
            { path: 'movement.physics.friction', curve: easeInCubic(lerpRangeInverse('movement.physics.friction')), direction: 'negative' },
        ],
    },
    // ── VISCOSITY ───────────────────────────────────────────────────────────
    // "Ataque y release más largos, más fricción, más suavizado, transiciones
    // más largas." Subir el macro = más líquido, menos reactivo. Curva ease-out
    // cúbica para respuesta inmediata al empezar a subir (de seco a sedoso).
    viscosity: {
        id: 'viscosity',
        label: 'Viscosity',
        icon: 'Droplets',
        accentHex: '#0a84ff',
        description: 'Ataque y release más largos, más fricción, más suavizado. Movimiento más líquido.',
        targets: [
            { path: 'physics.ambient.ambientAttackMs', curve: easeOutCubic(lerpRange('physics.ambient.ambientAttackMs')), direction: 'positive' },
            { path: 'physics.ambient.ambientReleaseMs', curve: easeOutCubic(lerpRange('physics.ambient.ambientReleaseMs')), direction: 'positive' },
            { path: 'movement.physics.friction', curve: easeOutCubic(lerpRange('movement.physics.friction')), direction: 'positive' },
            { path: 'movement.behavior.smoothFactor', curve: easeOutCubic(lerpRange('movement.behavior.smoothFactor')), direction: 'positive' },
            { path: 'movement.scheduler.scan_x.transitionBeats', curve: easeOutCubic(lerpRange('movement.scheduler.scan_x.transitionBeats')), direction: 'positive' },
        ],
    },
    // ── THERMAL BIAS ────────────────────────────────────────────────────────
    // "Temperatura atmosférica más cálida + gravedad térmica más fuerte."
    // Subir el macro = paleta más cálida ( Kelvin) con más peso térmico.
    // Curva lineal: la percepción de temperatura es aproximadamente lineal.
    thermalBias: {
        id: 'thermalBias',
        label: 'Thermal Bias',
        icon: 'Thermometer',
        accentHex: '#ff9500',
        description: 'Temperatura atmosférica más cálida y mayor gravedad térmica. Paleta más dorada.',
        targets: [
            { path: 'color.thermal.atmosphericTemp', curve: lerpRangeInverse('color.thermal.atmosphericTemp'), direction: 'negative' },
            { path: 'color.thermal.thermalGravityStrength', curve: lerpRange('color.thermal.thermalGravityStrength'), direction: 'positive' },
        ],
    },
    // ── SPATIAL REACH ───────────────────────────────────────────────────────
    // "Barrido pan más amplio, tilt más amplio, fan array más extendido."
    // Subir el macro = los movers cubren más espacio físico. Curva lineal:
    // la amplitud de barrido se percibe linealmente.
    spatialReach: {
        id: 'spatialReach',
        label: 'Spatial Reach',
        icon: 'Move3d',
        accentHex: '#bf5af2',
        description: 'Barrido pan y tilt más amplios, fan array más extendido. Los movers cubren más espacio.',
        targets: [
            { path: 'movement.kinematics.panScale', curve: lerpRange('movement.kinematics.panScale'), direction: 'positive' },
            { path: 'movement.kinematics.tiltScale', curve: lerpRange('movement.kinematics.tiltScale'), direction: 'positive' },
            { path: 'movement.spatial.fanAmplitude', curve: lerpRange('movement.spatial.fanAmplitude'), direction: 'positive' },
        ],
    },
    // ── NERVOUSNESS ─────────────────────────────────────────────────────────
    // "Ciclos más cortos, frases más cortas, velocidad global más alta."
    // Subir el macro = movimiento más frenético, cambios más rápidos.
    // Curva ease-in cúbica: cerca de 0 el movimiento es majestuoso, cerca
    // de 1 se vuelve epiléptico (pero respetando los rangos safe de GENE_RANGES).
    nervousness: {
        id: 'nervousness',
        label: 'Nervousness',
        icon: 'Activity',
        accentHex: '#30d158',
        description: 'Ciclos y frases más cortos, velocidad global más alta. Movimiento más frenético.',
        targets: [
            { path: 'movement.scheduler.scan_x.cycleBeats', curve: easeInCubic(lerpRangeInverse('movement.scheduler.scan_x.cycleBeats')), direction: 'negative' },
            { path: 'movement.scheduler.scan_x.phraseDuration', curve: easeInCubic(lerpRangeInverse('movement.scheduler.scan_x.phraseDuration')), direction: 'negative' },
            { path: 'movement.grandMaster.globalSpeedMultiplier', curve: easeInCubic(lerpRange('movement.grandMaster.globalSpeedMultiplier')), direction: 'positive' },
        ],
    },
};
/** Lista ordenada de los 5 Macro Genes (para renderizar los dials). */
export const MACRO_GENE_LIST = [
    MACRO_GENES.aggression,
    MACRO_GENES.viscosity,
    MACRO_GENES.thermalBias,
    MACRO_GENES.spatialReach,
    MACRO_GENES.nervousness,
];
/** Número de Macro Genes. */
export const MACRO_GENE_COUNT = MACRO_GENE_LIST.length;
// ═══════════════════════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════════════════════
/** Recupera la definición de un Macro Gene por su id. */
export function getMacroGene(id) {
    return MACRO_GENES[id];
}
/**
 * Expande un Macro Gene a la lista de mutaciones concretas que aplica.
 *
 * @param id Identificador del Macro Gene.
 * @param value Valor del dial `∈ [0, 1]`. Se clampea por seguridad.
 * @returns Array de `{ path, value }` listo para `setGene` en lote.
 */
export function expandMacro(id, value) {
    const def = MACRO_GENES[id];
    const t = Math.min(1, Math.max(0, value));
    return def.targets.map((target) => ({
        path: target.path,
        value: target.curve(t),
    }));
}
/**
 * Versión segura de `expandMacro` que además clampea cada valor resultante
 * contra `GENE_RANGES` (defensivo: las curvas ya respetan los rangos, pero
 * un NaN o un bug en una curva no debe propagarse al documento).
 */
export function expandMacroClamped(id, value) {
    return expandMacro(id, value).map((m) => {
        const range = GENE_RANGES[m.path];
        if (!range)
            return m;
        const v = Number.isFinite(m.value) ? m.value : range.min;
        return { path: m.path, value: Math.min(range.max, Math.max(range.min, v)) };
    });
}
