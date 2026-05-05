/**
 * 🎯 ORTHO RADAR — Hybrid Top+Front view (WAVE 4561)
 *
 * Radar ortográfico para movimiento de fixtures.
 *
 * CLASSIC MODE: Grid mapea Pan (0-540°) en X, Tilt (0-270°) en Y.
 * SPATIAL MODE: Grid mapea coordenadas reales (metros) XZ en planta.
 *   + Height slider lateral para el eje Y.
 *
 * DRAG: Refs para mutaciones sin re-render en cada frame (33fps throttle).
 * BEAM RAYS: SVG lines desde ghost → sub-target.
 * NO WebGL — Canvas 2D + SVG overlay.
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
  stage?: { width: number; depth: number; height: number }
  reachability?: Record<string, IKResult>
  subTargets?: Record<string, Target3D>

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
  stage = { width: 12, depth: 10, height: 6 },
  reachability = {},
  subTargets = {},
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
      return {
        id: f.id,
        name: f.name,
        color: f.color ?? '#00F0FF',
        x: domainToRel(f.position.x, -halfW, halfW),
        y: domainToRel(-f.position.z, -halfD, halfD),
        reachable: reachability[f.id]?.reachable ?? true,
        subTarget: subTargets[f.id],
      }
    }).filter(Boolean) as Array<{
      id: string; name: string; color: string
      x: number; y: number; reachable: boolean; subTarget?: Target3D
    }>
  }, [fixtures, mode, halfW, halfD, reachability, subTargets])

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

  // ── Sub-target relay positions for SVG lines ──────────────────────────────
  const beamLines = useMemo(() => {
    if (mode !== 'spatial') return []
    return ghostPositions.map(g => {
      if (!g.subTarget) return null
      const stRelX = domainToRel(g.subTarget.x, -halfW, halfW)
      const stRelY = domainToRel(-g.subTarget.z, -halfD, halfD)
      return {
        x1: g.x, y1: g.y,
        x2: stRelX, y2: stRelY,
        reachable: g.reachable,
        color: g.color,
      }
    }).filter(Boolean) as Array<{ x1: number; y1: number; x2: number; y2: number; reachable: boolean; color: string }>
  }, [mode, ghostPositions, halfW, halfD])

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
          {/* SVG overlay: grid lines + beam rays */}
          <svg className="ortho-radar__svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Grid lines (5 divisiones) */}
            {[20, 40, 60, 80].map(v => (
              <React.Fragment key={v}>
                <line x1={v} y1={0} x2={v} y2={100} className="ortho-radar__gridline" />
                <line x1={0} y1={v} x2={100} y2={v} className="ortho-radar__gridline" />
              </React.Fragment>
            ))}
            {/* Crosshair central */}
            <line x1={50} y1={0} x2={50} y2={100} className="ortho-radar__crosshair" />
            <line x1={0} y1={50} x2={100} y2={50} className="ortho-radar__crosshair" />

            {/* Beam rays (spatial mode) */}
            {beamLines.map((bl, i) => (
              <line
                key={i}
                x1={bl.x1 * 100} y1={bl.y1 * 100}
                x2={bl.x2 * 100} y2={bl.y2 * 100}
                stroke={bl.reachable ? bl.color : '#FF4040'}
                strokeWidth={0.8}
                strokeDasharray={bl.reachable ? undefined : '3 2'}
                opacity={0.6}
              />
            ))}
          </svg>

          {/* Fixture ghosts (spatial mode) */}
          {ghostPositions.map((g) => (
            <div
              key={g.id}
              className={`ortho-radar__ghost ${g.reachable ? '' : 'ortho-radar__ghost--unreachable'}`}
              style={{
                left: `${g.x * 100}%`,
                top:  `${g.y * 100}%`,
                borderColor: g.color,
              }}
              title={g.name}
            >
              ◆
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
