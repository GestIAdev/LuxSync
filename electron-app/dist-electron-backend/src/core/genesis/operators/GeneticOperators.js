// ═══════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 5000.V3 — ERA II: Genetic Operators
// ═══════════════════════════════════════════════════════════════════════════
//  Pure deterministic functions that produce genetic variance (delta_json)
//  from a parent HephAutomationClipV3.
//
//  Delta representation: JSON Patch (RFC 6902) operations array.
//  applyDelta() resolves deltas with array-index awareness for tracks/keyframes.
//
//  All operators are pure: (clip) → { clip: clone, delta: Operation[] }
//  The clone is the mutated clip; the delta is the minimal diff to reproduce it.
// ═══════════════════════════════════════════════════════════════════════════
import { BEZIER_PRESETS } from '../../hephaestus/types';
import { ENERGY_ZONES } from '../../arsenal/LfxClipInstance';
import { DEFAULT_PHASE_CONFIG_PRO } from '../../hephaestus/phase/PhaseConfigPro';
// ─── DEEP CLONE ─────────────────────────────────────────────────────────────
function deepClone(obj) {
    if (typeof structuredClone === 'function') {
        return structuredClone(obj);
    }
    return JSON.parse(JSON.stringify(obj));
}
// ─── DELTA APPLICATION ──────────────────────────────────────────────────────
/**
 * Applies a JSON Patch (RFC 6902 subset) to a clip.
 * Supports: add, replace, remove on object properties and array indices.
 * Path format: "/tracks/0/curve/keyframes/1/value"
 *
 * Robust with nested arrays (tracks[], keyframes[]).
 */
export function applyDelta(clip, delta) {
    const target = deepClone(clip);
    for (const op of delta) {
        const parts = op.path.split('/').filter(Boolean);
        let cursor = target;
        for (let i = 0; i < parts.length - 1; i++) {
            const key = parts[i];
            cursor = cursor[key];
        }
        const lastKey = parts[parts.length - 1];
        switch (op.op) {
            case 'replace':
                cursor[lastKey] = op.value;
                break;
            case 'add':
                if (lastKey === '-' && Array.isArray(cursor)) {
                    cursor.push(op.value);
                }
                else if (Array.isArray(cursor) && /^\d+$/.test(lastKey)) {
                    cursor.splice(Number(lastKey), 0, op.value);
                }
                else if (Array.isArray(cursor[lastKey])) {
                    ;
                    cursor[lastKey].push(op.value);
                }
                else {
                    cursor[lastKey] = op.value;
                }
                break;
            case 'remove':
                if (Array.isArray(cursor) && /^\d+$/.test(lastKey)) {
                    cursor.splice(Number(lastKey), 1);
                }
                else {
                    delete cursor[lastKey];
                }
                break;
        }
    }
    return target;
}
// ─── L2 DISTANCE V2 — COMPOSITE MULTI-SPACE (WAVE 6000) ─────────────────────
/**
 * D_curve: RMSE over normalized keyframe values and bezier handles.
 * Differences are divided by the track's span (range[1] - range[0])
 * so that pan/tilt channels don't dominate the score.
 */
function computeDCurve(parent, child) {
    let sumSq = 0;
    let count = 0;
    const maxTracks = Math.max(parent.tracks.length, child.tracks.length);
    for (let t = 0; t < maxTracks; t++) {
        const pt = parent.tracks[t];
        const ct = child.tracks[t];
        if (!pt || !ct) {
            sumSq += 1.0;
            count++;
            continue;
        }
        const span = pt.curve.range[1] - pt.curve.range[0];
        const safeSpan = span !== 0 ? span : 1;
        const pk = pt.curve.keyframes;
        const ck = ct.curve.keyframes;
        const maxKf = Math.max(pk.length, ck.length);
        for (let k = 0; k < maxKf; k++) {
            const pkf = pk[k];
            const ckf = ck[k];
            if (!pkf || !ckf) {
                sumSq += 0.5;
                count++;
                continue;
            }
            if (typeof pkf.value === 'number' && typeof ckf.value === 'number') {
                const diffNorm = (ckf.value - pkf.value) / safeSpan;
                sumSq += diffNorm * diffNorm;
                count++;
            }
            else if (typeof pkf.value === 'object' && pkf.value !== null
                && typeof ckf.value === 'object' && ckf.value !== null
                && 'h' in pkf.value && 's' in pkf.value && 'l' in pkf.value
                && 'h' in ckf.value && 's' in ckf.value && 'l' in ckf.value) {
                // 🎨 WAVE 7546: HSL color distance — circular hue + linear S/L.
                // Hue uses shortest-path on the color wheel (0-360°).
                // S and L are normalized to [0,1] (range 0-100).
                const pH = pkf.value;
                const cH = ckf.value;
                let hueDiff = Math.abs(cH.h - pH.h);
                if (hueDiff > 180)
                    hueDiff = 360 - hueDiff; // shortest path
                const hueNorm = hueDiff / 180; // normalize to [0,1]
                const satNorm = Math.abs(cH.s - pH.s) / 100;
                const lightNorm = Math.abs(cH.l - pH.l) / 100;
                // Weighted: hue is the most perceptually salient (0.5),
                // saturation (0.25), lightness (0.25)
                sumSq += 0.5 * hueNorm * hueNorm + 0.25 * satNorm * satNorm + 0.25 * lightNorm * lightNorm;
                count++;
            }
            if (pkf.bezierHandles && ckf.bezierHandles) {
                for (let b = 0; b < 4; b++) {
                    const diff = ckf.bezierHandles[b] - pkf.bezierHandles[b];
                    sumSq += diff * diff * 0.25;
                    count++;
                }
            }
        }
    }
    return count > 0 ? Math.sqrt(sumSq / count) : 0;
}
/**
 * D_phase: RMSE over normalized PhaseConfigPro field differences.
 * Each field is normalized to [0,1] by its canonical range.
 * Weights reflect visual impact: spreadDeg > wings > shuffle ≈ blocks > direction > symmetry.
 */
function computeDPhase(parent, child) {
    const maxTracks = Math.max(parent.tracks.length, child.tracks.length);
    let sumSq = 0;
    let count = 0;
    const weights = [0.30, 0.25, 0.15, 0.15, 0.10, 0.05];
    for (let t = 0; t < maxTracks; t++) {
        const pt = parent.tracks[t];
        const ct = child.tracks[t];
        if (!pt || !ct) {
            sumSq += 0.5;
            count++;
            continue;
        }
        const pp = pt.phaseConfig ?? DEFAULT_PHASE_CONFIG_PRO;
        const cp = ct.phaseConfig ?? DEFAULT_PHASE_CONFIG_PRO;
        const dSpread = Math.abs(cp.spreadDeg - pp.spreadDeg) / 1440;
        const dWings = Math.abs(cp.wings - pp.wings) / 8;
        const dShuffle = Math.abs(cp.shuffle - pp.shuffle);
        const dBlocks = Math.abs(cp.blocks - pp.blocks) / 16;
        const dDirection = cp.direction !== pp.direction ? 1 : 0;
        const dSymmetry = cp.symmetry !== pp.symmetry ? 1 : 0;
        const diffs = [dSpread, dWings, dShuffle, dBlocks, dDirection, dSymmetry];
        let weightedSumSq = 0;
        for (let i = 0; i < diffs.length; i++) {
            weightedSumSq += weights[i] * diffs[i] * diffs[i];
        }
        sumSq += weightedSumSq;
        count++;
    }
    return count > 0 ? Math.sqrt(sumSq / count) : 0;
}
/**
 * D_structural: topological distance [0,1] based on track count diff,
 * average keyframe count diff, interpolation change ratio,
 * and WAVE 7165: zone divergence bonus for multicellular innovation.
 */
function computeDStructural(parent, child) {
    const trackCountDiff = Math.abs(child.tracks.length - parent.tracks.length) /
        Math.max(parent.tracks.length, 1);
    let keyframeDiffSum = 0;
    let interpolationChanges = 0;
    let comparedTracks = 0;
    const maxT = Math.max(parent.tracks.length, child.tracks.length);
    for (let t = 0; t < maxT; t++) {
        const pt = parent.tracks[t];
        const ct = child.tracks[t];
        if (!pt || !ct)
            continue;
        comparedTracks++;
        const kfDiff = Math.abs(ct.curve.keyframes.length - pt.curve.keyframes.length);
        keyframeDiffSum += kfDiff / Math.max(pt.curve.keyframes.length, 1);
        const minKf = Math.min(pt.curve.keyframes.length, ct.curve.keyframes.length);
        for (let k = 0; k < minKf; k++) {
            if (pt.curve.keyframes[k].interpolation !== ct.curve.keyframes[k].interpolation) {
                interpolationChanges++;
            }
        }
    }
    const avgKfDiff = comparedTracks > 0 ? keyframeDiffSum / comparedTracks : 0;
    const interpRatio = comparedTracks > 0
        ? interpolationChanges / comparedTracks
        : 0;
    // WAVE 7165: Zone divergence — count (paramId, zone) pairs in child not present in parent
    const parentZoneKeys = new Set();
    for (const track of parent.tracks) {
        for (const zone of track.zones) {
            parentZoneKeys.add(`${track.paramId}::${zone}`);
        }
    }
    let newZonePairs = 0;
    for (const track of child.tracks) {
        for (const zone of track.zones) {
            const key = `${track.paramId}::${zone}`;
            if (!parentZoneKeys.has(key))
                newZonePairs++;
        }
    }
    const zoneDivergence = Math.min(1, newZonePairs / Math.max(parent.tracks.length, 1));
    return Math.max(0, Math.min(1, 0.45 * trackCountDiff + 0.30 * avgKfDiff + 0.10 * interpRatio + 0.15 * zoneDivergence));
}
/**
 * 🔬 WAVE 7530: D_temporal — measures global duration changes and per-keyframe
 * temporal displacement. Previously, proportional_stretch produced L2=0 because
 * no component measured durationMs or timeMs shifts. This made the evolutionary
 * engine blind to half-time / double-time mutations — massive musical changes
 * were classified as COMMON with score 0.
 *
 * D_temporal = 0.50 * D_duration + 0.50 * D_kfTime
 *
 * D_duration = |log(child.durationMs / parent.durationMs)| / log(4)
 *   Normalized by log(4) because the maximum stretch ratio is 4× (0.25× to 1.0×
 *   relative to original, or 1.0× to 4.0× in absolute terms). Clamped to [0,1].
 *
 * D_kfTime = RMSE of normalized temporal displacement per keyframe pair.
 *   For each keyframe pair (parent[k], child[k]) on the same track, the temporal
 *   displacement is |child.timeMs - parent.timeMs| / parent.durationMs, clamped
 *   to [0,1]. This catches non-uniform temporal mutations (e.g. macro_splice
 *   inserting keyframes shifts subsequent keyframes in time).
 */
function computeDTemporal(parent, child) {
    // D_duration: global duration ratio in log-space
    const parentDur = parent.durationMs > 0 ? parent.durationMs : 1;
    const childDur = child.durationMs > 0 ? child.durationMs : 1;
    const ratio = childDur / parentDur;
    const dDuration = Math.min(1, Math.abs(Math.log(ratio) / Math.log(4)));
    // D_kfTime: per-keyframe temporal displacement RMSE
    let sumSq = 0;
    let count = 0;
    const maxTracks = Math.max(parent.tracks.length, child.tracks.length);
    for (let t = 0; t < maxTracks; t++) {
        const pt = parent.tracks[t];
        const ct = child.tracks[t];
        if (!pt || !ct) {
            // Track added or removed — counts as full temporal displacement
            sumSq += 0.5;
            count++;
            continue;
        }
        const pk = pt.curve.keyframes;
        const ck = ct.curve.keyframes;
        const maxKf = Math.max(pk.length, ck.length);
        for (let k = 0; k < maxKf; k++) {
            const pkf = pk[k];
            const ckf = ck[k];
            if (!pkf || !ckf) {
                sumSq += 0.25;
                count++;
                continue;
            }
            const disp = Math.abs(ckf.timeMs - pkf.timeMs) / parentDur;
            const clamped = Math.min(1, disp);
            sumSq += clamped * clamped;
            count++;
        }
    }
    const dKfTime = count > 0 ? Math.sqrt(sumSq / count) : 0;
    return Math.min(1, 0.50 * dDuration + 0.50 * dKfTime);
}
/**
 * 🔬 WAVE 7530: D_interp — measures interpolation type changes and bezier
 * handle deltas. Previously, curve_adaptation produced L2≈0 because D_structural
 * only counted interpolation changes at 0.10× weight within a 0.05× component —
 * effectively 0.005× total contribution. Changing linear→hold is visually
 * dramatic (smooth motion becomes stepped) but was invisible to the L2 metric.
 *
 * D_interp = 0.60 * interpChangeRatio + 0.40 * bezierHandleDelta
 *
 * interpChangeRatio = interpChanges / comparedTracks
 *   (fraction of tracks where at least one keyframe changed interpolation type)
 *
 * bezierHandleDelta = RMSE of bezier handle differences (only for keyframes
 *   where both parent and child have bezierHandles). Normalized by track span.
 */
