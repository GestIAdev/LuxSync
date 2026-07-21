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
// Each group gets userData.fixtureId and pointer event handlers
// so DragDropController3D can intercept clicks, hover, and context menu.
// ═══════════════════════════════════════════════════════════════════════════

interface FixtureLayer3DProps {
  onPointerDown?: (e: any) => void
  onPointerOver?: (e: any) => void
  onPointerOut?: (e: any) => void
  onContextMenu?: (e: any) => void
}

export const FixtureLayer3D: React.FC<FixtureLayer3DProps> = ({
  onPointerDown,
  onPointerOver,
  onPointerOut,
  onContextMenu,
}) => {
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
            onPointerDown={onPointerDown}
            onPointerOver={onPointerOver}
            onPointerOut={onPointerOut}
            onContextMenu={onContextMenu}
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
    [fixtures, selectedIds, onPointerDown, onPointerOver, onPointerOut, onContextMenu],
  )

  return <>{renderedFixtures}</>
}

export default FixtureLayer3D
