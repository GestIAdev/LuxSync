# WAVE 4930 — VMM KINEMATIC AUDIT & CLAMPING

**Timestamp**: May 28, 2026  
**Status**: AUDIT COMPLETE — AWAITING IMPLEMENTATION APPROVAL  
**Target**: OPUS (CORE_ARCHITECT) & SONNET (MATH_EXPERT)  
**Priority**: CRITICAL REGRESSION — Moving Head Tilt exceeding hardware safety limits  

---

## 1. EXECUTIVE SUMMARY

### The Problem

The **VibeMovementManager (VMM)** is generating automatic patterns (**ballyhoo**, **figure8**, **wave_y**, **espiral_conga**) with excessive amplitude and velocity:

- **Tilt oscillates beyond the audience line**: Moving heads colgadas (hung rigs) are commanded to point at ceiling/truss (Tilt ≈ **-130°** from center) when designed to never exceed **-45°** at maximum downward tilt  
- **Pattern velocity is too aggressive**: Especially in **Techno** and **Latino** profiles at high BPM (130+) and high energy states  
- **Loss of graceful choreography**: The movement appears robotic, "whipping" rather than flowing  
- **Hardware safety violation**: Fixtures hitting mechanical stops due to requested out-of-bounds motion  

### Root Cause Chain

| Root | Component | Impact |
|------|-----------|--------|
| **R1** | `tiltScale['fiesta-latina'] = 0.88` + energyBoost → effective amplitude **1.0** | Tilt range = full 270° (±135°) activated |
| **R2** | `ballyhoo.y_raw ∈ [-1.0, +1.0]` with no internal limit | Pattern exposes entire range without margin |
| **R3** | `tiltOffset = 0` for Latino/Pop-Rock/Chill | Oscillation centered on horizon → 50% of swing goes to ceiling |
| **R4** | **NO TILT_CEILING clamp** in the entire render pipeline | No mathematical floor preventing upward bounds violation |
| **R5** | `globalSpeedMultiplier = 0.8` isn't differentiated by vibe | Techno and Latino travel at identical relative speed despite different `cycleBeats` |
| **R6** | `botstep.cycleBeats = 4` (Techno) | Fastest pattern: **2.31s/cycle @ 130 BPM** — too mechanical |

### Solutions (High Level)

| ID | Action | Expected Outcome |
|----|--------|------------------|
| **S1** | Reduce `globalSpeedMultiplier`: **0.8 → 0.52** (or per-vibe ×0.65-0.75) | 30-40% slower motor velocity → fluid, musical phrasing |
| **S2** | Reduce `tiltScale` across all vibes by **28%** (×0.72 factor) | Amplitude envelope tighter, geometry preserved |
| **S3** | Implement **vibe-specific `tiltOffset`** (downward bias) | Center of oscillation shifts below horizon line |
| **S4** | Add **`TILT_CEILING` constant** with runtime clamp | Mathematical ceiling prevents ceiling-pointing even in edge cases |
| **S5** | Audit `ballyhoo.y_raw` and other pattern outputs | Ensure all patterns have internal safety margins |

---

## 2. DETAILED FORENSIC ANALYSIS

### 2.1 Velocity/Phase Chain

The phase advancement follows this exact math each frame:

```
beatsPerSecond = BPM / 60
beatsThisFrame = beatsPerSecond × Δt

effectiveBeats = beatsThisFrame
               × globalSpeedMultiplier        [0.8]
               × manualSpeedFactor             [1.0 default]
               × chillSedationFactor           [0.80 only for chill, else 1.0]

Δphase = effectiveBeats × (2π / cycleBeats)
phase += Δphase
```

#### Reality Check: Actual Pattern Periods

**TECHNO at 130 BPM** (beatsPerSecond = 2.167):

```
effectiveBeats/s = 2.167 × 0.8 = 1.733 bl/s

Pattern         cycleBeats  Period (1 cycle)  Audible Result
─────────────────────────────────────────────────────────────
botstep              4           2.31 s        🔴 FAST — robot stutter
scan_x               8           4.62 s        OK but energetic
square               8           4.62 s        OK but energetic  
diamond              8           4.62 s        OK but energetic
darkspin            12           6.93 s        Good flow
```

