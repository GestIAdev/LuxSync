/**
 * 🎯 SPATIAL TARGET PAD — WAVE 2611 + 2612 + 2614 + 2615
 * "No le dices al fixture a cuántos grados girar. Le dices dónde mirar."
 *
 * Vista top-down del escenario con target arrastrable + slider de altura.
 * Genera coordenadas Target3D reales (metros) para alimentar al IK engine.
 *
 * ── WAVE 2611: Grid top-down, fixtures como fantasmas, target draggable
 * ── WAVE 2612: Slider vertical para la coordenada Y (altura)
 * ── WAVE 2614: Rayos SVG fixture→target (líneas de visión)
 * ── WAVE 2615: Reachability feedback (rojo/dashed cuando inalcanzable)
 *
 * ── ARQUITECTURA ──
 * SpatialTargetPad → onChange(Target3D) → Orchestrator.applySpatialTarget()
 *                                        → IKEngine.solveGroup()
 *                                        → MasterArbiter.setManualOverride()
 *
 * ── PERFORMANCE ──
 * • RAF throttle en drag (~33 fps), igual que RadarXY WAVE 2190
 * • Posición del target en useRef → sin re-renders durante drag
 * • Solo dispara onChange al flush del RAF frame
 * • SVG rays se actualizan con el target (mismo RAF frame) — sin layout thrash
 */

import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react'
import type { Target3D, IKResult, SpatialFanMode } from '../../../../engine/movement/InverseKinematicsEngine'
import type { Position3D, StageDimensions } from '../../../../core/stage/ShowFileV2'
import './SpatialTargetPad.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Fixture data that the pad needs for rendering ghosts */
export interface SpatialFixtureGhost {
  id: string
  name: string
  position: Position3D
  displayColor?: string
}

export interface SpatialTargetPadProps {
  /** Current target position in meters */
  target: Target3D

  /** Callback when the operator moves the target */
  onChange: (target: Target3D) => void

  /** Fixtures to render as static ghosts on the map */
  fixtures: SpatialFixtureGhost[]

  /** Physical stage dimensions (meters) */
  stage: StageDimensions

  /** Disabled state */
  disabled?: boolean

  /** Optional: callback when operator double-clicks to center */
  onCenter?: () => void

  /**
   * WAVE 2615: Reachability map from IK engine.
   * Keys: fixture IDs, Values: IKResult with reachable flag.
   * When provided, beam rays use this for color feedback.
   */
  reachabilityMap?: Record<string, IKResult>

  // ── WAVE 2624: SPATIAL FAN CONTROLS ──

  /** Current fan mode ('converge' | 'line' | 'circle') */
  fanMode?: SpatialFanMode

  /** Callback when operator changes fan mode */
  onFanModeChange?: (mode: SpatialFanMode) => void

  /** Current fan amplitude in meters (0 = converge, max ~10) */
  fanAmplitude?: number

  /** Callback when operator changes fan amplitude */
  onFanAmplitudeChange?: (amplitude: number) => void

