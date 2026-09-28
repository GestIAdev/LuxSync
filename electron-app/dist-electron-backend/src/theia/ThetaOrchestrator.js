/**
 * 🎬 WAVE 4860 — THETA ORCHESTRATOR (renderer-side)
 *
 * Espejo del patrón de TrinityOrchestrator pero corre en el RENDERER y
 * gestiona un único Web Worker (theta.worker.ts). Se mantiene deliberadamente
 * separado de TrinityOrchestrator porque éste vive en main y opera con
 * `worker_threads` (incompatible con `OffscreenCanvas` y `WebCodecs`).
 *
 * Responsabilidades Phase 1:
 *  - Spawn del Web Worker.
 *  - 🌊 WAVE 8215 — GLASS BRIDGE: hacer pull de los MessagePorts al preload
 *    (`requestTheiaPort`) y consumir la telemetría por ping-pong: cada
 *    buffer 256B (clone main→renderer — WAVE 8216) se espeja al ring LOCAL
 *    (SharedArrayBuffer renderer-side — intra-proceso, legal bajo el veto)
 *    y su copia se devuelve al pump por `ack` con transfer. El reloj
 *    maestro ya NO cruza la frontera como SAB.
 *  - Entregar el `video-port` (role producer) al worker por transferencia.
 *  - Transferir el ring SAB y un OffscreenCanvas al worker en el INIT.
 *  - Heartbeat + circuit breaker + Phoenix (resurrection) idénticos en
 *    contrato al patrón de Trinity, adaptados a APIs de Web Worker.
 *
 * NO renderiza vídeo. NO decodifica. Eso llega en Phase 2/F3.
 */
