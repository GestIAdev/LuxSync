import React, { useMemo } from 'react'
import * as THREE from 'three'
import { useStageStore } from '../../../../../stores/stageStore'
import { useSelectionStore } from '../../../../../stores/selectionStore'
import { FixtureBody3D } from './FixtureBody3D'
import { FixtureGhost3D } from './FixtureGhost3D'

// ═══════════════════════════════════════════════════════════════════════════
// FixtureLayer3D — Renders all stage fixtures as 3D meshes
// PROYECTO EREBUS FASE 3 + HOTFIX 2
//
// Iterates stageStore.fixtures and renders each as either:
//   - FixtureBody3D (placed fixtures with position)
//   - FixtureGhost3D (unplaced fixtures, holographic float)
//
// Each mesh gets userData.fixtureId so DragDropController3D can raycast
// and intercept pointer events.
// ═══════════════════════════════════════════════════════════════════════════

export const FixtureLayer3D: React.FC = () => {
  const fixtures = useStageStore(s => s.fixtures)
  const selectedIds = useSelectionStore(s => s.selectedIds)

  const renderedFixtures = useMemo(
    () =>
      fixtures.map(f => {
        const isSelected = selectedIds.has(f.id)
        const isUnplaced = f.placementMode === 'unplaced' || !f.isPlaced
        const position: [number, number, number] = [
          f.position.x,
          f.position.y,
          f.position.z,
        ]
        const rotation: [number, number, number] = [
          f.rotation.pitch,
          f.rotation.yaw,
          f.rotation.roll,
        ]

        return (
          <group
            key={f.id}
            position={position}
            rotation={rotation}
            userData={{ fixtureId: f.id }}
          >
            {isUnplaced ? (
              <FixtureGhost3D
                position={[0, 0, 0]}
                fixtureType={f.type}
              />
            ) : (
              <FixtureBody3D
                position={[0, 0, 0]}
                selected={isSelected}
                fixtureType={f.type}
              />
            )}
          </group>
        )
      }),
    [fixtures, selectedIds],
  )

  return <>{renderedFixtures}</>
}

export default FixtureLayer3D
