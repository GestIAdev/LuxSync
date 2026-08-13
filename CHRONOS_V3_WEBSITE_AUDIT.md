# Chronos V3 Timecoder — Technical Architecture Audit

**Subject:** LuxSync `chronos/` module + GodEar V3 DSP core
**Scope:** Offline ("cold work") studio pre-programming timeline. Live-performance paths are out of scope except where they share code.
**Method:** Full static read of `electron-app/src/chronos/**`, `electron-app/src/workers/GodEarFFT.ts`, `electron-app/src/workers/IntervalBPMTracker.ts`, and `electron-app/electron/ipc/ChronosIPCHandlers.ts`.
**Classification:** Engineering evaluation. Citations are `file:line` against the audited tree.

---

## 1. Architectural Overview

### 1.1 The dual-representation model

Chronos separates the **persisted artifact** from the **runtime artifact** at the type level, not by convention. Two interfaces are declared in the same module:

| Representation | Type | Mutability | Contains |
|---|---|---|---|
| On disk | `LuxFileV3` (`LuxFileV3.ts:378-408`) | `readonly` on every top-level field | schema discriminator, meta, audio ref, embedded analysis, tracks, markers, safety, checksum |
| In memory | `ChronosProjectV3` (`LuxFileV3.ts:441+`) | fully mutable | all of the above **plus** ephemeral edit state (`runtimeBpm`, `manualBpmOverride`, selection, dirty flags) never written to disk |

The transition is explicit and one-directional: *strip runtime fields → recompute checksum → `LuxFileV3`*. This is the correct shape for a file-format-first design. The header comment states the governing principle plainly — "este schema es la CONSTITUCIÓN: se define primero, los consumidores se adaptan después" (`LuxFileV3.ts:9-11`). In practice the codebase honours it: the schema module has no imports from the UI layer, and `ChronosEngine` consumes `LuxTrackV3`/`LuxClipV3` directly rather than a UI-side mirror type (`ChronosEngine.ts:35`).

Two architectural consequences are worth naming:

1. **Self-containment.** FX clips embed a complete `HephAutomationClipV3` (`LuxFileV3.ts:105`). `hephFilePath` is declared reference-only and explicitly *not* loaded at runtime (`LuxFileV3.ts:107-108`). A `.lux` therefore travels without a dependency graph — no missing-asset failure mode at showtime. This is a deliberate rejection of the reference-based project model used by most DAW-derived tools.
2. **Analysis is part of the document.** `LuxAnalysisV3` (`LuxFileV3.ts:304-328`) persists the full beat grid, sections, transients, 7-band heatmap, and downsampled waveform *inside* the project file. Opening a saved show requires zero re-analysis. The cost is file size (§4.4).

### 1.2 `ClipBoundaryIndex`

The naive active-clip query is `O(tracks × clips)` per frame. `ClipBoundaryIndex` (`ChronosEngine.ts:140-229`) replaces it with a two-structure index built once per project mutation:

- `boundaries[]` — a flat, time-sorted array of `{timeMs, clipId, type: 'start'|'end'}` events, two per clip (`ChronosEngine.ts:170-171`, sorted at `:175`).
- `clipEntries[]` — `{clip, track, startMs, endMs}` tuples sorted by `startMs` (`:176`).

The per-frame path is a **negative cache guarded by a boundary-crossing test**:

```
queryWithTrack(t):
  if cachedActivePairs != null && !hasCrossedBoundary(lastQueryTime, t):
      return cachedActivePairs        // O(1)
  ... rebuild ...
```

`hasCrossedBoundary` (`ChronosEngine.ts:210-223`) is a lower-bound binary search over `boundaries[]` followed by a bounded linear advance, answering "is there any boundary event in `(lo, hi]`?" in `O(log n)`. Since a 60 fps playhead advances ~16.7 ms and a typical show has boundary events seconds apart, the overwhelming majority of frames take the `O(1)` cache-hit path.

Two implementation details deserve credit:

- The cache stores **resolved `{clip, track}` pairs**, not bare clips. The commit note (`ChronosEngine.ts:143-147`) documents that an earlier revision cached only clips and re-derived the track pairing via `clipEntries.find()` on every cache hit — an `O(m × n)` per-frame regression. Caching the resolved pairing makes the hit path strictly `O(m)` with zero searching. This is the kind of defect that only surfaces under profiling, and it was found and fixed.
- Staleness is detected by **reference identity** on the tracks array (`isStale`, `ChronosEngine.ts:179-181`), which composes correctly with the store's immutable-update discipline. No versioning counter, no manual invalidation contract.

One honest caveat: the *rebuild* path (`ChronosEngine.ts:191-207`) is a linear scan of `clipEntries` with an early `break` once `entry.startMs > timeMs`. It is `O(k)` where `k` is the number of clips starting at or before the playhead — not `O(log n + m)`. On a long show scrubbed to the final minute, a boundary crossing walks nearly the entire clip list. See §6.4.

Adjacent to this, automation evaluation uses the same caching philosophy: `getSortedPoints` is a `WeakMap` keyed by the points-array reference (`ChronosEngine.ts:91-105`), eliminating a per-lane per-frame `[...points].sort()`, and segment lookup is a binary search (`evaluateAutomationLane`, `ChronosEngine.ts:328-345`). Interpolation supports step / linear / ease-in / ease-out / ease-in-out / smoothstep / cubic Bézier with explicit handle offsets (`ChronosEngine.ts:238-301`).

### 1.3 React / RAF decoupling

The timeline does **not** drive the playhead through React state. The pattern is consistent across the UI layer:

- The engine owns a single `requestAnimationFrame` loop (`ChronosEngine.ts:976-984`) that calls `updateTime()` then `emitContext()`. It emits events; it does not call `setState`.
- `TimelineCanvas` receives `currentTimeRef` as a **ref prop** (`TimelineCanvas.tsx:51`) and mutates DOM/SVG attributes inside its own RAF loop (`TimelineCanvas.tsx:545-566`). The React tree does not re-render at 60 fps.
- Live recording uses the same trick: `growingClipEndMs` is passed by ref so a clip can visually extend during capture without a reconciliation pass (`TimelineCanvas.tsx:78-79, 1388-1393`).
- `useStreamingPlayback` updates `currentTimeMsRef` inside RAF with no `setState` (`useStreamingPlayback.ts:143-152`).
- The store (`ChronosStore.ts:143`) is a hand-rolled class with a `Map<EventType, Set<Callback>>` subscription registry (`:157`) — not Zustand, despite some stale comments. Critically, **it does not update during playback**; it mutates only on user action. Transport position is never store state, so the decoupling is structural rather than a discipline that a future contributor could accidentally violate.

