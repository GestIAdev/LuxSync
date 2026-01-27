/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌙 CUMBIA MOON - OLA DE LUZ SUAVE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 692: FIESTA LATINA EFFECT ARSENAL
 * 
 * CONCEPTO:
 * Un "respiro" de luz que sube y baja suavemente - como la luna sobre el mar.
 * NO es un flash. NO es harsh. Es SUAVE y ENVOLVENTE.
 * 
 * COMPORTAMIENTO:
 * - Sube lentamente (2-3 segundos)
 * - Mantiene un pico breve
 * - Baja lentamente (2-3 segundos)
 * - Colores: violeta tropical → cyan → azul profundo
 * 
 * PHYSICS:
 * - Curva sinusoidal suave (ease-in-out)
 * - Intensidad máxima relativamente baja (~60%)
 * - Color shift durante el ciclo
 * 
 * DIFERENCIA CON GHOSTBREATH:
 * - GhostBreath: Solo prende, mono-color, solo front
 * - CumbiaMoon: Sube Y BAJA, multi-color, ALL zones con globalOverride
 * 
 * PERFECT FOR:
 * - Breakdown suaves
 * - Momentos de "respiro" en la música
 * - Transiciones lentas
 * - Cuando la energía baja pero no quieres oscuridad total
 * 
 * @module core/effects/library/CumbiaMoon
 * @version WAVE 692
 */

import { BaseEffect } from '../../BaseEffect'
import {
  EffectTriggerConfig,
  EffectFrameOutput,
  EffectCategory,
  EffectZone,  // 🎚️ WAVE 780: Para zoneOverrides
} from '../../types'

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

interface CumbiaMoonConfig {
  /** Duración total del ciclo (ms) */
  cycleDurationMs: number
  
  /** Intensidad máxima en el pico (0-1) */
  peakIntensity: number
  
  /** Intensidad mínima (floor) */
  floorIntensity: number
  
  /** Duración del sustain en el pico (ms) */
  peakSustainMs: number
  
  /** Colores del ciclo (interpolados durante el efecto) */
  colorCycle: Array<{ h: number; s: number; l: number }>
  
  /** ¿Sincronizar con BPM? */
  bpmSync: boolean
  
  /** Beats por ciclo (si bpmSync=true) */
  beatsPerCycle: number
}

const DEFAULT_CONFIG: CumbiaMoonConfig = {
  cycleDurationMs: 3000,  // 🌙 WAVE 750: 3 segundos - más corto
  peakIntensity: 0.30,     // 🌙 WAVE 785: 30% máximo - lunitas sutiles
  floorIntensity: 0.15,   // 🌙 WAVE 750: Casi apagado
  peakSustainMs: 400,     // 🌙 WAVE 750: Sustain breve
  // 🌙 WAVE 785: PLATA LUNAR - azul pálido que insinúa, no grita
  colorCycle: [
    { h: 210, s: 10, l: 60 },   // Plata tenue (inicio)
    { h: 210, s: 10, l: 70 },   // Plata lunar (pico) - INSINUACIÓN
    { h: 210, s: 10, l: 55 },   // Plata oscura (final)
  ],
  bpmSync: true,
  beatsPerCycle: 4,  // 🌙 WAVE 750: 4 beats = más rápido
}

