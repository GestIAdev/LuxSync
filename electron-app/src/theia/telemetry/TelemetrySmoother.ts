/**
 * TelemetrySmoother.ts — Euclid Oracle · Fase E2 (Uniform Bridge & Smoother)
 *
 * Desacopla los dos relojes del blueprint §3.1: el anillo publica a 44 Hz
 * (telemetry clock) y el worker renderiza a la frecuencia del display
 * (render clock, rAF). Este módulo toma el scratch crudo del
 * `TelemetryWireReader` y produce:
 *
 *   1. `out` — u_tel[124] suavizado (índice = slot − 4), una subida
 *      `gl.uniform1fv` por frame (§3.2). 🔮 WAVE 8278 · F1: página B.
 *   2. Derivados del oráculo (§3.4): beatTime, kickPulse, snarePulse,
 *      predictiveEta, approach, impact.
 *
 * Suavizado por slot desde `TELEMETRY_SCHEMA` (fuente única de verdad):
 *   · 'linear'      one-pole attack/release — coeficiente corregido por dt:
 *                   k' = 1 − (1−k)^(dt·60) → curvas idénticas a 60/144 Hz.
 *   · 'circular'    mismo one-pole pero por el camino corto (wrap 1→0):
 *                   hue y fases.
 *   · 'extrapolate' el slot avanza por su tasa entre publicaciones
 *                   (ETA cuenta atrás, BEAT_PHASE avanza con el tempo) y se
 *                   re-ancla al valor crudo en cada frame nuevo.
 *   · 'none'        verbatim (reloj, reservas).
 *
 * Zero-alloc: todas las tablas/scratches se pre-asignan en el constructor;
 * `step()` no instancia nada.
 */

import {
  SLOT_PAYLOAD_BASE,
  TELEMETRY_PAYLOAD_SLOTS,
  TELEMETRY_PAYLOAD_SLOTS_V1,
  TELEMETRY_SCHEMA,
  TELEMETRY_SLOT,
  TEL_FLAG,
  type TelSmoothKind,
} from './TheiaTelemetryRing'

// ─────────────────────────── Constantes §3.3/§3.4 ──────────────────────────

/** Coeficientes por defecto para slots 'linear' sin attack/release explícito
 *  (la mayoría del schema). Convergencia ~3 frames @60 Hz de subida, cola suave. */
const DEFAULT_ATTACK = 0.5
const DEFAULT_RELEASE = 0.2

/** Coeficiente para slots 'circular' (camino corto sobre [0,1)). */
const CIRCULAR_K = 0.35

/** τ del pulso de kick/snare en fracción del período del beat (§3.4). */
const PULSE_TAU_BEATS = 0.25

/** τ del pulso de impacto (constante absoluta — §3.4 no da tempo-relative). */
const IMPACT_TAU_MS = 220

/** 🧠 WAVE 8275 — τ del pulso de cresta CF>2 (evento de latencia cero:
 *  más rápido que los pulsos musicales — no debe heredar el tempo). */
const CREST_TAU_MS = 110

/** 🧠 WAVE 8275 — τ del pulso Glass Break (ruptura soberana — visible). */
const GLASS_BREAK_TAU_MS = 380

/** 🌊 WAVE 8279 · F4 — τ del onset vocal (aparición lenta — respiración). */
const VOCAL_ONSET_TAU_MS = 600

/** 🌊 WAVE 8279 · F4 — τ del rebote tras vacío rítmico (§2.3). */
const VOID_RELEASE_TAU_MS = 450

/** 🌊 WAVE 8279 · F4 — ln(1−k) del coeficiente circular, hoist a módulo. */
const LN1M_CIRCULAR = Math.log(1 - CIRCULAR_K)

/** Horizonte de anticipación de u_approach (beats — §3.4). */
const APPROACH_HORIZON_BEATS = 8

/** Suavizado propio de u_approach (la rampa no debe saltar aunque sus
 *  inputs lo hagan — §3.4 "ponderada", no binaria). */
