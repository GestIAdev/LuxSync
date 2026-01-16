/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ STROBE STORM - CONTROLLED CHAOS
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 680: THE ARSENAL - Primera arma de asalto
 * 
 * COMPORTAMIENTO:
 * - ATTACK:  Ramp up de frecuencia (0 → target Hz)
 * - SUSTAIN: Caos controlado - frecuencia oscila con BPM
 * - DECAY:   Desaceleración gradual
 * 
 * FÍSICA:
 * - Frecuencia sincronizada al BPM
 * - Intensidad modulada por Z-Score
 * - Asíncrono pero musical (no random puro)
 * 
 * RESTRICCIONES VIBE:
 * - chill-lounge: BLOCKED (0 Hz)
 * - fiesta-latina: DEGRADED (pulsos simples, sin strobe real)
 * - techno-club: UNLEASHED (15 Hz máx)
 * - pop-rock: MODERATE (10 Hz máx)
 * 
 * @module core/effects/library/StrobeStorm
 * @version WAVE 680
 */

import { BaseEffect } from '../BaseEffect'
import { 
  EffectTriggerConfig, 
  EffectFrameOutput, 
  EffectPhase,
  EffectCategory,
  EffectZone
} from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

interface StrobeStormConfig {
  /** Tiempo de ramp up */
  attackMs: number
  
  /** Tiempo de sustain */
  sustainMs: number
  
  /** Tiempo de decay */
  decayMs: number
  
  /** Frecuencia base (Hz) - modulada por BPM */
  baseFrequencyHz: number
  
  /** ¿Modo degradado? (pulsos sin strobe real - para vibes restrictivos) */
  degradedMode: boolean
  
  /** Color del flash (HSL) */
  flashColor: { h: number; s: number; l: number }
}

const DEFAULT_CONFIG: StrobeStormConfig = {
  attackMs: 100,
  sustainMs: 500,
  decayMs: 200,
  baseFrequencyHz: 8,  // 8 Hz base, modulado por BPM
  degradedMode: false,
  flashColor: { h: 0, s: 0, l: 100 },  // Blanco puro
}

