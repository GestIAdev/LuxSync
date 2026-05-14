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

import type { IDeviceDefinition } from '../device'
import type { ICapabilityNode } from '../capability-node'
import type { INodeGraph } from '../node-graph'
import { NodeFamily } from '../types'
import type { NodeId, NodeRole, DeviceId, ZoneId } from '../types'
import type { Position3D } from '../types'
import type { Position3D as StagePosition3D, FixtureZone } from '../../../core/stage/ShowFileV2'

// ═══════════════════════════════════════════════════════════════════════════
// INTERFACE: MINIMAL ORCHESTRATOR CONTRACT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Contrato mínimo del orquestador que el SpatialRegistrar necesita.
 * Decoupled de la implementación concreta de TitanOrchestrator.
 */
export interface IAetherRegistrationTarget {
  registerAetherDevice(definition: IDeviceDefinition): void
  unregisterAetherDevice(deviceId: string): void
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERFACE: ISpatialRegistrar (Blueprint 3506 §1.7)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sincroniza datos espaciales del Stagebuilder con el NodeGraph.
 *
 * Se ejecuta en user-interaction time (cuando el operador mueve/rota
 * un fixture en el Stage 3D o al cargar el show). NUNCA en el hot path.
 *
 * Contratos de ejecución:
 * - updateDevicePosition: cuando el fixture se suelta tras arrastrarlo.
 * - rebuildNeighborGraph: al final de un batch de movimientos o al cargar show.
 * - assignHeuristicRoles: al registrar un device o al cambiar su zona.
 *
 * @see WAVE-3506-INTEGRATION-BLUEPRINT.md §1.7
 */
export interface ISpatialRegistrar {
  /**
   * Actualiza la posición de todos los nodos de un Device
   * basándose en la Position3D del fixture en el stage.
   *
   * Hace un ciclo unregister → re-enrich → register sobre el NodeGraph
   * para mantener la inmutabilidad de ICapabilityNode.position.
   * Solo llamar fuera del frame loop (user-interaction time).
   *
   * @param deviceId — ID del Device a actualizar
   * @param position — Nueva posición en metros (coordenadas escénicas)
   * @param nodeGraph — NodeGraph donde vive el Device
   * @param target    — Target de registro (TitanOrchestrator)
   */
  updateDevicePosition(
    deviceId: DeviceId,
    position: Readonly<StagePosition3D>,
    nodeGraph: INodeGraph,
    target: IAetherRegistrationTarget,
  ): void

  /**
   * Recalcula la tabla de vecinos para Selene IA.
   *
   * Usa distancia euclidiana 3D entre posiciones de nodos de la misma
   * familia para construir la tabla. Solo se llama en patch time.
   *
   * Selene usa vecindad para propagar intenciones espaciales:
   * "ola de luz de izquierda a derecha" → recorre neighborIds en orden.
   *
   * @param nodeGraph — NodeGraph con todos los nodos registrados
   * @param maxNeighbors — Número máximo de vecinos por nodo (default: 4)
   */
  rebuildNeighborGraph(
    nodeGraph: INodeGraph,
    maxNeighbors?: number,
  ): void

  /**
   * Asigna NodeRoles heurísticos basadas en zone + posición Y.
   *
   * Modifica el Device re-registrándolo con roles actualizados
   * para los nodos que cambien de rol según la heurística.
   * Solo llamar en patch time.
   *
   * Heurísticas:
   *   IMPACT/COLOR en zona aérea (y > 2.5m): role → 'accent'
   *   IMPACT/COLOR en piso (y < 0.5m):       role → 'ambient'
   *   KINETIC en movers-left/right (y > 3m): role → 'primary'
   *   ATMOSPHERE en cualquier zona:           role conservado ('ambient'|'atmosphere')
   *
   * @param deviceId — ID del Device a re-evaluar
   * @param zone     — Zona canónica actual del fixture
   * @param nodeGraph — NodeGraph donde vive el Device
   * @param target    — Target de registro para la re-inserción
   */
  assignHeuristicRoles(
    deviceId: DeviceId,
    zone: FixtureZone,
    nodeGraph: INodeGraph,
    target: IAetherRegistrationTarget,
  ): void

