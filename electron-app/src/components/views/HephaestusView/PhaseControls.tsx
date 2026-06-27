/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ PHASE CONTROLS — WAVE 7021: EURORACK PHASE CHASSIS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Sintetizador modular estilo Eurorack para distribución de fase.
 * 4 faceplates: Wave Shaper, Block Matrix, Chaos Engine, Spatial Behavior.
 * Props y conexiones idénticas a WAVE 7001.
 *
 * @module views/HephaestusView/PhaseControls
 * @version WAVE 7021
 */

import React, { useCallback } from 'react'
import type { PhaseConfigPro, PhaseSymmetryMode } from '../../../core/hephaestus/phase/PhaseConfigPro'
import { DEFAULT_PHASE_CONFIG_PRO } from '../../../core/hephaestus/phase/PhaseConfigPro'
import type { SpatialBehavior } from '../../../core/arsenal/lfxTypes'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface PhaseControlsProps {
  config: PhaseConfigPro | null
  onPhaseChange: (recipe: (draft: PhaseConfigPro) => void) => void
  disabled?: boolean
  spatialBehavior?: SpatialBehavior
  onSpatialBehaviorChange?: (sb: SpatialBehavior) => void
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const SYMMETRY_MODES: Array<{ id: PhaseSymmetryMode; label: string; icon: string; hint: string }> = [
  { id: 'linear',     label: 'LIN',     icon: '📐', hint: 'Wave chase — sequential offset' },
  { id: 'mirror',     label: 'MIRR',    icon: '🪞', hint: 'Fold from edges — breathing effect' },
  { id: 'center-out', label: 'CTR',     icon: '🎯', hint: 'Pulse from center — radial expansion' },
]

const SPATIAL_OPTIONS: Array<{ value: SpatialBehavior; label: string; hint: string }> = [
  { value: 'static',          label: 'STATIC',  hint: 'No pan/tilt. Only dimmer/color/optics.' },
  { value: 'absolute',        label: 'ABS',     hint: 'Clip controls pan/tilt directly (DMX absolute).' },
  { value: 'relative_offset', label: 'REL',     hint: 'Emits pan_offset/tilt_offset ∈ [-1,+1] over IK anchor.' },
  { value: 'spatial',         label: '3D',      hint: 'Reserved: emits 3D target trajectory (future).' },
]

// ── Shared inline styles ──

const moduleBase: React.CSSProperties = {
  background: '#121212',
  border: '1px solid #222',
  borderRadius: '6px',
  padding: '12px',
  boxSizing: 'border-box',
  position: 'relative',
  overflow: 'hidden',
}

const moduleTitle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.12em',
  color: 'rgba(255,255,255,0.5)',
  marginBottom: '10px',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
}

const divider: React.CSSProperties = {
  height: '1px',
  background: '#2a2a2a',
  margin: '8px 0',
}

const rowLabel: React.CSSProperties = {
  fontSize: '9px',
  fontWeight: 600,
  letterSpacing: '0.1em',
  color: 'rgba(255,255,255,0.35)',
  textTransform: 'uppercase',
  marginBottom: '4px',
}

const sliderStyle: React.CSSProperties = {
  width: '100%',
  height: '4px',
  appearance: 'none',
  background: '#2a2a2a',
  borderRadius: '2px',
  outline: 'none',
  cursor: 'pointer',
}

const numInputStyle: React.CSSProperties = {
  width: '48px',
  background: '#0a0a0a',
  border: '1px solid #2a2a2a',
  borderRadius: '4px',
  color: '#ff6b2b',
  fontSize: '13px',
  fontWeight: 700,
  textAlign: 'center',
  padding: '4px 2px',
  outline: 'none',
}

const segBtnBase: React.CSSProperties = {
  flex: 1,
  padding: '6px 4px',
  border: '1px solid #2a2a2a',
  background: '#0a0a0a',
  color: 'rgba(255,255,255,0.4)',
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  cursor: 'pointer',
  transition: 'all 0.12s ease',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '2px',
}

