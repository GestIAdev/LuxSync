# WAVE-4851 — PIPELINE AUTOPSY · THE SILENT PIPELINE AUDIT

> **Target**: NOTIFY_OPUS_PRO_TIER / ARCHITECTURE_ENGINE
> **Scope**: Forensic trace of `.lfx v2.1`/`v3` execution from `HephaestusRuntime.tick()` to `AetherUIProjector`.
> **Modus**: Linear audit. No patches. All findings cite file + line.
> **Disk specimen audited**: `electron-app/src/core/arsenal/builtins/latina_meltdown.lfx` plus 35 sibling clips.

---

## 0 · TL;DR — Where Data Dies

| # | Symptom | Where the data is killed | File · Line |
|---|---|---|---|
| **A** | Dimmer freezes at 100% for the whole clip duration | `WAVE 4844` COLOR‑OPACITY GUARD stamps a *second* `dimmer = 1.0` IMPACT intent **after** the curve‑evaluated intensity intent in the same frame. LTP merge inside the Arbiter overwrites the curve. | `HephaestusAetherAdapter.ts:112‑129` |
| **B** | L3 color silently ignored, UI shows L0 base palette | Color intents *are* emitted, *but* the COLOR‑node lookup loop (`for j … nodeData.family !== family … continue`) silently `break`s without emitting **when the fixture has no `:color` family node**. Combined with the `:impact` opacity guard (Bug A), the fixture lights up at 100 % white instead of taking the clip’s hue. | `HephaestusAetherAdapter.ts:98‑110` |
| **C** | `strobeRate` curve never reaches the Arbiter | `_paramFamily()` switch handles `'strobe'` but **not the v3 alias `'strobeRate'`**. Returns `null`, the `continue` at line 92 drops the entire output. Currently dormant (all 36 builtins use outer key `'strobe'`) but trips the moment a future migrator emits the canonical v3 outer key. | `HephaestusAetherAdapter.ts:219‑246` + `HephaestusAetherAdapter.ts:90‑92` |
| **D** | `HephAutomationClipV3.tracks[]` declared but **never consumed** | The “multicellular” V3 schema is fully typed in `core/hephaestus/types.ts`, but **no module reads `.tracks`**. The runtime still validates `serialized.curves` and rejects anything else. All on‑disk “v3” `.lfx` files are in fact `$schema: "hephaestus/v2.1"` with `curves: { … }` (the migrator only stamped the `author` field). | `HephaestusRuntime.ts:230` + grep verification |

> **The data does *not* die at the DMX boundary, the UI projector, or the Arbiter merge rules.** It dies inside `HephaestusAetherAdapter._populateValues` / the WAVE 4844 guard, before the Arbiter is even called.

---

## 1 · The Pipeline Under Audit

```
.lfx file (JSON, $schema "hephaestus/v2.1")
   │
   │  fs.readFileSync + JSON.parse
   ▼
HephaestusRuntime.loadClip          (rejects if no `curves` field)
   │
   │  curves: Map<HephParamId, HephCurve>
   ▼
HephaestusRuntime.tick(now)         ──► HephFixtureOutput[]
   │      (intensity / color / strobe / pan / tilt / …)
   ▼
HephaestusAetherAdapter.ingest      ──► INodeIntent[] (L3+, source='hephaestus')
   │      (setHephaestusIntents)
   ▼
NodeArbiter.arbitrate               ──► ArbitratedNodeMap (per‑node merged record)
   │
   ├──► NodeResolver  → DMX bytes  (EXEMPT per user report)
   │
   └──► AetherUIProjector → FixtureState[] for Hyperion Canvas 2D
```

The **SeleneAetherAdapter** is a parallel L3 producer that consumes the *legacy* `EffectFrameOutput` from `EffectManager.getCombinedOutput()` (old class‑based effects). New `.lfx` clips **never traverse** it: `getSeleneHephBridge().route()` returns `{kind:'hephaestus'}` and the playHook calls `HephaestusRuntime.play(filePath)`, which feeds the HephaestusAetherAdapter exclusively (see `TitanOrchestrator.ts:767‑780` and `TitanOrchestrator.ts:1986‑1990`).

