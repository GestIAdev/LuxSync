# Chronos V3 Timecoder — Technical Architecture Audit (FINAL)

**Subject:** LuxSync `chronos/` module + GodEar V3 DSP core, evaluated in suite context
**Scope:** Offline ("cold work") studio pre-programming timeline, and its role as the Acoustic Intelligence & Sync Brain feeding Hephaestus and Selene.
**Method:** Full static read of `electron-app/src/chronos/**`, `electron-app/src/workers/GodEarFFT.ts`, `electron-app/src/workers/IntervalBPMTracker.ts`, `electron-app/src/core/hephaestus/**`, `electron-app/src/engine/TitanEngine.ts`, and `electron-app/electron/ipc/ChronosIPCHandlers.ts`.
**Revision:** Supersedes the initial audit (80/100). Re-evaluated after Operation "Shut Up Opus" (→ 86/100), then Operation "Academic Exorcism" (→ 88/100).
**Classification:** Engineering evaluation. Citations are `file:line` against the audited tree.

---

## 0. Changes Since Initial Audit

Four items from the prior V1.1 roadmap were closed in Operation "Shut Up Opus." Three additional items were closed in Operation "Academic Exorcism." Each was verified in source, not accepted on report.

| Item | Prior finding | Status |
|---|---|---|
| Offline BPM engine | 10 ms modal-bin histogram; superior `IntervalBPMTracker` existed in-repo but unwired | **Closed (Opus).** Tracker wired into `analysisPipeline`; legacy path demoted to `@deprecated` fallback |
| `ClipBoundaryIndex` cache miss | `O(k)` linear scan from index 0 | **Closed (Opus).** Binary search + `prefixMaxEndMs` backward scan → `O(log n + m)` |
| LR4 naming | "Linkwitz-Riley 4th order crossovers" overstated a frequency-domain magnitude mask | **Closed (Opus).** Renamed across source; false "zero phase shift at crossover" claim removed |
| Octave folding | `getMusicalBpm()` existed but was never called — raw event-rate BPM was reaching the beat grid | **Closed (Opus).** `musicalBpm` now plumbed through `HeatmapExtractionResult` → `detectBeats` |
| Blackman-Harris coherent gain | Prior audit claimed gain was "declared but never applied" | **Closed (Exorcism) — audit correction, not a code fix.** The gain was already correctly applied at `GodEarFFT.ts:670` (`nf = 1 / (real.length * BLACKMAN_HARRIS_COHERENT_GAIN)`). The prior audit was factually wrong on this point; the score deduction has been reversed. No code change was needed or made. |
| Reverse MTC offset | Parser unconditionally added +2 frames; reverse shuttle was off by 4 frames | **Closed (Exorcism).** `assembleTimecode()` now applies `direction === 'reverse' ? -2 : +2` with full negative wrap-around cascade (frames→seconds→minutes→hours). 7 new tests cover reverse no-wrap, all three borrow boundaries, 24-hour wrap, and millisecond equivalence. |
| Live MIDI tempo smoothing | Live MIDI path used a plain mean — single USB-MIDI outlier jitter pulled the estimate | **Closed (Exorcism).** `bpmDerivation.ts` now computes the window median, rejects intervals deviating >15% from it, and averages the survivors. Falls back to the full window if all intervals are rejected. 8 new tests cover steady-state, single-outlier, dual-outlier, gradual drift, all-rejected fallback, hysteresis preservation, reset, and insufficient-data. |

`tsc --noEmit` is clean across all touched files. The single project-wide error (`hyperion-render.worker.ts:612`, `glassPort` possibly null) was verified pre-existing. The test suite passes 29/29 across the three affected test files (MTCParser, bpmDerivation, MIDIClockSlave) plus 51/51 in Protocols — zero regressions.

**Not closed, and still open:** adaptive onset thresholding, section-boundary refinement, the PLL's missing frequency-tracking term, SPP tempo continuity, LTC sample-rate pinning, and automatic source failover. These remain scored against the system. See §7.

---

## 1. Suite Position: The Acoustic Intelligence & Sync Brain

Chronos V3 does not render DMX. This is the single most important architectural fact about it, and it is enforced structurally rather than by convention.

### 1.1 What Chronos actually emits

The terminal output of the Chronos runtime is `ChronosOverrides` (`chronos/bridge/ChronosInjector.ts:268`) — a pure intent structure containing no channel data, no fixture references, and no universe addressing:

- `modulators: ChronosModulators` (`:120-138`) — `masterIntensity`, `masterSpeed`, `hueOffset`, `saturation`, `energyOverride`, plus a `custom: Map<string, number>` for arbitrary automation parameters.
- `triggerEvents: ChronosTriggerEvent[]` (`:143-164`) — `{effectId, intensity, speed, zones, params, sourceClipId, isNewTrigger}`. Zones are *semantic* (`EffectZone`), not fixture IDs.
- `activeEffectsWithProgress: ChronosEffectWithProgress[]` (`:169-184`) — forced `progress` per effect instance, which is what makes timeline scrubbing coherent.
- `forcedVibe: ForcedVibeOverride | null` (`:106-115`), `zoneOverride`, `colorOverride`.

Consumption happens at `TitanEngine.ts:622-645`. Note the two-mode behaviour logged at `:649`:

```
const mode = this.chronosOverrides.forcedVibe ? 'FULL' : 'WHISPER'
```

In **WHISPER** mode Chronos does not seize control — `energyOverride` is described in-source as "susurra a la energía de Selene" (`ChronosInjector.ts:133`). The timeline biases the reactive brain rather than replacing it. This is the correct default: a pre-programmed show that ignores the live room is a video file, not a lighting show.

### 1.2 The three-stage pipeline

```
        ┌──────────────────────────────────────────────┐
        │  CHRONOS V3  — Acoustic Intelligence & Sync  │
        │  • GodEar offline analysis (persisted)       │
        │  • MTC / LTC / MIDI Clock / Art-Net TC       │
        │  • ClipBoundaryIndex → active clip set       │
        │  Emits: ChronosContext → ChronosOverrides    │
        └───────────────┬──────────────────────────────┘
                        │  pure temporal context + intent
                        │  (no fixtures, no channels)
            ┌───────────┴───────────┐
            ▼                       ▼
  ┌───────────────────┐   ┌────────────────────────┐
  │   HEPHAESTUS      │   │       SELENE           │
  │ phase + parametric│   │ contextual trigger     │
  │ curve engine      │   │ automaton (EnergyZone, │
  │ (PhaseConfigPro,  │   │ cognitiveDNA, vibes)   │
  │  CurveEvaluator)  │   │                        │
  └─────────┬─────────┘   └───────────┬────────────┘
            └───────────┬─────────────┘
                        ▼
              ┌──────────────────┐
              │   NodeArbiter    │  L3 dominance + LTP/HTP
              └────────┬─────────┘
                       ▼
              ┌──────────────────┐
              │  FixtureBuffer   │  → DMX / universes
              └──────────────────┘
```

The namespace split is explicit in the schema and enforced at load. `HephAutomationClipV3` (`core/hephaestus/types.ts:428`) documents it directly:

> `spatialZones` → DÓNDE van los fixtures (CanonicalZone / helpers)
> `cognitiveDNA` → CUÁNDO/CÓMO actúa Selene (EnergyZone, ACO, vibes)
> El Loader rechaza cualquier EnergyZoneId en spatialZones.

The loader *rejects* an `EnergyZoneId` appearing in `spatialZones`. Spatial routing and cognitive triggering cannot be conflated even by a malformed file. That is a type-system-grade boundary between "where" and "when."

### 1.3 Why the decoupling is the scaling argument

A monolithic console evaluates per-fixture state inside the cue engine. Cost grows with `cues × fixtures`. Chronos's cost is bounded by a quantity that does not grow with rig size at all.

Concretely, per frame:

- **Chronos** resolves the active clip set via `ClipBoundaryIndex` — `O(1)` on a cache hit, `O(log n + m)` on a boundary crossing (§4.4), where `n` is clip count and `m` is *active* clip count. **Neither term contains fixture count or universe count.**
- **Hephaestus** expands one clip across a fixture array via `resolvePro()` (`PhaseConfigPro.ts:147-167`), an `O(F log F)` pass computed **once at clip activation**, not per frame. The per-frame hot path (`tickActive`, `HephaestusRuntime.ts:579-644`) is a linear walk over pre-resolved `fixturePhases` with a cursor-cached `CurveEvaluator`.
- **Selene** operates on `EnergyZone` semantics — a small closed set — not on fixtures.

The phase offsets are pre-sorted ascending specifically to preserve the evaluator's cursor cache: "ordenada ASC por `phaseOffsetMs` para que el cursor cache de `CurveEvaluator` se mantenga O(1) amortizado" (`HephaestusRuntime.ts:106-107`, sort at `PhaseConfigPro.ts:165`). Fixture count therefore enters as a linear emit cost against a cache-friendly access pattern, and never as a search cost.

