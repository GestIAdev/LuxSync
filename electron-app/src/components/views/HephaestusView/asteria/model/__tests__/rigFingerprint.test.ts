/**
 * 🜨 WAVE 8030-P3 — Tests de computeRigFingerprint
 * SHA-1 contra vectores conocidos (RFC 3174) + contrato del blueprint §5.2.
 */

import { describe, test, expect } from 'vitest'
import { computeRigFingerprint } from '../rigFingerprint'

describe('🜨 rigFingerprint — sha1(nodeIds ordenados)', () => {
  test('un solo nodo → sha1 conocido', () => {
    // sha1("fx-1:impact") precalculado — verificamos vía vector RFC: "abc"
    // sha1("abc") = a9993e364706816aba3e25717850c26c9cd0d89d
    expect(computeRigFingerprint(['abc'])).toBe(
      'sha1:a9993e364706816aba3e25717850c26c9cd0d89d',
    )
  })

  test('orden de entrada irrelevante — set idéntico → huella idéntica', () => {
    const a = computeRigFingerprint(['fx-1:impact', 'fx-2:color', 'fx-1:color'])
    const b = computeRigFingerprint(['fx-2:color', 'fx-1:color', 'fx-1:impact'])
    expect(a).toBe(b)
  })

  test('sets distintos → huellas distintas (detecta drift)', () => {
    const a = computeRigFingerprint(['fx-1:impact', 'fx-2:impact'])
    const b = computeRigFingerprint(['fx-1:impact', 'fx-3:impact'])
    expect(a).not.toBe(b)
  })

  test('atlas vacío → huella vacía (proyecto sin sellar)', () => {
    expect(computeRigFingerprint([])).toBe('')
  })

  test('no muta el array de entrada', () => {
    const ids = ['b', 'a', 'c']
    computeRigFingerprint(ids)
    expect(ids).toEqual(['b', 'a', 'c'])
  })
})