---

## 2 · Forensic Trace — Stage by Stage

### 2.1 · The Reader — `HephaestusRuntime`

#### Loader (`HephaestusRuntime.loadClip`, lines `178‑275`)

Reads the file, unwraps `{ clip, … }` v1 envelope, then:

```ts
// HephaestusRuntime.ts:230
if (!serialized.curves || typeof serialized.curves !== 'object') {
  console.error(`[HephRuntime] ❌ Invalid clip structure in ${filePath}: missing or invalid curves`)
  return null
}
```

→ **Verdict**: hard‑rejects any clip without `curves`. A genuine V3 clip (`tracks: HephTrack[]`, no `curves` field) would be dropped silently from the registry’s point of view. Confirmed via `grep` — **no V3 → V2 in‑memory adapter exists** anywhere in `src/`.

The actual on‑disk specimen `latina_meltdown.lfx:1‑118` is `"$schema": "hephaestus/v2.1"`, `curves: { intensity, color }`. The migrator only changed the `author` string to `"LuxSync-Migrator-v3 / WAVE 4848"` (line 7). **Format is still V2 in structure.**

#### Curve Evaluator (`CurveEvaluator.getValue` / `.getColorValue`, lines `169‑341`)

- Numeric curves (`valueType === 'number'`) and color curves (`valueType === 'color'`) are **both** evaluated every frame.
- `getColorValue()` returns a pre‑allocated HSL object (zero‑alloc).
- No filter, no early return, no “intensity‑only” gate.

→ **Verdict**: The Reader is honest. Both `intensity` and `color` curves are computed every frame, every fixture.

#### Output writer (`HephaestusRuntime.tick*`, lines `477‑635`)

`tickWithPhase` (line 530) and `tickLegacy` (line 582) both iterate `active.clip.curves` and, **per fixture × per curve**, call `writeOutput(fixtureId, 'all', paramName, dmxValue, rgb?, fine?, normalizedValue?, normalizedRgb?, isCustomClip, clipId)`.

`writeOutput` (line 691‑737, **WAVE 4830** fix verified at line 678 — `normalizedRgb: { r:0, g:0, b:0 }` pre‑allocated per slot) writes into a per‑slot pre‑allocated object → **no shared‑scratch reference leak** between fixtures.

> ⚠️ The buffer `_normRgbBuf` (line 552‑554) is a frame‑level scratch for the HSL→RGB step **before** `writeOutput` copies the values into each slot’s own `normalizedRgb` object. Safe.

→ **Verdict**: Runtime correctly emits `parameter:'intensity' value:0..255` AND `parameter:'color' rgb:{0..255} normalizedRgb:{0..1}` outputs for every fixture, every frame. **The Reader is innocent.**

---

### 2.2 · The Packager — `HephaestusAetherAdapter`

This is the **first crime scene**. Two distinct bottlenecks here.

#### Bottleneck A — `WAVE 4844` Color‑Opacity Guard pins `dimmer = 1.0`

@`c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/aether/adapters/HephaestusAetherAdapter.ts:112-129`

```ts
// ⚡ WAVE 4844: COLOR-OPACITY GUARD — Override L3 opaco garantizado.
// Cuando L3 emite RGB al nodo :color, el GAG WAVE 4871 domina 'dimmer'
// en :impact bloqueando L0. Si el clip no tiene curva de intensidad
// separada, 'dimmer' queda sin escribir y el fixture aparece transparente.
// Solución: inyectar dimmer=1.0 al :impact del mismo fixture como garantía
// de opacidad total. Un output 'intensity' real del mismo clip lo
// sobreescribirá vía LTP (último gana) — sin daño colateral.
if (family === NodeFamily.COLOR && output.normalizedRgb != null) {
  for (let k = 0; k < nodeIds.length; k++) {
    const impactId = nodeIds[k]
    const impactData = this._graph.getNodeData(impactId)
    if (!impactData || impactData.family !== NodeFamily.IMPACT) continue
    const dimmerIntent = this._acquireIntent(impactId)
    dimmerIntent.values['dimmer'] = 1.0
    this._frameIntents.push(dimmerIntent as INodeIntent)
    break
  }
}
```

