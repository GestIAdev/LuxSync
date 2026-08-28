I'll investigate the codebase to find the best interception point for the static wheel rule. Let me start by locating the relevant files.

Interesting - there's already a WAVE 7679 CHILL WHEEL FREEZE in NodeResolver.ts. Let me read the relevant sections in detail.

The WAVE 7642 guard isn't found verbatim. Let me look at the existing CHILL WHEEL FREEZE logic and the DarkSpin sweep implementation.

There's already a WAVE 7679 CHILL WHEEL FREEZE implemented. Let me read the full implementation to see what state it's in.

The WAVE 7679 freeze already exists. Let me check the DarkSpin sweep and safety middleware for the WAVE 7642 drift-rate guard that needs purging.

Let me check the safety middleware's checkDarkSpin for the drift-rate guard.

The WAVE 7642 drift-rate guard doesn't appear to exist in the current code. Let me check the git history and the open forensics doc to understand the actual state.

No WAVE 7642 commit exists. Let me check the WAVE 7679 commit and verify the current freeze implementation is complete.

The WAVE 7679 freeze is already committed (in 2341fd92). Let me verify it covers all mechanical wheel paths and check whether the HarmonicQuantizer debounce is now redundant.

Let me do a thorough search across the whole codebase for any slow-drift exception to DarkSpin, to be certain before reporting.

I have enough evidence. Let me verify whether the palette anchor is accessible in the NodeResolver context, to assess if the one genuine refinement (locking to `pal.primary.h` instead of "first drift slot") is feasible.

I've completed a thorough investigation. Before making any changes, I need to report a significant discrepancy between the directive's premises and the actual state of the codebase. Let me show you the evidence.

## Investigation Findings

### Objective 1: Purge the WAVE 7642 Drift-Rate Guard — **Nothing to purge (it doesn't exist)**

The directive describes a guard at `NodeResolver.ts` line 1474+:
```
const isSlowDrift = delta <= 1 && timeSinceLastChange > 500
```

I searched the entire codebase. Evidence:

- `grep "7642"` across all `electron-app/src/**/*.ts` → **0 matches**. There is no WAVE 7642 reference in any source file.
- `git log --grep="7642"` → **0 commits**. No such patch was ever committed.
- Line 1474 of `NodeResolver.ts` falls inside `_applyDarkSpinBufferSweep()`, which already triggers DarkSpin on **every** wheel step with no exceptions: <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts" lines="1524-1536" />
  ```ts
  if (currentByte !== lastByte && entry.minTransitionMs > 0) {
    sm.checkDarkSpin(entry.colorNodeId, currentByte, entry.minTransitionMs, ...)
  }
  ```
- `AetherSafetyMiddleware.checkDarkSpin()` likewise triggers on any `currentWheelDmx !== s.lastStableWheelDmx` — no slow-drift bypass. <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\egress\AetherSafetyMiddleware.ts" lines="370-393" />

**The "1-step drift exception" the directive wants removed is already absent.** DarkSpin already fires on every wheel step.

### Objective 2: Implement the Static Wheel Rule — **Already implemented (WAVE 7679 CHILL WHEEL FREEZE)**

The exact architectural fix the directive describes is already in the codebase, committed in `2341fd92` (WAVE 7684-7686). It lives in `_translateColor()` and covers both `case 'wheel'` and `case 'hybrid'`: <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts" lines="2196-2232" />

What it does:
- Triggers when `_currentBpmConfidence < 0.3` (chill/ambient).
- On the **first** wheel resolution during a chill session: samples the nearest wheel slot and freezes it in `_chillWheelFreeze`.
- On every subsequent frame: re-emits the frozen slot and **returns early** — skipping both the HarmonicQuantizer and DarkSpin entirely. No continuous hue drift reaches the mechanical wheel.
- Clears on chill exit (`setResolveContext` crosses the confidence threshold upward) and lazily per-node.
- RGB/CMY/RGBW paths return before reaching the freeze, so electronic mixing still follows the drift.

This is precisely "mechanical color wheels must NEVER receive continuous slow modulations during Chill/Ambient."

### One genuine nuance worth flagging

The directive's Strategy A specifies locking to **`pal.primary.h`** (the palette anchor). The current freeze locks to the **first resolved wheel slot at chill entry** — i.e., whatever the upstream hue (possibly already drift-influenced) snaps to via the ColorTranslator. I checked: the palette structure (`pal.primary.h`) is **not available** at the `_translateColor` layer — it only receives already-computed `rNorm/gNorm/bNorm`. Locking to the true palette anchor would require plumbing new data from TitanEngine/Selene down through the resolver, which is a larger change than a surgical patch.

Practically, the current behavior still achieves the core goal: the wheel is frozen to a single static slot for the entire chill session, and the continuous sine drift is neutralized.

## My recommendation

I don't want to fabricate edits to code that doesn't need them, or re-implement something that already exists. How would you like to proceed?

Understood — forensic audit only, no new code. Let me set up the investigation and run the three audits in parallel.