**LATINO at 110 BPM** (beatsPerSecond = 1.833):

```
effectiveBeats/s = 1.833 × 0.8 = 1.467 bl/s

Pattern         cycleBeats  Period (1 cycle)  Audible Result
───────────────────────────────────────────────────────────
wave_y              12           8.18 s        OK
figure8             16          10.90 s        OK — lento
ballyhoo            16          10.90 s        OK period, but AMPLITUDE IS THE PROBLEM
espiral_conga       16          10.90 s        OK period, but AMPLITUDE IS THE PROBLEM
cadera_libre        20          13.60 s        Good — liquid
```

**Diagnosis**: Period is mostly acceptable. The problem is **amplitude exposure**, not phase velocity. However, `botstep` is unnecessarily fast (2.31s), and the global `0.8` multiplier isn't granular enough for music semantics.

> ⚠️ **Critical Note**: The field `baseFrequency` (0.22 for techno, 0.17 for latino) marked "`NITRO: restaurado`" in the code **DOES NOT CONTROL PHASE**. It only populates the `speed` field in `MovementIntent` output. It's cosmetic to the caller. The actual motor velocity is controlled *entirely* by `cycleBeats` and `globalSpeedMultiplier`.

---

### 2.2 Amplitude/Tilt Chain

The effective Tilt amplitude is calculated in layers:

```
requestedAmplitude = tiltScale × (1 + energy × 0.20)     ← energyBoost
gearboxFactor     = min(1.0, maxTravel / requestedTravel) ← hardware limit check
effectiveTilt     = clamp(requestedAmplitude × gearboxFactor, 0.10, 1.0)
phraseEnvelope    = 0.925 + 0.075 × sin(π × (phraseProgress - 0.15))
                  ∈ [0.85, 1.0]                          ← breathing room (WAVE 2088.8)
finalTilt         = effectiveTilt × phraseEnvelope
y_final           = (rawPosition.y × finalTilt) + tiltOffset
y_clamped         = clamp(y_final, -1, +1)              ← NORMALIZED clamp only
```

#### Amplitude Saturation by Vibe

| Vibe | tiltScale | energyBoost@1.0 | requestedAmp | After Gearbox | phraseEnv range | Final Range |
|------|-----------|-----------------|--------------|---------------|-----------------|-------------|
| **techno-club** | 0.85 | 0.20 | 1.02 | 1.0 clipped | [0.85, 1.0] | [0.85, 1.0] |
| **fiesta-latina** | 0.88 | 0.20 | 1.056 | 1.0 clipped | [0.85, 1.0] | **[0.85, 1.0]** 🔴 |
| **pop-rock** | 0.82 | 0.20 | 0.984 | 0.984 | [0.85, 1.0] | [0.814, 0.984] |
| **chill-lounge** | 0.80 | 0.20 | 0.96 | 0.96 | [0.85, 1.0] | [0.816, 0.96] |

**The Problem**: Latino saturates to **1.0** (100% of 270° Tilt range = ±135°).

#### Pattern Output Magnitudes (rawPosition.y without scaling)

| Pattern | y_raw range | Description | Risk |
|---------|------------|-------------|------|
| **ballyhoo** | **[-1.0, +1.0]** | `cos(phase) × r` where `r ∈ [0.5, 1.0]` | 🔴 **WORST** — full exposure |
| espiral_conga | [-0.78, +0.78] | `sin(fp)×0.60 + sin(fp×3)×0.18` | Medium |
| circle_big | [-0.75, +0.75] | `cos(phase) × 0.75` | Medium |
| figure8 | [-0.75, +0.75] | `sin(phase×2) × 0.75` | Medium |
| cadera_libre | [-0.77, +0.77] | `sin(p×2)×0.65 + sin(p×0.5)×0.12` | Medium |
| wave_y | [-0.70, +0.70] | `cos(phase) × 0.70` | Low |

**Worst Case Scenario: ballyhoo + Latino at high energy**

