/**
 * LUXSYNC ELECTRON - MAIN PROCESS V2
 *
 * WAVE 243.5: THE REBIRTH
 * WAVE 365: SYSTEM INTEGRATION
 * WAVE 367: SPRING CLEANING
 *
 * Este archivo ha sido reducido de 3467 lineas a ~300 lineas.
 * Toda la logica ha sido delegada a:
 * - TitanOrchestrator: Orquestacion Brain -> Engine -> HAL
 * - IPCHandlers: 61+ handlers IPC centralizados
 * - EventRouter: Routing de eventos interno
 * - StagePersistence: Persistencia V2 (WAVE 365)
 * - ConfigManagerV2: Solo preferencias (WAVE 367)
 *
 * LuxSync V2 - NO HAY VUELTA ATRAS
 */
import { app, BrowserWindow, ipcMain, desktopCapturer, dialog, clipboard } from 'electron';
import path from 'path';
// ═══════════════════════════════════════════════════════════════════════════
// 🛡️ WAVE 2489: THE OBSIDIAN VAULT — V8 Bytecode License Validator
// bytenode registra el handler para .jsc ANTES de cualquier require()
// ═══════════════════════════════════════════════════════════════════════════
const bytenode = require('bytenode');
// TITAN 2.0 Core Modules
import { TitanOrchestrator, setupIPCHandlers, registerTitanOrchestrator } from '../src/core/orchestrator';
// Arbiter IPC Handlers (WAVE 377 - TitanSyncBridge support)
import { registerArbiterHandlers, masterArbiter } from '../src/core/arbiter';
// Stage Persistence (WAVE 365)
import { stagePersistence, setupStageIPCHandlers } from '../src/core/stage';
// ⚒️ Hephaestus File I/O (WAVE 2030.5)
import { setupHephIPCHandlers } from '../src/core/hephaestus';
// Config Manager V2 (WAVE 367) - PREFERENCES ONLY, NO FIXTURES
import { configManager } from '../src/core/config/ConfigManagerV2';
// External Services
import { FixturePhysicsDriver } from '../src/engine/movement/FixturePhysicsDriver';
import { universalDMX } from '../src/hal/drivers/UniversalDMXDriver';
import { artNetDriver } from '../src/hal/drivers/ArtNetDriver';
// 🎨 WAVE 686.10: Import ArtNetDriverAdapter to bridge ArtNet to HAL
import { createArtNetAdapter } from '../src/hal/drivers/ArtNetDriverAdapter';
// 🔥 WAVE 2100: CompositeDMXDriver — dual output USB + ArtNet
import { CompositeDMXDriver } from '../src/hal/drivers/CompositeDMXDriver';
import { USBDMXDriverAdapter } from '../src/hal/drivers/USBDMXDriverAdapter';
import { EffectsEngine } from '../src/engine/color/EffectsEngine';
import { latinoEngine41Telemetry } from '../src/hal/physics';
// ShowManager PURGED - WAVE 365: Replaced by StagePersistence
import { fxtParser } from '../src/core/library/FXTParser';
// 👻 WAVE 2005.3: Phantom Worker for audio analysis
import { getPhantomWorker, destroyPhantomWorker } from './workers/PhantomWorkerManager';
import { setupChronosIPCHandlers, cleanupChronosIPC } from './ipc/ChronosIPCHandlers';
// 🎬 WAVE 2053.1: TimelineEngine playback IPC
import { setupPlaybackIPCHandlers, cleanupPlaybackIPC } from './ipc/PlaybackIPCHandlers';
// =============================================================================
// GLOBAL STATE
// =============================================================================
let mainWindow = null;
let effectsEngine = null;
let titanOrchestrator = null;
const fixturePhysicsDriver = new FixturePhysicsDriver();
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
// ═══════════════════════════════════════════════════════════════════════════
// 🔒 WAVE 2490: THE TIER SEPARATION PROTOCOL — License tier state
// Populated after Two-Gate validation. Dev mode defaults to FULL_SUITE.
// ═══════════════════════════════════════════════════════════════════════════
let currentLicenseTier = 'FULL_SUITE';
let fixtureLibrary = [];
let patchedFixtures = [];
let manualOverrides = new Map();
// Zone counters for auto-assignment
let zoneCounters = { par: 0, moving: 0, strobe: 0, laser: 0 };
// WAVE 390.5: Factory library path (stored after initialization)
let factoryLibPath = '';
let customLibPath = '';
/**
 * WAVE 390.5: Rescan ALL libraries (factory + custom) with proper merge
 * This is the ONLY function that should update fixtureLibrary after save/delete
 */
