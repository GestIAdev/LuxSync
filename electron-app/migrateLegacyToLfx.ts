#!/usr/bin/env ts-node
// ════════════════════════════════════════════════════════════════════════════
// WAVE 4821 — THE GENESIS MIGRATOR
// migrateLegacyToLfx.ts
//
// Offline one-shot migration: 48 legacy effects → .lfx v2.1 (CognitiveDNA).
//
// Usage:
//   cd electron-app
//   npx ts-node migrateLegacyToLfx.ts
//
// Output: ./src/core/arsenal/builtins/<effect_id>.lfx
//
// DOCTRINA:
//   - Zero Electron dependencies. Node.js native + project TS types only.
//   - Fossil manifest is 100% hardcoded declarative data.
//     No Math.random(), no heuristics, no mocks — only forensic truth.
//   - Every ACO value, zone and waveform is derived from LEGACY-PHYSICS-MAPPING.md
//     and EffectRegistry.ts forensic extraction (WAVE 4820 blueprint §3.4).
//   - GatekeeperLinter auto-fix: clamps ACO to archetype bias bounds silently.
//   - validateClip() receives rawAco (pre-bake) so bias violations are real.
// ════════════════════════════════════════════════════════════════════════════

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

import {
  LfxClipInstance,
  ARCHETYPE_BIAS_MAP,
} from './src/core/arsenal/LfxClipInstance'
import type {
  AcoTriad,
  CompatibleVibe,
  EnergyZoneId,
  SpatialBehavior,
  UserArchetype,
} from './src/core/arsenal/LfxClipInstance'

import { inferArchetypeFromACO } from './src/core/arsenal/inferArchetypes'
import { validateClip }           from './src/core/arsenal/GatekeeperLinter'

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const OUTPUT_DIR = path.join(__dirname, 'src', 'core', 'arsenal', 'builtins')
const LFX_SCHEMA = 'hephaestus/v2.1' as const
const LFX_VERSION = '2.1.0'
const AUTHOR = 'LuxSync Genesis Migrator / WAVE 4821'
const BPM_REF = 128 // universal reference BPM for BPM-synced clip durations

// ─── VIBE BRIDGE (mirrors LfxClipInstance private constant) ─────────────────

const VIBE_BRIDGE: Readonly<Record<CompatibleVibe, string>> = Object.freeze({
  'techno-dark':    'techno-club',
  'latino-organic': 'fiesta-latina',
  'pop-rock':       'pop-rock',
  'chill-lounge':   'chill-lounge',
})

// ─── SCRIPT-LOCAL TYPES ──────────────────────────────────────────────────────

/**
 * Waveform taxonomy derived from LEGACY-PHYSICS-MAPPING §1 (Core Oscillators).
 * Maps each effect's dominant mathematical function to a keyframe generator.
 */
type WaveformId =
  | 'sine'         // Sine Pulse: breathing 0→1→0, period = durationMs
  | 'bpm_sine'     // BPM-synced sine (1-beat cycle at BPM_REF=128)
  | 'square'       // Square wave strobe at maxStrobeFreqHz (50% duty)
  | 'linear'       // Linear Ramp: 0→1 over durationMs
  | 'exp_decay'    // Exponential Decay: pow(1-progress, 1.7)
  | 'power_attack' // Power Curve attack: pow(progress, 0.3) — explosive snap
  | 'adsr'         // Multi-phase ADSR — custom keyframes per effect ID

/** Keyframe compatible with HephCurve (typed inline to avoid Electron imports). */
interface ScriptKeyframe {
  timeMs:            number
  value:             number | { h: number; s: number; l: number }
  interpolation:     'bezier' | 'linear' | 'hold'
  bezierHandles?:    [number, number, number, number]
}

/** HephCurve shape (mirrors src/core/hephaestus/types.ts — no import). */
interface ScriptCurve {
  paramId:      string
  valueType:    'number' | 'color'
  range:        [number, number]
  defaultValue: number | { h: number; s: number; l: number }
  keyframes:    ScriptKeyframe[]
  mode:         'absolute' | 'relative' | 'additive'
}

/**
 * One fossil record = the complete forensic snapshot of one legacy effect.
 * Every field is derived from LEGACY-PHYSICS-MAPPING.md and EffectRegistry.ts.
 * See WAVE-4820-MIGRATION-BLUEPRINT.md for the full derivation rationale.
 */
interface FossilEntry {
  id:                  string
  title:               string
  category:            'fiesta-latina' | 'techno' | 'pop-rock' | 'chill-lounge'
  vibes:               CompatibleVibe[]
  /** Raw ACO before bakeCognitiveDNA() clamps it. Forensic source of truth. */
  rawAco:              AcoTriad
  zones:               EnergyZoneId[]
  spatialBehavior:     SpatialBehavior
  mixBus:              'global' | 'htp' | 'ambient' | 'accent'
  waveform:            WaveformId
  durationMs:          number
  maxStrobeFreqHz:     number
  isOneShot:           boolean
  tags:                string[]
  /** Dominant color (HSL) exported to staticParams for runtime palette queries. */
  color:               { h: number; s: number; l: number }
  /** ms to crossfade from current mover position to the clip's first target. */
  movementTransitionMs: number
}

// ═══════════════════════════════════════════════════════════════════════════
// §1  FOSSIL MANIFEST
//     48 legacy effects, ordered by EffectRegistry category.
//     ACO values from WAVE-4820-MIGRATION-BLUEPRINT §3.4 (primary sources)
//     and from LEGACY-PHYSICS-MAPPING.md forensics (derived sources).
//     Spatial behavior derived from blueprint §1.2 decision table.
// ═══════════════════════════════════════════════════════════════════════════

