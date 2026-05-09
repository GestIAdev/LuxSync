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

import type {
  NodeId,
  ZoneId,
  NodeFamily,
} from '../../types'
import type { INodeGraph } from '../../node-graph'
import type { EffectZone } from '../../../effects/types'
import { normalizeZoneId } from '../zoneUtils'

// ═══════════════════════════════════════════════════════════════════════════
// INTERFAZ PÚBLICA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Contrato de enrutamiento: zona canónica → NodeIds tipados por familia.
 */
export interface IZoneNodeRouter {
  /**
   * Expande una zona canónica a los NodeIds en una familia específica.
   *
   * O(1) — pre-cacheado en patch time.
   * Zero-alloc — retorna un array compartido (readonly).
   *
   * @param zone - Zona canónica ('front', 'movers-left', 'all', etc.)
   * @param family - Familia de nodos a filtrar
   * @returns NodeIds de nodos que viven en esa zona + familia (readonly)
   */
  resolve(zone: EffectZone, family: NodeFamily): readonly NodeId[]
}

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
export class ZoneNodeRouter implements IZoneNodeRouter {
  /**
   * Cache: zone → (family → NodeId[])
   *
   * Tipo: Map<EffectZone | 'all', Map<NodeFamily, NodeId[]>>
   *
   * 'all' es una zona especial que contiene todos los nodos de cada familia.
   */
  private readonly _zoneCache: Map<EffectZone | 'all', Map<NodeFamily, readonly NodeId[]>>

  /**
   * Array vacío compartido — retornado cuando una zona no tiene nodos.
   * Evita crear arrays vacíos en cada lookup fallido.
   */
  private static readonly EMPTY_NODE_ARRAY: readonly NodeId[] = Object.freeze([])

  /**
   * Las familias que soportamos en routing.
   * Excluimos ATMOSPHERE (no controlable por L3 Effects).
   */
  private static readonly ROUTABLE_FAMILIES: readonly NodeFamily[] = [
    'COLOR' as NodeFamily,
    'IMPACT' as NodeFamily,
    'KINETIC' as NodeFamily,
    'BEAM' as NodeFamily,
  ]

  /**
   * Zona especial "all" — expande a todos los nodos de una familia.
   * Si una zona no se mapea explícitamente, la comparamos contra 'all'.
   */
  private static readonly ZONE_ALL = 'all' as const

  /**
   * Normaliza aliases legacy/stereo de efectos a la zona canónica del grafo.
   * Mantiene compatibilidad con EffectZone ('frontL', 'backR', etc.).
   */
  private _canonicalizeZone(zone: EffectZone): EffectZone | 'all' {
    const normalized = normalizeZoneId(zone)

    if (normalized === 'front-l' || normalized === 'frontl') return 'front-left' as EffectZone
    if (normalized === 'front-r' || normalized === 'frontr') return 'front-right' as EffectZone
    if (normalized === 'back-l' || normalized === 'backl') return 'back-left' as EffectZone
    if (normalized === 'back-r' || normalized === 'backr') return 'back-right' as EffectZone
    if (normalized === 'floor-l' || normalized === 'floorl') return 'floor-left' as EffectZone
    if (normalized === 'floor-r' || normalized === 'floorr') return 'floor-right' as EffectZone

    return normalized as EffectZone | 'all'
  }

  /** Une varias zonas en una sola zona agregada (patch-time, no hot-path). */
  private _mergeZones(target: EffectZone, sources: readonly EffectZone[]): void {
    const mergedByFamily = new Map<NodeFamily, readonly NodeId[]>()

    for (const family of ZoneNodeRouter.ROUTABLE_FAMILIES) {
      const familyKey = family as NodeFamily
      const merged: NodeId[] = []

      for (let i = 0; i < sources.length; i++) {
        const sourceMap = this._zoneCache.get(sources[i])
        const nodes = sourceMap?.get(familyKey) ?? ZoneNodeRouter.EMPTY_NODE_ARRAY
        for (let j = 0; j < nodes.length; j++) {
          const nodeId = nodes[j]
          if (!merged.includes(nodeId)) {
            merged.push(nodeId)
          }
        }
      }

      mergedByFamily.set(familyKey, Object.freeze(merged) as readonly NodeId[])
    }

    this._zoneCache.set(target, mergedByFamily)
  }

  /** Garantiza que exista el contenedor zone->family en cache. */
  private _ensureZoneMap(zone: EffectZone | 'all'): Map<NodeFamily, readonly NodeId[]> {
    const existing = this._zoneCache.get(zone)
    if (existing) {
      return existing
    }

    const created = new Map<NodeFamily, readonly NodeId[]>()
    for (const family of ZoneNodeRouter.ROUTABLE_FAMILIES) {
      created.set(family as NodeFamily, ZoneNodeRouter.EMPTY_NODE_ARRAY)
    }
    this._zoneCache.set(zone, created)
    return created
  }