function computeDInterp(parent, child) {
    let interpChanges = 0;
    let comparedTracks = 0;
    let bezierSumSq = 0;
    let bezierCount = 0;
    const maxTracks = Math.max(parent.tracks.length, child.tracks.length);
    for (let t = 0; t < maxTracks; t++) {
        const pt = parent.tracks[t];
        const ct = child.tracks[t];
        if (!pt || !ct)
            continue;
        comparedTracks++;
        const pk = pt.curve.keyframes;
        const ck = ct.curve.keyframes;
        const minKf = Math.min(pk.length, ck.length);
        let trackInterpChanged = false;
        const span = pt.curve.range[1] - pt.curve.range[0];
        const safeSpan = span !== 0 ? span : 1;
        for (let k = 0; k < minKf; k++) {
            if (pk[k].interpolation !== ck[k].interpolation) {
                trackInterpChanged = true;
            }
            // Bezier handle delta — only if both have handles
            if (pk[k].bezierHandles && ck[k].bezierHandles) {
                for (let b = 0; b < 4; b++) {
                    const diff = (ck[k].bezierHandles[b] - pk[k].bezierHandles[b]) / safeSpan;
                    bezierSumSq += diff * diff;
                    bezierCount++;
                }
            }
        }
        if (trackInterpChanged)
            interpChanges++;
    }
    const interpChangeRatio = comparedTracks > 0 ? interpChanges / comparedTracks : 0;
    const bezierHandleDelta = bezierCount > 0 ? Math.min(1, Math.sqrt(bezierSumSq / bezierCount)) : 0;
    return Math.min(1, 0.60 * interpChangeRatio + 0.40 * bezierHandleDelta);
}
/**
 * Composite L2 distance V2 — multi-space weighted average.
 * 🔬 WAVE 7530: REBALANCED with D_temporal and D_interp.
 *
 * L2_total = 0.40 * D_curve + 0.25 * D_phase + 0.15 * D_temporal + 0.10 * D_interp + 0.10 * D_structural
 *
 * Previous formula (0.55/0.40/0.05) was blind to temporal and interpolation
 * changes. proportional_stretch (duration stretch) produced L2=0 for massive
 * musical changes. curve_adaptation (interp change) produced L2≈0.005.
 *
 * The new formula gives 15% weight to temporal mutations and 10% to interpolation
 * mutations, making both visible to the rarity/evolution pipeline. D_curve and
 * D_phase are reduced proportionally but remain the dominant components.
 */
export function computeL2DistanceV2(parent, child) {
    const dCurve = computeDCurve(parent, child);
    const dPhase = computeDPhase(parent, child);
    const dTemporal = computeDTemporal(parent, child);
    const dInterp = computeDInterp(parent, child);
    const dStructural = computeDStructural(parent, child);
    return 0.40 * dCurve + 0.25 * dPhase + 0.15 * dTemporal + 0.10 * dInterp + 0.10 * dStructural;
}
// ─── RANDOM HELPERS (deterministic via seed) ────────────────────────────────
/**
 * 🔬 WAVE 7533: Mulberry32 PRNG — replaces legacy LCG.
 *
 * The previous LCG (`s = s * 1664525 + 1013904223`) had two problems:
 *   1. LCGs have weak low-order bit correlations.
 *   2. `% 1000000` discarded the high-quality high bits, keeping precisely
 *      the weak low bits — the worst of both worlds.
 *
 * Mulberry32 is a 32-bit PRNG with excellent statistical quality (passes
 * TestU01 SmallCrush), minimal state (a single uint32), and cost comparable
 * to the LCG. It remains 100% deterministic and seedable, preserving
 * forensic reproducibility: same seed → same mutation sequence, always.
 *
 * Reference: https://gist.github.com/tommyettinger/46da8af6567d396e1c57
 */
export function makeRng(seed) {
    let s = (seed | 0) >>> 0; // force uint32
    return () => {
        // MurmurHash3 finalizer mix
        s = (s + 0x6D2B79F5) | 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        const result = ((t ^ (t >>> 14)) >>> 0);
        return result / 4294967296; // [0, 1) — full 32-bit entropy
    };
}
export function stringToSeed(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return h;
}
function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}
/**
 * Wraps a base RNG to provide fat-tailed sampling distributions.
 * Uses Cauchy (for signed magnitudes) and Pareto (for positive magnitudes).
 */
export function makeFatTailedRng(baseRng) {
    const sampleCauchy = (scale, maxAbs) => {
        const p = baseRng();
        const pClamped = Math.max(1e-6, Math.min(1 - 1e-6, p));
        const raw = scale * Math.tan(Math.PI * (pClamped - 0.5));
        return Math.max(-maxAbs, Math.min(maxAbs, raw));
    };
    const samplePareto = (xm, alpha) => {
        const p = Math.max(0, Math.min(1 - 1e-9, baseRng()));
        return xm / Math.pow(1 - p, 1 / alpha);
    };
    return { sampleCauchy, samplePareto };
}
// ═══════════════════════════════════════════════════════════════════════════
// OPERATOR 1: FOCAL MUTATION (Context-aware — replaces point_mutation)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * 🔬 KINETIC SECURITY PARAMETER LIST (WAVE 7531)
 *
 * Mechanical channels (pan, tilt) control physical moving heads with inertia,
 * servo motors, and mechanical wear limits. A Cauchy jump of 0.80·span on a
 * pan track ∈ [0,255] would command a 204° instantaneous rotation — this can
 * damage servo gears, snap belts, or trip safety cutouts. These channels are
 * strictly isolated from fat-tailed distributions and use conservative uniform
 * magnitudes only.
 *
 * Optical channels (intensity, color, strobe, zoom) control LEDs, dimmers, and
 * color wheels — solid-state or low-inertia systems that can tolerate abrupt
 * full-range jumps without mechanical damage. These channels are eligible for
 * Cauchy-sampled magnitudes to enable punctuated equilibrium.
 */
const KINETIC_SECURE_PARAMS = new Set(['pan', 'tilt']);
/**
 * Shifts keyframe values by perceptible amounts on DNA-selected tracks.
 * Aggression favors intensity/strobe; organicity favors color/zoom/pan/tilt.
 *
 * 🔬 WAVE 7531: PUNCTUATED EQUILIBRIUM via Cauchy distribution.
 *
 * For optical channels (intensity, color, strobe, zoom): the shift magnitude
 * is sampled from a truncated Cauchy distribution with scale=0.15 and maxAbs=0.60.
 * This means:
 *   - ~68% of mutations: |shift| ≈ 0.10-0.20 (perceptible, conservative)
 *   - ~25% of mutations: |shift| ≈ 0.20-0.40 (moderate)
 *   - ~7% of mutations:  |shift| ≈ 0.40-0.60 (large jump — crosses aptitude valleys)
 *
 * For kinetic channels (pan, tilt): the shift magnitude remains uniform [0.20, 0.40)
 * as before. Mechanical fixtures are shielded from fat-tailed spikes.
 *
 * 🔬 WAVE 7536: PLEIOTROPY — multi-point mutations governed by genome.chaos.
 *
 * High-chaos organisms now apply up to 3 simultaneous keyframe shifts per
 * invocation, enabling complex structural variations to emerge in a single
 * generation. Low-chaos organisms remain single-point (conservative). The
 * KINETIC SECURITY RULE is re-evaluated per track inside the loop, so even
 * during a multi-point frenzy, pan/tilt are never subjected to Cauchy bounds.
 */
export function focalMutation(parent, seed) {
    const rng = makeRng(seed ?? Date.now());
    const fatRng = makeFatTailedRng(rng);
    const child = deepClone(parent);
    const delta = [];
    // Contextual target selection from DNA
    const dna = child.cognitiveDNA;
    const genome = dna?.genome;
    const aggression = genome?.aggression ?? 0.5;
    const organicity = genome?.organicity ?? 0.5;
    const chaos = genome?.chaos ?? 0.5;
    let targetParamIds = null;
    if (aggression > 0.5) {
        targetParamIds = ['intensity', 'strobe'];
    }
    else if (organicity > 0.5) {
        targetParamIds = ['color', 'zoom', 'pan', 'tilt'];
    }
    // 🎨 WAVE 7546: Include color tracks (valueType: 'color') alongside numeric
    // tracks. Previously, color tracks were excluded by the `valueType === 'number'`
    // filter, preventing focal_mutation from ever mutating color keyframes even
    // when `organicity > 0.5` selected 'color' as a target paramId.
    let numericTracks = child.tracks
        .map((t, i) => ({ track: t, index: i }))
        .filter((t) => (t.track.curve.valueType === 'number' || t.track.curve.valueType === 'color')
        && t.track.curve.keyframes.length > 0);
    if (targetParamIds) {
        const filtered = numericTracks.filter((t) => targetParamIds.includes(t.track.paramId));
        if (filtered.length > 0) {
            numericTracks = filtered;
        }
    }
    if (numericTracks.length === 0) {
        return { clip: child, delta, operator: 'focal_mutation', l2Distance: 0 };
    }
    // 🔬 WAVE 7536: PLEIOTROPY — number of simultaneous mutations scaled by chaos.
    // Amplifier: chaos=0.66 already maps to 1.0, so mid-chaos organisms enter
    // the full pleiotropy regime earlier. Low-chaos organisms remain conservative.
    //   effectiveChaos=0.0 → always 1 mutation (conservative)
    //   effectiveChaos=0.5 → 1-2 mutations (moderate pleiotropy)
    //   effectiveChaos=1.0 → 1-3 mutations (frenzy — complex structural variation)
    const effectiveChaos = Math.min(1.0, chaos * 1.5);
    const numMutations = 1 + Math.floor(effectiveChaos * rng() * 3);
    for (let m = 0; m < numMutations; m++) {
        const pick = numericTracks[Math.floor(rng() * numericTracks.length)];
        const track = pick.track;
        const trackIdx = pick.index;
        const kfIdx = Math.floor(rng() * track.curve.keyframes.length);
        const kf = track.curve.keyframes[kfIdx];
        // 🎨 WAVE 7546: Color track branch — mutate HSL values via hue rotation,
        // saturation drift, and lightness shift. Color tracks have valueType: 'color'
        // and their keyframe values are HSL objects, not numbers.
        if (track.curve.valueType === 'color' && kf.value && typeof kf.value === 'object') {
            const hsl = kf.value;
            // Hue rotation: Cauchy(30, 120) — wraps mod 360
            const hueShift = fatRng.sampleCauchy(30, 120);
            const newH = ((hsl.h + hueShift) % 360 + 360) % 360;
            // Saturation drift: Cauchy(8, 25), clamped [0, 100]
            const newS = clamp3(clamp(hsl.s + fatRng.sampleCauchy(8, 25), 0, 100), 0, 100);
            // Lightness drift: Cauchy(8, 25), clamped [0, 100]
            const newL = clamp3(clamp(hsl.l + fatRng.sampleCauchy(8, 25), 0, 100), 0, 100);
            const newHsl = { h: Math.round(newH * 10) / 10, s: newS, l: newL };
            kf.value = newHsl;
            delta.push({
                op: 'replace',
                path: `/tracks/${trackIdx}/curve/keyframes/${kfIdx}/value`,
                value: newHsl,
            });
            continue;
        }
        if (typeof kf.value !== 'number') {
            continue;
        }
        const range = track.curve.range;
        const span = range[1] - range[0];
        const oldVal = kf.value;
        // 🔬 KINETIC SECURITY (re-evaluated per track inside the loop):
        //    pan/tilt use conservative uniform magnitude.
        //    Optical channels use Cauchy-sampled magnitude for punctuated equilibrium.
        let shiftMagnitude;
        if (KINETIC_SECURE_PARAMS.has(track.paramId)) {
            // Mechanical fixture — uniform [0.20, 0.40), safe for servo/motor systems
            shiftMagnitude = 0.20 + rng() * 0.20;
        }
        else {
            // Optical channel — Cauchy(scale=0.15, maxAbs=0.60)
            //    Median |shift| ≈ 0.15, but heavy tails allow rare jumps up to 0.60·span
            shiftMagnitude = Math.min(0.60, Math.abs(fatRng.sampleCauchy(0.15, 0.60)));
        }
        const sign = rng() < 0.5 ? -1 : 1;
        const newVal = clamp(oldVal + sign * shiftMagnitude * span, range[0], range[1]);
        kf.value = newVal;
        delta.push({
            op: 'replace',
            path: `/tracks/${trackIdx}/curve/keyframes/${kfIdx}/value`,
            value: newVal,
        });
    }
    // DNA Drift: applied ONCE per invocation (not per mutation).
    // The driftScaled modifier already encodes chaos-acceleration (WAVE 7532),
    // so we must NOT multiply it by numMutations — that would triple the drift
    // on top of the chaos scaling, causing runaway genome divergence.
    if (dna && genome) {
        const newAggression = clamp3(genome.aggression + driftScaled(0.020, genome.chaos), 0, 1);
        const newChaos = clamp3(genome.chaos + driftScaled(0.020, genome.chaos), 0, 1);
        const newOrganicity = genome.organicity;
        const newGenome = {
            aggression: newAggression,
            chaos: newChaos,
            organicity: newOrganicity,
        };
        child.cognitiveDNA = {
            ...dna,
            genome: newGenome,
        };
        delta.push({
            op: 'replace',
            path: '/cognitiveDNA/genome/aggression',
            value: newAggression,
        });
        delta.push({
            op: 'replace',
            path: '/cognitiveDNA/genome/chaos',
            value: newChaos,
        });
        delta.push({
            op: 'replace',
            path: '/cognitiveDNA/genome/organicity',
            value: newOrganicity,
        });
    }
    return {
        clip: child,
        delta,
        operator: 'focal_mutation',
        l2Distance: computeL2DistanceV2(parent, child),
    };
}
// ═══════════════════════════════════════════════════════════════════════════
// OPERATOR 2: GENE AUGMENTATION (Lamarckian — replaces gene_duplication)
// ═══════════════════════════════════════════════════════════════════════════
/** Hardware parameters that gene_augmentation can inject. */
const AUGMENTABLE_PARAMS = ['intensity', 'color', 'strobe', 'pan', 'tilt', 'zoom'];
/** Canonical ranges per paramId for curve generation. */
const PARAM_RANGES = {
    intensity: [0, 1],
    color: [0, 360],
    strobe: [0, 1],
    pan: [0, 255],
    tilt: [0, 255],
    zoom: [0, 1],
};
/** 3-decimal precision clamp. */
function clamp3(v, lo, hi) {
    return Math.round(Math.max(lo, Math.min(hi, v)) * 1000) / 1000;
}
/**
 * 🔬 WAVE 7532: Lamarckian Drift Acceleration.
 *
 * Scales a base drift delta by the organism's current chaos level.
 * Formula: driftScale = 1 + (2 * chaos)
 *   chaos = 0.0 → driftScale = 1.0 (glacial, original speed)
 *   chaos = 0.5 → driftScale = 2.0 (double speed)
 *   chaos = 1.0 → driftScale = 3.0 (triple speed — rapid genomic exploration)
 *
 * This creates a positive feedback loop: chaotic organisms mutate their genomes
 * faster, which makes them more likely to produce chaotic offspring, which
 * mutate even faster. This is the Lamarckian equivalent of evolvability
 * evolution — the genome learns to evolve faster under selective pressure.
 */
