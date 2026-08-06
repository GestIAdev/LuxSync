/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛰 patternMath.ts — COPIA desacoplada de las 22 funciones de patrón
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Copia literal de las funciones matemáticas de VibeMovementManager.ts,
 * adaptadas para renderizado en canvas (sin AudioContext, sin index/total).
 *
 * PROPÓSITO: permitir que OrbitThumbnail dibuje trayectorias sin acoplar
 * la UI al runtime del VMM. Si el VMM cambia sus patterns, este archivo
 * NO debe divergir — pero la copia es intencional para evitar imports
 * circulares y dependencias de runtime en componentes puramente visuales.
 *
 * @module components/vibeLab/panels/patternMath
 * @version FASE 3.2
 */

export type PatternPoint = { x: number; y: number }
export type PatternFn = (phase: number, outPos: PatternPoint) => void

// ═══════════════════════════════════════════════════════════════════════════
// LOS 22 PATRONES — copia fiel de VibeMovementManager.ts (líneas 393-713)
// ═══════════════════════════════════════════════════════════════════════════

const PATTERN_FNS: Readonly<Record<string, PatternFn>> = {
  // ── TECHNO — geometría industrial ──────────────────────────────────────

  // SCAN_X: Barrido horizontal con ondulación vertical (Lissajous 1:2 suave)
  scan_x: (phase, outPos) => {
    outPos.x = Math.sin(phase) + Math.sin(phase * 3) * 0.03
    outPos.y = Math.sin(phase * 2) * 0.75
  },

  // SQUARE: Movimiento cuadrado con interpolación lineal entre esquinas
  square: (phase, outPos) => {
    const corners = [
      { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: -1 }, { x: -1, y: 1 },
    ]
    const np = (phase / (Math.PI * 2)) * 4
    const cur = Math.floor(np) % 4
    const nxt = (cur + 1) % 4
    const t = np - Math.floor(np)
    const wobble = Math.sin(phase * 7.3) * 0.02
    outPos.x = corners[cur].x + (corners[nxt].x - corners[cur].x) * t + wobble
    outPos.y = corners[cur].y + (corners[nxt].y - corners[cur].y) * t + wobble * 0.5
  },

  // DIAMOND: Rombo con interpolación lineal entre vértices cardinales
  diamond: (phase, outPos) => {
    const v = [{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: -1, y: 0 }]
    const np = (phase / (Math.PI * 2)) * 4
    const cur = Math.floor(np) % 4
    const nxt = (cur + 1) % 4
    const t = np - Math.floor(np)
    outPos.x = v[cur].x + (v[nxt].x - v[cur].x) * t
    outPos.y = v[cur].y + (v[nxt].y - v[cur].y) * t
  },

  // BOTSTEP: 4 cuadrantes golden-ratio con ease-in-out cúbico
  botstep: (phase, outPos) => {
    const phi = 1.618033988749
    const np = (phase / (Math.PI * 2)) * 4
    const cur = Math.floor(np) % 4
    const nxt = (cur + 1) % 4
    let t = np - Math.floor(np)
    t = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    const fromX = Math.sin(cur * phi * Math.PI) * 0.55
    const fromY = Math.cos(cur * phi * phi * Math.PI) * 0.55
    const toX = Math.sin(nxt * phi * Math.PI) * 0.55
    const toY = Math.cos(nxt * phi * phi * Math.PI) * 0.55
    outPos.x = fromX + (toX - fromX) * t
    outPos.y = fromY + (toY - fromY) * t
  },

  // LASER_GRID: 6 nodos elípticos con ease-in cúbico + micro-dither
  laser_grid: (phase, outPos) => {
    const nodes = [
      { x: 0.90, y: 0.60 }, { x: 0.00, y: 0.80 }, { x: -0.90, y: 0.60 },
      { x: -0.90, y: -0.60 }, { x: 0.00, y: -0.80 }, { x: 0.90, y: -0.60 },
    ]
    const np = (phase / (Math.PI * 2)) * 6
    const cur = Math.floor(np) % 6
    const nxt = (cur + 1) % 6
    let t = np - Math.floor(np)
    t = t * t * t
    const hold = 1 - t
    const dither = Math.sin(phase * 47.3) * 0.015 * hold
    outPos.x = nodes[cur].x + (nodes[nxt].x - nodes[cur].x) * t + dither
    outPos.y = nodes[cur].y + (nodes[nxt].y - nodes[cur].y) * t + dither * 0.6
  },

  // INDUSTRIAL_PENDULUM: péndulo amortiguado exponencial
  industrial_pendulum: (phase, outPos) => {
    const lp = phase % (Math.PI * 2)
    const decay = Math.exp(-lp / Math.PI)
    outPos.x = Math.sin(lp * 2) * decay * 0.95
    outPos.y = -Math.abs(Math.sin(lp)) * 0.35 * decay + Math.cos(lp * 0.5) * 0.12
  },

  // DARKSPIN: órbita elíptica con pulso de radio
  darkspin: (phase, outPos) => {
    const rp = 0.70 + 0.20 * Math.sin(phase * 0.5)
    outPos.x = Math.sin(phase) * rp
    outPos.y = Math.cos(phase * 1.5) * 0.62
  },

  // ── LATINO — fluido, sensual ───────────────────────────────────────────

  // FIGURE8: Lemniscata de Bernoulli
  figure8: (phase, outPos) => {
    const s = Math.sin(phase), c = Math.cos(phase)
    const d = 1 + s * s
    outPos.x = c / d
    outPos.y = (s * c / d) * 1.6
  },

  // WAVE_Y: barrido en U
  wave_y: (phase, outPos) => {
    outPos.x = Math.sin(phase) * 0.85
    outPos.y = Math.sin(phase * 2) * 0.70
  },

  // BALLYHOO: nudo trifolio
  ballyhoo: (phase, outPos) => {
    outPos.x = Math.sin(phase) * (0.8 + 0.2 * Math.cos(phase * 3))
    outPos.y = Math.sin(phase * 2) * 0.50 + Math.cos(phase) * 0.28
  },

  // CADERA_LIBRE: swing asimétrico latino
  cadera_libre: (phase, outPos) => {
    const drift = Math.sin(phase * 0.25) * 0.40
    const swing = Math.sin(phase) + 0.38 * Math.sin(phase) * Math.abs(Math.sin(phase))
    outPos.x = swing * 0.82
    outPos.y = Math.cos(phase * 2 + drift) * 0.62 + Math.pow(Math.sin(phase), 2) * 0.28
  },

  // ESPIRAL_CONGA: espiral logarítmica respirante
  espiral_conga: (phase, outPos) => {
    const r = 0.40 + 0.55 * Math.abs(Math.sin(phase * 0.5))
    const accent = Math.max(0, Math.sin(phase * 2)) * 0.35
    outPos.x = Math.cos(phase) * r
    outPos.y = Math.sin(phase) * 0.55 + accent
  },

  // ── POP-ROCK — estadio, simetría ───────────────────────────────────────

  // CIRCLE_BIG: órbita circular majestuosa
  circle_big: (phase, outPos) => {
    outPos.x = Math.sin(phase)
    outPos.y = Math.cos(phase) * 0.75
  },

  // CANCAN: piernas de bailarina
  cancan: (phase, outPos) => {
    outPos.x = Math.sin(phase * 0.25) * 0.15
    outPos.y = Math.sin(phase)
  },

  // DUAL_SWEEP: barrido en U majestuoso
  dual_sweep: (phase, outPos) => {
    const x = Math.sin(phase)
    outPos.x = x
    outPos.y = x * x - 0.3
  },

  // ── CHILL — orgánico, ambiental ────────────────────────────────────────

  // DRIFT: movimiento browniano lento
  drift: (phase, outPos) => {
    const phi = 1.618033988749
    outPos.x = Math.sin(phase * phi) * 0.4 + Math.sin(phase * Math.SQRT2) * 0.25 + Math.sin(phase * Math.sqrt(3)) * 0.15
    outPos.y = Math.cos(phase * phi * 0.7) * 0.35 + Math.cos(phase * Math.SQRT2 * 0.8) * 0.2 + Math.cos(phase * Math.sqrt(3) * 0.9) * 0.12
  },

  // SWAY: péndulo suave (solo X)
  sway: (phase, outPos) => {
    outPos.x = Math.sin(phase) * 0.6
    outPos.y = 0
  },

  // BREATH: la luz respira (solo Y)
  breath: (phase, outPos) => {
    outPos.x = 0
    outPos.y = Math.sin(phase) * 0.35
  },

  // ── THE FOUR NOBLES — universales relajados ────────────────────────────

  // SLOW_PAN: barrido horizontal puro
  slow_pan: (phase, outPos) => {
    outPos.x = Math.sin(phase)
    outPos.y = 0
  },

  // TILT_NOD: cabeceo meditativo
  tilt_nod: (phase, outPos) => {
    outPos.x = 0
    outPos.y = Math.sin(phase) * 0.6
  },

  // FIGURE_OF_4: figure8 contenido
  figure_of_4: (phase, outPos) => {
    outPos.x = Math.sin(phase) * 0.5
    outPos.y = Math.sin(2 * phase) * 0.3
  },

  // CHASE_POSITION: 4 posiciones cardinales con interpolación lineal
  chase_position: (phase, outPos) => {
    const pos = [{ x: -0.7, y: 0 }, { x: 0, y: 0.7 }, { x: 0.7, y: 0 }, { x: 0, y: -0.7 }]
    const np = (phase / (2 * Math.PI)) * 4
    const cur = Math.floor(np) % 4
    const nxt = (cur + 1) % 4
    const t = np - Math.floor(np)
    outPos.x = pos[cur].x + (pos[nxt].x - pos[cur].x) * t
    outPos.y = pos[cur].y + (pos[nxt].y - pos[cur].y) * t
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════════════════════

export const PATTERN_IDS: readonly string[] = Object.keys(PATTERN_FNS)

/** Compute a single point of a pattern at the given phase (0..2π). */
export function computePatternPoint(patternId: string, phase: number): PatternPoint {
  const fn = PATTERN_FNS[patternId]
  const out: PatternPoint = { x: 0, y: 0 }
  if (fn) fn(phase, out)
  return out
}

/** Sample N points of a pattern to draw a complete trajectory. */
export function samplePatternTrajectory(patternId: string, samples: number): PatternPoint[] {
  const fn = PATTERN_FNS[patternId]
  const pts: PatternPoint[] = []
  if (!fn) return pts
  const out: PatternPoint = { x: 0, y: 0 }
  for (let i = 0; i < samples; i++) {
    const phase = (i / samples) * Math.PI * 2
    fn(phase, out)
    pts.push({ x: out.x, y: out.y })
  }
  return pts
}
