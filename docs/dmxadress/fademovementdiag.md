I'll perform a read-only architectural audit of the motion pipeline. Let me start by exploring the codebase structure to locate the relevant systems.

Let me explore the source structure and find the motion pipeline files in parallel.

The actual code lives in `electron-app/src`. Let me search for the key motion pipeline components in parallel.

Excellent. I have a clear map of the motion pipeline. Let me read the key files in parallel: the Cathedral UI, the programmer store (global unlock), the NodeArbiter (L2 layer), and the IK engine.

Now I need the `releaseKinetics` implementation, the `setManualPattern` IPC handler (RELEASE/NULL path), the NodeArbiter, and the IK engine. Let me read these in parallel.

Now let me read the full `setManualPattern` RELEASE/NULL path and the NodeArbiter (L2 layer) in parallel.

I have the unlock flow mapped. Now I need the NodeArbiter's release fade logic (`clearManualOverride`, `_applyReleaseFades`, `RELEASE_MS_SLOW`) and the PhysicsPostProcessor smoothing. Let me search these in parallel.

Let me read the full `_applyReleaseFades`, the PhysicsPostProcessor smoothing, and the NodeResolver IK/VMM merge point in parallel.

Let me read the PhysicsPostProcessor's `process`/`seedClassicState` implementation and the NodeResolver IK/VMM merge point.

Let me read the truncated NodeResolver IK fusion section and the KineticAdapter (the IK/VMM merge point) to complete the picture.

Let me read the NodeResolver IK post-solve fusion section and the `_applyRelativeOffsetFusion` in NodeArbiter to complete the IK/VMM merge analysis.

Let me read the `_applyRelativeOffsetFusion` body to confirm the IK base + VMM offset merge logic.

I have the full pipeline mapped. Let me quickly check TheProgrammer's individual unlock handlers to confirm the state-sharing between sidebars.

I now have a complete picture of the motion pipeline. I have all the data needed for the audit. Let me compile the architectural breakdown.

---

# MOTION ARBITRATION & KINETIC HANDOFF AUDIT — WAVE 7733

**Status:** READ-ONLY audit. No code modified.
**Scope:** L2 Manual Arbiter, IK↔VMM merge, TheProgrammer↔Cathedral state isolation, release/handoff fades.

---

## SECTION 1 — The 2-Second Freeze/Fade on Global Unlock

### 1.1 The Unlock Entry Point

The Global Unlock is triggered by the `🔓 UNLOCK` button in the Kinetics Cathedral, wired to `handleUnlockKinetics`:

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\hyperion\kinetics\KineticsCathedral.tsx" lines="145-214" />

This handler fires a **multi-step, partially-serialized sequence** across the renderer→main IPC boundary:

| Step | Call | Boundary | Purpose |
|------|------|----------|---------|
| 1 | `releaseKinetics()` | renderer (sync) | Clears L2 `cellOverrides`/`fixtureOverrides` for KINETIC family |
| 2 | `IPC setManualPattern(null)` | renderer→main (async) | RELEASE branch: snapshot + purge motor overrides |
| 3 | `IPC clearAllMotorKineticOverrides` | renderer→main (async) | Safety-net sweep of `_motorKineticOverrides` |
| 4 | `setActivePattern('none')` + 50ms shield | renderer (sync) | UI reset with anti-double-fire guard |
| 5 | `resetRadarSilent()` | renderer (sync) | Silent radar UI reset |

### 1.2 The Exact Mechanism Causing the Delay

The freeze is **NOT** a single hardcoded 2-second value. It is the **compound of three independent timing systems** that overlap and race:

#### (A) The 1000ms Release Fade (primary cause)

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\NodeArbiter.ts" lines="105-110" />

`RELEASE_MS_SLOW = 1000` governs `pan`, `tilt`, `zoom`, `focus`, `rotation`. When `clearManualOverride` is called, it seeds a `_releaseStates` entry with an **ease-out cubic** curve:

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\NodeArbiter.ts" lines="1595-1627" />