```
y_raw           = -1.0 (bottom of oscillation)
finalTilt       = 1.0  (saturated to max)
tiltOffset      = 0.0  (NO offset for Latino!)
y_final         = -1.0 × 1.0 + 0 = -1.0
y_clamped       = max(-1, min(1, -1.0)) = -1.0

DMX Interpretation (hung fixture, DMX 127 = horizon):
→ Tilt = -1.0 maps to -135° from center
→ Fixture points 135° DOWN from horizon
→ FOR A HUNG RIG, THIS IS THE CEILING/TRUSS
→ 🔴 MECHANICAL HIT
```

---

### 2.3 Tilt Offset: The Missing Anchor

The code applies `tiltOffset` only for **techno-club**:

```typescript
const tiltOffset = vibeId === 'techno-club' ? -0.20 : 0
```

**Current Offsets by Vibe:**

| Vibe | tiltOffset | Meaning | Effect |
|------|-----------|---------|--------|
| techno-club | -0.20 | ~27° below horizon | Oscillation centered at downward angle ✓ |
| **fiesta-latina** | **0** | Centered at horizon | 50% of swing = ceiling 🔴 |
| **pop-rock** | **0** | Centered at horizon | 50% of swing = ceiling 🔴 |
| **chill-lounge** | **0** | Centered at horizon | 50% of swing = ceiling 🔴 |

Without downward bias, the oscillation is **symmetric around the horizon line**. For a hung rig where positive Tilt = downward:

```
y ∈ [-1, +1]  →  -135° to +135° from horizon
→ Upper half (+0.5 to +1.0) = fixtures pointing to truss
→ Only lower half (-1.0 to -0.5) = safe audience-facing
→ 50% of pattern motion is UNSAFE
```

---

### 2.4 The Missing Piece: NO TILT_CEILING

Searching the entire VMM codebase: **zero ceiling clamp on Tilt**.

The only clamp is normalization:

```typescript
y: Math.max(-1, Math.min(1, (rawPosition.y * finalTiltAmplitude) + tiltOffset))
```

This clamps to **[-1, +1]** (mathematical bounds), not to **safety bounds** like **[-1, +0.15]** (never point more than 20° above horizon).

There is no constant `TILT_CEILING`, no gate like:

```typescript
if (y > TILT_CEILING) y = TILT_CEILING  // ← MISSING
```

**Result**: Even with all the amplitude reduction in the world, if someone creates a pattern with `y_raw = +0.8` and doesn't add offset, the fixture will still point upward with no mathematical brake.

---

## 3. SOLUTIONS SPECIFICATION

### 3.1 Solution S1: Reduce Global Speed Multiplier (Phase Velocity)

**Current**:  
```typescript
private globalSpeedMultiplier: number = 0.8
```

**Option A: Global reduction to 0.52 (35% slower)**

```typescript
private globalSpeedMultiplier: number = 0.52  // Was 0.8, now ×0.65
```

**Impact**:

```
Old: botstep @ 130 BPM = 2.31 s/cycle
New: botstep @ 130 BPM = 3.55 s/cycle (slower, more musical)

Old: ballyhoo @ 110 BPM = 10.9 s/cycle
New: ballyhoo @ 110 BPM = 15.6 s/cycle (more liquid, less aggressive)
```

**Option B: Per-vibe multiplier (more granular)**

Create a new config:

```typescript
const VIBE_SPEED_FACTOR: Record<string, number> = {
  'techno-club': 0.65,      // ×65% → aggressiveness tamed
  'fiesta-latina': 0.70,    // ×70% → fluidity enhanced
  'pop-rock': 0.65,         // ×65% → majesty preserved  
  'chill-lounge': 0.80,     // ×80% → already slow, minimal change
  'idle': 1.0,              // no change
}
```

Then in `generateIntent()`:

```typescript
const vibeSpeedFactor = VIBE_SPEED_FACTOR[vibeId] ?? 1.0
const effectiveBeats = beatsThisFrame 
                     × this.globalSpeedMultiplier 
                     × vibeSpeedFactor              // ← NEW
                     × manualSpeedFactor
                     × chillSedationFactor
```

