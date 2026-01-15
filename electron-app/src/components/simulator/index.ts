/**
 * 🎭 SIMULATOR - WAVE 436: POST-CONSOLIDATION EXPORTS
 * Unified export point for all simulator components
 * 
 * Architecture Post-WAVE 434/435:
 * - views/: Main views (StageViewDual, 2D/3D renderers)
 * - controls/: Control panels (TheProgrammer, GroupsPanel, SceneBrowser, StageSidebar)
 * - widgets/: Reusable UI components (future)
 * - engine/: Simulation hooks and utilities (future)
 * 
 * WAVE 435 Purge: Removed InspectorControls + legacy sub-widgets (8 files)
 */

// Main Views
export { StageViewDual } from './views/StageViewDual'
export { default as SimulateView } from './views/SimulateView'
export { StageSimulator2 } from './views/SimulateView/StageSimulator2'

// Default export for lazy loading
export { StageViewDual as default } from './views/StageViewDual'

// 3D Rendering
export { Stage3DCanvas } from './views/stage3d'
export * from './views/stage3d/fixtures'
export * from './views/stage3d/environment'

// Controls
export { TheProgrammer, TheProgrammerContent, GroupsPanel } from './controls'
export { StageSidebar } from './controls/sidebar'
export { SceneBrowser } from './controls/sidebar/SceneBrowser'

// Legacy (to be deprecated)
// export { InspectorControls } from './controls/sidebar/InspectorControls'
