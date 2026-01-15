/**
 * 🎭 SIMULATOR - WAVE 434: THE GREAT CONSOLIDATION
 * Unified export point for all simulator components
 * 
 * Architecture:
 * - views/: Main views (StageViewDual, 2D/3D renderers)
 * - controls/: Control panels (TheProgrammer, GroupsPanel, SceneBrowser, StageSidebar)
 * - widgets/: Reusable UI components
 * - engine/: Simulation hooks and utilities
 */

// Main Views
export { StageViewDual } from './views/StageViewDual'
export { default as StageSimulator2 } from './views/SimulateView'

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
