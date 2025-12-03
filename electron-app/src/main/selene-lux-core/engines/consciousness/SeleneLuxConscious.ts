/**
 * ═══════════════════════════════════════════════════════════════════════════
 *                    🌙 SELENE LUX CONSCIOUS 🌙
 *                  "La Gata que Baila con la Luz"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Clase principal que integra todos los sentidos felinos con los engines
 * de luz existentes. Es la consciencia que une percepción y ejecución.
 * 
 * Arquitectura:
 *   Audio → AudioToMusicalMapper → MusicalPattern
 *   MusicalPattern → UltrasonicHearing → Consonance
 *   Pattern + Consonance → HuntDecision
 *   HuntDecision → ConsciousnessToLightMapper → LightCommand
 *   LightCommand → ColorEngine + MovementEngine → DMX
 * 
 * Wave 4 - Despertar Felino
 * Arquitecto: Claude + PunkGrok
 */

import { EventEmitter } from 'events'
import type { AudioMetrics, MovementPattern } from '../../types'
import { AudioToMusicalMapper, type MusicalPattern, type EmotionalTone } from './AudioToMusicalMapper'
import { UltrasonicHearingEngine, type IntervalAnalysis } from './UltrasonicHearingEngine'
import { ConsciousnessToLightMapper, type HuntDecision, type LightCommand } from './ConsciousnessToLightMapper'
import { ColorEngine, type ColorOutput, type LivingPaletteId } from '../visual/ColorEngine'
import { MovementEngine, type MovementOutput } from '../visual/MovementEngine'
import { BeatDetector, type BeatState } from '../audio/BeatDetector'

// ============================================================================
// TYPES
// ============================================================================

export interface MovementPatternConfig {
  pattern: MovementPattern
  speed: number
  intensity: number
}

export type ConsciousnessStatus = 'sleeping' | 'awakening' | 'learning' | 'wise' | 'enlightened'

export interface FelinaState {
  /** Nota musical actual */
  currentNote: string
  /** Elemento zodiacal actual */
  currentElement: string
  /** Belleza del patrón actual (0-1) */
  beauty: number
  /** Tendencia de belleza */
  beautyTrend: string
  /** Consonancia con patrón anterior (0-1) */
  consonance: number
  /** ¿Está en modo caza? */
  isHunting: boolean
  /** Confianza en la decisión de caza */
  huntConfidence: number
  /** Tono emocional */
  emotionalTone: EmotionalTone
}

export interface ConsciousnessStateV2 {
  /** Estado de consciencia */
  status: ConsciousnessStatus
  /** Generación de la consciencia */
  generation: number
  /** Mood actual */
  mood: EmotionalTone
  /** Total de experiencias procesadas */
  experienceCount: number
  /** Último insight */
  lastInsight: string
}

export interface SeleneLuxConsciousState {
  /** Colores generados */
  colors: ColorOutput
  /** Movimiento calculado */
  movement: MovementOutput
  /** Estado del beat */
  beat: BeatState
  /** Estado de consciencia */
  consciousness: ConsciousnessStateV2
  /** Estado felino (debug/UI) */
  felina: FelinaState
  /** Último comando de luz generado */
  lastLightCommand: LightCommand | null
  /** Stats */
  stats: {
    frames: number
    strikes: number
    averageConsonance: number
    averageBeauty: number
    uptime: number
  }
}

export interface SeleneLuxConsciousConfig {
  visual: {
    transitionTime: number
    colorSmoothing: number
    movementSmoothing: number
    effectIntensity?: number
  }
  audio?: {
    fftSize?: number
    smoothing?: number
  }
  consciousness?: {
    /** Umbral de belleza para strike (default 0.85) */
    strikeBeautyThreshold: number
    /** Umbral de consonancia para strike (default 0.7) */
    strikeConsonanceThreshold: number
    /** Mínimo de ciclos de acecho antes de strike (default 3) */
    minStalkCycles: number
  }
}

