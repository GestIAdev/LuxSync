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
        genre: {
            macro: 'UNKNOWN',
            subGenre: null,
            confidence: 0,
        },
        confidence: 0,
        timestamp: Date.now(),
    };
}
