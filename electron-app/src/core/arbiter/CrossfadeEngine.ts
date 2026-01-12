/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌊 CROSSFADE ENGINE - SMOOTH TRANSITION MANAGEMENT
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 373: Manages smooth transitions between control layers.
 * 
 * When a MANUAL override is released, we don't snap back to AI control.
 * Instead, we fade smoothly over configurable duration using easing curves.
 * 
 * LIFECYCLE:
 * 1. Manual override active → AI value suppressed
 * 2. Manual released → startTransition() called
 * 3. Each frame → applyTransition() returns blended value
 * 4. Duration elapsed → Transition complete, AI in full control
 * 
 * @module core/arbiter/CrossfadeEngine
 * @version WAVE 373
 */

import type { TransitionState, ChannelType } from './types'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface ActiveTransition {
  fixtureId: string
  channel: ChannelType
  fromValue: number
  toValue: number
  startTime: number
  duration: number
  state: TransitionState
}

// ═══════════════════════════════════════════════════════════════════════════
// EASING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * EaseInOut Cubic - Smooth acceleration and deceleration
 * 
 * Creates organic feel for light transitions:
 * - Starts slow (builds momentum)
 * - Fast in middle (maximum change rate)
 * - Ends slow (settles gently)
 * 
 * @param t Progress from 0 to 1
 * @returns Eased value from 0 to 1
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/**
 * EaseOutCubic - Fast start, slow end
 * Good for "snap to position then settle"
 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * EaseInCubic - Slow start, fast end
 * Good for "building momentum"
 */
export function easeInCubic(t: number): number {
  return t * t * t
}

/**
 * Linear - No easing, constant rate
 * Good for testing or when smoothness isn't needed
 */
export function linear(t: number): number {
  return t
}

// ═══════════════════════════════════════════════════════════════════════════
// CROSSFADE ENGINE CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class CrossfadeEngine {
  private transitions: Map<string, ActiveTransition> = new Map()
  private defaultDuration: number
  private easingFn: (t: number) => number
  
  constructor(
    defaultDuration: number = 500,  // 500ms default crossfade
    easingFn: (t: number) => number = easeInOutCubic
  ) {
    this.defaultDuration = defaultDuration
    this.easingFn = easingFn
  }
  
  /**
   * Generate unique key for fixture+channel combination
   */
  private getKey(fixtureId: string, channel: ChannelType): string {
    return `${fixtureId}:${channel}`
  }
  
  /**
   * 🚀 Start a new transition
   * 
   * Called when manual override is released.
   * 
   * @param fixtureId The fixture being transitioned
   * @param channel The channel being transitioned
   * @param fromValue Current value (manual override)
   * @param toValue Target value (AI value to transition to)
   * @param duration Optional duration override
   */
  startTransition(
    fixtureId: string,
    channel: ChannelType,
    fromValue: number,
    toValue: number,
    duration?: number
  ): void {
    const key = this.getKey(fixtureId, channel)
    
    // If there's already a transition, we need to handle it
    // Option: Cancel old and start new from current interpolated position
    const existing = this.transitions.get(key)
    let actualFromValue = fromValue
    
    if (existing && existing.state.phase === 'in-progress') {
      // Get current interpolated value as new starting point
      actualFromValue = this.getCurrentValue(fixtureId, channel, fromValue, toValue)
    }
    
    const now = performance.now()
    
    this.transitions.set(key, {
      fixtureId,
      channel,
      fromValue: actualFromValue,
      toValue,
      startTime: now,
      duration: duration ?? this.defaultDuration,
      state: {
        phase: 'in-progress',
        progress: 0,
        startTime: now,
        duration: duration ?? this.defaultDuration,
      }
    })
  }
  
  /**
   * 🎛️ Get the current interpolated value for a channel
   * 
   * Call this every frame to get the blended value during transition.
   * 
   * @param fixtureId The fixture
   * @param channel The channel
   * @param currentSourceValue Current AI value (target)
   * @param fallbackValue Value to return if no transition active
   * @returns Interpolated value
   */
  getCurrentValue(
    fixtureId: string,
    channel: ChannelType,
    currentSourceValue: number,
    fallbackValue?: number
  ): number {
    const key = this.getKey(fixtureId, channel)
    const transition = this.transitions.get(key)
    
    if (!transition) {
      return fallbackValue ?? currentSourceValue
    }
    
    // Update the target value to track AI changes during transition
    transition.toValue = currentSourceValue
    
    const now = performance.now()
    const elapsed = now - transition.startTime
    const rawProgress = Math.min(1, elapsed / transition.duration)
    const easedProgress = this.easingFn(rawProgress)
    
    // Update state
    transition.state.progress = rawProgress
    
    // Interpolate between from and to
    const value = transition.fromValue + 
      (transition.toValue - transition.fromValue) * easedProgress
    
    // Check if transition is complete
    if (rawProgress >= 1) {
      transition.state.phase = 'complete'
      // Clean up completed transition
      this.transitions.delete(key)
    }
    
    return value
  }
  
  /**
   * ❓ Check if a transition is currently active for this fixture+channel
   */
  isTransitioning(fixtureId: string, channel: ChannelType): boolean {
    const key = this.getKey(fixtureId, channel)
    const transition = this.transitions.get(key)
    return transition?.state.phase === 'in-progress'
  }
  
  /**
   * Get transition state for a fixture+channel
   */
  getTransitionState(fixtureId: string, channel: ChannelType): TransitionState | null {
    const key = this.getKey(fixtureId, channel)
    const transition = this.transitions.get(key)
    return transition?.state ?? null
  }
  
  /**
   * ❌ Cancel a transition immediately (snap to target)
   */
  cancelTransition(fixtureId: string, channel: ChannelType): void {
    const key = this.getKey(fixtureId, channel)
    this.transitions.delete(key)
  }
  
  /**
   * ❌ Cancel all transitions for a fixture
   */
  cancelAllTransitions(fixtureId: string): void {
    for (const [key] of this.transitions) {
      if (key.startsWith(`${fixtureId}:`)) {
        this.transitions.delete(key)
      }
    }
  }
  
  /**
   * 🧹 Clear all active transitions (reset)
   */
  clearAll(): void {
    this.transitions.clear()
  }
  
  /**
   * Get count of active transitions
   */
  getActiveCount(): number {
    return this.transitions.size
  }
  
  /**
   * Get all active transitions (for debugging/status)
   */
  getActiveTransitions(): ActiveTransition[] {
    return Array.from(this.transitions.values())
  }
  
  /**
   * Update default duration
   */
  setDefaultDuration(duration: number): void {
    this.defaultDuration = duration
  }
  
  /**
   * Update easing function
   */
  setEasingFunction(fn: (t: number) => number): void {
    this.easingFn = fn
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Global crossfade engine instance
 * Used by MasterArbiter for all transitions
 */
export const globalCrossfadeEngine = new CrossfadeEngine(500, easeInOutCubic)
