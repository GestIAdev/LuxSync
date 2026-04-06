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
  getOceanicMorphFactor,    // WAVE 2470: Hydrostatic Bridge
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

// 🌊 WAVE 2429: THE A/B FOUNDATION — Omni-Liquid Engine (Base + 4.1 + 7.1)
export { LiquidEngineBase, type ProcessedFrame } from './LiquidEngineBase'
export { LiquidEngine71, liquidEngine71 } from './LiquidEngine71'
export { LiquidEngine41, liquidEngine41 } from './LiquidEngine41'
// 🌊 WAVE 2434: TELEMETRY ENGINE — Drop-in replacement de liquidEngine41 para captura de datos
export { LiquidEngine41Telemetry, latinoEngine41Telemetry, type Latino41TelemetryRecord } from './LiquidEngine41Telemetry'

export type { ILiquidProfile } from './profiles/ILiquidProfile'
export { TECHNO_PROFILE, LATINO_PROFILE, POPROCK_PROFILE, PROFILE_REGISTRY, DEFAULT_LIQUID_PROFILE } from './profiles'
