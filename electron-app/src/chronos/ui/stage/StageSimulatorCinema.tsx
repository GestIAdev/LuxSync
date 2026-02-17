/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎬 STAGE SIMULATOR CINEMA - WAVE 2040.1: THE CINEMA SIMULATOR
 * "Donde la luz se convierte en arte vectorial"
 * 
 * DOUBLE-BUFFER CANVAS ARCHITECTURE:
 * ┌────────────────────────────────────────┐
 * │  Canvas A (trails)  — z-index: 0      │  ← rgba(0,0,0,0.08) fade per frame
 * │  Canvas B (fixtures) — z-index: 1     │  ← cleared + redrawn every frame
 * └────────────────────────────────────────┘
 * 
 * BEAM MATH:
 *   angle  = physicalPan * 2π              (full rotation)
 *   length = physicalTilt * MAX_THROW      (tilt controls throw distance)
 *   width  = map(zoom, 0, 255, MIN, MAX)  (0=tight beam, 255=wide wash)
 *   → Triangle: vertex at fixture, base at length projected by angle
 * 
 * ZONE AUTO-LAYOUT:
 *   BACK_PARS     → top row (y=0.20)    arc distribution
 *   FRONT_PARS    → bottom row (y=0.80) arc distribution
 *   MOVING_LEFT   → left column (x=0.12) vertical spread
 *   MOVING_RIGHT  → right column (x=0.88) vertical spread
 *   STROBES       → center band (y=0.50) horizontal spread
 *   AMBIENT/FLOOR → bottom edge (y=0.90) wide spread
 *   CENTER        → dead center (0.50, 0.50)
 *   AIR           → floating above center (y=0.35)
 * 
 * @module chronos/ui/stage/StageSimulatorCinema
 * @version WAVE 2040.1
 */

import React, { useRef, useEffect, useMemo, useCallback, memo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useHardware } from '../../../stores/truthStore'
import { useStageStore } from '../../../stores/stageStore'
import { useSelectionStore, useSelectionClick } from '../../../stores/selectionStore'
import { calculateFixtureRenderValues } from '../../../hooks/useFixtureRender'
import { useControlStore, selectCinemaControl } from '../../../stores/controlStore'
import { useOverrideStore, selectOverrides } from '../../../stores/overrideStore'
import './StageSimulatorCinema.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface StagePreviewProps {
  /** Whether the stage preview is visible */
  visible?: boolean
  /** Optional className for additional styling */
  className?: string
}

/** Extended fixture data for cinema rendering */
interface CinemaFixture {
  id: string
  /** Screen coordinates (computed from zone layout) */
  x: number
  y: number
  /** RGB color (0-255) */
  r: number
  g: number
  b: number
  /** Normalized intensity (0-1) */
  intensity: number
  /** Fixture archetype */
  type: 'par' | 'moving' | 'strobe' | 'laser' | 'wash'
  /** Physical zone from backend */
  zone: CinemaZone
  /** Physics: actual pan position (0-1) */
  physicalPan: number
  /** Physics: actual tilt position (0-1) */
  physicalTilt: number
  /** Optics: zoom (0-255, 0=beam 255=wash) */
  zoom: number
  /** Optics: focus (0-255, 0=sharp 255=soft) */
  focus: number
  /** Gobo wheel 1 (0-255 DMX, 0=open) */
  gobo: number
  /** Prism (0-255 DMX, 0=open) */
  prism: number
  /** Velocity for motion trails */
  panVelocity: number
  tiltVelocity: number
}

type CinemaZone = 
  | 'BACK'
  | 'FRONT'
  | 'MOVING_LEFT'
  | 'MOVING_RIGHT'
  | 'STROBES'
  | 'AMBIENT'
  | 'FLOOR'
  | 'AIR'
  | 'CENTER'

// ═══════════════════════════════════════════════════════════════════════════
// CINEMA CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Zone Y positions (normalized 0-1, 0=top, 1=bottom) */
const ZONE_LAYOUT: Record<CinemaZone, { y: number; xCenter: number; spread: number }> = {
  BACK:          { y: 0.18, xCenter: 0.50, spread: 0.70 },
  AIR:           { y: 0.32, xCenter: 0.50, spread: 0.40 },
  MOVING_LEFT:   { y: 0.45, xCenter: 0.12, spread: 0.00 },
  CENTER:        { y: 0.50, xCenter: 0.50, spread: 0.30 },
  STROBES:       { y: 0.50, xCenter: 0.50, spread: 0.50 },
  MOVING_RIGHT:  { y: 0.45, xCenter: 0.88, spread: 0.00 },
  FRONT:         { y: 0.78, xCenter: 0.50, spread: 0.70 },
  AMBIENT:       { y: 0.90, xCenter: 0.50, spread: 0.80 },
  FLOOR:         { y: 0.92, xCenter: 0.50, spread: 0.80 },
} as const

/** Beam projection constants */
const BEAM = {
  MAX_THROW: 0.45,         // Maximum beam length (fraction of canvas height)
  MIN_WIDTH_DEG: 4,        // Minimum beam angle in degrees (tight beam)
  MAX_WIDTH_DEG: 60,       // Maximum beam angle in degrees (wide wash)
  TRAIL_DECAY: 0.08,       // Alpha decay per frame for trails canvas
} as const

