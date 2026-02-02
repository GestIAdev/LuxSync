/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ BINARY GLITCH - CÓDIGO MORSE CORRUPTO
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🔪 WAVE 986: ACTIVE REINFORCEMENTS
 * Reemplazo de static_pulse. "Crush & Contrast" - Nada de líquidos. Golpes secos.
 * 
 * 🎯 WAVE 1003.14: GLITCH PATTERNS REBUILD - CAOS REAL (NO strobe regular)
 * 
 * FILOSOFÍA:
 * Error de sistema intencional. Tartamudeo de código binario.
 * 0% o 100%. Sin fades. Sin respiración. La máquina FALLA con estilo.
 * 
 * ❌ PROBLEMA (WAVE 1003.14):
 * - Patrones originales: 16-20 segmentos con duraciones uniformes (60-80ms)
 * - Resultado: Parecía IndustrialStrobe (strobe azul genérico)
 * - User feedback: "es igual que el industrial strobe"
 * 
 * ✅ SOLUCIÓN (WAVE 1003.14):
 * - Patrones CORTOS: 3-5 flashes máximo (NO 16-20 segmentos)
 * - Duraciones MICROMÉTRICAS: 12-35ms (NO 60-120ms uniformes)
 * - Timing NERVIOSO: Intervalos irregulares + silencios largos
 * - Resultado: GLITCH real (nervioso, caótico) vs Strobe (regular, rítmico)
 * 
 * ZONA TARGET: ACTIVE (E=0.45-0.65)
 * Para momentos de ritmo constante que necesitan textura tech.
 * 
 * COMPORTAMIENTO:
 * - MixBus: 'global' (OVERRIDE - reemplaza física durante el efecto)
 * - Pattern: ON/OFF pseudo-aleatorio pero DETERMINISTA
 * - Duración: 1200ms total
 * - Flashes: 0% → 100% → 0% (sin fades, digital puro)
 * - Color: AZUL ELÉCTRICO / CIAN INTENSO (WAVE 1003.11: saturados para contrastar)
 * - Pre-Blackout: 50ms ANTES de cada flash (WAVE 1003.12: contraste forzado)
 * 
 * ⚠️ AXIOMA ANTI-SIMULACIÓN:
 * Usamos pattern PREDETERMINADO, no Math.random()
 * Secuencia binaria derivada del trigger time
 * 
 * ADN:
 * - Aggression: 0.60 (Golpe seco digital)
 * - Chaos: 0.55 (WAVE 1003.10: 0.85→0.55 - caótico pero competitivo)
 * - Organicity: 0.00 (100% máquina)
 * 
 * WAVE 1003.11: Colores más saturados (electricBlue S100 L50, hotCyan S85 L55)
 * Antes: coldWhite S10 L95, paleCyan S40 L85 (invisibles en minimal techno blanco)
 * 
 * WAVE 1003.12: Pre-blackout de 50ms antes de cada flash
 * Fuerza contraste para que los flashes sean visibles incluso en ambiente blanco
 * 
 * WAVE 1003.14: Patrones rebuild - GLITCH real (micrométrico, nervioso, caótico)
 * Antes: 16-20 segmentos uniformes → Strobe azul genérico
 * Ahora: 3-5 flashes micros + silencios → GLITCH de verdad
 * 
 * THE MOVER LAW: Este efecto es SHORT (1200ms < 2000ms)
 * → PUEDE usar color en movers (exento de MODO FANTASMA)
 * 
 * @module core/effects/library/techno/BinaryGlitch
 * @version WAVE 1003.14 - GLITCH PATTERNS REBUILD
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
  durationMs: 2000,          // 1.2 segundos - SHORT (< 2s)
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
// 🎯 WAVE 1003.14: GLITCH PATTERNS - NERVIOSO Y CAÓTICO (NO strobe regular)
// FILOSOFÍA: Duraciones MICROMÉTRICAS (10-35ms), patrones CORTOS (3-5 flashes)
// ANTI-PATRÓN: NO strobes uniformes de 60-80ms → eso es IndustrialStrobe
const BINARY_PATTERNS: Array<Array<{duration: number, on: boolean}>> = [
  // Pattern 0: "Double Tap" - 2 golpes rápidos + silencio
  [
    { duration: 80, on: false },
    { duration: 18, on: true },   // Flash micrométrico
    { duration: 25, on: false },
    { duration: 22, on: true },   // Flash micrométrico
    { duration: 955, on: false }, // Silencio largo (resto hasta 1200ms)
  ],
  
  // Pattern 1: "Nervous Stutter" - 3 flashes nerviosos
  [
    { duration: 120, on: false },
    { duration: 15, on: true },
    { duration: 20, on: false },
    { duration: 12, on: true },
    { duration: 30, on: false },
    { duration: 18, on: true },
    { duration: 985, on: false },
  ],
  
  // Pattern 2: "Triple Glitch" - 3 golpes irregulares
  [
    { duration: 60, on: false },
    { duration: 20, on: true },
    { duration: 45, on: false },
    { duration: 14, on: true },
    { duration: 35, on: false },
    { duration: 26, on: true },
    { duration: 1000, on: false },
  ],
  
  // Pattern 3: "Chaotic Burst" - Ráfaga caótica (4 flashes)
  [
    { duration: 100, on: false },
    { duration: 12, on: true },
    { duration: 18, on: false },
    { duration: 16, on: true },
    { duration: 22, on: false },
    { duration: 14, on: true },
    { duration: 28, on: false },
    { duration: 20, on: true },
    { duration: 970, on: false },
  ],
  
  // Pattern 4: "Single Spike" - 1 golpe brutal + silencio
  [
    { duration: 150, on: false },
    { duration: 35, on: true },   // Flash más largo (brutal)
    { duration: 1015, on: false },
  ],
]

