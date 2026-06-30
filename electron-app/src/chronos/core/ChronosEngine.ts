// FASE 4: V1 path demolished. Only V2 (generateContextV2, ClipBoundaryIndexV2) remains.
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🕰️ CHRONOS ENGINE - THE BEATING HEART
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 2001: THE FOUNDATION
 * 
 * Motor de playback del Timecoder.
 * Sincroniza con AudioContext para precisión de sample.
 * Genera ChronosContext cada frame para inyectar en TitanEngine.
 * 
 * ARQUITECTURA:
 * - Singleton (un solo engine por instancia de LuxSync)
 * - AudioContext como reloj maestro
 * - requestAnimationFrame para UI updates
 * - Emite eventos para desacoplar de UI
 * 
 * @module chronos/core/ChronosEngine
 * @version 2001.0.0
 */

import type {
  TimeMs,
  NormalizedValue,
  PlaybackState,
  ChronosEngineState,
  ChronosContext,
  ChronosOverrideMode,
  ChronosActiveEffect,
  AutomationLane,
  AutomationPoint,
  AutomationTarget,
} from './types'
import type { ChronosProjectV3, LuxTrackV3, LuxClipV3 } from './LuxFileV3'
import type { TimelineClip, FXClip } from './TimelineClip'

import type { EffectZone } from '../../core/effects/types'
import type { ClockSourceType } from './ClockSource'
import { ClockSourceManager } from '../protocols/ClockSourceManager'

// ═══════════════════════════════════════════════════════════════════════════
// 🎭 EVENT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Eventos emitidos por ChronosEngine
 */
export interface ChronosEngineEvents {
  /** Estado de playback cambió */
  'playback:stateChange': { state: PlaybackState; prevState: PlaybackState }
  
  /** Tiempo actual cambió (emitido cada frame) */
  'playback:tick': { timeMs: TimeMs; deltaMs: number }
  
  /** Audio cargado */
  'audio:loaded': { durationMs: TimeMs }
  
  /** Audio descargado */
  'audio:unloaded': {}
  
  /** Posición de seek cambió */
  'playback:seek': { timeMs: TimeMs }
  
  /** Loop region cambió */
  'playback:loopChange': { enabled: boolean; startMs: TimeMs; endMs: TimeMs }
  
  /** ChronosContext generado (para TitanEngine) */
  'context:update': { context: ChronosContext }
  
  /** Error */
  'error': { error: Error; operation: string }
}

type EventHandler<T> = (payload: T) => void
type EventUnsubscribe = () => void

// ═══════════════════════════════════════════════════════════════════════════
// 🚀 WAVE 2500: AUTOMATION LANE SORT CACHE (P0-1 FIX)
// ═══════════════════════════════════════════════════════════════════════════
//
// PROBLEM: evaluateAutomationLane() was calling [...points].sort() on EVERY
// frame for EVERY lane. With 20 lanes × 60fps = 1,200 array copies+sorts/sec.
//
// SOLUTION: WeakMap cache keyed by the lane's points array reference.
// The Zustand store produces NEW array references on mutation (immutable pattern),
// so a simple reference check is sufficient for invalidation.
// Cost: O(1) cache hit per frame. Sort only on edit.
// ═══════════════════════════════════════════════════════════════════════════

const sortedPointsCache = new WeakMap<readonly AutomationPoint[], AutomationPoint[]>()

/**
 * Returns a sorted copy of automation points, cached by array reference.
 * The Zustand store creates new array references on every mutation,
 * so WeakMap key invalidation is automatic and zero-cost.
 */
function getSortedPoints(points: AutomationPoint[]): AutomationPoint[] {
  let sorted = sortedPointsCache.get(points)
  if (!sorted) {
    sorted = [...points].sort((a, b) => a.timeMs - b.timeMs)
    sortedPointsCache.set(points, sorted)
  }
  return sorted
}

// ═══════════════════════════════════════════════════════════════════════════
// 🚀 WAVE 2500: CLIP BOUNDARY INDEX (P0-2 FIX)
// ═══════════════════════════════════════════════════════════════════════════
//
// PROBLEM: Active clip query did a linear scan of ALL tracks × ALL clips
// on EVERY frame. With 7 tracks × 200 clips = 1,400 iterations × 60fps.
//
// SOLUTION: Pre-computed boundary event index. A sorted array of "events"
// (clip start and clip end times) with binary search. On each frame:
// 1. If timeMs hasn't crossed any boundary since last query → return cached result
// 2. If boundary crossed → rebuild active set (still uses binary search)
//
// Rebuild cost: O(n log n) only when project changes (loadProject / track mutation)
// Per-frame cost: O(log n) boundary check + O(1) cache hit (typical case)
// ═══════════════════════════════════════════════════════════════════════════

