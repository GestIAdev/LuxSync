/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ FORGE TAB — WAVE 7010: DAW LAYOUT TIER 3A
 * Sculpt workspace: Library + Parameter Lanes + Toolbar (elevated) + CurveEditor
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  HephaestusToolbar (48px, flex-shrink:0) — 👑 Presets coronando     │
 * ├──────────┬────────────┬──────────────────────────────────────────────┤
 * │ LIBRARY  │ PARAM LANES│              CURVE EDITOR (SVG)              │
 * │ (220px)  │ (200px)    │              Bezier + keyframes              │
 * │          │            │              Grid + snap + zoom/pan          │
 * └──────────┴────────────┴──────────────────────────────────────────────┘
 *
 * State reads directly from useHephaestusEditorStore (Zustand).
 * Only temporalActions + showAssetBrowser come from parent.
 *
 * @module views/HephaestusView/tabs/ForgeTab
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { CurveEditor } from '../CurveEditor'
import { ParameterLane, PARAM_META, ALL_PARAM_IDS, PARAM_CATEGORIES } from '../ParameterLane'
import type { ParamCategory } from '../ParameterLane'
import { HephaestusToolbar } from '../HephaestusToolbar'
import { getCategoryIcon, generateShapeInWindow } from '../curveTemplates'
import type { TemporalActions } from '../types/HephaestusShared'
import { useHephaestusEditorStore } from '../../../../core/hephaestus/store/useHephaestusEditorStore'
import { useAudioStore } from '../../../../stores/audioStore'
import type {
  HephCurve,
  HephParamId,
  HephInterpolation,
  HephCurveMode,
  HephAutomationClipV3,
  HephKeyframe,
  HephTrack,
  HephAudioBinding,
} from '../../../../core/hephaestus/types'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

interface LibraryClip {
  id: string
  name: string
  author: string
  category: string
  tags?: string[]
  durationMs: number
  paramCount: number
  modifiedAt: number
  filePath: string
  effectType?: string
}

const HEPH_DRAG_MIME = 'application/luxsync-heph'

