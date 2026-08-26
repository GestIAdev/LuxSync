Let me investigate the architecture to provide the forensic report. First, let me understand how the pattern output relates to spatial coordinates:

Let me read the `tick()` method to understand how `pan_base`/`tilt_base` are computed from the pattern:

Now let me understand how the spatial target flows. Let me check how `targetX/Y/Z` get into `channelValues` — the arbiter's result record:

Now let me see how `targetX` enters the arbiter's result record — it must come from `_manualOverrides`:

Now let me see how `targetX` gets into the record — it must be via `_applyIntent`:

Now let me see how `targetX` from `_manualOverrides` gets into the record. Let me look at the L2 manual override application section:

Now I understand the full picture. At line 829, `record[key] = incoming` — so `targetX`, `targetY`, `targetZ` from `_manualOverrides` are written directly to the record. The resolver then reads them from `channelValues[CH_TARGET_X]`.

Now let me check the `KineticsBridge._flushSpatial` to understand how the spatial target is sent to the backend and how it relates to the pattern:

Now let me check the `applySpatialTarget` IPC handler to understand how spatial targets interact with the motor:

Now let me check `applySpatialTarget` to understand the spatial target flow:

Now I have the complete picture. Let me also check how `setMotorKineticOverride` stores these and how they flow to the resolver:

Now let me check how `_motorKineticOverrides` with `target_x` (snake_case) flows to the resolver's `channelValues` with `targetX` (camelCase). This was the original bug from WAVE 7612:

Now I have the complete picture. The `target_x` (snake_case) from `applySpatialTarget` goes to `_motorKineticOverrides`, but the resolver reads `targetX` (camelCase) from `channelValues`. The `targetX` in `channelValues` comes from `_manualOverrides` (written by `ProgrammerAetherBridge` via `setManualOverrides`). The `_motorKineticOverrides` with `target_x` is NEVER read by the resolver — it's only used by the arbiter's fusion for `pan_base`/`tilt_base`.

Now I have everything I need for the forensic report.

---

# FORENSIC REPORT: IK & L2 PATTERN FUSION (WAVE 7617-DIAGNOSTIC)

## 1. Vector/Perspective Mismatch — Why flat DMX offsets break geometric coherence

### The fundamental error

The WAVE 7617 fix attempted to fuse L2 patterns with IK by:
```typescript
const patternDeviation = ((patternPan as number) - 0.5) * 2  // [-1, +1]
const patternPanDelta = patternDeviation * amp * VMM_OFFSET_SCALE_PAN * distScale * gimbalFade * 255
logicalPan = logicalPan + patternPanDelta
```

This adds a **flat linear offset in DMX space** to the IK solver's output. The problem is that DMX space is **non-linear in 3D geometry** — a +50 DMX pan delta produces wildly different spatial displacements depending on the fixture's position, orientation, and current tilt angle.

### Why corner fixtures point outward

Consider 4 ceiling fixtures at positions `(±3, 6, ±3)` targeting center `(0, 0, 0)`:

1. **IK solver** computes correct pan/tilt for each fixture to aim at center. Each fixture gets a different pan/tilt because they're at different positions.

2. **L2 pattern** (sweep) outputs `pan_base = 0.604, tilt_base = 0.427` — this is a **normalized [0,1] position in the fixture's own DMX space**, orbiting around anchor `0.5`.

3. **The WAVE 7617 fusion** computes `patternDeviation = (0.604 - 0.5) * 2 = +0.208` and adds it as `+0.208 * amp * scale * 255 ≈ +53 DMX` to **every fixture's pan**.

4. For a **corner fixture** at `(-3, 6, -3)` aiming at center, its pan is already near one extreme (say DMX 200). Adding +53 pushes it to DMX 253 — **past the target, pointing outward**.

5. For the **opposite corner** at `(+3, 6, +3)`, its pan is near DMX 50. Adding +53 pushes it to DMX 103 — **also away from center, but in a different direction**.

The result: all fixtures shift in the **same DMX direction**, but since they're at different physical positions, this same DMX shift means **different spatial directions** for each fixture. The cohesive sweep pattern shatters into individual fixtures pointing outward.

### The geometric truth

The L2 pattern's `pan_base`/`tilt_base` represent a **position in the fixture's normalized DMX space** — they are NOT a 3D spatial offset. Adding them to the IK output is like adding a compass bearing to a GPS coordinate: the units don't match, and the result is meaningless.

