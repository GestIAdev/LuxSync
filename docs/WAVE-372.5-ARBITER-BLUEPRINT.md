# WAVE 372.5: MASTER ARBITER TECHNICAL BLUEPRINT

**Date:** 2026-01-12  
**Status:** 📐 BLUEPRINT READY  
**Depends On:** WAVE-372-DATAFLOW-AUTOPSY.md

---

## 🎯 OBJECTIVE

Diseño técnico completo del MasterArbiter para implementación en WAVE 373+.

---

## 1. 📁 FILE STRUCTURE

```
src/core/arbiter/
├── MasterArbiter.ts          # Main arbiter class
├── index.ts                  # Exports
├── types.ts                  # All interfaces
├── layers/
│   ├── Layer0_Titan.ts       # AI layer handling
│   ├── Layer1_Consciousness.ts  # Consciousness modifier (CORE 3)
│   ├── Layer2_Manual.ts      # Manual override handling
│   └── Layer3_Effects.ts     # Effect overlay handling
├── merge/
│   ├── MergeStrategies.ts    # HTP, LTP, BLEND implementations
│   └── CrossfadeEngine.ts    # Smooth transitions
└── __tests__/
    ├── MasterArbiter.test.ts
    └── MergeStrategies.test.ts
```

---

## 2. 📐 COMPLETE TYPE DEFINITIONS

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// src/core/arbiter/types.ts
// ═══════════════════════════════════════════════════════════════════════════

import type { LightingIntent, HSLColor, MovementIntent } from '../protocol/LightingIntent'
import type { PatchedFixture } from '../../hal/mapping/FixtureMapper'

// ─────────────────────────────────────────────────────────────────────────
// ENUMS & CONSTANTS
// ─────────────────────────────────────────────────────────────────────────

/** Control layer priorities (higher = more priority) */
export enum ControlLayer {
  TITAN_AI = 0,
  CONSCIOUSNESS = 1,
  MANUAL = 2,
  EFFECTS = 3,
  BLACKOUT = 4,
}

/** Controllable channel types */
export type ChannelType = 
  | 'dimmer'
  | 'red' | 'green' | 'blue'
  | 'pan' | 'tilt'
  | 'zoom' | 'focus'
  | 'gobo' | 'prism'

/** Merge strategy per channel */
export type MergeStrategy = 'HTP' | 'LTP' | 'BLEND' | 'OVERRIDE'

/** Default merge strategies per channel type */
export const DEFAULT_MERGE_STRATEGIES: Record<ChannelType, MergeStrategy> = {
  dimmer: 'HTP',
  red: 'LTP',
  green: 'LTP',
  blue: 'LTP',
  pan: 'LTP',
  tilt: 'LTP',
  zoom: 'LTP',
  focus: 'LTP',
  gobo: 'LTP',
  prism: 'LTP',
}

// ─────────────────────────────────────────────────────────────────────────
// LAYER 0: TITAN AI
// ─────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────
// LAYER 1: CONSCIOUSNESS (CORE 3 - FUTURE)
// ─────────────────────────────────────────────────────────────────────────

/** Emotional moods from SeleneLuxConscious */
export type ConsciousMood = 
  | 'aggressive'   // Attack mode - sharp, fast
  | 'peaceful'     // Calm - soft, slow
  | 'chaotic'      // Random - unpredictable
  | 'harmonious'   // Balanced - smooth, flowing
  | 'building'     // Rising tension
  | 'releasing'    // Post-climax fade

/** Palette modification from consciousness */
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

/** Movement modification from consciousness */
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

/** Full consciousness layer input */
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
  /** TTL in ms (auto-expire) */
  ttl?: number
}

// ─────────────────────────────────────────────────────────────────────────
// LAYER 2: MANUAL OVERRIDE
// ─────────────────────────────────────────────────────────────────────────

