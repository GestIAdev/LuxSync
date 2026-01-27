/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧪 ACID SWEEP - THE BLADE OF LIGHT
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🔪 WAVE 770: TECHNO PHYSICS KERNEL
 * 
 * FILOSOFÍA:
 * Una lámina de luz que corta el escenario en 3D.
 * Inspirado en acid lines de TB-303 - matemáticamente preciso,
 * visualmente brutal.
 * 
 * COMPORTAMIENTO:
 * - MixBus: 'htp' (ADITIVO - suma con física, no la reemplaza)
 * - Sweep patrón: Barrido de izquierda a derecha o front a back
 * - Volumétrico: Math.abs(position - sweepPosition) < width
 * - Reactivo a context.spectral.harshness
 * 
 * COLORES:
 * - Normal: Cyan brillante (180,100,60)
 * - High harshness: Verde tóxico (120,100,55)
 * - Peak: Blanco (flash en el pico del sweep)
 * 
 * ZONAS:
 * - Usa zoneOverrides para control granular por zona
 * - front → pars → back → movers (secuencia espacial)
 * 
 * @module core/effects/library/techno/AcidSweep
 * @version WAVE 770 - THE BLADE OF LIGHT
 */

import { BaseEffect } from '../../BaseEffect'
import { 
  EffectTriggerConfig, 
  EffectFrameOutput, 
  EffectCategory,
  EffectPhase,
  EffectZone
} from '../../types'

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

interface AcidSweepConfig {
  /** Duración total del sweep (ms) */
  sweepDurationMs: number
  
  /** Número de sweeps */
  sweepCount: number
  
  /** ¿BPM-synced? */
  bpmSync: boolean
  
  /** Beats por sweep (si bpmSync=true) */
  beatsPerSweep: number
  
  /** Dirección: true = front→back, false = back→front */
  forwardDirection: boolean
  
  /** Ancho de la lámina de luz (0-1) */
  bladeWidth: number
  
  /** ¿Alternar dirección entre sweeps? */
  pingPong: boolean
  
  /** Umbral de harshness para modo tóxico */
  harshnessThreshold: number
}

const DEFAULT_CONFIG: AcidSweepConfig = {
  sweepDurationMs: 2000,     // 🔫 WAVE 930.4: 2s por sweep (was 1.5s) - más apreciable
  sweepCount: 3,             // 🔫 WAVE 930.4: 3 sweeps (was 2) - más presencia
  bpmSync: true,
  beatsPerSweep: 3,          // 🔫 WAVE 930.4: 3 beats por sweep (was 2) - más lento y visible
  forwardDirection: true,    // front → back
  bladeWidth: 0.45,          // � WAVE 930.4: 45% del escenario (was 40%) - más ancho
  pingPong: true,            // Ida y vuelta
  harshnessThreshold: 0.6,   // Umbral para verde tóxico
}

// Zonas en orden espacial (front a back)
const ZONE_ORDER: EffectZone[] = ['front', 'pars', 'back', 'movers']

