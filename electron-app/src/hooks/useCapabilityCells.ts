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
  NodeFamily,
  type DeviceId,
  type NodeId,
} from '../stores/programmer-types'
import type { ICapabilityNode } from '../core/aether/capability-node'
import type { FixtureV2 } from '../core/stage/ShowFileV2'
import { NodeExtractionPipeline } from '../core/aether/ingestion/NodeExtractionPipeline'

// ─────────────────────────────────────────────────────────────────────────────
// PIPELINE SINGLETON — stateless, instanciado una vez por módulo
// ─────────────────────────────────────────────────────────────────────────────

const pipeline = new NodeExtractionPipeline()

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
    const label = suffixToLabel(suffix, family)

    descriptors.push({
      cellKey,
      family,
      nodeIds: Object.freeze([node.nodeId]) as readonly NodeId[],
      deviceId,
      fixtureId: deviceId,
      role,
      label,
      cellIndex,
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
export function useCapabilityCells(selectedIds: readonly string[]): DeviceCells[] {
  const stageFixtures = useStageStore(state => {
    if (state.fixtures && state.fixtures.length > 0) return state.fixtures
    if (state.showFile?.fixtures && state.showFile.fixtures.length > 0) return state.showFile.fixtures
    return []
  })

  const getLibraryFixtureById = useLibraryStore(state => state.getFixtureById)
  const libraryLastLoadTime   = useLibraryStore(state => state.lastLoadTime)
  const registerFixtureCells  = useProgrammerStore(state => state.registerFixtureCells)
  const unregisterDeviceCells = useProgrammerStore(state => state.unregisterDeviceCells)

  // Memokey: ids + stageFixtures count + library load time
  const memoKey = selectedIds.join(',') + '|' + stageFixtures.length + '|' + libraryLastLoadTime

  const deviceCells = useMemo(() => {
    if (selectedIds.length === 0) return []

    const result: DeviceCells[] = []

    for (const fixtureId of selectedIds) {
      // Buscar el FixtureV2 en stage
      const stageFix = stageFixtures.find((f: { id: string }) => f.id === fixtureId) as FixtureV2 | undefined
      if (!stageFix) continue

      // Resolver el perfil de librería
      const libraryFix = stageFix.profileId ? getLibraryFixtureById(stageFix.profileId) : null

      if (!libraryFix) {
        result.push({
          deviceId: fixtureId as DeviceId,
          fixtureId,
          fixtureName: stageFix.name ?? fixtureId,
          fixtureType: stageFix.type ?? 'generic',
          cells: [],
        })
        continue
      }

      // NodeExtractionPipeline produce los mismos ICapabilityNode[] que Aether backend
      const deviceDef = pipeline.extract(libraryFix, stageFix)
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
