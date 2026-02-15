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
 * @updated WAVE 2042.18 — Boundary checking + React Portal
 */

import React, { useMemo } from 'react'
import { createPortal } from 'react-dom'
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
  
  /** Posición del tooltip (CSS pixels, coordenadas absolutas en viewport) */
  position: { x: number; y: number }
  
  /** ¿Está visible? */
  visible: boolean
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

  // ── 🎯 WAVE 2042.18: INTELLIGENT BOUNDARY CHECKING ─────────────────────────
  // Dimensiones aproximadas del tooltip
  const TOOLTIP_WIDTH = 280
  const TOOLTIP_HEIGHT = 200
  const OFFSET = 12 // Pegado al fixture, 12px de margen

  const smartPosition = useMemo(() => {
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    }

    // Decisiones horizontales: ¿Tooltip a la derecha o izquierda?
    let horizontal: 'right' | 'left' = 'right'
    let left = position.x + OFFSET
    
    if (position.x + TOOLTIP_WIDTH + OFFSET > viewport.width) {
      // No cabe a la derecha → Colocar a la IZQUIERDA
      horizontal = 'left'
      left = position.x - TOOLTIP_WIDTH - OFFSET
    }

    // Decisiones verticales: ¿Tooltip arriba o abajo?
    let vertical: 'above' | 'below' = 'above'
    let top = position.y - TOOLTIP_HEIGHT - OFFSET
    
    if (position.y < TOOLTIP_HEIGHT + OFFSET) {
      // No cabe arriba → Colocar ABAJO
      vertical = 'below'
      top = position.y + OFFSET
    }

    // Clamp final para seguridad (nunca salir del viewport)
    left = Math.max(10, Math.min(left, viewport.width - TOOLTIP_WIDTH - 10))
    top = Math.max(10, Math.min(top, viewport.height - TOOLTIP_HEIGHT - 10))

    return {
      left: `${left}px`,
      top: `${top}px`,
      horizontal,
      vertical,
    }
  }, [position.x, position.y])
  
  const tooltipStyle: React.CSSProperties = {
    position: 'fixed', // 🚨 FIXED para portal en document.body
    left: smartPosition.left,
    top: smartPosition.top,
    zIndex: 999999, // 🛡️ MÁXIMA VISIBILIDAD (por encima de TODO)
    pointerEvents: 'none', // 🛡️ NO MOUSE CAPTURE
    willChange: 'transform, opacity', // 🚀 GPU ACCELERATION
    
    // Custom properties
    '--fixture-color': fixtureColor,
    '--zone-color': zoneColor,
  } as React.CSSProperties

  // ── CSS Classes ───────────────────────────────────────────────────────────
  const tooltipClasses = [
    'fixture-tooltip',
    visible && 'visible',
    selected && 'selected',
    isOff && 'off',
  ].filter(Boolean).join(' ')

  // ── Render (PORTAL para evitar overflow:hidden) ───────────────────────────
  const tooltipContent = (
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

  // 🌀 PORTAL: Renderizar en document.body para evitar overflow:hidden
  return createPortal(tooltipContent, document.body)
}

export default FixtureTooltip
