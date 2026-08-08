/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏛️ LUX FILE V3 — THE INCORRUPTIBLE CORE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The canonical `.lux` V3 schema. Born clean, V3-only, no legacy V2 conversion.
 *
 * PREMISE:
 *   `.lux` nace LIMPIA en V3. No existen shows V2 previos. No hay conversores.
 *   Este schema es la CONSTITUCIÓN: se define primero, los consumidores se
 *   adaptan después. Nunca al revés.
 *
 * MARRIAGE WITH .lfx V3:
 *   FXClips embed a full `HephAutomationClipV3` (schemaVersion '3.0').
 *   The embedded clip is the runtime truth — `hephFilePath` is only a reference
 *   for re-importing from the UI. A `.lux` is fully self-contained.
 *
 * TWO REPRESENTATIONS:
 *   - LuxFileV3        → serialized to disk (immutable, portable)
 *   - ChronosProjectV3 → in-memory runtime (LuxFileV3 + ephemeral edit state)
 *
 * BPM STRATEGY (FFT detect + manual override):
 *   - analysis.detectedBpm → base BPM detected by the GodEar FFT worker.
 *   - runtime uses the live rBPM from the Worker; falls back to detectedBpm.
 *   - manualBpmOverride (runtime only) wins when present.
 *
 * @module chronos/core/LuxFileV3
 * @version V3.0
 */

import type { HephAutomationClipV3 } from '../../core/hephaestus/types'
import type { CanonicalZone } from '../../core/stage/ShowFileV2'
import type { EnergyZone } from '../../core/protocol/MusicalContext'
import type { AutomationLane } from './types'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Discriminator literal for `.lux` V3 files. Exact match required. */
export const LUX_V3_SCHEMA = 'luxsync.lux/3.0' as const

/** File extension for LuxSync V3 projects. */
export const LUX_V3_EXTENSION = '.lux'

/** MIME type for LuxSync V3 projects. */
export const LUX_V3_MIME = 'application/x-luxsync-project'

/** Absolute last-resort BPM when nothing else is available. */
export const LUX_DEFAULT_BPM = 120

// ═══════════════════════════════════════════════════════════════════════════
// CLIP LAYER
// ═══════════════════════════════════════════════════════════════════════════

export type LuxClipType = 'vibe' | 'fx'

/** Inter-clip blend routing (mirrors HephAutomationClipV3.mixBus). */
export type LuxMixBus = 'global' | 'htp' | 'ambient' | 'accent'

/**
 * A clip on the timeline. Unifies Vibe and FX into a single discriminated
 * structure keyed by `type`.
 */
export interface LuxClipV3 {
  /** Unique clip ID (immutable). */
  readonly id: string

  /** Discriminator: 'vibe' | 'fx'. */
  type: LuxClipType

  /** Display label. */
  label: string

  /** Start time in ms. */
  startMs: number

  /** End time in ms. */
  endMs: number

  /** UI color (hex). */
  color: string

  /** Is clip locked (cannot move/resize). */
  locked: boolean

  // ── VIBE-ONLY ──
  /** Vibe preset id (when type === 'vibe'). */
  vibeType?: string

  /** Base intensity 0-1 (vibe). */
  intensity?: number

  /** Fade-in duration in ms (vibe). */
  fadeInMs?: number

  /** Fade-out duration in ms (vibe). */
  fadeOutMs?: number

  // ── FX-ONLY (Diamond Data, self-contained) ──
  /**
   * Full HephAutomationClipV3 embedded. This is the runtime truth.
   * Present when type === 'fx'.
   */
  hephClip?: HephAutomationClipV3

  /** Path of the originating `.lfx` (reference only, NOT loaded at runtime). */
  hephFilePath?: string

  /** Target zones for the effect (overrides hephClip.spatialZones for routing). */
  zones?: readonly string[]

  /** Blend priority. */
  priority?: number

  /** MixBus routing (mirror of hephClip.mixBus for quick access). */
  mixBus?: LuxMixBus
}

// ═══════════════════════════════════════════════════════════════════════════
// TRACK LAYER
// ═══════════════════════════════════════════════════════════════════════════

/** Special wildcard zone targeting all fixtures. */
export type LuxTargetZone = CanonicalZone | 'global' | EnergyZone

/**
 * An explicit, user-created timeline track. Not derived from fixtures.
 * Multiple tracks may target the same zone — the arbiter resolves HTP/LTP.
 */
export interface LuxTrackV3 {
  /** UUID — generated on creation, immutable. */
  readonly id: string

