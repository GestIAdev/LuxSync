/**
 * WAVE 243.5: IPC HANDLERS - SIMPLIFIED V2
 *
 * Centraliza todos los handlers IPC.
 * Recibe dependencias directamente desde main.ts V2.
 *
 * @module IPCHandlers
 */
import { ipcMain } from 'electron';
/**
 * Registra todos los handlers IPC
 */
export function setupIPCHandlers(deps) {
    console.log('[IPC] Setting up IPC handlers (WAVE 243.5 V2)');
    setupSeleneLuxHandlers(deps);
    setupEffectHandlers(deps);
    setupOverrideHandlers(deps);
    setupConfigHandlers(deps);
    setupFixtureHandlers(deps);
    // setupShowHandlers PURGED - WAVE 365: Use StageIPCHandlers instead
    setupDMXHandlers(deps);
    setupArtNetHandlers(deps);
    console.log('[IPC] All IPC handlers registered');
}
// =============================================================================
// TITAN ORCHESTRATOR HANDLERS (WAVE 254: THE SPARK)
// =============================================================================
function setupSeleneLuxHandlers(deps) {
    const { titanOrchestrator, configManager } = deps;
    ipcMain.handle('lux:start', () => {
        console.log('[IPC] lux:start - TitanOrchestrator active');
        if (titanOrchestrator && !titanOrchestrator.getState().isRunning) {
            titanOrchestrator.start();
        }
        const savedConfig = configManager.getConfig();
        const savedGain = savedConfig?.audio?.inputGain ?? 1.0;
        return { success: true, inputGain: savedGain };
    });
    ipcMain.handle('lux:stop', () => {
        console.log('[IPC] lux:stop - TitanOrchestrator stopping');
        if (titanOrchestrator) {
            titanOrchestrator.stop();
        }
        return { success: true };
    });
    ipcMain.handle('lux:getState', () => {
        if (titanOrchestrator) {
            return titanOrchestrator.getState();
        }
        return null;
    });
    ipcMain.handle('lux:setMode', (_event, mode) => {
        console.log('[IPC] lux:setMode:', mode);
        if (titanOrchestrator) {
            titanOrchestrator.setMode(mode);
        }
        return { success: true };
    });
    ipcMain.handle('lux:setUseBrain', (_event, enabled) => {
        console.log('[IPC] lux:setUseBrain:', enabled);
        if (titanOrchestrator) {
            titanOrchestrator.setUseBrain(enabled);
        }
        return { success: true };
    });
    ipcMain.handle('lux:setInputGain', (_event, gain) => {
        console.log('[IPC] lux:setInputGain:', gain);
        if (titanOrchestrator) {
            titanOrchestrator.setInputGain(gain);
        }
        configManager.updateConfig({ audio: { inputGain: gain } });
        return { success: true };
    });
    ipcMain.handle('lux:setVibe', (_event, vibeId) => {
        console.log('[IPC] lux:setVibe:', vibeId);
        if (titanOrchestrator) {
            titanOrchestrator.setVibe(vibeId);
        }
        return { success: true };
    });
    ipcMain.handle('lux:setLivingPalette', (_event, palette) => {
        console.log('[IPC] lux:setLivingPalette:', palette);
        // TODO: Implement in TitanOrchestrator
        return { success: true };
    });
    ipcMain.handle('lux:setMovementPattern', (_event, pattern) => {
        console.log('[IPC] lux:setMovementPattern:', pattern);
        // TODO: Implement in TitanOrchestrator
        return { success: true };
    });
    ipcMain.handle('lux:setMovementSpeed', (_event, speed) => {
        // TODO: Implement in TitanOrchestrator
        return { success: true };
    });
    ipcMain.handle('lux:setMovementIntensity', (_event, intensity) => {
        // TODO: Implement in TitanOrchestrator
        return { success: true };
    });
    ipcMain.handle('lux:setGlobalColorParams', (_event, params) => {
        // TODO: Implement in TitanOrchestrator
        return { success: true };
    });
    ipcMain.handle('lux:forceMutation', () => {
        // TODO: Implement in TitanOrchestrator
        return { success: true };
    });
    ipcMain.handle('lux:resetMemory', () => {
        // TODO: Implement in TitanOrchestrator
        return { success: true };
    });
    // WAVE 254: Audio handler
    ipcMain.handle('lux:audioFrame', (_event, data) => {
        if (titanOrchestrator) {
            titanOrchestrator.processAudioFrame(data);
        }
        return true;
    });
    // =========================================================================
    // WAVE 250: NERVE SPLICING - Canales kebab-case estándar
    // WAVE 252: SILENCE - Logs eliminados para reducir spam
    // WAVE 254: Migrado a TitanOrchestrator
    // =========================================================================
    // Audio frame (kebab-case - lo que envía preload.ts)
    ipcMain.handle('lux:audio-frame', (_event, data) => {
        if (titanOrchestrator) {
            titanOrchestrator.processAudioFrame(data);
        }
        return { success: true };
    });
    // 🩸 WAVE 259: RAW VEIN - Audio buffer crudo para Trinity FFT
    // 🔥 WAVE 264.8: Cambiado de handle() a on() para FIRE-AND-FORGET
    // handle() requiere devolver una Promise y crea backpressure a 60fps
    // on() es unidireccional - procesa sin esperar respuesta
    let audioBufferCallCount = 0;
    let lastLogTime = Date.now();
    ipcMain.on('lux:audio-buffer', (_event, buffer) => {
        audioBufferCallCount++;
        // 🔍 WAVE 264.7: Log AGRESIVO cada 2 segundos (basado en tiempo, no frames)
        const now = Date.now();
        if (now - lastLogTime >= 2000) {
            const titanState = titanOrchestrator?.getState();
            console.log(`[IPC 📡] audioBuffer #${audioBufferCallCount} | ` +
                `titan.running=${titanState?.isRunning ?? 'null'} | ` +
                `size=${buffer?.byteLength || 0}`);
            lastLogTime = now;
        }
        if (titanOrchestrator && buffer) {
            const float32 = new Float32Array(buffer);
            titanOrchestrator.processAudioBuffer(float32);
        }
        else if (!titanOrchestrator) {
            console.warn('[IPC ⚠️] audioBuffer: titanOrchestrator is null!');
        }
        else if (!buffer) {
            console.warn('[IPC ⚠️] audioBuffer: buffer is null!');
        }
        // 🔥 WAVE 264.8: NO return - fire-and-forget
    });
    // Get current vibe
    ipcMain.handle('lux:get-vibe', async () => {
        if (titanOrchestrator) {
            const state = titanOrchestrator.getState();
            return { success: true, vibeId: state.currentVibe ?? 'idle' };
        }
        return { success: true, vibeId: 'idle' };
    });
    // Get full state (SeleneTruth) - WAVE 254: Migrated to TitanOrchestrator state
    ipcMain.handle('lux:get-full-state', async () => {
        if (titanOrchestrator) {
            const state = titanOrchestrator.getState();
            return {
                dmx: { isConnected: false, status: 'pending', driver: null, port: null },
                selene: {
                    isRunning: state.isRunning,
                    mode: 'auto',
                    brainMode: 'reactive',
                    paletteSource: 'vibe',
                    consciousness: null
                },
                fixtures: [],
                audio: { hasWorkers: true },
                titan: state
            };
        }
        // Fallback minimal state
        return {
            dmx: { isConnected: false, status: 'disconnected', driver: null, port: null },
            selene: { isRunning: false, mode: null, brainMode: null, paletteSource: null, consciousness: null },
            fixtures: [],
            audio: { hasWorkers: false }
        };
    });
    // WAVE 252: Alias for get-full-state - WAVE 254: Use TitanOrchestrator
    ipcMain.handle('lux:get-state', async () => {
        if (titanOrchestrator) {
            return titanOrchestrator.getState();
        }
        return null;
    });
    // WAVE 252: Save config
    ipcMain.handle('lux:save-config', async (_event, config) => {
        if (configManager?.saveConfig) {
            await configManager.saveConfig(config);
            return { success: true };
        }
        return { success: false, error: 'ConfigManager not available' };
    });
}
// =============================================================================
// EFFECT HANDLERS
// =============================================================================
function setupEffectHandlers(deps) {
    const { effectsEngine } = deps;
    ipcMain.handle('lux:triggerEffect', (_event, name, params) => {
        if (effectsEngine?.triggerEffect) {
            const id = effectsEngine.triggerEffect(name, params);
            return { success: true, id };
        }
        return { success: false };
    });
    ipcMain.handle('lux:cancelEffect', (_event, id) => {
        if (effectsEngine?.cancelEffect) {
            effectsEngine.cancelEffect(id);
        }
        return { success: true };
    });
    ipcMain.handle('lux:cancelAllEffects', () => {
        if (effectsEngine?.cancelAllEffects) {
            effectsEngine.cancelAllEffects();
        }
        return { success: true };
    });
    ipcMain.handle('lux:blackout', (_event, enabled) => {
        console.log('[IPC] lux:blackout:', enabled);
        // TODO: Implement blackout via TitanOrchestrator
        return { success: true };
    });
    ipcMain.handle('lux:strobe', (_event, enabled, speed) => {
        console.log('[IPC] lux:strobe:', enabled, speed);
        // TODO: Implement strobe via TitanOrchestrator
        return { success: true };
    });
}
// =============================================================================
// OVERRIDE HANDLERS
// =============================================================================
function setupOverrideHandlers(deps) {
    const { manualOverrides, getMainWindow } = deps;
    ipcMain.handle('lux:setManualOverride', (_event, fixtureId, overrides) => {
        manualOverrides.set(fixtureId, overrides);
        return { success: true };
    });
    ipcMain.handle('lux:clearManualOverride', (_event, fixtureId) => {
        manualOverrides.delete(fixtureId);
        return { success: true };
    });
    ipcMain.handle('lux:clearAllManualOverrides', () => {
        manualOverrides.clear();
        return { success: true };
    });
    ipcMain.handle('lux:getManualOverrides', () => {
        return Object.fromEntries(manualOverrides);
    });
}
// =============================================================================
// CONFIG HANDLERS
// =============================================================================
function setupConfigHandlers(deps) {
    const { configManager } = deps;
    ipcMain.handle('config:get', () => {
        return configManager.getConfig();
    });
    ipcMain.handle('config:set', (_event, config) => {
        configManager.updateConfig(config);
        return { success: true };
    });
    ipcMain.handle('config:save', () => {
        configManager.forceSave();
        return { success: true };
    });
}
// =============================================================================
// FIXTURE HANDLERS
// =============================================================================
function setupFixtureHandlers(deps) {
    const { fxtParser, getPatchedFixtures, setPatchedFixtures, getFixtureLibrary, setFixtureLibrary, autoAssignZone, resetZoneCounters, recalculateZoneCounters, configManager, getMainWindow } = deps;
    ipcMain.handle('fixtures:scanLibrary', async (_event, folderPath) => {
        try {
            const fixtures = await fxtParser.scanFolder(folderPath);
            setFixtureLibrary(fixtures);
            return { success: true, fixtures };
        }
        catch (err) {
            console.error('[IPC] fixtures:scanLibrary error:', err);
            return { success: false, error: String(err) };
        }
    });
    ipcMain.handle('fixtures:getLibrary', () => {
        return getFixtureLibrary();
    });
    ipcMain.handle('fixtures:getPatch', () => {
        return getPatchedFixtures();
    });
    ipcMain.handle('fixtures:addToPatch', (_event, fixture, dmxAddress, universe) => {
        const patchedFixtures = getPatchedFixtures();
        const zone = autoAssignZone(fixture.type, fixture.name);
        const patched = {
            ...fixture,
            dmxAddress,
            universe,
            zone
        };
        patchedFixtures.push(patched);
        configManager.updateConfig({ patchedFixtures });
        const mainWindow = getMainWindow();
        if (mainWindow) {
            mainWindow.webContents.send('lux:fixtures-loaded', patchedFixtures);
        }
        return { success: true, fixture: patched };
    });
    ipcMain.handle('fixtures:removeFromPatch', (_event, fixtureId) => {
        const patchedFixtures = getPatchedFixtures();
        const index = patchedFixtures.findIndex((f) => f.id === fixtureId);
        if (index !== -1) {
            patchedFixtures.splice(index, 1);
            recalculateZoneCounters();
            configManager.updateConfig({ patchedFixtures });
            const mainWindow = getMainWindow();
            if (mainWindow) {
                mainWindow.webContents.send('lux:fixtures-loaded', patchedFixtures);
            }
            return { success: true };
        }
        return { success: false, error: 'Fixture not found' };
    });
    ipcMain.handle('fixtures:clearPatch', () => {
        setPatchedFixtures([]);
        resetZoneCounters();
        configManager.updateConfig({ patchedFixtures: [] });
        const mainWindow = getMainWindow();
        if (mainWindow) {
            mainWindow.webContents.send('lux:fixtures-loaded', []);
        }
        return { success: true };
    });
    ipcMain.handle('fixtures:updateAddress', (_event, fixtureId, dmxAddress, universe) => {
        const patchedFixtures = getPatchedFixtures();
        const fixture = patchedFixtures.find((f) => f.id === fixtureId);
        if (fixture) {
            fixture.dmxAddress = dmxAddress;
            fixture.universe = universe;
            configManager.updateConfig({ patchedFixtures });
            return { success: true };
        }
        return { success: false, error: 'Fixture not found' };
    });
    // ═══════════════════════════════════════════════════════════════════════════
    // WAVE 256: LUX ALIASES - Handlers con prefijo lux: para compatibilidad
    // El preload.ts usa lux:* pero los handlers originales son fixtures:*
    // ═══════════════════════════════════════════════════════════════════════════
    // 🔍 WAVE 255.5: Scan fixtures - alias para fixtures:scanLibrary
    // Si no se pasa path, retorna la librería ya cargada (desde main.ts WAVE 255)
    ipcMain.handle('lux:scan-fixtures', async (_event, customPath) => {
        try {
            // If no custom path, just return the already-loaded library
            if (!customPath) {
                const cached = getFixtureLibrary();
                console.log(`[IPC] lux:scan-fixtures returning cached library: ${cached.length} fixtures`);
                return { success: true, fixtures: cached };
            }
            // Scan custom path
            console.log('[IPC] lux:scan-fixtures scanning:', customPath);
            const definitions = await fxtParser.scanFolder(customPath);
            setFixtureLibrary(definitions);
            console.log(`[IPC] lux:scan-fixtures found ${definitions.length} fixtures`);
            return { success: true, fixtures: definitions };
        }
        catch (err) {
            console.error('[IPC] lux:scan-fixtures error:', err);
            return { success: true, fixtures: getFixtureLibrary() }; // Return cached library on error
        }
    });
    ipcMain.handle('lux:get-patched-fixtures', () => {
        return { success: true, fixtures: getPatchedFixtures() };
    });
    ipcMain.handle('lux:get-fixture-library', () => {
        return { success: true, fixtures: getFixtureLibrary() };
    });
    // ═══════════════════════════════════════════════════════════════════════════
    // 🔥 WAVE 384: GET FIXTURE DEFINITION - Returns FULL fixture data with channels
    // This is the missing link that caused "fixtures nacen genéricos"
    // ═══════════════════════════════════════════════════════════════════════════
    ipcMain.handle('lux:getFixtureDefinition', (_event, profileId) => {
        try {
            const library = getFixtureLibrary();
            const definition = library.find((f) => f.id === profileId);
            if (!definition) {
                console.warn(`[IPC] lux:getFixtureDefinition: Profile "${profileId}" not found in library`);
                return { success: false, error: `Profile "${profileId}" not found` };
            }
            // Return the COMPLETE fixture definition from library
            // This includes channels[], capabilities, hasMovementChannels, etc.
            console.log(`[IPC] 🔥 lux:getFixtureDefinition: Returning "${definition.name}" (${definition.channelCount}ch, type: ${definition.type})`);
            return {
                success: true,
                definition: {
                    id: definition.id,
                    name: definition.name,
                    manufacturer: definition.manufacturer,
                    type: definition.type,
                    channelCount: definition.channelCount,
                    channels: definition.channels || [],
                    filePath: definition.filePath,
                    // Capabilities from FXTParser
                    hasMovementChannels: definition.hasMovementChannels || false,
                    has16bitMovement: definition.has16bitMovement || false,
                    hasColorMixing: definition.hasColorMixing || false,
                    hasColorWheel: definition.hasColorWheel || false,
                    confidence: definition.confidence,
                    detectionMethod: definition.detectionMethod
                }
            };
        }
        catch (err) {
            console.error('[IPC] lux:getFixtureDefinition error:', err);
            return { success: false, error: String(err) };
        }
    });
    ipcMain.handle('lux:patch-fixture', async (_event, data) => {
        const library = getFixtureLibrary();
        const fixture = library.find((f) => f.id === data.fixtureId);
        if (!fixture) {
            return { success: false, error: 'Fixture not found in library' };
        }
        const patchedFixtures = getPatchedFixtures();
        const zone = autoAssignZone(fixture.type, fixture.name);
        const patched = {
            ...fixture,
            dmxAddress: data.dmxAddress,
            universe: data.universe || 0,
            zone
        };
        patchedFixtures.push(patched);
        configManager.updateConfig({ patchedFixtures });
        const mainWindow = getMainWindow();
        if (mainWindow) {
            mainWindow.webContents.send('lux:fixtures-loaded', patchedFixtures);
        }
        return { success: true, fixture: patched };
    });
    ipcMain.handle('lux:unpatch-fixture', (_event, dmxAddress) => {
        const patchedFixtures = getPatchedFixtures();
        const index = patchedFixtures.findIndex((f) => f.dmxAddress === dmxAddress);
        if (index !== -1) {
            patchedFixtures.splice(index, 1);
            recalculateZoneCounters();
            configManager.updateConfig({ patchedFixtures });
            const mainWindow = getMainWindow();
            if (mainWindow) {
                mainWindow.webContents.send('lux:fixtures-loaded', patchedFixtures);
            }
            return { success: true };
        }
        return { success: false, error: 'Fixture not found at that address' };
    });
    // ✏️ WAVE 256: Editar fixture patcheado - ALL fields
    ipcMain.handle('lux:edit-fixture', (_event, data) => {
        const patchedFixtures = getPatchedFixtures();
        const fixture = patchedFixtures.find((f) => f.dmxAddress === data.originalDmxAddress);
        if (!fixture) {
            return { success: false, error: `Fixture not found at DMX ${data.originalDmxAddress}` };
        }
        // Check for address collision (if address changed)
        if (data.newDmxAddress !== data.originalDmxAddress) {
            const collision = patchedFixtures.find((f) => f.dmxAddress === data.newDmxAddress);
            if (collision) {
                return { success: false, error: `DMX address ${data.newDmxAddress} is already in use` };
            }
        }
        // Update basic fields
        fixture.dmxAddress = data.newDmxAddress;
        if (data.universe !== undefined) {
            fixture.universe = data.universe;
        }
        if (data.name !== undefined) {
            fixture.name = data.name;
        }
        if (data.zone !== undefined) {
            fixture.zone = data.zone;
        }
        // Update physical installation config
        if (data.physics) {
            fixture.orientation = data.physics.installationType || fixture.orientation;
            fixture.invertPan = data.physics.invert?.pan ?? fixture.invertPan;
            fixture.invertTilt = data.physics.invert?.tilt ?? fixture.invertTilt;
            fixture.swapXY = data.physics.swapXY ?? fixture.swapXY;
        }
        // Recalculate and save
        recalculateZoneCounters();
        configManager.updateConfig({ patchedFixtures });
        const mainWindow = getMainWindow();
        if (mainWindow) {
            mainWindow.webContents.send('lux:fixtures-loaded', patchedFixtures);
        }
        console.log(`✏️ [IPCHandlers] Fixture edited: ${fixture.name} @ DMX ${data.newDmxAddress}`);
        return { success: true, fixture };
    });
    ipcMain.handle('lux:clear-patch', () => {
        setPatchedFixtures([]);
        resetZoneCounters();
        configManager.updateConfig({ patchedFixtures: [] });
        const mainWindow = getMainWindow();
        if (mainWindow) {
            mainWindow.webContents.send('lux:fixtures-loaded', []);
        }
        return { success: true };
    });
    ipcMain.handle('lux:force-fixture-type', (_event, dmxAddress, newType) => {
        const patchedFixtures = getPatchedFixtures();
        const fixture = patchedFixtures.find((f) => f.dmxAddress === dmxAddress);
        if (fixture) {
            fixture.type = newType;
            fixture.manualOverride = newType;
            configManager.updateConfig({ patchedFixtures });
            return { success: true };
        }
        return { success: false, error: 'Fixture not found' };
    });
    ipcMain.handle('lux:set-installation', (_event, type) => {
        configManager.updateConfig({ installation: type });
        console.log(`[IPC] Installation type set to: ${type}`);
        return { success: true };
    });
    ipcMain.handle('lux:new-show', () => {
        setPatchedFixtures([]);
        resetZoneCounters();
        configManager.updateConfig({ patchedFixtures: [] });
        const mainWindow = getMainWindow();
        if (mainWindow) {
            mainWindow.webContents.send('lux:fixtures-loaded', []);
        }
        console.log('[IPC] New show created - patch cleared');
        return { success: true };
    });
    ipcMain.handle('lux:save-fixture-definition', async (_event, definition) => {
        try {
            const fs = await import('fs');
            const path = await import('path');
            const libraryPath = fxtParser.getLibraryPath ? fxtParser.getLibraryPath() : '';
            if (!libraryPath) {
                return { success: false, error: 'Library path not configured' };
            }
            const fileName = `${(definition.name || 'custom').replace(/[^a-z0-9]/gi, '_')}.json`;
            const filePath = path.join(libraryPath, fileName);
            fs.writeFileSync(filePath, JSON.stringify(definition, null, 2), 'utf-8');
            console.log(`[IPC] Saved fixture definition: ${fileName}`);
            return { success: true, filePath };
        }
        catch (err) {
            console.error('[IPC] Failed to save fixture definition:', err);
            return { success: false, error: String(err) };
        }
    });
}
// =============================================================================
// SHOW HANDLERS - WAVE 365: PURGED
// Legacy ShowManager eliminated. All persistence now via StagePersistence + StageIPCHandlers
// Channels 'shows:*' removed. Use 'lux:stage:*' channels instead.
// =============================================================================
// =============================================================================
// DMX HANDLERS
// =============================================================================
function setupDMXHandlers(deps) {
    const { universalDMX, getMainWindow } = deps;
    ipcMain.handle('dmx:getStatus', () => {
        return {
            connected: universalDMX.isConnected,
            interface: universalDMX.currentDevice || 'none'
        };
    });
    ipcMain.handle('dmx:scan', async () => {
        try {
            const devices = await universalDMX.scanDevices();
            return { success: true, devices };
        }
        catch (err) {
            return { success: false, error: String(err) };
        }
    });
    ipcMain.handle('dmx:connect', async (_event, devicePath) => {
        try {
            await universalDMX.connect(devicePath);
            const mainWindow = getMainWindow();
            if (mainWindow) {
                mainWindow.webContents.send('dmx:connected', universalDMX.currentDevice);
            }
            return { success: true };
        }
        catch (err) {
            return { success: false, error: String(err) };
        }
    });
    ipcMain.handle('dmx:disconnect', async () => {
        try {
            await universalDMX.disconnect();
            const mainWindow = getMainWindow();
            if (mainWindow) {
                mainWindow.webContents.send('dmx:disconnected');
            }
            return { success: true };
        }
        catch (err) {
            return { success: false, error: String(err) };
        }
    });
    ipcMain.handle('dmx:sendChannel', (_event, channel, value) => {
        universalDMX.setChannel(channel, value);
        return { success: true };
    });
    ipcMain.handle('dmx:sendFrame', (_event, frame) => {
        universalDMX.sendFrame(frame);
        return { success: true };
    });
}
// =============================================================================
// ARTNET HANDLERS
// =============================================================================
function setupArtNetHandlers(deps) {
    const { artNetDriver } = deps;
    ipcMain.handle('artnet:getStatus', () => {
        return artNetDriver.getStatus();
    });
    ipcMain.handle('artnet:start', async (_event, config) => {
        try {
            if (config) {
                artNetDriver.configure(config);
            }
            const success = await artNetDriver.start();
            return { success, status: artNetDriver.getStatus() };
        }
        catch (err) {
            return { success: false, error: String(err) };
        }
    });
    ipcMain.handle('artnet:stop', async () => {
        try {
            await artNetDriver.stop();
            return { success: true, status: artNetDriver.getStatus() };
        }
        catch (err) {
            return { success: false, error: String(err) };
        }
    });
    ipcMain.handle('artnet:configure', (_event, config) => {
        try {
            artNetDriver.configure(config);
            return { success: true, config: artNetDriver.currentConfig };
        }
        catch (err) {
            return { success: false, error: String(err) };
        }
    });
}
