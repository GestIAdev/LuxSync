/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 CHRONOS RECORDER - WAVE 2013.5: THE MATH FIX
 * 
 * Motor de grabación en tiempo real para el Timeline.
 * Cuando el modo REC está activo, cada click en un efecto del Arsenal
 * lo graba directamente en el zone track en la posición actual del playhead.
 * 
 * WAVE 2010: Añadido Vibe recording y Quantize to grid
 * WAVE 2011: Fixed trackIds to match TimelineCanvas
 * WAVE 2012: MixBus Routing + Vibe Latch Mode
 * WAVE 2543.3: Zone-based routing (live → zone-all, user refines later)
 *   - Vibes: Latch mode (un vibe cierra el anterior automáticamente)
 * WAVE 2013: THE LIVING CLIP
 *   - Dynamic growth: Active clips visually extend in real-time during recording
 *   - tick() method updates activeVibeClipId.durationMs every frame
 *   - Emits 'clip-growing' event for real-time UI updates
 * WAVE 2013.5: THE MATH FIX
 *   - VIBE-ONLY GROWTH: Only vibe clips grow, FX clips have fixed duration
 *   - FX clips appear with defaultDurationMs and stay fixed
 * 
 * ZONE ROUTING (WAVE 2543.3):
 * - Live recording → zone-all (global fallback)
 * - Drop from Arsenal → user picks zone track visually
 * - Edit/move → user reassigns to specific zone
 * 
 * AXIOMA ANTI-SIMULACIÓN:
 * Los efectos que se graban son los efectos REALES del sistema.
 * No hay demos, no hay mocks.
 * 
 * @module chronos/core/ChronosRecorder
 * @version WAVE 2013.5
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** 
 * 🌍 WAVE 2543.3: Default fallback track ID for live recording.
 * During live recording, effects go to 'zone-all' because
 * the specific zone is decided by the user via drag & drop or editing.
 */
export const DEFAULT_ZONE_TRACK = 'zone-all'

export type RecordedClipType = 'fx' | 'vibe'

export interface RecordedClip {
  /** Unique ID */
  id: string
  
  /** Clip type: 'fx' or 'vibe' */
  clipType: RecordedClipType
  
  /** Effect ID from registry (for FX) or vibe type (for Vibe) */
  effectId: string
  
  /** Effect display name */
  displayName: string
  
  /** Start time in ms (quantized if enabled) */
  startMs: number
  
  /** Duration in ms */
  durationMs: number
  
  /** Color for rendering */
  color: string
  
  /** Icon for rendering */
  icon: string
  
  /** Timestamp when recorded */
  recordedAt: number
  
  /** Track ID where this clip belongs */
  trackId: string
}

export interface RecorderState {
  /** Is recording active? */
  isRecording: boolean
  
  /** Current playhead position in ms */
  playheadMs: number
  
  /** Session start time (for relative timestamps) */
  sessionStartMs: number
  
  /** All clips recorded in current session */
  clips: RecordedClip[]
  
  /** Count of effects recorded */
  recordCount: number
  
  /** BPM for quantize calculations */
  bpm: number
  
  /** Quantize to beat grid enabled */
  quantizeEnabled: boolean
  
  // 🎹 WAVE 2012: Vibe Latch Mode
  /** Currently "open" vibe clip (being extended in real-time) */
  activeVibeClipId: string | null
}

export type RecorderEventType = 
  | 'record-start'
  | 'record-stop'
  | 'clip-added'
  | 'clip-removed'
  | 'clip-updated'   // WAVE 2012: Latch mode - vibe duration changed
  | 'clip-growing'   // WAVE 2013: Real-time clip growth during recording
  | 'playhead-update'

type EventCallback = (data: any) => void

// ═══════════════════════════════════════════════════════════════════════════
// RECORDER CLASS (Browser-compatible, no Node.js EventEmitter)
// ═══════════════════════════════════════════════════════════════════════════

export class ChronosRecorder {
  private state: RecorderState = {
    isRecording: false,
    playheadMs: 0,
    sessionStartMs: 0,
    clips: [],
    recordCount: 0,
    bpm: 120,
    quantizeEnabled: true,
    activeVibeClipId: null,
  }
  
  // Browser-compatible event system
  private listeners: Map<RecorderEventType, Set<EventCallback>> = new Map()
  
