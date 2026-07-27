# 🌩️ GODEAR V3 BLUEPRINT — WAVE 8000
## "Foton Engine": Arquitectura DSP de Última Generación para LuxSync

**Autor:** GLM — Ingeniero Jefe DSP (Agente de Repositorio)
**Base:** `SENSORY_LAYER_AUDIT_JULY2026.md` + `mejoresFFTideas.md`
**Estado:** Blueprint técnico — 0 código ejecutado
**Presupuesto:** <1ms/frame en Worker Thread (actual: ~0.6ms; proyectado V3: ~0.35ms con MÁS features)

---

## 0. VEREDICTO SOBRE LAS IDEAS PREVIAS (Autoridad Técnica)

Antes de diseñar, evalúo críticamente cada idea del documento adjunto:

| Idea | Veredicto | Justificación |
|------|-----------|---------------|
| LUT Twiddle Factors | ✅ **ACEPTADA** | Ahorro real ~0.28ms. 16KB de memoria. Cero riesgo numérico (mismos valores, pre-calculados). |
| Power Spectrum (eliminar sqrt) | ✅ **ACEPTADA** | La sqrt se cancela algebraicamente en `extractBandEnergy`. Matemáticamente idéntico, ~0.14ms más rápido. |
| Spectral Flux normalizado | ✅ **ACEPTADA + MEJORADA** | Es la pieza central anti-brickwall. La reformulo en dominio de potencia con normalización adaptativa (§3). |
| Phase Deviation inter-frame | ❌ **DESCARTADA** | **Error matemático del documento original:** la desviación de fase sólo es informativa con hop pequeño (≤N/4 = 1024 samples ≈ 23ms). Nuestro Worker corre a ~20fps con hop de ~50ms (2205 samples), donde la fase entre frames es esencialmente aleatoria para cualquier bin >20Hz. El coste (2049 `atan2`) compraría ruido puro. |
| Envolventes asimétricas attack/release | ✅ **ACEPTADA** | Física correcta para transitorios. Coste despreciable (~15 ops). |
| Sustracción de bleed cymbal→mid | ✅ **ACEPTADA** (factor calibrable) | Arquitectura correcta; el 0.35 es punto de partida, no dogma. |
| 24 bandas Bark adaptativas | ⏸️ **DIFERIDA** | Las 7 bandas LR4 son un **contrato de API** con todo el HAL/Physics downstream (`LiquidStereoPhysics`, perfiles, AGC). Romperlo requiere migración masiva sin ganancia fotónica inmediata. Se calcula internamente un vector de 24 sub-bandas SOLO para el detector de ruido blanco (§5), sin exponerlo. |
| Micro-NN Onset Validator | ⏸️ **DIFERIDA a Fase 2** | Técnicamente viable (<0.01ms), pero requiere dataset etiquetado del Shadow Logger que aún no existe en volumen. El diseño V3 deja el hook preparado (`OnsetCandidate` struct) para inyectarlo después sin refactor. |
| Kalman freewheel para breakdowns | ✅ **YA EXISTE** | `IntervalBPMTracker` (REC-13) + `BeatDetector.freewheelAt()` (WAVE 2179) ya lo implementan. V3 sólo cambia SU ALIMENTACIÓN: onsets por flux en vez de ratio de energía (§3.4). |

---

## 1. ARQUITECTURA GENERAL — El Pipeline V3

