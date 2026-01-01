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
  presetName?: string  // Optional, no longer used in WAVE 256.7
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
   * 🎚️ WAVE 275: Movers = ALMA MELÓDICA - solo responden a TREBLE (voces, melodías, efectos)
   */
  public calculateMoverTarget(input: MoverTargetInput): MoverCalcResult {
    const {
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
    
    // 🎚️ WAVE 275: Movers = SOLO TREBLE (empujado 1.4x porque agudos tienen menos energía natural)
    // Sin bass, sin mid - esos van a los PARs
    const audioSignal = rawTreble * 1.4
    
    // 🎚️ WAVE 275: Threshold más bajo para activación (los agudos son más sutiles)
    const ACTIVATION_THRESHOLD = 0.10  // Activates at 10% treble signal
    
    let target = 0
    let nextState = moverState
    
    // D. SIMPLE LOGIC: If there's treble, movers respond
    if (audioSignal > ACTIVATION_THRESHOLD) {
      nextState = true
      // Map signal to intensity: 0.10 → 0.2 (minimum visible), 1.0 → 1.0 (max)
      target = 0.2 + (audioSignal - ACTIVATION_THRESHOLD) * 0.8 / (1 - ACTIVATION_THRESHOLD)
    } else {
      // Very low or no treble - 🗡️ WAVE 277: ZERO FLOOR - No grace period, instant off
      // Si no hay treble, los movers MUEREN instantáneamente
      nextState = audioSignal > 0.05  // Slightly lower off threshold for hysteresis
    }
    
    // E. Clamp and return - 🗡️ WAVE 277: Noise gate at 0.05
    const cleanedIntensity = target < 0.05 ? 0 : Math.min(1, target)
    return {
      intensity: cleanedIntensity,
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
   * 
   * 🗡️ WAVE 277: EXPONENTIAL DECAY - Katana cuts, not broom sweeps
   * Multiplicative decay for aggressive falloff + noise gate
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
    
    // B. DECAY (Bajada): 🗡️ WAVE 277 - EXPONENTIAL (multiplicativo)
    // El usuario pidió: "decay 0.75 en vez de 0.9"
    // Exponencial = cada frame mantiene un % del valor anterior
    let decayFactor: number
    
    if (zoneType === 'PAR') {
      // FLASH PHYSICS: Corte agresivo para PARs
      // decaySpeed 1 → factor 0.65 (corte brutal)
      // decaySpeed 10 → factor 0.92 (respiro Chill)
      decayFactor = 0.65 + (decaySpeed - 1) * 0.03  // Range: 0.65 → 0.92
    } else {
      // MOVER PHYSICS: 🗡️ WAVE 277 - Agresivo como el usuario pidió (0.75)
      // decaySpeed 1 → factor 0.70 (katana)
      // decaySpeed 10 → factor 0.88 (sable)
      decayFactor = 0.70 + (decaySpeed - 1) * 0.02  // Range: 0.70 → 0.88
    }
    
    // Aplicar Exponential Decay (multiplicación, no resta)
    let nextValue = current * decayFactor
    
    // 🗡️ WAVE 277: NOISE GATE - Si está muy bajo, cortar a CERO
    // "Si la música calla, la luz muere"
    if (nextValue < 0.02) {
      nextValue = 0
    }
    
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
