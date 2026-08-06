/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎚️ TwinGeneSlider.tsx — Dual-slider for min/max ranges
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Slider de rango con dos thumbs (min/max). Guardia: `min ≤ max` siempre.
 * Usado para morphFloor/morphCeiling, zoomRange, focusRange, etc.
 *
 * @module components/vibeLab/kit/TwinGeneSlider
 * @version FASE 2 — The Instrument Kit
 */

import React, { memo, useCallback, useMemo, useRef } from 'react'
import { RotateCcw, Lock } from 'lucide-react'
import type { TwinGeneSliderProps, GeneVisualState } from './types'
import './kit-variables.css'
import './twin-gene-slider.css'

function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0
  return Math.max(0, Math.min(1, (value - min) / (max - min)))
}

function formatValue(value: number, step: number): string {
  const decimals = step < 1 ? Math.min(2, Math.ceil(-Math.log10(step))) : 0
  return value.toFixed(decimals)
}

export const TwinGeneSlider: React.FC<TwinGeneSliderProps> = memo((props) => {
  const {
    label,
    value,
    baseValue,
    min,
    max,
    step,
    unit,
    isMutated,
    isSealed,
    onChange,
    onRevert,
  } = props

  const state: GeneVisualState = isSealed
    ? 'sealed'
    : isMutated
      ? 'mutated'
      : 'inherited'

  const isDisabled = state === 'sealed'

  const minPct = useMemo(() => normalize(value[0], min, max) * 100, [value, min, max])
  const maxPct = useMemo(() => normalize(value[1], min, max) * 100, [value, min, max])
  const baseMinPct = useMemo(() => normalize(baseValue[0], min, max) * 100, [baseValue, min, max])
  const baseMaxPct = useMemo(() => normalize(baseValue[1], min, max) * 100, [baseValue, min, max])

  const draggingRef = useRef<'min' | 'max' | null>(null)

  const handleMinChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isDisabled) return
      const newMin = parseFloat(e.target.value)
      // Guardia: min ≤ max (con step de margen)
      onChange([Math.min(newMin, value[1] - step), value[1]])
    },
    [onChange, value, step, isDisabled],
  )

  const handleMaxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isDisabled) return
      const newMax = parseFloat(e.target.value)
      onChange([value[0], Math.max(newMax, value[0] + step)])
    },
    [onChange, value, step, isDisabled],
  )

  const handleRevert = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onRevert()
    },
    [onRevert],
  )

  return (
    <div className={`twin-gene-slider ${state}`} data-state={state}>
      <div className="twin-gene-slider-header">
        <span className="twin-gene-slider-label">{label}</span>
        <div className="twin-gene-slider-actions">
          {isMutated && !isDisabled && (
            <button
              className="twin-gene-slider-revert"
              onClick={handleRevert}
              title={`Revertir a [${baseValue[0]}, ${baseValue[1]}]`}
              type="button"
            >
              <RotateCcw size={11} />
            </button>
          )}
          {isSealed && (
            <span className="twin-gene-slider-sealed-icon" title="Parámetro sellado">
              <Lock size={11} />
            </span>
          )}
        </div>
      </div>

      <div className="twin-gene-slider-track-wrapper">
        <div className="twin-gene-slider-track" />

        {/* Fill entre min y max */}
        <div
          className="twin-gene-slider-fill"
          style={{ left: `${minPct}%`, width: `${maxPct - minPct}%` }}
        />

        {/* Fantasmas de los valores base */}
        {!isSealed && (
          <>
            <div
              className="twin-gene-slider-ghost"
              style={{ left: `${baseMinPct}%` }}
              title={`Base min: ${baseValue[0]}`}
            />
            <div
              className="twin-gene-slider-ghost"
              style={{ left: `${baseMaxPct}%` }}
              title={`Base max: ${baseValue[1]}`}
            />
          </>
        )}

        {/* Thumbs visuales */}
        <div className="twin-gene-slider-thumb thumb-min" style={{ left: `${minPct}%` }} />
        <div className="twin-gene-slider-thumb thumb-max" style={{ left: `${maxPct}%` }} />

        {/* Inputs nativos superpuestos */}
        <input
          type="range"
          className="twin-gene-slider-input input-min"
          min={min}
          max={max}
          step={step}
          value={value[0]}
          disabled={isDisabled}
          onChange={handleMinChange}
          aria-label={`${label} min`}
        />
        <input
          type="range"
          className="twin-gene-slider-input input-max"
          min={min}
          max={max}
          step={step}
          value={value[1]}
          disabled={isDisabled}
          onChange={handleMaxChange}
          aria-label={`${label} max`}
        />
      </div>

      <div className="twin-gene-slider-footer">
        <span className="twin-gene-slider-min">{formatValue(min, step)}</span>
        <span className="twin-gene-slider-values">
          [{formatValue(value[0], step)}, {formatValue(value[1], step)}]
          {unit ? ` ${unit}` : ''}
        </span>
        <span className="twin-gene-slider-max">{formatValue(max, step)}</span>
      </div>
    </div>
  )
})

TwinGeneSlider.displayName = 'TwinGeneSlider'
