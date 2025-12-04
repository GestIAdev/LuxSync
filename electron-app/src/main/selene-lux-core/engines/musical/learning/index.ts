/**
 * 📚 LEARNING MODULE
 * ==================
 * Aprendizaje y memoria de patrones musicales
 * 
 * Componentes:
 * - SeleneMemoryManager: Persistencia SQLite para aprendizaje a largo plazo
 * - GenrePatternLibrary: Biblioteca de patrones pre-entrenados (TODO)
 * - PatternLearner: Aprendizaje por refuerzo (TODO)
 * 
 * @module engines/musical/learning
 */

// 🧠 SELENE MEMORY MANAGER - Memoria inmortal SQLite
export {
  SeleneMemoryManager,
  getMemoryManager,
  resetMemoryManager,
} from './SeleneMemoryManager';

export type {
  MusicalDNA,
  PaletteRecord,
  LearnedPattern,
  SessionRecord,
  DreamRecord,
  FixtureCalibration,
  MemoryManagerConfig,
} from './SeleneMemoryManager';

// TODO: FASE 6 - GenrePatternLibrary
// export { GenrePatternLibrary } from './GenrePatternLibrary';

// TODO: FASE 6 - PatternLearner
// export { PatternLearner } from './PatternLearner';

// Re-export types from main types file (compatibilidad)
export type {
  LearnedPattern as LegacyLearnedPattern,
} from '../types';