/** Visual constants */
// ═══════════════════════════════════════════════════════════════════════════
// 🔧 WAVE 2040.31: LAYOUT POLISHING
// PARs demasiado invasivos — bajamos glow de 6.0 a 4.5 (presencia sin invasión)
// ═══════════════════════════════════════════════════════════════════════════
const CINEMA = {
  FIXTURE_RADIUS_RATIO: 0.070,  // Fixture dot size — DUPLICADO (↑ from 0.045)
  GLOW_MULTIPLIER: 4.0,         // Glow radius for MOVERS (↑ from 3.5)
  PAR_GLOW_MULTIPLIER: 4.5,     // PARs diffuse glow (↓ from 6.0 to reduce invasion)
  GRID_OPACITY: 0.04,           // Tactical grid subtlety
  GRID_SPACING: 24,             // Grid cell size in CSS pixels
  STAGE_LINE_Y: 0.85,           // Front-of-stage line
  STAGE_PADDING: 0.05,          // Stage edge padding (5% confirmed)
  FPS: 30,                      // Target FPS for preview
  GOBO_SEGMENTS: 6,             // Star pattern segments for gobo indicator
} as const

const COLORS = {
  background: '#08080d',
  grid: `rgba(100, 140, 255, ${CINEMA.GRID_OPACITY})`,
  stageLine: 'rgba(255, 0, 255, 0.12)',
  fixtureOff: '#14142a',
  fixtureOffStroke: '#252550',
  beamEdge: 0.04,                // Beam edge alpha falloff
} as const

// ═══════════════════════════════════════════════════════════════════════════
// 🧠 WAVE 2046: HIT-TEST CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Hit-test radius in normalized space (0-1). 
 *  If distance(click, fixture) < this → CONTACT */
const HIT_RADIUS = 0.055

/** Selection ring visual constants */
const SELECTION = {
  /** Ring color (cyan neon) */
  RING_COLOR: '#00F0FF',
  /** Hover ring color (magenta) */
  HOVER_COLOR: '#FF00E5',
  /** Ring line width in CSS pixels */
  RING_WIDTH: 2.5,
  /** Ring radius multiplier over fixture radius */
  RING_RADIUS_FACTOR: 1.8,
  /** Hover ring radius (slightly larger) */
  HOVER_RADIUS_FACTOR: 2.0,
  /** Glow size for selected fixtures */
  GLOW_SIZE: 8,
} as const

// ═══════════════════════════════════════════════════════════════════════════
// PURE MATH HELPERS (DETERMINISTIC — NO Math.random)
// ═══════════════════════════════════════════════════════════════════════════

/** Linear interpolation */
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/** Map value from one range to another (clamped) */
const mapRange = (v: number, inMin: number, inMax: number, outMin: number, outMax: number): number => {
  const t = Math.max(0, Math.min(1, (v - inMin) / (inMax - inMin)))
  return outMin + t * (outMax - outMin)
}

/** Degrees to radians */
const deg2rad = (d: number): number => d * (Math.PI / 180)

/**
 * Arc distribution: place N items along an arc centered at xCenter.
 * Returns normalized x positions [0,1].
 */
const arcDistribute = (
  index: number, 
  count: number, 
  xCenter: number, 
  spread: number
): number => {
  if (count <= 1) return xCenter
  // Even spacing with margins
  const margin = (1 - spread) / 2
  const start = margin
  const end = 1 - margin
  const step = (end - start) / (count - 1)
  return start + step * index
}

/**
 * Vertical distribution for side-mounted fixtures (MOVING_LEFT, MOVING_RIGHT).
 * Spreads fixtures vertically from y=0.30 to y=0.65
 */
const verticalDistribute = (index: number, count: number): number => {
  if (count <= 1) return 0.45
  const yStart = 0.30
  const yEnd = 0.65
  const step = (yEnd - yStart) / (count - 1)
  return yStart + step * index
}

/**
 * Map backend zone string → CinemaZone
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔧 WAVE 2040.29: CANONICAL ZONE RECOGNITION
 * El backend usa CanonicalZone (movers-left, movers-right, front, back...)
 * Pero el Cinema usaba el formato legacy (MOVING_LEFT). Ahora reconoce AMBOS.
 * ═══════════════════════════════════════════════════════════════════════════
 */
