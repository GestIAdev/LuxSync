/**
 * WAVE 4959 PHASE 2 — TheiaBridgeManager
 * Extracted from TitanOrchestrator.ts (~lines 435, 437, 841-916).
 *
 * Owns: TheiaVideoRenderer lifecycle, SeleneTheiaBridge attach/detach,
 *       and the wiring between Theia thumb SAB → AetherCanvas → PixelMapAdapter.
 */
import { TheiaVideoRenderer } from '../../aether/canvas/renderers/TheiaVideoRenderer';
export class TheiaBridgeManager {
    constructor(_aetherCanvasManager, _pixelMapAdapter, _aetherGraph, _stageBounds) {
        this._aetherCanvasManager = _aetherCanvasManager;
        this._pixelMapAdapter = _pixelMapAdapter;
        this._aetherGraph = _aetherGraph;
        this._stageBounds = _stageBounds;
        this._theiaVideoRenderer = null;
        this._seleneThetaBridge = null;
    }
    // ── Theia Video Renderer ────────────────────────────────────────────────
    attachTheiaRenderer(canvasId, thumbPixelSAB, opts = {}) {
        this._theiaVideoRenderer?.stop();
        this._theiaVideoRenderer = new TheiaVideoRenderer(canvasId, this._aetherCanvasManager, thumbPixelSAB);
        this._theiaVideoRenderer.active = true;
        const stageRect = {
            x0: -this._stageBounds.width * 0.5,
            z0: -this._stageBounds.depth * 0.5,
            x1: this._stageBounds.width * 0.5,
            z1: this._stageBounds.depth * 0.5,
        };
        this._pixelMapAdapter.bindWorldSamplers(canvasId, {
            intensity: opts.intensity ?? 1.0,
            alphaToDimmer: opts.alphaToDimmer ?? false,
        }, this._aetherGraph, stageRect, 64, 64);
        // eslint-disable-next-line no-console
        console.log(`[TheiaBridgeManager 🎬] TheiaVideoRenderer attached (canvasId='${canvasId}')`);
    }
    detachTheiaRenderer() {
        if (this._theiaVideoRenderer) {
            this._theiaVideoRenderer.stop();
            const canvasId = this._theiaVideoRenderer.getTelemetry().canvasId;
            this._pixelMapAdapter.unbindCanvas(canvasId);
            this._aetherCanvasManager.release(canvasId);
            this._theiaVideoRenderer = null;
            // eslint-disable-next-line no-console
            console.log('[TheiaBridgeManager 🎬] TheiaVideoRenderer detached');
        }
    }
    // ── SeleneTheiaBridge ───────────────────────────────────────────────────
    attachSeleneTheiaBridge(bridge) {
        this._seleneThetaBridge = bridge;
        // eslint-disable-next-line no-console
        console.log('[TheiaBridgeManager 🌉] SeleneTheiaBridge attached');
    }
    detachSeleneTheiaBridge() {
        this._seleneThetaBridge = null;
        // eslint-disable-next-line no-console
        console.log('[TheiaBridgeManager 🌉] SeleneTheiaBridge detached');
    }
    // ── Getters for hot-path ────────────────────────────────────────────────
    getTheiaVideoRenderer() {
        return this._theiaVideoRenderer;
    }
    getSeleneThetaBridge() {
        return this._seleneThetaBridge;
    }
}
