/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎬 TIMELINE ENGINE - WAVE 2053.1: THE ENGINE ROOM
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Backend playback engine for .lux scene files.
 * Runs in the Electron Main process with FULL access to:
 *   - Real effect classes (CoreMeltdown, FiberOptics, etc.)
 *   - EffectManager's merge logic (HTP/LTP, zoneOverrides)
 *   - MasterArbiter (direct setManualOverride, no IPC overhead)
 *
 * ARCHITECTURE:
 *   Frontend (React) → IPC tick(timeMs) → TimelineEngine.tick() →
 *     → effect.update(deltaMs) → getOutput() →
 *     → HSL→RGB conversion → MasterArbiter.setManualOverride()
 *
 * The frontend is DUMB: it only manages audio playback and sends
 * the current timeMs. All lighting physics run HERE.
 *
 * WHY:
 *   Effects like FiberOptics emit zoneOverrides with HSL colors,
 *   CoreMeltdown strobes at 12Hz with magenta/white alternation.
 *   This complexity CANNOT be replicated in a React hook —
 *   it requires the full effect class + the Arbiter's zone resolution.
 *
 * @module core/engine/TimelineEngine
 * @version WAVE 2053.1
 */

import type { ILightEffect, EffectFrameOutput, EffectZone } from '../effects/types'
import type { LuxProject } from '../../chronos/core/ChronosProject'
import type { FXClip, FXKeyframe, VibeClip } from '../../chronos/core/TimelineClip'
import type { Layer2_Manual } from '../arbiter/types'
import { masterArbiter } from '../arbiter'

// ═══════════════════════════════════════════════════════════════════════════
// EFFECT FACTORY IMPORTS — The Full Arsenal
// ═══════════════════════════════════════════════════════════════════════════

// ─── TECHNO ───
import { CoreMeltdown } from '../effects/library/techno/CoreMeltdown'
import { IndustrialStrobe } from '../effects/library/techno/IndustrialStrobe'
import { VoidMist } from '../effects/library/techno/VoidMist'
import { AcidSweep } from '../effects/library/techno/AcidSweep'
import { CyberDualism } from '../effects/library/techno/CyberDualism'
import { GatlingRaid } from '../effects/library/techno/GatlingRaid'
import { SkySaw } from '../effects/library/techno/SkySaw'
import { AbyssalRise } from '../effects/library/techno/AbyssalRise'
import { DigitalRain } from '../effects/library/techno/DigitalRain'
import { DeepBreath } from '../effects/library/techno/DeepBreath'
import { AmbientStrobe } from '../effects/library/techno/AmbientStrobe'
import { SonarPing } from '../effects/library/techno/SonarPing'
import { BinaryGlitch } from '../effects/library/techno/BinaryGlitch'
import { SeismicSnap } from '../effects/library/techno/SeismicSnap'
import { FiberOptics } from '../effects/library/techno/FiberOptics'

// ─── POP-ROCK ───
import { ThunderStruck } from '../effects/library/poprock/ThunderStruck'
import { LiquidSolo } from '../effects/library/poprock/LiquidSolo'
import { AmpHeat } from '../effects/library/poprock/AmpHeat'
import { ArenaSweep } from '../effects/library/poprock/ArenaSweep'
import { FeedbackStorm } from '../effects/library/poprock/FeedbackStorm'
import { SpotlightPulse } from '../effects/library/poprock/SpotlightPulse'
import { PowerChord } from '../effects/library/poprock/PowerChord'
import { StageWash } from '../effects/library/poprock/StageWash'

// ─── CHILL-LOUNGE ───
import { WhaleSong } from '../effects/library/chillLounge/WhaleSong'
import { SurfaceShimmer } from '../effects/library/chillLounge/SurfaceShimmer'
import { SolarCaustics } from '../effects/library/chillLounge/SolarCaustics'
import { SchoolOfFish } from '../effects/library/chillLounge/SchoolOfFish'
import { AbyssalJellyfish } from '../effects/library/chillLounge/AbyssalJellyfish'
import { PlanktonDrift } from '../effects/library/chillLounge/PlanktonDrift'
import { DeepCurrentPulse } from '../effects/library/chillLounge/DeepCurrentPulse'
import { BioluminescentSpore } from '../effects/library/chillLounge/BioluminescentSpore'

