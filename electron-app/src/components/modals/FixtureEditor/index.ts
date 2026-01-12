/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔨 FIXTURE EDITOR - Barrel Exports
 * ═══════════════════════════════════════════════════════════════════════════
 */

// Legacy editor (mantener para backward compatibility)
export { FixtureEditorModal } from './FixtureEditorModal'
export { default as FixtureEditorModalDefault } from './FixtureEditorModal'

// WAVE 364: Fixture Forge (New Advanced Editor)
export { FixtureForge } from './FixtureForge'
export { default as FixtureForgeDefault } from './FixtureForge'

// Sub-components
export { FixturePreview3D } from './FixturePreview3D'
export { PhysicsTuner } from './PhysicsTuner'

// Types
export type { FixtureForgeProps } from './FixtureForge'
export type { FixturePreviewProps } from './FixturePreview3D'
export type { PhysicsTunerProps } from './PhysicsTuner'
