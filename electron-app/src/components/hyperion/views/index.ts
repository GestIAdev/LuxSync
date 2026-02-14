/**
 * ☀️ HYPERION — Views Module Index
 * 
 * Main rendering views for the Live View module.
 * 
 * WAVE 2042.3: Phase 1 — HyperionView created.
 * WAVE 2042.5: Phase 3 — TacticalCanvas created.
 * WAVE 2042.6: Phase 4 — VisualizerCanvas created.
 * 
 * @module components/hyperion/views
 * @since WAVE 2042.1 (Project Hyperion — Phase 0)
 */

// ═══════════════════════════════════════════════════════════════════════════
// MAIN VIEW — Phase 1 Complete
// ═══════════════════════════════════════════════════════════════════════════

export { HyperionView, StageViewDual } from './HyperionView'
export { default as HyperionViewDefault } from './HyperionView'

// ═══════════════════════════════════════════════════════════════════════════
// TACTICAL CANVAS (2D) — Phase 3 Complete
// ═══════════════════════════════════════════════════════════════════════════

export { TacticalCanvas } from './tactical'
export type { TacticalCanvasProps, TacticalFixture, TacticalCanvasOptions } from './tactical'

// Re-export for backward compatibility
export { TacticalCanvas as StageSimulator2 } from './tactical'

// ═══════════════════════════════════════════════════════════════════════════
// VISUALIZER CANVAS (3D) — Phase 4 Complete
// ═══════════════════════════════════════════════════════════════════════════

export { VisualizerCanvas, Stage3DCanvas } from './visualizer'
export type { 
  Fixture3DData, 
  StageConfig3D, 
  VisualizerOptions, 
  Visualizer3DMetrics 
} from './visualizer'

// ═══════════════════════════════════════════════════════════════════════════
// 💀 ELIMINATED (WAVE 2042.0 Scorched Earth)
// ═══════════════════════════════════════════════════════════════════════════

// - StageViewDual.tsx/.css → HyperionView
// - SimulateView/ → TacticalCanvas
// - stage3d/ → VisualizerCanvas
