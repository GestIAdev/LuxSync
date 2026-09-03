Understood. Read-only audit, no checkout. Let me start the impact study.

One critical check — does d9d1e507's LiquidStereoPhysics already have `raw_snare_delta`?

One last critical check — does d9d1e507's `LiquidStereoInput` have an index signature that would allow `raw_snare_delta` access without declaring it?

Critical finding — d9d1e507's `LiquidStereoInput` does NOT declare `raw_snare_delta` and has NO index signature. But d9d1e507's `LiquidEngineBase` accesses `input.raw_snare_delta`. Let me verify how this compiled:

I now have the complete picture. Here is the clinical impact study.

---

# IMPACT STUDY: Surgical Reversion to d9d1e507 (DSP Engine)

## 1. Isolated DSP Files (d9d1e507 → HEAD)

| File | Δ Lines | WAVEs | Verdict |
|---|---|---|---|
| `LiquidEngineBase.ts` | +289 | 7749.27, .35, .42, .43, .44 | **REVERT** — snare detection golden state |
| `profiles/ILiquidProfile.ts` | +21 | 7749.7, .27 | **REVERT** — remove envelopeAir/Floor, snareImpulseDecay |
| `profiles/latino.ts` | +25 | 7749.45 | **REVERT** — restore golden snare decay/choke |
| `profiles/techno.ts` | 0 | — | **NO-OP** (unchanged) |
| `LiquidStereoPhysics.ts` | +18 | 7749.7, .27 | **KEEP HEAD** — critical (see §2) |
| `ChillAmbientEngine.ts` | +36 | 7749.37, .38 | **KEEP HEAD** — color morph, not snare |
| `ColorTranslator.ts` | +15 | 7749.40 | **KEEP HEAD** — color wheel, not snare |

## 2. Structural Collisions

### COLLISION A (CRITICAL): `raw_snare_delta` interface mismatch

d9d1e507's `LiquidStereoInput` does **NOT** declare `raw_snare_delta` and has **NO index signature**. But d9d1e507's `LiquidEngineBase` accesses `input.raw_snare_delta ?? 0` directly — a **TS strict-mode error** that was latent in the golden commit (likely compiled via stale `dist-electron-backend` JS).

HEAD's `LiquidStereoPhysics.ts` **adds** `raw_snare_delta?: number` to the interface (WAVE 7749.7).

**Resolution:** KEEP HEAD's `LiquidStereoPhysics.ts`. This actually *fixes* d9d1e507's latent type error. Do NOT revert this file.

### COLLISION B (CRITICAL): TickEngine `raw_snare_delta` passthrough

HEAD's `TickEngine.ts` explicitly passes `raw_snare_delta` into the LiquidEngine input (WAVE 7749.7, line added). d9d1e507's TickEngine did **NOT** pass it — meaning d9d1e507's snare detection received `raw_snare_delta = 0` always, and the `rawOnset` path never fired. The golden state worked via the **HIGH-FLUX BYPASS** (`spectralFlux > 0.20`), not via `raw_snare_delta`.

**Resolution:** KEEP HEAD's `TickEngine.ts`. With HEAD's TickEngine + d9d1e507's LiquidEngineBase, `raw_snare_delta` will actually flow for the first time. Both onset paths (rawDelta + high-flux bypass) will be active. This is strictly better than the original golden state.

### COLLISION C (LOW): `envelopeAir` / `envFloor` removal

d9d1e507's `LiquidEngineBase` uses `_airEMA` (private EMA follower) and raw `floorIntensity` passthrough. HEAD replaced these with `envAir`/`envFloor` (LiquidEnvelope instances) and added `envelopeAir`/`envelopeFloor` to `ILiquidProfile`.

Reverting both `LiquidEngineBase.ts` AND `ILiquidProfile.ts` to d9d1e507 is self-consistent — `_airEMA` returns, `envAir`/`envFloor` disappear. No external file references `envAir`/`envFloor` outside `LiquidEngineBase`.

**Resolution:** Revert both files together. No patch needed.

### COLLISION D (LOW): `snareImpulseDecay` profile field

HEAD added `snareImpulseDecay` to `ILiquidProfile` (WAVE 7749.7) and `latino.ts` uses it. d9d1e507's `LiquidEngineBase` does NOT read `snareImpulseDecay` — it uses a hardcoded impulse decay. Reverting `ILiquidProfile.ts` + `latino.ts` + `LiquidEngineBase.ts` together is consistent.

**Resolution:** Revert all three together. No patch needed.

### COLLISION E (NONE): Aether/NodeArbiter/Hephaestus strobe fixes

