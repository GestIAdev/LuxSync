// FASE 5b: Heph-custom clip playback delegated to HephaestusRuntime.
// TimelineEngine now triggers/stops clips in the runtime instead of
// evaluating curves manually. Vibe clips remain as Titan handoff.
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎬 TIMELINE ENGINE — FASE 5b: HephaestusRuntime Delegation
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Backend playback engine for .lux scene files.
 * Runs in the Electron Main process.
 *
 * ARCHITECTURE (FASE 5b):
 *   Frontend (React) → IPC tick(timeMs) → TimelineEngine.tick() →
 *     → heph-custom clips: trigger/stop in HephaestusRuntime →
 *       HephaestusRuntime.tick() (called by TickEngine) evaluates curves →
 *       HephFixtureOutput[] applied to fixture states by TickEngine.
 *     → vibe clips: vibeId handoff to TitanOrchestrator.
 *
 * The frontend is DUMB: it only manages audio playback and sends
 * the current timeMs. All lighting physics run HERE.
 *
 * @module core/engine/TimelineEngine
 */

import type { ChronosProjectV3 } from '../../chronos/core/LuxFileV3'
import type { FXClip, FXKeyframe, VibeClip } from '../../chronos/core/TimelineClip'
import { getTitanOrchestrator } from '../orchestrator/TitanOrchestrator'
import { getHephaestusRuntime } from '../orchestrator/IPCHandlers'

