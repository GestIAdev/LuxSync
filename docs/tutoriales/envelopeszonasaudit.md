Now let me read the `LiquidEngineBase` to see how `backLeft`/`backRight` are computed from the FFT bands:

Now let me check the `LiquidStereoInput` interface to confirm `snare_energy` and `hh_energy` are wired:

Now let me check the `LiquidEnvelopeConfig` interface and the genre profiles for the `back` zone envelope coefficients:

I have all the data needed. Let me also verify whether `hh_energy` is consumed anywhere in the engine:

Now let me confirm `hh_energy` is similarly only declared but never consumed in the engine hot path:

Let me grab the `envelopeHighMid` (Back L) for techno and latino to complete the coefficient table:

I now have a complete picture. Let me compile the diagnostic report.

# WAVE 7744 — OMNILIQUID ENGINE ROUTING & PHYSICS AUDIT

## 1. Canonical Zone Topology (4.1 & 7.1)

The `OmniliquidEngine` is implemented as a class hierarchy: `LiquidEngineBase` (abstract, holds all DSP) plus two concrete children that only implement `routeZones()`.

### 4.1 Layout — `LiquidEngine41` <ref_file file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\physics\LiquidEngine41.ts" />

Compact rig: **4 zones + strobe**. The 7 logical signals are collapsed via `max()`:

| Output Zone | Signal Source | Strategy |
|---|---|---|
| `frontPar` (L=R) | `max(frontLeft, frontRight)` = `max(subBass, kick)` | `default` |
| `frontPar` (L=R) | `frontRight` = `envKick` only | `strict-split` (techno) |
| `backPar` (L=R) | `max(backLeft, backRight)` = `max(highMid, snare)` | both strategies |
| `moverL` | `envTreble` (melody) | — |
| `moverR` | `envVocal` (voices) | — |

Note: `frontPar` gets a 0.88/frame release smoothing in `default` mode (anti-mini-strobo bridge between kick frames). `strict-split` bypasses this for staccato precision.

### 7.1 Layout — `LiquidEngine71` <ref_file file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\physics\LiquidEngine71.ts" />

**7 independent zones** — no `max()` compaction. Topology bifurcates by `profile.id`:

| Zone | TECHNO (default) | LATINO (`latino-fiesta`) | CHILL (`chill-oceanic`) |
|---|---|---|---|
| Front L | `envSubBass` (El Océano) | `envSubBass` (El TÚN del dembow) | neutral 0.5 (ChillAmbientEngine overrides) |
| Front R | `envKick` (El Francotirador) | `envKick` (El Francotirador) | neutral 0.5 |
| **Back L** | `envHighMid` (El Coro — mid synths) | `envHighMid` (El Tumbao — congas) | neutral 0.5 |
| **Back R** | `envSnare` (El Látigo — transient shaper) | `envSnare` (El TAcka — clap dembow) | neutral 0.5 |
| Mover L | `envTreble` (El Melodista) | `envVocal` (El Galán — **swapped**) | `envVocal` (La Voz del Mar) |
| Mover R | `envVocal` (El Alma) | `envTreble` (La Dama — **swapped**) | `envTreble` (La Bioluminiscencia) |
| Canal 7 | — | 0.0 (blackout, reserved v2.0) | — |

The Front/Back stereo split is **identical across Techno and Latino** — only the Movers get swapped (vocal↔treble) for semantic reasons. Chill is fully neutralized at this layer; `ChillAmbientEngine` takes over via `SeleneLux.liquidStereoOverrides`.

## 2. Frequency-to-Zone Routing — The `back` Zone

This is the critical finding. The `back` zone is fed by two envelopes computed in `LiquidEngineBase.applyBands()` <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\physics\LiquidEngineBase.ts" lines="535-636" />:

### Back R (`backRight` → `envSnare`) — "El Látigo"

The `hybridSnare` signal is a **max-blend of two detectors**:

**Detector A — Legacy Transient Shaper (time-domain, always active):**
```
rawSnare  = max(0, highMid × tonalSquelch − lowMid × 1.5)   // bass leakage subtraction
rawHat    = treble × tonalSquelch
rawSpike  = highMidDelta + trebleDelta                        // positive deltas only
snareSpectrum = mid × (treble × 0.5 + harshness)             // anti-hihat: treble halved
rawSnareCalc  = (rawSpike × snareSpectrum × 10.0) > 0.19     // anti-compression threshold
isSnareImpact = rawSnareCalc && (now − lastSnareTime > 45ms) // debounce
percRaw  = snareHoldCounter > 0 ? 1.0 : 0.0                  // 4-frame hold (~90ms)
```

**Detector B — WAVE 8008 ADAPTER (`rhythmic.snare_energy` from GodEarFFT V3):** <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\physics\LiquidEngineBase.ts" lines="583-609" />
```
if (input.snare_energy !== undefined) {
  snareDelta  = snare_energy − prevSnareEnergy
  snareOnset  = snareDelta > 0.01 && snare_energy > 0.06 && (now − lastSnareOnset > 80ms)
  snareImpulse *= 0.04   // fast artificial decay (~90ms at 44Hz)
  hybridSnare = max(percRaw, snareImpulse)   // WAVE 8009.4: max-blend, not replace
}
```

Then a **Morphologic Centroid Shield** (WAVE 2449) can zero `hybridSnare` during kicks if `spectralCentroid < 900×(1−morphFactor)` and `harshness < 0.024` — preventing kick body from masquerading as snare.

**→ Back R IS consuming `rhythmic.snare_energy`.** ✅

### Back L (`backLeft` → `envHighMid`) — "El Coro / El Tumbao"

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\physics\LiquidEngineBase.ts" lines="688-704" />

```
dmzFactor      = isTechno ? 0.55 : 0.30                    // bass decontamination
cleanMidL      = max(0, mid − bass × dmzFactor)
vocalPenalty   = isTechno ? 0 : min(0.75, vocalSustainEMA × (1 − midDelta/vocalSustainEMA))
midSynthInput  = max(0,
    lowMid × backLLowMidWeight
  + cleanMidL × backLMidWeight × (1 − vocalPenalty × 0.80)
  − treble × backLTrebleSub
  − bass  × backLBassSub
)
backLeft = min(1.0, envHighMid.process(midSynthInput, ...) × backLeftGain)
```

**→ Back L is fed ENTIRELY by raw FFT bands (`lowMid`, `mid`, `bass`, `treble`).** It does NOT consume `rhythmic.hh_energy`. ❌

### The Dead Wire: `hh_energy`

`LiquidStereoInput.hh_energy` is declared <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\physics\LiquidStereoPhysics.ts" lines="65-67" /> and plumbed end-to-end:

```
GodEarFFT._hhEnergyEMA → TickEngine → TitanEngine → SeleneLux → LiquidStereoInput.hh_energy
```

**But `LiquidEngineBase.applyBands()` never reads `input.hh_energy`.** It is a dead wire — transported through 4 pipeline stages and dropped on the floor at the engine door. The Back L zone (which the Architect wants to isolate hi-hats into) relies on `treble` band subtraction (`- treble × backLTrebleSub`) — a crude proxy that conflates hi-hats with cymbals, synth brightness, and vocal sibilance.

## 3. Physics Coefficients — `back` Zone Envelopes

The `back` zone is shaped by two `LiquidEnvelope` instances. Their configs per genre:

### Back R — `envelopeSnare` (El Látigo / TAcka / Destello)

