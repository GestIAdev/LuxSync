/**
 * 🧬 WAVE 8235 — INFINITE GENOME · Fase G3 certification (Vitest, no GPU).
 *
 * Certifica el gate de mutación en frontera de frase (§4.6):
 *  - Solo cruza frontera cada `phraseBars` compases (nunca a mitad).
 *  - `u_approach ≥ 0.2` veto — jamás mutar durante buildup/drop.
 *  - `dropActive` (zona peak / apocalypse) veto — nunca en el clímax.
 *  - Primera observación = siembra, no mutación.
 *  - enabled = kill-switch del operador.
 */

import { describe, expect, it, vi } from 'vitest'
import {
  GenomeEvolver,
  GENOME_APPROACH_GATE,
  GENOME_PHRASE_BARS,
} from './GenomeEvolver'
import { getFitness, resetGenomePool, stepFitness } from './GenomePool'
import type { ThetaOrchestrator } from '../ThetaOrchestrator'

const mkTheta = (activeId = 'builtin') =>
  ({
    evolveGenome: vi.fn(),
    getActiveShaderId: () => activeId,
  }) as unknown as ThetaOrchestrator

const PHRASE = GENOME_PHRASE_BARS // 16 compases

describe('G3 — GenomeEvolver (§4.6 frontera de frase)', () => {
  it('solo muta al cruzar una frontera de 16 compases', () => {
    const theta = mkTheta()
    const ev = new GenomeEvolver()
    ev.attach(theta)
    // Primera observación siembra — sin mutación.
    ev.notify(0, 0, false, 2000)
    expect(theta.evolveGenome).not.toHaveBeenCalled()
    // Mitad de frase → nada.
    ev.notify(8, 0, false, 2000)
    ev.notify(15.9, 0, false, 2000)
    expect(theta.evolveGenome).not.toHaveBeenCalled()
    // Cruce a la frase 1 → muta (phraseCount = 1).
    ev.notify(16, 0, false, 2000)
    expect(theta.evolveGenome).toHaveBeenCalledTimes(1)
    expect(theta.evolveGenome).toHaveBeenLastCalledWith(1, 2000)
    // Otro cruce → segundo evento.
    ev.notify(32, 0, false, 2000)
    expect(theta.evolveGenome).toHaveBeenLastCalledWith(2, 2000)
  })

  it('respeta phraseBars=32 cuando se configura', () => {
    const theta = mkTheta()
    const ev = new GenomeEvolver()
    ev.phraseBars = 32
    ev.attach(theta)
    ev.notify(0, 0, false, 2000)
    ev.notify(16, 0, false, 2000)
    ev.notify(31.9, 0, false, 2000)
    expect(theta.evolveGenome).not.toHaveBeenCalled()
    ev.notify(32, 0, false, 2000)
    expect(theta.evolveGenome).toHaveBeenCalledTimes(1)
  })

  it('u_approach ≥ 0.2 veta la mutación (jamás durante buildup)', () => {
    const theta = mkTheta()
    const ev = new GenomeEvolver()
    ev.attach(theta)
    ev.notify(0, 0, false, 2000)
    // Frontera con approach alto → veto (la frase se consume igual —
    // la próxima oportunidad es la SIGUIENTE frontera).
    ev.notify(16, GENOME_APPROACH_GATE, false, 2000)
    ev.notify(32, GENOME_APPROACH_GATE + 0.5, false, 2000)
    expect(theta.evolveGenome).not.toHaveBeenCalled()
    // Approach seguro → muta.
    ev.notify(48, 0.19, false, 2000)
    expect(theta.evolveGenome).toHaveBeenCalledTimes(1)
  })

  it('dropActive veta la mutación (nunca en el clímax)', () => {
    const theta = mkTheta()
    const ev = new GenomeEvolver()
    ev.attach(theta)
    ev.notify(0, 0, false, 2000)
    ev.notify(16, 0, true, 2000)
    expect(theta.evolveGenome).not.toHaveBeenCalled()
    ev.notify(32, 0, false, 2000)
    expect(theta.evolveGenome).toHaveBeenCalledTimes(1)
  })

  it('enabled=false silencia el evolver por completo', () => {
    const theta = mkTheta()
    const ev = new GenomeEvolver()
    ev.enabled = false
    ev.attach(theta)
    ev.notify(0, 0, false, 2000)
    ev.notify(64, 0, false, 2000)
    expect(theta.evolveGenome).not.toHaveBeenCalled()
  })

  it('detach limpia estado; unattached es no-op', () => {
    const theta = mkTheta()
    const ev = new GenomeEvolver()
    ev.notify(64, 0, false, 2000) // sin attach → silencio
    ev.attach(theta)
    ev.notify(0, 0, false, 2000)
    ev.detach()
    ev.notify(32, 0, false, 2000)
    expect(theta.evolveGenome).not.toHaveBeenCalled()
    expect(ev.isAttached()).toBe(false)
    expect(ev.phraseCount).toBe(0)
  })

  it('G4 — acumula u_beauty en el fitness del individuo activo', () => {
    resetGenomePool()
    const theta = mkTheta('core_x#3')
    const ev = new GenomeEvolver()
    ev.attach(theta)
    ev.notify(0, 0, false, 2000, 0.9)
    ev.notify(4, 0, false, 2000, 0.9)
    ev.notify(8, 0, false, 2000, 0.9)
    // La ventana se consume en stepFitness — EMA: F = 0.1·w_b·ū.
    stepFitness('core_x#3')
    expect(getFitness('core_x#3')).toBeCloseTo(0.09, 9)
    // 'builtin' jamás registra fitness (es el plasma interno, no un genoma).
    const builtin = mkTheta('builtin')
    ev.attach(builtin)
    ev.notify(0, 0, false, 2000, 0.9)
    stepFitness('builtin')
    expect(getFitness('builtin')).toBe(0)
    resetGenomePool()
  })
})
