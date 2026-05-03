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
      'movers' as EffectZone,
      'movers-left' as EffectZone,
      'movers-right' as EffectZone,
      'pars' as EffectZone,
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
    // Intentar lookup directo
    const familyMap = this._zoneCache.get(zone)
    if (familyMap) {
      const nodeIds = familyMap.get(family)
      if (nodeIds && nodeIds.length > 0) {
        return nodeIds
      }
    }

    // Si la zona no existe o no tiene nodos de esta familia, fallback a 'all'
    const allFamilyMap = this._zoneCache.get(ZoneNodeRouter.ZONE_ALL)
    if (allFamilyMap) {
      const allNodeIds = allFamilyMap.get(family)
      if (allNodeIds && allNodeIds.length > 0) {
        return allNodeIds
      }
    }

    // Ultimo recurso: retornar array vacío compartido
    return ZoneNodeRouter.EMPTY_NODE_ARRAY
  }
}
