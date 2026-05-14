/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🦎 USE CAPABILITY CELLS — WAVE 4727: VIP BOUNCER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Hook que traduce `selectedFixtureIds[]` → `CellDescriptor[]` agrupados
 * por deviceId, listos para rendir en `DeviceCellGroup`.
 *
 * FLUJO:
 *   1. Para cada fixtureId seleccionado, resolve el perfil (LibraryFixture)
 *      desde libraryStore.getFixtureById(fixture.profileId)
 *   2. Ejecuta NodeExtractionPipeline.extract(libraryFix, stageFix) para
 *      obtener IDeviceDefinition.nodes (ICapabilityNode[] runtime-hidratados)
 *   3. Mapea cada ICapabilityNode → CellDescriptor directamente
 *   4. Llama registerFixtureCells(descriptors) para notificar al store
 *   5. Retorna DeviceCells[] agrupados por fixture para DeviceCellGroup
 *
 * INVARIANTES:
 * - CellKey = `${fixtureId}:${aetherSuffix}` — idéntico al NodeId del backend
 * - makeCellKey nunca se llama en hot path
 * - Memoizado sobre selectedIds + stageFixtures.length + library lastLoadTime
 * - NodeExtractionPipeline instancia única a nivel de módulo (stateless)
 *
 * @module hooks/useCapabilityCells
 * @version WAVE 4727
 */

import { useMemo, useEffect, useRef } from 'react'
import { useStageStore } from '../stores/stageStore'
import { useLibraryStore } from '../stores/libraryStore'
import { useProgrammerStore } from '../stores/programmerStore'
import {
  makeCellKey,
  type CellDescriptor,
  type AggregatedCellGroup,
  type CellKey,
  type EmbeddedImpactChannelType,
  NodeFamily,
  type DeviceId,
  type NodeId,
} from '../stores/programmer-types'
import type { ICapabilityNode } from '../core/aether/capability-node'
import type { FixtureV2 } from '../core/stage/ShowFileV2'
import type { FixtureDefinition, FixtureChannel, FixtureType } from '../types/FixtureDefinition'
import { NodeExtractionPipeline } from '../core/aether/ingestion/NodeExtractionPipeline'
import { WELL_KNOWN_LABELS } from '../components/hyperion/controls/cellLabels'

// ─────────────────────────────────────────────────────────────────────────────
// PIPELINE SINGLETON — stateless, instanciado una vez por módulo
// ─────────────────────────────────────────────────────────────────────────────

const pipeline = new NodeExtractionPipeline()

// ─────────────────────────────────────────────────────────────────────────────
// SYNTHETIC FALLBACK — genera FixtureDefinition mínima desde FixtureV2
//
// Cuando una fixture tiene profileId que no existe en la librería (ej: la
// constante por defecto "generic-dimmer"), este helper sintetiza canales DMX
// plausibles basándose en el tipo de fixture y su channelCount.
// NodeExtractionPipeline puede procesar el resultado igual que un perfil real.
// ─────────────────────────────────────────────────────────────────────────────