// Colores: AZUL ELÉCTRICO y CIAN INTENSO (HSL) - WAVE 1003.11: Mayor saturación
// Antes: coldWhite (h200 s10 l95) y paleCyan (h190 s40 l85) - demasiado pálidos
// Ahora: Colores saturados que contrasten con luz ambiente blanca de minimal techno
const COLORS = {
  electricBlue: { h: 200, s: 100, l: 50 },  // 🔧 Azul eléctrico intenso (visible en blanco)
  hotCyan:      { h: 180, s: 85, l: 55 },   // 🔧 Cian caliente saturado (contraste alto)
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
    
    // 🔥 WAVE 998.1: CYAN FRÍO SIEMPRE
    // ❌ ANTES: Alternaba cyan/blanco cálido (triggerSecond % 2)
    // ✅ AHORA: Siempre CYAN FRÍO (pale cyan, techno glacial)
    this.useAlternateColor = true  // TRUE = paleCyan, FALSE = coldWhite
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
        globalComposition: 1.0,  // � WAVE 1080: Override total
        zoneOverrides: this.buildBlackoutOverrides(),
      }
    }
    
    // Si ON → flash al 100% con colores saturados (WAVE 1003.11)
    const color = this.useAlternateColor ? COLORS.hotCyan : COLORS.electricBlue
    
    return {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      zones: GLITCH_ZONES,
      intensity: 1.0,
      dimmerOverride: 1.0,  // 100% - digital, sin fades
      colorOverride: color,
      globalComposition: 1.0,  // � WAVE 1080: Override total
      zoneOverrides: this.buildFlashOverrides(color),
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Pattern state determination
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 🔢 Determina si estamos en estado ON u OFF según el patrón
   * DETERMINISTA - mismo elapsed = mismo estado
   * 
   * 🔧 WAVE 1003.12: PRE-BLACKOUT de 50ms antes de cada flash ON
   * Añade contraste forzado para que los flashes sean visibles
   */
  private getPatternState(elapsed: number): boolean {
    const PRE_BLACKOUT_MS = 50  // 🔧 Blackout previo a cada flash
    
    let accumulatedTime = 0
    let previousSegmentWasOff = true  // Primer segmento siempre es OFF
    
    for (let i = 0; i < this.selectedPattern.length; i++) {
      const segment = this.selectedPattern[i]
      const segmentStart = accumulatedTime
      const segmentEnd = accumulatedTime + segment.duration
      
      // Si este segmento está ON y el anterior era OFF → añadir pre-blackout
      if (segment.on && previousSegmentWasOff) {
        // Los últimos 50ms del segmento OFF anterior son pre-blackout
        const blackoutStart = segmentStart - PRE_BLACKOUT_MS
        const blackoutEnd = segmentStart
        
        if (elapsed >= blackoutStart && elapsed < blackoutEnd) {
          return false  // 🖤 Pre-blackout forzado
        }
      }
      
      // Check si estamos en este segmento
      if (elapsed < segmentEnd) {
        return segment.on
      }
      
      accumulatedTime = segmentEnd
      previousSegmentWasOff = !segment.on
    }
    
    // Si superamos el patrón, loop desde el inicio
    const patternDuration = this.selectedPattern.reduce((sum, s) => sum + s.duration, 0)
    const loopedElapsed = elapsed % patternDuration
    
    // Recursión con elapsed normalizado
    return this.getPatternState(loopedElapsed)
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
