/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ CUSTOM FX DOCK — WAVE 7109: PHOSPHOR NOIR / NEON BLOOM
 *
 * FX Arsenal with paginated grid, multi-zone energy filters, search,
 * DNA genome LEDs, and MIDI Learn integration.
 *
 * FEATURES:
 * - Search input for clip name filtering
 * - Multi-zone energy filters (Peak, Intense, Active, Gentle, Ambient, Valley, Silence)
 * - Paginated grid: 2 rows × 8-10 pads per page, no horizontal scroll
 * - DNA genome LEDs (Aggression, Chaos, Organicity) on each pad
 * - MIDI Learn via data-midi-id attributes
 * - Drag to Timeline (same payload as library)
 * - Click for record mode or preview
 * - [+] NEW button opens Hephaestus
 *
 * @module chronos/ui/arsenal/CustomFXDock
 */

import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react'
import type { DragPayload } from '../../core/TimelineClip'
import { serializeDragPayload } from '../../core/TimelineClip'
import type { HephAutomationClipV3 } from '../../../core/hephaestus/types'
import type { EnergyZone, CognitiveDNA } from '../../../core/arsenal/lfxTypes'
import { getChronosRecorder } from '../../core/ChronosRecorder'
import { useMidiMapStore } from '../../../stores/midiMapStore'
import { useFxFavoritesStore } from '../../../stores/fxFavoritesStore'
import {
  PeakZoneIcon,
  IntenseZoneIcon,
  ActiveZoneIcon,
  GentleZoneIcon,
  AmbientZoneIcon,
  ValleyZoneIcon,
  SilenceZoneIcon,
  StarIcon,
} from '../../../components/icons/LuxIcons'
import './CustomFXDock.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Metadata from HephFileIO.listClips() */
interface HephClipMetadata {
  id: string
  name: string
  author: string
  category: string
  tags: string[]
  durationMs: number
  effectType: string
  paramCount: number
  filePath: string
  modifiedAt: number
}

// ═══════════════════════════════════════════════════════════════════════════
// ENERGY ZONE CONFIG — WAVE 7109: Neon Bloom zone colors
// ═══════════════════════════════════════════════════════════════════════════

const ZONE_ORDER: EnergyZone[] = ['peak', 'intense', 'active', 'gentle', 'ambient', 'valley', 'silence']

const ZONE_COLORS: Record<EnergyZone, string> = {
  peak:    '#ff0055',
  intense: '#ff6b00',
  active:  '#ffcc00',
  gentle:  '#00ffcc',
  ambient: '#33ddaa',
  valley:  '#9933ff',
  silence: '#0044ff',
}

const ZONE_LABELS: Record<EnergyZone, string> = {
  peak:    'PEAK',
  intense: 'INTENSE',
  active:  'ACTIVE',
  gentle:  'GENTLE',
  ambient: 'AMBIENT',
  valley:  'VALLEY',
  silence: 'SILENCE',
}

const ZONE_ICONS: Record<EnergyZone, React.FC<{ size?: number; color?: string; className?: string }>> = {
  peak:    PeakZoneIcon,
  intense: IntenseZoneIcon,
  active:  ActiveZoneIcon,
  gentle:  GentleZoneIcon,
  ambient: AmbientZoneIcon,
  valley:  ValleyZoneIcon,
  silence: SilenceZoneIcon,
}

/** All energy zones in order for range checking */
const ALL_ZONES: EnergyZone[] = ['silence', 'valley', 'ambient', 'gentle', 'active', 'intense', 'peak']

function getClipPrimaryZone(dna: CognitiveDNA | undefined): EnergyZone {
  if (!dna) return 'active'
  const minIdx = ALL_ZONES.indexOf(dna.energyZone.min)
  const maxIdx = ALL_ZONES.indexOf(dna.energyZone.max)
  const midIdx = Math.floor((minIdx + maxIdx) / 2)
  return ALL_ZONES[midIdx] ?? 'active'
}

/** Check if a clip's energy zone range overlaps with any of the selected zones */
function clipMatchesZones(dna: CognitiveDNA | undefined, selectedZones: Set<EnergyZone>): boolean {
  if (!dna || selectedZones.size === 0) return true
  const minIdx = ALL_ZONES.indexOf(dna.energyZone.min)
  const maxIdx = ALL_ZONES.indexOf(dna.energyZone.max)
  for (const zone of selectedZones) {
    const zoneIdx = ALL_ZONES.indexOf(zone)
    if (zoneIdx >= minIdx && zoneIdx <= maxIdx) return true
  }
  return false
}

