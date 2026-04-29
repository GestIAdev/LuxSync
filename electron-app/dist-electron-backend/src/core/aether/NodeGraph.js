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
import { NodeFamily } from './types';
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
class NodeView {
    constructor(
    // Referencia directa al dense array subyacente — no copia
    _store, 
    // Índice zone→T[], pre-construido en patch time
    _byZone, 
    // Índice role→T[], pre-construido en patch time
    _byRole, 
    // Arrays vacíos inmutables para retornar cuando no hay resultados
    _empty = []) {
        this._store = _store;
        this._byZone = _byZone;
        this._byRole = _byRole;
        this._empty = _empty;
    }
    get count() {
        // Lectura directa de propiedad del array — O(1) en V8
        return this._store.length;
    }
    /** Iteración directa sobre el dense array — sin slice, sin spread */
    forEach(fn) {
        // DECISIÓN: for clásico en lugar de .forEach() para evitar el overhead
        // de crear un nuevo activation record por callback en V8.
        // El JIT puede vectorizar este loop cuando los nodos tienen
        // hidden class estable (misma forma de objeto).
        const store = this._store;
        const len = store.length;
        for (let i = 0; i < len; i++) {
            fn(store[i], i);
        }
    }
    /** Acceso directo por índice — O(1), equivalente a array[i] */
    get(index) {
        if (index < 0 || index >= this._store.length) {
            throw new RangeError(`[NodeView] Index ${index} out of range [0, ${this._store.length})`);
        }
        return this._store[index];
    }
    /**
     * Lookup por zona — O(1) Map.get().
     *
     * DECISIÓN: Retornamos el array interno del índice directamente,
     * sin copiarlo ni envolverlo. El caller no debe mutar este array.
     * Para garantizar readonly semántico usamos `readonly T[]` en la
     * firma de retorno — TypeScript enforcea esto en tiempo de compilación.
     */
    byZone(zoneId) {
        return this._byZone.get(zoneId) ?? this._empty;
    }
    /** Lookup por role — O(1) Map.get() */
    byRole(role) {
        return this._byRole.get(role) ?? this._empty;
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
export class NodeGraph {
    constructor() {
        // ── Dense arrays por familia ───────────────────────────────────────────
        /** Dense array de nodos COLOR */
        this._color = [];
        /** Dense array de nodos IMPACT */
        this._impact = [];
        /** Dense array de nodos KINETIC */
        this._kinetic = [];
        /** Dense array de nodos BEAM */
        this._beam = [];
        /** Dense array de nodos ATMOSPHERE */
        this._atmosphere = [];
        // ── Índices multi-criterio ─────────────────────────────────────────────
        /**
         * NodeId → {family, index} en el dense array correspondiente.
         *
         * DECISIÓN: Almacenar el índice numérico permite eliminar un nodo
         * en O(1) con la técnica swap-and-pop: `store[idx] = store[last]; store.pop()`.
         * Actualizar el índice del nodo movido es también O(1).
         */
        this._slotIndex = new Map();
        /**
         * ZoneId → NodeId[].
         *
         * En patch time, este índice se construye iterativamente.
         * En frame time, solo se lee: `this._zoneIndex.get(zoneId)`.
         */
        this._zoneIndex = new Map();
        /**
         * NodeRole → NodeId[].
         *
         * Usado por los Systems para iterar solo los nodos de un rol.
         * Ejemplo: ImpactSystem itera solo los percussion nodes.
         */
        this._roleIndex = new Map();
        /**
         * DeviceId → NodeId[].
         *
         * Usado en unregisterDevice() para encontrar los nodos a eliminar
         * sin iterar todos los dense arrays.
         */
        this._deviceIndex = new Map();
        /**
         * DeviceId → IDeviceDefinition.
         *
         * Usado por el NodeResolver en el hot path para obtener
         * dmxAddress y universe sin reconstruir el contexto desde los nodos.
         * Se popula en registerDevice() y se limpia en unregisterDevice().
         */
        this._deviceDefs = new Map();
        // ── índices de zona/rol por familia (para las vistas) ─────────────────
        /**
         * Mapas de zona e índice tipados por familia para las vistas.
         * Construidos en _rebuildFamilyIndices() y pasados a NodeView.
         * Separate maps per family para que la vista de cada System
         * solo itere sobre nodos de su dominio.
         */
        this._colorByZone = new Map();
        this._colorByRole = new Map();
        this._impactByZone = new Map();
        this._impactByRole = new Map();
        this._kineticByZone = new Map();
        this._kineticByRole = new Map();
        this._beamByZone = new Map();
        this._beamByRole = new Map();
        this._atmosphereByZone = new Map();
        this._atmosphereByRole = new Map();
        // Construir vistas iniciales (vacías pero válidas)
        this._rebuildViews();
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
    registerDevice(definition) {
        const registeredIds = [];
        for (const node of definition.nodes) {
            this._insertNode(node);
            registeredIds.push(node.nodeId);
        }
        // Almacenar la definición para acceso O(1) por el NodeResolver
        this._deviceDefs.set(definition.deviceId, definition);
        // Esta es la ÚNICA vez que creamos arrays en este path:
        // los índices de zona y rol. Una vez construidos,
        // los reutilizamos cada frame sin realocación.
        this._rebuildViews();
        return registeredIds;
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
    unregisterDevice(deviceId) {
        const nodeIds = this._deviceIndex.get(deviceId);
        if (!nodeIds)
            return;
        for (const nodeId of nodeIds) {
            this._removeNode(nodeId);
        }
        this._deviceIndex.delete(deviceId);
        this._deviceDefs.delete(deviceId);
        this._rebuildViews();
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
    getView(family) {
        // Table switch en lugar de if-else chain.
        // V8 puede optimizar esto como una jump table.
        switch (family) {
            case NodeFamily.COLOR: return this._colorView;
            case NodeFamily.IMPACT: return this._impactView;
            case NodeFamily.KINETIC: return this._kineticView;
            case NodeFamily.BEAM: return this._beamView;
            case NodeFamily.ATMOSPHERE: return this._atmosphereView;
            default:
                throw new Error(`[NodeGraph] Unknown family: ${family}`);
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
    getNodesByZone(zoneId) {
        return this._zoneIndex.get(zoneId) ?? NodeGraph._EMPTY_IDS;
    }
    getNodesByRole(role) {
        return this._roleIndex.get(role) ?? NodeGraph._EMPTY_IDS;
    }
    getDeviceNodes(deviceId) {
        return this._deviceIndex.get(deviceId) ?? NodeGraph._EMPTY_IDS;
    }
    getDevice(deviceId) {
        return this._deviceDefs.get(deviceId);
    }
    /**
     * Acceso directo a un nodo por NodeId — O(1).
     *
     * DECISIÓN: Retorna el nodo directamente desde el dense array
     * usando el slot cacheado. No crea wrappers ni copias.
     */
    getNodeData(nodeId) {
        const slot = this._slotIndex.get(nodeId);
        if (!slot)
            return undefined;
        return this._getStoreForFamily(slot.family)[slot.index];
    }
    hasNode(nodeId) {
        return this._slotIndex.has(nodeId);
    }
    getDeviceIds() {
        // En patch time, podemos devolver un array construido.
        // No se llama en el frame loop — es para diagnósticos.
        return Array.from(this._deviceIndex.keys());
    }
    get totalNodes() {
        return this._color.length
            + this._impact.length
            + this._kinetic.length
            + this._beam.length
            + this._atmosphere.length;
    }
    get totalDevices() {
        return this._deviceIndex.size;
    }
    /**
     * Genera un snapshot inmutable del estado del grafo.
     *
     * NO usar en el hot path — genera allocaciones.
     * Úsalo bajo demanda para telemetría y tests.
     */
    snapshot() {
        const roleDistribution = {};
        const allStores = [
            this._color, this._impact, this._kinetic, this._beam, this._atmosphere,
        ];
        for (const store of allStores) {
            for (const node of store) {
                roleDistribution[node.role] = (roleDistribution[node.role] ?? 0) + 1;
            }
        }
        return Object.freeze({
            timestamp: performance.now(),
            counts: Object.freeze({
                [NodeFamily.COLOR]: this._color.length,
                [NodeFamily.IMPACT]: this._impact.length,
                [NodeFamily.KINETIC]: this._kinetic.length,
                [NodeFamily.BEAM]: this._beam.length,
                [NodeFamily.ATMOSPHERE]: this._atmosphere.length,
            }),
            totalNodes: this.totalNodes,
            totalDevices: this._deviceIndex.size,
            deviceIds: Object.freeze(Array.from(this._deviceIndex.keys())),
            activeZones: Object.freeze(Array.from(this._zoneIndex.keys())),
            roleDistribution: Object.freeze(roleDistribution),
        });
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PRIVADO: Inserción + eliminación en dense arrays
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Inserta un nodo en el dense array de su familia y actualiza índices.
     */
    _insertNode(node) {
        const store = this._getStoreForFamily(node.family);
        const index = store.length; // Próxima posición libre
        // Push al dense array — O(1) amortizado
        store.push(node);
        // Registrar slot — O(1)
        this._slotIndex.set(node.nodeId, { family: node.family, index });
        // Actualizar índice de zona — O(1) amortizado
        this._addToMultiIndex(this._zoneIndex, node.zoneId, node.nodeId);
        // Actualizar índice de rol — O(1) amortizado
        this._addToMultiIndex(this._roleIndex, node.role, node.nodeId);
        // Actualizar índice de device — O(1) amortizado
        this._addToMultiIndex(this._deviceIndex, node.deviceId, node.nodeId);
    }
    /**
     * Elimina un nodo del grafo usando swap-and-pop.
     *
     * Técnica: evita desplazamiento O(N) del array.
     * Costo real: O(1) para el array + O(k) para limpiar índices.
     */
    _removeNode(nodeId) {
        const slot = this._slotIndex.get(nodeId);
        if (!slot)
            return;
        const store = this._getStoreForFamily(slot.family);
        const lastIdx = store.length - 1;
        const targetIdx = slot.index;
        // El nodo a eliminar
        const node = store[targetIdx];
        if (targetIdx < lastIdx) {
            // Swap: mueve el último al hueco del eliminado
            const lastNode = store[lastIdx];
            store[targetIdx] = lastNode;
            // Actualiza el slot del nodo movido
            this._slotIndex.set(lastNode.nodeId, { family: slot.family, index: targetIdx });
        }
        // Pop: elimina el duplicado (ahora en la última posición)
        store.pop();
        // Limpiar todos los índices del nodo eliminado
        this._slotIndex.delete(nodeId);
        this._removeFromMultiIndex(this._zoneIndex, node.zoneId, nodeId);
        this._removeFromMultiIndex(this._roleIndex, node.role, nodeId);
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
    _rebuildViews() {
        this._clearFamilyIndices();
        this._indexFamilyIntoView(this._color, this._colorByZone, this._colorByRole);
        this._indexFamilyIntoView(this._impact, this._impactByZone, this._impactByRole);
        this._indexFamilyIntoView(this._kinetic, this._kineticByZone, this._kineticByRole);
        this._indexFamilyIntoView(this._beam, this._beamByZone, this._beamByRole);
        this._indexFamilyIntoView(this._atmosphere, this._atmosphereByZone, this._atmosphereByRole);
        // Crear/actualizar vistas. En frame time el caller recibe
        // la instancia pre-existente vía getView().
        this._colorView = new NodeView(this._color, this._colorByZone, this._colorByRole);
        this._impactView = new NodeView(this._impact, this._impactByZone, this._impactByRole);
        this._kineticView = new NodeView(this._kinetic, this._kineticByZone, this._kineticByRole);
        this._beamView = new NodeView(this._beam, this._beamByZone, this._beamByRole);
        this._atmosphereView = new NodeView(this._atmosphere, this._atmosphereByZone, this._atmosphereByRole);
    }
    /**
     * Indexa un dense array de una familia en sus mapas zone y role.
     * SOLO llamado en _rebuildViews() — patch time.
     */
    _indexFamilyIntoView(store, byZone, byRole) {
        const len = store.length;
        for (let i = 0; i < len; i++) {
            const node = store[i];
            this._addToTypedIndex(byZone, node.zoneId, node);
            this._addToTypedIndex(byRole, node.role, node);
        }
    }
    _clearFamilyIndices() {
        this._colorByZone.clear();
        this._colorByRole.clear();
        this._impactByZone.clear();
        this._impactByRole.clear();
        this._kineticByZone.clear();
        this._kineticByRole.clear();
        this._beamByZone.clear();
        this._beamByRole.clear();
        this._atmosphereByZone.clear();
        this._atmosphereByRole.clear();
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PRIVADO: Helpers para multi-índices
    // ═══════════════════════════════════════════════════════════════════════
    /** Añade `value` a la lista indexada por `key`. Crea la lista si no existe. */
    _addToMultiIndex(map, key, value) {
        let list = map.get(key);
        if (!list) {
            list = [];
            map.set(key, list);
        }
        list.push(value);
    }
    /** Versión tipada de addToMultiIndex — para sub-índices de vista. */
    _addToTypedIndex(map, key, value) {
        let list = map.get(key);
        if (!list) {
            list = [];
            map.set(key, list);
        }
        list.push(value);
    }
    /**
     * Elimina `value` de la lista indexada por `key`.
     * Usa splice en O(k) donde k = entradas en la lista para esa key.
     * Aceptable en patch time; nunca se llama en el hot path.
     */
    _removeFromMultiIndex(map, key, value) {
        const list = map.get(key);
        if (!list)
            return;
        const idx = list.indexOf(value);
        if (idx !== -1) {
            // splice es O(k) pero k es el número de nodos en esa zona/rol,
            // que nunca supera los pocos cientos. Aceptable en patch time.
            list.splice(idx, 1);
        }
        if (list.length === 0)
            map.delete(key);
    }
    /**
     * Retorna el dense array para una familia dada.
     * Table switch — O(1), sin cast dinámico en el caller.
     */
    _getStoreForFamily(family) {
        switch (family) {
            case NodeFamily.COLOR: return this._color;
            case NodeFamily.IMPACT: return this._impact;
            case NodeFamily.KINETIC: return this._kinetic;
            case NodeFamily.BEAM: return this._beam;
            case NodeFamily.ATMOSPHERE: return this._atmosphere;
            default: throw new Error(`[NodeGraph] Unknown family: ${family}`);
        }
    }
}
/** Array vacío reutilizado para evitar retornar [] nuevo en cada miss */
NodeGraph._EMPTY_IDS = Object.freeze([]);
