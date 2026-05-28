# WAVE 4932 — THE "SPLIT Y-AXIS" ANOMALY
## Forensic Tilt Lifecycle Audit · OPUS / SONNET (CORE_ARCHITECT & MATH_EXPERT)
**Date:** 2026-05-28 · **Scope:** Read-only · **No code was modified**

---

## 0. Hypothesis Under Investigation

> *"Es como si se hubiera spliteado el eje Y y tuviera el suelo bien y el cielo bien."*

This describes a **folded axis** rather than a fully inverted axis. If both sky and floor were simply inverted, we'd see a full mirror. But the description of "floor working, sky working" with extreme negative angles (−130° reported) suggests a **double inversion happening to only part of the wave cycle**, effectively folding one half of the sine wave back on top of the other. This is the mathematical signature of an implicit `Math.abs()` — or equivalently, a clamp at one boundary followed by an inversion at the other boundary.

This report traces every transformation applied to `y` from birth to DMX, identifies where each half of the sinusoidal cycle is treated differently, and pinpoints the moment the axis splits.

---

## 1. Stage 0 — Pattern Output (Birth of `y`)

**File:** `src/engine/movement/VibeMovementManager.ts`

### Ballyhoo (primary suspect per user report)

```
ballyhoo: (phase) => {
  const r = 0.75 + 0.25 * cos(2φ)        // r ∈ [0.50, 1.00]
  x = sin(1.5φ) × r
  y = cos(φ) × r                          // y ∈ [−1.00, +1.00]
}
```

**`y` range at this stage: `[−1.00, +1.00]`** — fully bipolar, symmetric around zero.

The `cos(φ)` completes one full cycle (−1 → 0 → +1 → 0 → −1) in 2π. Notably, `y` **spends as much time above zero as below zero**.

Other latino patterns for reference:
- `figure8`: `y = sin(2φ) × 0.75` — range `[−0.75, +0.75]`
- `cadera_libre`: `y = sin(3φ) × 0.60 + sin(φ) × 0.12` — range `≈ [−0.72, +0.72]`
- `espiral_conga`: `y = sin(φ) × 0.60 + sin(3φ) × 0.18` — range `≈ [−0.78, +0.78]`

All patterns emit **symmetric, centered bipolar `y`**. No pattern applies `Math.abs()`.

---

## 2. Stage 1 — VMM Amplitude & Offset (`VibeMovementManager.generateIntent`)

**File:** `src/engine/movement/VibeMovementManager.ts` · Lines 1040–1083

### 2.1 Amplitude scaling

```
effectiveTiltAmplitude = calculateEffectiveAmplitude(tiltScale=0.60, …)
finalTiltAmplitude = effectiveTiltAmplitude × clampedEnvelope    // envelope ∈ [0.85, 1.0]
```

`y` after scaling: `y₁ = rawY × finalTiltAmplitude`
- For `ballyhoo` at peak: `y₁ ∈ [−0.60, +0.60]` (approximately, before gearbox)

### 2.2 Tilt offset injection

```
const tiltOffset = mountOrientation === 'totem'
  ? −0.45
  : (TILT_OFFSET_BY_VIBE[vibeId] ?? 0)

// For 'fiesta-latina': tiltOffset = −0.35
```

```
y₂ = clamp(y₁ + tiltOffset, −1, +1)
   = clamp(rawY × 0.60 + (−0.35), −1, +1)
```

**Ballyhoo at its extremes (fiesta-latina, tiltScale=0.60):**
- `rawY = +1.00` → `y₂ = clamp(0.60 − 0.35, −1, +1) = +0.25`
- `rawY = −1.00` → `y₂ = clamp(−0.60 − 0.35, −1, +1) = −0.95`

The offset **shifts the entire sinusoid downward** by 0.35. The wave is now **asymmetric**: its positive half barely crosses +0.25 while its negative half reaches −0.95.

### 2.3 TILT_CEILING clamp

```
const TILT_CEILING = 0.15
position.y = Math.min(position.y, TILT_CEILING)     // hard cap at +0.15
```

After this clamp:
- **Positive half** of wave: `y₂ ∈ [0.00, +0.25]` → **capped at +0.15** (minor impact)
- **Negative half** of wave: `y₂ ∈ [−0.95, 0.00]` → **passes through unclamped**

**`y` at VMM output (intent.y): `[−0.95, +0.15]`**

