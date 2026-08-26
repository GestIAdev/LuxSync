Let me investigate both theories in parallel:

Now let me read the distance scale calculation and the airbag middleware:

Now let me check how the resolver applies the airbag to the IK path:

Now I have the complete picture. Here's the diagnostic report:

---

# FORENSIC REPORT: CLIPPING & AIRBAG PANIC (WAVE 7625-DIAGNOSTIC)

## Bug 1: The 20% Clip — `_spatialDistanceScales` Theory

### Theory: PARTIALLY CONFIRMED (but not the root cause you'd expect)

The distance scale calculation is in `AetherIPCHandlers.ts`:

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\AetherIPCHandlers.ts" lines="999-1017" />

```typescript
const D_REF = 8.0  // metros — distancia "de diseño"
for (const fi of fixtureInputs) {
  const dx = fi.position.x - target.x
  const dy = fi.position.y - target.y
  const dz = fi.position.z - target.z
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
  if (!Number.isFinite(distance) || distance < 1e-6) {
    arbiter.setSpatialDistanceScale(..., 2.0)  // max clamp
    resolver.setSpatialDistanceScale(..., 2.0)
    continue
  }
  const scale = D_REF / distance
  arbiter.setSpatialDistanceScale(..., scale)
  resolver.setSpatialDistanceScale(..., scale)
}
```

The setter clamps to `[0.25, 2.0]`:

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts" lines="365-368" />

```typescript
setSpatialDistanceScale(nodeId: NodeId, scale: number): void {
  if (!Number.isFinite(scale)) return
  const clamped = scale < 0.25 ? 0.25 : scale > 2 ? 2 : scale
  this._spatialDistanceScales.set(nodeId, clamped)
}
```

**For a top-center fixture directly overhead the target**: `distance ≈ height_diff` (e.g., 3m if fixture is at y=4m and target at y=1m). `scale = 8.0 / 3.0 = 2.67 → clamped to 2.0`. For a bottom-center fixture at y=0.5m, target at y=1m: `distance ≈ 0.5m + horizontal_offset`, `scale = 8.0 / 0.5 = 16 → clamped to 2.0`. **Both clamp to 2.0**, so the scale itself isn't the differentiator.

**The actual clipping mechanism**: The offset is applied in DMX space:

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts" lines="1675-1691" />

```typescript
const amp = this._relativeOffsetAmplitude        // 1.0
const distScale = this._spatialDistanceScales.get(node.nodeId) ?? 1.0  // 2.0 for overhead

// Pan:
const panDelta = (panOffset) * amp * VMM_OFFSET_SCALE_PAN * distScale * gimbalFactor * 255
//             = (0.5)      * 1.0 * 0.5                  * 2.0       * 1.0         * 255
//             = 127.5 DMX  ← MASSIVE delta

// Tilt:
const tiltDelta = (tiltOffset) * amp * VMM_OFFSET_SCALE_TILT * distScale * 255
//              = (0.5)       * 1.0 * 0.5                   * 2.0       * 255
//              = 127.5 DMX   ← MASSIVE delta
```

With `distScale = 2.0` and `amp = 1.0`, the maximum offset delta is:
- `panDelta_max = 1.0 * 1.0 * 0.5 * 2.0 * 1.0 * 255 = 255 DMX` — the ENTIRE range
- `tiltDelta_max = 1.0 * 1.0 * 0.5 * 2.0 * 255 = 255 DMX` — the ENTIRE range

**The top-center fixture clips because**: Its IK solution sits near pan=127 (center). The sweep pattern produces `pan_offset` oscillating in `[-0.5, +0.5] * amplitude`. With `distScale=2.0`, the delta is `±127.5 DMX`. So `logicalPan = 127 + 127.5 = 254.5` → clamped to 255 by `sanitizeDmxByte`. The fixture hits the mechanical limit and **sticks there for the portion of the sweep cycle where the offset is near maximum**, then releases when the offset swings back. This is the "stuck at the end of its sweep range for a couple of seconds" behavior.

**The bottom-center fixture doesn't clip because**: Its IK solution is at a different pan (off-center), so the same delta doesn't hit the 0/255 clamp.

### The fix

**Cap the effective offset delta to a maximum of ~40% of the DMX range** (±100 DMX), regardless of `distScale`. The `distScale` was designed for the VMM's gentle L0 offsets (±0.3 amplitude), not the L2 engine's full ±1.0 offsets. Two options:

