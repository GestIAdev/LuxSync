/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎸 POP-ROCK EFFECTS LIBRARY - INDEX
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 1019: ROCK LEGENDS ARSENAL - "ANALOG POWER"
 * 
 * LOS 5 MAGNÍFICOS:
 * 
 * ⚡ THUNDER_STRUCK - El Blinder de Estadio
 *    Golpe de luz brutal en drops. Energy > 0.8.
 * 
 * 🎸 LIQUID_SOLO - El Foco del Guitarrista
 *    Spotlight para solos. MoverR rápido, MoverL estable.
 * 
 * 🔥 AMP_HEAT - Válvulas Calientes
 *    Atmósfera íntima. Respiración lenta, drift imperceptible.
 * 
 * 🌊 ARENA_SWEEP - El Barrido de Rock
 *    Queen en Wembley. vShape con inercia. 80% del show.
 * 
 * 😵 FEEDBACK_STORM - La Distorsión Visual
 *    Caos controlado. Strobe aleatorio escalado por Harshness.
 * 
 * FILOSOFÍA:
 * - Calor: Tungsteno, Ámbar, Blanco Cálido, Rojo Profundo
 * - Física: Inercia, haces que pesan, movimientos amplios
 * - Reactividad: L/R separación para diálogo entre instrumentos
 * - "La música dicta el efecto, no la etiqueta"
 * 
 * @module core/effects/library/poprock
 * @version WAVE 1019 - ROCK LEGENDS ARSENAL
 */

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export { ThunderStruck, createThunderStruck } from './ThunderStruck'
export { LiquidSolo, createLiquidSolo } from './LiquidSolo'
export { AmpHeat, createAmpHeat } from './AmpHeat'
export { ArenaSweep, createArenaSweep } from './ArenaSweep'
export { FeedbackStorm, createFeedbackStorm } from './FeedbackStorm'

// ═══════════════════════════════════════════════════════════════════════════
// EFFECT REGISTRY (para EffectManager)
// ═══════════════════════════════════════════════════════════════════════════

import { ThunderStruck } from './ThunderStruck'
import { LiquidSolo } from './LiquidSolo'
import { AmpHeat } from './AmpHeat'
import { ArenaSweep } from './ArenaSweep'
import { FeedbackStorm } from './FeedbackStorm'

/**
 * Registro de efectos pop-rock para el EffectManager
 * 
 * Uso:
 * ```ts
 * import { POPROCK_EFFECTS } from './library/poprock'
 * effectManager.registerEffects(POPROCK_EFFECTS)
 * ```
 */
export const POPROCK_EFFECTS = {
  thunder_struck: ThunderStruck,
  liquid_solo: LiquidSolo,
  amp_heat: AmpHeat,
  arena_sweep: ArenaSweep,
  feedback_storm: FeedbackStorm,
} as const

/**
 * Tipos de efectos disponibles en pop-rock
 */
export type PopRockEffectType = keyof typeof POPROCK_EFFECTS