```
┌─────────────────────────────────────────────────────────────────────┐
│  GODEAR V3 — ZERO-ALLOCATION PIPELINE (Worker Thread, ~20fps)       │
│                                                                     │
│  S0  Input copy → inputBuffer            (existente)                │
│  S1  DC removal → dcBuffer               (existente)                │
│  S2  Blackman-Harris window → windowed   (existente)                │
│  S3  FFT Radix-2 DIT **+ Twiddle LUT**   (§2.1)  −0.28ms            │
│  S4  **Power Spectrum** (re²+im²)        (§2.2)  −0.14ms            │
│  S5  **Spectral Flux** (power domain)    (§3)    +0.02ms  ★NUEVO    │
│  S6  LR4 band extraction (power domain)  (§2.3)                     │
│  S7  Métricas espectrales (power domain) (§2.4)                     │
│  S8  Chromagrama (power domain)          (existente, WAVE 2301)     │
│  S9  ★ PHOTON METRICS BLOCK ★            (§4-§7)  +0.03ms  NUEVO    │
│      ├─ 9a. Saturation Index (SI)        — el "Muro de Sonido"      │
│      ├─ 9b. Wall Intensity Curve         — anti-colapso DMX         │
│      ├─ 9c. Transient Density Meter      — detector de redobles     │
│      ├─ 9d. Strobe Oscillator            — strobe dinámico seguro   │
│      └─ 9e. Chroma Coupler               — color snaps armónicos    │
│  S10 Output: GodEarSpectrum + photon{}                              │
└─────────────────────────────────────────────────────────────────────┘
```

**Principio rector:** el V3 no reemplaza el detector de ratio existente ni el contrato de 7 bandas. **Añade una segunda vía sensorial (flux + saturación)** que toma el mando precisamente cuando la primera colapsa. Es un sistema de dos regímenes:

- **Régimen dinámico** (música con silencios): ratio de energía + envolventes → funciona como hoy.
- **Régimen saturado** (brickwall, redobles, ruido blanco): flux + Saturation Index → intensidad alta, strobes, color snaps.

La transición entre regímenes es **continua** (crossfade gobernado por SI), nunca un switch binario que produzca saltos visuales.

---

## 2. NÚCLEO FFT OPTIMIZADO (Cosecha de Ciclos)

### 2.1 Twiddle Factor LUT

Para N=4096, todos los twiddle factors de todos los stages son subconjunto de `W_N^k, k ∈ [0, N/2)`:

```
W_m^j = e^(−j·2π·j/m) = W_N^(j·N/m)     donde N/m = stride del stage
```

**Estructura:** dos `Float32Array(2048)` — 16KB totales, singleton generado en el arranque del Worker.

```typescript
let TW_COS: Float32Array; let TW_SIN: Float32Array;

function initTwiddleLUT(n: number): void {
  const half = n >> 1;
  TW_COS = new Float32Array(half);
  TW_SIN = new Float32Array(half);
  const step = -2 * Math.PI / n;
  for (let k = 0; k < half; k++) {
    TW_COS[k] = Math.cos(step * k);
    TW_SIN[k] = Math.sin(step * k);
  }
}

// En computeFFTCore, el butterfly cambia SOLO 3 líneas:
//   const stride = n / size;          // fuera del loop j
//   const wr = TW_COS[j * stride];    // era Math.cos(angle)
//   const wi = TW_SIN[j * stride];    // era Math.sin(angle)
```

Elimina 4096 llamadas trigonométricas/frame (2048 cos + 2048 sin). **Ahorro: ~0.28ms.** El FFT baja de ~0.6ms a ~0.32ms.

### 2.2 Power Spectrum — sqrt diferida

Identidad clave que hace esto **matemáticamente sin pérdida**:

```
extractBandEnergy actual:  E = sqrt( Σ (sqrt(P_k))² · w_k / Σw )  =  sqrt( Σ P_k·w_k / Σw )
```

La sqrt por bin y el cuadrado posterior se cancelan. Operamos todo el pipeline interno en **potencia** `P_k = re² + im²` y aplicamos sqrt UNA vez por banda (7 sqrt) en vez de 2049:

```typescript
function computePowerSpectrum(re: Float32Array, im: Float32Array,
                              out: Float32Array, numBins: number): void {
  const nf = 1 / (re.length * BLACKMAN_HARRIS_COHERENT_GAIN);
  const nf2 = nf * nf;                       // norm² para dominio potencia
  for (let i = 0; i <= numBins; i++) {
    out[i] = (re[i] * re[i] + im[i] * im[i]) * nf2;
  }
}

function extractBandPower(power: Float32Array, mask: Float32Array): number {
  let e = 0, ws = 0;
  for (let bin = 0; bin < power.length && bin < mask.length; bin++) {
    const w = mask[bin];
    if (w > 0.001) { e += power[bin] * w; ws += w; }
  }
  return ws > 0 ? e / ws : 0;                // potencia media — SIN sqrt
}

// sqrt sólo al presentar la banda (7 llamadas/frame):
const bandRms = Math.sqrt(extractBandPower(power, mask));
```

