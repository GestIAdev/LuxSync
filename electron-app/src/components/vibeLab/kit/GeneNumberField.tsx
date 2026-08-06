/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔢 GeneNumberField.tsx — Precise numeric input
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Entrada numérica precisa con clamp al blur. Muestra el valor base como
 * placeholder fantasma cuando está vacío o heredado.
 *
 * @module components/vibeLab/kit/GeneNumberField
 * @version FASE 2 — The Instrument Kit
 */

import React, { memo, useCallback, useState, useRef, useEffect } from 'react'
import { RotateCcw, Lock } from 'lucide-react'
import type { GeneNumberFieldProps } from './types'
import './kit-variables.css'
import './gene-number-field.css'

function clampValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function formatValue(value: number, precision?: number): string {
  if (precision !== undefined) return value.toFixed(precision)
  return String(value)
}

export const GeneNumberField: React.FC<GeneNumberFieldProps> = memo((props) => {
  const {
    label,
    value,
    baseValue,
    min,
    max,
    step,
    unit,
    precision,
    isMutated,
    isSealed,
    onChange,
    onRevert,
  } = props

  const isDisabled = isSealed
  const state = isSealed ? 'sealed' : isMutated ? 'mutated' : 'inherited'

  const [editValue, setEditValue] = useState(formatValue(value, precision))
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync external value when not focused
  useEffect(() => {
    if (!isFocused) {
      setEditValue(formatValue(value, precision))
    }
  }, [value, precision, isFocused])

  const handleFocus = useCallback(() => {
    setIsFocused(true)
    inputRef.current?.select()
  }, [])

  const handleBlur = useCallback(() => {
    setIsFocused(false)
    const parsed = parseFloat(editValue)
    if (Number.isFinite(parsed)) {
      const clamped = clampValue(parsed, min, max)
      onChange(clamped)
      setEditValue(formatValue(clamped, precision))
    } else {
      // Revert to current value if invalid
      setEditValue(formatValue(value, precision))
    }
  }, [editValue, min, max, onChange, precision, value])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        inputRef.current?.blur()
      } else if (e.key === 'Escape') {
        setEditValue(formatValue(value, precision))
        inputRef.current?.blur()
      }
    },
    [value, precision],
  )

  const handleRevert = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onRevert()
    },
    [onRevert],
  )

  return (
    <div className={`gene-number-field ${state}`} data-state={state}>
      <span className="gene-number-field-label">{label}</span>
      <div className="gene-number-field-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="gene-number-field-input"
          value={editValue}
          placeholder={formatValue(baseValue, precision)}
          disabled={isDisabled}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onChange={(e) => setEditValue(e.target.value)}
          aria-label={label}
        />
        {unit && <span className="gene-number-field-unit">{unit}</span>}
        <div className="gene-number-field-actions">
          {isMutated && !isDisabled && (
            <button
              className="gene-number-field-revert"
              onClick={handleRevert}
              title={`Revertir a ${baseValue}`}
              type="button"
            >
              <RotateCcw size={11} />
            </button>
          )}
          {isSealed && (
            <span className="gene-number-field-sealed-icon" title="Parámetro sellado">
              <Lock size={11} />
            </span>
          )}
        </div>
      </div>
    </div>
  )
})

GeneNumberField.displayName = 'GeneNumberField'