> **Key asymmetry already born here.** The sinusoid is no longer symmetric: the "positive" half (ceiling-ward) is truncated to 15% of range, while the "negative" half (floor-ward) extends to 95% of range. But this is intentional behavior.

---

## 3. Stage 2 — KineticAdapter (Transit)

**File:** `src/core/aether/adapters/KineticAdapter.ts` · Line 289

```typescript
this._valuesDict['tilt_offset'] = clamp(intent.y, −1, 1)
```

**Purely a pass-through.** No transformation. `tilt_offset` = `intent.y ∈ [−0.95, +0.15]`.

No `Math.abs()`, no modulo, no wrap. **Stage 2 is clean.**

---

## 4. Stage 3 — NodeArbiter Relative Offset Fusion

**File:** `src/core/aether/NodeArbiter.ts` · Lines 804–837

```
RELATIVE_OFFSET_SCALE_TILT = 0.5
amp = _relativeOffsetAmplitude            // default = 1.0
ampTilt = amp × 0.5 = 0.5

baseTilt = motorTilt_base ∥ manualTilt_base ∥ 0.5

tilt_final = clamp01(baseTilt + tilt_offset × ampTilt × distScale)
```

**Ceiling fixture, no explicit IK/radar anchor → `baseTilt = 0.5`:**

```
tilt_final = clamp01(0.5 + tilt_offset × 0.5)
```

**Ballyhoo at extremes:**
- `tilt_offset = −0.95` → `tilt_final = clamp01(0.5 + (−0.95 × 0.5)) = clamp01(0.5 − 0.475) = clamp01(0.025) = 0.025`
- `tilt_offset = +0.15` → `tilt_final = clamp01(0.5 + (0.15 × 0.5)) = clamp01(0.575) = 0.575`

**`tilt` at NodeArbiter output: `[0.025, 0.575]`** (normalized 0–1)

Converted to DMX scale for clarity:
- Floor-ward peak: `0.025 × 255 ≈ 6 DMX` (extreme down)
- Ceiling-ward peak: `0.575 × 255 ≈ 147 DMX` (just above center)

> **No anomaly at Stage 3.** The fusion is mathematically correct and linear. The only source of asymmetry is the intentional `tiltOffset` shift from Stage 1.

---

## 5. Stage 4 — NodeResolver Classic Path (THE SPLIT POINT)

**File:** `src/core/aether/resolver/NodeResolver.ts`

This is where the "split" occurs. The classic path contains **two independent tilt inversion mechanisms** that can both fire for ceiling-mounted fixtures:

### 5.1 Path selector (WAVE 4631)

```typescript
const hasSpatialTarget = channelValues[CH_TARGET_X] !== undefined
if (!kineticNode.isContinuous && hasSpatialTarget) {
  this._writeNodeIK(...)   // IK path — no classic inversion
  return
}
invertClassicKineticAxes = this._shouldInvertClassicKineticAxes(device.orientation, kineticNode)
```

When the fixture is **NOT using a spatial IK target** (fully automatic VMM mode), it takes the **classic path** and `_shouldInvertClassicKineticAxes` is evaluated.

### 5.2 `_shouldInvertClassicKineticAxes` — Source 1

**Lines 1275–1291**

```typescript
private _shouldInvertClassicKineticAxes(...): boolean {
  const orientation = deviceOrientation?.toLowerCase().trim()
  if (orientation?.includes('ceiling') || orientation?.startsWith('truss')) return true

  const installation = node.ikOrientation?.installation
  if (installation === 'ceiling' || installation === 'truss-front' || installation === 'truss-back') return true

  const pitch = node.ikOrientation?.rotation?.pitch
  return Number.isFinite(pitch) && Math.abs(Math.abs(pitch) − 180) < 0.001
}
```

**For a ceiling-mounted fixture**: `device.orientation === 'ceiling'` → **returns `true`**.

This means `invertClassicKineticAxes = true`.

### 5.3 The Classic Path inversion — Source 1 application

**Lines 1034–1043**

```typescript
// Step A: Transfer curve + DMX scale
let dmxValue = Math.round(normalized × 255)

// Step B: _applyCalibration (may include invertTilt from fixture profile)
if (calibration) {
  dmxValue = sanitizeDmxByte(this._applyCalibration(dmxValue, chDef.type, calibration))
}

// Step C: Orientation-based inversion (WAVE 4639)
if (invertClassicKineticAxes && chDef.type === TILT_COARSE) {
  dmxValue = sanitizeDmxByte(255 − dmxValue)
}
```

