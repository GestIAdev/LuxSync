CONFIDENCE DICTATOR & LEGACY GHOSTS — Technical Diagnosis
EXECUTIVE SUMMARY
The anyma2misterio.md log proves the shield accepted the octave-down (85→63 BPM) after 60 frames because conf=0.86 > 0.7. The confidence is genuinely high for the half-time peak — the Oracle is not malfunctioning, it's correctly detecting a strong periodicity at 2τ during the breakdown. The problem is that the TickEngine's hysteresis gate treats all >8% jumps symmetrically: a 25% gradual drift and a clean ÷2 octave jump face the same 60-frame / conf>0.7 barrier. That barrier is insufficient for octave-down, which is the single most common DSP failure mode in electronic music.

Three findings, ranked by severity:

FINDING #1 — CRITICAL: rawBpm is a lie (Legacy Ghost)
[RhythmTracker.ts:365-383](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/senses/tracking/RhythmTracker.ts:364:0-382:999)



typescript
let musicalBpm = 0;
if (confidence > 0.05) {
  musicalBpm = smoothedBpm;        // ← Kalman-smoothed
  this.lastMusicalBpm = musicalBpm;
}
return {
  musicalBpm,                      // = smoothedBpm
  rawBpm: smoothedBpm,             // ← ALSO smoothedBpm. NOT raw Oracle.
  ...
};
rawBpm === musicalBpm === smoothedBpm always. The field was named "raw" when the pocket folder existed (raw = pre-fold, musical = post-fold). After "KILL THE POCKETS", both are the same Kalman-smoothed value. The actual raw Oracle BPM (this.tempoOracle.bpm at line 342) is consumed by kalmanUpdate() and never exposed.

Impact on debugging: The logger's (raw=63.66) is NOT the Oracle's raw output — it's the Kalman filter's output. The Kalman may be smoothing a hard octave jump into a gradual drift, making it look like a slow tempo change when the Oracle actually snapped hard. We are flying blind on the actual detector output.

Chain confirmation:

BPMService.ts:110 → bpm: track.musicalBpm, rawBpm: track.rawBpm (both = smoothedBpm)
SensesPipeline.ts:179,185,189 → bpmResult.bpm = rawBpm, musicalBpm = bpm, rawBpm = rawBpm (all = smoothedBpm)
AnalysisResponseBuilder.ts:183,191 → bpm: musicalBpm, rawBpm (both = smoothedBpm)
TrinityBrain.ts:259 → rawBpm: analysis.rawBpm (= smoothedBpm)
TickEngine.ts:573 → workerRawBpm = lastAudioData.workerRawBpm (= smoothedBpm)
Fix: Expose the true Oracle BPM as a new field oracleRawBpm through the chain, so the logger can show BPM=63.64 (oracle=63.10) (kalman=63.64) and we can see if the Kalman is masking a hard jump.

FINDING #2 — HIGH: Confidence calibration allows half-time to pass >0.7
[TempoOracle.ts:204-216](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/senses/bpm/TempoOracle.ts:203:0-215:999)



typescript
const CONF_FLOOR = 0.10;
const CONF_CEIL = 0.70;
[TempoOracle.ts:624-638](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/senses/bpm/TempoOracle.ts:623:0-637:999)

The confidence formula:



peak        = (NSDF_height - 0.10) / (0.70 - 0.10)   // clamped [0,1]
harmonicity = ladder_score / LADDER_SUM               // clamped [0,1]
fill        = ring_fill / WARMUP_FILL                  // clamped [0,1]
confidence  = peak × harmonicity × fill
The math of the Anyma breakdown: During a Melodic Techno breakdown, the kick drops out but the synth arpeggio continues at half-time. The NSDF at 2τ is genuinely strong — the signal IS periodic at 2τ. Measured from the log: conf=0.86 sustained for 60+ frames.

Reverse-engineering: if confidence = 0.86 and fill ≈ 1.0 (ring full), then peak × harmonicity ≈ 0.86. If harmonicity ≈ 0.9 (the half-time ladder is coherent — 2τ, 4τ, 6τ, 8τ all score), then peak ≈ 0.95, meaning NSDF_height ≈ 0.10 + 0.95 × 0.60 = 0.67. That's a very strong NSDF peak — the half-time periodicity is real.

The problem is NOT that confidence is miscalibrated. The confidence is honestly reporting "this signal is very periodic at this lag." The problem is that the TickEngine treats conf>0.7 as sufficient authority to accept any BPM change, including octave jumps. Opus's warning was about the PLL over-locking — and that's exactly what's happening: the PLL locks onto the half-time because the half-time IS the strongest periodic signal during the breakdown.

Recalibrating CONF_FLOOR/CONF_CEIL alone won't fix this — raising CONF_FLOOR would suppress honest confidence during quiet sections, breaking detection of real tempo changes. The fix must be asymmetric: octave-down jumps require higher authority than gradual drift.

