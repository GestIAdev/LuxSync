Effect Execution Flow: 44Hz → EffectManager.trigger()
1. Entry Point: TickEngine.tick() (44Hz)
@/electron-app/src/core/orchestrator/tick/TickEngine.ts:185

The FrameScheduler calls TickEngine.tick() at ~44Hz. At line 601, it calls:



const intent = await this.engine.update(context, engineAudioMetrics)
where this.engine is the TitanEngine instance.

2. TitanEngine.update() — The Main Frame Loop
@/electron-app/src/engine/TitanEngine.ts:512

TitanEngine.update() processes audio metrics, runs energy/key/mood/strategy stabilizers, builds a TitanStabilizedState, then at line 1095:



const consciousnessOutput = await this.selene.process(titanStabilizedState)
This is the single call site where SeleneTitanConscious.process() is invoked every frame.

3. SeleneTitanConscious.process() — Sense → Think → Dream → Validate
@/electron-app/src/core/intelligence/SeleneTitanConscious.ts:553

3a. Cassandra Sovereign Clock (Fast Path, line 583–754)
Before entering the normal pipeline, it checks if the DreamEngineIntegrator has a pre-buffered effect whose predicted event time has arrived (or a Glass Break: drop came early). If so, it constructs a ConsciousnessOutput with effectDecision directly from the pre-buffered candidate and returns immediately — bypassing HuntEngine, Fuzzy, and EnergyOverride entirely.

3b. Normal Path: think() (line 846)


const rawDecision = await this.think(titanState, pattern)
Inside think() (line 1151+):

HuntEngine runs → produces huntDecision
PredictionEngine runs → produces activePrediction
Dictator check — if a dictator effect is active, skip pipeline
Cooldown/throttle gating — global cooldown, just-fired shield, pipeline throttle
DreamEngineIntegrator.executeFullPipeline(pipelineContext) at line 1423:


dreamIntegrationData = await Promise.race([
  dreamEngineIntegrator.executeFullPipeline(pipelineContext),
  new Promise<any>((_, reject) =>
    setTimeout(() => reject(new Error('Dream timeout')), 15)
  )
])
This returns an IntegrationDecision with approved: boolean, effect: EffectCandidate | null, ethicalVerdict, alternatives, etc.
makeDecision(inputs) at line 1501 — DecisionMaker takes the IntegrationDecision (as dreamIntegration) plus all other inputs and produces a ConsciousnessOutput with an effectDecision.Inside DecisionMaker (@/electron-app/src/core/intelligence/think/DecisionMaker.ts:290):
Priority 0: DNA Brain — if dreamIntegration.approved && dreamIntegration.effect?.effect → returns 'strike' (bypasses confidence gating)
Divine leak check, buildup section check
Falls through to other decision types if DNA not approved
3c. Gatekeeper (line 1526–1847)
Back in think(), the output.effectDecision goes through multiple gates:

Divine Arsenal selection (line 1532) — if divineArsenal present, ArsenalRepository picks an available weapon
Hard Minimum Protection — dictator-enforced minimum effects
Post-Drop Refractory Lock (line 1631) — blocks non-high-severity effects for POST_DROP_REFRACTORY_MS (4s) after a heavy effect
V3 Liquid Cognition gate — isAmbientDNA effects must respect V3 ignite verdict
Drop Reservation — if Cassandra predicts a drop within 3s, ambient effects are suppressed
Availability check (line 1716) — ArsenalRepository.checkAvailability() verifies cooldowns
If all gates pass (line 1716–1717):



