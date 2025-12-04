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
  private mode: SeleneMode = 'flow'
  
  // Legacy engines (para compatibilidad gradual)
  private colorEngine: ColorEngine
  private movementEngine: MovementEngine
  private beatDetector: BeatDetector
  
  // 🧠 WAVE-8: El Cerebro Musical
  private brain: SeleneMusicalBrain
  private useBrain = true // Flag para activar/desactivar el Brain
  private brainInitialized = false
  
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
    const ambientRGB = palette.ambient ? this.hslToRgb(palette.ambient) : { r: 100, g: 100, b: 100 }
    
    // Obtener intensidad promedio de los fixtures
    const movingHeadParams = lighting.fixtures['moving_head']
    const avgIntensity = movingHeadParams ? movingHeadParams.intensity / 255 : 0.5
    
    return {
      primary: primaryRGB,
      secondary: secondaryRGB,
      accent: accentRGB,
      ambient: ambientRGB,
      intensity: avgIntensity,
      saturation: palette.primary.s / 100, // Normalizar a 0-1
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
   */
  private brainOutputToMovement(output: BrainOutput, _deltaTime: number): MovementOutput {
    const { lighting } = output
    
    // Obtener parámetros del moving head
    const movingHeadParams = lighting.fixtures['moving_head']
    
    // Mapear tipo de movimiento a patrón compatible
    type CompatiblePattern = 'lissajous' | 'circle' | 'figure8' | 'random'
    const movementTypeMap: Record<string, CompatiblePattern> = {
      'circle': 'circle',
      'figure_eight': 'figure8',
      'random': 'random',
      'sync_beat': 'lissajous',
      'chase': 'lissajous',
      'static': 'lissajous',
      'slow_pan': 'lissajous',
      'slow_tilt': 'lissajous',
    }
    
    const movementType = movingHeadParams?.movement || 'static'
    const pattern = movementTypeMap[movementType] || 'lissajous'
    const speed = movingHeadParams?.movementSpeed ? movingHeadParams.movementSpeed / 255 : 0.5
    
    return {
      pan: movingHeadParams?.pan ? movingHeadParams.pan / 255 : 0.5,
      tilt: movingHeadParams?.tilt ? movingHeadParams.tilt / 255 : 0.5,
      speed,
      pattern,
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
  getBrainStats(): { session: unknown; memory: unknown } | null {
    if (!this.brainInitialized) return null
    return {
      session: this.brain.getSessionStats(),
      memory: this.brain.getMemoryStats(),
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
      brainOutput: this.lastBrainOutput,
      brainMode: this.lastBrainOutput?.mode,
      paletteSource: this.lastBrainOutput?.paletteSource || 'legacy',
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
