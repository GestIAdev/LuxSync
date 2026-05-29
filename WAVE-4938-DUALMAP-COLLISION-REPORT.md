# WAVE 4938 — Forensic Audit Report: Spatial vs. Classic Dualmap Collision

**Date:** 2025-11-01  
**Classification:** READ-ONLY FORENSIC AUDIT  
**Scope:** Trace spatial (IK) data flow through IPC/arbiter and identify exact collision line with classic (VMM) movement.  
**Files Audited:**
- `src/core/aether/AetherIPCHandlers.ts`
- `src/core/aether/NodeArbiter.ts`
- `src/core/aether/adapters/KineticAdapter.ts`
- `src/core/aether/AetherKineticEngine.ts`
- `src/core/aether/ingestion/NodeExtractionPipeline.ts`

---

## Executive Summary

The kinetic system implements a **split-brain architecture** (WAVE 4914 — Relative Offset Routing):
- **Spatial (IK) path** writes absolute base positions (`pan_base`/`tilt_base`) into the arbiter's `_motorKineticOverrides` map (L2-MOTOR).
- **Classic (VMM) path** writes relative offsets (`pan_offset`/`tilt_offset`) into the IntentBus (L0).
- The **NodeArbiter** fuses both maps in `_applyRelativeOffsetFusion()` using an additive formula.

**The dualmap collision occurs at lines 877–889 of `NodeArbiter.ts`** where the arbiter adds the L0 classic offset to the L2 spatial base. This is by design (Relative Offset Routing), but becomes a **collision vector** when both maps contain stale or overlapping data, or when the HOLD state logic (WAVE 4934) fails to freeze the fixture.

**No evidence was found of VMM `tiltOffset` or `TILT_CEILING` being applied to IK absolute coordinates** — the arbiter does not apply these corrections; they are confined to the VMM's `generateIntent()` output which becomes `tilt_offset`.

---

## 1. Spatial (IK) Data Flow — From Target to Arbiter

### 1.1 Entry Point: IPC Handler
```
AetherIPCHandlers.ts:655-839
```

The `lux:aether:applySpatialTarget` IPC handler receives:
- `target: {x, y, z}` — spatial target in stage coordinates.
- `fixtureIds[]` — fixtures to aim.
- `fixtureIKProfiles` — per-fixture calibration, orientation, range.
- `fixturePositions` — real stage positions (WAVE 4884 anti-amnesia fix).

### 1.2 Profile Construction & Anti-Flip
```
AetherIPCHandlers.ts:744-758
```

For each valid fixture, the handler calls `buildProfile()` with:
- `resolvedPosition` (from payload or orchestrator fallback).
- `installation` orientation (`ceiling`, `floor`, `totem`, `truss-front`, `truss-back`, `wall-left`, `wall-right`).
- `panInvert: false`, `tiltInvert: false` (WAVE 4910 — corrected visualizer formula).
- `panRangeDeg` / `tiltRangeDeg` (cascading resolution from profile → capabilities → physics).

### 1.3 Shortest-Path DMX Seeding
```
AetherIPCHandlers.ts:762-768
```

To prevent 540° anti-flip spins, the handler reads the **current L2 manual override** (`pan_base` from `_manualOverrides`) and seeds `currentPanDMXMap` with the live DMX value. This is passed to `solveGroupWithFan()`.

### 1.4 Distance Scale Pre-Computation
```
AetherIPCHandlers.ts:777-793
```

Before solving, the handler computes a `spatialDistanceScale` per fixture:
```
scale = D_REF / distance(fixture, target), clamped to [0.25, 2.0]
D_REF = 8.0 meters
```
This scale is stored via `arbiter.setSpatialDistanceScale(nodeId, scale)`.

### 1.5 IK Solve & Normalization
```
AetherIPCHandlers.ts:795-801
```

`solveGroupWithFan()` returns `Map<fixtureId, {pan, tilt}>` where `pan`/`tilt` are raw DMX values in **[0, 255]**.

### 1.6 Writing to _motorKineticOverrides
```
AetherIPCHandlers.ts:811-829
```

