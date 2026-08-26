Let me trace exactly how `_motorKineticOverrides` flows into the result record:

Now let me check how `targetX` (camelCase) from `_manualOverrides` gets into the record, and whether `target_x` (snake_case) from `_motorKineticOverrides` was ever supposed to be copied:

Now let me check if there's any code that copies `_motorKineticOverrides` keys to the record (beyond just reading `pan_base`/`tilt_base`):

Now let me check the resolver's channel constants to confirm what it reads:

Now let me check what `applySpatialTarget` writes and what `AetherKineticEngine.tick()` writes to `_motorKineticOverrides` — to see if they coexist:

Let me check if `AetherKineticEngine.tick()` overwrites the spatial target when it writes `pan_base/tilt_base`:

Now let me check `setMotorKineticOverride` — does it merge or replace?

Let me check if the arbiter has any spatial-target-aware logic in the fusion loop:

Let me check the fusion loop's final write to the record:

Now let me check `tick()` more carefully to see if it merges or replaces the motor override:

Now I have the complete picture. Let me also verify the WAVE 7613 hack (ProgrammerAetherBridge bypass) and the WAVE 7617/7618 hacks that need to be reverted:

Now let me check the git log for the WAVE 7613/7617/7618 commits to identify what needs to be reverted:

Now I have everything. Here's the forensic report:

---

# FORENSIC REPORT: OPUS MERGE ARCHAEOLOGY (WAVE 7619-ARCHAEOLOGY)

## 1. Opus's Original Merge Logic — How it was supposed to work

### The intended data flow

Opus designed **two parallel writers** to `_motorKineticOverrides`, each writing different keys to the same record:

| Writer | Keys written | Frequency |
|--------|-------------|-----------|
| `applySpatialTarget` (IPC E12) | `target_x`, `target_y`, `target_z` | On UI drag |
| `AetherKineticEngine.tick()` | `pan_base`, `tilt_base` | 44Hz |

The intended merge: **both sets of keys coexist** in the same `_motorKineticOverrides[nodeId]` record. The arbiter then copies them all to the `_result` record, where the resolver reads them.

### The arbiter's fusion loop (`_applyRelativeOffsetFusion`, line 957)

The loop at <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\NodeArbiter.ts" lines="991-1107" /> does:

1. Reads `motor['pan_base']`/`motor['tilt_base']` (line 1004-1005) — the **pattern output**
2. Reads `manual['pan_base']`/`manual['tilt_base']` (line 1009-1010) — the **radar anchor**
3. Fuses them: `basePan = motorPan ?? manualPan ?? 0.5` (line 1069)
4. Adds L0 offset: `record['pan'] = basePan + offset * amp * distScale * gimbalFactor` (line 1098)
5. Same for tilt → `record['tilt']` (line 1106)

**Critical finding**: The fusion loop **NEVER copies `target_x/y/z` (or `targetX/Y/Z`) from `_motorKineticOverrides` to the record**. It only reads `pan_base`/`tilt_base`. The spatial target keys are invisible to the resolver when they come via `_motorKineticOverrides`.

### How the resolver gets `targetX` today

The resolver reads `channelValues['targetX']` (camelCase) at <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts" lines="1594-1604" />. This only works because `ProgrammerAetherBridge` writes `targetX/Y/Z` (camelCase) to `_manualOverrides` via `setManualOverrides` IPC, and the arbiter copies ALL keys from `_manualOverrides` to the record at line 829: `record[key] = incoming`.

This is the **WAVE 7613 bypass** — a parallel path that bypasses `_motorKineticOverrides` entirely.

---

## 2. The Missing Link — Three compounding bugs

### Bug #1: snake_case vs camelCase (the one Raul identified)

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\AetherIPCHandlers.ts" lines="1020-1024" />

```typescript
arbiter.setMotorKineticOverride(nodeId, {
  target_x: subTarget.x,   // ← snake_case
  target_y: subTarget.y,   // ← snake_case
  target_z: subTarget.z,   // ← snake_case
})
```

The resolver expects `targetX`/`targetY`/`targetZ` (camelCase) at <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts" lines="94-96" />:
```typescript
const CH_TARGET_X = 'targetX'   // ← camelCase
const CH_TARGET_Y = 'targetY'
const CH_TARGET_Z = 'targetZ'
```

Even if the arbiter copied motor override keys to the record, the case mismatch would make them invisible.