async function rescanAllLibraries() {
    // Scan both libraries
    const factoryDefinitions = fxtParser.scanFolder(factoryLibPath);
    const customDefinitions = fxtParser.scanFolder(customLibPath);
    // 🧹 WAVE 671.5: Removed obsolete test_beam debug log (no longer needed)
    // WAVE 390.5 DEBUG: Log test_beam specifically (it has physics)
    // const testBeam = customDefinitions.find(f => f.name.toLowerCase().includes('test'))
    // if (testBeam) {
    //   console.log('[Library] 🔬 test_beam fixture data:', {
    //     name: testBeam.name,
    //     channelCount: testBeam.channelCount,
    //     hasChannels: !!testBeam.channels,
    //     channelsLength: testBeam.channels?.length,
    //     firstChannel: testBeam.channels?.[0],
    //     hasPhysics: !!testBeam.physics,
    //     physics: testBeam.physics
    //   })
    // } else {
    //   console.log('[Library] ℹ️ test_beam not found in custom folder')
    // }
    // Merge: custom overrides factory by name (not ID, IDs are unreliable for .fxt files)
    const mergedLibrary = [...factoryDefinitions];
    for (const customFix of customDefinitions) {
        // Match by name (case-insensitive) since IDs are generated
        const existingIndex = mergedLibrary.findIndex(f => f.name.toLowerCase() === customFix.name.toLowerCase());
        if (existingIndex >= 0) {
            mergedLibrary[existingIndex] = customFix; // Custom overrides factory
        }
        else {
            mergedLibrary.push(customFix); // New custom fixture
        }
    }
    fixtureLibrary = mergedLibrary;
    return fixtureLibrary;
}
function resetZoneCounters() {
    zoneCounters = { par: 0, moving: 0, strobe: 0, laser: 0 };
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
        // 🔥 WAVE 2040.24: Canonical zones
        const zone = currentCount % 2 === 0 ? 'movers-left' : 'movers-right';
        return zone;
    }
    // Strobes → center
    if (typeUpper.includes('STROBE') || nameUpper.includes('STROBE')) {
        zoneCounters.strobe++;
        return 'center';
    }
    // Lasers → air
    if (typeUpper.includes('LASER') || nameUpper.includes('LASER')) {
        zoneCounters.laser++;
        return 'air';
    }
    // PAR/LED/Wash - alternating back/front
    const currentParCount = zoneCounters.par;
    zoneCounters.par++;
    // 🔥 WAVE 2040.24: Canonical zones
    const zone = currentParCount % 2 === 0 ? 'back' : 'front';
    return zone;
}
// =============================================================================
// WINDOW CREATION
// =============================================================================
function createWindow() {
    // 🌟 WAVE 2497: icon multiplataforma — .ico en Windows, .icns en macOS
    const iconExt = process.platform === 'darwin' ? 'icns' : process.platform === 'linux' ? 'png' : 'ico';
    const appIcon = path.join(__dirname, `../build/icon.${iconExt}`);
    mainWindow = new BrowserWindow({
        width: 1920,
        height: 1080,
        frame: false, // Custom title bar
        title: 'LuxSync',
        icon: appIcon,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            backgroundThrottling: false,
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
        // F12 abre DevTools en cualquier entorno (sin exponer nada al renderer)
        mainWindow?.webContents.on('before-input-event', (_, input) => {
            if (input.type === 'keyDown' && input.key === 'F12') {
                mainWindow?.webContents.toggleDevTools();
            }
        });
        // Broadcast fixtures if loaded
        if (patchedFixtures.length > 0 && mainWindow) {
            mainWindow.webContents.send('lux:fixtures-loaded', patchedFixtures);
        }
    });
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
    mainWindow.on('closed', () => {
        // ⚡ WAVE 2495: THE SILVER BULLET — Shutdown atado a la puerta principal.
        // window-all-closed NO es fiable cuando hay ventanas ocultas (phantomWorker,
        // background renderers). Este hook dispara SIN EXCUSAS cuando el usuario
        // cierra la ventana visible. No hay ventana secundaria que lo bloquee.
        mainWindow = null;
        doShutdown();
    });
    // Notify renderer of maximize state changes (for custom title bar button icon)
    mainWindow.on('maximize', () => {
        mainWindow?.webContents.send('window:maximized', true);
    });
    mainWindow.on('unmaximize', () => {
        mainWindow?.webContents.send('window:maximized', false);
    });
}
// =============================================================================
// TITAN 2.0 INITIALIZATION
// =============================================================================
async function initTitan() {
    // WAVE 2098: Boot silence — banners removed
    // ═══════════════════════════════════════════════════════════════════════════
    // WAVE 365: Initialize Stage Persistence (BEFORE other systems)
    // ═══════════════════════════════════════════════════════════════════════════
    await stagePersistence.init();
    setupStageIPCHandlers(() => mainWindow);
    // ═══════════════════════════════════════════════════════════════════════════
    // ⚒️ WAVE 2030.5: Initialize Hephaestus File I/O
    // ═══════════════════════════════════════════════════════════════════════════
    setupHephIPCHandlers();
    // ═══════════════════════════════════════════════════════════════════════════
    // 👻 WAVE 2005.3: Initialize Phantom Worker for audio analysis
    // ═══════════════════════════════════════════════════════════════════════════
    try {
        const phantom = getPhantomWorker();
        await phantom.init();
        setupChronosIPCHandlers(mainWindow);
        setupPlaybackIPCHandlers(mainWindow); // WAVE 2054: Pass window for arbiter feedback
    }
    catch (err) {
        console.error('[Main] ❌ Failed to initialize Phantom Worker:', err);
        // Non-fatal - Chronos will work without audio analysis
    }
    // Initialize EffectsEngine
    effectsEngine = new EffectsEngine();
    // 🔥 WAVE 2100: COMPOSITE DRIVER — USB + ArtNet en paralelo
    const usbAdapter = new USBDMXDriverAdapter();
    const artNetAdapter = createArtNetAdapter(artNetDriver);
    const compositeDriver = new CompositeDMXDriver(usbAdapter, artNetAdapter);
    // Initialize TitanOrchestrator (WAVE 254: Now the ONLY orchestrator)
    // 🔥 WAVE 2100: Pass COMPOSITE driver so HAL outputs to BOTH USB and ArtNet
    titanOrchestrator = new TitanOrchestrator({
        debug: isDev,
        dmxDriver: compositeDriver
    });
    // 🔒 WAVE 2490: Inject license tier into TitanOrchestrator
    titanOrchestrator.setLicenseTier(currentLicenseTier);
    // WAVE 380: Register as singleton so IPC handlers can access the same instance
    registerTitanOrchestrator(titanOrchestrator);
    await titanOrchestrator.init();
    // WAVE 255.5: Connect broadcast callback to send fixture states to frontend
    // 🛡️ WAVE 2005.1: Added try-catch for "Render frame disposed" errors
    titanOrchestrator.setBroadcastCallback((truth) => {
        try {
            if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
                mainWindow.webContents.send('selene:truth', truth);
            }
        }
        catch (err) {
            // Silently ignore - the renderer is being destroyed (e.g., during heavy audio loading)
            // This is not a critical error, just a timing issue
        }
    });
    // WAVE 257: Connect log callback for Tactical Log
    // 🛡️ WAVE 2005.1: Added try-catch for "Render frame disposed" errors
    titanOrchestrator.setLogCallback((entry) => {
        try {
            if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
                mainWindow.webContents.send('lux:log', entry);
            }
        }
        catch (err) {
            // Silently ignore - the renderer is being destroyed
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
        // showManager PURGED - WAVE 365: StagePersistence handles persistence now
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
        // WAVE 390.5: Rescan ALL libraries (factory + custom)
        rescanAllLibraries,
        // WAVE 1115: Library paths (resolved by PATHFINDER)
        getFactoryLibPath: () => factoryLibPath,
        getCustomLibPath: () => customLibPath,
    };
    setupIPCHandlers(ipcDeps);
    // 🎭 WAVE 374 + 377: Arbiter IPC Handlers (unified)
    // Note: Using registerArbiterHandlers from arbiter module (more complete)
    // setupArbiterHandlers from orchestrator is deprecated (duplicate handlers)
    registerArbiterHandlers(masterArbiter);
    // ═══════════════════════════════════════════════════════════════════════════
    // 🔒 WAVE 2490: THE TIER SEPARATION PROTOCOL — License tier IPC
    // ═══════════════════════════════════════════════════════════════════════════
    ipcMain.handle('license:getTier', () => currentLicenseTier);
    // ArtNet event forwarding
    artNetDriver.on('ready', () => {
        mainWindow?.webContents.send('artnet:ready', artNetDriver.getStatus());
    });
    artNetDriver.on('error', (error) => {
        console.error('[ArtNet] Error:', error.message);
        mainWindow?.webContents.send('artnet:error', error.message);
    });
    artNetDriver.on('disconnected', () => {
        mainWindow?.webContents.send('artnet:disconnected');
    });
    // WAVE 2098: Unified boot banner — the ONLY boot output
    const ts = new Date().toLocaleTimeString();
    console.log('');
    console.log('  ╔══════════════════════════════════════════════╗');
    console.log('  ║                                              ║');
    console.log('  ║   ▓▓  LuxSync  ▓▓  Selene Lux IA Engine     ║');
    console.log('  ║   ══════════════════════════════════════      ║');
    console.log('  ║   TITAN CORE .............. ONLINE            ║');
    console.log('  ║   TRINITY WORKERS ......... LIVE              ║');
    console.log('  ║   HAL ABSTRACTION ......... READY             ║');
    console.log('  ║   DMX OUTPUT .............. ARMED             ║');
    console.log('  ║                                              ║');
    console.log(`  ║   ${ts}                              ║`);
    console.log('  ╚══════════════════════════════════════════════╝');
    console.log('');
}
// =============================================================================
// APP LIFECYCLE
// =============================================================================
app.whenReady().then(async () => {
    // ═══════════════════════════════════════════════════════════════════════════
    // 🛡️ WAVE 2489 + 2491: THE OBSIDIAN VAULT — Two-Gate License Validation
    // Si falla, abre la pantalla de activación en lugar de un diálogo nativo.
    // ═══════════════════════════════════════════════════════════════════════════
    if (!isDev) {
        const fs = await import('fs');
        let licenseValidator;
        let validatorLoadError = false;
        let fallbackHwId = 'UNKNOWN';
        // En producción el .jsc está en app.asar.unpacked — bytenode necesita el path real del filesystem
        const jscPath = app.isPackaged
            ? path.join(process.resourcesPath, 'app.asar.unpacked', 'dist-electron', 'license', 'LicenseValidator.jsc')
            : path.join(__dirname, 'license', 'LicenseValidator.jsc');
        try {
            licenseValidator = require(jscPath);
            console.log('[LICENSE] Validator loaded OK');
        }
        catch (jscErr) {
            console.error('[LICENSE] JSC load failed:', jscErr?.message || jscErr, 'Path:', jscPath);
            try {
                licenseValidator = require('./license/LicenseValidator.js');
                console.warn('[LICENSE] Using JS fallback');
            }
            catch (jsErr) {
                console.error('[LICENSE] JS fallback also failed:', jsErr?.message || jsErr);
                validatorLoadError = true;
                licenseValidator = null;
                try {
                    const os = require('os');
                    const ifaces = os.networkInterfaces();
                    for (const name of Object.keys(ifaces)) {
                        for (const addr of (ifaces[name] || [])) {
                            if (addr.family === 'IPv4' && !addr.internal && addr.mac !== '00:00:00:00:00:00') {
                                fallbackHwId = addr.mac.toLowerCase();
                                break;
                            }
                        }
                        if (fallbackHwId !== 'UNKNOWN')
                            break;
                    }
                }
                catch { }
            }
        }
        const licensePath = path.join(app.getPath('userData'), 'license', 'license.luxlicense');
        const licenseDir = path.dirname(licensePath);
        let result = null;
        if (validatorLoadError) {
            result = { valid: false, detectedHwId: fallbackHwId, error: 'VALIDATOR_LOAD_ERROR' };
        }
        else {
            result = licenseValidator.validateLicense(licensePath);
        }
        if (!result.valid) {
            // ═══════════════════════════════════════════════════════════════════════
            // 🖥️ WAVE 2491: ACTIVATION SCREEN — Beautiful license UI
            // ═══════════════════════════════════════════════════════════════════════
            let errorTitle;
            let errorDetail;
            if (validatorLoadError) {
                errorTitle = 'Error crítico de licencia';
                errorDetail = 'No se pudo cargar el sistema de validación. Reinstala la aplicación o contacta con soporte.';
            }
            else if (result.gate1 === false && result.gate2 === true) {
                errorTitle = 'Hardware no autorizado';
                errorDetail = 'La licencia no corresponde a este equipo. Copia tu Hardware ID y envíalo a soporte para obtener una licencia actualizada.';
            }
            else if (result.gate2 === false && result.error?.includes('GATE2')) {
                errorTitle = 'Licencia inválida';
                errorDetail = 'El archivo de licencia no tiene una firma válida. Contacta con soporte para obtener una licencia legítima.';
            }
            else if (result.error?.includes('TAMPER')) {
                errorTitle = 'Integridad comprometida';
                errorDetail = 'Se detectó una modificación no autorizada. Reinstala la aplicación o contacta con soporte.';
            }
            else {
                errorTitle = 'Licencia no encontrada';
                errorDetail = 'Carga un archivo .luxlicense válido para activar LuxSync.';
            }
            const detectedHwId = result.detectedHwId || fallbackHwId;
            // ── IPC handlers para la pantalla de activación ──
            ipcMain.handle('activation:getData', () => ({
                hwid: detectedHwId,
                errorTitle,
                errorDetail,
            }));
            ipcMain.handle('activation:copyHwid', () => {
                clipboard.writeText(detectedHwId);
            });
            ipcMain.handle('activation:loadLicense', async () => {
                const { canceled, filePaths } = await dialog.showOpenDialog({
                    title: 'Seleccionar archivo de licencia',
                    filters: [{ name: 'LuxSync License', extensions: ['luxlicense'] }],
                    properties: ['openFile'],
                });
                if (canceled || filePaths.length === 0) {
                    return { cancelled: true };
                }
                const selectedPath = filePaths[0];
                // Validar el archivo seleccionado
                if (validatorLoadError) {
                    return { valid: false, reason: 'El sistema de validación no está disponible.' };
                }
                const checkResult = licenseValidator.validateLicense(selectedPath);
                if (!checkResult.valid) {
                    let reason = 'Archivo de licencia inválido.';
                    if (checkResult.gate1 === false)
                        reason = 'La licencia no corresponde a este hardware.';
                    else if (checkResult.gate2 === false)
                        reason = 'La firma de la licencia no es válida.';
                    return { valid: false, reason };
                }
                // Licencia válida — copiar a la ubicación canónica
                try {
                    if (!fs.existsSync(licenseDir)) {
                        fs.mkdirSync(licenseDir, { recursive: true });
                    }
                    fs.copyFileSync(selectedPath, licensePath);
                }
                catch {
                    return { valid: false, reason: 'No se pudo copiar la licencia a la carpeta de la aplicación.' };
                }
                return {
                    valid: true,
                    client: checkResult.client,
                    tier: checkResult.tier,
                };
            });
            ipcMain.on('activation:restart', () => {
                app.relaunch();
                app.exit(0);
            });
            ipcMain.on('activation:quit', () => {
                app.quit();
            });
            // ── Crear ventana de activación ──
            const activationWindow = new BrowserWindow({
                width: 600,
                height: 520,
                frame: false,
                resizable: false,
                title: 'LuxSync — Activación',
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    preload: path.join(__dirname, 'license', 'preload-activation.js'),
                },
            });
            activationWindow.loadFile(path.join(__dirname, 'license', 'activation.html'));
            activationWindow.on('closed', () => {
                app.quit();
            });
            return; // No continuar con el boot normal
        }
        // ═══════════════════════════════════════════════════════════════════════════
        // 🔒 WAVE 2490: Capture license tier from validation result
        // ═══════════════════════════════════════════════════════════════════════════
        if (result.tier === 'DJ_FOUNDER' || result.tier === 'FULL_SUITE') {
            currentLicenseTier = result.tier;
        }
        // ═══════════════════════════════════════════════════════════════════════════
        // 🔑 OBSIDIAN VAULT: Activation banner — so you know it's real
        // ═══════════════════════════════════════════════════════════════════════════
        const tierLabel = currentLicenseTier === 'FULL_SUITE' ? 'FULL SUITE ★' : 'DJ FOUNDER';
        const tierColor = currentLicenseTier === 'FULL_SUITE' ? '\x1b[36m' : '\x1b[33m';
        console.log('\x1b[32m');
        console.log('  ╔══════════════════════════════════════════════╗');
        console.log('  ║        🔑  OBSIDIAN VAULT — UNLOCKED         ║');
        console.log('  ╠══════════════════════════════════════════════╣');
        console.log(`  ║  Cliente : \x1b[97m${String(result.client ?? 'Unknown').padEnd(36)}\x1b[32m║`);
        console.log(`  ║  Tier    : ${tierColor}${tierLabel.padEnd(36)}\x1b[32m║`);
        console.log(`  ║  HWID    : \x1b[90m${String(result.hwid ?? '—').padEnd(36)}\x1b[32m║`);
        console.log('  ╚══════════════════════════════════════════════╝');
        console.log('\x1b[0m');
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // WAVE 367: Load preferences (ConfigManagerV2 - NO FIXTURES)
    // ═══════════════════════════════════════════════════════════════════════════
    const { config: preferences, legacyFixtures } = configManager.load();
    // If legacy fixtures were found (V1 → V2 migration), they need to be saved to ShowFileV2
    if (legacyFixtures.length > 0) {
        console.warn(`[Main] MIGRATION: ${legacyFixtures.length} legacy fixtures detected — will migrate to ShowFileV2`);
        // Legacy fixtures are now extracted - ConfigManagerV2 has already saved without them
        // The renderer will handle migration via stageStore.loadFromDisk() → autoMigrate()
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // WAVE 255: LA BIBLIOTECA - Load fixture definitions from luxsync/librerias
    // WAVE 387: THE LIBRARY PATHFINDER - Setup custom library path in userData
    // WAVE 1114: PATHFINDER V2 - Multi-path search for system library
    // ═══════════════════════════════════════════════════════════════════════════
    const fs = await import('fs');
    // WAVE 1114: PATHFINDER - Search multiple locations for system library
    // Order: Root librerias → Legacy dev → Electron packaged → Dev fallbacks
    const candidatePaths = [
        path.join(process.cwd(), '../librerias'), // Root: LuxSync/librerias (desde electron-app)
        path.join(process.cwd(), 'librerias'), // Legacy Prod/Dev
        path.join(process.cwd(), 'resources/librerias'), // Electron Packaged
        path.join(__dirname, '../../librerias'), // Dev fallback (from dist-electron)
        path.join(__dirname, '../../../librerias'), // Another dev fallback
        path.join(app.getPath('userData'), 'librerias'), // Prod: userData copy
    ];
    // WAVE 2098: Boot silence — PATHFINDER verbose scan removed
    let factoryLibraryPath = '';
    for (const candidate of candidatePaths) {
        if (fs.existsSync(candidate)) {
            const files = fs.readdirSync(candidate).filter((f) => f.endsWith('.fxt') || f.endsWith('.json'));
            if (files.length > 0) {
                factoryLibraryPath = candidate;
                break;
            }
        }
    }
    if (!factoryLibraryPath) {
        console.error('[Library] ⛔ CRITICAL: No system library found in any candidate path!');
        console.error('[Library] ⛔ Candidates searched:', candidatePaths);
        // Fallback to first candidate for error display purposes
        factoryLibraryPath = candidatePaths[0];
    }
    // Custom library path (user's custom fixtures and edited definitions)
    const customLibraryPath = path.join(app.getPath('userData'), 'fixtures');
    // WAVE 390.5: Store paths globally for rescanAllLibraries()
    factoryLibPath = factoryLibraryPath;
    customLibPath = customLibraryPath;
    // WAVE 387 STEP 2: Auto-create custom library folder
    // (fs already imported above in PATHFINDER section)
    if (!fs.existsSync(customLibraryPath)) {
        fs.mkdirSync(customLibraryPath, { recursive: true });
        // WAVE 387 STEP 2 BONUS: Copy factory fixtures to custom library if empty
        if (fs.existsSync(factoryLibraryPath)) {
            const factoryFiles = fs.readdirSync(factoryLibraryPath);
            let copiedCount = 0;
            for (const file of factoryFiles) {
                if (file.endsWith('.fxt') || file.endsWith('.json')) {
                    fs.copyFileSync(path.join(factoryLibraryPath, file), path.join(customLibraryPath, file));
                    copiedCount++;
                }
            }
        }
    }
    // WAVE 387 STEP 3: Configure FXTParser with custom library path
    fxtParser.setLibraryPath(customLibraryPath);
    // WAVE 390.5: Use unified rescanAllLibraries() for initial load
    await rescanAllLibraries();
    if (fixtureLibrary.length === 0) {
        console.warn('[Library] ⚠️ No fixture definitions found in any library');
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // WAVE 367: patchedFixtures now loaded via StagePersistence (ShowFileV2)
    // The renderer calls stageStore.loadFromDisk() which triggers IPC lux:stage:load
    // For now, patchedFixtures[] starts empty - renderer will hydrate it
    // ═══════════════════════════════════════════════════════════════════════════
    // NOTE: Legacy startup that loaded from ConfigManager is REMOVED
    // Fixtures now come from ShowFileV2 via stageStore + StagePersistence
    // ═══════════════════════════════════════════════════════════════════════════
    // 🔥 WAVE 1008.5: Initialize Titan BEFORE creating window
    // This ensures IPC handlers are registered BEFORE renderer loads and sends IPCs
    // ═══════════════════════════════════════════════════════════════════════════
    await initTitan();
    createWindow();
    // ═══════════════════════════════════════════════════════════════════════════
    // WAVE 367: TitanOrchestrator fixture injection happens from renderer
    // When stageStore loads ShowFileV2, it syncs to main process via IPC
    // ═══════════════════════════════════════════════════════════════════════════
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
// ============================================================================
// ============================================================================
// ⚡ WAVE 2495: THE SILVER BULLET — Shutdown function
// Extraída como función standalone para ser llamada desde mainWindow.on('closed').
// window-all-closed NO es fiable cuando existen ventanas ocultas (phantomWorker,
// background BrowserWindows). doShutdown() ataca directamente desde la puerta
// principal: si mainWindow cae, todo el proceso cae con ella.
// ============================================================================
let isShuttingDown = false;
function doShutdown() {
    if (isShuttingDown)
        return; // Re-entry guard — solo un shutdown simultáneo
    isShuttingDown = true;
    // 💀 DEAD MAN'S SWITCH: 1 segundo máximo —si el cleanup se atasca, kill total
    const deadManSwitch = setTimeout(() => { app.exit(0); }, 1000);
    deadManSwitch.unref(); // El timer no mantiene vivo el event loop
    const shutdown = async () => {
        // 1. Stop Titan DMX loop: blackout + 30ms FTDI drain (async, must await)
        if (titanOrchestrator) {
            try {
                await titanOrchestrator.stop();
            }
            catch { /* non-fatal */ }
        }
        // 2. Close ArtNet UDP socket — keeps the Node event loop alive if unclosed
        try {
            await artNetDriver.stop();
        }
        catch { /* non-fatal */ }
        // 3. Kill Phantom Worker thread
        destroyPhantomWorker();
        // 4. Clean up IPC channels
        try {
            await cleanupChronosIPC();
        }
        catch { /* non-fatal */ }
        cleanupPlaybackIPC();
        // 5. Flush config to disk
        configManager.forceSave();
    };
    // app.exit(0) = C++ synchronous kill — bypasses Node event loop entirely
    shutdown().finally(() => app.exit(0));
}
// Guard secundario: si por algún motivo window-all-closed llega antes
// (e.g. ventana oculta se cierra primero), que también ejecute el shutdown.
app.on('window-all-closed', () => { doShutdown(); });
// Guard terciario: before-quit como última red de seguridad
app.on('before-quit', (e) => {
    if (!isShuttingDown) {
        e.preventDefault();
        doShutdown();
    }
});
// Basic IPC handlers that need to stay in main
ipcMain.handle('app:getVersion', () => app.getVersion());
// ============================================================================
// 🪟 WINDOW CONTROLS IPC - Custom title bar
// ============================================================================
ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize();
});
ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize();
    }
    else {
        mainWindow?.maximize();
    }
});
ipcMain.handle('window:close', () => {
    mainWindow?.close();
});
ipcMain.handle('window:isMaximized', () => {
    return mainWindow?.isMaximized() ?? false;
});
// Notify renderer when maximize state changes
app.on('ready', () => {
    // Listeners are added after mainWindow is created — see createWindow setup below
});
ipcMain.handle('audio:getDesktopSources', async () => {
    try {
        const sources = await desktopCapturer.getSources({
            types: ['window', 'screen'],
            thumbnailSize: { width: 0, height: 0 }
        });
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
// ── WAVE 2434: TELEMETRY LATINO 4.1 — IPC handlers ──────────────────────────
// Uso desde DevTools renderer: await window.luxDebug.telemetry.export()
ipcMain.handle('telemetry:lt41:export', (_event, outputPath) => {
    try {
        // Si no se pasa outputPath, calcula la ruta absoluta desde app.getAppPath()
        // app.getAppPath() en dev = .../electron-app  → sube un nivel al repo raíz
        const resolvedPath = outputPath ?? path.join(app.getAppPath(), '..', 'docs', 'logs', 'latinocalib41.md');
        const count = latinoEngine41Telemetry.exportToFile(resolvedPath);
        return { success: true, framesExported: count, path: resolvedPath };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[TELEMETRY] exportToFile failed:', msg);
        return { success: false, error: msg };
    }
});
ipcMain.handle('telemetry:lt41:stop', () => {
    latinoEngine41Telemetry.setTelemetryEnabled(false);
    return { success: true };
});
ipcMain.handle('telemetry:lt41:start', () => {
    latinoEngine41Telemetry.setTelemetryEnabled(true);
    return { success: true };
});
ipcMain.handle('telemetry:lt41:flush', () => {
    latinoEngine41Telemetry.flushBuffer();
    return { success: true };
});
// ─────────────────────────────────────────────────────────────────────────────
// WAVE 2098: Boot silence — module load log removed
