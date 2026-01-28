/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎸 LIQUID_SOLO - EL FOCO DEL GUITARRISTA
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 1019: ROCK LEGENDS ARSENAL - "ANALOG POWER"
 * 
 * CONCEPTO:
 * Un haz de luz que busca al protagonista. Diseñado para cuando
 * la guitarra "llora" o solea. El moment de gloria del guitarrista.
 * 
 * COMPORTAMIENTO FÍSICO:
 * - Separación L/R: Aprovechamos la física stereo
 *   - MoverR (agudos/guitarra): Se mueve RÁPIDO siguiendo la melodía
 *   - MoverL (base): Se queda LENTO, estable
 * - Iris: Cerrado (Spot) - foco definido
 * - Movimiento: Barridos suaves tipo "Wave" pero rápidos
 * 
 * AUDIO KEY:
 * - Se alimenta del MidHigh (guitarra lead)
 * - Clarity alta = solo definido = efecto más pronunciado
 * 
 * COLORES:
 * - Azul Eléctrico (David Gilmour vibes)
 * - Transición a Blanco Cálido en los peaks
 * 
 * @module core/effects/library/poprock/LiquidSolo
 * @version WAVE 1019 - ROCK LEGENDS ARSENAL
 */

import { BaseEffect } from '../../BaseEffect'
import {
  EffectTriggerConfig,
  EffectFrameOutput,
  EffectCategory,
  EffectZone,
} from '../../types'

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

interface LiquidSoloConfig {
  /** Duración total del efecto (ms) */
  durationMs: number
  
  /** ¿BPM-synced? */
  bpmSync: boolean
  
  /** Beats de duración */
  beatsTotal: number
  
  /** Color principal - Azul Eléctrico */
  electricBlue: { h: number; s: number; l: number }
  
  /** Color peak - Blanco Cálido */
  peakWhite: { h: number; s: number; l: number }
  
  /** Velocidad del wave (ciclos por segundo) */
  waveFrequency: number
  
  /** Amplitud del pan del MoverR (más rápido) */
  moverRightPanAmplitude: number
  
  /** Amplitud del pan del MoverL (más lento) */
  moverLeftPanAmplitude: number
}

