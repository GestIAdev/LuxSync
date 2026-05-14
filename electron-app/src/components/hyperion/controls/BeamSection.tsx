/**
 * 🔦 BEAM SECTION — WAVE 4726: ATOMIC WIRING
 * Óptica para moving heads: Gobos, Prism, Focus, Zoom, Iris.
 * Lee y escribe directamente en el programmer store vía ctx.cellKey.
 */

import React, { useCallback, useMemo } from 'react'
import { NodeFamily } from '../../../stores/programmer-types'
import type { CapabilityContext, CellKey } from '../../../stores/programmer-types'
import { useProgrammerStore } from '../../../stores/programmerStore'
import { BeamIcon } from '../../icons/LuxIcons'

export interface BeamSectionProps {
  ctx: CapabilityContext<NodeFamily.BEAM>
  peerCellKeys?: readonly CellKey[]
  isExpanded: boolean
  onToggle: () => void
}

// Gobo steps (8 positions on typical wheel)
const GOBO_STEPS = [
  { value: 0, label: 'OPEN' },
  { value: 36, label: '1' },
  { value: 72, label: '2' },
  { value: 108, label: '3' },
  { value: 144, label: '4' },
  { value: 180, label: '5' },
  { value: 216, label: '6' },
  { value: 255, label: '7' },
]

