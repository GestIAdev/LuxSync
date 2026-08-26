# WAVE 7607: EREBUS 3D & SPATIAL CALIBRATION AUDIT

**Date:** 2026-08-26
**Role:** Architectural Analyst (GLM)
**Mode:** READ-ONLY — No code modified
**Purpose:** Pre-deployment audit before physical warehouse testing of Moving Heads and Tungsten arrays.

---

## 1. 3D COORDINATE SPACE MAPPING

### 1.1 Coordinate System

| Property | Value |
|----------|-------|
| **Convention** | Right-handed (Three.js standard) |
| **Y Axis** | UP — 0 = floor, positive = skyward |
| **X Axis** | LEFT/RIGHT — negative = stage left, positive = stage right |
| **Z Axis** | FORWARD/BACK — negative = upstage (back), positive = downstage (audience) |
| **Origin (0,0,0)** | **Center of the floor** |

**Evidence:**
- `NeonFloor.tsx:124` — Floor mesh positioned at `[0, 0, 0]`
- `StudioFloor.tsx:102` — Studio floor at `[0, 0, 0]`
- `VisualizerCanvas.tsx:55` — Default camera target `[0, 2, 0]` (center, 2m up)
- `VisualizerCanvas.tsx:190` — Clipping plane at Y=0 prevents rendering below floor
- `mountQuaternion.ts:17` — "Notación Three.js (right-hand rule, Y arriba)"

### 1.2 Absolute Limits (Default Stage)

| Axis | Min | Max | Notes |
|------|-----|-----|-------|
| **X** | -6.0m | +6.0m | `±stageWidth/2` (12m default) |
| **Y** | 0.0m | +6.0m | Floor to truss (6m default) |
| **Z** | -4.0m | +4.0m | `±stageDepth/2` (8m default) |

### 1.3 Key 3D Files

| File | Purpose |
|------|---------|
| `VisualizerCanvas.tsx` | Live 3D visualizer (React Three Fiber) |
| `StudioCanvas.tsx` | Erebus Studio 3D editor (drag-drop placement) |
| `useFixture3DData.ts` | Transforms store data → `Fixture3DData[]` for rendering |
| `HyperionMovingHead3D.tsx` | Moving head 3D mesh rendering |
| `HyperionPar3D.tsx` | Par/Wash 3D mesh rendering |
| `NeonFloor.tsx` | Floor grid mesh |
| `mountQuaternion.ts` | Mount orientation → Three.js quaternion conversion |

### 1.4 Fixture Position → 3D World Mapping

**Placed fixtures** (`isPlaced === true`): Direct 1:1 mapping
```
worldX = fixture.position.x
worldY = fixture.position.y
worldZ = fixture.position.z
```

**Unplaced fixtures** (zone-based): Algorithmic placement using `ZoneLayoutEngine.ts`
```
x = layout.fixedX * halfWidth          // or distributed across xRange
y = UNPLACED_SENTINEL_Y (3.0m)         // hardcoded fallback height
z = layout.depthFactor * halfDepth
```

---

## 2. SPATIAL CALIBRATION MATH PIPELINE

### 2.1 Pipeline Overview

```
Target XYZ (meters)
    │
    ▼
[1] World vector: dx, dy, dz = target - fixture.position
    │
    ▼
[2] Mount orientation: getIKMountAngles(installation) → pitch/yaw/roll
    │
    ▼
[3] Custom rotation: mount + fixture.orientation.rotation (deg→rad)
    │
    ▼
[4] Local frame transform: rotateToLocalFrameInto() — inverse Euler (YXZ)
    │
    ▼
[5] Horizontal distance: √(localX² + localZ²)
    │
    ▼
[6] Gimbal lock deflector: if horizontalDist < 0.05m → nudge localZ
    │
    ▼
[7] CORE TRIGONOMETRY:
    panDeg  = atan2(local.x, -local.z) × (180/π)
    tiltDeg = atan2(horizontalDist, -local.y) × (180/π)
    │
    ▼
[8] Calibration offsets: + panOffset, + tiltOffset (degrees)
    │
    ▼
[9] DMX conversion: ((deg + range/2) / range) × 255
    │
    ▼
[10] Anti-flip: resolveShortestPanPath() — tests ±360° candidates
    │
    ▼
[11] Axis inversion: panInvert/tiltInvert → (255 - dmx)
    │
    ▼
[12] Safety clamp: [PAN_SAFETY_MARGIN, 255 - PAN_SAFETY_MARGIN]
    │
    ▼
DMX Pan (0-255) + DMX Tilt (0-255)
```

