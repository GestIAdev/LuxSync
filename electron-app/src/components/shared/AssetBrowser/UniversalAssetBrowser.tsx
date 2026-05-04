/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📚 UniversalAssetBrowser — WAVE 4549.2
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Componente reutilizable que reemplaza todas las interfaces de librería
 * del sistema (ForgeView LibraryTab, StageConstructor sidebar, etc.).
 *
 * Consume:  useAssetLibraryStore (Zustand)
 * Carga:    useLoadAssetLibrary  (IPC bridge → ingestFixtures/ingestIngenios)
 * Renderiza: AssetTreeView | AssetGridView | AssetListView según viewMode
 *
 * @module components/shared/AssetBrowser/UniversalAssetBrowser
 */

import React, { memo, useMemo, useCallback, useState, useEffect, useRef } from 'react'
import {
  Search,
  Star,
  LayoutGrid,
  List,
  Network,
  RefreshCw,
  Loader,
  AlertCircle,
  X,
} from 'lucide-react'
import { useAssetLibraryStore } from '../../../stores/assetLibraryStore'
import type { AssetType } from '../../../stores/assetAdapters'
import type { LibraryAsset } from '../../../stores/assetAdapters'
import type { ViewMode } from '../../../stores/assetLibraryStore'
import { useLoadAssetLibrary } from './useLoadAssetLibrary'
import { buildAssetTree }     from './treeHelpers'
import { AssetTreeView }      from './AssetTreeView'
import { AssetCard }          from './AssetCard'
import './UniversalAssetBrowser.css'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UniversalAssetBrowserProps {
  /** Tipos de asset a mostrar (filtra el pool de datos) */
  assetTypes?: AssetType[]
  /** Callback llamado cuando el usuario selecciona un asset */
  onSelect?: (asset: LibraryAsset) => void
  /** Callback para clonar un asset de usuario */
  onClone?: (asset: LibraryAsset) => void
  /** ID del asset actualmente seleccionado (para highlight) */
  selectedAssetId?: string | null
  /** Limitar la altura del componente (CSS value, e.g. "calc(100vh - 200px)") */
  maxHeight?: string
  /** Variante del AssetCard en vistas grid/list */
  cardVariant?: 'grid' | 'list'
  /** Forzar un viewMode inicial (si no se especifica usa el del store) */
  initialViewMode?: ViewMode
  /**
   * Drag-and-drop HTML5: callback invocado cuando una card empieza a arrastrarse.
   * Permite al parent configurar dataTransfer (e.g. fixture-type, library-fixture-id).
   */
  onDragStart?: (e: React.DragEvent, asset: LibraryAsset) => void
  /**
   * Modo compacto (e.g. uso en sidebars ~300px):
   * - Oculta el toggle de vistas (grid/list/tree)
   * - Oculta la TagBar
   * - Fuerza overflow correcto en árbol
   */
  compact?: boolean
  /**
   * Alias semántico de initialViewMode para uso declarativo:
   * defaultViewMode="tree" equivale a initialViewMode="tree"
   */
  defaultViewMode?: ViewMode
}

// ─── Search debounce ───────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debouncedValue
}

// ─── Main Component ────────────────────────────────────────────────────────────

