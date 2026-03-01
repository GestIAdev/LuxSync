/**
 * 🔥 WAVE 2084.2: THE PHANTOM UI — EXTRAS SECTION
 * 
 * La sección fantasma: solo aparece cuando hay fixtures con canales phantom
 * (custom, macro, rotation, speed) — los Ingenios de la WAVE 2084.
 * 
 * Arquitectura:
 * - Detección por fixture.type (heurística tier-1) + lazy IPC fetch (tier-2 precisa)
 * - Grid 2 columnas de sliders horizontales diminutos
 * - Cache de definiciones por profileId (NO se repite IPC cada frame)
 * - Conecta al MasterArbiter via window.lux.arbiter.setManual()
 * 
 * ANTI-SIMULACIÓN: Toda función es real, determinista, sin mocks.
 */

import React, { useCallback, useState, useMemo, useEffect, useRef } from 'react'
import { useSelectedArray } from '../../../stores/selectionStore'
import { useHardware } from '../../../stores/truthStore'
import { ControlsIcon } from '../../icons/LuxIcons'

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export interface ExtrasSectionProps {
  hasOverride: boolean
  isExpanded: boolean
  onToggle: () => void
  onOverrideChange: (hasOverride: boolean) => void
}

/** A resolved phantom channel ready for UI rendering */
interface PhantomChannel {
  /** Channel DMX index in the fixture profile */
  channelIndex: number
  /** Display label: customName > name > type */
  label: string
  /** Channel type from FixtureDefinition */
  type: string
  /** Default DMX value (0-255) */
  defaultValue: number
  /** Is this a continuous rotation channel? (0-127 CW, 128 stop, 129-255 CCW) */
  continuousRotation: boolean
}

/** Cached fixture definition with extracted phantom channels */
interface CachedPhantomDef {
  fixtureId: string
  profileId: string
  phantomChannels: PhantomChannel[]
  timestamp: number
}

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

/** Channel types considered "phantom" — NOT handled by Intensity, Color, Position, or Beam sections */
const PHANTOM_CHANNEL_TYPES = new Set([
  'custom',
  'rotation',
  'macro',
  'speed',
  'control',
])

/** Fixture types that likely have phantom channels (tier-1 heuristic) */
const INGENIO_TYPES = new Set([
  'fan',
  'fog',
  'mirror-ball',
  'pyro',
  'effect',
  'laser',
])

/** Cache TTL — definitions don't change at runtime */
const CACHE_TTL_MS = 60_000

// ═══════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════