const APPROACH_K = 0.3

/** Fuerza de la corrección suave de u_beatTime hacia BEAT_PHASE (§3.4). */
const BEATTIME_CORRECT_K = 0.15

// ─────────────────────────── 🔬 WAVE 8281-RECON — diag ─────────────────────────
//
// Monitor de diagnóstico en vivo (~10 Hz). Se activa en runtime — sin build:
//   · worker (pipeline principal): devtools → contexto worker →
//     `self.__EUCLID_TEL_DIAG__ = true`
//   · página (TheiaOutputView, modo B): `window.__EUCLID_TEL_DIAG__ = true`
// Apagado cuesta una lectura de propiedad por frame. Encendido imprime los
// valores EXACTOS que entran a la UBO (out suavizado + raw entre paréntesis).
const TEL_DIAG_INTERVAL_MS = 100

function telDiagOn(): boolean {
  return Boolean(
    (globalThis as { __EUCLID_TEL_DIAG__?: unknown }).__EUCLID_TEL_DIAG__,
  )
}

// Kind codes internos (Uint8 — cero alloc, lookups planos).
const KIND_NONE = 0
const KIND_LINEAR = 1
const KIND_CIRCULAR = 2
const KIND_EXTRAPOLATE = 3

function kindCode(k: TelSmoothKind): number {
  switch (k) {
    case 'linear': return KIND_LINEAR
    case 'circular': return KIND_CIRCULAR
    case 'extrapolate': return KIND_EXTRAPOLATE
    default: return KIND_NONE
  }
}

export class TelemetrySmoother {
  /** u_tel[124] — índice = slot − 4. Listo para `gl.uniform1fv`/UBO. */
  readonly out = new Float32Array(TELEMETRY_PAYLOAD_SLOTS)
  /**
   * 🔮 WAVE 8278 · F1 — vista de la PÁGINA A (u_tel[60]) para el shader
   * builtin WebGL1, que conserva `uniform float u_tel[60]`: subir `out`
   * entero (124) sería INVALID_OPERATION. Precreada una vez — zero-alloc.
   */
  readonly outV1 = this.out.subarray(0, TELEMETRY_PAYLOAD_SLOTS_V1)

  // ── Derivados del oráculo (§3.4) — escalares, se suben como uniforms ──
  /** Beats acumulados continuos, re-anclados a BEAT_PHASE suavemente. */
  beatTime = 0
  /** 🌊 WAVE 8259 — escala del master SPEED sobre el reloj musical. El host
   *  la escribe desde `u_speed` antes de cada `step()`; el anclaje suave a
   *  BEAT_PHASE se conserva (los flancos siguen en el beat real — lo que
   *  se ralentiza es la evolución continua entre beats). */
  masterSpeed = 1.0
  /** exp(−t_since_edge / τ) disparado por el flanco KICK_EDGE. */
  kickPulse = 0
  /** Ídem con el flanco SNARE. */
  snarePulse = 0
  /** ETA fluido en SEGUNDOS: SEL_ETA_MS extrapolado entre publicaciones. */
  predictiveEtaSec = 0
  /** Rampa oráculo (1 − clamp(etaBeats/8,0,1)) · predProb · confidence. */
  approach = 0
  /** Pulso de impacto: ETA cruza 0 (o KICK_EDGE) con predicción activa. */
  impact = 0
  /** 🧠 WAVE 8275 — u_crestPulse: exp(−t/110ms) desde el flanco CREST_EVENT. */
  crestPulse = 0
  /** 🧠 WAVE 8275 — u_strobeGate: nivel 0/1 del StrobeEngine de GodEar. */
  strobeGate = 0
  /** 🧠 WAVE 8275 — u_glassBreak: exp(−t/380ms) desde el flanco GLASS_BREAK. */
  glassBreak = 0
  /** 🌊 WAVE 8279 · F4 — u_vocalOnset: exp(−t/600ms) desde VOCAL_ONSET. */
  vocalOnset = 0
  /** 🌊 WAVE 8279 · F4 — u_snareTruePulse: exp(−t/¼beat) desde SNARE_TRUE
   *  (la caja sin falsos positivos vocales — detector MACD). */
  snareTruePulse = 0
  /** 🌊 WAVE 8279 · F4 — u_voidRelease: A·exp(−t/450ms) desde VOID_RELEASE,
   *  A = clamp(voidHold_previo/8s, 0.25, 1) — el rebote es proporcional a
   *  lo que duró el vacío (§2.3). */
  voidRelease = 0

