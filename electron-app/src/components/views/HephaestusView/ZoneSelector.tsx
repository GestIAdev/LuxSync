/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ ZONE SELECTOR - WAVE 2030.13
 * Chip-style zone targeting for Hephaestus automation clips
 * 
 * Allows clips to specify which fixture zones they affect.
 * Empty selection = ALL ZONES (default behavior).
 * 
 * @module views/HephaestusView/ZoneSelector
 * @version WAVE 2030.13
 */

import React from 'react'
import type { EffectZone } from '../../../core/effects/types'

// ═══════════════════════════════════════════════════════════════════════════
// ZONE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Available zones for Hephaestus targeting.
 * These map to the fixture zones defined in the LuxSync system.
 */
export const HEPH_ZONES: { id: EffectZone; label: string; icon: string }[] = [
  { id: 'movers_left',  label: 'L',     icon: '◀' },
  { id: 'movers_right', label: 'R',     icon: '▶' },
  { id: 'front',        label: 'FRONT', icon: '🎯' },
  { id: 'back',         label: 'BACK',  icon: '🔙' },
  { id: 'movers',       label: 'AIR',   icon: '✈️' },
  { id: 'pars',         label: 'PARS',  icon: '💡' },
]

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface ZoneSelectorProps {
  /** Currently selected zones */
  selectedZones: EffectZone[]
  /** Callback when zone selection changes */
  onZonesChange: (zones: EffectZone[]) => void
  /** Whether the selector is disabled */
  disabled?: boolean
}

export const ZoneSelector: React.FC<ZoneSelectorProps> = ({
  selectedZones,
  onZonesChange,
  disabled = false,
}) => {
  const isAllZones = selectedZones.length === 0

  const toggleZone = (zoneId: EffectZone) => {
    if (disabled) return

    if (selectedZones.includes(zoneId)) {
      // Remove zone
      onZonesChange(selectedZones.filter(z => z !== zoneId))
    } else {
      // Add zone
      onZonesChange([...selectedZones, zoneId])
    }
  }

  const selectAll = () => {
    if (disabled) return
    onZonesChange([])  // Empty array = ALL zones
  }

  return (
    <div className="heph-zones">
      {/* ALL button */}
      <button
        className={`heph-zones__chip ${isAllZones ? 'heph-zones__chip--active' : ''}`}
        onClick={selectAll}
        disabled={disabled}
        title="Target all zones"
      >
        ALL
      </button>

      {/* Zone chips */}
      {HEPH_ZONES.map(zone => {
        const isActive = selectedZones.includes(zone.id)
        return (
          <button
            key={zone.id}
            className={`heph-zones__chip ${isActive ? 'heph-zones__chip--active' : ''}`}
            onClick={() => toggleZone(zone.id)}
            disabled={disabled}
            title={`Target ${zone.label} zone`}
          >
            <span className="heph-zones__chip-icon">{zone.icon}</span>
            <span className="heph-zones__chip-label">{zone.label}</span>
          </button>
        )
      })}

      {/* Visual indicator when specific zones selected */}
      {!isAllZones && (
        <span className="heph-zones__count">
          {selectedZones.length} zone{selectedZones.length !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}

export default ZoneSelector
