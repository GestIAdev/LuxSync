/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎵 WAVE 2672: HARMONIC QUANTIZER — LA LEY ECLÉCTICA (PÉNDULO ARMÓNICO)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * PROBLEMA RESUELTO:
 * Selene piensa a 60fps. Las ruedas de color mecánicas necesitan 500ms+
 * para rotar. El HardwareSafetyLayer bloquea por fuerza bruta durante el
 * cooldown → el fixture se congela → el show muere.
 *
 * SOLUCIÓN:
 * Cuantizar los cambios de color a la subdivisión musical más rápida
 * que respete la física del hardware. El beat dicta la partitura,
 * el hardware dicta las físicas.
 *
 * ALGORITMO CENTRAL:
 * 1. Leer rBPM desde IntervalBPMTracker (vía lastAudioData.workerBpm)
 * 2. Calcular beatPeriodMs = 60000 / rBPM
 * 3. Encontrar el multiplicador armónico más rápido (×1, ×2, ×4, ×8, ×16)
 *    cuyo período sea ≥ minChangeTimeMs del perfil del fixture
 * 4. Gate: solo permitir cambio de color cuando ha pasado el período armónico
 *
 * DESACOPLAMIENTO ABSOLUTO DE CANALES:
 * - colorWheel / CMY → CUANTIZADO (gated por período armónico)
 * - dimmer → PASS-THROUGH INMEDIATO (siempre libre)
 * - shutter → PASS-THROUGH INMEDIATO (siempre libre)
 * - movement → PASS-THROUGH INMEDIATO (siempre libre)
 *
 * RELACIÓN CON HardwareSafetyLayer:
 * El Quantizer es la capa MUSICAL que previene conflictos con elegancia.
 * El SafetyLayer sigue ahí como red de seguridad de última instancia.
 * Con el Quantizer activo, el SafetyLayer casi nunca necesita intervenir.
 *
 * @module hal/translation/HarmonicQuantizer
 * @version WAVE 2672
 */
// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Multiplicadores de beats para subdivisiones musicales.
 * Ordenados de más rápido a más lento.
 * ×1 = cada beat, ×2 = cada 2 beats, ×4 = cada compás (4/4), etc.
 */
