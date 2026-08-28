import React, { useState, useEffect, useRef, useCallback } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// NumberField — Input numérico controlado con soporte para negativos
// PROYECTO EREBUS
//
// El problema: un <input type="number" value={number} onChange={parseFloat || 0}>
// no permite escribir "-" porque parseFloat("-") = NaN → 0 → el input se
// resetea inmediatamente. Lo mismo pasa con ".", "-3.", etc.
//
// La solución: mantener un estado local string que permite estados transitorios
// ("-", ".", "-3.") y solo commitear al store cuando el valor es un número
// válido. El commit ocurre en onChange (si es válido) y en onBlur (siempre).
// ═══════════════════════════════════════════════════════════════════════════

interface NumberFieldProps {
  /** Valor numérico controlado desde el store */
  value: number
  /** Callback cuando el usuario commitea un valor válido */
  onCommit: (value: number) => void
  /** Step del input (default 0.25) */
  step?: number
  /** Clase CSS */
  className?: string
  /** Label del eje (opcional, para accesibilidad) */
  'aria-label'?: string
}

export const NumberField: React.FC<NumberFieldProps> = ({
  value,
  onCommit,
  step = 0.25,
  className,
  'aria-label': ariaLabel,
}) => {
  // Estado local string — permite transitorios como "-", ".", "-3."
  const [localStr, setLocalStr] = useState<string>(String(value))
  // Flag para saber si el usuario está editando activamente
  const isEditingRef = useRef(false)

  // Sync desde la prop cuando el valor externo cambia y no estamos editando
  useEffect(() => {
    if (!isEditingRef.current) {
      setLocalStr(String(value))
    }
  }, [value])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      isEditingRef.current = true
      setLocalStr(raw)

      // Solo commitear si el string parsea a un número válido
      const parsed = parseFloat(raw)
      if (Number.isFinite(parsed)) {
        onCommit(parsed)
      }
    },
    [onCommit],
  )

  const handleBlur = useCallback(() => {
    isEditingRef.current = false
    const parsed = parseFloat(localStr)
    if (Number.isFinite(parsed)) {
      onCommit(parsed)
    } else {
      // Revertir al valor del store si el string no es válido
      setLocalStr(String(value))
    }
  }, [localStr, value, onCommit])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.currentTarget.blur()
      }
      if (e.key === 'Escape') {
        isEditingRef.current = false
        setLocalStr(String(value))
        e.currentTarget.blur()
      }
    },
    [value],
  )

  return (
    <input
      className={className}
      type="number"
      step={step}
      value={localStr}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      aria-label={ariaLabel}
    />
  )
}

export default NumberField
