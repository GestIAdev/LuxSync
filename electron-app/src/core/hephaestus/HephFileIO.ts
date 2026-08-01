/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ HEPHAESTUS FILE I/O - WAVE 2030.5
 * Persistence layer for .lfx (LuxSync FX) automation clips
 * 
 * Storage: userData/arsenal/*.lfx
 * Format: JSON (HephAutomationClipV3)
 * 
 * The .lfx format is a JSON file containing:
 * - $schema: 'luxsync.lfx/3.0'
 * - clip: HephAutomationClipV3
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
  HephAutomationClipV3,
} from './types'
import type { SafetyDeclaration } from '../arsenal/lfxTypes'
// HephAutomationClip is now an alias for HephAutomationClipV3
import { serializeHephClip } from './types'
import { getHephaestusClipIndex } from './HephaestusClipIndex'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const ARSENAL_FOLDER = 'arsenal'
const LFX_EXTENSION = '.lfx'

// ═══════════════════════════════════════════════════════════════════════════
// LFX FILE FORMAT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The .lfx file format - JSON structure for persistent storage.
 */
interface LFXFile {
  /** Schema identifier */
  $schema: 'luxsync.lfx/3.0'

  /** The serialized clip data */
  clip: HephAutomationClipV3

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
  
  /** Vibe compatibility — vibes this clip is designed for (e.g. 'techno-club', 'chill-lounge') */
  vibeCompat: string[]
  
  /** True if this clip is a factory builtin (copied from builtins/ at boot). Builtin clips are undeletable. */
  isBuiltin: boolean
  
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
 * All clips are stored in userData/arsenal/ as .lfx files.
 * 
 * RESPONSIBILITIES:
 * - Save clips to disk (with checksum)
 * - Load clips from disk (with integrity verification)
 * - List all available clips (metadata only)
 * - Delete clips
 * - Generate unique IDs for new clips
 */
class HephFileIO {
  private arsenalPath: string | null = null

