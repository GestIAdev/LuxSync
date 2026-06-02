/**
 * WAVE 4959 PHASE 3b — VibeLifecycleManager
 * Extracted from TitanOrchestrator.ts (~lines 2568-2788).
 *
 * Owns: vibe/mode/consciousness/liquid/mood lifecycle methods.
 * Delegates state mutations to StateManager and logging to TacticalLogManager.
 * Engine, Trinity, and HAL references are injected post-init (set during TitanOrchestrator.init()).
 */

import type { TitanEngine } from '../../../engine/TitanEngine'
import type { TrinityOrchestrator } from '../../../workers/TrinityOrchestrator'
import type { HardwareAbstraction } from '../../../hal/HardwareAbstraction'
import { MoodController } from '../../mood/MoodController'
import type { StateManager } from './StateManager'
import type { TacticalLogManager } from '../logging/TacticalLogManager'

type VibeId = 'fiesta-latina' | 'techno-club' | 'pop-rock' | 'chill-lounge' | 'idle'

export class VibeLifecycleManager {
  private engine: TitanEngine | null = null
  private trinity: TrinityOrchestrator | null = null
  private hal: HardwareAbstraction | null = null

  constructor(
    private readonly state: StateManager,
    private readonly logManager: TacticalLogManager,
  ) {}

  // ── Reference injectors (called from TitanOrchestrator.init) ────────────

  setEngine(e: TitanEngine | null): void { this.engine = e }
  setTrinity(t: TrinityOrchestrator | null): void { this.trinity = t }
  setHal(h: HardwareAbstraction | null): void { this.hal = h }

  // ── Vibe ────────────────────────────────────────────────────────────────

  setVibe(vibeId: VibeId): void {
    if (!this.engine) return

    this.engine.setVibe(vibeId)
    const normalizedVibeId = this.engine.getCurrentVibe()

    console.log(`[TitanOrchestrator] Vibe set to: ${normalizedVibeId}`)
    this.logManager.log('Mode', `🎭 Vibe changed to: ${normalizedVibeId.toUpperCase()}`)

    if (this.trinity) {
      this.trinity.setVibe(normalizedVibeId)
      console.log(`[TitanOrchestrator] 🎯 WAVE 289: Vibe propagated to Workers`)
    }

    if (this.hal) {
      this.hal.setVibe(normalizedVibeId)
      console.log(`[TitanOrchestrator] 🎛️ WAVE 338: Movement physics updated for vibe`)
    }

    if (this.trinity) {
      this.trinity.resetPacemaker()
      console.log(`[TitanOrchestrator] 🧨 WAVE 2140: Pacemaker reset triggered by vibe change → ${normalizedVibeId}`)
    }

    this.engine.setActiveProfile(normalizedVibeId)
    console.log(`[TitanOrchestrator] 🧹 WAVE 3230: Clean Slate for vibe ${normalizedVibeId}`)
  }

  // ── Palette ─────────────────────────────────────────────────────────────

  forcePaletteSync(): void {
    if (this.engine) {
      this.engine.forcePaletteRefresh()
      console.log(`[TitanOrchestrator] 🎨 Palette forcefully synced to current vibe`)
    }
  }

  // ── Mood ────────────────────────────────────────────────────────────────

  setMood(moodId: 'calm' | 'balanced' | 'punk'): void {
    if (this.engine) {
      MoodController.getInstance().setMood(moodId)
      console.log(`[TitanOrchestrator] 🎭 Mood set to: ${moodId.toUpperCase()}`)
      this.logManager.log('Mode', `🎭 Mood changed to: ${moodId.toUpperCase()}`)
    }
  }

  getMood(): 'calm' | 'balanced' | 'punk' {
    return MoodController.getInstance().getCurrentMood()
  }

  // ── Chronos ─────────────────────────────────────────────────────────────

  setChronosHeatmap(heatmap: unknown): void {
    if (this.engine) {
      this.engine.setChronosHeatmap(heatmap as any)
    }
  }

  setChronosPlayhead(timeMs: number, isPlaying: boolean): void {
    if (this.engine) {
      this.engine.setChronosPlayhead(timeMs, isPlaying)
    }
  }

  // ── Mode ────────────────────────────────────────────────────────────────

  setMode(mode: string): void {
    this.state.mode = mode as 'auto' | 'manual'
    console.log(`[TitanOrchestrator] Mode set to: ${mode}`)
    this.logManager.log('System', `⚙️ Mode: ${mode.toUpperCase()}`)
  }

  // ── Brain ───────────────────────────────────────────────────────────────

  setUseBrain(enabled: boolean): void {
    this.state.useBrain = enabled
    console.log(`[TitanOrchestrator] Brain ${enabled ? 'enabled' : 'disabled'} (FULL SYSTEM)`)
    this.logManager.log('System', `🧠 Brain: ${enabled ? 'ONLINE' : 'OFFLINE'}`)
  }

  // ── Consciousness ───────────────────────────────────────────────────────

  setConsciousnessEnabled(enabled: boolean): void {
    this.state.consciousnessEnabled = enabled

    if (this.engine) {
      this.engine.setConsciousnessEnabled(enabled)
    }

    console.log(`[TitanOrchestrator] 🧬 Consciousness ${enabled ? 'ENABLED ✅' : 'DISABLED ⏸️'}`)
    this.logManager.log('Brain', `🧬 Consciousness: ${enabled ? 'ACTIVE' : 'STANDBY'}`)
  }

  isConsciousnessEnabled(): boolean {
    return this.state.consciousnessEnabled
  }

  // ── Liquid ──────────────────────────────────────────────────────────────

  setLiquidStereo(enabled: boolean): void {
    if (this.engine) {
      this.engine.setLiquidStereo(enabled)
    }
    console.log(`[TitanOrchestrator] 🌊 Liquid Stereo: ${enabled ? 'ACTIVE' : 'OFF'}`)
    this.logManager.log('Physics', `🌊 Liquid Stereo: ${enabled ? '7-BAND' : 'GOD MODE'}`)
  }

  setLiquidLayout(mode: '4.1' | '7.1'): void {
    this.state.currentLiquidLayout = mode
    if (this.engine) {
      this.engine.setLiquidLayout(mode)
    }
    console.log(`[TitanOrchestrator] 🌊 Layout: ${mode}`)
    this.logManager.log('Physics', `🌊 Layout switched to ${mode}`)
  }

  getLiquidLayout(): '4.1' | '7.1' {
    return this.state.currentLiquidLayout
  }

  // ── Input gain ──────────────────────────────────────────────────────────

  setInputGain(gain: number): void {
    this.state.inputGain = Math.max(0, Math.min(2, gain))
    console.log(`[TitanOrchestrator] Input gain set to: ${this.state.inputGain}`)
  }
}
