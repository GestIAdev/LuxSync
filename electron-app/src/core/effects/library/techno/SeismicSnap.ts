/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 💥 SEISMIC SNAP - TERREMOTO VISUAL CONTUNDENTE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * � WAVE 997.6: SEISMIC RECONSTRUCTION - "De flash rojo a terremoto visual"
 * 
 * FILOSOFÍA ACTUALIZADA:
 * NO es un "flash de cámara". Es un TERREMOTO SÍSMICO.
 * Blackout → SNAP CONTUNDENTE → SHAKE (vibración) → Fade out.
 * El impacto físico de un golpe que hace VIBRAR el escenario.
 * 
 * ❌ ELIMINADO (WAVE 997.6):
 * - Snap de 200ms (invisible)
 * - Duración total de 1,500ms (demasiado corta)
 * - Concepto "flash de fotógrafo" (poco techno)
 * 
 * ✅ NUEVO:
 * - Snap de 400ms (VISIBLE y CONTUNDENTE)
 * - Fase SHAKE de 600ms (vibración post-impacto)
 * - Duración total: 2,500ms (impactante)
 * 
 * ZONA TARGET: ACTIVE / INTENSE (E=0.45-0.82)
 * Para momentos que necesitan IMPACTO BRUTAL y VISIBLE.
 * 
 * COMPORTAMIENTO:
 * - MixBus: 'global' (OVERRIDE total durante el efecto)
 * - Pattern: 4 fases estrictas
 *   1. BLACKOUT (150ms) - Preparación del golpe
 *   2. SNAP (400ms) - Flash ROJO/BLANCO al 100% SOSTENIDO
 *   3. SHAKE (600ms) - Vibración rápida post-impacto
 *   4. FADE (1350ms) - Decay exponencial
 * - Duración total: 2500ms (MEDIUM - exento de THE MOVER LAW)
 * 
 * ⚠️ AXIOMA ANTI-SIMULACIÓN:
 * Timing FIJO. Colores FIJOS. DETERMINISTA al 100%.
 * 
 * ADN:
 * - Aggression: 0.80 (Golpe físico brutal)
 * - Chaos: 0.30 (Vibración añade caos controlado)
 * - Organicity: 0.10 (Casi 100% máquina)
 * 
 * THE MOVER LAW: Este efecto es MEDIUM (2500ms > 2000ms)
 * → Movers en MODO FANTASMA (solo dimmer, sin color override rápido)
 * 
 * @module core/effects/library/techno/SeismicSnap
 * @version WAVE 997.6 - SEISMIC RECONSTRUCTION
 */

import { BaseEffect } from '../../BaseEffect'
import { 
  EffectTriggerConfig, 
  EffectFrameOutput, 
  EffectCategory,
  EffectZone
} from '../../types'

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

interface SeismicSnapConfig {
  /** Duración fase BLACKOUT (ms) */
  blackoutDurationMs: number
  
  /** Duración fase SNAP (ms) */
  snapDurationMs: number
  
  /** Duración fase SHAKE (ms) - WAVE 997.6: Nueva fase de vibración */
  shakeDurationMs: number
  
  /** Duración fase FADE (ms) */
  fadeDurationMs: number
  
  /** Frecuencia de vibración en fase SHAKE (Hz) */
  shakeFrequencyHz: number
}

const DEFAULT_CONFIG: SeismicSnapConfig = {
  blackoutDurationMs: 150,   // 🔥 WAVE 997.6: 150ms (más corto)
  snapDurationMs: 400,       // 🔥 WAVE 997.6: 400ms (DOBLE - visible y contundente)
  shakeDurationMs: 600,      // 🔥 WAVE 997.6: 600ms (nueva fase - vibración post-impacto)
  fadeDurationMs: 1350,      // 🔥 WAVE 997.6: 1350ms (decay más largo)
  shakeFrequencyHz: 10,      // 🔥 WAVE 997.6: 10 Hz = 10 vibraciones por segundo
}

// Total: 2500ms - WAVE 997.6

// ═══════════════════════════════════════════════════════════════════════════
// COLORES Y ZONAS
// ═══════════════════════════════════════════════════════════════════════════

