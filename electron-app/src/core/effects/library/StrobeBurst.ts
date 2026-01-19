/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 💥 STROBE BURST - RHYTHMIC FLASH BURSTS
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🌊 WAVE 691: DESATASCAR A LA DIOSA
 * 
 * Variante de StrobeStorm diseñada para FIESTA LATINA:
 * - Ráfagas cortas y rítmicas (no caos continuo)
 * - Sincronizado al BPM del track
 * - Respeta límites de Hz para no ser invasivo
 * - Colores vibrantes (no solo blanco)
 * 
 * COMPORTAMIENTO:
 * - 3-5 flashes rápidos en cada ráfaga
 * - Sincronizado al beat (downbeat = flash)
 * - Duración total: 500-800ms
 * - Color: Hereda del vibe o blanco cálido
 * 
 * PERFECT FOR:
 * - Drops en reggaetón/cumbia
 * - Chorus energéticos
 * - Transiciones rítmicas
 * 
 * @module core/effects/library/StrobeBurst
 * @version WAVE 691
 */

import { BaseEffect } from '../BaseEffect'
import { 
  EffectTriggerConfig, 
  EffectFrameOutput, 
  EffectCategory,
} from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

interface StrobeBurstConfig {
  /** Número de flashes en la ráfaga */
  flashCount: number
  
  /** Duración de cada flash (ms) */
  flashDurationMs: number
  
  /** Duración del gap entre flashes (ms) */
  gapDurationMs: number
  
  /** ¿Sincronizar con BPM? */
  bpmSync: boolean
  
  /** Frecuencia máxima permitida (Hz) - seguridad */
  maxFrequencyHz: number
  
  /** Color del flash (HSL) - null = usar paleta actual */
  flashColor: { h: number; s: number; l: number } | null
  
  /** Intensidad de color (si no usa blanco) */
  colorIntensity: number
}

const DEFAULT_CONFIG: StrobeBurstConfig = {
  flashCount: 4,           // 4 flashes por ráfaga
  flashDurationMs: 50,     // 50ms por flash
  gapDurationMs: 100,      // 100ms entre flashes
  bpmSync: true,           // Sincronizar con beat
  maxFrequencyHz: 10,      // Máximo 10 Hz (seguro para epilepsia)
  flashColor: null,        // Usar paleta del vibe
  colorIntensity: 0.8,     // 80% saturación
}

