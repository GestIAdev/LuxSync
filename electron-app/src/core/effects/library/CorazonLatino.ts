/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ❤️ CORAZÓN LATINO - THE ARCHITECT'S SOUL
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 750: LATIN RESURRECTION - EL BROCHE DE ORO
 * 
 * CONCEPTO:
 * La esencia de la música latina no es solo el ritmo, es la PASIÓN.
 * Un latido caliente que nace del centro y se expande hacia el público.
 * 
 * MECÁNICA VISUAL:
 * 
 * 1. EL LATIDO (Heartbeat) - BACK PARS
 *    - Doble latido: DUM-dum... DUM-dum...
 *    - Color: Rojo Sangre Profundo pulsando a Rojo Vivo
 *    - El corazón del escenario, donde nace la pasión
 * 
 * 2. LA EXPANSIÓN (The Heat) - MOVERS
 *    - En cada latido fuerte, barrido lento hacia afuera
 *    - Color: Ámbar/Oro - como el calor que sale hacia el público
 *    - "Abriendo los brazos" al público
 * 
 * 3. EL DESTELLO (The Spark) - FRONT PARS
 *    - Permanecen tenues durante los latidos
 *    - Blinder cálido (White + Amber) al final del compás 4
 *    - Sincronizado con el platillo imaginario
 * 
 * TIMING:
 * - 4 compases totales (8 beats por compás = 32 beats)
 * - Compás 1-2: Latido 1 (DUM-dum)
 * - Compás 3-4: Latido 2 (DUM-dum) + Blinder final
 * 
 * PERFECT FOR:
 * - Coros épicos
 * - Finales de canción
 * - Momentos de ALTA intensidad emocional
 * - Cuando la música EXPLOTA de pasión
 * 
 * @module core/effects/library/CorazonLatino
 * @version WAVE 750
 * @author The Architect (via Radwulf) - El Alma del Sistema
 */

import { BaseEffect } from '../BaseEffect'
import {
  EffectTriggerConfig,
  EffectFrameOutput,
  EffectCategory,
  EffectZone,
} from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

interface CorazonLatinoConfig {
  /** Duración de un latido completo (DUM-dum) en ms */
  heartbeatDurationMs: number
  
  /** Número de latidos completos */
  heartbeatCount: number
  
  /** Ratio del golpe fuerte vs débil (0.7 = 70% tiempo en DUM) */
  strongBeatRatio: number
  
  /** Color del corazón - Rojo Sangre Profundo */
  heartColorBase: { h: number; s: number; l: number }
  
  /** Color del corazón en el pico - Rojo Vivo */
  heartColorPeak: { h: number; s: number; l: number }
  
  /** Color de la expansión - Ámbar/Oro */
  heatColor: { h: number; s: number; l: number }
  
  /** Color del blinder final - Ámbar cálido */
  blinderColor: { h: number; s: number; l: number }
  
  /** ¿Sincronizar con BPM? */
  bpmSync: boolean
  
  /** Beats por latido completo (DUM-dum) */
  beatsPerHeartbeat: number
  
  /** Amplitud del movimiento de expansión (normalizado 0-1) */
  expansionAmplitude: number
}

const DEFAULT_CONFIG: CorazonLatinoConfig = {
  heartbeatDurationMs: 1500,   // 1.5 segundos por DUM-dum
  heartbeatCount: 2,            // 🔥 WAVE 770: 2 latidos = ~3-4 segundos (doble intenso DUM-dum DUM-dum ¡FUERA!)
  strongBeatRatio: 0.65,        // 65% del tiempo en el golpe fuerte
  
  // ❤️ Rojo Sangre Profundo (base)
  heartColorBase: { h: 350, s: 100, l: 35 },
  
  // ❤️ Rojo Vivo (pico)
  heartColorPeak: { h: 0, s: 100, l: 55 },
  
  // 🌟 SUPER DORADO (expansión) - WAVE 805.6
  heatColor: { h: 45, s: 90, l: 60 },
  
  // ✨ SUPER DORADO (blinder) - WAVE 805.6
  blinderColor: { h: 45, s: 90, l: 60 },
  
  bpmSync: true,
  beatsPerHeartbeat: 4,         // 4 beats = 1 DUM-dum
  expansionAmplitude: 0.8,      // 80% de movimiento máximo
}

