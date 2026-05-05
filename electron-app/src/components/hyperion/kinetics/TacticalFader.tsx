/**
 * 🎚️ TACTICAL FADER — Vertical precision fader (WAVE 4561)
 *
 * Faders verticales masivos para Speed (naranja) y Amplitude (magenta).
 * Drag + scroll wheel. RAF throttled para no saturar el bridge.
 * Valor 0-100% real — la Aduana de Aether clampea en hardware.
 */

import React, { useRef, useCallback, useEffect, useState } from 'react'

interface TacticalFaderProps {
  label: string
  value: number            // 0-100
  onChange: (v: number) => void
  color?: string           // CSS color
  unit?: string            // e.g. '%'
  disabled?: boolean
  showInput?: boolean
}

export const TacticalFader: React.FC<TacticalFaderProps> = ({
  label,
  value,
  onChange,
  color = '#FF8C00',
  unit = '%',
  disabled = false,
  showInput = true,
}) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const rafId = useRef<number>(0)
  const pendingValue = useRef(value)
  const [editMode, setEditMode] = useState(false)
  const [inputText, setInputText] = useState(String(Math.round(value)))

  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)))

  const commitValue = useCallback((v: number) => {
    const clamped = clamp(v)
    pendingValue.current = clamped
    cancelAnimationFrame(rafId.current)
    rafId.current = requestAnimationFrame(() => onChange(clamped))
  }, [onChange])

  const posToValue = useCallback((clientY: number): number => {
    const el = trackRef.current
    if (!el) return value
    const rect = el.getBoundingClientRect()
    const rel = 1 - (clientY - rect.top) / rect.height
    return clamp(rel * 100)
  }, [value])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return
    isDragging.current = true
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    commitValue(posToValue(e.clientY))
  }, [disabled, commitValue, posToValue])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return
    commitValue(posToValue(e.clientY))
  }, [commitValue, posToValue])

  const onPointerUp = useCallback(() => {
    isDragging.current = false
  }, [])

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (disabled) return
    e.preventDefault()
    const step = e.shiftKey ? 5 : 1
    commitValue(value + (e.deltaY < 0 ? step : -step))
  }, [disabled, value, commitValue])

  const handleInputCommit = useCallback(() => {
    const n = parseInt(inputText, 10)
    if (!isNaN(n)) commitValue(n)
    setEditMode(false)
  }, [inputText, commitValue])

  useEffect(() => {
    if (!editMode) setInputText(String(Math.round(value)))
  }, [value, editMode])

  // Cleanup RAF on unmount
  useEffect(() => () => cancelAnimationFrame(rafId.current), [])

  const fillPct = Math.max(0, Math.min(100, value))

  return (
    <div className={`tactical-fader ${disabled ? 'tactical-fader--disabled' : ''}`} style={{ '--fader-color': color } as React.CSSProperties}>
      <div className="tactical-fader__label">{label}</div>

      <div
        ref={trackRef}
        className="tactical-fader__track"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <div
          className="tactical-fader__fill"
          style={{ height: `${fillPct}%` }}
        />
        <div
          className="tactical-fader__thumb"
          style={{ bottom: `${fillPct}%` }}
        />
      </div>

      {showInput && (
        <div className="tactical-fader__readout">
          {editMode ? (
            <input
              className="tactical-fader__input"
              type="number"
              min={0}
              max={100}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onBlur={handleInputCommit}
              onKeyDown={(e) => { if (e.key === 'Enter') handleInputCommit() }}
              autoFocus
            />
          ) : (
            <span
              className="tactical-fader__value"
              onClick={() => !disabled && setEditMode(true)}
              title="Click para editar"
            >
              {Math.round(value)}{unit}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
