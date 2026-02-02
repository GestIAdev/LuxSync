/**
 * 🎼 WAVE 8: MUSICAL INTELLIGENCE - TYPE DEFINITIONS
 * ===================================================
 * Tipos e interfaces base para el Motor de Inteligencia Musical
 *
 * REGLAS DE ORO IMPLEMENTADAS:
 * - REGLA 1: Separación Main Thread vs Worker Thread
 * - REGLA 2: Campo 'confidence' en todas las interfaces críticas
 * - REGLA 3: 'syncopation' como ciudadano de primera clase
 *
 * @module engines/musical/types
 */
// PHI definido localmente (heredado de FibonacciPatternEngine)
const PHI = (1 + Math.sqrt(5)) / 2; // ≈ 1.6180339887...
/**
 * Configuración por defecto
 */
export const DEFAULT_MUSICAL_ENGINE_CONFIG = {
    mainThreadInterval: 30,
    workerThreadInterval: 500,
    confidenceThreshold: 0.5,
    warmupTime: 5000,
    learningEnabled: true,
    predictionsEnabled: true,
};
// ============================================================
// 🌟 CONSTANTES
// ============================================================
/**
 * Constante PHI (Golden Ratio) - Heredada de Selene
 */
export const MUSICAL_PHI = PHI;
/**
 * Umbrales de sincopación por género
 * ⚠️ REGLA 3: Estos son los valores de referencia
 */
export const SYNCOPATION_THRESHOLDS = {
    /** Techno/House: Muy bajo (straight beat) */
    STRAIGHT: 0.15,
    /** Pop/Rock: Moderado */
    MODERATE: 0.4,
    /** Reggaeton/Funk: Alto */
    HIGH: 0.4,
    /** Jazz swing threshold */
    SWING_MIN: 0.15,
};
/**
 * Umbrales de BPM por género (solo para desempate)
 * ⚠️ REGLA 3: Usar DESPUÉS de syncopation
 */
export const BPM_RANGES = {
    reggaeton: { min: 85, max: 100 },
    cumbia: { min: 85, max: 115 },
    house: { min: 118, max: 130 },
    techno: { min: 125, max: 145 },
    dubstep: { min: 138, max: 145 },
    trap: { min: 60, max: 90 },
    drum_and_bass: { min: 160, max: 180 },
};
