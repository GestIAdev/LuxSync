/**
 * LUXSYNC ELECTRON - MAIN PROCESS V2
 *
 * WAVE 243.5: THE REBIRTH
 *
 * Este archivo ha sido reducido de 3467 lineas a ~300 lineas.
 * Toda la logica ha sido delegada a:
 * - TitanOrchestrator: Orquestacion Brain -> Engine -> HAL
 * - IPCHandlers: 61+ handlers IPC centralizados
 * - EventRouter: Routing de eventos interno
 *
 * LuxSync V2 - NO HAY VUELTA ATRAS
 */
import { app, BrowserWindow, ipcMain, desktopCapturer } from 'electron';
import path from 'path';
// TITAN 2.0 Core Modules
import { TitanOrchestrator, setupIPCHandlers } from '../src/core/orchestrator';
// External Services
import { configManager } from '../src/core/config/ConfigManager';
import { FixturePhysicsDriver } from '../src/engine/movement/FixturePhysicsDriver';
import { universalDMX } from '../src/hal/drivers/UniversalDMXDriver';
import { artNetDriver } from '../src/hal/drivers/ArtNetDriver';
import { EffectsEngine } from '../src/engine/color/EffectsEngine';
import { showManager } from '../src/core/library/ShowManager';
import { fxtParser } from '../src/core/library/FXTParser';
// =============================================================================
// GLOBAL STATE
// =============================================================================
let mainWindow = null;
let effectsEngine = null;
let titanOrchestrator = null;
const fixturePhysicsDriver = new FixturePhysicsDriver();
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
let fixtureLibrary = [];
let patchedFixtures = [];
let manualOverrides = new Map();
// Zone counters for auto-assignment
let zoneCounters = { par: 0, moving: 0, strobe: 0, laser: 0 };
function resetZoneCounters() {
    zoneCounters = { par: 0, moving: 0, strobe: 0, laser: 0 };
    console.log('[Zoning] Zone counters reset');
}
function recalculateZoneCounters() {
    resetZoneCounters();
    patchedFixtures.forEach(f => {
        const typeUpper = (f.type || '').toUpperCase();
        if (typeUpper.includes('PAR') || typeUpper.includes('WASH') || typeUpper.includes('LED')) {
            zoneCounters.par++;
        }
        else if (typeUpper.includes('MOVING') || typeUpper.includes('SPOT') || typeUpper.includes('BEAM') || typeUpper.includes('HEAD')) {
            zoneCounters.moving++;
        }
        else if (typeUpper.includes('STROBE')) {
            zoneCounters.strobe++;
        }
        else if (typeUpper.includes('LASER')) {
            zoneCounters.laser++;
        }
    });
    console.log('[Zoning] Counters recalculated:', zoneCounters);
}
function autoAssignZone(fixtureType, fixtureName) {
    const typeUpper = (fixtureType || '').toUpperCase();
    const nameUpper = (fixtureName || '').toUpperCase();
    // Moving heads detection
    if (typeUpper.includes('MOVING') || typeUpper.includes('SPOT') || typeUpper.includes('BEAM') || typeUpper.includes('HEAD') ||
        nameUpper.includes('BEAM') || nameUpper.includes('SPOT') || nameUpper.includes('VIZI') ||
        nameUpper.includes('5R') || nameUpper.includes('7R') || nameUpper.includes('MOVING')) {
        const currentCount = zoneCounters.moving;
        zoneCounters.moving++;
        const zone = currentCount % 2 === 0 ? 'MOVING_LEFT' : 'MOVING_RIGHT';
        console.log('[Zoning] Moving Head #' + currentCount + ' "' + fixtureName + '" -> ' + zone);
        return zone;
    }
    // Strobes
    if (typeUpper.includes('STROBE') || nameUpper.includes('STROBE')) {
        zoneCounters.strobe++;
        return 'STROBES';
    }
    // Lasers
    if (typeUpper.includes('LASER') || nameUpper.includes('LASER')) {
        zoneCounters.laser++;
        return 'LASERS';
    }
    // PAR/LED/Wash - alternating front/back
    const currentParCount = zoneCounters.par;
    zoneCounters.par++;
    const zone = currentParCount % 2 === 0 ? 'BACK_PARS' : 'FRONT_PARS';
    console.log('[Zoning] PAR/LED #' + currentParCount + ' "' + fixtureName + '" -> ' + zone);
    return zone;
}
// =============================================================================
// WINDOW CREATION
// =============================================================================
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1920,
        height: 1080,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    });
    // Desktop capturer permissions
    mainWindow.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
        const allowedPermissions = ['media', 'mediaKeySystem', 'geolocation'];
        callback(allowedPermissions.includes(permission));
    });
    // Display media request handler
    mainWindow.webContents.session.setDisplayMediaRequestHandler(async (request, callback) => {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['screen', 'window'],
                thumbnailSize: { width: 150, height: 150 }
            });
            if (sources.length > 0) {
                callback({ video: sources[0], audio: 'loopback' });
            }
            else {
                callback({ video: undefined, audio: undefined });
            }
        }
        catch (err) {
            console.error('[Main] Display media error:', err);
            callback({ video: undefined, audio: undefined });
        }
    });
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
        if (isDev) {
            mainWindow?.webContents.openDevTools();
        }
        // Broadcast fixtures if loaded
        if (patchedFixtures.length > 0 && mainWindow) {
            mainWindow.webContents.send('lux:fixtures-loaded', patchedFixtures);
            console.log('[Main] Broadcasted ' + patchedFixtures.length + ' fixtures to renderer');
        }
    });
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
// =============================================================================
// TITAN 2.0 INITIALIZATION
// =============================================================================
async function initTitan() {
    console.log('[Main] ===============================================');
    console.log('[Main]   BOOTING TITAN 2.0 - WAVE 254: THE SPARK');
    console.log('[Main]   LuxSync V2 - NO HAY VUELTA ATRAS');
    console.log('[Main] ===============================================');
    // Initialize EffectsEngine
    effectsEngine = new EffectsEngine();
    // Initialize TitanOrchestrator (WAVE 254: Now the ONLY orchestrator)
    titanOrchestrator = new TitanOrchestrator({ debug: isDev });
    await titanOrchestrator.init();
    // WAVE 255.5: Connect broadcast callback to send fixture states to frontend
    titanOrchestrator.setBroadcastCallback((truth) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('selene:truth', truth);
        }
    });
    // WAVE 257: Connect log callback for Tactical Log
    titanOrchestrator.setLogCallback((entry) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('lux:log', entry);
        }
    });
    titanOrchestrator.start(); // Setup IPC handlers with all dependencies
    const ipcDeps = {
        mainWindow,
        titanOrchestrator,
        effectsEngine,
        configManager,
        universalDMX,
        artNetDriver,
        showManager,
        patchedFixtures,
        manualOverrides,
        fixturePhysicsDriver,
        fxtParser,
        fixtureLibrary,
        // Zone functions
        autoAssignZone,
        resetZoneCounters,
        recalculateZoneCounters,
        // Getters for dynamic state
        getMainWindow: () => mainWindow,
        getPatchedFixtures: () => patchedFixtures,
        setPatchedFixtures: (fixtures) => { patchedFixtures = fixtures; },
        getFixtureLibrary: () => fixtureLibrary,
        setFixtureLibrary: (library) => { fixtureLibrary = library; },
    };
    setupIPCHandlers(ipcDeps);
    console.log('[Main] IPC Handlers registered via IPCHandlers module');
    // ArtNet event forwarding
    artNetDriver.on('ready', () => {
        console.log('[ArtNet] Ready');
        mainWindow?.webContents.send('artnet:ready', artNetDriver.getStatus());
    });
    artNetDriver.on('error', (error) => {
        console.error('[ArtNet] Error:', error.message);
        mainWindow?.webContents.send('artnet:error', error.message);
    });
    artNetDriver.on('disconnected', () => {
        console.log('[ArtNet] Disconnected');
        mainWindow?.webContents.send('artnet:disconnected');
    });
    console.log('[Main] ===============================================');
    console.log('[Main]   TITAN 2.0 ONLINE');
    console.log('[Main]   All modules initialized');
    console.log('[Main] ===============================================');
}
// =============================================================================
// APP LIFECYCLE
// =============================================================================
app.whenReady().then(async () => {
    console.log('[Main] LuxSync V2 starting...');
    // Load saved configuration
    const savedConfig = configManager.load();
    // ═══════════════════════════════════════════════════════════════════════════
    // WAVE 255: LA BIBLIOTECA - Load fixture definitions from luxsync/librerias
    // ═══════════════════════════════════════════════════════════════════════════
    const libraryPath = isDev
        ? path.join(__dirname, '../../librerias') // Dev: luxsync/librerias
        : path.join(app.getPath('userData'), 'librerias'); // Prod: userData/librerias
    console.log('[Library] 📚 Scanning library path:', libraryPath);
    const loadedDefinitions = fxtParser.scanFolder(libraryPath);
    if (loadedDefinitions.length > 0) {
        fixtureLibrary = loadedDefinitions;
        console.log(`[Library] ✅ Loaded ${loadedDefinitions.length} fixture definitions from luxsync/librerias`);
    }
    else {
        console.warn('[Library] ⚠️ No fixture definitions found in library');
    }
    // Restore patched fixtures
    if (savedConfig.patchedFixtures.length > 0) {
        resetZoneCounters();
        patchedFixtures = savedConfig.patchedFixtures.map(f => ({
            id: f.id,
            name: f.name,
            type: f.type,
            manufacturer: f.manufacturer,
            channelCount: f.channelCount,
            dmxAddress: f.dmxAddress,
            universe: f.universe,
            zone: autoAssignZone(f.type, f.name),
            filePath: f.filePath,
        }));
        recalculateZoneCounters();
        console.log('[Main] Restored ' + patchedFixtures.length + ' fixtures from config');
    }
    createWindow();
    await initTitan();
    // ═══════════════════════════════════════════════════════════════════════════
    // WAVE 255: CONEXIÓN DEL CUERPO - Inject fixtures into TitanOrchestrator
    // ═══════════════════════════════════════════════════════════════════════════
    if (titanOrchestrator && patchedFixtures.length > 0) {
        // Hydrate fixtures with library definitions
        const hydratedFixtures = patchedFixtures.map(patched => {
            const definition = fixtureLibrary.find(def => def.name === patched.name || def.id === patched.id);
            return {
                ...patched,
                channels: definition?.channels || [],
                hasMovementChannels: definition?.hasMovementChannels || false,
                has16bitMovement: definition?.has16bitMovement || false,
                hasColorMixing: definition?.hasColorMixing || false,
                hasColorWheel: definition?.hasColorWheel || false,
            };
        });
        titanOrchestrator.setFixtures(hydratedFixtures);
        console.log(`[Main] 💉 Injected ${hydratedFixtures.length} fixtures into Titan Engine`);
    }
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
// Save config before quit
app.on('before-quit', () => {
    configManager.forceSave();
    if (titanOrchestrator) {
        titanOrchestrator.stop();
    }
    console.log('[Main] Config saved, TITAN stopped');
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
// Basic IPC handlers that need to stay in main
ipcMain.handle('app:getVersion', () => app.getVersion());
ipcMain.handle('audio:getDesktopSources', async () => {
    try {
        const sources = await desktopCapturer.getSources({
            types: ['window', 'screen'],
            thumbnailSize: { width: 0, height: 0 }
        });
        console.log('[Main] Desktop sources found:', sources.length);
        return sources.map(s => ({
            id: s.id,
            name: s.name,
            displayId: s.display_id
        }));
    }
    catch (err) {
        console.error('[Main] Failed to get desktop sources:', err);
        return [];
    }
});
console.log('LuxSync V2 Main Process Loaded - WAVE 243.5');
