/**
 * ⚡ EFFECTS ENGINE
 * Gestiona efectos especiales: strobe, blinder, smoke, etc.
 * 
 * - Activación automática por detección de drops/builds
 * - Timing inteligente basado en estructura musical
 * - Safeguards integrados (no strobe más de X segundos)
 */

import type {
  EffectId,
  AudioMetrics,
} from '../../types'
import type { BeatState } from '../audio/BeatDetector'

/**
 * Output del EffectsEngine
 */
export interface EffectsOutput {
  strobe: boolean
  strobeSpeed: number      // 0-1
  blinder: boolean
  blinderIntensity: number // 0-1
  smoke: boolean
  smokeAmount: number      // 0-1
  laser: boolean
  laserPattern: number     // 0-255 (DMX)
}

/**
 * Estado interno del engine
 */
interface InternalEffectsState {
  strobe: { enabled: boolean; intensity: number; speed: number }
  blinder: { enabled: boolean; intensity: number }
  smoke: { enabled: boolean; amount: number }
  laser: { enabled: boolean; pattern: number }
  autoTrigger: boolean
}

/**
 * Configuración de seguridad para efectos
 */
interface SafetyConfig {
  maxStrobeDuration: number  // ms
  strobeCooldown: number     // ms
  maxBlinderDuration: number // ms
  blinderCooldown: number    // ms
  smokeBurstDuration: number // ms
  smokeCooldown: number      // ms
}

const DEFAULT_SAFETY: SafetyConfig = {
  maxStrobeDuration: 5000,   // 5 segundos máximo de strobe
  strobeCooldown: 10000,     // 10 segundos de cooldown
  maxBlinderDuration: 2000,  // 2 segundos máximo de blinder
  blinderCooldown: 15000,    // 15 segundos de cooldown
  smokeBurstDuration: 3000,  // 3 segundos de humo
  smokeCooldown: 30000,      // 30 segundos de cooldown
}

/**
 * ⚡ EffectsEngine
 */
export class EffectsEngine {
  private state: InternalEffectsState
  private safety: SafetyConfig
  
  // Timing de seguridad
  private strobeActiveTime = 0
  private strobeLastUsed = 0
  private blinderActiveTime = 0
  private blinderLastUsed = 0
  private smokeLastUsed = 0
  
  // Detección de builds/drops
  private energyHistory: number[] = []
  private readonly historyLength = 30 // ~0.5 segundos a 60fps
  
  constructor(safety: Partial<SafetyConfig> = {}) {
    this.safety = { ...DEFAULT_SAFETY, ...safety }
    
    this.state = {
      strobe: { enabled: false, intensity: 0.5, speed: 0.5 },
      blinder: { enabled: false, intensity: 1.0 },
      smoke: { enabled: false, amount: 0.5 },
      laser: { enabled: false, pattern: 0 },
      autoTrigger: true, // Auto-activar en drops
    }
  }
  
  /**
   * Procesar frame y calcular efectos
   */
  process(
    metrics: AudioMetrics,
    beatState: BeatState,
    now: number = Date.now()
  ): EffectsOutput {
    // Actualizar historial de energía
    this.energyHistory.push(metrics.energy)
    if (this.energyHistory.length > this.historyLength) {
      this.energyHistory.shift()
    }
    
    const output: EffectsOutput = {
      strobe: false,
      strobeSpeed: 0,
      blinder: false,
      blinderIntensity: 0,
      smoke: false,
      smokeAmount: 0,
      laser: false,
      laserPattern: 0,
    }
    
    // Auto-trigger basado en estructura musical
    if (this.state.autoTrigger) {
      this.autoTriggerEffects(metrics, beatState, now)
    }
    
    // === STROBE ===
    if (this.state.strobe.enabled) {
      const canStrobe = this.checkSafety('strobe', now)
      if (canStrobe) {
        output.strobe = true
        output.strobeSpeed = this.state.strobe.speed
        this.strobeActiveTime += 16 // Asumiendo 60fps
      } else {
        // Forzar desactivación por seguridad
        this.state.strobe.enabled = false
        this.strobeLastUsed = now
        this.strobeActiveTime = 0
      }
    }
    
    // === BLINDER ===
    if (this.state.blinder.enabled) {
      const canBlinder = this.checkSafety('blinder', now)
      if (canBlinder) {
        output.blinder = true
        output.blinderIntensity = this.state.blinder.intensity
        this.blinderActiveTime += 16
      } else {
        this.state.blinder.enabled = false
        this.blinderLastUsed = now
        this.blinderActiveTime = 0
      }
    }
    
    // === SMOKE ===
    if (this.state.smoke.enabled) {
      const canSmoke = now - this.smokeLastUsed > this.safety.smokeCooldown
      if (canSmoke) {
        output.smoke = true
        output.smokeAmount = this.state.smoke.amount
        // Smoke se auto-desactiva después de burst
        setTimeout(() => {
          this.state.smoke.enabled = false
          this.smokeLastUsed = Date.now()
        }, this.safety.smokeBurstDuration)
      } else {
        this.state.smoke.enabled = false
      }
    }
    
    // === LASER ===
    if (this.state.laser.enabled) {
      output.laser = true
      output.laserPattern = this.state.laser.pattern
    }
    
    return output
  }
  
