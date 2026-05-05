/**
 * 🎯 ORTHO RADAR — Hybrid Top+Front view (WAVE 4561 / WAVE 4565)
 *
 * Radar ortográfico para movimiento de fixtures.
 *
 * CLASSIC MODE: Grid mapea Pan (0-540°) en X, Tilt (0-270°) en Y.
 * SPATIAL MODE: Grid mapea coordenadas reales (metros) XZ en planta.
 *   + Height slider lateral para el eje Y.
 *   + Grid lines escaladas al stage real (step = gridSize o 1m).
 *   + Fixtures diferenciados: Moving Heads neón con halo vs PAR/Foco atenuado.
 *   + Beam rays SVG: color fixture si reachable, ROJO PUNTEADO si inalcanzable.
 *   + Sub-target dots para fan mode (circle/line).
 *
 * DRAG: Refs para mutaciones sin re-render en cada frame (~33fps RAF throttle).
 * NO WebGL — SVG overlay puro (no Canvas).
 *
 * @version WAVE 4565
 */

import React, { useRef, useCallback, useEffect, useMemo } from 'react'
import type { Target3D, IKResult } from '../../../engine/movement/InverseKinematicsEngine'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface RadarFixtureGhost {
  id: string
  name: string
  /** Solo en spatial: posición en metros */
  position?: { x: number; y: number; z: number }
  /** Color hex (opcional) */
  color?: string
  /**
   * Tipo de fixture — determina representación visual.
   * 'moving' = Moving Head (neón + halo) | 'static' = PAR/Foco (atenuado)
   */
  fixtureType?: 'moving' | 'static'
}

export interface OrthoRadarProps {
  mode: 'classic' | 'spatial'

  // Classic
  pan?: number    // 0-540°
  tilt?: number   // 0-270°
  onPanTiltChange?: (pan: number, tilt: number) => void

  // Spatial
  target?: Target3D
  onTargetChange?: (t: Target3D) => void
  stage?: { width: number; depth: number; height: number; gridSize?: number }
  reachability?: Record<string, IKResult>
  subTargets?: Record<string, Target3D>
  /** Fan mode actual — cuando no es 'converge', se muestran sub-target dots */
  fanMode?: 'converge' | 'line' | 'circle'

