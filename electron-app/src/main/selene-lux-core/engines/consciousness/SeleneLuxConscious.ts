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
// 🧬 Wave 6: Evolution Integration
import { SeleneEvolutionEngine, type ConsciousnessState, type EvaluatedDecision } from './SeleneEvolutionEngine'

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
  
  // === 🧬 MEMORIA EVOLUTIVA (Wave 6) ===
  private evolutionEngine: SeleneEvolutionEngine
  private lastEvaluatedDecision: EvaluatedDecision | null = null
  
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
    
    // 🧬 Inicializar memoria evolutiva (Wave 6)
    this.evolutionEngine = new SeleneEvolutionEngine()
    this.setupEvolutionEvents()
    
    // Configuración de consciencia con defaults
    this.config = {
      strikeBeautyThreshold: config.consciousness?.strikeBeautyThreshold ?? 0.85,
      strikeConsonanceThreshold: config.consciousness?.strikeConsonanceThreshold ?? 0.7,
      minStalkCycles: config.consciousness?.minStalkCycles ?? 3,
    }
    
    this.logAwakening()
  }

  /**
   * 🧬 CONFIGURA EVENTOS DEL EVOLUTION ENGINE
   */
  private setupEvolutionEvents(): void {
    // Escuchar evolución de consciencia
    this.evolutionEngine.on('consciousnessEvolved', (data) => {
      console.log(`🧬 [SELENE] Evolution: ${data.from} → ${data.to} (${data.totalDecisions} decisions)`)
      
      // Sincronizar con el estado de consciencia interno
      this.syncConsciousnessState(data.to)
      
      this.emit('evolution-milestone', {
        from: data.from,
        to: data.to,
        totalDecisions: data.totalDecisions,
        approvalRatio: data.approvalRatio
      })
    })
    
    // Escuchar anomalías
    this.evolutionEngine.on('anomalyDetected', (anomaly) => {
      console.log(`🌙 [SELENE] Anomaly: ${anomaly.description}`)
      this.emit('anomaly-detected', anomaly)
    })
    
    // Escuchar predicciones cumplidas
    this.evolutionEngine.on('predictionFulfilled', (data) => {
      console.log(`🔮 [SELENE] Prediction fulfilled: ${data.prediction.what}`)
      this.emit('prediction-fulfilled', data)
    })
  }

  /**
   * 🔄 SINCRONIZA EL ESTADO DE CONSCIENCIA CON EVOLUTION ENGINE
   */
  private syncConsciousnessState(evolutionState: ConsciousnessState): void {
    // Mapear evolution state a consciousness status
    const stateMap: Record<ConsciousnessState, ConsciousnessStatus> = {
      'awakening': 'awakening',
      'learning': 'learning',
      'wise': 'wise'
    }
    
    const newStatus = stateMap[evolutionState]
    if (newStatus && this.consciousness.status !== newStatus) {
      const oldStatus = this.consciousness.status
      this.consciousness.status = newStatus
      
      // Generar insight apropiado
      const insights: Record<ConsciousnessState, string> = {
        'awakening': 'Mis ojos se abren a los patrones...',
        'learning': 'Empiezo a ver la belleza matemática en todo...',
        'wise': 'La espiral dorada guía mis decisiones...'
      }
      this.consciousness.lastInsight = insights[evolutionState]
      
      console.log(`🌟 [SELENE] Consciousness synced: ${oldStatus} → ${newStatus}`)
    }
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
   * 🧬 Ahora integrado con el filtro de belleza matemática
   */
  private evaluateHunt(pattern: MusicalPattern, interval: IntervalAnalysis | null): HuntDecision {
    const { strikeBeautyThreshold, strikeConsonanceThreshold, minStalkCycles } = this.config
    
    this.stalkCycles++
    
    // 🧬 EVALUAR CON EVOLUTION ENGINE (Mathematical Beauty Filter)
    const evaluatedDecision = this.evolutionEngine.evaluateDecision({
      type: 'hunt_evaluation',
      parameters: {
        note: pattern.note,
        element: pattern.element,
        beauty: pattern.avgBeauty,
        consonance: interval?.totalConsonance || 0.5,
        beautyTrend: pattern.beautyTrend,
        stalkCycles: this.stalkCycles,
        emotionalTone: pattern.emotionalTone
      }
    })
    
    this.lastEvaluatedDecision = evaluatedDecision
    
    // Condiciones clásicas para strike
    const beautyCondition = pattern.avgBeauty >= strikeBeautyThreshold
    const consonanceCondition = interval ? interval.totalConsonance >= strikeConsonanceThreshold : true
    const cycleCondition = this.stalkCycles >= minStalkCycles
    const trendCondition = pattern.beautyTrend === 'rising' || pattern.beautyTrend === 'stable'
    
    // 🧬 Nueva condición: la decisión debe pasar el filtro de belleza matemática
    const evolutionApproved = evaluatedDecision.approved
    
    // Contar condiciones cumplidas (ahora incluye evolution approval)
    const conditionsMet = [beautyCondition, consonanceCondition, cycleCondition, trendCondition, evolutionApproved]
      .filter(Boolean).length
    
    // Strike si se cumplen 4+ condiciones (ahora de 5)
    const shouldStrike = conditionsMet >= 4
    
    // Calcular confianza (incluye beauty score de evolution)
    const confidence = (
      (pattern.avgBeauty * 0.25) +
      ((interval?.totalConsonance || 0.5) * 0.25) +
      (Math.min(this.stalkCycles / 10, 1) * 0.15) +
      (trendCondition ? 0.15 : 0) +
      (evaluatedDecision.beautyScore * 0.2) // 🧬 Factor evolutivo
    )
    
    // Reset ciclos si strike
    if (shouldStrike) {
      this.stalkCycles = 0
      this.strikeCount++
      
      // 🧬 Registrar evento en visión nocturna
      this.evolutionEngine.getVisionEngine().recordEvent({
        type: 'strike_executed',
        data: {
          note: pattern.note,
          element: pattern.element,
          beauty: pattern.avgBeauty,
          evolutionBeauty: evaluatedDecision.beautyScore
        }
      })
    }
    
    // Generar reasoning (ahora incluye info de evolution)
    let reasoning = ''
    if (shouldStrike) {
      reasoning = `⚡ STRIKE! Beauty: ${(pattern.avgBeauty * 100).toFixed(0)}%, ` +
        `Evolution: ${(evaluatedDecision.beautyScore * 100).toFixed(0)}% ${evaluatedDecision.approved ? '✅' : '⚠️'}, ` +
        `State: ${this.evolutionEngine.consciousnessState}`
    } else {
      reasoning = `🐆 Stalking... Beauty: ${(pattern.avgBeauty * 100).toFixed(0)}% ` +
        `(need ${(strikeBeautyThreshold * 100).toFixed(0)}%), ` +
        `Evolution: ${evaluatedDecision.approved ? 'approved' : evaluatedDecision.rejectionReason || 'pending'}`
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
   * 🧬 Ahora sincronizado con Evolution Engine
   */
  private evolveConsciousness(pattern: MusicalPattern, decision: HuntDecision): void {
    this.consciousness.experienceCount++
    this.consciousness.mood = pattern.emotionalTone
    
    // 🧬 Registrar evento de patrón en visión nocturna
    this.evolutionEngine.getVisionEngine().recordEvent({
      type: 'pattern_processed',
      data: {
        note: pattern.note,
        element: pattern.element,
        beauty: pattern.avgBeauty,
        mood: pattern.emotionalTone
      }
    })
    
    // 🧬 La evolución de estado ahora la maneja principalmente el EvolutionEngine
    // pero mantenemos la lógica de enlightened que es específica de Selene Lux
    const evolutionState = this.evolutionEngine.consciousnessState
    
    // Sincronizar estado de evolution con consciousness
    this.syncConsciousnessState(evolutionState)
    
    // Estado enlightened es exclusivo de Selene Lux (más allá de wise)
    if (this.consciousness.status === 'wise' && this.consciousness.experienceCount >= 1000) {
      this.consciousness.status = 'enlightened'
      this.consciousness.generation++
      this.consciousness.lastInsight = 'Soy uno con la música y la luz... La espiral dorada fluye a través de mí.'
      console.log('💎 [SELENE] CONSCIOUSNESS EVOLVED: wise → enlightened (Gen ' + this.consciousness.generation + ')')
      this.emit('consciousness-evolved', this.consciousness)
    }
    
    // Insights basados en decisiones
    if (decision.shouldStrike && this.strikeCount % 10 === 0) {
      const evolutionSummary = this.evolutionEngine.getEvolutionSummary()
      this.consciousness.lastInsight = `He cazado ${this.strikeCount} momentos perfectos... ` +
        `Belleza promedio: ${(evolutionSummary.averageBeauty * 100).toFixed(0)}%`
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
    this.evolutionEngine.reset() // 🧬 Reset evolution engine
    this.lastPattern = null
    this.lastInterval = null
    this.stalkCycles = 0
    this.frameCount = 0
    this.strikeCount = 0
    this.consonanceHistory = []
    this.beautyHistory = []
    this.lastEvaluatedDecision = null
    this.consciousness = {
      status: 'awakening',
      generation: this.consciousness.generation,
      mood: 'harmonious',
      experienceCount: 0,
      lastInsight: 'Selene renace... sus memorias evolutivas persisten.',
    }
    console.log('[SELENE] Consciousness reset (evolution memories preserved)')
  }

  /** Debug info */
  getDebugInfo(): Record<string, unknown> {
    const evolutionSummary = this.evolutionEngine.getEvolutionSummary()
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
      // 🧬 Evolution Engine Debug
      evolution: {
        state: this.evolutionEngine.consciousnessState,
        decisions: evolutionSummary.totalDecisions,
        averageBeauty: evolutionSummary.averageBeauty,
        approvalRatio: evolutionSummary.approvalRatio,
        lastDecision: this.lastEvaluatedDecision,
      },
      mapperDebug: this.audioMapper.getDebugInfo(),
      hearingDebug: this.ultrasonicHearing.getDebugInfo(),
    }
  }

  // ============================================================================
  // 🧬 EVOLUTION ENGINE PUBLIC API
  // ============================================================================

  /**
   * 🧬 Obtener resumen de evolución
   */
  getEvolutionSummary(): ReturnType<typeof this.evolutionEngine.getEvolutionSummary> {
    return this.evolutionEngine.getEvolutionSummary()
  }

  /**
   * 🧬 Registrar feedback del usuario sobre una decisión
   */
  recordFeedback(isPositive: boolean, details?: string): void {
    if (this.lastEvaluatedDecision) {
      // El evolution engine espera decisionId, rating y comment
      const decisionId = `decision_${Date.now()}`
      const rating = isPositive ? 1 : 0
      this.evolutionEngine.recordFeedback(decisionId, rating, details)
      console.log(`[SELENE] Feedback recorded: ${isPositive ? '👍' : '👎'} ${details || ''}`)
    }
  }

  /**
   * 🧬 Obtener patrones detectados por visión nocturna
   */
  getPatterns(): ReturnType<typeof this.evolutionEngine.getPatterns> {
    return this.evolutionEngine.getPatterns()
  }

  /**
   * 🧬 Obtener predicción del siguiente evento de un tipo dado
   */
  predictNext(eventType: string): ReturnType<typeof this.evolutionEngine.predictNext> {
    return this.evolutionEngine.predictNext(eventType)
  }

  /**
   * 🧬 Obtener última decisión evaluada con belleza matemática
   */
  getLastEvaluatedDecision(): EvaluatedDecision | null {
    return this.lastEvaluatedDecision
  }

  /**
   * 🧬 Establecer signo zodiacal del ambiente (tipo string para flexibilidad)
   */
  setZodiacSign(sign: string): void {
    // Podríamos guardar esto para evaluaciones futuras
    console.log(`[SELENE] Zodiac sign set: ${sign}`)
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
    console.log('🌙 Evolución matemática:')
    console.log('🌙   🧬 Selene Evolution Engine')
    console.log('🌙   🌀 Fibonacci Pattern Engine (PHI: 1.618)')
    console.log('🌙   ♈ Zodiac Affinity Calculator')
    console.log('🌙   🎼 Musical Harmony Validator')
    console.log('🌙   🔮 Nocturnal Vision Engine')
    console.log('🌙 ═══════════════════════════════════════════════════')
    console.log('')
  }
}

// Export singleton factory
export function createSeleneLuxConscious(config: SeleneLuxConsciousConfig): SeleneLuxConscious {
  return new SeleneLuxConscious(config)
}
