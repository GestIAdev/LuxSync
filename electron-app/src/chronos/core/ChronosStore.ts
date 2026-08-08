/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 💾 CHRONOS STORE - WAVE 7100: THE MEMORY CORE (V3)
 *
 * Central state manager for Chronos projects.
 * Handles save/load operations, dirty state tracking, and IPC with Electron.
 *
 * WAVE 7114: V2 fully demolished and merged into ChronosStore. V3 pure.
 *
 * @module chronos/core/ChronosStore
 * @version WAVE 7100
 */

import {
  type LuxFileV3,
  type ChronosProjectV3,
  type LuxTrackV3,
  type LuxTrackUpdateV3,
  type LuxClipV3,
  type LuxAnalysisV3,
  type VibeBaseV3,
  type LuxTargetZone,
  LUX_V3_EXTENSION as PROJECT_EXTENSION,
} from './LuxFileV3'
import {
  createEmptyChronosProjectV3,
  createTrackV3,
  toLuxFileV3,
  toChronosProjectV3,
  analysisDataToLuxAnalysisV3,
} from './LuxFileV3.factories'
import { serializeLuxV3, deserializeLuxV3, canonicalStringify } from './LuxFileV3.serializer'
import { generateChronosId } from './types'
import type { TimelineClip } from './TimelineClip'
import type { AnalysisData } from './types'

// ═══════════════════════════════════════════════════════════════════════════
// PATH UTILITIES (absolute ↔ relative)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert an absolute audio path to a path relative to the .lux file directory.
 * Works with both Windows (\\) and Unix (/) separators, including mixed
 * separators (routine in Electron on Windows, e.g. `C:/proj\test.lux`).
 *
 * LAZARUS M-2 FIX: The previous implementation had an operator-precedence bug —
 *   `luxFilePath.lastIndexOf('/') + 1 || luxFilePath.lastIndexOf('\\') + 1`
 *   bound the `||` INSIDE substring's second argument, so for a mixed-separator
 *   path it took the forward-slash index and produced a truncated directory.
 *   Now we find the last separator of EITHER kind explicitly.
 */
function toRelativePath(luxFilePath: string, absoluteAudioPath: string): string {
  if (!luxFilePath || !absoluteAudioPath) return absoluteAudioPath

  const lastFwd = luxFilePath.lastIndexOf('/')
  const lastBack = luxFilePath.lastIndexOf('\\')
  const lastSep = Math.max(lastFwd, lastBack)
  if (lastSep === -1) return absoluteAudioPath

  const luxDir = luxFilePath.substring(0, lastSep + 1)
  if (!luxDir) return absoluteAudioPath

  // Normalize both to forward slashes for comparison
  const normLuxDir = luxDir.replace(/\\/g, '/')
  const normAudio = absoluteAudioPath.replace(/\\/g, '/')

  if (normAudio.startsWith(normLuxDir)) {
    return normAudio.substring(normLuxDir.length)
  }

  // If not under the same directory, store as-is (absolute)
  return absoluteAudioPath
}

/**
 * Resolve a relative audio path to an absolute path using the .lux file directory.
 */