// ═══════════════════════════════════════════════════════════════════════════
// CORAZÓN LATINO CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class CorazonLatino extends BaseEffect {
  readonly effectType = 'corazon_latino'
  readonly name = 'Corazón Latino'
  readonly category: EffectCategory = 'physical'
  readonly priority = 85  // Alta prioridad - es épico
  readonly mixBus = 'global' as const  // 🚂 WAVE 800: Dictador - corazón necesita sus colores
  
  private config: CorazonLatinoConfig
  private currentHeartbeat = 0
  private heartbeatPhase: 'strong' | 'weak' | 'rest' = 'rest'
  private phaseTimer = 0
  private actualHeartbeatDurationMs = 1500
  private totalDurationMs = 6000  // 🔥 WAVE 750: Total duration calculada
  
  // ❤️ State del corazón
  private heartIntensity = 0
  private currentHeartColor: { h: number; s: number; l: number }
  
  // 🌟 State de expansión (movers)
  private expansionProgress = 0
  private moverPanOffset = 0
  
  // ✨ State del blinder
  private blinderIntensity = 0
  
  constructor(config?: Partial<CorazonLatinoConfig>) {
    super('corazon_latino')
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.currentHeartColor = { ...this.config.heartColorBase }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect implementation
  // ─────────────────────────────────────────────────────────────────────────
  
  trigger(config: EffectTriggerConfig): void {
    super.trigger(config)
    
    // Reset state
    this.currentHeartbeat = 0
    this.heartbeatPhase = 'strong'
    this.phaseTimer = 0
    this.heartIntensity = 0
    this.expansionProgress = 0
    this.moverPanOffset = 0
    this.blinderIntensity = 0
    
    // Calcular duración basada en BPM
    this.calculateHeartbeatDuration()
    
    console.log(`[CorazonLatino ❤️] TRIGGERED! HeartbeatDuration=${this.actualHeartbeatDurationMs}ms Beats=${this.config.heartbeatCount}`)
    console.log(`[CorazonLatino ❤️] THE ARCHITECT'S SOUL AWAKENS...`)
  }
  
  private calculateHeartbeatDuration(): void {
    if (this.config.bpmSync && this.musicalContext?.bpm) {
      const msPerBeat = 60000 / this.musicalContext.bpm
      this.actualHeartbeatDurationMs = msPerBeat * this.config.beatsPerHeartbeat
    } else {
      this.actualHeartbeatDurationMs = this.config.heartbeatDurationMs
    }
    
    // Calcular duración total
    this.totalDurationMs = this.actualHeartbeatDurationMs * this.config.heartbeatCount
    
    // 🔥 WAVE 770: MAX DURATION de seguridad - 4 segundos máximo
    // Evita que BPMs bajos (60bpm) creen duraciones extremas (16s)
    const MAX_DURATION_MS = 4000
    if (this.totalDurationMs > MAX_DURATION_MS) {
      const scaleFactor = MAX_DURATION_MS / this.totalDurationMs
      this.actualHeartbeatDurationMs *= scaleFactor
      this.totalDurationMs = MAX_DURATION_MS
      console.log(`[CorazonLatino ❤️] WAVE 770: Duration capped to ${MAX_DURATION_MS}ms (BPM too slow)`)
    }
  }
  
  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    
    this.elapsedMs += deltaMs
    this.phaseTimer += deltaMs
    
    // Calcular duración de cada fase del latido
    const strongDuration = this.actualHeartbeatDurationMs * this.config.strongBeatRatio
    const weakDuration = this.actualHeartbeatDurationMs * (1 - this.config.strongBeatRatio) * 0.6
    const restDuration = this.actualHeartbeatDurationMs * (1 - this.config.strongBeatRatio) * 0.4
    
    // State machine del latido
    switch (this.heartbeatPhase) {
      case 'strong':
        this.updateStrongBeat(strongDuration)
        if (this.phaseTimer >= strongDuration) {
          this.heartbeatPhase = 'weak'
          this.phaseTimer = 0
        }
        break
        
      case 'weak':
        this.updateWeakBeat(weakDuration)
        if (this.phaseTimer >= weakDuration) {
          this.heartbeatPhase = 'rest'
          this.phaseTimer = 0
        }
        break
        
      case 'rest':
        this.updateRest(restDuration)
        if (this.phaseTimer >= restDuration) {
          // Siguiente latido
          this.currentHeartbeat++
          
          if (this.currentHeartbeat >= this.config.heartbeatCount) {
            this.phase = 'finished'
            console.log(`[CorazonLatino ❤️] Completed (${this.config.heartbeatCount} heartbeats, ${this.elapsedMs}ms)`)
            console.log(`[CorazonLatino ❤️] THE PASSION FADES... BUT NEVER DIES.`)
            return
          }
          
          this.heartbeatPhase = 'strong'
          this.phaseTimer = 0
        }
        break
    }
    
    // Actualizar blinder (solo en el último latido)
    this.updateBlinder()
    
    // Actualizar color del corazón basado en intensidad
    this.updateHeartColor()
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Heartbeat Physics
  // ─────────────────────────────────────────────────────────────────────────
  
  private updateStrongBeat(duration: number): void {
    const progress = Math.min(1, this.phaseTimer / duration)
    
    // DUM! - Golpe fuerte con attack rápido y decay lento
    // Curva: exponential attack (0→peak rápido) + linear decay
    if (progress < 0.2) {
      // Attack: 0→1 en 20% del tiempo
      this.heartIntensity = Math.pow(progress / 0.2, 0.5)  // sqrt para attack explosivo
    } else {
      // Decay: 1→0.3 en 80% del tiempo
      const decayProgress = (progress - 0.2) / 0.8
      this.heartIntensity = 1 - (decayProgress * 0.7)  // No baja de 0.3
    }
    
    // Expansión de los movers (abren en el DUM)
    this.expansionProgress = this.heartIntensity * this.config.expansionAmplitude
    this.moverPanOffset = this.expansionProgress  // Pan hacia afuera
  }
  
  private updateWeakBeat(duration: number): void {
    const progress = Math.min(1, this.phaseTimer / duration)
    
    // dum - Golpe débil, más suave
    if (progress < 0.15) {
      // Attack más suave
      this.heartIntensity = 0.3 + (Math.pow(progress / 0.15, 0.7) * 0.4)  // 0.3→0.7
    } else {
      // Decay
      const decayProgress = (progress - 0.15) / 0.85
      this.heartIntensity = 0.7 - (decayProgress * 0.5)  // 0.7→0.2
    }
    
    // Los movers empiezan a volver
    this.moverPanOffset = this.expansionProgress * (1 - progress * 0.5)
  }
  
  private updateRest(duration: number): void {
    const progress = Math.min(1, this.phaseTimer / duration)
    
    // Silencio entre latidos
    this.heartIntensity = Math.max(0.1, this.heartIntensity * (1 - progress))
    
    // Los movers vuelven a centro
    this.moverPanOffset = this.moverPanOffset * (1 - progress)
  }
  
  private updateBlinder(): void {
    // El blinder solo aparece en el ÚLTIMO latido, al final
    const isLastHeartbeat = this.currentHeartbeat === this.config.heartbeatCount - 1
    const progressInEffect = this.elapsedMs / this.totalDurationMs
    
    if (isLastHeartbeat && progressInEffect > 0.85) {
      // ¡BLINDER FINAL!
      const blinderProgress = (progressInEffect - 0.85) / 0.15  // 0→1 en el último 15%
      
      // Attack explosivo
      if (blinderProgress < 0.3) {
        this.blinderIntensity = Math.pow(blinderProgress / 0.3, 0.5)  // sqrt para explosión
      } else {
        // Mantener y decay suave
        this.blinderIntensity = 1 - ((blinderProgress - 0.3) / 0.7) * 0.3  // 1→0.7
      }
    } else {
      // Front tenue durante los latidos
      this.blinderIntensity = 0.1
    }
  }
  
  private updateHeartColor(): void {
    // Interpolar entre base (oscuro) y peak (vivo) según intensidad
    const t = this.heartIntensity
    
    this.currentHeartColor = {
      h: this.config.heartColorBase.h + (this.config.heartColorPeak.h - this.config.heartColorBase.h) * t,
      s: this.config.heartColorBase.s + (this.config.heartColorPeak.s - this.config.heartColorBase.s) * t,
      l: this.config.heartColorBase.l + (this.config.heartColorPeak.l - this.config.heartColorBase.l) * t,
    }
    
    // Normalizar hue (puede ser negativo si va de 350→0)
    if (this.currentHeartColor.h < 0) this.currentHeartColor.h += 360
    this.currentHeartColor.h = this.currentHeartColor.h % 360
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Output
  // ─────────────────────────────────────────────────────────────────────────
  
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null
    
    // ❤️ BACK - EL CORAZÓN (Rojo pulsante)
    const backOverride = {
      color: this.currentHeartColor,
      dimmer: this.heartIntensity,
    }
    
    // 🌟 MOVERS - LA EXPANSIÓN (Ámbar/Oro, abriendo brazos)
    const moverOverride = {
      color: this.config.heatColor,
      dimmer: this.heartIntensity * 0.8,  // Un poco menos que el corazón
      movement: {
        pan: this.moverPanOffset,   // Abre hacia afuera en cada DUM
        tilt: -0.2,                  // Tilt ligeramente hacia arriba
        isAbsolute: false,           // Offset sobre el movimiento base
        speed: 0.6,                  // Velocidad media (orgánico, no mecánico)
      },
    }
    
    // ✨ FRONT - EL DESTELLO (Tenue→Blinder al final)
    const isBlinding = this.blinderIntensity > 0.5
    const frontOverride = {
      color: this.config.blinderColor,
      dimmer: this.blinderIntensity,
      white: isBlinding ? this.blinderIntensity * 0.6 : undefined,  // White solo en blinder
      amber: isBlinding ? this.blinderIntensity * 0.4 : undefined,  // Amber para calidez
    }
    
    // 🎨 WAVE 750/780: zoneOverrides - ARQUITECTURA PURA + SMART BLEND
    const zoneOverrides = {
      'back': { ...backOverride, blendMode: 'max' as const },
      'movers': { ...moverOverride, blendMode: 'max' as const },
      'front': { ...frontOverride, blendMode: 'max' as const },
    }
    
    return {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress: this.elapsedMs / this.totalDurationMs,
      
      // 🔥 WAVE 740: zones derivado de zoneOverrides
      zones: Object.keys(zoneOverrides) as EffectZone[],
      intensity: this.heartIntensity,
      
      // 🔥 WAVE 740: Legacy DEPRECATED
      dimmerOverride: undefined,
      colorOverride: undefined,
      
      globalOverride: false,
      
      // ❤️ WAVE 750: EL CORAZÓN LATE
      zoneOverrides,
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════

export function createCorazonLatino(config?: Partial<CorazonLatinoConfig>): CorazonLatino {
  return new CorazonLatino(config)
}
