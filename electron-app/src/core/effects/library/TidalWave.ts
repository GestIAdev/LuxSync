/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌊 TIDAL WAVE - SPATIAL PHASE SWEEP
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 680: THE ARSENAL - La ola que barre el escenario
 * 
 * COMPORTAMIENTO:
 * - Una ola de luz que viaja de FRONT → BACK (o viceversa)
 * - Phase shift entre grupos crea efecto de movimiento
 * - Velocidad sincronizada al BPM
 * 
 * FÍSICA:
 * - Cada zona tiene un offset de fase diferente
 * - La "ola" es una envolvente sinusoidal que viaja
 * - Intensidad del pico modulada por Z-Score
 * 
 * ZONAS TARGET:
 * - front (PAR front) → pars (PAR back) → back (Wash back) → movers
 * - La ola viaja en secuencia, cada zona picos 90° desfasado
 * 
 * PERFECT FOR:
 * - Buildups (ola lenta ascendente)
 * - Drops (ola rápida que barre)
 * - Breakdowns (ola muy lenta, casi breathing)
 * 
 * @module core/effects/library/TidalWave
 * @version WAVE 680
 */

import { BaseEffect } from '../BaseEffect'
import { 
  EffectTriggerConfig, 
  EffectFrameOutput, 
  EffectPhase,
  EffectCategory,
  EffectZone
} from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

interface TidalWaveConfig {
  /** Duración total de una ola (ms) */
  wavePeriodMs: number
  
  /** Número de olas a ejecutar */
  waveCount: number
  
  /** ¿BPM-synced? Si true, wavePeriodMs se ajusta al BPM */
  bpmSync: boolean
  
  /** Beats por ola (si bpmSync=true) */
  beatsPerWave: number
  
  /** Dirección: true = front→back, false = back→front */
  forwardDirection: boolean
  
  /** Color base de la ola (HSL) */
  waveColor: { h: number; s: number; l: number }
  
  /** ¿Incluir white en el pico? */
  whiteOnPeak: boolean
  
  /** Intensidad mínima (floor) */
  intensityFloor: number
}

const DEFAULT_CONFIG: TidalWaveConfig = {
  wavePeriodMs: 1000,   // 1 segundo por ola
  waveCount: 3,          // 3 olas
  bpmSync: true,
  beatsPerWave: 2,       // 2 beats = 1 ola
  forwardDirection: true,
  waveColor: { h: 200, s: 80, l: 60 },  // Azul marino
  whiteOnPeak: false,
  intensityFloor: 0.1,
}

// Orden espacial de zonas (front → back)
const ZONE_ORDER: EffectZone[] = ['front', 'pars', 'back', 'movers']

