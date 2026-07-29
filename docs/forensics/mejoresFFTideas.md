1. Superando el "Muro de Sonido" (Prydz Drops y Compresión Masiva)
En los drops de progressive house o trance épico, el nivel de energía global de la mezcla se dispara y se mantiene plano debido al limitador del máster. Los detectores basados en ratios de energía (ENERGY_RATIO_THRESHOLD) sufren porque el umbral de silencio ya no existe; todo suena fuerte.

Implementación de Espectro de Flujo (Spectral Flux) o Novedad de Fase: En lugar de mirar solo cuánta energía sube en una banda, mediremos el cambio en la tasa de cambio (derivada de la magnitud y fase entre frames consecutivos).

Por qué funciona en el muro de sonido: Incluso cuando un muro de sintetizadores y sub-graves comprime el RMS al 100%, el inicio de un golpe de bombo o un cambio de acordes introduce una discontinuidad de fase y un pico de alta frecuencia abrupto que el Spectral Flux detecta de inmediato, ignorando la saturación de fondo.

2. Resolución de Pop/Rock y Ghost Notes (Baterías Acústicas)
El pop/rock no es una onda cuadrada predecible; tiene dinámicas muy sutiles, notas fantasmas en la caja, y acentos de platillos que interfieren con el bombo.

Separación Multi-Banda con Envolventes Asimétricas (Attack/Release adaptativo): Aprovechando los filtros LR4 ya existentes, podemos aislar el canal sub-bass (<80Hz) y la zona de ataque de la caja (2kHz - 5kHz). Al aplicar un seguidor de envolvente con un ataque ultrarrápido (1-3ms) y un release moderado (40-80ms) en lugar de un buffer circular simple, evitamos que los rebotes del bombo o los ecos de la sala creen falsos positivos en los tempos de rock clásico o baladas.

Supresión de Fuga de Platillos: Filtrar armónicos altos en el canal de graves para evitar que un crash de batería dispare un falso beat en el canal de luces del escenario.

3. Cosecha de Ciclos de CPU: Liquidando la Deuda Técnica de GodEarFFT.ts
Para poder inyectar algoritmos avanzados de Spectral Flux o envolventes complejas en el Worker sin sobrepasar el presupuesto de 2ms, necesitamos liberar los ciclos de CPU que el re-audit confirmó siguen pendientes:

Tablas de Búsqueda (LUT) para Twiddle Factors: Pre-calcular los senos y cosenos en el constructor para evitar llamadas repetitivas a Math.cos/Math.sin en cada mariposa del Radix-2. Esto reducirá el coste computacional del FFT bruto en un 25-30%.

Eliminación definitiva del Math.sqrt por Bin: Sustituir el cálculo de magnitud en bucle caliente por el espectro de potencia (re² + im²) en la fase de análisis interno, reservando la raíz cuadrada estrictamente para el cálculo final de energía donde visualmente se requiera, eliminando 2049 llamadas innecesarias por frame.

4. Co-procesamiento Predictivo para Mapeo de Escenario (Aether/WAVE)
Fusión con el 1D Kalman y el Autocorrelacionador: Ya que IntervalBPMTracker cuenta con un filtro de Kalman y validación por autocorrelación, podemos alimentar de forma predictiva los motores de iluminación volumétrica (Moving Heads). Cuando un tema sufre un breakdown donde la percusión desaparece por completo (típico puente en canciones de pop o intros largas de Prydz), el sistema no debe congelarse ni volverse errático: el Kalman debe mantener la interpolación de fase ("freewheel") de forma totalmente transparente para que los haces de luz sigan latiendo al tempo interno hasta que entra el drop.

------------------------------
------------------------------------------------------------