For the ceiling fixture, Step C fires: `dmxValue = 255 − dmxValue`.

**Effect of this single inversion:**
- Arbiter output `tilt_final = 0.025` → DMX ≈ 6 → **inverted: 249** (extreme up / ceiling-ward)
- Arbiter output `tilt_final = 0.575` → DMX ≈ 147 → **inverted: 108** (above center)

After inversion the range is: **`[108, 249] DMX`** — the fixture predominantly points **upward**.

### 5.4 `_applyCalibration` — Source 2

**Lines 1641–1657**

```typescript
if (TILT_CHANNELS.has(channelType)) {
  let v = dmxValue
  if (calibration.invertTilt) v = 255 − v    // ← SECOND POSSIBLE INVERSION
  // ...
}
```

`calibration.invertTilt` comes from `_buildCalibration()` in `NodeExtractionPipeline.ts`:

```typescript
const fromPhysics: IDeviceCalibration = {
  ...(p?.invertTilt !== undefined && { invertTilt: p.invertTilt }),
}
// v2Calibration (CalibrationLab) can override:
invertTilt: v2Calibration.tiltInvert ?? fromPhysics.invertTilt
```

**This flag is independent of `device.orientation`.** It is set from:
1. The fixture library physics profile (`invertTilt` field)
2. The CalibrationLab per-show override (`tiltInvert`)

**Critical question: can BOTH fire simultaneously?**

The execution order in the classic path is:
```
Step B: _applyCalibration → applies calibration.invertTilt if set
Step C: invertClassicKineticAxes → applies 255 − v if ceiling/truss
```

If `calibration.invertTilt = true` AND `installation = 'ceiling'`, then:
```
v₁ = dmxValue
v₂ = 255 − v₁           (calibration.invertTilt, Step B)
v₃ = 255 − v₂ = v₁      (invertClassicKineticAxes, Step C)
```

**A double inversion restores the original value, exactly as if neither inversion had occurred.** The fixture reverts to floor-fixture behavior with no physical inversion, pointing toward the ceiling when the wave goes positive and toward the floor when negative — which precisely matches the reported symptom.

---

## 6. The Mathematical Split — Root Cause Analysis

### 6.1 Why it appears "split" rather than "fully wrong"

The offset chain from Stage 1 creates a **strongly asymmetric wave**:

| Wave position | `tilt_offset` | After Arbiter (DMX) | After invertClassicKineticAxes | After calibration.invertTilt (if true) |
|---|---|---|---|---|
| Negative peak | −0.95 | ≈ 6 | ≈ 249 | ≈ 6 (double flip → original) |
| Center | 0.0 | ≈ 128 | ≈ 127 | ≈ 128 (symmetric center — no effect) |
| Positive peak | +0.15 | ≈ 147 | ≈ 108 | ≈ 147 (double flip → original) |

**Observation:** At the extremes, the double inversion restores the pre-inversion DMX value. But because the wave is heavily asymmetric (−0.95 to +0.15), the "floor" side of the wave produces DMX ≈ 6 (floor-ward), which the operator correctly perceives as "pointing at the audience" — so **the floor half looks right**. The "ceiling" side produces DMX ≈ 147 (slightly above center 128), which the operator perceives as "slightly sky-ward" — so **the ceiling half also looks partially right**. The fixture appears to be bouncing between audience level and just-above-center, which is not violently wrong, but IS the split behavior: neither half of the wave produces a full excursion in the correct direction.

### 6.2 The −130° extreme angle

The reported extreme value of −130° (or equivalent) is consistent with a fixture that:
1. Has a 270° tilt range (135° on each side of center)
2. Receives DMX ≈ 249 on one extreme → `(249/255 × 270) − 135 ≈ +128°` (pointing upward at the trusses)

This is the **negative-peak of the ballyhoo wave** (`rawY ≈ −1.0`, the "floor-ward" movement) which after the double inversion emerges as **extreme upward** physical movement. The architect's description is exact: the floor-movement intent from the software arrives as ceiling-movement in hardware.

### 6.3 The "split" geometry