import { makeThetaMessage, } from './protocol';
// 🌊 WAVE 8215 — Glass Bridge page-world side + telemetry ring mirror
import { onTheiaGlassMessage, requestTheiaPort, } from './glassBridge';
import { ackTelemetryFrame, createTelemetryRing, isTelemetryMessage, mirrorTelemetryIntoRing, } from './TheiaTelemetryRing';
// 🩺 WAVE 8253 — sonda de gap de llegada del port (main-thread stall probe)
import { noteTelemetryArrival } from '../core/diagnostics/MainThreadMonitor';
// 🎬 WAVE 4867 — Phase 6: thumb buffer SAB
import { createThumbSAB } from './TheiaThumbBuffer';
// 🔮 WAVE 8230 — EUCLID · E4: parser @euclid (meta → sliders UI)
import { parseEuclidMeta, resolveGeneValues, geneSignature, layoutExprGenes, structGenesDiffer, } from './shader/ShaderAssembler';
// 🧬 WAVE 8235 — INFINITE GENOME · G3: mutación en frontera de frase (§4.6)
import { darwinTournament, favoriteAtom, skipAtom, } from './genome/GenomePool';
import { genomeChildSeed } from './genome/GenomeExpander';
// 🎛️ WAVE 8239 · U1 — transporte reactivo del medio oculto (Hybrid Deck)
import { useTheiaTransportStore } from '../stores/useTheiaTransportStore';
import { getTheiaRegistry } from '../core/theia/TheiaRegistry';
// 🩸 WAVE 8263 — PROD BUILD WORKER RESCUE: mismo remedio que Hyperion
// (WAVE 7790). `new Worker(new URL(...))` emitía `assets/theta.worker-*.js`
// como fichero aparte; en prod la ventana carga por `loadFile` (file://) y
// Chromium bloquea el script del worker desde ese origen opaco → `error`
// con message undefined → 3 fallos → Circuit OPEN. `?worker&inline` embebe
// el IIFE (worker.format='iife') en el bundle y lo arranca desde una Blob
// URL: sin fetch a file://, sin CORS, sin rutas de asar. Vale en dev y prod.
import ThetaWorker from './theta.worker.ts?worker&inline';
// ─────────────────────────────────────────────────────────────────────────
// Circuit breaker (paridad con TrinityOrchestrator)
// ─────────────────────────────────────────────────────────────────────────
var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "closed";
    CircuitState["OPEN"] = "open";
    CircuitState["HALF_OPEN"] = "half_open";
})(CircuitState || (CircuitState = {}));
const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_TIMEOUT = 5000;
const CIRCUIT_HALF_OPEN_SUCCESS = 2;
const DEFAULT_CONFIG = {
    heartbeatInterval: 1000,
    // 🌊 WAVE 8221 — STALL TOLERANCE: el ack del worker comparte el event
    // loop con `gl.readPixels` (8.3MB/tick) — un stall de GPU de 3-5s es
    // recuperable y matar al worker por él cuesta mucho más que esperarlo.
    heartbeatTimeout: 10000,
    maxResurrections: 5,
    resurrectionDelay: 500,
    workerPollIntervalMs: 22,
};
// WAVE 4933.1 - THETA KILLSWITCH
// Emergency global shutdown: disables worker spawn, heartbeat, and phoenix loop.
// 🌊 WAVE 8207 — QUARANTINE LIFTED: re-enabled. The pipeline is now WebGL-based
// (gl.readPixels → SAB zero-copy), which removes the getImageData OOM path that
// motivated the original killswitch. Keep this flag as the emergency brake.
export const ENABLE_THETA_ORCHESTRATOR = true;
function getBridge() {
    // Acceso defensivo — el preload puede no haber expuesto el namespace en
    // configuraciones legacy.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lux = globalThis.lux ?? globalThis.window?.lux;
    if (!lux || !lux.theia || typeof lux.theia !== 'object') {
        return null;
    }
    return lux.theia;
}
// ─────────────────────────────────────────────────────────────────────────
// ThetaOrchestrator
// ─────────────────────────────────────────────────────────────────────────
export class ThetaOrchestrator {
    constructor(config = {}) {
        this.worker = null;
        this.isRunning = false;
        this.isReady = false;
        this.resurrections = 0;
        // 🌊 WAVE 8220 — PHOENIX LOCK: resurrecciones concurrentes (heartbeat tick +
        // worker 'error'/'messageerror'/'theia:error' en la misma ventana) spawnearían
        // workers duales — el perdedor queda zombie (contexto GL + pool 16.6MB +
        // loop 22ms con readPixels para siempre). El candado colapsa callers
        // solapados en una única resurrección.
        this.isResurrecting = false;
        // 🌊 WAVE 8221 — invalida resurrecciones en vuelo: si el operador hace
        // stop→start dentro del resurrectionDelay (500ms), el Phoenix pendiente
        // vería isRunning=true y spawnearía un segundo worker (zombie). El seq
        // cambia en cada start() → la resurrección vieja aborta tras su await.
        this.lifecycleSeq = 0;
        // 🌊 WAVE 8223 — listeners de epoch de worker (cada spawn = epoch nuevo).
        // La UI los usa para remontar el <canvas> de preview: un canvas DOM solo
        // puede transferirse una vez — tras un respawn el offscreen viejo murió
        // con el worker y hay que re-transferir un elemento nuevo.
        this.workerEpochListeners = new Set();
        this.circuit = {
            state: CircuitState.CLOSED,
            failures: 0,
            lastFailure: 0,
            successesInHalfOpen: 0,
        };
        /**
         * 🌊 WAVE 8215 — Telemetry ring LOCAL (256B, SharedArrayBuffer
         * renderer-side). Lo alimenta el `telemetry-port` del Glass Bridge por
         * ping-pong — ya NO se pide un SAB al main process (vetado). Sus primeros
         * 16B replican el layout FrameContextRing (tickId/ts/gen), que es lo que
         * lee el worker; el resto queda reservado para el Euclid ring (WAVE 8208).
         * Se pasa al worker en INIT como `frameContextSAB` — intra-proceso, legal.
         */
        this.telemetryRing = createTelemetryRing();
        /** 🌊 WAVE 8246 — vista Int32 pre-asignada para el sondeo del watchdog
         *  (lee el timestamp del FC en slots 1-2 sin alojar nada por barrido). */
        this.telemetryRingI32 = new Int32Array(this.telemetryRing);
        /** Port del canal de telemetría (main pump ↔ esta página). Vive AQUÍ —
         *  no en el worker — para sobrevivir respawns Phoenix. */
        this.telemetryPort = null;
        /** 🩺 WAVE 8253 — timestamp de la última llegada al port (sonda de stall:
         *  el pump emite ~23ms; un hueco aquí es el chock point del tick gap). */
        this.telemetryLastMsgAt = { v: 0 };
        /** 🩺 WAVE 8253 — mensajes recibidos en el port actual (diagnóstico). */
        this.telemetryMsgCount = 0;
        /** 🌊 WAVE 8246 — handle del watchdog de telemetría (re-pull ~2s). */
        this.telemetryWatchdogHandle = null;
        /** Port de video buffered si llega antes del spawn del worker. */
        this.pendingVideoPort = null;
        this.unsubGlass = null;
        this.offscreenCanvas = null;
        // 🎬 WAVE 4867 — Phase 6: thumb SAB (64×64 RGBA8) — allocado aquí y compartido con
        // TitanOrchestrator a través de `getThumbPixelSAB()` para TheiaVideoRenderer.
        this.thumbPixelSAB = createThumbSAB();
        // 🎬 WAVE 4864 — Phase 4: last asset-state report from worker
        this.lastAssetState = null;
        // Phase 2: Hidden video pipeline
        this.videoElement = null;
        this.videoStream = null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.trackProcessor = null;
        this.lastVideoStatus = null;
        this.hasLoggedFirstFrame = false;
        // 🎬 WAVE 4922 — cognitive play-atom tracking
        /** ID del átomo (.theia) actualmente cargado en el videoElement. */
        this.currentAtomId = null;
        /** Última URL pasada a loadVideo() — usada para evitar re-loads idempotentes. */
        this.currentAtomUrl = null;
        /** Último ack de seek recibido del worker (telemetría). */
        this.lastSeekAck = null;
        // 🖥️ WAVE 8268 — STRICT LIVE GATE: intents de reproducción recibidos con
        // el motor apagado (o a medio boot) se arman aquí — latest-wins. El
        // intent se dispara en 'theia:ready', tras la hidratación atómica.
        // NUNCA arranca el worker: eso es privilegio exclusivo del botón LIVE.
        this.pendingPlayIntent = null;
        this.heartbeatHandle = null;
        this.heartbeatSequence = 0;
        this.lastHeartbeatAt = 0;
        this.lastHeartbeatLatencyMs = 0;
        this.lastStateReport = null;
        // 🌊 WAVE 8211 — Master uniforms desired by the UI. Persisted here so a
        // Phoenix respawn replays them on 'theia:ready' (the worker is stateless).
        this.desiredUniforms = new Map();
        // 🔮 WAVE 8229 — EUCLID · E3: shader contract (§4.3). Las fuentes de
        // artista se persisten aquí — un worker nuevo (spawn/respawn Phoenix)
        // pierde toda su caché GL y necesita el replay completo.
        this.desiredShaders = new Map();
        this.desiredActiveShader = 'builtin';
        this.shaderStatusListeners = new Set();
        this.perfReportListeners = new Set();
        this.lastShaderStatus = null;
        this.lastPerfReport = null;
        // 🔮 WAVE 8230 — EUCLID · E4: meta `@euclid` parseado por shaderId
        // (params → sliders automáticos) + resolver shader-atom → GLSL.
        this.shaderMeta = new Map();
        this.shaderMetaListeners = new Set();
        this._shaderSourceResolver = null;
        /**
         * 🌊 WAVE 8218 — Reenvío de resizes del viewport al espejo de preview.
         * `transferControlToOffscreen` congela el backing del canvas DOM al tamaño
         * medido en el mount; el DOM ya no puede alcanzarlo, así que el
         * ResizeObserver de TheiaEngineView pasa por aquí los rects vivos y el
         * worker re-aloja el bitmap del OffscreenCanvas. El GL render target
         * (1920×1080) NO se ve afectado — solo el destino del blit 2D.
         * Best-effort: sin worker vivo no hay espejo que redimensionar.
         */
        // 🌊 WAVE 8225 — dims del viewport pendientes: el RO/UI puede medir
        // mientras el worker no existe (engine off, respawn en vuelo). Antes se
        // descartaban en silencio → el espejo quedaba a las dims horneadas en el
        // transfer (0×0 o el intrínseco 300×150) para siempre. Se reenvían al
        // worker en el handler de 'theia:ready'.
        this.pendingPreviewDims = null;
        this._clipUrlResolver = null;
        // ───────────────────────────────────────────────────────────────────────
        // 🎛️ WAVE 8239 · U1 — Transport sync (HTMLVideoElement → Zustand)
        // ───────────────────────────────────────────────────────────────────────
        /**
         * Handlers del medio oculto. Guardados para poder desconectarlos en
         * `teardownVideo` (el elemento muere → el store no debe quedar escuchándolo).
         */
        this._transportHandlers = null;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * Adopta un OffscreenCanvas que será transferido al worker en el INIT.
     * Debe llamarse ANTES de `start()`. El canvas pasa a propiedad del worker
     * (estructura nativa de transferControlToOffscreen → postMessage).
     */
    attachOffscreenCanvas(canvas) {
        if (this.isRunning && this.worker) {
            // 🌊 WAVE 8207 — live transfer: the worker mirrors its internal GL
            // framebuffer into any canvas that arrives post-start, so the
            // TheiaEngineView viewport works regardless of attach ordering.
            try {
                this.worker.postMessage(makeThetaMessage('theia:attach-canvas', { canvas }), [canvas]);
            }
            catch (err) {
                // eslint-disable-next-line no-console
                console.error('[THETA] attach-canvas transfer failed:', err);
            }
            return;
        }
        this.offscreenCanvas = canvas;
    }
    resizePreviewCanvas(width, height) {
        this.pendingPreviewDims = { width, height };
        if (!this.worker)
            return;
        try {
            this.worker.postMessage(makeThetaMessage('theia:resize-preview', { width, height }));
        }
        catch { /* worker may be dead — el replay en 'theia:ready' lo cubre */ }
    }
    async start() {
        if (this.isRunning)
            return;
        if (!ENABLE_THETA_ORCHESTRATOR) {
            this.isRunning = false;
            this.isReady = false;
            this.resurrections = 0;
            this.stopHeartbeat();
            return;
        }
        // 🌊 WAVE 8215 — GLASS BRIDGE: armamos el relay ANTES del spawn para
        // que los ports entregados por el broker se reenvíen al worker apenas
        // éste exista. El pull marca los kinds como "wanted" en el preload:
        // ports buffered → entrega inmediata; si no → main re-brokerea un
        // channel nuevo y auto-entrega al llegar.
        if (!getBridge()) {
            // El namespace window.lux.theia falta (preload roto/legacy): sin él
            // tampoco hay relay Glass ni control de la output window. No es
            // fatal para el worker (arranca con ring local), pero no habrá
            // telemetría ni proyector — avisar y continuar.
            // eslint-disable-next-line no-console
            console.warn('[THETA] window.lux.theia missing — Glass Bridge relay may be unavailable');
        }
        this.armGlassBridge();
        this.startTelemetryWatchdog();
        this.isRunning = true;
        // 🌊 WAVE 8221 — CLEAN SLATE: un restart manual es una orden del
        // operador — borra la memoria penal del watchdog. Sin esto, un circuit
        // OPEN de la sesión anterior hacía que spawnWorker() retornara en
        // silencio y el motor quedara muerto (isRunning=true, worker=null)
        // hasta que expirara el backoff de 30s.
        this.circuit.state = CircuitState.CLOSED;
        this.circuit.failures = 0;
        this.circuit.lastFailure = 0;
        this.circuit.successesInHalfOpen = 0;
        this.resurrections = 0;
        // Baseline fresca: ningún tick futuro puede evaluar contra el ack del
        // worker anterior (doble seguro con el reset en 'theia:ready', 8220).
        this.lastHeartbeatAt = Date.now();
        this.lifecycleSeq++;
        await this.spawnWorker();
        this.startHeartbeat();
    }
    async stop() {
        this.isRunning = false;
        this.stopHeartbeat();
        this.stopTelemetryWatchdog();
        this.teardownVideo();
        // 🌊 WAVE 8215 — cerrar los extremos Glass: el pump (main) retira el
        // link al ver 'close' y el worker libera su link en terminate().
        this.unsubGlass?.();
        this.unsubGlass = null;
        try {
            this.telemetryPort?.close();
        }
        catch { /* noop */ }
        this.telemetryPort = null;
        try {
            this.pendingVideoPort?.close();
        }
        catch { /* noop */ }
        this.pendingVideoPort = null;
        if (this.worker) {
            try {
                this.worker.postMessage(makeThetaMessage('theia:shutdown', {}));
            }
            catch {
                /* worker may already be dead */
            }
            try {
                this.worker.terminate();
            }
            catch {
                /* noop */
            }
            this.worker = null;
        }
        this.isReady = false;
    }
    getStatus() {
        return {
            isRunning: this.isRunning,
            isReady: this.isReady,
            resurrections: this.resurrections,
            circuitState: this.circuit.state,
            lastHeartbeatLatencyMs: this.lastHeartbeatLatencyMs,
            lastStateReport: this.lastStateReport,
            videoStatus: this.lastVideoStatus,
            assetState: this.lastAssetState,
        };
    }
    // ──────────────────────────────────────────────────────────────────
    // � WAVE 8215 — GLASS BRIDGE (transferable ports + ping-pong)
    // ──────────────────────────────────────────────────────────────────
    /**
     * Suscribe el relay del preload y hace pull de ambos kinds. Idempotente.
     * Los ports que llegan se consumen así:
     *   telemetry-port → esta página (espeja el ring, ack, sobrevive Phoenix)
     *   video-port     → transferido al theta.worker (role 'producer')
     *   video-unlink   → notify al worker (output window murió)
     */
    armGlassBridge() {
        if (!this.unsubGlass) {
            this.unsubGlass = onTheiaGlassMessage((msg) => this.handleGlassMessage(msg));
        }
        requestTheiaPort('telemetry-port');
        requestTheiaPort('video-port');
    }
    handleGlassMessage(msg) {
        if (msg.kind === 'telemetry-port' && msg.port) {
            this.attachTelemetryPort(msg.port);
            return;
        }
        if (msg.kind === 'video-port') {
            if (msg.port && msg.role === 'producer') {
                this.deliverVideoPort(msg.port);
            }
            else {
                // Defensive: este renderer es siempre el producer; un port sin rol
                // no se usa — cerrarlo evita links huérfanos en el broker.
                try {
                    msg.port?.close();
                }
                catch { /* noop */ }
            }
            return;
        }
        if (msg.kind === 'video-unlink') {
            try {
                this.worker?.postMessage(makeThetaMessage('theia:video-unlink', {}));
            }
            catch { /* worker may be dead */ }
        }
    }
    /**
     * Consume el port de telemetría en la PÁGINA (no en el worker): el ring
     * SAB local sobrevive respawns y también lo leen futuros consumers del
     * renderer. Cada buffer de 256B (clone serializado — WAVE 8216: el
     * MessagePortMain del pump no transfiere) se espeja al ring y se devuelve
     * por `ack` CON transfer en el mismo handler — ZERO-ALLOC: aquí jamás se
     * instancia un ArrayBuffer; el ack repone el pool fijo del pump.
     */
    attachTelemetryPort(port) {
        try {
            this.telemetryPort?.close();
        }
        catch { /* noop */ }
        this.telemetryPort = port;
        // 🩺 WAVE 8253 — contador por attach: si el link muere siempre tras N
        // mensajes, N delata la causa (N=3 → pool del pump seco = acks no vuelven).
        let msgCount = 0;
        port.onmessage = (ev) => {
            // 🩺 WAVE 8253 — sonda de gap de llegada: el pump emite @44Hz (~23ms);
            // un gap >400ms aquí es la evidencia DIRECTA del stall que congela el
            // ring (onmessage asfixiado por el hilo de página o pump sin pool).
            noteTelemetryArrival(this.telemetryLastMsgAt, `msgs=${msgCount + 1}`);
            msgCount++;
            this.telemetryMsgCount = msgCount;
            const data = ev.data;
            if (!isTelemetryMessage(data))
                return;
            try {
                mirrorTelemetryIntoRing(this.telemetryRing, data.buffer);
                ackTelemetryFrame(port, data);
            }
            catch (err) {
                // eslint-disable-next-line no-console
                console.warn('[THETA ⚠️] telemetry mirror/ack failed:', err);
            }
        };
        // 🌊 WAVE 8246 — si el entangle muere (el pump cerró su extremo o el
        // mensaje no fue clonable), suelta la referencia: el watchdog vuelve a
        // pedir 'telemetry-port' en el próximo barrido. El pull single-shot
        // original dejaba un NO LINK permanente ante cualquier fallo (WAVE 8245).
        // 🩺 WAVE 8253 — release etiquetado: saber QUÉ evento corta el link.
        const release = (why) => () => {
            if (this.telemetryPort === port) {
                // eslint-disable-next-line no-console
                console.warn(`[THETA ⚠️] telemetry port released by '${why}' after ${msgCount} msgs`);
                this.telemetryPort = null;
            }
        };
        port.onmessageerror = release('messageerror');
        try {
            port.addEventListener('close', release('close'));
        }
        catch { /* 'close' no soportado — el chequeo de frescura lo cubre */ }
        port.start();
        // eslint-disable-next-line no-console
        console.log('[THETA] 📡 Telemetry Port Attached! — pump↔ring @44Hz');
    }
    // ── 🌊 WAVE 8246 — TELEMETRY WATCHDOG ─────────────────────────────────
    // El pull de `requestTheiaPort` era single-shot: si el IPC se perdía, el
    // channel fallaba o el link moría en silencio, nadie volvía a pedirlo →
    // el ring local quedaba a cero y la UI mostraba NO LINK para siempre.
    // Mientras el motor corre, este barrido de 2s re-emite el pull cuando el
    // port no está atado O cuando el ring deja de frescar (link zombie).
    // Zero-alloc: un setInterval lento + la vista Int32 fija del ring.
    startTelemetryWatchdog() {
        if (this.telemetryWatchdogHandle !== null)
            return;
        this.telemetryWatchdogHandle = globalThis.setInterval(() => this.checkTelemetryLink(), 2000);
    }
    stopTelemetryWatchdog() {
        if (this.telemetryWatchdogHandle === null)
            return;
        globalThis.clearInterval(this.telemetryWatchdogHandle);
        this.telemetryWatchdogHandle = null;
    }
    /**
     * Link sano = port atado Y ring fresco (timestamp del FrameContext,
     * slots 1-2, <4s — WAVE 8251: el umbral de 2s entraba en pánico ante
     * stalls legítimos del main thread y re-armaba el channel cada barrido,
     * generando churn de ports + spam del log de attach).
     * Port ausente o ring stale → re-pull (idempotente: cada pull arma un
     * channel nuevo en main; el attach subsiguiente cierra el port viejo).
     */
    checkTelemetryLink() {
        if (!this.isRunning)
            return;
        const i32 = this.telemetryRingI32;
        const tsMs = Atomics.load(i32, 2) * 0x100000000 + (Atomics.load(i32, 1) >>> 0);
        const stale = tsMs <= 0 || Date.now() - tsMs > 4000;
        if (this.telemetryPort === null || stale) {
            requestTheiaPort('telemetry-port');
        }
    }
    /**
     * Entrega el extremo productor del video link al worker por transferencia
     * (`theia:video-port`). Si el worker aún no existe (arranque), queda
     * buffered hasta el spawn — los mensajes a un Worker se encolan antes del
     * handler, pero transferir tras spawn evita ports atrapados en un worker
     * muerto (Phoenix → re-pull → channel nuevo del broker).
     */
    deliverVideoPort(port) {
        if (this.worker) {
            try {
                const payload = { port };
                this.worker.postMessage(makeThetaMessage('theia:video-port', payload), [port]);
                return;
            }
            catch (err) {
                // eslint-disable-next-line no-console
                console.error('[THETA] video-port transfer to worker failed:', err);
            }
        }
        try {
            this.pendingVideoPort?.close();
        }
        catch { /* noop */ }
        this.pendingVideoPort = port;
    }
    // ──────────────────────────────────────────────────────────────────
    // �🎬 WAVE 4864 — Phase 4: AssetStateMachine API (force-state)
    // ──────────────────────────────────────────────────────────────────
    /**
     * Solicita una transición de la Asset State Machine en el worker. El worker
     * iniciará un crossfade de 500ms (default) entre el frame anterior y el nuevo.
     *
     * Usado por la UI manual (botones Force Drop / Force Ambient en TheiaEngineView)
     * y, en futuras fases, por el BrainTheiaBridge derivando de MusicalContext.
     */
    forceState(state, opts = {}) {
        if (!this.worker || !this.isReady) {
            // eslint-disable-next-line no-console
            console.warn('[THETA] forceState called before worker is ready — ignored');
            return;
        }
        const payload = {
            state,
            curve: opts.curve,
            totalTicks: opts.totalTicks,
            waitAnchor: opts.waitAnchor,
            manual: opts.manual ?? true, // UI calls are manual by default
        };
        try {
            this.worker.postMessage(makeThetaMessage('theia:force-state', payload));
        }
        catch (err) {
            // eslint-disable-next-line no-console
            console.error('[THETA] forceState postMessage failed:', err);
        }
    }
    /** Último reporte de la AssetStateMachine recibido del worker. */
    getAssetState() {
        return this.lastAssetState;
    }
    // ──────────────────────────────────────────────────────────────────
    // 🎬 WAVE 4922 — Cognitive Play-Atom (Selene → Theta)
    // ──────────────────────────────────────────────────────────────────
    /**
     * Procesa un `AtomPlayIntent` emitido por `SeleneTheiaAdapter`.
     *
     * Pipeline:
     *   1. Si `atomId === ''` → blackout: detiene reproducción y limpia worker.
     *   2. Si `atomId !== currentAtomId` → resuelve filePath via `TheiaRegistry`
     *      y llama a `loadVideo()` (lazy load del átomo binario).
     *   3. Aplica `videoElement.currentTime = startMs / 1000`.
     *   4. Asegura `play()` (Selene asume reproducción activa post-trigger).
     *   5. PostMessage al worker con `theia:seek` para que prepare el crossfade
     *      visual (snapshot + curva de mezcla).
     *
     * Es idempotente y resiliente: si el worker no está listo, log + return.
     * No lanza excepciones.
     */
    async playAtom(intent) {
        // 🖥️ WAVE 8268 — STRICT LIVE GATE: el motor solo arranca por el botón
        // LIVE. Con motor apagado O a medio boot (worker sin 'theia:ready') el
        // intent queda ARMADO en pendingPlayIntent y se dispara tras la
        // hidratación — el clic jamás se pierde, pero nunca spawnea el worker.
        if (!this.isRunning || !this.worker || !this.isReady) {
            this.pendingPlayIntent = { ...intent };
            // eslint-disable-next-line no-console
            console.log(`[THETA 🎬] play-atom '${intent.atomId}' armed — waiting for LIVE`);
            return;
        }
        // ── Caso 1: blackout ─────────────────────────────────────────────────
        if (!intent.atomId) {
            this._emitSeekToWorker({
                atomId: '',
                startMs: 0,
                crossfadeMs: intent.crossfadeMs,
                reason: 'blackout',
            });
            // 🔮 E4 — un blackout también desactiva el shader generativo (vuelta
            // al path builtin, que es donde el operador espera la salida).
            if (this.desiredActiveShader !== 'builtin') {
                this.activateShader('builtin', intent.crossfadeMs);
            }
            try {
                if (this.videoElement)
                    this.videoElement.pause();
            }
            catch { /* noop */ }
            return;
        }
        // ── Caso 1b (🔮 E4 · 🌊 U4-fix WAVE 8243): átomo generativo
        // `source.kind='shader'` — BYPASS total del pipeline de vídeo.
        // Precedencia: 1) `_shaderSourceResolver` externo (variantes
        // `core#seed` y overrides de test/wiring); 2) fallback directo al
        // TheiaRegistry — la ruta shader NO puede depender de que
        // `attachSeleneTheia` esté viva, o un click con el wiring caído
        // intentaba cargar `euclid://…`/`*.glsl` como VÍDEO (bug U4).
        let shaderSrc = this._shaderSourceResolver?.(intent.atomId) ?? null;
        if (!shaderSrc) {
            const atom = getTheiaRegistry().getAtom(intent.atomId);
            if (atom?.source?.kind === 'shader' && atom.source.glsl) {
                shaderSrc = {
                    source: atom.source.glsl,
                    meta: atom.source.genes
                        ? { genes: { ...atom.source.genes } }
                        : undefined,
                };
            }
        }
        if (shaderSrc) {
            // Dedup: re-trigger del mismo átomo no recompila si la fuente Y el
            // fenotipo no cambiaron (la caché LRU del worker ya la conserva).
            // 🧬 G1 — la firma compara el genoma RESUELTO (defaults ∪ overrides).
            const prev = this.desiredShaders.get(intent.atomId);
            const nextSig = geneSignature(resolveGeneValues(parseEuclidMeta(shaderSrc.source), shaderSrc.meta?.genes));
            if (!prev ||
                prev.source !== shaderSrc.source ||
                geneSignature(prev.meta?.genes) !== nextSig) {
                this.loadShader(intent.atomId, shaderSrc.source, shaderSrc.meta);
            }
            this.activateShader(intent.atomId, intent.crossfadeMs);
            this.currentAtomId = intent.atomId;
            this.currentAtomUrl = null;
            try {
                if (this.videoElement && !this.videoElement.paused) {
                    this.videoElement.pause();
                }
            }
            catch { /* noop */ }
            return;
        }
        // ── Caso 2: cambio de asset → lazy load ──────────────────────────────
        if (intent.atomId !== this.currentAtomId) {
            const resolver = intent.urlResolver ?? this._clipUrlResolver;
            const url = resolver ? resolver(intent.atomId) : null;
            if (!url) {
                // eslint-disable-next-line no-console
                console.warn(`[THETA 🎬] play-atom '${intent.atomId}' — no URL resolver`);
                return;
            }
            try {
                await this.loadVideo(url);
                this.currentAtomId = intent.atomId;
                this.currentAtomUrl = url;
                // 🔮 E4 — el nuevo átomo es de vídeo: si un shader generativo
                // estaba en pantalla, vuelve al path builtin con el crossfade.
                if (this.desiredActiveShader !== 'builtin') {
                    this.activateShader('builtin', intent.crossfadeMs);
                }
            }
            catch (err) {
                // eslint-disable-next-line no-console
                console.error(`[THETA 🎬] play-atom load failed for '${intent.atomId}':`, err);
                return;
            }
        }
        // ── Caso 3: SEEK + play ──────────────────────────────────────────────
        if (this.videoElement) {
            try {
                // Math.max porque ms negativos romperían el currentTime; clampear a 0.
                const seconds = Math.max(0, intent.startMs / 1000);
                this.videoElement.currentTime = seconds;
                if (this.videoElement.paused) {
                    this.videoElement.play().catch((err) => {
                        // eslint-disable-next-line no-console
                        console.warn('[THETA 🎬] play() after seek failed:', err);
                    });
                }
            }
            catch (err) {
                // eslint-disable-next-line no-console
                console.error('[THETA 🎬] videoElement.currentTime assignment failed:', err);
            }
        }
        // ── Caso 4: notificar al worker para crossfade visual ────────────────
        this._emitSeekToWorker({
            atomId: intent.atomId,
            startMs: intent.startMs,
            crossfadeMs: intent.crossfadeMs,
            reason: intent.reason,
        });
    }
    /**
     * Registra un resolver `atomId → URL` para que `playAtom` pueda
     * cargar lazily los `.mp4` declarados por los manifests `.theia`.
     *
     * Típicamente la wiring de Selene hace:
     *   `orchestrator.setClipUrlResolver(id => theiaRegistry.getAtom(id)?.filePath ?? null)`
     */
    setClipUrlResolver(resolver) {
        this._clipUrlResolver = resolver;
    }
    /** Último ack de seek recibido del worker (telemetría). */
    getLastSeekAck() {
        return this.lastSeekAck;
    }
    /**
     * WAVE 4910.5 — Expone el videoElement interno para que el renderer pueda
     * consultar `currentTime` y `duration` sin IPC round-trip.
     * Solo válido después de un `loadVideo()` exitoso.
     */
    getVideoElement() {
        return this.videoElement;
    }
    /** ID del átomo actualmente cargado, o null. */
    getCurrentAtomId() {
        return this.currentAtomId;
    }
    /** @deprecated WAVE 4922 — alias histórico de `getCurrentAtomId`. */
    getCurrentClipId() {
        return this.currentAtomId;
    }
    /**
     * @deprecated WAVE 4922 — alias histórico de `playAtom`.
     */
    handleCueJump(intent) {
        return this.playAtom(intent);
    }
    // ── private helper ──
    _emitSeekToWorker(p) {
        if (!this.worker)
            return;
        const payload = { ...p, emittedAt: Date.now() };
        try {
            this.worker.postMessage(makeThetaMessage('theia:seek', payload));
        }
        catch (err) {
            // eslint-disable-next-line no-console
            console.error('[THETA 🎬] seek postMessage failed:', err);
        }
    }
    // ──────────────────────────────────────────────────────────────────
    // 🎬 WAVE 4867 — Phase 6: Thumb SAB accessor para TheiaVideoRenderer
    // ──────────────────────────────────────────────────────────────────
    /**
     * Devuelve el SAB de 64×64 RGBA8 que el worker rellena con el downscale
     * de cada frame. TitanOrchestrator lo usa para construir TheiaVideoRenderer.
     * El SAB vive para toda la vida del orchestrator (inmutable).
     */
    getThumbPixelSAB() {
        return this.thumbPixelSAB;
    }
    // ──────────────────────────────────────────────────────────────────
    // 🎬 WAVE 4864 — Phase 3: Output Window control (BrowserWindow secundaria)
    // ──────────────────────────────────────────────────────────────────
    /** Abre la ventana secundaria del proyector (frameless, fullscreen). */
    async openOutputWindow() {
        const bridge = getBridge();
        if (!bridge || typeof bridge.openOutput !== 'function') {
            return { ok: false, error: 'preload bridge missing openOutput' };
        }
        return bridge.openOutput();
    }
    /** Cierra la ventana del proyector si está abierta. */
    async closeOutputWindow() {
        const bridge = getBridge();
        if (!bridge || typeof bridge.closeOutput !== 'function')
            return { ok: false };
        return bridge.closeOutput();
    }
    /** Reporta si la ventana del proyector está abierta actualmente. */
    async isOutputWindowOpen() {
        const bridge = getBridge();
        if (!bridge || typeof bridge.isOutputOpen !== 'function')
            return false;
        return bridge.isOutputOpen();
    }
    // ─────────────────────────────────────────────────────────────────────
    // Phase 2: Video playback API
    // ─────────────────────────────────────────────────────────────────────
    /**
     * Load a video URL into the hidden player, extract a ReadableStream<VideoFrame>
     * via MediaStreamTrackProcessor, and transfer it to the ThetaWorker.
     * The worker will consume frames and render them to its OffscreenCanvas.
     */
    async loadVideo(url) {
        if (!ENABLE_THETA_ORCHESTRATOR) {
            // eslint-disable-next-line no-console
            console.warn('[THETA] loadVideo ignored (Theta disabled by WAVE 4933.1 killswitch)');
            return;
        }
        if (!this.isRunning || !this.worker) {
            throw new Error('[THETA] loadVideo called before start() or worker is dead');
        }
        // eslint-disable-next-line no-console
        console.log('[THETA TRACE] 🎬 loadVideo enter:', { url });
        // Tear down any previous video pipeline
        this.teardownVideo();
        this.hasLoggedFirstFrame = false;
        // 1) Create a hidden <video> element
        const video = document.createElement('video');
        video.src = url;
        video.crossOrigin = 'anonymous';
        video.muted = true; // required for autoplay in Chromium
        video.playsInline = true;
        video.preload = 'auto';
        video.style.position = 'fixed';
        video.style.top = '-9999px';
        video.style.left = '-9999px';
        video.style.width = '1px';
        video.style.height = '1px';
        video.style.opacity = '0';
        video.style.pointerEvents = 'none';
        this.videoElement = video;
        this._attachTransportSync(video);
        // 2) Wait for metadata to resolve dimensions
        await new Promise((resolve, reject) => {
            video.addEventListener('loadedmetadata', () => resolve(), { once: true });
            video.addEventListener('error', () => reject(new Error(`[THETA] video load error: ${video.error?.message ?? 'unknown'}`)), { once: true });
        });
        // eslint-disable-next-line no-console
        console.log('[THETA TRACE] 🎬 metadata ready:', {
            width: video.videoWidth,
            height: video.videoHeight,
        });
        // 3) Capture the video stream
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stream = video.captureStream();
        this.videoStream = stream;
        const videoTrack = stream.getVideoTracks()[0];
        if (!videoTrack) {
            throw new Error('[THETA] captureStream() returned no video tracks');
        }
        // 4) MediaStreamTrackProcessor → ReadableStream<VideoFrame>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const MediaStreamTrackProcessorCtor = globalThis.MediaStreamTrackProcessor;
        if (!MediaStreamTrackProcessorCtor) {
            throw new Error('[THETA] MediaStreamTrackProcessor not available in this browser/Electron version');
        }
        this.trackProcessor = new MediaStreamTrackProcessorCtor({ track: videoTrack });
        const readable = this.trackProcessor.readable;
        // 5) Transfer the ReadableStream to the worker
        const payload = {
            stream: readable,
            width: video.videoWidth,
            height: video.videoHeight,
        };
        // eslint-disable-next-line no-console
        console.log('[THETA TRACE] 📡 posting theia:load-stream to worker');
        this.worker.postMessage(makeThetaMessage('theia:load-stream', payload), 
        // Transfer the stream — ownership moves to the worker
        [readable]);
        // eslint-disable-next-line no-console
        console.log(`[THETA] 🎬 loadVideo: ${video.videoWidth}x${video.videoHeight} — stream transferred to worker`);
    }
    /**
     * Start or resume video playback. The worker will start receiving frames.
     */
    play() {
        if (this.videoElement) {
            this.videoElement.play().catch((err) => {
                // eslint-disable-next-line no-console
                console.error('[THETA] video.play() failed:', err);
            });
        }
    }
    /**
     * Pause video playback. Frame stream stops flowing.
     */
    pause() {
        if (this.videoElement) {
            this.videoElement.pause();
        }
    }
    /**
     * Set playback rate (1.0 = normal, 0.5 = half speed, 2.0 = double).
     */
    setPlaybackRate(rate) {
        if (this.videoElement) {
            this.videoElement.playbackRate = rate;
        }
    }
    // ───────────────────────────────────────────────────────────────────────
    // 🎛️ WAVE 8239 · U1 — Transport commands (Hybrid Deck)
    // ───────────────────────────────────────────────────────────────────────
    /**
     * Toggle PLAY/PAUSE del medio activo. El store se actualiza por eventos
     * ('play'/'pause') — este método solo emite la orden al elemento.
     */
    toggleTransport() {
        const video = this.videoElement;
        if (!video)
            return;
        if (video.paused || video.ended)
            this.play();
        else
            this.pause();
    }
    /**
     * Loop del transporte. Persistido en `useTheiaTransportStore` — el handler
     * 'ended' lo consulta al cerrar el medio. No usa `video.loop` nativo:
     * el loop manual reinicia desde el inicio del átomo y mantiene el store
     * notificado.
     */
    setTransportLoop(loop) {
        useTheiaTransportStore.getState().setLoop(loop);
    }
    /**
     * Scrub absoluto (segundos) sobre el medio activo. Clamp defensivo a
     * [0, duration]; el sync del store llega por 'timeupdate' pero se
     * anticipa aquí para que el fader reaccione sin latencia.
     */
    seekTransport(seconds) {
        const video = this.videoElement;
        if (!video || !Number.isFinite(seconds))
            return;
        const dur = Number.isFinite(video.duration) ? video.duration : 0;
        video.currentTime = Math.max(0, Math.min(seconds, dur > 0 ? dur : seconds));
        useTheiaTransportStore.getState().syncFromVideo({ currentTime: video.currentTime });
    }
    /**
     * 🌊 WAVE 8211 — Scalar uniform bridge to the worker's shader pipeline.
     * The value is persisted in `desiredUniforms` so worker respawns replay it
     * on 'theia:ready'. Safe to call before start() — it queues silently.
     */
    setUniform(name, value) {
        this.desiredUniforms.set(name, value);
        if (!this.worker)
            return;
        try {
            this.worker.postMessage(makeThetaMessage('theia:set-uniform', { name, value }));
        }
        catch { /* worker may be dead — the replay on ready covers it */ }
    }
    // ───────────────────────────────────────────────────────────────────────
    // 🔮 WAVE 8229 — EUCLID · E3: Shader Contract facade (§4.3)
    // ───────────────────────────────────────────────────────────────────────
    /**
     * Compila un fragment shader de artista (cuerpo `mainImage`) sin activarlo.
     * La fuente queda persistida para replay post-respawn. Resultado vía
     * `onShaderStatus` (o `lastShaderStatus`).
     */
    loadShader(shaderId, source, meta) {
        // 🔮 WAVE 8230 · E4 — parsear meta @euclid una vez (params → sliders).
        const parsed = parseEuclidMeta(source);
        if (meta?.steps !== undefined)
            parsed.steps = meta.steps;
        this.shaderMeta.set(shaderId, parsed);
        for (const l of this.shaderMetaListeners) {
            try {
                l(shaderId, parsed);
            }
            catch { /* listener errors must not break load */ }
        }
        // 🧬 WAVE 8233 · G1 — fenotipo efectivo: defaults `@euclid gene` ∪
        // overrides del átomo variante (`source.genes` / futuro Expander).
        // `resolveGeneValues` es idempotente → overrides ya resueltos pasan
        // tal cual. El worker lo inyecta como #define → programKey propio.
        const genes = resolveGeneValues(parsed, meta?.genes);
        // 🧬 WAVE 8235 · G3 — orden `u_gene[8]` de los genes `expr` (fast-path:
        // mutarlos no recompila — el worker los sube por `uniform1fv`).
        const exprGenes = layoutExprGenes(parsed);
        const wireMeta = {
            ...meta,
            ...(genes ? { genes } : {}),
            ...(exprGenes.length ? { exprGenes } : {}),
        };
        this.desiredShaders.set(shaderId, { source, meta: wireMeta });
        if (!this.worker)
            return;
        try {
            this.worker.postMessage(makeThetaMessage('theia:load-shader', {
                shaderId,
                source,
                meta: wireMeta,
            }));
        }
        catch { /* worker may be dead — replay on ready covers it */ }
    }
    /**
     * Conmuta al shader `shaderId` con crossfade opcional. `'builtin'` vuelve
     * al plasma interno de WAVE 8207. La elección persiste para replay.
     */
    activateShader(shaderId, crossfadeMs = 0) {
        this.desiredActiveShader = shaderId;
        if (!this.worker)
            return;
        try {
            this.worker.postMessage(makeThetaMessage('theia:activate-shader', { shaderId, crossfadeMs }));
        }
        catch { /* worker may be dead */ }
    }
    /**
     * 🧬 WAVE 8235/8236 · G3+G4 — evolución en frontera de frase (Infinite
     * Genome §4.6). El `GenomeEvolver` la llama tras verificar las compuertas
     * (`approach < 0.2`, sin drop activo):
     *
     *   1. `childSeed = PCG(seed_actual ⊕ contador_de_frases)` (§4.6-1).
     *   2. `darwinTournament` (G4): torneo de 3 sobre la población viva del
     *      core activo — los dos mejores fitness se reproducen por crossover
     *      (o mutación si la población es < 2) y los peores se extinguen
     *      hasta la cota de 8. El activo en pantalla está protegido.
     *   3. Solo `expr` cambió → `activateShader(..., 0)` y el worker fija
     *      `u_gene` sin recompilar ni crossfade (fast-path por programKey).
     *   4. Cambió algún `struct` → crossfade de 2 compases (`barMs·2`).
     */
    evolveGenome(phraseIndex, barMs = 0) {
        const id = this.desiredActiveShader;
        if (id === 'builtin')
            return;
        const meta = this.shaderMeta.get(id);
        if (!meta || meta.genes.length === 0)
            return;
        const hashIdx = id.lastIndexOf('#');
        const coreId = hashIdx >= 0 ? id.slice(0, hashIdx) : id;
        const curSeed = hashIdx >= 0 ? (parseInt(id.slice(hashIdx + 1), 10) >>> 0) : 0;
        const childSeed = genomeChildSeed(curSeed, phraseIndex);
        const spawned = darwinTournament(coreId, childSeed, id);
        if (!spawned || spawned.atomId === id)
            return;
        const shaderSrc = this._shaderSourceResolver?.(spawned.atomId) ?? null;
        if (!shaderSrc)
            return;
        const childGenes = spawned.phenotype.genes;
        const parentGenes = this.desiredShaders.get(id)?.meta?.genes;
        const exprOnly = !!parentGenes && !structGenesDiffer(meta, parentGenes, childGenes);
        this.loadShader(spawned.atomId, shaderSrc.source, shaderSrc.meta);
        const fadeMs = exprOnly
            ? 0
            : barMs > 0
                ? Math.min(6000, Math.max(400, barMs * 2))
                : 0;
        this.activateShader(spawned.atomId, fadeMs);
    }
    /**
     * 🧬 WAVE 8236 · G4 — impulso del operador desde el LiveDeck (§4.6):
     * FAVORITO. Sube el fitness del individuo en el próximo paso EMA.
     */
    markFavorite(atomId) {
        favoriteAtom(atomId);
    }
    /**
     * 🧬 WAVE 8236 · G4 — impulso del operador desde el LiveDeck (§4.6):
     * SKIP. Baja el fitness del individuo en el próximo paso EMA.
     */
    markSkip(atomId) {
        skipAtom(atomId);
    }
    /** Suscripción a `theia:shader-status`. Devuelve unsubscribe. */
    onShaderStatus(listener) {
        this.shaderStatusListeners.add(listener);
        return () => {
            this.shaderStatusListeners.delete(listener);
        };
    }
    /** Suscripción a `theia:perf-report` (governor, ~1 Hz). */
    onPerfReport(listener) {
        this.perfReportListeners.add(listener);
        return () => {
            this.perfReportListeners.delete(listener);
        };
    }
    getLastShaderStatus() {
        return this.lastShaderStatus;
    }
    getLastPerfReport() {
        return this.lastPerfReport;
    }
    /**
     * 🎛️ WAVE 8240 · U2 — ring local (256B) espejado por el Glass Bridge.
     * La UI lo lee con un `TelemetryWireReader` en un rAF: zero-alloc, sin
     * React state. El pump ya publica por 'telemetry-port' y
     * `mirrorTelemetryIntoRing` lo mantiene fresco — solo faltaba exponer
     * el espejo al consumer React.
     */
    getTelemetryRing() {
        return this.telemetryRing;
    }
    // 🔮 WAVE 8230 — EUCLID · E4: meta @euclid → UI de parámetros (§4.2)
    // ───────────────────────────────────────────────────────────────────────
    /** Suscripción a meta parseado en cada `loadShader`. Devuelve unsubscribe. */
    onShaderMeta(listener) {
        this.shaderMetaListeners.add(listener);
        return () => {
            this.shaderMetaListeners.delete(listener);
        };
    }
    /** Meta `@euclid` ya parseado (params, genome, zone, steps) de un shader. */
    getShaderMeta(shaderId) {
        return this.shaderMeta.get(shaderId) ?? null;
    }
    /** Shader deseado actualmente activo ('builtin' = plasma interno). */
    getActiveShaderId() {
        return this.desiredActiveShader;
    }
    /**
     * Resolver `atomId → {source GLSL}` para átomos `source.kind='shader'`
     * (Hybrid Deck, §4.2/§6). Se consulta ANTES del resolver de vídeo en
     * `playAtom` — Selene no distingue el medio.
     */
    setShaderSourceResolver(resolver) {
        this._shaderSourceResolver = resolver;
    }
    /**
     * Unload the current video, stopping the stream and cleaning up resources.
     */
    unloadVideo() {
        this.teardownVideo();
        if (this.worker) {
            try {
                this.worker.postMessage(makeThetaMessage('theia:unload-stream', {}));
            }
            catch { /* worker may be dead */ }
        }
    }
    /**
     * Conecta los eventos del `HTMLVideoElement` al `useTheiaTransportStore`.
     * `ended` implementa el loop manual: con `loop` activo reinicia el medio
     * (garantiza re-disparo del pipeline; `video.loop` nativo ni siquiera
     * emitiría 'ended' y el store quedaría ciego).
     */
    _attachTransportSync(video) {
        const sync = useTheiaTransportStore.getState().syncFromVideo;
        const onPlay = () => sync({ isPlaying: true });
        const onPause = () => sync({ isPlaying: false });
        const onTime = () => sync({
            currentTime: video.currentTime,
            duration: Number.isFinite(video.duration) ? video.duration : 0,
        });
        const onEnded = () => {
            if (useTheiaTransportStore.getState().loop) {
                video.currentTime = 0;
                video.play().catch(() => sync({ isPlaying: false }));
            }
            else {
                sync({ isPlaying: false });
            }
        };
        this._transportHandlers = {
            play: onPlay,
            pause: onPause,
            timeupdate: onTime,
            ended: onEnded,
            durationchange: onTime,
            loadedmetadata: onTime,
        };
        for (const [ev, fn] of Object.entries(this._transportHandlers)) {
            video.addEventListener(ev, fn);
        }
        sync({ hasVideo: true });
    }
    _detachTransportSync(video) {
        if (this._transportHandlers) {
            for (const [ev, fn] of Object.entries(this._transportHandlers)) {
                video.removeEventListener(ev, fn);
            }
            this._transportHandlers = null;
        }
        useTheiaTransportStore.getState().resetTransport();
    }
    teardownVideo() {
        // 🎬 WAVE 4922 — clear play-atom tracking when the underlying átomo goes away.
        this.currentAtomId = null;
        this.currentAtomUrl = null;
        if (this.trackProcessor) {
            // Stop the track processor (closes the readable stream)
            try {
                const track = this.videoStream?.getVideoTracks()[0];
                if (track)
                    track.stop();
            }
            catch { /* noop */ }
            this.trackProcessor = null;
        }
        if (this.videoStream) {
            this.videoStream.getTracks().forEach((t) => t.stop());
            this.videoStream = null;
        }
        if (this.videoElement) {
            this._detachTransportSync(this.videoElement);
            this.videoElement.pause();
            this.videoElement.src = '';
            this.videoElement.remove();
            this.videoElement = null;
        }
    }
    // ───────────────────────────────────────────────────────────────────────
    // Spawn / lifecycle
    // ───────────────────────────────────────────────────────────────────────
    async spawnWorker() {
        if (!ENABLE_THETA_ORCHESTRATOR) {
            return;
        }
        if (this.circuit.state === CircuitState.OPEN) {
            const elapsed = Date.now() - this.circuit.lastFailure;
            if (elapsed < CIRCUIT_TIMEOUT) {
                // eslint-disable-next-line no-console
                console.log('[THETA] Circuit OPEN — waiting before respawn');
                return;
            }
            this.circuit.state = CircuitState.HALF_OPEN;
            // eslint-disable-next-line no-console
            console.log('[THETA] Circuit HALF-OPEN — testing respawn');
        }
        // El ring local siempre existe (readonly, init en campo) — es un SAB
        // renderer-side, no requiere IPC ni negociación con el main process.
        // 🩸 WAVE 8263 — constructor inline (Blob URL), ver import arriba. Un
        // fallo SÍNCRONO (CSP, Blob no permitido…) se captura aquí en vez de
        // morir como excepción sin contexto en el caller.
        let worker;
        try {
            worker = new ThetaWorker({ name: 'theta' });
        }
        catch (err) {
            // eslint-disable-next-line no-console
            console.error('[THETA] worker construction failed:', err);
            this.handleWorkerFailure(`construct: ${String(err?.message ?? err)}`);
            return;
        }
        worker.addEventListener('message', (ev) => {
            this.handleWorkerMessage(ev.data);
        });
        worker.addEventListener('error', (ev) => {
            // Un fallo de CARGA del script no trae message/filename (el navegador
            // oculta el motivo) — se vuelca el evento entero para distinguirlo de
            // una excepción de runtime dentro del worker.
            const detail = ev.message
                ? `${ev.message} @ ${ev.filename ?? '?'}:${ev.lineno ?? 0}:${ev.colno ?? 0}`
                : 'script load failure (no message — blocked fetch/CSP/parse)';
            // eslint-disable-next-line no-console
            console.error('[THETA] worker error:', detail, ev.error ?? ev);
            this.handleWorkerFailure(detail);
        });
        // Web Workers do not emit 'exit' like Node workers, but message channel
        // closure surfaces as `messageerror` on transferred-object failures.
        worker.addEventListener('messageerror', (ev) => {
            // eslint-disable-next-line no-console
            console.error('[THETA] worker messageerror:', ev);
            this.handleWorkerFailure('messageerror — transferable failed');
        });
        this.worker = worker;
        // INIT: transferimos el OffscreenCanvas (si lo hay). El SAB NO se
        // transfiere — se comparte por referencia (estructura clone-by-share).
        const transfer = [];
        const canvas = this.offscreenCanvas;
        if (canvas) {
            transfer.push(canvas);
        }
        worker.postMessage(makeThetaMessage('theia:init', {
            // 🌊 WAVE 8215 — ring local de 256B alimentado por el telemetry
            // port (ping-pong con el pump de main). Sus primeros 16B replican
            // el FrameContextRing que el worker pollea — ya no hay SAB remoto.
            frameContextSAB: this.telemetryRing,
            pollIntervalMs: this.config.workerPollIntervalMs,
            offscreenCanvas: canvas ?? undefined,
            // 🎬 WAVE 4867 — Phase 6: pass the thumb SAB (always present).
            thumbPixelSAB: this.thumbPixelSAB,
        }), transfer);
        // Tras transferir el canvas perdemos su control en este lado.
        if (canvas)
            this.offscreenCanvas = null;
        // 🖥️ WAVE 8268 — HIDRATACIÓN ATÓMICA: un solo paquete encolado detrás
        // de INIT (FIFO por el port del worker — se procesa tras initGL, con el
        // contexto ya vivo). Lleva uniforms + dims + TODAS las fuentes en
        // `desiredShaders` y la activación deseada. ORDEN CRÍTICO: el shader
        // activo viaja el ÚLTIMO — con la LRU a 8 slots y un kit de 11+ átomos,
        // ninguna evicción puede tocarlo antes de su `theia:activate-shader`.
        const shaders = [];
        for (const [shaderId, s] of this.desiredShaders) {
            shaders.push({ shaderId, source: s.source, meta: s.meta });
        }
        const activeId = this.desiredActiveShader;
        if (activeId !== 'builtin') {
            const ai = shaders.findIndex((s) => s.shaderId === activeId);
            if (ai >= 0)
                shaders.push(shaders.splice(ai, 1)[0]);
        }
        worker.postMessage(makeThetaMessage('theia:hydrate', {
            uniforms: Array.from(this.desiredUniforms.entries()),
            previewDims: this.pendingPreviewDims,
            shaders,
            activeShaderId: activeId,
        }));
        // 🌊 WAVE 8215 — flush del video port si el broker lo entregó antes
        // del spawn (página tardía / respawn): transferencia inmediata.
        if (this.pendingVideoPort) {
            this.deliverVideoPort(this.pendingVideoPort);
            this.pendingVideoPort = null;
        }
        // 🌊 WAVE 8223 — epoch bump: notifica a la UI que hay un worker nuevo.
        // El preview <canvas> se remonta vía key={epoch} y re-transfiere un
        // OffscreenCanvas fresco (el anterior pertenece al worker muerto).
        for (const listener of this.workerEpochListeners) {
            try {
                listener();
            }
            catch {
                /* listener errors must not break spawn */
            }
        }
    }
    /**
     * 🌊 WAVE 8223 — suscripción al epoch del worker. Devuelve unsubscribe.
     * Cada spawn (start inicial o respawn Phoenix) dispara los listeners.
     */
    onWorkerEpoch(listener) {
        this.workerEpochListeners.add(listener);
        return () => {
            this.workerEpochListeners.delete(listener);
        };
    }
    handleWorkerMessage(msg) {
        if (!msg || typeof msg.type !== 'string')
            return;
        switch (msg.type) {
            case 'theia:ready':
                this.isReady = true;
                // 🌊 WAVE 8220 — baseline de vida del worker NUEVO. Sin esto el
                // watchdog hereda el ack del worker muerto: el primer tick tras
                // 'ready' mide elapsed ≈ timeout+delay+spawn (>3000ms) contra una
                // referencia stale y ejecuta un falso positivo → el bucle de
                // resurrecciones se auto-perpetúa hasta agotar maxResurrections.
                this.lastHeartbeatAt = Date.now();
                this.circuit.state = CircuitState.CLOSED;
                this.circuit.failures = 0;
                // eslint-disable-next-line no-console
                console.log('[THETA] worker READY');
                // 🖥️ WAVE 8268 — el replay de uniforms/dims/shaders ya NO vive aquí:
                // viajó atómico en `theia:hydrate` (encolado tras el INIT). Lo único
                // pendiente tras ready es el intent armado por el operador con el
                // motor apagado (STRICT LIVE GATE — se dispara ahora con el worker
                // hidratado y listo).
                {
                    const pending = this.pendingPlayIntent;
                    this.pendingPlayIntent = null;
                    if (pending) {
                        // eslint-disable-next-line no-console
                        console.log(`[THETA 🎬] firing armed play-atom '${pending.atomId}'`);
                        void this.playAtom(pending);
                    }
                }
                break;
            case 'theia:heartbeat-ack': {
                const ack = msg.payload;
                this.lastHeartbeatAt = Date.now();
                this.lastHeartbeatLatencyMs = ack.latencyMs;
                if (this.circuit.state === CircuitState.HALF_OPEN) {
                    this.circuit.successesInHalfOpen++;
                    if (this.circuit.successesInHalfOpen >= CIRCUIT_HALF_OPEN_SUCCESS) {
                        this.circuit.state = CircuitState.CLOSED;
                        this.circuit.failures = 0;
                        // eslint-disable-next-line no-console
                        console.log('[THETA] Circuit CLOSED');
                    }
                }
                break;
            }
            case 'theia:state-report':
                this.lastStateReport = msg.payload;
                break;
            case 'theia:video-status':
                this.lastVideoStatus = msg.payload;
                if (!this.hasLoggedFirstFrame && this.lastVideoStatus.framesDecoded > 0) {
                    this.hasLoggedFirstFrame = true;
                    // eslint-disable-next-line no-console
                    console.log('[THETA TRACE] ✅ first frame received from worker', {
                        state: this.lastVideoStatus.state,
                        framesDecoded: this.lastVideoStatus.framesDecoded,
                        framesDropped: this.lastVideoStatus.framesDropped,
                    });
                }
                break;
            case 'theia:asset-state':
                this.lastAssetState = msg.payload;
                break;
            case 'theia:seek-ack':
                this.lastSeekAck = msg.payload;
                break;
            // 🔮 WAVE 8229 · E3 — shader contract status + governor telemetry
            case 'theia:shader-status': {
                this.lastShaderStatus = msg.payload;
                const s = this.lastShaderStatus;
                if (!s.ok && !s.pending) {
                    // eslint-disable-next-line no-console
                    console.error(`[THETA] shader '${s.shaderId}' failed${s.line ? ` @line ${s.line}` : ''}: ${s.log}`);
                }
                for (const l of this.shaderStatusListeners) {
                    try {
                        l(s);
                    }
                    catch { /* listener errors must not break dispatch */ }
                }
                break;
            }
            case 'theia:perf-report': {
                this.lastPerfReport = msg.payload;
                for (const l of this.perfReportListeners) {
                    try {
                        l(this.lastPerfReport);
                    }
                    catch { /* listener errors must not break dispatch */ }
                }
                break;
            }
            case 'theia:error': {
                const err = msg.payload;
                // eslint-disable-next-line no-console
                console.error(`[THETA] worker error: ${err.message}`, err.stack);
                if (err.fatal)
                    this.handleWorkerFailure(err.message);
                break;
            }
            default:
                // eslint-disable-next-line no-console
                console.warn('[THETA] unknown message:', msg.type);
        }
    }
    // ───────────────────────────────────────────────────────────────────────
    // Heartbeat
    // ───────────────────────────────────────────────────────────────────────
    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatHandle = globalThis.setInterval(() => {
            if (!this.worker || !this.isReady)
                return;
            this.heartbeatSequence++;
            const payload = {
                timestamp: Date.now(),
                sequence: this.heartbeatSequence,
            };
            try {
                this.worker.postMessage(makeThetaMessage('theia:heartbeat', payload));
            }
            catch (err) {
                // eslint-disable-next-line no-console
                console.error('[THETA] heartbeat send failed:', err);
                this.handleWorkerFailure('heartbeat send failed');
                return;
            }
            const elapsed = Date.now() - this.lastHeartbeatAt;
            if (this.lastHeartbeatAt > 0 && elapsed > this.config.heartbeatTimeout) {
                // eslint-disable-next-line no-console
                console.warn(`[THETA] missed heartbeat (${elapsed}ms)`);
                this.handleWorkerFailure('heartbeat timeout');
            }
        }, this.config.heartbeatInterval);
    }
    stopHeartbeat() {
        if (this.heartbeatHandle !== null) {
            ;
            globalThis.clearInterval(this.heartbeatHandle);
            this.heartbeatHandle = null;
        }
    }
    // ───────────────────────────────────────────────────────────────────────
    // Phoenix
    // ───────────────────────────────────────────────────────────────────────
    handleWorkerFailure(_reason) {
        this.circuit.failures++;
        this.circuit.lastFailure = Date.now();
        if (this.circuit.failures >= CIRCUIT_THRESHOLD) {
            this.circuit.state = CircuitState.OPEN;
            // eslint-disable-next-line no-console
            console.log(`[THETA] Circuit OPEN after ${this.circuit.failures} failures — backoff ${CIRCUIT_TIMEOUT}ms`);
        }
        if (this.resurrections < this.config.maxResurrections) {
            void this.resurrectWorker();
        }
        else {
            // eslint-disable-next-line no-console
            console.error(`[THETA] exceeded max resurrections (${this.config.maxResurrections})`);
            this.isReady = false;
        }
    }
    async resurrectWorker() {
        // 🌊 WAVE 8220 — un solo Phoenix en vuelo: callers solapados retornan
        // (la resurrección en curso ya termina y re-spawnea al worker).
        if (this.isResurrecting)
            return;
        this.isResurrecting = true;
        try {
            if (this.worker) {
                try {
                    this.worker.terminate();
                }
                catch {
                    /* noop */
                }
                this.worker = null;
            }
            this.isReady = false;
            this.resurrections++;
            // eslint-disable-next-line no-console
            console.log(`[THETA] 🔥 PHOENIX: resurrecting worker (attempt ${this.resurrections})`);
            const seq = this.lifecycleSeq;
            await new Promise((r) => setTimeout(r, this.config.resurrectionDelay));
            // Abort si el motor se apagó O si un restart manual invalidó este ciclo.
            if (!this.isRunning || seq !== this.lifecycleSeq)
                return;
            try {
                await this.spawnWorker();
                // 🌊 WAVE 8215 — el video port murió con el worker terminado (era
                // propiedad suya): re-pull → el broker entrega un channel FRESCO a
                // ambos extremos y el nuevo worker recibe el extremo productor.
                // El telemetry port NO se re-pulle: vive en esta página y el ring
                // SAB ya pasó al worker nuevo en el INIT.
                requestTheiaPort('video-port');
            }
            catch (err) {
                // eslint-disable-next-line no-console
                console.error('[THETA] resurrect failed:', err);
            }
        }
        finally {
            this.isResurrecting = false;
        }
    }
}
// ─────────────────────────────────────────────────────────────────────────
// Singleton helper
// ─────────────────────────────────────────────────────────────────────────
let _instance = null;
export function getThetaOrchestrator() {
    // 🌊 WAVE 8207: single instance shared by TrinityProvider (power lifecycle)
    // and the Theia UI — one worker = one producer on the video/thumb SABs.
    if (!_instance)
        _instance = new ThetaOrchestrator();
    return _instance;
}
