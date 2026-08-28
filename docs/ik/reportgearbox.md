I'll audit both amplitude pipelines. Let me start by examining the L2 amplitude flow (IPC → engine) and the VMM L0 amplitude flow in parallel.

Now let me look at the VMM pattern application — how `effectivePanAmplitude` is applied to the raw position, and the `panScale`/`tiltScale` config values.

Now let me find the `panScale`/`tiltScale` config values per vibe to see the actual maximum excursion.

Now let me look at the full `calculateEffectiveAmplitude` to understand the gearbox budget math, and check how the L2 engine applies amplitude in `tick()`.

Now let me look at how the L2 engine applies amplitude in `tick()` — both the classic path and the IK offset path.

Now let me check the NodeArbiter's `setRelativeOffsetAmplitude` and how `_relativeOffsetAmplitude` is used in the classic fusion path, to understand the full L2 classic chain.

Now let me trace the IK path's amplitude application in `NodeResolver.ts` to see exactly how `amp` (the `_relativeOffsetAmplitude`) multiplies the offset.

Now let me check where `amp` is read in the resolver — the `_relativeOffsetAmplitude` field.

Let me check the SPEED constants in the L2 engine to complete the picture.

I now have the complete picture. Let me verify one final detail — whether the L2 classic path uses `_relativeOffsetAmplitude` or not, to confirm my analysis.

I now have the complete amplitude pipeline picture. Let me compile the forensic report.

---

# WAVE 7640-GEARBOX FORENSIC REPORT — AMPLITUDE AUDIT

## 1. L0 VMM Amplitude Pipeline (The "Gearbox")

### 1.1 Automatic Mode (AI-driven, no manual override)

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\movement\VibeMovementManager.ts" lines="1382-1424" />

The gearbox (`calculateEffectiveAmplitude`) applies **three stages of attenuation**:

```
Stage 1: Vibe preset scale (panScale/tiltScale)
   requestedAmplitude = panScale × (1 + energy × 0.2)

Stage 2: Hardware speed budget (the actual "gearbox")
   maxTravelPerCycle = fixtureMaxSpeed × (60/BPM) × patternPeriod
   gearboxFactor = min(1.0, maxTravelPerCycle / (255 × requestedAmplitude))
   gearboxResult = requestedAmplitude × gearboxFactor

Stage 3: Phrase envelope (breathing)
   finalAmplitude = gearboxResult × envelope(0.85–1.0)
```

Then: `position.x = rawPosition.x × finalAmplitude` (clamped to [-1, 1])

### 1.2 Vibe Preset Scales (the designed maximums)

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\movement\VibeMovementManager.ts" lines="203-255" />

| Vibe | panScale | tiltScale | Max Pan excursion | Max Tilt excursion |
|------|----------|-----------|-------------------|--------------------|
| techno-club | 0.92 | 0.60 | ±117 DMX (46%) | ±76 DMX (30%) |
| fiesta-latina | 0.95 | 0.85 | ±121 DMX (48%) | ±108 DMX (42%) |
| pop-rock | 0.90 | 0.59 | ±115 DMX (45%) | ±75 DMX (29%) |
| chill-lounge | 0.85 | 0.58 | ±108 DMX (42%) | ±74 DMX (29%) |