Let me first get the complete freeze code and the setResolveContext lifecycle, then launch parallel subagents for the dimmer and gobo/prism audits.

Now let me trace the bpmConfidence source to determine if it can oscillate around the 0.3 threshold (the key freeze-leak hypothesis).

Let me check whether `beatConfidence` is smoothed/hysteresis'd before reaching the freeze threshold, which is the crux of the freeze-leak hypothesis.

Option D analysis is complete. The key finding: `beatConfidence` has **no hysteresis** around the 0.3 threshold. Let me check on the two background audits.

Option C (gobo/prism) is back: **ruled out** — no evidence of drift routing to gobo/prism, and DarkSpin is hard-wired to `color_wheel` only. Let me check on the dimmer audit.

All three audits are complete. Let me update the todos and verify the freeze-leak hypothesis more concretely before reporting.

Critical finding on the confidence hold-over logic. Let me check the worker's confidence computation to confirm it can oscillate around 0.3 during chill.

Found the confidence formula. Let me read the surrounding context to confirm it's recomputed each frame without hysteresis.

Let me confirm how often the confidence is recomputed (each frame vs. on each kick).

I now have all the evidence. Let me compile the complete forensic report.

# FORENSIC AUDIT REPORT — Chill Flicker Root Cause Analysis

## Executive Summary

Three audit tracks completed. **The most likely root cause is a hysteresis defect in the WAVE 7679 Chill Wheel Freeze (Option D).** The gobo/prism path is ruled out. The dimmer/wallIntensity path is a latent leak but not the active culprit for correctly-named chill vibes.

---

## OPTION D: The Freeze Leak (PRIMARY SUSPECT)

### The Freeze Code

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts" lines="2216-2235" />

```typescript
if (_currentBpmConfidence < CHILL_FREEZE_CONFIDENCE) {   // 0.3
  const frozen = this._chillWheelFreeze.get(nodeId)
  if (frozen !== undefined) {
    s[CH_COLOR_WHEEL] = frozen          // HOLD: re-emit frozen slot
    return s                            // skip quantizer + DarkSpin
  }
  // SAMPLE: first resolution — freeze the slot
  const firstResult = getColorTranslator().translate(this._rgbScratch, wheelProfile)
  this._chillWheelFreeze.set(nodeId, firstResult.colorWheelDmx / 255)
  s[CH_COLOR_WHEEL] = firstNorm
  return s
}
// Not chill: lazy-delete the freeze
this._chillWheelFreeze.delete(nodeId)
```

### The Clear Logic (the leak)

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts" lines="506-516" />

```typescript
setResolveContext(bpm: number, bpmConfidence: number): void {
  if (_currentBpmConfidence < CHILL_FREEZE_CONFIDENCE &&
      bpmConfidence        >= CHILL_FREEZE_CONFIDENCE) {
    this._chillWheelFreeze.clear()    // ← ALL frozen values wiped
  }
  _currentBpmConfidence = bpmConfidence
}
```

### Why This Causes Flicker — The Hysteresis Defect

**The threshold has ZERO hysteresis.** Enter chill at `< 0.3`, exit chill at `>= 0.3` — same threshold, no dead band. If `bpmConfidence` oscillates around 0.3, the freeze repeatedly clears and re-samples.

**The confidence source can oscillate.** The worker computes confidence from the IQR of a 12-sample BPM ring buffer, updated on each kick:

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\workers\IntervalBPMTracker.ts" lines="866-871" />

```typescript
const iqr = q3 - q1
const normalizedIqr = iqr / 30
const confidence = Math.max(0, Math.min(1, 1 - normalizedIqr))
```

- `confidence = 0.3` corresponds to `IQR = 21 BPM`.
- Chill/ambient music has loose timing — IQR naturally hovers around 15-25 BPM.
- Each new kick pushes a sample into the ring buffer, shifting the IQR. A single kick can move confidence from 0.28 → 0.33 → 0.27 across consecutive updates.

**The flicker sequence:**

| Frame | bpmConfidence | Path | What happens |
|-------|--------------|------|--------------|
| N | 0.28 | Freeze HOLD | Frozen slot re-emitted. No DarkSpin. |
| N+1 | 0.33 | **Freeze CLEARED** | `setResolveContext` wipes all frozen values. Non-chill path runs: translator produces a **new slot** (hue drifted during freeze) → quantizer may allow it → **DarkSpin blackout** |
| N+2 | 0.26 | Freeze RE-SAMPLE | New slot frozen (different from original if hue crossed a slot boundary) |
| N+3 | 0.28 | Freeze HOLD | New frozen slot held |
| ... | 0.34 | **Freeze CLEARED again** | Another DarkSpin blackout |

**Each confidence wobble = one wheel step leaks through = one DarkSpin blackout = one flicker.** The frequency matches kick density in the chill track.

### Additional Amplifier: The Hold-Over Logic

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\orchestrator\audio\AudioPipelineManager.ts" lines="260" />

```typescript
workerBpmConfidence: (levels.bpmConfidence != null && levels.bpmConfidence > 0)
  ? levels.bpmConfidence
  : this.lastAudioData.workerBpmConfidence,   // hold last non-zero
```

