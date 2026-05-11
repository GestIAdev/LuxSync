/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🚀 WAVE 4524.3 — ZONE NODE ROUTER
 * Traductor: Zonas canónicas Selene → NodeIds en Aether Matrix
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El ZoneNodeRouter expande una zona semántica de Selene (p.ej. 'front',
 * 'movers-left') en todos los NodeIds correspondientes en una familia
 * específica (IMPACT, COLOR, etc.).
 *
 * PRE-CACHEADO EN PATCH TIME: O(1) lookup + zero-alloc en frame-time.
 *
 * AXIOMA ANTI-SIMULACIÓN: Los mapeos son deterministas, basados en el
 * patch actual. Sin heurísticas, sin Math.random(), sin demos.
 *
 * @module core/aether/adapters/helpers/zone-node-router
 * @version WAVE 4524.3
 */
import { normalizeZoneId } from '../zoneUtils';
// ═══════════════════════════════════════════════════════════════════════════
// IMPLEMENTACIÓN
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Enrutador de zonas pre-cacheado.
 *
 * Construcción:
 *   - Recibe INodeGraph en el constructor.
 *   - Constructor itera sobre todas las vistas de familia.
 *   - Construye un Map: zone → (family → NodeId[]).
 *   - Zero copy — almacena las mismas referencias que el NodeGraph.
 *
 * Uso en frame-time:
 *   resolve(zone, family) → Map.get(zone)?.[family] ?? EMPTY_ARRAY
 *   Todo O(1), cero allocations.
 */
