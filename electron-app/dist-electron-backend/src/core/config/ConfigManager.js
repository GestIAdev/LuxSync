/**
 * 🔧 LUXSYNC CONFIG MANAGER
 * WAVE 10: Persistencia de configuración en disco
 *
 * Guarda y carga automáticamente:
 * - Patch de fixtures (DMX addresses, zones)
 * - Configuración DMX (driver, port, universe)
 * - Preferencias de audio
 * - Estado de Selene
 */
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
// ============================================
// DEFAULT CONFIG
// ============================================
const DEFAULT_CONFIG = {
    version: '1.0.0',
    lastSaved: new Date().toISOString(),
    patchedFixtures: [],
    dmx: {
        driver: 'enttec-usb-dmx-pro',
        port: '',
        universe: 1,
        frameRate: 40,
    },
    audio: {
        source: 'simulation',
        sensitivity: 0.7,
        inputGain: 1.0, // 🔧 WAVE 15: Default 100%
    },
    seleneMode: 'idle',
    // 🎯 WAVE 12.5: Default to ceiling (colgados)
    installationType: 'ceiling',
    ui: {
        lastView: 'live',
        showBeams: true,
        showGrid: true,
        showZoneLabels: true,
    }
};
// ============================================
// CONFIG MANAGER CLASS
// ============================================
class ConfigManager {
    constructor() {
        this.saveTimeout = null;
        // Guardar en userData (AppData en Windows, ~/.config en Linux)
        const userDataPath = app.getPath('userData');
        this.configPath = path.join(userDataPath, 'luxsync-config.json');
        this.config = { ...DEFAULT_CONFIG };
        console.log(`[ConfigManager] 📁 Config path: ${this.configPath}`);
    }
    /**
     * Cargar configuración desde disco
     */
    load() {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, 'utf-8');
                const loaded = JSON.parse(data);
                // Merge con defaults para asegurar todas las propiedades
                this.config = {
                    ...DEFAULT_CONFIG,
                    ...loaded,
                    dmx: { ...DEFAULT_CONFIG.dmx, ...loaded.dmx },
                    audio: { ...DEFAULT_CONFIG.audio, ...loaded.audio },
                    ui: { ...DEFAULT_CONFIG.ui, ...loaded.ui },
                };
                console.log(`[ConfigManager] ✅ Config loaded: ${this.config.patchedFixtures.length} fixtures`);
                return this.config;
            }
            else {
                console.log('[ConfigManager] 📝 No config file found, using defaults');
                return this.config;
            }
        }
        catch (error) {
            console.error('[ConfigManager] ❌ Error loading config:', error);
            return this.config;
        }
    }
    /**
     * Guardar configuración a disco
     */
    save() {
        try {
            this.config.lastSaved = new Date().toISOString();
            // Asegurar que el directorio existe
            const dir = path.dirname(this.configPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
            console.log(`[ConfigManager] 💾 Config saved: ${this.config.patchedFixtures.length} fixtures`);
            return true;
        }
        catch (error) {
            console.error('[ConfigManager] ❌ Error saving config:', error);
            return false;
        }
    }
    /**
     * Guardar con debounce (evita escrituras excesivas)
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
     * Obtener configuración actual
     */
    getConfig() {
        return this.config;
    }
    /**
     * Actualizar patch de fixtures
     */
    setPatchedFixtures(fixtures) {
        this.config.patchedFixtures = fixtures;
        this.saveDebounced();
    }
    /**
     * Añadir fixture al patch
     */
    addFixture(fixture) {
        this.config.patchedFixtures.push(fixture);
        this.saveDebounced();
    }
    /**
     * Eliminar fixture del patch
     */
    removeFixture(dmxAddress) {
        const index = this.config.patchedFixtures.findIndex(f => f.dmxAddress === dmxAddress);
        if (index !== -1) {
            const removed = this.config.patchedFixtures.splice(index, 1)[0];
            this.saveDebounced();
            return removed;
        }
        return undefined;
    }
    /**
     * Limpiar patch
     */
    clearPatch() {
        const count = this.config.patchedFixtures.length;
        this.config.patchedFixtures = [];
        this.saveDebounced();
        return count;
    }
    /**
     * Actualizar configuración DMX
     */
    setDMXConfig(dmx) {
        this.config.dmx = { ...this.config.dmx, ...dmx };
        this.saveDebounced();
    }
    /**
     * Actualizar configuración de audio
     */
    setAudioConfig(audio) {
        this.config.audio = { ...this.config.audio, ...audio };
        this.saveDebounced();
    }
    /**
     * Actualizar modo de Selene
     */
    setSeleneMode(mode) {
        this.config.seleneMode = mode;
        this.saveDebounced();
    }
    /**
     * 🎯 WAVE 12.5: Actualizar tipo de instalación (ceiling/floor)
     */
    setInstallationType(type) {
        this.config.installationType = type;
        this.saveDebounced();
        console.log(`[ConfigManager] 🎯 Installation type set to: ${type}`);
    }
    /**
     * 🎯 WAVE 12.5: Obtener tipo de instalación
     */
    getInstallationType() {
        return this.config.installationType || 'ceiling';
    }
    /**
     * Actualizar preferencias de UI
     */
    setUIPreferences(ui) {
        this.config.ui = { ...this.config.ui, ...ui };
        this.saveDebounced();
    }
    /**
     * Obtener solo los fixtures patcheados
     */
    getPatchedFixtures() {
        return this.config.patchedFixtures;
    }
    /**
     * Forzar guardado inmediato (para cierre de app)
     */
    forceSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
        this.save();
    }
}
// Singleton
export const configManager = new ConfigManager();
export default configManager;