export const UniversalAssetBrowser = memo(function UniversalAssetBrowser({
  assetTypes,
  onSelect,
  onClone,
  selectedAssetId,
  maxHeight,
  cardVariant = 'grid',
  initialViewMode,
  compact = false,
  defaultViewMode,
  onDragStart,
}: UniversalAssetBrowserProps) {
  // defaultViewMode es un alias de initialViewMode
  const resolvedInitialViewMode = initialViewMode ?? defaultViewMode

  // ── Store selectors ──────────────────────────────────────────────────────
  const viewMode            = useAssetLibraryStore(s => s.viewMode)
  const searchQuery         = useAssetLibraryStore(s => s.searchQuery)
  const assetTypeFilter     = useAssetLibraryStore(s => s.assetTypeFilter)
  const showFavoritesOnly   = useAssetLibraryStore(s => s.showFavoritesOnly)
  const activeTags          = useAssetLibraryStore(s => s.activeTags)
  const getFilteredAssets   = useAssetLibraryStore(s => s.getFilteredAssets)
  const getAvailableTags    = useAssetLibraryStore(s => s.getAvailableTags)
  const getTotalCount       = useAssetLibraryStore(s => s.getTotalCount)
  const toggleFavorite      = useAssetLibraryStore(s => s.toggleFavorite)
  const setSearchQuery      = useAssetLibraryStore(s => s.setSearchQuery)
  const setAssetTypeFilter  = useAssetLibraryStore(s => s.setAssetTypeFilter)
  const setViewMode         = useAssetLibraryStore(s => s.setViewMode)
  const setShowFavoritesOnly = useAssetLibraryStore(s => s.setShowFavoritesOnly)
  const toggleTag           = useAssetLibraryStore(s => s.toggleTag)
  const clearTags           = useAssetLibraryStore(s => s.clearTags)

  // ── IPC load ─────────────────────────────────────────────────────────────
  const { isLoading, lastError } = useLoadAssetLibrary()

  // ── Local search state (debounced) ──────────────────────────────────────
  const [inputValue, setInputValue] = useState(searchQuery)
  const debouncedSearch = useDebounce(inputValue, 200)
  useEffect(() => { setSearchQuery(debouncedSearch) }, [debouncedSearch, setSearchQuery])

  // ── Apply resolvedInitialViewMode once ───────────────────────────────────
  const appliedInitialViewMode = useRef(false)
  useEffect(() => {
    if (!appliedInitialViewMode.current && resolvedInitialViewMode) {
      setViewMode(resolvedInitialViewMode)
      appliedInitialViewMode.current = true
    }
  }, [resolvedInitialViewMode, setViewMode])

  // ── Force asset type filter when assetTypes prop provided ─────────────────
  useEffect(() => {
    if (assetTypes?.length === 1) {
      setAssetTypeFilter(assetTypes[0]!)
    }
  }, [assetTypes, setAssetTypeFilter])

  // ── Computed filtered assets ──────────────────────────────────────────────
  const filteredAssets = useMemo(() => getFilteredAssets(), [
    getFilteredAssets,
    // Re-evaluate when relevant store state changes (trigger via store subscription)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    searchQuery, assetTypeFilter, showFavoritesOnly, activeTags, viewMode,
  ])

  // ── Available tags ────────────────────────────────────────────────────────
  const availableTags = useMemo(() => getAvailableTags(), [getAvailableTags, filteredAssets])

  // ── Tree structure (only computed when viewMode === 'tree') ───────────────
  const treeNodes = useMemo(
    () => viewMode === 'tree' ? buildAssetTree(filteredAssets) : [],
    [viewMode, filteredAssets],
  )

  // ── Delete handler (user assets only) ─────────────────────────────────────
  const handleDelete = useCallback(async (assetId: string) => {
    const asset = filteredAssets.find(a => a.id === assetId)
    if (!asset || asset.source !== 'user') return
    try {
      if (asset.type === 'fixture') {
        await window.lux?.library?.deleteUser?.(assetId)
      } else {
        await window.lux?.ingenio?.deleteUser?.(assetId)
      }
      // Reload the library to reflect deletion
      useAssetLibraryStore.setState({ isLoading: true })
      const fixtureResult = await window.lux?.library?.listAll?.()
      const ingenioResult = await window.lux?.ingenio?.listAll?.()
      if (fixtureResult?.success) {
        useAssetLibraryStore.getState().ingestFixtures(
          fixtureResult.systemFixtures as any,
          fixtureResult.userFixtures as any,
        )
      }
      if (ingenioResult?.success) {
        useAssetLibraryStore.getState().ingestIngenios(
          ingenioResult.systemIngenios as any,
          ingenioResult.userIngenios as any,
        )
      }
      useAssetLibraryStore.setState({ isLoading: false })
    } catch (err) {
      console.error('[UniversalAssetBrowser] delete failed:', err)
      useAssetLibraryStore.setState({ isLoading: false })
    }
  }, [filteredAssets])

  // ── Reload ────────────────────────────────────────────────────────────────
  const handleReload = useCallback(async () => {
    try {
      useAssetLibraryStore.setState({ isLoading: true, lastError: null })
      const [fixtureResult, ingenioResult] = await Promise.all([
        window.lux?.library?.listAll?.(),
        window.lux?.ingenio?.listAll?.(),
      ])
      if (fixtureResult?.success) {
        useAssetLibraryStore.getState().ingestFixtures(
          fixtureResult.systemFixtures as any,
          fixtureResult.userFixtures as any,
        )
      }
      if (ingenioResult?.success) {
        useAssetLibraryStore.getState().ingestIngenios(
          ingenioResult.systemIngenios as any,
          ingenioResult.userIngenios as any,
        )
      }
      useAssetLibraryStore.setState({ isLoading: false })
    } catch (err) {
      useAssetLibraryStore.setState({ isLoading: false, lastError: String(err) })
    }
  }, [])

  // ── Clear search ──────────────────────────────────────────────────────────
  const handleClearSearch = useCallback(() => {
    setInputValue('')
    setSearchQuery('')
  }, [setSearchQuery])

  // ── Tag bar toggle ─────────────────────────────────────────────────────────
  const TOP_TAGS_COUNT = 12
  const tagEntries = useMemo(() => {
    const entries: [string, number][] = []
    availableTags.forEach((count, tag) => entries.push([tag, count]))
    entries.sort((a, b) => b[1] - a[1])
    return entries.slice(0, TOP_TAGS_COUNT)
  }, [availableTags])

  // ─────────────────────────────────────────────────────────────────────────
  const totalCount    = getTotalCount()
  const filteredCount = filteredAssets.length

  // Decide which type filter tabs to show
  const showTypeToggle = !assetTypes || assetTypes.length > 1

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className={`universal-asset-browser${compact ? ' uab-compact' : ''}`}
      style={{ maxHeight: maxHeight ?? '100%' }}
    >
      {/* ── TOOLBAR ──────────────────────────────────────────────────────── */}
      <div className="uab-toolbar">
        {/* Search */}
        <div className="uab-search">
          <Search size={13} className="uab-search-icon" />
          <input
            type="text"
            className="uab-search-input"
            placeholder="Buscar fixtures, ingenios..."
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
          />
          {inputValue && (
            <button className="uab-search-clear" onClick={handleClearSearch} title="Limpiar">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Type toggle — oculto en modo compact */}
        {showTypeToggle && !compact && (
          <div className="uab-type-toggle">
            <button
              className={`uab-type-btn${assetTypeFilter === 'all' ? ' uab-active' : ''}`}
              onClick={() => setAssetTypeFilter('all')}
            >
              ALL
            </button>
            {(!assetTypes || assetTypes.includes('fixture')) && (
              <button
                className={`uab-type-btn${assetTypeFilter === 'fixture' ? ' uab-active' : ''}`}
                onClick={() => setAssetTypeFilter('fixture')}
              >
                FIXTURES
              </button>
            )}
            {(!assetTypes || assetTypes.includes('ingenio')) && (
              <button
                className={`uab-type-btn${assetTypeFilter === 'ingenio' ? ' uab-active' : ''}`}
                onClick={() => setAssetTypeFilter('ingenio')}
              >
                INGENIOS
              </button>
            )}
          </div>
        )}

        {/* View mode — oculto en modo compact */}
        {!compact && (
          <div className="uab-view-toggle">
            <button
              className={`uab-view-btn${viewMode === 'tree' ? ' uab-active' : ''}`}
              onClick={() => setViewMode('tree')}
              title="Vista árbol"
            >
              <Network size={13} />
            </button>
            <button
              className={`uab-view-btn${viewMode === 'list' ? ' uab-active' : ''}`}
              onClick={() => setViewMode('list')}
              title="Vista lista"
            >
              <List size={13} />
            </button>
            <button
              className={`uab-view-btn${viewMode === 'grid' ? ' uab-active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Vista grilla"
            >
              <LayoutGrid size={13} />
            </button>
          </div>
        )}

        {/* Favorites */}
        <button
          className={`uab-fav-toggle${showFavoritesOnly ? ' uab-active' : ''}`}
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          title="Solo favoritos"
        >
          <Star size={13} fill={showFavoritesOnly ? 'currentColor' : 'none'} />
        </button>

        {/* Reload */}
        <button
          className={`uab-reload-btn${isLoading ? ' uab-spinning' : ''}`}
          onClick={handleReload}
          title="Recargar librería"
          disabled={isLoading}
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* ── TAG BAR — oculta en modo compact ─────────────────────────────── */}
      {!compact && tagEntries.length > 0 && (
        <div className="uab-tag-bar">
          {tagEntries.map(([tag, count]) => (
            <button
              key={tag}
              className={`uab-tag-chip${activeTags.has(tag) ? ' uab-tag-active' : ''}`}
              onClick={() => toggleTag(tag)}
              title={`${count} assets`}
            >
              {tag}
            </button>
          ))}
          {activeTags.size > 0 && (
            <button className="uab-tag-chip uab-tag-clear" onClick={clearTags}>
              ✕ clear
            </button>
          )}
        </div>
      )}

      {/* ── CONTENT ───────────────────────────────────────────────────────── */}
      <div className="uab-content">
        {isLoading && (
          <div className="uab-state uab-loading">
            <Loader size={20} className="uab-spin" />
            <span>Cargando librería...</span>
          </div>
        )}

        {!isLoading && lastError && (
          <div className="uab-state uab-error">
            <AlertCircle size={18} />
            <span>{lastError}</span>
          </div>
        )}

        {!isLoading && !lastError && filteredAssets.length === 0 && (
          <div className="uab-state uab-empty">
            <span>No hay assets que coincidan</span>
          </div>
        )}

        {!isLoading && !lastError && filteredAssets.length > 0 && (
          <>
            {viewMode === 'tree' && (
              <AssetTreeView
                nodes={treeNodes}
                selectedAssetId={selectedAssetId}
                onSelect={onSelect}
                onToggleFavorite={toggleFavorite}
                onDelete={handleDelete}
                onClone={onClone}
                onDragStart={onDragStart}
              />
            )}

            {viewMode === 'list' && (
              <div className="uab-list-view">
                {filteredAssets.map(asset => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    variant="list"
                    isSelected={asset.id === selectedAssetId}
                    onSelect={onSelect}
                    onToggleFavorite={toggleFavorite}
                    onDelete={asset.source === 'user' ? handleDelete : undefined}
                    onClone={onClone}
                    onDragStart={onDragStart}
                  />
                ))}
              </div>
            )}

            {viewMode === 'grid' && (
              <div className="uab-grid-view">
                {filteredAssets.map(asset => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    variant={cardVariant}
                    isSelected={asset.id === selectedAssetId}
                    onSelect={onSelect}
                    onToggleFavorite={toggleFavorite}
                    onDelete={asset.source === 'user' ? handleDelete : undefined}
                    onClone={onClone}
                    onDragStart={onDragStart}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <div className="uab-footer">
        <span className="uab-footer-count">
          {filteredCount} / {totalCount} assets
        </span>
        {activeTags.size > 0 && (
          <span className="uab-footer-tags">
            filtros: {[...activeTags].join(', ')}
          </span>
        )}
      </div>
    </div>
  )
})
