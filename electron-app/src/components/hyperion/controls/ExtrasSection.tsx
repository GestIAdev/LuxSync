/**
 * 🔥 WAVE 2084.6: THE PHANTOM DATA LINK — EXTRAS SECTION
 * 
 * La sección fantasma: solo aparece cuando hay fixtures con canales phantom
 * (custom, macro, rotation, speed) — los Ingenios de la WAVE 2084.
 * 
 * Arquitectura:
 * - WAVE 2084.5: Eliminada heurística Tier-1 por tipo de fixture
 * - WAVE 2084.6: Cascada blindada de fallback para obtener canales:
 *     1. DIRECTO: fixture.channels embebidos en el ShowFile → usa inline
 *     2. FETCH:   definitionId || profileId || fixtureDefId || id → IPC
 *   Logging táctico antes del render gate para diagnóstico en consola Electron.
 * - Cache de definiciones por defId (NO se repite IPC cada frame)
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
  // FIXTURE RESOLUTION — Blind cascade for channel extraction
  // ═══════════════════════════════════════════════════════════════════
  
  const selectedFixtures = useMemo(() => {
    const fixtures = hardware?.fixtures || []
    return selectedIds
      .map(id => fixtures.find((f: { id: string }) => f.id === id))
      .filter(Boolean)
  }, [selectedIds, hardware?.fixtures])
  
  /**
   * 🔥 WAVE 2084.6: Blind cascade to resolve the fixture definition ID.
   * The FixtureState from SeleneTruth may carry the ID under different keys
   * depending on which pipeline populated it (ShowFileV2, TitanSyncBridge, Arbiter).
   * 
   * Priority: definitionId > profileId > fixtureDefId
   * NEVER fall back to fixture.id — that's the instance ID, not the library ID.
   */
  const resolveDefId = useCallback((f: any): string | null => {
    return f?.definitionId || f?.profileId || f?.fixtureDefId || null
  }, [])
  
  /**
   * 🔥 WAVE 2084.6: Extract phantom channels INLINE from embedded channels array.
   * If the fixture carries its own channels[] (from ShowFileV2 or TitanSyncBridge),
   * we can resolve phantom channels WITHOUT any IPC call.
   */
  const extractInlinePhantoms = useCallback((channels: any[]): PhantomChannel[] => {
    if (!Array.isArray(channels) || channels.length === 0) return []
    return channels
      .filter((ch: any) => PHANTOM_CHANNEL_TYPES.has(ch?.type))
      .map((ch: any): PhantomChannel => ({
        channelIndex: ch.index ?? ch.channelIndex ?? 0,
        label: ch.customName || ch.name || ch.type?.toUpperCase() || 'UNKNOWN',
        type: ch.type,
        defaultValue: ch.defaultValue ?? 0,
        continuousRotation: ch.continuousRotation === true,
      }))
  }, [])
  
  /**
   * Any selected fixture qualifies if it has:
   * - Embedded channels with at least one phantom type, OR
   * - A resolvable definition ID (we'll verify via IPC)
   */
  const mayHavePhantomChannels = useMemo(() => {
    return selectedFixtures.some((f: any) => {
      // Path 1: Inline channels already embedded
      if (Array.isArray(f?.channels) && f.channels.length > 0) {
        return f.channels.some((ch: any) => PHANTOM_CHANNEL_TYPES.has(ch?.type))
      }
      // Path 2: Has a definition ID we can query
      return !!resolveDefId(f)
    })
  }, [selectedFixtures, resolveDefId])
  
  // ═══════════════════════════════════════════════════════════════════
  // CHANNEL RESOLUTION — Inline first, IPC only when needed
  // ═══════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    if (!isExpanded || selectedFixtures.length === 0) {
      return
    }
    
    let cancelled = false
    
    const resolvePhantomChannels = async () => {
      setIsLoading(true)
      const allPhantomChannels: PhantomChannel[] = []
      const now = Date.now()
      
      for (const fixture of selectedFixtures) {
        if (cancelled) break
        const f = fixture as any
        
        // ─── PATH 1: INLINE — channels[] embedded in the fixture object ───
        if (Array.isArray(f?.channels) && f.channels.length > 0) {
          const inlinePhantoms = extractInlinePhantoms(f.channels)
          console.log(`[PhantomPanel] 📦 INLINE path | fixture: "${f.name}" | channels: ${f.channels.length} | phantoms: ${inlinePhantoms.length}`)
          for (const ch of inlinePhantoms) {
            if (!allPhantomChannels.some(existing => existing.channelIndex === ch.channelIndex)) {
              allPhantomChannels.push(ch)
            }
          }
          continue // No IPC needed for this fixture
        }
        
        // ─── PATH 2: RESOLVE definition ID via blind cascade ───
        const defId = resolveDefId(f)
        console.log(`[PhantomPanel] 🔍 FETCH path | fixture: "${f.name}" | defId: ${defId} | keys: [definitionId=${f?.definitionId}, profileId=${f?.profileId}, fixtureDefId=${f?.fixtureDefId}]`)
        
        if (!defId) {
          console.warn(`[PhantomPanel] ⚠️ NO definition ID for fixture "${f.name}" (id: ${f.id}) — skipping`)
          continue
        }
        
        // Check cache first
        const cached = cacheRef.current.get(defId)
        if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
          console.log(`[PhantomPanel] ✅ CACHE HIT for "${defId}" → ${cached.phantomChannels.length} phantoms`)
          for (const ch of cached.phantomChannels) {
            if (!allPhantomChannels.some(existing => existing.channelIndex === ch.channelIndex)) {
              allPhantomChannels.push(ch)
            }
          }
          continue
        }
        
        // IPC fetch — the real source of truth
        try {
          const result = await window.lux?.getFixtureDefinition?.(defId)
          console.log(`[PhantomPanel] 📡 IPC result for "${defId}":`, result?.success ? `${result.definition?.channels?.length || 0} channels` : `FAILED: ${result?.error || 'unknown'}`)
          
          if (!result?.success || !result.definition?.channels) {
            console.warn(`[PhantomPanel] ❌ getFixtureDefinition("${defId}") → no channels. Fixture "${f.name}" won't show extras.`)
            // Cache the miss to avoid hammering IPC
            cacheRef.current.set(defId, {
              fixtureId: f.id,
              profileId: defId,
              phantomChannels: [],
              timestamp: now,
            })
            continue
          }
          
          const phantoms = result.definition.channels
            .filter((ch: any) => PHANTOM_CHANNEL_TYPES.has(ch.type))
            .map((ch: any): PhantomChannel => ({
              channelIndex: ch.index,
              label: ch.customName || ch.name || ch.type.toUpperCase(),
              type: ch.type,
              defaultValue: ch.defaultValue ?? 0,
              continuousRotation: ch.continuousRotation === true,
            }))
          
          console.log(`[PhantomPanel] 🎯 Resolved ${phantoms.length} phantom channels for "${f.name}" via IPC`)
          
          // Cache it
          cacheRef.current.set(defId, {
            fixtureId: f.id,
            profileId: defId,
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
          console.warn(`[PhantomPanel] 💥 IPC error for "${defId}":`, err)
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
    
    resolvePhantomChannels()
    
    return () => { cancelled = true }
  }, [isExpanded, selectedFixtures, resolveDefId, extractInlinePhantoms])
  
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
  // 🔥 WAVE 2084.6: TACTICAL LOGGING — Render gate diagnostic
  // ═══════════════════════════════════════════════════════════════════
  
  // Log every evaluation so we can see in Electron console WHY it aborts
  if (selectedFixtures.length > 0) {
    const fixtureDebug = selectedFixtures.map((f: any) => ({
      name: f?.name,
      id: f?.id,
      type: f?.type,
      profileId: f?.profileId,
      definitionId: f?.definitionId,
      fixtureDefId: f?.fixtureDefId,
      hasChannels: Array.isArray(f?.channels) && f.channels.length > 0,
      channelCount: Array.isArray(f?.channels) ? f.channels.length : 0,
    }))
    console.log(`[PhantomPanel] 🔎 Evaluating ${selectedFixtures.length} fixtures | mayHavePhantom=${mayHavePhantomChannels} | phantomChannels=${phantomChannels.length}`, fixtureDebug)
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // RENDER GATE — Always show for selected fixtures, content decides
  // ═══════════════════════════════════════════════════════════════════
  
  const shouldRender = selectedIds.length > 0
  
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
