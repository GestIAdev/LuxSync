/**
 * 🌊 SURFACE SHIMMER - Destellos Sutiles en SHALLOWS (0-1000m)
 * WAVE 1072: AMBIENT FAUNA - Tier 2 (Frequent/Subtle)
 * 
 * DESCRIPCIÓN: Pequeños destellos que imitan la luz del sol refractándose
 * en la superficie del agua. Efecto sutil y constante.
 * 
 * COLORES: Tonos esmeralda brillante y oro pálido
 * HSL FORMAT: h(0-360), s(0-100), l(0-100)
 * 
 * ZONA: SHALLOWS exclusivamente
 * COOLDOWN: 15s (más frecuente que SolarCaustics)
 */

import { BaseEffect } from '../../BaseEffect'
import { EffectTriggerConfig, EffectFrameOutput, EffectCategory } from '../../types'

interface SurfaceShimmerConfig {
  durationMs: number
  shimmerCount: number
  peakIntensity: number
}

const DEFAULT_CONFIG: SurfaceShimmerConfig = {
  durationMs: 2500,      // Más corto que SolarCaustics
  shimmerCount: 5,       // Varios destellos pequeños
  peakIntensity: 0.45,   // Intensidad sutil
}

// 🌊 COLORES SUPERFICIE: Esmeralda brillante + oro pálido
const SHIMMER_COLORS = [
  { h: 155, s: 75, l: 60 },   // Esmeralda claro
  { h: 165, s: 80, l: 55 },   // Verde mar
  { h: 50, s: 60, l: 70 },    // Oro pálido (sol)
  { h: 145, s: 70, l: 65 },   // Agua verde
]

export class SurfaceShimmer extends BaseEffect {
  readonly effectType = 'surface_shimmer'
  readonly name = 'Surface Shimmer'
  readonly category: EffectCategory = 'physical'  // 'physical' porque mueve luz espacialmente
  readonly priority = 40                           // Prioridad más baja (efecto de fondo)
  readonly mixBus = 'htp' as const                 // HTP - El más brillante gana
  
  private config: SurfaceShimmerConfig
  private shimmerOffsets: number[] = []
  
  constructor(config?: Partial<SurfaceShimmerConfig>) {
    super('surface_shimmer')
    this.config = { ...DEFAULT_CONFIG, ...config }
  }
  
  trigger(triggerConfig: EffectTriggerConfig): void {
    super.trigger(triggerConfig)
    
    // Offsets determinísticos basados en timestamp del trigger
    // NO usamos Math.random() - Axioma Anti-Simulación
    const baseSeed = Date.now()
    this.shimmerOffsets = Array.from({ length: this.config.shimmerCount }, 
      (_, i) => ((baseSeed + i * 137) % 100) / 100  // 137 es primo = buena distribución
    )
    
    console.log(`[🌊 SurfaceShimmer] TRIGGERED! Shimmers=${this.config.shimmerCount}`)
  }

  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    this.elapsedMs += deltaMs
    if (this.elapsedMs >= this.config.durationMs) {
      this.phase = 'finished'
    }
  }
  
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null
    
    const progress = this.elapsedMs / this.config.durationMs
    
    // Envelope suave: fade in lento, fade out lento
    let envelope: number
    if (progress < 0.2) {
      envelope = progress / 0.2  // 20% fade in
    } else if (progress < 0.7) {
      envelope = 1.0
    } else {
      envelope = 1 - ((progress - 0.7) / 0.3)  // 30% fade out
    }
    
    // Calcular shimmer combinado de todos los destellos
    let shimmerValue = 0
    for (let i = 0; i < this.shimmerOffsets.length; i++) {
      const offset = this.shimmerOffsets[i]
      const shimmerPhase = (progress * 3 + offset) * Math.PI * 2
      const singleShimmer = Math.max(0, Math.sin(shimmerPhase))
      shimmerValue += singleShimmer / this.shimmerOffsets.length
    }
    
    const intensity = envelope * this.config.peakIntensity * shimmerValue
    
    // Color que varía sutilmente con el tiempo
    const colorIndex = Math.floor((progress * SHIMMER_COLORS.length * 2) % SHIMMER_COLORS.length)
    const shimmerColor = SHIMMER_COLORS[colorIndex]
    
    // Output estructurado según EffectFrameOutput
    const output: EffectFrameOutput = {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      zones: ['frontL', 'frontR', 'backL', 'backR'],  // Solo PARs, no movers
      intensity: this.triggerIntensity * intensity,
      zoneOverrides: {},
    }
    
    // Front: Mayor intensidad (superficie del agua)
    output.zoneOverrides!['frontL'] = {
      dimmer: intensity,
      color: shimmerColor,
      blendMode: 'max' as const,
    }
    output.zoneOverrides!['frontR'] = {
      dimmer: intensity * 0.85,  // Ligera asimetría natural
      color: shimmerColor,
      blendMode: 'max' as const,
    }
    
    // Back: Sutil (luz que penetra hacia abajo)
    output.zoneOverrides!['backL'] = {
      dimmer: intensity * 0.3,
      color: shimmerColor,
      blendMode: 'max' as const,
    }
    output.zoneOverrides!['backR'] = {
      dimmer: intensity * 0.25,
      color: shimmerColor,
      blendMode: 'max' as const,
    }
    
    return output
  }
  
  // Validar que solo se dispare en SHALLOWS
  static isValidForZone(zone: string): boolean {
    return zone === 'SHALLOWS'
  }
}