**Honest scope of the claim:** this establishes that the architecture has *no super-linear term in fixture or universe count*, which is the necessary condition for scaling to 1000+ universes. It is not the same as a measured 1000-universe benchmark, which this audit did not perform. The output stage (`NodeArbiter` arbitration, `FixtureBuffer` packing, network transport) is outside Chronos and is where a real ceiling would be found. The correct claim is *"Chronos and Hephaestus do not obstruct that scale; they are mathematically indifferent to it."*

### 1.4 Hephaestus vs. a console phaser

The directive's claim that Hephaestus "outperforms traditional console phasers" is supportable, and worth stating precisely because the margin is narrower than marketing usually implies.

`computeOffsetPro` (`PhaseConfigPro.ts:98-135`) is a seven-stage pure function:

```
① BLOCKING    iBlock = floor(index / blocks)        — N fixtures share one phase
② SHUFFLE     iEff   = (1-s)·iBlock + s·hash01(seed, iBlock)·(nBlock-1)
③ NORMALIZE   u      = iEff / (nBlock - 1)
④ SYMMETRY    s      = linear | mirror | center-out
⑤ WINGS       w      = wings === 1 ? s : fract(s · wings)
⑥ DIRECTION   d      = direction === -1 ? 1 - w : w
⑦ SPREAD→TIME offset = d · (spreadDeg / 360) · durationMs
```

Against grandMA3's phaser feature set: **spread, wings, symmetry, and direction are parity features** — MA3 has all of them. The genuine differentiators are two:

1. **`blocks`** — quantizing the index so groups of N move in unison (columns/staircase effects) is achievable on MA3 only through grouping gymnastics or manual phase entry, not as a first-class continuous parameter.
2. **`shuffle` + `shuffleSeed`** — controlled chaos on a continuous `[0,1]` axis, blending the ordered offset with a deterministic `hash01` permutation. The seed makes it **reproducible**, which is the part that matters: a console's random-phase feature typically re-randomizes, so the show is not repeatable take-to-take. Here it is bit-identical.

The whole module is documented as "Módulo puro: cero dependencias de Zustand, React, o UI" (`PhaseConfigPro.ts:5`) and the file honours it — it imports nothing. Pure, seeded, and deterministic is exactly the property set a pre-programming tool needs.

Also correct, and a common failure point elsewhere: **continuous phase wrap**. `HephaestusRuntime.ts:604-609` uses `(clipTime + offset) % duration` in loop mode rather than the naive `max(0, clipTime - offset)`. The in-source note records that the naive form froze high-offset fixtures at `t=0` until the playhead reached them, producing a discontinuity at every loop boundary. The fix is labelled MA3-style and is the right model.

---

## 2. Architectural Overview

### 2.1 The dual-representation model

Chronos separates the **persisted artifact** from the **runtime artifact** at the type level:

| Representation | Type | Mutability | Contains |
|---|---|---|---|
| On disk | `LuxFileV3` (`LuxFileV3.ts:378-408`) | `readonly` on every top-level field | schema discriminator, meta, audio ref, embedded analysis, tracks, markers, safety, checksum |
| In memory | `ChronosProjectV3` (`LuxFileV3.ts:441+`) | fully mutable | all of the above **plus** ephemeral edit state (`runtimeBpm`, `manualBpmOverride`, selection, dirty flags) never written to disk |

The header states the governing principle — "este schema es la CONSTITUCIÓN: se define primero, los consumidores se adaptan después" (`LuxFileV3.ts:9-11`) — and the codebase honours it: the schema module has no UI imports, and `ChronosEngine` consumes `LuxTrackV3`/`LuxClipV3` directly rather than a UI mirror type (`ChronosEngine.ts:35`).

Two consequences:

1. **Self-containment.** FX clips embed a complete `HephAutomationClipV3` (`LuxFileV3.ts:105`); `hephFilePath` is reference-only and explicitly not loaded at runtime (`:107-108`). A `.lux` travels without a dependency graph — no missing-asset failure at showtime. This is also what makes the Chronos→Hephaestus handoff cheap: the automation definition is already in hand, no resolution step.
2. **Analysis is part of the document.** `LuxAnalysisV3` (`LuxFileV3.ts:304-328`) persists the beat grid, sections, transients, 7-band heatmap, and downsampled waveform *inside* the project file. Opening a saved show requires zero re-analysis.

### 2.2 `ClipBoundaryIndex` — now `O(log n + m)` worst case

Two structures are built per project mutation:

- `boundaries[]` — flat, time-sorted `{timeMs, clipId, type: 'start'|'end'}` events, two per clip (`ChronosEngine.ts:170-171`, sorted `:175`).
- `clipEntries[]` — `{clip, track, startMs, endMs}` sorted by `startMs` (`:176`).
- **`prefixMaxEndMs[]`** *(new)* — running maximum of `endMs` over `clipEntries`, built in one pass after the sort (`:186-195`).

**Cache-hit path** (`O(1)`): a negative cache of resolved `{clip, track}` pairs, guarded by `hasCrossedBoundary` (`:224-237`) — a lower-bound binary search over `boundaries[]` plus a bounded linear advance, answering "is there any boundary event in `(lo, hi]`?" in `O(log n)`. At 60 fps the playhead advances ~16.7 ms while boundary events are seconds apart, so the overwhelming majority of frames hit this path.

**Cache-miss path** (`O(log n + m)`) *(rebuilt)*:

```
① Binary-search clipEntries for the rightmost index with startMs <= timeMs
   → `hi` is the exclusive upper bound on candidates.           O(log n)

② Scan BACKWARD from hi-1, terminating as soon as
   prefixMaxEndMs[i] < timeMs
   → no entry at or before i can still be active.               O(m + ε)
```

The prefix-max guard is the load-bearing part. Without it, a backward scan is no better than the forward one it replaced; with it, the scan provably cannot walk past the last entry whose interval could still cover `timeMs`. The prior implementation was a forward scan from index 0 with an early `break` on `startMs > timeMs`, i.e. `O(k)` in the number of clips *starting* before the playhead — worst case the entire show, on every boundary crossing near the end of a long timeline. Seek and scrub cost on large projects is now effectively flat.

Staleness detection remains reference-identity on the tracks array (`isStale`, `:200-202`), which composes correctly with the store's immutable-update discipline — no version counters, no manual invalidation contract.

Adjacent caching follows the same philosophy: automation point sorting is a `WeakMap` keyed on the points-array reference (`ChronosEngine.ts:91-105`), and segment lookup is a binary search (`evaluateAutomationLane`, `:328-345`), supporting step / linear / ease-in / ease-out / ease-in-out / smoothstep / cubic Bézier with explicit handle offsets (`:238-301`).

### 2.3 React / RAF decoupling

The timeline does not drive the playhead through React state:

- The engine owns one `requestAnimationFrame` loop (`ChronosEngine.ts:976-984`) that calls `updateTime()` then `emitContext()`. It emits events; it never calls `setState`.
- `TimelineCanvas` receives `currentTimeRef` as a **ref prop** (`TimelineCanvas.tsx:51`) and mutates DOM/SVG attributes in its own RAF loop (`:545-566`).
- Live recording passes `growingClipEndMs` by ref so a clip extends visually during capture with no reconciliation (`:78-79, 1388-1393`).
- The store (`ChronosStore.ts:143`) is a hand-rolled class with a `Map<EventType, Set<Callback>>` registry (`:157`) that **does not update during playback** — it mutates only on user action. Transport position is never store state, so decoupling is structural, not a discipline a contributor could accidentally violate.

Clock hierarchy inverts cleanly: `updateTime()` consults the external clock source first, falls back to `AudioContext.currentTime`, then wall clock (`:995-1010`). Timeline position is derived, never authoritative.

Rendering is a deliberate hybrid — SVG for structural/clip elements (hit-testing, CSS styling), Canvas 2D for the waveform/heatmap (throughput). Defensible split.

---

## 3. DSP & Acoustic Intelligence (GodEar V3)

The offline analyzer is not a simplified sibling of the live one. `analysisPipeline.ts:29` imports `GodEarAnalyzer` from `src/workers/GodEarFFT.ts` — the same class the live Senses worker uses — and reconfigures it for deterministic batch operation via `analyzer.configure({ useAGC: false, useStereo: false })` (`:182`). Offline and live share one spectral truth. That remains the single most important decision in this section.

### 3.1 FFT core

Iterative Cooley-Tukey radix-2 decimation-in-time, `computeFFTCore` at `GodEarFFT.ts:604-646`.

- **Bit-reversal permutation** via precomputed LUT (`:533-548`), module singleton (`:553-559`).
- **Twiddle factors** in two `Float32Array(2048)` tables (`:573-584`, ~16 KB), indexed by `j * stride`. No `Math.cos`/`Math.sin` in the butterfly.
- **Out-of-place** into preallocated `outReal`/`outImag`.
- **Window:** Blackman-Harris 4-term, `a₀=0.35875, a₁=0.48829, a₂=0.14128, a₃=0.01168` (`:325-330`), applied at `:399`. Correct coefficients for the −92 dB sidelobe variant.

