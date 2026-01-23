/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🤖 CYBER DUALISM - THE PING-PONG TWINS
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🤖 WAVE 810: THE TWINS AWAKENING
 * � WAVE 990: RAILWAY SWITCH - VÍA GLOBAL (Dictador)
 * 
 * FILOSOFÍA:
 * El primer efecto que explota la dualidad espacial L/R de los movers.
 * Ping-pong visual: LEFT strobe → RIGHT strobe → repeat.
 * 
 * COMPORTAMIENTO:
 * - MixBus: 'global' (WAVE 990: DICTADOR - Arregla sangrado de fondo)
 * - Patrón: Alternancia L/R sincronizada con beat
 * - Beat 1: LEFT=STROBE (Blanco) | RIGHT=DARK (NEGRO TOTAL)
 * - Beat 2: LEFT=DARK | RIGHT=STROBE (Blanco)
 * - Variante: LEFT=Cian | RIGHT=Magenta (chromatic mode)
 * 
 * COLORES:
 * - Strobe Mode: Blanco puro (h:0, s:0, l:100)
 * - Chromatic Mode: Cian (h:180, s:100, l:70) vs Magenta (h:300, s:100, l:70)
 * - Dark: Negro (dimmer=0) - AHORA CON GLOBAL ES NEGRO REAL
 * 
 * TARGETING:
 * - Usa 'movers_left' y 'movers_right' (WAVE 810)
 * - Sin targeting quirúrgico, aplastaría todo el rig
 * 
 * @module core/effects/library/techno/CyberDualism
 * @version WAVE 990 - RAILWAY SWITCH GLOBAL
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

interface CyberDualismConfig {
  /** Duración total del efecto (ms) */
  durationMs: number
  
  /** Número de alternaciones (ping-pong cycles) */
  cycles: number
  
  /** ¿BPM-synced? */
  bpmSync: boolean
  
  /** Beats por cycle (si bpmSync=true) */
  beatsPerCycle: number
  
  /** Modo cromático (cian/magenta) o strobe (blanco/negro) */
  chromaticMode: boolean
  
  /** Intensidad del strobe (0-1) */
  strobeIntensity: number
  
  /** Duración del flash en cada lado (ms) */
  flashDurationMs: number
}

const DEFAULT_CONFIG: CyberDualismConfig = {
  durationMs: 3000,           // 🔫 WAVE 930.4: 3s total (was 2s) - más presencia
  cycles: 6,                  // 🔫 WAVE 930.4: 6 alternaciones (was 4) - más impacto L→R→L→R→L→R
  bpmSync: true,
  beatsPerCycle: 0.5,         // Media beat por lado (rápido)
  chromaticMode: false,       // Default: strobe blanco/negro
  strobeIntensity: 1.0,       // 100% brightness
  flashDurationMs: 120,       // 🔫 WAVE 930.4: 120ms de flash (was 100ms) - más visible
}

