/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔍 NODE INSPECTOR — WAVE 4548.8c
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Panel lateral derecho del canvas Forge.
 * Observa el nodo inspeccionado via useForgeGraphStore(useInspectedNode).
 *
 * PATRÓN DOBLE BUFFER + DEBOUNCE:
 *  ┌── key/type change ──> localDraft (useState, inmediato en UI)
 *  └── debounce 300ms ───> store.updateNodeConfig (dispara re-render del canvas
 *                          solo una vez por ráfaga de keystrokes)
 *
 * Esto garantiza:
 *  - 0 lag visual en el inspector (el campo muestra el valor inmediatamente)
 *  - 0 re-render del canvas mientras el usuario escribe
 *
 * @module components/views/ForgeView/inspector/NodeInspector
 * @version WAVE 4548.8c
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Trash2, Copy, X as IconX } from 'lucide-react'
import { useForgeGraphStore } from '../../../../stores/forgeGraphStore'
import type { IForgeNodeConfig, IForgeNode, ForgeNodeType } from '../../../../core/forge/types'
import { getCategoryColor } from '../nodes/nodeColors'
import { getNodeIcon } from '../nodes/nodeIcons'
import { getConfigPanel } from './configPanelRegistry'
import './NodeInspector.css'

const DEBOUNCE_MS = 300

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(id)
  }, [value, delay])

  return debounced
}

// ═══════════════════════════════════════════════════════════════════════════
// PORT LIST
// ═══════════════════════════════════════════════════════════════════════════

