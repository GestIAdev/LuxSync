/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔪 TECHNO EFFECTS - THE ARSENAL
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 770: TECHNO PHYSICS KERNEL
 * WAVE 810: UNLOCK THE TWINS - CyberDualism
 * WAVE 930: GATLING RAID / SKY SAW / ABYSSAL RISE - El Arsenal Pesado
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
 * 
 * @module core/effects/library/techno
 * @version WAVE 770, 810, 930
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

// Default exports map
export { default as IndustrialStrobeDefault } from './IndustrialStrobe'
export { default as AcidSweepDefault } from './AcidSweep'
