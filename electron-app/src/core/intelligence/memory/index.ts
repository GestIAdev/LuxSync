// ═══════════════════════════════════════════════════════════════════════════
//  🧠 MEMORY MODULE - El Sistema de Memoria de Selene
// ═══════════════════════════════════════════════════════════════════════════
//  WAVE 664-665 - CONTEXTUAL MEMORY
//  "La diferencia entre un DJ y un maestro es que el maestro recuerda"
// ═══════════════════════════════════════════════════════════════════════════

// Core utilities
export { CircularBuffer } from './CircularBuffer';
export { RollingStats } from './RollingStats';
export type { MetricStats, RollingStatsConfig } from './RollingStats';

// Contextual Memory (main export)
export { ContextualMemory } from './ContextualMemory';
export type {
  SectionType,
  SectionHistoryEntry,
  ContextualMemoryInput,
  AggregatedStats,
  NarrativePhase,
  NarrativeContext,
  AnomalyType,
  AnomalyRecommendation,
  AnomalyReport,
  ContextualMemoryOutput,
  ContextualMemoryConfig,
} from './ContextualMemory';

// Default export
export { ContextualMemory as default } from './ContextualMemory';
