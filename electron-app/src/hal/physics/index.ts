/**
 * 🏛️ WAVE 205: Physics Module Exports
 * WAVE 253: Added StereoPhysics exports with named classes
 * WAVE 290.3: Added technoStereoPhysics singleton
 * WAVE 1011: HIGH VOLTAGE - RockStereoPhysics2 replaces legacy
 * WAVE 1031: THE PHOTON WEAVER - Laser & Washer physics
 * WAVE 1044: THE DEEP FIELD - Chill ecosystem rewrite
 * WAVE 2401: THE LIQUID STEREO - 7-band engine + LiquidEnvelope
 */

export * from './PhysicsEngine'
export { TechnoStereoPhysics, technoStereoPhysics } from './TechnoStereoPhysics'
// ❌ WAVE 1011: DELETED LEGACY FRANKENSTEIN
// export { RockStereoPhysics } from './RockStereoPhysics'
export { LatinoStereoPhysics } from './LatinoStereoPhysics'

// 🌌 WAVE 1044: THE DEEP FIELD - Chill Lounge Generative Ecosystem
export { 
  calculateChillStereo, 
  resetDeepFieldState,
  getDeepFieldState,
  type DeepFieldOutput 
} from './ChillStereoPhysics'

// 🎸 WAVE 1011.5: UNIFIED ROCK PHYSICS (Lobotomized - No Subgenres)
export { 
  RockStereoPhysics2, 
  rockPhysics2,
  type RockPhysicsInput,
  type RockPhysicsResult,
} from './RockStereoPhysics2'

// ═══════════════════════════════════════════════════════════════════════════
// 🟢🎨 WAVE 1031: THE PHOTON WEAVER - Spectral Band Physics
// ═══════════════════════════════════════════════════════════════════════════
// 
// ARQUITECTURA ESPECTRAL COMPLETA:
// - Sub-Graves (Washers) = Sentimiento/Atmósfera
// - Medios (Movers/PARs) = Ritmo/Baile
// - Ultra-Agudos (Láseres) = Detalle/Tecnología
// ═══════════════════════════════════════════════════════════════════════════

// 🟢 LASER PHYSICS - "La Cirugía de Luz"
// Input: ultraAir (16-22kHz) + clarity
// Comportamientos: LIQUID_SKY (clean) | SPARKLE_RAIN (harsh)
export {
  LaserPhysics,
  laserPhysics,
  type LaserPhysicsInput,
  type LaserPhysicsResult,
  type LaserTextureMode,
  type LaserSafetyConfig,
} from './LaserPhysics'

// 🎨 WASHER PHYSICS - "El Lienzo de Fondo"
// Input: subBass (20-60Hz) + texture
// Comportamientos: BREATHING_WALL (warm) | REACTIVE_STROBE (harsh)
export {
  WasherPhysics,
  washerPhysics,
  type WasherPhysicsInput,
  type WasherPhysicsResult,
  type WasherMode,
} from './WasherPhysics'

// ═══════════════════════════════════════════════════════════════════════════
// 🌊 WAVE 2411: THE LIQUID STEREO - 7-Band Omni-Liquid Engine + Profiles
// ═══════════════════════════════════════════════════════════════════════════
//
// LiquidEnvelope: Abstracción universal de banda (1 clase, N instancias)
// LiquidStereoPhysics: Motor de 7 zonas, parametrizado por ILiquidProfile
// Profiles: TECHNO_PROFILE (default), futuro: ROCK, LATINO, CHILL...
// ═══════════════════════════════════════════════════════════════════════════

export {
  LiquidEnvelope,
  type LiquidEnvelopeConfig,
} from './LiquidEnvelope'

export {
  LiquidStereoPhysics,
  liquidStereoPhysics,
  type LiquidStereoInput,
  type LiquidStereoResult,
} from './LiquidStereoPhysics'

export type { ILiquidProfile } from './profiles/ILiquidProfile'
export { TECHNO_PROFILE, PROFILE_REGISTRY, DEFAULT_LIQUID_PROFILE } from './profiles'
