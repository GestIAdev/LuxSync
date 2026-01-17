/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 500 - PROJECT GENESIS: DREAM MODULE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El módulo de SUEÑOS de la consciencia nativa.
 *
 * "En los sueños, Selene explora futuros alternativos
 *  y se analiza a sí misma."
 *
 * Componentes:
 * - ScenarioSimulator: "¿Qué pasaría si...?" - Simula futuros
 * - BiasDetector: "Conócete a ti mismo" - Auto-análisis de sesgos
 *
 * Flujo:
 * sense/ → think/ → [dream/] → act
 *                    ^^^^^^^^
 *                    AQUÍ ESTAMOS
 *
 * El módulo dream/ es OPCIONAL pero PODEROSO:
 * - Se activa en momentos de "calma" (baja energía)
 * - Simula antes de ejecutar cambios dramáticos
 * - Detecta patrones repetitivos para evitar monotonía
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */
// ScenarioSimulator - El Soñador
export { dream, getLastDream, getDreamStats, resetDreamEngine } from './ScenarioSimulator';
// BiasDetector - El Psicoanalista
export { recordDecision, analyzeBiases, getBiasStrings, getLastAnalysis, getBiasStats, resetBiasDetector } from './BiasDetector';