The correct approach is to move the **3D target point** before the IK solver runs. If the pattern moves the target from `(0, 0, 0)` to `(0.5, 0, 0.3)`, the IK solver will compute the correct pan/tilt for **each fixture individually** to aim at the new target. The geometric coherence is preserved because the IK solver handles the position→angle mapping for each fixture.

---

## 2. Pattern-Switch Spike — The violent leap to ceiling

### The sequence

From the logs:
```
[ZOMBIE-DIAG] setManualPattern ENTER. Payload: { pattern: 'sweep', ... }
[ZOMBIE-DIAG] Pre-op state: manualKeys=[targetX,targetY,targetZ,speed] motorKeys=[target_x,target_y,target_z]
[CHOREO] L2 engine ACTIVATED — VMM silenced
[ZOMBIE-DIAG] setManualOverride KINETIC: keys=[speed,pan_base,tilt_base] existing=YES
```

When the pattern activates:

1. `setManualPattern` IPC handler runs
2. It reads the current `_manualOverrides` which has `targetX/Y/Z` (from ProgrammerAetherBridge)
3. It reads `_motorKineticOverrides` which has `target_x/y/z` (from applySpatialTarget)
4. It calls `aetherKineticEngine.setManualKinetics()` which **resets phase to 0** (line 417: `this._phaseMap.set(nodeId, 0)`)
5. The engine's `tick()` reads the anchor from `_manualOverrides['pan_base']` — but **there is no `pan_base` in manual overrides** (only `targetX/Y/Z/speed`)
6. The anchor falls back to `0.5` (line 660-661)
7. **Phase = 0 + fanOffset** → pattern function outputs its **initial position** (for sweep, `phase=0` → `x = sin(0) = 0, y = cos(0) = 1`)
8. `panBase = clamp01(0.5 + 0 * amplitude) = 0.5`, `tiltBase = clamp01(0.5 + 1 * 0.45 * amplitude) = 0.5 + 0.225 = 0.725`
9. The arbiter's fusion writes `record['tilt'] = 0.725` — this is **tilt DMX 185** for a ceiling mount
10. The WAVE 7617 fusion adds this deviation on top of the IK output, pushing tilt even higher

### The ceiling spike

For a ceiling mount, `tiltBase = 0.725` means the pattern is trying to point the fixture **toward the floor** (high tilt = looking down). But the WAVE 7617 fusion adds `(0.725 - 0.5) * 2 * scale * 255 ≈ +115 DMX` to the IK tilt. If the IK tilt was 176 (correct for aiming at center), the fused tilt becomes `176 + 115 = 291 → clamped to 255` — **full tilt, pointing straight down at the floor**. Then the ceiling inversion (`255 - 255 = 0`) makes it point **straight up at the ceiling**.

### Root cause: uninitialized phase + anchor fallback

The spike has two compounding causes:
1. **Phase reset to 0**: The pattern starts at its initial position (sweep: `y=1` = maximum tilt deviation), not at the current fixture position
2. **Anchor fallback to 0.5**: The engine can't find `pan_base`/`tilt_base` in `_manualOverrides` (only `targetX/Y/Z` exists), so it orbits around the neutral center instead of the IK target

There is **no smoothing or fade** between the pre-pattern state and the first pattern frame. The fixture jumps instantly from its IK-computed position to the pattern's initial position.

---

## 3. The Target-Mutation Architecture — Audit and recommendation

### Current data flow

```
SpatialTargetPad (UI)
  → movementStore.setSpatialTarget(t)        // UI crosshair
  → programmerStore.setSpatialPosition(t)     // targetX/Y/Z → fixtureOverrides
      → ProgrammerAetherBridge._flush()       // 44Hz
          → aether.setManualOverrides()       // IPC → _manualOverrides
              → arbiter record['targetX']    // L2 manual override
                  → NodeResolver._writeNodeIK // reads channelValues['targetX']
                      → solveInto(fixture, target)  // IK solver
```

The `applySpatialTarget` IPC handler (E12) writes `target_x/y/z` (snake_case) to `_motorKineticOverrides`, but these are **never read by the resolver** — they're only used by the arbiter's fusion for `pan_base`/`tilt_base` anchor resolution. The actual IK path is driven entirely by `targetX` (camelCase) from `_manualOverrides`.

### The L2 pattern's data flow

