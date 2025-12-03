/**
 * 🥁 ANALYSIS MODULE
 * ==================
 * Análisis de audio en tiempo real (Main Thread - 30ms)
 * 
 * Componentes:
 * - RhythmAnalyzer: Detección de ritmo, BPM, groove, sincopación
 * - HarmonyDetector: Detección de tonalidad, acordes, modos
 * - SectionTracker: Tracking de secciones (verse, chorus, drop)
 * 
 * @module engines/musical/analysis
 */

// ✅ FASE 1 COMPLETADA - RhythmAnalyzer
export { RhythmAnalyzer, type RhythmAnalyzerConfig } from './RhythmAnalyzer';

// TODO: FASE 2 - HarmonyDetector  
// export { HarmonyDetector } from './HarmonyDetector';

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
} from '../types';