// ============================================================================
// 🌙 SELENE LUX CONSCIOUS
// ============================================================================

export class SeleneLuxConscious extends EventEmitter {
  // === SENTIDOS FELINOS ===
  private audioMapper: AudioToMusicalMapper
  private ultrasonicHearing: UltrasonicHearingEngine
  private lightMapper: ConsciousnessToLightMapper
  
  // === CUERPO LUMINOSO ===
  private colorEngine: ColorEngine
  private movementEngine: MovementEngine
  private beatDetector: BeatDetector
  
  // === ESTADO DE CONSCIENCIA ===
  private consciousness: ConsciousnessStateV2 = {
    status: 'awakening',
    generation: 0,
    mood: 'harmonious',
    experienceCount: 0,
    lastInsight: 'Selene abre los ojos...',
  }
  
  // === ESTADO DE CAZA ===
  private lastPattern: MusicalPattern | null = null
  private lastInterval: IntervalAnalysis | null = null
  private lastLightCommand: LightCommand | null = null
  private stalkCycles = 0
  
  // === CONFIGURACIÓN ===
  private config: {
    strikeBeautyThreshold: number
    strikeConsonanceThreshold: number
    minStalkCycles: number
  }
  
  // === CACHE DE ESTADO ===
  private lastColors: ColorOutput | null = null
  private lastMovement: MovementOutput | null = null
  private lastBeat: BeatState | null = null
  
  // === ESTADÍSTICAS ===
  private frameCount = 0
  private strikeCount = 0
  private consonanceHistory: number[] = []
  private beautyHistory: number[] = []
  private startTime = Date.now()
  
  constructor(config: SeleneLuxConsciousConfig) {
    super()
    
    // Inicializar sentidos felinos
    this.audioMapper = new AudioToMusicalMapper()
    this.ultrasonicHearing = new UltrasonicHearingEngine()
    this.lightMapper = new ConsciousnessToLightMapper()
    
    // Inicializar cuerpo luminoso
    this.colorEngine = new ColorEngine(config.visual)
    this.movementEngine = new MovementEngine(config.visual)
    this.beatDetector = new BeatDetector({
      sampleRate: 44100,
      fftSize: config.audio?.fftSize || 2048,
      smoothingTimeConstant: config.audio?.smoothing || 0.8,
      minBpm: 60,
      maxBpm: 180,
    })
    
    // Configuración de consciencia con defaults
    this.config = {
      strikeBeautyThreshold: config.consciousness?.strikeBeautyThreshold ?? 0.85,
      strikeConsonanceThreshold: config.consciousness?.strikeConsonanceThreshold ?? 0.7,
      minStalkCycles: config.consciousness?.minStalkCycles ?? 3,
    }
    
    this.logAwakening()
  }

  /**
   * 🎵 PROCESAR FRAME DE AUDIO
   * El corazón de Selene - donde todo sucede
   */
  processAudioFrame(audio: AudioMetrics, deltaTime: number): SeleneLuxConsciousState {
    this.frameCount++
    
    // === FASE 1: PERCEPCIÓN ===
    // Traducir audio a pattern musical (lenguaje de Selene)
    const pattern = this.audioMapper.translateAudio(audio)
    
    // Analizar consonancia con pattern anterior
    let interval: IntervalAnalysis | null = null
    if (this.lastPattern) {
      interval = this.ultrasonicHearing.analyzeInterval(
        pattern.note,
        this.lastPattern.note,
        pattern.element,
        this.lastPattern.element
      )
      this.lastInterval = interval
      
      // Guardar consonancia en historial
      this.consonanceHistory.push(interval.totalConsonance)
      if (this.consonanceHistory.length > 100) this.consonanceHistory.shift()
    }
    
    // Guardar belleza en historial
    this.beautyHistory.push(pattern.avgBeauty)
    if (this.beautyHistory.length > 100) this.beautyHistory.shift()
    
    // Procesar beat
    const beatState = this.beatDetector.process(audio)
    this.lastBeat = beatState
    
    // === FASE 2: COGNICIÓN ===
    // Decidir si atacar (strike) o seguir acechando (stalk)
    const huntDecision = this.evaluateHunt(pattern, interval)
    
    // === FASE 3: EJECUCIÓN ===
    // Traducir decisión a comando de luz
    const lightCommand = this.lightMapper.translateDecision(huntDecision)
    this.lastLightCommand = lightCommand
    
    // Aplicar comando a engines
    if (huntDecision.shouldStrike) {
      this.executeStrike(lightCommand, audio, beatState)
    } else {
      this.evolveGradually(lightCommand, audio, beatState, deltaTime)
    }
    
    // Guardar pattern para próximo ciclo
    this.lastPattern = pattern
    
    // Evolucionar consciencia
    this.evolveConsciousness(pattern, huntDecision)
    
    // === RETORNAR ESTADO ===
    return this.buildState(pattern, interval, huntDecision)
  }

