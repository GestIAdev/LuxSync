/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🦎 USE CAPABILITY CELLS — WAVE 4725: CAMALEÓN UI LAYER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Hook que traduce `selectedFixtureIds[]` → `CellDescriptor[]` agrupados
 * por deviceId, listos para rendir en `DeviceCellGroup`.
 *
 * FLUJO:
 *   1. Para cada fixtureId seleccionado, resolve el perfil (LibraryFixture)
 *      desde libraryStore.getFixtureById(fixture.profileId)
 *   2. Recorre los nodos `output_dmx` del IForgeNodeGraph del perfil
 *   3. Agrupa por aetherNodeId (o sufijo inferido desde channelType)
 *   4. Para cada grupo → infer familia → construir CellDescriptor
 *   5. Llama registerFixtureCells(descriptors) para notificar al store
 *   6. Retorna Map<deviceId, CellDescriptor[]> para DeviceCellGroup
 *
 * INVARIANTES:
 * - CellKey = `${fixtureId}:${aetherSuffix}` — idéntico al NodeId del backend
 * - makeCellKey nunca se llama en hot path
 * - Memoizado sobre selectedIds.join(',') + stageFixtures length
 *
 * @module hooks/useCapabilityCells
 * @version WAVE 4725
 */

import { useMemo, useEffect, useRef } from 'react'
import { useStageStore } from '../stores/stageStore'
import { useLibraryStore } from '../stores/libraryStore'
import { useProgrammerStore } from '../stores/programmerStore'
import {
  makeCellKey,
  type CellDescriptor,
  NodeFamily,
  type DeviceId,
  type NodeId,
} from '../stores/programmer-types'
import type { IForgeNodeGraph, IOutputDmxConfig } from '../core/forge/types'

// ─────────────────────────────────────────────────────────────────────────────
// CHANNEL TYPE → FAMILIA — Replica la lógica de NodeExtractionPipeline
// sin importar el módulo (que es backend-only)
// ─────────────────────────────────────────────────────────────────────────────

const COLOR_TYPES = new Set([
  'red', 'green', 'blue', 'white', 'amber', 'uv',
  'cyan', 'magenta', 'yellow', 'color_wheel',
])
const IMPACT_TYPES = new Set(['dimmer', 'strobe', 'shutter'])
const KINETIC_TYPES = new Set(['pan', 'pan_fine', 'tilt', 'tilt_fine', 'speed', 'rotation'])
const BEAM_TYPES = new Set(['focus', 'zoom', 'frost'])

function inferAetherSuffix(channelType: string): string {
  if (COLOR_TYPES.has(channelType))    return 'color'
  if (IMPACT_TYPES.has(channelType))   return 'impact'
  if (KINETIC_TYPES.has(channelType))  return 'kinetic'
  if (BEAM_TYPES.has(channelType))     return 'beam'
  return 'atmosphere'
}

function inferFamilyFromSuffix(suffix: string): NodeFamily {
  switch (suffix) {
    case 'color':      return NodeFamily.COLOR
    case 'impact':     return NodeFamily.IMPACT
    case 'kinetic':    return NodeFamily.KINETIC
    case 'beam':       return NodeFamily.BEAM
    default:           return NodeFamily.ATMOSPHERE
  }
}

/**
 * Para sufijos no estándar (multi-node fixtures como fans/tungsteno:petal-1)
 * necesitamos determinar la familia desde los channelTypes del grupo.
 */