The handler normalizes and writes:
```ts
const panNorm  = ikResult.pan  / 255;   // [0, 1]
const tiltNorm = ikResult.tilt / 255;   // [0, 1]
arbiter.setMotorKineticOverride(`${id}:kinetic`, {
  pan_base:  panNorm,
  tilt_base: tiltNorm,
})
```

**Key observation:** Spatial IK data never touches `_manualOverrides`. It lands exclusively in `_motorKineticOverrides` under channels `pan_base` and `tilt_base`.

---

## 2. Classic (VMM) Data Flow — From Audio to IntentBus

### 2.1 Adapter: KineticAdapter.ts
```
KineticAdapter.ts:161-296
```

The `KineticAdapter` runs at 44Hz and processes every `KINETIC` node.

### 2.2 L2 Supremacy Gate
```
KineticAdapter.ts:219-221
```

**Critical safeguard:** If `aetherKineticEngine.hasNode(node.nodeId)` is true (the fixture is under manual L2 pattern control), the adapter **returns early** and emits **nothing** to L0:
```ts
if (aetherKineticEngine.hasNode(node.nodeId)) {
  return;  // L2 supremacy: native engine controls this node
}
```

This prevents the VMM from emitting offsets while the AetherKineticEngine is actively driving the base.

### 2.3 Offset Emission
```
KineticAdapter.ts:288-289
```

For non-L2 nodes, the VMM `generateIntent()` produces `intent.x`/`intent.y` in **[-1, +1]**. These are emitted directly as:
```ts
this._valuesDict['pan_offset']  = clamp(intent.x, -1, 1);
this._valuesDict['tilt_offset'] = clamp(intent.y, -1, 1);
```

These values are pushed to the `IntentBus` (L0) and consumed by the arbiter.

### 2.4 VMM Safety: tiltOffset & TILT_CEILING
Per WAVE 4557, `VibeMovementManager.ts::generateIntent()` applies:
- `tiltOffset` (vibe-dependent, e.g. -0.35 for `fiesta-latina`).
- `TILT_CEILING = 0.15` (clamped via `Math.min(y, +0.15)` for floor, `Math.max(y, -0.15)` for ceiling mounts).

These corrections are applied **inside the VMM** and produce the final `intent.y`. The arbiter receives only the corrected `tilt_offset`. There is **no second application** of these offsets in the arbiter.

---

## 3. The Arbiter Fusion — Where Spatial and Classic Collide

### 3.1 Method: _applyRelativeOffsetFusion()
```
NodeArbiter.ts:756-915
```

This is the **sole fusion point** for spatial base + classic offset. It runs every frame after all L0–L3 layers have been applied.

### 3.2 Data Sources Read
The method reads **three independent sources** simultaneously:

| Source | Map | Channels | Semantics |
|--------|-----|----------|-----------|
| L2-MOTOR (IK/Patterns) | `_motorKineticOverrides` | `pan_base`, `tilt_base` | Absolute base from spatial IK or AetherKineticEngine |
| L2-MANUAL (Radar/Anchors) | `_manualOverrides` | `pan_base`, `tilt_base` | Absolute base from manual radar or pattern anchors |
| L0 (VMM) | `_result` record | `pan_offset`, `tilt_offset` | Relative offset from classic VMM |

### 3.3 Priority Resolution (Base Selection)
```
NodeArbiter.ts:852-858
```

```ts
const basePan  = hasMotorPan  ? motorPan
               : hasManualPan ? manualPan
               : 0.5;
const baseTilt = hasMotorTilt  ? motorTilt
               : hasManualTilt ? manualTilt
               : 0.5;
```

Priority: **motor override > manual override > 0.5 neutral**.

### 3.4 THE COLLISION LINE
```
NodeArbiter.ts:877-889
```

This is the exact arithmetic where spatial and classic data merge:

```ts
// PAN (with gimbal lock fade)
const ox = hasPanOffset ? panOffset : 0;
let final = basePan + ox * ampPan * distScale * gimbalFactor;
record['pan'] = clamp01(final);

// TILT (no gimbal factor)
const oy = hasTiltOffset ? tiltOffset : 0;
let final = baseTilt + oy * ampTilt * distScale;
record['tilt'] = clamp01(final);
```