// Colores: ROJO IMPACTO y BLANCO PURO (alternados por trigger)
const COLORS = {
  impactRed:  { h: 0, s: 90, l: 55 },      // Rojo impacto
  pureWhite:  { h: 0, s: 0, l: 100 },      // Blanco puro
  warmWhite:  { h: 40, s: 30, l: 95 },     // Blanco cálido (flash foto)
}

// Zonas para el efecto
const SNAP_ZONES: EffectZone[] = ['front', 'pars', 'back', 'movers']

// ═══════════════════════════════════════════════════════════════════════════
// FASES DEL EFECTO - WAVE 997.6
// ═══════════════════════════════════════════════════════════════════════════

type SeismicPhase = 'blackout' | 'snap' | 'shake' | 'fade'

// ═══════════════════════════════════════════════════════════════════════════
// 💥 SEISMIC SNAP CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class SeismicSnap extends BaseEffect {
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect properties
  // ─────────────────────────────────────────────────────────────────────────
  
  readonly effectType = 'seismic_snap'
  readonly name = 'Seismic Snap'
  readonly category: EffectCategory = 'physical'
  readonly priority = 78  // Alto - este es un efecto de IMPACTO
  readonly mixBus = 'global' as const  // 🎯 OVERRIDE física total
  
  // ─────────────────────────────────────────────────────────────────────────
  // Internal state
  // ─────────────────────────────────────────────────────────────────────────
  
  private config: SeismicSnapConfig = DEFAULT_CONFIG
  private currentPhase: SeismicPhase = 'blackout'
  private useWhiteFlash: boolean = false
  private triggerTimestamp: number = 0
  
  // ─────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────
  
  constructor() {
    super('seismic_snap')
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Computed durations
  // ─────────────────────────────────────────────────────────────────────────
  
  private get totalDurationMs(): number {
    return this.config.blackoutDurationMs + this.config.snapDurationMs + 
           this.config.shakeDurationMs + this.config.fadeDurationMs
  }
  
  private get snapStartMs(): number {
    return this.config.blackoutDurationMs
  }
  
  private get shakeStartMs(): number {
    return this.config.blackoutDurationMs + this.config.snapDurationMs
  }
  
  private get fadeStartMs(): number {
    return this.config.blackoutDurationMs + this.config.snapDurationMs + this.config.shakeDurationMs
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Trigger: Determinar color del flash (DETERMINISTA)
   */
  trigger(config: EffectTriggerConfig): void {
    super.trigger(config)
    
    this.triggerTimestamp = Date.now()
    this.currentPhase = 'blackout'
    
    // 🔥 WAVE 998.1: ALTERNANCIA REAL DETERMINISTA
    // ❌ ANTES: triggerSecond % 2 (múltiples disparos mismo segundo = mismo color)
    // ✅ AHORA: Siempre ROJO (el blanco ya no es bienvenido en techno)
    this.useWhiteFlash = false
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Update loop
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Update: Avanza tiempo y determina fase actual
   */
  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    
    this.elapsedMs += deltaMs
    
    // ¿Terminado?
    if (this.elapsedMs >= this.totalDurationMs) {
      this.phase = 'finished'
      return
    }
    
    // Determinar fase interna
    if (this.elapsedMs < this.snapStartMs) {
      this.currentPhase = 'blackout'
    } else if (this.elapsedMs < this.shakeStartMs) {
      this.currentPhase = 'snap'
    } else if (this.elapsedMs < this.fadeStartMs) {
      this.currentPhase = 'shake'
    } else {
      this.currentPhase = 'fade'
    }
  }
  
  /**
   * GetOutput: Genera frame según fase actual
   */
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null
    
    const elapsed = this.elapsedMs
    const progress = Math.min(elapsed / this.totalDurationMs, 1)
    
    switch (this.currentPhase) {
      case 'blackout':
        return this.buildBlackoutOutput(progress)
      case 'snap':
        return this.buildSnapOutput(progress)
      case 'shake':
        return this.buildShakeOutput(progress)
      case 'fade':
        return this.buildFadeOutput(progress)
      default:
        return null
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Output builders por fase
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 🖤 FASE 1: BLACKOUT
   * Preparación del golpe. Silencio total antes del SNAP.
   */
  private buildBlackoutOutput(progress: number): EffectFrameOutput {
    return {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      zones: SNAP_ZONES,
      intensity: 0,
      dimmerOverride: 0,
      globalOverride: true,
      zoneOverrides: this.buildZoneOverrides(0, null),
    }
  }
  
  /**
   * ⚡ FASE 2: SNAP
   * Flash instantáneo al 100% SOSTENIDO. El golpe propiamente dicho.
   * 🔥 WAVE 997.6: Ahora dura 400ms (visible y contundente)
   */
  private buildSnapOutput(progress: number): EffectFrameOutput {
    const color = this.useWhiteFlash ? COLORS.warmWhite : COLORS.impactRed
    
    return {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      zones: SNAP_ZONES,
      intensity: 1.0,
      dimmerOverride: 1.0,
      colorOverride: color,
      globalOverride: true,
      zoneOverrides: this.buildZoneOverrides(1.0, color),
    }
  }
  
  /**
   * 🌀 FASE 3: SHAKE (NUEVA - WAVE 997.6)
   * Vibración rápida post-impacto. Como un terremoto visual.
   * Flicker ON/OFF a 10 Hz (10 vibraciones por segundo)
   */
  private buildShakeOutput(progress: number): EffectFrameOutput {
    const color = this.useWhiteFlash ? COLORS.warmWhite : COLORS.impactRed
    
    // Calcular progreso dentro de la fase shake
    const shakeElapsed = this.elapsedMs - this.shakeStartMs
    const shakeProgress = Math.min(shakeElapsed / this.config.shakeDurationMs, 1)
    
    // Vibración ON/OFF basada en frecuencia
    const cycleDurationMs = 1000 / this.config.shakeFrequencyHz
    const cycleProgress = (shakeElapsed % cycleDurationMs) / cycleDurationMs
    const isOn = cycleProgress < 0.5
    
    // Intensidad decae durante la vibración (de 1.0 a 0.4)
    const decayIntensity = 1.0 - (shakeProgress * 0.6)
    const vibrateIntensity = isOn ? decayIntensity : (decayIntensity * 0.3)
    
    return {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      zones: SNAP_ZONES,
      intensity: vibrateIntensity,
      dimmerOverride: vibrateIntensity,
      colorOverride: color,
      globalOverride: true,
      zoneOverrides: this.buildZoneOverrides(vibrateIntensity, color),
    }
  }
  
  /**
   * 📉 FASE 4: FADE
   * Decay exponencial. Como la persistencia retiniana del impacto.
   */
  private buildFadeOutput(progress: number): EffectFrameOutput {
    // Calcular progreso dentro de la fase fade
    const fadeElapsed = this.elapsedMs - this.fadeStartMs
    const fadeProgress = Math.min(fadeElapsed / this.config.fadeDurationMs, 1)
    
    // Decay exponencial: empieza rápido, termina lento
    // Curva: (1 - t)^2 → al 50% del tiempo ya está al 25%
    const decayIntensity = Math.pow(1 - fadeProgress, 2)
    
    const color = this.useWhiteFlash ? COLORS.warmWhite : COLORS.impactRed
    
    return {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      zones: SNAP_ZONES,
      intensity: decayIntensity,
      dimmerOverride: decayIntensity,
      colorOverride: color,
      globalOverride: true,
      zoneOverrides: this.buildZoneOverrides(decayIntensity, color),
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Zone overrides builder
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Construye zoneOverrides para todas las zonas
   */
  private buildZoneOverrides(
    dimmer: number, 
    color: { h: number; s: number; l: number } | null
  ): Record<string, { dimmer: number; color?: { h: number; s: number; l: number } }> {
    const overrides: Record<string, { dimmer: number; color?: { h: number; s: number; l: number } }> = {}
    
    for (const zone of SNAP_ZONES) {
      if (color) {
        overrides[zone] = { dimmer, color }
      } else {
        overrides[zone] = { dimmer }
      }
    }
    
    return overrides
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Debug
  // ─────────────────────────────────────────────────────────────────────────
  
  getDebugState(): Record<string, unknown> {
    return {
      effectType: this.effectType,
      phase: this.phase,
      currentPhase: this.currentPhase,
      elapsedMs: this.elapsedMs,
      totalDurationMs: this.totalDurationMs,
      useWhiteFlash: this.useWhiteFlash,
      intensity: this.getOutput()?.intensity ?? 0,
    }
  }
}

// Default export para compatibilidad
export default SeismicSnap
