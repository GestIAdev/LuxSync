The most likely source is `AetherKineticEngine.ts` (matches at lines 241, 254, 261, 295). Let me read that region.

The `circle` math itself (`sin(p)`, `cos(p)`) is geometrically perfect. The figure-8 must come from downstream — the comments mention `PAN_ASPECT_RATIO` applied in `tick()`. Let me audit `tick()` and the phase accumulator.

Now let me find the `tick()` method to see how the pattern output is transformed and where `PAN_ASPECT_RATIO` is applied.

Found the critical clue. In IK mode, the raw `(sin(p), cos(p))` is emitted as offsets, and in `NodeResolver.ts:1703-1709` a **gimbal-lock fade** multiplies the pan delta by a factor that depends on tilt position. Let me verify the gimbal constants and the VMM offset scales.

Let me examine the phase advancement logic and the full tick() loop to check for frequency/phase issues.

The `circle` and `eight` generators themselves look mathematically correct. Let me check if there's another pattern definition that might override, and examine the `patternMath.ts` and the IPC handler that routes pattern selection.

Let me check the `NativeKineticPattern` type definition and the IPC handler to confirm which patterns are L2 native and how they're routed.

Let me check the UI pattern selector to verify what pattern name is sent when the user selects "circle", and also look at the VibeMovementManager for any alternate circle definition.

Let me check the IPC handler flow to see which engine processes the pattern, and whether VMM might still be involved.

Let me check the VMM patterns and whether VMM could still be emitting movement that interferes with the L2 engine.

Let me search for any documentation or recent changes related to the circle figure-8 issue.

The `HardwareAbstraction.ts` mentions applying phase offsets to circle/figure8 patterns. This could be where the distortion happens. Let me examine it.

Let me check one final critical piece — the velocity clamp in the safety middleware, which could also distort the circle.

I now have the complete picture. Let me compile the forensic report.

---

# WAVE 7638-PATTERNS FORENSIC REPORT — LISSAJOUS KNOT DIAGNOSTIC

## 1. Pattern Generator Location

