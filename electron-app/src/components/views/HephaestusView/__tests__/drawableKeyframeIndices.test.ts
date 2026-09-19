/**
 * ⚒️ OOM GUARD TESTS — computeDrawableKeyframeIndices
 *
 * The CurveEditor's DOM ceiling: with more keyframes than
 * MAX_RENDERED_KEYFRAMES the drawn index set must stay bounded while
 * interactive indices (selected / dragged) are never culled.
 */
import { describe, it, expect } from 'vitest'
import {
  computeDrawableKeyframeIndices,
  MAX_RENDERED_KEYFRAMES,
} from '../CurveEditor'

describe('computeDrawableKeyframeIndices', () => {
  it('returns every index when under the cap', () => {
    const n = MAX_RENDERED_KEYFRAMES
    const idx = computeDrawableKeyframeIndices(n)
    expect(idx).toHaveLength(n)
    expect(idx[0]).toBe(0)
    expect(idx[n - 1]).toBe(n - 1)
  })

  it('bounds the drawn set when over the cap', () => {
    const n = MAX_RENDERED_KEYFRAMES * 4
    const idx = computeDrawableKeyframeIndices(n)
    expect(idx.length).toBeLessThanOrEqual(MAX_RENDERED_KEYFRAMES)
    expect(idx.length).toBeGreaterThanOrEqual(MAX_RENDERED_KEYFRAMES - 1)
    expect(idx[0]).toBe(0)
    expect(idx[idx.length - 1]).toBe(n - 1)
    // strictly increasing, no duplicates
    for (let i = 1; i < idx.length; i++) {
      expect(idx[i]).toBeGreaterThan(idx[i - 1])
    }
  })

  it('always keeps explicitly requested indices beyond the cap', () => {
    const n = MAX_RENDERED_KEYFRAMES * 3
    const idx = computeDrawableKeyframeIndices(n, [1, n - 2, n - 1])
    expect(idx).toContain(1)
    expect(idx).toContain(n - 2)
    expect(idx).toContain(n - 1)
    expect(idx.length).toBeLessThanOrEqual(MAX_RENDERED_KEYFRAMES + 3)
  })

  it('ignores out-of-range keep indices', () => {
    const n = MAX_RENDERED_KEYFRAMES + 10
    const idx = computeDrawableKeyframeIndices(n, [-5, n + 100])
    for (const i of idx) {
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(n)
    }
  })

  it('covers the whole curve — stride samples span the full range', () => {
    const n = MAX_RENDERED_KEYFRAMES * 2
    const idx = computeDrawableKeyframeIndices(n)
    // every region of the curve must remain visible: max gap bounded by ~2x stride
    const maxGap = Math.max(...idx.slice(1).map((v, i) => v - idx[i]))
    expect(maxGap).toBeLessThanOrEqual(Math.ceil((n - 1) / (MAX_RENDERED_KEYFRAMES - 1)) + 1)
  })
})
