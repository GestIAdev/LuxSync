/**
 * ⚡ WAVE 3504-EXT.3 — AdaptiveFloorTracker
 *
 * Servicio con estado mínimo y encapsulado.
 * Mantiene un buffer rolling de peaks de rawBassFlux y calcula el floor
 * adaptativo al 40% de la mediana.
 *
 * Extraído de senses.ts (WAVE 2491: ADAPTIVE BASS FLOOR).
 *
 * ───── Historia ─────────────────────────────────────────────────────────────
 * WAVE 2170: Hardcoded floor 0.030 calibrado para Boris Brejcha en tarjeta
 *            profesional. Falla con system loopback / hardware diferente:
 *            rawBassFlux crónico < 0.030 → needle=0 → BPM muere.
 * WAVE 2491: Floor adaptativo auto-calibrado desde historial reciente de flux.
 *            40% de mediana, clamp [0.005, 0.060].
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Agnóstico al entorno Worker. No conoce parentPort, IPC ni SAB.
 * Recibe un número por frame, devuelve el floor actual.
 */
// ============================================
// CONSTANTES
// ============================================
const ADAPTIVE_FLOOR_WINDOW = 64; // ~3 segundos de frames FFT a 20fps
const ADAPTIVE_FLOOR_MIN = 0.005; // Piso absoluto — previene triggers de ruido
const ADAPTIVE_FLOOR_MAX = 0.060; // Techo absoluto — previene runaway en transientes fuertes
const ADAPTIVE_FLOOR_RATIO = 0.40; // 40% de la mediana del peak reciente
const ADAPTIVE_FLOOR_MIN_SAMPLES = 8; // Mínimo de muestras antes de calcular
const ADAPTIVE_FLOOR_BOOTSTRAP = 0.015; // Valor inicial (más bajo que el 0.030 de WAVE 2170)
// ============================================
// AdaptiveFloorTracker
// ============================================
/**
 * Tracker de floor adaptativo basado en ventana rolling de peaks de flux.
 *
 * El floor se actualiza cada frame con el rawBassFlux del frame actual.
 * Si no hay suficientes datos en la ventana, devuelve el valor bootstrap.
 *
 * Invariantes:
 * - El floor siempre está en [ADAPTIVE_FLOOR_MIN, ADAPTIVE_FLOOR_MAX]
 * - Solo valores por encima de ADAPTIVE_FLOOR_MIN entran al buffer
 *   (para no contaminar la mediana con silencio)
 * - La ventana tiene un máximo de ADAPTIVE_FLOOR_WINDOW entradas (64)
 */
export class AdaptiveFloorTracker {
    constructor() {
        this.floorBuffer = [];
        this.currentFloor = ADAPTIVE_FLOOR_BOOTSTRAP;
    }
    /**
     * Actualiza el tracker con el flux del frame actual y devuelve el floor activo.
     *
     * @param rawBassFlux  Flux de bass completo del frame (rawLowFlux + bassOnlyFlux)
     * @returns            Floor adaptativo actual en [ADAPTIVE_FLOOR_MIN, ADAPTIVE_FLOOR_MAX]
     */
    update(rawBassFlux) {
        // Solo valores significativos entran al buffer (excluye silencio)
        if (rawBassFlux > ADAPTIVE_FLOOR_MIN) {
            this.floorBuffer.push(rawBassFlux);
            if (this.floorBuffer.length > ADAPTIVE_FLOOR_WINDOW) {
                this.floorBuffer.shift();
            }
        }
        if (this.floorBuffer.length < ADAPTIVE_FLOOR_MIN_SAMPLES) {
            // Insuficientes datos — usar valor bootstrap
            return this.currentFloor;
        }
        // Mediana del buffer (copia ordenada para no mutar el original)
        const sorted = this.floorBuffer.slice().sort((a, b) => a - b);
        const medianIdx = Math.floor(sorted.length / 2);
        const median = sorted[medianIdx];
        // Floor = 40% de la mediana, clamp al rango de seguridad
        this.currentFloor = Math.max(ADAPTIVE_FLOOR_MIN, Math.min(ADAPTIVE_FLOOR_MAX, median * ADAPTIVE_FLOOR_RATIO));
        return this.currentFloor;
    }
    /**
     * Devuelve el floor actual sin actualizar.
     */
    getCurrent() {
        return this.currentFloor;
    }
    /**
     * Resetea el tracker al estado inicial.
     * Llamar en RESET_PACEMAKER (fuente de audio cambia → el floor previo
     * puede matar kicks de la nueva fuente).
     *
     * WAVE 3414: MIC vs VirtualWire tienen niveles distintos — sin reset,
     * el floor del MIC mata los kicks de VirtualWire y viceversa.
     */
    reset() {
        this.floorBuffer.length = 0;
        this.currentFloor = ADAPTIVE_FLOOR_BOOTSTRAP;
    }
}
