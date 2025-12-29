/**
 * 🏛️ WAVE 205: PHYSICS ENGINE
 * 
 * Extracted from main.ts (WAVE 109: Asymmetric Decay Physics)
 * 
 * RESPONSIBILITIES:
 * - Decay buffers management (per-fixture state)
 * - Asymmetric attack/decay physics (PAR vs MOVER)
 * - Hysteresis state for movers
 * - Soft knee clipping to eliminate noise
 * 
 * DOES NOT:
 * - Analyze audio (that's Brain's job)
 * - Know about specific fixtures (that's HAL's job)
 * - Calculate colors (that's Engine's job)
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES (No dependencies on legacy code)
// ═══════════════════════════════════════════════════════════════════════════

/** Type of zone physics to apply */
export type ZonePhysicsType = 'PAR' | 'MOVER'

/** Result from mover intensity calculation with hysteresis */
export interface MoverCalcResult {
  intensity: number
  newState: boolean
}

/** Configuration for physics calculation */
export interface PhysicsConfig {
  decaySpeed: number      // 1=instant, 10=liquid
  moverDecaySpeed?: number  // Separate decay for movers (WAVE 161.5)
}

/** Input for mover target calculation */
export interface MoverTargetInput {
  presetName: string
  melodyThreshold: number
  rawMid: number
  rawBass: number
  rawTreble: number
  moverState: boolean
  isRealSilence: boolean
  isAGCTrap: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// PHYSICS ENGINE CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class PhysicsEngine {
  // Internal state
  private decayBuffers = new Map<string, number>()
  private moverHysteresisState = new Map<string, boolean>()
  
  // Physics constants (from WAVE 109)
  private readonly SMOOTHING_DECAY = 0.75  // 25% decay per frame
  
