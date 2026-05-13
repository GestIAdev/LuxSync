/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ PROGRAMMER AETHER BRIDGE — WAVE 4529 → WAVE 4724: CAMALEÓN MULTI-CELL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Singleton que conecta el programmerStore con el NodeArbiter L2 vía IPC.
 *
 * FLUJO LEGACY (fixture-flat):
 *   UI event → programmerStore.setColor/setDimmer/... → dirty FAMILY set
 *   44Hz tick → bridge lee dirtyFamilies → construye payloads → IPC L2
 *   → consumeDirtyFamilies()
 *
 * FLUJO CELL (Multi-Cell, WAVE 4724):
 *   UI event → programmerStore.setCellColor(cellKey, ...) → dirty CELL set
 *   44Hz tick → bridge itera dirtyCells → emite a los nodeIds reales del Aether
 *   → consumeDirtyCells() / consumePendingClearNodeIds()
 *
 * PRECEDENCIA:
 *   La capa CELL drena PRIMERO. Los nodeIds tocados por celdas se registran
 *   en `coveredNodeIds` y se EXCLUYEN del path legacy en el mismo tick para
 *   evitar dobles escrituras.
 *
 * FAMILIA → NodeId label map (legacy):
 *   IMPACT  → 'impact'
 *   COLOR   → 'color'
 *   KINETIC → 'kinetic'
 *   BEAM    → 'beam'
 *   EXTRAS  → 'atmosphere'
 *
 * Los valores en el store ya están normalizados 0-1.
 * El bridge NO hace ninguna transformación de valores.
 *
 * ZERO-ALLOC HOT PATH:
 *   - Iteración con for...of sobre Map y Set (sin .filter/.map intermedios).
 *   - CellKey y nodeIds[] son referencias pre-construidas — no se concatenan.
 *   - Las arrays `setPayloads` y `clearNodeIds` se reusan POR TICK (allocations
 *     locales del flush, no globales) y son escalables al volumen normal de
 *     un show (≤200 cells dirty/tick).
 *
 * @module bridges/ProgrammerAetherBridge
 * @version WAVE 4724
 */

import {
  useProgrammerStore,
  type ProgrammerFamily,
  type ProgrammerOverrides,
  type CellOverride,
  type CellOverridePayload,
  type CellKey,
  type ColorCellPayload,
  type ImpactCellPayload,
  type BeamCellPayload,
  type KineticCellPayload,
} from '../stores/programmerStore'
import { NodeFamily } from '../core/aether/types'
// WAVE 4720: necesitamos saber si hay patrón activo para emitir pan_base/tilt_base
// en vez de pan/tilt LTP, evitando que el MANUAL HARD LOCK aplaste la órbita.
import { useMovementStore } from '../stores/movementStore'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** 44Hz = 1000/44 ≈ 22.7ms */
const TICK_INTERVAL_MS = 1000 / 44

/** Familia → label del nodeId en la Aether Matrix */
const FAMILY_LABEL: Record<ProgrammerFamily, string> = {
  IMPACT:  'impact',
  COLOR:   'color',
  KINETIC: 'kinetic',
  BEAM:    'beam',
  EXTRAS:  'atmosphere',
}

// ─────────────────────────────────────────────────────────────────────────────
// CHANNEL EXTRACTOR — Construye channels Record<string, number> por familia
// ─────────────────────────────────────────────────────────────────────────────

/** Extrae los canales activos (non-null) de la familia IMPACT */
function extractImpact(ov: ProgrammerOverrides | undefined): Record<string, number> | null {
  if (!ov) return null
  const ch: Record<string, number> = {}
  if (ov.dimmer  !== null) {
    ch['dimmer']  = ov.dimmer
    // WAVE 4709 HOTFIX: PARs RGB puros (sin canal dimmer físico) atenuan por
    // `brightness`. Enviar ambos evita que L0 pulsee brightness por fuera de L2.
    ch['brightness'] = ov.dimmer
  }
  if (ov.strobe  !== null) ch['strobe']  = ov.strobe
  if (ov.shutter !== null) ch['shutter'] = ov.shutter
  return Object.keys(ch).length > 0 ? ch : null
}

