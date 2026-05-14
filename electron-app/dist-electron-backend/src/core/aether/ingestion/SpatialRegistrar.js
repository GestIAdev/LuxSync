/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌍 AETHER MATRIX — SPATIAL REGISTRAR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3517.2: THE SPATIAL REGISTRAR (Live Stage Sync)
 *
 * Cruza los ICapabilityNodes extraídos por el NodeExtractionPipeline
 * con la posición 3D real del fixture en el Stagebuilder, asigna
 * Position3D a cada nodo y registra el IDeviceDefinition enriquecido
 * en el TitanOrchestrator.
 *
 * ARQUITECTURA DE POSICIONAMIENTO:
 *   - Fixture single-emitter: el nodo hereda directamente la posición
 *     del fixture (x, y, z en metros reales del escenario).
 *   - Fixture multi-emitter (fan RGBW con N pétalos):
 *     * El nodo COLOR/IMPACT de cada pétalo recibe un offset radial
 *       respecto al centro del aparato.
 *     * Radio default: 0.15m (15cm), configurable vía options.
 *     * Distribución uniforme en 360° a partir del ángulo base.
 *   - Nodo KINETIC: hereda la posición central (el motor está en el eje).
 *   - Nodo BEAM/ATMOSPHERE: hereda la posición central.
 *
 * CICLO DE VIDA:
 *   1. UI añade fixture al Stage (StageConstructor / StageGrid3D).
 *   2. Se llama SpatialRegistrar.register() con FixtureV2 + IDeviceDefinition.
 *   3. SpatialRegistrar enriquece nodes[] con Position3D.
 *   4. SpatialRegistrar llama orchestrator.registerAetherDevice(enrichedDef).
 *   5. TitanOrchestrator → NodeGraph.registerDevice() → nodos en Aether.
 *
 * INVARIANTES (WAVE 3517.2):
 * - No muta la IDeviceDefinition de entrada.
 * - Solo ejecuta en patch time / user-interaction time — NUNCA a 44Hz.
 * - La posición se expresa en metros (coordenadas del escenario).
 *   x: izquierda(-)/derecha(+), y: altura, z: profundidad escenario.
 * - ISpatialRegistrar (blueprint 3506 §1.7) está implementada formalmente.
 * - rebuildNeighborGraph() es O(N²) pero solo se llama en patch time.
 *   Pre-aloca el Map de vecinos una vez y lo reutiliza.
 *
 * @module core/aether/ingestion/SpatialRegistrar
 * @version WAVE 3517.2
 */
import { NodeFamily } from '../types';
const DEFAULT_PETAL_RADIUS_M = 0.15;
const DEFAULT_PETAL_BASE_DEG = 90;
/** Máximo de vecinos por nodo cuando el caller no lo especifica */
const DEFAULT_MAX_NEIGHBORS = 4;
/** Array vacío compartido para retornar en getNeighbors() cuando no hay vecinos */
const EMPTY_NEIGHBOR_IDS = Object.freeze([]);
// ═══════════════════════════════════════════════════════════════════════════
// SPATIAL REGISTRAR
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Enriquece un IDeviceDefinition con posiciones 3D reales y lo registra
 * en el motor Aether a través del IAetherRegistrationTarget.
 *
 * Implementa ISpatialRegistrar (Blueprint 3506 §1.7).
 *
 * Solo instanciar una vez por sesión de show — el estado mutable
 * (_neighborGraph) se reconstruye explícitamente en patch time.
 */
