/**
 * 🏛️ WAVE 202-1000: HAL INDEX
 * 
 * Hardware Abstraction Layer exports:
 * - HardwareAbstraction: Main facade (WAVE 202)
 * - PhysicsEngine: Decay/inertia physics (WAVE 205)
 * - ZoneRouter: Zone-to-fixture mapping (WAVE 207)
 * - FixtureMapper: Intent-to-DMX conversion (WAVE 210)
 * - Translation: Color translation & safety layer (WAVE 1000)
 */

export { HardwareAbstraction } from './HardwareAbstraction'
export * from './physics'
export * from './mapping'

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 WAVE 1000: HAL GENESIS - Translation & Safety Layer
// ═══════════════════════════════════════════════════════════════════════════
export * from './translation'