/** Get the primary energy zone color for a clip based on its DNA */
function getClipZoneColor(dna: CognitiveDNA | undefined): string {
  if (!dna) return '#a78bfa'
  const maxIdx = ALL_ZONES.indexOf(dna.energyZone.max)
  const minIdx = ALL_ZONES.indexOf(dna.energyZone.min)
  const midIdx = Math.floor((minIdx + maxIdx) / 2)
  const primaryZone = ALL_ZONES[midIdx] ?? 'active'
  return ZONE_COLORS[primaryZone] ?? '#a78bfa'
}

/** Pagination config */
const PADS_PER_ROW = 9
const ROWS_PER_PAGE = 2
const PADS_PER_PAGE = PADS_PER_ROW * ROWS_PER_PAGE

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM FX PAD - Individual .lfx clip button
// ═══════════════════════════════════════════════════════════════════════════

interface CustomFXPadProps {
  clip: HephClipMetadata
  cachedClip?: HephAutomationClipV3
  isRecording: boolean
  isMidiListening: boolean
  isMidiMapped: boolean
  isFavorite: boolean
  onDragStart?: (payload: DragPayload) => void
  onDragEnd?: () => void
  onClick?: (clip: HephClipMetadata) => void
  onMidiClick?: (controlId: string) => void
  onToggleFavorite?: (filePath: string) => void
}

const CustomFXPad: React.FC<CustomFXPadProps> = memo(({
  clip,
  cachedClip,
  isRecording,
  isMidiListening,
  isMidiMapped,
  isFavorite,
  onDragStart,
  onDragEnd,
  onClick,
  onMidiClick,
  onToggleFavorite,
}) => {
  const dna = cachedClip?.cognitiveDNA
  const neonColor = getClipZoneColor(dna)
  const primaryZone = getClipPrimaryZone(dna)
  const ZoneIcon = ZONE_ICONS[primaryZone] ?? ActiveZoneIcon
  const midiControlId = `fx-${clip.id}`
  const genome = dna?.genome

  const handleStarClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleFavorite?.(clip.filePath)
  }, [clip.filePath, onToggleFavorite])
  
  const handleDragStart = useCallback((e: React.DragEvent) => {
    const payload: DragPayload = {
      source: 'hephaestus',
      clipType: 'fx',
      subType: cachedClip?.effectType || clip.effectType,
      hephFilePath: clip.filePath,
      defaultDurationMs: clip.durationMs,
      name: clip.name,
      hephClipSerialized: cachedClip,
      effectType: cachedClip?.effectType || clip.effectType,
      zones: cachedClip?.spatialZones as string[] | undefined,
      priority: cachedClip?.priority,
    }
    
    const serialized = serializeDragPayload(payload)
    e.dataTransfer.setData('application/luxsync-fx', serialized)
    e.dataTransfer.setData('application/luxsync-clip', serialized)
    e.dataTransfer.setData('application/luxsync-heph', serialized)
    const zonesStr = payload.zones?.join(',') ?? ''
    e.dataTransfer.setData(`application/luxsync-zones:${zonesStr}`, '')
    e.dataTransfer.effectAllowed = 'copyMove'
    
    const ghost = document.createElement('div')
    ghost.className = 'custom-fx-drag-ghost'
    ghost.textContent = `\u25C6 ${clip.name}`
    ghost.style.backgroundColor = neonColor
    ghost.style.position = 'fixed'
    ghost.style.top = '-100px'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    setTimeout(() => document.body.removeChild(ghost), 0)
    
    if (cachedClip) {
      const trackCount = cachedClip.tracks?.length || 0
      console.log(`[CustomFXDock] 💎 Diamond drag: ${clip.name} [${trackCount} tracks, mixBus=${cachedClip.mixBus || 'none'}]`)
    } else {
      console.warn(`[CustomFXDock] ⚠️ Drag without Diamond data: ${clip.name}`)
    }
    
    onDragStart?.(payload)
  }, [clip, cachedClip, neonColor, onDragStart])
  
  const handleClick = useCallback(() => {
    if (isRecording && cachedClip) {
      const recorder = getChronosRecorder()
      recorder.recordFX(
        cachedClip,
        clip.filePath,
        clip.name,
        clip.durationMs,
        cachedClip.spatialZones as string[] | undefined,
        cachedClip.priority,
      )
    } else if (isMidiListening) {
      onMidiClick?.(midiControlId)
    } else {
      onClick?.(clip)
    }
  }, [isRecording, isMidiListening, clip, cachedClip, onClick, onMidiClick, midiControlId])
  
  return (
    <div
      className={`custom-fx-pad ${isRecording ? 'rec-mode' : ''} ${isMidiListening ? 'midi-listening' : ''} ${isMidiMapped ? 'midi-mapped' : ''}`}
      draggable={!isRecording}
      onDragStart={isRecording ? undefined : handleDragStart}
      onDragEnd={isRecording ? undefined : onDragEnd}
      onClick={handleClick}
      data-midi-id={midiControlId}
      style={{ '--fx-neon': neonColor } as React.CSSProperties}
      title={`${clip.name} (${clip.author})\n${clip.paramCount} params • ${Math.round(clip.durationMs / 1000)}s`}
    >
      {isMidiMapped && <span className="pad-midi-dot" />}
      <button
        className={`pad-star-btn ${isFavorite ? 'active' : ''}`}
        onClick={handleStarClick}
        title={isFavorite ? 'Remove from FAVS' : 'Add to FAVS'}
      >
        <StarIcon size={12} color={isFavorite ? '#fbbf24' : 'rgba(255,255,255,0.25)'} filled={isFavorite} />
      </button>
      <span className="custom-fx-icon">
        <ZoneIcon size={22} color={neonColor} />
      </span>
      <span className="custom-fx-name">{clip.name}</span>
      {genome && (
        <div className="pad-dna-leds">
          <span className="dna-led dna-aggression" style={{ opacity: genome.aggression }} title={`AGG ${Math.round(genome.aggression * 100)}%`} />
          <span className="dna-led dna-chaos" style={{ opacity: genome.chaos }} title={`CHS ${Math.round(genome.chaos * 100)}%`} />
          <span className="dna-led dna-organicity" style={{ opacity: genome.organicity }} title={`ORG ${Math.round(genome.organicity * 100)}%`} />
        </div>
      )}
      <span className="custom-fx-params">{clip.paramCount}P</span>
    </div>
  )
})

