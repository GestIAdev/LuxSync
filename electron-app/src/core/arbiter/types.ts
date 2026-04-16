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
 * 
 * 🔥 WAVE 2084: Sincronizado con FixtureDefinition.ChannelType
 * Incluye canales de INGENIOS (rotation, custom, macro, control, frost, etc.)
 */
export type ChannelType =
  // INTENSITY
  | 'dimmer'
  | 'strobe'
  | 'shutter'
  // COLOR
  | 'red'
  | 'green'
  | 'blue'
  | 'white'
  | 'amber'
  | 'uv'
  | 'cyan'
  | 'magenta'
  | 'yellow'
  | 'color_wheel'
  // POSITION
  | 'pan'
  | 'pan_fine'
  | 'tilt'
  | 'tilt_fine'
  // BEAM
  | 'gobo'
  | 'gobo_rotation'
  | 'prism'
  | 'prism_rotation'
  | 'focus'
  | 'zoom'
  | 'frost'
  // CONTROL
  | 'speed'
  | 'macro'
  | 'control'
  // 🔥 WAVE 2084: INGENIOS
  | 'rotation'
  | 'custom'
  // FALLBACK
  | 'unknown'

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
 * 
 * 🔥 WAVE 2084: PHANTOM PANEL — Canales de INGENIOS (rotation, custom, macro, etc.)
 * usan LTP por defecto. Titan/Selene NO inyectan valores en estos canales
 * (eso se controla en arbitrateFixture), pero si alguien los toca manualmente → LTP.
 */
export const DEFAULT_MERGE_STRATEGIES: Record<ChannelType, MergeStrategy> = {
  // INTENSITY
  dimmer: 'HTP',
  strobe: 'LTP',
  shutter: 'LTP',
  // COLOR
  red: 'LTP',
  green: 'LTP',
  blue: 'LTP',
  white: 'LTP',
  amber: 'LTP',
  uv: 'LTP',
  cyan: 'LTP',
  magenta: 'LTP',
  yellow: 'LTP',
  color_wheel: 'LTP',
  // POSITION
  pan: 'LTP',
  pan_fine: 'LTP',
  tilt: 'LTP',
  tilt_fine: 'LTP',
  // BEAM
  gobo: 'LTP',
  gobo_rotation: 'LTP',
  prism: 'LTP',
  prism_rotation: 'LTP',
  focus: 'LTP',
  zoom: 'LTP',
  frost: 'LTP',
  // CONTROL
  speed: 'LTP',
  macro: 'LTP',
  control: 'LTP',
  // 🔥 WAVE 2084: INGENIOS
  rotation: 'LTP',
  custom: 'LTP',
  // FALLBACK
  unknown: 'LTP',
} as const

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 WAVE 2711: CHANNEL CATEGORIES — Segmented override domains
//
// Each UI section operates on a CATEGORY of channels, not individual channels.
// When a new override arrives with channels from a category, it REPLACES all
// channels of that category from the existing override — never accumulates.
// This prevents the "color kidnapping" bug where PositionSection's override
// would inherit stale color channels via blind union merge.
// ═══════════════════════════════════════════════════════════════════════════

export type ChannelCategory = 'color' | 'position' | 'intensity' | 'beam' | 'control' | 'ingenios'

const CHANNEL_CATEGORY_MAP: Record<ChannelType, ChannelCategory> = {
  // COLOR
  red: 'color',
  green: 'color',
  blue: 'color',
  white: 'color',
  amber: 'color',
  uv: 'color',
  cyan: 'color',
  magenta: 'color',
  yellow: 'color',
  color_wheel: 'color',
  // POSITION
  pan: 'position',
  pan_fine: 'position',
  tilt: 'position',
  tilt_fine: 'position',
  // INTENSITY
  dimmer: 'intensity',
  strobe: 'intensity',
  shutter: 'intensity',
  // BEAM
  gobo: 'beam',
  gobo_rotation: 'beam',
  prism: 'beam',
  prism_rotation: 'beam',
  focus: 'beam',
  zoom: 'beam',
  frost: 'beam',
  // CONTROL
  speed: 'control',
  macro: 'control',
  control: 'control',
  // INGENIOS
  rotation: 'ingenios',
  custom: 'ingenios',
  // FALLBACK
  unknown: 'control',
}

/**
 * Get the category for a channel type.
 * Used by setManualOverride to determine which channels to replace vs preserve.
 */
export function getChannelCategory(channel: ChannelType): ChannelCategory {
  return CHANNEL_CATEGORY_MAP[channel] ?? 'control'
}

/**
 * Get all unique categories present in a list of channels.
 */
