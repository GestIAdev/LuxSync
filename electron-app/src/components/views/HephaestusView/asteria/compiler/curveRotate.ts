/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 ASTERIA — curveRotate.ts (WAVE 8040 · MCC)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Rotación cíclica exacta de una `HephCurve` sobre el dominio [0, D).
 *
 *   rot(C, d)(τ) = C((τ − d) mod D)      — delay = RETARDO real (lag)
 *
 * 🜨 8197 (Time Arrow Reversal): `d` es un retardo — la celda reproduce el
 * instante τ−d de la fuente (llega tarde, nunca por delante). Internamente
 * se implementa como el avance equivalente D−d; la matemática de costuras
 * es idéntica.
 *
 * El blueprint §4.2/§8.3 lo usa para hornear el retardo espacial de cada celda
 * directamente en la curva (MCC-Cell) o en la curva maestra de cada cohorte
 * (Vía B): el runtime no hace matemática espacial — solo evalúa la curva ya
 * rotada. Este módulo es OFFLINE (patch-time): las alocaciones aquí no
 * violan el dogma zero-alloc, que se aplica al tick a 44 Hz.
 *
 * CONSTRUCCIÓN (sin muestreo — se preserva la estructura de keyframes):
 *
 *   1. Cada keyframe s_i se desplaza a t'_i = (s_i − d̂) mod D y se reordena
 *      ascendente → el orden rotado es [a, a+1, …, n−1, 0, …, a−1] donde
 *      d̂ = D−d es el avance equivalente del retardo y a = primer índice
 *      con s_i ≥ d̂.
 *   2. COSTURA DE BORDE (τ=0 / τ=D): el segmento fuente que cruzaba el punto
 *      de corte d (segmento a−1 → a) queda partido en dos piezas. Se inserta
 *      un keyframe en τ=0 con valor C(d) y un keyframe terminal en τ=D con el
 *      mismo valor. C(d) se evalúa con el `CurveEvaluator` de producción —
 *      semántica idéntica al runtime, no una reimplementación.
 *   3. COSTURA DE WRAP (τ* = D−d): el segmento entre el último keyframe del
 *      grupo no-envuelto (kf_{n−1}) y el primero del grupo envuelto (kf_0)
 *      contiene el salto cíclico de la fuente en D→0: cola constante
 *      (clamp del último keyframe) y cabeza constante (clamp del primero).
 *      Se reproduce con `hold` — exacto, sin aproximación.
 *   4. D-2 (blueprint): si el segmento partido era 'bezier', SOLO las dos
 *      piezas de la costura degradan a 'linear' (sin De Casteljau en esta
 *      fase). 'linear' y 'hold' son exactas en sub-segmentos y se conservan.
 *
 * INVARIANTE: rot(C, 0) === C — byte a byte (misma referencia devuelta).
 */

import type { HephCurve, HephKeyframe, HephInterpolation, HSL } from '../../../../../core/hephaestus/types'
import { CurveEvaluator } from '../../../../../core/hephaestus/CurveEvaluator'

/**
 * Rotación cíclica de `curve` por `delayMs` ms sobre un periodo `durationMs`.
 *
 * @param curve      Curva fuente (no se muta).
 * @param delayMs    Retardo temporal en ms — lag real (se normaliza mod durationMs).
 * @param durationMs Periodo del dominio cíclico D.
 * @returns Nueva HephCurve rotada, o la MISMA referencia si d ≡ 0 (mod D).
 */
