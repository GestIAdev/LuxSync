/**
 * ☀️ HYPERION — Fixture Layer
 * 
 * EL CORAZÓN DEL RENDERIZADO.
 * Cada fixture es una invocación de luz: Aura → Halo → Beam → Core → Rim.
 * 
 * Pipeline de renderizado (por fixture, en orden Z):
 * 1. OUTER AURA — Scatter atmosférico ultra-difuso (solo HQ + intensity > 0.3)
 * 2. NEON HALO — Glow principal con color del fixture
 * 3. BEAM CONE — Proyección triangular para movers (pan/tilt/zoom)
 * 4. COLOR CORE — Centro sólido con el color del fixture
 * 5. WHITE HOT CENTER — Punto central blanco (escala con intensity)
 * 6. NEON RIM — Anillo fino siempre visible (identidad del fixture apagado)
 * 
 * @module components/hyperion/views/tactical/layers/FixtureLayer
 * @since WAVE 2042.5 (Project Hyperion — Phase 3)
 */

import type { TacticalFixture, QualityMode } from '../../tactical/types'
import { HYPERION } from '../../../shared/NeonPalette'

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE VISUAL CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

export const FIXTURE_CONFIG = {
  // ── Size ────────────────────────────────────────────────────────────────
  /** Base fixture radius (fraction of canvas min dimension) */
  BASE_RADIUS_RATIO: 0.022,
  /** Minimum radius in pixels */
  MIN_RADIUS: 8,
  /** Maximum radius in pixels */
  MAX_RADIUS: 24,

  // ── Glow Multipliers ────────────────────────────────────────────────────
  /** Glow radius multiplier for moving heads (beam is their "light") */
  MOVER_GLOW: 3.5,
  /** Glow radius multiplier for PARs (diffuse wash) */
  PAR_GLOW: 5.0,
  /** Outer aura radius multiplier (atmospheric scatter) */
  AURA_RADIUS: 8.0,

  // ── Beam Projection ─────────────────────────────────────────────────────
  /** Maximum beam throw (fraction of canvas height) */
  BEAM_MAX_THROW: 0.42,
  /** Minimum beam cone angle in degrees (tight beam, zoom=0) */
  BEAM_MIN_ANGLE: 5,
  /** Maximum beam cone angle in degrees (wide wash, zoom=255) */
  BEAM_MAX_ANGLE: 55,

  // ── Beat Reactivity ─────────────────────────────────────────────────────
  /** Glow scale boost on beat (1.0 = no boost) */
  BEAT_GLOW_SCALE: 1.08,
  /** Core brightness boost on beat */
  BEAT_CORE_BOOST: 0.15,
} as const

// ═══════════════════════════════════════════════════════════════════════════
// MATH UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

const clamp = (v: number, min: number, max: number): number => 
  Math.max(min, Math.min(max, v))

const mapRange = (v: number, inMin: number, inMax: number, outMin: number, outMax: number): number => {
  const t = clamp((v - inMin) / (inMax - inMin), 0, 1)
  return lerp(outMin, outMax, t)
}

const deg2rad = (d: number): number => d * (Math.PI / 180)

// ═══════════════════════════════════════════════════════════════════════════
// INDIVIDUAL FIXTURE RENDER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Draw outer atmospheric aura (only in HQ mode, high intensity).
 */
