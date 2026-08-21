/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎮 SCENE PLAYER CONTEXT - WAVE 7566.3: ENGINE PERSISTENCE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Lifts `useScenePlayer` above `SceneBrowser`'s render lifecycle.
 * The provider sits at `HyperionView` level, so the playback engine
 * (RAF loop, AudioContext, backend IPC) persists across sidebar mode
 * switches (controls ↔ kinetics) and tab switches (SCENES ↔ CONTROLS ↔ GROUPS)
 * without re-instantiating.
 *
 * WAVE 7566.4: Also lifts the scene LIBRARY (scenes[] + selectedId) so that
 * SceneBrowser can rehydrate its UI from persistent state on remount —
 * no more "NO SCENE LOADED" fallback when the engine is actively playing.
 *
 * This prevents:
 *   - Orphaned requestAnimationFrame loops on tab switch
 *   - New Audio() nodes stacking up on re-mount
 *   - Lost playback state when navigating away and back
 *   - Lost scene library when navigating away and back
 *
 * @module components/hyperion/controls/sidebar/ScenePlayerContext
 * @version WAVE 7566.4
 */

import React, { createContext, useContext, useState, useCallback } from 'react'
import { useScenePlayer } from '../../../../hooks/useScenePlayer'
import type { ChronosProjectV3 } from '../../../../chronos/core/LuxFileV3'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface LoadedScene {
  id: string
  project: ChronosProjectV3
  audioUrl: string | null
  fileName: string
  /** WAVE 2050.1: Resolved display name (smart title parsing) */
  displayName: string
}

type ScenePlayerApi = ReturnType<typeof useScenePlayer>

export interface ScenePlayerContextValue extends ScenePlayerApi {
  // ── Scene Library (persisted across remounts) ──
  scenes: LoadedScene[]
  selectedId: string | null
  addScene: (scene: LoadedScene) => void
  removeScene: (id: string) => void
  updateScene: (id: string, patch: Partial<LoadedScene>) => void
  setSelectedId: (id: string | null) => void
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

const ScenePlayerContext = createContext<ScenePlayerContextValue | null>(null)

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER — Mounts the engine + library once, persists for HyperionView lifetime
// ═══════════════════════════════════════════════════════════════════════════

export const ScenePlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Engine is instantiated HERE — at the provider level.
  // It survives tab/mode switches because the provider stays mounted
  // as long as HyperionView is rendered.
  const player = useScenePlayer()

  // ── Scene Library state (WAVE 7566.4: lifted from SceneBrowser) ──
  const [scenes, setScenes] = useState<LoadedScene[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const addScene = useCallback((scene: LoadedScene) => {
    setScenes(prev => [...prev, scene])
  }, [])

  const removeScene = useCallback((id: string) => {
    setScenes(prev => prev.filter(s => s.id !== id))
  }, [])

  const updateScene = useCallback((id: string, patch: Partial<LoadedScene>) => {
    setScenes(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
  }, [])

  const value: ScenePlayerContextValue = {
    ...player,
    scenes,
    selectedId,
    addScene,
    removeScene,
    updateScene,
    setSelectedId,
  }

  return (
    <ScenePlayerContext.Provider value={value}>
      {children}
    </ScenePlayerContext.Provider>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSUMER HOOK — Used by SceneBrowser and any other component that needs
// access to the persistent scene player engine + library.
// ═══════════════════════════════════════════════════════════════════════════

export function useScenePlayerContext(): ScenePlayerContextValue {
  const ctx = useContext(ScenePlayerContext)
  if (!ctx) {
    throw new Error(
      'useScenePlayerContext must be used within <ScenePlayerProvider>. ' +
      'Wrap the sidebar content with <ScenePlayerProvider>.',
    )
  }
  return ctx
}

export default ScenePlayerContext
