# WAVE 4930 — VMM Kinematic Audit & Clamping
## Forensic Report · OPUS / SONNET (CORE_ARCHITECT & MATH_EXPERT)
**Date:** 2026-05-28 · **Scope:** Read-only audit · **Target:** `VibeMovementManager` + downstream pipeline

---

## 0. Executive Summary

A critical kinematic regression has been identified in the **VibeMovementManager (VMM)** and its downstream pipeline. Two prior waves—**WAVE 4730 "Tríada"** (amplitude scaling) and **WAVE 4731 "Deshielo"** (velocity limits)—aggressively relaxed safety bounds to counteract earlier over-constriction. The pendulum swung too far: amplitudes now exceed safe mechanical envelopes, and velocity ceilings were raised beyond prudent hardware limits. The Tilt axis, in particular, lacks any horizon-aware clamping, allowing moving heads mounted on ceiling trusses to point straight up at the roof (`tilt_final ≈ 1.0 → 255 DMX`).

This report documents the exact math, line numbers, and propagation chain. **No code has been modified.**

---

## 1. Mission 1 — Velocity Audit (Phase Delta)

### 1.1 Phase Accumulation Formula

**File:** `src/engine/movement/VibeMovementManager.ts`  
**Lines:** 935–945

```typescript
const beatsPerSecond = this.smoothedBPM / 60
const beatsThisFrame = beatsPerSecond * frameDeltaTime
const chillSedationFactor = vibeId === 'chill-lounge' ? 0.80 : 1.0
const manualSpeedFactor = this.manualSpeedOverride !== null
  ? Math.pow(2, (this.manualSpeedOverride - 50) / 50)
  : 1.0
const effectiveBeats = beatsThisFrame * this.globalSpeedMultiplier * manualSpeedFactor * chillSedationFactor

const phasePerBeat = (2 * Math.PI) / currentCycleBeats
this.schedulerState.phase += effectiveBeats * phasePerBeat
```

**Multiplicative chain:**
- `smoothedBPM` (unclamped except `getSafeBPM` 60–200)
- `globalSpeedMultiplier = 0.8` (WAVE 4730: raised from 0.6)
- `manualSpeedFactor` (if active): range `0.25× → 4.0×`
- `chillSedationFactor = 0.80` (only chill; all others = 1.0)
- `energyBoost` is **NOT** applied to phase velocity here; it only affects amplitude later

### 1.2 Base Frequencies Restored to Pre-4730 NITRO Values

| Vibe | `baseFrequency` | CycleBeats (typical) | Implied Hz @ 130 BPM |
|------|-----------------|----------------------|----------------------|
| `techno-club` | **0.22** | 8 (scan_x) | ~0.48 Hz |
| `fiesta-latina` | **0.17** | 16 (figure8) | ~0.18 Hz |
| `pop-rock` | **0.20** | 16 (circle_big) | ~0.21 Hz |

These `baseFrequency` values are the **legacy pre-WAVE-4730 NITRO values** (see comment line 181: "🔥 NITRO: restaurado al valor original pre-WAVE-4730"). They were intentionally restored after a prior constriction wave, but combined with the doubled `cycleBeats` they still produce brisk motion.

### 1.3 Velocity Limits (AetherSafetyMiddleware) — The Smoking Gun

**File:** `src/core/aether/egress/AetherSafetyMiddleware.ts`  
**Lines:** 24–40

```typescript
const KINETIC_SAFETY_CAP_VEL = 350   // 🔥 200→350
const KINETIC_DEFAULT_REV_PAN  = 200  // 🔥 130→200
const KINETIC_DEFAULT_REV_TILT = 150  // 🔥 90→150

const VIBE_REV_LIMITS = {
  'techno-club':   { pan: 300, tilt: 220 },  // 🔥 170/130→300/220
  'fiesta-latina': { pan: 240, tilt: 180 },  // 🔥 150/110→240/180
  'pop-rock':      { pan: 200, tilt: 150 },  // 🔥 130/90→200/150
  // ...
}
```

