/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ INDUSTRIAL STROBE - THE HAMMER
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🔪 WAVE 770: TECHNO PHYSICS KERNEL
 * 🔨 WAVE 2202: HAMMER REPOWER — El Martillo era un golpecito. Arreglado.
 * 
 * FILOSOFÍA:
 * El strobe industrial es el martillo que golpea el acero.
 * No pregunta. No espera. Solo EJECUTA.
 * 
 * COMPORTAMIENTO (WAVE 2202):
 * - MixBus: 'global' (DICTADOR - ignora física, toma control total)
 * - Reactivo a context.spectral.harshness (acid lines)
 * - Reactivo a context.spectral.flatness (noise/CO2)
 * - Pre-ducking: 80ms de negro antes del flash (más contraste, más impacto)
 * - Flash inicial LARGO: 60ms (el primer golpe tiene que doler)
 * - Flashes de seguimiento: 40ms (3 golpes adicionales rápidos)
 * - Gaps irregulares: 55ms / 45ms / 55ms (chaos=0.55 reflejado en timing)
 * - Total de flashes: 4 (era 3, WAVE 2202: +1 para más presencia)
 * 
 * SAFETY:
 * - Anti-epilepsia: máximo 10Hz efectivo
 * - Cooldown mínimo: 100ms entre ráfagas
 * 
 * COLORES:
 * - Normal: Blanco puro (0,0,100)
 * - Acid mode: Cyan tóxico (180,100,70)
 * - Noise mode: Magenta industrial (300,100,75)
 * 
 * @module core/effects/library/techno/IndustrialStrobe
 * @version WAVE 770 - THE HAMMER
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

interface IndustrialStrobeConfig {
  /** Número de flashes en la ráfaga */
  flashCount: number
  
  /** Duración del primer flash — el golpe inicial, tiene que doler (ms) */
  firstFlashDurationMs: number
  
  /** Duración de los flashes de seguimiento (ms) */
  flashDurationMs: number
  
  /** Gaps entre flashes — irregulares para reflejar chaos=0.55 (ms[]) */
  gapDurationsMs: number[]
  
  /** Pre-ducking: negro antes del flash (ms) */
  preDuckMs: number
  
  /** Frecuencia máxima permitida (Hz) - seguridad anti-epilepsia */
  maxFrequencyHz: number
  
  /** Cooldown mínimo entre ráfagas (ms) */
  cooldownMs: number
  
  /** Umbrales para modos espectrales */
  harshnessThreshold: number
  flatnessThreshold: number
  
  /** 🌊 WAVE 1090: Fade in (ms) - 0 para techno */
  fadeInMs: number
  
  /** 🌊 WAVE 1090: Fade out (ms) */
  fadeOutMs: number
}

