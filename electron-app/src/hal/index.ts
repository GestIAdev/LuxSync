/**
 * 🏛️ WAVE 202-210: HAL INDEX
 * 
 * Hardware Abstraction Layer exports:
 * - HardwareAbstraction: Main facade (WAVE 202)
 * - PhysicsEngine: Decay/inertia physics (WAVE 205)
 * - ZoneRouter: Zone-to-fixture mapping (WAVE 207)
 * - FixtureMapper: Intent-to-DMX conversion (WAVE 210)
 */

export { HardwareAbstraction } from './HardwareAbstraction'
export * from './physics'
export * from './mapping'
