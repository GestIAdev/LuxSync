/**
 * WAVE 243.5: IPC HANDLERS - SIMPLIFIED V2
 *
 * Centraliza todos los handlers IPC.
 * Recibe dependencias directamente desde main.ts V2.
 *
 * âš’ï¸ WAVE 2030.4: Hephaestus integration for curve automation
 *
 * @module IPCHandlers
 */
import { ipcMain } from 'electron';
import { deserializeHephClip } from '../hephaestus/types';
import { HephaestusRuntime } from '../hephaestus/runtime/HephaestusRuntime';
// ðŸ“¡ WAVE 2048: Art-Net Network Discovery
import { getArtNetDiscovery } from '../../hal/drivers/ArtNetDiscovery';
// WAVE 3403: AudioMatrix IPC bridge
import { getTrinity } from '../../workers/TrinityOrchestrator';
// âš’ï¸ WAVE 2030.18: Singleton runtime for .lfx execution
let hephaestusRuntime = null;
/**
 * âš’ï¸ WAVE 2030.18: Get or create the HephaestusRuntime singleton
 * Exported for use by TitanOrchestrator in processFrame()
 */
export function getHephaestusRuntime() {
    if (!hephaestusRuntime) {
        hephaestusRuntime = new HephaestusRuntime();
    }
    return hephaestusRuntime;
}
/**
 * ðŸ›¡ï¸ WAVE 2234: Guard against "Render frame was disposed" crashes.
 * webContents.send() can throw if the renderer is destroyed between
 * the isDestroyed() check and the actual send (race condition at 60fps).
 */
function safeWebSend(win, channel, ...args) {
    if (!win || win.isDestroyed() || !win.webContents || win.webContents.isDestroyed())
        return;
    try {
        win.webContents.send(channel, ...args);
    }
    catch {
        // Renderer disposed mid-flight during reload â€” not a critical error
    }
}
/**
 * Registra todos los handlers IPC
 */
