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
 * @version WAVE 2006
 */

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
}

// Union type
export type TimelineClip = VibeClip | FXClip

// ═══════════════════════════════════════════════════════════════════════════
// CLIP COLORS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎨 WAVE 2019.8: Vibe colors mapped to real VibeIds
 */
export const VIBE_COLORS: Record<VibeType, string> = {
  'fiesta-latina': '#f59e0b', // 🎉 Orange - Fiesta Latina
  'techno-club': '#a855f7',   // ⚡ Purple - Techno Club
  'chill-lounge': '#22d3ee',  // 🌊 Cyan - Chill Lounge
  'pop-rock': '#ef4444',      // 🎸 Red - Pop Rock
  'idle': '#6b7280',          // 💤 Gray - Idle
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
    color: VIBE_COLORS[vibeType],
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
  /** Source of drag (arsenal, timeline) */
  source: 'arsenal' | 'timeline'
  
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
