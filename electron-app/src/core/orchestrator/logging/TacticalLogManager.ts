/**
 * WAVE 4959 PHASE 1 — TacticalLogManager
 * Extracted from TitanOrchestrator.ts (~lines 714-717, 722, 728, 2795-2836).
 *
 * Owns: log callbacks (broadcast, hotFrame, tactical log), warlog state,
 *       and the log() method that pushes entries to the frontend Tactical Log.
 */

export class TacticalLogManager {
  // ── Warlog state ────────────────────────────────────────────────────────
  hasLoggedFirstAudio = false
  lastLoggedVibe = ''
  lastLoggedMood = ''
  lastLoggedBrainState = false

  // ── Callbacks ───────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onBroadcast: ((truth: any) => void) | null = null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onHotFrame: ((hotFrame: any) => void) | null = null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onLog: ((entry: any) => void) | null = null

  // ── Callback setters ────────────────────────────────────────────────────

  setBroadcastCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callback: (truth: any) => void,
  ): void {
    this.onBroadcast = callback
  }

  setHotFrameCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callback: (hotFrame: any) => void,
  ): void {
    this.onHotFrame = callback
  }

  setLogCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callback: (entry: any) => void,
  ): void {
    this.onLog = callback
  }

  // ── Getters (for TitanOrchestrator hot-path) ────────────────────────────

  getBroadcastCallback() {
    return this.onBroadcast
  }

  getHotFrameCallback() {
    return this.onHotFrame
  }

  // ── Tactical Log ────────────────────────────────────────────────────────

  log(category: string, message: string, data?: Record<string, unknown>): void {
    if (!this.onLog) return

    this.onLog({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      category,
      message,
      data: data || null,
      level: category === 'Error' ? 'error' : 'info',
    })
  }
}
