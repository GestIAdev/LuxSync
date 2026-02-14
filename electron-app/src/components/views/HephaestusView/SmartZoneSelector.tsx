/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ SMART ZONE SELECTOR - WAVE 2040.28
 * Cyberpunk Industrial matrix for zone targeting
 * 
 * Three-tier architecture:
 * ┌─ TARGET (type/scope) ─────────────────────────────────────────┐
 * │ ALL │ MOVERS │ PARS │ AIR │ FRONT │ BACK │ FLOOR │ CENTER    │
 * ├─ SIDE (stereo) ───────────────────────────────────────────────┤
 * │ LEFT │ RIGHT                                                  │
 * ├─ PARITY (index-based) ────────────────────────────────────────┤
 * │ ODD │ EVEN                                                    │
 * └───────────────────────────────────────────────────────────────┘
 * 
 * Uses LuxIcons exclusively — no generic emoji garbage.
 * 
 * @module views/HephaestusView/SmartZoneSelector
 * @version WAVE 2040.28
 */

import React from 'react'
import type { EffectZone } from '../../../core/effects/types'
import {
  TargetIcon,
  MovingHeadIcon,
  ParCanIcon,
  LaserIcon,
  IntensityIcon,
  BeamIcon,
  StrobeIcon,
  BlinderIcon,
} from '../../icons/LuxIcons'

// ═══════════════════════════════════════════════════════════════════════════
// ZONE TILE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

interface ZoneTile {
  id: EffectZone
  label: string
  icon: React.ReactNode
  /** Row in the matrix grid (0-indexed) */
  row: 'target' | 'position' | 'parity'
}

/**
 * Target tiles — WHAT type of fixtures
 */
const TARGET_TILES: ZoneTile[] = [
  { id: 'all',        label: 'ALL',    icon: <TargetIcon size={18} color="currentColor" />,     row: 'target' },
  { id: 'all-movers', label: 'MOV',    icon: <MovingHeadIcon size={18} color="currentColor" />, row: 'target' },
  { id: 'all-pars',   label: 'PAR',    icon: <ParCanIcon size={18} color="currentColor" />,     row: 'target' },
  { id: 'air',        label: 'AIR',    icon: <LaserIcon size={18} color="currentColor" />,      row: 'target' },
]

/**
 * Position tiles — WHERE on stage
 */
const POSITION_TILES: ZoneTile[] = [
  { id: 'front',        label: 'FRT',  icon: <IntensityIcon size={18} color="currentColor" />,  row: 'position' },
  { id: 'back',         label: 'BCK',  icon: <BeamIcon size={18} color="currentColor" />,       row: 'position' },
  { id: 'floor',        label: 'FLR',  icon: <BlinderIcon size={18} color="currentColor" />,    row: 'position' },
  { id: 'center',       label: 'CTR',  icon: <StrobeIcon size={18} color="currentColor" />,     row: 'position' },
]

/**
 * Side + Parity tiles — L/R and ODD/EVEN
 */
const MODIFIER_TILES: ZoneTile[] = [
  { id: 'all-left',    label: 'L',    icon: <span className="smart-zone__arrow">◀</span>, row: 'parity' },
  { id: 'all-right',   label: 'R',    icon: <span className="smart-zone__arrow">▶</span>, row: 'parity' },
  { id: 'movers-left', label: 'ODD',  icon: <span className="smart-zone__parity">①</span>, row: 'parity' },
  { id: 'movers-right',label: 'EVN',  icon: <span className="smart-zone__parity">②</span>, row: 'parity' },
]

const ALL_TILES = [...TARGET_TILES, ...POSITION_TILES, ...MODIFIER_TILES]

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a human-readable summary badge text from zone selection.
 * Examples: "ALL", "MOVERS (L)", "FRONT + BACK (Even)", etc.
 */
export function getZoneBadgeText(zones: EffectZone[]): string {
  if (zones.length === 0 || (zones.length === 1 && zones[0] === 'all')) return 'ALL'

  const parts: string[] = []
  const modifiers: string[] = []

  for (const z of zones) {
    const tile = ALL_TILES.find(t => t.id === z)
    if (!tile) continue
    if (tile.row === 'parity') {
      modifiers.push(tile.label)
    } else {
      parts.push(tile.label)
    }
  }

  const target = parts.length > 0 ? parts.join(' + ') : 'ALL'
  const mod = modifiers.length > 0 ? ` (${modifiers.join(', ')})` : ''
  return `${target}${mod}`
}