function driftScaled(base, chaos) {
    return base * (1 + 2 * chaos);
}
/**
 * WAVE 7165: Lamarckian operator — injects ONE structural track with a curve
 * shaped by the parent's cognitiveDNA, then drifts the DNA itself.
 *
 * Multicellular: tracks are tracked by composite key (paramId, zones).
 * If all params are already present for all zones, the operator injects a
 * duplicate paramId targeting a COMPLEMENTARY zone to foster spatial diversity.
 */
export function geneAugmentation(parent, seed) {
    const rng = makeRng(seed ?? Date.now());
    const child = deepClone(parent);
    const delta = [];
    // Step A: Inventory existing track signatures (paramId + zones composite)
    const existingTrackKeys = new Set();
    const existingParams = new Set();
    const usedZones = new Set();
    for (const track of child.tracks) {
        existingTrackKeys.add(`${track.paramId}::${track.zones.join(',')}`);
        existingParams.add(track.paramId);
        for (const z of track.zones)
            usedZones.add(z);
    }
    // All canonical zones available for complementary injection
    const ALL_CANONICAL = ['front', 'back', 'floor', 'movers-left', 'movers-right', 'center', 'air', 'ambient'];
    // Step B: Find missing candidates — params not yet present at all
    const missingParams = AUGMENTABLE_PARAMS.filter((p) => !existingParams.has(p));
    // Step B2: If all params exist, find params that don't cover ALL zones yet
    let chosenParam;
    let injectZones;
    if (missingParams.length > 0) {
        // Classic path: inject a completely new paramId
        chosenParam = missingParams[Math.floor(rng() * missingParams.length)];
        // Use complementary zones not yet covered by this paramId
        const paramZones = new Set();
        for (const track of child.tracks) {
            if (track.paramId === chosenParam)
                for (const z of track.zones)
                    paramZones.add(z);
        }
        const unusedZones = ALL_CANONICAL.filter(z => !paramZones.has(z) && !usedZones.has(z));
        injectZones = unusedZones.length > 0
            ? [unusedZones[Math.floor(rng() * unusedZones.length)]]
            : child.tracks.length > 0 ? [...child.tracks[0].zones] : ['all'];
    }
    else {
        // WAVE 7165: Multicellular path — inject a duplicate paramId into a complementary zone
        // Find (paramId, zone) combinations not yet covered
        const candidates = [];
        for (const param of AUGMENTABLE_PARAMS) {
            const paramZones = new Set();
            for (const track of child.tracks) {
                if (track.paramId === param)
                    for (const z of track.zones)
                        paramZones.add(z);
            }
            for (const zone of ALL_CANONICAL) {
                if (!paramZones.has(zone)) {
                    candidates.push({ paramId: param, zone });
                }
            }
        }
        if (candidates.length === 0) {
            return {
                clip: child,
                delta,
                operator: 'gene_augmentation',
                l2Distance: 0,
            };
        }
        const pick = candidates[Math.floor(rng() * candidates.length)];
        chosenParam = pick.paramId;
        injectZones = [pick.zone];
    }
    const range = PARAM_RANGES[chosenParam] ?? [0, 1];
    const span = range[1] - range[0];
    const duration = child.durationMs;
    // Contextual shape: read parent's DNA aggression to decide curve character
    const dna = child.cognitiveDNA;
    const aggression = dna?.genome.aggression ?? 0.5;
    const chaos = dna?.genome.chaos ?? 0.5;
    const organicity = dna?.genome.organicity ?? 0.5;
    const isAggressive = aggression >= 0.5;
    // 🔬 WAVE 7538: RHYTHMIC GRID — keyframes snap to musical subdivisions.
    //
    // The grid divides durationMs into N equal steps. Low-chaos organisms use
    // coarse grids (2 or 4 divisions = basic pulse), high-chaos organisms use
    // fine grids (8 or 16 divisions = syncopated/stuttering pulse). This
    // transforms injected tracks from arrhythmic noise into musical groove.
    //
    // Amplifier: chaos=0.66 already maps to 1.0 (same as pleiotropy).
    const effectiveChaos = Math.min(1.0, chaos * 1.5);
    // Grid divisions: pick from a chaos-tiered menu
    let divisions;
    if (effectiveChaos < 0.33) {
        divisions = rng() < 0.5 ? 2 : 4; // basic pulse — half or quarter notes
    }
    else if (effectiveChaos < 0.66) {
        divisions = rng() < 0.5 ? 4 : 8; // moderate — quarter or eighth notes
    }
    else {
        divisions = rng() < 0.5 ? 8 : 16; // syncopated — eighth or sixteenth notes
    }
    const gridStep = duration / divisions;
    // Number of keyframes scales with chaos: 2 (conservative) to 8 (frenzy)
    const numKfs = Math.max(2, Math.min(8, 2 + Math.floor(effectiveChaos * rng() * 6)));
    // Generate keyframes snapped to grid points
    const keyframes = [];
    const usedGridIndices = new Set();
    // 🔬 ARCHETYPE SYNERGY: interpolation depends on param + DNA archetype.
    // Aggressive + strobe/intensity → hold (hard musical cuts)
    // Organic + pan/tilt/color       → bezier (smooth musical sweeps)
    // Fallback                       → linear
    const isHardCutParam = chosenParam === 'strobe' || chosenParam === 'intensity';
    const isSweepParam = chosenParam === 'pan' || chosenParam === 'tilt' || chosenParam === 'color';
    const useHoldInterp = isAggressive && isHardCutParam;
    const useBezierInterp = !isAggressive && isSweepParam && organicity > 0.4;
    for (let k = 0; k < numKfs; k++) {
        // Snap to a random grid point — ensure no duplicates
        let gridIndex;
        let attempts = 0;
        do {
            gridIndex = Math.floor(rng() * (divisions + 1)); // 0..divisions inclusive
            attempts++;
        } while (usedGridIndices.has(gridIndex) && attempts < 20);
        if (usedGridIndices.has(gridIndex)) {
            // All grid points exhausted — nudge by +1 ms to break the tie
            gridIndex = (gridIndex + 1) % (divisions + 1);
            while (usedGridIndices.has(gridIndex)) {
                gridIndex = (gridIndex + 1) % (divisions + 1);
            }
        }
        usedGridIndices.add(gridIndex);
        const timeMs = Math.round(gridIndex * gridStep);
        const tFraction = divisions > 0 ? gridIndex / divisions : 0;
        let value;
        let interpolation;
        if (chosenParam === 'strobe') {
            if (isAggressive) {
                // Sharp/fast strobe: high values, hold interpolation for choppy effect
                value = range[0] + span * (0.7 + rng() * 0.3);
                interpolation = useHoldInterp && k < numKfs - 1 ? 'hold' : 'linear';
            }
            else {
                // Slow/smooth strobe: lower values, linear interpolation
                value = range[0] + span * (0.2 + rng() * 0.3);
                interpolation = 'linear';
            }
        }
        else if (chosenParam === 'color') {
            // Color: spread across the hue range
            value = range[0] + span * tFraction;
            interpolation = useBezierInterp ? 'bezier' : 'linear';
        }
        else if (chosenParam === 'pan' || chosenParam === 'tilt') {
            if (isAggressive) {
                // Sharp positional jumps
                value = range[0] + span * (rng() < 0.5 ? 0.1 + rng() * 0.2 : 0.7 + rng() * 0.2);
                interpolation = 'hold';
            }
            else {
                // Smooth sweep
                value = range[0] + span * tFraction;
                interpolation = useBezierInterp ? 'bezier' : 'linear';
            }
        }
        else if (chosenParam === 'zoom') {
            value = isAggressive
                ? range[0] + span * (0.8 + rng() * 0.2)
                : range[0] + span * (0.3 + rng() * 0.4);
            interpolation = 'linear';
        }
        else {
            // intensity or fallback
            value = range[0] + span * (0.4 + rng() * 0.5);
            interpolation = useHoldInterp ? 'hold' : (useBezierInterp ? 'bezier' : 'linear');
        }
        value = Math.round(value * 1000) / 1000;
        const kf = { timeMs, value, interpolation };
        if (interpolation === 'bezier') {
            const presetKey = BEZIER_PRESET_KEYS[Math.floor(rng() * BEZIER_PRESET_KEYS.length)];
            kf.bezierHandles = [...BEZIER_PRESETS[presetKey]];
        }
        keyframes.push(kf);
    }
    // Sort by timeMs (invariant: keyframes must be ascending)
    keyframes.sort((a, b) => a.timeMs - b.timeMs);
    // 🔬 BOUNDARY ENFORCEMENT: ensure keyframes at t=0 and t=duration
    // These anchor the DMX curve and prevent undefined out-of-range behavior.
    if (keyframes.length === 0 || keyframes[0].timeMs > 0) {
        // Insert boundary keyframe at t=0 using the first generated value
        const firstVal = keyframes.length > 0 ? keyframes[0].value : range[0];
        keyframes.unshift({
            timeMs: 0,
            value: typeof firstVal === 'number' ? Math.round(firstVal * 1000) / 1000 : firstVal,
            interpolation: keyframes.length > 0 ? keyframes[0].interpolation : 'linear',
        });
    }
    const last = keyframes[keyframes.length - 1];
    if (last.timeMs < duration) {
        // Append boundary keyframe at t=duration holding the last value
        keyframes.push({
            timeMs: duration,
            value: last.value,
            interpolation: 'linear',
        });
    }
    // Build the new track — WAVE 7165: inject complementary zones
    const newTrack = {
        id: `aug_${chosenParam}_${Math.floor(rng() * 100000)}`,
        paramId: chosenParam,
        zones: injectZones,
        curve: {
            paramId: chosenParam,
            valueType: chosenParam === 'color' ? 'color' : 'number',
            range: [range[0], range[1]],
            defaultValue: range[0],
            keyframes,
            mode: 'absolute',
        },
    };
    // Step D: DNA Drift (Lamarckian)
    const dnaDelta = [];
    if (dna) {
        let newAggression = dna.genome.aggression;
        let newChaos = dna.genome.chaos;
        let newOrganicity = dna.genome.organicity;
        let newPressureMin = dna.pressureRange.min;
        const newPressureMax = dna.pressureRange.max;
        if (chosenParam === 'strobe') {
            newAggression = clamp3(newAggression + driftScaled(0.150, dna.genome.chaos), 0, 1);
            newChaos = clamp3(newChaos + driftScaled(0.050, dna.genome.chaos), 0, 1);
            newPressureMin = clamp3(newPressureMin + driftScaled(0.100, dna.genome.chaos), 0, 1);
        }
        else if (chosenParam === 'color') {
            newOrganicity = clamp3(newOrganicity + driftScaled(0.120, dna.genome.chaos), 0, 1);
        }
        else if (chosenParam === 'pan' || chosenParam === 'tilt') {
            newChaos = clamp3(newChaos + driftScaled(0.120, dna.genome.chaos), 0, 1);
        }
        else if (chosenParam === 'zoom') {
            newAggression = clamp3(newAggression + driftScaled(0.080, dna.genome.chaos), 0, 1);
        }
        else if (chosenParam === 'intensity') {
            newOrganicity = clamp3(newOrganicity + driftScaled(0.060, dna.genome.chaos), 0, 1);
        }
        const newGenome = {
            aggression: newAggression,
            chaos: newChaos,
            organicity: newOrganicity,
        };
        // Apply DNA mutations to the child
        child.cognitiveDNA = {
            ...dna,
            genome: newGenome,
            pressureRange: {
                min: newPressureMin,
                max: newPressureMax,
            },
        };
        // Emit delta ops for DNA
        dnaDelta.push({
            op: 'replace',
            path: '/cognitiveDNA/genome/aggression',
            value: newAggression,
        });
        dnaDelta.push({
            op: 'replace',
            path: '/cognitiveDNA/genome/chaos',
            value: newChaos,
        });
        dnaDelta.push({
            op: 'replace',
            path: '/cognitiveDNA/genome/organicity',
            value: newOrganicity,
        });
        if (newPressureMin !== dna.pressureRange.min) {
            dnaDelta.push({
                op: 'replace',
                path: '/cognitiveDNA/pressureRange/min',
                value: newPressureMin,
            });
        }
    }
    // Step E: Apply track + emit delta
    child.tracks.push(newTrack);
    delta.push({
        op: 'add',
        path: '/tracks/-',
        value: newTrack,
    });
    delta.push(...dnaDelta);
    return {
        clip: child,
        delta,
        operator: 'gene_augmentation',
        l2Distance: computeL2DistanceV2(parent, child),
    };
}
/**
 * Detects whether a track's phaseConfig has been mutated from the default.
 * Used to decide between preset application (first mutation) and incremental
 * evolution (subsequent mutations).
 */
