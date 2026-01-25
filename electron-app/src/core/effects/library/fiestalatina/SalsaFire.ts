/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔥 SALSA FIRE - FUEGO DE PASIÓN
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 692: FIESTA LATINA EFFECT ARSENAL
 * 
 * CONCEPTO:
 * Ráfagas de rojo/naranja que simulan llamas bailando con la música.
 * Es fuego ORGÁNICO - no mecánico. Como las llamas reales, tiene variación.
 * 
 * COMPORTAMIENTO:
 * - Flicker rápido pero suave (no strobe harsh)
 * - Colores: rojo profundo → naranja → amarillo → back
 * - Intensidad varía de forma "caótica controlada"
 * - El fuego "respira" - nunca es constante
 * 
 * PHYSICS:
 * - Base intensity + random variation (Perlin-like noise)
 * - Color shifts based on intensity (más brillo = más amarillo)
 * - Duración corta pero impactante
 * 
 * PERFECT FOR:
 * - Momentos sensuales
 * - Cuando la música tiene "sabor"
 * - Solos de instrumentos
 * - Transiciones dramáticas
 * 
 * @module core/effects/library/SalsaFire
 * @version WAVE 692
 */

import { BaseEffect } from '../../BaseEffect'
import {
  EffectTriggerConfig,
  EffectFrameOutput,
  EffectCategory,
  EffectZone,  // 🚨 WAVE 1004.2: Para typing de zones
} from '../../types'

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

interface SalsaFireConfig {
  /** Duración total del efecto (ms) */
  durationMs: number
  
  /** Frecuencia del flicker (Hz) - más alto = más nervioso */
  flickerFrequency: number
  
  /** Rango de variación de intensidad (0-1) */
  intensityVariation: number
  
  /** Color base del fuego (rojo) */
  baseColor: { h: number; s: number; l: number }
  
  /** Color caliente (amarillo) - se usa cuando intensity es alta */
  hotColor: { h: number; s: number; l: number }
  
  /** Intensidad mínima (floor) */
  minIntensity: number
  
  /** Fade in duration (ms) */
  fadeInMs: number
  
  /** Fade out duration (ms) */
  fadeOutMs: number
}

const DEFAULT_CONFIG: SalsaFireConfig = {
  durationMs: 2500,
  flickerFrequency: 12,  // 12 Hz - fuego natural
  intensityVariation: 0.35,
  baseColor: { h: 10, s: 100, l: 45 },    // Rojo profundo
  hotColor: { h: 50, s: 100, l: 70 },     // Amarillo cálido
  minIntensity: 0.4,
  fadeInMs: 200,
  fadeOutMs: 400,
}

// ═══════════════════════════════════════════════════════════════════════════
// SALSA FIRE CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class SalsaFire extends BaseEffect {
  readonly effectType = 'salsa_fire'
  readonly name = 'Salsa Fire'
  readonly category: EffectCategory = 'physical'
  readonly priority = 72  // Entre strobe y ambient
  readonly mixBus = 'htp' as const  // 🌪️ WAVE 805: HTP - Fuego que suma energía
  
  private config: SalsaFireConfig
  private currentIntensity = 0
  private currentColor: { h: number; s: number; l: number }
  private noisePhase = 0  // Para el flicker pseudo-random
  private noiseSpeed = 0
  
  constructor(config?: Partial<SalsaFireConfig>) {
    super('salsa_fire')
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.currentColor = { ...this.config.baseColor }
  }
  
  trigger(config: EffectTriggerConfig): void {
    super.trigger(config)
    
    // Seed único para este disparo
    this.noisePhase = Date.now() % 1000
    this.noiseSpeed = this.config.flickerFrequency * 2 * Math.PI / 1000
    
    console.log(`[SalsaFire 🔥] TRIGGERED! Duration=${this.config.durationMs}ms Flicker=${this.config.flickerFrequency}Hz`)
  }
  
  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    
    this.elapsedMs += deltaMs
    this.noisePhase += deltaMs * this.noiseSpeed
    
    // Check if finished
    if (this.elapsedMs >= this.config.durationMs) {
      this.phase = 'finished'
      console.log(`[SalsaFire 🔥] Completed (${this.elapsedMs}ms)`)
      return
    }
    
    // Calculate envelope (fade in/out)
    const envelope = this.calculateEnvelope()
    
    // Calculate flicker intensity using multiple sine waves (pseudo-Perlin)
    const flicker = this.calculateFlicker()
    
    // Final intensity
    const baseIntensity = this.config.minIntensity + 
      (1 - this.config.minIntensity) * flicker
    
    this.currentIntensity = baseIntensity * envelope * this.triggerIntensity
    
    // Update color based on intensity (hotter = more yellow)
    this.updateColor()
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
      return 1 - (this.elapsedMs - fadeOutStart) / fadeOutMs
    }
    
    // Sustain
    return 1
  }
  
  private calculateFlicker(): number {
    // Múltiples ondas sinusoidales con frecuencias diferentes
    // Esto crea un patrón de "ruido" más orgánico que random
    const wave1 = Math.sin(this.noisePhase) * 0.5
    const wave2 = Math.sin(this.noisePhase * 2.3) * 0.3  // Frecuencia irracional
    const wave3 = Math.sin(this.noisePhase * 0.7) * 0.2
    
    // Combinar y normalizar a 0-1
    const combined = (wave1 + wave2 + wave3 + 1) / 2
    
    // Aplicar variación
    const variation = this.config.intensityVariation
    return (1 - variation) + (combined * variation * 2)
  }
  
  private updateColor(): void {
    const { baseColor, hotColor } = this.config
    
    // Interpolar entre base (rojo) y hot (amarillo) según intensidad
    const hotFactor = Math.pow(this.currentIntensity, 2)  // Cuadrático para que el amarillo solo aparezca en picos
    
    this.currentColor = {
      h: baseColor.h + (hotColor.h - baseColor.h) * hotFactor,
      s: baseColor.s,
      l: baseColor.l + (hotColor.l - baseColor.l) * hotFactor,
    }
  }
  
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null
    
    // 🚨 WAVE 1004.2: MOVER LAW ENFORCEMENT
    // SalsaFire es LONG (2500ms) → Solo dimmer para movers, NO color
    // Front/Back SÍ pueden tener color (flicker de fuego)
    const zoneOverrides: EffectFrameOutput['zoneOverrides'] = {
      'front': {
        color: this.currentColor,
        dimmer: this.currentIntensity,
        blendMode: 'max',
      },
      'back': {
        color: this.currentColor,
        dimmer: this.currentIntensity * 0.8,  // Back un poco más suave
        blendMode: 'max',
      },
      // 🚨 WAVE 1004.2: MOVER LAW - Solo dimmer (física decide color)
      'movers': {
        dimmer: this.currentIntensity * 0.6,  // Movers más sutiles que PARs
        blendMode: 'max',
        // NO COLOR → La rueda mecánica o física decide
      },
    }

    return {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress: this.elapsedMs / this.config.durationMs,
      zones: Object.keys(zoneOverrides) as EffectZone[],
      intensity: this.currentIntensity,
      
      // 🚨 WAVE 1004.2: Eliminado dimmerOverride/colorOverride globales
      dimmerOverride: undefined,
      colorOverride: undefined,
      
      globalOverride: false,  // � WAVE 1004.2: Ya no es global, usa zoneOverrides
      zoneOverrides,
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════

export function createSalsaFire(config?: Partial<SalsaFireConfig>): SalsaFire {
  return new SalsaFire(config)
}
