/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔥 WAVE 8417 — MOVER SUSTAIN REGRESSION (Apocalipsis Efímero + Anti-sustain)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Síntoma reportado: movers encendidos casi fijos en TODAS las vibes (incluido
 * rave, no tocado por WAVE 8410-B) — solo se apagaban en silencios obvios, y
 * en rave ambos diamantes se encendían a la vez (pinning por chaosEnergy).
 *
 * Causa endémica:
 *   · Apocalypse = gate binario por frame, sin enter-gate ni burnout → con
 *     umbrales bajo el régimen post-AGC el "modo" era permanente y clavaba
 *     moverL = moverR = max(mid, treble).
 *   · envTreble/envVocal sin sustainedSquelch → notas planas congelaban el
 *     envelope arriba segundos (avgMidProfiler ~2.5s de memoria térmica).
 *
 * Invariantes de regresión (lo que NO puede volver a pasar):
 *   1. El apocalipsis es un EVENTO: con harshness/flatness sostenidos sobre
 *      el umbral, el estado quema y se APAGA (isApocalypse false tras
 *      burnout) — y los movers recuperan independencia (min(L,R) toca negro).
 *   2. Una señal plana sostenida es asfixiada por el anti-sustain del engine
 *      (envTreble/envVocal) — la salida decae aunque la señal siga viva.
 *   3. Groove dinámico mantiene contraste — algún valle oscuro existe.
 *   4. Silencio real → 0.000 (blackout gate intacto).
 *
 * chill-lounge NO está aquí: es performance estática desconectada del audio.
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
    flatness: 0.30,
    bpm: 120,
    ...over,
  }
}

/**
 * Groove REALISTA: hi-hats en semicorcheas (pulso/valle), kick en beat,
 * melodía con respiración Y huecos de frase (1.5s on / 0.5s off — una
 * frase real respira; sin el hueco la señal es continua y la oscuridad
 * no es físicamente esperable). 120bpm, 16ths ≈ cada 5 frames @44Hz.
 */
