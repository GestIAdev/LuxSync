/**
 * 🦠 PLANKTON DRIFT - Deriva de Plancton Bioluminiscente en OCEAN (1000-3000m)
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 1072: AMBIENT FAUNA - Tier 2 (Frequent/Subtle)
 * WAVE 1085: CHILL LOUNGE FINAL POLISH
 *   - Organic easing curves (deriva más natural)
 *   - Intensity floor: 0.4 (micro-fauna)
 *   - Atmospheric bed: 12% cyan profundo (océano bioluminiscente)
 *   - Breathing más orgánico
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * DESCRIPCIÓN: Pequeñas partículas de plancton bioluminiscente que flotan
 * y derivan lentamente, creando un ambiente etéreo de profundidad media.
 * El efecto simula millones de microorganismos brillando suavemente.
 * La deriva es ORGÁNICA, no mecánica.
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
  /** 🌊 WAVE 1085: Intensidad mínima garantizada (micro-fauna) */
  minIntensity: number
  /** 🌊 WAVE 1085: Relleno atmosférico cyan profundo */
  atmosphericBed: number
}

const DEFAULT_CONFIG: PlanktonDriftConfig = {
  durationMs: 4000,      // Duración más larga (deriva lenta)
  clusterCount: 8,       // Grupos de plancton
  peakIntensity: 0.90,   // 🦠 WAVE 1083.1: RESCATE LUMÍNICO - Sin límites artificiales
  minIntensity: 0.65,    // 🦠 WAVE 1083.1: Supera noise floor OCEAN (0.40)
  atmosphericBed: 0.12,  // 🌊 WAVE 1085: 12% atmósfera cyan
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
    
    // 🌊 WAVE 1085: ORGANIC EASING - Ease-in-out cubic
    // La deriva es ORGÁNICA, no mecánica
    const easeInOutCubic = (t: number): number => 
      t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1
    
    const easedProgress = easeInOutCubic(progress)
    
    // 🌊 WAVE 1085: INTENSITY FLOOR - Garantizar visibilidad micro-fauna
    const effectiveIntensity = Math.max(
      this.triggerIntensity,
      this.config.minIntensity
    )
    
    // 🌊 WAVE 1085: Envelope muy suave con transiciones orgánicas
    let envelope: number
    if (progress < 0.25) {
      envelope = easeInOutCubic(progress / 0.25)  // Entrada orgánica gradual
    } else if (progress < 0.60) {
      envelope = 1.0
    } else {
      // 🌊 WAVE 1085: Salida muy suave (plancton se desvanece gradualmente)
      const fadeOutProgress = (progress - 0.60) / 0.40
      envelope = (1 - easeInOutCubic(fadeOutProgress))
    }
    
    // 🌊 WAVE 1085: ATMOSPHERIC BED - Cyan profundo del océano
    const atmosphericAmbient = this.config.atmosphericBed * envelope * effectiveIntensity
    const atmosphericColor = { h: 188, s: 75, l: 32 }  // Cyan profundo
    
    // El plancton "pulsa" suavemente con easing (respiración bioluminiscente)
    const breathPhase = easedProgress * Math.PI * 4
    const breathPulse = (Math.sin(breathPhase) + 1) / 2 * 0.4 + 0.6
    
    // Calcular deriva de los clusters con easing
    const zoneIntensities: Record<string, number> = {
      frontL: 0, frontR: 0, backL: 0, backR: 0
    }
    
    for (let i = 0; i < this.clusterPhases.length; i++) {
      const phase = this.clusterPhases[i]
      // La deriva es sinusoidal con easing (movimiento browniano orgánico)
      const driftPosition = (phase + easedProgress * 0.5) % 1
      const clusterPulse = Math.sin((easedProgress * 2 + phase) * Math.PI * 2) * 0.5 + 0.5
      
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
    
    // 🌊 WAVE 1085: Intensidad con floor aplicado
    const baseIntensity = envelope * this.config.peakIntensity * breathPulse * effectiveIntensity
    
    // Color que varía muy sutilmente
    const colorIndex = Math.floor((easedProgress * PLANKTON_COLORS.length) % PLANKTON_COLORS.length)
    const planktonColor = PLANKTON_COLORS[colorIndex]
    
    // Output estructurado según EffectFrameOutput
    const output: EffectFrameOutput = {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      zones: ['frontL', 'frontR', 'backL', 'backR'],
      // 🦠 WAVE 1083.1: RESCATE LUMÍNICO
      // baseIntensity YA contiene effectiveIntensity (línea 149)
      // Multiplicar de nuevo era MUERTE por matemáticas
      intensity: baseIntensity,
      zoneOverrides: {},
    }
    
    // 🌊 WAVE 1085: Aplicar intensidades con atmospheric bed
    const frontLInt = baseIntensity * zoneIntensities['frontL']
    const frontRInt = baseIntensity * zoneIntensities['frontR']
    const backLInt = baseIntensity * zoneIntensities['backL']
    const backRInt = baseIntensity * zoneIntensities['backR']
    
    output.zoneOverrides!['frontL'] = {
      dimmer: Math.max(frontLInt, atmosphericAmbient),
      color: frontLInt > atmosphericAmbient ? planktonColor : atmosphericColor,
      blendMode: 'max' as const,
    }
    output.zoneOverrides!['frontR'] = {
      dimmer: Math.max(frontRInt, atmosphericAmbient),
      color: frontRInt > atmosphericAmbient ? planktonColor : atmosphericColor,
      blendMode: 'max' as const,
    }
    output.zoneOverrides!['backL'] = {
      dimmer: Math.max(backLInt, atmosphericAmbient * 0.7),
      color: backLInt > atmosphericAmbient * 0.7 ? planktonColor : atmosphericColor,
      blendMode: 'max' as const,
    }
    output.zoneOverrides!['backR'] = {
      dimmer: Math.max(backRInt, atmosphericAmbient * 0.7),
      color: backRInt > atmosphericAmbient * 0.7 ? planktonColor : atmosphericColor,
      blendMode: 'max' as const,
    }
    
    return output
  }
  
  // Validar que solo se dispare en OCEAN
  static isValidForZone(zone: string): boolean {
    return zone === 'OCEAN'
  }
}
