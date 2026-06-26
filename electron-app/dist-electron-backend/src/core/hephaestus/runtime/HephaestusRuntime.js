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
import { resolvePro } from '../phase/PhaseConfigPro';
import { getHephaestusClipIndex } from '../HephaestusClipIndex';
import { CurveEvaluator } from '../CurveEvaluator';
import { resolveZoneTags } from '../../zones/ZoneMapper';
import { getTitanOrchestrator } from '../../orchestrator/TitanOrchestrator';
// ═══════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 4856 — V3 SCHEMA HELPERS (module-private, type-narrowing)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Discrimina V3 (`tracks: HephTrack[]`) de V2 (`curves: Map<paramId, HephCurve>`).
 * Usar como type-guard — narrows TS al subtipo correspondiente.
 */
function _isV3Clip(clip) {
    return Array.isArray(clip.tracks);
}
/**
 * Default `BlendMode` por parámetro — utilizado durante la migración v2→v3
 * cuando el clip legado no declara estrategia de fusión. Se alinea con la
 * semántica histórica que el motor expone:
 *   - `intensity`         → 'max' (HTP — highest takes precedence).
 *   - `color` / `pan` / `tilt` y demás → 'replace' (LTP — last write wins).
 */
function _defaultBlendModeFor(paramId) {
    return paramId === 'intensity' ? 'max' : 'replace';
}
/**
 * Blend mode derivado para clips v2.1 durante migración in-memory.
 *
 * V2.1 no declaraba blend por track: solo un `mixBus` global de clip.
 * Si ignoramos ese campo, `intensity` cae siempre en HTP (`max`) y se
 * reintroduce bleed de L0 en efectos ambientes. Esta función restaura
 * intención de autor para clips legacy.
 */