const DEFAULT_CONFIG: LiquidSoloConfig = {
  durationMs: 4000,              // 4 segundos de spotlight
  bpmSync: true,
  beatsTotal: 8,                 // 8 beats de gloria
  
  // 💙 Azul Eléctrico (Gilmour vibes)
  electricBlue: { h: 210, s: 90, l: 55 },
  
  // 💡 Blanco Cálido para peaks
  peakWhite: { h: 40, s: 20, l: 90 },
  
  waveFrequency: 0.8,            // Ondas suaves, no frenéticas
  moverRightPanAmplitude: 0.4,   // MoverR: movimiento amplio (sigue guitarra)
  moverLeftPanAmplitude: 0.15,   // MoverL: drift sutil (base estable)
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎸 LIQUID_SOLO CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class LiquidSolo extends BaseEffect {
  readonly effectType = 'liquid_solo'
  readonly name = 'Liquid Solo'
  readonly category: EffectCategory = 'physical'
  readonly priority = 85  // Alta - es un momento especial
  readonly mixBus = 'htp' as const  // HTP - suma con física, no la reemplaza
  
  private config: LiquidSoloConfig
  private actualDurationMs = 4000
  
  // 🎸 State
  private soloIntensity = 0
  private wavePhase = 0
  private moverRightPan = 0
  private moverLeftPan = 0
  private currentColor: { h: number; s: number; l: number }
  
  constructor(config?: Partial<LiquidSoloConfig>) {
    super('liquid_solo')
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.currentColor = { ...this.config.electricBlue }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect implementation
  // ─────────────────────────────────────────────────────────────────────────
  
  trigger(config: EffectTriggerConfig): void {
    super.trigger(config)
    
    // Reset state
    this.soloIntensity = 0
    this.wavePhase = 0
    this.moverRightPan = 0
    this.moverLeftPan = 0
    
    // Calcular duración basada en BPM
    this.calculateDuration()
    
    console.log(`[LiquidSolo 🎸] TRIGGERED! Duration=${this.actualDurationMs}ms`)
    console.log(`[LiquidSolo 🎸] THE GUITARIST TAKES THE STAGE...`)
  }
  
  private calculateDuration(): void {
    if (this.config.bpmSync && this.musicalContext?.bpm) {
      const msPerBeat = 60000 / this.musicalContext.bpm
      this.actualDurationMs = msPerBeat * this.config.beatsTotal
    } else {
      this.actualDurationMs = this.config.durationMs
    }
    
    // MAX DURATION de seguridad
    const MAX_DURATION_MS = 8000
    if (this.actualDurationMs > MAX_DURATION_MS) {
      this.actualDurationMs = MAX_DURATION_MS
    }
  }
  
  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    
    this.elapsedMs += deltaMs
    
    // Progreso normalizado (0-1)
    const progress = Math.min(1, this.elapsedMs / this.actualDurationMs)
    
    // ¿Terminamos?
    if (progress >= 1) {
      this.phase = 'finished'
      console.log(`[LiquidSolo 🎸] SOLO COMPLETE (${this.elapsedMs}ms)`)
      console.log(`[LiquidSolo 🎸] THE GUITAR WEEPS NO MORE...`)
      return
    }
    
    // Calcular fase de wave
    this.wavePhase += (deltaMs / 1000) * this.config.waveFrequency * 2 * Math.PI
    
    // Curva de intensidad: Fade in → Sustain → Fade out
    this.updateIntensity(progress)
    
    // Actualizar movimientos de movers (L vs R)
    this.updateMoverMovements()
    
    // Actualizar color
    this.updateColor()
  }
  
  private updateIntensity(progress: number): void {
    // Envelope: Attack (10%) → Sustain (70%) → Decay (20%)
    if (progress < 0.1) {
      // Fade in suave
      this.soloIntensity = Math.pow(progress / 0.1, 0.7) * 0.9
    } else if (progress < 0.8) {
      // Sustain con breathing
      const sustainProgress = (progress - 0.1) / 0.7
      const breathe = Math.sin(sustainProgress * Math.PI * 4) * 0.1  // 4 respiraciones
      this.soloIntensity = 0.85 + breathe
    } else {
      // Fade out elegante
      const decayProgress = (progress - 0.8) / 0.2
      this.soloIntensity = 0.85 * (1 - Math.pow(decayProgress, 0.5))
    }
  }
  
  private updateMoverMovements(): void {
    // 🎸 MoverR: Rápido, sigue la "melodía" (ondas más frecuentes)
    // Wave principal + armónico
    const fastWave = Math.sin(this.wavePhase * 1.5) * 0.6 + Math.sin(this.wavePhase * 2.3) * 0.4
    this.moverRightPan = fastWave * this.config.moverRightPanAmplitude * this.soloIntensity
    
    // 🎸 MoverL: Lento, drift estable (onda más lenta)
    const slowWave = Math.sin(this.wavePhase * 0.4)
    this.moverLeftPan = slowWave * this.config.moverLeftPanAmplitude * this.soloIntensity
  }
  
  private updateColor(): void {
    // Transición: Azul Eléctrico → Blanco en los peaks de intensidad
    const peakBlend = Math.max(0, (this.soloIntensity - 0.8) / 0.2)  // Solo sobre 0.8
    const t = peakBlend * 0.4  // Máximo 40% de blanco
    
    this.currentColor = {
      h: this.config.electricBlue.h + (this.config.peakWhite.h - this.config.electricBlue.h) * t,
      s: this.config.electricBlue.s + (this.config.peakWhite.s - this.config.electricBlue.s) * t,
      l: this.config.electricBlue.l + (this.config.peakWhite.l - this.config.electricBlue.l) * t,
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Output
  // ─────────────────────────────────────────────────────────────────────────
  
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null
    
    const progress = this.elapsedMs / this.actualDurationMs
    
    // 🎸 MOVER RIGHT - El protagonista, sigue la melodía
    const moverRightOverride = {
      color: this.currentColor,
      dimmer: this.soloIntensity,
      movement: {
        pan: this.moverRightPan,
        tilt: -0.1 + Math.sin(this.wavePhase * 0.7) * 0.15,  // Tilt sutil
        isAbsolute: false,   // Offset sobre la física
        speed: 0.8,          // Rápido para seguir la guitarra
      },
      blendMode: 'max' as const,
    }
    
    // 🎸 MOVER LEFT - La base estable
    const moverLeftOverride = {
      color: this.currentColor,
      dimmer: this.soloIntensity * 0.7,  // Un poco menos intenso
      movement: {
        pan: this.moverLeftPan,
        tilt: 0,             // Estable
        isAbsolute: false,
        speed: 0.4,          // Lento, orgánico
      },
      blendMode: 'max' as const,
    }
    
    // 💡 PARs - Acompañan suavemente (no roban el spotlight)
    const backOverride = {
      color: { ...this.config.electricBlue, l: this.config.electricBlue.l * 0.5 },  // Más oscuro
      dimmer: this.soloIntensity * 0.3,
      blendMode: 'max' as const,
    }
    
    const frontOverride = {
      color: { ...this.config.electricBlue, l: this.config.electricBlue.l * 0.4 },
      dimmer: this.soloIntensity * 0.2,  // Muy sutil
      blendMode: 'max' as const,
    }
    
    const zoneOverrides = {
      'movers_right': moverRightOverride,
      'movers_left': moverLeftOverride,
      'back': backOverride,
      'front': frontOverride,
    }
    
    return {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      zones: Object.keys(zoneOverrides) as EffectZone[],
      intensity: this.soloIntensity,
      globalOverride: false,
      zoneOverrides,
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════

export function createLiquidSolo(config?: Partial<LiquidSoloConfig>): LiquidSolo {
  return new LiquidSolo(config)
}
