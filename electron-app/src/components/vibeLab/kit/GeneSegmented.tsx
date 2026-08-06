/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔘 GeneSegmented.tsx — Enum as segmented buttons
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Selector de enum como botones segmentados (patrón visual de SystemsCheck).
 * El valor base se marca con un punto fantasma debajo.
 *
 * @module components/vibeLab/kit/GeneSegmented
 * @version FASE 2 — The Instrument Kit
 */

import React, { memo, useCallback } from 'react'
import { RotateCcw, Lock } from 'lucide-react'
import type { GeneSegmentedProps } from './types'
import './kit-variables.css'
import './gene-segmented.css'

function GeneSegmentedInner<T extends string = string>(props: GeneSegmentedProps<T>) {
  const { label, value, baseValue, options, isMutated, isSealed, onChange, onRevert } = props

  const isDisabled = isSealed
  const state = isSealed ? 'sealed' : isMutated ? 'mutated' : 'inherited'

  const handleSelect = useCallback(
    (v: T) => {
      if (isDisabled) return
      onChange(v)
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

  return (
    <div className={`gene-segmented ${state}`} data-state={state}>
      <div className="gene-segmented-header">
        <span className="gene-segmented-label">{label}</span>
        <div className="gene-segmented-actions">
          {isMutated && !isDisabled && (
            <button
              className="gene-segmented-revert"
              onClick={handleRevert}
              title={`Revertir a ${baseValue}`}
              type="button"
            >
              <RotateCcw size={11} />
            </button>
          )}
          {isSealed && (
            <span className="gene-segmented-sealed-icon" title="Parámetro sellado">
              <Lock size={11} />
            </span>
          )}
        </div>
      </div>
      <div className="gene-segmented-group" role="radiogroup" aria-label={label}>
        {options.map((opt) => {
          const isSelected = opt.value === value
          const isBase = opt.value === baseValue
          return (
            <button
              key={opt.value}
              className={`gene-segmented-btn ${isSelected ? 'selected' : ''} ${isBase && !isSelected ? 'has-base' : ''}`}
              onClick={() => handleSelect(opt.value)}
              disabled={isDisabled}
              type="button"
              role="radio"
              aria-checked={isSelected}
              title={isBase && !isSelected ? `Valor base: ${baseValue}` : undefined}
            >
              {opt.icon && <span className="gene-segmented-icon">{opt.icon}</span>}
              <span className="gene-segmented-btn-label">{opt.label}</span>
              {isBase && !isSelected && <span className="gene-segmented-base-dot" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export const GeneSegmented = memo(GeneSegmentedInner) as typeof GeneSegmentedInner &
  { displayName: string }
GeneSegmented.displayName = 'GeneSegmented'
