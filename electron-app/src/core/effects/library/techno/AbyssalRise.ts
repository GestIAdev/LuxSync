/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🦈 ABYSSAL PRESSURE - THE UNDERWATER CRUSH
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🔥 WAVE 997: ABYSSAL REDEMPTION - REFACTOR TOTAL
 * 🎯 WAVE 1003.13: STROBE QUIRÚRGICO (maxStrobeCount=3, NO spam)
 * 
 * FILOSOFÍA:
 * NO es una "subida divina". Es PRESIÓN SUBMARINA.
 * La oscuridad del océano profundo que vibra, se contrae y colapsa
 * en un VOID antes del drop. BRUTAL. OSCURO. RÁPIDO.
 * 
 * ❌ ELIMINADO (WAVE 997):
 * - Duración de 10s (demasiado larga)
 * - Fase "Blinding" con whiteout cegador (molesto)
 * - Rampas lentas (el techno no espera)
 * 
 * ✅ NUEVO CONCEPTO:
 * - Duración: 3,500-4,000ms (ÁGIL)
 * - Colores: DEEP BLUE (#0000FF) + UV/PURPLE (#4B0082) - CERO BLANCO
 * - 3 Fases: PRESSURE (flicker oscuro) → CRUSH (strobe cyan) → VOID (blackout)
 * 
 * 🎯 WAVE 1003.13: STROBE REDUCTION
 * - ANTES: strobeSpeedMs=80ms → ~7 flashes en CRUSH (570ms)
 * - AHORA: maxStrobeCount=3 → Solo 3 golpes quirúrgicos (NO spam)
 * - RAZÓN: "Con que pegue 2 flashes o 3, es mas que suficiente" - Radwulf
 * 
 * COMPORTAMIENTO:
 * - MixBus: 'global' (DICTADOR - mata la física)
 * - Duración: 3,500-4,000ms (dinámico según BPM)
 * - Fase 1 (0-80%): PRESSURE - Azul profundo vibrando (flicker)
 * - Fase 2 (80-95%): CRUSH - 3 strobes cyan (80ms cada uno)
 * - Fase 3 (95-100%): VOID - Blackout total antes del drop
 * 
 * USO IDEAL:
 * - Pre-drop techno oscuro (Boris Brejcha, Adam Beyer)
 * - Buildups brutales de dubstep
 * - Cualquier momento "presión antes del estallido"
 * 
 * COLORES:
 * - Pressure: Azul profundo (240°, 100%, 30%) - OSCURO
 * - Crush: Cyan eléctrico (190°, 100%, 50%) - SIN BLANCO
 * - Void: Negro absoluto (0%, 0%, 0%)
 * 
 * MOVIMIENTO:
 * - Movers: Azul fijo durante pressure (respeta Mover Law)
 * - Sin cambios de color rápidos en movers
 * - Strobe solo en dimmer, NO en color
 * 
 * @module core/effects/library/techno/AbyssalRise
 * @version WAVE 997 - THE REDEMPTION
 */

import { BaseEffect } from '../../BaseEffect'
import { 
  EffectTriggerConfig, 
  EffectFrameOutput, 
  EffectCategory,
  EffectPhase
} from '../../types'

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION - WAVE 997 REFACTOR
// ═══════════════════════════════════════════════════════════════════════════

interface AbyssalPressureConfig {
  /** Duración total del efecto (ms) - WAVE 997: 3,500-4,000ms */
  durationMs: number
  
  /** Porcentaje de duración para fase PRESSURE (0-1) */
  pressurePhaseRatio: number
  
  /** Porcentaje de duración para fase CRUSH (0-1) */
  crushPhaseRatio: number
  
  /** Porcentaje de duración para fase VOID (0-1) */
  voidPhaseRatio: number
  
  /** Velocidad del flicker en fase PRESSURE (ms entre toggles) */
  flickerSpeedMs: number
  
  /** Velocidad del strobe en fase CRUSH (ms entre toggles) */
  strobeSpeedMs: number
  
  /** Número máximo de flashes en fase CRUSH (2-3 para impacto quirúrgico) */
  maxStrobeCount: number
  
  /** 🌊 WAVE 1090: Tiempo de fade in (ms) */
  fadeInMs: number
  
  /** 🌊 WAVE 1090: Tiempo de fade out (ms) */
  fadeOutMs: number
}

const DEFAULT_CONFIG: AbyssalPressureConfig = {
  durationMs: 3800,          // 3.8 segundos - WAVE 997 OPTIMIZADO (ágil)
  pressurePhaseRatio: 0.80,  // 80% en presión (3,040ms)
  crushPhaseRatio: 0.15,     // 15% en crush (570ms)
  voidPhaseRatio: 0.05,      // 5% en void (190ms)
  flickerSpeedMs: 150,       // Flicker rápido pero no agresivo
  strobeSpeedMs: 80,         // Strobe rápido en fase crush
  maxStrobeCount: 3,         // Solo 3 flashes (quirúrgico, NO spam)
  fadeInMs: 0,               // 🌊 WAVE 1090: Ataque instantáneo (techno)
  fadeOutMs: 200,            // 🌊 WAVE 1090: Salida limpia (void absorbe)
}

// Colores del viaje - WAVE 997: SIN BLANCO
const COLORS = {
  deepBlue: { h: 240, s: 100, l: 30 },    // Azul profundo (PRESSURE)
  uvPurple: { h: 270, s: 100, l: 40 },    // UV/Purple vibrante
  cyanElectric: { h: 190, s: 100, l: 50 }, // Cyan eléctrico (CRUSH - NO BLANCO)
  black: { h: 0, s: 0, l: 0 },            // Negro absoluto (VOID)
}

// ═══════════════════════════════════════════════════════════════════════════
// 🦈 ABYSSAL PRESSURE CLASS - WAVE 997
// ═══════════════════════════════════════════════════════════════════════════

export class AbyssalRise extends BaseEffect {
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect properties
  // ─────────────────────────────────────────────────────────────────────────
  
  readonly effectType = 'abyssal_rise'
  readonly name = 'Abyssal Pressure'  // WAVE 997: Renamed
  readonly category: EffectCategory = 'physical'
  readonly priority = 98  // MÁXIMA - efecto global
  readonly mixBus = 'global' as const  // 🚂 DICTADOR
  
  // ─────────────────────────────────────────────────────────────────────────
  // Internal state
  // ─────────────────────────────────────────────────────────────────────────
  
  private config: AbyssalPressureConfig
  private currentPhase: 'pressure' | 'crush' | 'void' = 'pressure'
  
  // Timestamps de transición entre fases
  private pressureEndMs = 0
  private crushEndMs = 0
  
  // ─────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────
  
  constructor(config?: Partial<AbyssalPressureConfig>) {
    super('abyssal_rise')
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.calculatePhaseTimings()
  }
  
  private calculatePhaseTimings(): void {
    this.pressureEndMs = this.config.durationMs * this.config.pressurePhaseRatio
    this.crushEndMs = this.pressureEndMs + (this.config.durationMs * this.config.crushPhaseRatio)
    // Void es lo que queda hasta durationMs
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect implementation
  // ─────────────────────────────────────────────────────────────────────────
  
  trigger(config: EffectTriggerConfig): void {
    super.trigger(config)
    
    // Afecta TODO (global override)
    this.zones = ['front', 'back', 'all-pars', 'all-movers']
    
    // Reset state
    this.currentPhase = 'pressure'
    
    // Ajustar duración si viene BPM del contexto
    if (config.musicalContext?.bpm) {
      const bpm = config.musicalContext.bpm
      const beatsPerMs = bpm / 60000
      // ~4 compases = 16 beats
      this.config.durationMs = Math.min(4000, 16 / beatsPerMs)
      this.calculatePhaseTimings()
    }
    
    console.log(
      `[AbyssalPressure 🦈] TRIGGERED: ${(this.config.durationMs / 1000).toFixed(2)}s | ` +
      `Phases: PRESSURE(${(this.config.pressurePhaseRatio * 100).toFixed(0)}%) → ` +
      `CRUSH(${(this.config.crushPhaseRatio * 100).toFixed(0)}%) → ` +
      `VOID(${(this.config.voidPhaseRatio * 100).toFixed(0)}%)`
    )
  }
  
  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    
    this.elapsedMs += deltaMs
    
    // Determinar fase actual
    if (this.elapsedMs < this.pressureEndMs) {
      this.currentPhase = 'pressure'
    } else if (this.elapsedMs < this.crushEndMs) {
      this.currentPhase = 'crush'
    } else if (this.elapsedMs < this.config.durationMs) {
      this.currentPhase = 'void'
    } else {
      this.phase = 'finished'
      console.log(`[AbyssalPressure 🦈] FINISHED - DROP TIME!`)
    }
  }
  
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null
    
    const progress = Math.min(1, this.elapsedMs / this.config.durationMs)
    const elapsed = this.elapsedMs
    const duration = this.config.durationMs
    
    // 🌊 WAVE 1090: FLUID DYNAMICS
    let fadeOpacity = 1.0
    const fadeOutStart = duration - this.config.fadeOutMs
    if (this.config.fadeInMs > 0 && elapsed < this.config.fadeInMs) {
      fadeOpacity = (elapsed / this.config.fadeInMs) ** 1.5
    } else if (this.config.fadeOutMs > 0 && elapsed > fadeOutStart) {
      fadeOpacity = ((duration - elapsed) / this.config.fadeOutMs) ** 1.5
    }
    
    // Construir output según fase
    switch (this.currentPhase) {
      case 'pressure':
        return this.buildPressureOutput(progress, fadeOpacity)
      case 'crush':
        return this.buildCrushOutput(progress, fadeOpacity)
      case 'void':
        return this.buildVoidOutput(progress, fadeOpacity)
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Phase outputs - WAVE 997 REFACTOR
  // ─────────────────────────────────────────────────────────────────────────
  
  private buildPressureOutput(progress: number, fadeOpacity: number): EffectFrameOutput {
    // FASE 1: PRESSURE (0-80%) - Azul profundo vibrando
    const phaseProgress = this.elapsedMs / this.pressureEndMs
    
    // Flicker rápido y oscuro (simulando presión submarina)
    const flickerToggle = (Date.now() % this.config.flickerSpeedMs) < (this.config.flickerSpeedMs / 2)
    const flicker = flickerToggle ? 0.8 : 0.2
    
    return {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      intensity: flicker * 0.8,
      colorOverride: COLORS.deepBlue,
      dimmerOverride: flicker * 0.8,
      zones: this.zones,
      globalComposition: fadeOpacity,  // 🌊 WAVE 1090
      zoneOverrides: {
        // MOVERS: Azul fijo (respeta Mover Law - sin cambio de color rápido)
        'all-movers': {
          color: COLORS.deepBlue,  // Azul profundo FIJO
          dimmer: 1.0,             // Full dimmer (el color es oscuro)
          blendMode: 'replace'
        },
        // PARS: UV/Purple vibrando con el flicker
        'all-pars': {
          color: COLORS.uvPurple,  // UV/Purple
          dimmer: flicker * 0.8,   // Intensidad variable (flicker)
          blendMode: 'replace'
        },
        // FRONT/BACK: Mix de ambos
        'front': {
          color: COLORS.deepBlue,
          dimmer: flicker * 0.6,
          blendMode: 'replace'
        },
        'back': {
          color: COLORS.uvPurple,
          dimmer: flicker * 0.5,
          blendMode: 'replace'
        }
      }
    }
  }
  
  private buildCrushOutput(progress: number, fadeOpacity: number): EffectFrameOutput {
    // FASE 2: CRUSH (80-95%) - Strobe cyan eléctrico (NO BLANCO)
    const phaseElapsed = this.elapsedMs - this.pressureEndMs
    const phaseDuration = this.crushEndMs - this.pressureEndMs
    const phaseProgress = Math.min(1, phaseElapsed / phaseDuration)
    
    // WAVE 1003.13: Limitar a maxStrobeCount flashes (2-3 golpes quirúrgicos)
    // Calcular cuántos ciclos completos han pasado (ON+OFF = 1 ciclo)
    const cycleCount = Math.floor(phaseElapsed / this.config.strobeSpeedMs)
    const withinStrobeLimit = cycleCount < this.config.maxStrobeCount
    
    // Strobe solo si no hemos alcanzado el límite
    const strobeToggle = withinStrobeLimit && 
                        (phaseElapsed % this.config.strobeSpeedMs) < (this.config.strobeSpeedMs / 2)
    const strobe = strobeToggle ? 1 : 0
    
    return {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      intensity: strobe,
      colorOverride: COLORS.cyanElectric,  // Cyan eléctrico (NO BLANCO)
      dimmerOverride: strobe,
      zones: this.zones,
      globalComposition: fadeOpacity,  // 🌊 WAVE 1090
      zoneOverrides: {
        'all-movers': {
          color: COLORS.cyanElectric,
          dimmer: strobe,
          blendMode: 'replace'
        },
        'all-pars': {
          color: COLORS.cyanElectric,
          dimmer: strobe,
          blendMode: 'replace'
        },
        'front': {
          color: COLORS.cyanElectric,
          dimmer: strobe,
          blendMode: 'replace'
        },
        'back': {
          color: COLORS.cyanElectric,
          dimmer: strobe,
          blendMode: 'replace'
        }
      }
    }
  }
  
  private buildVoidOutput(progress: number, fadeOpacity: number): EffectFrameOutput {
    // FASE 3: VOID (95-100%) - Blackout total antes del drop
    return {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      intensity: 0,
      colorOverride: COLORS.black,
      dimmerOverride: 0,
      zones: this.zones,
      globalComposition: fadeOpacity,  // 🌊 WAVE 1090
      zoneOverrides: {
        'all-movers': { dimmer: 0, blendMode: 'replace' },
        'all-pars': { dimmer: 0, blendMode: 'replace' },
        'front': { dimmer: 0, blendMode: 'replace' },
        'back': { dimmer: 0, blendMode: 'replace' }
      }
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────
  
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

export default AbyssalRise
