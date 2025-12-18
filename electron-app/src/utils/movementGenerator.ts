/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌀 MOVEMENT GENERATOR - WAVE 34.1: Kinetic Pattern Engine (Frontend)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Genera valores de oscilación para Pan/Tilt basados en patrones:
 * - circle: Órbita circular alrededor del punto base
 * - eight: Figura de ocho (lemniscata)
 * - sweep: Barrido horizontal
 * - wave: Ondulación sincronizada entre fixtures
 * 
 * La fórmula es:
 *   finalPan = basePan + (PatternX(time) * size)
 *   finalTilt = baseTilt + (PatternY(time) * size)
 * 
 * @module utils/movementGenerator
 * @version 34.1.0
 */

import { FlowPattern } from '../stores/controlStore'

export interface MovementOffset {
  x: number  // -1 to 1 (to be multiplied by size)
  y: number  // -1 to 1 (to be multiplied by size)
}

export interface MovementParams {
  pattern: FlowPattern
  speed: number      // 0-100 (affects oscillation frequency)
  size: number       // 0-1 (amplitude of oscillation)
  basePan: number    // 0-1 (center point X)
  baseTilt: number   // 0-1 (center point Y)
  fixtureIndex?: number // For wave/phase offset between fixtures
}

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN GENERATORS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get the current phase based on time and speed
 * Speed 0 = 1 cycle per 10 seconds
 * Speed 100 = 10 cycles per second
 */
function getPhase(speed: number, fixtureOffset: number = 0): number {
  // Map speed 0-100 to frequency 0.1-10 Hz
  const frequency = 0.1 + (speed / 100) * 2 // 0.1 to 2.1 Hz
  const time = Date.now() / 1000 // seconds
  return (time * frequency * Math.PI * 2) + fixtureOffset
}

/**
 * ○ CIRCLE: Smooth circular orbit
 */
function calculateCircle(phase: number): MovementOffset {
  return {
    x: Math.cos(phase),
    y: Math.sin(phase),
  }
}

/**
 * ∞ EIGHT: Figure-eight (lemniscate)
 */
function calculateEight(phase: number): MovementOffset {
  return {
    x: Math.sin(phase),
    y: Math.sin(phase * 2) * 0.5,
  }
}

/**
 * ↔ SWEEP: Horizontal pendulum
 */
function calculateSweep(phase: number): MovementOffset {
  return {
    x: Math.sin(phase),
    y: 0,
  }
}

/**
 * 〰 WAVE: Vertical wave (for multi-fixture sync)
 */
function calculateWave(phase: number, fixtureIndex: number): MovementOffset {
  // Phase offset per fixture creates wave effect
  const offsetPhase = phase + (fixtureIndex * Math.PI / 4)
  return {
    x: 0,
    y: Math.sin(offsetPhase),
  }
}

/**
 * ▣ STATIC: No movement (returns center)
 */
function calculateStatic(): MovementOffset {
  return { x: 0, y: 0 }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🌀 Calculate the current Pan/Tilt values for a fixture
 * 
 * @param params - Movement parameters from controlStore.flowParams
 * @returns Final pan and tilt values (0-1 range)
 */
export function calculateMovement(params: MovementParams): { pan: number; tilt: number } {
  const { pattern, speed, size, basePan, baseTilt, fixtureIndex = 0 } = params
  
  // If size is 0 or pattern is static, just return base values
  if (size <= 0 || pattern === 'static') {
    return { pan: basePan, tilt: baseTilt }
  }
  
  // Get current phase
  const phase = getPhase(speed, fixtureIndex * 0.5)
  
  // Calculate pattern offset
  let offset: MovementOffset
  
  switch (pattern) {
    case 'circle':
      offset = calculateCircle(phase)
      break
    case 'eight':
      offset = calculateEight(phase)
      break
    case 'wave':
      offset = calculateWave(phase, fixtureIndex)
      break
    default:
      offset = calculateStatic()
  }
  
  // Apply size multiplier and add to base
  // Clamp final values to 0-1 range
  const pan = Math.max(0, Math.min(1, basePan + offset.x * size * 0.4))
  const tilt = Math.max(0, Math.min(1, baseTilt + offset.y * size * 0.4))
  
  return { pan, tilt }
}

/**
 * Map MovementRadar pattern to FlowPattern
 * (The radar uses 'sweep' but store uses 'wave')
 */
export function mapRadarPatternToFlow(radarPattern: string): FlowPattern {
  switch (radarPattern) {
    case 'circle': return 'circle'
    case 'eight': return 'eight'
    case 'sweep': return 'wave'
    default: return 'static'
  }
}