**Line 879** (`basePan + ox * ampPan * distScale * gimbalFactor`) and **line 886** (`baseTilt + oy * ampTilt * distScale`) constitute the **dualmap collision point**.

At this moment:
- `basePan`/`baseTilt` may come from **spatial IK** (`_motorKineticOverrides`) or from **manual radar anchors** (`_manualOverrides`).
- `ox`/`oy` come from **classic VMM** (`_result['pan_offset']`/`_result['tilt_offset']`).
- The result is clamped to `[0, 1]`.

### 3.5 Collision Scenarios

#### Scenario A: Spatial active, Classic silent
If `hasPanOffset === false` and `hasTiltOffset === false`:
```
final = basePan + 0 = basePan
```
→ No collision. Spatial base passes through unchanged.

#### Scenario B: Classic active, Spatial absent
If `hasMotorPan === false` and `hasManualPan === false`:
```
basePan = 0.5
final = 0.5 + ox * ampPan * distScale * gimbalFactor
```
→ Degenerates to legacy `(x+1)/2` mapping. No spatial data to collide with.

#### Scenario C: Both active (True Collision)
If both spatial base and classic offset are present:
```
final = pan_base_IK + pan_offset_VMM * amp * aspect * distScale * gimbalFactor
```
→ This is the **designed behavior** of Relative Offset Routing, but it can produce unexpected results if:
1. The VMM offset is large (e.g. `intent.y = 0.6` near a beat drop) and the IK base is already near a mechanical limit → `clamp01` clips the sum.
2. The `distScale` is high (>1.0 for nearby fixtures) → amplifies the classic offset, potentially pushing the fixture past the IK target.
3. The operator expects **pure IK** but the VMM is still emitting non-zero offsets because the fixture was not under `hasNode()` L2 control (see gap analysis below).

---

## 4. HOLD State & Sticky Clutch (WAVE 4934–4935)

### 4.1 HOLD Detection
```
NodeArbiter.ts:845
```

```ts
const isHoldState = (hasManualPan || hasManualTilt) && !hasMotorPan && !hasMotorTilt;
```

Occurs when:
- The manual radar wrote `pan_base`/`tilt_base` to `_manualOverrides` (e.g. pattern anchor).
- `removeNodes()` was called, so `_motorKineticOverrides` has **no entry** for this node.

### 4.2 HOLD Behavior
```
NodeArbiter.ts:846-849
```

```ts
if (isHoldState) {
  if (hasManualPan  && !isFiniteChannelValue(manualAbsPan))  record['pan']  = manualPan;
  if (hasManualTilt && !isFiniteChannelValue(manualAbsTilt)) record['tilt'] = manualTilt;
  continue;  // SKIP the fusion entirely
}
```

→ In HOLD, the fixture is **frozen** at the manual anchor. The classic offset is **silenced**.

### 4.3 Sticky Clutch Fix (WAVE 4935)
```
NodeArbiter.ts:843-844
```

If a fresh absolute manual payload (`manual['pan']`) exists, it takes supremacy over the frozen `pan_base`:
```ts
if (hasManualPan && !isFiniteChannelValue(manualAbsPan)) record['pan'] = manualPan;
```

---

## 5. L3 Override (Anti-Bleed Shield)

### 5.1 L3 Dominated Channels
```
NodeArbiter.ts:165
```

The `_l3DominatedChannels` map (WAVE 4829) blocks L0/L1 from writing to channels that L3 (effects/Hephaestus) already touched this frame.

### 5.2 pan_base / tilt_base Exclusion
```
NodeArbiter.ts:83
```

```ts
const MANUAL_HARD_LOCK_EXCLUDED_CHANNELS = new Set<string>(['pan_base', 'tilt_base']);
```

These channels are **excluded from hard lock**, meaning L0 can still write `pan_offset`/`tilt_offset` even when L2 holds the base. This is required for Relative Offset Routing to function.

---

## 6. Gap Analysis — Potential Instability Vectors

