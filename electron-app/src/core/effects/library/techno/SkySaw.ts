/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ✂️ SKY SAW - THE BLADE THAT CUTS THE CEILING
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🔥 WAVE 930: THE ARSENAL
 * 
 * FILOSOFÍA:
 * Los movers no "barren". Los movers CORTAN.
 * Imagina una sierra de luz cortando el aire del club.
 * Movimientos duros, sin suavizado, sin piedad.
 * 
 * COMPORTAMIENTO:
 * - MixBus: 'htp' (ADITIVO - suma con física porque es movimiento)
 * - Tilt: Snap de 0° (suelo) a 90° (techo) en 0ms
 * - Pan: Cruce en X (tijera) - los movers se cruzan
 * - Timing: Sincronizado al beat, 1 corte por compás
 * 
 * USO IDEAL:
 * - Drops sucios de Dubstep/Neurofunk
 * - Momentos de máxima tensión
 * - Cuando quieres que el público mire ARRIBA
 * 
 * COLORES:
 * - Default: Cyan tóxico (180, 100, 70)
 * - Acid Mode: Verde ácido (120, 100, 50)
 * - El haz debe ser FINO (iris cerrado conceptualmente)
 * 
 * MOVIMIENTO:
 * - Fase 1: Tilt SNAP al techo (0ms transición)
 * - Fase 2: Hold 1 beat
 * - Fase 3: Tilt SNAP al suelo (0ms transición)
 * - Pan: Cruce en X durante todo el efecto
 * 
 * @module core/effects/library/techno/SkySaw
 * @version WAVE 930 - THE BLADE
 */

import { BaseEffect } from '../../BaseEffect'
import { 
  EffectTriggerConfig, 
  EffectFrameOutput, 
  EffectCategory,
  EffectPhase
} from '../../types'

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

interface SkySawConfig {
  /** Duración total del efecto (ms) */
  durationMs: number
  
  /** Número de cortes (ciclos suelo→techo→suelo) */
  cutCount: number
  
  /** Hold time en posición techo (ms) - momento de tensión */
  ceilingHoldMs: number
  
  /** Hold time en posición suelo (ms) - momento de release */
  floorHoldMs: number
}

const DEFAULT_CONFIG: SkySawConfig = {
  durationMs: 2000,          // 2s total (4 beats @ 120 BPM)
  cutCount: 2,               // 2 cortes por efecto
  ceilingHoldMs: 250,        // 250ms mirando al techo (tensión)
  floorHoldMs: 150,          // 150ms mirando al suelo (release)
  // 🚨 WAVE 2690: scissorMode, ceilingTilt, floorTilt PURGED — Selene no conduce posiciones
}

