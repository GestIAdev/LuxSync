Voy a rastrear las tres anomalías en paralelo. Necesito encontrar: el slider de Gain de la UI, el pipeline FFT, y el AGC.

Tengo los tres archivos clave. Voy a leer las partes que faltan: el `getInputGain` del orchestrator, el AGC del GodEarFFT, y el pipeline de bandas.

Tengo el panorama. Voy a leer las partes críticas del AGC del GodEar (el process del AGCTrustZone) y la sección donde se calculan las bandas pre-AGC.

Voy a leer `extractBandPower` y `scaleBandEnergyForVisual` para entender la escala (lineal vs dB).

Tengo todo el panorama. Aquí está el diagnóstico forense de las tres anomalías.

---

# DIAGNÓSTICO FORENSE — PRE-PROCESAMIENTO AUDIO Y AGC

## 1. AUDITORÍA DE GANANCIA (Slider al 100%)

### El slider es un multiplicador lineal, NO suma decibelios

`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\orchestrator\TitanOrchestrator.ts:1021-1025`

```ts
  setInputGain(gain: number): void {
    this.inputGain = Math.max(0, Math.min(2, gain))
    console.log(`[TitanOrchestrator] Input gain set to: ${this.inputGain}`)
  }
```

El slider está clampado a `[0, 2]`. Al 100% reporta `1.0` — multiplicador neutro. **No suma dB.** La multiplicación se aplica en TickEngine:

`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\orchestrator\tick\TickEngine.ts:361-365`

```ts
    if (this.audioPipeline.hasRealAudio) {
      bass = this.audioPipeline.lastAudioData.bass * this.inputGain
      mid = this.audioPipeline.lastAudioData.mid * this.inputGain
      high = this.audioPipeline.lastAudioData.high * this.inputGain
      energy = this.audioPipeline.lastAudioData.energy * this.inputGain
```

### ⚠️ HALLAZGO CRÍTICO: El gain se aplica DESPUÉS del FFT, no antes

El `inputGain` multiplica los valores **post-FFT** (`lastAudioData.bass/mid/high`). El pipeline es:

```
Audio samples → AutoGainProcessor (pre-FFT) → GodEarFFT → bands → lastAudioData → × inputGain → TickEngine
```

**El slider NO puede provocar clipping antes del FFT** porque se aplica después. El AGC pre-FFT (`AutoGainProcessor`) ya hizo su trabajo con `Math.tanh` (soft saturation, línea 137). Pero hay un problema distinto:

### ⚠️ El gain POST-FFT puede provocar "clipping visual" sin clipping espectral

Cuando `inputGain = 2.0` (slider al 200%) y `lastAudioData.high = 0.6`, el resultado es `1.2`. No hay clamp explícito en TickEngine — el valor viaja al transientStore y al espectroscopio como `1.2`. El canvas lo dibuja como `120%` de altura, pero el `interpolateTo32BandsInPlace` del Titan lo clamp a `1.0` (línea 93-94 del componente). **Resultado: saturación plana visual sin que el FFT haya clipado.**

Esto explica el síntoma 1: con techno minimal donde el AGC empuja los agudos a `targetRMS: 0.50` (ver sección 3), multiplicar por `inputGain` puede llevar las barras a techo plano.

---

## 2. ESCALADO DEL FFT

### Las bandas están en escala LINEAL (RMS), NO logarítmica (dB)

`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\workers\GodEarFFT.ts:879-894`

```ts
function extractBandPower(power: Float32Array, mask: Float32Array): number {
  let energy = 0;
  let weightSum = 0;

  for (let bin = 0; bin < power.length && bin < mask.length; bin++) {
    const weight = mask[bin];
    if (weight > 0.001) {
      energy += power[bin] * weight;
      weightSum += weight;
    }
  }

  if (weightSum > 0) {
    energy /= weightSum;
  }
```

El pipeline opera en **dominio de potencia** (`P_k = |X_k|²`) y extrae RMS con una sola `sqrt` al final. La salida es **RMS lineal 0.0-1.0**, no dB. No hay conversión `20 * log10(rms)` en ningún punto del path GodEar → transientStore → espectroscopio.