**Migración de métricas al dominio de potencia (todas válidas):**

| Métrica | Fórmula en potencia | Cambio |
|---------|--------------------| -------|
| Centroid | `Σ(f_k·P_k)/ΣP_k` | Ninguno — ya usaba \|X\|² conceptualmente |
| Flatness | `exp(mean(ln P_k)) / mean(P_k)` | La media geométrica/aritmética de potencia es una entropía de Wiener igualmente válida (relación: `flatness_P = flatness_mag²` — recalibrar umbral: 0.8→0.64) |
| Rolloff | percentil 85% de `ΣP_k` acumulada | Ninguno — energía ES potencia |
| Crest | `sqrt(max P_k / mean P_k)` | 1 sqrt al final |

**Ahorro: ~0.14ms** (2049→~15 sqrt/frame).

### 2.3 Presupuesto tras la cosecha

| Etapa | V2 actual | V3 |
|-------|-----------|-----|
| FFT core | 0.60ms | 0.32ms |
| Magnitud/Potencia | 0.15ms | 0.01ms |
| Bandas + métricas + chroma | 0.10ms | 0.10ms |
| **Subtotal núcleo** | **0.85ms** | **0.43ms** |
| Nuevos bloques V3 (S5+S9) | — | +0.05ms |
| **TOTAL** | 0.85ms | **~0.48ms** ✅ bajo el presupuesto de 1ms con 2x de margen |

---

## 3. SPECTRAL FLUX — La Vía Sensorial Anti-Brickwall

### 3.1 El problema, formalizado

Bajo limitador brickwall, el RMS total es constante: `E(t) ≈ E_max ∀t`. Cualquier detector de la forma `E(t)/E(t−1) > θ` o `E(t) − E(t−1) > θ` recibe señal nula. **Pero el espectro interno sigue moviéndose:** un kick entrando redistribuye energía de 2-8kHz hacia 20-100Hz aunque la suma total no cambie. El flux captura esa redistribución.

### 3.2 Diseño: Half-Wave Rectified Flux en dominio de potencia

```
F(t)      = Σ_k max(0, P_t[k] − P_{t−1}[k])        // flujo bruto (sólo subidas)
F_norm(t) = F(t) / (ε + Σ_k P_t[k])                // normalizado por energía total
```

**Por qué half-wave rectified:** un onset SUBE bins; un release los baja. Rectificar aísla el fenómeno de ataque. **Por qué normalizar:** hace F_norm invariante al nivel del máster — el mismo kick da el mismo flux a −20dB que a 0dB brickwalled. Esta es la inmunidad a compresión.

**Refinamiento V3 — Whitening adaptativo (opcional, coste +0.01ms):** para que un bin de graves (energía 100x la de agudos) no domine el flux, se divide cada diferencia por un piso de referencia por bin con memoria lenta:

```
F_w(t) = Σ_k max(0, P_t[k] − P_{t−1}[k]) / max(ε, R_t[k])
R_t[k] = max(P_t[k], λ·R_{t−1}[k])          λ = 0.995  (peak-hold con decay)
```

Este "adaptive whitening" (Stowell & Plumbley, 2007) es el estándar de oro en detección de onsets y cuesta un `max` + una división por bin.

### 3.3 Implementación zero-allocation