| Parameter | TECHNO | LATINO | POP/ROCK | CHILL |
|---|---|---|---|---|
| `gateOn` (surface tension) | **0.28** | 0.40 | 0.10 | 0.15 |
| `boost` | 2.5 | 3.5 | 3.5 | 2.5 |
| `crushExponent` (elasticity) | 1.0 (linear) | 1.0 | **0.8** (expansive) | 0.9 |
| `decayBase` (viscosity) | **0.30** (~200ms) | **0.72** (wide swing) | 0.35 (organic ring) | **0.80** (slow glow) |
| `decayRange` | 0.40 | 0.10 | 0.12 | 0.10 |
| `maxIntensity` | **1.0** (uncapped) | 0.85 | 0.85 | 0.85 |
| `squelchBase` | 0.20 | 0.03 | 0.10 | 0.02 |
| `ghostCap` | 0.00 (black) | 0.04 | 0.00 | **0.20** (ambient floor) |

**4.1 overrides** (fused via `fuseProfileFor41`):
- Techno: `gateOn 0.28→0.22` (more sensitive in compaction)
- Latino: `gateOn 0.40→0.55`, `decayBase 0.72→0.45`, `squelchBase 0.03→0.45` (staccato TAcka)
- Pop/Rock: `gateOn 0.10→0.06` (more sensitive in compaction)

### Back L — `envelopeHighMid` (El Coro / Tumbao / Algas)

| Parameter | TECHNO | LATINO | POP/ROCK | CHILL |
|---|---|---|---|---|
| `gateOn` | 0.15 | 0.20 (base) / 0.18 (4.1) | 0.03 | **0.02** (near-zero) |
| `boost` | 1.5 | 3.0 / 2.2 (4.1) | 2.5 | 2.5 |
| `crushExponent` | 1.0 | **2.0** / 1.5 (4.1) | 1.0 | 1.0 |
| `decayBase` | 0.62 / 0.45 (4.1) | **0.14** / **0.75** (4.1) | 0.55 / 0.30 (4.1) | **0.95** (kelp) |
| `decayRange` | 0.25 | 0.03 | 0.15 | 0.04 |
| `maxIntensity` | 0.85 / 0.60 (4.1) | 0.95 | 0.90 / 0.65 (4.1) | 0.88 |
| `ghostCap` | 0.00 | 0.00 / 0.04 (4.1) | 0.03 | **0.21** (always present) |

**Key physics deltas for the `back` zone across genres:**
- **Techno**: Snare is a dry snap (`decayBase 0.30`, `ghostCap 0.00`), Back L is a breathing synth pad (`decayBase 0.62`, linear crush).
- **Latino**: Snare is a wide-swing TAcka (`decayBase 0.72` in 7.1, `0.45` in 4.1), Back L is a guillotine percussive hit in 7.1 (`decayBase 0.14`, `crushExponent 2.0`) but a slow melaza manto in 4.1 (`decayBase 0.75`).
- **Pop/Rock**: Snare rings organically (`decayBase 0.35`, `crushExponent 0.8` expansive), Back L is vocal/guitar wash.
- **Chill**: Both zones are ambient — high `decayBase` (0.80/0.95), high `ghostCap` (0.20/0.21), near-zero gates. Bioluminescent persistence.

## 4. Architectural Proposal — Inject `hh_energy` into Back L

**Problem:** The Architect wants the `back` zone to isolate snare and hi-hat hits. Currently:
- Back R (snare): ✅ Already consumes `rhythmic.snare_energy` via WAVE 8008 ADAPTER (max-blended with legacy transient shaper).
- Back L (hi-hat): ❌ Uses raw `treble` band minus `backLTrebleSub` — no isolation. `hh_energy` is plumbed but never read.

**Proposal — WAVE 7745: HH Energy Adapter for Back L**

Mirror the WAVE 8008 ADAPTER pattern for hi-hats. In `LiquidEngineBase.applyBands()`, after the existing Back L cross-filter calculation, inject `input.hh_energy` as a max-blend (not replacement, preserving the existing mid-synth texture):

```typescript
// WAVE 7745: HH ENERGY ADAPTER — Back L hi-hat isolation
// When GodEarFFT V3 supplies hh_energy (RhythmicPercussionTracker high-band EMA),
// convert it to a shaped impulse and max-blend with the existing midSynthInput.
// This preserves the mid-synth pad texture while letting isolated hi-hat hits
// punch through Back L without contamination from cymbals/sibilance.
if (input.hh_energy !== undefined) {
  const rawHhEnergy = input.hh_energy
  const hhDelta = rawHhEnergy - this._prevHhEnergy

  // Onset detection: derivative + absolute threshold + 60ms cooldown
  // (hi-hats fire faster than snares — 60ms allows 16th notes at 160 BPM)
  const hhOnset = hhDelta > 0.008 && rawHhEnergy > 0.04 && (now - this._lastHhOnset > 60)

  if (hhOnset) {
    this._lastHhOnset = now
    this._hhImpulse = 1.0
  }

  // Fast decay — 3% retained per frame (~70ms at 44Hz)
  // Hi-hats are staccato; shorter hold than snare (4% / ~90ms)
  this._hhImpulse *= 0.03
  this._prevHhEnergy = rawHhEnergy

  // Max-blend: existing midSynthInput survives as pad texture,
  // hhImpulse punches isolated hi-hat transients on top.
  midSynthInput = Math.max(midSynthInput, this._hhImpulse * p.hhBlendGain)
}
```

**Required new state fields** on `LiquidEngineBase`:
```typescript
private _prevHhEnergy: number = 0
private _lastHhOnset: number = 0
private _hhImpulse: number = 0
```

**Required new profile field** on `ILiquidProfile`:
```typescript
/** WAVE 7745: Gain applied to hh_energy impulse when max-blending into Back L.
 *  Default 0.6 — hi-hats are supportive, not dominant. Techno 0.8 (driving hats),
 *  Latino 0.5 (güira is textural), Chill 0.0 (no hats in chill). */
readonly hhBlendGain?: number
```

**Why max-blend, not replace:** The existing `midSynthInput` carries congas, synths, and vocal-gated mid content. Replacing it would kill the "El Coro" / "El Tumbao" character. Max-blending lets isolated hi-hat transients ride on top of the existing texture — the same defense-in-depth philosophy as the WAVE 8009.4 snare adapter.

**Why this works for the Architect's goal:** The `back` zone would then carry **both** isolated percussion signals from `RhythmicPercussionTracker`:
- Back R = snare (via `snare_energy` → WAVE 8008 ADAPTER)
- Back L = hi-hat (via `hh_energy` → WAVE 7745 ADAPTER) + existing mid-synth pad

This is a read-only audit. No files were modified. Implementation of WAVE 7745 awaits your directive.

---

# WAVE 7744 — EXTENSIÓN: LAS 9 ZONAS CANÓNICAS Y SU REFLEJO EN EL LIQUIDENGINE

## 5. Las 9 Zonas Canónicas — Fuente de Verdad

El sistema canónico de zonas vive en `ShowFileV2.ts` <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\stage\ShowFileV2.ts" lines="388-450" />:

```typescript
export type CanonicalZone =
  | 'front' | 'back' | 'floor'
  | 'movers-left' | 'movers-right'
  | 'center' | 'air' | 'ambient' | 'unassigned'

export const CANONICAL_ZONES: readonly CanonicalZone[] = [
  'front', 'back', 'floor',
  'movers-left', 'movers-right',
  'center', 'air', 'ambient', 'unassigned',
] as const
```

Estas 9 zonas son la fuente de verdad para zoning de fixtures, UI dropdowns, y validación. **Toda fixture del show tiene exactamente una de estas 9 zonas.**

## 6. Mapa Unificado: Zona Canonical → Campo del LiquidStereoResult

El puente entre las 9 zonas canónicas y el motor de física vive en `zoneUtils.ts` <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\adapters\zoneUtils.ts" lines="173-210" />. La función `selectZoneFromResult()` es el traductor universal:

| # | Zona Canonical | Campo `LiquidStereoResult` | Envelope / Cálculo | Descripción |
|---|---|---|---|---|
| 1 | `front` | `frontLeftIntensity` + `frontRightIntensity` (avg) | `envSubBass` + `envKick` | El Océano + El Francotirador |
| 2 | `back` | `backLeftIntensity` + `backRightIntensity` (avg) | `envHighMid` + `envSnare` | El Coro + El Látigo |
| 3 | `floor` | `floorIntensity` | **Sin envelope** — señal instantánea | Uplights — subBass+lowMid directo |
| 4 | `movers-left` | `moverLeftIntensity` | `envTreble` (techno) / `envVocal` (latino/chill) | El Melodista / El Galán |
| 5 | `movers-right` | `moverRightIntensity` | `envVocal` (techno) / `envTreble` (latino/chill) | El Alma / La Dama |
| 6 | `center` ⚡ | `strobeActive` + `strobeIntensity` | **Sin envelope** — trigger binario | **Strobes/Blinders centrales** |
| 7 | `air` | `airIntensity` | **Sin envelope** — EMA suavizado | Lásers/Atmosféricos |
| 8 | `ambient` | `ambientIntensity` | **Sin envelope** — EMA lento + crush | House lights/Wash BG |
| 9 | `unassigned` | `ambientIntensity` (fallback) | Hereda ambient | Sin asignar → ambient por defecto |

**Observación crítica:** Solo 4 de las 9 zonas (`front`, `back`, `movers-left`, `movers-right`) pasan por `LiquidEnvelope` con su física de gate/decay/crush/squelch. Las otras 5 (`floor`, `center`, `air`, `ambient`, `unassigned`) usan cálculos directos — EMA, instantáneo, o trigger binario — **sin la parametría por género de los envelopes**.

---

## 7. Zona `floor` — Uplights (20-500Hz)

### Cálculo en `LiquidEngineBase.applyBands()` <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\physics\LiquidEngineBase.ts" lines="752-755" />

```typescript
const floorIntensity = Math.min(1.0, Math.max(0.0,
  (bands.subBass * 0.65 + bands.lowMid * 0.35) * recoveryFactor
))
```

### Características
- **Sin envelope.** Señal instantánea — máxima reactividad al bajo.
- **Sin parametría por género.** Los 4 perfiles (Techno, Latino, Pop/Rock, Chill) usan la misma fórmula con los mismos pesos (0.65/0.35).
- **Gate único:** `recoveryFactor` (AGC rebound) — atenúa durante los 250ms post-silencio.
- **Sin gate de activación** — cualquier energía sub-grave la enciende.
- **Sin decay** — cae instantáneamente cuando el bajo desaparece.

### Routing en `LiquidEngine71` y `LiquidEngine41`
Ambos motores pasan `floorIntensity` directo del `ProcessedFrame` al `LiquidStereoResult` sin transformación <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\physics\LiquidEngine71.ts" lines="182-184" />.

### Brecha detectada
La zona `floor` **no tiene perfiles por género**. Un uplight en techno (bombo seco, staccato) y un uplight en chill (sub continuo, oceánico) reciben la misma señal instantánea sin shaping. El `ambientIntensity` sí tiene parametría (`ambientAttackMs`, `ambientReleaseMs`, `ambientCrushExponent`, `ambientGain`, `ambientOutputExponent`) — el `floorIntensity` no.

---

## 8. Zona `center` — ⚡ El Zona de 3 Nombres (Strobe / Flash / Center)

### ⚠️ PROBLEMA DE NOMENCLATURA — 3 nombres para la misma zona

Esta zona tiene **3 nombres diferentes** en el codebase, generando confusión:

| Nombre | Dónde aparece | Significado |
|---|---|---|
| `center` | `CanonicalZone` en `ShowFileV2.ts` | Nombre canónico oficial (WAVE 2040.24) |
| `strobe` | `LiquidStereoResult.strobeActive/strobeIntensity` | El campo del motor de física |
| `flash` | `selectZoneFromResult()` case `'flash'` en `zoneUtils.ts` | El zoneId semántico del NodeGraph |

**Unificación propuesta (WAVE 7746):** Adoptar `center` como nombre canónico único. Renombrar `strobeActive`→`centerActive` y `strobeIntensity`→`centerIntensity` en `LiquidStereoResult`. Eliminar el case `'flash'` en `zoneUtils.ts` y mapearlo a `'center'`.

### Cálculo en `LiquidEngineBase.calculateStrobe()` <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\physics\LiquidEngineBase.ts" lines="963-990" />

```typescript
private calculateStrobe(treble, ultraAir, noiseMode): { active, intensity } {
  if (this._strobeActive && now - this.strobeStartTime > p.strobeDuration) {
    this._strobeActive = false
  }
  const effectiveThreshold = noiseMode
    ? p.strobeThreshold * p.strobeNoiseDiscount
    : p.strobeThreshold
  const isPureTreblePeak = treble > effectiveThreshold
  const isUltraAirCombo = ultraAir > 0.70 && treble > 0.60
  if ((isPureTreblePeak || isUltraAirCombo) && !this._strobeActive) {
    this._strobeActive = true
    this.strobeStartTime = now
  }
  return { active: this._strobeActive, intensity: ... }
}
```

### Trigger adicional — Güiro Effect (WAVE 4826.5) <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\physics\LiquidEngineBase.ts" lines="726-732" />
```typescript
const isDrop = bands.bass < 0.35 && bands.lowMid < 0.4
if (isDrop && trebleDelta > 0.25) {
  strobeResult.active = true
  strobeResult.intensity = Math.min(1.0, strobeResult.intensity + trebleDelta * 2.0)
}
```

### Parametría por género (`strobeThreshold` / `strobeDuration` / `strobeNoiseDiscount`)

| Parámetro | TECHNO | LATINO | POP/ROCK | CHILL |
|---|---|---|---|---|
| `strobeThreshold` | 0.80 | 0.85 | **0.88** (solo climax) | **999.0** (IMPOSIBLE) |
| `strobeDuration` (ms) | 30 | 25 | 20 | 10 |
| `strobeNoiseDiscount` | 0.80 | 0.85 | 0.90 | 1.0 |

### Características
- **Sin envelope.** Trigger binario (active/inactive) + intensidad escalar.
- **Doble trigger:** treble peak puro O combo ultraAir+treble.
- **Anti-noise:** `noiseMode` sube el threshold (descuento configurable).
- **Chill lo desactiva permanentemente** con threshold 999.0.
- **Güiro override:** drops con trebleDelta alto disparan flash dorado sin importar el threshold.

### Routing en `zoneUtils.ts` <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\adapters\zoneUtils.ts" lines="189-191" />
```typescript
case 'flash':
  return result.strobeActive ? (result.strobeIntensity || 1.0) : 0
```
El case `'flash'` lee `strobeActive`/`strobeIntensity`. **No hay case `'center'` explícito** — cae al case `'unassigned'`/`'center'`/`'mid'` que retorna `ambientIntensity` <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\adapters\zoneUtils.ts" lines="201-205" />.

### ⚠️ BUG DETECTADO: `center` no recibe el strobe
El switch en `selectZoneFromResult()` tiene:
```typescript
case 'unassigned':
case 'center':    // ← center cae aquí
case 'mid':
  return result.ambientIntensity   // ← retorna AMBIENT, no STROBE
```

**Una fixture con `zone: 'center'` recibe `ambientIntensity`, NO `strobeActive/strobeIntensity`.** El strobe del motor nunca llega a la zona canónica `center` a través de `selectZoneFromResult()`. El strobe solo llega vía el case `'flash'`, que es un zoneId legacy del NodeGraph — no la zona canónica.