// ─── FIESTA LATINA ───
import { SolarFlare } from '../effects/library/fiestalatina/SolarFlare'
import { SalsaFire } from '../effects/library/fiestalatina/SalsaFire'
import { TropicalPulse } from '../effects/library/fiestalatina/TropicalPulse'
import { StrobeBurst } from '../effects/library/fiestalatina/StrobeBurst'
import { StrobeStorm } from '../effects/library/fiestalatina/StrobeStorm'
import { LatinaMeltdown } from '../effects/library/fiestalatina/LatinaMeltdown'
import { CorazonLatino } from '../effects/library/fiestalatina/CorazonLatino'
import { TidalWave } from '../effects/library/fiestalatina/TidalWave'
import { GhostBreath } from '../effects/library/fiestalatina/GhostBreath'
import { CumbiaMoon } from '../effects/library/fiestalatina/CumbiaMoon'
import { AmazonMist } from '../effects/library/fiestalatina/AmazonMist'
import { MacheteSpark } from '../effects/library/fiestalatina/MacheteSpark'
import { GlitchGuaguanco } from '../effects/library/fiestalatina/GlitchGuaguanco'
import { ClaveRhythm } from '../effects/library/fiestalatina/ClaveRhythm'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** State of a running clip effect instance */
interface ActiveClipState {
  /** The source FXClip from the .lux file */
  clip: FXClip
  /** Live effect instance (null for legacy FX types) */
  effect: ILightEffect | null
  /** Was trigger() already called on the effect? */
  triggered: boolean
}

/** Engine state for external queries */
export interface TimelineEngineState {
  loaded: boolean
  playing: boolean
  projectName: string | null
  clipCount: number
  activeClipCount: number
  lastTickMs: number
}

// ═══════════════════════════════════════════════════════════════════════════
// EFFECT FACTORY REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

type EffectFactory = () => ILightEffect

const EFFECT_FACTORIES = new Map<string, EffectFactory>()

// ── TECHNO ──
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
// ── POP-ROCK ──
EFFECT_FACTORIES.set('thunder_struck',    () => new ThunderStruck())
EFFECT_FACTORIES.set('liquid_solo',       () => new LiquidSolo())
EFFECT_FACTORIES.set('amp_heat',          () => new AmpHeat())
EFFECT_FACTORIES.set('arena_sweep',       () => new ArenaSweep())
EFFECT_FACTORIES.set('feedback_storm',    () => new FeedbackStorm())
EFFECT_FACTORIES.set('spotlight_pulse',   () => new SpotlightPulse())
EFFECT_FACTORIES.set('power_chord',       () => new PowerChord())
EFFECT_FACTORIES.set('stage_wash',        () => new StageWash())
// ── CHILL-LOUNGE ──
EFFECT_FACTORIES.set('whale_song',        () => new WhaleSong())
EFFECT_FACTORIES.set('surface_shimmer',   () => new SurfaceShimmer())
EFFECT_FACTORIES.set('solar_caustics',    () => new SolarCaustics())
EFFECT_FACTORIES.set('school_of_fish',    () => new SchoolOfFish())
EFFECT_FACTORIES.set('abyssal_jellyfish', () => new AbyssalJellyfish())
EFFECT_FACTORIES.set('plankton_drift',    () => new PlanktonDrift())
EFFECT_FACTORIES.set('deep_current_pulse',() => new DeepCurrentPulse())
EFFECT_FACTORIES.set('bioluminescent_spore', () => new BioluminescentSpore())
// ── FIESTA LATINA ──
EFFECT_FACTORIES.set('solar_flare',       () => new SolarFlare())
EFFECT_FACTORIES.set('salsa_fire',        () => new SalsaFire())
EFFECT_FACTORIES.set('tropical_pulse',    () => new TropicalPulse())
EFFECT_FACTORIES.set('strobe_burst',      () => new StrobeBurst())
EFFECT_FACTORIES.set('strobe_storm',      () => new StrobeStorm())
EFFECT_FACTORIES.set('latina_meltdown',   () => new LatinaMeltdown())
EFFECT_FACTORIES.set('corazon_latino',    () => new CorazonLatino())
EFFECT_FACTORIES.set('tidal_wave',        () => new TidalWave())
EFFECT_FACTORIES.set('ghost_breath',      () => new GhostBreath())
EFFECT_FACTORIES.set('cumbia_moon',       () => new CumbiaMoon())
EFFECT_FACTORIES.set('amazon_mist',       () => new AmazonMist())
EFFECT_FACTORIES.set('machete_spark',     () => new MacheteSpark())
EFFECT_FACTORIES.set('glitch_guaguanco',  () => new GlitchGuaguanco())
EFFECT_FACTORIES.set('clave_rhythm',      () => new ClaveRhythm())