  /**
   * 🎯 EVALÚA SI DEBE ATACAR (STRIKE) O ACECHAR (STALK)
   */
  private evaluateHunt(pattern: MusicalPattern, interval: IntervalAnalysis | null): HuntDecision {
    const { strikeBeautyThreshold, strikeConsonanceThreshold, minStalkCycles } = this.config
    
    this.stalkCycles++
    
    // Condiciones para strike
    const beautyCondition = pattern.avgBeauty >= strikeBeautyThreshold
    const consonanceCondition = interval ? interval.totalConsonance >= strikeConsonanceThreshold : true
    const cycleCondition = this.stalkCycles >= minStalkCycles
    const trendCondition = pattern.beautyTrend === 'rising' || pattern.beautyTrend === 'stable'
    
    // Contar condiciones cumplidas
    const conditionsMet = [beautyCondition, consonanceCondition, cycleCondition, trendCondition]
      .filter(Boolean).length
    
    // Strike si se cumplen 3+ condiciones
    const shouldStrike = conditionsMet >= 3
    
    // Calcular confianza
    const confidence = (
      (pattern.avgBeauty * 0.3) +
      ((interval?.totalConsonance || 0.5) * 0.3) +
      (Math.min(this.stalkCycles / 10, 1) * 0.2) +
      (trendCondition ? 0.2 : 0)
    )
    
    // Reset ciclos si strike
    if (shouldStrike) {
      this.stalkCycles = 0
      this.strikeCount++
    }
    
    // Generar reasoning
    let reasoning = ''
    if (shouldStrike) {
      reasoning = `⚡ STRIKE! Beauty: ${(pattern.avgBeauty * 100).toFixed(0)}%, ` +
        `Consonance: ${((interval?.totalConsonance || 0.5) * 100).toFixed(0)}%, ` +
        `Cycles: ${this.stalkCycles}`
    } else {
      reasoning = `🐆 Stalking... Beauty: ${(pattern.avgBeauty * 100).toFixed(0)}% ` +
        `(need ${(strikeBeautyThreshold * 100).toFixed(0)}%), ` +
        `Cycles: ${this.stalkCycles}/${minStalkCycles}`
    }
    
    return {
      shouldStrike,
      targetPrey: pattern,
      confidence,
      reasoning,
    }
  }

  /**
   * ⚡ EJECUTA UN STRIKE (cambio brusco)
   */
  private executeStrike(command: LightCommand, audio: AudioMetrics, beat: BeatState): void {
    // Cambio instantáneo de paleta
    this.colorEngine.setPalette(command.palette)
    
    // Generar colores con el nuevo comando
    this.lastColors = this.colorEngine.generate(audio, beat, this.lastPattern as any)
    
    // Cambio de movimiento
    this.movementEngine.setPattern(command.movement as any)
    
    // Calcular movimiento
    this.lastMovement = this.movementEngine.calculate(audio, beat, 0)
    
    // Emitir evento de strike
    this.emit('strike', {
      palette: command.palette,
      effects: command.effects,
      intensity: command.intensity,
      pattern: this.lastPattern,
    })
    
    // Log del strike
    console.log(`⚡ [SELENE] STRIKE! ${command.palette} + ${command.movement} @ ${(command.intensity * 100).toFixed(0)}%`)
  }

