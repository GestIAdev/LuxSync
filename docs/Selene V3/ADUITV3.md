Selene V3 Epicness — Full Pipeline Audit
1. Origin: CognitiveFluidState.update()
Epicness is computed at @/electron-app/src/core/intelligence/liquid/CognitiveFluidState.ts:268-304.

Formula


epicness = clamp01(baseEpicness × energyFactor × phaseModifier)
Where:

energyFactor = clamp01((rawEnergy − 0.30) / 0.40)
E < 0.30 → factor = 0 (valleys crushed)
E = 0.50 → factor = 0.5
E ≥ 0.70 → factor = 1.0 (full epicness unlocked)
baseEpicness = clamp01((impact − halfTension) / halfTension) where halfTension = tension × 0.5
impact ≤ tension/2 → baseEpicness = 0
impact = tension → baseEpicness = 1.0
The original formula (I−T)/T was abandoned because max practical impact (~0.42) never exceeded equilibrium tension (~0.70).
phaseModifier — from ContextualMemory.narrativePhase:
Phase	Modifier
climax	1.0
textural	0.8
release	0.7
building	0.5
intro / outro	0.3
valley	0.2
silence	0.0
unknown	0.5
Hard Gates
isWarmedUp = false → epicness = 0 (cold-start / post-silence protection)
All three factors are clamp01'd independently, then multiplied and clamped again.
Upstream Inputs
Impact I(t) (CognitiveFluidState.ts:176-207):

With M-SARFE (acousticReality available): I = w_E·tanh(Z_total/z_ref) + w_low·max(0,tanh(Z_low/z_ref)) + w_high·max(0,tanh(Z_high/z_ref)) + w_CF·σ(CF_high−4) + w_T·T + w_D·D
Legacy fallback: I = w_z·tanh(ẑ/z_ref) + w_cf·CF̂ + w_e·Ê
Tension T(t) (CognitiveFluidState.ts:220-245):

Three competing forces: saturation hardening (alpha_rise), drought evaporation (lambdaEvap), homeostatic relaxation (lambda_home)
Clamped to [T_min=0.30, T_max=0.85], base equilibrium T_base=0.600
2. Flow Through the Pipeline


CognitiveFluidState._epicness
  → getSnapshot().epicness (FluidStateSnapshot)
    → LiquidCognitionCore.process() reads snapshot
      → IgnitionChamber.evaluate({ v3Epicness: snapshot.epicness })
      → LiquidVerdict.epicness (in output)
        → SeleneTitanConscious._lastLiquidVerdict.epicness
          → Divine Abort check
          → Telemetry log
@/electron-app/src/core/intelligence/liquid/LiquidCognitionCore.ts:780-799 — The process() method calls this._fluidState.getSnapshot() and passes snapshot.epicness as v3Epicness to IgnitionChamber.evaluate().

3. Consumption #1: IgnitionChamber Squelch Modulation
@/electron-app/src/core/intelligence/liquid/IgnitionChamber.ts:96-103



Q_eff = Q_base × (1 + κ_T × T̂) × (1 − κ_V × V) × (1 + κ_E × (1 − epicness))
Where κ_E = 0.45 (hardcoded), Q_base = 0.650, κ_T = 0.50, κ_V = 0.40.

Scenario	Epicness	Squelch Multiplier	Effect
Climax	1.0	×1.00	No penalty — full sensitivity
Building	0.5	×1.225	22.5% harder to ignite
Valley	0.0	×1.45	45% harder to ignite — blocks ambient spam
Ignition predicate: ignite ⟺ C(t) ≥ Q_eff

This is the only boolean in the cognition system. Epicness directly controls whether effects fire by raising/lowering the bar.

4. Consumption #2: Divine Abort (Sovereign Clock)
@/electron-app/src/core/intelligence/SeleneTitanConscious.ts:662-676

When Cassandra's Sovereign Clock or Glass Break triggers a pre-buffered divine effect:



typescript
const V3_EPSILON_DIVINE = 0.60
if (v3EpicnessNow <= V3_EPSILON_DIVINE || energyTooLow || divineZoneVeto) {
  aborted = true  // divine effect suppressed
}
This means divine effects require epicness > 0.60 to materialize. Below that, the pre-buffer is cleared and the effect is silently aborted.

5. Consumption #3: Universal Reality Clamp (Sovereign Clock)
@/electron-app/src/core/intelligence/SeleneTitanConscious.ts:622-658

For all pre-buffered effects (not just divine), if the effect is classified as heavy:

ARS path: Abort if zone is silence or valley (and not textural phase)
Fallback path: Abort if rawEnergy < 0.35 or zScore < -0.5
Epicness is not directly referenced here, but the same upstream signals (energy, zone, phase) that produce epicness drive this clamp.

6. Key Observations
Epicness is a triple-gated quantity: energy × phase × impact-to-tension ratio. All three must be non-zero for any epicness at all. A high-impact moment during a valley phase with moderate energy produces near-zero epicness.
The half-tension fix is critical: Without it, epicness would always be 0 because impact (~0.42 max) never exceeds tension (~0.70 equilibrium). The fix halves the reference, making impact = tension produce full epicness.
Epicness feeds back into the ignition gate asymmetrically: It only raises the squelch (harder to fire), never lowers it. There's no "epicness bonus" that makes firing easier — only a penalty for non-epic moments.
The isWarmedUp gate is the outermost defense: ContextualMemory.isWarmedUp must be true. This requires ~30s of audio history (bufferSize: 1800 at 60fps). During cold start, epicness is hard-zeroed regardless of energy.
Phase modifier makes epicness context-aware: A drop during building phase (modifier 0.5) produces half the epicness of the same drop during climax (modifier 1.0). This prevents premature effect firing during buildups.
Divine effects have the strictest epicness gate: > 0.60 required. Given the triple-gate formula, this effectively requires: rawEnergy ≥ 0.54 (energyFactor ≥ 0.6) AND a climax/release/textural phase AND impact near or exceeding tension.