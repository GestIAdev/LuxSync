Let me read the key pipeline files to trace the full gain chain.

Now let me find the `GodEarAnalyzer` class and the main `analyze` method that ties everything together, especially where the input buffer is received and processed:

Now let me trace where the audio buffer comes from before reaching `analyze()`. Let me check the `AudioPipelineManager` and the worker message handler:

Now let me find where the input gain is applied to the buffer. Let me search for `getInputGain` usage and the worker that processes audio:

Now let me find where the raw audio buffer is captured and where the manual gain is applied to the Float32 buffer before it reaches the FFT worker:

Now let me check the SensesPipeline (worker path) and the VirtualWire/USBDirectLink providers to see if any gain is applied to the raw buffer before FFT:

Let me find where `GodEarAnalyzer.analyze` is called — that's the path producing harshness/flatness/strobe that feeds Selene:

Now let me check the omni path providers (VirtualWire/USBDirectLink) and the harshness calculation:

Now let me find the `harshness` calculation:

Let me find where `harshness` is actually computed in the SpectrumAnalyzer:

Let me check the VirtualWireProvider for AGC:

Let me read the LegacyBridgeProvider headroom limiter:

Let me check the Mission Control dashboard for the gain slider default value:

Let me check the audioStore default:

Let me find the `whiteNoiseScore` computation:

I now have the complete picture of the audio gain staging. Here is the audit report.

---

# WAVE 7741 — Audio Gain Staging Audit: Diagnostic Report

## 1. Audio Input Sources

The system has **three disjoint input paths**, each with different gain staging:

| Path | Source | Provider | AGC System | Hard Clipper |
|------|--------|----------|------------|--------------|
| **A — Microphone/Loopback** | WebAudio `getUserMedia` | `LegacyBridgeProvider` | None pre-FFT; `AGCTrustZone` post-FFT | Browser clips at ±1.0; `applyMicHeadroom` scales if peak > 0.85 |
| **B — USB/ASIO Console** | Native addon (WASAPI Exclusive) | `USBDirectLinkProvider` | `AutoGainProcessor` (WAVE 3402) pre-FFT | Hard clamp to [-1.0, 1.0] inside AGC |
| **C — Virtual Wire** | WASAPI Loopback | `VirtualWireProvider` | None pre-FFT (intentionally raw) | None — signal arrives CRUDA to SAB |

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\audio\USBDirectLinkProvider.ts" lines="1-14" />

## 2. The Manual GAIN Slider

**Default value: `1.0` (100%)** — NOT 20% as the Architect suspected.

- `audioStore.ts` line 75: `inputGain: 1.0` <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\stores\audioStore.ts" lines="74-76" />
- `ConfigManagerV2.ts` line 161: `inputGain: 1.0` <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\config\ConfigManagerV2.ts" lines="158-162" />
- `ShowFileV2.ts` line 1266: `inputGain: 1.0` <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\stage\ShowFileV2.ts" lines="1263-1267" />
- `TitanOrchestrator.ts` line 273: `private inputGain = 1.0` <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\orchestrator\TitanOrchestrator.ts" lines="272-273" />
- `WorkerProtocol.ts` line 403: `inputGain: 1.0` <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\workers\WorkerProtocol.ts" lines="402-404" />

The slider in `SystemsCheck.tsx` has range **0.1 to 4.0** (step 0.05) <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\DashboardView\components\SystemsCheck.tsx" lines="831-838" />, but `TitanOrchestrator.setInputGain` clamps to **[0, 2]** <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\orchestrator\TitanOrchestrator.ts" lines="1022-1024" />. So the UI allows 400% but the backend caps at 200%.

### Where the manual gain is applied — CRITICAL FINDING

The manual `inputGain` is **NEVER applied to the raw Float32 buffer before FFT**. It is applied in two completely different places, both POST-FFT:

**Path A (Microphone/Frontend):** Applied in `TickEngine` to the **band energies** (bass/mid/high/energy), not to the time-domain samples <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\orchestrator\tick\TickEngine.ts" lines="360-363" />:
```typescript
bass = this.audioPipeline.lastAudioData.bass * this.inputGain
mid = this.audioPipeline.lastAudioData.mid * this.inputGain
high = this.audioPipeline.lastAudioData.high * this.inputGain
energy = this.audioPipeline.lastAudioData.energy * this.inputGain
```
This means the manual gain **CANNOT cause time-domain clipping** on the microphone path — the FFT has already run on the raw buffer before the gain touches anything.

