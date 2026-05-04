/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📚 ASSET LIBRARY STORE — WAVE 4549.1
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Store Zustand unificado para TODOS los assets de la aplicación:
 * Fixtures + Ingenios, ambos de sistema y usuario.
 *
 * REEMPLAZA progresivamente a libraryStore.ts para el UI browsing.
 * libraryStore sigue siendo source of truth para save/delete IPC de fixtures.
 * Este store CONSUME datos de libraryStore y los unifica con ingenios.
 *
 * FEATURE: Favoritos persistidos en localStorage.
 *
 * @module stores/assetLibraryStore
 * @version WAVE 4549.1
 */

import { create } from 'zustand'
import type { FixtureDefinition } from '../types/FixtureDefinition'
import type { IIngenioDefinition } from '../core/forge/ingenio/types'
import {
  fixtureToAsset,
  ingenioToAsset,
  matchesSearch,
} from './assetAdapters'
import type {
  LibraryAsset,
  AssetType,
  AssetSource,
} from './assetAdapters'

// Re-export types for consumers
export type { LibraryAsset, AssetType, AssetSource } from './assetAdapters'

// ═══════════════════════════════════════════════════════════════════════════
// FAVORITES PERSISTENCE (localStorage)
// ═══════════════════════════════════════════════════════════════════════════

const FAVORITES_KEY = 'luxsync_asset_favorites'

function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return new Set(parsed as string[])
    return new Set()
  } catch {
    return new Set()
  }
}

