/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 👻 GHOST CHASE - ALMAS EN LA NIEBLA
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🔥 WAVE 2182: PARS PAINT, MOVERS PIERCE
 * 
 * FILOSOFÍA:
 * En el valle del set, cuando la energía baja y el suelo se disuelve,
 * los fantasmas aparecen. Los PARs pintan una respiración suave con
 * el color del vibe actual. Los movers no se mueven — están congelados
 * como estatuas en la oscuridad, pero sus dimmers pulsan como corazones
 * desfasados, creando una persecución fantasmal de luz.
 * 
 * COMPORTAMIENTO:
 * - MixBus: 'global' (DICTADOR — controla la escena completa)
 * - Duración: 4000ms (ciclo ambiental largo)
 * - Pars: Color wash del vibe actual, respiración suave (sine 0.3Hz)
 * - Movers: CERO movimiento mecánico. Sin pan, sin tilt, sin color wheel.
 *   - Color LATCHED a Deep Indigo (h:250, s:80, l:20)
 *   - Onda senoidal 0.2Hz sobre Dimmer, desfasada por zona
 *   - movers-left: phase 0°
 *   - movers-right: phase 180° (contrario)
 * - oneShot: false — efecto cíclico, Chronos decide cuándo termina
 * 
 * EL EFECTO "FANTASMA":
 * Los movers suben y bajan de brillo como apariciones intermitentes.
 * Al estar desfasados, cuando la izquierda brilla, la derecha se apaga
 * y viceversa. Una persecución espectral sin un solo motor moviéndose.
 * 
 * @module core/effects/library/techno/GhostChase
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

interface GhostChaseConfig {
  /** Duración del ciclo de vida del efecto (ms) */
  durationMs: number
  /** Frecuencia de respiración de los PARs (Hz) */
  parBreathHz: number
  /** Frecuencia de la onda fantasma en movers (Hz) */
  moverGhostHz: number
  /** Intensidad mínima de respiración PAR (0-1) */
  parMinIntensity: number
  /** Intensidad máxima de respiración PAR (0-1) */
  parMaxIntensity: number
  /** Intensidad máxima del dimmer fantasma en movers (0-1) */
  moverMaxDimmer: number
  /** Intensidad mínima del dimmer fantasma en movers (0-1) */
  moverMinDimmer: number
}

const DEFAULT_CONFIG: GhostChaseConfig = {
  durationMs: 4000,
  parBreathHz: 0.3,
  moverGhostHz: 0.2,
  parMinIntensity: 0.08,
  parMaxIntensity: 0.35,
  moverMaxDimmer: 0.30,
  moverMinDimmer: 0.02,
}

// Color fijo para movers: Deep Indigo espectral
const GHOST_COLOR = { h: 250, s: 80, l: 20 }

// ═══════════════════════════════════════════════════════════════════════════
// GHOST CHASE EFFECT
// ═══════════════════════════════════════════════════════════════════════════

export class GhostChase extends BaseEffect {
  readonly effectType = 'ghost_chase'
  readonly name = 'Ghost Chase'
  readonly category: EffectCategory = 'composite'
  readonly priority = 40           // Baja prioridad — es ambiente, no agresión
  readonly mixBus = 'global' as const
  readonly isOneShot = false       // Cíclico — Chronos decide duración

  private config: GhostChaseConfig
  private vibeColor: { h: number; s: number; l: number } = { h: 250, s: 70, l: 40 }

  constructor(config?: Partial<GhostChaseConfig>) {
    super('ghost_chase')
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Deriva un color determinista del vibeId.
   * Usa un hash simple del string para generar un hue consistente.
   * Axioma Anti-Simulación: sin random, mismo vibeId = mismo color siempre.
   */
  private deriveVibeColor(vibeId: string): { h: number; s: number; l: number } {
    let hash = 0
    for (let i = 0; i < vibeId.length; i++) {
      hash = ((hash << 5) - hash + vibeId.charCodeAt(i)) | 0
    }
    const hue = ((hash % 360) + 360) % 360
    return { h: hue, s: 65, l: 35 }
  }

  trigger(triggerConfig: EffectTriggerConfig): void {
    super.trigger(triggerConfig)
    this.setDuration(this.config.durationMs)

    // Color del vibe derivado determinísticamente del vibeId
    // No hay vibeColor en MusicalContext — derivamos del ID del vibe activo
    const vibeId = triggerConfig.musicalContext?.vibeId ?? 'default'
    this.vibeColor = this.deriveVibeColor(vibeId)

    // Saturación reducida para el ambiente — no queremos agresión
    this.vibeColor.s = Math.min(this.vibeColor.s, 70)
    this.vibeColor.l = Math.max(this.vibeColor.l, 25)

    console.log(
      `[GhostChase 👻] TRIGGERED: vibeColor=h${this.vibeColor.h} ` +
      `parBreath=${this.config.parBreathHz}Hz moverGhost=${this.config.moverGhostHz}Hz ` +
      `duration=${this.config.durationMs}ms`
    )
  }

  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    this.elapsedMs += deltaMs

    if (this.elapsedMs >= this.config.durationMs) {
      this.phase = 'finished'
    } else {
      this.phase = 'sustain'
    }
  }

  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null