interface ClipBoundaryEvent {
  timeMs: number
  clipId: string
  trackIndex: number
  clipIndex: number
  type: 'start' | 'end'
}

// WAVE 2550: V2 variant — same algorithm, LuxTrackV3
interface ClipIndexEntryV2 {
  clip: LuxClipV3
  track: LuxTrackV3
  startMs: number
  endMs: number
}

// WAVE 2550: ClipBoundaryIndexV2 — O(log n) algorithm, typed for V2 tracks
class ClipBoundaryIndexV2 {
  private boundaries: ClipBoundaryEvent[] = []
  private clipEntries: ClipIndexEntryV2[] = []
  private cachedActiveClips: LuxClipV3[] | null = null
  private lastQueryTimeMs: number = -1
  private tracksRef: readonly LuxTrackV3[] | null = null

  rebuild(tracks: readonly LuxTrackV3[]): void {
    this.tracksRef = tracks
    this.boundaries = []
    this.clipEntries = []
    this.cachedActiveClips = null
    this.lastQueryTimeMs = -1

    for (let ti = 0; ti < tracks.length; ti++) {
      const track = tracks[ti]
      if (!track.enabled) continue

      for (let ci = 0; ci < track.clips.length; ci++) {
        const clip = track.clips[ci]

        const startMs = clip.startMs
        const endMs = clip.endMs

        this.clipEntries.push({ clip, track, startMs, endMs })
        this.boundaries.push({ timeMs: startMs, clipId: clip.id, trackIndex: ti, clipIndex: ci, type: 'start' })
        this.boundaries.push({ timeMs: endMs, clipId: clip.id, trackIndex: ti, clipIndex: ci, type: 'end' })
      }
    }

    this.boundaries.sort((a, b) => a.timeMs - b.timeMs)
    this.clipEntries.sort((a, b) => a.startMs - b.startMs)
  }

  isStale(tracks: readonly LuxTrackV3[]): boolean {
    return this.tracksRef !== tracks
  }

  // Returns active clips with their V2 track for routing context
  queryWithTrack(timeMs: number): Array<{ clip: LuxClipV3; track: LuxTrackV3 }> {
    if (this.cachedActiveClips !== null && !this.hasCrossedBoundary(this.lastQueryTimeMs, timeMs)) {
      // Rebuild pairing from cached clips — O(m) where m = active clips (tiny)
      return this.cachedActiveClips.map(clip => ({
        clip,
        track: this.clipEntries.find(e => e.clip === clip)!.track,
      }))
    }

    const active: Array<{ clip: LuxClipV3; track: LuxTrackV3 }> = []
    const activeClips: LuxClipV3[] = []

    for (const entry of this.clipEntries) {
      if (entry.startMs > timeMs) break

      if (entry.startMs === entry.endMs) {
        if (Math.abs(timeMs - entry.startMs) < 16) {
          active.push({ clip: entry.clip, track: entry.track })
          activeClips.push(entry.clip)
        }
      } else if (timeMs >= entry.startMs && timeMs < entry.endMs) {
        active.push({ clip: entry.clip, track: entry.track })
        activeClips.push(entry.clip)
      }
    }

    this.cachedActiveClips = activeClips
    this.lastQueryTimeMs = timeMs
    return active
  }

  private hasCrossedBoundary(t1: number, t2: number): boolean {
    if (this.boundaries.length === 0) return false
    if (t1 === t2) return false
    const lo = Math.min(t1, t2)
    const hi = Math.max(t1, t2)
    let left = 0
    let right = this.boundaries.length
    while (left < right) {
      const mid = (left + right) >>> 1
      if (this.boundaries[mid].timeMs < lo) { left = mid + 1 } else { right = mid }
    }
    while (left < this.boundaries.length && this.boundaries[left].timeMs <= lo) { left++ }
    return left < this.boundaries.length && this.boundaries[left].timeMs <= hi
  }

