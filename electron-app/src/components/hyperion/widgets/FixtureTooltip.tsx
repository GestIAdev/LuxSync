/**
 * ☀️ HYPERION — Fixture Tactical Tooltip
 * 
 * Pop-up flotante que aparece al hover sobre un fixture.
 * Datos 100% reales de truthStore + stageStore.
 * Estética: HUD de caza militar + neon cyberpunk.
 * 
 * Layout:
 * ┌─────────────────────────────────┐
 * │ 💡 PAR #101         FRONT Ⓛ    │  ← Header: Type + ID + Zone
 * ├─────────────────────────────────┤
 * │ DIM  ████████████████░░  78%    │  ← Barra de intensidad
 * │ RGB  (255, 32, 180)    ■       │  ← Color + swatch
 * │ PAN  127°   TILT  -34°         │  ← Position (solo movers)
 * │ ZOOM  Wash   FOCUS  Sharp      │  ← Optics (solo movers)
 * │ DMX  @089                       │  ← Dirección DMX
 * └─────────────────────────────────┘
 * 
 * @module components/hyperion/widgets/FixtureTooltip
 * @since WAVE 2042.4 (Project Hyperion — Phase 2)
 */

import React, { useMemo } from 'react'
import { ZONE_COLORS, ZONE_LABELS, type CanonicalZone } from '../shared/ZoneLayoutEngine'
import './FixtureTooltip.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface FixtureTooltipData {
  /** ID único del fixture */
  id: string
  
  /** Nombre display (ej: "PAR 01") */
  name: string
  
  /** Tipo de fixture */
  type: 'moving-head' | 'par' | 'wash' | 'strobe' | 'laser' | 'blinder' | 'generic'
  
  /** Zona canónica */
  zone: CanonicalZone
  
  /** Dirección DMX base (1-512) */
  dmxAddress: number
  
  /** Intensidad (0-1) */
  intensity: number
  
  /** Color RGB */
  color: { r: number; g: number; b: number }
  
  /** Pan (0-1, normalizado) — solo movers */
  pan?: number
  
  /** Tilt (0-1, normalizado) — solo movers */
  tilt?: number
  
  /** Zoom (0-1) — solo movers */
  zoom?: number
  
  /** Focus (0-1) — solo movers */
  focus?: number
  
  /** ¿Está seleccionado? */
  selected: boolean
  
  /** ¿Tiene override manual? */
  hasOverride: boolean
}

export interface FixtureTooltipProps {
  /** Datos del fixture a mostrar */
  data: FixtureTooltipData | null
  
  /** Posición del tooltip (CSS pixels, relativo al viewport container) */
  position: { x: number; y: number }
  
  /** ¿Está visible? */
  visible: boolean
  
  /** Posición preferida: arriba o abajo del fixture */
  preferredPosition?: 'above' | 'below'
  