export const BeamSection: React.FC<BeamSectionProps> = ({ ctx, peerCellKeys, isExpanded, onToggle }) => {
  const ov = useProgrammerStore(s => s.cellOverrides.get(ctx.cellKey))
  const data = ov?.payload.family === NodeFamily.BEAM ? ov.payload.data : {}

  const clamp255 = useCallback((v: number) => Math.max(0, Math.min(255, Math.round(v))), [])
  const denorm255 = useCallback((v: number | undefined, fallback: number) => {
    return v !== undefined ? clamp255(v * 255) : fallback
  }, [clamp255])

  const gobo       = denorm255(data.gobo,  0)
  const prismValue = denorm255(data.prism, 0)
  const focus      = denorm255(data.focus, 128)
  const zoom       = denorm255(data.zoom,  128)
  const iris       = denorm255(data.iris,  255)
  const hasOverride = Object.keys(data).length > 0

  // WAVE 4731: Hive Mind — dispatch simultáneo a todas las células del grupo
  const applyBeam = useCallback((ch: 'gobo' | 'prism' | 'focus' | 'zoom' | 'iris', val: number) => {
    const store = useProgrammerStore.getState()
    store.setCellBeam(ctx.cellKey, ch, val)
    if (peerCellKeys) for (const k of peerCellKeys) store.setCellBeam(k, ch, val)
  }, [ctx.cellKey, peerCellKeys])

  const applyRelease = useCallback(() => {
    const store = useProgrammerStore.getState()
    store.releaseCell(ctx.cellKey)
    if (peerCellKeys) for (const k of peerCellKeys) store.releaseCell(k)
  }, [ctx.cellKey, peerCellKeys])

  const handleGoboChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    applyBeam('gobo', parseInt(e.target.value, 10))
  }, [applyBeam])

  const handleGoboStep = useCallback((stepValue: number) => {
    applyBeam('gobo', stepValue)
  }, [applyBeam])

  const handlePrismChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    applyBeam('prism', parseInt(e.target.value, 10))
  }, [applyBeam])

  const handleFocusChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    applyBeam('focus', parseInt(e.target.value, 10))
  }, [applyBeam])

  const handleZoomChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    applyBeam('zoom', parseInt(e.target.value, 10))
  }, [applyBeam])

  const handleIrisChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    applyBeam('iris', parseInt(e.target.value, 10))
  }, [applyBeam])

  const handleRelease = useCallback(() => {
    applyRelease()
  }, [applyRelease])

  // Find closest gobo step for display
  const currentGoboStep = useMemo(() => GOBO_STEPS.reduce((prev, curr) =>
    Math.abs(curr.value - gobo) < Math.abs(prev.value - gobo) ? curr : prev
  ), [gobo])
  
  return (
    <div className={`programmer-section beam-section ${hasOverride ? 'has-override' : ''} ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="section-header clickable" onClick={onToggle}>
        <h4 className="section-title">
          <span className="section-icon">{isExpanded ? '▼' : '▶'}</span>
          <BeamIcon size={18} className="title-icon" />
          BEAM / OPTICS
        </h4>
        <div className="header-right">
          {hasOverride && (
            <button 
              className="release-btn"
              onClick={(e) => {
                e.stopPropagation()
                handleRelease()
              }}
              title="Release to AI control"
            >
              ↺
            </button>
          )}
        </div>
      </div>
      
      {isExpanded && (
        <>
          {/* ═══════════════════════════════════════════════════════════════════
              GOBO WHEEL
              ═══════════════════════════════════════════════════════════════════ */}
          <div className="beam-control gobo-control">
            <div className="control-header">
              <label className="control-label">GOBO</label>
              <span className="control-value">{currentGoboStep.label}</span>
            </div>
            
            {/* Gobo step buttons */}
            <div className="gobo-steps">
              {GOBO_STEPS.map(step => (
                <button
                  key={step.value}
                  className={`gobo-step ${gobo === step.value ? 'active' : ''}`}
                  onClick={() => handleGoboStep(step.value)}
                  title={`Gobo ${step.label}`}
                >
                  {step.label}
                </button>
              ))}
            </div>
            
            {/* Gobo slider for fine control */}
            <input
              type="range"
              className="beam-slider gobo-slider"
              min={0}
              max={255}
              value={gobo}
              onChange={handleGoboChange}
            />
          </div>
          
          {/* ═══════════════════════════════════════════════════════════════════
              PRISM CONTROL
              ═══════════════════════════════════════════════════════════════════ */}
          <div className="beam-control prism-control">
            <div className="control-header">
              <label className="control-label">PRISM</label>
              <span className="control-value">
                {prismValue === 0 ? 'OFF' : prismValue < 122 ? `${prismValue}` : `⟳ ${prismValue}`}
              </span>
            </div>
            
            {/* Single slider: 0=off, 1-121=pattern select, 122-255=active+speed */}
            <div className="prism-slider-wrap">
              <input
                type="range"
                className="beam-slider prism-slider"
                min={0}
                max={255}
                value={prismValue}
                onChange={handlePrismChange}
              />
              <div className="prism-markers">
                <span className="prism-marker" style={{ left: '0%' }}>OFF</span>
                <span className="prism-marker" style={{ left: '47.8%' }}>122</span>
                <span className="prism-marker" style={{ left: '100%' }}>255</span>
              </div>
            </div>
          </div>
          
          {/* ═══════════════════════════════════════════════════════════════════
              FOCUS & ZOOM
              ═══════════════════════════════════════════════════════════════════ */}
          <div className="beam-control optics-control">
            {/* Focus */}
            <div className="optic-row">
              <label className="optic-label">FOCUS</label>
              <span className="optic-range-label near">Near</span>
              <input
                type="range"
                className="beam-slider focus-slider"
                min={0}
                max={255}
                value={focus}
                onChange={handleFocusChange}
              />
              <span className="optic-range-label far">Far</span>
              <span className="optic-value">{Math.round((focus / 255) * 100)}%</span>
            </div>
            
            {/* Zoom */}
            <div className="optic-row">
              <label className="optic-label">ZOOM</label>
              <span className="optic-range-label spot">Spot</span>
              <input
                type="range"
                className="beam-slider zoom-slider"
                min={0}
                max={255}
                value={zoom}
                onChange={handleZoomChange}
              />
              <span className="optic-range-label flood">Flood</span>
              <span className="optic-value">{Math.round((zoom / 255) * 100)}%</span>
            </div>
            
            {/* Iris */}
            <div className="optic-row">
              <label className="optic-label">IRIS</label>
              <span className="optic-range-label closed">Closed</span>
              <input
                type="range"
                className="beam-slider iris-slider"
                min={0}
                max={255}
                value={iris}
                onChange={handleIrisChange}
              />
              <span className="optic-range-label open">Open</span>
              <span className="optic-value">{Math.round((iris / 255) * 100)}%</span>
            </div>
          </div>
          
          {/* Override indicator */}
          {hasOverride && (
            <div className="override-badge">MANUAL</div>
          )}
        </>
      )}
    </div>
  )
}

export default BeamSection

// ─────────────────────────────────────────────────────────────────────────────
// BEAM BODY — WAVE 4734 BATCH 2
// ─────────────────────────────────────────────────────────────────────────────

export interface BeamBodyProps {
  primaryKey: CellKey
  allCellKeys: readonly CellKey[]
}

export const BeamBody: React.FC<BeamBodyProps> = ({ primaryKey, allCellKeys }) => {
  const ov   = useProgrammerStore(s => s.cellOverrides.get(primaryKey))
  const data = ov?.payload.family === NodeFamily.BEAM ? ov.payload.data : {}

  const clamp255Local = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  const denorm = (v: number | undefined, fallback: number) =>
    v !== undefined ? clamp255Local(v * 255) : fallback

  const gobo       = denorm(data.gobo,  0)
  const prismValue = denorm(data.prism, 0)
  const focus      = denorm(data.focus, 128)
  const zoom       = denorm(data.zoom,  128)
  const iris       = denorm(data.iris,  255)

  const applyBeam = useCallback((ch: 'gobo' | 'prism' | 'focus' | 'zoom' | 'iris', val: number) => {
    const store = useProgrammerStore.getState()
    for (const k of allCellKeys) store.setCellBeam(k, ch, val)
  }, [allCellKeys])

  const currentGoboStep = useMemo(() =>
    GOBO_STEPS.reduce((prev, curr) =>
      Math.abs(curr.value - gobo) < Math.abs(prev.value - gobo) ? curr : prev
    ),
  [gobo])

  return (
    <>
      {/* GOBO */}
      <div className="beam-control gobo-control">
        <div className="control-header">
          <label className="control-label">GOBO</label>
          <span className="control-value">{currentGoboStep.label}</span>
        </div>
        <div className="gobo-steps">
          {GOBO_STEPS.map(step => (
            <button key={step.value}
              className={`gobo-step ${gobo === step.value ? 'active' : ''}`}
              onClick={() => applyBeam('gobo', step.value)}
              title={`Gobo ${step.label}`}
            >
              {step.label}
            </button>
          ))}
        </div>
        <input type="range" className="beam-slider gobo-slider"
          min={0} max={255} value={gobo}
          onChange={e => applyBeam('gobo', parseInt(e.target.value, 10))}
        />
      </div>

      {/* PRISM */}
      <div className="beam-control prism-control">
        <div className="control-header">
          <label className="control-label">PRISM</label>
          <span className="control-value">
            {prismValue === 0 ? 'OFF' : prismValue < 122 ? `${prismValue}` : `⟳ ${prismValue}`}
          </span>
        </div>
        <div className="prism-slider-wrap">
          <input type="range" className="beam-slider prism-slider"
            min={0} max={255} value={prismValue}
            onChange={e => applyBeam('prism', parseInt(e.target.value, 10))}
          />
          <div className="prism-markers">
            <span className="prism-marker" style={{ left: '0%' }}>OFF</span>
            <span className="prism-marker" style={{ left: '47.8%' }}>122</span>
            <span className="prism-marker" style={{ left: '100%' }}>255</span>
          </div>
        </div>
      </div>

      {/* FOCUS / ZOOM / IRIS */}
      <div className="beam-control optics-control">
        <div className="optic-row">
          <label className="optic-label">FOCUS</label>
          <span className="optic-range-label near">Near</span>
          <input type="range" className="beam-slider focus-slider"
            min={0} max={255} value={focus}
            onChange={e => applyBeam('focus', parseInt(e.target.value, 10))}
          />
          <span className="optic-range-label far">Far</span>
          <span className="optic-value">{Math.round((focus / 255) * 100)}%</span>
        </div>
        <div className="optic-row">
          <label className="optic-label">ZOOM</label>
          <span className="optic-range-label spot">Spot</span>
          <input type="range" className="beam-slider zoom-slider"
            min={0} max={255} value={zoom}
            onChange={e => applyBeam('zoom', parseInt(e.target.value, 10))}
          />
          <span className="optic-range-label flood">Flood</span>
          <span className="optic-value">{Math.round((zoom / 255) * 100)}%</span>
        </div>
        <div className="optic-row">
          <label className="optic-label">IRIS</label>
          <span className="optic-range-label closed">Closed</span>
          <input type="range" className="beam-slider iris-slider"
            min={0} max={255} value={iris}
            onChange={e => applyBeam('iris', parseInt(e.target.value, 10))}
          />
          <span className="optic-range-label open">Open</span>
          <span className="optic-value">{Math.round((iris / 255) * 100)}%</span>
        </div>
      </div>

      {Object.keys(data).length > 0 && <div className="override-badge">MANUAL</div>}
    </>
  )
}
