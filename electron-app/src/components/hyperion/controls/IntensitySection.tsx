/**
 * 💡 INTENSITY SECTION — WAVE 4726: ATOMIC WIRING
 * Dimmer / Strobe / Limit control.
 * Lee y escribe directamente en el programmer store vía ctx.cellKey.
 */

import React, { useCallback } from 'react'
import { NodeFamily } from '../../../stores/programmer-types'
import type { CapabilityContext, CellKey } from '../../../stores/programmer-types'
import { useProgrammerStore } from '../../../stores/programmerStore'
import { IntensityIcon, StrobeIcon } from '../../icons/LuxIcons'

export interface IntensitySectionProps {
  ctx: CapabilityContext<NodeFamily.IMPACT>
  peerCellKeys?: readonly CellKey[]
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

export const IntensitySection: React.FC<IntensitySectionProps> = ({ ctx, peerCellKeys, isExpanded, onToggle }) => {
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

  // WAVE 4731: Hive Mind — dispatch simultáneo a todas las células del grupo
  const applyImpact = useCallback((ch: 'dimmer' | 'strobe' | 'limit', val: number) => {
    const store = useProgrammerStore.getState()
    store.setCellImpact(ctx.cellKey, ch, val)
    if (peerCellKeys) for (const k of peerCellKeys) store.setCellImpact(k, ch, val)
  }, [ctx.cellKey, peerCellKeys])

  const applyRelease = useCallback(() => {
    const store = useProgrammerStore.getState()
    store.releaseCell(ctx.cellKey)
    if (peerCellKeys) for (const k of peerCellKeys) store.releaseCell(k)
  }, [ctx.cellKey, peerCellKeys])

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    applyImpact('dimmer', Number(e.target.value))
  }, [applyImpact])

  const handlePresetClick = useCallback((v: number) => {
    applyImpact('dimmer', v)
  }, [applyImpact])

  const handleStrobeSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    applyImpact('strobe', Number(e.target.value))
  }, [applyImpact])

  const handleStrobePresetClick = useCallback((v: number) => {
    applyImpact('strobe', v)
  }, [applyImpact])

  const handleLimitSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value)
    applyImpact('limit', v)
    window.lux?.aether?.setInhibitLimit([...ctx.nodeIds], Math.max(0, Math.min(100, v)) / 100)
  }, [applyImpact, ctx.nodeIds])

  const handleLimitPresetClick = useCallback((v: number) => {
    applyImpact('limit', v)
    window.lux?.aether?.setInhibitLimit([...ctx.nodeIds], Math.max(0, Math.min(100, v)) / 100)
  }, [applyImpact, ctx.nodeIds])

  const handleLimitRelease = useCallback(() => {
    applyRelease()
    window.lux?.aether?.clearInhibitLimit([...ctx.nodeIds])
  }, [applyRelease, ctx.nodeIds])

  const handleRelease = useCallback(() => {
    applyRelease()
    window.lux?.aether?.clearInhibitLimit([...ctx.nodeIds])
  }, [applyRelease, ctx.nodeIds])

  const handleStrobeRelease = useCallback(() => {
    applyRelease()
  }, [applyRelease])
  
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

// ─────────────────────────────────────────────────────────────────────────────
// INTENSITY BODY — WAVE 4734 BATCH 2
// ─────────────────────────────────────────────────────────────────────────────
//
// Variante "pura" sin accordion shell. CellAccordion monta este componente
// como children slot. La lógica Hive Mind se despacha a TODOS los cellKeys
// del grupo agregado (allCellKeys), no solo al primero.

export interface IntensityBodyProps {
  /** CellKey de lectura (primary — determina qué override se muestra). */
  primaryKey: CellKey
  /** Todos los cellKeys del grupo (incluye primary). Setters disparan a todos. */
  allCellKeys: readonly CellKey[]
  /** nodeIds para IPC de inhibit limit. */
  nodeIds: readonly string[]
}