**Esto significa que cualquier fixture zoned como `center` en el ShowFileV2 (la fuente de verdad canónica) NO recibe los strobes del LiquidEngine.** Solo los recibe si su NodeGraph usa el zoneId legacy `'flash'`.

### Fix propuesto (WAVE 7746.1):
```typescript
case 'center':
case 'flash':
  return result.strobeActive ? (result.strobeIntensity || 1.0) : 0
case 'unassigned':
case 'mid':
  return result.ambientIntensity
```

---

## 9. Zona `air` — Lásers / Atmosféricos (6-22kHz)

### Cálculo en `LiquidEngineBase.applyBands()` <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\physics\LiquidEngineBase.ts" lines="431-439, 780-782" />

**EMA update (corre cada frame, antes del silence check):**
```typescript
const _airSignal = 1.0 - Math.exp(-(bands.treble * 0.60 + bands.highMid * 0.40) * 3.0)
if (_airSignal > this._airEMA) {
  this._airEMA = this._airEMA * 0.88 + _airSignal * 0.12   // attack ~8 frames
} else {
  this._airEMA = this._airEMA * 0.95 + _airSignal * 0.05   // release ~20 frames
}
```

**Salida final:**
```typescript
const airIntensity = Math.min(1.0, Math.max(0.0, this._airEMA * recoveryFactor * 1.4))
```

### Características
- **Sin envelope** (sin `LiquidEnvelope`), pero **con EMA suavizado** — ataque ~8 frames, release ~20 frames.
- **Compresión soft-knee:** `1 - e^(-x×3)` — previene que ultraAir spikes causen parpadeos histéricos en lásers/haze.
- **Boost 1.4x** post-EMA para resucitar con brillo.
- **Gate:** `recoveryFactor` (AGC rebound).
- **Sin parametría por género.** Los 4 perfiles usan los mismos alphas (0.12/0.05) y el mismo boost (1.4).

### Brecha detectada
La zona `air` **no tiene perfiles por género**. Un láser en techno (agudos cortantes) y un láser en chill (brillo suave) reciben el mismo EMA con los mismos time constants. A diferencia de `ambient` (que tiene 5 parámetros configurables), `air` tiene todo hardcodeado.

---

## 10. Zona `ambient` — House Lights / Wash BG

### Cálculo en `LiquidEngineBase.applyBands()` <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\physics\LiquidEngineBase.ts" lines="405-439, 756-779" />

**EMA update (corre cada frame):**
```typescript
const _ambAttackAlpha  = Math.min(1.0, 1000 / ((p.ambientAttackMs  ?? 800) * 44))
const _ambReleaseAlpha = Math.min(1.0, 1000 / ((p.ambientReleaseMs ?? 10000) * 44))
const _ambMidWeight = p.ambientMidWeight ?? 0
const _ambMix = bands.subBass + bands.mid * _ambMidWeight
if (_ambMix > this._ambientEMA) {
  this._ambientEMA = this._ambientEMA * (1 - _ambAttackAlpha) + _ambMix * _ambAttackAlpha
} else {
  this._ambientEMA = this._ambientEMA * (1 - _ambReleaseAlpha) + _ambMix * _ambReleaseAlpha
}
```

**Salida final (crush + gain + output exponent):**
```typescript
const _ambientCrushExp = p.ambientCrushExponent ?? 2.0
const _ambientCrushed  = Math.pow(_ambientRaw, _ambientCrushExp)
const _ambientGain     = p.ambientGain ?? 1.35
let preGainAmbient     = Math.min(1.0, _ambientCrushed * _ambientGain)
const _ambientOutputExp = p.ambientOutputExponent ?? 1.3
let ambientIntensity   = Math.pow(preGainAmbient, _ambientOutputExp)
// Fade exponencial suave para Tungsten en valores bajos
if (ambientIntensity < 0.03) {
  ambientIntensity *= 0.85
  if (ambientIntensity < 0.001) ambientIntensity = 0
}
```

### Parametría por género — LA ZONA MÁS CONFIGURABLE

| Parámetro | TECHNO | LATINO | POP/ROCK | CHILL | Default |
|---|---|---|---|---|---|
| `ambientAttackMs` | **30** (instantáneo) | 65 | 80 | **400** (lento) | 800 |
| `ambientReleaseMs` | **120** (corte brutal) | 135 | 300 | **1200** (oceánico) | 10000 |
| `ambientMidWeight` | 0 (solo subBass) | 0 | **0.50** (guitarras) | 0 | 0 |
| `ambientGain` | 1.35 (default) | **2.5** | **2.0** | 1.35 | 1.35 |
| `ambientCrushExponent` | 2.0 (default) | **1.3** (menos compresión) | 2.0 | 2.0 | 2.0 |
| `ambientOutputExponent` | 1.3 (default) | **1.1** (más lineal) | 1.3 | 1.3 | 1.3 |

### Características
- **Sin `LiquidEnvelope`**, pero **con EMA dual** (attack/release separados, configurables por perfil).
- **Triple stage de shaping:** crush exponent → gain → output exponent.
- **Fade suave en valores bajos** (anti-flicker para Tungsten).
- **NO gateado por `recoveryFactor`** — el ambient respira independientemente del AGC rebound.
- **WAVE 4812 M2:** Se alimenta exclusivamente de `subBass` (+ `mid × ambientMidWeight` para rock).
- **Es la zona más parametrizada** del motor — 6 parámetros configurables vs 0 de `floor`/`air`.

### Routing
Ambos motores (`LiquidEngine41`, `LiquidEngine71`) pasan `ambientIntensity` directo del `ProcessedFrame`.

---

## 11. Zona `unassigned` — Sin Asignar

### Comportamiento en `selectZoneFromResult()` <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\adapters\zoneUtils.ts" lines="201-205" />
```typescript
case 'unassigned':
case 'center':
case 'mid':
  return result.ambientIntensity   // fallback al ambient
```

### Características
- **No tiene cálculo propio en el LiquidEngine.** No existe `unassignedIntensity` en `LiquidStereoResult`.
- **Fallback a `ambientIntensity`** — una fixture sin zona asignada recibe el wash ambiental.
- **Filosofía:** "Si no sabes dónde va, que respire con la sala."
- **`normalizeZone()`** en `ShowFileV2.ts` mapea CUALQUIER string no reconocido a `'unassigned'` <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\stage\ShowFileV2.ts" lines="477-528" /> — nunca crashea.

### En `ZoneRouter.ts` (legacy HAL) <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\mapping\ZoneRouter.ts" lines="355-362" />
```typescript
config.set('UNASSIGNED', {
  respondsTo: 'ambient',
  physics: { type: 'PAR', decayMultiplier: 1.0, colorRole: 'primary' },
  gateThreshold: 0.30,
  gainMultiplier: 1.0,
  maxIntensity: 0.60,
})
```
El `ZoneRouter` legacy le da config propia (gate 0.30, max 0.60), pero **esta config no se usa en el path del LiquidEngine** — solo en paths legacy pre-Omniliquid.

---

## 12. Resumen de Brechas y Propuestas

### Brecha 1: `center` no recibe strobes (BUG CRÍTICO)
**Problema:** `selectZoneFromResult()` mapea `case 'center'` a `ambientIntensity`, no a `strobeActive/strobeIntensity`. Las fixtures zoned como `center` en ShowFileV2 no reciben los strobes del motor.
**Fix:** WAVE 7746.1 — separar `case 'center'` del grupo `unassigned` y mapearlo a strobe.

