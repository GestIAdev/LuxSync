/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 SURGICAL STRIKE - THE SCALPEL IN THE DARK
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🔥 WAVE 2182: PARS PAINT, MOVERS PIERCE
 * 🔥 WAVE 2183: SEEK & DESTROY UPGRADE
 * 
 * FILOSOFÍA:
 * La sala se queda a oscuras. Los cabezales elegidos disparan un estrobo
 * brutal mientras sus cañones BUSCAN al público con oscilación agresiva.
 * El número de cabezales escala con el Z-score del impacto.
 * 
 * COMPORTAMIENTO:
 * - MixBus: 'global' (DICTADOR — necesita blackout total de PARs)
 * - Duración: 300-500ms (ultra-corto, golpe seco)
 * - Pars: Blackout total (0% Dimmer) — la sala en completa oscuridad
 * - Movers: Escalado dinámico por Z-score (Axioma Anti-Simulación):
 *   - Z < 3.0: 2 cabezales (default — bisturí fino)
 *   - Z 3.0-4.0: 4 cabezales (impacto masivo)
 *   - Z > 4.0: 6 cabezales / todos (devastación total)
 *   - Oscilación Pan/Tilt agresiva mientras escupe el estrobo
 *   - Color LATCHED: Azul Profundo o Rojo Puro (según intensity)
 *   - Estrobo via Dimmer toggle a 16Hz
 * - oneShot: true — un solo golpe, sin re-trigger
 * 
 * TARGETING (Axioma Anti-Simulación):
 * - beatPhase determina qué movers se activan (no random)
 * - La oscilación Pan/Tilt deriva del elapsedMs y beatPhase (determinístico)
 * 
 * @module core/effects/library/techno/SurgicalStrike
 * @version WAVE 2183 — SEEK & DESTROY UPGRADE
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
  durationMs: 400,   // WAVE 2183: 350→400ms para dar más tiempo a la oscilación
  strobeHz: 16,
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS DE ESCALADO — Axioma Anti-Simulación (todo determinístico)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Determina la cantidad de cabezales activos según Z-score.
 * Puro determinismo: no Math.random().
 */
function getActiveHeadCount(zScore: number): number {
  if (zScore >= 4.0) return 6   // Devastación total
  if (zScore >= 3.0) return 4   // Impacto masivo
  return 2                       // Bisturí fino (default)
}

/**
 * Oscilación de Pan derivada del tiempo y beatPhase.
 * Seno rápido: simula el movimiento de "búsqueda" agresiva.
 * f = 8Hz → el cabezal barre 8 veces por segundo.
 * La fase inicial deriva del beatPhase para variedad sin aleatoriedad.
 */
function getPanOscillation(elapsedMs: number, beatPhase: number): number {
  const freqHz = 8
  const phaseOffset = beatPhase * Math.PI * 2   // 0-2π según beatPhase
  const amplitude = 0.35                         // ±35% de rango de pan
  return amplitude * Math.sin((elapsedMs / 1000) * 2 * Math.PI * freqHz + phaseOffset)
}

/**
 * Oscilación de Tilt derivada del tiempo y beatPhase.
 * Coseno (90° desfasado respecto al pan) — movimiento circular agresivo.
 */