**Why the comment is wrong:**

`HephaestusRuntime.tick*` iterates `active.clip.curves` in **Map insertion order**, which is the JSON key order:

```json
"curves": {
  "intensity": { … },   ← processed FIRST
  "color":     { … }    ← processed SECOND
}
```

Result: `outputs[]` arrives at the adapter as `[fixture-001:intensity, fixture-001:color, fixture-002:intensity, fixture-002:color, …]`.

Inside `ingest()`:

| Iter | `output.parameter` | Side effects |
|---|---|---|
| i=0 | `'intensity'`  | push IMPACT intent `{ dimmer: curveValue }` |
| i=1 | `'color'` | push COLOR intent `{ red,green,blue }` **+ push EXTRA IMPACT intent `{ dimmer: 1.0 }`** (WAVE 4844) |

Both IMPACT intents target the **same `nodeId`**. The Arbiter applies them sequentially via `_applyIntent` (`NodeArbiter.ts:608‑615`), so the second one overwrites the first under LTP semantics — **`record['dimmer'] = 1.0`** wins.

> The premise *"un output 'intensity' real del mismo clip lo sobreescribirá vía LTP"* is exactly backwards: intensity arrives **before** the WAVE 4844 stamp, not after.

**Direct match to Symptom #1**: any clip that has *both* an `intensity` curve and a `color` curve will appear as a solid 100 % wall the entire time the color track is alive — which for `latina_meltdown.lfx` is `0 → 3000 ms`. Matches the user’s 3‑second 100 % block exactly.

#### Bottleneck B — Conditional silent drop of color intent

@`c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/aether/adapters/HephaestusAetherAdapter.ts:98-110`

```ts
// Find the node for this fixture that belongs to the target family
for (let j = 0; j < nodeIds.length; j++) {
  const nodeId = nodeIds[j]
  const nodeData = this._graph.getNodeData(nodeId)
  if (!nodeData || nodeData.family !== family) continue

  // Acquire an intent from the pool and populate values
  const intent = this._acquireIntent(nodeId)
  _populateValues(intent.values, param, output, behavior)
  this._frameIntents.push(intent as INodeIntent)
  // Only one node per family per fixture — stop searching
  break
}
```

For `param === 'color'`, `family === NodeFamily.COLOR`. If the fixture has **no** node with `family === NodeFamily.COLOR` (e.g. mono‑white movers, IMPACT‑only fixtures, certain dimmer‑only PARs whose ColorMixing is folded into the IMPACT family by the NodeExtractionPipeline), this loop **silently runs to completion without pushing anything**. No `console.warn`, no telemetry, no debug log entry.

However the *same* output triggers the WAVE 4844 block right after, which **does** find the IMPACT node and stamps `dimmer = 1.0`. → The fixture lights up white at full power, but with zero hue from the .lfx. Exactly the user’s description: *"solo muestran el color base (L0) del motor estático, ignorando las curvas de color del .lfx"*.

> Even if the fixture *does* have a COLOR node, this is also a single failure point: any inconsistency between `nodeIds` ordering and family assignments at patch time will surface as a silent color drop here.

The diagnostic log at line 132‑152 of the adapter would tell the operator whether color intents are emitted at all this frame:

```ts
console.log(`[HephAetherAdapter 🔬] … colorIntents=${colorIntents.length} …`)
```

→ **The next debugging step the user should take is verifying this log line at runtime.** If `colorIntents=0`, Bottleneck B is confirmed; if `colorIntents>0`, the bleed is downstream (see §2.4 below).

