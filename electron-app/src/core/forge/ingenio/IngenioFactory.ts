/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📦  INGENIO FACTORY — Creación de Ingenios vacíos y de sistema
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 4549.1: Funciones factory para generar estructuras IIngenioDefinition
 * válidas y listas para persistir como .luxingenio.
 *
 * @module core/forge/ingenio/IngenioFactory
 * @version WAVE 4549.1
 */

import type {
  IIngenioDefinition,
  IngenioCategory,
  IngenioSchemaVersion,
  IExposedPort,
  IIngenioPortMapping,
  IIngenioMeta,
} from './types'
import type { IForgeNodeGraph } from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const SCHEMA_VERSION: IngenioSchemaVersion = '1.0.0'
const GENERATOR_WAVE = 'WAVE-4549.1'

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function generateIngenioId(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).substring(2, 8)
  return `ingenio-${ts}-${rand}`
}

function nowISO(): string {
  return new Date().toISOString()
}

// ═══════════════════════════════════════════════════════════════════════════
// EMPTY GRAPH (for brand-new Ingenios)
// ═══════════════════════════════════════════════════════════════════════════

function createEmptySubGraph(): IForgeNodeGraph {
  return {
    version: '1.0.0',
    nodes: [],
    edges: [],
    meta: {
      createdAt: nowISO(),
      generatorWave: GENERATOR_WAVE,
      autoMigrated: false,
      dmxFootprint: 0,
    },
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════

export class IngenioFactory {
  /**
   * Creates a valid empty IIngenioDefinition ready for editing.
   *
   * @param name — Display name for the Ingenio
   * @param category — Functional category
   * @param options — Optional overrides
   * @returns A valid .luxingenio structure with zero internal logic
   */
  static createEmpty(
    name: string = 'New Ingenio',
    category: IngenioCategory = 'utility',
    options?: {
      author?: string
      description?: string
      tags?: readonly string[]
      icon?: string
      accentColor?: string
    },
  ): IIngenioDefinition {
    const now = nowISO()
    return {
      version: SCHEMA_VERSION,
      id: generateIngenioId(),
      name,
      author: options?.author ?? 'User',
      description: options?.description ?? '',
      tags: options?.tags ?? [],
      category,
      exposedPorts: [],
      subGraph: createEmptySubGraph(),
      portMapping: { inputs: [], outputs: [] },
      meta: {
        createdAt: now,
        updatedAt: now,
        generatorWave: GENERATOR_WAVE,
        internalNodeCount: 0,
        internalEdgeCount: 0,
      },
      icon: options?.icon,
      accentColor: options?.accentColor,
    }
  }

  /**
   * Creates an IIngenioDefinition from an existing subGraph and exposed ports.
   * Used when the user "extracts" a selection of nodes from a fixture's
   * nodeGraph into a reusable Ingenio.
   *
   * @param name — Display name
   * @param category — Functional category
   * @param subGraph — The internal logic graph
   * @param exposedPorts — The ports exposed to the outside world
   * @param portMapping — Wiring from exposed ports to internal proxy nodes
   * @param options — Optional overrides
   */
  static fromSubGraph(
    name: string,
    category: IngenioCategory,
    subGraph: IForgeNodeGraph,
    exposedPorts: readonly IExposedPort[],
    portMapping: IIngenioPortMapping,
    options?: {
      author?: string
      description?: string
      tags?: readonly string[]
      icon?: string
      accentColor?: string
    },
  ): IIngenioDefinition {
    const now = nowISO()
    return {
      version: SCHEMA_VERSION,
      id: generateIngenioId(),
      name,
      author: options?.author ?? 'User',
      description: options?.description ?? '',
      tags: options?.tags ?? [],
      category,
      exposedPorts,
      subGraph,
      portMapping,
      meta: {
        createdAt: now,
        updatedAt: now,
        generatorWave: GENERATOR_WAVE,
        internalNodeCount: subGraph.nodes.length,
        internalEdgeCount: subGraph.edges.length,
      },
      icon: options?.icon,
      accentColor: options?.accentColor,
    }
  }

  /**
   * Updates the metadata timestamps and counts of an existing Ingenio.
   * Returns a new object (immutable pattern).
   */
  static refreshMeta(ingenio: IIngenioDefinition): IIngenioDefinition {
    return {
      ...ingenio,
      meta: {
        ...ingenio.meta,
        updatedAt: nowISO(),
        internalNodeCount: ingenio.subGraph.nodes.length,
        internalEdgeCount: ingenio.subGraph.edges.length,
      },
    }
  }
}