  /**
   * Per-fixture sub-targets computed by the backend (IKFanResult.subTarget).
   * Keys: fixture IDs, Values: Target3D (the point each fixture is aiming at).
   * When provided, beam rays point to these instead of the central target.
   */
  subTargets?: Record<string, Target3D>
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULTS
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_STAGE: StageDimensions = {
  width: 12,
  depth: 10,
  height: 6,
  gridSize: 1,
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const SpatialTargetPad: React.FC<SpatialTargetPadProps> = ({
  target,
  onChange,
  fixtures,
  stage: stageProp,
  disabled = false,
  onCenter,
  reachabilityMap,
  fanMode = 'converge',
  onFanModeChange,
  fanAmplitude = 0,
  onFanAmplitudeChange,
  subTargets,
}) => {
  const stage = stageProp ?? DEFAULT_STAGE

  // ── REFS ──
  const gridRef = useRef<HTMLDivElement>(null)
  const sliderRef = useRef<HTMLDivElement>(null)
  const rafIdRef = useRef<number>(0)
  const pendingGridRef = useRef<{ clientX: number; clientY: number } | null>(null)
  const pendingSliderRef = useRef<{ clientY: number } | null>(null)
  // Mutable target ref to avoid stale closures during RAF drag
  const targetRef = useRef<Target3D>(target)
  targetRef.current = target

  // ── STATE (only for visual feedback, NOT for position tracking) ──
  const [isDraggingGrid, setIsDraggingGrid] = useState(false)
  const [isDraggingSlider, setIsDraggingSlider] = useState(false)

  // ── STAGE COORDINATE MAPPING ──
  // X: -width/2 to +width/2  (left to right)
  // Z: -depth/2 to +depth/2  (back to front)
  //
  // On screen:
  //   Top    = Z-  (back of stage)
  //   Bottom = Z+  (front, audience side)
  //   Left   = X-  (stage right from audience)
  //   Right  = X+  (stage left from audience)

  const halfW = stage.width / 2
  const halfD = stage.depth / 2

  /** Convert world X/Z to percentage position on the grid element */
  const worldToGrid = useCallback(
    (x: number, z: number): { pctX: number; pctZ: number } => ({
      pctX: ((x + halfW) / stage.width) * 100,
      pctZ: ((-z + halfD) / stage.depth) * 100, // Z- is top
    }),
    [halfW, halfD, stage.width, stage.depth]
  )

  /** Convert pixel position on the grid element to world X/Z */
  const gridToWorld = useCallback(
    (clientX: number, clientY: number): { x: number; z: number } => {
      const el = gridRef.current
      if (!el) return { x: 0, z: 0 }
      const rect = el.getBoundingClientRect()
      const normX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      const normZ = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
      return {
        x: normX * stage.width - halfW,
        z: -(normZ * stage.depth - halfD), // invert: screen top → Z-
      }
    },
    [stage.width, stage.depth, halfW, halfD]
  )

  /** Convert pixel Y on the slider to world height Y */
  const sliderToWorldY = useCallback(
    (clientY: number): number => {
      const el = sliderRef.current
      if (!el) return 0
      const rect = el.getBoundingClientRect()
      // Top of slider = stage.height, bottom = 0
      const norm = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
      return (1 - norm) * stage.height
    },
    [stage.height]
  )

  // ── GRID DRAG HANDLERS ──

  const flushGridPosition = useCallback(
    (clientX: number, clientY: number) => {
      if (disabled) return
      const { x, z } = gridToWorld(clientX, clientY)
      const cur = targetRef.current
      onChange({ x: round2(x), y: cur.y, z: round2(z) })
    },
    [disabled, gridToWorld, onChange]
  )

  const handleGridDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return
      setIsDraggingGrid(true)
      flushGridPosition(e.clientX, e.clientY)
    },
    [disabled, flushGridPosition]
  )

