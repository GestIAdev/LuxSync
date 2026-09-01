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

// 🚨 WAVE 7737: AtmosphereSystem DEREGISTERED from the L0 barrel — THE HARD WALL.
// This class was never actually wired into the 44Hz tick loop (the live L0
// atmosphere driver has always been `adapters/AtmosphereAdapter.ts`, called
// directly by TickEngine). It is intentionally NOT re-exported here so no
// future wiring can accidentally register it as an L0 system. The concrete
// atmosphere driver now lives in `atmosphere/AtmosphereCueDriver.ts`, runs at
// 4Hz, and emits into the L3 effect bus — never L0. Import AtmosphereSystem
// directly from './AtmosphereSystem' only for its legacy unit test; do not
// wire it into any orchestrator/tick registry.
