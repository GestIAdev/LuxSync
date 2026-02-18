/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎬 TIMELINE CLIP - WAVE 2006: THE INTERACTIVE CANVAS
 *
 * Data structures for timeline clips (vibes, effects, keyframes)
 *
 * CLIP TYPES:
 * - VibeClip: Mood/atmosphere region (CHILLOUT, TECHNO, etc.)
 * - FXClip: Effect with keyframes (STROBE, SWEEP, PULSE, CHASE)
 *
 * @module chronos/core/TimelineClip
 * @version WAVE 2006 / WAVE 2030.4 (Hephaestus Integration)
 */
import { getEffectById } from './EffectRegistry'; // WAVE 2040.21b: Registry lookup for Core FX colors
/**
 * WAVE 2040.17 P6: Set of valid FXType values for runtime validation.
 * Used to safely convert unknown strings (from Recorder, D&D, etc.)
 * into a type-safe FXType without `as any` casts.
 */
export const VALID_FX_TYPES = new Set([
    'strobe', 'sweep', 'pulse', 'chase', 'fade',
    'blackout', 'color-wash', 'intensity-ramp', 'heph-custom',
]);
/**
 * WAVE 2040.17 P11: Safely coerce an arbitrary string to FXType.
 * Returns the string as FXType if it's a valid member, otherwise 'pulse' as fallback.
 */
export function toFXType(value) {
    if (value && VALID_FX_TYPES.has(value))
        return value;
    return 'pulse';
}
/**
 * WAVE 2040.17 P11: Set of valid VibeType values for runtime validation.
 */
export const VALID_VIBE_TYPES = new Set([
    'fiesta-latina', 'techno-club', 'chill-lounge', 'pop-rock', 'idle',
]);
/**
 * WAVE 2040.17 P11: Safely coerce an arbitrary string to VibeType.
 * Returns the string as VibeType if valid, otherwise 'idle' as fallback.
 */
export function toVibeType(value) {
    if (value && VALID_VIBE_TYPES.has(value))
        return value;
    return 'idle';
}
// ═══════════════════════════════════════════════════════════════════════════
// CLIP COLORS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * 🎨 WAVE 2019.8 + 2040.11: Vibe colors mapped to real VibeIds
 *
 * WAVE 2040.11: Added 'techno' alias for 'techno-club' to fix EffectCategoryId mismatch.
 * The EffectRegistry uses 'techno' but VibeType uses 'techno-club', causing black clips.
 */
export const VIBE_COLORS = {
    'fiesta-latina': '#f59e0b', // 🎉 Orange - Fiesta Latina
    'techno-club': '#a855f7', // ⚡ Purple - Techno Club
    'techno': '#a855f7', // ⚡ Alias for 'techno-club' (EffectCategoryId compat)
    'chill-lounge': '#22d3ee', // 🌊 Cyan - Chill Lounge
    'pop-rock': '#ef4444', // 🎸 Red - Pop Rock
    'idle': '#6b7280', // 💤 Gray - Idle
};
/**
 * 🔧 WAVE 2040.11: Normalize vibe color lookup
 * Handles both VibeType ('techno-club') and EffectCategoryId ('techno') formats
 */
export function getVibeColor(vibeKey) {
    return VIBE_COLORS[vibeKey] || VIBE_COLORS['idle']; // Fallback to idle gray
}
export const FX_COLORS = {
    'strobe': '#facc15', // ⚡ WAVE 2040.19: Vivid gold — strobe demands attention
    'sweep': '#22d3ee', // Cyan — punchy enough
    'pulse': '#f87171', // Red — punchy enough
    'chase': '#a78bfa', // Purple — punchy enough
    'fade': '#60a5fa', // Blue — punchy enough
    'blackout': '#374151', // ⚡ WAVE 2040.19: Warm charcoal — visible but dark
    'color-wash': '#34d399', // Emerald — punchy enough
    'intensity-ramp': '#fbbf24', // Amber — punchy enough
    'heph-custom': '#ff6b2b', // Ember orange — Hephaestus signature
};
// ═══════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════
let clipIdCounter = 0;
/**
 * Generate unique clip ID
 */
export function generateClipId() {
    return `clip-${Date.now()}-${++clipIdCounter}`;
}
/**
 * Create a new VibeClip
 */