### Brecha 2: Nomenclatura trifurcada (strobe / flash / center)
**Problema:** 3 nombres para la misma zona generan confusión y bugs (Brecha 1 es consecuencia directa).
**Fix:** WAVE 7746 — unificar a `center` como nombre canónico. Renombrar campos en `LiquidStereoResult`.

### Brecha 3: `floor` y `air` sin parametría por género
**Problema:** `ambient` tiene 6 parámetros configurables; `floor` y `air` tienen 0. Un uplight en techno vs chill recibe la misma señal instantánea sin shaping.
**Propuesta:** WAVE 7747 — añadir `floorAttackMs`/`floorReleaseMs`/`floorGain` y `airAttackMs`/`airReleaseMs`/`airGain` a `ILiquidProfile`.

### Brecha 4: `hh_energy` dead wire (WAVE 7745)
**Problema:** `LiquidStereoInput.hh_energy` se transporta por 4 stages pero nunca se lee en `applyBands()`.
**Fix:** WAVE 7745 — HH Energy Adapter para Back L (propuesto en sección 4).

### Brecha 5: `unassigned` sin identidad en el LiquidEngine
**Problema:** `unassigned` es un fallback a `ambientIntensity` sin cálculo propio. El `ZoneRouter` legacy tiene config propia (gate 0.30, max 0.60) que se ignora en el path Omniliquid.
**Propuesta:** WAVE 7748 — decidir si `unassigned` debe tener su propio cálculo (ej: promedio de las 6 zonas clásicas) o mantener el fallback a ambient. El fallback actual es razonable pero debería ser explícito, no accidental.

---

## 13. Tabla Maestra — Las 9 Zonas y su Reflejo en el LiquidEngine

| # | Zona | `LiquidStereoResult` | Envelope | Parametría por género | Cálculo | ¿Reflejo completo? |
|---|---|---|---|---|---|---|
| 1 | `front` | `frontLeftIntensity` + `frontRightIntensity` | `envSubBass` + `envKick` | ✅ Completa (gate, decay, crush, squelch, boost, maxI) | Envelope process() | ✅ Sí |
| 2 | `back` | `backLeftIntensity` + `backRightIntensity` | `envHighMid` + `envSnare` | ✅ Completa + WAVE 8008 snare_energy adapter | Envelope process() + transient shaper | ✅ Sí (hh_energy pending WAVE 7745) |
| 3 | `floor` | `floorIntensity` | ❌ Sin envelope | ❌ Ninguna | Instantáneo: `(subBass×0.65 + lowMid×0.35) × recovery` | ⚠️ Parcial — sin shaping por género |
| 4 | `movers-left` | `moverLeftIntensity` | `envTreble` / `envVocal` (swap) | ✅ Completa | Envelope process() + cross-filter | ✅ Sí |
| 5 | `movers-right` | `moverRightIntensity` | `envVocal` / `envTreble` (swap) | ✅ Completa | Envelope process() + cleanMid | ✅ Sí |
| 6 | `center` ⚡ | `strobeActive` + `strobeIntensity` | ❌ Sin envelope (trigger binario) | ✅ Threshold + duration + noiseDiscount | `calculateStrobe()` + Güiro override | ❌ **BUG: `selectZoneFromResult()` mapea a ambient, no a strobe** |
| 7 | `air` | `airIntensity` | ❌ Sin envelope (EMA) | ❌ Ninguna (alphas hardcodeados) | EMA dual + soft-knee compression + 1.4x boost | ⚠️ Parcial — sin shaping por género |
| 8 | `ambient` | `ambientIntensity` | ❌ Sin envelope (EMA dual) | ✅ 6 parámetros (attack, release, midWeight, gain, crushExp, outputExp) | EMA dual + triple-stage crush/gain/output | ✅ Sí — la zona más parametrizada |
| 9 | `unassigned` | (fallback a `ambientIntensity`) | ❌ Sin envelope | ❌ Ninguna | Fallback en `selectZoneFromResult()` | ⚠️ Parcial — sin cálculo propio |

**Veredicto:** 4 de 9 zonas tienen reflejo completo con parametría por género (`front`, `back`, `movers-left`, `movers-right`). 1 zona tiene parametría completa sin envelope (`ambient`). 1 zona tiene parametría parcial pero BUG de routing (`center`). 3 zonas tienen reflejo parcial o sin parametría (`floor`, `air`, `unassigned`).

---

*Extensión WAVE 7744 completada. Auditoría read-only. No se modificaron archivos de código.*

---

# WAVE 7747 — THE TRIFASIC ZONE CONFLICT: GLOBAL AUDIT & MIGRATION STRATEGY

## 1. The Three Names — Semantic Divergence Map

The concept of "strobe" is fragmented across **three string literals** in the codebase:

| Literal | Layer | Role | Files |
|---|---|---|---|
| `'center'` | **Canonical schema** | The `CanonicalZone` in ShowFileV2 — used for fixture zoning, UI dropdowns, validation | `ShowFileV2.ts`, `ZoneLayoutEngine.ts`, `zoneUtils.ts`, `ZoneRouter.ts`, `zone-node-router.ts`, `SpatialRegistrar.ts`, `FixtureMatrix.tsx`, `ZoneLayer.tsx`, `useHephPreview.ts` |
| `'flash'` | **Aether/NodeGraph + .lfx effects** | The `aetherZone` assigned in the Fixture Forge, and the `zones[]` target in `.lfx` effect files | `ForgeAetherCellsTab.tsx`, `zoneUtils.ts` (case `'flash'`), `AetherUIProjector.ts`, **13 `.lfx` files** in `core/arsenal/builtins/` |
| `'strobe'` | **LiquidEngine + channel types** | The `LiquidStereoResult.strobeActive/strobeIntensity` fields and the `AetherChannelType = 'strobe'` | `LiquidStereoPhysics.ts`, `LiquidEngineBase.ts`, `FixtureDefinition.ts`, `DMXGovernorEvaluator.ts`, `NodeResolver.ts`, `oflTranslator.ts`, `FXTParser.ts` |

**The Architect mandates unifying everything under `'strobe'`.**

---

## 2. Type & Schema Audit — Where `'center'` and `'flash'` Are Explicitly Typed

### 2.1 `CanonicalZone` — The Root Type <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\stage\ShowFileV2.ts" lines="388-398" />

```typescript
export type CanonicalZone =
  | 'front' | 'back' | 'floor'
  | 'movers-left' | 'movers-right'
  | 'center'    // ← TARGET: rename to 'strobe'
  | 'air' | 'ambient' | 'unassigned'
```

**Downstream types that embed `CanonicalZone`:**

| Type | File | How it references `'center'` |
|---|---|---|
| `FixtureZone` | `ShowFileV2.ts:403` | `= CanonicalZone \| legacy strings` (includes `'CENTER'`, `'STROBES'` legacy) |
| `EffectZone` | `core/effects/types.ts:64` | `= CanonicalZone \| 'all' \| 'all-movers' \| ...` |
| `ZoneTarget` | `core/hephaestus/types.ts:324` | `= CanonicalZone \| 'all' \| 'all-pars' \| 'all-movers'` |
| `ZONE_LABELS` | `ShowFileV2.ts:455` | `Record<CanonicalZone, string>` — key `'center'` |
| `ZONE_COLORS` | `ZoneLayoutEngine.ts:34` | `Record<CanonicalZone, string>` — key `'center'` |
| `CANONICAL_ZONES` | `ShowFileV2.ts:440` | Array literal — includes `'center'` |

### 2.2 `ZoneId` (Aether) — Untyped string <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\types.ts" lines="55" />

```typescript
export type ZoneId = string   // ← No constraint — 'flash', 'center', anything
```

