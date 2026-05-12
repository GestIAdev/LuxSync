/**
 * 🎲 CHAOS ORDER SLIDER — ORDER ↔ CHAOS deterministic control (WAVE 4561)
 *
 * Slider horizontal que controla la dispersión del grupo de fixtures.
 * ORDER = fan simétrico puro. CHAOS = hash FNV-1a por fixture UUID.
 * PROHIBIDO Math.random().
 */

import React, { useCallback } from 'react'

interface ChaosOrderSliderProps {
  /** WAVE 4712: null = estado mixto en la selección → slider neutral, sin lectura */
  value: number | null   // 0-1 (0 = ORDER, 1 = CHAOS) ó null si mixed
  onChange: (v: number) => void
  seed: number       // 16-bit entero
  onReseed: () => void
  disabled?: boolean
}

export const ChaosOrderSlider: React.FC<ChaosOrderSliderProps> = ({
  value,
  onChange,
  seed,
  onReseed,
  disabled = false,
}) => {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseFloat(e.target.value))
  }, [onChange])

  const seedHex = (seed & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')
  // WAVE 4712: en mixed el thumb del input se ubica al centro como neutral.
  const isMixed = value === null
  const displayValue = value ?? 0.5

  return (
    <div className={`chaos-slider ${disabled ? 'chaos-slider--disabled' : ''}${isMixed ? ' chaos-slider--mixed' : ''}`}>
      <div className="chaos-slider__header">
        <span className="chaos-slider__pole chaos-slider__pole--order">ORDER</span>
        <span className="chaos-slider__pole chaos-slider__pole--chaos">
          {isMixed ? '——' : 'CHAOS'}
        </span>
      </div>

      <div className="chaos-slider__track-wrapper">
        <input
          type="range"
          className="chaos-slider__input"
          min={0}
          max={1}
          step={0.01}
          value={displayValue}
          onChange={handleChange}
          disabled={disabled}
          aria-label="Order/Chaos amount"
        />
      </div>

      <div className="chaos-slider__footer">
        <button
          className="chaos-slider__reseed-btn"
          onClick={onReseed}
          disabled={disabled}
          title="Generar nueva semilla determinista"
        >
          🔄 RESEED
        </button>
        <span className="chaos-slider__seed-display">Seed: {seedHex}</span>
      </div>
    </div>
  )
}
