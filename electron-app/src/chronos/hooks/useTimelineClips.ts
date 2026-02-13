/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎬 USE TIMELINE CLIPS - WAVE 2006: THE INTERACTIVE CANVAS
 * 
 * State management hook for timeline clips.
 * Handles clip CRUD, selection, drag operations, and snapping.
 * 
 * FEATURES:
 * - Clip collection management (add, remove, update)
 * - Selection state (single/multi-select)
 * - Move and resize with undo support
 * - Beat grid snapping (magnetic grid)
 * - Track-specific clip filtering
 * 
 * @module chronos/hooks/useTimelineClips
 * @version WAVE 2006
 */

import React, { useState, useCallback, useRef, useMemo } from 'react'
import { 
  type TimelineClip, 
  type VibeClip, 
  type FXClip,
  type VibeType,
  type FXType,
  type DragPayload,
  createVibeClip,
  createFXClip,
  createHephFXClip, // WAVE 2030.17: THE BRIDGE
  calculateBeatGrid,
  snapToGrid,
  generateClipId,
} from '../core/TimelineClip'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface UseTimelineClipsOptions {
  /** BPM for snap grid */
  bpm: number
  
  /** Total duration in ms */
  durationMs: number
  
  /** Snap threshold in ms */
  snapThresholdMs?: number
  
  /** Enable snapping by default */
  snapEnabled?: boolean
}

export interface UseTimelineClipsReturn {
  /** All clips */
  clips: TimelineClip[]
  
  /** Selected clip IDs */
  selectedIds: Set<string>
  
  /** Is snapping enabled */
  snapEnabled: boolean
  
  /** Last snap position (for visual feedback) */
  snapPosition: number | null
  
  /** Beat grid positions in ms */
  beatGrid: number[]
  
  // Actions
  addClip: (clip: TimelineClip) => void
  removeClip: (clipId: string) => void
  updateClip: (clipId: string, updates: Partial<TimelineClip>) => void
  selectClip: (clipId: string, addToSelection?: boolean) => void
  selectAll: () => void
  deselectAll: () => void
  deleteSelected: () => void
  
  // 🧠 WAVE 2014.5: Direct clip setter for load/new operations
  setClips: React.Dispatch<React.SetStateAction<TimelineClip[]>>
  
  // WAVE 2007: Advanced operations
  duplicateSelected: () => void
  duplicateClip: (clipId: string) => TimelineClip | null
  pasteClips: (clips: TimelineClip[], targetTimeMs: number) => void
  splitClipAtTime: (clipId: string, timeMs: number) => void
  
  // Drag & Drop
  createClipFromDrop: (payload: DragPayload, timeMs: number, trackId: string) => TimelineClip | null
  moveClip: (clipId: string, newStartMs: number) => void
  resizeClip: (clipId: string, edge: 'left' | 'right', newTimeMs: number) => void
  
  // Snapping
  toggleSnap: () => void
  snapTime: (timeMs: number) => [number, boolean]
  
  // Getters
  getClipsForTrack: (trackId: string) => TimelineClip[]
  getClipById: (clipId: string) => TimelineClip | undefined
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════

export function useTimelineClips(options: UseTimelineClipsOptions): UseTimelineClipsReturn {
  const { bpm, durationMs, snapThresholdMs = 100 } = options
  
  // State
  const [clips, setClips] = useState<TimelineClip[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [snapEnabled, setSnapEnabled] = useState(options.snapEnabled ?? true)
  const [snapPosition, setSnapPosition] = useState<number | null>(null)
  
  // Compute beat grid
  const beatGrid = useMemo(() => {
    return calculateBeatGrid(bpm, durationMs)
  }, [bpm, durationMs])
  
  // ═══════════════════════════════════════════════════════════════════════
  // SNAPPING
  // ═══════════════════════════════════════════════════════════════════════
  
  const snapTime = useCallback((timeMs: number): [number, boolean] => {
    if (!snapEnabled) {
      setSnapPosition(null)
      return [timeMs, false]
    }
    
    const [snapped, didSnap, snapBeat] = snapToGrid(timeMs, beatGrid, snapThresholdMs)
    
    if (didSnap && snapBeat !== null) {
      setSnapPosition(snapBeat)
      // Clear snap indicator after 300ms
      setTimeout(() => setSnapPosition(null), 300)
    } else {
      setSnapPosition(null)
    }
    
    return [snapped, didSnap]
  }, [snapEnabled, beatGrid, snapThresholdMs])
  
  const toggleSnap = useCallback(() => {
    setSnapEnabled(prev => !prev)
  }, [])
  
  // ═══════════════════════════════════════════════════════════════════════
  // CLIP MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════
  
  const addClip = useCallback((clip: TimelineClip) => {
    setClips(prev => [...prev, clip])
  }, [])
  
  const removeClip = useCallback((clipId: string) => {
    setClips(prev => prev.filter(c => c.id !== clipId))
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.delete(clipId)
      return next
    })
  }, [])
  
