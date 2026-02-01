/**
 *  WHALE SONG - Canto de Ballena en TWILIGHT (3000-6000m)
 * WAVE 1070.6: CHROMATIC RENAISSANCE
 * 
 * COLORES: Índigo y violeta profundo (zona crepuscular)
 * HSL FORMAT: h(0-360), s(0-100), l(0-100) - Standard para TitanOrchestrator
 */

import { BaseEffect } from '../../BaseEffect'
import { EffectTriggerConfig, EffectFrameOutput, EffectCategory } from '../../types'

interface WhaleSongConfig {
  durationMs: number
  peakIntensity: number
  whaleWidth: number
}

const DEFAULT_CONFIG: WhaleSongConfig = {
  durationMs: 8000,
  peakIntensity: 0.80,
  whaleWidth: 0.45,
}

//  COLORES CREPUSCULARES: Índigo y violeta (HSL: h=0-360, s=0-100, l=0-100)
const TWILIGHT_COLORS = [
  { h: 240, s: 75, l: 35 },  // Índigo profundo
  { h: 260, s: 70, l: 40 },  // Violeta
  { h: 220, s: 80, l: 30 },  // Azul medianoche
  { h: 250, s: 65, l: 45 },  // Lavanda oscuro
]

export class WhaleSong extends BaseEffect {
  readonly effectType = 'whale_song'
  readonly name = 'Whale Song'
  readonly category: EffectCategory = 'physical'
  readonly priority = 72
  readonly mixBus = 'htp' as const
  
  private config: WhaleSongConfig
  private direction: 'LtoR' | 'RtoL' = 'LtoR'
  
  constructor(config?: Partial<WhaleSongConfig>) {
    super('whale_song')
    this.config = { ...DEFAULT_CONFIG, ...config }
  }
  
  trigger(triggerConfig: EffectTriggerConfig): void {
    super.trigger(triggerConfig)
    this.direction = Date.now() % 2 === 0 ? 'LtoR' : 'RtoL'
    console.log(`[ WhaleSong] TRIGGERED! Direction=${this.direction}`)
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
    
    // Envelope muy suave para ballena majestuosa
    let envelope: number
    if (progress < 0.20) { envelope = (progress / 0.20) ** 1.5 }
    else if (progress < 0.70) { envelope = 1.0 }
    else { envelope = 1 - ((progress - 0.70) / 0.30) ** 1.5 }
    
    // Posición de la ballena cruzando
    let whalePosition = progress * 1.4 - 0.2
    if (this.direction === 'RtoL') { whalePosition = 1 - whalePosition }
    
    // Respiración profunda de la ballena
    const breathCycle = Math.sin(progress * Math.PI * 2) * 0.2 + 0.8
    
    // Posiciones de zonas
    const zonePositions: Record<string, number> = {
      frontL: 0.0, backL: 0.20, movers_left: 0.35,
      movers_right: 0.65, backR: 0.80, frontR: 1.0,
    }
    
    // Calcular presencia de la ballena (más ancha que peces)
    const getWhalePresence = (zonePos: number): number => {
      const distance = Math.abs(zonePos - whalePosition)
      if (distance > this.config.whaleWidth) return 0
      const normalized = distance / this.config.whaleWidth
      return Math.exp(-normalized * normalized * 2) * breathCycle
    }
    
    // Color basado en progreso
    const colorIndex = Math.floor(progress * TWILIGHT_COLORS.length) % TWILIGHT_COLORS.length
    const color = TWILIGHT_COLORS[colorIndex]
    
    // Movimiento de movers: lento y majestuoso
    const moverPan = (whalePosition - 0.5) * 60  // Menor rango que peces
    const moverTilt = Math.sin(progress * Math.PI * 2) * 8 - 5  // Ondulación vertical
    
    const output: EffectFrameOutput = {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      zones: ['frontL', 'frontR', 'backL', 'backR', 'movers_left', 'movers_right'],
      intensity: this.triggerIntensity * envelope * this.config.peakIntensity,
      zoneOverrides: {},
    }

    output.zoneOverrides!['frontL'] = {
      dimmer: getWhalePresence(zonePositions.frontL) * envelope * this.config.peakIntensity,
      color: color,
      blendMode: 'max' as const,
    }
    output.zoneOverrides!['frontR'] = {
      dimmer: getWhalePresence(zonePositions.frontR) * envelope * this.config.peakIntensity,
      color: color,
      blendMode: 'max' as const,
    }
    output.zoneOverrides!['backL'] = {
      dimmer: getWhalePresence(zonePositions.backL) * envelope * this.config.peakIntensity * 0.80,
      color: color,
      blendMode: 'max' as const,
    }
    output.zoneOverrides!['backR'] = {
      dimmer: getWhalePresence(zonePositions.backR) * envelope * this.config.peakIntensity * 0.80,
      color: color,
      blendMode: 'max' as const,
    }
    output.zoneOverrides!['movers_left'] = {
      dimmer: getWhalePresence(zonePositions.movers_left) * envelope * this.config.peakIntensity * 0.85,
      color: color,
      blendMode: 'max' as const,
      movement: { pan: moverPan - 25, tilt: moverTilt - 8 },
    }
    output.zoneOverrides!['movers_right'] = {
      dimmer: getWhalePresence(zonePositions.movers_right) * envelope * this.config.peakIntensity * 0.85,
      color: color,
      blendMode: 'max' as const,
      movement: { pan: moverPan + 25, tilt: moverTilt + 3 },
    }
    return output
  }
  
  isFinished(): boolean { return this.phase === 'finished' }
  abort(): void { this.phase = 'finished' }
}