export function setupIPCHandlers(deps) {
    setupSeleneLuxHandlers(deps);
    setupEffectHandlers(deps);
    setupOverrideHandlers(deps);
    setupConfigHandlers(deps);
    setupFixtureHandlers(deps);
    // setupShowHandlers PURGED - WAVE 365: Use StageIPCHandlers instead
    setupDMXHandlers(deps);
    setupArtNetHandlers(deps);
    setupAudioMatrixHandlers(deps);
}
// =============================================================================
// TITAN ORCHESTRATOR HANDLERS (WAVE 254: THE SPARK)
// =============================================================================
function setupSeleneLuxHandlers(deps) {
    const { titanOrchestrator, configManager, getMainWindow } = deps;
    ipcMain.handle('lux:start', () => {
        console.log('[IPC] lux:start - TitanOrchestrator active');
        if (titanOrchestrator && !titanOrchestrator.getState().isRunning) {
            titanOrchestrator.start();
        }
        const savedConfig = configManager.getConfig();
        const savedGain = savedConfig?.audio?.inputGain ?? 1.0;
        return { success: true, inputGain: savedGain };
    });
    ipcMain.handle('lux:stop', async () => {
        if (titanOrchestrator) {
            await titanOrchestrator.stop();
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
    // ðŸ§¬ WAVE 560: Separated consciousness toggle (Layer 1 only - NO BLACKOUT!)
    ipcMain.handle('lux:setConsciousness', (_event, enabled) => {
        console.log('[IPC] lux:setConsciousness:', enabled);
        if (titanOrchestrator) {
            titanOrchestrator.setConsciousnessEnabled(enabled);
        }
        return { success: true };
    });
    // 🌊 WAVE 2401: Liquid Stereo toggle (7-band per-zone envelopes)
    ipcMain.handle('lux:setLiquidStereo', (_event, enabled) => {
        console.log('[IPC] lux:setLiquidStereo:', enabled);
        if (titanOrchestrator) {
            titanOrchestrator.setLiquidStereo(enabled);
        }
        return { success: true };
    });
    // 🌊 WAVE 2432: THE GREAT WIRING — Layout Switch (4.1 / 7.1)
    ipcMain.handle('lux:setLiquidLayout', (_event, mode) => {
        console.log('[IPC] lux:setLiquidLayout:', mode);
        if (titanOrchestrator && (mode === '4.1' || mode === '7.1')) {
            titanOrchestrator.setLiquidLayout(mode);
        }
        return { success: true };
    });
    // 🧨 WAVE 610: FORCE STRIKE - Manual Effect Detonator
    ipcMain.handle('lux:forceStrike', (_event, config) => {
        console.log('[IPC] ðŸ§¨ lux:forceStrike:', config);
        if (titanOrchestrator) {
            titanOrchestrator.forceStrikeNextFrame(config);
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
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ðŸŽ¯ WAVE 2019: THE PULSE - Chronos Timeline â†’ Stage Commands
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    /**
     * ðŸŽ­ chronos:setVibe
     * Called from ChronosIPCBridge when a vibe-change clip is reached.
     * Same as lux:setVibe but with Chronos-specific logging.
     *
     * ðŸŽ¨ WAVE 2019.6: Also forces palette sync to match new Vibe color
     */
    ipcMain.handle('chronos:setVibe', (_event, vibeId) => {
        console.log('[Chronosâ†’Stage] ðŸŽ­ VIBE CHANGE:', vibeId);
        if (titanOrchestrator) {
            // ðŸ” WAVE 2019.8: Log engine state before
            const engine = titanOrchestrator.engine;
            const beforeVibe = engine?.getCurrentVibe?.() || 'unknown';
            console.log(`[Chronosâ†’Stage] ðŸ” Before: engine.vibeManager=${beforeVibe}`);
            // 1. Cambiar la Vibe lÃ³gica (Movimiento/Comportamiento)
            titanOrchestrator.setVibe(vibeId);
            // ðŸ” WAVE 2019.8: Confirm change
            const afterVibe = engine?.getCurrentVibe?.() || 'unknown';
            console.log(`[Chronosâ†’Stage] ðŸ” After: engine.vibeManager=${afterVibe}`);
            // 2. ðŸŽ¨ WAVE 2019.6: Forzar sincronizaciÃ³n de paleta
            titanOrchestrator.forcePaletteSync();
            console.log('[Chronosâ†’Stage] ðŸŽ¨ Palette synced to new vibe');
        }
        else {
            console.error('[Chronosâ†’Stage] âŒ titanOrchestrator is NULL!');
        }
        return { success: true };
    });
    /**
     * ðŸ§¨ chronos:triggerFX
     * Called from ChronosIPCBridge when an FX clip starts.
     * Maps to forceStrikeNextFrame with the effect from FXMapper.
     * ðŸ§  WAVE 2019.3: source: 'chronos' bypasses Shield blocking in IDLE
     * âš’ï¸ WAVE 2030.4: Forwards hephCurves to EffectManager for curve automation
     * âš’ï¸ WAVE 2040.22: Heph Diamond clips bypass EffectManager â†’ go to Runtime
     */
    ipcMain.handle('chronos:triggerFX', (_event, config) => {
        // âš’ï¸ WAVE 2030.4: Deserialize hephCurves if present (Record â†’ Map)
        const hephClip = config.hephCurves ? deserializeHephClip(config.hephCurves) : undefined;
        const hephTag = hephClip ? ` âš’ï¸[HEPH: ${hephClip.curves.size} curves]` : '';
        console.log(`[Chronosâ†’Stage] ðŸ§¨ FX TRIGGER: ${config.effectId} @ ${(config.intensity * 100).toFixed(0)}%${hephTag}`);
        // âš’ï¸ WAVE 2040.22: DIAMOND PATH â€” Heph custom clips bypass EffectManager entirely.
        // EffectManager has no factory for 'heph-custom' (and shouldn't â€” it's not a Core FX).
        // Instead, we feed the deserialized curves directly to HephaestusRuntime.
        if (config.effectId === 'heph-custom' && hephClip) {
            const runtime = getHephaestusRuntime();
            const instanceId = runtime.playFromClip(hephClip, {
                intensity: config.intensity,
                durationOverrideMs: config.durationMs,
                loop: false,
            });
            console.log(`[Chronosâ†’Stage] âš’ï¸ðŸ’Ž DIAMOND RUNTIME: ${instanceId} (${hephClip.curves.size} curves)`);
            return { success: true, instanceId };
        }
        if (titanOrchestrator) {
            titanOrchestrator.forceStrikeNextFrame({
                effect: config.effectId,
                intensity: config.intensity,
                source: 'chronos', // ðŸ§  WAVE 2019.3: Bypass Shield for timeline-triggered effects
                hephCurves: hephClip, // âš’ï¸ WAVE 2030.4: Pass deserialized curves
            });
        }
        return { success: true };
    });
    /**
     * âš’ï¸ chronos:triggerHeph (WAVE 2030.18)
     * Called from ChronosIPCBridge when a CUSTOM Hephaestus .lfx clip starts.
     * Bypasses FXMapper entirely - uses HephaestusRuntime for dynamic execution.
     *
     * This is THE RUNTIME - evaluates Bezier curves at 60fps for user-created effects.
     */
    ipcMain.handle('chronos:triggerHeph', (_event, config) => {
        console.log(`[Chronosâ†’Stage] âš’ï¸ HEPH TRIGGER: ${config.filePath} @ ${(config.intensity * 100).toFixed(0)}%`);
        // ðŸ” DEBUG: Check file before loading
        const fs = require('fs');
        if (!fs.existsSync(config.filePath)) {
            console.error(`[Chronosâ†’Stage] âš’ï¸ HEPH FILE NOT FOUND: ${config.filePath}`);
            return { success: false, error: 'File not found' };
        }
        const stats = fs.statSync(config.filePath);
        console.log(`[Chronosâ†’Stage] âš’ï¸ HEPH FILE SIZE: ${stats.size} bytes`);
        if (stats.size === 0) {
            console.error(`[Chronosâ†’Stage] âš’ï¸ HEPH FILE EMPTY: ${config.filePath}`);
            return { success: false, error: 'Empty file' };
        }
        // Try to read raw content
        try {
            const content = fs.readFileSync(config.filePath, 'utf-8');
            console.log(`[Chronosâ†’Stage] âš’ï¸ HEPH FILE PREVIEW: ${content.substring(0, 200)}...`);
        }
        catch (readErr) {
            console.error(`[Chronosâ†’Stage] âš’ï¸ HEPH READ ERROR:`, readErr);
        }
        const runtime = getHephaestusRuntime();
        const instanceId = runtime.play(config.filePath, {
            intensity: config.intensity,
            durationOverrideMs: config.durationMs,
            loop: config.loop ?? false,
        });
        if (instanceId) {
            console.log(`[Chronosâ†’Stage] âš’ï¸ HEPH PLAYING: ${instanceId}`);
            return { success: true, instanceId };
        }
        else {
            console.error(`[Chronosâ†’Stage] âš’ï¸ HEPH FAILED: Could not load ${config.filePath}`);
            return { success: false, error: 'Failed to load .lfx file' };
        }
    });
    /**
     * âš’ï¸ chronos:stopHeph (WAVE 2030.18)
     * Stop a specific Hephaestus runtime instance or all instances.
     */
    ipcMain.handle('chronos:stopHeph', (_event, instanceId) => {
        const runtime = getHephaestusRuntime();
        if (instanceId) {
            const stopped = runtime.stop(instanceId);
            console.log(`[Chronosâ†’Stage] âš’ï¸ HEPH STOP: ${instanceId} (${stopped ? 'OK' : 'not found'})`);
            return { success: stopped };
        }
        else {
            runtime.stopAll();
            console.log('[Chronosâ†’Stage] âš’ï¸ HEPH STOP ALL');
            return { success: true };
        }
    });
    /**
     * âš’ï¸ chronos:tickHeph (WAVE 2030.18)
     * Called from render loop to evaluate all active Hephaestus clips.
     * Returns output values to be merged with main DMX output.
     */
    ipcMain.handle('chronos:tickHeph', (_event, currentTimeMs) => {
        const runtime = getHephaestusRuntime();
        const outputs = runtime.tick(currentTimeMs);
        return { success: true, outputs };
    });
    /**
     * ðŸ›‘ chronos:stopFX
     * Called from ChronosIPCBridge when an FX clip ends.
     * âš’ï¸ WAVE 2040.22: Heph Diamond clips â†’ stop all Runtime instances
     * Standard FX: Currently auto-expire (placeholder for future cancel)
     */
    ipcMain.handle('chronos:stopFX', (_event, effectId) => {
        console.log('[Chronosâ†’Stage] ðŸ›‘ FX STOP:', effectId);
        // âš’ï¸ WAVE 2040.22: Heph clips need explicit Runtime stop
        if (effectId === 'heph-custom') {
            const runtime = getHephaestusRuntime();
            runtime.stopAll();
            console.log('[Chronosâ†’Stage] âš’ï¸ðŸ’Ž HEPH DIAMOND: all instances stopped');
            return { success: true };
        }
        // Future implementation: titanOrchestrator.cancelEffect(effectId)
        return { success: true };
    });
    /**
     * 👻 WAVE 2540.4: THE PHANTOM BUFFER — Load pre-calculated GodEar heatmap
     * Called from renderer when audio analysis completes.
     * Sends the full heatmap to TitanEngine for offline band lookup during playback.
     */
    ipcMain.handle('chronos:load-heatmap', (_event, heatmap) => {
        if (titanOrchestrator) {
            titanOrchestrator.setChronosHeatmap(heatmap ?? null);
            return { success: true };
        }
        console.error('[Chronos→Stage] 👻 PHANTOM BUFFER: titanOrchestrator not available');
        return { success: false };
    });
    /**
     * 👻 WAVE 2540.5: PLAYHEAD SYNC — Receive playhead time from Chronos frontend.
     * Called every frame during Chronos playback (~25fps from useEffect).
     * This is the clock that drives the phantom buffer frame lookup.
     */
    ipcMain.handle('chronos:sync-playhead', (_event, timeMs, isPlaying) => {
        if (titanOrchestrator) {
            titanOrchestrator.setChronosPlayhead(timeMs, isPlaying);
        }
        return { success: true };
    });
    // 🎭 WAVE 700.5.4: MOOD CONTROL
    ipcMain.handle('lux:setMood', (_event, moodId) => {
        console.log('[IPC] ðŸŽ­ lux:setMood:', moodId);
        if (titanOrchestrator) {
            titanOrchestrator.setMood(moodId);
            // Notify all frontends
            const mainWindow = getMainWindow();
            safeWebSend(mainWindow, 'lux:mood-changed', { moodId, timestamp: Date.now() });
        }
        return { success: true, moodId };
    });
    ipcMain.handle('lux:getMood', () => {
        if (titanOrchestrator) {
            const currentMood = titanOrchestrator.getMood();
            return { success: true, moodId: currentMood };
        }
        return { success: false, moodId: 'balanced', error: 'Orchestrator not initialized' };
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
    // WAVE 250: NERVE SPLICING - Canales kebab-case estÃ¡ndar
    // WAVE 252: SILENCE - Logs eliminados para reducir spam
    // WAVE 254: Migrado a TitanOrchestrator
    // =========================================================================
    // ⚡ WAVE 3060b PHOENIX: lux:audio-frame RESTAURADO como hot-path
    // Frontend envía bass/mid/treble/energy/bpm a 60fps para fluidez visual + LiquidEngine
    ipcMain.on('lux:audio-frame', (_event, data) => {
        if (titanOrchestrator) {
            titanOrchestrator.processAudioFrame(data);
        }
    });
    // ðŸ©¸ WAVE 259: RAW VEIN - Audio buffer crudo para Trinity FFT
    // ðŸ”¥ WAVE 264.8: Cambiado de handle() a on() para FIRE-AND-FORGET
    // handle() requiere devolver una Promise y crea backpressure a 60fps
    // on() es unidireccional - procesa sin esperar respuesta
    let audioBufferCallCount = 0;
    let lastLogTime = Date.now();
    ipcMain.on('lux:audio-buffer', (_event, buffer) => {
        audioBufferCallCount++;
        // ðŸ” WAVE 264.7: Log AGRESIVO cada 2 segundos (basado en tiempo, no frames)
        const now = Date.now();
        if (now - lastLogTime >= 2000) {
            const titanState = titanOrchestrator?.getState();
            const activeSource = getTrinity()?.getAudioMatrix()?.getStatus().activeSource ?? 'none';
            console.log(`[TitanOrchestrator] [IPC AUDIT] audioBuffer #${audioBufferCallCount} | ` +
                `activeSource=${activeSource} | titan.running=${titanState?.isRunning ?? 'null'} | ` +
                `size=${buffer?.byteLength || 0}`);
            lastLogTime = now;
        }
        if (titanOrchestrator && buffer) {
            // ⚡ WAVE 3060b PHOENIX: HACK BINARIO — reconstruct Float32Array from Buffer
            // Frontend envía Uint8Array (mapea a Node Buffer via C++ binding, quasi zero-copy)
            // Aquí reconstruimos Float32Array usando byteOffset para alinear correctamente
            const float32 = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
            titanOrchestrator.processAudioBuffer(float32);
        }
        else if (!titanOrchestrator) {
            console.warn('[IPC âš ï¸] audioBuffer: titanOrchestrator is null!');
        }
        else if (!buffer) {
            console.warn('[IPC âš ï¸] audioBuffer: buffer is null!');
        }
        // ðŸ”¥ WAVE 264.8: NO return - fire-and-forget
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
    const { fxtParser, getPatchedFixtures, setPatchedFixtures, getFixtureLibrary, setFixtureLibrary, autoAssignZone, resetZoneCounters, recalculateZoneCounters, configManager, getMainWindow, rescanAllLibraries, // WAVE 390.5: Full library rescan
    getFactoryLibPath, // WAVE 1115: Resolved paths
    getCustomLibPath // WAVE 1115: Resolved paths
     } = deps;
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
        safeWebSend(getMainWindow(), 'lux:fixtures-loaded', patchedFixtures);
        return { success: true, fixture: patched };
    });
    ipcMain.handle('fixtures:removeFromPatch', (_event, fixtureId) => {
        const patchedFixtures = getPatchedFixtures();
        const index = patchedFixtures.findIndex((f) => f.id === fixtureId);
        if (index !== -1) {
            patchedFixtures.splice(index, 1);
            recalculateZoneCounters();
            configManager.updateConfig({ patchedFixtures });
            safeWebSend(getMainWindow(), 'lux:fixtures-loaded', patchedFixtures);
            return { success: true };
        }
        return { success: false, error: 'Fixture not found' };
    });
    ipcMain.handle('fixtures:clearPatch', () => {
        setPatchedFixtures([]);
        resetZoneCounters();
        configManager.updateConfig({ patchedFixtures: [] });
        safeWebSend(getMainWindow(), 'lux:fixtures-loaded', []);
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
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // WAVE 256: LUX ALIASES - Handlers con prefijo lux: para compatibilidad
    // El preload.ts usa lux:* pero los handlers originales son fixtures:*
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ðŸ” WAVE 255.5: Scan fixtures - alias para fixtures:scanLibrary
    // Si no se pasa path, retorna la librerÃ­a ya cargada (desde main.ts WAVE 255)
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
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ðŸ”¥ WAVE 384: GET FIXTURE DEFINITION - Returns FULL fixture data with channels
    // This is the missing link that caused "fixtures nacen genÃ©ricos"
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
            console.log(`[IPC] ðŸ”¥ lux:getFixtureDefinition: Returning "${definition.name}" (${definition.channelCount}ch, type: ${definition.type}, motor: ${definition.physics?.motorType || 'none'})`);
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
                    // ðŸ”¥ WAVE 1042.1: INCLUDE PHYSICS!
                    physics: definition.physics || null,
                    // ðŸ”¥ WAVE 1042.1: FULL CAPABILITIES including colorEngine and colorWheel
                    capabilities: definition.capabilities || null,
                    // Legacy flat capabilities flags (for backward compat)
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
        safeWebSend(getMainWindow(), 'lux:fixtures-loaded', patchedFixtures);
        return { success: true, fixture: patched };
    });
    ipcMain.handle('lux:unpatch-fixture', (_event, dmxAddress) => {
        const patchedFixtures = getPatchedFixtures();
        const index = patchedFixtures.findIndex((f) => f.dmxAddress === dmxAddress);
        if (index !== -1) {
            patchedFixtures.splice(index, 1);
            recalculateZoneCounters();
            configManager.updateConfig({ patchedFixtures });
            safeWebSend(getMainWindow(), 'lux:fixtures-loaded', patchedFixtures);
            return { success: true };
        }
        return { success: false, error: 'Fixture not found at that address' };
    });
    // âœï¸ WAVE 256: Editar fixture patcheado - ALL fields
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
        safeWebSend(getMainWindow(), 'lux:fixtures-loaded', patchedFixtures);
        console.log(`âœï¸ [IPCHandlers] Fixture edited: ${fixture.name} @ DMX ${data.newDmxAddress}`);
        return { success: true, fixture };
    });
    ipcMain.handle('lux:clear-patch', () => {
        setPatchedFixtures([]);
        resetZoneCounters();
        configManager.updateConfig({ patchedFixtures: [] });
        safeWebSend(getMainWindow(), 'lux:fixtures-loaded', []);
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
        safeWebSend(getMainWindow(), 'lux:fixtures-loaded', []);
        console.log('[IPC] New show created - patch cleared');
        return { success: true };
    });
    ipcMain.handle('lux:save-fixture-definition', async (_event, definition) => {
        try {
            const fs = await import('fs');
            const path = await import('path');
            const libraryPath = fxtParser.getLibraryPath ? fxtParser.getLibraryPath() : '';
            if (!libraryPath) {
                console.error('[IPC] Library path not configured!');
                return { success: false, error: 'Library path not configured' };
            }
            // WAVE 388 EXT: Sanitize filename
            const safeName = (definition.name || 'custom')
                .replace(/[^a-z0-9Ã¡Ã©Ã­Ã³ÃºÃ±Ã¼\s-]/gi, '')
                .replace(/\s+/g, '_')
                .substring(0, 50);
            const fileName = `${safeName}.json`;
            const filePath = path.join(libraryPath, fileName);
            // WAVE 388 EXT: Pretty print with 2 spaces
            fs.writeFileSync(filePath, JSON.stringify(definition, null, 2), 'utf-8');
            console.log(`[IPC] âœ… Saved fixture definition: ${filePath}`);
            // WAVE 390.5: Rescan ALL libraries (factory + custom) with proper merge
            try {
                const updatedLibrary = await rescanAllLibraries();
                console.log(`[IPC] ðŸ”„ WAVE 390.5 Library rescanned: ${updatedLibrary.length} fixtures (factory + custom merged)`);
            }
            catch (rescanErr) {
                console.warn('[IPC] âš ï¸ Failed to rescan libraries after save:', rescanErr);
            }
            // WAVE 388 EXT: Return BOTH path and filePath for compatibility
            return { success: true, path: filePath, filePath };
        }
        catch (err) {
            console.error('[IPC] âŒ Failed to save fixture definition:', err);
            return { success: false, error: String(err) };
        }
    });
    // WAVE 388 EXT: Delete fixture definition from library
    // WAVE 389: Rescan library after delete to invalidate cache
    // WAVE 2185: Accept paths from BOTH factory and custom library folders
    // Accepts either full filePath or fixture name to search
    ipcMain.handle('lux:delete-fixture-definition', async (_event, identifier) => {
        try {
            const fs = await import('fs');
            const path = await import('path');
            const customPath = getCustomLibPath();
            const factoryPath = getFactoryLibPath();
            if (!customPath && !factoryPath) {
                return { success: false, error: 'Library paths not configured' };
            }
            let fileToDelete = null;
            // WAVE 388.7: Check if identifier is already a full path
            if (identifier.includes(path.sep) && fs.existsSync(identifier)) {
                // It's a full path â€” verify it's inside EITHER library folder
                // ðŸ”¥ WAVE 2185: The old code only checked customPath (via fxtParser.getLibraryPath()),
                // so factory fixtures with paths like "C:\...\librerias\user-xxx.json" were rejected
                // with "File path outside library folder" â€” even though they ARE library files.
                const normalizedId = path.normalize(identifier);
                const isInCustom = customPath && normalizedId.startsWith(path.normalize(customPath));
                const isInFactory = factoryPath && normalizedId.startsWith(path.normalize(factoryPath));
                if (isInCustom || isInFactory) {
                    fileToDelete = identifier;
                }
                else {
                    return { success: false, error: 'File path outside library folder' };
                }
            }
            else {
                // Search by scanning BOTH library folders
                const searchFolders = [customPath, factoryPath].filter(Boolean);
                for (const folder of searchFolders) {
                    if (!fs.existsSync(folder))
                        continue;
                    const files = fs.readdirSync(folder);
                    for (const file of files) {
                        if (!file.endsWith('.json'))
                            continue;
                        const filePath = path.join(folder, file);
                        try {
                            const content = fs.readFileSync(filePath, 'utf-8');
                            const fixture = JSON.parse(content);
                            // Match by id OR by name OR by filename
                            if (fixture.id === identifier ||
                                fixture.name === identifier ||
                                file === identifier ||
                                file === `${identifier}.json`) {
                                fileToDelete = filePath;
                                break;
                            }
                        }
                        catch (parseErr) {
                            // Skip files that can't be parsed
                            continue;
                        }
                    }
                    if (fileToDelete)
                        break;
                }
            }
            if (!fileToDelete) {
                return { success: false, error: `Fixture "${identifier}" not found in library` };
            }
            // Delete the file
            fs.unlinkSync(fileToDelete);
            console.log(`[IPC] ðŸ—‘ï¸ Deleted fixture: ${fileToDelete}`);
            // WAVE 390.5: Rescan ALL libraries (factory + custom) with proper merge
            try {
                const updatedLibrary = await rescanAllLibraries();
                console.log(`[IPC] ðŸ”„ WAVE 390.5 Library rescanned: ${updatedLibrary.length} fixtures remain (factory + custom merged)`);
            }
            catch (rescanErr) {
                console.warn('[IPC] âš ï¸ Failed to rescan libraries after delete:', rescanErr);
            }
            return { success: true, deletedPath: fileToDelete };
        }
        catch (err) {
            console.error('[IPC] âŒ Failed to delete fixture:', err);
            return { success: false, error: String(err) };
        }
    });
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ðŸ”Œ WAVE 1113: LIBRARY UNIFIED API - Real FileSystem, No localStorage
    // Single Source of Truth for Forge + StageConstructor
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    /**
     * List ALL fixtures from both sources:
     * - System (factory): Read-only, from /librerias (resolved by PATHFINDER in main.ts)
     * - User (custom): Writable, from userData/fixtures
     *
     * WAVE 1115 FIX: Use paths resolved by PATHFINDER, not hardcoded
     */
    ipcMain.handle('lux:library:list-all', async () => {
        try {
            const fs = await import('fs');
            const path = await import('path');
            // WAVE 1115 FIX: Get paths from main.ts (resolved by PATHFINDER)
            const factoryPath = getFactoryLibPath();
            const userPath = getCustomLibPath();
            console.log(`[Library IPC] ðŸ“‚ Factory path: ${factoryPath}`);
            console.log(`[Library IPC] ðŸ“‚ User path: ${userPath}`);
            // Ensure user path exists
            if (!fs.existsSync(userPath)) {
                fs.mkdirSync(userPath, { recursive: true });
            }
            const systemFixtures = [];
            const userFixtures = [];
            // Scan factory library
            if (fs.existsSync(factoryPath)) {
                const factoryFiles = fs.readdirSync(factoryPath);
                for (const file of factoryFiles) {
                    if (file.endsWith('.json')) {
                        try {
                            const content = fs.readFileSync(path.join(factoryPath, file), 'utf-8');
                            const fixture = JSON.parse(content);
                            systemFixtures.push({
                                ...fixture,
                                source: 'system',
                                filePath: path.join(factoryPath, file),
                            });
                        }
                        catch (e) {
                            console.warn(`[Library] âš ï¸ Failed to parse factory fixture: ${file}`);
                        }
                    }
                    else if (file.endsWith('.fxt')) {
                        // Parse FXT files via parser
                        const parsed = fxtParser.parseFile(path.join(factoryPath, file));
                        if (parsed) {
                            systemFixtures.push({
                                ...parsed,
                                source: 'system',
                                filePath: path.join(factoryPath, file),
                            });
                        }
                    }
                }
            }
            else {
                console.warn(`[Library IPC] âš ï¸ Factory path does not exist: ${factoryPath}`);
            }
            // Scan user library
            if (fs.existsSync(userPath)) {
                const userFiles = fs.readdirSync(userPath);
                for (const file of userFiles) {
                    if (file.endsWith('.json')) {
                        try {
                            const content = fs.readFileSync(path.join(userPath, file), 'utf-8');
                            const fixture = JSON.parse(content);
                            userFixtures.push({
                                ...fixture,
                                source: 'user',
                                filePath: path.join(userPath, file),
                            });
                        }
                        catch (e) {
                            console.warn(`[Library] âš ï¸ Failed to parse user fixture: ${file}`);
                        }
                    }
                }
            }
            console.log(`[Library IPC] âœ… Loaded ${systemFixtures.length} system + ${userFixtures.length} user fixtures`);
            return {
                success: true,
                systemFixtures,
                userFixtures,
                paths: {
                    system: factoryPath,
                    user: userPath,
                },
            };
        }
        catch (err) {
            console.error('[Library] âŒ Failed to list fixtures:', err);
            return { success: false, error: String(err) };
        }
    });
    /**
     * Save a user fixture to userData/fixtures
     * WAVE 1114 FIX: Check if file already exists and update instead of duplicating
     * WAVE 1116.2 FIX: Use PATHFINDER-resolved custom library path
     */
    ipcMain.handle('lux:library:save-user', async (_event, fixture) => {
        try {
            const fs = await import('fs');
            const path = await import('path');
            // WAVE 1116.2: Use PATHFINDER-resolved path
            const userPath = getCustomLibPath();
            console.log(`[Library Save] ðŸ“‚ User path: ${userPath}`);
            // Ensure directory exists
            if (!fs.existsSync(userPath)) {
                fs.mkdirSync(userPath, { recursive: true });
            }
            // Ensure fixture has an ID
            if (!fixture.id) {
                fixture.id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            }
            // WAVE 1114 FIX: Check if fixture already exists (by ID)
            // If exists, update the same file instead of creating new
            let existingFilePath = null;
            const existingFiles = fs.readdirSync(userPath);
            for (const file of existingFiles) {
                if (!file.endsWith('.json'))
                    continue;
                try {
                    const content = fs.readFileSync(path.join(userPath, file), 'utf-8');
                    const existingFixture = JSON.parse(content);
                    if (existingFixture.id === fixture.id) {
                        existingFilePath = path.join(userPath, file);
                        console.log(`[Library] ðŸ”„ Updating existing fixture file: ${file}`);
                        break;
                    }
                }
                catch (e) {
                    continue;
                }
            }
            // Determine file path
            let filePath;
            if (existingFilePath) {
                // Update existing file
                filePath = existingFilePath;
            }
            else {
                // Create new file with safe name from fixture id
                const safeId = fixture.id
                    .replace(/[^a-z0-9Ã¡Ã©Ã­Ã³ÃºÃ±Ã¼\s-]/gi, '')
                    .replace(/\s+/g, '_')
                    .substring(0, 50);
                const fileName = `${safeId}.json`;
                filePath = path.join(userPath, fileName);
            }
            // Add metadata
            fixture.savedAt = new Date().toISOString();
            fixture.source = 'user';
            // Write file
            fs.writeFileSync(filePath, JSON.stringify(fixture, null, 2), 'utf-8');
            console.log(`[Library] ðŸ’¾ WAVE 1114: Saved user fixture: ${filePath}`);
            // Rescan to update cache
            await rescanAllLibraries();
            // 🔥 WAVE 2241: THE FORGE HOT-RELOAD
            // Push the updated profile to the renderer so TitanSyncBridge can
            // force a backend resync without waiting for a full show reload.
            safeWebSend(getMainWindow(), 'lux:profile:updated', fixture);
            return {
                success: true,
                filePath,
                fixture,
            };
        }
        catch (err) {
            console.error('[Library] âŒ Failed to save user fixture:', err);
            return { success: false, error: String(err) };
        }
    });
    /**
     * Delete a user fixture from userData/fixtures
     * Only user fixtures can be deleted (not system)
     * WAVE 1116 FIX: Use PATHFINDER-resolved custom library path
     */
    ipcMain.handle('lux:library:delete-user', async (_event, fixtureId) => {
        try {
            const fs = await import('fs');
            const path = await import('path');
            // WAVE 1116: Use PATHFINDER-resolved path
            const userPath = getCustomLibPath();
            if (!fs.existsSync(userPath)) {
                return { success: false, error: 'User fixtures folder does not exist' };
            }
            // Find the fixture file
            const files = fs.readdirSync(userPath);
            let fileToDelete = null;
            for (const file of files) {
                if (!file.endsWith('.json'))
                    continue;
                try {
                    const content = fs.readFileSync(path.join(userPath, file), 'utf-8');
                    const fixture = JSON.parse(content);
                    if (fixture.id === fixtureId) {
                        fileToDelete = path.join(userPath, file);
                        break;
                    }
                }
                catch (e) {
                    continue;
                }
            }
            if (!fileToDelete) {
                return { success: false, error: `Fixture "${fixtureId}" not found in user library` };
            }
            // Delete the file
            fs.unlinkSync(fileToDelete);
            console.log(`[Library] ðŸ—‘ï¸ WAVE 1113: Deleted user fixture: ${fileToDelete}`);
            // Rescan to update cache
            await rescanAllLibraries();
            return { success: true, deletedPath: fileToDelete };
        }
        catch (err) {
            console.error('[Library] âŒ Failed to delete user fixture:', err);
            return { success: false, error: String(err) };
        }
    });
    // ═══════════════════════════════════════════════════════════════════════════
    // 🧠 WAVE 4549.2: INGENIO IPC BRIDGE
    // Gestiona archivos .luxingenio en userData/ingenios/{system,user}/
    // ═══════════════════════════════════════════════════════════════════════════
    /** Helper: resolve ingenio paths */
    function getIngenioPaths() {
        const { app } = require('electron');
        const path = require('path');
        const userDataPath = app.getPath('userData');
        return {
            system: path.join(userDataPath, 'ingenios', 'system'),
            user: path.join(userDataPath, 'ingenios', 'user'),
        };
    }
    /** Read all .luxingenio files from a folder, returns parsed array */
    async function scanIngeniFolder(folderPath, source) {
        const fs = await import('fs');
        const path = await import('path');
        const items = [];
        if (!fs.existsSync(folderPath))
            return items;
        for (const file of fs.readdirSync(folderPath)) {
            if (!file.endsWith('.luxingenio'))
                continue;
            try {
                const raw = fs.readFileSync(path.join(folderPath, file), 'utf-8');
                const parsed = JSON.parse(raw);
                items.push({ ...parsed, _source: source, _filePath: path.join(folderPath, file) });
            }
            catch {
                // Corrupt file — skip silently
            }
        }
        return items;
    }
    /**
     * List ALL ingenios: system (factory, read-only) + user (writable)
     */
    ipcMain.handle('lux:ingenio:list-all', async () => {
        try {
            const fs = await import('fs');
            const paths = getIngenioPaths();
            if (!fs.existsSync(paths.system))
                fs.mkdirSync(paths.system, { recursive: true });
            if (!fs.existsSync(paths.user))
                fs.mkdirSync(paths.user, { recursive: true });
            const systemIngenios = await scanIngeniFolder(paths.system, 'system');
            const userIngenios = await scanIngeniFolder(paths.user, 'user');
            return { success: true, systemIngenios, userIngenios, paths };
        }
        catch (err) {
            console.error('[Ingenio IPC] ❌ list-all failed:', err);
            return { success: false, systemIngenios: [], userIngenios: [], error: String(err) };
        }
    });
    /**
     * Get a single ingenio by ID (searches system then user)
     */
    ipcMain.handle('lux:ingenio:get-by-id', async (_event, ingenioId) => {
        try {
            const paths = getIngenioPaths();
            const [systemList, userList] = await Promise.all([
                scanIngeniFolder(paths.system, 'system'),
                scanIngeniFolder(paths.user, 'user'),
            ]);
            const found = [...userList, ...systemList].find((i) => i.id === ingenioId);
            if (!found)
                return { success: false, error: `Ingenio "${ingenioId}" not found` };
            return { success: true, ingenio: found };
        }
        catch (err) {
            return { success: false, error: String(err) };
        }
    });
    /**
     * Save an ingenio to userData/ingenios/user/
     * Validates that the payload has the required IIngenioDefinition structure.
     */
    ipcMain.handle('lux:ingenio:save-user', async (_event, ingenio) => {
        try {
            const fs = await import('fs');
            const path = await import('path');
            const paths = getIngenioPaths();
            if (!fs.existsSync(paths.user))
                fs.mkdirSync(paths.user, { recursive: true });
            if (!ingenio?.id || typeof ingenio.id !== 'string') {
                return { success: false, error: 'Ingenio must have a string id field' };
            }
            if (!ingenio.name || !ingenio.version) {
                return { success: false, error: 'Ingenio must have name and version fields' };
            }
            // Check if file already exists (update-in-place)
            const existing = (await scanIngeniFolder(paths.user, 'user')).find((i) => i.id === ingenio.id);
            const safeSlug = ingenio.id.replace(/[^a-z0-9_-]/gi, '_').substring(0, 60);
            const filePath = existing?._filePath ?? path.join(paths.user, `${safeSlug}.luxingenio`);
            // Strip internal runtime fields before persisting
            const { _source: _s, _filePath: _fp, ...toSave } = ingenio;
            toSave.meta = { ...toSave.meta, updatedAt: new Date().toISOString() };
            fs.writeFileSync(filePath, JSON.stringify(toSave, null, 2), 'utf-8');
            console.log(`[Ingenio IPC] 💾 Saved: ${filePath}`);
            return { success: true, filePath };
        }
        catch (err) {
            console.error('[Ingenio IPC] ❌ save-user failed:', err);
            return { success: false, error: String(err) };
        }
    });
    /**
     * Delete an ingenio from userData/ingenios/user/ (system ingenios are immutable)
     */
    ipcMain.handle('lux:ingenio:delete-user', async (_event, ingenioId) => {
        try {
            const fs = await import('fs');
            const paths = getIngenioPaths();
            const userList = await scanIngeniFolder(paths.user, 'user');
            const target = userList.find((i) => i.id === ingenioId);
            if (!target)
                return { success: false, error: `Ingenio "${ingenioId}" not found in user library` };
            fs.unlinkSync(target._filePath);
            console.log(`[Ingenio IPC] 🗑️ Deleted: ${target._filePath}`);
            return { success: true, deletedPath: target._filePath };
        }
        catch (err) {
            console.error('[Ingenio IPC] ❌ delete-user failed:', err);
            return { success: false, error: String(err) };
        }
    });
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Get DMX connection status for Live Probe
     * WAVE 1115 FIX: Check BOTH UniversalDMX (USB) and ArtNet
     */
    ipcMain.handle('lux:library:dmx-status', () => {
        const { universalDMX, artNetDriver } = deps;
        // Check USB DMX
        const usbConnected = universalDMX?.isConnected ?? false;
        const usbDevice = universalDMX?.currentDevice ?? null;
        // Check ArtNet
        const artNetStatus = artNetDriver?.getStatus?.() || null;
        const artNetConnected = artNetStatus?.connected ?? false;
        // Return combined status (connected if EITHER is connected)
        const connected = usbConnected || artNetConnected;
        const device = usbDevice || (artNetConnected ? 'ArtNet' : null);
        console.log(`[Library DMX Status] USB:${usbConnected} ArtNet:${artNetConnected} â†’ ${connected}`);
        return {
            connected,
            device,
        };
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
            interface: universalDMX.currentDevice || 'none',
            protocol: universalDMX.activeStrategyProtocol,
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
            // 🔒 WAVE 2240: Notificar al frontend ANTES de iniciar — UI se bloquea inmediatamente
            safeWebSend(getMainWindow(), 'dmx:connecting');
            await universalDMX.connect(devicePath);
            safeWebSend(getMainWindow(), 'dmx:connected', universalDMX.currentDevice);
            return { success: true };
        }
        catch (err) {
            // En caso de fallo, notificar estado real
            safeWebSend(getMainWindow(), 'dmx:disconnected');
            return { success: false, error: String(err) };
        }
    });
    ipcMain.handle('dmx:disconnect', async () => {
        try {
            await universalDMX.disconnect();
            safeWebSend(getMainWindow(), 'dmx:disconnected');
            return { success: true };
        }
        catch (err) {
            // Limpiar estado incluso en error — el hardware podría haber muerto
            safeWebSend(getMainWindow(), 'dmx:disconnected');
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
    // WAVE 688 + WAVE 2240: Auto-connect to best available device
    ipcMain.handle('dmx:autoConnect', async () => {
        try {
            // 🔒 WAVE 2240: Notificar al frontend ANTES de iniciar — UI se bloquea inmediatamente
            safeWebSend(getMainWindow(), 'dmx:connecting');
            const success = await universalDMX.autoConnect();
            if (success) {
                const mainWindow = getMainWindow();
                safeWebSend(mainWindow, 'dmx:connected', universalDMX.currentDevice);
            }
            else {
                // autoConnect falló o fue rechazado por mutex — notificar estado real
                safeWebSend(getMainWindow(), 'dmx:disconnected');
            }
            return { success, device: universalDMX.currentDevice };
        }
        catch (err) {
            safeWebSend(getMainWindow(), 'dmx:disconnected');
            return { success: false, error: String(err) };
        }
    });
    // ðŸŒªï¸ WAVE 688: Blackout - all channels to 0
    ipcMain.handle('dmx:blackout', () => {
        try {
            universalDMX.blackout();
            return { success: true };
        }
        catch (err) {
            return { success: false, error: String(err) };
        }
    });
    // ðŸŒªï¸ WAVE 688: Highlight fixture for testing
    ipcMain.handle('dmx:highlightFixture', (_event, startChannel, channelCount, isMovingHead) => {
        try {
            universalDMX.highlightFixture(startChannel, channelCount, isMovingHead);
            return { success: true };
        }
        catch (err) {
            return { success: false, error: String(err) };
        }
    });
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ðŸŽ›ï¸ WAVE 1007: THE NERVE LINK - Direct DMX injection for calibration tools
    // GOD MODE: Bypasses HAL and TitanEngine for raw hardware access
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    ipcMain.handle('dmx:sendDirect', (_event, params) => {
        try {
            const { universe, address, value } = params;
            // Clamp values to valid DMX range
            const clampedValue = Math.max(0, Math.min(255, Math.floor(value)));
            const clampedAddress = Math.max(1, Math.min(512, Math.floor(address)));
            // Universe 0 = USB (universalDMX), Universe 1+ = ArtNet
            if (universe === 0 || universe === 1) {
                // Primary universe - send via USB/Serial
                if (universalDMX?.isConnected) {
                    universalDMX.setChannel(clampedAddress, clampedValue);
                }
                // Also send via ArtNet if configured (for ArtNet universe 0)
                // ðŸ”§ WAVE 1218 FIX: isConnected not isRunning
                if (deps.artNetDriver?.isConnected) {
                    deps.artNetDriver.setChannel(clampedAddress, clampedValue);
                    deps.artNetDriver.send(); // ðŸ”¥ WAVE 1008.5: Force immediate send for calibration
                }
            }
            else {
                // Higher universes - ArtNet only
                // ðŸ”§ WAVE 1218 FIX: isConnected not isRunning
                if (deps.artNetDriver?.isConnected) {
                    deps.artNetDriver.setChannel(clampedAddress, clampedValue, universe);
                    deps.artNetDriver.send(); // ðŸ”¥ WAVE 1008.5: Force immediate send
                }
            }
            return { success: true };
        }
        catch (err) {
            console.error('[IPC] ðŸ”¥ NERVE LINK Error:', err);
            return { success: false, error: String(err) };
        }
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
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ðŸ“¡ WAVE 2048: ART-NET DISCOVERY (ArtPoll/ArtPollReply)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    const discovery = getArtNetDiscovery();
    ipcMain.handle('artnet:discovery:start', async () => {
        try {
            const success = await discovery.start();
            return { success, status: discovery.getStatus() };
        }
        catch (err) {
            return { success: false, error: String(err) };
        }
    });
    ipcMain.handle('artnet:discovery:stop', async () => {
        try {
            await discovery.stop();
            return { success: true };
        }
        catch (err) {
            return { success: false, error: String(err) };
        }
    });
    ipcMain.handle('artnet:discovery:getStatus', () => {
        return discovery.getStatus();
    });
    ipcMain.handle('artnet:discovery:pollNow', () => {
        discovery.pollNow();
        return { success: true };
    });
    ipcMain.handle('artnet:discovery:setBroadcast', (_event, address) => {
        discovery.setBroadcastAddress(address);
        return { success: true };
    });
    // Forward discovery events to renderer
    discovery.on('node-discovered', (node) => {
        deps.mainWindow?.webContents.send('artnet:discovery:node-discovered', node);
    });
    discovery.on('node-lost', (ip) => {
        deps.mainWindow?.webContents.send('artnet:discovery:node-lost', ip);
    });
    discovery.on('node-updated', (node) => {
        deps.mainWindow?.webContents.send('artnet:discovery:node-updated', node);
    });
    discovery.on('state-change', (state) => {
        deps.mainWindow?.webContents.send('artnet:discovery:state-change', state);
    });
}
// =============================================================================
// WAVE 3403: AUDIO MATRIX IPC HANDLERS
// =============================================================================
function setupAudioMatrixHandlers(_deps) {
    ipcMain.handle('audio-matrix:get-status', () => {
        const trinity = getTrinity();
        const matrix = trinity?.getAudioMatrix();
        if (!matrix)
            return { success: false, error: 'AudioMatrix not initialized' };
        return { success: true, status: matrix.getStatus() };
    });
    ipcMain.handle('audio-matrix:get-diagnostics', () => {
        const trinity = getTrinity();
        const matrix = trinity?.getAudioMatrix();
        if (!matrix)
            return { success: false, error: 'AudioMatrix not initialized' };
        const status = matrix.getStatus();
        const activeProvider = matrix.getActiveProvider();
        const providerDiag = activeProvider?.getDiagnostics() ?? null;
        // AGC diagnostics (only USBDirectLinkProvider exposes this)
        const agcDiag = activeProvider?.getAutoGainDiagnostics?.() ?? null;
        // Resampler info
        const resamplerActive = !!activeProvider?.resampler;
        return {
            success: true,
            status,
            providerDiagnostics: providerDiag,
            agc: agcDiag,
            resamplerActive,
        };
    });
    ipcMain.handle('audio-matrix:force-source', async (_event, sourceType) => {
        const trinity = getTrinity();
        const matrix = trinity?.getAudioMatrix();
        if (!matrix)
            return { success: false, error: 'AudioMatrix not initialized' };
        await matrix.forceSource(sourceType);
        _deps.mainWindow?.webContents.send('audio-matrix:active-source', {
            sourceType,
            timestamp: Date.now(),
        });
        // WAVE 3414: Al cambiar de fuente de audio el Worker mantiene estado del
        // tracker anterior (peakEnergyEstimate, bpmHistory, adaptive floor) calibrado
        // para la fuente previa. Eso mata los kicks de la nueva fuente via PEAK_DISCRIMINATOR.
        // Mandamos RESET_PACEMAKER para que el Worker arranque con pizarra en blanco.
        trinity.resetPacemaker();
        console.log(`[IPCHandlers] 🔄 WAVE 3414/3415: source → "${sourceType}" — Pacemaker reset (Amnesia Protocol)`);
        return { success: true };
    });
    ipcMain.handle('audio-matrix:release-force', () => {
        const trinity = getTrinity();
        const matrix = trinity?.getAudioMatrix();
        if (!matrix)
            return { success: false, error: 'AudioMatrix not initialized' };
        matrix.releaseForce();
        _deps.mainWindow?.webContents.send('audio-matrix:active-source', {
            sourceType: matrix.getStatus().activeSource,
            timestamp: Date.now(),
        });
        return { success: true };
    });
}
