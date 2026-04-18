/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔫 GATLING RAID - THE MACHINE GUN
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🔥 WAVE 930: THE ARSENAL
 * 
 * FILOSOFÍA:
 * No disparamos a "zonas". Disparamos a INDIVIDUOS.
 * Cada PAR es un cañón. Cada MOVER es un francotirador.
 * La ráfaga barre de izquierda a derecha como una ametralladora.
 * 
 * COMPORTAMIENTO:
 * - MixBus: 'global' (DICTADOR - necesita el negro entre disparos)
 * - Patrón: Secuencia L→C→R repetida a velocidad de metralleta
 * - Timing: 1/16 o 1/32 de nota (snare roll territory)
 * - Cada "bala" es un flash de 20-30ms en UN solo fixture
 * 
 * USO IDEAL:
 * - Snare rolls ("trrrraaa")
 * - Upswings antes del drop
 * - Hi-hat abierto en techno minimal
 * 
 * COLORES:
 * - Default: Blanco estroboscópico (máxima brutalidad)
 * - High intensity: Rojo alarma
 * - Medium intensity: Amarillo tóxico
 * 
 * TARGETING QUIRÚRGICO:
 * - front_left → front_center → front_right
 * - back_left → back_center → back_right
 * - O mezclado: FL→BR→FC→BL→FR→BC (patrón caótico)
 * 
 * @module core/effects/library/techno/GatlingRaid
 * @version WAVE 930 - THE MACHINE GUN
 */

import { BaseEffect } from '../../BaseEffect'
import { 
  EffectTriggerConfig, 
  EffectFrameOutput, 
  EffectCategory,
  EffectPhase
} from '../../types'

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

interface GatlingRaidConfig {
  /** Número de disparos en la ráfaga */
  bulletCount: number
  
  /** Duración de cada "bala" (ms) - flash individual */
  bulletDurationMs: number
  
  /** Gap entre balas (ms) - el silencio entre disparos */
  bulletGapMs: number
  
  /** Número de barridos completos L→R */
  sweepCount: number
  
  /** Patrón de disparo */
  pattern: 'linear' | 'zigzag' | 'chaos'
  
  /** 🌊 WAVE 1090: Fade in (ms) */
  fadeInMs: number
  
  /** 🌊 WAVE 1090: Fade out (ms) */
  fadeOutMs: number
}

const DEFAULT_CONFIG: GatlingRaidConfig = {
  bulletCount: 6,            // 6 posiciones (3 front + 3 back)
  bulletDurationMs: 30,      // 🔫 WAVE 930.4: 30ms por bala (was 25ms) - más visible
  bulletGapMs: 35,           // 🔫 WAVE 930.4: 35ms entre balas (was 40ms) - más rápido
  sweepCount: 3,             // 🔫 WAVE 930.4: 3 barridos completos (was 2) - más ametralladora
  pattern: 'linear',         // L→C→R default
  fadeInMs: 0,               // 🌊 WAVE 1090: TECHNO = Ataque instantáneo
  fadeOutMs: 200,            // 🌊 WAVE 1090: Salida corta
}

// Posiciones del rig (orden de disparo)
const LINEAR_SEQUENCE = [
  'front_left', 'front_center', 'front_right',
  'back_left', 'back_center', 'back_right'
] as const

const ZIGZAG_SEQUENCE = [
  'front_left', 'back_right', 'front_center',
  'back_left', 'front_right', 'back_center'
] as const

const CHAOS_SEQUENCE = [
  'back_center', 'front_left', 'back_right',
  'front_center', 'back_left', 'front_right'
] as const

type FixturePosition = typeof LINEAR_SEQUENCE[number]

