/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛡️ WAVE 7594: SILK THROTTLE — Fire-and-Forget IPC Rate Limiter
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Leading-edge throttle: executes the FIRST call immediately (zero-latency
 * feel for the first tap), then DROPS all subsequent calls within the
 * limitMs window. After the window expires, the next call executes again.
 *
 * This is NOT a debounce (which delays execution). This is a rate limiter
 * that guarantees at most 1 execution per `limitMs` window.
 *
 * Use case: OS keyboard autorepeat fires 30+ keydown/sec. Without throttle,
 * each event creates an IPC send that floods the main process. With 25ms
 * throttle, we cap at 40 sends/sec — fast enough for zero-latency feel,
 * low enough to prevent IPC flooding.
 *
 * @module utils/throttleIpc
 * @version WAVE 7594
 */

/**
 * Create a throttled version of `fn` that executes at most once per `limitMs`.
 *
 * - Leading edge: the first call executes IMMEDIATELY.
 * - Trailing edge: dropped (no trailing execution).
 * - Within the window: all calls are silently dropped.
 *
 * @param fn    — The function to throttle (typically an IPC send).
 * @param limitMs — Minimum interval between executions. Default 25ms (40Hz).
 * @returns A throttled wrapper with the same signature as `fn`.
 */
export function throttleFn<A extends unknown[]>(
  fn: (...args: A) => void,
  limitMs: number = 25,
): (...args: A) => void {
  let lastExec = 0

  return (...args: A): void => {
    const now = typeof performance !== 'undefined'
      ? performance.now()
      : Date.now()

    if (now - lastExec >= limitMs) {
      lastExec = now
      fn(...args)
    }
    // Else: drop silently — within throttle window.
  }
}
