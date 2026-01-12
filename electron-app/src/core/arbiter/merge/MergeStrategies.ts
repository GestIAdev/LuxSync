/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔀 MERGE STRATEGIES - PURE MATH FUNCTIONS
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 373: Implementation of industry-standard merge strategies.
 * 
 * STRATEGIES:
 * - HTP (Highest Takes Precedence): For intensity channels
 * - LTP (Latest Takes Precedence): For position/color channels
 * - BLEND (Weighted Average): For smooth transitions
 * - OVERRIDE: For emergency blackout
 * 
 * @module core/arbiter/merge/MergeStrategies
 * @version WAVE 373
 */

import {
  type MergeStrategy,
  type ChannelType,
  type ChannelValue,
  type MergeResult,
  ControlLayer,
  DEFAULT_MERGE_STRATEGIES,
} from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// CORE MERGE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 💡 HTP (Highest Takes Precedence)
 * 
 * The value with the highest intensity wins.
 * Industry standard for dimmer channels.
 * 
 * @example
 * mergeHTP([100, 150, 80]) // Returns 150
 */
export function mergeHTP(values: number[]): number {
  if (values.length === 0) return 0
  return Math.max(...values)
}

/**
 * ⏱️ LTP (Latest Takes Precedence)
 * 
 * The most recently set value wins.
 * Industry standard for position and color channels.
 * 
 * @example
 * mergeLTP([
 *   { value: 100, timestamp: 1000 },
 *   { value: 150, timestamp: 2000 },  // <- This wins
 *   { value: 80, timestamp: 500 }
 * ]) // Returns 150
 */
export function mergeLTP<T>(
  values: Array<{ value: T; timestamp: number }>
): T | undefined {
  if (values.length === 0) return undefined
  
  // Sort by timestamp descending, return most recent
  const sorted = [...values].sort((a, b) => b.timestamp - a.timestamp)
  return sorted[0].value
}

/**
 * 🎚️ BLEND (Weighted Average)
 * 
 * Blends multiple values using weights.
 * Used for smooth crossfade transitions.
 * 
 * @example
 * mergeBLEND([
 *   { value: 100, weight: 0.7 },
 *   { value: 200, weight: 0.3 }
 * ]) // Returns 130 (100*0.7 + 200*0.3)
 */
export function mergeBLEND(
  values: Array<{ value: number; weight: number }>
): number {
  if (values.length === 0) return 0
  
  const totalWeight = values.reduce((sum, v) => sum + v.weight, 0)
  if (totalWeight === 0) return 0
  
  const weightedSum = values.reduce((sum, v) => sum + v.value * v.weight, 0)
  return weightedSum / totalWeight
}

/**
 * 🚫 OVERRIDE (Complete Replacement)
 * 
 * Ignores all other values and returns the override.
 * Used for blackout - the nuclear option.
 * 
 * @example
 * mergeOVERRIDE(0) // Returns 0, regardless of what AI/Manual want
 */
export function mergeOVERRIDE<T>(overrideValue: T): T {
  return overrideValue
}

// ═══════════════════════════════════════════════════════════════════════════
// CHANNEL MERGER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎛️ Merge multiple channel values using the appropriate strategy
 * 
 * This is the main entry point for merging values from different layers.
 * It selects the correct strategy based on channel type and applies it.
 * 
 * @param channelType - The type of channel being merged
 * @param values - Array of values from different layers
 * @param strategyOverride - Optional strategy override (for testing)
 * @returns The merged value and which layer it came from
 * 
 * @example
 * // Dimmer uses HTP (highest wins)
 * mergeChannel('dimmer', [
 *   { layer: ControlLayer.TITAN_AI, value: 100, timestamp: 1000 },
 *   { layer: ControlLayer.MANUAL, value: 150, timestamp: 2000 }
 * ])
 * // Returns { value: 150, source: ControlLayer.MANUAL }
 * 
 * @example
 * // Pan uses LTP (latest wins)
 * mergeChannel('pan', [
 *   { layer: ControlLayer.TITAN_AI, value: 100, timestamp: 2000 },  // <- More recent
 *   { layer: ControlLayer.MANUAL, value: 150, timestamp: 1000 }
 * ])
 * // Returns { value: 100, source: ControlLayer.TITAN_AI }
 */
export function mergeChannel(
  channelType: ChannelType,
  values: ChannelValue[],
  strategyOverride?: MergeStrategy
): MergeResult {
  if (values.length === 0) {
    return { value: 0, source: ControlLayer.TITAN_AI }
  }
  
  // Get the strategy for this channel type
  const strategy = strategyOverride ?? DEFAULT_MERGE_STRATEGIES[channelType]
  
  // Sort by layer priority (highest first) for tie-breaking
  const sorted = [...values].sort((a, b) => b.layer - a.layer)
  
  switch (strategy) {
    case 'HTP': {
      // Highest value wins
      const htpValue = mergeHTP(sorted.map(v => v.value))
      // Find which layer provided the winning value (prefer higher priority on tie)
      const htpSource = sorted.find(v => v.value === htpValue)?.layer ?? ControlLayer.TITAN_AI
      return { value: htpValue, source: htpSource }
    }
    
    case 'LTP': {
      // Most recent value wins
      const ltpValue = mergeLTP(sorted.map(v => ({ value: v.value, timestamp: v.timestamp })))
      // Find which layer had the most recent timestamp
      const latestTimestamp = Math.max(...sorted.map(v => v.timestamp))
      const ltpSource = sorted.find(v => v.timestamp === latestTimestamp)?.layer ?? ControlLayer.TITAN_AI
      return { value: ltpValue ?? 0, source: ltpSource }
    }
    
    case 'BLEND': {
      // Weighted average
      const blendValue = mergeBLEND(sorted.map(v => ({ 
        value: v.value, 
        weight: v.weight ?? 1 
      })))
      // Source is the highest priority layer (since it's a blend, pick the dominant one)
      return { value: blendValue, source: sorted[0].layer }
    }
    
    case 'OVERRIDE': {
      // Highest priority layer wins unconditionally
      return { value: sorted[0].value, source: sorted[0].layer }
    }
    
    default: {
      // Fallback: highest priority layer wins
      return { value: sorted[0].value, source: sorted[0].layer }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get the default merge strategy for a channel type
 */
export function getDefaultStrategy(channelType: ChannelType): MergeStrategy {
  return DEFAULT_MERGE_STRATEGIES[channelType]
}

/**
 * Check if a channel type uses HTP merge (intensity-based)
 */
export function isHTPChannel(channelType: ChannelType): boolean {
  return DEFAULT_MERGE_STRATEGIES[channelType] === 'HTP'
}

/**
 * Check if a channel type uses LTP merge (position/color)
 */
export function isLTPChannel(channelType: ChannelType): boolean {
  return DEFAULT_MERGE_STRATEGIES[channelType] === 'LTP'
}

/**
 * Clamp a value to DMX range (0-255)
 */
export function clampDMX(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

/**
 * Normalize a value from DMX range to 0-1
 */
export function dmxToNormalized(value: number): number {
  return value / 255
}

/**
 * Convert a normalized value (0-1) to DMX range (0-255)
 */
export function normalizedToDMX(value: number): number {
  return clampDMX(value * 255)
}
