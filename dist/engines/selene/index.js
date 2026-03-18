/**
 * 🧬 SELENE CORE - Exports principales para LuxSync
 *
 * Apollo/Selene Legacy: Algunos imports internos pueden tener nombres "Apollo"
 * Esto es completamente funcional (~10-15% legacy naming)
 */
// ===== CONSCIOUSNESS (5 Capas) =====
export { SeleneConsciousness } from './consciousness/SeleneConsciousness.js';
export { ApolloConsciousnessV401 } from './consciousness/ApolloConsciousnessV401.js';
export { ConsciousnessMemoryStore } from './consciousness/ConsciousnessMemoryStore.js';
export { MusicalPatternRecognizer } from './consciousness/MusicalPatternRecognizer.js';
// ===== EVOLUTIONARY ENGINE =====
export { SeleneEvolutionEngine } from './evolutionary/selene-evolution-engine.js';
// ===== SWARM & CONSENSUS =====
// (Exports se agregarán según necesitemos)
// ===== MUSIC UTILS =====
export { SeededRandom } from './music/utils/SeededRandom.js';
export * from './music/utils/ScaleUtils.js';
export * from './music/utils/MusicTheoryUtils.js';
// ===== CORE UTILITIES =====
export * from './core/Cache.js';
export * from './core/PubSub.js';
export * from './core/Queue.js';
// Note: Algunos archivos pueden tener imports internos con "Apollo" - esto es normal
// El código funciona perfectamente, solo es naming legacy
//# sourceMappingURL=index.js.map