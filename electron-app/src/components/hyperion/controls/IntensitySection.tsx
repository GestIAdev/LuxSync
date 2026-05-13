/**
 * 💡 INTENSITY SECTION — WAVE 4726: ATOMIC WIRING
 * Dimmer / Strobe / Limit control.
 * Lee y escribe directamente en el programmer store vía ctx.cellKey.
 */

import React, { useCallback } from 'react'
import { NodeFamily } from '../../../stores/programmer-types'
import type { CapabilityContext } from '../../../stores/programmer-types'
import { useProgrammerStore } from '../../../stores/programmerStore'
import { IntensityIcon, StrobeIcon } from '../../icons/LuxIcons'

export interface IntensitySectionProps {
  ctx: CapabilityContext<NodeFamily.IMPACT>
  isExpanded: boolean
  onToggle: () => void
}

// Quick presets
const PRESETS = [
  { label: '0%', value: 0 },
  { label: '25%', value: 25 },
  { label: '50%', value: 50 },
  { label: '75%', value: 75 },
  { label: '100%', value: 100 },
]

// Strobe presets (Hz-equivalent labels)
const STROBE_PRESETS = [
  { label: 'OFF', value: 0 },
  { label: 'SLOW', value: 25 },
  { label: 'MED', value: 50 },
  { label: 'FAST', value: 75 },
  { label: 'MAX', value: 100 },
]

// 🔒 WAVE 3270: Limit presets
const LIMIT_PRESETS = [
  { label: '25%', value: 25 },
  { label: '50%', value: 50 },
  { label: '75%', value: 75 },
  { label: 'FULL', value: 100 },
]

