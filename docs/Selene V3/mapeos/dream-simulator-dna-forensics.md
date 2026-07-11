# Dream Simulator DNA Forensics: Target Origin, Scoring Math & Mutant Awareness

**Date:** 2026-07-11  
**Analyst:** Lead Cognitive Systems Architect  
**Scope:** `EffectDreamSimulator.ts`, `EffectDNA.ts` (DNAAnalyzer), `DynamicEffectRegistry.ts`, `lfxTypes.ts`

---

## Executive Summary

The **"Fake Target" hypothesis is PARTIALLY CONFIRMED**. The Target DNA is not entirely static — it does react to energy, harshness, and spectral flatness. However, **5 of 8 audio inputs** fed into the target derivation are either hardcoded constants, vibe-static values, or crude derivatives of a single energy scalar. The target DNA is "semi-fake": it moves with the music's overall loudness and spectral texture, but is blind to bass/mid/treble ratios, real syncopation, real kick detection, and fills.

The Dream Simulator has **ZERO awareness** of whether a candidate is a newborn mutant or a consolidated blueprint. Organisms are injected into the `DynamicEffectRegistry` with the same interface as builtin effects — no `organismId`, `trials_count`, or `generation` metadata survives into the scoring path.

---

## 1. The Origin of the "Ideal DNA" Target

### 1.1 Call Chain

```
EffectDreamSimulator.calculateDNARelevance()   [line 1084]
  └─ DNAAnalyzer.deriveTargetDNA(musicalContext, audioMetrics)   [line 1142]
       └─ calculateRawTarget(context, audioMetrics)   [line 298]
            └─ EMA smoothing (α=0.30)   [lines 301-315]
            └─ Snap overrides for drop/breakdown   [lines 318-329]
            └─ returns smoothedTarget
```

### 1.2 The Raw Target Formula (EffectDNA.ts:504-582)

The raw target `[A, C, O]` is computed from `MusicalContextForDNA` + `AudioMetricsForDNA`:

**Aggression:**
```
A = clamp(
  (energy × 0.348) +
  (kickIntensity × 0.217) +
  (harshness × 0.174) +
  (bassBoost × 0.261),
  0, 1
)
```
Where `bassBoost = clamp((bass/mid - 1) × 0.5, 0, 0.5)`

**Chaos:**
```
C = clamp(
  (syncopation × 0.35) +
  (spectralFlatness × 0.30) +
  (fillBonus) +              // 0.3 if fillDetected, else 0
  (|trend| × 0.15),
  0, 1
)
```

**Organicity:**
```
O = clamp(
  (moodOrganicity × 0.30) +
  (sectionOrganicity × 0.30) +
  ((1 - harshness) × 0.25) +
  (groove × 0.15),
  0, 1
```

**Confidence:**
```
confidence = context.confidence × rhythmConfidence
```

### 1.3 The Fake Inputs (The Smoking Gun)

The Dream Simulator constructs the inputs to `deriveTargetDNA` in `calculateDNARelevance()` at **lines 1102-1138**. Here is what is real vs. fake:

| Input | Value Source | Verdict |
|---|---|---|
| `energy` | `state.energy` ← `context.pattern.energy` | **REAL** — audio-derived scalar |
| `harshness` | `context.spectral?.harshness ?? 0.4` | **REAL** if spectral context provided, else fallback 0.4 |
| `spectralFlatness` | `context.spectral?.flatness ?? 0.5` | **REAL** if spectral context provided, else fallback 0.5 |
| `bass` | `state.energy × 0.7` | **FAKE** — not real bass, just energy scaled |
| `mid` | `0.5` | **FAKE** — hardcoded constant |
| `treble` | `vibe.includes('techno') ? 0.6 : 0.4` | **FAKE** — vibe-static, never measures real treble |
| `syncopation` | `undefined` | **FAKE** — not available, defaults to 0 in formula |
| `kickIntensity` | `state.energy × 0.8` | **FAKE** — derived from energy, not real kick detection |
| `fillDetected` | `false` | **FAKE** — always false |
| `groove` | `vibe.includes('latino') ? 0.8 : 0.5` | **FAKE** — vibe-static binary |
| `confidence` | `0.75` | **FAKE** — hardcoded constant |
| `trend` | `state.energy > 0.5 ? 1 : state.energy < 0.3 ? -1 : 0` | **PARTIAL** — ternary from energy, not real trend analysis |