const classifyZone = (raw: string): { zone: CinemaZone; type: CinemaFixture['type'] } => {
  // Normalize: lowercase, replace underscores with hyphens
  const normalized = (raw || '').toLowerCase().replace(/_/g, '-')
  
  // MOVERS LEFT: "movers-left", "moving_left", "moving-left", "left"
  if (normalized.includes('movers-left') || normalized.includes('moving-left') || normalized === 'left') {
    return { zone: 'MOVING_LEFT', type: 'moving' }
  }
  // MOVERS RIGHT: "movers-right", "moving_right", "moving-right", "right"
  if (normalized.includes('movers-right') || normalized.includes('moving-right') || normalized === 'right') {
    return { zone: 'MOVING_RIGHT', type: 'moving' }
  }
  // FRONT: "front", "pars-front"
  if (normalized.includes('front')) {
    return { zone: 'FRONT', type: 'par' }
  }
  // BACK: "back", "pars-back"
  if (normalized.includes('back')) {
    return { zone: 'BACK', type: 'par' }
  }
  // STROBE
  if (normalized.includes('strobe')) {
    return { zone: 'STROBES', type: 'strobe' }
  }
  // AMBIENT
  if (normalized.includes('ambient')) {
    return { zone: 'AMBIENT', type: 'wash' }
  }
  // FLOOR
  if (normalized.includes('floor')) {
    return { zone: 'FLOOR', type: 'wash' }
  }
  // AIR
  if (normalized.includes('air')) {
    return { zone: 'AIR', type: 'moving' }
  }
  // CENTER: default fallback
  return { zone: 'CENTER', type: 'par' }
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDER ENGINE (Pure Canvas 2D — no external deps)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Draw tactical grid on the fixtures canvas
 */
const drawGrid = (ctx: CanvasRenderingContext2D, w: number, h: number): void => {
  ctx.strokeStyle = COLORS.grid
  ctx.lineWidth = 0.5
  
  for (let x = 0; x < w; x += CINEMA.GRID_SPACING) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
  }
  for (let y = 0; y < h; y += CINEMA.GRID_SPACING) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }
}

/**
 * Draw front-of-stage line
 */
const drawStageLine = (ctx: CanvasRenderingContext2D, w: number, h: number): void => {
  const y = h * CINEMA.STAGE_LINE_Y
  ctx.strokeStyle = COLORS.stageLine
  ctx.lineWidth = 1.5
  ctx.setLineDash([6, 4])
  ctx.beginPath()
  ctx.moveTo(0, y)
  ctx.lineTo(w, y)
  ctx.stroke()
  ctx.setLineDash([])
}

/**
 * 🔺 BEAM RENDERING: Vectorial triangle projection
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔧 WAVE 2040.29: PAR vs MOVER DIFFERENTIATION
 * - MOVERS: Beam triangular gordo y brillante con física de pan/tilt
 * - PARs: SIN haz triangular — solo glow difuso (manejado en drawFixture)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * The beam is a filled triangle from the fixture point to a projected base.
 * - angle = physicalPan mapped to rotation (0→left, 0.5→down, 1→right)
 * - length = physicalTilt mapped to throw distance (0.5=straight down → max)
 * - width = zoom mapped to cone angle
 */