  /** Altura del contenedor (para calcular si cabe arriba) */
  containerHeight?: number
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/** Convierte RGB a hex string */
function rgbToHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

/** Obtiene el icono del tipo de fixture */
function getFixtureIcon(type: FixtureTooltipData['type']): string {
  switch (type) {
    case 'moving-head': return '🎯'
    case 'par': return '💡'
    case 'wash': return '🌊'
    case 'strobe': return '⚡'
    case 'laser': return '✨'
    case 'blinder': return '☀️'
    default: return '○'
  }
}

/** Obtiene el label del tipo de fixture */
function getFixtureTypeLabel(type: FixtureTooltipData['type']): string {
  switch (type) {
    case 'moving-head': return 'Moving Head'
    case 'par': return 'PAR Can'
    case 'wash': return 'Wash'
    case 'strobe': return 'Strobe'
    case 'laser': return 'Laser'
    case 'blinder': return 'Blinder'
    default: return 'Fixture'
  }
}

/** ¿Es un mover (tiene pan/tilt)? */
function isMover(type: FixtureTooltipData['type']): boolean {
  return type === 'moving-head'
}

/** Convierte valor 0-1 a grados para pan (0-540°) */
function panToDegrees(value: number): string {
  const degrees = Math.round(value * 540 - 270) // -270 to +270
  return `${degrees >= 0 ? '+' : ''}${degrees}°`
}

/** Convierte valor 0-1 a grados para tilt (0-270°) */
function tiltToDegrees(value: number): string {
  const degrees = Math.round(value * 270 - 135) // -135 to +135
  return `${degrees >= 0 ? '+' : ''}${degrees}°`
}

/** Convierte zoom 0-1 a label descriptivo */
function zoomToLabel(value: number): string {
  if (value < 0.3) return 'Spot'
  if (value < 0.7) return 'Medium'
  return 'Wash'
}

/** Convierte focus 0-1 a label descriptivo */
function focusToLabel(value: number): string {
  if (value < 0.3) return 'Soft'
  if (value < 0.7) return 'Medium'
  return 'Sharp'
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function FixtureTooltip({
  data,
  position,
  visible,
  preferredPosition = 'above',
  containerHeight = 600,
}: FixtureTooltipProps) {
  // ── Early Return ──────────────────────────────────────────────────────────
  if (!data) return null

  // ── Computed Values ───────────────────────────────────────────────────────
  const {
    id,
    name,
    type,
    zone,
    dmxAddress,
    intensity,
    color,
    pan,
    tilt,
    zoom,
    focus,
    selected,
    hasOverride,
  } = data

  const intensityPercent = Math.round(intensity * 100)
  const isOff = intensity < 0.01
  const showMoverData = isMover(type)
  const fixtureColor = rgbToHex(color.r, color.g, color.b)
  const zoneColor = ZONE_COLORS[zone]
  const zoneLabel = ZONE_LABELS[zone]

  // ── Position Calculation ──────────────────────────────────────────────────
  // Tooltip tiene ~200px de altura aprox. 
  // Si está muy arriba, lo ponemos abajo
  const tooltipHeight = 180
  const margin = 12
  
  const actualPosition = useMemo(() => {
    if (preferredPosition === 'above' && position.y > tooltipHeight + margin) {
      return 'above'
    }
    if (preferredPosition === 'below' && position.y + tooltipHeight + margin < containerHeight) {
      return 'below'
    }
    // Fallback: donde haya más espacio
    return position.y > containerHeight / 2 ? 'above' : 'below'
  }, [position.y, preferredPosition, containerHeight])

  // ── Style Calculation ─────────────────────────────────────────────────────
  const tooltipStyle = useMemo(() => {
    const style: React.CSSProperties = {
      left: position.x,
      '--fixture-color': fixtureColor,
      '--zone-color': zoneColor,
    } as React.CSSProperties

    if (actualPosition === 'above') {
      style.bottom = containerHeight - position.y + margin
      style.transform = 'translateX(-50%)'
    } else {
      style.top = position.y + margin
      style.transform = 'translateX(-50%)'
    }

    return style
  }, [position, actualPosition, containerHeight, fixtureColor, zoneColor])

  // ── CSS Classes ───────────────────────────────────────────────────────────
  const tooltipClasses = [
    'fixture-tooltip',
    visible && 'visible',
    selected && 'selected',
    isOff && 'off',
    `position-${actualPosition}`,
  ].filter(Boolean).join(' ')

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={tooltipClasses} style={tooltipStyle}>
      {/* Header */}
      <div className="tooltip-header">
        <div className="tooltip-fixture-info">
          <span className="tooltip-fixture-icon">{getFixtureIcon(type)}</span>
          <div>
            <div className="tooltip-fixture-name">{name}</div>
            <div className="tooltip-fixture-type">{getFixtureTypeLabel(type)}</div>
          </div>
        </div>
        <span className="tooltip-zone-badge">{zoneLabel}</span>
      </div>

      {/* Intensity Bar */}
      <div className="tooltip-intensity-row">
        <span className="tooltip-label">DIM</span>
        <div className="tooltip-dim-bar">
          <div 
            className="tooltip-dim-fill" 
            style={{ width: `${intensityPercent}%` }} 
          />
        </div>
        <span className="tooltip-dim-value">{intensityPercent}%</span>
      </div>

      {/* Color Row */}
      <div className="tooltip-color-row">
        <span className="tooltip-label">RGB</span>
        <div className="tooltip-color-values">
          <span>({color.r}, {color.g}, {color.b})</span>
        </div>
        <div 
          className="tooltip-color-swatch" 
          style={{ backgroundColor: fixtureColor }}
        />
      </div>

      {/* Position Row (solo movers) */}
      {showMoverData && pan !== undefined && tilt !== undefined && (
        <div className="tooltip-position-row">
          <div className="tooltip-position-item">
            <span className="tooltip-position-label">PAN</span>
            <span className="tooltip-position-value">{panToDegrees(pan)}</span>
          </div>
          <div className="tooltip-position-item">
            <span className="tooltip-position-label">TILT</span>
            <span className="tooltip-position-value">{tiltToDegrees(tilt)}</span>
          </div>
        </div>
      )}

      {/* Optics Row (solo movers) */}
      {showMoverData && zoom !== undefined && focus !== undefined && (
        <div className="tooltip-optics-row">
          <div className="tooltip-optic-item">
            <span className="tooltip-optic-label">ZOOM</span>
            <span className="tooltip-optic-value">{zoomToLabel(zoom)}</span>
          </div>
          <div className="tooltip-optic-item">
            <span className="tooltip-optic-label">FOCUS</span>
            <span className="tooltip-optic-value">{focusToLabel(focus)}</span>
          </div>
        </div>
      )}

      {/* DMX Address + Override Badge */}
      <div className="tooltip-dmx-row">
        <span className="tooltip-dmx-label">DMX</span>
        <span className="tooltip-dmx-value">@{dmxAddress.toString().padStart(3, '0')}</span>
        {hasOverride && (
          <span className="tooltip-override-badge">Override</span>
        )}
      </div>
    </div>
  )
}

export default FixtureTooltip