interface ForgeTabProps {
  temporalActions: TemporalActions
  showAssetBrowser?: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getPlotValue(value: number | { h: number; s: number; l: number }, valueType: 'number' | 'color'): number {
  if (valueType === 'color' && typeof value === 'object' && 'h' in value) {
    return value.h / 360
  }
  return value as number
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const ForgeTab: React.FC<ForgeTabProps> = ({ temporalActions, showAssetBrowser = true }) => {
  // ── Store (canonical state) ──
  const clip = useHephaestusEditorStore(state => state.clip)
  const activeTrackId = useHephaestusEditorStore(state => state.selection.activeTrackId)
  const selectTrack = useHephaestusEditorStore(state => state.selectTrack)
  const viewport = useHephaestusEditorStore(state => state.viewport)
  const setStoreViewport = useHephaestusEditorStore(state => state.setViewport)
  const undoStackLen = useHephaestusEditorStore(state => state._undoStack.length)
  const redoStackLen = useHephaestusEditorStore(state => state._redoStack.length)

  // ── setClip shim (same pattern as index.tsx) ──
  const setClip = useCallback((updater: (prev: HephAutomationClipV3) => HephAutomationClipV3) => {
    const currentClip = useHephaestusEditorStore.getState().clip
    if (!currentClip) return
    const nextClip = updater(currentClip)
    useHephaestusEditorStore.setState({ clip: nextClip, isDirty: true })
  }, [])

  // ── Local UI State ──
  const [selectedKeyframeIdx, setSelectedKeyframeIdx] = useState<number | null>(null)
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
  const [playheadMs, setPlayheadMs] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [showAddParamDropdown, setShowAddParamDropdown] = useState(false)

  // ── Library State ──
  const [library, setLibrary] = useState<LibraryClip[]>([])
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false)

  // ── Refs ──
  const addParamRef = useRef<HTMLDivElement>(null)
  const clipCacheRef = useRef<Map<string, HephAutomationClipV3>>(new Map())
  const batchOriginRef = useRef<Map<number, { timeMs: number; value: number | { h: number; s: number; l: number } }>>(new Map())
  const clipboardRef = useRef<Array<{
    relativeTimeMs: number
    value: number | { h: number; s: number; l: number }
    interpolation: 'hold' | 'linear' | 'bezier'
    bezierHandles?: [number, number, number, number]
  }>>([])

  // ── BPM from audio store ──
  const audioStoreBpm = useAudioStore(state => state.bpm)
  const liveBpm = audioStoreBpm || 120

  // ═══════════════════════════════════════════════════════════════════════
  // DERIVED
  // ═══════════════════════════════════════════════════════════════════════

  const activeCurve = useMemo(() => {
    if (!clip || !activeTrackId) return null
    const track = clip.tracks.find(t => t.id === activeTrackId)
    return track ? track.curve : null
  }, [clip, activeTrackId])

  const paramIds = useMemo<HephParamId[]>(() => {
    if (!clip) return []
    return Array.from(new Set(clip.tracks.map(t => t.paramId)))
  }, [clip])

  const availableParams = useMemo<HephParamId[]>(() => {
    if (!clip) return ALL_PARAM_IDS
    const used = new Set(clip.tracks.map(t => t.paramId))
    return ALL_PARAM_IDS.filter(p => !used.has(p))
  }, [clip])

  const activeParam = useMemo<HephParamId | null>(() => {
    if (!clip || !activeTrackId) return null
    const track = clip.tracks.find(t => t.id === activeTrackId)
    return track ? track.paramId : null
  }, [clip, activeTrackId])

  const setActiveParam = useCallback((paramId: HephParamId) => {
    const currentClip = useHephaestusEditorStore.getState().clip
    if (!currentClip) return
    const track = currentClip.tracks.find(t => t.paramId === paramId)
    if (track) selectTrack(track.id)
  }, [selectTrack])

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
      const hephTag = item.tags?.find(t => t.startsWith('heph:'))
      const category = hephTag ? hephTag.replace('heph:', '') : (item.category || 'uncategorized')
      if (!groups.has(category)) {
        groups.set(category, [])
      }
      groups.get(category)!.push(item)
    }
    return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])))
  }, [filteredLibrary])

  // ═══════════════════════════════════════════════════════════════════════
  // EFFECTS
  // ═══════════════════════════════════════════════════════════════════════

  // Auto-expand all categories when there's a search query
  useEffect(() => {
    if (searchQuery.trim()) {
      setExpandedCategories(new Set(groupedLibrary.keys()))
    }
  }, [searchQuery, groupedLibrary])

  // Load library on mount
  useEffect(() => {
    loadLibrary()
  }, [])

  // Click-outside dismiss for Add Param popover
  useEffect(() => {
    if (!showAddParamDropdown) return
    const handleClickOutside = (e: MouseEvent) => {
      if (addParamRef.current && !addParamRef.current.contains(e.target as Node)) {
        setShowAddParamDropdown(false)
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showAddParamDropdown])

  // ═══════════════════════════════════════════════════════════════════════
  // LIBRARY I/O
  // ═══════════════════════════════════════════════════════════════════════

  const loadLibrary = useCallback(async () => {
    if (!window.luxsync?.hephaestus?.list) {
      console.warn('[ForgeTab] IPC not available, using demo mode')
      return
    }

    setIsLoadingLibrary(true)
    try {
      const result = await window.luxsync.hephaestus.list()
      if (result.success && result.clips) {
        const loadedClips = result.clips as LibraryClip[]
        setLibrary(loadedClips)
        console.log(`[ForgeTab] Loaded ${loadedClips.length} clips from library`)

        if (window.luxsync?.hephaestus?.load) {
          for (const item of loadedClips) {
            if (!clipCacheRef.current.has(item.filePath)) {
              try {
                const loadResult = await window.luxsync.hephaestus.load(item.filePath)
                if (loadResult.success && loadResult.clip) {
                  clipCacheRef.current.set(item.filePath, loadResult.clip as HephAutomationClipV3)
                }
              } catch (e) {
                console.warn(`[ForgeTab] Cache miss for ${item.name}:`, e)
              }
            }
          }
          console.log(`[ForgeTab] Diamond cache loaded: ${clipCacheRef.current.size} clips`)
        }
      } else if (result.error) {
        console.error('[ForgeTab] Failed to load library:', result.error)
      }
    } catch (error) {
      console.error('[ForgeTab] Library load error:', error)
    } finally {
      setIsLoadingLibrary(false)
    }
  }, [])

  const handleLoad = useCallback(async (clipId: string) => {
    if (!window.luxsync?.hephaestus?.load) {
      console.warn('[ForgeTab] IPC not available, cannot load')
      return
    }

    try {
      const result = await window.luxsync.hephaestus.load(clipId)
      if (result.success && result.clip) {
        const v3Clip = result.clip as HephAutomationClipV3
        temporalActions.resetWithClip(v3Clip)
        setSelectedKeyframeIdx(null)
        console.log(`[ForgeTab] Loaded clip: ${v3Clip.name}`)
      } else {
        console.error('[ForgeTab] Load failed:', result.error)
      }
    } catch (error) {
      console.error('[ForgeTab] Load error:', error)
    }
  }, [temporalActions])

  const handleDelete = useCallback(async (clipId: string) => {
    if (!window.luxsync?.hephaestus?.delete) {
      console.warn('[ForgeTab] IPC not available, cannot delete')
      return
    }

    if (!confirm('Delete this clip permanently?')) return

    try {
      const result = await window.luxsync.hephaestus.delete(clipId)
      if (result.success && result.deleted) {
        console.log(`[ForgeTab] Deleted clip: ${clipId}`)
        await loadLibrary()
      }
    } catch (error) {
      console.error('[ForgeTab] Delete error:', error)
    }
  }, [loadLibrary])

  // ═══════════════════════════════════════════════════════════════════════
  // LIBRARY INTERACTION
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

  const handleDragStart = useCallback((e: React.DragEvent, libraryItem: LibraryClip) => {
    const cachedClip = clipCacheRef.current.get(libraryItem.filePath)

    if (cachedClip) {
      console.log(`[ForgeTab] Diamond drag: ${libraryItem.name} [${cachedClip.tracks.length} tracks]`)
    } else {
      console.warn(`[ForgeTab] Drag without Diamond data (cache miss): ${libraryItem.name}`)
    }

    const payload = {
      source: 'hephaestus' as const,
      clipType: 'fx' as const,
      subType: cachedClip?.effectType || libraryItem.category || 'heph-automation',
      defaultDurationMs: libraryItem.durationMs,
      hephClipId: libraryItem.id,
      hephFilePath: libraryItem.filePath,
      name: libraryItem.name,
      hephClipSerialized: cachedClip || undefined,
      category: cachedClip?.category || libraryItem.category,
      mixBus: cachedClip?.mixBus,
      effectType: cachedClip?.effectType || libraryItem.effectType,
      zones: cachedClip?.spatialZones,
      priority: cachedClip?.priority,
    }

    const payloadJson = JSON.stringify(payload)
    e.dataTransfer.setData('application/luxsync-fx', payloadJson)
    e.dataTransfer.setData('application/luxsync-clip', payloadJson)
    e.dataTransfer.setData(HEPH_DRAG_MIME, payloadJson)
    e.dataTransfer.effectAllowed = 'copy'
  }, [])

  // ═══════════════════════════════════════════════════════════════════════
  // CURVE MUTATIONS
  // ═══════════════════════════════════════════════════════════════════════

  const updateCurve = useCallback((paramId: HephParamId | null, updater: (curve: HephCurve) => HephCurve) => {
    if (!paramId) return
    setClip((prev: HephAutomationClipV3): HephAutomationClipV3 => {
      const trackIdx = prev.tracks.findIndex(t => t.paramId === paramId)
      if (trackIdx === -1) return prev
      const existing = prev.tracks[trackIdx].curve
      const newTracks = [...prev.tracks]
      newTracks[trackIdx] = { ...newTracks[trackIdx], curve: updater(existing) }
      return { ...prev, tracks: newTracks }
    })
  }, [])

  const updateCurveWithSnapshot = useCallback((paramId: HephParamId | null, updater: (curve: HephCurve) => HephCurve) => {
    if (!paramId) return
    temporalActions.snapshot()
    updateCurve(paramId, updater)
  }, [temporalActions, updateCurve])

  const handleKeyframeAdd = useCallback((timeMs: number, value: number) => {
    updateCurveWithSnapshot(activeParam, curve => {
      const newKfs = [...curve.keyframes]
      const insertIdx = newKfs.findIndex(kf => kf.timeMs > timeMs)

      let kfValue: number | { h: number; s: number; l: number } = value
      if (curve.valueType === 'color') {
        const hue = Math.max(0, Math.min(value * 360, 360))
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

        newKfs.sort((a, b) => a.timeMs - b.timeMs)
        return { ...curve, keyframes: newKfs }
      }

      let kfValue: number | { h: number; s: number; l: number } = value
      if (curve.valueType === 'color') {
        const hue = Math.max(0, Math.min(value * 360, 360))
        const origHSL = existing && typeof existing.value === 'object' && 'h' in existing.value
          ? existing.value
          : (typeof curve.defaultValue === 'object' ? curve.defaultValue as { h: number; s: number; l: number } : { h: 0, s: 100, l: 50 })
        kfValue = { h: hue, s: origHSL.s, l: origHSL.l }
      }

      newKfs[index] = { ...newKfs[index], timeMs, value: kfValue }
      newKfs.sort((a, b) => a.timeMs - b.timeMs)
      return { ...curve, keyframes: newKfs }
    })
  }, [activeParam, updateCurve, selectedIndices, clip.durationMs])

  const handleDragStartWithSnapshot = useCallback(() => {
    temporalActions.snapshot()
    const origins = new Map<number, { timeMs: number; value: number | { h: number; s: number; l: number } }>()
    if (activeCurve) {
      for (const idx of selectedIndices) {
        const kf = activeCurve.keyframes[idx]
        if (kf) {
          origins.set(idx, { timeMs: kf.timeMs, value: kf.value })
        }
      }
    }
    batchOriginRef.current = origins
  }, [temporalActions, activeCurve, selectedIndices])

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

      newKfs.sort((a, b) => a.timeMs - b.timeMs)
      return { ...curve, keyframes: newKfs }
    })
  }, [activeParam, updateCurve, clip.durationMs])

  const handleKeyframeDelete = useCallback((index: number) => {
    updateCurveWithSnapshot(activeParam, curve => {
      if (curve.keyframes.length <= 1) return curve
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

  const handleAudioBindingChange = useCallback((index: number, binding: HephAudioBinding | undefined) => {
    updateCurveWithSnapshot(activeParam, curve => {
      const newKfs = [...curve.keyframes]
      newKfs[index] = { ...newKfs[index], audioBinding: binding }
      return { ...curve, keyframes: newKfs }
    })
  }, [activeParam, updateCurveWithSnapshot])

  const handleBatchAudioBind = useCallback((source: HephAudioBinding['source']) => {
    if (selectedIndices.size === 0) return

    updateCurveWithSnapshot(activeParam, curve => {
      const newKfs = [...curve.keyframes]
      for (const idx of selectedIndices) {
        if (idx < 0 || idx >= newKfs.length) continue
        if (source === 'none') {
          newKfs[idx] = { ...newKfs[idx], audioBinding: undefined }
        } else {
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
    if (index !== null) {
      setSelectedIndices(new Set([index]))
    } else {
      setSelectedIndices(new Set())
    }
  }, [])

  const handleMultiSelect = useCallback((indices: Set<number>) => {
    setSelectedIndices(indices)
    if (indices.size > 0) {
      const arr = Array.from(indices)
      setSelectedKeyframeIdx(arr[arr.length - 1])
    } else {
      setSelectedKeyframeIdx(null)
    }
  }, [])

  const handleCopyKeyframes = useCallback(() => {
    if (selectedIndices.size === 0 || !activeCurve) return

    const selectedKfs = Array.from(selectedIndices)
      .filter(idx => idx >= 0 && idx < activeCurve.keyframes.length)
      .map(idx => activeCurve.keyframes[idx])
      .sort((a, b) => a.timeMs - b.timeMs)

    if (selectedKfs.length === 0) return

    const timeOffset = selectedKfs[0].timeMs
    clipboardRef.current = selectedKfs.map(kf => ({
      relativeTimeMs: kf.timeMs - timeOffset,
      value: kf.value,
      interpolation: kf.interpolation,
      bezierHandles: kf.bezierHandles,
    }))
  }, [selectedIndices, activeCurve])

  const handlePasteKeyframes = useCallback(() => {
    if (clipboardRef.current.length === 0 || !activeCurve) return

    const baseTimeMs = playheadMs
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
  }, [activeCurve, playheadMs, activeParam, updateCurve, temporalActions, clip.durationMs])

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

    setPlayheadMs(targetTimeMs)
  }, [activeCurve, activeParam, updateCurve, temporalActions, clip.durationMs])

  const handleModeChange = useCallback((mode: HephCurveMode) => {
    updateCurveWithSnapshot(activeParam, curve => ({ ...curve, mode }))
  }, [activeParam, updateCurveWithSnapshot])

  // ═══════════════════════════════════════════════════════════════════════
  // KEYBOARD HANDLER (Undo/Redo + Copy/Paste)
  // ═══════════════════════════════════════════════════════════════════════

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          temporalActions.redo()
        } else {
          temporalActions.undo()
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        temporalActions.redo()
      }

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
  // PARAMETER ADD/REMOVE
  // ═══════════════════════════════════════════════════════════════════════

  const handleAddParam = useCallback((paramId: HephParamId) => {
    temporalActions.snapshot()
    setClip((prev: HephAutomationClipV3): HephAutomationClipV3 => {
      if (prev.tracks.some(t => t.paramId === paramId)) return prev

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

      const newTrack: HephTrack = {
        id: crypto.randomUUID(),
        paramId,
        zones: prev.spatialZones.length > 0 ? [...prev.spatialZones] : ['all'],
        curve: newCurve,
        blendMode: paramId === 'intensity' ? 'max' : 'replace',
      }

      return { ...prev, tracks: [...prev.tracks, newTrack] }
    })
    setActiveParam(paramId)
    setShowAddParamDropdown(false)
  }, [temporalActions, setActiveParam])

  const handleRemoveParam = useCallback((paramId: HephParamId) => {
    temporalActions.snapshot()
    setClip((prev: HephAutomationClipV3): HephAutomationClipV3 => {
      if (!prev.tracks.some(t => t.paramId === paramId)) return prev
      return { ...prev, tracks: prev.tracks.filter(t => t.paramId !== paramId) }
    })

    if (activeParam === paramId) {
      const remaining = paramIds.filter(p => p !== paramId)
      if (remaining.length > 0) {
        setActiveParam(remaining[0] as HephParamId)
      } else {
        selectTrack(null)
      }
    }
    setSelectedKeyframeIdx(null)
  }, [temporalActions, activeParam, paramIds, selectTrack, setActiveParam])

  // ═══════════════════════════════════════════════════════════════════════
  // TEMPLATE & BEZIER PRESETS
  // ═══════════════════════════════════════════════════════════════════════

  const handleApplyTemplate = useCallback((keyframes: HephKeyframe[]) => {
    updateCurveWithSnapshot(activeParam, curve => ({
      ...curve,
      keyframes
    }))
    setSelectedKeyframeIdx(null)
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
  }, [activeParam, updateCurveWithSnapshot])

  const handleApplyShapeToSelection = useCallback((shapeId: string) => {
    if (selectedIndices.size < 2) return
    if (!activeCurve) return

    const selectedKfs = Array.from(selectedIndices)
      .filter(i => i >= 0 && i < activeCurve.keyframes.length)
      .map(i => activeCurve.keyframes[i])

    if (selectedKfs.length < 2) return

    const startTimeMs = Math.min(...selectedKfs.map(kf => kf.timeMs))
    const endTimeMs = Math.max(...selectedKfs.map(kf => kf.timeMs))

    if (endTimeMs <= startTimeMs) return

    const [rangeMin, rangeMax] = activeCurve.range

    const shapeKeyframes = generateShapeInWindow(
      shapeId,
      startTimeMs,
      endTimeMs,
      rangeMin,
      rangeMax,
      1,
    )

    if (shapeKeyframes.length === 0) return

    updateCurveWithSnapshot(activeParam, curveData => {
      const keptKeyframes = curveData.keyframes.filter((_, i) => !selectedIndices.has(i))
      const merged = [...keptKeyframes, ...shapeKeyframes].sort((a, b) => a.timeMs - b.timeMs)
      return { ...curveData, keyframes: merged }
    })

    if (activeCurve) {
      setTimeout(() => {
        const currentTrack = useHephaestusEditorStore.getState().clip?.tracks.find(t => t.id === activeTrackId)
        if (!currentTrack) return
        const newSelection = new Set<number>()
        for (const shapeKf of shapeKeyframes) {
          const idx = currentTrack.curve.keyframes.findIndex(kf => kf.timeMs === shapeKf.timeMs)
          if (idx >= 0) newSelection.add(idx)
        }
        setSelectedIndices(newSelection)
      }, 0)
    }

    setSelectedKeyframeIdx(null)
  }, [activeParam, activeCurve, activeTrackId, selectedIndices, updateCurveWithSnapshot])

  // ═══════════════════════════════════════════════════════════════════════
  // VIEWPORT ADAPTER
  // ═══════════════════════════════════════════════════════════════════════

  const handleViewportChange = useCallback((vp: { zoom: number; scrollX: number }) => {
    setStoreViewport(vp)
  }, [setStoreViewport])

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="heph-forge-tab">
      {/* 👑 TOOLBAR — Elevated to top (WAVE 7010: Presets coronando la vista) */}
      <HephaestusToolbar
        activeCurve={activeCurve}
        selectedKeyframeIdx={selectedKeyframeIdx}
        clipDurationMs={clip.durationMs}
        onInterpolationChange={handleInterpolationChange}
        onModeChange={handleModeChange}
        onApplyBezierPreset={handleApplyBezierPreset}
        onApplyTemplate={handleApplyTemplate}
      />

      {/* ── Three-column body ── */}
      <div className="heph-forge-body">
        {/* ── Library Panel (collapsible) ── */}
        {showAssetBrowser && (
          <div className="heph-library">
            <div className="heph-library__header">
              <span className="heph-library__title">📚 LIBRARY</span>
              {isLoadingLibrary && <span className="heph-library__loading">⏳</span>}
            </div>

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
              <div className="heph-param-sidebar__empty">
                <span className="heph-param-sidebar__empty-icon">⚒️</span>
                <span className="heph-param-sidebar__empty-text">No parameters</span>
                <span className="heph-param-sidebar__empty-hint">Click + to add automation</span>
              </div>
            ) : (
              paramIds.map(paramId => {
                const track = clip.tracks.find(t => t.paramId === paramId)
                return (
                  <ParameterLane
                    key={paramId}
                    paramId={paramId}
                    curve={track!.curve}
                    isActive={paramId === activeParam}
                    onClick={() => setActiveParam(paramId)}
                    onRemove={handleRemoveParam}
                  />
                )
              })
            )}
          </div>

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

        {/* ── Curve Editor (main canvas area) ── */}
        <div className="heph-canvas-area">
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
                initialViewport={{ zoom: viewport.zoom, scrollX: viewport.scrollX }}
                onViewportChange={handleViewportChange}
                onApplyShapeToSelection={handleApplyShapeToSelection}
                onBatchAudioBind={handleBatchAudioBind}
              />
            ) : (
              <div className="heph-no-curve">
                <span>No curve selected</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