const DEFAULT_CONFIG: IndustrialStrobeConfig = {
  // 🔨 WAVE 2202: HAMMER REPOWER
  // Era: 3 flashes × 35ms, gaps 65ms, preDuck 50ms → 345ms total, liviano
  // Ahora: 4 flashes, primer flash 60ms (impacto), resto 40ms, gaps irregulares,
  //        preDuck 80ms (más negro = más contraste = más explosión percibida)
  flashCount: 4,               // +1 flash: 3→4. Más presencia, más martillo.
  firstFlashDurationMs: 60,    // El primer golpe dura más — establece el impacto
  flashDurationMs: 40,         // Flashes de seguimiento: cortos y brutales
  gapDurationsMs: [55, 45, 55],// Gaps irregulares (3 gaps para 4 flashes)
                                // No son iguales — chaos=0.55 se refleja en timing
  preDuckMs: 80,               // 80ms de negro (era 50ms). Más negro = más bomba.
  maxFrequencyHz: 10,          // Máximo 10 Hz (seguro para epilepsia)
  cooldownMs: 150,             // 150ms entre ráfagas
  harshnessThreshold: 0.6,     // Umbral para modo ácido
  flatnessThreshold: 0.7,      // Umbral para modo noise
  fadeInMs: 0,                 // 🌊 WAVE 1090: TECHNO = Ataque instantáneo
  fadeOutMs: 100,              // 🌊 WAVE 1090: Salida muy corta
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔪 INDUSTRIAL STROBE CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class IndustrialStrobe extends BaseEffect {
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect properties
  // ─────────────────────────────────────────────────────────────────────────
  
  readonly effectType = 'industrial_strobe'
  readonly name = 'Industrial Strobe'
  readonly category: EffectCategory = 'physical'
  readonly priority = 95  // MÁXIMA - el martillo no se detiene
  readonly mixBus = 'global' as const  // 🚂 DICTADOR - toma control total
  
  // ─────────────────────────────────────────────────────────────────────────
  // Internal state
  // ─────────────────────────────────────────────────────────────────────────
  
  private config: IndustrialStrobeConfig
  private currentFlash = 0
  private isFlashOn = false
  private isPreDucking = false
  private phaseTimer = 0
  private totalDurationMs = 0
  
  // Spectral modes (detectados del contexto)
  private acidMode = false
  private noiseMode = false
  
  // Color calculado
  private calculatedColor: { h: number; s: number; l: number } = { h: 0, s: 0, l: 100 }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────
  
  constructor(config?: Partial<IndustrialStrobeConfig>) {
    super('industrial_strobe')
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.calculateTotalDuration()
  }
  
  private calculateTotalDuration(): void {
    // ⚡ WAVE 3472: Ventana activa basada en 15Hz estricto (66ms por ciclo, 4 flashes)
    this.totalDurationMs = this.config.preDuckMs + (this.config.flashCount * 66)
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect implementation
  // ─────────────────────────────────────────────────────────────────────────
  
  trigger(config: EffectTriggerConfig): void {
    super.trigger(config)
    
    // IndustrialStrobe es GLOBAL - afecta todo el escenario
    this.zones = ['front', 'back', 'all-movers', 'all-pars']
    
    // Reset state
    this.currentFlash = 0
    this.isFlashOn = false
    this.isPreDucking = true  // Empezar con pre-duck
    this.phaseTimer = 0
    
    // 🔪 Detectar modos espectrales del contexto
    this.detectSpectralModes(config)
    
    // 🔪 Calcular color según modo
    this.calculateFlashColor()
    
    console.log(`[IndustrialStrobe ⚡] TRIGGERED! Flashes=${this.config.flashCount} AcidMode=${this.acidMode} NoiseMode=${this.noiseMode} Color=hsl(${this.calculatedColor.h},${this.calculatedColor.s}%,${this.calculatedColor.l}%)`)
  }
  
  /**
   * 🔪 Detectar modos espectrales del contexto musical
   */
  private detectSpectralModes(config: EffectTriggerConfig): void {
    // Por ahora usamos valores mock si no hay contexto
    // En producción vendrán de context.spectral.harshness/flatness
    const harshness = (config as any).harshness ?? 0
    const flatness = (config as any).flatness ?? 0
    
    this.acidMode = harshness > this.config.harshnessThreshold
    this.noiseMode = flatness > this.config.flatnessThreshold
  }
  
  /**
   * 🔪 Calcular color del flash según modo espectral
   */
  private calculateFlashColor(): void {
    if (this.acidMode) {
      // 🧪 ACID MODE: Cyan tóxico
      this.calculatedColor = { h: 180, s: 100, l: 70 }
    } else if (this.noiseMode) {
      // 📻 NOISE MODE: Magenta industrial
      this.calculatedColor = { h: 300, s: 100, l: 75 }
    } else {
      // ⚪ NORMAL: Blanco puro
      this.calculatedColor = { h: 0, s: 0, l: 100 }
    }
  }
  
  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    
    this.elapsedMs += deltaMs
    this.phaseTimer += deltaMs
    
    // 🔪 FASE 1: Pre-ducking (negro antes del flash)
    if (this.isPreDucking) {
      if (this.phaseTimer >= this.config.preDuckMs) {
        this.isPreDucking = false
        this.phaseTimer = 0
      }
      return
    }

    // ⚡ WAVE 3472: Oscilador Industrial 15Hz Puro
    const activeElapsed = Math.max(0, this.elapsedMs - this.config.preDuckMs)
    const pos = activeElapsed % 66
    this.isFlashOn = pos < 33

    if (this.elapsedMs >= this.totalDurationMs) {
      this.phase = 'finished'
      console.log(`[IndustrialStrobe ⚡] FINISHED (${this.elapsedMs}ms)`)
      return
    }
  }
  
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null
    
    const progress = Math.min(1, this.elapsedMs / this.totalDurationMs)
    
    // 🌊 WAVE 1090: FLUID DYNAMICS - Calcular fadeOpacity
    let fadeOpacity = 1.0
    const fadeOutStart = this.totalDurationMs - this.config.fadeOutMs
    if (this.config.fadeInMs > 0 && this.elapsedMs < this.config.fadeInMs) {
      fadeOpacity = (this.elapsedMs / this.config.fadeInMs) ** 1.5
    } else if (this.config.fadeOutMs > 0 && this.elapsedMs > fadeOutStart) {
      fadeOpacity = ((this.totalDurationMs - this.elapsedMs) / this.config.fadeOutMs) ** 1.5
    }
    
    // 🔪 Durante pre-duck: NEGRO TOTAL (el contraste hace el efecto)
    if (this.isPreDucking) {
      return {
        effectId: this.id,
        category: this.category,
        phase: this.phase,
        progress,
        dimmerOverride: 0,
        colorOverride: { h: 0, s: 0, l: 0 },  // Negro
        intensity: 0,
        zones: this.zones,
        globalComposition: fadeOpacity  // 🌊 WAVE 1090
      }
    }
    
    // 🔪 Durante flash: COLOR A FULL
    if (this.isFlashOn) {
      return {
        effectId: this.id,
        category: this.category,
        phase: this.phase,
        progress,
        dimmerOverride: 1.0,
        colorOverride: { h: 0, s: 0, l: 1.0 },
        whiteOverride: 1.0,
        intensity: 1.0,  // FULL
        zones: this.zones,
        globalComposition: fadeOpacity  // 🌊 WAVE 1090
      }
    }
    
    // 🔪 Durante gap: NEGRO (crea el contraste)
    return {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      dimmerOverride: 0,
      colorOverride: { h: 0, s: 0, l: 0 },  // Negro
      whiteOverride: 0,
      intensity: 0,
      zones: this.zones,
      globalComposition: fadeOpacity  // 🌊 WAVE 1090
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
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export default IndustrialStrobe