const FOSSIL_MANIFEST: readonly FossilEntry[] = Object.freeze([

  // ─── FIESTA LATINA ─────────────────────────────────────────────────────

  {
    id: 'solar_flare',        title: 'Solar Flare',
    category: 'fiesta-latina', vibes: ['latino-organic'],
    // Blueprint §3.4 — divine candidate; ADSR: build(1500ms)+flash(300ms)+decay(2000ms)
    rawAco: { aggression: 0.95, chaos: 0.30, organicity: 0.20 },
    zones: ['peak'],
    spatialBehavior: 'static',               // htp additive, no pan/tilt
    mixBus: 'global',  waveform: 'adsr',
    durationMs: 3800, maxStrobeFreqHz: 0,   isOneShot: true,
    tags: ['intensity'],
    color: { h: 38, s: 100, l: 60 },        movementTransitionMs: 0,
  },
  {
    id: 'tropical_pulse',     title: 'Tropical Pulse',
    category: 'fiesta-latina', vibes: ['latino-organic'],
    // Blueprint §3.4 — heavy; state machine: preDuck+3×flash+gaps+finale+release
    rawAco: { aggression: 0.80, chaos: 0.55, organicity: 0.25 },
    zones: ['active', 'intense'],
    spatialBehavior: 'static',
    mixBus: 'global',  waveform: 'adsr',
    durationMs: 500,  maxStrobeFreqHz: 0,   isOneShot: true,
    tags: ['rhythmic', 'intensity'],
    color: { h: 16, s: 100, l: 55 },        movementTransitionMs: 0,
  },
  {
    id: 'salsa_fire',         title: 'Salsa Fire',
    category: 'fiesta-latina', vibes: ['latino-organic'],
    // Organic flicker on bass hits — BPM-synced sine with htp blend
    rawAco: { aggression: 0.72, chaos: 0.45, organicity: 0.38 },
    zones: ['active', 'intense'],
    spatialBehavior: 'static',
    mixBus: 'htp',     waveform: 'bpm_sine',
    durationMs: 4000, maxStrobeFreqHz: 0,   isOneShot: false,
    tags: ['rhythmic', 'color'],
    color: { h: 0, s: 100, l: 55 },         movementTransitionMs: 0,
  },
  {
    id: 'cumbia_moon',        title: 'Cumbia Moon',
    category: 'fiesta-latina', vibes: ['latino-organic'],
    // Soft breakdown breathing — ambient archetype, low aggression
    rawAco: { aggression: 0.22, chaos: 0.20, organicity: 0.72 },
    zones: ['ambient', 'gentle'],
    spatialBehavior: 'static',
    mixBus: 'ambient', waveform: 'sine',
    durationMs: 6000, maxStrobeFreqHz: 0,   isOneShot: false,
    tags: ['atmospheric', 'color'],
    color: { h: 280, s: 70, l: 45 },        movementTransitionMs: 0,
  },
  {
    id: 'clave_rhythm',       title: 'Clave Rhythm',
    category: 'fiesta-latina', vibes: ['latino-organic'],
    // 3-2 clave pattern drives mover orbital (relative_offset LFO)
    rawAco: { aggression: 0.75, chaos: 0.55, organicity: 0.32 },
    zones: ['active'],
    spatialBehavior: 'relative_offset',
    mixBus: 'htp',     waveform: 'bpm_sine',
    durationMs: 4000, maxStrobeFreqHz: 0,   isOneShot: false,
    tags: ['rhythmic', 'movement'],
    color: { h: 28, s: 100, l: 55 },        movementTransitionMs: 0,
  },
  {
    id: 'corazon_latino',     title: 'Corazón Latino',
    category: 'fiesta-latina', vibes: ['latino-organic'],
    // Heartbeat BPM-synced intensity pulse
    rawAco: { aggression: 0.78, chaos: 0.42, organicity: 0.40 },
    zones: ['intense'],
    spatialBehavior: 'static',
    mixBus: 'htp',     waveform: 'bpm_sine',
    durationMs: 4000, maxStrobeFreqHz: 0,   isOneShot: false,
    tags: ['rhythmic', 'intensity'],
    color: { h: 340, s: 100, l: 55 },       movementTransitionMs: 0,
  },
  {
    id: 'amazon_mist',        title: 'Amazon Mist',
    category: 'fiesta-latina', vibes: ['latino-organic'],
    // Atmospheric sine breathing in low energy zone
    rawAco: { aggression: 0.15, chaos: 0.14, organicity: 0.82 },
    zones: ['silence', 'valley'],
    spatialBehavior: 'static',
    mixBus: 'ambient', waveform: 'sine',
    durationMs: 8000, maxStrobeFreqHz: 0,   isOneShot: false,
    tags: ['atmospheric', 'color'],
    color: { h: 165, s: 80, l: 35 },        movementTransitionMs: 0,
  },
  {
    id: 'machete_spark',      title: 'Machete Spark',
    category: 'fiesta-latina', vibes: ['latino-organic'],
    // Instant power-attack flash (§8.1 one-shot accent)
    rawAco: { aggression: 0.72, chaos: 0.62, organicity: 0.18 },
    zones: ['active'],
    spatialBehavior: 'static',
    mixBus: 'accent',  waveform: 'power_attack',
    durationMs: 2000, maxStrobeFreqHz: 0,   isOneShot: false,
    tags: ['accent', 'intensity'],
    color: { h: 45, s: 100, l: 65 },        movementTransitionMs: 0,
  },
  {
    id: 'glitch_guaguanco',   title: 'Glitch Guaguancó',
    category: 'fiesta-latina', vibes: ['latino-organic'],
    // Digital glitch strobe at 6Hz (below epilepsy ceiling)
    rawAco: { aggression: 0.68, chaos: 0.68, organicity: 0.22 },
    zones: ['active'],
    spatialBehavior: 'static',
    mixBus: 'accent',  waveform: 'square',
    durationMs: 3000, maxStrobeFreqHz: 6,   isOneShot: false,
    tags: ['accent', 'rhythmic'],
    color: { h: 285, s: 80, l: 50 },        movementTransitionMs: 0,
  },
  {
    id: 'latina_meltdown',    title: 'Latina Meltdown',
    category: 'fiesta-latina', vibes: ['latino-organic'],
    // 15Hz global strobe — The Beast (Latino variant)
    rawAco: { aggression: 0.94, chaos: 0.52, organicity: 0.08 },
    zones: ['peak'],
    spatialBehavior: 'static',
    mixBus: 'global',  waveform: 'square',
    durationMs: 4000, maxStrobeFreqHz: 15,  isOneShot: false,
    tags: ['strobe', 'intensity'],
    color: { h: 355, s: 100, l: 50 },       movementTransitionMs: 0,
  },
  {
    id: 'strobe_burst',       title: 'Strobe Burst',
    category: 'fiesta-latina', vibes: ['techno-dark'],
    // Short 15Hz strobe burst for cross-genre triggers
    rawAco: { aggression: 0.88, chaos: 0.55, organicity: 0.12 },
    zones: ['intense', 'peak'],
    spatialBehavior: 'static',
    mixBus: 'global',  waveform: 'square',
    durationMs: 2000, maxStrobeFreqHz: 15,  isOneShot: false,
    tags: ['strobe', 'intensity'],
    color: { h: 0, s: 0, l: 100 },          movementTransitionMs: 0,
  },

  // ─── TECHNO ────────────────────────────────────────────────────────────

  {
    id: 'strobe_storm',       title: 'Strobe Storm',
    category: 'techno',        vibes: ['techno-dark'],
    rawAco: { aggression: 0.90, chaos: 0.65, organicity: 0.10 },
    zones: ['peak'],
    spatialBehavior: 'static',
    mixBus: 'global',  waveform: 'square',
    durationMs: 2000, maxStrobeFreqHz: 12,  isOneShot: false,
    tags: ['strobe', 'intensity'],
    color: { h: 0, s: 0, l: 100 },          movementTransitionMs: 0,
  },
  {
    id: 'industrial_strobe',  title: 'Industrial Strobe',
    category: 'techno',        vibes: ['techno-dark'],
    // §5.1 — preDuck(80ms) → 4 flash bursts (60ms each) with gaps, then 15Hz window
    // §4.3 — max 10Hz effective (anti-epilepsy); §8.5 — 150ms cooldown between bursts
    rawAco: { aggression: 0.90, chaos: 0.55, organicity: 0.10 },
    zones: ['intense', 'peak'],
    spatialBehavior: 'static',
    mixBus: 'global',  waveform: 'adsr',
    durationMs: 2000, maxStrobeFreqHz: 15,  isOneShot: false,
    tags: ['strobe', 'intensity'],
    color: { h: 0, s: 0, l: 100 },          movementTransitionMs: 0,
  },
  {
    id: 'acid_sweep',         title: 'Acid Sweep',
    category: 'techno',        vibes: ['techno-dark'],
    // §5.1 — sine²-edge blade sweeps linearly; blueprint §1.2 → absolute
    rawAco: { aggression: 0.70, chaos: 0.40, organicity: 0.45 },
    zones: ['active', 'intense'],
    spatialBehavior: 'absolute',
    mixBus: 'htp',     waveform: 'linear',
    durationMs: 4000, maxStrobeFreqHz: 0,   isOneShot: false,
    tags: ['sweep', 'movement'],
    color: { h: 120, s: 100, l: 50 },       movementTransitionMs: 600,
  },
  {
    id: 'cyber_dualism',      title: 'Cyber Dualism',
    category: 'techno',        vibes: ['techno-dark'],
    // §5.1 — ping-pong L↔R alternation; blueprint §1.2 → absolute
    rawAco: { aggression: 0.85, chaos: 0.45, organicity: 0.15 },
    zones: ['active', 'intense'],
    spatialBehavior: 'absolute',
    mixBus: 'htp',     waveform: 'bpm_sine',
    durationMs: 4000, maxStrobeFreqHz: 0,   isOneShot: false,
    tags: ['movement', 'rhythmic'],
    color: { h: 180, s: 100, l: 55 },       movementTransitionMs: 300,
  },
  {
    id: 'gatling_raid',       title: 'Gatling Raid',
    category: 'techno',        vibes: ['techno-dark'],
    // Rapid-fire strobe burst (§8.1 one-shot type)
    rawAco: { aggression: 0.90, chaos: 0.72, organicity: 0.05 },
    zones: ['peak'],
    spatialBehavior: 'static',
    mixBus: 'global',  waveform: 'square',
    durationMs: 2000, maxStrobeFreqHz: 20,  isOneShot: false,
    tags: ['strobe', 'intensity'],
    color: { h: 20, s: 100, l: 55 },        movementTransitionMs: 0,
  },
  {
    id: 'sky_saw',            title: 'Sky Saw',
    category: 'techno',        vibes: ['techno-dark'],
    // Mover orbital sweep (LFO sinusoidal) — relative_offset
    rawAco: { aggression: 0.80, chaos: 0.58, organicity: 0.15 },
    zones: ['intense'],
    spatialBehavior: 'relative_offset',
    mixBus: 'htp',     waveform: 'linear',
    durationMs: 3000, maxStrobeFreqHz: 0,   isOneShot: false,
    tags: ['movement', 'sweep'],
    color: { h: 320, s: 100, l: 60 },       movementTransitionMs: 0,
  },
  {
    id: 'abyssal_rise',       title: 'Abyssal Rise',
    category: 'techno',        vibes: ['techno-dark'],
    // 8-bar power-curve build; dictates mover position → absolute
    rawAco: { aggression: 0.76, chaos: 0.45, organicity: 0.30 },
    zones: ['intense'],
    spatialBehavior: 'absolute',
    mixBus: 'htp',     waveform: 'power_attack',
    durationMs: 16000, maxStrobeFreqHz: 0,  isOneShot: false,
    tags: ['transitional', 'intensity'],
    color: { h: 270, s: 100, l: 25 },       movementTransitionMs: 1200,
  },
  {
    id: 'void_mist',          title: 'Void Mist',
    category: 'techno',        vibes: ['techno-dark'],
    // §5.1 — 0.25Hz sine breathing; §8.3 WAVE 2182: movers FROZEN
    rawAco: { aggression: 0.20, chaos: 0.20, organicity: 0.80 },
    zones: ['valley', 'ambient'],
    spatialBehavior: 'static',
    mixBus: 'global',  waveform: 'sine',
    durationMs: 3000, maxStrobeFreqHz: 0,   isOneShot: false,
    tags: ['atmospheric', 'color'],
    color: { h: 270, s: 100, l: 12 },       movementTransitionMs: 0,
  },
  {
    id: 'digital_rain',       title: 'Digital Rain',
    category: 'techno',        vibes: ['techno-dark'],
    // Matrix-style flickering — BPM-synced ambient breathing
    rawAco: { aggression: 0.30, chaos: 0.48, organicity: 0.55 },
    zones: ['ambient'],
    spatialBehavior: 'static',
    mixBus: 'ambient', waveform: 'bpm_sine',
    durationMs: 6000, maxStrobeFreqHz: 0,   isOneShot: false,
    tags: ['atmospheric', 'color'],
    color: { h: 180, s: 100, l: 55 },       movementTransitionMs: 0,
  },
  {
    id: 'deep_breath',        title: 'Deep Breath',
    category: 'techno',        vibes: ['techno-dark'],
    // Organic 4-bar breathing — ambient archetype, silence zone
    rawAco: { aggression: 0.18, chaos: 0.12, organicity: 0.78 },
    zones: ['silence', 'valley'],
    spatialBehavior: 'static',
    mixBus: 'ambient', waveform: 'sine',
    durationMs: 8000, maxStrobeFreqHz: 0,   isOneShot: false,
    tags: ['atmospheric', 'intensity'],
    color: { h: 250, s: 80, l: 40 },        movementTransitionMs: 0,
  },
  {
    id: 'ambient_strobe',     title: 'Ambient Strobe',
    category: 'techno',        vibes: ['techno-dark'],
    // Stadium-camera flashes at 3Hz (gentle zone, below epilepsy threshold)
    rawAco: { aggression: 0.55, chaos: 0.35, organicity: 0.42 },
    zones: ['gentle'],
    spatialBehavior: 'static',
    mixBus: 'global',  waveform: 'square',
    durationMs: 4000, maxStrobeFreqHz: 3,   isOneShot: false,
    tags: ['strobe', 'accent'],
    color: { h: 0, s: 0, l: 95 },           movementTransitionMs: 0,
  },
  {
    id: 'sonar_ping',         title: 'Sonar Ping',
    category: 'techno',        vibes: ['techno-dark'],
    // Exponential decay flash chasing back→front; orbital relative offset
    rawAco: { aggression: 0.22, chaos: 0.18, organicity: 0.75 },
    zones: ['silence'],
    spatialBehavior: 'relative_offset',
    mixBus: 'ambient', waveform: 'exp_decay',
    durationMs: 3000, maxStrobeFreqHz: 0,   isOneShot: false,
    tags: ['atmospheric', 'movement'],
    color: { h: 210, s: 100, l: 55 },       movementTransitionMs: 0,
  },
  {
    id: 'binary_glitch',      title: 'Binary Glitch',
    category: 'techno',        vibes: ['techno-dark'],
    // Morse-code corrupt square wave glitch at 8Hz
    rawAco: { aggression: 0.65, chaos: 0.75, organicity: 0.18 },
    zones: ['active'],
    spatialBehavior: 'static',
    mixBus: 'accent',  waveform: 'square',
    durationMs: 2000, maxStrobeFreqHz: 8,   isOneShot: false,
    tags: ['accent', 'rhythmic'],
    color: { h: 90, s: 100, l: 60 },        movementTransitionMs: 0,
  },
  {
    id: 'seismic_snap',       title: 'Seismic Snap',
    category: 'techno',        vibes: ['techno-dark'],
    // Shutter-style power-attack accent
    rawAco: { aggression: 0.78, chaos: 0.62, organicity: 0.15 },
    zones: ['active'],
    spatialBehavior: 'static',
    mixBus: 'accent',  waveform: 'power_attack',
    durationMs: 1000, maxStrobeFreqHz: 0,   isOneShot: false,
    tags: ['accent', 'intensity'],
    color: { h: 16, s: 100, l: 55 },        movementTransitionMs: 0,
  },
  {
    id: 'fiber_optics',       title: 'Fiber Optics',
    category: 'techno',        vibes: ['techno-dark'],
    // Traveling ambient colors — slow sine breathing
    rawAco: { aggression: 0.22, chaos: 0.28, organicity: 0.72 },
    zones: ['valley'],
    spatialBehavior: 'static',
    mixBus: 'ambient', waveform: 'sine',
    durationMs: 8000, maxStrobeFreqHz: 0,   isOneShot: false,
    tags: ['atmospheric', 'color'],
    color: { h: 300, s: 100, l: 60 },       movementTransitionMs: 0,
  },
  {
    id: 'core_meltdown',      title: 'Core Meltdown',
    category: 'techno',        vibes: ['techno-dark'],
    // §5.1 — Frame-guaranteed 15Hz toggle with white↔nuclear-magenta alternation
    // WAVE 2690: ONE-SHOT, 4200ms
    rawAco: { aggression: 0.95, chaos: 0.50, organicity: 0.05 },
    zones: ['peak'],
    spatialBehavior: 'static',
    mixBus: 'global',  waveform: 'adsr',
    durationMs: 4200, maxStrobeFreqHz: 15,  isOneShot: true,
    tags: ['strobe', 'intensity'],
    color: { h: 0, s: 0, l: 100 },          movementTransitionMs: 0,
  },
  {
    id: 'neon_blinder',       title: 'Neon Blinder',
    category: 'techno',        vibes: ['techno-dark'],
    // §5.1 — Phase1: 15Hz strobe 266ms; Phase2: exp(-3×) melt 734ms
    // Blueprint §1.2 → absolute (pan=0, tilt=0: facing front)
    rawAco: { aggression: 0.92, chaos: 0.35, organicity: 0.10 },
    zones: ['peak'],
    spatialBehavior: 'absolute',
    mixBus: 'global',  waveform: 'adsr',
    durationMs: 1000, maxStrobeFreqHz: 15,  isOneShot: true,
    tags: ['strobe', 'intensity'],
    color: { h: 185, s: 100, l: 55 },       movementTransitionMs: 200,
  },
  {
    id: 'surgical_strike',    title: 'Surgical Strike',
    category: 'techno',        vibes: ['techno-dark'],
    // Ultra-precise 350ms mover strobe
    rawAco: { aggression: 0.92, chaos: 0.42, organicity: 0.08 },
    zones: ['peak'],
    spatialBehavior: 'static',
    mixBus: 'global',  waveform: 'square',
    durationMs: 350,  maxStrobeFreqHz: 15,  isOneShot: false,
    tags: ['strobe', 'intensity'],
    color: { h: 0, s: 0, l: 100 },          movementTransitionMs: 0,
  },
  {
    id: 'ghost_chase',        title: 'Ghost Chase',
    category: 'techno',        vibes: ['techno-dark'],
    // §8.3 WAVE 2182: movers frozen; only dimmer breathes (sine)
    rawAco: { aggression: 0.25, chaos: 0.32, organicity: 0.68 },
    zones: ['valley'],
    spatialBehavior: 'static',
    mixBus: 'global',  waveform: 'sine',
    durationMs: 4000, maxStrobeFreqHz: 0,   isOneShot: false,
    tags: ['atmospheric', 'intensity'],
    color: { h: 270, s: 60, l: 45 },        movementTransitionMs: 0,
  },

  // ─── POP-ROCK ──────────────────────────────────────────────────────────

  {
    id: 'thunder_struck',     title: 'Thunder Struck',
    category: 'pop-rock',      vibes: ['pop-rock'],
    // §5.3 + Blueprint §3.4 — ADSR: attack(pow 0.3)+sustain+decay+gap BPM-synced
    // §8.3 WAVE 2690: movement PURGED
    rawAco: { aggression: 0.88, chaos: 0.40, organicity: 0.20 },
    zones: ['intense'],
    spatialBehavior: 'static',
    mixBus: 'htp',     waveform: 'adsr',
    durationMs: 2000, maxStrobeFreqHz: 0,   isOneShot: true,
    tags: ['intensity', 'accent'],
    color: { h: 40, s: 85, l: 70 },         movementTransitionMs: 0,
  },
  {
    id: 'liquid_solo',        title: 'Liquid Solo',
    category: 'pop-rock',      vibes: ['pop-rock'],
    // Spotlight tracking the guitarist — sine orbital
    rawAco: { aggression: 0.65, chaos: 0.38, organicity: 0.55 },
    zones: ['active'],
    spatialBehavior: 'relative_offset',
    mixBus: 'htp',     waveform: 'sine',
    durationMs: 6000, maxStrobeFreqHz: 0,   isOneShot: false,
    tags: ['movement', 'intensity'],
    color: { h: 270, s: 80, l: 55 },        movementTransitionMs: 0,
  },
  {
    id: 'amp_heat',           title: 'Amp Heat',
    category: 'pop-rock',      vibes: ['pop-rock'],
    // Warm valve tube breathing — ambient archetype, valley zone
    rawAco: { aggression: 0.28, chaos: 0.18, organicity: 0.72 },
    zones: ['valley'],
    spatialBehavior: 'static',
    mixBus: 'ambient', waveform: 'sine',
    durationMs: 8000, maxStrobeFreqHz: 0,   isOneShot: false,
    tags: ['atmospheric', 'color'],
    color: { h: 28, s: 90, l: 45 },         movementTransitionMs: 0,
  },
  {
    id: 'arena_sweep',        title: 'Arena Sweep',
    category: 'pop-rock',      vibes: ['pop-rock'],
    // Wembley mover sweep — linear ramp dictating absolute position
    rawAco: { aggression: 0.68, chaos: 0.38, organicity: 0.42 },
    zones: ['ambient', 'active'],
    spatialBehavior: 'absolute',
    mixBus: 'htp',     waveform: 'linear',
    durationMs: 4000, maxStrobeFreqHz: 0,   isOneShot: false,
    tags: ['sweep', 'movement'],
    color: { h: 220, s: 80, l: 60 },        movementTransitionMs: 800,
  },
  {
    id: 'feedback_storm',     title: 'Feedback Storm',
    category: 'pop-rock',      vibes: ['pop-rock'],
    // §5.3 + Blueprint §3.4 — seeded random strobe; blueprint §1.2 → absolute
    rawAco: { aggression: 0.85, chaos: 0.80, organicity: 0.15 },
    zones: ['peak'],
    spatialBehavior: 'absolute',
    mixBus: 'global',  waveform: 'adsr',
    durationMs: 3000, maxStrobeFreqHz: 12,  isOneShot: true,
    tags: ['strobe', 'intensity'],
    color: { h: 355, s: 100, l: 45 },       movementTransitionMs: 100,
  },
  {
    id: 'power_chord',        title: 'Power Chord',
    category: 'pop-rock',      vibes: ['pop-rock'],
    // Guitar-attack flash + strobe: power-attack intensity + 10Hz strobe
    rawAco: { aggression: 0.88, chaos: 0.52, organicity: 0.12 },
    zones: ['intense'],
    spatialBehavior: 'static',
    mixBus: 'global',  waveform: 'power_attack',
    durationMs: 1000, maxStrobeFreqHz: 10,  isOneShot: false,
    tags: ['strobe', 'accent'],
    color: { h: 28, s: 100, l: 60 },        movementTransitionMs: 0,
  },
  {
    id: 'stage_wash',         title: 'Stage Wash',
    category: 'pop-rock',      vibes: ['pop-rock'],
    // Warm amber wash — slow sine breathing, ambient zone
    rawAco: { aggression: 0.28, chaos: 0.20, organicity: 0.68 },
    zones: ['ambient'],
    spatialBehavior: 'static',
    mixBus: 'ambient', waveform: 'sine',
    durationMs: 6000, maxStrobeFreqHz: 0,   isOneShot: false,
    tags: ['atmospheric', 'color'],
    color: { h: 35, s: 85, l: 65 },         movementTransitionMs: 0,
  },
  {
    id: 'spotlight_pulse',    title: 'Spotlight Pulse',
    category: 'pop-rock',      vibes: ['pop-rock'],
    // BPM-synced breathing spotlight — htp, active zone
    rawAco: { aggression: 0.60, chaos: 0.32, organicity: 0.52 },
    zones: ['active'],
    spatialBehavior: 'static',
    mixBus: 'htp',     waveform: 'sine',
    durationMs: 4000, maxStrobeFreqHz: 0,   isOneShot: false,
    tags: ['intensity', 'rhythmic'],
    color: { h: 50, s: 100, l: 90 },        movementTransitionMs: 0,
  },

  // ─── CHILL-LOUNGE ──────────────────────────────────────────────────────

  {
    id: 'tidal_wave',         title: 'Tidal Wave',
    category: 'chill-lounge',  vibes: ['chill-lounge'],
    // ChillStereoPhysics oceanic sine — relative orbital movement
    rawAco: { aggression: 0.18, chaos: 0.15, organicity: 0.82 },
    zones: ['ambient', 'gentle'],
    spatialBehavior: 'relative_offset',
    mixBus: 'ambient', waveform: 'sine',
    durationMs: 8000, maxStrobeFreqHz: 0,   isOneShot: false,
    tags: ['atmospheric', 'movement'],
    color: { h: 200, s: 80, l: 55 },        movementTransitionMs: 0,
  },
  {
    id: 'ghost_breath',       title: 'Ghost Breath',
    category: 'chill-lounge',  vibes: ['chill-lounge'],
    rawAco: { aggression: 0.12, chaos: 0.10, organicity: 0.88 },
    zones: ['silence'],
    spatialBehavior: 'static',
    mixBus: 'ambient', waveform: 'sine',
    durationMs: 8000, maxStrobeFreqHz: 0,   isOneShot: false,
    tags: ['atmospheric', 'intensity'],
    color: { h: 0, s: 0, l: 97 },           movementTransitionMs: 0,
  },
  {
    id: 'solar_caustics',     title: 'Solar Caustics',
    category: 'chill-lounge',  vibes: ['chill-lounge'],
    // Dappled light rays — sine + relative orbital drift
    rawAco: { aggression: 0.15, chaos: 0.18, organicity: 0.85 },
    zones: ['silence'],
    spatialBehavior: 'relative_offset',
    mixBus: 'ambient', waveform: 'sine',
    durationMs: 10000, maxStrobeFreqHz: 0,  isOneShot: false,
    tags: ['atmospheric', 'color'],
    color: { h: 195, s: 80, l: 75 },        movementTransitionMs: 0,
  },
  {
    id: 'school_of_fish',     title: 'School of Fish',
    category: 'chill-lounge',  vibes: ['chill-lounge'],
    // Moving school — sine orbital sweep
    rawAco: { aggression: 0.20, chaos: 0.25, organicity: 0.78 },
    zones: ['ambient'],
    spatialBehavior: 'relative_offset',
    mixBus: 'ambient', waveform: 'sine',
    durationMs: 8000, maxStrobeFreqHz: 0,   isOneShot: false,
    tags: ['atmospheric', 'movement'],
    color: { h: 175, s: 85, l: 60 },        movementTransitionMs: 0,
  },
  {
    id: 'whale_song',         title: 'Whale Song',
    category: 'chill-lounge',  vibes: ['chill-lounge'],
    // Long slow sine breathing — quietest ambient archetype
    rawAco: { aggression: 0.15, chaos: 0.12, organicity: 0.88 },
    zones: ['valley'],
    spatialBehavior: 'static',
    mixBus: 'ambient', waveform: 'sine',
    durationMs: 12000, maxStrobeFreqHz: 0,  isOneShot: false,
    tags: ['atmospheric', 'intensity'],
    color: { h: 220, s: 75, l: 40 },        movementTransitionMs: 0,
  },
  {
    id: 'abyssal_jellyfish',  title: 'Abyssal Jellyfish',
    category: 'chill-lounge',  vibes: ['chill-lounge'],
    // Gentle orbital drift — bioluminescent relative movement
    rawAco: { aggression: 0.12, chaos: 0.15, organicity: 0.82 },
    zones: ['valley'],
    spatialBehavior: 'relative_offset',
    mixBus: 'ambient', waveform: 'sine',
    durationMs: 10000, maxStrobeFreqHz: 0,  isOneShot: false,
    tags: ['atmospheric', 'color'],
    color: { h: 285, s: 70, l: 65 },        movementTransitionMs: 0,
  },
  {
    id: 'surface_shimmer',    title: 'Surface Shimmer',
    category: 'chill-lounge',  vibes: ['chill-lounge'],
    rawAco: { aggression: 0.18, chaos: 0.22, organicity: 0.80 },
    zones: ['silence'],
    spatialBehavior: 'static',
    mixBus: 'ambient', waveform: 'sine',
    durationMs: 8000, maxStrobeFreqHz: 0,   isOneShot: false,
    tags: ['atmospheric', 'color'],
    color: { h: 50, s: 60, l: 90 },         movementTransitionMs: 0,
  },
  {
    id: 'plankton_drift',     title: 'Plankton Drift',
    category: 'chill-lounge',  vibes: ['chill-lounge'],
    rawAco: { aggression: 0.10, chaos: 0.14, organicity: 0.88 },
    zones: ['silence'],
    spatialBehavior: 'relative_offset',
    mixBus: 'ambient', waveform: 'sine',
    durationMs: 10000, maxStrobeFreqHz: 0,  isOneShot: false,
    tags: ['atmospheric', 'movement'],
    color: { h: 130, s: 70, l: 70 },        movementTransitionMs: 0,
  },
  {
    id: 'deep_current_pulse', title: 'Deep Current Pulse',
    category: 'chill-lounge',  vibes: ['chill-lounge'],
    rawAco: { aggression: 0.19, chaos: 0.20, organicity: 0.78 },
    zones: ['ambient'],
    spatialBehavior: 'relative_offset',
    mixBus: 'ambient', waveform: 'sine',
    durationMs: 8000, maxStrobeFreqHz: 0,   isOneShot: false,
    tags: ['atmospheric', 'movement'],
    color: { h: 245, s: 70, l: 35 },        movementTransitionMs: 0,
  },
  {
    id: 'bioluminescent_spore', title: 'Bioluminescent Spore',
    category: 'chill-lounge',   vibes: ['chill-lounge'],
    rawAco: { aggression: 0.14, chaos: 0.17, organicity: 0.84 },
    zones: ['valley'],
    spatialBehavior: 'static',
    mixBus: 'ambient', waveform: 'sine',
    durationMs: 10000, maxStrobeFreqHz: 0,  isOneShot: false,
    tags: ['atmospheric', 'color'],
    color: { h: 175, s: 90, l: 55 },        movementTransitionMs: 0,
  },
] as const)

