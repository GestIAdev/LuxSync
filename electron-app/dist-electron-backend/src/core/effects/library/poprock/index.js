/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎸 POP-ROCK EFFECTS LIBRARY - INDEX
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 1020.9: ROCK ARSENAL EXPANSION - 8 Effects Total
 *
 * THE MAGNIFICENT 8:
 *
 * ⚡ THUNDER_STRUCK - El Blinder de Estadio (2s)
 *    Golpe de luz brutal en drops. Energy > 0.8.
 *
 * 🎸 LIQUID_SOLO - Spotlight Sweep Elegante (3.5s)
 *    Sweep horizontal suave L→R o R→L. NO asume músico.
 *
 * 🔥 AMP_HEAT - Válvulas Calientes (variable)
 *    Atmósfera íntima. Respiración lenta, drift imperceptible.
 *
 * 🌊 ARENA_SWEEP - El Barrido de Rock (variable)
 *    Queen en Wembley. vShape con inercia.
 *
 * 😵 FEEDBACK_STORM - La Distorsión Visual (variable)
 *    Caos controlado. Strobe aleatorio escalado por Harshness.
 *
 * ⚡ POWER_CHORD - El Golpe del Acorde (2s)
 *    Flash potente + strobe rítmico. NO movimiento.
 *
 * 🌊 STAGE_WASH - Lavado de Escenario (3.5s)
 *    Wash amber/warm. Fade suave, todo iluminado.
 *
 * 💡 SPOTLIGHT_PULSE - Pulso de Spotlight (3s)
 *    Movers respiran en intensidad. NO movimiento.
 *
 * FILOSOFÍA:
 * - Duración: 2-4s MAX (catcheable por Selene)
 * - Movimiento: Mínimo (motor tiene bugs)
 * - Color: Cambios suaves en movers (proteger rueda)
 * - Simplicidad > Complejidad
 *
 * @module core/effects/library/poprock
 * @version WAVE 1020.9 - ROCK ARSENAL EXPANSION
 */
// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════
export { ThunderStruck, createThunderStruck } from './ThunderStruck';
export { LiquidSolo, createLiquidSolo } from './LiquidSolo';
export { AmpHeat, createAmpHeat } from './AmpHeat';
export { ArenaSweep, createArenaSweep } from './ArenaSweep';
export { FeedbackStorm, createFeedbackStorm } from './FeedbackStorm';
export { PowerChord, createPowerChord } from './PowerChord';
export { StageWash, createStageWash } from './StageWash';
export { SpotlightPulse, createSpotlightPulse } from './SpotlightPulse';
// ═══════════════════════════════════════════════════════════════════════════
// EFFECT REGISTRY (para EffectManager)
// ═══════════════════════════════════════════════════════════════════════════
import { ThunderStruck } from './ThunderStruck';
import { LiquidSolo } from './LiquidSolo';
import { AmpHeat } from './AmpHeat';
import { ArenaSweep } from './ArenaSweep';
import { FeedbackStorm } from './FeedbackStorm';
import { PowerChord } from './PowerChord';
import { StageWash } from './StageWash';
import { SpotlightPulse } from './SpotlightPulse';
/**
 * Registro de efectos pop-rock para el EffectManager
 *
 * WAVE 1020.9: THE MAGNIFICENT 8
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
    power_chord: PowerChord,
    stage_wash: StageWash,
    spotlight_pulse: SpotlightPulse,
};
