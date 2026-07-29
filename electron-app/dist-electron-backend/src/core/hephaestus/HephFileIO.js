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
import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
// HephAutomationClip is now an alias for HephAutomationClipV3
import { serializeHephClip } from './types';
import { getHephaestusClipIndex } from './HephaestusClipIndex';
// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
const ARSENAL_FOLDER = 'arsenal';
const LFX_EXTENSION = '.lfx';
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
    constructor() {
        this.arsenalPath = null;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Get the arsenal folder path (userData/arsenal).
     * Creates the folder if it doesn't exist.
     */
    async getArsenalPath() {
        if (this.arsenalPath)
            return this.arsenalPath;
        const userDataPath = app.getPath('userData');
        this.arsenalPath = path.join(userDataPath, ARSENAL_FOLDER);
        // Ensure folder exists
        await fs.mkdir(this.arsenalPath, { recursive: true });
        // Arsenal folder log silenced
        return this.arsenalPath;
    }
    /**
     * Generate a unique ID for a new clip.
     * Format: heph-{timestamp}-{random4}
     */
    generateId() {
        const timestamp = Date.now().toString(36);
        const random = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
        return `heph-${timestamp}-${random}`;
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
    async saveClip(clip) {
        await this.getArsenalPath();
        // ── Auto-generate safetyDeclaration if missing ──────────────────────
        // G6 requires a declaration when strobe tracks are present.
        // If the author didn't set one, infer it from the track structure.
        if (!clip.safetyDeclaration) {
            const hasStrobeTrack = clip.tracks.some(t => t.paramId === 'strobe');
            const isStrobe = clip.simulationMeta?.isStrobe ?? false;
            if (hasStrobeTrack || isStrobe) {
                const autoDecl = Object.freeze({
                    maxStrobeFreqHz: 25,
                    containsRapidFlash: true,
                    communityTrusted: false,
                });
                clip = { ...clip, safetyDeclaration: autoDecl };
            }
        }
        const serializedClip = serializeHephClip(clip);
        const canonical = JSON.stringify(serializedClip);
        const hash = crypto.createHash('sha256').update(canonical).digest('hex');
        const filePayload = {
            $schema: 'luxsync.lfx/3.0',
            clip: serializedClip,
            checksum: `sha256:${hash}`
        };
        // Single source of truth: always save to userData/arsenal/
        const fileName = `${clip.id}.lfx`;
        const filePath = path.join(this.arsenalPath, fileName);
        const fileSource = 'user';
        // Escribimos a disco
        await fs.writeFile(filePath, JSON.stringify(filePayload, null, 2), 'utf-8');
        // Actualizamos el índice en memoria O(1) inmediatamente
        const index = getHephaestusClipIndex();
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
    async loadClip(idOrPath) {
        const index = getHephaestusClipIndex();
        // Soporta búsqueda por ID o por Path absoluto
        const isAbsolute = idOrPath.includes('/') || idOrPath.includes('\\');
        const loaded = isAbsolute ? index.getByPath(idOrPath) : index.getById(idOrPath);
        if (!loaded) {
            throw new Error(`[HephFileIO] Clip no encontrado en el índice: ${idOrPath}`);
        }
        return loaded.clip;
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
    async listClips() {
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
     * @param idOrPath - Clip ID or full file path
     * @returns true if deleted, false if not found
     */
    async deleteClip(idOrPath) {
        const arsenalPath = await this.getArsenalPath();
        let filePath = null;
        if (path.isAbsolute(idOrPath)) {
            filePath = idOrPath;
        }
        else {
            // Find by ID
            const files = await fs.readdir(arsenalPath);
            const lfxFiles = files.filter(f => f.endsWith(LFX_EXTENSION));
            for (const file of lfxFiles) {
                const fullPath = path.join(arsenalPath, file);
                try {
                    const content = await fs.readFile(fullPath, 'utf-8');
                    const lfx = JSON.parse(content);
                    if (lfx.clip.id === idOrPath) {
                        filePath = fullPath;
                        break;
                    }
                }
                catch {
                    // Skip corrupted files
                }
            }
        }
        if (!filePath) {
            console.warn(`[HephFileIO] Clip not found for deletion: ${idOrPath}`);
            return false;
        }
        await fs.unlink(filePath);
        console.log(`[HephFileIO] Deleted clip: ${filePath}`);
        // Remove from in-memory index so heph:list stops returning it
        const index = getHephaestusClipIndex();
        if (path.isAbsolute(idOrPath)) {
            const loaded = index.getByPath(idOrPath);
            if (loaded)
                index.remove(loaded.id);
        }
        else {
            index.remove(idOrPath);
        }
        return true;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // UTILITIES
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Sanitize a string for use as a filename.
     * Removes/replaces invalid filesystem characters.
     */
    sanitizeFilename(name) {
        return name
            .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid chars
            .replace(/\s+/g, '-') // Spaces to hyphens
            .replace(/-+/g, '-') // Collapse multiple hyphens
            .replace(/^-|-$/g, '') // Trim leading/trailing hyphens
            .toLowerCase()
            .slice(0, 50) // Limit length
            || 'untitled'; // Fallback
    }
    /**
     * Check if a clip with given name already exists.
     */
    async clipExists(name) {
        const arsenalPath = await this.getArsenalPath();
        const filename = this.sanitizeFilename(name) + LFX_EXTENSION;
        const filePath = path.join(arsenalPath, filename);
        try {
            await fs.access(filePath);
            return true;
        }
        catch {
            return false;
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
export const hephFileIO = new HephFileIO();
export default hephFileIO;
