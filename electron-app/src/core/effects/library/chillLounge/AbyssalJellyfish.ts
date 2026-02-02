/**
 * 🪼 ABYSSAL JELLYFISH - Medusas Bioluminiscentes en MIDNIGHT (6000+m)
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 1073.3: COMPLETE REWRITE - DOS MEDUSAS que CRUZAN el escenario
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * CONCEPTO SIMPLE Y EFECTIVO:
 * - Medusa MAGENTA: Empieza en IZQUIERDA, viaja hacia DERECHA
 * - Medusa CYAN: Empieza en DERECHA, viaja hacia IZQUIERDA
 * - Se CRUZAN en el centro creando un momento VIOLETA
 * - Cada zona solo se ilumina cuando una medusa está CERCA
 * 
 * ZONAS EN ORDEN L→R: frontL(0.0), backL(0.2), movers_L(0.35), movers_R(0.65), backR(0.8), frontR(1.0)
 * 
 * HSL FORMAT: h(0-360), s(0-100), l(0-100)
 */

import { BaseEffect } from '../../BaseEffect'
import { EffectTriggerConfig, EffectFrameOutput, EffectCategory } from '../../types'

interface AbyssalJellyfishConfig {
  durationMs: number
  peakIntensity: number
  jellyWidth: number  // Qué tan "gorda" es cada medusa (0-1)
}

const DEFAULT_CONFIG: AbyssalJellyfishConfig = {
  durationMs: 18000,        // 18 segundos
  peakIntensity: 0.90,
  jellyWidth: 0.18,         // 🌊 WAVE 1073.7: 30% → 18% (medusas más focalizadas para stereo)
}

// 🪼 COLORES NEON BIOLUMINISCENTES
const JELLY_COLORS = {
  magenta: { h: 310, s: 100, l: 58 },  // MAGENTA NEON - viaja L→R
  cyan:    { h: 185, s: 100, l: 55 },  // CYAN NEON - viaja R→L
  violet:  { h: 270, s: 100, l: 60 },  // VIOLETA - cuando se cruzan
}

// Zonas ordenadas de L a R (posición 0 a 1)
const ZONE_POSITIONS: Record<string, number> = {
  frontL: 0.0,
  backL: 0.20,
  movers_left: 0.35,
  movers_right: 0.65,
  backR: 0.80,
  frontR: 1.0,
}

const ZONE_NAMES = ['frontL', 'backL', 'movers_left', 'movers_right', 'backR', 'frontR'] as const

export class AbyssalJellyfish extends BaseEffect {
  readonly effectType = 'abyssal_jellyfish'
  readonly name = 'Abyssal Jellyfish'
  readonly category: EffectCategory = 'physical'
  readonly priority = 65
  readonly mixBus = 'htp' as const
  
  private config: AbyssalJellyfishConfig
  
  constructor(config?: Partial<AbyssalJellyfishConfig>) {
    super('abyssal_jellyfish')
    this.config = { ...DEFAULT_CONFIG, ...config }
  }
  
