/**
 * 🜨 WAVE 8196 — PREVIEW SQUELCH: `resolveTrackFixtureSet`
 *
 * La resolución pista→fixture del preview debe honrar `track.cell` como
 * filtro real (paridad con `blendSuffix ':param#cell'` del runtime):
 * una pista quirúrgica de Asteria (`zones:['all']` + `cell`) alcanza
 * SOLO el fixture que contiene la celda — nunca ilumina todo el rig.
 */

import { describe, test, expect } from 'vitest'
import { resolveTrackFixtureSet } from '../useHephPreview'
import type { HephTrack, ZoneTarget } from '../../../core/hephaestus/types'

const POOL = new Set(['fx-a', 'fx-b', 'fx-c'])

function surgical(cell: string): Pick<HephTrack, 'cell' | 'zones'> {
  // Asteria surgical track: zones=['all'] es placeholder — cell manda.
  return { cell, zones: ['all'] as ZoneTarget[] }
}

describe('🜨 WAVE 8196 — resolveTrackFixtureSet (Preview Squelch)', () => {
  test('cell definido → solo el fixture que contiene la celda', () => {
    const set = resolveTrackFixtureSet(surgical('fx-b:petal-l:impact'), POOL, null)
    expect([...set]).toEqual(['fx-b'])
  })

  test('cell + zones:[all] → NO universal (el squelch fix)', () => {
    // Regresión: pre-8196 'all' marcaba la pista como universal y todo el
    // rig mostraba la curva quirúrgica. Ahora cell acota a su device.
    const set = resolveTrackFixtureSet(surgical('fx-a:c1'), POOL, null)
    expect(set.has('fx-a')).toBe(true)
    expect(set.has('fx-b')).toBe(false)
    expect(set.has('fx-c')).toBe(false)
    expect(set.size).toBe(1)
  })

  test('cell fuera del pool → conjunto vacío (oscuro honesto, no broadcast)', () => {
    const set = resolveTrackFixtureSet(surgical('fx-z:c1'), POOL, null)
    expect(set.size).toBe(0)
  })

  test('cell sin separador → el cell entero es el deviceId', () => {
    const set = resolveTrackFixtureSet(surgical('fx-c'), POOL, null)
    expect([...set]).toEqual(['fx-c'])
  })

  test('sin cell + zones:[all] → universal (set del pool compartido)', () => {
    const set = resolveTrackFixtureSet({ zones: ['all'] as ZoneTarget[] }, POOL, null)
    expect(set).toBe(POOL)
  })

  test('sin cell + zones vacías → universal', () => {
    const set = resolveTrackFixtureSet({ zones: [] as ZoneTarget[] }, POOL, null)
    expect(set).toBe(POOL)
  })

  test('sin cell + zones concretas → resolveZones decide', () => {
    const resolve = (zs: string[]) => (zs.includes('air') ? ['fx-b'] : [])
    const set = resolveTrackFixtureSet({ zones: ['air'] as ZoneTarget[] }, POOL, resolve)
    expect([...set]).toEqual(['fx-b'])
  })

  test('sin cell + zones concretas + sin resolver → universal (fallback legacy)', () => {
    const set = resolveTrackFixtureSet({ zones: ['air'] as ZoneTarget[] }, POOL, null)
    expect(set).toBe(POOL)
  })

  test('zone tag de energía filtrado → cae a universal (cuarentena 7024-B)', () => {
    const set = resolveTrackFixtureSet({ zones: ['peak'] as ZoneTarget[] }, POOL, null)
    expect(set).toBe(POOL)
  })
})
