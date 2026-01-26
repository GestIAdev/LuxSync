/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎉 FIESTA LATINA - EFFECT LIBRARY INDEX
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 680: THE ARSENAL
 * WAVE 1004.3: FULL EXPORT - Todos los efectos del arsenal latino
 * 
 * Exporta TODOS los efectos del arsenal Fiesta Latina.
 * 
 * ARSENAL COMPLETO (13 efectos):
 * - SolarFlare: Drop explosion
 * - StrobeStorm: Strobe degradado
 * - StrobeBurst: Ráfagas rítmicas
 * - TidalWave: Ola orgánica
 * - GhostBreath: Fantasma suave
 * - ClaveRhythm: Patrón 3-2 clave
 * - SalsaFire: Fuego pasional
 * - CumbiaMoon: Luna romántica
 * - CorazonLatino: Latido del corazón
 * - TropicalPulse: Percusión tropical
 * - LatinaMeltdown: 🔥 WAVE 1004.3 - Nuclear Salsa (A=0.95)
 * - GlitchGuaguanco: 🦠 WAVE 1004.3 - Cyber Virus (C=0.90)
 * 
 * @module core/effects/library/fiestalatina
 * @version WAVE 680, 1004.3
 */

// ═══════════════════════════════════════════════════════════════════════════
// 🎉 FIESTA LATINA EFFECTS - FULL ARSENAL
// ═══════════════════════════════════════════════════════════════════════════

// 🌟 Core Effects
export { SolarFlare, createSolarFlare, SOLAR_FLARE_DEFAULT_CONFIG } from './SolarFlare'
export { StrobeStorm, createStrobeStorm } from './StrobeStorm'
export { StrobeBurst } from './StrobeBurst'
export { TidalWave } from './TidalWave'
export { GhostBreath, createGhostBreath } from './GhostBreath'

// 🥁 Rhythmic Effects
export { ClaveRhythm } from './ClaveRhythm'
export { TropicalPulse } from './TropicalPulse'

// 🔥 Passion Effects
export { SalsaFire } from './SalsaFire'
export { CorazonLatino } from './CorazonLatino'
export { CumbiaMoon } from './CumbiaMoon'

// 🚨 WAVE 1004.3: DNA EXTREMOS - Nuevos efectos para expandir el espacio DNA
export { LatinaMeltdown } from './LatinaMeltdown'    // 🔥 Nuclear Salsa (A=0.95)
export { GlitchGuaguanco } from './GlitchGuaguanco'  // 🦠 Cyber Virus (C=0.90)

// ═══════════════════════════════════════════════════════════════════════════
// TYPE RE-EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export type { ILightEffect, EffectTriggerConfig, MusicalContext } from '../../types'
