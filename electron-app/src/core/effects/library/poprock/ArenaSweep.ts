/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌊 ARENA_SWEEP - EL BARRIDO DE ROCK
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 1019: ROCK LEGENDS ARSENAL - "ANALOG POWER"
 * 
 * CONCEPTO:
 * Los grandes haces de luz cruzando el aire de lado a lado.
 * El efecto "Queen en Wembley". El pan y mantequilla del rock show.
 * 
 * COMPORTAMIENTO FÍSICO:
 * - Movimiento: Patrón vShape amplio
 *   - Izquierda y derecha se CRUZAN en el centro
 * - Sincronización: Al ritmo del Bass (Bombo)
 *   - PERO con INERCIA (no golpe a golpe, sino compás a compás)
 *   - Los haces PESAN, no son láser de discoteca
 * 
 * USO:
 * - El "default" del show de rock
 * - Funciona para el 80% de la canción
 * - No es el protagonista, es el telón de fondo épico
 * 
 * COLORES:
 * - Blanco Cálido (haces clásicos de arena)
 * - Tinte ámbar opcional
 * 
 * @module core/effects/library/poprock/ArenaSweep
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

interface ArenaSweepConfig {
  /** Duración total del efecto (ms) */
  durationMs: number
  
  /** ¿BPM-synced? */
  bpmSync: boolean
  
  /** Beats por sweep completo (ida) */
  beatsPerSweep: number
  
  /** Número de sweeps (ida y vuelta cuenta como 2) */
  sweepCount: number
  
  /** Color principal - Blanco Cálido */
  warmWhite: { h: number; s: number; l: number }
  
  /** Color secundario - Ámbar tenue */
  amberTint: { h: number; s: number; l: number }
  
  /** Amplitud del sweep (0-1, donde 1 = 180° de pan) */
  sweepAmplitude: number
  
  /** Factor de inercia (0-1, donde 1 = máxima inercia) */
  inertiaFactor: number
}

const DEFAULT_CONFIG: ArenaSweepConfig = {
  durationMs: 8000,              // 8 segundos base
  bpmSync: true,
  beatsPerSweep: 4,              // Un compás completo por sweep
  sweepCount: 4,                 // 2 idas y 2 vueltas
  
  // 💡 Blanco Cálido de arena
  warmWhite: { h: 40, s: 10, l: 85 },
  
  // 🧡 Ámbar tenue para calidez
  amberTint: { h: 35, s: 60, l: 60 },
  
  sweepAmplitude: 0.6,           // 60% del rango de pan
  inertiaFactor: 0.85,           // Alta inercia - los haces PESAN
}

