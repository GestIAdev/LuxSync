/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ HEPHAESTUS DUMMY DATA - WAVE 2030.3
 * Sine wave + ramp curves for visual testing of CurveEditor
 * 
 * NOTA: Esto NO es una simulación de lógica de negocio.
 * Es data estática de prueba para verificar el rendering del editor SVG.
 * Cada keyframe es un punto real con coordenadas deterministas.
 * 
 * @module views/HephaestusView/dummyData
 * @version WAVE 2030.3
 */

import type {
  HephAutomationClip,
  HephCurve,
  HephParamId,
  HephKeyframe,
} from '../../../core/hephaestus/types'

// ═══════════════════════════════════════════════════════════════════════════
// SINE WAVE GENERATOR — Deterministic keypoint sampling
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Genera keyframes que trazan una onda sinusoidal.
 * NO usa Math.random() — 100% determinista.
 * Produce puntos exactos a intervalos regulares con valores calculados por Math.sin.
 */
function generateSineKeyframes(
  durationMs: number,
  points: number,
  amplitude: number = 0.4,
  offset: number = 0.5,
  phaseShift: number = 0,
): HephKeyframe[] {
  const keyframes: HephKeyframe[] = []
  for (let i = 0; i < points; i++) {
    const t = (i / (points - 1)) * durationMs
    const normalized = i / (points - 1)
    const value = offset + amplitude * Math.sin(normalized * Math.PI * 2 + phaseShift)
    keyframes.push({
      timeMs: Math.round(t),
      value: Math.max(0, Math.min(1, value)),
      interpolation: 'bezier',
      bezierHandles: [0.25, 0.1, 0.25, 1], // smooth preset
    })
  }
  return keyframes
}

// ═══════════════════════════════════════════════════════════════════════════
// DUMMY CLIP FACTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Crea un HephAutomationClip de demostración con curvas editables.
 * Contiene 4 parámetros: intensity (sine), speed (ramp), strobe (step), pan (bezier wave).
 */
export function createDummyClip(): HephAutomationClip {
  const durationMs = 8000 // 8 seconds

  // ── Intensity: Sine wave (smooth pulsing) ──
  const intensityCurve: HephCurve = {
    paramId: 'intensity',
    valueType: 'number',
    range: [0, 1],
    defaultValue: 0.5,
    keyframes: generateSineKeyframes(durationMs, 9, 0.4, 0.5, 0),
    mode: 'absolute',
  }

  // ── Speed: Linear ramp up with bezier ease ──
  const speedCurve: HephCurve = {
    paramId: 'speed',
    valueType: 'number',
    range: [0, 1],
    defaultValue: 0.3,
    keyframes: [
      { timeMs: 0,    value: 0.1, interpolation: 'bezier', bezierHandles: [0.42, 0, 1, 1] },
      { timeMs: 3000, value: 0.5, interpolation: 'linear' },
      { timeMs: 5000, value: 0.9, interpolation: 'bezier', bezierHandles: [0, 0, 0.58, 1] },
      { timeMs: 8000, value: 0.3, interpolation: 'hold' },
    ],
    mode: 'absolute',
  }

  // ── Strobe: Step function (on/off pattern) ──
  const strobeCurve: HephCurve = {
    paramId: 'strobe',
    valueType: 'number',
    range: [0, 1],
    defaultValue: 0,
    keyframes: [
      { timeMs: 0,    value: 0,   interpolation: 'hold' },
      { timeMs: 2000, value: 0.8, interpolation: 'hold' },
      { timeMs: 3000, value: 0,   interpolation: 'hold' },
      { timeMs: 5000, value: 1.0, interpolation: 'hold' },
      { timeMs: 6000, value: 0,   interpolation: 'hold' },
      { timeMs: 8000, value: 0,   interpolation: 'hold' },
    ],
    mode: 'absolute',
  }

  // ── Pan: Smooth bezier sweep ──
  const panCurve: HephCurve = {
    paramId: 'pan',
    valueType: 'number',
    range: [0, 1],
    defaultValue: 0.5,
    keyframes: [
      { timeMs: 0,    value: 0.0, interpolation: 'bezier', bezierHandles: [0.42, 0, 0.58, 1] },
      { timeMs: 2000, value: 1.0, interpolation: 'bezier', bezierHandles: [0.42, 0, 0.58, 1] },
      { timeMs: 4000, value: 0.0, interpolation: 'bezier', bezierHandles: [0.42, 0, 0.58, 1] },
      { timeMs: 6000, value: 1.0, interpolation: 'bezier', bezierHandles: [0.42, 0, 0.58, 1] },
      { timeMs: 8000, value: 0.5, interpolation: 'linear' },
    ],
    mode: 'absolute',
  }

  // ── Build curves Map ──
  const curves = new Map<HephParamId, HephCurve>()
  curves.set('intensity', intensityCurve)
  curves.set('speed', speedCurve)
  curves.set('strobe', strobeCurve)
  curves.set('pan', panCurve)

  return {
    id: 'demo-clip-001',
    name: 'SINE FORGE DEMO',
    author: 'PunkOpus',
    category: 'physical',
    tags: ['demo', 'sine', 'test'],
    vibeCompat: [],
    zones: ['all'],
    mixBus: 'htp',
    priority: 50,
    durationMs,
    effectType: 'heph_custom',
    curves,
    staticParams: {},
  }
}
