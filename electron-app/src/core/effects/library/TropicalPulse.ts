/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌴 TROPICAL PULSE - EL LATIDO DEL CARIBE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 692: FIESTA LATINA EFFECT ARSENAL
 * 
 * CONCEPTO:
 * Pulsos de color que suben de intensidad como el ritmo de una conga.
 * No es un strobe frío - es un LATIDO cálido y orgánico.
 * 
 * COMPORTAMIENTO:
 * - 3-4 pulsos que van creciendo en intensidad
 * - Cada pulso es más brillante que el anterior (crescendo)
 * - Colores: coral → magenta → amarillo tropical
 * - Timing con "swing" latino (no mecánico como techno)
 * 
 * PHYSICS:
 * - BPM-synced pero con groove (±10% timing variation)
 * - Cada pulso dura ~200ms (attack) + ~300ms (decay)
 * - El último pulso es el más brillante (clímax)
 * 
 * PERFECT FOR:
 * - Momentos de energía media-alta
 * - Transiciones entre secciones
 * - Cuando la música "sube" pero no es el clímax
 * 
 * @module core/effects/library/TropicalPulse
 * @version WAVE 692
 */

import { BaseEffect } from '../BaseEffect'
import {
  EffectTriggerConfig,
  EffectFrameOutput,
  EffectCategory,
  EffectZone,
} from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

interface TropicalPulseConfig {
  /** Número de pulsos */
  pulseCount: number
  
  /** Duración del attack de cada pulso (ms) */
  pulseAttackMs: number
  
  /** Duración del decay de cada pulso (ms) */
  pulseDecayMs: number
  
  /** Gap entre pulsos (ms) - se ajusta al BPM */
  pulseGapMs: number
  
  /** ¿Sincronizar con BPM? */
  bpmSync: boolean
  
  /** Colores de la progresión (HSL) */
  colorProgression: Array<{ h: number; s: number; l: number }>
  
  /** Intensidad inicial del primer pulso (0-1) */
  startIntensity: number
  
  /** Intensidad final del último pulso (0-1) */
  endIntensity: number
  
  /** Swing factor (0 = mecánico, 0.2 = groove latino) */
  swingFactor: number
}

const DEFAULT_CONFIG: TropicalPulseConfig = {
  pulseCount: 4,  // 🌴 WAVE 750: 4 pulsos para más crescendo
  pulseAttackMs: 80,   // 🌴 WAVE 750: 80ms (SUPER snappy)
  pulseDecayMs: 150,   // 🌴 WAVE 750: 150ms (decay rápido)
  pulseGapMs: 200,     // 🌴 WAVE 750: 200ms gap
  bpmSync: true,
  colorProgression: [
    // 🌴 WAVE 750: PALETA VIBRANTE DEL ARQUITECTO
    { h: 16, s: 100, l: 65 },   // CORAL - cálido y acogedor
    { h: 174, s: 90, l: 50 },   // TURQUOISE - caribeño
    { h: 45, s: 100, l: 55 },   // GOLD - dorado tropical
    { h: 300, s: 95, l: 55 },   // MAGENTA - explosión final
  ],
  startIntensity: 0.65,  // 🌴 WAVE 750: Empezar con punch
  endIntensity: 1.0,     // 🌴 WAVE 750: Final a tope
  swingFactor: 0.15,     // Groove latino sutil
}