  constructor() {
    console.log('[PhysicsEngine] 🔧 Initialized (WAVE 205)')
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Apply physics to a target value with decay buffer tracking.
   * Uses asymmetric attack (instant) and decay (gradual).
   * 
   * @param key - Unique identifier for the fixture+zone
   * @param targetValue - Target intensity (0-1)
   * @param decaySpeed - Speed from preset (1=instant, 10=liquid)
   * @param zoneType - PAR for flash physics, MOVER for inertia physics
   */
  public applyDecayWithPhysics(
    key: string,
    targetValue: number,
    decaySpeed: number,
    zoneType: ZonePhysicsType
  ): number {
    const prevValue = this.decayBuffers.get(key) ?? 0
    const newValue = this.applyPhysics(targetValue, prevValue, decaySpeed, zoneType)
    this.decayBuffers.set(key, newValue)
    return newValue
  }
  
  /**
   * Legacy decay function for compatibility.
   * Uses multiplicative decay instead of linear.
   */
  public applyDecay(key: string, targetValue: number, decayRate: number): number {
    const prevValue = this.decayBuffers.get(key) ?? 0
    let newValue: number
    
    if (targetValue > prevValue) {
      // Attack: instant rise
      newValue = targetValue
    } else {
      // Decay: multiplicative falloff
      newValue = Math.max(prevValue * decayRate, targetValue)
    }
    
    this.decayBuffers.set(key, newValue)
    return newValue
  }
  
  /**
   * Calculate mover target with hysteresis.
   * Unified logic for all movers (WAVE 120.2).
   */
  public calculateMoverTarget(input: MoverTargetInput): MoverCalcResult {
    const {
      presetName,
      melodyThreshold,
      rawMid,
      rawBass,
      rawTreble,
      moverState,
      isRealSilence,
      isAGCTrap
    } = input
    
    // A. SILENCIO TOTAL o AGC TRAP: Reset completo
    if (isRealSilence || isAGCTrap) {
      return { intensity: 0, newState: false }
    }
    
    // B. DETECTAR SI ES GÉNERO DENSO (Techno/Latino/Pop)
    const isHighDensity = presetName.includes('Techno') || 
                          presetName.includes('Fiesta') ||
                          presetName.includes('Latino') ||
                          presetName.includes('Pop')
    
    // C. MASKING (Solo para Dubstep/Chill)
    let bassMasking = 0
    if (!isHighDensity) {
      bassMasking = Math.min(0.2, rawBass * 0.25)
    }
    
    // D. SEÑAL MELÓDICA
    const melodySignal = Math.max(rawMid, rawTreble * 0.8)
    
    // E. UMBRALES DINÁMICOS
    const effectiveThreshold = melodyThreshold + bassMasking
    const ON_THRESHOLD = effectiveThreshold + 0.10  // Cuesta encender
    const hystOffset = isHighDensity ? 0.15 : 0.05  // Latino: más histéresis
    const OFF_THRESHOLD = effectiveThreshold - hystOffset
    
    // F. BASS DOMINANCE GATE (Solo para géneros con silencios)
    if (!isHighDensity && rawMid < rawBass * 0.5) {
      return { intensity: 0, newState: false }
    }
    
    let target = 0
    let nextState = moverState
    
    // G. LÓGICA DE HISTÉRESIS UNIFICADA
    if (!moverState) {
      // 🔒 ESTADO: APAGADO - Necesita MUCHA energía para encender
      if (melodySignal > ON_THRESHOLD) {
        nextState = true
        target = (melodySignal - effectiveThreshold) / (1 - effectiveThreshold)
      }
    } else {
      // 💡 ESTADO: ENCENDIDO - Se mantiene hasta que la energía muera
      if (melodySignal > OFF_THRESHOLD) {
        target = (melodySignal - effectiveThreshold) / (1 - effectiveThreshold)
      } else {
        nextState = false
        target = 0
      }
    }
    
    // H. SOLIDITY ENHANCEMENT (WAVE 121 + 160.5)
    if (target > 0 && target < 0.12) {
      target = 0  // Si es basura real, mátalo
    }
    
    if (target >= 0.12) {
      // 1. CONFIDENCE BOOST: +15% extra
      target = target * 1.15
      
      // 2. SOLID FLOOR: Nunca menos del 35%
      target = Math.max(0.35, target)
    }
    
    // I. CLIPPER FINAL
    target = this.applySoftKneeClipper(target)
    
    // J. NAN PROTECTION Y CLAMP
    return {
      intensity: Math.min(1, Math.max(0, target || 0)),
      newState: nextState
    }
  }
  
  /**
   * Get mover hysteresis state.
   */
  public getMoverHysteresisState(key: string): boolean {
    return this.moverHysteresisState.get(key) ?? false
  }
  
  /**
   * Set mover hysteresis state.
   */
  public setMoverHysteresisState(key: string, state: boolean): void {
    this.moverHysteresisState.set(key, state)
  }
  
  /**
   * Soft knee clipper to eliminate noise.
   * Values below 0.15 are considered noise.
   */
  public applySoftKneeClipper(value: number): number {
    // Noise gate: below 0.15 = 0
    if (value < 0.15) return 0
    
    // Soft knee: 0.15-0.25 range gets compressed
    if (value < 0.25) {
      // Remap 0.15-0.25 to 0-0.25 with soft curve
      const normalized = (value - 0.15) / 0.10
      return normalized * 0.25
    }
    
    return value
  }
  
  /**
   * Reset all state (for system restart).
   */
  public reset(): void {
    this.decayBuffers.clear()
    this.moverHysteresisState.clear()
    console.log('[PhysicsEngine] 🔄 State reset')
  }
  
  /**
   * Get current buffer value for debugging.
   */
  public getBufferValue(key: string): number {
    return this.decayBuffers.get(key) ?? 0
  }
  
  /**
   * Force set a buffer value (for blackout).
   */
  public setBufferValue(key: string, value: number): void {
    this.decayBuffers.set(key, value)
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Core physics calculation (WAVE 109: Asymmetric Physics).
   * Attack is always instant, decay varies by zone type.
   */
  private applyPhysics(
    target: number,
    current: number,
    decaySpeed: number,
    zoneType: ZonePhysicsType
  ): number {
    // A. ATTACK (Subida): Siempre instantáneo para mantener sync musical
    if (target >= current) {
      return target
    }
    
    // B. DECAY (Bajada): Asimétrico según zoneType
    let dropRate: number
    
    if (zoneType === 'PAR') {
      // FLASH PHYSICS: Caída rápida pero no instantánea
      // Rango: 0.10 a 0.40 por frame
      // decaySpeed 1 → dropRate 0.40 (corte seco Latino)
      // decaySpeed 10 → dropRate 0.04 (respiro Chill)
      dropRate = 0.40 / decaySpeed
    } else {
      // INERTIA PHYSICS: Caída suave como humo
      // Rango: 0.01 a 0.10 por frame
      // decaySpeed 1 → dropRate 0.10 (respuesta rápida)
      // decaySpeed 10 → dropRate 0.01 (líquido total)
      dropRate = 0.10 / decaySpeed
    }
    
    // Aplicar Linear Decay (resta, no multiplicación)
    const nextValue = current - dropRate
    return Math.max(0, nextValue)
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════════════
  
  public destroy(): void {
    this.reset()
    console.log('[PhysicsEngine] 🛑 Destroyed')
  }
}

// Export singleton for easy use (optional)
export const physicsEngine = new PhysicsEngine()