### 2.2 Core Trigonometry (BLINDADO — WAVE 4899)

**File:** `InverseKinematicsEngine.ts:253-254`

```typescript
const panDeg  = Math.atan2(local.x, -local.z) * RAD_TO_DEG
const tiltDeg = Math.atan2(horizontalDist, -local.y) * RAD_TO_DEG
```

**Pan:** Azimuth angle in the XZ plane. The `-local.z` inverts Z so that 0° = facing forward (toward audience). Returns [-180°, +180°].

**Tilt:** Elevation angle from vertical. `horizontalDist = √(localX² + localZ²)` is the ground-plane distance to target. `-local.y` inverts Y so that 0° = pointing straight down (ceiling mount). Returns [0°, 180°].

### 2.3 Mounting Orientation Effects

**File:** `mountTransforms.ts:96-140`

| Orientation | Yaw | Pitch | Roll | Effect |
|-------------|-----|-------|------|--------|
| `ceiling` | 0° | 0° | 0° | Identity — local = world |
| `truss-front` | 0° | 0° | 0° | Identity — local = world |
| `truss-back` | 180° | 0° | 0° | Front↔Back flip |
| `floor` | 0° | 0° | 0° | Identity — **tilt emerges from dy sign** |
| `totem` | 0° | 0° | 0° | Identity — **tilt emerges from dy sign** |
| `wall-left` | 90° | 0° | 0° | Rotated 90° around Y |
| `wall-right` | -90° | 0° | 0° | Rotated -90° around Y |

**Critical design insight:** `pitchRad` is ALWAYS 0 in the IK domain. The correct tilt for floor/totem fixtures emerges from the SIGN of `dy` (target above fixture) in the tilt formula — NOT from a pitch rotation. This is a deliberate architectural decision documented at `mountTransforms.ts:13-20`.

### 2.4 Calibration Offsets Storage

**Per-fixture, persisted in show file:**

```typescript
// ShowFileV2.ts:887-896
fixture.calibration = {
  panOffset: number    // degrees (-180 to +180) — mechanical compensation
  tiltOffset: number   // degrees (-90 to +90) — mechanical compensation
  panInvert: boolean   // pan axis inverted by mounting
  tiltInvert: boolean  // tilt axis inverted by mounting
}
```

**Applied in degree domain** (before DMX conversion), NOT at DMX level:
```typescript
let calibratedPanDeg  = panDeg  + fixture.calibration.panOffset
let calibratedTiltDeg = tiltDeg + fixture.calibration.tiltOffset
```

### 2.5 DMX Conversion

```
DMX 0   = -range/2 degrees  (e.g., -270° for 540° pan)
DMX 127 = 0 degrees          (center/home)
DMX 255 = +range/2 degrees  (e.g., +270° for 540° pan)
```

**Defaults:** Pan = 540°, Tilt = 270° (industry standard moving head ranges)

**Anti-flip mechanism** (`resolveShortestPanPath`, lines 700-746): Tests ±360° candidates to find shortest angular path from current position. Prevents violent 540° spins when target crosses pan zero-crossing.

### 2.6 16-bit Limitation

IK engine produces **8-bit DMX only** (0-255). Fine channels (`pan_fine`, `tilt_fine`) are set to 0 in `NodeResolver.ts:1665`. **No 16-bit IK calculation exists.** This means pan resolution is 540°/255 ≈ 2.12° per DMX step — adequate for live shows but may show stepping on slow smooth movements.

---

## 3. STAGE DIMENSIONS IMMUTABILITY

### 3.1 The Crystal Box

**File:** `ShowFileV2.ts:76-88`