// ═══════════════════════════════════════════════════════════════════════════
// §2  BÉZIER KEYFRAME GENERATORS
//     Formulas from LEGACY-PHYSICS-MAPPING §1 and blueprint §2.2.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sine Pulse: 0 →(rise)→ 1 →(fall)→ 0
 * Blueprint §2.2: handles [0.33,0,0.67,1] for smooth sine approximation.
 */
function sineToKeyframes(durationMs: number): ScriptKeyframe[] {
  const half = durationMs / 2
  return [
    { timeMs: 0,          value: 0, interpolation: 'bezier', bezierHandles: [0.33, 0, 0.67, 1] },
    { timeMs: half,       value: 1, interpolation: 'bezier', bezierHandles: [0.33, 1, 0.67, 0] },
    { timeMs: durationMs, value: 0, interpolation: 'hold' },
  ]
}

/**
 * BPM Pulse: one complete sine cycle at 128 BPM (≈937ms/beat), repeated
 * to fill durationMs. Hephaestus runtime stretches to real BPM.
 */
function bpmSineToKeyframes(durationMs: number): ScriptKeyframe[] {
  const beatMs  = (60000 / BPM_REF)          // ≈ 468ms for 128 BPM
  const cycleMs = beatMs * 2                  // 2-beat sine cycle
  const keyframes: ScriptKeyframe[] = []
  let t = 0
  while (t < durationMs) {
    const end = Math.min(t + cycleMs, durationMs)
    const half = t + (end - t) / 2
    keyframes.push({ timeMs: Math.round(t),    value: 0, interpolation: 'bezier', bezierHandles: [0.33, 0, 0.67, 1] })
    keyframes.push({ timeMs: Math.round(half), value: 1, interpolation: 'bezier', bezierHandles: [0.33, 1, 0.67, 0] })
    t += cycleMs
  }
  keyframes.push({ timeMs: durationMs, value: 0, interpolation: 'hold' })
  return keyframes
}

