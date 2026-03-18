/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ HEPHAESTUS VIEW - WAVE 2030.8: THE GOD FORGE
 * First-class View for FX Curve Automation Editor
 * 
 * Layout Architecture:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                    HEADER BAR (56px)                                    │
 * │  ⚒️ HEPHAESTUS STUDIO  │  Clip Name  │  Duration  │  [Save] [New]     │
 * ├──────────┬──────────────────────────────────────────────────────────────┤
 * │          │                                                              │
 * │ LIBRARY  │              CURVE EDITOR (SVG)                             │
 * │ PARAM    │              Full responsive canvas                          │
 * │ LANES    │              Bezier curves + keyframes                       │
 * │ (200px)  │              Grid + snap + zoom/pan                          │
 * │          │                                                              │
 * ├──────────┴──────────────────────────────────────────────────────────────┤
 * │                    TOOLBAR (48px)                                       │
 * │  [Interp: Hold|Linear|Bezier]  [Preset: ▼]  [Mode: Abs|Rel|Add]       │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * WAVE 2030.6: Search, Categories, Drag & Drop
 * WAVE 2030.8: Parameter Management, New Clip Modal, Curve Templates
 * 
 * @module views/HephaestusView
 * @version WAVE 2030.8
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { CurveEditor } from './CurveEditor'
import { ParameterLane, PARAM_META, ALL_PARAM_IDS, PARAM_CATEGORIES } from './ParameterLane'
import type { ParamCategory } from './ParameterLane'
import { HephaestusToolbar } from './HephaestusToolbar'
import { NewClipModal } from './NewClipModal'
import { ZoneSelector } from './ZoneSelector'
import { createDummyClip } from './dummyData'
import { getCategoryIcon, generateShapeInWindow } from './curveTemplates'
import { HephRadar } from './HephRadar'
import { PhaseControls } from './PhaseControls'
import { useHephPreview } from './useHephPreview'
import { useTemporalStore } from './useTemporalStore'
import { useStageStore, selectFixtures } from '../../../stores/stageStore'
import { HephLogoIcon } from '../../icons/LuxIcons'
import type { 
  HephCurve, 
  HephParamId, 
  HephInterpolation, 
  HephCurveMode, 
  HephAutomationClip,
  HephAutomationClipSerialized,
  HephKeyframe,
  PhaseConfig 
} from '../../../core/hephaestus/types'
import type { EffectZone } from '../../../core/effects/types'
import { serializeHephClip, deserializeHephClip } from '../../../core/hephaestus/types'
// ⚒️ WAVE 2044: Navigation store for Chronos → Hephaestus bridge (THE HANDOFF)
import { useNavigationStore } from '../../../stores/navigationStore'
// ⚒️ WAVE 2044.3: Audio store for BPM injection (SYNAPSE REPAIR)
import { useAudioStore } from '../../../stores/audioStore'
import './HephaestusView.css'

// ═══════════════════════════════════════════════════════════════════════════
// ⚒️ WAVE 2043: Shared plot value extraction (mirrored from CurveEditor)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract the plottable numeric value from a keyframe value.
 * For color curves: uses hue (0-360) normalized to 0-1.
 * For numeric curves: returns the value directly.
 */