The clock hierarchy inverts cleanly: `updateTime()` consults the external clock source first, falls back to `AudioContext.currentTime`, and only then to wall clock (`ChronosEngine.ts:995-1010`). Timeline position is derived, never authoritative.

Rendering is a deliberate hybrid: SVG for structural elements and clips (`TimelineCanvas.tsx:294-448`, `ClipRenderer.tsx`), Canvas 2D for the waveform/heatmap (`WaveformLayer.tsx:267-465`). SVG buys hit-testing and CSS styling for the interaction-heavy layer; canvas buys throughput for the pixel-heavy layer. This is a defensible split, not an accident.

Downstream, `ChronosInjector` (`ChronosInjector.ts:222-268`) translates `ChronosContext` into `ChronosOverrides` for TitanEngine. The bridge is a pure transform with a clip-ID→instance-ID map (`:234`) and an enable flag (`:237`) — the timeline never touches the effect runtime directly.

---

## 2. DSP & Acoustic Intelligence (GodEar V3)

The offline analyzer is not a separate simplified engine. `analysisPipeline.ts:29` imports `GodEarAnalyzer` from `src/workers/GodEarFFT.ts` — the same 2,800-line class used by the live Senses worker — and reconfigures it for deterministic batch operation via `analyzer.configure({ useAGC: false, useStereo: false })` (`analysisPipeline.ts:173`). Offline and live share one spectral truth. That is the single most important design decision in this section.

### 2.1 FFT core

**Algorithm:** iterative Cooley-Tukey radix-2 decimation-in-time, `computeFFTCore` at `GodEarFFT.ts:604-646`.

- **Bit-reversal permutation** via a precomputed lookup table (`:533-548`) held as a module singleton (`:553-559`). No per-call index arithmetic.
- **Twiddle factors** precomputed into two `Float32Array(2048)` tables (`:573-584`, ~16 KB), indexed by `j * stride` inside the butterfly. No `Math.cos`/`Math.sin` in the inner loop.
- **Out-of-place** into preallocated `outReal`/`outImag`.
- **Window:** Blackman-Harris 4-term, `a₀=0.35875, a₁=0.48829, a₂=0.14128, a₃=0.01168` (`:325-330`), applied as `w[n] = a₀ − a₁cos(2πn/N) + a₂cos(4πn/N) − a₃cos(6πn/N)` (`:399`). Correct coefficients for the −92 dB sidelobe variant.

**Verification is real.** A reference radix-2 implementation lives in `GodEarFFT.radix2.ts:47-83` with a self-test suite (`:176-254`) validating against a brute-force DFT. `src/workers/GodEarFFT.test.ts` checks Parseval energy conservation, linearity, and phase accuracy across N=4…4096. `src/chronos/__tests__/GodEarFFT.test.ts` adds frequency-discrimination tests at 40/100/1000/8000/15000 Hz (`:186-234`) and a bit-perfect determinism test (`:360-395`). Determinism testing on an FFT path is uncommon and directly relevant to an offline tool where re-analysis must be reproducible.

**Two objective findings:**

- *No real-input optimization.* The imaginary array is zero-filled (`:611`) and a full complex FFT is computed. A real-input split-radix or the standard N/2-complex packing would roughly halve the cost. For an offline batch pass this is a throughput choice, not a correctness issue — but it is ~2× of available headroom left on the table.
- *Window coherent gain is not compensated.* `BLACKMAN_HARRIS_COHERENT_GAIN = 0.35875` is declared (`:333`) but never applied; the power-spectrum normalization at `:658` uses `nf² = (2/N)²` only. The result is a systematic ~2.79× amplitude underestimate across all bands. The pipeline compensates empirically downstream via per-band peak normalization (§2.5), so the *shape* of the analysis is correct and the *absolute* calibration is not. Any consumer that treats band values as physical amplitudes will be wrong by a constant factor.

### 2.2 LR4 band separation

This is the most frequently mischaracterized part of the system, so state it precisely: **the "Linkwitz-Riley 4th-order crossovers" are not a time-domain biquad cascade.** They are frequency-domain magnitude masks applied to the FFT power spectrum.

`linkwitzRileyResponse` (`GodEarFFT.ts:708-729`):

```
ratio8 = (f / fc)^8           // 4th-order squared
lowpass  →  1 / (1 + ratio8)
highpass →  ratio8 / (1 + ratio8)
```

Band masks are the product of a highpass at the lower crossover and a lowpass at the upper (`:743-767`), then applied bin-wise in `extractBandPower` (`:836`).

Assessment: the `ratio^8` expression **is** the correct magnitude-squared response of an LR4 (cascaded Butterworth) network. For an energy-extraction application, where only `|X(f)|²` is consumed, the frequency-domain mask is mathematically equivalent to the time-domain filter's magnitude behaviour and vastly cheaper — no per-band biquad state, no per-band time-domain pass. It is the right engineering call for this problem.

What it does **not** provide is LR4's defining property: the phase-coherent, in-phase summation at crossover that makes LR4 the standard for loudspeaker networks. Filtered bands here cannot be summed back to the original signal with correct phase. Since nothing in Chronos reconstructs a time-domain signal from the bands, this is a naming imprecision rather than a defect — but the whitepaper claim should read "LR4-equivalent magnitude response" rather than "LR4 crossovers."

The 7 tactical bands (`GodEarFFT.ts:265-315`), with adjacent, non-overlapping crossovers:

| Band | Range | Musical role |
|---|---|---|
| `subBass` | 20–60 Hz | kick fundamental, seismic |
| `bass` | 60–250 Hz | kick body, bassline |
| `lowMid` | 250–500 Hz | warmth, low body |
| `mid` | 500–2000 Hz | vocal, snare core |
| `highMid` | 2000–6000 Hz | presence, attack |
| `treble` | 6000–16000 Hz | hi-hats, brightness |
| `ultraAir` | 16000–22000 Hz | air, harmonics |

Band separation is explicitly tested (`chronos/__tests__/GodEarFFT.test.ts:311-322`).

### 2.3 Transient extraction

`SlopeBasedOnsetDetector` (`GodEarFFT.ts:1690-1828`) is a **rate-of-change** detector, not a level detector — the correct choice, since it does not fire on gradual crescendi.

- 8-sample circular energy history (`:1693`).
- Short-term slope `current − previous`, long-term slope `current − older` (`:1789-1790`).
- Threshold `max(avgEnergy × 0.05, avgEnergy × 0.3)` (`:1800`); onset requires `shortSlope > threshold && longSlope > threshold × 0.5` (`:1802`).
- 80 ms per-band refractory (`:1713, :1808`).

Instrument isolation is achieved by feeding the detector three different band mixes (`GodEarFFT.ts:2359-2361`):

```
kick  ← subBass + bass × 0.5
snare ← mid     + lowMid × 0.5
hihat ← treble  + highMid × 0.3
```

