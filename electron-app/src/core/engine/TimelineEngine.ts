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

import type { LuxProject } from '../../chronos/core/ChronosProject'
import type { FXClip, VibeClip } from '../../chronos/core/TimelineClip'
import { getTitanOrchestrator } from '../orchestrator/TitanOrchestrator'
import { getHephaestusRuntime } from '../orchestrator/IPCHandlers'

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

  // ── FASE 5b: Active HephaestusRuntime instances keyed by clip.id ──
  // When a heph-custom clip becomes active, we call hephRuntime.playFromClip()
  // and track the instance ID here. When the clip exits the active range,
  // we call hephRuntime.stop(instanceId).
  private _activeHephInstances = new Map<string, string>()
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

    if (!hasActiveVibe && this.currentPlaybackVibeId) {
      this.currentPlaybackVibeId = null
    }

    // ── Build playback frame (targets empty — HephaestusRuntime paints directly) ──
    this._lastPlaybackFrame = {
      targets: [],
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
