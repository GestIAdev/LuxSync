/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🖱️  NODE CANVAS — WAVE 4548.8b
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Wrapper de @xyflow/react que:
 *  1. Lee graph.nodes / graph.edges del forgeGraphStore
 *  2. Los convierte a XYNode[] / XYEdge[] (formato de ReactFlow)
 *  3. Sincroniza onNodeDragStop → store.moveNode()
 *  4. Intercepta onDrop desde NodePalette → llama createNode → store.addNode()
 *  5. Sincroniza onConnect → store.addEdge()
 *  6. Sincroniza onNodesDelete / onEdgesDelete → store.removeNode/removeEdge()
 *  7. Sincroniza selección → store.setSelection() + store.inspectNode()
 *
 * Los nodos se renderizan con el tipo genérico por defecto de XYFlow por
 * ahora (N5a). Los custom nodes (ForgeInputNode, etc.) se añaden en N5b.
 *
 * SYNC STRATEGY:
 *  - La fuente de verdad es IForgeNodeGraph en forgeGraphStore.
 *  - El estado XYFlow local (rfNodes/rfEdges) se deriva del store.
 *  - Las posiciones solo se escriben al store en onNodeDragStop (no en cada
 *    frame del drag) para evitar re-renders innecesarios del inspector.
 *
 * @module components/views/ForgeView/canvas/NodeCanvas
 * @version WAVE 4548.8b
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Panel,
  SelectionMode,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  type Node as XYNode,
  type Edge as XYEdge,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
  type NodeMouseHandler,
  type OnConnect,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useForgeGraphStore } from '../../../../stores/forgeGraphStore'
import { ALL_PALETTE_ENTRIES } from '../palette/forgePalette'
import type { IForgeEdge, IForgeNode, ICompoundIngenioConfig } from '../../../../core/forge/types'
import { FORGE_NODE_TYPE_MAP, buildNodeData } from '../nodes/forgeNodeTypeMap'
import './NodeCanvas.css'

// ═══════════════════════════════════════════════════════════════════════════
// CONVERTERS — IForgeNode / IForgeEdge ↔ XYFlow types
// ═══════════════════════════════════════════════════════════════════════════

function forgeNodeToXY(node: IForgeNode): XYNode {
  return {
    id: node.id,
    type: node.type,   // mapea al custom node component via FORGE_NODE_TYPE_MAP
    position: { x: node.uiPosition.x, y: node.uiPosition.y },
    data: buildNodeData(node),
  }
}