The L2 manual pattern generators are defined in `AetherKineticEngine.ts` at the `PATTERN_FNS` dictionary (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\AetherKineticEngine.ts" lines="234-323" />). Pattern routing is confirmed correct: UI → IPC (`mapToNativePattern` at <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\AetherIPCHandlers.ts" lines="1485-1514" />) → `AetherKineticEngine.setManualKinetics`. The VMM is fully silenced via `_l2Active = true` (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\movement\VibeMovementManager.ts" lines="962-975" />).

---

## 2. The `circle` and `eight` Generators — Exact Code

### `circle` (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\AetherKineticEngine.ts" lines="249-252" />)

```typescript
circle: (p, out) => {
  out.x = Math.sin(p)
  out.y = Math.cos(p)
},
```

### `eight` (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\AetherKineticEngine.ts" lines="262-265" />)

```typescript
eight: (p, out) => {
  out.x = Math.sin(p)
  out.y = Math.sin(p * 2)
},
```

### Mathematical Analysis of the Generators Themselves

| Property | `circle` | `eight` |
|----------|----------|---------|
| X equation | `sin(p)` | `sin(p)` |
| Y equation | `cos(p)` | `sin(p * 2)` |
| Frequency ratio X:Y | **1:1** | **1:2** |
| Phase offset | **π/2** (sin vs cos) | **0** (both sin) |
| Resulting shape | **Circle** ✅ | **Figure-8** ✅ |

**Verdict on the generators: They are mathematically correct and NOT swapped.**

- `circle` uses the same phase variable `p` for both axes (no drift possible).
- `circle` has a proper `π/2` offset (`sin` vs `cos`) — this is the textbook circle parameterization.
- There is **no frequency multiplier** on either axis of `circle` — no `sin(p * 2)` anywhere.
- `eight` correctly uses `sin(p * 2)` for the 1:2 Lissajous figure-8.
- They are distinct: `circle` ≠ `eight` in both frequency ratio and phase.

**The bug is NOT in the pattern generators.** Previous AI models failed because they audited only the generators and concluded "the math is correct" — which is true, but incomplete. The figure-8 is induced **downstream**.

---

## 3. Root Cause: Downstream Processing in IK Mode

The L2 engine has two output modes (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\AetherKineticEngine.ts" lines="766-795" />):

- **Classic mode** (no spatial target): emits `pan_base`/`tilt_base` → goes through `clamp01` in tick()
- **IK mode** (spatial target active): emits `pan_offset`/`tilt_offset` → goes through `NodeResolver`'s offset fusion path

### 3.1 PRIMARY CAUSE — WAVE 7635 Hard-Knee Limiter C⁰ Discontinuity (IK Mode)

When a spatial target is active, the circle's raw `(sin(p), cos(p))` is emitted as offsets and processed in `NodeResolver.ts` (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts" lines="1702-1741" />):

```typescript
const panDelta = (panOffset as number) * amp * VMM_OFFSET_SCALE_PAN 
               * effectiveDistScale * gimbalFactor * 255
// amp = _relativeOffsetAmplitude = amplitudeNorm * 2 (set at IPC line 689)
// VMM_OFFSET_SCALE_PAN = 0.5
```

At 100% amplitude: `amp = 2.0`, so `panDelta = sin(p) · 2.0 · 0.5 · 1 · 1 · 255 = sin(p) · 255`.

The maximum `|panDelta|` = **255 DMX units**. The maximum headroom is **127.5** (basePan = 127.5). So the delta is **2× the headroom** — the limiter engages aggressively.

The WAVE 7635 hard-knee limiter (the code I replaced in the previous task) had a **C⁰ jump discontinuity** at the knee (`|delta| = headroom`):

```
f(H⁻) = H                    = 127.5    (linear branch endpoint)
f(H⁺) = H · tanh(H/H)       = H · tanh(1) = 127.5 · 0.7616 = 97.1   (tanh branch start)
Δ = 97.1 − 127.5 = −30.4 DMX units  ← INSTANTANEOUS BACKWARD JUMP
```

**This jump occurs 4 times per revolution** (twice on the positive sin lobe, twice on the negative lobe), creating **2 pinch points** where the pan axis snaps backward by ~30 DMX units. Two pinch points on opposite sides of the circle = **figure-8 (Lissajous knot)**.

This is the exact mechanism: the circle's pan component smoothly increases until `|sin(p)|` crosses the headroom threshold, then **snaps backward 30 DMX units**, pinching the circle inward. The beam traces one lobe, gets pinched, traces the other lobe, gets pinched again → figure-8.

**Status:** This was just fixed by WAVE 7637 (C¹ soft-knee limiter). The new limiter is continuous and monotonic — no jumps, no pinch points. The figure-8 from this cause should now be eliminated.

### 3.2 CONTRIBUTING CAUSE — Asymmetric Velocity Clamp

The safety middleware (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\egress\AetherSafetyMiddleware.ts" lines="202-241" />) clamps per-frame velocity **independently** for pan and tilt with **different limits**:

| Vibe | Pan limit (DMX/s) | Tilt limit (DMX/s) | Ratio |
|------|-------------------|--------------------|----|
| techno-club | 300 | 220 | 1.36:1 |
| fiesta-latina | 240 | 180 | 1.33:1 |
| pop-rock | 200 | 150 | 1.33:1 |
| Default | 200 | 150 | 1.33:1 |

For a perfect circle, pan and tilt peak velocities are **equal** (`|dp/dt|` for both `sin` and `cos`). But the tilt limit is ~25% lower than pan. At high pattern speeds, **tilt clamps before pan**, creating asymmetric distortion that flattens the top and bottom of the circle. This doesn't create a figure-8 by itself, but it **amplifies** the figure-8 from cause 3.1 by spreading the hard-knee jump over multiple frames (the velocity clamp slows the snap, making the pinch trail more visible).

### 3.3 CONTRIBUTING CAUSE — Stale Aspect Ratio Comment (IK Mode)

The comment at <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\AetherKineticEngine.ts" lines="770-772" /> states:

```
// Do NOT apply PAN_ASPECT_RATIO or 0.45 here — those scales are for
// the DMX-space base path. The resolver's WAVE 7179 fusion applies
// VMM_OFFSET_SCALE_PAN (0.5) and VMM_OFFSET_SCALE_TILT (1.0) itself.
```

But the actual constants at <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts" lines="111-112" /> are:

```typescript
const VMM_OFFSET_SCALE_PAN  = 0.5
const VMM_OFFSET_SCALE_TILT = 0.5   // ← Comment says 1.0, actual is 0.5
```

The comment assumes `VMM_OFFSET_SCALE_TILT = 1.0`, which would give a 0.5:1.0 = 1:2 pan:tilt ratio (matching the classic mode's `PAN_ASPECT_RATIO = 0.5`). But the actual value is **0.5**, giving a **1:1 ratio**. This means:

- **Classic mode**: X scaled by `0.5 × 0.45 = 0.225`, Y by `0.45` → ratio 1:2 → **circle in physical space** ✅
- **IK mode**: X scaled by `0.5`, Y by `0.5` → ratio 1:1 → **ellipse 2× wider in pan** in physical space ❌

This doesn't create a figure-8, but it means the IK-mode "circle" is already a 2:1 ellipse in physical space before any limiter distortion. The combination of ellipse + hard-knee pinch points produces a more pronounced figure-8 than a true circle would.

### 3.4 CLASSIC MODE — clamp01 Clipping (Partially Mitigated)

In classic mode (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\AetherKineticEngine.ts" lines="690-707" />):

```typescript
const scaledY = y * cfg.amplitude * 0.45  // max excursion = 0.45 at amp=1
const tiltOffsetNorm = resolveTiltOffset(cfg.mountOrientation) * 0.45 * cfg.amplitude
const tiltBase = clamp01(anchorTilt + scaledY + tiltOffsetNorm)
```

For a **totem mount** (`tiltOffsetNorm = -0.45 × 0.45 × 1 = -0.2025`):
- `tiltBase = 0.5 + 0.45·cos(p) − 0.2025 = 0.2975 + 0.45·cos(p)`
- Range: `[−0.1525, 0.7475]` → **clips at 0** when `cos(p) < −0.661`

This creates a flat spot at the bottom of the circle. The WAVE 4740 fix (0.5→0.45) mitigated clipping for floor mounts at center anchor, but **did not eliminate it for totem/ceiling mounts** where `tiltOffsetNorm` shifts the center. Flat spots create a "U" or "∩" shape, not a true figure-8, but they contribute to the overall distorted appearance.

---

## 4. Summary

| # | Cause | Mode | Creates figure-8? | Status |
|---|-------|------|-------------------|--------|
| **1** | **WAVE 7635 hard-knee C⁰ discontinuity** | IK | **YES — 2 pinch points/rev from −30 DMX snap** | **Fixed by WAVE 7637** ✅ |
| 2 | Asymmetric velocity clamp (pan > tilt) | Both | Amplifies #1 | Pre-existing |
| 3 | Stale `VMM_OFFSET_SCALE_TILT` comment (0.5 vs claimed 1.0) | IK | Ellipse (not figure-8 alone) | Pre-existing |
| 4 | clamp01 clipping for totem/ceiling mounts | Classic | Flat spots (not figure-8 alone) | Partially mitigated (WAVE 4740) |

**Root cause of the figure-8: The WAVE 7635 hard-knee limiter's C⁰ discontinuity (cause #1), which creates two symmetric pinch points per revolution in the pan axis.** This is the only mechanism in the processing chain that can morph a 1:1 Lissajous circle into a 1:2-like figure-8 — the backward jump at the knee introduces an effective frequency doubling in the pan axis's zero-crossing behavior.

**The WAVE 7637 C¹ soft-knee fix (just installed) eliminates this cause.** The new limiter is continuous and monotonic, so the pan axis no longer snaps backward — the circle should now render as a smooth ellipse (with the 2:1 pan widening from cause #3, which is a separate cosmetic issue).

### Recommended Follow-Up (for a future wave, not this read-only directive)

1. **Fix the stale comment / aspect ratio in IK mode**: Either change `VMM_OFFSET_SCALE_TILT` from 0.5 to 1.0 (matching the comment's intent and restoring the 1:2 pan:tilt ratio for physical-space circularity), OR update the comment to reflect the actual 0.5 value and apply `PAN_ASPECT_RATIO` in the IK offset path. This is a **cosmetic** issue (ellipse vs circle in physical space), not a figure-8 issue.
2. **Verify the figure-8 is gone** after WAVE 7637 by testing the circle pattern at 100% amplitude in IK mode with a spatial target active.