**Analysis:**
- WAVE 4731 "DESHIELO" raised the per-vibe rev limits by **~70% across the board**.
- The comment "🔥 200→350" on `KINETIC_SAFETY_CAP_VEL` is explicit: the absolute ceiling was lifted by 75%.
- These are **velocity** limits, not **position** limits. They cap how fast the head can spin, but do NOT prevent the head from reaching mechanically dangerous angles.

**Conclusion M1:** The combination of restored `baseFrequency`, `globalSpeedMultiplier = 0.8`, and dramatically raised `VIBE_REV_LIMITS` produces mechanically stressful speeds on Techno and Latino profiles. A **30–40% global reduction** should target:
1. `globalSpeedMultiplier`: 0.8 → **0.50–0.55**
2. `baseFrequency` for techno: 0.22 → **0.13–0.15**
3. `baseFrequency` for latino: 0.17 → **0.10–0.12**
4. `baseFrequency` for pop-rock: 0.20 → **0.13–0.15**
5. `VIBE_REV_LIMITS` techno pan: 300 → **180–200**, tilt: 220 → **130–150**
6. `VIBE_REV_LIMITS` latina pan: 240 → **150–165**, tilt: 180 → **105–120**

---

## 2. Mission 2 — Amplitude & Tilt Clamping

### 2.1 Amplitude Chain — From VibeConfig to DMX

**Step A: VibeConfig scales (WAVE 4730 Tríada)**

**File:** `src/engine/movement/VibeMovementManager.ts`  
**Lines:** 174–228

| Vibe | `panScale` | `tiltScale` |
|------|-----------|-------------|
| `techno-club` | **0.92** | **0.85** |
| `fiesta-latina` | **0.95** | **0.88** |
| `pop-rock` | **0.90** | **0.82** |

These are the **raw scale factors** passed into `calculateEffectiveAmplitude()`. At 100% energy they request up to 92% of full pan range (~497° on a 540° head) and 88% of full tilt range (~238° on a 270° head).

**Step B: Energy boost inside `calculateEffectiveAmplitude()`**

**File:** `src/engine/movement/VibeMovementManager.ts`  
**Lines:** 1256–1284

```typescript
const energyBoost = 1.0 + energy * 0.2          // → 1.0 .. 1.20
const requestedAmplitude = baseAmplitude * energyBoost
const requestedTravel = 255 * requestedAmplitude
const gearboxFactor = Math.min(1.0, maxTravelPerCycle / requestedTravel)
const GEARBOX_MIN_AMPLITUDE = 0.10              // WAVE 2192: 0.85→0.10
const gearboxResult = requestedAmplitude * gearboxFactor
return Math.min(1.0, Math.max(GEARBOX_MIN_AMPLITUDE, gearboxResult))
```

**Critical finding:** The Gearbox is a **velocity protector**, NOT an amplitude limiter. It checks if the fixture's `maxPanSpeed` can traverse `requestedTravel` within one cycle. If the motor is fast enough, `gearboxFactor = 1.0` and the amplitude passes through **unattenuated**. With modern budget movers rated at 250+ DMX/s, the gearbox almost never fires for typical cycle beats (8–16).

**Step C: Phrase Envelope**

**File:** `src/engine/movement/VibeMovementManager.ts`  
**Lines:** 1050–1056

```typescript
const phraseEnvelope = 0.925 + 0.075 * Math.sin(Math.PI * (phraseProgress - 0.15))
const clampedEnvelope = Math.max(0.85, Math.min(1.0, phraseEnvelope))
```

Envelope range: **0.85 → 1.00** (already conservative; not the culprit).

**Step D: Relative Offset Fusion (NodeArbiter)**

**File:** `src/core/aether/NodeArbiter.ts`  
**Lines:** 751–838

```typescript
const ampPan  = amp * RELATIVE_OFFSET_SCALE_PAN   // amp * 0.5
const ampTilt = amp * RELATIVE_OFFSET_SCALE_TILT  // amp * 0.5

// baseTilt fallback = 0.5 (centro neutro)
const baseTilt = hasMotorTilt  ? motorTilt
               : hasManualTilt ? manualTilt
               : 0.5

let final = baseTilt + oy * ampTilt * distScale
if (final < 0) final = 0
else if (final > 1) final = 1
record['tilt'] = final
```