/** Extrae los canales activos de la familia COLOR */
function extractColor(ov: ProgrammerOverrides | undefined): Record<string, number> | null {
  if (!ov) return null
  const ch: Record<string, number> = {}
  // WAVE 4715 HOTFIX: Enviar SOLO los nombres canónicos (r, g, b)
  // sin duplicar (red, green, blue). El WAVE 4714 hard lock captura
  // TODOS los canales enviados y los rereplica post-L3, pero si hay
  // nombres inconsistentes, el colorAdapter/Selene puede escribir en
  // un nombre NO capturado → intrusión directa desde L1/L3.
  // Canonical: SeleneColorEngine genera (r, g, b), NodeArbiter merge usa (r, g, b).
  if (ov.red   !== null) ch['r'] = ov.red
  if (ov.green !== null) ch['g'] = ov.green
  if (ov.blue  !== null) ch['b'] = ov.blue
  if (ov.white !== null) ch['white'] = ov.white
  if (ov.amber !== null) ch['amber'] = ov.amber
  return Object.keys(ch).length > 0 ? ch : null
}

/**
 * Extrae los canales activos de la familia KINETIC.
 *
 * WAVE 4718 FIX ANCHOR:
 * Cuando hay patrón activo, el AetherKineticEngine es el ÚNICO propietario
 * de `pan_base`/`tilt_base` en L2 — lee el anchor del Radar directamente
 * desde NodeArbiter (`getManualOverride`) en cada tick del motor.
 * El ProgrammerAetherBridge NO debe escribir `pan_base`/`tilt_base`
 * cuando hay patrón activo: lo picaría con la posición estática del store
 * interrumpiendo la sincronía motor↔radar.
 *
 * Con patrón activo → solo speed (si existe). Pan/tilt del store son el
 * anchor que el KineticsBridge ya escribió vía `setManualOverrides` L2.
 * Sin patrón activo → emite `pan`/`tilt` absolutos LTP normales.
 *
 * @param ov               Overrides del fixture (puede ser undefined)
 * @param hasActivePattern true cuando hay patrón circle/sweep/etc activo
 */
function extractKinetic(ov: ProgrammerOverrides | undefined, hasActivePattern: boolean): Record<string, number> | null {
  if (!ov) return null
  const ch: Record<string, number> = {}
  const hasSpatialTarget = ov.targetX !== null && ov.targetY !== null && ov.targetZ !== null
  if (hasSpatialTarget) {
    ch['targetX'] = ov.targetX!
    ch['targetY'] = ov.targetY!
    ch['targetZ'] = ov.targetZ!
  } else if (!hasActivePattern) {
    // Sin patrón activo → canales absolutos LTP normales
    if (ov.pan  !== null) ch['pan']  = ov.pan
    if (ov.tilt !== null) ch['tilt'] = ov.tilt
  }
  // Con patrón activo: pan/tilt del store son el anchor del Radar.
  // KineticsBridge._flushClassic ya los escribió en L2 como pan_base/tilt_base.
  // AetherKineticEngine.tick() los lee con getManualOverride() para centrar la órbita.
  // Este bridge NO reescribe nada de posición — evita la condición de carrera L2.
  if (ov.speed !== null) ch['speed'] = ov.speed
  return Object.keys(ch).length > 0 ? ch : null
}

/** Extrae los canales activos de la familia BEAM */
function extractBeam(ov: ProgrammerOverrides | undefined): Record<string, number> | null {
  if (!ov) return null
  const ch: Record<string, number> = {}
  if (ov.focus !== null) ch['focus'] = ov.focus
  if (ov.zoom  !== null) ch['zoom']  = ov.zoom
  if (ov.iris  !== null) ch['iris']  = ov.iris
  return Object.keys(ch).length > 0 ? ch : null
}

/**
 * WAVE 4708: gobo/prism salen del flujo automático BEAM y viven en cuarentena
 * dentro del nodo :atmosphere (ruta Extras manual/explicita).
 */
function extractBeamMechanicalToExtras(ov: ProgrammerOverrides | undefined): Record<string, number> | null {
  if (!ov) return null
  const ch: Record<string, number> = {}
  if (ov.gobo !== null) ch['gobo'] = ov.gobo
  if (ov.prism !== null) ch['prism'] = ov.prism
  return Object.keys(ch).length > 0 ? ch : null
}

/**
 * Canal phantom que debe enrutarse al nodo :kinetic en vez de :atmosphere.
 * `rotation` y `speed` son tipos de canal KINETIC; enviarlos a :atmosphere
 * (que solo tiene el canal 'custom' / Pan Kill) haría que el resolver los ignore.
 */
const KINETIC_PHANTOM_CHANNELS = new Set<string>(['rotation', 'speed'])