**Verification is real.** A reference radix-2 implementation with a brute-force DFT self-test lives at `GodEarFFT.radix2.ts:47-83, 176-254`. `src/workers/GodEarFFT.test.ts` checks Parseval energy conservation, linearity, and phase accuracy across N=4…4096. `src/chronos/__tests__/GodEarFFT.test.ts` adds frequency discrimination at 40/100/1000/8000/15000 Hz (`:186-234`) and a **bit-perfect determinism test** (`:360-395`) — uncommon, and directly load-bearing for an offline tool where re-analysis must be reproducible.

**Open findings:**

- *No real-input optimization.* The imaginary array is zero-filled (`:611`) and a full complex FFT runs. Real-input split-radix or N/2-complex packing would roughly halve cost. A throughput choice, not a correctness issue — but ~2× headroom left on the table.
- *Window coherent gain — audit correction.* The prior audit claimed `BLACKMAN_HARRIS_COHERENT_GAIN = 0.35875` was "declared (`:333`) but never applied; normalization at `:658` uses `nf² = (2/N)²` only." This was **factually wrong.** The actual code at `:670` reads `const nf = 1 / (real.length * BLACKMAN_HARRIS_COHERENT_GAIN)` — the coherent gain IS applied, and `nf²` correctly compensates for the window's energy reduction in the power domain. The ~2.79× underestimate described in the prior audit does not exist. The score deduction for this has been reversed. The remaining deduction in this dimension is for the absent real-input optimization only.

### 3.2 Band separation — naming corrected

The renaming is complete and, importantly, the corrected text is more accurate than a cosmetic relabel would have been.

`linkwitzRileyResponse` (`GodEarFFT.ts:714-736`) computes:

```
ratio8 = (f / fc)^8           // 4th-order squared
lowpass  →  1 / (1 + ratio8)
highpass →  ratio8 / (1 + ratio8)
```

Band masks are the product of a highpass at the lower crossover and a lowpass at the upper (`:750-774`), applied bin-wise in `extractBandPower` (`:843`).

The `ratio^8` expression **is** the correct magnitude-squared response of an LR4 (cascaded Butterworth) network. For energy extraction, where only `|X(f)|²` is consumed, the frequency-domain mask is mathematically equivalent to the time-domain filter's magnitude behaviour and vastly cheaper. It is the right engineering call.

What it does not provide is LR4's defining phase-coherent in-phase summation at crossover. The docblock now says so explicitly (`:695-705`), and the previously-false bullet "Zero phase shift at crossover" has been **removed** rather than reworded. Descriptive text across `GodEarFFT.ts:8, 262, 695, 1852` and `analysisPipeline.ts:158, 176, 268` now reads "LR4-equivalent magnitude-response band masks (frequency-domain)." The `LR4` symbol prefix is retained in identifiers (`LR4_FILTER_CACHE`, `LR4CacheEntry`) — correct, since those are labels, not claims.

The 7 tactical bands (`GodEarFFT.ts:265-315`), adjacent and non-overlapping:

| Band | Range | Musical role |
|---|---|---|
| `subBass` | 20–60 Hz | kick fundamental, seismic |
| `bass` | 60–250 Hz | kick body, bassline |
| `lowMid` | 250–500 Hz | warmth, low body |
| `mid` | 500–2000 Hz | vocal, snare core |
| `highMid` | 2000–6000 Hz | presence, attack |
| `treble` | 6000–16000 Hz | hi-hats, brightness |
| `ultraAir` | 16000–22000 Hz | air, harmonics |

Separation is explicitly tested (`chronos/__tests__/GodEarFFT.test.ts:311-322`).

### 3.3 Rhythmic intelligence — `IntervalBPMTracker` (rebuilt) → `TempoOracle` (superseded)

> **ACTUALIZACIÓN WAVE 7562 (Code Reconciliation):** This section was written against the `IntervalBPMTracker`-based pipeline (Operation "Shut Up Opus"). The `IntervalBPMTracker` has since been **superseded** as the primary BPM engine by the `TempoOracle` — a standalone NSDF autocorrelation estimator (`core/senses/bpm/TempoOracle.ts`, 737 lines) implementing the `AUTOCORRELATION_BLUEPRINT.md` specification. The tracker remains in-tree as a `@deprecated` fallback for ambient/atonal material only.
>
> **What changed:**
> - `analysisPipeline.ts:30` now imports `TempoOracle, CONF_FLOOR` from `core/senses/bpm/TempoOracle`.
> - `analysisPipeline.ts:260` instantiates `new TempoOracle(odfRateHz)` inside the heatmap extraction loop.
> - `analysisPipeline.ts:310-313` feeds each frame's pre-normalization `subBass + bass` (20–250 Hz ODF proxy) into `oracle.process()` with a deterministic offline timestamp.
> - `analysisPipeline.ts:318-321` accumulates per-frame BPM estimates into pre-allocated `Float64Array` buffers **only when `oracle.confidence > CONF_FLOOR`** — rejecting intro/outro silence and non-periodic noise frames.
> - `analysisPipeline.ts:470-471` reduces the collected array via `computeConfidenceWeightedMedian()` at track end — a confidence-weighted median that yields a single rock-solid scalar (e.g. 126.04), identical in spirit to Serato/VirtualDJ static analysis.
> - `analysisPipeline.ts:666` uses `oracleBpm > 0 ? oracleBpm : estimateBpm(onsets)` — the Oracle is primary, the deprecated histogram is last-resort fallback.
> - `analysisPipeline.ts:1092-1094` passes `oracleBpm` and `oracleConfidence` into `detectBeats()`, which builds a uniform beat grid from this single mathematical truth.
> - The result is persisted in `LuxAnalysisV3.detectedBpm` and `LuxAnalysisV3.bpmConfidence` via `LuxFileV3.factories.ts:496-497`, embedded in the `.lux` file. On reload, `ChronosLayout.tsx:793` detects the embedded analysis and **skips re-analysis**.
>
> **Phantom worker confirmed.** The Oracle runs inside the `godear-offline.worker.ts` Web Worker (the "phantom" background thread). `GodEarOffline.ts:120-123` creates the worker via Vite's `?worker` import pattern. `GodEarOffline.ts:183-192` transfers the `Float32Array` audio buffer as a **Transferable Object (zero-copy)** — the main thread retains a `.slice()` clone because transfer empties the original. A 60-second watchdog (`:130-133`) terminates the worker on timeout. If worker construction fails (CSP, bundler constraints), `GodEarOffline.ts:93` falls back to `analyzeOnMainThread()` with identical code — both paths import the same `analysisPipeline.ts`, so the Oracle lands in both simultaneously.
>
> **What this closes:** The "Global autocorrelation" item from §7.1 — the single most difficult piece of the tempo-map roadmap — is **CLOSED**. The Oracle's NSDF runs over the entire track (not windowed), with a harmonic ladder (1 + 0.50·NSDF(2τ) + 0.33·NSDF(3τ) + 0.25·NSDF(4τ)) that resolves dembow/DnB octave errors in-estimator, and sub-frame parabolic interpolation that defeats the ±4 BPM quantization grid of integer-lag ACF.
>
> **What remains open** is listed in the updated §7.1 below.

This was the weakest link in the prior audit. It is now the most improved subsystem.

**Wiring** (`analysisPipeline.ts:240-254, 292-303, 449-462`):

```ts
const bpmTracker = new IntervalBPMTracker(
  sampleRate, actualFftSize,
  config.heatmapResolutionMs,   // deterministic offline clock
)
...
bpmTrackerResult = bpmTracker.process(
  spectrum.bands.subBass + spectrum.bands.bass,  // PRE-normalization
  false, frameTimeMs,
)
```

Three details make this correct rather than merely connected:

1. **Pre-normalization energy.** The tracker is fed raw `subBass + bass` from inside the FFT loop, *before* the whole-track peak normalization at `:311-323`. The tracker's kick detector is ratio-based (`rawBassEnergy > rollingAvg × 1.6` + rising edge), and feeding it post-normalization values would distort the ratios it depends on. The input matches its documented 20–250 Hz contract.
2. **Deterministic clock.** `overrideFrameDurationMs = heatmapResolutionMs` replaces the tracker's default `Date.now()` timestamps with the offline musical clock, and frame time is passed explicitly. Offline BPM detection is therefore **reproducible** — a property the live path cannot have.
3. **Same pass, no extra cost.** The tracker runs inside the existing heatmap loop. No second traversal of the samples, and the tracker owns pre-allocated buffers (`Float32Array` energy history, `Float64Array` BPM history, `Float32Array` autocorrelation history — `IntervalBPMTracker.ts:299-301`), so it adds no per-frame allocation to the zero-alloc hot path.

**What the offline path now inherits:**