// ═══════════════════════════════════════════════════════════════════════════
// 🤖 CYBER DUALISM CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class CyberDualism extends BaseEffect {
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect properties
  // ─────────────────────────────────────────────────────────────────────────
  
  readonly effectType = 'cyber_dualism'
  readonly name = 'Cyber Dualism'
  readonly category: EffectCategory = 'physical'
  readonly priority = 85  // Alta (mayor que acid_sweep, menor que industrial_strobe)
  readonly mixBus = 'global' as const  // 🚂 WAVE 990: GLOBAL - Arregla sangrado de fondo
  
  // ─────────────────────────────────────────────────────────────────────────
  // Internal state
  // ─────────────────────────────────────────────────────────────────────────
  
  private config: CyberDualismConfig
  private currentCycle = 0        // 0-based cycle counter
  private cyclePhase = 0          // 0-1 dentro del cycle actual
  private actualCycleDurationMs = 500
  private currentSide: 'left' | 'right' = 'left'
  private flashActive = false
  
  // Colors
  private leftColor: { h: number; s: number; l: number } = { h: 180, s: 100, l: 70 }  // Cian
  private rightColor: { h: number; s: number; l: number } = { h: 300, s: 100, l: 70 } // Magenta
  private strobeColor: { h: number; s: number; l: number } = { h: 0, s: 0, l: 100 }   // Blanco
  
  // ─────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────
  
  constructor(config?: Partial<CyberDualismConfig>) {
    super('cyber_dualism')
    this.config = { ...DEFAULT_CONFIG, ...config }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect implementation
  // ─────────────────────────────────────────────────────────────────────────
  
  trigger(config: EffectTriggerConfig): void {
    super.trigger(config)
    
    // Reset state
    this.currentCycle = 0
    this.cyclePhase = 0
    this.currentSide = 'left'
    this.flashActive = true
    this.triggerIntensity = config.intensity
    
    // Calcular duración basada en BPM
    this.calculateCycleDuration()
    
    console.log(`[CyberDualism 🤖] TRIGGERED! Cycles=${this.config.cycles} Duration=${this.actualCycleDurationMs}ms/cycle ChromaticMode=${this.config.chromaticMode}`)
  }
  
  private calculateCycleDuration(): void {
    if (this.config.bpmSync && this.musicalContext?.bpm) {
      const msPerBeat = 60000 / this.musicalContext.bpm
      this.actualCycleDurationMs = msPerBeat * this.config.beatsPerCycle
    } else {
      this.actualCycleDurationMs = this.config.durationMs / this.config.cycles
    }
  }
  
  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    
    this.elapsedMs += deltaMs
    
    // Update cycle phase
    this.cyclePhase += deltaMs / this.actualCycleDurationMs
    
    // Check if cycle completed
    if (this.cyclePhase >= 1) {
      this.currentCycle++
      this.cyclePhase = this.cyclePhase % 1
      
      // Alternar lado
      this.currentSide = this.currentSide === 'left' ? 'right' : 'left'
      this.flashActive = true
      
      // ¿Terminamos todos los cycles?
      if (this.currentCycle >= this.config.cycles) {
        this.phase = 'finished'
        console.log(`[CyberDualism 🤖] FINISHED (${this.currentCycle} cycles, ${this.elapsedMs}ms)`)
        return
      }
    }
    
    // Flash duration check (dentro de cada cycle)
    const cycleElapsed = this.cyclePhase * this.actualCycleDurationMs
    this.flashActive = cycleElapsed < this.config.flashDurationMs
  }
  
  /**
   * 📤 GET OUTPUT - Devuelve el output del frame actual
   * 🤖 WAVE 810: TARGETING L/R - El core del ping-pong
   * 🔦 WAVE 985: DIMMER LOCK - Blackout estricto en fase OFF
   */
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') {
      return null
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🔦 WAVE 985: DIMMER LOCK - NO MORE RETURN NULL
    // Incluso en fase DARK, emitimos override para aplastar el layer inferior
    // ═══════════════════════════════════════════════════════════════════════
    
    const intensity = this.flashActive 
      ? this.triggerIntensity * this.config.strobeIntensity
      : 0  // 🔦 EXPLÍCITO: dimmer=0 en fase dark
    
    // Determinar color según modo
    let color: { h: number; s: number; l: number }
    if (this.config.chromaticMode) {
      // Chromatic: cian o magenta según lado
      color = this.currentSide === 'left' ? this.leftColor : this.rightColor
    } else {
      // Strobe: blanco puro
      color = this.strobeColor
    }
    
    // 🔥 WAVE 810: TARGETING QUIRÚRGICO
    // Siempre afectamos AMBOS lados: uno ON, otro OFF
    const activeZone = this.currentSide === 'left' ? 'movers_left' : 'movers_right'
    const darkZone = this.currentSide === 'left' ? 'movers_right' : 'movers_left'
    
    const output: EffectFrameOutput = {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress: this.currentCycle / this.config.cycles,
      zones: ['movers_left', 'movers_right'],  // 🔦 AMBOS LADOS SIEMPRE
      intensity,
      
      // 🤖 Zone overrides con Dimmer Lock
      zoneOverrides: {
        // LADO ACTIVO: Strobe ON con COLOR BLANCO
        [activeZone]: {
          color,  // � WAVE 985: Forzar blanco (CyberDualism <1s = SAFE para ruedas)
          dimmer: intensity,
          blendMode: 'replace' as const,  // 🔦 WAVE 985: LTP = Override estricto
        },
        // LADO DARK: Blackout forzado
        [darkZone]: {
          dimmer: 0,  // 🔦 EXPLÍCITO: Negro absoluto
          blendMode: 'replace' as const,  // 🔦 APLASTA el layer inferior
        },
      },
    }
    
    return output
  }
  
  isFinished(): boolean {
    return this.phase === 'finished'
  }
  
  abort(): void {
    this.phase = 'finished'
    this.triggerIntensity = 0
    console.log(`[CyberDualism 🤖] Aborted`)
  }
  
  getPhase(): EffectPhase {
    return this.phase
  }
}
