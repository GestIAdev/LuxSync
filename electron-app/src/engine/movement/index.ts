/**
 * 🔌 HARDWARE LAYER
 * Exportaciones centralizadas de la capa de hardware
 */

export { FixtureManager } from './FixtureManager'
export type { 
  FixtureDefinition, 
  ChannelDefinition, 
  ChannelType,
  ManagedFixture 
} from './FixtureManager'

// V16.1 Physics Driver - Movimiento abstracto → DMX físico
export { FixturePhysicsDriver } from './FixturePhysicsDriver'
export type {
  Position2D,
  AbstractPosition,
  DMXPosition,
  InstallationPreset,
  FixtureConfig,
  PhysicsConfig,
} from './FixturePhysicsDriver'

// WAVE 338: Vibe Movement Presets - Física + Óptica por vibe
export {
  getMovementPreset,
  getMovementPhysics,
  getOpticsConfig,
  getMovementBehavior,
  getAvailableVibeIds,
  MOVEMENT_PRESETS,
} from './VibeMovementPresets'
export type {
  MovementPreset,
  MovementPhysics,
  OpticsConfig,
  MovementBehavior,
} from './VibeMovementPresets'

// WAVE 2601: Inverse Kinematics Engine - Spatial 3D → Pan/Tilt DMX
// WAVE 2621-2622: Spatial Fan (Line + Circle) offset math
export {
  solve as ikSolve,
  solveGroup as ikSolveGroup,
  buildProfile as ikBuildProfile,
  computeLineFanOffsets,
  computeCircleFanOffsets,
  solveGroupWithFan,
} from './InverseKinematicsEngine'
export type {
  Target3D,
  FixtureOrientation,
  MechanicalLimits,
  FixtureCalibration,
  IKFixtureProfile,
  IKResult,
  SpatialFanMode,
  IKFanResult,
} from './InverseKinematicsEngine'