/** Source of manual control */
export type ManualControlSource = 
  | 'ui_fader'      // On-screen fader
  | 'ui_picker'     // Color picker
  | 'ui_joystick'   // Virtual joystick
  | 'midi_fader'    // Physical MIDI fader
  | 'midi_encoder'  // MIDI encoder
  | 'osc'           // OSC input
  | 'calibration'   // Calibration mode

/** Manual override for a single fixture */
export interface Layer2_Manual {
  /** Which fixture this applies to */
  fixtureId: string
  /** Control values (only set channels are overridden) */
  controls: Partial<{
    dimmer: number       // 0-255
    red: number          // 0-255
    green: number        // 0-255
    blue: number         // 0-255
    pan: number          // 0-255 (or -1 to +1 for relative)
    tilt: number         // 0-255 (or -1 to +1 for relative)
    zoom: number         // 0-255
    focus: number        // 0-255
  }>
  /** Which channels to override (others pass through to AI) */
  overrideChannels: ChannelType[]
  /** Is this a relative adjustment or absolute? */
  mode: 'absolute' | 'relative'
  /** Source of this override */
  source: ManualControlSource
  /** Priority within manual layer (for conflicts) */
  priority: number
  /** When to auto-clear (0 = never) */
  autoReleaseMs: number
  /** Crossfade time when releasing */
  releaseTransitionMs: number
  /** Timestamp */
  timestamp: number
}

/** Group manual override (affects multiple fixtures) */
export interface Layer2_ManualGroup {
  /** Group identifier */
  groupId: string
  /** Fixtures in this group */
  fixtureIds: string[]
  /** Same controls as single fixture */
  controls: Partial<Layer2_Manual['controls']>
  overrideChannels: ChannelType[]
  mode: 'absolute' | 'relative'
  source: ManualControlSource
  timestamp: number
}

// ─────────────────────────────────────────────────────────────────────────
// LAYER 3: EFFECTS
// ─────────────────────────────────────────────────────────────────────────

/** Effect types */
export type EffectType = 
  | 'strobe'        // Rapid on/off
  | 'flash'         // Single bright burst
  | 'blinder'       // All-white flash
  | 'pulse'         // Rhythmic breathing
  | 'chase'         // Sequential activation
  | 'rainbow'       // Color cycle
  | 'freeze'        // Hold current state

/** Effect definition */
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

// ─────────────────────────────────────────────────────────────────────────
// OUTPUT TYPES
// ─────────────────────────────────────────────────────────────────────────

/** RGB color output */
export interface RGBOutput {
  r: number  // 0-255
  g: number  // 0-255
  b: number  // 0-255
}

/** Final target for a single fixture */
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
  /** Debug: crossfade state */
  _crossfadeActive: boolean
  _crossfadeProgress: number
}

/** Global effects state */
export interface GlobalEffectsState {
  strobeActive: boolean
  strobeSpeed: number  // Hz
  blinderActive: boolean
  blinderIntensity: number
  blackoutActive: boolean
  freezeActive: boolean
}

/** Complete arbiter output */
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

// ─────────────────────────────────────────────────────────────────────────
// ARBITER CONFIG
// ─────────────────────────────────────────────────────────────────────────

