/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏗️ WAVE 7179 (M2) — Pure Placement Functions
 * Tests for computePlanarPlacement and clampElevation
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Valida:
 *   §1 — computePlanarPlacement sin rig: Y inferida de DEFAULT_ORIENTATION_HEIGHT
 *   §2 — computePlanarPlacement con rig: hereda height + orientation del rig
 *   §3 — computePlanarPlacement: placementMode siempre 'planar'
 *   §4 — clampElevation sin stage: snap-to-voxel + piso físico Y >= 0
 *   §5 — clampElevation con stage: clamp al Crystal Box [0, stage.height]
 *   §6 — clampElevation: snapping a múltiplos de 0.25 (VOXEL_SIZE)
 *
 * AXIOMA ANTI-SIMULACIÓN: Cero Math.random(). Datos deterministas.
 *
 * @module core/stage/__tests__/placement.test
 * @version WAVE 7179 M2
 */

import { describe, test, expect } from 'vitest'
import {
  computePlanarPlacement,
  clampElevation,
  DEFAULT_ORIENTATION_HEIGHT,
  VOXEL_SIZE,
} from '../ShowFileV2'
import type { RigV2, StageDimensions, InstallationOrientation } from '../ShowFileV2'

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURES — Test data builders
// ═══════════════════════════════════════════════════════════════════════════

const STAGE: StageDimensions = {
  width: 12,
  depth: 10,
  height: 6,
  gridSize: 0.25,
}

const RIG_TRUSS: RigV2 = {
  id: 'rig-truss-1',
  position: { x: 0, y: 5.0, z: -3 },
  height: 5.0,
  orientation: 'ceiling',
}

const RIG_TOTEM: RigV2 = {
  id: 'rig-totem-1',
  position: { x: -4, y: 1.5, z: 2 },
  height: 1.5,
  orientation: 'totem',
}

// ═══════════════════════════════════════════════════════════════════════════
// §1 — computePlanarPlacement sin rig: Y inferida de SSOT
// ═══════════════════════════════════════════════════════════════════════════