### Vector 1: L2 Supremacy Gap in KineticAdapter
`KineticAdapter.ts:219` gates on `aetherKineticEngine.hasNode()`, which checks `_nodeConfigs`. However, **spatial IK targets do NOT register the node in `_nodeConfigs`** — they write directly to `_motorKineticOverrides` via `setMotorKineticOverride()`.

**Result:** A fixture under **spatial IK control** does **not** trigger the L2 supremacy early return in `KineticAdapter`. The VMM continues to emit `pan_offset`/`tilt_offset` for that node every frame.

**Evidence:**
- `AetherKineticEngine.ts:466-468`: `hasNode()` only checks `_nodeConfigs`.
- `AetherIPCHandlers.ts:826`: `applySpatialTarget` calls `setMotorKineticOverride()`, **not** `setManualOverride()` and **not** any engine registration.
- `KineticAdapter.ts:219`: Early return only if `hasNode()` is true.

**Conclusion:** This is a **design gap**, not a bug in the collision line itself. Spatial IK bypasses the L2 supremacy gate because it does not use the AetherKineticEngine pattern system. The classic VMM therefore continues to emit offsets that are fused with the IK base, causing the fixture to "wobble" around the IK target by the VMM offset amount.

### Vector 2: Amplitude Scaling When distScale > 1
If a fixture is very close to the spatial target (<8m), `distScale` is capped at **2.0** (line 788). The fusion formula multiplies the VMM offset by this scale:
```
final = base + offset * amp * 0.5 * 2.0
```
→ A nearby fixture receives **2× the classic offset excursion**, potentially moving far from the IK target.

### Vector 3: Gimbal Lock Fade Attenuation
When `tilt_base ≈ 0.5` (haz near zenith/nadir), `gimbalFactor` attenuates `pan_offset` to prevent mechanical spin. This is correct for spatial mounts, but if the IK target is intentionally at zenith, the pan response becomes sluggish.

---

## 7. Variable Flow Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STAGE (Operator touches spatial radar)                                    │
│  → KineticsBridge._flushSpatial()                                          │
│  → IPC lux:aether:applySpatialTarget                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  AetherIPCHandlers.ts:655-839                                               │
│  → buildProfile() per fixture                                               │
│  → solveGroupWithFan() → {pan, tilt} DMX [0,255]                          │
│  → normalize / 255 → [0,1]                                                  │
│  → arbiter.setMotorKineticOverride(nodeId, {pan_base, tilt_base})        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  NodeArbiter._motorKineticOverrides[nodeId] = {pan_base, tilt_base}         │
│  (Stored as absolute base for fusion)                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PARALLEL: KineticAdapter.ts @ 44Hz                                         │
│  → if (!aetherKineticEngine.hasNode(nodeId))  // FALSE for spatial IK       │
│  →   VMM.generateIntent() → intent.x/y [-1,+1]                            │
│  →   emit pan_offset / tilt_offset to IntentBus L0                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  NodeArbiter.arbitrate()                                                    │
│  → L0 intents absorbed into _result[nodeId] = {pan_offset, tilt_offset}  │
│  → _applyRelativeOffsetFusion()                                             │
│      basePan  = _motorKineticOverrides.pan_base  (IK)                       │
│      baseTilt = _motorKineticOverrides.tilt_base (IK)                       │
│      ox       = _result.pan_offset  (VMM)                                 │
│      oy       = _result.tilt_offset (VMM)                                 │
│      ─────────────────────────────────────────────                          │
│      finalPan  = clamp01(basePan  + ox * amp * aspect * distScale * gimbal)
│      finalTilt = clamp01(baseTilt + oy * amp * aspect * distScale)        │
│      ─────────────────────────────────────────────                          │
│      record['pan']  = finalPan                                              │
│      record['tilt'] = finalTilt                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  NodeResolver.ts                                                              │
│  → translate normalized [0,1] → DMX [0,255]                                │
│  → apply safety middleware (velocity clamp, airbag)                         │
│  → write to HAL / universe                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Findings & Verdict

### 8.1 The Collision Line (Exact)

**File:** `src/core/aether/NodeArbiter.ts`  
**Method:** `_applyRelativeOffsetFusion()`  
**Lines:** **877–889**