  trigger(triggerConfig: EffectTriggerConfig): void {
    super.trigger(triggerConfig)
    console.log(
      `[🪼 JELLY] Two bioluminescent jellies crossing - ${this.config.durationMs}ms | ` +
      `width=${this.config.jellyWidth} | MAGENTA(L→R) CYAN(R→L)`
    )
  }

  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    this.elapsedMs += deltaMs
    if (this.elapsedMs >= this.config.durationMs) {
      this.phase = 'finished'
    }
  }
  
  /**
   * 🪼 Calcula la intensidad de una medusa en una zona
   */
  private getJellyIntensity(jellyPos: number, zonePos: number): number {
    const distance = Math.abs(jellyPos - zonePos)
    if (distance > this.config.jellyWidth) return 0
    
    // Forma gaussiana: máximo en el centro, cae suavemente
    const normalizedDist = distance / this.config.jellyWidth
    return Math.exp(-normalizedDist * normalizedDist * 4)
  }
  
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null
    
    const progress = this.elapsedMs / this.config.durationMs
    
    // Envelope con plateau largo
    let envelope: number
    if (progress < 0.10) { 
      envelope = (progress / 0.10) ** 1.5
    } else if (progress < 0.85) { 
      envelope = 1.0 
    } else { 
      envelope = ((1 - progress) / 0.15) ** 1.5
    }
    
    // 🪼 POSICIONES DE LAS DOS MEDUSAS CON DESFASE
    // 🌊 WAVE 1073.6: Desfase reducido - ambas visibles desde el inicio
    
    // Medusa MAGENTA: L→R (empieza en frontL, termina en frontR)
    const magentaPos = progress * 1.0
    
    // Medusa CYAN: R→L (empieza en frontR con 15% de desfase, termina en frontL)
    // 🌊 WAVE 1073.6: Desfase reducido de 20% a 15% para que ambas sean visibles
    const cyanDelay = 0.15  // 15% de retraso
    const cyanProgress = Math.max(0, (progress - cyanDelay) / (1 - cyanDelay))
    const cyanPos = 1.0 - cyanProgress  // Empieza en 1.0 (frontR), termina en 0.0 (frontL)
    
    // 🌊 Pulsos individuales (respiración bioluminiscente)
    // También desfasados para que no pulsen al unísono
    const magentaPulse = Math.sin(progress * Math.PI * 5) * 0.12 + 0.88
    const cyanPulse = Math.sin(progress * Math.PI * 5.5 + Math.PI * 0.7) * 0.14 + 0.86  // Frecuencia ligeramente diferente
    
    const output: EffectFrameOutput = {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      zones: [...ZONE_NAMES],
      intensity: this.triggerIntensity * envelope * this.config.peakIntensity,
      zoneOverrides: {},
    }

    // 🪼 Calcular cada zona
    for (const zoneName of ZONE_NAMES) {
      const zonePos = ZONE_POSITIONS[zoneName]
      
      // Intensidad de cada medusa en esta zona
      const magentaInt = this.getJellyIntensity(magentaPos, zonePos) * magentaPulse
      const cyanInt = this.getJellyIntensity(cyanPos, zonePos) * cyanPulse
      
      // Decidir color y intensidad final
      let finalColor: { h: number; s: number; l: number }
      let finalIntensity: number
      
      const threshold = 0.15  // Umbral para considerar que una medusa está presente
      
      if (magentaInt > threshold && cyanInt > threshold) {
        // ✨ CRUCE: Ambas medusas presentes → VIOLETA brillante
        finalColor = JELLY_COLORS.violet
        finalIntensity = Math.min(1, (magentaInt + cyanInt) * 1.2)  // Boost
      } else if (magentaInt > cyanInt && magentaInt > threshold) {
        // Solo MAGENTA
        finalColor = JELLY_COLORS.magenta
        finalIntensity = magentaInt
      } else if (cyanInt > threshold) {
        // Solo CYAN
        finalColor = JELLY_COLORS.cyan
        finalIntensity = cyanInt
      } else {
        // Sin medusas cerca → muy tenue
        finalColor = { h: 280, s: 50, l: 30 }
        finalIntensity = 0.05
      }
      
      const zoneDimmer = finalIntensity * envelope * this.config.peakIntensity
      
      output.zoneOverrides![zoneName] = {
        dimmer: zoneDimmer,
        color: finalColor,
        blendMode: 'max' as const,
      }
    }
    
    // 🪼 Movers: siguen a la medusa más cercana
    // El mover izquierdo sigue a MAGENTA (L→R), el derecho a CYAN (R→L)
    const moverLeftPan = (magentaPos - 0.5) * 18  // Sigue a MAGENTA
    const moverRightPan = (cyanPos - 0.5) * 18    // Sigue a CYAN
    
    const moverTilt = Math.sin(progress * Math.PI * 1.2) * 6
    
    output.zoneOverrides!['movers_left'] = {
      ...output.zoneOverrides!['movers_left'],
      movement: { 
        pan: moverLeftPan, 
        tilt: moverTilt + 5,
        isAbsolute: false,
        speed: 0.06,
      },
    }
    output.zoneOverrides!['movers_right'] = {
      ...output.zoneOverrides!['movers_right'],
      movement: { 
        pan: moverRightPan, 
        tilt: moverTilt - 3,
        isAbsolute: false,
        speed: 0.06,
      },
    }
    
    return output
  }
  
  isFinished(): boolean { return this.phase === 'finished' }
  abort(): void { this.phase = 'finished' }
}