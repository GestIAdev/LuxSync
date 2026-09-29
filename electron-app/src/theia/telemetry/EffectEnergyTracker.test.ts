/**
 * 🔫 WAVE 8287 — CLEAN SHOT · F1: EffectEnergyTracker
 *
 * Certificación de la envolvente "efecto físico vivo" (slots 96-99):
 *  - Hold: mientras el clip .lfx está en HephaestusRuntime.activeClips,
 *    energy = intensity EXACTA (paridad con la luz física).
 *  - Fin natural / stop / abort: el clip sale del mapa → cola de release
 *    lineal de 250 ms desde la última energía.
 *  - Loops: hold permanente + ageN = fase fract del ciclo.
 *  - Concurrencia: domina la mayor intensidad; count refleja los vivos.
 *  - Zero-alloc: sample() escribe en scratch `out` pasado por referencia.
 */

import { describe, it, expect } from 'vitest'
import {
  EffectEnergyTracker,
  createFxEnergySample,
  FX_RELEASE_MS,
  type FxClipView,
} from './EffectEnergyTracker'

// ─────────────────────────── helpers ───────────────────────────

let clipSeq = 0

function fakeClip(
  startTimeMs: number,
  durationMs: number,
  intensity: number,
  loop = false,
  id = `fx_${clipSeq++}`,
): FxClipView {
  return {
    startTimeMs,
    durationMs,
    intensity,
    loop,
    clip: { id },
  }
}

function sampleAt(
  tracker: EffectEnergyTracker,
  clips: ReadonlyMap<string, FxClipView>,
  now: number,
) {
  const out = createFxEnergySample()
  tracker.sample(now, clips, out)
  return out
}

// ─────────────────────────── tests ───────────────────────────