// ═══════════════════════════════════════════════════════════════════════════
// CUMBIA MOON CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class CumbiaMoon extends BaseEffect {
  readonly effectType = 'cumbia_moon'
  readonly name = 'Cumbia Moon'
  readonly category: EffectCategory = 'physical'
  readonly priority = 65  // Baja prioridad - es ambient
  readonly mixBus = 'global' as const  // 🚂 WAVE 800: Dictador - necesita silencio para brillar
  
  private config: CumbiaMoonConfig
  private currentIntensity = 0
  private currentColor: { h: number; s: number; l: number }
  private actualCycleDurationMs = 5000
  
  constructor(config?: Partial<CumbiaMoonConfig>) {
    super('cumbia_moon')
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.currentColor = { ...this.config.colorCycle[0] }
  }
  
  trigger(config: EffectTriggerConfig): void {
    super.trigger(config)
    
    // Calcular duración basada en BPM si está activado
    this.calculateCycleDuration()
    
    console.log(`[CumbiaMoon 🌙] TRIGGERED! Duration=${this.actualCycleDurationMs}ms Peak=${(this.config.peakIntensity * 100).toFixed(0)}%`)
  }
  
  private calculateCycleDuration(): void {
    if (this.config.bpmSync && this.musicalContext?.bpm) {
      const msPerBeat = 60000 / this.musicalContext.bpm
      this.actualCycleDurationMs = msPerBeat * this.config.beatsPerCycle
    } else {
      this.actualCycleDurationMs = this.config.cycleDurationMs
    }
    
    // Clamp a un rango razonable
    this.actualCycleDurationMs = Math.max(2000, Math.min(8000, this.actualCycleDurationMs))
  }
  
  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    
    this.elapsedMs += deltaMs
    
    // Check if finished
    if (this.elapsedMs >= this.actualCycleDurationMs) {
      this.phase = 'finished'
      console.log(`[CumbiaMoon 🌙] Completed (${this.elapsedMs}ms)`)
      return
    }
    
    // Calculate current position in cycle (0-1)
    const cycleProgress = this.elapsedMs / this.actualCycleDurationMs
    
    // Calculate intensity using smooth bell curve
    this.currentIntensity = this.calculateBellIntensity(cycleProgress)
    
    // Update color based on progress
    this.updateColor(cycleProgress)
  }
  
  private calculateBellIntensity(progress: number): number {
    const { peakIntensity, floorIntensity, peakSustainMs } = this.config
    const sustainRatio = peakSustainMs / this.actualCycleDurationMs
    
    // Dividir el ciclo en: rise (40%), sustain (20%), fall (40%)
    const riseEnd = 0.4 - sustainRatio / 2
    const sustainEnd = 0.6 + sustainRatio / 2
    
    let intensity: number
    
    if (progress < riseEnd) {
      // Rising phase - smooth ease-in-out
      const riseProgress = progress / riseEnd
      intensity = this.easeInOutSine(riseProgress)
    } else if (progress < sustainEnd) {
      // Sustain at peak
      intensity = 1.0
    } else {
      // Falling phase - smooth ease-in-out
      const fallProgress = (progress - sustainEnd) / (1 - sustainEnd)
      intensity = 1 - this.easeInOutSine(fallProgress)
    }
    
    // Scale to range [floor, peak]
    return (floorIntensity + (peakIntensity - floorIntensity) * intensity) * this.triggerIntensity
  }
  
  private easeInOutSine(t: number): number {
    return -(Math.cos(Math.PI * t) - 1) / 2
  }
  
  private updateColor(progress: number): void {
    const colors = this.config.colorCycle
    
    if (colors.length === 1) {
      this.currentColor = { ...colors[0] }
      return
    }
    
    // Interpolar entre colores basado en progress
    const scaledProgress = progress * (colors.length - 1)
    const colorIndex = Math.floor(scaledProgress)
    const blendFactor = scaledProgress - colorIndex
    
    const currentColor = colors[Math.min(colorIndex, colors.length - 1)]
    const nextColor = colors[Math.min(colorIndex + 1, colors.length - 1)]
    
    // Interpolación circular para hue (el camino más corto)
    let hueDiff = nextColor.h - currentColor.h
    if (hueDiff > 180) hueDiff -= 360
    if (hueDiff < -180) hueDiff += 360
    
    this.currentColor = {
      h: (currentColor.h + hueDiff * blendFactor + 360) % 360,
      s: currentColor.s + (nextColor.s - currentColor.s) * blendFactor,
      l: currentColor.l + (nextColor.l - currentColor.l) * blendFactor,
    }
  }
  
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null
    
    // � WAVE 1010.6: MOVER COLOR FREEDOM - HAL traduce RGB→ColorWheel seguro
    // CumbiaMoon ahora puede dar BLANCO (plata lunar) a los movers
    // El traductor HAL tiene múltiples medidas de seguridad para EL-1140
    
    // Color blanco lunar (plata brillante)
    const moonWhite = { h: 0, s: 0, l: 95 }  // BLANCO puro (sin tinte)
    
    const zoneOverrides: EffectFrameOutput['zoneOverrides'] = {
      'front': {
        color: moonWhite,  // Blanco lunar en front
        dimmer: this.currentIntensity,
        blendMode: 'max',
      },
      'back': {
        color: moonWhite,  // Blanco lunar en back
        dimmer: this.currentIntensity * 0.7,  // Back más tenue (atmósfera)
        blendMode: 'max',
      },
      // � WAVE 1010.6: MOVERS reciben BLANCO - HAL traduce a DMX seguro
      'movers': {
        color: moonWhite,  // ✅ BLANCO lunar para movers (HAL traduce a Color Wheel)
        dimmer: this.currentIntensity * 0.5,  // Movers muy sutiles (luna suave)
        blendMode: 'max',
      },
    }

    return {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress: this.elapsedMs / this.actualCycleDurationMs,
      zones: Object.keys(zoneOverrides) as EffectZone[],
      intensity: this.currentIntensity,
      
      dimmerOverride: undefined,
      colorOverride: undefined,
      
      globalOverride: false,
      zoneOverrides,
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════

export function createCumbiaMoon(config?: Partial<CumbiaMoonConfig>): CumbiaMoon {
  return new CumbiaMoon(config)
}
