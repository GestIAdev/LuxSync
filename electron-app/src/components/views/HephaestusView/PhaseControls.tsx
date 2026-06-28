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
import type { PhaseOverrideMap, PhaseOverride } from '../../../core/hephaestus/phase/PhaseOverride'
import { PhaseCanvas } from './PhaseCanvas'
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

  // ── Phase Canvas (Módulo 5) ──
  fixtureIds?: string[]
  durationMs?: number
  phaseOverrides?: PhaseOverrideMap
  selectedFixtureId?: string | null
  onSelectFixture?: (id: string | null) => void
  onUpdatePhaseOverride?: (fixtureId: string, override: PhaseOverride | null) => void
  onBakePhaseOverrides?: () => void
  onClearPhaseOverrides?: () => void
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

// ── Neon accent colors per module ──
const NEON = {
  shaper:  '#ff6b2b',
  block:   '#00e5ff',
  chaos:   '#ff1744',
  spatial: '#00e676',
  canvas:  '#b388ff',
} as const

const moduleBase: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.03)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: '8px',
  padding: '12px',
  boxSizing: 'border-box',
  position: 'relative',
  overflow: 'hidden',
  flexShrink: 0,
}

const moduleTitle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 800,
  letterSpacing: '0.14em',
  color: 'rgba(255,255,255,0.6)',
  marginBottom: '8px',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  textShadow: '0 0 12px currentColor',
  flexShrink: 0,
}

const divider: React.CSSProperties = {
  height: '1px',
  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
  margin: '6px 0',
}

const rowLabel: React.CSSProperties = {
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.12em',
  color: 'rgba(255,255,255,0.4)',
  textTransform: 'uppercase',
  marginBottom: '3px',
  flexShrink: 0,
}

const sliderStyle: React.CSSProperties = {
  width: '100%',
  height: '4px',
  appearance: 'none',
  background: 'rgba(255, 255, 255, 0.06)',
  borderRadius: '2px',
  outline: 'none',
  cursor: 'pointer',
}

const numInputStyle: React.CSSProperties = {
  width: '48px',
  background: 'rgba(0, 0, 0, 0.4)',
  border: '1px solid rgba(255, 107, 43, 0.2)',
  borderRadius: '4px',
  color: NEON.shaper,
  fontSize: '13px',
  fontWeight: 700,
  textAlign: 'center',
  padding: '4px 2px',
  outline: 'none',
  boxShadow: 'inset 0 0 8px rgba(255, 107, 43, 0.05)',
}

const segBtnBase: React.CSSProperties = {
  flex: 1,
  padding: '7px 4px',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  background: 'rgba(0, 0, 0, 0.3)',
  color: 'rgba(255,255,255,0.4)',
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '2px',
  borderRadius: '5px',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
}

