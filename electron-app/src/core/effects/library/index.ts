/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧨 EFFECT LIBRARY INDEX
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 680: THE ARSENAL
 * 
 * Exporta todos los efectos del arsenal de Selene.
 * 
 * @module core/effects/library
 * @version WAVE 680
 */

// ═══════════════════════════════════════════════════════════════════════════
// EFFECTS
// ═══════════════════════════════════════════════════════════════════════════

export { SolarFlare, createSolarFlare, SOLAR_FLARE_DEFAULT_CONFIG } from './SolarFlare'
export { StrobeStorm, createStrobeStorm } from './StrobeStorm'
export { TidalWave, createTidalWave } from './TidalWave'
export { GhostBreath, createGhostBreath } from './GhostBreath'

// ═══════════════════════════════════════════════════════════════════════════
// TYPE RE-EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export type { ILightEffect, EffectTriggerConfig, MusicalContext } from '../types'
