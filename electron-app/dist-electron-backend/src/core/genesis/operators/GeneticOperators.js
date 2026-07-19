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
 * Composite L2 distance V2 — multi-space weighted average.
 * L2_total = 0.55 * D_curve + 0.40 * D_phase + 0.05 * D_structural
 *
 * Rebalanced to favor curve/phase mutations (macro_splice, proportional_stretch)
 * over structural destruction (track deletion). D_structural reduced from 0.20
 * to 0.05 so that profound curve changes alone can achieve high L2 values.
 */
export function computeL2DistanceV2(parent, child) {
    const dCurve = computeDCurve(parent, child);
    const dPhase = computeDPhase(parent, child);
    const dStructural = computeDStructural(parent, child);
    return 0.55 * dCurve + 0.40 * dPhase + 0.05 * dStructural;
}
// ─── RANDOM HELPERS (deterministic via seed) ────────────────────────────────
export function makeRng(seed) {
    let s = seed | 0;
    return () => {
        s = (s * 1664525 + 1013904223) | 0;
        return ((s >>> 0) % 1000000) / 1000000;
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
 * Shifts a single keyframe value by a perceptible amount (0.20-0.40) on a
 * DNA-selected track. Aggression favors intensity/strobe; organicity favors
 * color/zoom/pan/tilt. No microscopic Cauchy noise — only perceptible shifts.
 */
export function focalMutation(parent, seed) {
    const rng = makeRng(seed ?? Date.now());
    const child = deepClone(parent);
    const delta = [];
    // Contextual target selection from DNA
    const dna = child.cognitiveDNA;
    const genome = dna?.genome;
    const aggression = genome?.aggression ?? 0.5;
    const organicity = genome?.organicity ?? 0.5;
    let targetParamIds = null;
    if (aggression > 0.5) {
        targetParamIds = ['intensity', 'strobe'];
    }
    else if (organicity > 0.5) {
        targetParamIds = ['color', 'zoom', 'pan', 'tilt'];
    }
    let numericTracks = child.tracks
        .map((t, i) => ({ track: t, index: i }))
        .filter((t) => t.track.curve.valueType === 'number' && t.track.curve.keyframes.length > 0);
    if (targetParamIds) {
        const filtered = numericTracks.filter((t) => targetParamIds.includes(t.track.paramId));
        if (filtered.length > 0) {
            numericTracks = filtered;
        }
    }
    if (numericTracks.length === 0) {
        return { clip: child, delta, operator: 'focal_mutation', l2Distance: 0 };
    }
    const pick = numericTracks[Math.floor(rng() * numericTracks.length)];
    const track = pick.track;
    const trackIdx = pick.index;
    const kfIdx = Math.floor(rng() * track.curve.keyframes.length);
    const kf = track.curve.keyframes[kfIdx];
    if (typeof kf.value !== 'number') {
        return { clip: child, delta, operator: 'focal_mutation', l2Distance: 0 };
    }
    // Perceptible shift: 0.20 to 0.40, random sign
    const shiftMagnitude = 0.20 + rng() * 0.20;
    const sign = rng() < 0.5 ? -1 : 1;
    const range = track.curve.range;
    const span = range[1] - range[0];
    const oldVal = kf.value;
    const newVal = clamp(oldVal + sign * shiftMagnitude * span, range[0], range[1]);
    kf.value = newVal;
    delta.push({
        op: 'replace',
        path: `/tracks/${trackIdx}/curve/keyframes/${kfIdx}/value`,
        value: newVal,
    });
    // DNA Drift: aggression +0.020, chaos +0.020
    if (dna && genome) {
        const newAggression = clamp3(genome.aggression + 0.020, 0, 1);
        const newChaos = clamp3(genome.chaos + 0.020, 0, 1);
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
    const isAggressive = aggression >= 0.5;
    // Generate 2-3 keyframes
    const numKfs = 2 + Math.floor(rng() * 2); // 2 or 3
    const keyframes = [];
    for (let k = 0; k < numKfs; k++) {
        const tFraction = numKfs === 1 ? 0 : k / (numKfs - 1);
        const timeMs = Math.round(tFraction * duration);
        let value;
        let interpolation;
        if (chosenParam === 'strobe') {
            if (isAggressive) {
                // Sharp/fast strobe: high values, hold interpolation for choppy effect
                value = range[0] + span * (0.7 + rng() * 0.3);
                interpolation = k < numKfs - 1 ? 'hold' : 'linear';
            }
            else {
                // Slow/smooth strobe: lower values, linear interpolation
                value = range[0] + span * (0.2 + rng() * 0.3);
                interpolation = 'linear';
            }
        }
        else if (chosenParam === 'color') {
            // Color: spread across the hue range
            value = range[0] + span * (k / Math.max(1, numKfs - 1));
            interpolation = 'linear';
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
                interpolation = 'bezier';
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
            interpolation = isAggressive ? 'linear' : 'bezier';
        }
        value = Math.round(value * 1000) / 1000;
        const kf = { timeMs, value, interpolation };
        if (interpolation === 'bezier') {
            const presetKey = BEZIER_PRESET_KEYS[Math.floor(rng() * BEZIER_PRESET_KEYS.length)];
            kf.bezierHandles = [...BEZIER_PRESETS[presetKey]];
        }
        keyframes.push(kf);
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
            newAggression = clamp3(newAggression + 0.150, 0, 1);
            newChaos = clamp3(newChaos + 0.050, 0, 1);
            newPressureMin = clamp3(newPressureMin + 0.100, 0, 1);
        }
        else if (chosenParam === 'color') {
            newOrganicity = clamp3(newOrganicity + 0.120, 0, 1);
        }
        else if (chosenParam === 'pan' || chosenParam === 'tilt') {
            newChaos = clamp3(newChaos + 0.120, 0, 1);
        }
        else if (chosenParam === 'zoom') {
            newAggression = clamp3(newAggression + 0.080, 0, 1);
        }
        else if (chosenParam === 'intensity') {
            newOrganicity = clamp3(newOrganicity + 0.060, 0, 1);
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
 * Picks exactly ONE non-color track uniformly and applies a geometric phase
 * archetype (Harmony, Chaos, Aggression) derived from the parent's cognitiveDNA.
 * Color tracks are blacklisted — color phasing creates visual mud.
 */
export function spatialResonance(parent, seed) {
    const rng = makeRng(seed ?? Date.now());
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
    track.phaseConfig = newPhase;
    delta.push({
        op: 'replace',
        path: `/tracks/${trackIdx}/phaseConfig`,
        value: newPhase,
    });
    // Step C: DNA Drift (3-decimal precision)
    if (dna && genome) {
        let newAggression = genome.aggression;
        let newChaos = genome.chaos;
        let newOrganicity = genome.organicity;
        if (archetype === 'harmony') {
            newOrganicity = clamp3(newOrganicity + 0.030, 0, 1);
            newChaos = clamp3(newChaos - 0.040, 0, 1);
        }
        else if (archetype === 'chaos') {
            newChaos = clamp3(newChaos + 0.050, 0, 1);
        }
        else {
            // aggression
            newAggression = clamp3(newAggression + 0.040, 0, 1);
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
            newAggression = clamp3(newAggression + 0.050, 0, 1);
            newChaos = clamp3(newChaos + 0.030, 0, 1);
        }
        else {
            // Slower
            newOrganicity = clamp3(newOrganicity + 0.060, 0, 1);
            newAggression = clamp3(newAggression - 0.040, 0, 1);
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
 * into a wide temporal gap (>300ms) of a numeric track. The archetype is
 * selected from the parent's cognitiveDNA genome, and the DNA is drifted
 * accordingly. No microscopic jitter — only macro-structural interventions.
 */
export function macroSplice(parent, seed) {
    const rng = makeRng(seed ?? Date.now());
    const child = deepClone(parent);
    const delta = [];
    // Step A: Find numeric tracks with ≥2 keyframes and a gap > 300ms
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
            if (gapMs > 300) {
                candidateGaps.push({ trackIdx: pick.index, gapIdx: g, gapMs });
            }
        }
    }
    if (candidateGaps.length === 0) {
        return { clip: child, delta, operator: 'macro_splice', l2Distance: 0 };
    }
    // Pick a random gap
    const chosen = candidateGaps[Math.floor(rng() * candidateGaps.length)];
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
        return { clip: child, delta, operator: 'macro_splice', l2Distance: 0 };
    }
    // Step B: Archetype Selection from genome
    const dna = child.cognitiveDNA;
    const genome = dna?.genome;
    const chaos = genome?.chaos ?? 0.5;
    const aggression = genome?.aggression ?? 0.5;
    const organicity = genome?.organicity ?? 0.5;
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
        // RNG fallback
        const roll = rng();
        archetype = roll < 0.33 ? 'stutter' : roll < 0.66 ? 'peak' : 'breath';
    }
    // Step C: Injection — create 2 keyframes (start and end of macro block)
    const gapStart = kfA.timeMs;
    const gapEnd = kfB.timeMs;
    const gapMid = Math.round((gapStart + gapEnd) / 2);
    let blockStartMs;
    let blockEndMs;
    let blockValue;
    let blockInterp;
    if (archetype === 'stutter') {
        // Tight 80-120ms block dropping value to 0, hold interpolation
        const blockWidth = 80 + Math.floor(rng() * 41); // 80-120ms
        blockStartMs = gapMid - Math.round(blockWidth / 2);
        blockEndMs = blockStartMs + blockWidth;
        blockValue = range[0]; // drop to 0 (range min)
        blockInterp = 'hold';
    }
    else if (archetype === 'peak') {
        // 150-200ms spike, value +0.40 * span clamped to range max
        const blockWidth = 150 + Math.floor(rng() * 51); // 150-200ms
        blockStartMs = gapMid - Math.round(blockWidth / 2);
        blockEndMs = blockStartMs + blockWidth;
        const peakVal = (typeof valA === 'number' ? valA : range[0]) + 0.40 * span;
        blockValue = clamp(peakVal, range[0], range[1]);
        blockInterp = rng() < 0.5 ? 'linear' : 'hold';
    }
    else {
        // Breath: 300ms+ smooth dip, value -0.30 * span clamped to range min
        const blockWidth = 300 + Math.floor(rng() * 200); // 300-500ms
        blockStartMs = gapMid - Math.round(blockWidth / 2);
        blockEndMs = blockStartMs + blockWidth;
        const breathVal = (typeof valA === 'number' ? valA : range[1]) - 0.30 * span;
        blockValue = clamp(breathVal, range[0], range[1]);
        blockInterp = 'bezier';
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
    // Step D: DNA Drift (3-decimal precision)
    const dnaDelta = [];
    if (dna && genome) {
        let newAggression = genome.aggression;
        let newChaos = genome.chaos;
        let newOrganicity = genome.organicity;
        if (archetype === 'stutter') {
            newChaos = clamp3(newChaos + 0.050, 0, 1);
            newOrganicity = clamp3(newOrganicity - 0.020, 0, 1);
        }
        else if (archetype === 'peak') {
            newAggression = clamp3(newAggression + 0.060, 0, 1);
        }
        else {
            // breath
            newOrganicity = clamp3(newOrganicity + 0.050, 0, 1);
            newAggression = clamp3(newAggression - 0.030, 0, 1);
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
    }
    delta.push(...dnaDelta);
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
        // DNA Drift: chaos -0.040, organicity +0.030
        const dna = child.cognitiveDNA;
        const genome = dna?.genome;
        if (dna && genome) {
            const newChaos = clamp3(genome.chaos - 0.040, 0, 1);
            const newOrganicity = clamp3(genome.organicity + 0.030, 0, 1);
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
        // DNA Drift: chaos -0.040, organicity +0.030
        const dna = child.cognitiveDNA;
        const genome = dna?.genome;
        if (dna && genome) {
            const newChaos = clamp3(genome.chaos - 0.040, 0, 1);
            const newOrganicity = clamp3(genome.organicity + 0.030, 0, 1);
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
            newOrganicity = clamp3(newOrganicity + 0.040, 0, 1);
        }
        else if (newInterp === 'hold') {
            newChaos = clamp3(newChaos + 0.030, 0, 1);
            newAggression = clamp3(newAggression + 0.020, 0, 1);
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
    const genome = {
        aggression: clamp3(0.7 * dom.genome.aggression + 0.3 * sub.genome.aggression, 0, 1),
        chaos: clamp3(0.7 * dom.genome.chaos + 0.3 * sub.genome.chaos, 0, 1),
        organicity: clamp3(0.7 * dom.genome.organicity + 0.3 * sub.genome.organicity, 0, 1),
    };
    const textureAffinity = dom.textureAffinity;
    const spatialBehavior = dom.spatialBehavior;
    const compatibleVibes = [...new Set([...dnaA.compatibleVibes, ...dnaB.compatibleVibes])];
    const validSections = [...new Set([...dnaA.validSections, ...dnaB.validSections])];
    // G4 PRE-SCREENING: check zoneSpan of unioned range
    const unionMinIdx = Math.min(ENERGY_ZONES.indexOf(dnaA.energyZone.min), ENERGY_ZONES.indexOf(dnaB.energyZone.min));
    const unionMaxIdx = Math.max(ENERGY_ZONES.indexOf(dnaA.energyZone.max), ENERGY_ZONES.indexOf(dnaB.energyZone.max));
    const unionSpan = unionMaxIdx - unionMinIdx + 1;
    const energyZone = unionSpan > 2 ? dom.energyZone : {
        min: ENERGY_ZONES[Math.max(0, unionMinIdx)],
        max: ENERGY_ZONES[Math.min(ENERGY_ZONES.length - 1, unionMaxIdx)],
    };
    // AVERAGE tolerance ranges — prevents inflation across generations
    const aggressionRange = {
        min: (dnaA.aggressionRange.min + dnaB.aggressionRange.min) / 2,
        max: (dnaA.aggressionRange.max + dnaB.aggressionRange.max) / 2,
    };
    const pressureRange = {
        min: (dnaA.pressureRange.min + dnaB.pressureRange.min) / 2,
        max: (dnaA.pressureRange.max + dnaB.pressureRange.max) / 2,
    };
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
 * Sexual reproduction operator — strict dominant/submissive track merge.
 * All dominant parent tracks are inherited. Submissive parent tracks are
 * added only if their paramId is not already present in the child.
 * This guarantees zero orphaned tracks and resolves conflicts cleanly.
 *
 * Delta is a bulk replace of /tracks and /cognitiveDNA on the dominant parent.
 * L2 = min(distance to A, distance to B) — conservative rule.
 */
export function crossover(parentA, parentB, fitnessA, fitnessB, _seed) {
    const dominant = fitnessA >= fitnessB ? 'A' : 'B';
    const dominantClip = dominant === 'A' ? parentA : parentB;
    const submissiveClip = dominant === 'A' ? parentB : parentA;
    // WAVE 7165: Multicellular crossover — use composite key paramId::zones
    // to allow submissive parent to contribute tracks with same paramId but different zones.
    const childTracks = [];
    const seenTrackKeys = new Set();
    for (const track of dominantClip.tracks) {
        childTracks.push(deepClone(track));
        seenTrackKeys.add(`${track.paramId}::${track.zones.join(',')}`);
    }
    for (const track of submissiveClip.tracks) {
        const key = `${track.paramId}::${track.zones.join(',')}`;
        if (!seenTrackKeys.has(key)) {
            childTracks.push(deepClone(track));
            seenTrackKeys.add(key);
        }
    }
    // Build child clip from dominant parent as base
    const child = deepClone(dominantClip);
    child.tracks = childTracks;
    child.durationMs = Math.round((parentA.durationMs + parentB.durationMs) / 2);
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
    // L2 = min distance to either parent (conservative)
    const l2A = computeL2DistanceV2(parentA, child);
    const l2B = computeL2DistanceV2(parentB, child);
    const l2Distance = Math.min(l2A, l2B);
    return {
        clip: child,
        delta,
        operator: 'crossover',
        l2Distance,
        dominantParent: dominant,
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