export class ZoneNodeRouter {
    /**
     * Normaliza aliases legacy/stereo de efectos a la zona canónica del grafo.
     * Mantiene compatibilidad con EffectZone ('frontL', 'backR', etc.).
     */
    _canonicalizeZone(zone) {
        const normalized = normalizeZoneId(zone);
        if (normalized === 'front-l' || normalized === 'frontl')
            return 'front-left';
        if (normalized === 'front-r' || normalized === 'frontr')
            return 'front-right';
        if (normalized === 'back-l' || normalized === 'backl')
            return 'back-left';
        if (normalized === 'back-r' || normalized === 'backr')
            return 'back-right';
        if (normalized === 'floor-l' || normalized === 'floorl')
            return 'floor-left';
        if (normalized === 'floor-r' || normalized === 'floorr')
            return 'floor-right';
        return normalized;
    }
    /** Une varias zonas en una sola zona agregada (patch-time, no hot-path). */
    _mergeZones(target, sources) {
        const mergedByFamily = new Map();
        for (const family of ZoneNodeRouter.ROUTABLE_FAMILIES) {
            const familyKey = family;
            const merged = [];
            for (let i = 0; i < sources.length; i++) {
                const sourceMap = this._zoneCache.get(sources[i]);
                const nodes = sourceMap?.get(familyKey) ?? ZoneNodeRouter.EMPTY_NODE_ARRAY;
                for (let j = 0; j < nodes.length; j++) {
                    const nodeId = nodes[j];
                    if (!merged.includes(nodeId)) {
                        merged.push(nodeId);
                    }
                }
            }
            mergedByFamily.set(familyKey, Object.freeze(merged));
        }
        this._zoneCache.set(target, mergedByFamily);
    }
    /** Garantiza que exista el contenedor zone->family en cache. */
    _ensureZoneMap(zone) {
        const existing = this._zoneCache.get(zone);
        if (existing) {
            return existing;
        }
        const created = new Map();
        for (const family of ZoneNodeRouter.ROUTABLE_FAMILIES) {
            created.set(family, ZoneNodeRouter.EMPTY_NODE_ARRAY);
        }
        this._zoneCache.set(zone, created);
        return created;
    }
    /**
     * Une nodos de una zona raw del grafo a una zona canónica del router.
     * Se usa para absorber nombres legacy (frontL, FRONT_LEFT, etc.) sin perder señal.
     */
    _appendNodesToZone(targetZone, family, incoming) {
        if (incoming.length === 0) {
            return;
        }
        const zoneMap = this._ensureZoneMap(targetZone);
        const current = zoneMap.get(family) ?? ZoneNodeRouter.EMPTY_NODE_ARRAY;
        if (current.length === 0) {
            const copy = [];
            for (let i = 0; i < incoming.length; i++) {
                copy.push(incoming[i]);
            }
            zoneMap.set(family, Object.freeze(copy));
            return;
        }
        const merged = [];
        for (let i = 0; i < current.length; i++) {
            merged.push(current[i]);
        }
        for (let i = 0; i < incoming.length; i++) {
            const nodeId = incoming[i];
            if (!merged.includes(nodeId)) {
                merged.push(nodeId);
            }
        }
        zoneMap.set(family, Object.freeze(merged));
    }
    // ─────────────────────────────────────────────────────────────────────────
    constructor(nodeGraph) {
        this._zoneCache = new Map();
        // ───────────────────────────────────────────────────────────────────────
        // FASE 1: Mapeo de zonas estratégicas
        //
        // Para cada zona canónica, obtener todos los nodos que la contienen.
        // Usamos la vista de cada familia + byZone() para O(1) lookup.
        // ───────────────────────────────────────────────────────────────────────
        const canonicalZones = [
            'front',
            'back',
            'center',
            'floor',
            'front-left',
            'front-right',
            'back-left',
            'back-right',
            'floor-left',
            'floor-right',
            'all-movers',
            'movers',
            'movers-left',
            'movers-right',
            'pars',
            'all-pars',
            'all-left',
            'all-right',
            'ambient',
            'air',
            'unassigned',
            'all',
        ];
        // Para cada zona canónica
        for (const zone of canonicalZones) {
            const familyMap = new Map();
            // Para cada familia que soportamos
            for (const family of ZoneNodeRouter.ROUTABLE_FAMILIES) {
                const view = nodeGraph.getView(family);
                // Obtener todos los nodos de esta familia en esta zona
                // El byZone() es un método de INodeView que usa índice pre-construido
                const nodesInZone = view.byZone(zone);
                // Convertir a NodeId[] si es necesario; byZone() ya retorna readonly
                const nodeIds = nodesInZone;
                familyMap.set(family, nodeIds);
            }
            this._zoneCache.set(zone, familyMap);
        }
        // Absorber TODAS las zonas activas reales del graph (incluye legacy aliases).
        // Esto evita zonas mudas en shows parcialmente migrados.
        const activeZones = nodeGraph.snapshot().activeZones;
        for (let z = 0; z < activeZones.length; z++) {
            const rawZone = String(activeZones[z]);
            const canonical = this._canonicalizeZone(rawZone);
            for (const family of ZoneNodeRouter.ROUTABLE_FAMILIES) {
                const familyKey = family;
                const view = nodeGraph.getView(familyKey);
                const nodesInRawZone = view.byZone(rawZone);
                this._appendNodesToZone(canonical, familyKey, nodesInRawZone);
            }
        }
        // Alias compuesto: all-movers = union determinista movers + movers-left + movers-right.
        // Incluye fixtures asignados directamente a 'movers' (sin estereo L/R).
        // Se precalcula en patch-time para evitar fallback accidental a 'all'.
        {
            const moversMap = this._zoneCache.get('movers');
            const leftMap = this._zoneCache.get('movers-left');
            const rightMap = this._zoneCache.get('movers-right');
            if (moversMap || leftMap || rightMap) {
                const allMoversMap = new Map();
                for (const family of ZoneNodeRouter.ROUTABLE_FAMILIES) {
                    const familyKey = family;
                    const center = moversMap?.get(familyKey) ?? ZoneNodeRouter.EMPTY_NODE_ARRAY;
                    const left = leftMap?.get(familyKey) ?? ZoneNodeRouter.EMPTY_NODE_ARRAY;
                    const right = rightMap?.get(familyKey) ?? ZoneNodeRouter.EMPTY_NODE_ARRAY;
                    const merged = [];
                    const sources = [center, left, right];
                    for (let s = 0; s < sources.length; s++) {
                        const src = sources[s];
                        for (let i = 0; i < src.length; i++) {
                            if (!merged.includes(src[i])) {
                                merged.push(src[i]);
                            }
                        }
                    }
                    if (merged.length === 0) {
                        allMoversMap.set(familyKey, ZoneNodeRouter.EMPTY_NODE_ARRAY);
                        continue;
                    }
                    allMoversMap.set(familyKey, Object.freeze(merged));
                }
                this._zoneCache.set('all-movers', allMoversMap);
            }
        }
        // Agregados estéreo: front/back/floor deben incluir sus subzonas L/R.
        this._mergeZones('front', ['front', 'front-left', 'front-right']);
        this._mergeZones('back', ['back', 'back-left', 'back-right']);
        this._mergeZones('floor', ['floor', 'floor-left', 'floor-right']);
        // Grupos auxiliares usados por algunos efectos legacy/cinemáticos.
        this._mergeZones('all-pars', [
            'front',
            'back',
            'floor',
            'front-left',
            'front-right',
            'back-left',
            'back-right',
            'floor-left',
            'floor-right',
        ]);
        this._mergeZones('all-left', [
            'movers-left',
            'front-left',
            'back-left',
            'floor-left',
        ]);
        this._mergeZones('all-right', [
            'movers-right',
            'front-right',
            'back-right',
            'floor-right',
        ]);
        // ───────────────────────────────────────────────────────────────────────
        // FASE 2: Construir la zona "all"
        //
        // Zona especial que contiene TODOS los nodos de cada familia.
        // Usada como fallback cuando una zona no se mapea explícitamente.
        // ───────────────────────────────────────────────────────────────────────
        const allFamilyMap = new Map();
        for (const family of ZoneNodeRouter.ROUTABLE_FAMILIES) {
            const view = nodeGraph.getView(family);
            // Construir array de todos los nodos de esta familia
            const allNodeIds = [];
            view.forEach((node) => {
                allNodeIds.push(node.nodeId);
            });
            allFamilyMap.set(family, Object.freeze(allNodeIds));
        }
        this._zoneCache.set(ZoneNodeRouter.ZONE_ALL, allFamilyMap);
    }
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Resuelve una zona + familia → NodeIds.
     * O(1) lookup con dos Map.get().
     * Zero-alloc — retorna referencias compartidas.
     */
    resolve(zone, family) {
        const requestedZone = normalizeZoneId(zone);
        const canonicalZone = this._canonicalizeZone(zone);
        // Intentar lookup directo
        const familyMap = this._zoneCache.get(canonicalZone);
        if (familyMap) {
            const nodeIds = familyMap.get(family);
            if (nodeIds && nodeIds.length > 0) {
                return nodeIds;
            }
        }
        // Alias de compatibilidad: movers => all-movers si movers está vacío.
        if (requestedZone === 'movers') {
            const moversFamilyMap = this._zoneCache.get('all-movers');
            if (moversFamilyMap) {
                const moverNodeIds = moversFamilyMap.get(family);
                if (moverNodeIds && moverNodeIds.length > 0) {
                    return moverNodeIds;
                }
            }
        }
        // Solo la zona explícita 'all' expande a todo el universo.
        // Evita aplanar espacialidad cuando una zona está vacía o no existe.
        if (canonicalZone === ZoneNodeRouter.ZONE_ALL) {
            const allFamilyMap = this._zoneCache.get(ZoneNodeRouter.ZONE_ALL);
            if (allFamilyMap) {
                const allNodeIds = allFamilyMap.get(family);
                if (allNodeIds && allNodeIds.length > 0) {
                    return allNodeIds;
                }
            }
        }
        // Ultimo recurso: retornar array vacío compartido
        return ZoneNodeRouter.EMPTY_NODE_ARRAY;
    }
}
/**
 * Array vacío compartido — retornado cuando una zona no tiene nodos.
 * Evita crear arrays vacíos en cada lookup fallido.
 */
ZoneNodeRouter.EMPTY_NODE_ARRAY = Object.freeze([]);
/**
 * Las familias que soportamos en routing.
 * Excluimos ATMOSPHERE (no controlable por L3 Effects).
 */
ZoneNodeRouter.ROUTABLE_FAMILIES = [
    'COLOR',
    'IMPACT',
    'KINETIC',
    'BEAM',
];
/**
 * Zona especial "all" — expande a todos los nodos de una familia.
 * Si una zona no se mapea explícitamente, la comparamos contra 'all'.
 */
ZoneNodeRouter.ZONE_ALL = 'all';