The Aether layer uses **untyped strings** for zones. `'flash'` appears as a free string literal in:
- `ICapabilityNode.aetherZone?: string` <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\forge\types.ts" lines="273" />
- The Forge UI dropdown <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\ForgeView\tabs\ForgeAetherCellsTab.tsx" lines="239" />
- `ATMOSPHERIC_ZONES` set in `AetherUIProjector.ts` <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\AetherUIProjector.ts" lines="52" />

### 2.3 `EffectType` — Unrelated `'flash'` (NOT a zone) <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\arbiter\types.ts" lines="452-454" />

```typescript
export type EffectType = 'strobe' | 'flash' | 'blinder' | 'pulse' | 'chase' | ...
```

**⚠️ IMPORTANT:** This `'flash'` is an **effect type** (single bright burst), NOT a zone. It appears in `PredictionEngine.ts`, `ColorProcessors.ts`, `EffectDreamSimulator.ts`. **This must NOT be renamed** — it's a different concept that happens to share the string. The migration targets ONLY the zone literal `'flash'`, not the effect type.

---

## 3. Serialization & Persistence Audit — The Danger Zone

### 3.1 Show Files (`.json` with FixtureV2[])

**Loader:** `ShowFileMigrator.ts` — migrates V1 → V2, calls `normalizeZone()` on every fixture zone <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\stage\ShowFileMigrator.ts" lines="32" />.

**`normalizeZone()`** <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\stage\ShowFileV2.ts" lines="477-529" /> is the **single chokepoint** for all zone string normalization. Its MAP currently includes:
```typescript
'strobes':       'center',
'stage-center':  'center',
'ceiling-center':'center',
'ceiling':       'center',
'center':        'center',
```

**⚠️ CRITICAL:** `normalizeZone()` does NOT have `'flash'` in its MAP. This means:
- A fixture with `zone: 'flash'` in a .json file → `normalizeZone('flash')` → `'unassigned'` (fallback).
- Show files saved by the Forge with `aetherZone: 'flash'` on channels → those channels get zoned as `'unassigned'` when routed through ZoneMapper.

### 3.2 Fixture Profiles (`.json` with nodeGraph)

Fixture profiles saved by the Fixture Forge store `aetherZone` as a free string in the node graph. The Forge UI dropdown offers `'flash'` as an option <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\ForgeView\tabs\ForgeAetherCellsTab.tsx" lines="235-245" />:

```html
<option value="">— zone —</option>
<option value="ambient">ambient</option>
<option value="air">air</option>
<option value="floor">floor</option>
<option value="flash">flash</option>        <!-- ← SAVED TO .json -->
<option value="front">front</option>
<option value="back">back</option>
<option value="movement">movement</option>   <!-- ← NOT a CanonicalZone either -->
<option value="dimmer">dimmer</option>       <!-- ← NOT a CanonicalZone either -->
<option value="unassigned">unassigned</option>
```

**Note:** The Forge dropdown also offers `'movement'` and `'dimmer'` which are NOT `CanonicalZone` values. These are Aether-internal zone concepts that flow through `normalizeZoneId()` in `zoneUtils.ts`, not through `normalizeZone()` in ShowFileV2.

### 3.3 `.lfx` Effect Files (13 files with `"flash"` in zones)

**Loader:** `LfxFileLoader.ts` — parses JSON, passes `zones[]` and `spatialZones[]` through **without normalization** <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\arsenal\LfxFileLoader.ts" lines="289-290, 403" />.

**Infected .lfx files** (all in `core/arsenal/builtins/`):

| File | Occurrences |
|---|---|
| `techno/wraht_of_the_titans.lfx` | 2 (zones + spatialZones) |
| `techno/red_surge.lfx` | 3 |
| `techno/machine_gun.lfx` | 3 |
| `techno/cyber_scanner.lfx` | 2 |
| `techno/ambient_strobe.lfx` | 2 |
| `techno/acid_sweep.lfx` | 2 |
| `techno/strobe_burst.lfx` | 1 (tag only) |
| `latin/divine_obliteration.lfx` | 4 |
| `latin/tidal_wave.lfx` | 2 |
| `latin/kitt_scanner.lfx` | 1 |
| `rock/power_chord.lfx` | 1 (tag only) |
| `rock/thunder_struck.lfx` | 1 (tag only) |

**Two categories of `'flash'` usage in .lfx:**
1. **Zone targeting** (`"zones": ["flash"]`, `"spatialZones": ["flash"]`) — these are the ones that need migration. ~25 occurrences.
2. **Tags** (`"tags": ["flash", ...]`) — these are metadata keywords, NOT zones. ~4 occurrences. **Must NOT be renamed** — they're search/discovery tags.

### 3.4 Where to Inject Backward-Compatibility Hooks

There are **two normalizers** that serve as chokepoints:

| Normalizer | File | Scope | Currently maps `'flash'`? |
|---|---|---|---|
| `normalizeZone()` | `ShowFileV2.ts:477` | Show files, fixtures, ZoneMapper | ❌ No — falls to `'unassigned'` |
| `normalizeZoneId()` | `zoneUtils.ts:31` | Aether/NodeGraph adapter path | ❌ No — passes through as `'flash'` |

**The migration strategy must inject the alias in BOTH normalizers:**

1. **`normalizeZone()` in `ShowFileV2.ts`** — add `'flash'` → `'strobe'` to the MAP. This covers ShowFile loading, ZoneMapper resolution, and all downstream routing.
2. **`normalizeZoneId()` in `zoneUtils.ts`** — add `case 'flash': return 'strobe'` to the switch. This covers the Aether adapter path (`selectZoneFromResult`).
3. **`LfxFileLoader.ts`** — optionally normalize zones at load time, OR rely on the downstream normalizers (preferred — single source of truth).

---

## 4. Routing & HAL Audit — Every Path That Relies on `'center'` or `'flash'`

### 4.1 `selectZoneFromResult()` — The Aether Bridge <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\adapters\zoneUtils.ts" lines="177-209" />

```typescript
switch (normalizeZoneId(nodeZone)) {
  case 'flash':                    // ← reads strobe
    return result.strobeActive ? (result.strobeIntensity || 1.0) : 0
  case 'unassigned':
  case 'center':                   // ← BUG: reads ambient, NOT strobe
  case 'mid':
    return result.ambientIntensity
}
```

**Two bugs in one function:**
- `case 'flash'` correctly reads `strobeActive/strobeIntensity` ✅
- `case 'center'` falls through to `ambientIntensity` ❌ (the WAVE 7744 bug)

### 4.2 `ZoneRouter.ts` (legacy HAL) <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\mapping\ZoneRouter.ts" lines="25-35, 304-353" />

Uses `PhysicalZone = 'STROBES' | 'CENTER' | ...` — SCREAMING_CASE legacy. Has separate configs for `'STROBES'` and `'CENTER'`:
```typescript
config.set('STROBES', { respondsTo: 'beat', gateThreshold: 0.80, ... })
config.set('CENTER',  { respondsTo: 'beat', gateThreshold: 0.80, ... })
```
Both are identical. The `mapAbstractToPhysical()` function maps `'center'` → `['FRONT_PARS', 'BACK_PARS']` (NOT to `'STROBES'` or `'CENTER'`!) — another bug.

**This is legacy HAL** — the Omniliquid Engine path doesn't use `ZoneRouter`. But it's still referenced by some code paths. Must be updated for consistency.

### 4.3 `LiquidEngineBase.calculateStrobe()` <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\physics\LiquidEngineBase.ts" lines="963-990" />

Produces `strobeActive` + `strobeIntensity` — the fields that the `'flash'`/`'center'`/`'strobe'` zone should consume. The field names `strobeActive`/`strobeIntensity` are already correct and don't need renaming (they describe the SIGNAL, not the ZONE).

