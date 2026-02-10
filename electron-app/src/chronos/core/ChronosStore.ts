/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 💾 CHRONOS STORE - WAVE 2014: THE MEMORY CORE
 * 
 * Central state manager for Chronos projects.
 * Handles save/load operations, dirty state tracking, and IPC with Electron.
 * 
 * RESPONSIBILITIES:
 * - Track current project state
 * - Detect unsaved changes
 * - Coordinate save/load with Electron main process
 * - Emit events for UI updates
 * 
 * @module chronos/core/ChronosStore
 * @version WAVE 2014
 */

import {
  type LuxProject,
  createEmptyProject,
  createProjectFromState,
  serializeProject,
  deserializeProject,
  validateProject,
  PROJECT_EXTENSION,
} from './ChronosProject'
import type { TimelineClip } from './TimelineClip'

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

type EventCallback = (data: any) => void

export interface SaveResult {
  success: boolean
  path?: string
  error?: string
}

export interface LoadResult {
  success: boolean
  project?: LuxProject
  path?: string
  error?: string
  audioMissing?: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// CHRONOS STORE CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class ChronosStore {
  /** Current project */
  private project: LuxProject = createEmptyProject()
  
  /** Path to current project file (null if not saved) */
  private projectPath: string | null = null
  
  /** Has unsaved changes */
  private isDirty: boolean = false
  
  /** Original JSON for dirty detection */
  private lastSavedJson: string = ''
  
  /** Event listeners */
  private listeners: Map<StoreEventType, Set<EventCallback>> = new Map()
  
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
  
  get currentProject(): LuxProject {
    return this.project
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
    this.project = createEmptyProject(name)
    this.projectPath = null
    this.isDirty = false
    this.lastSavedJson = serializeProject(this.project)
    
    console.log(`[ChronosStore] 🆕 New project: "${name}"`)
    this.emit('project-new', { project: this.project })
  }
  
  /**
   * 📝 Update project state from current session
   */
  updateFromSession(
    clips: TimelineClip[],
    audio: { name: string; path: string; bpm: number; durationMs: number } | null,
    playheadMs: number = 0
  ): void {
    this.project.timeline.clips = clips
    this.project.timeline.playheadMs = playheadMs
    
    if (audio) {
      this.project.audio = {
        name: audio.name,
        path: audio.path,
        bpm: audio.bpm,
        offsetMs: 0,
        durationMs: audio.durationMs,
      }
      this.project.meta.durationMs = audio.durationMs
    }
    
    // Check if dirty
    const currentJson = serializeProject(this.project)
    if (currentJson !== this.lastSavedJson) {
      this.isDirty = true
      this.emit('project-modified', { isDirty: true })
    }
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
  // FILE OPERATIONS (Renderer side - uses IPC)
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 💾 Save project to file
   * Uses Electron IPC to open native save dialog
   */
  async save(forceNewPath: boolean = false): Promise<SaveResult> {
    const needsPath = !this.projectPath || forceNewPath
    
    try {
      // Prepare project data
      const json = serializeProject(this.project)
      
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
      
      if (result.success) {
        this.projectPath = result.path
        this.isDirty = false
        this.lastSavedJson = json
        console.log(`[ChronosStore] 💾 Saved to: ${result.path}`)
        this.emit('project-saved', { path: result.path })
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
        const project = deserializeProject(result.json)
        if (!project) {
          return { success: false, error: 'Invalid project file format' }
        }
        
        // Validate project
        const validation = validateProject(project)
        if (!validation.valid) {
          console.warn('[ChronosStore] Project validation warnings:', validation.errors)
        }
        
        this.project = project
        this.projectPath = result.path
        this.isDirty = false
        this.lastSavedJson = result.json
        
        console.log(`[ChronosStore] 📂 Loaded: ${result.path}`)
        this.emit('project-loaded', { project, path: result.path })
        
        // Check if audio file exists
        if (project.audio?.path && chronosAPI.checkFileExists) {
          const audioExists = await chronosAPI.checkFileExists(project.audio.path)
          if (!audioExists) {
            this.emit('audio-missing', { audioPath: project.audio.path })
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
          const project = deserializeProject(json)
          
          if (!project) {
            resolve({ success: false, error: 'Invalid project file' })
            return
          }
          
          this.project = project
          this.projectPath = null // Can't get real path in browser
          this.isDirty = false
          this.lastSavedJson = json
          
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
    return [...this.project.timeline.clips]
  }
  
  /**
   * 📥 Import clips into current project
   */
  importClips(clips: TimelineClip[], append: boolean = true): void {
    if (append) {
      this.project.timeline.clips.push(...clips)
    } else {
      this.project.timeline.clips = clips
    }
    this.markDirty()
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