/** Extrae canales EXTRAS que van al nodo :atmosphere (custom, macro, control…) */
function extractExtrasAtmosphere(ov: ProgrammerOverrides | undefined): Record<string, number> | null {
  if (!ov || ov.extras.size === 0) return null
  const ch: Record<string, number> = {}
  ov.extras.forEach((value, key) => {
    if (!KINETIC_PHANTOM_CHANNELS.has(key)) ch[key] = value
  })
  return Object.keys(ch).length > 0 ? ch : null
}

/** Extrae canales EXTRAS que van al nodo :kinetic (rotation, speed) */
function extractExtrasKinetic(ov: ProgrammerOverrides | undefined): Record<string, number> | null {
  if (!ov || ov.extras.size === 0) return null
  const ch: Record<string, number> = {}
  ov.extras.forEach((value, key) => {
    if (KINETIC_PHANTOM_CHANNELS.has(key)) ch[key] = value
  })
  return Object.keys(ch).length > 0 ? ch : null
}

/**
 * Une los overrides cinéticos de ambas rutas que comparten `:kinetic`:
 * - KINETIC section (pan/tilt/speed/targetX/Y/Z)
 * - EXTRAS section (rotation/speed phantom)
 */
// WAVE 4720: la versión con hasActivePattern — llamada desde _flush() que conoce
// el estado del movementStore en el momento del tick de 44Hz.
function extractUnifiedKinetic(ov: ProgrammerOverrides | undefined, hasActivePattern: boolean): Record<string, number> | null {
  const base = extractKinetic(ov, hasActivePattern)
  const phantom = extractExtrasKinetic(ov)
  if (!base && !phantom) return null
  return {
    ...(base ?? {}),
    ...(phantom ?? {}),
  }
}

/**
 * Une los overrides que comparten `:atmosphere`:
 * - EXTRAS section (custom/macro/control...)
 * - BEAM mechanical split (gobo/prism manual cuarentenado)
 */
function extractUnifiedAtmosphere(ov: ProgrammerOverrides | undefined): Record<string, number> | null {
  const extras = extractExtrasAtmosphere(ov)
  const beamMechanical = extractBeamMechanicalToExtras(ov)
  if (!extras && !beamMechanical) return null
  return {
    ...(extras ?? {}),
    ...(beamMechanical ?? {}),
  }
}

// WAVE 4720: KINETIC ya no tiene un extractor estático — se llama desde _flush()
// pasando hasActivePattern en tiempo real. El resto de familias conservan el
// extractor estático (no dependen del estado del patrón).
const FAMILY_EXTRACTOR_STATIC: Record<
  Exclude<ProgrammerFamily, 'KINETIC'>,
  (ov: ProgrammerOverrides | undefined) => Record<string, number> | null
> = {
  IMPACT:  extractImpact,
  COLOR:   extractColor,
  BEAM:    extractBeam,
  EXTRAS:  extractUnifiedAtmosphere,
}

// ─────────────────────────────────────────────────────────────────────────────
// WAVE 4724: CELL-LAYER EXTRACTORS
// ─────────────────────────────────────────────────────────────────────────────
//
// Mapean un CellOverridePayload (estructurado por familia) al Record<string,
// number> canónico que entiende el NodeArbiter. Mismo contrato que los
// extractores legacy — el L2 no distingue de qué capa viene un override.
// ─────────────────────────────────────────────────────────────────────────────

/** Color cell → canales canónicos r/g/b/white/amber (WAVE 4715). */
function extractCellColor(data: ColorCellPayload): Record<string, number> | null {
  const ch: Record<string, number> = {}
  if (data.r     !== undefined) ch['r']     = data.r
  if (data.g     !== undefined) ch['g']     = data.g
  if (data.b     !== undefined) ch['b']     = data.b
  if (data.white !== undefined) ch['white'] = data.white
  if (data.amber !== undefined) ch['amber'] = data.amber
  return Object.keys(ch).length > 0 ? ch : null
}

/** Impact cell → dimmer/brightness alias (WAVE 4709) + strobe + shutter. */
function extractCellImpact(data: ImpactCellPayload): Record<string, number> | null {
  const ch: Record<string, number> = {}
  if (data.dimmer !== undefined) {
    ch['dimmer']     = data.dimmer
    // WAVE 4709 HOTFIX: alias brightness para PARs RGB sin canal dimmer físico
    ch['brightness'] = data.dimmer
  }
  if (data.strobe  !== undefined) ch['strobe']  = data.strobe
  if (data.shutter !== undefined) ch['shutter'] = data.shutter
  // limit NO viaja por L2 — usa IPC dedicado setInhibitLimit (igual que legacy)
  return Object.keys(ch).length > 0 ? ch : null
}

