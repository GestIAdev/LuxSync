/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ HEPHAESTUS RUNTIME - WAVE 2030.18: THE RUNTIME
 *
 * El Ejecutor Universal de efectos .lfx de Hephaestus.
 * En lugar de buscar efectos por nombre en un registro estático,
 * este runtime carga archivos dinámicamente y evalúa curvas en tiempo real.
 *
 * ARQUITECTURA:
 * ┌─────────────────────────┐
 * │  chronos:triggerHeph    │
 * │  (filePath, duration)   │
 * └───────────┬─────────────┘
 *             │ play(path)
 *             ▼
 * ┌─────────────────────────┐
 * │   HEPHAESTUS RUNTIME    │
 * │  - Load .lfx file       │
 * │  - Cache parsed clips   │
 * │  - Evaluate curves      │
 * │  - Inject to fixtures   │
 * └───────────┬─────────────┘
 *             │ tick(currentTimeMs)
 *             ▼
 * ┌─────────────────────────┐
 * │   FixtureBuffer (DMX)   │
 * └─────────────────────────┘
 *
 * AXIOMA ANTI-SIMULACIÓN:
 * Real files, real math, real DMX values.
 *
 * @module core/hephaestus/runtime/HephaestusRuntime
 * @version WAVE 2030.18
 */