function forgeEdgeToXY(edge: IForgeEdge): XYEdge {
  return {
    id: edge.id,
    source: edge.sourceNode,
    sourceHandle: edge.sourcePort,
    target: edge.targetNode,
    targetHandle: edge.targetPort,
    type: 'smoothstep',
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ID GENERATION — determinista, sin Math.random
// ═══════════════════════════════════════════════════════════════════════════

let _nodeCounter = 0
function makeNodeId(): string {
  return `forge_n_${Date.now()}_${(_nodeCounter++).toString(16)}`
}

let _edgeCounter = 0
function makeEdgeId(source: string, sourceHandle: string, target: string, targetHandle: string): string {
  return `forge_e_${source}:${sourceHandle}→${target}:${targetHandle}_${(_edgeCounter++).toString(16)}`
}

// ═══════════════════════════════════════════════════════════════════════════
// INNER CANVAS — requiere estar dentro de ReactFlowProvider
// ═══════════════════════════════════════════════════════════════════════════

const NodeCanvasInner: React.FC<{ readOnly?: boolean }> = ({ readOnly = false }) => {
  const { screenToFlowPosition } = useReactFlow()

  // ── Store selectors ─────────────────────────────────────────────────────
  const forgeNodes = useForgeGraphStore((s) => s.graph?.nodes)
  const forgeEdges = useForgeGraphStore((s) => s.graph?.edges)
  const addNode = useForgeGraphStore((s) => s.addNode)
  const moveNode = useForgeGraphStore((s) => s.moveNode)
  const addEdge_ = useForgeGraphStore((s) => s.addEdge)
  const removeNodeFromStore = useForgeGraphStore((s) => s.removeNode)
  const removeEdgeFromStore = useForgeGraphStore((s) => s.removeEdge)
  const setSelection = useForgeGraphStore((s) => s.setSelection)

  // ── Local XYFlow state (DERIVADO del store) ──────────────────────────────
  const [rfNodes, setRfNodes] = useState<XYNode[]>(() =>
    forgeNodes ? forgeNodes.map(forgeNodeToXY) : []
  )
  const [rfEdges, setRfEdges] = useState<XYEdge[]>(() =>
    forgeEdges ? forgeEdges.map(forgeEdgeToXY) : []
  )

  // Hydrate cuando el grafo cambia en el store (apertura de nuevo fixture)
  useEffect(() => {
    setRfNodes(forgeNodes ? forgeNodes.map(forgeNodeToXY) : [])
  }, [forgeNodes])

  useEffect(() => {
    setRfEdges(forgeEdges ? forgeEdges.map(forgeEdgeToXY) : [])
  }, [forgeEdges])

  // ── Canvas → XYFlow local (mientras se arrastra) ─────────────────────────
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      if (readOnly) return
      setRfNodes((prev) => applyNodeChanges(changes, prev))
    },
    [readOnly]
  )

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      if (readOnly) return
      setRfEdges((prev) => applyEdgeChanges(changes, prev))
    },
    [readOnly]
  )

  // ── Drag stop → persistir posición final en el store ────────────────────
  const onNodeDragStop: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (readOnly) return
      moveNode(node.id, node.position.x, node.position.y)
    },
    [moveNode, readOnly]
  )

  // ── Connect → nuevo edge en el store ────────────────────────────────────
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (readOnly) return
      const { source, sourceHandle, target, targetHandle } = connection
      if (!source || !target) return

      const edgeId = makeEdgeId(
        source,
        sourceHandle ?? 'default',
        target,
        targetHandle ?? 'default'
      )

      const newForgeEdge: IForgeEdge = {
        id: edgeId,
        sourceNode: source,
        sourcePort: sourceHandle ?? 'default',
        targetNode: target,
        targetPort: targetHandle ?? 'default',
      }

      addEdge_(newForgeEdge)
      setRfEdges((prev) =>
        addEdge({ ...newForgeEdge, type: 'smoothstep', source, target }, prev)
      )
    },
    [addEdge_, readOnly]
  )

  // ── Delete nodes ────────────────────────────────────────────────────────
  const onNodesDelete = useCallback(
    (nodes: XYNode[]) => {
      if (readOnly) return
      nodes.forEach((n) => removeNodeFromStore(n.id))
    },
    [removeNodeFromStore, readOnly]
  )

  // ── Delete edges ────────────────────────────────────────────────────────
  const onEdgesDelete = useCallback(
    (edges: XYEdge[]) => {
      if (readOnly) return
      edges.forEach((e) => removeEdgeFromStore(e.id))
    },
    [removeEdgeFromStore, readOnly]
  )

  // ── Selection ───────────────────────────────────────────────────────────
  const onSelectionChange = useCallback(
    ({ nodes }: { nodes: XYNode[] }) => {
      const ids = nodes.map((n) => n.id)
      setSelection(ids)

      const selectedId = nodes.length > 0 ? nodes[0].id : null
      useForgeGraphStore.getState().inspectNode(selectedId)
    },
    [setSelection]
  )

  // ── Ctrl/Cmd + A -> seleccionar todos los nodos del canvas ─────────────
  useEffect(() => {
    if (readOnly) return

    const onGlobalKeyDown = (event: KeyboardEvent) => {
      const isSelectAll = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a'
      if (!isSelectAll) return

      event.preventDefault()
      const allNodeIds = (forgeNodes ?? []).map((n) => n.id)

      setRfNodes((prev) => prev.map((n) => ({ ...n, selected: true })))
      setSelection(allNodeIds)
      useForgeGraphStore.getState().inspectNode(allNodeIds[0] ?? null)
    }

    window.addEventListener('keydown', onGlobalKeyDown)
    return () => window.removeEventListener('keydown', onGlobalKeyDown)
  }, [forgeNodes, readOnly, setSelection])

  // ── DragOver — necesario para que onDrop funcione ───────────────────────
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  // ── Drop desde NodePalette ───────────────────────────────────────────────
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      if (readOnly) return

      const nodeType = event.dataTransfer.getData('application/forgenode')
      if (!nodeType) return

      // Convertir coordenadas de pantalla a coordenadas del canvas
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const newId = makeNodeId()
      let newNode: IForgeNode

      // ── Caso especial: compound_ingenio desde UAB ──────────────────────
      if (nodeType === 'compound_ingenio') {
        const ingenioRef  = event.dataTransfer.getData('application/ingenio-ref') || null
        const ingenioName = event.dataTransfer.getData('application/ingenio-name') || 'Ingenio'
        const config: ICompoundIngenioConfig = {
          nodeType:      'compound_ingenio',
          ingenioName,
          ingenioRef,
          subGraph: { version: '1.0.0', nodes: [], edges: [], meta: {
            createdAt: new Date().toISOString(),
            generatorWave: 'WAVE-4548.9',
            autoMigrated: false,
            dmxFootprint: 0,
          }},
          portMapping: { inputs: [], outputs: [] },
        }
        newNode = {
          id: newId,
          type:     'compound_ingenio',
          category: 'compound',
          label:    ingenioName,
          uiPosition: position,
          inputs:   [],
          outputs:  [],
          config,
        }
      } else {
        const entry = ALL_PALETTE_ENTRIES.find((e) => e.type === nodeType)
        if (!entry) return
        newNode = entry.createNode(newId, position)
      }

      addNode(newNode)
      // XYFlow local — añadir inmediatamente para respuesta visual instantánea
      setRfNodes((prev) => [...prev, forgeNodeToXY(newNode)])
    },
    [addNode, screenToFlowPosition, readOnly]
  )

  return (
    <div className="node-canvas" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onSelectionChange={onSelectionChange}
        nodeTypes={FORGE_NODE_TYPE_MAP}
        elementsSelectable={true}
        selectionMode={SelectionMode.Partial}
        selectionKeyCode="Shift"
        multiSelectionKeyCode={['Control', 'Meta']}
        deleteKeyCode={['Delete', 'Backspace']}
        proOptions={{ hideAttribution: true }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        snapToGrid
        snapGrid={[16, 16]}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="rgba(255,255,255,0.08)"
        />
        <Controls
          showZoom
          showFitView
          showInteractive
          style={{ bottom: 12, left: 12 }}
        />
        <MiniMap
          nodeColor="#1a1a2e"
          maskColor="rgba(10,10,15,0.75)"
          style={{ bottom: 12, right: 12 }}
        />
        <Panel position="bottom-center">
          <div className="node-canvas__hints" role="note" aria-label="Canvas shortcuts">
            <span className="node-canvas__hint-chip">Shift + Arrastrar: Lazo</span>
            <span className="node-canvas__hint-sep">|</span>
            <span className="node-canvas__hint-chip">Ctrl/Cmd + Clic: Multiple</span>
            <span className="node-canvas__hint-sep">|</span>
            <span className="node-canvas__hint-chip">Ctrl/Cmd + A: Todo</span>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT — envuelto en ReactFlowProvider (requerido por useReactFlow)
// ═══════════════════════════════════════════════════════════════════════════

interface NodeCanvasProps {
  readOnly?: boolean
}

const NodeCanvas: React.FC<NodeCanvasProps> = ({ readOnly = false }) => {
  return (
    <ReactFlowProvider>
      <NodeCanvasInner readOnly={readOnly} />
    </ReactFlowProvider>
  )
}

export default NodeCanvas
