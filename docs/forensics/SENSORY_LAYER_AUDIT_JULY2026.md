 SENSORY LAYER RE-AUDIT — July 2026
Scope: GodEarFFT.ts, IntervalBPMTracker.ts, BeatDetector.ts Reference: V2 Audit (March 2026, WAVE 2301) Mode: Read-only — no modifications made

1. GodEarFFT.ts — FFT Core
Unchanged Since V2 Audit
Algorithm: Cooley-Tukey Radix-2 DIT, N=4096, Float32 — identical to audit
Blackman-Harris coefficients: a0=0.35875, a1=0.48829, a2=0.14128, a3=0.01168 — identical
Zero-allocation hot path: All 7 pre-allocated buffers (inputBuffer, dcBuffer, windowedBuffer, fftReal, fftImag, magnitudes, monoMixBuffer) still created once in constructor. No new, .slice(), .sort() in analyze() hot path.
Twiddle factors: Still computed on-the-fly with Math.cos() / Math.sin() per butterfly — no LUT implemented (P2 observation unchanged)
Magnitude calculation: Still Math.sqrt(re² + im²) per bin in computeMagnitudeSpectrum() — P2 #3 not fixed (2049 unnecessary Math.sqrt calls that get squared back in extractBandEnergy())
Bit-reversal table: Still Uint16Array singleton (P2 observation unchanged)
GC pressure: Return object still constructs ~7 ephemeral object literals per frame (GodEarSpectrum, rawBands, bands, spectral, transients, agc.getState(), meta). Unchanged — not a real problem per V2 assessment.
Chromagram (WAVE 2301): computeChromaFromSpectrum() still present between Stage 4 and Stage 5, zero-allocation into pre-allocated chromaBuffer. Array.from(this.chromaBuffer) at return is the only per-frame allocation (12 elements, negligible).
SlopeBasedOnsetDetector: Unchanged — 8-sample circular buffer, short-term + long-term slope thresholds
LR4 filter masks: Still singleton Map<string, Float32Array>, pre-computed once
Improvements Since V2 Audit
getInfo() string corrected — Now returns "Radix-2 DIT FFT" instead of the incorrect "Split-Radix FFT". P2 #4 from V2 audit is CLOSED.
@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:1564
WAVE 3424/3425: Post-FFT amplitude recovery — New scaleBandEnergyForVisual() function with POST_FFT_LEGACY_EQ_GAIN = 2.25 and POST_FFT_BAND_OUTPUT_CLAMP = 1.0. Converts RMS average to integrated RMS estimate (rms_avg × sqrt(Σw)) then applies legacy-equivalence gain. Applied to pre-AGC band path used by UI/DMX and rBPM feed. This was not in the V2 audit.
@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:253-273
@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:657-664
WAVE 3290: Console blackout — All console.* methods silenced at module load via IIFE. Prevents log flooding from FFT worker but could hinder debugging in production.
@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:149
New Observations
GodEarMetadata.version type still includes '1.0.0' | '2.0.0' — the '1.0.0' variant is dead code
RADIX2_RAW_TELEMETRY_INTERVAL_FRAMES = 60 — new periodic telemetry counter, logs scaled band peaks every 60 frames
2. IntervalBPMTracker.ts — Rhythm Detection
Unchanged Since V2 Audit
Ratio-based kick detection: ENERGY_RATIO_THRESHOLD = 1.6, DELTA_THRESHOLD = 0.008 — identical
Adaptive debounce: DEBOUNCE_FACTOR = 0.40, MIN_INTERVAL_MS = 200 — identical
MIN_KICK_ENERGY = 0.150 — identical
PEAK_DECAY = 0.995 — identical
BPM_HISTORY_SIZE = 8 — identical (was already reduced from 12 in WAVE 2171 before the audit)
Buffer Purge: Still present. Purge ratio tightened from 0.50/2.00 to 0.65/1.55 (WAVE 2492) — this was already in place at V2 audit time
Silence timeout: SILENCE_TIMEOUT_MS = 5000 — identical
Confidence decay: CONFIDENCE_DECAY_PER_FRAME = 0.001 — identical
Improvements Since V2 Audit (WAVE 7002.4 — Major Upgrade)
REC-12: Autocorrelation Validator — New independent BPM measurement via spectral autocorrelation of energy history (64-sample buffer, runs every 30 frames ≈ 1.4s). Cross-validates interval-based BPM:
Agreement ±5% → confidence boosted by +0.1
Disagreement >10% → confidence lowered by -0.15
@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/workers/IntervalBPMTracker.ts:695-757
REC-13: 1D Kalman Filter — Sub-integer BPM precision (126.3 instead of 126). Process noise Q=0.5, measurement noise R scaled by (1-confidence), initial covariance P0=100. Used as stableBpm when initialized, falling back to integer median for cold start. Reset on tempo change.
@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/workers/IntervalBPMTracker.ts:650-674
REC-10: Tempo-Change Detection — Tracks rejected BPMs. If 4+ consecutive rejections cluster within ±10% of their mean, flushes history buffer and reseeds with the new tempo. Resets Kalman to new tempo. Prevents outlier rejection from blocking genuine tempo changes.
@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/workers/IntervalBPMTracker.ts:484-516
REC-9: IQR-Based Confidence — Replaced max-min spread with interquartile range (Q3−Q1). More robust against single outliers — one wild BPM in 8 samples no longer tanks confidence to 0. Normalization range: IQR of 30 BPM → conf ~0.0.
@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/workers/IntervalBPMTracker.ts:802-838
WAVE 7003 (F7): Fold Boundary Hysteresis — lastMusicalBpm field with 5-BPM dead zone around pocket boundaries. Prevents 33-44 BPM jitter jumps when raw BPM oscillates ±1-2 BPM around a pocket edge.
@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/workers/IntervalBPMTracker.ts:918-944
WAVE 2181: Extended Polyrhythmic Folding — Added ÷3.0 (triple-time DnB/Speedcore) and ÷4.0 (quadruple-time Gabber) fold-down ratios, plus ×3.0 (ultra-slow ambient) and ×4.0 (sub-bass crawl) fold-up ratios. Prior audit only documented 3 down + 2 up ratios; now 5 down + 4 up.
@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/workers/IntervalBPMTracker.ts:946-979
Stale Comment
PEAK_DISCRIMINATOR_RATIO — Comment says "WAVE 2170: lowered from 0.75 → 0.50" but actual value is 0.65. The V2 audit correctly reports 65%. The comment is stale — the value was likely adjusted back to 0.65 after an intermediate 0.50 experiment, without updating the comment.
@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/workers/IntervalBPMTracker.ts:148
3. BeatDetector.ts — PLL Engine
Unchanged Since V2 Audit
Architecture: PI controller + flywheel + anticipatory lookahead — identical
PLL_SOFT_CORRECTION_WINDOW_MS = 120 — base value unchanged
PLL_PROPORTIONAL_GAIN = 0.3 — identical
PLL_INTEGRAL_GAIN = 0.005 — identical
PLL_LOOKAHEAD_MS = 23 — identical
PLL_BEAT_WINDOW = 0.12 — identical
PLL_SILENCE_TIMEOUT_MS = 4000 — identical
Anti-windup clamp: ±200ms on integral error — identical
Still runs on main thread — P2 #1 not fixed (not unexpected — V2 audit classified as long-term debt)
Redundant clustering/kick detection — P2 #5 not fixed. updateBpmWithPacemaker(), clusterIntervals(), findDominantCluster() all still present as parallel BPM tracking to the Worker's IntervalBPMTracker
updatePhase() still present as @deprecated dead code
MIN_PEAK_SPACING_MS = 280 — unchanged (WAVE 2099)
MIN_INTERVAL_MS = 280 — unchanged, aligned with debounce
Improvements Since V2 Audit
WAVE 2488 DT-06: Configurable PLL Soft Correction Window — pllSoftCorrectionWindowMs now configurable via AudioConfig. V2 audit problem #3 ("should be adaptive based on genre") is ADDRESSED. Reference values documented: 120ms techno, 150ms pop/rock, 200ms jazz/polyrhythm, 100ms latino/dembow.
@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/audio/BeatDetector.ts:329-345
WAVE 7002.4 REC-11: PLL Frequency Feedback — PLL_FREQUENCY_GAIN = 0.15. PLL now derives frequency from kick intervals independently of clustering algorithm, blending with pllSmoothedBpm at low gain. Outlier intervals (ratio <0.65 or >1.55) rejected. Makes PLL a true frequency-tracking loop rather than depending on clustering BPM.
@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/audio/BeatDetector.ts:544-558
PLL Stabilization Clamp — When locked and confidence >0.5, BPM shift clamped to ±1.5 BPM per beat. Prevents sudden jumps from single outlier intervals.
@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/audio/BeatDetector.ts:566-571
WAVE 2512 FIX 1: PLL Silence Veil — state.onBeat forced to false when PLL is not locked. Prevents phantom beats when Pacemaker freewheels at minBpm=60 (1000ms/beat). Internal pllOnBeat continues circulating for rapid re-lock.
@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/audio/BeatDetector.ts:667-672
WAVE 2179: freewheelAt() method — Explicit freewheel mode: sets PLL frequency without assuming lock. pllIsLocked stays false. Separates setBpm() (Worker has signal, assumes lock) from freewheelAt() (Worker is deaf, brain remembers).
@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/audio/BeatDetector.ts:1027-1033
WAVE 7002: feedKick() method — External bridge allowing Worker-reported beats to feed PLL phase corrector directly, bypassing the redundant clustering path.
@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/audio/BeatDetector.ts:996-998
REC-11: Blend toward clustering BPM — When PLL is not locked, pllSmoothedBpm blends toward state.bpm at 10% per tick instead of hard overwrite. Preserves PLL frequency memory during brief unlock periods.
@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/audio/BeatDetector.ts:647-649
4. Transient Shaping Assessment
No explicit transient shaping or micro-optimizations were injected into the Sensory Layer files themselves (GodEarFFT.ts, IntervalBPMTracker.ts, BeatDetector.ts) since the V2 audit.