```typescript
// Buffers pre-asignados en constructor (3 × Float32Array(2049) = 24KB):
private prevPower: Float32Array;    // P_{t-1}
private fluxWhitening: Float32Array;// R_t (peak-hold)
private bandFlux: Float32Array;     // flux agregado por banda (7 slots)

private computeSpectralFlux(power: Float32Array, masks: BandMasks): number {
  const prev = this.prevPower, white = this.fluxWhitening;
  let totalFlux = 0, totalPower = 0;

  for (let k = 1; k <= this.numBins; k++) {
    const p = power[k];
    // peak-hold whitening reference
    const r = white[k] * 0.995;
    white[k] = p > r ? p : r;
    // half-wave rectified whitened flux
    const d = p - prev[k];
    if (d > 0) totalFlux += d / (white[k] + 1e-12);
    totalPower += p;
    prev[k] = p;
  }
  return totalPower > 1e-10 ? totalFlux : 0;   // ya adimensional por whitening
}
```

Complejidad O(N), un solo loop, sin sqrt ni trig. **Coste: ~0.02ms.**

**Flux por banda** (para kick/snare/hihat): mismo loop acumula en `bandFlux[b]` usando las máscaras LR4 existentes — reutiliza infraestructura, cero código nuevo de filtros.

### 3.4 Realimentación del BPM Tracker (el fix del breakdown de Prydz)

`IntervalBPMTracker.process()` recibe hoy energía de banda cruda → colapsa bajo brickwall. **Cambio quirúrgico:** alimentar el detector de kicks con `bandFlux.subBass` en vez de (o combinado con) `scaledBands.subBass`:

```
kickSignal(t) = α·bandFluxSubBass(t) + (1−α)·bandEnergySubBass(t)
α = SI(t)     // crossfade gobernado por el Saturation Index (§4)
```

- En música dinámica (SI≈0): comportamiento idéntico al actual — cero regresión.
- En brickwall (SI≈1): el tracker ve flux, que sigue pulsando al tempo → el Kalman sigue midiendo → el PLL sigue anclado → **el freewheel del breakdown ya está resuelto por la infraestructura existente** (REC-13 + WAVE 2179), sólo le devolvemos la vista.

---

## 4. SATURATION INDEX (SI) — Métrica del Muro de Sonido

### 4.1 Fundamento

La firma de un máster brickwalled tiene tres componentes medibles y ortogonales:

1. **Crest factor bajo** — peak/RMS colapsado por el limitador. Música dinámica: 12-20dB; brickwall: 6-9dB.
2. **Loudness sostenido** — RMS pegado a su máximo reciente durante cientos de ms.
3. **Densidad espectral alta** — flatness elevada (el limitador + saturación armónica rellenan el espectro).

### 4.2 Fórmulas

**Componente 1 — Crest colapsado (ya tenemos crestFactor en S7, coste marginal 0):**

```
CF_dB   = 10·log₁₀(maxP / meanP)
SI_crest = clamp01( (14 − CF_dB) / (14 − 6) )      // 14dB→0, 6dB→1
```

**Componente 2 — Dwell de loudness (dos EMAs, 4 ops/frame):**

```
L_fast(t) = 0.6·L_fast(t−1) + 0.4·E(t)             // τ ≈ 100ms
L_slow(t) = 0.98·L_slow(t−1) + 0.02·E(t)           // τ ≈ 2.5s
L_peak(t) = max(E(t), 0.999·L_peak(t−1))           // peak-hold lento

SI_dwell = clamp01(L_fast / (0.75·L_peak + ε)) · clamp01(L_slow / (0.6·L_peak + ε))
```

Interpretación: SI_dwell → 1 cuando la energía instantánea Y la media de 2.5s están ambas pegadas al pico reciente. Un drop puntual sube L_fast pero no L_slow → no dispara. Un muro sostenido sube ambas → dispara.

**Componente 3 — Flatness (ya calculada en S7, coste 0):**

```
SI_flat = clamp01( (flatness_P − 0.15) / (0.5 − 0.15) )
```

**Fusión (media geométrica ponderada — exige coincidencia, evita falsos positivos):**

```
SI = (SI_crest)^0.4 · (SI_dwell)^0.4 · (max(SI_flat, 0.3))^0.2
SI_smooth(t) = SI_smooth(t−1) + k·(SI − SI_smooth(t−1))
               k = 0.30 si SI > SI_smooth (ataque ~150ms)
               k = 0.04 si SI ≤ SI_smooth (release ~1.2s — el muro no se apaga de golpe)
```