  // ── Header del último frame ingerido ──
  flags = 0
  enumsPacked = 0
  schemaVersion = 0
  predictionType = 0
  huntState = 0
  energyZone = 0

  // Tablas por-slot (índice = slot − 4).
  private readonly _kind = new Uint8Array(TELEMETRY_PAYLOAD_SLOTS)
  private readonly _attackK = new Float32Array(TELEMETRY_PAYLOAD_SLOTS)
  private readonly _releaseK = new Float32Array(TELEMETRY_PAYLOAD_SLOTS)
  // 🌊 WAVE 8279 · F4 — ln(1−k) precalculado: kk = 1 − exp(dtF·ln1k)
  // (una transcendente por slot en lugar de Math.pow — §1 tabla).
  private readonly _ln1mAtk = new Float32Array(TELEMETRY_PAYLOAD_SLOTS)
  private readonly _ln1mRel = new Float32Array(TELEMETRY_PAYLOAD_SLOTS)
  // 🌊 WAVE 8279 · F4 — tablas de índices activos (§1): el bucle itera
  // solo los slots que necesitan matemática; 'none' → copia verbatim en
  // lote; 'extrapolate' → fuera del bucle como siempre.
  private readonly _linIdx: Uint8Array
  private readonly _circIdx: Uint8Array
  private readonly _noneIdx: Uint8Array

  // Estado interno de los derivados.
  private _prevEtaPositive = false
  private _kickEdgeMs = -1
  private _snareEdgeMs = -1
  private _impactMs = -1
  private _crestEdgeMs = -1
  private _glassBreakMs = -1
  private _vocalOnsetMs = -1
  private _snareTrueMs = -1
  private _voidReleaseMs = -1
  private _voidReleaseAmp = 0
  private _lastVoidHold = 0

  // 🔬 WAVE 8281-RECON — estado del monitor de diagnóstico (~10 Hz).
  private _diagLastMs = -1
  private _diagVTPrev = 0
  private _diagVTPrevMs = -1
  private _diagBTPrev = 0
  private _diagFresh = 0
  private _diagFrames = 0

  constructor() {
    let nLin = 0
    let nCirc = 0
    let nNone = 0
    for (const d of TELEMETRY_SCHEMA) {
      const idx = d.slot - SLOT_PAYLOAD_BASE
      const kc = kindCode(d.kind)
      this._kind[idx] = kc
      const atk = d.attack ?? DEFAULT_ATTACK
      const rel = d.release ?? DEFAULT_RELEASE
      this._attackK[idx] = atk
      this._releaseK[idx] = rel
      this._ln1mAtk[idx] = Math.log(1 - atk)
      this._ln1mRel[idx] = Math.log(1 - rel)
      if (kc === KIND_LINEAR) nLin++
      else if (kc === KIND_CIRCULAR) nCirc++
      else if (kc === KIND_NONE) nNone++
    }
    this._linIdx = new Uint8Array(nLin)
    this._circIdx = new Uint8Array(nCirc)
    this._noneIdx = new Uint8Array(nNone)
    let iL = 0
    let iC = 0
    let iN = 0
    for (const d of TELEMETRY_SCHEMA) {
      const idx = d.slot - SLOT_PAYLOAD_BASE
      const kc = this._kind[idx]
      if (kc === KIND_LINEAR) this._linIdx[iL++] = idx
      else if (kc === KIND_CIRCULAR) this._circIdx[iC++] = idx
      else if (kc === KIND_NONE) this._noneIdx[iN++] = idx
    }
  }

