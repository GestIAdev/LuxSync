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
 *  - Negociar el SharedArrayBuffer del FrameContext con el main process
 *    (one-shot vía IPC `theia:get-frame-context`).
 *  - Transferir el SAB y un OffscreenCanvas al worker en el INIT.
 *  - Heartbeat + circuit breaker + Phoenix (resurrection) idénticos en
 *    contrato al patrón de Trinity, adaptados a APIs de Web Worker.
 *
 * NO renderiza vídeo. NO decodifica. Eso llega en Phase 2/F3.
 */
import { makeThetaMessage, } from './protocol';
// 🎬 WAVE 4867 — Phase 6: thumb buffer SAB
import { createThumbSAB } from './TheiaThumbBuffer';
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
    heartbeatTimeout: 3000,
    maxResurrections: 5,
    resurrectionDelay: 500,
    workerPollIntervalMs: 22,
};
function getBridge() {
    // Acceso defensivo — el preload puede no haber expuesto el namespace en
    // configuraciones legacy.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lux = globalThis.lux ?? globalThis.window?.lux;
    if (!lux || !lux.theia || typeof lux.theia.getFrameContextSAB !== 'function') {
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
        this.circuit = {
            state: CircuitState.CLOSED,
            failures: 0,
            lastFailure: 0,
            successesInHalfOpen: 0,
        };
        this.frameContextSAB = null;
        this.offscreenCanvas = null;
        // 🎬 WAVE 4864 — Phase 3: SAB shared with TheiaOutputWindow
        this.videoFrameSAB = null;
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
        // 🎬 WAVE 4903 — Phase 7: cognitive cue-jump tracking
        /** ID del asset (.theia) actualmente cargado en el videoElement. */
        this.currentClipId = null;
        /** Última URL pasada a loadVideo() — usada para evitar re-loads idempotentes. */
        this.currentClipUrl = null;
        /** Último ack de seek recibido del worker (telemetría). */
        this.lastSeekAck = null;
        this.heartbeatHandle = null;
        this.heartbeatSequence = 0;
        this.lastHeartbeatAt = 0;
        this.lastHeartbeatLatencyMs = 0;
        this.lastStateReport = null;
        this._clipUrlResolver = null;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * Adopta un OffscreenCanvas que será transferido al worker en el INIT.
     * Debe llamarse ANTES de `start()`. El canvas pasa a propiedad del worker
     * (estructura nativa de transferControlToOffscreen → postMessage).
     */
    attachOffscreenCanvas(canvas) {
        if (this.isRunning) {
            // eslint-disable-next-line no-console
            console.warn('[THETA] attachOffscreenCanvas() called after start — canvas ignored');
            return;
        }
        this.offscreenCanvas = canvas;
    }
    async start() {
        if (this.isRunning)
            return;
        // 1) Pedir el SAB al main process — UNA SOLA VEZ.
        const bridge = getBridge();
        if (!bridge) {
            throw new Error('[THETA] preload bridge not found (window.lux.theia.getFrameContextSAB missing)');
        }
        const sab = await bridge.getFrameContextSAB();
        if (!sab || !(sab instanceof SharedArrayBuffer)) {
            throw new Error('[THETA] main process did not return a SharedArrayBuffer for FrameContext');
        }
        this.frameContextSAB = sab;
        // 🎬 WAVE 4864 — Phase 3: also fetch the video frame SAB. Optional —
        // if the bridge method is missing or returns null, the worker will run
        // in legacy mode (no projector window blit).
        if (typeof bridge.getVideoFrameBufferSAB === 'function') {
            try {
                const vSab = await bridge.getVideoFrameBufferSAB();
                if (vSab instanceof SharedArrayBuffer) {
                    this.videoFrameSAB = vSab;
                }
            }
            catch (err) {
                // eslint-disable-next-line no-console
                console.warn('[THETA] getVideoFrameBufferSAB failed (continuing without projector SAB):', err);
            }
        }
        this.isRunning = true;
        this.resurrections = 0;
        await this.spawnWorker();
        this.startHeartbeat();
    }
    async stop() {
        this.isRunning = false;
        this.stopHeartbeat();
        this.teardownVideo();
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
    // 🎬 WAVE 4864 — Phase 4: AssetStateMachine API (force-state)
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
    // 🎬 WAVE 4903 — Phase 7: Cognitive Cue-Jump (Selene → Theta)
    // ──────────────────────────────────────────────────────────────────
    /**
     * Procesa un `CueJumpIntent` emitido por `SeleneTheiaAdapter`.
     *
     * Pipeline:
     *   1. Si `clipId === ''` → blackout: detiene reproducción y limpia worker.
     *   2. Si `clipId !== currentClipId` → resuelve filePath via `TheiaRegistry`
     *      y llama a `loadVideo()` (lazy load del asset binario).
     *   3. Aplica `videoElement.currentTime = startMs / 1000`.
     *   4. Asegura `play()` (Selene asume reproducción activa post-cue).
     *   5. PostMessage al worker con `theia:seek` para que prepare el crossfade
     *      visual (snapshot + curva de mezcla).
     *
     * Es idempotente y resiliente: si el worker no está listo, log + return.
     * No lanza excepciones.
     */
    async handleCueJump(intent) {
        if (!this.isRunning || !this.worker) {
            // eslint-disable-next-line no-console
            console.warn('[THETA 🎬] handleCueJump called before start — ignored');
            return;
        }
        // ── Caso 1: blackout ─────────────────────────────────────────────────
        if (!intent.clipId) {
            this._emitSeekToWorker({
                clipId: '',
                cuepointId: '',
                startMs: 0,
                crossfadeMs: intent.crossfadeMs,
                reason: 'blackout',
            });
            try {
                if (this.videoElement)
                    this.videoElement.pause();
            }
            catch { /* noop */ }
            return;
        }
        // ── Caso 2: cambio de asset → lazy load ──────────────────────────────
        if (intent.clipId !== this.currentClipId) {
            const resolver = intent.urlResolver ?? this._clipUrlResolver;
            const url = resolver ? resolver(intent.clipId) : null;
            if (!url) {
                // eslint-disable-next-line no-console
                console.warn(`[THETA 🎬] cue-jump '${intent.clipId}' — no URL resolver`);
                return;
            }
            try {
                await this.loadVideo(url);
                this.currentClipId = intent.clipId;
                this.currentClipUrl = url;
            }
            catch (err) {
                // eslint-disable-next-line no-console
                console.error(`[THETA 🎬] cue-jump load failed for '${intent.clipId}':`, err);
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
            clipId: intent.clipId,
            cuepointId: intent.cuepointId,
            startMs: intent.startMs,
            crossfadeMs: intent.crossfadeMs,
            reason: intent.reason,
        });
    }
    /**
     * Registra un resolver `clipId → URL` para que `handleCueJump` pueda
     * cargar lazily los `.mp4` declarados por los manifests `.theia`.
     *
     * Típicamente la wiring de Selene hace:
     *   `orchestrator.setClipUrlResolver(id => theiaRegistry.getAsset(id)?.filePath ?? null)`
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
    /** ID del asset actualmente cargado, o null. */
    getCurrentClipId() {
        return this.currentClipId;
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
        if (!this.isRunning || !this.worker) {
            throw new Error('[THETA] loadVideo called before start() or worker is dead');
        }
        // Tear down any previous video pipeline
        this.teardownVideo();
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
        // 2) Wait for metadata to resolve dimensions
        await new Promise((resolve, reject) => {
            video.addEventListener('loadedmetadata', () => resolve(), { once: true });
            video.addEventListener('error', () => reject(new Error(`[THETA] video load error: ${video.error?.message ?? 'unknown'}`)), { once: true });
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
    teardownVideo() {
        // 🎬 WAVE 4903 — clear cue-jump tracking when the underlying asset goes away.
        this.currentClipId = null;
        this.currentClipUrl = null;
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
        if (!this.frameContextSAB) {
            throw new Error('[THETA] cannot spawn worker — frameContextSAB is null');
        }
        // Vite resolves this URL at build time and emits a separate worker chunk.
        const worker = new Worker(new URL('./theta.worker.ts', import.meta.url), {
            type: 'module',
            name: 'theta',
        });
        worker.addEventListener('message', (ev) => {
            this.handleWorkerMessage(ev.data);
        });
        worker.addEventListener('error', (ev) => {
            // eslint-disable-next-line no-console
            console.error('[THETA] worker error:', ev.message);
            this.handleWorkerFailure(ev.message ?? 'worker error');
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
            frameContextSAB: this.frameContextSAB,
            pollIntervalMs: this.config.workerPollIntervalMs,
            offscreenCanvas: canvas ?? undefined,
            // 🎬 WAVE 4864 — Phase 3: pass the projector SAB. The SAB is shared
            // by reference (structured-clone share); no transfer slot needed.
            videoFrameSAB: this.videoFrameSAB ?? undefined,
            // 🎬 WAVE 4867 — Phase 6: pass the thumb SAB (always present).
            thumbPixelSAB: this.thumbPixelSAB,
        }), transfer);
        // Tras transferir el canvas perdemos su control en este lado.
        if (canvas)
            this.offscreenCanvas = null;
    }
    handleWorkerMessage(msg) {
        if (!msg || typeof msg.type !== 'string')
            return;
        switch (msg.type) {
            case 'theia:ready':
                this.isReady = true;
                this.circuit.state = CircuitState.CLOSED;
                this.circuit.failures = 0;
                // eslint-disable-next-line no-console
                console.log('[THETA] worker READY');
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
                break;
            case 'theia:asset-state':
                this.lastAssetState = msg.payload;
                break;
            case 'theia:seek-ack':
                this.lastSeekAck = msg.payload;
                break;
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
        await new Promise((r) => setTimeout(r, this.config.resurrectionDelay));
        if (!this.isRunning)
            return;
        try {
            await this.spawnWorker();
        }
        catch (err) {
            // eslint-disable-next-line no-console
            console.error('[THETA] resurrect failed:', err);
        }
    }
}
// ─────────────────────────────────────────────────────────────────────────
// Singleton helper
// ─────────────────────────────────────────────────────────────────────────
let _instance = null;
export function getThetaOrchestrator() {
    if (!_instance)
        _instance = new ThetaOrchestrator();
    return _instance;
}