function drawAura(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  fixture: TacticalFixture,
  baseRadius: number
): void {
  const { r, g, b, intensity } = fixture

  // Only draw for bright fixtures
  if (intensity < 0.35) return

  const auraRadius = baseRadius * FIXTURE_CONFIG.AURA_RADIUS * (0.8 + intensity * 0.4)
  
  const grad = ctx.createRadialGradient(x, y, 0, x, y, auraRadius)
  const alpha = intensity * 0.12
  
  grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`)
  grad.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, ${alpha * 0.5})`)
  grad.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, ${alpha * 0.15})`)
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)')

  ctx.beginPath()
  ctx.arc(x, y, auraRadius, 0, Math.PI * 2)
  ctx.fillStyle = grad
  ctx.fill()
}

/**
 * Draw neon halo (main glow effect).
 */
function drawHalo(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  fixture: TacticalFixture,
  baseRadius: number,
  beatScale: number
): void {
  const { r, g, b, intensity, type } = fixture

  if (intensity < 0.02) return

  const isPar = type === 'par' || type === 'wash'
  const glowMultiplier = isPar ? FIXTURE_CONFIG.PAR_GLOW : FIXTURE_CONFIG.MOVER_GLOW
  
  // Halo radius: base + intensity + beat pulse
  const haloRadius = baseRadius * glowMultiplier * (0.6 + intensity * 0.5) * beatScale

  // Double pass: diffuse outer + sharp inner
  
  // Pass 1: Diffuse outer glow
  const outerGrad = ctx.createRadialGradient(x, y, 0, x, y, haloRadius)
  const outerAlpha = isPar ? intensity * 0.40 : intensity * 0.50
  
  outerGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${outerAlpha})`)
  outerGrad.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, ${outerAlpha * 0.55})`)
  outerGrad.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, ${outerAlpha * 0.15})`)
  outerGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')

  ctx.beginPath()
  ctx.arc(x, y, haloRadius, 0, Math.PI * 2)
  ctx.fillStyle = outerGrad
  ctx.fill()

  // Pass 2: Sharp inner ring (neon edge)
  const innerRadius = haloRadius * 0.35
  const innerGrad = ctx.createRadialGradient(x, y, innerRadius * 0.6, x, y, innerRadius)
  const innerAlpha = intensity * 0.25

  innerGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`)
  innerGrad.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, ${innerAlpha})`)
  innerGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${innerAlpha * 0.3})`)

  ctx.beginPath()
  ctx.arc(x, y, innerRadius, 0, Math.PI * 2)
  ctx.fillStyle = innerGrad
  ctx.fill()
}

/**
 * Draw beam projection cone (movers only).
 * 
 * Double-layer "lightsaber" effect:
 * - Layer 1: Color body (full width)
 * - Layer 2: White hot core (20% width)
 */
function drawBeam(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  fixture: TacticalFixture,
  canvasHeight: number
): void {
  const { r, g, b, intensity, physicalPan, physicalTilt, zoom, focus, type } = fixture

  // Only movers get beams
  if (type === 'par' || type === 'wash' || intensity < 0.03) return

  // Pan angle: 0→ -45°, 0.5→ 0°, 1→ +45°
  const panAngle = mapRange(physicalPan, 0, 1, -Math.PI * 0.45, Math.PI * 0.45)

  // Tilt affects throw length: parabolic (max at 0.5)
  const tiltFactor = 1 - Math.abs(physicalTilt - 0.5) * 2
  const throwLength = canvasHeight * FIXTURE_CONFIG.BEAM_MAX_THROW * Math.max(0.15, tiltFactor)

  // Cone angle from zoom (0=tight, 255=wide)
  const coneAngleDeg = mapRange(zoom, 0, 255, FIXTURE_CONFIG.BEAM_MIN_ANGLE, FIXTURE_CONFIG.BEAM_MAX_ANGLE)
  const halfCone = deg2rad(coneAngleDeg / 2)

  // Focus affects edge alpha (0=sharp, 255=diffuse)
  const edgeSharpness = mapRange(focus, 0, 255, 0.12, 0.03)

  // Calculate triangle vertices
  const endX = x + Math.sin(panAngle) * throwLength
  const endY = y + Math.cos(panAngle) * throwLength

  const baseHalf = Math.tan(halfCone) * throwLength
  const perpX = Math.cos(panAngle)
  const perpY = -Math.sin(panAngle)

  const leftX = endX - perpX * baseHalf
  const leftY = endY - perpY * baseHalf
  const rightX = endX + perpX * baseHalf
  const rightY = endY + perpY * baseHalf

  // ── LAYER 1: COLOR BODY ─────────────────────────────────────────────────
  
  const bodyGrad = ctx.createLinearGradient(x, y, endX, endY)
  const bodyAlpha = intensity * 0.65

  bodyGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${bodyAlpha})`)
  bodyGrad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${bodyAlpha * 0.55})`)
  bodyGrad.addColorStop(0.85, `rgba(${r}, ${g}, ${b}, ${bodyAlpha * 0.20})`)
  bodyGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${edgeSharpness})`)

  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(leftX, leftY)
  ctx.lineTo(rightX, rightY)
  ctx.closePath()
  ctx.fillStyle = bodyGrad
  ctx.fill()

  // ── LAYER 2: WHITE HOT CORE (20% width) ─────────────────────────────────
  
  const coreWidth = baseHalf * 0.20
  const coreLeftX = endX - perpX * coreWidth
  const coreLeftY = endY - perpY * coreWidth
  const coreRightX = endX + perpX * coreWidth
  const coreRightY = endY + perpY * coreWidth

  const coreGrad = ctx.createLinearGradient(x, y, endX, endY)
  const coreAlpha = intensity * 0.85

  coreGrad.addColorStop(0, `rgba(255, 255, 255, ${coreAlpha})`)
  coreGrad.addColorStop(0.4, `rgba(255, 255, 255, ${coreAlpha * 0.65})`)
  coreGrad.addColorStop(0.8, `rgba(255, 255, 255, ${coreAlpha * 0.25})`)
  coreGrad.addColorStop(1, `rgba(255, 255, 255, 0)`)

  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(coreLeftX, coreLeftY)
  ctx.lineTo(coreRightX, coreRightY)
  ctx.closePath()
  ctx.fillStyle = coreGrad
  ctx.fill()
}