const dirBtnBase: React.CSSProperties = {
  flex: 1,
  padding: '7px 4px',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  borderRadius: '5px',
  background: 'rgba(0, 0, 0, 0.3)',
  color: 'rgba(255,255,255,0.4)',
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
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
  fixtureIds,
  durationMs,
  phaseOverrides,
  selectedFixtureId,
  onSelectFixture,
  onUpdatePhaseOverride,
  onBakePhaseOverrides,
  onClearPhaseOverrides,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minHeight: 0 }}>

      {/* ═══ MÓDULO 1: WAVE SHAPER ═══ */}
      <div style={{
        ...moduleBase,
        borderTop: `2px solid ${NEON.shaper}`,
        boxShadow: `0 0 24px rgba(255, 107, 43, 0.15), inset 0 1px 0 rgba(255, 107, 43, 0.1), 0 0 1px ${NEON.shaper}`,
      }}>
        <div style={{ ...moduleTitle, color: NEON.shaper }}>
          <span style={{ color: NEON.shaper, textShadow: `0 0 10px ${NEON.shaper}` }}>▣</span>
          <span style={{ color: 'rgba(255,255,255,0.7)' }}>WAVE SHAPER</span>
          <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.2)', fontSize: '8px', textShadow: 'none' }}>Balística</span>
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
          <span style={{ fontSize: '11px', fontWeight: 700, color: NEON.shaper, minWidth: '42px', textAlign: 'right', textShadow: `0 0 8px ${NEON.shaper}40` }}>
            {active.spreadDeg}º
          </span>
        </div>
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
                  ? { background: `rgba(255, 107, 43, 0.1)`, border: `1px solid ${NEON.shaper}`, color: NEON.shaper, boxShadow: `0 0 12px rgba(255, 107, 43, 0.25), inset 0 0 8px rgba(255, 107, 43, 0.08)` }
                  : {}),
              }}
            >
              <span style={{ fontSize: '12px' }}>{mode.icon}</span>
              <span>{mode.label}</span>
            </button>
          ))}
        </div>

        <div style={divider} />

        {/* Wings + Direction + Cycle badge */}
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
                  ? { color: NEON.shaper, border: `1px solid rgba(255, 107, 43, 0.4)`, background: 'rgba(255, 107, 43, 0.06)', boxShadow: `0 0 10px rgba(255, 107, 43, 0.15)` }
                  : { color: NEON.block, border: `1px solid rgba(0, 229, 255, 0.4)`, background: 'rgba(0, 229, 255, 0.06)', boxShadow: `0 0 10px rgba(0, 229, 255, 0.15)` }),
              }}
            >
              <span style={{ fontSize: '14px' }}>{active.direction === 1 ? '→' : '←'}</span>
              <span>{active.direction === 1 ? 'FWD' : 'REV'}</span>
            </button>
          </div>
          {isActive && (
            <div style={{ flexShrink: 0, paddingBottom: '2px' }}>
              <span style={{
                display: 'inline-block',
                fontSize: '8px',
                fontWeight: 700,
                color: NEON.shaper,
                background: 'rgba(255, 107, 43, 0.08)',
                border: `1px solid rgba(255, 107, 43, 0.3)`,
                borderRadius: '3px',
                padding: '2px 6px',
                textShadow: `0 0 6px ${NEON.shaper}60`,
                whiteSpace: 'nowrap',
              }}>
                {spreadPercent}% CYCLE
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ═══ MÓDULO 2: BLOCK MATRIX ═══ */}
      <div style={{
        ...moduleBase,
        borderTop: `2px solid ${NEON.block}`,
        boxShadow: `0 0 24px rgba(0, 229, 255, 0.15), inset 0 1px 0 rgba(0, 229, 255, 0.1), 0 0 1px ${NEON.block}`,
      }}>
        <div style={{ ...moduleTitle, color: NEON.block }}>
          <span style={{ color: NEON.block, textShadow: `0 0 10px ${NEON.block}` }}>▣</span>
          <span style={{ color: 'rgba(255,255,255,0.7)' }}>BLOCK MATRIX</span>
          <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.2)', fontSize: '8px', textShadow: 'none' }}>MAtricks</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={rowLabel}></div>
          <input
            type="number"
            style={{ ...numInputStyle, width: '56px', color: NEON.block, border: '1px solid rgba(0, 229, 255, 0.2)', boxShadow: 'inset 0 0 8px rgba(0, 229, 255, 0.05)' }}
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
      <div style={{
        ...moduleBase,
        borderTop: `2px solid ${NEON.chaos}`,
        boxShadow: `0 0 24px rgba(255, 23, 68, 0.15), inset 0 1px 0 rgba(255, 23, 68, 0.1), 0 0 1px ${NEON.chaos}`,
      }}>
        <div style={{ ...moduleTitle, color: NEON.chaos }}>
          <span style={{ color: NEON.chaos, textShadow: `0 0 10px ${NEON.chaos}` }}>▣</span>
          <span style={{ color: 'rgba(255,255,255,0.7)' }}>CHAOS ENGINE</span>
          <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.2)', fontSize: '8px', textShadow: 'none' }}>Entropía</span>
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
          <span style={{ fontSize: '11px', fontWeight: 700, color: NEON.chaos, minWidth: '34px', textAlign: 'right', textShadow: `0 0 8px ${NEON.chaos}40` }}>
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
              style={{ ...numInputStyle, width: '72px', color: NEON.chaos, border: '1px solid rgba(255, 23, 68, 0.2)', boxShadow: 'inset 0 0 8px rgba(255, 23, 68, 0.05)' }}
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
              border: `1px solid rgba(255, 23, 68, 0.2)`,
              borderRadius: '5px',
              background: 'rgba(0, 0, 0, 0.3)',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.15s ease',
              boxShadow: '0 0 10px rgba(255, 23, 68, 0.1)',
            }}
          >
            🎲
          </button>
        </div>
      </div>

      {/* ═══ MÓDULO 4: SPATIAL BEHAVIOR ═══ */}
      {onSpatialBehaviorChange && (
        <div style={{
          ...moduleBase,
          borderTop: `2px solid ${NEON.spatial}`,
          boxShadow: `0 0 24px rgba(0, 230, 118, 0.15), inset 0 1px 0 rgba(0, 230, 118, 0.1), 0 0 1px ${NEON.spatial}`,
        }}>
          <div style={{ ...moduleTitle, color: NEON.spatial }}>
            <span style={{ color: NEON.spatial, textShadow: `0 0 10px ${NEON.spatial}` }}>▣</span>
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>SPATIAL BEHAVIOR</span>
            <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.2)', fontSize: '8px', textShadow: 'none' }}>ADN</span>
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
                    ? { background: `rgba(0, 230, 118, 0.1)`, border: `1px solid ${NEON.spatial}`, color: NEON.spatial, boxShadow: `0 0 12px rgba(0, 230, 118, 0.25), inset 0 0 8px rgba(0, 230, 118, 0.08)` }
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

      {/* ═══ MÓDULO 5: PHASE CANVAS ═══ */}
      {onUpdatePhaseOverride && onSelectFixture && durationMs && (
        <div style={{
          ...moduleBase,
          borderTop: `2px solid ${NEON.canvas}`,
          boxShadow: `0 0 24px rgba(179, 136, 255, 0.15), inset 0 1px 0 rgba(179, 136, 255, 0.1), 0 0 1px ${NEON.canvas}`,
        }}>
          <div style={{ ...moduleTitle, color: NEON.canvas }}>
            <span style={{ color: NEON.canvas, textShadow: `0 0 10px ${NEON.canvas}` }}>▣</span>
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>PHASE CANVAS</span>
            <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.2)', fontSize: '8px', textShadow: 'none' }}>Individual</span>
          </div>

          <PhaseCanvas
            fixtureIds={fixtureIds ?? []}
            config={active}
            overrides={phaseOverrides}
            durationMs={durationMs}
            selectedFixtureId={selectedFixtureId ?? null}
            disabled={disabled}
            onSelectFixture={onSelectFixture}
            onUpdateOverride={onUpdatePhaseOverride}
            onBake={onBakePhaseOverrides ?? (() => {})}
            onUnbake={onClearPhaseOverrides ?? (() => {})}
          />
        </div>
      )}
    </div>
  )
}

export default PhaseControls