**Option A (simplest)**: Reduce `VMM_OFFSET_SCALE_PAN`/`VMM_OFFSET_SCALE_TILT` when in IK mode (L2 pattern offsets are larger than VMM offsets). But this would also reduce the VMM's L0 offsets.

**Option B (per-source scaling)**: Clamp the final `panDelta`/`tiltDelta` to a maximum:

```typescript
const MAX_OFFSET_DMX = 100  // ~40% of 255
let panDelta = (panOffset as number) * amp * VMM_OFFSET_SCALE_PAN * distScale * gimbalFactor * 255
panDelta = Math.max(-MAX_OFFSET_DMX, Math.min(MAX_OFFSET_DMX, panDelta))
logicalPan = logicalPan + panDelta
```

**Option C (distScale cap for IK mode)**: Cap `distScale` to 1.0 when the offset comes from the L2 engine (IK mode). The `distScale > 1.0` was designed for the VMM's small offsets to compensate for distance. The L2 engine's offsets are already amplitude-scaled by the user, so `distScale` amplification is redundant and causes clipping.

---

## Bug 2: The Airbag Panic on Pattern Switch

### Theory: CONFIRMED — Velocity Clamp triggers on fade-in reset

The airbag has two mechanisms:

**1. Velocity Clamp** (`clampKineticVelocityInto`, lines 187-226):

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\egress\AetherSafetyMiddleware.ts" lines="207-218" />

```typescript
const dtSec = dtMs * 0.001
const lim = VIBE_REV_LIMITS[this._vibeId]
const maxPan  = Math.min(lim ? lim.pan  : KINETIC_DEFAULT_REV_PAN,  KINETIC_SAFETY_CAP_VEL) * dtSec
const maxTilt = Math.min(lim ? lim.tilt : KINETIC_DEFAULT_REV_TILT, KINETIC_SAFETY_CAP_VEL) * dtSec

let dP = panDMX - state[KS_LAST_PAN]
let dT = tiltDMX - state[KS_LAST_TILT]

if (dP > maxPan) { dP = maxPan; this._velocityClamps++ }
else if (dP < -maxPan) { dP = -maxPan; this._velocityClamps++ }
if (dT > maxTilt) { dT = maxTilt; this._velocityClamps++ }
else if (dT < -maxTilt) { dT = -maxTilt; this._velocityClamps++ }
```

For `techno-club`: `maxPan = 300 * 0.0227 = 6.8 DMX/frame`, `maxTilt = 220 * 0.0227 = 5.0 DMX/frame`.

**2. Airbag** (`applyAirbag`, lines 266-271): Clamps to `[5, 250]` margin.

**The trigger scenario on pattern switch**:

1. **Frame N**: Sweep at full amplitude. `pan_offset = 0.5 * 0.5 = 0.25`. `panDelta = 0.25 * 1.0 * 0.5 * 2.0 * 1.0 * 255 = 63.75 DMX`. `safePan = 127 + 63 = 190`. Velocity clamp allows `6.8 DMX/frame` → clamps to `127 + 6.8 = 133.8`. The clamp SLOWLY tracks toward 190 over many frames.

2. **Pattern switch**: `_offsetFadeIn` resets to 0. `pan_offset = 0.25 * 0 = 0`. `panDelta = 0`. `safePan = 127 + 0 = 127`. But the velocity clamp's `state[KS_LAST_PAN]` is at `133.8` (slowly tracking toward 190). Now the target jumps from 133.8 to 127 — a delta of `-6.8`, which is within the clamp limit. **No airbag trigger here.**

3. **But the REAL problem**: The fade-in resets to 0, but the **previous pattern's offset is still in the motor override** from the last tick. The `setManualKinetics` call happens between ticks. On the next tick, the L2 engine writes `pan_offset = x * amplitude * fadeIn = x * 0.5 * 0 = 0`. But the arbiter's motor override still has the OLD `pan_offset` from the previous tick until the L2 engine's `tick()` runs and overwrites it.

   **Wait** — the L2 engine's `tick()` runs every frame and overwrites the motor override. So the old offset is gone immediately. The issue is different.