if (availability.available && output.effectDecision) {
  finalEffectDecision = output.effectDecision
3d. Event Emission (line 1849)


this.emit('contextualEffectSelected', { effectType, effectName, intensity, ... })
This event is telemetry-only — no listener wires it to EffectManager. The actual firing happens in TitanEngine.

3e. Return
process() returns the ConsciousnessOutput with effectDecision (or null if blocked).

4. TitanEngine.update() — Effect Firing (line 1130–1155)
Back in TitanEngine.update(), at line 1130:



typescript
else if (consciousnessOutput.effectDecision) {
  const { effectType, intensity, reason, confidence } = consciousnessOutput.effectDecision
 
  if (confidence > 0.6) {
    this.effectManager.trigger({
      effectType,
      intensity,
      source: consciousnessOutput.source,
      reason,
      musicalContext: {
        zScore: this.selene.getEnergyZScore(),
        bpm: processedContext.bpm,
        energy: energyOutput.rawEnergy,
        vibeId: vibeProfile.id,
        beatPhase: processedContext.beatPhase,
        inDrop: titanStabilizedState.sectionType === 'drop',
      },
    })
  }
}
This is the single bridge between Selene's cognitive output and the EffectManager.

5. EffectManager.trigger() — The Final Gate
@/electron-app/src/core/effects/EffectManager.ts:382

The trigger() method applies three sequential gates before the effect actually fires:

Registry Lookup (line 384) — DynamicEffectRegistry.getEntry() — rejects unknown effects
Traffic Control (line 391) — checkTraffic() — blocks if a critical effect is still running
The Shield (line 402) — validateWithShield() — validates effect is allowed in current vibe (chronos/manual sources bypass)
The Gatekeeper (line 428) — ArsenalRepository.checkAvailability() — per-effect cooldown check (chronos/manual bypass)
SeleneHephBridge dispatch (line 468) — getSeleneHephBridge().route(decision) — routes to a .lfx blueprint via Hephaestus
If all gates pass, it:

Emits 'effectTriggered' event (line 487) — this is what SeleneTitanConscious listens to (line 492) to register cooldowns
Registers cooldown in ArsenalRepository (line 530)
Feeds metabolic telemetry to the ecology system (line 537)
6. Post-Trigger: Aether Pipeline
After trigger(), back in TitanEngine.update():

Line 1162: this.effectManager.update() — advances all active effect instances
Line 1165: this.effectManager.getCombinedOutput() — produces CombinedEffectOutput (HTP blending)
Then in TickEngine.tick() at line 1168–1178:



typescript
const consciousnessOutput = this.lastConsciousnessOutput ?? null
const effectOutput = getEffectManager().getCombinedOutput()
seleneAetherAdapter.ingest(consciousnessOutput, effectOutput, ctx.deltaMs, this._effectBus)
The SeleneAetherAdapter translates the effect output into L3 Aether intents (dimmer, RGB, strobeRate), which the NodeArbiter merges with L0/L1/L2 layers, and the result is sent to the DMX driver.

Summary Diagram


TickEngine.tick() [44Hz]
  └─ TitanEngine.update(context, audio)
       └─ SeleneTitanConscious.process(titanStabilizedState)
            ├─ [Fast Path] Cassandra Sovereign Clock / Glass Break
            │     └─ return ConsciousnessOutput { effectDecision }
            └─ [Normal Path]
                 └─ think(titanState, pattern)
                      ├─ HuntEngine → huntDecision
                      ├─ PredictionEngine → activePrediction
                      ├─ DreamEngineIntegrator.executeFullPipeline(pipelineContext)
                      │     └─ EffectDreamSimulator.dreamEffects()
                      │          ├─ generateCandidates()
                      │          ├─ simulateScenario() per candidate
                      │          ├─ rankScenarios()
                      │          └─ Cassandra pre-buffer store/defer
                      │     └─ returns IntegrationDecision { approved, effect, ethicalVerdict }
                      ├─ DecisionMaker.makeDecision(inputs with dreamIntegration)
                      │     └─ returns ConsciousnessOutput { effectDecision }
                      └─ Gatekeeper gates (divine arsenal, refractory, V3, availability)
                           └─ emit('contextualEffectSelected') [telemetry only]
                 └─ validate() → finalOutput
       └─ if (consciousnessOutput.effectDecision && confidence > 0.6)
            └─ EffectManager.trigger({ effectType, intensity, source, reason, musicalContext })
                 ├─ Registry lookup
                 ├─ Traffic Control
                 ├─ Shield (vibe validation)
                 ├─ Gatekeeper (cooldown check)
                 ├─ SeleneHephBridge.route() → Hephaestus .lfx dispatch
                 ├─ emit('effectTriggered') → SeleneTitanConscious registers cooldown
                 └─ Metabolic telemetry feed
       └─ EffectManager.update() → getCombinedOutput()
  └─ SeleneAetherAdapter.ingest(consciousnessOutput, effectOutput)
       └─ NodeArbiter.arbitrate() → DMX output