  /**
   * Un paso de render. Debe llamarse en CADA frame (rAF o fallback),
   * haya o no datos nuevos — la extrapolación es lo que mantiene el
   * movimiento fluido a 60/144 Hz sobre datos publicados a 44 Hz.
   *
   * @param raw    scratch del reader (128 slots); null = aún sin frame válido.
   * @param flags  bitfield del frame ingerido (válido solo si `fresh`).
   * @param enums  ENUMS empaquetados del frame ingerido.
   * @param fresh  `reader.read()` devolvió true este frame.
   * @param dtMs   delta REAL del frame de render (ms).
   * @param nowMs  reloj monotónico de render (ms — performance.now()).
   */
  step(
    raw: Float32Array | null,
    flags: number,
    enums: number,
    fresh: boolean,
    dtMs: number,
    nowMs: number,
  ): void {
    const out = this.out
    const dtS = dtMs / 1000
    const dtF = dtS * 60 // equivalencia en frames @60Hz (corrección de k)
    const rawBpm = raw !== null ? raw[TELEMETRY_SLOT.BPM] : 0
    const bps = rawBpm > 0 ? rawBpm / 60 : 0

    // ── Ingesta de frame nuevo: flags, enums, edge detection ──────────
    if (fresh && raw !== null) {
      const kickBit = 1 << TEL_FLAG.KICK_EDGE
      const snareBit = 1 << TEL_FLAG.SNARE
      const predBit = 1 << TEL_FLAG.PREDICTION_ACTIVE
      // El bit en un frame FRESCO ya es un flanco: el writer publica el flag
      // solo en el tick en que ocurre el evento. Si dos publicaciones
      // consecutivas lo llevan, son dos eventos reales → ambos disparan.
      if ((flags & kickBit) !== 0) {
        this._kickEdgeMs = nowMs
        // §3.4: u_impact también se dispara con KICK_EDGE + PREDICTING.
        if ((flags & predBit) !== 0) this._impactMs = nowMs
      }
      if ((flags & snareBit) !== 0) {
        this._snareEdgeMs = nowMs
      }
      // 🧠 WAVE 8275 — flancos cognitivos: misma semántica de evento por
      // publicación (un bit encendido = un flanco).
      if ((flags & (1 << TEL_FLAG.CREST_EVENT)) !== 0) {
        this._crestEdgeMs = nowMs
      }
      if ((flags & (1 << TEL_FLAG.GLASS_BREAK)) !== 0) {
        this._glassBreakMs = nowMs
      }
      // 🌊 WAVE 8279 · F4 — flancos de página B (§2.3).
      if ((flags & (1 << TEL_FLAG.VOCAL_ONSET)) !== 0) {
        this._vocalOnsetMs = nowMs
      }
      if ((flags & (1 << TEL_FLAG.SNARE_TRUE)) !== 0) {
        this._snareTrueMs = nowMs
      }
      // VOID_RELEASE: la amplitud sale del VOID_HOLD observado ANTES del
      // reset — en el frame del flanco el host ya publica 0, así que se
      // usa el pico reciente (max del hold actual vs el del frame previo).
      if ((flags & (1 << TEL_FLAG.VOID_RELEASE)) !== 0) {
        this._voidReleaseMs = nowMs
        this._voidReleaseAmp = Math.min(
          1,
          Math.max(0.25, Math.max(raw[TELEMETRY_SLOT.VOID_HOLD], this._lastVoidHold) / 8),
        )
      }
      this._lastVoidHold = raw[TELEMETRY_SLOT.VOID_HOLD]
      this.flags = flags
      this.enumsPacked = enums
      this.schemaVersion = enums & 0xff
      this.predictionType = (enums >>> 8) & 0xff
      this.huntState = (enums >>> 16) & 0xff
      this.energyZone = (enums >>> 24) & 0xff
    }

    if (raw !== null) {
      // ── Smoother por slot (§3.3) — 🌊 WAVE 8279 · F4: iteración por
      // tablas de índices activos (§1). Sin switch por slot: los ~40
      // reservados/crudos van a copia verbatim en lote; los extrapolate
      // siguen fuera del bucle. kk = 1 − exp(dtF·ln(1−k)) ≡ 1−(1−k)^dtF.
      const linIdx = this._linIdx
      const lnAtk = this._ln1mAtk
      const lnRel = this._ln1mRel
      for (let i = 0; i < linIdx.length; i++) {
        const idx = linIdx[i]
        const target = raw[idx + SLOT_PAYLOAD_BASE]
        const kk = 1 - Math.exp(dtF * (target > out[idx] ? lnAtk[idx] : lnRel[idx]))
        out[idx] += (target - out[idx]) * kk
      }
      const circIdx = this._circIdx
      const circK = 1 - Math.exp(dtF * LN1M_CIRCULAR) // mismo k para todos
      for (let i = 0; i < circIdx.length; i++) {
        const idx = circIdx[i]
        // Interpolación angular [0,1) por el camino corto (§3.3).
        let dd = raw[idx + SLOT_PAYLOAD_BASE] - out[idx]
        dd -= Math.round(dd)
        let v = out[idx] + dd * circK
        v -= Math.floor(v)
        out[idx] = v
      }
      const noneIdx = this._noneIdx
      for (let i = 0; i < noneIdx.length; i++) {
        const idx = noneIdx[i]
        out[idx] = raw[idx + SLOT_PAYLOAD_BASE]
      }

      this._stepExtrapolated(raw, fresh, dtMs, dtS, bps)
      this._stepDerived(raw, dtF, dtS, bps, nowMs)
    }

    // 🔬 WAVE 8281-RECON — monitor de diagnóstico (off = 1 lectura de prop).
    if (telDiagOn()) this._diagTick(raw, flags, fresh, nowMs)
  }

