/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🃏 AssetCard — WAVE 4549.2
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tarjeta visual para un LibraryAsset.
 * Soporta variante 'list' (fila compacta) y 'grid' (tarjeta expandida).
 *
 * @module components/shared/AssetBrowser/AssetCard
 */

import React, { memo, useCallback } from 'react'
import { Star, Lock, User, Cpu, Palette, Server, Layers } from 'lucide-react'
import type { LibraryAsset } from '../../../stores/assetAdapters'
import './AssetCard.css'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssetCardProps {
  asset: LibraryAsset
  variant?: 'grid' | 'list'
  isSelected?: boolean
  onSelect?: (asset: LibraryAsset) => void
  onToggleFavorite?: (assetId: string) => void
  onDelete?: (assetId: string) => void
  onClone?: (asset: LibraryAsset) => void
  /** Drag-and-drop HTML5: si se provee, la card se vuelve draggable */
  onDragStart?: (e: React.DragEvent, asset: LibraryAsset) => void
}

// ─── Asset type icon ──────────────────────────────────────────────────────────

function AssetIcon({ asset }: { asset: LibraryAsset }) {
  if (asset.icon && asset.icon.length <= 2) {
    // Emoji icon
    return <span className="ac-icon-emoji">{asset.icon}</span>
  }
  // Fallback lucide icons based on type/tags
  if (asset.type === 'ingenio') return <Layers size={16} />
  if (asset.tags.includes('moving')) return <Cpu size={16} />
  if (asset.tags.includes('rgb') || asset.tags.includes('cmy')) return <Palette size={16} />
  return <Server size={16} />
}

// ─── Tag chips ────────────────────────────────────────────────────────────────

const MAX_TAGS_GRID = 5
const MAX_TAGS_LIST = 3

function TagChips({ tags, limit }: { tags: readonly string[]; limit: number }) {
  const shown = tags.slice(0, limit)
  const extra = tags.length - shown.length
  return (
    <div className="ac-tags">
      {shown.map(tag => (
        <span key={tag} className="ac-tag">{tag}</span>
      ))}
      {extra > 0 && <span className="ac-tag ac-tag-extra">+{extra}</span>}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AssetCard = memo(function AssetCard({
  asset,
  variant = 'grid',
  isSelected = false,
  onSelect,
  onToggleFavorite,
  onDelete,
  onClone,
  onDragStart,
}: AssetCardProps) {
  const handleSelect = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect?.(asset)
  }, [asset, onSelect])

  const handleFavorite = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleFavorite?.(asset.id)
  }, [asset.id, onToggleFavorite])

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete?.(asset.id)
  }, [asset.id, onDelete])

  const handleClone = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onClone?.(asset)
  }, [asset, onClone])

  const accentStyle = { '--ac-accent': asset.accentColor } as React.CSSProperties

  if (variant === 'list') {
    return (
      <div
        className={`asset-card ac-list${isSelected ? ' ac-selected' : ''}`}
        style={accentStyle}
        onClick={handleSelect}
        onDoubleClick={handleSelect}
        data-asset-id={asset.id}
        draggable={!!onDragStart}
        onDragStart={onDragStart ? (e) => onDragStart(e, asset) : undefined}
      >
        <span className="ac-list-icon"><AssetIcon asset={asset} /></span>
        <span className="ac-list-name">{asset.name}</span>
        <span className="ac-list-creator">{asset.creator}</span>
        <span className="ac-list-summary">{asset.summary}</span>
        <TagChips tags={asset.tags} limit={MAX_TAGS_LIST} />
        <div className="ac-list-actions">
          {asset.source === 'system'
            ? <Lock size={11} className="ac-source-icon ac-system" />
            : <User size={11} className="ac-source-icon ac-user" />
          }
          <button
            className={`ac-fav-btn${asset.isFavorite ? ' ac-fav-active' : ''}`}
            onClick={handleFavorite}
            title="Marcar favorito"
          >
            <Star size={13} fill={asset.isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`asset-card ac-grid${isSelected ? ' ac-selected' : ''}`}
      style={accentStyle}
      onClick={handleSelect}
      onDoubleClick={handleSelect}
      data-asset-id={asset.id}
      draggable={!!onDragStart}
      onDragStart={onDragStart ? (e) => onDragStart(e, asset) : undefined}
    >
      <div className="ac-grid-header">
        <span className="ac-grid-icon-wrap"><AssetIcon asset={asset} /></span>
        <button
          className={`ac-fav-btn${asset.isFavorite ? ' ac-fav-active' : ''}`}
          onClick={handleFavorite}
          title="Marcar favorito"
        >
          <Star size={14} fill={asset.isFavorite ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="ac-grid-name">{asset.name}</div>
      <div className="ac-grid-creator">{asset.creator}</div>
      <div className="ac-grid-summary">{asset.summary}</div>

      <TagChips tags={asset.tags} limit={MAX_TAGS_GRID} />

      <div className="ac-grid-footer">
        {asset.source === 'system'
          ? <span className="ac-source-badge ac-system"><Lock size={10} /> System</span>
          : <span className="ac-source-badge ac-user"><User size={10} /> User</span>
        }
        {asset.source === 'user' && (
          <div className="ac-grid-actions">
            {onClone && (
              <button className="ac-action-btn" onClick={handleClone} title="Clonar">
                Clone
              </button>
            )}
            {onDelete && (
              <button className="ac-action-btn ac-danger" onClick={handleDelete} title="Eliminar">
                ✕
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
})