| Capability | Location |
|---|---|
| Median smoothing (12-sample window) | `IntervalBPMTracker.ts:29-32` |
| Adaptive debounce `max(200ms, (60000/bpm) × 0.40)` | `:18-22` |
| IQR-based confidence | `:802-838` |
| 1-D Kalman filter (continuous sub-integer BPM) | `:282-289, 647-674` |
| Autocorrelation cross-validation (±5% boost / >10% penalty) | `:272-280, 695-757` |
| Tempo-change detection via clustered-rejection flush | `:264-270` |
| Musical octave folding | `:914+` |

**Octave folding — a real gap found and closed during this pass.** The initial wiring consumed `bpmTrackerResult.bpm`, which is `stableBpm`: the tracker's *raw event rate*. `getMusicalBpm()` was never called, so the dance-pocket folding the feature list advertised was **not actually active**. This matters concretely — Boris Brejcha's tresillo 3:2 basslines fire at 185 events/min on a 123 BPM track (`:851-856, 864-866`), and a beat grid built on 185 would be wrong for the entire song.

Fixed by plumbing `musicalBpm` through `HeatmapExtractionResult` (`:92-101`), querying `getMusicalBpm()` **once after the full pass** when median/Kalman state has converged over the whole track (`:461`), and preferring it in `detectBeats` (`:574-580`). The fold ladder covers ×0.75 (dotted 4:3), ÷1.5 (tresillo), ÷2/÷3/÷4 (double/triple/quad-time), with inverse folds for slow material and a safety clamp to the pocket boundary if every ratio fails — the clamp exists because a 275 BPM signal reaching the physics engine would oscillate movers at 4.6 Hz (`:879-883`).

**Fallback discipline.** `estimateBpm` is not deleted. It is marked `@deprecated` (`:456-462`) and still serves ambient material where the tracker never reaches `MIN_KICKS_FOR_BPM`. `detectBeats` gates on `confidence > 0` (`:577`), so a tracker that never converged cannot poison the grid. Confidence is merged as `max(onsetConfidence, trackerConfidence)` (`:632`) — a strong tracker reading is not dragged down by noisy onsets, and a weak one cannot erase a clearly-aligned grid.

**Still open.** The grid remains **constant-tempo** — a single scalar extrapolated across the track (`:582-600`) — and `timeSignature: 4` is still a literal (`:606`) with downbeats counted every 4 beats rather than detected. The tracker gives a dramatically better *scalar*; it does not give a tempo *map*. See §6.1.

### 3.4 Transient extraction

`SlopeBasedOnsetDetector` (`GodEarFFT.ts:1690-1828`) is a rate-of-change detector, not a level detector — correct, since it does not fire on gradual crescendi.

- 8-sample circular energy history (`:1693`); short-term slope `current − previous`, long-term `current − older` (`:1789-1790`).
- Threshold `max(avgEnergy × 0.05, avgEnergy × 0.3)` (`:1800`); onset requires `shortSlope > threshold && longSlope > threshold × 0.5` (`:1802`).
- 80 ms per-band refractory (`:1713, :1808`).

Instrument isolation via three band mixes (`:2359-2361`): `kick ← subBass + bass×0.5`, `snare ← mid + lowMid×0.5`, `hihat ← treble + highMid×0.3`. Harvested in the same pass as the heatmap (`analysisPipeline.ts:268-292`) with a second 80 ms per-instrument debounce. The legacy single-band `detectTransients()` is `@deprecated` and uncalled — dead-code discipline is good; the function was demoted, not silently orphaned.

**Still open:** thresholds are fixed percentages, not adaptive, and the `0.05 / 0.3 / 0.5 / 0.3` coefficients are uncalibrated magic constants with no derivation in comment or test. Separately, `computeSpectralFlux` (`:1234-1254`) implements a properly half-wave-rectified, peak-hold-whitened flux with 0.995 decay — a textbook onset function — but it feeds only the strobe drive path (`:1345`), not the onset detector. The pipeline still has a better onset function than the one it uses.

### 3.5 Spectral features and semantic section enrichment

Per-frame features: **centroid** (`Σf·P / ΣP`, DC excluded, `:875-896`), **flatness** (geometric/arithmetic ratio with a `0.0001 × maxPower` floor, `:920-954`), **rolloff** (85th-percentile cumulative energy, `:968-995`). Flatness is computed in the *power* domain, so values run ~0.01–0.09 rather than the magnitude-domain 0.1–0.3; the code acknowledges this (`:905-911`) and downstream thresholds are tuned to the power scale — internally consistent, but a trap for external consumers.

Above these sits the semantic telemetry, which remains the genuinely differentiated layer:

- `saturation` — Saturation Index from the brickwall meter; a limiting/loudness-war proxy.
- `whiteNoiseScore` — `clamp((flatness − 0.10) / 0.10)` (`:2379`).
- `rhythmic_void` — `sqrt(snareVoid × hhVoid)`, each a 3000 ms-normalized absence counter for the 150–250 Hz / 2–5 kHz snare pair and the 5–15 kHz hi-hat band (`RhythmicPercussionTracker`, `:1903-2095`, void at `:2072`). A *percussion-absence* metric, and the sharpest signal in the set.

`detectSections` (`analysisPipeline.ts:600-815`) runs a semantic-first, energy-fallback classifier over 8-beat windows:

```
1. rhythmicVoid > 0.7                          → breakdown  (conf 0.90)
2. saturation > 0.6 ∧ relEnergy > 1.2          → drop       (conf 0.92)
3. whiteNoise > 0.4 ∧ nextEnergy > 1.15×       → buildup    (conf 0.85)
4. ── fallback: relative energy + centroid + subBass ──
5. post-pass: energyRising ∧ (centroidRising ∨ rolloffRising) → buildup (0.95)
```

The ordering is well-reasoned. Rule 1 catches what pure energy analysis always gets wrong — a loud ambient-pad breakdown with no drums. Rule 2 uses limiting as a proxy for authorial intent. Rule 5 requires *both* energy and brightness to rise, correctly rejecting a simple volume ramp. Confidence propagates to `DetectedSection.confidence` with `max()` on section extension (`:793`), so downstream consumers can distinguish a 0.95 drop from a 0.70 verse — and since these feed Selene's `cognitiveDNA`, confidence-weighted triggering is available at the suite level.

**Still open:** boundaries are quantized to 8-beat windows (~4–8 s) with no refinement pass and no novelty-curve / self-similarity approach.

### 3.6 Normalization and determinism

AGC is bypassed offline (`analysisPipeline.ts:182` → `GodEarFFT.ts:2284-2292`). In its place, per-band peak normalization runs across the whole track after the FFT loop, rationale at `analysisPipeline.ts:331-343`: raw non-AGC RMS lands at 0.01–0.05 while the `EngineAudioMetrics` contract expects 0–1, so without it phantom-buffer injection feeds near-zero values and produces dead fixtures. Raw pre-normalization peaks are logged per band as a diagnostic (`:345-365`).

Correct trade for a cold-work tool: live AGC is time-varying and non-reproducible; whole-track peak normalization is deterministic and input-level independent. Same file in, byte-identical analysis out. With the BPM tracker now on a deterministic frame clock, that guarantee extends to the beat grid as well — previously it did not.

### 3.7 Execution model

`analyzeAudioFile` (`GodEarOffline.ts:75-99`) tries a dedicated module Web Worker first with a **zero-copy transferable** `Float32Array` handoff (`:183-193`), a 60 s watchdog (`:130-133`), and a main-thread fallback with `yieldToEventLoop()` cooperative pumping if worker construction fails under CSP or bundler constraints. All extraction logic was consolidated into `analysisPipeline.ts` as a single source of truth, eliminating ~700 lines of worker/fallback duplication (`GodEarOffline.ts:14-19`). Both paths execute identical code, so the fallback cannot silently diverge — worth more than it looks, and it means the BPM tracker upgrade landed in both paths simultaneously with no second integration.

---

## 4. Memory & Performance Profiling

### 4.1 The 60 fps render path

- **Single authoritative RAF** in the engine (`ChronosEngine.ts:976-984`), with additional loops in `TimelineCanvas` (`:545-566`), auto-scroll (`:642-670`), and `useStreamingPlayback` (`:143-152`). `ChronosLayout.tsx:396-475` partially consolidates. Multiple loops remain — a coordination risk, not a throughput problem.
- **No React re-renders during transport** (§2.3). The load-bearing optimization, and it holds.
- **`devicePixelRatio` scaling** on the waveform canvas (`WaveformLayer.tsx:545-555`).
- **Waveform bar-count capping** at 200 bars per viewport regardless of zoom (`:365-367`), bounding draw calls independent of track length.

Not present: dirty-region tracking, layered/double-buffered canvases, `OffscreenCanvas`. The header at `WaveformLayer.tsx:12-15` still describes an OffscreenCanvas pre-render strategy that was never implemented while the code does a full redraw every pass. **Documentation drift, still open.**

### 4.2 GC pressure mitigations