/**
 * Get the primary LuxIcon for the current zone selection (for the header badge).
 */
export function getZoneBadgeIcon(zones: EffectZone[]): React.ReactNode {
  if (zones.length === 0 || (zones.length === 1 && zones[0] === 'all')) {
    return <TargetIcon size={14} color="#f97316" />
  }
  // Find the first target/position tile
  const firstTarget = zones.find(z => {
    const tile = ALL_TILES.find(t => t.id === z)
    return tile && tile.row !== 'parity'
  })
  if (firstTarget) {
    const tile = ALL_TILES.find(t => t.id === firstTarget)
    if (tile) return tile.icon
  }
  return <TargetIcon size={14} color="#f97316" />
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface SmartZoneSelectorProps {
  selectedZones: EffectZone[]
  onZonesChange: (zones: EffectZone[]) => void
  disabled?: boolean
  /** Compact mode for popover usage (smaller tiles) */
  compact?: boolean
}

export const SmartZoneSelector: React.FC<SmartZoneSelectorProps> = ({
  selectedZones,
  onZonesChange,
  disabled = false,
  compact = false,
}) => {
  const isAllSelected = selectedZones.length === 0 ||
    (selectedZones.length === 1 && selectedZones[0] === 'all')

  const toggleZone = (zoneId: EffectZone) => {
    if (disabled) return

    // Special: clicking ALL clears everything
    if (zoneId === 'all') {
      onZonesChange([])
      return
    }

    // Toggle
    if (selectedZones.includes(zoneId)) {
      const next = selectedZones.filter(z => z !== zoneId)
      onZonesChange(next)
    } else {
      // Remove 'all' if present, add new zone
      const next = selectedZones.filter(z => z !== 'all')
      onZonesChange([...next, zoneId])
    }
  }

  const isActive = (zoneId: EffectZone): boolean => {
    if (zoneId === 'all') return isAllSelected
    return selectedZones.includes(zoneId)
  }

  const sizeClass = compact ? 'smart-zone--compact' : ''

  return (
    <div className={`smart-zone ${sizeClass}`}>
      {/* ROW 1: Targets */}
      <div className="smart-zone__row">
        <span className="smart-zone__row-label">TARGET</span>
        <div className="smart-zone__tiles">
          {TARGET_TILES.map(tile => (
            <button
              key={tile.id}
              className={`smart-zone__tile ${isActive(tile.id) ? 'smart-zone__tile--active' : ''}`}
              onClick={() => toggleZone(tile.id)}
              disabled={disabled}
              title={tile.label}
            >
              <span className="smart-zone__tile-icon">{tile.icon}</span>
              <span className="smart-zone__tile-label">{tile.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ROW 2: Position */}
      <div className="smart-zone__row">
        <span className="smart-zone__row-label">ZONE</span>
        <div className="smart-zone__tiles">
          {POSITION_TILES.map(tile => (
            <button
              key={tile.id}
              className={`smart-zone__tile ${isActive(tile.id) ? 'smart-zone__tile--active' : ''}`}
              onClick={() => toggleZone(tile.id)}
              disabled={disabled}
              title={tile.label}
            >
              <span className="smart-zone__tile-icon">{tile.icon}</span>
              <span className="smart-zone__tile-label">{tile.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ROW 3: Modifiers (Side + Parity) */}
      <div className="smart-zone__row">
        <span className="smart-zone__row-label">MOD</span>
        <div className="smart-zone__tiles">
          {MODIFIER_TILES.map(tile => (
            <button
              key={tile.id}
              className={`smart-zone__tile smart-zone__tile--modifier ${isActive(tile.id) ? 'smart-zone__tile--active' : ''}`}
              onClick={() => toggleZone(tile.id)}
              disabled={disabled}
              title={tile.label}
            >
              <span className="smart-zone__tile-icon">{tile.icon}</span>
              <span className="smart-zone__tile-label">{tile.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SmartZoneSelector