### 4.4 `AetherUIProjector.ts` — Atmospheric classification <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\AetherUIProjector.ts" lines="52" />

```typescript
const ATMOSPHERIC_ZONES = new Set(['ambient', 'air', 'flash'])
```
Classifies `'flash'` as atmospheric. After rename, this becomes `['ambient', 'air', 'strobe']`. **Debatable:** strobes are impact, not atmospheric. This classification may need semantic review.

### 4.5 `zone-node-router.ts` — Canonical zone list <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\adapters\helpers\zone-node-router.ts" lines="207-230" />

```typescript
const canonicalZones: readonly EffectZone[] = [
  'front', 'back', 'center', 'floor', ...
]
```
Hardcoded list includes `'center'`. Must be renamed to `'strobe'`.

### 4.6 `SpatialRegistrar.ts` — Role assignment <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\ingestion\SpatialRegistrar.ts" lines="402, 652" />

```typescript
if (zone === 'front' || zone === 'center') return 'primary'
```
Uses `'center'` for role inference. Must be renamed to `'strobe'`.

### 4.7 `ZoneMapper.resolveZone()` — The .lfx routing path <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\zones\ZoneMapper.ts" lines="260-314" />

```typescript
const z = zone.toLowerCase().trim()   // target zone, NOT normalized
// ...
if (normalizeZone(f.zone) === z) return true   // fixture zone IS normalized
```

**⚠️ CRITICAL BUG:** The target zone `z` is lowercased but NOT passed through `normalizeZone()`. So:
- .lfx has `"zones": ["flash"]` → `z = 'flash'`
- Fixture has `zone: 'center'` → `normalizeZone('center') = 'center'`
- `'center' !== 'flash'` → **NO MATCH**

**Effects targeting `'flash'` in .lfx files currently DO NOT MATCH fixtures zoned as `'center'`.** This is a silent failure — the effect loads, runs, but affects zero fixtures. The `normalizeZone()` MAP needs `'flash' → 'strobe'` AND the `resolveZone()` function needs to normalize the TARGET zone too, not just the fixture zone.

---

## 5. UI & Drag-and-Drop Audit

### 5.1 Stage Constructor / Fixture Inspector (Erebus) <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\erebus\hud\FixtureInspector.tsx" lines="137-139" />

```tsx
{CANONICAL_ZONES.map(z => (
  <option key={z} value={z}>{z}</option>
))}
```
Iterates `CANONICAL_ZONES` — will automatically show `'strobe'` after the type rename. ✅ Zero changes needed.

### 5.2 Fixture Forge — Aether Cells Tab <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\ForgeView\tabs\ForgeAetherCellsTab.tsx" lines="235-245" />

**Hardcoded `<option>` list** — does NOT iterate `CANONICAL_ZONES`. Must manually change:
```tsx
<option value="flash">flash</option>
```
→
```tsx
<option value="strobe">strobe</option>
```

**Also:** This dropdown includes `'movement'` and `'dimmer'` which are NOT `CanonicalZone` values. The dropdown should be refactored to use `CANONICAL_ZONES` + Aether-specific extensions, but that's a separate cleanup.

### 5.3 Blueprint 2D — Zone Layer <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\erebus\blueprint2d\layers\ZoneLayer.tsx" lines="37, 54, 99" />

```typescript
'center': 'CENTER / FLASH / STROBE',   // ← already acknowledges all 3 names!
```
The display label already shows the trifurcation. After unification, this becomes `'strobe': 'STROBE'`.

### 5.4 Hephaestus Preview <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\HephaestusView\useHephPreview.ts" lines="132" />

```typescript
'center': { label: 'CTR', x: 0.5, y: 0.5 },
```
Key `'center'` → rename to `'strobe'`.

### 5.5 Fixture Matrix <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\hyperion\kinetics\FixtureMatrix.tsx" lines="127" />

```typescript
const PRIORITY: Record<string, number> = {
  'movers-left': 0, 'movers-right': 1, 'air': 2, 'center': 3, ...
}
```
Key `'center'` → rename to `'strobe'`.

### 5.6 Zone Layout Engine <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\hyperion\shared\ZoneLayoutEngine.ts" lines="40" />

```typescript
'center': '#FACC15',   // Amarillo blinder
```
Key `'center'` → rename to `'strobe'`. Also `ZONE_LAYOUT_2D` and `ZONE_LAYOUT_3D` records.

---

## 6. Complete Infection Map

### Layer 1: Type Definitions (3 files)

| File | Line(s) | What |
|---|---|---|
| `core/stage/ShowFileV2.ts` | 388-398 | `CanonicalZone` includes `'center'` |
| `core/stage/ShowFileV2.ts` | 403-430 | `FixtureZone` includes `'CENTER'`, `'STROBES'` legacy |
| `core/effects/types.ts` | 64-65 | `EffectZone = CanonicalZone \| ...` (inherits `'center'`) |
| `core/hephaestus/types.ts` | 324 | `ZoneTarget = CanonicalZone \| ...` (inherits `'center'`) |

### Layer 2: Constants & Maps (5 files)

| File | Line(s) | What |
|---|---|---|
| `core/stage/ShowFileV2.ts` | 440-450 | `CANONICAL_ZONES` array |
| `core/stage/ShowFileV2.ts` | 455-465 | `ZONE_LABELS` record |
| `core/stage/ShowFileV2.ts` | 488-526 | `normalizeZone()` MAP |
| `components/hyperion/shared/ZoneLayoutEngine.ts` | 34-44 | `ZONE_COLORS` record |
| `components/hyperion/shared/ZoneLayoutEngine.ts` | 50+ | `ZONE_LAYOUT_2D`, `ZONE_LAYOUT_3D` |

### Layer 3: Normalizers & Routing (4 files)

| File | Line(s) | What |
|---|---|---|
| `core/aether/adapters/zoneUtils.ts` | 31-101 | `normalizeZoneId()` switch |
| `core/aether/adapters/zoneUtils.ts` | 177-209 | `selectZoneFromResult()` switch |
| `core/aether/adapters/zoneUtils.ts` | 277-302 | `selectColorRoleFromZone()` switch |
| `core/zones/ZoneMapper.ts` | 260-314 | `resolveZone()` — target not normalized (BUG) |

### Layer 4: Aether / NodeGraph (4 files)

| File | Line(s) | What |
|---|---|---|
| `core/aether/resolver/AetherUIProjector.ts` | 52 | `ATMOSPHERIC_ZONES` set |
| `core/aether/adapters/helpers/zone-node-router.ts` | 210 | `canonicalZones` array |
| `core/aether/ingestion/SpatialRegistrar.ts` | 402, 652 | Role inference |
| `core/aether/ingestion/NodeExtractionPipeline.ts` | 657-658 | `aetherZone` → `normalizeZoneId()` |

### Layer 5: UI Components (5 files)

| File | Line(s) | What |
|---|---|---|
| `components/views/ForgeView/tabs/ForgeAetherCellsTab.tsx` | 239 | `<option value="flash">` |
| `components/views/erebus/blueprint2d/layers/ZoneLayer.tsx` | 37, 54, 99 | Display names + logic |
| `components/views/HephaestusView/useHephPreview.ts` | 132 | Zone layout positions |
| `components/hyperion/kinetics/FixtureMatrix.tsx` | 127 | Priority sort |
| `components/views/erebus/hud/FixtureInspector.tsx` | 137 | Uses `CANONICAL_ZONES` (auto-updates) |

### Layer 6: Legacy HAL (1 file)

