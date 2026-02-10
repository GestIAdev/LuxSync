/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 💾 CHRONOS PROJECT - WAVE 2014: THE MEMORY CORE
 * 
 * LuxSync Project File Format (.lux)
 * Serializable format for saving/loading complete Chronos sessions.
 * 
 * FILE STRUCTURE:
 * - meta: Project metadata (version, author, timestamps)
 * - audio: Audio file reference and analysis data
 * - timeline: All clips and their positions
 * - library: Custom effects (future)
 * 
 * AXIOMA ANTI-SIMULACIÓN:
 * The saved project represents REAL work, not demos.
 * 
 * @module chronos/core/ChronosProject
 * @version WAVE 2014
 */

import type { TimelineClip } from './TimelineClip'

// ═══════════════════════════════════════════════════════════════════════════
// PROJECT FILE FORMAT (.lux)
// ═══════════════════════════════════════════════════════════════════════════

/** Current project file version */
export const PROJECT_VERSION = '2.0'

/** File extension for LuxSync projects */
export const PROJECT_EXTENSION = '.lux'

/** MIME type for LuxSync projects */
export const PROJECT_MIME = 'application/x-luxsync-project'

/** Project metadata */
export interface ProjectMeta {
  /** File format version */
  version: string
  
  /** Author name */
  author: string
  
  /** Creation timestamp */
  created: number
  
  /** Last modified timestamp */
  modified: number
  
  /** Total duration in ms */
  durationMs: number
  
  /** Project name (displayed in title bar) */
  name: string
}

/** Audio reference */
export interface ProjectAudio {
  /** Original audio filename */
  name: string
  
  /** Full path to audio file (absolute or relative to .lux file) */
  path: string
  
  /** Detected or set BPM */
  bpm: number
  
  /** Audio start offset in timeline (ms) */
  offsetMs: number
  
  /** Audio duration in ms */
  durationMs: number
  
  /** Checksum for integrity verification (optional) */
  checksum?: string
}

/** Timeline data */
export interface ProjectTimeline {
  /** All clips in the project */
  clips: TimelineClip[]
  
  /** Last known playhead position (for session restore) */
  playheadMs: number
  
  /** Viewport position (for session restore) */
  viewportStartMs: number
  
  /** Zoom level */
  pixelsPerSecond: number
}

/** Custom effects library (future expansion) */
export interface ProjectLibrary {
  /** Custom effect definitions */
  customEffects: any[]
  
  /** User-defined presets */
  presets: any[]
}

/** Complete LuxSync Project File */
export interface LuxProject {
  /** Project metadata */
  meta: ProjectMeta
  
  /** Audio reference */
  audio: ProjectAudio | null
  
  /** Timeline data */
  timeline: ProjectTimeline
  
  /** Custom library (future) */
  library: ProjectLibrary
}

// ═══════════════════════════════════════════════════════════════════════════
// PROJECT FACTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a new empty project
 */
export function createEmptyProject(name: string = 'Untitled Project'): LuxProject {
  const now = Date.now()
  
  return {
    meta: {
      version: PROJECT_VERSION,
      author: '',
      created: now,
      modified: now,
      durationMs: 60000, // Default 1 minute
      name,
    },
    audio: null,
    timeline: {
      clips: [],
      playheadMs: 0,
      viewportStartMs: 0,
      pixelsPerSecond: 100,
    },
    library: {
      customEffects: [],
      presets: [],
    },
  }
}

/**
 * Create a project from current session state
 */
export function createProjectFromState(
  name: string,
  clips: TimelineClip[],
  audio: {
    name: string
    path: string
    bpm: number
    durationMs: number
  } | null,
  playheadMs: number = 0,
  viewportStartMs: number = 0,
  pixelsPerSecond: number = 100
): LuxProject {
  const now = Date.now()
  
  return {
    meta: {
      version: PROJECT_VERSION,
      author: '',
      created: now,
      modified: now,
      durationMs: audio?.durationMs ?? 60000,
      name,
    },
    audio: audio ? {
      name: audio.name,
      path: audio.path,
      bpm: audio.bpm,
      offsetMs: 0,
      durationMs: audio.durationMs,
    } : null,
    timeline: {
      clips,
      playheadMs,
      viewportStartMs,
      pixelsPerSecond,
    },
    library: {
      customEffects: [],
      presets: [],
    },
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SERIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Serialize project to JSON string
 */
export function serializeProject(project: LuxProject): string {
  // Update modified timestamp
  project.meta.modified = Date.now()
  
  return JSON.stringify(project, null, 2)
}

/**
 * Deserialize project from JSON string
 */
export function deserializeProject(json: string): LuxProject | null {
  try {
    const data = JSON.parse(json)
    
    // Validate version
    if (!data.meta?.version) {
      console.error('[ChronosProject] Invalid project: missing version')
      return null
    }
    
    // Version migration (future)
    if (data.meta.version !== PROJECT_VERSION) {
      console.warn(`[ChronosProject] Project version mismatch: ${data.meta.version} vs ${PROJECT_VERSION}`)
      // Could add migration logic here
    }
    
    // Validate required fields
    if (!data.timeline?.clips) {
      console.error('[ChronosProject] Invalid project: missing timeline.clips')
      return null
    }
    
    return data as LuxProject
  } catch (err) {
    console.error('[ChronosProject] Failed to parse project:', err)
    return null
  }
}

/**
 * Validate project integrity
 */
export function validateProject(project: LuxProject): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Check meta
  if (!project.meta) errors.push('Missing meta')
  if (!project.meta?.version) errors.push('Missing meta.version')
  if (!project.meta?.name) errors.push('Missing meta.name')
  
  // Check timeline
  if (!project.timeline) errors.push('Missing timeline')
  if (!Array.isArray(project.timeline?.clips)) errors.push('Invalid timeline.clips')
  
  // Check clips integrity
  project.timeline?.clips?.forEach((clip, i) => {
    if (!clip.id) errors.push(`Clip ${i}: missing id`)
    if (!clip.type) errors.push(`Clip ${i}: missing type`)
    if (typeof clip.startMs !== 'number') errors.push(`Clip ${i}: invalid startMs`)
    if (typeof clip.endMs !== 'number') errors.push(`Clip ${i}: invalid endMs`)
  })
  
  return {
    valid: errors.length === 0,
    errors,
  }
}

export default LuxProject
