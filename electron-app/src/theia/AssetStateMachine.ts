/**
 * 🎬 WAVE 4864 — ASSET STATE MACHINE (Phase 4)
 *
 * FSM minimalista que modela los cuatro estados del Theia Engine:
 *   AMBIENT → BUILDUP → DROP → DECAY → AMBIENT
 *
 * Reglas (ver blueprint WAVE-4850 §2.2):
 *  - AMBIENT es el único estado terminal — siempre se vuelve a él, nunca
 *    hay frame negro.
 *  - DROP es one-shot: rechaza otro DROP en curso a menos que se fuerce
 *    explícitamente (la UI manual `forceState` SÍ lo permite — el operador
 *    siempre tiene la última palabra).
 *  - Cada transición decide si requiere CrossfadeUnit (siempre sí, salvo
 *    `noCrossfade=true` en cargas iniciales).
 *
 * Esta versión es "lógica pura": no toca canvas, no carga clips. El worker
 * usa `transition()` y consulta `currentState` para decidir qué dibujar.
 * Cuando lleguen los multi-clip assets (Fase F5+), bastará con que el worker
 * mapee `currentState → primaryStream` antes del crossfade.
 */

export type AssetStateId = 'idle' | 'ambient' | 'buildup' | 'drop' | 'decay'

export interface TransitionResult {
  /** Estado anterior. */
  from: AssetStateId
  /** Estado destino. */
  to: AssetStateId
  /** Si la transición fue aceptada (false = rechazada por reglas). */
  accepted: boolean
  /** Si el cambio requiere arrancar un crossfade. */
  needsCrossfade: boolean
  /** Razón si fue rechazada (para logging/telemetría). */
  reason?: string
}

export interface AssetStateMachineOptions {
  /** Si está activo, transiciones a DROP no se pueden interrumpir hasta que
   *  el clip termine de forma natural (el worker debe llamar `markDropFinished()`).
   *  Por defecto false (Phase 4 mantiene política liberal — la UI manual manda). */
  protectActiveDrop?: boolean
}

export class AssetStateMachine {
  private _state: AssetStateId = 'idle'
  private _dropActive = false
  private readonly _protectActiveDrop: boolean

  constructor(opts: AssetStateMachineOptions = {}) {
    this._protectActiveDrop = opts.protectActiveDrop ?? false
  }

  get currentState(): AssetStateId {
    return this._state
  }

  /**
   * Arranca el motor. Va de IDLE → AMBIENT sin crossfade (no hay frame anterior).
   * Idempotente: si ya está en AMBIENT, no hace nada.
   */
  bootToAmbient(): TransitionResult {
    if (this._state === 'ambient') {
      return { from: 'ambient', to: 'ambient', accepted: false, needsCrossfade: false, reason: 'already-ambient' }
    }
    const from = this._state
    this._state = 'ambient'
    this._dropActive = false
    return { from, to: 'ambient', accepted: true, needsCrossfade: false }
  }

  /**
   * Solicita una transición. Reglas:
   *  - desde IDLE solo se permite ir a AMBIENT (usar bootToAmbient).
   *  - DROP en curso bloquea otros DROP si protectActiveDrop=true.
   *  - cualquier otra transición es válida.
   */
  transition(target: AssetStateId, opts: { manual?: boolean } = {}): TransitionResult {
    const from = this._state
    const manual = !!opts.manual

    if (from === target) {
      return { from, to: target, accepted: false, needsCrossfade: false, reason: 'same-state' }
    }

    if (from === 'idle' && target !== 'ambient') {
      return { from, to: target, accepted: false, needsCrossfade: false, reason: 'idle-must-bootstrap' }
    }

    if (
      target === 'drop' &&
      this._dropActive &&
      this._protectActiveDrop &&
      !manual
    ) {
      return { from, to: target, accepted: false, needsCrossfade: false, reason: 'drop-locked' }
    }

    if (target === 'idle') {
      // 'idle' solo se alcanza vía reset()
      return { from, to: target, accepted: false, needsCrossfade: false, reason: 'use-reset' }
    }

    this._state = target
    this._dropActive = target === 'drop'
    return { from, to: target, accepted: true, needsCrossfade: true }
  }

  /** Marcado externo: el worker confirma que el DROP terminó (clip natural finished). */
  markDropFinished(): void {
    if (this._state === 'drop') this._dropActive = false
  }

  /** Vuelta dura a IDLE — usado en shutdown/unload. */
  reset(): void {
    this._state = 'idle'
    this._dropActive = false
  }

  isDropActive(): boolean {
    return this._dropActive
  }
}
