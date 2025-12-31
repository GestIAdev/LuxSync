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
   * WAVE 256.8: DRASTICALLY simplified - movers should ALWAYS have some light with audio
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
    
    // B. WAVE 256.8: Combined audio signal - movers respond to EVERYTHING
    // Use the maximum of all bands with boosting
    const audioSignal = Math.max(
      rawMid * 1.5,           // Mid frequencies boosted (vocals, instruments)
      rawTreble * 1.3,        // Treble boosted (hats, cymbals)
      rawBass * 0.6           // Bass contributes too but less
    )
    
    // C. WAVE 256.8: VERY LOW threshold for movers - they should be alive
    const ACTIVATION_THRESHOLD = 0.08  // Activates at 8% audio signal
    
    let target = 0
    let nextState = moverState
    
    // D. SIMPLE LOGIC: If there's audio, movers respond
    if (audioSignal > ACTIVATION_THRESHOLD) {
      nextState = true
      // Map signal to intensity: 0.08 → 0.3 (minimum visible), 1.0 → 1.0 (max)
      target = 0.3 + (audioSignal - ACTIVATION_THRESHOLD) * 0.7 / (1 - ACTIVATION_THRESHOLD)
    } else {
      // Very low or no audio - decay
      if (moverState) {
        // Was on, give it some grace time with minimal intensity
        target = 0.15
      }
      nextState = audioSignal > 0.05  // Slightly lower off threshold for hysteresis
    }
    
    // E. WAVE 256.8: Clamp and return - NO MORE GATES
    return {
      intensity: Math.min(1, Math.max(0, target)),
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
