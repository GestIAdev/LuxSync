# SELENE V3: LIQUID COGNITION — CONTEXT PACK FOR FABLE/OPUS
## WAVE 7000 PREP — FABLE CONTEXT PACK GENERATION

> **Purpose:** Unified context document for an LLM superior (Fable/Opus) to design the
> Blueprint of "Selene V3: Liquid Cognition". Contains exact TypeScript interface
> definitions, data flow, and architectural constraints — no logic, just types and
> contracts. This avoids costly context searches during blueprint generation.

---

## TABLE OF CONTENTS

1. [Pipeline Overview](#1-pipeline-overview)
2. [TitanStabilizedState — Audio/Energy Input](#2-titanstabilizedstate)
3. [SeleneMusicalPattern — Perceived Music](#3-selenemusicalpattern)
4. [EnergyContext — Zone Awareness](#4-energycontext)
5. [MusicalPrediction — Cassandra/Oracle Output](#5-musicalprediction)
6. [DecisionInputs — DecisionMaker Consumption](#6-decisioninputs)
7. [ConsciousnessOutput — Final Output](#7-consciousnessoutput)
8. [CognitiveDNA — Effect Genome](#8-cognitivedna)
9. [Supporting Types](#9-supporting-types)
10. [Architectural Constraints & Constants](#10-architectural-constraints--constants)

---

## 1. PIPELINE OVERVIEW

```
Audio FFT → TitanEngine (stabilizers) → TitanStabilizedState
  → SeleneTitanConscious.process()
    → MusicalPatternSensor → SeleneMusicalPattern
    → BeautySensor → BeautyAnalysis
    → HuntEngine → HuntDecision
    → PredictionEngine (Cassandra) → MusicalPrediction
    → ContextualMemory (RollingStats) → Z-Score, energyMaxHistoric
    → FuzzyDecisionMaker → FuzzyDecision
    → DreamEngineIntegrator → IntegrationDecision (DNA brain)
    → DecisionMaker.makeDecision(DecisionInputs) → ConsciousnessOutput
  → TitanEngine applies: color, physics, effects, movement
```

**Key rule:** Consciencia SUGIERE, no ORDENA. Vibe RESTRINGE, Consciencia ELIGE dentro.
Física tiene VETO en alta energía (Energy Override > 0.75).

---

## 2. TitanStabilizedState

**Source:** `electron-app/src/core/intelligence/types.ts:41-166`

The native input for SeleneTitanConscious. All data has passed through anti-epilepsy
stabilizers (key lock 10s, emotion lock 5s, strategy lock 15s).

```typescript
export interface TitanStabilizedState {
  // ── VIBE CONTEXT ──
  vibeId: VibeId
  constitution: GenerationOptions

  // ── STABILIZED DATA (anti-epilepsy) ──
  stableKey: string | null              // Musical key (12s buffer, 10s lock)
  stableEmotion: MetaEmotion            // Emotional state (10s buffer, 5s lock)
  stableStrategy: ColorStrategy         // Color strategy (15s rolling, 15s lock)
  rawEnergy: number                     // GAMMA RAW — source of truth for REACTION
  smoothedEnergy: number                // Smart Smooth EMA 0.70 — visual base, no flicker
  isDropActive: boolean                 // FSM detected relative drop
  thermalTemperature: number            // 4500-9500K

  // ── REAL-TIME AUDIO ──
  bass: number                          // Low band intensity (0-1)
  mid: number                           // Mid band intensity (0-1)
  high: number                          // High band intensity (0-1)

  // ── SPECTRAL TEXTURE (WAVE 661) ──
  harshness: number                     // 0=clean, 1=harsh (Skrillex territory)
  spectralFlatness: number              // 0=tonal, 1=noise
  spectralCentroid: number              // Frequency center of mass in Hz

  // ── ROSETTA STONE (WAVE 1026) ──
  clarity: number                       // 0=muddy, 1=hi-fi mastering
  ultraAir: number                      // 16-22kHz energy for lasers/scanners

  // ── MUSICAL CONTEXT ──
  bpm: number
  beatPhase: number                     // 0-1
  syncopation: number                   // 0-1, the "groove"
  sectionType: 'intro' | 'verse' | 'chorus' | 'drop' | 'bridge' | 'outro' | 'build' | 'breakdown' | 'unknown'

  // ── CURRENT PALETTE ──
  currentPalette: SelenePalette

  // ── TIMING ──
  frameId: number
  timestamp: number
}
```

### bassPresenceSustained (computed in SeleneTitanConscious)

Not part of TitanStabilizedState itself, but derived from it in
`SeleneTitanConscious.ts:851`:

```typescript
bassPresenceSustained: this._fftXRayAvgLowLastN(30)
```

- Rolling buffer `_fftXRayLow[]` of 180 frames (~3s @ 60fps)
- `_fftXRayAvgLowLastN(30)` = arithmetic mean of last 30 frames (~0.5s) of FFT LOW band
- Provides inertia against instant plosives and short 808s
- Fallback: `pattern.bassPresence` (instantaneous frame value)

---

## 3. SeleneMusicalPattern

**Source:** `electron-app/src/core/intelligence/types.ts:218-337`

The perceived musical pattern, derived from TitanStabilizedState by MusicalPatternSensor.
This is the primary input to HuntEngine, PredictionEngine, and DecisionMaker.

```typescript
export interface SeleneMusicalPattern {
  // ── VIBE CONTEXT ──
  vibeId: VibeId

  // ── CLASSIFICATIONS ──
  section: SectionClassification        // 'intro'|'verse'|'buildup'|'chorus'|'drop'|'breakdown'|'outro'
  energyPhase: EnergyPhase              // 'valley'|'building'|'peak'|'drop'

  // ── RHYTHM METRICS ──
  bpm: number
  beatPhase: number                     // 0-1
  syncopation: number                   // 0-1
  rhythmicIntensity: number             // 0-1

  // ── EMOTION/TENSION ──
  emotionalTension: number              // 0-1
  isBuilding: boolean
  isReleasing: boolean

  // ── HARMONY/DENSITY ──
  harmonicDensity: number               // 0-1

  // ── FREQUENCY BANDS ──
  bassPresence: number                  // 0-1
  bassPresenceSustained?: number        // WAVE 4867: smoothed bass (30-frame avg)
  midPresence: number                   // 0-1
  highPresence: number                  // 0-1

  // ── SPECTRAL TEXTURE ──
  harshness: number                     // 0=clean, 1=harsh
  spectralFlatness: number              // 0=tonal, 1=noise
  spectralCentroid: number              // Hz

  // ── PHYSICAL ENERGY ──
  rawEnergy: number                     // GAMMA RAW
  smoothedEnergy: number                // Smart Smooth EMA

  // ── CONTEXTUAL MEMORY (Z-SCORES) ──
  energyZScore?: number                 // Std deviations from rolling mean

  // ── DROP STATE ──
  isDropActive: boolean
  distanceFromDrop: number              // 0=in drop, 1=very far

  // ── TIMING ──
  timestamp: number
}
```

---

## 4. EnergyContext

**Source:** `electron-app/src/core/protocol/MusicalContext.ts:166-207`

Zone awareness for decision-making. Computed by EnergyConsciousnessEngine with
asymmetric smoothing (fast rise, slow fall) and peak-hold transient preservation.

```typescript
export type EnergyZone =
  | 'silence'   // E < 0.10
  | 'valley'    // E 0.10-0.20
  | 'ambient'   // E 0.20-0.35
  | 'gentle'    // E 0.35-0.50
  | 'active'    // E 0.50-0.70
  | 'intense'   // E 0.70-0.85
  | 'peak'      // E > 0.85

export interface EnergyContext {
  absolute: number                      // Instantaneous energy (0-1), no smoothing
  smoothed: number                      // Smoothed energy (peak-hold + EMA)
  percentile: number                    // Historical percentile (0-100)
  zone: EnergyZone                      // Current zone — Selene's thermometer
  previousZone: EnergyZone              // For transition detection
  sustainedLow: boolean                 // E < 0.4 for > 5s
  sustainedHigh: boolean                // E > 0.7 for > 3s
  trend: number                         // Rate of change (-1 to +1)
  lastZoneChange: number                // Timestamp of last zone transition
  isFlashbang: boolean                  // Instant jump from low to high zone
}
```

---

## 5. MusicalPrediction

**Source:** `electron-app/src/core/intelligence/think/PredictionEngine.ts:17-74`

Cassandra/Oracle output. Predicts upcoming musical events using pattern matching,
fluid timing (PLL-anchored), and organic confidence.

```typescript
export type PredictionType =
  | 'drop_incoming'
  | 'buildup_starting'
  | 'breakdown_imminent'
  | 'transition_beat'
  | 'energy_spike'
  | 'energy_drop'
  | 'section_change'
  | 'none'

export type SectionClassification =
  | 'intro' | 'verse' | 'buildup' | 'chorus'
  | 'drop' | 'breakdown' | 'outro'

export interface MusicalPrediction {
  type: PredictionType
  probableSection: SectionClassification | null
  probability: number                   // 0-1, organic confidence (PLL + section hysteresis)
  estimatedTimeMs: number               // ETA to event in ms (fluid, not fixed beat lookup)
  estimatedBeats: number                // ETA in beats
  reasoning: string
  suggestedActions: PredictionAction[]
  timestamp: number
}

export interface PredictionAction {
  type: 'prepare' | 'execute' | 'recover'
  effect: 'flash' | 'strobe' | 'pulse' | 'blackout' | 'color_shift' | 'intensity_ramp' | 'breathe'
  intensity: number                     // 0-1
  durationMs: number
  timingOffsetMs: number                // Negative = before event
}
```

**Note:** There is also a legacy `MusicalPrediction` in `types.ts:396-408` with a
simpler shape (`timeUntilMs` instead of `estimatedTimeMs`), and another in
`engine/musical/types.ts:441-447`. The canonical version used by DecisionMaker is
the one in `PredictionEngine.ts` above.

---

## 6. DecisionInputs

**Source:** `electron-app/src/core/intelligence/think/DecisionMaker.ts:131-176`

Everything the DecisionMaker consumes to produce a ConsciousnessOutput.

```typescript
export interface DecisionInputs {
  /** Current musical pattern */
  pattern: SeleneMusicalPattern

  /** Aesthetic beauty analysis */
  beauty: BeautyAnalysis

  /** Temporal coherence with previous state */
  consonance: ConsonanceAnalysis

  /** Hunt engine FSM decision (predator phases) */
  huntDecision: HuntDecision

  /** Cassandra prediction */
  prediction: MusicalPrediction

  /** Timestamp */
  timestamp: number

  /** DNA Brain integration (Dream Engine) */
  dreamIntegration?: IntegrationDecision

  /** Zone awareness for divine/drop gating */
  energyContext?: EnergyContext

  /** Current Z-Score (for DIVINE detection) */
  zScore?: number

  /** Spectral context for texture-aware filtering */
  spectralContext?: {
    clarity: number
    texture: 'clean' | 'warm' | 'harsh' | 'noisy'
    harshness: number
    flatness: number
    centroid: number
  }

  /** Active dictator effect (prevents DIVINE spam) */
  activeDictator?: string | null

  /** Fuzzy logic decision (WAVE 2105: Fuzzy Resurrection) */
  fuzzyDecision?: FuzzyDecision

  /** Max energy in 30s rolling window (for Absolute Energy Gate) */
  energyMaxHistoric?: number
}
```

### Supporting types consumed by DecisionInputs

#### HuntDecision
**Source:** `electron-app/src/core/intelligence/think/HuntEngine.ts:76-94`

```typescript
export type HuntPhase = 'sleeping' | 'stalking' | 'evaluating' | 'striking' | 'learning'

export interface HuntDecision {
  suggestedPhase: HuntPhase
  worthiness: number                    // 0-1, how "worthy" of an effect
  confidence: number                    // 0-1
  conditions: StrikeConditions | null   // Evaluated strike conditions
  activeCandidate: HuntCandidate | null // Current candidate
  reasoning: string
}
```

#### BeautyAnalysis
**Source:** `electron-app/src/core/intelligence/sense/BeautySensor.ts:31-52`

```typescript
export interface BeautyAnalysis {
  totalBeauty: number                   // 0-1
  phiAlignment: number                  // 0-1, golden ratio adherence
  fibonacciDistribution: number         // 0-1
  chromaticHarmony: number              // 0-1
  contrastBalance: number              // 0-1
  trend: 'rising' | 'stable' | 'falling'
  timestamp: number
}
```

#### FuzzyDecision
**Source:** `electron-app/src/core/intelligence/think/FuzzyDecisionMaker.ts:157-170`

```typescript
export interface FuzzyDecision {
  action: 'force_strike' | 'strike' | 'prepare' | 'hold'
  intensity: number                     // 0-1
  confidence: number                    // 0-1
  reasoning: string
  fuzzyScores: FuzzyOutputs             // Raw fuzzy scores for debug
  dominantRule: string                  // Rule that fired
}
```

#### IntegrationDecision
**Source:** `electron-app/src/core/intelligence/integration/DreamEngineIntegrator.ts:85-96`

```typescript
export interface IntegrationDecision {
  approved: boolean
  effect: EffectCandidate | null
  dreamTime: number                     // ms spent in dream simulation
  filterTime: number                    // ms spent in ethical filtering
  totalTime: number                     // total integration time
  dreamRecommendation: string
  ethicalVerdict: EthicalVerdict | null
  circuitHealthy: boolean
  fallbackUsed: boolean
  alternatives: EffectCandidate[]
}
```

#### EffectCandidate
**Source:** `electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts:67-76`

```typescript
export interface EffectCandidate {
  effect: string                        // 'industrial_strobe', 'acid_sweep', etc.
  effectName?: string                   // Human-readable from .lfx clip.name
  intensity: number                     // 0-1
  zones: string[]                       // ['all'], ['movers'], etc.
  reasoning: string
  confidence: number                    // 0-1, from DecisionMaker
  projectedBeauty?: number              // From DreamEngine
  riskLevel?: number                    // From DreamEngine
}
```

#### EthicalVerdict
**Source:** `electron-app/src/core/intelligence/conscience/VisualConscienceEngine.ts:54-77`

```typescript
export interface EthicalVerdict {
  verdict: 'APPROVED' | 'REJECTED' | 'DEFERRED'
  approvedEffect: EffectCandidate | null
  ethicalScore: number                  // 0-1, combined ethical score
  valueScores: Record<string, number>   // Per-value scores
  reasoning: string
  warnings: string[]
  violations: EthicalViolation[]
  alternatives: EffectCandidate[]
  circuitBreakerStatus: 'OPEN' | 'CLOSED' | 'HALF_OPEN'
  evaluationTime: number                // ms
  confidence: number                    // 0-1
}
```

---

## 7. ConsciousnessOutput

**Source:** `electron-app/src/core/protocol/ConsciousnessOutput.ts:180-263`

The final output of Selene's cognitive pipeline. Emitted every frame.

```typescript
export type HuntState = 'sleeping' | 'stalking' | 'evaluating' | 'striking' | 'learning'

export type DecisionSource =
  | 'hunt'
  | 'dream'
  | 'evolution'
  | 'bias-correction'
  | 'memory'
  | 'prediction'        // WAVE 500: Anticipatory
  | 'beauty'            // WAVE 500: Aesthetic maximization
  | 'consonance'        // WAVE 500: Temporal coherence

export interface ConsciousnessOutput {
  colorDecision: ConsciousnessColorDecision | null
  physicsModifier: ConsciousnessPhysicsModifier | null
  movementDecision: ConsciousnessMovementDecision | null
  effectDecision: ConsciousnessEffectDecision | null
  confidence: number                    // 0-1, general output confidence
  timestamp: number
  source: DecisionSource
  debugInfo: ConsciousnessDebugInfo
}
```

### Sub-decisions

```typescript
export interface ConsciousnessColorDecision {
  suggestedHue?: number                 // 0-360, must be within Constitution
  suggestedStrategy?: 'analogous' | 'complementary' | 'triadic' | 'split-complementary' | 'prism'
  saturationMod?: number                // 0.8-1.2
  brightnessMod?: number                // 0.8-1.2
  confidence: number
  reasoning?: string
}

export interface ConsciousnessPhysicsModifier {
  strobeIntensity?: number              // 0.3-1.0 (IGNORED if energy > 0.75)
  flashIntensity?: number               // 0.3-1.0 (IGNORED if energy > 0.75)
  triggerThresholdMod?: number          // 0.8-1.2
  confidence: number
}

export interface ConsciousnessMovementDecision {
  pattern?: 'sweep' | 'chase' | 'static' | 'mirror' | 'circle' | 'figure8' | 'wave'
  speedMultiplier?: number              // 0.5-1.5
  confidence: number
  reasoning?: string
}

export interface ConsciousnessEffectDecision {
  effectType: string                    // e.g., 'solar_flare', 'strobe_burst'
  effectName?: string                   // Human-readable .lfx clip name
  intensity: number                     // 0-1
  zones?: ('all' | 'front' | 'back' | 'movers' | 'movers_left' | 'movers_right' | 'pars')[]
  reason?: string
  confidence: number
}
```

### Debug info

```typescript
export interface ConsciousnessDebugInfo {
  huntState: HuntState
  beautyScore: number
  consonance: number
  beautyTrend: 'rising' | 'falling' | 'stable'
  biasesDetected: string[]
  reasoning?: string
  activePrediction?: {
    type: string
    probability: number
    timeUntilMs: number
  }
  cyclesInCurrentState: number
  lastDream?: {
    scenario: string
    beautyDelta: number
    recommendation: 'execute' | 'modify' | 'abort'
  }
  fuzzyAction?: 'force_strike' | 'strike' | 'prepare' | 'hold'
  zScore?: number
  dropBridgeAlert?: 'none' | 'watching' | 'imminent' | 'activated'
}
```

---

## 8. CognitiveDNA

**Source:** `electron-app/src/core/arsenal/lfxTypes.ts:74-164`

The cognitive genome for AI effect matching. Single source of truth —
EFFECT_DNA_REGISTRY purged (WAVE 4825). All fields `readonly` for zero-alloc hot path.

```typescript
/** Immutable unit-cube coordinates (A, C, O) */
export interface FrozenGenome {
  readonly aggression: number
  readonly chaos: number
  readonly organicity: number
}

export interface Range {
  readonly min: number
  readonly max: number
}

export interface EnergyZoneRange {
  readonly min: EnergyZone
  readonly max: EnergyZone
}

export type TextureAffinity = 'clean' | 'dirty' | 'universal'

export type SpatialBehavior =
  | 'static'              // No pan/tilt, only dimmer/color/optics
  | 'relative_offset'    // Emits pan/tilt offset [-1,+1], additive to IK base
  | 'absolute'           // Hijacks absolute pan/tilt
  | 'spatial'            // Reserved: 3D trajectory (x,y,z) for IK engine

export type ExecutionDomain = 'vector' | 'pixel' | 'hybrid'

export interface IKCompatibility {
  readonly respectsTarget: boolean
  readonly orbitAmplitude: number       // 0-1, only for relative_offset
  readonly fallbackOnNoTarget: 'static' | 'absolute' | 'silence'
}

export interface PixelExecutionHints {
  readonly mappingSpace: 'world' | 'local'
  readonly preferredResolution: { readonly w: number; readonly h: number }
  readonly blend: 'replace' | 'multiply' | 'add' | 'screen'
  readonly alphaToDimmer: boolean
  readonly hybridChannels?: readonly string[]
  readonly targetFps?: number           // 15-60, default = arbiter rate (44Hz)
  readonly guerrillaPolicy?: 'omit' | 'fallback-zone'
}

export interface CognitiveDNA {
  readonly genome: FrozenGenome
  readonly textureAffinity: TextureAffinity
  readonly compatibleVibes: readonly string[]
  readonly validSections: readonly string[]
  readonly energyZone: EnergyZoneRange
  readonly aggressionRange: Range

  // WAVE 2481 V2: mandatory spatial directive
  readonly spatialBehavior: SpatialBehavior
  readonly ikCompatibility?: IKCompatibility

  // WAVE 4812: execution domain (vector vs pixel-map)
  readonly executionDomain?: ExecutionDomain
  readonly pixelHints?: PixelExecutionHints
}
```

### Default CognitiveDNA

**Source:** `electron-app/src/core/hephaestus/defaults.ts:10-19`

```typescript
export const DEFAULT_COGNITIVE_DNA: Readonly<CognitiveDNA> = Object.freeze({
  genome: { aggression: 0.5, chaos: 0.5, organicity: 0.5 },
  textureAffinity: 'universal',
  compatibleVibes: [],
  validSections: [],
  energyZone: { min: 'ambient', max: 'peak' },
  aggressionRange: { min: 0, max: 1 },
  spatialBehavior: 'absolute',
  ikCompatibility: undefined,
})
```

### Genetic Blending (Crossover)

**Source:** `electron-app/src/core/genesis/operators/GeneticOperators.ts:885-938`

- Genome blended 60/40 toward dominant parent
- `compatibleVibes` and `validSections` are unioned
- **G4 Pre-screening:** if unioned `energyZone` span > 2 zones, collapses to dominant's range
- `aggressionRange` is min-min / max-max

---

## 9. SUPPORTING TYPES

### SectionClassification

```typescript
export type SectionClassification =
  | 'intro' | 'verse' | 'buildup' | 'chorus'
  | 'drop' | 'breakdown' | 'outro'
```

### EnergyPhase

```typescript
export type EnergyPhase = 'valley' | 'building' | 'peak' | 'drop'
```

### EnergyZone (canonical order)

```typescript
export type EnergyZone =
  | 'silence'   // E < 0.10
  | 'valley'    // E 0.10-0.20
  | 'ambient'   // E 0.20-0.35
  | 'gentle'    // E 0.35-0.50
  | 'active'    // E 0.50-0.70
  | 'intense'   // E 0.70-0.85
  | 'peak'      // E > 0.85
```

Canonical ordering: `silence(0) → valley(1) → ambient(2) → gentle(3) → active(4) → intense(5) → peak(6)`

---

## 10. ARCHITECTURAL CONSTRAINTS & CONSTANTS

### Energy Override (The Rule of Cool)

```typescript
export const ENERGY_OVERRIDE_THRESHOLD = 0.75  // WAVE 4829: 0.85→0.75 for Latino drops
```

If `energy > 0.75`, physics modifiers are IGNORED. Physics has VETO TOTAL in drops/climax.
"In the drops, physics commands. In the valleys, Selene thinks."

### Absolute Energy Gate (DecisionMaker)

| Path | Ratio | Fallback |
|------|-------|----------|
| DIVINE | 0.60 × maxHistoric(30s) | 0.50 |
| DROP | 0.48 × maxHistoric(30s) | 0.40 |

### Spectral Gate (Anti-Bad-Bunny, WAVE 4864)

Only for latino/dembow vibes, only when Absolute Energy Gate passed:
- `hasHeavyKick`: `lowBand >= maxHistoric × 0.75`
- `isNotJustVocals`: `lowBand >= midBand × 0.95`
- Both must be `true` to open the spectral gate

### Z-Score Thresholds

#### ContextualMemory Base

| Threshold | Value |
|-----------|-------|
| `zScoreNotable` | 1.5σ |
| `zScoreSignificant` | 2.0σ |
| `zScoreEpic` | 2.5σ |

#### RollingStats

| Parameter | Value |
|-----------|-------|
| `bufferSize` | 1800 frames (~30s @ 60fps) |
| `minStdDev` | 0.10 (floor, anti-false-positive) |
| `maxZScoreCap` | 10.0 (outlier clamp) |
| `isWarmedUp` | buffer ≥ 50% (900 frames ~ 15s) |

#### DropBridge Thresholds by Vibe

| Vibe | Z-Score | Min Energy | Watching | Imminent |
|------|---------|------------|----------|----------|
| Standard | 3.0σ | 0.60 | 2.0σ | 2.5σ |
| Latino | 3.5σ | 0.70 | 2.5σ | 3.0σ |
| Techno | 2.2σ | 0.55 | 1.5σ | 2.0σ |

#### DecisionMaker DIVINE Threshold by Vibe

| Vibe | Threshold | Notes |
|------|-----------|-------|
| Standard | 4.0σ | `DIVINE_THRESHOLD = 4.0` |
| Techno | 2.5σ | Techno maxes at ~2.6σ |
| Latino | 2.2σ | Dembow inflates Z-scores |

`DIVINE_ENERGY_GATE = 0.80` — rawEnergy must be ≥ 0.80 for DIVINE.

#### Anti-Fake-Drop Z-Score by Vibe

| Vibe | antiFakeThreshold | Exceptions |
|------|-------------------|------------|
| Latino | 1.1σ | WAVE 5018-B |
| Standard | 0.5σ | — |
| Techno | 0.2σ | If `lowBand > 0.65`: -1.0σ. If DNA approved PUNK/BALANCED: -0.2σ |

### Decision Hierarchy (WAVE 1010)

```
0. 🌩️ DIVINE MOMENT (Z > threshold + energy > 0.65 + valid zone) — MANDATORY
1. 🧬 DNA Brain Integration (if approved)
2. 🎯 HuntEngine worthiness
3. 📉 Predicted drop (Cassandra)
4. 📈 Buildup/Beauty enhancement
5. 🧘 Hold (silence is a valid decision)
```

### Fallthrough Abolished (WAVE 2111)

If DNA chose `acid_sweep` and it's in cooldown, SILENCE is correct.
No plan B. No panic substitution. "The true intelligence is knowing when NOT to fire."

### Post-Drop Refractory Lock (WAVE 4860)

After a DROP or high-severity effect, minor candidates are vetoed for 4s
to preserve visual contrast (retinal breathing space).

### DNA Cooldown Override (WAVE 973.3 + 2093.2)

DNA can bypass cooldown IF:
- `allowEthicsOverride` is true for current mood
- `ethicalScore >= ethicsThreshold`
- Not an oceanic effect in chill vibe
- Temporal guard: 15s between any override, 30s for same effect
- HARD_COOLDOWN is absolute law (cannot be overridden)

### NodeArbiter L3 Supremacy (WAVE 4829)

- L3 (Selene/effects) dominates L0/L1 channels via Anti-Bleeding Shield
- Manual Hard Lock remains the final human operator authority
- L3 cannot counter the operator

---

## DATA FLOW SUMMARY

```
┌─────────────────────────────────────────────────────────────────────┐
│  AUDIO FFT                                                          │
│  bass / mid / high / rawEnergy / harshness / clarity / ultraAir     │
└──────────────────────────┬──────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  TitanEngine (stabilizers: key 10s, emotion 5s, strategy 15s)       │
│  → TitanStabilizedState                                             │
└──────────────────────────┬──────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SeleneTitanConscious.process(titanState)                           │
│                                                                     │
│  ├─→ MusicalPatternSensor → SeleneMusicalPattern                    │
│  ├─→ BeautySensor → BeautyAnalysis                                  │
│  ├─→ HuntEngine → HuntDecision                                      │
│  ├─→ PredictionEngine (Cassandra) → MusicalPrediction               │
│  ├─→ ContextualMemory (RollingStats 30s) → Z-Score, maxHistoric     │
│  ├─→ FuzzyDecisionMaker → FuzzyDecision                             │
│  ├─→ DreamEngineIntegrator → IntegrationDecision                    │
│  │    ├─→ EffectDreamSimulator (DNA matching)                       │
│  │    └─→ VisualConscienceEngine (ethical filter)                   │
│  └─→ DecisionMaker.makeDecision(DecisionInputs)                     │
│       ├─→ Absolute Energy Gate (0.60 / 0.48)                        │
│       ├─→ Spectral Gate (Anti-Bad-Bunny, latino only)               │
│       ├─→ DIVINE detection (Z > threshold per vibe)                 │
│       ├─→ Anti-Fake-Drop (Z sanity per vibe)                        │
│       ├─→ Drop Lock (one effect per drop section)                   │
│       └─→ ConsciousnessOutput                                       │
└──────────────────────────┬──────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  TitanEngine applies:                                               │
│  ├─→ colorDecision → palette modulation                             │
│  ├─→ physicsModifier → strobe/flash/threshold (if E < 0.75)         │
│  ├─→ effectDecision → EffectManager.trigger()                       │
│  └─→ movementDecision → movement pattern                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

*End of Context Pack — Read-only document, no source files modified.*
*Generated for WAVE 7000 PREP — FABLE CONTEXT PACK GENERATION.*
