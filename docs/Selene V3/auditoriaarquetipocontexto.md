Selene V3 Archetype Interaction Forensic Report
Executive Summary
Three distinct root causes explain the observed behavior:

corazon_latino never appears: Its aggression (0.38) falls in a dead zone of the filterByZone aggression ladder — too low for active/intense/peak zones, too high for silence. Since fiesta-latina music lives in active–peak zones, it's permanently excluded from the candidate pool.
latina_meltdown is always blocked: It's classified as isDivineCandidate: true, triggering a hard ε=0.6 epicness gate in both DecisionMaker and SeleneTitanConscious. The observed epicness values (0.13–0.25) never approach 0.6, so it's perpetually vetoed despite winning DREAM_RANKING.
latin_strobe over-fires: With global cooldown at 0, the v3BypassEpicnessFloor (0.150 HARD) is irrelevant — it only gates the bypass path, not the default availability path. The default path's only gate is isAmbientDNA && v3Epic < 0.10. Since epicness is usually >0.10, latin_strobe passes freely. The candidate pool collapse to 2 effects (caused by filterByZone excluding mid-aggression effects) ensures it always ranks high.
1. corazon_latino — Permanent Exclusion via Aggression Dead Zone
DNA Profile
From @/electron-app/src/core/arsenal/builtins/latin/corazon_latino.lfx:26-54:



json
"aggression": 0.38,
"textureAffinity": "clean",
"pressureRange": { "min": 0, "max": 1 },
"energyZone": { "min": "ambient", "max": "active" }
The Aggression Ladder
@/electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts:579-587:



typescript
'silence': { min: 0, max: 0.30 },
'valley':  { min: 0, max: 0.50 },
'ambient': { min: 0, max: 0.70 },
'gentle':  { min: 0, max: 0.85 },
'active':  { min: 0.40, max: 0.80 },
'intense': { min: 0.60, max: 1.00 },
'peak':    { min: 0.70, max: 1.00 },
corazon_latino (A=0.38) passes ONLY in: valley, ambient, gentle. It is filtered out in:

silence (0.38 > 0.30 max)
active (0.38 < 0.40 min)
intense (0.38 < 0.60 min)
peak (0.38 < 0.70 min)
Log Evidence
The log shows the system consistently in high-energy zones. Every DREAM_RANKING with 2 total candidates shows only latin_strobe and Feral Wave Omega — both high-aggression effects. Even when the pool expands to 8-9 candidates (during buildup_starting predictions with projected zone intense), corazon_latino doesn't appear because 0.38 < 0.60 (intense min).

The filterByZone fallback (returning 3 least-aggressive effects) only triggers when all effects are filtered out. Since latin_strobe and Feral Wave Omega always survive the zone filter, the fallback never activates, and corazon_latino remains permanently invisible.

Additional Filter: Building Phase Aggression Gate
@/electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts:843-846:



typescript
if (narrativePhase === 'building' && entry.dna.aggression > 0.4) {
  continue
}
This filter rejects effects with aggression > 0.4 during building phase. corazon_latino (0.38) would survive this filter, but it never gets the chance because filterByZone already excluded it.

Root Cause
corazon_latino's aggression (0.38) is in a structural gap — below the active zone floor (0.40) and above the silence ceiling (0.30). The energyZone field in its DNA (min: ambient, max: active) is decorative — it's never used in runtime gating. The runtime uses the aggressionLimits ladder which doesn't account for this gap.

2. latina_meltdown — Divine Epicness Hard Veto
DNA Profile
From @/electron-app/src/core/arsenal/builtins/latin/latina_meltdown.lfx:121-167:



json
"aggression": 0.95,
"isDivineCandidate": true,
"isStrobe": true,
"pressureRange": { "min": 0.5, "max": 1.0 },
"zScoreGuards": { "minimumZ": 2.2, "minimumEnergy": 0.7 }
Veto Point 1: DecisionMaker Divine Leak Block
@/electron-app/src/core/intelligence/think/DecisionMaker.ts:286-311:



typescript
const V3_EPSILON_DIVINE = isTechnoVibe ? 0.50 : 0.60
const divineLeakBlocked = isDivineEffect && v3Epicness <= V3_EPSILON_DIVINE
if (divineLeakBlocked) {
  throttledLog(`divineLeak:${proposedEffect}`,
    `[DecisionMaker 🛡️] DIVINE LEAK BLOCKED: "${proposedEffect}" is divine ` +
    `but V3 epicness=${v3Epicness.toFixed(3)} ≤ ε=${V3_EPSILON_DIVINE} → falling through`, 5000)
}
For fiesta-latina (not techno), ε=0.60. The log shows epicness values of 0.133, 0.138, 0.140 — all far below 0.60.

