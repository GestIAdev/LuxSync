/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⌨️ USE TIMELINE KEYBOARD - WAVE 2007: DEEP CONTROL
 * 
 * Global keyboard shortcuts for timeline operations.
 * 
 * SHORTCUTS:
 * - Delete / Backspace → Delete selected clips
 * - Ctrl+C → Copy selected clips
 * - Ctrl+V → Paste at playhead
 * - Ctrl+D → Duplicate selected clips
 * - Ctrl+A → Select all clips
 * - Escape → Deselect all
 * - Space → Play/Pause (when timeline focused)
 * 
 * @module chronos/hooks/useTimelineKeyboard
 * @version WAVE 2007
 */

import { useEffect, useCallback, useRef } from 'react'
import type { TimelineClip } from '../core/TimelineClip'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface UseTimelineKeyboardOptions {
  /** Currently selected clip IDs */
  selectedIds: Set<string>
  
  /** All clips */
  clips: TimelineClip[]
  
  /** Current playhead position */
  currentTimeMs: number
  
  /** Whether timeline container is focused */
  isFocused: boolean
  
  // Actions
  onDeleteSelected: () => void
  onDuplicateSelected: () => void
  onCopy: (clips: TimelineClip[]) => void
  onPaste: (timeMs: number) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  onPlayPause: () => void
  
  /** Optional: rename selected clip */
  onRenameSelected?: () => void
  
  /** Optional: split at playhead */
  onSplitAtPlayhead?: () => void

  /** ⏮️ WAVE 7565.4: Undo */
  onUndo?: () => void
  /** ⏭️ WAVE 7565.4: Redo */
  onRedo?: () => void
}

export interface UseTimelineKeyboardReturn {
  /** Clipboard contents */
  clipboard: TimelineClip[]
  
  /** Set clipboard manually */
  setClipboard: (clips: TimelineClip[]) => void
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

export function useTimelineKeyboard(
  options: UseTimelineKeyboardOptions
): UseTimelineKeyboardReturn {
  const {
    selectedIds,
    clips,
    currentTimeMs,
    isFocused,
    onDeleteSelected,
    onDuplicateSelected,
    onCopy,
    onPaste,
    onSelectAll,
    onDeselectAll,
    onPlayPause,
    onRenameSelected,
    onSplitAtPlayhead,
    onUndo,
    onRedo,
  } = options
  
  // Internal clipboard
  const clipboardRef = useRef<TimelineClip[]>([])
  
  const setClipboard = useCallback((clips: TimelineClip[]) => {
    clipboardRef.current = clips
  }, [])
  
  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only respond if timeline is focused (or no input is focused)
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || 
                      target.tagName === 'TEXTAREA' || 
                      target.isContentEditable
      
      if (isInput) return
      
      // Modifier state
      const ctrl = e.ctrlKey || e.metaKey
      const shift = e.shiftKey
      
      switch (e.key) {
        // ═══════════════════════════════════════════════════════════════════
        // DELETE
        // ═══════════════════════════════════════════════════════════════════
        case 'Delete':
        case 'Backspace':
          if (selectedIds.size > 0) {
            e.preventDefault()
            onDeleteSelected()
            console.log('[Keyboard] 🗑️ Delete selected clips')
          }
          break
        
        // ═══════════════════════════════════════════════════════════════════
        // COPY (Ctrl+C)
        // ═══════════════════════════════════════════════════════════════════
        case 'c':
        case 'C':
          if (ctrl && selectedIds.size > 0) {
            e.preventDefault()
            const selected = clips.filter(c => selectedIds.has(c.id))
            clipboardRef.current = selected.map(c => ({ ...c })) // Deep copy
            onCopy(selected)
            console.log(`[Keyboard] 📋 Copied ${selected.length} clips`)
          }
          break
        
        // ═══════════════════════════════════════════════════════════════════
        // PASTE (Ctrl+V)
        // ═══════════════════════════════════════════════════════════════════
        case 'v':
        case 'V':
          if (ctrl && clipboardRef.current.length > 0) {
            e.preventDefault()
            onPaste(currentTimeMs)
            console.log(`[Keyboard] 📋 Pasted at ${(currentTimeMs/1000).toFixed(2)}s`)
          }
          break
        
        // ═══════════════════════════════════════════════════════════════════
        // DUPLICATE (Ctrl+D)
        // ═══════════════════════════════════════════════════════════════════
        case 'd':
        case 'D':
          if (ctrl && selectedIds.size > 0) {
            e.preventDefault()
            onDuplicateSelected()
            console.log('[Keyboard] 📋 Duplicate selected')
          }
          break
        
        // ═══════════════════════════════════════════════════════════════════
        // SELECT ALL (Ctrl+A)
        // ═══════════════════════════════════════════════════════════════════
        case 'a':
        case 'A':
          if (ctrl && isFocused) {
            e.preventDefault()
            onSelectAll()
            console.log('[Keyboard] ✅ Select all')
          }
          break
        
        // ═══════════════════════════════════════════════════════════════════
        // DESELECT (Escape)
        // ═══════════════════════════════════════════════════════════════════
        case 'Escape':
          if (selectedIds.size > 0) {
            e.preventDefault()
            onDeselectAll()
            console.log('[Keyboard] ❌ Deselect all')
          }
          break
        
        // ═══════════════════════════════════════════════════════════════════
        // PLAY/PAUSE (Space)
        // ═══════════════════════════════════════════════════════════════════
        case ' ':
          if (isFocused) {
            e.preventDefault()
            onPlayPause()
            console.log('[Keyboard] ⏯️ Play/Pause')
          }
          break
        
        // ═══════════════════════════════════════════════════════════════════
        // RENAME (F2)
        // ═══════════════════════════════════════════════════════════════════
        case 'F2':
          if (selectedIds.size === 1 && onRenameSelected) {
            e.preventDefault()
            onRenameSelected()
            console.log('[Keyboard] ✏️ Rename')
          }
          break
        
        // ═══════════════════════════════════════════════════════════════════
        // SPLIT (S)
        // ═══════════════════════════════════════════════════════════════════
        case 's':
        case 'S':
          if (!ctrl && selectedIds.size > 0 && onSplitAtPlayhead) {
            e.preventDefault()
            onSplitAtPlayhead()
            console.log('[Keyboard] ✂️ Split at playhead')
          }
          break

        // ═══════════════════════════════════════════════════════════════════
        // ⏮️ UNDO (Ctrl+Z) / ⏭️ REDO (Ctrl+Y or Ctrl+Shift+Z) — WAVE 7565.4
        // ═══════════════════════════════════════════════════════════════════
        case 'z':
        case 'Z':
          if (ctrl && onUndo && !shift) {
            e.preventDefault()
            onUndo()
            console.log('[Keyboard] ⏮️ Undo')
          } else if (ctrl && shift && onRedo) {
            e.preventDefault()
            onRedo()
            console.log('[Keyboard] ⏭️ Redo (Ctrl+Shift+Z)')
          }
          break

        case 'y':
        case 'Y':
          if (ctrl && onRedo) {
            e.preventDefault()
            onRedo()
            console.log('[Keyboard] ⏭️ Redo (Ctrl+Y)')
          }
          break
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    selectedIds,
    clips,
    currentTimeMs,
    isFocused,
    onDeleteSelected,
    onDuplicateSelected,
    onCopy,
    onPaste,
    onSelectAll,
    onDeselectAll,
    onPlayPause,
    onRenameSelected,
    onSplitAtPlayhead,
    onUndo,
    onRedo,
  ])
  
  return {
    clipboard: clipboardRef.current,
    setClipboard,
  }
}
