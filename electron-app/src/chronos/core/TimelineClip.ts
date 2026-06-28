// @deprecated DEMOLITION TARGET — mixBus, inferMixBusFromCurves(), MIXBUS_CLIP_COLORS
// will be removed in Phase 1. FXClip.hephClip (V3) is the truth.
// zones come from hephClip.spatialZones / hephClip.tracks[].zones.
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

import type { HephAutomationClipV3 } from '../../core/hephaestus/types'
import { getEffectById } from './EffectRegistry'  // WAVE 2040.21b: Registry lookup for Core FX colors

// ═══════════════════════════════════════════════════════════════════════════
// CLIP TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type ClipType = 'vibe' | 'fx'

/**
 * 🎯 WAVE 2019.8: VibeType must match VibeId from engine/vibe/profiles/index.ts
 * Valid backend IDs: fiesta-latina, techno-club, chill-lounge, pop-rock, idle
 */
export type VibeType = 
  | 'fiesta-latina'  // 🎉 Fiesta Latina (default)
  | 'techno-club'    // ⚡ Techno / Electronic / Build-ups
  | 'chill-lounge'   // 🌊 Chillout / Ambient / Ballad
  | 'pop-rock'       // 🎸 Rock / Hip-hop / Pop
  | 'idle'           // 💤 Static / No movement

export type FXType = 
  | 'strobe' 
  | 'sweep' 
  | 'pulse' 
  | 'chase' 
  | 'fade' 
  | 'blackout'
  | 'color-wash'
  | 'intensity-ramp'
  | 'heph-custom'

/**
 * WAVE 2040.17 P6: Set of valid FXType values for runtime validation.
 * Used to safely convert unknown strings (from Recorder, D&D, etc.)
 * into a type-safe FXType without `as any` casts.
 */
export const VALID_FX_TYPES: ReadonlySet<string> = new Set<string>([
  'strobe', 'sweep', 'pulse', 'chase', 'fade',
  'blackout', 'color-wash', 'intensity-ramp', 'heph-custom',
])

/**
 * WAVE 2040.17 P11: Safely coerce an arbitrary string to FXType.
 * Returns the string as FXType if it's a valid member, otherwise 'pulse' as fallback.
 */
export function toFXType(value: string | undefined): FXType {
  if (value && VALID_FX_TYPES.has(value)) return value as FXType
  return 'pulse'
}

/**
 * WAVE 2040.17 P11: Set of valid VibeType values for runtime validation.
 */
export const VALID_VIBE_TYPES: ReadonlySet<string> = new Set<string>([
  'fiesta-latina', 'techno-club', 'chill-lounge', 'pop-rock', 'idle',
])

/**
 * WAVE 2040.17 P11: Safely coerce an arbitrary string to VibeType.
 * Returns the string as VibeType if valid, otherwise 'idle' as fallback.
 */
export function toVibeType(value: string | undefined): VibeType {
  if (value && VALID_VIBE_TYPES.has(value)) return value as VibeType
  return 'idle'
}

// ═══════════════════════════════════════════════════════════════════════════
// BASE CLIP INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

export interface BaseClip {
  /** Unique clip ID */
  id: string
  
  /** Clip type */
  type: ClipType
  
  /** Start time in milliseconds */
  startMs: number
  
  /** End time in milliseconds */
  endMs: number
  
  /** Track ID where clip belongs */
  trackId: string
  
  /** Is clip selected */
  selected?: boolean
  
  /** Is clip locked (cannot move/resize) */
  locked?: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// VIBE CLIP
// ═══════════════════════════════════════════════════════════════════════════

export interface VibeClip extends BaseClip {
  type: 'vibe'
  
  /** Vibe preset */
  vibeType: VibeType
  
  /** Display label */
  label: string
  
  /** Color for rendering */
  color: string
  
  /** Intensity (0-1) */
  intensity: number
  
  /** Transition in duration (ms) */
  fadeInMs: number
  