  const updateClip = useCallback((clipId: string, updates: Partial<TimelineClip>) => {
    setClips(prev => prev.map(clip => 
      clip.id === clipId ? { ...clip, ...updates } as TimelineClip : clip
    ))
  }, [])
  
  const getClipById = useCallback((clipId: string): TimelineClip | undefined => {
    return clips.find(c => c.id === clipId)
  }, [clips])
  
  const getClipsForTrack = useCallback((trackId: string): TimelineClip[] => {
    return clips.filter(c => c.trackId === trackId)
  }, [clips])
  
  // ═══════════════════════════════════════════════════════════════════════
  // SELECTION
  // ═══════════════════════════════════════════════════════════════════════
  
  const selectClip = useCallback((clipId: string, addToSelection = false) => {
    setSelectedIds(prev => {
      if (addToSelection) {
        const next = new Set(prev)
        if (next.has(clipId)) {
          next.delete(clipId)
        } else {
          next.add(clipId)
        }
        return next
      } else {
        return new Set([clipId])
      }
    })
  }, [])
  
  const deselectAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])
  
  const deleteSelected = useCallback(() => {
    setClips(prev => prev.filter(c => !selectedIds.has(c.id)))
    setSelectedIds(new Set())
  }, [selectedIds])
  
  // ═══════════════════════════════════════════════════════════════════════
  // DRAG & DROP FROM ARSENAL
  // ═══════════════════════════════════════════════════════════════════════
  
  const createClipFromDrop = useCallback((
    payload: DragPayload, 
    timeMs: number, 
    trackId: string
  ): TimelineClip | null => {
    // Snap to grid
    const [snappedTime] = snapTime(timeMs)
    
    if (payload.clipType === 'vibe') {
      const clip = createVibeClip(
        payload.subType as VibeType,
        snappedTime,
        payload.defaultDurationMs,
        trackId
      )
      addClip(clip)
      selectClip(clip.id)
      return clip
    } else if (payload.clipType === 'fx') {
      // ⚒️ WAVE 2030.17 → 2040.17: THE DIAMOND BRIDGE
      // Check if this is a Hephaestus custom clip
      if (payload.source === 'hephaestus' && payload.hephFilePath) {
        const clip = createHephFXClip(
          payload.name ?? 'Custom FX',
          payload.hephFilePath,
          snappedTime,
          payload.defaultDurationMs,
          trackId,
          payload.subType,
          // WAVE 2040.17: Full Diamond Data from DragPayload
          payload.hephClipSerialized,
          payload.mixBus,
          payload.zones,
          payload.priority,
        )
        addClip(clip)
        selectClip(clip.id)
        console.log(`[useTimelineClips] ⚒️💎 Created Hephaestus Diamond clip: ${clip.label} [mixBus=${payload.mixBus || 'none'}, curves=${payload.hephClipSerialized ? Object.keys(payload.hephClipSerialized.curves).length : 0}]`)
        return clip
      }
      
      // Standard FX clip from Arsenal
      const clip = createFXClip(
        payload.subType as FXType,
        snappedTime,
        payload.defaultDurationMs,
        trackId
      )
      addClip(clip)
      selectClip(clip.id)
      return clip
    }
    
    return null
  }, [snapTime, addClip, selectClip])
  
  // ═══════════════════════════════════════════════════════════════════════
  // MOVE & RESIZE
  // ═══════════════════════════════════════════════════════════════════════
  
  const moveClip = useCallback((clipId: string, newStartMs: number) => {
    const clip = clips.find(c => c.id === clipId)
    if (!clip || clip.locked) return
    
    const duration = clip.endMs - clip.startMs
    const [snappedStart] = snapTime(Math.max(0, newStartMs))
    
    updateClip(clipId, {
      startMs: snappedStart,
      endMs: snappedStart + duration,
    })
  }, [clips, snapTime, updateClip])
  
  const resizeClip = useCallback((clipId: string, edge: 'left' | 'right', newTimeMs: number) => {
    const clip = clips.find(c => c.id === clipId)
    if (!clip || clip.locked) return
    
    const [snappedTime] = snapTime(Math.max(0, newTimeMs))
    const minDuration = 500 // 500ms minimum
    
    if (edge === 'left') {
      const maxStart = clip.endMs - minDuration
      const newStart = Math.min(snappedTime, maxStart)
      updateClip(clipId, { startMs: newStart })
    } else {
      const minEnd = clip.startMs + minDuration
      const newEnd = Math.max(snappedTime, minEnd)
      updateClip(clipId, { endMs: newEnd })
    }
  }, [clips, snapTime, updateClip])
  
  // ═══════════════════════════════════════════════════════════════════════
  // WAVE 2007: ADVANCED OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════
  
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(clips.map(c => c.id)))
  }, [clips])
  
  const duplicateClip = useCallback((clipId: string): TimelineClip | null => {
    const original = clips.find(c => c.id === clipId)
    if (!original) return null
    
    const duration = original.endMs - original.startMs
    const newClip: TimelineClip = {
      ...original,
      id: generateClipId(),
      startMs: original.endMs,
      endMs: original.endMs + duration,
      selected: false,
    }
    
    setClips(prev => [...prev, newClip])
    selectClip(newClip.id)
    
    return newClip
  }, [clips, selectClip])
  
  const duplicateSelected = useCallback(() => {
    const selectedClips = clips.filter(c => selectedIds.has(c.id))
    if (selectedClips.length === 0) return
    
    // Find the rightmost end position
    const maxEnd = Math.max(...selectedClips.map(c => c.endMs))
    const minStart = Math.min(...selectedClips.map(c => c.startMs))
    const offset = maxEnd - minStart
    
    const newClips: TimelineClip[] = selectedClips.map(original => ({
      ...original,
      id: generateClipId(),
      startMs: original.startMs + offset,
      endMs: original.endMs + offset,
      selected: false,
    }))
    
    setClips(prev => [...prev, ...newClips])
    setSelectedIds(new Set(newClips.map(c => c.id)))
  }, [clips, selectedIds])
  
  const pasteClips = useCallback((clipsToPaste: TimelineClip[], targetTimeMs: number) => {
    if (clipsToPaste.length === 0) return
    
    // Find the earliest start time in the clipboard
    const minStart = Math.min(...clipsToPaste.map(c => c.startMs))
    const offset = targetTimeMs - minStart
    
    const newClips: TimelineClip[] = clipsToPaste.map(original => ({
      ...original,
      id: generateClipId(),
      startMs: original.startMs + offset,
      endMs: original.endMs + offset,
      selected: false,
    }))
    
    setClips(prev => [...prev, ...newClips])
    setSelectedIds(new Set(newClips.map(c => c.id)))
  }, [])
  
  const splitClipAtTime = useCallback((clipId: string, timeMs: number) => {
    const clip = clips.find(c => c.id === clipId)
    if (!clip) return
    
    // Only split if time is within clip bounds
    if (timeMs <= clip.startMs || timeMs >= clip.endMs) return
    
    // Create second half
    const secondHalf: TimelineClip = {
      ...clip,
      id: generateClipId(),
      startMs: timeMs,
      label: `${clip.label} (2)`,
    }
    
    // Update first half (shorten)
    updateClip(clipId, { 
      endMs: timeMs,
      label: `${clip.label} (1)`,
    })
    
    // Add second half
    setClips(prev => [...prev, secondHalf])
  }, [clips, updateClip])
  
  // ═══════════════════════════════════════════════════════════════════════
  // RETURN
  // ═══════════════════════════════════════════════════════════════════════
  
  return {
    clips,
    selectedIds,
    snapEnabled,
    snapPosition,
    beatGrid,
    
    addClip,
    removeClip,
    updateClip,
    selectClip,
    selectAll,
    deselectAll,
    deleteSelected,
    
    // 🧠 WAVE 2014.5: Direct clip setter for load/new operations
    setClips,
    
    // WAVE 2007: Advanced operations
    duplicateSelected,
    duplicateClip,
    pasteClips,
    splitClipAtTime,
    
    createClipFromDrop,
    moveClip,
    resizeClip,
    
    toggleSnap,
    snapTime,
    
    getClipsForTrack,
    getClipById,
  }
}
