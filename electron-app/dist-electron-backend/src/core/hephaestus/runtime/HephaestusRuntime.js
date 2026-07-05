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
import * as path from 'path';
import { resolveWithOverrides } from '../phase/PhaseOverride';
import { getHephaestusClipIndex } from '../HephaestusClipIndex';
import { CurveEvaluator } from '../CurveEvaluator';
import { defaultBlendMode as _defaultBlendModeFor, blendNumeric, blendRgb } from '../HephSharedMath';
import { resolveZoneTags } from '../../zones/ZoneMapper';
import { getTitanOrchestrator } from '../../orchestrator/TitanOrchestrator';
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
        /**
         * Cache de clips cargados (filePath → clip parseado).
         * 🧬 WAVE 4856: Clip V3 canónico — la migración a tracks ejecutables
         * ocurre per-instancia en `play()`.
         */
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
        /**
         * 🧬 WAVE 7035: Blend map for intra-clip blendMode fusion.
         * Key: `${fixtureId}:${paramName}` → Value: index into outputBuffer.
         * Cleared per-clip in tickActive(). Enables max/replace/add/multiply
         * blending when multiple tracks of the same paramId target the same fixture.
         */
        this._blendMap = new Map();
        // ─────────────────────────────────────────────────────────────────────────
        // ⚒️ WAVE 2400: ZERO-ALLOCATION OUTPUT BUFFER
        // ─────────────────────────────────────────────────────────────────────────
        // WAVE 3521: Scratch buffer for normalized RGB (zero-alloc, mutated in-place)
        this._normRgbBuf = { r: 0, g: 0, b: 0 };
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
     * Load and cache a .lfx file (V3 schema).
     * Returns the parsed clip o null si falla.
     */
    loadClip(filePath) {
        const index = getHephaestusClipIndex();
        const loaded = index.getByPath(filePath);
        if (!loaded) {
            console.error(`[HephRuntime] ❌ Clip not in index: ${filePath}`);
            return null;
        }
        if (!this.clipCache.has(filePath)) {
            this.clipCache.set(filePath, loaded.clip);
        }
        return this.clipCache.get(filePath);
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
     * ⚒️ WAVE 2400: Now applies phase config (PhaseConfigPro) if clip has one.
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
        const durationMs = options.durationOverrideMs ?? clip.durationMs;
        // 🧬 WAVE 4856: Construir tracks resueltos.
        const { tracks, phaseConfig } = this._buildResolvedTracks(clip, durationMs, options.fixtureIds);
        if (tracks.length === 0) {
            console.warn(`[HephRuntime] ⚠️ play(${path.basename(filePath)}): zero resolved tracks — clip will not emit`);
            return null;
        }
        const activeClip = {
            instanceId,
            filePath,
            clip,
            tracks,
            startTimeMs: now,
            durationMs,
            intensity: options.intensity ?? 1.0,
            loop: options.loop ?? false,
            phaseConfig,
        };
        this.activeClips.set(instanceId, activeClip);
        this.totalTriggered++;
        // ⚒️ WAVE 2400: Ensure output buffer capacity
        this.ensureOutputCapacity(this.estimateTotalOutputs());
        if (this.debug) {
            const anyPhases = tracks.some(t => t.fixturePhases !== null);
            const phaseInfo = anyPhases ? ` [PHASE: ${phaseConfig?.symmetry}]` : '';
            console.log(`[HephRuntime] ▶️ PLAY: ${clip.name} (${activeClip.durationMs}ms, ${tracks.length} tracks)${phaseInfo} ID=${instanceId}`);
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
     * ⚒️ WAVE 2400: Now applies phase config (PhaseConfigPro) if clip has one.
     *
     * @param clip Pre-deserialized HephAutomationClipV3
     * @param options Playback options
     * @returns Instance ID for tracking
     */
    playFromClip(clip, options = {}) {
        const instanceId = `heph_diamond_${++this.instanceCounter}_${Date.now()}`;
        const now = Date.now();
        const durationMs = options.durationOverrideMs ?? clip.durationMs;
        // 🧬 WAVE 4856: Construir tracks resueltos.
        const { tracks, phaseConfig } = this._buildResolvedTracks(clip, durationMs, options.fixtureIds);
        const activeClip = {
            instanceId,
            filePath: '<diamond-inline>', // No file — curves came inline
            clip,
            tracks,
            startTimeMs: now,
            durationMs,
            intensity: options.intensity ?? 1.0,
            loop: options.loop ?? false,
            phaseConfig,
        };
        this.activeClips.set(instanceId, activeClip);
        this.totalTriggered++;
        // ⚒️ WAVE 2400: Ensure output buffer capacity
        this.ensureOutputCapacity(this.estimateTotalOutputs());
        if (this.debug) {
            const anyPhases = tracks.some(t => t.fixturePhases !== null);
            const phaseInfo = anyPhases ? ` [PHASE: ${phaseConfig?.symmetry}]` : '';
            const sourceCount = `${clip.tracks.length} tracks`;
            console.log(`[HephRuntime] ▶️💎 DIAMOND PLAY: ${clip.name} (${activeClip.durationMs}ms, ${sourceCount} → ${tracks.length} resolved)${phaseInfo} ID=${instanceId}`);
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
     * 🧬 WAVE 4856 — UNIFIED TRACK-ITERATING TICK + ZERO-ALLOC.
     *
     * tick() ya no se ramifica en `tickWithPhase` / `tickLegacy`. La elección
     * phase-vs-flat se hace PER-TRACK dentro de `tickActive()` consultando
     * `track.fixturePhases`. Un mismo clip puede ahora mezclar pistas con y
     * sin distribución de fase; cada una se evalúa con el `CurveEvaluator`
     * de su propia curva (cursor cache aislado).
     *
     * ZERO-ALLOC: Uses pre-allocated outputBuffer with writeOutput().
     * Only 1 array allocation per frame (getOutputSlice) vs N objects before.
     *
     * SCALING PIPELINE (en `_emitTrackSample`):
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
            // 🧬 WAVE 4856: Unified track-iterating evaluation. Branching legacy/phase
            // ahora vive PER-TRACK dentro de tickActive — un mismo clip puede tener
            // unas pistas con phase y otras sin, evaluadas con tiempos independientes.
            this.tickActive(active, baseClipTimeMs);
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
     * 🧬 WAVE 4856 — UNIFIED TRACK-ITERATING TICK
     *
     * Reemplaza la pareja `tickWithPhase` + `tickLegacy` por un único pase que
     * itera `active.tracks[]`. Cada pista decide:
     *   - SI tiene `fixturePhases` → emite con tiempo `clipTime + phaseOffset`
     *     por cada FixturePhase (cursor-cache friendly: phases pre-ordenadas).
     *   - SI NO tiene phases → emite con `clipTime` global por cada fixtureId.
     *
     * El evaluador per-track contiene UNA sola curva: `evaluator.getValue/`
     * `getColorValue(track.paramId, t)`. Esto permite que múltiples pistas
     * compartan paramId sin colisión de cursor cache (cada una mantiene el
     * suyo). Garantiza routing espacial aislado: `track.fixtureIds` se resolvió
     * a partir de `track.zones` específico, NO del bloque global del clip.
     */
    tickActive(active, baseClipTimeMs) {
        const isCustomThisClip = active.clip.effectType === 'heph_custom';
        const clipId = active.clip.id;
        const intensity = active.intensity;
        const durationMs = active.durationMs;
        const isLoop = active.loop;
        this._blendMap.clear();
        for (let ti = 0; ti < active.tracks.length; ti++) {
            const track = active.tracks[ti];
            const paramName = track.paramId;
            const evaluator = track.evaluator;
            // ── Path A: per-fixture phase distribution ────────────────────────
            if (track.fixturePhases !== null && track.fixturePhases.length > 0) {
                for (let pi = 0; pi < track.fixturePhases.length; pi++) {
                    const fp = track.fixturePhases[pi];
                    // ⚒️ WAVE 4859 + AUDIT P1-A — PHASE WRAP CONTINUO
                    // Antes (bug): localElapsedMs = max(0, clipTime - offset)
                    //   → fixtures con offset grande congelados en t=0 hasta que el
                    //     playhead los alcanza. Salto discontinuo en la frontera del loop.
                    // Ahora (MA3-style): (clipTime + offset) % duration → wrap continuo.
                    //   → chase infinito sin costuras. Ningún fixture se congela.
                    //   → en modo one-shot (no loop), clamp a durationMs como antes.
                    let fixtureTimeMs;
                    if (isLoop) {
                        fixtureTimeMs = ((baseClipTimeMs + fp.phaseOffsetMs) % durationMs + durationMs) % durationMs;
                    }
                    else {
                        fixtureTimeMs = Math.min(baseClipTimeMs + fp.phaseOffsetMs, durationMs);
                    }
                    this._emitTrackSample(track, fp.fixtureId, fixtureTimeMs, evaluator, paramName, intensity, isCustomThisClip, clipId, track.zones);
                }
                continue;
            }
            // ── Path B: zona resuelta sin phase distribution ──────────────────
            const fixtureIds = track.fixtureIds;
            if (fixtureIds.length === 0)
                continue;
            for (let fi = 0; fi < fixtureIds.length; fi++) {
                this._emitTrackSample(track, fixtureIds[fi], baseClipTimeMs, evaluator, paramName, intensity, isCustomThisClip, clipId, track.zones);
            }
        }
    }
    /**
     * 🧬 WAVE 4856 — Emite UNA muestra de UNA pista para UN fixture en UN tiempo.
     *
     * Centraliza la lógica color-vs-numeric que antes se duplicaba en
     * `tickWithPhase` y `tickLegacy`. La pista ya trae cacheado `valueType`
     * para evitar el lookup `curve.valueType` en hot-path.
     */
    _emitTrackSample(track, fixtureId, timeMs, evaluator, paramName, intensity, isCustomThisClip, clipId, trackZones) {
        const blendKey = fixtureId + ':' + paramName;
        const existingIdx = this._blendMap.get(blendKey);
        if (track.valueType === 'color') {
            // 🧬 AUDIT P0-B: Respect colorOverride — same logic as HephEvaluationKernel
            let hsl;
            if (track.colorOverride) {
                const co = track.colorOverride;
                if (typeof co.h !== 'number' || !Number.isFinite(co.h) ||
                    typeof co.s !== 'number' || !Number.isFinite(co.s) ||
                    typeof co.l !== 'number' || !Number.isFinite(co.l)) {
                    return;
                }
                hsl = co;
            }
            else {
                hsl = evaluator.getColorValue(paramName, timeMs);
                if (!hsl || typeof hsl.h !== 'number' || typeof hsl.s !== 'number' || typeof hsl.l !== 'number' ||
                    !Number.isFinite(hsl.h) || !Number.isFinite(hsl.s) || !Number.isFinite(hsl.l)) {
                    return;
                }
            }
            const modulatedL = (hsl.l / 100) * intensity;
            const rgb = hslToRgb(hsl.h, hsl.s / 100, modulatedL);
            if (!Number.isFinite(rgb.r))
                rgb.r = 0;
            if (!Number.isFinite(rgb.g))
                rgb.g = 0;
            if (!Number.isFinite(rgb.b))
                rgb.b = 0;
            this._normRgbBuf.r = rgb.r / 255;
            this._normRgbBuf.g = rgb.g / 255;
            this._normRgbBuf.b = rgb.b / 255;
            if (existingIdx !== undefined) {
                this._blendOutput(this.outputBuffer[existingIdx], track.blendMode, 0, rgb, undefined, 0, this._normRgbBuf);
                return;
            }
            this.writeOutput(fixtureId, 'all', paramName, 0, rgb, undefined, 0, this._normRgbBuf, isCustomThisClip, clipId, trackZones);
            this._blendMap.set(blendKey, this.outputCursor - 1);
        }
        else {
            const rawValue = evaluator.getValue(paramName, timeMs);
            const withIntensity = rawValue * intensity;
            const scaledValue = scaleToDMX(paramName, withIntensity);
            const fine = (paramName === 'pan' || paramName === 'tilt')
                ? scaleToDMX16(withIntensity).fine
                : undefined;
            if (existingIdx !== undefined) {
                this._blendOutput(this.outputBuffer[existingIdx], track.blendMode, scaledValue, undefined, fine, withIntensity, undefined);
                return;
            }
            this.writeOutput(fixtureId, 'all', paramName, scaledValue, undefined, fine, withIntensity, undefined, isCustomThisClip, clipId, trackZones);
            this._blendMap.set(blendKey, this.outputCursor - 1);
        }
    }
    /**
     * 🧬 WAVE 7035 + AUDIT P0-B: Apply blendMode fusion in-place on an existing output entry.
     * Called when a second track targets the same (fixtureId, paramId) as a
     * previous track within the same clip.
     *
     * AUDIT FIX: Now delegates to HephSharedMath.blendNumeric/blendRgb — the
     * SAME functions used by the preview kernel. No more divergent blend logic.
     */
    _blendOutput(existing, mode, newValue, newRgb, newFine, newNormalized, newNormalizedRgb) {
        existing.value = blendNumeric(existing.value, newValue, mode);
        if (newNormalized !== undefined) {
            existing.normalizedValue = blendNumeric(existing.normalizedValue, newNormalized, mode);
        }
        if (newFine !== undefined && mode === 'replace') {
            existing.fine = newFine;
        }
        if (existing.rgb && newRgb) {
            const [r, g, b] = blendRgb(existing.rgb.r, existing.rgb.g, existing.rgb.b, newRgb.r, newRgb.g, newRgb.b, mode);
            existing.rgb.r = r;
            existing.rgb.g = g;
            existing.rgb.b = b;
        }
        if (existing.normalizedRgb && newNormalizedRgb) {
            const [r, g, b] = blendRgb(existing.normalizedRgb.r * 255, existing.normalizedRgb.g * 255, existing.normalizedRgb.b * 255, newNormalizedRgb.r * 255, newNormalizedRgb.g * 255, newNormalizedRgb.b * 255, mode);
            existing.normalizedRgb.r = r / 255;
            existing.normalizedRgb.g = g / 255;
            existing.normalizedRgb.b = b / 255;
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
                // 🩹 WAVE 4830: Pre-allocate per-slot rgb/normalizedRgb objects to
                // prevent color leak. writeOutput copies values INTO these objects
                // instead of assigning the shared _normRgbBuf reference.
                rgb: { r: 0, g: 0, b: 0 },
                fine: undefined,
                source: 'hephaestus-runtime',
                normalizedValue: 0,
                normalizedRgb: { r: 0, g: 0, b: 0 },
                isCustomClip: false,
                clipId: undefined,
                trackZones: undefined,
            };
        }
        this.outputCapacity = newCapacity;
    }
    /**
     * Write one output to the pre-allocated buffer.
     * Mutates in-place — zero allocation in the hot path.
     * Auto-grows if capacity estimate was wrong (rare).
     */
    writeOutput(fixtureId, zone, parameter, value, rgb, fine, normalizedValue, normalizedRgb, isCustomClip, clipId, trackZones) {
        // Auto-grow if needed (rare — only if capacity estimate was wrong)
        if (this.outputCursor >= this.outputCapacity) {
            this.ensureOutputCapacity(this.outputCursor + 64);
        }
        const out = this.outputBuffer[this.outputCursor++];
        out.fixtureId = fixtureId;
        out.zone = zone;
        out.parameter = parameter;
        out.value = value;
        out.fine = fine;
        out.normalizedValue = normalizedValue ?? 0;
        out.isCustomClip = isCustomClip ?? false;
        out.clipId = clipId;
        out.trackZones = trackZones;
        // 🩹 WAVE 4995: Protect Memory Reference
        // Only copy color values if the track actually provides them.
        // Do not destroy the pre-allocated references when processing non-color params.
        if (rgb) {
            if (!out.rgb)
                out.rgb = { r: 0, g: 0, b: 0 };
            out.rgb.r = rgb.r;
            out.rgb.g = rgb.g;
            out.rgb.b = rgb.b;
        }
        if (normalizedRgb) {
            if (!out.normalizedRgb)
                out.normalizedRgb = { r: 0, g: 0, b: 0 };
            out.normalizedRgb.r = normalizedRgb.r;
            out.normalizedRgb.g = normalizedRgb.g;
            out.normalizedRgb.b = normalizedRgb.b;
        }
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
     *
     * 🧬 WAVE 4856: Suma over tracks[] (cada track tiene su propio fixture set).
     */
    estimateTotalOutputs() {
        let total = 0;
        for (const [, active] of this.activeClips) {
            for (let i = 0; i < active.tracks.length; i++) {
                const t = active.tracks[i];
                // Phases (si existen) son por-fixture; si no hay phases, contamos fixtureIds.
                total += t.fixturePhases?.length ?? t.fixtureIds.length;
            }
        }
        return total;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // 🧬 WAVE 4856 — V3 RESOLUTION PIPELINE
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * 🧬 WAVE 4856 — Construye los `ResolvedTrack[]` ejecutables de un clip V3.
     *
     * Ruteo espacial AISLADO: cada track resuelve sus propios `zones` via
     * `resolveZoneTags` (AND-intersección). Si la intersección resulta vacía,
     * la pista queda silenciada (sin fallback global) — el autor puede
     * declarar zonas inexistentes y el sistema lo respeta sin máscaras.
     *
     * Distribución de fase per-track: cada `track.selector?.phase` se evalúa
     * independientemente.
     */
    _buildResolvedTracks(clip, durationMs, externalFixtureIds) {
        const tracks = [];
        let topLevelPhaseConfig = null;
        // ── Resolución del inventario de fixtures (compartido entre tracks) ──
        // Las zonas se resuelven contra el inventario actual del Orchestrator.
        // Caller puede pre-resolver `externalFixtureIds` para ahorrar lookups
        // en el path Diamond / IPC; en ese caso es la fuente de verdad.
        const orchFixtures = (externalFixtureIds == null || externalFixtureIds.length === 0)
            ? getTitanOrchestrator().getFixturesForZoneMapping()
            : null;
        const allFixtureIds = (externalFixtureIds && externalFixtureIds.length > 0)
            ? externalFixtureIds
            : getTitanOrchestrator().getFixtureIds();
        /** Resuelve un `zones[]` a fixtureIds via AND-intersección. */
        const resolveZonesToFixtures = (zones) => {
            if (zones.length === 0)
                return [...allFixtureIds];
            if (zones.length === 1 && zones[0] === 'all')
                return [...allFixtureIds];
            if (orchFixtures != null) {
                const ids = resolveZoneTags(zones, orchFixtures);
                return ids;
            }
            // Pre-resolved IDs (externalFixtureIds) — ya filtrados por el caller.
            return [...allFixtureIds];
        };
        // ── V3 NATIVO ─────────────────────────────────────────────────────
        for (let i = 0; i < clip.tracks.length; i++) {
            const t = clip.tracks[i];
            const fixtureIds = resolveZonesToFixtures(t.zones);
            // ⚒️ WAVE 4859: `phaseConfig` es el shorthand canónico directo en el
            // track (formato nativo .lfx). `selector.phase` es la variante via
            // FixtureSelector (legado). Se da prioridad a `phaseConfig` y se usa
            // `selector.phase` / `selector.phaseSpread` como fallback.
            const trackPhase = this._extractPhaseConfig(t.phaseConfig ?? t.selector?.phase, t.selector?.phaseSpread);
            if (trackPhase != null && topLevelPhaseConfig == null) {
                topLevelPhaseConfig = trackPhase;
            }
            tracks.push(this._buildResolvedTrack(t.id, t.paramId, t.curve, t.blendMode, fixtureIds, trackPhase, durationMs, t.zones, t.phaseOverrides, t.colorOverride));
        }
        return { tracks, phaseConfig: topLevelPhaseConfig };
    }
    /**
     * 🧬 WAVE 4856 — Ensambla un único `ResolvedTrack` listo para `tickActive`.
     * Crea un `CurveEvaluator` con UNA sola curva (Map de tamaño 1) y, si hay
     * `phaseConfig + fixtureIds`, calcula la distribución de fase per-fixture.
     */
    _buildResolvedTrack(id, paramId, curve, blendMode, fixtureIds, phaseConfig, durationMs, zones, phaseOverrides, colorOverride) {
        const singleCurveMap = new Map([[paramId, curve]]);
        const evaluator = new CurveEvaluator(singleCurveMap, durationMs);
        let fixturePhases = null;
        const hasOverrides = phaseOverrides && Object.keys(phaseOverrides).length > 0;
        if (phaseConfig && (phaseConfig.spreadDeg > 0 || hasOverrides) && fixtureIds.length > 0) {
            fixturePhases = resolveWithOverrides(fixtureIds, phaseConfig, phaseOverrides, durationMs);
        }
        return {
            id,
            paramId,
            valueType: curve.valueType,
            evaluator,
            fixtureIds,
            fixturePhases,
            blendMode: blendMode ?? _defaultBlendModeFor(paramId),
            zones,
            colorOverride,
        };
    }
    /**
     * 🧬 WAVE 7003 — Inverted: upgrades any phase config to PhaseConfigPro.
     * V2 `spread` (0-1) → `spreadDeg` (×1440). V3 `spreadDeg` passed through.
     * Returns null if no significant phase config.
     */
    _extractPhaseConfig(phase, legacySpread) {
        if (phase) {
            if ('spreadDeg' in phase) {
                const pro = phase;
                if (pro.spreadDeg <= 0)
                    return null;
                return {
                    spreadDeg: pro.spreadDeg,
                    symmetry: pro.symmetry ?? 'linear',
                    wings: pro.wings ?? 1,
                    blocks: pro.blocks ?? 1,
                    shuffle: pro.shuffle ?? 0,
                    shuffleSeed: pro.shuffleSeed ?? 1,
                    direction: pro.direction ?? 1,
                };
            }
            // V2 PhaseConfig → upgrade to PRO
            if ('spread' in phase) {
                const v2 = phase;
                if (v2.spread <= 0)
                    return null;
                return {
                    spreadDeg: v2.spread * 1440,
                    symmetry: v2.symmetry ?? 'linear',
                    wings: v2.wings ?? 1,
                    blocks: 1,
                    shuffle: 0,
                    shuffleSeed: 1,
                    direction: v2.direction ?? 1,
                };
            }
        }
        if (legacySpread != null && legacySpread > 0) {
            return {
                spreadDeg: legacySpread * 1440,
                symmetry: 'linear',
                wings: 1,
                blocks: 1,
                shuffle: 0,
                shuffleSeed: 1,
                direction: 1,
            };
        }
        return null;
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
