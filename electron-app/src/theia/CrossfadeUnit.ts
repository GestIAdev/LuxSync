/**
 * 🎬 WAVE 4864 — CROSSFADE UNIT (Phase 4)
 *
 * Genera la curva de blending entre el frame "primario" (estado anterior) y el
 * "secundario" (estado nuevo) durante una transición de la AssetStateMachine.
 *
 * Anclaje musical (downbeat) — ver blueprint WAVE-4850 §2.4:
 *  - El crossfade puede arrancar en `pending-anchor` esperando al siguiente
 *    downbeat. En ausencia de señal de beat (FrameContextRing actual sólo
 *    transporta tickId), el `step()` lo lanza inmediatamente cuando se le
 *    indique con `releaseAnchor=true`.
 *  - Cuando llegue el bus de `MusicalContext` con `beatPhase`, basta con que
 *    el caller compruebe `beatPhase < 0.05` y pase `releaseAnchor=true`.
 *
 * Curvas: linear, easeInOut (cosine), cosine.
 *
 * Esta clase es lógica pura. El consumidor la llama una vez por tick, recibe
 * `[αPrimary, αSecondary]` y los aplica en el render del worker.
 */

export type CrossfadeCurve = 'linear' | 'easeInOut' | 'cosine'
export type CrossfadeState = 'idle' | 'pending-anchor' | 'running'

export interface CrossfadeStartOptions {
  /** Duración total en ticks (default 22 ≈ 500 ms a 44 Hz). */
  totalTicks?: number
  /** Curva de blending. Default 'easeInOut'. */
  curve?: CrossfadeCurve
  /** Si true, el crossfade espera a que el caller pase `releaseAnchor=true` en step(). */
  waitAnchor?: boolean
  /** Tras cuántos ticks de espera abandonar el anclaje y arrancar igualmente.
   *  Default 88 (~2 s). Solo aplica si waitAnchor=true. */
  anchorTimeoutTicks?: number
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

const DEFAULT_TOTAL_TICKS = 22
const DEFAULT_ANCHOR_TIMEOUT = 88

export class CrossfadeUnit {
  private _state: CrossfadeState = 'idle'
  private _ticksRemaining = 0
  private _ticksTotal = 0
  private _curve: CrossfadeCurve = 'easeInOut'
  private _waitAnchor = false
  private _anchorTicksWaited = 0
  private _anchorTimeoutTicks = DEFAULT_ANCHOR_TIMEOUT

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
    if (this._state !== 'running' || this._ticksTotal <= 0) return 0
    return 1 - this._ticksRemaining / this._ticksTotal
  }

  /**
   * Arranca el crossfade. Si `waitAnchor=true`, queda en `pending-anchor`
   * hasta que `step({ releaseAnchor: true })` lo libere o se agote el timeout.
   */
  start(opts: CrossfadeStartOptions = {}): void {
    this._ticksTotal = opts.totalTicks && opts.totalTicks > 0 ? opts.totalTicks : DEFAULT_TOTAL_TICKS
    this._ticksRemaining = this._ticksTotal
    this._curve = opts.curve ?? 'easeInOut'
    this._waitAnchor = opts.waitAnchor ?? false
    this._anchorTicksWaited = 0
    this._anchorTimeoutTicks = opts.anchorTimeoutTicks ?? DEFAULT_ANCHOR_TIMEOUT
    this._state = this._waitAnchor ? 'pending-anchor' : 'running'
  }

  /** Aborta el crossfade y vuelve a idle. El caller decide qué frame mostrar. */
  abort(): void {
    this._state = 'idle'
    this._ticksRemaining = 0
    this._ticksTotal = 0
    this._anchorTicksWaited = 0
  }

  /**
   * Llamado una vez por tick. `releaseAnchor=true` dispara el arranque si
   * estaba en pending-anchor.
   *
   * Devuelve los alfas a aplicar en el frame actual:
   *   - idle      → [1, 0] (solo primario)
   *   - pending   → [1, 0]
   *   - running   → curva
   *   - finished  → [0, 1] (último tick — el caller debe promover secondary→primary)
   */
  step(opts: { releaseAnchor?: boolean } = {}): CrossfadeStep {
    if (this._state === 'idle') {
      return { alphaPrimary: 1, alphaSecondary: 0, finished: false, active: false }
    }

    if (this._state === 'pending-anchor') {
      this._anchorTicksWaited++
      if (opts.releaseAnchor || this._anchorTicksWaited >= this._anchorTimeoutTicks) {
        this._state = 'running'
      } else {
        return { alphaPrimary: 1, alphaSecondary: 0, finished: false, active: false }
      }
    }

    // running
    const t = 1 - this._ticksRemaining / this._ticksTotal
    const eased = applyCurve(t, this._curve)
    const alphaSecondary = clamp01(eased)
    const alphaPrimary = clamp01(1 - eased)

    this._ticksRemaining--
    if (this._ticksRemaining <= 0) {
      this._state = 'idle'
      return { alphaPrimary: 0, alphaSecondary: 1, finished: true, active: true }
    }
    return { alphaPrimary, alphaSecondary, finished: false, active: true }
  }
}

function clamp01(x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  return x
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
