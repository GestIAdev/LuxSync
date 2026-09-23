/**
 * 🧪 WAVE 8130-F2 — massOps: deep-clone + generadores geométricos
 */

import { describe, it, expect } from 'vitest'
import {
  deepCloneFixture,
  generateLinearArray,
  generateGridMatrix,
  generateCircularArray,
  generateMirrorX,
} from '../massOps'
import { createDefaultFixture, DEFAULT_PHYSICS_PROFILES } from '../ShowFileV2'
import type { FixtureV2 } from '../ShowFileV2'

// idGen determinista de test — mismo contrato que generateId('fix') del store
const makeIdGen = () => {
  let n = 0
  return () => `fix-test-${(++n).toString(36)}`
}

const seedA = (): FixtureV2 =>
  createDefaultFixture('fix-A', 101, {
    name: 'PAR Alpha',
    type: 'par',
    position: { x: 1, y: 0.25, z: -2 },
    rotation: { pitch: 10, yaw: 45, roll: 5 },
    orientation: 'floor',
    zone: 'floor',
    channelCount: 8,
    rigId: 'truss-01',
    channels: [
      { index: 0, name: 'dimmer', type: 'intensity', is16bit: false, defaultValue: 0 },
    ],
    physics: {
      ...DEFAULT_PHYSICS_PROFILES['unknown'],
      maxAcceleration: 2,
      homePosition: { pan: 0, tilt: 0 },
      tiltLimits: { min: 10, max: 240 },
    },
  })

const seedB = (): FixtureV2 =>
  createDefaultFixture('fix-B', 201, {
    name: 'MH Beta',
    type: 'moving-head',
    position: { x: -3, y: 4, z: 1 },
    zone: 'movers-right',
    channelCount: 16,
  })

describe('deepCloneFixture', () => {
  it('genera clon con nuevo id y address 0 (UNPATCHED — WAVE 7731)', () => {
    const clone = deepCloneFixture(seedA(), 'fix-NEW')
    expect(clone.id).toBe('fix-NEW')
    expect(clone.address).toBe(0)
    expect(clone.name).toBe('PAR Alpha') // nombre verbatim salvo override
    expect(clone.zone).toBe('floor')
    expect(clone.orientation).toBe('floor')
    expect(clone.channelCount).toBe(8)
  })

  it('NO comparte objetos anidados con la semilla (bloqueo #3)', () => {
    const seed = seedA()
    const clone = deepCloneFixture(seed, 'fix-NEW')

    clone.position.x = 999
    clone.rotation.yaw = 180
    clone.physics.maxAcceleration = 99
    clone.physics.tiltLimits.min = -1
    clone.channels![0].defaultValue = 255

    expect(seed.position.x).toBe(1)
    expect(seed.rotation.yaw).toBe(45)
    expect(seed.physics.maxAcceleration).toBe(2)
    expect(seed.physics.tiltLimits.min).toBe(10)
    expect(seed.channels![0].defaultValue).toBe(0)
  })

  it('aplica overrides por encima de la copia', () => {
    const clone = deepCloneFixture(seedA(), 'fix-NEW', {
      name: 'Renamed',
      position: { x: 5, y: 5, z: 5 },
    })
    expect(clone.name).toBe('Renamed')
    expect(clone.position).toEqual({ x: 5, y: 5, z: 5 })
    expect(clone.address).toBe(0) // el override no re-patchea por accidente
  })
})

describe('generateLinearArray', () => {
  it('repite la SELECCIÓN como bloque: N seeds × count clones', () => {
    const seeds = [seedA(), seedB()]
    const clones = generateLinearArray(seeds, 3, { x: 1, y: 0, z: 0 }, makeIdGen())

    expect(clones).toHaveLength(6)
    // Orden: paso k → seed A, seed B | k+1 → A, B…
    expect(clones[0].name).toBe('PAR Alpha ·L1')
    expect(clones[0].position).toEqual({ x: 2, y: 0.25, z: -2 })
    expect(clones[1].name).toBe('MH Beta ·L1')
    expect(clones[1].position).toEqual({ x: -2, y: 4, z: 1 })
    expect(clones[4].position).toEqual({ x: 4, y: 0.25, z: -2 }) // A ·L3

    // IDs únicos + unpatched
    expect(new Set(clones.map(c => c.id)).size).toBe(6)
    expect(clones.every(c => c.address === 0)).toBe(true)
  })

  it('offset 3D: ΔY eleva cada copia', () => {
    const clones = generateLinearArray([seedA()], 2, { x: 0, y: 0.5, z: 0.25 }, makeIdGen())
    expect(clones[1].position).toEqual({ x: 1, y: 1.25, z: -1.5 })
  })
})