  // Común
  fixtures?: RadarFixtureGhost[]
  disabled?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

/** Convierte posición relativa del grid [0,1] → valor de dominio */
function relToDomain(rel: number, min: number, max: number) {
  return min + rel * (max - min)
}

/** Convierte valor de dominio → posición relativa [0,1] */
function domainToRel(v: number, min: number, max: number) {
  return (v - min) / (max - min)
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const OrthoRadar: React.FC<OrthoRadarProps> = ({
  mode,
  pan = 270,
  tilt = 135,
  onPanTiltChange,
  target = { x: 0, y: 2, z: 0 },
  onTargetChange,
  stage = { width: 12, depth: 10, height: 6, gridSize: 1 },
  reachability = {},
  subTargets = {},
  fanMode = 'converge',
  fixtures = [],
  disabled = false,
}) => {
  const gridRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const rafId = useRef<number>(0)

  // Rangos para classic
  const PAN_MAX = 540
  const TILT_MAX = 270

  // Rangos para spatial (en metros, centrado)
  const halfW = stage.width / 2
  const halfD = stage.depth / 2
  const gridStep = stage.gridSize ?? 1

  // ── Grid lines escaladas al stage real ───────────────────────────────────
  const spatialGridLines = useMemo(() => {
    if (mode !== 'spatial') return null
    const lines: React.ReactNode[] = []

    // Líneas verticales (X axis)
    for (let x = -halfW; x <= halfW + 0.001; x += gridStep) {
      const pct = ((x + halfW) / stage.width) * 100
      const isCenter = Math.abs(x) < 0.01
      lines.push(
        <line
          key={`v${x.toFixed(1)}`}
          x1={pct} y1={0} x2={pct} y2={100}
          stroke={isCenter ? 'rgba(0,240,255,0.25)' : 'rgba(0,240,255,0.07)'}
          strokeWidth={isCenter ? 0.6 : 0.4}
        />
      )
    }

    // Líneas horizontales (Z axis)
    for (let z = -halfD; z <= halfD + 0.001; z += gridStep) {
      const pct = ((-z + halfD) / stage.depth) * 100
      const isCenter = Math.abs(z) < 0.01
      lines.push(
        <line
          key={`h${z.toFixed(1)}`}
          x1={0} y1={pct} x2={100} y2={pct}
          stroke={isCenter ? 'rgba(0,240,255,0.25)' : 'rgba(0,240,255,0.07)'}
          strokeWidth={isCenter ? 0.6 : 0.4}
        />
      )
    }

    return lines
  }, [mode, halfW, halfD, gridStep, stage.width, stage.depth])

  // ── Classic grid lines (5 divisiones fijas) ──────────────────────────────
  const classicGridLines = useMemo(() => {
    if (mode !== 'classic') return null
    return [20, 40, 60, 80].flatMap(v => [
      <line key={`cv${v}`} x1={v} y1={0} x2={v} y2={100}
        stroke="rgba(0,240,255,0.08)" strokeWidth={0.4} />,
      <line key={`ch${v}`} x1={0} y1={v} x2={100} y2={v}
        stroke="rgba(0,240,255,0.08)" strokeWidth={0.4} />,
    ])
  }, [mode])

  // ── Calcular posición del target en el grid (0-1 relativo al contenedor) ──
  const targetRel = useMemo(() => {
    if (mode === 'classic') {
      return {
        x: domainToRel(pan, 0, PAN_MAX),
        y: domainToRel(tilt, 0, TILT_MAX),
      }
    }
    return {
      x: domainToRel(target.x, -halfW, halfW),
      y: domainToRel(-target.z, -halfD, halfD),  // Z invertida para vista top-down (N arriba)
    }
  }, [mode, pan, tilt, target, halfW, halfD])

  // ── Ghost positions en el grid ──
  const ghostPositions = useMemo(() => {
    return fixtures.map((f) => {
      if (mode === 'classic' || !f.position) {
        return null
      }
      const isMoving = f.fixtureType === 'moving'
      return {
        id: f.id,
        name: f.name,
        color: f.color ?? (isMoving ? '#00F0FF' : '#888888'),
        isMoving,
        x: domainToRel(f.position.x, -halfW, halfW),
        y: domainToRel(-f.position.z, -halfD, halfD),
        reachable: reachability[f.id]?.reachable ?? true,
        subTarget: subTargets[f.id],
      }
    }).filter(Boolean) as Array<{
      id: string; name: string; color: string; isMoving: boolean
      x: number; y: number; reachable: boolean; subTarget?: Target3D
    }>
  }, [fixtures, mode, halfW, halfD, reachability, subTargets])

  // ── Sub-target dots (fan mode: circle/line) ──────────────────────────────
  const subTargetDots = useMemo(() => {
    if (mode !== 'spatial' || fanMode === 'converge') return []
    return ghostPositions
      .filter(g => g.subTarget)
      .map(g => {
        const st = g.subTarget!
        return {
          id: g.id,
          x: domainToRel(st.x, -halfW, halfW),
          y: domainToRel(-st.z, -halfD, halfD),
          color: g.color,
        }
      })
  }, [mode, fanMode, ghostPositions, halfW, halfD])

  // ── Drag handler ──────────────────────────────────────────────────────────
  const applyDrag = useCallback((clientX: number, clientY: number) => {
    const el = gridRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const relX = clamp((clientX - rect.left) / rect.width, 0, 1)
    const relY = clamp((clientY - rect.top) / rect.height, 0, 1)

    cancelAnimationFrame(rafId.current)
    rafId.current = requestAnimationFrame(() => {
      if (mode === 'classic') {
        const newPan  = relToDomain(relX, 0, PAN_MAX)
        const newTilt = relToDomain(relY, 0, TILT_MAX)
        onPanTiltChange?.(newPan, newTilt)
      } else {
        const newX = relToDomain(relX, -halfW, halfW)
        const newZ = -relToDomain(relY, -halfD, halfD)  // Y invertida → Z
        onTargetChange?.({ x: newX, y: target.y, z: newZ })
      }
    })
  }, [mode, target.y, halfW, halfD, onPanTiltChange, onTargetChange])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return
    isDragging.current = true
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    applyDrag(e.clientX, e.clientY)
  }, [disabled, applyDrag])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return
    applyDrag(e.clientX, e.clientY)
  }, [applyDrag])

  const onPointerUp = useCallback(() => {
    isDragging.current = false
  }, [])

  useEffect(() => () => cancelAnimationFrame(rafId.current), [])

  // ── Height slider (solo spatial) ──────────────────────────────────────────
  const handleHeightChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const y = parseFloat(e.target.value)
    onTargetChange?.({ ...target, y })
  }, [target, onTargetChange])

  // ── Beam rays SVG: fixture → sub-target (o target central) ───────────────
  const beamLines = useMemo(() => {
    if (mode !== 'spatial') return []
    return ghostPositions.map(g => {
      // Si hay sub-target específico (fan spread) → apunta al sub-target
      // Si no → apunta al target central
      const endX = g.subTarget
        ? domainToRel(g.subTarget.x, -halfW, halfW)
        : targetRel.x
      const endY = g.subTarget
        ? domainToRel(-g.subTarget.z, -halfD, halfD)
        : targetRel.y
      return {
        x1: g.x, y1: g.y,
        x2: endX, y2: endY,
        reachable: g.reachable,
        color: g.color,
        isMoving: g.isMoving,
      }
    })
  }, [mode, ghostPositions, targetRel, halfW, halfD])

  // ─────────────────────────────────────────────────────────────────────────
  const targetPctX = `${clamp(targetRel.x * 100, 0, 100)}%`
  const targetPctY = `${clamp(targetRel.y * 100, 0, 100)}%`

  return (
    <div className="ortho-radar">
      <div className="ortho-radar__inner">
        {/* ── GRID ── */}
        <div
          ref={gridRef}
          className={`ortho-radar__grid ${disabled ? 'ortho-radar__grid--disabled' : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ cursor: disabled ? 'not-allowed' : 'crosshair' }}
        >
          {/* SVG overlay: grid lines + beam rays + sub-target dots */}
          <svg className="ortho-radar__svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Grid lines scaled to stage */}
            {spatialGridLines ?? classicGridLines}

            {/* Crosshair central */}
            <line x1={50} y1={0} x2={50} y2={100} className="ortho-radar__crosshair" />
            <line x1={0} y1={50} x2={100} y2={50} className="ortho-radar__crosshair" />

            {/* Beam rays — fixture → aim point */}
            {beamLines.map((bl, i) => (
              <line
                key={i}
                x1={bl.x1 * 100} y1={bl.y1 * 100}
                x2={bl.x2 * 100} y2={bl.y2 * 100}
                stroke={bl.reachable ? bl.color : '#FF3A3A'}
                strokeWidth={bl.isMoving ? 1.0 : 0.5}
                strokeDasharray={bl.reachable ? undefined : '3 2'}
                opacity={bl.reachable ? (bl.isMoving ? 0.75 : 0.3) : 0.9}
              />
            ))}

            {/* Sub-target dots (fan spread markers) */}
            {subTargetDots.map((d) => (
              <circle
                key={`sub-${d.id}`}
                cx={d.x * 100}
                cy={d.y * 100}
                r={1.2}
                fill={d.color}
                opacity={0.8}
                stroke="rgba(0,0,0,0.5)"
                strokeWidth={0.4}
              />
            ))}
          </svg>

          {/* Fixture ghosts — Moving Heads neón, estáticos atenuados */}
          {ghostPositions.map((g) => (
            <div
              key={g.id}
              className={[
                'ortho-radar__ghost',
                g.isMoving ? 'ortho-radar__ghost--moving' : 'ortho-radar__ghost--static',
                g.reachable ? '' : 'ortho-radar__ghost--unreachable',
              ].join(' ')}
              style={{
                left: `${g.x * 100}%`,
                top:  `${g.y * 100}%`,
                '--ghost-color': g.color,
              } as React.CSSProperties}
              title={`${g.name}${g.reachable ? '' : ' [UNREACHABLE]'}`}
            >
              {g.isMoving ? '◆' : '●'}
            </div>
          ))}

          {/* Target cursor */}
          <div
            className="ortho-radar__target"
            style={{
              left: targetPctX,
              top:  targetPctY,
            }}
          >
            <span className="ortho-radar__target-symbol">⊕</span>
          </div>
        </div>

        {/* ── HEIGHT SLIDER (spatial only) ── */}
        {mode === 'spatial' && (
          <div className="ortho-radar__height-slider">
            <span className="ortho-radar__height-label ortho-radar__height-label--top">
              {stage.height.toFixed(1)}m
            </span>
            <input
              type="range"
              className="ortho-radar__height-input"
              min={0}
              max={stage.height}
              step={0.1}
              value={target.y}
              onChange={handleHeightChange}
              disabled={disabled}
              title={`Height: ${target.y.toFixed(1)}m`}
            />
            <span className="ortho-radar__height-label ortho-radar__height-label--mid">
              {target.y.toFixed(1)}m
            </span>
            <span className="ortho-radar__height-label ortho-radar__height-label--bot">
              0.0m
            </span>
          </div>
        )}
      </div>

      {/* ── AXIS LABELS ── */}
      <div className="ortho-radar__axis-labels">
        {mode === 'classic' ? (
          <>
            <span>PAN: 0–540°</span>
            <span>TILT: 0–270°</span>
          </>
        ) : (
          <>
            <span>X: {(-halfW).toFixed(0)}..{halfW.toFixed(0)}m</span>
            <span>Z: {(-halfD).toFixed(0)}..{halfD.toFixed(0)}m</span>
          </>
        )}
      </div>
    </div>
  )
}