FINDING #3 — MEDIUM: MPM + Prior shading can lock onto half-time
[TempoOracle.ts:570-614](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/senses/bpm/TempoOracle.ts:569:0-613:999)

The MPM octave rule (pickShortestPeak) picks the shortest local maximum clearing shadedMax × 0.70. This works when both τ and 2τ clear the threshold — shortest wins. But during a breakdown:

The kick (fundamental at τ) degrades → NSDF(τ) drops below threshold
The synth (half-time at 2τ) remains strong → NSDF(2τ) clears threshold alone
pickShortestPeak returns 2τ because it's the only peak clearing the threshold
prevLag updates to 2τ → prior Gaussian now favors 2τ
Next frame: the prior shading makes 2τ even more dominant → feedback loop
The challenger escape hatch checks the unshaded surface, but if 2τ is genuinely the strongest peak, the challenger confirms it in 3 frames
This is a stable failure mode, not a transient one. Once the Oracle locks onto half-time during a breakdown, it stays there because the prior reinforces it. The only escape is the breakdown ending and the kick returning — but by then, the TickEngine has already accepted the new BPM.

FINDING #4 — LOW: MIN_KICK_ENERGY = 0.150 may be too aggressive
[IntervalBPMTracker.ts:188-191](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/workers/IntervalBPMTracker.ts:187:0-190:999)



typescript
const MIN_KICK_ENERGY = 0.150
This gates kick detection in the IntervalBPMTracker, which feeds the needle ODF that the TempoOracle consumes. During Melodic Techno breakdowns, the kick energy drops below 0.150, so kicks are missed, the needle ODF becomes sparse, and the NSDF fundamental at τ degrades. This contributes to Finding #3 but is not the root cause — the synth alone can sustain the half-time peak.

Not recommended to change — lowering MIN_KICK_ENERGY risks false kick detection on noise. The fix should be downstream (asymmetric shield), not upstream (sensitivity).

FINDING #5 — INFO: Bypassed legacy code (not active, no action needed)
applyDembowCeiling() (RhythmTracker.ts:136-148) — bypassed, Math.round(bpm/2) not in hot path
foldToPocket() (RhythmTracker.ts:190-230) — bypassed, not called in hot path
getMusicalBpm() (IntervalBPMTracker.ts:944-1019) — not called by BPMService
Kalman clamp [40, 300] (RhythmTracker.ts:438-439) — very wide, not a problem
These are documented as bypassed ("KILL THE POCKETS") and confirmed not in the signal path. No action needed.

PROPOSED CHANGES — Asymmetric Octave Shield + Confidence Recalibration
Proposal A: Asymmetric Octave Shield (TickEngine.ts)
Principle: Octave-down (÷2) is the #1 DSP failure mode → demand extreme authority. Octave-up (×2) is usually a correction from a previous half-time lock → accept quickly. Non-octave large changes stay at 60 frames / conf>0.7.

[TickEngine.ts:142-156](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/orchestrator/tick/TickEngine.ts:141:0-155:999)



typescript
// ─── NEW: Asymmetric octave confirmation thresholds ───
// Octave-down (÷2) is the most common DSP failure mode (half-time lock).
// Demand 3× the confirmation frames and 0.9 confidence.
private static readonly BPM_CANDIDATE_CONFIRM_FRAMES = 60       // default
private static readonly BPM_CANDIDATE_CONFIRM_FRAMES_OCT_DOWN = 180  // ÷2: 3× stricter
private static readonly BPM_CANDIDATE_CONFIRM_FRAMES_OCT_UP = 20     // ×2: fast accept (likely correction)
private static readonly BPM_CANDIDATE_MIN_CONFIDENCE = 0.7      // default
private static readonly BPM_CANDIDATE_MIN_CONFIDENCE_OCT_DOWN = 0.9  // ÷2: near-certainty required
private static readonly BPM_CANDIDATE_MIN_CONFIDENCE_OCT_UP = 0.6    // ×2: lenient (corrections)
[TickEngine.ts:407-430](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/orchestrator/tick/TickEngine.ts:406:0-429:999)



