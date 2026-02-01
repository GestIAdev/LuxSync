/**
 *  SCHOOL OF FISH - Banco de Peces en OCEAN (1000-3000m)
 * WAVE 1070.6: CHROMATIC RENAISSANCE
 * 
 * COLORES: Cyan y turquesa (peces tropicales)
 * HSL FORMAT: h(0-360), s(0-100), l(0-100) - Standard para TitanOrchestrator
 */

import { BaseEffect } from '../../BaseEffect'
import { EffectTriggerConfig, EffectFrameOutput, EffectCategory } from '../../types'

interface SchoolOfFishConfig {
  durationMs: number
  peakIntensity: number
  fishCount: number
}

const DEFAULT_CONFIG: SchoolOfFishConfig = {
  durationMs: 3500,
  peakIntensity: 0.90,
  fishCount: 7,
}

//  COLORES PECES: Cyan y turquesa (HSL: h=0-360, s=0-100, l=0-100)
const FISH_COLORS = [
  { h: 185, s: 85, l: 55 },  // Cyan vibrante
  { h: 195, s: 70, l: 60 },  // Azul agua
  { h: 170, s: 90, l: 50 },  // Turquesa
  { h: 200, s: 60, l: 65 },  // Azul claro
]

export class SchoolOfFish extends BaseEffect {
  readonly effectType = 'school_of_fish'
  readonly name = 'School of Fish'
  readonly category: EffectCategory = 'physical'
  readonly priority = 70
  readonly mixBus = 'htp' as const
  
  private config: SchoolOfFishConfig
  private direction: 'LtoR' | 'RtoL' = 'LtoR'
  
  constructor(config?: Partial<SchoolOfFishConfig>) {
    super('school_of_fish')
    this.config = { ...DEFAULT_CONFIG, ...config }
  }
  
  trigger(triggerConfig: EffectTriggerConfig): void {
    super.trigger(triggerConfig)
    this.direction = Date.now() % 2 === 0 ? 'LtoR' : 'RtoL'
    console.log(`[ SchoolOfFish] TRIGGERED! Direction=${this.direction}`)
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
    
    // Envelope
    let envelope: number
    if (progress < 0.08) { envelope = progress / 0.08 }
    else if (progress < 0.80) { envelope = 1.0 }
    else { envelope = 1 - ((progress - 0.80) / 0.20) }
    
    // Posición de la ola de peces
    let wavePosition = progress * 1.3 - 0.15
    if (this.direction === 'RtoL') { wavePosition = 1 - wavePosition }
    
    // Shimmer de peces
    const fishPhase = progress * this.config.fishCount * Math.PI * 2
    const fishPulse = (Math.sin(fishPhase) + 1) / 2 * 0.3 + 0.7
    
    // Posiciones de zonas en el espacio
    const zonePositions: Record<string, number> = {
      frontL: 0.0, backL: 0.15, movers_left: 0.30,
      movers_right: 0.70, backR: 0.85, frontR: 1.0,
    }
    const waveWidth = 0.35
    
    // Calcular intensidad por distancia a la ola
    const getZoneIntensity = (zonePos: number): number => {
      const distance = Math.abs(zonePos - wavePosition)
      if (distance > waveWidth) return 0
      const normalized = distance / waveWidth
      return Math.exp(-normalized * normalized * 3) * fishPulse
    }
    
    // Color basado en posición relativa
    const getZoneColor = (zonePos: number) => {
      const relativePos = (zonePos - wavePosition + 0.5)
      const colorIndex = Math.floor(Math.abs(relativePos * FISH_COLORS.length * 2)) % FISH_COLORS.length
      return FISH_COLORS[colorIndex]
    }
    
    // Movimiento de movers siguiendo el cardumen
    const basePan = (wavePosition - 0.5) * 80
    const tiltWobble = Math.sin(progress * Math.PI * 6) * 5
    
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
      dimmer: getZoneIntensity(zonePositions.frontL) * envelope * this.config.peakIntensity,
      color: getZoneColor(zonePositions.frontL),
      blendMode: 'max' as const,
    }
    output.zoneOverrides!['frontR'] = {
      dimmer: getZoneIntensity(zonePositions.frontR) * envelope * this.config.peakIntensity,
      color: getZoneColor(zonePositions.frontR),
      blendMode: 'max' as const,
    }
    output.zoneOverrides!['backL'] = {
      dimmer: getZoneIntensity(zonePositions.backL) * envelope * this.config.peakIntensity * 0.85,
      color: getZoneColor(zonePositions.backL),
      blendMode: 'max' as const,
    }
    output.zoneOverrides!['backR'] = {
      dimmer: getZoneIntensity(zonePositions.backR) * envelope * this.config.peakIntensity * 0.85,
      color: getZoneColor(zonePositions.backR),
      blendMode: 'max' as const,
    }
    output.zoneOverrides!['movers_left'] = {
      dimmer: getZoneIntensity(zonePositions.movers_left) * envelope * this.config.peakIntensity * 0.90,
      color: getZoneColor(zonePositions.movers_left),
      blendMode: 'max' as const,
      movement: { pan: basePan - 15, tilt: tiltWobble - 10 },
    }
    output.zoneOverrides!['movers_right'] = {
      dimmer: getZoneIntensity(zonePositions.movers_right) * envelope * this.config.peakIntensity * 0.90,
      color: getZoneColor(zonePositions.movers_right),
      blendMode: 'max' as const,
      movement: { pan: basePan + 15, tilt: tiltWobble + 5 },
    }
    return output
  }
  
  isFinished(): boolean { return this.phase === 'finished' }
  abort(): void { this.phase = 'finished' }
}