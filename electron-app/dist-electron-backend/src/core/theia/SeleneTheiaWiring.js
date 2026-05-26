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
import { getThetaOrchestrator } from '../../theia/ThetaOrchestrator';
import { getSeleneTheiaAdapter, } from './SeleneTheiaAdapter';
import { getTheiaRegistry } from './TheiaRegistry';
// ─── BUS INTERNO (renderer-only) ──────────────────────────────────────────────
/**
 * Bus del cue-jump. Conserva semántica "IPC" para que un futuro refactor
 * que separe Selene y Theta en procesos distintos pueda reemplazar la
 * implementación sin cambiar consumidores.
 *
 * Eventos: `'theia:cue-jump'` con `event.detail = TheiaCueJumpMessage['payload']`.
 */
class TheiaCueJumpBus {
    constructor() {
        this._target = new EventTarget();
    }
    emit(payload) {
        this._target.dispatchEvent(new CustomEvent('theia:cue-jump', { detail: payload }));
    }
    on(handler) {
        const listener = (ev) => {
            const detail = ev.detail;
            handler(detail);
        };
        this._target.addEventListener('theia:cue-jump', listener);
        return () => this._target.removeEventListener('theia:cue-jump', listener);
    }
}
let _bus = null;
export function getTheiaCueJumpBus() {
    if (!_bus)
        _bus = new TheiaCueJumpBus();
    return _bus;
}
/**
 * Conecta Selene → adapter → bus → ThetaOrchestrator.
 *
 * @returns función `detach()` que deshace TODO el wiring (listener Selene +
 *          subscription al bus + url resolver). Idempotente.
 */
export function attachSeleneTheia(opts) {
    const adapter = getSeleneTheiaAdapter();
    const orchestrator = getThetaOrchestrator();
    const bus = getTheiaCueJumpBus();
    // 1) Resolver clipId → URL.
    const defaultResolver = (clipId) => {
        const asset = getTheiaRegistry().getAsset(clipId);
        return asset?.filePath ?? null;
    };
    orchestrator.setClipUrlResolver(opts.clipUrlResolver ?? defaultResolver);
    // 2) Listener: Selene cognitive output → adapter → bus.
    const onCognitive = (input) => {
        let intent;
        try {
            intent = adapter.process(input);
        }
        catch (err) {
            // eslint-disable-next-line no-console
            console.error('[SeleneTheiaWiring 🎬] adapter.process threw:', err);
            return;
        }
        if (!intent)
            return;
        bus.emit({ ...intent, emittedAt: Date.now() });
    };
    opts.selene.on('cognitiveOutput', onCognitive);
    // 3) Listener: bus → orchestrator.handleCueJump.
    const unsubscribeBus = bus.on((payload) => {
        void orchestrator.handleCueJump({
            clipId: payload.clipId,
            cuepointId: payload.cuepointId,
            startMs: payload.startMs,
            crossfadeMs: payload.crossfadeMs,
            reason: payload.reason,
        });
    });
    // 4) Detach único + idempotente.
    let detached = false;
    return () => {
        if (detached)
            return;
        detached = true;
        if (typeof opts.selene.off === 'function') {
            opts.selene.off('cognitiveOutput', onCognitive);
        }
        unsubscribeBus();
        orchestrator.setClipUrlResolver(null);
    };
}
// ─── HELPERS PARA EL CALLSITE EN SELENE ──────────────────────────────────────
/**
 * Conveniencia: empuja un `ISeleneTheiaInput` directamente al pipeline,
 * saltándose el listener `'cognitiveOutput'`. Útil cuando el integrador no
 * quiere tocar el cerebro de Selene y prefiere invocar manualmente desde
 * `SeleneTitanConscious.process()`.
 */
export function pushCognitiveInput(input) {
    const adapter = getSeleneTheiaAdapter();
    const intent = adapter.process(input);
    if (!intent)
        return;
    getTheiaCueJumpBus().emit({ ...intent, emittedAt: Date.now() });
}