**Code proof** (`EffectDreamSimulator.ts:1102-1138`):
```typescript
const musicalContext: MusicalContextForDNA = {
  energy: state.energy,
  syncopation: undefined,  // No disponible directamente
  mood: this.deriveMusicalMood(context),
  section: { type: ..., confidence: 0.75 },
  rhythm: {
    drums: { kickIntensity: state.energy * 0.8 },  // Derivado de energía
    fillDetected: false,
    groove: context.vibe.includes('latino') ? 0.8 : 0.5,
    confidence: 0.7
  },
  energyContext: { trend: state.energy > 0.5 ? 1 : state.energy < 0.3 ? -1 : 0 },
  confidence: 0.75
}

const audioMetrics: AudioMetricsForDNA = {
  bass: state.energy * 0.7,           // NOT real bass
  mid: 0.5,                            // HARDCODED
  treble: context.vibe.includes('techno') ? 0.6 : 0.4,  // VIBE-STATIC
  volume: state.energy,
  harshness,
  spectralFlatness
}
```

### 1.4 EMA Smoothing & Snap Overrides

The raw target is smoothed with EMA (α=0.30) to prevent "Digital Parkinson's":
```
smoothed.A = 0.30 × raw.A + 0.70 × smoothed.A
```

Snap overrides bypass smoothing for section changes:
- **Drop** (confidence > 0.7): `A = max(A, 0.80)`, `O = min(O, 0.25)`
- **Breakdown** (confidence > 0.7): `A = min(A, 0.25)`, `O = max(O, 0.75)`

### 1.5 What the Target Actually Reacts To

Because of the fake inputs, the target DNA effectively reacts to only **3 real acoustic signals**:

1. **Energy** (scalar 0-1) — drives Aggression via `energy × 0.348` and indirectly via `kickIntensity = energy × 0.8` and `bass = energy × 0.7`
2. **Harshness** (spectral ratio 2-5kHz) — drives Aggression via `× 0.174` and Organicity via `(1-harshness) × 0.25`
3. **Spectral Flatness** (tonal vs. noise) — drives Chaos via `× 0.30`

The target does **NOT** react to:
- Real bass/mid/treble ratios (mid is always 0.5, treble is vibe-static)
- Real syncopation (always undefined → 0 in chaos formula)
- Real kick patterns (derived from energy)
- Drum fills (always false)
- Real groove analysis (vibe-static binary)
- AcousticRealityState (crest factors, spectral tension, Z-score phase — **zero awareness**)
- Real energy trend (ternary from energy, not from time-series analysis)

### 1.6 The `deriveMusicalMood` Function (EffectDreamSimulator.ts:1170)

Mood is derived from vibe name, not from acoustic analysis:
```typescript
if (context.vibe.includes('techno')) return 'aggressive'
if (context.vibe.includes('latino')) return 'euphoric'
if (context.vibe.includes('chill') || context.vibe.includes('ambient')) return 'melancholic'
return 'neutral'
```

This mood then maps to organicity via a static lookup table (`MOOD_ORGANICITY`):
- aggressive → 0.20, euphoric → 0.55, neutral → 0.50, melancholic → 0.80, dreamy → 0.90

### 1.7 Verdict on the "Fake Coordinates" Hypothesis

**CONFIRMED with nuance.** The target DNA is not entirely static — it does move with energy and spectral texture. But the movement is severely impoverished:

- **Aggression** is the most real axis — it gets energy, harshness, and a fake bass boost. But `bassBoost` is computed from `bass=energy*0.7 / mid=0.5`, so it's really just `(energy*1.4 - 1) * 0.5` — a monotonic function of energy. **Aggression is effectively a function of energy + harshness only.**
- **Chaos** is the most fake axis — `syncopation=0`, `fillDetected=false`, `trend` is ternary from energy. Only `spectralFlatness` is real. **Chaos is effectively a function of spectralFlatness + |energy_ternary| only.**
- **Organicity** is semi-real — it reacts to harshness (real), section type (derived from energy/zone), and mood (vibe-static). **Organicity is effectively a function of (1-harshness) + section_lookup + vibe_lookup.**