La asimetría del suavizado es crítica para la estética: entrar al muro es rápido (la luz responde al drop), salir es lento (no hay parpadeo al respirar el limitador).

### 4.3 Wall Intensity Curve — el anti-colapso DMX

La intensidad fotónica final que el Worker exporta:

```
I_photon(t) = max( I_env(t) , SI_smooth(t)^0.7 )
```

- `I_env` = la intensidad clásica por envolvente de energía (vía actual — sigue mandando en música dinámica).
- `SI^0.7` = **piso de intensidad por saturación.** La curva cóncava (γ=0.7) hace que SI=0.5 ya dé 0.62 de intensidad — el muro empuja la luz hacia arriba agresivamente.

**Propiedad matemática clave:** `max()` garantiza que el V3 NUNCA produce menos luz que el V2. Es estrictamente un lower-bound creciente con la saturación. El colapso a oscuridad es imposible por construcción.

```typescript
// ~12 ops/frame. Estado: 4 floats.
class SaturationMeter {
  private lFast = 0; private lSlow = 0; private lPeak = 1e-6; private siSmooth = 0;

  update(totalPower: number, crestDb: number, flatnessP: number): number {
    this.lFast += 0.4 * (totalPower - this.lFast);
    this.lSlow += 0.02 * (totalPower - this.lSlow);
    this.lPeak = totalPower > this.lPeak ? totalPower : this.lPeak * 0.999;

    const siCrest = clamp01((14 - crestDb) / 8);
    const siDwell = clamp01(this.lFast / (0.75 * this.lPeak + 1e-12))
                  * clamp01(this.lSlow / (0.60 * this.lPeak + 1e-12));
    const siFlat  = Math.max(0.3, clamp01((flatnessP - 0.15) / 0.35));

    const si = Math.pow(siCrest, 0.4) * Math.pow(siDwell, 0.4) * Math.pow(siFlat, 0.2);
    const k = si > this.siSmooth ? 0.30 : 0.04;
    this.siSmooth += k * (si - this.siSmooth);
    return this.siSmooth;
  }
}
```

### 4.4 Interacción con el AGC (importante)

El AGC actual normaliza bandas hacia `targetRMS` — bajo brickwall, REDUCE ganancia y aplana la salida, contribuyendo al colapso visual. **Regla V3:** cuando `SI > 0.6`, congelar la reducción de ganancia del AGC (permitir sólo subidas):

```
gain(t) = SI > 0.6 ? max(gain_agc(t), gain(t−1)) : gain_agc(t)
```

El AGC deja de "luchar" contra el muro y las bandas retienen su punch visual.

---

## 5. STROBE ENGINE — Redobles y Ruido Blanco → Parpadeo Dinámico

### 5.1 Detector de redobles: Transient Density Meter (TDM)

Un redoble es un **aumento sostenido de la tasa de onsets** (de ~2/s a 8-30/s). Contador con decay exponencial (leaky integrator):

```
D(t) = D(t−1)·e^(−Δt/τ) + onset(t)        τ = 400ms
D_norm = clamp01( (D − 1.5) / 6.0 )        // <1.5 hits en ventana: silencio; ≥7.5: redoble pleno
```

Con τ=400ms, un redoble de 16avos a 128 BPM (8.5 hits/s) estabiliza D≈3.4·onset_strength → D_norm≈0.32 y creciendo con la densidad. El decay exponencial da una respuesta natural: el strobe acelera DURANTE el redoble y se desvanece ~400ms tras su fin.

**Fuente de onsets:** el spectral flux por banda (§3.3) con umbral adaptativo — es inmune al brickwall, así que el TDM funciona incluso en redobles sobre muros de sonido. Se cuenta el onset con su fuerza: `onset(t) = flux_snare > θ ? min(1, flux_snare/θ_max) : 0`.

### 5.2 Detector de ruido blanco / noise sweep

Firma: **flatness alta + energía desplazada a agudos + flux sostenido no-pulsante.**