// ═══════════════════════════════════════════════════════════════════════════
// TROPICAL PULSE CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class TropicalPulse extends BaseEffect {
  readonly effectType = 'tropical_pulse'
  readonly name = 'Tropical Pulse'
  readonly category: EffectCategory = 'physical'  // HTP - brilla por encima
  readonly priority = 75
  
  private config: TropicalPulseConfig
  private currentPulse = 0
  private pulsePhase: 'attack' | 'decay' | 'gap' = 'attack'
  private phaseTimer = 0
  private currentColor: { h: number; s: number; l: number }
  private currentIntensity = 0
  private totalDurationMs = 0
  
  // Swing timing - cada pulso tiene timing ligeramente diferente
  private pulseTimings: number[] = []
  
  constructor(config?: Partial<TropicalPulseConfig>) {
    super('tropical_pulse')
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.currentColor = this.config.colorProgression[0]
  }
  
  trigger(config: EffectTriggerConfig): void {
    super.trigger(config)
    
    this.currentPulse = 0
    this.pulsePhase = 'attack'
    this.phaseTimer = 0
    this.currentIntensity = 0
    
    // Calcular timings con swing
    this.calculateSwingTimings()
    
    // Calcular duración total
    this.calculateTotalDuration()
    
    console.log(`[TropicalPulse 🌴] TRIGGERED! Pulses=${this.config.pulseCount} Duration=${this.totalDurationMs}ms Swing=${(this.config.swingFactor * 100).toFixed(0)}%`)
  }
  
  private calculateSwingTimings(): void {
    this.pulseTimings = []
    const baseGap = this.config.bpmSync && this.musicalContext?.bpm
      ? (60000 / this.musicalContext.bpm) / 2  // Eighth note
      : this.config.pulseGapMs
    
    for (let i = 0; i < this.config.pulseCount; i++) {
      // Swing: pulsos pares llegan un poco tarde, impares un poco temprano
      const swingOffset = i % 2 === 0 
        ? -this.config.swingFactor 
        : this.config.swingFactor
      
      const timing = baseGap * (1 + swingOffset)
      this.pulseTimings.push(Math.max(100, timing))
    }
  }
  
  private calculateTotalDuration(): void {
    const pulseDuration = this.config.pulseAttackMs + this.config.pulseDecayMs
    const totalGaps = this.pulseTimings.reduce((a, b) => a + b, 0)
    this.totalDurationMs = (pulseDuration * this.config.pulseCount) + totalGaps
  }
  
  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    
    this.elapsedMs += deltaMs
    this.phaseTimer += deltaMs
    
    // Estado de la máquina de pulsos
    switch (this.pulsePhase) {
      case 'attack':
        this.updateAttack()
        break
      case 'decay':
        this.updateDecay()
        break
      case 'gap':
        this.updateGap()
        break
    }
    
    // Actualizar color basado en el pulso actual
    this.updateColor()
  }
  
  private updateAttack(): void {
    const progress = Math.min(1, this.phaseTimer / this.config.pulseAttackMs)
    
    // Curva de ataque: ease-out para golpe inmediato
    const eased = 1 - Math.pow(1 - progress, 3)
    
    // Intensidad escala con el número de pulso (crescendo)
    const pulseIntensityFactor = this.currentPulse / (this.config.pulseCount - 1)
    const targetIntensity = this.config.startIntensity + 
      (this.config.endIntensity - this.config.startIntensity) * pulseIntensityFactor
    
    this.currentIntensity = eased * targetIntensity * this.triggerIntensity
    
    if (progress >= 1) {
      this.pulsePhase = 'decay'
      this.phaseTimer = 0
    }
  }
  
  private updateDecay(): void {
    const progress = Math.min(1, this.phaseTimer / this.config.pulseDecayMs)
    
    // Curva de decay: ease-in para caída suave
    const eased = Math.pow(progress, 2)
    
    const pulseIntensityFactor = this.currentPulse / (this.config.pulseCount - 1)
    const peakIntensity = this.config.startIntensity + 
      (this.config.endIntensity - this.config.startIntensity) * pulseIntensityFactor
    
    this.currentIntensity = (1 - eased) * peakIntensity * this.triggerIntensity
    
    if (progress >= 1) {
      this.currentPulse++
      
      if (this.currentPulse >= this.config.pulseCount) {
        this.phase = 'finished'
        console.log(`[TropicalPulse 🌴] Completed (${this.config.pulseCount} pulses, ${this.elapsedMs}ms)`)
        return
      }
      
      this.pulsePhase = 'gap'
      this.phaseTimer = 0
    }
  }
  
  private updateGap(): void {
    const gapDuration = this.pulseTimings[this.currentPulse] || this.config.pulseGapMs
    
    // Durante el gap, intensidad muy baja (no cero, para que no sea harsh)
    this.currentIntensity = 0.05 * this.triggerIntensity
    
    if (this.phaseTimer >= gapDuration) {
      this.pulsePhase = 'attack'
      this.phaseTimer = 0
    }
  }
  
  private updateColor(): void {
    // Interpolar color basado en el pulso actual
    const colorIndex = Math.min(
      this.currentPulse, 
      this.config.colorProgression.length - 1
    )
    
    const nextColorIndex = Math.min(
      colorIndex + 1, 
      this.config.colorProgression.length - 1
    )
    
    const currentColor = this.config.colorProgression[colorIndex]
    const nextColor = this.config.colorProgression[nextColorIndex]
    
    // Blend entre colores durante el pulso
    const blendFactor = this.pulsePhase === 'attack' 
      ? this.phaseTimer / this.config.pulseAttackMs 
      : 0
    
    this.currentColor = {
      h: currentColor.h + (nextColor.h - currentColor.h) * blendFactor * 0.3,
      s: currentColor.s,
      l: currentColor.l + (this.currentIntensity * 15),  // Más brillo con más intensidad
    }
  }
  
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null
    
    // � WAVE 750: COLORES COMPLEMENTARIOS POR ZONA
    // Front → Color actual de la progresión
    // Back → Color complementario (180° opuesto en el círculo cromático)
    
    const frontColor = {
      h: this.currentColor.h,
      s: this.currentColor.s,
      l: this.currentColor.l + (this.currentIntensity * 10)
    }
    
    // Complementario: +180° en el círculo cromático
    const backColor = {
      h: (this.currentColor.h + 180) % 360,
      s: this.currentColor.s,
      l: this.currentColor.l + (this.currentIntensity * 5)
    }
    
    // 🌴 WAVE 755: MICRO-STROBE - Rasgando la vista en el pico
    // Cuando intensity > 0.85, forzar white: 1.0 (chispa que rasga)
    const isAtPeak = this.currentIntensity > 0.85 && this.pulsePhase === 'attack'
    const microStrobe = isAtPeak ? 1.0 : undefined
    
    // 🎨 WAVE 740: zoneOverrides es la ÚNICA fuente de verdad
    const zoneOverrides = {
      'front': {
        color: frontColor,
        dimmer: this.currentIntensity,
        white: microStrobe,  // 🌴 WAVE 755: Micro-strobe que "rasga" la vista
      },
      'back': {
        color: backColor,
        dimmer: this.currentIntensity,
        white: microStrobe,  // 🌴 WAVE 755: Micro-strobe sincronizado
      }
    }
    
    return {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress: this.elapsedMs / this.totalDurationMs,
      // 🔥 WAVE 740: zones derivado de zoneOverrides
      zones: Object.keys(zoneOverrides) as EffectZone[],
      intensity: this.currentIntensity,
      
      // 🔥 WAVE 740: Legacy fallback ELIMINADO cuando hay zoneOverrides
      dimmerOverride: undefined,
      colorOverride: undefined,
      
      globalOverride: false,  // No global - solo zonas específicas
      
      // 🎨 WAVE 740: ZONE OVERRIDES - ÚNICA FUENTE DE VERDAD
      zoneOverrides,
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════

export function createTropicalPulse(config?: Partial<TropicalPulseConfig>): TropicalPulse {
  return new TropicalPulse(config)
}
