/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎭 WAVE 374: ARBITER IPC HANDLERS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Exposes MasterArbiter control to the frontend via IPC channels.
 *
 * CHANNELS:
 * - lux:arbiter:setManual   - Set manual override for a fixture
 * - lux:arbiter:clearManual - Clear manual override
 * - lux:arbiter:blackout    - Toggle/set blackout state
 * - lux:arbiter:status      - Get arbiter status
 * - lux:arbiter:addEffect   - Add a temporary effect
 * - lux:arbiter:clearEffects - Clear all effects
 *
 * @module core/orchestrator/ArbiterHandlers
 * @version WAVE 374
 */
import { ipcMain } from 'electron';
import { masterArbiter, } from '../arbiter';
/**
 * Setup all Arbiter IPC handlers
 */
export function setupArbiterHandlers() {
    console.log('[IPC] 🎭 Setting up Arbiter handlers (WAVE 374)');
    // ═══════════════════════════════════════════════════════════════════════
    // MANUAL OVERRIDE
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Set manual override for a fixture
     *
     * @param fixtureId - Fixture identifier
     * @param controls - { dimmer?, pan?, tilt?, r?, g?, b?, zoom?, focus? }
     * @param channels - Which channels to override (optional, defaults to all provided)
     * @param source - Source of override (optional, defaults to 'ui_fader')
     *
     * @example
     * // Override pan/tilt for mover calibration
     * ipcRenderer.invoke('lux:arbiter:setManual', {
     *   fixtureId: 'mover-1',
     *   controls: { pan: 128, tilt: 128 },
     *   channels: ['pan', 'tilt']
     * })
     */
    ipcMain.handle('lux:arbiter:setManual', (_event, args) => {
        const { fixtureId, controls, channels, source, autoReleaseMs, releaseTransitionMs } = args;
        // Determine which channels to override
        const overrideChannels = channels ||
            Object.keys(controls);
        const override = {
            fixtureId,
            controls: {
                dimmer: controls.dimmer,
                red: controls.r ?? controls.red,
                green: controls.g ?? controls.green,
                blue: controls.b ?? controls.blue,
                white: controls.white,
                pan: controls.pan,
                tilt: controls.tilt,
                zoom: controls.zoom,
                focus: controls.focus,
            },
            overrideChannels,
            mode: 'absolute',
            source: source || 'ui_fader',
            priority: 1,
            autoReleaseMs: autoReleaseMs || 0,
            releaseTransitionMs: releaseTransitionMs || 500,
            timestamp: Date.now(),
        };
        masterArbiter.setManualOverride(override);
        return {
            success: true,
            fixtureId,
            channels: overrideChannels,
        };
    });
    /**
     * Clear manual override for a fixture
     *
     * @param fixtureId - Fixture identifier
     * @param channels - Optional specific channels to release (releases all if omitted)
     */
    ipcMain.handle('lux:arbiter:clearManual', (_event, args) => {
        const { fixtureId, channels } = args;
        masterArbiter.releaseManualOverride(fixtureId, channels);
        return { success: true, fixtureId };
    });
    /**
     * Clear all manual overrides
     */
    ipcMain.handle('lux:arbiter:clearAllManual', () => {
        masterArbiter.releaseAllManualOverrides();
        return { success: true };
    });
    /**
     * Check if fixture has manual override
     */
    ipcMain.handle('lux:arbiter:hasManual', (_event, args) => {
        const { fixtureId, channel } = args;
        return {
            success: true,
            hasOverride: masterArbiter.hasManualOverride(fixtureId, channel)
        };
    });
    // ═══════════════════════════════════════════════════════════════════════
    // BLACKOUT
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Set blackout state
     *
     * @param active - true to enable blackout, false to disable
     */
    ipcMain.handle('lux:arbiter:blackout', (_event, active) => {
        masterArbiter.setBlackout(active);
        return { success: true, active };
    });
    /**
     * Toggle blackout state
     */
    ipcMain.handle('lux:arbiter:toggleBlackout', () => {
        const newState = masterArbiter.toggleBlackout();
        return { success: true, active: newState };
    });
    // ═══════════════════════════════════════════════════════════════════════
    // EFFECTS
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Add a temporary effect
     *
     * @param type - Effect type (strobe, flash, blinder, etc.)
     * @param intensity - Effect intensity (0-1)
     * @param durationMs - Duration in milliseconds
     * @param fixtureIds - Optional list of fixtures (empty = all)
     * @param params - Effect-specific parameters
     */
    ipcMain.handle('lux:arbiter:addEffect', (_event, args) => {
        const effect = {
            type: args.type,
            intensity: args.intensity ?? 1.0,
            durationMs: args.durationMs ?? 500,
            startTime: Date.now(),
            fixtureIds: args.fixtureIds ?? [],
            params: args.params ?? {},
        };
        masterArbiter.addEffect(effect);
        return { success: true, type: args.type };
    });
    /**
     * Remove a specific effect
     */
    ipcMain.handle('lux:arbiter:removeEffect', (_event, type) => {
        masterArbiter.removeEffect(type);
        return { success: true, type };
    });
    /**
     * Clear all effects
     */
    ipcMain.handle('lux:arbiter:clearEffects', () => {
        masterArbiter.clearEffects();
        return { success: true };
    });
    // ═══════════════════════════════════════════════════════════════════════
    // STATUS & DEBUG
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Get arbiter status
     */
    ipcMain.handle('lux:arbiter:status', () => {
        return {
            success: true,
            status: masterArbiter.getStatus(),
        };
    });
    /**
     * Reset arbiter state
     */
    ipcMain.handle('lux:arbiter:reset', () => {
        masterArbiter.reset();
        return { success: true };
    });
    console.log('[IPC] 🎭 Arbiter handlers registered (10 channels)');
}
