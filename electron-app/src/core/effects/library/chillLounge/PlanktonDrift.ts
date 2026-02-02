/**
 * 🦠 PLANKTON DRIFT - Deriva de Plancton Bioluminiscente en OCEAN (1000-3000m)
 * WAVE 1072: AMBIENT FAUNA - Tier 2 (Frequent/Subtle)
 * 
 * DESCRIPCIÓN: Pequeñas partículas de plancton bioluminiscente que flotan
 * y derivan lentamente, creando un ambiente etéreo de profundidad media.
 * El efecto simula millones de microorganismos brillando suavemente.
 * 
 * COLORES: Cyan eléctrico y turquesa profundo (bioluminiscencia real)
 * HSL FORMAT: h(0-360), s(0-100), l(0-100)
 * 
 * ZONA: OCEAN exclusivamente (1000-3000m)
 * COOLDOWN: 20s
 */

import { BaseEffect } from '../../BaseEffect'
import { EffectTriggerConfig, EffectFrameOutput, EffectCategory } from '../../types'

interface PlanktonDriftConfig {
  durationMs: number
  clusterCount: number
  peakIntensity: number
}

const DEFAULT_CONFIG: PlanktonDriftConfig = {
  durationMs: 4000,      // Duración más larga (deriva lenta)
  clusterCount: 8,       // Grupos de plancton
  peakIntensity: 0.35,   // Muy sutil
}

// 🦠 COLORES BIOLUMINISCENCIA: Cyan y turquesa (científicamente preciso)
const PLANKTON_COLORS = [
  { h: 185, s: 90, l: 50 },   // Cyan eléctrico
  { h: 190, s: 85, l: 45 },   // Cyan profundo
  { h: 175, s: 95, l: 55 },   // Turquesa brillante
  { h: 180, s: 80, l: 40 },   // Azul verdoso
]

export class PlanktonDrift extends BaseEffect {
  readonly effectType = 'plankton_drift'
  readonly name = 'Plankton Drift'
  readonly category: EffectCategory = 'physical'  
  readonly priority = 35                           // Muy baja (fondo ambiental)
  readonly mixBus = 'htp' as const
  
  private config: PlanktonDriftConfig
  private clusterPhases: number[] = []
  
  constructor(config?: Partial<PlanktonDriftConfig>) {
    super('plankton_drift')
    this.config = { ...DEFAULT_CONFIG, ...config }
  }
  
  trigger(triggerConfig: EffectTriggerConfig): void {
    super.trigger(triggerConfig)
    
    // Fases determinísticas basadas en timestamp
    // NO usamos Math.random() - Axioma Anti-Simulación
    const baseSeed = Date.now()
    this.clusterPhases = Array.from({ length: this.config.clusterCount }, 
      (_, i) => ((baseSeed + i * 89) % 360) / 360  // 89 es primo
    )
    
    console.log(`[🦠 PlanktonDrift] TRIGGERED! Clusters=${this.config.clusterCount}`)
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
    
    // Envelope muy suave: breathing del plancton
    let envelope: number
    if (progress < 0.25) {
      envelope = progress / 0.25  // Fade in gradual
    } else if (progress < 0.65) {
      envelope = 1.0
    } else {
      envelope = 1 - ((progress - 0.65) / 0.35)  // Fade out muy suave
    }
    
    // El plancton "pulsa" suavemente (respiración bioluminiscente)
    const breathPhase = progress * Math.PI * 4  // 2 respiraciones completas
    const breathPulse = (Math.sin(breathPhase) + 1) / 2 * 0.4 + 0.6
    
    // Calcular deriva de los clusters
    // Cada cluster está en una posición diferente del espacio estéreo
    const zoneIntensities: Record<string, number> = {
      frontL: 0, frontR: 0, backL: 0, backR: 0
    }
    
    for (let i = 0; i < this.clusterPhases.length; i++) {
      const phase = this.clusterPhases[i]
      // La deriva es sinusoidal (movimiento browniano simplificado)
      const driftPosition = (phase + progress * 0.5) % 1  // Deriva lenta
      const clusterPulse = Math.sin((progress * 2 + phase) * Math.PI * 2) * 0.5 + 0.5
      
      // Mapear posición a zonas
      if (driftPosition < 0.25) {
        zoneIntensities['frontL'] += clusterPulse / this.config.clusterCount
      } else if (driftPosition < 0.5) {
        zoneIntensities['frontR'] += clusterPulse / this.config.clusterCount
      } else if (driftPosition < 0.75) {
        zoneIntensities['backL'] += clusterPulse / this.config.clusterCount
      } else {
        zoneIntensities['backR'] += clusterPulse / this.config.clusterCount
      }
    }
    
    const baseIntensity = envelope * this.config.peakIntensity * breathPulse
    
    // Color que varía muy sutilmente
    const colorIndex = Math.floor((progress * PLANKTON_COLORS.length) % PLANKTON_COLORS.length)
    const planktonColor = PLANKTON_COLORS[colorIndex]
    
    // Output estructurado según EffectFrameOutput
    const output: EffectFrameOutput = {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      zones: ['frontL', 'frontR', 'backL', 'backR'],
      intensity: this.triggerIntensity * baseIntensity,
      zoneOverrides: {},
    }
    
    // Aplicar intensidades calculadas por zona
    output.zoneOverrides!['frontL'] = {
      dimmer: baseIntensity * zoneIntensities['frontL'],
      color: planktonColor,
      blendMode: 'max' as const,
    }
    output.zoneOverrides!['frontR'] = {
      dimmer: baseIntensity * zoneIntensities['frontR'],
      color: planktonColor,
      blendMode: 'max' as const,
    }
    output.zoneOverrides!['backL'] = {
      dimmer: baseIntensity * zoneIntensities['backL'],
      color: planktonColor,
      blendMode: 'max' as const,
    }
    output.zoneOverrides!['backR'] = {
      dimmer: baseIntensity * zoneIntensities['backR'],
      color: planktonColor,
      blendMode: 'max' as const,
    }
    
    return output
  }
  
  // Validar que solo se dispare en OCEAN
  static isValidForZone(zone: string): boolean {
    return zone === 'OCEAN'
  }
}
