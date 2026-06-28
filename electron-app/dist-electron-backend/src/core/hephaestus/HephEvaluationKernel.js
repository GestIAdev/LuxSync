/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ HEPH EVALUATION KERNEL — SINGLE SOURCE OF TRUTH
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * AUDIT P0-B (§1.2): "extraer un único HephEvaluationKernel puro (sin fs,
 * sin React, sin Arbiter) que AMBOS consuman."
 *
 * This module is the ONE place where clip evaluation logic lives.
 * Both `useHephPreview` (UI preview) and `HephaestusRuntime` (production
 * engine) import from here — guaranteeing WYSIWYG by construction.
 *
 * Pure function: no fs, no React, no Arbiter, no side effects, no globals.
 *
 * @module core/hephaestus/HephEvaluationKernel
 */
import { hslToRgb } from './runtime/HephUtils';
import { defaultBlendMode, blendNumeric, blendRgb } from './HephSharedMath';
// ═══════════════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Evaluate a color track's HSL value and convert to RGB with intensity modulation.
 * Handles both `colorOverride` (constant) and curve-evaluated HSL.
 * Returns RGB 0-255 or null if the HSL values are invalid.
 */
function evaluateColorTrack(track, evaluator, timeMs, intensityMod) {
    let hsl;
    if (track.colorOverride) {
        const co = track.colorOverride;
        if (typeof co.h !== 'number' || !Number.isFinite(co.h) ||
            typeof co.s !== 'number' || !Number.isFinite(co.s) ||
            typeof co.l !== 'number' || !Number.isFinite(co.l)) {
            return null;
        }
        hsl = co;
    }
    else {
        const result = evaluator.getColorValue(track.paramId, timeMs);
        if (!result ||
            typeof result.h !== 'number' || typeof result.s !== 'number' || typeof result.l !== 'number' ||
            !Number.isFinite(result.h) || !Number.isFinite(result.s) || !Number.isFinite(result.l)) {
            return null;
        }
        hsl = result;
    }
    const modulatedL = (hsl.l / 100) * intensityMod;
    const rgb = hslToRgb(hsl.h, hsl.s / 100, modulatedL);
    if (!Number.isFinite(rgb.r))
        rgb.r = 0;
    if (!Number.isFinite(rgb.g))
        rgb.g = 0;
    if (!Number.isFinite(rgb.b))
        rgb.b = 0;
    return rgb;
}
// ═══════════════════════════════════════════════════════════════════════════
// THE KERNEL
// ═══════════════════════════════════════════════════════════════════════════
/**
 * ⚒️ THE KERNEL — Single source of truth for fixture evaluation.
 *
 * Evaluates all applicable tracks for a fixture at time `t`, blends them
 * using `HephSharedMath` (blendNumeric / blendRgb), and returns blended
 * parameter values ready for DMX scaling.
 *
 * BLENDING:
 *   - Multiple tracks with the same paramId → blendMode (max/replace/add/multiply)
 *   - Color tracks: L modulated by intensity track value × clipIntensity
 *   - Numeric tracks: raw × clipIntensity (clipIntensity=1.0 for preview)
 *
 * INTENSITY MODULATION (color):
 *   The kernel finds the intensity track (paramId === 'intensity') among
 *   the applicable tracks and uses its evaluated value to modulate the
 *   luminance of color tracks. This matches the runtime's behavior and
 *   unifies what the preview previously did independently.
 *
 * CONSUMERS:
 *   - `useHephPreview`: calls this per fixture, then scales to PreviewFixtureState
 *   - `HephaestusRuntime`: calls this per fixture, then emits HephFixtureOutput[]
 *
 * @param clip The clip being evaluated
 * @param trackEvaluators Per-track CurveEvaluator map (from buildTrackEvaluators)
 * @param applicableTracks Tracks that target this fixture (pre-filtered by zone)
 * @param timeMs Evaluation time in milliseconds
 * @param clipIntensity Clip-level intensity multiplier (0-1, default 1.0)
 * @returns Blended fixture parameters
 */
export function evaluateFixtureParams(clip, trackEvaluators, applicableTracks, timeMs, clipIntensity = 1.0) {
    const numeric = new Map();
    let cr = 0, cg = 0, cb = 0;
    let hasColor = false;
    // Pre-resolve intensity track for color luminance modulation
    let cachedIntensityMod = null;
    for (const track of applicableTracks) {
        const paramId = track.paramId;
        const evaluator = trackEvaluators.get(track.id);
        if (!evaluator)
            continue;
        if (track.curve.valueType === 'color') {
            // Resolve intensity modulation: intensity track value × clipIntensity
            if (cachedIntensityMod === null) {
                const intensityTrack = applicableTracks.find(t => t.paramId === 'intensity');
                let intensityVal = 1.0;
                if (intensityTrack) {
                    const intEv = trackEvaluators.get(intensityTrack.id);
                    if (intEv)
                        intensityVal = intEv.getValue('intensity', timeMs);
                }
                cachedIntensityMod = intensityVal * clipIntensity;
            }
            const rgb = evaluateColorTrack(track, evaluator, timeMs, cachedIntensityMod);
            if (!rgb)
                continue;
            if (hasColor) {
                const mode = track.blendMode ?? 'replace';
                const [nr, ng, nb] = blendRgb(cr, cg, cb, rgb.r, rgb.g, rgb.b, mode);
                cr = nr;
                cg = ng;
                cb = nb;
            }
            else {
                cr = rgb.r;
                cg = rgb.g;
                cb = rgb.b;
                hasColor = true;
            }
            continue;
        }
        // Numeric track
        const raw = evaluator.getValue(paramId, timeMs);
        const adjusted = raw * clipIntensity;
        if (numeric.has(paramId)) {
            const existing = numeric.get(paramId);
            const mode = track.blendMode ?? defaultBlendMode(paramId);
            numeric.set(paramId, blendNumeric(existing, adjusted, mode));
        }
        else {
            numeric.set(paramId, adjusted);
        }
    }
    return { numeric, r: cr, g: cg, b: cb, hasColor };
}
