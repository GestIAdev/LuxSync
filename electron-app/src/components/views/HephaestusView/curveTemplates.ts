/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ HEPHAESTUS CURVE TEMPLATES - WAVE 2030.6
 * Mathematical primitives for quick curve creation
 * 
 * These are NOT random or simulated - each is a pure mathematical function
 * that generates deterministic, measurable keyframe sequences.
 * 
 * @module views/HephaestusView/curveTemplates
 * @version WAVE 2030.6
 */

import type { HephKeyframe, HephCurve, HephParamId, HephInterpolation } from '../../../core/hephaestus/types'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface CurveTemplate {
  id: string
  name: string
  description: string
  icon: string
  category: 'oscillator' | 'envelope' | 'utility'
  /**
   * Generate keyframes for the given duration and resolution
   * @param durationMs - Total duration in milliseconds
   * @param cycles - Number of complete cycles (for oscillators)
   * @param resolution - Keyframes per cycle (higher = smoother)
   */
  generate: (
    durationMs: number,
    cycles?: number,
    resolution?: number
  ) => HephKeyframe[]
}

// ═══════════════════════════════════════════════════════════════════════════
// MATHEMATICAL GENERATORS
// Pure functions - NO randomness, fully deterministic
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sine wave: f(t) = 0.5 + 0.5 * sin(2πft)
 * Smooth oscillation between 0 and 1
 */
function generateSine(
  durationMs: number,
  cycles: number = 1,
  resolution: number = 16
): HephKeyframe[] {
  const keyframes: HephKeyframe[] = []
  const totalPoints = cycles * resolution + 1
  const msPerPoint = durationMs / (totalPoints - 1)
  
  for (let i = 0; i < totalPoints; i++) {
    const t = i / (totalPoints - 1)  // Normalized time [0, 1]
    const phase = t * cycles * 2 * Math.PI
    const value = 0.5 + 0.5 * Math.sin(phase)
    
    keyframes.push({
      timeMs: Math.round(i * msPerPoint),
      value,
      interpolation: 'bezier',
      bezierHandles: [0.42, 0, 0.58, 1]  // ease-in-out for smooth sine
    })
  }
  
  return keyframes
}

/**
 * Triangle wave: Linear ramp up then down
 * V-shaped oscillation
 */
function generateTriangle(
  durationMs: number,
  cycles: number = 1,
  resolution: number = 4
): HephKeyframe[] {
  const keyframes: HephKeyframe[] = []
  const pointsPerCycle = resolution
  const totalPoints = cycles * pointsPerCycle + 1
  const msPerCycle = durationMs / cycles
  
  for (let c = 0; c < cycles; c++) {
    const cycleStart = c * msPerCycle
    
    // Bottom (0)
    keyframes.push({
      timeMs: Math.round(cycleStart),
      value: 0,
      interpolation: 'linear'
    })
    
    // Peak (1) at half cycle
    keyframes.push({
      timeMs: Math.round(cycleStart + msPerCycle / 2),
      value: 1,
      interpolation: 'linear'
    })
  }
  
  // Final bottom
  keyframes.push({
    timeMs: durationMs,
    value: 0,
    interpolation: 'linear'
  })
  
  return keyframes
}

/**
 * Sawtooth wave: Linear ramp up, instant drop
 * Useful for intensity builds
 */
function generateSawtooth(
  durationMs: number,
  cycles: number = 1,
  _resolution: number = 2
): HephKeyframe[] {
  const keyframes: HephKeyframe[] = []
  const msPerCycle = durationMs / cycles
  
  for (let c = 0; c < cycles; c++) {
    const cycleStart = c * msPerCycle
    const cycleEnd = cycleStart + msPerCycle
    
    // Start of ramp (0)
    keyframes.push({
      timeMs: Math.round(cycleStart),
      value: 0,
      interpolation: 'linear'
    })
    
    // End of ramp (1) - just before drop
    keyframes.push({
      timeMs: Math.round(cycleEnd - 1),  // 1ms before end
      value: 1,
      interpolation: 'hold'  // Instant drop
    })
  }
  
  // Final point at 0
  keyframes.push({
    timeMs: durationMs,
    value: 0,
    interpolation: 'linear'
  })
  
  return keyframes
}