```ts
// Line 877-882 (PAN fusion)
const ox = hasPanOffset ? (panOffset as number) : 0
let final = basePan + ox * ampPan * distScale * gimbalFactor
if (final < 0) final = 0
else if (final > 1) final = 1
record['pan'] = final

// Line 884-889 (TILT fusion)
const oy = hasTiltOffset ? (tiltOffset as number) : 0
let final = baseTilt + oy * ampTilt * distScale
if (final < 0) final = 0
else if (final > 1) final = 1
record['tilt'] = final
```

At line 879, `basePan` may originate from `_motorKineticOverrides['pan_base']` (spatial IK) while `ox` originates from `_result['pan_offset']` (classic VMM). The additive fusion is the collision.

### 8.2 tiltOffset / TILT_CEILING Verdict

**NOT APPLIED to IK coordinates.** The VMM applies `tiltOffset` and `TILT_CEILING` internally in `generateIntent()` (WAVE 4557 fix). The resulting corrected value is emitted as `tilt_offset`. The arbiter uses this offset as-is. There is **no double application**.

### 8.3 Root Cause of Fixture Instability

The instability when touching the spatial radar is **not** caused by double offset application. It is caused by:

1. **Missing L2 Supremacy Gate for Spatial IK:** `KineticAdapter.ts:219` only blocks VMM emission for nodes registered in `AetherKineticEngine._nodeConfigs` (manual patterns). Spatial IK nodes are **not registered there**, so the VMM continues to emit offsets that are fused with the IK base.

2. **Unintended Offset Fusion:** If the VMM is producing non-zero `pan_offset`/`tilt_offset` (e.g. because audio energy is high and the vibe is `techno-club`), those offsets are added to the IK base every frame. The fixture appears to "wobble" or deviate from the exact spatial target.

3. **HOLD State Edge Cases:** If the user switches from a pattern to HOLD, WAVE 4934 correctly freezes the position, but if the transition is not clean (e.g. `_motorKineticOverrides` cleared before `_manualOverrides` anchor is written), the fixture may snap or drift.

---

## 9. Recommendations (Informational Only — No Code Changes Per Directive)

1. **L2 Supremacy for Spatial IK:** Consider registering spatial IK nodes in a lightweight "spatial control registry" and checking it in `KineticAdapter.ts` alongside `aetherKineticEngine.hasNode()`, or extend `hasNode()` to also check `_motorKineticOverrides`.

2. **Explicit Spatial Mode Flag:** When `applySpatialTarget` is active for a fixture, the arbiter could set a flag that suppresses L0 `pan_offset`/`tilt_offset` for that node, ensuring pure IK tracking.

3. **Amplitude Attenuation:** When `distScale > 1.0` (fixture close to target), consider attenuating `amp` inversely to keep the total excursion bounded.

4. **Telemetry:** The existing `_applyRelativeOffsetFusion` telemetry (line 905) already samples fusion. Consider adding a field `sourceBase: 'motor'|'manual'|'neutral'` to distinguish whether the base came from IK or manual anchors.

---

## 10. References

| File | Lines | Description |
|------|-------|-------------|
| `AetherIPCHandlers.ts` | 655-839 | `applySpatialTarget` — IK entry point |
| `AetherIPCHandlers.ts` | 826-829 | `setMotorKineticOverride()` call with normalized IK |
| `AetherIPCHandlers.ts` | 846-870 | `releaseSpatialTarget` — cleanup |
| `NodeArbiter.ts` | 756-915 | `_applyRelativeOffsetFusion()` — fusion method |
| `NodeArbiter.ts` | 852-858 | Base priority resolution |
| `NodeArbiter.ts` | 877-889 | **Collision lines (additive fusion)** |
| `NodeArbiter.ts` | 835-849 | HOLD state detection & freezing |
| `KineticAdapter.ts` | 219-221 | L2 supremacy early return |
| `KineticAdapter.ts` | 288-289 | `pan_offset` / `tilt_offset` emission |
| `AetherKineticEngine.ts` | 466-468 | `hasNode()` only checks `_nodeConfigs` |
| `NodeExtractionPipeline.ts` | (various) | Node construction with `ikOrientation` |

---

*End of WAVE 4938 Forensic Audit Report.*
