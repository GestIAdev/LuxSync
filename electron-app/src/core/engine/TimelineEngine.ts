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
import { getTitanOrchestrator } from '../orchestrator/TitanOrchestrator'

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

  // ── 🎬 WAVE 2063: Active vibe tracking for Titan handoff ──
  private currentPlaybackVibeId: string | null = null

  // ── 🔥 WAVE 2056: Frame accumulator for Direct Drive ──
  // 🎛️ WAVE 2066: Added blendMode per-fixture for Smart MixBus
  private frameAccumulator = new Map<string, {
    dimmer: number
    red: number
    green: number
    blue: number
    white: number
    pan: number
    tilt: number
    zoom: number
    speed: number
    blendMode: 'HTP' | 'LTP' | 'ADD'
  }>()

  // ═══════════════════════════════════════════════════════════════════════
  // 🔒 WAVE 2069: COLOR LATCH — Sustained Palette for Mechanical Wheels
  //
  // Movers with mechanical color wheels (stepper motors) CANNOT change color
  // at strobe speeds (15Hz+). When a strobe effect alternates between
  // RGB(Cyan) and RGB(0,0,0), the HAL translates the zeros to color_wheel=0
  // (Open/White). The stepper motor gets whiplashed between Cyan and White
  // at 15Hz → firmware locks the wheel → color dies.
  //
  // THE LATCH: Cache the last POSITIVE color seen per fixture. During
  // micro-blackouts (dimmer=0, RGB=0,0,0), re-inject the latched color.
  // The strobe modulates ONLY the dimmer. The color stays parked.
  //
  // LIFECYCLE: Written when a positive color arrives. Read when RGB is zero.
  // Cleared when the clip ends (releaseClip) or playback stops (stop).
  // ═══════════════════════════════════════════════════════════════════════
  private colorLatch = new Map<string, { r: number; g: number; b: number }>()
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
  // 🔥 WAVE 2056: TICK — Direct Drive Frame Construction
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Called every frame from frontend via IPC.
   * 
   * 🔥 WAVE 2056: SCORCHED EARTH
   * Build complete frame with ALL fixtures, send once to Arbiter.
   * Uses existing effect logic but collects results into frame buffer.
   */
  tick(timeMs: number): void {
    if (!this.playing || !this.project) return

    // ── Calculate deltaMs ──
    const deltaMs = this.lastTickMs > 0 ? timeMs - this.lastTickMs : 16.67
    this.lastTickMs = timeMs

    // ═══════════════════════════════════════════════════════════════════════
    // 🎬 WAVE 2065: SPARSE FRAME ACCUMULATOR — The Transparent Overlay
    // 
    // OLD: Initialize ALL fixtures with zeros → gaps between effects send BLACK
    //      → Titan/Selene vibe gets KILLED in those gaps
    // 
    // NEW: Start EMPTY. Only fixtures TOUCHED by an active effect get added.
    //      Fixtures not in the accumulator = "Chronos has nothing to say"
    //      → Arbiter leaves them 100% under Titan/Selene control.
    //
    // This is the paradigm shift: Chronos is a TRANSPARENT OVERLAY, not a
    // replacement. The Vibe is the canvas, Chronos paints ON TOP of it.
    // ═══════════════════════════════════════════════════════════════════════
    this.frameAccumulator.clear()
    // NOTE: No pre-population! Effects add fixtures as they dispatch.

    // ── Find active FX clips at this timeMs ──
    const nowActiveIds = new Set<string>()

    for (const clip of this.fxClips) {
      if (timeMs >= clip.startMs && timeMs < clip.endMs) {
        nowActiveIds.add(clip.id)
        this.processClip(clip, timeMs, deltaMs)  // Uses existing logic
      }
    }

    // ── Process active Vibe clips ──
    // 🎬 WAVE 2063: Track if any vibe is active this frame
    let hasActiveVibe = false
    for (const vibeClip of this.vibeClips) {
      if (timeMs >= vibeClip.startMs && timeMs < vibeClip.endMs) {
        hasActiveVibe = true
        this.processVibeClip(vibeClip, timeMs)  // Now also sends vibeId to Titan
      }
    }

    // 🎬 WAVE 2063: If no vibe clip is active, clear the tracked vibe
    if (!hasActiveVibe && this.currentPlaybackVibeId) {
      this.currentPlaybackVibeId = null
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🎬 WAVE 2065: SPARSE CONVERSION — Only touched fixtures go to Arbiter
    // 
    // The accumulator now only contains fixtures that an active FX clip touched.
    // Untouched fixtures are NOT in the map → Arbiter won't override them.
    // ═══════════════════════════════════════════════════════════════════════
    const fixtureTargets: Array<{
      fixtureId: string
      dimmer: number
      color: { r: number; g: number; b: number }
      pan: number; tilt: number; zoom: number; focus: number; speed: number
      color_wheel: number; strobe: number; prism: number; gobo: number
      blendMode: 'HTP' | 'LTP' | 'ADD'  // 🎛️ WAVE 2066: Smart MixBus
      controlSources: Record<string, unknown>; appliedLayers: unknown[]
    }> = []
    
    for (const [fixtureId, state] of this.frameAccumulator.entries()) {
      fixtureTargets.push({
        fixtureId,
        dimmer: state.dimmer,
        color: { r: state.red, g: state.green, b: state.blue },
        pan: state.pan,
        tilt: state.tilt,
        zoom: state.zoom,
        focus: 0,
        speed: state.speed,
        color_wheel: 0,
        strobe: 0,
        prism: 0,
        gobo: 0,
        blendMode: state.blendMode,  // 🎛️ WAVE 2066: Smart MixBus
        controlSources: {},
        appliedLayers: [],
      })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🎬 WAVE 2065: THE TRANSPARENT OVERLAY
    //
    // Chronos is a painter, not a dictator. Only the fixtures it explicitly
    // touches are sent to the Arbiter. Everything else stays under Titan/Selene.
    // If no FX clip is active → fixtureTargets is EMPTY → Titan reigns supreme.
    // ═══════════════════════════════════════════════════════════════════════

    masterArbiter.setPlaybackFrame(fixtureTargets as any, {
      hasActiveVibe,
      vibeId: this.currentPlaybackVibeId,
    })

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
    const abortedCount = this.activeClips.size
    Array.from(this.activeClips.entries()).forEach(([id, state]) => {
      if (state.effect) {
        console.log(`[TimelineEngine] 🧹 Aborting effect: ${state.clip.fxType} (clip: ${id})`)
        state.effect.abort()
      }
    })
    this.activeClips.clear()
    this.previousActiveIds.clear()

    // � WAVE 2069: Clear color latch — no stale colors after stop
    this.colorLatch.clear()

    // �🔥 WAVE 2056: Stop playback mode in Arbiter
    masterArbiter.stopPlayback()

    // 🎬 WAVE 2063: Clear tracked vibe
    this.currentPlaybackVibeId = null

    this.playing = false
    this.lastTickMs = 0
    this.project = null
    this.fxClips = []
    this.vibeClips = []

    console.log(`[TimelineEngine] ⏹ Stopped — ${abortedCount} effects aborted, arbiter playback cleared`)
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
      if (!factory) {
        console.error(`[TimelineEngine] ❌ No factory found for effect: ${clip.fxType}`)
        return
      }

      const effect = factory()
      if (!effect) {
        console.error(`[TimelineEngine] ❌ Factory returned null for effect: ${clip.fxType}`)
        return
      }

      console.log(`[TimelineEngine] ✅ Created effect instance: ${clip.fxType} (clip: ${clip.id})`)
      state = { clip, effect, triggered: false }
      this.activeClips.set(clip.id, state)
    }

    const effect = state.effect!

    // 🎛️ WAVE 2066.1: Read blendMode DIRECTLY from the effect instance
    // Each Core Effect declares its own mixBus ('global' | 'htp') via readonly property.
    // No hardcoded lists needed — the effect knows what it needs.
    // clip.mixBus override takes precedence (user can override in timeline)
    const effectMixBus = clip.mixBus ?? (effect as any).mixBus ?? 'htp'
    const blendMode: 'HTP' | 'LTP' | 'ADD' = effectMixBus === 'global' ? 'LTP' : 'HTP'

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

    // ═══════════════════════════════════════════════════════════════════════
    // 🔥 WAVE 2063.5: SEAMLESS RE-TRIGGER
    // 🎯 WAVE 2067: ONESHOT GATE — isOneShot effects fire ONCE and die.
    // 
    // If effect finished mid-clip, re-create AND re-trigger in the SAME frame.
    // This eliminates the 1-frame "dead gap" between effect cycles that caused
    // the accumulator to go empty and Chronos to send dim=0 RGB(0,0,0).
    // 
    // WAVE 2067: OneShot effects (SolarFlare, GatlingRaid, CoreMeltdown, etc.)
    // are NOT re-triggered. They fire once and the clip goes silent.
    // This prevents a 700ms SolarFlare from firing 4+ times in a 3s clip.
    // ═══════════════════════════════════════════════════════════════════════
    const isOneShot = (effect as any).isOneShot === true
    
    if (!output && effect.isFinished()) {
      // 🎯 WAVE 2067: OneShot → clip is done. No re-trigger, no pre-stage.
      if (isOneShot) {
        return // Silence until clip ends. The effect spoke once.
      }

      const factory = EFFECT_FACTORIES.get(clip.fxType as string)
      if (factory) {
        const newEffect = factory()
        const zones: EffectZone[] = (clip.zones && clip.zones.length > 0)
          ? clip.zones as EffectZone[]
          : ['all']
        newEffect.trigger({
          effectType: clip.fxType as string,
          intensity: 1,
          source: 'chronos',
          zones,
          reason: `timeline:${clip.fxType}:${clip.id}:retrigger`,
        })
        newEffect.update(deltaMs)
        state.effect = newEffect
        state.triggered = true

        const retriggeredOutput = newEffect.getOutput()
        if (!retriggeredOutput) return

        // 🔥 WAVE 2068: Core FX own their intensity — no keyframe envelope on retrigger either
        const envelope = 1.0
        const fixtureIds = this.resolveFixtureIds(clip)
        this.dispatchEffectOutput(retriggeredOutput, envelope, fixtureIds, blendMode)
        return
      }
    }

    if (!output) return

    // If the effect finished after getOutput (will be caught next frame by seamless re-trigger)
    if (effect.isFinished() && !isOneShot) {
      // Pre-stage re-creation so next frame triggers immediately
      const factory = EFFECT_FACTORIES.get(clip.fxType as string)
      if (factory) {
        state.effect = factory()
        state.triggered = false
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🔥 WAVE 2068: THE DICTATOR'S WRATH — Anti Double-Envelope
    //
    // Core FX (ILightEffect instances) have their own ADSR curves.
    // SolarFlare has attack/sustain/decay. GatlingRaid has burst timing.
    // DigitalRain has internal flicker dynamics.
    //
    // The UI keyframes (Chronos timeline) add ANOTHER envelope on top:
    // a default 0→1 fade-in over ~1.5s. This strangles the effect:
    //   effect.intensity(0.9) × keyframeEnvelope(0.1) = 0.09 → pathetic
    //
    // FIX: Core FX bypass the keyframe envelope entirely. envelope = 1.0.
    // The clip dictates WHEN the effect fires, the effect dictates HOW HARD.
    // Only Hephaestus custom clips (processHephClip) use keyframe envelopes,
    // because those are manually authored curves by the user.
    // ═══════════════════════════════════════════════════════════════════════
    const envelope = 1.0  // Core FX own their intensity. Chronos doesn't touch it.

    // ── Process output → Arbiter ──
    const fixtureIds = this.resolveFixtureIds(clip)
    this.dispatchEffectOutput(output, envelope, fixtureIds, blendMode)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 🔥 WAVE 2063.5: UNIFIED EFFECT DISPATCH
  // 
  // Replaces the old dual-call pattern (dispatchZoneOverrides + dispatchGlobalOutput)
  // with a single smart dispatcher that avoids the "auto-white overwrite" bug.
  //
  // OLD BUG: Effects with zoneOverrides (like SalsaFire) would dispatch colored zones,
  //          then dispatchGlobalOutput would overwrite them with RGB(255,255,255) via
  //          auto-white injection because colorOverride=undefined.
  //
  // NEW: If zoneOverrides have color → use those exclusively (no global fallback).
  //      If no zoneOverrides → use global colorOverride/dimmerOverride/auto-white.
  // ═══════════════════════════════════════════════════════════════════════

  private dispatchEffectOutput(
    output: EffectFrameOutput,
    envelope: number,
    fixtureIds: string[],
    blendMode: 'HTP' | 'LTP' | 'ADD' = 'HTP'
  ): void {
    // ═══════════════════════════════════════════════════════════════════
    // 🎯 WAVE 2067.1: COLOR CABLE CUT
    //
    // The effect output has 3 possible "color authority" signals:
    //   1. zoneOverrides with color/dimmer → ZONE PATH (spatial)
    //   2. colorOverride / whiteOverride   → GLOBAL PATH (uniform)
    //   3. None of the above               → FALLBACK (intensity-only)
    //
    // OLD BUG: The FALLBACK path sent intensity-only outputs through
    //   dispatchGlobalOutput, which auto-injects RGB(255,255,255).
    //   Effects that have zoneOverrides but no color THIS FRAME
    //   (e.g., between flickers of DigitalRain) got white-washed.
    //
    // NEW: If the effect emits zoneOverrides AT ALL, it owns its colors.
    //   Even frames with only dimmer data in zones go through ZONE PATH.
    //   Auto-white ONLY fires for truly colorless, zoneless outputs
    //   (pure dimmer/intensity modulators).
    // ═══════════════════════════════════════════════════════════════════

    const hasZoneOverrides = output.zoneOverrides && Object.keys(output.zoneOverrides).length > 0

    if (hasZoneOverrides) {
      // ZONE PATH: Effect has spatial authority — zones are the law.
      // Even dimmer-only zones must dispatch (DigitalRain blackout zones).
      this.dispatchZoneOverrides(output, envelope, fixtureIds, blendMode)
      // Do NOT call dispatchGlobalOutput — it would overwrite zone colors with auto-white
    } else if (output.colorOverride || output.dimmerOverride !== undefined || output.whiteOverride !== undefined) {
      // GLOBAL PATH: Effects with direct color/dimmer overrides
      this.dispatchGlobalOutput(output, envelope, fixtureIds, blendMode)
    } else {
      // FALLBACK: Pure intensity modulators → global output with auto-white
      // Only reaches here if: no zoneOverrides, no colorOverride, no whiteOverride, no dimmerOverride
      // These are truly "colorless" effects that just modulate brightness → white is correct
      this.dispatchGlobalOutput(output, envelope, fixtureIds, blendMode)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 🎨 ZONE OVERRIDES → ARBITER (spatial effects like FiberOptics, DigitalRain, GatlingRaid)
  // ═══════════════════════════════════════════════════════════════════════
  //
  // 🎯 WAVE 2067: ZONE-AWARE DISPATCH
  //
  // OLD BUG: Every zone override was dispatched to ['*'] (ALL fixtures).
  //          Result: last zone in the loop overwrote all previous zones.
  //          DigitalRain: front=Cyan, back=Lime, movers=dim → only movers survived.
  //          GatlingRaid: front_left=WHITE, back=BLACK → BLACK killed everything.
  //
  // NEW: Each zoneId is resolved to its ACTUAL fixture IDs via MasterArbiter.
  //      'front' → only front fixtures, 'all-movers' → only movers, etc.
  //      Each zone paints ONLY its own fixtures. No more friendly fire.
  // ═══════════════════════════════════════════════════════════════════════

  private dispatchZoneOverrides(
    output: EffectFrameOutput,
    envelope: number,
    _allFixtureIds: string[],
    blendMode: 'HTP' | 'LTP' | 'ADD' = 'HTP'
  ): void {
    if (!output.zoneOverrides) return

    // For each zone override, build controls and dispatch to THAT ZONE's fixtures only
    for (const [zoneId, zoneData] of Object.entries(output.zoneOverrides)) {
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

      // Skip if nothing to send (no channels at all)
      // 🎯 WAVE 2067.1: Do NOT skip dimmer=0 — intentional blackout zones
      // (e.g., DigitalRain sends dimmer:0 + blendMode:'replace' to darken zones)
      // Those MUST reach the arbiter to suppress underlying layers.
      if (channels.length === 0) continue

      // 🎯 WAVE 2067: Resolve zone → actual fixture IDs
      // Each zone paints ONLY its own fixtures. No more ['*'] massacre.
      const zoneFixtureIds = masterArbiter.getFixtureIdsByZone(zoneId)
      this.dispatchToArbiter(zoneFixtureIds, controls, { blendMode })
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 📤 GLOBAL OUTPUT → ARBITER (colorOverride, dimmerOverride)
  // ═══════════════════════════════════════════════════════════════════════

  private dispatchGlobalOutput(
    output: EffectFrameOutput,
    envelope: number,
    fixtureIds: string[],
    blendMode: 'HTP' | 'LTP' | 'ADD' = 'HTP'
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

    // Dispatch via centralized helper
    this.dispatchToArbiter(fixtureIds, controls, { blendMode })
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

    // 🎛️ WAVE 2066: Resolve blendMode from Hephaestus clip's mixBus
    // 'global' → LTP (takeover: strobes, blinders, meltdowns)
    // 'htp'    → HTP (cooperative: sweeps, chases)
    // 'ambient'/'accent' → ADD (additive: atmospheres, accents)
    const mixBus = clip.mixBus ?? (clip as any).hephClip?.mixBus ?? 'htp'
    let blendMode: 'HTP' | 'LTP' | 'ADD' = 'HTP'
    if (mixBus === 'global') blendMode = 'LTP'
    else if (mixBus === 'ambient' || mixBus === 'accent') blendMode = 'ADD'

    const fixtureIds = this.resolveFixtureIds(clip)
    this.dispatchToArbiter(fixtureIds, controls, { blendMode })
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

    // 🎛️ WAVE 2066: Resolve blendMode from legacy fx type
    // Strobes and blackouts MUST override the vibe (LTP/absolute authority)
    // Everything else cooperates with the vibe canvas (HTP)
    const LTP_EFFECTS = new Set(['strobe', 'blackout'])
    const blendMode: 'HTP' | 'LTP' | 'ADD' = LTP_EFFECTS.has(fxType) ? 'LTP' : 'HTP'

    const fixtureIds = this.resolveFixtureIds(clip)
    this.dispatchToArbiter(fixtureIds, controls, { blendMode })
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 🌈 VIBE CLIPS — Vibe Handoff to Titan (WAVE 2065)
  // ═══════════════════════════════════════════════════════════════════════

  private processVibeClip(clip: VibeClip, timeMs: number): void {
    const localTimeMs = timeMs - clip.startMs
    const clipDurationMs = clip.endMs - clip.startMs

    // Calculate envelope (fade in/out)
    let envelope = 1
    if (localTimeMs < clip.fadeInMs) {
      envelope = localTimeMs / clip.fadeInMs
    } else if (localTimeMs > clipDurationMs - clip.fadeOutMs) {
      envelope = (clipDurationMs - localTimeMs) / clip.fadeOutMs
    }
    if (envelope <= 0) return

    // ═══════════════════════════════════════════════════════════════════════
    // 🎬 WAVE 2065: THE TRANSPARENT OVERLAY — Vibe Handoff ONLY
    //
    // The VibeClip's ONLY job is to tell Titan which vibe to run.
    // The COLOR and MOVEMENT of the vibe come from Selene/Titan's reactive
    // engine — they are the CANVAS. Chronos does NOT paint the base color.
    //
    // OLD (WAVE 2063): VibeClip wrote color+dimmer to accumulator → 
    //   This made Chronos "own" all fixtures even in gaps → killed Titan
    //
    // NEW: VibeClip sends vibeId to Titan and NOTHING to the accumulator.
    //   The vibe's procedural colors flow through Titan → HAL → DMX unimpeded.
    //   FX clips are the only things that paint on top.
    // ═══════════════════════════════════════════════════════════════════════
    const vibeId = clip.vibeType
    if (vibeId && vibeId !== this.currentPlaybackVibeId) {
      this.currentPlaybackVibeId = vibeId
      try {
        const orchestrator = getTitanOrchestrator()
        orchestrator.setVibe(vibeId as any)
        console.log(`[TimelineEngine] 🎭 WAVE 2065: Vibe handoff → Titan "${vibeId}" (Selene paints the canvas)`)
      } catch (err) {
        console.warn(`[TimelineEngine] ⚠️ Could not set vibe on Titan:`, err)
      }
    }

    // NOTE: No dispatchToArbiter here! The vibe's color comes from Selene.
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE: Fixture resolution
  // ═══════════════════════════════════════════════════════════════════════

  private resolveFixtureIds(clip: FXClip): string[] {
    const zones = clip.zones
    
    // If clip specifies zones, use them (with fallback logic)
    if (zones && zones.length > 0) {
      // Check for wildcard
      if (zones.includes('all') || zones.includes('*')) {
        return masterArbiter.getFixtureIds()
      }
      
      // 🚑 FALLBACK DE EMERGENCIA:
      // Si el efecto pide una zona específica pero no tenemos un mapa zone→fixture,
      // mejor iluminar TODO que iluminar NADA.
      // Esto arregla el "CoreMeltdown invisible" si falló el mapping.
      console.warn(
        `[TimelineEngine] ⚠️ Zone mapping not implemented for zones: ${zones.join(', ')} — falling back to wildcard '*'`
      )
    }
    
    // Default: all fixtures
    return masterArbiter.getFixtureIds()
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 🎬 WAVE 2065: Frame Accumulator — Sparse Overlay
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * 🎬 WAVE 2065: SPARSE OVERLAY
   * 
   * Accumulate effect outputs into the frameAccumulator.
   * Only fixtures that are TOUCHED by an effect end up in the accumulator.
   * 
   * WAVE 2056 (old): Pre-filled ALL fixtures with zeros → gaps sent BLACK
   * WAVE 2065 (new): Empty start, create entries on-demand → gaps are TRANSPARENT
   * WAVE 2066: blendMode per-fixture for Smart MixBus arbitration
   */
  private dispatchToArbiter(
    targetIds: string[],
    controls: Record<string, number>,
    options: {
      priority?: number
      autoReleaseMs?: number
      releaseTransitionMs?: number
      blendMode?: 'HTP' | 'LTP' | 'ADD'
    } = {}
  ): void {
    const blendMode = options.blendMode ?? 'HTP'

    // A. Expand wildcard '*' → All fixture IDs
    let finalIds = targetIds
    if (targetIds.includes('*')) {
      finalIds = masterArbiter.getFixtureIds()
      if (finalIds.length === 0) {
        console.warn('[TimelineEngine] ⚠️ No fixtures registered in Arbiter!')
        return
      }
    }

    // B. Accumulate controls into frame buffer (HTP for dimmer, LTP for others)
    for (const fixtureId of finalIds) {
      // 🎬 WAVE 2065: Create entry on-demand (sparse accumulator)
      let currentState = this.frameAccumulator.get(fixtureId)
      if (!currentState) {
        currentState = {
          dimmer: 0, red: 0, green: 0, blue: 0, white: 0,
          pan: 127, tilt: 127, zoom: 0, speed: 0,
          blendMode: 'HTP',
        }
        this.frameAccumulator.set(fixtureId, currentState)
      }

      // 🎛️ WAVE 2066: LTP wins for blendMode — if an LTP effect overwrites an HTP,
      // the fixture becomes LTP for this frame. This is correct because:
      // - A strobe (LTP) MUST kill the vibe dimmer, even if a wash (HTP) is also active
      // - A blackout (LTP) MUST override everything
      // Priority: LTP > ADD > HTP
      if (blendMode === 'LTP') {
        currentState.blendMode = 'LTP'
      } else if (blendMode === 'ADD' && currentState.blendMode !== 'LTP') {
        currentState.blendMode = 'ADD'
      }
      // HTP is default, only set if nothing else has claimed it

      // HTP for dimmer (Highest Takes Precedence)
      if (controls.dimmer !== undefined) {
        currentState.dimmer = Math.max(currentState.dimmer, controls.dimmer)
      }

      // LTP for color (Latest Takes Precedence)
      // 🔒 WAVE 2069: COLOR LATCH — Park the color for mechanical wheels
      //
      // If the effect sends a POSITIVE color → cache it in the latch.
      // If the effect sends RGB(0,0,0) (strobe micro-blackout) → re-inject
      // the latched color so the color_wheel stays parked.
      //
      // This prevents stepper motor whiplash on movers.
      // The strobe modulates ONLY the dimmer channel. Color stays constant.
      const hasIncomingColor = (controls.red !== undefined || controls.green !== undefined || controls.blue !== undefined)

      if (hasIncomingColor) {
        const r = controls.red ?? 0
        const g = controls.green ?? 0
        const b = controls.blue ?? 0
        const isPositiveColor = (r > 0 || g > 0 || b > 0)

        if (isPositiveColor) {
          // Positive color → WRITE to latch + apply normally
          this.colorLatch.set(fixtureId, { r, g, b })
          currentState.red = r
          currentState.green = g
          currentState.blue = b
        } else {
          // RGB(0,0,0) → CHECK latch. If latched color exists, re-inject it.
          // The dimmer is already 0 from the strobe curve, so the fixture
          // will be dark. But the color_wheel stays parked on the right gel.
          const latched = this.colorLatch.get(fixtureId)
          if (latched) {
            currentState.red = latched.r
            currentState.green = latched.g
            currentState.blue = latched.b
          } else {
            // No latch → pass through zeros (first frame, or pure intensity effect)
            currentState.red = 0
            currentState.green = 0
            currentState.blue = 0
          }
        }
      }

      if (controls.white !== undefined) currentState.white = controls.white

      // LTP for position
      if (controls.pan !== undefined) currentState.pan = controls.pan
      if (controls.tilt !== undefined) currentState.tilt = controls.tilt

      // LTP for optics
      if (controls.zoom !== undefined) currentState.zoom = controls.zoom
      if (controls.speed !== undefined) currentState.speed = controls.speed
    }
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

    // 🔥 WAVE 2056: No longer needs to release arbiter overrides
    // Playback uses setPlaybackFrame() which is completely replaced each tick
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

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE: Color conversion utilities
  // ═══════════════════════════════════════════════════════════════════════

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    // Remove # if present
    const cleanHex = hex.replace('#', '')
    
    // Parse hex to RGB
    const bigint = parseInt(cleanHex, 16)
    const r = (bigint >> 16) & 255
    const g = (bigint >> 8) & 255
    const b = bigint & 255
    
    return { r, g, b }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

export const timelineEngine = new TimelineEngine()