```typescript
export function clampToCrystalBox(pos: Position3D, stage: StageDimensions): Position3D {
  const halfW = stage.width / 2
  const halfD = stage.depth / 2
  return {
    x: Math.max(-halfW, Math.min(halfW, snapToVoxel(pos.x))),
    y: Math.max(0, Math.min(stage.height, snapToVoxel(pos.y))),
    z: Math.max(-halfD, Math.min(halfD, snapToVoxel(pos.z))),
  }
}
```

The Crystal Box is the 3D bounding volume that enforces fixture placement limits. "Crystal" = transparent, rigid container that fixtures cannot escape. Every position update passes through this clamp.

### 3.2 Default Dimensions

```typescript
stage: { width: 12, depth: 8, height: 6, gridSize: 0.25 }
```

### 3.3 Why Effectively Immutable

| Factor | Status |
|--------|--------|
| **Technical capability** | ✅ `updateStageDimensions()` exists in stageStore |
| **User UI** | ❌ No settings panel exists |
| **Hardcoded fallbacks** | ⚠️ 8+ files have `?? 12` / `?? 8` / `?? 6` |
| **Physics dependency** | ❌ Physics engine does NOT use stage dims |
| **Calibration dependency** | ❌ IK solver does NOT use stage dims |
| **Rendering dependency** | ✅ Visualizer adapts (camera distance = diagonal × 0.8) |
| **Clamping dependency** | ✅ Crystal Box uses dims for bounds |

**Conclusion:** Immutability is a **design choice**, not a technical limitation. The IK/calibration math is completely independent of stage dimensions — it operates in world coordinates with fixture-specific mechanical limits. Changing stage dimensions would NOT break aiming math.

### 3.4 Hardcoded Fallback Locations (Risk for Inconsistency)

| File | Line | Code |
|------|------|------|
| `FixtureInspector.tsx` | 53 | `{ width: 12, depth: 8, height: 6, gridSize: VOXEL_SIZE }` |
| `MeasureLayer3D.tsx` | 80 | `stageDims ?? { width: 12, depth: 8, height: 6 }` |
| `RigSystem.tsx` | 97 | `stageDims ?? { width: 12, depth: 8, height: 6 }` |
| `ShowFileMigrator.ts` | 100 | `STAGE_REF = { width: 12, depth: 8, height: 5 }` ⚠️ |
| `NeonFloor.tsx` | 45 | `width = 12, depth = 8` |
| `HyperionTruss.tsx` | 92 | `width = 12, depth = 8, height = 5` ⚠️ |
| `useFixtureData.ts` | 199 | `stageW ?? 12, stageD ?? 8` |
| `TacticalCanvas.tsx` | 235 | `stageWidthMeters ?? 12` |

⚠️ **Note:** `ShowFileMigrator.ts` and `HyperionTruss.tsx` use **height=5** while the default is **height=6**. This is a potential inconsistency.

---

## 4. VULNERABILITIES & GOTCHAS

### 4.1 Confirmed Vulnerabilities

#### V1: panRange=0 Division by Zero (LOW severity, PARTIAL protection)

**File:** `InverseKinematicsEngine.ts:274-275, 706`

```typescript
let panDMXRaw  = ((calibratedPanDeg + panRange / 2) / panRange) * DMX_MAX
const fullRotationDMX = (360 / panRange) * DMX_MAX
```

**Trigger:** Malformed fixture profile with `panRangeDeg: 0` (explicit zero, not undefined).
**Protection:** `||` operator only catches `undefined`/`null`, NOT explicit `0`.
**Impact:** `Infinity` or `NaN` in DMX output → fixture snaps to 0 or 255.
**Live testing risk:** LOW — profiles are authored in Forge, unlikely to set 0. But a corrupt import could trigger it.

#### V2: Line Fan Division (LOW severity, PROTECTED)

**File:** `InverseKinematicsEngine.ts:389`

```typescript
const t = (i / (count - 1)) - 0.5
```

**Trigger:** `count = 1` (single fixture in fan group).
**Protection:** ✅ Early return at line 358: `if (count === 1 || amplitude === 0) return ...`
**Status:** Protected but fragile — relies on guard, not defensive formula.

