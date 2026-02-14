/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 😵 FEEDBACK_STORM - LA DISTORSIÓN VISUAL
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 1019: ROCK LEGENDS ARSENAL - "ANALOG POWER"
 * 
 * CONCEPTO:
 * Cuando la banda hace RUIDO al final o en un puente caótico.
 * La representación visual del feedback de amplificadores,
 * las guitarras contra los amplis, el caos final.
 * 
 * COMPORTAMIENTO FÍSICO:
 * - Trigger: Se alimenta directamente de HARSHNESS (Suciedad/Distorsión)
 * - Strobe: NO es strobe rítmico (eso es techno)
 *   - Es Strobe ALEATORIO - como chispas eléctricas
 * - Movimientos: Erráticos, pseudo-aleatorios
 * 
 * FILOSOFÍA CRÍTICA:
 * "La música dicta el efecto, no la etiqueta"
 * - Si pones una balada pop → harshness bajo → efecto SUAVE
 * - Si pones Slayer → harshness alto → EL INFIERNO
 * 
 * COLORES:
 * - Blanco Frío cortando sobre Rojo
 * - Caos visual pero controlado
 * 
 * AXIOMA ANTI-SIMULACIÓN:
 * - Usamos SEEDED random basado en elapsedMs
 * - Determinista: mismo input = mismo output
 * - NO Math.random() puro
 * 
 * @module core/effects/library/poprock/FeedbackStorm
 * @version WAVE 1019 - ROCK LEGENDS ARSENAL
 */

import { BaseEffect } from '../../BaseEffect'
import {
  EffectTriggerConfig,
  EffectFrameOutput,
  EffectCategory,
  EffectZone,
} from '../../types'

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

interface FeedbackStormConfig {
  /** Duración total del efecto (ms) */
  durationMs: number
  
  /** ¿BPM-synced? */
  bpmSync: boolean
  
  /** Beats de duración */
  beatsTotal: number
  
  /** Color de strobe - Blanco Frío */
  coldWhite: { h: number; s: number; l: number }
  
  /** Color base - Rojo Intenso */
  intenseRed: { h: number; s: number; l: number }
  
  /** Frecuencia base de strobe (Hz) - se multiplica por harshness */
  baseStrobeFrequency: number
  
  /** Amplitud de movimiento errático */
  chaoticAmplitude: number
  
  /** Seed base para pseudo-random determinista */
  seedBase: number
}

const DEFAULT_CONFIG: FeedbackStormConfig = {
  durationMs: 4000,              // 4 segundos de caos
  bpmSync: true,
  beatsTotal: 8,                 // 8 beats
  
  // 💡 Blanco Frío (flash cortante)
  coldWhite: { h: 200, s: 10, l: 95 },
  
  // ❤️ Rojo Intenso (fondo de caos)
  intenseRed: { h: 0, s: 100, l: 45 },
  
  baseStrobeFrequency: 4,        // 4 Hz base, escalado por harshness
  chaoticAmplitude: 0.5,         // Movimiento errático 50%
  seedBase: 42,                  // Seed para determinismo
}

// ═══════════════════════════════════════════════════════════════════════════
// SEEDED RANDOM (AXIOMA ANTI-SIMULACIÓN COMPLIANT)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generador pseudo-aleatorio determinista
 * Basado en el algoritmo mulberry32
 * @param seed - Semilla para reproducibilidad
 * @returns Número entre 0 y 1
 */
function seededRandom(seed: number): number {
  let t = seed + 0x6D2B79F5
  t = Math.imul(t ^ t >>> 15, t | 1)
  t ^= t + Math.imul(t ^ t >>> 7, t | 61)
  return ((t ^ t >>> 14) >>> 0) / 4294967296
}