export function createVibeClip(vibeType, startMs, durationMs, trackId) {
    return {
        id: generateClipId(),
        type: 'vibe',
        vibeType,
        label: vibeType.toUpperCase().replace('-', ' '),
        startMs,
        endMs: startMs + durationMs,
        trackId,
        color: getVibeColor(vibeType), // 🔧 WAVE 2040.11: Use normalizer for color lookup
        intensity: 1.0,
        fadeInMs: 500,
        fadeOutMs: 500,
        selected: false,
        locked: false,
    };
}
/**
 * Create a new FXClip
 *
 * WAVE 2040.21b: If effectId provided, looks up mixBus from EffectRegistry
 * to automatically color Core FX clips correctly.
 */
export function createFXClip(fxType, startMs, durationMs, trackId, effectId // WAVE 2040.21b: Optional Core Effect ID for registry lookup
) {
    // 🎨 WAVE 2040.21b: If effectId provided, get effect from registry
    let color = FX_COLORS[fxType] || '#666666';
    let label = fxType.toUpperCase().replace('-', ' ');
    if (effectId) {
        const effect = getEffectById(effectId);
        if (effect) {
            // Use effect's displayName
            label = effect.displayName;
            // Get color from mixBus
            if (effect.mixBus) {
                color = MIXBUS_CLIP_COLORS[effect.mixBus] || color;
            }
        }
    }
    return {
        id: generateClipId(),
        type: 'fx',
        fxType,
        label,
        startMs,
        endMs: startMs + durationMs,
        trackId,
        color,
        keyframes: [
            { offsetMs: 0, value: 0, easing: 'ease-in' },
            { offsetMs: durationMs / 2, value: 1, easing: 'ease-out' },
            { offsetMs: durationMs, value: 0, easing: 'linear' },
        ],
        params: {},
        selected: false,
        locked: false,
    };
}
/**
 * ⚒️ WAVE 2030.17 → WAVE 2040.17: THE DIAMOND BRIDGE
 * Create a Hephaestus Custom FX Clip from .lfx drag
 *
 * WAVE 2040.17: Now accepts full hephClip data (serialized),
 * mixBus, zones, priority. Color is derived from mixBus.
 * Keyframes are generated as a visual summary of the intensity curve.
 */
export const HEPH_EMBER_COLOR = '#ff6b2b'; // Fallback ember orange
/**
 * ⚒️ WAVE 2040.17: MixBus → Color mapping
 * Each color matches its corresponding FX track for visual coherence.
 */
export const MIXBUS_CLIP_COLORS = {
    'global': '#ef4444', // Red — match FX1 track
    'htp': '#f59e0b', // Orange — match FX2 track
    'ambient': '#10b981', // Green — match FX3 track
    'accent': '#3b82f6', // Blue — match FX4 track
};
/**
 * ⚒️ WAVE 2040.17 → 2040.21: Extract visual keyframes with PRIORITY CURVE logic.
 * Creates a summary of the MOST REPRESENTATIVE curve for timeline visualization.
 *
 * WAVE 2040.21: THE TRUTH ENGINE — No more "curva mentirosa".
 * Priority order (most visually meaningful → least):
 *   1. intensity — the master dimmer curve IS the clip's visual identity
 *   2. tilt — vertical movement is the most dramatic spatial axis
 *   3. pan — horizontal sweep is second-most visible
 *   4. color — chromatic information has visual weight
 *   5. ANY other curve — better than nothing
 *   6. Fallback: generic 3-point envelope
 *
 * DETERMINISTA: Same curves → same visual. Siempre.
 */