```
Software intent:    [−0.95 ←————|————→ +0.15]   (floor ... ceiling)
                                 ↑ center=0

After NodeArbiter:  [0.025 ←———|———→ 0.575]     DMX [6 ... 147]
                                ↑ center=128

After 1× inversion: [249 ←—————|———→ 108]       Flipped: mostly upward
After 2× inversions:[6   ←—————|———→ 147]       Restored: floor-biased but WRONG
                                                  (the negative half points to FLOOR
                                                   instead of the inverted "up")
```

A fixture hanging from the ceiling, when the software says "look down" (negative `y`), should physically point toward the floor, which for a ceiling-mounted fixture means a **large DMX value** (close to 255). But with the double inversion restored to the un-inverted value, DMX ≈ 6 is produced instead — pointing at the ceiling structure above the fixture itself.

---

## 7. Anomaly Inventory (checklist from directive)

| Test | Finding | Verdict |
|------|---------|---------|
| **`Math.abs()` on `y`** | Not found anywhere in the pipeline | ✅ Clean |
| **Modulo / wraparound** | `(phase % TWO_PI)` on scheduler — not applied to `y` | ✅ Clean |
| **Double inversion** | `calibration.invertTilt` (Step B) **AND** `invertClassicKineticAxes` (Step C) can both fire for ceiling fixtures | ❌ **THE BUG** |
| **Offset pushing out of [0,1]** | `tilt_offset = −0.95` + `baseTilt=0.5` → `tilt_final = 0.025` — stays in [0,1], no wrap | ✅ Clean |
| **`TILT_CEILING` clamp causing fold** | Caps `+y` at 0.15 normalized, correct asymmetry but no fold | ✅ Intentional |
| **Ceiling inversion applied to wrong path** | Classic path (`!hasSpatialTarget`) inversely correlates with IK path — ceiling flag applied to VMM automatic mode | ⚠️ Architectural concern |

---

## 8. Where the Math Breaks — Exact File and Line

```
NodeResolver.ts

Line 1036: dmxValue = _applyCalibration(dmxValue, 'tilt', calibration)
           └─► if (calibration.invertTilt) dmxValue = 255 − dmxValue   ← Inversion #1

Line 1041: if (invertClassicKineticAxes && chDef.type === TILT_COARSE)
Line 1042:   dmxValue = 255 − dmxValue                                  ← Inversion #2

RESULT: 255 − (255 − v) = v   ← The axis appears to NOT be inverted.
         A ceiling fixture behaves as a floor fixture.
         "El suelo bien y el cielo bien" = both physical extremes map
          to the wrong orientation, but the asymmetric wave hides it
          from casual observation until full-excursion patterns run.
```

---

## 9. Preconditions for the Bug to Manifest

All three conditions must be simultaneously true:

1. **`device.orientation` contains `'ceiling'` or starts with `'truss'`** — OR `node.ikOrientation.installation` is `'ceiling'`/`'truss-front'`/`'truss-back'`  
   → `invertClassicKineticAxes = true` (Step C fires)

2. **`calibration.invertTilt = true`** in the fixture's physics profile (Forja) or CalibrationLab override  
   → `_applyCalibration` also inverts (Step B fires)

3. **Fixture is operating on the classic path** (no spatial IK target active — i.e., pure VMM automatic movement without a radar anchor)  
   → `_shouldInvertClassicKineticAxes` is called at all

When condition 3 is true but condition 2 is false (no `calibration.invertTilt`), the single inversion at Step C is correct and the fixture moves properly inverted as intended. The bug **only manifests when the fixture library or CalibrationLab also sets `invertTilt = true`**, creating the double-flip.

---

## 10. Supporting Evidence — The Ballyhoo Signature

The pattern `ballyhoo` is particularly good at exposing this bug because:

- `y = cos(φ) × r` with `r ∈ [0.50, 1.00]` guarantees **full-amplitude excursion on both sides** of the axis
- `cycleBeats = 16` means one full rotation every 8 bars — slow enough to observe the head pointing at the ceiling during the negative phase
- The `tiltOffset = −0.35` pushes the wave strongly toward the negative side, making the **negative-peak excursion the most visually dominant movement** of the pattern — exactly the half where the double-inversion causes the fixture to point at the roof

`figure8` and `wave_y` would also show this bug, but with smaller amplitudes or faster cycles that make it less obvious.

---

*End of Report · WAVE 4932 · Read-only audit — zero code modifications*
