/**
 * 🎬 WAVE 4864 — CROSSFADE UNIT (Phase 4)
 *
 * Genera la curva de blending entre el frame "primario" (estado anterior) y el
 * "secundario" (estado nuevo) durante una transición de la AssetStateMachine.
 *
 * ⏱️ WAVE 8405 · M2 — WALL-CLOCK: la unidad ya no cuenta ticks. El worker
 * renderiza a cadencia variable (rAF 60–144 Hz, poll ~44 Hz de fallback) y
 * `totalTicks = ms/16.7` producía fades 0.4×–2.4× fuera de tiempo. Ahora la
 * rampa avanza por ms de reloj (`performance.now` inyectable), igual que el
 * `fadeT0/fadeDur` del GenRuntime — Render A y Render B funden al milisegundo.
 *
 * Anclaje musical (downbeat) — ver blueprint WAVE-4850 §2.4:
 *  - El crossfade puede arrancar en `pending-anchor` esperando al siguiente
 *    downbeat. `step({ releaseAnchor: true })` lo libera; el timeout es en ms.
 *
 * Curvas: linear, easeInOut (cosine), cosine.
 *
 * Esta clase es lógica pura. El consumidor la llama una vez por frame, recibe
 * `[αPrimary, αSecondary]` y los aplica en el render del worker.
 */

export type CrossfadeCurve = 'linear' | 'easeInOut' | 'cosine'
export type CrossfadeState = 'idle' | 'pending-anchor' | 'running'

export interface CrossfadeStartOptions {
  /** Duración total en ms de reloj de pared (default 500 ms). */
  durationMs?: number
  /** Curva de blending. Default 'easeInOut'. */
  curve?: CrossfadeCurve
  /** Si true, el crossfade espera a que el caller pase `releaseAnchor=true` en step(). */
  waitAnchor?: boolean
  /** Ms de espera del ancla antes de arrancar igualmente. Default 2000.
   *  Solo aplica si waitAnchor=true. */
  anchorTimeoutMs?: number
  /** Marca temporal del arranque — default: reloj inyectado. */
  nowMs?: number
}

export interface CrossfadeStep {
  /** Alfa para el frame primario (estado anterior). 1 = full, 0 = oculto. */
  alphaPrimary: number
  /** Alfa para el frame secundario (estado nuevo). */
  alphaSecondary: number
  /** Si la transición ha completado en este tick. */
  finished: boolean
  /** Si el crossfade está realmente avanzando (false durante pending-anchor). */
  active: boolean
}

const DEFAULT_DURATION_MS = 500
const DEFAULT_ANCHOR_TIMEOUT_MS = 2000

export class CrossfadeUnit {
  private _state: CrossfadeState = 'idle'
  /** Inicio de la rampa (post-ancla). */
  private _startMs = 0
  /** Inicio de la espera de ancla. */
  private _armedAtMs = 0
  private _durationMs = DEFAULT_DURATION_MS
  private _curve: CrossfadeCurve = 'easeInOut'
  private _anchorTimeoutMs = DEFAULT_ANCHOR_TIMEOUT_MS

  constructor(private readonly _now: () => number = () => performance.now()) {}

  get state(): CrossfadeState {
    return this._state
  }

  isDone(): boolean {
    return this._state === 'idle'
  }

  isWaitingAnchor(): boolean {
    return this._state === 'pending-anchor'
  }

  /** Progreso 0..1 — útil para telemetría. */
  progress(): number {
    if (this._state !== 'running' || this._durationMs <= 0) return 0
    return clamp01((this._now() - this._startMs) / this._durationMs)
  }

  /**
   * Arranca el crossfade. Si `waitAnchor=true`, queda en `pending-anchor`
   * hasta que `step({ releaseAnchor: true })` lo libere o se agote el timeout.
   */
  start(opts: CrossfadeStartOptions = {}): void {
    this._durationMs =
      opts.durationMs && opts.durationMs > 0 ? opts.durationMs : DEFAULT_DURATION_MS
    this._curve = opts.curve ?? 'easeInOut'
    this._anchorTimeoutMs = opts.anchorTimeoutMs ?? DEFAULT_ANCHOR_TIMEOUT_MS
    const now = opts.nowMs ?? this._now()
    this._armedAtMs = now
    this._startMs = now
    this._state = opts.waitAnchor ? 'pending-anchor' : 'running'
  }

