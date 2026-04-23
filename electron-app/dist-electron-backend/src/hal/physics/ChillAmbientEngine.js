/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 3450: ChillAmbientEngine — THE AMBIENT REBIRTH
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Motor de iluminación ambiental estático, asíncrono y ultra-sedado.
 *
 * FILOSOFÍA:
 *   No hay FFT. No hay océano. No hay criaturas.
 *   Solo tiempo — y matemática pura que convierte el tiempo en luz.
 *
 * ARQUITECTURA:
 *   - Desconectado del audio. No lee bandas espectrales.
 *   - Usa performance.now() para generar ondas senoidales ultra-lentas.
 *   - Ciclos de 15 a 45 segundos por zona — tiempo geológico de luz ambiental.
 *   - Cada zona tiene un offset de fase distinto → la sala "respira" orgánicamente.
 *   - No hay dos zonas en fase: cuando una sube, otra baja. Siempre hay movimiento.
 *
 * EL SUELO DE CEMENTO (Anti-Parpadeo WAVE 3290 revisitado):
 *   - Intensidad mínima: 0.15 (FLOOR_INTENSITY)
 *   - Intensidad máxima: 0.45 (CEIL_INTENSITY)
 *   - La luz NUNCA se apaga. NUNCA parpadea. NUNCA da un frame gap.
 *   - El rango [0.15, 0.45] es suficiente para crear profundidad sin agresividad.
 *
 * MORPHFACTOR:
 *   - Onda lenta de 30s → [0.30, 0.70]
 *   - Inyectada en LiquidEngine71.morphFactorOverride para modular el colchón.
 *
 * USAGE:
 *   import { chillAmbientEngine } from './ChillAmbientEngine'
 *   const frame = chillAmbientEngine.tick()
 *   // frame.frontL, frame.backL ... siempre en [0.15, 0.45]
 *   // frame.morphFactor en [0.30, 0.70]
 *
 * @module hal/physics/ChillAmbientEngine
 * @version WAVE 3450 — THE AMBIENT REBIRTH
 * @author PunkOpus
 */
// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
/** Intensidad mínima — el suelo de cemento anti-parpadeo */
const FLOOR_INTENSITY = 0.15;
/** Intensidad máxima — el techo ambiental */
const CEIL_INTENSITY = 0.45;
/** Amplitud de oscilación por encima del suelo: (CEIL - FLOOR) / 2 = 0.15 */
const AMPLITUDE = (CEIL_INTENSITY - FLOOR_INTENSITY) / 2;
/** Centro de la onda: FLOOR + AMPLITUDE = 0.30 */
const CENTER = FLOOR_INTENSITY + AMPLITUDE;
/**
 * Configuración de cada zona: periodos primario y secundario en segundos,
 * y offset de fase en radianes para que la sala respire asimétricamente.
 *
 * Las ondas son suma de dos senoidales con períodos irracionales entre sí
 * para evitar repetición perceptible en tiempos cortos.
 * Normalización: (sin(t/P1) + sin(t/P2)*0.30 + 1.30) / 2.60 → [0, 1]
 * Aplicada luego: CENTER + scaled * AMPLITUDE * 2 - AMPLITUDE → [FLOOR, CEIL]
 */
const ZONE_CONFIG = {
    frontL: { p1: 31.0, p2: 17.0, phaseOffset: 0.00 }, // 0 rad — El Ancla
    frontR: { p1: 23.0, p2: 13.0, phaseOffset: Math.PI / 3 }, // 60° desfase
    backL: { p1: 41.0, p2: 19.0, phaseOffset: Math.PI * 2 / 3 }, // 120° desfase
    backR: { p1: 29.0, p2: 11.0, phaseOffset: Math.PI }, // 180° — contrafase del ancla
    moverL: { p1: 37.0, p2: 23.0, phaseOffset: Math.PI * 4 / 3 }, // 240° desfase
    moverR: { p1: 43.0, p2: 29.0, phaseOffset: Math.PI * 5 / 3 }, // 300° desfase
};
/** Período de la onda de morphFactor en segundos */
const MORPH_PERIOD_S = 30.0;
// ═══════════════════════════════════════════════════════════════════════════
// MATH HELPERS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Genera una onda doble normalizada en [0, 1].
 * Fórmula: (sin(t/P1 + φ) + sin(t/P2 + φ)*0.30 + 1.30) / 2.60
 * Nunca sale de [0, 1] con esta normalización.
 */
function dualSine(tSec, p1, p2, phaseOffset) {
    const primary = Math.sin((2 * Math.PI * tSec) / p1 + phaseOffset);
    const secondary = Math.sin((2 * Math.PI * tSec) / p2 + phaseOffset) * 0.30;
    return (primary + secondary + 1.30) / 2.60;
}
/**
 * Mapea un valor normalizado [0, 1] al rango [FLOOR, CEIL].
 */
function toRange(normalized) {
    return FLOOR_INTENSITY + normalized * (CEIL_INTENSITY - FLOOR_INTENSITY);
}
// ═══════════════════════════════════════════════════════════════════════════
// ENGINE CLASS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Motor de ambiente chill — 100% determinista, 0% FFT, 0% azar.
 * El tiempo es la única variable de entrada.
 */
export class ChillAmbientEngine {
    /**
     * Genera un frame de intensidades ambientales basado únicamente en el tiempo.
     * Llamar una vez por frame de render (60fps → ~16ms).
     * Idempotente para el mismo t: si se llama dos veces en el mismo ms, retorna lo mismo.
     */
    tick() {
        const tMs = performance.now();
        const tSec = tMs / 1000;
        // ── Intensidades de zona ────────────────────────────────────────────────
        const frontL = toRange(dualSine(tSec, ZONE_CONFIG.frontL.p1, ZONE_CONFIG.frontL.p2, ZONE_CONFIG.frontL.phaseOffset));
        const frontR = toRange(dualSine(tSec, ZONE_CONFIG.frontR.p1, ZONE_CONFIG.frontR.p2, ZONE_CONFIG.frontR.phaseOffset));
        const backL = toRange(dualSine(tSec, ZONE_CONFIG.backL.p1, ZONE_CONFIG.backL.p2, ZONE_CONFIG.backL.phaseOffset));
        const backR = toRange(dualSine(tSec, ZONE_CONFIG.backR.p1, ZONE_CONFIG.backR.p2, ZONE_CONFIG.backR.phaseOffset));
        const moverL = toRange(dualSine(tSec, ZONE_CONFIG.moverL.p1, ZONE_CONFIG.moverL.p2, ZONE_CONFIG.moverL.phaseOffset));
        const moverR = toRange(dualSine(tSec, ZONE_CONFIG.moverR.p1, ZONE_CONFIG.moverR.p2, ZONE_CONFIG.moverR.phaseOffset));
        // ── MorphFactor — onda lenta de 30s → [0.30, 0.70] ──────────────────────
        // No usa dualSine — onda única para morphFactor (señal de control, no de color)
        const morphRaw = (Math.sin((2 * Math.PI * tSec) / MORPH_PERIOD_S) + 1) / 2; // [0, 1]
        const morphFactor = 0.30 + morphRaw * 0.40; // [0.30, 0.70]
        return { frontL, frontR, backL, backR, moverL, moverR, morphFactor, _ts: tMs };
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════
/** Singleton global — una sola instancia para todo el proceso. */
export const chillAmbientEngine = new ChillAmbientEngine();