describe('EffectEnergyTracker (Clean Shot)', () => {
  it('mapa vacío → todo a cero', () => {
    const t = new EffectEnergyTracker()
    const out = sampleAt(t, new Map(), 1000)
    expect(out.energy).toBe(0)
    expect(out.ageN).toBe(0)
    expect(out.count).toBe(0)
  })

  it('clip recién disparado → energy = intensidad exacta, age≈0', () => {
    const t = new EffectEnergyTracker()
    const clips = new Map([['c1', fakeClip(1000, 2000, 0.8)]])
    const out = sampleAt(t, clips, 1000)
    expect(out.energy).toBeCloseTo(0.8, 5)
    expect(out.ageN).toBe(0)
    expect(out.count).toBe(1)
    expect(out.typeId).toBeGreaterThan(0)
  })

  it('hold durante toda la duración real (1500-5000ms), no frames', () => {
    const t = new EffectEnergyTracker()
    const clips = new Map([['c1', fakeClip(1000, 4000, 0.8)]])
    // Mitad del clip (2s en) — sigue sostenido a plena intensidad.
    const mid = sampleAt(t, clips, 3000)
    expect(mid.energy).toBeCloseTo(0.8, 5)
    expect(mid.ageN).toBeCloseTo(0.5, 5)
    // Casi al final — todavía hold.
    const late = sampleAt(t, clips, 4900)
    expect(late.energy).toBeCloseTo(0.8, 5)
    expect(late.ageN).toBeCloseTo(0.975, 2)
  })

  it('fin natural: el clip sale del mapa → release lineal de 250ms', () => {
    const t = new EffectEnergyTracker()
    const clips = new Map([['c1', fakeClip(0, 2000, 0.8)]])
    t.sample(1999, clips, createFxEnergySample()) // vivo hasta el final
    clips.clear() // el runtime expiró el clip → desaparece del mapa
    // t=0 de la cola
    const r0 = sampleAt(t, clips, 2000)
    expect(r0.energy).toBeCloseTo(0.8, 5)
    expect(r0.count).toBe(0)
    expect(r0.ageN).toBe(1)
    // mitad de la cola
    const rMid = sampleAt(t, clips, 2000 + FX_RELEASE_MS / 2)
    expect(rMid.energy).toBeCloseTo(0.4, 5)
    // cola agotada
    const rEnd = sampleAt(t, clips, 2000 + FX_RELEASE_MS + 1)
    expect(rEnd.energy).toBe(0)
    // y se queda muerto
    const dead = sampleAt(t, clips, 3000)
    expect(dead.energy).toBe(0)
  })

  it('stop temprano (abort) → mismo release que el fin natural', () => {
    const t = new EffectEnergyTracker()
    const clips = new Map([['c1', fakeClip(0, 8000, 0.9)]])
    t.sample(500, clips, createFxEnergySample())
    clips.clear() // stopAll/abort a mitad de vida
    const out = sampleAt(t, clips, 520)
    expect(out.energy).toBeGreaterThan(0.85) // ~top de la cola
    expect(out.energy).toBeLessThanOrEqual(0.9)
    const out2 = sampleAt(t, clips, 520 + FX_RELEASE_MS + 1)
    expect(out2.energy).toBe(0)
  })

  it('clip loop → hold permanente y ageN = fase fract', () => {
    const t = new EffectEnergyTracker()
    const clips = new Map([['loop1', fakeClip(0, 2000, 0.7, true)]])
    // 5.25 ciclos después → sigue vivo, fase 0.25
    const out = sampleAt(t, clips, 10500)
    expect(out.energy).toBeCloseTo(0.7, 5)
    expect(out.ageN).toBeCloseTo(0.25, 5)
    expect(out.count).toBe(1)
  })

  it('concurrencia: domina la mayor intensidad, count = vivos', () => {
    const t = new EffectEnergyTracker()
    const clips = new Map<string, FxClipView>([
      ['a', fakeClip(0, 3000, 0.4, false, 'tipo_a')],
      ['b', fakeClip(0, 3000, 0.9, false, 'tipo_b')],
    ])
    const out = sampleAt(t, clips, 100)
    expect(out.energy).toBeCloseTo(0.9, 5)
    expect(out.count).toBe(2)
    // typeId = hash del dominante — estable entre llamadas
    const out2 = sampleAt(t, clips, 200)
    expect(out2.typeId).toBe(out.typeId)
  })

  it('al morir el dominante, otro clip vivo toma el mando sin saltos a 0', () => {
    const t = new EffectEnergyTracker()
    const clips = new Map<string, FxClipView>([
      ['boss', fakeClip(0, 1000, 0.9)],
      ['sub', fakeClip(0, 5000, 0.5)],
    ])
    t.sample(500, clips, createFxEnergySample())
    clips.delete('boss') // el dominante expira, el sub sigue
    const out = sampleAt(t, clips, 1100)
    expect(out.energy).toBeCloseTo(0.5, 5)
    expect(out.count).toBe(1)
  })

  it('efectos bloqueados nunca entran al mapa → energy queda a 0', () => {
    const t = new EffectEnergyTracker()
    // Shield/cooldown bloqueó el disparo → jamás hubo insert en activeClips.
    const out = sampleAt(t, new Map(), 5000)
    expect(out.energy).toBe(0)
    expect(out.count).toBe(0)
  })

  it('typeId es estable para el mismo clip.id y distinto para otro', () => {
    const t1 = new EffectEnergyTracker()
    const t2 = new EffectEnergyTracker()
    const a = new Map([['x', fakeClip(0, 2000, 0.8, false, 'solar_flare')]])
    const b = new Map([['y', fakeClip(0, 2000, 0.8, false, 'lunar_sweep')]])
    const oa = sampleAt(t1, a, 10)
    const ob = sampleAt(t2, b, 10)
    expect(oa.typeId).not.toBe(ob.typeId)
    expect(oa.typeId).toBeGreaterThanOrEqual(0)
    expect(oa.typeId).toBeLessThanOrEqual(1)
  })

  it('defensivo: clip con durationMs≤0 no contamina', () => {
    const t = new EffectEnergyTracker()
    const clips = new Map([['bad', fakeClip(0, 0, 0.9)]])
    const out = sampleAt(t, clips, 10)
    expect(out.energy).toBe(0)
    expect(out.count).toBe(0)
  })
})
