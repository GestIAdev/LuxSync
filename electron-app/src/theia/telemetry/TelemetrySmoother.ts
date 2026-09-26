/**
 * TelemetrySmoother.ts — Euclid Oracle · Fase E2 (Uniform Bridge & Smoother)
 *
 * Desacopla los dos relojes del blueprint §3.1: el anillo publica a 44 Hz
 * (telemetry clock) y el worker renderiza a la frecuencia del display
 * (render clock, rAF). Este módulo toma el scratch crudo del
 * `TelemetryWireReader` y produce:
 *
 *   1. `out` — u_tel[60] suavizado (índice = slot − 4), una subida
 *      `gl.uniform1fv` por frame (§3.2).
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

/** Horizonte de anticipación de u_approach (beats — §3.4). */
const APPROACH_HORIZON_BEATS = 8

/** Suavizado propio de u_approach (la rampa no debe saltar aunque sus
 *  inputs lo hagan — §3.4 "ponderada", no binaria). */
const APPROACH_K = 0.3

/** Fuerza de la corrección suave de u_beatTime hacia BEAT_PHASE (§3.4). */
const BEATTIME_CORRECT_K = 0.15

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
  /** u_tel[60] — índice = slot − 4. Listo para `gl.uniform1fv`. */
  readonly out = new Float32Array(TELEMETRY_PAYLOAD_SLOTS)

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

  // Estado interno de los derivados.
  private _prevEtaPositive = false
  private _kickEdgeMs = -1
  private _snareEdgeMs = -1
  private _impactMs = -1

  constructor() {
    for (const d of TELEMETRY_SCHEMA) {
      const idx = d.slot - SLOT_PAYLOAD_BASE
      this._kind[idx] = kindCode(d.kind)
      this._attackK[idx] = d.attack ?? DEFAULT_ATTACK
      this._releaseK[idx] = d.release ?? DEFAULT_RELEASE
    }
  }

  /**
   * Un paso de render. Debe llamarse en CADA frame (rAF o fallback),
   * haya o no datos nuevos — la extrapolación es lo que mantiene el
   * movimiento fluido a 60/144 Hz sobre datos publicados a 44 Hz.
   *
   * @param raw    scratch del reader (64 slots); null = aún sin frame válido.
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
      this.flags = flags
      this.enumsPacked = enums
      this.schemaVersion = enums & 0xff
      this.predictionType = (enums >>> 8) & 0xff
      this.huntState = (enums >>> 16) & 0xff
      this.energyZone = (enums >>> 24) & 0xff
    }

    if (raw !== null) {
      // ── Smoother por slot (§3.3) ──────────────────────────────────────
      for (const d of TELEMETRY_SCHEMA) {
        const idx = d.slot - SLOT_PAYLOAD_BASE
        const target = raw[d.slot]
        switch (this._kind[idx]) {
          case KIND_NONE:
            out[idx] = target
            break
          case KIND_LINEAR: {
            const k = target > out[idx] ? this._attackK[idx] : this._releaseK[idx]
            // Corrección de dt: k' = 1 − (1−k)^(dt·60) — curva idéntica a
            // cualquier frecuencia de refresco.
            const kk = 1 - Math.pow(1 - k, dtF)
            out[idx] += (target - out[idx]) * kk
            break
          }
          case KIND_CIRCULAR: {
            // Interpolación angular [0,1) por el camino corto (§3.3).
            let dd = target - out[idx]
            dd -= Math.round(dd)
            const kk = 1 - Math.pow(1 - CIRCULAR_K, dtF)
            let v = out[idx] + dd * kk
            v -= Math.floor(v)
            out[idx] = v
            break
          }
          // KIND_EXTRAPOLATE se procesa fuera del bucle (re-ancla + avance).
          default:
            break
        }
      }

      this._stepExtrapolated(raw, fresh, dtMs, dtS, bps)
      this._stepDerived(raw, dtF, dtS, bps, nowMs)
    }
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
