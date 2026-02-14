/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌊 TIDAL WAVE - SPATIAL PHASE SWEEP
 * ═════════════════════════════════════════════════════════    // 🌊 WAVE 1009: FREEDOM DAY - Movers reciben COLOR
    // El HAL traduce RGB → Color Wheel DMX automáticamente
    for (const [zone, zoneIntensity] of this.zoneIntensities) {
      // Threshold 0.0 → TODAS las zonas incluidas, incluso valles negros
      if (zoneIntensity >= 0.0) {
        // 🌊 WAVE 1010.7: MULTIPLICADOR - En lugar de setear, AMPLIFICAMOS la energía base
        // ANTES: getIntensityFromZScore(zoneIntensity * triggerIntensity) → Seteaba valor
        // AHORA: zoneIntensity es el MULTIPLICADOR de la energía base (triggerIntensity)
        // Si triggerIntensity=0.3 y zoneIntensity=2.5 → 0.75 (amplificado pero real)
        const amplifiedIntensity = Math.min(1.0, zoneIntensity * this.triggerIntensity)
        const scaledIntensity = this.getIntensityFromZScore(amplifiedIntensity, 0.25)═════════
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

import { BaseEffect } from '../../BaseEffect'
import { 
  EffectTriggerConfig, 
  EffectFrameOutput, 
  EffectPhase,
  EffectCategory,
  EffectZone
} from '../../types'

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
  wavePeriodMs: 2250,    // 🌊 WAVE 805.4: 2.25s por ola = 4.5s para ida+vuelta
  waveCount: 2,          // 🌊 WAVE 750: 2 olas = ida + vuelta (ping-pong)
  bpmSync: true,
  beatsPerWave: 3,       // 🌊 WAVE 805.4: 3 beats por ola = timing perfecto
  forwardDirection: true,
  // 🌊 WAVE 805.4: DORADO hermoso (no azul) - perfecto para movers con rueda
  waveColor: { h: 45, s: 90, l: 60 },  // Dorado brillante (amarillo cálido)
  whiteOnPeak: true,     // 🌊 WAVE 750: Destello en el pico
  intensityFloor: 0.0,   // 🌊 WAVE 805.2: NEGRO TOTAL en valles (era 0.1)
}

// 🌊 WAVE 691.5: TODAS las zonas participan, no solo front
const ZONE_ORDER: EffectZone[] = ['front', 'all-pars', 'back', 'all-movers']

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
  readonly mixBus = 'global' as const  // 🚂 WAVE 800: Dictador - ola espacial con valles
  
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
    
    // 🌊 WAVE 691.5: Adaptar color según vibe
    if (config.musicalContext?.vibeId === 'fiesta-latina') {
      // Colores cálidos para latina
      this.config.waveColor = { h: 30, s: 85, l: 55 }  // Naranja dorado
    }
    
    console.log(`[TidalWave 🌊] TRIGGERED! Period=${this.actualWavePeriodMs}ms Waves=${this.config.waveCount} Color=hsl(${this.config.waveColor.h},${this.config.waveColor.s}%,${this.config.waveColor.l}%)`)
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
    
    // 🎨 WAVE 725: ZONE OVERRIDES - TidalWave es el efecto ESPACIAL por excelencia
    // Cada zona tiene su propia intensidad basada en la fase de la ola
    
    // 🌊 WAVE 805.2: Color FIJO (no shift) - la identidad del azul es sagrada
    const baseColor = {
      h: this.config.waveColor.h,
      s: this.config.waveColor.s,
      l: this.config.waveColor.l,
    }
    
    // 🎨 WAVE 725: Construir zone overrides con intensidad específica por zona
    const zoneOverrides: EffectFrameOutput['zoneOverrides'] = {}
    
    // � WAVE 1009: FREEDOM DAY - Movers reciben COLOR
    // El HAL traduce RGB → Color Wheel DMX automáticamente
    for (const [zone, zoneIntensity] of this.zoneIntensities) {
      // Threshold 0.0 → TODAS las zonas incluidas, incluso valles negros
      if (zoneIntensity >= 0.0) {
        const scaledIntensity = this.getIntensityFromZScore(
          zoneIntensity * this.triggerIntensity, 
          0.25
        )
        
        // 🌊 WAVE 805.5: VITAMINAS - Luminosidad más agresiva en el pico
        // Pico: 100% lum, Valles: 20% lum (antes era 30%)
        const zoneLuminosity = baseColor.l * (0.2 + scaledIntensity * 0.8)
        const zoneColor = {
          ...baseColor,
          l: Math.min(75, zoneLuminosity)  // Cap a 75 para no quemar
        }
        
        // � WAVE 1009: FREEDOM DAY - TODOS reciben color (incluido movers)
        // HAL traduce Cian/Turquesa → DMX 20 en EL-1140
        zoneOverrides[zone] = {
          color: zoneColor,
          dimmer: scaledIntensity,
          blendMode: 'replace',  // La ola manda
        }
      }
    }
    
    // Calcular intensidad máxima para el output legacy
    let maxIntensity = 0
    for (const intensity of this.zoneIntensities.values()) {
      if (intensity > maxIntensity) maxIntensity = intensity
    }
    const scaledMaxIntensity = this.getIntensityFromZScore(
      maxIntensity * this.triggerIntensity, 
      0.25
    )
    
    // Legacy fallback color
    const legacyColor = {
      ...baseColor,
      l: Math.min(75, baseColor.l + scaledMaxIntensity * 10)
    }

    return {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress: this.calculateProgress(),
      // 🎨 WAVE 740: zones derivado de zoneOverrides
      zones: Object.keys(zoneOverrides) as EffectZone[],
      intensity: scaledMaxIntensity,
      
      // Legacy fallback (DEPRECATED - use zoneOverrides)
      dimmerOverride: undefined,
      colorOverride: undefined,
      
      // White solo en el pico de la ola
      whiteOverride: this.config.whiteOnPeak && scaledMaxIntensity > 0.8 
        ? (scaledMaxIntensity - 0.8) * 5  // Ramp de 0.8→1 = white 0→1
        : undefined,
      
      // � WAVE 725: ZONE OVERRIDES - El corazón de la ola espacial
      zoneOverrides,
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
    
    // 🌊 WAVE 750: PING-PONG - La ola va y vuelve
    // En ola par (0, 2, 4...): forward
    // En ola impar (1, 3, 5...): reverse
    const isReverse = this.wavesCompleted % 2 === 1
    
    for (let i = 0; i < numZones; i++) {
      const zone = ZONE_ORDER[i]
      
      // Calcular offset de fase para esta zona
      // Forward: front=0, pars=0.25, back=0.5, movers=0.75
      // Reverse: front=0.75, pars=0.5, back=0.25, movers=0
      let phaseOffset: number
      if (isReverse) {
        phaseOffset = (numZones - 1 - i) / numZones
      } else {
        phaseOffset = i / numZones
      }
      
      // Fase local de esta zona
      const localPhase = (this.wavePhase + phaseOffset) % 1
      
      // 🌊 WAVE 805.5: Curva ULTRA-BRUTAL con vitaminas de intensidad
      // Usando sin^6 para pico ULTRAAGUDO (solo 1 zona visible, resto negro)
      const sineValue = Math.sin(localPhase * Math.PI * 2)
      const shapedSine = sineValue > 0 ? Math.pow(sineValue, 6) : 0  // Pico ultra-estrecho
      
      // 🌊 WAVE 1010.7: VITAMINA DOBLE WHAMMY - MULTIPLICADOR + BOOST BRUTAL
      // ANTES: Intensidad fija [0.0, 1.8] → Se veía escuchimizada en momentos de poca energía
      // AHORA: Multiplicador de energía actual × BOOST 2.5
      const intensityBoost = 2.5  // ULTRA BOOST - Si nos pasamos, git checkout!
      const boostedIntensity = shapedSine * intensityBoost
      
      // 🌊 WAVE 805.2: CONTRASTE BRUTAL - floor=0.0 (negro total en valles)
      // NUEVO: En lugar de setear [floor, 1.0], ahora MODULAMOS [floor, boost]
      const intensity = this.config.intensityFloor + 
        boostedIntensity * (1.0 - this.config.intensityFloor)
      
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