const drawBeam = (
  ctx: CanvasRenderingContext2D,
  fx: number,
  fy: number,
  fixture: CinemaFixture,
  canvasH: number
): void => {
  const { r, g, b, intensity, physicalPan, physicalTilt, zoom, type, focus } = fixture
  
  // No beam if off
  if (intensity < 0.02) return
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🔧 WAVE 2040.29: PARs NO dibujan haz triangular
  // Los PARs son wash fijos — su luz es DIFUSA, no direccional.
  // Todo su impacto visual viene del glow en drawFixture().
  // ═══════════════════════════════════════════════════════════════════════
  if (type === 'par' || type === 'wash') return
  
  // MOVERS: Beam angle: pan 0→ -π/2 (left), 0.5→ 0 (straight down), 1→ π/2 (right)
  const panAngle = mapRange(physicalPan, 0, 1, -Math.PI * 0.45, Math.PI * 0.45)
  
  // Beam throw: tilt 0→ short, 0.5→ full, 1→ short (tilted back)
  // Parabolic curve: max throw at tilt=0.5
  const tiltFactor = 1 - Math.abs(physicalTilt - 0.5) * 2 // 0.5→1.0, edges→0.0
  const throwLength = canvasH * BEAM.MAX_THROW * Math.max(0.15, tiltFactor)
  
  // Beam cone angle: zoom 0=tight beam, 255=wide wash
  const coneAngleDeg = mapRange(zoom, 0, 255, BEAM.MIN_WIDTH_DEG, BEAM.MAX_WIDTH_DEG)
  const halfCone = deg2rad(coneAngleDeg / 2)
  
  // Focus affects edge sharpness (0=sharp, 255=diffuse)
  const edgeAlpha = mapRange(focus, 0, 255, 0.15, 0.04)
  
  // Triangle vertices
  const endX = fx + Math.sin(panAngle) * throwLength
  const endY = fy + Math.cos(panAngle) * throwLength  // cos because Y axis goes down
  
  // Base width at the end of the throw
  const baseHalf = Math.tan(halfCone) * throwLength
  
  // Perpendicular to beam direction
  const perpX = Math.cos(panAngle)   // perpendicular component
  const perpY = -Math.sin(panAngle)  // perpendicular component
  
  const leftX = endX - perpX * baseHalf
  const leftY = endY - perpY * baseHalf
  const rightX = endX + perpX * baseHalf
  const rightY = endY + perpY * baseHalf
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🔧 WAVE 2040.30: DOUBLE LAYER "LIGHTSABER" BEAM
  // Capa 1: Cuerpo de color (ancho completo, opacidad 0.7)
  // Capa 2: Núcleo blanco puro (20% del ancho, opacidad 0.9)
  // Resultado: Haz que parece cortar el aire con centro caliente
  // ═══════════════════════════════════════════════════════════════════════
  
  // LAYER 1: COLOR BODY (full width)
  const bodyGrad = ctx.createLinearGradient(fx, fy, endX, endY)
  const bodyAlpha = intensity * 0.70  // Increased opacity (↑ from 0.40)
  bodyGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${bodyAlpha})`)
  bodyGrad.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, ${bodyAlpha * 0.6})`)
  bodyGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${bodyAlpha * 0.2})`)
  
  ctx.beginPath()
  ctx.moveTo(fx, fy)
  ctx.lineTo(leftX, leftY)
  ctx.lineTo(rightX, rightY)
  ctx.closePath()
  ctx.fillStyle = bodyGrad
  ctx.fill()
  
  // LAYER 2: WHITE HOT CORE (20% width, center line)
  const coreWidth = baseHalf * 0.20  // Core is 20% of beam width
  const coreLeftX = endX - perpX * coreWidth
  const coreLeftY = endY - perpY * coreWidth
  const coreRightX = endX + perpX * coreWidth
  const coreRightY = endY + perpY * coreWidth
  
  const coreGrad = ctx.createLinearGradient(fx, fy, endX, endY)
  const coreAlpha = intensity * 0.90  // Near-opaque white core
  coreGrad.addColorStop(0, `rgba(255, 255, 255, ${coreAlpha})`)
  coreGrad.addColorStop(0.5, `rgba(255, 255, 255, ${coreAlpha * 0.7})`)
  coreGrad.addColorStop(1, `rgba(255, 255, 255, ${coreAlpha * 0.3})`)
  
  ctx.beginPath()
  ctx.moveTo(fx, fy)
  ctx.lineTo(coreLeftX, coreLeftY)
  ctx.lineTo(coreRightX, coreRightY)
  ctx.closePath()
  ctx.fillStyle = coreGrad
  ctx.fill()
}

/**
 * 🎯 GOBO INDICATOR: Geometric star pattern inside fixture circle
 * Only shown when gobo > 0 (gobo wheel is not on "open")
 */
const drawGoboIndicator = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  gobo: number,
  r: number,
  g: number,
  b: number
): void => {
  if (gobo < 5) return  // Open gobo, no indicator
  
  const segments = CINEMA.GOBO_SEGMENTS
  const innerRadius = radius * 0.25
  const outerRadius = radius * 0.70
  // Deterministic rotation based on gobo value (each gobo gets a fixed angle offset)
  const rotationOffset = (gobo / 255) * Math.PI * 2
  
  ctx.beginPath()
  for (let i = 0; i < segments * 2; i++) {
    const angle = rotationOffset + (i * Math.PI) / segments
    const rad = i % 2 === 0 ? outerRadius : innerRadius
    const px = cx + Math.cos(angle) * rad
    const py = cy + Math.sin(angle) * rad
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  
  // Fill with darkened version of fixture color
  ctx.fillStyle = `rgba(${Math.floor(r * 0.3)}, ${Math.floor(g * 0.3)}, ${Math.floor(b * 0.3)}, 0.8)`
  ctx.fill()
}

/**
 * 💎 PRISM INDICATOR: Small triangular refraction marks around fixture
 */
const drawPrismIndicator = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  prism: number,
  r: number,
  g: number,
  b: number
): void => {
  if (prism < 5) return  // No prism active
  
  const prismAlpha = mapRange(prism, 5, 255, 0.2, 0.7)
  const prismRadius = radius * 1.4
  // 3 refraction marks at 120° intervals
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3 - Math.PI / 2
    const px = cx + Math.cos(angle) * prismRadius
    const py = cy + Math.sin(angle) * prismRadius
    const dotR = radius * 0.15
    
    ctx.beginPath()
    ctx.arc(px, py, dotR, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${prismAlpha})`
    ctx.fill()
  }
}

/**
 * Draw a single fixture (core dot + glow)
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔧 WAVE 2040.29: PAR vs MOVER VISUAL DIFFERENTIATION
 * - PARs: Glow grande y difuso (PAR_GLOW_MULTIPLIER) — representan wash
 * - MOVERs: Glow más compacto (GLOW_MULTIPLIER) — su "luz" es el haz
 * ═══════════════════════════════════════════════════════════════════════════
 */
