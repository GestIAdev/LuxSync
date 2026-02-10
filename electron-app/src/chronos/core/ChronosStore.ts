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
  // 🛡️ WAVE 2017: PROJECT LAZARUS
  | 'auto-save-start'
  | 'auto-save-complete'
  | 'auto-save-error'
  | 'recovery-available'

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
   * WAVE 2014.5: Filters out blob: URLs - only stores real file paths
   */
  updateFromSession(
    clips: TimelineClip[],
    audio: { name: string; path: string; bpm: number; durationMs: number } | null,
    playheadMs: number = 0
  ): void {
    this.project.timeline.clips = clips
    this.project.timeline.playheadMs = playheadMs
    
    if (audio) {
      // 🔧 WAVE 2014.5: Never store blob: URLs - they're ephemeral
      const isRealPath = audio.path && !audio.path.startsWith('blob:')
      
      this.project.audio = {
        name: audio.name,
        path: isRealPath ? audio.path : '', // Empty if blob, will prompt on save
        bpm: audio.bpm,
        offsetMs: 0,
        durationMs: audio.durationMs,
      }
      this.project.meta.durationMs = audio.durationMs
    }
    
    // Check if dirty (compare serialized state)
    const currentJson = serializeProject(this.project)
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
      this.project.audio.path = path
      console.log(`[ChronosStore] 🎵 Audio path set: ${path}`)
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
      
      if (result.success && result.path) {
        // 🆔 WAVE 2014.5: PROJECT IDENTITY SYNC
        // Extract filename without extension and update project name
        const fileName = this.extractProjectName(result.path)
        if (fileName && fileName !== this.project.meta.name) {
          this.project.meta.name = fileName
          console.log(`[ChronosStore] 🆔 Project renamed to: "${fileName}"`)
        }
        
        // Update modified timestamp
        this.project.meta.modified = Date.now()
        
        // Re-serialize with updated name and save
        const finalJson = serializeProject(this.project)
        
        this.projectPath = result.path
        this.isDirty = false
        this.lastSavedJson = finalJson
        
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
    this.project.timeline.clips = clips
    // Don't mark dirty - this is from a load operation
  }
  
  /**
   * 🎵 WAVE 2014.5: Get stored audio info for restoration
   */
  getAudioInfo(): { path: string; bpm: number; durationMs: number } | null {
    if (!this.project.audio) return null
    return {
      path: this.project.audio.path,
      bpm: this.project.audio.bpm,
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
    if (!this.projectPath && this.project.timeline.clips.length === 0 && !this.project.audio) {
      return
    }
    
    this.isAutoSaving = true
    this.emit('auto-save-start')
    
    try {
      const json = serializeProject(this.project)
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
        const lastSaveTime = this.project.meta.modified || 0
        
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
        
        const project = deserializeProject(json)
        if (!project || !validateProject(project)) {
          return { success: false, error: 'Recovery data is corrupted' }
        }
        
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
        const project = deserializeProject(result.json)
        if (!project || !validateProject(project)) {
          return { success: false, error: 'Recovery data is corrupted' }
        }
        
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