const InspectorPortList: React.FC<{ node: IForgeNode }> = ({ node }) => {
  if (node.inputs.length === 0 && node.outputs.length === 0) return null
  return (
    <div className="ni-section">
      <div className="ni-section__title">PORTS</div>
      {node.inputs.map((p) => (
        <div key={p.id} className="ni-port">
          <span className="ni-port__arrow ni-port__arrow--in">IN</span>
          <span className="ni-port__name">{p.label}</span>
          <span className="ni-port__type">{p.dataType}</span>
        </div>
      ))}
      {node.outputs.map((p) => (
        <div key={p.id} className="ni-port">
          <span className="ni-port__arrow ni-port__arrow--out">OUT</span>
          <span className="ni-port__name">{p.label}</span>
          <span className="ni-port__type">{p.dataType}</span>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// NODE INSPECTOR INNER (tiene acceso al nodo)
// ═══════════════════════════════════════════════════════════════════════════

const NodeInspectorInner: React.FC<{ node: IForgeNode }> = ({ node }) => {
  // ── Store actions ──────────────────────────────────────────────────────
  const { updateNodeConfig, updateNodeLabel, removeNode, addNode, inspectNode } =
    useForgeGraphStore(
      useShallow((s) => ({
        updateNodeConfig: s.updateNodeConfig,
        updateNodeLabel:  s.updateNodeLabel,
        removeNode:       s.removeNode,
        addNode:          s.addNode,
        inspectNode:      s.inspectNode,
      }))
    )

  // ── Local draft for label (double buffer) ────────────────────────────
  const [labelDraft, setLabelDraft] = useState(node.label ?? node.type)

  // Reset draft when the inspected node changes
  useEffect(() => {
    setLabelDraft(node.label ?? node.type)
  }, [node.id, node.label, node.type])

  // Persist label on blur (no debounce needed — it's an onBlur operation)
  const handleLabelBlur = useCallback(() => {
    const trimmed = labelDraft.trim()
    if (trimmed && trimmed !== (node.label ?? node.type)) {
      updateNodeLabel(node.id, trimmed)
    }
  }, [labelDraft, node.id, node.label, node.type, updateNodeLabel])

  // ── Local draft for config (double buffer + debounce) ────────────────
  const [configDraft, setConfigDraft] = useState<IForgeNodeConfig>(node.config)
  const debouncedConfig = useDebounce(configDraft, DEBOUNCE_MS)

  // Reset draft when node changes
  useEffect(() => {
    setConfigDraft(node.config)
  }, [node.id]) // intentionally only on node ID change — not on every config update

  // Flush debounced config to store
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    updateNodeConfig(node.id, debouncedConfig)
  }, [debouncedConfig]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset first-render guard on node change
  useEffect(() => {
    isFirstRender.current = true
  }, [node.id])

  // ── Config change handler (writes to draft only) ─────────────────────
  const handleConfigChange = useCallback(
    (partial: Partial<IForgeNodeConfig>) => {
      setConfigDraft((prev) => ({ ...prev, ...partial } as IForgeNodeConfig))
    },
    []
  )

  // ── Duplicate ────────────────────────────────────────────────────────
  let _dupCounter = 0
  const handleDuplicate = useCallback(() => {
    const newId = `forge_n_dup_${Date.now()}_${(_dupCounter++).toString(16)}`
    const duplicate: IForgeNode = {
      ...node,
      id: newId,
      label: `${node.label ?? node.type} copy`,
      uiPosition: {
        x: node.uiPosition.x + 32,
        y: node.uiPosition.y + 32,
      },
    }
    addNode(duplicate)
    inspectNode(newId)
  }, [node, addNode, inspectNode])

  // ── Delete ───────────────────────────────────────────────────────────
  const handleDelete = useCallback(() => {
    removeNode(node.id)
    inspectNode(null)
  }, [node.id, removeNode, inspectNode])

  // ── Render ───────────────────────────────────────────────────────────
  const catColor  = getCategoryColor(node.category)
  const icon      = getNodeIcon(node.type as ForgeNodeType)
  const ConfigPanel = getConfigPanel(node.type as ForgeNodeType)

  return (
    <div className="node-inspector">
      {/* Header */}
      <div className="ni-header" style={{ borderBottomColor: `${catColor}40` }}>
        <span className="ni-header__icon">{icon}</span>
        <div className="ni-header__info">
          <span className="ni-header__type" style={{ color: catColor }}>
            {node.type.replace(/_/g, ' ').toUpperCase()}
          </span>
          <span className="ni-header__category">{node.category}</span>
        </div>
        <button
          className="ni-close"
          onClick={() => inspectNode(null)}
          title="Close inspector"
        >
          <IconX size={12} />
        </button>
      </div>

      {/* Label */}
      <div className="ni-section">
        <div className="ni-section__title">LABEL</div>
        <input
          className="ni-label-input"
          type="text"
          value={labelDraft}
          maxLength={48}
          onChange={(e) => setLabelDraft(e.target.value)}
          onBlur={handleLabelBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
        />
      </div>

      {/* Config Panel */}
      {ConfigPanel && (
        <div className="ni-section">
          <div className="ni-section__title">PARAMETERS</div>
          <ConfigPanel config={configDraft} onChange={handleConfigChange} />
        </div>
      )}

      {/* Ports */}
      <InspectorPortList node={node} />

      {/* Actions */}
      <div className="ni-actions">
        <button className="ni-btn ni-btn--secondary" onClick={handleDuplicate}>
          <Copy size={12} />
          Duplicate
        </button>
        <button className="ni-btn ni-btn--danger" onClick={handleDelete}>
          <Trash2 size={12} />
          Delete
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// NODE INSPECTOR — Public export
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Panel de propiedades del nodo seleccionado.
 * Renderiza un placeholder si no hay nodo inspeccionado.
 */
export const NodeInspector: React.FC = () => {
  const node = useForgeGraphStore(
    useShallow((s) => {
      if (!s.inspectedNodeId || !s.graph) return null
      return s.graph.nodes.find((n) => n.id === s.inspectedNodeId) ?? null
    })
  )

  if (!node) {
    return (
      <div className="node-inspector node-inspector--empty">
        <div className="ni-empty">
          <span className="ni-empty__icon">⬡</span>
          <p className="ni-empty__text">Select a node to inspect its properties</p>
        </div>
      </div>
    )
  }

  // Key = node.id forces a full remount when a different node is selected,
  // ensuring the local draft state resets cleanly.
  return <NodeInspectorInner key={node.id} node={node} />
}
