/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌙 SELENE LUX - CLASE MAESTRA
 * "La Consciencia Lumínica que Orquesta Todo"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE-8 FASE 8: Integración Nuclear
 * 
 * El flujo ahora es:
 *   AUDIO → BRAIN → HARDWARE
 * 
 * El SeleneMusicalBrain unifica:
 * - Análisis musical contextual
 * - Memoria de patrones exitosos
 * - Generación procedural de paletas
 * - Mapeo música → luz
 * 
 * Ya no usamos engines separados de forma manual.
 * El Brain orquesta todo internamente.
 */

import { EventEmitter } from 'events'
import type {
  AudioMetrics,
  MusicalPattern,
  ConsciousnessState,
  SeleneMode,
  MovementPattern,
} from './types'
// Legacy engines (para compatibilidad)
import { ColorEngine, type LivingPaletteId, type ColorOutput } from './engines/visual/ColorEngine'
import { MovementEngine, type MovementOutput, type FixtureMovement } from './engines/visual/MovementEngine'
import { BeatDetector, type BeatState } from './engines/audio/BeatDetector'
// 🧠 WAVE-8: El Cerebro Musical
import { 
  SeleneMusicalBrain, 
  getMusicalBrain,
  type BrainOutput,
  type BrainConfig,
} from './engines/musical'
import type { AudioAnalysis } from './engines/musical/types'

export interface SeleneConfig {
  audio: {
    device: string
    sensitivity: number
    noiseGate: number
    fftSize: number
    smoothing: number
  }
  visual: {
    transitionTime: number
    colorSmoothing: number
    movementSmoothing: number
    effectIntensity: number
  }
  dmx: {
    universe: number
    driver: string
    frameRate: number
  }
  // 🧠 WAVE-8: Configuración del Brain
  brain?: Partial<BrainConfig>
}

export interface SeleneState {
  mode: SeleneMode
  palette: LivingPaletteId
  colors: ColorOutput
  movement: MovementOutput
  beat: BeatState
  consciousness: ConsciousnessState
  stats: { frames: number; decisions: number; uptime: number }
  // 🧠 WAVE-8: Información del Brain
  brainOutput?: BrainOutput | null
  brainMode?: 'reactive' | 'intelligent'
  paletteSource?: 'memory' | 'procedural' | 'fallback' | 'legacy'
}

export class SeleneLux extends EventEmitter {
  private initialized = false
  private running = false
  private mode: SeleneMode = 'selene' // WAVE 13.6: Arrancar SIEMPRE en Selene (Intelligent mode)
  
  // Legacy engines (para compatibilidad gradual)
  private colorEngine: ColorEngine
  private movementEngine: MovementEngine
  private beatDetector: BeatDetector
  
  // 🧠 WAVE-8: El Cerebro Musical
  private brain: SeleneMusicalBrain
  private useBrain = true // Flag para activar/desactivar el Brain
  private brainInitialized = false
  
  // 🎨 WAVE 13.6: Multiplicadores Globales de Color (STATE OF TRUTH)
  private globalSaturation = 1.0  // 0-1, default 100%
  private globalIntensity = 1.0   // 0-1, default 100%
  
  private currentPalette: LivingPaletteId = 'fuego'
  private currentPattern: MusicalPattern | null = null
  private consciousness: ConsciousnessState
  
  private lastColors: ColorOutput | null = null
  private lastMovement: MovementOutput | null = null
  private lastBeat: BeatState | null = null
  private lastBrainOutput: BrainOutput | null = null
  
  private frameCount = 0
  private decisionCount = 0
  private startTime = 0
  
