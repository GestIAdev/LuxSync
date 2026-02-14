/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ ZONE SELECTOR - WAVE 2040.28: THE DUALITY
 * 
 * Header Badge + Popover architecture:
 * - Normal state: Compact badge showing "🎯 MOVERS (L) [Edit]"
 * - On click: Opens a floating popover with SmartZoneSelector (compact mode)
 * 
 * Uses LuxIcons exclusively — no generic chips.
 * 
 * @module views/HephaestusView/ZoneSelector
 * @version WAVE 2040.28
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import type { EffectZone } from '../../../core/effects/types'
import { SmartZoneSelector, getZoneBadgeText, getZoneBadgeIcon } from './SmartZoneSelector'

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT — Header Badge with Popover
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
  const [isOpen, setIsOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const badgeRef = useRef<HTMLButtonElement>(null)

  // Click-outside to close popover
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        badgeRef.current && !badgeRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Trap keyboard events inside popover
  const handlePopoverKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Escape') setIsOpen(false)
  }, [])

  const badgeText = getZoneBadgeText(selectedZones)
  const badgeIcon = getZoneBadgeIcon(selectedZones)

  return (
    <div className="heph-zone-badge-wrap">
      {/* Badge Button */}
      <button
        ref={badgeRef}
        className={`heph-zone-badge ${isOpen ? 'heph-zone-badge--open' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        title="Click to edit zone targeting"
      >
        <span className="heph-zone-badge__icon">{badgeIcon}</span>
        <span className="heph-zone-badge__text">{badgeText}</span>
        <span className="heph-zone-badge__edit">Edit</span>
      </button>

      {/* Popover */}
      {isOpen && (
        <div 
          ref={popoverRef} 
          className="heph-zone-popover"
          onKeyDown={handlePopoverKeyDown}
          onKeyUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="heph-zone-popover__header">
            <span className="heph-zone-popover__title">ZONE TARGET</span>
          </div>
          <SmartZoneSelector
            selectedZones={selectedZones}
            onZonesChange={onZonesChange}
            disabled={disabled}
            compact
          />
        </div>
      )}
    </div>
  )
}

export default ZoneSelector
