/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎛️  NODE PALETTE — WAVE 4548.8b
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Sidebar izquierda con nodos arrastrables agrupados por categoría.
 * Implementa el protocolo drag-and-drop nativo de @xyflow/react:
 *   onDragStart → setea `application/forgenode` en dataTransfer
 *
 * El canvas (NodeCanvas.tsx) recibe el drop y llama a addNode.
 *
 * @module components/views/ForgeView/canvas/NodePalette
 * @version WAVE 4548.8b
 */

import React, { useState, useCallback } from 'react'
import { FORGE_PALETTE } from '../palette/forgePalette'
import type { ForgeNodeCategory, ForgeNodeType } from '../../../../core/forge/types'
import { UniversalAssetBrowser } from '../../../shared/AssetBrowser'
import type { LibraryAsset } from '../../../../stores/assetAdapters'
import { IngenioFactory } from '../../../../core/forge/ingenio/IngenioFactory'
import type { IIngenioDefinition } from '../../../../core/forge/ingenio/types'
import { useAssetLibraryStore } from '../../../../stores/assetLibraryStore'
import './NodePalette.css'

// ─── Colores por categoría (THE GLOW) ──────────────────────────────────────
const CATEGORY_COLOR: Record<ForgeNodeCategory, string> = {
  input:    '#00f3ff',
  process:  '#39ff14',
  logic:    '#ffb800',
  output:   '#ff2d55',
  compound: '#bf5af2',
}

const CATEGORY_LABEL: Record<ForgeNodeCategory, string> = {
  input:    'INPUT',
  process:  'PROCESS',
  logic:    'LOGIC',
  output:   'OUTPUT',
  compound: 'COMPOUND',
}

const CATEGORY_ORDER: ForgeNodeCategory[] = ['input', 'process', 'logic', 'output', 'compound']
type PaletteTab = 'primitives' | 'ingenios'

// ═══════════════════════════════════════════════════════════════════════════
// NODE PALETTE
// ═══════════════════════════════════════════════════════════════════════════

const NodePalette: React.FC = () => {
  const [activeTab, setActiveTab] = useState<PaletteTab>('primitives')
  const ingestIngenios = useAssetLibraryStore((s) => s.ingestIngenios)

  // Categorías expandidas — input y process abiertas por defecto
  const [expanded, setExpanded] = useState<Set<ForgeNodeCategory>>(
    new Set(['input', 'process'])
  )

  const toggleCategory = useCallback((cat: ForgeNodeCategory) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) {
        next.delete(cat)
      } else {
        next.add(cat)
      }
      return next
    })
  }, [])

  const onDragStart = useCallback(
    (event: React.DragEvent<HTMLDivElement>, nodeType: ForgeNodeType) => {
      event.dataTransfer.setData('application/forgenode', nodeType)
      event.dataTransfer.effectAllowed = 'move'
    },
    []
  )

  // ── Drag de Ingenio desde UAB al canvas ──────────────────────────────────
  const onIngenioDragStart = useCallback((e: React.DragEvent, asset: LibraryAsset) => {
    e.dataTransfer.setData('application/forgenode', 'compound_ingenio')
    e.dataTransfer.setData('application/ingenio-ref', asset.id)
    e.dataTransfer.setData('application/ingenio-name', asset.name)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const onIngenioClone = useCallback(async (asset: LibraryAsset) => {
    if (asset.type !== 'ingenio') return

    const source = asset._raw as IIngenioDefinition
    const cloneName = `${source.name} copy`
    const clone = IngenioFactory.fromSubGraph(
      cloneName,
      source.category,
      source.subGraph,
      source.exposedPorts,
      source.portMapping,
      {
        author: source.author,
        description: source.description,
        tags: source.tags,
        icon: source.icon,
        accentColor: source.accentColor,
      }
    )

    const saveResult = await window.lux.ingenio.saveUser(clone)
    if (!saveResult.success) {
      console.error('[NodePalette] Failed to clone ingenio:', saveResult.error)
      return
    }

    const listResult = await window.lux.ingenio.listAll()
    if (!listResult.success) {
      console.error('[NodePalette] Failed to refresh ingenio list after clone')
      return
    }

    ingestIngenios(listResult.systemIngenios ?? [], listResult.userIngenios ?? [])
  }, [ingestIngenios])

  return (
    <div className="node-palette">
      <div className="node-palette__header">
        <span className="node-palette__title">NODE PALETTE</span>
      </div>

      <div className="node-palette__tabs" role="tablist" aria-label="Node Palette Views">
        <button
          className={`node-palette__tab ${activeTab === 'primitives' ? 'active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'primitives'}
          onClick={() => setActiveTab('primitives')}
        >
          PRIMITIVES
        </button>
        <button
          className={`node-palette__tab ${activeTab === 'ingenios' ? 'active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'ingenios'}
          onClick={() => setActiveTab('ingenios')}
        >
          INGENIOS
        </button>
      </div>

      {activeTab === 'primitives' ? (
        <div className="node-palette__categories">
          {CATEGORY_ORDER.filter((cat) => cat !== 'compound').map((cat) => {
            const entries = FORGE_PALETTE[cat]
            if (entries.length === 0) return null

            const color = CATEGORY_COLOR[cat]
            const isOpen = expanded.has(cat)

            return (
              <div key={cat} className="node-palette__category">
                {/* Category Header */}
                <button
                  className={`node-palette__cat-header ${isOpen ? 'open' : ''}`}
                  style={{ '--cat-color': color } as React.CSSProperties}
                  onClick={() => toggleCategory(cat)}
                  aria-expanded={isOpen}
                >
                  <span className="node-palette__cat-indicator" />
                  <span className="node-palette__cat-label">
                    {CATEGORY_LABEL[cat]}
                  </span>
                  <span className="node-palette__cat-count">{entries.length}</span>
                  <span className="node-palette__cat-chevron">
                    {isOpen ? '▾' : '▸'}
                  </span>
                </button>

                {/* Entries */}
                {isOpen && (
                  <div className="node-palette__entries">
                    {entries.map((entry) => (
                      <div
                        key={entry.type}
                        className="node-palette__entry"
                        style={{ '--cat-color': color } as React.CSSProperties}
                        draggable
                        onDragStart={(e) => onDragStart(e, entry.type)}
                        title={entry.description}
                      >
                        <span className="node-palette__entry-icon">{entry.icon}</span>
                        <span className="node-palette__entry-label">{entry.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="node-palette__ingenios-tab">
          <UniversalAssetBrowser
            assetTypes={['ingenio']}
            compact={true}
            maxHeight="100%"
            defaultViewMode="grid"
            onDragStart={onIngenioDragStart}
            onClone={onIngenioClone}
          />
        </div>
      )}
    </div>
  )
}

export default NodePalette