import * as fs from 'fs';
import * as path from 'path';
import { deserializeHephClip } from '../types';
import { CurveEvaluator } from '../CurveEvaluator';
import { PhaseDistributor } from './PhaseDistributor';
import { resolveZoneTags } from '../../zones/ZoneMapper';
import { masterArbiter } from '../../arbiter';
// ═══════════════════════════════════════════════════════════════════════════
// 🔥 WAVE 2495: Pure utilities re-exported from HephUtils.ts
// Extracted so renderer code can import them without dragging in the
// full Runtime (which depends on MasterArbiter → EventEmitter → Node.js).
// Backend code can still import from here — these are re-exports.
// ═══════════════════════════════════════════════════════════════════════════
import { hslToRgb, scaleToDMX, scaleToDMX16 } from './HephUtils';
export { hslToRgb, scaleToDMX, scaleToDMX16 };
// ═══════════════════════════════════════════════════════════════════════════
// HEPHAESTUS RUNTIME
// ═══════════════════════════════════════════════════════════════════════════
export class HephaestusRuntime {
    constructor() {
        /** Cache of loaded clips (path → parsed clip) */
        this.clipCache = new Map();
        /** Currently active clips being executed */
        this.activeClips = new Map();
        /** Instance counter for unique IDs */
        this.instanceCounter = 0;
        /** Statistics */
        this.totalTriggered = 0;
        this.lastTickMs = 0;
        /** Debug mode */
        this.debug = true;
        // ─────────────────────────────────────────────────────────────────────────
        // ⚒️ WAVE 2400: ZERO-ALLOCATION OUTPUT BUFFER
        // ─────────────────────────────────────────────────────────────────────────
        /** Pre-allocated output buffer */
        this.outputBuffer = [];
        /** Current write position in outputBuffer */
        this.outputCursor = 0;
        /** Maximum capacity of the output buffer */
        this.outputCapacity = 0;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // CLIP LOADING
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Load and cache a .lfx file
     * Returns the parsed clip or null if failed
     */
    loadClip(filePath) {
        // Check cache first
        if (this.clipCache.has(filePath)) {
            return this.clipCache.get(filePath);
        }
        try {
            // Read file
            if (!fs.existsSync(filePath)) {
                console.error(`[HephRuntime] ❌ File not found: ${filePath}`);
                return null;
            }
            const content = fs.readFileSync(filePath, 'utf-8');
            // Validate content is not empty
            if (!content || content.trim().length === 0) {
                console.error(`[HephRuntime] ❌ Empty file: ${filePath}`);
                return null;
            }
            // Parse JSON
            let parsed;
            try {
                parsed = JSON.parse(content);
            }
            catch (parseErr) {
                console.error(`[HephRuntime] ❌ Invalid JSON in ${filePath}:`, parseErr);
                return null;
            }
            // ⚒️ WAVE 2030.20: UNWRAP FILE FORMAT
            // .lfx files have wrapper structure: { $schema, version, clip: {...} }
            // We need the inner 'clip' object for deserialization
            let serialized;
            if (parsed.clip && typeof parsed.clip === 'object') {
                // File format v1.0.0: { clip: {...} }
                serialized = parsed.clip;
            }
            else if (parsed.curves && typeof parsed.curves === 'object') {
                // Legacy format: direct clip object
                serialized = parsed;
            }
            else {
                console.error(`[HephRuntime] ❌ Invalid clip structure in ${filePath}: no 'clip' or 'curves' field`);
                return null;
            }
            // Validate structure
            if (!serialized || typeof serialized !== 'object') {
                console.error(`[HephRuntime] ❌ Invalid clip structure in ${filePath}: not an object`);
                return null;
            }
            if (!serialized.curves || typeof serialized.curves !== 'object') {
                console.error(`[HephRuntime] ❌ Invalid clip structure in ${filePath}: missing or invalid curves`);
                return null;
            }
            // ⚒️ WAVE 2030.20: VALIDATE CURVES STRUCTURE
            // Each curve must have a keyframes array
            for (const [paramId, curve] of Object.entries(serialized.curves)) {
                if (!curve || typeof curve !== 'object') {
                    console.error(`[HephRuntime] ❌ Invalid curve '${paramId}' in ${filePath}: not an object`);
                    return null;
                }
                const hephCurve = curve;
                if (!Array.isArray(hephCurve.keyframes)) {
                    console.error(`[HephRuntime] ❌ Invalid curve '${paramId}' in ${filePath}: keyframes is not an array`);
                    return null;
                }
                if (hephCurve.keyframes.length === 0) {
                    console.warn(`[HephRuntime] ⚠️ Curve '${paramId}' in ${filePath} has no keyframes (will be ignored)`);
                }
            }
            // Deserialize (converts curves Record to Map)
            const clip = deserializeHephClip(serialized);
            // Final validation
            if (!clip || !clip.curves || clip.curves.size === 0) {
                console.error(`[HephRuntime] ❌ Deserialization failed or empty curves in ${filePath}`);
                return null;
            }
            // Cache it
            this.clipCache.set(filePath, clip);
            if (this.debug) {
                console.log(`[HephRuntime] 📁 Loaded: ${path.basename(filePath)} (${clip.curves.size} curves, ${clip.durationMs}ms)`);
            }
            return clip;
        }
        catch (err) {
            console.error(`[HephRuntime] ❌ Failed to load ${filePath}:`, err);
            return null;
        }
    }
    /**
     * Invalidate cache for a specific file (on external save)
     */
    invalidateCache(filePath) {
        this.clipCache.delete(filePath);
        if (this.debug) {
            console.log(`[HephRuntime] 🗑️ Cache invalidated: ${path.basename(filePath)}`);
        }
    }
    /**
     * Clear entire cache
     */
    clearCache() {
        this.clipCache.clear();
        if (this.debug) {
            console.log('[HephRuntime] 🗑️ Cache cleared');
        }
    }
    // ─────────────────────────────────────────────────────────────────────────
    // PLAYBACK CONTROL
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * ▶️ Trigger a .lfx clip
     * Loads the file (cached), starts execution
     *
     * ⚒️ WAVE 2400: Now resolves PhaseDistributor if clip has phase config.
     *
     * @param filePath Path to .lfx file
     * @param options Playback options
     * @returns Instance ID for tracking, or null if failed
     */
    play(filePath, options = {}) {
        const clip = this.loadClip(filePath);
        if (!clip) {
            return null;
        }
        const instanceId = `heph_${++this.instanceCounter}_${Date.now()}`;
        const now = Date.now();
        // Create the curve evaluator instance for this clip
        const evaluator = new CurveEvaluator(clip.curves, clip.durationMs);
        // ── WAVE 2400: Resolve phase distribution ─────────────────────────
        const { fixturePhases, phaseConfig } = this.resolvePhaseForClip(clip, options.durationOverrideMs ?? clip.durationMs, options.fixtureIds);
        const activeClip = {
            instanceId,
            filePath,
            clip,
            evaluator,
            startTimeMs: now,
            durationMs: options.durationOverrideMs ?? clip.durationMs,
            intensity: options.intensity ?? 1.0,
            loop: options.loop ?? false,
            fixturePhases,
            phaseConfig,
        };
        this.activeClips.set(instanceId, activeClip);
        this.totalTriggered++;
        // ⚒️ WAVE 2400: Ensure output buffer capacity
        this.ensureOutputCapacity(this.estimateTotalOutputs());
        if (this.debug) {
            const phaseInfo = fixturePhases
                ? ` [PHASE: ${fixturePhases.length} fixtures, ${phaseConfig?.symmetry}]`
                : '';
            console.log(`[HephRuntime] ▶️ PLAY: ${clip.name} (${activeClip.durationMs}ms)${phaseInfo} ID=${instanceId}`);
        }
        return instanceId;
    }
    /**
     * ▶️ WAVE 2040.22: Play from an in-memory HephAutomationClip (Diamond Data)
     *
     * Unlike play(), this doesn't need a file on disk — the curves arrive
     * inline via the Chronos timeline (serialized in the FXClip, deserialized
     * by IPCHandlers). This is the DIAMOND PATH for Hephaestus clips.
     *
     * ⚒️ WAVE 2400: Now resolves PhaseDistributor if clip has phase config.
     *
     * @param clip Pre-deserialized HephAutomationClip with Map<> curves
     * @param options Playback options
     * @returns Instance ID for tracking
     */
    playFromClip(clip, options = {}) {
        const instanceId = `heph_diamond_${++this.instanceCounter}_${Date.now()}`;
        const now = Date.now();
        const evaluator = new CurveEvaluator(clip.curves, clip.durationMs);
        // ── WAVE 2400: Resolve phase distribution ─────────────────────────
        const { fixturePhases, phaseConfig } = this.resolvePhaseForClip(clip, options.durationOverrideMs ?? clip.durationMs, options.fixtureIds);
        const activeClip = {
            instanceId,
            filePath: '<diamond-inline>', // No file — curves came inline
            clip,
            evaluator,
            startTimeMs: now,
            durationMs: options.durationOverrideMs ?? clip.durationMs,
            intensity: options.intensity ?? 1.0,
            loop: options.loop ?? false,
            fixturePhases,
            phaseConfig,
        };
        this.activeClips.set(instanceId, activeClip);
        this.totalTriggered++;
        // ⚒️ WAVE 2400: Ensure output buffer capacity
        this.ensureOutputCapacity(this.estimateTotalOutputs());
        if (this.debug) {
            const phaseInfo = fixturePhases
                ? ` [PHASE: ${fixturePhases.length} fixtures, ${phaseConfig?.symmetry}]`
                : '';
            console.log(`[HephRuntime] ▶️💎 DIAMOND PLAY: ${clip.name} (${activeClip.durationMs}ms) ${clip.curves.size} curves${phaseInfo} ID=${instanceId}`);
        }
        return instanceId;
    }
    /**
     * ⏹️ Stop a specific clip instance
     */
    stop(instanceId) {
        const removed = this.activeClips.delete(instanceId);
        if (removed && this.debug) {
            console.log(`[HephRuntime] ⏹️ STOP: ${instanceId}`);
        }
        return removed;
    }
    /**
     * ⏹️ Stop all active clips
     */
    stopAll() {
        const count = this.activeClips.size;
        this.activeClips.clear();
        if (this.debug) {
            console.log(`[HephRuntime] ⏹️ STOP ALL: ${count} clips stopped`);
        }
    }
    // ─────────────────────────────────────────────────────────────────────────
    // FRAME TICK - MAIN RENDER LOOP INTEGRATION
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * 🔄 Called every frame from TitanEngine
     * Evaluates all active curves and returns fixture outputs
     *
     * @param currentTimeMs Current system time in ms
     * @returns Array of fixture outputs to apply
     */
    /**
     * ⚒️ WAVE 2400: THE PHASER REVOLUTION + ZERO-ALLOC
     *
     * tick() now branches between:
     * - tickWithPhase(): Per-fixture phase evaluation (WAVE 2400 path)
     * - tickLegacy(): Zone-based, same time for all (backward compat)
     *
     * ZERO-ALLOC: Uses pre-allocated outputBuffer with writeOutput().
     * Only 1 array allocation per frame (getOutputSlice) vs N objects before.
     *
     * SCALING PIPELINE:
     *   1. CurveEvaluator → raw 0-1 (number) or HSL (color)
     *   2. Apply intensity multiplier
     *   3. SCALE to target format:
     *      - DMX params (intensity/strobe/white/amber/pan/tilt) → 0-255
     *      - Color params → HSL→RGB { r, g, b } each 0-255
     *      - Engine params (speed/zoom/width/direction/globalComp) → 0-1 float
     */
    tick(currentTimeMs) {
        this.lastTickMs = currentTimeMs;
        this.outputCursor = 0; // ⚒️ WAVE 2400: Reset cursor — reuse buffer
        const expiredClips = [];
        for (const [instanceId, active] of this.activeClips) {
            // Calculate clip progress
            const elapsedMs = currentTimeMs - active.startTimeMs;
            let baseClipTimeMs = elapsedMs;
            // Handle looping
            if (active.loop && elapsedMs >= active.durationMs) {
                baseClipTimeMs = elapsedMs % active.durationMs;
            }
            // Check expiration (non-looping)
            if (!active.loop && elapsedMs >= active.durationMs) {
                expiredClips.push(instanceId);
                continue;
            }
            // ── WAVE 2400: Branch between phase-aware and legacy paths ────
            if (active.fixturePhases && active.fixturePhases.length > 0) {
                // 🔥 PER-FIXTURE PHASE EVALUATION
                this.tickWithPhase(active, baseClipTimeMs);
            }
            else {
                // Legacy: zone-based, same time for all
                this.tickLegacy(active, baseClipTimeMs);
            }
        }
        // Clean up expired clips
        for (const instanceId of expiredClips) {
            this.activeClips.delete(instanceId);
            if (this.debug) {
                console.log(`[HephRuntime] ✅ Completed: ${instanceId}`);
            }
        }
        // ⚒️ WAVE 2400: Return slice of pre-allocated buffer
        return this.getOutputSlice();
    }
    /**
     * ⚒️ WAVE 2400: Phase-aware evaluation path.
     *
     * fixturePhases is SORTED by phaseOffsetMs ASC.
     * This means CurveEvaluator queries go in monotonically
     * increasing time order → cursor cache stays O(1) amortized.
     *
     * For each fixture, we calculate a fixture-specific time
     * (baseClipTimeMs + phaseOffsetMs) and evaluate all curves at that time.
     */
    tickWithPhase(active, baseClipTimeMs) {
        for (const fp of active.fixturePhases) {
            // ── Calculate fixture-specific time ──────────────────────────
            let fixtureTimeMs = baseClipTimeMs + fp.phaseOffsetMs;
            // Wrap if looping (phase offset can push beyond duration)
            if (active.loop) {
                fixtureTimeMs = ((fixtureTimeMs % active.durationMs) + active.durationMs) % active.durationMs;
            }
            else {
                fixtureTimeMs = Math.min(fixtureTimeMs, active.durationMs);
            }
            // ── Evaluate each curve at fixture-specific time ────────────
            for (const [paramName, curve] of active.clip.curves) {
                if (curve.valueType === 'color') {
                    const hsl = active.evaluator.getColorValue(paramName, fixtureTimeMs);
                    // Intensity modulates lightness (dim the color, don't destroy hue/sat)
                    const modulatedL = (hsl.l / 100) * active.intensity;
                    const rgb = hslToRgb(hsl.h, hsl.s / 100, modulatedL);
                    this.writeOutput(fp.fixtureId, 'all', paramName, 0, rgb);
                }
                else {
                    const rawValue = active.evaluator.getValue(paramName, fixtureTimeMs);
                    const withIntensity = rawValue * active.intensity;
                    const scaledValue = scaleToDMX(paramName, withIntensity);
                    const fine = (paramName === 'pan' || paramName === 'tilt')
                        ? scaleToDMX16(withIntensity).fine
                        : undefined;
                    this.writeOutput(fp.fixtureId, 'all', paramName, scaledValue, undefined, fine);
                }
            }
        }
    }
    /**
     * Legacy path: sin phase distribution.
     * Mantiene backward compatibility 1:1 con el tick() pre-WAVE 2400.
     * Used when clip has no PhaseConfig / no FixtureSelector.
     *
     * 🎯 WAVE 2544.3: AND-GATE FIX
     * Previously emitted one output per zone tag (OR semantics in TitanOrchestrator).
     * Now resolves the AND-intersection of all zone tags to concrete fixture IDs
     * using resolveZoneTags, then emits per-fixture outputs (same as tickWithPhase).
     * This ensures ['back', 'all-right'] → only back-right fixtures, not all-right ∪ back.
     */
    tickLegacy(active, clipTimeMs) {
        const clipZones = active.clip.zones;
        // ── Resolve target fixture IDs (AND-intersection via ZoneMapper) ──────
        // Single 'all' or empty → all fixtures. Multiple tags → AND-intersection.
        let targetFixtureIds;
        if (clipZones.length === 0 || (clipZones.length === 1 && clipZones[0] === 'all')) {
            targetFixtureIds = masterArbiter.getFixtureIds();
        }
        else {
            const fixtures = masterArbiter.getFixturesForZoneMapping();
            targetFixtureIds = resolveZoneTags(clipZones, fixtures);
            // Fallback: if zone combo resolves to nothing, treat as global
            if (targetFixtureIds.length === 0) {
                targetFixtureIds = masterArbiter.getFixtureIds();
            }
        }
        if (targetFixtureIds.length === 0)
            return;
        // ── Evaluate each curve → scale → emit per-fixture ────────────────────
        for (const [paramName, curve] of active.clip.curves) {
            // ─── COLOR CURVE PATH ───────────────────────────────────
            if (curve.valueType === 'color') {
                const hsl = active.evaluator.getColorValue(paramName, clipTimeMs);
                // ⚒️ WAVE 2040.22c: HSL values are 0-100 (Heph standard), hslToRgb expects 0-1
                const modulatedL = (hsl.l / 100) * active.intensity;
                const rgb = hslToRgb(hsl.h, hsl.s / 100, modulatedL);
                for (const fixtureId of targetFixtureIds) {
                    this.writeOutput(fixtureId, 'all', paramName, 0, rgb);
                }
                continue;
            }
            // ─── NUMERIC CURVE PATH ─────────────────────────────────
            const rawValue = active.evaluator.getValue(paramName, clipTimeMs);
            const withIntensity = rawValue * active.intensity;
            const scaledValue = scaleToDMX(paramName, withIntensity);
            const fine = (paramName === 'pan' || paramName === 'tilt')
                ? scaleToDMX16(withIntensity).fine
                : undefined;
            for (const fixtureId of targetFixtureIds) {
                this.writeOutput(fixtureId, 'all', paramName, scaledValue, undefined, fine);
            }
        }
    }
    /**
     * Ensure output buffer has enough capacity.
     * Called when clips are added/removed (NOT in tick — outside hot path).
     * Grows amortized by 2x to avoid frequent resizes.
     */
    ensureOutputCapacity(needed) {
        if (needed <= this.outputCapacity)
            return;
        // Grow by 2x or to needed, whichever is larger (min 256)
        const newCapacity = Math.max(needed, this.outputCapacity * 2, 256);
        // Extend buffer with pre-allocated empty output objects
        for (let i = this.outputCapacity; i < newCapacity; i++) {
            this.outputBuffer[i] = {
                fixtureId: '',
                zone: 'all',
                parameter: '',
                value: 0,
                rgb: undefined,
                fine: undefined,
                source: 'hephaestus-runtime',
            };
        }
        this.outputCapacity = newCapacity;
    }
    /**
     * Write one output to the pre-allocated buffer.
     * Mutates in-place — zero allocation in the hot path.
     * Auto-grows if capacity estimate was wrong (rare).
     */
    writeOutput(fixtureId, zone, parameter, value, rgb, fine) {
        // Auto-grow if needed (rare — only if capacity estimate was wrong)
        if (this.outputCursor >= this.outputCapacity) {
            this.ensureOutputCapacity(this.outputCursor + 64);
        }
        const out = this.outputBuffer[this.outputCursor++];
        out.fixtureId = fixtureId;
        out.zone = zone;
        out.parameter = parameter;
        out.value = value;
        out.rgb = rgb;
        out.fine = fine;
        // out.source is always 'hephaestus-runtime' — set once at buffer creation
    }
    /**
     * Return a slice of the output buffer (0..outputCursor).
     *
     * ⚠️ CONTRATO: The consumer MUST NOT retain references to the output
     * objects beyond the current frame. They will be mutated in the next tick.
     *
     * Uses Array.slice() which creates ONE new array per frame (array of
     * references, not copies). This is an accepted trade-off:
     * 1 array header/frame vs hundreds of object allocations/frame.
     */
    getOutputSlice() {
        return this.outputBuffer.slice(0, this.outputCursor);
    }
    /**
     * Estimate total output count across all active clips.
     * Used to pre-size the output buffer at play() time.
     */
    estimateTotalOutputs() {
        let total = 0;
        const allFixtureCount = masterArbiter.getFixtureIds().length || 32;
        for (const [, active] of this.activeClips) {
            // Legacy clips now emit per-fixture (not per-zone), use full fixture count as upper bound
            const fixtureCount = active.fixturePhases?.length ?? allFixtureCount;
            total += fixtureCount * active.clip.curves.size;
        }
        return total;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // ⚒️ WAVE 2400: PHASE RESOLUTION HELPER
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Resolves phase distribution for a clip at play() time.
     *
     * Resolution priority:
     * 1. clip.selector.phase (full PhaseConfig) — highest priority
     * 2. clip.selector.phaseSpread (legacy shorthand → converted to linear PhaseConfig)
     * 3. null (no phase distribution — legacy zone mode)
     *
     * @param clip — The clip to resolve phase for
     * @param durationMs — Effective duration (may be overridden)
     * @param externalFixtureIds — Pre-resolved fixture IDs (optional, bypasses selector resolution)
     * @returns { fixturePhases, phaseConfig } or both null if no phase config
     */
    resolvePhaseForClip(clip, durationMs, externalFixtureIds) {
        const selector = clip.selector;
        if (!selector) {
            return { fixturePhases: null, phaseConfig: null };
        }
        // Determine PhaseConfig (full config takes precedence over legacy phaseSpread)
        let config = null;
        if (selector.phase) {
            config = selector.phase;
        }
        else if (selector.phaseSpread && selector.phaseSpread > 0) {
            // Legacy shorthand → convert to linear PhaseConfig
            config = {
                spread: selector.phaseSpread,
                symmetry: 'linear',
                wings: 1,
                direction: 1,
            };
        }
        if (!config || config.spread === 0) {
            return { fixturePhases: null, phaseConfig: null };
        }
        // Resolve fixture IDs
        const fixtureIds = externalFixtureIds && externalFixtureIds.length > 0
            ? externalFixtureIds
            : []; // Caller should provide pre-resolved IDs; empty = no phase
        if (fixtureIds.length === 0) {
            // No fixture IDs available — can't distribute phase
            // This happens when resolveFixtureSelector() hasn't been called externally.
            // The runtime doesn't have access to the fixture store directly.
            // Phase will be resolved when TitanOrchestrator provides fixture IDs.
            if (this.debug) {
                console.warn(`[HephRuntime] ⚠️ Phase config present but no fixture IDs provided. Falling back to legacy mode.`);
            }
            return { fixturePhases: null, phaseConfig: config };
        }
        // Resolve phase distribution
        const fixturePhases = PhaseDistributor.resolve(fixtureIds, config, durationMs);
        return { fixturePhases, phaseConfig: config };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // STATUS & STATS
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Get runtime statistics
     */
    getStats() {
        return {
            activeClips: this.activeClips.size,
            totalTriggered: this.totalTriggered,
            cacheSize: this.clipCache.size,
            lastTickMs: this.lastTickMs,
        };
    }
    /**
     * Check if any clips are currently playing
     */
    isPlaying() {
        return this.activeClips.size > 0;
    }
    /**
     * Get list of active clip instance IDs
     */
    getActiveInstances() {
        return Array.from(this.activeClips.keys());
    }
    /**
     * Get info about a specific active clip
     */
    getActiveClipInfo(instanceId) {
        const active = this.activeClips.get(instanceId);
        if (!active)
            return null;
        const elapsed = Date.now() - active.startTimeMs;
        const progress = Math.min(1, elapsed / active.durationMs);
        return {
            name: active.clip.name,
            progress,
            intensity: active.intensity,
        };
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════
let runtimeInstance = null;
/**
 * Get the singleton HephaestusRuntime instance
 */
export function getHephaestusRuntime() {
    if (!runtimeInstance) {
        runtimeInstance = new HephaestusRuntime();
        console.log('[HephRuntime] ⚒️ WAVE 2030.18: Hephaestus Runtime initialized');
    }
    return runtimeInstance;
}
/**
 * Reset the runtime (for testing)
 */
export function resetHephaestusRuntime() {
    if (runtimeInstance) {
        runtimeInstance.stopAll();
        runtimeInstance.clearCache();
    }
    runtimeInstance = null;
}