The offline pipeline harvests these **in the same pass as the heatmap** (`analysisPipeline.ts:259-283`), with a second 80 ms debounce per instrument (`:211-215`). This eliminates a separate raw-sample pass; the legacy single-band `detectTransients()` remains in the file but is explicitly marked `@deprecated` and is no longer called (`analysisPipeline.ts:798-812`). Dead-code discipline is good: the function was demoted rather than silently left in the call graph.

*Objective weakness:* thresholds are fixed percentages, not adaptive. The `0.05 / 0.3 / 0.5 / 0.3` band-mix coefficients are uncalibrated magic constants with no derivation in comment or test. A median-adaptive threshold (the standard for offline onset detection, where lookahead is free) would be strictly better here — see §6.2.

Note also that `computeSpectralFlux` (`:1234-1254`) implements a properly half-wave-rectified, peak-hold-whitened flux with a 0.995 decay — a textbook-correct onset function — but it is consumed only by the strobe drive path (`:1345`), **not** by the onset detector. The pipeline has a better onset function than the one it uses.

### 2.4 Spectral features and semantic section enrichment

Per-frame features, all standard formulations:

- **Centroid** — `Σ f[k]·P[k] / Σ P[k]`, DC bin excluded (`GodEarFFT.ts:875-896`).
- **Flatness** — geometric/arithmetic mean ratio with a `0.0001 × maxPower` floor to reject codec noise (`:920-954`). Computed in the *power* domain, so values run ~0.01–0.09 rather than the magnitude-domain 0.1–0.3. The code comments acknowledge this (`:905-911`); downstream thresholds are tuned to the power scale, so it is internally consistent but a trap for external consumers.
- **Rolloff** — 85th-percentile cumulative-energy frequency (`:968-995`).

Above these sit the **semantic telemetry** blocks, which are the genuinely differentiated part of GodEar V3:

- `saturation` — Saturation Index from the brickwall meter; used as a loudness-war/limiting proxy.
- `whiteNoiseScore` — `clamp((flatness − 0.10) / 0.10)` (`:2379`), i.e. a linear map from spectral flatness to a broadband-noise likelihood.
- `rhythmic_void` — `sqrt(snareVoid × hhVoid)` where each is a 3000 ms-normalized absence counter for the 150–250 Hz / 2–5 kHz snare pair and the 5–15 kHz hi-hat band (`RhythmicPercussionTracker`, `:1903-2095`, void at `:2072`). This is a *percussion-absence* metric, and it is the sharpest signal in the set.

`detectSections` (`analysisPipeline.ts:580-795`) then runs a **semantic-first, energy-fallback** classifier over 8-beat windows:

```
1. rhythmicVoid > 0.7                          → breakdown  (conf 0.90)
2. saturation > 0.6 ∧ relEnergy > 1.2          → drop       (conf 0.92)
3. whiteNoise > 0.4 ∧ nextEnergy > 1.15×       → buildup    (conf 0.85)
4. ── fallback: relative energy + centroid + subBass ──
   relE < 0.3 → breakdown | < 0.5 → bridge
   relE > 1.5 ∧ subBass > 0.3 → drop (0.95 if saturation confirms)
   relE > 1.2 → chorus (centroid-gated)
   first/last window → intro / outro
5. post-pass: energyRising ∧ (centroidRising ∨ rolloffRising) → buildup (0.95)
```

This ordering is well-reasoned. Rule 1 catches the case pure energy analysis always gets wrong — an ambient pad breakdown that is *loud* but has no drums. Rule 2 uses limiting as a proxy for "the producer intended this to be the loudest moment," which is a genuinely clever inference. Rule 5's requirement that *both* energy and spectral brightness rise before declaring a buildup correctly rejects a simple volume ramp. Confidence values propagate to `DetectedSection.confidence` and are preserved via `max()` on section extension (`:773`), so the UI can distinguish a 0.95 drop from a 0.70 verse.

The classifier's limitation is structural: window boundaries are quantized to 8 beats, so section edges are quantized to ~4–8 s. There is no boundary refinement pass, and no novelty-curve / self-similarity-matrix approach that would place edges to the beat.

### 2.5 Normalization and determinism

AGC is bypassed offline (`analysisPipeline.ts:173` → `GodEarFFT.ts:2284-2292` returns `scaledBands` directly). In its place the pipeline applies **per-band peak normalization across the whole track** after the FFT loop, with the rationale documented at `analysisPipeline.ts:311-323`: raw non-AGC RMS lands in the 0.01–0.05 range, while TitanEngine's `EngineAudioMetrics` contract expects 0–1. Without it, phantom-buffer injection would feed near-zero values and produce dead fixtures.

This is the correct trade for a cold-work tool. Live AGC is time-varying and therefore non-reproducible; whole-track peak normalization is deterministic and input-level independent — analyze the same file twice, get byte-identical results. The pipeline even logs raw pre-normalization peaks per band as a diagnostic (`:325-345`).

### 2.6 The offline BPM engine

This is the weakest link in the DSP chain, and it should be named as such.

`estimateBpm` (`analysisPipeline.ts:411-462`) is a 10 ms-quantized interval histogram over flux-peak onsets, taking the modal bin and octave-folding into [80, 180] BPM with a 10-iteration cap. `detectBeats` (`:472-564`) then brute-forces phase by scoring the first 20 onsets against a 10%-tolerance grid (`:516-529`), emits a constant-tempo grid, and hard-codes `timeSignature: 4` with a downbeat every 4 beats (`:540-543`).

Concretely, this engine cannot represent:
- **tempo drift** — the grid is a single scalar BPM extrapolated across the entire track;
- **any metre other than 4/4** — `timeSignature: 4` is a literal;
- **true downbeats** — "every 4th beat from `firstBeatMs`" is a counting convention, not detection;
- **swing or shuffle**, which will smear the interval histogram across adjacent bins.

The confidence metric (`:546-554`) is honest — it reports the fraction of onsets within 15% of a grid line — so the system at least *knows* when it is wrong. And a far better engine already exists in the repository: `IntervalBPMTracker.ts` has median smoothing (`:176`), IQR-based confidence (`:802-838`), a 1-D Kalman filter (`:647-674`), an autocorrelation cross-validator (`:695-757`), musical octave-folding including dotted-4:3 and tresillo-3:2 rules (`:846-923`), and 40–300 BPM range (`:94-98`). It is not wired into the offline path. See §6.1.

By contrast the **live** MIDI-clock BPM path is clean: an 8-beat sliding window with 0.5 BPM hysteresis, `[20,300]` clamping, and explicit `Number.isFinite` guards before every division (`bpmDerivation.ts:59-89`).

### 2.7 Execution model

