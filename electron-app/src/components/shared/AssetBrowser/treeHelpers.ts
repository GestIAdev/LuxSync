/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌲 buildAssetTree — WAVE 4549.2
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Construye el árbol de navegación jerárquico desde una lista plana
 * de LibraryAssets. Agrupa por:
 *   Fixtures → Fabricante (creator)
 *   Ingenios → Categoría (subtype)
 *
 * @module components/shared/AssetBrowser/treeHelpers
 */

import type { LibraryAsset } from '../../../stores/assetAdapters'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TreeNode {
  /** ID único del nodo del árbol (para expand/collapse tracking) */
  readonly id: string
  /** Etiqueta del nodo raíz (Fabricante o Categoría) */
  readonly label: string
  /** Icono representativo del grupo */
  readonly icon: string
  /** Color de acento del grupo */
  readonly accentColor: string
  /** Assets directamente bajo este nodo */
  readonly assets: LibraryAsset[]
  /** Sub-grupos (para jerarquías más profundas — actualmente no usados) */
  readonly children: TreeNode[]
}

// ─── Asset → group key ────────────────────────────────────────────────────────

function groupKeyOf(asset: LibraryAsset): string {
  return asset.type === 'fixture'
    ? (asset.creator || 'Unknown').trim()
    : (asset.subtype || 'Uncategorized').trim()
}

// Icono + color por categoría de ingenio
const INGENIO_META: Record<string, { icon: string; color: string }> = {
  modulation: { icon: '〜', color: '#a855f7' },
  dynamics:   { icon: '⟳', color: '#3b82f6' },
  audio:      { icon: '🎵', color: '#06b6d4' },
  sequencer:  { icon: '⏶', color: '#f59e0b' },
  logic:      { icon: '⊻', color: '#ef4444' },
  utility:    { icon: '⚙',  color: '#6b7280' },
  effect:     { icon: '✦', color: '#10b981' },
}

function metaForGroup(asset: LibraryAsset): { icon: string; color: string } {
  if (asset.type === 'ingenio') {
    return INGENIO_META[asset.subtype] ?? { icon: '✦', color: '#00f3ff' }
  }
  // Fixtures: color por primer tag
  if (asset.tags.includes('moving')) return { icon: '💡', color: '#f59e0b' }
  if (asset.tags.includes('rgb'))    return { icon: '🎨', color: '#06b6d4' }
  return { icon: '⚡', color: '#636363' }
}

// ─── Builder ──────────────────────────────────────────────────────────────────

export function buildAssetTree(assets: LibraryAsset[]): TreeNode[] {
  const groups = new Map<string, { assets: LibraryAsset[]; icon: string; color: string }>()

  for (const asset of assets) {
    const key = groupKeyOf(asset)
    if (!groups.has(key)) {
      const m = metaForGroup(asset)
      groups.set(key, { assets: [], icon: m.icon, color: m.color })
    }
    groups.get(key)!.assets.push(asset)
  }

  const nodes: TreeNode[] = []
  for (const [label, data] of groups) {
    data.assets.sort((a, b) => a.name.localeCompare(b.name))
    nodes.push({
      id:          `tree-${label}`,
      label,
      icon:        data.icon,
      accentColor: data.color,
      assets:      data.assets,
      children:    [],
    })
  }

  // Sort groups: user assets first (within mixed), then alphabetically
  nodes.sort((a, b) => {
    const aHasUser = a.assets.some(x => x.source === 'user')
    const bHasUser = b.assets.some(x => x.source === 'user')
    if (aHasUser !== bHasUser) return aHasUser ? -1 : 1
    return a.label.localeCompare(b.label)
  })

  return nodes
}
