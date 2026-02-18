/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔥 SCENE EFFECT FACTORY - WAVE 2052: PROCEDURAL FX RUNTIME
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Client-side factory for instantiating BaseEffect classes in the renderer.
 * Used by useScenePlayer to run real procedural effects during playback
 * instead of static keyframe envelopes.
 * 
 * This is a LIGHTWEIGHT mirror of EffectManager.effectFactories.
 * No Shield, no Traffic, no cooldowns — just pure effect instantiation.
 * 
 * @module hooks/SceneEffectFactory
 * @version WAVE 2052
 */

import type { ILightEffect } from '../core/effects/types'

// ─── TECHNO ───
import { CoreMeltdown } from '../core/effects/library/techno/CoreMeltdown'
import { IndustrialStrobe } from '../core/effects/library/techno/IndustrialStrobe'
import { VoidMist } from '../core/effects/library/techno/VoidMist'
import { AcidSweep } from '../core/effects/library/techno/AcidSweep'
import { CyberDualism } from '../core/effects/library/techno/CyberDualism'
import { GatlingRaid } from '../core/effects/library/techno/GatlingRaid'
import { SkySaw } from '../core/effects/library/techno/SkySaw'
import { AbyssalRise } from '../core/effects/library/techno/AbyssalRise'
import { DigitalRain } from '../core/effects/library/techno/DigitalRain'
import { DeepBreath } from '../core/effects/library/techno/DeepBreath'
import { AmbientStrobe } from '../core/effects/library/techno/AmbientStrobe'
import { SonarPing } from '../core/effects/library/techno/SonarPing'
import { BinaryGlitch } from '../core/effects/library/techno/BinaryGlitch'
import { SeismicSnap } from '../core/effects/library/techno/SeismicSnap'
import { FiberOptics } from '../core/effects/library/techno/FiberOptics'

// ─── POP-ROCK ───
import { ThunderStruck } from '../core/effects/library/poprock/ThunderStruck'
import { LiquidSolo } from '../core/effects/library/poprock/LiquidSolo'
import { AmpHeat } from '../core/effects/library/poprock/AmpHeat'
import { ArenaSweep } from '../core/effects/library/poprock/ArenaSweep'
import { FeedbackStorm } from '../core/effects/library/poprock/FeedbackStorm'
import { SpotlightPulse } from '../core/effects/library/poprock/SpotlightPulse'
import { PowerChord } from '../core/effects/library/poprock/PowerChord'
import { StageWash } from '../core/effects/library/poprock/StageWash'

// ─── CHILL-LOUNGE ───
import { WhaleSong } from '../core/effects/library/chillLounge/WhaleSong'
import { SurfaceShimmer } from '../core/effects/library/chillLounge/SurfaceShimmer'
import { SolarCaustics } from '../core/effects/library/chillLounge/SolarCaustics'
import { SchoolOfFish } from '../core/effects/library/chillLounge/SchoolOfFish'

// ─── FIESTA LATINA ───
import { SolarFlare } from '../core/effects/library/fiestalatina/SolarFlare'
import { SalsaFire } from '../core/effects/library/fiestalatina/SalsaFire'
import { TropicalPulse } from '../core/effects/library/fiestalatina/TropicalPulse'
import { StrobeBurst } from '../core/effects/library/fiestalatina/StrobeBurst'
import { StrobeStorm } from '../core/effects/library/fiestalatina/StrobeStorm'
import { LatinaMeltdown } from '../core/effects/library/fiestalatina/LatinaMeltdown'
import { CorazonLatino } from '../core/effects/library/fiestalatina/CorazonLatino'
import { TidalWave } from '../core/effects/library/fiestalatina/TidalWave'

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY MAP
// ═══════════════════════════════════════════════════════════════════════════

type EffectFactory = () => ILightEffect

/**
 * Map of effectType string → factory function.
 * Mirror of EffectManager.effectFactories for client-side usage.
 */
const EFFECT_FACTORIES = new Map<string, EffectFactory>()

