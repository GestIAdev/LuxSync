/**
 * WAVE 4959 PHASE 1 — TacticalLogManager
 * Extracted from TitanOrchestrator.ts (~lines 714-717, 722, 728, 2795-2836).
 *
 * Owns: log callbacks (broadcast, hotFrame, tactical log), warlog state,
 *       and the log() method that pushes entries to the frontend Tactical Log.
 */
export class TacticalLogManager {
    constructor() {
        // ── Warlog state ────────────────────────────────────────────────────────
        this.hasLoggedFirstAudio = false;
        this.lastLoggedVibe = '';
        this.lastLoggedMood = '';
        this.lastLoggedBrainState = false;
        // ── Callbacks ───────────────────────────────────────────────────────────
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.onBroadcast = null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.onHotFrame = null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.onLog = null;
    }
    // ── Callback setters ────────────────────────────────────────────────────
    setBroadcastCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callback) {
        this.onBroadcast = callback;
    }
    setHotFrameCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callback) {
        this.onHotFrame = callback;
    }
    setLogCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callback) {
        this.onLog = callback;
    }
    // ── Getters (for TitanOrchestrator hot-path) ────────────────────────────
    getBroadcastCallback() {
        return this.onBroadcast;
    }
    getHotFrameCallback() {
        return this.onHotFrame;
    }
    // ── Tactical Log ────────────────────────────────────────────────────────
    log(category, message, data) {
        if (!this.onLog)
            return;
        this.onLog({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: Date.now(),
            category,
            message,
            data: data || null,
            level: category === 'Error' ? 'error' : 'info',
        });
    }
}
