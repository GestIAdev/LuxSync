/**
 * ☀️ HYPERION — Visualizer Module (3D)
 * 
 * Exporta el canvas 3D con todos sus componentes.
 * 
 * @module components/hyperion/views/visualizer
 * @since WAVE 2042.6 (Project Hyperion — Phase 4)
 */

// Main Component
export { VisualizerCanvas, Stage3DCanvas } from './VisualizerCanvas'
export { default } from './VisualizerCanvas'

// Types
export type { 
  Fixture3DData,
  StageConfig3D,
  VisualizerOptions,
  Visualizer3DMetrics,
  InstanceMap 
} from './types'

// Hooks
export { useFixture3DData } from './useFixture3DData'

// Sub-modules (for advanced usage)
export * from './fixtures'
export * from './environment'
export * from './postprocessing'
