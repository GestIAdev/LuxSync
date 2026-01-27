/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌿 AMAZON MIST - LA SELVA RESPIRA
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🌊 WAVE 1004.4: THE LATINO LADDER - Zona SILENCE (0-15%)
 * 
 * CONCEPTO:
 * La selva amazónica respirando antes de que empiece la fiesta.
 * Introspección pura. El momento donde la humedad del aire 
 * se convierte en luz tenue.
 * 
 * DNA TARGET:
 * - Aggression: 0.05 (MÍNIMA - casi imperceptible)
 * - Chaos: 0.20 (Ordenado - sinusoidal predecible)
 * - Organicity: 0.95 (MÁXIMA - respiración natural)
 * 
 * FILOSOFÍA:
 * "Antes del primer golpe de tambor, la selva ya bailaba.
 * En el silencio, los espíritus verdes despiertan."
 * 
 * MECÁNICA:
 * - Respiración sinusoidal muy lenta (6-8 segundos por ciclo)
 * - Colores: Verde Selva profundo → Turquesa Agua
 * - Dimmer bajo (10-30% máximo)
 * - Sin cambios bruscos - transiciones de 2+ segundos
 * 
 * MOVER LAW:
 * - Efecto LONG (8000ms) = MODO FANTASMA OBLIGATORIO
 * - Solo dimmer a movers, SIN color, SIN movimiento brusco
 * - Movimiento imperceptible (si hay) - 0.01 speed
 * 
 * PERFECT FOR:
 * - Intros de tracks
 * - Momentos de silencio/breakdown profundo
 * - Transiciones entre canciones
 * - Cuando la energía está en 0-15%
 * 
 * @module core/effects/library/fiestalatina/AmazonMist
 * @version WAVE 1004.4
 */

import { BaseEffect } from '../../BaseEffect'
import { 
  EffectTriggerConfig, 
  EffectFrameOutput, 
  EffectCategory,
  EffectZone
} from '../../types'

// ═══════════════════════════════════════════════════════════════════════════
// 🌿 CONFIGURATION - JUNGLE BREATH
// ═══════════════════════════════════════════════════════════════════════════

interface AmazonMistConfig {
  /** Duración total del efecto (ms) */
  durationMs: number
  
  /** Periodo del ciclo de respiración (ms) */
  breathCycleMs: number
  
  /** Intensidad mínima (floor) */
  minIntensity: number
  
  /** Intensidad máxima (ceiling) */
  maxIntensity: number
  
  /** Duración del fade in inicial (ms) */
  fadeInMs: number
  
  /** Duración del fade out final (ms) */
  fadeOutMs: number
}