Where:
- `oy` = `tilt_offset` emitted by KineticAdapter = `clamp(intent.y, -1, 1)`
- `amp` = `_relativeOffsetAmplitude` (Programmer slider, default typically **1.0**)
- `distScale` = spatial distance scale (default **1.0**)

**Maximum Tilt Reach (worst case, no manual override):**

```
baseTilt = 0.5
oy = +1.0  (pattern at its upper apex)
ampTilt = 1.0 * 0.5 = 0.5
distScale = 1.0

tilt_final = 0.5 + 1.0 * 0.5 * 1.0 = 1.0  →  255 DMX
```

**This is the core issue.** With `baseTilt = 0.5` (center mechanical) and a symmetric orbit of ±0.5, the pattern reaches the absolute mechanical maximum (255 DMX). For a ceiling-mounted fixture whose 0.5 position is calibrated to point at the audience horizon, `tilt_final = 1.0` means the beam shoots straight up at the roof.

### 2.2 The Missing Horizon Clamp

**Current pipeline clamping:**

| Stage | Clamp | Effect |
|-------|-------|--------|
| VMM `position.y` | `Math.max(-1, Math.min(1, ...))` | Normalized [-1, +1] |
| NodeArbiter fusion | `if (final < 0) final = 0; else if (final > 1) final = 1` | DMX normalized [0, 1] |
| NodeResolver `_applyCalibration` | `tiltLimitMin/Max` (opt-in, per-device) | Only if operator configured limits |
| NodeResolver `applyAirbag` | `margin = 5` → clamps to [5, 250] | Mechanical edge protection only |

**There is NO horizon-aware ceiling.** Nothing prevents a ceiling-mounted mover from tilting above the horizontal plane.

### 2.3 VMM Tilt Offset — Only Techno is Protected

**File:** `src/engine/movement/VibeMovementManager.ts`  
**Line:** 1064

```typescript
const tiltOffset = vibeId === 'techno-club' ? -0.20 : 0
```

Techno-club receives a **−0.20 bias** (20% downward shift), pushing the pattern toward the dancefloor. Latino, Pop-Rock, and Chill have **zero bias**, meaning their patterns are perfectly symmetric around `baseTilt = 0.5`.

### 2.4 Hardware Orientation Logic

**File:** `src/core/aether/resolver/NodeResolver.ts`  
**Lines:** 1275–1291

```typescript
private _shouldInvertClassicKineticAxes(deviceOrientation, node): boolean {
  if (orientation?.includes('ceiling') || orientation?.startsWith('truss')) return true
  if (installation === 'ceiling' || installation === 'truss-front' || installation === 'truss-back') return true
  // ...
}
```

When inverted, `dmxValue = 255 - dmxValue` **before** calibration. This flips the axis direction but does NOT introduce a horizon clamp. A symmetric pattern still spans the full mechanical range; it just does so in the opposite direction.

**Conclusion M2:**
1. **Amplitude scales** (`panScale`/`tiltScale`) must be reduced by **25–30%**:
   - Techno tilt: 0.85 → **0.58–0.63**
   - Latino tilt: 0.88 → **0.61–0.66**
   - Pop-Rock tilt: 0.82 → **0.57–0.61**
   - Pan scales should also be reduced (though Pan pointing behind the rig is less dangerous than Tilt pointing at the roof).

2. **Introduce a Tilt Horizon Ceiling** after the NodeArbiter fusion (or in the VMM before emitting `intent.y`):
   - For ceiling/truss-mounted fixtures, define `HORIZON_TILT_NORM = 0.5` (the calibrated horizontal plane).
   - The orbit should be **asymmetric**: allowed to go *below* horizon (dmx > 0.5) but **clamped above** (dmx ≤ 0.5).
   - Mathematically: `tilt_final = clamp01(baseTilt + tiltOffset * ampTilt * distScale)` followed by `tilt_final = Math.min(tilt_final, baseTilt)` when `installation ∈ {ceiling, truss}`.
   - Alternatively, apply the clamp in the VMM: `y_clamped = Math.min(y_raw, 0.0)` for ceiling fixtures, so the pattern never produces a positive `tilt_offset` that would push above the base.