  /** Transition out duration (ms) */
  fadeOutMs: number
}

// ═══════════════════════════════════════════════════════════════════════════
// FX CLIP
// ═══════════════════════════════════════════════════════════════════════════

export interface FXKeyframe {
  /** Time offset from clip start (ms) */
  offsetMs: number
  
  /** Parameter value at this keyframe (0-1) */
  value: number
  
  /** Easing curve to next keyframe */
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'step'
}

export interface FXClip extends BaseClip {
  type: 'fx'
  
  /** Effect type */
  fxType: FXType
  
  /** Display label */
  label: string
  
  /** Color for rendering */
  color: string
  
  /** Keyframes for effect automation */
  keyframes: FXKeyframe[]
  
  /** Effect parameters */
  params: Record<string, number | string | boolean>
  
  /**
   * ⚒️ WAVE 2040.17: DIAMOND DATA — Deep copy of Hephaestus automation clip.
   *
   * V3 clip stored directly — survives JSON.stringify natively
   * (tracks is an array, no Map<> to serialize).
   *
   * Contains the COMPLETE automation data: all tracks, spatialZones, mixBus,
   * priority, staticParams. The .lux file is self-contained.
   * The reproductor reads directly from this — no .lfx dependency.
   *
   * Opcional: clips legacy/Arsenal sin hephClip funcionan normalmente.
   */
  hephClip?: HephAutomationClipV3
  
  /**
   * ⚒️ WAVE 2030.17: THE BRIDGE
   * 
   * Path to .lfx file from Hephaestus library.
   * WAVE 2040.17: This is now OPTIONAL metadata for "edit original in Hephaestus".
   * The show does NOT depend on this file — hephClip contains all data.
   */
  hephFilePath?: string
  
  /**
   * WAVE 2030.17: Indicates this is a Hephaestus custom effect
   * When true, the clip is rendered with mixBus-aware coloring
   */
  isHephCustom?: boolean

  /**
   * ⚒️ WAVE 2040.17: MixBus routing from Hephaestus
   * Determines which FX track this clip routes to in playback.
   * 
   * 'global'  → FX1: Takeover total (strobes, blinders)
   * 'htp'     → FX2: High-priority transitional (sweeps, chases)
   * 'ambient' → FX3: Background atmospheres (mists, rain)
   * 'accent'  → FX4: Short accents (sparks, hits)
   */
  mixBus?: 'global' | 'htp' | 'ambient' | 'accent'

  /**
   * ⚒️ WAVE 2040.17: Effect zones from Hephaestus
   * Determines which fixtures this effect targets.
   */
  zones?: string[]

