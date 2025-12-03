/**
 * 🧠 CONTEXT MODULE
 * =================
 * Orquestación del contexto musical
 * 
 * ⚠️ REGLA 2: Implementar fallback cuando confidence < 0.5
 * 
 * Componentes:
 * - MusicalContextEngine: Orquestador principal
 * - PredictionMatrix: Predicción de eventos musicales
 * 
 * @module engines/musical/context
 */

// TODO: FASE 4 - MusicalContextEngine
// export { MusicalContextEngine } from './MusicalContextEngine';

// TODO: FASE 4 - PredictionMatrix
// export { PredictionMatrix } from './PredictionMatrix';

// Re-export types
export type {
  MusicalContext,
  MusicalPrediction,
  PredictionType,
  MusicalEngineConfig,
} from '../types';

export { DEFAULT_MUSICAL_ENGINE_CONFIG } from '../types';
