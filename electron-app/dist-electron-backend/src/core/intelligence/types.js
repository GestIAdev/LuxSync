/**
 * 🧬 WAVE 500: PROJECT GENESIS - Core Types
 * ==========================================
 *
 * Interfaces nativas para SeleneTitanConscious.
 * Diseñadas desde cero para la arquitectura TitanEngine.
 *
 * FILOSOFÍA:
 * - Input viene de TitanEngine (estabilizado)
 * - Output va a MasterArbiter Layer 1
 * - Todo tipado estrictamente
 * - 0 legacy imports
 *
 * @module core/intelligence/types
 * @version 500.0.0
 */
export { ENERGY_OVERRIDE_THRESHOLD, isEnergyOverrideActive, createEmptyOutput, clampPhysicsModifier, clampColorDecision, } from '../protocol/ConsciousnessOutput';
// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES FELINAS
// ═══════════════════════════════════════════════════════════════════════════
/** PHI - La proporción áurea */
export const PHI = (1 + Math.sqrt(5)) / 2; // ≈ 1.6180339887
/** PHI inverso */
export const PHI_INVERSE = 1 / PHI; // ≈ 0.6180339887
/** Umbral de belleza para considerar strike */
export const BEAUTY_STRIKE_THRESHOLD = 0.75;
/** Umbral de consonancia para strike */
export const CONSONANCE_STRIKE_THRESHOLD = 0.65;
/** Mínimo de ciclos de stalking antes de strike */
export const MIN_STALKING_CYCLES = 5;
/** Máximo de ciclos de stalking (evitar parálisis) */
export const MAX_STALKING_CYCLES = 30;
/** Tamaño del historial de belleza */
export const BEAUTY_HISTORY_SIZE = 30;
/** Tamaño del historial de consonancia */
export const CONSONANCE_HISTORY_SIZE = 30;
