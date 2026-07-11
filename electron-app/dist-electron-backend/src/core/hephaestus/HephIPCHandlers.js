/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ HEPHAESTUS IPC HANDLERS - WAVE 2030.5
 * IPC bridge for FX automation clip persistence
 *
 * Channels:
 * - heph:save      - Save a clip to disk
 * - heph:load      - Load a clip by ID or path
 * - heph:list      - List all clips (metadata only)
 * - heph:delete    - Delete a clip
 * - heph:exists    - Check if clip name exists
 * - heph:getPath   - Get effects folder path
 *
 * @module core/hephaestus/HephIPCHandlers
 * @version WAVE 2030.5
 */
import { ipcMain } from 'electron';
import { hephFileIO } from './HephFileIO';
import { serializeHephClip } from './types';
import { LfxFileLoader } from '../arsenal/LfxFileLoader';
import { getDynamicEffectRegistry } from '../arsenal/DynamicEffectRegistry';
import { getHephaestusClipIndex } from './HephaestusClipIndex';
// ═══════════════════════════════════════════════════════════════════════════
// SETUP FUNCTION
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Register all Hephaestus-related IPC handlers.
 * Call this during app initialization.
 */
export function setupHephIPCHandlers() {
    // ═══════════════════════════════════════════════════════════════════════
    // SAVE
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Save a clip to disk.
     *
     * @param clipData - Serialized clip data (Record, not Map)
     * @returns { success, filePath, error }
     */
    // ⚒️ WAVE 7034: Shared LfxFileLoader instance for hot-registration
    const _lfxLoader = new LfxFileLoader(getDynamicEffectRegistry());
    ipcMain.handle('heph:save', async (_event, clipData) => {
        console.log('[HephIPC] Save clip:', clipData.name);
        try {
            const filePath = await hephFileIO.saveClip(clipData);
            // ⚒️ WAVE 7034: Hot-register in DynamicEffectRegistry so Selene IA
            // can see the clip immediately without requiring a restart.
            // If the clip has no cognitiveDNA, registerEffectV3 returns null
            // silently (by design) — Hephaestus-only clips stay invisible to Selene.
            const registered = await _lfxLoader.loadFile(filePath, 'user');
            if (registered) {
                console.log(`[HephIPC] ⚡ Hot-registered "${clipData.name}" in arsenal for Selene`);
            }
            return {
                success: true,
                filePath,
                id: clipData.id,
            };
        }
        catch (error) {
            console.error('[HephIPC] Save failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // ═══════════════════════════════════════════════════════════════════════
    // LOAD
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Load a clip by ID or file path.
     *
     * @param idOrPath - Clip ID or full file path
     * @returns { success, clip, error }
     */
    ipcMain.handle('heph:load', async (_event, idOrPath) => {
        console.log('[HephIPC] Load clip:', idOrPath);
        try {
            const clip = await hephFileIO.loadClip(idOrPath);
            // Serialize for IPC transport (deep clone)
            const serialized = serializeHephClip(clip);
            return {
                success: true,
                clip: serialized,
            };
        }
        catch (error) {
            console.error('[HephIPC] Load failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // ═══════════════════════════════════════════════════════════════════════
    // LIST
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * List all available clips (metadata only).
     *
     * @returns { success, clips, error }
     */
    ipcMain.handle('heph:list', async () => {
        console.log('[HephIPC] List clips');
        try {
            const clips = await hephFileIO.listClips();
            return {
                success: true,
                clips,
            };
        }
        catch (error) {
            console.error('[HephIPC] List failed:', error);
            return {
                success: false,
                clips: [],
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // ═══════════════════════════════════════════════════════════════════════
    // DELETE
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Delete a clip by ID or file path.
     *
     * @param idOrPath - Clip ID or full file path
     * @returns { success, deleted, error }
     */
    ipcMain.handle('heph:delete', async (_event, idOrPath) => {
        console.log('[HephIPC] Delete clip:', idOrPath);
        try {
            // Resolve the clip ID before deleting (needed for arsenal unregister)
            const index = getHephaestusClipIndex();
            let clipId;
            if (idOrPath.includes('/') || idOrPath.includes('\\')) {
                clipId = index.getByPath(idOrPath)?.id;
            }
            else {
                clipId = idOrPath;
            }
            const deleted = await hephFileIO.deleteClip(idOrPath);
            // ⚒️ WAVE 7034: Unregister from DynamicEffectRegistry so Selene
            // stops seeing the deleted clip immediately.
            if (deleted && clipId) {
                getDynamicEffectRegistry().unregisterEffect(clipId);
                console.log(`[HephIPC] 🗑️ Unregistered "${clipId}" from arsenal`);
            }
            return {
                success: true,
                deleted,
            };
        }
        catch (error) {
            console.error('[HephIPC] Delete failed:', error);
            return {
                success: false,
                deleted: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // ═══════════════════════════════════════════════════════════════════════
    // EXISTS
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Check if a clip with given name already exists.
     *
     * @param name - Clip name
     * @returns { success, exists }
     */
    ipcMain.handle('heph:exists', async (_event, name) => {
        console.log('[HephIPC] Check exists:', name);
        try {
            const exists = await hephFileIO.clipExists(name);
            return {
                success: true,
                exists,
            };
        }
        catch (error) {
            console.error('[HephIPC] Exists check failed:', error);
            return {
                success: false,
                exists: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // ═══════════════════════════════════════════════════════════════════════
    // GET PATH
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Get the effects folder path.
     *
     * @returns { success, path }
     */
    ipcMain.handle('heph:getPath', async () => {
        console.log('[HephIPC] Get arsenal path');
        try {
            const arsenalPath = await hephFileIO.getArsenalPath();
            return {
                success: true,
                path: arsenalPath,
            };
        }
        catch (error) {
            console.error('[HephIPC] Get path failed:', error);
            return {
                success: false,
                path: null,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // ═══════════════════════════════════════════════════════════════════════
    // GENERATE ID
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Generate a unique clip ID.
     *
     * @returns { id }
     */
    ipcMain.handle('heph:generateId', async () => {
        return {
            id: hephFileIO.generateId(),
        };
    });
    // WAVE 2098: Boot silence
}
export default setupHephIPCHandlers;