export function rotateCurveCyclic(
  curve: HephCurve,
  delayMs: number,
  durationMs: number,
): HephCurve {
  const kfs = curve.keyframes
  const D = durationMs

  // Degenerados: sin periodo, sin keyframes, o constante (1 kf) → la rotación
  // es un no-op semántico; devolver la referencia preserva el invariante.
  if (!Number.isFinite(D) || D <= 0 || kfs.length <= 1) return curve

  // Normalizar delay a [0, D) — acepta negativos y múltiplos de D.
  const dl = ((delayMs % D) + D) % D
  if (dl === 0) return curve // INVARIANTE: rot(C, 0) === C, byte a byte.

  // 🜨 8197: `dl` es RETARDO → el avance equivalente es D−dl. `d` denota el
  // punto de corte fuente (avance) en toda la maquinaria de costuras.
  const d = D - dl

  const n = kfs.length

  // ── Evaluador de producción para muestrear C(d) con semántica exacta ──
  const srcEval = new CurveEvaluator(new Map([[curve.paramId, curve]]), D)
  const isColor = curve.valueType === 'color'
  const evalAt = (t: number): number | HSL => {
    if (isColor) {
      const c = srcEval.getColorValue(curve.paramId, t)
      return { h: c.h, s: c.s, l: c.l }
    }
    return srcEval.getValue(curve.paramId, t)
  }

  // ── a = primer índice con s_i ≥ d (punto de corte dentro del segmento a−1→a) ──
  let a = n
  for (let i = 0; i < n; i++) {
    if (kfs[i].timeMs >= d) { a = i; break }
  }

  // τ* = D − d: punto del dominio rotado donde la fuente cruza su wrap D→0.
  const seamTau = D - d

  /**
   * Interpolación de la pieza de costura del segmento partido (a−1 → a).
   * 'hold'/'linear' son exactas en sub-segmentos; 'bezier' degrada a 'linear'
   * por D-2. Fuera de segmento real (a=0 cabeza, a=n cola) el tramo es
   * constante por clamp del evaluator → 'hold'.
   */
  const seamInterp = (a >= 1 && a <= n - 1)
    ? _degradeSeamInterp(kfs[a - 1].interpolation)
    : 'hold'

  const cutValue = evalAt(d)

  const out: HephKeyframe[] = []

  // ── A. Keyframe de apertura en τ=0 — valor C(d) ──────────────────────
  //    Se omite si un keyframe fuente aterriza exactamente en 0 (s_a === d).
  const kfLandsAtZero = a < n && kfs[a].timeMs === d
  if (!kfLandsAtZero) {
    out.push({
      timeMs: 0,
      value: _cloneValue(cutValue),
      interpolation: seamInterp,
    })
  }

  /**
   * Emite los keyframes de la costura de wrap en τ*. La pieza izquierda ya
   * está garantizada constante forzando 'hold' sobre el último elemento
   * emitido (kf_{n−1} clonado, o el S@0 cuando a=n). La pieza derecha
   * (head-clamp) solo existe si s_0 > 0 → W2 con valor del primer keyframe.
   * Si s_0 === 0, kf_0 aterriza él mismo en τ* y aporta el valor post-salto.
   */
  const emitWrapSeam = (): void => {
    const prev = out[out.length - 1]
    if (prev) prev.interpolation = 'hold'
    if (kfs[0].timeMs > 0) {
      out.push({
        timeMs: seamTau,
        value: _cloneValue(kfs[0].value),
        interpolation: 'hold',
      })
    }
  }

  // ── B. Grupo 1 (no envuelto): índices [a, n) → t' = s_i − d ─────────
  for (let i = a; i < n; i++) {
    out.push(_cloneKf(kfs[i], kfs[i].timeMs - d))
  }

  // ── C. Costura de wrap ────────────────────────────────────────────────
  //    Entre grupo 1 y grupo 2 cuando ambos existen (1 ≤ a ≤ n−1);
  //    al final cuando todo es grupo 1 (a = 0); al inicio tras S@0 cuando
  //    todo es grupo 2 (a = n) — el `emitWrapSeam` aquí cubre a=n porque
  //    S@0 siempre se emitió en ese caso.
  emitWrapSeam()

  // ── D. Grupo 2 (envuelto): índices [0, a) → t' = s_i − d + D ────────
  for (let i = 0; i < a; i++) {
    out.push(_cloneKf(kfs[i], kfs[i].timeMs - d + D))
  }

  // ── E. Keyframe terminal en τ=D — cierra la pieza izquierda del
  //       segmento partido. Solo existe cuando la rotación partió un
  //       segmento real (1 ≤ a ≤ n−1). La interpolación hacia él vive en
  //       el último kf rotado (clon de kf_{a−1}) → se degrada igual que
  //       la pieza derecha.
  if (a >= 1 && a <= n - 1) {
    const last = out[out.length - 1]
    if (last) last.interpolation = seamInterp
    out.push({
      timeMs: D,
      value: _cloneValue(cutValue),
      interpolation: 'linear', // último kf — su interp nunca se evalúa
    })
  }

  return {
    ...curve,
    keyframes: out,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERNALS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * D-2: la costura degrada 'bezier' → 'linear'. 'linear' y 'hold' son
 * matemáticamente exactas en sub-segmentos — se conservan.
 */
function _degradeSeamInterp(interp: HephInterpolation): HephInterpolation {
  return interp === 'bezier' ? 'linear' : interp
}

/** Clona un keyframe reubicándolo en `t'` — preserva value, interp, handles y binding. */
function _cloneKf(kf: HephKeyframe, t: number): HephKeyframe {
  const clone: HephKeyframe = {
    timeMs: t,
    value: _cloneValue(kf.value),
    interpolation: kf.interpolation,
  }
  if (kf.bezierHandles) clone.bezierHandles = [...kf.bezierHandles]
  if (kf.audioBinding) {
    clone.audioBinding = {
      ...kf.audioBinding,
      inputRange: [...kf.audioBinding.inputRange],
      outputRange: [...kf.audioBinding.outputRange],
    }
  }
  return clone
}

/** Deep-copy del valor (HSL es objeto mutable; number es primitivo). */
function _cloneValue(v: number | HSL): number | HSL {
  if (typeof v === 'object' && v !== null) return { h: v.h, s: v.s, l: v.l }
  return v
}
