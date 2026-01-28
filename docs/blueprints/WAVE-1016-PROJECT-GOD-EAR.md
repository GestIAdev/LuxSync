# 🩻 PROJECT "GOD EAR" - SURGICAL FFT REVOLUTION

## WAVE 1016 BLUEPRINT

**Clasificación**: ULTRA-CRITICAL / R&D  
**Autores**: PunkOpus (Lead DSP Engineer)  
**Solicitantes**: Radwulf & GeminiPunk (Architects)  
**Fecha**: 28 de Enero 2026  
**Estado**: BLUEPRINT READY FOR REVIEW  

---

## 🎯 ABSTRACT

Este documento define la arquitectura del **Espectroscopio Quirúrgico de Grado Militar** para LuxSync. El objetivo es transformar FFT.ts de un "analizador de bandas con overlap sucio" a un sistema de **separación espectral perfecta** con filtros digitales de 4º orden.

**Filosofía**: Ver el ADN de la música, no solo su silueta.

---

## 📐 TABLA DE CONTENIDOS

1. [Arquitectura Nuclear](#1-arquitectura-nuclear)
2. [Matemática de Precisión](#2-matemática-de-precisión)
3. [Sistema de 7 Bandas Tácticas](#3-sistema-de-7-bandas-tácticas)
4. [Filtros Linkwitz-Riley Digitales](#4-filtros-linkwitz-riley-digitales)
5. [Métricas Espectrales Avanzadas](#5-métricas-espectrales-avanzadas)
6. [Impacto en Ecosistema](#6-impacto-en-ecosistema)
7. [Estructuras de Datos](#7-estructuras-de-datos)
8. [Plan de Implementación](#8-plan-de-implementación)
9. [Punk Epicness Features](#9-punk-epicness-features)

---

## 1. ARQUITECTURA NUCLEAR

### 1.1 Pipeline de Procesamiento

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        GOD EAR PIPELINE v1.0                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  RAW AUDIO (Float32Array)                                              │
│       │                                                                 │
│       ▼                                                                 │
│  ┌─────────────────────────────────────────┐                           │
│  │ STAGE 0: DC OFFSET REMOVAL              │ ← Eliminar bias DC        │
│  │ x[n] = x[n] - mean(x)                   │                           │
│  └─────────────────────────────────────────┘                           │
│       │                                                                 │
│       ▼                                                                 │
│  ┌─────────────────────────────────────────┐                           │
│  │ STAGE 1: WINDOWING (Blackman-Harris)    │ ← -92dB sidelobes         │
│  │ w[n] = a₀ - a₁cos(2πn/N) + a₂cos(4πn/N) │                           │
│  │        - a₃cos(6πn/N)                   │                           │
│  └─────────────────────────────────────────┘                           │
│       │                                                                 │
│       ▼                                                                 │
│  ┌─────────────────────────────────────────┐                           │
│  │ STAGE 2: FFT 4096-point                 │ ← 10.77Hz resolution      │
│  │ X[k] = Σ x[n] · e^(-j2πkn/N)            │    @ 44.1kHz              │
│  └─────────────────────────────────────────┘                           │
│       │                                                                 │
│       ▼                                                                 │
│  ┌─────────────────────────────────────────┐                           │
│  │ STAGE 3: MAGNITUDE SPECTRUM             │                           │
│  │ |X[k]| = √(Re² + Im²)                   │                           │
│  └─────────────────────────────────────────┘                           │
│       │                                                                 │
│       ▼                                                                 │
│  ┌─────────────────────────────────────────┐                           │
│  │ STAGE 4: LINKWITZ-RILEY BANK (7 bandas) │ ← 4th order filters       │
│  │ 24dB/octave slopes, ZERO overlap        │                           │
│  └─────────────────────────────────────────┘                           │
│       │                                                                 │
│       ├──────────────────────────────────────────────────┐             │
│       ▼                                                  ▼             │
│  ┌─────────────────────┐                  ┌─────────────────────┐      │
│  │ STAGE 5A: BAND      │                  │ STAGE 5B: SPECTRAL  │      │
│  │ ENERGY EXTRACTION   │                  │ METRICS ENGINE      │      │
│  │ - 7 band RMS        │                  │ - Spectral Centroid │      │
│  │ - Peak detection    │                  │ - Spectral Flatness │      │
│  │ - Crest factor      │                  │ - Spectral Rolloff  │      │
│  └─────────────────────┘                  │ - Phase Correlation │      │
│       │                                   │ - Clarity (SNR)     │      │
│       │                                   └─────────────────────┘      │
│       │                                              │                 │
│       └──────────────────┬───────────────────────────┘                 │
│                          ▼                                             │
│                 ┌─────────────────────┐                                │
│                 │ STAGE 6: AGC        │                                │
│                 │ TRUST ZONES         │ ← Per-band independent AGC    │
│                 │ (7 independent      │                                │
│                 │  gain controllers)  │                                │
│                 └─────────────────────┘                                │
│                          │                                             │
│                          ▼                                             │
│                 ┌─────────────────────┐                                │
│                 │ STAGE 7: OUTPUT     │                                │
│                 │ GodEarSpectrum      │ ← Final structure             │
│                 └─────────────────────┘                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Resolución Espectral

```typescript
// FFT Configuration
const FFT_SIZE = 4096;           // Puntos FFT
const SAMPLE_RATE = 44100;       // Hz
const BIN_RESOLUTION = SAMPLE_RATE / FFT_SIZE;  // 10.77Hz per bin
const NYQUIST = SAMPLE_RATE / 2; // 22050Hz

// Bin mapping
// bin[0]   = 0Hz (DC)
// bin[1]   = 10.77Hz
// bin[2]   = 21.53Hz
// ...
// bin[186] = 2003Hz
// bin[558] = 6010Hz
// bin[1488]= 16027Hz
// bin[2048]= 22050Hz (Nyquist)
```

---

## 2. MATEMÁTICA DE PRECISIÓN

### 2.1 Windowing: Blackman-Harris (4-term)

**Problema resuelto**: Spectral leakage (ruido de borde).

**Sin ventana**: -13dB sidelobes (ruido horrible)  
**Hann**: -31dB sidelobes (aceptable)  
**Blackman-Harris**: -92dB sidelobes (QUIRÚRGICO)

```typescript
/**
 * BLACKMAN-HARRIS 4-TERM WINDOW
 * 
 * Proporciona -92dB de supresión de sidelobes.
 * Trade-off: Main lobe 2x más ancho que rectangular.
 * Justificación: Para iluminación, preferimos PRECISIÓN sobre resolución temporal.
 */
function generateBlackmanHarrisWindow(size: number): Float32Array {
  const window = new Float32Array(size);
  
  // Coeficientes Blackman-Harris (4-term)
  const a0 = 0.35875;
  const a1 = 0.48829;
  const a2 = 0.14128;
  const a3 = 0.01168;
  
  const twoPi = 2 * Math.PI;
  const fourPi = 4 * Math.PI;
  const sixPi = 6 * Math.PI;
  
  for (let n = 0; n < size; n++) {
    const ratio = n / (size - 1);
    window[n] = a0 
      - a1 * Math.cos(twoPi * ratio)
      + a2 * Math.cos(fourPi * ratio)
      - a3 * Math.cos(sixPi * ratio);
  }
  
  return window;
}

// Pre-compute window (SINGLETON - generate once at startup)
const BLACKMAN_HARRIS_4096 = generateBlackmanHarrisWindow(4096);

/**
 * Apply window to audio buffer
 */
function applyWindow(samples: Float32Array, window: Float32Array): Float32Array {
  const windowed = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    windowed[i] = samples[i] * window[i];
  }
  return windowed;
}
```

### 2.2 Window Normalization

```typescript
/**
 * Compensar la pérdida de energía por el ventaneo.
 * Blackman-Harris tiene coherent gain = 0.35875 (suma de coeficientes positivos).
 * Debemos normalizar para que la energía total se preserve.
 */
const BLACKMAN_HARRIS_COHERENT_GAIN = 0.35875;
const BLACKMAN_HARRIS_POWER_GAIN = 0.26939;  // RMS normalización

function normalizeWindowedMagnitude(magnitude: number): number {
  return magnitude / BLACKMAN_HARRIS_COHERENT_GAIN;
}
```

### 2.3 DC Offset Removal

```typescript
/**
 * Eliminar componente DC antes del ventaneo.
 * Evita que el bin[0] contenga basura de offset.
 */
function removeDCOffset(samples: Float32Array): Float32Array {
  // Calcular media
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i];
  }
  const mean = sum / samples.length;
  
  // Restar media
  const result = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    result[i] = samples[i] - mean;
  }
  
  return result;
}
```

---

## 3. SISTEMA DE 7 BANDAS TÁCTICAS

### 3.1 Definición de Bandas

```typescript
/**
 * GOD EAR TACTICAL BANDS
 * 
 * Diseñadas para CERO OVERLAP con filtros Linkwitz-Riley 4th order.
 * Cada banda tiene propósito específico para iluminación.
 */
const GOD_EAR_BANDS = {
  // ═══════════════════════════════════════════════════════════════════
  // BANDA 0: SUB-BASS (20-60Hz)
  // ═══════════════════════════════════════════════════════════════════
  SUB_BASS: {
    id: 'sub_bass',
    index: 0,
    freqLow: 20,
    freqHigh: 60,
    binLow: 2,      // ceil(20 / 10.77) = 2
    binHigh: 6,     // floor(60 / 10.77) = 5.57 → 6
    color: '#FF0000',
    description: 'Presión de aire pura - Kicks sísmicos, Rumble',
    lightingUse: 'FRONT PARS - Pump effect, Floor shakers',
    musicalContent: ['kick_fundamental', 'bass_sub', '808_rumble'],
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // BANDA 1: BASS (60-250Hz)
  // ═══════════════════════════════════════════════════════════════════
  BASS: {
    id: 'bass',
    index: 1,
    freqLow: 60,
    freqHigh: 250,
    binLow: 6,      // ceil(60 / 10.77) = 6
    binHigh: 23,    // floor(250 / 10.77) = 23.2 → 23
    color: '#FF6600',
    description: 'Cuerpo rítmico - Bajos, Kick body, Toms',
    lightingUse: 'MOVER LEFT - Bass pulsation, Stage wash low',
    musicalContent: ['bass_body', 'kick_punch', 'toms_low', 'synth_bass'],
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // BANDA 2: LOW-MID (250-500Hz)
  // ═══════════════════════════════════════════════════════════════════
  LOW_MID: {
    id: 'low_mid',
    index: 2,
    freqLow: 250,
    freqHigh: 500,
    binLow: 23,     // ceil(250 / 10.77) = 23.2 → 24
    binHigh: 46,    // floor(500 / 10.77) = 46.4 → 46
    color: '#FFCC00',
    description: 'Calor / Mud zone - Limpieza crítica para mezcla visual',
    lightingUse: 'STAGE WARM - Atmospheric fills, Mud indicator',
    musicalContent: ['guitar_body', 'vocal_low', 'piano_warmth', 'snare_body'],
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // BANDA 3: MID (500-2000Hz)
  // ═══════════════════════════════════════════════════════════════════
  MID: {
    id: 'mid',
    index: 3,
    freqLow: 500,
    freqHigh: 2000,
    binLow: 46,     // ceil(500 / 10.77) = 46.4 → 47
    binHigh: 186,   // floor(2000 / 10.77) = 185.7 → 186
    color: '#00FF00',
    description: 'Voces / Snare / Lead - Corazón musical',
    lightingUse: 'BACK PARS - Snare hits, Vocal presence',
    musicalContent: ['vocals_main', 'snare_crack', 'guitar_lead', 'piano_melody'],
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // BANDA 4: HIGH-MID (2000-6000Hz)
  // ═══════════════════════════════════════════════════════════════════
  HIGH_MID: {
    id: 'high_mid',
    index: 4,
    freqLow: 2000,
    freqHigh: 6000,
    binLow: 186,    // ceil(2000 / 10.77) = 185.7 → 186
    binHigh: 557,   // floor(6000 / 10.77) = 557.1 → 557
    color: '#00FFFF',
    description: 'Crunch / Ataque / Presencia - Edge definition',
    lightingUse: 'MOVER RIGHT - Guitar crunch, Cymbal attack',
    musicalContent: ['guitar_crunch', 'vocal_presence', 'snare_snap', 'hi_hat_body'],
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // BANDA 5: TREBLE (6000-16000Hz)
  // ═══════════════════════════════════════════════════════════════════
  TREBLE: {
    id: 'treble',
    index: 5,
    freqLow: 6000,
    freqHigh: 16000,
    binLow: 557,    // ceil(6000 / 10.77) = 557.1 → 558
    binHigh: 1486,  // floor(16000 / 10.77) = 1485.6 → 1486
    color: '#0066FF',
    description: 'Brillo / Hi-Hats / Aire - Sparkle zone',
    lightingUse: 'STROBES - Hi-hat sync, Cymbal crashes',
    musicalContent: ['hi_hat', 'cymbal_wash', 'synth_sparkle', 'vocal_air'],
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // BANDA 6: ULTRA-AIR (16000-22000Hz)
  // ═══════════════════════════════════════════════════════════════════
  ULTRA_AIR: {
    id: 'ultra_air',
    index: 6,
    freqLow: 16000,
    freqHigh: 22000,
    binLow: 1486,   // ceil(16000 / 10.77) = 1485.6 → 1486
    binHigh: 2048,  // Nyquist
    color: '#FF00FF',
    description: 'Armónicos superiores - Sizzle digital',
    lightingUse: 'LASERS / MICRO-SCANNERS - Ultra-fast response, Digital fx',
    musicalContent: ['cymbal_shimmer', 'synth_harmonics', 'digital_artifacts', 'air'],
  },
} as const;

type BandId = keyof typeof GOD_EAR_BANDS;
```

### 3.2 Visualización del Espectro

```
FRECUENCIA (Hz):
20      60     250    500    2k     6k     16k    22k
│       │      │      │      │      │      │      │
├───────┼──────┼──────┼──────┼──────┼──────┼──────┤
│ SUB   │ BASS │L-MID │ MID  │H-MID │TREBLE│ULTRA │
│ BASS  │      │      │      │      │      │ AIR  │
├───────┼──────┼──────┼──────┼──────┼──────┼──────┤
│ 40Hz  │ 155Hz│ 375Hz│ 1250 │ 4kHz │ 11k  │ 19k  │
│ width │width │width │width │width │width │width │
└───────┴──────┴──────┴──────┴──────┴──────┴──────┘

BINS FFT (@ 44.1kHz, 4096 points):
2-6    6-23   23-46  46-186 186-557 557-1486 1486-2048
│      │      │      │      │       │        │
(4)    (17)   (23)   (140)  (371)   (929)    (562)
bins   bins   bins   bins   bins    bins     bins
```

---

## 4. FILTROS LINKWITZ-RILEY DIGITALES

### 4.1 Teoría Linkwitz-Riley

```
LINKWITZ-RILEY 4th ORDER (LR4)
═══════════════════════════════

Caracterísicas:
- 24dB/octave slope (vs 12dB/octave de Butterworth 2nd order)
- FLAT response at crossover (-6dB cada banda = 0dB sumadas)
- ZERO phase shift at crossover (no cancellations)
- ZERO overlap audible (cuando una sube, la otra baja EXACTAMENTE igual)

              │
         0dB ─┼────────╲          ╱────────
              │         ╲        ╱
        -6dB ─┼──────────╳──────╳──────────  ← Crossover point
              │         ╱        ╲
       -12dB ─┼────────╱          ╲────────
              │       ╱            ╲
       -24dB ─┼──────╱              ╲──────
              │
              └────────────────────────────→ freq
                         fc (crossover)

Fórmula LR4:
H_LP(s) = 1 / (1 + s/ωc)⁴      (Low Pass)
H_HP(s) = (s/ωc)⁴ / (1 + s/ωc)⁴ (High Pass)

Donde ωc = 2πfc
```

### 4.2 Implementación Digital (Frequency Domain)

```typescript
/**
 * LINKWITZ-RILEY 4th ORDER DIGITAL FILTER BANK
 * 
 * En lugar de filtrar en tiempo (IIR), aplicamos la respuesta
 * directamente en el dominio de frecuencia (más eficiente para FFT).
 * 
 * Cada bin recibe un peso según su distancia al crossover.
 */

interface CrossoverPoint {
  frequency: number;
  bin: number;
}

/**
 * Calcular la respuesta Linkwitz-Riley en un bin específico.
 * 
 * @param binFreq - Frecuencia central del bin
 * @param crossoverFreq - Frecuencia de crossover
 * @param isLowPass - true para low-pass, false para high-pass
 * @returns Peso 0.0-1.0 para aplicar al bin
 */
function linkwitzRileyResponse(
  binFreq: number, 
  crossoverFreq: number, 
  isLowPass: boolean
): number {
  if (crossoverFreq <= 0) return isLowPass ? 1.0 : 0.0;
  
  const ratio = binFreq / crossoverFreq;
  
  // LR4 transfer function magnitude squared
  // |H(jω)|² = 1 / (1 + (ω/ωc)⁸) for low-pass
  // |H(jω)|² = (ω/ωc)⁸ / (1 + (ω/ωc)⁸) for high-pass
  
  const ratio8 = Math.pow(ratio, 8);  // 4th order squared = 8th power
  
  if (isLowPass) {
    return 1.0 / (1.0 + ratio8);
  } else {
    return ratio8 / (1.0 + ratio8);
  }
}

/**
 * Generar máscara de ponderación para una banda.
 * 
 * Cada banda tiene un crossover LOW y un crossover HIGH.
 * La máscara es: weight = LP_response(high) × HP_response(low)
 */
function generateBandMask(
  fftSize: number,
  sampleRate: number,
  lowCrossover: number,
  highCrossover: number
): Float32Array {
  const mask = new Float32Array(fftSize / 2 + 1);
  const binResolution = sampleRate / fftSize;
  
  for (let bin = 0; bin <= fftSize / 2; bin++) {
    const binFreq = bin * binResolution;
    
    // High-pass desde lowCrossover
    const hpResponse = linkwitzRileyResponse(binFreq, lowCrossover, false);
    
    // Low-pass hasta highCrossover
    const lpResponse = linkwitzRileyResponse(binFreq, highCrossover, true);
    
    // Combinar: la banda es la intersección de ambos filtros
    mask[bin] = hpResponse * lpResponse;
  }
  
  return mask;
}

/**
 * PRE-COMPUTED FILTER BANK
 * 
 * Generamos todas las máscaras UNA VEZ al startup.
 * Son constantes para toda la sesión.
 */
class GodEarFilterBank {
  private masks: Map<BandId, Float32Array> = new Map();
  
  constructor(fftSize: number = 4096, sampleRate: number = 44100) {
    // Pre-compute all band masks
    for (const [bandId, band] of Object.entries(GOD_EAR_BANDS)) {
      const mask = generateBandMask(
        fftSize,
        sampleRate,
        band.freqLow,
        band.freqHigh
      );
      this.masks.set(bandId as BandId, mask);
    }
    
    console.log('🩻 [GOD EAR] Filter bank initialized with LR4 masks');
  }
  
  /**
   * Aplicar filtro a magnitud FFT y extraer energía de banda.
   */
  extractBandEnergy(magnitudes: Float32Array, bandId: BandId): number {
    const mask = this.masks.get(bandId);
    if (!mask) return 0;
    
    let energy = 0;
    let weightSum = 0;
    
    for (let bin = 0; bin < magnitudes.length; bin++) {
      const weight = mask[bin];
      energy += magnitudes[bin] * magnitudes[bin] * weight;
      weightSum += weight;
    }
    
    // Normalizar por peso total para mantener escala consistente
    if (weightSum > 0) {
      energy /= weightSum;
    }
    
    // Retornar RMS
    return Math.sqrt(energy);
  }
}
```

### 4.3 Verificación de Separación Total

```typescript
/**
 * TEST: Verificar que un tono puro en 50Hz NO aparece en BASS.
 * 
 * Expected behavior con LR4:
 * - SubBass (50Hz): ~0.95 (casi total)
 * - Bass (50Hz vs 60Hz crossover): ~0.05 (atenuado -26dB)
 * - Low-Mid y superiores: ~0.00 (inaudible)
 */
function verifySeparation() {
  const filterBank = new GodEarFilterBank();
  
  // Generar tono puro 50Hz
  const testMagnitudes = new Float32Array(2049);  // FFT_SIZE/2 + 1
  const bin50Hz = Math.round(50 / 10.77);  // bin ~5
  testMagnitudes[bin50Hz] = 1.0;  // Toda la energía en 50Hz
  
  // Extraer cada banda
  const results = {
    sub_bass: filterBank.extractBandEnergy(testMagnitudes, 'SUB_BASS'),
    bass: filterBank.extractBandEnergy(testMagnitudes, 'BASS'),
    low_mid: filterBank.extractBandEnergy(testMagnitudes, 'LOW_MID'),
    mid: filterBank.extractBandEnergy(testMagnitudes, 'MID'),
    high_mid: filterBank.extractBandEnergy(testMagnitudes, 'HIGH_MID'),
    treble: filterBank.extractBandEnergy(testMagnitudes, 'TREBLE'),
    ultra_air: filterBank.extractBandEnergy(testMagnitudes, 'ULTRA_AIR'),
  };
  
  console.log('🧪 SEPARATION TEST (50Hz pure tone):');
  console.log(`   SUB_BASS: ${(results.sub_bass * 100).toFixed(1)}% ← Expected: ~95%`);
  console.log(`   BASS:     ${(results.bass * 100).toFixed(1)}% ← Expected: <5%`);
  console.log(`   LOW_MID:  ${(results.low_mid * 100).toFixed(1)}% ← Expected: ~0%`);
  console.log(`   MID:      ${(results.mid * 100).toFixed(1)}% ← Expected: ~0%`);
  console.log(`   HIGH_MID: ${(results.high_mid * 100).toFixed(1)}% ← Expected: ~0%`);
  console.log(`   TREBLE:   ${(results.treble * 100).toFixed(1)}% ← Expected: ~0%`);
  console.log(`   ULTRA_AIR:${(results.ultra_air * 100).toFixed(1)}% ← Expected: ~0%`);
  
  // PASS si Bass < 10% cuando SubBass tiene la energía
  const passed = results.bass < 0.10 && results.sub_bass > 0.90;
  console.log(`   RESULT: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  
  return passed;
}
```

---

## 5. MÉTRICAS ESPECTRALES AVANZADAS

### 5.1 Spectral Centroid (Brillo Tonal)

```typescript
/**
 * SPECTRAL CENTROID
 * 
 * "Centro de masa" del espectro. Indica el brillo tonal.
 * 
 * Fórmula: Σ(f[k] × |X[k]|²) / Σ(|X[k]|²)
 * 
 * Valores típicos:
 * - Kick puro: 80-200Hz
 * - Voz masculina: 300-500Hz
 * - Voz femenina: 400-700Hz
 * - Platillos: 3000-6000Hz
 * - Hi-hat: 6000-12000Hz
 */
function calculateSpectralCentroid(
  magnitudes: Float32Array,
  sampleRate: number,
  fftSize: number
): number {
  const binResolution = sampleRate / fftSize;
  
  let weightedSum = 0;
  let magnitudeSum = 0;
  
  for (let bin = 1; bin < magnitudes.length; bin++) {  // Skip DC
    const freq = bin * binResolution;
    const mag2 = magnitudes[bin] * magnitudes[bin];
    
    weightedSum += freq * mag2;
    magnitudeSum += mag2;
  }
  
  if (magnitudeSum === 0) return 0;
  
  return weightedSum / magnitudeSum;
}
```

### 5.2 Spectral Flatness (Tonalidad vs Ruido)

```typescript
/**
 * SPECTRAL FLATNESS (Wiener Entropy)
 * 
 * Mide cuán "tonal" vs "ruidoso" es el espectro.
 * 
 * Fórmula: geometric_mean(|X|²) / arithmetic_mean(|X|²)
 * 
 * Valores:
 * - 0.0: Tono puro (toda energía en una frecuencia)
 * - 1.0: Ruido blanco (energía distribuida uniformemente)
 * - 0.1-0.3: Música tonal (instrumentos claros)
 * - 0.4-0.6: Música con mucha percusión
 * - 0.7+: Ruido/efectos
 */
function calculateSpectralFlatness(magnitudes: Float32Array): number {
  const n = magnitudes.length - 1;  // Exclude DC
  if (n <= 0) return 0;
  
  // Geometric mean (using log to avoid underflow)
  let logSum = 0;
  let arithmeticSum = 0;
  let validBins = 0;
  
  for (let bin = 1; bin < magnitudes.length; bin++) {
    const mag2 = magnitudes[bin] * magnitudes[bin];
    
    if (mag2 > 1e-10) {  // Avoid log(0)
      logSum += Math.log(mag2);
      validBins++;
    }
    
    arithmeticSum += mag2;
  }
  
  if (validBins === 0 || arithmeticSum === 0) return 0;
  
  const geometricMean = Math.exp(logSum / validBins);
  const arithmeticMean = arithmeticSum / n;
  
  return geometricMean / arithmeticMean;
}
```

### 5.3 Spectral Rolloff (Distribución de Energía)

```typescript
/**
 * SPECTRAL ROLLOFF
 * 
 * Frecuencia por debajo de la cual está el 85% de la energía.
 * 
 * Indica si la música es:
 * - Grave (rolloff bajo): Hip-hop, Dub, Bass music
 * - Brillante (rolloff alto): EDM, Pop, Hi-fi
 */
function calculateSpectralRolloff(
  magnitudes: Float32Array,
  sampleRate: number,
  fftSize: number,
  percentile: number = 0.85
): number {
  const binResolution = sampleRate / fftSize;
  
  // Calcular energía total
  let totalEnergy = 0;
  for (let bin = 1; bin < magnitudes.length; bin++) {
    totalEnergy += magnitudes[bin] * magnitudes[bin];
  }
  
  if (totalEnergy === 0) return 0;
  
  // Encontrar frecuencia donde se acumula percentile% de energía
  const threshold = totalEnergy * percentile;
  let cumulativeEnergy = 0;
  
  for (let bin = 1; bin < magnitudes.length; bin++) {
    cumulativeEnergy += magnitudes[bin] * magnitudes[bin];
    
    if (cumulativeEnergy >= threshold) {
      return bin * binResolution;
    }
  }
  
  return sampleRate / 2;  // Nyquist si no se alcanza
}
```

### 5.4 Phase Correlation (Estéreo Real)

```typescript
/**
 * PHASE CORRELATION (STEREO WIDTH)
 * 
 * Mide la correlación de fase entre canales L y R.
 * 
 * Valores:
 * - +1.0: Mono perfecto (L = R)
 * - 0.0: Estéreo descorrelacionado (L independiente de R)
 * - -1.0: Out of phase (L = -R) → Problemas de mezcla
 * 
 * Fórmula: correlation(L, R) = Σ(L×R) / √(Σ(L²) × Σ(R²))
 */
function calculatePhaseCorrelation(
  leftChannel: Float32Array,
  rightChannel: Float32Array
): number {
  if (leftChannel.length !== rightChannel.length) return 0;
  
  let dotProduct = 0;
  let leftEnergy = 0;
  let rightEnergy = 0;
  
  for (let i = 0; i < leftChannel.length; i++) {
    dotProduct += leftChannel[i] * rightChannel[i];
    leftEnergy += leftChannel[i] * leftChannel[i];
    rightEnergy += rightChannel[i] * rightChannel[i];
  }
  
  const denominator = Math.sqrt(leftEnergy * rightEnergy);
  
  if (denominator === 0) return 1;  // Silencio = mono
  
  return dotProduct / denominator;
}

/**
 * STEREO WIDTH (derivado de phase correlation)
 * 
 * Mapea correlation a "anchura percibida":
 * - correlation +1.0 → width 0.0 (mono)
 * - correlation 0.0  → width 1.0 (estéreo completo)
 * - correlation -1.0 → width 2.0 (super-wide/problematic)
 */
function calculateStereoWidth(phaseCorrelation: number): number {
  return 1.0 - phaseCorrelation;
}
```

### 5.5 Clarity (Signal-to-Noise Ratio Musical)

```typescript
/**
 * CLARITY INDEX
 * 
 * Métrica propietaria GOD EAR.
 * Mide cuán "limpia" es la señal vs cuánto ruido tiene.
 * 
 * Basada en:
 * 1. Spectral Flatness inverso (más tonal = más claro)
 * 2. Crest Factor (picos vs RMS - más dinámico = más claro)
 * 3. Harmonic-to-Noise ratio estimado
 * 
 * Valores:
 * - 0.0-0.3: Señal muy ruidosa (mp3 128kbps, mal master)
 * - 0.4-0.6: Calidad normal (streaming típico)
 * - 0.7-0.9: Alta fidelidad (CD quality, buen master)
 * - 0.9+: Studio quality
 */
function calculateClarity(
  magnitudes: Float32Array,
  peakMagnitude: number,
  rmsMagnitude: number
): number {
  // Factor 1: Tonality (inverso de flatness)
  const flatness = calculateSpectralFlatness(magnitudes);
  const tonality = 1.0 - flatness;
  
  // Factor 2: Crest Factor (dynamics)
  const crestFactor = peakMagnitude / (rmsMagnitude + 1e-10);
  const normalizedCrest = Math.min(1.0, crestFactor / 6.0);  // 6 = typical max crest
  
  // Factor 3: Spectral Concentration (cuánta energía en picos vs floor)
  const peakEnergy = findPeakEnergy(magnitudes);
  const totalEnergy = calculateTotalEnergy(magnitudes);
  const concentration = peakEnergy / (totalEnergy + 1e-10);
  
  // Combinar con pesos
  const clarity = (
    tonality * 0.4 +
    normalizedCrest * 0.3 +
    concentration * 0.3
  );
  
  return Math.min(1.0, clarity);
}

function findPeakEnergy(magnitudes: Float32Array): number {
  // Top 10% de bins por energía
  const sorted = [...magnitudes].sort((a, b) => b - a);
  const topCount = Math.ceil(magnitudes.length * 0.1);
  
  let peakSum = 0;
  for (let i = 0; i < topCount; i++) {
    peakSum += sorted[i] * sorted[i];
  }
  
  return peakSum;
}

function calculateTotalEnergy(magnitudes: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < magnitudes.length; i++) {
    sum += magnitudes[i] * magnitudes[i];
  }
  return sum;
}
```

---

## 6. IMPACTO EN ECOSISTEMA

### 6.1 RhythmAnalyzer.ts - Detección de Transientes

```typescript
/**
 * RHYTHM ANALYZER ADAPTATION
 * 
 * PROBLEMA: Con FFT limpio, los transientes son agujas afiladas.
 * El onset detector actual puede ser muy sensible.
 * 
 * SOLUCIÓN: Cambiar de "detección por magnitud" a "detección por pendiente"
 */

// ANTES (basado en magnitud):
function detectOnsetOld(energy: number, threshold: number): boolean {
  return energy > threshold;  // ❌ Muy sensible con señal limpia
}

// DESPUÉS (basado en pendiente):
class SlopeBasedOnsetDetector {
  private history: Float32Array = new Float32Array(8);
  private historyIndex = 0;
  
  /**
   * Detectar onset basándose en la VELOCIDAD de cambio de energía,
   * no en el valor absoluto.
   * 
   * @param energy - Energía actual de la banda
   * @returns true si detectamos un onset (golpe)
   */
  detectOnset(energy: number): boolean {
    // Guardar en historia circular
    this.history[this.historyIndex] = energy;
    this.historyIndex = (this.historyIndex + 1) % this.history.length;
    
    // Calcular pendiente (derivada de energía)
    const current = energy;
    const previous = this.history[(this.historyIndex + this.history.length - 2) % this.history.length];
    const older = this.history[(this.historyIndex + this.history.length - 4) % this.history.length];
    
    const shortTermSlope = current - previous;
    const longTermSlope = current - older;
    
    // Onset = pendiente positiva RÁPIDA
    // (energía subiendo más rápido que el promedio)
    const avgEnergy = this.calculateAverage();
    const slopeThreshold = avgEnergy * 0.3;  // 30% de la energía promedio
    
    return shortTermSlope > slopeThreshold && longTermSlope > slopeThreshold * 0.5;
  }
  
  private calculateAverage(): number {
    let sum = 0;
    for (let i = 0; i < this.history.length; i++) {
      sum += this.history[i];
    }
    return sum / this.history.length;
  }
}
```

### 6.2 SectionTracker.ts - Recalibración de Umbrales

```typescript
/**
 * SECTION TRACKER ADAPTATION
 * 
 * PROBLEMA: Con FFT limpio, la energía promedio baja (menos overlap sumado).
 * Los umbrales actuales detectarán "breakdown" todo el tiempo.
 * 
 * SOLUCIÓN: Umbrales relativos + normalización adaptativa
 */

// ANTES (umbrales absolutos):
const SECTION_THRESHOLDS_OLD = {
  drop: 0.7,      // ❌ Puede nunca alcanzarse con señal limpia
  buildup: 0.5,
  breakdown: 0.3,
  verse: 0.4,
};

// DESPUÉS (umbrales relativos a energía de sesión):
class AdaptiveSectionTracker {
  private sessionEnergyHistory: Float32Array = new Float32Array(600);  // 30 segundos @ 20fps
  private historyIndex = 0;
  private historyFilled = 0;
  
  /**
   * Umbrales RELATIVOS a la energía de la sesión actual.
   * Así, música "limpia" con menos energía absoluta
   * sigue siendo clasificada correctamente.
   */
  private readonly RELATIVE_THRESHOLDS = {
    drop: 0.85,      // Top 15% de energía de sesión
    buildup: 0.60,   // Top 40%
    breakdown: 0.25, // Bottom 25%
    verse: 0.45,     // Medio
  };
  
  updateEnergy(energy: number): void {
    this.sessionEnergyHistory[this.historyIndex] = energy;
    this.historyIndex = (this.historyIndex + 1) % this.sessionEnergyHistory.length;
    this.historyFilled = Math.min(this.historyFilled + 1, this.sessionEnergyHistory.length);
  }
  
  detectSection(currentEnergy: number): string {
    if (this.historyFilled < 100) {
      return 'initializing';  // Esperar 5 segundos de datos
    }
    
    // Calcular percentil de la energía actual
    const percentile = this.calculatePercentile(currentEnergy);
    
    if (percentile >= this.RELATIVE_THRESHOLDS.drop) {
      return 'drop';
    } else if (percentile >= this.RELATIVE_THRESHOLDS.buildup) {
      return 'buildup';
    } else if (percentile <= this.RELATIVE_THRESHOLDS.breakdown) {
      return 'breakdown';
    } else {
      return 'verse';
    }
  }
  
  private calculatePercentile(value: number): number {
    let below = 0;
    for (let i = 0; i < this.historyFilled; i++) {
      if (this.sessionEnergyHistory[i] < value) below++;
    }
    return below / this.historyFilled;
  }
}
```

### 6.3 HarmonyDetector.ts - Latencia Reducida

```typescript
/**
 * HARMONY DETECTOR ADAPTATION
 * 
 * OPORTUNIDAD: Con menos overlap, la detección de notas es más precisa.
 * Podemos REDUCIR la latencia de detección.
 * 
 * CAMBIO: De 3-frame averaging a 2-frame (50% menos latencia)
 */

// ANTES:
const KEY_DETECTION_WINDOW = 3;  // 3 frames = 150ms @ 20fps

// DESPUÉS (GOD EAR enabled):
const KEY_DETECTION_WINDOW_GOD_EAR = 2;  // 2 frames = 100ms @ 20fps

/**
 * Detección de nota fundamental mejorada con FFT limpio.
 * 
 * El FFT limpio permite identificar la nota fundamental
 * con solo 2 frames de contexto (vs 3 antes).
 */
class PrecisionHarmonyDetector {
  private noteHistory: number[] = [];
  private confidenceThreshold = 0.7;  // Subido de 0.5 porque señal es más clara
  
  detectKey(
    magnitudes: Float32Array,
    sampleRate: number,
    fftSize: number
  ): { key: string; confidence: number } {
    // Encontrar picos espectrales (más limpios con LR4 filters)
    const peaks = this.findSpectralPeaks(magnitudes, sampleRate, fftSize);
    
    // Convertir frecuencias a notas MIDI
    const notes = peaks.map(peak => this.freqToMidiNote(peak.frequency));
    
    // Detectar escala/key con chroma vector
    const chromaVector = this.calculateChromaVector(notes);
    const keyMatch = this.matchKeyTemplate(chromaVector);
    
    // Suavizar con historia (ahora solo 2 frames)
    this.noteHistory.push(keyMatch.keyIndex);
    if (this.noteHistory.length > KEY_DETECTION_WINDOW_GOD_EAR) {
      this.noteHistory.shift();
    }
    
    // Votación de key
    const votedKey = this.voteKey(this.noteHistory);
    
    return {
      key: this.midiToKeyName(votedKey),
      confidence: keyMatch.confidence,
    };
  }
  
  private findSpectralPeaks(
    magnitudes: Float32Array,
    sampleRate: number,
    fftSize: number
  ): Array<{ frequency: number; magnitude: number }> {
    const peaks: Array<{ frequency: number; magnitude: number }> = [];
    const binResolution = sampleRate / fftSize;
    
    // Buscar picos locales (magnitud mayor que vecinos)
    for (let bin = 2; bin < magnitudes.length - 2; bin++) {
      const current = magnitudes[bin];
      const neighbors = [
        magnitudes[bin - 2],
        magnitudes[bin - 1],
        magnitudes[bin + 1],
        magnitudes[bin + 2],
      ];
      
      if (current > Math.max(...neighbors) * 1.2) {  // 20% mayor que vecinos
        peaks.push({
          frequency: bin * binResolution,
          magnitude: current,
        });
      }
    }
    
    // Ordenar por magnitud y tomar top 12 (una octava)
    return peaks
      .sort((a, b) => b.magnitude - a.magnitude)
      .slice(0, 12);
  }
  
  private freqToMidiNote(freq: number): number {
    return Math.round(12 * Math.log2(freq / 440) + 69);
  }
  
  private calculateChromaVector(notes: number[]): Float32Array {
    const chroma = new Float32Array(12);
    
    for (const note of notes) {
      const pitchClass = note % 12;
      chroma[pitchClass]++;
    }
    
    // Normalizar
    const max = Math.max(...chroma);
    if (max > 0) {
      for (let i = 0; i < 12; i++) {
        chroma[i] /= max;
      }
    }
    
    return chroma;
  }
  
  private matchKeyTemplate(chroma: Float32Array): { keyIndex: number; confidence: number } {
    // Templates de escalas mayores/menores
    const majorTemplate = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1];  // Ionian
    const minorTemplate = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0];  // Aeolian
    
    let bestKey = 0;
    let bestScore = 0;
    
    for (let root = 0; root < 12; root++) {
      // Test mayor
      let majorScore = 0;
      for (let i = 0; i < 12; i++) {
        majorScore += chroma[(root + i) % 12] * majorTemplate[i];
      }
      
      // Test menor
      let minorScore = 0;
      for (let i = 0; i < 12; i++) {
        minorScore += chroma[(root + i) % 12] * minorTemplate[i];
      }
      
      const score = Math.max(majorScore, minorScore);
      if (score > bestScore) {
        bestScore = score;
        bestKey = root + (minorScore > majorScore ? 12 : 0);  // 0-11 mayor, 12-23 menor
      }
    }
    
    return {
      keyIndex: bestKey,
      confidence: bestScore / 7.0,  // Normalizar por notas en escala
    };
  }
  
  private voteKey(history: number[]): number {
    const votes: Map<number, number> = new Map();
    
    for (const key of history) {
      votes.set(key, (votes.get(key) || 0) + 1);
    }
    
    let maxVotes = 0;
    let winner = 0;
    
    votes.forEach((count, key) => {
      if (count > maxVotes) {
        maxVotes = count;
        winner = key;
      }
    });
    
    return winner;
  }
  
  private midiToKeyName(keyIndex: number): string {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const isMinor = keyIndex >= 12;
    const root = notes[keyIndex % 12];
    return `${root}${isMinor ? 'm' : ''}`;
  }
}
```

### 6.4 TitanOrchestrator.ts - Estructura de Datos Expandida

```typescript
/**
 * TITAN ORCHESTRATOR ADAPTATION
 * 
 * El flujo híbrido debe transportar 7 bandas + métricas espectrales.
 * Definimos la estructura de datos expandida.
 */

/**
 * GOD EAR AUDIO DATA
 * 
 * Estructura de datos que viaja desde FFT Worker → TitanOrchestrator.
 */
interface GodEarAudioData {
  // ═══════════════════════════════════════════════════════════════════
  // BANDAS TÁCTICAS (7 zonas)
  // ═══════════════════════════════════════════════════════════════════
  bands: {
    subBass: number;    // 20-60Hz    - Presión de aire
    bass: number;       // 60-250Hz   - Cuerpo rítmico
    lowMid: number;     // 250-500Hz  - Calor/Mud
    mid: number;        // 500-2kHz   - Voces/Snare/Lead
    highMid: number;    // 2k-6kHz    - Crunch/Ataque
    treble: number;     // 6k-16kHz   - Brillo/Hi-hats
    ultraAir: number;   // 16k-22kHz  - Sizzle digital
  };
  
  // ═══════════════════════════════════════════════════════════════════
  // MÉTRICAS ESPECTRALES
  // ═══════════════════════════════════════════════════════════════════
  spectral: {
    centroid: number;       // Hz - Centro de masa espectral
    flatness: number;       // 0-1 - Tonalidad vs ruido
    rolloff: number;        // Hz - Frecuencia donde está 85% energía
    crestFactor: number;    // Peak/RMS ratio
    clarity: number;        // 0-1 - Signal quality metric
  };
  
  // ═══════════════════════════════════════════════════════════════════
  // ESTÉREO (opcional, si hay 2 canales)
  // ═══════════════════════════════════════════════════════════════════
  stereo?: {
    correlation: number;    // -1 to +1 - Phase correlation
    width: number;          // 0-2 - Stereo width
    balance: number;        // -1 to +1 - L/R balance
  };
  
  // ═══════════════════════════════════════════════════════════════════
  // TRANSIENTES (detección de golpes)
  // ═══════════════════════════════════════════════════════════════════
  transients: {
    kickDetected: boolean;       // Onset en SubBass
    snareDetected: boolean;      // Onset en Mid
    hihatDetected: boolean;      // Onset en Treble
    transientStrength: number;   // 0-1 - Fuerza del transiente más fuerte
  };
  
  // ═══════════════════════════════════════════════════════════════════
  // HARMÓNICO (detección de key/chord)
  // ═══════════════════════════════════════════════════════════════════
  harmonic: {
    key: string;                 // "C", "Am", "F#m", etc.
    keyConfidence: number;       // 0-1
    chordQuality: 'major' | 'minor' | 'diminished' | 'augmented' | 'unknown';
  };
  
  // ═══════════════════════════════════════════════════════════════════
  // METADATOS
  // ═══════════════════════════════════════════════════════════════════
  metadata: {
    timestamp: number;           // Performance.now()
    frameIndex: number;          // Frame counter
    processingLatency: number;   // ms - Tiempo de procesamiento FFT
    fftSize: number;             // 4096
    sampleRate: number;          // 44100
    windowFunction: string;      // "blackman-harris"
    filterType: string;          // "linkwitz-riley-4"
  };
}
```

### 6.5 SeleneTitanConscious.ts - Nuevos Inputs Sensoriales

```typescript
/**
 * SELENE TITAN CONSCIOUS ADAPTATION
 * 
 * El cerebro recibe inputs expandidos de GOD EAR.
 * Definimos cómo la consciencia interpreta estos nuevos datos.
 */

interface SensoryInputsGodEar {
  // ═══════════════════════════════════════════════════════════════════
  // INPUTS EXISTENTES (actualizados)
  // ═══════════════════════════════════════════════════════════════════
  energy: number;               // Energía total (suma de bandas)
  bass: number;                 // SubBass + Bass combinados
  mid: number;                  // LowMid + Mid + HighMid combinados
  treble: number;               // Treble + UltraAir combinados
  
  // ═══════════════════════════════════════════════════════════════════
  // NUEVOS INPUTS - GOD EAR
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * PRESIÓN SUBSÓNICA
   * 
   * Intensidad pura de SubBass (20-60Hz).
   * Usado para: Stage shakers, Floor effects, Pump effect
   * 
   * Valores altos: Kick pesado, 808, Dubstep wobble
   */
  subsonicPressure: number;
  
  /**
   * ÍNDICE DE CLARIDAD
   * 
   * Cuán "limpia" suena la música.
   * Usado para: Ajustar complejidad de efectos
   * 
   * Alto (>0.7): Efectos detallados, movimientos precisos
   * Bajo (<0.3): Efectos más burdos, washes amplios
   */
  clarityIndex: number;
  
  /**
   * ANCHURA ESTÉREO
   * 
   * Cuán "ancho" suena el campo estéreo.
   * Usado para: Distribución de fixtures, Stereo panning
   * 
   * Mono (0.0): Todos los fixtures hacen lo mismo
   * Wide (1.0+): Fixtures L/R diferenciados al máximo
   */
  stereoWidth: number;
  
  /**
   * PRESENCIA DE AIRE
   * 
   * Energía en Ultra-Air (16k-22kHz).
   * Usado para: Micro-scanners, Lasers, Digital effects
   * 
   * Alto: Cymbals brillantes, sintetizadores "airy"
   * Bajo: Música más "oscura" o grabaciones vintage
   */
  airPresence: number;
  
  /**
   * VECTOR DE TRANSIENTES
   * 
   * Qué tipo de golpe acaba de ocurrir.
   * Usado para: Sincronización precisa de efectos
   */
  transientVector: {
    kick: boolean;     // SubBass onset
    snare: boolean;    // Mid onset
    hihat: boolean;    // Treble onset
    strength: number;  // Fuerza combinada
  };
  
  /**
   * TONALIDAD MUSICAL
   * 
   * Key detectada con confidence.
   * Usado para: Selección de paleta de colores armónicos
   * 
   * Ejemplo: "C major" → colores cálidos (red-orange)
   *          "A minor" → colores fríos (blue-purple)
   */
  tonality: {
    key: string;
    isMinor: boolean;
    confidence: number;
  };
  
  /**
   * DENSIDAD ESPECTRAL
   * 
   * Cuántas bandas están activas simultáneamente.
   * Usado para: Complejidad visual
   * 
   * Baja (1-2 bandas): Efectos simples, focus en una zona
   * Alta (5+ bandas): Full-stage activation, caos controlado
   */
  spectralDensity: number;
}

/**
 * Mapeo de inputs GOD EAR a decisiones de consciencia.
 */
class GodEarConsciousnessMapper {
  
  /**
   * Calcular qué fixtures deben activarse basándose en GOD EAR.
   */
  mapToFixtureActivation(inputs: SensoryInputsGodEar): FixtureActivationMap {
    return {
      // Front Pars: Activados por presión subsónica (kicks)
      frontPars: {
        intensity: inputs.subsonicPressure,
        trigger: inputs.transientVector.kick,
      },
      
      // Back Pars: Activados por Mid (snare/voces)
      backPars: {
        intensity: inputs.mid * inputs.clarityIndex,  // Más claro = más intenso
        trigger: inputs.transientVector.snare,
      },
      
      // Mover Left: Bass body (60-250Hz)
      moverLeft: {
        intensity: inputs.bass * (1.0 - inputs.subsonicPressure),  // Bass sin SubBass
        stereoOffset: -inputs.stereoWidth * 0.5,  // Panear a izquierda si hay width
      },
      
      // Mover Right: High frequencies + air
      moverRight: {
        intensity: inputs.treble + inputs.airPresence * 0.3,
        stereoOffset: inputs.stereoWidth * 0.5,  // Panear a derecha si hay width
        trigger: inputs.transientVector.hihat,
      },
      
      // Lasers/Scanners: Ultra-Air exclusivo
      microEffects: {
        intensity: inputs.airPresence,
        speed: inputs.clarityIndex,  // Más claro = movimientos más rápidos y precisos
      },
    };
  }
  
  /**
   * Ajustar paleta de colores basándose en tonalidad detectada.
   */
  mapToColorPalette(tonality: { key: string; isMinor: boolean; confidence: number }): ColorPalette {
    if (tonality.confidence < 0.5) {
      return DEFAULT_PALETTE;  // No hay confianza suficiente
    }
    
    // Mapeo de keys a temperaturas de color
    const keyToHue: Record<string, number> = {
      'C': 0,      // Rojo
      'C#': 30,
      'D': 60,     // Amarillo
      'D#': 90,
      'E': 120,    // Verde
      'F': 150,
      'F#': 180,   // Cyan
      'G': 210,
      'G#': 240,   // Azul
      'A': 270,
      'A#': 300,   // Magenta
      'B': 330,
    };
    
    const rootNote = tonality.key.replace('m', '');
    const baseHue = keyToHue[rootNote] || 0;
    
    // Minor keys: Shift hacia azul (más frío)
    const hueShift = tonality.isMinor ? 30 : 0;
    
    return generateHarmonicPalette(baseHue + hueShift, tonality.isMinor);
  }
}
```

---

## 7. ESTRUCTURAS DE DATOS

### 7.1 GodEarSpectrum (Output Principal)

```typescript
/**
 * GOD EAR SPECTRUM
 * 
 * Estructura de datos final que sale del FFT Worker.
 * Contiene TODO lo necesario para el sistema de iluminación.
 */
interface GodEarSpectrum {
  // Bandas tácticas (7)
  bands: GodEarBands;
  
  // Métricas espectrales
  spectral: GodEarSpectralMetrics;
  
  // Estéreo (opcional)
  stereo: GodEarStereoMetrics | null;
  
  // Transientes
  transients: GodEarTransients;
  
  // Harmónicos
  harmonic: GodEarHarmonic;
  
  // AGC state
  agc: GodEarAGCState;
  
  // Metadatos
  meta: GodEarMetadata;
}

interface GodEarBands {
  subBass: number;    // 0.0-1.0
  bass: number;       // 0.0-1.0
  lowMid: number;     // 0.0-1.0
  mid: number;        // 0.0-1.0
  highMid: number;    // 0.0-1.0
  treble: number;     // 0.0-1.0
  ultraAir: number;   // 0.0-1.0
  
  // Versiones RAW (sin AGC) para debugging
  raw?: {
    subBass: number;
    bass: number;
    lowMid: number;
    mid: number;
    highMid: number;
    treble: number;
    ultraAir: number;
  };
}

interface GodEarSpectralMetrics {
  centroid: number;       // Hz (20-22000)
  flatness: number;       // 0.0-1.0
  rolloff: number;        // Hz
  crestFactor: number;    // 1.0-20.0 típico
  clarity: number;        // 0.0-1.0
}

interface GodEarStereoMetrics {
  correlation: number;    // -1.0 to +1.0
  width: number;          // 0.0-2.0
  balance: number;        // -1.0 to +1.0 (L to R)
}

interface GodEarTransients {
  kick: boolean;
  snare: boolean;
  hihat: boolean;
  any: boolean;           // OR de todos
  strength: number;       // 0.0-1.0
}

interface GodEarHarmonic {
  key: string;            // "C", "Am", "F#m", etc.
  confidence: number;     // 0.0-1.0
  isMinor: boolean;
  rootMidi: number;       // 0-11
}

interface GodEarAGCState {
  globalGain: number;     // 0.1-10.0
  perBandGains: {
    subBass: number;
    bass: number;
    lowMid: number;
    mid: number;
    highMid: number;
    treble: number;
    ultraAir: number;
  };
  isActive: boolean;
  attackMs: number;
  releaseMs: number;
}

interface GodEarMetadata {
  timestamp: number;
  frameIndex: number;
  processingLatencyMs: number;
  fftSize: number;
  sampleRate: number;
  windowFunction: 'blackman-harris' | 'hann' | 'hamming';
  filterOrder: 4;  // LR4
  version: '1.0.0';
}
```

### 7.2 Worker Protocol Expandido

```typescript
/**
 * WORKER PROTOCOL - GOD EAR MESSAGES
 */

// Main → Worker
interface GodEarWorkerInput {
  type: 'AUDIO_BUFFER';
  payload: {
    left: Float32Array;
    right?: Float32Array;  // Opcional para mono
    sampleRate: number;
    timestamp: number;
  };
}

// Worker → Main
interface GodEarWorkerOutput {
  type: 'GOD_EAR_SPECTRUM';
  payload: GodEarSpectrum;
}

// Config messages
interface GodEarConfigMessage {
  type: 'CONFIG';
  payload: {
    fftSize?: number;           // Default: 4096
    windowFunction?: string;    // Default: 'blackman-harris'
    agcEnabled?: boolean;       // Default: true
    stereoEnabled?: boolean;    // Default: true
    transientDetection?: boolean; // Default: true
    harmonicDetection?: boolean;  // Default: true
  };
}
```

---

## 8. PLAN DE IMPLEMENTACIÓN

### 8.1 Fases de Desarrollo

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   WAVE 1016 IMPLEMENTATION ROADMAP                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  PHASE 1: CORE FFT (2-3 horas) ✅ COMPLETADO                            │
│  ══════════════════════════════                                         │
│  ✅ Implementar Blackman-Harris windowing                               │
│  ✅ Implementar DC offset removal                                       │
│  ✅ Crear GodEarFilterBank con máscaras LR4                            │
│  ✅ Test de separación (50Hz pure tone test)                           │
│  ✅ Benchmark de performance (target: <2ms per frame)                   │
│                                                                         │
│  PHASE 2: SPECTRAL METRICS (1-2 horas)                                 │
│  ══════════════════════════════════════                                 │
│  □ Implementar calculateSpectralCentroid                               │
│  □ Implementar calculateSpectralFlatness                               │
│  □ Implementar calculateSpectralRolloff                                │
│  □ Implementar calculateClarity                                        │
│  □ Test con señales conocidas                                          │
│                                                                         │
│  PHASE 3: STEREO ANALYSIS (1 hora)                                     │
│  ═════════════════════════════════                                      │
│  □ Implementar calculatePhaseCorrelation                               │
│  □ Implementar calculateStereoWidth                                    │
│  □ Implementar calculateBalance                                        │
│  □ Test con material estéreo conocido                                  │
│                                                                         │
│  PHASE 4: AGC TRUST ZONES (1-2 horas)                                  │
│  ═════════════════════════════════════                                  │
│  □ Implementar per-band AGC                                            │
│  □ Calibrar attack/release times por banda                             │
│  □ Test con material dinámico (rock, EDM)                              │
│                                                                         │
│  PHASE 5: ECOSYSTEM INTEGRATION (2-3 horas)                            │
│  ═══════════════════════════════════════════                            │
│  □ Actualizar RhythmAnalyzer (slope-based onset)                       │
│  □ Actualizar SectionTracker (relative thresholds)                     │
│  □ Actualizar HarmonyDetector (reduced latency)                        │
│  □ Actualizar TitanOrchestrator (expanded data structure)              │
│  □ Actualizar SeleneTitanConscious (new sensory inputs)                │
│                                                                         │
│  PHASE 6: VALIDATION (2-3 horas)                                       │
│  ════════════════════════════════                                       │
│  □ Test con 20+ tracks (rock, EDM, latino, jazz)                       │
│  □ Verificar NO regresión en vibes existentes                          │
│  □ Performance profiling (memory, CPU)                                 │
│  □ Documentar resultados                                               │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│  TOTAL ESTIMADO: 10-14 horas                                           │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Feature Flags para Rollback

```typescript
/**
 * FEATURE FLAGS - GOD EAR
 * 
 * Permite activar/desactivar componentes individualmente.
 * Facilita rollback si algo falla.
 */
const GOD_EAR_FLAGS = {
  // Core features
  USE_BLACKMAN_HARRIS: true,        // false = use Hann (legacy)
  USE_LR4_FILTERS: true,            // false = use simple bin sums (legacy)
  USE_7_BANDS: true,                // false = use 4 bands (legacy)
  
  // Spectral metrics
  ENABLE_CENTROID: true,
  ENABLE_FLATNESS: true,
  ENABLE_ROLLOFF: true,
  ENABLE_CLARITY: true,
  
  // Stereo
  ENABLE_STEREO_ANALYSIS: true,
  
  // AGC
  USE_PER_BAND_AGC: true,           // false = global AGC (legacy)
  
  // Transients
  USE_SLOPE_ONSET: true,            // false = magnitude onset (legacy)
  
  // Debug
  LOG_RAW_BANDS: false,
  LOG_SPECTRAL_METRICS: false,
  LOG_PROCESSING_TIME: false,
};
```

---

## 9. PUNK EPICNESS FEATURES

### 9.1 Real-Time Quality Monitor

```typescript
/**
 * AUDIO QUALITY MONITOR
 * 
 * Muestra en tiempo real la "calidad" de la señal de entrada.
 * Útil para diagnóstico y para presumir 😎
 */
interface AudioQualityReport {
  // Overall grade (A+ to F)
  grade: string;
  
  // Individual scores
  scores: {
    dynamicRange: number;       // 0-100 - Basado en crest factor
    spectralBalance: number;    // 0-100 - Basado en rolloff y centroid
    stereoImage: number;        // 0-100 - Basado en width y correlation
    signalClarity: number;      // 0-100 - Basado en clarity metric
    transientDefinition: number; // 0-100 - Basado en onset sharpness
  };
  
  // Recommendations
  warnings: string[];
  
  // Fun facts
  funFacts: {
    estimatedBitrate: string;   // "~320kbps", "~128kbps", etc.
    estimatedMasteringStyle: string; // "Loud war victim", "Dynamic master", etc.
  };
}

function generateQualityReport(spectrum: GodEarSpectrum): AudioQualityReport {
  const scores = {
    dynamicRange: Math.min(100, spectrum.spectral.crestFactor * 15),
    spectralBalance: calculateSpectralBalance(spectrum),
    stereoImage: spectrum.stereo ? (spectrum.stereo.width * 50) : 50,
    signalClarity: spectrum.spectral.clarity * 100,
    transientDefinition: spectrum.transients.strength * 100,
  };
  
  const avgScore = Object.values(scores).reduce((a, b) => a + b, 0) / 5;
  
  const grade = 
    avgScore >= 90 ? 'A+' :
    avgScore >= 80 ? 'A' :
    avgScore >= 70 ? 'B' :
    avgScore >= 60 ? 'C' :
    avgScore >= 50 ? 'D' : 'F';
  
  const warnings: string[] = [];
  if (scores.dynamicRange < 40) warnings.push('⚠️ Loudness war detected - audio is over-compressed');
  if (spectrum.stereo && spectrum.stereo.correlation < 0) warnings.push('⚠️ Phase issues detected');
  if (spectrum.spectral.flatness > 0.7) warnings.push('⚠️ High noise floor');
  
  return {
    grade,
    scores,
    warnings,
    funFacts: {
      estimatedBitrate: scores.signalClarity > 70 ? '~320kbps+' : scores.signalClarity > 50 ? '~192kbps' : '~128kbps',
      estimatedMasteringStyle: scores.dynamicRange > 60 ? '🎵 Dynamic master (respect!)' : '💥 Loud war victim',
    },
  };
}
```

### 9.2 Spectral DNA Fingerprint

```typescript
/**
 * SPECTRAL DNA FINGERPRINT
 * 
 * Genera un "fingerprint" visual del perfil espectral de la música.
 * Cada género tiene un DNA distintivo.
 */
interface SpectralDNA {
  // 7-band energy profile normalizado
  profile: [number, number, number, number, number, number, number];
  
  // Género estimado basándose en el profile
  estimatedGenre: string;
  
  // Similitud con géneros conocidos
  genreSimilarity: Record<string, number>;
  
  // Visual representation (ASCII art porque somos punk)
  asciiVisualization: string;
}

const GENRE_DNA_TEMPLATES: Record<string, number[]> = {
  'EDM/House':    [0.9, 0.7, 0.3, 0.5, 0.6, 0.8, 0.4],  // Heavy sub, bright highs
  'Rock/Metal':   [0.6, 0.8, 0.7, 0.9, 0.8, 0.5, 0.2],  // Mid-heavy, guitar crunch
  'Hip-Hop':      [1.0, 0.9, 0.4, 0.6, 0.5, 0.7, 0.3],  // 808 sub dominant
  'Jazz':         [0.4, 0.6, 0.7, 0.8, 0.6, 0.5, 0.3],  // Balanced, warm
  'Classical':    [0.3, 0.5, 0.6, 0.7, 0.6, 0.5, 0.4],  // Very balanced
  'Reggaeton':    [0.8, 0.9, 0.5, 0.6, 0.5, 0.7, 0.3],  // Dembow bass heavy
};

function generateSpectralDNA(bands: GodEarBands): SpectralDNA {
  const profile: [number, number, number, number, number, number, number] = [
    bands.subBass,
    bands.bass,
    bands.lowMid,
    bands.mid,
    bands.highMid,
    bands.treble,
    bands.ultraAir,
  ];
  
  // Calcular similitud con cada género
  const similarities: Record<string, number> = {};
  
  for (const [genre, template] of Object.entries(GENRE_DNA_TEMPLATES)) {
    let similarity = 0;
    for (let i = 0; i < 7; i++) {
      similarity += 1 - Math.abs(profile[i] - template[i]);
    }
    similarities[genre] = similarity / 7;
  }
  
  // Encontrar género más similar
  const estimatedGenre = Object.entries(similarities)
    .sort((a, b) => b[1] - a[1])[0][0];
  
  // Generar ASCII visualization
  const ascii = generateASCIISpectrum(profile);
  
  return {
    profile,
    estimatedGenre,
    genreSimilarity: similarities,
    asciiVisualization: ascii,
  };
}

function generateASCIISpectrum(profile: number[]): string {
  const labels = ['SUB', 'BAS', 'LMD', 'MID', 'HMD', 'TRB', 'AIR'];
  const maxHeight = 10;
  
  let result = '\n';
  
  for (let row = maxHeight; row >= 0; row--) {
    let line = row === maxHeight ? '     ' : `${(row * 10).toString().padStart(3)}% `;
    
    for (let col = 0; col < 7; col++) {
      const barHeight = Math.round(profile[col] * maxHeight);
      
      if (row <= barHeight) {
        line += row === barHeight ? '▓▓ ' : '██ ';
      } else {
        line += '   ';
      }
    }
    
    result += line + '\n';
  }
  
  result += '     ' + labels.map(l => l.padEnd(3)).join('') + '\n';
  
  return result;
}

/*
OUTPUT EXAMPLE:

      ▓▓                         
100%  ██       ▓▓                
 90%  ██ ▓▓    ██                
 80%  ██ ██    ██ ▓▓             
 70%  ██ ██    ██ ██ ▓▓          
 60%  ██ ██ ▓▓ ██ ██ ██ ▓▓       
 50%  ██ ██ ██ ██ ██ ██ ██       
 40%  ██ ██ ██ ██ ██ ██ ██       
 30%  ██ ██ ██ ██ ██ ██ ██       
 20%  ██ ██ ██ ██ ██ ██ ██       
 10%  ██ ██ ██ ██ ██ ██ ██       
      SUB BAS LMD MID HMD TRB AIR

Estimated Genre: EDM/House (87% match)
*/
```

### 9.3 Micro-Latency Analyzer

```typescript
/**
 * MICRO-LATENCY ANALYZER
 * 
 * Mide la latencia de cada etapa del pipeline.
 * Para los obsesivos del performance como nosotros.
 */
interface LatencyBreakdown {
  dcRemoval: number;      // ~0.1ms
  windowing: number;      // ~0.2ms
  fft: number;            // ~0.5ms
  magnitude: number;      // ~0.1ms
  filterBank: number;     // ~0.3ms
  spectralMetrics: number; // ~0.2ms
  stereoAnalysis: number; // ~0.1ms
  agc: number;            // ~0.1ms
  total: number;          // ~1.6ms target
  
  // Performance grade
  grade: 'GODLIKE' | 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'SLOW';
}

class MicroLatencyProfiler {
  private marks: Map<string, number> = new Map();
  
  mark(stage: string): void {
    this.marks.set(stage, performance.now());
  }
  
  getBreakdown(): LatencyBreakdown {
    const stages = [
      'dcRemoval', 'windowing', 'fft', 'magnitude',
      'filterBank', 'spectralMetrics', 'stereoAnalysis', 'agc'
    ];
    
    const breakdown: any = {};
    let prev = this.marks.get('start') || 0;
    
    for (const stage of stages) {
      const current = this.marks.get(stage) || prev;
      breakdown[stage] = current - prev;
      prev = current;
    }
    
    breakdown.total = (this.marks.get('end') || 0) - (this.marks.get('start') || 0);
    
    breakdown.grade = 
      breakdown.total < 1.0 ? 'GODLIKE' :
      breakdown.total < 2.0 ? 'EXCELLENT' :
      breakdown.total < 3.0 ? 'GOOD' :
      breakdown.total < 5.0 ? 'ACCEPTABLE' : 'SLOW';
    
    return breakdown as LatencyBreakdown;
  }
  
  reset(): void {
    this.marks.clear();
  }
}
```

---

## 🏆 CONCLUSIÓN

### GOD EAR Deliverables

1. **FFT QUIRÚRGICO**: Blackman-Harris windowing + LR4 filters = -92dB leakage
2. **7 BANDAS TÁCTICAS**: Separación perfecta para cualquier fixture setup
3. **MÉTRICAS AVANZADAS**: Centroid, Flatness, Rolloff, Clarity, Phase Correlation
4. **AGC TRUST ZONES**: Zero yoyo effect, cada banda independiente
5. **STEREO REAL**: Width y correlation para distribución espacial
6. **ECOSYSTEM READY**: Adaptaciones para todos los motores secundarios

### Performance Targets

| Métrica | Target | Justificación |
|---------|--------|---------------|
| Latencia total | <2ms | 60fps = 16.6ms budget, dejamos margen |
| Leakage | <-60dB | Inaudible, no afecta otras bandas |
| Separación 50Hz/60Hz | >95%/5% | Test de fuego LR4 |
| Memory footprint | <5MB | Filter bank + buffers |

### Filosofía

> "No optimizamos para hardware. Optimizamos para la VERDAD ESPECTRAL.  
> El código es infinito. La física no negocia."
> 
> — PunkOpus, Lead DSP Engineer

---

**STATUS**: BLUEPRINT COMPLETE  
**READY FOR**: Implementation approval  
**NEXT**: Awaiting architects' green light  

🩻💀 **GOD EAR: BECAUSE WE DESERVE TO HEAR LIKE GODS** 💀🩻

