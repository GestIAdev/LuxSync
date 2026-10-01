/**
 * 🧪 WAVE 8411-C — pctToDim mapping (percent UI ↔ fracción JSON).
 *
 * Regresión del bug "binario": el clamp estaba en unidades de fracción
 * (Math.min(1, pct)) sobre un valor ya en porcentaje — todo <100 colapsaba
 * a 0.01 y ≥100 a undefined. El control solo admitía 1% o 100%.
 */

import { describe, expect, it } from 'vitest'
import { pctToDim, pctToFloor } from '../OutputDmxConfigPanel'

describe('pctToDim — mapping percent → fracción (WAVE 8411-C)', () => {
  it('mapea valores intermedios a fracciones', () => {
    expect(pctToDim(39)).toBeCloseTo(0.39)
    expect(pctToDim(39.2)).toBeCloseTo(0.392)
    expect(pctToDim(50)).toBeCloseTo(0.5)
    expect(pctToDim(1)).toBeCloseTo(0.01)
  })

  it('0% = cap a cero (blackout forzado), no undefined', () => {
    expect(pctToDim(0)).toBe(0)
  })

  it('100% = undefined (retira la propiedad — uncapped)', () => {
    expect(pctToDim(100)).toBeUndefined()
  })

  it('clamp: negativos → 0, >100 → undefined', () => {
    expect(pctToDim(-5)).toBe(0)
    expect(pctToDim(150)).toBeUndefined()
  })
})

describe('pctToFloor — mapping percent → fracción (WAVE 8411-E)', () => {
  it('mapea valores intermedios a fracciones', () => {
    expect(pctToFloor(31)).toBeCloseTo(0.31)
    expect(pctToFloor(12.5)).toBeCloseTo(0.125)
  })

  it('0% = undefined (retira la propiedad — sin floor)', () => {
    expect(pctToFloor(0)).toBeUndefined()
  })

  it('clamp: negativos → undefined, >100 → 1.0', () => {
    expect(pctToFloor(-5)).toBeUndefined()
    expect(pctToFloor(150)).toBe(1)
  })
})
