/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ FX FAVORITES STORE — WAVE 7109: NEON BLOOM
 *
 * Simple Zustand store for tracking user's favorite/custom FX clips.
 * Persisted to localStorage so favorites survive app restarts.
 * Does NOT modify the clip registry — only tracks which clip filePaths
 * the user has starred for quick access in the FAVS tab.
 *
 * @module stores/fxFavoritesStore
 */

import { create } from 'zustand'

const STORAGE_KEY = 'luxsync_fx_favorites'

function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as string[]
    return new Set(arr)
  } catch {
    return new Set()
  }
}

function saveFavorites(favs: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...favs]))
  } catch {
    // ignore quota errors
  }
}

export interface FxFavoritesState {
  favorites: Set<string>
  isFavorite: (filePath: string) => boolean
  toggleFavorite: (filePath: string) => void
  addFavorite: (filePath: string) => void
  removeFavorite: (filePath: string) => void
  clearFavorites: () => void
}

export const useFxFavoritesStore = create<FxFavoritesState>((set, get) => ({
  favorites: loadFavorites(),

  isFavorite: (filePath: string) => get().favorites.has(filePath),

  toggleFavorite: (filePath: string) => {
    set(state => {
      const next = new Set(state.favorites)
      if (next.has(filePath)) next.delete(filePath)
      else next.add(filePath)
      saveFavorites(next)
      return { favorites: next }
    })
  },

  addFavorite: (filePath: string) => {
    set(state => {
      if (state.favorites.has(filePath)) return state
      const next = new Set(state.favorites)
      next.add(filePath)
      saveFavorites(next)
      return { favorites: next }
    })
  },

  removeFavorite: (filePath: string) => {
    set(state => {
      if (!state.favorites.has(filePath)) return state
      const next = new Set(state.favorites)
      next.delete(filePath)
      saveFavorites(next)
      return { favorites: next }
    })
  },

  clearFavorites: () => {
    saveFavorites(new Set())
    set({ favorites: new Set() })
  },
}))
