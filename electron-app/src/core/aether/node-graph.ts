/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️  AETHER MATRIX — NODE GRAPH CONTRACTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3505.1: El contrato de la Matriz — el World del ECS pragmático.
 *
 * El NodeGraph es el registro central de todos los nodos activos.
 * Es el corazón del Motor Agnóstico: almacena nodos en dense arrays
 * por familia, mantiene índices de búsqueda multi-criterio, y expone
 * vistas tipadas para que cada System itere solo los nodos de su dominio.
 *
 * DISEÑO DATA-ORIENTED:
 * - Dense arrays por familia → iteración cache-friendly.
 * - Slot stability → NodeId estable tras patch, sin reordenamiento.
 * - Zero-alloc views → getView() retorna wrapper ligero, sin copia.
 * - Multi-index → búsqueda O(1) por zona, rol, device, o tipo.
 *
 * INMUTABILIDAD DURANTE FRAME:
 * El NodeGraph solo se modifica en eventos de patch (registerDevice,
 * unregisterDevice). Durante el frame loop de 44Hz, la estructura
 * del grafo es inmutable — solo los estados internos de los nodos
 * (Float64Array) se mutan in-place.
 *
 * @module core/aether/node-graph
 * @version WAVE 3505.1
 */

import type {
  NodeId,
  DeviceId,
  ZoneId,
  NodeFamily,
  NodeRole,
} from './types'
import type {
  ICapabilityNode,
  IColorNodeData,
  IImpactNodeData,
  IKineticNodeData,
  IBeamNodeData,
  IAtmosphereNodeData,
  AnyNodeData,
} from './capability-node'
import type { IDeviceDefinition } from './device'

// ═══════════════════════════════════════════════════════════════════════════
// NODE SLOT LOCATION — Coordenada interna del dense array
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ubicación interna de un nodo dentro de los dense arrays del NodeGraph.
 *
 * Mapea un NodeId a su familia + índice en el array correspondiente.
 * Usado internamente por el NodeGraph para acceso O(1) por NodeId.
 */
export interface INodeSlotLocation {
  /** Familia del nodo (determina en qué dense array vive) */
  readonly family: NodeFamily
  /** Índice dentro del dense array de esa familia */
  readonly index: number
}

// ═══════════════════════════════════════════════════════════════════════════
// NODE VIEW — Vista tipada sobre un subconjunto del grafo
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🔭 INodeView — Vista tipada, eficiente y de solo lectura sobre
 * un subconjunto de nodos del NodeGraph.
 *
 * Cada System recibe una vista tipada con los nodos de su familia:
 * - ColorSystem   recibe `INodeView<IColorNodeData>`
 * - ImpactSystem  recibe `INodeView<IImpactNodeData>`
 * - KineticSystem recibe `INodeView<IKineticNodeData>`
 * - BeamSystem    recibe `INodeView<IBeamNodeData>`
 * - AtmosSystem   recibe `INodeView<IAtmosphereNodeData>`
 *
 * ZERO-ALLOC: la vista es un wrapper ligero sobre el dense array
 * subyacente. No copia datos. `forEach()` itera directamente
 * sobre el array original.
 *
 * @typeParam T — Tipo de datos de nodo específico de la familia
 */
export interface INodeView<T extends ICapabilityNode> {
  /** Número de nodos activos en esta vista */
  readonly count: number

  /**
   * Iterador de alta performance sobre todos los nodos.
   * El callback recibe el nodo y su índice dentro de la vista.
   * No crea arrays intermedios — iteración directa in-place.
   */
  forEach(fn: (node: T, index: number) => void): void

  /**
   * Acceso directo a un nodo por índice (O(1)).
   * El índice es relativo a esta vista, no al array global.
   * @throws RangeError si index < 0 || index >= count
   */
  get(index: number): T

  /**
   * Filtra nodos por zona espacial.
   * Usa el índice pre-construido del NodeGraph para O(1) lookup.
   * @returns Array de nodos de esta vista que pertenecen a la zona.
   */
  byZone(zoneId: ZoneId): readonly T[]

  /**
   * Filtra nodos por rol semántico.
   * Usa el índice pre-construido del NodeGraph para O(1) lookup.
   * @returns Array de nodos de esta vista con el rol indicado.
   */
  byRole(role: NodeRole): readonly T[]
}

// ═══════════════════════════════════════════════════════════════════════════
// NODE GRAPH SNAPSHOT — Captura inmutable para debug/telemetry
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Snapshot inmutable del estado del NodeGraph en un instante.
 *
 * Usado para debug, telemetría UI, y tests de regresión.
 * No se genera cada frame — solo bajo demanda explícita.
 */
export interface INodeGraphSnapshot {
  /** Timestamp de la captura (ms) */
  readonly timestamp: number
  /** Conteo de nodos por familia */
  readonly counts: Readonly<Record<NodeFamily, number>>
  /** Total de nodos activos */
  readonly totalNodes: number
  /** Total de Devices registrados */
  readonly totalDevices: number
  /** IDs de todos los Devices */
  readonly deviceIds: readonly DeviceId[]
  /** IDs de todas las zonas con nodos asignados */
  readonly activeZones: readonly ZoneId[]
  /** Distribución de roles activos */
  readonly roleDistribution: Readonly<Record<string, number>>
}

// ═══════════════════════════════════════════════════════════════════════════
// FAMILY-TO-DATA TYPE MAP — Mapa tipado familia → tipo de datos
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mapa de tipos que asocia cada NodeFamily con su interfaz de datos.
 *
 * Permite al NodeGraph exponer vistas fuertemente tipadas:
 * `getView(NodeFamily.COLOR)` retorna `INodeView<IColorNodeData>`.
 *
 * Uso interno del NodeGraph para resolución de tipos genéricos.
 */