The target DNA lives in a reduced 3D space but only spans a 2D manifold driven by (energy, harshness, spectralFlatness). It cannot distinguish between a heavy bass drop and a screeching synth lead — both have high energy, but radically different acoustic profiles.

---

## 2. The Scoring Equation

### 2.1 Euclidean Distance → Relevance (EffectDreamSimulator.ts:1150-1162)

```typescript
const dA = effDna.aggression - targetDNA.aggression
const dC = effDna.chaos - targetDNA.chaos
const dO = effDna.organicity - targetDNA.organicity
const distance = Math.sqrt(dA*dA + dC*dC + dO*dO)

const MAX_DISTANCE = Math.sqrt(3)  // ≈ 1.732
let relevance = 1.0 - (distance / MAX_DISTANCE)
relevance = clamp(relevance, 0, 1)
```

**Note:** The Dream Simulator's `calculateDNARelevance` does NOT apply confidence weighting or diversity factors. That happens in `DNAAnalyzer.calculateRelevance()` (a separate method used elsewhere). The Dream Simulator uses the raw `1 - dist/√3` formula.

### 2.2 Full Scenario Score (`calculateScenarioScore`, line 1386)

```
FinalScore = clamp(0, 1,
    (projectedRelevance × 0.35)        // DNA match (was 0.45)
  + (diversityScore × 0.20)            // Diversity (independent, new)
  + (vibeCoherence × 0.15)             // Vibe match (was 0.18)
  + ((1 - riskLevel) × 0.13)           // Low risk (was 0.18)
  + (simulationConfidence × 0.05)      // Confidence (was 0.09)
  + explorationBoost                   // Anti-determinism: 0.12 or 0
  - (cooldownConflicts × 0.15)         // Penalty per conflict
  - (hardwareConflicts × 0.20)         // Penalty per conflict
  + dropBoost                          // +0.1 if drop coming & intensity > 0.7
  + perfectMatchBonus                  // +0.05 if adjRelevance > 0.80 & dist < 0.3
  + impactBoost                        // +0.40 if drop/spike & keyword match
  - slowPenalty                        // -0.40 if drop/spike & slow keyword
  + tensionBoost                       // +0.15 if buildup & tension keyword
  + atmosphericBoost                   // +0.20 if breakdown & atmospheric keyword
  + urgencyBoost                       // up to +0.18 if urgent & prob > 0.5
  + oracleConfidenceBoost              // up to +0.03 if prob > 0.7
)
```

### 2.3 Weight Summary Table

| Factor | Weight | Range | Notes |
|---|---|---|---|
| DNA Relevance | ×0.35 | 0–1 | Primary driver. `1 - euclidean_dist/√3` |
| Diversity | ×0.20 | 0–1 | Independent factor (WAVE 2104 refactor) |
| Vibe Coherence | ×0.15 | 0–1 | Match between effect and current vibe |
| Low Risk | ×0.13 | 0–1 | `1 - riskLevel` |
| Simulation Confidence | ×0.05 | 0–1 | Reduced from 0.09 |
| Exploration | +0.12 | 0 or 0.12 | 40% of effects per 8s window (hash-based) |
| Cooldown conflict | −0.15 | per conflict | Linear penalty |
| Hardware conflict | −0.20 | per conflict | Linear penalty |
| Drop boost | +0.10 | conditional | `isDropComing && intensity > 0.7` |
| Perfect match | +0.05 | conditional | `adjRelevance > 0.80 && dist < 0.3` |
| Impact keyword | +0.40 | conditional | Drop/spike + keyword in name |
| Slow keyword | −0.40 | conditional | Drop/spike + slow keyword |
| Tension keyword | +0.15 | conditional | Buildup + tension keyword |
| Atmospheric keyword | +0.20 | conditional | Breakdown + atmospheric keyword |
| Urgency | +0.18 max | conditional | `isUrgent && prob > 0.5`, scales with timeToEvent |
| Oracle confidence | +0.03 max | conditional | `prob > 0.7`, scales with prob |

