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
// 🧬 WAVE 8235 · G3 — el GenomeEvolver (§4.6) recibe barCount+approach
// del TickEngine y muta el átomo activo vía theta.evolveGenome().
import { getGenomeEvolver } from '../../theia/genome/GenomeEvolver';
// ─── BUS INTERNO (renderer-only) ──────────────────────────────────────────────
/**
 * Bus del play-atom. Conserva semántica "IPC" para que un futuro refactor
 * que separe Selene y Theta en procesos distintos pueda reemplazar la
 * implementación sin cambiar consumidores.
 *
 * Eventos: `'theia:play-atom'` con `event.detail = TheiaPlayAtomMessage['payload']`.
 */
class TheiaPlayAtomBus {
    constructor() {
        this._target = new EventTarget();
    }
    emit(payload) {
        this._target.dispatchEvent(new CustomEvent('theia:play-atom', { detail: payload }));
    }
    on(handler) {
        const listener = (ev) => {
            const detail = ev.detail;
            handler(detail);
        };
        this._target.addEventListener('theia:play-atom', listener);
        return () => this._target.removeEventListener('theia:play-atom', listener);
    }
}
let _bus = null;
export function getTheiaPlayAtomBus() {
    if (!_bus)
        _bus = new TheiaPlayAtomBus();
    return _bus;
}
/** @deprecated WAVE 4922 — alias histórico de `getTheiaPlayAtomBus`. */
export const getTheiaCueJumpBus = getTheiaPlayAtomBus;
/**
 * Conecta Selene → adapter → bus → ThetaOrchestrator.
 *
 * @returns función `detach()` que deshace TODO el wiring (listener Selene +
 *          subscription al bus + url resolver). Idempotente.
 */
export function attachSeleneTheia(opts) {
    const adapter = getSeleneTheiaAdapter();
    const orchestrator = getThetaOrchestrator();
    const bus = getTheiaPlayAtomBus();
    // 1) Resolver atomId → URL.
    const defaultResolver = (atomId) => {
        const atom = getTheiaRegistry().getAtom(atomId);
        return atom?.filePath ?? null;
    };
    orchestrator.setClipUrlResolver(opts.clipUrlResolver ?? defaultResolver);
    // 1b) 🔮 WAVE 8230 · E4 — resolver atomId → fuente GLSL para átomos
    // `source.kind='shader'` (Hybrid Deck). Consultado antes del de vídeo.
    const defaultShaderResolver = (atomId) => {
        const atom = getTheiaRegistry().getAtom(atomId);
        if (atom?.source?.kind === 'shader' && atom.source.glsl) {
            // 🧬 G1 — el átomo variante porta su fenotipo (`core#seed` §4.5).
            return {
                source: atom.source.glsl,
                meta: atom.source.genes ? { genes: { ...atom.source.genes } } : undefined,
            };
        }
        return null;
    };
    orchestrator.setShaderSourceResolver(opts.shaderSourceResolver ?? defaultShaderResolver);
    // 1c) 🧬 WAVE 8235 · G3 — GenomeEvolver: observa u_barCount/u_approach
    // desde el TickEngine y muta el átomo generativo en frontera de frase.
    const evolver = getGenomeEvolver();
    evolver.attach(orchestrator);
    // 2) Listener: Selene cognitive output → adapter → bus.
    const onCognitive = (input) => {
        // 🎬 WAVE 8307 — árbitro: con Director PLAYLIST/SELENE/HOLD la ruta
        // cognitiva autónoma legacy queda silenciada (un solo operador activo).
        if (!orchestrator.isAutomationAllowed())
            return;
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
    // 3) Listener: bus → orchestrator.playAtom.
    const unsubscribeBus = bus.on((payload) => {
        void orchestrator.playAtom({
            atomId: payload.atomId,
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
        orchestrator.setShaderSourceResolver(null);
        getGenomeEvolver().detach();
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
    getTheiaPlayAtomBus().emit({ ...intent, emittedAt: Date.now() });
}
