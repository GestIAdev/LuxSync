// ════════════════════════════════════════════════════════════════════════════
// 🎨 WAVE 4812 — PIXEL MAP AETHER ADAPTER (L3 PRODUCER)
// ════════════════════════════════════════════════════════════════════════════
//
//  Convierte Virtual Frame Buffers (RGBA8) en `INodeIntent[]` que se inyectan
//  en la capa L3 del NodeArbiter (`setEffectIntents`).
//
//  PIPELINE POR FRAME (44 Hz, hot path):
//    1. ingest(arbiter, mgr)
//    2. Por cada canvas activo:
//       a. Lee el `front` buffer del manager.
//       b. Para cada NodeSampler pre-cuantizado, lee 4 bytes (RGBA).
//       c. Acquire un intent del pool zero-alloc, popula values, push.
//    3. arbiter.setEffectIntents(this._intents)  // capa L3
//
//  ZERO-ALLOC: el pool de intents crece en warm-up y se reutiliza para
//  siempre. Reset por frame: `_intentCursor = 0`, `_intents.length = 0`.
//
//  PATCH-TIME: `bindCanvas()` y `bindWorldSamplers()` pre-computan los
//  samplers (UVs + nodeId + family) una sola vez. El hot path solo hace
//  desreferencia de índices y escritura en Records.
//
//  CAPA OBJETIVO: L3 (`setEffectIntents`) — directiva WAVE 4850 sprint 1.
//  El blueprint WAVE-4812 §3.2 también permite L3+ (`setHephaestusIntents`)
//  para mayor supremacy; se conserva como modo opcional vía `targetLayer`.
// ════════════════════════════════════════════════════════════════════════════
import { NodeFamily } from '../types';
// ─── PRIORIDADES POR CAPA ───────────────────────────────────────────────────
/** Capa L3 (Effects). ABSOLUTE L3 OVERRIDE (WAVE 4829) bloquea L0/L1 en canal. */
const L3_EFFECT_PRIORITY = 320;
/** Capa L3+ (Hephaestus). LTP supremacy + L3 luminance gag. */
const L3_HEPH_PRIORITY = 350;
const L3_EFFECT_SOURCE = 'effect';
const L3_HEPH_SOURCE = 'hephaestus';
const L3_CONFIDENCE = 1.0;
export class PixelMapAetherAdapter {
    constructor(opts = {}) {
        /** Vinculación canvasId → params declarados por el productor. */
        this._activeCanvases = new Map();
        /** Vinculación canvasId → samplers pre-cuantizados. */
        this._samplers = new Map();
        /** Pool de intents reutilizable. Crece en warm-up, se estabiliza. */
        this._intentPool = [];
        this._intentCursor = 0;
        /** Array que se entrega al arbiter cada frame (mutado, mismo identity). */
        this._frameIntents = [];
        /** Lista vacía pre-congelada — devolverla en clear() evita alloc. */
        this._emptyIntents = Object.freeze([]);
        /** Telemetría. */
        this._samplesEmittedTotal = 0;
        this._framesIngested = 0;
        this._targetLayer = opts.targetLayer ?? 'effect';
        if (this._targetLayer === 'hephaestus') {
            this._priority = L3_HEPH_PRIORITY;
            this._source = L3_HEPH_SOURCE;
        }
        else {
            this._priority = L3_EFFECT_PRIORITY;
            this._source = L3_EFFECT_SOURCE;
        }
    }
    // ── Patch-time API ──────────────────────────────────────────────────────
    /**
     * Vincula un canvas con un array explícito de samplers pre-cuantizados.
     *
     * Para uso de `RenderHook`s avanzados que ya conocen las UVs (p.ej.
     * mapeo `'local'` por cellIndex de fixtures multi-cell).
     *
     * Idempotente — sobrescribe vinculación previa para el mismo canvasId.
     *
     * @param canvasId — ID del Virtual Frame Buffer.
     * @param params   — Hints de blend e intensidad.
     * @param samplers — Array (possiblemente compartido) de samplers.
     */
    bindCanvas(canvasId, params, samplers) {
        this._activeCanvases.set(canvasId, params);
        this._samplers.set(canvasId, samplers);
    }
    /**
     * Helper de world-mapping: construye samplers a partir del NodeGraph
     * proyectando la posición 3D (x,z) de cada nodo COLOR/IMPACT al UV del
     * rectángulo de stage `rect`.
     *
     * Y (altura) se IGNORA — el stage se trata como plano top-down 2D.
     * Nodos sin `position` se omiten silenciosamente.
     *
     * **Solo en patch-time.**
     *
     * @param canvasId  — ID del Virtual Frame Buffer ya adquirido en el manager.
     * @param params    — Hints de blend e intensidad.
     * @param graph     — NodeGraph para enumerar nodos COLOR/IMPACT.
     * @param rect      — Rectángulo del stage (metros) que cubre la textura.
     * @param textureW  — Ancho del buffer en pixels.
     * @param textureH  — Alto del buffer en pixels.
     * @returns Número de samplers creados.
     */
    bindWorldSamplers(canvasId, params, graph, rect, textureW, textureH) {
        if (!Number.isInteger(textureW) || textureW < 1 ||
            !Number.isInteger(textureH) || textureH < 1) {
            throw new RangeError(`PixelMapAetherAdapter.bindWorldSamplers: invalid texture size ${textureW}x${textureH}`);
        }
        const samplers = [];
        // COLOR nodes
        const colorView = graph.getView(NodeFamily.COLOR);
        colorView.forEach((node) => {
            const pos = node.position;
            if (!pos)
                return;
            const uv = _worldToUV(pos, rect, textureW, textureH);
            samplers.push({
                nodeId: node.nodeId,
                family: NodeFamily.COLOR,
                u: uv.u,
                v: uv.v,
            });
        });
        // IMPACT nodes
        const impactView = graph.getView(NodeFamily.IMPACT);
        impactView.forEach((node) => {
            const pos = node.position;
            if (!pos)
                return;
            const uv = _worldToUV(pos, rect, textureW, textureH);
            samplers.push({
                nodeId: node.nodeId,
                family: NodeFamily.IMPACT,
                u: uv.u,
                v: uv.v,
            });
        });
        this.bindCanvas(canvasId, params, samplers);
        return samplers.length;
    }
    /** Desvincula un canvas del adapter. **Solo en patch-time.** */
    unbindCanvas(canvasId) {
        this._activeCanvases.delete(canvasId);
        this._samplers.delete(canvasId);
    }
    /** Limpia todas las vinculaciones (teardown / show change). */
    unbindAll() {
        this._activeCanvases.clear();
        this._samplers.clear();
    }
    // ── Hot path (44 Hz) ────────────────────────────────────────────────────
    /**
     * Lee los `front` buffers de todos los canvas activos, muestrea cada
     * NodeSampler, emite intents al arbiter en la capa configurada.
     *
     * **Zero-alloc**: el array `_frameIntents` y el pool `_intentPool` se
     * reutilizan. Cada `INodeIntent` es un Record reutilizado entre frames.
     *
     * Si no hay canvases activos, llama a `_writeIntents([])` igualmente para
     * que el arbiter limpie su slot L3 (idempotente cuando ya estaba vacío).
     *
     * @param arbiter — NodeArbiter receptor.
     * @param mgr     — AetherCanvasManager fuente de los buffers.
     */
    ingest(arbiter, mgr) {
        this._intentCursor = 0;
        this._frameIntents.length = 0;
        if (this._activeCanvases.size === 0) {
            this._writeIntents(arbiter, this._emptyIntents);
            return;
        }
        let samplesThisFrame = 0;
        for (const [canvasId, params] of this._activeCanvases) {
            const buf = mgr.get(canvasId);
            if (!buf)
                continue;
            const samplers = this._samplers.get(canvasId);
            if (!samplers || samplers.length === 0)
                continue;
            const intensity = _clamp01(params.intensity);
            const alphaToDimmer = params.alphaToDimmer === true;
            const front = buf.front;
            const w = buf.width;
            const h = buf.height;
            for (let i = 0; i < samplers.length; i++) {
                const s = samplers[i];
                // Bounds-check perezoso: el sampler se construyó con UVs ya
                // clampeadas, pero protegemos contra resoluciones cambiadas en vivo.
                if (s.u < 0 || s.u >= w || s.v < 0 || s.v >= h)
                    continue;
                const off = (s.v * w + s.u) << 2;
                const r8 = front[off];
                const g8 = front[off + 1];
                const b8 = front[off + 2];
                const a8 = front[off + 3];
                const intent = this._acquireIntent(s.nodeId);
                const v = intent.values;
                if (s.family === NodeFamily.COLOR) {
                    // Convertir 0..255 → 0..1 y escalar por intensity.
                    v['red'] = (r8 / 255) * intensity;
                    v['green'] = (g8 / 255) * intensity;
                    v['blue'] = (b8 / 255) * intensity;
                    if (alphaToDimmer) {
                        v['brightness'] = (a8 / 255) * intensity;
                    }
                }
                else {
                    // IMPACT: derivamos luminance perceptual (Rec. 709) → dimmer.
                    // Si alphaToDimmer, el alpha gana (el productor lo declaró autoridad).
                    const lum = alphaToDimmer
                        ? a8 / 255
                        : (0.2126 * r8 + 0.7152 * g8 + 0.0722 * b8) / 255;
                    v['dimmer'] = lum * intensity;
                }
                this._frameIntents.push(intent);
                samplesThisFrame++;
            }
        }
        this._writeIntents(arbiter, this._frameIntents);
        // Telemetría barata, sin logs en hot path.
        this._samplesEmittedTotal += samplesThisFrame;
        this._framesIngested++;
    }
    /**
     * Limpia la capa destino (envía un array vacío). Útil cuando un caller
     * sabe que no habrá productores activos durante varios frames.
     */
    clear(arbiter) {
        this._intentCursor = 0;
        this._frameIntents.length = 0;
        this._writeIntents(arbiter, this._emptyIntents);
    }
    // ── Telemetría ──────────────────────────────────────────────────────────
    getTelemetry() {
        return {
            framesIngested: this._framesIngested,
            samplesEmittedTotal: this._samplesEmittedTotal,
            activeCanvases: this._activeCanvases.size,
            poolSize: this._intentPool.length,
        };
    }
    resetTelemetry() {
        this._framesIngested = 0;
        this._samplesEmittedTotal = 0;
    }
    // ── Internals ──────────────────────────────────────────────────────────
    _writeIntents(arbiter, intents) {
        if (this._targetLayer === 'hephaestus') {
            arbiter.setHephaestusIntents(intents);
        }
        else {
            arbiter.setEffectIntents(intents);
        }
    }
    /**
     * Obtiene un intent del pool y lo "limpia" antes de devolverlo.
     * Crece el pool una unidad si está agotado.
     */
    _acquireIntent(nodeId) {
        let intent = this._intentPool[this._intentCursor];
        if (intent === undefined) {
            intent = {
                nodeId,
                values: {},
                priority: this._priority,
                confidence: L3_CONFIDENCE,
                source: this._source,
                mergeStrategy: 'LTP',
            };
            this._intentPool.push(intent);
        }
        else {
            // Reset values (clave por clave; Object.keys produce un alloc, así que
            // sobreescribimos solo las llaves que esperamos. Para el caso COLOR
            // pisamos red/green/blue/brightness; para IMPACT sólo dimmer. Las
            // llaves no escritas en este frame conservan el valor previo, lo
            // cual es BENIGNO porque el arbiter consume `values` justo después
            // y nunca relee el intent antes del próximo populate).
            // No obstante, para evitar fugas semánticas (un nodo que dejó de
            // recibir RGB y aún muestra el último), limpiamos las claves típicas.
            const v = intent.values;
            v['red'] = 0;
            v['green'] = 0;
            v['blue'] = 0;
            v['brightness'] = 0;
            v['dimmer'] = 0;
            intent.nodeId = nodeId;
            intent.priority = this._priority;
            intent.confidence = L3_CONFIDENCE;
            intent.source = this._source;
            intent.mergeStrategy = 'LTP';
        }
        this._intentCursor++;
        return intent;
    }
}
// ─── HELPERS ────────────────────────────────────────────────────────────────
/**
 * Proyecta una posición 3D al UV de un rectángulo de stage.
 *
 * - Usa `pos.x` y `pos.z` (plano horizontal — `y` es altura, ignorada).
 * - Clamp a [0..1] para garantizar UV dentro del buffer.
 * - Devuelve enteros [0..w-1] / [0..h-1].
 */
