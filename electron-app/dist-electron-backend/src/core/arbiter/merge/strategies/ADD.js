/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ➕ ADD — Additive Blend
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3504: Pure, stateless ADD strategy function.
 *
 * Used for AMBIENT and ACCENT effects that contribute ON TOP of the
 * existing vibe canvas. Both sources add their values; the result is
 * clamped to [0, 255]. The vibe never disappears because of an accent.
 *
 * Optional per-candidate `weight` field allows weighted additive blend.
 * If no weight is provided, weight defaults to 1.0 (full contribution).
 *
 * Pattern: MasterArbiter WAVE 2066 "ADD" blendMode path, extracted pure.
 *
 * @module core/arbiter/merge/strategies/ADD
 * @version WAVE 3504
 */
import { clampDMX } from '../MergeStrategies';
/**
 * Resolve N candidates via additive blend.
 *
 * - Sums all candidate values (weighted if provided).
 * - Result is clamped to [0, 255].
 * - winnerPriority is the highest priority among all contributors
 *   (meaningless for ADD, but kept for API consistency).
 * - An empty candidates array returns { value: 0, winnerPriority: 0 }.
 *
 * @pure — no side-effects, no shared state.
 */
export function resolveADD(candidates) {
    if (candidates.length === 0) {
        return { value: 0, winnerPriority: 0 };
    }
    let sum = 0;
    let maxPriority = 0;
    for (const c of candidates) {
        sum += c.value * (c.weight ?? 1.0);
        if (c.priority > maxPriority)
            maxPriority = c.priority;
    }
    return { value: clampDMX(sum), winnerPriority: maxPriority };
}
