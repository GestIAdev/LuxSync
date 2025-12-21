/**
 * 🎼 WAVE 8: MUSICAL INTELLIGENCE ENGINE
 * ========================================
 * El Oído Absoluto de Selene Lux
 * 
 * Este módulo entrena a Selene para distinguir géneros musicales
 * y reaccionar de manera inteligente a la música.
 * 
 * REGLAS DE ORO (Ver Blueprint):
 * 1. RENDIMIENTO: Análisis pesado → Worker Thread (500ms)
 * 2. FALLBACK: confidence < 0.5 → Modo Reactivo V17
 * 3. SINCOPACIÓN > BPM: Para clasificación de géneros
 * 
 * @module engines/musical
 * @version 2.0.0 - FASE 7 Integration
 * @date December 2025
 */

// ============================================================
// 📦 TYPES & INTERFACES (Exportación completa)
// ============================================================
export * from './types';

// ============================================================
// 📁 SUB-MÓDULOS
// ============================================================

// 🥁 Analysis (Main Thread - 30ms)
export * from './analysis';

// 🎭 Classification (Worker Thread - 500ms)
export * from './classification';

// 🧠 Context (Orquestación)
export * from './context';

// 📚 Learning (Memoria SQLite)
export * from './learning';

// 🎨 Mapping (Música → Luces)
export * from './mapping';

// ============================================================
// 🥁 ANALYSIS COMPONENTS
// ============================================================
// ✅ FASE 1
export { RhythmAnalyzer } from './analysis/RhythmAnalyzer';
// ✅ FASE 2
export { HarmonyDetector } from './analysis/HarmonyDetector';
// ✅ FASE 3
export { SectionTracker } from './analysis/SectionTracker';

// ============================================================
// 🎭 CLASSIFICATION COMPONENTS
// ============================================================
// ✅ FASE 2
export { ScaleIdentifier } from './classification/ScaleIdentifier';
// 🗑️ WAVE 61: GenreClassifier ELIMINADO - Reemplazado por VibeManager

// ============================================================
// 🧠 CONTEXT COMPONENTS
// ============================================================
// ✅ FASE 4
export { MusicalContextEngine } from './context/MusicalContextEngine';
export { PredictionMatrix } from './context/PredictionMatrix';

// ============================================================
// 📚 LEARNING COMPONENTS
// ============================================================
// ✅ FASE 6
export { 
  SeleneMemoryManager, 
  getMemoryManager, 
  resetMemoryManager 
} from './learning/SeleneMemoryManager';

export type {
  MusicalDNA,
  PaletteRecord,
  LearnedPattern,
  SessionRecord,
  DreamRecord,
  FixtureCalibration,
  MemoryManagerConfig,
} from './learning/SeleneMemoryManager';

// ============================================================
// 🎨 MAPPING COMPONENTS
// ============================================================
// ✅ FASE 5
export { 
  ProceduralPaletteGenerator,
  hslToRgb,
  hslToHex,
} from './mapping/ProceduralPaletteGenerator';

export type {
  HSLColor,
  RGBColor,
  MusicalDNA as PaletteDNA,
} from './mapping/ProceduralPaletteGenerator';

export { PaletteManager } from './mapping/PaletteManager';
export { MusicToLightMapper } from './mapping/MusicToLightMapper';

export type {
  LightingSuggestion,
} from './mapping/MusicToLightMapper';

// ============================================================
// 🧠 INTEGRATION - SELENE MUSICAL BRAIN
// ============================================================
// ✅ FASE 7 - El Sistema Nervioso Central
export { 
  SeleneMusicalBrain,
  getMusicalBrain,
  resetMusicalBrain,
} from './SeleneMusicalBrain';

export type {
  BrainOutput,
  BrainConfig,
  UserFeedback,
} from './SeleneMusicalBrain';
