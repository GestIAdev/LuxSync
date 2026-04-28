/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️  AETHER MATRIX — NODE GRAPH IMPLEMENTATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3505.2: Implementación concreta de INodeGraph.
 *
 * DATA-ORIENTED DESIGN:
 * Los nodos de cada familia viven en arrays planos contiguos.
 * La iteración es O(N) sin indirección — el CPU prefetcher puede
 * cargar los próximos nodos antes de que los necesitemos (cache-friendly).
 *
 * ÍNDICES PRE-CONSTRUIDOS:
 * Todos los índices (nodeId→slot, zone→ids, role→ids, device→ids) se
 * construyen en registerDevice() / unregisterDevice().
 * En el hot-path (frame loop a 44 Hz) los lookups son O(1) Map.get()
 * — cero iteraciones, cero filtros, cero arrays temporales.
 *
 * INMUTABILIDAD DURANTE FRAME:
 * La estructura del grafo (qué nodos existen, dónde están) NUNCA
 * cambia mientras corre el frame loop. Solo `node.state` (Float64Array)
 * y los campos mutable definidos en las interfaces por familia
 * (currentColor, currentPosition, envelopeState, etc.) se mutan.
 *
 * @module core/aether/NodeGraph
 * @version WAVE 3505.2
 */

import { NodeFamily } from './types'
import type {
  NodeId,
  DeviceId,
  ZoneId,
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
import type {
  INodeGraph,
  INodeView,
  INodeSlotLocation,
  INodeGraphSnapshot,
  NodeFamilyDataMap,
} from './node-graph'

// ═══════════════════════════════════════════════════════════════════════════
// DENSE FAMILY STORAGE — Array plano por familia
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Contenedor de dense array para una familia de nodos.
 *
 * DECISIÓN DE RENDIMIENTO: Array<T> en lugar de TypedArray.
 * Los nodos son objetos JS estructurales (no primitivos), por lo que
 * un TypedArray no aplica aquí. El beneficio es que V8 puede hacer
 * inline caching de accesos a propiedades si todos los objetos del
 * array tienen la misma "hidden class" (shape estable).
 *
 * Para garantizar hidden class estable: los nodos SOLO se pushean,
 * nunca se mutan en estructura, y se eliminarán reindexando con swap+pop.
 */
type FamilyStore<T extends ICapabilityNode> = T[]

// ═══════════════════════════════════════════════════════════════════════════
// NODE VIEW IMPLEMENTATION — Wrapper ligero zero-alloc
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Implementación de INodeView<T>.
 *
 * ZERO-ALLOC: No copia datos. Es un wrapper sobre un array pre-existente
 * con índices pre-construidos. El costo de crear una vista es:
 * - 1 objeto JS (la vista en sí, ~40 bytes)
 * - 0 copia de datos
 * - 0 allocations de arrays
 *
 * DECISIÓN: Creamos la vista una vez al arrancar y la reutilizamos.
 * Si el grafo cambia (patch), se recrea la vista de la familia afectada.
 * Un frame que llama getView() recibe la misma instancia pre-creada.
 */
class NodeView<T extends ICapabilityNode> implements INodeView<T> {
  constructor(
    // Referencia directa al dense array subyacente — no copia
    private readonly _store: FamilyStore<T>,
    // Índice zone→T[], pre-construido en patch time
    private readonly _byZone: Map<ZoneId, T[]>,
    // Índice role→T[], pre-construido en patch time
    private readonly _byRole: Map<NodeRole, T[]>,
    // Arrays vacíos inmutables para retornar cuando no hay resultados
    private readonly _empty: readonly T[] = [],
  ) {}

  get count(): number {
    // Lectura directa de propiedad del array — O(1) en V8
    return this._store.length
  }

  /** Iteración directa sobre el dense array — sin slice, sin spread */
  forEach(fn: (node: T, index: number) => void): void {
    // DECISIÓN: for clásico en lugar de .forEach() para evitar el overhead
    // de crear un nuevo activation record por callback en V8.
    // El JIT puede vectorizar este loop cuando los nodos tienen
    // hidden class estable (misma forma de objeto).
    const store = this._store
    const len = store.length
    for (let i = 0; i < len; i++) {
      fn(store[i], i)
    }
  }

  /** Acceso directo por índice — O(1), equivalente a array[i] */
  get(index: number): T {
    if (index < 0 || index >= this._store.length) {
      throw new RangeError(
        `[NodeView] Index ${index} out of range [0, ${this._store.length})`,
      )
    }
    return this._store[index]
  }

  /**
   * Lookup por zona — O(1) Map.get().
   *
   * DECISIÓN: Retornamos el array interno del índice directamente,
   * sin copiarlo ni envolverlo. El caller no debe mutar este array.
   * Para garantizar readonly semántico usamos `readonly T[]` en la
   * firma de retorno — TypeScript enforcea esto en tiempo de compilación.
   */
  byZone(zoneId: ZoneId): readonly T[] {
    return this._byZone.get(zoneId) ?? this._empty
  }

  /** Lookup por role — O(1) Map.get() */
  byRole(role: NodeRole): readonly T[] {
    return this._byRole.get(role) ?? this._empty
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// NODEGRAPH IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Implementación concreta de INodeGraph.
 *
 * ESTRUCTURA INTERNA:
 *
 * 1. cinco FamilyStore<T> (dense arrays por familia)
 *    COLOR, IMPACT, KINETIC, BEAM, ATMOSPHERE
 *    → Iteración O(N) cache-friendly
 *
 * 2. _slotIndex: Map<NodeId, INodeSlotLocation>
 *    → Acceso O(1) por NodeId: busca familia + índice en una sola operación
 *    → Permite unregisterDevice sin buscar linealmente
 *
 * 3. _zoneIndex: Map<ZoneId, NodeId[]>
 *    → Acceso O(1) por zona geográfica
 *
 * 4. _roleIndex: Map<NodeRole, NodeId[]>
 *    → Acceso O(1) por rol semántico
 *
 * 5. _deviceIndex: Map<DeviceId, NodeId[]>
 *    → Acceso O(1) por Device (para unregister eficiente)
 *
 * 6. cinco NodeView<T> (vistas pre-creadas, una por familia)
 *    → getView() retorna la instancia pre-existente — O(1), sin new
 *
 * PATCH TIME vs FRAME TIME:
 * - registerDevice() y unregisterDevice() son PATCH TIME: pueden
 *   hacer allocaciones, crear índices, reordenar arrays.
 *   Estimación: ~2-5ms por Device. Ocurre una vez al inicio del show.
 *
 * - getView(), getNodesByZone(), etc. son FRAME TIME (44 Hz):
 *   Solo leen datos pre-construidos. 0 allocaciones.
 */
export class NodeGraph implements INodeGraph {
  // ── Dense arrays por familia ───────────────────────────────────────────

  /** Dense array de nodos COLOR */
  private readonly _color: FamilyStore<IColorNodeData> = []
  /** Dense array de nodos IMPACT */
  private readonly _impact: FamilyStore<IImpactNodeData> = []
  /** Dense array de nodos KINETIC */
  private readonly _kinetic: FamilyStore<IKineticNodeData> = []
  /** Dense array de nodos BEAM */
  private readonly _beam: FamilyStore<IBeamNodeData> = []
  /** Dense array de nodos ATMOSPHERE */
  private readonly _atmosphere: FamilyStore<IAtmosphereNodeData> = []

  // ── Índices multi-criterio ─────────────────────────────────────────────

  /**
   * NodeId → {family, index} en el dense array correspondiente.
   *
   * DECISIÓN: Almacenar el índice numérico permite eliminar un nodo
   * en O(1) con la técnica swap-and-pop: `store[idx] = store[last]; store.pop()`.
   * Actualizar el índice del nodo movido es también O(1).
   */
  private readonly _slotIndex = new Map<NodeId, INodeSlotLocation>()

  /**
   * ZoneId → NodeId[].
   *
   * En patch time, este índice se construye iterativamente.
   * En frame time, solo se lee: `this._zoneIndex.get(zoneId)`.
   */
  private readonly _zoneIndex = new Map<ZoneId, NodeId[]>()

  /**
   * NodeRole → NodeId[].
   *
   * Usado por los Systems para iterar solo los nodos de un rol.
   * Ejemplo: ImpactSystem itera solo los percussion nodes.
   */
  private readonly _roleIndex = new Map<NodeRole, NodeId[]>()

  /**
   * DeviceId → NodeId[].
   *
   * Usado en unregisterDevice() para encontrar los nodos a eliminar
   * sin iterar todos los dense arrays.
   */
  private readonly _deviceIndex = new Map<DeviceId, NodeId[]>()

  // ── Vistas pre-creadas por familia ────────────────────────────────────

  /**
   * Las vistas se crean en _rebuildViews() y se reutilizan en el hot path.
   *
   * DECISIÓN: Las vistas son reemplazables (! assertion) porque se reconstruyen
   * en patch time. Durante el frame loop la referencia es estable.
   * Los Systems obtienen la vista una vez y la conservan hasta el siguiente patch.
   */
  private _colorView!: NodeView<IColorNodeData>
  private _impactView!: NodeView<IImpactNodeData>
  private _kineticView!: NodeView<IKineticNodeData>
  private _beamView!: NodeView<IBeamNodeData>
  private _atmosphereView!: NodeView<IAtmosphereNodeData>

  // ── índices de zona/rol por familia (para las vistas) ─────────────────

  /**
   * Mapas de zona e índice tipados por familia para las vistas.
   * Construidos en _rebuildFamilyIndices() y pasados a NodeView.
   * Separate maps per family para que la vista de cada System
   * solo itere sobre nodos de su dominio.
   */
  private readonly _colorByZone = new Map<ZoneId, IColorNodeData[]>()
  private readonly _colorByRole = new Map<NodeRole, IColorNodeData[]>()
  private readonly _impactByZone = new Map<ZoneId, IImpactNodeData[]>()
  private readonly _impactByRole = new Map<NodeRole, IImpactNodeData[]>()
  private readonly _kineticByZone = new Map<ZoneId, IKineticNodeData[]>()
  private readonly _kineticByRole = new Map<NodeRole, IKineticNodeData[]>()
  private readonly _beamByZone = new Map<ZoneId, IBeamNodeData[]>()
  private readonly _beamByRole = new Map<NodeRole, IBeamNodeData[]>()
  private readonly _atmosphereByZone = new Map<ZoneId, IAtmosphereNodeData[]>()
  private readonly _atmosphereByRole = new Map<NodeRole, IAtmosphereNodeData[]>()

  /** Array vacío reutilizado para evitar retornar [] nuevo en cada miss */
  private static readonly _EMPTY_IDS: readonly NodeId[] = Object.freeze([])

  constructor() {
    // Construir vistas iniciales (vacías pero válidas)
    this._rebuildViews()
  }

  // ═══════════════════════════════════════════════════════════════════════
  // OPERACIONES DE PATCH — Solo fuera del frame loop
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Registra un Device y genera CapabilityNodes en los dense arrays.
   *
   * COMPLEJIDAD: O(N) donde N = número de nodos del Device.
   * Para un show típico (20-50 devices × 3-6 nodos = 60-300 nodos),
   * esto es negligible en patch time.
   *
   * PROCESO:
   * 1. Para cada nodo del device:
   *    a. Cast al tipo discriminado (por node.family)
   *    b. Push al dense array correspondiente
   *    c. Registrar en _slotIndex, _zoneIndex, _roleIndex, _deviceIndex
   * 2. Reconstruir las vistas (actualizan referencias a los arrays)
   *
   * @param definition — Definición del Device con sus nodos pre-creados
   * @returns Array de NodeIds registrados (útil para la Forja)
   */
  registerDevice(definition: IDeviceDefinition): readonly NodeId[] {
    const registeredIds: NodeId[] = []

    for (const node of definition.nodes) {
      this._insertNode(node as AnyNodeData)
      registeredIds.push(node.nodeId)
    }

    // Esta es la ÚNICA vez que creamos arrays en este path:
    // los índices de zona y rol. Una vez construidos,
    // los reutilizamos cada frame sin realocación.
    this._rebuildViews()

    return registeredIds
  }

  /**
   * Desregistra un Device y elimina todos sus nodos.
   *
   * TÉCNICA SWAP-AND-POP:
   * Para mantener los dense arrays compactos sin huecos,
   * cuando eliminamos un nodo en posición `i`:
   * 1. Copiamos el último nodo del array en la posición `i`
   * 2. `store.pop()` elimina el duplicado al final
   * 3. Actualizamos el _slotIndex del nodo movido al nuevo índice `i`
   *
   * Coste: O(K) donde K = nodos del Device (generalmente 1-8).
   * El array se mantiene siempre compacto y contiguous.
   *
   * @param deviceId — ID del Device a eliminar
   */
  unregisterDevice(deviceId: DeviceId): void {
    const nodeIds = this._deviceIndex.get(deviceId)
    if (!nodeIds) return

    for (const nodeId of nodeIds) {
      this._removeNode(nodeId)
    }

    this._deviceIndex.delete(deviceId)
    this._rebuildViews()
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VISTAS TIPADAS — HOT PATH (44 Hz)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Retorna la vista tipada pre-creada para la familia solicitada.
   *
   * COMPLEJIDAD: O(1) — table switch + retorno de referencia pre-existente.
   * ALLOCACIONES: 0.
   *
   * TypeScript resolverá el tipo de retorno a INodeView<T> correcto
   * en tiempo de compilación gracias a NodeFamilyDataMap.
   */
  getView<F extends NodeFamily>(family: F): INodeView<NodeFamilyDataMap[F]> {
    // Table switch en lugar de if-else chain.
    // V8 puede optimizar esto como una jump table.
    switch (family) {
      case NodeFamily.COLOR:      return this._colorView as unknown as INodeView<NodeFamilyDataMap[F]>
      case NodeFamily.IMPACT:     return this._impactView as unknown as INodeView<NodeFamilyDataMap[F]>
      case NodeFamily.KINETIC:    return this._kineticView as unknown as INodeView<NodeFamilyDataMap[F]>
      case NodeFamily.BEAM:       return this._beamView as unknown as INodeView<NodeFamilyDataMap[F]>
      case NodeFamily.ATMOSPHERE: return this._atmosphereView as unknown as INodeView<NodeFamilyDataMap[F]>
      default:
        throw new Error(`[NodeGraph] Unknown family: ${family}`)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LOOKUPS POR ÍNDICE — HOT PATH (44 Hz)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Todos los lookups son O(1) Map.get() + retorno de referencia.
   * ALLOCACIONES: 0 (retorna el array interno, no una copia).
   *
   * CONTRATO CON EL CALLER: read-only. No mutar el array retornado.
   */

  getNodesByZone(zoneId: ZoneId): readonly NodeId[] {
    return this._zoneIndex.get(zoneId) ?? NodeGraph._EMPTY_IDS
  }

  getNodesByRole(role: NodeRole): readonly NodeId[] {
    return this._roleIndex.get(role) ?? NodeGraph._EMPTY_IDS
  }

  getDeviceNodes(deviceId: DeviceId): readonly NodeId[] {
    return this._deviceIndex.get(deviceId) ?? NodeGraph._EMPTY_IDS
  }

  /**
   * Acceso directo a un nodo por NodeId — O(1).
   *
   * DECISIÓN: Retorna el nodo directamente desde el dense array
   * usando el slot cacheado. No crea wrappers ni copias.
   */
  getNodeData(nodeId: NodeId): AnyNodeData | undefined {
    const slot = this._slotIndex.get(nodeId)
    if (!slot) return undefined
    return this._getStoreForFamily(slot.family)[slot.index] as AnyNodeData
  }

  hasNode(nodeId: NodeId): boolean {
    return this._slotIndex.has(nodeId)
  }

  getDeviceIds(): readonly DeviceId[] {
    // En patch time, podemos devolver un array construido.
    // No se llama en el frame loop — es para diagnósticos.
    return Array.from(this._deviceIndex.keys())
  }

  get totalNodes(): number {
    return this._color.length
      + this._impact.length
      + this._kinetic.length
      + this._beam.length
      + this._atmosphere.length
  }

  get totalDevices(): number {
    return this._deviceIndex.size
  }

  /**
   * Genera un snapshot inmutable del estado del grafo.
   *
   * NO usar en el hot path — genera allocaciones.
   * Úsalo bajo demanda para telemetría y tests.
   */
  snapshot(): INodeGraphSnapshot {
    const roleDistribution: Record<string, number> = {}
    const allStores: ICapabilityNode[][] = [
      this._color, this._impact, this._kinetic, this._beam, this._atmosphere,
    ]
    for (const store of allStores) {
      for (const node of store) {
        roleDistribution[node.role] = (roleDistribution[node.role] ?? 0) + 1
      }
    }

    return Object.freeze({
      timestamp: performance.now(),
      counts: Object.freeze({
        [NodeFamily.COLOR]:      this._color.length,
        [NodeFamily.IMPACT]:     this._impact.length,
        [NodeFamily.KINETIC]:    this._kinetic.length,
        [NodeFamily.BEAM]:       this._beam.length,
        [NodeFamily.ATMOSPHERE]: this._atmosphere.length,
      }),
      totalNodes:    this.totalNodes,
      totalDevices:  this._deviceIndex.size,
      deviceIds:     Object.freeze(Array.from(this._deviceIndex.keys())),
      activeZones:   Object.freeze(Array.from(this._zoneIndex.keys())),
      roleDistribution: Object.freeze(roleDistribution),
    })
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVADO: Inserción + eliminación en dense arrays
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Inserta un nodo en el dense array de su familia y actualiza índices.
   */
  private _insertNode(node: AnyNodeData): void {
    const store = this._getStoreForFamily(node.family) as AnyNodeData[]
    const index = store.length        // Próxima posición libre

    // Push al dense array — O(1) amortizado
    store.push(node)

    // Registrar slot — O(1)
    this._slotIndex.set(node.nodeId, { family: node.family, index })

    // Actualizar índice de zona — O(1) amortizado
    this._addToMultiIndex(this._zoneIndex, node.zoneId, node.nodeId)

    // Actualizar índice de rol — O(1) amortizado
    this._addToMultiIndex(this._roleIndex, node.role, node.nodeId)

    // Actualizar índice de device — O(1) amortizado
    this._addToMultiIndex(this._deviceIndex, node.deviceId, node.nodeId)
  }

  /**
   * Elimina un nodo del grafo usando swap-and-pop.
   *
   * Técnica: evita desplazamiento O(N) del array.
   * Costo real: O(1) para el array + O(k) para limpiar índices.
   */
  private _removeNode(nodeId: NodeId): void {
    const slot = this._slotIndex.get(nodeId)
    if (!slot) return

    const store = this._getStoreForFamily(slot.family) as AnyNodeData[]
    const lastIdx = store.length - 1
    const targetIdx = slot.index

    // El nodo a eliminar
    const node = store[targetIdx]

    if (targetIdx < lastIdx) {
      // Swap: mueve el último al hueco del eliminado
      const lastNode = store[lastIdx]
      store[targetIdx] = lastNode
      // Actualiza el slot del nodo movido
      this._slotIndex.set(lastNode.nodeId, { family: slot.family, index: targetIdx })
    }

    // Pop: elimina el duplicado (ahora en la última posición)
    store.pop()

    // Limpiar todos los índices del nodo eliminado
    this._slotIndex.delete(nodeId)
    this._removeFromMultiIndex(this._zoneIndex, node.zoneId, nodeId)
    this._removeFromMultiIndex(this._roleIndex, node.role, nodeId)
    // _deviceIndex se limpia en unregisterDevice (más eficiente: delete del array entero)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVADO: Reconstrucción de vistas y sub-índices por familia
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Reconstruye todos los índices tipados por familia y las vistas.
   *
   * Llamado solo en patch time (registerDevice / unregisterDevice).
   * Se re-indexan los dense arrays completos — O(N_total).
   * Este costo es aceptable porque ocurre fuera del frame loop.
   */
  private _rebuildViews(): void {
    this._clearFamilyIndices()
    this._indexFamilyIntoView(this._color, this._colorByZone, this._colorByRole)
    this._indexFamilyIntoView(this._impact, this._impactByZone, this._impactByRole)
    this._indexFamilyIntoView(this._kinetic, this._kineticByZone, this._kineticByRole)
    this._indexFamilyIntoView(this._beam, this._beamByZone, this._beamByRole)
    this._indexFamilyIntoView(this._atmosphere, this._atmosphereByZone, this._atmosphereByRole)

    // Crear/actualizar vistas. En frame time el caller recibe
    // la instancia pre-existente vía getView().
    this._colorView      = new NodeView(this._color,      this._colorByZone,      this._colorByRole)
    this._impactView     = new NodeView(this._impact,     this._impactByZone,     this._impactByRole)
    this._kineticView    = new NodeView(this._kinetic,    this._kineticByZone,    this._kineticByRole)
    this._beamView       = new NodeView(this._beam,       this._beamByZone,       this._beamByRole)
    this._atmosphereView = new NodeView(this._atmosphere, this._atmosphereByZone, this._atmosphereByRole)
  }

  /**
   * Indexa un dense array de una familia en sus mapas zone y role.
   * SOLO llamado en _rebuildViews() — patch time.
   */
  private _indexFamilyIntoView<T extends ICapabilityNode>(
    store: FamilyStore<T>,
    byZone: Map<ZoneId, T[]>,
    byRole: Map<NodeRole, T[]>,
  ): void {
    const len = store.length
    for (let i = 0; i < len; i++) {
      const node = store[i]
      this._addToTypedIndex(byZone, node.zoneId, node)
      this._addToTypedIndex(byRole, node.role, node)
    }
  }

  private _clearFamilyIndices(): void {
    this._colorByZone.clear();      this._colorByRole.clear()
    this._impactByZone.clear();     this._impactByRole.clear()
    this._kineticByZone.clear();    this._kineticByRole.clear()
    this._beamByZone.clear();       this._beamByRole.clear()
    this._atmosphereByZone.clear(); this._atmosphereByRole.clear()
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVADO: Helpers para multi-índices
  // ═══════════════════════════════════════════════════════════════════════

  /** Añade `value` a la lista indexada por `key`. Crea la lista si no existe. */
  private _addToMultiIndex<K, V>(map: Map<K, V[]>, key: K, value: V): void {
    let list = map.get(key)
    if (!list) {
      list = []
      map.set(key, list)
    }
    list.push(value)
  }

  /** Versión tipada de addToMultiIndex — para sub-índices de vista. */
  private _addToTypedIndex<K, V>(map: Map<K, V[]>, key: K, value: V): void {
    let list = map.get(key)
    if (!list) {
      list = []
      map.set(key, list)
    }
    list.push(value)
  }

  /**
   * Elimina `value` de la lista indexada por `key`.
   * Usa splice en O(k) donde k = entradas en la lista para esa key.
   * Aceptable en patch time; nunca se llama en el hot path.
   */
  private _removeFromMultiIndex<K, V>(map: Map<K, V[]>, key: K, value: V): void {
    const list = map.get(key)
    if (!list) return
    const idx = list.indexOf(value)
    if (idx !== -1) {
      // splice es O(k) pero k es el número de nodos en esa zona/rol,
      // que nunca supera los pocos cientos. Aceptable en patch time.
      list.splice(idx, 1)
    }
    if (list.length === 0) map.delete(key)
  }

  /**
   * Retorna el dense array para una familia dada.
   * Table switch — O(1), sin cast dinámico en el caller.
   */
  private _getStoreForFamily(family: NodeFamily): ICapabilityNode[] {
    switch (family) {
      case NodeFamily.COLOR:      return this._color as ICapabilityNode[]
      case NodeFamily.IMPACT:     return this._impact as ICapabilityNode[]
      case NodeFamily.KINETIC:    return this._kinetic as ICapabilityNode[]
      case NodeFamily.BEAM:       return this._beam as ICapabilityNode[]
      case NodeFamily.ATMOSPHERE: return this._atmosphere as ICapabilityNode[]
      default: throw new Error(`[NodeGraph] Unknown family: ${family}`)
    }
  }
}
