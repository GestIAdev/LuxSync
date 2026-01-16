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

// 🎯 WAVE 343: OPERATION CLEAN SLATE - Movement Manager
import { 
  vibeMovementManager, 
  type AudioContext as VMMContext,
  type MovementIntent as VMMMovementIntent  // WAVE 347: VMM usa su propio tipo (x, y)
} from './movement/VibeMovementManager'

// 🔦 WAVE 410: OPERATION SYNAPSE RECONNECT - Optics Config
import { getOpticsConfig } from './movement/VibeMovementPresets'

// 🧬 WAVE 500: PROJECT GENESIS - Consciencia Nativa
import { 
  SeleneTitanConscious, 
  type TitanStabilizedState,
  type ConsciousnessOutput,
  type ConsciousnessColorDecision,
  type ConsciousnessPhysicsModifier,
} from '../core/intelligence'

// 🧨 WAVE 600: EFFECT ARSENAL - Sistema de Efectos
import { 
  getEffectManager,
  type EffectManager,
  type CombinedEffectOutput,
} from '../core/effects'

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
  beatCount?: number  // WAVE 345: Contador de beats para phrase detection
  // 🎛️ WAVE 661: Textura espectral
  harshness?: number        // 0-1 (ratio 2-5kHz vs total)
  spectralFlatness?: number // 0-1 (0=tonal, 1=noise)
  spectralCentroid?: number // Hz (brillo tonal)
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
  // 🧬 WAVE 500: PROJECT GENESIS - Consciencia Nativa V2
  // 🧨 WAVE 600: EFFECT ARSENAL
  private vibeManager: VibeManager
  private keyStabilizer: KeyStabilizer
  private energyStabilizer: EnergyStabilizer
  private moodArbiter: MoodArbiter
  private strategyArbiter: StrategyArbiter
  private nervousSystem: SeleneLux
  private selene: SeleneTitanConscious
  private effectManager: EffectManager  // 🧨 WAVE 600: Effect Arsenal
  
  // 🧠 WAVE 271: Cached stabilized state (for telemetry/debug)
  // 🌡️ WAVE 283: Added thermalTemperature for UI sync
  // 🔥 WAVE 642: Added rawEnergy (GAMMA sin tocar)
  private lastStabilizedState: {
    stableKey: string | null
    stableEmotion: MetaEmotion
    stableStrategy: ColorStrategy
    rawEnergy: number  // 🔥 WAVE 642: GAMMA RAW
    smoothedEnergy: number
    isDropActive: boolean
    thermalTemperature: number
  } = {
    stableKey: null,
    stableEmotion: 'NEUTRAL',
    stableStrategy: 'analogous',
    rawEnergy: 0,  // 🔥 WAVE 642
    smoothedEnergy: 0,
    isDropActive: false,
    thermalTemperature: 4500,
  }
  
  // 🧬 WAVE 550: Cached consciousness output for telemetry HUD
  private lastConsciousnessOutput: ConsciousnessOutput | null = null
  
  // 🧨 WAVE 610: Manual strike trigger (force effect without HuntEngine decision)
  private manualStrikePending: { effect: string; intensity: number } | null = null
  
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
    
    // 🧬 WAVE 500: PROJECT GENESIS - Consciencia Nativa V2
    this.selene = new SeleneTitanConscious({ debug: this.config.debug })
    
    // 🧨 WAVE 600: EFFECT ARSENAL - Sistema de Efectos Singleton
    this.effectManager = getEffectManager()
    
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
    
    console.log(`[TitanEngine] ⚡ Initialized (WAVE 217 + WAVE 271 SYNAPTIC + WAVE 274 ORGAN HARVEST + WAVE 500 GENESIS + WAVE 600 ARSENAL)`)
    console.log(`[TitanEngine]    Vibe: ${this.config.initialVibe}`)
    console.log(`[TitanEngine]    🧠 Stabilizers: Key✓ Energy✓ Mood✓ Strategy✓`)
    console.log(`[TitanEngine]    ⚡ NervousSystem: SeleneLux✓ (StereoPhysics CONNECTED)`)
    console.log(`[TitanEngine]    🧬 Consciousness: SeleneTitanConscious V2✓ (Native Intelligence)`)
    console.log(`[TitanEngine]    🧨 EffectManager: ${this.effectManager.getState().activeEffects} effects ready`)
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
    // 🔥 WAVE 642: Ahora incluye rawEnergy (GAMMA sin tocar)
    this.lastStabilizedState = {
      stableKey: keyOutput.stableKey,
      stableEmotion: moodOutput.stableEmotion,
      stableStrategy: strategyOutput.stableStrategy,
      rawEnergy: energyOutput.rawEnergy,  // 🔥 WAVE 642: GAMMA RAW para strikes
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
        right: { intensity: ni.mover, paletteRole: 'ambient' },  // 🎨 WAVE 412: Stereo split (no secondary!)
        ambient: { intensity: audio.energy * 0.3, paletteRole: 'ambient' },
      };
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // 4. CALCULAR MOVIMIENTO
    // ─────────────────────────────────────────────────────────────────────
    const movement = this.calculateMovement(audio, context, vibeProfile)
    
    // ─────────────────────────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────────────
    // 5. CALCULAR EFECTOS ACTIVOS
    // ─────────────────────────────────────────────────────────────────────
    const effects = this.calculateEffects(audio, context, vibeProfile)
    
    // ─────────────────────────────────────────────────────────────────────
    // 🔦 WAVE 410: RECONEXIÓN ÓPTICA - Recuperar configuración de Zoom/Focus
    // ─────────────────────────────────────────────────────────────────────
    const opticsConfig = getOpticsConfig(vibeProfile.id)
    const optics = {
      zoom: opticsConfig.zoomDefault,
      focus: opticsConfig.focusDefault,
      iris: opticsConfig.irisDefault,
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // 🧬 WAVE 500: PROJECT GENESIS - Consciencia Nativa V2
    // El cerebro de Selene procesa el estado estabilizado y genera decisiones
    // 🔥 WAVE 642: Ahora incluye rawEnergy (GAMMA sin tocar)
    // ─────────────────────────────────────────────────────────────────────
    const titanStabilizedState: TitanStabilizedState = {
      // Contexto del Vibe
      vibeId: vibeProfile.id,
      constitution: constitution,
      
      // Datos estabilizados (anti-epilepsia)
      stableKey: keyOutput.stableKey,
      stableEmotion: moodOutput.stableEmotion,
      stableStrategy: strategyOutput.stableStrategy,
      rawEnergy: energyOutput.rawEnergy,  // 🔥 WAVE 642: GAMMA RAW para strikes
      smoothedEnergy: energyOutput.smoothedEnergy,
      isDropActive: energyOutput.isRelativeDrop,
      thermalTemperature: moodOutput.thermalTemperature,
      
      // Audio en tiempo real
      bass: audio.bass,
      mid: audio.mid,
      high: audio.high,
      
      // 🎛️ WAVE 661: Textura espectral (defaults a neutro si no hay datos)
      harshness: audio.harshness ?? 0,
      spectralFlatness: audio.spectralFlatness ?? 0,
      spectralCentroid: audio.spectralCentroid ?? 1000,
      
      // Contexto musical
      bpm: context.bpm,
      beatPhase: context.beatPhase,
      syncopation: context.syncopation,
      sectionType: this.normalizeSectionType(context.section.type),
      
      // Paleta actual
      currentPalette: selenePalette,
      
      // Timing
      frameId: this.state.frameCount,
      timestamp: now,
    }
    
    // 🧬 Ejecutar la consciencia (sense → think → dream → validate)
    const consciousnessOutput: ConsciousnessOutput = this.selene.process(titanStabilizedState)
    
    // 🧬 WAVE 550: Cachear output para telemetría HUD
    this.lastConsciousnessOutput = consciousnessOutput
    
    // ─────────────────────────────────────────────────────────────────────
    // 📜 WAVE 560: TACTICAL LOG - Emitir eventos de consciencia
    // ─────────────────────────────────────────────────────────────────────
    this.emitConsciousnessLogs(consciousnessOutput, audio.energy)
    
    // ─────────────────────────────────────────────────────────────────────
    // 🧨 WAVE 600: EFFECT ARSENAL - Procesar Effects
    // ─────────────────────────────────────────────────────────────────────
    
    // 🧨 WAVE 610: Procesar manual strike si está pendiente (prioridad sobre AI)
    if (this.manualStrikePending) {
      const { effect, intensity } = this.manualStrikePending
      
      this.effectManager.trigger({
        effectType: effect,
        intensity,
        source: 'manual',
        reason: 'Manual strike from FORCE STRIKE button',
      })
      
      console.log(`[TitanEngine] 🧨 MANUAL STRIKE: ${effect} @ ${intensity.toFixed(2)}`)
      this.manualStrikePending = null  // Consumir la flag
    }
    // Si la consciencia decidió disparar un efecto, hacerlo (solo si no hay manual strike)
    else if (consciousnessOutput.effectDecision) {
      const { effectType, intensity, reason, confidence } = consciousnessOutput.effectDecision
      
      // Solo disparar si confianza > 0.6
      if (confidence > 0.6) {
        this.effectManager.trigger({
          effectType,
          intensity,
          source: 'hunt_strike',  // Disparado por decisión de consciencia/HuntEngine
          reason,
        })
        
        // Log throttled (solo 1 cada 30 frames)
        if (this.state.frameCount % 30 === 0) {
          console.log(`[TitanEngine] 🧨 Effect triggered: ${effectType} (intensity=${intensity.toFixed(2)}, reason=${reason})`)
        }
      }
    }
    
    // Update all active effects (EffectManager maneja su propio deltaTime)
    this.effectManager.update()
    
    // Get aggregated effect output (HTP blending)
    const effectOutput: CombinedEffectOutput = this.effectManager.getCombinedOutput()

    // ─────────────────────────────────────────────────────────────────────
    // 6. CONSTRUIR LIGHTING INTENT
    // 🧬 WAVE 500: Aplicar decisiones de consciencia
    // ─────────────────────────────────────────────────────────────────────
    
    // 🧬 Aplicar modificaciones de consciencia a la paleta (si hay decisión)
    let finalPalette = palette
    if (consciousnessOutput.colorDecision && consciousnessOutput.confidence > 0.5) {
      finalPalette = this.applyConsciousnessColorDecision(palette, consciousnessOutput.colorDecision)
    }
    
    // 🧬 Aplicar modificaciones de consciencia a los efectos (respetando Energy Override)
    let finalEffects = effects
    if (consciousnessOutput.physicsModifier && consciousnessOutput.confidence > 0.5) {
      // ⚠️ ENERGY OVERRIDE: Si energía > 0.85, física tiene VETO TOTAL
      if (energyOutput.smoothedEnergy < 0.85) {
        finalEffects = this.applyConsciousnessPhysicsModifier(effects, consciousnessOutput.physicsModifier)
      }
    }
    
    // 🧨 WAVE 600: Aplicar Effect Arsenal overrides (HTP - Highest Takes Precedence)
    let finalMasterIntensity = masterIntensity
    if (effectOutput.hasActiveEffects && effectOutput.dimmerOverride !== undefined) {
      // HTP: Solo aplicar si el efecto es más brillante
      finalMasterIntensity = Math.max(masterIntensity, effectOutput.dimmerOverride)
    }
    
    // 🧨 WAVE 630: GLOBAL OVERRIDE - Si el efecto tiene flag, bypasear zonas
    if (effectOutput.hasActiveEffects && effectOutput.globalOverride) {
      // Override TODAS las zonas al máximo (el efecto manda)
      const overrideIntensity = effectOutput.dimmerOverride ?? 1.0
      zones = {
        front: { intensity: overrideIntensity, paletteRole: 'primary' },
        back: { intensity: overrideIntensity, paletteRole: 'primary' },
        left: { intensity: overrideIntensity, paletteRole: 'primary' },
        right: { intensity: overrideIntensity, paletteRole: 'primary' },
        ambient: { intensity: overrideIntensity, paletteRole: 'primary' },
      }
      
      // 🧹 WAVE 671.5: Only log at START (100%) and END (0%) to avoid decay spam
      const intensityPercent = Math.round(overrideIntensity * 100)
      if (intensityPercent >= 94 || intensityPercent === 0) {
        console.log(`[TitanEngine 🧨] GLOBAL OVERRIDE ${intensityPercent >= 94 ? 'ACTIVATED' : 'RELEASED'} - All zones at ${intensityPercent}%`)
      }
    }
    
    // Aplicar color override del efecto (si existe)
    if (effectOutput.hasActiveEffects && effectOutput.colorOverride) {
      // Override completo del color primario con el flare
      const flareColor = effectOutput.colorOverride
      finalPalette = {
        ...finalPalette,
        primary: {
          ...finalPalette.primary,
          h: flareColor.h,
          s: flareColor.s,
          l: Math.min(100, flareColor.l * 1.2),  // Más brillo
        },
      }
    }
    
    const intent: LightingIntent = {
      palette: finalPalette,
      masterIntensity: finalMasterIntensity,  // 🧨 WAVE 600: Puede ser boosteado por efectos
      zones,
      movement,
      optics,  // 🔦 WAVE 410: Inyectar configuración óptica
      effects: finalEffects,
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
   * 🧬 WAVE 500: Kill Switch para la Consciencia
   * 
   * Cuando enabled = false, Selene V2 se apaga y el sistema vuelve
   * a física reactiva pura (Layer 0 solamente).
   * 
   * @param enabled - true = Consciencia ON, false = Solo Física Reactiva
   */
  public setConsciousnessEnabled(enabled: boolean): void {
    this.selene.setEnabled(enabled)
    console.log(`[TitanEngine] 🧬 Consciousness ${enabled ? 'ENABLED ✅' : 'DISABLED ⏸️'}`)
    this.emit('consciousness-toggled', enabled)
  }
  
  /**
   * 🧬 WAVE 500: Obtiene estado de la consciencia
   */
  public isConsciousnessEnabled(): boolean {
    return this.selene.isEnabled()
  }
  
  /**
   * 🧬 WAVE 550: Obtiene telemetría de consciencia para el HUD táctico
   * 
   * Devuelve datos del cerebro de Selene en formato listo para UI.
   */
  public getConsciousnessTelemetry(): {
    enabled: boolean
    huntState: 'sleeping' | 'stalking' | 'evaluating' | 'striking' | 'learning'
    confidence: number
    prediction: string | null
    predictionProbability: number
    predictionTimeMs: number
    beautyScore: number
    beautyTrend: 'rising' | 'falling' | 'stable'
    consonance: number
    lastDecision: string | null
    decisionSource: string | null
    reasoning: string | null
    biasesDetected: string[]
    energyOverrideActive: boolean
  } {
    const output = this.lastConsciousnessOutput
    const isEnabled = this.selene.isEnabled()
    
    // Si no hay output o la consciencia está deshabilitada, devolver valores por defecto
    if (!output || !isEnabled) {
      return {
        enabled: isEnabled,
        huntState: 'sleeping',
        confidence: 0,
        prediction: null,
        predictionProbability: 0,
        predictionTimeMs: 0,
        beautyScore: 0.5,
        beautyTrend: 'stable',
        consonance: 1,
        lastDecision: null,
        decisionSource: null,
        reasoning: null,
        biasesDetected: [],
        energyOverrideActive: false
      }
    }
    
    const debugInfo = output.debugInfo
    const activePred = debugInfo.activePrediction
    
    // Construir texto de predicción
    let predictionText: string | null = null
    if (activePred) {
      const pct = Math.round(activePred.probability * 100)
      predictionText = `${activePred.type.toUpperCase()} - ${pct}%`
    }
    
    // Determinar última decisión
    let lastDecision: string | null = null
    if (output.colorDecision) {
      lastDecision = 'Palette Adjustment'
    } else if (output.physicsModifier) {
      lastDecision = 'Effects Modifier'
    } else if (output.movementDecision) {
      lastDecision = 'Movement Change'
    }
    
    // Determinar si Energy Override está activo
    const energyOverrideActive = this.lastStabilizedState.smoothedEnergy >= 0.85
    
    return {
      enabled: true,
      huntState: debugInfo.huntState,
      confidence: output.confidence,
      prediction: predictionText,
      predictionProbability: activePred?.probability ?? 0,
      predictionTimeMs: activePred?.timeUntilMs ?? 0,
      beautyScore: debugInfo.beautyScore,
      beautyTrend: debugInfo.beautyTrend,
      consonance: debugInfo.consonance,
      lastDecision,
      decisionSource: output.source,
      reasoning: debugInfo.reasoning ?? null,
      biasesDetected: debugInfo.biasesDetected,
      energyOverrideActive
    }
  }
  
  /**
   * Obtiene el vibe actual.
   */
  public getCurrentVibe(): VibeId {
    return this.vibeManager.getActiveVibe().id
  }
  
  /**
   * 🧨 WAVE 610: FORCE STRIKE - Manual Effect Detonator
   * 
   * Fuerza un disparo de efecto en el próximo frame, sin esperar decisión del HuntEngine.
   * Útil para testeo manual de efectos sin alterar umbrales de algoritmos.
   * 
   * @param config - { effect: string, intensity: number }
   * @example engine.forceStrikeNextFrame({ effect: 'solar_flare', intensity: 1.0 })
   */
  public forceStrikeNextFrame(config: { effect: string; intensity: number }): void {
    this.manualStrikePending = config
    console.log(`[TitanEngine] 🧨 Manual strike queued: ${config.effect} @ ${config.intensity.toFixed(2)}`)
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
  // 📜 WAVE 560: TACTICAL LOG EMISSION
  // ═══════════════════════════════════════════════════════════════════════
  
  /** 
   * Estado anterior para detectar cambios en Hunt/Prediction 
   */
  private lastHuntState: string = 'sleeping'
  private lastPredictionType: string | null = null
  private lastStrikeCount = 0
  
  /**
   * 📜 WAVE 560: Emite logs de consciencia para el Tactical Log
   * 
   * Solo emite cuando hay cambios de estado significativos, no cada frame.
   */
  private emitConsciousnessLogs(output: ConsciousnessOutput, energy: number): void {
    // No emitir si no hay energía o consciencia deshabilitada
    if (energy < 0.05 || !this.selene.isEnabled()) return
    
    const debug = output.debugInfo
    const huntState = debug.huntState
    const activePred = debug.activePrediction
    
    // ─────────────────────────────────────────────────────────────────────
    // 🎯 HUNT STATE CHANGES
    // ─────────────────────────────────────────────────────────────────────
    if (huntState !== this.lastHuntState) {
      const huntMessages: Record<string, string> = {
        'sleeping': '💤 Hunt: Sleeping...',
        'stalking': '🐆 Hunt: Stalking target...',
        'evaluating': '🎯 Hunt: Evaluating worthiness...',
        'striking': '⚡ Hunt: STRIKING!',
        'learning': '📚 Hunt: Learning from strike...',
      }
      
      this.emit('log', {
        category: 'Hunt',
        message: huntMessages[huntState] || `Hunt: ${huntState}`,
        data: { 
          confidence: Math.round(output.confidence * 100),
          beauty: Math.round(debug.beautyScore * 100),
        }
      })
      
      this.lastHuntState = huntState
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // 🔮 PREDICTION CHANGES
    // ─────────────────────────────────────────────────────────────────────
    const predType = activePred?.type ?? null
    if (predType !== this.lastPredictionType && predType !== null) {
      const pct = Math.round((activePred?.probability ?? 0) * 100)
      const timeMs = activePred?.timeUntilMs ?? 0
      
      this.emit('log', {
        category: 'Brain',
        message: `🔮 Prediction: ${predType.toUpperCase()} (${pct}%) in ${timeMs}ms`,
        data: { 
          type: predType, 
          probability: pct, 
          timeUntilMs: timeMs,
        }
      })
      
      this.lastPredictionType = predType
    } else if (predType === null && this.lastPredictionType !== null) {
      // Predicción terminó
      this.emit('log', {
        category: 'Brain',
        message: '🔮 Prediction: Cleared',
      })
      this.lastPredictionType = null
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // ⚡ STRIKE EXECUTED (detectado por transición a 'striking')
    // ─────────────────────────────────────────────────────────────────────
    if (huntState === 'striking' && this.lastHuntState !== 'striking') {
      const colorDecision = output.colorDecision
      
      this.emit('log', {
        category: 'Hunt',
        message: `⚡ STRIKE EXECUTED: ${colorDecision?.suggestedStrategy ?? 'palette change'}`,
        data: {
          confidence: Math.round(output.confidence * 100),
          satMod: colorDecision?.saturationMod?.toFixed(2) ?? 'N/A',
          brightMod: colorDecision?.brightnessMod?.toFixed(2) ?? 'N/A',
        }
      })
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // ⚡ ENERGY OVERRIDE (detectado por alta energía + confidence bajo)
    // ─────────────────────────────────────────────────────────────────────
    const isEnergyOverride = this.lastStabilizedState.smoothedEnergy >= 0.85
    if (isEnergyOverride && this.state.frameCount % 30 === 0) {
      this.emit('log', {
        category: 'Mode',
        message: `⚡ ENERGY OVERRIDE: Physics rules! (${Math.round(this.lastStabilizedState.smoothedEnergy * 100)}%)`,
      })
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // 💭 DREAM SIMULATION (throttled)
    // ─────────────────────────────────────────────────────────────────────
    if (debug.lastDream && this.state.frameCount % 60 === 0) {
      const dream = debug.lastDream
      
      if (dream.recommendation === 'execute') {
        this.emit('log', {
          category: 'Brain',
          message: `💭 Dream: Recommending ${dream.scenario.replace(/_/g, ' ')}`,
          data: {
            beautyDelta: dream.beautyDelta.toFixed(2),
          }
        })
      }
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
   * 🧬 WAVE 500: Normaliza el tipo de sección al formato esperado por TitanStabilizedState
   */
  private normalizeSectionType(
    sectionType: string
  ): 'intro' | 'verse' | 'chorus' | 'drop' | 'bridge' | 'outro' | 'build' | 'breakdown' | 'unknown' {
    const normalized = sectionType?.toLowerCase() ?? 'unknown'
    
    // Mapeo de secciones comunes
    const sectionMap: Record<string, 'intro' | 'verse' | 'chorus' | 'drop' | 'bridge' | 'outro' | 'build' | 'breakdown' | 'unknown'> = {
      intro: 'intro',
      verse: 'verse',
      chorus: 'chorus',
      drop: 'drop',
      bridge: 'bridge',
      outro: 'outro',
      build: 'build',
      buildup: 'build',
      breakdown: 'breakdown',
      hook: 'chorus',
      prechorus: 'build',
      postchorus: 'verse',
    }
    
    return sectionMap[normalized] ?? 'unknown'
  }
  
  /**
   * 🧬 WAVE 500: Aplica decisiones de color de la consciencia a la paleta
   * 
   * La consciencia puede modificar saturación y brillo de los colores,
   * pero RESPETA la paleta base generada por SeleneColorEngine.
   */
  private applyConsciousnessColorDecision(
    palette: ColorPalette,
    decision: ConsciousnessColorDecision
  ): ColorPalette {
    // Clonar paleta para no mutar
    const newPalette: ColorPalette = {
      primary: { ...palette.primary },
      secondary: { ...palette.secondary },
      accent: { ...palette.accent },
      ambient: { ...palette.ambient },
      strategy: palette.strategy,
    }
    
    // Aplicar modificadores de saturación (0.8-1.2)
    const satMod = decision.saturationMod ?? 1
    const clampedSatMod = Math.max(0.8, Math.min(1.2, satMod))
    
    // Aplicar modificadores de brillo (0.8-1.2)
    const brightMod = decision.brightnessMod ?? 1
    const clampedBrightMod = Math.max(0.8, Math.min(1.2, brightMod))
    
    // Modificar cada color de la paleta
    for (const role of ['primary', 'secondary', 'accent', 'ambient'] as const) {
      const color = newPalette[role]
      
      // Aplicar saturación (clamped 0-1)
      color.s = Math.max(0, Math.min(1, color.s * clampedSatMod))
      
      // Aplicar brillo (clamped 0-1)
      color.l = Math.max(0, Math.min(1, color.l * clampedBrightMod))
    }
    
    return newPalette
  }
  
  /**
   * 🧬 WAVE 500: Aplica modificadores de física de la consciencia a los efectos
   * 
   * ⚠️ ESTE MÉTODO SOLO SE LLAMA SI energy < 0.85
   * En drops (energy >= 0.85), la física tiene VETO TOTAL.
   */
  private applyConsciousnessPhysicsModifier(
    effects: EffectIntent[],
    modifier: ConsciousnessPhysicsModifier
  ): EffectIntent[] {
    if (!modifier) return effects
    
    return effects.map(effect => {
      const newEffect = { ...effect }
      
      // Modificar intensidad de strobe/flash
      if (effect.type === 'strobe' && modifier.strobeIntensity !== undefined) {
        newEffect.intensity *= modifier.strobeIntensity
      }
      
      if (effect.type === 'flash' && modifier.flashIntensity !== undefined) {
        newEffect.intensity *= modifier.flashIntensity
      }
      
      // Clamp final
      newEffect.intensity = Math.max(0, Math.min(1, newEffect.intensity))
      
      return newEffect
    })
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
        paletteRole: 'secondary', // 🎨 Mov L → Secondary (Blue)
      },
      right: {
        intensity: audio.high * 0.5 + audio.energy * 0.5,
        paletteRole: 'ambient',   // 🎨 WAVE 412: Mov R → Ambient (Cyan)
      },
      ambient: {
        intensity: audio.energy * 0.3,
        paletteRole: 'ambient',
      },
    }
    
    return zones
  }
  
  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * 🎯 WAVE 343: OPERATION CLEAN SLATE
   * ═══════════════════════════════════════════════════════════════════════════
   * 
   * Calcula el movimiento de fixtures motorizados.
   * 
   * ANTES (WAVE 340-342): Matemática de patrones HARDCODED aquí 🚮
   * AHORA: Delega TODO al VibeMovementManager ✅
   * 
   * TitanEngine ya no conoce:
   * - Math.sin/cos para patrones
   * - Frecuencias por vibe
   * - Amplitudes por vibe
   * - Lógica de figure8/mirror/circle/etc
   * 
   * Solo sabe: "Oye VMM, dame movimiento para este vibe y audio"
   * ═══════════════════════════════════════════════════════════════════════════
   */
  private calculateMovement(
    audio: EngineAudioMetrics,
    context: MusicalContext,
    _vibeProfile: { movement: { allowedPatterns: string[]; speedRange: { min: number; max: number } } }
  ): MovementIntent {
    // Obtener vibe actual
    const currentVibeId = this.vibeManager.getActiveVibe().id
    
    // Construir contexto de audio para VMM
    // WAVE 345: Incluir beatCount para phrase detection
    const vmmContext: VMMContext = {
      energy: audio.energy,
      bass: audio.bass,
      mids: audio.mid,
      highs: audio.high,
      bpm: context.bpm,
      beatPhase: audio.beatPhase,
      beatCount: audio.beatCount || 0,
    }
    
    // 🎯 DELEGAR al VibeMovementManager
    // WAVE 347: VMM devuelve VMMMovementIntent (x, y), debemos convertir a MovementIntent del protocolo (centerX, centerY)
    const vmmIntent: VMMMovementIntent = vibeMovementManager.generateIntent(currentVibeId, vmmContext)
    
    // ═══════════════════════════════════════════════════════════════════════
    // WAVE 345: Convertir coordenadas con FULL RANGE
    // ═══════════════════════════════════════════════════════════════════════
    // VMM: -1 = extremo izq/arriba, +1 = extremo der/abajo
    // HAL espera: 0 = extremo, 0.5 = centro, 1 = extremo opuesto
    // 
    // ANTES (BUG): * 0.4 limitaba a 80% del rango (¡causa de los 15°!)
    // AHORA: * 0.5 usa 100% del rango
    // ═══════════════════════════════════════════════════════════════════════
    const centerX = 0.5 + (vmmIntent.x * 0.5)  // FULL RANGE: 0.0 - 1.0
    const centerY = 0.5 + (vmmIntent.y * 0.5)  // FULL RANGE: 0.0 - 1.0
    
    // 🧹 WAVE 671.5: Silenced TITAN OUT spam (kept for future debug if needed)
    // 🔍 WAVE 347: Debug TitanEngine output (sample 3%)
    // if (Math.random() < 0.03) {
    //   const outPan = Math.round((centerX - 0.5) * 540)
    //   const outTilt = Math.round((centerY - 0.5) * 270)
    //   console.log(`[🔍 TITAN OUT] VMM.x:${vmmIntent.x.toFixed(3)} VMM.y:${vmmIntent.y.toFixed(3)} → centerX:${centerX.toFixed(3)} centerY:${centerY.toFixed(3)} | Pan:${outPan}° Tilt:${outTilt}°`)
    // }
    
    // Convertir VMMMovementIntent → MovementIntent del protocolo
    const protocolIntent: MovementIntent = {
      pattern: vmmIntent.pattern as MovementIntent['pattern'],
      speed: Math.max(0, Math.min(1, vmmIntent.speed)),
      amplitude: vmmIntent.amplitude,
      centerX: Math.max(0, Math.min(1, centerX)),  // WAVE 345: Full range 0-1
      centerY: Math.max(0, Math.min(1, centerY)),  // WAVE 345: Full range 0-1
      beatSync: true,
      phaseType: vmmIntent.phaseType,  // 🔧 WAVE 350: Pasar phaseType del VMM a HAL
    }
    
    return protocolIntent
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
    
    // 🔥 WAVE 642: Añadido rawEnergy al reset
    this.lastStabilizedState = {
      stableKey: null,
      stableEmotion: 'NEUTRAL',
      stableStrategy: 'analogous',
      rawEnergy: 0,  // 🔥 WAVE 642
      smoothedEnergy: 0,
      isDropActive: false,
      thermalTemperature: 4500,
    }
    
    console.log(`[TitanEngine 🧠] Stabilizers RESET`)
  }
}