`analyzeAudioFile` (`GodEarOffline.ts:75-99`) attempts a dedicated module Web Worker first, with a **zero-copy transferable** `Float32Array` handoff (`:183-193`), a 60 s watchdog (`:130-133`), and a seamless main-thread fallback with `yieldToEventLoop()` cooperative pumping if worker construction fails under CSP or bundler constraints. `GodEarOffline.ts` itself is a thin orchestrator — all extraction logic was consolidated into `analysisPipeline.ts` as a single source of truth, eliminating ~700 lines of duplication between the worker and fallback paths (`GodEarOffline.ts:14-19`). Both paths execute identical code, which means the fallback cannot silently diverge from the fast path. That property is worth more than it looks.

---

## 3. Protocol Stack & Synchronization

### 3.1 MTC — quarter-frame assembly and the +2 frame offset

`MTCParser.ts` implements the 8-piece quarter-frame state machine with an 8-slot buffer plus a `receivedPieces` bitmask (`:96-97`), decoding nibbles in the standard order (frames LS/MS, seconds LS/MS, minutes LS/MS, hours LS, hours MS + rate) at `:304-310`. Frame rate is recovered from bits 5–6 of piece 7 via `FRAME_RATE_MAP {24, 25, 29.97, 30}` (`:76-81`, `:312-314`).

**The +2 frame compensation** (`:325-342`) is the detail that separates a correct MTC implementation from a naive one, and it is right here. An 8-quarter-frame message spans exactly two frames of wall time; by the time piece 7 arrives, the encoded timecode is two frames stale. The parser adds 2 and carries through the full frame→second→minute→hour→24h cascade, using the *nominal* rate (30 for 29.97) for the wrap threshold (`:326`). Seven dedicated tests cover the offset including every wrap boundary and the 24-hour rollover (`MTCParser.test.ts:82-177`).

Equally correct: the SysEx full-frame path (`F0 7F 7F 01 01 hr mn sc fr F7`, `:352-373`) **does not** apply the offset, because a full-frame is an instantaneous locate, not a streaming assembly. The distinction is documented at `:300`. Getting both halves of this right is a strong signal.

Direction detection tracks piece-index adjacency modulo 8 (`:254-262`) and moves the assembly trigger from piece 7 to piece 0 during reverse (`:278-283`). Dropout is a 500 ms timeout that flips `connected` and emits a status event (`:73`, `:411-418`).

*Objective gap:* the +2 offset is applied unconditionally, including in reverse. Under reverse transport the correction should be −2, so reverse-shuttle position is off by 4 frames. There is no test coverage for reverse. MTC user bits are not parsed.

### 3.2 MIDI Clock and SPP locate

`MIDIClockSlave.ts` counts 24 PPQN and derives tempo on every 24th pulse from a timestamp ring buffer (`:210-217`), delegating to the shared `bpmDerivation` module.

**SPP handling** (`:190-204`) is exactly correct:

```
sppUnits    = (msb << 7) | lsb        // 14-bit, 16th-note units
targetPulses = sppUnits × 6           // 6 MIDI clocks per 16th
pulseCount  = targetPulses
totalBeats  = floor(targetPulses / 24)
clockTimestamps = []                  // discard stale intervals
resetBpmDerivation(bpmState)
```

Discarding the timestamp window on locate is the right call — intervals spanning a jump are meaningless and would corrupt the tempo estimate. Tests cover LSB/MSB assembly, SPP=0, the 16383 maximum, and clock continuation after locate (`MIDIClockSlave.test.ts:54-166`). START resets pulse and beat counters; CONTINUE preserves them; STOP clears the timeout (`:206-227`).

*Objective gaps:* the estimator is a plain mean, not a median — a single outlier interval from a jittery USB-MIDI stack pulls the estimate. There is no cumulative drift compensation, so a slightly-fast master accumulates error over a long show. SPP resets the BPM state, producing a brief instability window after every locate.

### 3.3 LTC AudioWorklet

`LTCDecoder.ts` runs a real SMPTE bi-phase-mark (Manchester) decoder inside an `AudioWorkletProcessor` (`:84`), delivered as an inline template string compiled to a Blob URL (`:76-299`, `:376-380`). No `ScriptProcessorNode` fallback, which is correct — `ScriptProcessorNode` runs on the main thread and would be unusable for bit-level timing.

The decode chain:
1. Zero-crossing detection on the raw sample stream, measuring pulse width in samples (`:114-123`).
2. Bi-phase classification against an adaptive bit period: a long pulse (> 0.75 × period) is a `0`; two consecutive short pulses summing to 0.6–1.4 × period are a `1` (`:131-197`).
3. Bit-period tracking by IIR with α = 0.05 (`:169, :179`) — self-clocking, so the decoder tolerates moderate speed variation.
4. 80-bit frame windowing with sync-word detection on **both** `0x3FFD` forward and `0xBFFC` reverse (`:53-57`, `:199-227`), with bit-order reversal for reverse frames (`:235-237`) — the decoder reads timecode while shuttling backwards.
5. Bit buffer capped at 240 bits and trimmed to 160 on overflow (`:190-193`).
6. Drop-frame flag read from bit 10 (`:244`), selecting 29.97 (`:512`).

**Drop-frame arithmetic is genuinely correct** — `smpteToMs` (`ClockSource.ts:185-213`) implements true SMPTE 12M:

```
droppedFrames = 2 × (totalMinutes − floor(totalMinutes / 10))
totalActualFrames = (h·3600 + m·60 + s)·30 + f − droppedFrames
ms = totalActualFrames / (30000/1001) × 1000
```

with tests at the 10-minute and 1-hour boundaries (`Protocols.test.ts:64-96`). Many commercial products get this wrong. This one does not.

*Objective gaps:* `AudioContext` is hard-pinned to 48 kHz (`:373`), which will fail on hardware that cannot honour that rate. The 0.75× pulse-classification threshold is fixed and will break at high shuttle speeds. There is no parity or CRC validation, so a single bit error corrupts an entire frame with no detection.

### 3.4 The PLL

`ClockSourceManager.applyPLL` (`:383-422`) is the smoothing stage between raw external timecode and the engine clock:

```
clampedDelta = clamp(rawTime − lastRawTime, ±5 ms)
predicted    = smoothed + wallElapsed
target       = smoothed + clampedDelta
smoothed     = predicted + 0.05 × (target − predicted)
```

with `PLL_ALPHA = 0.05` and `PLL_MAX_JUMP_MS = 5` (`:101-102`).

This is a **first-order IIR blend between a wall-clock extrapolation and a jump-limited observation** — not a phase-locked loop. It has no phase detector, no loop filter, and no frequency-tracking integrator. The in-code comment describing it as "second-order" (`:373`) is inaccurate.