The fade blends `snapshot → L0 value` over 1000ms. Critically, in the RELEASE branch of `setManualPattern`, the code **sets then immediately clears** the manual override — guaranteeing a fresh 1000ms fade is started from the snapshot:

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\AetherIPCHandlers.ts" lines="582-594" />

Line 583 injects the snapshot; line 594 calls `clearManualOverride(nodeId)`, which (per `NodeArbiter.clearManualOverride` at line 415) seeds a new `_releaseStates` entry with `RELEASE_MS_SLOW` for pan/tilt. **This is the dominant 1-second component.**

#### (B) PhysicsPostProcessor Classic Inertia (extending cause)

After the 1000ms release fade completes, the `PhysicsPostProcessor` applies a **second layer of smoothing** in CLASSIC mode. Although `seedClassicState` (line 590 of AetherIPCHandlers) zeroes the velocity to make delta=0 on the first frame, as soon as the release fade begins blending toward the L0 VMM pattern, the PPP sees a **moving target** and engages its acceleration/deceleration ramp:

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\PhysicsPostProcessor.ts" lines="456-501" />

The PPP's `_applyClassic` ramp (capped at `SAFETY_MAX_VELOCITY_NORM = 5.0` norm/s and `SAFETY_MAX_ACCELERATION_NORM = 20.0` norm/s²) adds a **lag tail** on top of the release fade. For a mover transitioning from a held spatial position to a VMM orbit, the PPP can take **~500–900ms** to converge to the new target trajectory after the fade hands off. This is the second ~1-second component that makes the total feel like ~2s.

#### (C) IPC Race / Safety-Net Re-trigger (sporadic cause)