Transient shaping logic exists downstream in the HAL/Physics layer:

LiquidStereoPhysics.ts (WAVE 2427): trebleDelta = Math.max(0, currentTreble - lastTreble) with gate + exponent shaping for snare/back-right channel
LiquidEngineBase.ts (WAVE 6070): Hybrid fusion — (highMidDelta + trebleDelta) × snareSpectrum × 10.0 > 0.19 with 45ms debounce anti-jitter and ~90ms snare hold counter
These are in the physics engine, not the sensory layer, and were already present at V2 audit time.

5. Summary: P2 Findings Status
V2 P2 #	Description	Status
1	PLL on main thread	Unchanged — long-term debt
2	±23ms temporal jitter	Unchanged — architectural
3	Unnecessary Math.sqrt in magnitude spectrum	Unchanged
4	getInfo() says "Split-Radix"	✅ CLOSED — now says "Radix-2 DIT FFT"
5	Dead code in BeatDetector.ts	Unchanged — clustering still redundant
6	AGCTrustZone.rmsHistory uses Array.shift()	Unchanged
7	BIN_RESOLUTION/NYQUIST assume 44100Hz	Unchanged
8	Fold ambiguity (×0.75 priority over ÷1.5)	Partially addressed — hysteresis (WAVE 7003) reduces jitter at boundaries, though priority order unchanged
6. Overall Assessment
The Sensory Layer has undergone a significant upgrade wave (WAVE 7002.4/7003) since the March 2026 audit, primarily targeting the BPM tracking and PLL subsystems:

IntervalBPMTracker gained three new independent measurement systems (autocorrelation validator, Kalman filter, tempo-change detection) and IQR-based confidence. These are substantive algorithmic additions, not micro-tweaks.
BeatDetector PLL gained true frequency-tracking capability (REC-11), configurable soft correction window per genre (DT-06), phantom beat suppression (Silence Veil), and explicit freewheel/feedKick API separation.
GodEarFFT core algorithm is untouched — correctly left alone. The only addition is post-FFT amplitude recovery (WAVE 3424/3425) for visual/DMX scaling consistency.
No regressions were identified. The core DSP pipeline (FFT, windowing, crossover, zero-allocation) remains identical and correct. The P2 findings that remain open are architectural debt items that were already classified as non-blocking.