```
AetherKineticEngine.tick()                    // 44Hz
  → reads anchor from _manualOverrides['pan_base']  // NOT targetX!
  → patternFn(phase) → {x, y}                 // normalized [-1,1]
  → panBase = anchor + x * amplitude * 0.45   // [0,1] DMX space
  → arbiter.setMotorKineticOverride({pan_base, tilt_base})
      → arbiter fusion: record['pan'] = basePan + offset
          → NodeResolver reads channelValues['pan']  // CLASSIC path
```

The L2 pattern operates in **DMX-normalized [0,1] space**. It has no concept of 3D coordinates. Its anchor is `pan_base`/`tilt_base` (a DMX position), not a 3D target.

### The architectural mismatch

The two systems speak different languages:
- **IK**: 3D coordinates `(x, y, z)` in meters → solver computes per-fixture pan/tilt
- **L2 Pattern**: normalized DMX `[0,1]` → orbit math around a DMX anchor

Fusing them at the DMX level (WAVE 7617) is fundamentally broken because the same DMX offset means different things for different fixtures.

### The recommended architecture: Target Mutation

**Move the pattern offset into 3D space, before the IK solver runs.**

Instead of computing `pan_base`/`tilt_base` in DMX space, the L2 pattern should compute a **3D orbital offset** around the spatial target:

```
Pattern output: {dx, dy} in normalized [-1,1]  (same as now)
↓
Convert to 3D offset:
  offsetX = dx * amplitude * ORBIT_RADIUS_METERS  (e.g., 2.0m)
  offsetZ = dy * amplitude * ORBIT_RADIUS_METERS
  offsetY = 0  (or separate Y pattern)
↓
Mutated target:
  target.x = baseTarget.x + offsetX
  target.y = baseTarget.y + offsetY
  target.z = baseTarget.z + offsetZ
↓
IK solver: solveInto(fixture, mutatedTarget)  → per-fixture pan/tilt
```

This preserves geometric coherence because the IK solver handles the 3D→angle mapping for each fixture individually. A sweep moves the target point across the stage, and each fixture tracks it correctly.

### Implementation path

1. **In `NodeResolver._writeNodeIK`**: Before calling `solveInto`, read the L2 pattern's output from `channelValues['pan_base']`/`['tilt_base']` (which the arbiter writes from `_motorKineticOverrides`). Convert the DMX-space deviation back to a 3D offset:
   ```typescript
   const patternPanBase = channelValues['pan_base']
   const patternTiltBase = channelValues['tilt_base']
   if (patternPanBase !== undefined && patternTiltBase !== undefined) {
     const dx = (patternPanBase - 0.5) * 2 * ORBIT_RADIUS
     const dz = (patternTiltBase - 0.5) * 2 * ORBIT_RADIUS
     this._ikTargetScratch.x = tx + dx
     this._ikTargetScratch.y = ty  // or add Y offset
     this._ikTargetScratch.z = tz + dz
   }
   ```

2. **Remove the WAVE 7617 DMX-space fusion** (the `patternDeviation` code added to `_writeNodeIK`).

3. **Fix the anchor problem**: The `AetherKineticEngine.tick()` reads `pan_base`/`tilt_base` from `_manualOverrides` as the anchor. When a spatial target is active, `_manualOverrides` has `targetX/Y/Z` but NOT `pan_base`/`tilt_base`. The engine falls back to 0.5. This needs to be fixed by either:
   - Having `setManualPattern` write `pan_base`/`tilt_base` derived from the current IK position
   - Or having the engine read `targetX/Y/Z` and compute the anchor from the IK solver

4. **Add phase smoothing**: When a pattern starts, instead of resetting phase to 0, initialize it to the position that matches the fixture's current aim. This prevents the initial spike.

### The cleanest long-term architecture

The ideal solution is to have the `AetherKineticEngine` operate in **3D space directly**:
- The pattern functions output `(dx, dy, dz)` offsets in meters
- The engine adds these to the spatial target before the resolver runs
- The IK solver always sees a coherent 3D target

This would require:
- A new set of pattern functions that output 3D offsets
- The engine writes `target_x + dx, target_y + dy, target_z + dz` to `_motorKineticOverrides`
- The arbiter passes these through to the resolver
- The resolver's IK path reads the mutated target

This is a larger refactor but eliminates the fundamental mismatch between DMX-space patterns and 3D-space IK.