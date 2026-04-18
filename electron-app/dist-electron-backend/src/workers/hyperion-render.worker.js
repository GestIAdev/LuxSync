// 🧠 WORKER THREAD ALIVE — OPERACIÓN LÁZARO (WAVE 2520)
// 🔇 OPERACIÓN BLACKOUT — Web Worker console hijack (RESTAURAR: comentar bloque)
;
(function () { const _n = () => { }; console.log = _n; console.info = _n; console.debug = _n; console.warn = _n; console.error = _n; })();
// [BLACKOUT] console.log('🧠 WORKER THREAD ALIVE')
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ☀️ HYPERION RENDER WORKER — "The 4th Worker"
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Web Worker (Chromium renderer-side) that owns the TacticalCanvas via
 * OffscreenCanvas. Runs its own RAF loop at 60fps, receives fixture data
 * via postMessage Transferrable at ~44Hz, interpolates the gap.
 *
 * ARCHITECTURE:
 * - Main thread transfers OffscreenCanvas ownership on mount (irreversible)
 * - Scaffold (structural data) sent once on show load / fixture config change
 * - Hot frames (dynamic data) arrive as packed Float32Array Transferrable
 * - Physics interpolation (exponential smoothing + adaptive snap) in worker
 * - Hit testing runs here, results sent back via postMessage
 * - All 5 render layers execute here: Grid → Zone → Fixture → Selection → HUD
 *
 * AGNOSTIC TO HARDWARE: This worker renders at 60fps regardless of whether
 * the DMX backend ticks at 25Hz, 30Hz, 44Hz, or anything else. It LERPS
 * between received snapshots to maintain smooth visual output.
 *
 * @module workers/hyperion-render.worker
 * @since WAVE 2510 (Operación Hyperion — The 4th Worker)
 */
import { FLOATS_PER_FIXTURE, FIXTURE_FIELD, } from './hyperion-render.types';
import { renderGridLayer, renderZoneLayer, renderFixtureLayer, renderSelectionLayer, renderHUDLayer, FIXTURE_CONFIG, } from '../components/hyperion/views/tactical/layers';
import { hitTestFixtures, hitTestLasso, } from '../components/hyperion/views/tactical/HitTestEngine';
// ═══════════════════════════════════════════════════════════════════════════
// WORKER STATE
// ═══════════════════════════════════════════════════════════════════════════
let canvas = null;
let ctx = null;
let animFrameId = 0;
let isRunning = false;
let isHibernating = false;
// Dimensions (CSS pixels, not physical)
let canvasWidth = 0;
let canvasHeight = 0;
let dpr = 1;
// Render options
let quality = 'HQ';
let showGrid = true;
let showZoneLabels = true;
// ── Scaffold (structural, rarely changes) ─────────────────────────────────
let scaffoldFixtures = [];
let zoneCounts = new Map();
// ── Frame data (dynamic, every ~44Hz) ─────────────────────────────────────
let currentFrameData = null;
let currentFrameNumber = 0;
let currentTimestamp = 0;
let currentFixtureCount = 0;
// ── Beat envelope (decayed per RAF frame) ─────────────────────────────────
let beatVisualEnvelope = 0;
let lastOnBeat = false;
const BEAT_VISUAL_DECAY = 0.88; // per frame @ 60fps → ~130ms visible
// ── Selection state ───────────────────────────────────────────────────────
let selectedIds = new Set();
let hoveredId = null;
let lassoBounds = null;
let isLassoActive = false;
let lassoStart = null;
// ── Physics memory (exponential smoothing) ────────────────────────────────
const physicsStore = new Map();
// ═══════════════════════════════════════════════════════════════════════════
// PHYSICS CONSTANTS — Adaptive Smoothing
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Base smoothing factor for pan/tilt/zoom.
 * 0.10 = slow/heavy butter (cinematographic movement)
 * Hard effects (strobes, gobo snaps) bypass this via SNAP_THRESHOLD.
 */
const SMOOTHING_FACTOR = 0.10;
/**
 * Adaptive snap threshold (normalized 0-1 scale).
 * If a fixture's intensity delta exceeds this between frames,
 * we SNAP to the new value instead of interpolating.
 * This preserves strobe fidelity — no mushy fades on hard cuts.
 */
