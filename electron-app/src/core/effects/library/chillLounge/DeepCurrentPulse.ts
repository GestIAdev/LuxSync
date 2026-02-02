/**
 * 🌀 DEEP CURRENT PULSE - Pulsos de Corriente Profunda en TWILIGHT (3000-6000m)
 * WAVE 1072: AMBIENT FAUNA - Tier 2 (Frequent/Subtle)
 * 
 * DESCRIPCIÓN: Ondulaciones lentas que simulan corrientes oceánicas profundas.
 * La luz se mueve como si fuera arrastrada por una corriente invisible,
 * creando un efecto de presión oceánica y movimiento lento pero inexorable.
 * 
 * COLORES: Azul profundo e índigo (zona crepuscular)
 * HSL FORMAT: h(0-360), s(0-100), l(0-100)
 * 
 * ZONA: TWILIGHT exclusivamente (3000-6000m)
 * COOLDOWN: 25s
 */

import { BaseEffect } from '../../BaseEffect'
import { EffectTriggerConfig, EffectFrameOutput, EffectCategory } from '../../types'

interface DeepCurrentPulseConfig {
  durationMs: number
  waveSpeed: number      // Velocidad de la corriente
  peakIntensity: number
  /** 🌀 WAVE 1083.1: Intensidad mínima garantizada (supera noise floor) */
  minIntensity: number
}

const DEFAULT_CONFIG: DeepCurrentPulseConfig = {
  durationMs: 5000,      // Lento y majestuoso
  waveSpeed: 0.3,        // Muy lento
  peakIntensity: 0.90,   // 🌀 WAVE 1083.1: RESCATE LUMÍNICO - Sin límites artificiales
  minIntensity: 0.55,    // 🌀 WAVE 1083.1: Supera noise floor TWILIGHT (0.25)
}

// 🌀 COLORES TWILIGHT: Azul profundo e índigo
const CURRENT_COLORS = [
  { h: 230, s: 70, l: 35 },   // Azul profundo
  { h: 245, s: 60, l: 30 },   // Índigo
  { h: 220, s: 75, l: 40 },   // Azul medio
  { h: 255, s: 55, l: 28 },   // Violeta oscuro
]

export class DeepCurrentPulse extends BaseEffect {
  readonly effectType = 'deep_current_pulse'
  readonly name = 'Deep Current Pulse'
  readonly category: EffectCategory = 'physical'  
  readonly priority = 38                           
  readonly mixBus = 'htp' as const
  
  private config: DeepCurrentPulseConfig
  private currentDirection: 'forward' | 'backward' = 'forward'
  
  constructor(config?: Partial<DeepCurrentPulseConfig>) {
    super('deep_current_pulse')
    this.config = { ...DEFAULT_CONFIG, ...config }
  }
  
  trigger(triggerConfig: EffectTriggerConfig): void {
    super.trigger(triggerConfig)
    
    // Dirección determinística basada en timestamp
    // NO usamos Math.random() - Axioma Anti-Simulación
    this.currentDirection = Date.now() % 2 === 0 ? 'forward' : 'backward'
    
    console.log(`[🌀 DeepCurrentPulse] TRIGGERED! Direction=${this.currentDirection}`)
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
    
    // Envelope con plateau largo (corriente constante)
    let envelope: number
    if (progress < 0.15) {
      envelope = progress / 0.15
    } else if (progress < 0.80) {
      envelope = 1.0
    } else {
      envelope = 1 - ((progress - 0.80) / 0.20)
    }
    
    // Onda de corriente que atraviesa el espacio
    let wavePosition = progress * (1 + this.config.waveSpeed * 2)
    if (this.currentDirection === 'backward') {
      wavePosition = 1 - wavePosition
    }
    
    // La "presión" de la corriente crea un pulso lento
    const pressurePulse = Math.sin(progress * Math.PI * 2) * 0.2 + 0.8
    
    // Posiciones de zonas en el flujo de la corriente
    const zoneFlowPositions: Record<string, number> = {
      frontL: 0.1,
      frontR: 0.2,
      backL: 0.7,
      backR: 0.8,
      movers_left: 0.4,
      movers_right: 0.5,
    }
    
    const waveWidth = 0.5  // Corriente amplia
    
    // Calcular intensidad por posición en la corriente
    const getFlowIntensity = (zonePos: number): number => {
      const distance = Math.abs(zonePos - (wavePosition % 1.5))
      if (distance > waveWidth) return 0.1  // Siempre hay algo de corriente
      const normalized = distance / waveWidth
      // Curva más suave para corriente
      return Math.cos(normalized * Math.PI / 2) * 0.9 + 0.1
    }
    
    // 🌀 WAVE 1083.1: INTENSITY FLOOR - Garantizar visibilidad
    const effectiveIntensity = Math.max(
      this.triggerIntensity,
      this.config.minIntensity
    )
    
    const baseIntensity = envelope * this.config.peakIntensity * pressurePulse * effectiveIntensity
    
    // Color que cambia lentamente con la profundidad de la corriente
    const colorIndex = Math.floor((progress * CURRENT_COLORS.length * 0.5) % CURRENT_COLORS.length)
    const currentColor = CURRENT_COLORS[colorIndex]
    
    // Output estructurado
    const output: EffectFrameOutput = {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      zones: ['frontL', 'frontR', 'backL', 'backR', 'movers_left', 'movers_right'],
      // 🌀 WAVE 1083.1: RESCATE LUMÍNICO
      // baseIntensity YA contiene effectiveIntensity - NO multiplicar de nuevo
      intensity: baseIntensity,
      zoneOverrides: {},
    }
    
    // Aplicar flujo a cada zona
    output.zoneOverrides!['frontL'] = {
      dimmer: baseIntensity * getFlowIntensity(zoneFlowPositions.frontL),
      color: currentColor,
      blendMode: 'max' as const,
    }
    output.zoneOverrides!['frontR'] = {
      dimmer: baseIntensity * getFlowIntensity(zoneFlowPositions.frontR),
      color: currentColor,
      blendMode: 'max' as const,
    }
    output.zoneOverrides!['backL'] = {
      dimmer: baseIntensity * getFlowIntensity(zoneFlowPositions.backL),
      color: currentColor,
      blendMode: 'max' as const,
    }
    output.zoneOverrides!['backR'] = {
      dimmer: baseIntensity * getFlowIntensity(zoneFlowPositions.backR),
      color: currentColor,
      blendMode: 'max' as const,
    }
    
    // Movers: Lento movimiento horizontal siguiendo la corriente
    const moverPan = (wavePosition - 0.5) * 40  // ±40° de pan
    const moverTilt = Math.sin(progress * Math.PI) * 10 + 20  // Ligera ondulación
    
    output.zoneOverrides!['movers_left'] = {
      dimmer: baseIntensity * getFlowIntensity(zoneFlowPositions.movers_left),
      color: currentColor,
      blendMode: 'max' as const,
      movement: {
        pan: moverPan,
        tilt: moverTilt,
        isAbsolute: false,
        speed: 0.3,  // Muy lento
      }
    }
    output.zoneOverrides!['movers_right'] = {
      dimmer: baseIntensity * getFlowIntensity(zoneFlowPositions.movers_right),
      color: currentColor,
      blendMode: 'max' as const,
      movement: {
        pan: -moverPan,  // Opuesto para efecto de flujo
        tilt: moverTilt,
        isAbsolute: false,
        speed: 0.3,
      }
    }
    
    return output
  }
  
  // Validar que solo se dispare en TWILIGHT
  static isValidForZone(zone: string): boolean {
    return zone === 'TWILIGHT'
  }
}