// ═══════════════════════════════════════════════════════════════════════════
// STROBE STORM CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class StrobeStorm extends BaseEffect {
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect properties
  // ─────────────────────────────────────────────────────────────────────────
  
  readonly effectType = 'strobe_storm'
  readonly name = 'Strobe Storm'
  readonly category: EffectCategory = 'physical'
  readonly priority = 90  // Alta, pero menor que Solar Flare
  
  // ─────────────────────────────────────────────────────────────────────────
  // Internal state
  // ─────────────────────────────────────────────────────────────────────────
  
  private config: StrobeStormConfig
  private phaseStartTime = 0
  private currentFrequency = 0
  private maxAllowedFrequency = 15  // Default, overridden by vibe
  private strobePhase = 0  // 0-1, ciclo interno del strobe
  private isFlashOn = false
  
  // ─────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────
  
  constructor(config?: Partial<StrobeStormConfig>) {
    super('strobe_storm')
    this.config = { ...DEFAULT_CONFIG, ...config }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC: Set max allowed frequency (called by EffectManager based on Vibe)
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 🛡️ SET MAX FREQUENCY - The Shield in action
   * 
   * Called by EffectManager before trigger based on Vibe constraints.
   * 
   * @param maxHz Maximum allowed strobe frequency
   * @param degraded If true, use pulse mode instead of strobe
   */
  public setVibeConstraints(maxHz: number, degraded: boolean): void {
    this.maxAllowedFrequency = maxHz
    this.config.degradedMode = degraded
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect implementation
  // ─────────────────────────────────────────────────────────────────────────
  
  trigger(config: EffectTriggerConfig): void {
    super.trigger(config)
    this.phaseStartTime = Date.now()
    this.currentFrequency = 0
    this.strobePhase = 0
    this.isFlashOn = false
    
    const mode = this.config.degradedMode ? '(DEGRADED)' : ''
    console.log(`[StrobeStorm ⚡] TRIGGERED! MaxHz=${this.maxAllowedFrequency} ${mode}`)
  }
  
  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    
    this.elapsedMs += deltaMs
    const phaseElapsed = Date.now() - this.phaseStartTime
    
    switch (this.phase) {
      case 'attack':
        this.processAttack(phaseElapsed)
        break
      case 'sustain':
        this.processSustain(phaseElapsed, deltaMs)
        break
      case 'decay':
        this.processDecay(phaseElapsed)
        break
    }
    
    // Update strobe cycle
    this.updateStrobeCycle(deltaMs)
  }
  
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null
    
    // En modo degradado, no enviamos strobeRate - solo dimmer pulses
    if (this.config.degradedMode) {
      return this.getDegradedOutput()
    }
    
    // Modo normal: strobe real
    return this.getStrobeOutput()
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Phase processors
  // ─────────────────────────────────────────────────────────────────────────
  
  private processAttack(phaseElapsed: number): void {
    const progress = Math.min(1, phaseElapsed / this.config.attackMs)
    
    // Ramp up frequency con ease-in
    const targetFreq = this.calculateTargetFrequency()
    this.currentFrequency = targetFreq * this.easeInOutCubic(progress)
    
    if (progress >= 1) {
      this.transitionTo('sustain')
    }
  }
  
  private processSustain(phaseElapsed: number, deltaMs: number): void {
    // Frecuencia oscila sutilmente con el beat
    const bpmPulse = this.getBpmPulse(2)  // Medio beat
    const baseFreq = this.calculateTargetFrequency()
    
    // Modular ±20% con el beat
    this.currentFrequency = baseFreq * (0.9 + bpmPulse * 0.2)
    
    if (phaseElapsed >= this.config.sustainMs) {
      this.transitionTo('decay')
    }
  }
  
  private processDecay(phaseElapsed: number): void {
    const progress = Math.min(1, phaseElapsed / this.config.decayMs)
    
    // Desaceleración gradual
    const targetFreq = this.calculateTargetFrequency()
    this.currentFrequency = targetFreq * (1 - this.easeInOutCubic(progress))
    
    if (progress >= 1) {
      this.transitionTo('finished')
      console.log(`[StrobeStorm ⚡] Completed (${this.elapsedMs}ms total)`)
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Strobe cycle logic
  // ─────────────────────────────────────────────────────────────────────────
  
  private updateStrobeCycle(deltaMs: number): void {
    if (this.currentFrequency <= 0) {
      this.isFlashOn = false
      return
    }
    
    // Avanzar fase del strobe
    const msPerCycle = 1000 / this.currentFrequency
    this.strobePhase += deltaMs / msPerCycle
    
    // Ciclo completo
    if (this.strobePhase >= 1) {
      this.strobePhase = this.strobePhase % 1
    }
    
    // Flash ON en primera mitad del ciclo
    this.isFlashOn = this.strobePhase < 0.5
  }
  
  private calculateTargetFrequency(): number {
    // Base frequency modulada por Z-Score
    const baseFreq = this.config.baseFrequencyHz * this.triggerIntensity
    const zScaleFreq = this.getIntensityFromZScore(baseFreq, 0.4)
    
    // Cap al máximo permitido por el Vibe
    return Math.min(zScaleFreq, this.maxAllowedFrequency)
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Output generators
  // ─────────────────────────────────────────────────────────────────────────
  
  private getStrobeOutput(): EffectFrameOutput {
    const intensity = this.isFlashOn ? this.triggerIntensity : 0
    
    return {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress: this.calculateProgress(),
      zones: this.zones,
      intensity: intensity,
      
      // ⚡ STROBE RATE - El DMX se encarga del flash real
      strobeRate: this.currentFrequency,
      
      // Dimmer al 100% cuando flash ON, 0% cuando OFF
      dimmerOverride: intensity,
      
      // Blanco puro para máximo impacto
      whiteOverride: intensity,
      
      // Color del flash
      colorOverride: this.config.flashColor,
      
      // Global override solo en sustain peak
      globalOverride: this.phase === 'sustain' && this.currentFrequency > 5,
    }
  }
  
  private getDegradedOutput(): EffectFrameOutput {
    // Modo degradado: pulsos de dimmer sin strobe real
    // Para vibes como fiesta-latina que no permiten strobe
    
    // Usar pulso sinusoidal en lugar de strobe duro
    const bpm = this.getCurrentBpm(120)
    const pulsePeriod = 60000 / bpm / 2  // Pulso cada medio beat
    const pulse = this.getSinePulse(pulsePeriod)
    
    const intensity = pulse * this.triggerIntensity * 0.7  // 70% de intensidad max
    
    return {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress: this.calculateProgress(),
      zones: this.zones,
      intensity: intensity,
      
      // SIN strobeRate - solo dimmer pulses
      dimmerOverride: intensity,
      
      // Color cálido en lugar de blanco (menos agresivo)
      colorOverride: { h: 45, s: 80, l: 60 },  // Naranja cálido
      
      globalOverride: false,  // Nunca global en degraded
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────
  
  private transitionTo(newPhase: EffectPhase): void {
    this.phase = newPhase
    this.phaseStartTime = Date.now()
  }
  
  private calculateProgress(): number {
    const totalDuration = this.config.attackMs + this.config.sustainMs + this.config.decayMs
    return Math.min(1, this.elapsedMs / totalDuration)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════

export function createStrobeStorm(config?: Partial<StrobeStormConfig>): StrobeStorm {
  return new StrobeStorm(config)
}