function resolveAbsolutePath(luxFilePath: string, relativeOrAbsolutePath: string): string {
  if (!luxFilePath || !relativeOrAbsolutePath) return relativeOrAbsolutePath

  // Already absolute (Windows drive letter or Unix root)
  if (/^[A-Za-z]:[\\/]/.test(relativeOrAbsolutePath) || relativeOrAbsolutePath.startsWith('/')) {
    return relativeOrAbsolutePath
  }

  const sep = luxFilePath.includes('\\') ? '\\' : '/'
  const lastSep = luxFilePath.lastIndexOf(sep)
  if (lastSep === -1) return relativeOrAbsolutePath

  const luxDir = luxFilePath.substring(0, lastSep + 1)
  return luxDir + relativeOrAbsolutePath.replace(/\//g, sep)
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type StoreEventType = 
  | 'project-new'
  | 'project-loaded'
  | 'project-saved'
  | 'project-modified'
  | 'audio-loaded'
  | 'audio-missing'
  // 🛡️ WAVE 2017: PROJECT LAZARUS
  | 'auto-save-start'
  | 'auto-save-complete'
  | 'auto-save-error'
  | 'recovery-available'
  // WAVE 7114: Track & clip events (merged from V2)
  | 'track-added'
  | 'track-removed'
  | 'track-reordered'
  | 'track-renamed'
  | 'track-enabled-changed'
  | 'track-solo-changed'
  | 'track-locked-changed'
  | 'track-updated'
  | 'clip-added'
  | 'clip-moved'
  | 'clip-removed'

type EventCallback = (data: any) => void

export interface SaveResult {
  success: boolean
  path?: string
  error?: string
}

export interface LoadResult {
  success: boolean
  project?: ChronosProjectV3
  path?: string
  error?: string
  audioMissing?: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// CHRONOS STORE CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class ChronosStore {
  /** Current project (V3 runtime model) */
  private project: ChronosProjectV3 = createEmptyChronosProjectV3()
  
  /** Path to current project file (null if not saved) */
  private projectPath: string | null = null
  
  /** Has unsaved changes */
  private isDirty: boolean = false
  
  /** Original JSON for dirty detection */
  private lastSavedJson: string = ''
  
  /** Event listeners */
  private listeners: Map<StoreEventType, Set<EventCallback>> = new Map()
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🛡️ WAVE 2017: PROJECT LAZARUS - Auto-Save System
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Auto-save interval ID */
  private autoSaveInterval: ReturnType<typeof setInterval> | null = null
  
  /** Auto-save interval in ms (default 60 seconds) */
  private autoSaveIntervalMs: number = 60000
  
  /** Is auto-save currently in progress */
  private isAutoSaving: boolean = false
  
  /** Last auto-save timestamp */
  private lastAutoSave: number = 0
  
  /** Auto-save file extension */
  private static readonly AUTO_SAVE_SUFFIX = '.auto'
  
  // ─────────────────────────────────────────────────────────────────────────
  // EVENT SYSTEM
  // ─────────────────────────────────────────────────────────────────────────
  
  on(event: StoreEventType, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }
  
  off(event: StoreEventType, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback)
  }
  
  private emit(event: StoreEventType, data?: any): void {
    this.listeners.get(event)?.forEach(cb => {
      try {
        cb(data)
      } catch (err) {
        console.error(`[ChronosStore] Event handler error:`, err)
      }
    })
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // GETTERS
  // ─────────────────────────────────────────────────────────────────────────
  
  get currentProject(): ChronosProjectV3 {
    return this.project
  }

  get tracks(): readonly LuxTrackV3[] {
    return this.project.tracks
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WAVE 7115: FLAT-CLIP BRIDGE — Track-aware distribution
  // Clips arrive as a flat array with runtime `trackId`. We distribute them
  // back to their correct tracks by `trackId`, preserving per-track structure.
  // ─────────────────────────────────────────────────────────────────────────

  /** Aggregate all clips across tracks as a flat TimelineClip[]. */
  private _getFlatClips(): TimelineClip[] {
    return this.project.tracks.flatMap(t =>
      t.clips.map(c => c as unknown as TimelineClip)
    ) as unknown as TimelineClip[]
  }

  /**
   * Distribute a flat clip list to their correct tracks by `trackId`.
   * Clips whose `trackId` matches a store track go to that track.
   * Unassigned clips (unknown trackId) go to `tracks[0]`.
   */
  private _distributeClips(clips: TimelineClip[]): void {
    const clipsByTrack = new Map<string, LuxClipV3[]>()
    for (const clip of clips) {
      const tid = clip.trackId
      const arr = clipsByTrack.get(tid) ?? []
      arr.push(clip as unknown as LuxClipV3)
      clipsByTrack.set(tid, arr)
    }

    const trackIds = new Set(this.project.tracks.map(t => t.id))
    const unassigned: LuxClipV3[] = []

    this.project.tracks = this.project.tracks.map(track => ({
      ...track,
      clips: clipsByTrack.get(track.id) ?? [],
    }))

    for (const [tid, arr] of clipsByTrack) {
      if (!trackIds.has(tid)) {
        unassigned.push(...arr)
      }
    }

    if (unassigned.length > 0 && this.project.tracks[0]) {
      this.project.tracks[0] = {
        ...this.project.tracks[0],
        clips: [...this.project.tracks[0].clips, ...unassigned],
      }
    }
  }

  /** Lightweight canonical snapshot for dirty detection (excludes checksum/timestamps). */
  private _dirtySnapshot(): string {
    return canonicalStringify({
      name: this.project.meta.name,
      durationMs: this.project.meta.durationMs,
      audio: this.project.audio,
      tracks: this.project.tracks,
      markers: this.project.markers,
      vibeBase: this.project.vibeBase,
    })
  }
  
  get currentPath(): string | null {
    return this.projectPath
  }
  
  get hasUnsavedChanges(): boolean {
    return this.isDirty
  }
  
  get projectName(): string {
    return this.project.meta.name
  }
  
  /** Title with dirty indicator */
  get windowTitle(): string {
    const name = this.project.meta.name
    const dirty = this.isDirty ? ' •' : ''
    return `${name}${dirty} - Chronos Studio`
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // PROJECT OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 🆕 Create new empty project
   */
  newProject(name: string = 'Untitled Project'): void {
    this.project = createEmptyChronosProjectV3(name)
    this.projectPath = null
    this.isDirty = false
    this.lastSavedJson = this._dirtySnapshot()
    
    console.log(`[ChronosStore] 🆕 New project: "${name}"`)
    this.emit('project-new', { project: this.project })
  }
  
  /**
   * 📝 Update project state from current session
   * WAVE 2014.5: Filters out blob: URLs - only stores real file paths
   */
  updateFromSession(
    clips: TimelineClip[],
    audio: { name: string; path: string; bpm: number; durationMs: number } | null,
    playheadMs: number = 0
  ): void {
    this._distributeClips(clips)
    this.project.playheadMs = playheadMs
    
    if (audio) {
      // 🔧 WAVE 2014.5: Never store blob: URLs - they're ephemeral
      const isRealPath = audio.path && !audio.path.startsWith('blob:')
      
      this.project.audio = {
        fileName: audio.name,
        relativePath: isRealPath ? audio.path : '', // Empty if blob, will prompt on save
        durationMs: audio.durationMs,
        offsetMs: 0,
        detectedBpm: audio.bpm,
        bpmConfidence: this.project.audio?.bpmConfidence ?? 0,
      }
      this.project.meta.durationMs = audio.durationMs
    }
    
    // Check if dirty (compare lightweight canonical snapshot)
    const currentJson = this._dirtySnapshot()
    if (currentJson !== this.lastSavedJson) {
      if (!this.isDirty) {
        this.isDirty = true
        this.emit('project-modified', { isDirty: true })
      }
    }
  }
  
  /**
   * 🎵 WAVE 2014.5: Set audio path directly (from real file path)
   */
  setAudioPath(path: string): void {
    if (this.project.audio) {
      this.project.audio.relativePath = path
      console.log(`[ChronosStore] 🎵 Audio path set: ${path}`)
    }
  }

  /**
   * 🔬 FASE 4: Embed phantom analysis data into the project.
   * Converts AnalysisData → LuxAnalysisV3 and stores it in project.analysis.
   * Also updates audio.detectedBpm and audio.bpmConfidence.
   */
  setAnalysisData(analysisData: AnalysisData): void {
    const lux = analysisDataToLuxAnalysisV3(analysisData)
    this.project.analysis = lux

    if (this.project.audio) {
      this.project.audio.detectedBpm = lux.detectedBpm
      this.project.audio.bpmConfidence = lux.bpmConfidence
    }

    this.markDirty()
    console.log(`[ChronosStore] 🔬 Analysis embedded: BPM=${lux.detectedBpm} conf=${lux.bpmConfidence.toFixed(2)} sections=${lux.sections.length} transients=${lux.transients.length}`)
  }

  /**
   * 🔬 FASE 4: Check if the project has embedded analysis data.
   */
  hasEmbeddedAnalysis(): boolean {
    return this.project.analysis !== null && this.project.analysis !== undefined
  }

  /**
   * 🌫️ FASE 5: Set the project's vibeBase (whisper).
   * The whisper is the default vibe that plays when no VibeClip is active.
   * Uses L0 (automatic photonics) for reactive movement/color.
   */
  setVibeBase(vibeId: string, displayName?: string): void {
    const existing = this.project.vibeBase
    this.project.vibeBase = {
      vibeId,
      displayName: displayName ?? existing?.displayName ?? vibeId,
      intensity: existing?.intensity ?? 0.5,
      color: existing?.color ?? '#64748b',
      icon: existing?.icon ?? '🌙',
    }
    this.markDirty()
    console.log(`[ChronosStore] 🌫️ VibeBase set: ${vibeId} (${this.project.vibeBase.displayName})`)
  }

  /**
   * 🌫️ FASE 5: Get the project's current vibeBase (whisper), or null.
   */
  getVibeBase(): VibeBaseV3 | null {
    return this.project.vibeBase
  }
  
  /**
   * 🔖 Mark project as modified (for external changes)
   */
  markDirty(): void {
    if (!this.isDirty) {
      this.isDirty = true
      this.emit('project-modified', { isDirty: true })
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WAVE 7114: TRACK CRUD (merged from ChronosStoreV2)
  // ─────────────────────────────────────────────────────────────────────────

  /** Directly load a project into the store (no file I/O). */
  loadProject(project: ChronosProjectV3): void {
    this.project = project
    this.projectPath = null
    this.isDirty = false
    this.lastSavedJson = this._dirtySnapshot()
    this.emit('project-loaded', { project })
    console.log(`[ChronosStore] 📂 Project loaded: "${project.meta.name}"`)
  }

  addTrack(targetZone: LuxTargetZone): LuxTrackV3 {
    const track = createTrackV3(targetZone, this.project.tracks)
    this.project.tracks = [...this.project.tracks, track]
    this._touchModified()
    this.emit('track-added', { track })
    console.log(`[ChronosStore] ➕ Track added: "${track.visualLabel}" → ${targetZone}`)
    return track
  }

  removeTrack(trackId: string): void {
    const track = this._findTrack(trackId)
    if (!track) {
      console.warn(`[ChronosStore] removeTrack: id "${trackId}" not found`)
      return
    }
    if (track.locked) {
      console.warn(`[ChronosStore] removeTrack: track "${track.visualLabel}" is locked — cannot delete`)
      return
    }
    const before = this.project.tracks.length
    this.project.tracks = this.project.tracks
      .filter(t => t.id !== trackId)
      .map((t, i) => ({ ...t, order: i }))
    if (this.project.tracks.length === before) {
      console.warn(`[ChronosStore] removeTrack: id "${trackId}" not found`)
      return
    }
    this._touchModified()
    this.emit('track-removed', { trackId })
  }

  reorderTrack(trackId: string, newOrder: number): void {
    // P2.18 FIX: Guard against NaN/Infinity order values corrupting the sort.
    // If a track has a non-finite order, it's placed at the end (order = tracks.length).
    const tracks = [...this.project.tracks].sort((a, b) => {
      const aOrder = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER
      const bOrder = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER
      return aOrder - bOrder
    })
    const idx = tracks.findIndex(t => t.id === trackId)
    if (idx === -1) {
      console.warn(`[ChronosStore] reorderTrack: id "${trackId}" not found`)
      return
    }
    const [moved] = tracks.splice(idx, 1)
    const clampedOrder = Math.max(0, Math.min(newOrder, tracks.length))
    tracks.splice(clampedOrder, 0, moved)
    this.project.tracks = tracks.map((t, i) => ({ ...t, order: i }))
    this._touchModified()
    this.emit('track-reordered', { trackId, newOrder: clampedOrder })
  }

  renameTrack(trackId: string, newLabel: string): void {
    this._patchTrack(trackId, { visualLabel: newLabel.trim() || trackId })
    this.emit('track-renamed', { trackId, newLabel })
  }

  setTrackEnabled(trackId: string, enabled: boolean): void {
    this._patchTrack(trackId, { enabled })
    this.emit('track-enabled-changed', { trackId, enabled })
  }

  setTrackSolo(trackId: string, solo: boolean): void {
    this._patchTrack(trackId, { solo })
    this.emit('track-solo-changed', { trackId, solo })
  }

  setTrackLocked(trackId: string, locked: boolean): void {
    this._patchTrack(trackId, { locked })
    this.emit('track-locked-changed', { trackId, locked })
  }

  updateTrack(trackId: string, patch: LuxTrackUpdateV3): void {
    this._patchTrack(trackId, patch)
    this.emit('track-updated', { trackId, patch })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WAVE 7114: CLIP CRUD (merged from ChronosStoreV2)
  // ─────────────────────────────────────────────────────────────────────────

  addClip(
    trackId: string,
    clipData: Omit<TimelineClip, 'id' | 'trackId'>
  ): TimelineClip {
    const track = this._findTrack(trackId)
    if (!track) throw new Error(`[ChronosStore] addClip: track "${trackId}" not found`)
    const clip: TimelineClip = {
      ...clipData,
      id: generateChronosId(),
      trackId,
    } as TimelineClip
    this.project.tracks = this.project.tracks.map(t =>
      t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t
    )
    this._touchModified()
    this.emit('clip-added', { trackId, clip })
    return clip
  }

  moveClipToTrack(clipId: string, targetTrackId: string): void {
    let movedClip: LuxClipV3 | null = null

    const tracks = this.project.tracks.map(t => {
      const idx = t.clips.findIndex(c => c.id === clipId)
      if (idx === -1) return t
      movedClip = { ...t.clips[idx] }
      return { ...t, clips: t.clips.filter(c => c.id !== clipId) }
    })

    if (!movedClip) {
      console.warn(`[ChronosStore] moveClipToTrack: clip "${clipId}" not found`)
      return
    }

    const targetExists = tracks.some(t => t.id === targetTrackId)
    if (!targetExists) {
      console.warn(`[ChronosStore] moveClipToTrack: target track "${targetTrackId}" not found`)
      return
    }

    this.project.tracks = tracks.map(t =>
      t.id === targetTrackId ? { ...t, clips: [...t.clips, movedClip!] } : t
    )
    this._touchModified()
    this.emit('clip-moved', { clipId, targetTrackId })
  }

  removeClip(clipId: string): void {
    let found = false
    this.project.tracks = this.project.tracks.map(t => {
      const before = t.clips.length
      const clips = t.clips.filter(c => c.id !== clipId)
      if (clips.length < before) found = true
      return { ...t, clips }
    })
    if (!found) {
      console.warn(`[ChronosStore] removeClip: clip "${clipId}" not found`)
      return
    }
    this._touchModified()
    this.emit('clip-removed', { clipId })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WAVE 7114: INTERNAL HELPERS (merged from ChronosStoreV2)
  // ─────────────────────────────────────────────────────────────────────────

  private _findTrack(trackId: string): LuxTrackV3 | undefined {
    return this.project.tracks.find(t => t.id === trackId)
  }

  private _patchTrack(trackId: string, patch: Partial<LuxTrackV3>): void {
    let found = false
    this.project.tracks = this.project.tracks.map(t => {
      if (t.id !== trackId) return t
      found = true
      return { ...t, ...patch }
    })
    if (!found) {
      console.warn(`[ChronosStore] _patchTrack: id "${trackId}" not found`)
      return
    }
    this._touchModified()
  }

  private _touchModified(): void {
    this.project = {
      ...this.project,
      meta: {
        ...this.project.meta,
        modifiedAt: new Date().toISOString(),
      },
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FILE OPERATIONS (Renderer side - uses IPC)
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 💾 Save project to file
   * Uses Electron IPC to open native save dialog
   */
  async save(forceNewPath: boolean = false): Promise<SaveResult> {
    const needsPath = !this.projectPath || forceNewPath
    
    try {
      // ── FASE 4: Convert audio path to relative for serialization ONLY ──
      // LAZARUS M-2 FIX: Do NOT mutate this.project.audio.relativePath in
      //   memory. The previous implementation left the live runtime holding a
      //   relative path, so any post-save consumer of getAudioInfo() (audio
      //   reload, checkFileExists, re-analysis) received a path that would not
      //   resolve from the process working directory → false "audio missing".
      //   We now build a shallow-cloned project for serialization with the
      //   relative audio path, leaving the live state's absolute path intact.
      let projectForSave = this.project
      if (this.projectPath && this.project.audio) {
        const relativePath = toRelativePath(this.projectPath, this.project.audio.relativePath)
        projectForSave = {
          ...this.project,
          audio: { ...this.project.audio, relativePath },
        }
      }

      // Prepare project data — strip runtime state → LuxFileV3 → serialize (+checksum)
      const json = await serializeLuxV3(toLuxFileV3(projectForSave))
      
      // Check if we're in Electron environment via luxsync.chronos
      const chronosAPI = (window as any).luxsync?.chronos
      if (!chronosAPI?.saveProject) {
        // Fallback: download as file (for development)
        return this.saveAsBrowserDownload(json)
      }
      
      // Use Electron IPC
      const result = await chronosAPI.saveProject({
        json,
        currentPath: needsPath ? null : this.projectPath,
        defaultName: this.project.meta.name + PROJECT_EXTENSION,
      })
      
      if (result.cancelled) {
        return { success: false, error: 'Cancelled' }
      }
      
      if (result.success && result.path) {
        // 🆔 WAVE 2014.5: PROJECT IDENTITY SYNC
        // Extract filename without extension and update project name
        const fileName = this.extractProjectName(result.path)
        if (fileName && fileName !== this.project.meta.name) {
          this.project.meta.name = fileName
          console.log(`[ChronosStore] 🆔 Project renamed to: "${fileName}"`)
        }
        
        // Update modified timestamp
        this.project.meta.modifiedAt = new Date().toISOString()
        
        this.projectPath = result.path
        this.isDirty = false
        this.lastSavedJson = this._dirtySnapshot()
        
        console.log(`[ChronosStore] 💾 Saved to: ${result.path}`)
        this.emit('project-saved', { path: result.path, name: fileName })
      }
      
      return result
    } catch (err) {
      console.error('[ChronosStore] Save failed:', err)
      return { success: false, error: String(err) }
    }
  }
  
  /**
   * 📂 Load project from file
   * Uses Electron IPC to open native file dialog
   */
  async load(filePath?: string): Promise<LoadResult> {
    try {
      // Check if we're in Electron environment via luxsync.chronos
      const chronosAPI = (window as any).luxsync?.chronos
      if (!chronosAPI?.loadProject) {
        // Fallback: use file input (for development)
        return this.loadFromFileInput()
      }
      
      // Use Electron IPC
      const result = await chronosAPI.loadProject({ path: filePath })
      
      if (result.cancelled) {
        return { success: false, error: 'Cancelled' }
      }
      
      if (result.success && result.json) {
        const des = await deserializeLuxV3(result.json)
        if (!des.file) {
          console.warn('[ChronosStore] ❌ Project validation errors:', des.validation.errors)
          const checksumCorruption = des.validation.errors.some((e) => e.includes('Checksum mismatch'))
          return {
            success: false,
            error: checksumCorruption
              ? 'Project file is corrupt (checksum mismatch) — refused to load'
              : 'Invalid project file format',
          }
        }
        if (des.validation.warnings.length > 0) {
          console.warn('[ChronosStore] ⚠️ Project validation warnings:', des.validation.warnings)
        }
        // LAZARUS B-4: a wrong checksum now hard-rejects in deserializeLuxV3
        //   (file === null). A missing checksum is a warning and is permitted.
        
        const project = toChronosProjectV3(des.file)
        this.project = project
        this.projectPath = result.path
        this.isDirty = false
        this.lastSavedJson = this._dirtySnapshot()
        
        // ── FASE 4: Resolve relative audio path to absolute ──
        if (result.path && project.audio?.relativePath) {
          const absolutePath = resolveAbsolutePath(result.path, project.audio.relativePath)
          project.audio.relativePath = absolutePath
          console.log(`[ChronosStore] 🎵 Audio path resolved: ${absolutePath}`)
        }
        
        console.log(`[ChronosStore] 📂 Loaded: ${result.path}`)
        this.emit('project-loaded', { project, path: result.path })
        
        // Check if audio file exists
        if (project.audio?.relativePath && chronosAPI.checkFileExists) {
          const audioExists = await chronosAPI.checkFileExists(project.audio.relativePath)
          if (!audioExists) {
            this.emit('audio-missing', { audioPath: project.audio.relativePath })
            return { success: true, project, path: result.path, audioMissing: true }
          }
        }
        
        return { success: true, project, path: result.path }
      }
      
      return result
    } catch (err) {
      console.error('[ChronosStore] Load failed:', err)
      return { success: false, error: String(err) }
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // BROWSER FALLBACKS (for development without Electron)
  // ─────────────────────────────────────────────────────────────────────────
  
  private saveAsBrowserDownload(json: string): SaveResult {
    try {
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = this.project.meta.name + PROJECT_EXTENSION
      a.click()
      URL.revokeObjectURL(url)
      
      this.isDirty = false
      this.lastSavedJson = json
      console.log('[ChronosStore] 💾 Downloaded as browser file')
      
      return { success: true, path: a.download }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  }
  
  private loadFromFileInput(): Promise<LoadResult> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = PROJECT_EXTENSION
      
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) {
          resolve({ success: false, error: 'No file selected' })
          return
        }
        
        try {
          const json = await file.text()
          const des = await deserializeLuxV3(json)
          
          if (!des.file) {
            resolve({ success: false, error: 'Invalid project file' })
            return
          }
          
          const project = toChronosProjectV3(des.file)
          this.project = project
          this.projectPath = null // Can't get real path in browser
          this.isDirty = false
          this.lastSavedJson = this._dirtySnapshot()
          
          console.log('[ChronosStore] 📂 Loaded from browser file')
          this.emit('project-loaded', { project })
          
          resolve({ success: true, project })
        } catch (err) {
          resolve({ success: false, error: String(err) })
        }
      }
      
      input.click()
    })
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // EXPORT / IMPORT
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 📤 Export timeline clips only (for sharing)
   */
  exportClips(): TimelineClip[] {
    return this._getFlatClips()
  }
  
  /**
   * 📥 Import clips into current project
   */
  importClips(clips: TimelineClip[], append: boolean = true): void {
    const next = append ? [...this._getFlatClips(), ...clips] : clips
    this._distributeClips(next)
    this.markDirty()
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // 🆔 WAVE 2014.5: HELPERS
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Extract project name from file path (without extension)
   * C:/Projects/test1.lux -> "test1"
   */
  private extractProjectName(filePath: string): string {
    // Handle both Windows and Unix paths
    const separator = filePath.includes('\\') ? '\\' : '/'
    const parts = filePath.split(separator)
    const fileName = parts[parts.length - 1] || 'Untitled'
    
    // Remove .lux extension
    if (fileName.toLowerCase().endsWith(PROJECT_EXTENSION)) {
      return fileName.slice(0, -PROJECT_EXTENSION.length)
    }
    return fileName
  }
  
  /**
   * 🧹 WAVE 2014.5: Set clips directly (for load operations)
   */
  setClips(clips: TimelineClip[]): void {
    this._distributeClips(clips)
    // Don't mark dirty - this is from a load operation
  }

  /**
   * WAVE 7115: Get a single clip by ID with runtime `trackId` injected.
   * Searches all tracks and injects the owning track's id (or 'vibe' for vibe clips).
   */
  getClipById(clipId: string): TimelineClip | undefined {
    for (const track of this.project.tracks) {
      const found = track.clips.find(c => c.id === clipId)
      if (found) {
        // VALKYRIE M-3: A getter must NOT mutate persisted state. The previous
        //   implementation wrote `clip.trackId = ...` directly onto the stored
        //   clip object, bypassing the readonly contract and leaving a
        //   runtime-only field injected into the persisted tree. We now return
        //   a shallow clone with trackId injected, leaving the stored object
        //   untouched. The `as unknown as TimelineClip` cast is still needed
        //   because LuxClipV3 does not carry trackId (it's runtime-only), but
        //   the clone ensures the persisted reference is never written to.
        const clip = found as unknown as TimelineClip
        return { ...clip, trackId: clip.type === 'vibe' ? 'vibe' : track.id }
      }
    }
    return undefined
  }
  
  /**
   * 🎵 WAVE 2014.5: Get stored audio info for restoration
   */
  getAudioInfo(): { path: string; bpm: number; durationMs: number } | null {
    if (!this.project.audio) return null
    return {
      path: this.project.audio.relativePath,
      bpm: this.project.audio.detectedBpm,
      durationMs: this.project.audio.durationMs,
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🛡️ WAVE 2017: PROJECT LAZARUS - Auto-Save & Recovery System
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Start the auto-save heartbeat
   * @param intervalMs Auto-save interval in milliseconds (default 60000 = 1 minute)
   */
  startAutoSave(intervalMs: number = 60000): void {
    // Clear existing interval if any
    this.stopAutoSave()
    
    this.autoSaveIntervalMs = intervalMs
    console.log(`[ChronosStore] 🛡️ PROJECT LAZARUS: Auto-save started (every ${intervalMs / 1000}s)`)
    
    this.autoSaveInterval = setInterval(() => {
      this.performAutoSave()
    }, intervalMs)
  }
  
  /**
   * Stop the auto-save heartbeat
   */
  stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval)
      this.autoSaveInterval = null
      console.log('[ChronosStore] 🛡️ PROJECT LAZARUS: Auto-save stopped')
    }
  }
  
  /**
   * Perform auto-save to shadow file
   * Only saves if there are unsaved changes
   */
  private async performAutoSave(): Promise<void> {
    // Skip if no unsaved changes or already saving
    if (!this.isDirty || this.isAutoSaving) {
      return
    }
    
    // Skip if project has no content worth saving
    if (!this.projectPath && this._getFlatClips().length === 0 && !this.project.audio) {
      return
    }
    
    this.isAutoSaving = true
    this.emit('auto-save-start')
    
    try {
      const json = await serializeLuxV3(toLuxFileV3(this.project))
      const autoSavePath = this.getAutoSavePath()
      
      // Use Electron IPC for file operations
      const chronosAPI = (window as any).luxsync?.chronos
      if (chronosAPI?.writeAutoSave) {
        const result = await chronosAPI.writeAutoSave({
          path: autoSavePath,
          json,
        })
        
        if (result.success) {
          this.lastAutoSave = Date.now()
          console.log(`[ChronosStore] 🛡️ Auto-saved: ${autoSavePath}`)
          this.emit('auto-save-complete', { path: autoSavePath, timestamp: this.lastAutoSave })
        } else {
          throw new Error(result.error || 'Auto-save failed')
        }
      } else {
        // Fallback: store in localStorage for development
        localStorage.setItem('chronos-auto-save', json)
        localStorage.setItem('chronos-auto-save-time', Date.now().toString())
        this.lastAutoSave = Date.now()
        console.log('[ChronosStore] 🛡️ Auto-saved to localStorage (dev mode)')
        this.emit('auto-save-complete', { path: 'localStorage', timestamp: this.lastAutoSave })
      }
    } catch (err) {
      console.error('[ChronosStore] ❌ Auto-save failed:', err)
      this.emit('auto-save-error', { error: String(err) })
    } finally {
      this.isAutoSaving = false
    }
  }
  
  /**
   * Get the auto-save file path
   * [ProjectName].lux.auto or chronos-recovery.lux.auto for unsaved projects
   */
  private getAutoSavePath(): string {
    if (this.projectPath) {
      return this.projectPath + ChronosStore.AUTO_SAVE_SUFFIX
    }
    // For unsaved projects, use a default recovery path
    return `chronos-recovery-${this.project.meta.name}${PROJECT_EXTENSION}${ChronosStore.AUTO_SAVE_SUFFIX}`
  }
  
  /**
   * Check if a recovery file exists and is newer than the original
   * @returns Recovery info or null if no recovery available
   */
  async checkForRecovery(): Promise<{ autoSavePath: string; autoSaveTime: number } | null> {
    try {
      const chronosAPI = (window as any).luxsync?.chronos
      if (!chronosAPI?.checkAutoSave) {
        // Fallback: check localStorage
        const autoSave = localStorage.getItem('chronos-auto-save')
        const autoSaveTime = localStorage.getItem('chronos-auto-save-time')
        if (autoSave && autoSaveTime) {
          return {
            autoSavePath: 'localStorage',
            autoSaveTime: parseInt(autoSaveTime, 10),
          }
        }
        return null
      }
      
      const autoSavePath = this.getAutoSavePath()
      const result = await chronosAPI.checkAutoSave({ path: autoSavePath })
      
      if (result.exists && result.mtime) {
        // Check if auto-save is newer than last manual save
        const autoSaveTime = new Date(result.mtime).getTime()
        const lastSaveTime = Date.parse(this.project.meta.modifiedAt) || 0
        
        if (autoSaveTime > lastSaveTime) {
          console.log(`[ChronosStore] 🛡️ Recovery available: ${autoSavePath}`)
          this.emit('recovery-available', { autoSavePath, autoSaveTime })
          return { autoSavePath, autoSaveTime }
        }
      }
      
      return null
    } catch (err) {
      console.error('[ChronosStore] Recovery check failed:', err)
      return null
    }
  }
  
  /**
   * Recover from auto-save file
   */
  async recoverFromAutoSave(autoSavePath: string): Promise<LoadResult> {
    console.log(`[ChronosStore] 🛡️ RESURRECTION: Recovering from ${autoSavePath}`)
    
    try {
      const chronosAPI = (window as any).luxsync?.chronos
      
      if (autoSavePath === 'localStorage') {
        // Recover from localStorage
        const json = localStorage.getItem('chronos-auto-save')
        if (!json) {
          return { success: false, error: 'No recovery data found' }
        }
        
        const des = await deserializeLuxV3(json)
        if (!des.file) {
          return { success: false, error: 'Recovery data is corrupted' }
        }
        
        const project = toChronosProjectV3(des.file)
        this.project = project
        this.isDirty = true // Mark as dirty so user saves properly
        this.emit('project-loaded', { project, path: null, recovered: true })
        
        // Clear recovery data
        localStorage.removeItem('chronos-auto-save')
        localStorage.removeItem('chronos-auto-save-time')
        
        return { success: true, project }
      }
      
      if (!chronosAPI?.loadAutoSave) {
        return { success: false, error: 'Recovery not available in this environment' }
      }
      
      const result = await chronosAPI.loadAutoSave({ path: autoSavePath })
      
      if (result.success && result.json) {
        const des = await deserializeLuxV3(result.json)
        if (!des.file) {
          return { success: false, error: 'Recovery data is corrupted' }
        }
        
        const project = toChronosProjectV3(des.file)
        this.project = project
        this.isDirty = true // Mark as dirty so user saves properly
        this.projectPath = autoSavePath.replace(ChronosStore.AUTO_SAVE_SUFFIX, '')
        
        this.emit('project-loaded', { project, path: this.projectPath, recovered: true })
        
        return { success: true, project, path: this.projectPath }
      }
      
      return { success: false, error: result.error || 'Recovery failed' }
    } catch (err) {
      console.error('[ChronosStore] ❌ Recovery failed:', err)
      return { success: false, error: String(err) }
    }
  }
  
  /**
   * Delete auto-save file (after successful manual save or user chooses to ignore)
   */
  async clearAutoSave(): Promise<void> {
    try {
      const chronosAPI = (window as any).luxsync?.chronos
      const autoSavePath = this.getAutoSavePath()
      
      if (chronosAPI?.deleteAutoSave) {
        await chronosAPI.deleteAutoSave({ path: autoSavePath })
        console.log(`[ChronosStore] 🗑️ Auto-save cleared: ${autoSavePath}`)
      } else {
        localStorage.removeItem('chronos-auto-save')
        localStorage.removeItem('chronos-auto-save-time')
        console.log('[ChronosStore] 🗑️ Auto-save cleared from localStorage')
      }
    } catch (err) {
      // Non-critical, just log
      console.warn('[ChronosStore] Could not clear auto-save:', err)
    }
  }
  
  /**
   * Get auto-save status for UI
   */
  get autoSaveStatus(): { enabled: boolean; lastSave: number; isRunning: boolean } {
    return {
      enabled: this.autoSaveInterval !== null,
      lastSave: this.lastAutoSave,
      isRunning: this.isAutoSaving,
    }
  }

  /**
   * P1.9 FIX: Dispose the store — stops the auto-save interval and clears
   * all event listeners. Should be called when closing a project or tearing
   * down the host component to prevent zombie timers and listener leaks.
   */
  dispose(): void {
    this.stopAutoSave()
    this.listeners.clear()
    console.log('[ChronosStore] 🗑️ Disposed (auto-save stopped, listeners cleared)')
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

let instance: ChronosStore | null = null

export function getChronosStore(): ChronosStore {
  if (!instance) {
    instance = new ChronosStore()
    console.log('[ChronosStore] 💾 Store initialized')
  }
  return instance
}

export default ChronosStore
