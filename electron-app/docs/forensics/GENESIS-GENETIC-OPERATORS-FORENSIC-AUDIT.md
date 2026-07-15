# 🧬 GENESIS: Genetic Operators Forensic Audit

**Date:** 2026-07-11  
**Scope:** `GeneticOperators.ts`, `ColiseumService.ts` (mitosis/crossover), DNA inheritance mechanics  
**Mission:** Map exact mechanics of all mutation operators, identify "blind RNG" vs. Lamarckian behavior, catalog "junk DNA" generators, and deconstruct DNA inheritance flows.

---

## 1. The "Blind RNG" Analysis (Darwinian vs. Lamarckian)

### Verdict: 100% Blind Darwinian — Zero Contextual Awareness

**No operator reads any external context.** None of the 7 implemented operators accept parameters for `AcousticRealityState`, BPM, vibe, energy zone, or any environmental signal. Their signatures are uniformly:

```ts
function operatorX(parent: HephAutomationClipV3, seed?: number): OperatorResult
```

The only inputs are the parent clip and a deterministic seed. All mutation magnitudes are drawn from mathematical distributions (Cauchy, Pareto, uniform) with fixed scale parameters. There is **zero Lamarckian adaptation** — mutations are not directed by acoustic reality, musical phase, or performance context.

### RNG Distributions and Scales by Operator

| Operator | Distribution | Scale Param | Max Abs | Target | Lines |
|---|---|---|---|---|---|
| `point_mutation` | Truncated Cauchy | `scale=0.02` | `maxAbs=0.60` | Single keyframe value (×span) | `:348-349` |
| `point_mutation` (bezier) | Truncated Cauchy | `scale=0.03` | `maxAbs=0.80` | Single bezier handle | `:369` |
| `temporal_stretch` | Truncated Cauchy | `scale=0.15` | `maxAbs=0.90` | Time factor (1.0 + Cauchy) | `:548` |
| `gene_splice` | Truncated Cauchy | `scale=0.04` | `maxAbs=0.50` | Interpolated keyframe value noise | `:636` |
| `phase_epigenetics` (spreadDeg) | Truncated Cauchy | `scale=30` | `maxAbs=360` | spreadDeg field | `:482` |
| `phase_epigenetics` (shuffle) | Truncated Cauchy | `scale=0.05` | `maxAbs=0.50` | shuffle field | `:493` |
| `phase_epigenetics` (wings) | Pareto | `xm=0.5, α=2` | — | wings count (±direction) | `:487` |
| `phase_epigenetics` (blocks) | Pareto | `xm=0.5, α=2` | — | blocks count (±direction) | `:498` |
| `gene_duplication` | Uniform `rng()` | — | — | phaseConfig fields (spreadDeg ±90°, wings ±1-2, shuffle ±0.2) | `:424-427` |
| `gene_deletion` | Uniform `rng()` | — | — | Track or keyframe index selection | `:696-713` |
| `interpolation_drift` | Markov transition matrix | — | — | Interpolation type + Cauchy handle perturbation (`scale=0.03`) | `:759-828` |

### RNG Engine

The base RNG is a **Linear Congruential Generator** (LCG):

```ts
// GeneticOperators.ts:267-273
export function makeRng(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s * 1664525 + 1013904223) | 0
    return ((s >>> 0) % 1000000) / 1000000
  }
}
```

This is wrapped by `makeFatTailedRng()` which provides:
- **Truncated Cauchy**: `scale * tan(π * (p - 0.5))`, clamped to `[-maxAbs, maxAbs]` — heavy tails, most values near 0, rare cataclysmic jumps.
- **Pareto**: `xm / (1-p)^(1/α)` — strictly positive, heavy upper tail.

### Phantom Operators (Type-only, No Implementation)

Three operators are declared in the `MutationOperator` type but have **zero implementation** in `GeneticOperators.ts`:

| Operator | In Roulette? | In RarityEngine weights? | Implementation |
|---|---|---|---|
| `hue_drift` | ❌ No | ✅ 0.15 | Falls to `default` → returns clone with no delta (no-op) |
| `context_drift` | ❌ No | ✅ 0.65 | Falls to `default` → returns clone with no delta (no-op) |
| `transposition` | ❌ No | ✅ 0.85 | Falls to `default` → returns clone with no delta (no-op) |

