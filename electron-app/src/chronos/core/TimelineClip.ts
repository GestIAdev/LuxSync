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

import type { HephAutomationClip, HephAutomationClipSerialized } from '../../core/hephaestus/types'

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
   * ⚒️ WAVE 2040.17: DIAMOND DATA — Deep copy of Hephaestus automation curves
   * 
   * Stored as HephAutomationClipSerialized (Record<>, NOT Map<>)
   * so it survives JSON.stringify without data loss.
   * 
   * Contains the COMPLETE automation data: all curves, zones, mixBus,
   * priority, staticParams. The .lux file is self-contained.
   * The reproductor reads directly from this — no .lfx dependency.
   * 
   * Opcional: clips legacy/Arsenal sin hephClip funcionan normalmente.
   */
  hephClip?: HephAutomationClipSerialized
  
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
  'strobe': '#fef08a',        // Yellow
  'sweep': '#22d3ee',         // Cyan
  'pulse': '#f87171',         // Red
  'chase': '#a78bfa',         // Purple
  'fade': '#60a5fa',          // Blue
  'blackout': '#1f2937',      // Dark gray
  'color-wash': '#34d399',    // Emerald
  'intensity-ramp': '#fbbf24', // Amber
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
 */
export function createFXClip(
  fxType: FXType,
  startMs: number,
  durationMs: number,
  trackId: string
): FXClip {
  return {
    id: generateClipId(),
    type: 'fx',
    fxType,
    label: fxType.toUpperCase().replace('-', ' '),
    startMs,
    endMs: startMs + durationMs,
    trackId,
    color: FX_COLORS[fxType],
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
 * WAVE 2040.17: Now accepts full hephClip data (serialized),
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
 * ⚒️ WAVE 2040.17: Extract visual keyframes from hephClip intensity curve.
 * Creates a summary of the real curve for timeline visualization.
 * If no intensity curve, returns the 3-point default.
 */
function extractVisualKeyframes(
  hephClip: HephAutomationClipSerialized | undefined,
  durationMs: number
): FXKeyframe[] {
  if (!hephClip?.curves?.intensity) {
    // Fallback: generic 3-point envelope
    return [
      { offsetMs: 0, value: 0, easing: 'ease-in' },
      { offsetMs: durationMs / 2, value: 1, easing: 'ease-out' },
      { offsetMs: durationMs, value: 0, easing: 'linear' },
    ]
  }

  const intensityCurve = hephClip.curves.intensity
  return intensityCurve.keyframes.map(kf => {
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

export function createHephFXClip(
  name: string,
  filePath: string,
  startMs: number,
  durationMs: number,
  trackId: string,
  effectType: string = 'custom',
  hephClipSerialized?: HephAutomationClipSerialized,
  mixBus?: 'global' | 'htp' | 'ambient' | 'accent',
  zones?: string[],
  priority?: number,
): FXClip {
  // WAVE 2040.17: Derive color from mixBus (coherent with FX track colors)
  const color = mixBus ? (MIXBUS_CLIP_COLORS[mixBus] || HEPH_EMBER_COLOR) : HEPH_EMBER_COLOR

  // 🐛 WAVE 2040.18: DEBUG — Log what mixBus we're getting
  console.log(`[createHephFXClip] 🎨 "${name}": mixBus=${mixBus || 'undefined'} → color=${color}`)

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
    keyframes: extractVisualKeyframes(hephClipSerialized, durationMs),
    params: { effectType },
    selected: false,
    locked: false,
    // ⚒️ HEPHAESTUS MARKERS — WAVE 2040.17: Full Diamond Data
    hephFilePath: portableFilePath,
    isHephCustom: true,
    hephClip: hephClipSerialized,
    mixBus,
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
   * Complete serialized HephAutomationClip (Record<>, not Map<>).
   * Carried in the drag payload for zero-latency deep copy on drop.
   * Typical .lfx files are <50KB — DataTransfer handles this fine.
   */
  hephClipSerialized?: HephAutomationClipSerialized

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
