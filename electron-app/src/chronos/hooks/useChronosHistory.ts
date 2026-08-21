/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⏮️⏭️ CHRONOS HISTORY - WAVE 7565.4: THE TIME TRAVELER
 *
 * Undo/Redo stack for the Chronos timeline. Wraps `useTimelineClips` and
 * snapshots the clips array before each destructive operation.
 *
 * Design inspired by Hephaestus' 200-step Immer-patch history, but adapted
 * to Chronos' architecture (React useState clips, not Zustand/Immer).
 * Uses full-array snapshots (clips arrays are small — typically <100 clips,
 * each <2KB serialized — so 200 snapshots ≈ 40MB max, acceptable).
 *
 * @module chronos/hooks/useChronosHistory
 * @version WAVE 7565.4
 */

import { useState, useCallback, useRef, useMemo } from 'react'
import {
  useTimelineClips,
  type UseTimelineClipsOptions,
  type UseTimelineClipsReturn,
} from './useTimelineClips'
import type { TimelineClip } from '../core/TimelineClip'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Maximum number of undo steps (mirrors Hephaestus' 200-step limit). */
const HISTORY_LIMIT = 200

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface HistoryFrame {
  /** Clips state BEFORE the operation (for undo). */
  undo: TimelineClip[]
  /** Clips state AFTER the operation (for redo). */
  redo: TimelineClip[]
  /** Semantic label for UI tooltip ("Add clip", "Move clip", etc.). */
  label: string
}

export interface UseChronosHistoryReturn extends UseTimelineClipsReturn {
  /** Undo the last clip operation. No-op if stack is empty. */
  undo: () => void
  /** Redo the last undone operation. No-op if redo stack is empty. */
  redo: () => void
  /** Can undo? (undo stack non-empty) */
  canUndo: boolean
  /** Can redo? (redo stack non-empty) */
  canRedo: boolean
  /** Number of undo steps available. */
  undoCount: number
  /** Number of redo steps available. */
  redoCount: number
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════

export function useChronosHistory(
  options: UseTimelineClipsOptions,
): UseChronosHistoryReturn {
  const clipState = useTimelineClips(options)

  // ── History stacks ──
  const [undoStack, setUndoStack] = useState<HistoryFrame[]>([])
  const [redoStack, setRedoStack] = useState<HistoryFrame[]>([])

  // Ref mirror for synchronous access inside wrapped mutators
  const clipsRef = useRef<TimelineClip[]>(clipState.clips)
  clipsRef.current = clipState.clips

  // ── Core: push a history frame ──
  // Called BEFORE a mutator runs. Captures the "before" state, then
  // the caller runs the mutator, then we capture the "after" state.
  const pushHistory = useCallback((label: string, beforeClips: TimelineClip[]) => {
    // Capture "after" state from the ref (updated by the mutator's setClips)
    // We use setTimeout(0) to read the state AFTER React processes the update.
    setTimeout(() => {
      const afterClips = clipsRef.current
      setUndoStack(prev => {
        const frame: HistoryFrame = { undo: beforeClips, redo: afterClips, label }
        const next = [...prev, frame]
        if (next.length > HISTORY_LIMIT) next.shift()
        return next
      })
      // Clear redo stack on new action
      setRedoStack([])
    }, 0)
  }, [])

  // ── Undo ──
  const undo = useCallback(() => {
    setUndoStack(prevUndo => {
      if (prevUndo.length === 0) return prevUndo
      const frame = prevUndo[prevUndo.length - 1]
      // Restore clips to "before" state
      clipState.setClips(frame.undo)
      // Move frame to redo stack
      setRedoStack(prevRedo => [...prevRedo, frame])
      // Pop from undo stack
      return prevUndo.slice(0, -1)
    })
  }, [clipState])

  // ── Redo ──
  const redo = useCallback(() => {
    setRedoStack(prevRedo => {
      if (prevRedo.length === 0) return prevRedo
      const frame = prevRedo[prevRedo.length - 1]
      // Restore clips to "after" state
      clipState.setClips(frame.redo)
      // Move frame back to undo stack
      setUndoStack(prevUndo => [...prevUndo, frame])
      // Pop from redo stack
      return prevRedo.slice(0, -1)
    })
  }, [clipState])

  // ── Wrapped mutators: capture before-state, run original, push history ──

  const addClip = useCallback((clip: TimelineClip) => {
    const before = [...clipsRef.current]
    clipState.addClip(clip)
    pushHistory('Add clip', before)
  }, [clipState, pushHistory])

  const removeClip = useCallback((clipId: string) => {
    const before = [...clipsRef.current]
    clipState.removeClip(clipId)
    pushHistory('Remove clip', before)
  }, [clipState, pushHistory])

  const updateClip = useCallback((clipId: string, updates: Partial<TimelineClip>) => {
    const before = [...clipsRef.current]
    clipState.updateClip(clipId, updates)
    pushHistory('Update clip', before)
  }, [clipState, pushHistory])

  const deleteSelected = useCallback(() => {
    const before = [...clipsRef.current]
    clipState.deleteSelected()
    pushHistory('Delete selected', before)
  }, [clipState, pushHistory])

  const moveClip = useCallback((clipId: string, newStartMs: number) => {
    const before = [...clipsRef.current]
    clipState.moveClip(clipId, newStartMs)
    pushHistory('Move clip', before)
  }, [clipState, pushHistory])

  const resizeClip = useCallback((clipId: string, edge: 'left' | 'right', newTimeMs: number) => {
    const before = [...clipsRef.current]
    clipState.resizeClip(clipId, edge, newTimeMs)
    pushHistory('Resize clip', before)
  }, [clipState, pushHistory])

  const duplicateClip = useCallback((clipId: string) => {
    const before = [...clipsRef.current]
    const result = clipState.duplicateClip(clipId)
    pushHistory('Duplicate clip', before)
    return result
  }, [clipState, pushHistory])

  const cloneClip = useCallback((clipId: string) => {
    const before = [...clipsRef.current]
    const result = clipState.cloneClip(clipId)
    pushHistory('Clone clip', before)
    return result
  }, [clipState, pushHistory])

  const duplicateSelected = useCallback(() => {
    const before = [...clipsRef.current]
    clipState.duplicateSelected()
    pushHistory('Duplicate selected', before)
  }, [clipState, pushHistory])

  const pasteClips = useCallback((clipsToPaste: TimelineClip[], targetTimeMs: number) => {
    const before = [...clipsRef.current]
    clipState.pasteClips(clipsToPaste, targetTimeMs)
    pushHistory('Paste clips', before)
  }, [clipState, pushHistory])

  const splitClipAtTime = useCallback((clipId: string, timeMs: number) => {
    const before = [...clipsRef.current]
    clipState.splitClipAtTime(clipId, timeMs)
    pushHistory('Split clip', before)
  }, [clipState, pushHistory])

  const createClipFromDrop = useCallback((
    payload: Parameters<UseTimelineClipsReturn['createClipFromDrop']>[0],
    timeMs: number,
    trackId: string,
  ) => {
    const before = [...clipsRef.current]
    const result = clipState.createClipFromDrop(payload, timeMs, trackId)
    if (result) pushHistory('Drop clip', before)
    return result
  }, [clipState, pushHistory])

  // ── setClips: wrapped to clear history on load/new (non-undoable) ──
  // When loading a project or creating a new one, we replace the entire
  // clips array. This is NOT undoable — it would be confusing to undo
  // a project load. So we clear both stacks.
  const setClips = useCallback((updater: React.SetStateAction<TimelineClip[]>) => {
    clipState.setClips(updater)
    // Clear history on bulk replace (load/new project)
    setUndoStack([])
    setRedoStack([])
  }, [clipState])

  // ── Return: merge clipState with history wrappers ──
  return useMemo(() => ({
    ...clipState,
    // Overridden mutators (history-wrapped)
    addClip,
    removeClip,
    updateClip,
    deleteSelected,
    moveClip,
    resizeClip,
    duplicateClip,
    cloneClip,
    duplicateSelected,
    pasteClips,
    splitClipAtTime,
    createClipFromDrop,
    setClips,
    // History actions
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoCount: undoStack.length,
    redoCount: redoStack.length,
  }), [
    clipState,
    addClip, removeClip, updateClip, deleteSelected,
    moveClip, resizeClip, duplicateClip, cloneClip,
    duplicateSelected, pasteClips, splitClipAtTime,
    createClipFromDrop, setClips,
    undo, redo,
    undoStack.length, redoStack.length,
  ])
}
