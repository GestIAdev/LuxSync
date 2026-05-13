/**
 * 🔦 BEAM SECTION — WAVE 4726: ATOMIC WIRING
 * Óptica para moving heads: Gobos, Prism, Focus, Zoom, Iris.
 * Lee y escribe directamente en el programmer store vía ctx.cellKey.
 */

import React, { useCallback, useMemo } from 'react'
import { NodeFamily } from '../../../stores/programmer-types'
import type { CapabilityContext } from '../../../stores/programmer-types'
import { useProgrammerStore } from '../../../stores/programmerStore'
import { BeamIcon } from '../../icons/LuxIcons'

export interface BeamSectionProps {
  ctx: CapabilityContext<NodeFamily.BEAM>
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

export const BeamSection: React.FC<BeamSectionProps> = ({ ctx, isExpanded, onToggle }) => {
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

  const handleGoboChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    useProgrammerStore.getState().setCellBeam(ctx.cellKey, 'gobo', parseInt(e.target.value, 10))
  }, [ctx.cellKey])

  const handleGoboStep = useCallback((stepValue: number) => {
    useProgrammerStore.getState().setCellBeam(ctx.cellKey, 'gobo', stepValue)
  }, [ctx.cellKey])

  const handlePrismChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    useProgrammerStore.getState().setCellBeam(ctx.cellKey, 'prism', parseInt(e.target.value, 10))
  }, [ctx.cellKey])

  const handleFocusChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    useProgrammerStore.getState().setCellBeam(ctx.cellKey, 'focus', parseInt(e.target.value, 10))
  }, [ctx.cellKey])

  const handleZoomChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    useProgrammerStore.getState().setCellBeam(ctx.cellKey, 'zoom', parseInt(e.target.value, 10))
  }, [ctx.cellKey])

  const handleIrisChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    useProgrammerStore.getState().setCellBeam(ctx.cellKey, 'iris', parseInt(e.target.value, 10))
  }, [ctx.cellKey])

  const handleRelease = useCallback(() => {
    useProgrammerStore.getState().releaseCell(ctx.cellKey)
  }, [ctx.cellKey])

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