  // ───────────────── 🔬 WAVE 8281-RECON — monitor ~10 Hz ─────────────────

  /**
   * Imprime los valores EXACTOS que entran a la UBO (columna `out`) junto al
   * raw publicado por el DSP (columna `raw`), más los relojes derivados y la
   * réplica matemática de `euTimbre()`. Solo corre con `__EUCLID_TEL_DIAG__`
   * truthy — las asignaciones de strings a 10 Hz son aceptables en modo diag.
   */
  private _diagTick(
    raw: Float32Array | null,
    flags: number,
    fresh: boolean,
    nowMs: number,
  ): void {
    this._diagFrames++
    if (fresh) this._diagFresh++
    if (this._diagLastMs < 0) {
      this._diagLastMs = nowMs
      console.info(
        '[TELDIAG] WAVE 8281-RECON — monitor ~10Hz ON. ' +
          'Apagar: __EUCLID_TEL_DIAG__ = 0',
      )
      return
    }
    const el = nowMs - this._diagLastMs
    if (el < TEL_DIAG_INTERVAL_MS) return

    const telHz = (this._diagFresh * 1000) / el
    const fps = (this._diagFrames * 1000) / el
    this._diagLastMs = nowMs
    this._diagFrames = 0
    this._diagFresh = 0

    if (raw === null) {
      console.info(
        `[TELDIAG] sin frames de telemetría (render ${fps.toFixed(0)}fps) — ` +
          'ring vacío o pump apagado',
      )
      return
    }

    const out = this.out
    const f = (x: number): string => x.toFixed(2)
    const ro = (slot: number): string =>
      `${f(raw[slot])}→${f(out[slot - SLOT_PAYLOAD_BASE])}`

    // Tasa de u_vocalTime — el host integra vocalIsolation·dt, así que la
    // tasa esperada ≈ vIso. Si vT va a tirones o se clava → reloj roto.
    const vt = out[TELEMETRY_SLOT.VOCAL_TIME - SLOT_PAYLOAD_BASE]
    const vtRate =
      this._diagVTPrevMs >= 0
        ? ((vt - this._diagVTPrev) * 1000) / (nowMs - this._diagVTPrevMs)
        : 0
    this._diagVTPrev = vt
    this._diagVTPrevMs = nowMs
    const btRate = ((this.beatTime - this._diagBTPrev) * 1000) / el
    this._diagBTPrev = this.beatTime

    // Réplica EXACTA de euTimbre() del preámbulo GLSL (w², Σ=1, fallback).
    const vIso = out[TELEMETRY_SLOT.VOCAL_ISOLATION - SLOT_PAYLOAD_BASE]
    const syn = out[TELEMETRY_SLOT.SYNTH_SUSTAIN - SLOT_PAYLOAD_BASE]
    const perc = out[TELEMETRY_SLOT.PERCUSSIVENESS - SLOT_PAYLOAD_BASE]
    const grain = Math.max(
      out[TELEMETRY_SLOT.WHITE_NOISE - SLOT_PAYLOAD_BASE],
      out[TELEMETRY_SLOT.SPECTRAL_DENSITY - SLOT_PAYLOAD_BASE],
    )
    const wv = vIso * vIso
    const ws = syn * syn
    const wp = perc * perc
    const wg = grain * grain
    const wsum = wv + ws + wp + wg
    const timbre =
      wsum > 1e-4
        ? `v${f(wv / wsum)} s${f(ws / wsum)} p${f(wp / wsum)} g${f(wg / wsum)}`
        : 'v0.00 s1.00 p0.00 g0.00 (fallback)'

    let fl = ''
    if ((flags & (1 << TEL_FLAG.VOCAL_ONSET)) !== 0) fl += ' VON'
    if ((flags & (1 << TEL_FLAG.SNARE_TRUE)) !== 0) fl += ' SNT'
    if ((flags & (1 << TEL_FLAG.VOID_RELEASE)) !== 0) fl += ' VRL'
    if ((flags & (1 << TEL_FLAG.REAL_SILENCE)) !== 0) fl += ' SIL'
    if ((flags & (1 << TEL_FLAG.GATE_DEAD)) !== 0) fl += ' GDE'
    if ((flags & (1 << TEL_FLAG.NOISE_MODE)) !== 0) fl += ' NZM'
    if ((flags & (1 << TEL_FLAG.KICK_EDGE)) !== 0) fl += ' KCK'
    if ((flags & (1 << TEL_FLAG.PREDICTION_ACTIVE)) !== 0) fl += ' PRD'

    console.info(
      `[TELDIAG] vIso ${ro(TELEMETRY_SLOT.VOCAL_ISOLATION)}` +
        ` | vSus ${ro(TELEMETRY_SLOT.VOCAL_SUSTAIN)}` +
        ` | syn ${ro(TELEMETRY_SLOT.SYNTH_SUSTAIN)}` +
        ` | perc ${ro(TELEMETRY_SLOT.PERCUSSIVENESS)}` +
        ` | mel ${ro(TELEMETRY_SLOT.MELODICITY)}` +
        ` | wn ${f(raw[TELEMETRY_SLOT.WHITE_NOISE])} sd ${f(raw[TELEMETRY_SLOT.SPECTRAL_DENSITY])}` +
        ` | vT ${f(vt)}s (${vtRate >= 0 ? '+' : ''}${vtRate.toFixed(2)}/s)` +
        ` bt ${btRate >= 0 ? '+' : ''}${btRate.toFixed(2)}/s` +
        ` | void ${f(out[TELEMETRY_SLOT.RHYTHMIC_VOID - SLOT_PAYLOAD_BASE])}` +
        ` hold ${f(raw[TELEMETRY_SLOT.VOID_HOLD])}` +
        ` | timbre ${timbre}` +
        ` | flg${fl === '' ? ' -' : fl}` +
        ` | tel ${telHz.toFixed(0)}Hz ${fps.toFixed(0)}fps v${this.schemaVersion}`,
    )
  }