  /** Canonical DMX routing zone (immutable). */
  readonly targetZone: LuxTargetZone

  /** User-editable visual label (UI-only, no routing impact). */
  visualLabel: string

  /** Track color in the UI (hex). */
  color: string

  /** Clips owned exclusively by this track. */
  clips: LuxClipV3[]

  /** Is track enabled (false = muted). */
  enabled: boolean

  /** Is track in solo. */
  solo: boolean

  /** Is track locked (not editable in UI). */
  locked: boolean

  /** Visual order in the UI (0 = top). Does NOT affect DMX priority. */
  order: number

  /** Row height in px for the UI. */
  height: number
}

// ═══════════════════════════════════════════════════════════════════════════
// METADATA
// ═══════════════════════════════════════════════════════════════════════════

export interface LuxMetaV3 {
  /** Show name (displayed in title bar). */
  name: string

  /** Author name. */
  author: string

  /** Optional description. */
  description?: string

  /** Creation timestamp (ISO 8601). */
  createdAt: string

  /** Last modified timestamp (ISO 8601). */
  modifiedAt: string

  /** Total show duration in ms. */
  durationMs: number
}

// ═══════════════════════════════════════════════════════════════════════════
// AUDIO (PORTABLE)
// ═══════════════════════════════════════════════════════════════════════════

export interface LuxAudioV3 {
  /** Original audio filename. */
  fileName: string

  /** Path relative to the `.lux` file (portable). */
  relativePath: string

  /** Audio duration in ms. */
  durationMs: number

  /** SHA-256 hash of the audio file (integrity check). */
  audioHash?: string

  /** Audio start offset in the timeline (ms). */
  offsetMs: number

  /** BPM detected by the FFT worker (base reference, NOT runtime). */
  detectedBpm: number

  /** Confidence of the detected BPM (0-1). */
  bpmConfidence: number
}

// ═══════════════════════════════════════════════════════════════════════════
// ANALYSIS (GodEar FFT — embedded)
// ═══════════════════════════════════════════════════════════════════════════

export interface LuxSectionV3 {
  startMs: number
  endMs: number
  label: string
  energy: number
}

export type LuxTransientType = 'kick' | 'snare' | 'hihat' | 'unknown'

export interface LuxTransientV3 {
  timeMs: number
  type: LuxTransientType
  intensity: number
}

export interface LuxHeatmapV3 {
  /** Temporal resolution in ms per sample (typically 50). */
  resolutionMs: number

  /** Total energy per frame (0-1, peak-normalized). */
  energy: readonly number[]

  /** Legacy bass: subBass + bass combined (0-1). */
  bass: readonly number[]

  /** Legacy high: treble + ultraAir combined (0-1). */
  high: readonly number[]

  /** Spectral flux (normalized 0-1). */
  flux: readonly number[]

  // ── 7 tactical bands (GodEarFFT, optional) ──

  /** 20-60Hz — sub-bass / kick fundamental. */
  subBass?: readonly number[]

  /** 60-250Hz — bass / kick body. */
  bassReal?: readonly number[]

  /** 250-500Hz — low-mid warmth. */
  lowMid?: readonly number[]

  /** 500-2000Hz — mid / vocal / snare core. */
  mid?: readonly number[]

  /** 2000-6000Hz — high-mid / presence / attack. */
  highMid?: readonly number[]

  /** 6000-16000Hz — treble / hi-hats / brightness. */
  treble?: readonly number[]

  /** 16000-22000Hz — ultra-air / harmonics. */
  ultraAir?: readonly number[]

  /** Spectral centroid per frame (Hz). */
  spectralCentroid?: readonly number[]

  /** Spectral flatness per frame (0-1). */
  spectralFlatness?: readonly number[]
}

export interface LuxWaveformV3 {
  /** Samples per second in the downsampled waveform (typically 100). */
  samplesPerSecond: number

  /** Peak values per sample (0-1). */
  peaks: readonly number[]

  /** RMS values per sample (0-1). */
  rms: readonly number[]
}

export interface LuxAnalysisV3 {
  /** Mean BPM detected by the FFT worker. */
  detectedBpm: number

  /** Confidence of the detected BPM (0-1). */
  bpmConfidence: number

  /** Offset of the first detected beat (ms). */
  firstBeatMs: number

  /** Beat grid: timestamps in ms of each beat. */
  beatGrid: readonly number[]

  /** Detected sections (verse, chorus, drop, etc.). */
  sections: readonly LuxSectionV3[]

  /** Detected transients (kicks, snares, etc.). */
  transients: readonly LuxTransientV3[]

