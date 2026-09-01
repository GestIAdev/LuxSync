# WAVE 7749 — THE HOLY GRAIL: SNARE ISOLATION & VOCAL BLEED SUPPRESSION

## 0. Executive Summary

The problem: `hybridSnare` fires on vocal consonants ("T", "P", "K"), synth stabs, and bass pops because the current detector relies on frequency-band deltas (`highMidDelta + trebleDelta`) and a crude centroid shield. The Architect demands a **multi-dimensional strict veto** using physical properties (noise vs. tonality) rather than frequency alone.

**Three-layer defense proposed:**
1. **Tonality Veto** — flatness + whiteNoiseScore gate before `hybridSnare` is finalized
2. **Flux/Sustain Choke** — spectralFlux-based envelope choke that kills sustained vocal tails
3. **Monte Carlo Calibration** — offline telemetry pipeline to find the exact hyperplane thresholds

---

## 1. Audit: Current `hybridSnare` Logic

### 1.1 The Two Detectors

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\physics\LiquidEngineBase.ts" lines="554-616" />

**Detector A — Legacy Transient Shaper (time-domain):**
```
rawSnare  = max(0, highMid × tonalSquelch − lowMid × 1.5)
rawHat    = treble × tonalSquelch
rawSpike  = highMidDelta + trebleDelta
snareSpectrum = mid × (treble × 0.5 + harshness)
rawSnareCalc  = (rawSpike × snareSpectrum × 10.0) > 0.19
isSnareImpact = rawSnareCalc && (now − lastSnareTime > 45ms)
percRaw  = snareHoldCounter > 0 ? 1.0 : 0.0   (4-frame hold ~90ms)
```

**Detector B — WAVE 8008 ADAPTER (`snare_energy` from GodEarFFT V3):**
```
snareDelta  = snare_energy − prevSnareEnergy
snareOnset  = snareDelta > 0.01 && snare_energy > 0.06 && (now − lastSnareOnset > 80ms)
snareImpulse *= 0.04   (fast decay ~90ms)
hybridSnare = max(percRaw, snareImpulse)
```

**Then the Morphologic Centroid Shield (WAVE 2449):**
```
if (isKick) {
  centroidFloor = 900 × (1 − morphFactor)
  if (spectralCentroid < centroidFloor && harshness < 0.024) hybridSnare = 0
}
```

### 1.2 Why Vocal Bleed Happens

| Bleed Source | Mechanism | Why Current Shield Fails |
|---|---|---|
| **Vocal consonants** ("T", "P", "K") | Burst of high-mid + treble energy → `rawSpike` spikes → `rawSnareCalc` triggers | Consonants are broadband transients — they look like snares in frequency. The centroid shield only fires during kicks (`isKick`), not during vocal passages. |
| **Synth stabs** (sawtooth leads) | Harmonic-rich content in `highMid` → `highMidDelta` spikes | Synths are tonal (low flatness), but the transient shaper doesn't check flatness. `tonalSquelch` helps but is binary (0.30 or 1.0), not a hard veto. |
| **Bass pops** (slap bass, 808 glides) | `lowMid` subtraction (`− lowMid × 1.5`) helps, but aggressive bass can still push `highMid` | The centroid shield catches this during kicks, but not during bass-only passages. |
| **Vocal sustain tails** | After a consonant burst, the `envSnare` envelope decays slowly (e.g. `decayBase 0.72` for Latino) | The envelope's release tail rings out over the vocal sustain, creating a "ghost snare" that flickers with the vocal. |

### 1.3 Available GodEarFFT V3 Metrics (Untapped for Snare Veto)

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\workers\GodEarFFT.ts" lines="128-147" />

```typescript
interface GodEarPhoton {
  spectralFlux: number       // half-wave rectified, whitened, normalized [0,~1]
  transientDensity: number   // onset rate proxy [0,1]
  whiteNoiseScore: number    // broadband noise ratio [0,1] — high flatness in HF
}
```

Plus from `LiquidStereoInput`:
- `flatness` (Wiener entropy, 0-1) — already extracted at line 221
- `spectralCentroid` (Hz) — already used in centroid shield
- `harshness` — already used in transient shaper

