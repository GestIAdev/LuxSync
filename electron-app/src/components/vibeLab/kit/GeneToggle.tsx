/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔘 GeneToggle.tsx — Boolean gene toggle
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Toggle booleano mutable. Muestra el valor base como fantasma (ghost mark)
 * y el botón ⟲ cuando está mutado.
 *
 * @module components/vibeLab/kit/GeneToggle
 * @version FASE 2 — The Instrument Kit
 */

import React, { memo, useCallback } from 'react'
import { RotateCcw, Lock } from 'lucide-react'
import type { GeneToggleProps } from './types'
import './kit-variables.css'
import './gene-toggle.css'

export const GeneToggle: React.FC<GeneToggleProps> = memo((props) => {
  const { label, value, baseValue, isMutated, isSealed, onChange, onRevert } = props

  const isDisabled = isSealed
  const state = isSealed ? 'sealed' : isMutated ? 'mutated' : 'inherited'

  const handleToggle = useCallback(() => {
    if (isDisabled) return
    onChange(!value)
  }, [onChange, value, isDisabled])

  const handleRevert = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onRevert()
    },
    [onRevert],
  )

  return (
    <div className={`gene-toggle ${state}`} data-state={state}>
      <div className="gene-toggle-label-row">
        <span className="gene-toggle-label">{label}</span>
        <div className="gene-toggle-actions">
          {isMutated && !isDisabled && (
            <button
              className="gene-toggle-revert"
              onClick={handleRevert}
              title={`Revertir a ${baseValue}`}
              type="button"
            >
              <RotateCcw size={11} />
            </button>
          )}
          {isSealed && (
            <span className="gene-toggle-sealed-icon" title="Parámetro sellado">
              <Lock size={11} />
            </span>
          )}
        </div>
      </div>
      <button
        className={`gene-toggle-switch ${value ? 'on' : 'off'}`}
        onClick={handleToggle}
        disabled={isDisabled}
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
      >
        {/* Ghost mark del valor base */}
        {!isSealed && value !== baseValue && (
          <span
            className="gene-toggle-ghost"
            data-base={baseValue}
            title={`Valor base: ${baseValue}`}
          />
        )}
        <span className="gene-toggle-knob" />
      </button>
    </div>
  )
})

GeneToggle.displayName = 'GeneToggle'