// ═══════════════════════════════════════════════════════════════════════════
// HSL → RGB CONVERSION (deterministic, no random)
// ═══════════════════════════════════════════════════════════════════════════

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const sN = s / 100
  const lN = l / 100
  const c = (1 - Math.abs(2 * lN - 1)) * sN
  const x = c * (1 - Math.abs((h / 60) % 2 - 1))
  const m = lN - c / 2
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

// ═══════════════════════════════════════════════════════════════════════════
// 🎬 TIMELINE ENGINE — SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

export class TimelineEngine {
  // ── Project state ──
  private project: LuxProject | null = null
  private fxClips: FXClip[] = []
  private vibeClips: VibeClip[] = []

  // ── Playback state ──
  private playing = false
  private lastTickMs = 0

  // ── Effect instances (keyed by clip.id) ──
  private activeClips = new Map<string, ActiveClipState>()

  // ── Last active set for cleanup ──
  private previousActiveIds = new Set<string>()

  // ═══════════════════════════════════════════════════════════════════════
  // LOAD PROJECT
  // ═══════════════════════════════════════════════════════════════════════

  loadProject(project: LuxProject): void {
    this.stop() // Clean previous state

    this.project = project

    // Separate clips by type
    this.fxClips = project.timeline.clips.filter(c => c.type === 'fx') as FXClip[]
    this.vibeClips = project.timeline.clips.filter(c => c.type === 'vibe') as VibeClip[]

    this.playing = true
    this.lastTickMs = 0

    console.log(`[TimelineEngine] 📀 Loaded "${project.meta.name}" — ${this.fxClips.length} FX clips, ${this.vibeClips.length} Vibe clips`)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TICK — Called every frame from frontend via IPC
  // ═══════════════════════════════════════════════════════════════════════

  tick(timeMs: number): void {
    if (!this.playing || !this.project) return

    // ── Calculate deltaMs ──
    const deltaMs = this.lastTickMs > 0 ? timeMs - this.lastTickMs : 16.67
    this.lastTickMs = timeMs

    // ── Find active FX clips at this timeMs ──
    const nowActiveIds = new Set<string>()

    for (const clip of this.fxClips) {
      if (timeMs >= clip.startMs && timeMs < clip.endMs) {
        nowActiveIds.add(clip.id)
        this.processClip(clip, timeMs, deltaMs)
      }
    }

    // ── Cleanup clips that ended ──
    Array.from(this.previousActiveIds).forEach(prevId => {
      if (!nowActiveIds.has(prevId)) {
        this.releaseClip(prevId)
      }
    })
    this.previousActiveIds = nowActiveIds
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STOP — Full cleanup
  // ═══════════════════════════════════════════════════════════════════════

  stop(): void {
    // Abort all active effect instances
    Array.from(this.activeClips.entries()).forEach(([_id, state]) => {
      if (state.effect) {
        state.effect.abort()
      }
    })
    this.activeClips.clear()
    this.previousActiveIds.clear()

    // Clear arbiter overrides
    masterArbiter.releaseAllManualOverrides()

    this.playing = false
    this.lastTickMs = 0
    this.project = null
    this.fxClips = []
    this.vibeClips = []

    console.log('[TimelineEngine] ⏹ Stopped — all effects aborted, arbiter cleared')
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STATE QUERY
  // ═══════════════════════════════════════════════════════════════════════

  getState(): TimelineEngineState {
    return {
      loaded: this.project !== null,
      playing: this.playing,
      projectName: this.project?.meta.name ?? null,
      clipCount: this.fxClips.length,
      activeClipCount: this.activeClips.size,
      lastTickMs: this.lastTickMs,
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE: PROCESS A SINGLE CLIP
  // ═══════════════════════════════════════════════════════════════════════

  private processClip(clip: FXClip, timeMs: number, deltaMs: number): void {
    const fxType = clip.fxType as string
    const localTimeMs = timeMs - clip.startMs
    const clipDurationMs = clip.endMs - clip.startMs

    // ─── HEPHAESTUS CUSTOM CLIPS ───
    if (fxType === 'heph-custom' && (clip as any).hephClip?.curves) {
      this.processHephClip(clip, localTimeMs)
      return
    }

    // ─── CORE EFFECTS (procedural class) ───
    if (EFFECT_FACTORIES.has(fxType)) {
      this.processCoreEffect(clip, localTimeMs, deltaMs)
      return
    }

    // ─── LEGACY FX TYPES (strobe, blackout, color-wash, etc.) ───
    this.processLegacyFx(clip, localTimeMs, clipDurationMs)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 🔥 CORE EFFECTS — Real procedural classes
  // ═══════════════════════════════════════════════════════════════════════

  private processCoreEffect(clip: FXClip, localTimeMs: number, deltaMs: number): void {
    // Get or create active clip state
    let state = this.activeClips.get(clip.id)

    if (!state) {
      const factory = EFFECT_FACTORIES.get(clip.fxType as string)
      if (!factory) return

      const effect = factory()
      state = { clip, effect, triggered: false }
      this.activeClips.set(clip.id, state)
    }

    const effect = state.effect!

    // Trigger on first activation
    if (!state.triggered) {
      const zones: EffectZone[] = (clip.zones && clip.zones.length > 0)
        ? clip.zones as EffectZone[]
        : ['all']

      effect.trigger({
        effectType: clip.fxType as string,
        intensity: 1,
        source: 'chronos',
        zones,
        reason: `timeline:${clip.fxType}:${clip.id}`,
      })
      state.triggered = true
    }

    // Tick the effect's internal state machine
    effect.update(deltaMs)

    // Read procedural output
    const output = effect.getOutput()
    if (!output) return

    // Keyframe envelope acts as master dimmer multiplier
    const envelope = this.interpolateKeyframes(clip.keyframes, localTimeMs)

    // ── Process output → Arbiter ──
    const fixtureIds = this.resolveFixtureIds(clip)

    // Check if this effect uses zoneOverrides (spatial effects)
    if (output.zoneOverrides && Object.keys(output.zoneOverrides).length > 0) {
      this.dispatchZoneOverrides(output, envelope, fixtureIds)
    }

    // Also dispatch the global fallback (colorOverride, dimmerOverride)
    this.dispatchGlobalOutput(output, envelope, fixtureIds)

    // If the effect finished, let it re-trigger on next frame
    // (clips can be longer than a single effect cycle)
    if (effect.isFinished()) {
      state.triggered = false
      // Re-create effect for next cycle
      const factory = EFFECT_FACTORIES.get(clip.fxType as string)
      if (factory) {
        state.effect = factory()
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 🎨 ZONE OVERRIDES → ARBITER (spatial effects like FiberOptics)
  // ═══════════════════════════════════════════════════════════════════════

  private dispatchZoneOverrides(
    output: EffectFrameOutput,
    envelope: number,
    _allFixtureIds: string[]
  ): void {
    if (!output.zoneOverrides) return

    // For each zone override, build controls and dispatch
    for (const [_zoneId, zoneData] of Object.entries(output.zoneOverrides)) {
      const controls: Record<string, number> = {}
      const channels: string[] = []

      // Zone dimmer × envelope × 255
      const zoneDimmer = (zoneData as any).dimmer ?? 0
      controls.dimmer = zoneDimmer * envelope * 255
      channels.push('dimmer')

      // Zone color (HSL → RGB)
      const zoneColor = (zoneData as any).color as { h: number; s: number; l: number } | undefined
      if (zoneColor) {
        const rgb = hslToRgb(zoneColor.h, zoneColor.s, zoneColor.l)
        controls.red = rgb.r
        controls.green = rgb.g
        controls.blue = rgb.b
        channels.push('red', 'green', 'blue')
      } else if ((zoneData as any).white !== undefined) {
        const w = ((zoneData as any).white as number) * 255
        controls.red = w
        controls.green = w
        controls.blue = w
        channels.push('red', 'green', 'blue')
      }

      // Zone movement
      const zoneMv = (zoneData as any).movement as { pan?: number; tilt?: number } | undefined
      if (zoneMv) {
        if (zoneMv.pan !== undefined) {
          controls.pan = zoneMv.pan * 255
          channels.push('pan')
        }
        if (zoneMv.tilt !== undefined) {
          controls.tilt = zoneMv.tilt * 255
          channels.push('tilt')
        }
        // Auto-inject speed for movement
        if (!channels.includes('speed')) {
          controls.speed = 0
          channels.push('speed')
        }
      }

      // Skip if nothing to send
      if (channels.length === 0 || controls.dimmer === 0) continue

      // Dispatch to ALL fixtures (the Arbiter doesn't do zone→fixture resolution,
      // that's for the Orchestrator. For Scene Player, we apply globally and
      // let the merge sort it out — better to over-illuminate than miss fixtures)
      const fixtureIds = masterArbiter.getFixtureIds()
      for (const fixtureId of fixtureIds) {
        masterArbiter.setManualOverride({
          fixtureId,
          controls: controls as any,
          overrideChannels: channels as any,
          mode: 'absolute',
          source: 'ui_programmer',
          priority: 100,
          autoReleaseMs: 100,
          releaseTransitionMs: 50,
          timestamp: performance.now(),
        })
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 📤 GLOBAL OUTPUT → ARBITER (colorOverride, dimmerOverride)
  // ═══════════════════════════════════════════════════════════════════════

  private dispatchGlobalOutput(
    output: EffectFrameOutput,
    envelope: number,
    fixtureIds: string[]
  ): void {
    const controls: Record<string, number> = {}
    const channels: string[] = []

    // Color: HSL → RGB
    if (output.colorOverride) {
      const rgb = hslToRgb(
        output.colorOverride.h,
        output.colorOverride.s,
        output.colorOverride.l
      )
      controls.red = rgb.r
      controls.green = rgb.g
      controls.blue = rgb.b
      channels.push('red', 'green', 'blue')
    } else if (output.whiteOverride !== undefined) {
      const w = output.whiteOverride * 255
      controls.red = w
      controls.green = w
      controls.blue = w
      channels.push('red', 'green', 'blue')
    }

    // Dimmer: effect × envelope × 255
    const effectDimmer = output.dimmerOverride ?? output.intensity
    controls.dimmer = effectDimmer * envelope * 255
    channels.push('dimmer')

    // Strobe: Hz → DMX
    if (output.strobeRate !== undefined && output.strobeRate > 0) {
      controls.strobe = Math.min(output.strobeRate / 25 * 255, 255)
      channels.push('strobe')
    }

    // Movement
    if (output.movement) {
      const mv = output.movement as { pan?: number; tilt?: number }
      if (mv.pan !== undefined) {
        controls.pan = mv.pan * 255
        channels.push('pan')
      }
      if (mv.tilt !== undefined) {
        controls.tilt = mv.tilt * 255
        channels.push('tilt')
      }
      if (!channels.includes('speed')) {
        controls.speed = 0
        channels.push('speed')
      }
    }

    // Auto-white injection: dimmer > 0 but no color
    if (controls.dimmer > 0 && controls.red === undefined && controls.green === undefined && controls.blue === undefined) {
      controls.red = 255
      controls.green = 255
      controls.blue = 255
      channels.push('red', 'green', 'blue')
    }

    // Skip if nothing meaningful
    if (channels.length === 0) return

    // Dispatch to all target fixtures
    for (const fixtureId of fixtureIds) {
      masterArbiter.setManualOverride({
        fixtureId,
        controls: controls as any,
        overrideChannels: channels as any,
        mode: 'absolute',
        source: 'ui_programmer',
        priority: 100,
        autoReleaseMs: 100,
        releaseTransitionMs: 50,
        timestamp: performance.now(),
      })
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ⚒️ HEPHAESTUS CUSTOM CLIPS
  // ═══════════════════════════════════════════════════════════════════════

  private processHephClip(clip: FXClip, localTimeMs: number): void {
    const curves = (clip as any).hephClip.curves as Record<string, {
      keyframes: Array<{ timeMs: number; value: number; interpolation?: string }>
    }>

    const controls: Record<string, number> = {}
    const channels: string[] = []

    for (const [paramId, curve] of Object.entries(curves)) {
      if (!curve.keyframes || curve.keyframes.length === 0) continue
      const value = this.interpolateHephKeyframes(curve.keyframes, localTimeMs)

      switch (paramId) {
        case 'intensity':
        case 'dimmer':
          controls.dimmer = value * 255
          if (!channels.includes('dimmer')) channels.push('dimmer')
          break
        case 'white':
          controls.red = 255 * value
          controls.green = 255 * value
          controls.blue = 255 * value
          controls.dimmer = Math.max(controls.dimmer ?? 0, value * 255)
          if (!channels.includes('red')) channels.push('red')
          if (!channels.includes('green')) channels.push('green')
          if (!channels.includes('blue')) channels.push('blue')
          if (!channels.includes('dimmer')) channels.push('dimmer')
          break
        case 'red':
          controls.red = 255 * value
          if (!channels.includes('red')) channels.push('red')
          break
        case 'green':
          controls.green = 255 * value
          if (!channels.includes('green')) channels.push('green')
          break
        case 'blue':
          controls.blue = 255 * value
          if (!channels.includes('blue')) channels.push('blue')
          break
        case 'pan':
          controls.pan = 255 * value
          if (!channels.includes('pan')) channels.push('pan')
          break
        case 'tilt':
          controls.tilt = 255 * value
          if (!channels.includes('tilt')) channels.push('tilt')
          break
        case 'gobo':
        case 'gobo_wheel':
          controls.gobo_wheel = 255 * value
          if (!channels.includes('gobo_wheel')) channels.push('gobo_wheel')
          break
        case 'strobe':
          controls.strobe = 255 * value
          if (!channels.includes('strobe')) channels.push('strobe')
          break
        default:
          controls[paramId] = value
          if (!channels.includes(paramId)) channels.push(paramId)
      }
    }

    // Auto-white if dimmer but no color
    if (controls.dimmer !== undefined && controls.dimmer > 0) {
      if (controls.red === undefined && controls.green === undefined && controls.blue === undefined) {
        controls.red = 255
        controls.green = 255
        controls.blue = 255
        if (!channels.includes('red')) channels.push('red')
        if (!channels.includes('green')) channels.push('green')
        if (!channels.includes('blue')) channels.push('blue')
      }
    }

    if (channels.length === 0) return

    const fixtureIds = this.resolveFixtureIds(clip)
    for (const fixtureId of fixtureIds) {
      masterArbiter.setManualOverride({
        fixtureId,
        controls: controls as any,
        overrideChannels: channels as any,
        mode: 'absolute',
        source: 'ui_programmer',
        priority: 100,
        autoReleaseMs: 100,
        releaseTransitionMs: 50,
        timestamp: performance.now(),
      })
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 📼 LEGACY FX TYPES (strobe, blackout, color-wash, etc.)
  // ═══════════════════════════════════════════════════════════════════════

  private processLegacyFx(clip: FXClip, localTimeMs: number, clipDurationMs: number): void {
    const intensity = this.interpolateKeyframes(clip.keyframes, localTimeMs)
    const t = clipDurationMs > 0 ? localTimeMs / clipDurationMs : 0
    const fxType = clip.fxType as string

    const controls: Record<string, number> = {}
    const channels: string[] = []

    switch (fxType) {
      case 'strobe':
        controls.dimmer = (intensity > 0.5 ? 1 : 0) * 255
        channels.push('dimmer')
        break

      case 'blackout':
        controls.dimmer = 0
        channels.push('dimmer')
        break

      case 'color-wash': {
        const r = typeof clip.params?.red === 'number' ? clip.params.red as number : 255
        const g = typeof clip.params?.green === 'number' ? clip.params.green as number : 0
        const b = typeof clip.params?.blue === 'number' ? clip.params.blue as number : 255
        controls.red = r * intensity
        controls.green = g * intensity
        controls.blue = b * intensity
        controls.dimmer = intensity * 255
        channels.push('red', 'green', 'blue', 'dimmer')
        break
      }

      case 'intensity-ramp':
      case 'fade':
      case 'pulse':
      case 'chase':
        controls.dimmer = intensity * 255
        channels.push('dimmer')
        break

      case 'sweep':
        controls.pan = t * 255
        controls.dimmer = intensity * 255
        channels.push('pan', 'dimmer')
        break

      default:
        controls.dimmer = intensity * 255
        channels.push('dimmer')
    }

    // Auto-white injection
    if (controls.dimmer !== undefined && controls.dimmer > 0) {
      if (controls.red === undefined && controls.green === undefined && controls.blue === undefined) {
        controls.red = 255
        controls.green = 255
        controls.blue = 255
        if (!channels.includes('red')) channels.push('red')
        if (!channels.includes('green')) channels.push('green')
        if (!channels.includes('blue')) channels.push('blue')
      }
    }

    if (channels.length === 0) return

    const fixtureIds = this.resolveFixtureIds(clip)
    for (const fixtureId of fixtureIds) {
      masterArbiter.setManualOverride({
        fixtureId,
        controls: controls as any,
        overrideChannels: channels as any,
        mode: 'absolute',
        source: 'ui_programmer',
        priority: 100,
        autoReleaseMs: 100,
        releaseTransitionMs: 50,
        timestamp: performance.now(),
      })
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE: Fixture resolution
  // ═══════════════════════════════════════════════════════════════════════

  private resolveFixtureIds(clip: FXClip): string[] {
    // If clip has zones, use those (future: resolve zone→fixture mapping)
    // For now: all fixtures (wildcard). The Arbiter handles the merge.
    const zones = clip.zones
    if (zones && zones.length > 0) {
      // TODO WAVE 2053.2: Implement zone→fixture resolution
      // For now, return all fixtures
    }
    return masterArbiter.getFixtureIds()
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE: Clip release / cleanup
  // ═══════════════════════════════════════════════════════════════════════

  private releaseClip(clipId: string): void {
    const state = this.activeClips.get(clipId)
    if (state?.effect) {
      state.effect.abort()
    }
    this.activeClips.delete(clipId)

    // Release arbiter overrides
    masterArbiter.releaseAllManualOverrides()
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE: Standard keyframe interpolation (offsetMs based)
  // ═══════════════════════════════════════════════════════════════════════

  private interpolateKeyframes(keyframes: FXKeyframe[], localTimeMs: number): number {
    if (!keyframes || keyframes.length === 0) return 1 // Default: full intensity

    // Before first keyframe
    if (localTimeMs <= keyframes[0].offsetMs) return keyframes[0].value

    // After last keyframe
    if (localTimeMs >= keyframes[keyframes.length - 1].offsetMs) {
      return keyframes[keyframes.length - 1].value
    }

    // Find surrounding keyframes
    for (let i = 0; i < keyframes.length - 1; i++) {
      const k1 = keyframes[i]
      const k2 = keyframes[i + 1]

      if (localTimeMs >= k1.offsetMs && localTimeMs < k2.offsetMs) {
        const range = k2.offsetMs - k1.offsetMs
        const t = range > 0 ? (localTimeMs - k1.offsetMs) / range : 0

        switch (k1.easing) {
          case 'step':
            return k1.value
          case 'ease-in':
            return k1.value + (k2.value - k1.value) * (t * t)
          case 'ease-out':
            return k1.value + (k2.value - k1.value) * (1 - (1 - t) * (1 - t))
          case 'ease-in-out': {
            const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
            return k1.value + (k2.value - k1.value) * ease
          }
          case 'linear':
          default:
            return k1.value + (k2.value - k1.value) * t
        }
      }
    }

    return keyframes[keyframes.length - 1].value
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE: Hephaestus keyframe interpolation (timeMs based)
  // ═══════════════════════════════════════════════════════════════════════

  private interpolateHephKeyframes(
    keyframes: Array<{ timeMs: number; value: number; interpolation?: string }>,
    localTimeMs: number
  ): number {
    if (!keyframes || keyframes.length === 0) return 0

    if (localTimeMs <= keyframes[0].timeMs) return keyframes[0].value
    if (localTimeMs >= keyframes[keyframes.length - 1].timeMs) {
      return keyframes[keyframes.length - 1].value
    }

    for (let i = 0; i < keyframes.length - 1; i++) {
      const k1 = keyframes[i]
      const k2 = keyframes[i + 1]

      if (localTimeMs >= k1.timeMs && localTimeMs < k2.timeMs) {
        const range = k2.timeMs - k1.timeMs
        const t = range > 0 ? (localTimeMs - k1.timeMs) / range : 0

        switch (k1.interpolation) {
          case 'hold':
          case 'step':
            return k1.value
          case 'linear':
            return k1.value + (k2.value - k1.value) * t
          case 'bezier': {
            const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
            return k1.value + (k2.value - k1.value) * ease
          }
          default:
            return k1.value + (k2.value - k1.value) * t
        }
      }
    }

    return keyframes[keyframes.length - 1].value
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

export const timelineEngine = new TimelineEngine()