  /**
   * Verificar seguridad de efecto
   */
  private checkSafety(effect: 'strobe' | 'blinder', now: number): boolean {
    if (effect === 'strobe') {
      const withinDuration = this.strobeActiveTime < this.safety.maxStrobeDuration
      const pastCooldown = now - this.strobeLastUsed > this.safety.strobeCooldown
      return withinDuration && (this.strobeActiveTime > 0 || pastCooldown)
    }
    
    if (effect === 'blinder') {
      const withinDuration = this.blinderActiveTime < this.safety.maxBlinderDuration
      const pastCooldown = now - this.blinderLastUsed > this.safety.blinderCooldown
      return withinDuration && (this.blinderActiveTime > 0 || pastCooldown)
    }
    
    return true
  }
  
  /**
   * Auto-trigger de efectos basado en estructura musical
   */
  private autoTriggerEffects(
    metrics: AudioMetrics,
    beatState: BeatState,
    now: number
  ): void {
    // Detectar DROP (subida brusca de energía)
    const avgEnergy = this.energyHistory.length > 0
      ? this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length
      : 0
    
    const isDropping = metrics.energy > avgEnergy * 1.5 && metrics.energy > 0.7
    
    // Strobe en drops intensos
    if (isDropping && beatState.onBeat && metrics.bass > 0.8) {
      if (!this.state.strobe.enabled && this.checkSafety('strobe', now)) {
        this.state.strobe.enabled = true
        this.state.strobe.speed = 0.6 + metrics.energy * 0.4
        
        // Auto-desactivar después de unos beats
        setTimeout(() => {
          this.state.strobe.enabled = false
          this.strobeLastUsed = Date.now()
          this.strobeActiveTime = 0
        }, 2000)
      }
    }
    
    // Blinder en momentos de máxima intensidad
    if (metrics.energy > 0.95 && beatState.onBeat && metrics.bass > 0.9) {
      if (!this.state.blinder.enabled && this.checkSafety('blinder', now)) {
        this.state.blinder.enabled = true
        
        // Auto-desactivar rápido
        setTimeout(() => {
          this.state.blinder.enabled = false
          this.blinderLastUsed = Date.now()
          this.blinderActiveTime = 0
        }, 500)
      }
    }
  }
  
  /**
   * Toggle manual de efectos
   */
  toggleEffect(effect: EffectId, enabled?: boolean): void {
    switch (effect) {
      case 'strobe':
        this.state.strobe.enabled = enabled ?? !this.state.strobe.enabled
        if (!this.state.strobe.enabled) {
          this.strobeLastUsed = Date.now()
          this.strobeActiveTime = 0
        }
        break
        
      case 'blinder':
        this.state.blinder.enabled = enabled ?? !this.state.blinder.enabled
        if (!this.state.blinder.enabled) {
          this.blinderLastUsed = Date.now()
          this.blinderActiveTime = 0
        }
        break
        
      case 'smoke':
        this.state.smoke.enabled = enabled ?? !this.state.smoke.enabled
        break
        
      case 'laser':
        this.state.laser.enabled = enabled ?? !this.state.laser.enabled
        break
    }
  }
  
  /**
   * Setters
   */
  setStrobeSpeed(speed: number): void {
    this.state.strobe.speed = Math.max(0, Math.min(1, speed))
  }
  
  setStrobeIntensity(intensity: number): void {
    this.state.strobe.intensity = Math.max(0, Math.min(1, intensity))
  }
  
  setBlinderIntensity(intensity: number): void {
    this.state.blinder.intensity = Math.max(0, Math.min(1, intensity))
  }
  
  setSmokeAmount(amount: number): void {
    this.state.smoke.amount = Math.max(0, Math.min(1, amount))
  }
  
  setLaserPattern(pattern: number): void {
    this.state.laser.pattern = Math.max(0, Math.min(255, pattern))
  }
  
  setAutoTrigger(enabled: boolean): void {
    this.state.autoTrigger = enabled
  }
  
  /**
   * Obtener estado
   */
  getState(): InternalEffectsState {
    return JSON.parse(JSON.stringify(this.state))
  }
}