### Bug #2: `tick()` destroys the spatial target

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\AetherKineticEngine.ts" lines="688-697" />

```typescript
let rec = this._overridePool.get(nodeId)
if (!rec) {
  rec = { pan_base: finalPanBase, tilt_base: finalTiltBase }  // ← fresh object, no target keys
  this._overridePool.set(nodeId, rec)
} else {
  rec['pan_base']  = finalPanBase   // ← preserves existing keys (good for subsequent ticks)
  rec['tilt_base'] = finalTiltBase
}
arbiter.setMotorKineticOverride(nodeId, rec)  // ← REPLACES the arbiter's entry
```

On the **first tick** after `applySpatialTarget` writes `{ target_x, target_y, target_z }` to the arbiter:
1. `_overridePool.get(nodeId)` returns `undefined` (applySpatialTarget doesn't write to `_overridePool`)
2. Creates fresh `{ pan_base, tilt_base }` — **no spatial target keys**
3. `setMotorKineticOverride` **REPLACES** the arbiter entry → spatial target is **destroyed**

On subsequent ticks, `_overridePool` preserves keys, but the spatial target was already lost on the first tick.

### Bug #3: The arbiter never copies spatial targets to the record

The fusion loop (lines 1003-1005) only reads `motor['pan_base']`/`motor['tilt_base']`. It **never** reads `motor['target_x']` or writes `record['targetX']`. Even if bugs #1 and #2 were fixed, the resolver would never see the spatial target from `_motorKineticOverrides`.

---

## 3. The Surgical Fix — 3 changes, ~10 lines

### Fix A: `applySpatialTarget` — snake_case → camelCase

**File**: `AetherIPCHandlers.ts`, line 1020-1024
```typescript
// BEFORE:
arbiter.setMotorKineticOverride(nodeId, {
  target_x: subTarget.x,
  target_y: subTarget.y,
  target_z: subTarget.z,
})

// AFTER:
arbiter.setMotorKineticOverride(nodeId, {
  targetX: subTarget.x,   // ← camelCase
  targetY: subTarget.y,
  targetZ: subTarget.z,
})
```

### Fix B: `tick()` — merge with existing motor override (preserve spatial target)

**File**: `AetherKineticEngine.ts`, line 688-697
```typescript
// BEFORE:
let rec = this._overridePool.get(nodeId)
if (!rec) {
  rec = { pan_base: finalPanBase, tilt_base: finalTiltBase }
  this._overridePool.set(nodeId, rec)
} else {
  rec['pan_base']  = finalPanBase
  rec['tilt_base'] = finalTiltBase
}

// AFTER:
let rec = this._overridePool.get(nodeId)
if (!rec) {
  // WAVE 7619: Preserve spatial target keys from the arbiter's existing entry.
  // applySpatialTarget writes targetX/Y/Z to _motorKineticOverrides. If we
  // create a fresh rec here, we'd destroy them. Read the existing entry first.
  const existing = arbiter.getMotorKineticOverride(nodeId)
  rec = existing ? { ...existing } : {}
  this._overridePool.set(nodeId, rec)
}
rec['pan_base']  = finalPanBase
rec['tilt_base'] = finalTiltBase
```

### Fix C: Arbiter fusion loop — copy spatial targets to the record

**File**: `NodeArbiter.ts`, after line 1005 (where `motorPan`/`motorTilt` are read)
```typescript
// WAVE 7619: Copy spatial target keys from motor override to the record
// so NodeResolver can read them via channelValues['targetX'].
if (motor) {
  const mtx = motor['targetX']
  const mty = motor['targetY']
  const mtz = motor['targetZ']
  if (isFiniteChannelValue(mtx)) record['targetX'] = mtx as number
  if (isFiniteChannelValue(mty)) record['targetY'] = mty as number
  if (isFiniteChannelValue(mtz)) record['targetZ'] = mtz as number
}
```

---

## 4. Rollback Plan — Reverting WAVE 7613, 7617, 7618

### What to revert

| Commit | What it did | Why revert |
|--------|------------|-----------|
| `99f3e334` WAVE 7613 | Bypassed `_motorKineticOverrides` by writing `targetX/Y/Z` to `_manualOverrides` via `ProgrammerAetherBridge` | Restores the single-path architecture: spatial targets flow through `_motorKineticOverrides` only |
| `2a953537` WAVE 7617 | Added DMX-space pattern fusion in `_writeNodeIK` (post-solve) | Removes the broken DMX hack that caused geometric incoherence |
| `fa509c17` WAVE 7618 | Replaced WAVE 7617 with target mutation (pre-solve) | Removes our target mutation — Opus's arbiter fusion handles the merge correctly |
| `28ca204a` WAVE 7618.1 | Fixed target mutation to read live motor output | Part of WAVE 7618 revert |
| `149d6ef3` WAVE 7618.2 | Fixed amplitude scaling + tilt→Y mapping | Part of WAVE 7618 revert |
| `c66cc168` WAVE 7618.3 | Fixed vertical sweep + tilt→Z mapping | Part of WAVE 7618 revert |

### What to KEEP

| Commit | What it does | Why keep |
|--------|------------|---------|
| `51e62977` WAVE 7616 | IK ceiling inversion fix + IPC spam guard | These are correct fixes independent of the merge architecture |

### Rollback strategy

1. **Revert WAVE 7618.3 → 7618** (commits `c66cc168`, `149d6ef3`, `28ca204a`, `fa509c17`): Remove all target mutation code from `_writeNodeIK`. The resolver should just read `targetX/Y/Z` from `channelValues` and call `solveInto` with them directly — no mutation, no lerp, no pattern fusion.

2. **Revert WAVE 7617** (commit `2a953537`): Remove the DMX-space pattern fusion from `_writeNodeIK`. Also restore the telemetry logs if desired (or keep them silenced).

3. **Revert WAVE 7613** (commit `99f3e334`): Remove the `setSpatialPosition` call from `KinRadarViewport.tsx` and the `clearSpatialTargets` call from `KineticsCathedral.tsx`. The spatial target should flow through `applySpatialTarget` IPC → `_motorKineticOverrides` → arbiter → resolver, NOT through `programmerStore` → `_manualOverrides`.

4. **Apply the 3 surgical fixes** (A, B, C above) to restore Opus's original merge path.

### Post-rollback state

After rollback + surgical fix, the data flow will be:

```
SpatialTargetPad (UI)
  → movementStore.setSpatialTarget(t)
      → KineticsBridge._flushSpatial()
          → aether.applySpatialTarget()  (IPC E12)
              → arbiter.setMotorKineticOverride({ targetX, targetY, targetZ })  ← camelCase
                  → tick() preserves targetX/Y/Z in _overridePool  ← Fix B
                      → arbiter fusion copies targetX/Y/Z to record  ← Fix C
                          → NodeResolver reads channelValues['targetX']
                              → solveInto(fixture, target)  ← pure IK, no mutation

AetherKineticEngine.tick()  (44Hz)
  → patternFn(phase) → {x, y}
  → pan_base = anchor + x * amp * 0.45
  → arbiter.setMotorKineticOverride({ pan_base, tilt_base, targetX, targetY, targetZ })  ← merged
      → arbiter fusion: record['pan'] = basePan + offset * amp * distScale * gimbalFactor
          → NodeResolver reads channelValues['pan'] (classic path, if no targetX)
             OR channelValues['targetX'] (IK path, with pattern offset fused by arbiter)
```

The key insight: **Opus's arbiter fusion already handles the merge correctly**. The pattern's `pan_base`/`tilt_base` is fused with the L0 offset by the arbiter, and the result is written to `record['pan']`/`record['tilt']`. The spatial target `targetX/Y/Z` is passed through to the record for the resolver's IK path. The resolver then uses the IK result (from the spatial target) and the arbiter's fused `pan`/`tilt` (from the pattern) together.

The only question is: **does the resolver's IK path use `record['pan']`/`record['tilt']` from the arbiter fusion, or does it ignore them and only use the IK result?** Let me check:

This is the critical finding. The resolver's IK path uses `solveInto` and then the WAVE 7179 VMM post-solve fusion adds `pan_offset`/`tilt_offset`. Let me check what the IK path does with `record['pan']`/`record['tilt']` from the arbiter fusion:

Now I have the complete forensic picture. Here's the report:

---

# FORENSIC REPORT: OPUS MERGE ARCHAEOLOGY (WAVE 7619-ARCHAEOLOGY)

## 1. Opus's Original Merge Logic — How it was supposed to work

### The two-path architecture

Opus designed **two parallel writers** to `_motorKineticOverrides`, each writing different keys to the same record:

| Writer | Keys written | Frequency |
|--------|-------------|-----------|
| `applySpatialTarget` (IPC E12) | `target_x`, `target_y`, `target_z` | On UI drag |
| `AetherKineticEngine.tick()` | `pan_base`, `tilt_base` | 44Hz |

The intended design: **both sets of keys coexist** in the same `_motorKineticOverrides[nodeId]` record. The arbiter then passes `targetX/Y/Z` to the record (for the resolver's IK path) and fuses `pan_base`/`tilt_base` into `record['pan']`/`record['tilt']` (for the classic path).

### The arbiter's fusion loop (`_applyRelativeOffsetFusion`, line 957)

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\NodeArbiter.ts" lines="991-1107" />

The loop:
1. Reads `motor['pan_base']`/`motor['tilt_base']` (line 1004-1005) — the **live pattern output**
2. Reads `manual['pan_base']`/`manual['tilt_base']` (line 1009-1010) — the **radar anchor**
3. Fuses: `basePan = motorPan ?? manualPan ?? 0.5` (line 1069)
4. Adds L0 offset: `record['pan'] = basePan + offset * amp * distScale * gimbalFactor` (line 1098)
5. Same for tilt → `record['tilt']` (line 1106)

**CRITICAL FINDING**: The fusion loop **NEVER copies `target_x/y/z` (or `targetX/Y/Z`) from `_motorKineticOverrides` to the record**. It only reads `pan_base`/`tilt_base`. The spatial target keys are invisible to the resolver when they come via `_motorKineticOverrides`.

### How the resolver gets `targetX` today (WAVE 7613 bypass)

The resolver reads `channelValues['targetX']` (camelCase) at <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts" lines="1594-1604" />. This only works because `ProgrammerAetherBridge` writes `targetX/Y/Z` (camelCase) to `_manualOverrides` via `setManualOverrides` IPC, and the arbiter copies ALL keys from `_manualOverrides` to the record at line 829: `record[key] = incoming`.

This is the **WAVE 7613 bypass** — a parallel path that bypasses `_motorKineticOverrides` entirely.

### The resolver's IK path and the pattern

The resolver's IK path (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts" lines="1184-1192" />) decides:
- If `hasSpatialTarget` → IK path: calls `solveInto`, uses `ikResult.pan`/`ikResult.tilt` + `pan_offset`/`tilt_offset` (L0 VMM)
- Else → classic path: uses `record['pan']`/`record['tilt']` (arbiter fusion with L2 pattern)

**The IK path ignores `record['pan']`/`record['tilt']`** — it only uses `pan_offset`/`tilt_offset` from L0. The L2 pattern's `pan_base`/`tilt_base` is fused by the arbiter into `record['pan']`/`record['tilt']`, but the IK path never reads these.

This means: **in the current architecture, the L2 pattern is invisible when the IK path is active**. The WAVE 7179 VMM post-solve fusion only handles L0 offsets (`pan_offset`/`tilt_offset`), not L2 pattern output.

---

## 2. The Missing Link — Three compounding bugs

### Bug #1: snake_case vs camelCase (the one Raul identified)

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\AetherIPCHandlers.ts" lines="1020-1024" />

```typescript
arbiter.setMotorKineticOverride(nodeId, {
  target_x: subTarget.x,   // ← snake_case
  target_y: subTarget.y,
  target_z: subTarget.z,
})
```

The resolver expects `targetX`/`targetY`/`targetZ` (camelCase) at <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts" lines="94-96" />.

### Bug #2: `tick()` destroys the spatial target

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\AetherKineticEngine.ts" lines="688-697" />

On the **first tick** after `applySpatialTarget`:
1. `_overridePool.get(nodeId)` returns `undefined` (applySpatialTarget doesn't write to `_overridePool`)
2. Creates fresh `{ pan_base, tilt_base }` — **no spatial target keys**
3. `setMotorKineticOverride` **REPLACES** the arbiter entry → spatial target **destroyed**

### Bug #3: The arbiter never copies spatial targets to the record

The fusion loop (lines 1003-1005) only reads `motor['pan_base']`/`motor['tilt_base']`. It **never** reads `motor['target_x']` or writes `record['targetX']`. Even if bugs #1 and #2 were fixed, the resolver would never see the spatial target from `_motorKineticOverrides`.

---

## 3. The Surgical Fix — 3 changes

### Fix A: `applySpatialTarget` — snake_case → camelCase

**File**: `AetherIPCHandlers.ts`, line 1020-1024
```typescript
// AFTER:
arbiter.setMotorKineticOverride(nodeId, {
  targetX: subTarget.x,   // ← camelCase
  targetY: subTarget.y,
  targetZ: subTarget.z,
})
```

### Fix B: `tick()` — merge with existing motor override

**File**: `AetherKineticEngine.ts`, line 688-697
```typescript
// AFTER:
let rec = this._overridePool.get(nodeId)
if (!rec) {
  // WAVE 7619: Preserve spatial target keys from the arbiter's existing entry.
  const existing = arbiter.getMotorKineticOverride(nodeId)
  rec = existing ? { ...existing } : {}
  this._overridePool.set(nodeId, rec)
}
rec['pan_base']  = finalPanBase
rec['tilt_base'] = finalTiltBase
```

### Fix C: Arbiter fusion loop — copy spatial targets to the record

**File**: `NodeArbiter.ts`, after line 1005
```typescript
// WAVE 7619: Copy spatial target keys from motor override to the record
// so NodeResolver can read them via channelValues['targetX'].
if (motor) {
  const mtx = motor['targetX']
  const mty = motor['targetY']
  const mtz = motor['targetZ']
  if (isFiniteChannelValue(mtx)) record['targetX'] = mtx as number
  if (isFiniteChannelValue(mty)) record['targetY'] = mty as number
  if (isFiniteChannelValue(mtz)) record['targetZ'] = mtz as number
}
```

---

## 4. Rollback Plan

### What to revert

| Commit | What it did | Why revert |
|--------|------------|-----------|
| `99f3e334` WAVE 7613 | Bypassed `_motorKineticOverrides` by writing `targetX/Y/Z` to `_manualOverrides` via `ProgrammerAetherBridge` | Restores single-path architecture: spatial targets flow through `_motorKineticOverrides` only |
| `2a953537` WAVE 7617 | Added DMX-space pattern fusion in `_writeNodeIK` | Removes broken DMX hack |
| `fa509c17` WAVE 7618 | Replaced WAVE 7617 with target mutation | Removes our target mutation — Opus's arbiter fusion handles the merge |
| `28ca204a` WAVE 7618.1 | Fixed target mutation | Part of WAVE 7618 revert |
| `149d6ef3` WAVE 7618.2 | Fixed amplitude scaling | Part of WAVE 7618 revert |
| `c66cc168` WAVE 7618.3 | Fixed vertical sweep | Part of WAVE 7618 revert |

### What to KEEP

| Commit | What it does | Why keep |
|--------|------------|---------|
| `51e62977` WAVE 7616 | IK ceiling inversion fix + IPC spam guard | Correct fixes independent of merge architecture |

### Rollback sequence

1. Revert WAVE 7618.3 → 7618 (4 commits) — remove all target mutation from `_writeNodeIK`
2. Revert WAVE 7617 (1 commit) — remove DMX-space pattern fusion from `_writeNodeIK`
3. Revert WAVE 7613 (1 commit) — remove `setSpatialPosition` from UI, remove `clearSpatialTargets` from `KineticsCathedral`
4. Apply the 3 surgical fixes (A, B, C)

---

## 5. Open Architectural Question

**Even with all 3 fixes applied, the L2 pattern's `pan_base`/`tilt_base` is fused by the arbiter into `record['pan']`/`record['tilt']`, but the resolver's IK path ignores these.** The IK path only uses `solveInto(targetX, targetY, targetZ)` + `pan_offset`/`tilt_offset` (L0 VMM).

This means fixing the case mismatch restores the **spatial target flow** (targetX/Y/Z reaches the resolver), but it does NOT restore the **pattern merge with IK** — the pattern remains invisible in the IK path.

For the pattern to affect the IK output, one of these is needed:
1. **The arbiter writes the pattern deviation as `pan_offset`/`tilt_offset`** (not `pan`/`tilt`), so the WAVE 7179 fusion picks it up — but this is DMX-space fusion (WAVE 7617 approach, geometric incoherence)
2. **The resolver's IK path reads `record['pan']`/`record['tilt']` and uses them as offsets** — also DMX-space fusion
3. **Target mutation** (WAVE 7618 approach) — geometrically correct but needs careful axis mapping
4. **Something else in Opus's design that I'm not seeing**

Raul, can you clarify how the pattern was supposed to affect the IK output? Was there an additional step in the resolver that read `record['pan']`/`record['tilt']` and applied them to the IK result?