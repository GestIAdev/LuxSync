/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ HEPHAESTUS TYPES - THE DNA OF THE FORGE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 2030.2: HEPHAESTUS CORE ENGINE
 *
 * Data structures para el sistema de automatización multi-parámetro.
 * Cada tipo aquí define cómo se almacena, transmite y evalúa
 * una curva de automatización.
 *
 * ARQUITECTURA DE TIPOS:
 *
 *   HSL                    → Color atómico
 *   HephKeyframe           → Punto en el tiempo con valor + interpolación
 *   HephCurve              → Secuencia de keyframes para UN parámetro
 *   HephAutomationClip     → Colección de curvas = efecto completo
 *   HephParamSnapshot      → Snapshot de todos los params en un instante
 *
 * INVARIANTES:
 * - Keyframes SIEMPRE ordenados por timeMs ascendente
 * - Valores numéricos SIEMPRE en rango normalizado (según curve.range)
 * - Colores SIEMPRE en HSL (h: 0-360, s: 0-100, l: 0-100)
 * - bezierHandles: [cx1, cy1, cx2, cy2] donde cada valor es 0-1
 *   (pero cy puede exceder 0-1 para overshoot/bounce)
 *
 * @module core/hephaestus/types
 * @version WAVE 2030.2
 */
// ═══════════════════════════════════════════════════════════════════════════
// BEZIER PRESETS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Presets de bezier handles para uso rápido.
 *
 * El usuario puede seleccionar un preset en la UI y luego
 * ajustar los handles manualmente si necesita refinamiento.
 */
export const BEZIER_PRESETS = {
    'linear': [0, 0, 1, 1],
    'ease-in': [0.42, 0, 1, 1],
    'ease-out': [0, 0, 0.58, 1],
    'ease-in-out': [0.42, 0, 0.58, 1],
    'overshoot': [0.68, -0.6, 0.32, 1.6],
    'bounce': [0.34, 1.56, 0.64, 1],
    'snap': [0.9, 0, 0.1, 1],
    'smooth': [0.25, 0.1, 0.25, 1],
    'sharp-in': [0.9, 0, 0.7, 1],
    'sharp-out': [0.3, 0, 0.1, 1],
};
// ═══════════════════════════════════════════════════════════════════════════
// TYPE GUARDS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Type guard: ¿Es este valor un HSL?
 */
export function isHSL(value) {
    return (typeof value === 'object' &&
        value !== null &&
        'h' in value &&
        's' in value &&
        'l' in value);
}
/**
 * Type guard: ¿Es este valor un number?
 */
export function isNumericValue(value) {
    return typeof value === 'number';
}
/**
 * Serializa un HephAutomationClip para transporte IPC.
 * Convierte Map → Record.
 */
export function serializeHephClip(clip) {
    const curvesRecord = {};
    for (const [paramId, curve] of clip.curves) {
        curvesRecord[paramId] = curve;
    }
    return {
        id: clip.id,
        name: clip.name,
        author: clip.author,
        category: clip.category,
        tags: clip.tags,
        vibeCompat: clip.vibeCompat,
        zones: clip.zones,
        mixBus: clip.mixBus,
        priority: clip.priority,
        durationMs: clip.durationMs,
        effectType: clip.effectType,
        curves: curvesRecord,
        staticParams: clip.staticParams,
    };
}
/**
 * Deserializa un HephAutomationClipSerialized de vuelta a HephAutomationClip.
 * Convierte Record → Map.
 */
export function deserializeHephClip(serialized) {
    const curvesMap = new Map();
    for (const [paramId, curve] of Object.entries(serialized.curves)) {
        curvesMap.set(paramId, curve);
    }
    return {
        id: serialized.id,
        name: serialized.name,
        author: serialized.author,
        category: serialized.category,
        tags: serialized.tags,
        vibeCompat: serialized.vibeCompat,
        zones: serialized.zones,
        mixBus: serialized.mixBus,
        priority: serialized.priority,
        durationMs: serialized.durationMs,
        effectType: serialized.effectType,
        curves: curvesMap,
        staticParams: serialized.staticParams,
    };
}
// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY INFERENCE - WAVE 2040.9a
// ═══════════════════════════════════════════════════════════════════════════
/** Parameter groups for category inference */
const PHYSICAL_PARAMS = ['intensity', 'strobe'];
const COLOR_PARAMS = ['color', 'white', 'amber'];
const MOVEMENT_PARAMS = ['pan', 'tilt'];
const OPTICS_PARAMS = ['zoom', 'focus', 'iris', 'gobo1', 'gobo2', 'prism'];
/**
 * ⚒️ WAVE 2040.9a: Infer EffectCategory from a clip's automated curves.
 *
 * Analiza QUÉ parámetros toca un clip de Hephaestus y determina
 * su EffectCategory automáticamente. Si toca parámetros de 2+ grupos,
 * retorna 'composite'.
 *
 * DETERMINISTA: No hay random, no hay heurística ambigua.
 * El resultado depende ÚNICAMENTE de qué curvas tiene el clip.
 *
 * @param clip - HephAutomationClip con curvas definidas
 * @returns EffectCategory inferida desde las curvas
 */
export function inferHephCategory(clip) {
    const paramIds = Array.from(clip.curves.keys());
    const touchesPhysical = paramIds.some(p => PHYSICAL_PARAMS.includes(p));
    const touchesColor = paramIds.some(p => COLOR_PARAMS.includes(p));
    const touchesMovement = paramIds.some(p => MOVEMENT_PARAMS.includes(p));
    const touchesOptics = paramIds.some(p => OPTICS_PARAMS.includes(p));
    const groupCount = [touchesPhysical, touchesColor, touchesMovement, touchesOptics]
        .filter(Boolean).length;
    // Multi-grupo → composite
    if (groupCount > 1)
        return 'composite';
    // Mono-grupo → categoría específica
    if (touchesPhysical)
        return 'physical';
    if (touchesColor)
        return 'color';
    if (touchesMovement)
        return 'movement';
    if (touchesOptics)
        return 'optics';
    // Parámetros genéricos (speed, width, direction, globalComp) sin grupo específico
    return 'physical';
}