// ═══════════════════════════════════════════════════════════════════════════
// 🧪 ACID SWEEP CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class AcidSweep extends BaseEffect {
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect properties
  // ─────────────────────────────────────────────────────────────────────────
  
  readonly effectType = 'acid_sweep'
  readonly name = 'Acid Sweep'
  readonly category: EffectCategory = 'physical'
  readonly priority = 75  // Media-alta (menor que strobe, mayor que ambient)
  readonly mixBus = 'htp' as const  // 🚂 ADITIVO - suma con física
  
  // ─────────────────────────────────────────────────────────────────────────
  // Internal state
  // ─────────────────────────────────────────────────────────────────────────
  
  private config: AcidSweepConfig
  private sweepPhase = 0        // 0-1, posición del sweep
  private sweepsCompleted = 0
  private actualSweepDurationMs = 1500
  private currentDirection = true  // true = forward
  
  // Per-zone intensity cache
  private zoneIntensities: Map<EffectZone, number> = new Map()
  
  // Spectral mode
  private toxicMode = false
  
  // Colors
  private baseColor: { h: number; s: number; l: number } = { h: 180, s: 100, l: 60 }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────
  
  constructor(config?: Partial<AcidSweepConfig>) {
    super('acid_sweep')
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
    
    // Reset state
    this.sweepPhase = 0
    this.sweepsCompleted = 0
    this.currentDirection = this.config.forwardDirection
    
    // 🔪 Detectar modo tóxico
    const harshness = (config as any).harshness ?? 0
    this.toxicMode = harshness > this.config.harshnessThreshold
    
    // 🔪 Calcular color según modo
    this.calculateBaseColor()
    
    // Calcular duración basada en BPM
    this.calculateSweepDuration()
    
    console.log(`[AcidSweep 🧪] TRIGGERED! Duration=${this.actualSweepDurationMs}ms Sweeps=${this.config.sweepCount} ToxicMode=${this.toxicMode}`)
  }
  
  private calculateBaseColor(): void {
    if (this.toxicMode) {
      // 🧪 TOXIC MODE: Verde tóxico TB-303 (WAVE 790: boosted luminosity)
      this.baseColor = { h: 120, s: 100, l: 70 }
    } else {
      // 🔵 NORMAL: Cyan brillante
      this.baseColor = { h: 180, s: 100, l: 60 }
    }
  }
  
  private calculateSweepDuration(): void {
    if (this.config.bpmSync && this.musicalContext?.bpm) {
      const msPerBeat = 60000 / this.musicalContext.bpm
      this.actualSweepDurationMs = msPerBeat * this.config.beatsPerSweep
    } else {
      this.actualSweepDurationMs = this.config.sweepDurationMs
    }
  }
  
  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    
    this.elapsedMs += deltaMs
    
    // Update sweep phase
    this.sweepPhase += deltaMs / this.actualSweepDurationMs
    
    // Check if sweep completed
    if (this.sweepPhase >= 1) {
      this.sweepsCompleted++
      this.sweepPhase = this.sweepPhase % 1
      
      // Ping-pong: alternar dirección
      if (this.config.pingPong) {
        this.currentDirection = !this.currentDirection
      }
      
      // ¿Terminamos todos los sweeps?
      if (this.sweepsCompleted >= this.config.sweepCount) {
        this.phase = 'finished'
        console.log(`[AcidSweep 🧪] FINISHED (${this.sweepsCompleted} sweeps, ${this.elapsedMs}ms)`)
        return
      }
    }
    
    // Update zone intensities
    this.updateZoneIntensities()
  }
  
  /**
   * 🔪 Calcular intensidad por zona basada en posición del sweep
   * 
   * Usa una función de "lámina" volumétrica:
   * intensity = 1 - (distance / bladeWidth)
   * Solo las zonas dentro del ancho de la lámina se iluminan
   */
  private updateZoneIntensities(): void {
    const numZones = ZONE_ORDER.length
    
    // Posición actual del sweep (0-1)
    const sweepPos = this.currentDirection ? this.sweepPhase : (1 - this.sweepPhase)
    
    for (let i = 0; i < numZones; i++) {
      const zone = ZONE_ORDER[i]
      
      // Posición de la zona (0 = front, 1 = movers)
      const zonePos = i / (numZones - 1)
      
      // Distancia al centro del sweep
      const distance = Math.abs(zonePos - sweepPos)
      
      // 🔪 Función de lámina volumétrica
      // Si está dentro del ancho de la lámina, calcular intensidad
      if (distance < this.config.bladeWidth) {
        // Curva suave: más brillante en el centro
        const normalizedDist = distance / this.config.bladeWidth
        // Curva sin^2 para bordes suaves
        const intensity = Math.pow(1 - normalizedDist, 2)
        this.zoneIntensities.set(zone, intensity)
      } else {
        this.zoneIntensities.set(zone, 0)
      }
    }
  }
  
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null
    
    const progress = Math.min(1, this.elapsedMs / (this.actualSweepDurationMs * this.config.sweepCount))
    
    // 🔪 Construir zone overrides con la lámina de luz
    const zoneOverrides: EffectFrameOutput['zoneOverrides'] = {}
    
    for (const [zone, zoneIntensity] of this.zoneIntensities) {
      if (zoneIntensity > 0.05) {  // Threshold para evitar ruido
        // ═══════════════════════════════════════════════════════════════════
        // � WAVE 1009: FREEDOM DAY - Movers RECIBEN COLOR
        // El HAL traduce RGB → Color Wheel DMX automáticamente
        // ═══════════════════════════════════════════════════════════════════
        
        // Escalar intensidad por trigger intensity
        const scaledIntensity = zoneIntensity * this.triggerIntensity
        
        // 🔪 Modular luminosidad según intensidad
        // Pico = 80% luminosidad, Base = 40%
        const luminosity = this.baseColor.l * (0.4 + scaledIntensity * 0.6)
        
        // 🔪 Flash blanco en el pico del sweep
        const isPeak = zoneIntensity > 0.95
        const zoneColor = isPeak 
          ? { h: 0, s: 0, l: 95 }  // Blanco flash
          : { ...this.baseColor, l: luminosity }
        
        // 🔓 FREEDOM DAY: TODOS reciben color, incluido movers
        zoneOverrides[zone] = {
          color: zoneColor,
          dimmer: scaledIntensity,
          blendMode: 'max'  // HTP - suma con física, no reemplaza
        }
      }
    }
    
    return {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      intensity: this.triggerIntensity,
      zones: ['all'],
      zoneOverrides
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

export default AcidSweep