describe('§1 computePlanarPlacement — sin rig', () => {
  const orientations: InstallationOrientation[] = [
    'ceiling', 'totem', 'truss-front', 'truss-back',
    'wall-left', 'wall-right', 'floor',
  ]

  orientations.forEach(ori => {
    test(`Y = DEFAULT_ORIENTATION_HEIGHT['${ori}'] (${DEFAULT_ORIENTATION_HEIGHT[ori]}m)`, () => {
      const result = computePlanarPlacement(2.0, -1.0, ori)
      expect(result.position.x).toBe(2.0)
      expect(result.position.z).toBe(-1.0)
      expect(result.position.y).toBe(DEFAULT_ORIENTATION_HEIGHT[ori])
      expect(result.orientation).toBe(ori)
      expect(result.rigId).toBeUndefined()
    })
  })

  test('X y Z se preservan exactamente', () => {
    const result = computePlanarPlacement(-3.5, 4.25, 'floor')
    expect(result.position.x).toBe(-3.5)
    expect(result.position.z).toBe(4.25)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// §2 — computePlanarPlacement con rig: herencia
// ═══════════════════════════════════════════════════════════════════════════

describe('§2 computePlanarPlacement — con rig', () => {
  test('Hereda height y orientation del rig truss', () => {
    const result = computePlanarPlacement(0.0, -3.0, 'floor', RIG_TRUSS)
    expect(result.position.y).toBe(RIG_TRUSS.height)
    expect(result.orientation).toBe(RIG_TRUSS.orientation)
    expect(result.rigId).toBe(RIG_TRUSS.id)
  })

  test('Hereda height y orientation del rig totem', () => {
    const result = computePlanarPlacement(-4.0, 2.0, 'ceiling', RIG_TOTEM)
    expect(result.position.y).toBe(RIG_TOTEM.height)
    expect(result.orientation).toBe(RIG_TOTEM.orientation)
    expect(result.rigId).toBe(RIG_TOTEM.id)
  })

  test('Ignora el parámetro orientation explícito cuando hay rig', () => {
    const result = computePlanarPlacement(1.0, 1.0, 'floor', RIG_TRUSS)
    expect(result.orientation).toBe('ceiling')
    expect(result.orientation).not.toBe('floor')
  })

  test('X y Z se preservan incluso con rig', () => {
    const result = computePlanarPlacement(3.25, -2.5, 'wall-left', RIG_TRUSS)
    expect(result.position.x).toBe(3.25)
    expect(result.position.z).toBe(-2.5)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// §3 — placementMode siempre 'planar'
// ═══════════════════════════════════════════════════════════════════════════

describe('§3 computePlanarPlacement — placementMode', () => {
  test('Sin rig → placementMode = planar', () => {
    const result = computePlanarPlacement(0, 0, 'ceiling')
    expect(result.placementMode).toBe('planar')
  })

  test('Con rig → placementMode = planar', () => {
    const result = computePlanarPlacement(0, 0, 'ceiling', RIG_TRUSS)
    expect(result.placementMode).toBe('planar')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// §4 — clampElevation sin stage
// ═══════════════════════════════════════════════════════════════════════════

describe('§4 clampElevation — sin stage (null)', () => {
  test('Valor positivo se snapea a voxel', () => {
    expect(clampElevation(3.3, null)).toBe(3.25)
    expect(clampElevation(4.0, null)).toBe(4.0)
    expect(clampElevation(0.1, null)).toBe(0.0)
  })

  test('Valor negativo se clampea a 0 (piso físico)', () => {
    expect(clampElevation(-1.0, null)).toBe(0)
    expect(clampElevation(-0.5, null)).toBe(0)
  })

  test('Valor cero permanece cero', () => {
    expect(clampElevation(0, null)).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// §5 — clampElevation con stage: clamp al Crystal Box
// ═══════════════════════════════════════════════════════════════════════════

describe('§5 clampElevation — con stage', () => {
  test('Valor dentro de rango se snapea', () => {
    expect(clampElevation(3.3, STAGE)).toBe(3.25)
    expect(clampElevation(4.0, STAGE)).toBe(4.0)
  })

  test('Valor excede stage.height → clampeado a stage.height', () => {
    expect(clampElevation(7.0, STAGE)).toBe(6.0)
    expect(clampElevation(100.0, STAGE)).toBe(6.0)
  })

  test('Valor negativo → clampeado a 0', () => {
    expect(clampElevation(-1.0, STAGE)).toBe(0)
    expect(clampElevation(-0.3, STAGE)).toBe(0)
  })

  test('Valor exacto en límites se preserva', () => {
    expect(clampElevation(0, STAGE)).toBe(0)
    expect(clampElevation(6.0, STAGE)).toBe(6.0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// §6 — clampElevation: snapping a VOXEL_SIZE (0.25)
// ═══════════════════════════════════════════════════════════════════════════

describe('§6 clampElevation — snapping a voxel', () => {
  test('Redondea al múltiplo de 0.25 más cercano', () => {
    expect(clampElevation(2.12, STAGE)).toBe(2.0)
    expect(clampElevation(2.13, STAGE)).toBe(2.25)
    expect(clampElevation(2.37, STAGE)).toBe(2.25)
    expect(clampElevation(2.38, STAGE)).toBe(2.5)
  })

  test('VOXEL_SIZE = 0.25', () => {
    expect(VOXEL_SIZE).toBe(0.25)
  })

  test('Snap + clamp se combinan correctamente', () => {
    // 6.12 → snap → 6.0 (dentro de rango)
    expect(clampElevation(6.12, STAGE)).toBe(6.0)
    // 6.13 → snap → 6.25 → clamp → 6.0
    expect(clampElevation(6.13, STAGE)).toBe(6.0)
  })
})