Step 3 (`clearAllMotorKineticOverrides`, <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\AetherIPCHandlers.ts" lines="204-216" />) is fired as a **separate async IPC** immediately after step 2. Because IPC calls are not awaited in `handleUnlockKinetics` (each `void window.lux?.aether?....`), step 3 can execute **while the RELEASE branch's 1000ms fade is still in flight**. If `clearAllMotorKineticOverrides` mutates `_motorKineticOverrides` mid-fade, the `_applyRelativeOffsetFusion` (which reads motor state every frame) can briefly lose the base, causing a **stutter/freeze midpoint** in the fade.

### 1.3 Root-Cause Verdict

The ~2-second freeze is a **stacked smoothing architecture**, not a bug:

1. **1000ms ease-out cubic release fade** (`RELEASE_MS_SLOW`, `NodeArbiter.ts:110`) — by design, organic.
2. **PPP classic inertia ramp** (`PhysicsPostProcessor._applyClassic`) — by design, mechanical safety.
3. **Un-awaited IPC safety-net race** (`clearAllMotorKineticOverrides` fired concurrently with the in-flight fade) — **unintended race condition**.

The first two are intentional and correct in isolation. The third is the actual defect: the safety net was meant to catch orphans, but because it runs concurrently with the RELEASE branch's own purge (`arbiter.clearMotorKineticOverride(nodeId)` at line 548 already does this), it is **redundant and racy**.

---

## SECTION 2 — IK vs. VMM Conflict with Individual Unlocks

### 2.1 The Merge Point Architecture

The IK↔VMM merge is a **two-stage split-brain** design:

**Stage 1 — NodeArbiter `_applyRelativeOffsetFusion`** (L2 base + L0 offset, normalized 0-1 domain):

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\NodeArbiter.ts" lines="957-1106" />

- **L2 (IK / AetherKineticEngine)** writes `pan_base`/`tilt_base` (center of gravity) + `targetX/Y/Z` (spatial target) + `pan_offset`/`tilt_offset` (pattern orbit in IK mode, WAVE 7621 Phase 3).
- **L0 (VMM via KineticAdapter)** writes `pan_offset`/`tilt_offset` ∈ [-1,+1] (procedural orbit).
- Formula: `pan_final = clamp01(pan_base + pan_offset * amp * aspect * distScale * gimbalFactor)`.

**Stage 2 — NodeResolver `_writeNodeIK` post-solve fusion** (DMX domain):

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts" lines="1771-1870" />

The resolver's **split-brain gatekeeper** decides the route per-node, per-frame:

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts" lines="1265-1296" />

**Decision rule:** `targetX present && !isContinuous → IK path (BOTH axes)` else `classic path (BOTH axes)`. This is the crux of the conflict.

### 2.2 Why Individual Unlocks Break Spatial IK

The Arbiter's **Smart Gate** (WAVE 4752) is a per-node, **per-channel** mask — excellent for the classic path where `pan` and `tilt` are independent channels:

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\NodeArbiter.ts" lines="73-93" />

But the **IK path treats pan+tilt as a coupled pair** derived from a single 3D target. The architecture has **no concept of "IK owns pan, manual owns tilt"**. The conflict manifests in three ways:

**(a) The split-brain gatekeeper is all-or-nothing.**
The route is decided by `targetX` presence alone (NodeResolver line 1273). If a user individually unlocks **Tilt** in the Cathedral (clearing the tilt manual override) while a spatial target remains, the resolver still routes to `_writeNodeIK` because `targetX` is still present. The IK solver recomputes **both** pan and tilt from the 3D target — the individual tilt unlock is silently overridden. The operator perceives the unlock as "not working."

**(b) The L2 Supremacy Gate in KineticAdapter is fixture-wide, not channel-wide.**

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\adapters\KineticAdapter.ts" lines="208-219" />

When `targetX` is present (spatial mode), the VMM is **fully silenced** for that node — it cannot provide a procedural tilt offset to blend with an IK-solved pan. There is no path for "VMM drives tilt while IK drives pan."

**(c) The `hasAbsoluteManualLock` check discards VMM offsets asymmetrically.**

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\NodeArbiter.ts" lines="1064-1069" />

If a user manually sets pan (radar touch) while IK is active on tilt, `hasAbsoluteManualLock` becomes true for pan → the entire VMM offset fusion is skipped (`continue`). The IK solver, however, ignores manual `pan`/`tilt` absolutes entirely (it reads `targetX/Y/Z` from the motor override, not the manual override). The result: **pan frozen at manual anchor, tilt driven by IK** — a decoupled, incoherent state.

### 2.3 Root Cause of the IK Disable

The Spatial IK button is currently `disabled` in the Cathedral UI:

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\hyperion\kinetics\KineticsCathedral.tsx" lines="303-311" />

The architectural reason: the Smart Gate's **per-channel granularity** (designed for independent pan/tilt classic control) is **fundamentally incompatible** with the IK solver's **coupled-axis model**. The Arbiter can mask pan and tilt independently, but the IK solver cannot solve one axis from a 3D target while the other axis is manually owned. There is no "partial IK" — it is all-or-nothing per the gatekeeper at NodeResolver:1279. Individual channel unlocks create a **half-state** that neither the classic fusion nor the IK solver can resolve coherently.

---

## SECTION 3 — State Management: TheProgrammer vs. Cathedral

### 3.1 Shared Store, Domain-Divided Actions

Both sidebars read/write the **same** `programmerStore` (Zustand singleton). State isolation is achieved via the **WAVE 4730 domain divorce** — two complementary release actions:

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\stores\programmerStore.ts" lines="286-308" />

- **`releaseProgrammer()`** (TheProgrammer's `UNLOCK CONTROLS`): clears IMPACT, COLOR, BEAM, EXTRAS. **Preserves** pan/tilt/speed/targetXYZ + kinetic phantoms.
- **`releaseKinetics()`** (Cathedral's `UNLOCK`): clears KINETIC family + kinetic phantoms. **Preserves** color/intensity/beam.

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\hyperion\controls\TheProgrammer.tsx" lines="190-200" />

### 3.2 The Cross-Domain Leak

If a user manually overrides **Tilt** in TheProgrammer (via `setPosition`), it writes `tilt` into `fixtureOverrides` and marks `KINETIC` dirty. The bridge flushes this to the NodeArbiter as a manual override on the `:kinetic` node.

When the Cathedral's Global Unlock (`releaseKinetics`) fires, it clears the KINETIC family from `fixtureOverrides` — **including the tilt that TheProgrammer wrote**. This is **correct behavior** (the Cathedral owns the kinetic domain), but it means:

1. TheProgrammer's tilt override is silently cleared by a Cathedral action — no UI feedback to TheProgrammer until it re-hydrates from L2.
2. The `setManualPattern(null)` IPC in the Cathedral unlock calls `clearManualOverride(nodeId)` on the `:kinetic` node, which **starts a 1000ms release fade from the TheProgrammer-set tilt value** — even though the operator's intent was a full release, not a fade from the Programmer's position.

Conversely, the Cathedral's `releaseKinetics` **preserves** TheProgrammer's color/intensity, so those domains are correctly isolated. The leak is **temporal, not stateful**: the kinetic state is correctly cleaned, but the *fade transition* uses the Programmer's tilt as the snapshot origin, which may not be the operator's mental model.

### 3.3 The Hydration Loop

Both sidebars hydrate from the same L2 `NodeArbiter` snapshot via `getL2State`/`getManualKineticState` (referenced at <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\hyperion\kinetics\KineticsCathedral.tsx" lines="94-95" />). This is correct and ensures UI consistency. The `kineticHydrationStore` (Cathedral) and direct `hydrateFromL2` (TheProgrammer) both read the same source of truth.

---

## SECTION 4 — Proposed Blueprint: Organic Hand-Off System

A flawless hand-off from Manual Spatial Targeting → Procedural VMM requires eliminating the stacked-smoothing compound and the IPC race. Blueprint:

### 4.1 Unified Hand-Off Coordinator (single IPC, atomic)

**Problem:** The current unlock fires 3+ un-awaited IPC calls that race.
**Fix:** Collapse steps 2 + 3 into a **single atomic IPC** `lux:aether:kineticHandoff` that performs, **synchronously in main**, in this strict order:

1. Capture IK snapshot (`currentPosition.pan/tilt` post-inversion).
2. `aetherKineticEngine.removeNodes` + `clearMotorKineticOverride` + `clearSpatialDistanceScale` (all nodes, one pass).
3. Seed PPP classic state from snapshot.
4. **Start a single, unified release fade** (see 4.2).
5. Set `vibeMovementManager.setL2Active(false)` last.

No second IPC. No safety-net sweep. The `clearAllMotorKineticOverrides` call in `handleUnlockKinetics` (line 185) should be **removed** — it is fully redundant with the RELEASE branch's per-node `clearMotorKineticOverride` (AetherIPCHandlers:548).

### 4.2 Single-Stage Organic Fade (eliminate the PPP compound)

**Problem:** 1000ms Arbiter fade + PPP classic inertia = ~2s stacked.
**Fix:** During hand-off, **bypass the PPP classic ramp** for the fade duration by operating the fade in the **PPP's SNAP mode** with a high `snapFactor` (e.g. 0.95), so the PPP tracks the Arbiter's fade output near-instantly instead of applying its own inertia. The Arbiter's ease-out cubic remains the sole smoothing curve.

Alternatively (cleaner): introduce a **`handoffFadeMs`** parameter on the release state that, when active, makes the PPP treat the arbitrated value as authoritative (no inertia) — a "pass-through" mode for the hand-off window only. After the fade completes, restore the PPP's classic mode for normal VMM tracking.

This collapses ~2s → **~600–800ms** (a single ease-out cubic at a reduced `RELEASE_MS_SLOW` of 700ms, which is perceptually "organic" for movers without feeling laggy).

### 4.3 Velocity-Aware Snapshot (true organic hand-off)

**Problem:** The current snapshot captures only **position**, zeroing velocity. The VMM then has to "restart" its orbit from a static point — a visible hitch.
**Fix:** Capture the **IK velocity** (delta of `currentPosition` over the last 2 frames) and seed it into the PPP's `SLOT_PAN_VEL`/`SLOT_TILT_VEL`. The VMM's orbit then **continues from the fixture's actual motion vector** rather than from rest. This is the single highest-impact change for "flawless" hand-off — the fixture keeps moving in the direction it was going, and the VMM pattern phase-aligns to that vector.

### 4.4 Coupled-Axis IK Gate (fix the individual-unlock conflict)

**Problem:** The split-brain gatekeeper is all-or-nothing on `targetX`; the Smart Gate is per-channel. They disagree on granularity.
**Fix:** Introduce a **`_spatialCoupledLock`** set on the Arbiter. When a node enters IK mode (`targetX` written to motor override), add its `nodeId` to `_spatialCoupledLock`. While in this set:

- `clearManualOverride` for **either** pan **or** tilt on that node is **rejected** (or auto-promoted to a full kinetic release). The Arbiter refuses to create a half-state.
- The Cathedral UI should **disable individual pan/tilt unlock buttons** while SPATIAL mode is active, and surface a single "Exit Spatial" action that calls the unified hand-off (4.1).
- The KineticAdapter's L2 Supremacy Gate (KineticAdapter:213) already silences VMM per-node when `targetX` is present — this is correct and should remain.

This makes the invariant explicit: **IK owns both axes or neither.** Individual channel unlocks are a classic-path concept only.

### 4.5 VMM Phase Hand-Off Seed

**Problem:** When VMM retakes control, its LFO starts at an arbitrary phase, causing a direction snap.
**Fix:** At hand-off, compute the VMM's `intent.x/y` for the fixture's **current position** and set the VMM's internal phase accumulator so that the first VMM output matches the snapshot direction. This requires exposing a `vibeMovementManager.seedPhase(nodeId, pan, tilt)` method. The VMM's `generateIntent` already uses `_index`/`phaseOffset`; seeding the base phase from the snapshot eliminates the snap.

### 4.6 Summary of Changes (for implementation, not yet applied)

| # | File | Change | Impact |
|---|------|--------|--------|
| 1 | `AetherIPCHandlers.ts` | New atomic `kineticHandoff` IPC merging RELEASE + safety-net | Eliminates race |
| 2 | `KineticsCathedral.tsx:185` | Remove `clearAllMotorKineticOverrides` call | Removes redundant sweep |
| 3 | `NodeArbiter.ts:110` | Reduce `RELEASE_MS_SLOW` 1000→700ms; add `handoffFadeMs` mode | Faster organic fade |
| 4 | `PhysicsPostProcessor.ts` | Add pass-through mode during hand-off fade | Eliminates stacked smoothing |
| 5 | `PhysicsPostProcessor.ts:584` | Extend `seedClassicState` to accept velocity | Velocity-aware hand-off |
| 6 | `NodeArbiter.ts` | Add `_spatialCoupledLock` rejecting per-axis clears | Fixes IK/individual-unlock conflict |
| 7 | `VibeMovementManager.ts` | Add `seedPhase(nodeId, pan, tilt)` | Eliminates VMM direction snap |
| 8 | `KineticsCathedral.tsx:303` | Re-enable SPATIAL button once 4.6 lands | Restores feature |

---

## Verdict

- **The 2-second freeze** is a **stacked-smoothing compound** (1000ms Arbiter ease-out + PPP classic inertia) aggravated by an **un-awaited IPC race** between the RELEASE branch and the `clearAllMotorKineticOverrides` safety net. Not a hardcoded `setTimeout`/`LERP` — it is two intentional 1s systems overlapping plus a race.
- **The IK/VMM conflict** is an **architectural granularity mismatch**: the Smart Gate is per-channel, the IK solver is per-coupled-pair. Individual unlocks create half-states the IK path cannot resolve.
- **TheProgrammer↔Cathedral state** is correctly domain-divorced at the storage layer; the only leak is temporal (the Cathedral's fade uses the Programmer's tilt as snapshot origin).

No code was modified. Ready to proceed to implementation on your approval.