  invalidate(): void {
    this.cachedActiveClips = null
    this.lastQueryTimeMs = -1
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERPOLATION UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Interpola entre dos puntos de automation
 */
function interpolateValue(
  p1: AutomationPoint,
  p2: AutomationPoint,
  t: number // 0-1 between p1 and p2
): number {
  const { interpolation } = p1
  
  switch (interpolation) {
    case 'step':
      return p1.value
      
    case 'linear':
      return p1.value + (p2.value - p1.value) * t
      
    case 'ease-in':
      return p1.value + (p2.value - p1.value) * (t * t)
      
    case 'ease-out':
      return p1.value + (p2.value - p1.value) * (1 - (1 - t) * (1 - t))
      
    case 'ease-in-out':
      return p1.value + (p2.value - p1.value) * (t < 0.5 
        ? 2 * t * t 
        : 1 - 2 * (1 - t) * (1 - t))
      
    case 'smooth':
      // Smoothstep
      const smoothT = t * t * (3 - 2 * t)
      return p1.value + (p2.value - p1.value) * smoothT
      
    case 'bezier':
      // Cubic bezier using handles
      return interpolateBezier(p1, p2, t)
      
    default:
      return p1.value
  }
}

/**
 * Interpolación cúbica Bézier
 */
function interpolateBezier(
  p1: AutomationPoint,
  p2: AutomationPoint,
  t: number
): number {
  const t2 = t * t
  const t3 = t2 * t
  const mt = 1 - t
  const mt2 = mt * mt
  const mt3 = mt2 * mt
  
  // Control points
  const cp1Value = p1.handleOut 
    ? p1.value + p1.handleOut.valueOffset 
    : p1.value
  const cp2Value = p2.handleIn 
    ? p2.value + p2.handleIn.valueOffset 
    : p2.value
  
  // Cubic Bézier: B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
  return mt3 * p1.value + 3 * mt2 * t * cp1Value + 3 * mt * t2 * cp2Value + t3 * p2.value
}

/**
 * Evalúa una automation lane en un tiempo dado
 * 
 * 🚀 WAVE 2500: P0-1 FIX — Zero-Sort Hot Path
 * Points are sorted ONCE and cached via WeakMap keyed by array reference.
 * The Zustand store creates new array references on mutation → automatic invalidation.
 * Binary search replaces linear scan for segment finding.
 */
function evaluateAutomationLane(lane: AutomationLane, timeMs: TimeMs): number {
  const { points, defaultValue } = lane
  
  if (points.length === 0) return defaultValue
  if (points.length === 1) return points[0].value
  
  // 🚀 WAVE 2500: Cached sorted points (O(1) lookup, sort only on mutation)
  const sorted = getSortedPoints(points)
  
  // Antes del primer punto
  if (timeMs <= sorted[0].timeMs) return sorted[0].value
  
  // Después del último punto
  if (timeMs >= sorted[sorted.length - 1].timeMs) {
    return sorted[sorted.length - 1].value
  }
  
  // 🚀 WAVE 2500: Binary search for segment (O(log n) instead of O(n))
  let lo = 0
  let hi = sorted.length - 1
  
  while (lo < hi - 1) {
    const mid = (lo + hi) >>> 1
    if (sorted[mid].timeMs <= timeMs) {
      lo = mid
    } else {
      hi = mid
    }
  }
  
  const p1 = sorted[lo]
  const p2 = sorted[hi]
  const segmentDuration = p2.timeMs - p1.timeMs
  const t = segmentDuration > 0 ? (timeMs - p1.timeMs) / segmentDuration : 0
  return interpolateValue(p1, p2, t)
}

// ═══════════════════════════════════════════════════════════════════════════
// 🕰️ CHRONOS ENGINE CLASS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🕰️ CHRONOS ENGINE
 * 
 * El corazón del Timecoder.
 * Gestiona playback, sincronización y generación de ChronosContext.
 */
export class ChronosEngine {
  // ═══════════════════════════════════════════════════════════════════════
  // SINGLETON
  // ═══════════════════════════════════════════════════════════════════════
  
  private static instance: ChronosEngine | null = null
  
  /**
   * Obtiene la instancia singleton
   */
  public static getInstance(): ChronosEngine {
    if (!ChronosEngine.instance) {
      ChronosEngine.instance = new ChronosEngine()
    }
    return ChronosEngine.instance
  }
  
  /**
   * Destruye la instancia singleton (para testing o reset)
   */
  public static destroyInstance(): void {
    if (ChronosEngine.instance) {
      ChronosEngine.instance.dispose()
      ChronosEngine.instance = null
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE STATE
  // ═══════════════════════════════════════════════════════════════════════
  
  /** AudioContext para sync de precisión */
  private audioContext: AudioContext | null = null
  
  /** Audio buffer source (si hay audio cargado) */
  private audioSource: AudioBufferSourceNode | null = null
  
  /** Audio buffer decodificado */
  private audioBuffer: AudioBuffer | null = null
  
  /** Gain node para control de volumen */
  private gainNode: GainNode | null = null
  
  /** Estado actual de playback */
  private playbackState: PlaybackState = 'stopped'
  
  /** Tiempo actual en ms */
  private currentTimeMs: TimeMs = 0
  
  /** Tiempo del último tick (para delta) */
  private lastTickTime: number = 0
  
  /** Tiempo de inicio del playback (AudioContext.currentTime) */
  private playbackStartTime: number = 0
  
  /** Offset cuando se inició el playback */
  private playbackStartOffset: TimeMs = 0
  
  /** Velocidad de reproducción */
  private playbackRate: number = 1.0
  
  /** ¿Loop activo? */
  private looping: boolean = false
  
  /** Región de loop */
  private loopRegion: { startMs: TimeMs; endMs: TimeMs } | null = null
  
  /** Frame de animation actual */
  private animationFrame: number | null = null
  
  /** Event listeners */
  private listeners: Map<keyof ChronosEngineEvents, Set<EventHandler<unknown>>> = new Map()
  
  /** ¿Está disposed? */
  private disposed: boolean = false
  
  /** Compensación de latencia (ms) */
  private latencyCompensationMs: TimeMs = 10
  
  /** WAVE 2550: Project V2 (per-track architecture) */
  private projectV2: ChronosProjectV3 | null = null

  /** WAVE 2550: Clip boundary index for V2 tracks */
  private clipIndexV2: ClipBoundaryIndexV2 = new ClipBoundaryIndexV2()
  
  /** WAVE 2501: External clock source manager (MTC, Art-Net TC, LTC, MIDI Master) */
  private clockSources: ClockSourceManager = new ClockSourceManager()
  
  // ═══════════════════════════════════════════════════════════════════════
  // CONSTRUCTOR (PRIVATE - usar getInstance)
  // ═══════════════════════════════════════════════════════════════════════
  
  private constructor() {
    // Inicializar AudioContext en primera interacción del usuario
    // (Chrome requiere user gesture)
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API - LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Inicializa el AudioContext (debe llamarse en user gesture)
   */
  public async initialize(): Promise<void> {
    if (this.audioContext) return
    
    try {
      this.audioContext = new AudioContext()
      this.gainNode = this.audioContext.createGain()
      this.gainNode.connect(this.audioContext.destination)
      
      // Resume si está suspended (Chrome policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }
    } catch (error) {
      this.emit('error', { 
        error: error as Error, 
        operation: 'initialize' 
      })
      throw error
    }
  }
  
  /**
   * WAVE 2550: Carga un proyecto V2 (arquitectura per-track).
   * FASE 4: V1 loadProject() demolished — V2 is the only path.
   */
  public loadProjectV2(project: ChronosProjectV3): void {
    this.ensureNotDisposed()
    this.stop()
    this.projectV2 = project
    this.currentTimeMs = 0
    this.clipIndexV2.rebuild(project.tracks)
  }

  /**
   * Descarga el proyecto actual
   */
  public unloadProject(): void {
    this.stop()
    this.unloadAudio()
    this.projectV2 = null
    this.currentTimeMs = 0
  }
  
  /**
   * Carga audio desde un ArrayBuffer
   */
  public async loadAudio(arrayBuffer: ArrayBuffer): Promise<void> {
    this.ensureNotDisposed()
    
    if (!this.audioContext) {
      await this.initialize()
    }
    
    try {
      this.audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer)
      
      this.emit('audio:loaded', { 
        durationMs: this.audioBuffer.duration * 1000 
      })
    } catch (error) {
      this.emit('error', { 
        error: error as Error, 
        operation: 'loadAudio' 
      })
      throw error
    }
  }
  
  /**
   * Descarga el audio actual
   */
  public unloadAudio(): void {
    this.stopAudioSource()
    this.audioBuffer = null
    this.emit('audio:unloaded', {})
  }
  
  /**
   * Libera todos los recursos
   */
  public dispose(): void {
    if (this.disposed) return
    
    this.stop()
    this.unloadAudio()
    
    // 📡 WAVE 2501: Dispose clock sources
    this.clockSources.dispose()
    
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    
    this.gainNode = null
    this.listeners.clear()
    this.disposed = true
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API - PLAYBACK CONTROL
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Inicia la reproducción
   */
  public play(): void {
    this.ensureNotDisposed()
    
    if (this.playbackState === 'playing') return
    
    const prevState = this.playbackState
    this.playbackState = 'playing'
    
    // Guardar offset y tiempo de inicio
    this.playbackStartOffset = this.currentTimeMs
    this.playbackStartTime = this.audioContext?.currentTime ?? performance.now() / 1000
    
    // Iniciar audio si hay buffer
    if (this.audioBuffer && this.audioContext && this.gainNode) {
      this.startAudioSource(this.currentTimeMs / 1000)
    }
    
    // Iniciar loop de tick
    this.startTickLoop()
    
    this.emit('playback:stateChange', { state: 'playing', prevState })
  }
  
  /**
   * Pausa la reproducción
   */
  public pause(): void {
    this.ensureNotDisposed()
    
    if (this.playbackState !== 'playing') return
    
    const prevState = this.playbackState
    this.playbackState = 'paused'
    
    // Detener audio
    this.stopAudioSource()
    
    // Detener loop de tick
    this.stopTickLoop()
    
    this.emit('playback:stateChange', { state: 'paused', prevState })
  }
  
  /**
   * Detiene la reproducción y vuelve al inicio
   */
  public stop(): void {
    this.ensureNotDisposed()
    
    const prevState = this.playbackState
    
    if (prevState === 'stopped') return
    
    this.playbackState = 'stopped'
    
    // Detener audio
    this.stopAudioSource()
    
    // Detener loop de tick
    this.stopTickLoop()
    
    // Reset tiempo
    this.currentTimeMs = 0
    
    this.emit('playback:stateChange', { state: 'stopped', prevState })
    this.emit('playback:seek', { timeMs: 0 })
  }
  
  /**
   * Salta a un tiempo específico
   */
  public seek(timeMs: TimeMs): void {
    this.ensureNotDisposed()
    
    const duration = this.getDurationMs()
    const clampedTime = Math.max(0, Math.min(timeMs, duration))
    
    const wasPlaying = this.playbackState === 'playing'
    
    // Si está reproduciendo, reiniciar audio desde nueva posición
    if (wasPlaying) {
      this.stopAudioSource()
    }
    
    this.currentTimeMs = clampedTime
    this.playbackStartOffset = clampedTime
    this.playbackStartTime = this.audioContext?.currentTime ?? performance.now() / 1000
    
    // WAVE 2550: Invalidate clip cache on seek (non-monotonic time jump)
    this.clipIndexV2.invalidate()
    
    if (wasPlaying && this.audioBuffer && this.audioContext && this.gainNode) {
      this.startAudioSource(clampedTime / 1000)
    }
    
    this.emit('playback:seek', { timeMs: clampedTime })
    
    // Emitir contexto actualizado
    this.emitContext()
  }
  
  /**
   * Establece la velocidad de reproducción
   */
  public setPlaybackRate(rate: number): void {
    this.ensureNotDisposed()
    
    const clampedRate = Math.max(0.25, Math.min(rate, 4.0))
    
    if (this.playbackRate === clampedRate) return
    
    // Actualizar offset antes de cambiar rate
    if (this.playbackState === 'playing') {
      this.playbackStartOffset = this.currentTimeMs
      this.playbackStartTime = this.audioContext?.currentTime ?? performance.now() / 1000
      
      // Actualizar rate del audio source
      if (this.audioSource) {
        this.audioSource.playbackRate.value = clampedRate
      }
    }
    
    this.playbackRate = clampedRate
  }
  
  /**
   * Establece si hay loop
   */
  public setLooping(enabled: boolean): void {
    this.looping = enabled
    this.emit('playback:loopChange', {
      enabled,
      startMs: this.loopRegion?.startMs ?? 0,
      endMs: this.loopRegion?.endMs ?? this.getDurationMs(),
    })
  }
  
  /**
   * Establece la región de loop
   */
  public setLoopRegion(startMs: TimeMs, endMs: TimeMs): void {
    this.loopRegion = { startMs, endMs }
    this.emit('playback:loopChange', {
      enabled: this.looping,
      startMs,
      endMs,
    })
  }
  
  /**
   * Entra en modo scrubbing (arrastrar playhead)
   */
  public startScrubbing(): void {
    this.ensureNotDisposed()
    
    const prevState = this.playbackState
    
    if (prevState === 'playing') {
      this.stopAudioSource()
      this.stopTickLoop()
    }
    
    this.playbackState = 'scrubbing'
    this.emit('playback:stateChange', { state: 'scrubbing', prevState })
  }
  
  /**
   * Sale del modo scrubbing
   */
  public endScrubbing(resumePlayback: boolean = false): void {
    this.ensureNotDisposed()
    
    if (this.playbackState !== 'scrubbing') return
    
    const prevState = this.playbackState
    
    if (resumePlayback) {
      this.playbackState = 'playing'
      this.playbackStartOffset = this.currentTimeMs
      this.playbackStartTime = this.audioContext?.currentTime ?? performance.now() / 1000
      
      if (this.audioBuffer && this.audioContext && this.gainNode) {
        this.startAudioSource(this.currentTimeMs / 1000)
      }
      
      this.startTickLoop()
    } else {
      this.playbackState = 'paused'
    }
    
    this.emit('playback:stateChange', { state: this.playbackState, prevState })
  }
  
  /**
   * Scrub a una posición (mientras está en modo scrubbing)
   */
  public scrubTo(timeMs: TimeMs): void {
    if (this.playbackState !== 'scrubbing') return
    
    const duration = this.getDurationMs()
    this.currentTimeMs = Math.max(0, Math.min(timeMs, duration))
    
    // WAVE 2550: Invalidate clip cache on scrub (non-monotonic time jump)
    this.clipIndexV2.invalidate()
    
    // Emitir contexto para preview
    this.emitContext()
    this.emit('playback:seek', { timeMs: this.currentTimeMs })
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API - STATE GETTERS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Obtiene el estado actual del engine
   */
  public getState(): ChronosEngineState {
    return {
      playbackState: this.playbackState,
      currentTimeMs: this.currentTimeMs,
      audioTimeMs: this.currentTimeMs - this.latencyCompensationMs,
      playbackRate: this.playbackRate,
      looping: this.looping,
      loopRegion: this.loopRegion,
      hasAudio: this.audioBuffer !== null,
      durationMs: this.getDurationMs(),
    }
  }
  
  /**
   * Obtiene el tiempo actual en ms
   */
  public getCurrentTimeMs(): TimeMs {
    return this.currentTimeMs
  }
  
  /**
   * Obtiene la duración total en ms
   */
  public getDurationMs(): TimeMs {
    if (this.audioBuffer) {
      return this.audioBuffer.duration * 1000
    }
    return this.projectV2?.meta.durationMs ?? 0
  }

  /**
   * WAVE 2550: Obtiene el proyecto V2 si está cargado
   */
  public getProjectV2(): ChronosProjectV3 | null {
    return this.projectV2
  }
  
  /**
   * ¿Tiene audio cargado?
   */
  public hasAudio(): boolean {
    return this.audioBuffer !== null
  }
  
  /**
   * ¿Está reproduciendo?
   */
  public isPlaying(): boolean {
    return this.playbackState === 'playing'
  }
  
  /**
   * ¿Está en scrubbing?
   */
  public isScrubbing(): boolean {
    return this.playbackState === 'scrubbing'
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // 📡 WAVE 2501: CLOCK SOURCE / PROTOCOL MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Get the ClockSourceManager for protocol configuration.
   * Use this to switch clock sources, configure MIDI Master, etc.
   */
  public getClockSources(): ClockSourceManager {
    return this.clockSources
  }
  
  /**
   * Switch the active external clock source.
   * 'internal' = use AudioContext (default).
   */
  public async setClockSource(type: ClockSourceType): Promise<void> {
    await this.clockSources.setSource(type)
    
    // WAVE 2550: Invalidate clip cache when clock source changes
    this.clipIndexV2.invalidate()
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API - CONTEXT GENERATION
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Genera el ChronosContext para el tiempo actual.
   * WAVE 2550: Si hay projectV2 cargado, delega a generateContextV2().
   * Mantiene backwards compat con V1.
   */
  public generateContext(): ChronosContext {
    const timeMs = this.currentTimeMs

    // FASE 4: V1 path demolished — V2 is the only path.
    if (this.projectV2) {
      return this.generateContextV2(timeMs)
    }

    return this.createEmptyContext(timeMs)
  }
  
  /**
   * Tick externo (para integración con TitanEngine.update())
   * 
   * Llama esto desde el loop principal si prefieres tick manual.
   */
  public tick(): ChronosContext {
    if (this.playbackState === 'playing') {
      this.updateTime()
    }
    return this.generateContext()
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API - EVENTS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Suscribe a un evento
   */
  public on<K extends keyof ChronosEngineEvents>(
    event: K, 
    handler: EventHandler<ChronosEngineEvents[K]>
  ): EventUnsubscribe {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    
    const handlers = this.listeners.get(event)!
    handlers.add(handler as EventHandler<unknown>)
    
    return () => {
      handlers.delete(handler as EventHandler<unknown>)
    }
  }
  
  /**
   * Desuscribe de un evento
   */
  public off<K extends keyof ChronosEngineEvents>(
    event: K, 
    handler: EventHandler<ChronosEngineEvents[K]>
  ): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      handlers.delete(handler as EventHandler<unknown>)
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE - AUDIO MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════
  
  private startAudioSource(offsetSeconds: number): void {
    if (!this.audioBuffer || !this.audioContext || !this.gainNode) return
    
    this.stopAudioSource()
    
    this.audioSource = this.audioContext.createBufferSource()
    this.audioSource.buffer = this.audioBuffer
    this.audioSource.playbackRate.value = this.playbackRate
    this.audioSource.connect(this.gainNode)
    
    // Loop handling
    if (this.looping && this.loopRegion) {
      this.audioSource.loop = true
      this.audioSource.loopStart = this.loopRegion.startMs / 1000
      this.audioSource.loopEnd = this.loopRegion.endMs / 1000
    }
    
    this.audioSource.start(0, offsetSeconds)
  }
  
  private stopAudioSource(): void {
    if (this.audioSource) {
      try {
        this.audioSource.stop()
        this.audioSource.disconnect()
      } catch {
        // Ignorar errores si ya está detenido
      }
      this.audioSource = null
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE - TICK LOOP
  // ═══════════════════════════════════════════════════════════════════════
  
  private startTickLoop(): void {
    this.lastTickTime = performance.now()
    
    const tickFn = () => {
      if (this.playbackState !== 'playing') return
      
      this.updateTime()
      this.emitContext()
      
      this.animationFrame = requestAnimationFrame(tickFn)
    }
    
    this.animationFrame = requestAnimationFrame(tickFn)
  }
  
  private stopTickLoop(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame)
      this.animationFrame = null
    }
  }
  
  private updateTime(): void {
    const now = performance.now()
    const delta = now - this.lastTickTime
    this.lastTickTime = now
    
    // 📡 WAVE 2501: Check external clock source first
    const externalTimeMs = this.clockSources.getExternalTimeMs()
    if (externalTimeMs !== null) {
      // External source is driving the clock — use its timecode directly
      this.currentTimeMs = externalTimeMs
    } else if (this.audioContext) {
      // Sincronizar con AudioContext para precisión
      const elapsed = (this.audioContext.currentTime - this.playbackStartTime) * 1000
      this.currentTimeMs = this.playbackStartOffset + elapsed * this.playbackRate
    } else {
      // Fallback a performance.now()
      this.currentTimeMs += delta * this.playbackRate
    }
    
    // 📡 WAVE 2501: Tick MIDI Clock Master (outbound) if running
    const bpm = this.projectV2?.runtimeBpm ?? this.projectV2?.audio?.detectedBpm ?? 120
    this.clockSources.tickMIDIMaster(bpm)
    
    // Handle loop
    if (this.looping && this.loopRegion) {
      if (this.currentTimeMs >= this.loopRegion.endMs) {
        this.seek(this.loopRegion.startMs)
        return
      }
    }
    
    // Handle end of timeline
    const duration = this.getDurationMs()
    if (this.currentTimeMs >= duration) {
      if (this.looping) {
        this.seek(0)
      } else {
        this.currentTimeMs = duration
        this.stop()
      }
      return
    }
    
    this.emit('playback:tick', { 
      timeMs: this.currentTimeMs, 
      deltaMs: delta 
    })
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE - CONTEXT GENERATION HELPERS
  // ═══════════════════════════════════════════════════════════════════════
  
  // WAVE 2550: generateContextV2 — per-track V2 pipeline
  private generateContextV2(timeMs: TimeMs): ChronosContext {
    const project = this.projectV2!

    const overrideMode: ChronosOverrideMode = 'whisper'

    // Auto-rebuild if tracks reference changed
    if (this.clipIndexV2.isStale(project.tracks)) {
      this.clipIndexV2.rebuild(project.tracks)
    }

    const activeWithTracks = this.clipIndexV2.queryWithTrack(timeMs)

    // Evaluate global automation (shared with V1)
    const automationValues = this.evaluateGlobalAutomationV2(timeMs, project)

    // Build activeEffects per-track — each track's targetZone drives routing
    const activeEffects: ChronosActiveEffect[] = []

    for (const { clip, track } of activeWithTracks) {
      if (clip.type !== 'fx') continue

      const fxClip = clip as unknown as FXClip
      const progress = this.calculateClipProgress(clip as unknown as TimelineClip, timeMs)

      // WAVE 2550: Zone routing comes from the track, not the clip.
      // track.targetZone === 'global' maps to EffectZone 'all' (all fixtures).
      const trackZone: EffectZone =
        (track.targetZone === 'global' ? 'all' : track.targetZone) as EffectZone

      activeEffects.push({
        effectId: fxClip.fxType,
        progress,
        intensity: (fxClip.params?.intensity as number) ?? 1.0,
        speed: (fxClip.params?.speed as number) ?? 1.0,
        // If the clip has explicit zone overrides, merge them; otherwise use track zone.
        zones: fxClip.zones && fxClip.zones.length > 0 ? fxClip.zones as EffectZone[] : [trackZone],
        params: fxClip.params ?? {},
        sourceClipId: clip.id,
      })
    }

    // V2 projects currently support effect tracks only.
    // vibe/intensity/zone/color overrides remain null until those clip types
    // are added to the V2 model (future wave).
    return {
      timestamp: timeMs,
      active: this.playbackState !== 'stopped',
      overrideMode,
      vibeOverride: null,
      intensityOverride: automationValues.get('master.intensity') ?? null,
      zoneOverrides: null,
      colorOverride: null,
      activeEffects,
      automationValues,
    }
  }

  private evaluateGlobalAutomationV2(
    timeMs: TimeMs,
    project: ChronosProjectV3
  ): Map<AutomationTarget, number> {
    const values = new Map<AutomationTarget, number>()
    // WAVE 7100 FASE 3: V3 has no globalAutomation — return empty map
    return values
  }

  private calculateClipProgress(clip: TimelineClip, timeMs: TimeMs): NormalizedValue {
    const durationMs = clip.endMs - clip.startMs
    if (durationMs === 0) return 1 // Instantáneo
    
    const elapsed = timeMs - clip.startMs
    const progress = elapsed / durationMs
    
    return Math.max(0, Math.min(1, progress))
  }
  
  private createEmptyContext(timeMs: TimeMs): ChronosContext {
    return {
      timestamp: timeMs,
      active: false,
      overrideMode: 'whisper',
      vibeOverride: null,
      intensityOverride: null,
      zoneOverrides: null,
      colorOverride: null,
      activeEffects: [],
      automationValues: new Map(),
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE - EVENT EMISSION
  // ═══════════════════════════════════════════════════════════════════════
  
  private emit<K extends keyof ChronosEngineEvents>(
    event: K, 
    payload: ChronosEngineEvents[K]
  ): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(payload)
        } catch (error) {
          console.error(`[ChronosEngine] Error in event handler for ${event}:`, error)
        }
      }
    }
  }
  
  private emitContext(): void {
    const context = this.generateContext()
    this.emit('context:update', { context })
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE - VALIDATION
  // ═══════════════════════════════════════════════════════════════════════
  
  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error('[ChronosEngine] Engine has been disposed')
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🏭 FACTORY EXPORT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Acceso conveniente al singleton
 */
export const getChronosEngine = ChronosEngine.getInstance
