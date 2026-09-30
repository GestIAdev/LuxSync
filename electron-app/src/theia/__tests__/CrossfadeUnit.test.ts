/**
 * 🧬 WAVE 8232 · G0 (H1) — CrossfadeUnit.resolvedBlend
 *
 * Certifica la semántica del uniform `u_blend` del epílogo generativo
 * (`mix(prev, c, u_blend)`): el path generativo mantiene `u_prevFrame`
 * válido SIEMPRE (feedback + limitador fotosensible), por lo que un blend
 * de 0 en reposo congela la salida sobre el primer frame capturado.
 *
 *   - idle            → 1   (frame actual al 100%)
 *   - running         → rampa alphaSecondary 0→1
 *   - pending-anchor  → 0   (hold del snapshot hasta el ancla)
 *   - tras abort()    → 1
 *
 * ⏱️ WAVE 8405 · M2 — la unidad es WALL-CLOCK: los tests inyectan un reloj
 * falso (`() => fakeNow`) y avanzan ms — ya no existen los ticks.
 */

import { describe, expect, it } from 'vitest'
import { CrossfadeUnit } from '../CrossfadeUnit'

/** Unidad con reloj controlable: `clock.now += ms` mueve el fade. */
function makeClocked() {
  const clock = { now: 0 }
  const xf = new CrossfadeUnit(() => clock.now)
  return { xf, clock }
}

describe('G0 — resolvedBlend (H1: el shader generativo nunca se congela)', () => {
  it('en reposo (idle) el blend es 1.0 — el frame actual sale al 100%', () => {
    const { xf } = makeClocked()
    const step = xf.step()
    expect(step.active).toBe(false)
    expect(step.alphaSecondary).toBe(0) // el bug: esto llegaba crudo a u_blend
    expect(xf.resolvedBlend(step)).toBe(1)
  })

  it('durante running la rampa va 0→1 y termina en 1', () => {
    const { xf, clock } = makeClocked()
    xf.start({ durationMs: 100, curve: 'linear' })
    const seen: number[] = []
    let finished = false
    for (let i = 0; i < 12 && !finished; i++) {
      clock.now += 10
      const step = xf.step()
      finished = step.finished
      seen.push(xf.resolvedBlend(step))
    }
    // Primera muestra < 1 (la rampa parte de 0), monótona no-decreciente,
    // última = 1 (finished → alphaSecondary 1).
    expect(seen[0]).toBeLessThan(1)
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1] - 1e-9)
    }
    expect(seen[seen.length - 1]).toBe(1)
    // Tras terminar, vuelve a idle → 1.
    expect(xf.resolvedBlend(xf.step())).toBe(1)
  })

  it('la rampa es WALL-CLOCK: 500 ms duran igual a 60 Hz que a 144 Hz', () => {
    // El bug de M2: totalTicks = ms/16.7 → a 144 Hz el fade duraba ~0.42×.
    // Ahora el progreso depende solo del tiempo transcurrido.
    const { xf, clock } = makeClocked()
    xf.start({ durationMs: 500, curve: 'linear' })
    // Simula 144 Hz: 6.9 ms por frame.
    let last = 0
    for (let i = 0; i < 40; i++) {
      clock.now += 6.9
      const s = xf.step()
      last = s.alphaSecondary
      if (s.finished) break
    }
    // A ~276 ms el fade debe ir por la MITAD — no terminado ni recién empezado.
    expect(last).toBeGreaterThan(0.4)
    expect(last).toBeLessThan(0.65)
    // Y termina exactamente cuando el reloj cruza los 500 ms.
    while (!xf.isDone()) {
      clock.now += 6.9
      xf.step()
    }
    expect(clock.now).toBeGreaterThanOrEqual(500)
    expect(clock.now).toBeLessThan(510)
  })

  it('en pending-anchor mantiene 0 (hold) y al liberar arranca la rampa', () => {
    const { xf, clock } = makeClocked()
    xf.start({ durationMs: 50, waitAnchor: true })
    const held = xf.step()
    expect(held.active).toBe(false)
    expect(xf.resolvedBlend(held)).toBe(0) // hold sobre el snapshot
    clock.now += 10
    const released = xf.step({ releaseAnchor: true })
    expect(released.active).toBe(true)
    expect(xf.resolvedBlend(released)).toBe(released.alphaSecondary)
  })

  it('pending-anchor con timeout agotado arranca solo y blend sigue la rampa', () => {
    const { xf, clock } = makeClocked()
    xf.start({ durationMs: 50, waitAnchor: true, anchorTimeoutMs: 100 })
    expect(xf.resolvedBlend(xf.step())).toBe(0)
    clock.now += 50
    expect(xf.resolvedBlend(xf.step())).toBe(0)
    clock.now += 60 // 110 ms > 100 ms → timeout → running
    const kicked = xf.step()
    expect(kicked.active).toBe(true)
    expect(xf.resolvedBlend(kicked)).toBe(kicked.alphaSecondary)
  })

  it('abort() en mitad del fade devuelve el blend a 1 (live)', () => {
    const { xf, clock } = makeClocked()
    xf.start({ durationMs: 100 })
    clock.now += 10
    xf.step()
    xf.abort()
    expect(xf.resolvedBlend(xf.step())).toBe(1)
  })

  it('fadeMs=0 (corte duro generativo) nunca deja blend en 0', () => {
    // activateGenProgram con fadeMs=0 llama abort() → idle → blend 1.
    const { xf } = makeClocked()
    xf.start({ durationMs: 100 })
    xf.abort()
    expect(xf.resolvedBlend(xf.step())).toBe(1)
  })
})
