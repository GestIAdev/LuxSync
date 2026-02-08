/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔧 LUXSYNC CONFIG MANAGER V2 - WAVE 367: SPRING CLEANING
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * WHAT CHANGED:
 * - patchedFixtures[] REMOVED → Now lives in ShowFileV2 (StagePersistence)
 * - This manager only stores APP-LEVEL PREFERENCES
 * - Added lastOpenedShowPath for show restoration
 *
 * STORED DATA:
 * - audioInputDeviceId: Selected microphone
 * - dmxInterfaceType: ENTTEC, ArtNet, etc.
 * - uiTheme: dark/light/system
 * - lastOpenedShowPath: Path to auto-load on startup
 * - seleneMode: Current mode
 * - installationType: ceiling/floor global default
 * - ui preferences: showBeams, showGrid, etc.
 *
 * NOT STORED (moved to ShowFileV2):
 * - patchedFixtures[] → StagePersistence
 * - scenes[] → ShowFileV2.scenes
 *
 * @module core/config/ConfigManagerV2
 * @version 367.0.0 - Spring Cleaning
 */
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT CONFIG
// ═══════════════════════════════════════════════════════════════════════════════
const DEFAULT_CONFIG_V2 = {
    version: '2.0.0',
    lastSaved: new Date().toISOString(),
    lastOpenedShowPath: null,
    dmx: {
        driver: 'enttec-usb-dmx-pro',
        port: '',
        universe: 0, // 🔥 WAVE 1219: ArtNet es 0-indexed (0 = Universo 1 en display)
        frameRate: 40,
    },
    audio: {
        source: 'simulation',
        sensitivity: 0.7,
        inputGain: 1.0,
    },
    seleneMode: 'idle',
    installationType: 'ceiling',
    ui: {
        lastView: 'live',
        showBeams: true,
        showGrid: true,
        showZoneLabels: true,
        theme: 'dark',
    },
    v1MigrationComplete: false,
    localStorageScenesMigrated: false,
};
// ═══════════════════════════════════════════════════════════════════════════════
// CONFIG MANAGER V2 CLASS
// ═══════════════════════════════════════════════════════════════════════════════
class ConfigManagerV2 {
    constructor() {
        this.saveTimeout = null;
        // Legacy data holder (extracted during migration, used by StagePersistence)
        this.legacyFixtures = [];
        const userDataPath = app.getPath('userData');
        this.configPath = path.join(userDataPath, 'luxsync-config.json');
        this.config = { ...DEFAULT_CONFIG_V2 };
        console.log(`[ConfigManagerV2] 📁 Config path: ${this.configPath}`);
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // LOAD WITH AUTO-MIGRATION
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Load configuration with automatic V1 → V2 migration
     * Returns the config AND any legacy fixtures found (for StagePersistence to consume)
     */
    load() {
        try {
            if (!fs.existsSync(this.configPath)) {
                console.log('[ConfigManagerV2] 📝 No config file found, using defaults');
                return { config: this.config, legacyFixtures: [] };
            }
            const data = fs.readFileSync(this.configPath, 'utf-8');
            const loaded = JSON.parse(data);
            // Detect V1 config by presence of patchedFixtures
            if ('patchedFixtures' in loaded && Array.isArray(loaded.patchedFixtures)) {
                console.log('[ConfigManagerV2] 🔄 Detected V1 config, migrating...');
                return this.migrateFromV1(loaded);
            }
            // Already V2
            const loadedV2 = loaded;
            this.config = {
                ...DEFAULT_CONFIG_V2,
                ...loadedV2,
                version: '2.0.0', // Force correct version literal
                dmx: { ...DEFAULT_CONFIG_V2.dmx, ...loadedV2.dmx },
                audio: { ...DEFAULT_CONFIG_V2.audio, ...loadedV2.audio },
                ui: { ...DEFAULT_CONFIG_V2.ui, ...loadedV2.ui },
            };
            console.log('[ConfigManagerV2] ✅ V2 config loaded');
            return { config: this.config, legacyFixtures: [] };
        }
        catch (error) {
            console.error('[ConfigManagerV2] ❌ Error loading config:', error);
            return { config: this.config, legacyFixtures: [] };
        }
    }
    /**
     * Migrate V1 config to V2, extracting fixtures for StagePersistence
     */
    migrateFromV1(v1Config) {
        // Extract legacy fixtures
        this.legacyFixtures = v1Config.patchedFixtures || [];
        console.log(`[ConfigManagerV2] 📦 Extracted ${this.legacyFixtures.length} legacy fixtures for migration`);
        // Build V2 config (WITHOUT fixtures)
        this.config = {
            version: '2.0.0',
            lastSaved: new Date().toISOString(),
            lastOpenedShowPath: null,
            dmx: {
                driver: v1Config.dmx?.driver || DEFAULT_CONFIG_V2.dmx.driver,
                port: v1Config.dmx?.port || DEFAULT_CONFIG_V2.dmx.port,
                universe: v1Config.dmx?.universe || DEFAULT_CONFIG_V2.dmx.universe,
                frameRate: v1Config.dmx?.frameRate || DEFAULT_CONFIG_V2.dmx.frameRate,
            },
            audio: {
                source: v1Config.audio?.source || DEFAULT_CONFIG_V2.audio.source,
                deviceId: v1Config.audio?.deviceId,
                sensitivity: v1Config.audio?.sensitivity ?? DEFAULT_CONFIG_V2.audio.sensitivity,
                inputGain: v1Config.audio?.inputGain ?? DEFAULT_CONFIG_V2.audio.inputGain,
            },
            seleneMode: v1Config.seleneMode || DEFAULT_CONFIG_V2.seleneMode,
            installationType: v1Config.installationType || DEFAULT_CONFIG_V2.installationType,
            ui: {
                lastView: v1Config.ui?.lastView || DEFAULT_CONFIG_V2.ui.lastView,
                showBeams: v1Config.ui?.showBeams ?? DEFAULT_CONFIG_V2.ui.showBeams,
                showGrid: v1Config.ui?.showGrid ?? DEFAULT_CONFIG_V2.ui.showGrid,
                showZoneLabels: v1Config.ui?.showZoneLabels ?? DEFAULT_CONFIG_V2.ui.showZoneLabels,
                theme: v1Config.ui?.theme || DEFAULT_CONFIG_V2.ui.theme,
            },
            v1MigrationComplete: false, // Will be set true after StagePersistence consumes fixtures
            localStorageScenesMigrated: false,
        };
        // Save V2 config immediately (removes patchedFixtures from disk)
        this.save();
        console.log('[ConfigManagerV2] ✅ V1 → V2 migration complete (fixtures extracted)');
        return { config: this.config, legacyFixtures: this.legacyFixtures };
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // SAVE
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Save configuration to disk (atomic write)
     */
    save() {
        try {
            this.config.lastSaved = new Date().toISOString();
            const dir = path.dirname(this.configPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            // Atomic write: temp file → rename
            const tempPath = `${this.configPath}.tmp`;
            fs.writeFileSync(tempPath, JSON.stringify(this.config, null, 2), 'utf-8');
            fs.renameSync(tempPath, this.configPath);
            console.log('[ConfigManagerV2] 💾 Preferences saved');
            return true;
        }
        catch (error) {
            console.error('[ConfigManagerV2] ❌ Error saving config:', error);
            return false;
        }
    }
    /**
     * Save with debounce (avoids excessive writes)
     */
    saveDebounced(delayMs = 1000) {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(() => {
            this.save();
            this.saveTimeout = null;
        }, delayMs);
    }
    /**
     * Force immediate save (for app close)
     */
    forceSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
        this.save();
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // GETTERS
    // ═══════════════════════════════════════════════════════════════════════════
    getConfig() {
        return this.config;
    }
    getLastOpenedShowPath() {
        return this.config.lastOpenedShowPath;
    }
    getDMXConfig() {
        return this.config.dmx;
    }
    getAudioConfig() {
        return this.config.audio;
    }
    getUIPreferences() {
        return this.config.ui;
    }
    getInstallationType() {
        return this.config.installationType;
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // SETTERS (Preferences only - NO fixtures!)
    // ═══════════════════════════════════════════════════════════════════════════
    setLastOpenedShowPath(showPath) {
        this.config.lastOpenedShowPath = showPath;
        this.saveDebounced();
    }
    setDMXConfig(dmx) {
        this.config.dmx = { ...this.config.dmx, ...dmx };
        this.saveDebounced();
    }
    setAudioConfig(audio) {
        this.config.audio = { ...this.config.audio, ...audio };
        this.saveDebounced();
    }
    setSeleneMode(mode) {
        this.config.seleneMode = mode;
        this.saveDebounced();
    }
    setInstallationType(type) {
        this.config.installationType = type;
        this.saveDebounced();
        console.log(`[ConfigManagerV2] 🎯 Installation type: ${type}`);
    }
    setUIPreferences(ui) {
        this.config.ui = { ...this.config.ui, ...ui };
        this.saveDebounced();
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // MIGRATION FLAGS
    // ═══════════════════════════════════════════════════════════════════════════
    markV1MigrationComplete() {
        this.config.v1MigrationComplete = true;
        this.save();
        console.log('[ConfigManagerV2] ✅ V1 migration marked complete');
    }
    markLocalStorageScenesMigrated() {
        this.config.localStorageScenesMigrated = true;
        this.save();
        console.log('[ConfigManagerV2] ✅ localStorage scenes migration marked complete');
    }
    isV1MigrationComplete() {
        return this.config.v1MigrationComplete;
    }
    isLocalStorageScenesMigrated() {
        return this.config.localStorageScenesMigrated;
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // LEGACY COMPATIBILITY SHIMS (for gradual migration of IPCHandlers)
    // These will log warnings and do nothing - fixtures go through StagePersistence
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * @deprecated Use StagePersistence instead. This is a no-op shim.
     */
    updateConfig(partial) {
        // If they're trying to update patchedFixtures, warn and ignore
        if ('patchedFixtures' in partial) {
            console.warn('[ConfigManagerV2] ⚠️ DEPRECATED: patchedFixtures should use StagePersistence, ignoring');
            return;
        }
        // For other valid preferences, update them
        if ('dmx' in partial) {
            this.setDMXConfig(partial.dmx);
        }
        if ('audio' in partial) {
            this.setAudioConfig(partial.audio);
        }
        if ('seleneMode' in partial) {
            this.setSeleneMode(partial.seleneMode);
        }
        if ('installationType' in partial || 'installation' in partial) {
            const type = (partial.installationType || partial.installation);
            this.setInstallationType(type);
        }
        if ('ui' in partial) {
            this.setUIPreferences(partial.ui);
        }
        this.saveDebounced();
    }
    /**
     * @deprecated Returns empty array. Use StagePersistence for fixtures.
     */
    getPatchedFixtures() {
        console.warn('[ConfigManagerV2] ⚠️ DEPRECATED: getPatchedFixtures() → Use stageStore or StagePersistence');
        return [];
    }
}
// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export const configManager = new ConfigManagerV2();
export default configManager;