const VISUAL_PRIORITY_CURVE_KEYS = ['intensity', 'tilt', 'pan', 'color', 'white', 'zoom', 'focus'];
export function extractVisualKeyframes(hephClip, durationMs) {
    if (!hephClip?.curves) {
        // Fallback: generic 3-point envelope
        return [
            { offsetMs: 0, value: 0, easing: 'ease-in' },
            { offsetMs: durationMs / 2, value: 1, easing: 'ease-out' },
            { offsetMs: durationMs, value: 0, easing: 'linear' },
        ];
    }
    const curveKeys = Object.keys(hephClip.curves);
    if (curveKeys.length === 0) {
        return [
            { offsetMs: 0, value: 0, easing: 'ease-in' },
            { offsetMs: durationMs / 2, value: 1, easing: 'ease-out' },
            { offsetMs: durationMs, value: 0, easing: 'linear' },
        ];
    }
    // ⚒️ WAVE 2040.21: Pick the PRIORITY curve — the most visually meaningful
    let selectedKey;
    for (const priorityKey of VISUAL_PRIORITY_CURVE_KEYS) {
        if (curveKeys.includes(priorityKey)) {
            selectedKey = priorityKey;
            break;
        }
    }
    // If no priority key matched, take the first available curve
    if (!selectedKey) {
        selectedKey = curveKeys[0];
    }
    const selectedCurve = hephClip.curves[selectedKey];
    if (!selectedCurve?.keyframes || selectedCurve.keyframes.length === 0) {
        return [
            { offsetMs: 0, value: 0, easing: 'ease-in' },
            { offsetMs: durationMs / 2, value: 1, easing: 'ease-out' },
            { offsetMs: durationMs, value: 0, easing: 'linear' },
        ];
    }
    return selectedCurve.keyframes.map(kf => {
        // Map HephInterpolation → FXKeyframe easing
        let easing = 'linear';
        if (kf.interpolation === 'hold')
            easing = 'step';
        else if (kf.interpolation === 'bezier') {
            // Approximate bezier to closest CSS easing
            if (kf.bezierHandles) {
                const [cx1, , ,] = kf.bezierHandles;
                if (cx1 > 0.3)
                    easing = 'ease-in';
                else
                    easing = 'ease-out';
            }
            else {
                easing = 'ease-in-out';
            }
        }
        return {
            offsetMs: kf.timeMs,
            value: typeof kf.value === 'number' ? kf.value : 1,
            easing,
        };
    });
}
const MOVEMENT_CURVE_KEYS = ['pan', 'tilt'];
const COLOR_CURVE_KEYS = ['color', 'white', 'amber'];
const OPTICS_CURVE_KEYS = ['zoom', 'focus', 'iris', 'gobo1', 'gobo2', 'prism'];
const PHYSICAL_CURVE_KEYS = ['intensity', 'strobe'];
// Name/category keywords → mixBus mapping
const MOVEMENT_KEYWORDS = ['pan', 'tilt', 'move', 'sweep', 'scanner', 'position', 'track'];
const COLOR_KEYWORDS = ['color', 'rgb', 'hue', 'wash', 'rainbow', 'chromatic', 'amber', 'white'];
const ACCENT_KEYWORDS = ['gobo', 'prism', 'zoom', 'focus', 'iris', 'optic', 'beam', 'spot'];
const GLOBAL_KEYWORDS = ['strobe', 'flash', 'blinder', 'bump', 'pulse', 'dim', 'blackout', 'intensity'];
function inferMixBusFromCurves(hephClip, name, effectType) {
    // ── PASS 1: Explicit mixBus in serialized data (new .lfx files)
    if (hephClip?.mixBus) {
        return hephClip.mixBus;
    }
    // ── PASS 2: Curve analysis (most reliable for legacy files)
    if (hephClip?.curves) {
        const curveKeys = Object.keys(hephClip.curves);
        const hasMovement = curveKeys.some(k => MOVEMENT_CURVE_KEYS.includes(k));
        const hasColor = curveKeys.some(k => COLOR_CURVE_KEYS.includes(k));
        const hasOptics = curveKeys.some(k => OPTICS_CURVE_KEYS.includes(k));
        const hasPhysical = curveKeys.some(k => PHYSICAL_CURVE_KEYS.includes(k));
        // Movement curves → HTP bus (movement is high-priority, HTP blending)
        if (hasMovement && !hasColor && !hasOptics)
            return 'htp';
        // Pure color curves → Ambient bus
        if (hasColor && !hasMovement && !hasOptics)
            return 'ambient';
        // Optics curves → Accent bus
        if (hasOptics)
            return 'accent';
        // Only physical (intensity/strobe) → Global bus
        if (hasPhysical && !hasMovement && !hasColor && !hasOptics)
            return 'global';
        // Mixed curves: movement+color → HTP (movement takes priority)
        if (hasMovement)
            return 'htp';
        if (hasColor)
            return 'ambient';
    }
    // ── PASS 3: Name + effectType keyword analysis (legacy fallback)
    const searchText = `${name} ${effectType} ${hephClip?.category || ''}`.toLowerCase();
    const tags = hephClip?.tags?.map(t => t.toLowerCase()) || [];
    const allText = `${searchText} ${tags.join(' ')}`;
    if (MOVEMENT_KEYWORDS.some(kw => allText.includes(kw)))
        return 'htp';
    if (COLOR_KEYWORDS.some(kw => allText.includes(kw)))
        return 'ambient';
    if (ACCENT_KEYWORDS.some(kw => allText.includes(kw)))
        return 'accent';
    if (GLOBAL_KEYWORDS.some(kw => allText.includes(kw)))
        return 'global';
    // ── PASS 4: Safe default — global bus (intensity/dimmer routing)
    return 'global';
}
export function createHephFXClip(name, filePath, startMs, durationMs, trackId, effectType = 'custom', hephClipSerialized, mixBus, zones, priority) {
    // ⚒️ WAVE 2040.19: SHERLOCK MODE — Auto-infer mixBus for legacy clips
    const resolvedMixBus = mixBus || inferMixBusFromCurves(hephClipSerialized, name, effectType);
    const color = MIXBUS_CLIP_COLORS[resolvedMixBus] || HEPH_EMBER_COLOR;
    // 🐛 WAVE 2040.19: Log inference result
    console.log(`[createHephFXClip] 🔍 "${name}": mixBus=${mixBus || 'INFERRED→' + resolvedMixBus} → color=${color}`);
    // WAVE 2040.17 P6: Use 'heph-custom' for Hephaestus automation clips.
    // Only coerce to a standard FXType if effectType is actually one.
    const resolvedFxType = toFXType(effectType === 'heph_custom' || effectType === 'heph-automation' || effectType === 'custom'
        ? 'heph-custom'
        : effectType);
    // WAVE 2040.17 P9: Store only the filename for portability.
    // The .lux file should NOT depend on absolute paths — it must be
    // transferable between machines. The filename is enough to relocate
    // the .lfx file when the library is present.
    const portableFilePath = filePath
        ? filePath.replace(/^.*[\\/]/, '') // Extract filename from any OS path
        : '';
    return {
        id: generateClipId(),
        type: 'fx',
        fxType: resolvedFxType,
        label: name,
        startMs,
        endMs: startMs + durationMs,
        trackId,
        color,
        keyframes: extractVisualKeyframes(hephClipSerialized, durationMs),
        params: { effectType },
        selected: false,
        locked: false,
        // ⚒️ HEPHAESTUS MARKERS — WAVE 2040.17 + 2040.19: Full Diamond Data
        hephFilePath: portableFilePath,
        isHephCustom: true,
        hephClip: hephClipSerialized,
        mixBus: resolvedMixBus, // ⚒️ WAVE 2040.19: Always resolved (explicit or inferred)
        zones,
        priority,
    };
}
// ═══════════════════════════════════════════════════════════════════════════
// SNAPPING UTILITIES
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Calculate beat grid positions for snapping
 */
