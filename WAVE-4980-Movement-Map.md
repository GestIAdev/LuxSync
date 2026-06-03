# WAVE 4980 — FORENSIC AUDIT: VMM/IK KINETIC FUSION EXTRACTION

**Date:** 2026-06-02  
**Status:** AUDIT COMPLETE — ZERO ASSUMPTIONS, ZERO CODE GENERATION  
**Scope:** Raw code extraction from `NodeArbiter.ts`, `AetherIPCHandlers.ts`, `KineticAdapter.ts`, `VibeMovementManager.ts`.

---

## 1. THE FUSION EQUATION — `_applyRelativeOffsetFusion()`

**File:** `src/core/aether/NodeArbiter.ts` | **Lines:** 756–915  
**Context:** Called inside `arbitrate()` after all L0–L3 intents have been merged into `this._result`.

### 1.1 Core Arithmetic (Collision Lines)

```typescript
// PAN (with gimbal lock fade)
const ox = hasPanOffset ? (panOffset as number) : 0
let final = basePan + ox * ampPan * distScale * gimbalFactor
if (final < 0) final = 0
else if (final > 1) final = 1
record['pan'] = final

// TILT (no gimbal factor)
const oy = hasTiltOffset ? (tiltOffset as number) : 0
let final = baseTilt + oy * ampTilt * distScale
if (final < 0) final = 0
else if (final > 1) final = 1
record['tilt'] = final
```

### 1.2 Base Resolution Priority

```typescript
const basePan  = hasMotorPan  ? (motorPan  as number)
               : hasManualPan ? (manualPan as number)
               : 0.5
const baseTilt = hasMotorTilt  ? (motorTilt  as number)
               : hasManualTilt ? (manualTilt as number)
               : 0.5
```

**Priority:** `motor (IK) > manual (radar anchor) > 0.5 neutral`

### 1.3 Does L0 Get Silenced When L2 Base Exists?

**NO.** The only conditions that skip fusion:
- `hasAbsoluteManualLock` (line 817): manual `pan`/`tilt` absolute without `_base` channels → `continue` (skip node).
- `isHoldState` (lines 845–850): manual `pan_base`/`tilt_base` exists but NO motor override → writes frozen base and `continue`.

**If `_motorKineticOverrides` has a live IK base AND `_result` has a VMM offset, the additive fusion ALWAYS executes.**

---

## 2. PHYSICAL LIMIT CLAMPING

### 2.1 VibeMovementManager — Source of `tilt_offset`

**File:** `src/engine/movement/VibeMovementManager.ts` | **Lines:** 1096–1115

```typescript
const isCeilingMount = mountOrientation === 'ceiling'
  || mountOrientation === 'truss-front'
  || mountOrientation === 'truss-back'
const tiltOffset = isCeilingMount
  ? TILT_OFFSET_CEILING
  : mountOrientation === 'totem'
    ? -0.45
    : (TILT_OFFSET_BY_VIBE[vibeId] ?? 0)
const position = {
  x: Math.max(-1, Math.min(1, rawPosition.x * finalPanAmplitude)),
  y: Math.max(-1, Math.min(1, (rawPosition.y * finalTiltAmplitude) + tiltOffset)),
}
if (isCeilingMount) {
  if (position.y > -TILT_CEILING) position.y = -TILT_CEILING
  else if (position.y < -TILT_FLOOR_LIMIT) position.y = -TILT_FLOOR_LIMIT
} else {
  position.y = Math.min(position.y, TILT_CEILING)
}
```

**Constants:**
```typescript
const TILT_CEILING = 0.15        // line 172
const TILT_FLOOR_LIMIT = 0.50    // line 178
const TILT_OFFSET_CEILING = -0.325
```

**Verdict:** `TILT_CEILING` is applied **INSIDE the VMM** before emitting `tilt_offset`. The `NodeArbiter` only applies a generic `clamp(0, 1)` on the **final sum** (`baseTilt + offset`). It knows nothing about mount orientation or mechanical tilt limits.

### 2.2 Clamp Order (Layered Defense)

| Layer | File | Clamp Applied |
|-------|------|---------------|
| 1 — VMM | `VibeMovementManager.ts` | `TILT_CEILING` / `TILT_FLOOR_LIMIT` to `intent.y` |
| 2 — Adapter | `KineticAdapter.ts:283` | `clamp(intent.y, -1, 1)` → `tilt_offset` |
| 3 — Arbiter | `NodeArbiter.ts:887` | `clamp(0, 1)` on `baseTilt + offset` |
| 4 — Resolver | `NodeResolver.ts` | `sanitizeDmxByte()` → `[0, 255]` |

---

## 3. RELEASE / UNLOCK — Spatial Target Liberation

### 3.1 IPC Handler

**File:** `src/core/aether/AetherIPCHandlers.ts` | **Lines:** 844–873