// TECHNO
EFFECT_FACTORIES.set('core_meltdown',     () => new CoreMeltdown())
EFFECT_FACTORIES.set('industrial_strobe', () => new IndustrialStrobe())
EFFECT_FACTORIES.set('void_mist',         () => new VoidMist())
EFFECT_FACTORIES.set('acid_sweep',        () => new AcidSweep())
EFFECT_FACTORIES.set('cyber_dualism',     () => new CyberDualism())
EFFECT_FACTORIES.set('gatling_raid',      () => new GatlingRaid())
EFFECT_FACTORIES.set('sky_saw',           () => new SkySaw())
EFFECT_FACTORIES.set('abyssal_rise',      () => new AbyssalRise())
EFFECT_FACTORIES.set('digital_rain',      () => new DigitalRain())
EFFECT_FACTORIES.set('deep_breath',       () => new DeepBreath())
EFFECT_FACTORIES.set('ambient_strobe',    () => new AmbientStrobe())
EFFECT_FACTORIES.set('sonar_ping',        () => new SonarPing())
EFFECT_FACTORIES.set('binary_glitch',     () => new BinaryGlitch())
EFFECT_FACTORIES.set('seismic_snap',      () => new SeismicSnap())
EFFECT_FACTORIES.set('fiber_optics',      () => new FiberOptics())
// POP-ROCK
EFFECT_FACTORIES.set('thunder_struck',    () => new ThunderStruck())
EFFECT_FACTORIES.set('liquid_solo',       () => new LiquidSolo())
EFFECT_FACTORIES.set('amp_heat',          () => new AmpHeat())
EFFECT_FACTORIES.set('arena_sweep',       () => new ArenaSweep())
EFFECT_FACTORIES.set('feedback_storm',    () => new FeedbackStorm())
EFFECT_FACTORIES.set('spotlight_pulse',   () => new SpotlightPulse())
EFFECT_FACTORIES.set('power_chord',       () => new PowerChord())
EFFECT_FACTORIES.set('stage_wash',        () => new StageWash())
// CHILL-LOUNGE
EFFECT_FACTORIES.set('whale_song',        () => new WhaleSong())
EFFECT_FACTORIES.set('surface_shimmer',   () => new SurfaceShimmer())
EFFECT_FACTORIES.set('solar_caustics',    () => new SolarCaustics())
EFFECT_FACTORIES.set('school_of_fish',    () => new SchoolOfFish())
// FIESTA LATINA
EFFECT_FACTORIES.set('solar_flare',       () => new SolarFlare())
EFFECT_FACTORIES.set('salsa_fire',        () => new SalsaFire())
EFFECT_FACTORIES.set('tropical_pulse',    () => new TropicalPulse())
EFFECT_FACTORIES.set('strobe_burst',      () => new StrobeBurst())
EFFECT_FACTORIES.set('strobe_storm',      () => new StrobeStorm())
EFFECT_FACTORIES.set('latina_meltdown',   () => new LatinaMeltdown())
EFFECT_FACTORIES.set('corazon_latino',    () => new CorazonLatino())
EFFECT_FACTORIES.set('tidal_wave',        () => new TidalWave())

/**
 * Check if an effectType has a real procedural class.
 * If true, we should instantiate it instead of using keyframe envelopes.
 */
export function hasCoreEffect(effectType: string): boolean {
  return EFFECT_FACTORIES.has(effectType)
}

/**
 * Create a new instance of a core effect.
 * Returns null if effectType is not a registered core effect.
 */
export function createCoreEffect(effectType: string): ILightEffect | null {
  const factory = EFFECT_FACTORIES.get(effectType)
  if (!factory) return null
  return factory()
}

/**
 * Convert HSL (h: 0-360, s: 0-100, l: 0-100) to RGB (0-255).
 * Used to translate BaseEffect colorOverride → DMX RGB values.
 */
export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const sNorm = s / 100
  const lNorm = l / 100

  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm
  const x = c * (1 - Math.abs((h / 60) % 2 - 1))
  const m = lNorm - c / 2

  let r = 0, g = 0, b = 0

  if (h < 60)       { r = c; g = x; b = 0 }
  else if (h < 120) { r = x; g = c; b = 0 }
  else if (h < 180) { r = 0; g = c; b = x }
  else if (h < 240) { r = 0; g = x; b = c }
  else if (h < 300) { r = x; g = 0; b = c }
  else              { r = c; g = 0; b = x }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  }
}