4. **The actual trigger**: When the fade-in resets to 0, the offset drops to 0 in one frame. But the velocity clamp's `state[KS_LAST_PAN]` was tracking toward the offset-polluted value (e.g., 190). Now the target is 127 (pure IK, no offset). The delta is `127 - 190 = -63`. The velocity clamp limits this to `-6.8/frame`. So the fixture SLOWLY moves from 190 back to 127 over ~10 seconds. **During this time, the fixture is pointing in the wrong direction** — it's still at 190 while the pattern is trying to orbit around 127.

   **But the "airbag panic" with random ceiling/sides**: This happens when the TILT offset drops to 0. The velocity clamp was tracking toward `127 + 63 = 190` (tilt). Now the target is 127. The clamp slowly moves from 190 to 127. But for ceiling fixtures with tilt inversion (`255 - safeTilt`), 190 becomes 65, and 127 becomes 128. The clamp sees a delta of `128 - 65 = +63`, limits to `+5/frame`. The fixture slowly moves from 65 to 128 — **which is from ceiling-pointing to center**. This looks like "pointing randomly at the ceiling" because the clamp is stuck at the old offset-polluted value.

5. **The chaotic behavior**: If the user switches patterns multiple times rapidly, the velocity clamp's state gets confused — it's tracking toward a moving target that jumps between offset-polluted and pure IK values. The clamp can't keep up, and the fixture appears to point randomly.

### The fix

**The velocity clamp is fighting the fade-in.** The fade-in smoothly reduces the offset to 0, but the velocity clamp's `state[KS_LAST_PAN]` is at the old offset-polluted position. When the fade-in brings the offset to 0, the target jumps, and the clamp slowly tracks — causing the "stuck at old position" behavior.

**Option A: Reset the velocity clamp state on pattern switch.** When `setManualKinetics` is called, reset the safety middleware's kinetic state for the affected nodes. This lets the fixture snap to the new pure-IK position without the clamp fighting it:

```typescript
// In setManualKinetics, after resetting _offsetFadeIn:
const sm = getTitanOrchestrator().getAetherResolver().getSafetyMiddleware()
if (sm) {
  for (const nodeId of nodeIds) {
    sm.resetKineticState(nodeId)  // new method — sets KS_INIT = 0
  }
}
```

**Option B: Replace the fade-in with an EMA (Exponential Moving Average) on the emitted offsets.** Instead of resetting to 0 and ramping up, smoothly interpolate from the previous offset value to the new pattern's offset:

```typescript
// In tick(), instead of fade-in:
const targetOffsetX = x * cfg.amplitude
const targetOffsetY = y * cfg.amplitude
const EMA_ALPHA = 0.05  // ~1 second time constant at 44Hz
let smoothOffsetX = this._smoothOffsetX.get(nodeId) ?? 0
let smoothOffsetY = this._smoothOffsetY.get(nodeId) ?? 0
smoothOffsetX += (targetOffsetX - smoothOffsetX) * EMA_ALPHA
smoothOffsetY += (targetOffsetY - smoothOffsetY) * EMA_ALPHA
this._smoothOffsetX.set(nodeId, smoothOffsetX)
this._smoothOffsetY.set(nodeId, smoothOffsetY)

rec['pan_offset']  = smoothOffsetX
rec['tilt_offset'] = smoothOffsetY
```

**The EMA is better than the fade-in** because:
1. It doesn't reset to 0 — it starts from the previous offset value, so there's no single-frame jump
2. It smoothly transitions between any two offset values (pattern switch, amplitude change, etc.)
3. It acts as a low-pass filter, preventing any sudden delta from reaching the velocity clamp
4. The velocity clamp sees a smooth trajectory, not a step function

**The EMA + velocity clamp reset on pattern switch** is the optimal combination:
- EMA prevents the offset delta from spiking
- Velocity clamp reset prevents the clamp from fighting the new trajectory

---

## Summary of Proposed Fixes

| Bug | Root Cause | Fix | Location |
|-----|-----------|-----|----------|
| **20% Clip** | `distScale=2.0` amplifies the L2 offset to ±127 DMX, hitting the 0/255 clamp | Cap the final `panDelta`/`tiltDelta` to ±100 DMX (or cap `distScale` to 1.0 for L2 offsets) | `NodeResolver._writeNodeIK` (8-bit + 16-bit paths) |
| **Airbag Panic** | Fade-in reset to 0 creates a step function; velocity clamp's state is at old offset-polluted position, slowly tracking back | Replace fade-in with EMA on emitted offsets + reset velocity clamp state on pattern switch | `AetherKineticEngine.tick` + `AetherSafetyMiddleware` |

**Recommended implementation**:
1. Add `MAX_OFFSET_DMX = 100` clamp in `NodeResolver._writeNodeIK` (both 8-bit and 16-bit paths)
2. Replace `_offsetFadeIn` with `_smoothOffsetX`/`_smoothOffsetY` EMA maps in `AetherKineticEngine`
3. Add `resetKineticState(nodeId)` method to `AetherSafetyMiddleware`
4. Call `resetKineticState` for affected nodes in `setManualKinetics`