    const progress = this.getProgress()

    // ═════════════════════════════════════════════════════════════════════
    // FADE IN/OUT ENVELOPE — entrada y salida suaves
    // Primeros 500ms: fade in. Últimos 500ms: fade out.
    // ═════════════════════════════════════════════════════════════════════
    let envelope = 1.0
    const fadeMs = 500
    if (this.elapsedMs < fadeMs) {
      envelope = this.elapsedMs / fadeMs
    } else if (this.elapsedMs > this.config.durationMs - fadeMs) {
      envelope = (this.config.durationMs - this.elapsedMs) / fadeMs
    }
    envelope = Math.max(0, Math.min(1, envelope))

    // ═════════════════════════════════════════════════════════════════════
    // PARS: Respiración suave con el color del vibe
    // Sine wave a parBreathHz modulando la intensidad
    // ═════════════════════════════════════════════════════════════════════
    const parPulse = this.getSinePulse(1000 / this.config.parBreathHz)
    const parIntensity = (
      this.config.parMinIntensity +
      (this.config.parMaxIntensity - this.config.parMinIntensity) * parPulse
    ) * envelope * this.triggerIntensity

    // ═════════════════════════════════════════════════════════════════════
    // MOVERS: Dimmer fantasma desfasado — CERO MOVIMIENTO MECÁNICO
    // Sine wave a moverGhostHz
    // Left: phase 0°    → getSinePulse(period, 0)
    // Right: phase 180° → getSinePulse(period, 0.5)
    // ═════════════════════════════════════════════════════════════════════
    const moverPeriodMs = 1000 / this.config.moverGhostHz
    const ghostPulseLeft = this.getSinePulse(moverPeriodMs, 0)
    const ghostPulseRight = this.getSinePulse(moverPeriodMs, 0.5)

    const dimmerLeft = (
      this.config.moverMinDimmer +
      (this.config.moverMaxDimmer - this.config.moverMinDimmer) * ghostPulseLeft
    ) * envelope * this.triggerIntensity

    const dimmerRight = (
      this.config.moverMinDimmer +
      (this.config.moverMaxDimmer - this.config.moverMinDimmer) * ghostPulseRight
    ) * envelope * this.triggerIntensity

    // ═════════════════════════════════════════════════════════════════════
    // OUTPUT ASSEMBLY
    // ═════════════════════════════════════════════════════════════════════
    const output: EffectFrameOutput = {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      dimmerOverride: parIntensity,
      colorOverride: { ...this.vibeColor },
      intensity: parIntensity,
      zones: ['front', 'all-pars', 'back', 'movers-left', 'movers-right'],
      globalComposition: 1.0,
      zoneOverrides: {},
    }

    // PARs: color del vibe con respiración
    const parZones = ['front', 'all-pars', 'back'] as const
    for (const zone of parZones) {
      output.zoneOverrides![zone] = {
        color: { ...this.vibeColor },
        dimmer: parIntensity,
        blendMode: 'max' as const,
      }
    }

    // Movers: Color LATCHED (Ghost Indigo), dimmer modulado, SIN MOVIMIENTO
    output.zoneOverrides!['movers-left'] = this.getMoverColorOverride(
      GHOST_COLOR,
      dimmerLeft,
      // NO movement override — movers se quedan donde estaban
    )

    output.zoneOverrides!['movers-right'] = this.getMoverColorOverride(
      GHOST_COLOR,
      dimmerRight,
      // NO movement override — congelados como estatuas
    )

    return output
  }
}
