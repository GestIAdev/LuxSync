/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🦠 GLITCH GUAGUANCÓ - CYBER-TROPICAL VIRUS
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🌊 WAVE 1004.3: FASE 3 - DNA EXTREMOS
 * 
 * EL VIRUS: Rompe el ritmo 3-2 de la clave con ruido digital.
 * Colores "tóxicos" (Lima/Magenta) infectando la base latina.
 * 
 * DNA TARGET:
 * - Aggression: 0.60 (Medio - no asesina, infecta)
 * - Chaos: 0.90 (CAOS TOTAL - impredecible)
 * - Organicity: 0.10 (Digital - glitch puro)
 * 
 * FILOSOFÍA:
 * "El guaguancó fue hackeado. El código se corrompió.
 * Los espíritus digitales bailan en frecuencias rotas."
 * 
 * MECÁNICA:
 * - Patrón base 3-2 PERO con micro-glitches aleatorios
 * - Colores TÓXICOS: Lima (120°) → Magenta (320°) → Cyan (180°)
 * - Micro-stutters: 20-40ms de flickers rápidos
 * - Momentos de "freeze" (congelado digital)
 * - Ruido visual: dimmer fluctuante caótico
 * 
 * PERFECT FOR:
 * - Breakdowns de reggaetón experimental
 * - Transiciones glitchy
 * - Cuando el DJ "rompe" el beat
 * - Momentos de tensión/suspenso tropical
 * 
 * @module core/effects/library/fiestalatina/GlitchGuaguanco
 * @version WAVE 1004.3
 */

import { BaseEffect } from '../../BaseEffect'
import { 
  EffectTriggerConfig, 
  EffectFrameOutput, 
  EffectCategory,
  EffectZone
} from '../../types'

// ═══════════════════════════════════════════════════════════════════════════
// 🦠 CONFIGURATION - CYBER VIRUS
// ═══════════════════════════════════════════════════════════════════════════

interface GlitchGuaguancoConfig {
  /** Duración total del glitch (ms) */
  durationMs: number
  
  /** Frecuencia base de glitches (Hz) */
  baseGlitchHz: number
  
  /** Variación de frecuencia (randomness) */
  frequencyJitter: number
  
  /** Probabilidad de freeze (0-1) */
  freezeProbability: number
  
  /** Duración del freeze (ms) */
  freezeDurationMs: number
  
  /** Intensidad del caos (0-1, afecta todo) */
  chaosIntensity: number
  
  /** 🌊 WAVE 1090: Tiempo de fade in (ms) */
  fadeInMs: number
  
  /** 🌊 WAVE 1090: Tiempo de fade out (ms) */
  fadeOutMs: number
}