```typescript
ipcMain.handle(
  'lux:aether:releaseSpatialTarget',
  (_event, { fixtureIds }: { fixtureIds: string[] }) => {
    if (!Array.isArray(fixtureIds)) {
      return { success: false, error: 'fixtureIds must be an array' }
    }
    try {
      const arbiter = getTitanOrchestrator().getAetherArbiter()
      for (const id of fixtureIds) {
        arbiter.clearManualOverride(`${id}:kinetic`)
        arbiter.clearSpatialDistanceScale(`${id}:kinetic`)
      }
      if (fixtureIds.length === 0) {
        arbiter.clearAllSpatialDistanceScales()
      }
      return { success: true }
    } catch (err) {
      console.error('[AetherIPC] releaseSpatialTarget error:', err)
      return { success: false, error: String(err) }
    }
  }
)
```

### 3.2 `clearManualOverride` — Fade or Delete?

**File:** `src/core/aether/NodeArbiter.ts` | **Lines:** 351–378

```typescript
clearManualOverride(nodeId: NodeId, _releaseMs?: number): void {
  const channels = this._manualOverrides.get(nodeId)
  if (channels) {
    const snapshot: Record<string, number> = {}
    const durationByChannel: Record<string, number> = {}
    for (const key in channels) {
      const v = (channels as Record<string, number>)[key]
      if (typeof v === 'number' && Number.isFinite(v)) {
        snapshot[key] = v
        durationByChannel[key] = SLOW_RELEASE_CHANNELS.has(key)
          ? RELEASE_MS_SLOW
          : RELEASE_MS_FAST
      }
    }
    if (Object.keys(snapshot).length > 0) {
      this._releaseStates.set(nodeId, {
        channels: snapshot,
        startedAtMs: performance.now(),
        durationByChannel,
      })
    }
  }
  this._manualOverrides.delete(nodeId)
  this._motorKineticOverrides.delete(nodeId)  // WAVE 4935 M2: Ghost Anchor fix
}
```

**Constants:**
```typescript
const SLOW_RELEASE_CHANNELS = new Set<string>(['pan', 'tilt', 'zoom', 'focus', 'rotation'])
const RELEASE_MS_FAST = 200
const RELEASE_MS_SLOW = 1000
```

**Behavior:**
- `_manualOverrides.delete(nodeId)` — **immediate deletion**.
- `_motorKineticOverrides.delete(nodeId)` — **immediate deletion**.
- `_releaseStates.set(nodeId, { snapshot, startedAtMs, durationByChannel })` — **fade snapshot captured** before deletion.
- Fade runs for **200ms** (fast channels) or **1000ms** (`pan`/`tilt` — slow channels).

### 3.3 Release Fade — `_applyReleaseFades()`

**File:** `src/core/aether/NodeArbiter.ts` | **Lines:** 1267–1300

```typescript
private _applyReleaseFades(): void {
  const now = performance.now()
  for (const [nodeId, rel] of this._releaseStates) {
    let record = this._result.get(nodeId)
    let fadeCompleted = true
    for (const key in rel.channels) {
      const duration = rel.durationByChannel[key] ?? RELEASE_MS_FAST
      const elapsed  = now - rel.startedAtMs
      if (elapsed < duration) fadeCompleted = false
      const t = elapsed >= duration ? 1.0 : elapsed / duration
      const fadeWeight = 1.0 - t * t * t  // ease-out cubic
      if (fadeWeight <= 0) continue
      const releaseValue = rel.channels[key]
      if (!record) {
        record = this._acquireRecord()
        this._result.set(nodeId, record)
      }
      const l0Value = record[key]
      if (l0Value !== undefined && Number.isFinite(l0Value)) {
        record[key] = releaseValue * fadeWeight + l0Value * (1.0 - fadeWeight)
      } else {
        record[key] = releaseValue * fadeWeight
      }
    }
    if (fadeCompleted) {
      this._releaseStates.delete(nodeId)
    }
  }
}
```

**Sequence in `arbitrate()` pipeline:**
1. L0–L3 intents merged into `_result`
2. `_applyRelativeOffsetFusion()` (post-L2/L3, pre-hardlock)
3. Manual Hard Lock (L2 re-applied)
4. Manual Intensity Lock
5. **`_applyReleaseFades()`** — blends snapshot back into `_result`
6. Grand Master scaling

**Critical timing issue:** Release fade is applied **AFTER** the fusion. If the operator releases spatial control:
- `_motorKineticOverrides` is deleted immediately.
- On the next frame, the VMM (L0) may emit `pan_offset`/`tilt_offset` again.
- `_applyRelativeOffsetFusion` sees `hasMotorPan = false`, `hasManualPan = false` → base becomes `0.5`.
- The fixture snaps from its IK target to a VMM orbit around `0.5` (neutral center).
- The release fade tries to smooth `pan`/`tilt`, but since fusion already wrote `record['pan']`/`tilt`, the fade blends over it. If L0 did not write `pan`/`tilt` (only `pan_offset`/`tilt_offset`), the fade writes to `record['pan']` while fusion has already computed a different `record['pan']` on this frame — potential double-write in the same frame.