| Mitigation | Location | Effect |
|---|---|---|
| Preallocated FFT window buffer | `analysisPipeline.ts:245-255` | ~3,600 × 16 KB ≈ **57 MB of garbage eliminated** per 3-min track |
| Zero-allocation analyzer hot path | `GodEarFFT.ts:2127-2178` | ~93 KB instance buffers at N=4096; `analyze()` mutates in place |
| **BPM tracker pre-allocated buffers** | `IntervalBPMTracker.ts:299-301` | energy / BPM / autocorrelation histories are typed arrays — the new subsystem adds **zero** per-frame allocation |
| Bit-reversal + twiddle LUT singletons | `GodEarFFT.ts:553-559, 573-584` | one-time, shared across instances |
| Spectral + vignette gradient caches | `WaveformLayer.tsx:174-231` | avoids per-frame `createLinearGradient` |
| Quantized HSL color cache | `WaveformLayer.tsx:238-253` | 5% quantization → ≤8,000 keys |
| Automation sort `WeakMap` | `ChronosEngine.ts:91-105` | eliminates 20 lanes × 60 fps = 1,200 sorts/sec |
| Clip pair cache + `prefixMaxEndMs` | `ChronosEngine.ts:148, 186-195` | `O(1)` hit / `O(log n + m)` miss |
| Transferable worker handoff | `GodEarOffline.ts:183-193` | zero-copy buffer transfer |

The 57 MB figure is arithmetic following directly from the code change, with before/after recorded in-source.

**Residual, honestly stated:** gradient caches hold exactly one entry each keyed on `(ctx, height[, intensity])`, so any height or intensity variation thrashes them to a 0% hit rate; `colorCache` is a plain `Map` never evicted or cleared on unmount (`WaveformLayer.tsx:238`) — bounded at ~8,000 short strings, so bounded retention rather than an unbounded leak, but it outlives the component; grid-line arrays and beat labels are rebuilt every frame (`TimelineCanvas.tsx:223-292, 330-357`); `AGCTrustZone` uses `push()`/`shift()` (`GodEarFFT.ts:1587-1590`), breaking the zero-alloc guarantee that holds elsewhere (bypassed offline, so cold work is unaffected). No object pooling anywhere.

### 4.3 File I/O — atomic writes

**Still the strongest area.** Both manual save and the 60-second autosave use full write-durability sequences in the main process (`electron/ipc/ChronosIPCHandlers.ts:324-342`, `:464-480`):

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

The inline comments show deliberate reasoning: `writeFile` alone returns once data is in the OS page cache, so power loss after `rename` could publish a zero-length or partial inode. `fileHandle.sync()` closes that window. Applying the identical pattern to autosave (LAZARUS B-5) matters more than the manual path — an autosave truncatable by the crash it exists to survive is worse than no autosave. This is production show-control-grade handling, materially better than what several shipping consoles do.

### 4.4 Data integrity

- **SHA-256 over canonical JSON.** `canonicalStringify` (`LuxFileV3.serializer.ts:29-71`) sorts keys recursively at every depth; the checksum is computed with the `checksum` field blanked (`:104-108`), making verification idempotent. Prefix-tagged `sha256:<hex>`.
- **Cycle detection done correctly.** `sortKeysDeep` tracks the *current recursion path* in a `WeakSet` and calls `visited.delete(value)` on unwind (`:45-71`). An earlier revision never deleted, misclassifying a DAG — two clips sharing one `zones` array — as circular and aborting the save with a false positive. Subtle, topology-dependent, found and fixed.
- **Checksum mismatch is a hard error** (`:192-197`). Corruption is not silently loaded.
- **Deep structural validation.** `LuxFileV3.schema.ts` rejects rather than coerces: FX clips must carry an embedded `hephClip` at `schemaVersion '3.0'` with ≥1 track (`:114-128`); every automation track needs a non-empty `curve.keyframes` with finite `timeMs` and non-null `value` per keyframe (`:132-167`); clip intervals must satisfy `0 ≤ startMs < endMs` (`:106-111`); vibe `intensity` must lie in `[0,1]` (`:178-185`); `targetZone`/`mixBus`/`type` are checked against closed sets (`:48-64`, `:207-209`). Errors and warnings return as structured lists rather than throwing, letting the loader set policy.
- **Versioned migration.** V2 payloads are detected by `looksLikeV2()` and migrated before validation, warning to re-save for an embedded checksum (`serializer.ts:161-190`).

Canonical hashing + deep validation + hard corruption rejection + atomic/fsync writes + shadow autosave with mtime-based recovery prompting (`ChronosStore.ts:1008-1044`) is a coherent integrity story with no weak link.

### 4.5 Persistence cost

`.lux` is pretty-printed JSON at 2-space indentation (`serializer.ts:122`) with analysis embedded. At 50 ms heatmap resolution a 4-minute track yields ~4,800 frames × 15 numeric arrays plus a 100 Hz waveform (24,000 peak + 24,000 RMS). At ~18 bytes per JSON float that is **several megabytes of analysis per song**, uncompressed, with no precision reduction.

Deliberate trade — instant open, no re-analysis, self-contained files — and right for a studio tool. But the whole dataset passes through `JSON.parse` and recursive `sortKeysDeep` canonicalization on every save, both synchronous on the main thread (`ChronosStore.ts:639`, `serializer.ts:45-71`). On large projects this is a perceptible hitch. **Still open** — see §6.5.

---

## 5. Protocol Stack & Synchronization

### 5.1 MTC — quarter-frame assembly and the +2 offset

`MTCParser.ts` implements the 8-piece state machine with an 8-slot buffer plus a `receivedPieces` bitmask (`:96-97`), decoding nibbles in standard order at `:304-310`. Frame rate recovered from bits 5–6 of piece 7 via `FRAME_RATE_MAP {24, 25, 29.97, 30}` (`:76-81`, `:312-314`).

**The ±2 frame compensation** (`:325-355`) separates a correct MTC implementation from a naive one, and it is now right in both directions. An 8-quarter-frame message spans exactly two frames of wall time; by the time the final piece arrives the encoded timecode is two frames stale. The parser applies `direction === 'reverse' ? -2 : +2` and carries through the full cascade — forward wraps frames→seconds→minutes→hours, reverse borrows frames←seconds←minutes←hours, both using the *nominal* rate (30 for 29.97) for the threshold. Thirteen tests cover both directions including every wrap/borrow boundary and 24-hour rollover (`MTCParser.test.ts:82-293`).

Equally correct: the SysEx full-frame path (`F0 7F 7F 01 01 hr mn sc fr F7`, `:352-373`) does **not** apply the offset, because a full-frame is an instantaneous locate, not a streaming assembly. Documented at `:300`. Getting all three paths right (forward, reverse, SysEx) is a strong signal.

Direction detection tracks piece-index adjacency mod 8 (`:254-262`), moving the assembly trigger from piece 7 to piece 0 in reverse (`:278-283`). Dropout is a 500 ms timeout flipping `connected` (`:73`, `:411-418`).

**Still open:** MTC user bits are not parsed.

### 5.2 MIDI Clock and SPP

`MIDIClockSlave.ts` counts 24 PPQN, deriving tempo every 24th pulse from a timestamp ring buffer (`:210-217`) via the shared `bpmDerivation` module (8-beat sliding window, 0.5 BPM hysteresis, `[20,300]` clamp, `Number.isFinite` guards before every division — `bpmDerivation.ts:76-107`). The estimator now uses **median-filtered outlier rejection**: the window median is computed, intervals deviating more than 15% from it are excluded, and the mean of the survivors feeds the hysteresis stage. If all intervals are rejected (pathological jitter), the full window is used as a fallback. This closes the asymmetry with the offline path — both now reject single-outlier USB-MIDI jitter, though the offline path retains its additional Kalman filter and IQR confidence scoring.

**SPP handling** (`:190-204`) is exactly correct:

```
sppUnits     = (msb << 7) | lsb        // 14-bit, 16th-note units
targetPulses = sppUnits × 6            // 6 MIDI clocks per 16th
pulseCount   = targetPulses
totalBeats   = floor(targetPulses / 24)
clockTimestamps = []                   // discard stale intervals
```

Discarding the timestamp window on locate is right — intervals spanning a jump are meaningless. Tests cover LSB/MSB assembly, SPP=0, the 16383 maximum, and clock continuation after locate (`MIDIClockSlave.test.ts:54-166`). START resets counters; CONTINUE preserves them; STOP clears the timeout (`:206-227`).

**Still open:** no cumulative drift compensation. SPP resets BPM state, producing a brief instability window after every locate.

### 5.3 LTC AudioWorklet

`LTCDecoder.ts` runs a real SMPTE bi-phase-mark (Manchester) decoder inside an `AudioWorkletProcessor` (`:84`), delivered as an inline template string compiled to a Blob URL (`:76-299`, `:376-380`). No `ScriptProcessorNode` fallback — correct, since it runs on the main thread and would be unusable for bit-level timing.