If any of these were ever selected (they aren't in the roulette), they would produce a **zero-mutation clone** → L2=0 → G7 abort. They are dead code in the type system.

---

## 2. The "Junk DNA" Generators (Track Bloat)

### `gene_duplication` — The Primary Track Bloat Generator

**Location:** `GeneticOperators.ts:395-450`

**Mechanics:**
1. Picks a random track from `child.tracks` (uniform RNG).
2. Deep-clones it, including all keyframes, curves, and phaseConfig.
3. Assigns a new ID: `${srcTrack.id}_dup_${random5digits}`.
4. Mutates only the `phaseConfig` (spreadDeg ±90°, wings ±1-2, shuffle ±0.2).
5. **Does NOT alter the `paramId`** — the duplicated track targets the **same DMX parameter** as the source.
6. Appends the clone to `child.tracks`.

**Junk DNA Problems:**

- **Duplicate `paramId`**: The cloned track writes to the same parameter (e.g., `intensity`, `pan`) as the original. At execution time, the last-writer-wins semantics of the ForgeGraphCompiler means one of the two tracks is **completely invisible** — it outputs values that are immediately overwritten.
- **No purpose divergence**: The curve values, keyframes, and interpolation are identical to the source. Only `phaseConfig` differs, which affects spatial distribution but not the temporal envelope.
- **No cleanup**: There is no mechanism to remove the duplicate or merge the two tracks. Each subsequent `gene_duplication` call can add another copy, leading to unbounded track array growth.
- **L2 inflation without visual impact**: The L2 distance increases (new track → `D_structural` rises), inflating rarity without any functional change in the effect's output.

**Code block responsible:**

```ts
// GeneticOperators.ts:415-436
const cloned: HephTrack = deepClone(srcTrack)
cloned.id = `${srcTrack.id}_dup_${Math.floor(rng() * 100000)}`
// ... only phaseConfig is mutated ...
child.tracks.push(cloned)  // ← track bloat: same paramId, no cleanup
```

### `gene_splice` — Moderate Keyframe Bloat

**Location:** `GeneticOperators.ts:598-674`

**Mechanics:**
1. Picks a random numeric track with ≥2 keyframes.
2. Selects a random gap between two consecutive keyframes.
3. Inserts 1-3 new keyframes with linearly interpolated values + Cauchy noise.
4. New interpolation is randomly chosen (60% bezier, 30% linear, 10% hold).

**Junk DNA Assessment:**

- **Microscopic shifts**: The Cauchy noise with `scale=0.04` and `maxAbs=0.50` means most inserted keyframes have values very close to the linear interpolation point. The visual difference is often imperceptible.
- **Keyframe count growth**: Each splice adds 1-3 keyframes. Repeated splicing over generations can inflate keyframe counts significantly, increasing serialization size and GPU evaluation cost without proportional visual benefit.
- **No deduplication**: If two inserted keyframes end up with nearly identical `timeMs` and `value`, they are not merged. There is no "merge near-identical keyframes" pass.
- **Less severe than `gene_duplication`**: At least the keyframes are on a single track and do produce some visual change (curve shape modification). But the magnitude is often too small to matter.

**Code block responsible:**

```ts
// GeneticOperators.ts:625-666
for (let j = 1; j <= numInserts; j++) {
  // ...
  const noise = fatRng.sampleCauchy(0.04, 0.50)  // ← usually tiny
  const newValue = clamp(baseValue + noise * span, range[0], range[1])
  // ... insert keyframe ...
  kfs.splice(insertIdx, 0, newKf)  // ← no dedup check
}
```

### Cleanup Mechanisms: NONE

There are **zero cleanup mechanisms** anywhere in the operator pipeline:

- No redundant track detection (same `paramId` merge).
- No near-identical keyframe merging.
- No empty track removal (tracks with all-identical keyframes).
- No track count cap or pruning after mutation.

The Prenatal Screening gates (G1-G7) do not check for track bloat either — G5 only verifies ≥1 track with ≥2 keyframes, but does not flag excessive tracks or duplicate `paramId`s.

---

## 3. Inheritance Mechanics (Mitosis vs. Crossover)

### 3.1 Mitosis (Asexual Reproduction)

**Entry point:** `ColiseumService.spawnOrganism()` with `parentOrganismId` parameter.  
**Caller:** `ColiseumService._mitosis()` (`:622-673`).

**Flow:**

1. `_mitosis()` queries for organisms with `fitness_score >= 0.85` and `trials_count >= 5`.
2. For each candidate, calls `spawnOrganism(parent.blueprint_id, operator, seed, parent.organism_id, childFitness)`.
3. Inside `spawnOrganism()`:
   - The parent organism is materialized via `getOrganismMaterializer().materialize(parentOrganismId)` → returns the parent's `HephAutomationClipV3`.
   - A genetic operator (from the roulette) is applied to the parent clip.
   - The operator produces a mutated child clip.

**DNA Inheritance — Copied 1:1, Then Blindly Mutated:**

The child's `cognitiveDNA` is **not explicitly copied or blended** during mitosis. Instead:

1. The operator (e.g., `pointMutation`) calls `deepClone(parent)` — this clones the entire clip including `cognitiveDNA`.
2. The operator then mutates only the `tracks` (keyframes, phaseConfig, etc.).
3. **No operator touches `cognitiveDNA` during asexual mutation.** The child inherits the parent's `cognitiveDNA` **exactly 1:1** — same `genome`, same `pressureRange`, same `energyZone`, same `aggressionRange`, same `compatibleVibes`, same `validSections`.

**Critical Finding:** The `cognitiveDNA` is **never drifted** during mitosis. A `point_mutation` that changes a keyframe value will produce a child with different curves but **identical DNA**. This means:

- The Dream Simulator sees the same DNA relevance score for parent and child.
- The `pressureRange` is inherited verbatim — no genetic drift.
- The `genome` (aggression, chaos, organicity) is frozen across asexual generations.
- Only `crossover` (sexual reproduction) produces DNA-level variation.

**Implication:** Mitosis produces organisms that are genetically identical at the DNA level but have different curve shapes. The L2 distance captures curve differences, but the DNA scoring system (which drives Selene's effect selection) sees them as the same organism. This is a fundamental design gap — **phenotypic variation without genotypic variation**.

### 3.2 Crossover (Sexual Reproduction)

**Entry point:** `ColiseumService.spawnHybrid()` → `crossover()` in `GeneticOperators.ts`.  
**Location:** `GeneticOperators.ts:953-1039`.

**Track Inheritance — Domain-Based Split:**

The crossover operator classifies tracks into two domains:

```ts
// GeneticOperators.ts:877-878
const DOMAIN_TEMPORAL = new Set(['intensity', 'color', 'strobe', 'strobeRate', 'zoom', 'focus'])
const DOMAIN_SPATIAL = new Set(['pan', 'tilt'])
```

**Mechanics:**

1. Dominance is determined by fitness: `fitnessA >= fitnessB ? 'A' : 'B'`.
2. Temporal donor and spatial donor are randomly assigned (50/50 coin flip each).
3. **Force hybridization:** If both domains would come from the same parent, the spatial donor is flipped to the other parent.
4. Child tracks = all temporal-domain tracks from temporal donor + all spatial-domain tracks from spatial donor.
5. If no tracks match either domain (edge case), falls back to dominant parent's tracks.
6. `durationMs` is averaged: `(parentA.durationMs + parentB.durationMs) / 2`.
7. `spatialZones` are unioned (Set deduplication).

**Track classification gap:** Parameters not in either set (e.g., `gobo`, `prism`, `iris`, `frost`, `macro`) are **orphaned** — they are not inherited from either parent. The child loses all non-temporal, non-spatial tracks. This is a **silent data loss** for complex fixtures with specialized parameters.

**Code block responsible:**

```ts
// GeneticOperators.ts:979-988
for (const track of temporalDonor.tracks) {
  if (DOMAIN_TEMPORAL.has(track.paramId)) {
    childTracks.push(deepClone(track))
  }
}
for (const track of spatialDonor.tracks) {
  if (DOMAIN_SPATIAL.has(track.paramId)) {
    childTracks.push(deepClone(track))
  }
}
// ← orphaned params (gobo, prism, iris, frost, macro) are silently dropped
```

### 3.3 `blendCognitiveDNA` — DNA Blending Mechanics

**Location:** `GeneticOperators.ts:885-944`.

**Genome (aggression, chaos, organicity):** Weighted average — 60% dominant, 40% submissive.

```ts
// GeneticOperators.ts:893-897
const genome: FrozenGenome = {
  aggression: 0.6 * dom.genome.aggression + 0.4 * sub.genome.aggression,
  chaos: 0.6 * dom.genome.chaos + 0.4 * sub.genome.chaos,
  organicity: 0.6 * dom.genome.organicity + 0.4 * sub.genome.organicity,
}
```

**`textureAffinity`:** Inherited from dominant parent only (no blending).

**`spatialBehavior`:** Inherited from dominant parent only (no blending).

**`compatibleVibes` / `validSections`:** Union of both parents (Set deduplication).

**`energyZone`:** Union of both parents' ranges, BUT if the unioned span > 2 zones, collapses to the dominant parent's range (G4 pre-screening compliance).

**`aggressionRange`:** Outer envelope — `min(minA, minB)` to `max(maxA, maxB)`. This **expands** the range, making the child more permissive than either parent.

**`pressureRange`:** Same outer-envelope strategy:

```ts
// GeneticOperators.ts:927-930
const pressureRange = {
  min: Math.min(dnaA.pressureRange.min, dnaB.pressureRange.min),
  max: Math.max(dnaA.pressureRange.max, dnaB.pressureRange.max),
}
```

**Critical Finding for `pressureRange`:** The blending uses **outer envelope expansion** (min of mins, max of maxes). This means:
- Children are always **more permissive** than either parent — they accept a wider pressure range.
- Over generations of crossover, `pressureRange` can only **expand**, never contract. This is **range inflation** — the same bug pattern as rarity inflation, but for pressure tolerance.
- There is no clamping or normalization to prevent the range from eventually spanning `[0, 1]` (the full possible range), making the field meaningless.

**`ikCompatibility` / `executionDomain`:** Inherited from dominant parent only.

### 3.4 Inheritance Summary Table

| Field | Mitosis (Asexual) | Crossover (Sexual) | Inflation Risk |
|---|---|---|---|
| `genome` (A/C/O) | 1:1 copy, no drift | 60/40 weighted blend | None |
| `textureAffinity` | 1:1 copy | Dominant only | None |
| `compatibleVibes` | 1:1 copy | Union (expansion) | **Yes — vibe list grows** |
| `validSections` | 1:1 copy | Union (expansion) | **Yes — section list grows** |
| `energyZone` | 1:1 copy | Union or dominant fallback | Bounded by G4 (max 2 zones) |
| `aggressionRange` | 1:1 copy | Outer envelope (min→max) | **Yes — range only expands** |
| `pressureRange` | 1:1 copy | Outer envelope (min→max) | **Yes — range only expands** |
| `spatialBehavior` | 1:1 copy | Dominant only | None |
| `ikCompatibility` | 1:1 copy | Dominant only | None |
| `executionDomain` | 1:1 copy | Dominant only | None |
| `durationMs` | Inherited from parent (operators may modify) | Averaged | None |
| `spatialZones` | 1:1 copy | Union (expansion) | **Yes — zone list grows** |
| Tracks (curves) | Mutated by operator | Domain split (temporal/spatial) | **Yes — `gene_duplication` bloats** |

---

## 4. Operator Roulette Weight Analysis

**ColiseumService.ts:47-55** — The roulette that selects which operator is applied:

```ts
const OPERATOR_WEIGHTS_ROULETTE: ReadonlyArray<[MutationOperator, number]> = Object.freeze([
  ['gene_splice',           0.20],
  ['point_mutation',        0.20],
  ['temporal_stretch',      0.15],
  ['gene_deletion',         0.15],
  ['interpolation_drift',   0.10],
  ['phase_epigenetics',     0.10],
  ['gene_duplication',      0.10],
])
```

**RarityEngine.ts:30-42** — The operator weights used for rarity scoring:

```ts
const OPERATOR_WEIGHTS: Readonly<Record<MutationOperator, number>> = Object.freeze({
  point_mutation: 0.15,
  hue_drift: 0.15,          // ← phantom: never selected, never implemented
  phase_epigenetics: 0.20,
  gene_duplication: 0.50,
  gene_deletion: 0.55,
  gene_splice: 0.60,
  temporal_stretch: 0.35,
  interpolation_drift: 0.25,
  crossover: 0.85,          // ← not in roulette (handled separately)
  transposition: 0.85,      // ← phantom: never selected, never implemented
  context_drift: 0.65,      // ← phantom: never selected, never implemented
})
```

**Mismatch:** `gene_splice` and `point_mutation` are the most likely operators (20% each), but they have the **lowest** rarity weights (0.15 and 0.60 respectively). Meanwhile, `gene_duplication` (10% selection rate) has a high rarity weight (0.50). This means the most frequently selected operators produce the lowest rarity scores, while the rarest operators produce the highest — which is intentional (structural operators should yield rarer organisms), but the roulette over-weights the low-rarity operators.

---

## 5. L2 Distance Calculation

**Location:** `GeneticOperators.ts:254-263`

The composite L2 distance is:

```
L2_total = 0.45 * D_curve + 0.35 * D_phase + 0.20 * D_structural
```

- **D_curve** (`:107-154`): RMSE over normalized keyframe values and bezier handles. Normalized by track span to prevent pan/tilt dominance.
- **D_phase** (`:161-201`): RMSE over PhaseConfigPro fields (spreadDeg, wings, shuffle, blocks, direction, symmetry). Weighted by visual impact.
- **D_structural** (`:207-245`): Topological distance — track count diff (50%), keyframe count diff (35%), interpolation change ratio (15%).

**Gap:** The L2 distance does **not** measure `cognitiveDNA` divergence. Two organisms with identical curves but different genomes (if that were possible) would have L2=0. In practice, since mitosis copies DNA 1:1, this isn't a current problem — but if DNA drift is ever added to asexual operators, the L2 distance will under-report the true genetic distance.

---

## 6. Key Findings Summary

### Finding A: All Operators Are 100% Blind Darwinian
No operator reads `AcousticRealityState`, BPM, vibe, energy, or any contextual signal. All mutation magnitudes are drawn from fixed-scale Cauchy/Pareto distributions. There is no Lamarckian adaptation mechanism.

### Finding B: `gene_duplication` Is the Primary Junk DNA Generator
It clones tracks with the same `paramId`, making the duplicate invisible at execution time (last-writer-wins). No cleanup mechanism exists. Track arrays grow unbounded across generations.

### Finding C: `gene_splice` Produces Microscopic Noise
Cauchy `scale=0.04` means most inserted keyframes are nearly imperceptible. No near-identical keyframe deduplication exists.

### Finding D: Mitosis Has Zero DNA Drift
`cognitiveDNA` (including `pressureRange`, `genome`, `energyZone`) is copied 1:1 from parent to child during asexual reproduction. Only the curve tracks are mutated. This creates phenotypic variation without genotypic variation — the Dream Simulator sees parent and child as identical.

### Finding E: Crossover Drops Orphaned Parameters
Tracks with `paramId` not in `DOMAIN_TEMPORAL` or `DOMAIN_SPATIAL` (gobo, prism, iris, frost, macro) are silently lost during crossover. No fallback or warning.

### Finding F: `pressureRange` and `aggressionRange` Only Expand in Crossover
The outer-envelope blending strategy (`min(minA,minB)` to `max(maxA,maxB)`) means ranges can only grow wider across generations. Over time, these ranges converge to `[0, 1]`, becoming meaningless. There is no contraction or normalization mechanism.

### Finding G: Three Phantom Operators Exist
`hue_drift`, `context_drift`, and `transposition` are declared in the type system and have rarity weights assigned, but have **no implementation**. They fall through to the `default` case in `applyOperator()`, producing a zero-mutation clone.

### Finding H: No Track Cleanup Anywhere
No operator, no screening gate, and no post-mutation pass removes redundant tracks, merges near-identical keyframes, or prunes empty tracks. Bloat accumulates across generations with no remediation.

---

## 7. File Reference Index

| File | Key Lines | Content |
|---|---|---|
| `GeneticOperators.ts` | `:267-273` | LCG RNG implementation |
| `GeneticOperators.ts` | `:300-314` | Fat-tailed RNG (Cauchy + Pareto) |
| `GeneticOperators.ts` | `:325-385` | `pointMutation` — Cauchy scale=0.02 |
| `GeneticOperators.ts` | `:395-450` | `geneDuplication` — track bloat generator |
| `GeneticOperators.ts` | `:461-524` | `phaseEpigenetics` — Cauchy/Pareto phase mutation |
| `GeneticOperators.ts` | `:535-586` | `temporalStretch` — Cauchy scale=0.15 time factor |
| `GeneticOperators.ts` | `:598-674` | `geneSplice` — Cauchy scale=0.04 keyframe insertion |
| `GeneticOperators.ts` | `:684-753` | `geneDeletion` — keyframe/track removal |
| `GeneticOperators.ts` | `:780-863` | `interpolationDrift` — Markov transition matrix |
| `GeneticOperators.ts` | `:885-944` | `blendCognitiveDNA` — DNA blending with outer-envelope ranges |
| `GeneticOperators.ts` | `:953-1039` | `crossover` — domain-based track split |
| `GeneticOperators.ts` | `:1048-1085` | `applyOperator` — dispatcher with phantom operator fallthrough |
| `ColiseumService.ts` | `:47-55` | Operator roulette weights |
| `ColiseumService.ts` | `:182-324` | `spawnOrganism` — mitosis entry point |
| `ColiseumService.ts` | `:340-490` | `spawnHybrid` — crossover entry point |
| `ColiseumService.ts` | `:622-673` | `_mitosis` — asexual reproduction trigger |
| `lfxTypes.ts` | `:147-165` | `CognitiveDNA` interface with `pressureRange` |
| `RarityEngine.ts` | `:30-42` | `OPERATOR_WEIGHTS` — rarity weights per operator |
