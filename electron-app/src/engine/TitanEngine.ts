/**
 * ⚡ WAVE 217: TITAN ENGINE
 * 🧠 WAVE 271: SYNAPTIC RESURRECTION
 * 
 * Motor de iluminación reactiva PURO. No conoce DMX ni hardware.
 * Recibe MusicalContext del Cerebro → Devuelve LightingIntent al HAL.
 * 
 * FILOSOFÍA:
 * - Este motor es AUTÓNOMO: no depende de Workers, lastColors, ni trinityData
 * - Solo calcula QUÉ queremos expresar, no CÓMO se hace en hardware
 * - Los Vibes definen las restricciones, el motor las respeta
 * 
 * 🧠 WAVE 271: STABILIZATION LAYER
 * - KeyStabilizer: Buffer 12s, locking 10s - evita cambios frenéticos de Key
 * - EnergyStabilizer: Rolling 2s, DROP FSM - suaviza energía, detecta drops
 * - MoodArbiter: Buffer 10s, locking 5s - BRIGHT/DARK/NEUTRAL estables
 * - StrategyArbiter: Rolling 15s, locking 15s - Analogous/Complementary estable
 * 
 * @layer ENGINE (Motor)
 * @version TITAN 2.0 + WAVE 271
 */

import { EventEmitter } from 'events'
import {
  LightingIntent,
  ColorPalette,
  MovementIntent,
  ZoneIntentMap,
  EffectIntent,
  createDefaultLightingIntent,
  withHex,
} from '../core/protocol/LightingIntent'
import { MusicalContext } from '../core/protocol/MusicalContext'
import { SeleneColorEngine, ExtendedAudioAnalysis, SelenePalette } from './color/SeleneColorEngine'
import { getColorConstitution } from './color/colorConstitutions'
import { VibeManager } from './vibe/VibeManager'
import type { VibeId, VibeProfile } from '../types/VibeProfile'

// 🧠 WAVE 271: SYNAPTIC RESURRECTION - Stabilization Layer
import { KeyStabilizer, KeyInput, KeyOutput } from './color/KeyStabilizer'
import { EnergyStabilizer, EnergyOutput } from './color/EnergyStabilizer'
import { MoodArbiter, MoodArbiterInput, MoodArbiterOutput, MetaEmotion } from './color/MoodArbiter'
import { StrategyArbiter, StrategyArbiterInput, StrategyArbiterOutput, ColorStrategy } from './color/StrategyArbiter'

// ⚡ WAVE 274: ORGAN HARVEST - Sistema Nervioso (Reactivo a Género)
import { SeleneLux } from '../core/reactivity'
import { getModifiersFromKey } from './physics/ElementalModifiers'

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS INTERNOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Métricas de audio normalizadas para el motor
 */
export interface EngineAudioMetrics {
  bass: number        // 0-1 normalizado
  mid: number         // 0-1 normalizado
  high: number        // 0-1 normalizado
  energy: number      // 0-1 energía global
  beatPhase: number   // 0-1 fase del beat actual
  isBeat: boolean     // true si estamos en un beat
}

/**
 * Configuración del motor
 */
export interface TitanEngineConfig {
  /** FPS objetivo del loop */
  targetFps: number
  /** Modo debug */
  debug: boolean
  /** Vibe inicial */
  initialVibe: VibeId
}

/**
 * Estado interno del motor
 */
interface EngineState {
  /** Intent actual */
  currentIntent: LightingIntent
  /** Última paleta calculada */
  lastPalette: ColorPalette
  /** Contador de frames */
  frameCount: number
  /** Timestamp último frame */
  lastFrameTime: number
  /** Energía del frame anterior (para deltas) */
  previousEnergy: number
  /** Bass del frame anterior (para deltas) */
  previousBass: number
}

// ═══════════════════════════════════════════════════════════════════════════
// TITAN ENGINE CLASS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚡ TITAN ENGINE
 * 
 * El corazón del sistema de iluminación reactiva.
 * 
 * @example
 * ```typescript
 * const engine = new TitanEngine()
 * engine.setVibe('fiesta-latina')
 * 
 * // En el loop:
 * const intent = engine.update(context, audioMetrics)
 * hal.render(intent, fixtures)
 * ```
 */
