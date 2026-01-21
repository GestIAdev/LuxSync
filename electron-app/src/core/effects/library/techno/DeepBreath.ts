/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🫁 DEEP BREATH - RESPIRACIÓN PROFUNDA
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🔬 WAVE 938: ATMOSPHERIC ARSENAL (Radwulf)
 * 
 * FILOSOFÍA:
 * Darle pulmones a la pista de baile. Orgánico y biomecánico.
 * Respiración lenta y profunda (4 compases completos).
 * 
 * COMPORTAMIENTO:
 * - MixBus: 'htp' (ADITIVO - respira con la física)
 * - Sincronización: 4 compases (16 beats) - MUY LENTO
 * - Compás 1-2 (Inhalar): 0% → 60% + Movers se abren (Tilt Up + Pan Out)
 * - Compás 3-4 (Exhalar): 60% → 0% + Movers se cierran (Tilt Down + Pan In)
 * - Usa sine wave basado en tiempo del sistema (continuo, no golpes)
 * 
 * COLORES:
 * - DEEP BLUE (#0033aa) o UV PURPLE (#6600ff)
 * - Transición suave durante la respiración
 * 
 * ZONAS:
 * - Perfecto para valley, breakdown, silence
 * - Ideal para momentos tensos antes del drop
 * 
 * @module core/effects/library/techno/DeepBreath
 * @version WAVE 938 - ATMOSPHERIC ARSENAL (Radwulf)
 */

import { BaseEffect } from '../../BaseEffect'
import { 
  EffectTriggerConfig, 
  EffectFrameOutput, 
  EffectCategory
} from '../../types'

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

interface DeepBreathConfig {
  /** Duración de una respiración completa (inhale + exhale) en ms */
  breathCycleMs: number
  
  /** Número de ciclos de respiración */
  breathCount: number
  
  /** Intensidad máxima durante inhale peak */
  peakIntensity: number
  
  /** BPM-synced (4 compases = 16 beats) */
  bpmSync: boolean
  
  /** Beats por ciclo de respiración (si bpmSync=true) */
  beatsPerCycle: number
  
  /** Amplitud de movimiento de movers (grados) */
  movementAmplitude: number
}

const DEFAULT_CONFIG: DeepBreathConfig = {
  breathCycleMs: 8000,       // 8 segundos por ciclo (4 compases a 120 BPM)
  breathCount: 2,            // 2 respiraciones completas
  peakIntensity: 0.6,        // 60% máximo
  bpmSync: true,
  beatsPerCycle: 16,         // 4 compases = 16 beats
  movementAmplitude: 60,     // ±60° de movimiento
}

// ═══════════════════════════════════════════════════════════════════════════
// DEEP BREATH EFFECT
// ═══════════════════════════════════════════════════════════════════════════

export class DeepBreath extends BaseEffect {
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect properties
  // ─────────────────────────────────────────────────────────────────────────
  
  readonly effectType = 'deep_breath'
  readonly name = 'Deep Breath'
  readonly category: EffectCategory = 'physical'
  readonly priority = 45  // Media-baja - efecto atmosférico intenso
  readonly mixBus = 'htp' as const  // ADITIVO - respira con física
  
  // ─────────────────────────────────────────────────────────────────────────
  // Internal state
  // ─────────────────────────────────────────────────────────────────────────
  
  private config: DeepBreathConfig
  private totalDurationMs: number
  
  // ─────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────
  
  constructor(config?: Partial<DeepBreathConfig>) {
    super('deep_breath')
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.totalDurationMs = this.config.breathCycleMs * this.config.breathCount
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect implementation
  // ─────────────────────────────────────────────────────────────────────────
  
  trigger(triggerConfig: EffectTriggerConfig): void {
    super.trigger(triggerConfig)
    
    console.log(`[DeepBreath 🫁] TRIGGERED! Cycles=${this.config.breathCount} CycleMs=${this.config.breathCycleMs}`)
  }

  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    
    this.elapsedMs += deltaMs
    
    // Check si terminó
    if (this.elapsedMs >= this.totalDurationMs) {
      this.phase = 'finished'
      console.log(`[DeepBreath 🫁] FINISHED (${this.config.breathCount} cycles)`)
    }
  }
  
  /**
   * 📤 GET OUTPUT - Devuelve el output del frame actual
   * 🫁 WAVE 938: DEEP BREATH - Respiración orgánica
   */
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null

    const progress = this.elapsedMs / this.totalDurationMs

    // ═════════════════════════════════════════════════════════════════════
    // SINE WAVE: Respiración continua
    // ═════════════════════════════════════════════════════════════════════
    const cycleProgress = (this.elapsedMs % this.config.breathCycleMs) / this.config.breathCycleMs
    const sinePhase = cycleProgress * 2 * Math.PI
    
    // Sine wave: 0 → 1 → 0 (inhale → peak → exhale)
    const breathIntensity = (Math.sin(sinePhase - Math.PI / 2) + 1) / 2
    const dimmer = breathIntensity * this.config.peakIntensity

    // Color: transición DEEP BLUE ↔ UV PURPLE durante respiración
    const hue = 220 + breathIntensity * 60 // 220 (blue) → 280 (purple)
    const color = { h: hue, s: 100, l: 40 }

    const output: EffectFrameOutput = {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      zones: ['front', 'pars', 'back', 'movers'],
      intensity: this.triggerIntensity * breathIntensity,
      zoneOverrides: {},
    }

    // ═════════════════════════════════════════════════════════════════════
    // PARS: Dimmer sincronizado con respiración
    // ═════════════════════════════════════════════════════════════════════
    const parZones = ['front', 'pars', 'back'] as const
    
    parZones.forEach(zone => {
      output.zoneOverrides![zone] = {
        dimmer,
        color,
        blendMode: 'max' as const,
      }
    })

    // ═════════════════════════════════════════════════════════════════════
    // MOVERS: Movimiento orgánico (abrir/cerrar)
    // ═════════════════════════════════════════════════════════════════════
    // Tilt: -30° (down) → +30° (up) → -30° (down)
    const tilt = -30 + breathIntensity * 60
    
    // Pan: spread out durante inhale (±60°)
    // TODO: Para hacer pan left/right necesitamos conocer el índice del fixture
    // Por ahora usamos 0° (centro)
    const pan = 0

    output.zoneOverrides!['movers'] = {
      dimmer,
      color,
      blendMode: 'max' as const,
      movement: {
        pan,
        tilt,
      },
    }

    return output
  }
  
  isFinished(): boolean {
    return this.phase === 'finished'
  }
  
  abort(): void {
    this.phase = 'finished'
    console.log(`[DeepBreath 🫁] Aborted`)
  }
}
