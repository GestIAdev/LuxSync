/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔌 STAGE PERSISTENCE API - WAVE 365 Phase 5
 * "El Puente Backend - Conectando el Cerebro al Disco Duro"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este módulo maneja toda la persistencia del Stage Constructor:
 * - Guardar shows (.luxshow)
 * - Cargar shows con validación
 * - Auto-migración de formatos legacy
 * - Historial de shows recientes
 * 
 * AXIOMAS RESPETADOS:
 * - Escritura atómica (write to temp, rename)
 * - Validación estricta contra Schema V2
 * - Migración transparente desde V1
 * - CERO Math.random() para IDs
 * 
 * @module core/stage/StagePersistence
 * @version 365.0.0
 */

import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import {
  ShowFileV2,
  validateShowFile,
  validateShowFileDeep,
  getSchemaVersion,
  createEmptyShowFile,
  normalizeZone
} from './ShowFileV2'
import { autoMigrate, migrateV2ToLatest, type MigrationResult } from './ShowFileMigrator'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ShowMetadataV2 {
  /** Filename (without path) */
  filename: string
  /** Full path to file */
  fullPath: string
  /** Show name */
  name: string
  /** Show description */
  description: string
  /** Creation date */
  createdAt: string
  /** Last modified date */
  modifiedAt: string
  /** File size in bytes */
  sizeBytes: number
  /** Number of fixtures */
  fixtureCount: number
  /** Number of groups */
  groupCount: number
  /** Number of scenes */
  sceneCount: number
  /** Schema version */
  schemaVersion: string
}

export interface SaveResult {
  success: boolean
  path?: string
  error?: string
}

export interface LoadResult {
  success: boolean
  showFile?: ShowFileV2
  migrated?: boolean
  warnings?: string[]
  error?: string
}

export interface ListResult {
  success: boolean
  shows: ShowMetadataV2[]
  showsPath: string
  error?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const SHOW_EXTENSION = '.luxshow'
const LEGACY_CONFIG_NAME = 'luxsync-config.json'
const ACTIVE_SHOW_NAME = 'current-show.v2.luxshow'
const RECENT_SHOWS_FILE = 'recent-shows.json'
const MAX_RECENT_SHOWS = 10

// ═══════════════════════════════════════════════════════════════════════════
// STAGE PERSISTENCE CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class StagePersistence {
  private userDataPath: string
  private showsPath: string
  private initialized: boolean = false
  private recentShows: string[] = []

  constructor() {
    this.userDataPath = app.getPath('userData')
    this.showsPath = path.join(this.userDataPath, 'shows')
  }

  /**
   * Initialize the persistence layer
   * Creates necessary directories and loads recent shows
   */
  async init(): Promise<void> {
    if (this.initialized) return

    // Ensure shows directory exists
    if (!fs.existsSync(this.showsPath)) {
      fs.mkdirSync(this.showsPath, { recursive: true })
    }

    // Load recent shows list
    this.loadRecentShowsList()

    this.initialized = true
  }

  /**
   * Get path to the "current active" show file
   */
  getActiveShowPath(): string {
    return path.join(this.showsPath, ACTIVE_SHOW_NAME)
  }