Veto Point 2: Sovereign Clock Divine Abort
@/electron-app/src/core/intelligence/SeleneTitanConscious.ts:676-689:



typescript
if (!aborted && registryEntry?.simMeta.isDivineCandidate) {
  const energyTooLow = titanState.rawEnergy < 0.50
  const divineZoneVeto = ars ? (ars.zone.label === 'silence' || ars.zone.label === 'valley')
    && ars.phase.phase !== 'textural' : false
  if (v3EpicnessNow <= V3_EPSILON_DIVINE || energyTooLow || divineZoneVeto) {
    aborted = true
    abortReason = `DIVINE ABORT: V3 epicness=${v3EpicnessNow.toFixed(3)} ≤ ε=${V3_EPSILON_DIVINE}...`
  }
}
Log Evidence
Line 35: DIVINE LEAK BLOCKED: "latina_meltdown" is divine but V3 epicness=0.133 ≤ ε=0.6 → falling through
Line 754: CASSANDRA PRE-BUFFER: "Latina Meltdown" stored for buildup_starting in ~3.0s (65% confidence) — the Dream Simulator correctly identifies it as the best candidate
Line 772: PRE-BUFFER ABORTED: "Latina Meltdown" — DIVINE ABORT: V3 epicness=0.138 ≤ ε=0.6 → buffer cleared, divine effect suppressed
Line 901-904: Cassandra FAST PATH uses the pre-buffered latina_meltdown, Integrator approves, but DecisionMaker blocks it again: DIVINE LEAK BLOCKED: "latina_meltdown" is divine but V3 epicness=0.140 ≤ ε=0.6
Root Cause
The divine epicness threshold (ε=0.6) is structurally unreachable for fiesta-latina music. The epicness formula (from FLUID-DIAG) produces values in the 0.07–0.33 range during this session. The threshold of 0.6 was designed for techno/industrial/hardstyle with high spectral divergence. Fiesta-latina's rhythmic density and spectral profile produce lower epicness values, making the divine arsenal permanently inaccessible.

Additionally, latina_meltdown has zScoreGuards.minimumZ: 2.2 and minimumEnergy: 0.7. Even if the divine veto were removed, these guards would block it unless Z-Score > 2.2σ AND energy > 0.7 simultaneously.

3. latin_strobe — Over-Firing via Floor Bypass
The Gatekeeper Floor Illusion
@/electron-app/src/core/intelligence/SeleneTitanConscious.ts:1718-1733:



typescript
const isHardForBypass = candidateEntry?.simMeta.isHeavyCandidate
  || candidateEntry?.simMeta.isDivineCandidate
  || (candidateEntry?.dna.aggression ?? 0) > 0.7
const v3BypassEpicnessFloor = isHardForBypass
  ? Math.max(0.15, this.energyConsciousness.getRmsAverage10s() * 0.20)
  : Math.max(0.05, this.energyConsciousness.getRmsAverage10s() * 0.10)
 
const v3IgniteBypass = this._v3Ignite
  && isDNADecision
  && ethicsScore >= ethicsThreshold
  && !isHardMinimumBlocked
  && !oceanicProtection
  && v3BypassTemporalReady
  && !alreadyValidatedByArsenal
  && v3Epic >= v3BypassEpicnessFloor
The v3BypassEpicnessFloor (0.150 HARD) only gates the v3IgniteBypass path. It does NOT gate the default availability path.

The Default Availability Path
@/electron-app/src/core/intelligence/SeleneTitanConscious.ts:1788-1804:



typescript
const availability = isHardMinimumBlocked
  ? hardMinimumCheck
  : isDropChainBlocked ? ...
  : refractoryBlocked ? ...
  : alreadyValidatedByArsenal ? ...
  : hasHighEthicsOverride ? ...
  : v3IgniteBypass ? ...
  : isAmbientDNA && v3Epic < 0.10
  ? { available: false, reason: `Epicness too low for ambient DNA (${v3Epic.toFixed(3)} < 0.10)` }
  : isAmbientDNA && isDropImminent
  ? { available: false, reason: 'Drop reservation' }
  : hardMinimumCheck  // ← DEFAULT: falls through to cooldown check
With global cooldown = 0, hardMinimumCheck.available is almost always true. The only epicness gate on the default path is isAmbientDNA && v3Epic < 0.10.