3. **Phrase Envelope** is fine; leave it.

4. **Energy boost** (`1.0 + energy * 0.2`) should be reduced to `1.0 + energy * 0.10` or removed entirely for kinetic amplitude.

---

## 3. Mission 3 — Rest Position (Offset) Verification

### 3.1 Home/Base Positions

**File:** `src/core/aether/systems/KineticSystem.ts`  
**Lines:** 69–71

```typescript
const HOME_PAN  = 0.5
const HOME_TILT = 0.5
```

**File:** `src/core/aether/NodeArbiter.ts`  
**Lines:** 800–806

```typescript
const basePan  = hasMotorPan  ? (motorPan  as number)
               : hasManualPan ? (manualPan as number)
               : 0.5
const baseTilt = hasMotorTilt  ? (motorTilt  as number)
               : hasManualTilt ? (manualTilt as number)
               : 0.5
```

**Finding:** The rest position is **mechanical center (0.5)**. For a ceiling-mounted fixture, if the operator has NOT set a manual `pan_base`/`tilt_base` via the radar/IK, the default base is straight down (if DMX 128 = center of 270° range = 135° from either extreme). However, the operator typically calibrates `baseTilt = 0.5` to point horizontally at the crowd.

### 3.2 The Asymmetry Gap

When `baseTilt = 0.5` is calibrated to the horizon:
- `y = +1` → tilt_final = 1.0 → **above horizon (ROOF)** ❌
- `y = -1` → tilt_final = 0.0 → **below horizon (FLOOR)** ✅

The pattern is **symmetric** around baseTilt, but the mechanical safe zone is **asymmetric**: the fixture can safely point down at the crowd but should NOT point up at the roof/truss.

### 3.3 KineticSystem — DROP_TILT Safety

**File:** `src/core/aether/systems/KineticSystem.ts`  
**Lines:** 82–86

```typescript
const DROP_TILT = 0.20         // Tilt dramático para el drop
const BUILD_TILT_TARGET = 0.90 // Tilt base para build: apunta al techo
```

`BUILD_TILT_TARGET = 0.90` is explicitly designed to point "hacia el techo" (toward the ceiling) during build sections. This is intentional for floor-standing fixtures in stadium mode, but **dangerous** for ceiling-mounted club rigs.

**Conclusion M3:**
1. A **default downward bias** should be applied when no manual base is set:
   - `defaultBaseTilt = 0.5` for floor fixtures
   - `defaultBaseTilt = 0.6–0.65` for ceiling/truss fixtures (points lower, keeping the orbit below the horizon)
2. Alternatively, keep `baseTilt = 0.5` but apply an **orbit bias** of −0.15 to −0.25 for all ceiling/truss profiles, forcing the center of the pattern below the horizon.
3. `BUILD_TILT_TARGET` must be gated by fixture installation type: ceiling/truss fixtures should NOT execute a 0.90 tilt build.

---

## 4. Recommendations Summary (No-Code Changes)

| Parameter | Current | Recommended | Reduction | File |
|-----------|---------|-------------|-----------|------|
| `globalSpeedMultiplier` | 0.8 | **0.50–0.55** | 30–38% | `VibeMovementManager.ts:690` |
| `baseFrequency` (techno) | 0.22 | **0.13–0.15** | 32–41% | `VibeMovementManager.ts:181` |
| `baseFrequency` (latino) | 0.17 | **0.10–0.12** | 29–41% | `VibeMovementManager.ts:192` |
| `baseFrequency` (pop-rock) | 0.20 | **0.13–0.15** | 25–35% | `VibeMovementManager.ts:203` |
| `tiltScale` (techno) | 0.85 | **0.58–0.63** | 25–32% | `VibeMovementManager.ts:180` |
| `tiltScale` (latino) | 0.88 | **0.61–0.66** | 25–31% | `VibeMovementManager.ts:191` |
| `tiltScale` (pop-rock) | 0.82 | **0.57–0.61** | 25–30% | `VibeMovementManager.ts:202` |
| `energyBoost` coeff | `energy * 0.2` | **`energy * 0.10`** or 0 | 50–100% | `VibeMovementManager.ts:1268` |
| `VIBE_REV_LIMITS.techno.pan` | 300 | **180–200** | 33–40% | `AetherSafetyMiddleware.ts:35` |
| `VIBE_REV_LIMITS.techno.tilt` | 220 | **130–150** | 32–41% | `AetherSafetyMiddleware.ts:35` |
| `VIBE_REV_LIMITS.latina.pan` | 240 | **150–165** | 31–38% | `AetherSafetyMiddleware.ts:36` |
| `VIBE_REV_LIMITS.latina.tilt` | 180 | **105–120** | 33–42% | `AetherSafetyMiddleware.ts:36` |
| `KINETIC_SAFETY_CAP_VEL` | 350 | **250** | 29% | `AetherSafetyMiddleware.ts:25` |

