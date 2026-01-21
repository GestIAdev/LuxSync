/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ STATIC PULSE - PULSO ESTÁTICO
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🔬 WAVE 938: ATMOSPHERIC ARSENAL (PunkOpus)
 * 
 * FILOSOFÍA:
 * Interferencia electromagnética - glitch sutil y tenso.
 * Flashes cortos asíncronos entre fixtures, como si hubiera fallas eléctricas.
 * Perfecto para tensión en transiciones.
 * 
 * COMPORTAMIENTO:
 * - MixBus: 'htp' (ADITIVO - suma con física)
 * - Pars: Flash muy corto (50ms) cada 2-4 beats, intensidad 0.3-0.5
 * - Posiciones aleatorias: No todos los pars disparan juntos
 * - Movers: NO se mueven (frozen) o micro-movimientos (±5°)
 * - Probabilidad 30% por beat → Asíncrono entre fixtures
 * 
 * COLORES:
 * - WHITE con tinte COLD BLUE (#e0f0ff)
 * - Simula luz fluorescente fallando
 * 
 * ZONAS:
 * - Perfecto para ambient, gentle (transiciones tensas)
 * - Ideal para crear incomodidad sutil antes de eventos grandes
 * 
 * @module core/effects/library/techno/StaticPulse
 * @version WAVE 938 - ATMOSPHERIC ARSENAL (PunkOpus)
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

interface StaticPulseConfig {
  /** Duración total del efecto (ms) */
  durationMs: number
  
  /** Duración de cada flash (ms) */
  flashDurationMs: number
  
  /** Intervalo MÍNIMO entre flashes (ms) */
  minIntervalMs: number
  
  /** Intervalo MÁXIMO entre flashes (ms) */
  maxIntervalMs: number
  
  /** Intensidad de los flashes */
  flashIntensity: number
  
  /** Probabilidad de flash por fixture cuando toca (0-1) */
  flashProbability: number
  
  /** ¿BPM-synced? */
  bpmSync: boolean
  
  /** Beats mínimos entre flashes (si bpmSync=true) */
  minBeatsInterval: number
  
  /** Beats máximos entre flashes (si bpmSync=true) */
  maxBeatsInterval: number
}

const DEFAULT_CONFIG: StaticPulseConfig = {
  durationMs: 6000,          // 6 segundos
  flashDurationMs: 50,       // Flash muy corto (50ms)
  minIntervalMs: 500,        // Mínimo 0.5s entre flashes
  maxIntervalMs: 1200,       // Máximo 1.2s entre flashes
  flashIntensity: 0.4,       // Intensidad media
  flashProbability: 0.3,     // 30% chance por fixture
  bpmSync: true,
  minBeatsInterval: 2,       // Mínimo 2 beats
  maxBeatsInterval: 4,       // Máximo 4 beats
}

// ═══════════════════════════════════════════════════════════════════════════
// STATIC PULSE EFFECT
// ═══════════════════════════════════════════════════════════════════════════

export class StaticPulse extends BaseEffect {
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect properties
  // ─────────────────────────────────────────────────────────────────────────
  
  readonly effectType = 'static_pulse'
  readonly name = 'Static Pulse'
  readonly category: EffectCategory = 'physical'  // Afecta dimmer
  readonly priority = 50  // Media - efecto de tensión
  readonly mixBus = 'htp' as const  // ADITIVO - suma con física
  
  // ─────────────────────────────────────────────────────────────────────────
  // Internal state
  // ─────────────────────────────────────────────────────────────────────────
  
  private config: StaticPulseConfig
  private nextFlashTime: number = 0
  private flashEndTime: number = 0
  private isFlashing: boolean = false
  
  // Qué fixtures están flashing en el frame actual
  private activeFlashZones: Set<EffectZone> = new Set()
  
  // Mover positions (frozen o micro-movimiento)
  private moverPan: number = 0
  private moverTilt: number = 0
  
  // ─────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────
  
  constructor(config?: Partial<StaticPulseConfig>) {
    super('static_pulse')
    this.config = { ...DEFAULT_CONFIG, ...config }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect implementation
  // ─────────────────────────────────────────────────────────────────────────
  
  trigger(triggerConfig: EffectTriggerConfig): void {
    super.trigger(triggerConfig)
    
    this.nextFlashTime = this.getRandomInterval()
    this.flashEndTime = 0
    this.isFlashing = false
    this.activeFlashZones.clear()
    
    // Movers random position (frozen)
    this.moverPan = Math.random() * 360 - 180
    this.moverTilt = Math.random() * 40 - 20
    
    console.log(`[StaticPulse ⚡] TRIGGERED! Duration=${this.config.durationMs}ms FlashInterval=${this.config.minIntervalMs}-${this.config.maxIntervalMs}ms`)
  }
  
  private getRandomInterval(): number {
    if (this.config.bpmSync && this.musicalContext?.bpm) {
      const msPerBeat = 60000 / this.musicalContext.bpm
      const beatsInterval = this.config.minBeatsInterval + 
        Math.random() * (this.config.maxBeatsInterval - this.config.minBeatsInterval)
      return beatsInterval * msPerBeat
    } else {
      return this.config.minIntervalMs + 
        Math.random() * (this.config.maxIntervalMs - this.config.minIntervalMs)
    }
  }

  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    
    this.elapsedMs += deltaMs
    
    // ═════════════════════════════════════════════════════════════════════
    // FLASH STATE MACHINE
    // ═════════════════════════════════════════════════════════════════════
    
    if (!this.isFlashing && this.elapsedMs >= this.nextFlashTime) {
      // TRIGGER FLASH
      this.isFlashing = true
      this.flashEndTime = this.elapsedMs + this.config.flashDurationMs
      
      // Decidir qué zones flashean (probabilistic)
      this.activeFlashZones.clear()
      const zones: EffectZone[] = ['front', 'pars', 'back']
      zones.forEach(zone => {
        if (Math.random() < this.config.flashProbability) {
          this.activeFlashZones.add(zone)
        }
      })
      
      // Micro-movimiento de movers (glitch)
      this.moverPan += (Math.random() - 0.5) * 10  // ±5°
      this.moverTilt += (Math.random() - 0.5) * 10 // ±5°
    }
    
    if (this.isFlashing && this.elapsedMs >= this.flashEndTime) {
      // END FLASH
      this.isFlashing = false
      this.activeFlashZones.clear()
      
      // Programar próximo flash
      this.nextFlashTime = this.elapsedMs + this.getRandomInterval()
    }
    
    // Check si terminó
    if (this.elapsedMs >= this.config.durationMs) {
      this.phase = 'finished'
      console.log(`[StaticPulse ⚡] FINISHED (${this.config.durationMs}ms)`)
    }
  }
  
  /**
   * 📤 GET OUTPUT - Devuelve el output del frame actual
   * ⚡ WAVE 938: STATIC PULSE - Glitch asíncrono
   */
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null
    
    // Si no estamos flashing, no emitimos nada (silencio)
    if (!this.isFlashing || this.activeFlashZones.size === 0) {
      return null
    }

    const progress = this.elapsedMs / this.config.durationMs

    const output: EffectFrameOutput = {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      zones: Array.from(this.activeFlashZones) as EffectZone[],
      intensity: this.triggerIntensity * this.config.flashIntensity,
      zoneOverrides: {},
    }

    // ═════════════════════════════════════════════════════════════════════
    // COLOR: WHITE con tinte COLD BLUE
    // ═════════════════════════════════════════════════════════════════════
    const color = { h: 200, s: 20, l: 95 } // Blanco azulado

    // ═════════════════════════════════════════════════════════════════════
    // PARS: Flash en zones activas
    // ═════════════════════════════════════════════════════════════════════
    this.activeFlashZones.forEach(zone => {
      if (zone !== 'movers') {
        output.zoneOverrides![zone] = {
          dimmer: this.config.flashIntensity,
          color,
          blendMode: 'max' as const,
        }
      }
    })

    // ═════════════════════════════════════════════════════════════════════
    // MOVERS: Frozen con micro-glitch
    // ═════════════════════════════════════════════════════════════════════
    output.zoneOverrides!['movers'] = {
      dimmer: 0.1, // Muy bajo - solo outline
      color,
      blendMode: 'max' as const,
      movement: {
        pan: this.moverPan,
        tilt: this.moverTilt,
      },
    }

    return output
  }
  
  isFinished(): boolean {
    return this.phase === 'finished'
  }
  
  abort(): void {
    this.phase = 'finished'
    this.isFlashing = false
    this.activeFlashZones.clear()
    console.log(`[StaticPulse ⚡] Aborted`)
  }
}