  /**
   * ⚒️ WAVE 2040.17: Effect priority (0-100)
   * Used for conflict resolution when multiple effects overlap.
   */
  priority?: number
}

// Union type
export type TimelineClip = VibeClip | FXClip

// ═══════════════════════════════════════════════════════════════════════════
// CLIP COLORS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎨 WAVE 2019.8 + 2040.11: Vibe colors mapped to real VibeIds
 * 
 * WAVE 2040.11: Added 'techno' alias for 'techno-club' to fix EffectCategoryId mismatch.
 * The EffectRegistry uses 'techno' but VibeType uses 'techno-club', causing black clips.
 */
export const VIBE_COLORS: Record<string, string> = {
  'fiesta-latina': '#f59e0b', // 🎉 Orange - Fiesta Latina
  'techno-club': '#a855f7',   // ⚡ Purple - Techno Club
  'techno': '#a855f7',        // ⚡ Alias for 'techno-club' (EffectCategoryId compat)
  'chill-lounge': '#22d3ee',  // 🌊 Cyan - Chill Lounge
  'pop-rock': '#ef4444',      // 🎸 Red - Pop Rock
  'idle': '#6b7280',          // 💤 Gray - Idle
}

/**
 * 🔧 WAVE 2040.11: Normalize vibe color lookup
 * Handles both VibeType ('techno-club') and EffectCategoryId ('techno') formats
 */
export function getVibeColor(vibeKey: string): string {
  return VIBE_COLORS[vibeKey] || VIBE_COLORS['idle'] // Fallback to idle gray
}

export const FX_COLORS: Record<FXType, string> = {
  'strobe': '#facc15',        // ⚡ WAVE 2040.19: Vivid gold — strobe demands attention
  'sweep': '#22d3ee',         // Cyan — punchy enough
  'pulse': '#f87171',         // Red — punchy enough
  'chase': '#a78bfa',         // Purple — punchy enough
  'fade': '#60a5fa',          // Blue — punchy enough
  'blackout': '#374151',      // ⚡ WAVE 2040.19: Warm charcoal — visible but dark
  'color-wash': '#34d399',    // Emerald — punchy enough
  'intensity-ramp': '#fbbf24', // Amber — punchy enough
  'heph-custom': '#ff6b2b',   // Ember orange — Hephaestus signature
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

let clipIdCounter = 0

/**
 * Generate unique clip ID
 */
export function generateClipId(): string {
  return `clip-${Date.now()}-${++clipIdCounter}`
}

/**
 * Create a new VibeClip
 */
export function createVibeClip(
  vibeType: VibeType,
  startMs: number,
  durationMs: number,
  trackId: string
): VibeClip {
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
  }
}

/**
 * Create a new FXClip
 * 
 * WAVE 2040.21b: If effectId provided, looks up mixBus from EffectRegistry
 * to automatically color Core FX clips correctly.
 */
export function createFXClip(
  fxType: FXType,
  startMs: number,
  durationMs: number,
  trackId: string,
  effectId?: string  // WAVE 2040.21b: Optional Core Effect ID for registry lookup
): FXClip {
  // 🎨 WAVE 2040.21b: If effectId provided, get effect from registry
  let color = FX_COLORS[fxType] || '#666666'
  let label = fxType.toUpperCase().replace('-', ' ')
  
  if (effectId) {
    const effect = getEffectById(effectId)
    
    if (effect) {
      // Use effect's displayName
      label = effect.displayName
      
      // Get color from mixBus
      if (effect.mixBus) {
        color = MIXBUS_CLIP_COLORS[effect.mixBus] || color
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
  }
}

/** 
 * ⚒️ WAVE 2030.17 → WAVE 2040.17: THE DIAMOND BRIDGE
 * Create a Hephaestus Custom FX Clip from .lfx drag
 * 
 * WAVE 2040.17: Now accepts full hephClip V3 data,
 * mixBus, zones, priority. Color is derived from mixBus.
 * Keyframes are generated as a visual summary of the intensity curve.
 */
export const HEPH_EMBER_COLOR = '#ff6b2b' // Fallback ember orange

/**
 * ⚒️ WAVE 2040.17: MixBus → Color mapping
 * Each color matches its corresponding FX track for visual coherence.
 */
export const MIXBUS_CLIP_COLORS: Record<string, string> = {
  'global':  '#ef4444',  // Red — match FX1 track
  'htp':     '#f59e0b',  // Orange — match FX2 track
  'ambient': '#10b981',  // Green — match FX3 track
  'accent':  '#3b82f6',  // Blue — match FX4 track
}

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
const VISUAL_PRIORITY_CURVE_KEYS = ['intensity', 'tilt', 'pan', 'color', 'white', 'zoom', 'focus']

export function extractVisualKeyframes(
  hephClip: HephAutomationClipV3 | undefined,
  durationMs: number
): FXKeyframe[] {
  if (!hephClip?.tracks || hephClip.tracks.length === 0) {
    // Fallback: generic 3-point envelope
    return [
      { offsetMs: 0, value: 0, easing: 'ease-in' },
      { offsetMs: durationMs / 2, value: 1, easing: 'ease-out' },
      { offsetMs: durationMs, value: 0, easing: 'linear' },
    ]
  }

  const trackParamIds = hephClip.tracks.map(t => t.paramId)
  if (trackParamIds.length === 0) {
    return [
      { offsetMs: 0, value: 0, easing: 'ease-in' },
      { offsetMs: durationMs / 2, value: 1, easing: 'ease-out' },
      { offsetMs: durationMs, value: 0, easing: 'linear' },
    ]
  }

  // ⚒️ WAVE 2040.21: Pick the PRIORITY curve — the most visually meaningful
  let selectedTrack = hephClip.tracks[0]
  for (const priorityKey of VISUAL_PRIORITY_CURVE_KEYS) {
    const track = hephClip.tracks.find(t => t.paramId === priorityKey)
    if (track) {
      selectedTrack = track
      break
    }
  }

  const selectedCurve = selectedTrack.curve
  if (!selectedCurve?.keyframes || selectedCurve.keyframes.length === 0) {
    return [
      { offsetMs: 0, value: 0, easing: 'ease-in' },
      { offsetMs: durationMs / 2, value: 1, easing: 'ease-out' },
      { offsetMs: durationMs, value: 0, easing: 'linear' },
    ]
  }

  return selectedCurve.keyframes.map(kf => {
    // Map HephInterpolation → FXKeyframe easing
    let easing: FXKeyframe['easing'] = 'linear'
    if (kf.interpolation === 'hold') easing = 'step'
    else if (kf.interpolation === 'bezier') {
      // Approximate bezier to closest CSS easing
      if (kf.bezierHandles) {
        const [cx1, , , ] = kf.bezierHandles
        if (cx1 > 0.3) easing = 'ease-in'
        else easing = 'ease-out'
      } else {
        easing = 'ease-in-out'
      }
    }

    return {
      offsetMs: kf.timeMs,
      value: typeof kf.value === 'number' ? kf.value : 1,
      easing,
    }
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// ⚒️ WAVE 2040.19: SHERLOCK MODE — MixBus Auto-Inference
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚒️ WAVE 2040.19: Infer MixBus from clip data.
 * 
 * For legacy .lfx files created before the mixBus field existed,
 * we analyze the clip's curves, name, category, and effectType
 * to deterministically infer the correct MixBus routing.
 * 
 * PRIORITY ORDER (most specific → least specific):
 * 1. hephClip.mixBus — explicit field (new files)
 * 2. Curve analysis — what parameters does the clip automate?
 * 3. Name/category keyword matching — fallback heuristic
 * 4. 'global' — safe default (intensity/dimmer routing)
 * 
 * DETERMINISTA: No hay random. Resultado depende ÚNICAMENTE
 * de los datos del clip. Mismo input → mismo output, siempre.
 */
type MixBusType = 'global' | 'htp' | 'ambient' | 'accent'

const MOVEMENT_CURVE_KEYS = ['pan', 'tilt']
const COLOR_CURVE_KEYS = ['color', 'white', 'amber']
const OPTICS_CURVE_KEYS = ['zoom', 'focus', 'iris', 'gobo1', 'gobo2', 'prism']
const PHYSICAL_CURVE_KEYS = ['intensity', 'strobe']

// Name/category keywords → mixBus mapping
const MOVEMENT_KEYWORDS = ['pan', 'tilt', 'move', 'sweep', 'scanner', 'position', 'track']
const COLOR_KEYWORDS = ['color', 'rgb', 'hue', 'wash', 'rainbow', 'chromatic', 'amber', 'white']
const ACCENT_KEYWORDS = ['gobo', 'prism', 'zoom', 'focus', 'iris', 'optic', 'beam', 'spot']
const GLOBAL_KEYWORDS = ['strobe', 'flash', 'blinder', 'bump', 'pulse', 'dim', 'blackout', 'intensity']

function inferMixBusFromCurves(
  hephClip: HephAutomationClipV3 | undefined,
  name: string,
  effectType: string,
): MixBusType {
  // ── PASS 1: Explicit mixBus in clip data (new .lfx files)
  if (hephClip?.mixBus) {
    return hephClip.mixBus
  }

  // ── PASS 2: Track analysis (most reliable for legacy files)
  if (hephClip?.tracks) {
    const curveKeys = hephClip.tracks.map(t => t.paramId)
    
    const hasMovement = curveKeys.some(k => MOVEMENT_CURVE_KEYS.includes(k))
    const hasColor = curveKeys.some(k => COLOR_CURVE_KEYS.includes(k))
    const hasOptics = curveKeys.some(k => OPTICS_CURVE_KEYS.includes(k))
    const hasPhysical = curveKeys.some(k => PHYSICAL_CURVE_KEYS.includes(k))
    
    // Movement curves → HTP bus (movement is high-priority, HTP blending)
    if (hasMovement && !hasColor && !hasOptics) return 'htp'
    
    // Pure color curves → Ambient bus
    if (hasColor && !hasMovement && !hasOptics) return 'ambient'
    
    // Optics curves → Accent bus
    if (hasOptics) return 'accent'
    
    // Only physical (intensity/strobe) → Global bus
    if (hasPhysical && !hasMovement && !hasColor && !hasOptics) return 'global'
    
    // Mixed curves: movement+color → HTP (movement takes priority)
    if (hasMovement) return 'htp'
    if (hasColor) return 'ambient'
  }

  // ── PASS 3: Name + effectType keyword analysis (legacy fallback)
  const searchText = `${name} ${effectType} ${hephClip?.category || ''}`.toLowerCase()
  const tags = hephClip?.tags?.map(t => t.toLowerCase()) || []
  const allText = `${searchText} ${tags.join(' ')}`

  if (MOVEMENT_KEYWORDS.some(kw => allText.includes(kw))) return 'htp'
  if (COLOR_KEYWORDS.some(kw => allText.includes(kw))) return 'ambient'
  if (ACCENT_KEYWORDS.some(kw => allText.includes(kw))) return 'accent'
  if (GLOBAL_KEYWORDS.some(kw => allText.includes(kw))) return 'global'

  // ── PASS 4: Safe default — global bus (intensity/dimmer routing)
  return 'global'
}

export function createHephFXClip(
  name: string,
  filePath: string,
  startMs: number,
  durationMs: number,
  trackId: string,
  effectType: string = 'custom',
  hephClipData?: HephAutomationClipV3,
  mixBus?: 'global' | 'htp' | 'ambient' | 'accent',
  zones?: string[],
  priority?: number,
): FXClip {
  // ⚒️ WAVE 2040.19: SHERLOCK MODE — Auto-infer mixBus for legacy clips
  const resolvedMixBus: MixBusType = mixBus || inferMixBusFromCurves(hephClipData, name, effectType)
  const color = MIXBUS_CLIP_COLORS[resolvedMixBus] || HEPH_EMBER_COLOR

  // 🐛 WAVE 2040.19: Log inference result
  console.log(`[createHephFXClip] 🔍 "${name}": mixBus=${mixBus || 'INFERRED→' + resolvedMixBus} → color=${color}`)

  // WAVE 2040.17 P6: Use 'heph-custom' for Hephaestus automation clips.
  // Only coerce to a standard FXType if effectType is actually one.
  const resolvedFxType: FXType = toFXType(
    effectType === 'heph_custom' || effectType === 'heph-automation' || effectType === 'custom'
      ? 'heph-custom'
      : effectType
  )

  // WAVE 2040.17 P9: Store only the filename for portability.
  // The .lux file should NOT depend on absolute paths — it must be
  // transferable between machines. The filename is enough to relocate
  // the .lfx file when the library is present.
  const portableFilePath = filePath
    ? filePath.replace(/^.*[\\/]/, '') // Extract filename from any OS path
    : ''

  return {
    id: generateClipId(),
    type: 'fx',
    fxType: resolvedFxType,
    label: name,
    startMs,
    endMs: startMs + durationMs,
    trackId,
    color,
    keyframes: extractVisualKeyframes(hephClipData, durationMs),
    params: { effectType },
    selected: false,
    locked: false,
    // ⚒️ HEPHAESTUS MARKERS — WAVE 2040.17 + 2040.19: Full Diamond Data
    hephFilePath: portableFilePath,
    isHephCustom: true,
    hephClip: hephClipData,
    mixBus: resolvedMixBus,  // ⚒️ WAVE 2040.19: Always resolved (explicit or inferred)
    zones,
    priority,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SNAPPING UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate beat grid positions for snapping
 */
export function calculateBeatGrid(bpm: number, durationMs: number): number[] {
  const msPerBeat = 60000 / bpm
  const beats: number[] = []
  
  for (let t = 0; t <= durationMs; t += msPerBeat) {
    beats.push(Math.round(t))
  }
  
  return beats
}

/**
 * Snap a time value to the nearest beat
 * @returns [snappedTime, didSnap, snapBeat]
 */
export function snapToGrid(
  timeMs: number,
  beatGrid: number[],
  snapThresholdMs: number = 100
): [number, boolean, number | null] {
  let closestBeat: number | null = null
  let closestDistance = Infinity
  
  for (const beat of beatGrid) {
    const distance = Math.abs(timeMs - beat)
    if (distance < closestDistance) {
      closestDistance = distance
      closestBeat = beat
    }
    // Early exit if we've passed the closest
    if (beat > timeMs + snapThresholdMs) break
  }
  
  if (closestBeat !== null && closestDistance <= snapThresholdMs) {
    return [closestBeat, true, closestBeat]
  }
  
  return [timeMs, false, null]
}

// ═══════════════════════════════════════════════════════════════════════════
// DRAG DATA TRANSFER
// ═══════════════════════════════════════════════════════════════════════════

export interface DragPayload {
  /** Source of drag (arsenal, timeline, hephaestus) */
  source: 'arsenal' | 'timeline' | 'hephaestus'
  
  /** Clip type being dragged */
  clipType: ClipType
  
  /** Vibe or FX subtype */
  subType: VibeType | FXType | string
  
  /** If dragging from timeline, existing clip ID */
  clipId?: string
  
  /** Effect ID from EffectRegistry (for FX clips) */
  effectId?: string
  
  /** Default duration for new clips */
  defaultDurationMs: number

  // ── WAVE 2030.6: Hephaestus Automation Clip Fields ──
  
  /** Hephaestus clip ID (if source === 'hephaestus') */
  hephClipId?: string
  
  /** Path to .lfx file (if source === 'hephaestus') */
  hephFilePath?: string
  
  /** Clip name for display */
  name?: string

  // ── WAVE 2040.17: Diamond Data — Full Hephaestus payload ──

  /**
   * Complete HephAutomationClipV3 data.
   * Carried in the drag payload for zero-latency deep copy on drop.
   * Typical .lfx files are <50KB — DataTransfer handles this fine.
   */
  hephClipSerialized?: HephAutomationClipV3

  /** MixBus routing from the Hephaestus clip */
  mixBus?: 'global' | 'htp' | 'ambient' | 'accent'

  /** Effect category from Hephaestus */
  category?: string

  /** Effect type from the .lfx file */
  effectType?: string

  /** Effect zones from Hephaestus */
  zones?: string[]

  /** Effect priority (0-100) */
  priority?: number
}

/**
 * Serialize drag payload for DataTransfer
 */
export function serializeDragPayload(payload: DragPayload): string {
  return JSON.stringify(payload)
}

/**
 * Deserialize drag payload from DataTransfer
 */
export function deserializeDragPayload(data: string): DragPayload | null {
  try {
    return JSON.parse(data) as DragPayload
  } catch {
    return null
  }
}
