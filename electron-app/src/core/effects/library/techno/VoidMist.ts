/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌫️ VOID MIST - NEBLINA DEL VACÍO
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🔬 WAVE 938: ATMOSPHERIC ARSENAL (PunkOpus)
 * 
 * FILOSOFÍA:
 * Neblina espectral que flota como humo en un club oscuro.
 * Cada fixture respira independientemente con su propio ritmo.
 * Perfecto para crear ambiente denso en momentos vacíos.
 * 
 * COMPORTAMIENTO:
 * - MixBus: 'htp' (ADITIVO - flota sobre física)
 * - Pars: Dimmer bajo (0.05-0.15), fade lento (4-6s), cada uno con offset random
 * - Movers: Pan oscila MUY lento (±30° en 8 compases), Tilt fijo horizontal
 * - Usa sine wave con offset aleatorio → cada luz respira independiente
 * 
 * COLORES:
 * - DARK PURPLE (#1a0033) → MIDNIGHT BLUE (#000a1f)
 * - Transición suave durante el efecto
 * 
 * ZONAS:
 * - Perfecto para silence, valley (momentos vacíos antes del drop)
 * - Ideal para crear tensión atmosférica sin ruido visual
 * 
 * @module core/effects/library/techno/VoidMist
 * @version WAVE 938 - ATMOSPHERIC ARSENAL (PunkOpus)
 */

import { BaseEffect } from '../../BaseEffect'
import { 
  EffectTriggerConfig, 
  EffectFrameOutput, 
  EffectCategory
} from '../../types'

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

interface VoidMistConfig {
  /** Duración total del efecto (ms) */
  durationMs: number
  
  /** Intensidad mínima de pars */
  minIntensity: number
  
  /** Intensidad máxima de pars */
  maxIntensity: number
  
  /** Período de la onda de respiración (ms) */
  breathPeriodMs: number
  
  /** Velocidad de oscilación de pan en movers (grados por segundo) */
  panSpeed: number
  
  /** Amplitud de pan (±grados) */
  panAmplitude: number
}

const DEFAULT_CONFIG: VoidMistConfig = {
  durationMs: 12000,         // 12 segundos - neblina larga
  minIntensity: 0.05,
  maxIntensity: 0.15,
  breathPeriodMs: 5000,      // 5s por ciclo de respiración
  panSpeed: 3.75,            // 3.75°/s → ±30° en 8 compases (120 BPM)
  panAmplitude: 30,          // ±30° de oscilación
}

// ═══════════════════════════════════════════════════════════════════════════
// VOID MIST EFFECT
// ═══════════════════════════════════════════════════════════════════════════

export class VoidMist extends BaseEffect {
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect properties
  // ─────────────────────────────────────────────────────────────────────────
  
  readonly effectType = 'void_mist'
  readonly name = 'Void Mist'
  readonly category: EffectCategory = 'physical'  // Afecta dimmer
  readonly priority = 35  // Muy baja - efecto de fondo
  readonly mixBus = 'htp' as const  // ADITIVO - flota sobre física
  
  // ─────────────────────────────────────────────────────────────────────────
  // Internal state
  // ─────────────────────────────────────────────────────────────────────────
  
  private config: VoidMistConfig
  private panOffset: number = 0
  
  // Offset aleatorio por zona para respiración independiente
  private breathOffsets: Map<string, number> = new Map()
  
  // ─────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────
  
  constructor(config?: Partial<VoidMistConfig>) {
    super('void_mist')
    this.config = { ...DEFAULT_CONFIG, ...config }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect implementation
  // ─────────────────────────────────────────────────────────────────────────
  
  trigger(triggerConfig: EffectTriggerConfig): void {
    super.trigger(triggerConfig)
    
    this.panOffset = 0
    this.breathOffsets.clear()
    
    // Generar offsets aleatorios para cada zona (0-2π)
    const zones = ['front', 'pars', 'back', 'movers']
    zones.forEach(zone => {
      this.breathOffsets.set(zone, Math.random() * 2 * Math.PI)
    })
    
    console.log(`[VoidMist 🌫️] TRIGGERED! Duration=${this.config.durationMs}ms BreathPeriod=${this.config.breathPeriodMs}ms`)
  }

  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    
    this.elapsedMs += deltaMs
    
    // Pan de movers: oscilación MUY lenta (sine wave)
    const panPhase = (this.elapsedMs / 1000) * this.config.panSpeed * (Math.PI / 180)
    this.panOffset = Math.sin(panPhase) * this.config.panAmplitude
    
    // Check si terminó
    if (this.elapsedMs >= this.config.durationMs) {
      this.phase = 'finished'
      console.log(`[VoidMist 🌫️] FINISHED (${this.config.durationMs}ms)`)
    }
  }
  
  /**
   * 📤 GET OUTPUT - Devuelve el output del frame actual
   * 🌫️ WAVE 938: VOID MIST - Cada zona respira independiente
   */
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null

    const progress = this.elapsedMs / this.config.durationMs

    const output: EffectFrameOutput = {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      zones: ['front', 'pars', 'back', 'movers'],
      intensity: this.triggerIntensity,
      zoneOverrides: {},
    }

    // ═════════════════════════════════════════════════════════════════════
    // COLOR TRANSITION: DARK PURPLE → MIDNIGHT BLUE
    // ═════════════════════════════════════════════════════════════════════
    const hue = 270 - progress * 50 // 270 (purple) → 220 (midnight blue)
    const baseColor = { h: hue, s: 100, l: 10 } // Muy oscuro

    // ═════════════════════════════════════════════════════════════════════
    // PARS: Respiración independiente por zona
    // ═════════════════════════════════════════════════════════════════════
    const parZones = ['front', 'pars', 'back'] as const
    
    parZones.forEach(zone => {
      const offset = this.breathOffsets.get(zone) || 0
      const breathPhase = (this.elapsedMs / this.config.breathPeriodMs) * 2 * Math.PI + offset
      
      // Sine wave: 0 → 1 → 0 (respiración)
      const breathIntensity = (Math.sin(breathPhase) + 1) / 2
      const dimmer = this.config.minIntensity + 
        breathIntensity * (this.config.maxIntensity - this.config.minIntensity)
      
      output.zoneOverrides![zone] = {
        dimmer,
        color: baseColor,
        blendMode: 'max' as const,
      }
    })

    // ═════════════════════════════════════════════════════════════════════
    // MOVERS: Pan oscilante lento, Tilt horizontal, respiración propia
    // ═════════════════════════════════════════════════════════════════════
    const moverOffset = this.breathOffsets.get('movers') || 0
    const moverBreathPhase = (this.elapsedMs / this.config.breathPeriodMs) * 2 * Math.PI + moverOffset
    const moverBreathIntensity = (Math.sin(moverBreathPhase) + 1) / 2
    const moverDimmer = this.config.minIntensity + 
      moverBreathIntensity * (this.config.maxIntensity - this.config.minIntensity)
    
    output.zoneOverrides!['movers'] = {
      dimmer: moverDimmer,
      color: baseColor,
      blendMode: 'max' as const,
      movement: {
        pan: this.panOffset,
        tilt: 0, // Horizontal
      },
    }

    return output
  }
  
  isFinished(): boolean {
    return this.phase === 'finished'
  }
  
  abort(): void {
    this.phase = 'finished'
    console.log(`[VoidMist 🌫️] Aborted`)
  }
}