**Path B (Worker/SensesPipeline):** Applied to the snapshot **AFTER** the FFT and **AFTER** the WAVE 670 AGC <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\senses\pipeline\SensesPipeline.ts" lines="115-123" />:
```typescript
// Step 3: FFT sobre audio CRUDO (sin AGC)
const spectrum = this.spectrumAnalyzer.analyze(snapshot, this.sampleRate);
// Step 4: AGC + InputGain
const agcResult = agc.processBuffer(snapshot);
if (this.inputGain !== 1.0) {
  for (let i = 0; i < snapshot.length; i++) {
    snapshot[i] *= this.inputGain;
  }
}
```
Again, the FFT at Step 3 runs on the RAW snapshot. The `inputGain` at Step 4 mutates the snapshot for downstream consumers (UI/Wave8), but the spectrum (and thus `harshness`/`flatness`/`whiteNoiseScore`) is already computed from un-gained audio.

**Conclusion:** The manual GAIN slider is **NOT the source of digital clipping** that would corrupt the FFT. The Architect's suspicion of a "20% UI offset" is unfounded — the default is 100%, and even at 200% the gain never touches the pre-FFT buffer.

## 3. The Three AGC Systems

### AGC #1: `AutoGainProcessor` (WAVE 3402) — USB path ONLY, PRE-FFT

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\audio\AutoGainProcessor.ts" lines="1-30" />

- **Target:** -18 dBFS (0.12589 linear)
- **Gain range:** -12 dB to +24 dB (0.25x to 15.85x linear)
- **Attack:** 200ms / **Release:** 2000ms
- **RMS window:** 500ms
- **Hard clamp:** `if (output > 1.0) output = 1.0; if (output < -1.0) output = -1.0` <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\audio\AutoGainProcessor.ts" lines="123-127" />

**THIS IS THE PRIMARY CLIPPING RISK.** When a USB console feeds a quiet signal (e.g. -30 dBFS), the AGC can boost by up to +24dB (15.85x). If the music suddenly gets loud, the 200ms attack is too slow to back off, and the hard clamp at ±1.0 engages — **digital clipping**. This generates harmonic distortion that spreads energy across FFT bins, inflating `flatness` and `whiteNoiseScore`.

**Can it be disabled?** No. There is no bypass flag. The `USBDirectLinkProvider` unconditionally instantiates and processes through it <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\audio\USBDirectLinkProvider.ts" lines="296-308" />.

### AGC #2: `AutomaticGainControl` (WAVE 670) — Worker path, POST-FFT

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\workers\utils\AutomaticGainControl.ts" lines="1-28" />

- **Target RMS:** 0.25 (moderate level)
- **Max gain:** configurable, default ~8x
- Applied to the snapshot AFTER the FFT has already run <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\senses\pipeline\SensesPipeline.ts" lines="116-117" />

This AGC normalizes the buffer for UI/Wave8 consumption. It does NOT feed back into the FFT spectrum, so it cannot cause clipping artifacts in `harshness`/`flatness`. **Not a clipping risk for the AI path.**

### AGC #3: `AGCTrustZone` (GodEar internal) — POST-FFT, per-band

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\workers\GodEarFFT.ts" lines="342-350" />

- 7 independent per-band gain controllers
- **Max gains:** subBass 3.0x, bass 2.5x, mid 3.0x, highMid 3.5x, treble 4.0x, ultraAir 4.0x
- **Target RMS per band:** 0.30–0.55
- Applied AFTER band extraction, on the scaled band values <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\workers\GodEarFFT.ts" lines="2310-2318" />
- Output clamped to `POST_FFT_BAND_OUTPUT_CLAMP = 1.25` <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\workers\GodEarFFT.ts" lines="1643-1644" />

