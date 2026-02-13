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
import { getCategoryIcon } from './curveTemplates'
import { HephRadar } from './HephRadar'
import { useHephPreview } from './useHephPreview'
import { HephLogoIcon } from '../../icons/LuxIcons'
import type { 
  HephCurve, 
  HephParamId, 
  HephInterpolation, 
  HephCurveMode, 
  HephAutomationClip,
  HephAutomationClipSerialized,
  HephKeyframe 
} from '../../../core/hephaestus/types'
import type { EffectZone } from '../../../core/effects/types'
import { serializeHephClip, deserializeHephClip } from '../../../core/hephaestus/types'
import './HephaestusView.css'

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
  // ── State ──
  const [clip, setClip] = useState<HephAutomationClip>(() => createDummyClip())
  const [activeParam, setActiveParam] = useState<HephParamId>('intensity')
  const [selectedKeyframeIdx, setSelectedKeyframeIdx] = useState<number | null>(null)
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

  // ── WAVE 2030.26: Editable Header State ──
  const [isEditingName, setIsEditingName] = useState(false)
  const [editNameValue, setEditNameValue] = useState('')
  const [isEditingDuration, setIsEditingDuration] = useState(false)
  const [editDurationValue, setEditDurationValue] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)
  const durationInputRef = useRef<HTMLInputElement>(null)

  // ── WAVE 2030.26: Add Param Popover Ref (click-outside dismiss) ──
  const addParamRef = useRef<HTMLDivElement>(null)

  // ── Radar Preview State (WAVE 2030.25) ──
  const [showRadar, setShowRadar] = useState(true)
  const preview = useHephPreview(clip)

  /**
   * ⚒️ WAVE 2040.17: DIAMOND CACHE
   * Pre-cached serialized clips for zero-latency D&D to Chronos.
   * Key: filePath, Value: HephAutomationClipSerialized
   * Populated in background after library loads.
   */
  const clipCacheRef = useRef<Map<string, HephAutomationClipSerialized>>(new Map())

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
        setClip(loadedClip)
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

  // WAVE 2030.8: Create clip from modal and save immediately
  const handleCreateClip = useCallback(async (newClip: HephAutomationClip) => {
    setClip(newClip)
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
    setClip(prev => ({
      ...prev,
      zones
    }))
    setIsDirty(true)
  }, [])

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

  const handleKeyframeAdd = useCallback((timeMs: number, value: number) => {
    updateCurve(activeParam, curve => {
      const newKfs = [...curve.keyframes]
      // Insert sorted by timeMs
      const insertIdx = newKfs.findIndex(kf => kf.timeMs > timeMs)
      const newKf = {
        timeMs,
        value,
        interpolation: 'linear' as HephInterpolation,
      }
      if (insertIdx === -1) {
        newKfs.push(newKf)
      } else {
        newKfs.splice(insertIdx, 0, newKf)
      }
      return { ...curve, keyframes: newKfs }
    })
  }, [activeParam, updateCurve])

  const handleKeyframeMove = useCallback((index: number, timeMs: number, value: number) => {
    updateCurve(activeParam, curve => {
      const newKfs = [...curve.keyframes]
      newKfs[index] = { ...newKfs[index], timeMs, value }
      // Re-sort by timeMs to maintain invariant
      newKfs.sort((a, b) => a.timeMs - b.timeMs)
      return { ...curve, keyframes: newKfs }
    })
  }, [activeParam, updateCurve])

  const handleKeyframeDelete = useCallback((index: number) => {
    updateCurve(activeParam, curve => {
      if (curve.keyframes.length <= 1) return curve // Never delete last
      const newKfs = curve.keyframes.filter((_, i) => i !== index)
      return { ...curve, keyframes: newKfs }
    })
    setSelectedKeyframeIdx(null)
  }, [activeParam, updateCurve])

  const handleInterpolationChange = useCallback((index: number, interpolation: HephInterpolation) => {
    updateCurve(activeParam, curve => {
      const newKfs = [...curve.keyframes]
      newKfs[index] = { ...newKfs[index], interpolation }
      return { ...curve, keyframes: newKfs }
    })
  }, [activeParam, updateCurve])

  // WAVE 2030.14: Audio binding change handler
  const handleAudioBindingChange = useCallback((index: number, binding: import('../../../core/hephaestus/types').HephAudioBinding | undefined) => {
    updateCurve(activeParam, curve => {
      const newKfs = [...curve.keyframes]
      newKfs[index] = { ...newKfs[index], audioBinding: binding }
      return { ...curve, keyframes: newKfs }
    })
  }, [activeParam, updateCurve])

  const handleBezierHandleMove = useCallback((index: number, handles: [number, number, number, number]) => {
    updateCurve(activeParam, curve => {
      const newKfs = [...curve.keyframes]
      newKfs[index] = { ...newKfs[index], bezierHandles: handles, interpolation: 'bezier' }
      return { ...curve, keyframes: newKfs }
    })
  }, [activeParam, updateCurve])

  const handleKeyframeSelect = useCallback((index: number | null) => {
    setSelectedKeyframeIdx(index)
  }, [])

  const handleModeChange = useCallback((mode: HephCurveMode) => {
    updateCurve(activeParam, curve => ({ ...curve, mode }))
  }, [activeParam, updateCurve])

  // ═══════════════════════════════════════════════════════════════════════
  // WAVE 2030.8 — Parameter Add/Remove
  // ═══════════════════════════════════════════════════════════════════════

  const handleAddParam = useCallback((paramId: HephParamId) => {
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
    setClip((prev: HephAutomationClip): HephAutomationClip => {
      // Don't remove if it's the only curve
      if (prev.curves.size <= 1) {
        console.warn('[Hephaestus] Cannot remove last parameter')
        return prev
      }
      
      const newCurves = new Map(prev.curves)
      newCurves.delete(paramId)
      return { ...prev, curves: newCurves }
    })
    
    // If removing active param, switch to another
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
    updateCurve(activeParam, curve => ({
      ...curve,
      keyframes
    }))
    setSelectedKeyframeIdx(null)
    console.log(`[Hephaestus] Applied template with ${keyframes.length} keyframes`)
  }, [activeParam, updateCurve])

  const handleApplyBezierPreset = useCallback((index: number, handles: [number, number, number, number]) => {
    updateCurve(activeParam, curve => {
      const newKfs = [...curve.keyframes]
      newKfs[index] = { 
        ...newKfs[index], 
        interpolation: 'bezier',
        bezierHandles: handles 
      }
      return { ...curve, keyframes: newKfs }
    })
    console.log(`[Hephaestus] Applied bezier preset to keyframe ${index}`)
  }, [activeParam, updateCurve])

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
      setClip(prev => ({ ...prev, name: trimmed }))
      setIsDirty(true)
    }
    setIsEditingName(false)
  }, [editNameValue, clip.name])

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
        setClip(prev => ({ ...prev, durationMs: newMs }))
        setIsDirty(true)
      }
    }
    setIsEditingDuration(false)
  }, [editDurationValue, clip.durationMs])

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
            {paramIds.map(paramId => (
              <ParameterLane
                key={paramId}
                paramId={paramId}
                curve={clip.curves.get(paramId)!}
                isActive={paramId === activeParam}
                onClick={() => setActiveParam(paramId)}
                onRemove={paramIds.length > 1 ? handleRemoveParam : undefined}
              />
            ))}
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
                onKeyframeAdd={handleKeyframeAdd}
                onKeyframeMove={handleKeyframeMove}
                onKeyframeDelete={handleKeyframeDelete}
                onInterpolationChange={handleInterpolationChange}
                onBezierHandleMove={handleBezierHandleMove}
                onKeyframeSelect={handleKeyframeSelect}
                onAudioBindingChange={handleAudioBindingChange}
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