// ═══════════════════════════════════════════════════════════════════════════
// 🌊 ARENA_SWEEP CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class ArenaSweep extends BaseEffect {
  readonly effectType = 'arena_sweep'
  readonly name = 'Arena Sweep'
  readonly category: EffectCategory = 'movement'  // Principalmente movimiento
  readonly priority = 70  // Media - es el workhorse, no el show-stopper
  readonly mixBus = 'htp' as const  // HTP - se integra con la física
  
  private config: ArenaSweepConfig
  private actualDurationMs = 8000
  private sweepDurationMs = 2000
  
  // 🌊 State
  private sweepIntensity = 0
  private sweepPhase = 0           // 0-1, posición en el sweep
  private currentSweep = 0
  private sweepDirection = 1       // 1 = izq→der, -1 = der→izq
  
  // Posiciones de movers con inercia
  private targetPanLeft = 0
  private targetPanRight = 0
  private currentPanLeft = 0
  private currentPanRight = 0
  
  private currentColor: { h: number; s: number; l: number }
  
  constructor(config?: Partial<ArenaSweepConfig>) {
    super('arena_sweep')
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.currentColor = { ...this.config.warmWhite }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect implementation
  // ─────────────────────────────────────────────────────────────────────────
  
  trigger(config: EffectTriggerConfig): void {
    super.trigger(config)
    
    // Reset state
    this.sweepIntensity = 0
    this.sweepPhase = 0
    this.currentSweep = 0
    this.sweepDirection = 1
    this.targetPanLeft = -this.config.sweepAmplitude
    this.targetPanRight = this.config.sweepAmplitude
    this.currentPanLeft = this.targetPanLeft
    this.currentPanRight = this.targetPanRight
    
    // Calcular duraciones basadas en BPM
    this.calculateDuration()
    
    console.log(`[ArenaSweep 🌊] TRIGGERED! SweepDuration=${this.sweepDurationMs}ms Sweeps=${this.config.sweepCount}`)
    console.log(`[ArenaSweep 🌊] WEMBLEY VIBES ACTIVATED!`)
  }
  
  private calculateDuration(): void {
    if (this.config.bpmSync && this.musicalContext?.bpm) {
      const msPerBeat = 60000 / this.musicalContext.bpm
      this.sweepDurationMs = msPerBeat * this.config.beatsPerSweep
    } else {
      this.sweepDurationMs = this.config.durationMs / this.config.sweepCount
    }
    
    this.actualDurationMs = this.sweepDurationMs * this.config.sweepCount
    
    // MAX DURATION de seguridad
    const MAX_DURATION_MS = 16000
    if (this.actualDurationMs > MAX_DURATION_MS) {
      const scaleFactor = MAX_DURATION_MS / this.actualDurationMs
      this.sweepDurationMs *= scaleFactor
      this.actualDurationMs = MAX_DURATION_MS
    }
  }
  
  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    
    this.elapsedMs += deltaMs
    
    // Actualizar fase del sweep
    this.sweepPhase += deltaMs / this.sweepDurationMs
    
    // ¿Completamos un sweep?
    if (this.sweepPhase >= 1) {
      this.sweepPhase = 0
      this.currentSweep++
      this.sweepDirection *= -1  // Cambiar dirección
      
      if (this.currentSweep >= this.config.sweepCount) {
        this.phase = 'finished'
        console.log(`[ArenaSweep 🌊] SWEEPS COMPLETE (${this.config.sweepCount} sweeps, ${this.elapsedMs}ms)`)
        return
      }
    }
    
    // Calcular intensidad
    this.updateIntensity()
    
    // Calcular targets de pan (vShape - se cruzan en el centro)
    this.updateTargetPositions()
    
    // Aplicar INERCIA - los haces pesan
    this.applyInertia(deltaMs)
    
    // Actualizar color (sutil variación)
    this.updateColor()
  }
  
  private updateIntensity(): void {
    // Intensidad constante con fade in/out suaves
    const totalProgress = this.elapsedMs / this.actualDurationMs
    
    if (totalProgress < 0.1) {
      // Fade in
      this.sweepIntensity = Math.pow(totalProgress / 0.1, 0.5) * 0.85
    } else if (totalProgress > 0.9) {
      // Fade out
      const fadeProgress = (totalProgress - 0.9) / 0.1
      this.sweepIntensity = 0.85 * (1 - Math.pow(fadeProgress, 0.5))
    } else {
      // Sustain
      this.sweepIntensity = 0.85
    }
  }
  
  private updateTargetPositions(): void {
    // Patrón vShape: L y R se cruzan en el centro
    // Usamos una curva sinusoidal para movimiento orgánico
    const sweepPosition = Math.sin(this.sweepPhase * Math.PI) * this.sweepDirection
    
    // MoverL: Empieza izquierda, va a derecha
    this.targetPanLeft = sweepPosition * this.config.sweepAmplitude
    
    // MoverR: Empieza derecha, va a izquierda (OPUESTO)
    this.targetPanRight = -sweepPosition * this.config.sweepAmplitude
  }
  
  private applyInertia(deltaMs: number): void {
    // Inercia: Los haces PESAN, no saltan instantáneamente
    // Interpolación exponencial hacia el target
    const inertia = this.config.inertiaFactor
    const lerpFactor = 1 - Math.pow(inertia, deltaMs / 16)  // Normalizado a ~60fps
    
    this.currentPanLeft += (this.targetPanLeft - this.currentPanLeft) * lerpFactor
    this.currentPanRight += (this.targetPanRight - this.currentPanRight) * lerpFactor
  }
  
  private updateColor(): void {
    // Sutil variación: más ámbar cuando los haces están en el centro
    const centerProximity = 1 - Math.abs(this.currentPanLeft)  // 0 en extremos, 1 en centro
    const t = centerProximity * 0.3  // Máximo 30% de tinte ámbar
    
    this.currentColor = {
      h: this.config.warmWhite.h + (this.config.amberTint.h - this.config.warmWhite.h) * t,
      s: this.config.warmWhite.s + (this.config.amberTint.s - this.config.warmWhite.s) * t,
      l: this.config.warmWhite.l + (this.config.amberTint.l - this.config.warmWhite.l) * t,
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Output
  // ─────────────────────────────────────────────────────────────────────────
  
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null
    
    const progress = this.elapsedMs / this.actualDurationMs
    
    // 🌊 MOVER LEFT - Barrido con inercia
    const moverLeftOverride = {
      color: this.currentColor,
      dimmer: this.sweepIntensity,
      movement: {
        pan: this.currentPanLeft,
        tilt: -0.15,              // Ligeramente hacia arriba (épico)
        isAbsolute: false,
        speed: 0.5,               // Velocidad media (los haces pesan)
      },
      blendMode: 'max' as const,
    }
    
    // 🌊 MOVER RIGHT - Barrido opuesto (vShape)
    const moverRightOverride = {
      color: this.currentColor,
      dimmer: this.sweepIntensity,
      movement: {
        pan: this.currentPanRight,
        tilt: -0.15,
        isAbsolute: false,
        speed: 0.5,
      },
      blendMode: 'max' as const,
    }
    
    // 💡 PARs - Acompañan el movimiento sutilmente
    // Más brillantes cuando los haces están en sus extremos
    const extremeIntensity = Math.abs(this.currentPanLeft) / this.config.sweepAmplitude
    
    const backOverride = {
      color: this.config.amberTint,
      dimmer: this.sweepIntensity * (0.3 + extremeIntensity * 0.3),
      blendMode: 'max' as const,
    }
    
    const frontOverride = {
      color: this.config.warmWhite,
      dimmer: this.sweepIntensity * 0.2,  // Muy sutil
      blendMode: 'max' as const,
    }
    
    const zoneOverrides = {
      'movers_left': moverLeftOverride,
      'movers_right': moverRightOverride,
      'back': backOverride,
      'front': frontOverride,
    }
    
    return {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      zones: Object.keys(zoneOverrides) as EffectZone[],
      intensity: this.sweepIntensity,
      zoneOverrides,
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════

export function createArenaSweep(config?: Partial<ArenaSweepConfig>): ArenaSweep {
  return new ArenaSweep(config)
}