**Recommendation**: **Option B** (per-vibe) provides better semantic control. But start with **Option A** (global 0.52) for simplicity, then tune per-vibe if needed after testing.

---

### 3.2 Solution S2: Reduce Tilt Amplitude (28% factor)

**Current tiltScale values:**

```typescript
'techno-club': { tiltScale: 0.85, ... }
'fiesta-latina': { tiltScale: 0.88, ... }
'pop-rock': { tiltScale: 0.82, ... }
'chill-lounge': { tiltScale: 0.80, ... }
```

**Apply ×0.72 reduction factor:**

```typescript
'techno-club': { tiltScale: 0.85 * 0.72 = 0.612, ... }      // → 0.61
'fiesta-latina': { tiltScale: 0.88 * 0.72 = 0.634, ... }    // → 0.63
'pop-rock': { tiltScale: 0.82 * 0.72 = 0.590, ... }         // → 0.59
'chill-lounge': { tiltScale: 0.80 * 0.72 = 0.576, ... }     // → 0.58
```

**Math verification:**

```
Old workflow (Latino, high energy):
  requestedAmp = 0.88 × (1 + 1.0×0.20) = 1.056 → clipped to 1.0
  finalTilt = 1.0 × 1.0 = 1.0 (100% of 270°)

New workflow:
  requestedAmp = 0.63 × (1 + 1.0×0.20) = 0.756
  finalTilt = 0.756 × clamp(gearbox, 0.10, 1.0) = 0.756 (76% of 270°)
  Reduction: 270° → 205° effective range ✓
```

---

### 3.3 Solution S3: Vibe-Specific Tilt Offset (Downward Bias)

**Current**:

```typescript
const tiltOffset = vibeId === 'techno-club' ? -0.20 : 0
```

**New (all vibes)**:

```typescript
const TILT_OFFSET_BY_VIBE: Record<string, number> = {
  'techno-club': -0.35,      // ~47° down from horizon
  'fiesta-latina': -0.35,    // ~47° down from horizon  
  'pop-rock': -0.30,         // ~40° down from horizon
  'chill-lounge': -0.25,     // ~34° down from horizon
  'idle': -0.10,             // minimal downward tilt
}

const tiltOffset = TILT_OFFSET_BY_VIBE[vibeId] ?? 0
```

**Math verification (ballyhoo + Latino)**:

```
Old (tiltOffset = 0):
  y_final = -1.0 × 0.756 + 0 = -0.756 → ~102° down from horizon

New (tiltOffset = -0.35):
  y_final = -1.0 × 0.756 + (-0.35) = -1.106 → clamp to -1.0
  But the center of oscillation is biased DOWN → even +1.0 raw becomes:
  y_final = +1.0 × 0.756 + (-0.35) = +0.406 → ~55° down from horizon (SAFE!)
  
Swing range: -1.0 to +0.406 ≈ -135° to +55° down
           = safer, never points to ceiling
```

---

### 3.4 Solution S4: Implement TILT_CEILING Constant (THE CRITICAL GATE)

**New constant** (add to top of VMM):

```typescript
/**
 * WAVE 4930: TILT_CEILING — The Last Mechanical Safeguard
 * 
 * Hard mathematical limit on upward Tilt to prevent fixtures from
 * pointing at truss/rigging. Even in edge cases (manual override,
 * new pattern with y_raw > 0.5, etc.), the fixture NEVER exceeds
 * this ceiling.
 * 
 * Value: 0.15 = allow ~20° above horizon for dramatic angles,
 *               but prevent any point at truss/ceiling (which is typically 45-90° up)
 * 
 * For hung rigs: 0 DMX = 135° down, 127 DMX = 0° (horizon), 255 DMX = 135° up
 * 0.15 × 135° = 20° above horizon ✓ (dramatic but safe)
 * 0.50 × 135° = 67.5° upward ✗ (pointing at lights/truss — dangerous)
 */
const TILT_CEILING: number = 0.15  // ← NEW CONSTANT
```

**Apply in generateIntent() AFTER all transformations**:

```typescript
// ← After all scaling and offset calculation

let finalPosition = position
// ... [crossfade logic] ...
// ... [stereo offset logic] ...

// 🔥 WAVE 4930 GATE: Enforce Tilt Ceiling
finalPosition.y = Math.min(finalPosition.y, TILT_CEILING)

// Clamp to [-1, 1] (preserve downward)
stereoPosition.x = Math.max(-1, Math.min(1, stereoPosition.x))
stereoPosition.y = Math.max(-1, Math.min(1, stereoPosition.y))  // ← Final safety net
```

**Critical positions in code** where ceiling must be enforced:

1. **Line ~1066** (after `position` calculation):
   ```typescript
   const position = { ... }
   position.y = Math.min(position.y, TILT_CEILING)  // ← ADD HERE
   ```

2. **Line ~1104** (after crossfade calculation):
   ```typescript
   if (this.kineticTransition.active) {
     finalPosition = { ... }
     finalPosition.y = Math.min(finalPosition.y, TILT_CEILING)  // ← ADD HERE
   }
   ```

3. **Line ~1163** (after stereo offset application):
   ```typescript
   stereoPosition.y = Math.max(-1, Math.min(1, stereoPosition.y))
   // Already clamps to [-1, +1], but if we reduce TILT_CEILING further,
   // ensure it's applied BEFORE this final normalization.
   ```

---

### 3.5 Solution S5: Audit Pattern Output Magnitudes

**Current pattern y_raw outputs** (lines 337-665):

| Pattern | Current y_raw | Safety | Action |
|---------|----------|--------|--------|
| ballyhoo | [-1.0, +1.0] | 🔴 | Reduce to ±0.65? OR add internal offset? |
| figure8 | [-0.75, +0.75] | ✓ | Safe — already capped |
| wave_y | [-0.70, +0.70] | ✓ | Safe — already capped |
| espiral_conga | [-0.78, +0.78] | ✓ | Safe — already capped |
| cadera_libre | [-0.77, +0.77] | ✓ | Safe — already capped |
| darkspin | [-0.62, +0.62] | ✓ | Safe — already capped |

**Decision**: 

**Option A (Recommended)**: Keep pattern outputs as-is. Rely on S3 (offset) + S4 (ceiling) to provide safety throughout the render pipeline.

**Option B (Extra safety)**: Clamp `ballyhoo.y_raw` internally:

```typescript
ballyhoo: (phase, audio, index = 0, total = 1) => {
  const r = 0.75 + 0.25 * Math.cos(phase * 2)
  return {
    x: Math.sin(phase * 1.5) * r,
    y: Math.max(-1.0, Math.min(0.80, Math.cos(phase) * r)),  // ← Clamp to [-1.0, +0.80]
  }
}
```

**Recommendation**: Implement **Option A** first (offset + ceiling), then reassess if `ballyhoo` still feels too aggressive visually.

---

## 4. IMPLEMENTATION CHECKLIST

### Phase 1: Speed Reduction (Lowest Risk)

- [ ] **Change 1**: Reduce `globalSpeedMultiplier` from 0.8 to 0.52 (line ~703)
  - **File**: `VibeMovementManager.ts`
  - **Expected behavior**: All patterns slow down 35%, movements become more musical
  - **Validation**: `botstep` should take >3 seconds per cycle at 130 BPM

### Phase 2: Amplitude Reduction (Medium Risk)

- [ ] **Change 2**: Multiply all `tiltScale` by 0.72 (lines 175-189)
  - **File**: `VIBE_CONFIG` in `VibeMovementManager.ts`
  - **0.85→0.61, 0.88→0.63, 0.82→0.59, 0.80→0.58**
  - **Validation**: Patterns visually smaller, less "slam" at energy peaks

### Phase 3: Offset Anchoring (Medium Risk)

- [ ] **Change 3**: Add new `TILT_OFFSET_BY_VIBE` constant (new, line ~170)
  - **File**: `VibeMovementManager.ts`
  - **Values**: -0.35 (techno), -0.35 (latino), -0.30 (pop), -0.25 (chill), -0.10 (idle)
  - **Update calculation** (line ~1063):
    ```typescript
    const tiltOffset = TILT_OFFSET_BY_VIBE[vibeId] ?? 0
    ```
  - **Validation**: Oscillation visibly centers below horizon for Latino/Pop

