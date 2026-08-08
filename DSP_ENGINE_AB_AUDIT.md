# DSP ENGINE A/B COMPARATIVE AUDIT — CHRONOS LEGACY FFT vs GOD EAR V3

**Auditor:** Principal DSP Audio Architect & Due Diligence Auditor
**Date:** 2025-11-25
**Classification:** ENGINEERING DUE DILIGENCE — INTERNAL
**Status:** READ-ONLY AUDIT (no migration code written)

---

## EXECUTIVE TL;DR

**There is no "legacy FFT" in Chronos.** The premise of this audit — that Chronos contains a separate, inferior legacy FFT engine distinct from "GodEar V3" — is **factually incorrect**. The Chronos offline analysis module (`src/chronos/analysis/GodEarOffline.ts`) **already imports and delegates to** `GodEarAnalyzer` from `src/workers/GodEarFFT.ts` (the "GodEar V3" engine). There is no second FFT implementation. The "transplant" has already happened (WAVE 2077, per the code comments).

What exists is a **consumer/producer relationship**, not two competing engines:

| Role | File | Function |
|------|------|----------|
| **DSP Core (Producer)** | `src/workers/GodEarFFT.ts` | `GodEarAnalyzer` class — FFT, windowing, LR4 filters, band extraction, spectral metrics, transient detection, chroma, photon block |
| **Chronos Consumer** | `src/chronos/analysis/GodEarOffline.ts` | `analyzeAudioFile()` — orchestrates waveform extraction, heatmap collection, beat detection, section detection, transient detection. **Calls `analyzer.analyze()` per frame.** |
| **Chronos Worker** | `src/chronos/analysis/godear-offline.worker.ts` | Duplicates the consumer pipeline in a Web Worker thread. **Also imports `GodEarAnalyzer`.** |

The audit below is therefore reframed as: **"Is the current Chronos→GodEar integration optimal, or does the consumer layer leave GodEar V3 capabilities on the table?"**

---

## 1. ARCHITECTURAL COMPARISON

### 1.1 DSP Core: GodEarAnalyzer (`GodEarFFT.ts`)

This is the **sole** FFT implementation in the repository. It is a genuinely sophisticated, military-grade spectroscopy engine.

**FFT Algorithm:**
- **Cooley-Tukey Radix-2 Decimation-In-Time (DIT)** — `<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\workers\GodEarFFT.ts" lines="604-646" />`
- Bit-reversal permutation → bottom-up butterfly stages (size 2, 4, 8, ..., N)
- **Twiddle Factor LUT** (WAVE 8001): Pre-computed `Float32Array` sin/cos tables eliminate all `Math.cos`/`Math.sin` calls in the hot path. For N=4096, this saves 2048 trig calls per frame. — lines 569-584
- **Verified** against brute-force O(N²) DFT for all power-of-2 sizes N=4 to N=4096. Max error ~3e-5 (Float32 precision). Parseval energy conservation: relative error < 3e-9. — lines 587-595
- Default `FFT_SIZE = 4096` → bin resolution = 44100/4096 = **10.77 Hz/bin** — line 254

**Windowing:**
- **Blackman-Harris 4-term** window — lines 320-330
  - Coefficients: a0=0.35875, a1=0.48829, a2=0.14128, a3=0.01168
  - **-92 dB sidelobe suppression** (vs -31 dB for Hann, -44 dB for Hamming)
  - Trade-off: main lobe is ~2× wider than Hann, but precision > temporal resolution for lighting control
  - **Singleton** — generated once, reused across all frames — lines 394-435

**Band Separation:**
- **Linkwitz-Riley 4th order (LR4)** digital crossovers — lines 679-760
  - 24 dB/octave slope (vs 12 dB for Butterworth 2nd order)
  - Flat summed response at crossover (-6 dB each = 0 dB summed)
  - Transfer function: `|H(jω)|² = 1 / (1 + (ω/ωc)⁸)` for low-pass
  - **Pre-computed mask per band** — `Float32Array` weight per bin, generated once and cached
  - 7 tactical bands with **zero overlap**: subBass (20-60Hz), bass (60-250Hz), lowMid (250-500Hz), mid (500-2000Hz), highMid (2000-6000Hz), treble (6000-16000Hz), ultraAir (16000-22000Hz) — lines 265-315

