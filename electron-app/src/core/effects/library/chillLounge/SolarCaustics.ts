/**
 *  SOLAR CAUSTICS - Rayos de Sol en SHALLOWS (0-1000m)
 * WAVE 1070.6: CHROMATIC RENAISSANCE
 * 
 * COLORES: Dorados y ámbar cálidos (rayos de sol atravesando agua)
 * HSL FORMAT: h(0-360), s(0-100), l(0-100) - Standard para TitanOrchestrator
 */

import { BaseEffect } from '../../BaseEffect'
import { EffectTriggerConfig, EffectFrameOutput, EffectCategory } from '../../types'

interface SolarCausticsConfig {
  durationMs: number
  peakIntensity: number
  rayCount: number
}

const DEFAULT_CONFIG: SolarCausticsConfig = {
  durationMs: 4000,
  peakIntensity: 0.85,
  rayCount: 5,
}

//  COLORES SOLARES: Dorados y ámbar (HSL: h=0-360, s=0-100, l=0-100)
const SUNLIGHT_COLORS = [
  { h: 45, s: 95, l: 65 },   // Dorado brillante
  { h: 35, s: 90, l: 60 },   // Ámbar cálido
  { h: 55, s: 85, l: 70 },   // Amarillo sol
  { h: 40, s: 92, l: 58 },   // Oro profundo
]

export class SolarCaustics extends BaseEffect {
  readonly effectType = 'solar_caustics'
  readonly name = 'Solar Caustics'
  readonly category: EffectCategory = 'physical'
  readonly priority = 68
  readonly mixBus = 'htp' as const
  
  private config: SolarCausticsConfig
  private rayPhases: number[] = []
  
  constructor(config?: Partial<SolarCausticsConfig>) {
    super('solar_caustics')
    this.config = { ...DEFAULT_CONFIG, ...config }
    // Fases iniciales aleatorias para cada rayo
    for (let i = 0; i < this.config.rayCount; i++) {
      this.rayPhases.push(Math.PI * 2 * (i / this.config.rayCount))
    }
  }
  
  trigger(triggerConfig: EffectTriggerConfig): void {
    super.trigger(triggerConfig)
    console.log(`[ SolarCaustics] TRIGGERED! ${this.config.rayCount} rays of light`)
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
    
    // Envelope suave
    let envelope: number
    if (progress < 0.15) { envelope = progress / 0.15 }
    else if (progress < 0.75) { envelope = 1.0 }
    else { envelope = 1 - ((progress - 0.75) / 0.25) }
    
    // Patrón de cáusticas: múltiples ondas superpuestas
    const causticsIntensity = (zone: number): number => {
      let total = 0
      for (let i = 0; i < this.rayPhases.length; i++) {
        const phase = this.rayPhases[i] + progress * Math.PI * 4
        const wave = Math.sin(phase + zone * Math.PI * 2) * 0.5 + 0.5
        total += wave
      }
      return (total / this.rayPhases.length) * 0.6 + 0.4
    }
    
    // Shimmer (destello)
    const shimmer = Math.sin(progress * Math.PI * 12) * 0.15 + 0.85
    
    // Seleccionar color basado en progreso
    const colorIndex = Math.floor((progress * 2) % SUNLIGHT_COLORS.length)
    const color = SUNLIGHT_COLORS[colorIndex]
    
    const output: EffectFrameOutput = {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      zones: ['frontL', 'frontR', 'backL', 'backR', 'movers_left', 'movers_right'],
      intensity: this.triggerIntensity * envelope * this.config.peakIntensity,
      zoneOverrides: {},
    }

    // Frente: máxima luz solar
    output.zoneOverrides!['frontL'] = {
      dimmer: causticsIntensity(0.0) * shimmer * envelope * this.config.peakIntensity,
      color: color,
      blendMode: 'max' as const,
    }
    output.zoneOverrides!['frontR'] = {
      dimmer: causticsIntensity(0.25) * shimmer * envelope * this.config.peakIntensity,
      color: color,
      blendMode: 'max' as const,
    }
    
    // Atrás: reflejos más suaves
    output.zoneOverrides!['backL'] = {
      dimmer: causticsIntensity(0.5) * shimmer * envelope * this.config.peakIntensity * 0.7,
      color: { h: color.h + 5, s: color.s - 10, l: color.l + 5 },
      blendMode: 'max' as const,
    }
    output.zoneOverrides!['backR'] = {
      dimmer: causticsIntensity(0.75) * shimmer * envelope * this.config.peakIntensity * 0.7,
      color: { h: color.h + 5, s: color.s - 10, l: color.l + 5 },
      blendMode: 'max' as const,
    }
    
    // Movers: Barren suavemente como rayos de luz
    const moverPan = Math.sin(progress * Math.PI * 2) * 25
    const moverTilt = Math.cos(progress * Math.PI * 3) * 10 - 15  // Apuntando ligeramente arriba
    
    output.zoneOverrides!['movers_left'] = {
      dimmer: causticsIntensity(0.3) * shimmer * envelope * this.config.peakIntensity * 0.8,
      color: color,
      blendMode: 'max' as const,
      movement: { pan: moverPan - 20, tilt: moverTilt },
    }
    output.zoneOverrides!['movers_right'] = {
      dimmer: causticsIntensity(0.7) * shimmer * envelope * this.config.peakIntensity * 0.8,
      color: color,
      blendMode: 'max' as const,
      movement: { pan: moverPan + 20, tilt: moverTilt + 5 },
    }
    
    return output
  }
  
  isFinished(): boolean { return this.phase === 'finished' }
  abort(): void { this.phase = 'finished' }
}