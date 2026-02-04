/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎛️ ARBITER IPC HANDLERS - WAVE 376
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * IPC bridges for MasterArbiter operations:
 * - Grand Master (global dimmer control)
 * - Pattern Engine (Circle, Eight, Sweep)
 * - Group Formations (Radar control)
 * - Manual Overrides (UI controls)
 *
 * @module core/arbiter/ArbiterIPCHandlers
 * @version WAVE 376
 */
import { ipcMain } from 'electron';
import { getTitanOrchestrator } from '../orchestrator/TitanOrchestrator';
import { vibeMovementManager } from '../../engine/movement/VibeMovementManager';
/**
 * Register all Arbiter IPC handlers
 * Call this from main.ts during initialization
 */
export function registerArbiterHandlers(masterArbiter) {
    // ═══════════════════════════════════════════════════════════════════════
    // GRAND MASTER
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Set Grand Master level (0-1)
     * Multiplies dimmer for ALL fixtures globally.
     */
    ipcMain.handle('lux:arbiter:setGrandMaster', (_event, { value }) => {
        masterArbiter.setGrandMaster(value);
        return { success: true, grandMaster: masterArbiter.getGrandMaster() };
    });
    /**
     * Get current Grand Master level
     */
    ipcMain.handle('lux:arbiter:getGrandMaster', () => {
        return { grandMaster: masterArbiter.getGrandMaster() };
    });
    // ═══════════════════════════════════════════════════════════════════════
    // PATTERN ENGINE
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Set pattern for fixtures (Circle, Eight, Sweep)
     */
    ipcMain.handle('lux:arbiter:setPattern', (_event, { fixtureIds, pattern, }) => {
        masterArbiter.setPattern(fixtureIds, pattern);
        return { success: true, patternType: pattern.type, fixtureCount: fixtureIds.length };
    });
    /**
     * Clear pattern for fixtures
     */
    ipcMain.handle('lux:arbiter:clearPattern', (_event, { fixtureIds }) => {
        masterArbiter.clearPattern(fixtureIds);
        return { success: true, clearedCount: fixtureIds.length };
    });
    // ═══════════════════════════════════════════════════════════════════════
    // GROUP FORMATIONS
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Set group formation (Radar control)
     * Moves group center while maintaining relative spacing.
     */
    ipcMain.handle('lux:arbiter:setGroupFormation', (_event, { groupId, fixtureIds, center, fan, }) => {
        masterArbiter.setGroupFormation(groupId, fixtureIds, center, fan);
        return { success: true, groupId, fixtureCount: fixtureIds.length };
    });
    /**
     * Clear group formation
     */
    ipcMain.handle('lux:arbiter:clearGroupFormation', (_event, { groupId }) => {
        masterArbiter.clearGroupFormation(groupId);
        return { success: true, groupId };
    });
    // ═══════════════════════════════════════════════════════════════════════
    // MANUAL OVERRIDES
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Set manual override for fixtures
     * Example from UI Programmer panel
     */
    ipcMain.handle('lux:arbiter:setManual', (_event, { fixtureIds, controls, channels, }) => {
        // 🔥 WAVE 1008.4: Debug log BEFORE validation
        console.log(`[Arbiter] 📥 setManual RAW:`, { fixtureIds, controls, channels, speed: controls?.speed });
        // Validate required parameters
        if (!fixtureIds || !Array.isArray(fixtureIds) || fixtureIds.length === 0) {
            console.error('[Arbiter] setManual: Invalid or empty fixtureIds', { fixtureIds, controls, channels });
            return { success: false, error: 'Invalid or empty fixtureIds' };
        }
        if (!controls || typeof controls !== 'object') {
            console.error('[Arbiter] setManual: Invalid controls', { fixtureIds, controls, channels });
            return { success: false, error: 'Invalid controls' };
        }
        if (!channels || !Array.isArray(channels) || channels.length === 0) {
            console.error('[Arbiter] setManual: Invalid or empty channels', { fixtureIds, controls, channels });
            return { success: false, error: 'Invalid or empty channels' };
        }
        const overrideCount = fixtureIds.length;
        for (const fixtureId of fixtureIds) {
            const override = {
                fixtureId,
                controls: controls,
                overrideChannels: channels,
                mode: 'absolute',
                source: 'ui_programmer',
                priority: 100,
                autoReleaseMs: 0, // Don't auto-release
                releaseTransitionMs: 500, // 500ms crossfade on release
                timestamp: performance.now(),
            };
            masterArbiter.setManualOverride(override);
        }
        return { success: true, overrideCount };
    });
    /**
     * Release manual override for fixtures
     * Starts crossfade back to AI control
     */
    ipcMain.handle('lux:arbiter:clearManual', (_event, { fixtureIds, channels, }) => {
        const releaseCount = fixtureIds.length;
        for (const fixtureId of fixtureIds) {
            masterArbiter.releaseManualOverride(fixtureId, channels);
        }
        return { success: true, releaseCount };
    });
    /**
     * Release ALL manual overrides (panic button - ESC key)
     */
    ipcMain.handle('lux:arbiter:releaseAll', () => {
        masterArbiter.releaseAllManualOverrides();
        return { success: true };
    });
    // ═══════════════════════════════════════════════════════════════════════
    // 🎚️ WAVE 999: MOVEMENT PARAMETERS (Speed & Amplitude)
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Set movement parameter (speed or amplitude)
     * Called from PositionSection.tsx when user moves tactical sliders
     */
    ipcMain.handle('lux:arbiter:setMovementParameter', (_event, { parameter, value, }) => {
        if (parameter === 'speed') {
            vibeMovementManager.setManualSpeed(value);
            console.log(`[Arbiter IPC] 🚀 Movement SPEED: ${value === null ? 'RELEASED' : value + '%'}`);
        }
        else if (parameter === 'amplitude') {
            vibeMovementManager.setManualAmplitude(value);
            console.log(`[Arbiter IPC] 📏 Movement AMPLITUDE: ${value === null ? 'RELEASED' : value + '%'}`);
        }
        return { success: true, parameter, value };
    });
    /**
     * Clear all movement parameter overrides
     */
    ipcMain.handle('lux:arbiter:clearMovementOverrides', () => {
        vibeMovementManager.clearManualOverrides();
        return { success: true };
    });
    /**
     * 🎯 WAVE 999.4: Set manual movement pattern
     * Called from PatternSelector when user clicks a pattern button
     */
    ipcMain.handle('lux:arbiter:setMovementPattern', (_event, { pattern, }) => {
        vibeMovementManager.setManualPattern(pattern);
        console.log(`[Arbiter IPC] 🎯 Movement PATTERN: ${pattern === null ? 'RELEASED → AI' : pattern}`);
        return { success: true, pattern };
    });
    // ═══════════════════════════════════════════════════════════════════════
    // 🧠 WAVE 999.6: STATE HYDRATION - Get current fixture state for UI sync
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Get unified state snapshot for fixtures (for UI hydration)
     * Strategy: "Follow the Leader" - returns state of FIRST fixture
     *
     * Returns null for channels controlled by AI (not manually overridden)
     */
    ipcMain.handle('lux:arbiter:getFixturesState', (_event, { fixtureIds }) => {
        if (fixtureIds.length === 0) {
            return { success: false, error: 'No fixture IDs provided' };
        }
        // Get movement overrides (global - applies to all fixtures)
        const movementOverrides = vibeMovementManager.getManualOverrides();
        // Get fixture-specific override for FIRST fixture (Leader strategy)
        const leaderId = fixtureIds[0];
        const fixtureOverride = masterArbiter.getManualOverride(leaderId);
        // Build unified state snapshot
        const state = {
            // === INTENSITY ===
            // dimmer: null = AI control, 0-100 = manual override
            dimmer: fixtureOverride?.controls?.dimmer !== undefined
                ? Math.round(fixtureOverride.controls.dimmer / 2.55) // 0-255 → 0-100
                : null,
            // === COLOR ===
            // color: null = AI control, hex string = manual override
            color: (fixtureOverride?.controls?.red !== undefined &&
                fixtureOverride?.controls?.green !== undefined &&
                fixtureOverride?.controls?.blue !== undefined)
                ? `#${fixtureOverride.controls.red.toString(16).padStart(2, '0')}${fixtureOverride.controls.green.toString(16).padStart(2, '0')}${fixtureOverride.controls.blue.toString(16).padStart(2, '0')}`
                : null,
            // === POSITION (from fixture override) ===
            pan: fixtureOverride?.controls?.pan !== undefined
                ? Math.round((fixtureOverride.controls.pan / 255) * 540) // 0-255 → 0-540
                : null,
            tilt: fixtureOverride?.controls?.tilt !== undefined
                ? Math.round((fixtureOverride.controls.tilt / 255) * 270) // 0-255 → 0-270
                : null,
            // === MOVEMENT (global overrides) ===
            pattern: movementOverrides.pattern, // 'circle', 'hold', etc. or null
            speed: movementOverrides.speed, // 0-100 or null
            amplitude: movementOverrides.amplitude, // 0-100 or null
            // === BEAM (from fixture override) ===
            zoom: fixtureOverride?.controls?.zoom !== undefined
                ? Math.round(fixtureOverride.controls.zoom / 2.55)
                : null,
            focus: fixtureOverride?.controls?.focus !== undefined
                ? Math.round(fixtureOverride.controls.focus / 2.55)
                : null,
        };
        console.log(`[Arbiter IPC] 🧠 State Hydration for ${fixtureIds.length} fixtures (Leader: ${leaderId})`);
        return { success: true, state };
    });
    // ═══════════════════════════════════════════════════════════════════════
    // EFFECTS
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Add effect (Strobe, Blinder, Smoke, etc.)
     */
    ipcMain.handle('lux:arbiter:addEffect', (_event, { type, intensity, durationMs, fixtureIds, params, }) => {
        masterArbiter.addEffect({
            type: type,
            intensity,
            durationMs,
            startTime: 0, // Will be set by arbiter
            fixtureIds,
            params,
        });
        return { success: true, type };
    });
    /**
     * Remove effect
     */
    ipcMain.handle('lux:arbiter:removeEffect', (_event, { type }) => {
        masterArbiter.removeEffect(type);
        return { success: true, type };
    });
    // ═══════════════════════════════════════════════════════════════════════
    // BLACKOUT
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Set blackout state
     */
    ipcMain.handle('lux:arbiter:setBlackout', (_event, { active }) => {
        masterArbiter.setBlackout(active);
        return { success: true, blackoutActive: masterArbiter.isBlackoutActive() };
    });
    /**
     * Toggle blackout
     */
    ipcMain.handle('lux:arbiter:toggleBlackout', () => {
        const result = masterArbiter.toggleBlackout();
        return { success: true, blackoutActive: result };
    });
    // ═══════════════════════════════════════════════════════════════════════
    // 🚦 WAVE 1132: OUTPUT GATE - THE COLD START PROTOCOL
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Set output enabled state (THE GATE)
     * When false: System is ARMED - engine runs, calculates, but DMX stays at safe values
     * When true: System is LIVE - DMX flows to fixtures
     */
    ipcMain.handle('lux:arbiter:setOutputEnabled', (_event, { enabled }) => {
        masterArbiter.setOutputEnabled(enabled);
        return {
            success: true,
            outputEnabled: masterArbiter.isOutputEnabled(),
            state: masterArbiter.isOutputEnabled() ? 'LIVE' : 'ARMED'
        };
    });
    /**
     * Toggle output gate (ARMED ↔ LIVE)
     */
    ipcMain.handle('lux:arbiter:toggleOutput', () => {
        const result = masterArbiter.toggleOutput();
        return {
            success: true,
            outputEnabled: result,
            state: result ? 'LIVE' : 'ARMED'
        };
    });
    /**
     * Get output enabled state
     */
    ipcMain.handle('lux:arbiter:getOutputEnabled', () => {
        return {
            outputEnabled: masterArbiter.isOutputEnabled(),
            state: masterArbiter.isOutputEnabled() ? 'LIVE' : 'ARMED'
        };
    });
    // ═══════════════════════════════════════════════════════════════════════
    // CALIBRATION MODE - WAVE 377
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Enter calibration mode for a fixture
     * This sets a special manual override that only affects pan/tilt
     * and marks the fixture as being calibrated (UI indicator)
     */
    ipcMain.handle('lux:arbiter:enterCalibrationMode', (_event, { fixtureId }) => {
        console.log(`[Arbiter] 🎯 Entering calibration mode for ${fixtureId}`);
        // Set manual override for position channels only
        const override = {
            fixtureId,
            controls: {}, // Values will be set by user via setManual
            overrideChannels: ['pan', 'tilt'],
            mode: 'absolute',
            source: 'calibration', // Special source for calibration
            priority: 200, // Higher than normal manual (100)
            autoReleaseMs: 0, // Never auto-release during calibration
            releaseTransitionMs: 1000, // 1s smooth return on exit
            timestamp: performance.now(),
        };
        masterArbiter.setManualOverride(override);
        return {
            success: true,
            fixtureId,
            mode: 'calibration',
            message: 'Calibration mode active - pan/tilt under manual control'
        };
    });
    /**
     * Exit calibration mode for a fixture
     * Smoothly transitions back to AI control
     */
    ipcMain.handle('lux:arbiter:exitCalibrationMode', (_event, { fixtureId }) => {
        console.log(`[Arbiter] 🎯 Exiting calibration mode for ${fixtureId}`);
        masterArbiter.releaseManualOverride(fixtureId, ['pan', 'tilt']);
        return {
            success: true,
            fixtureId,
            message: 'Calibration complete - returning to AI control'
        };
    });
    /**
     * Check if fixture is in calibration mode
     */
    ipcMain.handle('lux:arbiter:isCalibrating', (_event, { fixtureId }) => {
        const override = masterArbiter.getManualOverride(fixtureId);
        return {
            isCalibrating: override?.source === 'calibration',
            channels: override?.overrideChannels || []
        };
    });
    // ═══════════════════════════════════════════════════════════════════════
    // FIXTURE SYNC - WAVE 377 (TitanSyncBridge)
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Update fixtures from frontend stageStore
     * Called by TitanSyncBridge when patch changes
     * WAVE 380: Now also updates TitanOrchestrator.fixtures for the render loop
     */
    ipcMain.handle('lux:arbiter:setFixtures', (_event, { fixtures }) => {
        // Update MasterArbiter (for arbitration)
        masterArbiter.setFixtures(fixtures);
        // WAVE 380 FIX: ALSO update TitanOrchestrator (for the render loop)
        // Without this, the orchestrator loop runs with 0 fixtures!
        const orchestrator = getTitanOrchestrator();
        orchestrator.setFixtures(fixtures);
        console.log(`[ArbiterIPC] 🩸 WAVE 380: Synced ${fixtures.length} fixtures to Arbiter + Orchestrator`);
        return {
            success: true,
            fixtureCount: fixtures.length,
            message: `Arbiter + Orchestrator synced with ${fixtures.length} fixtures`
        };
    });
    // ═══════════════════════════════════════════════════════════════════════
    // STATUS & DEBUG
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Get arbiter status for UI (layer activity, overrides count, etc.)
     */
    ipcMain.handle('lux:arbiter:status', () => {
        return {
            status: masterArbiter.getStatus(),
            grandMaster: masterArbiter.getGrandMaster(),
            blackout: masterArbiter.isBlackoutActive(),
        };
    });
}
export default registerArbiterHandlers;