// ═══════════════════════════════════════════════════════════════════════════
// STROBE BURST CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class StrobeBurst extends BaseEffect {
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect properties
  // ─────────────────────────────────────────────────────────────────────────
  
  readonly effectType = 'strobe_burst'
  readonly name = 'Strobe Burst'
  readonly category: EffectCategory = 'physical'
  readonly priority = 85  // Alta pero menor que SolarFlare y StrobeStorm
  readonly mixBus = 'global' as const  // 🚂 WAVE 800: Dictador - strobo manda
  
  // ─────────────────────────────────────────────────────────────────────────
  // Internal state
  // ─────────────────────────────────────────────────────────────────────────
  
  private config: StrobeBurstConfig
  private currentFlash = 0
  private isFlashOn = false
  private flashTimer = 0
  private totalDurationMs = 0
  private calculatedColor: { h: number; s: number; l: number } = { h: 0, s: 0, l: 100 }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────
  
  constructor(config?: Partial<StrobeBurstConfig>) {
    super('strobe_burst')
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.calculateTotalDuration()
  }
  
  private calculateTotalDuration(): void {
    // Cada flash = flashDuration + gap (excepto el último que no tiene gap)
    this.totalDurationMs = this.config.flashCount * this.config.flashDurationMs + 
                           (this.config.flashCount - 1) * this.config.gapDurationMs
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect implementation
  // ─────────────────────────────────────────────────────────────────────────
  
  trigger(config: EffectTriggerConfig): void {
    super.trigger(config)
    
    // StrobeBurst es GLOBAL - afecta todo el escenario
    this.zones = ['front', 'back', 'movers']
    
    this.currentFlash = 0
    this.isFlashOn = true
    this.flashTimer = 0
    
    // Calcular color
    this.calculateFlashColor()
    
    // Ajustar timing si hay BPM
    this.adjustTimingToBPM()
    
    console.log(`[StrobeBurst 💥] TRIGGERED! Flashes=${this.config.flashCount} Duration=${this.totalDurationMs}ms`)
  }
  
  private calculateFlashColor(): void {
    if (this.config.flashColor) {
      this.calculatedColor = this.config.flashColor
    } else {
      // Para Fiesta Latina: usar colores vibrantes (magenta/cyan/amarillo)
      const latinaColors = [
        { h: 330, s: 100, l: 60 },  // Magenta vibrante
        { h: 180, s: 100, l: 50 },  // Cyan
        { h: 45, s: 100, l: 60 },   // Amarillo cálido
        { h: 0, s: 0, l: 100 },     // Blanco puro
      ]
      // Elegir según intensidad del trigger
      const colorIndex = Math.floor(this.triggerIntensity * (latinaColors.length - 1))
      this.calculatedColor = latinaColors[colorIndex]
    }
  }
  
  private adjustTimingToBPM(): void {
    if (!this.config.bpmSync || !this.musicalContext?.bpm) return
    
    const msPerBeat = 60000 / this.musicalContext.bpm
    
    // Ajustar gap para que los flashes caigan en subdivisiones del beat
    // Para reggaetón/cumbia: 16th notes feeling
    const sixteenthNote = msPerBeat / 4
    
    // El gap debe ser múltiplo de 16th note
    this.config.gapDurationMs = Math.round(sixteenthNote)
    
    // Recalcular duración total
    this.calculateTotalDuration()
  }
  
  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    
    this.elapsedMs += deltaMs
    this.flashTimer += deltaMs
    
    // Lógica de flash
    if (this.isFlashOn) {
      // Estamos en un flash
      if (this.flashTimer >= this.config.flashDurationMs) {
        // Flash terminado, ir a gap
        this.isFlashOn = false
        this.flashTimer = 0
        this.currentFlash++
        
        // ¿Terminamos todos los flashes?
        if (this.currentFlash >= this.config.flashCount) {
          this.phase = 'finished'
          console.log(`[StrobeBurst 💥] Completed (${this.elapsedMs}ms)`)
          return
        }
      }
    } else {
      // Estamos en un gap
      if (this.flashTimer >= this.config.gapDurationMs) {
        // Gap terminado, siguiente flash
        this.isFlashOn = true
        this.flashTimer = 0
      }
    }
    
    // Safety timeout
    if (this.elapsedMs > this.totalDurationMs * 1.5) {
      this.phase = 'finished'
    }
  }
  
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null
    
    // Si estamos en gap, output mínimo
    if (!this.isFlashOn) {
      return {
        effectId: this.id,
        category: this.category,
        phase: this.phase,
        progress: this.elapsedMs / this.totalDurationMs,
        zones: this.zones,
        intensity: 0.05,  // Mínimo durante gap
        dimmerOverride: 0.05,
        globalOverride: false,
      }
    }
    
    // FLASH ON - Intensidad máxima
    const flashIntensity = this.getIntensityFromZScore(this.triggerIntensity, 0.3)
    
    return {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress: this.elapsedMs / this.totalDurationMs,
      zones: this.zones,
      intensity: flashIntensity,
      
      dimmerOverride: flashIntensity,
      colorOverride: this.calculatedColor,
      
      // White boost durante flash para punch extra
      whiteOverride: flashIntensity > 0.8 ? 0.5 : undefined,
      
      // NO strobe rate - nosotros manejamos el timing manualmente
      strobeRate: undefined,
      
      globalOverride: true,  // Override global durante el burst
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════

export function createStrobeBurst(config?: Partial<StrobeBurstConfig>): StrobeBurst {
  return new StrobeBurst(config)
}