  /** Aborta el crossfade y vuelve a idle. El caller decide qué frame mostrar. */
  abort(): void {
    this._state = 'idle'
  }

  /**
   * 🧬 WAVE 8232 · G0 (H1) — factor a subir como `u_blend` en el epílogo
   * generativo (`mix(prev, c, u_blend)`).
   *
   * `step()` devuelve `alphaSecondary = 0` tanto en idle como en
   * pending-anchor, pero el shader generativo mantiene `u_prevFrame` válido
   * de forma permanente (feedback + limitador) — subir 0 en reposo
   * congelaría la salida sobre el frame cacheado. Resolución:
   *   - running/finished → `alphaSecondary` (rampa 0→1 real)
   *   - pending-anchor   → 0 (hold sobre el snapshot hasta el ancla)
   *   - idle             → 1 (frame actual al 100%)
   */
  resolvedBlend(step: CrossfadeStep): number {
    if (step.active) return step.alphaSecondary
    return this._state === 'pending-anchor' ? 0 : 1
  }

  /**
   * Llamado una vez por frame de render. `releaseAnchor=true` dispara el
   * arranque si estaba en pending-anchor.
   *
   * Devuelve los alfas a aplicar en el frame actual:
   *   - idle      → [1, 0] (solo primario)
   *   - pending   → [1, 0]
   *   - running   → curva sobre t = elapsed/duration
   *   - finished  → [0, 1] (último frame — el caller promueve secondary→primary)
   */
  step(opts: { releaseAnchor?: boolean; nowMs?: number } = {}): CrossfadeStep {
    if (this._state === 'idle') {
      return { alphaPrimary: 1, alphaSecondary: 0, finished: false, active: false }
    }

    const now = opts.nowMs ?? this._now()

    if (this._state === 'pending-anchor') {
      if (opts.releaseAnchor || now - this._armedAtMs >= this._anchorTimeoutMs) {
        this._state = 'running'
        this._startMs = now
      } else {
        return { alphaPrimary: 1, alphaSecondary: 0, finished: false, active: false }
      }
    }

    // running — wall-clock: idéntico a cualquier cadencia de render.
    const t = clamp01((now - this._startMs) / this._durationMs)
    const eased = applyCurve(t, this._curve)
    if (t >= 1) {
      this._state = 'idle'
      return { alphaPrimary: 0, alphaSecondary: 1, finished: true, active: true }
    }
    return {
      alphaPrimary: clamp01(1 - eased),
      alphaSecondary: clamp01(eased),
      finished: false,
      active: true,
    }
  }
}

function clamp01(x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  return x
}

/**
 * 🔥 HOTFIX 8312 — factor de ducking para `u_impact` durante transiciones.
 * El flash del impacto es ADITIVO dentro del shader: si coincide con el
 * crossfade (Auto-Pilot dispara en downbeat = justo cuando cae un drop),
 * su luz se suma sobre la mezcla y satura el HDR→ACES, disparando falsos
 * positivos del limitador/AGC.
 *
 * Devuelve 0 mientras la transición está viva — incluye el hold
 * `pending-anchor` (blend=0 pero transición real) y el frame `finished` —
 * y 1 en reposo. Mute total, no rampa: el pico problemático ocurre en
 * blend≈0 (arranque del fade), donde cualquier curva ponderada por blend
 * seguiría dejando pasar el flash.
 */
export function impactDuckFor(step: CrossfadeStep, waitingAnchor: boolean): number {
  return step.active || waitingAnchor ? 0 : 1
}

function applyCurve(t: number, curve: CrossfadeCurve): number {
  switch (curve) {
    case 'linear':
      return t
    case 'cosine':
      // 0..1 cosine ramp
      return 0.5 - 0.5 * Math.cos(Math.PI * t)
    case 'easeInOut':
    default:
      // Smoothstep — derivada nula en los extremos, sin discontinuidades.
      return t * t * (3 - 2 * t)
  }
}
