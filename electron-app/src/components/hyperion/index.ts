/**
 * ☀️ HYPERION — Simulator Module Exports
 * 
 * Unified export point for all simulator components.
 * 
 * WAVE 2042.1: Post-Scorched Earth — Architecture reset.
 * 
 * Architecture:
 * - views/: Main views (HyperionView, TacticalCanvas, VisualizerCanvas) — WIP
 * - controls/: Control panels (TheProgrammer, GroupsPanel, SceneBrowser, StageSidebar) — PRESERVED
 * - shared/: Shared utilities (ZoneLayoutEngine, NeonPalette, types) — NEW
 * - widgets/: Reusable UI components (TimecoderDock) — FUTURE
 * - engine/: Simulation hooks and utilities — FUTURE
 * 
 * @module components/hyperion
 * @since WAVE 2042.1 (Project Hyperion — Phase 0)
 */

// ═══════════════════════════════════════════════════════════════════════════
// SHARED UTILITIES — Phase 0 Complete
// ═══════════════════════════════════════════════════════════════════════════

export * from './shared'

// ═══════════════════════════════════════════════════════════════════════════
// CONTROLS — PRESERVED (TheCommander)
// ═══════════════════════════════════════════════════════════════════════════

export { TheProgrammer, GroupsPanel } from './controls'
export { StageSidebar } from './controls/sidebar'
export { SceneBrowser } from './controls/sidebar/SceneBrowser'

// ═══════════════════════════════════════════════════════════════════════════
// VIEWS — Phase 1 + Phase 3 Complete
// ═══════════════════════════════════════════════════════════════════════════

export { HyperionView, StageViewDual, HyperionViewDefault } from './views'
export { TacticalCanvas, StageSimulator2 } from './views'
export type { TacticalCanvasProps, TacticalFixture, TacticalCanvasOptions } from './views'

// Backward compatibility: default export for lazy loading
export { HyperionViewDefault as default } from './views'

// ═══════════════════════════════════════════════════════════════════════════
// WIDGETS — Phase 2 Complete (HUD Táctico)
// ═══════════════════════════════════════════════════════════════════════════

export * from './widgets'

// ═══════════════════════════════════════════════════════════════════════════
// 🚧 PLACEHOLDER: Phase 4 exports (WAVE 2042.6-7)
// ═══════════════════════════════════════════════════════════════════════════

// Phase 4 (WAVE 2042.6-7):
// export { VisualizerCanvas } from './views/visualizer/VisualizerCanvas'
// export { VisualizerCanvas as Stage3DCanvas } from './views/visualizer/VisualizerCanvas'  // Backward compat
// export * from './views/visualizer/fixtures'
// export * from './views/visualizer/environment'

// ═══════════════════════════════════════════════════════════════════════════
// LEGACY EXPORTS — REMOVED (WAVE 2042.0 Scorched Earth)
// ═══════════════════════════════════════════════════════════════════════════

// 💀 ELIMINATED:
// - StageViewDual → replaced by HyperionView
// - SimulateView → eliminated
// - StageSimulator2 → replaced by TacticalCanvas
// - Stage3DCanvas → replaced by VisualizerCanvas
// - Fixture3D, MovingHead3D, ParCan3D → replaced by HyperionFixture3D
// - StageFloor, StageTruss → replaced by NeonFloor, HyperionTruss
// - layoutGenerator3D → replaced by ZoneLayoutEngine