1. Zero-crossing detection measuring pulse width in samples (`:114-123`).
2. Bi-phase classification against an adaptive bit period: long pulse (> 0.75 × period) → `0`; two consecutive shorts summing to 0.6–1.4 × period → `1` (`:131-197`).
3. Bit-period IIR tracking, α = 0.05 (`:169, :179`) — self-clocking, tolerates moderate speed variation.
4. 80-bit frame windowing with sync-word detection on **both** `0x3FFD` forward and `0xBFFC` reverse (`:53-57`, `:199-227`), with bit-order reversal for reverse frames (`:235-237`) — reads timecode while shuttling backwards.
5. Bit buffer capped at 240, trimmed to 160 on overflow (`:190-193`).
6. Drop-frame flag from bit 10 (`:244`), selecting 29.97 (`:512`).

**Drop-frame arithmetic is genuinely correct** — `smpteToMs` (`ClockSource.ts:185-213`) implements true SMPTE 12M:

```
droppedFrames     = 2 × (totalMinutes − floor(totalMinutes / 10))
totalActualFrames = (h·3600 + m·60 + s)·30 + f − droppedFrames
ms                = totalActualFrames / (30000/1001) × 1000
```

with tests at the 10-minute and 1-hour boundaries (`Protocols.test.ts:64-96`). Many commercial products get this wrong.

**Still open:** `AudioContext` hard-pinned to 48 kHz (`:373`), failing on hardware that cannot honour it. The 0.75× classification threshold is fixed and breaks at high shuttle speeds. No parity or CRC validation — a single bit error corrupts a frame undetected.

### 5.4 The PLL

`ClockSourceManager.applyPLL` (`:383-422`):

```
clampedDelta = clamp(rawTime − lastRawTime, ±5 ms)
predicted    = smoothed + wallElapsed
target       = smoothed + clampedDelta
smoothed     = predicted + 0.05 × (target − predicted)
```

with `PLL_ALPHA = 0.05`, `PLL_MAX_JUMP_MS = 5` (`:101-102`).

This is a **first-order IIR blend between a wall-clock extrapolation and a jump-limited observation** — not a phase-locked loop. No phase detector, no loop filter, no frequency-tracking integrator. The in-code "second-order" comment (`:373`) remains inaccurate and was **not** corrected in this blitz.

The structure it does have is well-chosen: predicting forward with `wallElapsed` keeps the clock smooth between discrete timecode arrivals, which is what makes 60 fps rendering look right on 25 fps MTC; the ±5 ms clamp rejects a corrupt frame without a separate validity check. Adequate for frame-accurate offline programming.

**Still open:** no lock detection, no frequency tracking (a master running 0.1% fast is lagged forever, never compensated), and **no freewheel** — on signal loss PLL state is nulled outright (`:159-163`) rather than coasting, so a momentary LTC dropout hard-stalls instead of gliding.

### 5.5 Source arbitration

`setSource()` (`:113-147`) awaits `stop()` and cleanup on the outgoing source before starting the incoming one — a documented fix (P1.7) preventing dual-clock emission during rapid switching — and falls back to the internal `AudioContext` clock if the new source fails (`:141-146`). Registry covers MTC, Art-Net Timecode, LTC, MIDI Clock slave, and MIDI Clock master (outbound, ticked at `ChronosEngine.ts:1012-1014`).

**Still open:** no automatic failover, no priority ordering, no cross-source quality comparison. Selection is manual — acceptable for a studio tool, not for redundant show control.

---

## 6. Market Comparative Analysis

The comparison set spans three product categories, because Chronos V3 does not sit cleanly in any of them — and after this revision, the reason is clearer: **the comparison is category-mismatched by construction.** grandMA3, Resolume, and MagicQ are *monolithic* — analysis, authoring, arbitration, and output live in one process with one data model. Chronos is one stage of a decomposed pipeline. The honest comparison is therefore Chronos+Hephaestus+Selene against those products, with Chronos's individual contribution isolated.

### grandMA3 (MA Lighting)

**Architecture:** authoritative cue-stack execution. Timecode shows are cue lists triggered by SMPTE/MTC; the Timecode Editor records and edits trigger times against a waveform.

**Where MA3 is decisively ahead:** hardware determinism (dedicated processing units, network session redundancy, tracking backup), fixture-library breadth, output scale, phaser/effect maturity, and a two-decade-hardened cue-tracking model. Nothing in this suite approaches that operational hardening.

**Architectural difference — two axes:**

1. **Audio as document, not trigger.** MA3's audio input is essentially a trigger source; show content is human-authored and audio only advances it. Chronos inverts this. The 7-band heatmap, section map with confidence, and transient list are first-class *persisted* data (`LuxAnalysisV3`) that the timeline is authored against. An MA3 programmer times cues to a waveform they read visually; a Chronos programmer times clips to a machine-classified structure carrying semantics (`drop`, `buildup`, `breakdown`) and per-classification confidence — which then flows to Selene as `cognitiveDNA`.
2. **Decomposition vs. monolith.** MA3 evaluates fixture state inside the cue engine, so per-frame cost scales with `cues × fixtures`. Chronos's per-frame cost (`O(1)` / `O(log n + m)`, §2.2) contains **no fixture or universe term**; fixture expansion is Hephaestus's `resolvePro()` at clip-activation time, not per frame (§1.3). Adding universes does not make the timeline engine slower. That is a genuinely different scaling curve — though, stated honestly, the ceiling then relocates to `NodeArbiter` and the output transport, which this audit did not benchmark.

### Resolume Arena

**Architecture:** clip-grid media server, audio-reactive via FFT with per-parameter band linking. The closest philosophical relative.

**Where Resolume is ahead:** GPU media pipeline, real-time video compositing, a far more mature effect/parameter ecosystem, and battle-tested BPM sync including Ableton Link.

**Architectural difference:**

1. **Live-reactive vs. offline-deterministic.** Resolume's analysis is a real-time envelope follower — inherently non-reproducible; the same track at a different input gain gives a different show. Chronos disables AGC and applies whole-track peak normalization (`analysisPipeline.ts:331-343`) so the same input yields the same analysis, always. **With this revision that guarantee now extends to tempo**: `IntervalBPMTracker` runs on a deterministic frame clock rather than `Date.now()`, so the beat grid is reproducible too. Previously it was the one non-deterministic hole in an otherwise deterministic pipeline.
2. **Analysis depth.** Resolume exposes broad bands. Chronos persists 7 LR4-equivalent bands, centroid/flatness/rolloff, and the semantic layer (saturation, whiteNoiseScore, rhythmic_void) — telemetry designed to answer *what kind of musical moment is this*, not *how loud is the bass*.
3. **Tempo intelligence.** Resolume's BPM sync is solid but conventional. The offline path now carries median smoothing, IQR confidence, Kalman filtering, autocorrelation cross-validation, and polyrhythmic octave folding (§3.3) — folding a 185-event/min tresillo bassline to its true 123 BPM is not something the comparison set does.

### ShowCAD / Chamsys MagicQ / Avolites Titan

**Architecture:** conventional timeline or cue stack over a fixture patch, with SMPTE/MTC chase.

**Where they are ahead:** DMX output robustness, hardware integration, fixture personality libraries, and mature undo/redo plus multi-user workflow. Chronos still has no global undo (§6.6).

**Architectural difference:** these treat the timeline as *the* document. Chronos treats it as one of three co-equal layers — analysis (machine-generated), arrangement (human-authored), behaviour (embedded `HephAutomationClipV3` per FX clip). The embedded-automation choice has no equivalent in this class: a `.lux` carries its own effect definitions rather than referencing a console show-file's palette, so it is portable in a way a console show-file is not. And because Hephaestus receives that definition already resolved, the phase engine can apply `blocks`/`shuffle`/`wings` distribution at activation with no round-trip to a patch database.

### Summary positioning

The defensible position is narrow and specific:

> **The deterministic Acoustic Intelligence & Sync Brain of a decomposed lighting suite — treating machine listening as authored, persisted content rather than a live modulation source; emitting pure temporal intent to a phase/curve engine and a contextual automaton rather than rendering DMX; and shipping a self-contained, cryptographically-checksummed project artifact.**

Four properties no product in the comparison set combines:

1. Semantic section classification **with confidence**, persisted and consumable downstream as `cognitiveDNA`.
2. **End-to-end analysis determinism** — spectral *and*, as of this revision, rhythmic.
3. A self-contained, SHA-256-verified, fsync-atomic project file with no external asset graph.
4. **Zero fixture/universe term in the per-frame timeline cost**, with fixture expansion deferred to a pure, seeded, reproducible phase engine.

---

## 7. V1.1 Roadmap

The BPM engine, cache-miss bottleneck, and LR4 naming are closed. What follows is re-prioritized against the remaining debt plus new capability, ordered by value-to-cost ratio.

### 7.1 Variable-tempo beat tracking (tempo map)

