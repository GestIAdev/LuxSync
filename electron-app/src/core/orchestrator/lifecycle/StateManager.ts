/**
 * WAVE 4959 PHASE 3a — StateManager
 * Extracted from TitanOrchestrator.ts (~lines 274-277, 322-332, 371, 749, 823-825, 3432-3450).
 *
 * Owns: atomic state properties (isInitialized, isRunning, mode, useBrain,
 *       consciousnessEnabled, _outputEnabled, _licenseTier, inputGain,
 *       currentLiquidLayout) and their basic getters/setters.
 */

export class StateManager {
  isInitialized = false
  isRunning = false
  mode: 'auto' | 'manual' = 'auto'
  useBrain = true
  consciousnessEnabled = true
  _outputEnabled = true
  _licenseTier: 'DJ_FOUNDER' | 'FULL_SUITE' = 'FULL_SUITE'
  inputGain = 1.0
  currentLiquidLayout: '4.1' | '7.1' = '4.1'

  // ── Output gate ─────────────────────────────────────────────────────────

  setOutputEnabled(enabled: boolean): void {
    this._outputEnabled = !!enabled
  }

  isOutputEnabled(): boolean {
    return this._outputEnabled
  }

  toggleOutputEnabled(): boolean {
    this._outputEnabled = !this._outputEnabled
    return this._outputEnabled
  }

  // ── License tier ────────────────────────────────────────────────────────

  setLicenseTier(tier: 'DJ_FOUNDER' | 'FULL_SUITE'): void {
    this._licenseTier = tier
  }

  getLicenseTier(): 'DJ_FOUNDER' | 'FULL_SUITE' {
    return this._licenseTier
  }
}