function isDefaultPhaseConfig(pc) {
    if (!pc)
        return true;
    return pc.spreadDeg === DEFAULT_PHASE_CONFIG_PRO.spreadDeg
        && pc.wings === DEFAULT_PHASE_CONFIG_PRO.wings
        && pc.blocks === DEFAULT_PHASE_CONFIG_PRO.blocks
        && pc.shuffle === DEFAULT_PHASE_CONFIG_PRO.shuffle
        && pc.symmetry === DEFAULT_PHASE_CONFIG_PRO.symmetry;
}
/**
 * Picks exactly ONE non-color track uniformly and applies a geometric phase
 * archetype (Harmony, Chaos, Aggression) derived from the parent's cognitiveDNA.
 * Color tracks are blacklisted — color phasing creates visual mud.
 *
 * 🔬 WAVE 7532: INCREMENTAL PHASE EVOLUTION.
 *
 * If the target track has a default (or missing) phaseConfig, the operator
 * applies the archetype preset as a foundation — same as before.
 *
 * If the track already has a non-default phaseConfig, the operator mutates it
 * incrementally instead of overwriting it:
 *   - spreadDeg: ± Cauchy(15, 90) degrees, clamped to [0, 360]
 *   - shuffleSeed: derived incrementally from current seed (not random reset)
 *   - wings/blocks: occasionally adjusted by ±1 based on archetype
 *   - symmetry: occasionally flipped based on archetype
 *
 * This allows phase configurations to evolve across generations instead of
 * being reset to presets every time the operator fires.
 */
export function spatialResonance(parent, seed) {
    const rng = makeRng(seed ?? Date.now());
    const fatRng = makeFatTailedRng(rng);
    const child = deepClone(parent);
    const delta = [];
    // Step A: Democratic Target Selection — exclude color tracks
    const candidates = child.tracks
        .map((t, i) => ({ track: t, index: i }))
        .filter((t) => t.track.paramId !== 'color');
    if (candidates.length === 0) {
        return { clip: child, delta, operator: 'spatial_resonance', l2Distance: 0 };
    }
    // Uniform pick — 0 favoritism
    const pick = candidates[Math.floor(rng() * candidates.length)];
    const trackIdx = pick.index;
    const track = pick.track;
    // Step B: Archetype Phase Generation from genome
    const dna = child.cognitiveDNA;
    const genome = dna?.genome;
    const chaos = genome?.chaos ?? 0.5;
    const aggression = genome?.aggression ?? 0.5;
    const organicity = genome?.organicity ?? 0.5;
    let archetype;
    if (organicity > 0.5) {
        archetype = 'harmony';
    }
    else if (chaos > 0.6) {
        archetype = 'chaos';
    }
    else if (aggression > 0.6) {
        archetype = 'aggression';
    }
    else {
        // RNG fallback 33/33/33
        const roll = rng();
        archetype = roll < 0.33 ? 'harmony' : roll < 0.66 ? 'chaos' : 'aggression';
    }
    const existing = track.phaseConfig ?? { ...DEFAULT_PHASE_CONFIG_PRO };
    let newPhase;
    // 🔬 WAVE 7532: Check if the track already has an evolved phaseConfig
    const hasEvolvedPhase = !isDefaultPhaseConfig(track.phaseConfig);
    if (hasEvolvedPhase) {
        // ── INCREMENTAL PATH: mutate the existing phaseConfig ──
        // Cauchy delta on spreadDeg: median ±15°, occasionally ±90°
        const spreadDelta = fatRng.sampleCauchy(15, 90);
        const newSpreadDeg = clamp(Math.round(existing.spreadDeg + spreadDelta), 0, 360);
        // Derive shuffleSeed incrementally — evolve, don't reset
        const newShuffleSeed = existing.shuffleSeed + Math.floor(rng() * 1000) + 1;
        // Occasionally adjust wings/blocks by ±1 based on archetype
        let newWings = existing.wings;
        let newBlocks = existing.blocks;
        let newSymmetry = existing.symmetry;
        let newShuffle = existing.shuffle;
        let newDirection = existing.direction;
        if (archetype === 'harmony') {
            // Harmony pushes toward even wings, mirror symmetry, less shuffle
            if (rng() < 0.30)
                newWings = clamp(existing.wings + (rng() < 0.5 ? 2 : -2), 1, 8);
            if (rng() < 0.20)
                newSymmetry = 'mirror';
            newShuffle = clamp3(existing.shuffle - 0.05, 0, 1);
        }
        else if (archetype === 'chaos') {
            // Chaos pushes toward odd wings, more shuffle, more blocks
            if (rng() < 0.30)
                newWings = clamp(existing.wings + (rng() < 0.5 ? 1 : -1), 1, 8);
            if (rng() < 0.25)
                newBlocks = clamp(existing.blocks + (rng() < 0.5 ? 1 : -1), 1, 16);
            if (rng() < 0.20)
                newSymmetry = 'linear';
            newShuffle = clamp3(existing.shuffle + 0.05, 0, 1);
            if (rng() < 0.15)
                newDirection = (newDirection === 1 ? -1 : 1);
        }
        else {
            // Aggression pushes toward unified (wings=1, blocks=1, no shuffle)
            if (rng() < 0.25)
                newWings = 1;
            if (rng() < 0.25)
                newBlocks = 1;
            newShuffle = clamp3(existing.shuffle - 0.08, 0, 1);
        }
        newPhase = {
            spreadDeg: newSpreadDeg,
            wings: newWings,
            blocks: newBlocks,
            shuffle: newShuffle,
            symmetry: newSymmetry,
            shuffleSeed: newShuffleSeed,
            direction: newDirection,
        };
    }
    else {
        // ── FOUNDATION PATH: apply archetype preset (first mutation) ──
        if (archetype === 'harmony') {
            // Symmetrical and wide
            newPhase = {
                ...existing,
                spreadDeg: 360,
                wings: rng() < 0.5 ? 2 : 4, // even
                shuffle: 0,
                blocks: 1,
                symmetry: 'mirror',
                shuffleSeed: Math.floor(rng() * 100000) + 1,
                direction: 1,
            };
        }
        else if (archetype === 'chaos') {
            // Broken and asymmetrical
            newPhase = {
                ...existing,
                spreadDeg: Math.round(90 + rng() * 180), // random(90, 270)
                wings: rng() < 0.5 ? 1 : 3, // odd
                shuffle: Math.round((0.3 + rng() * 0.5) * 1000) / 1000, // random(0.3, 0.8)
                blocks: 2 + Math.floor(rng() * 3), // random(2, 4)
                symmetry: 'linear',
                shuffleSeed: Math.floor(rng() * 100000) + 1,
                direction: (rng() < 0.5 ? 1 : -1),
            };
        }
        else {
            // Aggression — unified wall/block
            newPhase = {
                ...existing,
                spreadDeg: rng() < 0.5 ? 360 : 180,
                wings: 1,
                shuffle: 0,
                blocks: 1,
                symmetry: 'linear',
                shuffleSeed: Math.floor(rng() * 100000) + 1,
                direction: 1,
            };
        }
    }
    track.phaseConfig = newPhase;
    delta.push({
        op: 'replace',
        path: `/tracks/${trackIdx}/phaseConfig`,
        value: newPhase,
    });
    // Step C: DNA Drift (3-decimal precision, 🔬 WAVE 7532: chaos-scaled)
    if (dna && genome) {
        let newAggression = genome.aggression;
        let newChaos = genome.chaos;
        let newOrganicity = genome.organicity;
        if (archetype === 'harmony') {
            newOrganicity = clamp3(newOrganicity + driftScaled(0.030, genome.chaos), 0, 1);
            newChaos = clamp3(newChaos - driftScaled(0.040, genome.chaos), 0, 1);
        }
        else if (archetype === 'chaos') {
            newChaos = clamp3(newChaos + driftScaled(0.050, genome.chaos), 0, 1);
        }
        else {
            // aggression
            newAggression = clamp3(newAggression + driftScaled(0.040, genome.chaos), 0, 1);
        }
        const newGenome = {
            aggression: newAggression,
            chaos: newChaos,
            organicity: newOrganicity,
        };
        child.cognitiveDNA = {
            ...dna,
            genome: newGenome,
        };
        delta.push({
            op: 'replace',
            path: '/cognitiveDNA/genome/aggression',
            value: newAggression,
        });
        delta.push({
            op: 'replace',
            path: '/cognitiveDNA/genome/chaos',
            value: newChaos,
        });
        delta.push({
            op: 'replace',
            path: '/cognitiveDNA/genome/organicity',
            value: newOrganicity,
        });
    }
    return {
        clip: child,
        delta,
        operator: 'spatial_resonance',
        l2Distance: computeL2DistanceV2(parent, child),
    };
}
// ═══════════════════════════════════════════════════════════════════════════
// OPERATOR 4: PROPORTIONAL STRETCH (Musical grid-safe — replaces temporal_stretch)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Stretches the entire clip by a strict musical multiplier (0.25, 0.5, 1.5, 2.0)
 * selected from the parent's cognitiveDNA. All keyframes and durationMs are
 * scaled globally, preserving internal sync and the rhythmic compás grid.
 */