### New Clamping Logic Required

**Option A — Clamp in VMM (preferred, upstream):**
```typescript
// After computing rawPosition but before returning intent
if (installationIsCeilingOrTruss) {
  rawPosition.y = Math.min(rawPosition.y, 0.0)  // never above horizon
}
```

**Option B — Clamp in NodeArbiter (downstream, affects all L0 sources):**
```typescript
// In _applyRelativeOffsetFusion, after computing final tilt:
if (isCeilingTruss && final > baseTilt) {
  final = baseTilt  // cap at horizon
}
```

**Option C — Clamp in NodeResolver (last resort, DMX domain):**
```typescript
// In _applyCalibration or after _applyTransferCurve for TILT_COARSE:
if (installationIsCeilingOrTruss && dmxValue > HORIZON_DMX) {
  dmxValue = HORIZON_DMX
}
```

> **Recommendation:** Implement **Option A** (VMM) + **Option B** (NodeArbiter as defensive fallback). Option A preserves the semantic intent; Option B protects against any future L0 source that forgets the rule.

---

## 5. Appendices

### Appendix A — Full Normalized-to-DMX Chain

```
VMM Pattern Function
  ↓ rawPosition {x, y} ∈ [-1, +1]
VMM Amplitude Scaling (panScale/tiltScale + energyBoost + gearbox + phraseEnvelope)
  ↓ position {x, y} ∈ [-1, +1]
VMM Stereo Offset (mirror/snake)
  ↓ stereoPosition {x, y} ∈ [-1, +1]
KineticAdapter
  ↓ pan_offset = clamp(x, -1, 1), tilt_offset = clamp(y, -1, 1)
NodeArbiter._applyRelativeOffsetFusion()
  base = 0.5 (or motor/manual override)
  amp = _relativeOffsetAmplitude * 0.5
  final = clamp01(base + offset * amp * distScale)
  ↓ pan, tilt ∈ [0, 1]
NodeResolver._writeNode() → _applyTransferCurve() → *255
  ↓ dmxValue ∈ [0, 255]
NodeResolver._applyCalibration()
  invertTilt? 255-v
  tiltOffset? v + offset
  tiltLimitMin/Max? clamp
  ↓ dmxValue ∈ [0, 255]
AetherSafetyMiddleware.applyAirbag()
  margin = 5 → [5, 250]
  ↓ dmxValue ∈ [5, 250]
HAL.sendToDriver()
```

### Appendix B — Comment Archaeology (WAVE 4730 / 4731)

- `VibeMovementManager.ts:176`: "🏛️ WAVE 4730 TRÍADA: panScale 0.72→0.92, tiltScale 0.68→0.85, freq 0.22→0.10" — The frequency comment says 0.10 but the code stores 0.22 with a NITRO comment restoring the original. The discrepancy suggests an incomplete rollback.
- `AetherSafetyMiddleware.ts:25`: "🔥 WAVE 4731 DESHIELO: CAP re-elevado." — Explicit acknowledgment that limits were intentionally raised.
- `VibeMovementManager.ts:1277`: "🔧 WAVE 2192: GEARBOX LIBERATION — Floor 0.85 → 0.10" — The gearbox floor was lowered to allow presets to control amplitude, but this also means the gearbox no longer enforces a minimum safe amplitude.

---

*End of Report · WAVE 4930*
