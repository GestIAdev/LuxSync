/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 💥 NEON BLINDER - THE FLASH WALL
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🔥 WAVE 2182: PARS PAINT, MOVERS PIERCE
 * 
 * FILOSOFÍA:
 * Flash masivo que ciega la pista. Los PARs PINTAN el lienzo con color
 * agresivo a full blast. Los Movers LATCHEAN el mismo color al inicio
 * y lo sostienen — cero cambios mecánicos durante la ejecución.
 * Todo el efecto vive de modular el Dimmer: ADSR de 1 segundo.
 * 
 * COMPORTAMIENTO:
 * - MixBus: 'global' (DICTADOR — necesita el negro previo para el impacto)
 * - Duración: ~1000ms ADSR (Attack 50ms, Decay 950ms)
 * - Pars: Flash al 100% con decaimiento exponencial
 * - Movers: Posición frontal fija (hacia público), color latched, dimmer sync
 * - oneShot: true — un solo golpe, sin re-trigger
 * 
 * COLORES (según Vibe/Intensity):
 * - Alta intensidad: Rojo Sangre (h:0, s:100, l:50)
 * - Media intensidad: Magenta Eléctrico (h:300, s:100, l:55)
 * - Default: Cian Eléctrico (h:185, s:100, l:55)
 * 
 * @module core/effects/library/techno/NeonBlinder
 * @version WAVE 2182 — PARS PAINT, MOVERS PIERCE
 */

import { BaseEffect } from '../../BaseEffect'
import {
  EffectTriggerConfig,
  EffectFrameOutput,
  EffectCategory,
} from '../../types'

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

interface NeonBlinderConfig {
  /** Duración total del efecto (ms) */
  durationMs: number
  /** Duración del attack (ms) — subida a full */
  attackMs: number
}

const DEFAULT_CONFIG: NeonBlinderConfig = {
  durationMs: 1000,
  attackMs: 50,
}

// ═══════════════════════════════════════════════════════════════════════════
// NEON BLINDER EFFECT
// ═══════════════════════════════════════════════════════════════════════════

export class NeonBlinder extends BaseEffect {
  readonly effectType = 'neon_blinder'
  readonly name = 'Neon Blinder'
  readonly category: EffectCategory = 'physical'
  readonly priority = 93          // Justo debajo de core_meltdown
  readonly mixBus = 'global' as const
  readonly isOneShot = true       // Un solo impacto, sin re-trigger

  private config: NeonBlinderConfig
  private flashColor: { h: number; s: number; l: number } = { h: 185, s: 100, l: 55 }

  constructor(config?: Partial<NeonBlinderConfig>) {
    super('neon_blinder')
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  trigger(triggerConfig: EffectTriggerConfig): void {
    super.trigger(triggerConfig)
    this.setDuration(this.config.durationMs)

    // Color según intensidad del trigger
    if (triggerConfig.intensity > 0.85) {
      this.flashColor = { h: 0, s: 100, l: 50 }     // Rojo Sangre
    } else if (triggerConfig.intensity > 0.6) {
      this.flashColor = { h: 300, s: 100, l: 55 }    // Magenta Eléctrico
    } else {
      this.flashColor = { h: 185, s: 100, l: 55 }    // Cian Eléctrico
    }

    console.log(
      `[NeonBlinder 💥] TRIGGERED: color=h${this.flashColor.h} intensity=${triggerConfig.intensity.toFixed(2)}`
    )
  }

  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    this.elapsedMs += deltaMs

    if (this.elapsedMs < this.config.attackMs) {
      this.phase = 'attack'
    } else if (this.elapsedMs < this.config.durationMs) {
      this.phase = 'decay'
    } else {
      this.phase = 'finished'
    }
  }

  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null

    const progress = this.getProgress()

    // ═════════════════════════════════════════════════════════════════════
    // ADSR ENVELOPE: Attack 50ms → Exponential Decay 950ms
    // ═════════════════════════════════════════════════════════════════════
    let dimmer: number
    if (this.elapsedMs < this.config.attackMs) {
      // Attack: ramp up lineal
      dimmer = this.elapsedMs / this.config.attackMs
    } else {
      // Decay: exponencial suave (e^-3t para caída natural)
      const decayProgress = (this.elapsedMs - this.config.attackMs)
        / (this.config.durationMs - this.config.attackMs)
      dimmer = Math.exp(-3 * decayProgress)
    }

    dimmer *= this.triggerIntensity

    const output: EffectFrameOutput = {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      dimmerOverride: dimmer,
      colorOverride: this.flashColor,
      intensity: dimmer,
      zones: ['front', 'all-pars', 'back', 'all-movers'],
      globalComposition: 1.0,
      zoneOverrides: {},
    }

    // ═════════════════════════════════════════════════════════════════════
    // PARS: Flash masivo — color agresivo + dimmer ADSR
    // ═════════════════════════════════════════════════════════════════════
    const parZones = ['front', 'all-pars', 'back'] as const
    for (const zone of parZones) {
      output.zoneOverrides![zone] = {
        color: this.flashColor,
        dimmer,
        blendMode: 'max' as const,
      }
    }

    // ═════════════════════════════════════════════════════════════════════
    // MOVERS: Color LATCHED + posición frontal fija + dimmer sync
    // "Pars paint the canvas, Movers pierce the sky"
    // ═════════════════════════════════════════════════════════════════════
    output.zoneOverrides!['all-movers'] = this.getMoverColorOverride(
      this.flashColor,
      dimmer,
      {
        pan: 0,       // Frontal (hacia público)
        tilt: 0,      // Horizontal
        isAbsolute: true,
        speed: 1.0,   // Instantáneo
      }
    )

    return output
  }
}