// ═══════════════════════════════════════════════════════════════════════════
// 😵 FEEDBACK_STORM CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class FeedbackStorm extends BaseEffect {
  readonly effectType = 'feedback_storm'
  readonly name = 'Feedback Storm'
  readonly category: EffectCategory = 'physical'
  readonly priority = 90  // Alta - es caos controlado
  readonly mixBus = 'global' as const  // Dictador - el caos necesita control total
  
  private config: FeedbackStormConfig
  private actualDurationMs = 4000
  
  // 😵 State
  private stormIntensity = 0
  private strobeState = 0        // 0 = off, 1 = on
  private lastStrobeToggle = 0   // ms desde último toggle
  private currentStrobeInterval = 100  // ms entre toggles
  
  // Posiciones caóticas de movers
  private chaoticPanLeft = 0
  private chaoticPanRight = 0
  private chaoticTiltLeft = 0
  private chaoticTiltRight = 0
  
  // Harshness inyectado (0-1)
  private harshness = 0.5
  
  private currentColor: { h: number; s: number; l: number }
  
  constructor(config?: Partial<FeedbackStormConfig>) {
    super('feedback_storm')
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.currentColor = { ...this.config.intenseRed }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect implementation
  // ─────────────────────────────────────────────────────────────────────────
  
  trigger(config: EffectTriggerConfig): void {
    super.trigger(config)
    
    // Extraer harshness del trigger config (si viene)
    this.harshness = (config as any).harshness ?? 0.5
    
    // Reset state
    this.stormIntensity = 0
    this.strobeState = 0
    this.lastStrobeToggle = 0
    this.currentStrobeInterval = this.calculateStrobeInterval()
    this.chaoticPanLeft = 0
    this.chaoticPanRight = 0
    this.chaoticTiltLeft = 0
    this.chaoticTiltRight = 0
    
    // Calcular duración basada en BPM
    this.calculateDuration()
    
    console.log(`[FeedbackStorm 😵] TRIGGERED! Duration=${this.actualDurationMs}ms Harshness=${this.harshness.toFixed(2)}`)
    console.log(`[FeedbackStorm 😵] ${this.harshness > 0.7 ? 'CHAOS UNLEASHED!' : 'Storm brewing...'}`)
  }
  
  private calculateDuration(): void {
    if (this.config.bpmSync && this.musicalContext?.bpm) {
      const msPerBeat = 60000 / this.musicalContext.bpm
      this.actualDurationMs = msPerBeat * this.config.beatsTotal
    } else {
      this.actualDurationMs = this.config.durationMs
    }
    
    // MAX DURATION de seguridad
    const MAX_DURATION_MS = 8000
    if (this.actualDurationMs > MAX_DURATION_MS) {
      this.actualDurationMs = MAX_DURATION_MS
    }
  }
  
  private calculateStrobeInterval(): number {
    // Strobe frequency escalado por harshness
    // harshness 0.0 → 2 Hz (500ms)
    // harshness 0.5 → 6 Hz (166ms)
    // harshness 1.0 → 12 Hz (83ms)
    const frequency = this.config.baseStrobeFrequency * (0.5 + this.harshness * 1.5)
    return 1000 / frequency / 2  // Dividido por 2 porque es toggle on/off
  }
  
  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    
    this.elapsedMs += deltaMs
    
    // Progreso normalizado (0-1)
    const progress = Math.min(1, this.elapsedMs / this.actualDurationMs)
    
    // ¿Terminamos?
    if (progress >= 1) {
      this.phase = 'finished'
      console.log(`[FeedbackStorm 😵] STORM PASSED (${this.elapsedMs}ms)`)
      return
    }
    
    // Actualizar intensidad con envelope
    this.updateIntensity(progress)
    
    // Actualizar strobe ALEATORIO (no rítmico)
    this.updateStrobe(deltaMs)
    
    // Actualizar posiciones caóticas
    this.updateChaoticMovement()
    
    // Actualizar color (flash blanco sobre rojo)
    this.updateColor()
  }
  
  private updateIntensity(progress: number): void {
    // Envelope rápido: Attack explosivo → Sustain → Decay
    if (progress < 0.05) {
      // Attack brutal
      this.stormIntensity = Math.pow(progress / 0.05, 0.3) * 0.9
    } else if (progress < 0.85) {
      // Sustain con variación caótica
      const seed = this.config.seedBase + Math.floor(this.elapsedMs / 50)
      const chaos = seededRandom(seed) * 0.2 - 0.1
      this.stormIntensity = 0.85 + chaos
    } else {
      // Decay
      const decayProgress = (progress - 0.85) / 0.15
      this.stormIntensity = 0.85 * (1 - Math.pow(decayProgress, 0.5))
    }
    
    // Escalar por harshness (balada = suave, Slayer = INFIERNO)
    this.stormIntensity *= (0.3 + this.harshness * 0.7)
  }
  
  private updateStrobe(deltaMs: number): void {
    this.lastStrobeToggle += deltaMs
    
    // Recalcular intervalo con variación pseudo-aleatoria
    const seed = this.config.seedBase + Math.floor(this.elapsedMs / 30)
    const variation = seededRandom(seed) * 0.6 + 0.7  // 0.7 a 1.3
    const targetInterval = this.currentStrobeInterval * variation
    
    if (this.lastStrobeToggle >= targetInterval) {
      this.strobeState = this.strobeState === 0 ? 1 : 0
      this.lastStrobeToggle = 0
      
      // Nuevo intervalo para el siguiente toggle
      this.currentStrobeInterval = this.calculateStrobeInterval()
    }
  }
  
  private updateChaoticMovement(): void {
    // Movimiento ERRÁTICO pero determinista
    // Diferentes seeds para cada eje, basados en tiempo
    const timeSeed = Math.floor(this.elapsedMs / 100)
    
    const panLeftSeed = this.config.seedBase + timeSeed * 7
    const panRightSeed = this.config.seedBase + timeSeed * 13
    const tiltLeftSeed = this.config.seedBase + timeSeed * 17
    const tiltRightSeed = this.config.seedBase + timeSeed * 23
    
    // Movimiento escalado por harshness
    const amplitude = this.config.chaoticAmplitude * (0.3 + this.harshness * 0.7)
    
    this.chaoticPanLeft = (seededRandom(panLeftSeed) * 2 - 1) * amplitude
    this.chaoticPanRight = (seededRandom(panRightSeed) * 2 - 1) * amplitude
    this.chaoticTiltLeft = (seededRandom(tiltLeftSeed) * 2 - 1) * amplitude * 0.5
    this.chaoticTiltRight = (seededRandom(tiltRightSeed) * 2 - 1) * amplitude * 0.5
  }
  
  private updateColor(): void {
    // Flash blanco cuando strobe ON, rojo cuando OFF
    if (this.strobeState === 1) {
      this.currentColor = { ...this.config.coldWhite }
    } else {
      this.currentColor = { ...this.config.intenseRed }
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Output
  // ─────────────────────────────────────────────────────────────────────────
  
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null
    
    const progress = this.elapsedMs / this.actualDurationMs
    
    // Intensidad efectiva con strobe
    const effectiveIntensity = this.stormIntensity * (this.strobeState === 1 ? 1 : 0.3)
    
    // 😵 BACK PARS - El caos principal
    const backOverride = {
      color: this.currentColor,
      dimmer: effectiveIntensity,
      white: this.strobeState === 1 ? effectiveIntensity * 0.8 : undefined,
      blendMode: 'max' as const,
    }
    
    // 😵 FRONT PARS - Acompañan el caos
    const frontOverride = {
      color: this.strobeState === 1 ? this.config.coldWhite : this.config.intenseRed,
      dimmer: effectiveIntensity * 0.7,
      blendMode: 'max' as const,
    }
    
    // 😵 MOVERS - Movimiento errático
    const moverLeftOverride = {
      color: this.config.intenseRed,  // Siempre rojo (más dramático)
      dimmer: this.stormIntensity * 0.6,
      movement: {
        pan: this.chaoticPanLeft,
        tilt: this.chaoticTiltLeft,
        isAbsolute: false,
        speed: 1.0,                    // RÁPIDO - es caos
      },
      blendMode: 'max' as const,
    }
    
    const moverRightOverride = {
      color: this.config.intenseRed,
      dimmer: this.stormIntensity * 0.6,
      movement: {
        pan: this.chaoticPanRight,
        tilt: this.chaoticTiltRight,
        isAbsolute: false,
        speed: 1.0,
      },
      blendMode: 'max' as const,
    }
    
    const zoneOverrides = {
      'back': backOverride,
      'front': frontOverride,
      'movers-left': moverLeftOverride,
      'movers-right': moverRightOverride,
    }
    
    return {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      zones: Object.keys(zoneOverrides) as EffectZone[],
      intensity: this.stormIntensity,
      zoneOverrides,
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════

export function createFeedbackStorm(config?: Partial<FeedbackStormConfig>): FeedbackStorm {
  return new FeedbackStorm(config)
}