/**
 * Draw fixture core (solid color center).
 */
function drawCore(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  fixture: TacticalFixture,
  baseRadius: number,
  beatBoost: number
): void {
  const { r, g, b, intensity } = fixture

  if (intensity < 0.02) return

  const coreRadius = baseRadius * 0.70
  const coreAlpha = clamp(intensity + 0.25 + beatBoost, 0, 1)

  // Solid color core
  ctx.beginPath()
  ctx.arc(x, y, coreRadius, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${coreAlpha})`
  ctx.fill()
}

/**
 * Draw white hot center point (scales with intensity).
 */
function drawHotCenter(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  fixture: TacticalFixture,
  baseRadius: number
): void {
  const { intensity } = fixture

  if (intensity < 0.15) return

  // Size scales with intensity
  const centerRadius = baseRadius * (0.15 + intensity * 0.20)

  ctx.beginPath()
  ctx.arc(x, y, centerRadius, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + intensity * 0.5})`
  ctx.fill()
}

/**
 * Draw neon rim (always visible, gives identity to off fixtures).
 */
function drawNeonRim(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  fixture: TacticalFixture,
  baseRadius: number
): void {
  const { r, g, b, intensity } = fixture

  // Rim is always visible, but brighter when lit
  const rimAlpha = intensity > 0.02 ? 0.6 + intensity * 0.4 : 0.15

  ctx.beginPath()
  ctx.arc(x, y, baseRadius, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${rimAlpha})`
  ctx.lineWidth = intensity > 0.02 ? 1.5 : 1
  ctx.stroke()
}

/**
 * Draw off-state fixture (sleeping but present).
 */
function drawOffFixture(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  fixture: TacticalFixture,
  baseRadius: number
): void {
  const { r, g, b } = fixture

  // Dark interior
  ctx.beginPath()
  ctx.arc(x, y, baseRadius * 0.85, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(10, 10, 18, 0.85)'
  ctx.fill()

  // Color rim (memory of the fixture's identity)
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.18)`
  ctx.lineWidth = 1
  ctx.stroke()

  // Tiny cyan dot (fixture exists but sleeping)
  ctx.beginPath()
  ctx.arc(x, y, 2, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0, 240, 255, 0.20)'
  ctx.fill()
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN FIXTURE LAYER RENDERER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Render all fixtures with the full Neon Total pipeline.
 */
export function renderFixtureLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fixtures: TacticalFixture[],
  options?: {
    /** Quality mode */
    quality?: QualityMode
    /** Is currently on beat? (for pulse effects) */
    onBeat?: boolean
    /** Beat intensity (0-1) */
    beatIntensity?: number
  }
): void {
  const {
    quality = 'HQ',
    onBeat = false,
    beatIntensity = 0,
  } = options ?? {}

  const isHQ = quality === 'HQ'

  // Calculate base radius
  const minDim = Math.min(width, height)
  const baseRadius = clamp(
    minDim * FIXTURE_CONFIG.BASE_RADIUS_RATIO,
    FIXTURE_CONFIG.MIN_RADIUS,
    FIXTURE_CONFIG.MAX_RADIUS
  )

  // Beat reactivity
  const beatScale = onBeat ? FIXTURE_CONFIG.BEAT_GLOW_SCALE : 1.0
  const beatBoost = onBeat ? FIXTURE_CONFIG.BEAT_CORE_BOOST * beatIntensity : 0

  // ── RENDER PASS 1: BEAMS (below everything) ─────────────────────────────
  // Render beams first so halos/cores appear on top
  
  for (const fixture of fixtures) {
    if (fixture.intensity < 0.02) continue
    const fx = fixture.x * width
    const fy = fixture.y * height
    drawBeam(ctx, fx, fy, fixture, height)
  }

  // ── RENDER PASS 2: AURAS (HQ only) ──────────────────────────────────────
  
  if (isHQ) {
    for (const fixture of fixtures) {
      if (fixture.intensity < 0.35) continue
      const fx = fixture.x * width
      const fy = fixture.y * height
      drawAura(ctx, fx, fy, fixture, baseRadius)
    }
  }

  // ── RENDER PASS 3: HALOS ────────────────────────────────────────────────
  
  for (const fixture of fixtures) {
    const fx = fixture.x * width
    const fy = fixture.y * height

    if (fixture.intensity < 0.02) {
      // Off fixture
      drawOffFixture(ctx, fx, fy, fixture, baseRadius)
    } else {
      // Lit fixture: halo + core + hot center + rim
      drawHalo(ctx, fx, fy, fixture, baseRadius, beatScale)
      drawCore(ctx, fx, fy, fixture, baseRadius, beatBoost)
      drawHotCenter(ctx, fx, fy, fixture, baseRadius)
      drawNeonRim(ctx, fx, fy, fixture, baseRadius)
    }
  }
}