describe('generateGridMatrix', () => {
  it('retícula cols×rows anclada al PRIMER seed, celdas round-robin', () => {
    const seeds = [seedA(), seedB()]
    const clones = generateGridMatrix(seeds, 3, 2, 0.5, 1.0, makeIdGen())

    expect(clones).toHaveLength(6)
    // Fila 0: A,B,A — Fila 1: B,A,B (índice r*cols+c mod n)
    expect(clones.map(c => c.name)).toEqual([
      'PAR Alpha ·G1x1', 'MH Beta ·G1x2', 'PAR Alpha ·G1x3',
      'MH Beta ·G2x1', 'PAR Alpha ·G2x2', 'MH Beta ·G2x3',
    ])
    // Anclaje: posición de seeds[0] = (1, -2)
    expect(clones[2].position.x).toBe(1 + 2 * 0.5)
    expect(clones[3].position.z).toBe(-2 + 1 * 1.0)
    // Y heredado de la semilla de la CELDA (suelo vs truss)
    expect(clones[0].position.y).toBe(0.25)
    expect(clones[1].position.y).toBe(4)
    expect(new Set(clones.map(c => c.id)).size).toBe(6)
  })
})

describe('generateCircularArray', () => {
  it('XZ: anillo alrededor del centroide, clones miran al centro', () => {
    const seeds = [seedA()] // centroide = su posición (1, 0.25, -2)
    const clones = generateCircularArray(seeds, 4, 2, 'XZ', makeIdGen())

    expect(clones).toHaveLength(4)
    for (const c of clones) {
      const dx = c.position.x - 1
      const dz = c.position.z - (-2)
      expect(Math.hypot(dx, dz)).toBeCloseTo(2, 5)
      expect(c.position.y).toBe(0.25) // altura de la semilla
      expect(c.address).toBe(0)
    }
    // θ=0 → pos (cx+2, cz) → mira −X → yaw = atan2(-1, 0) = -90°
    expect(clones[0].rotation.yaw).toBe(-90)
    // Cada clon tiene yaw distinto (distinto ángulo del anillo)
    expect(new Set(clones.map(c => c.rotation.yaw)).size).toBe(4)
  })

  it('XY: círculo frontal, conserva rotación de la semilla', () => {
    const clones = generateCircularArray([seedA()], 4, 2, 'XY', makeIdGen())
    expect(clones[0].position.y).toBeCloseTo(0.25, 5) // sin(0)=0
    expect(clones[0].position.x).toBeCloseTo(3, 5) // 1 + 2·cos(0)
    expect(clones[0].rotation).toEqual(seedA().rotation) // yaw intacto
  })

  it('itera semillas round-robin en el anillo', () => {
    const clones = generateCircularArray([seedA(), seedB()], 4, 2, 'XZ', makeIdGen())
    expect(clones.map(c => c.name)).toEqual([
      'PAR Alpha ·C1', 'MH Beta ·C2', 'PAR Alpha ·C3', 'MH Beta ·C4',
    ])
  })
})

describe('generateMirrorX', () => {
  it('refleja posición y rotación sobre el plano YZ', () => {
    const clones = generateMirrorX([seedA()], makeIdGen())

    expect(clones).toHaveLength(1)
    const c = clones[0]
    expect(c.name).toBe('PAR Alpha ·M')
    expect(c.position).toEqual({ x: -1, y: 0.25, z: -2 })
    // Reflexión geométrica real: yaw y roll cambian de signo, pitch intacto
    expect(c.rotation).toEqual({ pitch: 10, yaw: -45, roll: -5 })
    expect(c.rigId).toBeUndefined() // el truss NO está espejado
    expect(c.address).toBe(0)
    expect(c.zone).toBe('floor') // zona heredada
    expect(c.orientation).toBe('floor')
  })

  it('una copia por cada seleccionado, IDs únicos', () => {
    const clones = generateMirrorX([seedA(), seedB()], makeIdGen())
    expect(clones).toHaveLength(2)
    expect(new Set(clones.map(c => c.id)).size).toBe(2)
    expect(clones[1].position.x).toBe(3) // -(-3)
  })
})