### 2.4 Anti-Determinism: Exploration Factor (line 1414)

```typescript
const effectHash = this.hashEffectName(effectName)  // deterministic hash 0-99
const timeWindow = Math.floor(Date.now() / 8000)     // changes every 8s
const explorationSeed = (effectHash + timeWindow) % 100
const explorationBoost = (explorationSeed < 40) ? 0.12 : 0  // 40% get boost
```

This is NOT `Math.random()` — it's a deterministic rotation based on effect name hash + timestamp. Different effects get the boost in different 8-second windows, breaking pure determinism without violating the anti-simulation axiom.

### 2.5 Perfect Match Bonus (line 1452)

```typescript
const adjustedRelevance = scenario.projectedRelevance * scenario.diversityScore
if (adjustedRelevance > 0.80 && scenario.dnaDistance < 0.3) {
  score += 0.05
}
```

This is a small bonus for effects that are both close to the target DNA AND haven't been overused.

### 2.6 Oracle Prediction Boosts (lines 1462-1551)

The Dream Simulator receives prediction data from the Oracle (via `MusicalPrediction`) and applies keyword-based boosts:

- **Drop/spike incoming**: +0.40 for impact effects (strobe, flash, blind, gatling, thunder, meltdown, storm, raid, snap, spark, burst, strike, glitch, saw, abyssal, rise, dualism, cyber), −0.40 for slow effects (breath, mist, drift, moon, wave, sweep, ambient, fiber, pulse, shimmer, plankton, whale, caustic)
- **Buildup starting**: +0.15 for tension effects (rise, sweep, ramp, build, acid)
- **Breakdown imminent**: +0.20 for atmospheric effects (mist, breath, ambient, fiber, drift, moon)
- **Urgency** (< 2s to event, prob > 0.5): up to +0.18 scaling with closeness
- **High oracle probability** (> 0.7): up to +0.03 scaling with probability

---

## 3. Newborn Mutants vs. Consolidated Effects

### 3.1 Verdict: ZERO Differentiation

The Dream Simulator has **no awareness** of whether a candidate is a newborn mutant or a consolidated blueprint. The search for `organismId`, `trials_count`, `newborn`, `mutant`, `genesis`, `mutat` in `EffectDreamSimulator.ts` returned **zero results**.

### 3.2 How Mutants Enter the Registry

Mutants are materialized and injected via `ArenaInject` in `DynamicEffectRegistry.ts:179-217`:

```typescript
const mat = materializer.materialize(candidate.organismId)
const clip = mat.clip
// ... wraps in LFXFileV3 and calls registerEffectV3
```

After injection, the mutant exists as a `RegistryEntry` with the same interface as any builtin effect. The `RegistryEntry` interface (`lfxTypes.ts:217-264`) contains:

- `id`, `name`, `author`, `category`, `tags`
- `dna: FrozenGenome` (aggression, chaos, organicity)
- `simMeta: SimulationMeta` (beautyWeights, gpuCost, isStrobe, isDivineCandidate, isHeavyCandidate, zScoreGuards)
- `execHints`, `safetyDecl`, `isBuiltin`

**No `organismId`, no `trials_count`, no `generation`, no `isMutant` flag.** Once injected, a mutant is indistinguishable from a builtin effect in the eyes of the Dream Simulator.

### 3.3 Implications for Genesis Ecosystem Routing

If the Genesis ecosystem is to be routed through the Dream Simulator, the following gaps must be addressed:

1. **No nurture bias**: Newborn mutants with low `trials_count` receive no scoring advantage. They compete on equal footing with battle-tested blueprints that have optimized DNA coordinates. A mutant with slightly off DNA will lose every time.

2. **No generation awareness**: The simulator cannot apply different selection pressure to F1 vs F3 generations.