This AGC operates on band energies (RMS values 0-1), not on time-domain samples. It **cannot cause time-domain clipping**, but it CAN inflate the `treble` and `ultraAir` bands by up to 4x, which directly affects `harshness` (since `harshness = psycho.highMid`). **Can be disabled:** `analyzer.configure({ useAGC: false })` — and this IS done for offline analysis <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\chronos\analysis\analysisPipeline.ts" lines="263-264" />, but NOT for the live SensesPipeline path.

## 4. Clipping & Normalization Map

### Pre-FFT clippers (can cause harmonic distortion in the spectrum):

| Location | Mechanism | When it fires |
|----------|-----------|---------------|
| Browser WebAudio | `AnalyserNode.getFloatTimeDomainData()` returns samples already clamped to [-1.0, 1.0] by the browser | Mic/loopback path — always |
| `LegacyBridgeProvider.applyMicHeadroom` | If peak > 0.85, scales entire buffer to 0.72 target | Mic path — only on hot signals |
| `AutoGainProcessor.process` | Hard clamp `if (output > 1.0) output = 1.0` | USB path — when AGC boost + source signal exceeds ±1.0 |

### Post-FFT clippers (affect band energies, not the spectrum shape):

| Location | Mechanism |
|----------|-----------|
| `scaleBandEnergyForVisual` | `Math.min(POST_FFT_BAND_OUTPUT_CLAMP, scaled)` = clamp to 1.25 <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\workers\GodEarFFT.ts" lines="816-823" /> |
| `AGCTrustZone.process` | `Math.min(POST_FFT_BAND_OUTPUT_CLAMP, rawValue * gain)` <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\workers\GodEarFFT.ts" lines="1643-1644" /> |

## 5. How Clipping Affects `harshness`, `flatness`, and `whiteNoiseScore`

### `harshness`
Defined as `psycho.highMid` — the psychoacoustically-scaled 2-6kHz band energy <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\senses\spectrum\SpectrumAnalyzer.ts" lines="182-184" />. This is NOT a clipping detector; it's just a band level. Clipping harmonics DO land in this range (3rd-5th harmonics of bass frequencies), so clipping would inflate `harshness`, but so would any bright sound.

### `flatness` (Wiener Entropy)
<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\workers\GodEarFFT.ts" lines="925-959" />

Measures how uniformly energy is distributed across bins. **This IS the primary clipping artifact vector:**
- Clean tonal music: flatness 0.01-0.09 (energy concentrated in harmonic peaks)
- Clipping generates intermodulation distortion → energy fills the gaps between harmonics → flatness rises toward 0.16-0.36 (percussive range) or higher
- White noise: flatness → 1.0

### `whiteNoiseScore`
<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\workers\GodEarFFT.ts" lines="2404-2405" />
```typescript
const whiteNoiseScore = Math.max(0, Math.min(1, (flatness - FLATNESS_OFFSET) / FLATNESS_SCALE));
// FLATNESS_OFFSET = 0.10, FLATNESS_SCALE = 0.10
```
Saturates at flatness 0.20. So if clipping pushes flatness from 0.05 (clean) to 0.20+ (clipped), `whiteNoiseScore` goes from 0 to 1.0 — telling the AI the signal is "100% white noise."

### Strobe Engine — **DISABLED**
<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\workers\GodEarFFT.ts" lines="2414-2420" />
```typescript
// DESIGN DECISION: Strobe via FFT permanently disabled to avoid visual noise and
// hardware desync on double-kicks/fast BPMs. Strobe responsibility is deferred to
// Selene's cognitive layer pending future precise calibration.
const strobeState = { active: false, rateHz: 0, duty: 0, drive: 0 };
```
The `StrobeEngine.process()` call is commented out. **The FFT pipeline is NOT firing strobes.** If inappropriate strobes are occurring, they originate from Selene's cognitive layer reading `whiteNoiseScore`, `transientDensity`, and `spectralFlux` from the photon block — not from the GodEar strobe engine itself.

## 6. The Clipping → False Chaos Chain

The complete causal chain for the Architect's suspected bug:

