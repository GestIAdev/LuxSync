/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧪  DIAGNÓSTICO WAVE — Mover sustain audit (física real vs UI)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Reporte: los movers quedan "encendidos casi fijos" en TODAS las vibes y
 * solo se apagan en silencios obvios. Este harness conduce el engine con
 * audio sintético determinista a 44 Hz (fake timers controlan Date.now)
 * y mide el steady-state real de moverLeftIntensity/moverRightIntensity.
 *
 *   Escenarios:
 *     A) Groove sostenido con energía media (melodía presente continua).
 *     B) Pasaje de baja energía (pad suave — donde "casi fijos" molesta).
 *     C) Silencio tras música — debe decaer a ~0 (sanity check).
 *
 * Los números impresos permiten separar "el engine sustenta" (physics real)
 * de "la UI exagera" (mentira de render).
 */

import { describe, test, expect, vi, afterEach } from 'vitest'
import { LiquidEngine41 } from '../LiquidEngine41'
import { PROFILE_REGISTRY } from '../profiles'
import type { LiquidStereoInput } from '../LiquidStereoPhysics'
import type { ILiquidProfile } from '../profiles/ILiquidProfile'

const FRAME_MS = 23 // ~44Hz
const FRAMES_PER_SECOND = 44

function makeInput(over: Partial<LiquidStereoInput> = {}): LiquidStereoInput {
  return {
    bands: {
      subBass: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0, ultraAir: 0,
    },
    sectionType: 'verse',
    isRealSilence: false,
    isAGCTrap: false,
    harshness: 0.4,
    flatness: 0.30,        // contenido tonal → isTonal = 1 (gate abierto)
    bpm: 120,
    ...over,
  }
}

/** Groove sostenido: kick cada 11 frames (~2.7/s @120bpm-ish), melodía continua. */
function grooveInput(frame: number, kickPulse: boolean): LiquidStereoInput {
  return makeInput({
    bands: {
      subBass: kickPulse ? 0.5 : 0.3,
      bass:    kickPulse ? 0.55 : 0.25,
      lowMid:  0.30,
      mid:     0.45,
      highMid: 0.35,
      treble:  0.25,
      ultraAir: 0.08,
    },
    isKick: kickPulse,
    flatness: 0.25,
    harshness: 0.45,
  })
}

/**
 * Groove REALISTA: hi-hats en semicorcheas (pulso/valle alternados), kick en
 * beat, melodía con respiración. Las bandas hi-mid/treble BAJAN entre golpes
 * — la dinámica que diferencia un envelope que respira de uno clavado.
 * 120bpm, 16ths ≈ cada 5-6 frames @44Hz.
 */
function grooveDynamicInput(frame: number, kickPulse: boolean): LiquidStereoInput {
  const hhPhase = frame % 5 === 0           // 16ths
  const snarePhase = frame % 11 === 5       // backbeat
  const melody = 0.28 + 0.15 * Math.sin(frame / 14) // synth respirando
  return makeInput({
    bands: {
      subBass: kickPulse ? 0.5 : 0.22,
      bass:    kickPulse ? 0.55 : 0.18,
      lowMid:  0.22 + 0.08 * Math.sin(frame / 20),
      mid:     melody,
      highMid: snarePhase ? 0.5 : hhPhase ? 0.22 : 0.08,
      treble:  hhPhase ? 0.38 : 0.09,
      ultraAir: hhPhase ? 0.12 : 0.02,
    },
    isKick: kickPulse,
    flatness: 0.25,
    harshness: 0.45,
  })
}

/** Pasaje suave: pad melódico de baja energía, sin percusión fuerte. */
function softPassageInput(): LiquidStereoInput {
  return makeInput({
    bands: {
      subBass: 0.10, bass: 0.12, lowMid: 0.15, mid: 0.18,
      highMid: 0.12, treble: 0.08, ultraAir: 0.03,
    },
    flatness: 0.20,
    harshness: 0.25,
  })
}

interface SweepResult { max: number; mean: number; min: number }

function percentile(sorted: number[], q: number): number {
  if (!sorted.length) return 0
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]
}

function drive(engine: LiquidEngine41, frames: number, makeFrame: (f: number) => LiquidStereoInput): SweepResult & { last: number; p10: number; p25: number; p50: number; darkFrac: number } {
  let max = 0, min = Infinity, sum = 0, last = 0
  const acc = { l: 0, r: 0 }
  const vals: number[] = []
  for (let f = 0; f < frames; f++) {
    const res = engine.applyBands(makeFrame(f))
    acc.l = res.moverLeftIntensity
    acc.r = res.moverRightIntensity
    last = Math.max(acc.l, acc.r)
    vals.push(last)
    if (last > max) max = last
    if (last < min) min = last
    sum += last
    vi.advanceTimersByTime(FRAME_MS)
  }
  const sorted = [...vals].sort((a, b) => a - b)
  return {
    max,
    min: vals.length ? min : 0,
    mean: vals.length ? sum / vals.length : 0,
    last,
    p10: percentile(sorted, 0.10),
    p25: percentile(sorted, 0.25),
    p50: percentile(sorted, 0.50),
    // fracción de frames "oscuras" (<5% — percibible como apagado real)
    darkFrac: vals.length ? vals.filter((v) => v < 0.05).length / vals.length : 0,
  }
}

