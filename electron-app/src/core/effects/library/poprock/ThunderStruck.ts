/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ THUNDER_STRUCK - EL BLINDER DE ESTADIO
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 1019: ROCK LEGENDS ARSENAL - "ANALOG POWER"
 * 
 * CONCEPTO:
 * El clásico golpe de luz que ciega al público en el "Drop" del estribillo.
 * Pura energía bruta de concierto de rock.
 * 
 * COMPORTAMIENTO FÍSICO:
 * - Back Pars: Se disparan al 100% (FLASH) cuando detectan golpes fuertes
 * - Front Pars: Acompañan en síncopa
 * - Movers: ESTÁTICOS, Tilt Abajo hacia el público
 * - No queremos que se muevan, queremos que IMPACTEN
 * 
 * FILOSOFÍA:
 * - Calor: Tungsteno, Ámbar, Blanco Cálido
 * - Trigger: Alta energía (Energy > 0.8) pasado desde el selector
 * - La música dicta el efecto, no la etiqueta
 * 
 * COLORES:
 * - Blanco Cálido (3200K) dominante
 * - Ámbar como sustain
 * 
 * @module core/effects/library/poprock/ThunderStruck
 * @version WAVE 1019 - ROCK LEGENDS ARSENAL
 */

import { BaseEffect } from '../../BaseEffect'
import {
  EffectTriggerConfig,
  EffectFrameOutput,
  EffectCategory,
  EffectZone,
} from '../../types'

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

interface ThunderStruckConfig {
  /** Duración total del flash (ms) */
  flashDurationMs: number
  
  /** Número de flashes (para multi-flash) */
  flashCount: number
  
  /** ¿BPM-synced? */
  bpmSync: boolean
  
  /** Beats por flash (si bpmSync=true) */
  beatsPerFlash: number
  
  /** Color base - Blanco Cálido 3200K */
  warmWhiteColor: { h: number; s: number; l: number }
  
  /** Color sustain - Ámbar */
  amberColor: { h: number; s: number; l: number }
  
  /** Tilt de los movers (hacia abajo, al público) */
  moverTiltDown: number
}

const DEFAULT_CONFIG: ThunderStruckConfig = {
  flashDurationMs: 800,         // Flash corto y brutal
  flashCount: 2,                // Doble golpe: ¡PAM-PAM!
  bpmSync: true,
  beatsPerFlash: 1,             // Un beat por flash
  
  // 💡 Blanco Cálido 3200K (ligeramente ámbar)
  warmWhiteColor: { h: 40, s: 15, l: 95 },
  
  // 🧡 Ámbar cálido (sustain)
  amberColor: { h: 35, s: 85, l: 55 },
  
  // 📐 Tilt hacia abajo (al público)
  moverTiltDown: 0.7,           // 70% hacia abajo
}