> **ACTUALIZACIÓN WAVE 7562 (Code Reconciliation):** The "Global autocorrelation" item listed below as open has been **CLOSED**. Code forensics confirm that `TempoOracle` (NSDF autocorrelation + harmonic ladder + sub-frame parabolic interpolation) is fully integrated into `GodEarOffline` via `analysisPipeline.ts:30,260,310,470`, running globally inside the phantom Web Worker with zero-copy `Float32Array` transfer. The confidence-weighted median reduction (`computeConfidenceWeightedMedian`) produces a single scalar persisted in `LuxAnalysisV3.detectedBpm`. See §3.3 addendum for the full chain.
>
> The remaining four items are **genuinely still open** — verified by source search (`tempoCurve`, `tempoMap`, `variableTempo`, `bpmCurve`, `ellis`, `dynamic.*programming.*beat`, `novelty.*curve`, `self.*similarity` — all return zero matches across `electron-app/src/`).

The Oracle gives an excellent *scalar*; the grid is still constant-tempo (`analysisPipeline.ts:700`: `for (t = firstBeatMs; t < durationMs; t += msPerBeat)`) with `timeSignature: 4` hard-coded (`:727`) and downbeats counted, not detected. The natural next steps:

- ~~**Global autocorrelation** over the whole onset envelope.~~ **CLOSED (WAVE 7562).** `TempoOracle` runs NSDF globally across the entire track inside the phantom worker. Confidence-weighted median reduction yields the persisted scalar.
- **Tempo curve persistence** (scalar → array). The Oracle already produces per-frame BPM estimates (`bpmSamples: Float64Array`) that are discarded after median reduction. Persisting this curve as `tempoCurve: number[]` in `LuxAnalysisV3` would let Hephaestus phase-lock curve durations to local tempo instead of a global average. **Lowest cost, highest value** — the data already exists, only the schema field and serialization are missing.
- **Dynamic-programming beat tracking** (Ellis-style) over the onset envelope, seeded by the Oracle's high-confidence scalar as the tempo prior. Produces a variable-tempo beat sequence rather than one BPM extrapolated to infinity — handles live recordings, tempo ramps, and DJ pitch-rides. `BeatGridData.beats: TimeMs[]` is already an array, so the schema is compatible.
- **Downbeat detection** from per-band onset periodicity, replacing `(beats.length − 1) % 4 === 0` (`:704`). The heatmap already has `subBass` (kicks) and `transientEvents` with `kick`/`snare` classification — a post-hoc rhythmic analysis (~50 lines) could detect 4/4 vs 3/4 from kick/snare periodicity.
- **Metre detection** beyond the `timeSignature: 4` literal — at minimum discriminating 3/4 and 6/8 via autocorrelation peak ratios at bar level. The `TempoOracle` harmonic ladder operates at beat level; a bar-level estimator would require a separate lag band (4×, 3×, 6× the beat lag).

### 7.2 Global novelty-curve segmentation

Section edges remain quantized to 8-beat windows (~4–8 s). Build a **self-similarity matrix** over the per-frame feature vectors already persisted (centroid, flatness, rolloff, 7 bands, saturation, whiteNoise, rhythmicVoid), extract a **novelty curve** via a checkerboard kernel along the diagonal, and snap each boundary to the nearest strong novelty peak — then quantize to the beat grid from §7.1.

Pure post-process over data the pipeline already produces. Converts approximate section markers into beat-accurate ones, which directly improves Selene's trigger timing since `cognitiveDNA` transitions inherit these boundaries. Highest UX gain per unit of risk on this list.

### 7.3 Multi-machine network synchronization

The clock stack currently assumes one machine following one external source. For multi-room installations, redundant playback, or distributing render load across nodes:

- **Distributed transport state** — elect a Chronos master emitting position over the network; peers run the existing `applyPLL` against it as just another `ClockSource`, which the registry already supports.
- **PTP / IEEE 1588** or an NTP-disciplined offset estimator for sub-millisecond wall-clock agreement, feeding the freewheel term in §7.4.
- **Deterministic replay contract.** Because analysis is now fully deterministic (spectral *and* rhythmic), every node analyzing the same audio produces byte-identical `LuxAnalysisV3`. Ship the checksum, not the analysis — peers verify rather than re-transmit multi-megabyte heatmaps. This is a direct dividend of §3.6 and worth exploiting.
- **Redundant master with automatic failover**, which composes with §7.4's source arbitration.

### 7.4 Protocol stack maturation

- **Reverse-direction MTC offset.** ~~Apply `−2` when `direction === 'reverse'`.~~ **Closed (Exorcism).** `direction === 'reverse' ? -2 : +2` with full negative wrap cascade; 7 new tests.
- **Promote the PLL to an actual PLL.** Add an integral term tracking *frequency* offset so a consistently-fast master is corrected rather than perpetually lagged; add lock detection (phase-error variance over a window) surfaced to the UI; add **freewheel** coasting at the last locked rate on dropout instead of nulling state (`ClockSourceManager.ts:159-163`). Correct the "second-order" comment (`:373`) either way.
- **Median tempo estimation in the live MIDI path** ~~(`bpmDerivation.ts:70-71`). The offline path now has median + Kalman + IQR; the live path still uses a plain mean. Port the smoothing — the asymmetry is unjustified now that the better implementation is in-tree and proven.~~ **Closed (Exorcism).** Median-filtered outlier rejection (15% threshold) with full-window fallback; 8 new tests. The offline path still retains its additional Kalman filter and IQR confidence scoring, which the live path does not need for a 24-PPQN pulse stream.
- **SPP tempo continuity.** Preserve the BPM estimate across an SPP locate (`MIDIClockSlave.ts:203`) — the tempo did not change just because the position did. Add outbound SPP from the MIDI Clock master so Chronos can *locate* downstream devices, not only follow them.
- **LTC hardening:** honour the device's native sample rate instead of pinning 48 kHz (`LTCDecoder.ts:373`); make the 0.75× threshold adaptive to tracked bit period; add frame-level plausibility checks (monotonicity, valid BCD ranges) to substitute for the absent parity check.
- **Automatic source failover** with a priority list and per-source quality metrics, so LTC dropout falls through to MTC without operator intervention.

### 7.5 Render and persistence throughput

- **Implement the documented OffscreenCanvas strategy** (`WaveformLayer.tsx:12-15`) or delete the comment. Pre-rendering once and `drawImage`-ing a viewport crop removes the full per-frame redraw.
- **Waveform LOD pyramid.** Precompute mip levels (1×, 4×, 16×, 64×) at analysis time, select by zoom, replacing per-frame downsampling (`:365-367`).
- **Memoize grid geometry and beat labels** on `(zoom, scroll, bpm)` (`TimelineCanvas.tsx:223-292, 330-357`).
- **Widen gradient caches** to a small keyed `Map`; move `colorCache` to a `WeakMap` keyed on rendering context so it does not outlive the component (`WaveformLayer.tsx:174-253`).
- **Move serialization off the main thread.** `serializeLuxV3` → `canonicalStringify` → `sortKeysDeep` → SHA-256 is a synchronous recursive pass over multi-megabyte data (`ChronosStore.ts:639`). Run it in a worker. Better: a **hybrid container** — JSON manifest plus a binary side-car (`Float32Array`, optionally `Int16`-quantized) for heatmap/waveform arrays — addressing file size, parse time, and save hitch simultaneously. This also makes §7.3's network distribution practical.
- **Consolidate the RAF loops** into a single scheduler with prioritized subscribers, enabling frame-budget accounting and guaranteeing clock-before-render ordering.

### 7.6 Correctness and workflow debt

- ~~**Apply Blackman-Harris coherent gain compensation**~~ **Closed (Exorcism) — audit correction.** The gain was already correctly applied at `GodEarFFT.ts:670`. The prior audit's claim that it was "declared but never applied" was factually wrong; no code change was needed.
- **Adaptive onset thresholding.** Replace the fixed 5%/30% thresholds (`GodEarFFT.ts:1800`) with a median-filtered adaptive threshold over a centred window — legitimate offline because lookahead is free, and the standard formulation. Feed the already-implemented whitened spectral flux (`:1234-1254`) into the detector alongside band-energy slope to catch pitched and non-percussive onsets. Calibrate the `0.5 / 0.5 / 0.3` band-mix coefficients (`:2359-2361`) against a labelled drum-transcription set, or learn them.
- **Global undo/redo.** Still absent — only `ChronosRecorder.undoLastClip()` (`:517-533`). For a programming tool this remains the largest *workflow* gap. A command-pattern journal over `ChronosStore` mutations, bounded by count and byte budget, composes naturally with the existing immutable-update discipline.
- **Re-enable or remove the strobe engine.** Hard-disabled with a "TEMPORARY — Diagnostic" comment (`GodEarFFT.ts:2390`) while `StrobeEngine` remains fully present. Dead-but-reachable-looking code in a DSP hot path is a maintenance hazard.
- **Test coverage gaps.** The FFT core, SMPTE arithmetic, MTC forward/reverse offset, and BPM derivation median smoothing are well covered. Untested: AGC, transient detection, photon/rhythmic telemetry, the PLL filter, MTC full-frame SysEx, MIDI Clock master, and — still — **the `IntervalBPMTracker` integration and the `prefixMaxEndMs` cache-miss path**. Both are correct by inspection but unverified by test. The `prefixMaxEndMs` path in particular deserves a property test asserting that the optimized query returns exactly what a naive full scan returns, across randomized clip topologies including zero-length clips and heavy overlap.