**Key insight:** `whiteNoiseScore` and `flatness` are the physical discriminators. A snare is **broadband noise** (high flatness, high whiteNoiseScore). A vocal is **tonal** (low flatness, low whiteNoiseScore). A synth stab is **harmonic** (low flatness, moderate whiteNoiseScore). The current code uses `flatness` only for `noiseMode` detection (line 240) and `tonalPenalty` on the kick channel (line 327) — **never for snare veto**.

---

## 2. Layer 1: The Tonality Veto

### 2.1 Physics Rationale

A snare hit is a **broadband impulse**: the drum head produces noise across 200Hz-15kHz, the snare wires add 3-10kHz broadband sizzle. In spectral terms:
- **Flatness** > 0.25 (noise-like, energy spread across bins)
- **whiteNoiseScore** > 0.30 (HF broadband content)
- **spectralFlux** spikes sharply (sudden spectral change)

A vocal consonant ("T", "P") is a **narrowband burst**: energy concentrated in 2-5kHz, rapid onset but tonal coloration.
- **Flatness** < 0.15 (tonal, energy concentrated in harmonics)
- **whiteNoiseScore** < 0.15 (not broadband)
- **spectralFlux** spikes but less than a true snare

A synth stab is **harmonic**: energy in fundamental + overtones.
- **Flatness** < 0.10 (very tonal)
- **whiteNoiseScore** < 0.10

### 2.2 Proposed Veto Logic (Zero-Alloc)

**Injection point:** After the WAVE 8008 adapter (line 616), before the Centroid Shield (line 629). This is the **Tonality Veto Gate** — a hard multiplicative gate on `hybridSnare`.

```typescript
// ═══════════════════════════════════════════════════════════════════
// WAVE 7749: TONALITY VETO — Multi-dimensional snare isolation
// A snare is broadband noise. A vocal/synth is tonal. If a snare
// onset is detected in frequency but the signal is tonal, VETO it.
// This kills vocal consonants, synth stabs, and bass pops that
// masquerade as snares in the frequency-band detector.
//
// THREE ORTHOGONAL AXES:
//   1. flatness (Wiener entropy) — tonal vs noise
//   2. whiteNoiseScore (HF broadband) — cymbal/snare sizzle vs vocal/synth
//   3. spectralFlux (spectral change rate) — impulse vs sustain
//
// The veto is a multiplicative gate, not a binary kill. This preserves
// snare hits that are slightly tonal (rimshots, claps) while killing
// sustained tonal bleed.
// ═══════════════════════════════════════════════════════════════════
const photon = input.photon
if (photon !== undefined && hybridSnare > 0) {
  const wns = photon.whiteNoiseScore   // [0,1] — HF broadband
  const flux = photon.spectralFlux     // [0,~1] — spectral change rate

  // AXIS 1: Flatness gate — tonal signals get penalized
  // flatness < 0.12 = pure tonal (vocal/synth) → veto factor 0
  // flatness 0.12-0.25 = mixed → partial pass
  // flatness > 0.25 = noise-like (snare/cymbal) → full pass
  const flatnessGate = flatness < p.snareVetoFlatnessFloor
    ? 0.0                           // Hard veto — pure tonal
    : flatness < p.snareVetoFlatnessKnee
      ? (flatness - p.snareVetoFlatnessFloor) /
        (p.snareVetoFlatnessKnee - p.snareVetoFlatnessFloor)  // Linear ramp
      : 1.0                         // Full pass — noise-like

  // AXIS 2: whiteNoiseScore gate — broadband HF discriminates snare from vocal
  // wns < 0.15 = no HF broadband (vocal consonant) → veto
  // wns 0.15-0.35 = partial (rimshot, clap) → partial pass
  // wns > 0.35 = strong broadband (snare, cymbal) → full pass
  const wnsGate = wns < p.snareVetoWnsFloor
    ? 0.0
    : wns < p.snareVetoWnsKnee
      ? (wns - p.snareVetoWnsFloor) /
        (p.snareVetoWnsKnee - p.snareVetoWnsFloor)
      : 1.0

  // AXIS 3: spectralFlux gate — sustained tonal energy has low flux
  // A snare hit = explosive flux spike. A vocal sustain = low flux.
  // This is the "is it an explosion?" test.
  // flux < 0.10 = sustained (vocal tail) → veto
  // flux > 0.30 = explosive (snare) → full pass
  const fluxGate = flux < p.snareVetoFluxFloor
    ? 0.0
    : flux < p.snareVetoFluxKnee
      ? (flux - p.snareVetoFluxFloor) /
        (p.snareVetoFluxKnee - p.snareVetoFluxFloor)
      : 1.0

  // COMBINED VETO: multiplicative gate (all three axes must pass)
  // This is an AND-gate: if ANY axis vetoes, the snare is killed.
  // A vocal consonant: flatnessGate=0 → killed.
  // A synth stab: flatnessGate=0 → killed.
  // A snare hit: all gates ~1.0 → passes.
  // A clap (slightly tonal): flatnessGate=0.5, wnsGate=0.8, fluxGate=1.0 → 0.4 pass.
  const vetoFactor = flatnessGate * wnsGate * fluxGate
  hybridSnare *= vetoFactor
}
```