export function proportionalStretch(parent, seed) {
    const rng = makeRng(seed ?? Date.now());
    const child = deepClone(parent);
    const delta = [];
    if (child.tracks.length === 0) {
        return { clip: child, delta, operator: 'proportional_stretch', l2Distance: 0 };
    }
    // Step A: Archetype Multiplier Selection from genome
    const dna = child.cognitiveDNA;
    const genome = dna?.genome;
    const chaos = genome?.chaos ?? 0.5;
    const aggression = genome?.aggression ?? 0.5;
    const organicity = genome?.organicity ?? 0.5;
    let multiplier;
    if (aggression > 0.6 || chaos > 0.5) {
        // Frenzy (Double-time): 0.5, with 20% chance of 0.25
        multiplier = rng() < 0.2 ? 0.25 : 0.5;
    }
    else if (organicity > 0.6) {
        // Lethargy (Half-time): 2.0
        multiplier = 2.0;
    }
    else if (chaos > 0.4) {
        // Syncopation: 1.5
        multiplier = 1.5;
    }
    else {
        // Fallback: uniform choice among [0.5, 1.5, 2.0]
        const choices = [0.5, 1.5, 2.0];
        multiplier = choices[Math.floor(rng() * choices.length)];
    }
    // Step B: Global Application — stretch ALL tracks and ALL keyframes
    child.durationMs = Math.round(parent.durationMs * multiplier);
    delta.push({
        op: 'replace',
        path: '/durationMs',
        value: child.durationMs,
    });
    for (let t = 0; t < child.tracks.length; t++) {
        const track = child.tracks[t];
        for (let k = 0; k < track.curve.keyframes.length; k++) {
            const kf = track.curve.keyframes[k];
            const newTime = Math.round(kf.timeMs * multiplier);
            kf.timeMs = newTime;
            delta.push({
                op: 'replace',
                path: `/tracks/${t}/curve/keyframes/${k}/timeMs`,
                value: newTime,
            });
        }
        // Enforce sort (mathematically preserved, but guard against rounding edge cases)
        track.curve.keyframes.sort((a, b) => a.timeMs - b.timeMs);
    }
    // Step C: DNA Drift (3-decimal precision)
    if (dna && genome) {
        let newAggression = genome.aggression;
        let newChaos = genome.chaos;
        let newOrganicity = genome.organicity;
        if (multiplier < 1.0) {
            // Faster
            newAggression = clamp3(newAggression + driftScaled(0.050, genome.chaos), 0, 1);
            newChaos = clamp3(newChaos + driftScaled(0.030, genome.chaos), 0, 1);
        }
        else {
            // Slower
            newOrganicity = clamp3(newOrganicity + driftScaled(0.060, genome.chaos), 0, 1);
            newAggression = clamp3(newAggression - driftScaled(0.040, genome.chaos), 0, 1);
        }
        const newGenome = {
            aggression: newAggression,
            chaos: newChaos,
            organicity: newOrganicity,
        };
        child.cognitiveDNA = {
            ...dna,
            genome: newGenome,
        };
        delta.push({
            op: 'replace',
            path: '/cognitiveDNA/genome/aggression',
            value: newAggression,
        });
        delta.push({
            op: 'replace',
            path: '/cognitiveDNA/genome/chaos',
            value: newChaos,
        });
        delta.push({
            op: 'replace',
            path: '/cognitiveDNA/genome/organicity',
            value: newOrganicity,
        });
    }
    return {
        clip: child,
        delta,
        operator: 'proportional_stretch',
        l2Distance: computeL2DistanceV2(parent, child),
    };
}
// ═══════════════════════════════════════════════════════════════════════════
// OPERATOR 5: MACRO SPLICE (Impact Mutation — replaces gene_splice)
// ═══════════════════════════════════════════════════════════════════════════
const BEZIER_PRESET_KEYS = Object.keys(BEZIER_PRESETS);
/**
 * Inserts a purposeful 2-keyframe "macro block" (Stutter, Peak, or Breath)
 * into a temporal gap of a numeric track. The archetype is selected from the
 * parent's cognitiveDNA genome, and the DNA is drifted accordingly.
 *
 * 🔬 WAVE 7531: PUNCTUATED EQUILIBRIUM + KINETIC SECURITY.
 *
 * Gap threshold reduced from 300ms → 150ms to give more insertion opportunities.
 *
 * For optical channels (intensity, color, strobe, zoom): block values and widths
 * use fat-tailed distributions (Cauchy/Pareto). This means:
 *   - Stutter: occasionally drops to absolute 0 or sustains for 200ms (Pareto width)
 *   - Peak: occasionally hits range[1] (full intensity) with Cauchy-sampled magnitude
 *   - Breath: occasionally dips to range[0] (full blackout) with wider Cauchy
 *
 * For kinetic channels (pan, tilt): block values and widths remain conservative
 * uniform distributions. A stutter on a pan track drops by 0.20·span (not to 0),
 * protecting the moving head from a 255° instantaneous jump.
 */
export function macroSplice(parent, seed) {
    const rng = makeRng(seed ?? Date.now());
    const fatRng = makeFatTailedRng(rng);
    const child = deepClone(parent);
    const delta = [];
    // Step A: Find numeric tracks with ≥2 keyframes and a gap > 150ms
    // 🔬 WAVE 7531: Reduced from 300ms → 150ms for more insertion opportunities.
    const numericTracks = child.tracks
        .map((t, i) => ({ track: t, index: i }))
        .filter((t) => t.track.curve.valueType === 'number' && t.track.curve.keyframes.length >= 2);
    if (numericTracks.length === 0) {
        return { clip: child, delta, operator: 'macro_splice', l2Distance: 0 };
    }
    // Collect all valid gaps across all numeric tracks
    const candidateGaps = [];
    for (const pick of numericTracks) {
        const kfs = pick.track.curve.keyframes;
        for (let g = 0; g < kfs.length - 1; g++) {
            const gapMs = kfs[g + 1].timeMs - kfs[g].timeMs;
            if (gapMs > 150) {
                candidateGaps.push({ trackIdx: pick.index, gapIdx: g, gapMs });
            }
        }
    }
    if (candidateGaps.length === 0) {
        return { clip: child, delta, operator: 'macro_splice', l2Distance: 0 };
    }
    // Step B: Archetype Selection from genome
    const dna = child.cognitiveDNA;
    const genome = dna?.genome;
    const chaos = genome?.chaos ?? 0.5;
    const aggression = genome?.aggression ?? 0.5;
    const organicity = genome?.organicity ?? 0.5;
    // 🔬 WAVE 7536: PLEIOTROPY — number of simultaneous splices scaled by chaos.
    // Amplifier: chaos=0.66 already maps to 1.0 (same as focal_mutation).
    //   effectiveChaos=0.0 → always 1 splice (conservative)
    //   effectiveChaos=0.5 → 1-2 splices (moderate)
    //   effectiveChaos=1.0 → 1-2 splices (high-chaos organisms insert multiple blocks)
    const effectiveChaos = Math.min(1.0, chaos * 1.5);
    const maxSplices = 1 + Math.floor(effectiveChaos * rng() * 2);
    // Deterministic Fisher-Yates shuffle of the gap list using our rng.
    // This ensures reproducible offspring from the same seed while allowing
    // multiple distinct gaps to be selected in a single invocation.
    for (let i = candidateGaps.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = candidateGaps[i];
        candidateGaps[i] = candidateGaps[j];
        candidateGaps[j] = tmp;
    }
    const numSplices = Math.min(maxSplices, candidateGaps.length);
    // Accumulate DNA drift contributions across all splices, apply ONCE at end.
    let driftAggression = 0;
    let driftChaos = 0;
    let driftOrganicity = 0;
    let appliedSpliceCount = 0;
    for (let s = 0; s < numSplices; s++) {
        const chosen = candidateGaps[s];
        const track = child.tracks[chosen.trackIdx];
        const trackIdx = chosen.trackIdx;
        const kfs = track.curve.keyframes;
        const gapIdx = chosen.gapIdx;
        const range = track.curve.range;
        const span = range[1] - range[0];
        const kfA = kfs[gapIdx];
        const kfB = kfs[gapIdx + 1];
        const valA = kfA.value;
        const valB = kfB.value;
        if (typeof valA !== 'number' || typeof valB !== 'number') {
            continue;
        }
        // Per-splice archetype selection (same genome, but rng rolls each time)
        let archetype;
        if (chaos > 0.6) {
            archetype = 'stutter';
        }
        else if (aggression > 0.5) {
            archetype = 'peak';
        }
        else if (organicity > 0.5) {
            archetype = 'breath';
        }
        else {
            const roll = rng();
            archetype = roll < 0.33 ? 'stutter' : roll < 0.66 ? 'peak' : 'breath';
        }
        // 🔬 KINETIC SECURITY (re-evaluated per track inside the loop):
        //    Each splice checks whether the current track is mechanical (pan/tilt).
        //    Even during a multi-splice frenzy, physical fixtures are never subjected
        //    to Cauchy/Pareto bounds.
        const isKinetic = KINETIC_SECURE_PARAMS.has(track.paramId);
        // Step C: Injection — create 2 keyframes (start and end of macro block)
        const gapStart = kfA.timeMs;
        const gapEnd = kfB.timeMs;
        const gapMid = Math.round((gapStart + gapEnd) / 2);
        const gapMs = chosen.gapMs;
        let blockStartMs;
        let blockEndMs;
        let blockValue;
        let blockInterp;
        if (archetype === 'stutter') {
            // Tight block dropping value, hold interpolation
            if (isKinetic) {
                // 🔬 KINETIC SECURITY: conservative uniform, drop by 0.20·span (NOT to 0)
                const blockWidth = 80 + Math.floor(rng() * 41); // 80-120ms
                blockStartMs = gapMid - Math.round(blockWidth / 2);
                blockEndMs = blockStartMs + blockWidth;
                blockValue = clamp((typeof valA === 'number' ? valA : range[0]) - 0.20 * span, range[0], range[1]);
                blockInterp = 'hold';
            }
            else {
                // 🔬 OPTICAL CHAOS: Pareto width (occasionally 200ms+), Cauchy drop magnitude
                const blockWidth = Math.min(gapMs - 2, Math.floor(fatRng.samplePareto(80, 2.5)));
                blockStartMs = gapMid - Math.round(blockWidth / 2);
                blockEndMs = blockStartMs + blockWidth;
                // Cauchy drop: median ~0.30·span, but occasionally drops to absolute 0
                const dropMag = Math.min(1.0, Math.abs(fatRng.sampleCauchy(0.30, 1.0)));
                blockValue = clamp((typeof valA === 'number' ? valA : range[0]) - dropMag * span, range[0], range[1]);
                blockInterp = 'hold';
            }
        }
        else if (archetype === 'peak') {
            // Spike block
            if (isKinetic) {
                // 🔬 KINETIC SECURITY: conservative uniform +0.40·span
                const blockWidth = 150 + Math.floor(rng() * 51); // 150-200ms
                blockStartMs = gapMid - Math.round(blockWidth / 2);
                blockEndMs = blockStartMs + blockWidth;
                const peakVal = (typeof valA === 'number' ? valA : range[0]) + 0.40 * span;
                blockValue = clamp(peakVal, range[0], range[1]);
                blockInterp = rng() < 0.5 ? 'linear' : 'hold';
            }
            else {
                // 🔬 OPTICAL CHAOS: Cauchy spike magnitude (occasionally hits range[1])
                const blockWidth = 150 + Math.floor(rng() * 101); // 150-250ms (widened)
                blockStartMs = gapMid - Math.round(blockWidth / 2);
                blockEndMs = blockStartMs + blockWidth;
                const peakMag = Math.min(1.0, Math.abs(fatRng.sampleCauchy(0.35, 0.90)));
                const peakVal = (typeof valA === 'number' ? valA : range[0]) + peakMag * span;
                blockValue = clamp(peakVal, range[0], range[1]);
                blockInterp = rng() < 0.5 ? 'linear' : 'hold';
            }
        }
        else {
            // Breath: smooth dip
            if (isKinetic) {
                // 🔬 KINETIC SECURITY: conservative uniform -0.30·span
                const blockWidth = 300 + Math.floor(rng() * 200); // 300-500ms
                blockStartMs = gapMid - Math.round(blockWidth / 2);
                blockEndMs = blockStartMs + blockWidth;
                const breathVal = (typeof valA === 'number' ? valA : range[1]) - 0.30 * span;
                blockValue = clamp(breathVal, range[0], range[1]);
                blockInterp = 'bezier';
            }
            else {
                // 🔬 OPTICAL CHAOS: Cauchy dip (occasionally to absolute 0), Pareto width
                const blockWidth = Math.min(gapMs - 2, Math.floor(fatRng.samplePareto(250, 2.0)));
                blockStartMs = gapMid - Math.round(blockWidth / 2);
                blockEndMs = blockStartMs + blockWidth;
                const dipMag = Math.min(1.0, Math.abs(fatRng.sampleCauchy(0.30, 0.90)));
                const breathVal = (typeof valA === 'number' ? valA : range[1]) - dipMag * span;
                blockValue = clamp(breathVal, range[0], range[1]);
                blockInterp = 'bezier';
            }
        }
        // Clamp block times within the gap
        blockStartMs = Math.max(blockStartMs, gapStart + 1);
        blockEndMs = Math.min(blockEndMs, gapEnd - 1);
        if (blockEndMs <= blockStartMs) {
            blockEndMs = blockStartMs + 1;
        }
        const blockValueRounded = Math.round(blockValue * 1000) / 1000;
        // Create the 2 keyframes
        const kfStart = {
            timeMs: blockStartMs,
            value: blockValueRounded,
            interpolation: blockInterp,
        };
        // End keyframe: restore to interpolated value at blockEnd position
        const tFractionEnd = (blockEndMs - gapStart) / (gapEnd - gapStart);
        const restoredValue = Math.round((valA + (valB - valA) * tFractionEnd) * 1000) / 1000;
        const kfEnd = {
            timeMs: blockEndMs,
            value: restoredValue,
            interpolation: kfA.interpolation, // restore original interpolation
        };
        if (blockInterp === 'bezier') {
            const presetKey = BEZIER_PRESET_KEYS[Math.floor(rng() * BEZIER_PRESET_KEYS.length)];
            kfStart.bezierHandles = [...BEZIER_PRESETS[presetKey]];
        }
        // Insert keyframes maintaining ascending timeMs order
        // Find insertion index for kfStart
        let insertIdxStart = gapIdx + 1;
        while (insertIdxStart < kfs.length && kfs[insertIdxStart].timeMs < kfStart.timeMs) {
            insertIdxStart++;
        }
        kfs.splice(insertIdxStart, 0, kfStart);
        delta.push({
            op: 'add',
            path: `/tracks/${trackIdx}/curve/keyframes/${insertIdxStart}`,
            value: kfStart,
        });
        // Find insertion index for kfEnd (after kfStart)
        let insertIdxEnd = insertIdxStart + 1;
        while (insertIdxEnd < kfs.length && kfs[insertIdxEnd].timeMs < kfEnd.timeMs) {
            insertIdxEnd++;
        }
        kfs.splice(insertIdxEnd, 0, kfEnd);
        delta.push({
            op: 'add',
            path: `/tracks/${trackIdx}/curve/keyframes/${insertIdxEnd}`,
            value: kfEnd,
        });
        // Accumulate DNA drift contributions (applied ONCE after the loop)
        if (archetype === 'stutter') {
            driftChaos += 0.050;
            driftOrganicity -= 0.020;
        }
        else if (archetype === 'peak') {
            driftAggression += 0.060;
        }
        else {
            // breath
            driftOrganicity += 0.050;
            driftAggression -= 0.030;
        }
        appliedSpliceCount++;
    }
    // Step D: DNA Drift — applied ONCE, consolidating all splice contributions.
    // The driftScaled modifier already encodes chaos-acceleration (WAVE 7532),
    // so we apply the SUM of archetype drifts through a single driftScaled call.
    // This prevents runaway genome divergence from multi-splice frenzies while
    // still rewarding high-chaos organisms with faster drift.
    if (dna && genome && appliedSpliceCount > 0) {
        // Average the drift across splices to keep magnitude consistent regardless
        // of pleiotropy count — a 2-splice frenzy drifts the same total as a
        // 1-splice invocation, just distributed across more archetype axes.
        const avgDriftA = driftAggression / appliedSpliceCount;
        const avgDriftC = driftChaos / appliedSpliceCount;
        const avgDriftO = driftOrganicity / appliedSpliceCount;
        const newAggression = clamp3(genome.aggression + driftScaled(avgDriftA, genome.chaos), 0, 1);
        const newChaos = clamp3(genome.chaos + driftScaled(avgDriftC, genome.chaos), 0, 1);
        const newOrganicity = clamp3(genome.organicity + driftScaled(avgDriftO, genome.chaos), 0, 1);
        const newGenome = {
            aggression: newAggression,
            chaos: newChaos,
            organicity: newOrganicity,
        };
        child.cognitiveDNA = {
            ...dna,
            genome: newGenome,
        };
        delta.push({
            op: 'replace',
            path: '/cognitiveDNA/genome/aggression',
            value: newAggression,
        });
        delta.push({
            op: 'replace',
            path: '/cognitiveDNA/genome/chaos',
            value: newChaos,
        });
        delta.push({
            op: 'replace',
            path: '/cognitiveDNA/genome/organicity',
            value: newOrganicity,
        });
    }
    return {
        clip: child,
        delta,
        operator: 'macro_splice',
        l2Distance: computeL2DistanceV2(parent, child),
    };
}
// ═══════════════════════════════════════════════════════════════════════════
// OPERATOR 6: ADAPTIVE PRUNING (Smart janitor — replaces gene_deletion)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Smart janitor that removes dead tracks (value range < 0.05) or redundant
 * keyframes (3 consecutive with variance < 0.05). Never deletes the only
 * intensity track. Clean code means less chaos.
 */