export interface NodeFamilyDataMap {
  [NodeFamily.COLOR]: IColorNodeData
  [NodeFamily.IMPACT]: IImpactNodeData
  [NodeFamily.KINETIC]: IKineticNodeData
  [NodeFamily.BEAM]: IBeamNodeData
  [NodeFamily.ATMOSPHERE]: IAtmosphereNodeData
}

// ═══════════════════════════════════════════════════════════════════════════
// INODEGRAPH — La interfaz de la Matriz
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🌌 INodeGraph — El contrato de la Aether Matrix.
 *
 * Registro central de todos los CapabilityNodes activos en el show.
 * Almacena nodos en dense arrays segregados por familia, con índices
 * multi-criterio para búsqueda eficiente.
 *
 * OPERACIONES DE PATCH (modifican la estructura):
 * - `registerDevice()` — genera nodos y los inserta en los arrays.
 * - `unregisterDevice()` — elimina nodos y compacta los arrays.
 * Estas operaciones SOLO ocurren fuera del frame loop.
 *
 * OPERACIONES DE FRAME (lectura + vistas):
 * - `getView()` — vista tipada para un System.
 * - `getNodesByZone()` — lookup por zona.
 * - `getNodesByRole()` — lookup por rol.
 * - `getDeviceNodes()` — lookup por device.
 * - `getNodeData()` — acceso directo a un nodo.
 * Estas operaciones son zero-alloc y thread-safe (readonly).
 *
 * @see WAVE-3505-BLUEPRINT.md §2.2 "El NodeGraph (World)"
 */
export interface INodeGraph {
  // ── Operaciones de Patch ─────────────────────────────────────────────

  /**
   * Registra un Device y genera los CapabilityNodes correspondientes.
   *
   * Lee los nodos definidos en la DeviceDefinition, los inserta en
   * los dense arrays por familia, y actualiza todos los índices.
   *
   * SOLO llamar fuera del frame loop (en eventos de patch de La Forja).
   *
   * @param definition — Definición completa del Device a registrar
   * @returns Array de NodeIds generados para cada nodo del Device
   */
  registerDevice(definition: IDeviceDefinition): readonly NodeId[]

  /**
   * Desregistra un Device y elimina todos sus nodos de la Matriz.
   *
   * Compacta los dense arrays y actualiza los índices.
   * Los NodeIds de este Device quedan invalidados permanentemente.
   *
   * SOLO llamar fuera del frame loop.
   *
   * @param deviceId — ID del Device a eliminar
   */
  unregisterDevice(deviceId: DeviceId): void

  // ── Vistas tipadas para Systems ──────────────────────────────────────

  /**
   * Obtiene una vista tipada de todos los nodos de una familia.
   *
   * Zero-alloc: retorna un wrapper ligero sobre el dense array
   * subyacente, sin copiar datos.
   *
   * @typeParam F — La familia de nodos (keyof NodeFamilyDataMap)
   * @param family — La familia de nodo deseada
   * @returns Vista tipada con los nodos de esa familia
   *
   * @example
   * ```ts
   * const colorView = nodeGraph.getView(NodeFamily.COLOR)
   * // colorView es INodeView<IColorNodeData>
   * colorView.forEach((node) => {
   *   node.mixingType // ← type-safe, sin cast
   * })
   * ```
   */
  getView<F extends NodeFamily>(family: F): INodeView<NodeFamilyDataMap[F]>

  // ── Lookups por índice ───────────────────────────────────────────────

  /**
   * Busca todos los nodos asignados a una zona espacial.
   * O(1) lookup via índice pre-construido.
   *
   * @param zoneId — ID de la zona
   * @returns Array de NodeIds en esa zona (vacío si la zona no existe)
   */
  getNodesByZone(zoneId: ZoneId): readonly NodeId[]

  /**
   * Busca todos los nodos con un rol semántico específico.
   * O(1) lookup via índice pre-construido.
   *
   * @param role — Rol semántico a buscar
   * @returns Array de NodeIds con ese rol
   */
  getNodesByRole(role: NodeRole): readonly NodeId[]

  /**
   * Busca todos los nodos que pertenecen a un Device.
   * O(1) lookup via índice pre-construido.
   *
   * @param deviceId — ID del Device
   * @returns Array de NodeIds de ese Device (vacío si no existe)
   */
  getDeviceNodes(deviceId: DeviceId): readonly NodeId[]

  /**
   * Retorna la IDeviceDefinition completa para un Device registrado.
   * O(1) lookup — usado por el NodeResolver para obtener dmxAddress y universe.
   *
   * @param deviceId — ID del Device
   * @returns IDeviceDefinition, o undefined si el Device no está registrado
   */
  getDevice(deviceId: DeviceId): IDeviceDefinition | undefined

  // ── Acceso directo a nodos ───────────────────────────────────────────

  /**
   * Accede directamente a los datos de un nodo por su ID.
   *
   * @param nodeId — ID del nodo
   * @returns Datos del nodo, o undefined si el ID no existe
   */
  getNodeData(nodeId: NodeId): AnyNodeData | undefined

  /**
   * Verifica si un NodeId existe en la Matriz.
   *
   * @param nodeId — ID del nodo a verificar
   * @returns true si el nodo está registrado
   */
  hasNode(nodeId: NodeId): boolean

  // ── Telemetría ───────────────────────────────────────────────────────

  /**
   * Captura un snapshot inmutable del estado actual de la Matriz.
   * Solo llamar bajo demanda (debug/UI) — no en el hot path.
   */
  snapshot(): INodeGraphSnapshot

  // ── Metadata global ──────────────────────────────────────────────────

  /** Número total de nodos activos en la Matriz */
  readonly totalNodes: number

  /** Número total de Devices registrados */
  readonly totalDevices: number
}
