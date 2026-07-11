# 🧬 Genesis Ecosystem — Forensic Audit Report

> **Date:** 2025-01-24  
> **Scope:** `electron-app/src/core/genesis/` — Core Engine, SQLite schemas, IPC handlers, Hephaestus UI  
> **Mission:** Complete architectural mapping of the Genesis ecosystem as it exists today.  
> **Rule:** No new implementation code. Map the Matrix as it is.

---

## Table of Contents

1. [Lifecycle & State Machine](#1-lifecycle--state-machine)
2. [Genetic Operators (DNA Modifiers)](#2-genetic-operators-dna-modifiers)
3. [Fitness, Selection & The Cull](#3-fitness-selection--the-cull)
4. [The Loot System](#4-the-loot-system)
5. [UI & Main Thread Integration](#5-ui--main-thread-integration)
6. [Hardcoded Thresholds Reference](#6-hardcoded-thresholds-reference)
7. [Potential Bottlenecks & Risks](#7-potential-bottlenecks--risks)

---

## 1. Lifecycle & State Machine

### 1.1 Life Stages

An organism passes through these `OrganismStatus` values (defined in `types.ts:14`):

```
spawned → alive → champion → canonized
                ↘ culled
                ↘ quarantined (unused in current code)
```

| Status | Meaning | Set By |
|--------|---------|--------|
| `alive` | Born, living in the ecosystem, competing | `ColiseumService.spawnOrganism()` — initial INSERT |
| `champion` | Promoted by LifecycleManager for high fitness | `LifecycleManager.runTransitions()` |
| `canonized` | Baptized → written to `.lfx` → immutable blueprint | `genesisIpc.ts:canonizeMutant` IPC handler |
| `culled` | Dead — either apoptosis, lifecycle demotion, or manual cull | `ColiseumService._apoptosis()`, `LifecycleManager`, `genesisIpc:cullOrganism` |

### 1.2 Birth Pipeline

**File:** `ColiseumService.ts:182-324` — `spawnOrganism()`

```
1. Fetch granite ancestor blueprint from Vault
   → OR materialize living parent (mitosis path)
2. Apply genetic operator (pure function) → mutated clip + delta_json
3. Run PrenatalScreening (G1-G7 gates)
4. If viable:
   a. Estimate rarity via RarityEngine
   b. Compute bezier signature (128-float Float32Array)
   c. INSERT into lfx_organisms with status='alive', fitness=0 (or inherited)
5. If non-viable: ABORT (zero DB writes)
```

### 1.3 Birth Triggers

There are **three** triggers that create new organisms:

| Trigger | Location | Mechanism |
|---------|----------|-----------|
| **Emergency Spark** | `EffectManager.ts:568-593` | When Selene fires an effect whose `effectType` matches a blueprint with zero living organisms, `queueMicrotask(() → spawnInitialCohort())` fires. 40% stochastic gate (60% chance to skip). |
| **Mitosis** | `ColiseumService.ts:622-673` — `_mitosis()` | During ecological maintenance, organisms with `fitness ≥ 0.85` AND `trials ≥ 5` AND `generation < 16` reproduce. Parent transfers 35% of vitality to child. |
| **Initial Cohort** | `ColiseumService.ts:497-517` | Called by Emergency Spark. Spawns 1 organism via weighted operator roulette. |

**Sexual reproduction (crossover)** is available via `ColiseumService.spawnHybrid()` (`ColiseumService.ts:340-490`) but has **no automatic trigger** — it must be called manually (e.g., from a future UI action).

### 1.4 Prenatal Screening (G1-G7)

**File:** `screening/PrenatalScreening.ts`

All 7 gates are evaluated. Any hard-fail = abort (organism never born).

| Gate | Label | Check | Abort? |
|------|-------|-------|--------|
| G1 | SCHEMA | `clip.id`, `clip.name` non-empty, `durationMs > 0` | ✅ |
| G2 | CHECKSUM | Not evaluated prenatally | ❌ (N/A) |
| G3 | GENOME | `aggression`, `chaos`, `organicity` all in [0,1] | ✅ |
| G4 | COMPAT | ≥1 compatible vibe, ≥1 valid section, energy zone span ≤ 2 | ✅ |
| G5 | CURVES | ≥1 track with ≥2 keyframes | ✅ |
| G6 | STROBE | If strobe declared: dedicated strobe track with value [0,1] OR intensity track with ≥4 keyframes | ✅ |
| G7 | REDUNDANCY | L2 distance from parent ≥ 0.005 (anti-clone) | ✅ |
| G7 | SPATIAL | pan/tilt presence matches `spatialBehavior` declaration | ❌ (warn only) |

**Clone threshold:** `L2 < 0.005` → abort. This is the only anti-cloning gate.

### 1.5 Canonization (Baptism)

**File:** `genesisIpc.ts:408-620` — `genesis:canonizeMutant` handler

Canonization is the **only** path from mutable organism → immutable `.lfx` file:

```
1. Fetch organism from DB
2. Determine baptism name:
   a. Custom name provided by operator → use it
   b. Organism already has custom_name → use it
   c. Otherwise → generateOrganismName() (procedural Cyberpunk name)
3. Materialize organism → full HephAutomationClipV3
4. Write .lfx to userData/arsenal/<safeName>.lfx
5. INSERT new blueprint with source_origin='canonized' and blueprint_id='canonized:<organismId>'
6. UPDATE organism: status='canonized', custom_name=<baptismName>
7. Hot-register in HephaestusClipIndex + DynamicEffectRegistry (non-fatal on failure)
```

### 1.6 Procedural Cyberpunk Naming Engine

**File:** `naming/ProceduralNamer.ts`

- **Deterministic:** FNV-1a 32-bit hash from `organismId:rarityScore:fitnessScore:generation`
- **Vocabulary:** 32 adjectives × 32 nouns × 21 suffix slots = **22,572 combinations**
- **Adjective selection:** By `aggression × textureAffinity` (4 buckets of 8) + universal pool override (1/16 chance)
- **Noun selection:** By `chaos × organicity` (4 buckets of 8)
- **Suffix selection:** By rarity tier (COMMON→MYTHIC, each with 8 entries including empty)
- **Max length:** 24 chars (safety clamp drops suffix if too long)
- **Integration:** Called during canonization (`genesisIpc.ts:479`) and name suggestion (`genesisIpc.ts:283`)

**WAVE 6000.V5 policy:** No baptism at birth. Organisms get military tags (`RARITY-xxxx`) until they earn a name via canonization or champion promotion.

**File:** `naming/OrganismTag.ts` — `getOrganismTag()`: Format `RARITY-<4hex>` from UUID.

### 1.7 LifecycleManager — Status Transitions

**File:** `ecology/LifecycleManager.ts`

Runs during ecological maintenance (every 60s). Transitions:

| Transition | Condition | Side Effect |
|-----------|-----------|-------------|
| `alive → champion` | Fitness ≥ species_avg + `CHAMPION_MARGIN (0.30)` AND `trials ≥ MIN_TRIALS_FOR_CHAMPION (5)` | Baptizes with `generateOrganismName()`, sets `custom_name` |
| `champion → alive` | Fitness < species_avg - `DEMOTION_MARGIN (0.20)` | Demotion (loses champion status) |
| `alive → culled` | Fitness < `CULL_THRESHOLD (0.15)` AND past neonatal shield | Culling |
| `champion → culled` | Fitness < `CULL_THRESHOLD (0.15)` | Champion culling |
| → Hall of Fame | `trials ≥ HALL_OF_FAME_TRIALS (25)` AND `survival_rate ≥ HALL_OF_FAME_SURVIVAL (0.85)` | Identified as HoF candidate (view `v_hall_of_fame`) |

Per-species fitness averages are computed on-the-fly by grouping alive+champion organisms by `species_id`.

### 1.8 Ecological Maintenance Pipeline

**File:** `ColiseumService.ts:533-581` — `runEcologicalMaintenance()`

Runs every **60 seconds** via `GenesisIgnition.ts` timer (`MAINTENANCE_INTERVAL_MS = 60_000`):

```
1. Flush HeatmapLogger queue → batch INSERT to context_heatmaps
2. Entropy Decay → all alive organisms: fitness -= 0.02 (existence costs energy)
3. Apoptosis → fitness < 0.10 AND past neonatal shield → status='culled'
4. Speciation → K-means clustering on bezier signatures → species_id assignment
5. Lifecycle transitions → promotions/demotions/champion culling + HoF scan
6. Mitosis → high-vitality organisms reproduce (cellular division)
```

### 1.9 Ancestral Ingestion (Boot)

**File:** `AncestralIngestor.ts` + `GenesisIgnition.ts`

On boot:
1. `HeatmapLogger.start()` — begins 10s flush cycle
2. `AncestralIngestor.ingestAll()` — scans `builtins/` for `.lfx` V3 files, inserts into `lfx_blueprints` (idempotent, `INSERT OR IGNORE`)
3. Schedule `setInterval(runEcologicalMaintenance, 60_000)`
4. `refreshEvolutionaryCandidates()` — injects live organisms into `DynamicEffectRegistry` for Selene

**Cold-start seeding has been purged.** No organisms are spawned at boot. Spawning only happens via Emergency Spark when Selene fires a blueprint with zero living descendants.

---

## 2. Genetic Operators (DNA Modifiers)

**File:** `operators/GeneticOperators.ts` (1086 lines)

All operators are **pure deterministic functions**: `(clip, seed?) → { clip: clone, delta: JsonPatchOp[], l2Distance }`

### 2.1 Operator Roulette (Weighted Selection)

**File:** `ColiseumService.ts:47-55`

| Operator | Weight | Rarity Weight |
|----------|--------|--------------|
| `gene_splice` | 0.20 | 0.60 |
| `point_mutation` | 0.20 | 0.15 |
| `temporal_stretch` | 0.15 | 0.35 |
| `gene_deletion` | 0.15 | 0.55 |
| `interpolation_drift` | 0.10 | 0.25 |
| `phase_epigenetics` | 0.10 | 0.20 |
| `gene_duplication` | 0.10 | 0.50 |

WAVE 6000.V4: Weighted selection favors structural innovation. Without this, `point_mutation` dominates and structural operators are never selected.

### 2.2 Active Operators (7 + 1 crossover)

#### OPERATOR 1: `point_mutation` (lines 325-385)
- **Modifies:** A single numeric `value` in a random keyframe of a random numeric track
- **Magnitude:** Truncated Cauchy distribution (scale=0.02, maxAbs=0.60) — most mutations small, rare cataclysmic events
- **Bonus:** 50% chance to also perturb a bezier handle (Cauchy scale=0.03, maxAbs=0.80)
- **Delta:** `replace` op on `/tracks/<i>/curve/keyframes/<k>/value`
- **Rarity weight:** 0.15 (lowest — common mutation)

#### OPERATOR 2: `gene_duplication` (lines 395-450)
- **Modifies:** Clones an existing track, mutates its `phaseConfig` (spreadDeg ±90°, wings ±1-2, shuffle ±0.2)
- **Appends** the cloned track to `tracks[]` with a new ID
- **Delta:** `add` op on `/tracks/-`
- **Rarity weight:** 0.50

#### OPERATOR 3: `phase_epigenetics` (lines 461-524)
- **Modifies:** `PhaseConfigPro` parameters across **ALL** tracks
- **Per-track:** 1-2 random parameters mutated from: spreadDeg (Cauchy ±30°/360°), wings (Pareto ±0.5/2), shuffle (Cauchy ±0.05/0.50), blocks (Pareto ±0.5/2), direction (coin flip)
- **Delta:** `replace` op on `/tracks/<i>/phaseConfig`
- **Rarity weight:** 0.20

#### OPERATOR 4: `temporal_stretch` (lines 535-586)
- **Modifies:** Compresses/expands `timeMs` of keyframes by a Cauchy-derived factor (scale=0.15, maxAbs=0.90)
- **Scope:** 70% chance targets single track, 30% targets entire clip (also scales `durationMs`)
- **Keyframes** are re-sorted by `timeMs` after mutation
- **Delta:** `replace` ops on `/tracks/<i>/curve/keyframes/<k>/timeMs` and optionally `/durationMs`
- **Rarity weight:** 0.35

#### OPERATOR 5: `gene_splice` (lines 598-674)
- **Modifies:** Inserts 1-3 **new keyframes** between two existing ones in a numeric track
- **Values:** Linear interpolation + Cauchy noise (scale=0.04, maxAbs=0.50)
- **Interpolation:** 60% bezier (random preset), 30% linear, 10% hold
- **Delta:** `add` ops on `/tracks/<i>/curve/keyframes/<insertIdx>`
- **Rarity weight:** 0.60 (highest structural operator)

#### OPERATOR 6: `gene_deletion` (lines 684-753)
- **Modifies:** Removes a keyframe (70% chance, preserving first/last anchors, requires ≥3 keyframes) OR an entire track (30% chance, protecting the only intensity track)
- **Delta:** `remove` op on `/tracks/<i>/curve/keyframes/<k>` or `/tracks/<i>`
- **Rarity weight:** 0.55

#### OPERATOR 7: `interpolation_drift` (lines 780-863)
- **Modifies:** Changes the interpolation type of a random keyframe using a **Markov transition matrix**:
  - bezier → [linear 30%, hold 15%, bezier 55%]
  - linear → [bezier 50%, hold 20%, linear 30%]
  - hold → [bezier 40%, linear 40%, hold 20%]
- **Re-rolls once** if same interpolation selected (anti-noop)
- **Bezier transitions:** Perturbs existing handles with Cauchy noise OR generates random preset
- **Non-bezier transitions:** Removes `bezierHandles` if present
- **Rarity weight:** 0.25

#### OPERATOR 8: `crossover` (lines 953-1039) — Sexual Reproduction
- **Requires:** Two parent organisms (called via `ColiseumService.spawnHybrid()`)
- **Mechanism:** Temporal tracks (intensity, color, strobe, strobeRate, zoom, focus) from one parent + spatial tracks (pan, tilt) from the other
- **Forced hybridization:** If both domains would come from the same parent, spatial is flipped
- **cognitiveDNA:** Blended 60/40 toward dominant parent (by fitness). Genome = weighted average. Vibes/sections = union. Energy zones: if union span > 2, collapses to dominant's range.
- **Duration:** Average of both parents
- **L2 distance:** `min(distance to A, distance to B)` — conservative rule
- **Rarity weight:** 0.85 (highest possible — most novel)

### 2.3 L2 Distance V2 (Composite Multi-Space)

**File:** `GeneticOperators.ts:254-263`

```
L2_total = 0.45 × D_curve + 0.35 × D_phase + 0.20 × D_structural
```

| Component | Weight | What It Measures |
|----------|--------|-----------------|
| `D_curve` | 0.45 | RMSE over normalized keyframe values + bezier handles (divided by track span) |
| `D_phase` | 0.35 | RMSE over normalized PhaseConfigPro fields (spreadDeg, wings, shuffle, blocks, direction, symmetry) with weights [0.30, 0.25, 0.15, 0.15, 0.10, 0.05] |
| `D_structural` | 0.20 | Topological distance: 0.5 × trackCountDiff + 0.35 × avgKeyframeDiff + 0.15 × interpolationChangeRatio |

### 2.4 Fat-Tailed RNG

**File:** `GeneticOperators.ts:300-314`

- **Truncated Cauchy:** `scale × tan(π × (p - 0.5))`, clamped to `[-maxAbs, maxAbs]` — heavy tails, most values near 0
- **Pareto:** `xm / (1-p)^(1/α)` — strictly positive, heavy upper tail
- Used by: `point_mutation`, `phase_epigenetics`, `temporal_stretch`, `gene_splice`, `interpolation_drift`

### 2.5 Delta Representation

All mutations produce a **JSON Patch (RFC 6902 subset)** — array of `{op, path, value}` operations. Stored in `lfx_organisms.delta_json` as a string. Applied via `applyDelta()` (`GeneticOperators.ts:55-98`) which supports `add`, `replace`, `remove` on nested arrays.

The `OrganismMaterializer` (`OrganismMaterializer.ts:118-214`) reconstructs clips by recursively materializing the parent and applying the delta chain. LRU cache (capacity 256) prevents re-computation. **Fallback Sagrado:** on ANY error, returns the granite ancestor's clipV3.

---

## 3. Fitness, Selection & The Cull

### 3.1 Fitness Equation

**File:** `fitness/FitnessEvaluator.ts`

**Paradigm:** Passive survival (Era III). Veto is ABOLISHED in live evaluation.

```
ΔF(m, c_now) = R_customs(m) + R_context(m)
F_new(m) = (1 − λ) × F_old(m) × γ^(Δt_days) + λ × ΔF(m, c_now)
```

| Constant | Value | Meaning |
|----------|-------|---------|
| `LAMBDA` (λ) | 0.15 | EMA learning rate |
| `GAMMA` (γ) | 0.99 | Temporal decay per day (1%/day inactivity) |
| `BETA_INHERIT` | 0.40 | Heredity factor for birth fitness |
| `W_DM` | +0.30 | Weight: chosen by DecisionMaker |
| `W_GK` | +0.20 | Weight: passed gates |
| `W_REJ` | −0.40 | Weight: rejected by gate |
| `W_CTX` | +0.25 | Weight: context coherence |
| `TAU` | 0.5 | Softmax temperature for context distance |
| `ALPHA_6D` | [0.30, 0.22, 0.15, 0.13, 0.10, 0.10] | 6D context weights |

### 3.2 R_customs (Customs Evaluation)

```
R_customs = (chosenByDecisionMaker ? +0.30 : 0)
          + (passedGates ? +0.20 : 0)
          + (rejectedByGate ? −0.40 : 0)
```

### 3.3 R_context (Context Coherence)

- Computes weighted 6D distance between current context and historical heatmaps
- 6D vector: `[zScoreAvg3s, lowBandAvg3s, energyPhaseEncoded, vibeHash, sectionEncoded, textureEncoded]`
- String fields hashed to [0,1) via `hashStringTo01()`
- Softmax over negative distances (÷ τ) weighted by `survivalRate`
- Returns `W_CTX × weightedSum`

### 3.4 Birth Fitness

```
F_birth(child) = F(parent) × BETA_INHERIT × RARITY_BONUS[child.tier]
```

Where `RARITY_BONUS` = {COMMON: 1.0, RARE: 1.1, EPIC: 1.25, LEGENDARY: 1.4, MYTHIC: 1.5}

### 3.5 Live Metabolic Reward (EffectManager)

**File:** `EffectManager.ts:536-625`

When Selene fires an effect during a show:

1. Looks up `lfx_organisms WHERE organism_id = config.effectType AND status = 'alive'`
   - **Nepotism abolished (WAVE 5000.V3 FIX):** Only the EXACT organism_id fired receives reward. Granite ancestors (blueprint IDs) return 0 rows — they don't eat.
2. If zero organisms found → **Emergency Spark** (spawnInitialCohort)
3. For each matching organism:
   - `heatmapLogger.recordFireEvent()` — O(1) queue push, zero I/O
   - `fitness_score = MIN(fitness_score + 0.05 × intensity, 1.0)` — metabolic reward
   - `trials_count += 1`, `passes_count += 1`, `last_fired_at = now`

**Note:** The `0.05 × intensity` reward is a **separate mechanism** from the `FitnessEvaluator.computeDeltaF()` equation. The full FitnessEvaluator pipeline (`evaluateFireEvent`) exists but is **not called in the live hot path** — only the simplified metabolic reward is applied. The full EMA/context evaluation would need to be wired in.

### 3.6 Entropy Decay

**File:** `ColiseumService.ts:590-597`

```sql
UPDATE lfx_organisms SET fitness_score = MAX(fitness_score - 0.02, 0.0) WHERE status = 'alive'
```

Every 60 seconds, all alive organisms lose 0.02 vitality. This is the thermodynamic cost of existence.

### 3.7 Apoptosis (Starvation Culling)

**File:** `ColiseumService.ts:604-614`

```sql
UPDATE lfx_organisms SET status = 'culled'
WHERE status = 'alive' AND fitness_score < 0.10 AND trials_count > neonatal_shield_until
```

Organisms below 0.10 vitality that have passed their neonatal shield are dissolved. The medium eliminates them — not a quota.

### 3.8 Lifecycle Culling

**File:** `ecology/LifecycleManager.ts`

- `alive → culled` if fitness < `CULL_THRESHOLD (0.15)` and past neonatal shield
- `champion → culled` if fitness < `CULL_THRESHOLD (0.15)`
- Per-species fitness averages computed on-the-fly

### 3.9 Overpopulation Rules

**There is no explicit population cap.** Regulation emerges from thermodynamics:

| Mechanism | File | Effect |
|-----------|------|--------|
| **Entropy Decay** | `ColiseumService.ts:590` | -0.02 fitness per 60s cycle → starves unused organisms |
| **Apoptosis** | `ColiseumService.ts:604` | fitness < 0.10 → culled |
| **Stochastic Gate** | `ColiseumService.ts:502` | 40% chance to spawn, 60% chance to skip (initial cohort) |
| **Mitosis Cap** | `ColiseumService.ts:629` | `generation < 16` hard limit on reproduction |
| **Speciation** | `ecology/SpeciationEngine.ts` | K-means clustering → species_id assignment (diversity enforcement) |
| **Species Quota Selector** | `ecology/SpeciesQuotaSelector.ts` | Round-robin selection across species for live pool injection |

### 3.10 Speciation Engine

**File:** `ecology/SpeciationEngine.ts`

- **Algorithm:** Simplified K-means on 128-float bezier signatures
- **K auto-tuned:** `clamp(round(sqrt(N/2)), 3, 12)`
- **Max iterations:** 20
- **Convergence threshold:** 0.001 (fraction of changed assignments)
- **Distance:** Euclidean on Float32Array(128)
- **Species IDs:** Deterministic: `species_<cluster_idx>` (e.g., `species_0`, `species_1`)
- Runs on `alive + champion` organisms only

### 3.11 Species Quota Selector

**File:** `ecology/SpeciesQuotaSelector.ts`

Selects candidates for the DreamSimulator's live pool:

1. Fetch all `alive + champion` organisms ordered by fitness DESC
2. Group by `species_id`
3. **Round-robin quota:** Pick best from each species (1 per species in first pass, then continue filling)
4. **ε-greedy exploration:** 5% chance to include neonatal-shielded organisms (young, protected) to give them a chance
5. Default pool size: 12

---

## 4. The Loot System

### 4.1 Rarity Equation

**File:** `loot/RarityEngine.ts`

```
ρ(m) = σ_norm × 0.50 + novelty × 0.30 + operator_weight × 0.20
```

| Component | Weight | Calculation |
|-----------|--------|-------------|
| `σ_norm` | 0.50 | `clamp01(l2_distance / DRIFT_MAX)` where `DRIFT_MAX = 0.55` |
| `novelty` | 0.30 | `1 − max_cosine_similarity(signature, all_alive)` (0 if no population, 1 if empty) |
| `operator_weight` | 0.20 | Per-operator weight table (see below) |

### 4.2 Operator Rarity Weights

| Operator | Weight |
|----------|--------|
| `point_mutation` | 0.15 |
| `hue_drift` | 0.15 |
| `phase_epigenetics` | 0.20 |
| `interpolation_drift` | 0.25 |
| `temporal_stretch` | 0.35 |
| `gene_duplication` | 0.50 |
| `gene_deletion` | 0.55 |
| `gene_splice` | 0.60 |
| `context_drift` | 0.65 |
| `crossover` | 0.85 |
| `transposition` | 0.85 |

### 4.3 Tier Mapping (WAVE 6000.V7)

| Tier | Score Range | Neonatal Shield | Rarity Bonus |
|------|-------------|-----------------|--------------|
| **COMMON** | [0.00, 0.25) | 3 trials | 1.0× |
| **RARE** | [0.25, 0.48) | 6 trials | 1.1× |
| **EPIC** | [0.48, 0.70) | 10 trials | 1.25× |
| **LEGENDARY** | [0.70, 0.88) | 15 trials | 1.4× |
| **MYTHIC** | [0.88, 1.00] | 20 trials | 1.5× |

### 4.4 Anti-Inflation Gate

**File:** `RarityEngine.ts:28`

```typescript
const COMMON_FORCE_L2_THRESHOLD = 0.08
```

If `L2 distance < 0.08`, the organism is **forced to COMMON** regardless of novelty score. This prevents rarity inflation from minor mutations (e.g., a single bezier handle tweak with high novelty due to small population).

### 4.5 Neonatal Shield

Each tier grants a `neonatal_shield_until` value (trial count). Organisms below this trial count are protected from apoptosis and can be included via ε-greedy exploration in the SpeciesQuotaSelector.

### 4.6 Simplified Mode

**File:** `RarityEngine.ts:173-183` — `computeRaritySimple()`

Used by `ColiseumService.spawnOrganism()` when population signatures are not available. Novelty defaults to 0.5 (neutral) with an empty Float32Array(128) and empty population. **This means rarity is currently computed in simplified mode for ALL spawns** — full mode requires wiring population signatures from the DB.

---

## 5. UI & Main Thread Integration

### 5.1 Genesis Lab UI

**File:** `components/views/HephaestusView/GenesisLab/GenesisLabView.tsx`

Layout:
```
┌──────────────────────────────────────────────────────────────┐
│  HEADER: Title + Maintenance button + species count           │
├───────────────────────────────────┬──────────────────────────┤
│  HALL OF FAME PANEL (top)         │  LINEAGE INSPECTOR       │
├───────────────────────────────────┤  (sidebar, 300px)        │
│  LOOT TRAY (grid of organism cards)│                         │
│  Filterable by rarity + status    │                         │
└───────────────────────────────────┴──────────────────────────┘
```

**Components:**
- `LootTray` — Grid of organism cards, filterable by rarity tier and status
- `HallOfFamePanel` — Shows HoF candidates from `v_hall_of_fame` view
- `LineageInspector` — Shows genealogical path from `lineage_tree` table

**Actions available from UI:**
- **Run Maintenance** — triggers `genesis:runMaintenance` IPC
- **Purge Ecosystem** — triggers `genesis:purgeEcosystem` IPC (deletes all non-canonized)
- **Cull Organism** — triggers `genesis:cullOrganism` IPC
- **Canonize Mutant** — triggers `genesis:canonizeMutant` IPC (with optional custom name)
- **Preview in Canvas** — dispatches `luxsync:genesis-preview-organism` CustomEvent (HephaestusView shell listens)
- **Delete Canonized** — triggers `genesis:deleteCanonized` IPC (removes .lfx + DB + registry)
- **Suggest Name** — triggers `genesis:suggestName` IPC (procedural name preview)

### 5.2 State Management

**File:** `stores/useGenesisStore.ts` (Zustand store)

State:
- `organisms[]`, `hallOfFame[]`, `lineage[]`, `species[]`
- `selectedOrganismId`, `isLoading`, `error`, `lastMaintenanceAt`
- `filterRarityTier`, `filterStatus`

Actions call IPC via `window.luxsync.genesis.*` API bridge.

### 5.3 IPC Channels

**File:** `genesisIpc.ts`

| Channel | Purpose |
|---------|---------|
| `genesis:getOrganisms` | List organisms with optional filter (rarity, status, species, limit) |
| `genesis:getHallOfFame` | Query `v_hall_of_fame` view |
| `genesis:getLineageTree` | Get genealogical path from `lineage_tree` |
| `genesis:cullOrganism` | Manual cull (alive/champion → culled) |
| `genesis:canonizeMutant` | Baptize → .lfx → blueprint → hot-register |
| `genesis:runMaintenance` | Trigger `runEcologicalMaintenance()` |
| `genesis:getSpecies` | List species with counts + avg/max fitness |
| `genesis:materializeClip` | Materialize organism → HephAutomationClipV3 for editor |
| `genesis:suggestName` | Procedural name preview |
| `genesis:purgeEcosystem` | Delete all non-canonized organisms + clear registry |
| `genesis:deleteCanonized` | Permanently delete canonized organism (DB + .lfx + registry) |

### 5.4 DecisionMaker / Selene Integration

**The DecisionMaker does NOT directly pick mutant organisms from the Genesis pool.** The integration is indirect:

#### Flow: Genesis Pool → Selene

```
1. GenesisIgnition.ts (boot):
   → refreshEvolutionaryCandidates(poolSize=3)
   → DynamicEffectRegistry.refreshEvolutionaryCandidates()

2. DynamicEffectRegistry.refreshEvolutionaryCandidates():
   a. SpeciesQuotaSelector.selectCandidates(poolSize=3)
      → Round-robin across species, ε-greedy for neonatals
   b. For each candidate:
      → OrganismMaterializer.materialize() → HephAutomationClipV3
      → registerEffectV3(clip, { filePath: null, isBuiltin: false })
      → Injected into the live DynamicEffectRegistry

3. EffectDreamSimulator.dreamEffects():
   → getDynamicEffectRegistry().getEffectsForVibe(vibe)
   → getDynamicEffectRegistry().getDivineArsenal(vibe)
   → Candidates include both base blueprints AND evolved organisms
   → Simulates + ranks by DNA relevance, beauty, risk, etc.

4. DreamEngineIntegrator:
   → Calls dreamEffects(), generates candidates
   → Filters by mood blockList
   → Returns top 5 candidates

5. DecisionMaker.generateStrikeDecision():
   → If dreamIntegration.approved && dreamIntegration.effect?.effect:
      → Uses DNA-approved effect directly
   → Else: SILENCE RULE (no fallback, no legacy selectEffectByVibe)
```

#### Flow: Selene Fires → Genesis Feeds

```
EffectManager.fireEffect():
  1. config.effectType = organism_id (if it's a mutated organism)
  2. SELECT organism_id FROM lfx_organisms WHERE organism_id = ? AND status = 'alive'
  3. If found:
     a. heatmapLogger.recordFireEvent() → O(1) queue push
     b. fitness_score += 0.05 × intensity (metabolic reward, capped at 1.0)
     c. trials_count += 1, passes_count += 1
  4. If NOT found (zero organisms):
     → Emergency Spark: spawnInitialCohort(effectType)
```

### 5.5 OrganismMaterializer (Hot Path Bridge)

**File:** `OrganismMaterializer.ts`

- **LRU cache:** 256 entries (Map-based, O(1) get/set)
- **Recursive materialization:** Follows `parent_organism_id` chain back to granite ancestor, applies delta chain
- **Generation cap:** Bounded by `generation ≤ 16` (enforced at mitosis spawn time)
- **Fallback Sagrado:** On ANY error (delta parse failure, missing parent, etc.), returns the granite ancestor's clipV3 intact. The operator never sees a lost frame.
- **Identity fix:** `childClip.id = organismId` (prevents collision with blueprint ancestor in DynamicEffectRegistry)
- **DNA preservation:** If a delta op removed `cognitiveDNA`, it's restored from the parent to guarantee `registerEffectV3()`'s DNA gate passes

---

## 6. Hardcoded Thresholds Reference

### Metabolic Constants (ColiseumService.ts:72-76)

| Constant | Value | Location |
|----------|-------|----------|
| `ENTROPY_DECAY` | 0.02 | `ColiseumService.ts:72` |
| `APOPTOSIS_THRESHOLD` | 0.10 | `ColiseumService.ts:73` |
| `MITOSIS_THRESHOLD` | 0.85 | `ColiseumService.ts:74` |
| `MITOSIS_MIN_TRIALS` | 5 | `ColiseumService.ts:75` |
| `MITOSIS_ENERGY_TRANSFER` | 0.35 | `ColiseumService.ts:76` |
| `MITOSIS_GENERATION_CAP` | 16 | `ColiseumService.ts:629` |

### Lifecycle Thresholds (LifecycleManager.ts)

| Constant | Value | Location |
|----------|-------|----------|
| `CHAMPION_MARGIN` | 0.30 | `LifecycleManager.ts` |
| `DEMOTION_MARGIN` | 0.20 | `LifecycleManager.ts` |
| `CULL_THRESHOLD` | 0.15 | `LifecycleManager.ts` |
| `MIN_TRIALS_FOR_CHAMPION` | 5 | `LifecycleManager.ts` |
| `HALL_OF_FAME_TRIALS` | 25 | `LifecycleManager.ts` |
| `HALL_OF_FAME_SURVIVAL` | 0.85 | `LifecycleManager.ts` |

### Rarity Thresholds (RarityEngine.ts)

| Constant | Value | Location |
|----------|-------|----------|
| `DRIFT_MAX` | 0.55 | `RarityEngine.ts:24` |
| `COMMON_FORCE_L2_THRESHOLD` | 0.08 | `RarityEngine.ts:28` |
| Tier boundaries | 0.25 / 0.48 / 0.70 / 0.88 | `RarityEngine.ts:126-130` |

### Fitness Constants (FitnessEvaluator.ts)

| Constant | Value | Location |
|----------|-------|----------|
| `LAMBDA` (EMA rate) | 0.15 | `FitnessEvaluator.ts:33` |
| `GAMMA` (daily decay) | 0.99 | `FitnessEvaluator.ts:34` |
| `BETA_INHERIT` | 0.40 | `FitnessEvaluator.ts:35` |
| `W_DM` | +0.30 | `FitnessEvaluator.ts:37` |
| `W_GK` | +0.20 | `FitnessEvaluator.ts:38` |
| `W_REJ` | −0.40 | `FitnessEvaluator.ts:39` |
| `W_CTX` | +0.25 | `FitnessEvaluator.ts:40` |
| `TAU` | 0.5 | `FitnessEvaluator.ts:41` |
| `ALPHA_6D` | [0.30, 0.22, 0.15, 0.13, 0.10, 0.10] | `FitnessEvaluator.ts:43` |

### Screening Thresholds (PrenatalScreening.ts)

| Constant | Value | Location |
|----------|-------|----------|
| Clone detection (G7) | L2 < 0.005 | `PrenatalScreening.ts:190` |
| Energy zone max span | 2 zones | `PrenatalScreening.ts:101` |
| Min keyframes (G5) | ≥2 per track, ≥1 rich track | `PrenatalScreening.ts:132` |
| Strobe intensity keyframes | ≥4 (if no dedicated strobe track) | `PrenatalScreening.ts:175` |

### Speciation Constants (SpeciationEngine.ts)

| Constant | Value | Location |
|----------|-------|----------|
| `SIGNATURE_LENGTH` | 128 | `SpeciationEngine.ts:36` |
| `MIN_K` | 3 | `SpeciationEngine.ts:37` |
| `MAX_K` | 12 | `SpeciationEngine.ts:38` |
| `MAX_ITERATIONS` | 20 | `SpeciationEngine.ts:39` |
| `CONVERGENCE_THRESHOLD` | 0.001 | `SpeciationEngine.ts:40` |

### Other Constants

| Constant | Value | Location |
|----------|-------|----------|
| `MAINTENANCE_INTERVAL_MS` | 60,000 (60s) | `GenesisIgnition.ts` |
| `FLUSH_INTERVAL_MS` | 10,000 (10s) | `HeatmapLogger.ts:43` |
| `BATCH_MAX` (heatmap) | 500 | `HeatmapLogger.ts:44` |
| `LRU_MAX_SIZE` (materializer) | 256 | `OrganismMaterializer.ts:33` |
| `EPSILON_EXPLORATION` | 0.05 (5%) | `SpeciesQuotaSelector.ts:20` |
| Stochastic gate (initial cohort) | 0.40 (40% spawn) | `ColiseumService.ts:502` |
| Metabolic reward per fire | 0.05 × intensity | `EffectManager.ts:617` |

---

## 7. Potential Bottlenecks & Risks

### 7.1 FitnessEvaluator Not Wired in Live Path

The full `evaluateFireEvent()` function (`FitnessEvaluator.ts:265-311`) with EMA, temporal decay, and 6D context coherence is **defined but not called** in the live hot path. Only the simplified metabolic reward (`fitness += 0.05 × intensity`) in `EffectManager.ts` is applied. This means:
- Context coherence (`R_context`) is never computed live
- EMA temporal decay (`γ^(Δt_days)`) is never applied live
- The `FitnessEvaluator` functions exist as dead code in the live pipeline

### 7.2 Rarity Computed in Simplified Mode Only

`ColiseumService.spawnOrganism()` calls `computeRaritySimple()` which passes an empty `Float32Array(128)` and empty population signatures. This means:
- **Novelty is always 0.5** (neutral) — cosine similarity against an empty population
- Population signatures from `lfx_organisms.bezier_signature` are never fetched for rarity computation
- Rarity is determined solely by `σ_norm (50%)` and `operator_weight (20%)` + fixed 0.5 × 0.30 = 0.15 from novelty

### 7.3 Organism ID Placeholder

**File:** `ColiseumService.ts:151-153`

```typescript
function generateOrganismId(): string {
  const hash8 = '00000000' // Placeholder — real console hash injected later
  return `${hash8}:${randomUUID()}`
}
```

All organisms currently share the same `00000000` console hash prefix. This is fine for single-console operation but will collide in swarm scenarios.

### 7.4 Materializer Recursion Depth

`OrganismMaterializer.materialize()` recursively materializes parents. With `generation < 16` cap, this could mean up to 16 recursive DB reads + delta applications on a cache miss. The LRU cache (256 entries) mitigates this, but a cold cache after purge could cause latency.

### 7.5 Speciation K-means on Every Maintenance Cycle

K-means runs on ALL alive+champion organisms every 60 seconds. With a large population, this could become CPU-intensive:
- N organisms × K clusters × 128 dimensions × 20 iterations
- No early termination if population hasn't changed
- Runs synchronously in the main process

### 7.6 Emergency Spark Fire-and-Forget

`EffectManager.ts:578` uses `queueMicrotask()` for emergency spawning. If the microtask throws, the error is silently swallowed (`catch (_) {}`). This could hide blueprint lookup failures or screening aborts that would be useful to diagnose.

### 7.7 Heatmap Context Fields Partially Populated

**File:** `EffectManager.ts:549-557` + `HeatmapLogger.ts:156-173`

The `ContextVector6D` built in EffectManager has:
- `sectionEncoded: 0` (always)
- `textureEncoded: 0` (always)

And the heatmap row has:
- `mid_band_avg_3s: 0` (always)
- `high_band_avg_3s: 0` (always)
- `z_score_max_3s: z_score_avg_3s` (proxy, not real max)
- `energy_max_30s: low_band_avg_3s` (proxy)
- `energy_phase: 'unknown'` (always)

This means 6D context distance is computed with 3 zeroed dimensions, reducing its discriminative power.

### 7.8 No Horizontal Clone Detection Beyond G7

The G7 redundancy gate only checks `L2 < 0.005` at birth. There is no runtime detection of organisms that converge toward the same behavior through different mutation paths. The speciation engine provides clustering but doesn't actively prevent convergence.

### 7.9 Canonization Checksum Uses JSON.stringify

**File:** `genesisIpc.ts:523`

```typescript
const checksum = createHash('sha256').update(JSON.stringify(clip)).digest('hex')
```

`JSON.stringify` is not canonical (key order depends on insertion order). Two structurally identical clips with different key orders would produce different checksums. The `LuxFileV3.serializer.ts` has `canonicalStringify` (sorted keys) but it's not used here.

### 7.10 purgeEcosystem Registered Outside setupGenesisIPCHandlers

**File:** `genesisIpc.ts:628`

The `genesis:purgeEcosystem` and `genesis:deleteCanonized` handlers are registered with `ipcMain.handle()` at module scope, **outside** the `setupGenesisIPCHandlers()` function. If `setupGenesisIPCHandlers()` is called multiple times (e.g., in tests), these two handlers would throw "already registered" errors.

---

## File Reference Index

| File | Purpose |
|------|---------|
| `genesis/types.ts` | Core type definitions (RarityTier, OrganismStatus, MutationOperator, etc.) |
| `genesis/schema.sql` | SQLite WAL schema (lfx_blueprints, lfx_organisms, context_heatmaps, lineage_tree, swarm_imports) |
| `genesis/GenesisIgnition.ts` | Bootstraps the geological loop (heatmap, ingestion, maintenance timer) |
| `genesis/ColiseumService.ts` | Central spawning pipeline + ecological maintenance |
| `genesis/GenesisVaultService.ts` | SQLite vault singleton (blueprints + organisms) |
| `genesis/AncestralIngestor.ts` | Reads .lfx builtins → lfx_blueprints (idempotent) |
| `genesis/OrganismMaterializer.ts` | Lazy clip reconstruction via delta chain + LRU cache |
| `genesis/genesisIpc.ts` | IPC bridge to renderer (10 channels) |
| `genesis/operators/GeneticOperators.ts` | 7 mutation operators + crossover + L2 distance + delta system |
| `genesis/screening/PrenatalScreening.ts` | 7-gate viability check (G1-G7) |
| `genesis/loot/RarityEngine.ts` | Rarity computation + tier mapping + neonatal shields |
| `genesis/fitness/FitnessEvaluator.ts` | Full fitness equation (EMA + context) — partially wired |
| `genesis/fitness/HeatmapLogger.ts` | Async fire event logger (10s flush, batch insert) |
| `genesis/ecology/LifecycleManager.ts` | Status transitions (promote/demote/cull/HoF) |
| `genesis/ecology/SpeciationEngine.ts` | K-means clustering on bezier signatures |
| `genesis/ecology/SpeciesQuotaSelector.ts` | Round-robin diverse candidate selection for live pool |
| `genesis/naming/ProceduralNamer.ts` | Deterministic Cyberpunk name generator (22,572 combinations) |
| `genesis/naming/OrganismTag.ts` | Short military tag fallback (RARITY-xxxx) |
| `arsenal/DynamicEffectRegistry.ts` | Live effect registry + `refreshEvolutionaryCandidates()` |
| `effects/EffectManager.ts` | Hot-path fire logic + metabolic telemetry + emergency spark |
| `intelligence/think/DecisionMaker.ts` | Selene's strike/drop decisions (DNA or silence) |
| `intelligence/dream/EffectDreamSimulator.ts` | Dream simulation + Cassandra pre-buffer |
| `intelligence/integration/DreamEngineIntegrator.ts` | Pipeline integration (dream → candidates → DecisionMaker) |
| `components/views/HephaestusView/GenesisLab/GenesisLabView.tsx` | Genesis Lab UI container |
| `stores/useGenesisStore.ts` | Zustand store for Genesis UI state |

---

*End of Forensic Audit Report.*
