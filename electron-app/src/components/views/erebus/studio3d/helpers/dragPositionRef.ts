import * as THREE from 'three'

/**
 * Shared mutable ref for live drag position.
 * Written by DragDropController3D during fixture drag (useFrame).
 * Read by SpatialGuides to update projection lines without store re-renders.
 *
 * null when no drag is active.
 */
export const dragPositionRef: { current: THREE.Vector3 | null } = {
  current: null,
}