/** Beam cell → focus/zoom/iris/gobo/prism. */
function extractCellBeam(data: BeamCellPayload): Record<string, number> | null {
  const ch: Record<string, number> = {}
  if (data.focus !== undefined) ch['focus'] = data.focus
  if (data.zoom  !== undefined) ch['zoom']  = data.zoom
  if (data.iris  !== undefined) ch['iris']  = data.iris
  if (data.gobo  !== undefined) ch['gobo']  = data.gobo
  if (data.prism !== undefined) ch['prism'] = data.prism
  return Object.keys(ch).length > 0 ? ch : null
}

/**
 * Kinetic cell → respeta hasActivePattern (WAVE 4718).
 * Con patrón activo: solo speed y rotation (pan/tilt los gestiona el
 * AetherKineticEngine como anchor del Radar).
 * Sin patrón: pan/tilt absolutos LTP + speed + rotation.
 * targetX/Y/Z: emitidos siempre que estén presentes (ruta IK pura).
 */
function extractCellKinetic(data: KineticCellPayload, hasActivePattern: boolean): Record<string, number> | null {
  const ch: Record<string, number> = {}
  const hasSpatialTarget = data.targetX !== undefined && data.targetY !== undefined && data.targetZ !== undefined
  if (hasSpatialTarget) {
    ch['targetX'] = data.targetX!
    ch['targetY'] = data.targetY!
    ch['targetZ'] = data.targetZ!
  } else if (!hasActivePattern) {
    if (data.pan  !== undefined) ch['pan']  = data.pan
    if (data.tilt !== undefined) ch['tilt'] = data.tilt
  }
  if (data.speed    !== undefined) ch['speed']    = data.speed
  if (data.rotation !== undefined) ch['rotation'] = data.rotation
  return Object.keys(ch).length > 0 ? ch : null
}

/** Atmosphere/extras cell → ReadonlyMap<key, value> → Record. */
function extractCellAtmosphere(data: ReadonlyMap<string, number>): Record<string, number> | null {
  if (data.size === 0) return null
  const ch: Record<string, number> = {}
  for (const [key, value] of data) {
    ch[key] = value
  }
  return ch
}

/**
 * Despachador único de payload de célula.
 * Switch exhaustivo sobre `family` — type-safe sin casts en runtime.
 */
