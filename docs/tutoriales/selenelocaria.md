# DIAGNOSTIC REPORT — WAVE 7595-XRAY
## Selene Vapor Pressure Saturation on UI Re-enable

**Verdict: ✅ ARCHITECT'S HYPOTHESIS CONFIRMED — all 4 causal links verified in source.**

---

### 1. UI Toggle Storage & Propagation

The toggle lives in `SeleneTitanConscious.config.enabled` (boolean, default `false` — `SeleneTitanConscious.ts:273`). The full call chain from UI click to flag flip:

| Layer | File:Line | Action |
|---|---|---|
| UI | `CommandDeck.tsx:133` / `TransportBar.tsx:386` | `window.lux.setConsciousnessEnabled(newState)` |
| Preload | `preload.ts:820` | `ipcRenderer.invoke('lux:setConsciousness', enabled)` |
| IPC | `IPCHandlers.ts:246-252` | `titanOrchestrator.setConsciousnessEnabled(enabled)` |
| Orchestrator | `TitanOrchestrator.ts:946` | delegates to `vibeLifecycleManager` |
| Lifecycle | `VibeLifecycleManager.ts:139-144` | sets `state.consciousnessEnabled`, calls `engine.setConsciousnessEnabled` |
| Engine | `TitanEngine.ts:1408-1412` | `this.selene.setEnabled(enabled)` + emit event |
| Selene | `SeleneTitanConscious.ts:2074-2079` | **`this.config.enabled = enabled` — that's it.** |

```ts
// SeleneTitanConscious.ts:2073-2079
  /** Habilita/deshabilita */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled
    if (this.config.debug) {
      console.log(`[SeleneTitanConscious] ${enabled ? '✅ Enabled' : '⏸️ Disabled'}`)
    }
  }
```

**No fluid state reset. No `_liquidCore.reset()`. No V(t) zeroing.** The toggle is a pure flag flip.

---

### 2. Vapor Accumulation While "OFF" — ✅ CONFIRMED, BY DESIGN

This is the smoking gun. In `SeleneTitanConscious.process()`, the V3 Liquid Cognition pipeline runs **every frame, BEFORE the `enabled` check** — and this is **explicitly intentional**, per the WAVE 8007 comment:

```ts
// SeleneTitanConscious.ts:608-614
    // 0. 👁️ SENSE + 🌊 V3 LIQUID COGNITION — MUST RUN EVERY FRAME
    // V3 procesa ANTES que el EnergyOverride para que `ignite` pueda bypassarlo.
    // Si V3 dice "fuego ahora", ni siquiera el EnergyOverride puede silenciarlo.
    // 🌊 WAVE 8007: Movido ANTES del `enabled` check — la telemetría V3 debe
    // grabarse incluso cuando la consciencia está deshabilitada (modo reactivo).
```

At `SeleneTitanConscious.ts:642`, `_liquidCore.process()` is called unconditionally → which calls `_fluidState.update()` (`LiquidCognitionCore.ts:263`) → which accumulates V(t):

```ts
// CognitiveFluidState.ts:315-321
    this._timeSinceIgnition += dt
    const noIgnition = this._timeSinceIgnition > 0.1 ? 1 : 0
    const valleyFactor = 1 - eHat
    this._vaporPressure = clamp(
      this._vaporPressure + p.beta_v * dt * noIgnition * valleyFactor,
      0, 0.60,  // Fase 3: V_max cap 0.60
    )
```

The accumulation is gated **only** by `noIgnition` (true whenever `_timeSinceIgnition > 0.1s`) and `valleyFactor = 1 - eHat` (energy-normalized). **There is no `enabled` gate.** V(t) climbs toward the 0.60 cap every frame the music is playing, regardless of UI state.

The `enabled` early-return happens **after** V3 has already processed:

```ts
// SeleneTitanConscious.ts:692-697
    // 0. CHECK: ¿Está habilitada la consciencia?
    if (!this.config.enabled) {
      return this.lastOutput
    }
```

---

### 3. `notifyIgnition()` Bypassed While OFF — ✅ CONFIRMED

`notifyIgnition()` is the **only** mechanism that resets V(t) (via `*= kappa_vreset`):

```ts
// CognitiveFluidState.ts:415-418
  notifyIgnition(intensity: number, now: number): void {
    const p = this.profile
    this._vaporPressure *= p.kappa_vreset   // ← the only V(t) decay path
    this._timeSinceIgnition = 0
```

It is called from exactly two sites in `SeleneTitanConscious.ts`:
- **Line 914** — inside the effect-decision block, gated by `finalOutput.effectDecision` existing.
- **Line 1767** — inside the effect-materialization block.