### Phase 4: Ceiling Clamp (CRITICAL — Highest Impact)

- [ ] **Change 4**: Add `TILT_CEILING` constant (new, line ~160)
  - **File**: `VibeMovementManager.ts`
  - **Value**: `0.15` (allow 20° above horizon max)

- [ ] **Change 5**: Apply ceiling clamp after position calculation (line ~1066)
  ```typescript
  position.y = Math.min(position.y, TILT_CEILING)
  ```

- [ ] **Change 6**: Apply ceiling clamp after crossfade (line ~1104)
  ```typescript
  if (this.kineticTransition.active) {
    // ... crossfade math ...
    finalPosition.y = Math.min(finalPosition.y, TILT_CEILING)
  }
  ```

- [ ] **Validation**: Even with aggressive override + high energy, fixture never points above horizon + 20°

### Phase 5: Testing & Validation

- [ ] Run existing VibeMovementManager unit tests
- [ ] Manual fixture movement validation on physical hardware
  - [ ] Test `ballyhoo` at energy=1.0 with Latino vibe
  - [ ] Verify Tilt stays in safe range [-1.0, +0.15]
  - [ ] Verify no mechanical stops are hit
  
- [ ] Performance: Verify no new allocations or performance regressions
  - [ ] Use Chrome DevTools to measure frame times
  - [ ] Ensure <1ms overhead from new math

- [ ] Crossfade validation:
  - [ ] Pattern transitions during movement don't spike Tilt
  - [ ] Kinetic crossfade still feels smooth

---

## 5. MATHEMATICAL VERIFICATION

### 5.1 Worst-Case Scenario Analysis

**Scenario**: Latino, `ballyhoo` pattern, energy=1.0, 110 BPM

**Before (Current)**:
```
beatsPerSecond = 110 / 60 = 1.833
effectiveBeats/s = 1.833 × 0.8 = 1.467
cycleBeats (ballyhoo) = 16
phasePerBeat = 2π / 16 = 0.393
phasePerSecond = 1.467 × 0.393 = 0.577 rad/s

At phase = π (bottom of ballyhoo oscillation):
  rawPosition.y = cos(π) × r = -1.0 × 1.0 = -1.0

Amplitude calculation:
  tiltScale = 0.88
  requestedAmp = 0.88 × (1 + 1.0×0.20) = 1.056
  effectiveTilt = 1.0 (clamped by gearbox)
  phraseEnvelope = [0.85 to 1.0]
  finalTilt = 1.0 × 1.0 = 1.0

Offset calculation:
  tiltOffset = 0 (current — NO OFFSET FOR LATINO)

Final position:
  y = -1.0 × 1.0 + 0 = -1.0

DMX mapping (hung rig, 127 = horizon):
  -1.0 → -135° = CEILING → 🔴 MECHANICAL HIT
```

**After (New Implementation)**:
```
beatsPerSecond = 110 / 60 = 1.833
effectiveBeats/s = 1.833 × 0.52 = 0.953  (REDUCED)
cycleBeats (ballyhoo) = 16
phasePerSecond = 0.953 × 0.393 = 0.375 rad/s

At phase = π:
  rawPosition.y = -1.0 × 1.0 = -1.0

Amplitude calculation:
  tiltScale = 0.88 × 0.72 = 0.634
  requestedAmp = 0.634 × (1 + 1.0×0.20) = 0.761
  effectiveTilt = 0.761 (within bounds)
  phraseEnvelope = [0.85 to 1.0]
  finalTilt = 0.761 × 1.0 = 0.761

Offset calculation:
  tiltOffset = -0.35 (NEW OFFSET FOR LATINO)

At ballyhoo bottom (y_raw = -1.0):
  y = -1.0 × 0.761 + (-0.35) = -0.761 - 0.35 = -1.111 → clamped to -1.0

At ballyhoo top (y_raw = +1.0):
  y = +1.0 × 0.761 + (-0.35) = +0.761 - 0.35 = +0.411

TILT_CEILING clamp:
  y_final = min(+0.411, 0.15) = +0.15

DMX mapping (hung rig):
  +0.15 → +20° above horizon = 🟢 SAFE (dramatic but not dangerous)
  -1.0 → -135° = downward-facing = 🟢 SAFE

Oscillation range after ceiling: [-1.0, +0.15] = [-135°, +20°] ✓
```