  /**
   * Retorna la tabla de vecinos calculada por rebuildNeighborGraph().
   * Devuelve un array vacío si el nodo no tiene vecinos calculados.
   *
   * Selene lee esta tabla en el hot path via O(1) Map.get().
   *
   * @param nodeId — ID del nodo
   */
  getNeighbors(nodeId: NodeId): readonly NodeId[]

  /**
   * Ejecuta `fn` como operación atómica de batch.
   * Suprime eventos `topology_changed` individuales durante la ejecución
   * y emite un único evento consolidado al final (incluso si `fn` lanza).
   *
   * WAVE 4735.3: Obligatorio para operaciones bulk (ej. mover múltiples
   * fixtures) para evitar N callbacks de topología.
   */
  batch(fn: () => void): void
}

// ═══════════════════════════════════════════════════════════════════════════
// OPTIONS
// ═══════════════════════════════════════════════════════════════════════════

export interface SpatialRegistrarOptions {
  /**
   * Radio de distribución de pétalos para fixtures multi-emitter (metros).
   * Default: 0.15m (15cm). Los pétalos se distribuyen en círculo
   * alrededor del centro del aparato.
   */
  readonly petalRadiusM?: number
  /**
   * Ángulo base para el primer pétalo (grados, 0=derecha, 90=arriba).
   * Default: 90 (el primer pétalo apunta "arriba" en el plano XZ).
   */
  readonly petalBaseAngleDeg?: number
}

const DEFAULT_PETAL_RADIUS_M  = 0.15
const DEFAULT_PETAL_BASE_DEG  = 90

/** Máximo de vecinos por nodo cuando el caller no lo especifica */
const DEFAULT_MAX_NEIGHBORS   = 4

/** Array vacío compartido para retornar en getNeighbors() cuando no hay vecinos */
const EMPTY_NEIGHBOR_IDS: readonly NodeId[] = Object.freeze([])

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
export class SpatialRegistrar implements ISpatialRegistrar {

  private readonly _petalRadiusM: number
  private readonly _petalBaseAngleDeg: number

  /**
   * Tabla de vecindad pre-calculada: NodeId → NodeId[] (vecinos más cercanos).
   * Se construye/reemplaza en rebuildNeighborGraph() y se lee en getNeighbors().
   * Map es el tipo correcto aquí: O(1) get, tamaño dinámico (N varía por show).
   */
  private _neighborGraph: Map<NodeId, readonly NodeId[]> = new Map()

  // ── WAVE 4735.2: Batch API — supresión de eventos durante operaciones bulk ──
  private _topologyChangedCallback: (() => void) | null = null
  private _batchDepth = 0
  private _pendingTopologyChange = false
  private _warnedMissingTopologyListener = false