That said, the structure it *does* have is well-chosen for the job. Predicting forward with `wallElapsed` means the clock keeps moving smoothly between discrete timecode arrivals, which is what makes 60 fps rendering look right when fed 25 fps MTC. The ±5 ms jump clamp rejects a single corrupt frame without a separate validity check. For frame-accurate offline programming this is adequate.

Its limitations under stress are real: no lock detection (nothing reports whether the filter has converged), no frequency tracking (a master running 0.1% fast is never compensated, only lagged), and **no freewheel** — on signal loss the PLL state is nulled outright (`:159-163`) rather than coasting on the last known rate. A momentary LTC dropout produces a hard stall rather than a graceful glide.

### 3.5 Source arbitration

`ClockSourceManager.setSource()` (`:113-147`) awaits `stop()` and cleanup on the outgoing source before starting the incoming one — a documented fix (P1.7) that prevents dual-clock emission during rapid switching — and falls back to the internal `AudioContext` clock if the new source fails to start (`:141-146`). Source registry covers MTC, Art-Net Timecode, LTC, MIDI Clock slave, and MIDI Clock master (outbound, ticked from the engine at `ChronosEngine.ts:1012-1014`).

There is no automatic failover, no priority ordering, and no signal-quality comparison across simultaneously-available sources. Selection is manual. For a studio programming tool this is acceptable; for a redundant show-control deployment it would not be.

---

## 4. Memory & Performance Profiling

### 4.1 The 60 fps render path

Verified characteristics:

- **Single authoritative RAF** in the engine (`ChronosEngine.ts:976-984`), with additional independent loops in `TimelineCanvas` (`:545-566`), auto-scroll (`:642-670`), and `useStreamingPlayback` (`:143-152`). `ChronosLayout.tsx:396-475` performs partial consolidation, but multiple loops remain. This is a coordination risk, not a throughput problem — a single scheduler with prioritized subscribers would be tighter (§6.5).
- **No React re-renders during transport** (§1.3). This is the load-bearing optimization and it holds.
- **`devicePixelRatio` scaling** on the waveform canvas (`WaveformLayer.tsx:545-555`). The SVG layer relies on native vector scaling, which is correct for SVG.
- **Waveform bar-count capping** at 200 bars per viewport regardless of zoom (`WaveformLayer.tsx:365-367`), which bounds per-frame draw-call count independent of track length.

Not present: dirty-region tracking, layered/double-buffered canvases, and `OffscreenCanvas`. The header comment at `WaveformLayer.tsx:12-15` describes an OffscreenCanvas pre-render strategy that was never implemented; the actual code performs a full redraw on every render pass. The comment should be corrected or the strategy implemented — currently it misrepresents the code.

### 4.2 GC pressure mitigations

The codebase demonstrates real, measured allocation discipline. Inventory:

| Mitigation | Location | Effect |
|---|---|---|
| Preallocated FFT window buffer | `analysisPipeline.ts:225-235` | ~3,600 allocations × 16 KB ≈ **57 MB of garbage eliminated** per 3-min track; reused via `.fill(0, copyLen)` + `.set()` |
| Zero-allocation analyzer hot path | `GodEarFFT.ts:2127-2178` | ~93 KB of instance buffers at N=4096 (`inputBuffer`, `dcBuffer`, `windowedBuffer`, `fftReal`, `fftImag`, `powerSpectrum`, `monoMixBuffer`, `chromaBuffer`, `prevPower`, `fluxWhitening`); `analyze()` mutates in place |
| Bit-reversal + twiddle LUT singletons | `GodEarFFT.ts:553-559, 573-584` | one-time, shared across instances |
| Spectral gradient cache | `WaveformLayer.tsx:174-217` | avoids per-frame `createLinearGradient` + `addColorStop` |
| Vignette gradient cache | `WaveformLayer.tsx:220-231` | same |
| Quantized HSL color cache | `WaveformLayer.tsx:238-253` | 5% quantization → ≤8,000 keys; kills per-bar string construction |
| Automation sort `WeakMap` | `ChronosEngine.ts:91-105` | eliminates 20 lanes × 60 fps = 1,200 array copies + sorts/sec |
| Clip pair cache | `ChronosEngine.ts:148, 185-189` | `O(1)` active-clip resolution on non-boundary frames |
| Transferable worker handoff | `GodEarOffline.ts:183-193` | zero-copy `Float32Array.buffer` transfer |
| Circular energy history | `analysisPipeline.ts:824` | fixed `Float32Array(8)`, no ring reallocation |

The 57 MB figure is not marketing — it is arithmetic that follows directly from the code change, and the commit comment shows the before/after explicitly.

**Residual allocation, honestly stated:**
- Gradient caches hold exactly **one** entry each, keyed on `(ctx, height[, intensity])`. Any height variation or intensity change thrashes them to a 0% hit rate. A small `Map` would fix this in a few lines.
- `colorCache` is a plain `Map` that is never evicted or cleared on unmount (`WaveformLayer.tsx:238`). Bounded at ~8,000 short strings, so it is a bounded retention, not an unbounded leak — but it survives the component and should be a `WeakMap` keyed on context or explicitly cleared.
- Grid-line arrays are reconstructed every render (`TimelineCanvas.tsx:223-292`) and beat-grid label strings are built per frame (`:330-357`). Both are recomputable-on-change data being recomputed unconditionally.
- `AGCTrustZone` uses `Array.push()`/`shift()` for its history (`GodEarFFT.ts:1587-1590`), breaking the zero-allocation guarantee that holds elsewhere in the analyzer. Bypassed offline, so it does not affect cold work — but it is inconsistent with the surrounding code.
- No object pooling anywhere.

### 4.3 File I/O — atomic writes

**This is the strongest area of the codebase.** Both the manual save and the 60-second autosave use full write-durability sequences in the main process (`electron/ipc/ChronosIPCHandlers.ts:324-342` and `:464-480`):

```js
const tmpPath = filePath + '.tmp'
const fileHandle = await fs.promises.open(tmpPath, 'w', 0o664)
try {
  await fileHandle.writeFile(request.json, 'utf-8')
  await fileHandle.sync()        // fsync — flush to physical media
} finally {
  await fileHandle.close()
}
await fs.promises.rename(tmpPath, filePath)   // atomic on POSIX and NTFS
```

The inline comments show the reasoning was arrived at deliberately: `writeFile` alone returns once data is in the OS page cache, so a power loss after `rename` could publish a zero-length or partial inode. The `fileHandle.sync()` closes that window so the rename only ever publishes durable bytes. Applying the identical pattern to autosave (documented as LAZARUS B-5) matters more than the manual path — an autosave that can be truncated by the crash it exists to survive is worse than no autosave.

This is production show-control-grade file handling. It is materially better than what several shipping lighting consoles do.

### 4.4 Data integrity

