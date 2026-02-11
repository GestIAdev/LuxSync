/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ HEPHAESTUS FILE I/O - WAVE 2030.5
 * Persistence layer for .lfx (LuxSync FX) automation clips
 * 
 * Storage: userData/effects/*.lfx
 * Format: JSON (HephAutomationClipSerialized)
 * 
 * The .lfx format is a JSON file containing:
 * - $schema: 'hephaestus/v1' (for future migration)
 * - version: '1.0.0'
 * - clip: HephAutomationClipSerialized
 * - checksum: SHA-256 hash for integrity
 * 
 * @module core/hephaestus/HephFileIO
 * @version WAVE 2030.5
 */

import { app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as crypto from 'crypto'
import type { 
  HephAutomationClip, 
  HephAutomationClipSerialized 
} from './types'
import { serializeHephClip, deserializeHephClip } from './types'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const EFFECTS_FOLDER = 'effects'
const LFX_EXTENSION = '.lfx'
const SCHEMA_VERSION = 'hephaestus/v1'
const FORMAT_VERSION = '1.0.0'

// ═══════════════════════════════════════════════════════════════════════════
// LFX FILE FORMAT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The .lfx file format - JSON structure for persistent storage.
 */
interface LFXFile {
  /** Schema identifier for future migration */
  $schema: typeof SCHEMA_VERSION
  
  /** Format version */
  version: typeof FORMAT_VERSION
  
  /** The serialized clip data */
  clip: HephAutomationClipSerialized
  
  /** SHA-256 checksum of the clip JSON for integrity */
  checksum: string
}

/**
 * Metadata returned when listing clips (without loading full content).
 */
export interface HephClipMetadata {
  /** Unique clip ID */
  id: string
  
  /** Display name */
  name: string
  
  /** Author */
  author: string
  
  /** Effect category */
  category: string
  
  /** Tags for filtering */
  tags: string[]
  
  /** Duration in ms */
  durationMs: number
  
  /** Base effect type */
  effectType: string
  
  /** Number of automated parameters */
  paramCount: number
  
  /** Full path to file */
  filePath: string
  
  /** Last modified timestamp */
  modifiedAt: number
}

// ═══════════════════════════════════════════════════════════════════════════
// HEPH FILE IO CLASS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚒️ HEPHAESTUS FILE I/O
 * 
 * Manages persistence of HephAutomationClips to the filesystem.
 * All clips are stored in userData/effects/ as .lfx files.
 * 
 * RESPONSIBILITIES:
 * - Save clips to disk (with checksum)
 * - Load clips from disk (with integrity verification)
 * - List all available clips (metadata only)
 * - Delete clips
 * - Generate unique IDs for new clips
 */
class HephFileIO {
  private effectsPath: string | null = null
  
  // ═══════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Get the effects folder path (userData/effects).
   * Creates the folder if it doesn't exist.
   */
  async getEffectsPath(): Promise<string> {
    if (this.effectsPath) return this.effectsPath
    
    const userDataPath = app.getPath('userData')
    this.effectsPath = path.join(userDataPath, EFFECTS_FOLDER)
    
    // Ensure folder exists
    await fs.mkdir(this.effectsPath, { recursive: true })
    
    console.log(`[HephFileIO] Effects folder: ${this.effectsPath}`)
    return this.effectsPath
  }
  
  /**
   * Generate a unique ID for a new clip.
   * Format: heph-{timestamp}-{random4}
   */
  generateId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0')
    return `heph-${timestamp}-${random}`
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // SAVE
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Save a HephAutomationClip to disk.
   * 
   * @param clip - The clip to save
   * @returns The file path where the clip was saved
   * @throws Error if serialization or write fails
   */
  async saveClip(clip: HephAutomationClip): Promise<string> {
    const effectsPath = await this.getEffectsPath()
    
    // Ensure clip has an ID
    const clipId = clip.id || this.generateId()
    const clipWithId = { ...clip, id: clipId }
    
    // Serialize the clip (Map → Record)
    const serialized = serializeHephClip(clipWithId)
    
    // Generate checksum for integrity
    const clipJson = JSON.stringify(serialized)
    const checksum = crypto.createHash('sha256').update(clipJson).digest('hex')
    
    // Build the LFX file
    const lfxFile: LFXFile = {
      $schema: SCHEMA_VERSION,
      version: FORMAT_VERSION,
      clip: serialized,
      checksum,
    }
    
    // Write to disk
    const filename = this.sanitizeFilename(clipWithId.name) + LFX_EXTENSION
    const filePath = path.join(effectsPath, filename)
    
    await fs.writeFile(filePath, JSON.stringify(lfxFile, null, 2), 'utf-8')
    
    console.log(`[HephFileIO] Saved clip "${clipWithId.name}" to ${filePath}`)
    return filePath
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // LOAD
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Load a HephAutomationClip from disk by ID or file path.
   * 
   * @param idOrPath - Clip ID or full file path
   * @returns The loaded clip
   * @throws Error if file not found or corrupted
   */
  async loadClip(idOrPath: string): Promise<HephAutomationClip> {
    const effectsPath = await this.getEffectsPath()
    
    // Determine file path
    let filePath: string
    if (path.isAbsolute(idOrPath)) {
      filePath = idOrPath
    } else {
      // Search by ID in all .lfx files
      const files = await fs.readdir(effectsPath)
      const lfxFiles = files.filter(f => f.endsWith(LFX_EXTENSION))
      
      for (const file of lfxFiles) {
        const fullPath = path.join(effectsPath, file)
        const content = await fs.readFile(fullPath, 'utf-8')
        const lfx: LFXFile = JSON.parse(content)
        if (lfx.clip.id === idOrPath) {
          filePath = fullPath
          break
        }
      }
      
      if (!filePath!) {
        throw new Error(`Clip not found: ${idOrPath}`)
      }
    }
    
    // Read file
    const content = await fs.readFile(filePath, 'utf-8')
    const lfxFile: LFXFile = JSON.parse(content)
    
    // Verify checksum
    const clipJson = JSON.stringify(lfxFile.clip)
    const computedChecksum = crypto.createHash('sha256').update(clipJson).digest('hex')
    
    if (computedChecksum !== lfxFile.checksum) {
      console.warn(`[HephFileIO] Checksum mismatch for ${filePath}. File may be corrupted.`)
      // Continue anyway - don't block user from their data
    }
    
    // Deserialize (Record → Map)
    const clip = deserializeHephClip(lfxFile.clip)
    
    console.log(`[HephFileIO] Loaded clip "${clip.name}" from ${filePath}`)
    return clip
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // LIST
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * List all available clips with metadata.
   * Does NOT load full curve data - only metadata for UI display.
   * 
   * @returns Array of clip metadata, sorted by modification date (newest first)
   */
  async listClips(): Promise<HephClipMetadata[]> {
    const effectsPath = await this.getEffectsPath()
    
    const files = await fs.readdir(effectsPath)
    const lfxFiles = files.filter(f => f.endsWith(LFX_EXTENSION))
    
    const metadataList: HephClipMetadata[] = []
    
    for (const file of lfxFiles) {
      const filePath = path.join(effectsPath, file)
      
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        const lfx: LFXFile = JSON.parse(content)
        const clip = lfx.clip
        
        const stats = await fs.stat(filePath)
        
        metadataList.push({
          id: clip.id,
          name: clip.name,
          author: clip.author,
          category: clip.category,
          tags: clip.tags,
          durationMs: clip.durationMs,
          effectType: clip.effectType,
          paramCount: Object.keys(clip.curves).length,
          filePath,
          modifiedAt: stats.mtimeMs,
        })
      } catch (error) {
        console.error(`[HephFileIO] Failed to read ${filePath}:`, error)
        // Skip corrupted files
      }
    }
    
    // Sort by modification date (newest first)
    metadataList.sort((a, b) => b.modifiedAt - a.modifiedAt)
    
    console.log(`[HephFileIO] Listed ${metadataList.length} clips`)
    return metadataList
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // DELETE
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Delete a clip from disk.
   * 
   * @param idOrPath - Clip ID or full file path
   * @returns true if deleted, false if not found
   */
  async deleteClip(idOrPath: string): Promise<boolean> {
    const effectsPath = await this.getEffectsPath()
    
    let filePath: string | null = null
    
    if (path.isAbsolute(idOrPath)) {
      filePath = idOrPath
    } else {
      // Find by ID
      const files = await fs.readdir(effectsPath)
      const lfxFiles = files.filter(f => f.endsWith(LFX_EXTENSION))
      
      for (const file of lfxFiles) {
        const fullPath = path.join(effectsPath, file)
        try {
          const content = await fs.readFile(fullPath, 'utf-8')
          const lfx: LFXFile = JSON.parse(content)
          if (lfx.clip.id === idOrPath) {
            filePath = fullPath
            break
          }
        } catch {
          // Skip corrupted files
        }
      }
    }
    
    if (!filePath) {
      console.warn(`[HephFileIO] Clip not found for deletion: ${idOrPath}`)
      return false
    }
    
    await fs.unlink(filePath)
    console.log(`[HephFileIO] Deleted clip: ${filePath}`)
    return true
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Sanitize a string for use as a filename.
   * Removes/replaces invalid filesystem characters.
   */
  private sanitizeFilename(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, '_')  // Replace invalid chars
      .replace(/\s+/g, '-')           // Spaces to hyphens
      .replace(/-+/g, '-')            // Collapse multiple hyphens
      .replace(/^-|-$/g, '')          // Trim leading/trailing hyphens
      .toLowerCase()
      .slice(0, 50)                   // Limit length
      || 'untitled'                   // Fallback
  }
  
  /**
   * Check if a clip with given name already exists.
   */
  async clipExists(name: string): Promise<boolean> {
    const effectsPath = await this.getEffectsPath()
    const filename = this.sanitizeFilename(name) + LFX_EXTENSION
    const filePath = path.join(effectsPath, filename)
    
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Singleton instance of HephFileIO.
 * Use this for all file operations.
 */
export const hephFileIO = new HephFileIO()

export default hephFileIO