### ⚠️ HALLAZGO CRÍTICO: No existe compensación por octava (tilt)

No hay ningún factor de corrección espectral que atenúe agudos en función de la frecuencia. Los `targetRMS` del AGC por banda son:

`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\workers\GodEarFFT.ts:380-388`

```ts
const AGC_CONFIG = {
  subBass: { attackMs: 150, releaseMs: 50, targetRMS: 0.4, maxGain: 3.0 },
  bass: { attackMs: 120, releaseMs: 60, targetRMS: 0.45, maxGain: 2.5 },
  lowMid: { attackMs: 100, releaseMs: 80, targetRMS: 0.5, maxGain: 2.0 },
  mid: { attackMs: 80, releaseMs: 100, targetRMS: 0.55, maxGain: 3.0 },
  highMid: { attackMs: 60, releaseMs: 120, targetRMS: 0.55, maxGain: 3.5 },
  treble: { attackMs: 40, releaseMs: 150, targetRMS: 0.50, maxGain: 4.0 },
  ultraAir: { attackMs: 30, releaseMs: 180, targetRMS: 0.3, maxGain: 4.0 },
};
```

**Los `targetRMS` son casi planos de 20Hz a 16kHz** (0.4 → 0.45 → 0.5 → 0.55 → 0.55 → 0.50 → 0.3). No hay tilt de -3dB/octava ni nada similar. El AGC empuja cada banda hacia su target independientemente del contenido musical.

### Esto explica el síntoma 1 (saturación plana en medios/agudos con techno minimal)

Con techno minimal (kick + hi-hat, casi nada de mid), el AGC de `mid` y `highMid` ve `avgRMS ≈ 0.001` (silencio) → `targetGain = 0.55 / 0.001 = 550` → clamped a `maxGain: 3.0` → aplica `×3.0` al ruido de fondo del FFT. El ruido de fondo del FFT en bandas vacías no es cero — es el noise floor del Blackman-Harris window. Multiplicado por 3.0 + el `POST_FFT_LEGACY_EQ_GAIN = 1.44`, el noise floor se eleva a ~0.15-0.25 sostenido. **Eso es exactamente lo que se ve: barras planas al 25-50% en bandas donde no hay contenido musical.**

### El `POST_FFT_LEGACY_EQ_GAIN` es un multiplicador fijo, no un tilt

`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\workers\GodEarFFT.ts:409-414`

```ts
const AGC_HEADROOM = 1.25;
const AGC_TARGET_SCALE = 0.64;
const POST_FFT_LEGACY_EQ_GAIN = 2.25 * AGC_TARGET_SCALE; // 1.44
const POST_FFT_BAND_OUTPUT_CLAMP = AGC_HEADROOM;
```

Es un escalar global de `1.44` aplicado a TODAS las bandas por igual. No es un tilt. Es un "legacy EQ gain" para mantener compatibilidad con la V2 del FFT. No compensa el noise floor en agudos.

---

## 3. REINGENIERÍA DEL AGC

Hay **DOS AGCs** en el sistema, no uno. Ambos contribuyen al síntoma 3.

### AGC #1: AutoGainProcessor (pre-FFT, tiempo muestral)

`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\audio\AutoGainProcessor.ts`

`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\audio\AutoGainProcessor.ts:16-30`

```ts
const TARGET_DBFS = -18
const TARGET_LINEAR = Math.pow(10, TARGET_DBFS / 20)  // 0.12589...

const MIN_GAIN_DB = -12
const MAX_GAIN_DB = 24
const MIN_GAIN_LINEAR = Math.pow(10, MIN_GAIN_DB / 20)  // 0.25119...
const MAX_GAIN_LINEAR = Math.pow(10, MAX_GAIN_DB / 20)  // 15.8489...

const ATTACK_TIME_S = 0.2      // 200ms
const RELEASE_TIME_S = 2.0     // 2000ms
const RMS_WINDOW_S = 0.5       // 500ms
```