  // ═══════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Get the arsenal folder path (userData/arsenal).
   * Creates the folder if it doesn't exist.
   */
  async getArsenalPath(): Promise<string> {
    if (this.arsenalPath) return this.arsenalPath
    
    const userDataPath = app.getPath('userData')
    this.arsenalPath = path.join(userDataPath, ARSENAL_FOLDER)
    
    // Ensure folder exists
    await fs.mkdir(this.arsenalPath, { recursive: true })
    
    // Arsenal folder log silenced
    return this.arsenalPath
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
  async saveClip(clip: HephAutomationClipV3): Promise<string> {
    await this.getArsenalPath()

    // ── Auto-generate safetyDeclaration if missing ──────────────────────
    // G6 requires a declaration when strobe tracks are present.
    // If the author didn't set one, infer it from the track structure.
    if (!clip.safetyDeclaration) {
      const hasStrobeTrack = clip.tracks.some(t => t.paramId === 'strobe')
      const isStrobe = clip.simulationMeta?.isStrobe ?? false
      if (hasStrobeTrack || isStrobe) {
        const autoDecl: SafetyDeclaration = Object.freeze({
          maxStrobeFreqHz: 25,
          containsRapidFlash: true,
          communityTrusted: false,
        })
        clip = { ...clip, safetyDeclaration: autoDecl }
      }
    }

    const serializedClip = serializeHephClip(clip)
    const canonical = JSON.stringify(serializedClip)
    const hash = crypto.createHash('sha256').update(canonical).digest('hex')

    const filePayload = {
      $schema: 'luxsync.lfx/3.0',
      clip: serializedClip,
      checksum: `sha256:${hash}`
    };

    // Single source of truth: always save to userData/arsenal/
    // WAVE 2525: Preserve subfolder structure — if the clip was loaded from
    // a subfolder (e.g. arsenal/latin/salsa_fire.lfx), save back to that same
    // subfolder instead of dumping to the root. This prevents duplicate .lfx
    // files with the same clip ID in different folders.
    const fileName = `${clip.id}.lfx`
    const index = getHephaestusClipIndex();
    // Look up the existing entry by clip ID to find its current subfolder
    const existingMeta = index.getById(clip.id)
    let targetDir = this.arsenalPath!
    if (existingMeta) {
      // Extract the subfolder from the existing file path
      const existingDir = path.dirname(existingMeta.filePath)
      const relativeDir = path.relative(this.arsenalPath!, existingDir)
      // Only preserve if it's a real subfolder (not '.' or outside arsenal)
      if (relativeDir && relativeDir !== '.' && !relativeDir.startsWith('..')) {
        targetDir = path.join(this.arsenalPath!, relativeDir)
        // Ensure the subfolder exists
        await fs.mkdir(targetDir, { recursive: true })
      }
    }
    const filePath = path.join(targetDir, fileName)
    const fileSource: 'builtin' | 'user' = 'user'

    // If the clip was previously at a DIFFERENT path (e.g. root-level duplicate),
    // delete the old file to avoid leaving stale duplicates behind.
    if (existingMeta && existingMeta.filePath !== filePath) {
      try {
        await fs.unlink(existingMeta.filePath)
      } catch { /* file may not exist — ignore */ }
    }

    // Escribimos a disco
    await fs.writeFile(filePath, JSON.stringify(filePayload, null, 2), 'utf-8');

    // Actualizamos el índice en memoria O(1) inmediatamente
    await index.upsert(filePath, fileSource);

    return filePath;
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
  async loadClip(idOrPath: string): Promise<HephAutomationClipV3> {
    const index = getHephaestusClipIndex();
    // Soporta búsqueda por ID o por Path absoluto
    const isAbsolute = idOrPath.includes('/') || idOrPath.includes('\\');
    const loaded = isAbsolute ? index.getByPath(idOrPath) : index.getById(idOrPath);

    if (!loaded) {
      throw new Error(`[HephFileIO] Clip no encontrado en el índice: ${idOrPath}`);
    }
    return loaded.clip as HephAutomationClipV3;
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
    const index = getHephaestusClipIndex();
    // Devuelve la metadata directamente desde la memoria y la ordena por fecha
    return index.getAllMetadata().sort((a, b) => b.modifiedAt - a.modifiedAt);
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // DELETE
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Delete a clip from disk.
   * 
   * WAVE 2524: Builtin clips (factory effects copied from builtins/) are UNDELETABLE.
   * Only user-created clips in userData/arsenal/ can be deleted.
   * 
   * @param idOrPath - Clip ID or full file path
   * @returns true if deleted, false if not found or builtin (protected)
   */
  async deleteClip(idOrPath: string): Promise<boolean> {
    const arsenalPath = await this.getArsenalPath()
    
    let filePath: string | null = null
    
    if (path.isAbsolute(idOrPath)) {
      filePath = idOrPath
    } else {
      // Find by ID
      const files = await fs.readdir(arsenalPath)
      const lfxFiles = files.filter(f => f.endsWith(LFX_EXTENSION))
      
      for (const file of lfxFiles) {
        const fullPath = path.join(arsenalPath, file)
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

    // ── WAVE 2524: BUILTIN PROTECTION ──────────────────────────────────
    // Los clips builtin (factory effects) son archivos core del repo y
    // NO pueden borrarse. Solo se borran las copias locales del usuario.
    // Si el filename existe en la carpeta builtins/, es un clip factory.
    if (await this._isBuiltinFile(filePath)) {
      console.warn(`[HephFileIO] ❌ Cannot delete builtin clip: ${path.basename(filePath)}`)
      return false
    }
    
    await fs.unlink(filePath)
    console.log(`[HephFileIO] Deleted clip: ${filePath}`)

    // Remove from in-memory index so heph:list stops returning it
    const index = getHephaestusClipIndex()
    if (path.isAbsolute(idOrPath)) {
      const loaded = index.getByPath(idOrPath)
      if (loaded) index.remove(loaded.id)
    } else {
      index.remove(idOrPath)
    }

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
   * WAVE 2524: Resolve the builtins folder path.
   * Dev: __dirname/../src/core/arsenal/builtins
   * Packaged: process.resourcesPath/builtins
   */
  private _getBuiltinsPath(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'builtins')
    }
    // Dev mode — __dirname is dist-electron-backend/src/core/hephaestus
    // Walk up to find src/core/arsenal/builtins
    return path.join(__dirname, '..', 'arsenal', 'builtins')
  }

  /**
   * WAVE 2524: Check if a file in userData/arsenal/ is a builtin clip.
   * Recursively scans the builtins folder for a matching filename.
   * If the filename exists anywhere in builtins/, the clip is factory and undeletable.
   */
  async _isBuiltinFile(filePath: string): Promise<boolean> {
    const basename = path.basename(filePath).toLowerCase()
    if (!basename.endsWith(LFX_EXTENSION)) return false

    const builtinsPath = this._getBuiltinsPath()
    try {
      await fs.access(builtinsPath)
    } catch {
      return false // No builtins folder — nothing to protect
    }

    // Recursively scan builtins/ for a matching filename
    return this._scanForBuiltin(builtinsPath, basename)
  }

  /**
   * Recursive scan helper for _isBuiltinFile.
   */
  private async _scanForBuiltin(dir: string, basename: string): Promise<boolean> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          if (await this._scanForBuiltin(fullPath, basename)) return true
        } else if (entry.name.toLowerCase() === basename) {
          return true
        }
      }
    } catch {
      // Scan error — assume not builtin (fail open for user clips)
    }
    return false
  }
  
  /**
   * Check if a clip with given name already exists.
   */
  async clipExists(name: string): Promise<boolean> {
    const arsenalPath = await this.getArsenalPath()
    const filename = this.sanitizeFilename(name) + LFX_EXTENSION
    const filePath = path.join(arsenalPath, filename)
    
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