function grooveDynamicInput(frame: number, kickPulse: boolean): LiquidStereoInput {
  const hhPhase = frame % 5 === 0
  const snarePhase = frame % 11 === 5
  const phraseOn = frame % 88 < 66   // 1.5s de frase → 0.5s de hueco
  const melody = phraseOn ? 0.28 + 0.15 * Math.sin(frame / 14) : 0.06
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

/** Señal plana sostenida — pad/nota sostenida (velocity≈0 cada frame). */
function flatSustainInput(): LiquidStereoInput {
  return makeInput({
    bands: {
      subBass: 0.15, bass: 0.15, lowMid: 0.30, mid: 0.55,
      highMid: 0.40, treble: 0.30, ultraAir: 0.10,
    },
    flatness: 0.25,
    harshness: 0.40,
  })
}

interface DriveStats {
  mean: number
  min: number
  last: number
  darkFrac: number
}

function driveMovers(
  engine: LiquidEngine41,
  frames: number,
  makeFrame: (f: number) => LiquidStereoInput,
): DriveStats {
  let max2 = 0, min = Infinity, sum = 0, last = 0, dark = 0
  for (let f = 0; f < frames; f++) {
    const res = engine.applyBands(makeFrame(f))
    last = Math.max(res.moverLeftIntensity, res.moverRightIntensity)
    if (last > max2) max2 = last
    if (last < min) min = last
    if (last < 0.05) dark++
    sum += last
    vi.advanceTimersByTime(FRAME_MS)
  }
  return {
    mean: frames ? sum / frames : 0,
    min: frames ? min : 0,
    last,
    darkFrac: frames ? dark / frames : 0,
  }
}

const PROFILES: Array<[string, ILiquidProfile]> = [
  ['techno-club',   PROFILE_REGISTRY['techno-club']],
  ['fiesta-latina', PROFILE_REGISTRY['fiesta-latina']],
  ['pop-rock',      PROFILE_REGISTRY['pop-rock']],
  ['rave',          PROFILE_REGISTRY['rave']],
]

describe('WAVE 8417 — Mover sustain regression (LiquidEngine41)', () => {
  afterEach(() => vi.useRealTimers())

  // ═══════════════════════════════════════════════════════════════════
  // P1 — EPHEMERAL APOCALYPSE: el estado quema y libera los movers
  // ═══════════════════════════════════════════════════════════════════
  test('rave: harshness/flatness sostenidos → el apocalipsis ENTRA, QUEMA y libera los movers', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const engine = new LiquidEngine41(PROFILE_REGISTRY['rave'])
    // Sin warmup de silencio: estado fresco, condición cierta desde t=0 →
    // enter ~500ms → burn hasta ~2500ms → cooldown hasta ~5500ms.
    let bothPinOn = 0, onFrames = 0
    let bothPinOff = 0, offFrames = 0
    let minBothAfterBurn = Infinity
    let sawActive = false
    let apocAt4s: boolean | undefined
    for (let f = 0; f < 6 * FRAMES_PER_SECOND; f++) {
      const res = engine.applyBands({
        ...grooveDynamicInput(f, f % 11 === 0),
        harshness: 0.50,
        flatness: 0.45,
      })
      const both = Math.min(res.moverLeftIntensity, res.moverRightIntensity)
      const t = f * FRAME_MS
      if (engine.lastFrame?.isApocalypse) sawActive = true
      if (t >= 3900 && t <= 4100) apocAt4s = engine.lastFrame?.isApocalypse
      if (t >= 550 && t <= 2400) {           // ventana BURN
        onFrames++
        if (both > 0.12) bothPinOn++
      } else if (t >= 2600 && t <= 5400) {   // ventana OFF (post-burnout, en cooldown)
        offFrames++
        if (both > 0.12) bothPinOff++
        if (both < minBothAfterBurn) minBothAfterBurn = both
      }
      vi.advanceTimersByTime(FRAME_MS)
    }

    // 1) El estado quemado existe y luego se apaga aunque la condición siga.
    //    (A los ~6s puede haber re-entrado — cooldown 3s + enter 0.5s — eso
    //    es CORRECTO: el apocalipsis puede volver, pero nunca quedarse.)
    expect(sawActive).toBe(true)
    expect(apocAt4s).toBe(false)

    // 2) Tras el burnout los movers se desacoplan: existe oscuridad real en
    //    el más débil (antes: min(min(L,R)) = 0.070 — nunca tocaba negro).
    expect(minBothAfterBurn).toBeLessThan(0.05)

    // 3) El pinning simultáneo cae respecto a la ventana de burn.
    const pctOn = bothPinOn / Math.max(1, onFrames)
    const pctOff = bothPinOff / Math.max(1, offFrames)
    console.log(`[rave APO] burn bothPin=${(pctOn * 100).toFixed(1)}% → off ${(pctOff * 100).toFixed(1)}% | minBothOff=${minBothAfterBurn.toFixed(3)}`)
    expect(pctOff).toBeLessThanOrEqual(0.45)
  })

  test('techno: harshness 0.50 / flatness 0.45 NO entra en apocalipsis (umbrales 0.55)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const engine = new LiquidEngine41(PROFILE_REGISTRY['techno-club'])
    for (let f = 0; f < 6 * FRAMES_PER_SECOND; f++) {
      engine.applyBands({
        ...grooveDynamicInput(f, f % 11 === 0),
        harshness: 0.50,
        flatness: 0.45,
      })
      vi.advanceTimersByTime(FRAME_MS)
    }
    expect(engine.lastFrame?.isApocalypse).toBe(false)
  })

  // ═══════════════════════════════════════════════════════════════════
  // P2 — ANTI-SUSTAIN: la nota plana sostenida se asfixia sola
  // ═══════════════════════════════════════════════════════════════════
  for (const [vibe, profile] of PROFILES) {
    test(`${vibe}: señal plana sostenida 4s → el mover se asfixia (anti-sustain)`, () => {
      vi.useFakeTimers()
      vi.setSystemTime(0)
      const engine = new LiquidEngine41(profile)
      driveMovers(engine, FRAMES_PER_SECOND, () => makeInput({ isRealSilence: true }))

      // Primer segundo: deja que el envelope dispare (transitorio inicial)
      const early = driveMovers(engine, FRAMES_PER_SECOND, () => flatSustainInput())
      // 3s más de la MISMA señal plana — el tracker acumula sustainedFrames
      // (66/88f) → squelch escala + avgSignal persigue → la nota muere.
      const late = driveMovers(engine, 3 * FRAMES_PER_SECOND, () => flatSustainInput())

      console.log(`[${vibe}] flat-sustain: early mean=${early.mean.toFixed(3)} → late mean=${late.mean.toFixed(3)} last=${late.last.toFixed(4)}`)
      // El movimiento residual debe ser mucho menor que el pico inicial —
      // y en el tramo final la luminaria cae a <15% sostenido.
      expect(late.mean).toBeLessThan(Math.max(0.15, early.mean * 0.5))
    })
  }

  // ═══════════════════════════════════════════════════════════════════
  // CONTRASTE — groove dinámico conserva valles oscuros
  // ═══════════════════════════════════════════════════════════════════
  for (const [vibe, profile] of PROFILES) {
    test(`${vibe}: groove dinámico 4s — existe oscuridad entre frases y silencio → 0`, () => {
      vi.useFakeTimers()
      vi.setSystemTime(0)
      const engine = new LiquidEngine41(profile)
      driveMovers(engine, FRAMES_PER_SECOND, () => makeInput({ isRealSilence: true }))

      const groove = driveMovers(engine, 4 * FRAMES_PER_SECOND, (f) => grooveDynamicInput(f, f % 11 === 0))
      const silence = driveMovers(engine, 2 * FRAMES_PER_SECOND, () => makeInput({ isRealSilence: true }))

      console.log(`[${vibe}] groove mean=${groove.mean.toFixed(3)} min=${groove.min.toFixed(3)} dark=${(groove.darkFrac * 100).toFixed(1)}% | silence end=${silence.last.toFixed(4)}`)
      // Contraste real: en el hueco de frase (mid cae a 0.06 durante 0.5s)
      // el mover más fuerte debe caer a valle — no negro absoluto (los hats
      // siguen alimentando los envelopes, y eso es musicalmente correcto),
      // pero sí una caída visible. Pre-fix: techno p10=0.34, latino 0.49 —
      // nunca bajaban del 30%.
      expect(groove.min).toBeLessThan(0.15)
      // Blackout sanity: silencio real → cero absoluto.
      expect(silence.last).toBeLessThan(0.02)
    })
  }

  // ═══════════════════════════════════════════════════════════════════
  // P4 — TELEMETRÍA: physicsTel publica el estado quemado, no el umbral
  // ═══════════════════════════════════════════════════════════════════
  test('physicsTel.isApocalypse refleja el estado BURN (entra tarde, se apaga con burnout)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const engine = new LiquidEngine41(PROFILE_REGISTRY['rave'])
    const pt = (engine as unknown as { physicsTel: { isApocalypse: boolean; apocEnergy: number } }).physicsTel

    // Sin warmup de silencio: éste fija un cooldown de 3s (WAVE 8417 — el
    // vacío mata el caos) y taparía la ventana de entrada.
    expect(pt.isApocalypse).toBe(false)

    // Condición cierta desde frame 0 — el enter-gate (500ms) retrasa el BURN.
    for (let f = 0; f < 10; f++) {
      engine.applyBands(makeInput({ harshness: 0.50, flatness: 0.45,
        bands: { subBass: 0.3, bass: 0.4, lowMid: 0.3, mid: 0.45, highMid: 0.35, treble: 0.30, ultraAir: 0.1 } }))
      vi.advanceTimersByTime(FRAME_MS)
    }
    // ~230ms — la condición es cierta pero el estado aún NO ha entrado.
    expect(pt.isApocalypse).toBe(false)

    // Sobrepasa enterMs → BURN activo con energía alta.
    for (let f = 0; f < 20; f++) {
      engine.applyBands(makeInput({ harshness: 0.50, flatness: 0.45,
        bands: { subBass: 0.3, bass: 0.4, lowMid: 0.3, mid: 0.45, highMid: 0.35, treble: 0.30, ultraAir: 0.1 } }))
      vi.advanceTimersByTime(FRAME_MS)
    }
    expect(pt.isApocalypse).toBe(true)
    expect(pt.apocEnergy).toBeGreaterThan(0.3)

    // Burnout (2s) + condición SIGUE cierta → el estado ya salió.
    for (let f = 0; f < 2 * FRAMES_PER_SECOND; f++) {
      engine.applyBands(makeInput({ harshness: 0.50, flatness: 0.45,
        bands: { subBass: 0.3, bass: 0.4, lowMid: 0.3, mid: 0.45, highMid: 0.35, treble: 0.30, ultraAir: 0.1 } }))
      vi.advanceTimersByTime(FRAME_MS)
    }
    expect(pt.isApocalypse).toBe(false)
    expect(pt.apocEnergy).toBe(0)
  })
})
