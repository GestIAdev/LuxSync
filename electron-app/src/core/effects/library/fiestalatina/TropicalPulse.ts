/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌴 TROPICAL PULSE - PERCUSIÓN TROPICAL
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 805: Original implementation
 * WAVE 1004.4: THE LATINO LADDER - GENTLE ZONE (45-60%)
 *              + Pre-blackout ajustado a 50ms (patrón Techno)
 * 
 * DNA TARGET (WAVE 1004.4):
 * - Aggression: 0.55 (GENTLE - Percusivo moderado)
 * - Chaos: 0.40 (Rítmico)
 * - Organicity: 0.65 (Festivo/humano)
 * 
 * @module core/effects/library/fiestalatina/TropicalPulse
 * @version WAVE 805, 1004.4
 */

import { BaseEffect } from '../../BaseEffect'
import { EffectTriggerConfig, EffectFrameOutput, EffectCategory, EffectZone } from '../../types'

interface TropicalPulseConfig {
  preDuckingMs: number
  flashCount: number
  flashDurationMs: number
  flashGapMs: number
  finaleMs: number
  releaseMs: number
  stormColors: Array<{ h: number; s: number; l: number }>
  finaleColor: { h: number; s: number; l: number }
  flashIntensity: number
}

const DEFAULT_CONFIG: TropicalPulseConfig = {
  preDuckingMs: 50,      // 🆕 WAVE 1004.4: 100→50ms (patrón Techno pre-blackout)
  flashCount: 3,
  flashDurationMs: 70,   // 🆙 20→25ms - ligeramente más largo
  flashGapMs: 35,        // 🆙 30→35ms - más respiro
  finaleMs: 45,          // 🆙 40→45ms
  releaseMs: 60,         // 🆙 50→60ms - release más suave
  stormColors: [
    { h: 16, s: 100, l: 65 },   // Naranja tropical
    { h: 174, s: 90, l: 50 },   // Turquesa
    { h: 300, s: 95, l: 55 },   // Magenta
  ],
  finaleColor: { h: 45, s: 100, l: 60 },  // Dorado
  flashIntensity: 0.85,  // 🆘 1.0→0.85 - GENTLE ZONE (menos agresivo)
}

export class TropicalPulse extends BaseEffect {
  readonly effectType = 'tropical_pulse'
  readonly name = 'Tropical Pulse'
  readonly category: EffectCategory = 'physical'
  readonly priority = 70  // 🆘 75→70 - GENTLE ZONE
  readonly mixBus = 'global' as const
  
  private config: TropicalPulseConfig
  private currentPhase: 'preDucking' | 'flash' | 'gap' | 'finale' | 'release' = 'preDucking'
  private phaseTimer = 0
  private currentFlash = 0
  private currentColor: { h: number; s: number; l: number }
  private currentIntensity = 0
  private totalDurationMs = 0
  
  constructor(config?: Partial<TropicalPulseConfig>) {
    super('tropical_pulse')
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.currentColor = this.config.stormColors[0]
    this.calculateTotalDuration()
  }
  
  private calculateTotalDuration(): void {
    const { preDuckingMs, flashCount, flashDurationMs, flashGapMs, finaleMs, releaseMs } = this.config
    this.totalDurationMs = preDuckingMs + (flashDurationMs + flashGapMs) * flashCount + finaleMs + releaseMs
  }
  
  trigger(config: EffectTriggerConfig): void {
    super.trigger(config)
    this.currentPhase = 'preDucking'
    this.phaseTimer = 0
    this.currentFlash = 0
    this.currentIntensity = 0
    this.currentColor = this.config.stormColors[0]
  }
  
  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    this.elapsedMs += deltaMs
    this.phaseTimer += deltaMs
    if (this.elapsedMs >= this.totalDurationMs) {
      this.phase = 'finished'
      this.currentIntensity = 0
      return
    }
    switch (this.currentPhase) {
      case 'preDucking':
        this.currentIntensity = 0
        if (this.phaseTimer >= this.config.preDuckingMs) {
          this.currentPhase = 'flash'
          this.phaseTimer = 0
          this.currentFlash = 0
        }
        break
      case 'flash':
        this.currentIntensity = this.config.flashIntensity
        this.currentColor = this.config.stormColors[this.currentFlash % this.config.stormColors.length]
        if (this.phaseTimer >= this.config.flashDurationMs) {
          this.currentPhase = 'gap'
          this.phaseTimer = 0
        }
        break
      case 'gap':
        this.currentIntensity = 0
        if (this.phaseTimer >= this.config.flashGapMs) {
          this.currentFlash++
          if (this.currentFlash >= this.config.flashCount) {
            this.currentPhase = 'finale'
            this.phaseTimer = 0
          } else {
            this.currentPhase = 'flash'
            this.phaseTimer = 0
          }
        }
        break
      case 'finale':
        this.currentIntensity = 1.0
        this.currentColor = this.config.finaleColor
        if (this.phaseTimer >= this.config.finaleMs) {
          this.currentPhase = 'release'
          this.phaseTimer = 0
        }
        break
      case 'release':
        const releaseProgress = this.phaseTimer / this.config.releaseMs
        this.currentIntensity = (1 - releaseProgress) ** 2
        break
    }
  }
  
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null
    
    // 🌪️ WAVE 805.1: Durante preDucking, silenciar TODO (incluye movers)
    if (this.currentPhase === 'preDucking') {
      return {
        effectId: this.id,
        category: this.category,
        phase: this.phase,
        progress: this.elapsedMs / this.totalDurationMs,
        zones: [],
        intensity: 0,
        dimmerOverride: 0,
        colorOverride: undefined,
        globalComposition: 1.0,  // 🌊 WAVE 1080
        zoneOverrides: undefined,
      }
    }
    
    // 🌪️ WAVE 805.1: SOLO PARs (front + back), NO movers
    const zoneOverrides = {
      'front': {
        color: this.currentColor,
        dimmer: this.currentIntensity,
        white: this.currentPhase === 'finale' ? 1.0 : undefined,
        amber: this.currentPhase === 'finale' ? 1.0 : undefined,
      },
      'back': {
        color: this.currentColor,
        dimmer: this.currentIntensity,
        white: this.currentPhase === 'finale' ? 1.0 : undefined,
        amber: this.currentPhase === 'finale' ? 1.0 : undefined,
      }
    }
    
    return {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress: this.elapsedMs / this.totalDurationMs,
      zones: Object.keys(zoneOverrides) as EffectZone[],
      intensity: this.currentIntensity,
      dimmerOverride: undefined,
      colorOverride: undefined,
      // 🌊 WAVE 1080: globalComposition omitido = 0 (física manda, zoneOverrides para granularidad)
      zoneOverrides,
    }
  }
}

export function createTropicalPulse(config?: Partial<TropicalPulseConfig>): TropicalPulse {
  return new TropicalPulse(config)
}
