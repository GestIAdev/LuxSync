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

export { DMXDriver } from './DMXDriver'
export type { 
  DMXDriverType, 
  DMXDriverConfig, 
  DMXUniverse, 
  OnDMXSendCallback 
} from './DMXDriver'

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
