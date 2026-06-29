/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📐 PROJECT TYPES — THE ARCHITECTURAL CONTRACT (V3)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 7100 FASE 2: V2 barrel demolished. V3-only exports.
 *
 * LuxSync now uses ONE project representation with two views:
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │                                                                      │
 * │   LuxFileV3 (.lux on disk)       ChronosProjectV3 (runtime)          │
 * │   ════════════════════           ═══════════════════════             │
 * │   • Serialized to disk           • Lives in Zustand store           │
 * │   • $schema: luxsync.lux/3.0    • = LuxFileV3 + ephemeral state     │
 * │   • Tracks + clips              • playheadMs, viewportStartMs,      │
 * │   • Audio portable                pixelsPerSecond, runtimeBpm,      │
 * │   • Analysis embebido             manualBpmOverride, selectedClips  │
 * │   • VibeBase (whisper)                                               │
 * │   • BPM base (FFT)              Conversion: NONE                    │
 * │   • Safety declaration           toChronosProjectV3(file) → runtime  │
 * │   • Checksum SHA-256             toLuxFileV3(project) → file        │
 * │                                                                      │
 * │   Used by:                       Used by:                           │
 * │   • ChronosStore (save/load)     • ChronosStore (state)             │
 * │   • TimelineEngine (playback)    • ChronosEngine (evaluation)       │
 * │   • useScenePlayer (Hyperion)    • ChronosLayout (editing UI)       │
 * │   • PlaybackIPCHandlers          • Automation system                │
 * │   • SceneBrowser                                                    │
 * │                                                                      │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * @module chronos/core/ProjectTypes
 * @version WAVE 7100 FASE 2
 */

// ─── V3 file format (persistence layer) ──────────────────────────────
export type {
  LuxFileV3,
  ChronosProjectV3,
  LuxMetaV3,
  LuxAudioV3,
  LuxTrackV3,
  LuxClipV3,
  LuxClipType,
  LuxMixBus,
  LuxTargetZone,
  LuxMarkerV3,
  LuxMarkerType,
  LuxSafetyV3,
  LuxAnalysisV3,
  LuxSectionV3,
  LuxTransientV3,
  LuxTransientType,
  VibeBaseV3,
  LuxTrackUpdateV3,
} from './LuxFileV3'

export {
  LUX_V3_SCHEMA,
  LUX_V3_EXTENSION,
  LUX_V3_MIME,
  LUX_DEFAULT_BPM,
} from './LuxFileV3'

// ─── V3 factories & bridges ──────────────────────────────────────────
export {
  generateLuxId,
  createEmptyLuxFileV3,
  createEmptyChronosProjectV3,
  toChronosProjectV3,
  toLuxFileV3,
  createLuxMetaV3,
  createTrackV3,
  createVibeClipV3,
  createFXClipV3,
  createMarkerV3,
  createVibeBaseV3,
  generateTrackLabelV3,
} from './LuxFileV3.factories'

// ─── V3 serializer ───────────────────────────────────────────────────
export {
  serializeLuxV3,
  deserializeLuxV3,
  computeLuxChecksum,
  verifyLuxChecksum,
  canonicalStringify,
} from './LuxFileV3.serializer'

// ─── V3 validation ───────────────────────────────────────────────────
export {
  validateLuxFileV3,
  isLuxFileV3,
  type LuxValidationResult,
} from './LuxFileV3.schema'

// ─── Shared runtime types (still in types.ts) ────────────────────────
export type {
  TimeMs,
  NormalizedValue,
  ChronosId,
  HexColor,
  PlaybackConfig,
  SnapResolution,
  ChronosOverrideMode,
  AutomationTarget,
  AutomationLane,
  AutomationPoint,
  InterpolationType,
  BezierHandle,
  Keyframe,
  MarkerType,
  ChronosMarker,
  AnalysisData,
  WaveformData,
  HeatmapData,
  BeatGridData,
  DetectedSection,
  SectionType,
  PlaybackState,
  ChronosEngineState,
  ChronosContext,
  ChronosVibeOverride,
  ChronosZoneOverride,
  ChronosColorOverride,
  ChronosActiveEffect,
} from './types'

export {
  generateChronosId,
} from './types'

// ─── Clip layer (concrete clip types) ────────────────────────────────
export type {
  TimelineClip as LuxTimelineClip,
  VibeClip,
  FXClip,
  FXKeyframe,
  BaseClip,
  ClipType as LuxClipTypeLegacy,
  FXType,
  VibeType,
} from './TimelineClip'

export {
  generateClipId,
  createVibeClip,
  createFXClip,
  createHephFXClip,
  VIBE_COLORS,
  FX_COLORS,
  MIXBUS_CLIP_COLORS,
  getClipMixBus,
  getVibeColor,
  toFXType,
  toVibeType,
} from './TimelineClip'

// ─── Legacy compat shims (re-export from demolished ChronosProject.ts) ─
export {
  createEmptyProject,
  serializeProject,
  deserializeProject,
  validateProject,
} from './ChronosProject'