export class TitanEngine extends EventEmitter {
  private config: TitanEngineConfig
  private state: EngineState
  
  // Sub-módulos
  // 🔥 WAVE 269: SeleneColorEngine reemplaza a ColorLogic
  // 🧠 WAVE 271: SYNAPTIC RESURRECTION - Stabilization Layer
  // ⚡ WAVE 274: ORGAN HARVEST - Sistema Nervioso (Reactivo a Género)
  private vibeManager: VibeManager
  private keyStabilizer: KeyStabilizer
  private energyStabilizer: EnergyStabilizer
  private moodArbiter: MoodArbiter
  private strategyArbiter: StrategyArbiter
  private nervousSystem: SeleneLux
  
  // 🧠 WAVE 271: Cached stabilized state (for telemetry/debug)
  // 🌡️ WAVE 283: Added thermalTemperature for UI sync
  private lastStabilizedState: {
    stableKey: string | null
    stableEmotion: MetaEmotion
    stableStrategy: ColorStrategy
    smoothedEnergy: number
    isDropActive: boolean
    thermalTemperature: number
  } = {
    stableKey: null,
    stableEmotion: 'NEUTRAL',
    stableStrategy: 'analogous',
    smoothedEnergy: 0,
    isDropActive: false,
    thermalTemperature: 4500,
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // CONSTRUCTOR
  // ═══════════════════════════════════════════════════════════════════════
  
  constructor(config: Partial<TitanEngineConfig> = {}) {
    super()
    
    this.config = {
      targetFps: config.targetFps ?? 60,
      debug: config.debug ?? false,
      // WAVE 255: Force IDLE on startup - system starts in blackout
      initialVibe: config.initialVibe ?? 'idle',
    }
    
    // Inicializar sub-módulos
    // 🔥 WAVE 269: SeleneColorEngine es estático, no necesita instanciarse
    this.vibeManager = VibeManager.getInstance()
    
    // 🧠 WAVE 271: SYNAPTIC RESURRECTION - Instanciar Stabilizers
    this.keyStabilizer = new KeyStabilizer()
    this.energyStabilizer = new EnergyStabilizer()
    this.moodArbiter = new MoodArbiter()
    this.strategyArbiter = new StrategyArbiter()
    
    // ⚡ WAVE 274: ORGAN HARVEST - Sistema Nervioso (Reactivo a Género)
    this.nervousSystem = new SeleneLux({ debug: this.config.debug })
    
    // Establecer vibe inicial
    this.vibeManager.setActiveVibe(this.config.initialVibe)
    
    // Inicializar estado
    this.state = {
      currentIntent: createDefaultLightingIntent(),
      lastPalette: this.createDefaultPalette(),
      frameCount: 0,
      lastFrameTime: Date.now(),
      previousEnergy: 0,
      previousBass: 0,
    }
    
    console.log(`[TitanEngine] ⚡ Initialized (WAVE 217 + WAVE 271 SYNAPTIC + WAVE 274 ORGAN HARVEST)`)
    console.log(`[TitanEngine]    Vibe: ${this.config.initialVibe}`)
    console.log(`[TitanEngine]    🧠 Stabilizers: Key✓ Energy✓ Mood✓ Strategy✓`)
    console.log(`[TitanEngine]    ⚡ NervousSystem: SeleneLux✓ (StereoPhysics CONNECTED)`)
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * 🎯 MÉTODO PRINCIPAL: Actualiza el motor con el contexto musical actual.
   * 
   * Este es el punto de entrada del loop de renderizado.
   * Recibe el análisis musical del Cerebro y produce un LightingIntent
   * que describe QUÉ queremos expresar visualmente.
   * 
   * @param context - Contexto musical del Cerebro (TrinityBrain)
   * @param audio - Métricas de audio en tiempo real
   * @returns LightingIntent para el HAL
   */
  public update(context: MusicalContext, audio: EngineAudioMetrics): LightingIntent {
    const now = Date.now()
    const deltaTime = now - this.state.lastFrameTime
    this.state.lastFrameTime = now
    this.state.frameCount++
    
    // Obtener perfil del vibe actual
    const vibeProfile = this.vibeManager.getActiveVibe()
    
    // ─────────────────────────────────────────────────────────────────────
    // 🧠 WAVE 271: STABILIZATION LAYER
    // Procesar datos crudos → datos estabilizados (anti-epilepsia)
    // ─────────────────────────────────────────────────────────────────────
    
    // 1. ENERGY STABILIZER: Rolling 2s + DROP State Machine
    const energyOutput = this.energyStabilizer.update(context.energy)
    
    // 2. KEY STABILIZER: Buffer 12s, locking 10s
    const keyInput: KeyInput = {
      key: context.key,
      confidence: context.confidence,
      energy: energyOutput.smoothedEnergy, // Usar energía suavizada para ponderación
    }
    const keyOutput = this.keyStabilizer.update(keyInput)
    
    // 3. MOOD ARBITER: Buffer 10s, locking 5s → BRIGHT/DARK/NEUTRAL
    const moodInput: MoodArbiterInput = {
      mode: context.mode,
      mood: context.mood,
      confidence: context.confidence,
      energy: energyOutput.smoothedEnergy,
      key: keyOutput.stableKey, // Usar key estabilizada
    }
    const moodOutput = this.moodArbiter.update(moodInput)
    
    // 4. STRATEGY ARBITER: Rolling 15s → Analogous/Complementary/Triadic
    const strategyInput: StrategyArbiterInput = {
      syncopation: context.syncopation,
      sectionType: context.section.type as any,
      energy: energyOutput.instantEnergy, // Usar energía instantánea para drops
      confidence: context.confidence,
      isRelativeDrop: energyOutput.isRelativeDrop,
      isRelativeBreakdown: energyOutput.isRelativeBreakdown,
      vibeId: vibeProfile.id,
    }
    const strategyOutput = this.strategyArbiter.update(strategyInput)
    
    // 🧠 Cachear estado estabilizado (para telemetría y debug)
    // 🌡️ WAVE 283: Ahora incluye thermalTemperature del MoodArbiter
    this.lastStabilizedState = {
      stableKey: keyOutput.stableKey,
      stableEmotion: moodOutput.stableEmotion,
      stableStrategy: strategyOutput.stableStrategy,
      smoothedEnergy: energyOutput.smoothedEnergy,
      isDropActive: energyOutput.isRelativeDrop,
      thermalTemperature: moodOutput.thermalTemperature,
    }
    
    // Log cambios importantes de estabilización (cada 60 frames si cambio relevante)
    // 🌡️ WAVE 283: Añadido thermalTemperature al log
    if (this.state.frameCount % 60 === 0 && context.energy > 0.05) {
      if (keyOutput.isChanging || moodOutput.emotionChanged || strategyOutput.strategyChanged) {
        console.log(`[TitanEngine 🧠] Stabilization: Key=${keyOutput.stableKey ?? '?'} Emotion=${moodOutput.stableEmotion} Strategy=${strategyOutput.stableStrategy} Temp=${moodOutput.thermalTemperature.toFixed(0)}K`)
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 1. 🔥 WAVE 269: CALCULAR PALETA CON SELENE COLOR ENGINE (EL FERRARI)
    //    🧠 WAVE 271: Ahora usa datos ESTABILIZADOS
    // ─────────────────────────────────────────────────────────────────────
    
    // Construir ExtendedAudioAnalysis desde MusicalContext + Audio + STABILIZED
    const audioAnalysis: ExtendedAudioAnalysis = {
      timestamp: now,
      frameId: this.state.frameCount,
      
      // Trinity Core
      bpm: context.bpm,
      onBeat: audio.isBeat,
      beatPhase: context.beatPhase,
      beatStrength: audio.bass,
      
      // Spectrum
      bass: audio.bass,
      mid: audio.mid,
      treble: audio.high,
      
      // 🧠 WAVE 271: Top-level usa datos ESTABILIZADOS (no crudos)
      syncopation: context.syncopation,
      // Mood estabilizado: BRIGHT→'bright', DARK→'dark', NEUTRAL→'neutral'
      mood: moodOutput.stableEmotion === 'BRIGHT' ? 'bright' :
            moodOutput.stableEmotion === 'DARK' ? 'dark' : 'neutral',
      // Key ESTABILIZADA (no la cruda que cambia cada frame)
      key: keyOutput.stableKey ?? undefined,
      // Energy SUAVIZADA (no la cruda que parpadea)
      energy: energyOutput.smoothedEnergy,
      vibeId: vibeProfile.id,
      
      // Wave8 rich data (reconstruido con datos estabilizados)
      wave8: {
        harmony: {
          key: keyOutput.stableKey, // 🧠 KEY ESTABILIZADA
          mode: context.mode === 'major' ? 'major' : 
                context.mode === 'minor' ? 'minor' : 'minor',
          mood: context.mood,
        },
        rhythm: {
          syncopation: context.syncopation,
        },
        genre: {
          primary: context.genre.subGenre || context.genre.macro || 'unknown',
        },
        section: {
          type: context.section.current,
        },
      },
    }
    
    // Obtener la Constitución del Vibe actual
    const constitution = getColorConstitution(vibeProfile.id)
    
    // 🎨 GENERAR PALETA CON EL FERRARI
    const selenePalette = SeleneColorEngine.generate(audioAnalysis, constitution)
    
    // Convertir SelenePalette → ColorPalette
    const palette = this.selenePaletteToColorPalette(selenePalette)
    this.state.lastPalette = palette
    
    // Log cromático (cada 60 frames = 1 segundo)
    if (this.state.frameCount % 60 === 0 && audio.energy > 0.05) {
      SeleneColorEngine.logChromaticAudit(
        { key: context.key, mood: context.mood, energy: context.energy },
        selenePalette,
        vibeProfile.id
      )
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // ⚡ WAVE 274: SISTEMA NERVIOSO - Procesar física reactiva por género
    // ─────────────────────────────────────────────────────────────────────
    const elementalMods = getModifiersFromKey(keyOutput.stableKey)
    
    // Extraer hue primario de la paleta Selene (HSL)
    const primaryHue = selenePalette.primary.h
    
    // Actualizar sistema nervioso con datos de la trinidad + paleta + mods zodiacales
    const nervousOutput = this.nervousSystem.updateFromTitan(
      {
        activeVibe: vibeProfile.id,
        primaryHue: primaryHue,
        stableKey: keyOutput.stableKey,
        bpm: context.bpm,
        section: context.section.type,  // 🆕 WAVE 290: Sección para White Puncture
      },
      palette,
      {
        normalizedBass: audio.bass,
        normalizedMid: audio.mid,
        normalizedTreble: audio.high,
        avgNormEnergy: energyOutput.smoothedEnergy,
      },
      elementalMods
    )
    
    // Log del sistema nervioso (cada 60 frames si hay energía)
    if (this.state.frameCount % 60 === 0 && audio.energy > 0.05) {
      console.log(`[TitanEngine ⚡] NervousSystem: Physics=${nervousOutput.physicsApplied} Strobe=${nervousOutput.isStrobeActive} Element=${elementalMods.elementName}`)
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // 2. CALCULAR INTENSIDAD GLOBAL
    // ─────────────────────────────────────────────────────────────────────
    const masterIntensity = this.calculateMasterIntensity(audio, vibeProfile)
    
    // ─────────────────────────────────────────────────────────────────────
    // 3. CALCULAR INTENCIONES POR ZONA
    // 🔥 WAVE 290.1: Si physics=latino, usar zoneIntensities del NervousSystem
    // ⚡ WAVE 290.3: Si physics=techno, usar zoneIntensities del NervousSystem
    // 🎸 WAVE 298.5: Si physics=rock, usar zoneIntensities del NervousSystem
    // 🌊 WAVE 315.3: Si physics=chill, usar zoneIntensities del NervousSystem
    // ─────────────────────────────────────────────────────────────────────
    let zones = this.calculateZoneIntents(audio, context, vibeProfile)
    
    // 🔥 WAVE 290.1/290.3/298.5/315.3: Latino/Techno/Rock/Chill override - El NervousSystem manda
    if (nervousOutput.physicsApplied === 'latino' || 
        nervousOutput.physicsApplied === 'techno' || 
        nervousOutput.physicsApplied === 'rock' ||
        nervousOutput.physicsApplied === 'chill') {
      const ni = nervousOutput.zoneIntensities;
      zones = {
        front: { intensity: ni.front, paletteRole: 'primary' },
        back: { intensity: ni.back, paletteRole: 'accent' },
        left: { intensity: ni.mover, paletteRole: 'secondary' },
        right: { intensity: ni.mover, paletteRole: 'secondary' },
        ambient: { intensity: audio.energy * 0.3, paletteRole: 'ambient' },
      };
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // 4. CALCULAR MOVIMIENTO
    // ─────────────────────────────────────────────────────────────────────
    const movement = this.calculateMovement(audio, context, vibeProfile)
    
    // ─────────────────────────────────────────────────────────────────────
    // 5. CALCULAR EFECTOS ACTIVOS
    // ─────────────────────────────────────────────────────────────────────
    const effects = this.calculateEffects(audio, context, vibeProfile)
    
    // ─────────────────────────────────────────────────────────────────────
    // 6. CONSTRUIR LIGHTING INTENT
    // ─────────────────────────────────────────────────────────────────────
    const intent: LightingIntent = {
      palette,
      masterIntensity,
      zones,
      movement,
      effects,
      source: 'procedural',
      timestamp: now,
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // WAVE 257: Throttled debug log (every second = 30 frames)
    // ─────────────────────────────────────────────────────────────────────
    if (this.state.frameCount % 30 === 0 && audio.energy > 0.05) {
      console.log(`[TitanEngine] 🎨 Palette: P=${palette.primary.hex || '#???'} S=${palette.secondary.hex || '#???'} | Energy=${audio.energy.toFixed(2)} | Master=${masterIntensity.toFixed(2)}`)
    }
    
    // Guardar estado para deltas
    this.state.previousEnergy = audio.energy
    this.state.previousBass = audio.bass
    this.state.currentIntent = intent
    
    // Debug logging
    if (this.config.debug && this.state.frameCount % 60 === 0) {
      console.log(`[TitanEngine] Frame ${this.state.frameCount}:`, {
        vibe: vibeProfile.id,
        energy: audio.energy.toFixed(2),
        intensity: masterIntensity.toFixed(2),
      })
    }
    
    return intent
  }
  
  /**
   * Cambia el vibe activo del motor.
   */
  public setVibe(vibeId: VibeId): void {
    this.vibeManager.setActiveVibe(vibeId)
    console.log(`[TitanEngine] 🎭 Vibe changed to: ${vibeId}`)
    this.emit('vibe-changed', vibeId)
  }
  
  /**
   * Obtiene el vibe actual.
   */
  public getCurrentVibe(): VibeId {
    return this.vibeManager.getActiveVibe().id
  }
  
  /**
   * Obtiene el intent actual (para UI/debug).
   */
  public getCurrentIntent(): LightingIntent {
    return this.state.currentIntent
  }
  
  /**
   * Obtiene estadísticas del motor.
   */
  public getStats(): { frameCount: number; fps: number; vibeId: VibeId } {
    return {
      frameCount: this.state.frameCount,
      fps: this.config.targetFps,
      vibeId: this.vibeManager.getActiveVibe().id,
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE: CÁLCULOS INTERNOS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * 🔥 WAVE 269: Convierte SelenePalette a ColorPalette
   * SelenePalette usa HSL en rango 0-360/0-100, ColorPalette usa 0-1
   */
  private selenePaletteToColorPalette(selene: SelenePalette): ColorPalette {
    // Función para normalizar HSL de Selene (0-360, 0-100, 0-100) a LightingIntent (0-1)
    const normalizeHSL = (color: { h: number; s: number; l: number }) => {
      const normalized = {
        h: color.h / 360,
        s: color.s / 100,
        l: color.l / 100,
      }
      return withHex(normalized)
    }
    
    return {
      primary: normalizeHSL(selene.primary),
      secondary: normalizeHSL(selene.secondary),
      accent: normalizeHSL(selene.accent),
      ambient: normalizeHSL(selene.ambient),
      strategy: selene.meta.strategy,
    }
  }
  
  /**
   * Calcula la intensidad global basada en audio y restricciones del vibe.
   */
  private calculateMasterIntensity(
    audio: EngineAudioMetrics,
    vibeProfile: { dimmer: { floor: number; ceiling: number } }
  ): number {
    const { floor, ceiling } = vibeProfile.dimmer
    
    // Mapear energía al rango permitido
    const rawIntensity = audio.energy
    const mappedIntensity = floor + (rawIntensity * (ceiling - floor))
    
    return Math.max(0, Math.min(1, mappedIntensity))
  }
  
  /**
   * Calcula las intenciones de color/intensidad por zona.
   */
  private calculateZoneIntents(
    audio: EngineAudioMetrics,
    _context: MusicalContext,
    _vibeProfile: unknown
  ): ZoneIntentMap {
    // Distribución básica por zona basada en frecuencias
    const zones: ZoneIntentMap = {
      front: {
        intensity: audio.mid * 0.8 + audio.bass * 0.2,
        paletteRole: 'primary',
      },
      back: {
        intensity: audio.bass * 0.6 + audio.energy * 0.4,
        paletteRole: 'accent',
      },
      left: {
        intensity: audio.high * 0.5 + audio.energy * 0.5,
        paletteRole: 'secondary',
      },
      right: {
        intensity: audio.high * 0.5 + audio.energy * 0.5,
        paletteRole: 'secondary',
      },
      ambient: {
        intensity: audio.energy * 0.3,
        paletteRole: 'ambient',
      },
    }
    
    return zones
  }
  
  /**
   * Calcula el movimiento de fixtures motorizados.
   * NOTA: Solo genera intent de movimiento - el motor de físicas/ópticas
   * maneja la ejecución real del movimiento.
   */
  private calculateMovement(
    audio: EngineAudioMetrics,
    context: MusicalContext,
    vibeProfile: { movement: { allowedPatterns: string[]; speedRange: { min: number; max: number } } }
  ): MovementIntent {
    const { speedRange, allowedPatterns } = vibeProfile.movement
    
    // Velocidad basada en BPM y energía
    const bpmFactor = Math.min(1, context.bpm / 140)
    const speed = speedRange.min + (audio.energy * bpmFactor * (speedRange.max - speedRange.min))
    
    // Seleccionar patrón basado en energía
    let patternIndex = Math.floor(audio.energy * allowedPatterns.length)
    patternIndex = Math.min(patternIndex, allowedPatterns.length - 1)
    const pattern = (allowedPatterns[patternIndex] || 'sweep') as MovementIntent['pattern']
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🔥 WAVE 339.7: GENERAR POSICIONES REALES BASADAS EN TIEMPO
    // El Physics Driver interpola hacia estas posiciones target
    // Sin esto, los movers se quedan en (0.5, 0.5) para siempre
    // ═══════════════════════════════════════════════════════════════════════
    const now = Date.now()
    const timeSeconds = now / 1000
    const amplitude = 0.3 + audio.energy * 0.4  // 0.3 base, +0.4 con energía
    
    let centerX = 0.5
    let centerY = 0.5
    
    // Solo generar movimiento si hay audio (evitar movimiento en silencio)
    if (audio.energy > 0.05) {
      switch (pattern) {
        case 'sweep':
          // Barrido horizontal sincronizado con BPM
          const sweepFreq = context.bpm / 60 / 4  // Un ciclo cada 4 beats
          centerX = 0.5 + Math.sin(timeSeconds * Math.PI * 2 * sweepFreq) * amplitude
          centerY = 0.5 + audio.bass * 0.2 - 0.1  // Tilt sigue el bass
          break
          
        case 'circle':
          // Movimiento circular
          const circleFreq = context.bpm / 60 / 8  // Un ciclo cada 8 beats
          centerX = 0.5 + Math.cos(timeSeconds * Math.PI * 2 * circleFreq) * amplitude
          centerY = 0.5 + Math.sin(timeSeconds * Math.PI * 2 * circleFreq) * amplitude * 0.5
          break
          
        case 'pulse':
          // Pulsar hacia el centro en cada beat
          const beatPhase = (context.beatPhase ?? 0) % 1
          const pulseIntensity = Math.pow(1 - beatPhase, 2)  // Decae después del beat
          centerX = 0.5
          centerY = 0.5 - pulseIntensity * amplitude * 0.5  // Baja en el beat
          break
          
        case 'random':
          // Posición basada en hash del frame (determinista pero variada)
          const frameHash = (this.state.frameCount * 7919) % 1000 / 1000
          centerX = 0.3 + frameHash * 0.4  // 0.3-0.7 range
          centerY = 0.4 + (1 - frameHash) * 0.2  // 0.4-0.6 range
          break
          
        default:
          // Static: sin movimiento pero no en centro exacto
          centerX = 0.5
          centerY = 0.4 + audio.energy * 0.2
      }
    }
    
    // Clamp to safe range (0.1 - 0.9 para evitar límites mecánicos)
    centerX = Math.max(0.1, Math.min(0.9, centerX))
    centerY = Math.max(0.1, Math.min(0.9, centerY))
    
    return {
      pattern,
      speed: Math.max(0, Math.min(1, speed)),
      amplitude,
      centerX,
      centerY,
      beatSync: true,
    }
  }
  
  /**
   * Calcula los efectos activos.
   */
  private calculateEffects(
    audio: EngineAudioMetrics,
    _context: MusicalContext,
    vibeProfile: { effects: { allowed: string[]; maxStrobeRate: number } }
  ): EffectIntent[] {
    const effects: EffectIntent[] = []
    const { allowed, maxStrobeRate } = vibeProfile.effects
    
    // Strobe en peaks extremos (si está permitido)
    if (allowed.includes('strobe') && maxStrobeRate > 0 && audio.energy > 0.95) {
      effects.push({
        type: 'strobe',
        intensity: audio.energy,
        speed: maxStrobeRate / 20, // Normalizar a 0-1
        duration: 0,
        zones: [],
      })
    }
    
    return effects
  }
  
  /**
   * Crea una paleta por defecto (para inicialización).
   */
  private createDefaultPalette(): ColorPalette {
    return {
      primary: { h: 0.08, s: 1.0, l: 0.5 },   // Oro
      secondary: { h: 0.95, s: 0.9, l: 0.5 }, // Magenta
      accent: { h: 0.55, s: 1.0, l: 0.5 },    // Cyan
      ambient: { h: 0.08, s: 0.3, l: 0.2 },   // Oro oscuro
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🧠 WAVE 271: STABILIZATION GETTERS (para telemetría/UI)
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Obtener el estado estabilizado actual (para debug/telemetría)
   */
  public getStabilizedState() {
    return { ...this.lastStabilizedState }
  }
  
  /**
   * Obtener la Key estabilizada (12s buffer, 10s locking)
   */
  public getStableKey(): string | null {
    return this.lastStabilizedState.stableKey
  }
  
  /**
   * Obtener la emoción estabilizada (BRIGHT/DARK/NEUTRAL)
   */
  public getStableEmotion(): MetaEmotion {
    return this.lastStabilizedState.stableEmotion
  }
  
  /**
   * Obtener la estrategia de color estabilizada
   */
  public getStableStrategy(): ColorStrategy {
    return this.lastStabilizedState.stableStrategy
  }
  
  /**
   * ¿Está activo un DROP?
   */
  public isDropActive(): boolean {
    return this.lastStabilizedState.isDropActive
  }

  /**
   * 🌡️ WAVE 283: Obtener la temperatura térmica calculada por MoodArbiter
   */
  public getThermalTemperature(): number {
    return this.lastStabilizedState.thermalTemperature
  }
  
  /**
   * 🧹 WAVE 271: Reset de stabilizers (para cambio de canción o vibe)
   */
  public resetStabilizers(): void {
    this.keyStabilizer = new KeyStabilizer()
    this.energyStabilizer = new EnergyStabilizer()
    this.moodArbiter = new MoodArbiter()
    this.strategyArbiter = new StrategyArbiter()
    
    this.lastStabilizedState = {
      stableKey: null,
      stableEmotion: 'NEUTRAL',
      stableStrategy: 'analogous',
      smoothedEnergy: 0,
      isDropActive: false,
      thermalTemperature: 4500,
    }
    
    console.log(`[TitanEngine 🧠] Stabilizers RESET`)
  }
}