  // ─────────────────────────────────────────────────────────────────────────
  // EVENT EMITTER (Browser-compatible)
  // ─────────────────────────────────────────────────────────────────────────
  
  on(event: RecorderEventType, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }
  
  off(event: RecorderEventType, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback)
  }
  
  private emit(event: RecorderEventType, data?: any): void {
    this.listeners.get(event)?.forEach(cb => {
      try {
        cb(data)
      } catch (err) {
        console.error(`[ChronosRecorder] Event handler error:`, err)
      }
    })
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // GETTERS
  // ─────────────────────────────────────────────────────────────────────────
  
  get isRecording(): boolean {
    return this.state.isRecording
  }
  
  get playheadMs(): number {
    return this.state.playheadMs
  }
  
  get clips(): RecordedClip[] {
    return [...this.state.clips]
  }
  
  get recordCount(): number {
    return this.state.recordCount
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // RECORDING CONTROL
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 🔴 Start recording session
   */
  startRecording(): void {
    if (this.state.isRecording) {
      console.warn('[ChronosRecorder] Already recording')
      return
    }
    
    this.state = {
      ...this.state,
      isRecording: true,
      sessionStartMs: Date.now(),
      clips: [],
      recordCount: 0,
    }
    
    console.log('🔴 [ChronosRecorder] Recording started')
    this.emit('record-start', { playheadMs: this.state.playheadMs })
  }
  
  /**
   * ⬛ Stop recording session
   * @returns All recorded clips
   */
  stopRecording(): RecordedClip[] {
    if (!this.state.isRecording) {
      console.warn('[ChronosRecorder] Not recording')
      return []
    }
    
    // 🎹 WAVE 2012: Close any active vibe before stopping
    this.closeActiveVibe()
    
    const clips = [...this.state.clips]
    
    this.state = {
      ...this.state,
      isRecording: false,
      activeVibeClipId: null,
    }
    
    console.log(`⬛ [ChronosRecorder] Recording stopped. ${clips.length} clips captured.`)
    this.emit('record-stop', { clips, count: clips.length })
    
    return clips
  }
  
  /**
   * 🎚️ Update playhead position
   * Called by the transport/player during playback
   */
  updatePlayhead(positionMs: number): void {
    this.state.playheadMs = positionMs
    this.emit('playhead-update', { playheadMs: positionMs })
    
    // 🎬 WAVE 2013: Tick the living clip
    this.tickActiveClips()
  }
  
  /**
   * 🎬 WAVE 2013.5: THE LIVING CLIP - Tick active clips
   * Updates the duration of VIBE clips ONLY in real-time.
   * FX clips are created with fixed duration and don't grow.
   * Called automatically from updatePlayhead during recording.
   */
  private tickActiveClips(): void {
    if (!this.state.isRecording) return
    
    // WAVE 2013.5: Only update VIBE clips (trackId === 'vibe')
    // FX clips have fixed duration and don't grow
    if (this.state.activeVibeClipId) {
      const vibeClip = this.state.clips.find(c => c.id === this.state.activeVibeClipId)
      // Double-check: only grow if it's actually on the vibe track
      if (vibeClip && vibeClip.trackId === 'vibe') {
        const newDuration = this.state.playheadMs - vibeClip.startMs
        if (newDuration > 0 && newDuration !== vibeClip.durationMs) {
          vibeClip.durationMs = newDuration
          // Emit growing event for real-time visual update
          this.emit('clip-growing', { clip: vibeClip })
        }
      }
    }
  }
  
  /**
   * 🎯 Get current active vibe clip ID (for UI indicators)
   */
  get activeVibeClipId(): string | null {
    return this.state.activeVibeClipId
  }
  
  /**
   * 🎬 WAVE 2013.6: Get live endMs of the active growing clip
   * This provides real-time duration bypass for the TimelineCanvas
   */
  get activeVibeClipEndMs(): number | null {
    if (!this.state.activeVibeClipId) return null
    const clip = this.state.clips.find(c => c.id === this.state.activeVibeClipId)
    if (!clip) return null
    return clip.startMs + clip.durationMs
  }
  
  /**
   * 🎵 Set BPM for quantize calculations
   */
  setBpm(bpm: number): void {
    this.state.bpm = bpm
    console.log(`🎵 [ChronosRecorder] BPM set to: ${bpm}`)
  }
  
  /**
   * 🧲 Toggle quantize mode
   */
  setQuantize(enabled: boolean): void {
    this.state.quantizeEnabled = enabled
    console.log(`🧲 [ChronosRecorder] Quantize: ${enabled ? 'ON' : 'OFF'}`)
  }
  
  get quantizeEnabled(): boolean {
    return this.state.quantizeEnabled
  }
  
  get bpm(): number {
    return this.state.bpm
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // QUANTIZE LOGIC - WAVE 2010
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 🧲 Snap time to nearest beat
   */
  private snapToGrid(timeMs: number): number {
    if (!this.state.quantizeEnabled) {
      return timeMs
    }
    
    const beatDurationMs = 60000 / this.state.bpm
    const beatIndex = Math.round(timeMs / beatDurationMs)
    const snappedTime = beatIndex * beatDurationMs
    
    return Math.max(0, snappedTime)
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // MIXBUS ROUTING - WAVE 2012 (Intelligent Track Assignment)
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * � WAVE 2543.3: Get zone track ID for an effect
   * During live recording, routes to zone-all (global fallback).
   * The specific zone gets refined when the user edits/moves the clip.
   */
  private getTrackForEffect(effectId: string, timeMs: number, durationMs: number): string {
    const trackId = DEFAULT_ZONE_TRACK
    
    // Check if the default track is available
    if (!this.isTrackBusy(trackId, timeMs, durationMs)) {
      console.log(`🌍 [ChronosRecorder] Zone → ${trackId} for "${effectId}"`)
      return trackId
    }
    
    // Track busy — stack on same track (zone-all can handle multiple clips)
    console.log(`🌍 [ChronosRecorder] ${trackId} busy, stacking (zone track supports overlap)`)
    return trackId
  }
  
  /**
   * 🔍 Check if a track has a clip at the given time
   */
  private isTrackBusy(trackId: string, timeMs: number, durationMs: number): boolean {
    const clipStart = timeMs
    const clipEnd = timeMs + durationMs
    
    return this.state.clips.some(clip => {
      if (clip.trackId !== trackId) return false
      const existingStart = clip.startMs
      const existingEnd = clip.startMs + clip.durationMs
      
      // Check for overlap
      return !(clipEnd <= existingStart || clipStart >= existingEnd)
    })
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // CLIP RECORDING - WAVE 2012
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 🎯 Record an FX effect at current playhead position
   * WAVE 2012: MixBus Routing - Auto-assigns based on effect type
   * 
   * @param effectId Effect ID from registry
   * @param displayName Display name for the clip
   * @param durationMs Duration in ms
   * @param color Color for rendering
   * @param icon Icon emoji
   * @returns The recorded clip, or null if not recording
   */
  recordEffect(
    effectId: string,
    displayName: string,
    durationMs: number,
    color: string,
    icon: string
  ): RecordedClip | null {
    if (!this.state.isRecording) {
      console.warn('[ChronosRecorder] Cannot record FX - not in recording mode')
      return null
    }
    
    const startMs = this.snapToGrid(this.state.playheadMs)
    
    // 🎹 WAVE 2012: MixBus Routing - get track based on effect type
    const trackId = this.getTrackForEffect(effectId, startMs, durationMs)
    
    const clip: RecordedClip = {
      id: `rec-fx-${effectId}-${Date.now()}`,
      clipType: 'fx',
      effectId,
      displayName,
      startMs,
      durationMs,
      color,
      icon,
      recordedAt: Date.now(),
      trackId,
    }
    
    this.state.clips.push(clip)
    this.state.recordCount++
    
    console.log(`🔴 [ChronosRecorder] Recorded FX: ${displayName} at ${startMs}ms on ${trackId} (quantized: ${this.state.quantizeEnabled})`)
    this.emit('clip-added', { clip })
    
    return clip
  }
  
  /**
   * 🎭 Record a Vibe at current playhead position
   * WAVE 2012: LATCH MODE - Clicking a new Vibe closes the previous one
   * 
   * @param vibeType Vibe type ID
   * @param displayName Display name for the clip
   * @param durationMs Duration in ms (used as default if no latch follows)
   * @param color Color for rendering
   * @param icon Icon emoji
   * @returns The recorded clip, or null if not recording
   */
  recordVibe(
    vibeType: string,
    displayName: string,
    durationMs: number = 8000,
    color: string,
    icon: string
  ): RecordedClip | null {
    if (!this.state.isRecording) {
      console.warn('[ChronosRecorder] Cannot record Vibe - not in recording mode')
      return null
    }
    
    const startMs = this.snapToGrid(this.state.playheadMs)
    
    // 🎹 WAVE 2012: LATCH MODE - Close any active vibe first
    if (this.state.activeVibeClipId) {
      const activeClip = this.state.clips.find(c => c.id === this.state.activeVibeClipId)
      if (activeClip) {
        // Calculate new duration: from original start to current position
        const newDuration = startMs - activeClip.startMs
        if (newDuration > 0) {
          activeClip.durationMs = newDuration
          console.log(`🎹 [ChronosRecorder] LATCH: Closed "${activeClip.displayName}" (duration: ${newDuration}ms)`)
          // Emit update event for the closed clip
          this.emit('clip-updated', { clip: activeClip })
        }
      }
      this.state.activeVibeClipId = null
    }
    
    const clip: RecordedClip = {
      id: `rec-vibe-${vibeType}-${Date.now()}`,
      clipType: 'vibe',
      effectId: vibeType,
      displayName,
      startMs,
      durationMs, // Default duration, will be extended if another vibe comes
      color,
      icon,
      recordedAt: Date.now(),
      trackId: 'vibe',
    }
    
    this.state.clips.push(clip)
    this.state.recordCount++
    
    // 🎹 WAVE 2012: Mark this clip as "active" (latched open)
    this.state.activeVibeClipId = clip.id
    
    console.log(`🔴 [ChronosRecorder] Recorded Vibe: ${displayName} at ${startMs}ms (LATCH OPEN)`)
    this.emit('clip-added', { clip })
    
    return clip
  }
  
  /**
   * 🛑 Close the active vibe (call when stopping recording)
   */
  closeActiveVibe(): void {
    if (!this.state.activeVibeClipId) return
    
    const activeClip = this.state.clips.find(c => c.id === this.state.activeVibeClipId)
    if (activeClip) {
      const endMs = this.snapToGrid(this.state.playheadMs)
      const newDuration = endMs - activeClip.startMs
      if (newDuration > 0) {
        activeClip.durationMs = newDuration
        console.log(`🛑 [ChronosRecorder] Final LATCH close: "${activeClip.displayName}" (duration: ${newDuration}ms)`)
        this.emit('clip-updated', { clip: activeClip })
      }
    }
    this.state.activeVibeClipId = null
  }
  
  /**
   * ❌ Remove last recorded clip (undo)
   */
  undoLastClip(): RecordedClip | null {
    if (this.state.clips.length === 0) {
      return null
    }
    
    const removed = this.state.clips.pop()!
    
    // If we're undoing the active vibe, clear it
    if (this.state.activeVibeClipId === removed.id) {
      this.state.activeVibeClipId = null
    }
    
    this.emit('clip-removed', { clip: removed })
    
    console.log(`↩️ [ChronosRecorder] Undone: ${removed.displayName}`)
    return removed
  }
  
  /**
   * 🗑️ Clear all recorded clips
   */
  clearClips(): void {
    const count = this.state.clips.length
    this.state.clips = []
    
    console.log(`🗑️ [ChronosRecorder] Cleared ${count} clips`)
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // SERIALIZATION
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 📦 Export recorded clips for timeline integration
   */
  exportClips(): RecordedClip[] {
    return [...this.state.clips]
  }
  
  /**
   * 📊 Get recording stats
   */
  getStats(): { totalClips: number; totalDurationMs: number; avgClipDuration: number } {
    const clips = this.state.clips
    const totalDurationMs = clips.reduce((sum, c) => sum + c.durationMs, 0)
    
    return {
      totalClips: clips.length,
      totalDurationMs,
      avgClipDuration: clips.length > 0 ? totalDurationMs / clips.length : 0,
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

let instance: ChronosRecorder | null = null

export function getChronosRecorder(): ChronosRecorder {
  if (!instance) {
    instance = new ChronosRecorder()
  }
  return instance
}

export default ChronosRecorder
