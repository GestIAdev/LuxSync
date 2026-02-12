/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ PARAMETER LANE - WAVE 2030.8
 * Sidebar lane showing parameter name, mode, and mini preview
 * 
 * Each lane represents one HephCurve (intensity, speed, strobe, etc.)
 * Click to select as active curve in the CurveEditor canvas.
 * 
 * WAVE 2030.8: Added delete button for removing parameters
 * 
 * @module views/HephaestusView/ParameterLane
 * @version WAVE 2030.8
 */

import React, { useMemo } from 'react'
import type { HephCurve, HephParamId } from '../../../core/hephaestus/types'

// ═══════════════════════════════════════════════════════════════════════════
// PARAM METADATA — Exported for use in other components
// WAVE 2030.9: Added categories for proper grouping
// ═══════════════════════════════════════════════════════════════════════════

export type ParamCategory = 'physical' | 'color' | 'movement' | 'control'

export const PARAM_META: Record<HephParamId, { 
  label: string
  color: string
  icon: string
  category: ParamCategory 
}> = {
  // PHYSICAL - Intensity/brightness controls
  intensity:  { label: 'INTENSITY',  color: '#fbbf24', icon: '☀', category: 'physical' },
  strobe:     { label: 'STROBE',     color: '#ef4444', icon: '⚡', category: 'physical' },
  white:      { label: 'WHITE',      color: '#e2e8f0', icon: '◎', category: 'physical' },
  amber:      { label: 'AMBER',      color: '#f97316', icon: '◉', category: 'physical' },
  
  // COLOR - Chromatic controls
  color:      { label: 'COLOR',      color: '#a855f7', icon: '🎨', category: 'color' },
  
  // MOVEMENT - Pan/Tilt/Zoom only
  pan:        { label: 'PAN',        color: '#3b82f6', icon: '↔', category: 'movement' },
  tilt:       { label: 'TILT',       color: '#6366f1', icon: '↕', category: 'movement' },
  zoom:       { label: 'ZOOM',       color: '#14b8a6', icon: '⊕', category: 'movement' },
  
  // CONTROL - Speed, width, direction, global
  speed:      { label: 'SPEED',      color: '#22d3ee', icon: '⏱', category: 'control' },
  width:      { label: 'WIDTH',      color: '#06b6d4', icon: '⟷', category: 'control' },
  direction:  { label: 'DIRECTION',  color: '#10b981', icon: '→', category: 'control' },
  globalComp: { label: 'GLOBAL',     color: '#8b5cf6', icon: '◈', category: 'control' },
}

/** Category display info */
export const PARAM_CATEGORIES: Record<ParamCategory, { label: string; icon: string }> = {
  physical: { label: 'PHYSICAL', icon: '💡' },
  color:    { label: 'COLOR',    icon: '🎨' },
  movement: { label: 'MOVEMENT', icon: '🔄' },
  control:  { label: 'CONTROL',  icon: '🎛' },
}

/** All available parameter IDs for the add param dropdown - ordered by category */
export const ALL_PARAM_IDS: HephParamId[] = [
  // Physical
  'intensity', 'strobe', 'white', 'amber',
  // Color
  'color',
  // Movement
  'pan', 'tilt', 'zoom',
  // Control
  'speed', 'width', 'direction', 'globalComp'
]

// ═══════════════════════════════════════════════════════════════════════════
// MINI CURVE PREVIEW — Tiny SVG sparkline
// ═══════════════════════════════════════════════════════════════════════════

const MiniCurvePreview: React.FC<{ curve: HephCurve; color: string }> = ({ curve, color }) => {
  const pathD = useMemo(() => {
    const kfs = curve.keyframes
    if (kfs.length === 0) return ''
    const w = 120
    const h = 24
    const maxT = kfs[kfs.length - 1].timeMs || 1
    const [min, max] = curve.range
    const rangeSpan = max - min || 1

    const toX = (t: number) => (t / maxT) * w
    const toY = (v: number) => h - ((v as number - min) / rangeSpan) * h

    let d = `M ${toX(kfs[0].timeMs)} ${toY(kfs[0].value as number)}`
    for (let i = 1; i < kfs.length; i++) {
      const x = toX(kfs[i].timeMs)
      const y = toY(kfs[i].value as number)
      d += ` L ${x} ${y}`
    }
    return d
  }, [curve])

  return (
    <svg width="120" height="24" viewBox="0 0 120 24" className="param-lane__mini-curve">
      <path d={pathD} stroke={color} strokeWidth="1.5" fill="none" opacity="0.7" />
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface ParameterLaneProps {
  paramId: HephParamId
  curve: HephCurve
  isActive: boolean
  onClick: () => void
  onRemove?: (paramId: HephParamId) => void  // WAVE 2030.8: Delete handler
}

export const ParameterLane: React.FC<ParameterLaneProps> = ({
  paramId,
  curve,
  isActive,
  onClick,
  onRemove,
}) => {
  const meta = PARAM_META[paramId] ?? { label: paramId.toUpperCase(), color: '#888', icon: '●' }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()  // Don't trigger onClick
    if (onRemove) {
      onRemove(paramId)
    }
  }

  return (
    <button
      className={`param-lane ${isActive ? 'param-lane--active' : ''}`}
      onClick={onClick}
      style={{ '--lane-color': meta.color } as React.CSSProperties}
    >
      <span className="param-lane__icon">{meta.icon}</span>
      <div className="param-lane__info">
        <span className="param-lane__label">{meta.label}</span>
        <span className="param-lane__mode">{curve.mode.toUpperCase()}</span>
      </div>
      <MiniCurvePreview curve={curve} color={meta.color} />
      {isActive && <span className="param-lane__indicator" />}
      
      {/* WAVE 2030.8: Delete button */}
      {onRemove && (
        <span 
          className="param-lane__delete"
          onClick={handleRemove}
          title={`Remove ${meta.label} parameter`}
        >
          ×
        </span>
      )}
    </button>
  )
}