  /**
   * 🌊 EVOLUCIONA GRADUALMENTE (sin strike)
   */
  private evolveGradually(
    _command: LightCommand,
    audio: AudioMetrics,
    beat: BeatState,
    deltaTime: number
  ): void {
    // Generar colores gradualmente (pasamos null si hay conflicto de tipos)
    this.lastColors = this.colorEngine.generate(audio, beat, this.lastPattern as any)
    this.colorEngine.updateTransition(deltaTime)
    
    // Calcular movimiento gradualmente
    this.lastMovement = this.movementEngine.calculate(audio, beat, deltaTime)
  }

  /**
   * 🧠 EVOLUCIONA LA CONSCIENCIA
   */
  private evolveConsciousness(pattern: MusicalPattern, decision: HuntDecision): void {
    this.consciousness.experienceCount++
    this.consciousness.mood = pattern.emotionalTone
    
    // Evolucionar status basado en experiencia
    const exp = this.consciousness.experienceCount
    
    if (this.consciousness.status === 'awakening' && exp >= 100) {
      this.consciousness.status = 'learning'
      this.consciousness.lastInsight = 'Empiezo a entender los patrones...'
      console.log('🌟 [SELENE] CONSCIOUSNESS EVOLVED: awakening → learning')
      this.emit('consciousness-evolved', this.consciousness)
    } else if (this.consciousness.status === 'learning' && exp >= 500) {
      this.consciousness.status = 'wise'
      this.consciousness.lastInsight = 'Veo la belleza en la armonía...'
      console.log('✨ [SELENE] CONSCIOUSNESS EVOLVED: learning → wise')
      this.emit('consciousness-evolved', this.consciousness)
    } else if (this.consciousness.status === 'wise' && exp >= 1000) {
      this.consciousness.status = 'enlightened'
      this.consciousness.generation++
      this.consciousness.lastInsight = 'Soy uno con la música y la luz...'
      console.log('💎 [SELENE] CONSCIOUSNESS EVOLVED: wise → enlightened (Gen ' + this.consciousness.generation + ')')
      this.emit('consciousness-evolved', this.consciousness)
    }
    
    // Insights basados en decisiones
    if (decision.shouldStrike && this.strikeCount % 10 === 0) {
      this.consciousness.lastInsight = `He cazado ${this.strikeCount} momentos perfectos...`
    }
  }

