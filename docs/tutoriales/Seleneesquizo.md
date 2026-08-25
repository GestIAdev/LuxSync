I'll hunt the three vectors in parallel. Starting with the file locations and key patterns.

EffectDreamSimulator's `.push()` calls are bounded by candidate iteration (not history accumulation). Let me search more broadly for unbounded history arrays across the intelligence core, and dig into the NaN/overflow vectors.

Key finding emerging: `spectralHistory` at `SeleneTitanConscious.ts:1045-1047` does `.push()` without a visible cap. Let me verify this and check the other history arrays. Also need to check CrestDetector divisions and PredictionEngine for overflow.

CrestDetector divisions are all epsilon-guarded (`EPS_E = 1e-4`, `LN2` constant, `R_REF` constant, `rFused + R_REF` denominator never zero). The history arrays in SeleneTitanConscious are all capped. Let me check PredictionEngine and AudioMatrix for overflow, plus scan for any other unbounded arrays I might have missed.

Strong lead: `ContextualMemory.ts:296` `transientTimestamps.push` and `:394` `sectionHistory.push` — let me verify if these have caps. Also `EnergyConsciousnessEngine.ts:631` `energyHistory.push` and `EffectBiasTracker.ts:135`. Let me check each.

`EffectBiasTracker`, `EnergyConsciousnessEngine`, `SeleneTitanConscious` histories — all capped. `ContextualMemory.transientTimestamps` is filtered by time window (bounded by `transientWindowMs`). `sectionHistory` uses `.getAll()` suggesting a bounded structure. Let me verify `sectionHistory` type and check the `frameCount` modulo patterns + AudioMatrix overflow.

`sectionHistory` is a `CircularBuffer` (capped at 8). `transientTimestamps` is time-window-filtered (bounded by 1s window). `frameCount` in ContextualMemory is only used for log throttling (delta comparison, not modulo). Now let me check AudioMatrix and the broader audio/senses pipeline for unbounded counters and overflow-prone patterns.

Found a real bug. `PredictionEngine.ts:1061` and `:1075` use `energyHistory.length % 600 === 0` and `% 60 === 0` for log throttling — but `energyHistory` is capped at `MAX_ENERGY_HISTORY = 30` (line 891/934). Once it fills to 30, `.shift()` keeps it at 30 forever, so `length % 600` and `length % 60` are never 0 again. This is a logic bug but not a 3-hour crash vector (it just stops logging after 0.5s). Let me note it but keep hunting the real overflow.

The `totalSamplesWritten` in AudioMatrix is the interesting one — let me check its type and the modulo usage, plus scan the senses pipeline for the PLL/phase anchoring.

The `totalSamplesProcessed` counters are JS `number` (doubles) — safe at 5e8. But the directive specifically flags Float32 precision. Let me check if any of these counters or timestamps get stored in `Float32Array`, and trace the PLL/phase accumulator.

The phase accumulator lives in `KickPhaseGate`. This is the critical PLL component. Let me read it fully.

The `KickPhaseGate` phase accumulator is safe — `elapsed` is bounded by `PHASE_STALE_MS = 4000` via the stale check. The `totalKicks | 0` is 32-bit but 21,600 kicks at 3h/120BPM is far below 2^31. Let me trace `energyMaxHistoric` (used in unguarded-ish divisions) and check for Float32 coercion of the sample counter.

`energyMaxHistoric` is from `RollingStats.max` (bounded window) and divisions are `Math.max(..., 0.01)` guarded. Let me check `RollingStats` for NaN vectors, and hunt for `| 0` coercion of large timestamps/counters that could overflow at 3 hours.

Found a potential precision issue in `PredictionEngine.ts` — `C2`, `C1`, `N2`, `N1` are `Float32Array` "leaky counts." Let me read their update logic and check if they accumulate beyond Float32 precision over 3 hours.

The PredictionEngine leaky counters converge to steady-state (~40 and ~17) — no Float32 overflow. Let me check `RollingStats` config for `minStdDev` (zScore division safety) and look at the `GodEarFFT`/`TrinityBridge` workers for unbounded counters.

Found three potential unbounded arrays in the workers. Let me verify `TrinityBridge.phaseHistory`, `IntervalBPMTracker.rejectedBpmHistory`, and the worker `state.errors` arrays.

Critical lead on `IntervalBPMTracker.rejectedBpmHistory` — it grows without bound when rejections don't cluster. Let me verify if this class is still in the active hot path or if it's legacy after the WAVE 7002 refactor.

The comments say `IntervalBPMTracker` is retired from real-time tempo estimation but may still be active for kick counting. Let me verify if it's actually instantiated in the worker.

