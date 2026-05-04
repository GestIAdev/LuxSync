/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔥 FORGE GRAPH STORE — WAVE 4548.8b
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Estado Zustand dedicado al canvas de nodos del Forge.
 * SEPARADO del libraryStore — responsabilidad única: el grafo en edición.
 *
 * SOURCE OF TRUTH: IForgeNodeGraph (serializable, compilable, persistible)
 * El estado visual XYFlow es DERIVADO de este store, nunca al revés.
 *
 * @module stores/forgeGraphStore
 * @version WAVE 4548.8b
 */

import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type {
  IForgeNodeGraph,
  IForgeNode,
  IForgeEdge,
  ForgeNodeId,
  ForgeEdgeId,
  IForgeNodeConfig,
} from '../core/forge/types'

// ═══════════════════════════════════════════════════════════════════════════
// STATE INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

export interface ForgeGraphState {
  // ── Source of Truth ──────────────────────────────────────
  /** El grafo completo del fixture en edición. null = ningún fixture abierto */
  graph: IForgeNodeGraph | null

  /** ID del fixture propietario de este grafo */
  fixtureId: string | null

  /** ¿El grafo fue auto-migrado desde channels[] legacy? */
  isAutoMigrated: boolean

  // ── Selection ───────────────────────────────────────────
  /** IDs de los nodos seleccionados en el canvas */
  selectedNodeIds: Set<ForgeNodeId>

  /** ID del nodo cuyo inspector está abierto */
  inspectedNodeId: ForgeNodeId | null

  // ── Dirty Flag ──────────────────────────────────────────
  /** true si el grafo fue modificado desde el último save */
  isDirty: boolean

  // ── Actions ─────────────────────────────────────────────

  /** Carga un grafo completo (al abrir un fixture) */
  loadGraph: (
    graph: IForgeNodeGraph,
    fixtureId: string,
    autoMigrated: boolean
  ) => void

  /** Descarga el grafo — al cerrar/deseleccionar el fixture */
  unloadGraph: () => void

  /** Añade un nodo al grafo (desde Palette drag-drop) */
  addNode: (node: IForgeNode) => void

  /** Elimina un nodo y todas sus edges conectadas */
  removeNode: (nodeId: ForgeNodeId) => void

  /** Actualiza la posición UI de un nodo (onNodeDragStop) */
  moveNode: (nodeId: ForgeNodeId, x: number, y: number) => void

  /** Actualiza la config interna de un nodo (desde Inspector) */
  updateNodeConfig: (nodeId: ForgeNodeId, config: Partial<IForgeNodeConfig>) => void

  /** Actualiza el label de un nodo */
  updateNodeLabel: (nodeId: ForgeNodeId, label: string) => void

  /** Añade una conexión entre dos puertos */
  addEdge: (edge: IForgeEdge) => void

  /** Elimina una conexión */
  removeEdge: (edgeId: ForgeEdgeId) => void

  /** Establece la selección activa en el canvas */
  setSelection: (nodeIds: ForgeNodeId[]) => void

  /** Abre/cierra el inspector para un nodo */
  inspectNode: (nodeId: ForgeNodeId | null) => void

  /** Marca el store limpio (después de guardar) */
  markClean: () => void

