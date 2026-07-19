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

import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { HephCurve, HephParamId, ZoneTarget } from '../../../core/hephaestus/types'
import type { EffectZone } from '../../../core/effects/types'
import { SmartZoneSelector, getZoneBadgeText, getZoneBadgeIcon } from './SmartZoneSelector'

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
  strobeRate: { label: 'STROBE RATE', color: '#f87171', icon: '⚡', category: 'physical' },
  white:      { label: 'WHITE',      color: '#e2e8f0', icon: '◎', category: 'physical' },
  amber:      { label: 'AMBER',      color: '#f97316', icon: '◉', category: 'physical' },
  
  // COLOR - Chromatic controls
  color:      { label: 'COLOR',      color: '#a855f7', icon: '🎨', category: 'color' },
  
  // MOVEMENT - Pan/Tilt/Zoom/Focus/Iris/Gobo/Prism
  pan:        { label: 'PAN',        color: '#3b82f6', icon: '↔', category: 'movement' },
  tilt:       { label: 'TILT',       color: '#6366f1', icon: '↕', category: 'movement' },
  zoom:       { label: 'ZOOM',       color: '#14b8a6', icon: '⊕', category: 'movement' },
  focus:      { label: 'FOCUS',      color: '#0ea5e9', icon: '◎', category: 'movement' },
  iris:       { label: 'IRIS',       color: '#8b5cf6', icon: '⦿', category: 'movement' },
  gobo1:      { label: 'GOBO 1',     color: '#d946ef', icon: '⬡', category: 'movement' },
  gobo2:      { label: 'GOBO 2',     color: '#c026d3', icon: '⬢', category: 'movement' },
  prism:      { label: 'PRISM',      color: '#f43f5e', icon: '◇', category: 'movement' },
  
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
  'pan', 'tilt', 'zoom', 'focus', 'iris', 'gobo1', 'gobo2', 'prism',
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
    
    // ⚒️ WAVE 2040.20: Color curves have HSL objects as values, not numbers.
    // For the mini-preview, we use the hue (0-360) normalized to range.
    const extractNumericValue = (val: number | { h: number; s: number; l: number }): number => {
      if (typeof val === 'number') return val
      if (val && typeof val === 'object' && 'h' in val) {
        // Normalize hue (0-360) to curve range (typically 0-1)
        return min + (val.h / 360) * rangeSpan
      }
      return min // Safe fallback — bottom of range
    }
    
    const toY = (v: number | { h: number; s: number; l: number }) => {
      const num = extractNumericValue(v)
      return h - ((num - min) / rangeSpan) * h
    }

    let d = `M ${toX(kfs[0].timeMs)} ${toY(kfs[0].value)}`
    for (let i = 1; i < kfs.length; i++) {
      const x = toX(kfs[i].timeMs)
      const y = toY(kfs[i].value)
      d += ` L ${x} ${y}`
    }
    return d
  }, [curve])

  return (
    <svg width="120" height="24" viewBox="0 0 120 24" className="param-lane__mini-curve" style={{ pointerEvents: 'none', zIndex: 0, position: 'relative' }}>
      <path d={pathD} stroke={color} strokeWidth="1.5" fill="none" opacity="0.7" />
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface ParameterLaneProps {
  trackId: string
  paramId: HephParamId
  curve: HephCurve
  zones: readonly ZoneTarget[]
  isActive: boolean
  onClick: () => void
  onRemove?: (trackId: string) => void
  onDuplicate?: (trackId: string) => void
  onTrackZonesChange?: (trackId: string, zones: ZoneTarget[]) => void
}

export const ParameterLane: React.FC<ParameterLaneProps> = ({
  trackId,
  paramId,
  curve,
  zones,
  isActive,
  onClick,
  onRemove,
  onDuplicate,
  onTrackZonesChange,
}) => {
  const meta = PARAM_META[paramId] ?? { label: paramId.toUpperCase(), color: '#888', icon: '●' }
  const [showZonePopover, setShowZonePopover] = useState(false)
  const zoneBadgeRef = useRef<HTMLButtonElement>(null)
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null)

  // Compute popover position from badge rect when opening
  const openPopover = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (zoneBadgeRef.current) {
      const rect = zoneBadgeRef.current.getBoundingClientRect()
      setPopoverPos({ top: rect.bottom + 4, left: rect.left })
    }
    setShowZonePopover(true)
  }, [])

  // Click-outside to close zone popover
  useEffect(() => {
    if (!showZonePopover) return
    const handleClickOutside = (e: MouseEvent) => {
      if (
        zoneBadgeRef.current && !zoneBadgeRef.current.contains(e.target as Node) &&
        !(e.target as HTMLElement).closest('.param-lane__zone-popover-portal')
      ) {
        setShowZonePopover(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showZonePopover])

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onRemove) {
      onRemove(trackId)
    }
  }

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onDuplicate) {
      onDuplicate(trackId)
    }
  }

  const handleZoneToggle = useCallback((effZones: EffectZone[]) => {
    if (onTrackZonesChange) {
      onTrackZonesChange(trackId, effZones as ZoneTarget[])
    }
  }, [trackId, onTrackZonesChange])

  const zoneBadgeText = getZoneBadgeText(zones as EffectZone[])
  const zoneBadgeIcon = getZoneBadgeIcon(zones as EffectZone[])

  const modeAbbr: Record<string, string> = {
    absolute: 'ABS',
    relative: 'REL',
    additive: 'ADD',
  }
  const modeText = modeAbbr[curve.mode] ?? curve.mode.slice(0, 3).toUpperCase()

  return (
    <div
      className={`param-lane ${isActive ? 'param-lane--active' : ''}`}
      onClick={onClick}
      style={{ '--lane-color': meta.color, position: 'relative' } as React.CSSProperties}
    >
      <span className="param-lane__icon">{meta.icon}</span>
      <div className="param-lane__info" style={{ position: 'relative', zIndex: 10 }}>
        {/* Row 1: param name + mode abbreviation */}
        <div className="param-lane__label-row" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span className="param-lane__label">{meta.label}</span>
          <span className="param-lane__mode-abbr" style={{
            fontSize: '8px',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.25)',
            letterSpacing: '0.08em',
            fontFamily: '"Rajdhani", sans-serif',
            flexShrink: 0,
          }}>
            {modeText}
          </span>
        </div>
      </div>
      <MiniCurvePreview curve={curve} color={meta.color} />

      {/* Zone badge — absolute positioned, spans full lane width */}
      {onTrackZonesChange && (
        <button
          ref={zoneBadgeRef}
          className="param-lane__zone-badge"
          onClick={openPopover}
          title="Click to edit zone targeting for this track"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            background: 'rgba(0,0,0,0.3)',
            border: `1px solid ${isActive ? 'rgba(255,107,43,0.3)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: '3px',
            padding: '1px 5px',
            fontSize: '8px',
            fontWeight: 600,
            color: isActive ? '#ff8c42' : '#777',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            letterSpacing: '0.04em',
            fontFamily: '"Rajdhani", sans-serif',
            lineHeight: '14px',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{zoneBadgeIcon}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{zoneBadgeText}</span>
        </button>
      )}

      {isActive && <span className="param-lane__indicator" />}

      {/* Hover actions — duplicate + delete */}
      <div
        className={`param-lane__actions ${isActive ? 'param-lane__actions--visible' : ''}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          flexShrink: 0,
          zIndex: 11,
          position: 'relative',
        }}
      >
        {onDuplicate && (
          <span
            className="param-lane__duplicate"
            onClick={handleDuplicate}
            title={`Duplicate ${meta.label} track`}
          >
            ⧉
          </span>
        )}
        {onRemove && (
          <span
            className="param-lane__delete"
            onClick={handleRemove}
            title={`Remove ${meta.label} track`}
          >
            ×
          </span>
        )}
      </div>

      {/* Zone popover — rendered via Portal to document.body */}
      {showZonePopover && popoverPos && createPortal(
        <div
          className="param-lane__zone-popover-portal"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: popoverPos.top,
            left: popoverPos.left,
            zIndex: 99999,
            background: '#0a0a0f',
            border: '1px solid rgba(255, 107, 43, 0.2)',
            borderRadius: '6px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
            padding: '8px',
            minWidth: '200px',
          }}
        >
          <div style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255,107,43,0.5)', letterSpacing: '0.1em', marginBottom: '6px', fontFamily: '"Rajdhani", sans-serif' }}>
            ZONE TARGET — {meta.label}
          </div>
          <SmartZoneSelector
            selectedZones={zones as EffectZone[]}
            onZonesChange={handleZoneToggle}
            compact
          />
        </div>,
        document.body
      )}
    </div>
  )
}