HEAD's strobe fixes (WAVE 7749.46-50) live in:
- `selene-aether-adapter.ts` (neutralized physicsModifier strobe)
- `NodeArbiter.ts` (added `strobeRate` to STRICT_PRIORITY_CHANNELS)
- `LiquidAetherAdapter.ts` (removed LiquidEngine strobe injection)
- `HephaestusAetherAdapter.ts` (strobe-dimmer coupling post-pass)

d9d1e507's `LiquidEngineBase` still computes `strobeActive` and `strobeIntensity` in its result. HEAD's `LiquidAetherAdapter` ignores them (WAVE 7749.48 removed the routing). **No crash** — `strobeActive` is just dead data that flows to the adapter and gets dropped.

**Resolution:** No collision. Keep all HEAD Aether files as-is.

### COLLISION F (NONE): GodEarFFT worker IPC

`GodEarFFT.ts` has **ZERO changes** between d9d1e507 and HEAD. The photon block payload (`spectralFlux`, `whiteNoiseScore`) and rhythmic energies (`snare_energy`, `hh_energy`, `raw_snare_delta`) are identical. No IPC mismatch.

### COLLISION G (NONE): ChillAmbientEngine / TitanEngine speed multiplier

HEAD's `ChillAmbientEngine` has `setSpeedMultiplier()` called by `TitanEngine` (WAVE 7749.38). Both are KEEP HEAD. No collision.

## 3. Reversion Blueprint

```powershell
# Revert ONLY the 3 DSP detection files to golden state
git checkout d9d1e507 -- `
  electron-app/src/hal/physics/LiquidEngineBase.ts `
  electron-app/src/hal/physics/profiles/ILiquidProfile.ts `
  electron-app/src/hal/physics/profiles/latino.ts

# DO NOT REVERT (keep HEAD):
#   LiquidStereoPhysics.ts  — declares raw_snare_delta (fixes d9d1e507's TS error)
#   ChillAmbientEngine.ts   — color morph speed (WAVE 7749.37/38)
#   ColorTranslator.ts      — openSlot saturation search (WAVE 7749.40)
#   TickEngine.ts           — passes raw_snare_delta (improves golden state)
#   All Aether/Hephaestus   — strobe fixes (WAVE 7749.46-50)
```

## 4. What Returns with the Reversion

| Feature | d9d1e507 behavior | HEAD behavior (being removed) |
|---|---|---|
| **High-flux bypass** | `spectralFlux > 0.20` → snare onset (Opus Paradox resolved) | REMOVED in 7749.44 |
| **Photon fallback** | `?? 1` (fail-open — allows onset if photon missing) | `?? 0` (fail-closed — 7749.42) |
| **TCT re-arm discriminator** | Does NOT exist | Added in 7749.42 (`_snareReArmed`, `_prevRawSnareDelta`) |
| **Dynamic clamp floors** | `0.06` (threshold), `0.10` (flux gate) | `0.08`, `0.12` (7749.43) |
| **Latino snare decay** | `0.60` (breathing TAcka) | `0.70` (7749.45 — glow sustain) |
| **Latino choke** | `snareChokeFrames: 4`, `snareChokeRate: 0.60` | `15`, `0.85` (7749.45) |
| **Air zone** | `_airEMA` soft follower | `envAir` LiquidEnvelope (7749.27) |
| **Floor zone** | Raw subBass passthrough | `envFloor` onset-driven (7749.27) |

## 5. Post-Checkout Verification Steps

1. `npx tsc --noEmit` — verify no type errors (HEAD's `LiquidStereoPhysics.ts` should resolve the latent `raw_snare_delta` error)
2. Rebuild `dist-electron-backend` — stale compiled JS will have HEAD's detection logic
3. Live test with melodic techno (Anyma/ToT) — verify synthesized snares fire via high-flux bypass
4. Live test with latino dembow — verify TAcka breathing at decayBase 0.60
5. Verify strobe effects still work (HEAD's HephaestusAetherAdapter strobe-dimmer coupling is independent)

## 6. Risk Assessment

**LOW RISK.** The three files being reverted are self-contained within the HAL physics layer. No external interface changes (the only interface change — `raw_snare_delta` in `LiquidStereoPhysics.ts` — is kept as HEAD, which fixes a latent TS error in d9d1e507). The Aether egress, UI, color systems, and strobe fixes are all in HEAD files that are NOT being reverted.

**One watch item:** d9d1e507's fail-open photon fallback (`?? 1`) means that if the photon block is ever missing (IPC drop, worker lag), ANY `rawSnareDelta > 0.06` will fire as a snare. This is what the user called the "Opus Paradox resolution" — it's permissive by design. The nanostrobe issue from 7749.35-45 was caused by the FIXES, not by this permissiveness.

---

**Awaiting your go/no-go before executing the checkout.**