export function adaptivePruning(parent, seed) {
    const rng = makeRng(seed ?? Date.now());
    const child = deepClone(parent);
    const delta = [];
    if (child.tracks.length === 0) {
        return { clip: child, delta, operator: 'adaptive_pruning', l2Distance: 0 };
    }
    // Step 1: Look for dead tracks (max - min < threshold across all keyframes)
    // Protected tracks (intensity, color, pan, tilt) require variance = 0.00 to be pruned.
    // Non-protected tracks use the standard 0.05 threshold.
    // WAVE 7165: Zone-aware protection — don't prune the last track covering a (paramId, zone) pair.
    const PROTECTED_TRACKS = new Set(['intensity', 'color', 'pan', 'tilt']);
    // Build a map of (paramId::zone) → count of tracks covering that pair
    const zoneCoverage = new Map();
    for (const track of child.tracks) {
        for (const zone of track.zones) {
            const key = `${track.paramId}::${zone}`;
            zoneCoverage.set(key, (zoneCoverage.get(key) ?? 0) + 1);
        }
    }
    const deadTracks = child.tracks
        .map((t, i) => ({ track: t, index: i }))
        .filter((t) => {
        const kfs = t.track.curve.keyframes;
        if (kfs.length === 0)
            return true;
        const values = kfs.map((k) => (typeof k.value === 'number' ? k.value : 0));
        const max = Math.max(...values);
        const min = Math.min(...values);
        const range = max - min;
        // Protected tracks: only prune if literally flat (variance = 0.00)
        if (PROTECTED_TRACKS.has(t.track.paramId)) {
            if (range !== 0)
                return false;
        }
        else {
            if (range >= 0.05)
                return false;
        }
        // WAVE 7165: Don't prune if this is the only track covering any of its (paramId, zone) pairs
        for (const zone of t.track.zones) {
            const key = `${t.track.paramId}::${zone}`;
            if ((zoneCoverage.get(key) ?? 0) <= 1)
                return false;
        }
        return true;
    });
    if (deadTracks.length > 0) {
        // Delete one dead track
        const pick = deadTracks[Math.floor(rng() * deadTracks.length)];
        child.tracks.splice(pick.index, 1);
        delta.push({
            op: 'remove',
            path: `/tracks/${pick.index}`,
        });
        // DNA Drift: chaos -0.040, organicity +0.030 (🔬 WAVE 7532: chaos-scaled)
        const dna = child.cognitiveDNA;
        const genome = dna?.genome;
        if (dna && genome) {
            const newChaos = clamp3(genome.chaos - driftScaled(0.040, genome.chaos), 0, 1);
            const newOrganicity = clamp3(genome.organicity + driftScaled(0.030, genome.chaos), 0, 1);
            const newAggression = genome.aggression;
            child.cognitiveDNA = {
                ...dna,
                genome: { aggression: newAggression, chaos: newChaos, organicity: newOrganicity },
            };
            delta.push({ op: 'replace', path: '/cognitiveDNA/genome/aggression', value: newAggression });
            delta.push({ op: 'replace', path: '/cognitiveDNA/genome/chaos', value: newChaos });
            delta.push({ op: 'replace', path: '/cognitiveDNA/genome/organicity', value: newOrganicity });
        }
        return {
            clip: child,
            delta,
            operator: 'adaptive_pruning',
            l2Distance: computeL2DistanceV2(parent, child),
        };
    }
    // Step 2: Look for redundant keyframes (3 consecutive with variance < 0.05)
    const candidates = [];
    for (let t = 0; t < child.tracks.length; t++) {
        const kfs = child.tracks[t].curve.keyframes;
        for (let k = 1; k < kfs.length - 1; k++) {
            const v0 = kfs[k - 1].value;
            const v1 = kfs[k].value;
            const v2 = kfs[k + 1].value;
            if (typeof v0 !== 'number' || typeof v1 !== 'number' || typeof v2 !== 'number')
                continue;
            const max = Math.max(v0, v1, v2);
            const min = Math.min(v0, v1, v2);
            if ((max - min) < 0.05) {
                candidates.push({ trackIdx: t, kfIdx: k });
            }
        }
    }
    if (candidates.length > 0) {
        const pick = candidates[Math.floor(rng() * candidates.length)];
        child.tracks[pick.trackIdx].curve.keyframes.splice(pick.kfIdx, 1);
        delta.push({
            op: 'remove',
            path: `/tracks/${pick.trackIdx}/curve/keyframes/${pick.kfIdx}`,
        });
        // DNA Drift: chaos -0.040, organicity +0.030 (🔬 WAVE 7532: chaos-scaled)
        const dna = child.cognitiveDNA;
        const genome = dna?.genome;
        if (dna && genome) {
            const newChaos = clamp3(genome.chaos - driftScaled(0.040, genome.chaos), 0, 1);
            const newOrganicity = clamp3(genome.organicity + driftScaled(0.030, genome.chaos), 0, 1);
            const newAggression = genome.aggression;
            child.cognitiveDNA = {
                ...dna,
                genome: { aggression: newAggression, chaos: newChaos, organicity: newOrganicity },
            };
            delta.push({ op: 'replace', path: '/cognitiveDNA/genome/aggression', value: newAggression });
            delta.push({ op: 'replace', path: '/cognitiveDNA/genome/chaos', value: newChaos });
            delta.push({ op: 'replace', path: '/cognitiveDNA/genome/organicity', value: newOrganicity });
        }
        return {
            clip: child,
            delta,
            operator: 'adaptive_pruning',
            l2Distance: computeL2DistanceV2(parent, child),
        };
    }
    // Step 3: Nothing to prune
    return { clip: child, delta, operator: 'adaptive_pruning', l2Distance: 0 };
}
// ═══════════════════════════════════════════════════════════════════════════
// OPERATOR 7: CURVE ADAPTATION (DNA-driven — replaces interpolation_drift)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Changes the interpolation type of a random keyframe based on the parent's
 * cognitiveDNA. Organicity → bezier, aggression/chaos → hold, fallback → linear.
 * No Markov transition matrix or Cauchy handle perturbation.
 */