function getPlotValue(value: number | { h: number; s: number; l: number }, valueType: 'number' | 'color'): number {
  if (valueType === 'color' && typeof value === 'object' && 'h' in value) {
    return value.h / 360
  }
  return value as number
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface LibraryClip {
  id: string
  name: string
  author: string
  category: string
  tags?: string[]  // WAVE 2030.9: Include tags for heph category
  durationMs: number
  paramCount: number
  modifiedAt: number
  filePath: string
  effectType?: string  // WAVE 2040.17: Base effect type from .lfx
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** D&D MIME type for Hephaestus clips */
const HEPH_DRAG_MIME = 'application/luxsync-heph'

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const HephaestusView: React.FC = () => {
  // ── WAVE 2043: Temporal Store (Undo/Redo) ──
  const { state: temporal, actions: temporalActions } = useTemporalStore(createDummyClip)
  const clip = temporal.clip
  const setClip = temporalActions.setClip

  // ── State ──
  const [activeParam, setActiveParam] = useState<HephParamId>('intensity')
  const [selectedKeyframeIdx, setSelectedKeyframeIdx] = useState<number | null>(null)
  /** ⚒️ WAVE 2043: Multi-selection set for batch operations */
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
  const [playheadMs, setPlayheadMs] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  
  // ── Library State (WAVE 2030.5) ──
  const [library, setLibrary] = useState<LibraryClip[]>([])
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showLibrary, setShowLibrary] = useState(true)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  // ── Search & Filter State (WAVE 2030.6) ──
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // ── Modal & Dropdown State (WAVE 2030.8) ──
  const [showNewClipModal, setShowNewClipModal] = useState(false)
  const [showAddParamDropdown, setShowAddParamDropdown] = useState(false)
  const [showPhasePanel, setShowPhasePanel] = useState(false)

  // ── WAVE 2030.26: Editable Header State ──
  const [isEditingName, setIsEditingName] = useState(false)
  const [editNameValue, setEditNameValue] = useState('')
  const [isEditingDuration, setIsEditingDuration] = useState(false)
  const [editDurationValue, setEditDurationValue] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)
  const durationInputRef = useRef<HTMLInputElement>(null)

  // ── WAVE 2030.26: Add Param Popover Ref (click-outside dismiss) ──
  const addParamRef = useRef<HTMLDivElement>(null)

  // ── WAVE 2403.1: Phase Panel Floating HUD Ref ──
  const phasePanelRef = useRef<HTMLDivElement>(null)

  // ── Radar Preview State (WAVE 2030.25) ──
  const [showRadar, setShowRadar] = useState(true)
  const stageFixtures = useStageStore(selectFixtures)
  const preview = useHephPreview(clip, stageFixtures)

  // ── WAVE 2213: Load Show desde Hephaestus ──
  const showFile = useStageStore(state => state.showFile)
  const [isLoadingShow, setIsLoadingShow] = useState(false)

  /**
   * ⚒️ WAVE 2040.17: DIAMOND CACHE
   * Pre-cached serialized clips for zero-latency D&D to Chronos.
   * Key: filePath, Value: HephAutomationClipSerialized
   * Populated in background after library loads.
   */
  const clipCacheRef = useRef<Map<string, HephAutomationClipSerialized>>(new Map())

  /**
   * ⚒️ WAVE 2043.2: Batch Move Origin Snapshot
   * Captures the ORIGINAL keyframe positions at drag start so that
   * batch delta can be applied to originals, not already-mutated state.
   * Map<keyframeIndex, { timeMs, value }> — populated on onDragStart.
   */
  const batchOriginRef = useRef<Map<number, { timeMs: number; value: number | { h: number; s: number; l: number } }>>(new Map())

  /**
   * ⚒️ WAVE 2043.4: COPYCAT Clipboard
   * Stores copied keyframes with RELATIVE times (normalized to t=0).
   * This copies "shapes" not absolute positions.
   * Format: { relativeTimeMs, value, interpolation, bezierHandles? }[]
   */
  const clipboardRef = useRef<Array<{
    relativeTimeMs: number
    value: number | { h: number; s: number; l: number }
    interpolation: 'hold' | 'linear' | 'bezier'
    bezierHandles?: [number, number, number, number]
  }>>([])

  // ── Derived ──
  const activeCurve = useMemo(
    () => clip.curves.get(activeParam) ?? null,
    [clip, activeParam]
  )

  const paramIds = useMemo<HephParamId[]>(
    () => Array.from(clip.curves.keys()) as HephParamId[],
    [clip]
  )

  // ── Available params for add dropdown (WAVE 2030.8) ──
  const availableParams = useMemo<HephParamId[]>(
    () => ALL_PARAM_IDS.filter((p: HephParamId) => !clip.curves.has(p)),
    [clip]
  )

  // ── Group available params by category (WAVE 2030.9) ──
  const groupedAvailableParams = useMemo(() => {
    const groups = new Map<ParamCategory, HephParamId[]>()
    for (const paramId of availableParams) {
      const cat = PARAM_META[paramId].category
      if (!groups.has(cat)) {
        groups.set(cat, [])
      }
      groups.get(cat)!.push(paramId)
    }
    return groups
  }, [availableParams])

  // ── Filtered & Grouped Library (WAVE 2030.6) ──
  const filteredLibrary = useMemo(() => {
    if (!searchQuery.trim()) return library
    const q = searchQuery.toLowerCase()
    return library.filter(item => 
      item.name.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.author.toLowerCase().includes(q)
    )
  }, [library, searchQuery])

  const groupedLibrary = useMemo(() => {
    const groups = new Map<string, LibraryClip[]>()
    for (const item of filteredLibrary) {
      // WAVE 2030.9: Extract Heph category from tags (heph:control → control)
      const hephTag = item.tags?.find(t => t.startsWith('heph:'))
      const category = hephTag ? hephTag.replace('heph:', '') : (item.category || 'uncategorized')
      
      if (!groups.has(category)) {
        groups.set(category, [])
      }
      groups.get(category)!.push(item)
    }
    // Sort categories alphabetically
    return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])))
  }, [filteredLibrary])

  // Auto-expand all categories when there's a search query
  useEffect(() => {
    if (searchQuery.trim()) {
      setExpandedCategories(new Set(groupedLibrary.keys()))
    }
  }, [searchQuery, groupedLibrary])

  // ═══════════════════════════════════════════════════════════════════════
  // EFFECTS — Load Library on Mount
  // ═══════════════════════════════════════════════════════════════════════

  // ⚒️ WAVE 2044: THE HANDOFF — Read navigation bridge from Chronos
  // 🚑 WAVE 2044.1: STABLE PULSE — Individual selectors prevent infinite loop
  const targetHephClipId = useNavigationStore(state => state.targetHephClipId)
  const targetBpm = useNavigationStore(state => state.targetBpm)  // WAVE 2044.6
  const clearTargetHephClip = useNavigationStore(state => state.clearTargetHephClip)
  
  // ⚒️ WAVE 2044.3: SYNAPSE REPAIR — BPM live injection for musical grid
  // 🎵 WAVE 2044.6: BPM UNITY — CRITICAL: Always call hook, then apply priority chain
  const audioStoreBpm = useAudioStore(state => state.bpm)
  
  // 🎵 WAVE 2044.6: Capture targetBpm into local state BEFORE it's cleared by THE HANDOFF
  const [capturedBpm, setCapturedBpm] = useState<number | null>(null)
  
  // Priority: capturedBpm (snapshot from THE HANDOFF) > audioStore > 120 fallback
  const liveBpm = capturedBpm || audioStoreBpm || 120
  
  // 🔍 WAVE 2044.4: GRIDLOCK DEBUG — Verify BPM propagation from Pacemaker
  useEffect(() => {
    console.log(`[HephaestusView] 🔍 BPM changed → ${liveBpm} (capturedBpm: ${capturedBpm}, targetBpm: ${targetBpm})`)
  }, [liveBpm, capturedBpm, targetBpm])

  useEffect(() => {
    loadLibrary()
  }, [])

  // Clear save message after 3 seconds
  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [saveMessage])

  // ═══════════════════════════════════════════════════════════════════════
  // FILE I/O — WAVE 2030.5
  // ═══════════════════════════════════════════════════════════════════════

  const loadLibrary = useCallback(async () => {
    if (!window.luxsync?.hephaestus?.list) {
      console.warn('[Hephaestus] IPC not available, using demo mode')
      return
    }

    setIsLoadingLibrary(true)
    try {
      const result = await window.luxsync.hephaestus.list()
      if (result.success && result.clips) {
        const loadedClips = result.clips as LibraryClip[]
        setLibrary(loadedClips)
        console.log(`[Hephaestus] Loaded ${loadedClips.length} clips from library`)

        // ⚒️ WAVE 2040.17: DIAMOND CACHE — Preload all clips in background
        // .lfx files are small (<50KB each). Preloading ensures
        // zero-latency D&D with full curve data.
        if (window.luxsync?.hephaestus?.load) {
          for (const item of loadedClips) {
            if (!clipCacheRef.current.has(item.filePath)) {
              try {
                const loadResult = await window.luxsync.hephaestus.load(item.filePath)
                if (loadResult.success && loadResult.clip) {
                  clipCacheRef.current.set(item.filePath, loadResult.clip as HephAutomationClipSerialized)
                }
              } catch (e) {
                console.warn(`[Hephaestus] 💎 Cache miss for ${item.name}:`, e)
              }
            }
          }
          console.log(`[Hephaestus] 💎 Diamond cache loaded: ${clipCacheRef.current.size} clips`)
        }
      } else if (result.error) {
        console.error('[Hephaestus] Failed to load library:', result.error)
      }
    } catch (error) {
      console.error('[Hephaestus] Library load error:', error)
    } finally {
      setIsLoadingLibrary(false)
    }
  }, [])

  const handleSave = useCallback(async () => {
    if (!window.luxsync?.hephaestus?.save) {
      console.warn('[Hephaestus] IPC not available, cannot save')
      setSaveMessage('⚠️ Save not available (demo mode)')
      return
    }

    setIsSaving(true)
    try {
      // Serialize the clip (Map → Record)
      const serialized = serializeHephClip(clip)
      const result = await window.luxsync.hephaestus.save(serialized)
      
      if (result.success) {
        console.log(`[Hephaestus] Saved clip to ${result.filePath}`)
        setSaveMessage('✅ Saved!')
        setIsDirty(false)
        // Refresh library
        await loadLibrary()
        
        // ⚒️ WAVE 2044: HOT-RELOAD — Notify Chronos that a clip was updated.
        // Chronos listens for this event and reloads any FXClip whose
        // hephClip.id matches, updating its embedded Diamond Data in-place.
        const serializedForEvent = serializeHephClip(clip)
        window.dispatchEvent(new CustomEvent('luxsync:heph-clip-saved', {
          detail: {
            clipId: clip.id,
            clip: serializedForEvent,
          },
        }))
        console.log(`[Hephaestus] ⚒️ HOT-RELOAD: Dispatched luxsync:heph-clip-saved → ${clip.id}`)
      } else {
        console.error('[Hephaestus] Save failed:', result.error)
        setSaveMessage(`❌ ${result.error}`)
      }
    } catch (error) {
      console.error('[Hephaestus] Save error:', error)
      setSaveMessage('❌ Save failed')
    } finally {
      setIsSaving(false)
    }
  }, [clip, loadLibrary])

  /**
   * ⚒️ WAVE 2043.9: SAVE AS — Cloning Protocol
   * Clone the current clip with a new UUID and "(Copy)" suffix.
   */
  const handleSaveAs = useCallback(async () => {
    if (!window.luxsync?.hephaestus?.save) {
      console.warn('[Hephaestus] IPC not available, cannot save')
      setSaveMessage('⚠️ Save not available (demo mode)')
      return
    }

    setIsSaving(true)
    try {
      // Deep clone current clip
      const clonedClip = structuredClone(clip)
      
      // Generate NEW UUID (vital — prevents overwriting original)
      clonedClip.id = crypto.randomUUID()
      
      // Add "(Copy)" suffix to name
      clonedClip.name = `${clip.name} (Copy)`
      
      // Serialize and save
      const serialized = serializeHephClip(clonedClip)
      const result = await window.luxsync.hephaestus.save(serialized)
      
      if (result.success) {
        console.log(`[Hephaestus] Saved clone to ${result.filePath}`)
        setSaveMessage('✅ Copy saved!')
        
        // Switch editor to point to the NEW clip (not the original)
        temporalActions.resetWithClip(clonedClip)
        setIsDirty(false)
        
        // Refresh library to show new clone
        await loadLibrary()
      } else {
        console.error('[Hephaestus] Save As failed:', result.error)
        setSaveMessage(`❌ ${result.error}`)
      }
    } catch (error) {
      console.error('[Hephaestus] Save As error:', error)
      setSaveMessage('❌ Clone failed')
    } finally {
      setIsSaving(false)
    }
  }, [clip, temporalActions, loadLibrary])

  const handleLoad = useCallback(async (clipId: string) => {
    if (!window.luxsync?.hephaestus?.load) {
      console.warn('[Hephaestus] IPC not available, cannot load')
      return
    }

    try {
      const result = await window.luxsync.hephaestus.load(clipId)
      
      if (result.success && result.clip) {
        // Deserialize (Record → Map)
        const loadedClip = deserializeHephClip(result.clip as HephAutomationClipSerialized)
        temporalActions.resetWithClip(loadedClip)
        setIsDirty(false)
        setSelectedKeyframeIdx(null)
        
        // Set first param as active
        const firstParam = Array.from(loadedClip.curves.keys())[0]
        if (firstParam) setActiveParam(firstParam)
        
        console.log(`[Hephaestus] Loaded clip: ${loadedClip.name}`)
      } else {
        console.error('[Hephaestus] Load failed:', result.error)
      }
    } catch (error) {
      console.error('[Hephaestus] Load error:', error)
    }
  }, [])

  // ═══════════════════════════════════════════════════════════════════════
  // ⚒️ WAVE 2044: THE HANDOFF — Auto-load clip when arriving from Chronos
  // ═══════════════════════════════════════════════════════════════════════
  // When Chronos sets targetHephClipId via editInHephaestus(), we detect it
  // on mount/update and auto-load the clip into the editor.
  useEffect(() => {
    if (!targetHephClipId) return
    
    console.log(`[Hephaestus] ⚒️ THE HANDOFF: Auto-loading clip from Chronos → ${targetHephClipId}`)
    
    // 🎵 WAVE 2044.6: Capture BPM into local state BEFORE clearing navigationStore
    if (targetBpm) {
      setCapturedBpm(targetBpm)
      console.log(`[Hephaestus] 🎵 BPM captured from THE HANDOFF → ${targetBpm}`)
    }
    
    // Clear the target immediately to prevent re-triggering on re-renders
    clearTargetHephClip()
    
    // Auto-load the clip via existing handleLoad infrastructure
    // handleLoad accepts idOrPath — the IPC backend resolves both
    handleLoad(targetHephClipId)
  }, [targetHephClipId, targetBpm, clearTargetHephClip, handleLoad])  // WAVE 2044.6: Add targetBpm dependency

  const handleDelete = useCallback(async (clipId: string) => {
    if (!window.luxsync?.hephaestus?.delete) {
      console.warn('[Hephaestus] IPC not available, cannot delete')
      return
    }

    if (!confirm('Delete this clip permanently?')) return

    try {
      const result = await window.luxsync.hephaestus.delete(clipId)
      if (result.success && result.deleted) {
        console.log(`[Hephaestus] Deleted clip: ${clipId}`)
        await loadLibrary()
      }
    } catch (error) {
      console.error('[Hephaestus] Delete error:', error)
    }
  }, [loadLibrary])

  const handleNew = useCallback(() => {
    // WAVE 2030.8: Open modal instead of creating dummy clip
    setShowNewClipModal(true)
  }, [])

  // 🔥 WAVE 2213: Load Show desde Hephaestus — misma lógica que ActiveSession.tsx
  const handleLoadShow = useCallback(async () => {
    setIsLoadingShow(true)
    try {
      const luxApi = (window as any).lux
      if (!luxApi?.stage?.openDialog) {
        console.error('[HephaestusView] window.lux.stage.openDialog not available')
        return
      }
      const result = await luxApi.stage.openDialog()
      if (result?.success) {
        console.log(`✅ [HephaestusView] Show loaded: ${result.filePath}`)
      } else if (!result?.cancelled) {
        console.error('[HephaestusView] Failed to load show')
      }
    } catch (err) {
      console.error('[HephaestusView] Error in load show dialog:', err)
    } finally {
      setIsLoadingShow(false)
    }
  }, [])

  // WAVE 2030.8: Create clip from modal and save immediately
  const handleCreateClip = useCallback(async (newClip: HephAutomationClip) => {
    temporalActions.resetWithClip(newClip)
    setActiveParam('intensity')  // Default to intensity
    setSelectedKeyframeIdx(null)
    setIsDirty(true)
    
    // Auto-save immediately
    if (window.luxsync?.hephaestus?.save) {
      try {
        const serialized = serializeHephClip(newClip)
        const result = await window.luxsync.hephaestus.save(serialized)
        if (result.success) {
          console.log(`[Hephaestus] Created & saved new clip: ${newClip.name}`)
          setSaveMessage('✅ Created!')
          setIsDirty(false)
          await loadLibrary()
        }
      } catch (error) {
        console.error('[Hephaestus] Failed to save new clip:', error)
      }
    }
  }, [loadLibrary])

  // WAVE 2030.13: Zone targeting handler
  const handleZonesChange = useCallback((zones: EffectZone[]) => {
    temporalActions.snapshot()
    setClip(prev => ({
      ...prev,
      zones
    }))
    setIsDirty(true)
  }, [temporalActions])

  // ⚒️ WAVE 2403: Phase Distribution config handler
  const handlePhaseConfigChange = useCallback((phaseConfig: PhaseConfig) => {
    temporalActions.snapshot()
    setClip(prev => ({
      ...prev,
      selector: {
        ...(prev.selector ?? { target: 'all' }),
        phase: phaseConfig,
      },
    }))
    setIsDirty(true)
  }, [temporalActions])

  // ═══════════════════════════════════════════════════════════════════════
  // WAVE 2030.6 — Category Toggle & Drag-and-Drop
  // ═══════════════════════════════════════════════════════════════════════

  const handleCategoryToggle = useCallback((category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }, [])

  /**
   * ⚒️ WAVE 2040.17: DIAMOND DRAG
   * Start dragging a library clip to Chronos Timeline.
   * Now includes FULL serialized clip data from the Diamond Cache
   * for zero-latency deep copy on drop.
   */
  const handleDragStart = useCallback((e: React.DragEvent, libraryItem: LibraryClip) => {
    // WAVE 2040.17: Look up full serialized clip from Diamond Cache
    const cachedClip = clipCacheRef.current.get(libraryItem.filePath)

    // 🐛 WAVE 2040.18: DEBUG — What's in the cache?
    if (cachedClip) {
      console.log(`[HephDrag] 💎 "${libraryItem.name}": mixBus=${cachedClip.mixBus || 'undefined'}, effectType=${cachedClip.effectType || 'undefined'}, category=${cachedClip.category || 'undefined'}`)
    } else {
      console.warn(`[HephDrag] ⚠️ "${libraryItem.name}": NO CACHE — will use fallback metadata`)
    }

    // Build DragPayload with COMPLETE Diamond Data
    const payload = {
      source: 'hephaestus' as const,
      clipType: 'fx' as const,
      subType: cachedClip?.effectType || libraryItem.category || 'heph-automation',
      defaultDurationMs: libraryItem.durationMs,
      hephClipId: libraryItem.id,
      hephFilePath: libraryItem.filePath,
      name: libraryItem.name,
      // ⚒️ WAVE 2040.17: Diamond Data — full curve payload
      hephClipSerialized: cachedClip || undefined,
      category: cachedClip?.category || libraryItem.category,
      mixBus: cachedClip?.mixBus,
      effectType: cachedClip?.effectType || libraryItem.effectType,
      zones: cachedClip?.zones,
      priority: cachedClip?.priority,
    }
    
    const payloadJson = JSON.stringify(payload)
    
    // Set ALL MIME types with FULL JSON payload
    // WAVE 2040.18 FIX: luxsync-heph MUST have full JSON, not just ID.
    // TimelineCanvas reads luxsync-fx first, but luxsync-heph is used for type detection.
    e.dataTransfer.setData('application/luxsync-fx', payloadJson)     // PRIMARY — full payload
    e.dataTransfer.setData('application/luxsync-clip', payloadJson)   // Generic fallback
    e.dataTransfer.setData(HEPH_DRAG_MIME, payloadJson)               // Hephaestus marker (full JSON)
    e.dataTransfer.effectAllowed = 'copy'
    
    if (cachedClip) {
      const curveCount = Object.keys(cachedClip.curves).length
      console.log(`[Hephaestus] 💎 Diamond drag: ${libraryItem.name} [${curveCount} curves, mixBus=${cachedClip.mixBus}]`)
    } else {
      console.warn(`[Hephaestus] ⚠️ Drag without Diamond data (cache miss): ${libraryItem.name}`)
    }
  }, [])

  // ═══════════════════════════════════════════════════════════════════════
  // CALLBACKS — Curve Mutations (immutable updates)
  // ═══════════════════════════════════════════════════════════════════════

  const updateCurve = useCallback((paramId: HephParamId, updater: (curve: HephCurve) => HephCurve) => {
    setClip((prev: HephAutomationClip): HephAutomationClip => {
      const newCurves = new Map<HephParamId, HephCurve>(prev.curves)
      const existing = newCurves.get(paramId)
      if (!existing) return prev
      newCurves.set(paramId, updater(existing))
      return { ...prev, curves: newCurves }
    })
    setIsDirty(true)
  }, [])

  /**
   * ⚒️ WAVE 2043: Snapshot-wrapped curve update.
   * Captura snapshot ANTES de mutar. Usar para acciones destructivas
   * que NO son drag continuo (add, delete, interpolation, template, etc.)
   */
  const updateCurveWithSnapshot = useCallback((paramId: HephParamId, updater: (curve: HephCurve) => HephCurve) => {
    temporalActions.snapshot()
    updateCurve(paramId, updater)
  }, [temporalActions, updateCurve])

  const handleKeyframeAdd = useCallback((timeMs: number, value: number) => {
    updateCurveWithSnapshot(activeParam, curve => {
      const newKfs = [...curve.keyframes]
      // Insert sorted by timeMs
      const insertIdx = newKfs.findIndex(kf => kf.timeMs > timeMs)

      // ⚒️ WAVE 2040.22c: For color curves, the plotted Y-axis is hue (0-1 normalized).
      // We must reconstruct a full HSL object, not store a bare number.
      // Use s/l from default or nearest keyframe to preserve color integrity.
      let kfValue: number | { h: number; s: number; l: number } = value
      if (curve.valueType === 'color') {
        // Denormalize hue: 0-1 → 0-360
        const hue = Math.max(0, Math.min(value * 360, 360))
        // Inherit s/l from nearest keyframe or default
        const nearestKf = insertIdx > 0 ? newKfs[insertIdx - 1] : newKfs[0]
        const refHSL = nearestKf && typeof nearestKf.value === 'object' && 'h' in nearestKf.value
          ? nearestKf.value
          : (typeof curve.defaultValue === 'object' ? curve.defaultValue as { h: number; s: number; l: number } : { h: 0, s: 100, l: 50 })
        kfValue = { h: hue, s: refHSL.s, l: refHSL.l }
      }

      const newKf = {
        timeMs,
        value: kfValue,
        interpolation: 'linear' as HephInterpolation,
      }
      if (insertIdx === -1) {
        newKfs.push(newKf)
      } else {
        newKfs.splice(insertIdx, 0, newKf)
      }
      return { ...curve, keyframes: newKfs }
    })
  }, [activeParam, updateCurveWithSnapshot])

  const handleKeyframeMove = useCallback((index: number, timeMs: number, value: number) => {
    updateCurve(activeParam, curve => {
      const newKfs = [...curve.keyframes]
      const existing = newKfs[index]

      // ⚒️ WAVE 2043: BATCH MOVE — If the dragged keyframe is in multi-selection,
      // compute delta and apply to ALL selected keyframes.
      if (selectedIndices.size > 1 && selectedIndices.has(index)) {
        const deltaTimeMs = timeMs - existing.timeMs
        const deltaValue = value - getPlotValue(existing.value, curve.valueType)

        for (const selIdx of selectedIndices) {
          if (selIdx < 0 || selIdx >= newKfs.length) continue
          const kf = newKfs[selIdx]
          const newTimeMs = Math.max(0, Math.min(kf.timeMs + deltaTimeMs, clip.durationMs))

          let kfValue: number | { h: number; s: number; l: number }
          if (curve.valueType === 'color') {
            const origPlot = getPlotValue(kf.value, curve.valueType)
            const newPlot = origPlot + deltaValue
            const hue = Math.max(0, Math.min(newPlot * 360, 360))
            const origHSL = typeof kf.value === 'object' && 'h' in kf.value
              ? kf.value
              : (typeof curve.defaultValue === 'object' ? curve.defaultValue as { h: number; s: number; l: number } : { h: 0, s: 100, l: 50 })
            kfValue = { h: hue, s: origHSL.s, l: origHSL.l }
          } else {
            const [rangeMin, rangeMax] = curve.range
            kfValue = Math.max(rangeMin, Math.min((kf.value as number) + deltaValue, rangeMax))
          }

          newKfs[selIdx] = { ...newKfs[selIdx], timeMs: Math.round(newTimeMs), value: kfValue }
        }

        // Re-sort by timeMs to maintain invariant
        newKfs.sort((a, b) => a.timeMs - b.timeMs)
        return { ...curve, keyframes: newKfs }
      }

      // ── SINGLE KEYFRAME MOVE (original behavior) ──
      // ⚒️ WAVE 2040.22c: For color curves, preserve HSL object structure.
      // The plotted Y-axis represents hue (0-1 normalized), so only hue changes.
      // Saturation and lightness are preserved from the original keyframe.
      let kfValue: number | { h: number; s: number; l: number } = value
      if (curve.valueType === 'color') {
        const hue = Math.max(0, Math.min(value * 360, 360))
        // Preserve s/l from original keyframe
        const origHSL = existing && typeof existing.value === 'object' && 'h' in existing.value
          ? existing.value
          : (typeof curve.defaultValue === 'object' ? curve.defaultValue as { h: number; s: number; l: number } : { h: 0, s: 100, l: 50 })
        kfValue = { h: hue, s: origHSL.s, l: origHSL.l }
      }

      newKfs[index] = { ...newKfs[index], timeMs, value: kfValue }
      // Re-sort by timeMs to maintain invariant
      newKfs.sort((a, b) => a.timeMs - b.timeMs)
      return { ...curve, keyframes: newKfs }
    })
  }, [activeParam, updateCurve, selectedIndices, clip.durationMs])

  /**
   * ⚒️ WAVE 2043.2: Drag Start — snapshot temporal state AND capture original keyframe positions.
   * CurveEditor calls this when a drag begins. We save the originals so batch move
   * can compute delta against unmutated positions on every mousemove frame.
   */
  const handleDragStartWithSnapshot = useCallback(() => {
    temporalActions.snapshot()
    // Capture original positions of ALL selected keyframes
    const origins = new Map<number, { timeMs: number; value: number | { h: number; s: number; l: number } }>()
    const curve = clip.curves.get(activeParam)
    if (curve) {
      for (const idx of selectedIndices) {
        const kf = curve.keyframes[idx]
        if (kf) {
          origins.set(idx, { timeMs: kf.timeMs, value: kf.value })
        }
      }
    }
    batchOriginRef.current = origins
  }, [temporalActions, clip, activeParam, selectedIndices])

  /**
   * ⚒️ WAVE 2043.2: BATCH KEYFRAME MOVE — applies delta from drag origin to ALL selected.
   * Receives RELATIVE deltas (deltaTimeMs, deltaValue) from CurveEditor.
   * Uses batchOriginRef (captured at drag start) as the source of truth — NOT the mutated state.
   */
  const handleBatchKeyframeMove = useCallback((deltaTimeMs: number, deltaValue: number) => {
    const origins = batchOriginRef.current
    if (origins.size === 0) return

    updateCurve(activeParam, curve => {
      const newKfs = [...curve.keyframes]

      for (const [selIdx, origin] of origins) {
        if (selIdx < 0 || selIdx >= newKfs.length) continue

        const newTimeMs = Math.max(0, Math.min(origin.timeMs + deltaTimeMs, clip.durationMs))

        let kfValue: number | { h: number; s: number; l: number }
        if (curve.valueType === 'color') {
          const origPlot = getPlotValue(origin.value, curve.valueType)
          const newPlot = origPlot + deltaValue
          const hue = Math.max(0, Math.min(newPlot * 360, 360))
          const origHSL = typeof origin.value === 'object' && 'h' in origin.value
            ? origin.value
            : (typeof curve.defaultValue === 'object' ? curve.defaultValue as { h: number; s: number; l: number } : { h: 0, s: 100, l: 50 })
          kfValue = { h: hue, s: origHSL.s, l: origHSL.l }
        } else {
          const [rangeMin, rangeMax] = curve.range
          kfValue = Math.max(rangeMin, Math.min((origin.value as number) + deltaValue, rangeMax))
        }

        newKfs[selIdx] = { ...newKfs[selIdx], timeMs: Math.round(newTimeMs), value: kfValue }
      }

      // Re-sort by timeMs to maintain invariant
      newKfs.sort((a, b) => a.timeMs - b.timeMs)
      return { ...curve, keyframes: newKfs }
    })
  }, [activeParam, updateCurve, clip.durationMs])

  const handleKeyframeDelete = useCallback((index: number) => {
    updateCurveWithSnapshot(activeParam, curve => {
      if (curve.keyframes.length <= 1) return curve // Never delete last
      const newKfs = curve.keyframes.filter((_, i) => i !== index)
      return { ...curve, keyframes: newKfs }
    })
    setSelectedKeyframeIdx(null)
    setSelectedIndices(new Set())
  }, [activeParam, updateCurveWithSnapshot])

  const handleInterpolationChange = useCallback((index: number, interpolation: HephInterpolation) => {
    updateCurveWithSnapshot(activeParam, curve => {
      const newKfs = [...curve.keyframes]
      newKfs[index] = { ...newKfs[index], interpolation }
      return { ...curve, keyframes: newKfs }
    })
  }, [activeParam, updateCurveWithSnapshot])

  // WAVE 2030.14: Audio binding change handler
  const handleAudioBindingChange = useCallback((index: number, binding: import('../../../core/hephaestus/types').HephAudioBinding | undefined) => {
    updateCurveWithSnapshot(activeParam, curve => {
      const newKfs = [...curve.keyframes]
      newKfs[index] = { ...newKfs[index], audioBinding: binding }
      return { ...curve, keyframes: newKfs }
    })
  }, [activeParam, updateCurveWithSnapshot])

  /**
   * ⚒️ WAVE 2043.12: BATCH AUDIO BIND — Apply audio source to ALL selected keyframes.
   * Overwrites any existing bindings without mercy.
   */
  const handleBatchAudioBind = useCallback((source: import('../../../core/hephaestus/types').HephAudioBinding['source']) => {
    if (selectedIndices.size === 0) return

    updateCurveWithSnapshot(activeParam, curve => {
      const newKfs = [...curve.keyframes]
      for (const idx of selectedIndices) {
        if (idx < 0 || idx >= newKfs.length) continue
        if (source === 'none') {
          // Remove binding
          newKfs[idx] = { ...newKfs[idx], audioBinding: undefined }
        } else {
          // Apply binding with default ranges
          newKfs[idx] = {
            ...newKfs[idx],
            audioBinding: {
              source,
              inputRange: [0, 1],
              outputRange: [0, 1],
              smoothing: 0.1,
            }
          }
        }
      }
      return { ...curve, keyframes: newKfs }
    })
    console.log(`[Hephaestus] ⚒️ Applied audio bind "${source}" to ${selectedIndices.size} keyframes`)
  }, [activeParam, selectedIndices, updateCurveWithSnapshot])

  const handleBezierHandleMove = useCallback((index: number, handles: [number, number, number, number]) => {
    updateCurve(activeParam, curve => {
      const newKfs = [...curve.keyframes]
      newKfs[index] = { ...newKfs[index], bezierHandles: handles, interpolation: 'bezier' }
      return { ...curve, keyframes: newKfs }
    })
  }, [activeParam, updateCurve])

  const handleKeyframeSelect = useCallback((index: number | null) => {
    setSelectedKeyframeIdx(index)
    // ⚒️ WAVE 2043: Single select clears multi-selection
    if (index !== null) {
      setSelectedIndices(new Set([index]))
    } else {
      setSelectedIndices(new Set())
    }
  }, [])

  /**
   * ⚒️ WAVE 2043: Multi-selection update from CurveEditor.
   * Called by Shift+Click (toggle), Rubber Band (batch), or Deselect (clear).
   */
  const handleMultiSelect = useCallback((indices: Set<number>) => {
    setSelectedIndices(indices)
    // Keep primary selection as the last element, or null if empty
    if (indices.size > 0) {
      const arr = Array.from(indices)
      setSelectedKeyframeIdx(arr[arr.length - 1])
    } else {
      setSelectedKeyframeIdx(null)
    }
  }, [])

  /**
   * ⚒️ WAVE 2043.4: COPYCAT — Copy selected keyframes with RELATIVE times.
   * Copies "shapes" not absolute positions. First keyframe becomes t=0.
   */
  const handleCopyKeyframes = useCallback(() => {
    if (selectedIndices.size === 0 || !activeCurve) return

    // Get selected keyframes sorted by time
    const selectedKfs = Array.from(selectedIndices)
      .filter(idx => idx >= 0 && idx < activeCurve.keyframes.length)
      .map(idx => activeCurve.keyframes[idx])
      .sort((a, b) => a.timeMs - b.timeMs)

    if (selectedKfs.length === 0) return

    // Normalize to relative time (first keyframe = t=0)
    const timeOffset = selectedKfs[0].timeMs
    clipboardRef.current = selectedKfs.map(kf => ({
      relativeTimeMs: kf.timeMs - timeOffset,
      value: kf.value,
      interpolation: kf.interpolation,
      bezierHandles: kf.bezierHandles,
    }))

    console.log(`⚒️ COPYCAT: Copied ${selectedKfs.length} keyframes (shape starting at t=0)`)
  }, [selectedIndices, activeCurve])

  /**
   * ⚒️ WAVE 2043.4: COPYCAT — Paste keyframes at playhead position.
   * Creates new keyframes with absolute times = playheadMs + relativeTimeMs.
   * Auto-selects the pasted keyframes for immediate manipulation.
   */
  const handlePasteKeyframes = useCallback(() => {
    if (clipboardRef.current.length === 0 || !activeCurve) return

    const baseTimeMs = playheadMs
    const clipboardData = clipboardRef.current

    // Snapshot before paste (for undo)
    temporalActions.snapshot()

    // Track what indices the new keyframes will have after insertion
    const newKeyframeIndices: number[] = []

    updateCurve(activeParam, curve => {
      const newKfs = [...curve.keyframes]

      // Insert each pasted keyframe
      for (const copied of clipboardData) {
        const newTimeMs = Math.round(Math.max(0, Math.min(baseTimeMs + copied.relativeTimeMs, clip.durationMs)))

        // Check if keyframe already exists at this exact time (within 1ms tolerance)
        const existingIdx = newKfs.findIndex(kf => Math.abs(kf.timeMs - newTimeMs) < 1)
        if (existingIdx !== -1) {
          // Replace existing keyframe
          newKfs[existingIdx] = {
            timeMs: newTimeMs,
            value: copied.value,
            interpolation: copied.interpolation,
            bezierHandles: copied.bezierHandles,
          }
        } else {
          // Insert new keyframe
          newKfs.push({
            timeMs: newTimeMs,
            value: copied.value,
            interpolation: copied.interpolation,
            bezierHandles: copied.bezierHandles,
          })
        }
      }

      // Re-sort by timeMs
      newKfs.sort((a, b) => a.timeMs - b.timeMs)

      // Find the indices of the pasted keyframes (for auto-selection)
      for (const copied of clipboardData) {
        const pastedTimeMs = Math.round(Math.max(0, Math.min(baseTimeMs + copied.relativeTimeMs, clip.durationMs)))
        const idx = newKfs.findIndex(kf => Math.abs(kf.timeMs - pastedTimeMs) < 1)
        if (idx !== -1 && !newKeyframeIndices.includes(idx)) {
          newKeyframeIndices.push(idx)
        }
      }

      return { ...curve, keyframes: newKfs }
    })

    // Smart Select: Auto-select the pasted keyframes
    setSelectedIndices(new Set(newKeyframeIndices))
    if (newKeyframeIndices.length > 0) {
      setSelectedKeyframeIdx(newKeyframeIndices[newKeyframeIndices.length - 1])
    }

    console.log(`⚒️ COPYCAT: Pasted ${clipboardData.length} keyframes at t=${baseTimeMs}ms`)
  }, [activeCurve, playheadMs, activeParam, updateCurve, temporalActions, clip.durationMs])

  /**
   * ⚒️ WAVE 2043.5: Paste keyframes at a SPECIFIC time (from context menu "Paste Here").
   * Same logic as handlePasteKeyframes but uses the provided timeMs instead of playheadMs.
   */
  const handlePasteAtTime = useCallback((targetTimeMs: number) => {
    if (clipboardRef.current.length === 0 || !activeCurve) return

    const baseTimeMs = targetTimeMs
    const clipboardData = clipboardRef.current

    temporalActions.snapshot()

    const newKeyframeIndices: number[] = []

    updateCurve(activeParam, curve => {
      const newKfs = [...curve.keyframes]

      for (const copied of clipboardData) {
        const newTimeMs = Math.round(Math.max(0, Math.min(baseTimeMs + copied.relativeTimeMs, clip.durationMs)))

        const existingIdx = newKfs.findIndex(kf => Math.abs(kf.timeMs - newTimeMs) < 1)
        if (existingIdx !== -1) {
          newKfs[existingIdx] = {
            timeMs: newTimeMs,
            value: copied.value,
            interpolation: copied.interpolation,
            bezierHandles: copied.bezierHandles,
          }
        } else {
          newKfs.push({
            timeMs: newTimeMs,
            value: copied.value,
            interpolation: copied.interpolation,
            bezierHandles: copied.bezierHandles,
          })
        }
      }

      newKfs.sort((a, b) => a.timeMs - b.timeMs)

      for (const copied of clipboardData) {
        const pastedTimeMs = Math.round(Math.max(0, Math.min(baseTimeMs + copied.relativeTimeMs, clip.durationMs)))
        const idx = newKfs.findIndex(kf => Math.abs(kf.timeMs - pastedTimeMs) < 1)
        if (idx !== -1 && !newKeyframeIndices.includes(idx)) {
          newKeyframeIndices.push(idx)
        }
      }

      return { ...curve, keyframes: newKfs }
    })

    setSelectedIndices(new Set(newKeyframeIndices))
    if (newKeyframeIndices.length > 0) {
      setSelectedKeyframeIdx(newKeyframeIndices[newKeyframeIndices.length - 1])
    }

    // Also move playhead to paste position
    setPlayheadMs(targetTimeMs)

    console.log(`⚒️ PASTE HERE: Pasted ${clipboardData.length} keyframes at t=${targetTimeMs}ms`)
  }, [activeCurve, activeParam, updateCurve, temporalActions, clip.durationMs])

  const handleModeChange = useCallback((mode: HephCurveMode) => {
    updateCurveWithSnapshot(activeParam, curve => ({ ...curve, mode }))
  }, [activeParam, updateCurveWithSnapshot])

  // ═══════════════════════════════════════════════════════════════════════
  // WAVE 2030.8 — Parameter Add/Remove
  // ═══════════════════════════════════════════════════════════════════════

  const handleAddParam = useCallback((paramId: HephParamId) => {
    temporalActions.snapshot()
    setClip((prev: HephAutomationClip): HephAutomationClip => {
      // Don't add if already exists
      if (prev.curves.has(paramId)) return prev
      
      // Create new curve with sensible defaults
      const isColor = paramId === 'color'
      const newCurve: HephCurve = {
        paramId,
        valueType: isColor ? 'color' : 'number',
        range: [0, 1],
        defaultValue: isColor ? { h: 0, s: 100, l: 50 } : 0,
        keyframes: [
          { timeMs: 0, value: isColor ? { h: 0, s: 100, l: 50 } : 0, interpolation: 'linear' },
          { timeMs: prev.durationMs, value: isColor ? { h: 0, s: 100, l: 50 } : 1, interpolation: 'hold' },
        ],
        mode: 'absolute'
      }
      
      const newCurves = new Map(prev.curves)
      newCurves.set(paramId, newCurve)
      return { ...prev, curves: newCurves }
    })
    setActiveParam(paramId)
    setShowAddParamDropdown(false)
    setIsDirty(true)
    console.log(`[Hephaestus] Added parameter: ${paramId}`)
  }, [])

  const handleRemoveParam = useCallback((paramId: HephParamId) => {
    temporalActions.snapshot()
    setClip((prev: HephAutomationClip): HephAutomationClip => {
      // ⚒️ WAVE 2040.20: HIGHLANDER FIX — 0 params is a valid state.
      // An empty clip is a blank canvas, not a corrupted state.
      if (!prev.curves.has(paramId)) return prev
      
      const newCurves = new Map(prev.curves)
      newCurves.delete(paramId)
      return { ...prev, curves: newCurves }
    })
    
    // If removing active param, switch to another (or null)
    if (activeParam === paramId) {
      const remaining = Array.from(clip.curves.keys()).filter(p => p !== paramId)
      if (remaining.length > 0) {
        setActiveParam(remaining[0] as HephParamId)
      }
    }
    setSelectedKeyframeIdx(null)
    setIsDirty(true)
    console.log(`[Hephaestus] Removed parameter: ${paramId}`)
  }, [activeParam, clip.curves])

  // ═══════════════════════════════════════════════════════════════════════
  // WAVE 2030.8 — Template & Bezier Preset Application
  // ═══════════════════════════════════════════════════════════════════════

  const handleApplyTemplate = useCallback((keyframes: HephKeyframe[]) => {
    updateCurveWithSnapshot(activeParam, curve => ({
      ...curve,
      keyframes
    }))
    setSelectedKeyframeIdx(null)
    console.log(`[Hephaestus] Applied template with ${keyframes.length} keyframes`)
  }, [activeParam, updateCurveWithSnapshot])

  const handleApplyBezierPreset = useCallback((index: number, handles: [number, number, number, number]) => {
    updateCurveWithSnapshot(activeParam, curve => {
      const newKfs = [...curve.keyframes]
      newKfs[index] = { 
        ...newKfs[index], 
        interpolation: 'bezier',
        bezierHandles: handles 
      }
      return { ...curve, keyframes: newKfs }
    })
    console.log(`[Hephaestus] Applied bezier preset to keyframe ${index}`)
  }, [activeParam, updateCurveWithSnapshot])

  // ═══════════════════════════════════════════════════════════════════════
  // ⚒️ WAVE 2043.11 — Contextual Shapes: Apply mathematical shape to selection window
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Apply a mathematical shape (sine, triangle, sawtooth, etc.) within the
   * time/value window defined by the current multi-selection.
   * 
   * The window is computed from the selected keyframes' min/max time and
   * the curve's value range. The selected keyframes are REPLACED by the
   * generated shape keyframes.
   */
  const handleApplyShapeToSelection = useCallback((shapeId: string) => {
    if (selectedIndices.size < 2) return

    const curve = clip.curves.get(activeParam)
    if (!curve) return

    // Compute time window from selected keyframes
    const selectedKfs = Array.from(selectedIndices)
      .filter(i => i >= 0 && i < curve.keyframes.length)
      .map(i => curve.keyframes[i])

    if (selectedKfs.length < 2) return

    const startTimeMs = Math.min(...selectedKfs.map(kf => kf.timeMs))
    const endTimeMs = Math.max(...selectedKfs.map(kf => kf.timeMs))

    if (endTimeMs <= startTimeMs) return

    // Value window: use the curve's full range for maximum expression
    const [rangeMin, rangeMax] = curve.range

    // Generate shape keyframes mapped into the selection window
    const shapeKeyframes = generateShapeInWindow(
      shapeId,
      startTimeMs,
      endTimeMs,
      rangeMin,
      rangeMax,
      1, // 1 cycle across the selection span
    )

    if (shapeKeyframes.length === 0) return

    // Replace selected keyframes with generated shape
    updateCurveWithSnapshot(activeParam, curveData => {
      // Keep all keyframes that are NOT selected
      const sortedSelectedIndices = Array.from(selectedIndices).sort((a, b) => a - b)
      const keptKeyframes = curveData.keyframes.filter((_, i) => !selectedIndices.has(i))

      // Merge kept + shape keyframes, sorted by time
      const merged = [...keptKeyframes, ...shapeKeyframes].sort((a, b) => a.timeMs - b.timeMs)

      return { ...curveData, keyframes: merged }
    })

    // Select the new shape keyframes
    // After merge, find indices of keyframes with times matching shapeKeyframes
    const newCurve = clip.curves.get(activeParam)
    if (newCurve) {
      // Defer selection update — the curve will be updated on next render
      setTimeout(() => {
        const updatedCurve = clip.curves.get(activeParam)
        if (!updatedCurve) return
        const newSelection = new Set<number>()
        for (const shapeKf of shapeKeyframes) {
          const idx = updatedCurve.keyframes.findIndex(kf => kf.timeMs === shapeKf.timeMs)
          if (idx >= 0) newSelection.add(idx)
        }
        setSelectedIndices(newSelection)
      }, 0)
    }

    setSelectedKeyframeIdx(null)
    console.log(`[Hephaestus] ⚒️ Applied shape "${shapeId}" to ${selectedKfs.length} keyframes [${startTimeMs}ms → ${endTimeMs}ms]`)
  }, [activeParam, clip.curves, selectedIndices, updateCurveWithSnapshot])

  // ═══════════════════════════════════════════════════════════════════════
  // WAVE 2030.26 — Editable Header (Name & Duration)
  // ═══════════════════════════════════════════════════════════════════════

  const startEditName = useCallback(() => {
    setEditNameValue(clip.name)
    setIsEditingName(true)
    requestAnimationFrame(() => nameInputRef.current?.select())
  }, [clip.name])

  const commitEditName = useCallback(() => {
    const trimmed = editNameValue.trim()
    if (trimmed.length > 0 && trimmed !== clip.name) {
      temporalActions.snapshot()
      setClip(prev => ({ ...prev, name: trimmed }))
      setIsDirty(true)
    }
    setIsEditingName(false)
  }, [editNameValue, clip.name, temporalActions])

  const startEditDuration = useCallback(() => {
    setEditDurationValue(String(clip.durationMs / 1000))
    setIsEditingDuration(true)
    requestAnimationFrame(() => durationInputRef.current?.select())
  }, [clip.durationMs])

  const commitEditDuration = useCallback(() => {
    const parsed = parseFloat(editDurationValue)
    if (!isNaN(parsed) && parsed >= 0.1) {
      const newMs = Math.round(parsed * 1000)
      if (newMs !== clip.durationMs) {
        temporalActions.snapshot()
        setClip(prev => ({ ...prev, durationMs: newMs }))
        setIsDirty(true)
      }
    }
    setIsEditingDuration(false)
  }, [editDurationValue, clip.durationMs, temporalActions])

  // ═══════════════════════════════════════════════════════════════════════
  // WAVE 2030.26 — Click-Outside Dismiss for Add Param Popover
  // ═══════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!showAddParamDropdown) return
    const handleClickOutside = (e: MouseEvent) => {
      if (addParamRef.current && !addParamRef.current.contains(e.target as Node)) {
        setShowAddParamDropdown(false)
      }
    }
    // Delay to avoid catching the click that opens it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showAddParamDropdown])

  // ═══════════════════════════════════════════════════════════════════════
  // ⚡ WAVE 2403.1 — Click-Outside Dismiss for Phase Panel HUD
  // ═══════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!showPhasePanel) return
    const handleClickOutside = (e: MouseEvent) => {
      if (phasePanelRef.current && !phasePanelRef.current.contains(e.target as Node)) {
        setShowPhasePanel(false)
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showPhasePanel])

  // ═══════════════════════════════════════════════════════════════════════
  // ⚒️ WAVE 2043: KEYBOARD HANDLER (Undo/Redo + Copy/Paste)
  // ═══════════════════════════════════════════════════════════════════════

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle when not typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          // Ctrl+Shift+Z → Redo
          temporalActions.redo()
        } else {
          // Ctrl+Z → Undo
          temporalActions.undo()
        }
      }

      // Also support Ctrl+Y for Redo (Windows convention)
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        temporalActions.redo()
      }

      // ⚒️ WAVE 2043.4: COPYCAT — Ctrl+C to copy, Ctrl+V to paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault()
        handleCopyKeyframes()
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault()
        handlePasteKeyframes()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [temporalActions, handleCopyKeyframes, handlePasteKeyframes])

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="heph-view">
      {/* ═══ HEADER ═══ */}
      <header className="heph-header">
        <div className="heph-header__left">
          <HephLogoIcon size={24} className="heph-header__icon" />
          <h1 className="heph-header__title">HEPHAESTUS</h1>
          <span className="heph-header__subtitle">STUDIO</span>
        </div>
        <div className="heph-header__center">
          {/* WAVE 2030.26: Editable clip name */}
          {isEditingName ? (
            <input
              ref={nameInputRef}
              className="heph-header__edit-input heph-header__edit-input--name"
              value={editNameValue}
              onChange={(e) => setEditNameValue(e.target.value)}
              onBlur={commitEditName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEditName()
                if (e.key === 'Escape') setIsEditingName(false)
              }}
              spellCheck={false}
            />
          ) : (
            <span 
              className="heph-header__clip-name heph-header__clip-name--editable"
              onClick={startEditName}
              title="Click to edit name"
            >
              {clip.name}
              {isDirty && <span className="heph-header__dirty">*</span>}
            </span>
          )}
          <span className="heph-header__divider">│</span>
          {/* WAVE 2030.26: Editable duration */}
          {isEditingDuration ? (
            <span className="heph-header__edit-duration-wrap">
              <input
                ref={durationInputRef}
                className="heph-header__edit-input heph-header__edit-input--duration"
                value={editDurationValue}
                onChange={(e) => setEditDurationValue(e.target.value)}
                onBlur={commitEditDuration}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEditDuration()
                  if (e.key === 'Escape') setIsEditingDuration(false)
                }}
                spellCheck={false}
              />
              <span className="heph-header__edit-unit">s</span>
            </span>
          ) : (
            <span 
              className="heph-header__duration heph-header__duration--editable"
              onClick={startEditDuration}
              title="Click to edit duration"
            >
              {(clip.durationMs / 1000).toFixed(1)}s
            </span>
          )}
          <span className="heph-header__divider">│</span>
          <span className="heph-header__param-count">{paramIds.length} PARAMS</span>
          
          {/* WAVE 2030.13: Zone Selector */}
          <ZoneSelector
            selectedZones={clip.zones}
            onZonesChange={handleZonesChange}
            disabled={isSaving}
          />
          
          {saveMessage && (
            <>
              <span className="heph-header__divider">│</span>
              <span className="heph-header__save-message">{saveMessage}</span>
            </>
          )}
        </div>
        <div className="heph-header__right">
          {/* ⚒️ WAVE 2043: Undo/Redo buttons */}
          <button
            className={`heph-header__btn heph-header__btn--temporal ${!temporal.canUndo ? 'heph-header__btn--disabled' : ''}`}
            onClick={temporalActions.undo}
            disabled={!temporal.canUndo}
            title={`Undo (Ctrl+Z)${temporal.canUndo ? ` — ${temporal.undoDepth} steps` : ''}`}
          >
            ↩
          </button>
          <button
            className={`heph-header__btn heph-header__btn--temporal ${!temporal.canRedo ? 'heph-header__btn--disabled' : ''}`}
            onClick={temporalActions.redo}
            disabled={!temporal.canRedo}
            title={`Redo (Ctrl+Shift+Z)${temporal.canRedo ? ` — ${temporal.redoDepth} steps` : ''}`}
          >
            ↪
          </button>

          {/* 🔥 WAVE 2213: LOAD SHOW — carga el escenario sin salir del Lab */}
          <div className="heph-header__load-show">
            <button
              className={`heph-header__btn heph-header__btn--load-show ${isLoadingShow ? 'heph-header__btn--disabled' : ''}`}
              onClick={handleLoadShow}
              disabled={isLoadingShow}
              title={showFile ? `Show: ${showFile.name} (${stageFixtures.length} fixtures) — Click para cargar otro` : 'Cargar Show File (.luxshow)'}
            >
              {isLoadingShow ? '⏳' : '📂'}
              <span className="heph-header__btn-label">
                {isLoadingShow ? 'LOADING' : showFile ? `${stageFixtures.length}F` : 'LOAD'}
              </span>
            </button>
            {showFile && (
              <span className="heph-header__show-name" title={showFile.name}>
                {showFile.name}
              </span>
            )}
          </div>

          <button 
            className="heph-header__btn" 
            onClick={handleNew}
            title="New Clip"
          >
            📄 NEW
          </button>
          <button 
            className={`heph-header__btn ${isDirty ? 'heph-header__btn--dirty' : ''}`} 
            onClick={handleSave}
            disabled={isSaving}
            title="Save Clip"
          >
            {isSaving ? '💾 SAVING...' : '💾 SAVE'}
          </button>
          <button 
            className="heph-header__btn heph-header__btn--clone" 
            onClick={handleSaveAs}
            disabled={isSaving}
            title="Save As... (Clone with new ID)"
          >
            📑 SAVE AS...
          </button>
          <button 
            className="heph-header__btn heph-header__btn--toggle" 
            onClick={() => setShowLibrary(!showLibrary)}
            title="Toggle Library"
          >
            📚
          </button>
          <button 
            className={`heph-header__btn heph-header__btn--toggle ${showRadar ? 'heph-header__btn--active' : ''}`}
            onClick={() => setShowRadar(!showRadar)}
            title="Toggle Radar Preview"
          >
            🛰
          </button>
        </div>
      </header>

      {/* ═══ MAIN WORKSPACE ═══ */}
      <div className="heph-workspace">
        {/* ── Library Panel (collapsible) - WAVE 2030.6 ── */}
        {showLibrary && (
          <div className="heph-library">
            <div className="heph-library__header">
              <span className="heph-library__title">📚 LIBRARY</span>
              {isLoadingLibrary && <span className="heph-library__loading">⏳</span>}
            </div>
            
            {/* ── Search Bar ── */}
            <div className="heph-library__search">
              <input
                type="text"
                className="heph-library__search-input"
                placeholder="🔍 Search clips..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button 
                  className="heph-library__search-clear"
                  onClick={() => setSearchQuery('')}
                >
                  ✕
                </button>
              )}
            </div>

            {/* ── Categorized List ── */}
            <div className="heph-library__list">
              {groupedLibrary.size === 0 ? (
                <div className="heph-library__empty">
                  {isLoadingLibrary 
                    ? 'Loading...' 
                    : searchQuery 
                      ? 'No matches found' 
                      : 'No clips saved yet'
                  }
                </div>
              ) : (
                Array.from(groupedLibrary.entries()).map(([category, items]) => (
                  <div key={category} className="heph-library__category">
                    {/* ── Category Header ── */}
                    <div 
                      className="heph-library__category-header"
                      onClick={() => handleCategoryToggle(category)}
                    >
                      <span className="heph-library__category-icon">
                        {getCategoryIcon(category)}
                      </span>
                      <span className="heph-library__category-name">
                        {category.toUpperCase()}
                      </span>
                      <span className="heph-library__category-count">
                        ({items.length})
                      </span>
                      <span className="heph-library__category-chevron">
                        {expandedCategories.has(category) ? '▼' : '▶'}
                      </span>
                    </div>
                    
                    {/* ── Category Items (collapsible) ── */}
                    {expandedCategories.has(category) && (
                      <div className="heph-library__category-items">
                        {items.map(item => (
                          <div 
                            key={item.id} 
                            className={`heph-library__item ${item.id === clip.id ? 'heph-library__item--active' : ''}`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, item)}
                          >
                            <div 
                              className="heph-library__item-info"
                              onClick={() => handleLoad(item.id)}
                            >
                              <span className="heph-library__item-icon">
                                {getCategoryIcon(item.category)}
                              </span>
                              <div className="heph-library__item-details">
                                <span className="heph-library__item-name">{item.name}</span>
                                <span className="heph-library__item-meta">
                                  {item.paramCount} params • {(item.durationMs / 1000).toFixed(1)}s
                                </span>
                              </div>
                              <span className="heph-library__item-drag-hint" title="Drag to Timeline">
                                ⋮⋮
                              </span>
                            </div>
                            <button 
                              className="heph-library__item-delete"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDelete(item.id)
                              }}
                              title="Delete"
                            >
                              🗑️
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Parameter Lanes (left sidebar) ── */}
        <div className="heph-param-sidebar">
          <div className="heph-param-sidebar__header">
            <span className="heph-param-sidebar__title">PARAMETERS</span>
          </div>
          <div className="heph-param-sidebar__lanes">
            {paramIds.length === 0 ? (
              /* ⚒️ WAVE 2040.20: EMPTY STATE — No parameters */
              <div className="heph-param-sidebar__empty">
                <span className="heph-param-sidebar__empty-icon">⚒️</span>
                <span className="heph-param-sidebar__empty-text">No parameters</span>
                <span className="heph-param-sidebar__empty-hint">Click + to add automation</span>
              </div>
            ) : (
              paramIds.map(paramId => (
                <ParameterLane
                  key={paramId}
                  paramId={paramId}
                  curve={clip.curves.get(paramId)!}
                  isActive={paramId === activeParam}
                  onClick={() => setActiveParam(paramId)}
                  onRemove={handleRemoveParam}
                />
              ))
            )}
          </div>
          
          {/* WAVE 2030.26: Add Parameter Popover (compact, subcategorized) */}
          {availableParams.length > 0 && (
            <div className="heph-add-param" ref={addParamRef}>
              <button 
                className="heph-add-param__btn"
                onClick={() => setShowAddParamDropdown(!showAddParamDropdown)}
                type="button"
              >
                <span>+</span>
                <span>ADD</span>
              </button>
              
              {showAddParamDropdown && (
                <div className="heph-add-param__popover">
                  <div className="heph-add-param__popover-header">
                    ADD PARAMETER
                  </div>
                  <div className="heph-add-param__popover-body">
                    {Array.from(groupedAvailableParams.entries()).map(([category, params]) => (
                      <div key={category} className="heph-add-param__group">
                        <div className="heph-add-param__group-label">
                          {PARAM_CATEGORIES[category].icon} {PARAM_CATEGORIES[category].label}
                        </div>
                        <div className="heph-add-param__group-items">
                          {params.map(paramId => {
                            const meta = PARAM_META[paramId]
                            return (
                              <button
                                key={paramId}
                                className="heph-add-param__chip"
                                onClick={() => handleAddParam(paramId)}
                                type="button"
                                style={{ '--chip-color': meta.color } as React.CSSProperties}
                              >
                                <span className="heph-add-param__chip-icon">{meta.icon}</span>
                                {meta.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ⚡ WAVE 2403.1: Phase Engine Toggle Button + Floating HUD */}
          <div className="heph-phase-trigger" ref={phasePanelRef}>
            <button
              className={`heph-phase-trigger__btn ${showPhasePanel ? 'heph-phase-trigger__btn--open' : ''} ${(clip.selector?.phase?.spread ?? 0) > 0 ? 'heph-phase-trigger__btn--active' : ''}`}
              onClick={() => setShowPhasePanel(!showPhasePanel)}
              type="button"
              title="Phase Distribution Engine"
            >
              <span className="heph-phase-trigger__icon">🌊</span>
              <span className="heph-phase-trigger__label">PHASE ENGINE</span>
              {(clip.selector?.phase?.spread ?? 0) > 0 && (
                <span className="heph-phase-trigger__badge">
                  {Math.round((clip.selector?.phase?.spread ?? 0) * 100)}%
                </span>
              )}
            </button>

            {/* ── Floating Panel ── */}
            {showPhasePanel && (
              <div className="heph-phase-float">
                <PhaseControls
                  config={clip.selector?.phase ?? null}
                  onChange={handlePhaseConfigChange}
                  fixtureCount={clip.zones.length}
                  disabled={isSaving}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Curve Editor + Radar (main area) ── */}
        <div className="heph-canvas-area">
          {/* ── CurveEditor ── */}
          <div className="heph-canvas-area__editor">
            {activeCurve ? (
              <CurveEditor
                curve={activeCurve}
                durationMs={clip.durationMs}
                selectedKeyframeIdx={selectedKeyframeIdx}
                playheadMs={playheadMs}
                bpm={liveBpm}
                onKeyframeAdd={handleKeyframeAdd}
                onKeyframeMove={handleKeyframeMove}
                onKeyframeDelete={handleKeyframeDelete}
                onInterpolationChange={handleInterpolationChange}
                onBezierHandleMove={handleBezierHandleMove}
                onKeyframeSelect={handleKeyframeSelect}
                onAudioBindingChange={handleAudioBindingChange}
                onDragStart={handleDragStartWithSnapshot}
                selectedIndices={selectedIndices}
                onMultiSelect={handleMultiSelect}
                onBatchKeyframeMove={handleBatchKeyframeMove}
                onScrub={setPlayheadMs}
                onCopyKeyframes={handleCopyKeyframes}
                onPasteAtTime={handlePasteAtTime}
                hasClipboard={clipboardRef.current.length > 0}
                initialViewport={temporal.viewport}
                onViewportChange={temporalActions.setViewport}
                onApplyShapeToSelection={handleApplyShapeToSelection}
                onBatchAudioBind={handleBatchAudioBind}
              />
            ) : (
              <div className="heph-no-curve">
                <span>No curve selected</span>
              </div>
            )}
          </div>

          {/* ── Radar Preview (WAVE 2030.25) ── */}
          {showRadar && (
            <div className="heph-canvas-area__radar">
              <div className="heph-canvas-area__radar-header">
                <span className="heph-canvas-area__radar-title">🛰 RADAR PREVIEW</span>
                <button
                  className="heph-canvas-area__radar-toggle"
                  onClick={() => setShowRadar(false)}
                  title="Hide Radar"
                >
                  ✕
                </button>
              </div>
              <div className="heph-canvas-area__radar-content">
                <HephRadar
                  preview={preview}
                  durationMs={clip.durationMs}
                  onPlay={preview.play}
                  onPause={preview.pause}
                  onStop={preview.stop}
                  onSeek={preview.seek}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ TOOLBAR ═══ */}
      <HephaestusToolbar
        activeCurve={activeCurve}
        selectedKeyframeIdx={selectedKeyframeIdx}
        clipDurationMs={clip.durationMs}
        onInterpolationChange={handleInterpolationChange}
        onModeChange={handleModeChange}
        onApplyBezierPreset={handleApplyBezierPreset}
        onApplyTemplate={handleApplyTemplate}
      />

      {/* ═══ NEW CLIP MODAL - WAVE 2030.8 ═══ */}
      <NewClipModal
        isOpen={showNewClipModal}
        onClose={() => setShowNewClipModal(false)}
        onCreate={handleCreateClip}
      />
    </div>
  )
}

export default HephaestusView