#### V3: Circle Fan Division (LOW severity, PROTECTED)

**File:** `InverseKinematicsEngine.ts:422`

**Trigger:** `count = 0` (empty fixture array).
**Protection:** ✅ Early return at line 414: `if (count === 0) return []`
**Status:** Protected.

### 4.2 Gimbal Lock Handling (WELL PROTECTED)

**File:** `InverseKinematicsEngine.ts:242-254`

```typescript
let horizontalDist = Math.sqrt(local.x * local.x + local.z * local.z)

if (horizontalDist < GIMBAL_LOCK_EPSILON) {  // 0.05m = 50mm
  local.z -= GIMBAL_LOCK_EPSILON
  horizontalDist = Math.sqrt(local.x * local.x + local.z * local.z)
}
```

**What happens at pure vertical:** When target is directly above/below fixture (horizontalDist ≈ 0), `atan2(local.x, -local.z)` becomes unstable — pan could flip to any angle. The deflector artificially nudges `local.z` by 50mm to push the target out of the singularity zone.

**Effect during live testing:** If you aim a ceiling fixture straight down at a point directly beneath it, the pan will point "slightly forward" (50mm offset) rather than flipping randomly. This is a deliberate tradeoff — the beam will be ~2° off-center but stable.

**Sealed parameter:** `GIMBAL_LOCK_EPSILON` is in `SEALED_PARAMS.ts` (math-integrity category) — cannot be modified at runtime.

**Test coverage:** `InverseKinematicsEngine.test.ts:156-171` explicitly tests "target directly below" case.

### 4.3 NaN Propagation (WELL PROTECTED)

**File:** `FixturePhysicsDriver.ts:494-499, 549-550`

```typescript
if (!Number.isFinite(panDMX) || !Number.isFinite(tiltDMX)) {
  // Fall back to home position
  panDMX = config.home.pan
  tiltDMX = config.home.tilt
}
```

If IK produces NaN (from any edge case), the physics driver catches it and falls back to home position. This prevents NaN from reaching the DMX output buffer.

### 4.4 Anti-Flip Pan Resolution (WELL DESIGNED)

**File:** `InverseKinematicsEngine.ts:700-746`

When pan range is 540° and the target crosses the zero-crossing, the system tests three candidates:
- `candidate0 = rawDMX` (direct)
- `candidate1 = rawDMX + fullRotationDMX` (+360° equivalent)
- `candidate2 = rawDMX - fullRotationDMX` (-360° equivalent)

Chooses the candidate with minimum distance from current DMX position. Prevents violent 540° spins.

**Live testing note:** The first aim command after app startup may spin if `currentPanDMX` is null (no previous position known). Subsequent aims will take shortest path.

### 4.5 8-bit Resolution Limitation (DESIGN LIMITATION)

Pan resolution: 540° / 255 = **2.12° per step**
Tilt resolution: 270° / 255 = **1.06° per step**

For warehouse testing at ~5-10m throw distances, 2.12° pan steps translate to:
- At 5m: ~18.5cm beam displacement per step
- At 10m: ~37cm beam displacement per step

This may cause visible stepping during slow smooth movements. Fine channels (`pan_fine`, `tilt_fine`) are hardcoded to 0 — 16-bit IK is not implemented.

### 4.6 Height Inconsistency (DATA RISK)

| Location | Height Value |
|----------|-------------|
| `ShowFileV2.ts` default | **6m** |
| `FixtureInspector.tsx` fallback | **6m** |
| `ShowFileMigrator.ts` STAGE_REF | **5m** ⚠️ |
| `HyperionTruss.tsx` fallback | **5m** ⚠️ |

If a show file has no stage dimensions, the migrator assumes 5m height while the inspector assumes 6m. This could cause fixtures to be clamped to 5m during migration but 6m during editing.

### 4.7 Unplaced Fixture Y Hardcode

**File:** `useFixture3DData.ts:32`

```typescript
const UNPLACED_SENTINEL_Y = 3.0  // meters
```

All unplaced fixtures default to Y=3.0m regardless of stage height. If stage height is changed to 4m, unplaced fixtures would float at 3m (75% of height) rather than a proportional position.

---