  /** Vacía el canvas: elimina todos los nodos y edges del grafo activo */
  clearGraph: () => void
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function makeTimestamp(): string {
  return new Date().toISOString()
}

function cloneGraph(graph: IForgeNodeGraph): IForgeNodeGraph {
  // Spread superficial es suficiente — arrays son reemplazados, no mutados
  return { ...graph }
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════

export const useForgeGraphStore = create<ForgeGraphState>((set, get) => ({
  // ── Initial State ────────────────────────────────────────
  graph: null,
  fixtureId: null,
  isAutoMigrated: false,
  selectedNodeIds: new Set(),
  inspectedNodeId: null,
  isDirty: false,

  // ── Actions ─────────────────────────────────────────────

  loadGraph: (graph, fixtureId, autoMigrated) => {
    set({
      graph,
      fixtureId,
      isAutoMigrated: autoMigrated,
      selectedNodeIds: new Set(),
      inspectedNodeId: null,
      isDirty: false,
    })
  },

  unloadGraph: () => {
    set({
      graph: null,
      fixtureId: null,
      isAutoMigrated: false,
      selectedNodeIds: new Set(),
      inspectedNodeId: null,
      isDirty: false,
    })
  },

  addNode: (node) => {
    const { graph } = get()
    if (!graph) return

    set({
      graph: {
        ...graph,
        nodes: [...graph.nodes, node],
        meta: {
          ...graph.meta,
          createdAt: graph.meta.createdAt,
        },
      },
      isDirty: true,
    })
  },

  removeNode: (nodeId) => {
    const { graph, inspectedNodeId } = get()
    if (!graph) return

    set({
      graph: {
        ...graph,
        nodes: graph.nodes.filter((n) => n.id !== nodeId),
        edges: graph.edges.filter(
          (e) => e.sourceNode !== nodeId && e.targetNode !== nodeId
        ),
      },
      inspectedNodeId: inspectedNodeId === nodeId ? null : inspectedNodeId,
      isDirty: true,
    })
  },

  moveNode: (nodeId, x, y) => {
    const { graph } = get()
    if (!graph) return

    set({
      graph: {
        ...graph,
        nodes: graph.nodes.map((n) =>
          n.id === nodeId ? { ...n, uiPosition: { x, y } } : n
        ),
      },
      // No marcamos dirty en move — es una operación cosmética
    })
  },

  updateNodeConfig: (nodeId, partialConfig) => {
    const { graph } = get()
    if (!graph) return

    set({
      graph: {
        ...graph,
        nodes: graph.nodes.map((n) => {
          if (n.id !== nodeId) return n
          if (!partialConfig || typeof partialConfig !== 'object') return n
          return {
            ...n,
            config: { ...n.config, ...partialConfig } as IForgeNodeConfig,
          }
        }),
      },
      isDirty: true,
    })
  },

  updateNodeLabel: (nodeId, label) => {
    const { graph } = get()
    if (!graph) return

    set({
      graph: {
        ...graph,
        nodes: graph.nodes.map((n) =>
          n.id === nodeId ? { ...n, label } : n
        ),
      },
      isDirty: true,
    })
  },

  addEdge: (edge) => {
    const { graph } = get()
    if (!graph) return

    // Prevenir duplicados
    const alreadyExists = graph.edges.some((e) => e.id === edge.id)
    if (alreadyExists) return

    set({
      graph: {
        ...graph,
        edges: [...graph.edges, edge],
      },
      isDirty: true,
    })
  },

  removeEdge: (edgeId) => {
    const { graph } = get()
    if (!graph) return

    set({
      graph: {
        ...graph,
        edges: graph.edges.filter((e) => e.id !== edgeId),
      },
      isDirty: true,
    })
  },

  setSelection: (nodeIds) => {
    set({ selectedNodeIds: new Set(nodeIds) })
  },

  inspectNode: (nodeId) => {
    if (nodeId === null) {
      set({ inspectedNodeId: null })
      return
    }

    const { graph } = get()
    const exists = graph?.nodes.some((n) => n.id === nodeId) ?? false
    set({ inspectedNodeId: exists ? nodeId : null })
  },

  markClean: () => {
    set({ isDirty: false })
  },

  clearGraph: () => {
    const { graph } = get()
    if (!graph) return
    set({
      graph: {
        ...graph,
        nodes: [],
        edges: [],
      },
      selectedNodeIds: new Set(),
      inspectedNodeId: null,
      isDirty: true,
    })
  },
}))

// ═══════════════════════════════════════════════════════════════════════════
// SELECTORS — para hooks granulares (evitan re-renders innecesarios)
// ═══════════════════════════════════════════════════════════════════════════

/** Retorna el nodo inspeccionado o null — solo re-renderiza cuando CAMBIA ese nodo */
export function useInspectedNode() {
  return useForgeGraphStore(
    useShallow((s) => {
      if (!s.inspectedNodeId || !s.graph || !Array.isArray(s.graph.nodes)) return null
      return s.graph.nodes.find((n) => n.id === s.inspectedNodeId) ?? null
    })
  )
}

/** Retorna los edges del grafo actual */
export function useForgeEdges() {
  return useForgeGraphStore(useShallow((s) => s.graph?.edges ?? []))
}

/** Retorna los nodos del grafo actual */
export function useForgeNodes() {
  return useForgeGraphStore(useShallow((s) => s.graph?.nodes ?? []))
}
