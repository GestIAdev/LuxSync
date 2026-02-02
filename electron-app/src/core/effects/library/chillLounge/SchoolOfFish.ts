/**
 * 🐟 SCHOOL OF FISH - Banco de Peces en OCEAN (1000-3000m)
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 1073: OCEANIC CALIBRATION - Movimiento más LENTO y FLOTANTE
 * WAVE 1085: CHILL LOUNGE FINAL POLISH
 *   - Organic easing curves (ease-in-out cubic)
 *   - Intensity floor: 0.7 (alto contraste para cardumen)
 *   - Atmospheric bed: 15% cyan tenue en todo el tanque
 *   - Long tail fade out (physics recovery)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * CONCEPTO: Un cardumen de peces tropicales cruzando lentamente el espacio.
 * El movimiento es DELIBERADO y SERENO - nadan, no huyen.
 * Los peces ACELERAN suavemente, cruzan rápido, FRENAN al salir.
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
  /** 🌊 WAVE 1085: Intensidad mínima garantizada (alto contraste) */
  minIntensity: number
  /** 🌊 WAVE 1085: Relleno atmosférico base */
  atmosphericBed: number
}

const DEFAULT_CONFIG: SchoolOfFishConfig = {
  durationMs: 7000,         // 🌊 WAVE 1073: 7 segundos (MUCHO más lento)
  peakIntensity: 0.85,
  fishCount: 5,             // 🌊 WAVE 1073: Menos peces = shimmer más lento
  minIntensity: 0.70,       // 🌊 WAVE 1085: Floor alto para contraste
  atmosphericBed: 0.15,     // 🌊 WAVE 1085: 15% atmósfera cyan base
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
    
    // 🌊 WAVE 1085: ORGANIC EASING - Ease-in-out cubic
    // Los peces aceleran suavemente, cruzan rápido, frenan al salir
    const easeInOutCubic = (t: number): number => 
      t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1
    
    const easedProgress = easeInOutCubic(progress)
    
    // 🌊 WAVE 1085: INTENSITY FLOOR - Garantizar visibilidad
    const effectiveIntensity = Math.max(
      this.triggerIntensity,
      this.config.minIntensity
    )
    
    // 🌊 WAVE 1085: Envelope con LONG TAIL (fade out extendido para inverse ducking)
    // Entrada: 15% | Sustain: 55% | Fade out LARGO: 30%
    let envelope: number
    if (progress < 0.15) { 
      envelope = easeInOutCubic(progress / 0.15)  // Entrada orgánica
    } else if (progress < 0.70) { 
      envelope = 1.0 
    } else { 
      // 🌊 WAVE 1085: LONG TAIL - La física "empuja" durante el fade
      const fadeOutProgress = (progress - 0.70) / 0.30
      envelope = (1 - fadeOutProgress) ** 2.5  // Curva más larga que cuadrática
    }
    
    // 🌊 WAVE 1085: ATMOSPHERIC BED - Capa base cyan tenue
    const atmosphericAmbient = this.config.atmosphericBed * envelope * effectiveIntensity
    
    // 🌊 WAVE 1073: Posición de la ola de peces con EASING
    let wavePosition = easedProgress * 1.1 - 0.05
    if (this.direction === 'RtoL') { wavePosition = 1 - wavePosition }
    
    // 🌊 WAVE 1073: Shimmer de peces más SUTIL y LENTO
    const fishPhase = easedProgress * this.config.fishCount * Math.PI
    const fishPulse = (Math.sin(fishPhase) + 1) / 2 * 0.2 + 0.8
    
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
    
    // 🌊 WAVE 1085: Color atmosférico base (cyan profundo)
    const atmosphericColor = { h: 188, s: 75, l: 45 }
    
    // 🌊 WAVE 1085: Movimiento de movers con EASING aplicado
    const basePan = (wavePosition - 0.5) * 50
    const tiltWobble = Math.sin(easedProgress * Math.PI * 2) * 3  // Easing en wobble
    
    // 🌊 WAVE 1085: Intensidad final con floor aplicado
    const finalPeakIntensity = this.config.peakIntensity * effectiveIntensity
    
    const output: EffectFrameOutput = {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      zones: ['frontL', 'frontR', 'backL', 'backR', 'movers_left', 'movers_right'],
      intensity: effectiveIntensity * envelope * this.config.peakIntensity,
      zoneOverrides: {},
    }

    // 🌊 WAVE 1085: Cada zona usa Math.max(fishIntensity, atmosphericBed)
    output.zoneOverrides!['frontL'] = {
      dimmer: Math.max(getZoneIntensity(zonePositions.frontL) * envelope * finalPeakIntensity, atmosphericAmbient),
      color: getZoneIntensity(zonePositions.frontL) > atmosphericAmbient ? getZoneColor(zonePositions.frontL) : atmosphericColor,
      blendMode: 'max' as const,
    }
    output.zoneOverrides!['frontR'] = {
      dimmer: Math.max(getZoneIntensity(zonePositions.frontR) * envelope * finalPeakIntensity, atmosphericAmbient),
      color: getZoneIntensity(zonePositions.frontR) > atmosphericAmbient ? getZoneColor(zonePositions.frontR) : atmosphericColor,
      blendMode: 'max' as const,
    }
    output.zoneOverrides!['backL'] = {
      dimmer: Math.max(getZoneIntensity(zonePositions.backL) * envelope * finalPeakIntensity * 0.85, atmosphericAmbient * 0.7),
      color: getZoneIntensity(zonePositions.backL) > atmosphericAmbient ? getZoneColor(zonePositions.backL) : atmosphericColor,
      blendMode: 'max' as const,
    }
    output.zoneOverrides!['backR'] = {
      dimmer: Math.max(getZoneIntensity(zonePositions.backR) * envelope * finalPeakIntensity * 0.85, atmosphericAmbient * 0.7),
      color: getZoneIntensity(zonePositions.backR) > atmosphericAmbient ? getZoneColor(zonePositions.backR) : atmosphericColor,
      blendMode: 'max' as const,
    }
    // 🌊 WAVE 1085: Movers con atmospheric bed + easing en movimiento
    output.zoneOverrides!['movers_left'] = {
      dimmer: Math.max(getZoneIntensity(zonePositions.movers_left) * envelope * finalPeakIntensity * 0.90, atmosphericAmbient),
      color: getZoneIntensity(zonePositions.movers_left) > atmosphericAmbient ? getZoneColor(zonePositions.movers_left) : atmosphericColor,
      blendMode: 'max' as const,
      movement: { 
        pan: basePan - 10, 
        tilt: tiltWobble - 5,
        isAbsolute: false,
        speed: 0.2,
      },
    }
    output.zoneOverrides!['movers_right'] = {
      dimmer: Math.max(getZoneIntensity(zonePositions.movers_right) * envelope * finalPeakIntensity * 0.90, atmosphericAmbient),
      color: getZoneIntensity(zonePositions.movers_right) > atmosphericAmbient ? getZoneColor(zonePositions.movers_right) : atmosphericColor,
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