  constructor(options: SpatialRegistrarOptions = {}) {
    this._petalRadiusM      = options.petalRadiusM      ?? DEFAULT_PETAL_RADIUS_M
    this._petalBaseAngleDeg = options.petalBaseAngleDeg ?? DEFAULT_PETAL_BASE_DEG
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
  public register(
    deviceDef:     Readonly<IDeviceDefinition>,
    stagePosition: Readonly<StagePosition3D>,
    target:        IAetherRegistrationTarget,
    isPlaced?:     boolean,
  ): void {
    // 🚨 WAVE 4573 Phase 5a: GUERRILLA BYPASS
    // Fixtures added via Quick-Add have isPlaced=false — no real 3D position.
    // Spatial enrichment would inject invalid coordinates into the IK engine.
    // Register the raw device definition for Classic Pan/Tilt mode instead.
    if (isPlaced === false) {
      target.registerAetherDevice(deviceDef as IDeviceDefinition)
      this._notifyTopologyChange()
      return
    }
    const enriched = this._enrichWithSpatialData(deviceDef, stagePosition)
    target.registerAetherDevice(enriched)
    this._notifyTopologyChange()
  }

  /**
   * Desregistra un Device del motor Aether.
   * Wrapper semántico para mantener la simetría con register().
   */
  public unregister(
    deviceId: string,
    target:   IAetherRegistrationTarget,
  ): void {
    target.unregisterAetherDevice(deviceId)
    this._notifyTopologyChange()
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
  public updateDevicePosition(
    deviceId: DeviceId,
    position: Readonly<StagePosition3D>,
    nodeGraph: INodeGraph,
    target: IAetherRegistrationTarget,
  ): void {
    const currentDef = nodeGraph.getDevice(deviceId)
    if (!currentDef) return  // Device no registrado — no-op

    const enriched = this._enrichWithSpatialData(currentDef, position)

    // Ciclo atómico: out → re-enrich → in
    nodeGraph.unregisterDevice(deviceId)
    nodeGraph.registerDevice(enriched)
    // Notificar al target para mantener su bookkeeping interno sincronizado
    target.registerAetherDevice(enriched)
    this._notifyTopologyChange()
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
  public rebuildNeighborGraph(
    nodeGraph: INodeGraph,
    maxNeighbors: number = DEFAULT_MAX_NEIGHBORS,
  ): void {
    // Limpiar la tabla sin reasignar el Map (evita GC)
    this._neighborGraph.clear()

    const families = [
      NodeFamily.COLOR,
      NodeFamily.IMPACT,
      NodeFamily.KINETIC,
      NodeFamily.BEAM,
      NodeFamily.ATMOSPHERE,
    ] as const

    for (const family of families) {
      const view = nodeGraph.getView(family)
      if (view.count < 2) continue

      // Snapshot local de los nodos de esta familia (solo los que tienen position)
      const nodesWithPos: Array<{ id: NodeId; pos: Position3D }> = []
      view.forEach(node => {
        if (node.position !== undefined) {
          nodesWithPos.push({ id: node.nodeId, pos: node.position })
        }
      })

      if (nodesWithPos.length < 2) continue

      // O(N²): para cada nodo, calcular distancias con todos los demás
      for (let i = 0; i < nodesWithPos.length; i++) {
        const a = nodesWithPos[i]!

        // Calcular distancias y ordenar ascendentemente
        const distances: Array<{ id: NodeId; dist2: number }> = []
        for (let j = 0; j < nodesWithPos.length; j++) {
          if (i === j) continue
          const b = nodesWithPos[j]!
          const dx = a.pos.x - b.pos.x
          const dy = a.pos.y - b.pos.y
          const dz = a.pos.z - b.pos.z
          // dist² es suficiente para comparación (evita √ innecesaria)
          distances.push({ id: b.id, dist2: dx*dx + dy*dy + dz*dz })
        }

        // Sort in-place: los N más cercanos quedan al frente
        distances.sort((x, y) => x.dist2 - y.dist2)

        const neighbors = distances
          .slice(0, maxNeighbors)
          .map(d => d.id)

        this._neighborGraph.set(a.id, Object.freeze(neighbors))
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
  public assignHeuristicRoles(
    deviceId: DeviceId,
    zone: FixtureZone,
    nodeGraph: INodeGraph,
    target: IAetherRegistrationTarget,
  ): void {
    const currentDef = nodeGraph.getDevice(deviceId)
    if (!currentDef) return

    const canonicalZone = zone as ZoneId
    const updatedNodes: ICapabilityNode[] = currentDef.nodes.map(node => {
      const role = this._inferHeuristicRole(node, canonicalZone)
      if (role === node.role) return node  // Sin cambio — no clonar
      return { ...node, role }
    })

    // Si ningún rol cambió, evitar un ciclo de re-registro innecesario
    const changed = updatedNodes.some((n, i) => n !== currentDef.nodes[i])
    if (!changed) return

    const updatedDef: IDeviceDefinition = {
      ...currentDef,
      nodes: Object.freeze(updatedNodes),
    }

    nodeGraph.unregisterDevice(deviceId)
    nodeGraph.registerDevice(updatedDef)
    target.registerAetherDevice(updatedDef)
    this._notifyTopologyChange()
  }

  /**
   * Retorna los vecinos pre-calculados de un nodo.
   * O(1) — solo una lectura del Map interno.
   * Si el nodo no tiene vecinos (no tiene posición, o rebuildNeighborGraph
   * no se ha llamado aún), retorna el array vacío compartido.
   */
  public getNeighbors(nodeId: NodeId): readonly NodeId[] {
    return this._neighborGraph.get(nodeId) ?? EMPTY_NEIGHBOR_IDS
  }

  // ── WAVE 4735.2: Batch API ─────────────────────────────────────────────

  /**
   * Registra un listener para el evento de cambio de topología (patch time).
   * El callback se dispara al final de cada operación register/update
   * o una sola vez al finalizar un batch() completo.
   */
  public setTopologyChangedListener(cb: () => void): void {
    this._topologyChangedCallback = cb
    this._warnedMissingTopologyListener = false
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
  public batch(fn: () => void): void {
    const isOuterBatch = this._batchDepth === 0
    if (isOuterBatch) {
      this._pendingTopologyChange = false
    }
    this._batchDepth++
    try {
      fn()
    } finally {
      this._batchDepth = Math.max(0, this._batchDepth - 1)
      if (isOuterBatch && this._pendingTopologyChange) {
        this._pendingTopologyChange = false
        if (this._topologyChangedCallback) {
          this._topologyChangedCallback()
        } else if (!this._warnedMissingTopologyListener) {
          this._warnedMissingTopologyListener = true
          console.warn('[SpatialRegistrar] topology_changed pending pero sin listener registrado')
        }
      }
    }
  }

  private _notifyTopologyChange(): void {
    if (this._batchDepth > 0) {
      this._pendingTopologyChange = true
    } else {
      if (this._topologyChangedCallback) {
        this._topologyChangedCallback()
      } else if (!this._warnedMissingTopologyListener) {
        this._warnedMissingTopologyListener = true
        console.warn('[SpatialRegistrar] topology_changed emitido sin listener registrado')
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SPATIAL ENRICHMENT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Construye un nuevo IDeviceDefinition con todos los nodos enriquecidos
   * con su posición 3D real. No muta el original.
   */
  private _enrichWithSpatialData(
    deviceDef:     Readonly<IDeviceDefinition>,
    stagePosition: Readonly<StagePosition3D>,
  ): IDeviceDefinition {
    // ─ WAVE 3506.1.1: COORDINATE ALIGNMENT ─────────────────────────────────
    // Mapeo explícito sin inversiones. ShowFileV2 usa Y-up:
    //   X: Left (-) to Right (+)
    //   Y: Down (-) to Up (+)   [0 = floor, positive = height/truss]
    //   Z: Back (-) to Front (+) [0 = center stage, positive = downstage]
    // Este mapeo se copia **directamente** sin traslaciones de significado.
    const center: Position3D = {
      x: stagePosition.x,  // Ancho (izquierda/derecha)
      y: stagePosition.y,  // Altura (piso/techo)
      z: stagePosition.z,  // Profundidad (upstage/downstage)
    }

    // Contar cuántos nodos COLOR hay para calcular offsets de pétalos
    const colorNodeCount = deviceDef.nodes.filter(
      n => n.family === NodeFamily.COLOR
    ).length

    const isMultiEmitter = colorNodeCount > 1

    // Calcular posiciones de pétalos si hay más de un emitter COLOR
    const petalPositions: Position3D[] = isMultiEmitter
      ? this._calculatePetalPositions(center, colorNodeCount)
      : []

    let petalCursor = 0
    const enrichedNodes: ICapabilityNode[] = deviceDef.nodes.map(node => {
      if (node.family === NodeFamily.COLOR && isMultiEmitter) {
        // Cada nodo COLOR de un multi-emitter recibe su posición de pétalo
        const pos = petalPositions[petalCursor++] ?? center
        return this._cloneNodeWithPosition(node, pos)
      }
      // KINETIC, BEAM, IMPACT, ATMOSPHERE: posición central del aparato
      return this._cloneNodeWithPosition(node, center)
    })

    return {
      ...deviceDef,
      nodes: Object.freeze(enrichedNodes),
    } satisfies IDeviceDefinition
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
  private _calculatePetalPositions(
    center: Position3D,
    count:  number,
  ): Position3D[] {
    const positions: Position3D[] = []
    const angleStep = 360 / count
    const baseRad   = (this._petalBaseAngleDeg * Math.PI) / 180

    for (let i = 0; i < count; i++) {
      const angleDeg = this._petalBaseAngleDeg + angleStep * i
      const angleRad = (angleDeg * Math.PI) / 180

      positions.push({
        x: center.x + this._petalRadiusM * Math.cos(angleRad - baseRad + Math.PI / 2),
        y: center.y,
        z: center.z + this._petalRadiusM * Math.sin(angleRad - baseRad + Math.PI / 2),
      })
    }

    return positions
  }

  /**
   * Crea una copia inmutable del nodo con la posición 3D asignada.
   * Object spread es seguro aquí porque ICapabilityNode es readonly-by-contract.
   */
  private _cloneNodeWithPosition(
    node:     ICapabilityNode,
    position: Position3D,
  ): ICapabilityNode {
    return { ...node, position }
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
  private _inferHeuristicRole(node: ICapabilityNode, zone: ZoneId): NodeRole {
    // ATMOSPHERE y BEAM: la Forja define el rol definitivamente
    if (node.family === NodeFamily.ATMOSPHERE || node.family === NodeFamily.BEAM) {
      return node.role
    }

    // KINETIC: siempre primary — el motor mecánico no cambia de semántica
    if (node.family === NodeFamily.KINETIC) {
      return 'primary'
    }

    // IMPACT + COLOR: heurística zona + altura
    const y = node.position?.y ?? 0

    // Zona aérea explícita o altura > 2.5m → accent (foco de aire)
    if (zone === 'air' || y > 2.5) {
      return 'accent'
    }

    // Zona de piso explícita o altura < 0.5m → ambient (relleno de suelo)
    if (zone === 'floor' || y < 0.5) {
      return 'ambient'
    }

    // Movers-left/right en altura media → accent
    if (zone === 'movers-left' || zone === 'movers-right') {
      return 'accent'
    }

    // Front, center, back a altura media → primary
    if (zone === 'front' || zone === 'back' || zone === 'center') {
      return 'primary'
    }

    // Ambient/unassigned → conservar rol existente
    return node.role
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
export function connectStageStoreToSpatialRegistrar(
  registrar: ISpatialRegistrar,
  nodeGraph:  INodeGraph,
  target:     IAetherRegistrationTarget,
): () => void {
  // Importación lazy del stageStore para evitar ciclos de dependencia circulares.
  // El stageStore importa tipos de stage (ShowFileV2), no de Aether.
  // Este archivo de Aether no debe importar de stores en el top-level.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useStageStore } = require('../../../stores/stageStore') as {
    useStageStore: {
      subscribe: <T>(
        selector: (state: { fixtures: Array<{ id: string; position: StagePosition3D; zone?: FixtureZone }> }) => T,
        listener: (curr: T, prev: T) => void,
        opts?: { equalityFn?: (a: T, b: T) => boolean },
      ) => () => void
    }
  }

  // Suscribirse al array de fixtures completo.
  // Zustand detecta cambios por referencia — cuando updateFixturePosition
  // muta el array (Immer produce), el listener recibe la nueva versión.
  const unsubscribe = useStageStore.subscribe(
    state => state.fixtures,
    (currFixtures, prevFixtures) => {
      if (currFixtures === prevFixtures) return

      // Identificar qué fixtures cambiaron de posición
      let anyPositionChanged = false
      const changedFixtures: Array<{ id: string; position: StagePosition3D }> = []
      for (const curr of currFixtures) {
        const prev = prevFixtures.find(f => f.id === curr.id)
        if (!prev) continue
        if (
          prev.position.x !== curr.position.x ||
          prev.position.y !== curr.position.y ||
          prev.position.z !== curr.position.z
        ) {
          changedFixtures.push(curr)
          anyPositionChanged = true
        }
      }

      // 🌍 WAVE 4735.3 FORENSIC: Batch position updates so topology_changed
      // fires exactly once after ALL updates + neighbor rebuild.
      // Previously updateDevicePosition() emitted one event per fixture.
      if (anyPositionChanged) {
        registrar.batch(() => {
          for (const f of changedFixtures) {
            registrar.updateDevicePosition(f.id, f.position, nodeGraph, target)
          }
          registrar.rebuildNeighborGraph(nodeGraph)
        })
      }
    },
  )

  return unsubscribe
}