/**
 * Square wave: Instant transitions between 0 and 1
 * On/off strobe pattern
 */
function generateSquare(
  durationMs: number,
  cycles: number = 1,
  _resolution: number = 2
): HephKeyframe[] {
  const keyframes: HephKeyframe[] = []
  const msPerCycle = durationMs / cycles
  
  for (let c = 0; c < cycles; c++) {
    const cycleStart = c * msPerCycle
    
    // High (1) - first half
    keyframes.push({
      timeMs: Math.round(cycleStart),
      value: 1,
      interpolation: 'hold'
    })
    
    // Low (0) - second half
    keyframes.push({
      timeMs: Math.round(cycleStart + msPerCycle / 2),
      value: 0,
      interpolation: 'hold'
    })
  }
  
  // Final point
  keyframes.push({
    timeMs: durationMs,
    value: 0,
    interpolation: 'hold'
  })
  
  return keyframes
}

/**
 * Bounce: Damped oscillation (ball bounce physics)
 * f(t) = e^(-decay*t) * |cos(ωt)|
 */
function generateBounce(
  durationMs: number,
  bounces: number = 4,
  resolution: number = 8
): HephKeyframe[] {
  const keyframes: HephKeyframe[] = []
  const decay = 3  // Decay constant
  const totalPoints = bounces * resolution + 1
  const msPerPoint = durationMs / (totalPoints - 1)
  
  for (let i = 0; i < totalPoints; i++) {
    const t = i / (totalPoints - 1)  // Normalized time [0, 1]
    const phase = t * bounces * Math.PI
    const envelope = Math.exp(-decay * t)
    const value = envelope * Math.abs(Math.cos(phase))
    
    keyframes.push({
      timeMs: Math.round(i * msPerPoint),
      value,
      interpolation: 'bezier',
      bezierHandles: [0.34, 1.56, 0.64, 1]  // bounce preset
    })
  }
  
  return keyframes
}

/**
 * Ease In-Out: Smooth S-curve from 0 to 1
 * Standard animation easing
 */
function generateEaseInOut(
  durationMs: number,
  _cycles: number = 1,
  _resolution: number = 2
): HephKeyframe[] {
  return [
    {
      timeMs: 0,
      value: 0,
      interpolation: 'bezier',
      bezierHandles: [0.42, 0, 0.58, 1]  // ease-in-out
    },
    {
      timeMs: durationMs,
      value: 1,
      interpolation: 'bezier',
      bezierHandles: [0.42, 0, 0.58, 1]
    }
  ]
}

/**
 * Pulse: Quick attack, slow release (like a heartbeat)
 */
function generatePulse(
  durationMs: number,
  cycles: number = 2,
  _resolution: number = 4
): HephKeyframe[] {
  const keyframes: HephKeyframe[] = []
  const msPerCycle = durationMs / cycles
  const attackRatio = 0.1  // 10% attack
  const decayRatio = 0.3   // 30% decay
  
  for (let c = 0; c < cycles; c++) {
    const cycleStart = c * msPerCycle
    
    // Start at 0
    keyframes.push({
      timeMs: Math.round(cycleStart),
      value: 0,
      interpolation: 'bezier',
      bezierHandles: [0.68, -0.6, 0.32, 1.6]  // overshoot for fast attack
    })
    
    // Peak at attack point
    keyframes.push({
      timeMs: Math.round(cycleStart + msPerCycle * attackRatio),
      value: 1,
      interpolation: 'bezier',
      bezierHandles: [0, 0, 0.58, 1]  // ease-out for decay
    })
    
    // Decay to 0
    keyframes.push({
      timeMs: Math.round(cycleStart + msPerCycle * (attackRatio + decayRatio)),
      value: 0,
      interpolation: 'bezier',
      bezierHandles: [0.42, 0, 1, 1]  // ease-in
    })
  }
  
  // Ensure final point
  if (keyframes[keyframes.length - 1].timeMs !== durationMs) {
    keyframes.push({
      timeMs: durationMs,
      value: 0,
      interpolation: 'linear'
    })
  }
  
  return keyframes
}

/**
 * Ramp Up: Linear increase from 0 to 1
 */
