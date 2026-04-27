/**
 * WAVE 3504.5 — ORCHESTRATOR SLIMMING
 * FrameScheduler — The Heartbeat Master.
 *
 * Extracted from TitanOrchestrator.ts: the setInterval(23 ms) loop and
 * the WAVE 2211 Async Stampede Guard (isProcessingFrame flag).
 *
 * ─── RESPONSIBILITIES ────────────────────────────────────────────────────────
 *  • Maintain the 23 ms interval (44 Hz engine tick)
 *  • Guarantee non-overlapping pipeline calls via isProcessingFrame guard
 *  • Expose start() / stop() lifecycle methods
 *
 * ─── WHAT DOES NOT LIVE HERE ────────────────────────────────────────────────
 *  • Zero imports from singletons, DMX, IPC, or audio subsystems.
 *  • Zero audio processing, zero business logic.
 *  • The tick callback is injected — scheduler is agnostic to what it calls.
 */

// ─── TYPES ───────────────────────────────────────────────────────────────────

/** Async callback invoked each tick if no previous tick is still running. */
export type FrameTickCallback = () => Promise<void>

// ─── CLASS ────────────────────────────────────────────────────────────────────

/**
 * Fixed-interval scheduler with async stampede protection.
 *
 * @example
 * ```ts
 * const scheduler = new FrameScheduler(23, () => pipeline.tick())
 * scheduler.start()
 * // later:
 * await scheduler.stop()
 * ```
 */
export class FrameScheduler {
  // ─── STATE ─────────────────────────────────────────────────────────────────

  /**
   * WAVE 2211: ASYNC STAMPEDE GUARD
   *
   * setInterval fires every Xms regardless of whether the previous
   * processFrame() has finished. Since processFrame() is async (await engine.update()),
   * overlapping calls corrupt shared state (HAL dt, arbiter positions, physics).
   * This flag ensures only ONE processFrame() runs at a time.
   */
  private isProcessingFrame = false
  private intervalHandle: NodeJS.Timeout | null = null
  private _isRunning = false

  // ─── CONSTRUCTOR ───────────────────────────────────────────────────────────

  /**
   * @param intervalMs  Tick interval in milliseconds. Default 23 ms ≈ 44 Hz.
   *                    WAVE 2510: 44 Hz feeds the RenderWorker hot-frames at
   *                    Nyquist-safe rate, resolving strobes up to 22 Hz.
   * @param tick        Async callback invoked each tick (when not already busy).
   */
  constructor(
    private readonly intervalMs: number = 23,
    private readonly tick: FrameTickCallback,
  ) {}

  // ─── LIFECYCLE ─────────────────────────────────────────────────────────────

  /**
   * Start the scheduler. No-op if already running.
   */
  start(): void {
    if (this._isRunning) return

    this._isRunning = true
    this.intervalHandle = setInterval(() => {
      this._onInterval()
    }, this.intervalMs)
  }

  /**
   * Stop the scheduler. Returns a Promise that resolves once any in-flight tick
   * has been allowed to complete (polls every 4 ms, up to 200 ms).
   *
   * Callers should await this so that stop() from TitanOrchestrator honours the
   * ZOMBIE KILLER blackout-then-wait pattern.
   */
  async stop(): Promise<void> {
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle)
      this.intervalHandle = null
    }
    this._isRunning = false

    // Wait up to 200 ms for any in-flight tick to finish
    if (this.isProcessingFrame) {
      await new Promise<void>(resolve => {
        const poll = setInterval(() => {
          if (!this.isProcessingFrame) {
            clearInterval(poll)
            resolve()
          }
        }, 4)
        // Safety timeout: resolve anyway after 200 ms
        setTimeout(() => { clearInterval(poll); resolve() }, 200)
      })
    }
  }

  // ─── PUBLIC ACCESSORS ──────────────────────────────────────────────────────

  /** True while the scheduler interval is active. */
  get isRunning(): boolean {
    return this._isRunning
  }

  /** True while a tick callback is in progress. Useful for diagnostics. */
  get isBusy(): boolean {
    return this.isProcessingFrame
  }

  // ─── PRIVATE ───────────────────────────────────────────────────────────────

  private _onInterval(): void {
    // STAMPEDE GUARD: skip this tick completely if previous is still running.
    // No data loss — the NEXT interval fires with a correct dt measurement.
    if (this.isProcessingFrame) return

    this.isProcessingFrame = true
    this.tick().finally(() => {
      this.isProcessingFrame = false
    })
  }
}