  constructor(config: SeleneConfig) {
    super()
    
    // Legacy engines (para compatibilidad)
    this.colorEngine = new ColorEngine({
      transitionTime: config.visual.transitionTime,
      colorSmoothing: config.visual.colorSmoothing,
      movementSmoothing: config.visual.movementSmoothing,
    })
    
    this.movementEngine = new MovementEngine({
      transitionTime: config.visual.transitionTime,
      colorSmoothing: config.visual.colorSmoothing,
      movementSmoothing: config.visual.movementSmoothing,
    })
    
    this.beatDetector = new BeatDetector({
      sampleRate: 44100,
      fftSize: config.audio.fftSize,
      smoothingTimeConstant: config.audio.smoothing,
      minBpm: 60,
      maxBpm: 180,
    })
    
    // 🧠 WAVE-8: Inicializar el Cerebro Musical
    this.brain = getMusicalBrain(config.brain)
    this.setupBrainEventListeners()
    
    this.consciousness = {
      generation: 1,
      status: 'awakening',
      totalExperiences: 0,
      totalPatternsDiscovered: 0,
      currentMood: 'peaceful',
      lastInsight: 'Selene Lux despertando...',
      beautyScore: 0.5,
      lineage: ['Genesis'],
    }
    
    this.initialized = true
    this.running = true
    this.startTime = Date.now()
    this.consciousness.status = 'learning'
    
    console.info('[SeleneLux] Initialized (WAVE-8 Brain Active)')
    this.emit('ready')
    
    // WAVE 13.6: Auto-inicializar el cerebro si arrancamos en modo Selene
    if (this.mode === 'selene') {
      this.initializeBrain().catch((err) => {
        console.warn('[SeleneLux] ⚠️ Auto brain init failed:', err)
      })
    }
  }
  
  /**
   * 🧠 Configura listeners de eventos del Brain
   */
  private setupBrainEventListeners(): void {
    this.brain.on('output', (output: BrainOutput) => {
      this.emit('brain-output', output)
    })
    
    this.brain.on('pattern-learned', (data) => {
      this.consciousness.totalPatternsDiscovered++
      this.consciousness.lastInsight = `Aprendí un nuevo patrón: ${data.patternHash?.slice(0, 8)}`
      this.emit('pattern-learned', data)
    })
    
    this.brain.on('mode-change', (data) => {
      this.emit('brain-mode-change', data)
    })
    
    this.brain.on('section-change', (data) => {
      this.emit('section-change', data)
    })
  }
  
  /**
   * 🧠 Inicializa el Brain (debe llamarse antes de procesar)
   */
  async initializeBrain(_dbPath?: string): Promise<void> {
    if (this.brainInitialized) return
    
    await this.brain.initialize()
    this.brainInitialized = true
    this.consciousness.status = 'wise'
    this.consciousness.lastInsight = 'Cerebro Musical conectado. Memoria activa.'
    
    console.info('[SeleneLux] 🧠 Brain initialized with memory')
    this.emit('brain-ready')
  }
  
  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * 🎯 PROCESO PRINCIPAL - Audio → Brain → Hardware
   * ═══════════════════════════════════════════════════════════════════════════
   */
  processAudioFrame(metrics: AudioMetrics, deltaTime: number): SeleneState {
    this.frameCount++
    this.emit('audio-frame', metrics)
    
    // Siempre procesar beat para compatibilidad
    const beatState = this.beatDetector.process(metrics)
    this.lastBeat = beatState
    
    // ─────────────────────────────────────────────────────────────────────────
    // 🧠 WAVE-8: FLUJO PRINCIPAL - Audio → Brain → Hardware
    // ─────────────────────────────────────────────────────────────────────────
    if (this.useBrain && this.brainInitialized) {
      // Convertir AudioMetrics a AudioAnalysis para el Brain
      const audioAnalysis = this.convertToAudioAnalysis(metrics, beatState)
      
      // El Brain procesa todo: contexto + memoria + paleta + mapeo
      const brainOutput = this.brain.process(audioAnalysis)
      this.lastBrainOutput = brainOutput
      
      // Convertir salida del Brain a colores RGB para hardware
      this.lastColors = this.brainOutputToColors(brainOutput)
      
      // 🌊 WAVE 12.5 DEBUG: Log de colores del Brain cada ~3 segundos
      if (this.frameCount % 100 === 0) {
        const p = brainOutput.palette.primary
        const c = this.lastColors.primary
        console.log(`[SeleneLux] 🎨 Brain HSL: H=${p.h.toFixed(0)} S=${p.s.toFixed(0)} L=${p.l.toFixed(0)} → RGB: ${c.r} ${c.g} ${c.b} | Energy=${metrics.energy.toFixed(2)} | Source=${brainOutput.paletteSource}`)
      }
      
      // El movimiento viene de la sugerencia del Brain
      this.lastMovement = this.brainOutputToMovement(brainOutput, deltaTime)
      
      // Actualizar consciencia con datos del Brain
      this.consciousness.beautyScore = brainOutput.estimatedBeauty
      this.consciousness.totalExperiences++
      
      if (brainOutput.mode === 'intelligent' && brainOutput.paletteSource === 'memory') {
        this.decisionCount++ // Usó su experiencia
      }
    } else {
      // ─────────────────────────────────────────────────────────────────────
      // LEGACY: Modo sin Brain (para compatibilidad)
      // ─────────────────────────────────────────────────────────────────────
      const colors = this.colorEngine.generate(metrics, beatState, this.currentPattern)
      this.lastColors = colors
      this.colorEngine.updateTransition(deltaTime)
      
      const movement = this.movementEngine.calculate(metrics, beatState, deltaTime)
      this.lastMovement = movement
      
      if (beatState.onBeat) {
        this.consciousness.totalExperiences++
      }
      this.decisionCount++
    }
    
    return this.getState()
  }
  
