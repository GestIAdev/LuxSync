/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ BINARY GLITCH - CÓDIGO MORSE CORRUPTO
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🔪 WAVE 986: ACTIVE REINFORCEMENTS
 * Reemplazo de static_pulse. "Crush & Contrast" - Nada de líquidos. Golpes secos.
 * 
 * FILOSOFÍA:
 * Error de sistema intencional. Tartamudeo de código binario.
 * 0% o 100%. Sin fades. Sin respiración. La máquina FALLA con estilo.
 * 
 * ZONA TARGET: ACTIVE (E=0.45-0.65)
 * Para momentos de ritmo constante que necesitan textura tech.
 * 
 * COMPORTAMIENTO:
 * - MixBus: 'global' (OVERRIDE - reemplaza física durante el efecto)
 * - Pattern: ON/OFF pseudo-aleatorio pero DETERMINISTA
 * - Duración: 1200ms total
 * - Flashes: 0% → 100% → 0% (sin fades, digital puro)
 * - Color: BLANCO FRÍO / CIAN PÁLIDO (tecnología)
 * 
 * ⚠️ AXIOMA ANTI-SIMULACIÓN:
 * Usamos pattern PREDETERMINADO, no Math.random()
 * Secuencia binaria derivada del trigger time
 * 
 * ADN:
 * - Aggression: 0.60 (Golpe seco digital)
 * - Chaos: 0.85 (Alto - impredecible)
 * - Organicity: 0.00 (100% máquina)
 * 
 * THE MOVER LAW: Este efecto es SHORT (1200ms < 2000ms)
 * → PUEDE usar color en movers (exento de MODO FANTASMA)
 * 
 * @module core/effects/library/techno/BinaryGlitch
 * @version WAVE 986 - ACTIVE REINFORCEMENTS
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

interface BinaryGlitchConfig {
  /** Duración total del efecto (ms) */
  durationMs: number
}