// ═══════════════════════════════════════════════════════════════════════════
// ⚡ THUNDER_STRUCK CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class ThunderStruck extends BaseEffect {
  readonly effectType = 'thunder_struck'
  readonly name = 'Thunder Struck'
  readonly category: EffectCategory = 'physical'
  readonly priority = 95  // Alta prioridad - es un BLINDER
  readonly mixBus = 'global' as const  // Dictador - necesita el impacto completo
  
  private config: ThunderStruckConfig
  private currentFlash = 0
  private flashPhase: 'attack' | 'sustain' | 'decay' | 'gap' = 'attack'
  private phaseTimer = 0
  private actualFlashDurationMs = 800
  private totalDurationMs = 2000
  
  // ⚡ State
  private flashIntensity = 0
  private backIntensity = 0
  private frontIntensity = 0
  private currentColor: { h: number; s: number; l: number }
  
  constructor(config?: Partial<ThunderStruckConfig>) {
    super('thunder_struck')
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.currentColor = { ...this.config.warmWhiteColor }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // ILightEffect implementation
  // ─────────────────────────────────────────────────────────────────────────
  
  trigger(config: EffectTriggerConfig): void {
    super.trigger(config)
    
    // Reset state
    this.currentFlash = 0
    this.flashPhase = 'attack'
    this.phaseTimer = 0
    this.flashIntensity = 0
    this.backIntensity = 0
    this.frontIntensity = 0
    
    // Calcular duración basada en BPM
    this.calculateFlashDuration()
    
    console.log(`[ThunderStruck ⚡] TRIGGERED! FlashDuration=${this.actualFlashDurationMs}ms Flashes=${this.config.flashCount}`)
    console.log(`[ThunderStruck ⚡] STADIUM BLINDER ENGAGED!`)
  }
  
  private calculateFlashDuration(): void {
    if (this.config.bpmSync && this.musicalContext?.bpm) {
      const msPerBeat = 60000 / this.musicalContext.bpm
      this.actualFlashDurationMs = msPerBeat * this.config.beatsPerFlash
    } else {
      this.actualFlashDurationMs = this.config.flashDurationMs
    }
    
    // Calcular duración total
    this.totalDurationMs = this.actualFlashDurationMs * this.config.flashCount * 1.5  // 1.5x para gaps
    
    // MAX DURATION de seguridad
    const MAX_DURATION_MS = 3000
    if (this.totalDurationMs > MAX_DURATION_MS) {
      const scaleFactor = MAX_DURATION_MS / this.totalDurationMs
      this.actualFlashDurationMs *= scaleFactor
      this.totalDurationMs = MAX_DURATION_MS
    }
  }
  
  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    
    this.elapsedMs += deltaMs
    this.phaseTimer += deltaMs
    
    // Duraciones de cada fase del flash
    const attackDuration = this.actualFlashDurationMs * 0.1    // 10% attack BRUTAL
    const sustainDuration = this.actualFlashDurationMs * 0.4   // 40% sustain
    const decayDuration = this.actualFlashDurationMs * 0.3     // 30% decay
    const gapDuration = this.actualFlashDurationMs * 0.2       // 20% gap entre flashes
    
    // State machine del flash
    switch (this.flashPhase) {
      case 'attack':
        this.updateAttack(attackDuration)
        if (this.phaseTimer >= attackDuration) {
          this.flashPhase = 'sustain'
          this.phaseTimer = 0
        }
        break
        
      case 'sustain':
        this.updateSustain(sustainDuration)
        if (this.phaseTimer >= sustainDuration) {
          this.flashPhase = 'decay'
          this.phaseTimer = 0
        }
        break
        
      case 'decay':
        this.updateDecay(decayDuration)
        if (this.phaseTimer >= decayDuration) {
          this.flashPhase = 'gap'
          this.phaseTimer = 0
        }
        break
        
      case 'gap':
        this.flashIntensity = 0.05  // Casi apagado
        this.backIntensity = 0.05
        this.frontIntensity = 0.02
        
        if (this.phaseTimer >= gapDuration) {
          this.currentFlash++
          
          if (this.currentFlash >= this.config.flashCount) {
            this.phase = 'finished'
            console.log(`[ThunderStruck ⚡] IMPACT COMPLETE (${this.config.flashCount} flashes, ${this.elapsedMs}ms)`)
            return
          }
          
          this.flashPhase = 'attack'
          this.phaseTimer = 0
        }
        break
    }
    
    // Actualizar color (transición WarmWhite → Amber en decay)
    this.updateColor()
  }
  
  private updateAttack(duration: number): void {
    const progress = Math.min(1, this.phaseTimer / duration)
    
    // ⚡ ATTACK BRUTAL - Exponencial inverso para explosión instantánea
    this.flashIntensity = Math.pow(progress, 0.3)  // Casi instantáneo
    
    // Back Pars: DISPARO PRINCIPAL (100%)
    this.backIntensity = this.flashIntensity
    
    // Front Pars: Síncopa (ligeramente retrasado, 85%)
    this.frontIntensity = Math.max(0, this.flashIntensity - 0.15)
  }
  
  private updateSustain(duration: number): void {
    const progress = Math.min(1, this.phaseTimer / duration)
    
    // Mantener alto con pequeña oscilación
    this.flashIntensity = 0.95 + Math.sin(progress * Math.PI) * 0.05
    this.backIntensity = this.flashIntensity
    this.frontIntensity = this.flashIntensity * 0.9
  }
  
  private updateDecay(duration: number): void {
    const progress = Math.min(1, this.phaseTimer / duration)
    
    // Decay exponencial (rápido al principio, lento al final)
    const decayCurve = 1 - Math.pow(progress, 0.5)
    this.flashIntensity = decayCurve * 0.95
    this.backIntensity = this.flashIntensity
    this.frontIntensity = this.flashIntensity * 0.8
  }
  
  private updateColor(): void {
    // En attack/sustain: Blanco Cálido
    // En decay: Transición a Ámbar
    if (this.flashPhase === 'decay') {
      const decayProgress = this.phaseTimer / (this.actualFlashDurationMs * 0.3)
      const t = Math.min(1, decayProgress)
      
      this.currentColor = {
        h: this.config.warmWhiteColor.h + (this.config.amberColor.h - this.config.warmWhiteColor.h) * t,
        s: this.config.warmWhiteColor.s + (this.config.amberColor.s - this.config.warmWhiteColor.s) * t,
        l: this.config.warmWhiteColor.l + (this.config.amberColor.l - this.config.warmWhiteColor.l) * t,
      }
    } else {
      this.currentColor = { ...this.config.warmWhiteColor }
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Output
  // ─────────────────────────────────────────────────────────────────────────
  
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null
    
    // ⚡ BACK - DISPARO PRINCIPAL
    const backOverride = {
      color: this.currentColor,
      dimmer: this.backIntensity,
      white: this.flashIntensity > 0.8 ? this.backIntensity * 0.7 : undefined,  // White en el peak
      blendMode: 'max' as const,
    }
    
    // ⚡ FRONT - SÍNCOPA
    const frontOverride = {
      color: this.currentColor,
      dimmer: this.frontIntensity,
      white: this.flashIntensity > 0.8 ? this.frontIntensity * 0.5 : undefined,
      blendMode: 'max' as const,
    }
    
    // ⚡ MOVERS - ESTÁTICOS, APUNTANDO AL PÚBLICO
    // No queremos que se muevan, queremos IMPACTO
    const moverOverride = {
      color: this.config.amberColor,  // Ámbar cálido
      dimmer: this.flashIntensity * 0.6,  // Un poco menos que los PARs
      movement: {
        pan: 0,                              // Centro
        tilt: this.config.moverTiltDown,     // Hacia abajo (al público)
        isAbsolute: true,                    // OVERRIDE TOTAL - no se mueven
        speed: 0.2,                          // Lento (no importa, están fijos)
      },
      blendMode: 'max' as const,
    }
    
    const zoneOverrides = {
      'back': backOverride,
      'front': frontOverride,
      'movers': moverOverride,
    }
    
    return {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress: this.elapsedMs / this.totalDurationMs,
      zones: Object.keys(zoneOverrides) as EffectZone[],
      intensity: this.flashIntensity,
      zoneOverrides,
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════

export function createThunderStruck(config?: Partial<ThunderStruckConfig>): ThunderStruck {
  return new ThunderStruck(config)
}
