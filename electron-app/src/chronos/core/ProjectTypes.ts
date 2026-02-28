/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📐 PROJECT TYPES — THE ARCHITECTURAL CONTRACT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 2081: M1 UNIFICATION — Clear separation of concerns.
 *
 * LuxSync uses TWO project representations by design:
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │                                                                      │
 * │   LuxProject (.lux file)         ChronosProject (runtime)           │
 * │   ════════════════════           ═══════════════════════             │
 * │   • Serialized to disk           • Lives in Zustand store           │
 * │   • Flat clip list               • Multi-track with clips           │
 * │   • ProjectMeta (version,        • ChronosProjectMeta (bpm,         │
 * │     author, timestamps)            key, timeSignature)              │
 * │   • ProjectAudio reference       • PlaybackConfig (loop, snap)      │
 * │   • ProjectLibrary (Heph)        • AnalysisData (GodEar)            │
 * │   • ProjectTimeline (clips,      • AutomationLanes (Bézier)         │
 * │     playhead, viewport)          • ChronosMarkers                   │
 * │                                  • GlobalAutomation                 │
 * │                                                                      │
 * │   Used by:                       Used by:                           │
 * │   • ChronosStore (save/load)     • chronosStore (Zustand)           │
 * │   • TimelineEngine (playback)    • ChronosEngine (evaluation)       │
 * │   • useScenePlayer (Hyperion)    • ChronosLayout (editing UI)       │
 * │   • PlaybackIPCHandlers          • Automation system                │
 * │   • SceneBrowser                                                    │
 * │                                                                      │
 * │   Conversion:                                                        │
 * │   luxToChronos(lux) → ChronosProject                                │
 * │   chronosToLux(ch) → LuxProject                                     │
 * │                                                                      │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * WHY TWO TYPES:
 * - LuxProject is the PORTABLE format. It has no runtime dependencies,
 *   no automation state, no analysis cache. It's what gets saved to disk
 *   and what TimelineEngine (main process) reads for playback.
 * - ChronosProject is the RICH runtime model. It has multi-track layout,
 *   Bézier automation, GodEar analysis cache, markers. It's what the
 *   Chronos editor UI manipulates.
 *
 * RULE: Code that READS .lux files imports LuxProject.
 *       Code that EDITS timeline data imports ChronosProject.
 *       Code at the BOUNDARY (save/load) uses the converters.
 *
 * @module chronos/core/ProjectTypes
 * @version WAVE 2081
 */

// ─── Persistence layer (file format) ───────────────────────────────────
export type {
  LuxProject,
  ProjectMeta,
  ProjectAudio,
  ProjectTimeline,
  ProjectLibrary,
  HephEffectSummary,
} from './ChronosProject'

export {
  PROJECT_VERSION,
  PROJECT_EXTENSION,
  PROJECT_MIME,
  createEmptyProject,
  createProjectFromState,
  serializeProject,
  deserializeProject,
  validateProject,
  luxToChronos,
  chronosToLux,
} from './ChronosProject'

// ─── Runtime layer (in-memory document) ────────────────────────────────
export type {
  ChronosProject,
  ChronosProjectMeta,
  PlaybackConfig,
  TimelineTrack,
  TimelineClip,
  ClipData,
  AnalysisData,
  AutomationLane,
  AutomationPoint,
  ChronosMarker,
  ChronosContext,
  ChronosEngineState,
  PlaybackState,
  ChronosId,
  TimeMs,
  NormalizedValue,
  HexColor,
} from './types'

export {
  generateChronosId,
  createDefaultProject,
  createDefaultTrack,
  createEffectClip,
  createAutomationPoint,
  createAutomationLane,
} from './types'

// ─── Clip layer (concrete clip types for .lux) ────────────────────────
export type {
  TimelineClip as LuxTimelineClip,
  VibeClip,
  FXClip,
  FXKeyframe,
  BaseClip,
  ClipType as LuxClipType,
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
  getVibeColor,
  toFXType,
  toVibeType,
} from './TimelineClip'