function getTiltOscillation(elapsedMs: number, beatPhase: number): number {
  const freqHz = 8
  const phaseOffset = beatPhase * Math.PI * 2
  const amplitude = 0.25                          // ±25% de rango de tilt
  return amplitude * Math.cos((elapsedMs / 1000) * 2 * Math.PI * freqHz + phaseOffset)
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
  /** Número de cabezales activos — escalado por Z-score */
  private activeHeadCount: number = 2
  /** beatPhase almacenado para la oscilación determinística en getOutput */
  private beatPhaseForOscillation: number = 0.5

  constructor(config?: Partial<SurgicalStrikeConfig>) {
    super('surgical_strike')
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  trigger(triggerConfig: EffectTriggerConfig): void {
    super.trigger(triggerConfig)
    this.setDuration(this.config.durationMs)

    // Color según intensidad
    if (triggerConfig.intensity > 0.75) {
      this.strikeColor = { h: 0,   s: 100, l: 40 }   // Rojo Puro
    } else {
      this.strikeColor = { h: 230, s: 100, l: 30 }   // Azul Profundo
    }

    const beatPhase = triggerConfig.musicalContext?.beatPhase ?? 0.5
    this.beatPhaseForOscillation = beatPhase

    // ═══════════════════════════════════════════════════════════════════════
    // ESCALADO DINÁMICO POR Z-SCORE (Axioma Anti-Simulación)
    // ═══════════════════════════════════════════════════════════════════════
    // El Z-score no está disponible en triggerConfig directamente,
    // pero la intensity actúa como proxy directo del impacto:
    //   intensity = 0.8 + prob * 0.2 (DROP) o 1.0 (DIVINE)
    // Mapeamos intensity → pseudo-zScore para el escalado.
    // DIVINE STRIKE siempre llega a intensity=1.0 → zScore efectivo ≥ 4.0
    const effectiveZ = (triggerConfig.intensity - 0.5) * 8  // [0.5→0, 1.0→4.0]
    this.activeHeadCount = getActiveHeadCount(effectiveZ)

    // Zona base según beatPhase (para la distribución espacial)
    if (beatPhase < 0.33) {
      this.targetZone = 'movers-left'
    } else if (beatPhase < 0.66) {
      this.targetZone = 'movers-right'
    } else {
      this.targetZone = 'all-movers'
    }

    // Con 4+ cabezales, siempre ambos lados
    if (this.activeHeadCount >= 4) {
      this.targetZone = 'all-movers'
    }

    console.log(
      `[SurgicalStrike 🎯] TRIGGERED: heads=${this.activeHeadCount} target=${this.targetZone} ` +
      `color=h${this.strikeColor.h} strobeHz=${this.config.strobeHz} ` +
      `duration=${this.config.durationMs}ms effectiveZ=${effectiveZ.toFixed(1)} beatPhase=${beatPhase.toFixed(2)}`
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
    // ═════════════════════════════════════════════════════════════════════
    const cycleMs = 1000 / this.config.strobeHz
    const positionInCycle = this.elapsedMs % cycleMs
    const isFlashOn = positionInCycle < (cycleMs * 0.4)  // 40% duty cycle

    const moverDimmer = isFlashOn ? this.triggerIntensity : 0

    // ═════════════════════════════════════════════════════════════════════
    // OSCILACIÓN PAN/TILT AGRESIVA (WAVE 2183 — Axioma Anti-Simulación)
    // Los cañones BUSCAN al público mientras escupen el estrobo.
    // ═════════════════════════════════════════════════════════════════════
    const panOffset  = getPanOscillation(this.elapsedMs, this.beatPhaseForOscillation)
    const tiltOffset = getTiltOscillation(this.elapsedMs, this.beatPhaseForOscillation)

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
    // MOVERS: Estrobo quirúrgico con oscilación Seek & Destroy
    // Con movimiento agresivo — los cañones buscan a alguien en el público
    // ═════════════════════════════════════════════════════════════════════
    const moverOverride = this.getMoverColorOverride(
      this.strikeColor,
      moverDimmer,
      {
        pan: panOffset,       // Oscilación horizontal agresiva
        tilt: tiltOffset,     // Oscilación vertical
        isAbsolute: false,    // Offset sobre posición base
        speed: 1.0,           // Velocidad máxima — movimiento violento
      }
    )

    if (this.targetZone === 'all-movers' || this.activeHeadCount >= 4) {
      // 4+ cabezales: ambos lados con oscilación opuesta (espejo L/R)
      output.zoneOverrides!['movers-left']  = this.getMoverColorOverride(
        this.strikeColor, moverDimmer,
        { pan: panOffset,  tilt: tiltOffset,  isAbsolute: false, speed: 1.0 }
      )
      output.zoneOverrides!['movers-right'] = this.getMoverColorOverride(
        this.strikeColor, moverDimmer,
        { pan: -panOffset, tilt: tiltOffset,  isAbsolute: false, speed: 1.0 }  // Espejo horizontal
      )
    } else if (this.targetZone === 'movers-left') {
      output.zoneOverrides!['movers-left']  = moverOverride
      output.zoneOverrides!['movers-right'] = this.getMoverColorOverride(this.strikeColor, 0)
    } else {
      output.zoneOverrides!['movers-right'] = moverOverride
      output.zoneOverrides!['movers-left']  = this.getMoverColorOverride(this.strikeColor, 0)
    }

    return output
  }
}
