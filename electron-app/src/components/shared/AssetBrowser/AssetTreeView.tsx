/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌲 AssetTreeView — WAVE 4549.2
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Vista jerárquica principal del browser.
 * Agrupa assets por Fabricante (fixtures) o Categoría (ingenios).
 *
 * @module components/shared/AssetBrowser/AssetTreeView
 */

import React, { memo, useCallback } from 'react'
import { ChevronRight } from 'lucide-react'
import { useAssetLibraryStore } from '../../../stores/assetLibraryStore'
import { AssetCard } from './AssetCard'
import type { TreeNode } from './treeHelpers'
import type { LibraryAsset } from '../../../stores/assetAdapters'
import './AssetTreeView.css'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssetTreeViewProps {
  nodes: TreeNode[]
  selectedAssetId?: string | null
  onSelect?: (asset: LibraryAsset) => void
  onToggleFavorite?: (assetId: string) => void
  onDelete?: (assetId: string) => void
  onClone?: (asset: LibraryAsset) => void
  onDragStart?: (e: React.DragEvent, asset: LibraryAsset) => void
}

// ─── Tree Branch ──────────────────────────────────────────────────────────────

interface TreeBranchProps {
  node: TreeNode
  isExpanded: boolean
  onToggle: (nodeId: string) => void
  selectedAssetId?: string | null
  onSelect?: (asset: LibraryAsset) => void
  onToggleFavorite?: (assetId: string) => void
  onDelete?: (assetId: string) => void
  onClone?: (asset: LibraryAsset) => void
  onDragStart?: (e: React.DragEvent, asset: LibraryAsset) => void
}

const TreeBranch = memo(function TreeBranch({
  node,
  isExpanded,
  onToggle,
  selectedAssetId,
  onSelect,
  onToggleFavorite,
  onDelete,
  onClone,
  onDragStart,
}: TreeBranchProps) {
  const handleToggle = useCallback(() => {
    onToggle(node.id)
  }, [node.id, onToggle])

  return (
    <div className="atv-branch" data-expanded={isExpanded}>
      <button
        className="atv-branch-header"
        onClick={handleToggle}
        style={{ '--branch-accent': node.accentColor } as React.CSSProperties}
      >
        <ChevronRight
          size={13}
          className={`atv-chevron${isExpanded ? ' atv-chevron-open' : ''}`}
        />
        <span className="atv-branch-icon">{node.icon}</span>
        <span className="atv-branch-label">{node.label}</span>
        <span className="atv-branch-count">{node.assets.length}</span>
      </button>

      {isExpanded && (
        <div className="atv-branch-assets">
          {node.assets.map(asset => (
            <AssetCard
              key={asset.id}
              asset={asset}
              variant="list"
              isSelected={asset.id === selectedAssetId}
              onSelect={onSelect}
              onToggleFavorite={onToggleFavorite}
              onDelete={asset.source === 'user' ? onDelete : undefined}
              onClone={onClone}
              onDragStart={onDragStart}
            />
          ))}
        </div>
      )}
    </div>
  )
})

// ─── Component ────────────────────────────────────────────────────────────────

export const AssetTreeView = memo(function AssetTreeView({
  nodes,
  selectedAssetId,
  onSelect,
  onToggleFavorite,
  onDelete,
  onClone,
  onDragStart,
}: AssetTreeViewProps) {
  const expandedTreeNodes = useAssetLibraryStore(s => s.expandedTreeNodes)
  const toggleTreeNode    = useAssetLibraryStore(s => s.toggleTreeNode)

  if (nodes.length === 0) {
    return (
      <div className="atv-empty">
        <span>No hay assets que coincidan con el filtro</span>
      </div>
    )
  }

  return (
    <div className="asset-tree-view">
      {nodes.map(node => (
        <TreeBranch
          key={node.id}
          node={node}
          isExpanded={expandedTreeNodes.has(node.id)}
          onToggle={toggleTreeNode}
          selectedAssetId={selectedAssetId}
          onSelect={onSelect}
          onToggleFavorite={onToggleFavorite}
          onDelete={onDelete}
          onClone={onClone}
          onDragStart={onDragStart}
        />
      ))}
    </div>
  )
})