- **SHA-256 over canonical JSON.** `canonicalStringify` (`LuxFileV3.serializer.ts:29-71`) sorts object keys recursively at every depth so the digest is insertion-order independent; the checksum is computed with the `checksum` field blanked (`:104-108`), making verification idempotent. Prefix-tagged `sha256:<hex>`.
- **Cycle detection done correctly.** `sortKeysDeep` tracks the *current recursion path* in a `WeakSet` and calls `visited.delete(value)` on unwind (`:45-71`). The comment records that an earlier revision never deleted, which misclassified a DAG — two clips sharing one `zones` array — as circular and aborted the save with a false positive. This is a subtle bug that would only manifest on specific project topologies, and it was found and fixed.
- **Checksum mismatch is a hard error.** Corruption is not silently loaded (`:192-197`).
- **Deep structural validation.** `LuxFileV3.schema.ts` rejects rather than coerces: FX clips must carry an embedded `hephClip` at `schemaVersion '3.0'` with ≥1 track (`:114-128`), every automation track must have a non-empty `curve.keyframes` array with finite `timeMs` and non-null `value` on every keyframe (`:132-167`), clip intervals must satisfy `0 ≤ startMs < endMs` (`:106-111`), vibe `intensity` must lie in `[0,1]` (`:178-185`), and `targetZone`/`mixBus`/`type` are checked against closed sets (`:48-64`, `:207-209`). Errors and warnings are returned as structured lists rather than thrown, letting the loader set policy.
- **Versioned migration.** V2 payloads are detected by `looksLikeV2()` and migrated before validation, with a warning instructing a re-save to embed a checksum (`serializer.ts:161-190`).

Combined — canonical hashing, deep validation, hard corruption rejection, atomic+fsync writes, and a shadow autosave with mtime-based recovery prompting (`ChronosStore.ts:1008-1044`) — this is a coherent, defensible integrity story.

### 4.5 Persistence cost

`.lux` is pretty-printed JSON at 2-space indentation (`serializer.ts:122`) with the full analysis embedded. At the default 50 ms heatmap resolution, a 4-minute track produces ~4,800 frames × 15 numeric arrays (7 bands + energy/bass/high/flux + centroid/flatness/saturation/whiteNoise/rhythmicVoid/rolloff) plus a 100 Hz waveform (24,000 peak + 24,000 RMS values). At ~18 bytes per JSON float, that is on the order of **several megabytes of analysis per song**, uncompressed, with no numeric precision reduction.

The trade is deliberate — instant project open, no re-analysis, fully self-contained files — and for a studio tool it is the right side of the trade. But it forces the entire dataset through `JSON.parse` and the recursive `sortKeysDeep` canonicalization on every save, both synchronous and both on the main thread (`ChronosStore.ts:639`). On large projects this is a perceptible hitch. See §6.6.

---

## 5. Market Comparative Analysis

The relevant comparison set spans three different product categories, because Chronos V3 does not sit cleanly in any of them.

### grandMA3 (MA Lighting)

**Architecture:** authoritative cue-stack execution model. Timecode shows are built as cue lists triggered by SMPTE/MTC, with the programmer specifying every state transition. The Timecode Editor records and edits trigger times against a waveform display.

**Where MA3 is decisively ahead:** hardware determinism (dedicated processing units, network session redundancy, tracking backup), fixture-library breadth, output scale (256 universes+), phaser/effect engine maturity, and a two-decade-hardened cue-tracking model. Nothing in Chronos approaches this.

**Architectural difference:** MA3's audio input is essentially a *trigger source*. The console has a Sound-to-Light input, but the show content is authored by a human and the audio only advances or triggers it. **Chronos inverts this.** The audio analysis is not a trigger — it is the primary structural document. The 7-band heatmap, section map, and transient list are first-class persisted data (`LuxAnalysisV3`) that the timeline is authored *against*. An MA3 programmer times cues to a waveform they read visually; a Chronos programmer times clips to a machine-classified structure that carries semantics (`drop`, `buildup`, `breakdown`) and per-classification confidence.

### Resolume Arena

**Architecture:** clip-grid media server, audio-reactive via FFT analysis with per-parameter audio-band linking. The closest philosophical relative in this set.

**Where Resolume is ahead:** GPU media pipeline, real-time video compositing, an enormously more mature effect/parameter ecosystem, and battle-tested BPM sync (with `Ableton Link` support).

**Architectural difference — two axes:**
1. **Live-reactive vs. offline-deterministic.** Resolume's audio analysis is a real-time envelope-follower feeding parameters. It is inherently non-reproducible: play the same track twice at a different input gain and get a different show. Chronos's offline pipeline explicitly disables AGC and applies whole-track peak normalization (`analysisPipeline.ts:311-323`) to guarantee the *same input yields the same analysis, always*. For a pre-programmed show that must repeat identically across a tour, this determinism is the whole point.
2. **Analysis depth.** Resolume exposes broad frequency bands. Chronos persists 7 LR4-equivalent bands, spectral centroid/flatness/rolloff, and the semantic layer (saturation, whiteNoiseScore, rhythmic_void) — telemetry designed to answer "*what kind of musical moment is this*," not just "*how loud is the bass*."

### ShowCAD / Chamsys MagicQ / Avolites Titan (mid-tier console class)

**Architecture:** conventional timeline or cue-stack over a fixture-patch abstraction, with SMPTE/MTC chase.

**Where they are ahead:** DMX output robustness, hardware integration, fixture personality libraries, and — importantly — mature undo/redo and multi-user workflow. Chronos has neither (§6.7).

**Architectural difference:** these products treat the timeline as *the* document. Chronos treats the timeline as one of three co-equal document layers: the analysis layer (machine-generated, `LuxAnalysisV3`), the arrangement layer (human-authored, `LuxTrackV3[]`), and the behaviour layer (embedded `HephAutomationClipV3` per FX clip). The embedded-automation choice in particular has no equivalent in this class — a `.lux` carries its own effect definitions rather than referencing a console show-file's palette, so it is portable in a way a console show-file is not.

### Summary positioning

Chronos V3 is not competing with grandMA3 on output scale or hardware determinism, and it should not claim to. Its defensible architectural position is narrower and more specific:

> **An offline, deterministic, audio-first sequencer that treats machine listening as authored content rather than as a live modulation source, and that ships a fully self-contained, cryptographically-checksummed project artifact.**

The three properties that no product in the comparison set combines: (a) semantic section classification with confidence, persisted; (b) analysis determinism by construction; (c) a self-contained, SHA-256-verified, atomically-written project file with no external asset graph.

---

## 6. V1.1 Roadmap — Potential Improvements

Ordered by ratio of engineering value to implementation cost.

### 6.1 Retire the offline BPM engine; adopt the one already in the repo