  /** Full energy heatmap with all tactical bands for TitanEngine injection. */
  heatmap: LuxHeatmapV3

  /** Downsampled waveform for UI display. */
  waveform: LuxWaveformV3
}

// ═══════════════════════════════════════════════════════════════════════════
// VIBE BASE (WHISPER)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The default vibe that plays when no VibeClip is active.
 * The "whisper" that fills ~90% of the show.
 */
export interface VibeBaseV3 {
  /** Vibe id (e.g. 'techno-club', 'fiesta-latina'). */
  vibeId: string

  /** Display name. */
  displayName: string

  /** Base intensity (0-1). */
  intensity: number

  /** Representative color (hex). */
  color: string

  /** Emoji icon. */
  icon: string
}

// ═══════════════════════════════════════════════════════════════════════════
// SAFETY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Show-level safety declaration — merged from all embedded hephClip
 * safetyDeclarations.
 */
export interface LuxSafetyV3 {
  /** Max strobe frequency across all effects (Hz). */
  maxStrobeFreqHz: number

  /** Any effect contains rapid flashing (epilepsy warning). */
  containsRapidFlash: boolean

  /** All embedded effects are community-trusted. */
  communityTrusted: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// 🏛️ LUX FILE V3 — THE FILE ON DISK
// ═══════════════════════════════════════════════════════════════════════════

export interface LuxFileV3 {
  /** Schema discriminator. Literal exact 'luxsync.lux/3.0'. */
  readonly $schema: typeof LUX_V3_SCHEMA

  /** Show metadata. */
  readonly meta: LuxMetaV3

  /** Portable audio reference. */
  readonly audio: LuxAudioV3 | null

  /** Pre-computed GodEar FFT analysis (embedded). */
  readonly analysis: LuxAnalysisV3 | null

  /** Base vibe — the "whisper". */
  readonly vibeBase: VibeBaseV3 | null

  /** Timeline tracks (persisted as-is). */
  readonly tracks: readonly LuxTrackV3[]

  /** User markers. */
  readonly markers: readonly LuxMarkerV3[]

  /** Show-level safety declaration. */
  readonly safety: LuxSafetyV3 | null

  /** Project-level automation lanes (Bézier curves for global parameters). */
  readonly automationLanes?: readonly AutomationLane[]

  /** SHA-256 checksum over the canonical content (excludes this field). */
  readonly checksum: string
}

// ═══════════════════════════════════════════════════════════════════════════
// MARKERS
// ═══════════════════════════════════════════════════════════════════════════

export type LuxMarkerType =
  | 'drop'
  | 'breakdown'
  | 'buildup'
  | 'section'
  | 'cue'
  | 'note'

export interface LuxMarkerV3 {
  readonly id: string
  timeMs: number
  type: LuxMarkerType
  label: string
  color?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// 🧠 CHRONOS PROJECT V3 — RUNTIME MODEL (LuxFileV3 + ephemeral edit state)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The in-memory runtime model. Carries everything from LuxFileV3 plus
 * ephemeral editing state that is NEVER serialized to disk.
 *
 * Mutable (the editor manipulates it). On save → strip runtime fields →
 * recompute checksum → LuxFileV3.
 */
export interface ChronosProjectV3 {
  // ── LuxFileV3 content (mutable in runtime) ──
  $schema: typeof LUX_V3_SCHEMA
  meta: LuxMetaV3
  audio: LuxAudioV3 | null
  analysis: LuxAnalysisV3 | null
  vibeBase: VibeBaseV3 | null
  tracks: LuxTrackV3[]
  markers: LuxMarkerV3[]
  safety: LuxSafetyV3 | null
  checksum: string

  /** Project-level automation lanes (mutable in runtime for editing). */
  automationLanes: AutomationLane[]

  // ── EPHEMERAL RUNTIME STATE (not serialized) ──
  /** Playhead position (ms). */
  playheadMs: number

  /** Viewport start (ms). */
  viewportStartMs: number

  /** Zoom level (pixels per second). */
  pixelsPerSecond: number

  /** Current runtime BPM (live rBPM from Worker, or fallback). */
  runtimeBpm: number

  /** Manual BPM override from the operator (null = no override). */
  manualBpmOverride: number | null

  /** Selected clip IDs. */
  selectedClipIds: Set<string>
}

/** Partial update for a track (id/targetZone/clips immutable here). */
export type LuxTrackUpdateV3 = Partial<
  Omit<LuxTrackV3, 'id' | 'targetZone' | 'clips'>
>