```
W_noise = SI_flat · HF_ratio · F_sustain

HF_ratio  = (P_treble + P_ultraAir + 0.5·P_highMid) / (P_total + ε)   // ya calculado en S6
F_sustain = clamp01(fluxEMA / fluxRef)      // EMA del flux total, τ≈200ms
```

Un sweep de ruido blanco ascendente (típico build-up EDM) produce W_noise creciente de forma monótona — exactamente la rampa que queremos mapear a la aceleración del strobe.

### 5.3 Strobe Oscillator — generación segura

```
drive(t)   = max( D_norm(t), W_noise(t)·SI_smooth(t) )
rate_Hz(t) = R_min + (R_max − R_min)·drive(t)^1.5        R_min=4, R_max=12
duty       = 0.35 − 0.15·drive                            (flashes más cortos al acelerar)
φ(t)       = frac( φ(t−1) + rate_Hz·Δt )                  // acumulador de fase
gate(t)    = (φ < duty) && (drive > 0.15)                 // histéresis de armado abajo
```

**⚠️ SEGURIDAD FOTOSENSIBLE (no negociable):**
- `R_max = 12 Hz` **hard cap**. La zona de máximo riesgo de epilepsia fotosensible es 15-25Hz (norma ISO/WCAG: evitar >3 flashes/s en pantallas; en iluminación de espectáculo el estándar de facto es mantener strobes <12-13Hz o usar strobes >30Hz que se perciben continuos). El exponente 1.5 en drive hace la aceleración progresiva, nunca un salto.
- **Rate limiter:** `|rate(t) − rate(t−1)| ≤ 2 Hz/frame` — sin saltos bruscos de frecuencia.
- El Worker exporta `{active, rateHz, duty, drive}` — el HAL decide si usa el canal strobe nativo del fixture (preferido: la lámpara lo hace por hardware) o modula el dimmer con `gate`. El acumulador de fase en el Worker garantiza que TODOS los fixtures parpadean en fase.

```typescript
// ~10 ops/frame. Estado: 3 floats.
class StrobeEngine {
  private density = 0; private phase = 0; private lastRate = 0;

  update(onsetStrength: number, wNoise: number, si: number, dtMs: number)
      : { active: boolean; rateHz: number; duty: number; drive: number } {
    this.density = this.density * Math.exp(-dtMs / 400) + onsetStrength;
    const dNorm = clamp01((this.density - 1.5) / 6.0);
    const drive = Math.max(dNorm, wNoise * si);

    let rate = 4 + 8 * Math.pow(drive, 1.5);
    const maxStep = 2;                                   // rate limiter
    rate = clamp(rate, this.lastRate - maxStep, this.lastRate + maxStep);
    this.lastRate = rate;

    const duty = 0.35 - 0.15 * drive;
    this.phase = (this.phase + rate * dtMs / 1000) % 1;
    return { active: drive > 0.15 && this.phase < duty, rateHz: rate, duty, drive };
  }
}
```

---

## 6. CHROMA COUPLER — Armonía → Color

### 6.1 Fundamento