export class SpatialRegistrar {
    constructor(options = {}) {
        /**
         * Tabla de vecindad pre-calculada: NodeId → NodeId[] (vecinos más cercanos).
         * Se construye/reemplaza en rebuildNeighborGraph() y se lee en getNeighbors().
         * Map es el tipo correcto aquí: O(1) get, tamaño dinámico (N varía por show).
         */
        this._neighborGraph = new Map();
        // ── WAVE 4735.2: Batch API — supresión de eventos durante operaciones bulk ──
        this._topologyChangedCallback = null;
        this._isBatching = false;
        this._pendingTopologyChange = false;
        this._petalRadiusM = options.petalRadiusM ?? DEFAULT_PETAL_RADIUS_M;
        this._petalBaseAngleDeg = options.petalBaseAngleDeg ?? DEFAULT_PETAL_BASE_DEG;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Asigna posiciones 3D a los nodos del Device y lo registra en Aether.
     *
     * @param deviceDef       — IDeviceDefinition producida por NodeExtractionPipeline.
     *                          No se muta.
     * @param stagePosition   — Posición 3D real del fixture en el Stagebuilder (metros).
     * @param target          — Orquestador donde se registra el Device final.
     */
    register(deviceDef, stagePosition, target, isPlaced) {
        // 🚨 WAVE 4573 Phase 5a: GUERRILLA BYPASS
        // Fixtures added via Quick-Add have isPlaced=false — no real 3D position.
        // Spatial enrichment would inject invalid coordinates into the IK engine.
        // Register the raw device definition for Classic Pan/Tilt mode instead.
        if (isPlaced === false) {
            target.registerAetherDevice(deviceDef);
            this._notifyTopologyChange();
            return;
        }
        const enriched = this._enrichWithSpatialData(deviceDef, stagePosition);
        target.registerAetherDevice(enriched);
        this._notifyTopologyChange();
    }
    /**
     * Desregistra un Device del motor Aether.
     * Wrapper semántico para mantener la simetría con register().
     */
    unregister(deviceId, target) {
        target.unregisterAetherDevice(deviceId);
    }
    // ─────────────────────────────────────────────────────────────────────────
    // ISpatialRegistrar — CONTRATO FORMAL (Blueprint 3506 §1.7)
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Actualiza la posición de todos los nodos de un Device en el NodeGraph.
     *
     * El NodeGraph no expone mutación directa de nodos (ICapabilityNode.position
     * es readonly). La única vía correcta es ejecutar el ciclo patch-time:
     *   1. Recuperar la IDeviceDefinition actual del grafo.
     *   2. Re-enriquecer con la nueva posición (produce nuevo IDeviceDefinition).
     *   3. Hacer unregister del device antiguo del grafo.
     *   4. Registrar el device re-enriquecido.
     *
     * Este ciclo es O(K) donde K = nodos del device. Es patch-time safe.
     * NUNCA llamar dentro del frame loop de 44Hz.
     *
     * @param deviceId — ID del Device a actualizar
     * @param position — Nueva posición en metros (coordenadas escénicas)
     * @param nodeGraph — NodeGraph donde vive el Device
     * @param target    — Target de registro (TitanOrchestrator)
     */
    updateDevicePosition(deviceId, position, nodeGraph, target) {
        const currentDef = nodeGraph.getDevice(deviceId);
        if (!currentDef)
            return; // Device no registrado — no-op
        const enriched = this._enrichWithSpatialData(currentDef, position);
        // Ciclo atómico: out → re-enrich → in
        nodeGraph.unregisterDevice(deviceId);
        nodeGraph.registerDevice(enriched);
        // Notificar al target para mantener su bookkeeping interno sincronizado
        target.registerAetherDevice(enriched);
        this._notifyTopologyChange();
    }
    /**
     * Recalcula la tabla de vecinos para Selene IA.
     *
     * Algoritmo:
     *   Por cada familia, itera todos sus nodos (posición conocida).
     *   Para cada nodo A, calcula la distancia euclidiana 3D con todos
     *   los demás nodos B de la misma familia. Conserva los N más cercanos.
     *
     *   Complejidad: O(F × N²) donde F=5 familias, N=nodos por familia.
     *   Para shows típicos (20-50 fixtures × ~2 nodos por familia = ~100 por familia),
     *   son ~10,000 comparaciones — trivial en patch time (<1ms).
     *
     *   Solo procesa nodos que tienen position definida. Nodos sin posición
     *   (ej. virtuales) se omiten del grafo de vecindad.
     *
     * Pre-aloca: limpia y rellena _neighborGraph in-place para evitar allocar
     * un nuevo Map en cada recálculo (evita presión en el GC).
     *
     * @param nodeGraph    — NodeGraph con todos los nodos registrados
     * @param maxNeighbors — Vecinos máximos por nodo (default: 4)
     */
    rebuildNeighborGraph(nodeGraph, maxNeighbors = DEFAULT_MAX_NEIGHBORS) {
        // Limpiar la tabla sin reasignar el Map (evita GC)
        this._neighborGraph.clear();
        const families = [
            NodeFamily.COLOR,
            NodeFamily.IMPACT,
            NodeFamily.KINETIC,
            NodeFamily.BEAM,
            NodeFamily.ATMOSPHERE,
        ];
        for (const family of families) {
            const view = nodeGraph.getView(family);
            if (view.count < 2)
                continue;
            // Snapshot local de los nodos de esta familia (solo los que tienen position)
            const nodesWithPos = [];
            view.forEach(node => {
                if (node.position !== undefined) {
                    nodesWithPos.push({ id: node.nodeId, pos: node.position });
                }
            });
            if (nodesWithPos.length < 2)
                continue;
            // O(N²): para cada nodo, calcular distancias con todos los demás
            for (let i = 0; i < nodesWithPos.length; i++) {
                const a = nodesWithPos[i];
                // Calcular distancias y ordenar ascendentemente
                const distances = [];
                for (let j = 0; j < nodesWithPos.length; j++) {
                    if (i === j)
                        continue;
                    const b = nodesWithPos[j];
                    const dx = a.pos.x - b.pos.x;
                    const dy = a.pos.y - b.pos.y;
                    const dz = a.pos.z - b.pos.z;
                    // dist² es suficiente para comparación (evita √ innecesaria)
                    distances.push({ id: b.id, dist2: dx * dx + dy * dy + dz * dz });
                }
                // Sort in-place: los N más cercanos quedan al frente
                distances.sort((x, y) => x.dist2 - y.dist2);
                const neighbors = distances
                    .slice(0, maxNeighbors)
                    .map(d => d.id);
                this._neighborGraph.set(a.id, Object.freeze(neighbors));
            }
        }
    }
    /**
     * Asigna NodeRoles heurísticos basados en zona semántica + altura Y.
     *
     * Como ICapabilityNode.role es readonly, aplica el mismo ciclo
     * patch-time de updateDevicePosition: recupera el device, reconstruye
     * sus nodos con roles actualizados, y re-registra.
     *
     * Heurísticas implementadas:
     *   - IMPACT/COLOR en zona 'air' o y > 2.5m → role 'accent'
     *   - IMPACT/COLOR en zona 'floor' o y < 0.5m → role 'ambient'
     *   - IMPACT/COLOR en zona 'front' o 'center' y 0.5 ≤ y ≤ 2.5m → role 'primary'
     *   - KINETIC en zona 'movers-left' | 'movers-right' → role 'primary'
     *   - BEAM → role 'primary' (si zoom/focus) o 'decoration' (gobo/prism only)
     *     conservado desde la Forja — no se sobreescribe
     *   - ATMOSPHERE → role 'ambient' o 'atmosphere' conservado desde la Forja
     *
     * @param deviceId — ID del Device
     * @param zone     — Zona canónica del fixture
     * @param nodeGraph — NodeGraph donde vive el Device
     * @param target    — Target para la reinserción
     */
    assignHeuristicRoles(deviceId, zone, nodeGraph, target) {
        const currentDef = nodeGraph.getDevice(deviceId);
        if (!currentDef)
            return;
        const canonicalZone = zone;
        const updatedNodes = currentDef.nodes.map(node => {
            const role = this._inferHeuristicRole(node, canonicalZone);
            if (role === node.role)
                return node; // Sin cambio — no clonar
            return { ...node, role };
        });
        // Si ningún rol cambió, evitar un ciclo de re-registro innecesario
        const changed = updatedNodes.some((n, i) => n !== currentDef.nodes[i]);
        if (!changed)
            return;
        const updatedDef = {
            ...currentDef,
            nodes: Object.freeze(updatedNodes),
        };
        nodeGraph.unregisterDevice(deviceId);
        nodeGraph.registerDevice(updatedDef);
        target.registerAetherDevice(updatedDef);
        this._notifyTopologyChange();
    }
    /**
     * Retorna los vecinos pre-calculados de un nodo.
     * O(1) — solo una lectura del Map interno.
     * Si el nodo no tiene vecinos (no tiene posición, o rebuildNeighborGraph
     * no se ha llamado aún), retorna el array vacío compartido.
     */
    getNeighbors(nodeId) {
        return this._neighborGraph.get(nodeId) ?? EMPTY_NEIGHBOR_IDS;
    }
    // ── WAVE 4735.2: Batch API ─────────────────────────────────────────────
    /**
     * Registra un listener para el evento de cambio de topología (patch time).
     * El callback se dispara al final de cada operación register/update
     * o una sola vez al finalizar un batch() completo.
     */
    setTopologyChangedListener(cb) {
        this._topologyChangedCallback = cb;
    }
    /**
     * Ejecuta `fn` como una operación atómica de batch.
     * Suprime los eventos `topology_changed` individuales durante la ejecución
     * y emite un único evento consolidado al final.
     *
     * Garantiza que el evento se emite incluso si `fn` lanza una excepción.
     *
     * @example
     * registrar.batch(() => {
     *   for (const f of fixtures) registrar.register(f.def, f.pos, target)
     *   registrar.rebuildNeighborGraph(nodeGraph)
     * })
     */
    batch(fn) {
        this._isBatching = true;
        this._pendingTopologyChange = false;
        try {
            fn();
        }
        finally {
            this._isBatching = false;
            if (this._pendingTopologyChange) {
                this._pendingTopologyChange = false;
                this._topologyChangedCallback?.();
            }
        }
    }
    _notifyTopologyChange() {
        if (this._isBatching) {
            this._pendingTopologyChange = true;
        }
        else {
            this._topologyChangedCallback?.();
        }
    }
    // ─────────────────────────────────────────────────────────────────────────
    // SPATIAL ENRICHMENT
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Construye un nuevo IDeviceDefinition con todos los nodos enriquecidos
     * con su posición 3D real. No muta el original.
     */
    _enrichWithSpatialData(deviceDef, stagePosition) {
        // ─ WAVE 3506.1.1: COORDINATE ALIGNMENT ─────────────────────────────────
        // Mapeo explícito sin inversiones. ShowFileV2 usa Y-up:
        //   X: Left (-) to Right (+)
        //   Y: Down (-) to Up (+)   [0 = floor, positive = height/truss]
        //   Z: Back (-) to Front (+) [0 = center stage, positive = downstage]
        // Este mapeo se copia **directamente** sin traslaciones de significado.
        const center = {
            x: stagePosition.x, // Ancho (izquierda/derecha)
            y: stagePosition.y, // Altura (piso/techo)
            z: stagePosition.z, // Profundidad (upstage/downstage)
        };
        // Contar cuántos nodos COLOR hay para calcular offsets de pétalos
        const colorNodeCount = deviceDef.nodes.filter(n => n.family === NodeFamily.COLOR).length;
        const isMultiEmitter = colorNodeCount > 1;
        // Calcular posiciones de pétalos si hay más de un emitter COLOR
        const petalPositions = isMultiEmitter
            ? this._calculatePetalPositions(center, colorNodeCount)
            : [];
        let petalCursor = 0;
        const enrichedNodes = deviceDef.nodes.map(node => {
            if (node.family === NodeFamily.COLOR && isMultiEmitter) {
                // Cada nodo COLOR de un multi-emitter recibe su posición de pétalo
                const pos = petalPositions[petalCursor++] ?? center;
                return this._cloneNodeWithPosition(node, pos);
            }
            // KINETIC, BEAM, IMPACT, ATMOSPHERE: posición central del aparato
            return this._cloneNodeWithPosition(node, center);
        });
        return {
            ...deviceDef,
            nodes: Object.freeze(enrichedNodes),
        };
    }
    /**
     * Calcula las posiciones de los pétalos distribuidas radialmente en el
     * plano XZ (horizontal) a partir del centro del aparato.
     *
     * XZ porque los aparatos típicamente están montados en altura y sus
     * pétalos apuntan hacia el escenario en distintas direcciones horizontales.
     *
     * @param center — Centro del aparato en metros.
     * @param count  — Número de pétalos.
     */
    _calculatePetalPositions(center, count) {
        const positions = [];
        const angleStep = 360 / count;
        const baseRad = (this._petalBaseAngleDeg * Math.PI) / 180;
        for (let i = 0; i < count; i++) {
            const angleDeg = this._petalBaseAngleDeg + angleStep * i;
            const angleRad = (angleDeg * Math.PI) / 180;
            positions.push({
                x: center.x + this._petalRadiusM * Math.cos(angleRad - baseRad + Math.PI / 2),
                y: center.y,
                z: center.z + this._petalRadiusM * Math.sin(angleRad - baseRad + Math.PI / 2),
            });
        }
        return positions;
    }
    /**
     * Crea una copia inmutable del nodo con la posición 3D asignada.
     * Object spread es seguro aquí porque ICapabilityNode es readonly-by-contract.
     */
    _cloneNodeWithPosition(node, position) {
        return { ...node, position };
    }
    /**
     * Infiere el rol heurístico de un nodo basándose en zona + altura Y.
     *
     * Lógica de precedencia:
     *   1. ATMOSPHERE y BEAM conservan su rol de Forja (no se sobreescriben).
     *   2. KINETIC conserva 'primary' siempre (el motor no cambia de rol).
     *   3. IMPACT/COLOR dependen de la zona semántica + altura Y (metros).
     *
     * @param node — Nodo a evaluar
     * @param zone — Zona canónica del fixture
     * @returns El rol inferido para ese nodo
     */
    _inferHeuristicRole(node, zone) {
        // ATMOSPHERE y BEAM: la Forja define el rol definitivamente
        if (node.family === NodeFamily.ATMOSPHERE || node.family === NodeFamily.BEAM) {
            return node.role;
        }
        // KINETIC: siempre primary — el motor mecánico no cambia de semántica
        if (node.family === NodeFamily.KINETIC) {
            return 'primary';
        }
        // IMPACT + COLOR: heurística zona + altura
        const y = node.position?.y ?? 0;
        // Zona aérea explícita o altura > 2.5m → accent (foco de aire)
        if (zone === 'air' || y > 2.5) {
            return 'accent';
        }
        // Zona de piso explícita o altura < 0.5m → ambient (relleno de suelo)
        if (zone === 'floor' || y < 0.5) {
            return 'ambient';
        }
        // Movers-left/right en altura media → accent
        if (zone === 'movers-left' || zone === 'movers-right') {
            return 'accent';
        }
        // Front, center, back a altura media → primary
        if (zone === 'front' || zone === 'back' || zone === 'center') {
            return 'primary';
        }
        // Ambient/unassigned → conservar rol existente
        return node.role;
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// STAGE STORE LISTENER — Sincronización automática con el Stagebuilder
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Conecta el stageStore de Zustand al SpatialRegistrar para que cuando
 * el operador mueva un fixture en el StageConstructor, los nodos del
 * NodeGraph se actualicen automáticamente.
 *
 * PATRÓN: Zustand subscribeWithSelector permite suscribirse a slices
 * del estado fuera de React. El unsubscribe retornado debe llamarse
 * cuando el show se descarga (ej. en TitanOrchestrator.dispose()).
 *
 * DEBOUNCE IMPLÍCITO: El stageStore ya debouncea la escritura a disco
 * a 2 segundos. El listener actúa en cada cambio en memoria
 * (cuando el usuario suelta el fixture), no en cada frame de arrastre.
 * Si se necesita debounce explícito en el listener, añadir aquí.
 *
 * REGLA: rebuildNeighborGraph() se llama DESPUÉS de que todas las
 * posiciones de un batch se actualicen. Aquí se llama por cada fixture —
 * si hay muchos fixtures moviéndose juntos, el caller debe batchar
 * las actualizaciones y llamar rebuildNeighborGraph() una sola vez al final.
 *
 * @param registrar — SpatialRegistrar ya inicializado
 * @param nodeGraph — NodeGraph del show activo
 * @param target    — IAetherRegistrationTarget (TitanOrchestrator)
 * @returns Función de cleanup — llamar al descargar el show
 */
export function connectStageStoreToSpatialRegistrar(registrar, nodeGraph, target) {
    // Importación lazy del stageStore para evitar ciclos de dependencia circulares.
    // El stageStore importa tipos de stage (ShowFileV2), no de Aether.
    // Este archivo de Aether no debe importar de stores en el top-level.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useStageStore } = require('../../../stores/stageStore');
    // Suscribirse al array de fixtures completo.
    // Zustand detecta cambios por referencia — cuando updateFixturePosition
    // muta el array (Immer produce), el listener recibe la nueva versión.
    const unsubscribe = useStageStore.subscribe(state => state.fixtures, (currFixtures, prevFixtures) => {
        if (currFixtures === prevFixtures)
            return;
        // Identificar qué fixtures cambiaron de posición
        let anyPositionChanged = false;
        for (const curr of currFixtures) {
            const prev = prevFixtures.find(f => f.id === curr.id);
            if (!prev)
                continue;
            if (prev.position.x !== curr.position.x ||
                prev.position.y !== curr.position.y ||
                prev.position.z !== curr.position.z) {
                registrar.updateDevicePosition(curr.id, curr.position, nodeGraph, target);
                anyPositionChanged = true;
            }
        }
        // Reconstruir tabla de vecinos una sola vez al final del batch
        if (anyPositionChanged) {
            registrar.rebuildNeighborGraph(nodeGraph);
        }
    });
    return unsubscribe;
}
