/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔪 TECHNO EFFECTS - THE ARSENAL
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 770: TECHNO PHYSICS KERNEL
 * WAVE 810: UNLOCK THE TWINS - CyberDualism
 * WAVE 930: GATLING RAID / SKY SAW / ABYSSAL RISE - El Arsenal Pesado
 * WAVE 977: LA FÁBRICA - AmbientStrobe / SonarPing
 * 
 * Efectos diseñados para el vibe TECHNO:
 * - Físicas agresivas sin suavizado
 * - Decay instantáneo (1-2 frames)
 * - Reactivos a espectro (harshness, flatness)
 * 
 * EFECTOS:
 * - IndustrialStrobe: MixBus 'global' - El martillo
 * - AcidSweep: MixBus 'htp' - La lámina de luz
 * - CyberDualism: MixBus 'htp' - El ping-pong L/R (WAVE 810)
 * - GatlingRaid: MixBus 'htp' - Metralleta de PARs (WAVE 930)
 * - SkySaw: MixBus 'htp' - Cortes agresivos de movers (WAVE 930)
 * - AbyssalRise: MixBus 'global' - Transición épica abisal (WAVE 930)
 * - AmbientStrobe: MixBus 'global' - Flashes dispersos tipo cámara (WAVE 977)
 * - SonarPing: MixBus 'global' - Ping submarino back→front (WAVE 977)
 * 
 * @module core/effects/library/techno
 * @version WAVE 770, 810, 930, 977
 */

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export { IndustrialStrobe } from './IndustrialStrobe'
export { AcidSweep } from './AcidSweep'
export { CyberDualism } from './CyberDualism'

// WAVE 930: Arsenal Pesado
export { GatlingRaid } from './GatlingRaid'
export { SkySaw } from './SkySaw'
export { AbyssalRise } from './AbyssalRise'

// WAVE 938: Atmospheric Arsenal (zonas bajas de energía)
export { VoidMist } from './VoidMist'
export { StaticPulse } from './StaticPulse'
export { DigitalRain } from './DigitalRain'
export { DeepBreath } from './DeepBreath'

// WAVE 977: LA FÁBRICA - Nuevos efectos para gaps de energía
export { AmbientStrobe } from './AmbientStrobe'
export { SonarPing } from './SonarPing'

// Default exports map
export { default as IndustrialStrobeDefault } from './IndustrialStrobe'
export { default as AcidSweepDefault } from './AcidSweep'
