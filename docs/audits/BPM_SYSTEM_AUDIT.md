# BPM SYSTEM AUDIT — LuxSync Rhythm Architecture Deep-Dive

> **Purpose:** Feed this document to a DSP AI to design a zero-alloc autocorrelation engine
> that replaces or supplements the current interval-based BPM tracker.
> **Scope:** FFT spectral extraction → worker BPM detection → IPC transit → main-thread PLL →
> cognitive consumers. All math, data structures, and cross-thread pipelines documented.
> **Date:** 2026-08-16

---

## TABLE OF CONTENTS

1. [The Extraction — GodEarFFT V3 & IntervalBpmTracker](#1-the-extraction)
2. [The Transit — Worker to Main Thread](#2-the-transit)
3. [The Consumers — The Rhythm Network](#3-the-consumers)
4. [The Weak Points — Autocorrelation Injection Targets](#4-the-weak-points)

---

## 1. THE EXTRACTION

### 1.1 GodEarFFT V3 — Spectral Filter Bank

**File:** `electron-app/src/workers/GodEarFFT.ts`

#### 1.1.1 FFT Core

- **FFT Size:** 4096 samples
- **Sample Rate:** 44100 Hz (default)
- **Bin Resolution:** 44100 / 4096 = **10.77 Hz/bin**
- **Num Bins:** 2049 (N/2 + 1)
- **Window:** Blackman-Harris 4-term (-92 dB sidelobes)
- **DC Removal:** Pre-window, mean subtraction
- **Zero-alloc:** Entire pipeline operates on pre-allocated `Float32Array` buffers. No `new` in hot path. Twiddle factor LUT initialized once.

#### 1.1.2 LR4 Band Masks (Linkwitz-Riley 4th Order Equivalent)

Bands are separated using **magnitude-domain LR4-equivalent filter masks**. Each band is defined by a low and high crossover frequency. The mask weight at each bin is:

```
mask[bin] = HP(binFreq, lowCrossover) × LP(binFreq, highCrossover)
```

Where the LR4 transfer function magnitude squared is:

```
|H_LP(jω)|² = 1 / (1 + (ω/ωc)^8)      // low-pass
|H_HP(jω)|² = (ω/ωc)^8 / (1 + (ω/ωc)^8)  // high-pass
```

The 8th power comes from squaring the 4th-order response (LR4 = 24 dB/octave).

**Critical note:** These are **magnitude-only masks** applied to the power spectrum. No time-domain phase-coherent reconstruction is performed. Bands are consumed as `|X(f)|²` only. This is sufficient for energy extraction but means the band separation is not a true LR4 crossover — it's a magnitude approximation.

#### 1.1.3 Tactical Band Configuration

| Band | ID | Range (Hz) | Crossover Slope | Purpose |
|------|----|-----------|-----------------|---------|
| Sub-Bass | `subBass` | 20–60 | LR4 | Kick seismic pressure, floor shakers |
| Bass | `bass` | 60–250 | LR4 | Kick body, bass guitar, toms |
| Low-Mid | `lowMid` | 250–500 | LR4 | Mud zone, atmospheric fills |
| Mid | `mid` | 500–2000 | LR4 | Vocals, snare, lead instruments |
| High-Mid | `highMid` | 2000–6000 | LR4 | Guitar crunch, cymbal attack |
| Treble | `treble` | 6000–16000 | LR4 | Hi-hats, sparkle, strobe sync |
| Ultra-Air | `ultraAir` | 16000–22000 | LR4 | Harmonic sizzle, micro-scanners |

**ZERO OVERLAP** by design. The LR4 -6dB crossover points sum to 0 dB at the boundary.

#### 1.1.4 Band Power Extraction

```typescript
extractBandPower(powerSpectrum, mask) → Σ(powerSpectrum[i] * mask[i])
```

This is a weighted sum over the power spectrum bins. The result is a scalar energy value per band. `scaleBandEnergyForVisual()` normalizes by the mask weight sum to produce a deterministic post-FFT magnitude.

#### 1.1.5 WAVE 8002: Saturation Index Crossfade

When the audio signal is brickwall-limited (high Saturation Index), the raw energy bands become less informative for kick detection because the waveform is clipped. GodEarFFT V3 implements a crossfade:

```
kickSignal = SI × fluxScaled + (1 − SI) × rawBassEnergy
```

Where:
- `SI` = Saturation Index ∈ [0, 1] (derived from crest factor, flatness, total power)
- `fluxScaled` = `spectralFluxV3 × rawBassEnergyRef` (EMA with τ ≈ 1s)
- `rawBassEnergy` = `scaledBands.subBass + scaledBands.bass`

The crossfaded signal is distributed back to `bandsRaw.subBass` and `bandsRaw.bass` preserving their original ratio. **This is the signal that feeds the BPM tracker.**

#### 1.1.6 Spectral Flux V3

Half-wave rectified, whitened, normalized flux computed from the power spectrum:

```
flux[i] = max(0, power[i] - prevPower[i]) / (whitening[i] + ε)
```

Whitening is a running maximum normalization per bin. The sum of all flux bins gives `spectralFluxV3 ∈ [0, ~1]`.

#### 1.1.7 Transient Detection (GodEar Onset Detector)

Separate from the BPM tracker, GodEarFFT has its own onset detector for kick/snare/hihat:

```
kickDetected  = onsetDetector.detectOnset('kick',  rawBands.subBass + rawBands.bass * 0.5)
snareDetected = onsetDetector.detectOnset('snare', rawBands.mid + rawBands.lowMid * 0.5)
hihatDetected = onsetDetector.detectOnset('hihat', rawBands.treble + rawBands.highMid * 0.3)
```

These booleans are used for UI display and as a secondary signal. **The BPM tracker does NOT consume these booleans** — it consumes the raw energy values.

#### 1.1.8 AGC Trust Zones

Per-band AGC with freeze reduction under brickwall conditions (`SI > 0.6`). The AGC processes bands independently using RMS history. **Critical:** The BPM tracker sees `bandsRaw` (pre-AGC, post-scaling), NOT the AGC-processed `bands`. This is by design — AGC compresses transients, which kills kick detection.

#### 1.1.9 Pre-Allocated Output

The `bandsRawOutput` object is pre-allocated and mutated in-place per frame:

```typescript
this.bandsRawOutput = { subBass: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0, ultraAir: 0 };
```

Seven scalar assignments per frame. Zero allocation.

---

### 1.2 SpectrumAnalyzer — Legacy Adapter

**File:** `electron-app/src/core/senses/spectrum/SpectrumAnalyzer.ts`

Wraps `GodEarAnalyzer` and converts to `SpectrumResult` — a legacy-compatible format with psychoacoustic scaling (WebAudio AnalyserNode-compatible levels via `toWebAudioScaledLevel()`).

**Key fields consumed by BPM chain:**
- `rawBassEnergy` = `godEarResult.bandsRaw.subBass + godEarResult.bandsRaw.bass`
- `rawSubBassEnergy` = `godEarResult.bandsRaw.subBass`
- `rawBassOnlyEnergy` = `godEarResult.bandsRaw.bass`
- `rawMidEnergy` = `godEarResult.bandsRaw.mid`
- `spectralCentroid` = `godEarResult.spectral.centroid` (Hz, unnormalized)
- `crestFactor` = `godEarResult.spectral.crestFactor`

**Spectral flux** is computed here as a simple psychoacoustic domain delta:
```
spectralFlux = min(1, |currentEnergy - prevEnergy| × 2)
```
This is NOT the same as GodEarFFT's `spectralFluxV3`. The legacy `spectralFlux` is used for UI/SectionTracker, not for BPM.

---

### 1.3 GatedNeedlePipeline — Kick Onset Extraction

**File:** `electron-app/src/core/senses/bpm/GatedNeedlePipeline.ts`

**Pure, stateless, zero-allocation.** All state enters via parameters. The caller (`RhythmTracker`) maintains `prevSubEnergy`, `prevBassOnlyEnergy`, `prevMidEnergy` between frames.

#### 1.3.1 Step 1: Brute Force Flux (Rising Edges Only)

```
rawLowFlux     = max(0, rawSubBassEnergy - prevSubEnergy)
bassOnlyFlux   = max(0, rawBassOnlyEnergy - prevBassOnlyEnergy)
rawMidFlux     = max(0, rawMidEnergy - prevMidEnergy)
rawBassFlux    = rawLowFlux + bassOnlyFlux
```

Half-wave rectified. The decay tail of a kick produces `current < prev` → flux = 0. Only rising edges pass. This produces 1-frame-wide pulses, not 3-5 frame decay tails.

#### 1.3.2 Step 2: Centroid-Based Gate

```
if rawBassFlux > currentFloor:
    if spectralCentroid < 800 Hz:     needle = rawBassFlux        // pure kick
    elif spectralCentroid < 1500 Hz:  needle = rawBassFlux if rawBassFlux > currentFloor × 1.33  // grey zone
    else:                             needle = 0                  // bright transient (hi-hat/cymbal)
```

The centroid gate is a **physical, deterministic arbiter** — it distinguishes kick (<800 Hz) from hi-hat (>1500 Hz) based on spectral brightness. The grey zone (800-1500 Hz) requires the flux to exceed 1.33× the floor to pass.

#### 1.3.3 Step 3: Sniper Guard (Redundant)

```
if needle > 0.015 and spectralCentroid > 1500: needle = 0
```

Belt-and-suspenders kill of any bright transient that leaked through the grey zone.

#### 1.3.4 Output

The `needle` value (0 = no kick, >0 = onset magnitude) is the signal consumed by `IntervalBPMTracker.process()`.

---

### 1.4 AdaptiveFloorTracker — Dynamic Noise Floor

**File:** `electron-app/src/core/senses/bpm/AdaptiveFloorTracker.ts`

Maintains a rolling buffer of 64 significant flux peaks. The floor is **40% of the median** of this buffer, clamped to `[0.005, 0.060]`.

```
floor = clamp(median(fluxPeaks) × 0.40, 0.005, 0.060)
```

- **Window:** 64 frames (~3 seconds at ~20 fps)
- **Minimum samples:** 8 before median is valid (bootstrap = 0.015)
- **Silence exclusion:** Values ≤ 0.005 don't enter the buffer (prevents median contamination)
- **Allocation:** `floorBuffer` is a `number[]` with `push`/`shift` — **NOT zero-alloc**. This is a candidate for optimization.

---

### 1.5 IntervalBpmTracker — Core BPM Engine

**File:** `electron-app/src/workers/IntervalBPMTracker.ts`

#### 1.5.1 Kick Detection (Ratio-Based)

```
ratio = rawBassEnergy / bassAvg
kickDetected = (rawBassEnergy > 0) AND (ratio > ENERGY_RATIO_THRESHOLD) AND (risingDelta > MIN_DELTA)
```

Constants:
- `ENERGY_RATIO_THRESHOLD = 1.6` — kick must be 60% above rolling average
- `MIN_INTERVAL_MS = 200` — minimum inter-kick interval (300 BPM max)
- `MAX_INTERVAL_MS = 1500` — maximum inter-kick interval (40 BPM min)
- `bassAvg` — rolling average of raw bass energy (window size 30, ~1.5s)

#### 1.5.2 Adaptive Debounce

```
debounceMs = max(200, stableBpmInterval × DEBOUNCE_FACTOR)
```

Where `DEBOUNCE_FACTOR = 0.40`. At 128 BPM (469ms/beat), debounce = 188ms → clamped to 200ms. At 60 BPM (1000ms/beat), debounce = 400ms. This prevents double-triggers from decay tails.

#### 1.5.3 Peak Discriminator

Rejects offbeats that pass the ratio test but are too weak relative to recent kicks:

```
if (rawBassEnergy < peakHistoryAverage × 0.5) → reject
```

#### 1.5.4 Interval BPM Calculation

When a kick passes all gates:

```
interval = currentTimestamp - lastKickTimestamp
if (interval >= MIN_INTERVAL_MS and interval <= MAX_INTERVAL_MS):
    rawBpm = 60000 / interval
```

#### 1.5.5 Outlier Rejection

```
if (rawBpm > 0):
    ratio = rawBpm / lastValidBpm
    if (ratio < 0.5 or ratio > 2.0): reject as octave error
    if (ratio > 1.8 or ratio < 0.55): flag as suspicious
```

#### 1.5.6 BPM History Buffer & Median Smoothing

- **History size:** 8 samples (FIFO)
- **Median BPM:** computed from sorted copy of history buffer
- **Allocation:** `sort()` creates a copy each time — **NOT zero-alloc**

```
sortedHistory = [...bpmHistory].sort((a, b) => a - b)
medianBpm = sortedHistory[4]  // middle of 8 elements
```

#### 1.5.7 Confidence Estimation

```
IQR = Q3(bpmHistory) - Q1(bpmHistory)
confidence = clamp(1 - (IQR / medianBpm) × 2, 0, 1)
```

- High confidence: IQR is small relative to median (tight clustering)
- Low confidence: IQR is large (scattered BPM estimates)
- **Allocation:** Sorting for Q1/Q3 creates copies — **NOT zero-alloc**

#### 1.5.8 Autocorrelation Validator (Existing)

Runs every 64 frames on a longer energy history buffer (64 samples):

```
for lag in [MIN_INTERVAL_MS .. MAX_INTERVAL_MS]:
    acf[lag] = Σ energyHistory[i] × energyHistory[i - lag]
bestLag = argmax(acf)
autocorrelationBpm = 60000 / bestLag
```

**This is the existing autocorrelation** — it's a validation cross-check, not the primary BPM source. It runs on the energy history (raw bass energy per frame), not on the needle signal. The result is compared to the interval-based BPM:

```
if |autocorrelationBpm - medianBpm| < 10%: validate (confidence boost)
else: invalidate (confidence penalty)
```

**Limitations:**
- Only 64 samples of history (≈3 seconds at 20 fps) — short for reliable autocorrelation
- O(N × L) complexity where N=64, L=range of lags — not expensive but not optimized
- Uses `number[]` arrays, not `Float32Array` — not zero-alloc
- Runs on energy envelope, not on the onset detection function (ODF) — less precise than autocorrelation on the needle signal directly

#### 1.5.9 Kalman Filter

State: `[bpm, bpmRate]` (2D state vector)

```
Prediction:
    x_pred = F × x_est + B × u
    P_pred = F × P_est × Fᵀ + Q

Update:
    K = P_pred × Hᵀ × (H × P_pred × Hᵀ + R)⁻¹
    x_est = x_pred + K × (measurement - H × x_pred)
    P_est = (I - K × H) × P_pred
```

Where:
- `F = [[1, 1], [0, 1]]` (constant velocity model)
- `H = [[1, 0]]` (observe BPM only)
- `Q` (process noise) = `[[0.01, 0], [0, 0.001]]` — allows BPM to drift
- `R` (measurement noise) = `0.5 + (1 - confidence) × 4.0` — adaptive: more noise when confidence is low

The Kalman filter smooths the BPM trajectory and handles tempo changes. The `bpmRate` component allows it to predict gradual drift.

**Measurement gating:** If `|measurement - prediction| > 15 BPM`, the measurement is rejected (outlier gate before Kalman update).

#### 1.5.10 Dance Pocket Folding

Maps raw BPM to musically meaningful tempo ranges:

```
while (bpm < pocketMin): bpm ×= 2  // fold up
while (bpm > pocketMax): bpm /= 2  // fold down
```

Pocket bounds are vibe-dependent:
- **Techno:** [120, 135]
- **Latin:** [85, 105]
- **Default:** [90, 135]
- **Dembow ceiling:** Additional cap at vibe-specific maximum

This is the **musicalBpm** output — the value that reaches the main thread and all consumers.

#### 1.5.11 Reset

Clears all history buffers, resets Kalman state, resets debounce, resets confidence. Called on `RESET_PACEMAKER` IPC message.

---

### 1.6 RhythmTracker — Orchestration Layer

**File:** `electron-app/src/core/senses/tracking/RhythmTracker.ts`

Encapsulates:
- `IntervalBPMTracker` — core BPM detection
- `AdaptiveFloorTracker` — dynamic floor
- `GatedNeedlePipeline` — onset extraction (stateless, state held here)

**Per-frame flow:**
1. Extract `rawSubBassEnergy`, `rawBassOnlyEnergy`, `rawMidEnergy`, `spectralCentroid` from `SpectrumResult`
2. Update `AdaptiveFloorTracker` with previous frame's `rawBassFlux`
3. Call `processNeedle()` with current energies + prev energies + floor
4. Store new prev energies
5. Call `IntervalBPMTracker.process(needle, rawBassEnergy, timestampMs)`
6. Apply vibe-dependent pocket bounds and dembow ceiling
7. Return `RhythmTrackingResult` with `musicalBpm`, `confidence`, `beatPhase`, `kickDetected`, `kickCount`, `telemetry`

---

### 1.7 BPMService — Service Wrapper

**File:** `electron-app/src/core/senses/services/BPMService.ts`

Thin wrapper around `RhythmTracker` + `ShadowLogger`. Tracks frame count. Delegates `processFrame(spectrum, timestampMs)` → `RhythmTracker.process()`. Propagates `setVibe()` and `reset()`.

---

## 2. THE TRANSIT

### 2.1 SensesPipeline — Worker-Internal Pipeline

**File:** `electron-app/src/core/senses/pipeline/SensesPipeline.ts`

**Processing order per audio buffer:**

1. **Input telemetry:** Measure peak/RMS of raw buffer
2. **Ring buffer:** `AudioRingBuffer.writeAndSnapshot(incoming)` → if not full, early exit
3. **FFT:** `SpectrumAnalyzer.analyze(snapshot, sampleRate)` — on RAW audio (pre-AGC)
4. **AGC:** `agc.processBuffer(snapshot)` — normalize for UI/Wave8 (BPM tracker never sees this)
5. **Deterministic clock:** `deterministicTimestampMs = (totalSamplesProcessed / sampleRate) × 1000`
6. **BPM:** `BPMService.processFrame(spectrum, deterministicTimestampMs)` → `BPMOutput`
7. **Energy normalization:** `rawEnergy = bass×0.5 + mid×0.3 + treble×0.2` → `EnergyNormalizer.normalize()`
8. **AudioMetrics:** Construct for SectionTracker
9. **Wave8:** `SectionTracker.analyze(audioMetrics, normalizedEnergy, beatState, frameCount)`
10. **Payload:** `buildPayload(...)` → `ExtendedAudioAnalysis`

**Critical:** The timestamp fed to the BPM tracker is **deterministic** — derived from cumulative sample count, not `Date.now()`. This eliminates wall-clock jitter from the BPM interval measurement. The timestamp is monotonically increasing and precise to the sample.

### 2.2 Worker (senses.ts) — IPC Shell

**File:** `electron-app/src/workers/senses.ts`

#### 2.2.1 Audio Input Paths

Two paths for audio input:

1. **SharedArrayBuffer (SAB) / Shared Ring Buffer:** Worker polls SAB for new audio data. Zero-copy — the ring buffer is shared between main and worker. Audio frames are read directly from the SAB without IPC serialization.
2. **Legacy IPC:** `AUDIO_BUFFER` message with `Float32Array` payload. This involves structured clone serialization — **allocates a new Float32Array** on the worker side.

#### 2.2.2 Message Handling

| Message Type | Direction | Purpose |
|-------------|-----------|---------|
| `INIT` | Main → Worker | Initialize pipeline with config |
| `SHUTDOWN` | Main → Worker | Terminate worker |
| `HEARTBEAT` | Main → Worker | Liveness check |
| `AUDIO_BUFFER` | Main → Worker | Legacy audio delivery (non-SAB path) |
| `STATE_RESTORE` | Main → Worker | Restore pipeline state |
| `CONFIG_UPDATE` | Main → Worker | Update configuration |
| `SET_VIBE` | Main → Worker | Change vibe → pocket bounds |
| `SET_BPM` | Main → Worker | Manual BPM override |
| `RESET_PACEMAKER` | Main → Worker | Reset BPM tracker state |

#### 2.2.3 Output Serialization

The `ExtendedAudioAnalysis` result from `SensesPipeline.processFrame()` is sent to the main thread via `parentPort.postMessage()`. This involves **structured clone** of the object.

**Allocation analysis:**
- `ExtendedAudioAnalysis` is a plain object with ~30 scalar fields + optional `wave8` sub-object + `chroma: number[]` + `photon?` + `rhythmic?`
- `chroma` is a `number[12]` — **allocated per frame** by `GodEarAnalyzer` (pre-allocated array, but the structured clone creates a copy)
- `photon` and `rhythmic` are optional objects — cloned only when present
- The `snapshotBuffer` is a `Float32Array` reference — **NOT sent** (stays in worker)

**IPC jitter sources:**
1. Structured clone of `ExtendedAudioAnalysis` — ~0.1-0.5ms depending on payload size
2. Event loop contention on main thread — if main thread is busy with a render frame, the message sits in the event loop queue
3. SAB polling interval — if the worker polls at a fixed interval, there's quantization error in when audio is available

**Mitigations in place:**
- Deterministic timestamp eliminates clock jitter from BPM math
- Worker runs in a dedicated thread — no main-thread contention for FFT processing
- SAB path eliminates audio buffer serialization (zero-copy audio input)

### 2.3 Main-Thread Ingestion — AudioPipelineManager

**File:** `electron-app/src/core/orchestrator/audio/AudioPipelineManager.ts`

The main thread receives `ExtendedAudioAnalysis` from the worker and stores it in `lastAudioData`. Key fields:

```
workerBpm:             lastAudioData.workerBpm
workerBpmConfidence:   lastAudioData.workerBpmConfidence
workerOnBeat:          lastAudioData.workerOnBeat
workerBeatPhase:       lastAudioData.workerBeatPhase
workerKickCount:       lastAudioData.workerKickCount
rawBassEnergy:         lastAudioData.rawBassEnergy
```

**Staleness detection:** `checkStaleness()` with grace period. If no new audio data arrives within the grace window, `hasRealAudio` decays to false and bands are gradually zeroed (not a hard cut).

---

## 3. THE CONSUMERS

### 3.1 BeatDetector (PLL / Pacemaker) — Main Thread Phase-Locked Loop

**File:** `electron-app/src/engine/audio/BeatDetector.ts`

The BeatDetector is a **2nd-order PLL** with a flywheel. It does NOT detect kicks — the worker is the authority. The BeatDetector's job is to produce smooth, continuous phase prediction between worker messages.

#### 3.1.1 PLL Architecture

```
Worker BPM (authority) → setBpm() → pllSmoothedBpm
Worker kick detection → feedKick() → pllCorrectPhase()
System clock → tick() → continuous phase advance
```

#### 3.1.2 setBpm() — Frequency Lock

When worker BPM is available (conf > 0.5):
```
state.bpm = workerBpm
candidateBpm = workerBpm
candidateFrames = HYSTERESIS_FRAMES (forced lock)
state.confidence = 1.0
state.isLocked = true
pllSmoothedBpm = workerBpm
pllIntegralError = 0
```

This is a **hard frequency lock** — the PLL adopts the worker's BPM immediately. No gradual convergence.

#### 3.1.3 pllCorrectPhase() — Phase Correction (PI Controller)

When a real kick arrives (`feedKick(timestamp)`):

```
predictedCurrentBeat = pllPredictedNextBeat - beatDuration
error = kickTime - predictedCurrentBeat
wrappedError = error mod beatDuration (wrapped to ±halfBeat)
```

**Soft correction** (|error| ≤ 120ms):
```
P: pllPredictedNextBeat += wrappedError × PLL_PROPORTIONAL_GAIN (0.15)
I: pllIntegralError += wrappedError (clamped ±200ms)
   bpmCorrection = pllIntegralError × PLL_INTEGRAL_GAIN (0.005)
F: frequencyBpm = 60000 / kickInterval (if 0.65 < ratio < 1.55)
   pllSmoothedBpm += (frequencyBpm - pllSmoothedBpm) × PLL_FREQUENCY_GAIN (0.08) - bpmCorrection
Lock: pllIsLocked = true
```

**Hard reset** (|error| > 120ms):
```
pllPredictedNextBeat = kickTime + beatDuration
pllCurrentPhase = 0
pllIntegralError = 0
pllIsLocked = false
```

**PLL constants:**
| Constant | Value | Purpose |
|----------|-------|---------|
| `PLL_SOFT_CORRECTION_WINDOW_MS` | 120 | Soft vs hard correction threshold |
| `PLL_PROPORTIONAL_GAIN` | 0.15 | Phase correction aggressiveness |
| `PLL_INTEGRAL_GAIN` | 0.005 | BPM drift correction |
| `PLL_FREQUENCY_GAIN` | 0.08 | Direct frequency feedback from kick intervals |
| `PLL_LOOKAHEAD_MS` | 23 | Anticipatory beat firing (latency compensation) |
| `PLL_BEAT_WINDOW` | 0.12 | Phase window where onBeat is true (12% of beat) |
| `PLL_SILENCE_TIMEOUT_MS` | 4000 | Freewheel duration before unlock |

**BPM stabilization when locked:**
```
if (pllIsLocked and confidence > 0.5):
    maxShift = 0.8 BPM per beat
    delta = clamp(newBpm - previousBpm, -0.8, +0.8)
```

#### 3.1.4 tick() — Flywheel Phase Advance

Called every main-thread frame (~30-60 fps):

```
beatDuration = 60000 / pllSmoothedBpm
timeToNextBeat = pllPredictedNextBeat - now
pllCurrentPhase = 1.0 - (timeToNextBeat / beatDuration)
pllCurrentPhase = pllCurrentPhase mod 1.0

if (now >= pllPredictedNextBeat):
    overshoot = now - pllPredictedNextBeat
    fullBeatsOvershot = floor(overshoot / beatDuration)
    pllPredictedNextBeat += (fullBeatsOvershot + 1) × beatDuration
    pllCurrentPhase = (overshoot mod beatDuration) / beatDuration

// Silence detection
if (timeSinceLastCorrection > 4000ms): pllIsLocked = false

// Freewheel BPM convergence
if (!pllIsLocked and state.bpm > 0):
    pllSmoothedBpm += (state.bpm - pllSmoothedBpm) × 0.1

// Anticipatory onBeat
lookaheadPhase = (pllCurrentPhase + PLL_LOOKAHEAD_MS / beatDuration) mod 1.0
pllOnBeat = lookaheadPhase < 0.12 or lookaheadPhase > 0.88

// Silence veil
state.onBeat = pllIsLocked ? pllOnBeat : false
```

#### 3.1.5 Freewheel Mode

When worker confidence drops below 0.2 but memory exists:
```
freewheelAt(lastStableWorkerBpm) → pllSmoothedBpm = bpm (no lock claim)
```

The PLL continues spinning at the last known BPM but honestly reports `pllLocked = false`. The `onBeat` output is silenced (no phantom beats).

#### 3.1.6 Legacy Clustering (Pacemaker)

The BeatDetector retains a full clustering-based BPM detector (`updateBpmWithPacemaker()`) with:
- Peak history (64 kicks, 10s freshness window)
- Interval clustering (30ms tolerance)
- Dominant cluster selection (mode, not mean)
- Octave protection (reject 2× and 0.5× jumps)
- Hysteresis (30 frames / ~1s stability required)
- BPM rate limiter (±2 BPM per update)

**This code is largely dormant** — `setBpm()` forces lock immediately, bypassing the clustering pipeline. The clustering runs only via `process()` which is called by `tap()` (manual tap tempo) and the deprecated `process(metrics)` path. In production, the worker is the authority.

### 3.2 TickEngine — BPM Stabilization Shield & Context Propagation

**File:** `electron-app/src/core/orchestrator/tick/TickEngine.ts`

#### 3.2.1 BPM Stabilization Shield

A **hysteresis gate** between the worker BPM and the PLL:

```
if (workerBpm differs from _stableBpm by > 8%):
    // Large change — require 60 consecutive frames at conf > 0.7
    if (|workerBpm - _bpmCandidate| ≤ 2 and conf > 0.7):
        _bpmCandidateFrames++
        if (_bpmCandidateFrames >= 60):
            _stableBpm = workerBpm  // Accept after 2 seconds of confirmation
        else:
            acceptedBpm = _stableBpm  // Hold previous stable
    else:
        _bpmCandidate = workerBpm
        acceptedBpm = _stableBpm
else:
    _stableBpm = workerBpm  // Small change — accept immediately
```

**Constants:**
| Constant | Value | Purpose |
|----------|-------|---------|
| `BPM_HYSTERESIS_PCT` | 0.08 | 8% delta triggers confirmation |
| `BPM_CANDIDATE_CONFIRM_FRAMES` | 60 | ~2 seconds at 30 fps |
| `BPM_CANDIDATE_MIN_CONFIDENCE` | 0.7 | Worker confidence required |
| `BPM_CANDIDATE_TOLERANCE` | 2 | BPM tolerance for candidate matching |
| `BPM_EMA_ALPHA` | 0.15 | EMA smoothing factor |

This shield prevents dembow ghost-kick half-time detection (e.g., 101→89 BPM jumps) from reaching the PLL.

#### 3.2.2 Phase Crossfade

When `pllLocked` changes state, the phase output crossfades over 8 frames between worker phase and PLL phase:

```
targetWeight = pllLocked ? 1 : 0
step = 1 / 8
_phaseCrossfadeWeight → eased toward targetWeight

diff = pllPhase - workerBeatPhase (wrapped to shortest path)
context.beatPhase = (workerBeatPhase + diff × weight + 1) mod 1
```

This prevents instantaneous phase jumps that cause visual discontinuities.

#### 3.2.3 Context Propagation

The `MusicalContext` produced per frame includes:
- `context.bpm` — accepted (hysteresis-filtered) BPM
- `context.beatPhase` — crossfaded phase (PLL × worker)
- `context.isBeat` — `workerOnBeat || (pllLocked && beatState.onBeat)`
- `context.beatCount` — `workerKickCount` (monotonic, from worker)
- `context.beatConfidence` — worker confidence (fallback to PLL)
- `context.pllLocked` — propagated to Cassandra
- `context.syncopation` — estimated by SyncSmoother

#### 3.2.4 Priority Chain

```
1. Worker active (conf > 0.5)    → acceptedBpm (hysteresis-filtered)
2. Worker silent + memory recent  → lastStableWorkerBpm (freewheel)
3. No memory / timeout expired     → Pacemaker internal (120 default)
```

### 3.3 Cassandra / Selene — Predictive Intelligence

**Files:**
- `electron-app/src/core/intelligence/think/PredictionEngine.ts`
- `electron-app/src/core/intelligence/sense/MusicalPatternSensor.ts`
- `electron-app/src/core/intelligence/types.ts`

#### 3.3.1 BPM Consumption

Cassandra receives BPM via `MusicalPatternSensor` which reads from the `MusicalContext`:

```typescript
interface MusicalPattern {
  bpm: number
  bpmConfidence: number
  pllLocked: boolean  // WAVE 7002: real PLL state, not re-derived
  beatPhase: number
  // ...
}
```

#### 3.3.2 PLL Lock in Prediction Engine

The `PredictionEngine` uses `pllLocked` directly (WAVE 7002 F10):

```typescript
const pllLock = pattern.pllLocked ? 1.0 : (pattern.bpmConfidence > 0.5 ? 0.5 : 0.0)
confidence *= (0.55 + 0.45 × pllLock)
```

When PLL is unlocked, confidence collapses to 55% of base — any time-based prediction becomes unreliable. When locked, confidence reaches 100% of base.

#### 3.3.3 Fluid Timing Engine

ETA to predicted events uses BPM and beat phase:

```typescript
const msPerBeat = 60000 / safeBpm
const msToNextBeat = (1 - beatPhase) × msPerBeat + wholeBeats × msPerBeat
```

The beat phase anchor connects the prediction timeline to the physical audio grid.

#### 3.3.4 Selene (Sovereign Clock)

`SeleneTitanConscious.ts` uses the musical context for:
- **Sovereign Clock window:** `[predictedEventAt, +500ms]` — fires pre-buffered effects aligned to predicted drops
- **Glass Break sensor:** Aborts countdown if energy z-score ≥ 2.5 and rawEnergy > 0.55 before the predicted time
- **Cooldown management:** Genre-specific effect cooldowns are beat-count-based, derived from BPM

### 3.4 Chronos — Timeline Synchronization

**Files:**
- `electron-app/src/chronos/core/ChronosEngine.ts`
- `electron-app/src/chronos/core/ChronosStore.ts`
- `electron-app/src/chronos/utils/bpmDerivation.ts`

#### 3.4.1 Project BPM

Chronos stores a static `detectedBpm` in the project file (`LuxFileV3.audio.detectedBpm`). This is set during analysis import and does NOT update in real-time from the worker.

```typescript
const bpm = this.project?.runtimeBpm ?? this.project?.audio?.detectedBpm ?? 120
this.clockSources.tickMIDIMaster(bpm)
```

#### 3.4.2 MIDI Clock BPM Derivation

For MIDI Clock sync (external hardware), Chronos uses `bpmDerivation.ts`:

- **24 PPQ** (pulses per quarter note)
- **Sliding window:** 8 beat intervals
- **Median-filtered outlier rejection:** Intervals deviating >15% from window median are excluded
- **Hysteresis:** Only report if delta ≥ 0.5 BPM
- **Clamp:** [20, 300] BPM, 1-decimal precision

This is a completely separate BPM detection path from the worker — it derives BPM from incoming MIDI Clock pulses, not from audio analysis. The two paths are independent and do not cross-contaminate.

#### 3.4.3 Timeline Locking

The Chronos timeline is **time-based** (ms), not beat-based. Clips are positioned at absolute time positions. BPM is used for:
- MIDI Clock Master tick rate
- Beat grid display in the UI
- Quantization snap (optional)

**The timeline engine does NOT lock its playback position to the real-time BPM from the worker.** Playback is driven by `tick(currentTimeMs)` from the audio playback position. BPM is metadata, not a clock signal for timeline playback.

### 3.5 Hephaestus FX — Timeline-Driven, BPM-Isolated

**File:** `electron-app/src/core/hephaestus/runtime/HephaestusRuntime.ts`

**Zero references to `bpm`, `beatPhase`, `onBeat`, or `beatCount`.**

Hephaestus effects are evaluated purely from timeline position (`currentTimeMs` within the clip). Curve evaluation uses keyframe interpolation (linear, ease, bezier) over normalized time `[0, 1]` within the clip duration.

**Timing source:** `HephaestusRuntime.tick(currentTimeMs)` called by `TickEngine` with the audio playback position. No beat synchronization.

**Cognitive DNA:** Effect parameters (strobe rate, intensity, color transitions) are driven by the `.lfx` file's curve definitions, not by real-time BPM. The `textureAffinity` field (Clean/Universal/Dirty) modulates how effects respond to audio energy, but this is energy-driven, not beat-driven.

### 3.6 Omniliquidengine (LiquidEngine71) — Physics, BPM-Isolated

**File:** `electron-app/src/hal/physics/LiquidEngine71.ts`

**Zero references to `bpm`, `beatPhase`, `onBeat`, or `beatCount`.**

The LiquidEngine is a physics simulation for fluid-like lighting movement. It operates on:
- Spring-mass-damper systems per fixture parameter
- Envelope generators (ADSR) triggered by energy thresholds
- Stereo field panning based on spectral balance

**Timing source:** Internal clock based on `deltaTime` between ticks. No beat synchronization.

### 3.7 VMM / IK — Spatial Movement, BPM-Isolated

**File:** `electron-app/src/engine/movement/VibeMovementManager.ts`

**Zero references to `bpm`, `beatPhase`, `onBeat`, or `beatCount` in the entire `src/core/aether/` directory or `src/engine/movement/` directory.**

The VibeMovementManager generates movement intents based on:
- Vibe-specific parameters (tiltScale, baseFreq, panRange)
- Perlin noise / sine oscillators driven by internal clock
- Fixture mount orientation (floor, ceiling, truss, totem)
- Tilt offsets and ceilings per vibe

**Movement is entirely decoupled from BPM.** The VMM uses its own oscillators with vibe-specific frequencies. There is no beat-sync mechanism in the spatial movement system.

**IK (InverseKinematicsEngine):** Also BPM-free. Operates on spatial targets (targetX, targetY, targetZ) and mount geometry. Manual IK (`_writeNodeIK`) is triggered by user input, not by beat events.

---

## 4. THE WEAK POINTS — Autocorrelation Injection Targets

### 4.1 Root Cause of ±4 BPM Jitter

The current BPM detection chain has **five mathematical bottlenecks** that contribute to jitter:

#### Bottleneck 1: Single-Interval BPM Estimation

**Location:** `IntervalBPMTracker.process()` — line where `rawBpm = 60000 / interval`

Each kick produces a single interval measurement. At 128 BPM (469ms), a ±10ms timing error in kick detection produces ±2.7 BPM. At 60 BPM (1000ms), the same ±10ms produces only ±0.6 BPM. The problem is **inversely proportional to BPM** — faster tempos are more sensitive to timing errors.

**Root cause of timing error:** The needle signal is derived from frame-to-frame energy delta. The frame rate is ~20 fps (50ms), so the kick detection timestamp has ±25ms quantization error. This is the dominant jitter source.

**Autocorrelation fix:** Instead of relying on a single interval, autocorrelation over the onset detection function (ODF) finds the **period that maximizes self-similarity** across the entire history. This averages out individual timing errors and is robust to missed kicks.

#### Bottleneck 2: Median Over Only 8 Samples

**Location:** `IntervalBPMTracker.computeMedianBpm()` — `bpmHistory` buffer

The median is computed from 8 BPM estimates. With 8 samples, the median has a resolution of 1/8 = 12.5% of the range. If the BPM estimates span 120-130, the median jumps in 1.25 BPM steps. This is the source of the characteristic **±4 BPM quantization** observed in the output.

**Allocation:** `[...bpmHistory].sort()` creates a new array every frame.

**Autocorrelation fix:** Autocorrelation produces a continuous BPM estimate from the peak of the ACF, not from discrete median bins. The resolution is limited by the lag resolution (1 frame = ~50ms = ~0.6 BPM at 128 BPM), but interpolation can refine this to sub-frame precision.

#### Bottleneck 3: Energy-Envelope Autocorrelation (Existing) is Misaligned

**Location:** `IntervalBPMTracker.validateWithAutocorrelation()` — runs on `energyHistory` (raw bass energy per frame)

The existing autocorrelation validator runs on the **raw energy envelope**, not on the **onset detection function (ODF)**. The energy envelope contains:
- The kick attack (sharp rise)
- The kick decay (exponential tail, 3-5 frames)
- The bass line between kicks (sustained energy)

Autocorrelation on the energy envelope finds the period of the **bass line**, not the period of the **kick pattern**. These can differ (e.g., a bass line playing 16th notes while kicks play quarter notes).

**Fix:** Run autocorrelation on the **needle signal** (the output of `GatedNeedlePipeline.processNeedle()`). The needle is already half-wave rectified and centroid-gated — it's a clean ODF. Autocorrelation on the ODF directly finds the kick period.

#### Bottleneck 4: AdaptiveFloorTracker Uses `number[]` with `push`/`shift`

**Location:** `AdaptiveFloorTracker.update()` — `floorBuffer.push()` and `floorBuffer.shift()`

`Array.push()` and `Array.shift()` on a `number[]` cause:
- Potential array resizing (amortized O(1), but occasional O(N) reallocation)
- `shift()` is always O(N) — it moves all elements down by one

With a 64-element buffer, this is 64 element moves per frame. Not catastrophic, but not zero-alloc.

**Fix:** Replace with a circular buffer using a `Float64Array` and an index pointer. The median can be computed by copying into a pre-allocated sorted buffer.

#### Bottleneck 5: Kalman Filter Measurement Gating is Binary

**Location:** `IntervalBPMTracker` — Kalman update with 15 BPM gate

The Kalman filter accepts or rejects measurements based on a hard 15 BPM threshold. If the median BPM jumps from 128 to 143 (within threshold), it's accepted. If it jumps to 144 (just over), it's rejected. This creates a **discontinuous acceptance boundary** that can cause the filtered BPM to stick at one value when it should be drifting.

**Fix:** Use a soft gating function (e.g., Gaussian likelihood) instead of a hard threshold. The Kalman update weight should decrease smoothly as the measurement deviates from the prediction.


## APPENDIX A: Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ WORKER THREAD (senses.ts)                                       │
│                                                                 │
│  Audio Input (SAB or IPC)                                       │
│       ↓                                                         │
│  AudioRingBuffer.writeAndSnapshot()                             │
│       ↓                                                         │
│  SpectrumAnalyzer.analyze()                                     │
│       ↓                                                         │
│  GodEarAnalyzer.analyze()                                       │
│    ├── DC Removal → Blackman-Harris Window → FFT                │
│    ├── Power Spectrum → LR4 Band Masks → Band Energies          │
│    ├── SI Crossfade → bandsRaw (subBass, bass)                  │
│    ├── AGC Trust Zones → bands (for UI)                         │
│    ├── Spectral Flux V3                                         │
│    └── Transient Detection (onset detector)                     │
│       ↓                                                         │
│  SpectrumResult (psychoacoustic-scaled + raw bands)             │
│       ↓                                                         │
│  BPMService.processFrame()                                      │
│       ↓                                                         │
│  RhythmTracker.process()                                        │
│    ├── AdaptiveFloorTracker.update(rawBassFlux) → floor         │
│    ├── GatedNeedlePipeline.processNeedle() → needle             │
│    │     ├── Brute Force Flux (rising edges)                    │
│    │     ├── Centroid Gate (< 800Hz = kick)                     │
│    │     └── Sniper Guard (> 1500Hz = kill)                     │
│    └── IntervalBPMTracker.process(needle, rawBass, ts)          │
│          ├── Ratio-based kick detection (1.6× threshold)        │
│          ├── Adaptive debounce (0.40 × beat interval)           │
│          ├── Peak discriminator                                 │
│          ├── Interval → BPM (60000 / interval)                  │
│          ├── Outlier rejection (0.5× – 2.0× window)             │
│          ├── BPM history (8 samples) → median                   │
│          ├── Confidence (IQR-based)                             │
│          ├── Autocorrelation validator (64 samples, energy)     │
│          ├── Kalman filter (2D state, adaptive R)               │
│          └── Dance pocket folding (vibe-dependent)              │
│       ↓                                                         │
│  BPMOutput { bpm, rawBpm, confidence, beatPhase, kickDetected } │
│       ↓                                                         │
│  buildPayload() → ExtendedAudioAnalysis                         │
│       ↓                                                         │
│  parentPort.postMessage(ExtendedAudioAnalysis)                  │
│       ↓ (structured clone)                                      │
└─────────────────────────────────────────────────────────────────┘
       ↓ IPC
┌─────────────────────────────────────────────────────────────────┐
│ MAIN THREAD                                                      │
│                                                                 │
│  AudioPipelineManager                                           │
│    ├── lastAudioData = { workerBpm, workerConfidence, ... }     │
│    ├── checkStaleness() with grace period                       │
│    └── tickBeatDetector(now, frameCount)                        │
│         ├── Worker BPM > 0 + conf > 0.2 → setBpm()              │
│         ├── Worker silent + memory → freewheelAt()              │
│         └── beatDetector.tick(now) → BeatState                  │
│              ├── PLL phase advance (flywheel)                   │
│              ├── PLL phase correction (PI on feedKick)          │
│              ├── Anticipatory onBeat (23ms lookahead)           │
│              └── Silence veil (no onBeat when unlocked)         │
│       ↓                                                         │
│  TickEngine.tick()                                              │
│    ├── BPM Stabilization Shield (8% hysteresis, 60 frames)      │
│    ├── Phase crossfade (8 frames, PLL ↔ worker)                 │
│    ├── context.bpm = acceptedBpm                                │
│    ├── context.beatPhase = crossfaded phase                     │
│    ├── context.pllLocked = beatState.pllLocked                  │
│    └── context.isBeat = workerOnBeat || (pllLocked && onBeat)   │
│       ↓                                                         │
│  MusicalContext → all consumers:                                │
│    ├── Cassandra (PredictionEngine) → pllLock confidence        │
│    ├── Selene (Sovereign Clock) → drop prediction windows       │
│    ├── SyncSmoother → EMA on spectral metrics                   │
│    ├── SectionTracker → wave8 analysis                          │
│    └── Aether adapters → lighting output                        │
│                                                                 │
│  INDEPENDENT (no BPM):                                          │
│    ├── HephaestusRuntime ← timeline currentTimeMs only          │
│    ├── LiquidEngine71 ← internal deltaTime only                 │
│    ├── VibeMovementManager ← internal oscillators only          │
│    └── InverseKinematicsEngine ← spatial targets only           │
│                                                                 │
│  CHRONOS (separate BPM path):                                   │
│    ├── ChronosEngine → project.runtimeBpm (static)              │
│    └── MIDI Clock → bpmDerivation (24 PPQ, 8-beat window)       │
└─────────────────────────────────────────────────────────────────┘
```

---

## APPENDIX B: Key Constants Reference

| Constant | Value | File | Purpose |
|----------|-------|------|---------|
| `FFT_SIZE` | 4096 | GodEarFFT.ts | FFT window size |
| `ENERGY_RATIO_THRESHOLD` | 1.6 | IntervalBPMTracker.ts | Kick ratio threshold |
| `MIN_INTERVAL_MS` | 200 | IntervalBPMTracker.ts | Min kick interval (300 BPM) |
| `MAX_INTERVAL_MS` | 1500 | IntervalBPMTracker.ts | Max kick interval (40 BPM) |
| `DEBOUNCE_FACTOR` | 0.40 | IntervalBPMTracker.ts | Adaptive debounce ratio |
| `BPM_HISTORY_SIZE` | 8 | IntervalBPMTracker.ts | Median buffer size |
| `AUTOCORRELATION_HISTORY_SIZE` | 64 | IntervalBPMTracker.ts | ACF validator buffer |
| `ADAPTIVE_FLOOR_WINDOW` | 64 | AdaptiveFloorTracker.ts | Floor median window |
| `ADAPTIVE_FLOOR_RATIO` | 0.40 | AdaptiveFloorTracker.ts | 40% of median |
| `KICK_RATIO_THRESHOLD` | 1.4 | BeatDetector.ts | Legacy kick ratio (dormant) |
| `PLL_PROPORTIONAL_GAIN` | 0.15 | BeatDetector.ts | PLL P gain |
| `PLL_INTEGRAL_GAIN` | 0.005 | BeatDetector.ts | PLL I gain |
| `PLL_FREQUENCY_GAIN` | 0.08 | BeatDetector.ts | PLL frequency feedback |
| `PLL_SOFT_CORRECTION_WINDOW_MS` | 120 | BeatDetector.ts | Soft vs hard correction |
| `PLL_LOOKAHEAD_MS` | 23 | BeatDetector.ts | Anticipatory beat firing |
| `PLL_BEAT_WINDOW` | 0.12 | BeatDetector.ts | onBeat phase window |
| `PLL_SILENCE_TIMEOUT_MS` | 4000 | BeatDetector.ts | Freewheel timeout |
| `BPM_HYSTERESIS_PCT` | 0.08 | TickEngine.ts | 8% delta triggers confirmation |
| `BPM_CANDIDATE_CONFIRM_FRAMES` | 60 | TickEngine.ts | ~2s confirmation window |
| `BPM_EMA_ALPHA` | 0.15 | TickEngine.ts | EMA smoothing |
| `PHASE_CROSSFADE_FRAMES` | 8 | TickEngine.ts | PLL/worker phase crossfade |
| `BPM_WINDOW_SIZE` | 8 | bpmDerivation.ts | MIDI clock sliding window |
| `BPM_HYSTERESIS` | 0.5 | bpmDerivation.ts | MIDI clock report threshold |
| `BPM_MEDIAN_REJECT_RATIO` | 0.15 | bpmDerivation.ts | MIDI clock outlier rejection |

---

## APPENDIX C: Allocation Audit

| Component | Hot-Path Allocations | Severity |
|-----------|---------------------|----------|
| GodEarFFT.analyze() | **Zero** — all buffers pre-allocated | ✅ Clean |
| SpectrumAnalyzer.analyze() | **Zero** — wraps GodEar, returns object literal (V8 optimizes) | ✅ Clean |
| GatedNeedlePipeline.processNeedle() | **Zero** — pure function, returns object literal | ✅ Clean |
| AdaptiveFloorTracker.update() | `number[].push()` + `number[].shift()` + `.slice().sort()` | ⚠️ Fixable |
| IntervalBPMTracker.process() | `[...bpmHistory].sort()` (median + IQR) + `number[].push()/shift()` | ⚠️ Fixable |
| IntervalBPMTracker ACF validator | `number[]` operations + sort | ⚠️ Fixable |
| Kalman filter | Matrix operations with object literals | ⚠️ Low priority |
| SensesPipeline.processFrame() | `buildPayload()` constructs new object | ⚠️ Unavoidable (IPC) |
| IPC postMessage() | Structured clone of ExtendedAudioAnalysis | ⚠️ Unavoidable |
| BeatDetector.tick() | `{ ...this.state }` spread | ⚠️ Low frequency |
| TickEngine.tick() | No direct allocations in BPM path | ✅ Clean |

**Priority fixes for zero-alloc:**
1. `AdaptiveFloorTracker` → circular `Float64Array` buffer
2. `IntervalBPMTracker` median computation → pre-allocated sorted buffer
3. `IntervalBPMTracker` BPM history → circular `Float64Array` buffer
4. `IntervalBPMTracker` ACF validator → `Float64Array` + pre-allocated ACF output

---

*End of audit. This document is designed for consumption by a DSP AI to design a zero-alloc autocorrelation engine that replaces the interval-median approach in `IntervalBpmTracker`.*