**Both sites are unreachable when `enabled === false`** because the early return at line 695 short-circuits `process()` before any effect decision logic runs. No effect → no `notifyIgnition` → no V(t) reset → V(t) saturates at 0.60 indefinitely.

Over 3 hours at ~44 Hz, that's ~475,000 frames of uninterrupted accumulation with zero reset events.

---

### 4. State Reset on OFF→ON Transition — ✅ CONFIRMED ABSENT

`SeleneTitanConscious` **does** have a `reset()` method that properly zeros the fluid state:

```ts
// SeleneTitanConscious.ts:2108-2114
    // 🌊 WAVE 7004.5: Reset Liquid Cognition V3
    // §5.3: Legacy cooldown timestamps eradicated — V(t) vapor pressure reset
    // via _liquidCore.reset() is the sole refractory mechanism.
    this._liquidCore.reset()
    this._lastLiquidVerdict = null
    this._liquidRecorder.reset()
    this._v3Ignite = false
```

And `_liquidCore.reset()` (`LiquidCognitionCore.ts:338-342`) calls `_fluidState.reset()`, which zeros V(t) (`CognitiveFluidState.ts:461`).

**But `setEnabled()` does not call `reset()`.** The toggle path (`setEnabled` → `config.enabled = ...`) and the reset path (`reset()` → `_liquidCore.reset()`) are completely disjoint. No caller in the `setConsciousnessEnabled` chain (UI → IPC → Orchestrator → Lifecycle → Engine → Selene) invokes `reset()` on the OFF→ON edge.

---

### 5. Mechanism: Why Saturated V(t) → Rapid-Fire

The squelch formula in `IgnitionChamber.ts:105`:

```ts
const squelch = p.Q_base * (1 + p.kappa_T * tHatClamped) * (1 - p.kappa_V * input.vaporPressure) * (1 + kappa_E * (1 - epicnessClamped))
```

With profile constants (`ILiquidCognitionProfile.ts:213-215`): `Q_base = 0.650`, `kappa_V = 0.40`, `kappa_T = 0.50`.

The `(1 − κ_V · V)` term is a **multiplicative depression** on the ignition threshold. This is the "thirst" mechanic: long drought → high V → lower Q → easier to fire.

With V saturated at 0.60:
- `(1 − 0.40 · 0.60) = 0.76`
- Baseline (T̂≈0, epicness≈1): `Q ≈ 0.650 · 1 · 0.76 · 1 = 0.494`
- The logged `Q=0.590` is consistent with moderate T̂/epicness values during re-enable.

So upon re-enable, Q is crushed ~10-24% below its resting `Q_base = 0.650`, while C(t) (confidence) is unchanged. The predicate `C ≥ Q` (`IgnitionChamber.ts:108`) fires on frames that would normally be HOLDs → **rapid-fire** until `notifyIgnition` cycles finally bleed V(t) back down via `kappa_vreset`.

Additionally, the intensity formula (`IgnitionChamber.ts:121`) adds `κ_vb · V` directly to materialized intensity, so the first salvos after re-enable are also artificially hot.

---

### Summary of Causal Chain

```
UI OFF (3h)
  → config.enabled = false  [SeleneTitanConscious.ts:2075]
  → V3 still runs every frame  [SeleneTitanConscious.ts:611-612, WAVE 8007]
  → _fluidState.update() accumulates V(t)  [CognitiveFluidState.ts:318]
  → early return at :695 → no effect decision → notifyIgnition() never called
  → V(t) saturates at 0.60 cap  [CognitiveFluidState.ts:320]

UI ON
  → config.enabled = true  [SeleneTitanConscious.ts:2075]
  → NO reset() call  [setEnabled at :2074 has no reset]
  → V(t) = 0.60 persists into first frames
  → Q(t) = Q_base · (1 − 0.40·0.60) · ... ≈ 0.49-0.59  [IgnitionChamber.ts:105]
  → C ≥ Q fires on borderline frames → rapid-fire
  → intensity boosted by κ_vb·V  [IgnitionChamber.ts:121]
```

**Root cause: `setEnabled()` at `SeleneTitanConscious.ts:2074-2079` does not invoke `reset()` (or at minimum `_liquidCore.reset()`) on the OFF→ON transition.** The WAVE 8007 decision to run V3 telemetry before the `enabled` check is correct for diagnostics, but it leaves V(t) accumulating with no reset path while disabled — exactly the saturation the Architect predicted.

**Recommended fix locus (not implemented per directive):** `setEnabled(true)` should call `this._liquidCore.reset()` (or the full `this.reset()`) to zero Ψ(t) before the first enabled frame. A minimal patch would add the reset inside the `if (enabled)` branch of `setEnabled()`.