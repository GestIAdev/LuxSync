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
export { 
  ScaleIdentifier, 
  SCALE_INTERVALS,
  NOTE_NAMES,
  createScaleIdentifier,
  defaultScaleIdentifier,
  type ScaleMatch,
  type ScaleIdentifierConfig,
} from './ScaleIdentifier.js';

// TODO: FASE 3 - GenreClassifier
// export { GenreClassifier } from './GenreClassifier';

// TODO: FASE 3 - MoodSynthesizer
// export { MoodSynthesizer } from './MoodSynthesizer';

// Re-export types
export type {
  MusicGenre,
  GenreClassification,
  GenreCharacteristic,
  ModalScale,
  HarmonicMood,
  SynthesizedMood,
} from '../types';
