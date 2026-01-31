/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🪼 ABYSSAL JELLYFISH - Medusa Bioluminiscente
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 1070: THE LIVING OCEAN
 * 
 * Simula medusas bioluminiscentes en las profundidades.
 * Se activa cuando el audio tiene tonos puros (bajo contenido armónico)
 * en la zona MIDNIGHT (>4000m).
 * 
 * VISUAL:
 * - Pars con colores "alienígenas" (magenta/lima/violeta neón)
 * - Pulsos muy lentos (cada 2 segundos)
 * - Intensidad baja pero saturación máxima
 * - Bloom gaussiano para efecto de luz suave
 * 
 * FILOSOFÍA:
 * En las profundidades, donde la luz del sol nunca llega,
 * la vida crea su propia luz. Colores que no deberían existir.
 * Visitantes de otro mundo en el nuestro.
 * 
 * NOTA: Los colores magenta/lima VIOLAN la CHILL_CONSTITUTION intencionalmente.
 * La bioluminiscencia es "alienígena" al océano normal.
 * 
 * @module core/effects/library/chillLounge/AbyssalJellyfish
 * @version WAVE 1070 - THE LIVING OCEAN
 */

import { BaseEffect } from '../../BaseEffect'
import { 
  EffectTriggerConfig, 
  EffectFrameOutput, 
  EffectCategory 
} from '../../types'

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

interface AbyssalJellyfishConfig {
  /** Duración total del efecto en ms */
  durationMs: number
  
  /** Intensidad máxima de los pulsos */
  peakIntensity: number
  
  /** Intervalo entre pulsos de medusa en ms */
  pulseIntervalMs: number
  
  /** Colores de bioluminiscencia (rotación) */
  colors: { h: number; s: number; l: number }[]
}

const DEFAULT_CONFIG: AbyssalJellyfishConfig = {
  durationMs: 6000,
  peakIntensity: 0.55,
  pulseIntervalMs: 2000,
  colors: [
    { h: 300, s: 100, l: 45 },  // Magenta neón
    { h: 140, s: 100, l: 48 },  // Verde lima neón
    { h: 280, s: 100, l: 40 },  // Violeta profundo
    { h: 195, s: 100, l: 50 },  // Cyan eléctrico
  ],
}

// ═══════════════════════════════════════════════════════════════════════════
// ABYSSAL JELLYFISH EFFECT
// ═══════════════════════════════════════════════════════════════════════════

export class AbyssalJellyfish extends BaseEffect {
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect properties
  // ─────────────────────────────────────────────────────────────────────────
  
  readonly effectType = 'abyssal_jellyfish'
  readonly name = 'Abyssal Jellyfish'
  readonly category: EffectCategory = 'color'  // Principalmente afecta color
  readonly priority = 60  // Bajo - no interrumpe nada
  
  // HTP: Se suma a la oscuridad del abismo
  readonly mixBus = 'htp' as const
  
  // ─────────────────────────────────────────────────────────────────────────
  // Internal state
  // ─────────────────────────────────────────────────────────────────────────
  
  private config: AbyssalJellyfishConfig
  private currentColorIndex: number = 0
  
  // ─────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────
  
  constructor(config?: Partial<AbyssalJellyfishConfig>) {
    super('abyssal_jellyfish')
    this.config = { ...DEFAULT_CONFIG, ...config }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect implementation
  // ─────────────────────────────────────────────────────────────────────────
  
  trigger(triggerConfig: EffectTriggerConfig): void {
    super.trigger(triggerConfig)
    this.currentColorIndex = 0
    console.log(`[AbyssalJellyfish 🪼] TRIGGERED! Duration=${this.config.durationMs}ms Colors=${this.config.colors.length}`)
  }

  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    
    this.elapsedMs += deltaMs
    
    if (this.elapsedMs >= this.config.durationMs) {
      this.phase = 'finished'
      console.log(`[AbyssalJellyfish 🪼] FINISHED - Medusa drifted away`)
    }
  }
  
  /**
   * 📤 GET OUTPUT - Pulsos bioluminiscentes
   */
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null

    const progress = this.elapsedMs / this.config.durationMs
    
    // ═════════════════════════════════════════════════════════════════════
    // GLOBAL ENVELOPE: Fade in muy lento → sustain → fade out muy lento
    // ═════════════════════════════════════════════════════════════════════
    let globalEnvelope: number
    if (progress < 0.2) {
      globalEnvelope = progress / 0.2  // Fade in 20%
    } else if (progress < 0.75) {
      globalEnvelope = 1.0  // Sustain 55%
    } else {
      globalEnvelope = 1 - ((progress - 0.75) / 0.25)  // Fade out 25%
    }
    
    // ═════════════════════════════════════════════════════════════════════
    // PULSE PATTERN: Bloom gaussiano para cada medusa
    // ═════════════════════════════════════════════════════════════════════
    const pulsePhase = (this.elapsedMs % this.config.pulseIntervalMs) / this.config.pulseIntervalMs
    
    // Gaussian bloom: e^(-(x-center)² / (2*sigma²))
    // Centro en 0.4, sigma pequeño para pulso definido
    const sigma = 0.15
    const center = 0.4
    const gaussian = Math.exp(-Math.pow(pulsePhase - center, 2) / (2 * sigma * sigma))
    
    // Determinar qué color usar (rota con cada pulso)
    const pulseNumber = Math.floor(this.elapsedMs / this.config.pulseIntervalMs)
    const colorIndex = pulseNumber % this.config.colors.length
    const currentColor = this.config.colors[colorIndex]
    
    // Intensidad final
    const dimmer = gaussian * globalEnvelope * this.config.peakIntensity
    
    // ═════════════════════════════════════════════════════════════════════
    // ZONE DISTRIBUTION: Diferentes pars, diferentes fases
    // ═════════════════════════════════════════════════════════════════════
    const output: EffectFrameOutput = {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      zones: ['front', 'back', 'pars'],
      intensity: this.triggerIntensity * dimmer,
      zoneOverrides: {},
    }

    // Front pars: pulso principal
    output.zoneOverrides!['front'] = {
      dimmer,
      color: currentColor,
      blendMode: 'max' as const,
    }
    
    // Back pars: pulso desfasado (otra medusa)
    const backPulsePhase = ((this.elapsedMs + this.config.pulseIntervalMs * 0.5) % this.config.pulseIntervalMs) / this.config.pulseIntervalMs
    const backGaussian = Math.exp(-Math.pow(backPulsePhase - center, 2) / (2 * sigma * sigma))
    const backColorIndex = (pulseNumber + 1) % this.config.colors.length
    
    output.zoneOverrides!['back'] = {
      dimmer: backGaussian * globalEnvelope * this.config.peakIntensity * 0.7,
      color: this.config.colors[backColorIndex],
      blendMode: 'max' as const,
    }
    
    // Pars generales: eco suave del pulso principal
    output.zoneOverrides!['pars'] = {
      dimmer: dimmer * 0.5,
      color: currentColor,
      blendMode: 'max' as const,
    }

    return output
  }
  
  isFinished(): boolean {
    return this.phase === 'finished'
  }
  
  abort(): void {
    this.phase = 'finished'
    console.log(`[AbyssalJellyfish 🪼] Aborted`)
  }
}