### 2.3 Required Profile Parameters

Add to `ILiquidProfile` (after `flatnessNoiseThreshold`, line 176):

```typescript
// WAVE 7749: TONALITY VETO — Snare isolation thresholds
/** Flatness below this = pure tonal (vocal/synth) → hard snare veto.
 *  Default 0.12. Techno 0.10 (allow slightly tonal claps), Latino 0.15 (vocals dominant). */
readonly snareVetoFlatnessFloor?: number
/** Flatness above this = noise-like → full snare pass.
 *  Default 0.25. The knee creates a linear ramp between floor and knee. */
readonly snareVetoFlatnessKnee?: number
/** whiteNoiseScore below this = no HF broadband (vocal consonant) → hard veto.
 *  Default 0.15. */
readonly snareVetoWnsFloor?: number
/** whiteNoiseScore above this = strong broadband (snare/cymbal) → full pass.
 *  Default 0.35. */
readonly snareVetoWnsKnee?: number
/** spectralFlux below this = sustained (vocal tail) → hard veto.
 *  Default 0.10. */
readonly snareVetoFluxFloor?: number
/** spectralFlux above this = explosive (snare hit) → full pass.
 *  Default 0.30. */
readonly snareVetoFluxKnee?: number
```

All optional with `??` defaults — zero breakage to existing profiles.

### 2.4 Zero-Alloc Verification

| Constraint | Status |
|---|---|
| No `new` | ✅ Only scalar comparisons and arithmetic |
| No object spreading | ✅ Reads `photon.whiteNoiseScore` etc. directly |
| No arrays | ✅ |
| No closures | ✅ |
| Guard for V2 fallback | ✅ `if (photon !== undefined)` — veto is inert on GodEarFFT V2 |

---

## 3. Layer 2: The Flux/Sustain Choke

### 3.1 The Problem

Even with the tonality veto, the `envSnare` envelope has a release tail. In Latino (`decayBase 0.72`), the snare envelope rings for ~500ms. If a vocal consonant sneaks through the veto (e.g. a "S" sibilant that has moderate flatness), the envelope tail will sustain over the vocal, creating a flickering "ghost snare" that tracks the vocal amplitude.

### 3.2 The Solution: Sustain Choke

A snare is an **explosion** — it peaks and decays in <100ms. A vocal **sustains** — it holds energy for 200ms+. If the `snare_energy` EMA stays elevated for more than ~50ms without a new onset, it's not a snare — it's a sustained signal. **Choke the envelope.**

### 3.3 Proposed Choke Logic (Zero-Alloc)

**New class state** (pre-allocated, after `_snareImpulse` at line 208):

```typescript
// WAVE 7749: SUSTAIN CHOKE — kills vocal bleed tails in envSnare
// Tracks how long snare_energy has been elevated without a new onset.
// If it sustains > chokeFrames (~50ms at 44Hz = ~2 frames), choke the envelope.
private _snareSustainFrames: number = 0
private _snareChokeFactor: number = 1.0
```

**Hot path** (injected after the WAVE 8008 adapter, before the Tonality Veto):