// ═══════════════════════════════════════════════════════════════════════════
// TIDAL WAVE CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class TidalWave extends BaseEffect {
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect properties
  // ─────────────────────────────────────────────────────────────────────────
  
  readonly effectType = 'tidal_wave'
  readonly name = 'Tidal Wave'
  readonly category: EffectCategory = 'physical'
  readonly priority = 70  // Menor que strobe, mayor que ambient
  
  // ─────────────────────────────────────────────────────────────────────────
  // Internal state
  // ─────────────────────────────────────────────────────────────────────────
  
  private config: TidalWaveConfig
  private wavePhase = 0  // 0-1, fase global de la ola
  private wavesCompleted = 0
  private actualWavePeriodMs = 1000
  
  // Per-zone intensity cache (para output)
  private zoneIntensities: Map<EffectZone, number> = new Map()
  
  // ─────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────
  
  constructor(config?: Partial<TidalWaveConfig>) {
    super('tidal_wave')
    this.config = { ...DEFAULT_CONFIG, ...config }
    
    // Init zone intensities
    for (const zone of ZONE_ORDER) {
      this.zoneIntensities.set(zone, 0)
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect implementation
  // ─────────────────────────────────────────────────────────────────────────
  
  trigger(config: EffectTriggerConfig): void {
    super.trigger(config)
    this.wavePhase = 0
    this.wavesCompleted = 0
    this.calculateWavePeriod()
    
    console.log(`[TidalWave 🌊] TRIGGERED! Period=${this.actualWavePeriodMs}ms Waves=${this.config.waveCount}`)
  }
  
  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    
    this.elapsedMs += deltaMs
    
    // Update wave phase
    this.wavePhase += deltaMs / this.actualWavePeriodMs
    
    // Check if wave completed
    if (this.wavePhase >= 1) {
      this.wavesCompleted++
      this.wavePhase = this.wavePhase % 1
      
      // All waves done?
      if (this.wavesCompleted >= this.config.waveCount) {
        this.phase = 'finished'
        console.log(`[TidalWave 🌊] Completed (${this.wavesCompleted} waves, ${this.elapsedMs}ms)`)
        return
      }
    }
    
    // Update zone intensities
    this.updateZoneIntensities()
  }
  
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null
    
    // TidalWave produce output para cada zona afectada
    // El MasterArbiter debe manejar múltiples zonas
    // Por ahora, retornamos el output de la zona con mayor intensidad
    
    let maxIntensity = 0
    let peakZone: EffectZone = 'all'
    
    for (const [zone, intensity] of this.zoneIntensities) {
      if (intensity > maxIntensity) {
        maxIntensity = intensity
        peakZone = zone
      }
    }
    
    const scaledIntensity = this.getIntensityFromZScore(maxIntensity * this.triggerIntensity, 0.25)
    
    // Color shift basado en la fase de la ola
    const colorShift = this.wavePhase * 30  // ±30° de hue durante la ola
    const color = {
      h: (this.config.waveColor.h + colorShift) % 360,
      s: this.config.waveColor.s,
      l: this.config.waveColor.l + scaledIntensity * 20,  // Más brillo en el pico
    }
    
    return {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress: this.calculateProgress(),
      zones: this.getActiveZones(),
      intensity: scaledIntensity,
      
      dimmerOverride: scaledIntensity,
      colorOverride: color,
      
      // White solo en el pico de la ola
      whiteOverride: this.config.whiteOnPeak && scaledIntensity > 0.8 
        ? (scaledIntensity - 0.8) * 5  // Ramp de 0.8→1 = white 0→1
        : undefined,
      
      globalOverride: false,  // TidalWave es espacial, no global
      
      // 🌊 WAVE 680: Metadata extra para MasterArbiter (zona actual)
      // El arbiter puede usar esto para aplicar diferente intensidad por zona
    }
  }
  
  /**
   * 🌊 GET ZONE INTENSITIES - Para sistemas que manejan múltiples zonas
   */
  public getZoneIntensities(): Map<EffectZone, number> {
    return new Map(this.zoneIntensities)
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Wave physics
  // ─────────────────────────────────────────────────────────────────────────
  
  private calculateWavePeriod(): void {
    if (this.config.bpmSync && this.musicalContext?.bpm) {
      // Sincronizar con BPM
      const msPerBeat = 60000 / this.musicalContext.bpm
      this.actualWavePeriodMs = msPerBeat * this.config.beatsPerWave
    } else {
      this.actualWavePeriodMs = this.config.wavePeriodMs
    }
    
    // Clamp para evitar extremos
    this.actualWavePeriodMs = Math.max(200, Math.min(5000, this.actualWavePeriodMs))
  }
  
  private updateZoneIntensities(): void {
    const numZones = ZONE_ORDER.length
    
    for (let i = 0; i < numZones; i++) {
      const zone = ZONE_ORDER[i]
      
      // Calcular offset de fase para esta zona
      // En forward direction: front=0, pars=0.25, back=0.5, movers=0.75
      const phaseOffset = this.config.forwardDirection 
        ? i / numZones 
        : (numZones - 1 - i) / numZones
      
      // Fase local de esta zona
      const localPhase = (this.wavePhase + phaseOffset) % 1
      
      // Intensidad sinusoidal (pico en phase=0.5)
      // Sin: -1 → +1, normalizado a floor → 1
      const sineValue = Math.sin(localPhase * Math.PI * 2)
      const normalizedSine = (sineValue + 1) / 2  // 0-1
      
      // Aplicar floor
      const intensity = this.config.intensityFloor + 
        normalizedSine * (1 - this.config.intensityFloor)
      
      this.zoneIntensities.set(zone, intensity)
    }
  }
  
  private getActiveZones(): EffectZone[] {
    // Retornar zonas con intensidad significativa (>0.3)
    const active: EffectZone[] = []
    for (const [zone, intensity] of this.zoneIntensities) {
      if (intensity > 0.3) {
        active.push(zone)
      }
    }
    return active.length > 0 ? active : ['all']
  }
  
  private calculateProgress(): number {
    const totalWaves = this.config.waveCount
    return (this.wavesCompleted + this.wavePhase) / totalWaves
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════

export function createTidalWave(config?: Partial<TidalWaveConfig>): TidalWave {
  return new TidalWave(config)
}