export const IntensitySection: React.FC<IntensitySectionProps> = ({ ctx, isExpanded, onToggle }) => {
  const ov = useProgrammerStore(s => s.cellOverrides.get(ctx.cellKey))
  const data = ov?.payload.family === NodeFamily.IMPACT ? ov.payload.data : {}

  const dimmer = data.dimmer !== undefined ? Math.round(data.dimmer * 100) : null
  const strobe = data.strobe !== undefined ? Math.round(data.strobe * 100) : null
  const limit  = data.limit  !== undefined ? Math.round(data.limit  * 100) : 100

  const hasDimmer      = data.dimmer !== undefined
  const hasStrobe      = data.strobe !== undefined
  const hasLimit       = data.limit  !== undefined && data.limit < 1
  const hasAnyOverride = hasDimmer || hasStrobe || hasLimit

  const sliderValue       = dimmer ?? 0
  const sliderStrobeValue = strobe ?? 0
  const sliderLimitValue  = limit
  const dimmerLabel = dimmer === null ? '-' : `${Math.round(dimmer)}%`
  const strobeLabel = strobe === null ? '-' : (strobe === 0 ? 'OFF' : `${Math.round(strobe)}%`)
  const limitLabel  = `${Math.round(limit)}%`

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    useProgrammerStore.getState().setCellImpact(ctx.cellKey, 'dimmer', Number(e.target.value))
  }, [ctx.cellKey])

  const handlePresetClick = useCallback((v: number) => {
    useProgrammerStore.getState().setCellImpact(ctx.cellKey, 'dimmer', v)
  }, [ctx.cellKey])

  const handleStrobeSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    useProgrammerStore.getState().setCellImpact(ctx.cellKey, 'strobe', Number(e.target.value))
  }, [ctx.cellKey])

  const handleStrobePresetClick = useCallback((v: number) => {
    useProgrammerStore.getState().setCellImpact(ctx.cellKey, 'strobe', v)
  }, [ctx.cellKey])

  const handleLimitSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value)
    useProgrammerStore.getState().setCellImpact(ctx.cellKey, 'limit', v)
    window.lux?.aether?.setInhibitLimit([...ctx.nodeIds], Math.max(0, Math.min(100, v)) / 100)
  }, [ctx.cellKey, ctx.nodeIds])

  const handleLimitPresetClick = useCallback((v: number) => {
    useProgrammerStore.getState().setCellImpact(ctx.cellKey, 'limit', v)
    window.lux?.aether?.setInhibitLimit([...ctx.nodeIds], Math.max(0, Math.min(100, v)) / 100)
  }, [ctx.cellKey, ctx.nodeIds])

  const handleLimitRelease = useCallback(() => {
    useProgrammerStore.getState().releaseCell(ctx.cellKey)
    window.lux?.aether?.clearInhibitLimit([...ctx.nodeIds])
  }, [ctx.cellKey, ctx.nodeIds])

  const handleRelease = useCallback(() => {
    useProgrammerStore.getState().releaseCell(ctx.cellKey)
    window.lux?.aether?.clearInhibitLimit([...ctx.nodeIds])
  }, [ctx.cellKey, ctx.nodeIds])

  const handleStrobeRelease = useCallback(() => {
    useProgrammerStore.getState().releaseCell(ctx.cellKey)
  }, [ctx.cellKey])
  
  return (
    <div className={`programmer-section intensity-section ${hasAnyOverride ? 'has-override' : ''} ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="section-header clickable" onClick={onToggle}>
        <h4 className="section-title">
          <span className="section-icon">{isExpanded ? '▼' : '▶'}</span>
          <IntensityIcon size={18} className="title-icon" />
          INTENSITY
          <span className="section-node-label" style={{ color: 'var(--neon-base)' }}>: {ctx.label.toUpperCase()}</span>
        </h4>
        <div className="header-right">
          {hasAnyOverride && (
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
          {/* Main Dimmer Slider */}
          <div className="intensity-slider-container">
            <input
              type="range"
              min={0}
              max={100}
              value={sliderValue}
              onChange={handleSliderChange}
              className="intensity-slider"
            />
            <div className="intensity-value">{dimmerLabel}</div>
          </div>
          
          {/* Fill indicator */}
          <div className="intensity-bar">
            <div 
              className="intensity-fill"
              style={{ width: `${sliderValue}%` }}
            />
          </div>
          
          {/* Presets */}
          <div className="intensity-presets">
            {PRESETS.map(preset => (
              <button
                key={preset.value}
                className={`preset-btn ${dimmer !== null && dimmer === preset.value ? 'active' : ''}`}
                onClick={() => handlePresetClick(preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          
          {/* Override indicator */}
          {hasDimmer && (
            <div className="override-badge">MANUAL</div>
          )}

          {/* 🔒 WAVE 3270: LIMIT (INHIBIT) CONTROL */}
          <div className="strobe-control-section limit-control-section">
            <div className="strobe-header">
              <span className="limit-icon">🔒</span>
              <span className="strobe-label">LIMIT</span>
              {hasLimit && (
                <button
                  className="release-btn release-btn-mini"
                  onClick={handleLimitRelease}
                  title="Release limit (restore full power)"
                >
                  ↺
                </button>
              )}
            </div>
            
            <div className="intensity-slider-container">
              <input
                type="range"
                min={0}
                max={100}
                value={sliderLimitValue}
                onChange={handleLimitSliderChange}
                className="intensity-slider limit-slider"
              />
              <div className="intensity-value">{limitLabel}</div>
            </div>
            
            <div className="intensity-presets limit-presets">
              {LIMIT_PRESETS.map(preset => (
                <button
                  key={preset.label}
                  className={`preset-btn ${limit === preset.value ? 'active' : ''}`}
                  onClick={() => handleLimitPresetClick(preset.value)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            
            {hasLimit && (
              <div className="override-badge limit-override">LIMIT {limitLabel}</div>
            )}
          </div>
          
          {/* ⚡ WAVE 2494: STROBE CONTROL */}
          <div className="strobe-control-section">
            <div className="strobe-header">
              <StrobeIcon size={14} className="strobe-icon" />
              <span className="strobe-label">STROBE</span>
              {hasStrobe && (
                <button
                  className="release-btn release-btn-mini"
                  onClick={handleStrobeRelease}
                  title="Release strobe to AI"
                >
                  ↺
                </button>
              )}
            </div>
            
            <div className="intensity-slider-container">
              <input
                type="range"
                min={0}
                max={100}
                value={sliderStrobeValue}
                onChange={handleStrobeSliderChange}
                className="intensity-slider strobe-slider"
              />
              <div className="intensity-value">{strobeLabel}</div>
            </div>
            
            <div className="intensity-presets strobe-presets">
              {STROBE_PRESETS.map(preset => (
                <button
                  key={preset.label}
                  className={`preset-btn ${strobe !== null && strobe === preset.value ? 'active' : ''}`}
                  onClick={() => handleStrobePresetClick(preset.value)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            
            {hasStrobe && (
              <div className="override-badge strobe-override">STROBE MANUAL</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default IntensitySection
