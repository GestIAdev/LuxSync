/**
 * SIMULATOR CONTROLS - WAVE 436: POST-PURGE EXPORTS
 * Control panels for fixture manipulation
 * 
 * Post-WAVE 435 Architecture:
 * - TheProgrammer: Main hub (replaced InspectorControls)
 * - Sections: Intensity, Color, Position, Beam
 * - Sidebar: SceneBrowser (replaced ScenesPlaceholder)
 */

export { TheProgrammer, default } from './TheProgrammer'
export { TheProgrammerContent } from './TheProgrammerContent'
export { GroupsPanel } from './GroupsPanel'
export { IntensitySection } from './IntensitySection'
export { ColorSection } from './ColorSection'
export { PositionSection } from './PositionSection'
export { BeamSection } from './BeamSection'

// Sub-components
export { XYPad, PatternSelector, PrecisionInputs } from './controls'
export type { PatternType } from './controls'

// Sidebar exports
export { StageSidebar } from './sidebar/StageSidebar'
export { SceneBrowser } from './sidebar/SceneBrowser'