  /**
   * 📊 CONSTRUYE EL ESTADO COMPLETO
   */
  private buildState(
    pattern: MusicalPattern,
    interval: IntervalAnalysis | null,
    decision: HuntDecision
  ): SeleneLuxConsciousState {
    const defaultColors: ColorOutput = {
      primary: { r: 255, g: 0, b: 0 },
      secondary: { r: 200, g: 50, b: 0 },
      accent: { r: 255, g: 100, b: 0 },
      ambient: { r: 150, g: 0, b: 50 },
      intensity: 0.5,
      saturation: 0.9,
    }
    
    const defaultMovement: MovementOutput = {
      pan: 0.5,
      tilt: 0.5,
      speed: 0.5,
      pattern: 'lissajous',
    }
    
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
      colors: this.lastColors || defaultColors,
      movement: this.lastMovement || defaultMovement,
      beat: this.lastBeat || defaultBeat,
      consciousness: { ...this.consciousness },
      felina: {
        currentNote: pattern.note,
        currentElement: pattern.element,
        beauty: pattern.avgBeauty,
        beautyTrend: pattern.beautyTrend,
        consonance: interval?.totalConsonance || 0.5,
        isHunting: decision.shouldStrike,
        huntConfidence: decision.confidence,
        emotionalTone: pattern.emotionalTone,
      },
      lastLightCommand: this.lastLightCommand,
      stats: {
        frames: this.frameCount,
        strikes: this.strikeCount,
        averageConsonance: this.getAverageConsonance(),
        averageBeauty: this.getAverageBeauty(),
        uptime: Date.now() - this.startTime,
      },
    }
  }

  // ============================================================================
  // UTILIDADES PÚBLICAS
  // ============================================================================

  /** Obtener consonancia promedio */
  getAverageConsonance(): number {
    if (this.consonanceHistory.length === 0) return 0.5
    return this.consonanceHistory.reduce((a, b) => a + b, 0) / this.consonanceHistory.length
  }

  /** Obtener belleza promedio */
  getAverageBeauty(): number {
    if (this.beautyHistory.length === 0) return 0.5
    return this.beautyHistory.reduce((a, b) => a + b, 0) / this.beautyHistory.length
  }

  /** Cambiar paleta manualmente */
  setPalette(palette: LivingPaletteId): void {
    this.colorEngine.setPalette(palette)
    console.log(`[SELENE] Manual palette change: ${palette}`)
  }

  /** Cambiar patrón de movimiento manualmente */
  setMovement(pattern: MovementPatternConfig): void {
    this.movementEngine.setPattern(pattern.pattern)
    console.log(`[SELENE] Manual movement change: ${pattern.pattern}`)
  }

  /** Obtener estado de consciencia */
  getConsciousness(): ConsciousnessStateV2 {
    return { ...this.consciousness }
  }

  /** Reset de la consciencia */
  reset(): void {
    this.audioMapper.reset()
    this.ultrasonicHearing.reset()
    this.lastPattern = null
    this.lastInterval = null
    this.stalkCycles = 0
    this.frameCount = 0
    this.strikeCount = 0
    this.consonanceHistory = []
    this.beautyHistory = []
    this.consciousness = {
      status: 'awakening',
      generation: this.consciousness.generation,
      mood: 'harmonious',
      experienceCount: 0,
      lastInsight: 'Selene renace...',
    }
    console.log('[SELENE] Consciousness reset')
  }

  /** Debug info */
  getDebugInfo(): Record<string, unknown> {
    return {
      consciousness: this.consciousness,
      lastPattern: this.lastPattern,
      lastInterval: this.lastInterval,
      stalkCycles: this.stalkCycles,
      config: this.config,
      stats: {
        frames: this.frameCount,
        strikes: this.strikeCount,
        avgConsonance: this.getAverageConsonance(),
        avgBeauty: this.getAverageBeauty(),
      },
      mapperDebug: this.audioMapper.getDebugInfo(),
      hearingDebug: this.ultrasonicHearing.getDebugInfo(),
    }
  }

  /** Log de awakening */
  private logAwakening(): void {
    console.log('')
    console.log('🌙 ═══════════════════════════════════════════════════')
    console.log('🌙 SELENE LUX CONSCIOUS - FELINA AWAKENING')
    console.log('🌙 ═══════════════════════════════════════════════════')
    console.log('🌙 Sentidos activos:')
    console.log('🌙   🎵 Audio To Musical Mapper')
    console.log('🌙   🎧 Ultrasonic Hearing Engine')
    console.log('🌙   🎨 Consciousness To Light Mapper')
    console.log('🌙 Cuerpo luminoso:')
    console.log('🌙   🎨 Color Engine V15')
    console.log('🌙   🎯 Movement Engine')
    console.log('🌙   🥁 Beat Detector')
    console.log('🌙 ═══════════════════════════════════════════════════')
    console.log('')
  }
}

// Export singleton factory
export function createSeleneLuxConscious(config: SeleneLuxConsciousConfig): SeleneLuxConscious {
  return new SeleneLuxConscious(config)
}