export function curveAdaptation(parent, seed) {
    const rng = makeRng(seed ?? Date.now());
    const child = deepClone(parent);
    const delta = [];
    const eligibleTracks = child.tracks
        .map((t, i) => ({ track: t, index: i }))
        .filter((t) => t.track.curve.keyframes.length >= 2);
    if (eligibleTracks.length === 0) {
        return { clip: child, delta, operator: 'curve_adaptation', l2Distance: 0 };
    }
    const pick = eligibleTracks[Math.floor(rng() * eligibleTracks.length)];
    const track = pick.track;
    const trackIdx = pick.index;
    const kfs = track.curve.keyframes;
    // Exclude last keyframe (interpolation defines transition TO next)
    const kfIdx = Math.floor(rng() * (kfs.length - 1));
    const kf = kfs[kfIdx];
    const currentInterp = kf.interpolation;
    // DNA-driven target interpolation
    const dna = child.cognitiveDNA;
    const genome = dna?.genome;
    const aggression = genome?.aggression ?? 0.5;
    const chaos = genome?.chaos ?? 0.5;
    const organicity = genome?.organicity ?? 0.5;
    let newInterp;
    if (organicity > 0.5) {
        newInterp = 'bezier';
    }
    else if (aggression > 0.5 || chaos > 0.5) {
        newInterp = 'hold';
    }
    else {
        newInterp = 'linear';
    }
    if (newInterp === currentInterp) {
        return { clip: child, delta, operator: 'curve_adaptation', l2Distance: 0 };
    }
    kf.interpolation = newInterp;
    delta.push({
        op: 'replace',
        path: `/tracks/${trackIdx}/curve/keyframes/${kfIdx}/interpolation`,
        value: newInterp,
    });
    if (newInterp === 'bezier') {
        // Generate default bezier handles from preset
        const presetKey = BEZIER_PRESET_KEYS[Math.floor(rng() * BEZIER_PRESET_KEYS.length)];
        const handles = [...BEZIER_PRESETS[presetKey]];
        kf.bezierHandles = handles;
        delta.push({
            op: 'replace',
            path: `/tracks/${trackIdx}/curve/keyframes/${kfIdx}/bezierHandles`,
            value: handles,
        });
    }
    else {
        // Leaving bezier — remove handles if present
        if (kf.bezierHandles) {
            delete kf.bezierHandles;
            delta.push({
                op: 'remove',
                path: `/tracks/${trackIdx}/curve/keyframes/${kfIdx}/bezierHandles`,
            });
        }
    }
    // DNA Drift
    if (dna && genome) {
        let newAggression = genome.aggression;
        let newChaos = genome.chaos;
        let newOrganicity = genome.organicity;
        if (newInterp === 'bezier') {
            newOrganicity = clamp3(newOrganicity + driftScaled(0.040, genome.chaos), 0, 1);
        }
        else if (newInterp === 'hold') {
            newChaos = clamp3(newChaos + driftScaled(0.030, genome.chaos), 0, 1);
            newAggression = clamp3(newAggression + driftScaled(0.020, genome.chaos), 0, 1);
        }
        child.cognitiveDNA = {
            ...dna,
            genome: { aggression: newAggression, chaos: newChaos, organicity: newOrganicity },
        };
        delta.push({ op: 'replace', path: '/cognitiveDNA/genome/aggression', value: newAggression });
        delta.push({ op: 'replace', path: '/cognitiveDNA/genome/chaos', value: newChaos });
        delta.push({ op: 'replace', path: '/cognitiveDNA/genome/organicity', value: newOrganicity });
    }
    return {
        clip: child,
        delta,
        operator: 'curve_adaptation',
        l2Distance: computeL2DistanceV2(parent, child),
    };
}
/**
 * Blends cognitiveDNA from two parents, weighting numeric genome 70/30
 * toward the dominant parent. Unions lists (compatibleVibes, validSections).
 * Tolerance ranges (pressureRange, aggressionRange) are AVERAGED, not
 * outer-enveloped, to prevent range inflation across generations.
 * G4 PRE-SCREENING: if unioned energyZone span > 2, collapses to dominant's range.
 */
export function blendCognitiveDNA(dnaA, dnaB, dominant) {
    const dom = dominant === 'A' ? dnaA : dnaB;
    const sub = dominant === 'A' ? dnaB : dnaA;
    // WAVE 6000.V3 hardening: legacy/corrupt organisms may carry cognitiveDNA
    // missing required ranges (energyZone / aggressionRange / pressureRange).
    // If the dominant parent itself is missing the genome, we cannot blend
    // safely — bail out with a minimal clone of whatever dominant has.
    if (!dom || !dom.genome) {
        return { ...(dom ?? sub) };
    }
    // Defensive genome blending — sub may be missing genome fields.
    const subGenome = sub?.genome;
    const genome = {
        aggression: clamp3(0.7 * dom.genome.aggression + 0.3 * (subGenome?.aggression ?? dom.genome.aggression), 0, 1),
        chaos: clamp3(0.7 * dom.genome.chaos + 0.3 * (subGenome?.chaos ?? dom.genome.chaos), 0, 1),
        organicity: clamp3(0.7 * dom.genome.organicity + 0.3 * (subGenome?.organicity ?? dom.genome.organicity), 0, 1),
    };
    const textureAffinity = dom.textureAffinity;
    const spatialBehavior = dom.spatialBehavior;
    const compatibleVibes = [...new Set([
            ...(dnaA?.compatibleVibes ?? []),
            ...(dnaB?.compatibleVibes ?? []),
        ])];
    const validSections = [...new Set([
            ...(dnaA?.validSections ?? []),
            ...(dnaB?.validSections ?? []),
        ])];
    // G4 PRE-SCREENING: check zoneSpan of unioned range.
    // Fall back to dominant's energyZone if either parent is missing it or
    // carries an out-of-index zone label.
    const domZone = dom.energyZone;
    const subZone = sub?.energyZone;
    const domMinIdx = domZone ? ENERGY_ZONES.indexOf(domZone.min) : -1;
    const domMaxIdx = domZone ? ENERGY_ZONES.indexOf(domZone.max) : -1;
    const subMinIdx = subZone ? ENERGY_ZONES.indexOf(subZone.min) : -1;
    const subMaxIdx = subZone ? ENERGY_ZONES.indexOf(subZone.max) : -1;
    let energyZone;
    if (domMinIdx < 0 || domMaxIdx < 0) {
        // Dominant's energyZone is unusable — use a conservative default.
        energyZone = domZone ?? { min: ENERGY_ZONES[0], max: ENERGY_ZONES[0] };
    }
    else if (subMinIdx < 0 || subMaxIdx < 0) {
        // Sub missing/unusable energyZone — inherit dominant's verbatim.
        energyZone = domZone;
    }
    else {
        const unionMinIdx = Math.min(domMinIdx, subMinIdx);
        const unionMaxIdx = Math.max(domMaxIdx, subMaxIdx);
        const unionSpan = unionMaxIdx - unionMinIdx + 1;
        energyZone = unionSpan > 2
            ? domZone
            : {
                min: ENERGY_ZONES[Math.max(0, unionMinIdx)],
                max: ENERGY_ZONES[Math.min(ENERGY_ZONES.length - 1, unionMaxIdx)],
            };
    }
    // AVERAGE tolerance ranges — prevents inflation across generations.
    // If either parent is missing a range, inherit the dominant's verbatim
    // rather than crashing or fabricating values from undefined.
    const domAgg = dom.aggressionRange;
    const subAgg = sub?.aggressionRange;
    const aggressionRange = domAgg && subAgg
        ? {
            min: (domAgg.min + subAgg.min) / 2,
            max: (domAgg.max + subAgg.max) / 2,
        }
        : { ...(domAgg ?? { min: 0, max: 1 }) };
    const domPres = dom.pressureRange;
    const subPres = sub?.pressureRange;
    const pressureRange = domPres && subPres
        ? {
            min: (domPres.min + subPres.min) / 2,
            max: (domPres.max + subPres.max) / 2,
        }
        : { ...(domPres ?? { min: 0, max: 1 }) };
    return {
        genome,
        textureAffinity,
        compatibleVibes,
        validSections,
        energyZone,
        aggressionRange,
        pressureRange,
        spatialBehavior,
        ikCompatibility: dom.ikCompatibility,
        executionDomain: dom.executionDomain,
    };
}
/**
 * Sexual reproduction operator — keyframe-level 1-point crossover on matching
 * tracks, with whole-track inheritance for non-matching tracks.
 *
 * 🔬 WAVE 7537: KEYFRAME-LEVEL CROSSOVER.
 *
 * When both parents have a track with the same `paramId::zones` key, the
 * offspring inherits a temporal splice: keyframes up to a crossover point T
 * come from the Dominant parent, and keyframes after T come from the
 * Recessive parent. This enables true genetic recombination — the offspring
 * can inherit, say, the buildup phase from parent A and the drop phase from
 * parent B, creating genuinely novel DMX curves.
 *
 * The crossover point T is randomly placed in the middle 40% of the clip
 * (0.3–0.7 of durationMs) to avoid trivial splits. Boundary keyframes at
 * time 0 and time durationMs are ensured by clamping or inserting synthetic
 * keyframes if the split leaves a gap at either end.
 *
 * Tracks that exist in only one parent retain the original whole-track
 * inheritance logic (Dominant tracks always pass; Recessive tracks pass
 * only if the slot is empty).
 *
 * L2 = average(distance to A, distance to B) — the offspring is genetically
 * novel compared to BOTH parents, and the rarity engine must reward this
 * true hybridization rather than penalizing it with the conservative min.
 */
export function crossover(parentA, parentB, fitnessA, fitnessB, seed) {
    const rng = makeRng(seed ?? Date.now());
    const dominant = fitnessA >= fitnessB ? 'A' : 'B';
    const dominantClip = dominant === 'A' ? parentA : parentB;
    const submissiveClip = dominant === 'A' ? parentB : parentA;
    // Child duration is the average of both parents — the temporal canvas
    // onto which keyframes from both parents will be mapped.
    const childDurationMs = Math.round((parentA.durationMs + parentB.durationMs) / 2);
    // 🔬 WAVE 7537: Crossover point T — middle 40% of the clip (0.3–0.7)
    const crossoverPoint = Math.round(childDurationMs * (0.3 + rng() * 0.4));
    // WAVE 7165: Multicellular crossover — use composite key paramId::zones
    // to allow submissive parent to contribute tracks with same paramId but different zones.
    const childTracks = [];
    const seenTrackKeys = new Set();
    // Build a lookup of submissive tracks by composite key for matching
    const submissiveByKey = new Map();
    for (const track of submissiveClip.tracks) {
        submissiveByKey.set(`${track.paramId}::${track.zones.join(',')}`, track);
    }
    // Process dominant tracks first
    for (const domTrack of dominantClip.tracks) {
        const key = `${domTrack.paramId}::${domTrack.zones.join(',')}`;
        const subTrack = submissiveByKey.get(key);
        if (subTrack && domTrack.curve.valueType === 'number' && subTrack.curve.valueType === 'number') {
            // 🔬 WAVE 7537: KEYFRAME-LEVEL CROSSOVER on matching numeric tracks.
            // Dominant half: keyframes with relativeTime <= crossoverPoint
            // Recessive half: keyframes with relativeTime > crossoverPoint
            const hybridTrack = crossoverKeyframes(domTrack, subTrack, crossoverPoint, childDurationMs, rng);
            childTracks.push(hybridTrack);
        }
        else {
            // No matching submissive track, or non-numeric — inherit whole dominant track
            const cloned = deepClone(domTrack);
            // Rescale keyframe times if child duration differs
            rescaleKeyframeTimes(cloned, dominantClip.durationMs, childDurationMs);
            childTracks.push(cloned);
        }
        seenTrackKeys.add(key);
    }
    // Add submissive tracks that don't match any dominant track (whole inheritance)
    for (const track of submissiveClip.tracks) {
        const key = `${track.paramId}::${track.zones.join(',')}`;
        if (!seenTrackKeys.has(key)) {
            const cloned = deepClone(track);
            rescaleKeyframeTimes(cloned, submissiveClip.durationMs, childDurationMs);
            childTracks.push(cloned);
            seenTrackKeys.add(key);
        }
    }
    // Build child clip from dominant parent as base
    const child = deepClone(dominantClip);
    child.tracks = childTracks;
    child.durationMs = childDurationMs;
    // Union spatialZones
    const zoneSet = new Set([
        ...parentA.spatialZones.map(String),
        ...parentB.spatialZones.map(String),
    ]);
    child.spatialZones = [...zoneSet];
    // Blend cognitiveDNA
    if (parentA.cognitiveDNA && parentB.cognitiveDNA) {
        child.cognitiveDNA = blendCognitiveDNA(parentA.cognitiveDNA, parentB.cognitiveDNA, dominant);
    }
    // Delta: bulk replace of tracks + cognitiveDNA on dominant parent
    const delta = [
        { op: 'replace', path: '/tracks', value: childTracks },
        { op: 'replace', path: '/durationMs', value: child.durationMs },
    ];
    if (child.cognitiveDNA) {
        delta.push({ op: 'replace', path: '/cognitiveDNA', value: child.cognitiveDNA });
    }
    // 🔬 WAVE 7537: L2 = average distance to both parents.
    // The offspring is genetically novel compared to BOTH parents — the
    // conservative Math.min() unfairly penalized true hybridization by
    // measuring only against the closer parent. The average rewards the
    // recombination: an offspring that is equidistant from both parents
    // (perfect hybrid) gets a higher L2 than one that closely resembles one.
    const l2A = computeL2DistanceV2(parentA, child);
    const l2B = computeL2DistanceV2(parentB, child);
    const l2Distance = (l2A + l2B) / 2;
    return {
        clip: child,
        delta,
        operator: 'crossover',
        l2Distance,
        dominantParent: dominant,
    };
}
/**
 * 🔬 WAVE 7537: Performs 1-point keyframe crossover between two matching
 * numeric tracks.
 *
 * - Dominant keyframes with relativeTime <= crossoverPoint are kept (rescaled
 *   to childDurationMs).
 * - Recessive keyframes with relativeTime > crossoverPoint are appended
 *   (rescaled to childDurationMs).
 * - Boundary keyframes at time 0 and time childDurationMs are ensured.
 * - The curve range is inherited from the dominant parent (both parents share
 *   the same paramId, so ranges should match; dominant wins on conflict).
 *
 * @param domTrack    Dominant parent track (first half)
 * @param subTrack    Submissive parent track (second half)
 * @param crossoverPoint  Crossover time in ms (in child's time frame)
 * @param childDurationMs  Duration of the offspring clip
 * @param rng         Deterministic RNG for boundary keyframe interpolation
 * @returns A new HephTrack with recombined keyframes
 */
