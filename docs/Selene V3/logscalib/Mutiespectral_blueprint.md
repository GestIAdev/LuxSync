# MASTER ARCHITECTURAL BLUEPRINT
# Multi-Spectral Acoustic Reality & Fusion Engine (M-SARFE)

> **Codename:** Selene V4 Perception Core
> **Status:** Architectural Design — No Implementation
> **Date:** 2026-07-09
> **Author:** Lead DSP & AI Architect
> **Forensic Basis:** `FORENSIC-AUDIT.md`, `seccionesmusicales.md`, `energyladder.md`

---

## TABLE OF CONTENTS

1. [Executive Summary — Why the Current System is Blind](#1-executive-summary)
2. [Core Mathematical Model](#2-core-mathematical-model)
3. [Module I: Multi-Spectral Section Tracker (MSST)](#3-module-i-multi-spectral-section-tracker)
4. [Module II: Multi-Spectral Energy Ladder (MSEL)](#4-module-ii-multi-spectral-energy-ladder)
5. [Module III: Thermodynamic Veto Engine (TVE)](#5-module-iii-thermodynamic-veto-engine)
6. [Module IV: State Coupling — Zone × Phase Alignment](#6-module-iv-state-coupling)
7. [Unified Data Flow Architecture](#7-unified-data-flow)
8. [Migration Strategy — What Dies, What Survives](#8-migration-strategy)

---

## 1. EXECUTIVE SUMMARY — Why the Current System is Blind

### The Three Systemic Failures

| # | Failure | Root Cause | File |
|---|---------|-----------|------|
| 1 | **1D Energy Ladder** | Zone classification uses only `rawEnergy` (0-1). A vocal scream with bass drop produces `rawEnergy ≈ 0.35` → classified as AMBIENT. High-frequency tension is invisible. | `EnergyConsciousnessEngine.ts:412-438` |
| 2 | **Blind Phase Mapping** | `inferNarrativePhase()` maps `sectionType` string → phase string without consulting any Z-Score. `'drop'` → `'climax'` even when energy is at -2σ. | `ContextualMemory.ts:400-424` |
| 3 | **Fake Section Tracker** | `SimpleSectionTracker` uses raw volume thresholds + 4s blind hold timer. Once in `'drop'`, stays in `'drop'` for 4s regardless of acoustic reality. | `TrinityBridge.ts:1005-1241` |

### The Design Principle

> **"The Worker proposes. The Main Thread disposes."**
>
> Section tags from the Worker are **hypotheses**, not facts. The Main Thread's
> Thermodynamic Veto Engine validates every hypothesis against real-time
> multi-spectral Z-Scores before any narrative phase is declared.

---

## 2. CORE MATHEMATICAL MODEL

### 2.1 Spectral Band Definitions

The audio pipeline already provides three bands. We formalize them as first-class signals:

```
E_low(t)  = normalized bass energy    [0, 1]   (sub-bass + bass, ~20-250 Hz)
E_mid(t)  = normalized mid energy     [0, 1]   (vocals + instruments, ~250-4000 Hz)
E_high(t) = normalized treble energy  [0, 1]   (cymbals + air, ~4000-16000 Hz)
E_total(t) = weighted fusion          [0, 1]   (see §2.4)
```

### 2.2 Multi-Spectral Z-Scores

Each band gets its own rolling statistical context. Window: **30 seconds** (~1800 frames @ 60fps), matching the existing `ContextualMemory` buffer.

```
Z_low(t)  = (E_low(t)  - μ_low)  / σ_low
Z_mid(t)  = (E_mid(t)  - μ_mid)  / σ_mid
Z_high(t) = (E_high(t) - μ_high) / σ_high
Z_total(t) = (E_total(t) - μ_total) / σ_total
```

Where μ and σ are computed over the rolling window with Welford's algorithm (already implemented in `RollingStats`).

### 2.3 Crest Factor (Per Band)

Crest factor measures the **peak-to-RMS ratio** — the spikiness of a signal. Vocal screams and snare rolls produce high crest factor in the high band.

```
CF_band(t) = peak_band(window) / RMS_band(window)

CF_low(t)  = peak_low(30s)  / RMS_low(30s)
CF_high(t) = peak_high(30s) / RMS_high(30s)
```

**Critical insight:** `CF_high > 6.0` with `Z_high > +1.5` is the signature of a vocal scream or textural drop — even if `E_total` is low.

### 2.4 Total Energy Fusion

The current system uses `rawEnergy` as a single scalar. The new model computes `E_total` as a **weighted fusion** that preserves spectral awareness:

```
E_total(t) = w_low · E_low(t) + w_mid · E_mid(t) + w_high · E_high(t)

Default weights: w_low = 0.40, w_mid = 0.35, w_high = 0.25
```

> **Note:** These weights are NOT the same as `SimpleSectionTracker`'s `frequencyWeights`.
> The old weights were applied to RAW power values (0.01-0.12). The new weights
> operate on NORMALIZED band energies (0-1).

### 2.5 Spectral Tension Index (T)

A new composite metric that captures **textural tension** — moments where the spectral distribution is extreme even if total energy is moderate:

```
T(t) = max(0, Z_high(t)) · sigmoid(CF_high(t) - 4.0)
       + max(0, -Z_low(t)) · 0.5
       + max(0, Z_mid(t) - Z_low(t)) · 0.3

Where sigmoid(x) = 1 / (1 + e^(-x))
```

**Interpretation:**
- `T > 0.8`: High textural tension (vocal scream, synth screech, cymbal wash)
- `T ≈ 0.0`: Spectrally balanced moment (normal music)
- `T` is **additive** to the energy zone classification — it can elevate a low-energy moment to a higher zone

### 2.6 Spectral Divergence (D)

Measures how "split" the spectrum is — when bands move in opposite directions:

```
D(t) = |Z_low(t) - Z_high(t)| + |Z_mid(t) - (Z_low(t) + Z_high(t)) / 2|
```

- `D > 3.0`: Extreme spectral divergence (bass drop + high-frequency explosion)
- `D < 1.0`: Spectral coherence (all bands moving together)

---

## 3. MODULE I: MULTI-SPECTRAL SECTION TRACKER (MSST)

> **Replaces:** `SimpleSectionTracker` in `TrinityBridge.ts`
> **Location:** Worker BETA (TrinityBridge)
> **Output:** `MultiSpectralSectionHypothesis` (NOT a string — a rich object)

### 3.1 Core Interface

```typescript
/**
 * Multi-Spectral Section Hypothesis
 *
 * Emitted by the Worker. Treated as a HYPOTHESIS by the Main Thread.
 * The Thermodynamic Veto Engine validates or rejects this before
 * any narrative phase is declared.
 */
export interface MultiSpectralSectionHypothesis {
  /** Proposed section type — the Worker's best guess */
  readonly proposedSection: SectionType;

  /** Confidence in the proposal [0, 1] — based on evidence strength */
  readonly confidence: number;

  /** Multi-spectral evidence bundle — the RAW data behind the proposal */
  readonly evidence: SectionEvidence;

  /** Timestamp (ms) from the worker's clock */
  readonly timestamp: number;

  /** Frame index for deduplication */
  readonly frameIndex: number;
}

export type SectionType =
  | 'intro'
  | 'verse'
  | 'buildup'
  | 'chorus'
  | 'drop'
  | 'textural_drop'    // NEW: vocal scream / high-freq tension with bass drop
  | 'breakdown'
  | 'bridge'
  | 'outro'
  | 'unknown';

/**
 * The acoustic evidence that supports (or contradicts) the section hypothesis.
 * This is the data the Main Thread will use to validate or veto.
 */
export interface SectionEvidence {
  // Multi-spectral Z-Scores (computed in worker with 30s rolling window)
  readonly zLow: number;
  readonly zMid: number;
  readonly zHigh: number;
  readonly zTotal: number;

  // Crest factors per band
  readonly cfLow: number;
  readonly cfHigh: number;

  // Raw band energies (normalized 0-1)
  readonly eLow: number;
  readonly eMid: number;
  readonly eHigh: number;
  readonly eTotal: number;

  // Composite metrics
  readonly spectralTension: number;   // T(t) — see §2.5
  readonly spectralDivergence: number; // D(t) — see §2.6

  // Rhythm
  readonly hasKick: boolean;
  readonly kickIntensity: number;
  readonly bpm: number;
  readonly beatPhase: number;

  // Temporal dynamics
  readonly energyDelta: number;       // recent - older (16 vs 32 frame windows)
  readonly bassRatio: number;         // recent bass / older bass
}
```

### 3.2 Detection Logic

The MSST replaces the threshold-based `if/else` chain with a **multi-criteria scoring system**. Each section type gets a score; the highest score wins.

```typescript
/**
 * Multi-Spectral Section Tracker
 *
 * Instead of hard thresholds, each section type is scored against
 * the multi-spectral evidence. The highest-scoring section becomes
 * the hypothesis. Confidence = winner_score / (winner_score + runner_up_score).
 */
export class MultiSpectralSectionTracker {

  private readonly windowSize: number = 1800; // 30s @ 60fps
  private readonly bandStats: TriBandRollingStats;

  // Hysteresis: prevent rapid flicker
  private currentSection: SectionType = 'verse';
  private framesInCurrentSection: number = 0;
  private readonly MIN_FRAMES_IN_SECTION: number = 30; // ~1s minimum stay

  analyze(audio: AudioMetrics, rhythm: RhythmOutput): MultiSpectralSectionHypothesis {

    // 1. Update rolling statistics per band
    const stats = this.bandStats.update(audio.bass, audio.mid, audio.treble);

    // 2. Compute composite metrics
    const spectralTension = this.computeTension(stats);
    const spectralDivergence = this.computeDivergence(stats);
    const crestFactors = this.bandStats.getCrestFactors();

    // 3. Build evidence bundle
    const evidence: SectionEvidence = {
      zLow: stats.zLow,
      zMid: stats.zMid,
      zHigh: stats.zHigh,
      zTotal: stats.zTotal,
      cfLow: crestFactors.low,
      cfHigh: crestFactors.high,
      eLow: audio.bass,
      eMid: audio.mid,
      eHigh: audio.treble,
      eTotal: stats.fusedEnergy,
      spectralTension,
      spectralDivergence,
      hasKick: rhythm.drums?.kick ?? false,
      kickIntensity: rhythm.drums?.kickIntensity ?? 0,
      bpm: audio.bpm,
      beatPhase: audio.beatPhase,
      energyDelta: stats.energyDelta,
      bassRatio: stats.bassRatio,
    };

    // 4. Score all section types
    const scores = this.scoreAllSections(evidence);

    // 5. Select winner with hysteresis
    const winner = this.selectWithHysteresis(scores);

    // 6. Compute confidence
    const confidence = this.computeConfidence(scores, winner);

    return {
      proposedSection: winner,
      confidence,
      evidence,
      timestamp: Date.now(),
      frameIndex: this.frameCount++,
    };
  }

  /**
   * Score every section type against the evidence.
   * Each scorer returns [0, 1] — higher = more likely.
   */
  private scoreAllSections(ev: SectionEvidence): Record<SectionType, number> {
    return {
      intro:      this.scoreIntro(ev),
      verse:      this.scoreVerse(ev),
      buildup:    this.scoreBuildup(ev),
      chorus:     this.scoreChorus(ev),
      drop:       this.scoreDrop(ev),
      textural_drop: this.scoreTexturalDrop(ev),
      breakdown:  this.scoreBreakdown(ev),
      bridge:     this.scoreBridge(ev),
      outro:      this.scoreOutro(ev),
      unknown:    0.0,
    };
  }
}
```

### 3.3 Section Scorers — Mathematical Definitions

#### 3.3.1 DROP (Classical Bass Drop)

```
score_drop = clamp(
    σ(Z_low > +1.0)           // Bass is significantly above mean
  + σ(Z_total > +0.8)         // Total energy is high
  + σ(bassRatio > 1.3)        // Bass is rising vs recent history
  + σ(hasKick)                // Kick drum present
  + σ(kickIntensity > 0.3)    // Kick is strong
  + σ(energyDelta > 0.05)     // Energy is increasing
  , 0, 1)

Where σ(x) = 1 if x else 0  (step function for hard criteria)
```

**Key difference from SimpleSectionTracker:** No 4-second blind hold. The score is recomputed every frame. If the bass disappears, `Z_low` drops and the score collapses immediately.

#### 3.3.2 TEXTURAL_DROP (NEW — Vocal Scream / High-Freq Tension)

```
score_textural_drop = clamp(
    σ(Z_high > +1.5)                    // High frequencies are anomalous
  + σ(CF_high > 5.0)                    // High-freq signal is spiky (screams, cymbals)
  + σ(Z_low < -0.5)                     // Bass is BELOW mean (the "drop" part)
  + σ(spectralTension > 0.8)            // Composite tension is high
  + σ(spectralDivergence > 2.5)         // Spectrum is split (bass down, highs up)
  + 0.5 · σ(Z_mid > +1.0)              // Vocal presence in mid band
  , 0, 1)
```

**This is the section type that the current system CANNOT detect.** A vocal scream where bass drops from 0.7 to 0.2 but high-freq spikes from 0.3 to 0.9 produces:
- `Z_low ≈ -1.5` (bass below mean)
- `Z_high ≈ +2.5` (highs way above mean)
- `CF_high ≈ 7.0` (screamy signal)
- `spectralTension ≈ 1.2` (high tension)
- `E_total ≈ 0.40` (moderate — the old system says "AMBIENT")

#### 3.3.3 BUILDUP

```
score_buildup = clamp(
    σ(energyDelta > 0.03)              // Energy is rising
  + σ(Z_total > -0.5 && Z_total < +1.0) // Energy is moderate, not yet peaked
  + σ(bassRatio > 1.05 && bassRatio < 1.3) // Bass rising gently
  + 0.5 · σ(spectralTension > 0.3)     // Some tension building
  + σ(!hasKick || kickIntensity < 0.5) // Not yet a full drop
  , 0, 1)
```

#### 3.3.4 BREAKDOWN

```
score_breakdown = clamp(
    σ(energyDelta < -0.08)             // Energy is falling
  + σ(Z_total < -0.5)                  // Total energy below mean
  + σ(Z_low < -0.5)                    // Bass below mean
  + σ(spectralTension < 0.3)           // Low tension (not a textural drop)
  + σ(spectralDivergence < 1.5)        // Spectrum is coherent (all bands falling together)
  , 0, 1)
```

**Critical distinction:** `textural_drop` requires `Z_low < -0.5` AND `spectralTension > 0.8`. `breakdown` requires `Z_low < -0.5` AND `spectralTension < 0.3`. They are **mutually exclusive** by design — the tension index separates "energy collapse" from "textural explosion."

#### 3.3.5 CHORUS

```
score_chorus = clamp(
    σ(Z_total > +0.5)                  // Energy is above mean
  + σ(0.85 < bassRatio < 1.15)         // Bass is stable (not rising/falling)
  + σ(beatsSinceChange > 16)           // Section has been stable for a while
  + σ(spectralTension < 0.5)           // Not a textural moment
  + σ(Z_high < +1.0)                   // Highs are not anomalous
  , 0, 1)
```

#### 3.3.6 VERSE (Default / Neutral)

```
score_verse = clamp(
    0.3                                // Base score — verse is the "default"
  + σ(|Z_total| < 0.8)                 // Energy is near mean
  + σ(|energyDelta| < 0.03)            // Energy is stable
  + σ(spectralTension < 0.2)           // No significant tension
  + σ(beatsSinceChange > 32)           // Long enough in current section
  , 0, 1)
```

### 3.4 Hysteresis — No More Blind Hold Timers

The old `DROP_HOLD_TIME_MS = 4000` is **eliminated**. Instead, hysteresis is built into the scoring:

```typescript
private selectWithHysteresis(scores: Record<SectionType, number>): SectionType {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const winner = sorted[0][0] as SectionType;
  const runnerUp = sorted[1][0] as SectionType;

  // Hysteresis: current section gets a bonus to prevent flicker
  const STAY_BONUS = 0.15;
  const MIN_FRAMES = 30; // ~1s at 30fps

  if (this.framesInCurrentSection < MIN_FRAMES) {
    // Too early to transition — stay in current section
    return this.currentSection;
  }

  // Apply stay bonus to current section
  if (this.currentSection !== 'unknown') {
    scores[this.currentSection] += STAY_BONUS;
  }

  // Re-evaluate after bonus
  const adjustedWinner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0] as SectionType;

  if (adjustedWinner !== this.currentSection) {
    this.currentSection = adjustedWinner;
    this.framesInCurrentSection = 0;
  }

  return this.currentSection;
}
```

**Key difference:** The stay bonus is **0.15** — a small nudge. If the acoustic evidence strongly favors a different section (score > current + 0.15), the transition happens immediately. No 4-second blind window.

---

## 4. MODULE II: MULTI-SPECTRAL ENERGY LADDER (MSEL)

> **Replaces:** `EnergyConsciousnessEngine.determineZone()`
> **Location:** Main Thread (SeleneTitanConscious)
> **Input:** `MultiSpectralSectionHypothesis.evidence` + rolling stats
> **Output:** `MultiSpectralZone` (richer than the old `EnergyZone` string)

### 4.1 Core Interface

```typescript
/**
 * Multi-Spectral Energy Zone
 *
 * The zone is no longer a 1D classification of raw energy.
 * It incorporates spectral tension and divergence to recognize
 * textural drops and high-tension moments.
 */
export interface MultiSpectralZone {
  /** The zone label — compatible with existing effect filtering */
  readonly label: EnergyZoneLabel;

  /** Ordinal for O(1) comparison (compatible with ENERGY_ZONE_ORDINAL) */
  readonly ordinal: number;

  /** Base zone derived from E_total alone (backward compatibility) */
  readonly baseZone: EnergyZoneLabel;

  /** Tension elevation: how many zones was this elevated by spectral tension? */
  readonly tensionElevation: number;

  /** The full spectral snapshot at classification time */
  readonly spectral: SpectralSnapshot;
}

export type EnergyZoneLabel =
  | 'silence'
  | 'valley'
  | 'ambient'
  | 'gentle'
  | 'active'
  | 'intense'
  | 'peak';

export interface SpectralSnapshot {
  readonly zLow: number;
  readonly zMid: number;
  readonly zHigh: number;
  readonly zTotal: number;
  readonly spectralTension: number;
  readonly spectralDivergence: number;
  readonly cfHigh: number;
  readonly eTotal: number;
}
```

### 4.2 Zone Classification Logic

```typescript
export class MultiSpectralEnergyLadder {

  /**
   * Classify the current moment into a multi-spectral zone.
   *
   * ALGORITHM:
   * 1. Compute base zone from E_total (same thresholds as current system)
   * 2. Compute tension elevation from spectral tension index
   * 3. Final zone = baseZone + tensionElevation (clamped to 'peak')
   *
   * This means a moment with E_total=0.35 (AMBIENT) but spectralTension=1.2
   * (vocal scream) gets elevated to INTENSE or PEAK.
   */
  classify(evidence: SectionEvidence, smoothedEnergy: number): MultiSpectralZone {

    // 1. Base zone from smoothed total energy (existing thresholds)
    const baseZone = this.classifyByEnergy(smoothedEnergy);

    // 2. Tension elevation
    const tensionElevation = this.computeTensionElevation(evidence);

    // 3. Final zone = base + elevation
    const finalOrdinal = Math.min(
      baseZone.ordinal + tensionElevation,
      ENERGY_ZONE_ORDINAL['peak']
    );
    const finalLabel = ORDINAL_TO_ZONE[finalOrdinal];

    return {
      label: finalLabel,
      ordinal: finalOrdinal,
      baseZone: baseZone.label,
      tensionElevation,
      spectral: {
        zLow: evidence.zLow,
        zMid: evidence.zMid,
        zHigh: evidence.zHigh,
        zTotal: evidence.zTotal,
        spectralTension: evidence.spectralTension,
        spectralDivergence: evidence.spectralDivergence,
        cfHigh: evidence.cfHigh,
        eTotal: evidence.eTotal,
      },
    };
  }

  /**
   * Base zone classification — same 7-zone ladder, same thresholds.
   * This maintains backward compatibility with effect DNA energyZone ranges.
   */
  private classifyByEnergy(smoothed: number): { label: EnergyZoneLabel; ordinal: number } {
    if (smoothed < 0.15) return { label: 'silence', ordinal: 0 };
    if (smoothed < 0.30) return { label: 'valley',  ordinal: 1 };
    if (smoothed < 0.45) return { label: 'ambient', ordinal: 2 };
    if (smoothed < 0.60) return { label: 'gentle',  ordinal: 3 };
    if (smoothed < 0.75) return { label: 'active',  ordinal: 4 };
    if (smoothed < 0.90) return { label: 'intense', ordinal: 5 };
    return { label: 'peak', ordinal: 6 };
  }

  /**
   * Compute how many zones to elevate based on spectral tension.
   *
   * TENSION ELEVATION TABLE:
   *
   * spectralTension | elevation | Example
   * ─────────────────┼───────────┼─────────────────────────────
   * T < 0.3          |    0      | Normal music — no elevation
   * 0.3 ≤ T < 0.6    |    +1     | Mild tension — one zone up
   * 0.6 ≤ T < 0.9    |    +2     | Strong tension — two zones up
   * T ≥ 0.9          |    +3     | Extreme tension — three zones up
   *
   * ADDITIONAL GATE: Elevation requires Z_high > +1.0 OR CF_high > 5.0
   * This prevents false elevation from low-frequency rumble alone.
   */
  private computeTensionElevation(ev: SectionEvidence): number {
    // Gate: must have high-frequency evidence
    const hasHighFreqEvidence = ev.zHigh > 1.0 || ev.cfHigh > 5.0;
    if (!hasHighFreqEvidence) return 0;

    // Gate: must have spectral divergence (bands moving apart)
    if (ev.spectralDivergence < 1.5) return 0;

    const T = ev.spectralTension;
    if (T >= 0.9) return 3;
    if (T >= 0.6) return 2;
    if (T >= 0.3) return 1;
    return 0;
  }
}
```

### 4.3 Worked Examples

| Scenario | E_total | Base Zone | Tension T | Z_high | CF_high | D | Elevation | **Final Zone** |
|----------|---------|-----------|-----------|--------|---------|---|-----------|----------------|
| Normal techno kick | 0.78 | intense | 0.15 | +0.3 | 3.2 | 0.8 | 0 | **intense** |
| Vocal scream, bass drops | 0.35 | ambient | 1.20 | +2.5 | 7.0 | 3.5 | +3 | **peak** |
| Buildup with rising hats | 0.52 | gentle | 0.45 | +0.8 | 4.2 | 1.8 | +1 | **active** |
| Silence (all bands low) | 0.05 | silence | 0.02 | -1.5 | 2.0 | 0.5 | 0 | **silence** |
| Cymbal wash, bass steady | 0.58 | gentle | 0.70 | +1.8 | 5.5 | 2.2 | +2 | **intense** |
| Bass drop, highs calm | 0.85 | intense | 0.10 | -0.2 | 2.8 | 0.9 | 0 | **intense** |

---

## 5. MODULE III: THERMODYNAMIC VETO ENGINE (TVE)

> **Replaces:** `ContextualMemory.inferNarrativePhase()` (the blind string mapper)
> **Location:** Main Thread (ContextualMemory or new sibling module)
> **Input:** `MultiSpectralSectionHypothesis` + `MultiSpectralZone` + Z-Scores
> **Output:** `ValidatedNarrativePhase` (validated, not hallucinated)

### 5.1 Core Interface

```typescript
/**
 * Validated Narrative Phase
 *
 * The phase is NO LONGER a blind mapping from sectionType string.
 * It is the result of thermodynamic validation: the Worker's hypothesis
 * is checked against real-time acoustic evidence before being accepted.
 */
export interface ValidatedNarrativePhase {
  /** The final, validated phase */
  readonly phase: NarrativePhase;

  /** The Worker's original proposal */
  readonly proposedSection: SectionType;

  /** Whether the proposal was ACCEPTED, DOWNGRADED, or UPGRADED */
  readonly verdict: VetoVerdict;

  /** Why the verdict was issued (human-readable) */
  readonly reason: string;

  /** Confidence in the validated phase [0, 1] */
  readonly confidence: number;

  /** The acoustic evidence at validation time */
  readonly evidence: SectionEvidence;
}

export type NarrativePhase =
  | 'silence'      // NEW: Acoustic silence (all Z < -1.5)
  | 'valley'       // NEW: Low energy, low tension, post-collapse
  | 'building'     // Energy rising, tension building
  | 'climax'       // High energy OR high tension, validated
  | 'release'      // Energy falling, post-climax decompression
  | 'textural'     // NEW: High tension, moderate energy (vocal scream, etc.)
  | 'intro'
  | 'outro';

export type VetoVerdict =
  | 'ACCEPTED'     // Worker proposal matches acoustic evidence
  | 'DOWNGRADED'   // Worker proposed CLIMAX but evidence says no
  | 'UPGRADED'     // Worker proposed VERSE but evidence says tension
  | 'OVERRIDDEN'   // Worker proposed DROP but evidence says TEXTURAL
  | 'REJECTED';    // Worker proposal contradicts evidence entirely
```

### 5.2 The Veto Logic

```typescript
export class ThermodynamicVetoEngine {

  /**
   * Validate the Worker's section hypothesis against real-time acoustic evidence.
   *
   * PRINCIPLE: "The Worker proposes. The Main Thread disposes."
   *
   * The Worker's sectionType is a HYPOTHESIS. This function checks it against
   * the Z-Scores, crest factors, and spectral tension. If the hypothesis
   * contradicts the evidence, it is vetoed.
   */
  validate(
    hypothesis: MultiSpectralSectionHypothesis,
    zone: MultiSpectralZone,
  ): ValidatedNarrativePhase {

    const ev = hypothesis.evidence;
    const proposed = hypothesis.proposedSection;

    // ─────────────────────────────────────────────────────────────
    // GATE 0: SILENCE OVERRIDE — The absolute veto
    // If ALL bands are significantly below mean, we are in SILENCE.
    // No section tag can survive this. Not 'drop', not 'chorus', nothing.
    // ─────────────────────────────────────────────────────────────
    if (ev.zTotal < -1.5 && ev.zLow < -1.0 && ev.zHigh < -1.0) {
      return {
        phase: 'silence',
        proposedSection: proposed,
        verdict: 'REJECTED',
        reason: `SILENCE OVERRIDE: Z_total=${ev.zTotal.toFixed(1)} Z_low=${ev.zLow.toFixed(1)} Z_high=${ev.zHigh.toFixed(1)} — all bands below -1σ. Section "${proposed}" is hallucinated.`,
        confidence: 0.95,
        evidence: ev,
      };
    }

    // ─────────────────────────────────────────────────────────────
    // GATE 1: CLIMAX VALIDATION
    // Worker says 'drop' or 'chorus' → Main Thread must verify
    // that acoustic energy actually supports a climax.
    // ─────────────────────────────────────────────────────────────
    if (proposed === 'drop' || proposed === 'chorus') {

      // Case A: Classical drop — bass is high, total energy is high
      const isClassicalClimax =
        ev.zTotal > +0.5 &&
        ev.zLow > +0.3;

      // Case B: Textural climax — high tension, high-freq anomaly
      const isTexturalClimax =
        ev.spectralTension > 0.8 &&
        ev.zHigh > +1.5 &&
        ev.cfHigh > 5.0;

      if (isClassicalClimax) {
        return this.accept(proposed, 'climax', ev,
          `Classical climax validated: Z_total=${ev.zTotal.toFixed(1)} Z_low=${ev.zLow.toFixed(1)}`);
      }

      if (isTexturalClimax) {
        return {
          phase: 'textural',
          proposedSection: proposed,
          verdict: 'OVERRIDDEN',
          reason: `Textural climax detected: T=${ev.spectralTension.toFixed(2)} Z_high=${ev.zHigh.toFixed(1)} CF_high=${ev.cfHigh.toFixed(1)}. Classical drop overridden to textural.`,
          confidence: 0.85,
          evidence: ev,
        };
      }

      // VETO: Worker says climax but evidence says no
      return this.downgrade(proposed, ev, zone);
    }

    // ─────────────────────────────────────────────────────────────
    // GATE 2: TEXTURAL_DROP VALIDATION
    // Worker says 'textural_drop' → verify high-freq tension exists
    // ─────────────────────────────────────────────────────────────
    if (proposed === 'textural_drop') {
      if (ev.zHigh > +1.0 && ev.spectralTension > 0.6) {
        return this.accept(proposed, 'textural', ev,
          `Textural drop validated: Z_high=${ev.zHigh.toFixed(1)} T=${ev.spectralTension.toFixed(2)}`);
      }
      // Not enough high-freq evidence → downgrade
      return this.downgrade(proposed, ev, zone);
    }

    // ─────────────────────────────────────────────────────────────
    // GATE 3: BUILDUP VALIDATION
    // Worker says 'buildup' → verify energy is actually rising
    // ─────────────────────────────────────────────────────────────
    if (proposed === 'buildup') {
      if (ev.energyDelta > 0.02 && ev.zTotal > -0.5) {
        return this.accept(proposed, 'building', ev,
          `Buildup validated: ΔE=${ev.energyDelta.toFixed(3)} Z_total=${ev.zTotal.toFixed(1)}`);
      }
      // Energy not rising → not a buildup
      return {
        phase: ev.zTotal < -0.5 ? 'valley' : 'building',
        proposedSection: proposed,
        verdict: 'DOWNGRADED',
        reason: `Buildup not validated: ΔE=${ev.energyDelta.toFixed(3)} (not rising). Downgraded to ${ev.zTotal < -0.5 ? 'valley' : 'building'}.`,
        confidence: 0.60,
        evidence: ev,
      };
    }

    // ─────────────────────────────────────────────────────────────
    // GATE 4: BREAKDOWN VALIDATION
    // Worker says 'breakdown' → verify energy is actually falling
    // AND there is no textural tension (otherwise it's a textural_drop)
    // ─────────────────────────────────────────────────────────────
    if (proposed === 'breakdown') {
      if (ev.energyDelta < -0.05 && ev.spectralTension < 0.3) {
        return this.accept(proposed, 'release', ev,
          `Breakdown validated: ΔE=${ev.energyDelta.toFixed(3)} T=${ev.spectralTension.toFixed(2)}`);
      }
      // Energy falling but tension high → it's a textural moment, not a breakdown
      if (ev.energyDelta < -0.05 && ev.spectralTension > 0.6) {
        return {
          phase: 'textural',
          proposedSection: proposed,
          verdict: 'OVERRIDDEN',
          reason: `Breakdown overridden to textural: ΔE=${ev.energyDelta.toFixed(3)} but T=${ev.spectralTension.toFixed(2)}. Energy falling with high tension = textural release.`,
          confidence: 0.75,
          evidence: ev,
        };
      }
      // Energy stable → not a breakdown
      return this.downgrade(proposed, ev, zone);
    }

    // ─────────────────────────────────────────────────────────────
    // GATE 5: VERSE UPGRADE CHECK
    // Worker says 'verse' → check if there's hidden tension the Worker missed
    // ─────────────────────────────────────────────────────────────
    if (proposed === 'verse' || proposed === 'unknown') {
      if (ev.spectralTension > 0.7 && ev.zHigh > +1.5) {
        return {
          phase: 'textural',
          proposedSection: proposed,
          verdict: 'UPGRADED',
          reason: `Verse upgraded to textural: T=${ev.spectralTension.toFixed(2)} Z_high=${ev.zHigh.toFixed(1)}. Hidden high-frequency tension detected.`,
          confidence: 0.70,
          evidence: ev,
        };
      }
      if (ev.energyDelta > 0.05 && ev.zTotal > 0) {
        return {
          phase: 'building',
          proposedSection: proposed,
          verdict: 'UPGRADED',
          reason: `Verse upgraded to building: ΔE=${ev.energyDelta.toFixed(3)} Z_total=${ev.zTotal.toFixed(1)}. Energy is rising.`,
          confidence: 0.65,
          evidence: ev,
        };
      }
      return this.accept(proposed, 'building', ev,
        `Verse accepted as building (neutral state)`);
    }

    // ─────────────────────────────────────────────────────────────
    // GATE 6: INTRO / OUTRO — Pass-through
    // ─────────────────────────────────────────────────────────────
    if (proposed === 'intro') return this.accept(proposed, 'intro', ev, 'Intro passthrough');
    if (proposed === 'outro') return this.accept(proposed, 'outro', ev, 'Outro passthrough');

    // Default: accept as building
    return this.accept(proposed, 'building', ev, 'Default accept as building');
  }

  // ───────────────────────────────────────────────────────────────
  // Helper methods
  // ───────────────────────────────────────────────────────────────

  private accept(
    proposed: SectionType,
    phase: NarrativePhase,
    ev: SectionEvidence,
    reason: string,
  ): ValidatedNarrativePhase {
    return {
      phase,
      proposedSection: proposed,
      verdict: 'ACCEPTED',
      reason,
      confidence: 0.80,
      evidence: ev,
    };
  }

  private downgrade(
    proposed: SectionType,
    ev: SectionEvidence,
    zone: MultiSpectralZone,
  ): ValidatedNarrativePhase {
    // Downgrade based on actual energy zone
    const phase: NarrativePhase =
      zone.ordinal <= 1 ? 'valley' :   // silence/valley
      zone.ordinal <= 3 ? 'building' : // ambient/gentle
      'building';                       // active+ but not validated as climax

    return {
      phase,
      proposedSection: proposed,
      verdict: 'DOWNGRADED',
      reason: `Section "${proposed}" DOWNGRADED to ${phase}. Acoustic evidence: Z_total=${ev.zTotal.toFixed(1)} zone=${zone.label}. Energy does not support climax.`,
      confidence: 0.70,
      evidence: ev,
    };
  }
}
```

### 5.3 The Veto Decision Matrix

| Worker Proposes | Z_total | Z_high | Tension T | Verdict | Final Phase |
|----------------|---------|--------|-----------|---------|-------------|
| `drop` | +1.2 | +0.3 | 0.1 | **ACCEPTED** | `climax` |
| `drop` | -1.8 | -1.2 | 0.0 | **REJECTED** | `silence` |
| `drop` | +0.1 | +2.5 | 1.2 | **OVERRIDDEN** | `textural` |
| `drop` | -0.3 | +0.2 | 0.1 | **DOWNGRADED** | `building` |
| `chorus` | +0.8 | +0.5 | 0.2 | **ACCEPTED** | `climax` |
| `chorus` | -1.0 | -0.8 | 0.0 | **DOWNGRADED** | `valley` |
| `textural_drop` | +0.2 | +2.0 | 0.9 | **ACCEPTED** | `textural` |
| `textural_drop` | +0.2 | -0.3 | 0.1 | **DOWNGRADED** | `building` |
| `buildup` | +0.3 (ΔE>0.02) | — | — | **ACCEPTED** | `building` |
| `buildup` | -0.5 (ΔE<0) | — | — | **DOWNGRADED** | `valley` |
| `breakdown` | -0.8 (ΔE<-0.05) | -0.5 | 0.1 | **ACCEPTED** | `release` |
| `breakdown` | -0.3 (ΔE<-0.05) | +2.0 | 0.8 | **OVERRIDDEN** | `textural` |
| `verse` | +0.1 | +2.2 | 0.9 | **UPGRADED** | `textural` |
| `verse` | +0.3 (ΔE>0.05) | — | — | **UPGRADED** | `building` |
| ANY | < -1.5 (all bands) | < -1.0 | — | **REJECTED** | `silence` |

---

## 6. MODULE IV: STATE COUPLING — ZONE × PHASE ALIGNMENT

> **Principle:** Energy Zones and Narrative Phases must NEVER contradict each other.
> If the zone is `silence`, the phase MUST be `silence` — never `climax`.

### 6.1 The Coupling Matrix

The coupling matrix defines which (Zone, Phase) pairs are **valid**. Any pair outside this matrix is a contradiction that must be resolved.

```typescript
/**
 * COUPLING MATRIX: Valid (Zone, Phase) pairs
 *
 * ┌──────────┬──────────┬─────────┬──────────┬──────────┬───────────┐
 * │ Zone     │ silence  │ valley  │ ambient  │ gentle   │ active    │
 * │          │          │         │          │          │ intense   │
 * │          │          │         │          │          │ peak      │
 * ├──────────┼───────────────────────────────────────────────────────┤
 * │ silence  │  ✓       │  ✗      │  ✗       │  ✗       │  ✗        │
 * │ valley   │  ✗       │  ✓      │  ✓       │  ✗       │  ✗        │
 * │ ambient  │  ✗       │  ✓      │  ✓       │  ✓       │  ✗        │
 * │ gentle   │  ✗       │  ✗      │  ✓       │  ✓       │  ✓        │
 * │ active   │  ✗       │  ✗      │  ✗       │  ✓       │  ✓        │
 * │ intense  │  ✗       │  ✗      │  ✗       │  ✗       │  ✓        │
 * │ peak     │  ✗       │  ✗       │  ✗       │  ✗       │  ✓        │
 * └──────────┴──────────┴─────────┴──────────┴──────────┴───────────┘
 *
 * EXCEPTION: 'textural' phase can coexist with zones ambient → peak.
 * A vocal scream (textural) can occur at any energy level.
 * 'intro' and 'outro' phases can coexist with any zone.
 */
```

### 6.2 Coupling Enforcer

```typescript
/**
 * State Coupling Enforcer
 *
 * After the TVE produces a ValidatedNarrativePhase and the MSEL produces
 * a MultiSpectralZone, this module ensures they are consistent.
 * If they contradict, the ACOUSTIC evidence (zone) wins over the
 * narrative inference (phase).
 */
export class StateCouplingEnforcer {

  /**
   * Enforce consistency between zone and phase.
   *
   * RULE: The zone is derived from raw acoustic data (hard physics).
   * The phase is derived from narrative inference (soft logic).
   * When they conflict, ZONE WINS. The phase is corrected.
   */
  enforce(
    zone: MultiSpectralZone,
    phase: ValidatedNarrativePhase,
  ): { zone: MultiSpectralZone; phase: ValidatedNarrativePhase; corrected: boolean } {

    // Exception: textural phase can coexist with any zone
    if (phase.phase === 'textural') {
      return { zone, phase, corrected: false };
    }

    // Exception: intro/outro are temporal markers, not energy states
    if (phase.phase === 'intro' || phase.phase === 'outro') {
      return { zone, phase, corrected: false };
    }

    // Hard rule: silence zone → silence phase
    if (zone.label === 'silence' && phase.phase !== 'silence') {
      return {
        zone,
        phase: this.overridePhase(phase, 'silence',
          `COUPLING ENFORCED: zone=silence but phase=${phase.phase}. Overridden to silence.`),
        corrected: true,
      };
    }

    // Hard rule: valley/ambient zone cannot be climax
    if ((zone.label === 'valley' || zone.label === 'ambient') &&
        phase.phase === 'climax') {
      return {
        zone,
        phase: this.overridePhase(phase, 'valley',
          `COUPLING ENFORCED: zone=${zone.label} but phase=climax. Overridden to valley. The music does not support a climax.`),
        corrected: true,
      };
    }

    // Hard rule: peak zone cannot be silence/valley
    if ((zone.label === 'peak' || zone.label === 'intense') &&
        (phase.phase === 'silence' || phase.phase === 'valley')) {
      return {
        zone,
        phase: this.overridePhase(phase, 'building',
          `COUPLING ENFORCED: zone=${zone.label} but phase=${phase.phase}. Overridden to building. High energy detected but narrative phase lagged.`),
        corrected: true,
      };
    }

    return { zone, phase, corrected: false };
  }

  private overridePhase(
    original: ValidatedNarrativePhase,
    newPhase: NarrativePhase,
    reason: string,
  ): ValidatedNarrativePhase {
    return {
      ...original,
      phase: newPhase,
      verdict: 'OVERRIDDEN',
      reason: `${original.reason} → ${reason}`,
      confidence: 0.90, // Coupling enforcement is high confidence
    };
  }
}
```

### 6.3 The Unified State Object

```typescript
/**
 * AcousticRealityState
 *
 * The single source of truth that replaces the fragmented state
 * (energyContext.zone + contextualMemory.narrative + pattern.section).
 *
 * Every downstream consumer (EffectDreamSimulator, DecisionMaker,
 * CognitiveFluidState, TheiaRegistry) reads from THIS object.
 */
export interface AcousticRealityState {
  /** Timestamp (ms) */
  readonly timestamp: number;

  /** Multi-spectral zone (replaces energyContext.zone) */
  readonly zone: MultiSpectralZone;

  /** Validated narrative phase (replaces contextualMemory.narrative.narrativePhase) */
  readonly phase: ValidatedNarrativePhase;

  /** The Worker's original hypothesis (for audit trail) */
  readonly hypothesis: MultiSpectralSectionHypothesis;

  /** Whether the coupling enforcer corrected the state */
  readonly couplingCorrected: boolean;

  /** Z-Scores (for downstream consumers) */
  readonly zScores: {
    low: number;
    mid: number;
    high: number;
    total: number;
  };

  /** Crest factors (for impact calculation) */
  readonly crestFactors: {
    low: number;
    high: number;
  };

  /** Composite metrics */
  readonly spectralTension: number;
  readonly spectralDivergence: number;
}
```

---

## 7. UNIFIED DATA FLOW ARCHITECTURE

```
┌──────────────────────────────────────────────────────────────────────────┐
│ WORKER (TrinityBridge)                                                   │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ MultiSpectralSectionTracker (MSST)                                 │  │
│  │                                                                    │  │
│  │  Input: audio { bass, mid, treble, volume }, rhythm { kick, bpm } │  │
│  │                                                                    │  │
│  │  1. Update TriBandRollingStats (30s window per band)              │  │
│  │  2. Compute Z_low, Z_mid, Z_high, Z_total                         │  │
│  │  3. Compute CF_low, CF_high (crest factors)                       │  │
│  │  4. Compute T(t) = spectral tension, D(t) = divergence            │  │
│  │  5. Score all section types (multi-criteria)                      │  │
│  │  6. Select winner with hysteresis (0.15 stay bonus, 30 frames)    │  │
│  │                                                                    │  │
│  │  Output: MultiSpectralSectionHypothesis                            │  │
│  │    { proposedSection, confidence, evidence, timestamp }            │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                    │                                     │
│  mind.ts:extractMusicalContext()   │  (evidence bundle travels alongside)│
│    └─ MusicalContext.section       │                                     │
│         .type = proposedSection    │                                     │
│         .evidence = evidence       │  ← NEW FIELD                        │
└────────────────────────────────────┼─────────────────────────────────────┘
                                     │ postMessage
┌────────────────────────────────────┼─────────────────────────────────────┐
│ MAIN THREAD                        ▼                                     │
│                                                                          │
│  TickEngine                                                              │
│    └─ context.section = { type, evidence, ... }                          │
│                                                                          │
│  TitanEngine.update()                                                    │
│    └─ TitanStabilizedState now includes evidence bundle                  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ SeleneTitanConscious.think()                                       │  │
│  │                                                                    │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │ STEP 1: MultiSpectralEnergyLadder.classify()                 │  │  │
│  │  │                                                              │  │  │
│  │  │  Input: evidence, smoothedEnergy                             │  │  │
│  │  │  Output: MultiSpectralZone                                   │  │  │
│  │  │    baseZone = classifyByEnergy(E_total)                      │  │  │
│  │  │    elevation = computeTensionElevation(evidence)             │  │  │
│  │  │    finalZone = baseZone + elevation (clamped to peak)        │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  │                                                                    │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │ STEP 2: ThermodynamicVetoEngine.validate()                   │  │  │
│  │  │                                                              │  │  │
│  │  │  Input: hypothesis, zone                                     │  │  │
│  │  │  Output: ValidatedNarrativePhase                             │  │  │
│  │  │                                                              │  │  │
│  │  │  GATE 0: SILENCE OVERRIDE (all Z < -1.5 → silence)          │  │  │
│  │  │  GATE 1: CLIMAX VALIDATION (drop/chorus → check Z_total)     │  │  │
│  │  │  GATE 2: TEXTURAL DROP (verify Z_high + CF_high)             │  │  │
│  │  │  GATE 3: BUILDUP (verify ΔE > 0)                             │  │  │
│  │  │  GATE 4: BREAKDOWN (verify ΔE < 0 + low tension)             │  │  │
│  │  │  GATE 5: VERSE UPGRADE (check hidden tension)                │  │  │
│  │  │  GATE 6: INTRO/OUTRO passthrough                             │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  │                                                                    │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │ STEP 3: StateCouplingEnforcer.enforce()                      │  │  │
│  │  │                                                              │  │  │
│  │  │  Input: zone, phase                                          │  │  │
│  │  │  Output: AcousticRealityState (corrected if needed)          │  │  │
│  │  │                                                              │  │  │
│  │  │  Rule: silence zone → silence phase (HARD)                   │  │  │
│  │  │  Rule: valley zone ≠ climax phase (HARD)                     │  │  │
│  │  │  Rule: peak zone ≠ silence/valley phase (HARD)               │  │  │
│  │  │  Exception: textural phase can coexist with any zone          │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  │                                                                    │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │ STEP 4: Emit AcousticRealityState to all consumers           │  │  │
│  │  │                                                              │  │  │
│  │  │  → EffectDreamSimulator: uses zone.label for filterByZone    │  │  │
│  │  │  → DecisionMaker: uses phase.phase + zScores for DIVINE gate │  │  │
│  │  │  → CognitiveFluidState: uses zScores for impact calculation  │  │  │
│  │  │  → TheiaRegistry: uses zone.ordinal for atom matching        │  │  │
│  │  │  → ContextualMemory: stores evidence in history (audit)      │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

### 7.1 Downstream Consumer Changes

| Consumer | Current Input | New Input | Change |
|----------|---------------|-----------|--------|
| `EffectDreamSimulator.filterByZone()` | `energyContext.zone` (string) | `ars.zone.label` (string) | **Compatible** — same 7 zone labels |
| `EffectDreamSimulator.generateCandidates()` | `context.energyZone` + `context.zScore` | `ars.zone.label` + `ars.zScores.total` | **Compatible** |
| `DecisionMaker.determineDecisionType()` | `energyContext.zone` + `zScore` | `ars.zone.label` + `ars.zScores.total` + `ars.phase.phase` | **Enhanced** — phase now validated |
| `CognitiveFluidState.computeImpact()` | `zScore` (single) + `crestFactor` (single) | `ars.zScores.{low,mid,high}` + `ars.crestFactors` | **Enhanced** — multi-spectral impact |
| `TheiaRegistry.findBestMatch()` | `currentZone` (string) | `ars.zone.ordinal` (number) | **Compatible** — ordinal already used |
| `ContextualMemory.update()` | `sectionType` (string) | `ars.hypothesis.evidence` (object) | **Breaking** — input type changes |
| `ContextualMemory.logContextState()` | Z-Scores + `narrativePhase` | `ars.zScores` + `ars.phase.phase` | **Compatible** — same data, validated source |

---

## 8. MIGRATION STRATEGY — What Dies, What Survives

### 8.1 What Dies (Replaced)

| Module | File | Fate |
|--------|------|------|
| `SimpleSectionTracker` | `TrinityBridge.ts:1005-1241` | **REPLACED** by `MultiSpectralSectionTracker` |
| `EnergyConsciousnessEngine.determineZone()` | `EnergyConsciousnessEngine.ts:412-438` | **REPLACED** by `MultiSpectralEnergyLadder.classify()` |
| `ContextualMemory.inferNarrativePhase()` | `ContextualMemory.ts:400-424` | **REPLACED** by `ThermodynamicVetoEngine.validate()` |
| `ContextualMemory.calculateNarrativeContext()` | `ContextualMemory.ts:378-395` | **REPLACED** by `StateCouplingEnforcer.enforce()` |
| `DROP_HOLD_TIME_MS = 4000` | `TrinityBridge.ts:1140` | **ELIMINATED** — no blind hold timers |
| `MusicalPatternSensor.classifySection()` | `MusicalPatternSensor.ts:202-204` | **DEPRECATED** — section classification moves to MSST |
| `ColorProcessors.normalizeSectionType()` | `ColorProcessors.ts:228-253` | **DEPRECATED** — section type comes from MSST, already normalized |

### 8.2 What Survives (Enhanced)

| Module | File | Enhancement |
|--------|------|-------------|
| `RollingStats` (Welford) | `ContextualMemory.ts` | **PROMOTED** — now runs per-band (3 instances: low, mid, high) |
| `ContextualMemory.detectAnomaly()` | `ContextualMemory.ts:277` | **PRESERVED** — still uses Z-Scores for anomaly detection |
| `ContextualMemory.getEnergyZScore()` | `ContextualMemory.ts:301` | **PRESERVED** — now reads from `ars.zScores.total` |
| `EffectDreamSimulator.filterByZone()` | `EffectDreamSimulator.ts:538-570` | **PRESERVED** — zone labels are backward compatible |
| `EffectDreamSimulator` Oracle Vision | `EffectDreamSimulator.ts:685-703` | **PRESERVED** — projected zone override still valid |
| `DynamicEffectRegistry` effect DNA | `DynamicEffectRegistry.ts` | **PRESERVED** — `energyZone: {min, max}` ranges unchanged |
| `ENERGY_ZONE_ORDINAL` | `theiaTypes.ts` | **PRESERVED** — ordinal mapping unchanged |
| `CognitiveFluidState` | `CognitiveFluidState.ts` | **ENHANCED** — impact formula gets multi-spectral Z-Scores |

### 8.3 New Modules to Create

| Module | Location | Purpose |
|--------|----------|---------|
| `MultiSpectralSectionTracker` | `TrinityBridge.ts` (worker) | Replaces SimpleSectionTracker |
| `TriBandRollingStats` | `TrinityBridge.ts` (worker) | Per-band Welford stats + crest factor |
| `MultiSpectralEnergyLadder` | `intelligence/perception/` (new dir) | Replaces determineZone() |
| `ThermodynamicVetoEngine` | `intelligence/perception/` | Replaces inferNarrativePhase() |
| `StateCouplingEnforcer` | `intelligence/perception/` | Zone × Phase consistency |
| `AcousticRealityState` | `intelligence/perception/types.ts` | Unified state object |

### 8.4 The Impact Formula Upgrade (Stratum 3 Preview)

The current impact formula in `CognitiveFluidState.ts:173-177`:

```
I(t) = w_E · Z_total + w_C · crestFactor + w_R · rawEnergy
```

The new multi-spectral impact formula:

```
I(t) = w_E   · Z_total(t)              // Overall energy anomaly
     + w_low · max(0, Z_low(t))         // Bass dominance contribution
     + w_high· max(0, Z_high(t))        // High-freq anomaly contribution
     + w_CF  · sigmoid(CF_high(t) - 4)  // Crest factor (vocal/scream detection)
     + w_T   · spectralTension(t)       // Textural tension
     + w_D   · spectralDivergence(t)    // Spectral divergence

Default weights: w_E = 0.30, w_low = 0.15, w_high = 0.20, w_CF = 0.15, w_T = 0.12, w_D = 0.08
```

This ensures that a vocal scream (`Z_high = +2.5`, `CF_high = 7`, `T = 1.2`) produces a high impact score even when `Z_total ≈ 0` — something the current formula completely misses.

---

## APPENDIX A: Spectral Tension — Worked Example

### Scenario: Vocal scream at 2:15 in a techno track

**Acoustic reality:**
- Bass drops from 0.70 → 0.15 (the "drop" in the mix)
- High frequencies spike from 0.25 → 0.85 (the scream)
- Mid frequencies spike from 0.30 → 0.70 (vocal body)
- Total energy: 0.40 (moderate — the old system says "AMBIENT")

**Multi-spectral Z-Scores (30s window):**
- `Z_low = -1.8` (bass way below mean)
- `Z_mid = +1.2` (vocals above mean)
- `Z_high = +2.8` (highs extremely above mean)
- `Z_total = -0.2` (total energy slightly below mean)

**Crest factors:**
- `CF_low = 2.1` (bass is smooth, not spiky)
- `CF_high = 7.5` (high-freq signal is very spiky — scream signature)

**Composite metrics:**
- `T = max(0, 2.8) · sigmoid(7.5 - 4) + max(0, 1.8) · 0.5 + max(0, 1.2 - (-1.8)) · 0.3`
- `T = 2.8 · 0.97 + 0.9 + 0.9 = 4.51` → clamped to `T = 1.0+` (extreme tension)
- `D = |(-1.8) - 2.8| + |1.2 - ((-1.8 + 2.8) / 2)| = 4.6 + 0.6 = 5.2` (extreme divergence)

**MSST scoring:**
- `score_drop = 0` (Z_low < +1.0, no kick, bassRatio < 1.3)
- `score_textural_drop = 1.0` (Z_high > +1.5 ✓, CF_high > 5.0 ✓, Z_low < -0.5 ✓, T > 0.8 ✓, D > 2.5 ✓, Z_mid > +1.0 ✓)
- `score_breakdown = 0` (T > 0.3, fails tension gate)
- **Winner: `textural_drop`**

**MSEL classification:**
- `baseZone = ambient` (E_total = 0.40)
- `tensionElevation = +3` (T ≥ 0.9, Z_high > 1.0, D > 1.5)
- **Final zone: `peak`** (ordinal 2 + 3 = 5, but clamped to 6 = peak)

**TVE validation:**
- Gate 0: Z_total = -0.2, not < -1.5 → not silence
- Gate 2: proposed = `textural_drop`, Z_high = +2.8 > +1.0 ✓, T = 1.0+ > 0.6 ✓
- **Verdict: ACCEPTED → phase = `textural`**

**State coupling:**
- Zone = `peak`, Phase = `textural` → textural exception applies → **consistent**

**Result:**
- Zone: **PEAK** (not AMBIENT like the old system)
- Phase: **TEXTURAL** (not CLIMAX — we know it's not a bass drop)
- Effects with `aggression > 0.70` are now eligible (filterByZone sees `peak`)
- Impact score includes `Z_high = +2.8` and `CF_high = 7.5` contributions
- The system **sees the scream**.

---

## APPENDIX B: Silence Hallucination — Worked Example

### Scenario: Music stops at 3:42 (technical pause)

**Acoustic reality:**
- All bands at 0.01-0.03 (near-zero)
- Old `SimpleSectionTracker` is in `'drop'` with 2.1s elapsed (within 4s hold)

**Multi-spectral Z-Scores:**
- `Z_low = -2.5`, `Z_mid = -2.2`, `Z_high = -2.0`, `Z_total = -2.3`

**MSST scoring:**
- `score_drop = 0` (Z_low < +1.0, no kick, bassRatio < 1.3)
- `score_breakdown = 0.8` (energyDelta < -0.08 ✓, Z_total < -0.5 ✓, T < 0.3 ✓, D < 1.5 ✓)
- `score_verse = 0.3` (|Z_total| > 0.8, but energyDelta < -0.03)
- **Winner: `breakdown`**

**MSEL classification:**
- `baseZone = silence` (E_total < 0.15)
- `tensionElevation = 0` (Z_high < 1.0, no high-freq evidence)
- **Final zone: `silence`**

**TVE validation:**
- Gate 0: `Z_total = -2.3 < -1.5` AND `Z_low = -2.5 < -1.0` AND `Z_high = -2.0 < -1.0`
- **SILENCE OVERRIDE triggered → verdict = REJECTED, phase = `silence`**

**State coupling:**
- Zone = `silence`, Phase = `silence` → **consistent**

**Result:**
- Zone: **SILENCE** (not INTENSE like the old system would hold)
- Phase: **SILENCE** (not CLIMAX — the hallucination is killed)
- `filterByZone('silence')` blocks all effects with `aggression > 0.30`
- `EffectDreamSimulator` valley protection: zone=silence + Z<0 → zero candidates
- The system **knows the music stopped**.

---

*End of Blueprint. The Architect will review before implementation begins.*