function saveFavorites(favorites: Set<string>): void {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]))
  } catch {
    // localStorage unavailable — silently ignore
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SORT HELPERS
// ═══════════════════════════════════════════════════════════════════════════

type SortField = 'name' | 'creator' | 'updated' | 'type'
type SortDirection = 'asc' | 'desc'

function compareAssets(a: LibraryAsset, b: LibraryAsset, field: SortField, dir: SortDirection): number {
  let cmp = 0
  switch (field) {
    case 'name':
      cmp = a.name.localeCompare(b.name)
      break
    case 'creator':
      cmp = a.creator.localeCompare(b.creator)
      break
    case 'updated':
      cmp = a.updatedAt - b.updatedAt
      break
    case 'type':
      cmp = a.type.localeCompare(b.type)
      break
  }
  return dir === 'asc' ? cmp : -cmp
}

// ═══════════════════════════════════════════════════════════════════════════
// STATE INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

export type ViewMode = 'grid' | 'list' | 'tree'

export interface AssetLibraryState {
  // ── Data ──────────────────────────────────────────────
  /** All fixture assets (system + user) */
  fixtures: LibraryAsset[]
  /** All ingenio assets (system + user) */
  ingenios: LibraryAsset[]
  /** Loading state */
  isLoading: boolean
  /** Last error message */
  lastError: string | null
  /** Set of favorited asset IDs (persisted in localStorage) */
  favoriteIds: Set<string>

  // ── View State ────────────────────────────────────────
  /** Filtro activo por tipo de asset */
  assetTypeFilter: AssetType | 'all'
  /** Filtro activo por fuente */
  sourceFilter: AssetSource | 'all'
  /** Query de búsqueda */
  searchQuery: string
  /** Tags activos (AND filter) */
  activeTags: Set<string>
  /** Modo de vista */
  viewMode: ViewMode
  /** Campo de ordenación */
  sortBy: SortField
  /** Dirección de ordenación */
  sortDirection: SortDirection
  /** Solo favoritos */
  showFavoritesOnly: boolean
  /** Nodos del árbol expandidos */
  expandedTreeNodes: Set<string>

  // ── Data Actions ──────────────────────────────────────

  /** Carga fixtures desde datos ya normalizados del libraryStore */
  ingestFixtures: (
    systemFixtures: FixtureDefinition[],
    userFixtures: FixtureDefinition[],
    systemFilePaths?: Map<string, string>,
    userFilePaths?: Map<string, string>,
  ) => void

  /** Carga ingenios desde datos IPC */
  ingestIngenios: (
    systemIngenios: IIngenioDefinition[],
    userIngenios: IIngenioDefinition[],
  ) => void

  /** Limpia todo el store */
  clear: () => void

  // ── Favorites ─────────────────────────────────────────

  /** Toggle favorito para un asset */
  toggleFavorite: (assetId: string) => void

  /** ¿Es favorito? */
  isFavorite: (assetId: string) => boolean

  // ── View State Actions ────────────────────────────────

  setAssetTypeFilter: (filter: AssetType | 'all') => void
  setSourceFilter: (filter: AssetSource | 'all') => void
  setSearchQuery: (query: string) => void
  toggleTag: (tag: string) => void
  clearTags: () => void
  setViewMode: (mode: ViewMode) => void
  setSortBy: (sort: SortField) => void
  toggleSortDirection: () => void
  setShowFavoritesOnly: (show: boolean) => void
  toggleTreeNode: (nodeId: string) => void

  // ── Computed ──────────────────────────────────────────

  /** Devuelve assets filtrados y ordenados para el view actual */
  getFilteredAssets: () => LibraryAsset[]

  /** Devuelve todos los tags disponibles con sus conteos */
  getAvailableTags: () => Map<string, number>

  /** Devuelve el total de assets (sin filtros) */
  getTotalCount: () => number
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════

export const useAssetLibraryStore = create<AssetLibraryState>((set, get) => ({
  // ── Initial State ────────────────────────────────────
  fixtures: [],
  ingenios: [],
  isLoading: false,
  lastError: null,
  favoriteIds: loadFavorites(),

  assetTypeFilter: 'all',
  sourceFilter: 'all',
  searchQuery: '',
  activeTags: new Set(),
  viewMode: 'tree',
  sortBy: 'name',
  sortDirection: 'asc',
  showFavoritesOnly: false,
  expandedTreeNodes: new Set(),

  // ── Data Actions ──────────────────────────────────────

  ingestFixtures: (systemFixtures, userFixtures, systemFilePaths, userFilePaths) => {
    const favIds = get().favoriteIds

    const systemAssets = systemFixtures.map(f =>
      fixtureToAsset(
        f,
        'system',
        systemFilePaths?.get(f.id),
        favIds.has(f.id),
      )
    )

    const userAssets = userFixtures.map(f =>
      fixtureToAsset(
        f,
        'user',
        userFilePaths?.get(f.id),
        favIds.has(f.id),
      )
    )

    set({ fixtures: [...systemAssets, ...userAssets] })
  },

  ingestIngenios: (systemIngenios, userIngenios) => {
    const favIds = get().favoriteIds

    const systemAssets = systemIngenios.map(i =>
      ingenioToAsset(i, 'system', favIds.has(i.id))
    )

    const userAssets = userIngenios.map(i =>
      ingenioToAsset(i, 'user', favIds.has(i.id))
    )

    set({ ingenios: [...systemAssets, ...userAssets] })
  },

  clear: () => {
    set({
      fixtures: [],
      ingenios: [],
      isLoading: false,
      lastError: null,
    })
  },

  // ── Favorites ─────────────────────────────────────────

  toggleFavorite: (assetId: string) => {
    const { favoriteIds, fixtures, ingenios } = get()
    const newFavs = new Set(favoriteIds)

    if (newFavs.has(assetId)) {
      newFavs.delete(assetId)
    } else {
      newFavs.add(assetId)
    }

    saveFavorites(newFavs)

    // Update the isFavorite flag on the affected asset
    const updatedFixtures = fixtures.map(f =>
      f.id === assetId ? { ...f, isFavorite: newFavs.has(assetId) } : f
    )
    const updatedIngenios = ingenios.map(i =>
      i.id === assetId ? { ...i, isFavorite: newFavs.has(assetId) } : i
    )

    set({
      favoriteIds: newFavs,
      fixtures: updatedFixtures,
      ingenios: updatedIngenios,
    })
  },

  isFavorite: (assetId: string): boolean => {
    return get().favoriteIds.has(assetId)
  },

  // ── View State Actions ────────────────────────────────

  setAssetTypeFilter: (filter) => set({ assetTypeFilter: filter }),
  setSourceFilter: (filter) => set({ sourceFilter: filter }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  toggleTag: (tag) => {
    const { activeTags } = get()
    const newTags = new Set(activeTags)
    if (newTags.has(tag)) {
      newTags.delete(tag)
    } else {
      newTags.add(tag)
    }
    set({ activeTags: newTags })
  },

  clearTags: () => set({ activeTags: new Set() }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setSortBy: (sort) => set({ sortBy: sort }),
  toggleSortDirection: () => set(s => ({
    sortDirection: s.sortDirection === 'asc' ? 'desc' : 'asc',
  })),
  setShowFavoritesOnly: (show) => set({ showFavoritesOnly: show }),

  toggleTreeNode: (nodeId) => {
    const { expandedTreeNodes } = get()
    const newSet = new Set(expandedTreeNodes)
    if (newSet.has(nodeId)) {
      newSet.delete(nodeId)
    } else {
      newSet.add(nodeId)
    }
    set({ expandedTreeNodes: newSet })
  },

  // ── Computed ──────────────────────────────────────────

  getFilteredAssets: (): LibraryAsset[] => {
    const {
      fixtures,
      ingenios,
      assetTypeFilter,
      sourceFilter,
      searchQuery,
      activeTags,
      sortBy,
      sortDirection,
      showFavoritesOnly,
    } = get()

    // 1. Merge pools based on type filter
    let pool: LibraryAsset[]
    switch (assetTypeFilter) {
      case 'fixture':
        pool = fixtures
        break
      case 'ingenio':
        pool = ingenios
        break
      default:
        pool = [...fixtures, ...ingenios]
    }

    // 2. Filter by source
    if (sourceFilter !== 'all') {
      pool = pool.filter(a => a.source === sourceFilter)
    }

    // 3. Filter by favorites
    if (showFavoritesOnly) {
      pool = pool.filter(a => a.isFavorite)
    }

    // 4. Filter by search query
    if (searchQuery.trim()) {
      pool = pool.filter(a => matchesSearch(a, searchQuery))
    }

    // 5. Filter by active tags (AND logic)
    if (activeTags.size > 0) {
      pool = pool.filter(a => {
        for (const tag of activeTags) {
          if (!a.tags.includes(tag)) return false
        }
        return true
      })
    }

    // 6. Sort
    pool.sort((a, b) => compareAssets(a, b, sortBy, sortDirection))

    return pool
  },

  getAvailableTags: (): Map<string, number> => {
    const { fixtures, ingenios, assetTypeFilter } = get()

    let pool: LibraryAsset[]
    switch (assetTypeFilter) {
      case 'fixture':
        pool = fixtures
        break
      case 'ingenio':
        pool = ingenios
        break
      default:
        pool = [...fixtures, ...ingenios]
    }

    const tagCounts = new Map<string, number>()
    for (const asset of pool) {
      for (const tag of asset.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
      }
    }

    return tagCounts
  },

  getTotalCount: (): number => {
    const { fixtures, ingenios } = get()
    return fixtures.length + ingenios.length
  },
}))

// ═══════════════════════════════════════════════════════════════════════════
// SELECTORS — Para hooks granulares
// ═══════════════════════════════════════════════════════════════════════════

/** Selector: view state for toolbar */
export const selectAssetBrowserToolbar = (state: AssetLibraryState) => ({
  assetTypeFilter: state.assetTypeFilter,
  sourceFilter: state.sourceFilter,
  searchQuery: state.searchQuery,
  viewMode: state.viewMode,
  sortBy: state.sortBy,
  sortDirection: state.sortDirection,
  showFavoritesOnly: state.showFavoritesOnly,
  setAssetTypeFilter: state.setAssetTypeFilter,
  setSourceFilter: state.setSourceFilter,
  setSearchQuery: state.setSearchQuery,
  setViewMode: state.setViewMode,
  setSortBy: state.setSortBy,
  toggleSortDirection: state.toggleSortDirection,
  setShowFavoritesOnly: state.setShowFavoritesOnly,
})

/** Selector: tag bar */
export const selectAssetBrowserTags = (state: AssetLibraryState) => ({
  activeTags: state.activeTags,
  toggleTag: state.toggleTag,
  clearTags: state.clearTags,
  getAvailableTags: state.getAvailableTags,
})

/** Selector: data loading */
export const selectAssetBrowserData = (state: AssetLibraryState) => ({
  isLoading: state.isLoading,
  lastError: state.lastError,
  ingestFixtures: state.ingestFixtures,
  ingestIngenios: state.ingestIngenios,
  getFilteredAssets: state.getFilteredAssets,
  getTotalCount: state.getTotalCount,
  toggleFavorite: state.toggleFavorite,
})