function synthesizeFixtureDefinition(stageFix: FixtureV2): FixtureDefinition {
  const fixtureType = (stageFix.type ?? 'generic') as FixtureType
  const channelCount = (stageFix as { channelCount?: number }).channelCount ?? 1

  let channelTemplate: Omit<FixtureChannel, 'index'>[]

  switch (fixtureType) {
    case 'moving-head':
    case 'scanner':
      channelTemplate = [
        { name: 'Pan',    type: 'pan',    defaultValue: 128, is16bit: false },
        { name: 'Tilt',   type: 'tilt',   defaultValue: 128, is16bit: false },
        { name: 'Dimmer', type: 'dimmer', defaultValue: 0,   is16bit: false },
        { name: 'Red',    type: 'red',    defaultValue: 0,   is16bit: false },
        { name: 'Green',  type: 'green',  defaultValue: 0,   is16bit: false },
        { name: 'Blue',   type: 'blue',   defaultValue: 0,   is16bit: false },
        { name: 'Shutter',type: 'shutter',defaultValue: 255, is16bit: false },
        { name: 'Speed',  type: 'speed',  defaultValue: 128, is16bit: false },
      ]
      break
    case 'par':
    case 'wash':
    case 'blinder':
    case 'bar':
      channelTemplate = [
        { name: 'Dimmer', type: 'dimmer', defaultValue: 0, is16bit: false },
        { name: 'Red',    type: 'red',    defaultValue: 0, is16bit: false },
        { name: 'Green',  type: 'green',  defaultValue: 0, is16bit: false },
        { name: 'Blue',   type: 'blue',   defaultValue: 0, is16bit: false },
        { name: 'White',  type: 'white',  defaultValue: 0, is16bit: false },
        { name: 'Strobe', type: 'strobe', defaultValue: 0, is16bit: false },
      ]
      break
    case 'strobe':
    case 'effect':
      channelTemplate = [
        { name: 'Dimmer', type: 'dimmer', defaultValue: 0, is16bit: false },
        { name: 'Strobe', type: 'strobe', defaultValue: 0, is16bit: false },
        { name: 'Red',    type: 'red',    defaultValue: 0, is16bit: false },
        { name: 'Green',  type: 'green',  defaultValue: 0, is16bit: false },
        { name: 'Blue',   type: 'blue',   defaultValue: 0, is16bit: false },
      ]
      break
    default:
      // generic, fan, fog, laser, mirror-ball, pyro, unknown
      channelTemplate = [
        { name: 'Dimmer', type: 'dimmer', defaultValue: 0, is16bit: false },
      ]
      break
  }

  // Recortar al channelCount real para no asumir más canales de los que hay
  const channels: FixtureChannel[] = channelTemplate
    .slice(0, channelCount)
    .map((ch, idx) => ({ ...ch, index: idx }))

  // Si channelCount > template, rellenar con canales custom
  for (let i = channels.length; i < channelCount; i++) {
    channels.push({ index: i, name: `Ch${i + 1}`, type: 'custom', defaultValue: 0, is16bit: false })
  }

  return {
    id: stageFix.profileId ?? stageFix.id,
    name: stageFix.name ?? 'Generic Fixture',
    manufacturer: 'Generic',
    type: fixtureType,
    channels,
    capabilities: {},
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLE LABEL — Mapeadores para UI
// ─────────────────────────────────────────────────────────────────────────────

const FAMILY_DEFAULT_ROLE: Record<NodeFamily, string> = {
  [NodeFamily.COLOR]:      'primary',
  [NodeFamily.IMPACT]:     'primary',
  [NodeFamily.KINETIC]:    'primary',
  [NodeFamily.BEAM]:       'decoration',
  [NodeFamily.ATMOSPHERE]: 'atmosphere',
}

const FAMILY_DEFAULT_LABEL: Record<NodeFamily, string> = {
  [NodeFamily.COLOR]:      'Color',
  [NodeFamily.IMPACT]:     'Intensidad',
  [NodeFamily.KINETIC]:    'Cinética',
  [NodeFamily.BEAM]:       'Haz',
  [NodeFamily.ATMOSPHERE]: 'Extras',
}

function suffixToLabel(suffix: string, family: NodeFamily): string {
  if (['color','impact','kinetic','beam','atmosphere'].includes(suffix)) {
    return FAMILY_DEFAULT_LABEL[family]
  }
  // WAVE 4737: consultar WELL_KNOWN_LABELS con el suffix en kebab-case original
  // ANTES de humanizar, para que 'impact-golden' → 'Golden' (no 'Impact-Golden').
  const wellKnown = WELL_KNOWN_LABELS[suffix.toLowerCase()]
  if (wellKnown !== undefined) return wellKnown
  return suffix.replace(/-(\d+)$/, ' $1').replace(/\b\w/g, c => c.toUpperCase())
}

function suffixToRole(suffix: string, family: NodeFamily): string {
  const predefined: Record<string, string> = {
    'master':  'primary',
    'wash':    'primary',
    'petal':   'ambient',
    'beam':    'decoration',
    'rotor':   'percussion',
    'ambient': 'ambient',
  }
  const base = suffix.replace(/-\d+$/, '')
  return predefined[base] ?? FAMILY_DEFAULT_ROLE[family]
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE: Mapea ICapabilityNode[] → CellDescriptor[]
// ─────────────────────────────────────────────────────────────────────────────

function capabilityNodesToDescriptors(
  fixtureId: string,
  nodes: readonly ICapabilityNode[],
): CellDescriptor[] {
  const deviceId = fixtureId as DeviceId
  const descriptors: CellDescriptor[] = []

  for (let cellIndex = 0; cellIndex < nodes.length; cellIndex++) {
    const node = nodes[cellIndex]
    // nodeId format: "<deviceId>:<suffix>"
    const colonIdx = node.nodeId.indexOf(':')
    const suffix = colonIdx >= 0 ? node.nodeId.slice(colonIdx + 1) : node.nodeId
    const family = node.family
    const cellKey = makeCellKey(deviceId, suffix)
    const role = node.role ?? suffixToRole(suffix, family)
    // WAVE 4738: si el nodo lleva customLabel en profileMeta (Forja custom), lo usa directamente.
    // WAVE 4735.2: acceso directo con tipo seguro IProfileMetadata (sin bracket access ni typeof guard)
    const customLabel = node.profileMeta?.customLabel
    const label = (customLabel && customLabel.length > 0)
      ? customLabel
      : suffixToLabel(suffix, family)

    // WAVE 4743: Para nodos COLOR con canales de intensidad físicos (dimmer/strobe/shutter),
    // construir el set de canales embebidos. Esto permite a ColorBody mostrar los
    // InlineImpactRow ANTES de que exista un override (discovery desde la definición).
    let embeddedImpactChannels: Set<EmbeddedImpactChannelType> | undefined
    if (family === NodeFamily.COLOR) {
      for (const ch of node.channels) {
        if (ch.type === 'dimmer' || ch.type === 'strobe' || ch.type === 'shutter') {
          if (!embeddedImpactChannels) embeddedImpactChannels = new Set()
          embeddedImpactChannels.add(ch.type as EmbeddedImpactChannelType)
        }
      }
    }

    descriptors.push({
      cellKey,
      family,
      nodeIds: Object.freeze([node.nodeId]) as readonly NodeId[],
      deviceId,
      fixtureId: deviceId,
      role,
      label,
      cellIndex,
      ...(embeddedImpactChannels && embeddedImpactChannels.size > 0
        ? { embeddedImpactChannels: Object.freeze(embeddedImpactChannels) as ReadonlySet<EmbeddedImpactChannelType> }
        : {}),
    })
  }

  return descriptors
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC — DeviceCellGroup input type
// ─────────────────────────────────────────────────────────────────────────────

/** Agrupación de células por device, lista para rendir en DeviceCellGroup */
export interface DeviceCells {
  deviceId: DeviceId
  fixtureId: string
  fixtureName: string
  fixtureType: string
  cells: CellDescriptor[]
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK — useCapabilityCells
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resuelve las células de capacidad para los fixtures seleccionados y
 * registra los descriptors en el programmerStore.
 *
 * @param selectedIds — Array de fixture IDs seleccionados
 * @returns Array de DeviceCells agrupados (uno por fixture)
 */
// Referencia estable para el caso vacío — evita nueva referencia en cada render
const EMPTY_FIXTURES: never[] = []

export function useCapabilityCells(selectedIds: readonly string[]): DeviceCells[] {
  const stageFixtures = useStageStore(state => {
    if (state.fixtures && state.fixtures.length > 0) return state.fixtures
    if (state.showFile?.fixtures && state.showFile.fixtures.length > 0) return state.showFile.fixtures
    return EMPTY_FIXTURES
  })

  const getLibraryFixtureById = useLibraryStore(state => state.getFixtureById)
  const loadLibraryFromDisk   = useLibraryStore(state => state.loadFromDisk)
  const libraryIsLoading      = useLibraryStore(state => state.isLoading)
  const libraryFixtureCount   = useLibraryStore(state => state.systemFixtures.length + state.userFixtures.length)
  const libraryLastLoadTime   = useLibraryStore(state => state.lastLoadTime)
  const registerFixtureCells  = useProgrammerStore(state => state.registerFixtureCells)
  // 🛡️ WAVE 4730 TARGET 2: cleanup SUAVE en lugar de destructivo.
  // Cambiar selección NO debe borrar cellOverrides ni disparar clearManualOverrides.
  // forgetDeviceCatalog solo poda el directorio UI manteniendo overrides intactos
  // — al re-seleccionar el fixture, los valores persisten y la UI los re-hidrata.
  const forgetDeviceCatalog  = useProgrammerStore(state => state.forgetDeviceCatalog)

  // Hyperion puede abrirse sin pasar por Forge; auto-carga librería bajo demanda.
  useEffect(() => {
    if (selectedIds.length === 0) return
    if (libraryFixtureCount > 0) return
    if (libraryIsLoading) return
    void loadLibraryFromDisk()
  }, [selectedIds.length, libraryFixtureCount, libraryIsLoading, loadLibraryFromDisk])

  // Memokey: ids + stageFixtures count + library load time
  const memoKey = selectedIds.join(',') + '|' + stageFixtures.length + '|' + libraryLastLoadTime

  const deviceCells = useMemo(() => {
    if (selectedIds.length === 0) return []

    const result: DeviceCells[] = []

    for (const fixtureId of selectedIds) {
      // Buscar el FixtureV2 en stage
      const stageFix = stageFixtures.find((f: { id: string }) => f.id === fixtureId) as FixtureV2 | undefined
      if (!stageFix) {
          continue
      }

      // Resolver el perfil de librería; si no existe, sintetizar uno mínimo
      const libraryFix = stageFix.profileId ? getLibraryFixtureById(stageFix.profileId) : null

      // 🚨 WAVE 4728 FIX A — RACE CONDITION CONTRA LIBRARY LOAD
      // Si el fixture declara profileId pero la librería NO lo encontró todavía,
      // pueden pasar dos cosas:
      //   (a) loadFromDisk() async aún no terminó.
      //   (b) El profileId apunta a un perfil ausente en disco.
      // Sintetizar AHORA destruye los nodos custom del Tungsten
      // (4 COLOR petals + wash + beam + impact + kinetic → 1 IMPACT + 1 COLOR plano).
      // Política: si hay profileId, no se encontró, y la librería está cargando
      // o vacía, ABORTAR y esperar al siguiente render con la librería lista.
      if (
        stageFix.profileId &&
        !libraryFix &&
        (libraryIsLoading || libraryFixtureCount === 0)
      ) {
        continue
      }

      const fixtureDef = libraryFix ?? synthesizeFixtureDefinition(stageFix)

      // NodeExtractionPipeline produce los mismos ICapabilityNode[] que Aether backend
      const deviceDef = pipeline.extract(fixtureDef, stageFix)
      const descriptors = capabilityNodesToDescriptors(fixtureId, deviceDef.nodes)

      result.push({
        deviceId: fixtureId as DeviceId,
        fixtureId,
        fixtureName: stageFix.name ?? fixtureId,
        fixtureType: stageFix.type ?? 'generic',
        cells: descriptors,
      })
    }

    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoKey])

  // Registrar / limpiar en el store cuando cambia la selección
  const prevSelectedRef = useRef<readonly string[]>([])

  useEffect(() => {
    const prevSelected = prevSelectedRef.current
    const currentSelected = new Set(selectedIds)

    // 🛡️ WAVE 4730 TARGET 2: cleanup SUAVE — solo poda el directorio UI.
    // Los cellOverrides y nodeIds activos persisten en el store; el L2 sigue
    // recibiendo los manuales aunque el fixture salga de la selección visual.
    for (const prevId of prevSelected) {
      if (!currentSelected.has(prevId)) {
        forgetDeviceCatalog(prevId as DeviceId)
      }
    }

    // Registrar todos los descriptors de la selección actual
    const allDescriptors: CellDescriptor[] = []
    for (const dc of deviceCells) {
      allDescriptors.push(...dc.cells)
    }

    if (allDescriptors.length > 0) {
      registerFixtureCells(allDescriptors)
    }

    prevSelectedRef.current = selectedIds
  }, [deviceCells, selectedIds, registerFixtureCells, forgetDeviceCatalog])

  return deviceCells
}

// ─────────────────────────────────────────────────────────────────────────────
// WAVE 4730 TARGET 1 — HIVE MIND: AGGREGATED HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook de agregación por firma de capacidad.
 *
 * Reusa `useCapabilityCells` (que sigue resolviendo el catálogo por device)
 * y reorganiza la salida en grupos `AggregatedCellGroup` cuya identidad es
 * `${family}:${role}:${label}`.
 *
 * Caso típico:
 *   - 10 PARs LED seleccionados → 1 grupo `IMPACT:primary:Intensidad` con 10
 *     cellKeys + 1 grupo `COLOR:primary:Color` con 10 cellKeys.
 *   - Tungsten + 5 PARs seleccionados → grupos COMPARTIDOS para las
 *     capacidades coincidentes + grupos exclusivos del Tungsten (petals/wash/beam).
 *
 * La UI itera estos grupos y, en el onChange del slider/picker, despacha a
 * todos los cellKeys con un solo bucle:
 *
 * ```tsx
 * const onColorChange = (r,g,b) => {
 *   for (const key of group.cellKeys) setCellColor(key, r, g, b)
 * }
 * ```
 *
 * @param selectedIds — Array de fixture IDs seleccionados
 * @returns Array de AggregatedCellGroup (firma de capacidad compartida)
 */
export function useAggregatedCapabilityCells(
  selectedIds: readonly string[],
): AggregatedCellGroup[] {
  const deviceCells = useCapabilityCells(selectedIds)

  return useMemo(() => {
    interface MutableGroup {
      family: NodeFamily
      role: string
      label: string
      cellKeys: CellKey[]
      nodeIds: NodeId[]
      deviceSet: Set<DeviceId>
      embeddedImpactChannels: Set<EmbeddedImpactChannelType>
    }

    const groups = new Map<string, MutableGroup>()
    const groupOrder: string[] = []

    for (const dc of deviceCells) {
      for (const cell of dc.cells) {
        const groupKey = `${cell.family}:${cell.role}:${cell.label}`
        let entry = groups.get(groupKey)
        if (!entry) {
          entry = {
            family: cell.family,
            role: cell.role,
            label: cell.label,
            cellKeys: [],
            nodeIds: [],
            deviceSet: new Set(),
            embeddedImpactChannels: new Set<EmbeddedImpactChannelType>(),
          }
          groups.set(groupKey, entry)
          groupOrder.push(groupKey)
        }
        entry.cellKeys.push(cell.cellKey)
        for (const nid of cell.nodeIds) {
          entry.nodeIds.push(nid)
        }
        entry.deviceSet.add(cell.deviceId)
        // WAVE 4743: propagar canales de intensidad embebidos — unión de todas las cells.
        if (cell.embeddedImpactChannels) {
          for (const ch of cell.embeddedImpactChannels) {
            entry.embeddedImpactChannels.add(ch)
          }
        }
      }
    }

    const result: AggregatedCellGroup[] = []
    for (const groupKey of groupOrder) {
      const e = groups.get(groupKey)!
      const hasEmbedded = e.embeddedImpactChannels.size > 0
      result.push({
        groupKey,
        family: e.family,
        role: e.role,
        label: e.label,
        cellKeys: Object.freeze(e.cellKeys.slice()) as readonly CellKey[],
        nodeIds: Object.freeze(e.nodeIds.slice()) as readonly NodeId[],
        cellCount: e.cellKeys.length,
        deviceCount: e.deviceSet.size,
        ...(hasEmbedded
          ? { embeddedImpactChannels: Object.freeze(e.embeddedImpactChannels) as ReadonlySet<EmbeddedImpactChannelType> }
          : {}),
      })
    }
    return result
  }, [deviceCells])
}