```
USB console quiet signal (-30 dBFS)
  → AutoGainProcessor boosts +24dB (15.85x)
  → Music gets loud → attack too slow (200ms) to back off
  → Hard clamp at ±1.0 ENGAGES → digital clipping
  → Clipping generates intermodulation distortion
  → FFT sees energy spread across ALL bins (not just harmonic peaks)
  → calculateSpectralFlatness returns 0.20+ instead of 0.05
  → whiteNoiseScore = (0.20 - 0.10) / 0.10 = 1.0 (saturated)
  → photon.whiteNoiseScore = 1.0 → Selene AI reads "100% white noise / chaos"
  → Selene fires strobe / aggressive patterns
```

**This ONLY happens on the USB DirectLink path.** The microphone path has no pre-FFT AGC (the browser's own AGC is disabled via `autoGainControl: false` in `useLiveAudioInput.ts` line 328). The Virtual Wire path intentionally passes raw signal.

## 7. Proposed Clean Architecture

### Problem 1: `AutoGainProcessor` hard clipper destroys dynamics

**Fix:** Replace the hard clamp with a **soft clipper** (tanh saturation) that gracefully approaches the ceiling without generating the sharp spectral splatter of a hard limiter:

```typescript
// In AutoGainProcessor.process(), replace:
//   if (output > 1.0) output = 1.0
//   if (output < -1.0) output = -1.0
// with:
output = Math.tanh(output)  // soft saturation — no spectral splatter
```

Additionally, add a **look-ahead limiter** (even 5ms) so the AGC can begin reducing gain BEFORE the peak arrives, preventing the clip entirely. The current 200ms attack is 40x too slow for transient peaks.

### Problem 2: No bypass for `AutoGainProcessor`

**Fix:** Add a `bypass` flag to `USBDirectLinkProvider` config. Many USB consoles already output at line level (-18 to -10 dBFS) and don't need AGC. Let the operator disable it from Mission Control:

```typescript
// In USBDirectLinkProvider.handleAudioData:
if (this.autoGain && !this.config.bypassAGC) {
  this.autoGain.process(gainInput)
}
```

### Problem 3: `whiteNoiseScore` is vulnerable to clipping artifacts

**Fix:** Add a **clipping detector** that gates `whiteNoiseScore` when samples are pegged at ±1.0:

```typescript
// In GodEarAnalyzer.analyze(), after Stage 0 (input buffer copy):
let clippedSamples = 0
for (let i = 0; i < copyLen; i++) {
  const s = this.inputBuffer[i]
  if (s >= 0.999 || s <= -0.999) clippedSamples++
}
const clipRatio = clippedSamples / copyLen
// ...later, when computing whiteNoiseScore:
const whiteNoiseScoreGated = clipRatio > 0.01
  ? whiteNoiseScore * (1 - clipRatio)  // suppress when clipping detected
  : whiteNoiseScore
```

This way, even if clipping occurs, the AI doesn't misinterpret the distortion products as genuine broadband noise.

### Problem 4: `AGCTrustZone` inflates `harshness` band

The per-band AGC can boost `highMid` (the `harshness` proxy) by up to 3.5x. On the live path this is always active. Consider disabling AGC for the `highMid`/`treble`/`ultraAir` bands specifically, since these are the ones that feed `harshness` and `whiteNoiseScore`, and let the natural dynamics through:

```typescript
// In AGC_CONFIG, for high-frequency bands:
highMid:  { attackMs: 60, releaseMs: 120, targetRMS: 0.55, maxGain: 1.0 },  // was 3.5
treble:   { attackMs: 40, releaseMs: 150, targetRMS: 0.50, maxGain: 1.0 },  // was 4.0
ultraAir: { attackMs: 30, releaseMs: 180, targetRMS: 0.3,  maxGain: 1.0 },  // was 4.0
```

This preserves the AGC's value for bass/mid bands (where level normalization matters for DMX) while preventing the high-frequency inflation that corrupts the AI's chaos assessment.

---

**Summary:** The manual GAIN slider (default 1.0, max 2.0) is innocent — it never touches the pre-FFT buffer. The real clipping risk is `AutoGainProcessor` on the USB path, which can boost +24dB then hard-clip, generating spectral flatness inflation that the AI interprets as "high chaos." The strobe engine itself is disabled, so any false strobes come from Selene's cognitive layer reading the corrupted `whiteNoiseScore`.