const drawFixture = (
  ctx: CanvasRenderingContext2D,
  fx: number,
  fy: number,
  fixture: CinemaFixture,
  fixtureRadius: number
): void => {
  const { r, g, b, intensity, gobo, prism, type } = fixture
  
  if (intensity > 0.01) {
    // ═══════════════════════════════════════════════════════════════════════
    // 🔧 WAVE 2040.29: GLOW SIZE BY FIXTURE TYPE
    // PARs = wash difuso grande | Movers = glow compacto (su luz es el beam)
    // ═══════════════════════════════════════════════════════════════════════
    const isPar = type === 'par' || type === 'wash'
    const glowMultiplier = isPar ? CINEMA.PAR_GLOW_MULTIPLIER : CINEMA.GLOW_MULTIPLIER
    
    // === GLOW (outer radial gradient) ===
    const glowR = fixtureRadius * (glowMultiplier + intensity * 1.5)
    const glowGrad = ctx.createRadialGradient(fx, fy, 0, fx, fy, glowR)
    
    // PARs: glow más suave y difuso | Movers: glow más concentrado
    const innerAlpha = isPar ? intensity * 0.45 : intensity * 0.55
    const midAlpha = isPar ? intensity * 0.22 : intensity * 0.18
    
    glowGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${innerAlpha})`)
    glowGrad.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, ${midAlpha})`)
    glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
    
    ctx.beginPath()
    ctx.arc(fx, fy, glowR, 0, Math.PI * 2)
    ctx.fillStyle = glowGrad
    ctx.fill()
    
    // === CORE DOT ===
    const coreR = fixtureRadius * 0.65
    ctx.beginPath()
    ctx.arc(fx, fy, coreR, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(1, intensity + 0.3)})`
    ctx.fill()
    
    // === GOBO INDICATOR (solo movers) ===
    if (!isPar) {
      drawGoboIndicator(ctx, fx, fy, coreR, gobo, r, g, b)
    }
    
    // === PRISM INDICATOR (solo movers) ===
    if (!isPar) {
      drawPrismIndicator(ctx, fx, fy, coreR, prism, r, g, b)
    }
    
  } else {
    // === OFF STATE ===
    const offR = fixtureRadius * 0.5
    ctx.beginPath()
    ctx.arc(fx, fy, offR, 0, Math.PI * 2)
    ctx.fillStyle = COLORS.fixtureOff
    ctx.fill()
    ctx.strokeStyle = COLORS.fixtureOffStroke
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

/**
 * Draw trail echo on trails canvas (long-exposure motion effect)
 * Only for moving fixtures with active velocity
 */
const drawTrailEcho = (
  ctx: CanvasRenderingContext2D,
  fx: number,
  fy: number,
  fixture: CinemaFixture,
  fixtureRadius: number
): void => {
  const { r, g, b, intensity, panVelocity, tiltVelocity } = fixture
  
  // Only draw trails if fixture has velocity and is lit
  const speed = Math.abs(panVelocity) + Math.abs(tiltVelocity)
  if (speed < 0.005 || intensity < 0.03) return
  
  // Trail intensity scales with speed and fixture brightness
  const trailAlpha = Math.min(0.4, speed * 0.8) * intensity
  const trailR = fixtureRadius * 0.8
  
  ctx.beginPath()
  ctx.arc(fx, fy, trailR, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${trailAlpha})`
  ctx.fill()
}

// ═══════════════════════════════════════════════════════════════════════════
// 🧠 WAVE 2046: SELECTION & HOVER RING RENDERING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Draw selection ring around a fixture (cyan neon pulsing ring)
 */