  // ─────────────────────────── Extrapolate (§3.3) ─────────────────────────

  private _stepExtrapolated(
    raw: Float32Array,
    fresh: boolean,
    dtMs: number,
    dtS: number,
    bps: number,
  ): void {
    const out = this.out

    // BEAT_PHASE — snap autoritativo al crudo en cada publicación (la fase
    // de beat del PLL es la verdad; el error de extrapolación a 44 Hz es
    // sub-perceptible) y avance por el tempo entre publicaciones.
    const bpIdx = TELEMETRY_SLOT.BEAT_PHASE - SLOT_PAYLOAD_BASE
    if (fresh) {
      out[bpIdx] = raw[TELEMETRY_SLOT.BEAT_PHASE]
    }
    out[bpIdx] += dtS * bps
    out[bpIdx] -= Math.floor(out[bpIdx])

    // SEL_ETA_MS / SEL_ETA_BEATS — countdown entre publicaciones; el valor
    // publicado ya es dinámico (E1 lo recalcula en publish) → snap al raw.
    const emIdx = TELEMETRY_SLOT.SEL_ETA_MS - SLOT_PAYLOAD_BASE
    const ebIdx = TELEMETRY_SLOT.SEL_ETA_BEATS - SLOT_PAYLOAD_BASE
    if (fresh) {
      out[emIdx] = raw[TELEMETRY_SLOT.SEL_ETA_MS]
      out[ebIdx] = raw[TELEMETRY_SLOT.SEL_ETA_BEATS]
    } else {
      out[emIdx] = Math.max(0, out[emIdx] - dtMs)
      out[ebIdx] = Math.max(0, out[ebIdx] - dtS * bps)
    }
  }