export function calculateBeatGrid(bpm, durationMs) {
    const msPerBeat = 60000 / bpm;
    const beats = [];
    for (let t = 0; t <= durationMs; t += msPerBeat) {
        beats.push(Math.round(t));
    }
    return beats;
}
/**
 * Snap a time value to the nearest beat
 * @returns [snappedTime, didSnap, snapBeat]
 */
export function snapToGrid(timeMs, beatGrid, snapThresholdMs = 100) {
    let closestBeat = null;
    let closestDistance = Infinity;
    for (const beat of beatGrid) {
        const distance = Math.abs(timeMs - beat);
        if (distance < closestDistance) {
            closestDistance = distance;
            closestBeat = beat;
        }
        // Early exit if we've passed the closest
        if (beat > timeMs + snapThresholdMs)
            break;
    }
    if (closestBeat !== null && closestDistance <= snapThresholdMs) {
        return [closestBeat, true, closestBeat];
    }
    return [timeMs, false, null];
}
/**
 * Serialize drag payload for DataTransfer
 */
export function serializeDragPayload(payload) {
    return JSON.stringify(payload);
}
/**
 * Deserialize drag payload from DataTransfer
 */
export function deserializeDragPayload(data) {
    try {
        return JSON.parse(data);
    }
    catch {
        return null;
    }
}