  /**
   * Get path to legacy config file
   */
  getLegacyConfigPath(): string {
    return path.join(this.userDataPath, LEGACY_CONFIG_NAME)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SAVE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Save a ShowFile to disk (atomic write with backup)
   * 
   * 🛡️ WAVE 2093.2 (CW-AUDIT-2 & CW-AUDIT-8): PARANOIA MODE
   * 
   * STEP 0: Deep-validate the showFile BEFORE touching disk.
   *         If hard errors exist → ABORT. No corrupt data hits disk.
   * STEP 1: If target file exists, rename to .bak (safety net)
   * STEP 2: Write to .tmp file
   * STEP 3: Rename .tmp to target (atomic on most filesystems)
   * STEP 4: Delete .bak ONLY after successful write
   * 
   * If STEP 2 or 3 fails, .bak survives → manual recovery possible.
   */
  async saveShow(showFile: ShowFileV2, filePath?: string): Promise<SaveResult> {
    try {
      // ══════════════════════════════════════════════════════════════════
      // STEP 0: DEEP VALIDATION GATE — NO CORRUPT DATA HITS DISK
      // ══════════════════════════════════════════════════════════════════
      const validation = validateShowFileDeep(showFile)
      
      if (!validation.valid) {
        const errorSummary = validation.errors.join('; ')
        console.error(`[StagePersistence] 🚨 SAVE BLOCKED — Deep validation failed (${validation.errors.length} errors):`)
        validation.errors.forEach(e => console.error(`  ✗ ${e}`))
        return { 
          success: false, 
          error: `Validation failed: ${errorSummary}` 
        }
      }
      
      // Log warnings (non-fatal but auditable)
      if (validation.warnings.length > 0) {
        console.warn(`[StagePersistence] ⚠️ Save proceeding with ${validation.warnings.length} warning(s):`)
        validation.warnings.forEach(w => console.warn(`  → ${w}`))
      }

      // Update modification timestamp
      showFile.modifiedAt = new Date().toISOString()

      // Determine target path
      const targetPath = filePath || this.getActiveShowPath()
      const tempPath = targetPath + '.tmp'
      const backupPath = targetPath + '.bak'

      // ══════════════════════════════════════════════════════════════════
      // STEP 1: CREATE BACKUP — Rename existing file to .bak
      // ══════════════════════════════════════════════════════════════════
      let backupCreated = false
      
      if (fs.existsSync(targetPath)) {
        try {
          // Remove stale .bak if it exists from a previous interrupted save
          if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath)
          }
          fs.renameSync(targetPath, backupPath)
          backupCreated = true
          console.log(`[StagePersistence] 🛡️ Backup created: ${backupPath}`)
        } catch (backupErr) {
          // If we can't create backup, proceed anyway — better to save than lose data
          console.warn(`[StagePersistence] ⚠️ Could not create backup: ${backupErr}`)
        }
      }

      // ══════════════════════════════════════════════════════════════════
      // STEP 2: WRITE TO TEMP FILE
      // ══════════════════════════════════════════════════════════════════
      const content = JSON.stringify(showFile, null, 2)
      
      try {
        fs.writeFileSync(tempPath, content, 'utf-8')
      } catch (writeErr) {
        // Write failed — restore backup if we made one
        if (backupCreated && fs.existsSync(backupPath)) {
          try {
            fs.renameSync(backupPath, targetPath)
            console.log(`[StagePersistence] 🔄 Backup restored after write failure`)
          } catch (restoreErr) {
            console.error(`[StagePersistence] 💀 CRITICAL: Write failed AND backup restore failed: ${restoreErr}`)
          }
        }
        throw writeErr
      }

      // ══════════════════════════════════════════════════════════════════
      // STEP 3: ATOMIC RENAME — .tmp → target
      // ══════════════════════════════════════════════════════════════════
      try {
        fs.renameSync(tempPath, targetPath)
      } catch (renameErr) {
        // Rename failed — restore backup, clean up temp
        if (backupCreated && fs.existsSync(backupPath)) {
          try {
            fs.renameSync(backupPath, targetPath)
            console.log(`[StagePersistence] 🔄 Backup restored after rename failure`)
          } catch (restoreErr) {
            console.error(`[StagePersistence] 💀 CRITICAL: Rename failed AND backup restore failed: ${restoreErr}`)
          }
        }
        // Clean orphan temp file
        if (fs.existsSync(tempPath)) {
          try { fs.unlinkSync(tempPath) } catch { /* best effort */ }
        }
        throw renameErr
      }

      // ══════════════════════════════════════════════════════════════════
      // STEP 4: CLEAN UP BACKUP — Only after successful write+rename
      // ══════════════════════════════════════════════════════════════════
      if (backupCreated && fs.existsSync(backupPath)) {
        try {
          fs.unlinkSync(backupPath)
        } catch {
          // Non-fatal — backup file lingering is better than crashing
          console.warn(`[StagePersistence] ⚠️ Could not clean up backup: ${backupPath}`)
        }
      }

      // Update recent shows list
      this.addToRecentShows(targetPath)

      console.log(`[StagePersistence] 💾 Saved show: ${showFile.name} → ${targetPath}`)
      return { success: true, path: targetPath }

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error('[StagePersistence] ❌ Save failed:', msg)
      return { success: false, error: msg }
    }
  }

  /**
   * Save show with a new name (Save As...)
   */
  async saveShowAs(showFile: ShowFileV2, name: string): Promise<SaveResult> {
    // Sanitize filename
    const sanitized = name.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim()
    if (!sanitized) {
      return { success: false, error: 'Invalid show name' }
    }

    // Update show name
    showFile.name = name
    showFile.modifiedAt = new Date().toISOString()

    // Generate filename
    const filename = sanitized.replace(/\s+/g, '-').toLowerCase() + SHOW_EXTENSION
    const filePath = path.join(this.showsPath, filename)

    return this.saveShow(showFile, filePath)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LOAD OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Load a show file from disk with automatic migration
   */
  async loadShow(filePath?: string): Promise<LoadResult> {
    try {
      const targetPath = filePath || this.getActiveShowPath()

      // Check if file exists
      if (!fs.existsSync(targetPath)) {
        // If loading active show and it doesn't exist, try legacy migration
        if (!filePath || targetPath === this.getActiveShowPath()) {
          return this.tryLegacyMigration()
        }
        return { success: false, error: `File not found: ${targetPath}` }
      }

      // Read file
      const content = fs.readFileSync(targetPath, 'utf-8')
      const data = JSON.parse(content)

      // Check schema version
      const version = getSchemaVersion(data)
      
      if (version === '2.0.0') {
        // Already V2, validate and return
        if (validateShowFile(data)) {
          const showFile = data as ShowFileV2
          
          // �️ WAVE 2093.3 (CW-10): Run through V2 incremental migration
          const { show: patchedShow, appliedPatches } = migrateV2ToLatest(showFile)
          if (appliedPatches.length > 0) {
            console.log(`[StagePersistence] 🔄 V2 incremental migration: ${appliedPatches.length} patches applied`)
          }
          
          // �🔥 WAVE 2040.24 FASE 6: Normalizar zonas legacy en archivos V2 existentes
          // Un .luxshow puede tener 'FRONT_PARS', 'stage-left', etc.
          // Los normalizamos a canonical ('front', 'movers-left', etc.) transparentemente.
          let zonesNormalized = 0
          for (const fixture of patchedShow.fixtures) {
            const canonical = normalizeZone(fixture.zone)
            if (fixture.zone !== canonical) {
              console.log(`[StagePersistence] 🔄 Zone normalized: "${fixture.zone}" → "${canonical}" (fixture: ${fixture.id})`)
              fixture.zone = canonical
              zonesNormalized++
            }
          }
          if (zonesNormalized > 0 || appliedPatches.length > 0) {
            console.log(`[StagePersistence] ✅ Normalized ${zonesNormalized} fixture zones to canonical`)
            // Auto-save con zonas normalizadas y/o patches aplicados
            patchedShow.modifiedAt = new Date().toISOString()
            const targetSavePath = filePath || this.getActiveShowPath()
            fs.writeFileSync(targetSavePath, JSON.stringify(patchedShow, null, 2), 'utf-8')
            console.log(`[StagePersistence] 💾 Auto-saved with normalized zones`)
          }
          
          this.addToRecentShows(targetPath)
          console.log(`[StagePersistence] 📂 Loaded V2 show: ${patchedShow.name}`)
          return { success: true, showFile: patchedShow, migrated: appliedPatches.length > 0 }
        } else {
          return { success: false, error: 'Show file validation failed' }
        }
      } else if (version === '1.0.0') {
        // Legacy V1, migrate
        console.log('[StagePersistence] 🔄 Legacy V1 file detected, migrating...')
        return this.migrateAndLoad(data, targetPath)
      } else {
        return { success: false, error: `Unknown schema version: ${version}` }
      }

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error('[StagePersistence] ❌ Load failed:', msg)
      return { success: false, error: msg }
    }
  }

  /**
   * Try to migrate from legacy luxsync-config.json
   */
  private async tryLegacyMigration(): Promise<LoadResult> {
    const legacyPath = this.getLegacyConfigPath()

    if (!fs.existsSync(legacyPath)) {
      // No legacy config, create new empty show
      console.log('[StagePersistence] 🆕 No existing show found, creating new')
      const newShow = createEmptyShowFile('New Show')
      return { 
        success: true, 
        showFile: newShow, 
        migrated: false,
        warnings: ['Created new empty show']
      }
    }

    console.log('[StagePersistence] 🔄 Found legacy config, migrating...')
    
    try {
      const content = fs.readFileSync(legacyPath, 'utf-8')
      const data = JSON.parse(content)
      return this.migrateAndLoad(data, legacyPath)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error('[StagePersistence] ❌ Legacy migration failed:', msg)
      
      // Fall back to new empty show
      const newShow = createEmptyShowFile('New Show')
      return { 
        success: true, 
        showFile: newShow, 
        migrated: false,
        warnings: [`Legacy migration failed: ${msg}`, 'Created new empty show']
      }
    }
  }

  /**
   * Migrate legacy data and save as V2
   */
  private async migrateAndLoad(legacyData: unknown, originalPath: string): Promise<LoadResult> {
    const result: MigrationResult = autoMigrate(legacyData)

    if (!result.success || !result.showFile) {
      return { 
        success: false, 
        error: `Migration failed: ${result.warnings.join(', ')}` 
      }
    }

    // Save migrated show as active
    const saveResult = await this.saveShow(result.showFile)
    
    if (!saveResult.success) {
      return { 
        success: false, 
        error: `Migration succeeded but save failed: ${saveResult.error}` 
      }
    }

    console.log(`[StagePersistence] ✅ Migration complete: ${result.showFile.fixtures.length} fixtures`)

    return {
      success: true,
      showFile: result.showFile,
      migrated: true,
      warnings: result.warnings
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LIST & METADATA
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * List all shows in the shows folder
   */
  async listShows(): Promise<ListResult> {
    try {
      const files = fs.readdirSync(this.showsPath)
      const shows: ShowMetadataV2[] = []

      for (const file of files) {
        if (!file.endsWith(SHOW_EXTENSION)) continue

        const fullPath = path.join(this.showsPath, file)
        const stats = fs.statSync(fullPath)

        try {
          const content = fs.readFileSync(fullPath, 'utf-8')
          const data = JSON.parse(content) as Partial<ShowFileV2>

          shows.push({
            filename: file,
            fullPath,
            name: data.name || file,
            description: data.description || '',
            createdAt: data.createdAt || stats.birthtime.toISOString(),
            modifiedAt: data.modifiedAt || stats.mtime.toISOString(),
            sizeBytes: stats.size,
            fixtureCount: data.fixtures?.length || 0,
            groupCount: data.groups?.length || 0,
            sceneCount: data.scenes?.length || 0,
            schemaVersion: data.schemaVersion || '1.0.0'
          })
        } catch {
          // Skip files that can't be parsed
          console.warn(`[StagePersistence] ⚠️ Could not parse: ${file}`)
        }
      }

      // Sort by modification date (newest first)
      shows.sort((a, b) => 
        new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
      )

      console.log(`[StagePersistence] 📋 Listed ${shows.length} shows`)
      return { success: true, shows, showsPath: this.showsPath }

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      return { success: false, shows: [], showsPath: this.showsPath, error: msg }
    }
  }

  /**
   * Delete a show file
   */
  async deleteShow(filePath: string): Promise<SaveResult> {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'File not found' }
      }

      // Don't allow deleting the active show
      if (filePath === this.getActiveShowPath()) {
        return { success: false, error: 'Cannot delete active show' }
      }

      fs.unlinkSync(filePath)
      this.removeFromRecentShows(filePath)

      console.log(`[StagePersistence] 🗑️ Deleted: ${filePath}`)
      return { success: true }

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      return { success: false, error: msg }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RECENT SHOWS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get list of recent shows
   */
  getRecentShows(): ShowMetadataV2[] {
    const result: ShowMetadataV2[] = []

    for (const showPath of this.recentShows) {
      if (!fs.existsSync(showPath)) continue

      try {
        const stats = fs.statSync(showPath)
        const content = fs.readFileSync(showPath, 'utf-8')
        const data = JSON.parse(content) as Partial<ShowFileV2>

        result.push({
          filename: path.basename(showPath),
          fullPath: showPath,
          name: data.name || path.basename(showPath),
          description: data.description || '',
          createdAt: data.createdAt || stats.birthtime.toISOString(),
          modifiedAt: data.modifiedAt || stats.mtime.toISOString(),
          sizeBytes: stats.size,
          fixtureCount: data.fixtures?.length || 0,
          groupCount: data.groups?.length || 0,
          sceneCount: data.scenes?.length || 0,
          schemaVersion: data.schemaVersion || '1.0.0'
        })
      } catch {
        // Skip invalid entries
      }
    }

    return result
  }

  private loadRecentShowsList(): void {
    const recentPath = path.join(this.userDataPath, RECENT_SHOWS_FILE)
    
    try {
      if (fs.existsSync(recentPath)) {
        const content = fs.readFileSync(recentPath, 'utf-8')
        this.recentShows = JSON.parse(content) || []
      }
    } catch {
      this.recentShows = []
    }
  }

  private saveRecentShowsList(): void {
    const recentPath = path.join(this.userDataPath, RECENT_SHOWS_FILE)
    
    try {
      fs.writeFileSync(recentPath, JSON.stringify(this.recentShows, null, 2), 'utf-8')
    } catch (error) {
      console.warn('[StagePersistence] ⚠️ Could not save recent shows list')
    }
  }

  private addToRecentShows(showPath: string): void {
    // Remove if already exists (will be re-added at top)
    this.recentShows = this.recentShows.filter(p => p !== showPath)
    
    // Add at beginning
    this.recentShows.unshift(showPath)
    
    // Limit size
    if (this.recentShows.length > MAX_RECENT_SHOWS) {
      this.recentShows = this.recentShows.slice(0, MAX_RECENT_SHOWS)
    }

    this.saveRecentShowsList()
  }

  private removeFromRecentShows(showPath: string): void {
    this.recentShows = this.recentShows.filter(p => p !== showPath)
    this.saveRecentShowsList()
  }

  // ═══════════════════════════════════════════════════════════════════════
  // UTILITY
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get the shows folder path
   */
  getShowsPath(): string {
    return this.showsPath
  }

  /**
   * Check if a show exists
   */
  showExists(name: string): boolean {
    const filename = name.replace(/\s+/g, '-').toLowerCase() + SHOW_EXTENSION
    return fs.existsSync(path.join(this.showsPath, filename))
  }
}

// Singleton export
export const stagePersistence = new StagePersistence()