const DEFAULT_CONFIG: GlitchGuaguancoConfig = {
  durationMs: 1400,         // 🌊 WAVE 1010.8: Bajado de 2200 → 1400 (más flow, menos orgasmo)
  baseGlitchHz: 10,         // 🌊 WAVE 1010.8: Bajado de 15 → 10 Hz (más suave, menos epiléptico)
  frequencyJitter: 0.4,     // 🌊 WAVE 1010.8: Bajado de 0.6 → 0.4 (menos caótico, más groove)
  freezeProbability: 0.08,  // 🌊 WAVE 1010.8: Bajado de 0.15 → 0.08 (menos freezes)
  freezeDurationMs: 100,    // 🌊 WAVE 1010.8: Bajado de 150 → 100ms (freezes más cortos)
  chaosIntensity: 0.7,      // 🌊 WAVE 1010.8: Bajado de 0.9 → 0.7 (más flow, menos locura)
  fadeInMs: 200,            // 🌊 WAVE 1090: Entrada suave (latino)
  fadeOutMs: 600,           // 🌊 WAVE 1090: Salida latina (más flow)
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 PALETA TÓXICA DIGITAL
// ═══════════════════════════════════════════════════════════════════════════

const TOXIC_PALETTE = {
  // Lima Radiactiva - El virus principal
  LIMA_TOXIC: { h: 120, s: 100, l: 50 },
  
  // Magenta Digital - La infección
  MAGENTA_VIRUS: { h: 320, s: 100, l: 50 },
  
  // Cyan Glitch - Error de matriz
  CYAN_ERROR: { h: 180, s: 100, l: 50 },
  
  // Blanco Corrupto - Noise
  WHITE_NOISE: { h: 0, s: 0, l: 100 },
  
  // Negro Muerto - Freeze
  BLACK_FREEZE: { h: 0, s: 0, l: 0 },
}

const TOXIC_COLORS = [
  TOXIC_PALETTE.LIMA_TOXIC,
  TOXIC_PALETTE.MAGENTA_VIRUS,
  TOXIC_PALETTE.CYAN_ERROR,
  TOXIC_PALETTE.WHITE_NOISE,
]

// ═══════════════════════════════════════════════════════════════════════════
// 🎲 DETERMINISTIC CHAOS ENGINE
// 
// 🚨 AXIOMA ANTI-SIMULACIÓN: No usamos Math.random()
// Usamos un LCG (Linear Congruential Generator) con seed determinista
// basado en el timestamp del trigger. REPRODUCIBLE y TESTEABLE.
// ═══════════════════════════════════════════════════════════════════════════

class DeterministicChaos {
  private seed: number
  private state: number
  
  // LCG parameters (Numerical Recipes)
  private readonly A = 1664525
  private readonly C = 1013904223
  private readonly M = 2 ** 32
  
  constructor(seed: number) {
    this.seed = seed
    this.state = seed
  }
  
  /** 
   * Genera el siguiente número pseudo-aleatorio (0-1) 
   * DETERMINISTA: Mismo seed → misma secuencia
   */
  next(): number {
    this.state = (this.A * this.state + this.C) % this.M
    return this.state / this.M
  }
  
  /** Genera entero en rango [min, max] */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min
  }
  
  /** Genera float en rango [min, max] */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min
  }
  
  /** ¿Evento con probabilidad p ocurre? */
  chance(p: number): boolean {
    return this.next() < p
  }
  
  /** Reset al seed original */
  reset(): void {
    this.state = this.seed
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🦠 GLITCH GUAGUANCÓ CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class GlitchGuaguanco extends BaseEffect {
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect properties
  // ─────────────────────────────────────────────────────────────────────────
  
  readonly effectType = 'glitch_guaguanco'
  readonly name = 'Glitch Guaguancó'
  readonly category: EffectCategory = 'physical'
  readonly priority = 88  // Alta pero menor que LatinaMeltdown
  readonly mixBus = 'global' as const  // 🚂 Dictador (necesita control total para glitches)
  
  // ─────────────────────────────────────────────────────────────────────────
  // Internal state
  // ─────────────────────────────────────────────────────────────────────────
  
  private config: GlitchGuaguancoConfig
  private chaos!: DeterministicChaos
  
  // Estado del glitch actual
  private glitchState: 'flicker' | 'freeze' | 'normal' = 'normal'
  private glitchTimer = 0
  private nextGlitchAt = 0  // ms hasta próximo glitch
  private freezeEndAt = 0   // ms cuando termina freeze
  
  // Color actual (cambia con cada glitch)
  private currentColorIndex = 0
  private currentDimmer = 0.5
  
  // ─────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────
  
  constructor(config?: Partial<GlitchGuaguancoConfig>) {
    super('glitch_guaguanco')
    this.config = { ...DEFAULT_CONFIG, ...config }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect implementation
  // ─────────────────────────────────────────────────────────────────────────
  
  trigger(config: EffectTriggerConfig): void {
    super.trigger(config)
    
    // GLOBAL - Infecta TODO el escenario
    this.zones = ['front', 'back', 'all-movers']
    
    // Crear chaos engine con seed del timestamp
    // 🚨 DETERMINISTA: Si se triggerea al mismo ms, produce misma secuencia
    const seed = Date.now() % 1000000  // Usar últimos 6 dígitos para seed
    this.chaos = new DeterministicChaos(seed)
    
    // Reset state
    this.glitchState = 'normal'
    this.glitchTimer = 0
    this.currentColorIndex = 0
    this.currentDimmer = 0.5
    
    // Primer glitch viene rápido
    this.scheduleNextGlitch()
    
    console.log(`[GlitchGuaguanco 🦠] VIRUS DEPLOYED! Seed=${seed} Duration=${this.config.durationMs}ms`)
    console.log(`[GlitchGuaguanco 🦠] DNA: A=0.60 C=0.90 O=0.10 (MEDIO/CAOS/DIGITAL)`)
  }
  
  private scheduleNextGlitch(): void {
    const basePeriodMs = 1000 / this.config.baseGlitchHz
    const jitter = this.chaos.nextFloat(
      1 - this.config.frequencyJitter,
      1 + this.config.frequencyJitter
    )
    this.nextGlitchAt = this.elapsedMs + (basePeriodMs * jitter)
  }
  
  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    
    this.elapsedMs += deltaMs
    this.glitchTimer += deltaMs
    
    // Verificar fin del efecto
    if (this.elapsedMs >= this.config.durationMs) {
      this.phase = 'finished'
      console.log(`[GlitchGuaguanco 🦠] VIRUS CONTAINED - System recovering`)
      return
    }
    
    // State machine del virus
    this.updateGlitchState()
  }
  
  private updateGlitchState(): void {
    // Si estamos en freeze, esperar a que termine
    if (this.glitchState === 'freeze') {
      if (this.elapsedMs >= this.freezeEndAt) {
        this.glitchState = 'normal'
        this.scheduleNextGlitch()
      }
      return
    }
    
    // ¿Es momento de glitch?
    if (this.elapsedMs >= this.nextGlitchAt) {
      this.executeGlitch()
    }
  }
  
  private executeGlitch(): void {
    // ¿Freeze o flicker?
    if (this.chaos.chance(this.config.freezeProbability)) {
      // FREEZE: Todo se congela
      this.glitchState = 'freeze'
      this.freezeEndAt = this.elapsedMs + this.config.freezeDurationMs
      this.currentDimmer = 0  // Negro total durante freeze
      // No schedule next - lo hacemos cuando termine freeze
    } else {
      // FLICKER: Cambio rápido de color/dimmer
      this.glitchState = 'flicker'
      
      // Cambiar color (rotar con algo de randomness)
      const jump = this.chaos.nextInt(1, 3)  // Saltar 1-3 colores
      this.currentColorIndex = (this.currentColorIndex + jump) % TOXIC_COLORS.length
      
      // Dimmer caótico
      this.currentDimmer = this.chaos.nextFloat(
        0.3,
        1.0 * this.config.chaosIntensity
      )
      
      // Siguiente glitch
      this.scheduleNextGlitch()
    }
  }
  
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null
    
    const elapsed = this.elapsedMs
    const duration = this.config.durationMs
    
    // 🌊 WAVE 1090: FLUID DYNAMICS (Latino - suave)
    let fadeOpacity = 1.0
    const fadeOutStart = duration - this.config.fadeOutMs
    if (this.config.fadeInMs > 0 && elapsed < this.config.fadeInMs) {
      fadeOpacity = (elapsed / this.config.fadeInMs) ** 1.5
    } else if (this.config.fadeOutMs > 0 && elapsed > fadeOutStart) {
      fadeOpacity = ((duration - elapsed) / this.config.fadeOutMs) ** 1.5
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🦠 VIRUS OUTPUT
    // ═══════════════════════════════════════════════════════════════════════
    
    const color = this.glitchState === 'freeze' 
      ? TOXIC_PALETTE.BLACK_FREEZE 
      : TOXIC_COLORS[this.currentColorIndex]
    
    const dimmer = this.glitchState === 'freeze' 
      ? 0 
      : this.currentDimmer
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🌊 WAVE 1010.8: MOVER SAFETY - Un solo color fijo (MAGENTA)
    // Los glitches rápidos + cambios de color = riesgo en Color Wheel DMX
    // PARs/Wash pueden tener glitch multicolor, movers SOLO MAGENTA fijo
    // ═══════════════════════════════════════════════════════════════════════
    
    const zoneOverrides: EffectFrameOutput['zoneOverrides'] = {
      movers: {
        color: TOXIC_PALETTE.MAGENTA_VIRUS,  // MAGENTA fijo - virus digital
        dimmer: dimmer,
        blendMode: 'replace',
      }
    }
    
    return {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress: elapsed / duration,
      zones: this.zones,
      intensity: dimmer,
      
      dimmerOverride: dimmer,
      colorOverride: color,  // PARs/Wash mantienen glitch multicolor
      
      zoneOverrides,  // 🌊 WAVE 1010.8: Movers con MAGENTA fijo
      
      // Strobe micro-flicker durante glitch activo (no en freeze)
      strobeRate: this.glitchState === 'flicker' ? 12 : undefined,
      
      globalComposition: fadeOpacity,  // 🌊 WAVE 1090: FLUID DYNAMICS
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Getters
  // ─────────────────────────────────────────────────────────────────────────
  
  getDurationMs(): number {
    return this.config.durationMs
  }
  
  getGlitchState(): string {
    return this.glitchState
  }
  
  getCurrentColor(): { h: number; s: number; l: number } {
    return TOXIC_COLORS[this.currentColorIndex]
  }
}

export default GlitchGuaguanco
