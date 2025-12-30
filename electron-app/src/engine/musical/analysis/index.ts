/**
 * 🥁 ANALYSIS MODULE
 * ==================
 * Análisis de audio en tiempo real (Main Thread - 30ms)
 * 
 * Componentes:
 * - RhythmAnalyzer: Detección de ritmo, BPM, groove, sincopación ✅
 * - HarmonyDetector: Detección de tonalidad, acordes, modos ✅
 * - SectionTracker: Tracking de secciones (verse, chorus, drop)
 * 
 * @module engines/musical/analysis
 */

// ✅ FASE 1 COMPLETADA - RhythmAnalyzer
export { RhythmAnalyzer, type RhythmAnalyzerConfig } from './RhythmAnalyzer.js';

// ✅ FASE 2 COMPLETADA - HarmonyDetector  
export { 
  HarmonyDetector,
  MODE_TO_MOOD,
  MOOD_TEMPERATURE,
  DISSONANT_INTERVALS,
  TRITONE_INTERVAL,
  createHarmonyDetector,
  defaultHarmonyDetector,
  type HarmonyDetectorConfig,
  type ChromaAnalysis,
  type DissonanceAnalysis,
  type ChordEstimate,
} from './HarmonyDetector.js';

// TODO: FASE 3 - SectionTracker
// export { SectionTracker } from './SectionTracker';

// Re-export types
export type {
  RhythmAnalysis,
  HarmonyAnalysis,
  SectionAnalysis,
  DrumDetection,
  GrooveAnalysis,
  DrumPatternType,
  AudioAnalysis,
  AudioSpectrum,
  BeatInfo,
  EnergyInfo,
} from '../types.js';