function _v2BlendModeFor(paramId, mixBus) {
    const bus = typeof mixBus === 'string' ? mixBus.trim().toLowerCase() : '';
    if (bus === 'htp' || bus === 'max') {
        return paramId === 'intensity' ? 'max' : 'replace';
    }
    if (bus === 'ambient' || bus === 'accent' || bus === 'add') {
        return paramId === 'intensity' ? 'add' : 'replace';
    }
    // global/override/replace/unknown → LTP seguro.
    return 'replace';
}
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
         * 🧬 WAVE 4856: Tipo unión v2/v3 — el formato en disco se preserva tal cual
         * y la migración a tracks ejecutables ocurre per-instancia en `play()`.
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
     * Load and cache a .lfx file. Acepta esquemas v2.1 y v3.0 (WAVE 4856).
     * Returns the parsed clip (v2 o v3) o null si falla.
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
        const durationMs = options.durationOverrideMs ?? clip.durationMs;
        // 🧬 WAVE 4856: Construir tracks resueltos (v3 nativo o migración v2 → v3).
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
     * ⚒️ WAVE 2400: Now resolves PhaseDistributor if clip has phase config.
     *
     * @param clip Pre-deserialized HephAutomationClip with Map<> curves
     * @param options Playback options
     * @returns Instance ID for tracking
     */
    playFromClip(clip, options = {}) {
        const instanceId = `heph_diamond_${++this.instanceCounter}_${Date.now()}`;
        const now = Date.now();
        const durationMs = options.durationOverrideMs ?? clip.durationMs;
        // 🧬 WAVE 4856: V3 nativo o migración v2 → v3 in-memory.
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
            const sourceCount = _isV3Clip(clip) ? `${clip.tracks.length} v3-tracks` : `${clip.curves.size} v2-curves`;
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
        for (let ti = 0; ti < active.tracks.length; ti++) {
            const track = active.tracks[ti];
            const paramName = track.paramId;
            const evaluator = track.evaluator;
            // ── Path A: per-fixture phase distribution ────────────────────────
            if (track.fixturePhases !== null && track.fixturePhases.length > 0) {
                for (let pi = 0; pi < track.fixturePhases.length; pi++) {
                    const fp = track.fixturePhases[pi];
                    // ⚒️ WAVE 4859 — MODELO MA3: el offset representa cuánto TARDA en
                    // arrancar este fixture. Se resta al tiempo del clip, no se suma.
                    // Antes (bug): fixtureTimeMs = baseClipTimeMs + fp.phaseOffsetMs
                    //   → todos los fixtures en posiciones distintas de la curva al t=0
                    //   → efecto simultáneo, no escalonado.
                    // Ahora (MA3): localElapsedMs = max(0, clipTime - offset)
                    //   → fixture con offset=500ms comienza su ciclo 500ms después
                    //   → wave genuina: fixture[0] dispara primero, luego fixture[1], etc.
                    const localElapsedMs = Math.max(0, baseClipTimeMs - fp.phaseOffsetMs);
                    let fixtureTimeMs;
                    if (isLoop) {
                        fixtureTimeMs = ((localElapsedMs % durationMs) + durationMs) % durationMs;
                    }
                    else {
                        fixtureTimeMs = Math.min(localElapsedMs, durationMs);
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
        if (track.valueType === 'color') {
            const hsl = evaluator.getColorValue(paramName, timeMs);
            // Intensity modula lightness — preserva hue/sat (HSL standard heph: 0-100)
            const modulatedL = (hsl.l / 100) * intensity;
            const rgb = hslToRgb(hsl.h, hsl.s / 100, modulatedL);
            this._normRgbBuf.r = rgb.r / 255;
            this._normRgbBuf.g = rgb.g / 255;
            this._normRgbBuf.b = rgb.b / 255;
            this.writeOutput(fixtureId, 'all', paramName, 0, rgb, undefined, 0, this._normRgbBuf, isCustomThisClip, clipId, trackZones);
        }
        else {
            const rawValue = evaluator.getValue(paramName, timeMs);
            const withIntensity = rawValue * intensity;
            const scaledValue = scaleToDMX(paramName, withIntensity);
            const fine = (paramName === 'pan' || paramName === 'tilt')
                ? scaleToDMX16(withIntensity).fine
                : undefined;
            this.writeOutput(fixtureId, 'all', paramName, scaledValue, undefined, fine, withIntensity, undefined, isCustomThisClip, clipId, trackZones);
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
     * 🧬 WAVE 4856 — Construye los `ResolvedTrack[]` ejecutables de un clip.
     *
     * Acepta tanto `HephAutomationClipV3` (canónico) como `HephAutomationClip`
     * (v2.1 legado). Para v2 sintetiza UN track por entrada de `clip.curves`
     * usando `clip.zones` como destino común — la equivalencia semántica con
     * el comportamiento previo es 1:1.
     *
     * Ruteo espacial AISLADO: cada track resuelve sus propios `zones` via
     * `resolveZoneTags` (AND-intersección). Si la intersección resulta vacía,
     * la pista queda silenciada (sin fallback global) — el autor puede
     * declarar zonas inexistentes y el sistema lo respeta sin máscaras.
     *
     * Distribución de fase per-track:
     *   - V3: cada `track.selector?.phase` se evalúa independientemente.
     *   - V2: el `clip.selector?.phase` original se hereda a TODAS las pistas
     *     migradas (preserva semántica histórica).
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
        if (_isV3Clip(clip)) {
            // ── V3 NATIVO ─────────────────────────────────────────────────────
            for (let i = 0; i < clip.tracks.length; i++) {
                const t = clip.tracks[i];
                const fixtureIds = resolveZonesToFixtures(t.zones);
                // 🧩 DIAGNÓSTICO COMPOUND FIXTURE (temporal)
                const hasTungsten = fixtureIds.some(id => id === 'fixture-1781916704143');
                if (hasTungsten) {
                    console.log(`[HephaestusRuntime._buildResolvedTracks] 🧩 track=${t.id} param=${t.paramId} zones=[${(t.zones ?? []).join(',')}] | Tungsten EN fixtureIds (${fixtureIds.length} total)`);
                }
                // ⚒️ WAVE 4859: `phaseConfig` es el shorthand canónico directo en el
                // track (formato nativo .lfx). `selector.phase` es la variante via
                // FixtureSelector (legado). Se da prioridad a `phaseConfig` y se usa
                // `selector.phase` / `selector.phaseSpread` como fallback.
                const trackPhase = this._extractPhaseConfig(t.phaseConfig ?? t.selector?.phase, t.selector?.phaseSpread);
                if (trackPhase != null && topLevelPhaseConfig == null) {
                    topLevelPhaseConfig = trackPhase;
                }
                tracks.push(this._buildResolvedTrack(t.id, t.paramId, t.curve, t.blendMode, fixtureIds, trackPhase, durationMs, t.zones));
            }
        }
        else {
            // ── V2.1 → V3 IN-MEMORY MIGRATION ─────────────────────────────────
            // Una entrada por (paramId, curve) en el Map legado, hereda la zona
            // global del clip y el `selector.phase` clip-level (si existe).
            const clipPhase = this._extractPhaseConfig(clip.selector?.phase, clip.selector?.phaseSpread);
            topLevelPhaseConfig = clipPhase;
            // 🔧 WAVE 4914 FIX: En V2.1, el campo `zones[]` era un energy label
            // ('intense', 'peak', 'active'…) — no un fixture zone tag. Si la
            // resolución devuelve array vacío, fallback a todos los fixtures del rig
            // para preservar el comportamiento pre-WAVE 4856 donde V2.1 siempre
            // iluminaba el rig completo.
            const _rawZoneIds = resolveZonesToFixtures(clip.zones);
            const sharedFixtureIds = _rawZoneIds.length > 0 ? _rawZoneIds : [...allFixtureIds];
            for (const [paramId, curve] of clip.curves) {
                tracks.push(this._buildResolvedTrack(`legacy:${paramId}`, paramId, curve, _v2BlendModeFor(paramId, clip.mixBus), sharedFixtureIds, clipPhase, durationMs));
            }
        }
        return { tracks, phaseConfig: topLevelPhaseConfig };
    }
    /**
     * 🧬 WAVE 4856 — Ensambla un único `ResolvedTrack` listo para `tickActive`.
     * Crea un `CurveEvaluator` con UNA sola curva (Map de tamaño 1) y, si hay
     * `phaseConfig + fixtureIds`, calcula la distribución de fase per-fixture.
     */
    _buildResolvedTrack(id, paramId, curve, blendMode, fixtureIds, phaseConfig, durationMs, zones) {
        const singleCurveMap = new Map([[paramId, curve]]);
        const evaluator = new CurveEvaluator(singleCurveMap, durationMs);
        let fixturePhases = null;
        if (phaseConfig && phaseConfig.spreadDeg > 0 && fixtureIds.length > 0) {
            fixturePhases = resolvePro(fixtureIds, phaseConfig, durationMs);
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
