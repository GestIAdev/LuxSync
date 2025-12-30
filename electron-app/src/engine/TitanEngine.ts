/**
 * ⚡ WAVE 217: TITAN ENGINE
 * 
 * Motor de iluminación reactiva PURO. No conoce DMX ni hardware.
 * Recibe MusicalContext del Cerebro → Devuelve LightingIntent al HAL.
 * 
 * FILOSOFÍA:
 * - Este motor es AUTÓNOMO: no depende de Workers, lastColors, ni trinityData
 * - Solo calcula QUÉ queremos expresar, no CÓMO se hace en hardware
 * - Los Vibes definen las restricciones, el motor las respeta
 * 
 * @layer ENGINE (Motor)
 * @version TITAN 2.0
 */

import { EventEmitter } from 'events'
import {
  LightingIntent,
  ColorPalette,
  MovementIntent,
  ZoneIntentMap,
  EffectIntent,
  createDefaultLightingIntent,
} from '../core/protocol/LightingIntent'
import { MusicalContext } from '../core/protocol/MusicalContext'
import { ColorLogic, ColorLogicInput, VibeColorConfig } from './color/ColorLogic'
import { VibeManager } from './vibe/VibeManager'
import type { VibeId, VibeProfile } from '../types/VibeProfile'

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
  private colorLogic: ColorLogic
  private vibeManager: VibeManager
  
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
    this.colorLogic = new ColorLogic()
    this.vibeManager = VibeManager.getInstance()
    
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
    
    console.log(`[TitanEngine] ⚡ Initialized (WAVE 217)`)
    console.log(`[TitanEngine]    Vibe: ${this.config.initialVibe}`)
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
    const vibeColorConfig = this.toColorConfig(vibeProfile)
    
    // ─────────────────────────────────────────────────────────────────────
    // 1. CALCULAR PALETA DE COLORES
    // ─────────────────────────────────────────────────────────────────────
    const colorInput: ColorLogicInput = {
      context,
      audio: {
        bass: audio.bass,
        energy: audio.energy,
        high: audio.high,
        previousBass: this.state.previousBass,
        previousEnergy: this.state.previousEnergy,
        deltaTime,
      },
      vibeProfile: vibeColorConfig,
      previousPalette: this.state.lastPalette,
    }
    
    const palette = this.colorLogic.calculate(colorInput)
    this.state.lastPalette = palette
    
    // ─────────────────────────────────────────────────────────────────────
    // 2. CALCULAR INTENSIDAD GLOBAL
    // ─────────────────────────────────────────────────────────────────────
    const masterIntensity = this.calculateMasterIntensity(audio, vibeProfile)
    
    // ─────────────────────────────────────────────────────────────────────
    // 3. CALCULAR INTENCIONES POR ZONA
    // ─────────────────────────────────────────────────────────────────────
    const zones = this.calculateZoneIntents(audio, context, vibeProfile)
    
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
   * Convierte VibeProfile a VibeColorConfig (subset para ColorLogic)
   */
  private toColorConfig(vibe: VibeProfile): VibeColorConfig {
    return {
      id: vibe.id,
      color: {
        strategies: vibe.color.strategies,
        temperature: vibe.color.temperature,
        atmosphericTemp: vibe.color.atmosphericTemp ?? 6500, // Default neutral
        saturation: vibe.color.saturation,
        forbiddenHueRanges: vibe.color.forbiddenHueRanges,
        allowedHueRanges: vibe.color.allowedHueRanges,
      },
      dimmer: {
        floor: vibe.dimmer.floor,
        ceiling: vibe.dimmer.ceiling,
        allowBlackout: vibe.dimmer.allowBlackout,
      },
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
    
    return {
      pattern,
      speed: Math.max(0, Math.min(1, speed)),
      amplitude: 0.5 + audio.energy * 0.5,
      centerX: 0.5,
      centerY: 0.5,
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
}
