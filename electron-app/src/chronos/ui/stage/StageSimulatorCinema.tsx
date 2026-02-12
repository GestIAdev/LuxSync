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

import React, { useRef, useEffect, useMemo, useCallback, memo } from 'react'
import { useTruthStore, selectHardware } from '../../../stores/truthStore'
import { useStageStore } from '../../../stores/stageStore'
import { calculateFixtureRenderValues } from '../../../hooks/useFixtureRender'
import { useControlStore } from '../../../stores/controlStore'
import { useOverrideStore } from '../../../stores/overrideStore'
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
const CINEMA = {
  FIXTURE_RADIUS_RATIO: 0.035,  // Fixture dot size relative to min(w,h)
  GLOW_MULTIPLIER: 2.5,         // Glow radius relative to fixture radius
  GRID_OPACITY: 0.04,           // Tactical grid subtlety
  GRID_SPACING: 24,             // Grid cell size in CSS pixels
  STAGE_LINE_Y: 0.85,           // Front-of-stage line
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
 */
const classifyZone = (raw: string): { zone: CinemaZone; type: CinemaFixture['type'] } => {
  const upper = (raw || '').toUpperCase()
  
  if (upper.includes('MOVING_LEFT') || upper === 'LEFT') {
    return { zone: 'MOVING_LEFT', type: 'moving' }
  }
  if (upper.includes('MOVING_RIGHT') || upper === 'RIGHT') {
    return { zone: 'MOVING_RIGHT', type: 'moving' }
  }
  if (upper.includes('FRONT')) {
    return { zone: 'FRONT', type: 'par' }
  }
  if (upper.includes('BACK')) {
    return { zone: 'BACK', type: 'par' }
  }
  if (upper.includes('STROBE')) {
    return { zone: 'STROBES', type: 'strobe' }
  }
  if (upper.includes('AMBIENT')) {
    return { zone: 'AMBIENT', type: 'wash' }
  }
  if (upper.includes('FLOOR')) {
    return { zone: 'FLOOR', type: 'wash' }
  }
  if (upper.includes('AIR')) {
    return { zone: 'AIR', type: 'moving' }
  }
  // Default: CENTER
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
 * 
 * The beam is a filled triangle from the fixture point to a projected base.
 * - angle = physicalPan mapped to rotation (0→left, 0.5→down, 1→right)
 * - length = physicalTilt mapped to throw distance (0.5=straight down → max)
 * - width = zoom mapped to cone angle
 * 
 * For PARs (no pan/tilt): just a downward wash (tilt=0.5, pan=0.5)
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
  
  // PARs don't have moving beams — just a soft downward wash
  const isMoving = type === 'moving'
  
  // Beam angle: pan 0→ -π/2 (left), 0.5→ 0 (straight down), 1→ π/2 (right)
  // For PARs: always straight down
  const panAngle = isMoving
    ? mapRange(physicalPan, 0, 1, -Math.PI * 0.45, Math.PI * 0.45)
    : 0
  
  // Beam throw: tilt 0→ short, 0.5→ full, 1→ short (tilted back)
  // Parabolic curve: max throw at tilt=0.5
  const tiltFactor = isMoving
    ? 1 - Math.abs(physicalTilt - 0.5) * 2 // 0.5→1.0, edges→0.0
    : 0.7 // PARs have fixed medium throw
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
  
  // Create gradient along beam direction
  const grad = ctx.createLinearGradient(fx, fy, endX, endY)
  const alpha = intensity * 0.25  // Beams are translucent
  grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`)
  grad.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, ${alpha * 0.5})`)
  grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${edgeAlpha * intensity})`)
  
  ctx.beginPath()
  ctx.moveTo(fx, fy)
  ctx.lineTo(leftX, leftY)
  ctx.lineTo(rightX, rightY)
  ctx.closePath()
  ctx.fillStyle = grad
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
 */
const drawFixture = (
  ctx: CanvasRenderingContext2D,
  fx: number,
  fy: number,
  fixture: CinemaFixture,
  fixtureRadius: number
): void => {
  const { r, g, b, intensity, gobo, prism } = fixture
  
  if (intensity > 0.01) {
    // === GLOW (outer radial gradient) ===
    const glowR = fixtureRadius * (CINEMA.GLOW_MULTIPLIER + intensity * 1.5)
    const glowGrad = ctx.createRadialGradient(fx, fy, 0, fx, fy, glowR)
    glowGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${intensity * 0.55})`)
    glowGrad.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, ${intensity * 0.18})`)
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
    
    // === GOBO INDICATOR ===
    drawGoboIndicator(ctx, fx, fy, coreR, gobo, r, g, b)
    
    // === PRISM INDICATOR ===
    drawPrismIndicator(ctx, fx, fy, coreR, prism, r, g, b)
    
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
  // STORE SUBSCRIPTIONS
  // ═══════════════════════════════════════════════════════════════════════
  
  const hardware = useTruthStore(selectHardware)
  const stageFixtures = useStageStore(state => state.fixtures)
  const globalMode = useControlStore(state => state.globalMode)
  const flowParams = useControlStore(state => state.flowParams)
  const activePaletteId = useControlStore(state => state.activePalette)
  const globalIntensity = useControlStore(state => state.globalIntensity)
  const globalSaturation = useControlStore(state => state.globalSaturation)
  const targetPalette = useControlStore(state => state.targetPalette)
  const transitionProgress = useControlStore(state => state.transitionProgress)
  const overrides = useOverrideStore(state => state.overrides)
  
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
        r: renderData.color.r,
        g: renderData.color.g,
        b: renderData.color.b,
        intensity: safeIntensity,
        type,
        zone,
        physicalPan: renderData.physicalPan,
        physicalTilt: renderData.physicalTilt,
        zoom: renderData.zoom,
        focus: renderData.focus,
        gobo,
        prism,
        panVelocity: renderData.panVelocity,
        tiltVelocity: renderData.tiltVelocity,
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
      <div className="stage-cinema__badge">CINEMA</div>
    </div>
  )
})

StagePreview.displayName = 'StageSimulatorCinema'