/**
 * Square Pulse (strobe): 50% duty cycle at freqHz.
 * Blueprint §2.2 strobeToKeyframes() — accumulator model.
 * Hard-capped at 500 keyframes to prevent file bloat.
 */
function strobeToKeyframes(durationMs: number, freqHz: number): ScriptKeyframe[] {
  const halfPeriodMs = 500 / Math.max(0.1, freqHz)
  const keyframes: ScriptKeyframe[] = []
  let t = 0
  let on = true
  while (t < durationMs && keyframes.length < 500) {
    keyframes.push({ timeMs: Math.round(t), value: on ? 1 : 0, interpolation: 'hold' })
    t += halfPeriodMs
    on = !on
  }
  keyframes.push({ timeMs: durationMs, value: 0, interpolation: 'hold' })
  return keyframes
}

/**
 * Linear Ramp: from → to (blueprint §2.2 linearRampToKeyframes).
 */
function linearRampToKeyframes(durationMs: number, from: number, to: number): ScriptKeyframe[] {
  return [
    { timeMs: 0,          value: from, interpolation: 'linear' },
    { timeMs: durationMs, value: to,   interpolation: 'hold' },
  ]
}

/**
 * Exponential Decay: pow(1-progress, curve).
 * Blueprint §2.2 — cx2 derived from curve exponent.
 * Default curve=1.7 (SolarFlare decay).
 */