describe('Mover sustain audit — física real (LiquidEngine41)', () => {
  afterEach(() => vi.useRealTimers())

  // 🧪 A/B: el mismo perfil con el rango morph ANTERIOR a WAVE 8410-B.
  // Si el mean del groove colapsa al restaurar floor/ceiling, la
  // recalibración morph (no la zona back) es la fuente del sustain.
  const OLD_MORPH: Record<string, { morphFloor: number; morphCeiling: number }> = {
    'techno-club':   { morphFloor: 0.30, morphCeiling: 0.70 },
    'fiesta-latina': { morphFloor: 0.45, morphCeiling: 0.65 },
    'pop-rock':      { morphFloor: 0.20, morphCeiling: 0.60 },
    'rave':          { morphFloor: 0.30, morphCeiling: 0.70 },
  }

  const profiles: Array<[string, ILiquidProfile]> = [
    ['techno-club',   PROFILE_REGISTRY['techno-club']],
    ['fiesta-latina', PROFILE_REGISTRY['fiesta-latina']],
    ['pop-rock',      PROFILE_REGISTRY['pop-rock']],
    ['rave',          PROFILE_REGISTRY['rave']],
  ]

  for (const [vibe, profile] of profiles) {
    test(`${vibe}: groove sostenido 4s — A/B morph nuevo vs viejo`, () => {
      vi.useFakeTimers()
      vi.setSystemTime(0)

      // A: perfil actual (post-8410-B)
      const engineNew = new LiquidEngine41(profile)
      drive(engineNew, FRAMES_PER_SECOND, () => makeInput({ isRealSilence: true }))
      const grooveNew = drive(engineNew, 4 * FRAMES_PER_SECOND, (f) => grooveDynamicInput(f, f % 11 === 0))
      const afterNew = drive(engineNew, 2 * FRAMES_PER_SECOND, () => makeInput({ isRealSilence: true }))

      // B: perfil con el rango morph pre-8410-B (resto idéntico)
      const old = OLD_MORPH[vibe]
      const profileOld = old ? { ...profile, ...old } : profile
      const engineOld = new LiquidEngine41(profileOld)
      drive(engineOld, FRAMES_PER_SECOND, () => makeInput({ isRealSilence: true }))
      const grooveOld = drive(engineOld, 4 * FRAMES_PER_SECOND, (f) => grooveDynamicInput(f, f % 11 === 0))
      const afterOld = drive(engineOld, 2 * FRAMES_PER_SECOND, () => makeInput({ isRealSilence: true }))

      console.log(
        `[${vibe}] NEW mean=${grooveNew.mean.toFixed(3)} p10=${grooveNew.p10.toFixed(3)} p25=${grooveNew.p25.toFixed(3)} p50=${grooveNew.p50.toFixed(3)} dark=${(grooveNew.darkFrac * 100).toFixed(1)}%` +
        ` | OLD mean=${grooveOld.mean.toFixed(3)} p10=${grooveOld.p10.toFixed(3)} dark=${(grooveOld.darkFrac * 100).toFixed(1)}%` +
        ` | silence end new=${afterNew.last.toFixed(4)} old=${afterOld.last.toFixed(4)}`,
      )
      // Sanity: tras silencio real ambos deben llegar a ~0
      expect(afterNew.last).toBeLessThan(0.02)
      expect(afterOld.last).toBeLessThan(0.02)
    })

    test(`${vibe}: pasaje suave 4s — A/B morph nuevo vs viejo`, () => {
      vi.useFakeTimers()
      vi.setSystemTime(0)

      const engineNew = new LiquidEngine41(profile)
      drive(engineNew, FRAMES_PER_SECOND, () => makeInput({ isRealSilence: true }))
      const softNew = drive(engineNew, 4 * FRAMES_PER_SECOND, () => softPassageInput())

      const old = OLD_MORPH[vibe]
      const profileOld = old ? { ...profile, ...old } : profile
      const engineOld = new LiquidEngine41(profileOld)
      drive(engineOld, FRAMES_PER_SECOND, () => makeInput({ isRealSilence: true }))
      const softOld = drive(engineOld, 4 * FRAMES_PER_SECOND, () => softPassageInput())

      console.log(
        `[${vibe}] SOFT new mean=${softNew.mean.toFixed(3)} last=${softNew.last.toFixed(3)}` +
        ` | old mean=${softOld.mean.toFixed(3)} last=${softOld.last.toFixed(3)}`,
      )
      expect.soft(softNew.mean).toBeLessThan(0.15)
    })
  }
})