  /**
   * 🔄 Convierte AudioMetrics a AudioAnalysis (formato del Brain)
   */
  private convertToAudioAnalysis(metrics: AudioMetrics, beat: BeatState): AudioAnalysis {
    return {
      timestamp: metrics.timestamp,
      spectrum: {
        bass: metrics.bass,
        lowMid: (metrics.bass + metrics.mid) / 2,
        mid: metrics.mid,
        highMid: (metrics.mid + metrics.treble) / 2,
        treble: metrics.treble,
      },
      energy: {
        current: metrics.energy,
        average: metrics.energy,
        variance: Math.abs(metrics.energy - metrics.peak) * 0.5,
        trend: 'stable',
        peakRecent: metrics.peak,
      },
      beat: {
        detected: beat.onBeat,
        bpm: beat.bpm,
        confidence: beat.confidence,
        beatPhase: beat.phase,
        timeSinceLastBeat: Date.now() - beat.lastBeatTime,
      },
      transients: {
        bass: beat.kickDetected ? 1 : 0,
        mid: beat.snareDetected ? 0.5 : 0,
        treble: beat.hihatDetected ? 0.3 : 0,
      },
    }
  }
  
  /**
   * 🎨 Convierte BrainOutput a ColorOutput (para hardware)
   */
  private brainOutputToColors(output: BrainOutput): ColorOutput {
    const { palette, lighting } = output
    
    // Convertir HSL a RGB
    const primaryRGB = this.hslToRgb(palette.primary)
    const secondaryRGB = this.hslToRgb(palette.secondary)
    const accentRGB = this.hslToRgb(palette.accent)
    
    // 🪞 ESPEJO CROMÁTICO: Si hay ambient en la paleta, usarlo
    // Si no, crear una variación cálida del accent para coherencia visual
    let ambientRGB: { r: number; g: number; b: number }
    if (palette.ambient) {
      ambientRGB = this.hslToRgb(palette.ambient)
    } else {
      // Crear espejo cromático: variación más cálida del accent
      // Shift hacia magenta/rosa para complementar el accent
      ambientRGB = {
        r: Math.min(255, Math.round(accentRGB.r * 1.1)),
        g: Math.round(accentRGB.g * 0.85),
        b: Math.min(255, Math.round(accentRGB.b * 1.15)),
      }
    }
    
    // Obtener intensidad promedio de los fixtures
    const movingHeadParams = lighting.fixtures['moving_head']
    const avgIntensity = movingHeadParams ? movingHeadParams.intensity / 255 : 0.5
    
    // 🎨 WAVE 13.6: Aplicar multiplicadores globales
    const finalIntensity = avgIntensity * this.globalIntensity
    const finalSaturation = (palette.primary.s / 100) * this.globalSaturation
    
    return {
      primary: primaryRGB,
      secondary: secondaryRGB,
      accent: accentRGB,
      ambient: ambientRGB,
      intensity: finalIntensity,
      saturation: finalSaturation,
    }
  }
  
