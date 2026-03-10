/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 SURGICAL STRIKE - THE SCALPEL IN THE DARK
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🔥 WAVE 2182: PARS PAINT, MOVERS PIERCE
 * 
 * FILOSOFÍA:
 * La sala se queda a oscuras. Solo unos pocos cabezales elegidos
 * disparan un estrobo brutal y quirúrgico en la penumbra.
 * Es el bisturí, no el martillo.
 * 
 * COMPORTAMIENTO:
 * - MixBus: 'global' (DICTADOR — necesita blackout total de PARs)
 * - Duración: 300-400ms (ultra-corto, golpe seco)
 * - Pars: Blackout total (0% Dimmer) — la sala en completa oscuridad
 * - Movers: 2 de 4 seleccionados determinísticamente via beatPhase
 *   - Color LATCHED: Azul Profundo o Rojo Puro (según intensity)
 *   - Estrobo via Dimmer toggle a 16Hz durante 350ms (~5-6 flashes)
 * - oneShot: true — un solo golpe, sin re-trigger
 * 
 * TARGETING:
 * - beatPhase determina qué movers se activan (no random — Axioma Anti-Simulación)
 * - beatPhase < 0.25: movers-left
 * - beatPhase < 0.50: movers-right
 * - beatPhase < 0.75: movers-left + movers-right alternados
 * - beatPhase >= 0.75: todos los movers
 * 
 * @module core/effects/library/techno/SurgicalStrike
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

interface SurgicalStrikeConfig {
  /** Duración total del estrobo (ms) */
  durationMs: number
  /** Frecuencia del estrobo (Hz) */
  strobeHz: number
}

const DEFAULT_CONFIG: SurgicalStrikeConfig = {
  durationMs: 350,
  strobeHz: 16,
}

// ═══════════════════════════════════════════════════════════════════════════
// SURGICAL STRIKE EFFECT
// ═══════════════════════════════════════════════════════════════════════════

export class SurgicalStrike extends BaseEffect {
  readonly effectType = 'surgical_strike'
  readonly name = 'Surgical Strike'
  readonly category: EffectCategory = 'physical'
  readonly priority = 94          // Por encima de neon_blinder — más violento
  readonly mixBus = 'global' as const
  readonly isOneShot = true

  private config: SurgicalStrikeConfig
  private strikeColor: { h: number; s: number; l: number } = { h: 230, s: 100, l: 30 }
  private targetZone: 'movers-left' | 'movers-right' | 'all-movers' = 'all-movers'
  private alternateLeft = true   // Para el modo alternado

  constructor(config?: Partial<SurgicalStrikeConfig>) {
    super('surgical_strike')
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  trigger(triggerConfig: EffectTriggerConfig): void {
    super.trigger(triggerConfig)
    this.setDuration(this.config.durationMs)

    // Color según intensidad
    if (triggerConfig.intensity > 0.75) {
      this.strikeColor = { h: 0, s: 100, l: 40 }     // Rojo Puro
    } else {
      this.strikeColor = { h: 230, s: 100, l: 30 }    // Azul Profundo
    }

    // Selección determinística de movers via beatPhase (Axioma Anti-Simulación)
    const beatPhase = triggerConfig.musicalContext?.beatPhase ?? 0.5
    if (beatPhase < 0.25) {
      this.targetZone = 'movers-left'
    } else if (beatPhase < 0.50) {
      this.targetZone = 'movers-right'
    } else if (beatPhase < 0.75) {
      // Modo alternado: L y R se turnan por flash
      this.targetZone = 'movers-left' // Empieza por left, alterna en getOutput
      this.alternateLeft = true
    } else {
      this.targetZone = 'all-movers'
    }

    console.log(
      `[SurgicalStrike 🎯] TRIGGERED: target=${this.targetZone} ` +
      `color=h${this.strikeColor.h} strobeHz=${this.config.strobeHz} ` +
      `duration=${this.config.durationMs}ms beatPhase=${beatPhase.toFixed(2)}`
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
    // STROBE TOGGLE: Dimmer alterna entre 0 y 1 a strobeHz
    // Un ciclo completo = 1/strobeHz segundos
    // Primera mitad = ON, segunda mitad = OFF
    // ═════════════════════════════════════════════════════════════════════
    const cycleMs = 1000 / this.config.strobeHz
    const positionInCycle = this.elapsedMs % cycleMs
    const isFlashOn = positionInCycle < (cycleMs * 0.4) // 40% duty cycle (más agresivo)

    const moverDimmer = isFlashOn ? this.triggerIntensity : 0

    // ═════════════════════════════════════════════════════════════════════
    // PARS: BLACKOUT TOTAL — la sala a oscuras
    // ═════════════════════════════════════════════════════════════════════
    const output: EffectFrameOutput = {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      dimmerOverride: 0,
      colorOverride: { h: 0, s: 0, l: 0 },
      intensity: moverDimmer,
      zones: ['front', 'all-pars', 'back', 'all-movers'],
      globalComposition: 1.0,
      zoneOverrides: {},
    }

    // Blackout en todas las zonas PAR
    const parZones = ['front', 'all-pars', 'back'] as const
    for (const zone of parZones) {
      output.zoneOverrides![zone] = {
        color: { h: 0, s: 0, l: 0 },
        dimmer: 0,
        blendMode: 'max' as const,
      }
    }

    // ═════════════════════════════════════════════════════════════════════
    // MOVERS: Estrobo quirúrgico — solo los seleccionados
    // "Pars paint the canvas, Movers pierce the sky"
    // ═════════════════════════════════════════════════════════════════════
    const beatPhase = this.musicalContext?.beatPhase ?? 0.5
    const isAlternateMode = beatPhase >= 0.50 && beatPhase < 0.75

    if (isAlternateMode) {
      // Modo alternado: L y R se turnan por cada flash
      const flashIndex = Math.floor(this.elapsedMs / cycleMs)
      const leftOn = flashIndex % 2 === 0

      output.zoneOverrides!['movers-left'] = this.getMoverColorOverride(
        this.strikeColor,
        leftOn ? moverDimmer : 0,
      )
      output.zoneOverrides!['movers-right'] = this.getMoverColorOverride(
        this.strikeColor,
        leftOn ? 0 : moverDimmer,
      )
    } else {
      // Modo normal: target zone recibe el estrobo, la otra a 0
      output.zoneOverrides![this.targetZone] = this.getMoverColorOverride(
        this.strikeColor,
        moverDimmer,
      )

      // Movers no seleccionados a negro
      if (this.targetZone === 'movers-left') {
        output.zoneOverrides!['movers-right'] = this.getMoverColorOverride(
          this.strikeColor, 0
        )
      } else if (this.targetZone === 'movers-right') {
        output.zoneOverrides!['movers-left'] = this.getMoverColorOverride(
          this.strikeColor, 0
        )
      }
      // all-movers: ambos lados ya cubiertos
    }

    return output
  }
}
