/**
 * WAVE 4959 PHASE 3a — StateManager
 * Extracted from TitanOrchestrator.ts (~lines 274-277, 322-332, 371, 749, 823-825, 3432-3450).
 *
 * Owns: atomic state properties (isInitialized, isRunning, mode, useBrain,
 *       consciousnessEnabled, _outputEnabled, _licenseTier, inputGain,
 *       currentLiquidLayout) and their basic getters/setters.
 */
export class StateManager {
    constructor() {
        this.isInitialized = false;
        this.isRunning = false;
        this.mode = 'auto';
        this.useBrain = true;
        this.consciousnessEnabled = true;
        this._outputEnabled = true;
        this._licenseTier = 'FULL_SUITE';
        this.inputGain = 1.0;
        this.currentLiquidLayout = '4.1';
    }
    // ── Output gate ─────────────────────────────────────────────────────────
    setOutputEnabled(enabled) {
        this._outputEnabled = !!enabled;
    }
    isOutputEnabled() {
        return this._outputEnabled;
    }
    toggleOutputEnabled() {
        this._outputEnabled = !this._outputEnabled;
        return this._outputEnabled;
    }
    // ── License tier ────────────────────────────────────────────────────────
    setLicenseTier(tier) {
        this._licenseTier = tier;
    }
    getLicenseTier() {
        return this._licenseTier;
    }
}
