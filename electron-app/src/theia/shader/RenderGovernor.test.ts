/**
 * 🔮 WAVE 8229 — Euclid Oracle · Phase E3: RenderGovernor (§4.5) tests.
 *
 * Certifica la lógica adaptativa de u_renderScale (prevención TDR):
 *  - Default 0.75, rango [0.4, 1.0].
 *  - EMA > 15 ms sostenido 1 s → −0.1 (con cooldown entre ajustes).
 *  - EMA < 10 ms sostenido 1 s → +0.05 hasta 1.0.
 *  - Banda muerta 10–15 ms → sin oscilación (histéresis).
 */

import { describe, expect, it } from 'vitest'
import { RenderGovernor, GOVERNOR_DEFAULTS } from './RenderGovernor'

/** Alimenta el governor con `frameMs` constante durante `frames` frames. */
function run(gov: RenderGovernor, frameMs: number, frames: number, now = { t: 0 }): number {
  for (let i = 0; i < frames; i++) {
    now.t += frameMs
    gov.step(frameMs, now.t)
  }
  return gov.renderScale
}

describe('E3 RenderGovernor — §4.5', () => {
  it('arranca en 0.75 (default raymarching)', () => {
    const gov = new RenderGovernor()
    expect(gov.renderScale).toBe(0.75)
    expect(GOVERNOR_DEFAULTS.initialScale).toBe(0.75)
  })

  it('degrada −0.1 si el frame medio supera 15 ms durante 1 s', () => {
    const gov = new RenderGovernor()
    const now = { t: 0 }
    // 60 fps × 20 ms sostenidos: ~1.2 s → primer ajuste.
    const s = run(gov, 20, 72, now)
    expect(s).toBeCloseTo(0.65, 5)
    expect(gov.downgrades).toBe(1)
  })

  it('no degrada antes de 1 s sostenido (dwell)', () => {
    const gov = new RenderGovernor()
    const now = { t: 0 }
    // 45 frames × 20 ms = 0.9 s < 1 s — sin ajuste aún.
    const s = run(gov, 20, 45, now)
    expect(s).toBe(0.75)
    expect(gov.downgrades).toBe(0)
  })

  it('encadena degradaciones hasta el piso 0.4 y no lo rompe', () => {
    const gov = new RenderGovernor()
    const now = { t: 0 }
    // 20 ms durante ~12 s: 0.75→0.65→0.55→0.45→0.40 (con cooldowns).
    const s = run(gov, 20, 60 * 12, now)
    expect(s).toBe(0.4)
    expect(gov.renderScale).toBeGreaterThanOrEqual(0.4)
    expect(gov.downgrades).toBeGreaterThanOrEqual(4)
  })

  it('recupera +0.05/s con holgura (<10 ms) hasta 1.0', () => {
    const gov = new RenderGovernor({ initialScale: 0.6 })
    const now = { t: 0 }
    // 8 ms × ~125 frames acumulan el 1 s de dwell → primer upgrade +0.05.
    let s = run(gov, 8, 200, now)
    expect(s).toBeGreaterThan(0.6)
    expect(gov.upgrades).toBeGreaterThanOrEqual(1)
    // Sostenido → converge a 1.0 y no lo supera.
    s = run(gov, 8, 60 * 40, now)
    expect(s).toBe(1.0)
  })

  it('banda muerta 10–15 ms: histéresis, sin ajustes', () => {
    const gov = new RenderGovernor()
    const now = { t: 0 }
    const s = run(gov, 12, 60 * 5, now)
    expect(s).toBe(0.75)
    expect(gov.downgrades).toBe(0)
    expect(gov.upgrades).toBe(0)
  })

  it('un pico aislado no degrada (EMA + dwell lo absorben)', () => {
    const gov = new RenderGovernor()
    const now = { t: 0 }
    // Baseline sano 14 ms (banda muerta) + 3 spikes de 60 ms + sanos.
    // El EMA pica ~4 frames por encima de 15 → ~200 ms < 1 s de dwell.
    run(gov, 14, 50, now)
    run(gov, 60, 3, now)
    const s = run(gov, 14, 50, now)
    expect(s).toBe(0.75)
    expect(gov.downgrades).toBe(0)
  })

  it('alternancia 8↔20 ms no oscila (la banda muerta + cooldown rompen el bucle)', () => {
    const gov = new RenderGovernor()
    const now = { t: 0 }
    for (let i = 0; i < 40; i++) {
      now.t += 14
      gov.step(i % 2 === 0 ? 8 : 20, now.t)
    }
    // EMA ≈ 14 ms → dentro de banda muerta tras la mezcla: ≤1 ajuste.
    expect(gov.downgrades + gov.upgrades).toBeLessThanOrEqual(1)
  })

  it('reset() restaura el default y limpia acumuladores', () => {
    const gov = new RenderGovernor()
    const now = { t: 0 }
    run(gov, 20, 200, now)
    expect(gov.renderScale).toBeLessThan(0.75)
    gov.reset()
    expect(gov.renderScale).toBe(0.75)
    expect(gov.frameEmaMs).toBe(16.7)
    // Un frame de 20 ms tras reset no re-triggera instantáneo.
    gov.step(20, (now.t += 20))
    expect(gov.renderScale).toBe(0.75)
  })

  it('respeta config custom (rangos y pasos)', () => {
    const gov = new RenderGovernor({
      initialScale: 0.5,
      minScale: 0.3,
      downStep: 0.2,
      dwellMs: 500,
      cooldownMs: 0,
    })
    const now = { t: 0 }
    run(gov, 30, 30, now) // 0.9 s a 30 ms → primer ajuste −0.2
    expect(gov.renderScale).toBeCloseTo(0.3, 5)
    expect(gov.renderScale).toBeGreaterThanOrEqual(0.3)
  })
})