**Power Spectrum (WAVE 8001):**
- Operates in **power domain** (`re² + im²`) rather than magnitude domain — line 664-676
- Eliminates 2049 `Math.sqrt()` calls per frame. sqrt is deferred to only 7 band-extraction calls + spectral metrics
- Normalization factor squared (`nf²`) since power = magnitude²

**Advanced Modules (beyond basic FFT):**
- **AGC Trust Zones** — per-band automatic gain control with band-specific attack/release times — lines 344-352
- **SlopeBasedOnsetDetector** — circular history buffer, refractory period (80ms), temporal density over 500ms sliding window — lines 1695-1815
- **SaturationMeter** — brickwall detection from crest factor, flatness, total power — lines 1163+
- **StrobeEngine** — maps transient density + white noise + spectral flux to strobe state (12Hz safety cap) — lines 1296-1408
- **ChromaCoupler** — 12-bin chromagram → hue via circle-of-fifths mapping, colorSnap detection — lines 1417-1499
- **RhythmicPercussionTracker** (WAVE 8008) — sub-band snare body (150-250Hz) + crack (2-5kHz) coincidence detection, hi-hat isolation, rhythmic void computation — lines 1890+
- **Spectral Flux V3** — half-wave rectified, whitened, normalized — lines 1160+
- **Stereo analysis** — phase correlation, width, balance — lines 1073-1157

### 1.2 Chronos Consumer: GodEarOffline (`GodEarOffline.ts`)

This is **not** a DSP engine. It is an **orchestration layer** that calls GodEarAnalyzer per frame and packages the results into the `AnalysisData` structure Chronos expects.

