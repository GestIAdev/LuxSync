/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎛️ MASTER ARBITER - TYPE DEFINITIONS
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 373: Complete type system for the MasterArbiter control hierarchy.
 * 
 * ARCHITECTURE:
 * - Layer 0: TITAN_AI (base from TitanEngine)
 * - Layer 1: CONSCIOUSNESS (future CORE 3 - SeleneLuxConscious)
 * - Layer 2: MANUAL (user overrides via UI/MIDI)
 * - Layer 3: EFFECTS (temporary effects like strobe/flash)
 * - Layer 4: BLACKOUT (emergency, highest priority)
 * 
 * @module core/arbiter/types
 * @version WAVE 373
 */

import type { LightingIntent, HSLColor, MovementIntent } from '../protocol/LightingIntent'

// ═══════════════════════════════════════════════════════════════════════════
// ENUMS & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Control layer priorities (higher number = higher priority)
 * Used to determine which layer "wins" when multiple layers want to control the same channel.
 */
export enum ControlLayer {
  /** Base: AI-generated intent from TitanEngine */
  TITAN_AI = 0,
  /** Future: Modifications from SeleneLuxConscious (CORE 3) */
  CONSCIOUSNESS = 1,
  /** User manual overrides (faders, joystick, MIDI) */
  MANUAL = 2,
  /** Temporary effects (strobe, flash, blinder) */
  EFFECTS = 3,
  /** Emergency blackout - always wins */
  BLACKOUT = 4,
}

/**
 * Controllable channel types
 * Each fixture can have any combination of these channels.
 */
export type ChannelType =
  | 'dimmer'
  | 'red'
  | 'green'
  | 'blue'
  | 'white'
  | 'pan'
  | 'tilt'
  | 'zoom'
  | 'focus'
  | 'gobo'
  | 'prism'

/**
 * Merge strategy per channel
 * - HTP: Highest Takes Precedence (for intensity channels)
 * - LTP: Latest Takes Precedence (for position/color)
 * - BLEND: Weighted average (for smooth transitions)
 * - OVERRIDE: Complete replacement (for blackout)
 */
export type MergeStrategy = 'HTP' | 'LTP' | 'BLEND' | 'OVERRIDE'

/**
 * Default merge strategies per channel type
 * Industry standard: HTP for intensity, LTP for everything else.
 */
export const DEFAULT_MERGE_STRATEGIES: Record<ChannelType, MergeStrategy> = {
  dimmer: 'HTP',
  red: 'LTP',
  green: 'LTP',
  blue: 'LTP',
  white: 'LTP',
  pan: 'LTP',
  tilt: 'LTP',
  zoom: 'LTP',
  focus: 'LTP',
  gobo: 'LTP',
  prism: 'LTP',
} as const

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 0: TITAN AI
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Layer 0 input: AI-generated lighting intent from TitanEngine.
 * This is the "base" that other layers modify or override.
 */