function inferFamilyFromChannelTypes(channelTypes: Set<string>): NodeFamily {
  const all = [...channelTypes]
  if (all.every(t => COLOR_TYPES.has(t)))                     return NodeFamily.COLOR
  if (all.some(t => IMPACT_TYPES.has(t)))                     return NodeFamily.IMPACT
  if (all.some(t => KINETIC_TYPES.has(t)))                    return NodeFamily.KINETIC
  if (all.some(t => BEAM_TYPES.has(t)))                       return NodeFamily.BEAM
  return NodeFamily.ATMOSPHERE
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
  // Para sufijos estándar
  if (['color','impact','kinetic','beam','atmosphere'].includes(suffix)) {
    return FAMILY_DEFAULT_LABEL[family]
  }
  // Para sufijos custom (ej: petal-1, wash, master-1) → capitalize
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
  // Sufijo puede ser "petal-1" → base = "petal"
  const base = suffix.replace(/-\d+$/, '')
  return predefined[base] ?? FAMILY_DEFAULT_ROLE[family]
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE: Extrae CellDescriptors desde un IForgeNodeGraph
// ─────────────────────────────────────────────────────────────────────────────

interface ForgeGroup {
  suffix: string
  channelTypes: Set<string>
}

function extractCellDescriptors(
  fixtureId: string,
  nodeGraph: IForgeNodeGraph,
): CellDescriptor[] {
  const deviceId = fixtureId as DeviceId

  // 1. Recoger nodos output_dmx
  const outputNodes = nodeGraph.nodes.filter(
    n => n.type === 'output_dmx' && n.config.nodeType === 'output_dmx',
  )
  if (outputNodes.length === 0) return []

  // 2. Agrupar por aetherNodeId (o sufijo inferido)
  const groups = new Map<string, ForgeGroup>()
  for (const node of outputNodes) {
    const cfg = node.config as IOutputDmxConfig
    const suffix = cfg.aetherNodeId ?? inferAetherSuffix(cfg.channelType)
    const group = groups.get(suffix)
    if (group) {
      group.channelTypes.add(cfg.channelType)
    } else {
      groups.set(suffix, { suffix, channelTypes: new Set([cfg.channelType]) })
    }
  }

  // 3. Construir CellDescriptor por grupo
  const descriptors: CellDescriptor[] = []
  let cellIndex = 0
  for (const [suffix, group] of groups) {
    // Determinar familia
    const stdFamily = inferFamilyFromSuffix(suffix)
    // Si el sufijo no es estándar, inferir desde los channelTypes
    const family = stdFamily !== NodeFamily.ATMOSPHERE
      ? stdFamily
      : inferFamilyFromChannelTypes(group.channelTypes)

    const nodeId = `${deviceId}:${suffix}` as NodeId
    const cellKey = makeCellKey(deviceId, suffix)
    const role = suffixToRole(suffix, family)
    const label = suffixToLabel(suffix, family)

    descriptors.push({
      cellKey,
      family,
      nodeIds: Object.freeze([nodeId]) as readonly NodeId[],
      deviceId,
      fixtureId: deviceId,
      role,
      label,
      cellIndex,
    })
    cellIndex++
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
export function useCapabilityCells(selectedIds: readonly string[]): DeviceCells[] {
  const stageFixtures = useStageStore(state => {
    if (state.fixtures && state.fixtures.length > 0) return state.fixtures
    if (state.showFile?.fixtures && state.showFile.fixtures.length > 0) return state.showFile.fixtures
    return []
  })

  const getLibraryFixtureById = useLibraryStore(state => state.getFixtureById)
  const registerFixtureCells  = useProgrammerStore(state => state.registerFixtureCells)
  const unregisterDeviceCells = useProgrammerStore(state => state.unregisterDeviceCells)

  // Memokey: join de ids + cantidad de stageFixtures (cobertura contra reloads)
  const memoKey = selectedIds.join(',') + '|' + stageFixtures.length

  const deviceCells = useMemo(() => {
    if (selectedIds.length === 0) return []

    const result: DeviceCells[] = []

    for (const fixtureId of selectedIds) {
      // Buscar el FixtureV2 en stage
      const stageFix = stageFixtures.find((f: { id: string }) => f.id === fixtureId)
      if (!stageFix) continue

      // Resolver el perfil de librería para obtener el IForgeNodeGraph
      const profileId = (stageFix as { profileId?: string }).profileId
      const libraryFix = profileId ? getLibraryFixtureById(profileId) : null

      let nodeGraph: IForgeNodeGraph | undefined

      if (libraryFix?.nodeGraph) {
        nodeGraph = libraryFix.nodeGraph
      } else if (libraryFix) {
        // Fallback: crear nodeGraph desde channels[] usando el mismo patrón que libraryStore
        const { NodeGraphBuilder } = require('../core/forge/NodeGraphBuilder') as typeof import('../core/forge/NodeGraphBuilder')
        const channels = (libraryFix as any).channels ?? []
        if (channels.length > 0) {
          nodeGraph = NodeGraphBuilder.fromChannels(channels)
        }
      }

      if (!nodeGraph) {
        // Sin nodeGraph ni channels: celdas vacías — fallback legacy
        result.push({
          deviceId: fixtureId as DeviceId,
          fixtureId,
          fixtureName: (stageFix as { name?: string }).name ?? fixtureId,
          fixtureType: (stageFix as { type?: string }).type ?? 'generic',
          cells: [],
        })
        continue
      }

      const descriptors = extractCellDescriptors(fixtureId, nodeGraph)

      result.push({
        deviceId: fixtureId as DeviceId,
        fixtureId,
        fixtureName: (stageFix as { name?: string }).name ?? fixtureId,
        fixtureType: (stageFix as { type?: string }).type ?? 'generic',
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

    // Desregistrar fixtures que salieron de la selección
    for (const prevId of prevSelected) {
      if (!currentSelected.has(prevId)) {
        unregisterDeviceCells(prevId as DeviceId)
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
  }, [deviceCells, selectedIds, registerFixtureCells, unregisterDeviceCells])

  return deviceCells
}
