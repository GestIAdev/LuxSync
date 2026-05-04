/**
 * 🔥 WAVE 2084.10: EXTRAS SECTION — Phantom Channel Control
 * 
 * La sección de canales phantom: solo aparece cuando hay fixtures con canales
 * tipo custom, macro, rotation, speed o control — los "Ingenios" de WAVE 2084.
 * 
 * Arquitectura (3 paths de resolución, en orden de prioridad):
 * - PATH 1: INLINE — channels[] embebido en el FixtureV2 del stageStore
 * - PATH 1.5: LIBRARY STORE — libraryStore en memoria (fixtures de usuario)
 *             WAVE 2463: Este path cubre fans/fog/ingenios que fueron añadidos
 *             al show sin pasar por Forge, o cuyo channels[] no fue embebido.
 *             Cero IPC, cero latencia — los datos ya están en RAM.
 * - PATH 2: IPC — fallback a getFixtureDefinition() para casos legacy
 * - Cache de definiciones por defId (no IPC repetitivo)
 * - Conecta al MasterArbiter via window.lux.arbiter.setManual()
 * 
 * ANTI-SIMULACIÓN: Toda función es real, determinista, sin mocks.
 */

import React, { useCallback, useState, useMemo, useEffect, useRef } from 'react'
import { useSelectedArray } from '../../../stores/selectionStore'
import { useStageStore } from '../../../stores/stageStore'
import { useLibraryStore } from '../../../stores/libraryStore'
import { useProgrammerStore } from '../../../stores/programmerStore'
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
  
  // 🔥 WAVE 2084.8 + 2084.9: STATE BYPASS — Read FixtureV2 from stageStore
  // Blind cascade: state.fixtures (synced) > state.showFile.fixtures (raw) > []
  const stageFixtures = useStageStore(state => {
    if (state.fixtures && state.fixtures.length > 0) return state.fixtures
    if (state.showFile?.fixtures && state.showFile.fixtures.length > 0) return state.showFile.fixtures
    return []
  })
  
  // 🔥 WAVE 2463: PATH 1.5 — Library store in RAM (fans, ingenios, user fixtures)
  const getLibraryFixtureById = useLibraryStore(state => state.getFixtureById)
  
  // Phantom channel values: Map<channelIndex, dmxValue>
  const [channelValues, setChannelValues] = useState<Map<number, number>>(new Map())
  
  // Resolved phantom channels
  const [phantomChannels, setPhantomChannels] = useState<PhantomChannel[]>([])
  
  // Loading state for IPC fetch (only used as fallback)
  const [isLoading, setIsLoading] = useState(false)
  
  // Definition cache: defId → CachedPhantomDef
  const cacheRef = useRef<Map<string, CachedPhantomDef>>(new Map())
  
  // WAVE 3502: Track which channelIndices have been explicitly set by the operator.
  // This prevents hasOverride snap-to-defaults from overwriting programmed values.
  const operatorSetRef = useRef<Set<number>>(new Set())
  
  // ═══════════════════════════════════════════════════════════════════
  // FIXTURE RESOLUTION — Cross-reference selected IDs with stage DNA
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * 🔥 WAVE 2084.8: THE STATE BYPASS
   * Match selectedIds (from live selection) against stageStore.fixtures (static DNA).
   * This gives us FixtureV2 objects WITH channels[] embedded.
   */
  const selectedFixtures = useMemo(() => {
    return selectedIds
      .map(id => stageFixtures.find((sf: { id: string }) => sf.id === id))
      .filter(Boolean)
  }, [selectedIds, stageFixtures])
  
  /**
   * 🔥 WAVE 2084.8: Blind cascade to resolve the fixture definition ID.
   * Used ONLY as fallback when channels[] is not embedded in the FixtureV2.
   * Priority: profileId > definitionId > fixtureDefId
   */
  const resolveDefId = useCallback((f: any): string | null => {
    return f?.profileId || f?.definitionId || f?.fixtureDefId || null
  }, [])
  
  /**
   * Extract phantom channels from an embedded channels array.
   * This is the PRIMARY path — channels come from stageStore (FixtureV2).
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
   * 🔥 WAVE 2084.8 + 2463: Check if any selected fixture has phantom channels.
   * 3 paths: inline channels > libraryStore in RAM > defId for IPC fallback.
   * WAVE 2463: fans/ingenios sin channels inline ahora detectados via libraryStore.
   */
  const mayHavePhantomChannels = useMemo(() => {
    return selectedFixtures.some((f: any) => {
      // PATH 1: Check embedded channels directly
      if (Array.isArray(f?.channels) && f.channels.length > 0) {
        return f.channels.some((ch: any) => PHANTOM_CHANNEL_TYPES.has(ch?.type))
      }
      // PATH 1.5: Check libraryStore in RAM — zero IPC
      const defId = resolveDefId(f)
      if (defId) {
        const libraryEntry = getLibraryFixtureById(defId)
        if (Array.isArray(libraryEntry?.channels) && libraryEntry!.channels.length > 0) {
          return (libraryEntry!.channels as any[]).some((ch: any) => PHANTOM_CHANNEL_TYPES.has(ch?.type))
        }
      }
      // PATH 2: Has a definition ID we can query via IPC
      return !!defId
    })
  }, [selectedFixtures, resolveDefId, getLibraryFixtureById])
  
  // ═══════════════════════════════════════════════════════════════════
  // CHANNEL RESOLUTION — Inline first, IPC only when needed
  // ═══════════════════════════════════════════════════════════════════
  
  // WAVE 3503: Stable ref to selectedFixtures — accessed in the resolve effect
  // without putting it in deps (stageFixtures updates every render cycle and
  // would cause channelValues to be wiped on every HAL tick).
  const selectedFixturesRef = useRef(selectedFixtures)
  useEffect(() => {
    selectedFixturesRef.current = selectedFixtures
  }, [selectedFixtures])

  // WAVE 3502: Resolve phantom channels whenever the fixture SELECTION changes —
  // NOT gated by isExpanded. Gating on isExpanded caused re-resolution every time
  // the accordion opened/closed, which triggered the snap-to-defaults chain.
  //
  // WAVE 3502.1: Reset is INTEGRATED here (runs before the async fetch) so it
  // always precedes the resolution — never after it. A separate reset useEffect
  // created an inverted execution order: resolve fired first, then reset wiped it.
  //
  // WAVE 3503: Dep is JSON.stringify(selectedIds) NOT selectedFixtures. The fixture
  // objects (stageFixtures) update on every HAL tick which creates new array refs,
  // which would reset channelValues every frame. We only need to re-resolve when
  // the set of selected fixture IDs actually changes (user picks different fixtures).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Always reset when selection changes, even if empty
    setPhantomChannels([])
    setChannelValues(new Map())
    operatorSetRef.current.clear()

    const currentFixtures = selectedFixturesRef.current
    if (currentFixtures.length === 0) {
      return
    }
    
    let cancelled = false
    
    const resolvePhantomChannels = async () => {
      setIsLoading(true)
      const allPhantomChannels: PhantomChannel[] = []
      const now = Date.now()
      
      for (const fixture of currentFixtures) {
        if (cancelled) break
        const f = fixture as any
        
        // ─── PATH 1: INLINE — channels[] embedded in the fixture object ───
        if (Array.isArray(f?.channels) && f.channels.length > 0) {
          const inlinePhantoms = extractInlinePhantoms(f.channels)
          for (const ch of inlinePhantoms) {
            if (!allPhantomChannels.some(existing => existing.channelIndex === ch.channelIndex)) {
              allPhantomChannels.push(ch)
            }
          }
          continue // No IPC needed for this fixture
        }
        
        // ─── PATH 1.5: LIBRARY STORE — in-memory, zero IPC ─────────────
        // WAVE 2463: Para fans, fog, y cualquier ingenio añadido sin Forge,
        // sus channels[] viven en libraryStore (cargado al boot). Cero latencia.
        const defId = resolveDefId(f)
        
        if (defId) {
          const libraryEntry = getLibraryFixtureById(defId)
          if (libraryEntry && Array.isArray(libraryEntry.channels) && libraryEntry.channels.length > 0) {
            const libraryPhantoms = extractInlinePhantoms(libraryEntry.channels as any[])
            if (libraryPhantoms.length > 0) {
              for (const ch of libraryPhantoms) {
                if (!allPhantomChannels.some(existing => existing.channelIndex === ch.channelIndex)) {
                  allPhantomChannels.push(ch)
                }
              }
              console.log(`[PhantomPanel] 📚 PATH 1.5: Library hit for "${f.name}" → ${libraryPhantoms.length} phantom channels`)
              continue
            }
          }
        }
        
        if (!defId) {
          console.warn(`[PhantomPanel] ⚠️ NO definition ID for fixture "${f.name}" (id: ${f.id}) — skipping`)
          continue
        }
        
        // Check cache first
        const cached = cacheRef.current.get(defId)
        if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
          for (const ch of cached.phantomChannels) {
            if (!allPhantomChannels.some(existing => existing.channelIndex === ch.channelIndex)) {
              allPhantomChannels.push(ch)
            }
          }
          continue
        }
        
        // IPC fetch — fallback for legacy fixtures without library entry
        try {
          const result = await window.lux?.getFixtureDefinition?.(defId)
          
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
        
        // Initialize values with defaults — but ONLY for channels not yet in state
        // (preserves any values the operator already set before resolution finished)
        setChannelValues(prev => {
          const merged = new Map(prev)
          for (const ch of allPhantomChannels) {
            if (!merged.has(ch.channelIndex)) {
              merged.set(ch.channelIndex, ch.defaultValue)
            }
          }
          return merged
        })
        setIsLoading(false)
      }
    }
    
    resolvePhantomChannels()
    
    return () => { cancelled = true }
    // WAVE 3503: JSON.stringify(selectedIds) — solo re-resolve cuando cambia la selección,
    // NO cuando cambian los objetos de selectedFixtures (que se recrean en cada tick del HAL).
  }, [JSON.stringify(selectedIds)])  // eslint-disable-line react-hooks/exhaustive-deps
  
  // WAVE 3502: HYDRATION RESET guarded — only snap channels the operator has NOT explicitly
  // programmed. Channels in operatorSetRef survive the hasOverride transition.
  // This prevents accordion close/open cycles from destroying programmed values.
  useEffect(() => {
    if (!hasOverride && phantomChannels.length > 0) {
      setChannelValues(prev => {
        const next = new Map(prev)
        for (const ch of phantomChannels) {
          if (!operatorSetRef.current.has(ch.channelIndex)) {
            next.set(ch.channelIndex, ch.defaultValue)
          }
        }
        return next
      })
    }
  }, [hasOverride, phantomChannels])
  
  // ═══════════════════════════════════════════════════════════════════
  // HANDLERS — Connect to Arbiter
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * Send a phantom channel value to the store (WAVE 4529)
   */
  const handleChannelChange = useCallback((channelIndex: number, value: number, channelType: string, channelLabel: string) => {
    // WAVE 3502: Mark this channel as operator-programmed so hydration resets don't clobber it
    operatorSetRef.current.add(channelIndex)
    
    setChannelValues(prev => {
      const next = new Map(prev)
      next.set(channelIndex, value)
      return next
    })
    
    onOverrideChange(true)
    
    // WAVE 3503: For 'custom'/'unknown' channels, key by NAME not by type.
    const isNameKeyed = channelType === 'custom' || channelType === 'unknown'
    const channelKey = isNameKeyed ? channelLabel : channelType
    
    useProgrammerStore.getState().setExtra(channelKey, value)
  }, [onOverrideChange])
  
  /**
   * Release all phantom channels back to AI
   * WAVE 4529: Vía programmerStore.
   */
  const handleRelease = useCallback(() => {
    // WAVE 3502: On explicit release, clear the operator set so defaults can take over
    operatorSetRef.current.clear()
    onOverrideChange(false)
    useProgrammerStore.getState().releaseExtras()
  }, [onOverrideChange])
  
  // ═══════════════════════════════════════════════════════════════════
  // FORMAT HELPERS
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
    if (value < 126) return `CW ${Math.round((1 - value / 127) * 100)}%`
    if (value > 130) return `CCW ${Math.round(((value - 128) / 127) * 100)}%`
    return 'STOP'
  }
  
  /**
   * 🔥 WAVE 2084.12: CYBERPUNK COLOR CODING
   * Each phantom channel type gets its own neon identity.
   * Returns [hex, r, g, b] for CSS variable injection.
   */
  const getPhantomColorRGB = (type: string): [string, number, number, number] => {
    switch (type) {
      case 'rotation':
      case 'speed':
        return ['#f59e0b', 245, 158, 11]  // Amber/gold — kinetic energy
      case 'custom':
        return ['#d946ef', 217, 70, 239]   // Magenta/fuchsia — raw DNA
      case 'macro':
      case 'control':
        return ['#22c55e', 34, 197, 94]    // Neon green — system command
      default:
        return ['#22d3ee', 34, 211, 238]   // Cyan — unknown phantom
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════
  
  // Don't render if no selection
  if (selectedIds.length === 0) return null
  
  // Don't render if no fixture has phantom-capable channels or definition
  if (!mayHavePhantomChannels && phantomChannels.length === 0) return null
  
  return (
    <div className="programmer-section extras-section">
      {/* Accordion header */}
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
                const [hex, r, g, b] = getPhantomColorRGB(ch.type)
                return (
                  <div 
                    key={ch.channelIndex} 
                    className={`phantom-channel ${ch.continuousRotation ? 'rotation-channel' : ''}`}
                    style={{
                      '--pc': hex,
                      '--pc-border': `rgba(${r},${g},${b},0.4)`,
                      '--pc-hover': `rgba(${r},${g},${b},0.25)`,
                      '--pc-glow': `rgba(${r},${g},${b},0.12)`,
                      '--pc-label': `rgba(${r},${g},${b},0.85)`,
                      '--pc-track': `rgba(${r},${g},${b},0.1)`,
                      '--pc-shadow': `rgba(${r},${g},${b},0.6)`,
                      '--pc-shadow-active': `rgba(${r},${g},${b},0.8)`,
                    } as React.CSSProperties}
                  >
                    <div className="phantom-channel-header">
                      <span className="phantom-channel-label">{ch.label}</span>
                      <span className="phantom-channel-value">, ch.label
                        {formatValue(value, ch.continuousRotation)}
                      </span>
                    </div>
                    <input
                      type="range"
                      className="phantom-slider"
                      min={0}
                      max={255}
                      value={value}
                      onChange={(e) => handleChannelChange(ch.channelIndex, parseInt(e.target.value, 10), ch.type, ch.label)}
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