const dirBtnBase: React.CSSProperties = {
  flex: 1,
  padding: '6px 4px',
  border: '1px solid #2a2a2a',
  borderRadius: '4px',
  background: '#0a0a0a',
  color: 'rgba(255,255,255,0.4)',
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  cursor: 'pointer',
  transition: 'all 0.12s ease',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const PhaseControls: React.FC<PhaseControlsProps> = ({
  config,
  onPhaseChange,
  disabled = false,
  spatialBehavior,
  onSpatialBehaviorChange,
}) => {
  const active = config ?? DEFAULT_PHASE_CONFIG_PRO

  const handleSpreadChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onPhaseChange(draft => { draft.spreadDeg = parseFloat(e.target.value) })
  }, [onPhaseChange])

  const handleSymmetryChange = useCallback((symmetry: PhaseSymmetryMode) => {
    onPhaseChange(draft => { draft.symmetry = symmetry })
  }, [onPhaseChange])

  const handleWingsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseInt(e.target.value, 10)
    onPhaseChange(draft => { draft.wings = Math.max(1, Math.min(isNaN(raw) ? 1 : raw, 8)) })
  }, [onPhaseChange])

  const handleBlocksChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseInt(e.target.value, 10)
    onPhaseChange(draft => { draft.blocks = Math.max(1, Math.min(isNaN(raw) ? 1 : raw, 16)) })
  }, [onPhaseChange])

  const handleShuffleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onPhaseChange(draft => { draft.shuffle = parseFloat(e.target.value) })
  }, [onPhaseChange])

  const handleShuffleSeedChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseInt(e.target.value, 10)
    onPhaseChange(draft => { draft.shuffleSeed = isNaN(raw) ? 1 : Math.max(1, raw) })
  }, [onPhaseChange])

  const handleDirectionToggle = useCallback(() => {
    const direction: 1 | -1 = active.direction === 1 ? -1 : 1
    onPhaseChange(draft => { draft.direction = direction })
  }, [active.direction, onPhaseChange])

  const handleSeedRandomize = useCallback(() => {
    onPhaseChange(draft => { draft.shuffleSeed = Math.floor(Math.random() * 8999) + 1000 })
  }, [onPhaseChange])

  const spreadPercent = Math.round((active.spreadDeg / 360) * 100)
  const isActive = active.spreadDeg > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ═══ MÓDULO 1: WAVE SHAPER ═══ */}
      <div style={{ ...moduleBase, borderTop: '2px solid #ff6600' }}>
        <div style={moduleTitle}>
          <span style={{ color: '#ff6600' }}>▣</span>
          WAVE SHAPER
          <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.2)', fontSize: '8px' }}>Balística</span>
        </div>

        {/* Spread */}
        <div style={rowLabel}>SPREAD</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="range"
            style={sliderStyle}
            min={0}
            max={1440}
            step={1}
            value={active.spreadDeg}
            onChange={handleSpreadChange}
            disabled={disabled}
          />
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#ff6b2b', minWidth: '42px', textAlign: 'right' }}>
            {active.spreadDeg}º
          </span>
        </div>
        {isActive && (
          <div style={{ marginTop: '4px' }}>
            <span style={{
              display: 'inline-block',
              fontSize: '8px',
              fontWeight: 700,
              color: '#ff6600',
              background: 'rgba(255,102,0,0.1)',
              border: '1px solid rgba(255,102,0,0.3)',
              borderRadius: '3px',
              padding: '1px 6px',
            }}>
              {spreadPercent}% CYCLE
            </span>
          </div>
        )}

        <div style={divider} />

        {/* Symmetry */}
        <div style={rowLabel}>SYMMETRY</div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {SYMMETRY_MODES.map(mode => (
            <button
              key={mode.id}
              type="button"
              title={mode.hint}
              disabled={disabled}
              onClick={() => handleSymmetryChange(mode.id)}
              style={{
                ...segBtnBase,
                borderRadius: '4px',
                ...(active.symmetry === mode.id
                  ? { background: 'rgba(255,102,0,0.12)', borderColor: '#ff6600', color: '#ff6b2b', boxShadow: '0 0 6px rgba(255,102,0,0.2)' }
                  : {}),
              }}
            >
              <span style={{ fontSize: '12px' }}>{mode.icon}</span>
              <span>{mode.label}</span>
            </button>
          ))}
        </div>

        <div style={divider} />

        {/* Wings + Direction */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <div style={rowLabel}>WINGS</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="number"
                style={numInputStyle}
                min={1}
                max={8}
                value={active.wings}
                onChange={handleWingsChange}
                disabled={disabled}
              />
              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>
                {active.wings === 1 ? 'single' : `${active.wings}× freq`}
              </span>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={rowLabel}>DIRECTION</div>
            <button
              type="button"
              disabled={disabled}
              onClick={handleDirectionToggle}
              title={active.direction === 1 ? 'Forward: fixture 0 first' : 'Reverse: fixture N first'}
              style={{
                ...dirBtnBase,
                ...(active.direction === 1
                  ? { color: '#ff6b2b', borderColor: 'rgba(255,102,0,0.4)', background: 'rgba(255,102,0,0.06)' }
                  : { color: '#00e5ff', borderColor: 'rgba(0,229,255,0.4)', background: 'rgba(0,229,255,0.06)' }),
              }}
            >
              <span style={{ fontSize: '14px' }}>{active.direction === 1 ? '→' : '←'}</span>
              <span>{active.direction === 1 ? 'FWD' : 'REV'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ═══ MÓDULO 2: BLOCK MATRIX ═══ */}
      <div style={{ ...moduleBase, borderTop: '2px solid #00e5ff' }}>
        <div style={moduleTitle}>
          <span style={{ color: '#00e5ff' }}>▣</span>
          BLOCK MATRIX
          <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.2)', fontSize: '8px' }}>MAtricks</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={rowLabel}>(</div>
          <input
            type="number"
            style={{ ...numInputStyle, width: '56px', color: '#00e5ff' }}
            min={1}
            max={16}
            value={active.blocks}
            onChange={handleBlocksChange}
            disabled={disabled}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
              {active.blocks === 1 ? 'Individual fixtures' : `Groups of ${active.blocks}`}
            </div>
            <div style={{ fontSize: '8px', fontStyle: 'italic', color: 'rgba(255,255,255,0.2)', marginTop: '2px' }}>
              MAtricks Column Grouping
            </div>
          </div>
        </div>
      </div>

      {/* ═══ MÓDULO 3: CHAOS ENGINE ═══ */}
      <div style={{ ...moduleBase, borderTop: '2px solid #ff1744' }}>
        <div style={moduleTitle}>
          <span style={{ color: '#ff1744' }}>▣</span>
          CHAOS ENGINE
          <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.2)', fontSize: '8px' }}>Entropía</span>
        </div>

        {/* Shuffle */}
        <div style={rowLabel}>SHUFFLE</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="range"
            style={sliderStyle}
            min={0}
            max={1}
            step={0.01}
            value={active.shuffle}
            onChange={handleShuffleChange}
            disabled={disabled}
          />
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#ff1744', minWidth: '34px', textAlign: 'right' }}>
            {Math.round(active.shuffle * 100)}%
          </span>
        </div>

        <div style={divider} />

        {/* Seed + Dice */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
          <div style={{ flex: 1 }}>
            <div style={rowLabel}>SEED</div>
            <input
              type="number"
              style={{ ...numInputStyle, width: '72px', color: '#ff1744' }}
              min={1}
              value={active.shuffleSeed}
              onChange={handleShuffleSeedChange}
              disabled={disabled}
            />
          </div>
          <button
            type="button"
            title="Randomize Seed"
            disabled={disabled}
            onClick={handleSeedRandomize}
            style={{
              padding: '5px 10px',
              border: '1px solid #2a2a2a',
              borderRadius: '4px',
              background: '#0a0a0a',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.12s ease',
            }}
          >
            🎲
          </button>
        </div>
      </div>

      {/* ═══ MÓDULO 4: SPATIAL BEHAVIOR ═══ */}
      {onSpatialBehaviorChange && (
        <div style={{ ...moduleBase, borderTop: '2px solid #00e676' }}>
          <div style={moduleTitle}>
            <span style={{ color: '#00e676' }}>▣</span>
            SPATIAL BEHAVIOR
            <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.2)', fontSize: '8px' }}>ADN</span>
          </div>

          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {SPATIAL_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                title={opt.hint}
                disabled={disabled}
                onClick={() => onSpatialBehaviorChange(opt.value)}
                style={{
                  ...segBtnBase,
                  borderRadius: '4px',
                  flex: '1 1 calc(50% - 2px)',
                  ...(spatialBehavior === opt.value
                    ? { background: 'rgba(0,230,118,0.1)', borderColor: '#00e676', color: '#00e676', boxShadow: '0 0 6px rgba(0,230,118,0.15)' }
                    : {}),
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p style={{
            marginTop: '8px',
            fontSize: '8px',
            fontStyle: 'italic',
            color: 'rgba(255,255,255,0.25)',
            lineHeight: '1.3',
            margin: '8px 0 0 0',
          }}>
            {SPATIAL_OPTIONS.find(o => o.value === (spatialBehavior ?? 'absolute'))?.hint ?? ''}
          </p>
        </div>
      )}
    </div>
  )
}

export default PhaseControls