function expDecayToKeyframes(durationMs: number, curve: number = 1.7): ScriptKeyframe[] {
  const cx2 = Math.max(0.10, 0.58 - (curve - 1) * 0.15)
  return [
    { timeMs: 0,          value: 1, interpolation: 'bezier', bezierHandles: [0, 0, cx2, 1] },
    { timeMs: durationMs, value: 0, interpolation: 'hold' },
  ]
}

/**
 * Power Attack: pow(progress, exponent). exponent < 1 = explosive snap.
 * Blueprint §2.2 — cx1 derived from exponent.
 * Default exponent=0.3 (ThunderStruck attack).
 */
function powerAttackToKeyframes(durationMs: number, exponent: number = 0.3): ScriptKeyframe[] {
  const cx1 = Math.min(0.95, 0.42 + (1 - exponent) * 0.70)
  return [
    { timeMs: 0,          value: 0, interpolation: 'bezier', bezierHandles: [cx1, 0, 0.10, 1] },
    { timeMs: durationMs, value: 1, interpolation: 'hold' },
  ]
}

/**
 * Multi-phase ADSR: custom keyframe sequences per effect ID.
 * Every timing constant is from LEGACY-PHYSICS-MAPPING §4.3 and §5.
 */
function adsrToKeyframes(fossil: FossilEntry): ScriptKeyframe[] {
  const d = fossil.durationMs

  switch (fossil.id) {

    case 'solar_flare': {
      // BUILD: 1500ms pow(2.4)×0.6 → FLASH: 300ms @ 1.0 → DECAY: pow(1.7) 2000ms
      // cx2 for build (power 2.4 ease-in): blueprint §2.2 PowerAttack(2.4)
      return [
        { timeMs: 0,    value: 0.00, interpolation: 'bezier', bezierHandles: [0.42, 0, 1, 1] },
        { timeMs: 1500, value: 0.60, interpolation: 'hold' },
        { timeMs: 1560, value: 1.00, interpolation: 'hold' },
        { timeMs: 1800, value: 1.00, interpolation: 'bezier', bezierHandles: [0, 0, 0.35, 1] },
        { timeMs: 3800, value: 0.00, interpolation: 'hold' },
      ]
    }

    case 'tropical_pulse': {
      // preDuck(50ms)→flash1(70ms)→gap(35ms)→flash2→gap→flash3→gap→finale(45ms)→release(60ms)
      // release: (1-progress)^2 quadratic
      return [
        { timeMs: 0,   value: 0.30, interpolation: 'hold' },   // preDuck
        { timeMs: 50,  value: 1.00, interpolation: 'hold' },   // flash 1
        { timeMs: 120, value: 0.15, interpolation: 'hold' },   // gap 1
        { timeMs: 155, value: 1.00, interpolation: 'hold' },   // flash 2
        { timeMs: 225, value: 0.15, interpolation: 'hold' },   // gap 2
        { timeMs: 260, value: 1.00, interpolation: 'hold' },   // flash 3
        { timeMs: 330, value: 0.15, interpolation: 'hold' },   // gap 3
        { timeMs: 375, value: 1.00, interpolation: 'bezier', bezierHandles: [0.68, -0.6, 0.32, 1.6] }, // finale burst
        { timeMs: 420, value: 0.50, interpolation: 'bezier', bezierHandles: [0, 0, 0.58, 1] },          // quadratic release
        { timeMs: 500, value: 0.00, interpolation: 'hold' },
      ]
    }

    case 'thunder_struck': {
      // attack:10% pow(0.3) → sustain:40%@0.95 → decay:30% pow(0.5) → gap:20%@0.05
      const atk = d * 0.10
      const sus = d * 0.50
      const dec = d * 0.80
      return [
        { timeMs: 0,   value: 0.00, interpolation: 'bezier', bezierHandles: [0.90, 0, 0.10, 1] },  // explosive attack
        { timeMs: atk, value: 0.95, interpolation: 'bezier', bezierHandles: [0.33, 1, 0.67, 1] },  // sustain wobble
        { timeMs: sus, value: 0.95, interpolation: 'bezier', bezierHandles: [0, 0, 0.42, 1] },      // decay start
        { timeMs: dec, value: 0.00, interpolation: 'hold' },                                         // gap floor
        { timeMs: d,   value: 0.05, interpolation: 'hold' },                                         // gap end
      ]
    }

    case 'neon_blinder': {
      // Phase1 (0–266ms): intensity held at 1.0 (strobe curve handles square wave)
      // Phase2 (266–1000ms): exp(-3×) melt → blueprints cx2 = 0.15 for exp(-3)
      return [
        { timeMs: 0,   value: 1.00, interpolation: 'hold' },
        { timeMs: 266, value: 1.00, interpolation: 'bezier', bezierHandles: [0, 0, 0.15, 1] },
        { timeMs: 1000, value: 0.00, interpolation: 'hold' },
      ]
    }

    case 'core_meltdown': {
      // Full-on global override for 4200ms; strobe curve carries square wave
      return [
        { timeMs: 0,    value: 1.00, interpolation: 'hold' },
        { timeMs: 4200, value: 0.00, interpolation: 'hold' },
      ]
    }

    case 'industrial_strobe': {
      // preDuck(80ms)→flash1(60ms)→gap1(55ms)→flash2(40ms)→gap2(45ms)→flash3(40ms)→gap3(55ms)→flash4(40ms)
      // After burst window: 15Hz strobe gate (carried by strobe curve)
      return [
        { timeMs: 0,   value: 0.20, interpolation: 'hold' },   // preDuck
        { timeMs: 80,  value: 1.00, interpolation: 'hold' },   // flash 1
        { timeMs: 140, value: 0.00, interpolation: 'hold' },   // gap 1
        { timeMs: 195, value: 1.00, interpolation: 'hold' },   // flash 2
        { timeMs: 235, value: 0.00, interpolation: 'hold' },   // gap 2
        { timeMs: 280, value: 1.00, interpolation: 'hold' },   // flash 3
        { timeMs: 320, value: 0.00, interpolation: 'hold' },   // gap 3
        { timeMs: 375, value: 1.00, interpolation: 'hold' },   // flash 4
        { timeMs: 415, value: 1.00, interpolation: 'hold' },   // strobe window: held (strobe curve gates it)
        { timeMs: d,   value: 0.00, interpolation: 'hold' },
      ]
    }

    case 'feedback_storm': {
      // 5ms snap attack → 80% plateau (harsh sustained) → 15% decay pow(0.5)
      const snapEnd  = d * 0.05
      const platEnd  = d * 0.85
      return [
        { timeMs: 0,        value: 0.00, interpolation: 'bezier', bezierHandles: [0.90, 0, 0.10, 1] },
        { timeMs: snapEnd,  value: 0.90, interpolation: 'hold' },
        { timeMs: platEnd,  value: 0.85, interpolation: 'bezier', bezierHandles: [0, 0, 0.42, 1] },
        { timeMs: d,        value: 0.00, interpolation: 'hold' },
      ]
    }

    default:
      // Fallback for any unmapped 'adsr' waveform
      return sineToKeyframes(d)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// §3  CURVE BUILDERS
// ═══════════════════════════════════════════════════════════════════════════

function buildIntensityCurve(fossil: FossilEntry): ScriptCurve {
  let keyframes: ScriptKeyframe[]

  switch (fossil.waveform) {
    case 'sine':         keyframes = sineToKeyframes(fossil.durationMs);                            break
    case 'bpm_sine':     keyframes = bpmSineToKeyframes(fossil.durationMs);                         break
    case 'square':       keyframes = strobeToKeyframes(fossil.durationMs, fossil.maxStrobeFreqHz || 8); break
    case 'linear':       keyframes = linearRampToKeyframes(fossil.durationMs, 0, 1);               break
    case 'exp_decay':    keyframes = expDecayToKeyframes(fossil.durationMs, 1.7);                  break
    case 'power_attack': keyframes = powerAttackToKeyframes(fossil.durationMs, 0.3);               break
    case 'adsr':         keyframes = adsrToKeyframes(fossil);                                      break
    default:             keyframes = sineToKeyframes(fossil.durationMs)
  }

  return {
    paramId: 'intensity', valueType: 'number',
    range: [0, 1], defaultValue: 0,
    keyframes,
    mode: 'absolute',
  }
}

function buildStrobeCurve(fossil: FossilEntry): ScriptCurve {
  // For neon_blinder ADSR, strobe only fires in Phase 1 (0–266ms)
  const strobeEnd = fossil.id === 'neon_blinder' ? 266 : fossil.durationMs
  return {
    paramId: 'strobe', valueType: 'number',
    range: [0, 1], defaultValue: 0,
    keyframes: strobeToKeyframes(strobeEnd, fossil.maxStrobeFreqHz),
    mode: 'absolute',
  }
}

/**
 * Sinusoidal relative-offset curve for pan or tilt.
 * One complete orbital cycle: 0 → +amp → 0 → -amp → 0.
 * Blueprint §2.1 — additive mode (sums with IK base position).
 */
function buildOrbitalCurve(paramId: 'pan' | 'tilt', durationMs: number, amplitude: number): ScriptCurve {
  const q1 = durationMs / 4
  const q2 = durationMs / 2
  const q3 = durationMs * 3 / 4
  return {
    paramId, valueType: 'number',
    range: [-1, 1], defaultValue: 0,
    keyframes: [
      { timeMs: 0,            value: 0,          interpolation: 'bezier', bezierHandles: [0.33, 0, 0.67, 1] },
      { timeMs: q1,           value: amplitude,  interpolation: 'bezier', bezierHandles: [0.33, 1, 0.67, 0] },
      { timeMs: q2,           value: 0,          interpolation: 'bezier', bezierHandles: [0.33, 0, 0.67, -1] },
      { timeMs: q3,           value: -amplitude, interpolation: 'bezier', bezierHandles: [0.33, -1, 0.67, 0] },
      { timeMs: durationMs,   value: 0,          interpolation: 'hold' },
    ],
    mode: 'additive',
  }
}

function buildCurves(fossil: FossilEntry): Record<string, ScriptCurve> {
  const curves: Record<string, ScriptCurve> = {}

  curves['intensity'] = buildIntensityCurve(fossil)

  if (fossil.maxStrobeFreqHz > 0) {
    curves['strobe'] = buildStrobeCurve(fossil)
  }

  if (fossil.spatialBehavior === 'relative_offset') {
    // Pan amplitude = 0.4 (moderate sweep); tilt = 0.25 (tighter vertical range)
    curves['pan']  = buildOrbitalCurve('pan',  fossil.durationMs, 0.40)
    curves['tilt'] = buildOrbitalCurve('tilt', fossil.durationMs, 0.25)
  }

  return curves
}

// ═══════════════════════════════════════════════════════════════════════════
// §4  SIMULATION META + EXECUTION HINTS
// ═══════════════════════════════════════════════════════════════════════════

function buildSimulationMeta(fossil: FossilEntry): object {
  const isStrobe  = fossil.maxStrobeFreqHz > 0
  const isDiv     = fossil.rawAco.aggression >= 0.90
  const isHeavy   = fossil.rawAco.aggression >= 0.70 && !isDiv
  const isAmbient = fossil.rawAco.aggression < 0.30
  return {
    beautyWeights: {
      base:              isDiv ? 0.90 : isHeavy ? 0.70 : isAmbient ? 0.35 : 0.55,
      energyMultiplier:  1.00 + fossil.rawAco.chaos * 0.50,
      vibeBonus:         0.10,
    },
    gpuCost:          isStrobe ? 0.60 : fossil.spatialBehavior !== 'static' ? 0.45 : 0.25,
    fatigueImpact:    isDiv ? 0.25 : isHeavy ? 0.15 : isAmbient ? 0.02 : 0.06,
    minDurationMs:    fossil.isOneShot ? fossil.durationMs : Math.min(fossil.durationMs, 1000),
    cooldownMs:       fossil.isOneShot ? 8000 : isStrobe ? 5000 : isDiv ? 4000 : 2000,
    isStrobe,
    isDivineCandidate: isDiv,
    isHeavyCandidate:  isHeavy && !isStrobe,
    zScoreGuards: {
      requireRising:  isDiv || isStrobe,
      minimumZ:       isDiv ? 1.80 : isStrobe ? 1.20 : null,
      minimumEnergy:  isDiv ? 0.85 : isStrobe ? 0.70 : null,
    },
  }
}

function buildExecutionHints(fossil: FossilEntry): object {
  const targeting =
    fossil.tags.includes('strobe') ? 'strobes' :
    fossil.spatialBehavior !== 'static' ? 'movers' :
    fossil.zones.some(z => ['active', 'intense', 'peak'].includes(z)) ? 'all' :
    'pars'

  return {
    overlayMode:      fossil.mixBus === 'htp' ? 'additive' : 'absolute',
    phaseConfig: {
      spread:    fossil.spatialBehavior === 'relative_offset' ? 0.50 : 0,
      symmetry:  'linear',
      wings:     1,
      direction: 1,
    },
    intensityScaling: fossil.rawAco.aggression > 0.80 ? 'fixed' : 'energyDriven',
    fixtureTargeting: targeting,
  }
}

function derivePriority(fossil: FossilEntry): number {
  if (fossil.isOneShot)          return 90
  if (fossil.mixBus === 'global') return 80
  if (fossil.mixBus === 'htp')    return 60
  if (fossil.mixBus === 'accent') return 40
  return 30  // ambient
}

// ═══════════════════════════════════════════════════════════════════════════
// §5  AUTO-FIX (Linter → Clamp → Rebuild)
// ═══════════════════════════════════════════════════════════════════════════

function clampToBias(val: number, min?: number, max?: number): number {
  let v = val
  if (min !== undefined && v < min) v = min
  if (max !== undefined && v > max) v = max
  return v
}

function applyBiasClamp(rawAco: AcoTriad, archetype: UserArchetype): AcoTriad {
  const bias = ARCHETYPE_BIAS_MAP[archetype]
  return {
    aggression: clampToBias(rawAco.aggression, bias.aggressionMin, bias.aggressionMax),
    chaos:      clampToBias(rawAco.chaos,      bias.chaosMin,      bias.chaosMax),
    organicity: clampToBias(rawAco.organicity, bias.organicityMin, bias.organicityMax),
  }
}

function buildInstance(
  fossil: FossilEntry,
  archetype: UserArchetype,
  acoOverride?: AcoTriad,
): LfxClipInstance {
  return new LfxClipInstance({
    id:               fossil.id,
    title:            fossil.title,
    author:           AUTHOR,
    userArchetype:    archetype,
    spatialBehavior:  fossil.spatialBehavior,
    maxStrobeFreqHz:  fossil.maxStrobeFreqHz,
    compatibleVibes:  fossil.vibes as CompatibleVibe[],
    energyZones:      fossil.zones as EnergyZoneId[],
    acoTriad:         acoOverride ?? fossil.rawAco,
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// §6  SERIALIZER → LfxClipV2 JSON
// ═══════════════════════════════════════════════════════════════════════════

function serializeToLfx(
  fossil:   FossilEntry,
  instance: LfxClipInstance,
  fixedAco: AcoTriad | null,
): object {
  const cognitiveDNA = instance.toCognitiveDNA()
  const serialized   = instance.toJSON()

  const vibeCompat = serialized.compatibleVibes.map(v => VIBE_BRIDGE[v]).filter(Boolean)

  const clipBlock = {
    id:          instance.id,
    name:        instance.title,
    author:      instance.author,
    category:    fossil.category,
    tags:        fossil.tags,
    vibeCompat,
    zones:       instance.energyZones,
    mixBus:      fossil.mixBus,
    priority:    derivePriority(fossil),
    durationMs:  fossil.durationMs,
    effectType:  'heph_custom',

    curves:      buildCurves(fossil) as Record<string, unknown>,

    staticParams: {
      dominantColorH:       fossil.color.h,
      dominantColorS:       fossil.color.s,
      dominantColorL:       fossil.color.l,
      isOneShot:            fossil.isOneShot,
      legacyMixBus:         fossil.mixBus,
      movementTransitionMs: fossil.movementTransitionMs,
      bpmRef:               BPM_REF,
      ...(fixedAco !== null ? { acoWasAutoClamped: true } : {}),
    },

    cognitiveDNA,
    simulationMeta:   buildSimulationMeta(fossil),
    executionHints:   buildExecutionHints(fossil),
    safetyDeclaration: {
      maxStrobeFreqHz:   fossil.maxStrobeFreqHz,
      containsRapidFlash: fossil.maxStrobeFreqHz > 3,
      communityTrusted:   true,
    },
  }

  const checksumInput = JSON.stringify(clipBlock)
  const checksum = `sha256:${crypto.createHash('sha256').update(checksumInput).digest('hex')}`

  return {
    $schema:  LFX_SCHEMA,
    version:  LFX_VERSION,
    clip:     clipBlock,
    checksum,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// §7  MIGRATION PIPELINE (per effect)
// ═══════════════════════════════════════════════════════════════════════════

interface MigrateResult {
  fossil:    FossilEntry
  archetype: UserArchetype
  fixedAco:  AcoTriad | null
  json:      string
  outPath:   string
  warnings:  number
}

function migrateEffect(fossil: FossilEntry): MigrateResult {

  // A — Semantic inference (raw ACO → UserArchetype)
  const inference = inferArchetypeFromACO(fossil.rawAco, fossil.zones as EnergyZoneId[])
  let archetype   = inference.archetype

  // B — Build instance (bakeCognitiveDNA fires in constructor, clamps acoTriad)
  let instance = buildInstance(fossil, archetype)

  // C — Lint with RAW aco (pre-bake) so bias violations surface
  let lintResult = validateClip(instance, fossil.rawAco)
  let fixedAco: AcoTriad | null = null

  // D — Auto-fix: clamp rawAco to bias bounds, rebuild, re-lint
  if (!lintResult.canSave) {
    fixedAco = applyBiasClamp(fossil.rawAco, archetype)
    instance  = buildInstance(fossil, archetype, fixedAco)
    lintResult = validateClip(instance, fixedAco)

    // Last resort: utility archetype has no bias constraints
    if (!lintResult.canSave) {
      archetype  = 'utility'
      fixedAco   = fossil.rawAco
      instance   = buildInstance(fossil, 'utility', fossil.rawAco)
      lintResult = validateClip(instance, fossil.rawAco)
    }
  }

  if (!lintResult.canSave) {
    // Report but do NOT abort — write the file with warnings visible
    console.warn(`  ⚠  ${fossil.id}: linter still has ${lintResult.summary.error} error(s) after auto-fix`)
  }

  // E — Serialize to .lfx v2.1
  const lfxObj  = serializeToLfx(fossil, instance, fixedAco)
  const json     = JSON.stringify(lfxObj, null, 2)
  const outPath  = path.join(OUTPUT_DIR, `${fossil.id}.lfx`)
  const warnings = lintResult.summary.warning + lintResult.summary.error + lintResult.summary.critical

  return { fossil, archetype, fixedAco, json, outPath, warnings }
}

// ═══════════════════════════════════════════════════════════════════════════
// §8  MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║  WAVE 4821 — THE GENESIS MIGRATOR                           ║')
  console.log(`║  Effects  : ${String(FOSSIL_MANIFEST.length).padEnd(49)}║`)
  console.log(`║  Output   : ${OUTPUT_DIR.slice(-49).padEnd(49)}║`)
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log()

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  let ok = 0, autoFixed = 0, failed = 0

  for (const fossil of FOSSIL_MANIFEST) {
    try {
      const r = migrateEffect(fossil)
      fs.writeFileSync(r.outPath, r.json, 'utf-8')

      const wasFixed  = r.fixedAco !== null
      const indicator = wasFixed ? '⚠ ' : '✔ '
      const fixNote   = wasFixed ? ` [ACO clamped → ${r.archetype}]` : ` [${r.archetype}]`
      console.log(`  ${indicator}${fossil.id}${fixNote}`)

      if (wasFixed) autoFixed++
      ok++
    } catch (err) {
      console.error(`  ✘ ${fossil.id}: ${(err as Error).message}`)
      failed++
    }
  }

  console.log()
  console.log('────────────────────────────────────────────────────────────────')
  console.log(`  ✔ Written  : ${ok}`)
  console.log(`  ⚠ Auto-fix : ${autoFixed}`)
  console.log(`  ✘ Failed   : ${failed}`)
  console.log(`  📁 ${OUTPUT_DIR}`)
  console.log('────────────────────────────────────────────────────────────────')
}

main().catch(err => {
  console.error('[GENESIS MIGRATOR] Fatal:', err)
  process.exit(1)
})