const INTENSITY_SNAP_THRESHOLD = 0.4; // 40% of range = hard cut detected
// ── FPS tracking ──────────────────────────────────────────────────────────
let lastFrameTime = 0;
const fpsHistory = [];
const metrics = {
    fps: 60,
    frameTime: 0,
    fixtureCount: 0,
    lastRenderTime: 0,
};
let metricsReportCounter = 0;
const METRICS_REPORT_INTERVAL = 60; // report every 60 frames (~1s)
// ── Pre-allocated unpack buffer (zero-allocation per frame) ───────────────
const unpackBuffer = {
    r: 0, g: 0, b: 0,
    intensity: 0,
    physicalPan: 0.5, physicalTilt: 0.5,
    zoom: 127, focus: 127,
    panVelocity: 0, tiltVelocity: 0,
};
// ── Previous intensity map for snap detection ─────────────────────────────
const prevIntensity = new Map();
// ═══════════════════════════════════════════════════════════════════════════
// RENDER LOOP
// ═══════════════════════════════════════════════════════════════════════════
function render(timestamp) {
    if (!isRunning || !ctx) {
        return;
    }
    // ── FPS calculation ─────────────────────────────────────────────────────
    const delta = timestamp - lastFrameTime;
    lastFrameTime = timestamp;
    if (delta > 0) {
        const instantFps = 1000 / delta;
        fpsHistory.push(instantFps);
        if (fpsHistory.length > 30)
            fpsHistory.shift();
        metrics.fps = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length;
    }
    metrics.frameTime = delta;
    metrics.lastRenderTime = timestamp;
    // ── Beat visual envelope decay ──────────────────────────────────────────
    beatVisualEnvelope *= BEAT_VISUAL_DECAY;
    const beatEnvelope = beatVisualEnvelope;
    // ── Build TacticalFixture[] for render layers ───────────────────────────
    const fixtureCount = Math.min(scaffoldFixtures.length, currentFixtureCount);
    metrics.fixtureCount = fixtureCount;
    const smoothedFixtures = new Array(fixtureCount);
    for (let i = 0; i < fixtureCount; i++) {
        const scaffold = scaffoldFixtures[i];
        // Unpack dynamic data from Float32Array
        if (currentFrameData && i * FLOATS_PER_FIXTURE + FLOATS_PER_FIXTURE <= currentFrameData.length) {
            const offset = i * FLOATS_PER_FIXTURE;
            unpackBuffer.r = currentFrameData[offset + FIXTURE_FIELD.R];
            unpackBuffer.g = currentFrameData[offset + FIXTURE_FIELD.G];
            unpackBuffer.b = currentFrameData[offset + FIXTURE_FIELD.B];
            unpackBuffer.intensity = currentFrameData[offset + FIXTURE_FIELD.INTENSITY];
            unpackBuffer.physicalPan = currentFrameData[offset + FIXTURE_FIELD.PHYSICAL_PAN];
            unpackBuffer.physicalTilt = currentFrameData[offset + FIXTURE_FIELD.PHYSICAL_TILT];
            unpackBuffer.zoom = currentFrameData[offset + FIXTURE_FIELD.ZOOM];
            unpackBuffer.focus = currentFrameData[offset + FIXTURE_FIELD.FOCUS];
            unpackBuffer.panVelocity = currentFrameData[offset + FIXTURE_FIELD.PAN_VELOCITY];
            unpackBuffer.tiltVelocity = currentFrameData[offset + FIXTURE_FIELD.TILT_VELOCITY];
        }
        // ── Adaptive smoothing ──────────────────────────────────────────────
        // Pan/tilt/zoom: always interpolate (butter movement)
        // Intensity: SNAP if delta > threshold (strobe fidelity)
        let physState = physicsStore.get(scaffold.id);
        if (!physState) {
            physState = {
                pan: unpackBuffer.physicalPan,
                tilt: unpackBuffer.physicalTilt,
                zoom: unpackBuffer.zoom,
            };
            physicsStore.set(scaffold.id, physState);
        }
        // Smooth pan/tilt/zoom (always — these are mechanical movements)
        physState.pan += (unpackBuffer.physicalPan - physState.pan) * SMOOTHING_FACTOR;
        physState.tilt += (unpackBuffer.physicalTilt - physState.tilt) * SMOOTHING_FACTOR;
        physState.zoom += (unpackBuffer.zoom - physState.zoom) * SMOOTHING_FACTOR;
        physicsStore.set(scaffold.id, physState);
        // Intensity: snap detection — when delta > threshold it's a strobe/hard cut.
        // Color and intensity always pass through raw (no smoothing needed — only pan/tilt/zoom are mechanical).
        const prevInt = prevIntensity.get(scaffold.id) ?? unpackBuffer.intensity;
        const intDelta = Math.abs(unpackBuffer.intensity - prevInt);
        prevIntensity.set(scaffold.id, unpackBuffer.intensity);
        // useSnap preserved for future strobe-specific rendering (e.g., flash frames)
        const useSnap = intDelta > INTENSITY_SNAP_THRESHOLD;
        void useSnap;
        // Build the final TacticalFixture
        smoothedFixtures[i] = {
            id: scaffold.id,
            x: scaffold.x,
            y: scaffold.y,
            type: scaffold.type,
            zone: scaffold.zone,
            gobo: scaffold.gobo,
            prism: scaffold.prism,
            // Dynamic data — color and intensity always pass through raw
            r: unpackBuffer.r,
            g: unpackBuffer.g,
            b: unpackBuffer.b,
            intensity: unpackBuffer.intensity,
            physicalPan: physState.pan,
            physicalTilt: physState.tilt,
            zoom: physState.zoom,
            focus: unpackBuffer.focus,
            panVelocity: unpackBuffer.panVelocity,
            tiltVelocity: unpackBuffer.tiltVelocity,
        };
    }
    // ── Calculate base radius ───────────────────────────────────────────────
    const minDim = Math.min(canvasWidth, canvasHeight);
    const baseRadius = Math.max(FIXTURE_CONFIG.MIN_RADIUS, Math.min(FIXTURE_CONFIG.MAX_RADIUS, minDim * FIXTURE_CONFIG.BASE_RADIUS_RATIO));
    // ═══════════════════════════════════════════════════════════════════════
    // RENDER LAYERS — Exact same pipeline as the old main-thread RAF loop
    // ═══════════════════════════════════════════════════════════════════════
    ctx.save();
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    // LAYER 1: GRID
    if (showGrid) {
        renderGridLayer(ctx, canvasWidth, canvasHeight, {
            showReferenceLines: true,
            showStereoDivision: true,
        });
    }
    // LAYER 2: ZONE LABELS
    if (showZoneLabels) {
        renderZoneLayer(ctx, canvasWidth, canvasHeight, {
            showCounts: true,
            zoneCounts,
        });
    }
    // LAYER 3: FIXTURES
    renderFixtureLayer(ctx, canvasWidth, canvasHeight, smoothedFixtures, {
        quality,
        onBeat: beatEnvelope > 0.05,
        beatIntensity: beatEnvelope,
    });
    // LAYER 4: SELECTION
    renderSelectionLayer(ctx, canvasWidth, canvasHeight, smoothedFixtures, baseRadius, {
        selectedIds,
        hoveredId,
        lassoBounds,
        animationPhase: (timestamp % 1000) / 1000,
    });
    // LAYER 5: HUD
    renderHUDLayer(ctx, canvasWidth, canvasHeight, metrics, quality);
    ctx.restore();
    // ── Metrics report ──────────────────────────────────────────────────────
    metricsReportCounter++;
    if (metricsReportCounter >= METRICS_REPORT_INTERVAL) {
        metricsReportCounter = 0;
        sendMessage({ type: 'METRICS', fps: metrics.fps, frameTime: metrics.frameTime, fixtureCount: metrics.fixtureCount });
    }
    // ── Schedule next frame ─────────────────────────────────────────────────
    animFrameId = requestAnimationFrame(render);
}
// ═══════════════════════════════════════════════════════════════════════════
// HIT TESTING — Mouse interaction handled in worker
// ═══════════════════════════════════════════════════════════════════════════
function handleMouse(msg) {
    const fixtures = buildCurrentFixtures();
    if (msg.action === 'leave') {
        hoveredId = null;
        isLassoActive = false;
        lassoStart = null;
        lassoBounds = null;
        sendMessage({ type: 'HIT_TEST', fixtureId: null, fixtureIndex: null, distance: null, mouseX: msg.x, mouseY: msg.y, action: 'move', shiftKey: false, ctrlKey: false, metaKey: false });
        return;
    }
    const baseRadius = Math.max(FIXTURE_CONFIG.MIN_RADIUS, Math.min(FIXTURE_CONFIG.MAX_RADIUS, Math.min(canvasWidth, canvasHeight) * FIXTURE_CONFIG.BASE_RADIUS_RATIO));
    if (msg.action === 'move') {
        if (isLassoActive && lassoStart) {
            // Update lasso bounds
            const normX = msg.x / canvasWidth;
            const normY = msg.y / canvasHeight;
            lassoBounds = {
                startX: lassoStart.x,
                startY: lassoStart.y,
                endX: normX,
                endY: normY,
            };
            return;
        }
        const hit = hitTestFixtures(msg.x, msg.y, fixtures, canvasWidth, canvasHeight, baseRadius);
        hoveredId = hit.fixtureId;
        sendMessage({
            type: 'HIT_TEST',
            fixtureId: hit.fixtureId,
            fixtureIndex: hit.fixtureIndex,
            distance: hit.distance,
            mouseX: msg.x,
            mouseY: msg.y,
            action: 'move',
            shiftKey: msg.shiftKey,
            ctrlKey: msg.ctrlKey,
            metaKey: msg.metaKey,
        });
    }
    else if (msg.action === 'down') {
        const hit = hitTestFixtures(msg.x, msg.y, fixtures, canvasWidth, canvasHeight, baseRadius);
        if (hit.fixtureId) {
            // Click on fixture — let main thread handle selection logic
            sendMessage({
                type: 'HIT_TEST',
                fixtureId: hit.fixtureId,
                fixtureIndex: hit.fixtureIndex,
                distance: hit.distance,
                mouseX: msg.x,
                mouseY: msg.y,
                action: 'down',
                shiftKey: msg.shiftKey,
                ctrlKey: msg.ctrlKey,
                metaKey: msg.metaKey,
            });
        }
        else {
            // Start lasso
            isLassoActive = true;
            const normX = msg.x / canvasWidth;
            const normY = msg.y / canvasHeight;
            lassoStart = { x: normX, y: normY };
            lassoBounds = { startX: normX, startY: normY, endX: normX, endY: normY };
            // Notify main thread of click on empty space
            sendMessage({
                type: 'HIT_TEST',
                fixtureId: null,
                fixtureIndex: null,
                distance: null,
                mouseX: msg.x,
                mouseY: msg.y,
                action: 'down',
                shiftKey: msg.shiftKey,
                ctrlKey: msg.ctrlKey,
                metaKey: msg.metaKey,
            });
        }
    }
    else if (msg.action === 'up') {
        if (isLassoActive && lassoBounds) {
            const lassoedIds = hitTestLasso(lassoBounds, fixtures);
            if (lassoedIds.length > 0) {
                sendMessage({
                    type: 'LASSO_COMPLETE',
                    fixtureIds: lassoedIds,
                    additive: msg.shiftKey || msg.ctrlKey || msg.metaKey,
                });
            }
        }
        isLassoActive = false;
        lassoStart = null;
        lassoBounds = null;
    }
}
/**
 * Build TacticalFixture[] from current scaffold + frame data.
 * Simplified version for hit testing (no physics smoothing needed).
 */