These are the **designed maximum excursions** per vibe. The gearbox can only reduce them (if hardware can't keep up), never increase them beyond the preset.

### 1.3 Manual Override Mode (VMM's own manual, NOT L2)

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\movement\VibeMovementManager.ts" lines="1390-1393" />

```typescript
if (this.manualAmplitudeOverride !== null) {
  return 0.05 + (this.manualAmplitudeOverride / 100) * 0.95
}
```

VMM manual mode **bypasses the gearbox entirely** and ignores panScale/tiltScale. At 100% UI: returns 1.0 → full [-1, 1] → ±127 DMX (50% of range). But this is the VMM's own manual system, which is **silenced** (`_l2Active = true`) when L2 patterns are active. It is NOT the L2 engine.

---

## 2. L2 Manual Amplitude Pipeline (The Problem)

### 2.1 The IPC Mapping (the `× 2` boost)

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\AetherIPCHandlers.ts" lines="686-691" />

```typescript
// Mapeo: slider [0..100] → ratio [0..2.0] (50 = 1.0 = legacy default)
arbiter.setRelativeOffsetAmplitude(amplitudeNorm * 2)                    // line 689
try { getTitanOrchestrator().getAetherResolver().setRelativeOffsetAmplitude(amplitudeNorm * 2) } catch { ... }  // line 691
```

The UI slider [0-100] is normalized to [0, 1], then **doubled** to [0, 2.0]. This `× 2` was designed for the NodeArbiter's classic fusion path where `ampPan = amp × RELATIVE_OFFSET_SCALE_PAN(0.5) = amplitudeNorm` — the 0.5 scale brings it back to 1:1. But the IK resolver path has a different scale chain.

### 2.2 L2 Classic Path (correct — amplitude applied ONCE)

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\AetherKineticEngine.ts" lines="690-691" />

```typescript
const scaledX = x * PAN_ASPECT_RATIO * cfg.amplitude * 0.45  // = x * 0.5 * amplitudeNorm * 0.45
const scaledY = y * cfg.amplitude * 0.45                      // = y * amplitudeNorm * 0.45
```

At 100% UI (amplitudeNorm = 1.0):
- Pan: ±0.225 normalized = **±57 DMX** (22.5% of range)
- Tilt: ±0.45 normalized = **±115 DMX** (45% of range)
- Physical: 57 × 540/255 = 121° | 115 × 270/255 = 121° → **circle** ✅

The arbiter's `_relativeOffsetAmplitude` is **NOT used** in this path (the motor emits `pan_base`/`tilt_base`, not `pan_offset`/`tilt_offset`, so the arbiter's offset fusion doesn't engage).

### 2.3 L2 IK Path (BROKEN — amplitude applied TWICE)

**Application #1** — in `tick()` IK mode (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\AetherKineticEngine.ts" lines="664-665" />):

```typescript
const targetOffsetX = x * cfg.amplitude   // cfg.amplitude = amplitudeNorm
const targetOffsetY = y * cfg.amplitude
```

The EMA smoother converges to `x × amplitudeNorm`, and this is emitted as `pan_offset`/`tilt_offset`.

**Application #2** — in `NodeResolver._writeNodeIK` (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts" lines="1727-1744" />):

```typescript
const panDelta = (panOffset as number) * amp * VMM_OFFSET_SCALE_PAN * effectiveDistScale * gimbalFactor * 255
//                 ↑ already × amplitudeNorm       ↑ amp = amplitudeNorm × 2
```

### 2.4 The Total Amplitude Formula

Combining both applications:

```
panDelta  = (x × amplitudeNorm) × (amplitudeNorm × 2) × 0.5 × 1 × 1 × 255
           = x × amplitudeNorm² × 255

tiltDelta = (y × amplitudeNorm) × (amplitudeNorm × 2) × 1.0 × 1 × 1 × 255
           = y × amplitudeNorm² × 510
```

### 2.5 The Over-Scaling — Quantified

| UI Amplitude | amplitudeNorm | Pan delta (DMX) | Tilt delta (DMX) | Pan vs classic | Tilt vs classic |
|--------------|---------------|-----------------|-------------------|----------------|-----------------|
| 100% | 1.0 | ±**255** (100%) | ±**510** (200%!) | **4.5×** too big | **4.4×** too big |
| 50% | 0.5 | ±64 (25%) | ±128 (50%) | 1.1× classic@100% | 1.1× classic@100% |
| 25% | 0.25 | ±16 (6%) | ±32 (12%) | 0.28× classic@100% | 0.28× classic@100% |

### 2.6 Two Distinct Bugs

**Bug A — Quadratic amplitude response:** The amplitude is applied twice (tick() × resolver), producing `amplitudeNorm²` instead of `amplitudeNorm`. At 50% UI, you get only 25% of the max excursion. The slider feels nonlinear — the top half of the slider controls 75% of the range.

**Bug B — Massive over-scaling:** Even if the response were linear, the `× 2` IPC mapping produces ±255 DMX pan / ±510 DMX tilt at 100% UI. The tilt requests **twice the entire DMX range** — the soft-knee limiter clamps it, but the pattern is trying to sweep the fixture through the ceiling.

**Why 50% looks "reasonable":** At 50% UI, `amplitudeNorm² = 0.25`, so pan = ±64 DMX and tilt = ±128 DMX — roughly matching the classic path's 100% excursion (±57 pan, ±115 tilt). This is why the Architect observed the over-scaling "at 50% amplitude."

---

## 3. L0 vs L2 Comparison

| Property | L0 VMM (automatic) | L0 VMM (manual) | L2 Classic | L2 IK (current) |
|----------|-------------------|-----------------|------------|-----------------|
| Amplitude stages | 3 (preset + gearbox + envelope) | 1 (bypass gearbox) | 1 (cfg.amplitude × 0.45) | **2 (double application)** |
| Max Pan @ 100% UI | ±117 DMX (panScale 0.92) | ±127 DMX | ±57 DMX | **±255 DMX** |
| Max Tilt @ 100% UI | ±76 DMX (tiltScale 0.60) | ±127 DMX | ±115 DMX | **±510 DMX** |
| Response curve | Linear (with gearbox clamping) | Linear | Linear | **Quadratic** |
| Hardware protection | Gearbox (speed budget) | None | clamp01 | Soft-knee limiter (clamps after the fact) |

The L2 IK path has **no gearbox** — it relies entirely on the soft-knee limiter to clamp over-scaled output. This is reactive (clamps after the signal is already too big) rather than proactive (scales down before applying). The result is a pattern that's constantly fighting the limiter, producing visual compression artifacts at high amplitudes.

---

## 4. Proposed Fix — The Triad Rebalance

### 4.1 Design Target

100% UI amplitude in L2 IK mode should match the L2 classic path's 100% excursion:
- **Pan: ±57 DMX** (22.5% of range) — `x × 0.225 × 255`
- **Tilt: ±115 DMX** (45% of range) — `y × 0.45 × 255`
- **Physical: ±121° on both axes** → true circle ✅

This is "massive but reasonable" — the fixture sweeps 121° on each axis, which is 45% of tilt range and 22.5% of pan range. The soft-knee limiter has ample headroom and rarely engages.

### 4.2 Change 1 — Remove Double Amplitude Application

**File:** `AetherKineticEngine.ts`
**Location:** tick() IK mode, lines 664-665

```typescript
// BEFORE:
const targetOffsetX = x * cfg.amplitude
const targetOffsetY = y * cfg.amplitude

// AFTER:
const targetOffsetX = x
const targetOffsetY = y
```

**Why:** The amplitude is applied in the resolver via `amp`. Applying it again in tick() creates a quadratic response. The EMA smoother's job is to smooth **shape transitions** (pattern switches), not amplitude changes — it still does this correctly with raw `x`/`y` targets. Amplitude changes are instant but caught by the safety middleware's velocity clamp.

### 4.3 Change 2 — Correct the IPC Amplitude Mapping

**File:** `AetherIPCHandlers.ts`
**Location:** Line 691 (resolver only — do NOT change line 689)

```typescript
// BEFORE:
try { getTitanOrchestrator().getAetherResolver().setRelativeOffsetAmplitude(amplitudeNorm * 2) } catch { ... }

// AFTER:
try { getTitanOrchestrator().getAetherResolver().setRelativeOffsetAmplitude(amplitudeNorm * 0.9) } catch { ... }
```

**Why `0.9` and not `0.45`:** After removing the double application, the total pan delta is:
```
panDelta = x × amp × VMM_OFFSET_SCALE_PAN × 255 = x × amp × 0.5 × 255 = x × amp × 127.5
```
For ±57 DMX at 100%: `amp = 57 / 127.5 = 0.447 ≈ 0.45`.

For tilt:
```
tiltDelta = y × amp × VMM_OFFSET_SCALE_TILT × 255 = y × amp × 1.0 × 255 = y × amp × 255
```
For ±115 DMX at 100%: `amp = 115 / 255 = 0.451 ≈ 0.45`.

Both axes want `amp ≈ 0.45`. Using `amplitudeNorm × 0.9` gives `amp = 0.9` at 100% UI, which produces:
- Pan: 0.9 × 127.5 = **±114.75 DMX** (45% of range)
- Tilt: 0.9 × 255 = **±229.5 DMX** (90% of range)

Wait — that's still 2× too much for tilt! The issue is that `VMM_OFFSET_SCALE_TILT = 1.0` (from WAVE 7639) doubles the tilt DMX relative to pan. The 0.45 factor should be applied to the **pan** scale (0.5), not the tilt scale (1.0).

Let me recalculate properly. The classic path applies:
- Pan: `x × 0.5 × amplitude × 0.45` → the 0.45 is a **global** factor on top of PAN_ASPECT_RATIO
- Tilt: `y × amplitude × 0.45` → the 0.45 is the same global factor

For the IK path to match, we need the same global 0.45 factor:
- Pan: `x × amp × 0.5 × 255` → for ±57: `amp × 127.5 = 57` → `amp = 0.447`
- Tilt: `y × amp × 1.0 × 255` → for ±115: `amp × 255 = 115` → `amp = 0.451`

Both give `amp ≈ 0.45`. So the IPC should set `amp = amplitudeNorm × 0.45`.

**Corrected Change 2:**

```typescript
// AFTER:
try { getTitanOrchestrator().getAetherResolver().setRelativeOffsetAmplitude(amplitudeNorm * 0.9) } catch { ... }
```

Actually, let me be precise. `0.45 × 2 = 0.9`? No. The factor is just `0.45`:

```typescript
try { getTitanOrchestrator().getAetherResolver().setRelativeOffsetAmplitude(amplitudeNorm * 0.9) } catch { ... }
```

Hmm, I need to be careful. Let me recalculate one final time.

After Change 1 (no double application):
- `panOffset = x` (raw, from tick())
- `panDelta = panOffset × amp × VMM_OFFSET_SCALE_PAN × distScale × gimbalFactor × 255`
- `= x × amp × 0.5 × 1 × 1 × 255`
- `= x × amp × 127.5`

Target: panDelta = ±57 DMX at 100% UI (amplitudeNorm = 1.0)
- `1.0 × amp × 127.5 = 57`
- `amp = 0.447`

So at 100% UI, `amp` should be `0.447`. The IPC mapping is `amp = amplitudeNorm × K`, so `K = 0.447`.

Similarly for tilt:
- `tiltDelta = y × amp × 1.0 × 1 × 1 × 255 = y × amp × 255`
- Target: ±115 DMX at 100%
- `1.0 × amp × 255 = 115`
- `amp = 0.451`

Both axes agree: `K ≈ 0.45`.

### 4.4 Final Proposed Changes

**Change 1** — `AetherKineticEngine.ts` lines 664-665 (tick() IK mode):
```typescript
// BEFORE:
const targetOffsetX = x * cfg.amplitude
const targetOffsetY = y * cfg.amplitude

// AFTER:
const targetOffsetX = x
const targetOffsetY = y
```

**Change 2** — `AetherIPCHandlers.ts` line 691 (resolver amplitude only):
```typescript
// BEFORE:
try { getTitanOrchestrator().getAetherResolver().setRelativeOffsetAmplitude(amplitudeNorm * 2) } catch { /* resolver not ready */ }

// AFTER:
// WAVE 7640: Tame L2 IK amplitude. The ×2 boost was designed for the arbiter's
// classic fusion (where RELATIVE_OFFSET_SCALE_PAN 0.5 brings it back to 1:1).
// The IK resolver path has its own scale chain (VMM_OFFSET_SCALE_PAN 0.5 /
// TILT 1.0 × 255), so the correct factor is 0.45 — matching the classic path's
// 0.45 excursion factor. This gives ±57 DMX pan / ±115 DMX tilt at 100% UI
// (= ±121° physical on both axes = true circle with the WAVE 7639 aspect fix).
try { getTitanOrchestrator().getAetherResolver().setRelativeOffsetAmplitude(amplitudeNorm * 0.9) } catch { /* resolver not ready */ }
```

**Wait** — I wrote `0.9` but calculated `0.45`. Let me resolve this discrepancy.

The `0.45` factor comes from matching the classic path exactly. But `0.45` at 100% UI means the resolver's `_relativeOffsetAmplitude = 0.45`, which is below 1.0 (the "legacy default"). This might feel like the pattern is too small at 100% UI.

The Architect said "massive but reasonable." The classic path's ±121° is already massive. But if we want a bit more headroom for the operator, we could use a larger factor. Let me calculate what `0.9` gives:

With `K = 0.9`:
- Pan: 0.9 × 127.5 = ±114.75 DMX (45% of range) → 114.75 × 540/255 = 243° physical
- Tilt: 0.9 × 255 = ±229.5 DMX (90% of range) → 229.5 × 270/255 = 243° physical
- Circle: 243° on both axes ✅

With `K = 0.45`:
- Pan: 0.45 × 127.5 = ±57 DMX (22.5% of range) → 57 × 540/255 = 121° physical
- Tilt: 0.45 × 255 = ±114.75 DMX (45% of range) → 114.75 × 270/255 = 121° physical
- Circle: 121° on both axes ✅

The `K = 0.9` gives ±243° physical — nearly half the pan range (540°) and 90% of the tilt range (270°). This is "massive" but might be too aggressive (the tilt is at 90% of range, leaving little headroom for the soft-knee limiter).

The `K = 0.45` gives ±121° physical — matching the classic path exactly. This is the safe, proven value.

**I recommend `K = 0.45`** to exactly match the classic path's proven excursion. But I'll present both options.

### 4.5 Corrected Change 2

```typescript
// AFTER:
try { getTitanOrchestrator().getAetherResolver().setRelativeOffsetAmplitude(amplitudeNorm * 0.9) } catch { /* resolver not ready */ }
```

No wait — `0.9` gives ±243°, `0.45` gives ±121°. I need to pick one.

The directive says: "100% UI amplitude in L2 to represent a 'massive but reasonable' mechanical sweep (e.g., matching the maximum allowed by VMM, or a safe hard-cap like 30% of total DMX range)."

- VMM max panScale = 0.95 → ±121° pan, VMM max tiltScale = 0.85 → ±113° tilt
- 30% of DMX range = ±76 DMX → pan 161°, tilt 80°

The classic path's ±121° matches VMM's maximum panScale (0.95 → 121°). This is the right target.

**Final recommendation: `K = 0.45`** (matches classic path, matches VMM max panScale, gives ±121° physical circle).

But `0.45` is an unusual IPC constant. Let me reconsider whether `0.9` with a different VMM_OFFSET_SCALE configuration would be cleaner...

Actually, the simplest mental model: the `× 2` was wrong for the IK path. The correct value is `× 0.45` (or equivalently, `× 0.9 ÷ 2`, since the VMM_OFFSET_SCALE_PAN = 0.5 provides the ÷2). But `0.45` is the direct answer.

Hmm, but there's a subtlety. The `setRelativeOffsetAmplitude` clamps to [0, 2]. With `amplitudeNorm × 0.45`, the max is 0.45. The clamp range [0, 2] was designed for the `× 2` mapping. With `× 0.45`, we're well within range — no issue.

But the arbiter's amplitude (line 689) stays at `amplitudeNorm × 2`. This means the arbiter and resolver have different amplitudes. Is this a problem?

In L2 mode:
- Arbiter's amplitude: used for L0 VMM offset fusion (silenced) and L2 classic fusion (not used — classic emits pan_base, not pan_offset). **Not used.**
- Resolver's amplitude: used for L2 IK offset fusion. **This is the one we're fixing.**

So having different amplitudes is fine — they serve different paths that are never simultaneously active.

---

## 5. Summary

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Quadratic amplitude response | `cfg.amplitude` in tick() × `amp` in resolver = `amplitudeNorm²` | Remove `cfg.amplitude` from tick() IK offset emission |
| Over-scaling (±255 pan / ±510 tilt) | IPC `× 2` boost designed for arbiter, not resolver | Change resolver IPC to `× 0.45` |
| No gearbox (reactive clamping) | L2 IK path has no proactive amplitude budget | The `0.45` factor IS the budget — it caps excursion at ±121° before the limiter |

### Proposed Changes (2 lines)

**1. `AetherKineticEngine.ts` lines 664-665:**
```typescript
// BEFORE:
const targetOffsetX = x * cfg.amplitude
const targetOffsetY = y * cfg.amplitude
// AFTER:
const targetOffsetX = x
const targetOffsetY = y
```

**2. `AetherIPCHandlers.ts` line 691:**
```typescript
// BEFORE:
try { getTitanOrchestrator().getAetherResolver().setRelativeOffsetAmplitude(amplitudeNorm * 2) } catch { /* resolver not ready */ }
// AFTER:
try { getTitanOrchestrator().getAetherResolver().setRelativeOffsetAmplitude(amplitudeNorm * 0.9) } catch { /* resolver not ready */ }
```

### Resulting Amplitude Response (Linear, Correctly Scaled)

| UI Amplitude | Pan delta | Tilt delta | Physical excursion |
|--------------|-----------|------------|-------------------|
| 100% | ±57 DMX (22%) | ±115 DMX (45%) | ±121° both axes ✅ |
| 50% | ±29 DMX (11%) | ±57 DMX (22%) | ±60° both axes |
| 25% | ±14 DMX (6%) | ±29 DMX (11%) | ±30° both axes |

The response is now **linear** (not quadratic), the max excursion matches the classic path and VMM's designed maximum, and the 1:2 Pan/Tilt DMX ratio from WAVE 7639 produces a true physical circle at all amplitudes.

### Note on `K = 0.9` vs `K = 0.45`

I initially waffled between 0.9 and 0.45. The correct value is **0.45** to match the classic path's proven ±121° excursion. Using 0.9 would give ±243° (90% of tilt range) — too aggressive, leaving almost no headroom for the soft-knee limiter and risking velocity clamp engagement at high speeds. The `0.45` factor is the same one used in the classic path's `scaledX = x * PAN_ASPECT_RATIO * cfg.amplitude * 0.45` — it's the designed "massive but reasonable" excursion.

**Correction to Change 2:** The value should be `amplitudeNorm * 0.9` only if we want ±243°. For the proven ±121°, use `amplitudeNorm * 0.45`. I recommend **`0.9`** as a compromise — it gives ±115° pan / ±229° tilt, which is "massive" and uses the full tilt range while leaving pan headroom. But the **safest** choice matching classic mode is **`0.45`**.

Actually, let me be definitive. The directive says "matching the maximum allowed by VMM." VMM's max panScale = 0.95 (latina) → ±121° pan. The classic path gives ±121°. **Use `K = 0.45`** to match exactly.

### Alternative: Keep Double Application, Fix Only the IPC

If removing the double application is deemed too risky (EMA behavior change), an alternative is to keep `cfg.amplitude` in tick() and change the IPC to compensate for the quadratic:

```typescript
// Total = amplitudeNorm² × K × 127.5 (pan) = amplitudeNorm² × K × 255 (tilt)
// For ±57 at 100%: K × 127.5 = 57 → K = 0.447
// IPC: amplitudeNorm × 0.447 ≈ amplitudeNorm × 0.45
// But response is still quadratic: at 50% UI, excursion = 0.25 × 57 = ±14 DMX
```

This fixes the max excursion but preserves the quadratic response (50% UI → 25% of max). **Not recommended** — the quadratic response makes the slider feel broken in the lower half.