Let me review the exact current implementations of the functions I'll be proposing changes to:
Now let me read the [computeFFTCore](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:448:0-509:1) and [computeMagnitudeSpectrum](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:511:0-534:1) implementations in [GodEarFFT.ts](cci:7://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:0:0-0:0):

Now let me check [extractBandEnergy](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:665:0-691:1) to understand the sqrt-then-square pattern:

I now have all the context needed. Here's the complete technical design document:

---

# 🔬 RESPUESTA DIRECTIVA P2P — Motor Sensorial LuxSync: Fase Óptima

**De:** GLM (Agente de Repositorio)
**Para:** Arquitecto DSP Senior / Gemini
**Estado:** Propuesta técnica — 0 ejecución de código

---

## 1. MITIGACIÓN DEL MURO DE SONIDO — Spectral Flux Normalizado

### Problema

El [SlopeBasedOnsetDetector](cci:2://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:1140:0-1199:1) actual opera sobre energía agregada por banda (`rawBands.subBass + rawBands.bass * 0.5`). Cuando un limitador brickwall comprime el máster al 100%, el RMS global se satura y los ratios `current - previous` colapsan porque el "techo" no permite subidas adicionales. El detector se vuelve ciego.

### Solución: Spectral Flux Normalizado con Rectificación de Media

El Spectral Flux mide el cambio **direccional** del espectro entre frames consecutivos, no el nivel absoluto. La clave es que incluso bajo compresión brickwall, cuando un kick entra, **redistribuye energía entre bins** — algunos bins suben, otros bajan. El flujo neto de subidas (sólo positivas) sigue siendo detectable.

**Fórmula matemática:**

```
SF(t,k) = max(0, |X(t,k)| - |X(t-1,k)|)     // rectificación de media positiva

SF_total(t) = Σ_k SF(t,k)                    // flujo espectral total

SF_norm(t) = SF_total(t) / (ε + Σ_k |X(t,k)|) // normalización por energía total
```

La normalización `SF_norm` es el paso crítico: divide el flujo por la energía total del frame. Bajo brickwall, la energía total es alta pero constante, así que el denominador es estable. El numerador (flujo) captura la redistribución espectral del transitorio. El cociente **amplifica** la señal del transitorio relativo al fondo saturado.

**Esquema TypeScript (integración en GodEarAnalyzer):**

```typescript
// Nuevos buffers pre-asignados en constructor:
private prevMagnitudes: Float32Array;   // |X(t-1, k)| — magnitud del frame anterior
private fluxBuffer: Float32Array;       // SF(t, k) por bin — para análisis por banda
private fluxTotal: number = 0;          // SF_total(t) — suma escalar

// En analyze(), después de computeMagnitudeSpectrum:
private computeSpectralFlux(): void {
  const mags = this.magnitudes;
  const prev = this.prevMagnitudes;
  const flux = this.fluxBuffer;
  
  let totalFlux = 0;
  let totalEnergy = 0;
  
  for (let k = 1; k <= this.numBins; k++) {
    const diff = mags[k] - prev[k];
    flux[k] = diff > 0 ? diff : 0;   // rectificación de media positiva
    totalFlux += flux[k];
    totalEnergy += mags[k];
    prev[k] = mags[k];               // actualizar para próximo frame
  }
  
  // Normalización: flujo relativo a energía total del frame
  this.fluxTotal = totalEnergy > 1e-10 
    ? totalFlux / totalEnergy 
    : 0;
}
```

**Complejidad:** O(N) donde N = numBins + 1 = 2049. Un loop, sin llamadas a `Math.sqrt`, sin ramas complejas. Coste estimado: **~0.02ms** (2049 restas + 2049 comparaciones + 2 sumas).

**Integración con SlopeBasedOnsetDetector:**

El [SlopeBasedOnsetDetector](cci:2://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:1140:0-1199:1) actual recibe `energy: number` por banda. La evolución es alimentarlo con `fluxTotal` en lugar de `rawBands.subBass + rawBands.bass * 0.5`:

```typescript
// Antes (colapsa bajo brickwall):
const kickDetected = this.onsetDetector.detectOnset('kick', rawBands.subBass + rawBands.bass * 0.5);

// Después (inmune a brickwall):
const kickFlux = this.extractBandFlux(this.fluxBuffer, filterMasks.get('subBass')!);
const kickDetected = this.fluxOnsetDetector.detectOnset('kick', kickFlux);
```

Donde `extractBandFlux` suma `fluxBuffer[k] * mask[k]` para los bins de la banda — idéntico patrón a [extractBandEnergy](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:665:0-691:1) pero sobre el buffer de flujo.

**Por qué funciona bajo brickwall:**

| Escenario | RMS global | Ratio (current-prev) | Spectral Flux norm |
|-----------|-----------|---------------------|-------------------|
| Drop plano sin kick | 0.95 (saturado) | ~0 (sin cambio) | ~0 |
| Drop plano + kick entra | 0.95 (sigue saturado) | ~0 (RMS no sube) | **>0** (redistribución espectral) |
| Breakdown silencioso + kick | 0.15 | Alto (ratio funciona) | Alto (también funciona) |

El Spectral Flux **complementa** al detector de ratio existente, no lo reemplaza. En condiciones no-saturadas, ambos coinciden. En saturación, sólo el flux mantiene sensibilidad.

### Extensión opcional: Phase Deviation

Para mayor robustez, se puede añadir un detector de desviación de fase inter-frame:

```
Δφ(t,k) = angle(X(t,k)) - angle(X(t-1,k))
PD(t) = Σ_k |wrap(Δφ(t,k))| / N
```

Donde `wrap()` envuelve a [-π, π]. Un transitorio real produce salto de fase casi aleatorio (PD alto), mientras que contenido tonal sostenido produce Δφ predecible y pequeño. **Coste:** 2049 `Math.atan2` — ~0.08ms. Se puede activar selectivamente cuando `flatness > 0.8` (señal saturada) como validador secundario.

---

## 2. AISLAMIENTO ACÚSTICO — Envolventes Multibanda Asimétricas

### Problema

El [SlopeBasedOnsetDetector](cci:2://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:1140:0-1199:1) usa un buffer circular de 8 muestras con slope thresholds uniformes. No distingue entre:
- Un snare real (ataque ~1ms, contenido 2-5kHz)
- Un crash de platillo (ataque ~5ms, contenido 6-16kHz con bleed hacia 2-5kHz)
- Ghost notes de caja (ataque ~0.5ms, energía baja pero pendiente limpia)

### Solución: Envolvente Asimétrica Adaptativa por Banda

Reemplazar el [SlopeBasedOnsetDetector](cci:2://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:1140:0-1199:1) con un `AdaptiveEnvelopeOnsetDetector` que aplica envolventes con attack/release independientes por banda crítica:

**Fórmula del seguidor de envolvente (peak detector con asimetría):**

```
env(t) = {
  α_atk · env(t-1) + (1 - α_atk) · |x(t)|   si |x(t)| > env(t-1)    // attack
  α_rel · env(t-1) + (1 - α_rel) · |x(t)|   si |x(t)| ≤ env(t-1)    // release
}

α = exp(-1 / (τ_ms · fs_fps))     // coeficiente de suavizado
```

Donde `fs
Continúo con la respuesta completa desde donde se cortó:

---

## 2. AISLAMIENTO ACÚSTICO — Envolventes Multibanda Asimétricas (continuación)

**Esquema TypeScript:**

```typescript
interface EnvelopeConfig {
  attackMs: number;   // tiempo de ataque
  releaseMs: number;  // tiempo de release
  bandId: string;     // 'kick' | 'snare' | 'hihat'
}

const ENVELOPE_CONFIGS: Record<string, EnvelopeConfig> = {
  kick:  { attackMs: 1,  releaseMs: 80,  bandId: 'kick'  },  // ultrarrápido, bass pesado
  snare: { attackMs: 2,  releaseMs: 60,  bandId: 'snare' },  // rápido, medio
  hihat: { attackMs: 0.5, releaseMs: 30, bandId: 'hihat' },  // instantáneo, agudo
};

class AdaptiveEnvelopeOnsetDetector {
  private env: Record<string, number> = { kick: 0, snare: 0, hihat: 0 };
  private prevEnv: Record<string, number> = { kick: 0, snare: 0, hihat: 0 };
  private alphaAtk: Record<string, number> = {};
  private alphaRel: Record<string, number> = {};
  private frameRate: number; // ~20fps

  constructor(frameRate: number) {
    this.frameRate = frameRate;
    for (const [id, cfg] of Object.entries(ENVELOPE_CONFIGS)) {
      this.alphaAtk[id] = Math.exp(-1 / (cfg.attackMs * frameRate));
      this.alphaRel[id] = Math.exp(-1 / (cfg.releaseMs * frameRate));
    }
  }

  detectOnset(band: string, energy: number): boolean {
    const prev = this.env[band];
    const aAtk = this.alphaAtk[band];
    const aRel = this.alphaRel[band];

    // Envolvente asimétrica
    const current = energy > prev
      ? aAtk * prev + (1 - aAtk) * energy   // attack
      : aRel * prev + (1 - aRel) * energy;  // release

    // Derivada de la envolvente (no de la energía cruda)
    const slope = current - this.prevEnv[band];
    this.prevEnv[band] = current;
    this.env[band] = current;

    // Umbral adaptativo: proporcional al nivel sostenido de la envolvente
    const threshold = Math.max(0.02, current * 0.25);
    return slope > threshold;
  }
}
```

**Supresión de Bleed de Platillos:**

El bleed de crash/cymbal contamina la banda `mid` (500-2000Hz) donde vive el snare. Solución: **sustracción espectral cruzada** antes de la detección:

```typescript
// En analyze(), antes de detectOnset('snare', ...):
// El treble contiene el platillo puro. Si treble > mid * 0.8, el "snare"
// es probablemente bleed del crash, no un golpe real de caja.
const snareInput = Math.max(0, rawBands.mid - rawBands.treble * 0.35);
const snareDetected = this.envelopeDetector.detectOnset('snare', snareInput);
```

El factor `0.35` modela la proporción típica de bleed cymbal→mid en mezclas orgánicas. No es crítico — el valor exacto se calibra con datos reales. Lo importante es la arquitectura: **sustraer contenido armónico superior antes de evaluar el transitorio de caja**.

**Ghost Notes:** La envolvente con attack de 2ms y threshold adaptativo (`current * 0.25`) es lo suficientemente sensible para capturar ghost notes (energía baja pero pendiente limpia) mientras filtra rebotes de reverb (energía similar pero pendiente suave por el smear temporal).

**Coste computacional:** 3 bandas × (1 comparación + 2 FMA + 1 resta + 1 comparación) = **~15 ops/frame**. Despreciable.

---

## 3. COSECHA DE CICLOS CPU — LUT de Twiddle Factors

### Estructura de Datos

Para Radix-2 DIT con N=4096, los twiddle factors son `W_m^j = exp(-j·2π·j/m)` donde `m ∈ {2, 4, 8, ..., 4096}` y `j ∈ [0, m/2)`. El número total de twiddle factors únicos es `N/2 = 2048` (por simetría: `W_N^(j+N/2) = -W_N^j`).

**Diseño: dos Float32Array de N/2 elementos, indexados por posición global.**

```typescript
// Pre-cálculo singleton — una vez al arranque
let TWIDDLE_COS: Float32Array | null = null;
let TWIDDLE_SIN: Float32Array | null = null;
let TWIDDLE_SIZE = 0;

function generateTwiddleLUT(n: number): void {
  const halfN = n >> 1;
  TWIDDLE_COS = new Float32Array(halfN);
  TWIDDLE_SIN = new Float32Array(halfN);
  TWIDDLE_SIZE = n;

  // W_N^k = cos(-2πk/N) + j·sin(-2πk/N) para k = 0..N/2-1
  // Cubre todos los stages: stage m usa W_m^j = W_N^(j·N/m)
  const angleStep = -2 * Math.PI / n;
  for (let k = 0; k < halfN; k++) {
    TWIDDLE_COS[k] = Math.cos(angleStep * k);
    TWIDDLE_SIN[k] = Math.sin(angleStep * k);
  }
}

function getTwiddleLUT(n: number): { cos: Float32Array; sin: Float32Array } {
  if (!TWIDDLE_COS || TWIDDLE_SIZE !== n) {
    generateTwiddleLUT(n);
  }
  return { cos: TWIDDLE_COS!, sin: TWIDDLE_SIN! };
}
```

**Memoria:** 2 × 2048 × 4 bytes = **16 KB**. Trivial.

### FFT Core Modificado

```typescript
function computeFFTCore_LUT(
  samples: Float32Array,
  outReal: Float32Array,
  outImag: Float32Array
): void {
  const n = samples.length;
  const bitRev = getBitReversalTable(n);
  const { cos: twCos, sin: twSin } = getTwiddleLUT(n);

  // Bit-reverse permutation
  for (let i = 0; i < n; i++) {
    outReal[i] = samples[bitRev[i]];
    outImag[i] = 0;
  }

  // Bottom-up DIT stages
  for (let size = 2; size <= n; size <<= 1) {
    const halfSize = size >> 1;
    const stride = n / size;  // paso en la LUT para este stage

    for (let groupStart = 0; groupStart < n; groupStart += size) {
      for (let j = 0; j < halfSize; j++) {
        // Indexar LUT en vez de calcular cos/sin
        const twIdx = j * stride;
        const wr = twCos[twIdx];
        const wi = twSin[twIdx];

        const evenIdx = groupStart + j;
        const oddIdx = groupStart + j + halfSize;

        const tRe = wr * outReal[oddIdx] - wi * outImag[oddIdx];
        const tIm = wr * outImag[oddIdx] + wi * outReal[oddIdx];

        outReal[oddIdx] = outReal[evenIdx] - tRe;
        outImag[oddIdx] = outImag[evenIdx] - tIm;
        outReal[evenIdx] = outReal[evenIdx] + tRe;
        outImag[evenIdx] = outImag[evenIdx] + tIm;
      }
    }
  }
}
```

**El cambio es exactamente 2 líneas:** reemplazar `Math.cos(angle)` / `Math.sin(angle)` con `twCos[twIdx]` / `twSin[twIdx]`. El índice `j * stride` mapea el twiddle factor del stage `size` al índice global en la LUT de tamaño N/2.

### Estimación de Ahorro

| Componente | Llamadas/frame | Coste estimado |
|-----------|---------------|---------------|
| `Math.cos` en butterfly | 2048 (N/2 · log₂N / 2 = 2048) | ~0.15ms |
| `Math.sin` en butterfly | 2048 | ~0.15ms |
| **Total trig en caliente** | 4096 | **~0.30ms** |
| LUT lookup (2 array reads) | 4096 | ~0.02ms |
| **Ahorro neto** | | **~0.28ms** |

Con FFT actual a ~0.6ms, esto lo lleva a **~0.32ms** — un 47% de reducción. El headroom pasa de 3.3x a 6.25x sobre el presupuesto de 2ms.

---

## 4. POWER SPECTRUM — Eliminación de Math.sqrt

### Problema Confirmado

`@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:532`

```typescript
// Actual: 2049 Math.sqrt innecesarias
const mag = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
output[i] = mag * normFactor;
```

Y luego en [extractBandEnergy](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:665:0-691:1) (`:680`):

```typescript
// Se vuelve a elevar al cuadrado — la sqrt se cancela
energy += magnitudes[bin] * magnitudes[bin] * weight;
```

### Solución: `computePowerSpectrum` + sqrt diferida

```typescript
function computePowerSpectrum(
  real: Float32Array,
  imag: Float32Array,
  output: Float32Array,  // ahora almacena re² + im² (power)
  numBins: number
): void {
  // normFactor² porque operamos en dominio de potencia
  const normFactor = 1 / (real.length * BLACKMAN_HARRIS_COHERENT_GAIN);
  const normFactorSq = normFactor * normFactor;

  for (let i = 0; i <= numBins; i++) {
    output[i] = (real[i] * real[i] + imag[i] * imag[i]) * normFactorSq;
  }
}
```

**[extractBandEnergy](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:665:0-691:1) modificado — sin sqrt final:**

```typescript
function extractBandEnergy_Power(powerSpectrum: Float32Array, mask: Float32Array): number {
  let energy = 0;
  let weightSum = 0;

  for (let bin = 0; bin < powerSpectrum.length && bin < mask.length; bin++) {
    const weight = mask[bin];
    if (weight > 0.001) {
      energy += powerSpectrum[bin] * weight;  // ya es potencia, no magnitud
      weightSum += weight;
    }
  }

  if (weightSum > 0) energy /= weightSum;
  return energy;  // retorna potencia normalizada, NO sqrt
}
```

**sqrt diferida al post-proceso de visualización:**

Los consumidores que necesitan magnitud lineal (no potencia) para visualización aplican `Math.sqrt` una sola vez al final:

```typescript
// En el return de analyze(), para dominantFrequency y totalEnergy:
// Antes: Math.sqrt(totalEnergy) donde totalEnergy = Σ mag²
// Ahora: totalEnergy ya es Σ power, sqrt una vez al final
const totalEnergy = Math.sqrt(totalPower);  // una sola sqrt

// scaleBandEnergyForVisual: sqrt una vez por banda (7 total) en vez de 2049
function scaleBandEnergyForVisual_Power(rawPower: number, weightSum: number): number {
  if (rawPower <= 0) return 0;
  const integratedRms = Math.sqrt(rawPower) * Math.sqrt(Math.max(1, weightSum));
  const scaled = integratedRms * POST_FFT_LEGACY_EQ_GAIN;
  return Math.min(POST_FFT_BAND_OUTPUT_CLAMP, scaled);
}
```

### Estimación de Ahorro

| Componente | Antes | Después |
|-----------|-------|---------|
| [computeMagnitudeSpectrum](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:511:0-534:1) | 2049 `Math.sqrt` (~0.15ms) | 0 `Math.sqrt` (~0.01ms) |
| [extractBandEnergy](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:665:0-691:1) ×7 | 7 `Math.sqrt` (~0.001ms) | 7 `Math.sqrt` (~0.001ms) |
| [scaleBandEnergyForVisual](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:656:0-663:1) ×7 | 0 | 7 `Math.sqrt` (~0.001ms) |
| `totalEnergy` | 1 `Math.sqrt` | 1 `Math.sqrt` |
| **Total sqrt** | **2057** | **15** |
| **Ahorro neto** | | **~0.14ms** |

### Impacto en consumidores downstream

Las métricas espectrales ([calculateSpectralCentroid](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:697:0-731:1), [calculateSpectralFlatness](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:733:0-783:1), [calculateSpectralRolloff](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:785:0-823:1), [calculateCrestFactor](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:898:0-920:1), [calculateClarity](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:825:0-896:1)) actualmente operan sobre `this.magnitudes` (magnitud lineal). Con power spectrum, necesitan adaptación:

- **Centroid:** `Σ(f × |X|²) / Σ|X|²` — ya usa magnitud al cuadrado, así que `power[k]` es exactamente `|X[k]|²`. **Sin cambios.**
- **Flatness:** `exp(Σ log(|X|)) / mean(|X|)` — necesita `sqrt(power[k])` o reformulación a `exp(Σ log(power)/2) / mean(power/2)`. **Requiere sqrt por bin** — pero flatness se calcula una vez por frame, no por banda. Alternativa: mantener un buffer de magnitud separado para métricas (2049 sqrt) y usar power para band energy. **Mejor opción: calcular flatness en dominio de potencia** (`geometric mean of power / arithmetic mean of power`), que es igualmente válido como medida de entropía.
- **Rolloff:** percentil 85% de energía — funciona directamente con potencia. **Sin cambios.**
- **CrestFactor:** `peak/RMS` — `sqrt(max(power)) / sqrt(mean(power))` = una sqrt al final. **Sin cambios estructurales.**

**Conclusión:** La migración a power spectrum es viable con cambios mínimos en métricas. El ahorro de ~0.14ms se suma a los ~0.28ms del LUT para un **total de ~0.42ms recuperados**, llevando el frame de ~0.6ms a **~0.18ms**.

---

## 5. MOONSHOT — Adaptive Band Compression + Micro-NN Onset Validator

### Idea: Compresión Adaptativa de Bandas con Log-Frequency Scaling

Los 7 bands fijos con LR4 son estáticos. Pero la música no es estática: un drop de techno necesita resolución en sub-bass, un pasaje de rock necesita resolución en mid. **La idea es re-pesar dinámicamente la resolución espectral según el contenido.**

**Concepto: Bandas log-frecuenciales adaptativas:**

En lugar de 7 bands fijos, dividir el espectro en **24 bandas críticas Bark-scale** (aproximación logarítmica del banco de filtros coclear humano). Cada banda Bark tiene ancho creciente con la frecuencia (100Hz → 20Hz de ancho, 10kHz → 2.5kHz de ancho). Esto da **resolución quirúrgica donde importa** (graves para kick detection) y **cobertura amplia donde no importa** (agudos para textura).

Los 7 bands actuales se calculan como **suma ponderada de las 24 bandas Bark**, con pesos que se adaptan según el contexto musical detectado por el SectionTracker/Vibe:

```typescript
// 24 bandas Bark → 7 bandas GodEar con pesos adaptativos
function adaptiveBandCompress(
  barkBands: Float32Array,  // 24 valores
  weightMatrix: Float32Array // 7×24, pre-calculada por Vibe
): GodEarBands {
  // Matrix-vector product, 168 FMA ops
  // weightMatrix se recalcula cuando cambia el Vibe (raro, ~1 vez/min)
}
```

**Coste:** 168 FMA (vs ~2049 multiplicaciones actuales por banda). **Más rápido** que el sistema actual. La complejidad se mueve al pre-cálculo de la matriz de pesos, que ocurre en el constructor o cuando cambia el Vibe.

### Micro-NN Onset Validator (el Moonshot real)

**Arquitectura:** Una red neuronal tiny (2 capas, 16→8→3) que opera **dentro del Worker** como validador de onsets detectados. No reemplaza al detector — lo **filtra**.

**Input (16 features):**
- 7 band energies (frame actual)
- 7 band flux values (Spectral Flux por banda)
- spectral centroid
- spectral flatness
- crest factor
- energy delta (frame actual vs anterior)

**Output (3 neuronas, softmax):**
- `kick_confidence` (0-1)
- `snare_confidence` (0-1)
- `false_positive_probability` (0-1)

**Esquema:**

```typescript
class OnsetValidatorNN {
  // Capa 1: 16 → 8 (128 pesos + 8 biases)
  private w1: Float32Array = new Float32Array(128);
  private b1: Float32Array = new Float32Array(8);
  // Capa 2: 8 → 3 (24 pesos + 3 biases)
  private w2: Float32Array = new Float32Array(24);
  private b2: Float32Array = new Float32Array(3);
  // Buffers de trabajo pre-asignados
  private hidden: Float32Array = new Float32Array(8);
  private output: Float32Array = new Float32Array(3);

  validate(features: Float32Array): { kick: number; snare: number; fp: number } {
    // Forward pass — 152 FMA + 11 activaciones
    // Capa 1: ReLU
    for (let i = 0; i < 8; i++) {
      let sum = this.b1[i];
      for (let j = 0; j < 16; j++) {
        sum += this.w1[i * 16 + j] * features[j];
      }
      this.hidden[i] = Math.max(0, sum); // ReLU
    }
    // Capa 2: Softmax
    let maxLogit = -Infinity;
    for (let i = 0; i < 3; i++) {
      let sum = this.b2[i];
      for (let j = 0; j < 8; j++) {
        sum += this.w2[i * 8 + j] * this.hidden[j];
      }
      this.output[i] = sum;
      if (sum > maxLogit) maxLogit = sum;
    }
    let expSum = 0;
    for (let i = 0; i < 3; i++) {
      this.output[i] = Math.exp(this.output[i] - maxLogit);
      expSum += this.output[i];
    }
    for (let i = 0; i < 3; i++) this.output[i] /= expSum;

    return { kick: this.output[0], snare: this.output[1], fp: this.output[2] };
  }
}
```

**Coste computacional:** 152 FMA + 8 ReLU + 3 exp + 3 div = **~163 ops**. A 20fps, esto son **~3260 ops/segundo**. Una Raspberry Pi podría hacerlo. En V8/JIT, esto es **<0.01ms por frame**.

**Entrenamiento:** Los pesos se entrenan offline con datos etiquetados del Shadow Logger (que ya existe en LuxSync). El modelo entrenado se serializa como `Float32Array` constante — no hay backprop en runtime. El modelo es **inmutable en producción**, como una tabla LUT más.

**Por qué esto sitúa a LuxSync por encima del mercado:**

Ningún software de iluminación usa ML para validación de onsets en tiempo real. SoundSwitch usa ML offline para análisis de tracks completos. GrandMA3 y Avolites no usan ML en absoluto. LuxSync tendría un **validador neuronal en el hot path del Worker**, operando a 20fps con coste computacional despreciable, filtrando falsos positivos que los detectores heurísticos no pueden distinguir (ej: un drop de bass que parece un kick pero no lo es, un fill de tom que parece un snare pero requiere diferente respuesta de iluminación).

**Integración con el pipeline existente:**

```typescript
// En analyze(), después del detector heurístico:
const kickRaw = this.envelopeDetector.detectOnset('kick', kickFlux);
const snareRaw = this.envelopeDetector.detectOnset('snare', snareInput);

// Validación neuronal — sólo si el detector heurístico disparó
if (kickRaw || snareRaw) {
  this.featureBuffer.set([...bandEnergies, ...bandFlux, centroid, flatness, crest, energyDelta]);
  const nnResult = this.onsetValidator.validate(this.featureBuffer);

  const kickDetected = kickRaw && nnResult.fp < 0.5;
  const snareDetected = snareRaw && nnResult.fp < 0.5;
}
```

El NN sólo se invoca cuando el detector heurístico dispara — no en cada frame. Esto mantiene el coste medio en **~0.005ms/frame** (asumiendo 50% de frames con onset candidato).

---

## RESUMEN EJECUTIVO

| Propuesta | Coste computacional | Ahorro/Beneficio |
|-----------|-------------------|-----------------|
| Spectral Flux normalizado | +0.02ms | Inmunidad a brickwall |
| Envolventes asimétricas | +0.01ms (reemplaza detector existente) | Ghost notes + bleed suppression |
| LUT Twiddle Factors | +0.02ms (lookup) - 0.30ms (cos/sin) | **-0.28ms neto** |
| Power Spectrum | +0.01ms - 0.15ms (sqrt) | **-0.14ms neto** |
| Adaptive Band Compression | -0.01ms (menos bins que magnitudes) | Resolución adaptativa |
| Micro-NN Onset Validator | +0.005ms medio | Filtrado de falsos positivos |
| **Balance total** | | **-0.40ms neto + 3 nuevas capacidades** |

FFT frame proyectado: **~0.20ms** (desde 0.6ms actual), con Spectral Flux, envolventes adaptativas, y validación neuronal activos. Headroom: **10x sobre el presupuesto de 2ms**.

Espero tus evaluaciones, Arquitecto. Las ideas están listas para la LLM Storm.