`estimateBpm` (`analysisPipeline.ts:411-462`) is a 10 ms modal-bin histogram. `IntervalBPMTracker.ts` — already written, already tested — has median smoothing, IQR confidence, Kalman filtering, autocorrelation cross-validation, and musically-aware octave folding. The offline path is the one place where the *entire track is available in advance*, and it is using the least capable estimator in the codebase.

The offline version should go further than the live tracker:
- **Global autocorrelation** of the onset envelope over the whole track, which is only possible offline and is dramatically more robust than local interval statistics.
- **Dynamic programming beat tracking** (Ellis-style) over the onset function to produce a *variable-tempo* beat sequence rather than a single scalar BPM extrapolated to infinity. This removes the constant-tempo assumption entirely.
- **Downbeat detection** from per-band onset periodicity, replacing the `(beats.length − 1) % 4 === 0` counting convention (`:541`).
- **Metre detection** beyond the hard-coded `timeSignature: 4` (`:559`) — at minimum discriminating 3/4 and 6/8 from 4/4 via autocorrelation peak ratios at the bar level.

Highest-value item on this list by a wide margin.

### 6.2 Adaptive onset thresholding

`SlopeBasedOnsetDetector` uses fixed 5%/30% thresholds (`GodEarFFT.ts:1800`). Offline, replace with a **median-filtered adaptive threshold** over a centred window — legitimate here because lookahead is free — which is the standard formulation and materially reduces both false positives in dense passages and misses in quiet ones.

Related, and nearly free: the properly whitened, half-wave-rectified spectral flux at `GodEarFFT.ts:1234-1254` is currently consumed only by the strobe path. Feeding it into the onset detector alongside the band-energy slope would improve detection of pitched and non-percussive onsets, which the pure-energy detector currently misses.

The band-mix coefficients (`0.5`, `0.5`, `0.3` at `:2359-2361`) should be calibrated against a labelled drum-transcription set and the derivation recorded, or replaced with learned weights.

### 6.3 Section boundary refinement

Section edges are quantized to 8-beat windows (`analysisPipeline.ts:591`), i.e. ±4–8 s. Add a second pass that snaps each detected boundary to the nearest strong novelty peak — computed from a self-similarity matrix over the existing per-frame feature vectors (centroid, flatness, rolloff, 7 bands, all already persisted). This is a pure post-process over data the pipeline already produces, and it converts approximate section markers into beat-accurate ones. Substantial UX gain, contained blast radius.

### 6.4 `ClipBoundaryIndex` cache-miss path

The cache-hit path is `O(1)` and excellent. The **miss** path (`ChronosEngine.ts:191-207`) is an early-terminating linear scan over `clipEntries`, so it is `O(k)` in the number of clips starting before the playhead — worst case, the whole show, on every boundary crossing near the end of a long timeline.

Fix: since `clipEntries` is already sorted by `startMs`, binary-search the insertion point and maintain a **max-`endMs` prefix array** (or a small interval tree / segment tree) so the scan can terminate backwards once `maxEndMs[i] < timeMs`. This makes the miss path `O(log n + m)` and removes the only remaining super-constant term in the per-frame hot path.

While there: reset `cachedActivePairs` correctness under seek. A large backwards seek crossing many boundaries currently forces a full rebuild — expected, but worth an explicit fast path.

### 6.5 Consolidate the RAF loops

Four independent `requestAnimationFrame` loops are live during playback (engine, `TimelineCanvas`, auto-scroll, `useStreamingPlayback`), partially consolidated in `ChronosLayout.tsx:396-475`. Collapse to a **single scheduler with prioritized subscribers**. This makes frame-budget accounting possible (currently no subsystem knows what the others spent), guarantees ordering between clock update and render, and eliminates the possibility of a subsystem's loop surviving unmount.

### 6.6 Render and persistence throughput

- **Implement the documented OffscreenCanvas strategy** (`WaveformLayer.tsx:12-15`) or delete the comment. Pre-rendering the waveform once and `drawImage`-ing a viewport crop would remove the full per-frame redraw entirely.
- **Waveform LOD pyramid.** Precompute mip levels (1×, 4×, 16×, 64× decimation) at analysis time and select by zoom, replacing per-frame downsample recomputation (`WaveformLayer.tsx:365-367`).
- **Memoize grid geometry and beat labels** (`TimelineCanvas.tsx:223-292`, `:330-357`) on `(zoom, scroll, bpm)` rather than rebuilding per frame.
- **Widen the gradient caches** from single-entry to a small keyed `Map`, and move `colorCache` to a `WeakMap` keyed by rendering context so it does not outlive the component (`WaveformLayer.tsx:174-253`).
- **Move serialization off the main thread.** `serializeLuxV3` → `canonicalStringify` → `sortKeysDeep` → SHA-256 is a synchronous recursive pass over multi-megabyte analysis data (`ChronosStore.ts:639`, `serializer.ts:45-71`). Run it in a worker. Better: adopt a **hybrid container** — JSON manifest plus a binary side-car (`Float32Array` blobs, optionally quantized to `Int16`) for heatmap/waveform arrays. This addresses file size, parse time, and serialization hitch simultaneously.

### 6.7 Protocol stack maturation

- **Reverse-direction MTC offset.** Apply `−2` frames when `direction === 'reverse'` (`MTCParser.ts:325-342`) and add reverse test coverage — the current unconditional `+2` yields a 4-frame error under reverse shuttle.
- **Promote the PLL to an actual PLL.** Add an integral term to track *frequency* offset, not just phase, so a master running consistently fast is corrected rather than perpetually lagged. Add a lock-detection metric (phase-error variance over a window) and surface it to the UI. Add **freewheel**: on dropout, coast at the last locked rate for a configurable window instead of nulling state (`ClockSourceManager.ts:159-163`). Correct the "second-order" comment (`:373`) either way.
- **SPP tempo continuity.** Preserve the BPM estimate across an SPP locate instead of calling `resetBpmDerivation` (`MIDIClockSlave.ts:203`); the tempo has not changed just because the position did. Broaden SPP support to include outbound SPP from the MIDI Clock master so Chronos can *locate* downstream devices, not only follow them.
- **Median tempo estimation** in `bpmDerivation.ts:70-71` to reject single-outlier jitter from USB-MIDI stacks.
- **LTC hardening:** honour the device's native sample rate instead of pinning 48 kHz (`LTCDecoder.ts:373`), make the 0.75× pulse threshold adaptive to tracked bit period, and add frame-level plausibility checking (monotonicity, valid BCD ranges) as a substitute for the absent parity check.
- **Automatic source failover** in `ClockSourceManager` with a priority list and per-source quality metrics, so an LTC dropout falls through to MTC without operator intervention.

### 6.8 Correctness and workflow debt