export interface MasterArbiterConfig {
  /** Default crossfade time when releasing manual control */
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

export const DEFAULT_ARBITER_CONFIG: MasterArbiterConfig = {
  defaultCrossfadeMs: 500,
  maxManualOverrides: 64,
  maxActiveEffects: 8,
  consciousnessEnabled: false,  // Will be true in CORE 3
  debug: false,
}
```

---

## 3. 🔧 MERGE STRATEGY IMPLEMENTATIONS

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// src/core/arbiter/merge/MergeStrategies.ts
// ═══════════════════════════════════════════════════════════════════════════

import type { MergeStrategy } from '../types'

/**
 * HTP (Highest Takes Precedence)
 * Used for dimmers - whoever wants more light wins
 */
export function mergeHTP(values: number[]): number {
  if (values.length === 0) return 0
  return Math.max(...values)
}

/**
 * LTP (Latest Takes Precedence)
 * Used for position/color - most recent value wins
 */
export function mergeLTP<T>(
  values: Array<{ value: T; timestamp: number }>
): T | undefined {
  if (values.length === 0) return undefined
  
  // Sort by timestamp descending, return most recent
  const sorted = [...values].sort((a, b) => b.timestamp - a.timestamp)
  return sorted[0].value
}

/**
 * BLEND (Weighted Average)
 * Used for smooth transitions
 */
export function mergeBLEND(
  values: Array<{ value: number; weight: number }>
): number {
  if (values.length === 0) return 0
  
  const totalWeight = values.reduce((sum, v) => sum + v.weight, 0)
  if (totalWeight === 0) return 0
  
  return values.reduce((sum, v) => sum + v.value * v.weight, 0) / totalWeight
}

/**
 * OVERRIDE (Complete replacement)
 * Used for blackout - ignores all other layers
 */
export function mergeOVERRIDE<T>(overrideValue: T): T {
  return overrideValue
}

// ═══════════════════════════════════════════════════════════════════════════
// CHANNEL MERGER
// ═══════════════════════════════════════════════════════════════════════════

interface ChannelValue {
  layer: ControlLayer
  value: number
  timestamp: number
  weight?: number
}

/**
 * Merge multiple channel values using appropriate strategy
 */
export function mergeChannel(
  channelType: ChannelType,
  values: ChannelValue[],
  strategy: MergeStrategy = DEFAULT_MERGE_STRATEGIES[channelType]
): { value: number; source: ControlLayer } {
  if (values.length === 0) {
    return { value: 0, source: ControlLayer.TITAN_AI }
  }
  
  // Sort by layer priority (highest first)
  const sorted = [...values].sort((a, b) => b.layer - a.layer)
  
  switch (strategy) {
    case 'HTP':
      const htpValue = mergeHTP(sorted.map(v => v.value))
      const htpSource = sorted.find(v => v.value === htpValue)?.layer ?? ControlLayer.TITAN_AI
      return { value: htpValue, source: htpSource }
    
    case 'LTP':
      const ltpValue = mergeLTP(sorted.map(v => ({ value: v.value, timestamp: v.timestamp })))
      const ltpSource = sorted.find(v => v.value === ltpValue)?.layer ?? ControlLayer.TITAN_AI
      return { value: ltpValue ?? 0, source: ltpSource }
    
    case 'BLEND':
      const blendValue = mergeBLEND(sorted.map(v => ({ value: v.value, weight: v.weight ?? 1 })))
      return { value: blendValue, source: sorted[0].layer }
    
    case 'OVERRIDE':
      return { value: sorted[0].value, source: sorted[0].layer }
    
    default:
      return { value: sorted[0].value, source: sorted[0].layer }
  }
}
```

---

## 4. 🔄 CROSSFADE ENGINE

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// src/core/arbiter/merge/CrossfadeEngine.ts
// ═══════════════════════════════════════════════════════════════════════════

export interface CrossfadeState {
  fixtureId: string
  channelType: ChannelType
  fromValue: number
  toLayer: ControlLayer
  startTime: number
  durationMs: number
  easingFunction: EasingFunction
}

export type EasingFunction = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'

const EASING_FUNCTIONS: Record<EasingFunction, (t: number) => number> = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => t * (2 - t),
  easeInOut: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
}

export class CrossfadeEngine {
  private activeTransitions: Map<string, CrossfadeState> = new Map()
  
  /**
   * Start a crossfade transition
   */
  startCrossfade(
    fixtureId: string,
    channelType: ChannelType,
    fromValue: number,
    toLayer: ControlLayer,
    durationMs: number,
    easing: EasingFunction = 'easeInOut'
  ): void {
    const key = `${fixtureId}:${channelType}`
    
    this.activeTransitions.set(key, {
      fixtureId,
      channelType,
      fromValue,
      toLayer,
      startTime: Date.now(),
      durationMs,
      easingFunction: easing,
    })
  }
  
