Plan of Attack — Selene V3 Fluid Logic Fixes
FIX 1: DREAM_RANKING — Diversity penalty masked by additive weighting
Root cause: Two diversity systems exist, but the DreamSimulator bypasses the one that matters:

EffectDNA.calculateRelevance() (@EffectDNA.ts:388) applies diversityFactor multiplicatively: selectionBiased * diversityFactor. Ladder: [1.0, 0.70, 0.35, 0.15].
But EffectDreamSimulator.calculateDNARelevance() (@EffectDreamSimulator.ts:1210) computes relevance = 1.0 - (distance / MAX_DISTANCE) — pure DNA distance, no diversity factor. This is what populates scenario.projectedRelevance.
In calculateScenarioScore() (@EffectDreamSimulator.ts:1475-1476):
score += projectedRelevance * 0.35 → DNA without diversity
score += diversityScore * 0.20 → separate additive component (ladder [1.0, 0.7, 0.4, 0.1])
A high-DNA candidate used 3× gets: 0.90×0.35 + 0.1×0.20 = 0.335. Other boosts (vibe +0.15, risk +0.13, exploration +0.12, urgency +0.18, impact +0.40) can easily push it to 1.0, completely masking the 0.1 diversity score.
Fix: Apply diversity multiplicatively on the final score, not just as an additive component:

After all additive scoring is done (line ~1611), apply: score *= scenario.diversityScore as a final multiplier before the Math.max(0, Math.min(1, score)) clamp.
This ensures a shadowbanned effect (diversityScore=0.1) can never score above 0.1×max_possible, regardless of DNA/vibe/urgency boosts.
Keep the existing + diversityScore * 0.20 additive term as a small tiebreaker among fresh effects.
Remove the redundant adjustedRelevance perfect-match check (line 1492) since diversity is now enforced globally.
FIX 2: V3 IGNITE BYPASS — Resource masking for effect overlap
Root cause: The V3 bypass (@SeleneTitanConscious.ts:1703-1710) checks cooldown, ethics, epicness, and hard minimum — but never checks if active effects are controlling the same physical resources. The EffectManager's checkTraffic() handles duplicates/zone-mutex/dictator-lock, but V3 bypass fires through the normal trigger() path which does call checkTraffic(). However, two effects from different zones can still control the same physical parameters (e.g., an ambient effect controlling pan/tilt + an intense effect also controlling pan/tilt = jitter).

Fix: Add a resource conflict check before the V3 bypass fires:

Query EffectManager.getActiveEffectTypes() to get currently running effects.
For each active effect, determine which physical resources it controls (dimmer, color, strobe, movement/pan/tilt, white, amber) — this can be derived from the effect's EffectFrameOutput fields or a static resource map per effect type.
If the candidate effect shares resource control with any active effect, abort the bypass (or alternatively, call EffectManager.abort() on the conflicting effect first to enforce a clean handoff).
Log the conflict for debugging.
The resource map can be built from the effect's category and known output patterns (e.g., strobe effects → {strobe, dimmer, white}, mover effects → {movement, dimmer, color}, ambient effects → {dimmer, color}).

FIX 3: FLASHBANG — RMS3s smoothing (low-pass filter)
Root cause: _rmsAverage3s uses EMA with α for 3s half-life (@EnergyConsciousnessEngine.ts:98). In techno minimal, energy oscillates valley↔intense rapidly. The 3s EMA responds too fast to these oscillations, and even with the 500ms cooldown, false positives still occur when the EMA briefly crosses 0.25 during a valley→intense bounce.

Fix: Add a secondary slower EMA (10s half-life) specifically for the flashbang gate:

New constant: ALPHA_RMS_10S = 1 - Math.pow(2, -1 / (10.0 * 44.0))
New field: _rmsAverage10s: number = 0
Update in process(): this._rmsAverage10s += ALPHA_RMS_10S * (rawEnergy - this._rmsAverage10s)
In detectFlashbang(), gate on this._rmsAverage10s instead of this._rmsAverage3s. The 10s average smooths out techno minimal oscillations while still rising during genuine silence→drop transitions (which sustain high energy for >10s).
FIX 4: Dynamic epicness floors (Sovereign + V3 Bypass)
Root cause: Hardcoded floors (0.02 absolute, 0.05 combined for Sovereign; 0.05 for V3 bypass) are too low for techno minimal where epicness hovers near 0 but energy is sustained at 0.40-0.60. The floors need to be relative to recent energy.

Fix: Replace hardcoded floors with dynamic floors based on recent RMS energy:

Use _rmsAverage10s (from FIX 3) as the baseline energy reference.
Sovereign absolute floor: dynamicFloor = max(0.02, rmsAverage10s * 0.08) — scales with energy. In techno (RMS~0.45), floor becomes 0.036. In silence (RMS0.05), floor stays at 0.02.
Sovereign combined floor: dynamicCombinedFloor = max(0.05, rmsAverage10s * 0.12) — in techno (RMS~0.45), floor becomes ~0.054. This blocks effects when epicness is proportionally tiny vs energy.
V3 bypass floor: dynamicV3Floor = max(0.05, rmsAverage10s * 0.10) — similar scaling.
The EnergyConsciousnessEngine needs to expose _rmsAverage10s via a getter (e.g., getRmsAverage10s()) so SeleneTitanConscious can read it.
Implementation order:
FIX 3 (RMS3s → RMS10s) — simplest, no cross-file dependencies
FIX 4 (dynamic floors) — depends on FIX 3's _rmsAverage10s
FIX 1 (diversity multiplier) — single file, isolated
FIX 2 (resource masking) — most complex, needs resource map + EffectManager query
tsc --noEmit verification
Shall I proceed with implementation?