#### Bottleneck C — `strobeRate` v3 alias not in `_paramFamily` switch

@`c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/aether/adapters/HephaestusAetherAdapter.ts:219-246`

```ts
function _paramFamily(param: string): NodeFamily | null {
  switch (param) {
    case 'intensity':
    case 'strobe':                     // ← v2 name only
      return NodeFamily.IMPACT
    case 'color':
    case 'white':
    case 'amber':
      return NodeFamily.COLOR
    case 'pan':
    case 'tilt':
    case 'speed':
      return NodeFamily.KINETIC
    // …
    default:
      return null
  }
}
```

The `HephParamId` type (`core/hephaestus/types.ts:178‑200`) declares **both** `'strobe'` and `'strobeRate'` as valid v3 aliases:

```ts
| 'strobe'
| 'strobeRate'   // WAVE 4848 V3 alias
```

Then in `_populateValues` (lines 261‑335) only `case 'strobe'` exists; `'strobeRate'` is unhandled.

**Current state on disk**: every builtin `.lfx` examined (`surgical_strike.lfx:86-87`, `strobe_storm.lfx:78-79`, `strobe_burst.lfx:73-74`, `static_pulse.lfx:116-117`, `seismic_snap.lfx:111-112`, …) uses the outer JSON key `"strobe"` while the inner `paramId` field is `"strobeRate"`. Since `deserializeHephClip` (`types.ts:690‑694`) builds the `curves` Map using **the JSON key**, not the inner `paramId`, the runtime emits `output.parameter = 'strobe'` and the adapter handles it correctly.

→ **Bottleneck C is dormant today**, but it is a tripwire: the moment a future regeneration pass emits outer keys as `"strobeRate"` (the canonical v3 spelling), 100 % of strobe will silently vanish — `_paramFamily('strobeRate')` returns `null`, `continue` at line 92, no intent emitted, never makes it past the Packager.

Additionally, even on the v2 path, the `_populateValues` mapping at line 271‑281 is asymmetric with the L0 adapter (`LiquidAetherAdapter`):

```ts
case 'strobe':
  values['strobeRate'] = output.normalizedValue
  if (output.normalizedValue > 0) {
    values['shutter'] = 1.0
  }
  break
```

So inside the Arbiter the channel name is **`strobeRate`** (not `strobe`). That channel is *not* in `STRICT_PRIORITY_CHANNELS` (`NodeArbiter.ts:69` lists only `['strobe', 'shutter']`), so it flows through pure LTP — correct. `shutter` is in STRICT_PRIORITY and the `layer === 'hephaestus'` branch (NodeArbiter.ts:1024‑1028) lets it through unconditionally. **Strobe transmission at the Arbiter is wired correctly**, the only crime is Bottleneck C.

---

### 2.3 · The Layer Guardian — `NodeArbiter`

#### Merge rules for L3 vs L0 (`NodeArbiter._applyIntent`, lines `910‑1048`)

Audited. The flow for an L3+ Hephaestus intent on `:color` writing `red/green/blue`:

1. Lines 988‑994 — `_l3DominatedChannels[nodeId].add('red'|'green'|'blue')`.
2. Line 1039‑1046 — `record[channel] = incoming` (LTP, the channel is not in STRICT_PRIORITY).
3. Lines 996‑1014 — `WAVE 4871 LUMINANCE GAG`: because the trigger families set is `{'impact','color'}` and the channel was written by `layer === 'hephaestus'`, the Arbiter ALSO seals **every luminance channel** (`dimmer`, `strobe`, `shutter`, `master_brightness`, `brightness`) on **every node of the same fixture** against future L0/L1 writes — by adding them to `_l3DominatedChannels`.

Ordering inside `arbitrate()` (lines 505‑615):

```
L0 system (line 510) → L1 selene → LP playback → L2 manual (direct) → L3 effect → L3+ hephaestus
```