function generateRampUp(
  durationMs: number,
  _cycles: number = 1,
  _resolution: number = 2
): HephKeyframe[] {
  return [
    { timeMs: 0, value: 0, interpolation: 'linear' },
    { timeMs: durationMs, value: 1, interpolation: 'linear' }
  ]
}

/**
 * Ramp Down: Linear decrease from 1 to 0
 */
function generateRampDown(
  durationMs: number,
  _cycles: number = 1,
  _resolution: number = 2
): HephKeyframe[] {
  return [
    { timeMs: 0, value: 1, interpolation: 'linear' },
    { timeMs: durationMs, value: 0, interpolation: 'linear' }
  ]
}

/**
 * Constant: Flat line at specified value
 */
function generateConstant(
  durationMs: number,
  _cycles: number = 1,
  _resolution: number = 2
): HephKeyframe[] {
  return [
    { timeMs: 0, value: 1, interpolation: 'hold' },
    { timeMs: durationMs, value: 1, interpolation: 'hold' }
  ]
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

export const CURVE_TEMPLATES: CurveTemplate[] = [
  // ── Oscillators ──
  {
    id: 'sine',
    name: 'Sine Wave',
    description: 'Smooth oscillation between 0 and 1',
    icon: '∿',
    category: 'oscillator',
    generate: generateSine
  },
  {
    id: 'triangle',
    name: 'Triangle',
    description: 'Linear ramp up then down',
    icon: '△',
    category: 'oscillator',
    generate: generateTriangle
  },
  {
    id: 'sawtooth',
    name: 'Sawtooth',
    description: 'Linear ramp with instant drop',
    icon: '⩘',
    category: 'oscillator',
    generate: generateSawtooth
  },
  {
    id: 'square',
    name: 'Square',
    description: 'On/off strobe pattern',
    icon: '⊓',
    category: 'oscillator',
    generate: generateSquare
  },
  {
    id: 'pulse',
    name: 'Pulse',
    description: 'Quick attack, slow release (heartbeat)',
    icon: '♥',
    category: 'oscillator',
    generate: generatePulse
  },
  
  // ── Envelopes ──
  {
    id: 'bounce',
    name: 'Bounce',
    description: 'Damped ball bounce physics',
    icon: '⚽',
    category: 'envelope',
    generate: generateBounce
  },
  {
    id: 'ease-in-out',
    name: 'Ease In-Out',
    description: 'Smooth S-curve transition',
    icon: 'S',
    category: 'envelope',
    generate: generateEaseInOut
  },
  
  // ── Utilities ──
  {
    id: 'ramp-up',
    name: 'Ramp Up',
    description: 'Linear increase 0 → 1',
    icon: '↗',
    category: 'utility',
    generate: generateRampUp
  },
  {
    id: 'ramp-down',
    name: 'Ramp Down',
    description: 'Linear decrease 1 → 0',
    icon: '↘',
    category: 'utility',
    generate: generateRampDown
  },
  {
    id: 'constant',
    name: 'Constant',
    description: 'Flat line at max value',
    icon: '―',
    category: 'utility',
    generate: generateConstant
  }
]

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a complete HephCurve from a template
 */
export function createCurveFromTemplate(
  template: CurveTemplate,
  paramId: HephParamId,
  durationMs: number,
  cycles: number = 1,
  resolution: number = 16
): HephCurve {
  // Determine value type and default based on paramId
  const isColorParam = paramId === 'color'
  
  return {
    paramId,
    valueType: isColorParam ? 'color' : 'number',
    range: [0, 1] as [number, number],
    defaultValue: isColorParam ? { h: 0, s: 100, l: 50 } : 0,
    keyframes: template.generate(durationMs, cycles, resolution),
    mode: 'absolute'
  }
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): CurveTemplate | undefined {
  return CURVE_TEMPLATES.find(t => t.id === id)
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(
  category: CurveTemplate['category']
): CurveTemplate[] {
  return CURVE_TEMPLATES.filter(t => t.category === category)
}

/**
 * Icon mapping for effect categories
 */
export const CATEGORY_ICONS: Record<string, string> = {
  'oscillator': '∿',
  'envelope': '📈',
  'utility': '🔧',
  'strobe': '⚡',
  'color': '🎨',
  'movement': '🔄',
  'custom': '✨'
}

export function getCategoryIcon(category: string): string {
  return CATEGORY_ICONS[category] ?? '📦'
}