  /**
   * Une nodos de una zona raw del grafo a una zona canónica del router.
   * Se usa para absorber nombres legacy (frontL, FRONT_LEFT, etc.) sin perder señal.
   */
  private _appendNodesToZone(
    targetZone: EffectZone | 'all',
    family: NodeFamily,
    incoming: readonly NodeId[],
  ): void {
    if (incoming.length === 0) {
      return
    }

    const zoneMap = this._ensureZoneMap(targetZone)
    const current = zoneMap.get(family) ?? ZoneNodeRouter.EMPTY_NODE_ARRAY

    if (current.length === 0) {
      const copy: NodeId[] = []
      for (let i = 0; i < incoming.length; i++) {
        copy.push(incoming[i])
      }
      zoneMap.set(family, Object.freeze(copy) as readonly NodeId[])
      return
    }

    const merged: NodeId[] = []
    for (let i = 0; i < current.length; i++) {
      merged.push(current[i])
    }
    for (let i = 0; i < incoming.length; i++) {
      const nodeId = incoming[i]
      if (!merged.includes(nodeId)) {
        merged.push(nodeId)
      }
    }
    zoneMap.set(family, Object.freeze(merged) as readonly NodeId[])
  }

  // ─────────────────────────────────────────────────────────────────────────

  constructor(nodeGraph: INodeGraph) {
    this._zoneCache = new Map()

    // ───────────────────────────────────────────────────────────────────────
    // FASE 1: Mapeo de zonas estratégicas
    //
    // Para cada zona canónica, obtener todos los nodos que la contienen.
    // Usamos la vista de cada familia + byZone() para O(1) lookup.
    // ───────────────────────────────────────────────────────────────────────

    const canonicalZones: readonly EffectZone[] = [
      'front',
      'back',
      'center',
      'floor',
      'front-left' as EffectZone,
      'front-right' as EffectZone,
      'back-left' as EffectZone,
      'back-right' as EffectZone,
      'floor-left' as EffectZone,
      'floor-right' as EffectZone,
      'all-movers' as EffectZone,
      'movers' as EffectZone,
      'movers-left' as EffectZone,
      'movers-right' as EffectZone,
      'pars' as EffectZone,
      'all-pars' as EffectZone,
      'all-left' as EffectZone,
      'all-right' as EffectZone,
      'ambient' as EffectZone,
      'air' as EffectZone,
      'unassigned' as EffectZone,
      'all' as EffectZone,
    ]

    // Para cada zona canónica
    for (const zone of canonicalZones) {
      const familyMap = new Map<NodeFamily, readonly NodeId[]>()

      // Para cada familia que soportamos
      for (const family of ZoneNodeRouter.ROUTABLE_FAMILIES) {
        const view = nodeGraph.getView(family as NodeFamily)

        // Obtener todos los nodos de esta familia en esta zona
        // El byZone() es un método de INodeView que usa índice pre-construido
        const nodesInZone = view.byZone(zone as ZoneId)

        // Convertir a NodeId[] si es necesario; byZone() ya retorna readonly
        const nodeIds = nodesInZone as unknown as readonly NodeId[]

        familyMap.set(family as NodeFamily, nodeIds)
      }

      this._zoneCache.set(zone, familyMap)
    }

    // Absorber TODAS las zonas activas reales del graph (incluye legacy aliases).
    // Esto evita zonas mudas en shows parcialmente migrados.
    const activeZones = nodeGraph.snapshot().activeZones as readonly ZoneId[]
    for (let z = 0; z < activeZones.length; z++) {
      const rawZone = String(activeZones[z])
      const canonical = this._canonicalizeZone(rawZone as EffectZone)

      for (const family of ZoneNodeRouter.ROUTABLE_FAMILIES) {
        const familyKey = family as NodeFamily
        const view = nodeGraph.getView(familyKey)
        const nodesInRawZone = view.byZone(rawZone as ZoneId) as unknown as readonly NodeId[]
        this._appendNodesToZone(canonical, familyKey, nodesInRawZone)
      }
    }

    // Alias compuesto: all-movers = union determinista movers-left + movers-right.
    // Se precalcula en patch-time para evitar fallback accidental a 'all'.
    {
      const leftMap = this._zoneCache.get('movers-left' as EffectZone)
      const rightMap = this._zoneCache.get('movers-right' as EffectZone)
      if (leftMap || rightMap) {
        const allMoversMap = new Map<NodeFamily, readonly NodeId[]>()
        for (const family of ZoneNodeRouter.ROUTABLE_FAMILIES) {
          const familyKey = family as NodeFamily
          const left = leftMap?.get(familyKey) ?? ZoneNodeRouter.EMPTY_NODE_ARRAY
          const right = rightMap?.get(familyKey) ?? ZoneNodeRouter.EMPTY_NODE_ARRAY

          if (left.length === 0) {
            allMoversMap.set(familyKey, right)
            continue
          }
          if (right.length === 0) {
            allMoversMap.set(familyKey, left)
            continue
          }

          const merged: NodeId[] = []
          for (let i = 0; i < left.length; i++) {
            merged.push(left[i])
          }
          for (let i = 0; i < right.length; i++) {
            const nodeId = right[i]
            if (!merged.includes(nodeId)) {
              merged.push(nodeId)
            }
          }
          allMoversMap.set(familyKey, Object.freeze(merged) as readonly NodeId[])
        }

        this._zoneCache.set('all-movers' as EffectZone, allMoversMap)
      }
    }

    // Agregados estéreo: front/back/floor deben incluir sus subzonas L/R.
    this._mergeZones('front' as EffectZone, ['front' as EffectZone, 'front-left' as EffectZone, 'front-right' as EffectZone])
    this._mergeZones('back' as EffectZone, ['back' as EffectZone, 'back-left' as EffectZone, 'back-right' as EffectZone])
    this._mergeZones('floor' as EffectZone, ['floor' as EffectZone, 'floor-left' as EffectZone, 'floor-right' as EffectZone])

    // Grupos auxiliares usados por algunos efectos legacy/cinemáticos.
    this._mergeZones('all-pars' as EffectZone, [
      'front' as EffectZone,
      'back' as EffectZone,
      'floor' as EffectZone,
      'front-left' as EffectZone,
      'front-right' as EffectZone,
      'back-left' as EffectZone,
      'back-right' as EffectZone,
      'floor-left' as EffectZone,
      'floor-right' as EffectZone,
    ])
    this._mergeZones('all-left' as EffectZone, [
      'movers-left' as EffectZone,
      'front-left' as EffectZone,
      'back-left' as EffectZone,
      'floor-left' as EffectZone,
    ])
    this._mergeZones('all-right' as EffectZone, [
      'movers-right' as EffectZone,
      'front-right' as EffectZone,
      'back-right' as EffectZone,
      'floor-right' as EffectZone,
    ])

    // ───────────────────────────────────────────────────────────────────────
    // FASE 2: Construir la zona "all"
    //
    // Zona especial que contiene TODOS los nodos de cada familia.
    // Usada como fallback cuando una zona no se mapea explícitamente.
    // ───────────────────────────────────────────────────────────────────────

    const allFamilyMap = new Map<NodeFamily, readonly NodeId[]>()

    for (const family of ZoneNodeRouter.ROUTABLE_FAMILIES) {
      const view = nodeGraph.getView(family as NodeFamily)

      // Construir array de todos los nodos de esta familia
      const allNodeIds: NodeId[] = []
      view.forEach((node) => {
        allNodeIds.push(node.nodeId)
      })

      allFamilyMap.set(
        family as NodeFamily,
        Object.freeze(allNodeIds) as unknown as readonly NodeId[],
      )
    }

    this._zoneCache.set(ZoneNodeRouter.ZONE_ALL, allFamilyMap)
  }

  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Resuelve una zona + familia → NodeIds.
   * O(1) lookup con dos Map.get().
   * Zero-alloc — retorna referencias compartidas.
   */
  resolve(zone: EffectZone, family: NodeFamily): readonly NodeId[] {
    const requestedZone = normalizeZoneId(zone)
    const canonicalZone = this._canonicalizeZone(zone)

    // Intentar lookup directo
    const familyMap = this._zoneCache.get(canonicalZone)
    if (familyMap) {
      const nodeIds = familyMap.get(family)
      if (nodeIds && nodeIds.length > 0) {
        return nodeIds
      }
    }

    // Alias de compatibilidad: movers => all-movers si movers está vacío.
    if (requestedZone === 'movers') {
      const moversFamilyMap = this._zoneCache.get('all-movers' as EffectZone)
      if (moversFamilyMap) {
        const moverNodeIds = moversFamilyMap.get(family)
        if (moverNodeIds && moverNodeIds.length > 0) {
          return moverNodeIds
        }
      }
    }

    // Solo la zona explícita 'all' expande a todo el universo.
    // Evita aplanar espacialidad cuando una zona está vacía o no existe.
    if (canonicalZone === ZoneNodeRouter.ZONE_ALL) {
      const allFamilyMap = this._zoneCache.get(ZoneNodeRouter.ZONE_ALL)
      if (allFamilyMap) {
        const allNodeIds = allFamilyMap.get(family)
        if (allNodeIds && allNodeIds.length > 0) {
          return allNodeIds
        }
      }
    }

    // Ultimo recurso: retornar array vacío compartido
    return ZoneNodeRouter.EMPTY_NODE_ARRAY
  }
}