**What it does:**
1. `getMonoSamples()` — downmixes AudioBuffer to mono — lines 304-328
2. `extractWaveform()` — peak/RMS extraction at 100 samples/sec — lines 333-366
3. `extractEnergyHeatmap()` — **instantiates `GodEarAnalyzer`**, calls `analyzer.analyze(window)` per heatmap frame, extracts the 7 tactical bands + spectral centroid + flatness — lines 378-531
4. `detectBeats()` — onset detection from heatmap flux + subBass weighting, BPM estimation via interval histogram — lines 552-644
5. `detectSections()` — energy + spectral centroid + subBass based section classification (intro/verse/chorus/bridge/breakdown/buildup/drop/outro) — lines 710-859
6. `detectTransients()` — **standalone** slope-based onset detection on raw samples (does NOT use GodEarAnalyzer's onset detector) — lines 870-925

**Critical observation:** The consumer uses `analyzer.analyze()` for the heatmap (step 3), but then runs its **own** beat detection, section detection, and transient detection on the *results* — it does not use GodEar's built-in `SlopeBasedOnsetDetector`, `RhythmicPercussionTracker`, `StrobeEngine`, `ChromaCoupler`, `SaturationMeter`, or `SpectralFluxV3`. These modules are used by the **real-time** Senses pipeline (`src/core/senses/`), not by the offline Chronos pipeline.

### 1.3 Worker: `godear-offline.worker.ts`

A **near-exact duplicate** of the main-thread fallback path in `GodEarOffline.ts`. It mirrors all the same functions (`extractWaveform`, `extractEnergyHeatmap`, `detectBeats`, `detectSections`, `detectTransients`) and also imports `GodEarAnalyzer`. This is code duplication — the worker exists to keep the UI thread free during batch processing.

---

## 2. RESOLUTION & TRANSIENT DETECTION

### 2.1 Snare Rolls

**GodEar V3 (real-time path):** The `RhythmicPercussionTracker` (WAVE 8008) performs dedicated snare isolation by checking **coincidence** between snare body (150-250Hz) and snare crack (2-5kHz). It uses adaptive EMA thresholds per sub-band and tracks `snare_absence_ms` for rhythmic void detection. This is a purpose-built snare detector with sub-band resolution. — lines 1890+

**Chronos offline path:** Snare rolls are not specifically detected. The `detectTransients()` function (lines 870-925) uses a **single-band** slope-based onset detector on the raw mono signal — it cannot distinguish snare from kick from hi-hat. The `detectBeats()` function uses flux peaks weighted by subBass+bass, which biases toward kicks and **misses snare-driven beats** entirely.

**Verdict:** GodEar V3's `RhythmicPercussionTracker` is vastly superior for snare roll extraction. The Chronos offline path does not use it.

### 2.2 White Noise

**GodEar V3:** Computes `spectralFlatness` (Wiener entropy) in the power domain — lines 907-941. Maps this to a `whiteNoiseScore` via calibrated offset/scale (FLATNESS_OFFSET=0.10, FLATNESS_SCALE=0.10) — line 2366. This directly quantifies the broadband noise content. Values: 0.0 = pure tone, 1.0 = white noise, 0.16-0.36 = percussive music.

**Chronos offline path:** `spectralFlatness` is **collected** per heatmap frame (line 438) and stored in the heatmap, but it is **never used** by `detectBeats()`, `detectSections()`, or `detectTransients()`. It is available to downstream consumers but the offline pipeline itself does not exploit it for noise detection.

**Verdict:** GodEar V3 computes white noise score; Chronos collects the raw flatness but does nothing with it in its analysis pipeline.

### 2.3 Dense Walls of Sound

**GodEar V3:** The `SaturationMeter` detects brickwall limiting / loud war compression via crest factor in dB, flatness, and total power. The `SaturationIndex` (SI) ranges 0 (dynamic) to 1 (fully brickwalled). When SI > 0.6, AGC freeze is activated to prevent gain reduction under brickwall. This is specifically designed for dense walls of sound. — lines 1163+, 2268-2270

**Chronos offline path:** No saturation detection. Dense walls of sound are treated the same as any other high-energy section. The `detectSections()` function classifies by relative energy and spectral centroid, but has no concept of dynamic range compression or saturation.

**Verdict:** GodEar V3 has purpose-built saturation detection; Chronos offline has none.

### 2.4 Overall Telemetry Comparison

| Telemetry | GodEar V3 (real-time) | Chronos Offline |
|-----------|----------------------|-----------------|
| 7 tactical bands (LR4) | ✅ Per frame | ✅ Per heatmap frame |
| Spectral centroid | ✅ Per frame | ✅ Per heatmap frame |
| Spectral flatness | ✅ Per frame | ✅ Collected, **not used** |
| Spectral rolloff | ✅ Per frame | ❌ Not collected |
| Crest factor | ✅ Per frame | ❌ Not collected |
| Clarity index | ✅ Per frame | ❌ Not collected |
| Stereo correlation/width/balance | ✅ Per frame | ❌ Mono only |
| Spectral Flux V3 (whitened) | ✅ Per frame | ❌ Uses simple `|Δenergy|` |
| Saturation Index | ✅ Per frame | ❌ Not collected |
| Transient density (500ms window) | ✅ Per frame | ❌ Not collected |
| Kick/snare/hihat onset detection | ✅ Per frame (3-band) | ❌ Single-band only |
| Refractory period | ✅ 80ms per band | ❌ 50ms global debounce |
| Chromagram (12-bin) | ✅ Per frame | ❌ Not collected |
| Strobe engine state | ✅ Per frame | ❌ Not applicable (offline) |
| Rhythmic void | ✅ Per frame | ❌ Not collected |
| White noise score | ✅ Per frame | ❌ Not collected |
| AGC Trust Zones | ✅ Per frame | ❌ Disabled (`useAGC: false`) |

**GodEar V3 extracts dramatically richer telemetry than the Chronos offline pipeline uses.**

---

## 3. PERFORMANCE & MEMORY

### 3.1 GodEarAnalyzer (GodEarFFT.ts)

**Memory allocation — ZERO per frame (WAVE 2090.1):**
All working buffers are pre-allocated **once** at construction time and reused via in-place mutation:
- `inputBuffer`, `dcBuffer`, `windowedBuffer`: `Float32Array(fftSize)` × 3
- `fftReal`, `fftImag`: `Float32Array(fftSize)` × 2
- `powerSpectrum`: `Float32Array(numBins + 1)`
- `monoMixBuffer`: `Float32Array(fftSize)`
- `chromaBuffer`: `Float32Array(12)`
- `prevPower`, `fluxWhitening`: `Float32Array(numBins + 1)` × 2
- **Total pre-allocation:** ~70 KB for FFT_SIZE=4096 — lines 2114-2166

**Singleton resources (module-level, shared across instances):**
- `BLACKMAN_HARRIS_WINDOW`: `Float32Array(fftSize)` — generated once
- `BIT_REVERSAL_TABLE`: `Uint16Array(fftSize)` — generated once
- `TW_COS`, `TW_SIN`: `Float32Array(fftSize/2)` × 2 — generated once
- `LR4_FILTER_MASKS`: `Map<string, Float32Array>` — 7 masks, generated once

**GC pressure:** ~0 bytes/frame (down from ~90 KB/frame × 20fps = ~1.8 MB/s in the pre-optimization version, per code comments at line 1829).

**Performance target:** <2ms per frame (60fps = 16.6ms budget). The built-in benchmark function grades results: GODLIKE (<1ms), EXCELLENT (<2ms), GOOD (<3ms), ACCEPTABLE (<5ms) — lines 2685-2712.

### 3.2 Chronos Offline Consumer (GodEarOffline.ts)

**Memory allocation — HIGH per frame:**
- `extractEnergyHeatmap()` allocates `new Float32Array(actualFftSize)` **per heatmap frame** (line 420) — this is the window buffer. For a 3-minute song at 50ms resolution, that's 3,600 allocations of 16 KB each = **57.6 MB of garbage**.
- All band arrays use `new Array<number>(numPoints)` (regular JS arrays, not `Float32Array`) — lines 395-411. These are slower than typed arrays and create boxed-number garbage.
- `detectTransients()` allocates `new Float32Array(historyLength)` once (fine) but pushes to a growing `number[]` array.

**Web Worker integration:** ✅ Good. The `godear-offline.worker.ts` runs the full pipeline in a dedicated thread with **Transferable Objects** for zero-copy `Float32Array` transfer (line 227). 60-second timeout with automatic termination. Falls back to main thread (with `yieldToEventLoop()`) if Worker creation fails.

**Critical performance issue:** The per-frame `new Float32Array(actualFftSize)` allocation in `extractEnergyHeatmap()` (line 420) is exactly the kind of hot-path allocation that GodEarAnalyzer's WAVE 2090.1 optimization eliminated. The consumer is **reintroducing GC pressure** that the DSP core worked to eliminate. This should write into a pre-allocated buffer reused across frames.

### 3.3 Worker Code Duplication

`godear-offline.worker.ts` is a **near-exact copy** of `GodEarOffline.ts`'s extraction functions (waveform, heatmap, beats, sections, transients). This is ~700 lines of duplicated code. Any fix to the main-thread path must be manually mirrored in the worker. This is a maintenance liability.

---

## 4. I/O & MAPPING COMPATIBILITY

### 4.1 Chronos Expected Output: `AnalysisData`

Chronos expects the `AnalysisData` interface defined in `src/chronos/core/types.ts` lines 261-279:

```
AnalysisData {
  durationMs: TimeMs
  waveform: WaveformData { samplesPerSecond, peaks[], rms[] }
  energyHeatmap: HeatmapData {
    resolutionMs, energy[], bass[], high[], flux[],
    subBass?, bassReal?, lowMid?, mid?, highMid?, treble?, ultraAir?,
    spectralCentroid?, spectralFlatness?
  }
  beatGrid: BeatGridData { bpm, firstBeatMs, timeSignature, beats[], downbeats[], confidence }
  sections: DetectedSection[] { type, startMs, endMs, confidence, avgEnergy }
  transients: TimeMs[]
}
```

### 4.2 GodEarAnalyzer Output: `GodEarSpectrum`

GodEar V3 outputs `GodEarSpectrum` per frame (lines 2455-2488):

```
GodEarSpectrum {
  bands: GodEarBands { subBass, bass, lowMid, mid, highMid, treble, ultraAir }
  bandsRaw: GodEarBands (with flux crossfade)
  spectral: GodEarSpectralMetrics { centroid, flatness, rolloff, crestFactor, clarity }
  stereo: GodEarStereoMetrics | null { correlation, width, balance }
  transients: GodEarTransients { kick, snare, hihat, any, strength }
  agc: GodEarAGCState
  meta: GodEarMetadata
  dominantFrequency, totalEnergy
  chroma: number[12]
  spectralFluxV3?: number
  photon: GodEarPhoton { saturation, wallIntensity, strobe, hue, colorSnap, chromaFlux, spectralFlux, transientDensity, whiteNoiseScore }
  rhythmic: GodEarRhythmicPercussion { snare_energy, hh_energy, snare_absence_ms, hh_absence_ms, rhythmic_void }
}
```

### 4.3 Compatibility Assessment

**The current integration is already structurally compatible.** The consumer already maps `GodEarSpectrum.bands` → `HeatmapData.subBass/bassReal/lowMid/mid/highMid/treble/ultraAir` and `GodEarSpectrum.spectral.centroid/flatness` → `HeatmapData.spectralCentroid/spectralFlatness`. — lines 428-438

**However, the following GodEar V3 outputs are discarded by the current consumer:**

| GodEar V3 Output | Chronos Uses It? | Value If Captured |
|-----------------|------------------|-------------------|
| `transients.kick/snare/hihat` | ❌ No | Could replace single-band `detectTransients()` with 3-band detection |
| `spectral.rolloff` | ❌ No | Better section classification (EDM vs hip-hop) |
| `spectral.crestFactor` | ❌ No | Dynamic range → better buildup/drop detection |
| `spectral.clarity` | ❌ No | Master quality → could flag compressed sections |
| `stereo.*` | ❌ No (mono only) | Stereo field mapping for spatial lighting |
| `chroma[12]` | ❌ No | Harmonic content → color/hue mapping for timeline |
| `photon.saturation` | ❌ No | Brickwall detection → better drop classification |
| `photon.whiteNoiseScore` | ❌ No | Noise detection → breakdown/verse classification |
| `photon.transientDensity` | ❌ No | Percussion density → section energy proxy |
| `rhythmic.snare_energy` | ❌ No | Snare-driven section detection |
| `rhythmic.rhythmic_void` | ❌ No | Silence/break detection |
| `spectralFluxV3` | ❌ No (uses simple `|Δenergy|`) | Superior onset detection for beat grid |

**Verdict:** No structural adapter is needed — the types are already compatible. But the consumer is **throwing away 70% of GodEar V3's telemetry**. The integration is structurally complete but semantically shallow.

---

## 5. VERDICT & TRANSPLANT STRATEGY

### 5.1 Final Engineering Verdict

**The "transplant" is already complete (since WAVE 2077). The real question is: "Should the Chronos offline consumer be deepened to exploit GodEar V3's full telemetry?"**

**Answer: YES — but as an enhancement, not a transplant.**

The current integration is:
- ✅ **Structurally sound** — types are compatible, worker integration works
- ✅ **DSP-correct** — uses the real Cooley-Tukey FFT, real LR4 filters, real Blackman-Harris windowing
- ❌ **Semantically shallow** — discards chroma, stereo, saturation, snare/hihat isolation, spectral flux V3, rhythmic void, crest factor, rolloff, clarity
- ❌ **Performance-suboptimal** — reintroduces per-frame `Float32Array` allocation that GodEarAnalyzer eliminated
- ❌ **Code-duplicated** — worker is a 700-line copy of the main-thread path
- ❌ **Transient-inferior** — uses single-band onset detection when GodEar has 3-band with refractory periods

### 5.2 Recommended Enhancement Strategy (4 Phases)

**Phase 1: Eliminate per-frame allocation (LOW RISK, HIGH IMPACT)**
- Pre-allocate a single `Float32Array(fftSize)` window buffer outside the loop in `extractEnergyHeatmap()`
- Reuse it across all frames via `window.set(samples.subarray(...))` + `window.fill(0, copyLength)`
- This eliminates ~3,600 garbage allocations for a 3-minute song
- **Estimated effort:** 1 function change, ~10 lines

**Phase 2: Replace `detectTransients()` with GodEar's 3-band onset detection (MEDIUM RISK, HIGH IMPACT)**
- The current `detectTransients()` runs its own slope-based detector on raw samples
- Instead, collect `spectrum.transients.kick/snare/hihat` per heatmap frame during `extractEnergyHeatmap()`
- Store as `transientEvents: Array<{ timeMs, type: 'kick'|'snare'|'hihat', strength }>`
- This gives Chronos **instrument-classified transients** instead of generic onsets
- **Adapter needed:** Yes — must extend `AnalysisData.transients` or add a new `transientEvents` field

**Phase 3: Enrich section detection with GodEar metrics (MEDIUM RISK, MEDIUM IMPACT)**
- Feed `spectral.rolloff`, `photon.saturation`, `photon.whiteNoiseScore`, and `rhythmic.rhythmic_void` into `detectSections()`
- Use `rhythmic_void > 0.8` to detect breakdowns (currently misclassified as bridges)
- Use `saturation > 0.7` to detect drops (currently detected only by subBass energy)
- Use `whiteNoiseScore > 0.5` to detect noise-heavy sections (currently undetected)
- **Adapter needed:** Yes — must collect these metrics per frame in `extractEnergyHeatmap()`

**Phase 4: De-duplicate the worker (LOW RISK, MAINTENANCE IMPACT)**
- Extract the shared analysis functions into a separate module (e.g., `analysisPipeline.ts`)
- Import from both `GodEarOffline.ts` and `godear-offline.worker.ts`
- This eliminates the 700-line duplication and ensures fixes propagate automatically

### 5.3 What NOT to Do

- **Do NOT replace GodEarAnalyzer.** It is the superior engine and is already integrated.
- **Do NOT write a new FFT.** The existing Cooley-Tukey Radix-2 DIT with LUT is verified, optimized, and zero-allocation.
- **Do NOT enable AGC for offline analysis.** The current `useAGC: false` is correct — offline analysis needs raw values for consistent heatmap normalization (peak normalization is applied instead, lines 484-509).

### 5.4 Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Phase 1 breaks heatmap output | Low | Medium | Run existing tests + compare heatmap arrays before/after |
| Phase 2 changes transient format | Medium | High | Add new `transientEvents` field, keep old `transients: TimeMs[]` for backwards compat |
| Phase 3 changes section classification | Medium | Medium | A/B compare section boundaries on reference tracks |
| Phase 4 worker refactor breaks Vite bundling | Low | High | Test worker creation in dev + production build |

---

## APPENDIX A: File Inventory

| File | Lines | Role |
|------|-------|------|
| `src/workers/GodEarFFT.ts` | ~2,800 | **DSP Core** — GodEarAnalyzer class, FFT, LR4, all DSP modules |
| `src/workers/GodEarFFT.test.ts` | ~800 | Verification suite (brute-force DFT comparison, Parseval, separation) |
| `src/chronos/analysis/GodEarOffline.ts` | 994 | **Chronos consumer** — orchestration + beat/section/transient detection |
| `src/chronos/analysis/godear-offline.worker.ts` | 714 | **Worker duplicate** of the consumer pipeline |
| `src/chronos/core/types.ts` | — | `AnalysisData`, `HeatmapData`, `BeatGridData` type definitions |

## APPENDIX B: Algorithm Verification Status

GodEarFFT's Cooley-Tukey implementation has been **mathematically verified** (per code comments and test suite):
- ✅ Verified against brute-force O(N²) DFT for N=4 to N=4096
- ✅ Max error ~3e-5 at N=4096 (Float32 precision limit)
- ✅ Parseval energy conservation: relative error < 3e-9
- ✅ LR4 separation test: 50Hz tone correctly isolated in subBass band
- ✅ Bit-reversal table verified
- ✅ Twiddle factor LUT verified

The Chronos consumer's beat detection, section detection, and BPM estimation are **not** mathematically verified — they are heuristic algorithms with no formal test coverage beyond integration tests.

---

**AUDIT COMPLETE. No migration code was written. Awaiting authorization for Phase 1-4 enhancement strategy.**