L0 runs **first** and `_l3DominatedChannels` is empty at that point, so L0 still writes its `red/green/blue` to `record`. Then L3+ (hephaestus) runs and overwrites them via LTP. **L3 supremacy on color channels is upheld.**

→ **Verdict on the Arbiter:** the merge rules are correct. No missing opacity flag, no missing weight, no missing override. The reason the user *thinks* L3 color is being overwritten is that the *Packager* never emitted the L3 color intent in the first place (Bottleneck B) or that the *coupled* WAVE 4844 dimmer stamp shifts the apparent output to white (Bottleneck A blinds the operator’s eye to the actual hue).

> Side note: The WAVE 4871 GAG combined with the WAVE 4844 stamp means the operator has **no manual L0/L1 escape valve** for luminance once any color curve fires. This is by design (L3 supremacy doctrine, WAVE 4836), but amplifies Bug A’s perception: "everything goes 100 % white and stays there".

---

### 2.4 · The Consumer — `AetherUIProjector`

@`c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/aether/resolver/AetherUIProjector.ts:75-189`

Reads the `ArbitratedNodeMap` directly. Audited:

- Line 132: `dimmerNorm = ch['dimmer'] ?? ch['brightness']` — accepts both aliases. **No filter** that would drop L3‑sourced dimmer.
- Line 140‑142: `rRaw = ch['r'] ?? ch['red']`, idem `g/b`. **Accepts the canonical `red/green/blue` keys that the adapter emits.** No silent drop here.
- Line 146: `brightnessScale = hasImpactDimmer ? 1.0 : (ch['brightness'] ?? 1.0)` — only scales by `brightness` when the fixture has no IMPACT node (WAVE 4695). Safe.
- Line 165‑173: per‑fixture `Math.max` blend across nodes — HTP **within the projector**, but this is correct given that `red/green/blue` are LTP at the Arbiter and one fixture has at most one COLOR node contributing those keys.

→ **Verdict on the Consumer:** the UI projector is faithful. If `arbitrated.get(nodeId)['red']` is set, the projector projects it. The fault is **upstream**, never here. The defensive log block at line 198‑213 (`[AetherUIProjector 🔬 NO-COLOR]`) is precisely the diagnostic that proves it: it fires when the projector cannot find color in any arbitrated node, which by transitivity means the adapter never emitted color intents.

---

### 2.5 · Why the user thinks .lfx is V3 — Migrator artefact

Every `.lfx` on disk audited has:

```json
"author": "LuxSync-Migrator-v3 / WAVE 4848"
```

…but `"$schema": "hephaestus/v2.1"` and `"curves": { … }`. The migrator stamped the author string and renamed some inner `paramId` fields to v3 spellings (`paramId: "strobeRate"`), but **left the structural format at v2.1**. There is no V3 loader, no V3→V2 adapter, no `tracks[]` consumer anywhere in the codebase.

→ **Practical implication**: the runtime is processing V2 clips correctly. The “v3 multicellular” claim in the file header is cosmetic. **Bug D is a documentation/expectation issue, not a runtime data‑loss issue.**

---

## 3 · Direct Symptom → Crime‑Scene Mapping

| User‑reported Symptom | Confirmed Cause | File · Line |
|---|---|---|
| 1. *"Bloque fijo de 100 % dimmer durante 3s"* | **WAVE 4844 Color‑Opacity Guard pins `dimmer = 1.0` after the intensity intent.** Order of operations breaks the LTP fallback. | `HephaestusAetherAdapter.ts:112‑129` |
| 2. *"Cero transmisión de color del .lfx"* | **Most likely**: COLOR family node missing for the fixtures in question → adapter silently skips the color intent emission while still firing the dimmer guard. Needs runtime confirmation via `[HephAetherAdapter 🔬]` log. | `HephaestusAetherAdapter.ts:98‑110` |
| 3. *"Cero transmisión de strobeRate"* | **Currently dormant** at runtime (outer keys are still `"strobe"`). The latent bug `_paramFamily('strobeRate') → null` will activate if any clip emits outer key `"strobeRate"`. Independently, if the user’s observation is based on the 2D simulator, note the projector renders no strobe channel — strobe is hardware‑only. | `HephaestusAetherAdapter.ts:219‑246` |
| 4. *"Visible en UI 2D, no en DMX"* | UI 2D is a faithful mirror (see §2.4). DMX path uses the same `ArbitratedNodeMap` through `NodeResolver`. The "data dies in memory" claim is correct — death point is `HephaestusAetherAdapter`, **before** the Arbiter, so both consumers see the same corrupted intent set. | `HephaestusAetherAdapter.ts:64‑155` |