**Constantes:**
- Attack: **200ms** (ganancia sube lento)
- Release: **2000ms** (ganancia baja MUY lento)
- RMS Window: **500ms**
- Target: **-18 dBFS** (0.126 linear)
- Gain range: **-12dB a +24dB** (0.25× a 15.8×)

### ⚠️ LA VARIABLE QUE ASFIXIA: `currentGain` con release de 2 segundos

`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\audio\AutoGainProcessor.ts:106-121`

```ts
      let desiredGain: number
      if (rms < RMS_FLOOR) {
        // Signal is silence — hold current gain, don't pump
        desiredGain = this.currentGain
      } else {
        desiredGain = TARGET_LINEAR / rms
      }

      // Clamp to gain range
      if (desiredGain < MIN_GAIN_LINEAR) desiredGain = MIN_GAIN_LINEAR
      if (desiredGain > MAX_GAIN_LINEAR) desiredGain = MAX_GAIN_LINEAR

      // Apply envelope smoothing (one-pole filter)
      // Attack when gain goes UP, release when gain goes DOWN
      const alpha = (desiredGain > this.currentGain) ? atkAlpha : relAlpha
      this.currentGain += alpha * (desiredGain - this.currentGain)
```

**El problema:** Durante un drop (silencio de 1-2s), el RMS cae a ~0. El AGC calcula `desiredGain = TARGET_LINEAR / rms` → valor enorme → clamped a `MAX_GAIN_LINEAR = 15.8`. Pero el **attack es de 200ms**, así que `currentGain` sube lentamente hacia 15.8.

Cuando el transitorio del drop regresa (kick + bass de golpe), el RMS se dispara. Ahora `desiredGain = 0.126 / 0.5 = 0.25` (baja ganancia). Pero el **release es de 2000ms** — `currentGain` tarda 2 segundos en bajar de ~15.8 a 0.25. Durante esos 2 segundos, la señal se satura via `Math.tanh` (línea 137), perdiendo el primer transitorio.

**La variable matemática que mantiene la señal asfixiada es `this.currentGain`**, con `releaseAlpha = 1 - exp(-1 / (44100 * 2.0))` ≈ `1.14e-5`. Eso significa que por muestra, el gain solo baja un 0.00114%. Tras 1 segundo (44100 muestras), el gain ha bajado solo un ~5% de su diferencia. **No recupera hasta pasados ~6 segundos.**

### AGC #2: AGCTrustZone (post-FFT, por banda)

`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\workers\GodEarFFT.ts:1594-1683`

**Constantes por banda (líneas 380-388):**

| Banda | Attack | Release | targetRMS | maxGain |
|---|---|---|---|---|
| subBass | 150ms | 50ms | 0.40 | 3.0× |
| bass | 120ms | 60ms | 0.45 | 2.5× |
| lowMid | 100ms | 80ms | 0.50 | 2.0× |
| mid | 80ms | 100ms | 0.55 | 3.0× |
| highMid | 60ms | 120ms | 0.55 | 3.5× |
| treble | 40ms | 150ms | 0.50 | 4.0× |
| ultraAir | 30ms | 180ms | 0.30 | 4.0× |

### ⚠️ LA VARIABLE QUE ASFIXIA: `gains[bandId]` con historyLength=20 (~1s)

`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\workers\GodEarFFT.ts:1633-1671`

