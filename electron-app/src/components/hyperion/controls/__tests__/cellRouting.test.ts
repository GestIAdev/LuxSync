import { describe, it, expect } from 'vitest'

import { partitionGroupsForRouting } from '../cellRouting'
import { NodeFamily } from '../../../../stores/programmer-types'
import type { AggregatedCellGroup, CellKey, CellOverride } from '../../../../stores/programmer-types'

const CELL_KEY = 'fixture-1:beam' as CellKey

function makeGroup(
  family: NodeFamily,
  role: string,
  label = 'Beam',
): AggregatedCellGroup {
  return {
    groupKey: `${family}:${role}:${label}`,
    family,
    role,
    label,
    cellKeys: Object.freeze([CELL_KEY]),
    nodeIds: Object.freeze(['fixture-1:beam']),
    cellCount: 1,
    deviceCount: 1,
  }
}

describe('cellRouting BEAM gating contract', () => {
  it('routes BEAM role primary as routable without needing overrides', () => {
    const beamPrimary = makeGroup(NodeFamily.BEAM, 'primary', 'Haz')

    const result = partitionGroupsForRouting([beamPrimary], () => undefined)

    expect(result.routable).toHaveLength(1)
    expect(result.routable[0].groupKey).toBe(beamPrimary.groupKey)
    expect(result.skipped).toHaveLength(0)
  })

  it('routes BEAM role decoration as routable', () => {
    const beamDecoration = makeGroup(NodeFamily.BEAM, 'decoration', 'Haz')

    const result = partitionGroupsForRouting([beamDecoration], () => undefined)

    expect(result.routable).toHaveLength(1)
    expect(result.routable[0].groupKey).toBe(beamDecoration.groupKey)
  })

  it('keeps non-optical BEAM role skipped when no override exists', () => {
    const beamAmbient = makeGroup(NodeFamily.BEAM, 'ambient', 'Haz')

    const result = partitionGroupsForRouting([beamAmbient], () => undefined)

    expect(result.routable).toHaveLength(0)
    expect(result.skipped).toHaveLength(1)
    expect(result.skipped[0].groupKey).toBe(beamAmbient.groupKey)
  })

  it('routes non-optical BEAM role when BEAM override exists', () => {
    const beamAmbient = makeGroup(NodeFamily.BEAM, 'ambient', 'Haz')
    const beamOverride: CellOverride = {
      cellKey: CELL_KEY,
      nodeIds: Object.freeze(['fixture-1:beam']),
      deviceId: 'fixture-1',
      payload: {
        family: NodeFamily.BEAM,
        data: { zoom: 0.5 },
      },
      lastWriteMs: Date.now(),
    }

    const result = partitionGroupsForRouting([beamAmbient], () => beamOverride)

    expect(result.routable).toHaveLength(1)
    expect(result.skipped).toHaveLength(0)
  })
})