---

## 8. Technical Score

Scored strictly on DSP sophistication, architectural cleanliness, and data integrity. Product maturity, fixture-library breadth, and operational hardening are excluded. Deltas are against the prior audit (Operation "Shut Up Opus" → 86/100, Operation "Academic Exorcism" → 88/100).

> **ACTUALIZACIÓN WAVE 7562:** The "Rhythmic / tempo intelligence" dimension has been re-scored. Code forensics confirmed that `TempoOracle` (global NSDF autocorrelation + harmonic ladder + sub-frame parabolic interpolation + confidence-weighted median) is fully operational inside the phantom worker, superseding the `IntervalBPMTracker` as primary BPM engine. This closes the "global autocorrelation" gap that held the score at 8.5. The dimension increases from 8.5 → **9.5** (+1.0). It remains below 10 because the beat grid is still constant-tempo, `timeSignature: 4` is still a literal, and downbeats are still counted — see updated §7.1 for the genuine remainder.

| Dimension | Weight | Initial | Opus | Exorcism | **WAVE 7562** | Rationale for change |
|---|---:|---:|---:|---:|---:|---|
| **FFT / spectral core** | 15 | 12.5 | 12.5 | 13.5 | **13.5** | Unchanged since Exorcism. Remaining deduction: no real-input optimization (full complex FFT on zero-imaginary input). |
| **Band separation & features** | 12 | 9.5 | 10.5 | 10.5 | **10.5** | Unchanged since Opus. Residual: power-domain flatness scale is a consumer trap. |
| **Transient & onset detection** | 10 | 6.5 | 6.5 | 6.5 | **6.5** | Unchanged. Fixed thresholds, uncalibrated constants, unused whitened-flux function. |
| **Rhythmic / tempo intelligence** | 10 | 4.5 | 8.5 | 8.5 | **9.5** | **+1.0 (WAVE 7562).** Global NSDF autocorrelation via `TempoOracle` confirmed operational in phantom worker. Confidence-weighted median reduction persisted in `LuxAnalysisV3`. The `IntervalBPMTracker` (median, IQR, Kalman, octave folding) is now `@deprecated` fallback. Held below 10: still constant-tempo grid, hard-coded 4/4, counted downbeats, no tempo curve persistence. |
| **Semantic enrichment** | 8 | 7.5 | 7.5 | 7.5 | **7.5** | Unchanged. 8-beat boundary quantization. |
| **Architectural cleanliness** | 15 | 13.5 | 14.0 | 14.0 | **14.0** | Unchanged since Opus. Residual: multiple RAF loops, OffscreenCanvas comment drift. |
| **Runtime performance engineering** | 12 | 10 | 11.0 | 11.0 | **11.0** | Unchanged since Opus. Residual: single-entry caches, per-frame grid rebuild. |
| **Data integrity** | 13 | 12.5 | 12.5 | 12.5 | **12.5** | Unchanged. Best-in-class: canonical SHA-256, atomic fsync writes, deep validation. |
| **Protocol correctness** | 10 | 8 | 8 | 8.5 | **8.5** | Unchanged since Exorcism. Residual: PLL mislabelled, no freewheel, no failover, SPP tempo discontinuity, LTC 48 kHz pin. |
| **Testing rigor** | 5 | 3.5 | 3.5 | 4.0 | **4.0** | Unchanged since Exorcism. Residual: `prefixMaxEndMs` and `TempoOracle` integration still untested. |

### **Composite: 97.5 / 110 → 88.6 / 100** *(Exorcism: 96.5/110 → 88/100; Opus: 94.5/110 → 86/100; Initial: 88/110 → 80/100)*

**+0.6 points (WAVE 7562), +2.6 from Exorcism, +8.6 total from initial.**

**What earned the Exorcism increase.** Two real fixes and one audit correction:

1. **Reverse MTC offset (Protocol +0.5).** The parser unconditionally added +2 frames for transmission delay. Under reverse shuttle, where pieces arrive 7→0 and assembly completes on piece 0, the true time has *retreated* 2 frames — so the correct offset is −2, not +2. The prior unconditional +2 produced a 4-frame error under reverse shuttle. Fixed with `direction === 'reverse' ? -2 : +2` and a full negative wrap cascade (frames←seconds←minutes←hours, with 24-hour borrow). Seven new tests cover no-wrap, all three borrow boundaries, 24-hour wrap, and millisecond equivalence.

2. **Live MIDI median smoothing (Testing +0.5, via bpmDerivation).** The live MIDI path used a plain mean over an 8-beat sliding window. A single outlier interval from a jittery USB-MIDI stack — common with cheap interfaces — would pull the estimate. Now the window median is computed, intervals deviating more than 15% from it are rejected, and the mean of the survivors feeds the hysteresis stage. If all intervals are rejected (pathological jitter), the full window is used as a fallback. Eight new tests cover steady-state accuracy, single and dual outlier rejection, gradual tempo drift (not falsely rejected), all-rejected fallback, hysteresis preservation, reset, and insufficient-data. This closes the asymmetry with the offline path, which already had median + Kalman + IQR.

3. **Blackman-Harris coherent gain — audit correction (FFT +1.0).** The prior audit claimed `BLACKMAN_HARRIS_COHERENT_GAIN = 0.35875` was "declared but never applied" and that normalization used `nf² = (2/N)²` only, producing a "~2.79× systematic amplitude underestimate." This was **factually wrong.** The actual code at `GodEarFFT.ts:670` reads `const nf = 1 / (real.length * BLACKMAN_HARRIS_COHERENT_GAIN)` — the coherent gain IS and always was applied. The ~2.79× underestimate does not exist. The score deduction has been reversed. No code change was needed or made; the correction is to the audit itself. The remaining deduction in this dimension is for the absent real-input optimization only (the FFT runs a full complex transform on zero-imaginary input, leaving ~2× throughput on the table).

**What holds it below 90.** Two things remain, both still open:

1. **Constant-tempo assumption.** The `TempoOracle` now produces a globally-autocorrelated, confidence-weighted scalar BPM — a significant upgrade over the `IntervalBPMTracker` median. But a scalar is still not a tempo *map*. `timeSignature: 4` is still a literal (`analysisPipeline.ts:727`) and downbeats are still counted every 4 beats rather than detected (`:704`). The per-frame BPM estimates the Oracle collects are discarded after median reduction rather than persisted as a tempo curve. This is the single largest remaining DSP gap. See updated §7.1.
2. **Untested `prefixMaxEndMs` and `TempoOracle` integration.** Both are correct by inspection but unverified by test. The `prefixMaxEndMs` path especially warrants a property test asserting equivalence with a naive full scan across randomized topologies — an optimized index that silently disagrees with the brute-force answer on an edge case is worse than the `O(k)` scan it replaced. The `TempoOracle` integration deserves at minimum a regression test against a synthetic sweep with known BPM (the `AUTOCORRELATION_BLUEPRINT.md` §9.1 test vectors would serve).

Also still present, though now reduced: the protocol stack retains the PLL mislabelled as "second-order" (it is a first-order IIR blend, not a PLL), the absent freewheel on signal loss, and the absent automatic source failover. The reverse-MTC 4-frame error — the most concrete protocol bug — is now closed.

**Assessment.** The foundation was already sound and did not need revisiting. What this revision demonstrates is that the team's remediation matches the quality of the original architecture — the fixes are correct in method, not just in outcome, and they followed the codebase's existing conventions rather than bolting on. The suite decomposition, verified rather than assumed in this pass, is the strongest structural argument in the system: a timeline engine whose per-frame cost contains no fixture term, feeding a pure seeded phase engine and a semantic automaton, is a materially different scaling proposition from a monolithic console — and it is enforced by the type system and the loader, not by discipline. The audit's own correction — admitting the coherent gain was already applied — is itself a quality signal: the evaluation is honest enough to reverse itself when the code proves the finding wrong.

---

*Audit conducted by static analysis of the LuxSync `chronos/` module, its DSP dependencies, and the Hephaestus/Selene consumption path. All findings are traceable to the cited `file:line` references. `tsc --noEmit` verified clean across all modified files; the single project-wide error (`hyperion-render.worker.ts:612`) was confirmed pre-existing. Test suite: 29/29 across MTCParser, bpmDerivation, MIDIClockSlave; 51/51 Protocols — zero regressions. No runtime profiling, listening tests, hardware protocol capture, or multi-universe output benchmarking were performed; performance claims are derived from code structure, algorithmic analysis, and the allocation arithmetic documented in-source. The Blackman-Harris coherent-gain finding from the prior audit was reversed after source verification proved it was already correctly applied — the correction is documented in §0 and §3.1.*