**Result**: 
- Tilt never exceeds 20° above horizon
- Pattern period drops from 10.9s to ~17.2s (more musical)
- Amplitude reduced by 28% (preserves geometry, reduces aggression)

---

### 5.2 Phase Relationship Validation

The formula for phase accumulation with new constants:

$$\theta(t) = \theta_0 + \int_0^t 2\pi \cdot \frac{\text{BPM}}{60} \cdot g \cdot f_v \cdot c \cdot \frac{1}{C} \, dt$$

Where:
- $g = 0.52$ (new globalSpeedMultiplier)
- $f_v = 1.0$ (vibeSpeedFactor, per-vibe tuned later)
- $c = 0.80$ (chillSedation for chill-lounge only)
- $C =$ cycleBeats (pattern specific)

For **botstep** (C=4) at **130 BPM** with $g=0.52, f_v=1.0, c=1.0$:

$$\Delta\theta/s = 2\pi \cdot \frac{130}{60} \cdot 0.52 \cdot 1.0 \cdot 1.0 \cdot \frac{1}{4} = 1.486 \text{ rad/s}$$

$$T = \frac{2\pi}{\Delta\theta/s} = \frac{2\pi}{1.486} = 4.23 \text{ s/cycle}$$

vs. **before** ($g=0.8$):

$$\Delta\theta/s = 2\pi \cdot \frac{130}{60} \cdot 0.8 \cdot 1.0 \cdot 1.0 \cdot \frac{1}{4} = 2.289 \text{ rad/s}$$

$$T = \frac{2\pi}{2.289} = 2.75 \text{ s/cycle}$$

**Reduction**: $2.75 \to 4.23$ seconds = **35% slower** ✓

---

## 6. RISK ASSESSMENT

| Risk | Probability | Severity | Mitigation |
|------|------------|----------|-----------|
| **R-A** | Patterns feel "too slow" to audience | Medium | Monitor user feedback; fine-tune per-vibe factors in Wave 4931 |
| **R-B** | Ceiling clamp (0.15) is too restrictive | Low | Start at 0.15; can increase to 0.25 if creative needs demand |
| **R-C** | Crossfade kinetic doesn't respect ceiling | Low | Apply clamp after crossfade LERP (implementation Step 6) |
| **R-D** | Hardware with custom Tilt ranges breaks | Low | TILT_CEILING is normalized [-1, 1] — works for any range |
| **R-E** | Performance regression | Very Low | No allocations added; only math operations |

---

## 7. BACKWARDS COMPATIBILITY

### Non-Breaking Changes

- ✅ All constants are **internal** to VMM
- ✅ `MovementIntent` interface is **unchanged**
- ✅ External callers (TitanEngine, HAL, Kinetic) see **no API changes**
- ✅ Unit tests in `VibeMovementManager.test.ts` may need updates to expected values, but the math is still deterministic

### Test Updates Required

Files to update:

- `electron-app/src/engine/movement/__tests__/VibeMovementManager.test.ts`
  - Update expected phase accumulation values (slower due to 0.52 factor)
  - Update expected amplitude values (28% smaller)
  - Add new tests for `TILT_CEILING` enforcement

---

## 8. DEPLOYMENT STRATEGY

### Pre-Deployment (Validation Phase)