export function _worldToUV(pos, rect, w, h) {
    const dx = rect.x1 - rect.x0;
    const dz = rect.z1 - rect.z0;
    // Si el rect está degenerado, mapear al centro.
    const fx = dx === 0 ? 0.5 : (pos.x - rect.x0) / dx;
    const fz = dz === 0 ? 0.5 : (pos.z - rect.z0) / dz;
    const cu = fx < 0 ? 0 : fx > 1 ? 1 : fx;
    const cv = fz < 0 ? 0 : fz > 1 ? 1 : fz;
    const u = (cu * w) | 0;
    const v = (cv * h) | 0;
    return {
        u: u >= w ? w - 1 : u,
        v: v >= h ? h - 1 : v,
    };
}
function _clamp01(n) {
    if (!Number.isFinite(n))
        return 0;
    if (n < 0)
        return 0;
    if (n > 1)
        return 1;
    return n;
}
/**
 * Helper local-mapping: dado un `cellIndex` y la geometría del grid,
 * devuelve el UV del centro de la celda en pixel coords. Útil cuando un
 * fixture multi-cell expone N cells lineales.
 */
export function _localCellToUV(cellIndex, rows, cols, textureW, textureH) {
    const safeRows = rows < 1 ? 1 : rows;
    const safeCols = cols < 1 ? 1 : cols;
    const col = cellIndex % safeCols;
    const row = Math.floor(cellIndex / safeCols);
    const u = (((col + 0.5) / safeCols) * textureW) | 0;
    const v = (((row + 0.5) / safeRows) * textureH) | 0;
    return {
        u: u >= textureW ? textureW - 1 : u,
        v: v >= textureH ? textureH - 1 : v,
    };
}