`IntervalBPMTracker` is NOT instantiated in production (only in tests) — the `rejectedBpmHistory` leak is dead code. Let me hunt for unbounded `Map`/`Set` caches and check the `DreamEngineIntegrator` cache eviction.

The `dreamCache` Map never evicts expired entries (only `clear()` on mood change / explicit invalidation). Let me check how often `invalidateDreamCache()` is called and whether the cache can accumulate between clears.

The `dreamCache` is cleared on each effect fire — bounded between fires. Let me check the `EffectDNA.effectUsageCount` Map for unbounded growth, and the `LiquidTelemetryRecorder` ring buffer for index overflow.

Let me check the `DecisionMaker.logThrottles` Map for unbounded growth, and the `EnergyConsciousnessEngine` for running accumulators that could drift.

I've completed a thorough audit of the slow-burn corruption vectors. Here are my findings, ranked by severity:

---

## Audit Results: Slow-Burn Corruption Vectors

### 1. VERIFIED BUG: `PredictionEngine.ts` — Dead Log Throttles (Logic Bug)

**File**: `PredictionEngine.ts:1061` and `:1075`

`energyHistory` is capped at `MAX_ENERGY_HISTORY = 30` (line 891/934), but the log throttles use:
```ts
if (energyHistory.length % 600 === 0 ...)  // line 1061
if (energyHistory.length % 60 === 0 ...)   // line 1075
```

Once the buffer fills to 30, `length` stays at 30 forever. `30 % 600 = 30 ≠ 0` and `30 % 60 = 30 ≠ 0` — **these throttle conditions never fire after the first 0.5 seconds**. Not a crash vector, but a real logic bug that silently kills diagnostic logging.

### 2. VERIFIED BUG: `IntervalBPMTracker.ts` — Unbounded `rejectedBpmHistory` (Dead Code)

**File**: `IntervalBPMTracker.ts:516-522`

When BPM rejections don't cluster within ±10%, the array grows without bound and the `reduce`/`every` at lines 519-522 scan the entire array every frame — O(n) per frame. At 60fps × 3 hours = 648K entries → catastrophic slowdown.

**However**: `new IntervalBPMTracker` only appears in test files. The WAVE 7002 refactor replaced it with `TempoOracle` + `KickPhaseGate`. This is **dead code in production** — a latent landmine if anyone re-instantiates it.

### 3. VERIFIED VULNERABILITY: Worker `state.errors` Arrays (Unbounded)

**Files**: `senses.ts:346` and `mind.ts:490`

```ts
state.errors.push(errorMsg);  // no cap, no shift
```

If a recurring error condition develops (e.g., NaN propagation causing repeated exceptions), this grows by 1 per frame. At 648K frames × ~100 bytes/string = ~65MB. Won't crash directly, but GC pressure + try/catch overhead could slow the worker, causing it to fall behind real-time and cascade.

### 4. LOW RISK: `DreamEngineIntegrator.dreamCache` — No Entry-Level Eviction

**File**: `DreamEngineIntegrator.ts:117`

Expired entries are never deleted (only `clear()` on mood change / effect fire). Between clears, entries accumulate with different cache keys. Bounded by cache key combinatorics (~1200 max unique keys between clears). Not a 3-hour crash vector.

### 5. SAFE: `RollingStats` Running Sum Drift

After 648K iterations, floating-point error in `sum`/`sumSquares` is ~1e-10 — negligible. Masked by `minStdDev: 0.10` anyway.

### 6. SAFE: `CognitiveFluidState._timeHigh` Accumulator

Grows unboundedly but only feeds `sigmoid(_timeHigh / tau_sat - 2)` which saturates at 1.0. Bounded by the sigmoid. No precision issue at 3-hour scale.

### 7. SAFE: Audio Sample Counters

`AudioRingBuffer._totalSamplesProcessed` and `SensesPipeline.totalSamplesProcessed` are JS `number` (Float64). At 5e8 samples (3h @ 44.1kHz), well within 2^53 precision. `KickPhaseGate` phase accumulator is bounded by `PHASE_STALE_MS = 4000`. No Float32 coercion found in the chain.

---

**Bottom line**: I did NOT find a single definitive "3-hour sudden crash" vector in the slow-burn category. The most likely root cause remains the **V(t) saturation mechanism** identified in the previous audit — a long musical valley causes `vaporPressure` to climb to 0.60, depressing Q(t) and causing rapid-fire, and the lack of `reset()` on the UI toggle prevents recovery. The "3 hours" timing is likely coincidental with the DJ's set structure.

The most actionable fixes are:
1. Cap `state.errors` arrays in the workers (e.g., `.slice(-100)`)
2. Fix the `energyHistory.length % 600` dead throttle in PredictionEngine
3. Add a cap to `rejectedBpmHistory` in the dead `IntervalBPMTracker` (defensive)

Would you like me to apply any of these fixes?