```typescript
// WAVE 7749: SUSTAIN CHOKE — A snare explodes and decays in <100ms.
// A vocal sustains. If snare_energy stays elevated without new onsets,
// it's a vocal/synth tail, not a snare. Choke the envelope exponentially.
//
// Mechanism: Track frames since last TRUE onset (snareOnset && vetoFactor > 0).
// If frames > chokeThreshold, apply exponential decay to hybridSnare.
// The choke releases instantly when a new true onset fires.
if (input.snare_energy !== undefined) {
  if (snareOnset) {
    // New true onset — reset sustain counter, release choke
    this._snareSustainFrames = 0
    this._snareChokeFactor = 1.0
  } else {
    this._snareSustainFrames++
    // After ~2 frames (~45ms at 44Hz) without a new onset, start choking
    if (this._snareSustainFrames > p.snareChokeFrames ?? 2) {
      // Exponential choke: 0.70 per frame (~15ms half-life at 44Hz)
      // This kills sustained tails within ~100ms while preserving
      // the initial 90ms hold from _snareHoldCounter
      this._snareChokeFactor *= (p.snareChokeRate ?? 0.70)
    }
  }
  hybridSnare *= this._snareChokeFactor
}
```

### 3.4 Required Profile Parameters

```typescript
/** WAVE 7749: Frames without new onset before sustain choke activates.
 *  Default 2 (~45ms at 44Hz). */
readonly snareChokeFrames?: number
/** WAVE 7749: Exponential choke rate per frame after threshold.
 *  Default 0.70 (~15ms half-life). Lower = faster choke. */
readonly snareChokeRate?: number
```

### 3.5 Interaction with Existing Hold Counter

The `_snareHoldCounter` (4 frames, ~90ms) extends the snare pulse for DMX hardware. The sustain choke operates **after** the hold counter — it doesn't kill the initial 90ms hold, it kills the **tail** that persists beyond the hold. Timeline:

```
Frame 0:  snareOnset fires → _snareHoldCounter=4, _snareSustainFrames=0, choke=1.0
Frame 1:  hold=3, sustain=1, choke=1.0  → hybridSnare=1.0 (hold active)
Frame 2:  hold=2, sustain=2, choke=1.0  → hybridSnare=1.0 (hold active)
Frame 3:  hold=1, sustain=3, choke=1.0  → hybridSnare=1.0 (hold active)
Frame 4:  hold=0, sustain=4, choke=1.0  → hybridSnare=percRaw=0 (hold expired)
  [If snare_energy stays elevated (vocal tail):]
Frame 5:  hold=0, sustain=5 > 2, choke=0.70 → hybridSnare *= 0.70
Frame 6:  hold=0, sustain=6,    choke=0.49 → hybridSnare *= 0.49
Frame 7:  hold=0, sustain=7,    choke=0.34 → hybridSnare *= 0.34
  [Vocal tail killed within ~60ms of hold expiry]
```

### 3.6 Reset in `clearAudioTransients()`

```typescript
this._snareSustainFrames = 0
this._snareChokeFactor = 1.0
```

---

## 4. Layer 3: Monte Carlo Calibration Blueprint

### 4.1 The Goal

The veto thresholds (`snareVetoFlatnessFloor`, `snareVetoWnsFloor`, `snareVetoFluxFloor`, etc.) are currently educated guesses. The Architect's 28GB stem dataset allows us to find the **exact hyperplane** that separates true snares from vocal consonants, synth stabs, and bass pops.

### 4.2 The Dataset

| Category | Source | Expected Frames | Ground Truth |
|---|---|---|---|
| Isolated snares | Drum-only stems (techno, latino, rock) | ~50,000 | `label=snare` |
| Isolated vocals | Vocal-only stems (with consonants) | ~50,000 | `label=vocal` |
| Isolated synths | Synth-only stems (techno leads, pads) | ~30,000 | `label=synth` |
| Isolated bass | Bass-only stems (slap, 808) | ~20,000 | `label=bass` |
| Full mixes | Full tracks (for false-positive testing) | ~100,000 | `label=mix` |

### 4.3 Telemetry Modification Blueprint

**Approach:** Extend `LiquidTelemetryObserver` to capture the 5 veto-relevant metrics per frame, then run the engine in **offline mode** against the stem dataset.

#### 4.3.1 Extend `Omni41TelemetryRecord`