El chromagrama de 12 bins (WAVE 2301) ya existe con coste cero adicional. El mapeo natural es el **círculo de quintas → rueda de color**, no el cromático directo: acordes armónicamente cercanos (C→G) producen colores cercanos; modulaciones lejanas (C→F#) producen saltos de color dramáticos. Esto hace que la luz "entienda" la tensión armónica.

```
pc_wheel = (pc · 7) mod 12          // círculo de quintas: C=0, G=1, D=2, ...
hue      = pc_wheel · 30°           // 12 posiciones × 30° = 360°
```

### 6.2 Pitch class dominante con histéresis (anti-flicker)

```
pc*(t) = argmax_k chroma[k]
CAMBIO aceptado ⟺ chroma[pc*] > chroma[pc_actual] + 0.15   durante 3 frames consecutivos
```

Sin histéresis, el vibrato de una voz haría parpadear el color a 20Hz. Con margen 0.15 + 3 frames (~150ms), sólo los cambios armónicos reales conmutan.

### 6.3 Chroma Flux → Color Snap

La métrica de cambio armónico es la distancia L1 entre chromas consecutivos (12 restas):

```
CF_chroma(t) = Σ_{k=0}^{11} |c_t[k] − c_{t−1}[k]|         ∈ [0, 2]
```

**Lógica de dos modos, gobernada por SI:**

```
SI baja (música dinámica):
    hue_out(t) = circularLerp(hue_out(t−1), hue_target, 0.05)    // barrido suave ~1s

SI alta (muro de sonido) Y CF_chroma > 0.35:
    hue_out(t) = hue_target                                       // SNAP instantáneo
    snapPulse  = true                                             // flag para el HAL (flash blanco 1 frame opcional)
```

En el muro de Prydz: cada cambio de acorde del pad → CF_chroma spikes → snap de color agresivo y sincronizado con la armonía. Exactamente la visión de la directiva.

**Interpolación circular de hue (el camino corto por la rueda):**

```
Δ = ((target − current + 540) mod 360) − 180
hue_out = (current + k·Δ + 360) mod 360
```

```typescript
// ~30 ops/frame. Estado: pc actual + contador + hue + chroma previo (12 floats).
class ChromaCoupler {
  private pc = 0; private candidate = -1; private count = 0;
  private hue = 0; private prevChroma = new Float32Array(12);

  update(chroma: Float32Array, si: number)
      : { hue: number; snap: boolean; chromaFlux: number } {
    // 1. Chroma flux (L1)
    let cf = 0;
    for (let k = 0; k < 12; k++) {
      cf += Math.abs(chroma[k] - this.prevChroma[k]);
      this.prevChroma[k] = chroma[k];
    }
    // 2. Argmax con histéresis
    let best = 0, bestV = chroma[0];
    for (let k = 1; k < 12; k++) if (chroma[k] > bestV) { bestV = chroma[k]; best = k; }
    if (best !== this.pc && bestV > chroma[this.pc] + 0.15) {
      if (best === this.candidate) { if (++this.count >= 3) { this.pc = best; this.count = 0; } }
      else { this.candidate = best; this.count = 1; }
    } else { this.candidate = -1; this.count = 0; }
    // 3. Círculo de quintas → hue target
    const target = ((this.pc * 7) % 12) * 30;
    // 4. Snap vs lerp
    const snap = si > 0.6 && cf > 0.35;
    if (snap) this.hue = target;
    else {
      const d = ((target - this.hue + 540) % 360) - 180;
      this.hue = (this.hue + 0.05 * d + 360) % 360;
    }
    return { hue: this.hue, snap, chromaFlux: cf };
  }
}
```

---

## 7. DETECCIÓN DE ONSETS V3 — Envolventes Asimétricas sobre Flux

Sustituye `SlopeBasedOnsetDetector` por envolventes attack/release por banda, alimentadas con **flux** (inmune a brickwall) en vez de energía cruda:

```
env(t) = α·env(t−1) + (1−α)·x(t)
         α = α_atk si x > env   (attack:  kick 1 frame, snare 1, hihat 0)
         α = α_rel si x ≤ env   (release: kick ~4 frames, snare ~3, hihat ~2)

onset ⟺ env(t) − env(t−1) > max(θ_abs, 0.25·env(t))
```

**Supresión de bleed cymbal→snare** (aceptada del documento previo, en dominio flux):

```
snareInput = max(0, bandFlux.mid − 0.35·bandFlux.treble)
```

**Hook para Fase 2 (Micro-NN):** cada onset detectado se empaqueta como `OnsetCandidate {band, strength, centroid, flatness, fluxVector}` en un buffer pre-asignado. Hoy pasa directo; mañana un validador NN lo filtra sin tocar el pipeline.

---

## 8. CONTRATO DE SALIDA V3

Extensión retro-compatible de `GodEarSpectrum` — todos los campos existentes intactos, se añade el bloque fotónico:

```typescript
export interface GodEarPhoton {
  /** 0-1 — Saturation Index suavizado (el "Muro de Sonido") */
  saturation: number;
  /** 0-1 — Intensidad fotónica con piso anti-colapso: max(env, SI^0.7) */
  wallIntensity: number;
  /** Strobe dinámico sincronizado en fase */
  strobe: { active: boolean; rateHz: number; duty: number; drive: number };
  /** Color armónico */
  hue: number;            // 0-360, círculo de quintas
  colorSnap: boolean;     // true = cambio armónico brusco en régimen saturado
  chromaFlux: number;     // 0-2, velocidad de cambio armónico
  /** Diagnóstico */
  spectralFlux: number;   // flux total whitened
  transientDensity: number; // 0-1, densidad de redoble
  whiteNoiseScore: number;  // 0-1, sweep/ruido blanco
}

// GodEarSpectrum += photon: GodEarPhoton
// meta.version: '3.0.0'  (y purgar el '1.0.0' muerto del union type)
```

El HAL (`LiquidStereoPhysics` etc.) consume `photon.wallIntensity` como lower-bound de sus dimmers y `photon.strobe`/`photon.hue` como sugerencias que el NodeArbiter puede priorizar u honrar según capa. **La capa sensorial mide y sugiere; nunca escribe DMX directamente** — se respeta la doctrina de capas existente.

---

## 9. PRESUPUESTO FINAL Y FASES DE IMPLEMENTACIÓN

### Presupuesto por frame (N=4096, ~20fps)

| Bloque | Coste | Nuevo |
|--------|-------|-------|
| FFT + LUT | 0.32ms | optimizado |
| Power spectrum | 0.01ms | optimizado |
| Spectral flux + whitening | 0.02ms | ★ |
| Bandas LR4 + métricas (power) | 0.08ms | migrado |
| Chromagrama | 0.02ms | existente |
| SaturationMeter | <0.001ms | ★ |
| StrobeEngine | <0.001ms | ★ |
| ChromaCoupler | <0.001ms | ★ |
| Onsets asimétricos | <0.001ms | ★ |
| Output object | 0.02ms | existente |
| **TOTAL** | **~0.48ms** | **2.1x de margen sobre 1ms** |

Memoria adicional: LUT 16KB + prevPower/whitening 16KB + estados ~200 bytes = **~32KB**. Cero asignaciones en hot path (todo pre-asignado en constructor).

### Fases

1. **WAVE 8001 — Cosecha:** Twiddle LUT + Power Spectrum + migración de métricas. Verificable con el test suite de `GodEarFFT.radix2.ts` (Parseval + ground-truth DFT) extendido con comparación V2 vs V3 banda a banda (tolerancia <1e-5).
2. **WAVE 8002 — Flux:** computeSpectralFlux + bandFlux + onsets asimétricos + realimentación α-crossfade del IntervalBPMTracker.
3. **WAVE 8003 — Photon Block:** SaturationMeter + Wall Intensity + AGC freeze.
4. **WAVE 8004 — Strobe + Chroma Coupler** + contrato `GodEarPhoton` + consumo en HAL.
5. **WAVE 8005 (Fase 2, opcional):** Micro-NN Onset Validator cuando exista dataset del Shadow Logger.

### Criterios de validación (test cases musicales)

| Escenario | V2 (fallo) | V3 (esperado) |
|-----------|-----------|---------------|
| Opus (Prydz) — drop brickwalled | Luces se apagan/congelan | `wallIntensity ≥ SI^0.7 ≈ 0.85+`, BPM estable vía flux |
| Redoble de caja 16avos | Onsets perdidos, dimmer errático | `strobe.drive` rampa, rate 4→12Hz progresivo |
| Sweep ruido blanco (build-up) | Falsos kicks o silencio | `whiteNoiseScore` monótono → strobe acelerando |
| Balada dinámica con silencios | OK | Idéntico a V2 (SI≈0, crossfade α≈0 — cero regresión) |
| Breakdown sin percusión | PLL freewheel OK (WAVE 2179) | Igual + re-lock más rápido al volver el kick (flux) |

---

*"El muro de sonido no es la ausencia de ritmo — es el ritmo a máxima densidad. GodEar V3 no busca silencios: mide energía, densidad y armonía, y las convierte en fotones."*