## 5. SUMMARY DIAGNOSTIC TABLE

| Component | Status | Risk Level | Notes |
|-----------|--------|------------|-------|
| **3D Coordinate System** | ✅ Solid | LOW | Standard Three.js right-handed Y-up, center origin |
| **IK Math Pipeline** | ✅ Robust | LOW | Well-documented, sealed parameters, test coverage |
| **Gimbal Lock Protection** | ✅ Excellent | LOW | 50mm epsilon deflector, sealed parameter |
| **Anti-Flip Pan** | ✅ Good | LOW | First aim after startup may spin (no prior position) |
| **NaN Guards** | ✅ Good | LOW | Fallback to home position |
| **DMX Safety Clamps** | ✅ Good | LOW | 5-unit safety margin on pan stops |
| **8-bit Resolution** | ⚠️ Limited | MEDIUM | 2.12°/step pan — visible stepping at long throw |
| **panRange=0 Guard** | ⚠️ Partial | LOW | `||` doesn't catch explicit 0 |
| **Height Inconsistency** | ⚠️ Bug | MEDIUM | Migrator=5m vs Inspector=6m |
| **Stage Dimensions UI** | ❌ Missing | N/A | No user UI to change dimensions |
| **Hardcoded Fallbacks** | ⚠️ Scattered | LOW | 8+ files with `?? 12` / `?? 8` |

---

## 6. RECOMMENDATIONS FOR LIVE TESTING

### Before Deployment
1. **Verify fixture profiles** have non-zero `panRangeDeg` and `tiltRangeDeg` — a corrupt profile with 0 would cause division by zero
2. **Calibration offsets** should start at 0 for all fixtures — trim live in the warehouse
3. **First aim command** after app startup may cause a spin — initialize `currentPanDMX` from fixture home position if possible

### During Testing
4. **Pure vertical aims** (target directly below ceiling fixture) will have ~2° pan offset due to gimbal lock deflector — this is expected, not a bug
5. **Slow movements** may show stepping at long throw distances — 8-bit limitation, not fixable without 16-bit IK
6. **Floor/totem fixtures** rely on dy sign for tilt — verify that aiming "up" from a floor fixture produces correct tilt DMX

### After Testing
7. **Fix height inconsistency** — standardize all fallbacks to 6m (or better, use stageStore value)
8. **Add explicit zero-check** for panRange/tiltRange: `(fixture.limits.panRangeDeg || DEFAULT) || DEFAULT`
9. **Consider 16-bit IK** if stepping is problematic — would improve resolution 256×
10. **Add stage dimensions UI** if warehouse size differs from 12×8×6m default

---

## APPENDIX: Key File Reference

| File | Lines | Purpose |
|------|-------|---------|
| `InverseKinematicsEngine.ts` | 222-303 | Core IK solver (solveInto) |
| `InverseKinematicsEngine.ts` | 253-254 | Core trigonometry (BLINDADO) |
| `InverseKinematicsEngine.ts` | 242-251 | Gimbal lock deflector |
| `InverseKinematicsEngine.ts` | 700-746 | Anti-flip pan resolution |
| `mountTransforms.ts` | 96-105 | Mount semantics SSOT |
| `mountTransforms.ts` | 130-140 | IK mount angles |
| `ShowFileV2.ts` | 76-88 | clampToCrystalBox |
| `ShowFileV2.ts` | 887-896 | FixtureV2.calibration schema |
| `ShowFileV2.ts` | 1050-1062 | StageDimensions interface |
| `ShowFileV2.ts` | 1230-1235 | Default stage 12×8×6 |
| `FixturePhysicsDriver.ts` | 494-499 | NaN guard |
| `NodeResolver.ts` | 1544-1578 | IK integration → DMX buffer |
| `CalibrationDock.tsx` | 1-124 | Calibration UI |
| `useCalibrationSession.ts` | 36-44 | Calibration state extraction |
| `VisualizerCanvas.tsx` | 412-431 | Dynamic stage config |
| `useFixture3DData.ts` | 186-207 | Fixture → 3D position mapping |

---

**Audit complete. System is READY for live warehouse testing with the caveats noted above.**
