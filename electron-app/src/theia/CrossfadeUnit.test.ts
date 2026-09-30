/**
 * 🔥 HOTFIX 8312 — impactDuckFor: supresión de u_impact durante transiciones.
 *
 * El flash aditivo del impacto no puede sumar sobre la mezcla del crossfade:
 * duck = 0 mientras la unidad no está en reposo (running, pending-anchor y
 * el tick finished), 1 en idle.
 */

import { describe, expect, it } from 'vitest'
import { CrossfadeUnit, impactDuckFor } from './CrossfadeUnit'

describe('HOTFIX 8312 — impactDuckFor', () => {
  it('idle → 1: el impacto llega intacto sin transición', () => {
    const u = new CrossfadeUnit()
    const step = u.step()
    expect(step.active).toBe(false)
    expect(impactDuckFor(step, u.isWaitingAnchor())).toBe(1)
  })

  it('running → 0 durante TODA la rampa (incl. el tick finished)', () => {
    const u = new CrossfadeUnit()
    u.start({ totalTicks: 5 })
    const ducks: number[] = []
    for (let i = 0; i < 6; i++) {
      const s = u.step()
      ducks.push(impactDuckFor(s, u.isWaitingAnchor()))
      if (s.finished) break
    }
    // Los 5 ticks del fade mutean; solo tras terminar vuelve a 1.
    expect(ducks.slice(0, 5)).toEqual([0, 0, 0, 0, 0])
    expect(u.isDone()).toBe(true)
    expect(impactDuckFor(u.step(), u.isWaitingAnchor())).toBe(1)
  })

  it('pending-anchor → 0: el hold con blend=0 también es transición', () => {
    const u = new CrossfadeUnit()
    u.start({ totalTicks: 4, waitAnchor: true })
    const s = u.step() // sigue en hold: active=false pero transición viva
    expect(s.active).toBe(false)
    expect(u.isWaitingAnchor()).toBe(true)
    expect(impactDuckFor(s, u.isWaitingAnchor())).toBe(0)
    // Al liberar el ancla, running → sigue muteado.
    const s2 = u.step({ releaseAnchor: true })
    expect(s2.active).toBe(true)
    expect(impactDuckFor(s2, u.isWaitingAnchor())).toBe(0)
  })

  it('abort durante la transición → duck vuelve a 1', () => {
    const u = new CrossfadeUnit()
    u.start({ totalTicks: 10 })
    u.step()
    u.abort()
    expect(impactDuckFor(u.step(), u.isWaitingAnchor())).toBe(1)
  })
})