- **Apply Blackman-Harris coherent gain compensation** (`GodEarFFT.ts:333` is declared but unused; `:658`). The ~2.79× systematic underestimate is currently masked by downstream peak normalization, which means the bug is invisible until someone consumes absolute band values. Fix the normalization and re-baseline the downstream thresholds together, in one change.
- **Global undo/redo.** There is currently no project-level history — only `ChronosRecorder.undoLastClip()` (`:517-533`). For a programming tool this is the largest *workflow* gap in the product. A command-pattern journal over `ChronosStore` mutations, bounded by count and by byte budget, is the natural fit and composes with the existing immutable-update discipline.
- **Re-enable or remove the strobe engine.** It is hard-disabled with a "TEMPORARY — Diagnostic" comment (`GodEarFFT.ts:2390`) while the surrounding `StrobeEngine` class remains fully present. Dead but reachable-looking code in a DSP hot path is a maintenance hazard.
- **Rename the LR4 claim.** "Linkwitz-Riley 4th-order digital crossovers" (`analysisPipeline.ts:149`) should read "LR4-equivalent magnitude-response band masks (frequency-domain)." The implementation is correct and appropriate; only the label overstates it.
- **Test coverage gaps:** AGC, transient detection, the photon/rhythmic telemetry blocks, the PLL filter, MTC full-frame SysEx, and MIDI Clock master are all untested. The FFT core and SMPTE arithmetic are well covered; the layers above them are not.

---

## 7. Technical Score

Scored strictly on DSP sophistication, architectural cleanliness, and data integrity. Product maturity, fixture-library breadth, and output scale are explicitly excluded.

| Dimension | Weight | Score | Rationale |
|---|---:|---:|---|
| **FFT / spectral core** | 15 | 12.5 | Verified iterative radix-2 with LUT bit-reversal and twiddles; correct Blackman-Harris; genuine zero-allocation hot path; DFT-referenced and determinism-tested. Deductions: no real-input optimization (~2× cost left), coherent-gain compensation declared but not applied. |
| **Band separation & features** | 12 | 9.5 | 7 non-overlapping bands with correct LR4 magnitude-squared response; standard centroid/flatness/rolloff. Deductions: frequency-domain approximation labelled as a crossover network; power-domain flatness scale is a consumer trap. |
| **Transient & onset detection** | 10 | 6.5 | Correct slope-based (not level-based) formulation with per-band isolation, 80 ms refractory, and single-pass collection alongside the heatmap. Deductions: fixed non-adaptive thresholds, uncalibrated magic constants, and the better whitened-flux onset function exists but is unused. |
| **Rhythmic / tempo intelligence** | 10 | 4.5 | The offline path is a 10 ms modal-bin histogram with hard-coded 4/4, constant tempo, and counted downbeats. Honest confidence reporting and finite-guards earn partial credit; a superior tracker exists in-repo and is not wired in. Weakest dimension. |
| **Semantic enrichment** | 8 | 7.5 | `rhythmic_void`, saturation-as-drop-proxy, and dual-signal buildup gating are genuinely differentiated and correctly prioritized ahead of naive energy rules. Deduction: 8-beat boundary quantization with no refinement pass. |
| **Architectural cleanliness** | 15 | 13.5 | Type-enforced dual representation; schema-first with no reverse dependencies; DRY consolidation of worker and fallback into one pipeline; deprecated code demoted rather than orphaned; documented performance-regression fixes. Deduction: multiple RAF loops, stale comments contradicting the code. |
| **Runtime performance engineering** | 12 | 10 | `ClipBoundaryIndex` with `O(1)` typical-frame cost; `WeakMap` sort cache; binary-search automation; 57 MB of measurable GC elimination; true React/RAF decoupling. Deductions: `O(k)` cache-miss path, single-entry gradient caches, per-frame grid rebuild, no OffscreenCanvas despite the documented strategy. |
| **Data integrity** | 13 | 12.5 | Canonical key-sorted SHA-256; path-scoped cycle detection with the DAG false-positive fixed; hard rejection on checksum mismatch; deep keyframe-level validation; atomic `.tmp` + **fsync** + `rename` on both save *and* autosave; versioned migration. Best-in-class for this product category. |
| **Protocol correctness** | 10 | 8 | MTC +2 quarter-frame offset applied correctly *and* correctly omitted for full-frame SysEx; true SMPTE 12M drop-frame arithmetic; exact SPP math with correct stale-interval discard; bidirectional LTC sync-word detection in a real AudioWorklet. Deductions: unconditional +2 under reverse, IIR-blend mislabelled as a PLL, no freewheel, no automatic failover. |
| **Testing rigor** | 5 | 3.5 | Excellent depth where it exists — Parseval, linearity, phase, determinism, drop-frame boundaries, SPP edge cases, MTC wrap cascades. Deduction: AGC, transients, telemetry, PLL, and MIDI master are entirely untested. |

### **Composite: 88 / 110 → 80 / 100**

**Interpretation.** This is a serious engineering artifact, not a prototype with an impressive README. The FFT is verified against ground truth and tested for bit-exact determinism. The file format is checksummed with canonical hashing and written with `fsync`-hardened atomic replacement on both the manual and autosave paths — a level of durability discipline that exceeds several shipping commercial consoles. The performance work is evidence-driven: the code contains before/after reasoning for specific profiled regressions, and the fixes are correct.

The score is held below 90 by three concrete things, all addressable:

1. **The offline tempo engine is the weak link in an otherwise strong DSP chain.** A modal-bin interval histogram with hard-coded 4/4 and constant tempo is beneath the standard set by the rest of the analyzer — particularly when a substantially better tracker already exists in the same repository, unwired.
2. **Calibration debt.** The unapplied window coherent gain, the fixed onset thresholds, and the uncalibrated band-mix coefficients mean the analysis is *self-consistent* but not *absolutely calibrated*. Downstream peak normalization masks this; it does not resolve it.
3. **Documentation drift.** "Linkwitz-Riley crossovers" for frequency-domain magnitude masks, "second-order PLL" for a first-order IIR blend, and a documented OffscreenCanvas strategy that was never implemented. Each individually minor; collectively they erode the credibility of accurate claims elsewhere in the same files.

None of the three is architectural. All three are contained, well-understood work items with the correct implementations either already present in the repository or standard in the literature. The foundation — dual-representation typing, index-backed `O(1)` frame queries, React/RAF decoupling, shared offline/live spectral truth, and cryptographically-verified atomic persistence — is sound and does not need to be revisited to address them.

---

*Audit conducted by static analysis of the LuxSync `chronos/` module and its DSP dependencies. All findings are traceable to the cited `file:line` references. No runtime profiling, listening tests, or hardware protocol capture were performed; performance claims are derived from code structure and the allocation arithmetic documented in-source.*