CustomFXPad.displayName = 'CustomFXPad'

// ═══════════════════════════════════════════════════════════════════════════
// NEW FX BUTTON - Opens Hephaestus
// ═══════════════════════════════════════════════════════════════════════════

const NewFXButton: React.FC = memo(() => {
  const handleClick = useCallback(() => {
    // 🔥 Navigate to Hephaestus view
    // Using window event since we're in Chronos context
    window.dispatchEvent(new CustomEvent('luxsync:navigate', {
      detail: { view: 'hephaestus' }
    }))
  }, [])
  
  return (
    <div
      className="custom-fx-pad new-fx-button"
      onClick={handleClick}
      title="Create new custom effect in Hephaestus"
    >
      <span className="custom-fx-icon">+</span>
      <span className="custom-fx-name">NEW</span>
    </div>
  )
})

NewFXButton.displayName = 'NewFXButton'

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export interface CustomFXDockProps {
  isRecording?: boolean
  onDragStart?: (payload: DragPayload) => void
  onDragEnd?: () => void
}

type ArsenalView = 'all' | 'favs'

export const CustomFXDock: React.FC<CustomFXDockProps> = memo(({
  isRecording = false,
  onDragStart,
  onDragEnd,
}) => {
  const [clips, setClips] = useState<HephClipMetadata[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedZones, setSelectedZones] = useState<Set<EnergyZone>>(new Set())
  const [currentPage, setCurrentPage] = useState(0)
  const [view, setView] = useState<ArsenalView>('all')
  
  const clipCacheRef = useRef<Map<string, HephAutomationClipV3>>(new Map())
  
  const learnMode = useMidiMapStore(s => s.learnMode)
  const listeningControl = useMidiMapStore(s => s.listeningControl)
  const mappings = useMidiMapStore(s => s.mappings)
  const startListening = useMidiMapStore(s => s.startListening)
  const favorites = useFxFavoritesStore(s => s.favorites)
  const toggleFavorite = useFxFavoritesStore(s => s.toggleFavorite)
  
  const handleMidiClick = useCallback((controlId: string) => {
    startListening(controlId)
  }, [startListening])
  
  const toggleZone = useCallback((zone: EnergyZone) => {
    setSelectedZones(prev => {
      const next = new Set(prev)
      if (next.has(zone)) next.delete(zone)
      else next.add(zone)
      return next
    })
    setCurrentPage(0)
  }, [])
  
  useEffect(() => {
    const loadClips = async () => {
      if (!window.luxsync?.hephaestus?.list) {
        console.warn('[CustomFXDock] Hephaestus IPC not available')
        setIsLoading(false)
        return
      }
      
      try {
        const result = await window.luxsync.hephaestus.list()
        if (result.success && result.clips) {
          setClips(result.clips)
          console.log(`[CustomFXDock] Loaded ${result.clips.length} custom FX`)
          
          if (window.luxsync?.hephaestus?.load) {
            for (const item of result.clips as HephClipMetadata[]) {
              if (!clipCacheRef.current.has(item.filePath)) {
                try {
                  const loadResult = await window.luxsync.hephaestus.load(item.filePath)
                  if (loadResult.success && loadResult.clip) {
                    clipCacheRef.current.set(item.filePath, loadResult.clip as HephAutomationClipV3)
                  }
                } catch (e) {
                  console.warn(`[CustomFXDock] 💎 Cache miss for ${item.name}:`, e)
                }
              }
            }
            console.log(`[CustomFXDock] 💎 Diamond cache loaded: ${clipCacheRef.current.size} clips`)
          }
        }
      } catch (error) {
        console.error('[CustomFXDock] Failed to load clips:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadClips()
    
    const handleRefresh = () => loadClips()
    window.addEventListener('luxsync:heph-library-changed', handleRefresh)
    return () => window.removeEventListener('luxsync:heph-library-changed', handleRefresh)
  }, [])
  
  const filteredClips = useMemo(() => {
    let result = clips
    
    if (view === 'favs') {
      result = result.filter(c => favorites.has(c.filePath))
    }
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.tags.some(t => t.toLowerCase().includes(q)) ||
        c.category.toLowerCase().includes(q)
      )
    }
    
    if (selectedZones.size > 0) {
      result = result.filter(clip => {
        const cached = clipCacheRef.current.get(clip.filePath)
        const dna = cached?.cognitiveDNA
        if (!dna) return false
        return clipMatchesZones(dna, selectedZones)
      })
    }
    
    return result
  }, [clips, searchQuery, selectedZones, view, favorites])
  
  const totalPages = Math.max(1, Math.ceil(filteredClips.length / PADS_PER_PAGE))
  const safePage = Math.min(currentPage, totalPages - 1)
  const pageStart = safePage * PADS_PER_PAGE
  const pageClips = filteredClips.slice(pageStart, pageStart + PADS_PER_PAGE)
  
  const goToPrev = useCallback(() => setCurrentPage(p => Math.max(0, p - 1)), [])
  const goToNext = useCallback(() => setCurrentPage(p => Math.min(totalPages - 1, p + 1)), [totalPages])
  
  return (
    <div className="custom-fx-dock">
      <div className="custom-fx-header">
        <div className="fx-view-tabs">
          <button
            className={`fx-view-tab ${view === 'all' ? 'active' : ''}`}
            onClick={() => { setView('all'); setCurrentPage(0) }}
          >
            ALL
          </button>
          <button
            className={`fx-view-tab ${view === 'favs' ? 'active' : ''}`}
            onClick={() => { setView('favs'); setCurrentPage(0) }}
          >
            <StarIcon size={11} color={view === 'favs' ? '#fbbf24' : 'rgba(255,255,255,0.4)'} filled={view === 'favs'} />
            FAVS
          </button>
        </div>
        
        <input
          className="fx-search-input"
          type="text"
          placeholder="Search clips..."
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setCurrentPage(0) }}
        />
        
        <div className="zone-filters">
          {ZONE_ORDER.map(zone => {
            const ZoneIcon = ZONE_ICONS[zone]
            return (
              <button
                key={zone}
                className={`zone-filter-pill ${selectedZones.has(zone) ? 'active' : ''}`}
                onClick={() => toggleZone(zone)}
                style={{ '--zone-color': ZONE_COLORS[zone] } as React.CSSProperties}
                title={ZONE_LABELS[zone]}
              >
                <ZoneIcon size={11} color={ZONE_COLORS[zone]} />
              </button>
            )
          })}
        </div>
      </div>
      
      <div className="fx-arsenal-body">
        {isLoading ? (
          <div className="custom-fx-loading">
            <span>⏳</span>
          </div>
        ) : (
          <>
            <div className="fx-pagination-row">
              <button
                className="pag-arrow pag-arrow-left"
                onClick={goToPrev}
                disabled={safePage === 0}
                title="Previous page"
              >
                {'‹'}
              </button>
              <div className="fx-grid-paginated">
                {pageClips.map(clip => (
                  <CustomFXPad
                    key={clip.id}
                    clip={clip}
                    cachedClip={clipCacheRef.current.get(clip.filePath)}
                    isRecording={isRecording}
                    isMidiListening={learnMode && listeningControl === `fx-${clip.id}`}
                    isMidiMapped={!!mappings[`fx-${clip.id}`]}
                    isFavorite={favorites.has(clip.filePath)}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onMidiClick={handleMidiClick}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
                
                {pageClips.length === 0 && !isLoading && (
                  <div className="custom-fx-empty">
                    <span>{view === 'favs' ? 'No favorites yet — star clips to add them here' : 'No clips match filters'}</span>
                  </div>
                )}
              </div>
              <button
                className="pag-arrow pag-arrow-right"
                onClick={goToNext}
                disabled={safePage >= totalPages - 1}
                title="Next page"
              >
                {'›'}
              </button>
            </div>
            
            <div className="fx-pagination">
              <span className="pag-info">PAGE {safePage + 1}/{totalPages}</span>
              <NewFXButton />
            </div>
          </>
        )}
      </div>
    </div>
  )
})

CustomFXDock.displayName = 'CustomFXDock'

export default CustomFXDock
