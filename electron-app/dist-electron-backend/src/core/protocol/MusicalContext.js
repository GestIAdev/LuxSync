/**
 * 🏛️ WAVE 201: MUSICAL CONTEXT
 *
 * Define la salida del CEREBRO (TrinityBrain).
 * El Cerebro analiza audio y produce SOLO este tipo.
 *
 * REGLA: El Cerebro NO decide colores ni DMX. Solo describe QUÉ SUENA.
 *
 * @layer CEREBRO → MOTOR
 * @version TITAN 2.0
 */
// ═══════════════════════════════════════════════════════════════════════════
// FACTORY / HELPERS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Crea un EnergyContext por defecto (silencio)
 */
export function createDefaultEnergyContext() {
    return {
        absolute: 0,
        smoothed: 0,
        percentile: 0,
        zone: 'silence',
        previousZone: 'silence',
        sustainedLow: true,
        sustainedHigh: false,
        trend: 0,
        lastZoneChange: Date.now(),
        isFlashbang: false, // 🌋 WAVE 960
    };
}
/**
 * Crea un MusicalContext por defecto (silencio/unknown)
 */
export function createDefaultMusicalContext() {
    return {
        key: null,
        mode: 'unknown',
        bpm: 120,
        beatPhase: 0,
        syncopation: 0,
        section: {
            type: 'unknown',
            current: 'unknown',
            confidence: 0,
            duration: 0,
            isTransition: false,
        },
        energy: 0,
        mood: 'neutral',
        energyContext: createDefaultEnergyContext(),
        genre: {
            macro: 'UNKNOWN',
            subGenre: null,
            confidence: 0,
        },
        confidence: 0,
        timestamp: Date.now(),
    };
}