export function getChannelCategories(channels: ChannelType[]): Set<ChannelCategory> {
  const categories = new Set<ChannelCategory>()
  for (const ch of channels) {
    categories.add(getChannelCategory(ch))
  }
  return categories
}

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
  
  // 🔥 WAVE 1008.2: Movement speed and additional channels
  speed?: number        // 0-255 (0=fast, 255=slow) for Pan/Tilt Speed
  strobe?: number       // 0-255
  gobo?: number         // 0-255
  color_wheel?: number  // 0-255
  
  // 🎚️ WAVE 999: Pattern movement parameters (0-100 scale from UI)
  patternSpeed?: number     // 0-100 → Multiplier for pattern frequency
  patternAmplitude?: number // 0-100 → Multiplier for movement range
  
  // 🔥 WAVE 2084: PHANTOM PANEL — Canales extra para ingenios
  // Mapa dinámico para canales que no tienen campo explícito arriba
  // Clave = ChannelType string, Valor = 0-255 DMX
  phantomChannels?: Record<string, number>
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
// LAYER 3+: EFFECT INTENTS (WAVE 2662 — EL ÁRBITRO ABSOLUTO)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎯 WAVE 2662: EFFECT INTENT — Per-fixture intent from EffectManager
 *
 * Produced by TitanOrchestrator from CombinedEffectOutput (zone-resolved
 * to concrete fixture IDs) and injected into MasterArbiter BEFORE arbitrate().
 *
 * The Arbiter consumes these as Layer 3 input during mergeChannelForFixture().
 * No more post-HAL mutation. Single Source of Truth.
 *
 * MERGE RULES:
 * - dimmer: HTP (Math.max with Layer 0)
 * - color (r/g/b): LTP/REPLACE depending on mixBus
 * - white/amber: Same as color
 * - movement (pan/tilt): LTP overlay
 *
 * mixBus semantics:
 * - 'htp'    → Collaborative: HTP for dimmer, color only wins if brighter
 * - 'global' → Dictator: REPLACE all channels, Iron Curtain for unspecified
 */
export interface EffectIntent {
  /** Final dimmer value 0-255 (already scaled from 0-1) */
  dimmer?: number
  /** Final color RGB 0-255 (already converted from HSL) */
  color?: RGBOutput
  /** White channel 0-255 */
  white?: number
  /** Amber channel 0-255 */
  amber?: number
  /** Movement target */
  movement?: {
    pan?: number   // 0-255
    tilt?: number  // 0-255
    isAbsolute?: boolean
  }
  /** Mix bus mode inherited from the dominant effect */
  mixBus: 'htp' | 'global'
  /** Global composition alpha (0=invisible, 1=dictator) for LERP blending */
  globalComposition: number
}

/**
 * 🎯 WAVE 2662: Map of fixture ID → EffectIntent
 * Pre-resolved from zone overrides to concrete fixture IDs.
 * Injected into MasterArbiter via setEffectIntents() before each arbitrate().
 */
export type EffectIntentMap = Map<string, EffectIntent>

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
  /** 🔥 WAVE 1008.4: Movement speed (0=fast, 255=slow) */
  speed: number  // 0-255
  /** 🎨 WAVE 1008.6: Color wheel position (THE WHEELSMITH) */
  color_wheel: number  // 0-255
  /**
   * 🔥 WAVE 2084: PHANTOM PANEL — Canales extra dinámicos
   * 
   * Mapa para canales que el Arbiter no conoce nativamente (rotation, custom,
   * macro, frost, gobo, gobo_rotation, prism, prism_rotation, shutter, control, etc.)
   * 
   * El Arbiter pasa estos valores directamente al HAL sin transformación.
   * Solo Layer 2 (Manual) puede inyectar valores aquí.
   * Titan/Selene NO generan valores para estos canales → defaultValue del fixture.
   */
  phantomChannels: Record<string, number>
  /** Debug: which layer controls each channel */
  _controlSources: Partial<Record<ChannelType, ControlLayer>>
  /** Debug: is crossfade active */
  _crossfadeActive: boolean
  /** Debug: crossfade progress (0-1) */
  _crossfadeProgress: number
  /**
   * 🎯 WAVE 2603: IK PROCESSED FLAG
   * When true, pan/tilt values have been pre-calibrated by InverseKinematicsEngine.
   * HAL.applyCalibrationOffsets() will skip invert + offset steps (but ALWAYS
   * applies tiltLimits and final clamp) to prevent double-calibration.
   */
  _ikProcessed?: boolean
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
    /** 🎯 WAVE 2662: Number of fixtures with active effect intents */
    effectIntentCount?: number
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
  debug: true,  // ⛺ WAVE 2790: Activado para diagnóstico de cambios de zona oceánica
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
  
  // 🌊 WAVE 1039: Physical position for stereo routing
  position?: {
    x: number  // Negative = Left, Positive = Right
    y: number
    z: number
  }
  
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
  
  // 🎨 WAVE 1001: HAL Translation metadata for color wheel fixtures
  hasColorWheel?: boolean                       // Has physical color wheel (Beam 2R, etc.)
  hasColorMixing?: boolean                      // Has RGB/RGBW LEDs (PARs, Washes)
  profileId?: string                            // Fixture profile ID for HAL translation
}
