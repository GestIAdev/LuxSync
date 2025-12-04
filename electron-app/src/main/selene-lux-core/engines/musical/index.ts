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
 * @version 1.0.0
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

// 📚 Learning (Memoria)
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
// ✅ FASE 3
export { GenreClassifier } from './classification/GenreClassifier';
// TODO: FASE 3+ (opcional)
// export { MoodSynthesizer } from './classification/MoodSynthesizer';

// ============================================================
// 🧠 CONTEXT COMPONENTS
// ============================================================
// TODO: FASE 4
// export { MusicalContextEngine } from './context/MusicalContextEngine';
// export { PredictionMatrix } from './context/PredictionMatrix';

// ============================================================
// 📚 LEARNING COMPONENTS
// ============================================================
// TODO: FASE 6
// export { GenrePatternLibrary } from './learning/GenrePatternLibrary';
// export { PatternLearner } from './learning/PatternLearner';

// ============================================================
// 🎨 MAPPING COMPONENTS
// ============================================================
// TODO: FASE 5
// export { MusicToLightMapper } from './mapping/MusicToLightMapper';
// export { TransitionPredictor } from './mapping/TransitionPredictor';
