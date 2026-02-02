/**
 * ✨ BIOLUMINESCENT SPORE - Esporas Bioluminiscentes en MIDNIGHT (6000m+)
 * WAVE 1072: AMBIENT FAUNA - Tier 2 (Frequent/Subtle)
 * 
 * DESCRIPCIÓN: En la oscuridad total de la zona abisal, pequeñas esporas
 * bioluminiscentes se encienden esporádicamente. Son breves, intensos
 * y aislados - como estrellas en un cielo de tinta.
 * 
 * COLORES: Magenta profundo y violeta abisal (organismos de zona hadal)
 * HSL FORMAT: h(0-360), s(0-100), l(0-100)
 * 
 * ZONA: MIDNIGHT exclusivamente (6000m+)
 * COOLDOWN: 30s
 */

import { BaseEffect } from '../../BaseEffect'
import { EffectTriggerConfig, EffectFrameOutput, EffectCategory } from '../../types'

interface BioluminescentSporeConfig {
  durationMs: number
  sporeCount: number       // Número de esporas que brillarán
  peakIntensity: number
  /** ✨ WAVE 1083.1: Intensidad mínima garantizada (supera noise floor) */
  minIntensity: number
}

const DEFAULT_CONFIG: BioluminescentSporeConfig = {
  durationMs: 3500,        // Moderado
  sporeCount: 4,           // Pocas esporas (zona aislada)
  peakIntensity: 0.90,     // ✨ WAVE 1083.1: RESCATE LUMÍNICO - Sin límites artificiales
  minIntensity: 0.45,      // ✨ WAVE 1083.1: Supera noise floor MIDNIGHT (0.15) con margen
}

// ✨ COLORES ABISALES: Magenta y violeta profundo
const SPORE_COLORS = [
  { h: 290, s: 85, l: 40 },   // Magenta profundo
  { h: 280, s: 90, l: 35 },   // Violeta abisal
  { h: 300, s: 80, l: 45 },   // Magenta brillante
  { h: 270, s: 75, l: 30 },   // Púrpura oscuro
]

// Zonas posibles para las esporas
const SPORE_ZONES = ['frontL', 'frontR', 'backL', 'backR'] as const

export class BioluminescentSpore extends BaseEffect {
  readonly effectType = 'bioluminescent_spore'
  readonly name = 'Bioluminescent Spore'
  readonly category: EffectCategory = 'physical'  
  readonly priority = 42                           
  readonly mixBus = 'htp' as const
  
  private config: BioluminescentSporeConfig
  private sporeTimings: Array<{
    zone: typeof SPORE_ZONES[number]
    startTime: number      // 0-1, cuando comienza
    duration: number       // 0-1, cuánto dura
    colorIndex: number
  }> = []
  
  constructor(config?: Partial<BioluminescentSporeConfig>) {
    super('bioluminescent_spore')
    this.config = { ...DEFAULT_CONFIG, ...config }
  }
  
  trigger(triggerConfig: EffectTriggerConfig): void {
    super.trigger(triggerConfig)
    
    // Generar timings determinísticos para cada espora
    // NO usamos Math.random() - Axioma Anti-Simulación
    const baseSeed = Date.now()
    
    this.sporeTimings = Array.from({ length: this.config.sporeCount }, (_, i) => {
      const zoneIndex = ((baseSeed + i * 53) % SPORE_ZONES.length)
      const startOffset = ((baseSeed + i * 97) % 60) / 100  // 0-0.6
      const durationFactor = ((baseSeed + i * 41) % 30 + 10) / 100  // 0.1-0.4
      const colorIdx = ((baseSeed + i * 71) % SPORE_COLORS.length)
      
      return {
        zone: SPORE_ZONES[zoneIndex],
        startTime: startOffset,
        duration: durationFactor,
        colorIndex: colorIdx,
      }
    })
    
    console.log(`[✨ BioluminescentSpore] TRIGGERED! Spores=${this.config.sporeCount}`)
  }

  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    this.elapsedMs += deltaMs
    if (this.elapsedMs >= this.config.durationMs) {
      this.phase = 'finished'
    }
  }
  
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null
    
    const progress = this.elapsedMs / this.config.durationMs
    
    // Las esporas brillan y se apagan independientemente
    const zoneIntensities: Record<string, number> = {
      frontL: 0, frontR: 0, backL: 0, backR: 0
    }
    const zoneColors: Record<string, { h: number; s: number; l: number } | null> = {
      frontL: null, frontR: null, backL: null, backR: null
    }
    
    for (const spore of this.sporeTimings) {
      const sporeProgress = progress - spore.startTime
      
      // ¿Está esta espora activa?
      if (sporeProgress < 0 || sporeProgress > spore.duration) continue
      
      // Envelope de la espora: flash rápido con decay
      const sporeNormalized = sporeProgress / spore.duration
      let sporeEnvelope: number
      if (sporeNormalized < 0.1) {
        // Flash rápido de encendido
        sporeEnvelope = sporeNormalized / 0.1
      } else {
        // Decay exponencial (bioluminiscencia real)
        const decayProgress = (sporeNormalized - 0.1) / 0.9
        sporeEnvelope = Math.exp(-decayProgress * 3)  // Decay exponencial
      }
      
      // Acumular intensidad (pueden superponerse esporas)
      zoneIntensities[spore.zone] = Math.max(
        zoneIntensities[spore.zone],
        sporeEnvelope * this.config.peakIntensity
      )
      
      // Color de la espora más brillante en esta zona
      if (sporeEnvelope > 0.3) {
        zoneColors[spore.zone] = SPORE_COLORS[spore.colorIndex]
      }
    }
    
    // Si ninguna espora está activa, devolver output mínimo
    const hasActiveSpores = Object.values(zoneIntensities).some(v => v > 0.01)
    if (!hasActiveSpores) {
      // Devolver "oscuridad activa" - importante para MIDNIGHT
      return {
        effectId: this.id,
        category: this.category,
        phase: this.phase,
        progress,
        zones: ['frontL', 'frontR', 'backL', 'backR'],
        intensity: 0.02,  // Casi nada, pero presente
        zoneOverrides: {},
      }
    }
    
    // ✨ WAVE 1083.1: INTENSITY FLOOR - Garantizar visibilidad
    const effectiveIntensity = Math.max(
      this.triggerIntensity,
      this.config.minIntensity
    )
    
    // ✨ WAVE 1083.1: Aplicar effectiveIntensity a las intensidades de zona
    const scaledZoneIntensities = Object.fromEntries(
      Object.entries(zoneIntensities).map(([zone, intensity]) => [
        zone,
        intensity * effectiveIntensity / this.config.peakIntensity  // Escalar proporcionalmente
      ])
    )
    
    // Output estructurado
    const output: EffectFrameOutput = {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      zones: ['frontL', 'frontR', 'backL', 'backR'],
      // ✨ WAVE 1083.1: RESCATE LUMÍNICO - NO duplicar multiplicación
      intensity: Math.max(...Object.values(scaledZoneIntensities)),
      zoneOverrides: {},
    }
    
    // ✨ WAVE 1083.1: Aplicar cada zona con intensidad ESCALADA
    for (const zone of SPORE_ZONES) {
      const intensity = scaledZoneIntensities[zone] || 0
      const color = zoneColors[zone] || SPORE_COLORS[0]  // Default magenta
      
      output.zoneOverrides![zone] = {
        dimmer: intensity,
        color,
        blendMode: 'max' as const,
      }
    }
    
    return output
  }
  
  // Validar que solo se dispare en MIDNIGHT
  static isValidForZone(zone: string): boolean {
    return zone === 'MIDNIGHT'
  }
}
