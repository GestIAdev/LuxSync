/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧠 USE AGGREGATED CAPABILITY CELLS — WAVE 4731: HIVE MIND
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * En lugar de un panel por device, devuelve UN solo grupo por capacidad
 * compartida entre todos los fixtures seleccionados.
 *
 * Signature de agrupación: `${family}:${role}:${label}`
 * Orden de salida: primer-aparece-primero (Map preserva inserción).
 *
 * Seleccionar 10 PARs → 1 grupo COLOR + 1 grupo IMPACT,
 * cada uno con los 10 cellKeys apuntando a los 10 fixtures.
 *
 * @module hooks/useAggregatedCapabilityCells
 * @version WAVE 4731
 */

import { useMemo } from 'react'
import type { AggregatedCellGroup, CellKey, NodeId } from '../stores/programmer-types'
import { useCapabilityCells } from './useCapabilityCells'

export function useAggregatedCapabilityCells(selectedIds: readonly string[]): AggregatedCellGroup[] {
  const deviceCells = useCapabilityCells(selectedIds)

  return useMemo(() => {
    if (deviceCells.length === 0) return []

    type GroupEntry = {
      family:    AggregatedCellGroup['family']
      role:      AggregatedCellGroup['role']
      label:     string
      cellKeys:  CellKey[]
      nodeIds:   NodeId[]
      deviceIds: Set<string>
    }

    // Map preserva orden de inserción = primer-aparece-primero
    const map = new Map<string, GroupEntry>()

    for (const dc of deviceCells) {
      for (const cell of dc.cells) {
        const sig = `${String(cell.family)}:${cell.role}:${cell.label}`
        let entry = map.get(sig)
        if (!entry) {
          entry = {
            family:    cell.family,
            role:      cell.role,
            label:     cell.label,
            cellKeys:  [],
            nodeIds:   [],
            deviceIds: new Set(),
          }
          map.set(sig, entry)
        }
        entry.cellKeys.push(cell.cellKey)
        for (const nid of cell.nodeIds) entry.nodeIds.push(nid)
        entry.deviceIds.add(dc.deviceId)
      }
    }

    const result: AggregatedCellGroup[] = []
    for (const [groupKey, g] of map) {
      result.push({
        groupKey,
        family:      g.family,
        role:        g.role,
        label:       g.label,
        cellKeys:    Object.freeze([...g.cellKeys]) as readonly CellKey[],
        nodeIds:     Object.freeze([...g.nodeIds])  as readonly NodeId[],
        cellCount:   g.cellKeys.length,
        deviceCount: g.deviceIds.size,
      })
    }

    return result
  }, [deviceCells])
}