function buildCurrentFixtures() {
    const count = Math.min(scaffoldFixtures.length, currentFixtureCount);
    const result = new Array(count);
    for (let i = 0; i < count; i++) {
        const s = scaffoldFixtures[i];
        result[i] = {
            id: s.id,
            x: s.x,
            y: s.y,
            type: s.type,
            zone: s.zone,
            gobo: s.gobo,
            prism: s.prism,
            r: 0, g: 0, b: 0,
            intensity: 0,
            physicalPan: 0.5,
            physicalTilt: 0.5,
            zoom: 127,
            focus: 127,
            panVelocity: 0,
            tiltVelocity: 0,
        };
    }
    return result;
}
// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════════════════
function sendMessage(msg) {
    self.postMessage(msg);
}
self.onmessage = (e) => {
    const msg = e.data;
    switch (msg.type) {
        case 'INIT': {
            canvas = msg.canvas;
            canvasWidth = msg.width;
            canvasHeight = msg.height;
            dpr = msg.dpr;
            quality = msg.quality;
            showGrid = msg.showGrid;
            showZoneLabels = msg.showZoneLabels;
            // Set physical pixel size
            canvas.width = msg.width * dpr;
            canvas.height = msg.height * dpr;
            ctx = canvas.getContext('2d');
            if (!ctx) {
                sendMessage({ type: 'ERROR', message: 'Failed to get 2d context from OffscreenCanvas' });
                return;
            }
            // Apply DPR scale (same as main thread setup)
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);
            // Start render loop
            isRunning = true;
            lastFrameTime = performance.now();
            animFrameId = requestAnimationFrame(render);
            sendMessage({ type: 'READY' });
            break;
        }
        case 'RESIZE': {
            canvasWidth = msg.width;
            canvasHeight = msg.height;
            dpr = msg.dpr;
            if (canvas) {
                canvas.width = msg.width * dpr;
                canvas.height = msg.height * dpr;
            }
            if (ctx) {
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.scale(dpr, dpr);
            }
            break;
        }
        case 'SCAFFOLD': {
            scaffoldFixtures = msg.fixtures;
            zoneCounts = new Map(msg.zoneCounts);
            // Reset physics for fixtures that no longer exist
            const activeIds = new Set(msg.fixtures.map(f => f.id));
            for (const id of physicsStore.keys()) {
                if (!activeIds.has(id)) {
                    physicsStore.delete(id);
                    prevIntensity.delete(id);
                }
            }
            break;
        }
        case 'FRAME': {
            currentFrameData = msg.frameData;
            currentFrameNumber = msg.frameNumber;
            currentTimestamp = msg.timestamp;
            currentFixtureCount = msg.fixtureCount;
            // Beat envelope — rising edge detection
            if (msg.onBeat && !lastOnBeat) {
                beatVisualEnvelope = 1.0;
            }
            lastOnBeat = msg.onBeat;
            break;
        }
        case 'SELECTION': {
            selectedIds = new Set(msg.selectedIds);
            hoveredId = msg.hoveredId;
            // Lasso bounds are managed by the worker during mouse events
            // but can be externally set if needed
            if (msg.lassoBounds) {
                lassoBounds = msg.lassoBounds;
            }
            break;
        }
        case 'MOUSE': {
            handleMouse(msg);
            break;
        }
        case 'OPTIONS': {
            if (msg.quality !== undefined)
                quality = msg.quality;
            if (msg.showGrid !== undefined)
                showGrid = msg.showGrid;
            if (msg.showZoneLabels !== undefined)
                showZoneLabels = msg.showZoneLabels;
            break;
        }
        case 'HIBERNATE': {
            if (msg.sleep && !isHibernating) {
                // Enter hibernation — pause RAF loop
                isHibernating = true;
                if (animFrameId)
                    cancelAnimationFrame(animFrameId);
                animFrameId = 0;
            }
            else if (!msg.sleep && isHibernating) {
                // Wake up — resume RAF loop
                isHibernating = false;
                if (isRunning && ctx) {
                    lastFrameTime = performance.now();
                    animFrameId = requestAnimationFrame(render);
                }
            }
            break;
        }
        case 'SHUTDOWN': {
            isRunning = false;
            isHibernating = false;
            if (animFrameId)
                cancelAnimationFrame(animFrameId);
            ctx = null;
            canvas = null;
            physicsStore.clear();
            prevIntensity.clear();
            break;
        }
    }
};