```ts
    // Update RMS history — circular buffer with rolling sum (zero-allocation)
    const histBuf = this.rmsHistory[bandId];
    const histIdx = this.rmsHistoryIndex[bandId];
    const evicted = histBuf[histIdx];
    histBuf[histIdx] = rawValue;
    this.rmsHistoryIndex[bandId] = (histIdx + 1) % this.historyLength;
    this.rmsHistorySum[bandId] += rawValue - evicted;
    ...
    
    // Calculate average RMS over history
    const avgRMS = this.rmsHistorySum[bandId] / this.rmsHistoryCount[bandId];
    
    // Calculate target gain
    let targetGain = 1.0;
    if (avgRMS > 0.001) {
      targetGain = config.targetRMS / avgRMS;
      targetGain = Math.min(targetGain, config.maxGain);
      targetGain = Math.max(targetGain, 0.1);
    }
    
    // Smooth gain change (attack/release asymmetry)
    const currentGain = this.gains[bandId] || 1.0;
    const gainDiff = targetGain - currentGain;
    
    let smoothingTime: number;
    if (gainDiff > 0) {
      smoothingTime = config.attackMs;   // ← gain sube: attack lento
    } else {
      smoothingTime = config.releaseMs;  // ← gain baja: release
    }
    
    const alpha = Math.min(1.0, deltaMs / smoothingTime);
    const newGain = currentGain + gainDiff * alpha;
```

**El problema:** El `historyLength = 20` (~1 segundo a 20fps) mantiene el `avgRMS` artificialmente alto durante 1 segundo después de que la señal desaparezca. Cuando llega el drop:

1. **Durante el drop** (silencio): `rawValue ≈ 0.001` entra al buffer, pero los 19 valores anteriores (con audio) siguen promediando ~0.4. El `avgRMS` se mantiene alto → `targetGain = 0.55 / 0.4 = 1.375` → gain estable.
2. **Cuando regresa el transitorio**: el `avgRMS` todavía tiene valores viejos altos → `targetGain` se mantiene bajo → el gain aplicado es insuficiente → **el primer transitorio llega atenuado**.
3. Solo después de ~20 frames (~1s) el buffer se purga de valores viejos y el `avgRMS` refleja la realidad.

**La variable matemática es `this.rmsHistorySum[bandId]`** — el rolling sum del buffer circular. Tarda 20 frames en purgar el contenido del drop. Combinado con el `attackMs` lento (80-150ms para med/bass), el gain tarda 0.5-1.5s en re-subir. **Eso es exactamente la latencia de 0.5s-1.5s reportada.**

### Inversión conceptual: attack vs release

Hay una **inversión semántica** en ambos AGCs que agrava el problema:

- **AutoGainProcessor** (línea 120): `attack` = gain sube (200ms lento), `release` = gain baja (2000ms lentísimo). Esto es correcto para un compresor pero **invertido para un AGC** — un AGC debería atacar rápido (bajar gain cuando hay señal fuerte) y liberar lento (subir gain cuando hay silencio). Aquí al revés: sube lento, baja lentísimo.

- **AGCTrustZone** (líneas 1661-1667): `attack` = gain sube (lento), `release` = gain baja (rápido). Mismo problema — cuando el transitorio regresa tras un drop, el gain necesita subir, pero el attack es lento (80-150ms). El release rápido hace que el gain baje en 50-100ms cuando hay señal fuerte, pero subir tarda 3× más.

---

## RESUMEN DE LAS TRES ANOMALÍAS

| # | Síntoma | Causa raíz | Archivo:Línea | Variable culpable |
|---|---|---|---|---|
| 1 | Saturación plana en medios/agudos con techno minimal | AGC empuja noise floor del FFT hacia targetRMS (0.50-0.55) con maxGain 3.0-4.0×, sin tilt por octava | `GodEarFFT.ts:380-388` | `AGC_CONFIG[band].targetRMS` + `maxGain` |
| 2 | Gain UI altera rango dinámico | `inputGain` se aplica POST-FFT como multiplicador lineal sin clamp, puede llevar valores >1.0 al transientStore | `TickEngine.ts:362-365` | `this.inputGain` (multiplicador post-bands) |
| 3 | Latencia AGC 0.5-1.5s tras drops | Release de 2000ms (AutoGain) + historyLength=20 (~1s) del AGCTrustZone + attack lento (80-150ms) impiden recuperar gain a tiempo | `AutoGainProcessor.ts:25` + `GodEarFFT.ts:1601` | `RELEASE_TIME_S=2.0` + `historyLength=20` |

Los tres puntos están listos para diseñar la solución. No he generado código de refactor — queda pendiente tu decisión sobre cómo abordar cada uno.