const BEAT_MULTIPLIERS = [1, 2, 4, 8, 16];
/** BPM por defecto cuando no hay detección activa */
const DEFAULT_BPM = 120;
/** Umbral mínimo de confianza del BPM para activar cuantización */
const MIN_BPM_CONFIDENCE = 0.3;
/** Diferencia mínima de BPM para recalcular el período armónico */
const BPM_RECALC_THRESHOLD = 2.0;
// ═══════════════════════════════════════════════════════════════════════════
// HARMONIC QUANTIZER CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class HarmonicQuantizer {
    constructor() {
        /** Estado por fixture */
        this.fixtureStates = new Map();
    }
    /**
     * 🎯 findResonantPeriod — El corazón del Péndulo Armónico
     *
     * Encuentra la subdivisión musical más rápida (menor período)
     * que sea ≥ minChangeTimeMs.
     *
     * Ejemplo con BPM=128:
     *   beatPeriod = 60000/128 = 468.75ms
     *   minChangeTimeMs = 500ms (Beam 2R)
     *
     *   ×1 = 468.75ms  → < 500ms ✗
     *   ×2 = 937.50ms  → ≥ 500ms ✓ ← ELEGIDO
     *
     * @returns { periodMs, multiplier }
     */
    findResonantPeriod(bpm, minChangeTimeMs) {
        const safeBpm = bpm > 0 ? bpm : DEFAULT_BPM;
        const beatPeriodMs = 60000 / safeBpm;
        for (const multiplier of BEAT_MULTIPLIERS) {
            const periodMs = beatPeriodMs * multiplier;
            if (periodMs >= minChangeTimeMs) {
                return { periodMs, multiplier };
            }
        }
        // Si ni siquiera ×16 beats es suficiente (BPM extremadamente alto),
        // usar el máximo multiplicador disponible
        const maxMultiplier = BEAT_MULTIPLIERS[BEAT_MULTIPLIERS.length - 1];
        return {
            periodMs: beatPeriodMs * maxMultiplier,
            multiplier: maxMultiplier,
        };
    }
    /**
     * 🎵 quantize — Punto de entrada principal
     *
     * Evalúa si un cambio de color debe permitirse en este tick.
     * SOLO afecta al canal de color. Dimmer/shutter/movement son
     * responsabilidad del caller — este módulo NO los toca.
     *
     * @param fixtureId - ID único del fixture
     * @param newColor - Color RGB que Selene quiere aplicar
     * @param bpm - rBPM actual desde IntervalBPMTracker
     * @param bpmConfidence - Confianza del BPM (0-1)
     * @param minChangeTimeMs - Tiempo mínimo de cambio del perfil del fixture
     * @returns Resultado con colorAllowed y metadata
     */
    quantize(fixtureId, newColor, bpm, bpmConfidence, minChangeTimeMs) {
        const now = Date.now();
        // Sin color → nada que cuantizar
        if (!newColor) {
            return {
                colorAllowed: true,
                harmonicPeriodMs: 0,
                beatMultiplier: 0,
                timeUntilNextChangeMs: 0,
            };
        }
        // Confianza de BPM demasiado baja → fallback a debounce simple
        // (dejar que HardwareSafetyLayer se encargue)
        if (bpmConfidence < MIN_BPM_CONFIDENCE) {
            return {
                colorAllowed: true,
                harmonicPeriodMs: 0,
                beatMultiplier: 0,
                timeUntilNextChangeMs: 0,
            };
        }
        // Obtener o crear estado
        let state = this.fixtureStates.get(fixtureId);
        if (!state) {
            state = {
                lastColorChangeTime: 0,
                lastAllowedColor: null,
                currentHarmonicPeriodMs: 0,
                lastBpmUsed: 0,
            };
            this.fixtureStates.set(fixtureId, state);
        }
        // Recalcular período armónico si el BPM cambió significativamente
        const effectiveBpm = bpm > 0 ? bpm : DEFAULT_BPM;
        if (Math.abs(effectiveBpm - state.lastBpmUsed) > BPM_RECALC_THRESHOLD) {
            const resonance = this.findResonantPeriod(effectiveBpm, minChangeTimeMs);
            state.currentHarmonicPeriodMs = resonance.periodMs;
            state.lastBpmUsed = effectiveBpm;
        }
        const harmonicPeriodMs = state.currentHarmonicPeriodMs;
        const elapsed = now - state.lastColorChangeTime;
        // ¿Es el mismo color? → no consume el gate
        if (state.lastAllowedColor && this.colorsEqual(newColor, state.lastAllowedColor)) {
            return {
                colorAllowed: true,
                harmonicPeriodMs,
                beatMultiplier: this.getCurrentMultiplier(effectiveBpm, harmonicPeriodMs),
                timeUntilNextChangeMs: Math.max(0, harmonicPeriodMs - elapsed),
            };
        }
        // ¿Ha pasado el período armónico?
        if (elapsed >= harmonicPeriodMs) {
            // GATE ABIERTO → permitir cambio
            state.lastColorChangeTime = now;
            state.lastAllowedColor = { ...newColor };
            return {
                colorAllowed: true,
                harmonicPeriodMs,
                beatMultiplier: this.getCurrentMultiplier(effectiveBpm, harmonicPeriodMs),
                timeUntilNextChangeMs: 0,
            };
        }
        // GATE CERRADO → color no permitido en este tick
        return {
            colorAllowed: false,
            harmonicPeriodMs,
            beatMultiplier: this.getCurrentMultiplier(effectiveBpm, harmonicPeriodMs),
            timeUntilNextChangeMs: harmonicPeriodMs - elapsed,
        };
    }
    // ═══════════════════════════════════════════════════════════════════════
    // API PÚBLICA
    // ═══════════════════════════════════════════════════════════════════════
    /** Resetea el estado de un fixture específico */
    resetFixture(fixtureId) {
        this.fixtureStates.delete(fixtureId);
    }
    /** Resetea todos los fixtures */
    resetAll() {
        this.fixtureStates.clear();
    }
    /** Obtiene el estado actual de un fixture (para telemetría) */
    getFixtureState(fixtureId) {
        return this.fixtureStates.get(fixtureId);
    }
    /** Número de fixtures actualmente tracked */
    get trackedFixtureCount() {
        return this.fixtureStates.size;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // MÉTODOS PRIVADOS
    // ═══════════════════════════════════════════════════════════════════════
    /** Compara dos colores RGB con tolerancia cero (determinista) */
    colorsEqual(a, b) {
        return a.r === b.r && a.g === b.g && a.b === b.b;
    }
    /** Calcula el multiplicador actual a partir del período y BPM */
    getCurrentMultiplier(bpm, periodMs) {
        if (bpm <= 0 || periodMs <= 0)
            return 0;
        const beatMs = 60000 / bpm;
        return Math.round(periodMs / beatMs);
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════
let _instance = null;
export function getHarmonicQuantizer() {
    if (!_instance) {
        _instance = new HarmonicQuantizer();
    }
    return _instance;
}