// ═══════════════════════════════════════════════════════════════════════════
// 🔫 GATLING RAID CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class GatlingRaid extends BaseEffect {
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect properties
  // ─────────────────────────────────────────────────────────────────────────
  
  readonly effectType = 'gatling_raid'
  readonly name = 'Gatling Raid'
  readonly category: EffectCategory = 'physical'
  readonly priority = 92  // Alta pero menor que industrial_strobe
  readonly mixBus = 'global' as const  // 🚂 DICTADOR - necesita negro entre balas
  readonly isOneShot = true  // 🎯 WAVE 2067: Ráfaga única — NO re-trigger
  
  // ─────────────────────────────────────────────────────────────────────────
  // Internal state
  // ─────────────────────────────────────────────────────────────────────────
  
  private config: GatlingRaidConfig
  private currentBullet = 0          // Índice del disparo actual
  private currentSweep = 0           // Barrido actual (0 to sweepCount-1)
  private bulletTimer = 0            // Timer dentro del ciclo bala+gap
  private totalDurationMs = 0
  private sequence: readonly FixturePosition[] = LINEAR_SEQUENCE
  private isFlashOn = false
  
  // Color calculado (blanco por defecto, pero puede cambiar según intensity)
  private bulletColor: { h: number; s: number; l: number } = { h: 180, s: 100, l: 50 }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────
  
  constructor(config?: Partial<GatlingRaidConfig>) {
    super('gatling_raid')
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.calculateTotalDuration()
  }
  
  private calculateTotalDuration(): void {
    const bulletsPerSweep = this.config.bulletCount
    const bulletCycleMs = this.config.bulletDurationMs + this.config.bulletGapMs
    this.totalDurationMs = bulletsPerSweep * bulletCycleMs * this.config.sweepCount
  }
  
  private selectSequence(): void {
    switch (this.config.pattern) {
      case 'zigzag':
        this.sequence = ZIGZAG_SEQUENCE
        break
      case 'chaos':
        this.sequence = CHAOS_SEQUENCE
        break
      default:
        this.sequence = LINEAR_SEQUENCE
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect implementation
  // ─────────────────────────────────────────────────────────────────────────
  
  trigger(config: EffectTriggerConfig): void {
    super.trigger(config)
    
    // GatlingRaid afecta todo el escenario pero dispara uno a uno
    this.zones = ['front', 'back']
    
    // Reset state
    this.currentBullet = 0
    this.currentSweep = 0
    this.bulletTimer = 0
    this.isFlashOn = true  // Empezar con flash
    
    // Seleccionar secuencia según pattern
    this.selectSequence()
    
    // 🔫 WAVE 3305: CYAN ABSOLUTO — El Gatling dispara en cian puro siempre.
    // PARs flashean en cyan. Movers reciben solo dimmer (HAL Evasion Shield
    // bloquea el color para efectos global, evitando despertar al DarkSpinFilter).
    this.bulletColor = { h: 180, s: 100, l: 50 }  // Cyan puro
    
    console.log(
      `[GatlingRaid 🔫] TRIGGERED: ${this.config.sweepCount} sweeps x ${this.config.bulletCount} bullets | ` +
      `Pattern: ${this.config.pattern}`
    )
  }
  
  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    
    this.elapsedMs += deltaMs
    this.bulletTimer += deltaMs
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🔫 WAVE 2490: CARRY-OVER TEMPORAL — Acumulador con excedente
    //
    // ANTES: bulletTimer = 0 descartaba los ms sobrantes de cada transición.
    //   Con deltaMs=40ms y bulletDurationMs=30ms, se perdían 10ms por ciclo.
    //   18 balas × ~15ms perdidos/ciclo = 270ms extra → efecto 23% más lento.
    //   Con frame-skip (Stampede Guard), deltaMs=80ms+ perdía balas enteras.
    //
    // AHORA: while-loop procesa TODAS las transiciones que caben en el delta.
    //   bulletTimer -= threshold preserva el excedente para la siguiente.
    //   Resultado: timing preciso independiente del framerate.
    //
    // 🩸 WAVE 2492: MINIMUM-1-FRAME VISIBILITY — Balas fantasma eliminadas
    //   PROBLEMA: El while-loop podía consumir un gap Y un flash completo
    //   en la misma iteración. isFlashOn pasaba a true→false sin que
    //   getOutput() la viera → bala INVISIBLE. ~25% de balas se perdían.
    //   FIX: Cuando una transición gap→flash ocurre, el loop ROMPE
    //   inmediatamente. getOutput() SIEMPRE ve isFlashOn=true al menos
    //   1 frame. Los gaps se procesan libremente (no son visuales).
    // ═══════════════════════════════════════════════════════════════════════
    while (this.bulletTimer > 0 && (this.phase as string) !== 'finished') {
      if (this.isFlashOn) {
        if (this.bulletTimer >= this.config.bulletDurationMs) {
          this.bulletTimer -= this.config.bulletDurationMs
          this.isFlashOn = false
        } else {
          break
        }
      } else {
        if (this.bulletTimer >= this.config.bulletGapMs) {
          this.bulletTimer -= this.config.bulletGapMs
          this.isFlashOn = true
          this.currentBullet++
          
          // Check sweep completion
          if (this.currentBullet >= this.config.bulletCount) {
            this.currentBullet = 0
            this.currentSweep++
            
            if (this.currentSweep >= this.config.sweepCount) {
              this.phase = 'finished'
              console.log(`[GatlingRaid 🔫] FINISHED (${this.elapsedMs}ms)`)
              return
            }
          }
          
          // 🩸 WAVE 2492: STOP HERE — let getOutput() see this flash
          // The remaining bulletTimer will be processed next frame.
          // Without this break, the loop continues and may consume the
          // entire flash duration → isFlashOn goes back to false →
          // invisible bullet. One frame of visibility is non-negotiable.
          break
        } else {
          break
        }
      }
    }
  }
  
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null
    
    const progress = Math.min(1, this.elapsedMs / this.totalDurationMs)
    const targetPosition = this.sequence[this.currentBullet]
    
    // 🌊 WAVE 1090: FLUID DYNAMICS
    let fadeOpacity = 1.0
    const fadeOutStart = this.totalDurationMs - this.config.fadeOutMs
    if (this.config.fadeInMs > 0 && this.elapsedMs < this.config.fadeInMs) {
      fadeOpacity = (this.elapsedMs / this.config.fadeInMs) ** 1.5
    } else if (this.config.fadeOutMs > 0 && this.elapsedMs > fadeOutStart) {
      fadeOpacity = ((this.totalDurationMs - this.elapsedMs) / this.config.fadeOutMs) ** 1.5
    }
    
    // Durante el gap: NEGRO TOTAL
    if (!this.isFlashOn) {
      return {
        effectId: this.id,
        category: this.category,
        phase: this.phase,
        progress,
        dimmerOverride: 0,
        colorOverride: { h: 0, s: 0, l: 0 },
        intensity: 0,
        zones: this.zones,
        globalComposition: fadeOpacity  // 🌊 WAVE 1090
      }
    }
    
    // Durante el flash: Usar zoneOverrides para iluminar SOLO el target
    const zoneOverrides: Record<string, { color: { h: number; s: number; l: number }; dimmer: number }> = {}
    
    // Mapear fixture position a zona
    const isTargetFront = targetPosition.startsWith('front')
    const targetZone = isTargetFront ? 'front' : 'back'
    
    // Iluminar solo la zona del target
    zoneOverrides[targetZone] = {
      color: this.bulletColor,
      dimmer: this.triggerIntensity
    }
    
    // La otra zona queda en negro
    const otherZone = isTargetFront ? 'back' : 'front'
    zoneOverrides[otherZone] = {
      color: { h: 0, s: 0, l: 0 },
      dimmer: 0
    }
    
    return {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress,
      dimmerOverride: this.triggerIntensity,
      colorOverride: this.bulletColor,
      intensity: this.triggerIntensity,
      zones: this.zones,
      globalComposition: fadeOpacity,  // 🌊 WAVE 1090
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
// DEFAULT EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export default GatlingRaid