const DEFAULT_CONFIG: BinaryGlitchConfig = {
  durationMs: 1200,          // 1.2 segundos - SHORT (< 2s)
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔢 BINARY PATTERNS - CÓDIGO MORSE DETERMINISTA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🔢 PATRONES BINARIOS PREDEFINIDOS
 * 
 * Cada pattern es una secuencia de duraciones (ms) + estado (ON/OFF)
 * El primer elemento siempre es OFF (blackout inicial)
 * 
 * AXIOMA ANTI-SIMULACIÓN: NO Math.random(), patrón seleccionado por trigger timestamp
 */
const BINARY_PATTERNS: Array<Array<{duration: number, on: boolean}>> = [
  // Pattern 0: "SOS" corrupto
  [
    { duration: 50, on: false },
    { duration: 60, on: true },
    { duration: 40, on: false },
    { duration: 60, on: true },
    { duration: 40, on: false },
    { duration: 60, on: true },
    { duration: 120, on: false },
    { duration: 100, on: true },
    { duration: 60, on: false },
    { duration: 100, on: true },
    { duration: 60, on: false },
    { duration: 100, on: true },
    { duration: 120, on: false },
    { duration: 60, on: true },
    { duration: 40, on: false },
    { duration: 60, on: true },
    { duration: 40, on: false },
    { duration: 60, on: true },
  ],
  
  // Pattern 1: "Stutter" (tartamudeo)
  [
    { duration: 80, on: false },
    { duration: 40, on: true },
    { duration: 30, on: false },
    { duration: 40, on: true },
    { duration: 30, on: false },
    { duration: 40, on: true },
    { duration: 150, on: false },
    { duration: 80, on: true },
    { duration: 50, on: false },
    { duration: 40, on: true },
    { duration: 30, on: false },
    { duration: 40, on: true },
    { duration: 200, on: false },
    { duration: 120, on: true },
    { duration: 50, on: false },
    { duration: 120, on: true },
  ],
  
  // Pattern 2: "Heartbeat muerto" (flatline con picos)
  [
    { duration: 200, on: false },
    { duration: 50, on: true },
    { duration: 100, on: false },
    { duration: 50, on: true },
    { duration: 300, on: false },
    { duration: 50, on: true },
    { duration: 100, on: false },
    { duration: 50, on: true },
    { duration: 300, on: false },
  ],
  
  // Pattern 3: "Código binario" (data transmission)
  [
    { duration: 50, on: false },
    { duration: 80, on: true },
    { duration: 80, on: false },
    { duration: 80, on: true },
    { duration: 40, on: false },
    { duration: 40, on: true },
    { duration: 80, on: false },
    { duration: 40, on: true },
    { duration: 40, on: false },
    { duration: 80, on: true },
    { duration: 80, on: false },
    { duration: 40, on: true },
    { duration: 40, on: false },
    { duration: 80, on: true },
    { duration: 120, on: false },
    { duration: 120, on: true },
    { duration: 50, on: false },
  ],
  
  // Pattern 4: "Glitch agresivo" (más ON que OFF)
  [
    { duration: 30, on: false },
    { duration: 100, on: true },
    { duration: 20, on: false },
    { duration: 80, on: true },
    { duration: 20, on: false },
    { duration: 120, on: true },
    { duration: 30, on: false },
    { duration: 60, on: true },
    { duration: 20, on: false },
    { duration: 100, on: true },
    { duration: 50, on: false },
    { duration: 150, on: true },
    { duration: 30, on: false },
    { duration: 80, on: true },
    { duration: 30, on: false },
    { duration: 150, on: true },
    { duration: 80, on: false },
  ],
]

// Colores: BLANCO FRÍO y CIAN PÁLIDO (HSL)
const COLORS = {
  coldWhite: { h: 200, s: 10, l: 95 },     // Blanco frío casi puro
  paleCyan:  { h: 190, s: 40, l: 85 },     // Cian pálido tecnológico
}

// Zonas para el efecto
const GLITCH_ZONES: EffectZone[] = ['front', 'pars', 'back', 'movers']

// ═══════════════════════════════════════════════════════════════════════════
// ⚡ BINARY GLITCH CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class BinaryGlitch extends BaseEffect {
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect properties
  // ─────────────────────────────────────────────────────────────────────────
  
  readonly effectType = 'binary_glitch'
  readonly name = 'Binary Glitch'
  readonly category: EffectCategory = 'physical'
  readonly priority = 72  // Entre atmospheric (60-70) y aggressive (85-95)
  readonly mixBus = 'global' as const  // 🎯 OVERRIDE física
  
  // ─────────────────────────────────────────────────────────────────────────
  // Internal state
  // ─────────────────────────────────────────────────────────────────────────
  
  private config: BinaryGlitchConfig = DEFAULT_CONFIG
  private selectedPattern: Array<{duration: number, on: boolean}> = BINARY_PATTERNS[0]
  private useAlternateColor: boolean = false
  private triggerTimestamp: number = 0
  
  // ─────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────
  
  constructor() {
    super('binary_glitch')
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Trigger: Seleccionar patrón basado en timestamp (DETERMINISTA)
   */
  trigger(config: EffectTriggerConfig): void {
    // Parent trigger (sets phase, elapsedMs, triggerIntensity, zones, source, musicalContext)
    super.trigger(config)
    
    this.triggerTimestamp = Date.now()
    
    // 🔢 SELECCIÓN DETERMINISTA DE PATRÓN
    // Usa timestamp para elegir patrón → cada trigger diferente = patrón diferente
    // Pero mismo timestamp = mismo patrón (DETERMINISTA)
    const patternIndex = this.triggerTimestamp % BINARY_PATTERNS.length
    this.selectedPattern = BINARY_PATTERNS[patternIndex]
    
    // Color alternativo basado en segundo del trigger
    const triggerSecond = Math.floor(this.triggerTimestamp / 1000)
    this.useAlternateColor = triggerSecond % 2 === 0
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Update loop
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Update: Avanza tiempo del efecto
   */
  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    
    this.elapsedMs += deltaMs
    
    // ¿Terminado?
    if (this.elapsedMs >= this.config.durationMs) {
      this.phase = 'finished'
      return
    }
  }
  
  /**
   * GetOutput: Genera frame según patrón binario
   */
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null
    
    const elapsed = this.elapsedMs
    const duration = this.config.durationMs
    const progress = Math.min(elapsed / duration, 1)
    
    // 🔢 DETERMINAR ESTADO ON/OFF SEGÚN PATRÓN
    const isOn = this.getPatternState(elapsed)
    
    // Si OFF → blackout total
    if (!isOn) {
      return {
        effectId: this.id,
        category: this.category,
        phase: this.phase,
        progress,
        zones: GLITCH_ZONES,
        intensity: 0,
        dimmerOverride: 0,
        globalOverride: true,  // 🎯 OVERRIDE total
        zoneOverrides: this.buildBlackoutOverrides(),
      }
    }
    
    // Si ON → flash al 100%
    const color = this.useAlternateColor ? COLORS.paleCyan : COLORS.coldWhite
    
    return {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      zones: GLITCH_ZONES,
      intensity: 1.0,
      dimmerOverride: 1.0,  // 100% - digital, sin fades
      colorOverride: color,
      globalOverride: true,  // 🎯 OVERRIDE total
      zoneOverrides: this.buildFlashOverrides(color),
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Pattern state determination
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 🔢 Determina si estamos en estado ON u OFF según el patrón
   * DETERMINISTA - mismo elapsed = mismo estado
   */
  private getPatternState(elapsed: number): boolean {
    let accumulatedTime = 0
    
    for (const segment of this.selectedPattern) {
      accumulatedTime += segment.duration
      if (elapsed < accumulatedTime) {
        return segment.on
      }
    }
    
    // Si superamos el patrón, loop desde el inicio
    const patternDuration = this.selectedPattern.reduce((sum, s) => sum + s.duration, 0)
    const loopedElapsed = elapsed % patternDuration
    
    // Recursión con elapsed normalizado
    accumulatedTime = 0
    for (const segment of this.selectedPattern) {
      accumulatedTime += segment.duration
      if (loopedElapsed < accumulatedTime) {
        return segment.on
      }
    }
    
    return false  // Fallback
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Zone overrides builders
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 🖤 Blackout overrides para estado OFF
   */
  private buildBlackoutOverrides(): Record<string, { dimmer: number }> {
    const overrides: Record<string, { dimmer: number }> = {}
    
    for (const zone of GLITCH_ZONES) {
      overrides[zone] = {
        dimmer: 0,
      }
    }
    
    return overrides
  }
  
  /**
   * ⚡ Flash overrides para estado ON
   * WAVE 986: SHORT EFFECT → Puede usar color en movers (exento de THE MOVER LAW)
   */
  private buildFlashOverrides(color: { h: number; s: number; l: number }): Record<string, { color: { h: number; s: number; l: number }; dimmer: number }> {
    const overrides: Record<string, { color: { h: number; s: number; l: number }; dimmer: number }> = {}
    
    for (const zone of GLITCH_ZONES) {
      overrides[zone] = {
        color,
        dimmer: 1.0,
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
      elapsedMs: this.elapsedMs,
      durationMs: this.config.durationMs,
      patternIndex: BINARY_PATTERNS.indexOf(this.selectedPattern),
      currentState: this.getPatternState(this.elapsedMs) ? 'ON' : 'OFF',
      useAlternateColor: this.useAlternateColor,
    }
  }
}

// Default export para compatibilidad
export default BinaryGlitch