Log Evidence
Line 239: floor=0.150 (HARD) but v3Bypass=false. epicness=0.140 > 0.10 → passes default path → FIRES (line 243)
Line 546-547: floor=0.150 (HARD), epicness=0.081 < 0.10 → BLOCKED by ambient DNA floor
Line 577: V3 IGNITE BYPASS: latin_strobe | cooldown bypassed — when bypass IS used, it's for cooldown bypass, not epicness gating
The Candidate Pool Collapse
When prediction is none or energy_drop (the majority of frames), the pool collapses to 2 candidates:

Prediction	Conf	Total Candidates	Why
buildup_starting	>0.55	8-9	projectedZone='intense', relaxGuards=true → wide pool
buildup_starting	≤0.55	2	No projection, current zone filter applies
none	0.30	2	No projection, current zone filter applies
energy_drop	0.50	2	No projection, current zone filter applies
With only 2 candidates (latin_strobe and Feral Wave Omega), latin_strobe alternates between rank 1 and 2. Its diversity factor drops to 0.15x (line 581), but the diversity multiplicative penalty (score *= diversityScore) is applied to a score that's already competing against only 1 other candidate. Even 0.15 × 0.297 = 0.045 beats 0.15 × 0.076 = 0.011.

Root Cause
With global cooldown disabled, the v3BypassEpicnessFloor is structurally bypassed. The 0.150 HARD floor only gates the bypass path, but the default path (cooldown check) has no epicness floor except the 0.10 ambient DNA floor. The candidate pool collapse ensures latin_strobe always has minimal competition.

4. The narrativePhase Default Problem
@/electron-app/src/core/intelligence/SeleneTitanConscious.ts:1469:



typescript
narrativePhase: this.lastMemoryOutput?.narrative?.narrativePhase ?? 'building',
The default is 'building', which activates the aggression > 0.4 filter. However, the log shows Phase: CLIMAX in many frames, meaning the actual narrative phase IS being computed. The building filter is only active when the phase is genuinely building.

When phase IS building AND prediction is buildup_starting with conf > 0.55:

projectedZone = 'intense' (min aggression 0.60)
Building filter rejects aggression > 0.4
Combined effect: only effects with aggression 0.60-1.00 that somehow pass the building filter... which is impossible since 0.60 > 0.4
This is a logical contradiction: the building filter rejects aggression > 0.4, but the projected zone 'intense' requires aggression ≥ 0.60. No effect can satisfy both conditions simultaneously. The 8-9 candidate frames must be cases where narrativePhase is NOT 'building' (e.g., 'climax').

5. Archetype's Role in the Problem
The archetype's primary influence is through aggression clamps in ARCHETYPE_BIAS_MAP: @/electron-app/src/core/arsenal/LfxClipInstance.ts:119-139:



typescript
divine:  { aggressionMin: 0.9, ... }
strobe:  { aggressionMin: 0.75, ... }
heavy:   { aggressionMin: 0.7, ... }
ambient: { aggressionMax: 0.30, ... }
These clamps are applied at DNA baking time (bakeCognitiveDNA), not at runtime. Once the DNA is frozen, the archetype's job is done. The runtime gating uses the baked aggression value, not the archetype label.

However, the archetype also influences:

textureAffinity auto-derivation (strobe/heavy→dirty, ambient/divine→clean) — soft bonus/penalty in scoring
pressureRange computation (hard archetypes → 0.5-1.0, ambient → 0.0-0.5) — hard veto in filterByPressure and SeleneTitanConscious
isDivineCandidate/isHeavyCandidate flags in simulationMeta — trigger divine/heavy veto logic
The archetype is NOT the direct cause of the over-firing. The root causes are structural gaps in the filtering pipeline (aggression ladder dead zone, unreachable divine threshold, bypass floor not applying to default path).

6. Potential Interventions (Analysis Only — No Changes)
corazon_latino: Either raise its aggression to ≥0.40 (to enter the active zone bracket) or add a mid-zone filter in filterByZone that includes effects in the 0.30-0.40 range for active zones. Alternatively, use the energyZone DNA field (currently decorative) as a secondary filter to allow effects to declare which zones they're valid for, independent of aggression.
latina_meltdown: The ε=0.6 divine threshold is too high for fiesta-latina. A vibe-adjusted threshold (similar to the techno adjustment to 0.50) could be extended to latin vibes. Alternatively, the divine veto could use a combination of energy + epicness rather than epicness alone.
latin_strobe: The v3BypassEpicnessFloor should also apply to the default availability path, not just the bypass path. Without this, the 0.150 HARD floor is decorative when global cooldown is 0.
Candidate pool collapse: The filterByZone fallback (3 least-aggressive effects) should trigger when the pool is below a minimum diversity threshold (e.g., < 4), not just when it's completely empty. This would prevent the 2-candidate monoculture.