Add 5 fields to the telemetry record <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\physics\LiquidTelemetryObserver.ts" lines="31-71" />:

```typescript
export interface Omni41TelemetryRecord {
  // ... existing fields ...
  // WAVE 7749: Monte Carlo calibration fields
  snare_energy: number        // from input.snare_energy
  flatness: number            // from input.flatness
  whiteNoiseScore: number     // from input.photon?.whiteNoiseScore
  spectralFlux: number        // from input.photon?.spectralFlux
  spectralCentroid: number    // from input.spectralCentroid
  hybridSnare: number         // from engine.lastHybridSnare
  isSnareOnset: boolean       // true if snareOnset fired this frame
}
```

#### 4.3.2 Extend `capture()` in `LiquidTelemetryObserver`

In the `capture()` method (line 139), add the new fields to the record:

```typescript
const record: Omni41TelemetryRecord = {
  // ... existing fields ...
  // WAVE 7749: Monte Carlo calibration
  snare_energy:      input.snare_energy ?? 0,
  flatness:          input.flatness ?? 0,
  whiteNoiseScore:   this._lastPhoton?.whiteNoiseScore ?? 0,
  spectralFlux:      this._lastPhoton?.spectralFlux ?? 0,
  spectralCentroid:  input.spectralCentroid ?? 0,
  hybridSnare:       this._engine.lastHybridSnare,
  isSnareOnset:      this._engine.lastHybridSnare > 0.5,  // proxy
}
```

#### 4.3.3 Offline Batch Runner Script

Create a Node.js script (`scripts/monte-carlo-snare-veto.ts`) that:

1. **Loads each stem file** through `GodEarFFT.analyze()` → `LiquidEngineBase.applyBands()`
2. **Captures telemetry** per frame via the extended observer
3. **Dumps to JSONL** with a `label` field (from the directory structure: `stems/snare/*.wav` → `label=snare`)
4. **Outputs** a single `monte_carlo_snare_veto.jsonl` file

```typescript
// scripts/monte-carlo-snare-veto.ts
// Pseudo-code blueprint — NOT for execution in the hot path.
import { GodEarFFT } from '../src/workers/GodEarFFT'
import { LiquidEngine71 } from '../src/hal/physics/LiquidEngine71'
import { LiquidTelemetryObserver } from '../src/hal/physics/LiquidTelemetryObserver'
import { TECHNO_PROFILE } from '../src/hal/physics/profiles/techno'
import * as fs from 'fs'
import * as path from 'path'

async function runMonteCarlo(stemsDir: string, outputFile: string) {
  const analyzer = new GodEarFFT()
  const engine = new LiquidEngine71(TECHNO_PROFILE)
  const observer = new LiquidTelemetryObserver()
  observer.setEngine(engine)
  observer.setTelemetryEnabled(true)

  const out = fs.createWriteStream(outputFile)
  const stems = walkDir(stemsDir)  // recursive .wav finder

  for (const stemPath of stems) {
    // Label from directory: stems/snare/techno_kick_001.wav → 'snare'
    const label = path.basename(path.dirname(stemPath))
    const audio = await loadWav(stemPath)  // Float32Array
    const frameSize = analyzer.fftSize
    const hopSize = frameSize  // no overlap for calibration

    for (let i = 0; i < audio.length; i += hopSize) {
      const frame = audio.subarray(i, i + frameSize)
      const spectrum = analyzer.analyze(frame)
      const input = buildLiquidInput(spectrum)  // map GodEarSpectrum → LiquidStereoInput
      observer.capturePhoton(input)
      engine.applyBands(input)
      observer.capture(input, engine.lastResult!)
    }

    // Dump this stem's frames with label
    const records = observer.getBuffer()
    for (const r of records) {
      out.write(JSON.stringify({ ...r, label }) + '\n')
    }
    observer.flushBuffer()
  }

  out.end()
}
```

### 4.4 The SVM Hyperplane Analysis

Once the JSONL is generated, run a Python analysis script:

```python
# scripts/analyze_snare_veto_hyperplane.py
import pandas as pd
import numpy as np
from sklearn.svm import SVC
from sklearn.preprocessing import StandardScaler

df = pd.read_json('monte_carlo_snare_veto.jsonl', lines=True)

# Features: the 5 veto-relevant metrics
X = df[['snare_energy', 'flatness', 'whiteNoiseScore', 'spectralFlux', 'spectralCentroid']].values
# Label: snare=1, everything else=0
y = (df['label'] == 'snare').astype(int).values

# Standardize
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# Train linear SVM — the hyperplane coefficients ARE the threshold ratios
svm = SVC(kernel='linear', C=1.0, class_weight='balanced')
svm.fit(X_scaled, y)

# Extract the decision boundary
# The hyperplane: w·x + b = 0 → x_threshold = -b / w (per axis)
coefficients = svm.coef_[0]  # [w_snare, w_flat, w_wns, w_flux, w_centroid]
intercept = svm.intercept_[0]

print(f"Hyperplane coefficients:")
print(f"  snare_energy:     {coefficients[0]:.4f}")
print(f"  flatness:         {coefficients[1]:.4f}")
print(f"  whiteNoiseScore:  {coefficients[2]:.4f}")
print(f"  spectralFlux:     {coefficients[3]:.4f}")
print(f"  spectralCentroid: {coefficients[4]:.4f}")
print(f"  intercept:        {intercept:.4f}")

# Find the floor/knee thresholds from the marginal samples
# (samples closest to the decision boundary on each axis)
margins = svm.decision_function(X_scaled)
snare_mask = y == 1
vocal_mask = (df['label'] == 'vocal').values

# The floor = p5 of snare samples (95% of snares are above this)
# The knee = p50 of snare samples (50% of snares are above this)
for axis, name in enumerate(['flatness', 'whiteNoiseScore', 'spectralFlux']):
    snare_vals = X[snare_mask, axis]
    vocal_vals = X[vocal_mask, axis]
    floor = np.percentile(snare_vals, 5)
    knee = np.percentile(snare_vals, 50)
    vocal_p95 = np.percentile(vocal_vals, 95)
    print(f"\n{name}:")
    print(f"  Snare p5 (floor):  {floor:.4f}")
    print(f"  Snare p50 (knee):  {knee:.4f}")
    print(f"  Vocal p95:         {vocal_p95:.4f}")
    print(f"  Separation gap:    {floor - vocal_p95:.4f}")
```

### 4.5 Expected Output

The analysis produces:
1. **Per-axis thresholds** (`snareVetoFlatnessFloor`, `snareVetoWnsFloor`, `snareVetoFluxFloor`) from the p5 of snare samples
2. **Per-axis knees** (`snareVetoFlatnessKnee`, `snareVetoWnsKnee`, `snareVetoFluxKnee`) from the p50 of snare samples
3. **Separation gaps** — if the gap is negative (vocal p95 > snare p5), that axis alone can't separate and the multiplicative AND-gate is essential
4. **False positive rate** — what % of vocal frames pass all three gates (target: <2%)

### 4.6 Calibration Iteration

1. Run with default thresholds → measure false positive rate on vocal stems
2. If FP > 2%, tighten the floor thresholds (raise them)
3. If snare recall < 95%, loosen the knee thresholds (lower them)
4. Repeat until FP < 2% and recall > 95%

---

## 5. Complete Injection Map

### 5.1 `LiquidEngineBase.ts` (4 edits)

| # | Location | Change |
|---|---|---|
| 1 | Line 208 (after `_snareImpulse`) | Add `_snareSustainFrames`, `_snareChokeFactor` state |
| 2 | Line 616 (after WAVE 8008 adapter, before centroid shield) | Add Sustain Choke block |
| 3 | Line 616+ (after Sustain Choke, before centroid shield) | Add Tonality Veto block |
| 4 | `clearAudioTransients()` | Add reset for `_snareSustainFrames`, `_snareChokeFactor` |

### 5.2 `ILiquidProfile.ts` (2 edits)

| # | Location | Change |
|---|---|---|
| 5 | Line 180 (after `apocalypseFlatness`) | Add 6 veto threshold params + 2 choke params |
| 6 | `overrides41` block | Add same 8 params as optional overrides |

### 5.3 `LiquidTelemetryObserver.ts` (1 edit)

| # | Location | Change |
|---|---|---|
| 7 | `Omni41TelemetryRecord` + `capture()` | Add 7 Monte Carlo fields |

