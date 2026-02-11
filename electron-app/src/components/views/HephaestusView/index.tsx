/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ HEPHAESTUS VIEW - WAVE 2030.3: THE GOD FORGE
 * First-class View for FX Curve Automation Editor
 * 
 * Layout Architecture:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                    HEADER BAR (56px)                                    │
 * │  ⚒️ HEPHAESTUS STUDIO  │  Clip Name  │  Duration  │  Status           │
 * ├──────────┬──────────────────────────────────────────────────────────────┤
 * │          │                                                              │
 * │ PARAM    │              CURVE EDITOR (SVG)                             │
 * │ LANES    │              Full responsive canvas                          │
 * │ (200px)  │              Bezier curves + keyframes                       │
 * │          │              Grid + snap + zoom/pan                          │
 * │          │                                                              │
 * ├──────────┴──────────────────────────────────────────────────────────────┤
 * │                    TOOLBAR (48px)                                       │
 * │  [Interp: Hold|Linear|Bezier]  [Preset: ▼]  [Mode: Abs|Rel|Add]       │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * WAVE 2030.3: Initial implementation with dummy sine curve data
 * 
 * @module views/HephaestusView
 * @version WAVE 2030.3
 */

import React, { useState, useCallback, useMemo } from 'react'
import { CurveEditor } from './CurveEditor'
import { ParameterLane } from './ParameterLane'
import { HephaestusToolbar } from './HephaestusToolbar'
import { createDummyClip } from './dummyData'
import type { HephCurve, HephParamId, HephInterpolation, HephCurveMode, HephAutomationClip } from '../../../core/hephaestus/types'
import './HephaestusView.css'

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const HephaestusView: React.FC = () => {
  // ── State ──
  const [clip, setClip] = useState(() => createDummyClip())
  const [activeParam, setActiveParam] = useState<HephParamId>('intensity')
  const [selectedKeyframeIdx, setSelectedKeyframeIdx] = useState<number | null>(null)
  const [playheadMs, setPlayheadMs] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  // ── Derived ──
  const activeCurve = useMemo(
    () => clip.curves.get(activeParam) ?? null,
    [clip, activeParam]
  )

  const paramIds = useMemo<HephParamId[]>(
    () => Array.from(clip.curves.keys()) as HephParamId[],
    [clip]
  )

  // ═══════════════════════════════════════════════════════════════════════
  // CALLBACKS — Curve Mutations (immutable updates)
  // ═══════════════════════════════════════════════════════════════════════

  const updateCurve = useCallback((paramId: HephParamId, updater: (curve: HephCurve) => HephCurve) => {
    setClip((prev: HephAutomationClip): HephAutomationClip => {
      const newCurves = new Map<HephParamId, HephCurve>(prev.curves)
      const existing = newCurves.get(paramId)
      if (!existing) return prev
      newCurves.set(paramId, updater(existing))
      return { ...prev, curves: newCurves }
    })
  }, [])

  const handleKeyframeAdd = useCallback((timeMs: number, value: number) => {
    updateCurve(activeParam, curve => {
      const newKfs = [...curve.keyframes]
      // Insert sorted by timeMs
      const insertIdx = newKfs.findIndex(kf => kf.timeMs > timeMs)
      const newKf = {
        timeMs,
        value,
        interpolation: 'linear' as HephInterpolation,
      }
      if (insertIdx === -1) {
        newKfs.push(newKf)
      } else {
        newKfs.splice(insertIdx, 0, newKf)
      }
      return { ...curve, keyframes: newKfs }
    })
  }, [activeParam, updateCurve])

  const handleKeyframeMove = useCallback((index: number, timeMs: number, value: number) => {
    updateCurve(activeParam, curve => {
      const newKfs = [...curve.keyframes]
      newKfs[index] = { ...newKfs[index], timeMs, value }
      // Re-sort by timeMs to maintain invariant
      newKfs.sort((a, b) => a.timeMs - b.timeMs)
      return { ...curve, keyframes: newKfs }
    })
  }, [activeParam, updateCurve])

  const handleKeyframeDelete = useCallback((index: number) => {
    updateCurve(activeParam, curve => {
      if (curve.keyframes.length <= 1) return curve // Never delete last
      const newKfs = curve.keyframes.filter((_, i) => i !== index)
      return { ...curve, keyframes: newKfs }
    })
    setSelectedKeyframeIdx(null)
  }, [activeParam, updateCurve])

  const handleInterpolationChange = useCallback((index: number, interpolation: HephInterpolation) => {
    updateCurve(activeParam, curve => {
      const newKfs = [...curve.keyframes]
      newKfs[index] = { ...newKfs[index], interpolation }
      return { ...curve, keyframes: newKfs }
    })
  }, [activeParam, updateCurve])

  const handleBezierHandleMove = useCallback((index: number, handles: [number, number, number, number]) => {
    updateCurve(activeParam, curve => {
      const newKfs = [...curve.keyframes]
      newKfs[index] = { ...newKfs[index], bezierHandles: handles, interpolation: 'bezier' }
      return { ...curve, keyframes: newKfs }
    })
  }, [activeParam, updateCurve])

  const handleKeyframeSelect = useCallback((index: number | null) => {
    setSelectedKeyframeIdx(index)
  }, [])

  const handleModeChange = useCallback((mode: HephCurveMode) => {
    updateCurve(activeParam, curve => ({ ...curve, mode }))
  }, [activeParam, updateCurve])

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="heph-view">
      {/* ═══ HEADER ═══ */}
      <header className="heph-header">
        <div className="heph-header__left">
          <span className="heph-header__icon">⚒️</span>
          <h1 className="heph-header__title">HEPHAESTUS</h1>
          <span className="heph-header__subtitle">STUDIO</span>
        </div>
        <div className="heph-header__center">
          <span className="heph-header__clip-name">{clip.name}</span>
          <span className="heph-header__divider">│</span>
          <span className="heph-header__duration">{(clip.durationMs / 1000).toFixed(1)}s</span>
          <span className="heph-header__divider">│</span>
          <span className="heph-header__param-count">{paramIds.length} PARAMS</span>
        </div>
        <div className="heph-header__right">
          <span className={`heph-header__status ${isPlaying ? 'playing' : 'idle'}`}>
            {isPlaying ? '▶ PLAYING' : '⏸ IDLE'}
          </span>
        </div>
      </header>

      {/* ═══ MAIN WORKSPACE ═══ */}
      <div className="heph-workspace">
        {/* ── Parameter Lanes (left sidebar) ── */}
        <div className="heph-param-sidebar">
          <div className="heph-param-sidebar__header">
            <span className="heph-param-sidebar__title">PARAMETERS</span>
          </div>
          <div className="heph-param-sidebar__lanes">
            {paramIds.map(paramId => (
              <ParameterLane
                key={paramId}
                paramId={paramId}
                curve={clip.curves.get(paramId)!}
                isActive={paramId === activeParam}
                onClick={() => setActiveParam(paramId)}
              />
            ))}
          </div>
        </div>

        {/* ── Curve Editor (main canvas) ── */}
        <div className="heph-canvas-container">
          {activeCurve ? (
            <CurveEditor
              curve={activeCurve}
              durationMs={clip.durationMs}
              selectedKeyframeIdx={selectedKeyframeIdx}
              playheadMs={playheadMs}
              onKeyframeAdd={handleKeyframeAdd}
              onKeyframeMove={handleKeyframeMove}
              onKeyframeDelete={handleKeyframeDelete}
              onInterpolationChange={handleInterpolationChange}
              onBezierHandleMove={handleBezierHandleMove}
              onKeyframeSelect={handleKeyframeSelect}
            />
          ) : (
            <div className="heph-no-curve">
              <span>No curve selected</span>
            </div>
          )}
        </div>
      </div>

      {/* ═══ TOOLBAR ═══ */}
      <HephaestusToolbar
        activeCurve={activeCurve}
        selectedKeyframeIdx={selectedKeyframeIdx}
        onInterpolationChange={handleInterpolationChange}
        onModeChange={handleModeChange}
      />
    </div>
  )
}

export default HephaestusView
