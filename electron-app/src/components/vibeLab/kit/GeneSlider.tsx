/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎚️ GeneSlider.tsx — THE STAR COMPONENT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El componente estrella del Vibe Lab. Un slider que sabe que es un gen
 * mutable: muestra el fantasma del valor base, glow del accent cuando está
 * mutado, banda roja de zona de peligro, botón ⟲ para revertir, y candado
 * cuando está sellado.
 *
 * 5 estados visuales: inherited, mutated, danger, sealed, locked-by-basic.
 *
 * @module components/vibeLab/kit/GeneSlider
 * @version FASE 2 — The Instrument Kit
 */

import React, { memo, useCallback, useMemo } from 'react'
import { RotateCcw, Lock } from 'lucide-react'
import type { GeneSliderProps, GeneVisualState } from './types'
import './kit-variables.css'
import './gene-slider.css'

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Normaliza un valor a 0..1 dentro de [min, max]. */
function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0
  return Math.max(0, Math.min(1, (value - min) / (max - min)))
}

/** Formatea un número para mostrar (hasta 2 decimals, sin trailing zeros). */
function formatValue(value: number, step: number): string {
  const decimals = step < 1 ? Math.min(2, Math.ceil(-Math.log10(step))) : 0
  return value.toFixed(decimals)
}

/** Determina el estado visual a partir de las props. */
function deriveState(props: GeneSliderProps): GeneVisualState {
  if (props.isSealed) return 'sealed'
  if (props.tier === 'raw') return 'locked-by-basic' // El padre decide mostrar/ocultar
  if (props.isInDanger) return 'danger'
  if (props.isMutated) return 'mutated'
  return 'inherited'
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const GeneSlider: React.FC<GeneSliderProps> = memo((props) => {
  const {
    label,
    value,
    baseValue,
    min,
    max,
    step,
    unit,
    danger,
    isMutated,
    isSealed,
    isInDanger,
    onChange,
    onRevert,
  } = props

  const state = deriveState(props)
  const isDisabled = state === 'sealed' || state === 'locked-by-basic'

  const pct = useMemo(() => normalize(value, min, max), [value, min, max])
  const basePct = useMemo(
    () => normalize(typeof baseValue === 'number' ? baseValue : value, min, max),
    [baseValue, value, min, max],
  )

  const dangerStartPct = danger ? normalize(danger[0], min, max) * 100 : 0
  const dangerEndPct = danger ? normalize(danger[1], min, max) * 100 : 0

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isDisabled) return
      onChange(parseFloat(e.target.value))
    },
    [onChange, isDisabled],
  )

  const handleRevert = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onRevert()
    },
    [onRevert],
  )

  const displayValue = useMemo(() => formatValue(value, step), [value, step])

  return (
    <div
      className={`gene-slider ${state}`}
      data-state={state}
      data-mutated={isMutated}
    >
      {/* ── Header: label + revert ──────────────────────────────────── */}
      <div className="gene-slider-header">
        <span className="gene-slider-label">{label}</span>
        <div className="gene-slider-actions">
          {isMutated && !isDisabled && (
            <button
              className="gene-slider-revert"
              onClick={handleRevert}
              title={`Revertir al valor base (${baseValue})`}
              type="button"
            >
              <RotateCcw size={11} />
            </button>
          )}
          {isSealed && (
            <span className="gene-slider-sealed-icon" title="Parámetro sellado — seguridad de hardware">
              <Lock size={11} />
            </span>
          )}
        </div>
      </div>

      {/* ── Track + ghost ───────────────────────────────────────────── */}
      <div className="gene-slider-track-wrapper">
        {/* Banda de peligro */}
        {danger && !isDisabled && (
          <div
            className="gene-slider-danger-zone"
            style={{ left: `${dangerStartPct}%`, width: `${dangerEndPct - dangerStartPct}%` }}
          />
        )}

        {/* Track de fondo */}
        <div className="gene-slider-track" />

        {/* Fill hasta el valor actual */}
        <div className="gene-slider-fill" style={{ width: `${pct * 100}%` }} />

        {/* Fantasma del valor base */}
        {!isSealed && (
          <div
            className="gene-slider-ghost"
            style={{ left: `${basePct * 100}%` }}
            title={`Valor base: ${baseValue}`}
          />
        )}

        {/* Input nativo (overlay transparente para accesibilidad + drag) */}
        <input
          type="range"
          className="gene-slider-input"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={isDisabled}
          onChange={handleChange}
          aria-label={label}
        />
      </div>

      {/* ── Footer: min/max + valor ─────────────────────────────────── */}
      <div className="gene-slider-footer">
        <span className="gene-slider-min">{formatValue(min, step)}</span>
        <span className="gene-slider-value">
          {displayValue}
          {unit ? ` ${unit}` : ''}
        </span>
        <span className="gene-slider-max">{formatValue(max, step)}</span>
      </div>
    </div>
  )
})

GeneSlider.displayName = 'GeneSlider'
