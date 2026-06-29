// FASE 5a: Dead code removed (EFFECT_FACTORIES, processCoreEffect, dispatchEffectOutput,
// dispatchZoneOverrides, dispatchGlobalOutput, hslToRgb, processLegacyFx, interpolateKeyframes).
// processHephClip now uses HephTrack.blendMode + HephTrack.zones for routing.
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

import type { LuxProject } from '../../chronos/core/ChronosProject'
import type { FXClip, VibeClip } from '../../chronos/core/TimelineClip'
import type { BlendMode } from '../hephaestus/types'
import { getTitanOrchestrator } from '../orchestrator/TitanOrchestrator'
import { resolveZoneTags } from '../zones/ZoneMapper'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Engine state for external queries */
export interface TimelineEngineState {
  loaded: boolean
  playing: boolean
  projectName: string | null
  clipCount: number
  activeClipCount: number
  lastTickMs: number
}

export interface ChronosFixtureTarget {
  readonly fixtureId: string
  readonly dimmer: number
  readonly red: number
  readonly green: number
  readonly blue: number
  readonly white: number
  readonly pan: number
  readonly tilt: number
  readonly zoom: number
  readonly speed: number
  readonly colorTouched: boolean
  readonly blendMode: 'HTP' | 'LTP' | 'ADD'
}