### 5.4 `scripts/monte-carlo-snare-veto.ts` (new file)

| # | Location | Change |
|---|---|---|
| 8 | `scripts/` | New offline batch runner script |

**Total: 7 code edits + 1 new script. Zero allocation in hot path.**

---

## 6. Defense-in-Depth Summary

```
Audio Input
    │
    ▼
┌─────────────────────────────────┐
│ Detector A: Legacy Transient    │──→ percRaw (0 or 1)
│ Shaper (frequency-band deltas)  │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ Detector B: WAVE 8008 Adapter   │──→ snareImpulse (0-1, decaying)
│ (snare_energy EMA → impulse)    │
└─────────────────────────────────┘
    │
    ▼
hybridSnare = max(percRaw, snareImpulse)
    │
    ▼
┌─────────────────────────────────┐
│ WAVE 7749 Layer 2: SUSTAIN      │──→ hybridSnare *= chokeFactor
│ CHOKE — kills vocal tails that  │    (exponential decay after 50ms
│ sustain without new onsets      │     without new onset)
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ WAVE 7749 Layer 1: TONALITY     │──→ hybridSnare *= vetoFactor
│ VETO — 3-axis multiplicative    │    (flatness × wns × flux)
│ gate: flatness × wns × flux     │    (any tonal axis → kill)
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ WAVE 2449: Centroid Shield      │──→ hybridSnare = 0 (during kicks
│ (existing — kick body mask)     │    with low centroid)
└─────────────────────────────────┘
    │
    ▼
envSnare.process(hybridSnare) → backRight
```

**Each layer addresses a different bleed mechanism:**
- **Detector A+B**: Detect snare in frequency (existing)
- **Sustain Choke**: Kill tails that persist >50ms (vocal sustain)
- **Tonality Veto**: Kill onsets that are tonal, not noise (vocal consonants, synth stabs)
- **Centroid Shield**: Kill onsets during kicks with low centroid (kick body)

---

## 7. Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Veto kills real snares (false negatives) | **High** | Monte Carlo calibration finds p5 thresholds — 95% of snares pass. Multiplicative gate (not binary) preserves partial passes for borderline cases (claps, rimshots). |
| Veto too loose (vocal bleed persists) | **Medium** | Three-axis AND-gate is strict. If any axis vetoes, snare is killed. Monte Carlo iteration tightens thresholds until FP < 2%. |
| GodEarFFT V2 fallback (no photon) | **None** | `if (photon !== undefined)` guard — veto is inert, falls back to existing behavior. |
| Sustain choke kills rolls/buzz rolls | **Low** | Choke threshold is 2 frames (~45ms). A buzz roll at 160 BPM has onsets every 187ms — each onset resets the choke. Only sustained signals (no new onsets) get choked. |
| Profile complexity explosion | **Low** | All 8 new params are optional with `??` defaults. Existing profiles work unchanged. Only techno/latino need tuning after Monte Carlo. |
| Offline script requires audio loading | **Medium** | Script uses `wav-decoder` or similar. 28GB dataset → ~10h processing time. Can be parallelized across stem categories. |

---

## 8. Why This Is "The Holy Grail"

The current snare detector is **1-dimensional** — it only looks at frequency-band energy. The WAVE 7749 proposal makes it **4-dimensional**:

1. **Frequency** (existing: highMidDelta, trebleDelta, snareSpectrum)
2. **Tonality** (new: flatness, whiteNoiseScore)
3. **Dynamics** (new: spectralFlux — explosion vs sustain)
4. **Time** (new: sustain choke — onset persistence)

A vocal consonant passes axis 1 (it has high-mid energy) but **fails axes 2-4** (it's tonal, not explosive, and sustains). A synth stab passes axis 1 but **fails axis 2** (it's tonal). A true snare passes all 4 axes.

The Monte Carlo calibration against 28GB of professional stems gives us the **exact thresholds** — not guesses, but measured separation boundaries from real-world audio. This is the difference between a heuristic and a **calibrated detector**.

---

*WAVE 7749 audit complete. Read-only. No code modified. 7 edits + 1 script proposed. Awaiting directive to execute and/or run Monte Carlo calibration.*