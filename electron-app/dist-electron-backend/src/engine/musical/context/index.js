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
export { MusicalContextEngine, createMusicalContextEngine, } from './MusicalContextEngine.js';
// FASE 4 - PredictionMatrix
export { PredictionMatrix, createPredictionMatrix, } from './PredictionMatrix.js';
export { DEFAULT_MUSICAL_ENGINE_CONFIG } from '../types';
