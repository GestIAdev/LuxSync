/**
 *  ABYSSAL JELLYFISH - Medusa Bioluminiscente en MIDNIGHT (6000+m)
 * WAVE 1070.6: CHROMATIC RENAISSANCE
 * 
 * COLORES: Magenta y cyan bioluminiscente (medusas del abismo)
 * HSL FORMAT: h(0-360), s(0-100), l(0-100) - Standard para TitanOrchestrator
 */

import { BaseEffect } from '../../BaseEffect'
import { EffectTriggerConfig, EffectFrameOutput, EffectCategory } from '../../types'

interface AbyssalJellyfishConfig {
  durationMs: number
  peakIntensity: number
  colorRotationMs: number
}

const DEFAULT_CONFIG: AbyssalJellyfishConfig = {
  durationMs: 12000,
  peakIntensity: 0.95,
  colorRotationMs: 3000,
}

//  COLORES BIOLUMINISCENTES (HSL: h=0-360, s=0-100, l=0-100)
const BIOLUMINESCENT_PALETTE = {
  leftColors: [
    { h: 300, s: 95, l: 42 },  // Magenta brillante
    { h: 285, s: 90, l: 38 },  // Púrpura
    { h: 270, s: 85, l: 45 },  // Violeta
    { h: 315, s: 88, l: 40 },  // Rosa fuerte
  ],
  rightColors: [
    { h: 165, s: 95, l: 50 },  // Cyan eléctrico
    { h: 180, s: 90, l: 45 },  // Turquesa
    { h: 195, s: 85, l: 52 },  // Azul agua
    { h: 150, s: 88, l: 48 },  // Verde agua
  ],
}

export class AbyssalJellyfish extends BaseEffect {
  readonly effectType = 'abyssal_jellyfish'
  readonly name = 'Abyssal Jellyfish'
  readonly category: EffectCategory = 'physical'
  readonly priority = 65
  readonly mixBus = 'htp' as const
  
  private config: AbyssalJellyfishConfig
  private colorIndex: number = 0
  private lastColorRotation: number = 0
  
  constructor(config?: Partial<AbyssalJellyfishConfig>) {
    super('abyssal_jellyfish')
    this.config = { ...DEFAULT_CONFIG, ...config }
  }
  
  trigger(triggerConfig: EffectTriggerConfig): void {
    super.trigger(triggerConfig)
    this.colorIndex = 0
    this.lastColorRotation = Date.now()
    console.log(`[ AbyssalJellyfish] TRIGGERED! 6-ZONE STEREO BIOLUMINESCENCE`)
  }

  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    this.elapsedMs += deltaMs
    
    const now = Date.now()
    if (now - this.lastColorRotation > this.config.colorRotationMs) {
      this.colorIndex = (this.colorIndex + 1) % BIOLUMINESCENT_PALETTE.leftColors.length
      this.lastColorRotation = now
    }
    
    if (this.elapsedMs >= this.config.durationMs) {
      this.phase = 'finished'
    }
  }
  
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null
    const progress = this.elapsedMs / this.config.durationMs
    
    // Envelope
    let envelope: number
    if (progress < 0.10) { envelope = progress / 0.10 }
    else if (progress < 0.85) { envelope = 1.0 }
    else { envelope = 1 - ((progress - 0.85) / 0.15) }
    
    // Pulso bioluminiscente
    const pulsePhase = progress * Math.PI * 8
    const pulse = (Math.sin(pulsePhase) + 1) / 2 * 0.25 + 0.75
    
    // Colores para cada lado
    const leftColor = BIOLUMINESCENT_PALETTE.leftColors[this.colorIndex]
    const rightColor = BIOLUMINESCENT_PALETTE.rightColors[this.colorIndex]
    
    // Onda de intensidad
    const waveOffset = Math.sin(progress * Math.PI * 4) * 0.15
    const frontIntensity = (0.9 + waveOffset) * pulse
    const backIntensity = (0.75 - waveOffset) * pulse
    
    // Movimiento de deriva
    const driftPan = Math.sin(progress * Math.PI * 2) * 20
    const driftTilt = Math.cos(progress * Math.PI * 3) * 15
    
    const output: EffectFrameOutput = {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      zones: ['frontL', 'frontR', 'backL', 'backR', 'movers_left', 'movers_right'],
      intensity: this.triggerIntensity * envelope * this.config.peakIntensity,
      zoneOverrides: {},
    }

    // Stereo split: Left=Magenta, Right=Cyan
    output.zoneOverrides!['frontL'] = {
      dimmer: frontIntensity * envelope * this.config.peakIntensity,
      color: leftColor,
      blendMode: 'max' as const,
    }
    output.zoneOverrides!['frontR'] = {
      dimmer: frontIntensity * envelope * this.config.peakIntensity,
      color: rightColor,
      blendMode: 'max' as const,
    }
    output.zoneOverrides!['backL'] = {
      dimmer: backIntensity * envelope * this.config.peakIntensity,
      color: leftColor,
      blendMode: 'max' as const,
    }
    output.zoneOverrides!['backR'] = {
      dimmer: backIntensity * envelope * this.config.peakIntensity,
      color: rightColor,
      blendMode: 'max' as const,
    }
    output.zoneOverrides!['movers_left'] = {
      dimmer: pulse * envelope * this.config.peakIntensity * 0.80,
      color: leftColor,
      blendMode: 'max' as const,
      movement: { pan: driftPan - 30, tilt: driftTilt - 10 },
    }
    output.zoneOverrides!['movers_right'] = {
      dimmer: pulse * envelope * this.config.peakIntensity * 0.80,
      color: rightColor,
      blendMode: 'max' as const,
      movement: { pan: driftPan + 30, tilt: driftTilt + 5 },
    }
    return output
  }
  
  isFinished(): boolean { return this.phase === 'finished' }
  abort(): void { this.phase = 'finished' }
}