/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 💡 HTP — Highest Takes Precedence
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3504: Pure, stateless HTP strategy function.
 *
 * Industry standard for INTENSITY channels (dimmer, strobe).
 * The layer with the highest DMX value wins, regardless of timestamp
 * or priority. This is an energy-maximizing rule: the show should be
 * as bright as any source intends it to be.
 *
 * @module core/arbiter/merge/strategies/HTP
 * @version WAVE 3504
 */
import { clampDMX } from '../MergeStrategies';
/**
 * Resolve N candidates via HTP.
 *
 * - Returns the candidate with the maximum value.
 * - On tie, the candidate with the highest priority wins.
 * - An empty candidates array returns { value: 0, winnerPriority: 0 }.
 *
 * @pure — no side-effects, no shared state.
 */
export function resolveHTP(candidates) {
    if (candidates.length === 0) {
        return { value: 0, winnerPriority: 0 };
    }
    let maxValue = -Infinity;
    let winnerPriority = 0;
    for (const c of candidates) {
        if (c.value > maxValue || (c.value === maxValue && c.priority > winnerPriority)) {
            maxValue = c.value;
            winnerPriority = c.priority;
        }
    }
    return { value: clampDMX(maxValue), winnerPriority };
}