3. **No organism identity in scoring**: The `EffectCandidate` interface carries only `effect` (string ID), `effectName`, `intensity`, `zones`, `reasoning`, `confidence`. No organism metadata is threaded through the dream pipeline.

4. **Diversity factor is effect-ID-based**: The `DNAAnalyzer.effectUsageCount` tracks usage by `effectId` string. If a mutant's ID changes between injections (e.g., `mutant_001` → `mutant_002`), the diversity counter resets. If the ID persists, the mutant accumulates diversity penalties identically to consolidated effects.

5. **Metabolic telemetry is post-trigger only**: `EffectManager.trigger()` feeds metabolic telemetry to the ecology AFTER the effect fires (line 537). But the Dream Simulator's scoring happens BEFORE the trigger. The simulator cannot use metabolic data (fitness, trials, success rate) to bias selection.

---

## 4. Architecture Diagram: Data Flow into Target DNA

```
Real Audio
  │
  ▼
SensesPipeline
  │ produces: energy (scalar), spectral {harshness, flatness}, bpm, beatPhase
  ▼
TitanEngine.update()
  │ packs into MusicalContext
  ▼
SeleneTitanConscious.think()
  │ packs into PipelineContext { pattern.energy, spectralContext, ... }
  ▼
DreamEngineIntegrator.executeFullPipeline()
  │ builds SystemState { energy: pattern.energy, vibe }
  │ builds AudienceSafetyContext { spectral, energy, zScore, ... }
  ▼
EffectDreamSimulator.dreamEffects()
  └─ generateCandidates()          ← filters by vibe, zone, pressure, guards
  └─ simulateScenario()           ← computes per-candidate metrics
       └─ calculateDNARelevance()
            │ constructs MusicalContextForDNA {
            │     energy: state.energy,          ← REAL
            │     syncopation: undefined,        ← FAKE
            │     mood: vibe-string-match,       ← FAKE
            │     kickIntensity: energy*0.8,     ← FAKE
            │     fillDetected: false,           ← FAKE
            │     groove: vibe-binary,           ← FAKE
            │     trend: energy-ternary,         ← PARTIAL
            │   }
            │ constructs AudioMetricsForDNA {
            │     bass: energy*0.7,              ← FAKE
            │     mid: 0.5,                      ← FAKE
            │     treble: vibe-static,           ← FAKE
            │     volume: energy,                ← REAL (but = energy)
            │     harshness: spectral.harshness, ← REAL (if provided)
            │     spectralFlatness: spectral.flatness, ← REAL (if provided)
            │   }
            └─ DNAAnalyzer.deriveTargetDNA()
                 └─ calculateRawTarget()   ← formula from §1.2
                 └─ EMA smoothing (α=0.30)
                 └─ Snap overrides (drop/breakdown)
                 └─ returns TargetDNA { A, C, O, confidence }
```

---

## 5. Recommendations (For Future Implementation — Not Yet Implemented)

1. **Thread real acoustic data into `calculateDNARelevance`**: The `AudienceSafetyContext` already carries `spectral` and `zScore`. The `PipelineContext` carries `spectralContext` with texture, clarity, and band energies. These should replace the fake `bass`, `mid`, `treble`, `syncopation`, and `kickIntensity` values.

2. **Thread `AcousticRealityState` into the Dream Simulator**: The ARS (zone, phase, crest factor, spectral tension) is available in `SeleneTitanConscious` via `this.lastMemoryOutput?.acousticReality`. It should be passed through `PipelineContext` into the Dream Simulator and used to enrich the target DNA derivation.

3. **Add organism metadata to `RegistryEntry`**: A non-frozen `organismId?: string` and `trialsCount?: number` field would allow the Dream Simulator to apply nurture bias for newborns.

4. **Add nurture bias to `calculateScenarioScore`**: A small boost (e.g., +0.05) for effects with `trialsCount < 3` would give newborns a fighting chance against established blueprints without overriding DNA matching.

5. **Thread metabolic fitness into scoring**: The ecology database tracks fitness scores per organism. This could be injected as a prior into the scenario score, separate from DNA matching.