When the worker reports `bpmConfidence: 0` (no kick this frame), the last non-zero value is held. This means the confidence value is **step-wise**, jumping between held values rather than smoothly decaying — making threshold crossings more abrupt and unpredictable.

---

## OPTION C (Dimmer Leak): Latent, Not Active

**Verdict:** `wallIntensity` is **not suppressed at its source** but is **blocked downstream** for correctly-named chill vibes.

The unsuppressed source — <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\reactivity\SeleneLux.ts" lines="1268-1271" />:

```typescript
const photon = audioMetrics.photon;
if (photon && photon.wallIntensity > 0 && dimmerOverride !== null) {
  dimmerOverride = Math.max(dimmerOverride, photon.wallIntensity);  // no vibe gate!
}
```

But two downstream gates prevent it from reaching the DMX buffer for recognized chill vibes:
1. `TickEngine.ts:1316-1318` — `vibe.intensity = 1.0` for chill (discards `masterIntensity`)
2. `TickEngine.ts:1379-1399` — moving-head dimmer sourced from `chillFrame.dimmer` (range 0.20-0.80), not `masterIntensity`

**This is not the active flicker source** — but it's a latent defect. If the vibe name doesn't contain `chill`/`lounge`/`ambient`/`jazz`, or if the mechanics bypass is absent, the spike leaks. The strobe path is gated for chill (lines 1281-1283) but the `wallIntensity` dimmer path is not — an inconsistency worth fixing defensively.

---

## OPTION C (Gobo/Prism): Ruled Out

**Verdict:** Slow ambient drift (`morphFactor`/`oceanicModulation`/`hueInfluence`) is **not routed** to gobo or prism channels, and DarkSpin is **hard-wired to `color_wheel` only**.

Evidence:
- `morphFactor` → `oceanicModulation` → SeleneColorEngine modifies only `finalHue`/`correctedSat`/`correctedLight` (lines 2095-2133). No gobo/prism output.
- `BeamAdapter.ts:185-217` — L0 explicitly holds gobo/prism at 0 with time gates (`GOBO_HOLD_MS`/`PRISM_HOLD_MS`).
- `NodeResolver.ts` — `_isDarkSpinEligibleColorNode`, `_precomputeWheelDeviceEntry`, `_applyDarkSpinBufferSweep` all check only `CH_COLOR_WHEEL`. Zero matches for `gobo|prism|GOBO|PRISM` in NodeResolver.
- `AetherSafetyMiddleware.checkDarkSpin` tracks only `lastStableWheelDmx`/`pendingWheelDmx` — no gobo/prism fields.

**No flicker from this path.**

---

## ROOT CAUSE DIAGNOSIS

```
┌─────────────────────────────────────────────────────────────────────┐
│  CHILL FLICKER — ROOT CAUSE: FREEZE HYSTERESIS DEFECT               │
│                                                                     │
│  WAVE 7679 Chill Wheel Freeze works correctly WHEN LOCKED.          │
│  The defect is in the EXIT/RE-ENTRY logic:                          │
│                                                                     │
│  1. bpmConfidence oscillates around 0.3 (IQR-based, no hysteresis)  │
│  2. Each upward crossing → setResolveContext clears ALL freezes     │
│  3. Non-chill path runs for 1+ frames → translator produces new     │
│     slot (hue drifted) → DarkSpin blackout = FLICKER                │
│  4. Confidence drops back → freeze re-samples (possibly new slot)   │
│  5. Repeat with each confidence wobble                              │
│                                                                     │
│  FREQUENCY: matches kick density in the chill track                 │
│  VISUAL: intermittent blackouts on mechanical color wheel fixtures  │
│                                                                     │
│  NOT THE CAUSE:                                                      │
│  ✗ Gobo/prism drift (ruled out — not routed)                        │
│  ✗ wallIntensity dimmer spike (blocked downstream for named chill)  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## RECOMMENDED FIX (not yet implemented — awaiting your directive)

**Add hysteresis to the chill freeze threshold.** Two options:

**Option A (Minimal — hysteresis band):**
```typescript
const CHILL_FREEZE_ENTER = 0.30   // enter chill below this
const CHILL_FREEZE_EXIT  = 0.45   // exit chill above this (dead band 0.30-0.45)

setResolveContext(bpm: number, bpmConfidence: number): void {
  if (_currentBpmConfidence < CHILL_FREEZE_EXIT &&
      bpmConfidence        >= CHILL_FREEZE_EXIT) {
    this._chillWheelFreeze.clear()
  }
  _currentBpmConfidence = bpmConfidence
}
// In _translateColor: use _currentBpmConfidence < CHILL_FREEZE_ENTER for freeze path
```

**Option B (Robust — hysteresis + minimum dwell):**
Add a `_chillExitTimer` requiring confidence to stay above 0.3 for N consecutive frames (e.g. 60 frames ≈ 1.5s) before clearing the freeze. Prevents single-frame wobbles from triggering re-samples.

Shall I implement one of these fixes, or do you want to investigate further first?