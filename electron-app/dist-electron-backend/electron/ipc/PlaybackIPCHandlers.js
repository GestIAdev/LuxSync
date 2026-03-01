/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎬 PLAYBACK IPC HANDLERS - WAVE 2053.1
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * IPC bridge between React (frontend) and TimelineEngine (backend).
 *
 * The frontend is DUMB: it manages audio playback and sends the current
 * playhead position. ALL lighting physics run in the TimelineEngine.
 *
 * CHANNELS:
 *   lux:playback:load   — Load a LuxProject into the engine
 *   lux:playback:tick   — Send current timeMs (called every frame)
 *   lux:playback:stop   — Stop playback + cleanup
 *   lux:playback:state  — Query engine state
 *
 * @module ipc/PlaybackIPCHandlers
 * @version WAVE 2053.1
 */
import { ipcMain } from 'electron';
import { timelineEngine } from '../../src/core/engine/TimelineEngine';
import { masterArbiter } from '../../src/core/arbiter';
let mainWindow = null;
// ═══════════════════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════════════════
export function setupPlaybackIPCHandlers(window) {
    if (window)
        mainWindow = window;
    // ─── LOAD PROJECT ───
    ipcMain.handle('lux:playback:load', (_event, project) => {
        try {
            timelineEngine.loadProject(project);
            return { success: true, state: timelineEngine.getState() };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[PlaybackIPC] ❌ Load failed: ${msg}`);
            return { success: false, error: msg };
        }
    });
    // ─── TICK (called every rAF from frontend) ───
    ipcMain.on('lux:playback:tick', (_event, timeMs) => {
        // Fire-and-forget — no response needed for 60fps ticks
        timelineEngine.tick(timeMs);
    });
    // ─── STOP ───
    ipcMain.handle('lux:playback:stop', () => {
        try {
            timelineEngine.stop();
            return { success: true };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[PlaybackIPC] ❌ Stop failed: ${msg}`);
            return { success: false, error: msg };
        }
    });
    // ─── STATE QUERY ───
    ipcMain.handle('lux:playback:state', () => {
        return timelineEngine.getState();
    });
    // ─── FIXTURE SYNC (Frontend → Backend) ───
    ipcMain.on('lux:stage:sync', (_event, fixtures) => {
        try {
            console.log(`[PlaybackIPC] 🎭 Syncing ${fixtures.length} fixtures to Arbiter...`);
            // Map FixtureInstance to ArbiterFixture format
            const arbiterFixtures = fixtures.map(f => {
                const mapped = {
                    id: f.id,
                    name: f.name,
                    type: f.type,
                    dmxAddress: f.address, // FixtureInstance.address → ArbiterFixture.dmxAddress
                    universe: f.universe,
                    zone: f.zone,
                    position: f.position,
                    capabilities: f.capabilities,
                    channels: f.channels, // 🔥 CRITICAL: Include channels array!
                };
                // Debug: Verify channels are present
                if (!f.channels || f.channels.length === 0) {
                    console.warn(`[PlaybackIPC] ⚠️ Fixture ${f.id} has NO CHANNELS!`);
                }
                else {
                    console.log(`[PlaybackIPC] ✅ Fixture ${f.id}: ${f.channels.length} channels`);
                }
                return mapped;
            });
            masterArbiter.setFixtures(arbiterFixtures);
            const totalChannels = arbiterFixtures.reduce((sum, f) => sum + (f.channels?.length || 0), 0);
            console.log(`[PlaybackIPC] ✅ ${fixtures.length} fixtures synced (${totalChannels} total channels)`);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[PlaybackIPC] ❌ Fixture sync failed: ${msg}`);
        }
    });
    // ─── ARBITER OUTPUT FEEDBACK (Backend → Frontend) ───
    masterArbiter.on('output', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('lux:arbiter:output', data);
        }
    });
    console.log('[PlaybackIPC] 🎬 Playback handlers registered (WAVE 2054)');
}
// ═══════════════════════════════════════════════════════════════════════════
// CLEANUP
// ═══════════════════════════════════════════════════════════════════════════
export function cleanupPlaybackIPC() {
    timelineEngine.stop();
    ipcMain.removeHandler('lux:playback:load');
    ipcMain.removeAllListeners('lux:playback:tick');
    ipcMain.removeHandler('lux:playback:stop');
    ipcMain.removeHandler('lux:playback:state');
    ipcMain.removeAllListeners('lux:stage:sync');
    mainWindow = null;
    console.log('[PlaybackIPC] 🧹 Handlers cleaned up');
}
