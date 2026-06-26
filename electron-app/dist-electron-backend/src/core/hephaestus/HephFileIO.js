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
import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { serializeHephClip, serializeHephClipV3 } from './types';
import { getHephaestusClipIndex } from './HephaestusClipIndex';
// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
const EFFECTS_FOLDER = 'effects';
const LFX_EXTENSION = '.lfx';
const SCHEMA_VERSION = 'hephaestus/v1';
const FORMAT_VERSION = '1.0.0';
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
    constructor() {
        this.effectsPath = null;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Get the effects folder path (userData/effects).
     * Creates the folder if it doesn't exist.
     */
    async getEffectsPath() {
        if (this.effectsPath)
            return this.effectsPath;
        const userDataPath = app.getPath('userData');
        this.effectsPath = path.join(userDataPath, EFFECTS_FOLDER);
        // Ensure folder exists
        await fs.mkdir(this.effectsPath, { recursive: true });
        console.log(`[HephFileIO] Effects folder: ${this.effectsPath}`);
        return this.effectsPath;
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
        await this.getEffectsPath();
        const isV3 = 'tracks' in clip && clip.schemaVersion === '3.0';
        let filePayload;
        if (isV3) {
            filePayload = {
                $schema: 'luxsync.lfx/3.0',
                version: '1.0.0',
                clip: serializeHephClipV3(clip),
                checksum: ''
            };
        }
        else {
            // Ruta legacy V2
            const serialized = serializeHephClip(clip);
            filePayload = {
                $schema: 'hephaestus/v2.1',
                version: '1.0.0',
                clip: serialized,
                checksum: ''
            };
        }
        const fileName = `${clip.id}.lfx`;
        const filePath = path.join(this.effectsPath, fileName);
        // Escribimos a disco
        await fs.writeFile(filePath, JSON.stringify(filePayload, null, 2), 'utf-8');
        // Actualizamos el índice en memoria O(1) inmediatamente
        const index = getHephaestusClipIndex();
        await index.upsert(filePath, 'user');
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
        const effectsPath = await this.getEffectsPath();
        let filePath = null;
        if (path.isAbsolute(idOrPath)) {
            filePath = idOrPath;
        }
        else {
            // Find by ID
            const files = await fs.readdir(effectsPath);
            const lfxFiles = files.filter(f => f.endsWith(LFX_EXTENSION));
            for (const file of lfxFiles) {
                const fullPath = path.join(effectsPath, file);
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
        const effectsPath = await this.getEffectsPath();
        const filename = this.sanitizeFilename(name) + LFX_EXTENSION;
        const filePath = path.join(effectsPath, filename);
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