  const handleGridTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return
      e.preventDefault()
      setIsDraggingGrid(true)
      const t = e.touches[0]
      flushGridPosition(t.clientX, t.clientY)
    },
    [disabled, flushGridPosition]
  )

  // RAF-throttled drag for grid
  useEffect(() => {
    if (!isDraggingGrid) return

    const handleMove = (e: MouseEvent) => {
      pendingGridRef.current = { clientX: e.clientX, clientY: e.clientY }
      scheduleRAF()
    }
    const handleTouchMove = (e: TouchEvent) => {
      const t = e.touches[0]
      pendingGridRef.current = { clientX: t.clientX, clientY: t.clientY }
      scheduleRAF()
    }
    const handleUp = () => {
      flushPending()
      setIsDraggingGrid(false)
    }

    function scheduleRAF() {
      if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = 0
          flushPending()
        })
      }
    }

    function flushPending() {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = 0
      }
      const pos = pendingGridRef.current
      if (pos) {
        flushGridPosition(pos.clientX, pos.clientY)
        pendingGridRef.current = null
      }
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleUp)

    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleUp)
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = 0
      }
    }
  }, [isDraggingGrid, flushGridPosition])

  // ── SLIDER DRAG HANDLERS (Y axis) ──

  const flushSliderPosition = useCallback(
    (clientY: number) => {
      if (disabled) return
      const y = sliderToWorldY(clientY)
      const cur = targetRef.current
      onChange({ x: cur.x, y: round2(y), z: cur.z })
    },
    [disabled, sliderToWorldY, onChange]
  )

  const handleSliderDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return
      e.preventDefault()
      setIsDraggingSlider(true)
      flushSliderPosition(e.clientY)
    },
    [disabled, flushSliderPosition]
  )

  const handleSliderTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return
      e.preventDefault()
      setIsDraggingSlider(true)
      flushSliderPosition(e.touches[0].clientY)
    },
    [disabled, flushSliderPosition]
  )

  // RAF-throttled drag for slider
  useEffect(() => {
    if (!isDraggingSlider) return

    const handleMove = (e: MouseEvent) => {
      pendingSliderRef.current = { clientY: e.clientY }
      scheduleRAF()
    }
    const handleTouchMove = (e: TouchEvent) => {
      pendingSliderRef.current = { clientY: e.touches[0].clientY }
      scheduleRAF()
    }
    const handleUp = () => {
      flushPending()
      setIsDraggingSlider(false)
    }

    function scheduleRAF() {
      if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = 0
          flushPending()
        })
      }
    }

    function flushPending() {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = 0
      }
      const pos = pendingSliderRef.current
      if (pos) {
        flushSliderPosition(pos.clientY)
        pendingSliderRef.current = null
      }
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleUp)

    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleUp)
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = 0
      }
    }
  }, [isDraggingSlider, flushSliderPosition])

  // ── DOUBLE CLICK → CENTER ──

  const handleDoubleClick = useCallback(() => {
    if (disabled) return
    if (onCenter) {
      onCenter()
    } else {
      onChange({ x: 0, y: 0, z: 0 })
    }
  }, [disabled, onCenter, onChange])

  // ── GRID LINES (memoized — only recompute when stage changes) ──

  const gridLines = useMemo(() => {
    const lines: React.ReactNode[] = []
    const gridStep = stage.gridSize || 1

    // Vertical lines (X axis)
    for (let x = -halfW; x <= halfW; x += gridStep) {
      const pct = ((x + halfW) / stage.width) * 100
      const isCenter = Math.abs(x) < 0.01
      lines.push(
        <div
          key={`v-${x}`}
          className={`spatial-grid-line-v${isCenter ? ' center-axis' : ''}`}
          style={{ left: `${pct}%` }}
        />
      )
    }

    // Horizontal lines (Z axis)
    for (let z = -halfD; z <= halfD; z += gridStep) {
      const pct = ((-z + halfD) / stage.depth) * 100
      const isCenter = Math.abs(z) < 0.01
      lines.push(
        <div
          key={`h-${z}`}
          className={`spatial-grid-line-h${isCenter ? ' center-axis' : ''}`}
          style={{ top: `${pct}%` }}
        />
      )
    }

    return lines
  }, [stage.width, stage.depth, stage.gridSize, halfW, halfD])

  // ── FIXTURE GHOSTS (memoized) ──

  const fixtureGhosts = useMemo(() => {
    return fixtures.map((f) => {
      const { pctX, pctZ } = worldToGrid(f.position.x, f.position.z)
      return (
        <div
          key={f.id}
          className="spatial-fixture-ghost"
          style={{ left: `${pctX}%`, top: `${pctZ}%` }}
          title={`${f.name} (${f.position.x.toFixed(1)}, ${f.position.y.toFixed(1)}, ${f.position.z.toFixed(1)})`}
        >
          <div
            className="spatial-fixture-dot"
            style={
              f.displayColor
                ? { borderColor: f.displayColor, background: hexToRgba(f.displayColor, 0.2) }
                : undefined
            }
          />
          <span className="spatial-fixture-label">{f.name}</span>
        </div>
      )
    })
  }, [fixtures, worldToGrid])

  // ── WAVE 2614+2615+2624: BEAM RAYS SVG (memoized per target + fixtures + reachability + fan) ──
  // SVG lines from each fixture ghost to the current target or per-fixture sub-target.
  // Color shifts to red + dashed when IK says the fixture can't reach the target.

  const beamRays = useMemo(() => {
    return fixtures.map((f) => {
      const from = worldToGrid(f.position.x, f.position.z)
      // WAVE 2624: Use per-fixture sub-target if available (fan mode)
      const st = subTargets?.[f.id]
      const to = st
        ? worldToGrid(st.x, st.z)
        : worldToGrid(target.x, target.z)

      // WAVE 2615: Check reachability from IK results
      const ikResult = reachabilityMap?.[f.id]
      const isReachable = ikResult ? ikResult.reachable : true // optimistic if no data yet

      return (
        <line
          key={`ray-${f.id}`}
          x1={`${from.pctX}%`}
          y1={`${from.pctZ}%`}
          x2={`${to.pctX}%`}
          y2={`${to.pctZ}%`}
          className={isReachable ? 'spatial-beam-ray' : 'spatial-beam-ray unreachable'}
          strokeDasharray={isReachable ? 'none' : '4 3'}
        />
      )
    })
  }, [fixtures, target.x, target.z, worldToGrid, reachabilityMap, subTargets])

  // ── WAVE 2624: SUB-TARGET DOTS (small markers on grid showing each fixture's aim point) ──

  const subTargetDots = useMemo(() => {
    if (!subTargets || fanMode === 'converge') return null
    return fixtures.map((f) => {
      const st = subTargets[f.id]
      if (!st) return null
      const { pctX, pctZ } = worldToGrid(st.x, st.z)
      return (
        <div
          key={`sub-${f.id}`}
          className="spatial-sub-target-dot"
          style={{ left: `${pctX}%`, top: `${pctZ}%` }}
          title={`${f.name} → (${st.x.toFixed(1)}, ${st.z.toFixed(1)})`}
        />
      )
    })
  }, [subTargets, fanMode, fixtures, worldToGrid])

  // ── TARGET POSITION ON GRID ──

  const { pctX: targetPctX, pctZ: targetPctZ } = worldToGrid(target.x, target.z)

  // ── HEIGHT SLIDER POSITION ──
  // Top of slider = max height, bottom = 0
  const heightPct = stage.height > 0 ? (target.y / stage.height) * 100 : 0
  const heightFillPct = Math.max(0, Math.min(100, heightPct))
  // Thumb position: top = 100% height → 0% from top. bottom = 0% height → 100% from top.
  const thumbTopPct = 100 - heightFillPct

  // ── RENDER ──

  return (
    <div className={`spatial-pad-container${disabled ? ' disabled' : ''}`}>
      {/* HEADER */}
      <div className="spatial-pad-header">
        <span className="spatial-pad-badge">⊕ spatial ik</span>
        <span className="spatial-pad-count">
          {fixtures.length} fixture{fixtures.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* WAVE 2624: FAN CONTROLS — mode selector + amplitude slider */}
      {onFanModeChange && (
        <div className="spatial-fan-controls">
          <div className="spatial-fan-mode-selector">
            <button
              className={`spatial-fan-mode-btn${fanMode === 'converge' ? ' active' : ''}`}
              onClick={() => onFanModeChange('converge')}
              disabled={disabled}
              title="Converge — all fixtures aim at same point"
            >
              ⊙
            </button>
            <button
              className={`spatial-fan-mode-btn${fanMode === 'line' ? ' active' : ''}`}
              onClick={() => onFanModeChange('line')}
              disabled={disabled}
              title="Line — spread fixtures along a line"
            >
              ═
            </button>
            <button
              className={`spatial-fan-mode-btn${fanMode === 'circle' ? ' active' : ''}`}
              onClick={() => onFanModeChange('circle')}
              disabled={disabled}
              title="Circle — spread fixtures on a circumference"
            >
              ◎
            </button>
          </div>
          {fanMode !== 'converge' && onFanAmplitudeChange && (
            <div className="spatial-fan-amplitude">
              <label className="spatial-fan-amplitude-label">amp</label>
              <input
                type="range"
                className="spatial-fan-amplitude-slider"
                min={0}
                max={10}
                step={0.1}
                value={fanAmplitude}
                onChange={(e) => onFanAmplitudeChange(parseFloat(e.target.value))}
                disabled={disabled}
              />
              <span className="spatial-fan-amplitude-value">
                {fanAmplitude.toFixed(1)}m
              </span>
            </div>
          )}
        </div>
      )}

      {/* BODY: GRID + HEIGHT SLIDER */}
      <div className="spatial-pad-body">
        {/* TOP-DOWN GRID */}
        <div
          ref={gridRef}
          className={`spatial-pad-grid${isDraggingGrid ? ' dragging' : ''}`}
          onMouseDown={handleGridDown}
          onTouchStart={handleGridTouchStart}
          onDoubleClick={handleDoubleClick}
        >
          {/* Grid lines */}
          <div className="spatial-grid-lines">{gridLines}</div>

          {/* Axis labels */}
          <div className="spatial-axis-labels">
            <span className="spatial-axis-label label-x-neg">X−</span>
            <span className="spatial-axis-label label-x-pos">X+</span>
            <span className="spatial-axis-label label-z-back">Z− back</span>
            <span className="spatial-axis-label label-z-front">Z+ front</span>
          </div>

          {/* WAVE 2614+2615: Beam rays SVG overlay */}
          <svg className="spatial-beam-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            {beamRays}
          </svg>

          {/* Fixture ghosts */}
          {fixtureGhosts}

          {/* WAVE 2624: Sub-target dots (per-fixture aim points in fan mode) */}
          {subTargetDots}

          {/* TARGET CURSOR */}
          <div
            className="spatial-target"
            style={{
              left: `${Math.max(0, Math.min(100, targetPctX))}%`,
              top: `${Math.max(0, Math.min(100, targetPctZ))}%`,
            }}
          >
            <div className="spatial-target-crosshair-h" />
            <div className="spatial-target-crosshair-v" />
            <div className="spatial-target-ring" />
            <div className="spatial-target-core" />
          </div>

          {/* CENTER BUTTON */}
          <button
            className="spatial-center-btn"
            onPointerDown={(e) => {
              e.stopPropagation()
              e.preventDefault()
            }}
            onClick={(e) => {
              e.stopPropagation()
              if (onCenter) {
                onCenter()
              } else {
                onChange({ x: 0, y: 0, z: 0 })
              }
            }}
            disabled={disabled}
            title="Center target (0, 0, 0)"
          >
            ⌖
          </button>
        </div>

        {/* HEIGHT SLIDER (Y axis) — WAVE 2612 */}
        <div className="spatial-height-slider">
          <span className="spatial-height-label">Y</span>
          <div
            ref={sliderRef}
            className="spatial-height-track-wrapper"
            onMouseDown={handleSliderDown}
            onTouchStart={handleSliderTouchStart}
          >
            <div className="spatial-height-track">
              <div
                className="spatial-height-fill"
                style={{ height: `${heightFillPct}%` }}
              />
              <div
                className="spatial-height-thumb"
                style={{ bottom: `${heightFillPct}%` }}
              />
            </div>
          </div>
          <span className="spatial-height-value">
            {target.y.toFixed(1)}m
          </span>
        </div>
      </div>

      {/* COORDINATE READOUT */}
      <div className="spatial-coords">
        <div className="spatial-coord-group">
          <span className="spatial-coord-axis">X</span>
          <span className="spatial-coord-value">{target.x.toFixed(2)}</span>
          <span className="spatial-coord-unit">m</span>
        </div>
        <div className="spatial-coord-group">
          <span className="spatial-coord-axis">Y</span>
          <span className="spatial-coord-value">{target.y.toFixed(2)}</span>
          <span className="spatial-coord-unit">m</span>
        </div>
        <div className="spatial-coord-group">
          <span className="spatial-coord-axis">Z</span>
          <span className="spatial-coord-value">{target.z.toFixed(2)}</span>
          <span className="spatial-coord-unit">m</span>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Round to 2 decimal places (centimeter precision) */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Convert hex color to rgba string */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(168, 85, 247, ${alpha})`
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export default SpatialTargetPad