| File | Line(s) | What |
|---|---|---|
| `hal/mapping/ZoneRouter.ts` | 25-35, 304-353, 220-233 | `PhysicalZone` + `mapAbstractToPhysical()` |

### Layer 7: Serialized Files (13+ .lfx files, unknown .json shows)

| File(s) | What |
|---|---|
| 13 `.lfx` files in `core/arsenal/builtins/` | `"zones": ["flash"]`, `"spatialZones": ["flash"]` |
| User fixture profiles (`.json`) | `aetherZone: "flash"` in nodeGraph |
| User show files (`.json`) | `zone: "center"` in fixtures |

---

## 7. Migration Strategy — Zero-Breakage Rename to `'strobe'`

### Phase 1: Normalizer Hooks (The Safety Net)

**Step 1.1:** In `normalizeZone()` (`ShowFileV2.ts:488`), add to the MAP:
```typescript
'flash':         'strobe',   // ← NEW: Aether/Forge legacy
'center':        'strobe',   // ← CHANGED: was 'center'
'strobes':       'strobe',   // ← CHANGED: was 'center'
'stage-center':  'strobe',   // ← CHANGED: was 'center'
'ceiling-center':'strobe',   // ← CHANGED: was 'center'
'ceiling':       'strobe',   // ← CHANGED: was 'center'
```

**Step 1.2:** In `normalizeZoneId()` (`zoneUtils.ts:42`), add to the switch:
```typescript
case 'flash':
case 'strobes':
case 'stage-center':
case 'ceiling-center':
case 'center':
  return 'strobe'    // ← CHANGED: was 'center'
```

**Step 1.3:** In `ZoneMapper.resolveZone()` (`ZoneMapper.ts:260`), normalize the TARGET zone before comparison:
```typescript
const z = normalizeZone(zone)   // ← CHANGED: was zone.toLowerCase().trim()
```
This fixes the silent .lfx routing bug where `'flash'` targets never matched `'center'` fixtures.

**After Phase 1:** All existing files with `'flash'` or `'center'` load and route correctly to `'strobe'`. Zero file corruption. This is the ONLY phase needed for backward compatibility.

### Phase 2: Type Rename (Compile-Time)

**Step 2.1:** In `CanonicalZone` (`ShowFileV2.ts:388`), replace `'center'` with `'strobe'`:
```typescript
export type CanonicalZone =
  | 'front' | 'back' | 'floor'
  | 'movers-left' | 'movers-right'
  | 'strobe'    // ← CHANGED: was 'center'
  | 'air' | 'ambient' | 'unassigned'
```

**Step 2.2:** Update `CANONICAL_ZONES` array, `ZONE_LABELS`, `ZONE_COLORS`, `ZONE_LAYOUT_2D`, `ZONE_LAYOUT_3D` — replace key `'center'` with `'strobe'`.

**Step 2.3:** Update `FixtureZone` legacy strings — `'CENTER'` and `'STROBES'` both map to `'strobe'` via normalizer (already handled by Phase 1).

**Step 2.4:** `tsc --noEmit` — fix all type errors where `'center'` was used as a literal. The compiler will find every occurrence.

### Phase 3: Code Updates (All Layers)

**Step 3.1:** `selectZoneFromResult()` (`zoneUtils.ts:177`) — merge `case 'flash'` and `case 'center'` into `case 'strobe'`:
```typescript
case 'strobe':
  return result.strobeActive ? (result.strobeIntensity || 1.0) : 0
case 'unassigned':
case 'mid':
  return result.ambientIntensity
```
This **fixes the WAVE 7744 bug** — `'center'` no longer falls through to ambient.

**Step 3.2:** `selectColorRoleFromZone()` (`zoneUtils.ts:277`) — add `case 'strobe': return 'accent'` (blinders are accent).

**Step 3.3:** `AetherUIProjector.ts` — `ATMOSPHERIC_ZONES` — remove `'flash'`, add `'strobe'` (or reconsider classification).

**Step 3.4:** `zone-node-router.ts` — `canonicalZones` array: replace `'center'` with `'strobe'`.

**Step 3.5:** `SpatialRegistrar.ts` — replace `zone === 'center'` with `zone === 'strobe'`.

**Step 3.6:** `FixtureMatrix.tsx` — PRIORITY record: replace `'center'` with `'strobe'`.

**Step 3.7:** `useHephPreview.ts` — zone layout: replace `'center'` with `'strobe'`.

**Step 3.8:** `ZoneLayer.tsx` (blueprint2d) — replace display name `'CENTER / FLASH / STROBE'` with `'STROBE'`, update `hasCenter` → `hasStrobe`.

**Step 3.9:** `ForgeAetherCellsTab.tsx` — replace `<option value="flash">flash</option>` with `<option value="strobe">strobe</option>`.

**Step 3.10:** `ZoneRouter.ts` (legacy) — update `PhysicalZone` and `mapAbstractToPhysical()`: map `'strobe'` → `['STROBES']` (or `['CENTER']` — they're identical).

### Phase 4: .lfx File Migration (Optional — Phase 1 covers this)

**Step 4.1:** Run a one-time script to replace `"flash"` with `"strobe"` in `zones[]` and `spatialZones[]` arrays across all 13 `.lfx` files. **Do NOT touch `"tags"` arrays** — `"flash"` as a tag is metadata, not a zone.

**Step 4.2:** Alternatively, leave the .lfx files as-is — Phase 1's normalizer hook handles `'flash' → 'strobe'` at load time. The .lfx files will work correctly without modification. Migration can happen lazily.

### Phase 5: User File Migration (Transparent)

**No action needed.** User show files (`.json`) with `zone: "center"` and fixture profiles with `aetherZone: "flash"` will be normalized at load time by the Phase 1 hooks. When the user next saves, the show file will be written with `zone: "strobe"` (if the save path uses `CanonicalZone` typing) or retained as-is (if the save path preserves the original string).

**Recommended:** Add a one-time silent migration in `ShowFileMigrator` that rewrites `'center'` → `'strobe'` and `'flash'` → `'strobe'` on next save. This is already the behavior of `normalizeZone()` — the migrator just needs to persist the normalized value.

---

## 8. Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| User .json files with `'flash'`/`'center'` fail to load | **Critical** | Phase 1 normalizer hooks — injected BEFORE any type changes |
| .lfx effects silently target zero fixtures (existing bug) | **High** | Phase 1.3 fixes `resolveZone()` target normalization |
| `EffectType = 'flash'` accidentally renamed | **High** | Migration targets ONLY zone literals, not effect types. Separate type in `arbiter/types.ts` |
| `'flash'` in .lfx tags array renamed | **Medium** | Phase 4 script must target only `zones[]`/`spatialZones[]`, NOT `tags[]` |
| `ZoneRouter.ts` legacy breaks | **Low** | Legacy path is not used by Omniliquid Engine. Update for consistency only |
| UI dropdowns show stale labels | **Low** | `CANONICAL_ZONES` iteration auto-updates. Hardcoded dropdowns (Forge) updated in Phase 3 |

---

## 9. Execution Order Summary

```
Phase 1 (Safety Net)     → 5 edits in 3 files. Zero breakage. All old files work.
Phase 2 (Type Rename)    → 1 edit in ShowFileV2.ts. tsc finds all references.
Phase 3 (Code Updates)   → ~10 edits across 8 files. Driven by tsc errors.
Phase 4 (.lfx Migration) → Optional. Script or lazy. 13 files.
Phase 5 (User Files)     → Transparent. No action needed.
```

**Phase 1 is the only mandatory phase for backward compatibility.** Phases 2-3 are the actual rename. Phase 4-5 are cleanup.

---

*WAVE 7747 audit complete. Read-only. No code modified. Awaiting directive to execute.*