export const ExtrasSection: React.FC<ExtrasSectionProps> = ({
  hasOverride,
  isExpanded,
  onToggle,
  onOverrideChange,
}) => {
  const selectedIds = useSelectedArray()
  const hardware = useHardware()
  
  // Phantom channel values: Map<channelIndex, dmxValue>
  const [channelValues, setChannelValues] = useState<Map<number, number>>(new Map())
  
  // Resolved phantom channels from IPC fetch
  const [phantomChannels, setPhantomChannels] = useState<PhantomChannel[]>([])
  
  // Loading state for IPC fetch
  const [isLoading, setIsLoading] = useState(false)
  
  // Definition cache: profileId → CachedPhantomDef
  const cacheRef = useRef<Map<string, CachedPhantomDef>>(new Map())
  
  // ═══════════════════════════════════════════════════════════════════
  // TIER-1: Type-based heuristic (instant, no IPC)
  // Determines if the section SHOULD RENDER at all
  // ═══════════════════════════════════════════════════════════════════
  
  const selectedFixtures = useMemo(() => {
    const fixtures = hardware?.fixtures || []
    return selectedIds
      .map(id => fixtures.find((f: { id: string }) => f.id === id))
      .filter(Boolean)
  }, [selectedIds, hardware?.fixtures])
  
  /**
   * Quick check: do ANY selected fixtures potentially have phantom channels?
   * Uses fixture type as heuristic — Ingenio types always qualify.
   * Non-Ingenio types ALSO qualify if they have a profileId (we'll verify via IPC).
   */
  const mayHavePhantomChannels = useMemo(() => {
    return selectedFixtures.some((f: any) => {
      const type = f?.type?.toLowerCase() || ''
      // Tier-1: Ingenio types are guaranteed to have phantom channels
      if (INGENIO_TYPES.has(type)) return true
      // Tier-1b: Any fixture with a profileId MIGHT have phantom channels
      // The section renders but may collapse if IPC reveals nothing phantom
      if (f?.profileId) return true
      return false
    })
  }, [selectedFixtures])
  
  // ═══════════════════════════════════════════════════════════════════
  // TIER-2: IPC fetch for precise phantom channel detection
  // Only fires when section expands AND we have qualifying fixtures
  // ═══════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    if (!isExpanded || !mayHavePhantomChannels || selectedFixtures.length === 0) {
      return
    }
    
    let cancelled = false
    
    const fetchPhantomChannels = async () => {
      setIsLoading(true)
      const allPhantomChannels: PhantomChannel[] = []
      const now = Date.now()
      
      for (const fixture of selectedFixtures) {
        if (cancelled) break
        const f = fixture as any
        const profileId = f?.profileId || f?.id
        if (!profileId) continue
        
        // Check cache first
        const cached = cacheRef.current.get(profileId)
        if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
          // Merge cached phantom channels (deduplicate by channelIndex)
          for (const ch of cached.phantomChannels) {
            if (!allPhantomChannels.some(existing => existing.channelIndex === ch.channelIndex)) {
              allPhantomChannels.push(ch)
            }
          }
          continue
        }
        
        // IPC fetch
        try {
          const result = await window.lux?.getFixtureDefinition?.(profileId)
          if (!result?.success || !result.definition?.channels) continue
          
          const phantoms = result.definition.channels
            .filter((ch: any) => PHANTOM_CHANNEL_TYPES.has(ch.type))
            .map((ch: any): PhantomChannel => ({
              channelIndex: ch.index,
              label: ch.customName || ch.name || ch.type.toUpperCase(),
              type: ch.type,
              defaultValue: ch.defaultValue ?? 0,
              continuousRotation: ch.continuousRotation === true,
            }))
          
          // Cache it
          cacheRef.current.set(profileId, {
            fixtureId: f.id,
            profileId,
            phantomChannels: phantoms,
            timestamp: now,
          })
          
          // Merge (deduplicate)
          for (const ch of phantoms) {
            if (!allPhantomChannels.some(existing => existing.channelIndex === ch.channelIndex)) {
              allPhantomChannels.push(ch)
            }
          }
        } catch (err) {
          console.warn(`[Extras] Failed to fetch definition for ${profileId}:`, err)
        }
      }
      
      if (!cancelled) {
        // Sort by channel index for deterministic order
        allPhantomChannels.sort((a, b) => a.channelIndex - b.channelIndex)
        setPhantomChannels(allPhantomChannels)
        
        // Initialize values with defaults
        const defaults = new Map<number, number>()
        for (const ch of allPhantomChannels) {
          defaults.set(ch.channelIndex, ch.defaultValue)
        }
        setChannelValues(prev => {
          // Preserve existing values, add new ones with defaults
          const merged = new Map(prev)
          for (const [idx, val] of defaults) {
            if (!merged.has(idx)) {
              merged.set(idx, val)
            }
          }
          return merged
        })
        setIsLoading(false)
      }
    }
    
    fetchPhantomChannels()
    
    return () => { cancelled = true }
  }, [isExpanded, mayHavePhantomChannels, selectedFixtures])
  
  // Reset when selection changes
  useEffect(() => {
    setPhantomChannels([])
    setChannelValues(new Map())
  }, [selectedIds.length])
  
  // ═══════════════════════════════════════════════════════════════════
  // HANDLERS — Connect to Arbiter
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * Send a phantom channel value to Arbiter
   */
  const handleChannelChange = useCallback(async (channelIndex: number, value: number, channelType: string) => {
    setChannelValues(prev => {
      const next = new Map(prev)
      next.set(channelIndex, value)
      return next
    })
    
    onOverrideChange(true)
    
    try {
      await window.lux?.arbiter?.setManual({
        fixtureIds: selectedIds,
        controls: { [channelType]: value },
        channels: [channelType],
        source: 'ui_programmer_extras',
      })
    } catch (err) {
      console.error('[Extras] Channel send error:', err)
    }
  }, [selectedIds, onOverrideChange])
  
  /**
   * Release all phantom channels back to AI
   */
  const handleRelease = useCallback(async () => {
    onOverrideChange(false)
    
    const channelTypes = phantomChannels.map(ch => ch.type)
    
    try {
      await window.lux?.arbiter?.clearManual({
        fixtureIds: selectedIds,
        channels: channelTypes,
      })
      console.log(`[Extras] 🔓 Phantom channels released for ${selectedIds.length} fixtures`)
    } catch (err) {
      console.error('[Extras] Release error:', err)
    }
  }, [selectedIds, phantomChannels, onOverrideChange])
  
  // ═══════════════════════════════════════════════════════════════════
  // RENDER GATE — The Phantom condition
  // ═══════════════════════════════════════════════════════════════════
  
  const shouldRender = mayHavePhantomChannels && selectedIds.length > 0
  
  if (!shouldRender) {
    return null
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * Format DMX value for display
   * Continuous rotation: shows direction + speed
   * Normal: shows raw DMX value
   */
  const formatValue = (value: number, continuousRotation: boolean): string => {
    if (!continuousRotation) {
      return String(value)
    }
    // Continuous rotation convention: 0-127 CW, 128 STOP, 129-255 CCW
    if (value < 126) return `CW ${Math.round((1 - value / 127) * 100)}%`
    if (value > 130) return `CCW ${Math.round(((value - 128) / 127) * 100)}%`
    return 'STOP'
  }
  
  return (
    <div className={`programmer-section extras-section ${hasOverride ? 'has-override' : ''} ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="section-header clickable" onClick={onToggle}>
        <h4 className="section-title">
          <span className="section-icon">{isExpanded ? '▼' : '▶'}</span>
          <ControlsIcon size={18} className="title-icon" />
          EXTRAS
        </h4>
        <div className="header-right">
          {hasOverride && (
            <button 
              className="release-btn"
              onClick={(e) => {
                e.stopPropagation()
                handleRelease()
              }}
              title="Release to AI control"
            >
              ↺
            </button>
          )}
        </div>
      </div>
      
      {isExpanded && (
        <div className="phantom-body">
          {isLoading ? (
            <div className="phantom-loading">
              <span className="phantom-loading-text">Scanning channels...</span>
            </div>
          ) : phantomChannels.length === 0 ? (
            <div className="phantom-empty">
              <span className="phantom-empty-text">No phantom channels detected</span>
            </div>
          ) : (
            <div className="phantom-grid">
              {phantomChannels.map(ch => {
                const value = channelValues.get(ch.channelIndex) ?? ch.defaultValue
                return (
                  <div key={ch.channelIndex} className={`phantom-channel ${ch.continuousRotation ? 'rotation-channel' : ''}`}>
                    <div className="phantom-channel-header">
                      <span className="phantom-channel-label">{ch.label}</span>
                      <span className="phantom-channel-value">
                        {formatValue(value, ch.continuousRotation)}
                      </span>
                    </div>
                    <input
                      type="range"
                      className={`phantom-slider phantom-slider--${ch.type}`}
                      min={0}
                      max={255}
                      value={value}
                      onChange={(e) => handleChannelChange(ch.channelIndex, parseInt(e.target.value, 10), ch.type)}
                    />
                  </div>
                )
              })}
            </div>
          )}
          
          {/* Override badge */}
          {hasOverride && (
            <div className="override-badge">MANUAL</div>
          )}
        </div>
      )}
    </div>
  )
}

export default ExtrasSection