typescript
if (delta > TickEngine.BPM_HYSTERESIS_PCT) {
  // Large change — require confirmation
  // 🛡️ Detect octave jumps (×2 or ÷2) for asymmetric validation
  const ratio = workerBpm / this._stableBpm
  const isOctaveDown = ratio < 0.55 && ratio > 0.45  // ~÷2
  const isOctaveUp = ratio > 1.85 && ratio < 2.15    // ~×2
 
  // 🛡️ Asymmetric Octave Rule: ÷2 demands 180f @ conf>0.9, ×2 accepts in 20f @ conf>0.6
  const confirmFrames = isOctaveDown ? TickEngine.BPM_CANDIDATE_CONFIRM_FRAMES_OCT_DOWN
                      : isOctaveUp   ? TickEngine.BPM_CANDIDATE_CONFIRM_FRAMES_OCT_UP
                      :                TickEngine.BPM_CANDIDATE_CONFIRM_FRAMES
  const minConfidence = isOctaveDown ? TickEngine.BPM_CANDIDATE_MIN_CONFIDENCE_OCT_DOWN
                      : isOctaveUp   ? TickEngine.BPM_CANDIDATE_MIN_CONFIDENCE_OCT_UP
                      :                TickEngine.BPM_CANDIDATE_MIN_CONFIDENCE
 
  if (Math.abs(workerBpm - this._bpmCandidate) <= TickEngine.BPM_CANDIDATE_TOLERANCE
      && workerConfidence > minConfidence) {
    this._bpmCandidateFrames++
    if (this._bpmCandidateFrames >= confirmFrames) {
      this._stableBpm = workerBpm
      this._bpmCandidate = 0
      this._bpmCandidateFrames = 0
      this._shieldTag = isOctaveDown ? '⚠️OCT-DOWN✅' : (isOctaveUp ? '⚠️OCT-UP✅' : '🛡️ACCEPT')
    } else {
      acceptedBpm = this._stableBpm
      this._shieldTag = isOctaveDown ? '⚠️OCT-DOWN🛡️' : (isOctaveUp ? '⚠️OCT-UP🛡️' : '🛡️HOLD')
    }
  } else {
    this._bpmCandidate = workerBpm
    this._bpmCandidateFrames = 0
    acceptedBpm = this._stableBpm
    this._shieldTag = isOctaveDown ? '⚠️OCT-DOWN🛡️' : (isOctaveUp ? '⚠️OCT-UP🛡️' : '🛡️REJECT')
  }
} else {
  // Small change — accept and update stable
  this._stableBpm = workerBpm
  this._bpmCandidate = 0
  this._bpmCandidateFrames = 0
}
Why this works with FREEWHEEL: The shield only acts when workerBpm > 0 && workerConfidence > 0.5 (line 400). During freewheel (worker deaf), workerBpm = 0 → the entire hysteresis block is skipped → acceptedBpm = workerBpm = 0 → the freewheel branch at line 494 handles it via lastStableWorkerBpm. The asymmetric thresholds are inside the hysteresis block, so they never affect freewheel.

180 frames = ~8.4 seconds at 21.5 Hz. A breakdown that lasts <8.4s won't be enough to force the octave-down. If the breakdown lasts longer (Anyma breakdowns are 16-32s), the shield will eventually accept — but by then, the breakdown is genuinely the dominant signal, and the lights SHOULD follow it. The key is that when the kick returns, the Oracle will jump back to τ, and the ×2 path (octave-up) accepts in 20 frames (~0.9s) — fast recovery.

Proposal B: Expose true Oracle BPM (fix the rawBpm lie)
RhythmTracker.ts — add oracleRawBpm to the output:



typescript
// Line 342 area:
const oracleBpm = this.tempoOracle.bpm;
const confidence = this.tempoOracle.confidence;
const oraclePeakHeight = this.tempoOracle.peakHeight;  // NEW: raw NSDF peak
 
// Line 376 area — add to return:
return {
  musicalBpm,
  confidence,
  // ...existing fields...
  rawBpm: smoothedBpm,           // keep for backward compat (Kalman-smoothed)
  oracleRawBpm: oracleBpm,       // NEW: true pre-Kalman Oracle BPM
  oraclePeakHeight,              // NEW: raw NSDF peak height for confidence audit
  // ...
};
BPMService.ts / SensesPipeline.ts / AnalysisResponseBuilder.ts / TrinityBrain.ts — thread oracleRawBpm through the chain.

TickEngine.ts logger — show all three:



BPM=63.64 (oracle=63.10) (kalman=63.64) conf=0.86 ⚠️OCT-DOWN🛡️
This lets us see if the Oracle is jumping hard (oracle=63.10) while the Kalman is drifting slowly (kalman=63.64), or if both are moving together.

Proposal C: Confidence recalibration (NOT recommended yet)
Do NOT change CONF_FLOOR/CONF_CEIL yet. The confidence is honestly reporting strong half-time periodicity. Suppressing it would break detection of real tempo changes. The asymmetric shield (Proposal A) is the correct fix — it lets the confidence be honest but requires more authority to act on octave jumps.

If after testing Proposal A the shield still accepts octave-down too often, then consider:

CONF_FLOOR = 0.15 (raise floor slightly, suppress weak peaks)
CONF_CEIL = 0.65 (lower ceiling, require stronger peaks for conf=1.0)
But measure first with Proposal B's telemetry.

Recommended execution order
Proposal B first (expose oracleRawBpm) — we need to see the truth before tuning
Proposal A second (asymmetric shield) — the actual fix
Proposal C only if needed — after measuring with B's telemetry
Awaiting your approval to cut.