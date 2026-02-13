/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ CURVE EVALUATOR - THE MATHEMATICAL HEART OF HEPHAESTUS
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 2030.2: HEPHAESTUS CORE ENGINE
 * 
 * Motor de evaluación de curvas de automatización.
 * O(1) amortizado en playback normal, O(log n) en seek/scrub.
 * 
 * ARQUITECTURA:
 * - Un CurveEvaluator por HephAutomationClip
 * - Mantiene cursor cache por curva para O(1) amortizado
 * - Evaluación lazy (solo evalúa curvas que se consultan)
 * - Newton-Raphson para cubic-bezier (4 iteraciones = precisión visual)
 * - Hue interpolation por shortest-path (350° → 10° = cruzar 0°)
 * 
 * PERFORMANCE TARGET:
 *   60 FPS × 12 params × 50 efectos = 36,000 evaluaciones/segundo
 *   Cada evaluación < 10μs → Total ~2ms/frame (~12% budget)
 * 
 * @module core/hephaestus/CurveEvaluator
 * @version WAVE 2030.2
 */

import type {
  HephKeyframe,
  HephCurve,
  HephParamId,
  HephParamSnapshot,
  HSL,
} from './types'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Número de iteraciones de Newton-Raphson para cubic-bezier.
 * 4 iteraciones da precisión < 0.001 — más que suficiente para 
 * interpolación visual a 60fps. Más iteraciones = desperdicio de CPU.
 */
const NEWTON_ITERATIONS = 4

/**
 * Epsilon para convergencia de Newton-Raphson.
 * Si la derivada es menor que esto, abortamos para evitar div/0.
 */
const NEWTON_EPSILON = 1e-7

// ═══════════════════════════════════════════════════════════════════════════
// CURVE EVALUATOR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚒️ CURVE EVALUATOR
 * 
 * Motor de evaluación de curvas de automatización multi-parámetro.
 * 
 * DISEÑO:
 * Un CurveEvaluator se instancia con un Map de curvas y una duración.
 * En cada frame, se consultan los valores de los parámetros que interesan.
 * 
 * El cursor cache almacena el índice del segmento activo para cada curva.
 * En playback normal (tiempo avanza monotónicamente), el cursor solo
 * necesita avanzar 0 o 1 posiciones → O(1).
 * 
 * En seek/scrub (tiempo salta arbitrariamente), se usa binary search → O(log n).
 * 
 * USO:
 * ```typescript
 * const evaluator = new CurveEvaluator(clip.curves, clip.durationMs)
 * 
 * // En cada frame:
 * const intensity = evaluator.getValue('intensity', currentTimeMs)
 * const color = evaluator.getColorValue('color', currentTimeMs)
 * const snapshot = evaluator.getSnapshot(currentTimeMs)
 * ```
 */
export class CurveEvaluator {
  // ─────────────────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────────────────

  /** Curvas indexadas por paramId */
  private readonly curves: Map<HephParamId, HephCurve>

  /**
   * Cursor cache: índice del keyframe IZQUIERDO del segmento activo.
   * 
   * Si cursors.get('intensity') === 2, el segmento activo es
   * [keyframes[2], keyframes[3]] y el tiempo está entre ambos.
   */
  private readonly cursors: Map<HephParamId, number>

  /** Último timeMs evaluado POR CURVA (para detectar dirección) */
  private readonly lastTimeMsPerCurve: Map<HephParamId, number>

  /** Duración total del clip para clamp */
  private readonly durationMs: number

  // ─────────────────────────────────────────────────────────────────────────
  // CONSTRUCTOR
  // ─────────────────────────────────────────────────────────────────────────

