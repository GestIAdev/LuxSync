/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ PHASE CANVAS — Individual Phase Per-Fixture Override Editor
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Módulo 5 del Eurorack Phase Chassis.
 * Layout horizontal: mini phase wheel (96px) + controles compactos.
 * Neon UV (#b388ff) — quinto color del rack.
 *
 * Diferenciadores vs MA3:
 *   - Hybrid overlay (delta sobre algoritmo)
 *   - Bake / Unbake
 *   - Manipulación directa visual (drag en phase wheel)
 *
 * @module views/HephaestusView/PhaseCanvas
 */

import React, { useCallback, useRef, useEffect, useState } from 'react'
import type { PhaseConfigPro } from '../../../core/hephaestus/phase/PhaseConfigPro'
import type { PhaseOverride, PhaseOverrideMap } from '../../../core/hephaestus/phase/PhaseOverride'
import { resolvePro } from '../../../core/hephaestus/phase/PhaseConfigPro'
import { countOverrides } from '../../../core/hephaestus/phase/PhaseOverride'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface PhaseCanvasProps {
  fixtureIds: string[]
  config: PhaseConfigPro
  overrides: PhaseOverrideMap | undefined
  durationMs: number
  selectedFixtureId: string | null
  disabled?: boolean
  onSelectFixture: (id: string | null) => void
  onUpdateOverride: (fixtureId: string, override: PhaseOverride | null) => void
  onBake: () => void
  onUnbake: () => void
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const NEON_UV = '#b388ff'

const WHEEL_SIZE = 112
const WHEEL_RADIUS = WHEEL_SIZE / 2
const DOT_RADIUS = 3.5
const RING_RADIUS = WHEEL_RADIUS - 10

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const PhaseCanvas: React.FC<PhaseCanvasProps> = ({
  fixtureIds,
  config,
  overrides,
  durationMs,
  selectedFixtureId,
  disabled = false,
  onSelectFixture,
  onUpdateOverride,
  onBake,
  onUnbake,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<string | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [flash, setFlash] = useState<'bake' | 'unbake' | null>(null)

  // ── Compute base + final offsets ──
  const basePhases = React.useMemo(
    () => resolvePro(fixtureIds, config, durationMs),
    [fixtureIds, config, durationMs],
  )

  const finalOffsets = React.useMemo(() => {
    const map = new Map<string, { base: number; final: number; override?: PhaseOverride }>()
    for (const bp of basePhases) {
      const ov = overrides?.[bp.fixtureId]
      if (ov) {
        const final = ov.mode === 'absolute'
          ? ov.offsetMs
          : Math.max(0, Math.min(durationMs, bp.phaseOffsetMs + ov.offsetMs))
        map.set(bp.fixtureId, { base: bp.phaseOffsetMs, final, override: ov })
      } else {
        map.set(bp.fixtureId, { base: bp.phaseOffsetMs, final: bp.phaseOffsetMs })
      }
    }
    return map
  }, [basePhases, overrides, durationMs])

  const overrideCount = countOverrides(overrides)

  // ── Flash animation on bake/unbake ──
  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 600)
    return () => clearTimeout(t)
  }, [flash])

  // ── Draw phase wheel ──
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = WHEEL_SIZE * dpr
    canvas.height = WHEEL_SIZE * dpr
    ctx.scale(dpr, dpr)

    // Clear
    ctx.clearRect(0, 0, WHEEL_SIZE, WHEEL_SIZE)

    // Flash background on bake/unbake
    if (flash === 'bake') {
      ctx.beginPath()
      ctx.arc(WHEEL_RADIUS, WHEEL_RADIUS, RING_RADIUS + 4, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(179, 136, 255, 0.12)'
      ctx.fill()
    } else if (flash === 'unbake') {
      ctx.beginPath()
      ctx.arc(WHEEL_RADIUS, WHEEL_RADIUS, RING_RADIUS + 4, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
      ctx.fill()
    }

    // Background ring
    ctx.beginPath()
    ctx.arc(WHEEL_RADIUS, WHEEL_RADIUS, RING_RADIUS, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    ctx.stroke()

    // Inner subtle fill
    ctx.beginPath()
    ctx.arc(WHEEL_RADIUS, WHEEL_RADIUS, RING_RADIUS - 2, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(179, 136, 255, 0.03)'
    ctx.fill()

    // Tick marks at 0°, 90°, 180°, 270°
    for (let q = 0; q < 4; q++) {
      const a = (q / 4) * Math.PI * 2 - Math.PI / 2
      const x1 = WHEEL_RADIUS + Math.cos(a) * (RING_RADIUS - 4)
      const y1 = WHEEL_RADIUS + Math.sin(a) * (RING_RADIUS - 4)
      const x2 = WHEEL_RADIUS + Math.cos(a) * (RING_RADIUS + 2)
      const y2 = WHEEL_RADIUS + Math.sin(a) * (RING_RADIUS + 2)
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // Center dot
    ctx.beginPath()
    ctx.arc(WHEEL_RADIUS, WHEEL_RADIUS, 1.5, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.fill()

    // Draw fixture dots
    for (const [fixtureId, offsets] of finalOffsets) {
      const angle = (offsets.final / durationMs) * Math.PI * 2 - Math.PI / 2
      const x = WHEEL_RADIUS + Math.cos(angle) * RING_RADIUS
      const y = WHEEL_RADIUS + Math.sin(angle) * RING_RADIUS

      const hasOverride = !!offsets.override
      const isSelected = fixtureId === selectedFixtureId
      const isHovered = fixtureId === hoverId
      const isPinned = !!offsets.override?.pinned

      // Glow for overridden fixtures
      if (hasOverride) {
        ctx.beginPath()
        ctx.arc(x, y, DOT_RADIUS + 4, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(179, 136, 255, 0.15)'
        ctx.fill()
      }

      // Hover halo
      if (isHovered && !isSelected) {
        ctx.beginPath()
        ctx.arc(x, y, DOT_RADIUS + 5, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // Selection ring
      if (isSelected) {
        ctx.beginPath()
        ctx.arc(x, y, DOT_RADIUS + 5, 0, Math.PI * 2)
        ctx.strokeStyle = NEON_UV
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      // Dot
      ctx.beginPath()
      ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2)
      if (hasOverride) {
        ctx.fillStyle = NEON_UV
        ctx.shadowColor = NEON_UV
        ctx.shadowBlur = 6
      } else if (isSelected) {
        ctx.fillStyle = 'rgba(255,255,255,0.8)'
        ctx.shadowColor = 'rgba(255,255,255,0.4)'
        ctx.shadowBlur = 4
      } else if (isHovered) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)'
        ctx.shadowBlur = 0
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.3)'
        ctx.shadowBlur = 0
      }
      ctx.fill()
      ctx.shadowBlur = 0

      // Pin indicator: dashed ring around dot
      if (isPinned) {
        ctx.beginPath()
        ctx.arc(x, y, DOT_RADIUS + 2, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(179, 136, 255, 0.6)'
        ctx.lineWidth = 0.8
        ctx.setLineDash([1.5, 1.5])
        ctx.stroke()
        ctx.setLineDash([])
      }
    }
  }, [finalOffsets, durationMs, selectedFixtureId, hoverId, flash])

  // ── Hit testing ──
  const hitTest = useCallback((mx: number, my: number): string | null => {
    let best: string | null = null
    let bestDist = (DOT_RADIUS + 5) ** 2
    for (const [fixtureId, offsets] of finalOffsets) {
      const angle = (offsets.final / durationMs) * Math.PI * 2 - Math.PI / 2
      const x = WHEEL_RADIUS + Math.cos(angle) * RING_RADIUS
      const y = WHEEL_RADIUS + Math.sin(angle) * RING_RADIUS
      const dx = mx - x
      const dy = my - y
      const dist = dx * dx + dy * dy
      if (dist < bestDist) {
        bestDist = dist
        best = fixtureId
      }
    }
    return best
  }, [finalOffsets, durationMs])

  // ── Mouse handlers ──
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (disabled) return
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const hitId = hitTest(mx, my)
    if (hitId) {
      dragRef.current = hitId
      onSelectFixture(hitId)
    }
  }, [disabled, hitTest, onSelectFixture])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    if (disabled || !dragRef.current) {
      // Hover detection
      const hitId = hitTest(mx, my)
      setHoverId(hitId)
      return
    }

    const dx = mx - WHEEL_RADIUS
    const dy = my - WHEEL_RADIUS
    const angle = Math.atan2(dy, dx) + Math.PI / 2 // 0 at top, clockwise
    const normalized = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2)
    const offsetMs = normalized * durationMs

    const fixtureId = dragRef.current
    const base = finalOffsets.get(fixtureId)
    if (!base) return

    // If no override yet, create as absolute
    const existing = base.override
    if (existing?.mode === 'delta') {
      // Update delta to match drag
      const delta = offsetMs - base.base
      onUpdateOverride(fixtureId, { mode: 'delta', offsetMs: delta, pinned: existing.pinned })
    } else {
      onUpdateOverride(fixtureId, { mode: 'absolute', offsetMs, pinned: existing?.pinned })
    }
  }, [disabled, durationMs, finalOffsets, onUpdateOverride, hitTest])

  const handleMouseUp = useCallback(() => {
    dragRef.current = null
  }, [])

  const handleMouseLeave = useCallback(() => {
    dragRef.current = null
    setHoverId(null)
  }, [])

  // ── Bake / Unbake with flash ──
  const handleBake = useCallback(() => {
    onBake()
    setFlash('bake')
  }, [onBake])

  const handleUnbake = useCallback(() => {
    onUnbake()
    setFlash('unbake')
  }, [onUnbake])

  // ── Selected fixture controls ──
  const selectedOverride = selectedFixtureId ? overrides?.[selectedFixtureId] : undefined
  const selectedBase = selectedFixtureId ? finalOffsets.get(selectedFixtureId) : undefined

  const handleModeToggle = useCallback(() => {
    if (!selectedFixtureId || !selectedBase) return
    if (selectedOverride?.mode === 'delta') {
      // Switch to absolute: use current final
      onUpdateOverride(selectedFixtureId, { mode: 'absolute', offsetMs: selectedBase.final, pinned: selectedOverride.pinned })
    } else {
      // Switch to delta: compute delta from base
      const delta = selectedBase.final - selectedBase.base
      onUpdateOverride(selectedFixtureId, { mode: 'delta', offsetMs: delta, pinned: selectedOverride?.pinned })
    }
  }, [selectedFixtureId, selectedBase, selectedOverride, onUpdateOverride])

  const handleOffsetChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedFixtureId || !selectedOverride) return
    onUpdateOverride(selectedFixtureId, { ...selectedOverride, offsetMs: parseFloat(e.target.value) })
  }, [selectedFixtureId, selectedOverride, onUpdateOverride])

  const handlePinToggle = useCallback(() => {
    if (!selectedFixtureId || !selectedOverride) return
    onUpdateOverride(selectedFixtureId, { ...selectedOverride, pinned: !selectedOverride.pinned })
  }, [selectedFixtureId, selectedOverride, onUpdateOverride])

  const handleRemoveOverride = useCallback(() => {
    if (!selectedFixtureId) return
    onUpdateOverride(selectedFixtureId, null)
  }, [selectedFixtureId, onUpdateOverride])

  // ── Slider range ──
  const sliderMin = selectedOverride?.mode === 'delta' ? -(durationMs / 4) : 0
  const sliderMax = selectedOverride?.mode === 'delta' ? (durationMs / 4) : durationMs

  // ── Tooltip data ──
  const tooltipData = (() => {
    const id = hoverId ?? (dragRef.current ? selectedFixtureId : null)
    if (!id) return null
    const offsets = finalOffsets.get(id)
    if (!offsets) return null
    const delta = offsets.final - offsets.base
    return {
      id,
      final: Math.round(offsets.final),
      base: Math.round(offsets.base),
      delta: Math.round(delta),
      hasOverride: !!offsets.override,
      mode: offsets.override?.mode,
      pinned: offsets.override?.pinned,
    }
  })()

  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
      {/* ── Phase Wheel Canvas + Tooltip ── */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <canvas
          ref={canvasRef}
          style={{
            width: WHEEL_SIZE,
            height: WHEEL_SIZE,
            cursor: disabled ? 'default' : (dragRef.current ? 'grabbing' : 'pointer'),
            opacity: disabled ? 0.5 : 1,
            display: 'block',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />

        {/* Tooltip */}
        {tooltipData && !disabled && (
          <div style={{
            position: 'absolute',
            top: WHEEL_SIZE + 2,
            left: 0,
            right: 0,
            fontSize: '8px',
            fontWeight: 600,
            lineHeight: '1.4',
            color: 'rgba(255,255,255,0.7)',
            background: 'rgba(0,0,0,0.6)',
            borderRadius: '4px',
            padding: '3px 5px',
            border: `1px solid ${tooltipData.hasOverride ? 'rgba(179, 136, 255, 0.3)' : 'rgba(255,255,255,0.08)'}`,
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            <span style={{ color: tooltipData.hasOverride ? NEON_UV : 'rgba(255,255,255,0.5)' }}>
              {tooltipData.id.slice(0, 10)}
            </span>
            {' '}
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>{tooltipData.final}ms</span>
            {tooltipData.hasOverride && (
              <>
                {' '}
                <span style={{ color: tooltipData.delta >= 0 ? 'rgba(179, 136, 255, 0.8)' : 'rgba(255, 136, 136, 0.7)' }}>
                  Δ{tooltipData.delta >= 0 ? '+' : ''}{tooltipData.delta}
                </span>
                {tooltipData.pinned && <span style={{ color: NEON_UV }}> 🔒</span>}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Controls (compact, right side) ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {/* Bake / Unbake / Reset */}
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            type="button"
            disabled={disabled || fixtureIds.length === 0}
            onClick={handleBake}
            title="Bake algorithmic offsets to manual overrides"
            style={{
              ...btnBase,
              color: NEON_UV,
              border: `1px solid rgba(179, 136, 255, 0.3)`,
              ...(flash === 'bake' ? { boxShadow: `0 0 12px rgba(179, 136, 255, 0.4)`, background: 'rgba(179, 136, 255, 0.1)' } : {}),
            }}
          >
            BAKE
          </button>
          <button
            type="button"
            disabled={disabled || overrideCount === 0}
            onClick={handleUnbake}
            title="Clear all overrides — return to algorithmic"
            style={{
              ...btnBase,
              color: 'rgba(255,255,255,0.5)',
              border: '1px solid rgba(255,255,255,0.1)',
              ...(flash === 'unbake' ? { boxShadow: '0 0 12px rgba(255, 255, 255, 0.15)', background: 'rgba(255, 255, 255, 0.05)' } : {}),
            }}
          >
            UNBAKE
          </button>
        </div>

        {/* Override count */}
        <div style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.1em', color: overrideCount > 0 ? NEON_UV : 'rgba(255,255,255,0.25)' }}>
          {overrideCount > 0 ? `${overrideCount} / ${fixtureIds.length} OVERRIDDEN` : 'NO OVERRIDES — ALGORITHMIC'}
        </div>

        {/* Selected fixture controls */}
        {selectedFixtureId && selectedOverride ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {/* Fixture ID + Mode toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.6)', flexShrink: 0 }}>
                {selectedFixtureId.slice(0, 8)}
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={handleModeToggle}
                style={{
                  ...btnBase,
                  flex: 1,
                  fontSize: '8px',
                  padding: '3px 4px',
                  color: selectedOverride.mode === 'delta' ? NEON_UV : 'rgba(255,255,255,0.6)',
                  border: selectedOverride.mode === 'delta'
                    ? `1px solid rgba(179, 136, 255, 0.4)`
                    : '1px solid rgba(255,255,255,0.15)',
                }}
              >
                {selectedOverride.mode === 'delta' ? 'Δ DELTA' : '■ ABS'}
              </button>
            </div>

            {/* Offset slider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="range"
                style={{ flex: 1, height: '4px', appearance: 'none', background: 'rgba(179, 136, 255, 0.1)', borderRadius: '2px', outline: 'none', cursor: 'pointer' }}
                min={sliderMin}
                max={sliderMax}
                step={1}
                value={selectedOverride.offsetMs}
                onChange={handleOffsetChange}
                disabled={disabled}
              />
              <span style={{ fontSize: '9px', fontWeight: 700, color: NEON_UV, minWidth: '36px', textAlign: 'right', textShadow: `0 0 6px ${NEON_UV}40` }}>
                {Math.round(selectedOverride.offsetMs)}ms
              </span>
            </div>

            {/* Pin + Remove */}
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                disabled={disabled}
                onClick={handlePinToggle}
                title="Pin: fixture immune to algorithm changes"
                style={{
                  ...btnBase,
                  fontSize: '8px',
                  padding: '3px 6px',
                  color: selectedOverride.pinned ? NEON_UV : 'rgba(255,255,255,0.3)',
                  border: selectedOverride.pinned
                    ? `1px solid rgba(179, 136, 255, 0.4)`
                    : '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {selectedOverride.pinned ? '🔒 PINNED' : '○ PIN'}
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={handleRemoveOverride}
                title="Remove override for this fixture"
                style={{
                  ...btnBase,
                  fontSize: '8px',
                  padding: '3px 6px',
                  color: 'rgba(255, 100, 100, 0.6)',
                  border: '1px solid rgba(255, 100, 100, 0.15)',
                }}
              >
                ✕ REMOVE
              </button>
            </div>
          </div>
        ) : selectedFixtureId ? (
          <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
            {selectedFixtureId.slice(0, 8)} — algorithmic ({Math.round(selectedBase?.base ?? 0)}ms)
            <br />
            <span style={{ color: 'rgba(179, 136, 255, 0.4)' }}>Drag on wheel to override</span>
          </div>
        ) : (
          <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>
            Click a fixture dot to select
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED STYLES
// ═══════════════════════════════════════════════════════════════════════════

const btnBase: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  background: 'rgba(0, 0, 0, 0.3)',
  borderRadius: '4px',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
}

export default PhaseCanvas
