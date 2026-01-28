/**
 * 🏛️ WAVE 205: Physics Module Exports
 * WAVE 253: Added StereoPhysics exports with named classes
 * WAVE 290.3: Added technoStereoPhysics singleton
 * WAVE 1011: HIGH VOLTAGE - RockStereoPhysics2 replaces legacy
 */

export * from './PhysicsEngine'
export { TechnoStereoPhysics, technoStereoPhysics } from './TechnoStereoPhysics'
// ❌ WAVE 1011: DELETED LEGACY FRANKENSTEIN
// export { RockStereoPhysics } from './RockStereoPhysics'
export { LatinoStereoPhysics } from './LatinoStereoPhysics'
export { ChillStereoPhysics } from './ChillStereoPhysics'

// 🎸 WAVE 1011.5: UNIFIED ROCK PHYSICS (Lobotomized - No Subgenres)
export { 
  RockStereoPhysics2, 
  rockPhysics2,
  type RockPhysicsInput,
  type RockPhysicsResult,
} from './RockStereoPhysics2'
