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
  ChronosProject,
  TimeMs,
  NormalizedValue,
  PlaybackState,
  ChronosEngineState,
  ChronosContext,
  ChronosOverrideMode,
  ChronosActiveEffect,
  ChronosZoneOverride,
  ChronosColorOverride,
  TimelineClip,
  TimelineTrack,
  AutomationLane,
  AutomationPoint,
  AutomationTarget,
  EffectTriggerData,
  VibeChangeData,
  IntensityCurveData,
  ZoneOverrideData,
  ColorOverrideData,
} from './types'

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
// 🎚️ INTERPOLATION UTILITIES
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
 */
function evaluateAutomationLane(lane: AutomationLane, timeMs: TimeMs): number {
  const { points, defaultValue } = lane
  
  if (points.length === 0) return defaultValue
  if (points.length === 1) return points[0].value
  
  // Ordenar por tiempo (debería estar ordenado, pero por seguridad)
  const sorted = [...points].sort((a, b) => a.timeMs - b.timeMs)
  
  // Antes del primer punto
  if (timeMs <= sorted[0].timeMs) return sorted[0].value
  
  // Después del último punto
  if (timeMs >= sorted[sorted.length - 1].timeMs) {
    return sorted[sorted.length - 1].value
  }
  
  // Encontrar segmento
  for (let i = 0; i < sorted.length - 1; i++) {
    const p1 = sorted[i]
    const p2 = sorted[i + 1]
    
    if (timeMs >= p1.timeMs && timeMs < p2.timeMs) {
      const segmentDuration = p2.timeMs - p1.timeMs
      const t = (timeMs - p1.timeMs) / segmentDuration
      return interpolateValue(p1, p2, t)
    }
  }
  
  return defaultValue
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
  
  /** Proyecto actual */
  private project: ChronosProject | null = null
  
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
   * Carga un proyecto
   */
  public loadProject(project: ChronosProject): void {
    this.ensureNotDisposed()
    
    this.stop()
    this.project = project
    this.looping = project.playback.loop
    this.loopRegion = project.playback.loopRegion
    this.latencyCompensationMs = project.playback.latencyCompensationMs
    this.currentTimeMs = 0
  }
  
  /**
   * Descarga el proyecto actual
   */
  public unloadProject(): void {
    this.stop()
    this.unloadAudio()
    this.project = null
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
    return this.project?.meta.durationMs ?? 0
  }
  
  /**
   * Obtiene el proyecto actual
   */
  public getProject(): ChronosProject | null {
    return this.project
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
  // PUBLIC API - CONTEXT GENERATION
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Genera el ChronosContext para el tiempo actual
   * 
   * Este es el payload que se inyecta en TitanEngine cada frame.
   */
  public generateContext(): ChronosContext {
    const timeMs = this.currentTimeMs
    const project = this.project
    
    if (!project) {
      return this.createEmptyContext(timeMs)
    }
    
    const overrideMode = project.playback.overrideMode
    
    // Evaluar todas las tracks y clips activos
    const activeClips = this.getActiveClips(timeMs)
    
    // Procesar clips por tipo
    const vibeClip = this.findActiveClipOfType(activeClips, 'vibe_change')
    const intensityClip = this.findActiveClipOfType(activeClips, 'intensity_curve')
    const zoneClip = this.findActiveClipOfType(activeClips, 'zone_override')
    const colorClip = this.findActiveClipOfType(activeClips, 'color_override')
    const effectClips = this.getEffectClips(activeClips, timeMs)
    
    // Evaluar automation global
    const automationValues = this.evaluateGlobalAutomation(timeMs)
    
    return {
      timestamp: timeMs,
      active: this.playbackState !== 'stopped',
      overrideMode,
      
      vibeOverride: vibeClip 
        ? this.processVibeClip(vibeClip, timeMs) 
        : null,
      
      intensityOverride: intensityClip 
        ? (intensityClip.data as IntensityCurveData).value 
        : automationValues.get('master.intensity') ?? null,
      
      zoneOverrides: zoneClip 
        ? this.processZoneClip(zoneClip) 
        : null,
      
      colorOverride: colorClip 
        ? this.processColorClip(colorClip) 
        : null,
      
      activeEffects: effectClips,
      automationValues,
    }
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
    
    if (this.audioContext) {
      // Sincronizar con AudioContext para precisión
      const elapsed = (this.audioContext.currentTime - this.playbackStartTime) * 1000
      this.currentTimeMs = this.playbackStartOffset + elapsed * this.playbackRate
    } else {
      // Fallback a performance.now()
      this.currentTimeMs += delta * this.playbackRate
    }
    
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
  
  private getActiveClips(timeMs: TimeMs): TimelineClip[] {
    if (!this.project) return []
    
    const active: TimelineClip[] = []
    
    for (const track of this.project.tracks) {
      if (!track.enabled) continue
      
      for (const clip of track.clips) {
        if (!clip.enabled) continue
        
        const endMs = clip.startMs + clip.durationMs
        
        // Clip instantáneo (durationMs = 0) o clip con duración
        if (clip.durationMs === 0) {
          // Para eventos instantáneos, considerar un pequeño buffer
          if (Math.abs(timeMs - clip.startMs) < 16) {
            active.push(clip)
          }
        } else if (timeMs >= clip.startMs && timeMs < endMs) {
          active.push(clip)
        }
      }
    }
    
    // Ordenar por prioridad
    return active.sort((a, b) => b.priority - a.priority)
  }
  
  private findActiveClipOfType(
    clips: TimelineClip[], 
    type: string
  ): TimelineClip | null {
    return clips.find(c => c.type === type) ?? null
  }
  
  private getEffectClips(
    clips: TimelineClip[], 
    timeMs: TimeMs
  ): ChronosActiveEffect[] {
    const effects: ChronosActiveEffect[] = []
    
    for (const clip of clips) {
      if (clip.type !== 'effect_trigger') continue
      
      const data = clip.data as EffectTriggerData
      const progress = this.calculateClipProgress(clip, timeMs)
      
      effects.push({
        effectId: data.effectId,
        progress,
        intensity: data.intensity,
        speed: data.speed,
        zones: data.zones,
        params: data.params,
        sourceClipId: clip.id,
      })
    }
    
    return effects
  }
  
  private calculateClipProgress(clip: TimelineClip, timeMs: TimeMs): NormalizedValue {
    if (clip.durationMs === 0) return 1 // Instantáneo
    
    const elapsed = timeMs - clip.startMs
    let progress = elapsed / clip.durationMs
    
    // Handle loop
    if (clip.loop && progress > 1) {
      progress = progress % 1
    }
    
    return Math.max(0, Math.min(1, progress))
  }
  
  private processVibeClip(clip: TimelineClip, timeMs: TimeMs): {
    vibeId: string
    transition: 'cut' | 'fade'
    progress: NormalizedValue
  } | null {
    const data = clip.data as VibeChangeData
    
    // Calcular progress de la transición
    const transitionProgress = data.transition === 'cut' 
      ? 1 
      : Math.min(1, (timeMs - clip.startMs) / data.transitionMs)
    
    return {
      vibeId: data.vibeId,
      transition: data.transition,
      progress: transitionProgress,
    }
  }
  
  private processZoneClip(clip: TimelineClip): ChronosZoneOverride {
    const data = clip.data as ZoneOverrideData
    return {
      enabledZones: data.enabledZones,
      blackoutDisabled: data.blackoutDisabled,
    }
  }
  
  private processColorClip(clip: TimelineClip): ChronosColorOverride {
    const data = clip.data as ColorOverrideData
    return {
      palette: data.palette,
      keyLock: data.keyLock,
    }
  }
  
  private evaluateGlobalAutomation(timeMs: TimeMs): Map<AutomationTarget, number> {
    const values = new Map<AutomationTarget, number>()
    
    if (!this.project) return values
    
    for (const lane of this.project.globalAutomation) {
      if (!lane.enabled) continue
      
      const value = evaluateAutomationLane(lane, timeMs)
      values.set(lane.target, value)
    }
    
    return values
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