  /**
   * Get crossfade progress for a channel (0-1)
   */
  getProgress(fixtureId: string, channelType: ChannelType): number | null {
    const key = `${fixtureId}:${channelType}`
    const transition = this.activeTransitions.get(key)
    
    if (!transition) return null
    
    const elapsed = Date.now() - transition.startTime
    const rawProgress = Math.min(1, elapsed / transition.durationMs)
    const easingFn = EASING_FUNCTIONS[transition.easingFunction]
    
    return easingFn(rawProgress)
  }
  
  /**
   * Apply crossfade to blend between from and to values
   */
  applyTransition(
    fixtureId: string,
    channelType: ChannelType,
    targetValue: number
  ): { value: number; active: boolean; progress: number } {
    const key = `${fixtureId}:${channelType}`
    const transition = this.activeTransitions.get(key)
    
    if (!transition) {
      return { value: targetValue, active: false, progress: 1 }
    }
    
    const progress = this.getProgress(fixtureId, channelType) ?? 1
    
    // Crossfade complete
    if (progress >= 1) {
      this.activeTransitions.delete(key)
      return { value: targetValue, active: false, progress: 1 }
    }
    
    // Blend
    const blendedValue = transition.fromValue + (targetValue - transition.fromValue) * progress
    return { value: blendedValue, active: true, progress }
  }
  
  /**
   * Cancel all transitions for a fixture
   */
  cancelTransitions(fixtureId: string): void {
    for (const key of this.activeTransitions.keys()) {
      if (key.startsWith(fixtureId + ':')) {
        this.activeTransitions.delete(key)
      }
    }
  }
  