  // ─────────────────────── Derivados del oráculo (§3.4) ────────────────────

  private _stepDerived(
    raw: Float32Array,
    dtF: number,
    dtS: number,
    bps: number,
    nowMs: number,
  ): void {
    const out = this.out
    const msPerBeat = bps > 0 ? 1000 / bps : 500
    const tauPulse = PULSE_TAU_BEATS * msPerBeat

    // Pulsos musicales — envolvente exponencial desde el flanco.
    this.kickPulse =
      this._kickEdgeMs >= 0 ? Math.exp(-(nowMs - this._kickEdgeMs) / tauPulse) : 0
    this.snarePulse =
      this._snareEdgeMs >= 0 ? Math.exp(-(nowMs - this._snareEdgeMs) / tauPulse) : 0

    // u_predictiveETA — §3.4: SEL_ETA_MS/1000 − t_since_publish, clamp ≥0.
    // El slot extrapolado ya integra el elapsed → es la misma cuenta atrás.
    const etaMs = out[TELEMETRY_SLOT.SEL_ETA_MS - SLOT_PAYLOAD_BASE]
    this.predictiveEtaSec = Math.max(0, etaMs / 1000)

    // u_impact — ETA cruza 0 con predicción viva (el flanco KICK_EDGE +
    // PREDICTING ya se capturó en la ingesta).
    const predicting = (this.flags & (1 << TEL_FLAG.PREDICTION_ACTIVE)) !== 0
    if (predicting && this._prevEtaPositive && etaMs <= 0.001) {
      this._impactMs = nowMs
    }
    this._prevEtaPositive = etaMs > 0.001
    this.impact =
      this._impactMs >= 0 ? Math.exp(-(nowMs - this._impactMs) / IMPACT_TAU_MS) : 0

    // 🧠 WAVE 8275 — u_crestPulse: cresta CF>2 sin esperar la envolvente
    // RMS (τ absoluto 110 ms — reacción inmediata, §WAVE-8274-RECON).
    this.crestPulse =
      this._crestEdgeMs >= 0 ? Math.exp(-(nowMs - this._crestEdgeMs) / CREST_TAU_MS) : 0

    // 🧠 WAVE 8275 — u_glassBreak: ruptura soberana (τ 380 ms — el fog
    // debe "romperse" de forma legible, no en un solo fotograma).
    this.glassBreak =
      this._glassBreakMs >= 0 ? Math.exp(-(nowMs - this._glassBreakMs) / GLASS_BREAK_TAU_MS) : 0

    // 🌊 WAVE 8279 · F4 — pulsos de página B (§2.3).
    // u_vocalOnset — aparición lenta de la voz (τ=600ms, respiración).
    this.vocalOnset =
      this._vocalOnsetMs >= 0
        ? Math.exp(-(nowMs - this._vocalOnsetMs) / VOCAL_ONSET_TAU_MS)
        : 0
    // u_snareTruePulse — la caja MACD sin falsos positivos vocales; τ = ¼
    // de beat como kickPulse/snarePulse (tempo-relativo).
    this.snareTruePulse =
      this._snareTrueMs >= 0
        ? Math.exp(-(nowMs - this._snareTrueMs) / tauPulse)
        : 0
    // u_voidRelease — rebote ∝ al vacío que terminó (amplitud capturada
    // del VOID_HOLD previo en la ingesta).
    this.voidRelease =
      this._voidReleaseMs >= 0
        ? this._voidReleaseAmp *
          Math.exp(-(nowMs - this._voidReleaseMs) / VOID_RELEASE_TAU_MS)
        : 0

    // 🧠 WAVE 8275 — u_strobeGate: nivel binario (persiste mientras el
    // StrobeEngine esté activo — no es flanco, es un gate).
    this.strobeGate = (this.flags & (1 << TEL_FLAG.STROBE_ACTIVE)) !== 0 ? 1 : 0

    // u_approach — rampa oráculo (§3.4):
    //   (1 − clamp(etaBeats/horizon,0,1)) · predProb · confidence, 8 beats.
    const etaBeats = this.predictiveEtaSec * bps
    const predProb = out[TELEMETRY_SLOT.SEL_PRED_PROB - SLOT_PAYLOAD_BASE]
    const confidence = out[TELEMETRY_SLOT.SEL_CONFIDENCE - SLOT_PAYLOAD_BASE]
    const rampTarget = predicting
      ? (1 - Math.min(1, Math.max(0, etaBeats / APPROACH_HORIZON_BEATS))) *
        predProb *
        confidence
      : 0
    const ka = 1 - Math.pow(1 - APPROACH_K, dtF)
    this.approach += (rampTarget - this.approach) * ka

    // u_beatTime — beats acumulados continuos; re-ancla suave a BEAT_PHASE.
    // 🌊 WAVE 8259 — × masterSpeed: el fader SPEED escala el diferencial de
    // tiempo musical (paridad con el gobernador de u_time).
    this.beatTime += dtS * bps * this.masterSpeed
    const phaseTarget = out[TELEMETRY_SLOT.BEAT_PHASE - SLOT_PAYLOAD_BASE]
    let phaseErr = phaseTarget - (this.beatTime - Math.floor(this.beatTime))
    phaseErr -= Math.round(phaseErr)
    // 🌊 WAVE 8261 — Opción B (clean slow-mo): la autoridad del corrector se
    // atenúa cúbica con masterSpeed. Lineal (×s) dejaba pelea residual: a
    // 0.25× el corrector saturado (cap ≈0.019 beats/frame) casi empataba el
    // drift (0.028) → yo-yo elástico en la frontera del wrap. Con s³ la
    // fase fluye libre bajo ~0.65× y recupera anclaje pleno al volver a 1×.
    const s = this.masterSpeed
    const kcorr =
      (1 - Math.pow(1 - BEATTIME_CORRECT_K, dtF)) * s * s * s
    this.beatTime += phaseErr * kcorr
  }
}
