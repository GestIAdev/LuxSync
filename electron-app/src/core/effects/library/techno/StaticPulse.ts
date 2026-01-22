/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ LASER CANDY - UV STABS (formerly Static Pulse)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🔬 WAVE 938: ATMOSPHERIC ARSENAL (PunkOpus)
 * 🎨 WAVE 976.9: COLOR REVAMP - "Laser Candy" (PunkOpus + Radwulf)
 * 
 * FILOSOFÍA:
 * Stabs de láser puro que perforan el ambiente techno frío.
 * Ya no son "fallos eléctricos" - son LÁSERES PSICODÉLICOS.
 * 
 * COMPORTAMIENTO:
 * - MixBus: 'global' (ADITIVO - punzadas de color sobre físicas)
 * - Pars: Flash muy corto (50ms) cada 2-4 beats, intensidad 0.4-0.7
 * - Posiciones aleatorias: No todos los pars disparan juntos
 * - Movers: Frozen o micro-movimientos (±5°)
 * - Probabilidad 30% por beat → Asíncrono entre fixtures
 * 
 * COLORES DINÁMICOS (según intensidad):
 * - Intensity < 0.5  → 🟣 UV VIOLETA (#9D00FF) - Sutil, misterioso, blacklight
 * - Intensity 0.5-0.8 → 🟢 VERDE LÁSER (#00FF00) - Clásico, potente, cyberpunk
 * - Intensity > 0.8  → 🔵 AZUL ELÉCTRICO (#0099FF) - Nuclear, high energy
 * 
 * ZONAS:
 * - Perfecto para ambient, gentle, valley (puntuaciones sutiles)
 * - En active/intense: Stabs potentes que cortan el ambiente
 * 
 * @module core/effects/library/techno/StaticPulse
 * @version WAVE 976.9 - LASER CANDY
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
  durationMs: 5000,          // 5 segundos (was 6s) - WAVE 964
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
  readonly priority = 70  // Media-alta - WAVE 964: Subida de 50 a 70
  readonly mixBus = 'global' as const  // WAVE 964: HTP→GLOBAL para visibilidad
  
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
    // 🎨 WAVE 976.9: LASER CANDY - Color dinámico según intensidad
    // ═════════════════════════════════════════════════════════════════════
    // Intensity < 0.5  → 🟣 UV VIOLETA (misterioso, sutil)
    // Intensity 0.5-0.8 → 🟢 VERDE LÁSER (clásico, potente)
    // Intensity > 0.8  → 🔵 AZUL ELÉCTRICO (nuclear)
    // ═════════════════════════════════════════════════════════════════════
    
    const effectiveIntensity = this.triggerIntensity * this.config.flashIntensity
    let color: { h: number; s: number; l: number }
    
    if (effectiveIntensity < 0.5) {
      // 🟣 UV VIOLETA - Blacklight effect
      color = { h: 270, s: 100, l: 50 }  // #9D00FF
    } else if (effectiveIntensity < 0.8) {
      // 🟢 VERDE LÁSER - Cyberpunk classic
      color = { h: 120, s: 100, l: 50 }  // #00FF00
    } else {
      // 🔵 AZUL ELÉCTRICO - High energy nuclear
      color = { h: 200, s: 100, l: 50 }  // #0099FF
    }

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
