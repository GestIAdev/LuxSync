/**
 * 🎭 CLASSIFICATION MODULE
 * ========================
 * Clasificación musical (Worker Thread - Throttled 500ms)
 *
 * ⚠️ REGLA 3: Priorizar SYNCOPATION sobre BPM
 *
 * Componentes:
 * - GenreClassifier: Clasificación de género (reggaeton vs cumbia vs house...)
 * - MoodSynthesizer: Síntesis de mood de múltiples señales
 * - ScaleIdentifier: Identificación de escalas musicales ✅
 *
 * @module engines/musical/classification
 */
// ✅ FASE 2 - ScaleIdentifier COMPLETADO
export { ScaleIdentifier, SCALE_INTERVALS, NOTE_NAMES, createScaleIdentifier, defaultScaleIdentifier, } from './ScaleIdentifier.js';
