/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️  AETHER MATRIX — SYSTEMS BARREL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Punto de entrada único para todos los Systems del Motor Agnóstico.
 *
 * WAVE 3505.3
 */

// Base infrastructure
export { BaseSystem }           from './BaseSystem'
export type {
  IAetherSystem,
  FrameContext,
  AudioMetrics,
  VibeProfile,
  MusicalContext,
  ColorEntry,
} from './BaseSystem'

// Concrete systems
export { ImpactSystem }     from './ImpactSystem'
export { ColorSystem }      from './ColorSystem'
export { KineticSystem }    from './KineticSystem'
export { BeamSystem }       from './BeamSystem'
export { AtmosphereSystem } from './AtmosphereSystem'
