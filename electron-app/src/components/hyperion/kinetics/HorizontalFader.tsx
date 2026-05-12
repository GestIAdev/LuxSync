/**
 * 🎚️ HORIZONTAL FADER — WAVE 4568: ZERO-SCROLL LAYOUT
 *
 * Fader horizontal de 44px de altura para reemplazar los TacticalFaders
 * verticales (280px) en KineticsCathedral. Ahorra 232px → layout sin scroll.
 *
 * • Drag horizontal: pointer capture, RAF throttle ~33fps
 * • Wheel: { passive: false } via useNonPassiveWheel — sin warning de Chrome
 * • Click en readout: edición numérica directa
 *
 * Props idénticas a TacticalFader para reemplazabilidad 1:1.
 *
 * @module components/hyperion/kinetics/HorizontalFader
 * @version WAVE 4568
 */

import React, { useRef, useCallback, useEffect, useState } from 'react'
import { useNonPassiveWheel } from '../../../hooks/useNonPassiveWheel'
import './HorizontalFader.css'

interface HorizontalFaderProps {
  label: string
  /** WAVE 4712: null = estado mixto (selección con valores divergentes) → muestra '--' */
  value: number | null     // 0-100 ó null
  onChange: (v: number) => void
  color?: string
  unit?: string
  disabled?: boolean
}

export const HorizontalFader: React.FC<HorizontalFaderProps> = ({
  label,
  value,
  onChange,
  color = '#FF8C00',
  unit = '%',
  disabled = false,
}) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const rafId = useRef<number>(0)
  const [editMode, setEditMode] = useState(false)
  // WAVE 4712: el numeric value para edición se inicializa en 50 si está mixed.
  const isMixed = value === null
  const numericValue = value ?? 50
  const [inputText, setInputText] = useState(String(Math.round(numericValue)))

  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)))

  const commitValue = useCallback((v: number) => {
    const clamped = clamp(v)
    cancelAnimationFrame(rafId.current)
    rafId.current = requestAnimationFrame(() => onChange(clamped))
  }, [onChange])

  const posToValue = useCallback((clientX: number): number => {
    const el = trackRef.current
    if (!el) return numericValue
    const rect = el.getBoundingClientRect()
    const rel = (clientX - rect.left) / rect.width
    return clamp(rel * 100)
  }, [numericValue])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return
    isDragging.current = true
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    commitValue(posToValue(e.clientX))
  }, [disabled, commitValue, posToValue])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return
    commitValue(posToValue(e.clientX))
  }, [commitValue, posToValue])

  const onPointerUp = useCallback(() => {
    isDragging.current = false
  }, [])

  // Non-passive wheel — sin warning de Chrome
  const handleWheel = useCallback((e: WheelEvent) => {
    if (disabled) return
    e.preventDefault()
    const step = e.shiftKey ? 5 : 1
    commitValue(numericValue + (e.deltaY < 0 ? step : -step))
  }, [disabled, numericValue, commitValue])

  useNonPassiveWheel(trackRef, handleWheel)

  const handleInputCommit = useCallback(() => {
    const n = parseInt(inputText, 10)
    if (!isNaN(n)) commitValue(n)
    setEditMode(false)
  }, [inputText, commitValue])

  useEffect(() => {
    if (!editMode) setInputText(String(Math.round(numericValue)))
  }, [numericValue, editMode])

  useEffect(() => () => cancelAnimationFrame(rafId.current), [])

  // WAVE 4712: en estado mixto el track aparece sin fill (thumb oculto, '--' como readout).
  const fillPct = isMixed ? 0 : Math.max(0, Math.min(100, numericValue))

  return (
    <div
      className={`h-fader${disabled ? ' h-fader--disabled' : ''}${isMixed ? ' h-fader--mixed' : ''}`}
      style={{ '--fader-color': color } as React.CSSProperties}
    >
      <span className="h-fader__label">{label}</span>

      <div
        ref={trackRef}
        className="h-fader__track"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="h-fader__fill" style={{ width: `${fillPct}%` }} />
        {!isMixed && (
          <div className="h-fader__thumb" style={{ left: `${fillPct}%` }} />
        )}
      </div>

      <div className="h-fader__readout">
        {editMode ? (
          <input
            className="h-fader__input"
            type="number"
            min={0} max={100}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onBlur={handleInputCommit}
            onKeyDown={e => { if (e.key === 'Enter') handleInputCommit() }}
            autoFocus
          />
        ) : (
          <span
            className="h-fader__value"
            onClick={() => !disabled && setEditMode(true)}
            title={isMixed ? 'Valores divergentes en la selección' : 'Click para editar'}
          >
            {isMixed ? '——' : `${Math.round(numericValue)}${unit}`}
          </span>
        )}
      </div>
    </div>
  )
}
