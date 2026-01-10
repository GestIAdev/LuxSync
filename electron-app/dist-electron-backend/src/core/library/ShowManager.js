/**
 * 🎭 SHOW MANAGER - Save/Load/Delete Shows
 * WAVE 26 Phase 4: The Library Vault
 *
 * Manages show files in /shows folder:
 * - Save: Serialize audio, dmx, fixtures config to JSON
 * - Load: Restore configuration from JSON
 * - Delete: Remove show file
 * - List: Enumerate all .json files
 */
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT SHOW
// ═══════════════════════════════════════════════════════════════════════════
const createDefaultShow = () => ({
    name: 'Default',
    description: 'Empty default show - Add fixtures and configure your setup',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    version: '1.0.0',
    audio: {
        source: 'simulation',
        sensitivity: 0.7,
        inputGain: 1.0,
    },
    dmx: {
        driver: 'virtual',
        port: '',
        universe: 1,
        frameRate: 40,
    },
    patchedFixtures: [],
    seleneMode: 'idle',
    installationType: 'ceiling',
});
// ═══════════════════════════════════════════════════════════════════════════
// SHOW MANAGER CLASS
// ═══════════════════════════════════════════════════════════════════════════
class ShowManager {
    constructor() {
        // Shows folder in userData (persistent across updates)
        const userDataPath = app.getPath('userData');
        this.showsPath = path.join(userDataPath, 'shows');
        this.ensureShowsFolder();
        console.log(`[ShowManager] 📁 Shows path: ${this.showsPath}`);
    }
    /**
     * 📁 Ensure the shows folder exists
     */
    ensureShowsFolder() {
        try {
            if (!fs.existsSync(this.showsPath)) {
                fs.mkdirSync(this.showsPath, { recursive: true });
                console.log('[ShowManager] 📁 Created shows folder');
                // Create default show if folder is empty
                this.createDefaultShowIfEmpty();
            }
            else {
                // Check if folder is empty
                this.createDefaultShowIfEmpty();
            }
        }
        catch (error) {
            console.error('[ShowManager] ❌ Error creating shows folder:', error);
        }
    }
    /**
     * 📄 Create Default.json if no shows exist
     */
    createDefaultShowIfEmpty() {
        try {
            const files = fs.readdirSync(this.showsPath);
            const jsonFiles = files.filter(f => f.toLowerCase().endsWith('.json'));
            if (jsonFiles.length === 0) {
                const defaultShow = createDefaultShow();
                const defaultPath = path.join(this.showsPath, 'Default.json');
                fs.writeFileSync(defaultPath, JSON.stringify(defaultShow, null, 2), 'utf-8');
                console.log('[ShowManager] 📄 Created Default.json');
            }
        }
        catch (error) {
            console.error('[ShowManager] ❌ Error creating default show:', error);
        }
    }
    /**
     * 📋 List all shows in the folder
     */
    listShows() {
        try {
            this.ensureShowsFolder();
            const files = fs.readdirSync(this.showsPath);
            const shows = [];
            for (const file of files) {
                if (!file.toLowerCase().endsWith('.json'))
                    continue;
                const filePath = path.join(this.showsPath, file);
                const stats = fs.statSync(filePath);
                try {
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const data = JSON.parse(content);
                    shows.push({
                        filename: file,
                        name: data.name || file.replace('.json', ''),
                        description: data.description || '',
                        createdAt: data.createdAt || stats.birthtime.toISOString(),
                        modifiedAt: data.modifiedAt || stats.mtime.toISOString(),
                        sizeBytes: stats.size,
                        fixtureCount: data.patchedFixtures?.length || 0,
                        version: data.version || '1.0.0',
                    });
                }
                catch (parseError) {
                    console.warn(`[ShowManager] ⚠️ Could not parse ${file}:`, parseError);
                    // Still add the file with minimal info
                    shows.push({
                        filename: file,
                        name: file.replace('.json', ''),
                        description: '(Unable to read)',
                        createdAt: stats.birthtime.toISOString(),
                        modifiedAt: stats.mtime.toISOString(),
                        sizeBytes: stats.size,
                        fixtureCount: 0,
                        version: 'unknown',
                    });
                }
            }
            // Sort by modified date (newest first)
            shows.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
            console.log(`[ShowManager] 📋 Listed ${shows.length} shows`);
            return { success: true, shows, showsPath: this.showsPath };
        }
        catch (error) {
            console.error('[ShowManager] ❌ Error listing shows:', error);
            return {
                success: false,
                shows: [],
                showsPath: this.showsPath,
                error: String(error)
            };
        }
    }
    /**
     * 💾 Save current configuration as a show
     */
    saveShow(name, description, config) {
        try {
            // Sanitize filename
            const safeName = name.replace(/[<>:"/\\|?*]/g, '').trim();
            if (!safeName) {
                return { success: false, error: 'Invalid show name' };
            }
            const filename = `${safeName}.json`;
            const filePath = path.join(this.showsPath, filename);
            // Check if file exists to get createdAt
            let createdAt = new Date().toISOString();
            if (fs.existsSync(filePath)) {
                try {
                    const existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                    createdAt = existing.createdAt || createdAt;
                }
                catch {
                    // Use new date if can't read existing
                }
            }
            const showData = {
                name: safeName,
                description,
                createdAt,
                modifiedAt: new Date().toISOString(),
                version: '1.0.0',
                audio: config.audio,
                dmx: config.dmx,
                patchedFixtures: config.patchedFixtures,
                seleneMode: config.seleneMode,
                installationType: config.installationType,
            };
            fs.writeFileSync(filePath, JSON.stringify(showData, null, 2), 'utf-8');
            console.log(`[ShowManager] 💾 Saved show: ${filename} (${config.patchedFixtures.length} fixtures)`);
            return { success: true, filename, path: filePath };
        }
        catch (error) {
            console.error('[ShowManager] ❌ Error saving show:', error);
            return { success: false, error: String(error) };
        }
    }
    /**
     * 📂 Load a show from file
     */
    loadShow(filename) {
        try {
            const filePath = path.join(this.showsPath, filename);
            if (!fs.existsSync(filePath)) {
                return { success: false, error: 'Show file not found' };
            }
            const content = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);
            console.log(`[ShowManager] 📂 Loaded show: ${filename} (${data.patchedFixtures?.length || 0} fixtures)`);
            return { success: true, data };
        }
        catch (error) {
            console.error('[ShowManager] ❌ Error loading show:', error);
            return { success: false, error: String(error) };
        }
    }
    /**
     * 🗑️ Delete a show file
     */
    deleteShow(filename) {
        try {
            const filePath = path.join(this.showsPath, filename);
            if (!fs.existsSync(filePath)) {
                return { success: false, error: 'Show file not found' };
            }
            // Prevent deleting the last show
            const files = fs.readdirSync(this.showsPath)
                .filter(f => f.toLowerCase().endsWith('.json'));
            if (files.length <= 1) {
                return { success: false, error: 'Cannot delete the last show' };
            }
            fs.unlinkSync(filePath);
            console.log(`[ShowManager] 🗑️ Deleted show: ${filename}`);
            return { success: true };
        }
        catch (error) {
            console.error('[ShowManager] ❌ Error deleting show:', error);
            return { success: false, error: String(error) };
        }
    }
    /**
     * 📁 Get the shows folder path
     */
    getShowsPath() {
        return this.showsPath;
    }
    /**
     * 📄 Create a new show from scratch
     */
    createNewShow(name, description = '') {
        const defaultShow = createDefaultShow();
        defaultShow.name = name;
        defaultShow.description = description;
        const safeName = name.replace(/[<>:"/\\|?*]/g, '').trim();
        const filename = `${safeName}.json`;
        const filePath = path.join(this.showsPath, filename);
        try {
            fs.writeFileSync(filePath, JSON.stringify(defaultShow, null, 2), 'utf-8');
            console.log(`[ShowManager] 📄 Created new show: ${filename}`);
            return { success: true, filename, path: filePath };
        }
        catch (error) {
            console.error('[ShowManager] ❌ Error creating show:', error);
            return { success: false, error: String(error) };
        }
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════
export const showManager = new ShowManager();