function crossoverKeyframes(domTrack, subTrack, crossoverPoint, childDurationMs, rng) {
    const domDuration = domTrack.curve.keyframes.length > 0
        ? domTrack.curve.keyframes[domTrack.curve.keyframes.length - 1].timeMs
        : childDurationMs;
    const subDuration = subTrack.curve.keyframes.length > 0
        ? subTrack.curve.keyframes[subTrack.curve.keyframes.length - 1].timeMs
        : childDurationMs;
    const domScale = childDurationMs > 0 ? childDurationMs / Math.max(1, domDuration) : 1;
    const subScale = childDurationMs > 0 ? childDurationMs / Math.max(1, subDuration) : 1;
    const range = domTrack.curve.range;
    const merged = [];
    // Dominant half: keyframes with rescaled time <= crossoverPoint
    for (const kf of domTrack.curve.keyframes) {
        const scaledTime = Math.round(kf.timeMs * domScale);
        if (scaledTime <= crossoverPoint) {
            merged.push({
                ...kf,
                timeMs: scaledTime,
            });
        }
    }
    // Recessive half: keyframes with rescaled time > crossoverPoint
    for (const kf of subTrack.curve.keyframes) {
        const scaledTime = Math.round(kf.timeMs * subScale);
        if (scaledTime > crossoverPoint) {
            merged.push({
                ...kf,
                timeMs: scaledTime,
            });
        }
    }
    // Sort by timeMs (invariant: keyframes must be ascending)
    merged.sort((a, b) => a.timeMs - b.timeMs);
    // Ensure boundary keyframe at time 0
    if (merged.length === 0 || merged[0].timeMs > 0) {
        // Insert a synthetic keyframe at time 0 using the dominant parent's first value
        const firstDom = domTrack.curve.keyframes[0];
        if (firstDom) {
            merged.unshift({
                ...firstDom,
                timeMs: 0,
            });
        }
        else {
            // Fallback: default value at time 0
            merged.unshift({
                timeMs: 0,
                value: domTrack.curve.defaultValue,
                interpolation: 'linear',
            });
        }
    }
    // Ensure boundary keyframe at time childDurationMs
    const last = merged[merged.length - 1];
    if (last.timeMs < childDurationMs) {
        // Append a synthetic keyframe at the end using the submissive parent's last value
        const lastSub = subTrack.curve.keyframes[subTrack.curve.keyframes.length - 1];
        if (lastSub) {
            merged.push({
                ...lastSub,
                timeMs: childDurationMs,
            });
        }
        else {
            // Fallback: hold the last merged value
            merged.push({
                timeMs: childDurationMs,
                value: last.value,
                interpolation: 'linear',
            });
        }
    }
    // Clamp all values to the dominant range (both parents share paramId,
    // but ranges might differ slightly — dominant wins)
    for (const kf of merged) {
        if (typeof kf.value === 'number') {
            kf.value = clamp(kf.value, range[0], range[1]);
        }
    }
    // Build the hybrid track from the dominant parent's metadata
    const hybridTrack = deepClone(domTrack);
    hybridTrack.curve = {
        ...domTrack.curve,
        keyframes: merged,
    };
    // Suppress unused-variable warning for rng (reserved for future boundary
    // interpolation logic — currently deterministic via parent keyframes)
    void rng;
    return hybridTrack;
}
/**
 * Rescales all keyframe times in a track from one duration to another.
 * Used when a whole-track inheritance track comes from a parent with a
 * different durationMs than the child.
 */
function rescaleKeyframeTimes(track, fromDuration, toDuration) {
    if (fromDuration <= 0 || toDuration <= 0 || fromDuration === toDuration)
        return;
    const scale = toDuration / fromDuration;
    for (const kf of track.curve.keyframes) {
        kf.timeMs = Math.round(kf.timeMs * scale);
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// OPERATOR 9: COLOR HUE SHIFT (WAVE 7546 — Color Mutation Enablement)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * 🎨 WAVE 7546: Color lane mutation operator.
 *
 * PROBLEM: All genetic operators filtered by `valueType === 'number'`,
 * excluding color tracks (valueType: 'color', HSL keyframes). Color
 * parameters were static across generations — offspring could never
 * evolve novel color palettes.
 *
 * FIX: This operator specifically targets color tracks and applies
 * hue rotation, saturation shift, and lightness drift using fat-tailed
 * distributions. The hue wheel is circular (0-360°), so shifts wrap
 * around — a +200° shift is equivalent to a -160° shift.
 *
 * DNA-driven:
 *   - High organicity → larger hue rotations (exploratory palette shifts)
 *   - High chaos → multi-point mutations (multiple keyframes shifted)
 *   - High aggression → lightness spikes (dramatic brightness contrasts)
 *
 * The operator preserves the HSL structure — it never produces invalid
 * colors (S and L are clamped to [0,100], H wraps mod 360).
 */
export function colorHueShift(parent, seed) {
    const rng = makeRng(seed ?? Date.now());
    const fatRng = makeFatTailedRng(rng);
    const child = deepClone(parent);
    const delta = [];
    // Find color tracks with at least 1 keyframe
    const colorTracks = child.tracks
        .map((t, i) => ({ track: t, index: i }))
        .filter((t) => t.track.curve.valueType === 'color' && t.track.curve.keyframes.length > 0);
    if (colorTracks.length === 0) {
        return { clip: child, delta, operator: 'color_hue_shift', l2Distance: 0 };
    }
    const dna = child.cognitiveDNA;
    const genome = dna?.genome;
    const aggression = genome?.aggression ?? 0.5;
    const organicity = genome?.organicity ?? 0.5;
    const chaos = genome?.chaos ?? 0.5;
    // Pleiotropy: high-chaos organisms mutate multiple keyframes
    const effectiveChaos = Math.min(1.0, chaos * 1.5);
    const numMutations = 1 + Math.floor(effectiveChaos * rng() * 3);
    for (let m = 0; m < numMutations; m++) {
        const pick = colorTracks[Math.floor(rng() * colorTracks.length)];
        const track = pick.track;
        const trackIdx = pick.index;
        const kfIdx = Math.floor(rng() * track.curve.keyframes.length);
        const kf = track.curve.keyframes[kfIdx];
        // Only mutate HSL values
        if (typeof kf.value === 'number' || !kf.value || typeof kf.value !== 'object') {
            continue;
        }
        const hsl = kf.value;
        // Hue rotation: Cauchy-sampled, wraps mod 360
        //   organicity > 0.5 → larger rotations (scale=60, up to 180°)
        //   organicity < 0.5 → subtle shifts (scale=20, up to 60°)
        const hueScale = organicity > 0.5 ? 60 : 20;
        const hueShift = fatRng.sampleCauchy(hueScale, 180);
        const newH = ((hsl.h + hueShift) % 360 + 360) % 360; // wrap to [0,360)
        // Saturation drift: small Cauchy shift, clamped to [0, 100]
        const satShift = fatRng.sampleCauchy(8, 30);
        const newS = clamp3(clamp(hsl.s + satShift, 0, 100), 0, 100);
        // Lightness: aggression drives dramatic brightness spikes
        //   aggression > 0.6 → Cauchy(15, 40) — occasional full-white/full-black
        //   aggression < 0.6 → Cauchy(5, 15) — subtle brightness drift
        const lightScale = aggression > 0.6 ? 15 : 5;
        const lightMax = aggression > 0.6 ? 40 : 15;
        const lightShift = fatRng.sampleCauchy(lightScale, lightMax);
        const newL = clamp3(clamp(hsl.l + lightShift, 0, 100), 0, 100);
        const newHsl = { h: Math.round(newH * 10) / 10, s: newS, l: newL };
        kf.value = newHsl;
        delta.push({
            op: 'replace',
            path: `/tracks/${trackIdx}/curve/keyframes/${kfIdx}/value`,
            value: newHsl,
        });
    }
    // DNA Drift: color mutation pushes organicity up (color = organic expression)
    if (dna && genome) {
        const newOrganicity = clamp3(genome.organicity + driftScaled(0.040, genome.chaos), 0, 1);
        const newChaos = clamp3(genome.chaos + driftScaled(0.020, genome.chaos), 0, 1);
        const newAggression = genome.aggression;
        const newGenome = {
            aggression: newAggression,
            chaos: newChaos,
            organicity: newOrganicity,
        };
        child.cognitiveDNA = {
            ...dna,
            genome: newGenome,
        };
        delta.push({ op: 'replace', path: '/cognitiveDNA/genome/aggression', value: newAggression });
        delta.push({ op: 'replace', path: '/cognitiveDNA/genome/chaos', value: newChaos });
        delta.push({ op: 'replace', path: '/cognitiveDNA/genome/organicity', value: newOrganicity });
    }
    return {
        clip: child,
        delta,
        operator: 'color_hue_shift',
        l2Distance: computeL2DistanceV2(parent, child),
    };
}
// ─── DISPATCHER ─────────────────────────────────────────────────────────────
/**
 * Dispatches to the appropriate operator by name.
 * Note: 'crossover' requires two parents — use crossover() directly
 * or ColiseumService.spawnHybrid() for sexual reproduction.
 */
export function applyOperator(parent, operatorType, seed) {
    switch (operatorType) {
        case 'focal_mutation':
            return focalMutation(parent, seed);
        case 'gene_augmentation':
            return geneAugmentation(parent, seed);
        case 'spatial_resonance':
            return spatialResonance(parent, seed);
        case 'proportional_stretch':
            return proportionalStretch(parent, seed);
        case 'macro_splice':
            return macroSplice(parent, seed);
        case 'adaptive_pruning':
            return adaptivePruning(parent, seed);
        case 'curve_adaptation':
            return curveAdaptation(parent, seed);
        case 'color_hue_shift':
            return colorHueShift(parent, seed);
        case 'crossover':
            console.warn('[GeneticOperators] crossover requires two parents — use crossover() directly or ColiseumService.spawnHybrid()');
            return {
                clip: deepClone(parent),
                delta: [],
                operator: 'crossover',
                l2Distance: 0,
            };
        default:
            // Unknown operator — return clone with no delta
            return {
                clip: deepClone(parent),
                delta: [],
                operator: operatorType,
                l2Distance: 0,
            };
    }
}
