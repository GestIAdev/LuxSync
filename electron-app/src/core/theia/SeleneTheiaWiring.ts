/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🎬 SELENE-THEIA WIRING — WAVE 4903 (Phase 3/3 of WAVE-4900-THEIADNA)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Conecta el cerebro cognitivo de Selene con el `ThetaOrchestrator` (vídeo).
 *
 * ARQUITECTURA REAL DE LUXSYNC:
 *   - `SeleneTitanConscious` corre en el RENDERER (renderer/main thread).
 *   - `ThetaOrchestrator` corre en el RENDERER también, gestionando un
 *     Web Worker (`theta.worker.ts`).
 *   - NO existe `ipcMain` ni `mainWindow.webContents.send` para este flujo:
 *     ambos bordes viven en el mismo proceso. Usamos un `EventTarget`
 *     interno (`theiaCueJumpBus`) que conserva la nomenclatura "IPC" para
 *     futuro split de procesos.
 *
 * FLUJO COMPLETO:
 *   1. Selene emite `ConsciousnessOutput` cada frame.
 *   2. Wiring listener traduce → `ISeleneTheiaInput` → llama a
 *      `getSeleneTheiaAdapter().process(input)`.
 *   3. Si el adapter devuelve `CueJumpIntent`, se publica en el bus
 *      como `TheiaCueJumpMessage`.
 *   4. `ThetaOrchestrator` está suscrito al bus → ejecuta `handleCueJump()`.
 *   5. Orchestrator llama a `videoElement.currentTime = startMs/1000` +
 *      lazy-load del .mp4 + postMessage `theia:seek` al worker.
 *   6. Worker captura snapshot + arranca `CrossfadeUnit`.
 *
 * INTEGRACIÓN MANUAL (única función pública):
 *   - `attachSeleneTheia({ selene })` — debe llamarse una vez al boot.
 * ════════════════════════════════════════════════════════════════════════════
 */

import type { TheiaPlayAtomMessage } from '../../theia/protocol'
import { getThetaOrchestrator } from '../../theia/ThetaOrchestrator'
import {
  getSeleneTheiaAdapter,
  type CueJumpIntent,
  type ISeleneTheiaInput,
} from './SeleneTheiaAdapter'
import { getTheiaRegistry } from './TheiaRegistry'

// ─── BUS INTERNO (renderer-only) ──────────────────────────────────────────────

/**
 * Bus del play-atom. Conserva semántica "IPC" para que un futuro refactor
 * que separe Selene y Theta en procesos distintos pueda reemplazar la
 * implementación sin cambiar consumidores.
 *
 * Eventos: `'theia:play-atom'` con `event.detail = TheiaPlayAtomMessage['payload']`.
 */
class TheiaPlayAtomBus {
  private readonly _target: EventTarget = new EventTarget()

  emit(payload: TheiaPlayAtomMessage['payload']): void {
    this._target.dispatchEvent(new CustomEvent('theia:play-atom', { detail: payload }))
  }

  on(handler: (payload: TheiaPlayAtomMessage['payload']) => void): () => void {
    const listener = (ev: Event): void => {
      const detail = (ev as CustomEvent).detail as TheiaPlayAtomMessage['payload']
      handler(detail)
    }
    this._target.addEventListener('theia:play-atom', listener)
    return () => this._target.removeEventListener('theia:play-atom', listener)
  }
}

let _bus: TheiaPlayAtomBus | null = null
export function getTheiaPlayAtomBus(): TheiaPlayAtomBus {
  if (!_bus) _bus = new TheiaPlayAtomBus()
  return _bus
}

/** @deprecated WAVE 4922 — alias histórico de `getTheiaPlayAtomBus`. */
export const getTheiaCueJumpBus = getTheiaPlayAtomBus

// ─── WIRING API ──────────────────────────────────────────────────────────────

/**
 * Forma minimal del cerebro de Selene que el wiring necesita.
 *
 * Se acepta un `EventEmitter`-like (`SeleneTitanConscious extends EventEmitter`)
 * o un objeto con un método `subscribe(cb)`. El listener recibe el payload
 * cognitivo ya pre-mapeado por el caller.
 */
export interface SeleneEmitterLike {
  /** Suscribe a outputs cognitivos. Devuelve un unsubscribe. */
  on(event: 'cognitiveOutput', listener: (input: ISeleneTheiaInput) => void): unknown
  off?(event: 'cognitiveOutput', listener: (input: ISeleneTheiaInput) => void): unknown
}

export interface AttachOptions {
  /** Cerebro de Selene (emite outputs cognitivos). */
  selene: SeleneEmitterLike
  /**
   * Resolver `atomId → URL`. Por defecto consulta `TheiaRegistry.getAtom(id).filePath`.
   * Permite override para tests o pipelines de assets remotos.
   */
  clipUrlResolver?: (atomId: string) => string | null
}

/**
 * Conecta Selene → adapter → bus → ThetaOrchestrator.
 *
 * @returns función `detach()` que deshace TODO el wiring (listener Selene +
 *          subscription al bus + url resolver). Idempotente.
 */
export function attachSeleneTheia(opts: AttachOptions): () => void {
  const adapter = getSeleneTheiaAdapter()
  const orchestrator = getThetaOrchestrator()
  const bus = getTheiaPlayAtomBus()

  // 1) Resolver atomId → URL.
  const defaultResolver = (atomId: string): string | null => {
    const atom = getTheiaRegistry().getAtom(atomId)
    return atom?.filePath ?? null
  }
  orchestrator.setClipUrlResolver(opts.clipUrlResolver ?? defaultResolver)

  // 2) Listener: Selene cognitive output → adapter → bus.
  const onCognitive = (input: ISeleneTheiaInput): void => {
    let intent: CueJumpIntent | null
    try {
      intent = adapter.process(input)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[SeleneTheiaWiring 🎬] adapter.process threw:', err)
      return
    }
    if (!intent) return
    bus.emit({ ...intent, emittedAt: Date.now() })
  }
  opts.selene.on('cognitiveOutput', onCognitive)

  // 3) Listener: bus → orchestrator.playAtom.
  const unsubscribeBus = bus.on((payload) => {
    void orchestrator.playAtom({
      atomId: payload.atomId,
      startMs: payload.startMs,
      crossfadeMs: payload.crossfadeMs,
      reason: payload.reason,
    })
  })

  // 4) Detach único + idempotente.
  let detached = false
  return () => {
    if (detached) return
    detached = true
    if (typeof opts.selene.off === 'function') {
      opts.selene.off('cognitiveOutput', onCognitive)
    }
    unsubscribeBus()
    orchestrator.setClipUrlResolver(null)
  }
}

// ─── HELPERS PARA EL CALLSITE EN SELENE ──────────────────────────────────────

/**
 * Conveniencia: empuja un `ISeleneTheiaInput` directamente al pipeline,
 * saltándose el listener `'cognitiveOutput'`. Útil cuando el integrador no
 * quiere tocar el cerebro de Selene y prefiere invocar manualmente desde
 * `SeleneTitanConscious.process()`.
 */
export function pushCognitiveInput(input: ISeleneTheiaInput): void {
  const adapter = getSeleneTheiaAdapter()
  const intent = adapter.process(input)
  if (!intent) return
  getTheiaPlayAtomBus().emit({ ...intent, emittedAt: Date.now() })
}
