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

// FASE 4 - MusicalContextEngine
export { 
  MusicalContextEngine, 
  createMusicalContextEngine,
  type OperationMode,
  type ReactiveResult,
  type IntelligentResult,
  type EngineResult,
  type MusicalContextEngineConfig,
} from './MusicalContextEngine.js';

// FASE 4 - PredictionMatrix
export { 
  PredictionMatrix, 
  createPredictionMatrix,
  type LightingAction,
  type PredictionActions,
  type ExtendedPrediction,
  type PredictionMatrixConfig,
} from './PredictionMatrix.js';

// Re-export types
export type {
  MusicalContext,
  MusicalPrediction,
  PredictionType,
  MusicalEngineConfig,
} from '../types';

export { DEFAULT_MUSICAL_ENGINE_CONFIG } from '../types';