// ═══════════════════════════════════════════════════════════════════════════
// ✂️ SKY SAW CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class SkySaw extends BaseEffect {
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect properties
  // ─────────────────────────────────────────────────────────────────────────
  
  readonly effectType = 'sky_saw'
  readonly name = 'Sky Saw'
  readonly category: EffectCategory = 'color'  // 🚨 WAVE 2690: Was 'movement', purged to color-only
  readonly priority = 88  // Alta - los cortes no esperan
  readonly mixBus = 'htp' as const  // 🚂 ADITIVO - suma con física
  
  // ─────────────────────────────────────────────────────────────────────────
  // Internal state
  // ─────────────────────────────────────────────────────────────────────────
  
  private config: SkySawConfig
  private currentCut = 0             // Corte actual (0 to cutCount-1)
  private cutPhase: 'rising' | 'ceiling_hold' | 'falling' | 'floor_hold' = 'rising'
  private phaseTimer = 0             // Timer dentro de la fase actual
  private cutDurationMs = 0          // Duración de cada corte
  
  // Colores
  private sawColor: { h: number; s: number; l: number } = { h: 180, s: 100, l: 70 }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────
  
  constructor(config?: Partial<SkySawConfig>) {
    super('sky_saw')
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.calculateCutDuration()
  }
  
  private calculateCutDuration(): void {
    // Cada corte = rise + ceiling_hold + fall + floor_hold
    // Rise y fall son instantáneos (0ms), solo los holds cuentan
    const holdTime = this.config.ceilingHoldMs + this.config.floorHoldMs
    // Añadimos 100ms para las transiciones "snap" (aunque son rápidas)
    this.cutDurationMs = holdTime + 100
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect implementation
  // ─────────────────────────────────────────────────────────────────────────
  
  trigger(config: EffectTriggerConfig): void {
    super.trigger(config)
    
    // SkySaw solo afecta movers
    this.zones = ['all-movers']
    
    // Reset state
    this.currentCut = 0
    this.cutPhase = 'rising'
    this.phaseTimer = 0
    
    // Color basado en intensidad
    if (config.intensity > 0.7) {
      // Acid green para alta intensidad
      this.sawColor = { h: 120, s: 100, l: 50 }
    } else {
      // Cyan tóxico default
      this.sawColor = { h: 180, s: 100, l: 70 }
    }
    
    // Scissor positions reset — WAVE 2690: PURGED
    
    console.log(
      `[SkySaw ✂️] TRIGGERED: ${this.config.cutCount} cuts | ` +
      `Color: ${this.sawColor.h === 120 ? 'ACID 💚' : 'CYAN 🔵'}`
    )
  }
  
  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    
    this.elapsedMs += deltaMs
    this.phaseTimer += deltaMs
    
    // State machine para las fases del corte
    switch (this.cutPhase) {
      case 'rising':
        // Snap instantáneo al techo (50ms max)
        if (this.phaseTimer >= 50) {
          this.cutPhase = 'ceiling_hold'
          this.phaseTimer = 0
        }
        break
        
      case 'ceiling_hold':
        // Mantener posición techo
        if (this.phaseTimer >= this.config.ceilingHoldMs) {
          this.cutPhase = 'falling'
          this.phaseTimer = 0
        }
        break
        
      case 'falling':
        // Snap instantáneo al suelo (50ms max)
        if (this.phaseTimer >= 50) {
          this.cutPhase = 'floor_hold'
          this.phaseTimer = 0
        }
        break
        
      case 'floor_hold':
        // Mantener posición suelo
        if (this.phaseTimer >= this.config.floorHoldMs) {
          // Siguiente corte
          this.currentCut++
          
          if (this.currentCut >= this.config.cutCount) {
            this.phase = 'finished'
            console.log(`[SkySaw ✂️] FINISHED (${this.elapsedMs}ms)`)
            return
          }
          
          // Reset para siguiente corte
          this.cutPhase = 'rising'
          this.phaseTimer = 0
          
          // 🚨 WAVE 2690: scissor pan swap PURGED
        }
        break
    }
  }
  
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null
    
    const progress = Math.min(1, this.elapsedMs / this.config.durationMs)
    
    // 🚨 WAVE 2690: Tilt/pan state machine PURGED — Selene solo pinta fotones
    // El timing de cuts ahora solo controla flashes de dimmer/color
    
    // Dimmer basado en cut phase: ON durante ceiling_hold, OFF durante floor_hold
    const isActive = this.cutPhase === 'rising' || this.cutPhase === 'ceiling_hold'
    const cutDimmer = isActive ? this.triggerIntensity : 0
    
    // Construir zone overrides para movers L y R (solo color/dimmer)
    const zoneOverrides: Record<string, {
      color: { h: number; s: number; l: number }
      dimmer: number
    }> = {
      'movers-left': {
        color: this.sawColor,
        dimmer: cutDimmer,
      },
      'movers-right': {
        color: this.sawColor,
        dimmer: cutDimmer,
      }
    }
    
    return {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      colorOverride: this.sawColor,
      dimmerOverride: cutDimmer,
      intensity: this.triggerIntensity,
      zones: this.zones,
      // 🚨 WAVE 2690: movement PURGED
      zoneOverrides
    }
  }
  
  getPhase(): EffectPhase {
    return this.phase
  }
  
  isFinished(): boolean {
    return this.phase === 'finished'
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export default SkySaw