export interface PlaybackFrameSnapshot {
  readonly targets: readonly ChronosFixtureTarget[]
  readonly hasActiveVibe: boolean
  readonly vibeId: string | null
  readonly tickMs: number
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
  private _lastPlaybackFrame: PlaybackFrameSnapshot | null = null

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
    // 🎭 WAVE 2070: COLOR TOUCHED — Tracks if ANY effect explicitly sent color
    // false = no effect touched color → arbiter should let Titan's color through
    // true = at least one effect sent RGB values → arbiter uses Chronos color
    colorTouched: boolean
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
  // 🗺️ WAVE 2543.5: Zone resolution cache — avoids per-frame allocations.
  // Key: zones.join(','), Value: resolved fixture IDs.
  // Invalidated on stop() and loadProject() (stage change).
  // ═══════════════════════════════════════════════════════════════════════
  private _zoneCache = new Map<string, string[]>()
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
        this.processClip(clip, timeMs, deltaMs)
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
      white: number
      color: { r: number; g: number; b: number }
      colorTouched: boolean  // 🎭 WAVE 2070: Did any effect explicitly send color?
      pan: number; tilt: number; zoom: number; focus: number; speed: number
      color_wheel: number; strobe: number; prism: number; gobo: number
      blendMode: 'HTP' | 'LTP' | 'ADD'  // 🎛️ WAVE 2066: Smart MixBus
      controlSources: Record<string, unknown>; appliedLayers: unknown[]
    }> = []
    
    for (const [fixtureId, state] of this.frameAccumulator.entries()) {
      fixtureTargets.push({
        fixtureId,
        dimmer: state.dimmer,
        white: state.white,
        color: { r: state.red, g: state.green, b: state.blue },
        colorTouched: state.colorTouched,  // 🎭 WAVE 2070: Propagate flag
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

    const playbackTargets: ChronosFixtureTarget[] = []
    for (let i = 0; i < fixtureTargets.length; i++) {
      const target = fixtureTargets[i]
      playbackTargets.push({
        fixtureId: target.fixtureId,
        dimmer: target.dimmer,
        red: target.color.r,
        green: target.color.g,
        blue: target.color.b,
        white: target.white,
        pan: target.pan,
        tilt: target.tilt,
        zoom: target.zoom,
        speed: target.speed,
        colorTouched: target.colorTouched,
        blendMode: target.blendMode,
      })
    }

    this._lastPlaybackFrame = {
      targets: playbackTargets,
      hasActiveVibe,
      vibeId: this.currentPlaybackVibeId,
      tickMs: timeMs,
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🎬 WAVE 2065: THE TRANSPARENT OVERLAY
    //
    // Chronos is a painter, not a dictator. Only the fixtures it explicitly
    // touches are sent to the Arbiter. Everything else stays under Titan/Selene.
    // If no FX clip is active → fixtureTargets is EMPTY → Titan reigns supreme.
    // ═══════════════════════════════════════════════════════════════════════

    // 🎤 WAVE 4703: setPlaybackFrame on ArbitrationDirector removed — bypased since WAVE 4592.
    // TitanOrchestrator reads getLastPlaybackFrame() directly from this engine.

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
    this.previousActiveIds.clear()

    // � WAVE 2069: Clear color latch — no stale colors after stop
    this.colorLatch.clear()

    // �🔥 WAVE 2056: Stop playback mode in Arbiter
    // 🎬 WAVE 4703: stopPlayback on ArbitrationDirector removed — bypased since WAVE 4592.

    // 🎬 WAVE 2063: Clear tracked vibe
    this.currentPlaybackVibeId = null

    // 🗺️ WAVE 2543.5: Clear zone resolution cache
    this._zoneCache.clear()

    this.playing = false
    this.lastTickMs = 0
    this._lastPlaybackFrame = null
    this.project = null
    this.fxClips = []
    this.vibeClips = []

    console.log(`[TimelineEngine] ⏹ Stopped — arbiter playback cleared`)
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
      activeClipCount: this.previousActiveIds.size,
      lastTickMs: this.lastTickMs,
    }
  }

  getLastPlaybackFrame(): PlaybackFrameSnapshot | null {
    return this._lastPlaybackFrame
  }

  get isPlaying(): boolean {
    return this.playing
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE: PROCESS A SINGLE CLIP
  // ═══════════════════════════════════════════════════════════════════════

  private processClip(clip: FXClip, timeMs: number, _deltaMs: number): void {
    const fxType = clip.fxType as string
    const localTimeMs = timeMs - clip.startMs

    // ─── HEPHAESTUS CUSTOM CLIPS (V3 — the only path) ───
    const hephClip = (clip as any).hephClip
    const hasHephPayload = hephClip != null && Array.isArray(hephClip?.tracks)
    if (fxType === 'heph-custom' && hasHephPayload) {
      this.processHephClip(clip, localTimeMs)
      return
    }

    // ─── LEGACY ROUTES DISABLED (WAVE 4859+) ───────────────────────────
    console.warn(
      `[TimelineEngine] ⚠️ DEPRECATED route blocked for fxType='${fxType}'. ` +
      `Only .lfx Hephaestus clips (heph-custom) are supported.`
    )
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ⚒️ HEPHAESTUS CUSTOM CLIPS (V3 — the only path)
  // ═══════════════════════════════════════════════════════════════════════

  private processHephClip(clip: FXClip, localTimeMs: number): void {
    const tracks = clip.hephClip?.tracks
    if (!tracks || tracks.length === 0) return

    const controls: Record<string, number> = {}
    const channels: string[] = []

    for (const track of tracks) {
      const paramId = track.paramId as string
      const curve = track.curve
      if (!curve.keyframes || curve.keyframes.length === 0) continue
      const value = this.interpolateHephKeyframes(
        curve.keyframes as Array<{ timeMs: number; value: number; interpolation?: string }>,
        localTimeMs
      )

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

    // FASE 5a: blendMode from HephTrack.blendMode (V3 canonical).
    // Default: 'max' for intensity, 'replace' for others.
    const hephBlendMode = clip.hephClip?.tracks[0]?.blendMode ?? 'max'
    const blendMode = this.resolveBlendMode(hephBlendMode)

    const fixtureIds = this.resolveFixtureIds(clip)
    this.dispatchToArbiter(fixtureIds, controls, { blendMode })
  }

  private resolveBlendMode(mode: BlendMode | undefined): 'HTP' | 'LTP' | 'ADD' {
    switch (mode) {
      case 'replace': return 'LTP'
      case 'add': return 'ADD'
      case 'max': return 'HTP'
      case 'multiply': return 'LTP'
      default: return 'HTP'
    }
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

  // WAVE 2543.5: Zone resolution with per-clip cache.
  // Clip zones are static during playback — cache eliminates per-frame allocations.
  private resolveFixtureIds(clip: FXClip): string[] {
    const zones = clip.zones

    if (zones && zones.length > 0) {
      const cacheKey = zones.join(',')
      const cached = this._zoneCache.get(cacheKey)
      if (cached) return cached

      const fixtures = getTitanOrchestrator().getFixturesForZoneMapping()
      const resolved = resolveZoneTags(zones, fixtures)

      if (resolved.length > 0) {
        this._zoneCache.set(cacheKey, resolved)
        return resolved
      }

      console.warn(
        `[TimelineEngine] ⚠️ Zones [${zones.join(', ')}] resolved to 0 fixtures — fallback to all`
      )
    }

    return getTitanOrchestrator().getFixtureIds()
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
      finalIds = getTitanOrchestrator().getFixtureIds()
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
          colorTouched: false,  // 🎭 WAVE 2070: No effect has sent color yet
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
        // 🎭 WAVE 2070: Mark that color was EXPLICITLY touched by an effect
        currentState.colorTouched = true

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

  private releaseClip(_clipId: string): void {
    // FASE 5a: No active effect instances to abort — HephaestusRuntime
    // manages its own clip lifecycle. Frame accumulator is cleared next tick.
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