const DEFAULT_CONFIG: AmazonMistConfig = {
  durationMs: 4000,         // 8 segundos - efecto LONG
  breathCycleMs: 2000,      // 6 segundos por respiración completa
  minIntensity: 0.08,       // 8% floor - casi oscuridad
  maxIntensity: 0.25,       // 25% ceiling - tenue pero visible
  fadeInMs: 500,           // 1.5s fade in suave
  fadeOutMs: 1000,          // 2s fade out muy suave
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 PALETA DE LA SELVA
// ═══════════════════════════════════════════════════════════════════════════

const JUNGLE_PALETTE = {
  // Verde Selva Profundo - La vegetación densa
  VERDE_SELVA: { h: 140, s: 70, l: 25 },
  
  // Turquesa Agua - Los ríos amazónicos
  TURQUESA_AGUA: { h: 175, s: 60, l: 35 },
  
  // Verde Musgo - El suelo húmedo
  VERDE_MUSGO: { h: 95, s: 50, l: 20 },
}

// ═══════════════════════════════════════════════════════════════════════════
// 🌿 AMAZON MIST CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class AmazonMist extends BaseEffect {
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect properties
  // ─────────────────────────────────────────────────────────────────────────
  
  readonly effectType = 'amazon_mist'
  readonly name = 'Amazon Mist'
  readonly category: EffectCategory = 'color'  // Es un efecto de ambiente, no físico
  readonly priority = 30  // BAJA prioridad - es background
  readonly mixBus = 'htp' as const  // HTP - se mezcla suavemente
  
  // ─────────────────────────────────────────────────────────────────────────
  // Internal state
  // ─────────────────────────────────────────────────────────────────────────
  
  private config: AmazonMistConfig
  private currentIntensity = 0
  private breathPhase = 0  // 0-2π para el seno
  
  // ─────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────
  
  constructor(config?: Partial<AmazonMistConfig>) {
    super('amazon_mist')
    this.config = { ...DEFAULT_CONFIG, ...config }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect implementation
  // ─────────────────────────────────────────────────────────────────────────
  
  trigger(config: EffectTriggerConfig): void {
    super.trigger(config)
    
    // Zonas: Front y Back solamente (movers en MODO FANTASMA)
    this.zones = ['front', 'back', 'movers']
    
    // Reset state
    this.currentIntensity = 0
    this.breathPhase = 0
    
    console.log(`[AmazonMist 🌿] JUNGLE AWAKENS - Duration=${this.config.durationMs}ms`)
    console.log(`[AmazonMist 🌿] DNA: A=0.05 C=0.20 O=0.95 (SILENCE ZONE)`)
  }
  
  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    
    this.elapsedMs += deltaMs
    
    // Verificar fin del efecto
    if (this.elapsedMs >= this.config.durationMs) {
      this.phase = 'finished'
      console.log(`[AmazonMist 🌿] The jungle rests...`)
      return
    }
    
    // Calcular fase de respiración (sinusoidal)
    const cycleProgress = (this.elapsedMs % this.config.breathCycleMs) / this.config.breathCycleMs
    this.breathPhase = cycleProgress * Math.PI * 2
    
    // Calcular intensidad base (sinusoidal 0-1)
    const breathValue = (Math.sin(this.breathPhase) + 1) / 2  // 0 a 1
    
    // Mapear a rango de intensidad
    let baseIntensity = this.config.minIntensity + 
                        (this.config.maxIntensity - this.config.minIntensity) * breathValue
    
    // Aplicar envelope de fade in/out
    baseIntensity *= this.calculateEnvelope()
    
    this.currentIntensity = baseIntensity
  }
  
  private calculateEnvelope(): number {
    const { fadeInMs, fadeOutMs, durationMs } = this.config
    
    // Fade in
    if (this.elapsedMs < fadeInMs) {
      return this.elapsedMs / fadeInMs
    }
    
    // Fade out
    const fadeOutStart = durationMs - fadeOutMs
    if (this.elapsedMs > fadeOutStart) {
      return (durationMs - this.elapsedMs) / fadeOutMs
    }
    
    // Sustain
    return 1.0
  }
  
  private calculateColor(): { h: number; s: number; l: number } {
    // Interpolar entre Verde Selva y Turquesa según la respiración
    const t = (Math.sin(this.breathPhase) + 1) / 2
    
    const from = JUNGLE_PALETTE.VERDE_SELVA
    const to = JUNGLE_PALETTE.TURQUESA_AGUA
    
    return {
      h: from.h + (to.h - from.h) * t,
      s: from.s + (to.s - from.s) * t,
      l: from.l + (to.l - from.l) * t,
    }
  }
  
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null
    
    const color = this.calculateColor()
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🚨 MOVER LAW: Efecto LONG (8000ms >= 2000ms)
    // MODO FANTASMA para movers: Solo dimmer, sin color
    // Los PARs front/back sí reciben color
    // ═══════════════════════════════════════════════════════════════════════
    
    return {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress: this.elapsedMs / this.config.durationMs,
      zones: this.zones,
      intensity: this.currentIntensity,
      
      dimmerOverride: this.currentIntensity,
      colorOverride: color,
      
      // NO strobe - esto es paz pura
      strobeRate: undefined,
      
      // NO global override - se mezcla con el ambiente
      globalOverride: false,
      
      // � WAVE 1009: FREEDOM DAY - Zone overrides CON COLOR
      zoneOverrides: {
        front: {
          dimmer: this.currentIntensity,
          color: color,
        },
        back: {
          dimmer: this.currentIntensity,
          color: color,
        },
        // � MOVERS: ¡LIBERTAD! - Reciben color de selva
        movers: {
          color: color,  // 🔓 Verde/Cyan de la selva para movers
          dimmer: this.currentIntensity * 0.5,  // Movers aún más tenues
        },
      },
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Getters
  // ─────────────────────────────────────────────────────────────────────────
  
  getDurationMs(): number {
    return this.config.durationMs
  }
  
  getCurrentIntensity(): number {
    return this.currentIntensity
  }
  
  getBreathPhase(): number {
    return this.breathPhase
  }
}

export default AmazonMist