  /**
   * 🔄 Convierte HSL a RGB
   */
  private hslToRgb(hsl: { h: number; s: number; l: number }): { r: number; g: number; b: number } {
    const h = hsl.h / 360
    const s = hsl.s / 100
    const l = hsl.l / 100
    
    let r: number, g: number, b: number
    
    if (s === 0) {
      r = g = b = l
    } else {
      const hue2rgb = (p: number, q: number, t: number): number => {
        if (t < 0) t += 1
        if (t > 1) t -= 1
        if (t < 1/6) return p + (q - p) * 6 * t
        if (t < 1/2) return q
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
        return p
      }
      
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s
      const p = 2 * l - q
      r = hue2rgb(p, q, h + 1/3)
      g = hue2rgb(p, q, h)
      b = hue2rgb(p, q, h - 1/3)
    }
    
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
    }
  }
  
  /**
   * 🎯 Convierte BrainOutput a MovementOutput
   * WAVE 10: Ahora usa MovementEngine para posiciones dinámicas
   * Respeta los parámetros configurados por el UI (speed, range, pattern)
   */
  private brainOutputToMovement(output: BrainOutput, deltaTime: number): MovementOutput {
    // 🔥 WAVE 10 FIX: NO sobrescribir el pattern del UI
    // El pattern, speed y range se configuran desde MovementControl.tsx via IPC
    // Solo usamos el MovementEngine para calcular las posiciones
    
    // Usar lastBeat o crear uno por defecto
    const beatState = this.lastBeat || {
      bpm: 120,
      phase: 0,
      confidence: 0.5,
      onBeat: false,
      kickDetected: false,
      snareDetected: false,
      hihatDetected: false,
      beatCount: 0,
      lastBeatTime: Date.now(),
    }
    
    // Calcular movimiento real usando el engine (con los params del UI ya configurados)
    const calculatedMovement = this.movementEngine.calculate(
      {
        bass: 0.5,
        mid: 0.5,
        treble: 0.5,
        bpm: 120,
        beatConfidence: 0.7,
        onBeat: false,
        beatPhase: (Date.now() % 500) / 500,
        timestamp: Date.now(),
        energy: 0.6,
        peak: 0.7,
        frameIndex: this.frameCount,
      },
      beatState,
      deltaTime
    )
    
    return {
      pan: calculatedMovement.pan,
      tilt: calculatedMovement.tilt,
      speed: calculatedMovement.speed,
      pattern: calculatedMovement.pattern,
    }
  }
  
  /**
   * 🎛️ Activa/desactiva el uso del Brain
   */
  setUseBrain(enabled: boolean): void {
    this.useBrain = enabled
    console.info(`[SeleneLux] Brain ${enabled ? 'ENABLED' : 'DISABLED'}`)
    this.emit('brain-toggle', enabled)
  }
  
  /**
   * 📊 Obtiene estadísticas del Brain
   */
  getBrainStats(): { session: unknown; memory: unknown; hasMemory: boolean } | null {
    if (!this.brainInitialized) return null
    return {
      session: this.brain.getSessionStats(),
      memory: this.brain.getMemoryStats(),
      hasMemory: this.brain.hasMemory(),
    }
  }
  
  setPalette(palette: LivingPaletteId): void {
    this.currentPalette = palette
    this.colorEngine.setPalette(palette)
    console.info(`[SeleneLux] Palette changed to: ${palette}`)
  }
  
  setMovementPattern(pattern: MovementPattern): void {
    this.movementEngine.setPattern(pattern)
    console.info(`[SeleneLux] Movement pattern changed to: ${pattern}`)
  }
  
  // 🎯 WAVE 10: New methods for movement control
  setMovementSpeed(speed: number): void {
    this.movementEngine.setSpeed(speed)
    console.info(`[SeleneLux] Movement speed changed to: ${speed.toFixed(2)}`)
  }
  
  setMovementRange(range: number): void {
    this.movementEngine.setRange(range)
    console.info(`[SeleneLux] Movement range changed to: ${range.toFixed(2)}`)
  }
  
  setMode(mode: SeleneMode): void {
    this.mode = mode
    console.info(`[SeleneLux] Mode changed to: ${mode}`)
  }
  
  getState(): SeleneState {
    const defaultBeat: BeatState = {
      bpm: 120,
      confidence: 0,
      phase: 0,
      onBeat: false,
      beatCount: 0,
      lastBeatTime: 0,
      kickDetected: false,
      snareDetected: false,
      hihatDetected: false,
    }
    
    return {
      mode: this.mode,
      palette: this.currentPalette,
      colors: this.lastColors || {
        primary: { r: 255, g: 0, b: 0 },
        secondary: { r: 200, g: 50, b: 0 },
        accent: { r: 255, g: 100, b: 0 },
        ambient: { r: 150, g: 0, b: 50 },
        intensity: 0.5,
        saturation: 0.9,
      },
      movement: this.lastMovement || {
        pan: 0.5,
        tilt: 0.5,
        speed: 0.5,
        pattern: 'lissajous',
      },
      beat: this.lastBeat || defaultBeat,
      consciousness: { ...this.consciousness },
      stats: {
        frames: this.frameCount,
        decisions: this.decisionCount,
        uptime: Date.now() - this.startTime,
      },
      // 🧠 WAVE-8: Estado del Brain
      // 🔧 FIX CRÍTICO: brainMode debe reflejar el estado REAL de SeleneLux, no el del Brain
      brainOutput: this.lastBrainOutput,
      brainMode: this.useBrain && this.mode === 'selene' ? 'intelligent' : 'reactive',
      paletteSource: this.useBrain ? (this.lastBrainOutput?.paletteSource || 'legacy') : 'legacy',
    }
  }
  
  tickMovement(audioData: { energy: number; bass: number; mid: number; treble: number }, deltaTime: number, fixtureIds: string[]): FixtureMovement[] {
    return this.movementEngine.tick(audioData, deltaTime, fixtureIds)
  }
  
  isInitialized(): boolean {
    return this.initialized
  }
  
  isRunning(): boolean {
    return this.running
  }
  
  start(): void {
    this.running = true
    console.info('[SeleneLux] Started')
  }
  
  stop(): void {
    this.running = false
    console.info('[SeleneLux] Stopped')
  }
  
  /**
   * 🎨 WAVE 13.6: STATE OF TRUTH - Multiplicadores Globales de Color
   */
  setGlobalSaturation(value: number): void {
    this.globalSaturation = Math.max(0, Math.min(1, value))
    console.log(`[SeleneLux] 🎨 Global Saturation: ${(this.globalSaturation * 100).toFixed(0)}%`)
  }
  
  setGlobalIntensity(value: number): void {
    this.globalIntensity = Math.max(0, Math.min(1, value))
    console.log(`[SeleneLux] 💡 Global Intensity: ${(this.globalIntensity * 100).toFixed(0)}%`)
  }
  
  getGlobalColorParams(): { saturation: number; intensity: number } {
    return {
      saturation: this.globalSaturation,
      intensity: this.globalIntensity
    }
  }
  
  /**
   * 🔒 Cierra limpiamente Selene (incluyendo el Brain)
   */
  async shutdown(): Promise<void> {
    this.running = false
    
    if (this.brainInitialized) {
      await this.brain.shutdown()
      this.brainInitialized = false
      console.info('[SeleneLux] 🧠 Brain shutdown complete')
    }
    
    console.info('[SeleneLux] Shutdown complete')
    this.emit('shutdown')
  }
}