---

## 4. HOLD STATE — Temblores / Freeze Detection

### 4.1 Detection Logic

**File:** `src/core/aether/NodeArbiter.ts` | **Lines:** 843–850

```typescript
const isHoldState = (hasManualPan || hasManualTilt) && !hasMotorPan && !hasMotorTilt
if (isHoldState) {
  if (hasManualPan && !isFiniteChannelValue(manualAbsPan)) record['pan'] = manualPan as number
  if (hasManualTilt && !isFiniteChannelValue(manualAbsTilt)) record['tilt'] = manualTilt as number
  continue
}
```

**Condition:** `_manualOverrides` has `pan_base`/`tilt_base` (radar anchor) BUT `_motorKineticOverrides` has NOTHING.

### 4.2 HOLD Trigger on Unlock?

**YES — if the unlock sequence is not atomic.**

When `releaseSpatialTarget` is called:
1. `clearManualOverride()` deletes `_manualOverrides` AND `_motorKineticOverrides`.
2. If the fixture had a manual radar anchor (`pan_base` in `_manualOverrides`) AND a motor override (`pan_base` in `_motorKineticOverrides`), both are deleted.
3. **However**, if the UI previously set a manual anchor (e.g. via `_flushClassic`) and then the operator switched to spatial IK, the `_manualOverrides` might STILL contain the old anchor even though `_motorKineticOverrides` now has the IK base.
4. When spatial is released, `_motorKineticOverrides` is cleared. If `_manualOverrides` still has the old anchor, the next frame sees:
   - `hasManualPan = true` (stale anchor)
   - `hasMotorPan = false` (just released)
   - `isHoldState = true`
5. The fixture **freezes at the stale manual anchor** instead of returning to VMM orbit.

This is the **Sticky Clutch** scenario described in WAVE 4934–4935. The WAVE 4935 fix at line 847 checks `!isFiniteChannelValue(manualAbsPan)` to allow fresh absolute manual values to break the hold, but it does NOT clear the stale `_manualOverrides` anchor.

---

## 5. L2 SUPREMACY GATES

### 5.1 KineticAdapter Gate

**File:** `src/core/aether/adapters/KineticAdapter.ts` | **Lines:** 210–214

```typescript
if (
  aetherKineticEngine.hasNode(node.nodeId) ||
  (arbiter && arbiter.getMotorKineticOverride(`${fixtureId}:kinetic`) !== undefined)
) {
  return // L2 SUPREMACY: El VMM clásico se calla.
}
```

**Critical finding:** The second condition `getMotorKineticOverride() !== undefined` was added to handle spatial IK nodes. However, this only blocks the VMM from emitting offsets for nodes that have a **current** motor override. If `releaseSpatialTarget` clears the motor override, the VMM immediately resumes emission on the next frame because `getMotorKineticOverride()` returns `undefined`.

### 5.2 `isContinuous` Shield

**File:** `src/core/aether/adapters/KineticAdapter.ts` | **Lines:** 218–230

```typescript
if (node.isContinuous) {
  return
}
```

This is unrelated to IK/VMM fusion — it protects fans/mirror balls from positional LFOs.

---

## 6. SUMMARY TABLE — LTP Hierarchy for Movement

| Priority | Layer | Writes to | Channels | Mechanism |
|----------|-------|-----------|----------|-----------|
| 1 (Highest) | Manual Hard Lock | `_manualChannelLocks` | All except `pan_base`/`tilt_base` | Post-L3 overwrite |
| 2 | L3 Effects | `_effectIntents` / `_hephaestusIntents` | Arbitrary | L3 Dominance Shield |
| 3 | L2-MOTOR (IK) | `_motorKineticOverrides` | `pan_base`, `tilt_base` | Absolute base for fusion |
| 4 | L2-MANUAL (Radar) | `_manualOverrides` | `pan_base`, `tilt_base` / `pan`, `tilt` | Absolute or anchor |
| 5 | L1 Selene | `_seleneBus` | Arbitrary | LTP |
| 6 | L0 VMM | `_systemBus` → `_result` | `pan_offset`, `tilt_offset` | Additive fusion with base |
| 7 | Release Fade | `_releaseStates` | `pan`, `tilt`, etc. | ease-out cubic blend over L0 |

**The jitter on unlock is caused by:**
1. `releaseSpatialTarget` deletes both `_manualOverrides` and `_motorKineticOverrides`.
2. VMM (L0) resumes emitting `pan_offset`/`tilt_offset` because `getMotorKineticOverride()` is now `undefined`.
3. `_applyRelativeOffsetFusion` sees no base → falls back to `0.5` neutral center.
4. The fixture snaps from its IK target to a VMM orbit around center, UNLESS a release fade on `pan`/`tilt` from a previous manual override still exists in `_releaseStates`.
5. If a stale manual anchor survived in `_manualOverrides` (not cleared by release), `isHoldState` may trigger, freezing the fixture at the stale anchor.

---

*End of WAVE 4980 Forensic Audit Report.*