const drawSelectionRing = (
  ctx: CanvasRenderingContext2D,
  fx: number,
  fy: number,
  fixtureRadius: number,
): void => {
  const ringRadius = fixtureRadius * SELECTION.RING_RADIUS_FACTOR
  
  // Outer glow
  ctx.beginPath()
  ctx.arc(fx, fy, ringRadius + 2, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(0, 240, 255, 0.15)`
  ctx.lineWidth = SELECTION.GLOW_SIZE
  ctx.stroke()
  
  // Main ring
  ctx.beginPath()
  ctx.arc(fx, fy, ringRadius, 0, Math.PI * 2)
  ctx.strokeStyle = SELECTION.RING_COLOR
  ctx.lineWidth = SELECTION.RING_WIDTH
  ctx.stroke()
  
  // Inner accent (thin white)
  ctx.beginPath()
  ctx.arc(fx, fy, ringRadius - 2, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(255, 255, 255, 0.25)`
  ctx.lineWidth = 0.5
  ctx.stroke()
}

/**
 * Draw hover ring around a fixture (magenta neon ring)
 */
const drawHoverRing = (
  ctx: CanvasRenderingContext2D,
  fx: number,
  fy: number,
  fixtureRadius: number,
): void => {
  const ringRadius = fixtureRadius * SELECTION.HOVER_RADIUS_FACTOR
  
  // Glow
  ctx.beginPath()
  ctx.arc(fx, fy, ringRadius + 1, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(255, 0, 229, 0.12)`
  ctx.lineWidth = 6
  ctx.stroke()
  
  // Main ring (dashed)
  ctx.setLineDash([4, 3])
  ctx.beginPath()
  ctx.arc(fx, fy, ringRadius, 0, Math.PI * 2)
  ctx.strokeStyle = SELECTION.HOVER_COLOR
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.setLineDash([])
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const StagePreview: React.FC<StagePreviewProps> = memo(({
  visible = true,
  className = ''
}) => {
  // Canvas refs: double buffer
  const trailsCanvasRef = useRef<HTMLCanvasElement>(null)
  const fixturesCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>(0)
  const lastFrameRef = useRef<number>(0)
  
  const FRAME_INTERVAL = 1000 / CINEMA.FPS
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🧠 WAVE 2046: SELECTION & HOVER STATE
  // ═══════════════════════════════════════════════════════════════════════
  
  const selectedIds = useSelectionStore(state => state.selectedIds)
  const hoveredId = useSelectionStore(state => state.hoveredId)
  const setHovered = useSelectionStore(state => state.setHovered)
  const handleSelectionClick = useSelectionClick()
  
  // Ref para acceder a fixtures en event handlers sin re-render
  const fixturesRef = useRef<CinemaFixture[]>([])
  
  // All fixture IDs for Shift+Click range selection
  const allFixtureIds = useMemo(() => {
    return fixturesRef.current.map(f => f.id)
  }, [fixturesRef.current])
  
  // ═══════════════════════════════════════════════════════════════════════
  // STORE SUBSCRIPTIONS
  // ═══════════════════════════════════════════════════════════════════════
  
  const hardware = useHardware() // 🛡️ WAVE 2042.12: React 19 stable hook
  const stageFixtures = useStageStore(state => state.fixtures)
  
  // 🛡️ WAVE 2042.13.8: Consolidated selector with useShallow
  const {
    globalMode,
    flowParams,
    activePaletteId,
    globalIntensity,
    globalSaturation,
    targetPalette,
    transitionProgress,
  } = useControlStore(useShallow(selectCinemaControl))
  
  const overrides = useOverrideStore(selectOverrides)
  
  // ═══════════════════════════════════════════════════════════════════════
  // RUNTIME STATE MAP (backend fixtures by ID)
  // ═══════════════════════════════════════════════════════════════════════
  
  const runtimeStateMap = useMemo(() => {
    const map = new Map<string, any>()
    const backendFixtures = hardware?.fixtures || []
    if (Array.isArray(backendFixtures)) {
      backendFixtures.forEach(f => {
        if (f?.id) map.set(f.id, f)
      })
    }
    return map
  }, [hardware?.fixtures])
  
  // ═══════════════════════════════════════════════════════════════════════
  // FIXTURE PROCESSING: Truth → CinemaFixture[]
  // ═══════════════════════════════════════════════════════════════════════
  
  const fixtures = useMemo((): CinemaFixture[] => {
    const fixtureArray = stageFixtures || []
    if (!Array.isArray(fixtureArray) || fixtureArray.length === 0) return []
    
    // First pass: classify zones and count per zone
    const classified = fixtureArray.map((fixture, index) => {
      if (!fixture) return null
      
      const runtimeState = runtimeStateMap.get(fixture.id)
      const fixtureId = fixture.id || `fixture-${fixture.address}`
      const fixtureOverride = overrides.get(fixtureId)
      
      const backendZone = (runtimeState?.zone || fixture.zone || '').toUpperCase()
      const { zone, type } = classifyZone(backendZone)
      
      // Get full render values (color, intensity, optics, physics)
      const renderData = calculateFixtureRenderValues(
        runtimeState || fixture,
        globalMode,
        flowParams,
        activePaletteId,
        globalIntensity,
        globalSaturation,
        index,
        fixtureOverride?.values,
        fixtureOverride?.mask,
        targetPalette,
        transitionProgress
      )
      
      // Normalize intensity
      const rawIntensity = renderData.intensity ?? 0
      const normalizedIntensity = !Number.isFinite(rawIntensity)
        ? 0
        : rawIntensity > 1.0
          ? rawIntensity / 255
          : rawIntensity
      const safeIntensity = Math.max(0, Math.min(1, normalizedIntensity))
      
      // Extract gobo/prism from truthData (dynamically assigned by TitanOrchestrator)
      const truthSource = runtimeState || fixture
      const gobo = truthSource?.gobo ?? 0
      const prism = truthSource?.prism ?? 0
      
      return {
        id: fixtureId,
        x: 0,  // Will be computed in layout pass
        y: 0,
        // ═══════════════════════════════════════════════════════════════
        // 🔧 WAVE 2040.22c: NaN GUARD FOR COLOR VALUES
        // Hephaestus color curves can produce NaN if HSL→RGB conversion
        // receives malformed input. Canvas will crash on rgba(NaN,...).
        // Fallback: 0 (black) — safe and visible as "something's wrong"
        // ═══════════════════════════════════════════════════════════════
        r: Number.isFinite(renderData.color.r) ? renderData.color.r : 0,
        g: Number.isFinite(renderData.color.g) ? renderData.color.g : 0,
        b: Number.isFinite(renderData.color.b) ? renderData.color.b : 0,
        intensity: safeIntensity,
        type,
        zone,
        // ═══════════════════════════════════════════════════════════════
        // 🔧 WAVE 2040.2: REINFORCED NaN GUARD FOR CINEMA RENDERER
        // Si physicalPan/physicalTilt llegan corruptos (NaN/Infinity),
        // el canvas NO debe pintarse con valores inválidos.
        // Fallback: 0.5 (center position)
        // ═══════════════════════════════════════════════════════════════
        physicalPan: Number.isFinite(renderData.physicalPan) ? renderData.physicalPan : 0.5,
        physicalTilt: Number.isFinite(renderData.physicalTilt) ? renderData.physicalTilt : 0.5,
        zoom: Number.isFinite(renderData.zoom) ? renderData.zoom : 127,
        focus: Number.isFinite(renderData.focus) ? renderData.focus : 127,
        gobo,
        prism,
        panVelocity: Number.isFinite(renderData.panVelocity) ? renderData.panVelocity : 0,
        tiltVelocity: Number.isFinite(renderData.tiltVelocity) ? renderData.tiltVelocity : 0,
      } satisfies CinemaFixture
    }).filter(Boolean) as CinemaFixture[]
    
    // Second pass: compute screen positions based on zone layout
    // Group by zone to compute arc positions
    const byZone = new Map<CinemaZone, number[]>()
    classified.forEach((f, i) => {
      const arr = byZone.get(f.zone) || []
      arr.push(i)
      byZone.set(f.zone, arr)
    })
    
    byZone.forEach((indices, zone) => {
      const layout = ZONE_LAYOUT[zone]
      const count = indices.length
      const isVertical = zone === 'MOVING_LEFT' || zone === 'MOVING_RIGHT'
      
      indices.forEach((globalIdx, localIdx) => {
        const fixture = classified[globalIdx]
        if (isVertical) {
          // Side-mounted: fixed X, spread Y
          fixture.x = layout.xCenter
          fixture.y = verticalDistribute(localIdx, count)
        } else {
          // Horizontal row: arc distribute X, fixed Y
          fixture.x = arcDistribute(localIdx, count, layout.xCenter, layout.spread)
          fixture.y = layout.y
        }
      })
    })
    
    return classified
  }, [
    stageFixtures, runtimeStateMap, overrides, globalMode, flowParams,
    activePaletteId, globalIntensity, globalSaturation, targetPalette, transitionProgress
  ])
  
  // Keep fixturesRef in sync for event handlers (avoids stale closure)
  useEffect(() => {
    fixturesRef.current = fixtures
  }, [fixtures])
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🧠 WAVE 2046: HIT-TEST ENGINE
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Hit-test: Find the closest fixture to a normalized click point.
   * Returns the fixture ID if within HIT_RADIUS, or null if clicked on empty space.
   * 
   * Uses euclidean distance with aspect ratio correction:
   *   dist = sqrt((fx.x - mx)² + (fx.y - my)²)
   *   if dist < HIT_RADIUS → CONTACT
   * 
   * When multiple fixtures overlap, returns the NEAREST one (shortest distance).
   */
  const hitTest = useCallback((normalizedX: number, normalizedY: number): CinemaFixture | null => {
    const currentFixtures = fixturesRef.current
    if (currentFixtures.length === 0) return null
    
    let closestFixture: CinemaFixture | null = null
    let closestDist = Infinity
    
    for (const fixture of currentFixtures) {
      const dx = fixture.x - normalizedX
      const dy = fixture.y - normalizedY
      const dist = Math.sqrt(dx * dx + dy * dy)
      
      if (dist < HIT_RADIUS && dist < closestDist) {
        closestDist = dist
        closestFixture = fixture
      }
    }
    
    return closestFixture
  }, [])
  
  /**
   * Convert mouse event to normalized coordinates (0-1)
   */
  const eventToNormalized = useCallback((e: React.MouseEvent): { x: number; y: number } | null => {
    const container = containerRef.current
    if (!container) return null
    
    const rect = container.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    }
  }, [])
  
  /**
   * 🖱️ CLICK HANDLER: Select fixture or deselect all
   * - Normal click: Replace selection with clicked fixture
   * - Ctrl/Cmd + Click: Toggle individual fixture
   * - Shift + Click: Range selection (between last selected and clicked)
   * - Click on empty space: Deselect all
   */
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    const point = eventToNormalized(e)
    if (!point) return
    
    const hit = hitTest(point.x, point.y)
    
    if (hit) {
      // Fixture hit → delegate to selection handler (handles Shift, Ctrl, normal click)
      const ids = fixturesRef.current.map(f => f.id)
      handleSelectionClick(hit.id, e, ids)
    } else {
      // Empty space click → deselect all
      useSelectionStore.getState().deselectAll()
    }
  }, [eventToNormalized, hitTest, handleSelectionClick])
  
  /**
   * 🖱️ HOVER HANDLER: Update hoveredId for visual feedback
   */
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    const point = eventToNormalized(e)
    if (!point) return
    
    const hit = hitTest(point.x, point.y)
    const newHoveredId = hit?.id ?? null
    
    // Only update store if hoveredId actually changed (avoid re-renders)
    if (newHoveredId !== useSelectionStore.getState().hoveredId) {
      setHovered(newHoveredId)
    }
  }, [eventToNormalized, hitTest, setHovered])
  
  /**
   * 🖱️ MOUSE LEAVE: Clear hover
   */
  const handleCanvasMouseLeave = useCallback(() => {
    if (useSelectionStore.getState().hoveredId !== null) {
      setHovered(null)
    }
  }, [setHovered])
  
  // ═══════════════════════════════════════════════════════════════════════
  // RENDER FRAME
  // ═══════════════════════════════════════════════════════════════════════
  
  const renderFrame = useCallback(() => {
    const trailsCanvas = trailsCanvasRef.current
    const fixturesCanvas = fixturesCanvasRef.current
    if (!trailsCanvas || !fixturesCanvas) return
    
    const trailsCtx = trailsCanvas.getContext('2d')
    const fixturesCtx = fixturesCanvas.getContext('2d')
    if (!trailsCtx || !fixturesCtx) return
    
    // We work in CSS-pixel space (DPR scaling handled by ResizeObserver)
    const w = fixturesCanvas.width
    const h = fixturesCanvas.height
    if (w === 0 || h === 0) return
    
    const fixtureRadius = Math.min(w, h) * CINEMA.FIXTURE_RADIUS_RATIO
    
    // ─── TRAILS CANVAS: Fade + new echoes ─────────────────────────
    // Apply semi-transparent black overlay to fade previous trails
    trailsCtx.fillStyle = `rgba(8, 8, 13, ${BEAM.TRAIL_DECAY})`
    trailsCtx.fillRect(0, 0, w, h)
    
    // Paint new trail echoes for moving fixtures
    fixtures.forEach(fixture => {
      if (fixture.type !== 'moving') return
      const fx = fixture.x * w
      const fy = fixture.y * h
      drawTrailEcho(trailsCtx, fx, fy, fixture, fixtureRadius)
    })
    
    // ─── FIXTURES CANVAS: Clear + full redraw ─────────────────────
    fixturesCtx.clearRect(0, 0, w, h)
    
    // Background
    fixturesCtx.fillStyle = COLORS.background
    fixturesCtx.fillRect(0, 0, w, h)
    
    // Tactical grid
    drawGrid(fixturesCtx, w, h)
    
    // Front-of-stage line
    drawStageLine(fixturesCtx, w, h)
    
    // Draw beams FIRST (behind fixtures)
    fixtures.forEach(fixture => {
      const fx = fixture.x * w
      const fy = fixture.y * h
      drawBeam(fixturesCtx, fx, fy, fixture, h)
    })
    
    // Draw fixture dots ON TOP
    fixtures.forEach(fixture => {
      const fx = fixture.x * w
      const fy = fixture.y * h
      drawFixture(fixturesCtx, fx, fy, fixture, fixtureRadius)
    })
    
    // ═══════════════════════════════════════════════════════════════════
    // 🧠 WAVE 2046: SELECTION & HOVER RINGS (drawn on top of everything)
    // ═══════════════════════════════════════════════════════════════════
    
    // Read current selection state directly (avoid stale closure)
    const currentSelectedIds = useSelectionStore.getState().selectedIds
    const currentHoveredId = useSelectionStore.getState().hoveredId
    
    // Draw selection rings
    fixtures.forEach(fixture => {
      if (!currentSelectedIds.has(fixture.id)) return
      const fx = fixture.x * w
      const fy = fixture.y * h
      drawSelectionRing(fixturesCtx, fx, fy, fixtureRadius)
    })
    
    // Draw hover ring (only if not already selected — avoid double ring)
    if (currentHoveredId && !currentSelectedIds.has(currentHoveredId)) {
      const hoveredFixture = fixtures.find(f => f.id === currentHoveredId)
      if (hoveredFixture) {
        const fx = hoveredFixture.x * w
        const fy = hoveredFixture.y * h
        drawHoverRing(fixturesCtx, fx, fy, fixtureRadius)
      }
    }
  }, [fixtures])
  
  // ═══════════════════════════════════════════════════════════════════════
  // ANIMATION LOOP (30fps limiter)
  // ═══════════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    if (!visible) return
    
    const animate = (timestamp: number) => {
      const elapsed = timestamp - lastFrameRef.current
      
      if (elapsed >= FRAME_INTERVAL) {
        lastFrameRef.current = timestamp - (elapsed % FRAME_INTERVAL)
        renderFrame()
      }
      
      animationRef.current = requestAnimationFrame(animate)
    }
    
    animationRef.current = requestAnimationFrame(animate)
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [renderFrame, FRAME_INTERVAL, visible])
  
  // ═══════════════════════════════════════════════════════════════════════
  // RESIZE OBSERVER (DPR-aware canvas sizing)
  // ═══════════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    const container = containerRef.current
    const trailsCanvas = trailsCanvasRef.current
    const fixturesCanvas = fixturesCanvasRef.current
    if (!container || !trailsCanvas || !fixturesCanvas) return
    
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width === 0 || height === 0) continue
        
        const dpr = Math.min(window.devicePixelRatio, 2)
        const canvasW = Math.round(width * dpr)
        const canvasH = Math.round(height * dpr)
        
        // Size both canvases identically
        for (const canvas of [trailsCanvas, fixturesCanvas]) {
          canvas.width = canvasW
          canvas.height = canvasH
          canvas.style.width = `${width}px`
          canvas.style.height = `${height}px`
          
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.scale(dpr, dpr)
          }
        }
        
        // Clear trails on resize to avoid stretched artifacts
        const trailsCtx = trailsCanvas.getContext('2d')
        if (trailsCtx) {
          trailsCtx.fillStyle = COLORS.background
          trailsCtx.fillRect(0, 0, canvasW, canvasH)
        }
      }
    })
    
    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [])
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🧠 WAVE 2046: CURSOR STYLE (pointer when hovering over a fixture)
  // ═══════════════════════════════════════════════════════════════════════
  
  const cursorStyle = hoveredId ? 'pointer' : 'default'
  
  // ═══════════════════════════════════════════════════════════════════════
  // JSX
  // ═══════════════════════════════════════════════════════════════════════
  
  const containerClasses = [
    'stage-cinema',
    !visible && 'stage-cinema--hidden',
    className
  ].filter(Boolean).join(' ')
  
  return (
    <div className={containerClasses} ref={containerRef}>
      <canvas ref={trailsCanvasRef} className="stage-cinema__trails" />
      <canvas ref={fixturesCanvasRef} className="stage-cinema__fixtures" />
      {/* 🧠 WAVE 2046: Hit-test overlay — captures mouse events without interfering with render */}
      <div
        className="stage-cinema__interaction"
        style={{ cursor: cursorStyle }}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={handleCanvasMouseLeave}
      />
      <div className="stage-cinema__badge">CINEMA</div>
    </div>
  )
})

StagePreview.displayName = 'StageSimulatorCinema'