---

## 4 · Next Diagnostic Step (Runtime, no patches)

Run a clip with both `intensity` and `color` curves (e.g. `latina_meltdown`) and capture two log channels:

1. **`[HephAetherAdapter 🔬]`** — emitted every 44 frames inside `HephaestusAetherAdapter.ingest`. The line either reads:
   - `colorIntents=N` with `first=… r=… g=… b=…` → color **is** emitted; bleed is downstream of the adapter (cross‑check with `[NodeArbiter 🎨 HEPH-RESULT]`).
   - `(no color intents) … sampleParam=color isCustom=true nodeLen=N` → color **is dropped** by Bottleneck B; verify fixture has a `:color` family node via `NodeGraph.getDeviceNodes()`.

2. **`[NodeArbiter 🎨 HEPH-RESULT]`** — emitted every 44 frames inside `arbitrate()` (lines 619‑633). Confirms whether `result red=…, green=…, blue=…` survives the merge. Existing instrumentation; no code changes needed.

These two existing diagnostics together pin Bottleneck B vs. any other failure with one show‑and‑play run.

---

## 5 · Confirmed Innocent Components

- **`CurveEvaluator`** — evaluates color and number curves identically; no filter.
- **`HephaestusRuntime.tick*`** — emits both `intensity` and `color` outputs per fixture, in stable order.
- **`HephaestusRuntime.writeOutput`** — per‑slot pre‑allocated `normalizedRgb` (WAVE 4830 verified at line 678) — no shared‑scratch reference bleed.
- **`SeleneAetherAdapter`** — not in the new‑`.lfx` path; only consumes legacy `EffectFrameOutput` from `EffectManager.getCombinedOutput()`. No code path routes new clips through it.
- **`NodeArbiter._applyIntent`** — L3 dominance + LTP merge rules for `red/green/blue` and `strobeRate` are correct.
- **`AetherUIProjector`** — duck‑types `r/red`, `g/green`, `b/blue`, `dimmer/brightness` from the arbitrated map; no L3 filter.

---

## 6 · Findings Summary (single sentence per bug)

1. **`HephaestusAetherAdapter.ts:112-129`** — `WAVE 4844` stamps `dimmer = 1.0` *after* the intensity intent, so LTP merge inside `NodeArbiter.arbitrate()` overwrites the curve‑evaluated dimmer for every frame the color track is alive. **This is the bottleneck producing the 3‑second 100 % dimmer block.**
2. **`HephaestusAetherAdapter.ts:98-110`** — When a fixture lacks a `:color` family node the color intent loop completes without `push`, silently dropping the L3 color while the WAVE 4844 dimmer stamp still fires on `:impact`. **This is the bottleneck producing "color del .lfx ignorado, L0 base visible".**
3. **`HephaestusAetherAdapter.ts:219-246`** — `_paramFamily()` switch is missing the `'strobeRate'` v3 alias; `_populateValues` likewise. Dormant today, lethal the moment outer JSON keys are migrated to v3 canonical names.
4. **`HephaestusRuntime.ts:230`** — `loadClip` rejects any file without a `curves` field; no V3 `tracks[]` loader exists; the type `HephAutomationClipV3` is unconsumed. The migration to v3 is **cosmetic**, not structural.

— End of autopsy —