  /**
   * Clean up completed transitions
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, transition] of this.activeTransitions) {
      if (now - transition.startTime > transition.durationMs) {
        this.activeTransitions.delete(key)
      }
    }
  }
}
```

---

## 5. 🎛️ MASTER ARBITER IMPLEMENTATION

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// src/core/arbiter/MasterArbiter.ts
// ═══════════════════════════════════════════════════════════════════════════

import { EventEmitter } from 'events'
import type {
  ControlLayer,
  ChannelType,
  Layer0_Titan,
  Layer1_Consciousness,
  Layer2_Manual,
  Layer3_Effect,
  FixtureLightingTarget,
  FinalLightingTarget,
  GlobalEffectsState,
  MasterArbiterConfig,
  DEFAULT_ARBITER_CONFIG,
} from './types'
import { mergeChannel, DEFAULT_MERGE_STRATEGIES } from './merge/MergeStrategies'
import { CrossfadeEngine } from './merge/CrossfadeEngine'
import type { PatchedFixture } from '../../hal/mapping/FixtureMapper'
import type { LightingIntent } from '../protocol/LightingIntent'
import { hslToRgb } from '../protocol/LightingIntent'

// ═══════════════════════════════════════════════════════════════════════════
// MASTER ARBITER CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class MasterArbiter extends EventEmitter {
  // Configuration
  private config: MasterArbiterConfig
  
  // Layer state
  private layer0: Layer0_Titan | null = null
  private layer1: Layer1_Consciousness | null = null
  private layer2: Map<string, Layer2_Manual> = new Map()
  private layer3: Layer3_Effect[] = []
  
  // Global state
  private blackoutActive = false
  
  // Crossfade engine
  private crossfader: CrossfadeEngine
  
  // Frame counter
  private frameNumber = 0
  
  constructor(config: Partial<MasterArbiterConfig> = {}) {
    super()
    this.config = { ...DEFAULT_ARBITER_CONFIG, ...config }
    this.crossfader = new CrossfadeEngine()
    
    console.log('[MasterArbiter] 🎛️ Initialized')
    if (this.config.debug) {
      console.log('[MasterArbiter] Config:', this.config)
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // LAYER 0: TITAN AI
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Update Layer 0 with new AI intent
   * Called every frame by TitanOrchestrator
   */
  setTitanIntent(intent: LightingIntent, vibeId: string): void {
    this.layer0 = {
      intent,
      timestamp: Date.now(),
      vibeId,
      frameNumber: this.frameNumber,
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // LAYER 1: CONSCIOUSNESS (CORE 3)
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Update Layer 1 with consciousness modifier
   * Called by SeleneLuxConscious when active
   */
  setConsciousnessModifier(modifier: Layer1_Consciousness): void {
    if (!this.config.consciousnessEnabled) {
      console.warn('[MasterArbiter] Consciousness disabled in config')
      return
    }
    
    this.layer1 = modifier
    this.emit('consciousness-updated', {
      status: modifier.status,
      source: modifier.source,
      confidence: modifier.confidence,
    })
  }
  
  /**
   * Clear consciousness modifier
   */
  clearConsciousness(): void {
    this.layer1 = null
    this.emit('consciousness-cleared')
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // LAYER 2: MANUAL OVERRIDE
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Set manual override for a fixture
   */
  setManualOverride(override: Layer2_Manual): void {
    // Check limits
    if (this.layer2.size >= this.config.maxManualOverrides && 
        !this.layer2.has(override.fixtureId)) {
      console.warn('[MasterArbiter] Max manual overrides reached')
      return
    }
    
    this.layer2.set(override.fixtureId, {
      ...override,
      timestamp: Date.now(),
    })
    
    this.emit('manual-override-set', {
      fixtureId: override.fixtureId,
      channels: override.overrideChannels,
      source: override.source,
    })
  }
  
  /**
   * Clear manual override for a fixture
   * Optionally specify which channels to clear
   */
  clearManualOverride(
    fixtureId: string, 
    channels?: ChannelType[],
    crossfadeMs?: number
  ): void {
    const existing = this.layer2.get(fixtureId)
    if (!existing) return
    
    if (channels && channels.length > 0) {
      // Clear specific channels
      existing.overrideChannels = existing.overrideChannels.filter(
        ch => !channels.includes(ch)
      )
      
      // Start crossfade for cleared channels
      const fadeDuration = crossfadeMs ?? existing.releaseTransitionMs ?? this.config.defaultCrossfadeMs
      for (const channel of channels) {
        const currentValue = existing.controls[channel as keyof typeof existing.controls]
        if (currentValue !== undefined) {
          this.crossfader.startCrossfade(
            fixtureId,
            channel,
            currentValue,
            ControlLayer.TITAN_AI,
            fadeDuration
          )
        }
      }
      
      if (existing.overrideChannels.length === 0) {
        this.layer2.delete(fixtureId)
      }
    } else {
      // Clear all channels
      const fadeDuration = crossfadeMs ?? existing.releaseTransitionMs ?? this.config.defaultCrossfadeMs
      for (const channel of existing.overrideChannels) {
        const currentValue = existing.controls[channel as keyof typeof existing.controls]
        if (currentValue !== undefined) {
          this.crossfader.startCrossfade(
            fixtureId,
            channel,
            currentValue,
            ControlLayer.TITAN_AI,
            fadeDuration
          )
        }
      }
      this.layer2.delete(fixtureId)
    }
    
    this.emit('manual-override-cleared', { fixtureId, channels })
  }
  
  /**
   * Clear all manual overrides
   */
  clearAllManualOverrides(crossfadeMs?: number): void {
    for (const fixtureId of this.layer2.keys()) {
      this.clearManualOverride(fixtureId, undefined, crossfadeMs)
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // LAYER 3: EFFECTS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Trigger an effect
   */
  triggerEffect(effect: Omit<Layer3_Effect, 'startTime'>): void {
    // Check limits
    if (this.layer3.length >= this.config.maxActiveEffects) {
      // Remove oldest effect
      this.layer3.shift()
    }
    
    this.layer3.push({
      ...effect,
      startTime: Date.now(),
    })
    
    this.emit('effect-triggered', { type: effect.type, intensity: effect.intensity })
  }
  
  /**
   * Cancel an effect type
   */
  cancelEffect(type: Layer3_Effect['type']): void {
    this.layer3 = this.layer3.filter(fx => fx.type !== type)
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // BLACKOUT
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Set emergency blackout
   */
  setBlackout(active: boolean): void {
    this.blackoutActive = active
    this.emit('blackout', active)
    
    if (active) {
      console.log('[MasterArbiter] ⚫ BLACKOUT ACTIVATED')
    } else {
      console.log('[MasterArbiter] 🔴 BLACKOUT DEACTIVATED')
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // MAIN ARBITRATION
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * MAIN METHOD: Arbitrate all layers and produce final targets
   * Called every frame by TitanOrchestrator
   */
  arbitrate(fixtures: PatchedFixture[]): FinalLightingTarget {
    this.frameNumber++
    const now = Date.now()
    
    // Cleanup expired effects
    this.layer3 = this.layer3.filter(fx => now - fx.startTime < fx.durationMs)
    
    // Cleanup expired manual overrides
    for (const [fixtureId, manual] of this.layer2) {
      if (manual.autoReleaseMs > 0 && now - manual.timestamp > manual.autoReleaseMs) {
        this.clearManualOverride(fixtureId)
      }
    }
    
    // Cleanup crossfader
    this.crossfader.cleanup()
    
    // Handle blackout (highest priority)
    if (this.blackoutActive) {
      return this.generateBlackoutTarget(fixtures, now)
    }
    
    // Arbitrate each fixture
    const fixtureTargets = fixtures.map(fixture => 
      this.arbitrateFixture(fixture, now)
    )
    
    // Build global effects state
    const globalEffects = this.buildGlobalEffects()
    
    return {
      fixtures: fixtureTargets,
      globalEffects,
      timestamp: now,
      frameNumber: this.frameNumber,
      _layerActivity: {
        titanActive: this.layer0 !== null,
        titanVibeId: this.layer0?.vibeId ?? 'unknown',
        consciousnessActive: this.layer1?.active ?? false,
        consciousnessStatus: this.layer1?.status,
        manualOverrideCount: this.layer2.size,
        manualFixtureIds: Array.from(this.layer2.keys()),
        activeEffects: this.layer3.map(fx => fx.type),
      },
    }
  }
  
  /**
   * Arbitrate a single fixture
   */
  private arbitrateFixture(fixture: PatchedFixture, now: number): FixtureLightingTarget {
    const fixtureId = fixture.id || fixture.name
    const zone = fixture.zone || 'UNASSIGNED'
    const controlSources: Partial<Record<ChannelType, ControlLayer>> = {}
    
    // Get base values from Layer 0 (Titan AI)
    const titanValues = this.extractTitanValues(fixture, zone)
    
    // Apply Layer 1 (Consciousness) modifications
    let modifiedValues = { ...titanValues }
    if (this.layer1?.active) {
      modifiedValues = this.applyConsciousnessModifier(modifiedValues)
    }
    
    // Check Layer 2 (Manual) overrides
    const manual = this.layer2.get(fixtureId)
    if (manual) {
      modifiedValues = this.applyManualOverride(modifiedValues, manual, controlSources)
    }
    
    // Apply Layer 3 (Effects)
    modifiedValues = this.applyEffects(modifiedValues, fixtureId, now, controlSources)
    
    // Apply crossfade transitions
    const crossfadeResult = this.applyCrossfades(modifiedValues, fixtureId, controlSources)
    
    return {
      fixtureId,
      dimmer: Math.round(crossfadeResult.dimmer),
      color: {
        r: Math.round(crossfadeResult.red),
        g: Math.round(crossfadeResult.green),
        b: Math.round(crossfadeResult.blue),
      },
      pan: Math.round(crossfadeResult.pan),
      tilt: Math.round(crossfadeResult.tilt),
      zoom: Math.round(crossfadeResult.zoom),
      focus: Math.round(crossfadeResult.focus),
      _controlSources: controlSources,
      _crossfadeActive: crossfadeResult.hasCrossfade,
      _crossfadeProgress: crossfadeResult.avgProgress,
    }
  }
  
  // ... (helper methods: extractTitanValues, applyConsciousnessModifier, etc.)
}
```

---

## 6. 📡 IPC INTEGRATION

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// electron/ipc/arbiterHandlers.ts
// ═══════════════════════════════════════════════════════════════════════════

import { ipcMain } from 'electron'
import type { MasterArbiter } from '../core/arbiter/MasterArbiter'
import type { Layer2_Manual, Layer3_Effect, ChannelType } from '../core/arbiter/types'

export function setupArbiterIPC(arbiter: MasterArbiter) {
  
  // ═══════════════════════════════════════════════════════════════════════
  // MANUAL OVERRIDE HANDLERS
  // ═══════════════════════════════════════════════════════════════════════
  
  ipcMain.handle('arbiter:setManualOverride', (_, override: Layer2_Manual) => {
    arbiter.setManualOverride(override)
    return { success: true }
  })
  
  ipcMain.handle('arbiter:clearManualOverride', (_, { 
    fixtureId, 
    channels, 
    crossfadeMs 
  }: { 
    fixtureId: string
    channels?: ChannelType[]
    crossfadeMs?: number
  }) => {
    arbiter.clearManualOverride(fixtureId, channels, crossfadeMs)
    return { success: true }
  })
  
  ipcMain.handle('arbiter:clearAllManualOverrides', (_, crossfadeMs?: number) => {
    arbiter.clearAllManualOverrides(crossfadeMs)
    return { success: true }
  })
  
  // ═══════════════════════════════════════════════════════════════════════
  // EFFECT HANDLERS
  // ═══════════════════════════════════════════════════════════════════════
  
  ipcMain.handle('arbiter:triggerEffect', (_, effect: Omit<Layer3_Effect, 'startTime'>) => {
    arbiter.triggerEffect(effect)
    return { success: true }
  })
  
  ipcMain.handle('arbiter:cancelEffect', (_, type: Layer3_Effect['type']) => {
    arbiter.cancelEffect(type)
    return { success: true }
  })
  
  // ═══════════════════════════════════════════════════════════════════════
  // BLACKOUT
  // ═══════════════════════════════════════════════════════════════════════
  
  ipcMain.handle('arbiter:setBlackout', (_, active: boolean) => {
    arbiter.setBlackout(active)
    return { success: true }
  })
  
  // ═══════════════════════════════════════════════════════════════════════
  // CALIBRATION MODE (Convenience wrapper)
  // ═══════════════════════════════════════════════════════════════════════
  
  ipcMain.handle('arbiter:enterCalibrationMode', (_, fixtureId: string) => {
    // Set manual override for position only
    arbiter.setManualOverride({
      fixtureId,
      controls: {},  // Will be set by user
      overrideChannels: ['pan', 'tilt'],
      mode: 'absolute',
      source: 'calibration',
      priority: 1,
      autoReleaseMs: 0,  // Manual release
      releaseTransitionMs: 1000,  // 1s smooth return
      timestamp: Date.now(),
    })
    return { success: true }
  })
  
  ipcMain.handle('arbiter:exitCalibrationMode', (_, fixtureId: string) => {
    arbiter.clearManualOverride(fixtureId, ['pan', 'tilt'], 1000)
    return { success: true }
  })
}
```

---

## 7. 🧪 TEST SCENARIOS

### 7.1 Calibration Flow

```typescript
// Test: Calibration mode doesn't interrupt AI color
describe('Calibration Mode', () => {
  it('should allow manual position while AI controls color', () => {
    // Setup
    arbiter.setTitanIntent(mockIntent, 'fiesta-latina')
    
    // Enter calibration
    arbiter.setManualOverride({
      fixtureId: 'mover_1',
      controls: { pan: 127, tilt: 64 },
      overrideChannels: ['pan', 'tilt'],
      mode: 'absolute',
      source: 'calibration',
      ...
    })
    
    // Arbitrate
    const result = arbiter.arbitrate(fixtures)
    const mover1 = result.fixtures.find(f => f.fixtureId === 'mover_1')
    
    // Position from manual
    expect(mover1.pan).toBe(127)
    expect(mover1.tilt).toBe(64)
    expect(mover1._controlSources.pan).toBe(ControlLayer.MANUAL)
    expect(mover1._controlSources.tilt).toBe(ControlLayer.MANUAL)
    
    // Color from AI
    expect(mover1._controlSources.red).toBe(ControlLayer.TITAN_AI)
    expect(mover1._controlSources.green).toBe(ControlLayer.TITAN_AI)
    expect(mover1._controlSources.blue).toBe(ControlLayer.TITAN_AI)
  })
})
```

### 7.2 Crossfade on Release

```typescript
// Test: Smooth transition when releasing manual
describe('Crossfade', () => {
  it('should smoothly transition from manual to AI', async () => {
    // Set manual
    arbiter.setManualOverride({
      fixtureId: 'par_1',
      controls: { dimmer: 255 },
      overrideChannels: ['dimmer'],
      ...
    })
    
    // AI wants dimmer 100
    arbiter.setTitanIntent({ ...mockIntent, masterIntensity: 100/255 }, 'techno')
    
    // Release with 500ms crossfade
    arbiter.clearManualOverride('par_1', ['dimmer'], 500)
    
    // At t=0
    let result = arbiter.arbitrate(fixtures)
    expect(result.fixtures[0].dimmer).toBeCloseTo(255)
    
    // At t=250ms (50%)
    await sleep(250)
    result = arbiter.arbitrate(fixtures)
    expect(result.fixtures[0].dimmer).toBeCloseTo(177)  // 255 + (100-255)*0.5
    
    // At t=500ms (100%)
    await sleep(250)
    result = arbiter.arbitrate(fixtures)
    expect(result.fixtures[0].dimmer).toBeCloseTo(100)
  })
})
```

---

## 8. 📋 IMPLEMENTATION PHASES

### Phase 1: Core Arbiter (WAVE 373)
- [x] Create `/src/core/arbiter/` directory structure
- [x] Implement type definitions
- [x] Implement MergeStrategies
- [x] Implement CrossfadeEngine
- [x] Implement MasterArbiter (without consciousness)
- [ ] Unit tests

### Phase 2: Integration (WAVE 374)
- [x] Modify TitanOrchestrator to use MasterArbiter
- [x] Add IPC handlers
- [x] Modify HAL to accept FinalLightingTarget
- [ ] Integration tests

### Phase 3: UI Integration (WAVE 375 + 377)
- [x] Add manual override controls to fixture inspector
- [x] Add calibration mode button ← WAVE 377
- [x] Add blackout button to BigSwitch
- [x] Add layer activity indicator
- [x] Add TitanSyncBridge (stageStore → Backend) ← WAVE 377

### Phase 4: Consciousness Channel (CORE 3)
- [ ] Enable consciousnessEnabled config
- [ ] Connect SeleneLuxConscious to arbiter
- [ ] Connect DreamForge to arbiter
- [ ] E2E tests

---

**WAVE 372.5 Status:** ✅ BLUEPRINT COMPLETE

*"El arquitecto ha dibujado los planos. Ahora solo falta construir."* 📐