// WAVE 7110-B: Zone-to-fixture resolver — injected by TickEngine.
export type ZoneFixtureResolver = (zone: string) => readonly string[]

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
  private project: ChronosProjectV3 | null = null
  private fxClips: FXClip[] = []
  private vibeClips: VibeClip[] = []
  private _trackZoneMap = new Map<string, string>()

  // WAVE 7110-B: Zone resolver for target population.
  private _zoneResolver: ZoneFixtureResolver | null = null

  // WAVE 7110-B: Pre-allocated target buffer (zero-alloc hot path).
  private _targetBuffer: ChronosFixtureTarget[] = []

  // ── Playback state ──
  private playing = false
  private lastTickMs = 0
  private _lastPlaybackFrame: PlaybackFrameSnapshot | null = null

  // ── Last active set for cleanup ──
  private previousActiveIds = new Set<string>()

  // ── 🎬 WAVE 2063: Active vibe tracking for Titan handoff ──
  private currentPlaybackVibeId: string | null = null

  // ── FASE 5b: Active HephaestusRuntime instances keyed by clip.id ──
  // When a heph-custom clip becomes active, we call hephRuntime.playFromClip()
  // and track the instance ID here. When the clip exits the active range,
  // we call hephRuntime.stop(instanceId).
  private _activeHephInstances = new Map<string, string>()
  // ═══════════════════════════════════════════════════════════════════════
  // LOAD PROJECT
  // ═══════════════════════════════════════════════════════════════════════

  loadProject(project: ChronosProjectV3): void {
    this.stop() // Clean previous state

    this.project = project

    // Build trackId → targetZone map for zone resolution.
    this._trackZoneMap.clear()
    for (const track of project.tracks) {
      this._trackZoneMap.set(track.id, track.targetZone)
    }

    // Separate clips by type
    const allClips = project.tracks.flatMap(t => t.clips)
    this.fxClips = allClips.filter(c => c.type === 'fx') as unknown as FXClip[]
    this.vibeClips = allClips.filter(c => c.type === 'vibe') as unknown as VibeClip[]

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
   * FASE 5b: Heph-custom clips are triggered/stopped in HephaestusRuntime.
   * Curve evaluation happens in HephaestusRuntime.tick() (called by TickEngine).
   * Vibe clips are handled here (vibeId handoff to Titan).
   */
  tick(timeMs: number): void {
    if (!this.playing || !this.project) return

    this.lastTickMs = timeMs

    // ── Find active FX clips at this timeMs ──
    const nowActiveIds = new Set<string>()

    for (const clip of this.fxClips) {
      if (timeMs >= clip.startMs && timeMs < clip.endMs) {
        nowActiveIds.add(clip.id)
        this.triggerHephClip(clip)
      }
    }

    // ── Process active Vibe clips ──
    let hasActiveVibe = false
    for (const vibeClip of this.vibeClips) {
      if (timeMs >= vibeClip.startMs && timeMs < vibeClip.endMs) {
        hasActiveVibe = true
        this.processVibeClip(vibeClip, timeMs)
      }
    }

    // ── FASE 5: WHISPER FALLBACK ──
    // When no VibeClip is active, fall back to the project's vibeBase (whisper).
    // The whisper uses L0 (automatic photonics) for reactive movement/color.
    // If no vibeBase is set, fall back to 'idle' (blackout).
    if (!hasActiveVibe) {
      const whisperVibeId = this.project?.vibeBase?.vibeId ?? 'idle'
      if (whisperVibeId !== this.currentPlaybackVibeId) {
        this.currentPlaybackVibeId = whisperVibeId
        try {
          const orchestrator = getTitanOrchestrator()
          orchestrator.setVibe(whisperVibeId as any)
          console.log(`[TimelineEngine] 🌫️ Whisper fallback → Titan "${whisperVibeId}"`)
        } catch (err) {
          console.warn(`[TimelineEngine] ⚠️ Could not set whisper vibe:`, err)
        }
      }
    }

    // ── WAVE 7110-B: Build targets from non-heph-custom FX clips and Vibe clips ──
    this._targetBuffer.length = 0
    this._buildTargets(timeMs)

    this._lastPlaybackFrame = {
      targets: this._targetBuffer,
      hasActiveVibe,
      vibeId: this.currentPlaybackVibeId,
      tickMs: timeMs,
    }

    // ── Cleanup clips that ended ──
    for (const prevId of this.previousActiveIds) {
      if (!nowActiveIds.has(prevId)) {
        this.releaseClip(prevId)
      }
    }
    this.previousActiveIds = nowActiveIds
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STOP — Full cleanup
  // ═══════════════════════════════════════════════════════════════════════

  stop(): void {
    // FASE 5b: Stop all active HephaestusRuntime instances
    const hephRuntime = getHephaestusRuntime()
    for (const instanceId of this._activeHephInstances.values()) {
      hephRuntime.stop(instanceId)
    }
    this._activeHephInstances.clear()

    this.previousActiveIds.clear()

    this.currentPlaybackVibeId = null

    this.playing = false
    this.lastTickMs = 0
    this._lastPlaybackFrame = null
    this.project = null
    this.fxClips = []
    this.vibeClips = []
    this._trackZoneMap.clear()
    this._targetBuffer.length = 0

    console.log(`[TimelineEngine] Stopped - all HephaestusRuntime instances cleared`)
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
  // WAVE 7110-B: ZONE RESOLVER — Injected by TickEngine
  // ═══════════════════════════════════════════════════════════════════════

  setZoneResolver(resolver: ZoneFixtureResolver): void {
    this._zoneResolver = resolver
  }

  // ═══════════════════════════════════════════════════════════════════════
  // WAVE 7110-B: TARGET POPULATION — ChronosFixtureTarget generation
  // ═══════════════════════════════════════════════════════════════════════

  private _buildTargets(timeMs: number): void {
    if (!this._zoneResolver) return

    // Process non-heph-custom FX clips (automation curves).
    for (const clip of this.fxClips) {
      if (timeMs < clip.startMs || timeMs >= clip.endMs) continue
      if (clip.isHephCustom || clip.hephClip) continue

      const localMs = timeMs - clip.startMs
      const value = this._evaluateKeyframes(clip.keyframes, localMs)
      const zone = this._trackZoneMap.get(clip.trackId) ?? 'global'
      const fixtureIds = this._zoneResolver(zone)

      for (let i = 0; i < fixtureIds.length; i++) {
        this._targetBuffer.push(this._fxClipToTarget(fixtureIds[i], clip, value))
      }
    }

    // Process Vibe clips (dimmer targets from intensity + envelope).
    for (const vibeClip of this.vibeClips) {
      if (timeMs < vibeClip.startMs || timeMs >= vibeClip.endMs) continue

      const localMs = timeMs - vibeClip.startMs
      const durationMs = vibeClip.endMs - vibeClip.startMs
      let envelope = 1
      if (localMs < vibeClip.fadeInMs) {
        envelope = vibeClip.fadeInMs > 0 ? localMs / vibeClip.fadeInMs : 1
      } else if (localMs > durationMs - vibeClip.fadeOutMs) {
        envelope = vibeClip.fadeOutMs > 0 ? (durationMs - localMs) / vibeClip.fadeOutMs : 0
      }
      if (envelope <= 0) continue

      const dimmer = Math.round(vibeClip.intensity * envelope * 255)
      const zone = this._trackZoneMap.get(vibeClip.trackId) ?? 'global'
      const fixtureIds = this._zoneResolver(zone)

      for (let i = 0; i < fixtureIds.length; i++) {
        this._targetBuffer.push({
          fixtureId: fixtureIds[i],
          dimmer,
          red: 0, green: 0, blue: 0, white: 0,
          pan: 0, tilt: 0, zoom: 0, speed: 0,
          colorTouched: false,
          blendMode: 'HTP',
        })
      }
    }
  }

  private _evaluateKeyframes(keyframes: FXKeyframe[], localMs: number): number {
    if (keyframes.length === 0) return 0
    if (keyframes.length === 1) return keyframes[0].value

    // Find the segment containing localMs.
    let prev = keyframes[0]
    let next = keyframes[keyframes.length - 1]
    for (let i = 0; i < keyframes.length - 1; i++) {
      if (localMs >= keyframes[i].offsetMs && localMs <= keyframes[i + 1].offsetMs) {
        prev = keyframes[i]
        next = keyframes[i + 1]
        break
      }
    }

    if (localMs <= prev.offsetMs) return prev.value
    if (localMs >= next.offsetMs) return next.value

    const span = next.offsetMs - prev.offsetMs
    if (span <= 0) return next.value

    const t = (localMs - prev.offsetMs) / span
    const eased = this._applyEasing(t, prev.easing)
    return prev.value + (next.value - prev.value) * eased
  }

  private _applyEasing(t: number, easing: FXKeyframe['easing']): number {
    switch (easing) {
      case 'step': return 0
      case 'ease-in': return t * t
      case 'ease-out': return 1 - (1 - t) * (1 - t)
      case 'ease-in-out': return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)
      default: return t
    }
  }

  private _fxClipToTarget(fixtureId: string, clip: FXClip, value: number): ChronosFixtureTarget {
    const dmx = Math.round(value * 255)
    const params = clip.params as Record<string, number | string | boolean>

    switch (clip.fxType) {
      case 'blackout':
        return {
          fixtureId, dimmer: 0,
          red: 0, green: 0, blue: 0, white: 0,
          pan: 0, tilt: 0, zoom: 0, speed: 0,
          colorTouched: false, blendMode: 'LTP',
        }
      case 'color-wash': {
        const r = typeof params.r === 'number' ? params.r : 0
        const g = typeof params.g === 'number' ? params.g : 0
        const b = typeof params.b === 'number' ? params.b : 0
        return {
          fixtureId, dimmer: dmx,
          red: r, green: g, blue: b, white: 0,
          pan: 0, tilt: 0, zoom: 0, speed: 0,
          colorTouched: true, blendMode: 'HTP',
        }
      }
      case 'intensity-ramp':
      case 'fade':
      case 'pulse':
        return {
          fixtureId, dimmer: dmx,
          red: 0, green: 0, blue: 0, white: 0,
          pan: 0, tilt: 0, zoom: 0, speed: 0,
          colorTouched: false, blendMode: 'HTP',
        }
      case 'strobe':
        return {
          fixtureId, dimmer: dmx,
          red: 0, green: 0, blue: 0, white: 0,
          pan: 0, tilt: 0, zoom: 0, speed: dmx,
          colorTouched: false, blendMode: 'HTP',
        }
      case 'sweep':
      case 'chase': {
        const pan = typeof params.pan === 'number' ? params.pan : Math.round(value * 255)
        const tilt = typeof params.tilt === 'number' ? params.tilt : 0
        return {
          fixtureId, dimmer: dmx,
          red: 0, green: 0, blue: 0, white: 0,
          pan, tilt, zoom: 0, speed: 0,
          colorTouched: false, blendMode: 'HTP',
        }
      }
      default:
        return {
          fixtureId, dimmer: dmx,
          red: 0, green: 0, blue: 0, white: 0,
          pan: 0, tilt: 0, zoom: 0, speed: 0,
          colorTouched: false, blendMode: 'HTP',
        }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE: TRIGGER HEPH CLIP — Delegate to HephaestusRuntime
  // ═══════════════════════════════════════════════════════════════════════

  private triggerHephClip(clip: FXClip): void {
    if (this._activeHephInstances.has(clip.id)) return

    const hephClip = clip.hephClip
    if (!hephClip || !hephClip.tracks || hephClip.tracks.length === 0) {
      console.warn(`[TimelineEngine] ⚠️ Clip ${clip.id} has no hephClip payload — skipping`)
      return
    }

    const durationMs = clip.endMs - clip.startMs
    const hephRuntime = getHephaestusRuntime()
    const instanceId = hephRuntime.playFromClip(hephClip, {
      intensity: 1.0,
      durationOverrideMs: durationMs,
      loop: false,
    })

    if (instanceId) {
      this._activeHephInstances.set(clip.id, instanceId)
      console.log(`[TimelineEngine] ⚒️▶️ Triggered heph clip "${hephClip.name ?? clip.id}" → runtime:${instanceId} (${durationMs}ms)`)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 🌈 VIBE CLIPS — Vibe Handoff to Titan (WAVE 2065)
  // ═══════════════════════════════════════════════════════════════════════

  private processVibeClip(clip: VibeClip, timeMs: number): void {
    const localTimeMs = timeMs - clip.startMs
    const clipDurationMs = clip.endMs - clip.startMs

    let envelope = 1
    if (localTimeMs < clip.fadeInMs) {
      envelope = localTimeMs / clip.fadeInMs
    } else if (localTimeMs > clipDurationMs - clip.fadeOutMs) {
      envelope = (clipDurationMs - localTimeMs) / clip.fadeOutMs
    }
    if (envelope <= 0) return

    const vibeId = clip.vibeType
    if (vibeId && vibeId !== this.currentPlaybackVibeId) {
      this.currentPlaybackVibeId = vibeId
      try {
        const orchestrator = getTitanOrchestrator()
        orchestrator.setVibe(vibeId as any)
        console.log(`[TimelineEngine] 🎭 Vibe handoff → Titan "${vibeId}"`)
      } catch (err) {
        console.warn(`[TimelineEngine] ⚠️ Could not set vibe on Titan:`, err)
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE: Clip release / cleanup
  // ═══════════════════════════════════════════════════════════════════════

  private releaseClip(clipId: string): void {
    const instanceId = this._activeHephInstances.get(clipId)
    if (instanceId) {
      const hephRuntime = getHephaestusRuntime()
      hephRuntime.stop(instanceId)
      this._activeHephInstances.delete(clipId)
      console.log(`[TimelineEngine] ⚒️⏹ Stopped heph clip ${clipId} → runtime:${instanceId}`)
    }
  }

}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

export const timelineEngine = new TimelineEngine()