  constructor(curves: Map<HephParamId, HephCurve>, durationMs: number) {
    this.curves = curves
    this.durationMs = Math.max(1, durationMs)
    this.cursors = new Map()
    this.lastTimeMsPerCurve = new Map()

    // Inicializar cursores a 0
    for (const paramId of curves.keys()) {
      this.cursors.set(paramId, 0)
      this.lastTimeMsPerCurve.set(paramId, -1)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Evalúa el valor numérico de una curva en un instante de tiempo.
   * 
   * @param paramId ID del parámetro a evaluar
   * @param timeMs Tiempo en ms desde inicio del clip
   * @returns Valor interpolado, o defaultValue si no hay curva/keyframes
   */
  getValue(paramId: HephParamId, timeMs: number): number {
    const curve = this.curves.get(paramId)
    if (!curve || curve.keyframes.length === 0) {
      if (curve && typeof curve.defaultValue === 'number') {
        return curve.defaultValue
      }
      return 0
    }

    const kfs = curve.keyframes
    const t = this.clampTime(timeMs)

    // ── Edge cases ──────────────────────────────────────────────────────
    if (kfs.length === 1) return kfs[0].value as number
    if (t <= kfs[0].timeMs) return kfs[0].value as number
    if (t >= kfs[kfs.length - 1].timeMs) return kfs[kfs.length - 1].value as number

    // ── Encontrar segmento activo ───────────────────────────────────────
    const segIdx = this.findSegment(paramId, t, kfs)
    const kf0 = kfs[segIdx]
    const kf1 = kfs[segIdx + 1]

    // ── Calcular progreso dentro del segmento ───────────────────────────
    const segDuration = kf1.timeMs - kf0.timeMs
    if (segDuration <= 0) return kf0.value as number

    const segProgress = (t - kf0.timeMs) / segDuration

    // ── Interpolar ──────────────────────────────────────────────────────
    return this.interpolateNumber(
      kf0.value as number,
      kf1.value as number,
      segProgress,
      kf0.interpolation,
      kf0.bezierHandles
    )
  }

  /**
   * Evalúa el valor de color de una curva en un instante de tiempo.
   * 
   * Interpola H, S, L independientemente.
   * Hue se interpola por shortest-path (350° → 10° cruza por 0°).
   * 
   * @param paramId ID del parámetro (debe ser valueType='color')
   * @param timeMs Tiempo en ms desde inicio del clip
   * @returns Color HSL interpolado
   */
  getColorValue(paramId: HephParamId, timeMs: number): HSL {
    const curve = this.curves.get(paramId)
    if (!curve || curve.keyframes.length === 0) {
      if (curve && typeof curve.defaultValue === 'object') {
        return curve.defaultValue as HSL
      }
      return { h: 0, s: 0, l: 50 }
    }

    const kfs = curve.keyframes
    const t = this.clampTime(timeMs)

    // ⚒️ WAVE 2040.22c: DEFENSIVE VALIDATION HELPERS
    const isValidHSL = (v: any): v is HSL =>
      v && typeof v === 'object' &&
      typeof v.h === 'number' && Number.isFinite(v.h) &&
      typeof v.s === 'number' && Number.isFinite(v.s) &&
      typeof v.l === 'number' && Number.isFinite(v.l)

    const safeDefault = (): HSL =>
      curve.defaultValue && typeof curve.defaultValue === 'object'
        ? (curve.defaultValue as HSL)
        : { h: 0, s: 0, l: 50 }

    // ── Edge cases ──────────────────────────────────────────────────────
    if (kfs.length === 1) {
      const val = kfs[0].value as HSL
      return isValidHSL(val) ? val : safeDefault()
    }
    if (t <= kfs[0].timeMs) {
      const val = kfs[0].value as HSL
      return isValidHSL(val) ? val : safeDefault()
    }
    if (t >= kfs[kfs.length - 1].timeMs) {
      const val = kfs[kfs.length - 1].value as HSL
      return isValidHSL(val) ? val : safeDefault()
    }

    // ── Encontrar segmento ──────────────────────────────────────────────
    const segIdx = this.findSegment(paramId, t, kfs)
    const kf0 = kfs[segIdx]
    const kf1 = kfs[segIdx + 1]

    const segDuration = kf1.timeMs - kf0.timeMs
    if (segDuration <= 0) return kf0.value as HSL

    const rawProgress = (t - kf0.timeMs) / segDuration

    // ── Hold: devolver kf0 directamente ─────────────────────────────────
    if (kf0.interpolation === 'hold') {
      return kf0.value as HSL
    }

    // ── Aplicar curva al progreso ───────────────────────────────────────
    const easedProgress = this.applyInterpolation(
      rawProgress,
      kf0.interpolation,
      kf0.bezierHandles
    )

    // ── Interpolar HSL con shortest-path para Hue ───────────────────────
    const c0 = kf0.value as HSL
    const c1 = kf1.value as HSL

    // ⚒️ WAVE 2040.22c: Validate keyframe values before interpolation
    if (!isValidHSL(c0) || !isValidHSL(c1)) {
      console.warn('[CurveEvaluator] Invalid HSL keyframe values detected:', { c0, c1, paramId })
      return safeDefault()
    }

    return {
      h: this.lerpHue(c0.h, c1.h, easedProgress),
      s: c0.s + (c1.s - c0.s) * easedProgress,
      l: c0.l + (c1.l - c0.l) * easedProgress,
    }
  }

  /**
   * Obtiene un snapshot de TODOS los parámetros en un instante.
   * 
   * Itera sobre todas las curvas registradas y evalúa cada una.
   * Es la forma más eficiente de obtener todos los valores de una vez
   * (el cursor cache se beneficia de la localidad temporal).
   * 
   * @param timeMs Tiempo en ms desde inicio del clip
   * @returns Map parcial de paramId → valor evaluado
   */
  getSnapshot(timeMs: number): HephParamSnapshot {
    const snapshot: HephParamSnapshot = {}

    for (const [paramId, curve] of this.curves) {
      if (curve.valueType === 'color') {
        snapshot[paramId] = this.getColorValue(paramId, timeMs)
      } else {
        snapshot[paramId] = this.getValue(paramId, timeMs)
      }
    }

    return snapshot
  }

  /**
   * Resetea todos los cursores.
   * Llamar cuando se hace seek/scrub para forzar re-búsqueda limpia.
   */
  reset(): void {
    for (const paramId of this.curves.keys()) {
      this.cursors.set(paramId, 0)
      this.lastTimeMsPerCurve.set(paramId, -1)
    }
  }

  /**
   * ¿Tiene esta curva registrada para un parámetro dado?
   */
  hasCurve(paramId: HephParamId): boolean {
    const curve = this.curves.get(paramId)
    return curve !== undefined && curve.keyframes.length > 0
  }

  /**
   * Obtiene el modo de aplicación de una curva.
   * Default: 'absolute' si no existe la curva.
   */
  getCurveMode(paramId: HephParamId): 'absolute' | 'relative' | 'additive' {
    return this.curves.get(paramId)?.mode ?? 'absolute'
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INTERNALS: SEGMENT SEARCH
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Encuentra el índice del segmento activo para una curva.
   * 
   * O(1) amortizado en playback normal (cursor cache).
   * O(log n) en seek/scrub (binary search).
   * 
   * OBSERVACIÓN CLAVE:
   * En playback normal, el tiempo avanza monotónicamente.
   * El segmento activo en frame N es el mismo o el siguiente en frame N+1.
   * Solo necesitamos avanzar el cursor linealmente → O(1).
   * 
   * @param paramId ID del parámetro (para acceder a su cursor)
   * @param t Tiempo actual (ya clamped)
   * @param kfs Keyframes de la curva (ordenados)
   * @returns Índice del keyframe izquierdo del segmento activo
   */
  private findSegment(
    paramId: HephParamId,
    t: number,
    kfs: HephKeyframe[]
  ): number {
    let cursor = this.cursors.get(paramId) ?? 0
    const lastTime = this.lastTimeMsPerCurve.get(paramId) ?? -1

    // ── Detectar dirección ────────────────────────────────────────────
    const isForward = t >= lastTime

    if (isForward) {
      // PLAYBACK NORMAL → Avanzar cursor linealmente (O(1) amortizado)
      // El while avanza como máximo 1-2 posiciones por frame en playback normal.
      // Solo en fast-forward podría avanzar más, pero sigue siendo O(n) amortizado
      // sobre la vida del clip (cada keyframe se cruza exactamente una vez).
      while (cursor < kfs.length - 2 && t >= kfs[cursor + 1].timeMs) {
        cursor++
      }
    } else {
      // SEEK HACIA ATRÁS → Binary search (O(log n))
      // No podemos retroceder el cursor linealmente porque no sabemos
      // cuántas posiciones retroceder. Binary search es la opción correcta.
      cursor = this.binarySearchSegment(t, kfs)
    }

    // Clamp seguro
    cursor = Math.max(0, Math.min(cursor, kfs.length - 2))

    // Actualizar cache
    this.cursors.set(paramId, cursor)
    this.lastTimeMsPerCurve.set(paramId, t)

    return cursor
  }

  /**
   * Binary search para encontrar el segmento que contiene tiempo t.
   * 
   * Busca el mayor índice i tal que kfs[i].timeMs <= t.
   * Esto nos da el keyframe izquierdo del segmento [i, i+1].
   * 
   * @param t Tiempo a buscar
   * @param kfs Keyframes ordenados
   * @returns Índice del keyframe izquierdo
   */
  private binarySearchSegment(t: number, kfs: HephKeyframe[]): number {
    let lo = 0
    let hi = kfs.length - 2

    while (lo < hi) {
      // Bitwise unsigned right shift: equivale a Math.floor((lo + hi + 1) / 2)
      // pero sin overflow y sin branch.
      const mid = (lo + hi + 1) >>> 1
      if (kfs[mid].timeMs <= t) {
        lo = mid
      } else {
        hi = mid - 1
      }
    }

    return lo
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INTERNALS: INTERPOLATION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Interpola entre dos valores numéricos aplicando la curva de easing.
   * 
   * @param v0 Valor del keyframe izquierdo
   * @param v1 Valor del keyframe derecho
   * @param progress Progreso lineal dentro del segmento (0-1)
   * @param interpolation Tipo de interpolación
   * @param handles Bezier handles (solo para 'bezier')
   * @returns Valor interpolado
   */
  private interpolateNumber(
    v0: number,
    v1: number,
    progress: number,
    interpolation: HephKeyframe['interpolation'],
    handles?: [number, number, number, number]
  ): number {
    const t = this.applyInterpolation(progress, interpolation, handles)
    return v0 + (v1 - v0) * t
  }

  /**
   * Aplica la función de interpolación al progreso lineal.
   * Convierte progreso lineal (0-1) en progreso con easing (0-1).
   * 
   * NOTA: Para 'bezier', el valor retornado puede exceder [0,1]
   * si los handles tienen overshoot (cy < 0 o cy > 1).
   * Esto es intencional — permite curvas elásticas/bounce.
   * 
   * @param t Progreso lineal (0-1)
   * @param interpolation Tipo de interpolación
   * @param handles Bezier handles
   * @returns Progreso con easing aplicado
   */
  private applyInterpolation(
    t: number,
    interpolation: HephKeyframe['interpolation'],
    handles?: [number, number, number, number]
  ): number {
    switch (interpolation) {
      case 'hold':
        // Step function: valor constante hasta el siguiente keyframe.
        // Retornamos 0 para que v0 + (v1 - v0) * 0 = v0
        return 0

      case 'linear':
        return t

      case 'bezier':
        if (!handles) return t
        return this.cubicBezierY(t, handles[0], handles[1], handles[2], handles[3])

      default:
        return t
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * CUBIC BEZIER EVALUATION
   * ═══════════════════════════════════════════════════════════════════════
   * 
   * La curva bezier cúbica mapea progreso lineal t (0-1) → y (valor con easing).
   * 
   * Los 4 puntos de control de la curva paramétrica son:
   *   P0 = (0, 0)        ← Inicio fijo
   *   P1 = (cx1, cy1)    ← Handle de salida del keyframe izquierdo
   *   P2 = (cx2, cy2)    ← Handle de entrada del keyframe derecho
   *   P3 = (1, 1)        ← Fin fijo
   * 
   * PROBLEMA: La curva es paramétrica sobre u ∈ [0,1].
   * Nosotros tenemos t (progreso en X) y necesitamos Y.
   * 
   * SOLUCIÓN: Newton-Raphson
   * 1. Encontrar u tal que BezierX(u) ≈ t
   * 2. Calcular BezierY(u) como resultado
   * 
   * 4 iteraciones de Newton-Raphson dan error < 0.001,
   * que es imperceptible en animación visual.
   * 
   * Este es exactamente el algoritmo que usa Chrome para CSS transitions.
   */
  private cubicBezierY(
    t: number,
    cx1: number,
    cy1: number,
    cx2: number,
    cy2: number
  ): number {
    // Edge cases: endpoints exactos
    if (t <= 0) return 0
    if (t >= 1) return 1

    // ── Newton-Raphson para encontrar u donde BezierX(u) = t ──────────
    //
    // BezierX(u) = 3(1-u)²·u·cx1 + 3(1-u)·u²·cx2 + u³
    //            = 3·mu²·u·cx1 + 3·mu·u²·cx2 + u³
    //
    // BezierX'(u) = 3·mu²·cx1 + 6·mu·u·(cx2-cx1) + 3·u²·(1-cx2)
    //
    let u = t // Initial guess: identidad (funciona bien para curvas suaves)

    for (let i = 0; i < NEWTON_ITERATIONS; i++) {
      const u2 = u * u
      const u3 = u2 * u
      const mu = 1 - u
      const mu2 = mu * mu

      // X(u) — posición X actual
      const x = 3 * mu2 * u * cx1 + 3 * mu * u2 * cx2 + u3

      // X'(u) — derivada: nos dice la pendiente para Newton-Raphson
      const dx = 3 * mu2 * cx1 + 6 * mu * u * (cx2 - cx1) + 3 * u2 * (1 - cx2)

      // Si la derivada es casi 0, la curva es casi plana aquí.
      // No podemos dividir → salimos con la mejor aproximación.
      if (Math.abs(dx) < NEWTON_EPSILON) break

      // Newton step: u_new = u - f(u)/f'(u)
      // donde f(u) = BezierX(u) - t
      u -= (x - t) / dx

      // Clamp para estabilidad numérica
      u = Math.max(0, Math.min(1, u))
    }

    // ── Calcular BezierY(u) con el u encontrado ────────────────────────
    //
    // BezierY(u) = 3(1-u)²·u·cy1 + 3(1-u)·u²·cy2 + u³
    //
    const u2 = u * u
    const u3 = u2 * u
    const mu = 1 - u
    const mu2 = mu * mu

    return 3 * mu2 * u * cy1 + 3 * mu * u2 * cy2 + u3
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INTERNALS: COLOR INTERPOLATION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Interpola Hue por el camino más corto en el círculo 0-360.
   * 
   * El Hue es circular: 0° = 360°. La distancia entre 350° y 10°
   * es 20° (cruzando por 0°), NO 340° (dando la vuelta larga).
   * 
   * Esto evita el "arcoíris accidental" cuando se transiciona
   * entre colores cercanos que están en lados opuestos de 0°.
   * 
   * @param h0 Hue inicial (0-360)
   * @param h1 Hue final (0-360)
   * @param t Progreso (0-1)
   * @returns Hue interpolado (0-360)
   */
  private lerpHue(h0: number, h1: number, t: number): number {
    let delta = h1 - h0

    // Shortest path: si la diferencia es > 180°, ir por el otro lado
    if (delta > 180) delta -= 360
    if (delta < -180) delta += 360

    let result = h0 + delta * t

    // Normalizar al rango [0, 360)
    if (result < 0) result += 360
    if (result >= 360) result -= 360

    return result
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INTERNALS: UTILITY
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Clamp tiempo al rango [0, durationMs]
   */
  private clampTime(timeMs: number): number {
    return Math.max(0, Math.min(timeMs, this.durationMs))
  }
}