export const IntensityBody: React.FC<IntensityBodyProps> = ({ primaryKey, allCellKeys, nodeIds }) => {
  const ov = useProgrammerStore(s => s.cellOverrides.get(primaryKey))
  const data = ov?.payload.family === NodeFamily.IMPACT ? ov.payload.data : {}

  const dimmer = data.dimmer !== undefined ? Math.round(data.dimmer * 100) : null
  const strobe = data.strobe !== undefined ? Math.round(data.strobe * 100) : null
  const limit  = data.limit  !== undefined ? Math.round(data.limit  * 100) : 100

  const hasDimmer = data.dimmer !== undefined
  const hasStrobe = data.strobe !== undefined
  const hasLimit  = data.limit  !== undefined && data.limit < 1

  const sliderValue       = dimmer ?? 0
  const sliderStrobeValue = strobe ?? 0
  const sliderLimitValue  = limit
  const dimmerLabel = dimmer === null ? '-' : `${Math.round(dimmer)}%`
  const strobeLabel = strobe === null ? '-' : (strobe === 0 ? 'OFF' : `${Math.round(strobe)}%`)
  const limitLabel  = `${Math.round(limit)}%`

  const applyImpact = useCallback((ch: 'dimmer' | 'strobe' | 'limit', val: number) => {
    const store = useProgrammerStore.getState()
    for (const k of allCellKeys) store.setCellImpact(k, ch, val)
  }, [allCellKeys])

  const applyRelease = useCallback(() => {
    const store = useProgrammerStore.getState()
    for (const k of allCellKeys) store.releaseCell(k)
  }, [allCellKeys])

  return (
    <>
      {/* Main Dimmer Slider */}
      <div className="intensity-slider-container">
        <input
          type="range" min={0} max={100} value={sliderValue}
          onChange={e => applyImpact('dimmer', Number(e.target.value))}
          className="intensity-slider"
        />
        <div className="intensity-value">{dimmerLabel}</div>
      </div>

      <div className="intensity-bar">
        <div className="intensity-fill" style={{ width: `${sliderValue}%` }} />
      </div>

      <div className="intensity-presets">
        {PRESETS.map(p => (
          <button
            key={p.value}
            className={`preset-btn ${dimmer !== null && dimmer === p.value ? 'active' : ''}`}
            onClick={() => applyImpact('dimmer', p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {hasDimmer && <div className="override-badge">MANUAL</div>}

      {/* LIMIT */}
      <div className="strobe-control-section limit-control-section">
        <div className="strobe-header">
          <span className="limit-icon">🔒</span>
          <span className="strobe-label">LIMIT</span>
          {hasLimit && (
            <button className="release-btn release-btn-mini"
              onClick={() => { applyRelease(); window.lux?.aether?.clearInhibitLimit([...nodeIds]) }}
              title="Release limit"
            >↺</button>
          )}
        </div>
        <div className="intensity-slider-container">
          <input
            type="range" min={0} max={100} value={sliderLimitValue}
            onChange={e => {
              const v = Number(e.target.value)
              applyImpact('limit', v)
              window.lux?.aether?.setInhibitLimit([...nodeIds], Math.max(0, Math.min(100, v)) / 100)
            }}
            className="intensity-slider limit-slider"
          />
          <div className="intensity-value">{limitLabel}</div>
        </div>
        <div className="intensity-presets limit-presets">
          {LIMIT_PRESETS.map(p => (
            <button key={p.label}
              className={`preset-btn ${limit === p.value ? 'active' : ''}`}
              onClick={() => applyImpact('limit', p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
        {hasLimit && <div className="override-badge limit-override">LIMIT {limitLabel}</div>}
      </div>

      {/* STROBE */}
      <div className="strobe-control-section">
        <div className="strobe-header">
          <StrobeIcon size={14} className="strobe-icon" />
          <span className="strobe-label">STROBE</span>
          {hasStrobe && (
            <button className="release-btn release-btn-mini"
              onClick={applyRelease}
              title="Release strobe"
            >↺</button>
          )}
        </div>
        <div className="intensity-slider-container">
          <input
            type="range" min={0} max={100} value={sliderStrobeValue}
            onChange={e => applyImpact('strobe', Number(e.target.value))}
            className="intensity-slider strobe-slider"
          />
          <div className="intensity-value">{strobeLabel}</div>
        </div>
        <div className="intensity-presets strobe-presets">
          {STROBE_PRESETS.map(p => (
            <button key={p.label}
              className={`preset-btn ${strobe !== null && strobe === p.value ? 'active' : ''}`}
              onClick={() => applyImpact('strobe', p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
        {hasStrobe && <div className="override-badge strobe-override">STROBE MANUAL</div>}
      </div>
    </>
  )
}