export interface Layer0_Titan {
  /** The lighting intent from TitanEngine */
  intent: LightingIntent
  /** When this intent was generated */
  timestamp: number
  /** Current vibe ID */
  vibeId: string
  /** Frame number for debugging */
  frameNumber: number
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 1: CONSCIOUSNESS (CORE 3 - FUTURE)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Emotional moods from SeleneLuxConscious
 * Used to modify AI intent based on "felt" emotions.
 */
export type ConsciousMood =
  | 'aggressive'   // Attack mode - sharp, fast
  | 'peaceful'     // Calm - soft, slow
  | 'chaotic'      // Random - unpredictable
  | 'harmonious'   // Balanced - smooth, flowing
  | 'building'     // Rising tension
  | 'releasing'    // Post-climax fade

/**
 * Palette modification from consciousness
 * Modifies the AI-generated palette without replacing it entirely.
 */
export interface PaletteModifier {
  /** Hue rotation in degrees (-180 to +180) */
  hueShift: number
  /** Saturation multiplier (0-2, 1 = no change) */
  saturationScale: number
  /** Lightness multiplier (0-2, 1 = no change) */
  lightnessScale: number
  /** Override primary color entirely (optional) */
  primaryOverride?: HSLColor
  /** Blend amount with AI palette (0 = AI only, 1 = full override) */
  blendAmount: number
}

/**
 * Movement modification from consciousness
 * Modifies the AI-generated movement without replacing it entirely.
 */
export interface MovementModifier {
  /** Amplitude multiplier (0-2) */
  amplitudeScale: number
  /** Speed multiplier (0-2) */
  speedScale: number
  /** Override pattern (optional) */
  patternOverride?: string
  /** Center point bias (-1 to +1, 0 = no bias) */
  centerBias: { x: number; y: number }
}

/**
 * Full consciousness layer input
 * Sent by SeleneLuxConscious when it wants to modify the AI intent.
 */
export interface Layer1_Consciousness {
  /** Whether consciousness is actively modifying */
  active: boolean
  /** Current consciousness status */
  status: 'sleeping' | 'awakening' | 'learning' | 'wise' | 'enlightened'
  /** Palette modifications */
  paletteModifier?: PaletteModifier
  /** Movement modifications */
  movementModifier?: MovementModifier
  /** Emotional overlay */
  emotionalOverlay?: {
    mood: ConsciousMood
    intensity: number  // 0-1
  }
  /** Source of this modification */
  source: 'hunt' | 'dream' | 'evolution' | 'bias_correction'
  /** Confidence in this modification (0-1) */
  confidence: number
  /** Timestamp */
  timestamp: number
  /** TTL in ms (auto-expire, 0 = never) */
  ttl?: number
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 2: MANUAL OVERRIDE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Source of manual control
 * Tracks where the override came from for debugging/UI.
 */
export type ManualControlSource =
  | 'ui_fader'      // On-screen fader
  | 'ui_picker'     // Color picker
  | 'ui_joystick'   // Virtual joystick
  | 'ui_programmer' // The Programmer panel (WAVE 375+)
  | 'midi_fader'    // Physical MIDI fader
  | 'midi_encoder'  // MIDI encoder
  | 'osc'           // OSC input
  | 'calibration'   // Calibration mode

/**
 * Manual override controls
 * Only set channels are overridden - others pass through to AI.
 */
export interface ManualControls {
  dimmer?: number       // 0-255
  red?: number          // 0-255
  green?: number        // 0-255
  blue?: number         // 0-255
  white?: number        // 0-255
  pan?: number          // 0-255 (or -1 to +1 for relative)
  tilt?: number         // 0-255 (or -1 to +1 for relative)
  zoom?: number         // 0-255
  focus?: number        // 0-255
  
