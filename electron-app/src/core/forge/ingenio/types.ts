/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📦  INGENIO ECOSYSTEM — TYPE SYSTEM
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 4549.1: Los átomos del sistema de Ingenios reutilizables.
 *
 * Un Ingenio es un sub-grafo de nodos encapsulado como entidad
 * independiente, reutilizable entre fixtures.
 *
 * Analogía: Un Ingenio es a un ForgeNodeGraph lo que una función
 * es a un programa — tiene entradas genéricas, salidas genéricas,
 * y una implementación interna encapsulada.
 *
 * PRINCIPIO: Un Ingenio es auto-contenido. Su subGraph NO referencia
 * ningún canal DMX concreto ni fixture específico. Toda la I/O
 * se realiza a través de ExposedPorts.
 *
 * @module core/forge/ingenio/types
 * @version WAVE 4549.1
 */

import type { ForgeDataType, ForgeNodeId, ForgePortId, IForgeNodeGraph } from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// IDENTITY TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** ID único global del Ingenio (UUID o slug legible) */
export type IngenioId = string

/** Versión semántica del schema del Ingenio */
export type IngenioSchemaVersion = '1.0.0'

// ═══════════════════════════════════════════════════════════════════════════
// INGENIO CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Categoría funcional de un Ingenio.
 * Determina dónde aparece en el asset browser y su icono.
 */
export type IngenioCategory =
  | 'modulation'    // LFOs, waves, oscillators
  | 'dynamics'      // Smooth, envelope, compressor
  | 'audio'         // Audio-reactive patterns
  | 'sequencer'     // Chase, step sequencer
  | 'logic'         // Complex gating, switching
  | 'utility'       // Math, merge, split
  | 'effect'        // Strobe patterns, flicker

// ═══════════════════════════════════════════════════════════════════════════
// EXPOSED PORT — Punto de contacto con el fixture contenedor
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Puerto expuesto del Ingenio — punto de contacto genérico.
 *
 * Un ExposedPort NO es un canal DMX concreto. Es un "slot" genérico
 * que el usuario mapea al canal real cuando instancia el Ingenio
 * dentro del nodeGraph de un fixture.
 */
export interface IExposedPort {
  /** ID único del puerto expuesto (e.g. "signal", "threshold", "output") */
  readonly id: string
  /** Dirección: ¿es un input o output del Ingenio? */
  readonly direction: 'in' | 'out'
  /** Tipo de dato que acepta/emite */
  readonly dataType: ForgeDataType
  /** Etiqueta legible para la UI */
  readonly label: string
  /** Descripción para tooltip/help */
  readonly description?: string
  /** Valor por defecto cuando el puerto no está conectado */
  readonly defaultValue: number
}

// ═══════════════════════════════════════════════════════════════════════════
// PORT MAPPING — Wiring de ExposedPorts a nodos proxy internos
// ═══════════════════════════════════════════════════════════════════════════

export interface IIngenioPortMapping {
  /** Mapeo: exposedPort.id (direction: 'in') → nodo proxy_input interno */
  readonly inputs: ReadonlyArray<{
    readonly exposedPortId: string
    readonly internalNodeId: ForgeNodeId
    readonly internalPortId: ForgePortId
  }>
  /** Mapeo: exposedPort.id (direction: 'out') → nodo proxy_output interno */
  readonly outputs: ReadonlyArray<{
    readonly exposedPortId: string
    readonly internalNodeId: ForgeNodeId
    readonly internalPortId: ForgePortId
  }>
}

// ═══════════════════════════════════════════════════════════════════════════
// INGENIO METADATA
// ═══════════════════════════════════════════════════════════════════════════

export interface IIngenioMeta {
  /** Fecha de creación (ISO 8601) */
  readonly createdAt: string
  /** Fecha de última modificación */
  readonly updatedAt: string
  /** WAVE que generó este Ingenio */
  readonly generatorWave: string
  /** Número de nodos internos (para info en el browser) */
  readonly internalNodeCount: number
  /** Número de edges internos */
  readonly internalEdgeCount: number
}

// ═══════════════════════════════════════════════════════════════════════════
// INGENIO DEFINITION — La entidad independiente completa
// ═══════════════════════════════════════════════════════════════════════════

/**
 * IIngenioDefinition — Definición completa de un Ingenio independiente.
 *
 * Se persiste como archivo `.luxingenio` (JSON) en:
 *   userData/ingenios/system/  (factory, read-only)
 *   userData/ingenios/user/    (usuario, writable)
 */
export interface IIngenioDefinition {
  /** Versión del schema */
  readonly version: IngenioSchemaVersion

  /** ID único global del Ingenio */
  readonly id: IngenioId

  /** Nombre legible ("Audio Pulse Gate", "Smooth Dimmer Ramp") */
  readonly name: string

  /** Autor del Ingenio */
  readonly author: string

  /** Descripción corta para la librería */
  readonly description: string

  /** Tags para búsqueda y filtrado ("audio", "strobe", "chase", "smooth") */
  readonly tags: readonly string[]

  /** Categoría funcional para agrupación en el browser */
  readonly category: IngenioCategory

  /** Puertos expuestos — los puntos de conexión con el mundo exterior */
  readonly exposedPorts: readonly IExposedPort[]

  /**
   * Sub-grafo interno — la lógica encapsulada del Ingenio.
   * Usa nodos proxy (input_constant) que se corresponden 1:1 con ExposedPorts.
   */
  readonly subGraph: IForgeNodeGraph

  /** Mapeo ExposedPort.id → nodo interno del subGraph */
  readonly portMapping: IIngenioPortMapping

  /** Metadata del Ingenio */
  readonly meta: IIngenioMeta

  /** Icono del Ingenio (emoji o nombre de icono Lucide) */
  readonly icon?: string

  /** Color de acento para la UI (hex) */
  readonly accentColor?: string
}