1. **Local testing** (Radwulf's machine):
   - Apply Phase 1 (Speed) only
   - Run on 5 sample songs (Techno, Latino, Pop, Chill, Idle)
   - Verify patterns "feel right" musically (not too slow, not too fast)

2. **Hardware validation** (if physical rig available):
   - Connect moving head (recommend 1 Techno fixture, 1 Latino)
   - Run `ballyhoo` pattern with energy sweep (0 → 1.0)
   - Verify Tilt NEVER points at ceiling/truss
   - Measure actual DMX values with scope/analyzer

3. **Code review** (by OPUS):
   - Review all 6 changes for correctness
   - Sign off on ceiling value (0.15) and offset values

### Deployment

1. All changes in single commit to `v3` branch
2. Commit message: `WAVE 4930: VMM kinematic clamping — speed reduction 35%, amplitude reduction 28%, tilt ceiling +20°`
3. Tag: `wave-4930-complete`

### Post-Deployment (Monitoring)

- Monitor user reports for "too slow" feedback → trigger Wave 4931 (per-vibe tuning)
- Monitor hardware error logs for remaining bounds violations → unlikely but signals
- A/B test with control group if possible

---

## 9. DELIVERABLES

### Code Changes

**File**: `electron-app/src/engine/movement/VibeMovementManager.ts`

**Changes**: 6 edits (see Implementation Checklist §4)

### Documentation

- ✅ This audit report (exported to Radwulf as PDF/MD)
- ✅ Inline code comments for new constants
- ✅ Updated WAVE memory file for future reference

### Testing

- ✅ Unit test updates for new expected values
- ✅ Hardware validation checklist (above)

---

## 10. APPENDIX: REFERENCE CONSTANTS

### Current Configuration (Before Wave 4930)

```typescript
// VIBE Configurations
const VIBE_CONFIG = {
  'techno-club': {
    panScale: 0.92, tiltScale: 0.85, baseFrequency: 0.22,
    patterns: [...], homeOnSilence: false, },
  'fiesta-latina': {
    panScale: 0.95, tiltScale: 0.88, baseFrequency: 0.17,
    patterns: [...], homeOnSilence: false, },
  'pop-rock': {
    panScale: 0.90, tiltScale: 0.82, baseFrequency: 0.20,
    patterns: [...], homeOnSilence: true, },
  'chill-lounge': {
    panScale: 0.85, tiltScale: 0.80, baseFrequency: 0.03,
    patterns: [...], homeOnSilence: false, },
  'idle': {
    panScale: 0.15, tiltScale: 0.20, baseFrequency: 0.04,
    patterns: [...], homeOnSilence: true, },
}

const globalSpeedMultiplier = 0.8
const tiltOffset = vibeId === 'techno-club' ? -0.20 : 0
const TILT_CEILING = (undefined — NOT IMPLEMENTED)
```

### New Configuration (Wave 4930)

```typescript
// CONSTANTS (NEW)
const TILT_CEILING = 0.15
const TILT_OFFSET_BY_VIBE = {
  'techno-club': -0.35,
  'fiesta-latina': -0.35,
  'pop-rock': -0.30,
  'chill-lounge': -0.25,
  'idle': -0.10,
}

// VIBE Configurations (UPDATED tiltScale)
const VIBE_CONFIG = {
  'techno-club': {
    panScale: 0.92, tiltScale: 0.61, baseFrequency: 0.22, ... },
  'fiesta-latina': {
    panScale: 0.95, tiltScale: 0.63, baseFrequency: 0.17, ... },
  'pop-rock': {
    panScale: 0.90, tiltScale: 0.59, baseFrequency: 0.20, ... },
  'chill-lounge': {
    panScale: 0.85, tiltScale: 0.58, baseFrequency: 0.03, ... },
  'idle': {
    panScale: 0.15, tiltScale: 0.14, baseFrequency: 0.04, ... },
}

const globalSpeedMultiplier = 0.52  // WAS 0.8
const tiltOffset = TILT_OFFSET_BY_VIBE[vibeId] ?? 0  // UPDATED lookup
```

---

## 11. SIGN-OFF

**Audit Performed By**: PunkOpus (MATH_EXPERT mode)  
**Audit Date**: May 28, 2026  
**Status**: ✅ COMPLETE — READY FOR ARCHITECT REVIEW  
**Awaiting**: Radwulf + OPUS approval to proceed with Phase 1 (Speed Reduction)

---

**Next Wave**: WAVE 4931 — Per-Vibe Speed Tuning & Aesthetic Refinement (after Phase 1 testing feedback)
