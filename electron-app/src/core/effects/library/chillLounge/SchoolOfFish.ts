/**
 * 🐟 SCHOOL OF FISH - Banco de Peces en OCEAN (1000-3000m)
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 1073: OCEANIC CALIBRATION - Movimiento más LENTO y FLOTANTE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * CONCEPTO: Un cardumen de peces tropicales cruzando lentamente el espacio.
 * El movimiento es DELIBERADO y SERENO - nadan, no huyen.
 * 
 * COLORES: Cyan y turquesa (peces tropicales)
 * HSL FORMAT: h(0-360), s(0-100), l(0-100)
 */

import { BaseEffect } from '../../BaseEffect'
import { EffectTriggerConfig, EffectFrameOutput, EffectCategory } from '../../types'

interface SchoolOfFishConfig {
  durationMs: number
  peakIntensity: number
  fishCount: number
}

const DEFAULT_CONFIG: SchoolOfFishConfig = {
  durationMs: 7000,         // 🌊 WAVE 1073: 7 segundos (MUCHO más lento)
  peakIntensity: 0.85,
  fishCount: 5,             // 🌊 WAVE 1073: Menos peces = shimmer más lento
}

// 🐟 COLORES PECES: Cyan y turquesa (HSL: h=0-360, s=0-100, l=0-100)
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
  readonly mixBus = 'htp' as const  // 🌊 WAVE 1073.1: HTP para no romper marea (global=blackout)
  
  private config: SchoolOfFishConfig
  private direction: 'LtoR' | 'RtoL' = 'LtoR'
  
  constructor(config?: Partial<SchoolOfFishConfig>) {
    super('school_of_fish')
    this.config = { ...DEFAULT_CONFIG, ...config }
  }
  
  trigger(triggerConfig: EffectTriggerConfig): void {
    super.trigger(triggerConfig)
    this.direction = Date.now() % 2 === 0 ? 'LtoR' : 'RtoL'
    console.log(`[🐟 SchoolOfFish] TRIGGERED! Direction=${this.direction}, Duration=${this.config.durationMs}ms`)
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
    
    // Envelope MUY suave para chill
    let envelope: number
    if (progress < 0.15) { 
      envelope = (progress / 0.15) ** 1.5  // Fade in suave
    } else if (progress < 0.75) { 
      envelope = 1.0 
    } else { 
      envelope = ((1 - progress) / 0.25) ** 1.5  // Fade out largo
    }
    
    // 🌊 WAVE 1073: Posición de la ola de peces MÁS LENTA
    // Antes: progress * 1.3 - 0.15 (muy rápido)
    // Ahora: progress * 1.1 (casi 1:1 con el tiempo)
    let wavePosition = progress * 1.1 - 0.05
    if (this.direction === 'RtoL') { wavePosition = 1 - wavePosition }
    
    // 🌊 WAVE 1073: Shimmer de peces más SUTIL y LENTO
    const fishPhase = progress * this.config.fishCount * Math.PI  // Reducido de *2
    const fishPulse = (Math.sin(fishPhase) + 1) / 2 * 0.2 + 0.8  // Menos variación
    
    // Posiciones de zonas en el espacio
    const zonePositions: Record<string, number> = {
      frontL: 0.0, backL: 0.15, movers_left: 0.30,
      movers_right: 0.70, backR: 0.85, frontR: 1.0,
    }
    const waveWidth = 0.40  // 🌊 WAVE 1073: Ola más ancha = transición más suave
    
    // Calcular intensidad por distancia a la ola
    const getZoneIntensity = (zonePos: number): number => {
      const distance = Math.abs(zonePos - wavePosition)
      if (distance > waveWidth) return 0
      const normalized = distance / waveWidth
      return Math.exp(-normalized * normalized * 2) * fishPulse  // Menos agudo
    }
    
    // Color basado en posición relativa
    const getZoneColor = (zonePos: number) => {
      const relativePos = (zonePos - wavePosition + 0.5)
      const colorIndex = Math.floor(Math.abs(relativePos * FISH_COLORS.length * 1.5)) % FISH_COLORS.length
      return FISH_COLORS[colorIndex]
    }
    
    // 🌊 WAVE 1073: Movimiento de movers MUCHO más lento
    const basePan = (wavePosition - 0.5) * 50  // Reducido de 80 a 50
    const tiltWobble = Math.sin(progress * Math.PI * 2) * 3  // Muy sutil
    
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
      blendMode: 'max' as const,  // 🌊 WAVE 1073.1: max para HTP
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
    // 🌊 WAVE 1073: Movers con movimiento ULTRA LENTO
    output.zoneOverrides!['movers_left'] = {
      dimmer: getZoneIntensity(zonePositions.movers_left) * envelope * this.config.peakIntensity * 0.90,
      color: getZoneColor(zonePositions.movers_left),
      blendMode: 'max' as const,
      movement: { 
        pan: basePan - 10, 
        tilt: tiltWobble - 5,
        isAbsolute: false,
        speed: 0.2,  // 🌊 WAVE 1073: Velocidad 0.2 = flotante
      },
    }
    output.zoneOverrides!['movers_right'] = {
      dimmer: getZoneIntensity(zonePositions.movers_right) * envelope * this.config.peakIntensity * 0.90,
      color: getZoneColor(zonePositions.movers_right),
      blendMode: 'max' as const,
      movement: { 
        pan: basePan + 10, 
        tilt: tiltWobble + 3,
        isAbsolute: false,
        speed: 0.2,
      },
    }
    return output
  }
  
  isFinished(): boolean { return this.phase === 'finished' }
  abort(): void { this.phase = 'finished' }
}