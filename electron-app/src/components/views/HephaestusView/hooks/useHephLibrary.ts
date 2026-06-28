/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ useHephLibrary — WAVE 7031: THE DDoS CURE
 *
 * Singleton hook that centralizes library loading and clip caching.
 * The cache survives component unmount/remount via a module-level Map.
 *
 * Exposes:
 *   - loadedClips: metadata array for UI rendering
 *   - isLoading: loading flag
 *   - loadLibrary(): full load (heph:list + heph:load per clip). Deduplicated.
 *   - refreshMetadata(): lightweight refresh (heph:list only). Use after Save/Create.
 *   - getCachedClip(filePath): O(1) cache lookup for D&D
 *   - clipCache: the raw Map (for components that need direct access)
 *
 * @module views/HephaestusView/hooks/useHephLibrary
 * @version WAVE 7031
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import type { HephAutomationClipV3 } from '../../../../core/hephaestus/types'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface LibraryClip {
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

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON STATE (module-level — survives unmount/remount)
// ═══════════════════════════════════════════════════════════════════════════

const _clipCache = new Map<string, HephAutomationClipV3>()
let _loadedClips: LibraryClip[] = []
let _isLoading = false
let _hasInitialized = false

// Simple pub/sub so all hook instances stay in sync
type Listener = () => void
const _listeners = new Set<Listener>()

function _notifyAll() {
  for (const fn of _listeners) fn()
}

function _setLoadedClips(clips: LibraryClip[]) {
  _loadedClips = clips
  _notifyAll()
}

function _setLoading(loading: boolean) {
  _isLoading = loading
  _notifyAll()
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

export function useHephLibrary() {
  const [, forceRender] = useState(0)
  const isMountedRef = useRef(true)

  // Subscribe to singleton changes
  useEffect(() => {
    const listener: Listener = () => {
      if (isMountedRef.current) forceRender(n => n + 1)
    }
    _listeners.add(listener)
    return () => {
      _listeners.delete(listener)
      isMountedRef.current = false
    }
  }, [])

  // ── Full load: heph:list + heph:load per uncached clip ──
  const loadLibrary = useCallback(async () => {
    if (_isLoading) return // deduplicate concurrent calls

    if (!window.luxsync?.hephaestus?.list) {
      console.warn('[useHephLibrary] IPC not available, using demo mode')
      return
    }

    _setLoading(true)
    try {
      const result = await window.luxsync.hephaestus.list()
      if (result.success && result.clips) {
        const clips = result.clips as LibraryClip[]
        _setLoadedClips(clips)
        console.log(`[useHephLibrary] Loaded ${clips.length} clips from library`)

        if (window.luxsync?.hephaestus?.load) {
          for (const item of clips) {
            if (!_clipCache.has(item.filePath)) {
              try {
                const loadResult = await window.luxsync.hephaestus.load(item.filePath)
                if (loadResult.success && loadResult.clip) {
                  _clipCache.set(item.filePath, loadResult.clip as HephAutomationClipV3)
                }
              } catch (e) {
                console.warn(`[useHephLibrary] Cache miss for ${item.name}:`, e)
              }
            }
          }
          console.log(`[useHephLibrary] Diamond cache: ${_clipCache.size} clips`)
        }
      } else if (result.error) {
        console.error('[useHephLibrary] Failed to load library:', result.error)
      }
    } catch (error) {
      console.error('[useHephLibrary] Library load error:', error)
    } finally {
      _setLoading(false)
      _hasInitialized = true
    }
  }, [])

  // ── Lightweight refresh: heph:list only (no heph:load) ──
  const refreshMetadata = useCallback(async () => {
    if (!window.luxsync?.hephaestus?.list) return

    try {
      const result = await window.luxsync.hephaestus.list()
      if (result.success && result.clips) {
        _setLoadedClips(result.clips as LibraryClip[])
        console.log(`[useHephLibrary] Metadata refreshed: ${(result.clips as LibraryClip[]).length} clips`)
      }
    } catch (error) {
      console.error('[useHephLibrary] Metadata refresh error:', error)
    }
  }, [])

  // ── Cache accessors ──
  const getCachedClip = useCallback((filePath: string): HephAutomationClipV3 | undefined => {
    return _clipCache.get(filePath)
  }, [])

  const invalidateCache = useCallback((filePath: string) => {
    _clipCache.delete(filePath)
  }, [])

  // ── Auto-load on first mount ever (singleton guard) ──
  useEffect(() => {
    if (!_hasInitialized && !_isLoading) {
      loadLibrary()
    }
  }, [loadLibrary])

  return {
    loadedClips: _loadedClips,
    isLoading: _isLoading,
    loadLibrary,
    refreshMetadata,
    getCachedClip,
    invalidateCache,
    clipCache: _clipCache,
  }
}