  // 🎚️ WAVE 999: Pattern movement parameters (0-100 scale from UI)
  patternSpeed?: number     // 0-100 → Multiplier for pattern frequency
  patternAmplitude?: number // 0-100 → Multiplier for movement range
}

/**
 * Manual override for a single fixture
 */
export interface Layer2_Manual {
  /** Which fixture this applies to */
  fixtureId: string
  /** Control values (only set channels are overridden) */
  controls: ManualControls
  /** Which channels to override (others pass through to AI) */
  overrideChannels: ChannelType[]
  /** Is this a relative adjustment or absolute? */
  mode: 'absolute' | 'relative'
  /** Source of this override */
  source: ManualControlSource
  /** Priority within manual layer (for conflicts between sources) */
  priority: number
  /** When to auto-clear (0 = never) */
  autoReleaseMs: number
  /** Crossfade time when releasing */
  releaseTransitionMs: number
  /** Timestamp */
  timestamp: number
}

/**
 * Group manual override (affects multiple fixtures at once)
 */
export interface Layer2_ManualGroup {
  /** Group identifier */
  groupId: string
  /** Fixtures in this group */
  fixtureIds: string[]
  /** Same controls as single fixture */
  controls: ManualControls
  /** Which channels to override */
  overrideChannels: ChannelType[]
  /** Absolute or relative mode */
  mode: 'absolute' | 'relative'
  /** Source of this override */
  source: ManualControlSource
  /** Timestamp */
  timestamp: number
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 3: EFFECTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Effect types
 * Temporary effects that override normal operation.
 */
export type EffectType =
  | 'strobe'        // Rapid on/off
  | 'flash'         // Single bright burst
  | 'blinder'       // All-white flash
  | 'pulse'         // Rhythmic breathing
  | 'chase'         // Sequential activation
  | 'rainbow'       // Color cycle
  | 'freeze'        // Hold current state

/**
 * Effect definition
 * Represents an active effect with duration.
 */
export interface Layer3_Effect {
  /** Effect type */
  type: EffectType
  /** Effect intensity (0-1) */
  intensity: number
  /** Duration in ms */
  durationMs: number
  /** Start timestamp */
  startTime: number
  /** Affected fixtures (empty = all) */
  fixtureIds: string[]
  /** Effect-specific parameters */
  params: Record<string, number | boolean | string>
}

// ═══════════════════════════════════════════════════════════════════════════
// OUTPUT TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * RGB color output (DMX-ready)
 */
export interface RGBOutput {
  r: number  // 0-255
  g: number  // 0-255
  b: number  // 0-255
}

/**
 * Final target for a single fixture
 * This is what gets sent to HAL for rendering.
 */
export interface FixtureLightingTarget {
  /** Fixture identifier */
  fixtureId: string
  /** Final dimmer value */
  dimmer: number  // 0-255
  /** Final color */
  color: RGBOutput
  /** Final position */
  pan: number   // 0-255
  tilt: number  // 0-255
  /** Final optics */
  zoom: number   // 0-255
  focus: number  // 0-255
  /** Debug: which layer controls each channel */
  _controlSources: Partial<Record<ChannelType, ControlLayer>>
  /** Debug: is crossfade active */
  _crossfadeActive: boolean
  /** Debug: crossfade progress (0-1) */
  _crossfadeProgress: number
}

/**
 * Global effects state
 * Aggregate state of all active global effects.
 */
export interface GlobalEffectsState {
  strobeActive: boolean
  strobeSpeed: number  // Hz
  blinderActive: boolean
  blinderIntensity: number
  blackoutActive: boolean
  freezeActive: boolean
}

/**
 * Complete arbiter output
 * The final result of arbitration, ready for HAL.
 */
export interface FinalLightingTarget {
  /** Per-fixture targets */
  fixtures: FixtureLightingTarget[]
  /** Global effects */
  globalEffects: GlobalEffectsState
  /** Processing timestamp */
  timestamp: number
  /** Frame number */
  frameNumber: number
  /** Debug: layer activity summary */
  _layerActivity: {
    titanActive: boolean
    titanVibeId: string
    consciousnessActive: boolean
    consciousnessStatus?: string
    manualOverrideCount: number
    manualFixtureIds: string[]
    activeEffects: EffectType[]
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ARBITER CONFIG
// ═══════════════════════════════════════════════════════════════════════════

/**
 * MasterArbiter configuration
 */
export interface MasterArbiterConfig {
  /** Default crossfade time when releasing manual control (ms) */
  defaultCrossfadeMs: number
  /** Max active manual overrides (memory protection) */
  maxManualOverrides: number
  /** Max active effects */
  maxActiveEffects: number
  /** Enable consciousness layer (CORE 3) */
  consciousnessEnabled: boolean
  /** Debug logging */
  debug: boolean
}

/**
 * Default arbiter configuration
 */
export const DEFAULT_ARBITER_CONFIG: MasterArbiterConfig = {
  defaultCrossfadeMs: 500,
  maxManualOverrides: 64,
  maxActiveEffects: 8,
  consciousnessEnabled: false,  // Will be true in CORE 3
  debug: false,
} as const

// ═══════════════════════════════════════════════════════════════════════════
// INTERNAL TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Channel value from a specific layer
 * Used internally for merge calculations.
 */
export interface ChannelValue {
  layer: ControlLayer
  value: number
  timestamp: number
  weight?: number
}

/**
 * Merge result for a channel
 */
export interface MergeResult {
  value: number
  source: ControlLayer
}

/**
 * Internal fixture values during arbitration
 * All values are 0-255 DMX range.
 */
export interface FixtureValues {
  dimmer: number
  red: number
  green: number
  blue: number
  white: number
  pan: number
  tilt: number
  zoom: number
  focus: number
}

/**
 * Crossfade result with metadata
 */
export interface CrossfadeResult extends FixtureValues {
  hasCrossfade: boolean
  avgProgress: number
}

/**
 * Transition state for crossfades
 * Used by CrossfadeEngine to track active transitions.
 */
export interface TransitionState {
  /** Current phase of the transition */
  phase: 'pending' | 'in-progress' | 'complete'
  /** Progress from 0 to 1 */
  progress: number
  /** When transition started */
  startTime: number
  /** Total duration in ms */
  duration: number
}

// ═══════════════════════════════════════════════════════════════════════════
// PATCHED FIXTURE TYPE (for reference)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🩸 WAVE 382: Extended fixture interface for arbiter
 * Now includes capabilities and type for proper UI control rendering.
 * The full PatchedFixture comes from HAL, but arbiter needs these fields.
 */
export interface ArbiterFixture {
  id?: string
  name: string
  zone?: string
  type: string                                  // 🔴 REQUIRED - Para UI Pan/Tilt detection
  dmxAddress: number
  universe: number
  
  // 🩸 WAVE 382: Restored metadata for UI control visibility
  capabilities?: {
    hasColor?: boolean
    hasDimmer?: boolean
    hasMovement?: boolean
    hasZoom?: boolean
    hasFocus?: boolean
    hasGobo?: boolean
    hasPrism?: boolean
  }
  hasMovementChannels?: boolean                 // 🔴 Para detectar movers sin parsear type
  channels?: string[]                           // Lista de canales disponibles
}