function extractCellPayload(payload: CellOverridePayload, hasActivePattern: boolean): Record<string, number> | null {
  switch (payload.family) {
    case NodeFamily.COLOR:      return extractCellColor(payload.data)
    case NodeFamily.IMPACT:     return extractCellImpact(payload.data)
    case NodeFamily.BEAM:       return extractCellBeam(payload.data)
    case NodeFamily.KINETIC:    return extractCellKinetic(payload.data, hasActivePattern)
    case NodeFamily.ATMOSPHERE: return extractCellAtmosphere(payload.data)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BRIDGE CLASS
// ─────────────────────────────────────────────────────────────────────────────

class ProgrammerAetherBridgeClass {
  private _intervalId: ReturnType<typeof setInterval> | null = null
  private _started = false

  /**
   * Inicia el puente. Sólo puede llamarse una vez.
   * Debe llamarse tras la creación del renderer (después de que
   * window.lux.aether esté disponible).
   */
  start(): void {
    if (this._started) {
      console.warn('[ProgrammerAetherBridge] Ya iniciado, ignorando start()')
      return
    }
    this._started = true
    this._intervalId = setInterval(() => this._flush(), TICK_INTERVAL_MS)
    console.log('[ProgrammerAetherBridge] ⚡ Iniciado @ 44Hz')
  }

  /** Detiene el bridge. Para limpieza en unmount o tests. */
  stop(): void {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId)
      this._intervalId = null
    }
    this._started = false
    console.log('[ProgrammerAetherBridge] Detenido')
  }

  /**
   * Tick de 44Hz.
   *
   * WAVE 4724: Drenaje en DOS FASES:
   *   1. CELL FASE: itera `dirtyCells` + `pendingClearNodeIds` y emite a los
   *      nodeIds reales de cada célula. Registra `coveredNodeIds` con cada
   *      nodeId tocado.
   *   2. LEGACY FASE: itera `dirtyFamilies` × `fixtureOverrides` y emite a los
   *      nodeIds canónicos `<fixtureId>:<familyLabel>`, EXCLUYENDO los que ya
   *      están en `coveredNodeIds` para evitar dobles escrituras.
   *
   * Ambos buckets se mergean por nodeId al final, IPC en una sola llamada,
   * y los callbacks de consumo se invocan SOLO si el IPC fue exitoso.
   */
  private _flush(): void {
    const state = useProgrammerStore.getState()
    const {
      fixtureOverrides, dirtyFamilies, activeFixtureIds,
      cellOverrides, dirtyCells, pendingClearNodeIds,
    } = state

    const hasLegacyWork = dirtyFamilies.size > 0
    const hasCellWork   = dirtyCells.size > 0 || pendingClearNodeIds.size > 0

    if (!hasLegacyWork && !hasCellWork) {
      return
    }

    const aether = window.lux?.aether
    if (!aether) {
      // Si IPC no está disponible aún, no consumimos los dirty flags —
      // se reintentará en el próximo tick.
      return
    }

    // WAVE 4720: leer el patrón activo del movementStore en este tick exacto.
    // Determina si emitimos pan/tilt (absoluto) o pan_base/tilt_base (orbit).
    const activePattern = useMovementStore.getState().activePattern
    const hasActivePattern = activePattern !== 'none' && activePattern !== 'static'

    const dirtySnapshot = new Set(dirtyFamilies)
    const setPayloads: Array<{ nodeId: string; channels: Record<string, number> }> = []
    const clearNodeIds: string[] = []

    // ════════════════════════════════════════════════════════════════════
    // FASE 1: CELL LAYER (WAVE 4724) — prioridad sobre legacy
    // ════════════════════════════════════════════════════════════════════
    // Snapshot mínimo para que el callback de consumo no borre cells nuevas
    // marcadas como dirty entre el flush y el resolve del IPC.
    const dirtyCellsSnapshot: CellKey[] = []
    const pendingClearsSnapshot: string[] = []
    /**
     * Set de nodeIds tocados por la fase cell — usado para excluir el legacy.
     * Allocación local del tick, descartada al final.
     */
    const coveredNodeIds = new Set<string>()

    if (dirtyCells.size > 0) {
      // Iteración nativa sobre Set — sin conversión a array, sin filter
      for (const cellKey of dirtyCells) {
        dirtyCellsSnapshot.push(cellKey)
        const cell: CellOverride | undefined = cellOverrides.get(cellKey)
        if (!cell) continue  // protección defensiva (race window)

        const channels = extractCellPayload(cell.payload, hasActivePattern)

        // Emitir a TODOS los nodeIds de la célula (twin-selection: N>1)
        for (const nodeId of cell.nodeIds) {
          coveredNodeIds.add(nodeId)
          if (channels !== null) {
            setPayloads.push({ nodeId, channels })
          } else {
            // Payload vacío = liberar este nodo
            clearNodeIds.push(nodeId)
          }
        }
      }
    }

    if (pendingClearNodeIds.size > 0) {
      for (const nodeId of pendingClearNodeIds) {
        pendingClearsSnapshot.push(nodeId)
        coveredNodeIds.add(nodeId)
        clearNodeIds.push(nodeId)
      }
    }

    // ════════════════════════════════════════════════════════════════════
    // FASE 2: LEGACY LAYER — emite solo a nodeIds NO cubiertos por la fase cell
    // ════════════════════════════════════════════════════════════════════
    // Persistencia L2: selection es UI-only.
    // El flush recorre todos los fixtures con estado de override persistido,
    // más la selección actual para poder inicializar fixtures nuevos.
    // Solo se construye si hay trabajo legacy real.
    let flushFixtureCount = 0
    if (hasLegacyWork) {
      const flushFixtureIds = new Set<string>(activeFixtureIds)
      for (const fixtureId of fixtureOverrides.keys()) {
        flushFixtureIds.add(fixtureId)
      }
      flushFixtureCount = flushFixtureIds.size

      for (const fixtureId of flushFixtureIds) {
        const ov = fixtureOverrides.get(fixtureId)

        for (const family of dirtySnapshot) {
          const nodeId = `${fixtureId}:${FAMILY_LABEL[family]}`
          // WAVE 4720: KINETIC usa extractor dinámico (depende de hasActivePattern).
          // El resto usan el mapa estático.
          const channels = family === 'KINETIC'
            ? (ov ? extractUnifiedKinetic(ov, hasActivePattern) : null)
            : (ov ? FAMILY_EXTRACTOR_STATIC[family as Exclude<ProgrammerFamily, 'KINETIC'>](ov) : null)

          // WAVE 4724: si la cell layer ya escribió a este nodeId, saltamos.
          if (!coveredNodeIds.has(nodeId)) {
            if (channels !== null) {
              setPayloads.push({ nodeId, channels })
            } else {
              // Sin canales activos = liberar el nodo completamente
              clearNodeIds.push(nodeId)
            }
          }

          // WAVE 4708: BEAM split.
          // gobo/prism se enrutan al nodo cuarentenado :atmosphere
          // para control explícito L2/L3, fuera del loop automático de IA.
          if (family === 'BEAM') {
            const extrasNodeId = `${fixtureId}:atmosphere`
            if (!coveredNodeIds.has(extrasNodeId)) {
              const mechanicalCh = ov ? extractUnifiedAtmosphere(ov) : null
              if (mechanicalCh !== null) {
                setPayloads.push({ nodeId: extrasNodeId, channels: mechanicalCh })
              } else {
                clearNodeIds.push(extrasNodeId)
              }
            }
          }

          // 🌊 WAVE 4701 M1: EXTRAS kinetic split.
          // Canales tipo rotation/speed pertenecen al nodo :kinetic, no :atmosphere.
          // Se despachan como un override L2 separado sobre el nodeId correcto.
          // WAVE 4720: hasActivePattern no afecta rotation/speed (solo pan/tilt),
          // pero pasamos el flag por consistencia con la firma actualizada.
          if (family === 'EXTRAS') {
            const kineticNodeId = `${fixtureId}:kinetic`
            if (!coveredNodeIds.has(kineticNodeId)) {
              const kineticCh = ov ? extractUnifiedKinetic(ov, hasActivePattern) : null
              if (kineticCh !== null) {
                setPayloads.push({ nodeId: kineticNodeId, channels: kineticCh })
              } else {
                clearNodeIds.push(kineticNodeId)
              }
            }
          }
        }
      }
    }

    const mergedByNodeId = new Map<string, Record<string, number>>()
    for (const payload of setPayloads) {
      const prev = mergedByNodeId.get(payload.nodeId)
      if (prev) {
        mergedByNodeId.set(payload.nodeId, { ...prev, ...payload.channels })
      } else {
        mergedByNodeId.set(payload.nodeId, { ...payload.channels })
      }
    }

    const finalSetPayloads = Array.from(mergedByNodeId.entries()).map(([nodeId, channels]) => ({ nodeId, channels }))

    const finalClearNodeIds = Array.from(new Set(clearNodeIds)).filter(nodeId => !mergedByNodeId.has(nodeId))

    const requests: Array<Promise<unknown>> = []

    if (finalSetPayloads.length > 0) {
      requests.push(aether.setManualOverrides(finalSetPayloads))
    }

    if (finalClearNodeIds.length > 0) {
      requests.push(aether.clearManualOverrides(finalClearNodeIds))
    }

    // Helper: consumir TODAS las dirty queues (legacy + cell) tras éxito.
    // WAVE 4724: las tres queues son independientes y se drenan por separado.
    const drainDirtyQueues = () => {
      const store = useProgrammerStore.getState()
      if (hasLegacyWork) {
        store.consumeDirtyFamilies(Array.from(dirtySnapshot))
      }
      if (dirtyCellsSnapshot.length > 0) {
        store.consumeDirtyCells(dirtyCellsSnapshot)
      }
      if (pendingClearsSnapshot.length > 0) {
        store.consumePendingClearNodeIds(pendingClearsSnapshot)
      }
    }

    // Nada que enviar: limpiar el snapshot para no dejar dirty zombie.
    if (requests.length === 0) {
      drainDirtyQueues()
      return
    }

    Promise.all(requests)
      .then(() => {
        // Limpia solo las queues del snapshot enviado con éxito.
        drainDirtyQueues()
      })
      .catch((err: unknown) => {
        const dirtyFamiliesList = Array.from(dirtySnapshot)
        const setCount = finalSetPayloads.length
        const clearCount = finalClearNodeIds.length
        const cellCount = dirtyCellsSnapshot.length
        console.warn(
          `[AetherBridge] ⚠️ L2 Update Dropped/Retrying | fixtures=${flushFixtureCount} cells=${cellCount} set=${setCount} clear=${clearCount} families=${dirtyFamiliesList.join(',')}`,
        )
        console.error('[ProgrammerAetherBridge] IPC flush error (will retry next tick):', err)
      })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export const ProgrammerAetherBridge = new ProgrammerAetherBridgeClass()
