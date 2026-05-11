/**
 * ⚡ PATTERN ARSENAL — 4×2 tactile pattern grid (WAVE 4561)
 *
 * Reutiliza los tipos PatternType del movementStore.
 * Botones táctiles grandes, misma semántica que PatternSelector.
 */

import React, { useCallback } from 'react'
import type { PatternType } from '../../../stores/movementStore'

interface PatternConfig {
  id: PatternType
  icon: string
  label: string
  color: string
}

const PATTERNS: PatternConfig[] = [
  { id: 'static',    icon: '🛑', label: 'HOLD',      color: '#888' },
  { id: 'circle',    icon: '○',  label: 'CIRCLE',    color: '#00F0FF' },
  { id: 'eight',     icon: '∞',  label: 'EIGHT',     color: '#FF00E5' },
  { id: 'sweep',     icon: '↔',  label: 'SWEEP',     color: '#FF8C00' },
  { id: 'darkspin',  icon: '🌀', label: 'DARKSPIN',  color: '#FF4040' },
  { id: 'bounce',    icon: '🏓', label: 'BOUNCE',    color: '#7FFF00' },
  { id: 'butterfly', icon: '🦋', label: 'BUTTERFLY', color: '#FF69B4' },
  { id: 'pulse',     icon: '⚡',  label: 'PULSE',     color: '#FFD700' },
]

interface PatternArsenalProps {
  activePattern: PatternType
  onChange: (pattern: PatternType) => void
  disabled?: boolean
}

export const PatternArsenal: React.FC<PatternArsenalProps> = ({
  activePattern,
  onChange,
  disabled = false,
}) => {
  const handleClick = useCallback((id: PatternType) => {
    if (disabled) return
    // Click en patrón activo → deseleccionar
    onChange(id === activePattern ? 'none' : id)
  }, [activePattern, onChange, disabled])

  return (
    <div className={`pattern-arsenal ${disabled ? 'pattern-arsenal--disabled' : ''}`}>
      <div className="pattern-arsenal__label">PATTERN ARSENAL</div>
      <div className="pattern-arsenal__grid">
        {PATTERNS.map((p) => {
          const isActive = activePattern === p.id
          return (
            <button
              key={p.id}
              className={`pattern-arsenal__btn ${isActive ? 'pattern-arsenal__btn--active' : ''}`}
              style={{ '--pattern-color': p.color } as React.CSSProperties}
              onClick={() => handleClick(p.id)}
              disabled={disabled}
              title={p.label}
            >
              <span className="pattern-arsenal__btn-icon">{p.icon}</span>
              <span className="pattern-arsenal__btn-label">{p.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
