# 🔌 GODEAR V3 — INTEGRATION BLUEPRINT (IMPACT AUDIT & DATA BRIDGING)

**Autor:** GLM — Ingeniero de Integración de Sistemas
**Base:** `GODEARFFT_V3_BLUEPRINT.md` + auditoría de código fuente
**Estado:** Blueprint de integración — 0 código ejecutado
**Doctrina:** Compatibilidad hacia atrás obligatoria. Cero breaking changes en Fase 1.

---

## 1. MAPA DE DEPENDENCIAS — Cadena Completa de Consumo

### 1.1 Flujo de datos: del FFT al fotón

```
GodEarFFT.ts                    SensesPipeline.ts              senses.ts (Worker)
┌─────────────────┐            ┌──────────────────┐          ┌─────────────────┐
│ GodEarAnalyzer  │            │ SpectrumAnalyzer │          │ parentPort      │
│ .analyze()      │──────────▶│ .analyze()       │─────────▶│ .postMessage()  │
│                 │            │                  │          │                 │
│ GodEarSpectrum  │            │ SpectrumResult   │          │ ExtendedAudio   │
│ {bands, spectral│            │ {bass, mid,      │          │ Analysis        │
│  transients,    │            │  transients,     │          │ {bpm, spectrum, │
│  chroma, ...}   │            │  chroma, ...}    │          │  wave8, ...}    │
└─────────────────┘            └──────────────────┘          └─────────────────┘
      │                              │                              │
      │ toLegacyFormat()             │ buildPayload()               │ IPC
      ▼                              ▼                              ▼
                                 AnalysisResponseBuilder.ts    TrinityOrchestrator.ts
                                 ┌──────────────────┐         ┌──────────────────┐
                                 │ ExtendedAudio    │────────▶│ AudioPipeline    │
                                 │ Analysis         │         │ Manager          │
                                 └──────────────────┘         │ .lastAudioData   │
                                                              └──────────────────┘
                                                                     │
                                          ┌──────────────────────────┤
                                          ▼                          ▼
                                   TickEngine.ts              SeleneLux.ts
                                   ┌──────────────┐          ┌──────────────────┐
                                   │ BeatDetector  │         │ LiquidStereo     │
                                   │ (PLL)         │         │ Physics          │
                                   │ Chronos       │         │ SeleneColorEngine│
                                   └──────────────┘          └──────────────────┘
```

### 1.2 Consumidores críticos identificados

| # | Consumidor | Archivo | Interface que consume | Acoplamiento |
|---|-----------|---------|----------------------|--------------|
| C1 | **SpectrumAnalyzer** | `core/senses/spectrum/SpectrumAnalyzer.ts` | `GodEarSpectrum` directo + `toLegacyFormat()` | **Alto** — wrapper único, punto de paso obligatorio |
| C2 | **SensesPipeline** | `core/senses/pipeline/SensesPipeline.ts` | `SpectrumResult` (no toca `GodEarSpectrum`) | **Medio** — consume el wrapper, no el core |
| C3 | **AnalysisResponseBuilder** | `core/senses/io/AnalysisResponseBuilder.ts` | `SpectrumResult` → `ExtendedAudioAnalysis` | **Medio** — mapeo campo a campo |
| C4 | **AudioPipelineManager** | `core/orchestrator/audio/AudioPipelineManager.ts` | `ExtendedAudioAnalysis` → `lastAudioData` | **Alto** — desempaqueta todo el payload IPC |
| C5 | **TickEngine** | `core/orchestrator/tick/TickEngine.ts` | `lastAudioData` + `BeatDetector` (PLL) | **Crítico** — BPM authority + freewheel |
| C6 | **SeleneLux** | `core/reactivity/SeleneLux.ts` | `SeleneLuxAudioMetrics` → `LiquidStereoInput` | **Alto** — construye `GodEarBands` manualmente |
| C7 | **LiquidEngineBase** | `hal/physics/LiquidEngineBase.ts` | `LiquidStereoInput` (bands, harshness, flatness, isKick) | **Alto** — física fotónica en hot path |
| C8 | **LiquidStereoPhysics** | `hal/physics/LiquidStereoPhysics.ts` | `LiquidStereoInput` + `GodEarBands` type | **Alto** — 7 bandas, perfiles |
| C9 | **SeleneColorEngine** | `engine/color/SeleneColorEngine.ts` | `ExtendedAudioAnalysis` (key, mood, energy, wave8) | **Medio** — NO consume chroma directamente hoy |
| C10 | **IntervalBPMTracker** | `workers/IntervalBPMTracker.ts` | `rawBassEnergy: number` (scalar) | **Bajo** — un solo escalar, sin struct |
| C11 | **SeleneBrainAdapter** | `core/calibration/SeleneBrainAdapter.ts` | `GodEarSpectrum` directo (instancia propia) | **Medio** — path de calibración, no hot path |
| C12 | **TrinityOrchestrator** | `workers/TrinityOrchestrator.ts` | `AudioAnalysis` (IPC forwarding) | **Bajo** — pipe passthrough |

---

## 2. RIESGOS DE RUPTURA (Breaking Changes Detectados)

### 2.1 🔴 RIESGOS CRÍTICOS (bloquean la migración si no se gestionan)

#### R-1: Cambio de dominio magnitud → potencia en `GodEarBands`

**Ubicación:** `GodEarFFT.ts:1362` (`computeMagnitudeSpectrum`) → `extractBandEnergy`

El V3 cambia el pipeline interno a **power spectrum** (re² + im²). Las 7 bandas que salen de `extractBandEnergy` hoy son **magnitud RMS** (sqrt de la suma de magnitudes al cuadrado). Si el V3 retorna potencia sin sqrt final, los valores pasan de `[0, 1]` a `[0, 1]` pero con escala diferente (potencia = magnitud²).

**Consumidores impactados:** C6, C7, C8 — todos los motores de físicas que interpretan `bands.bass = 0.7` como "70% de intensidad" se rompen. Los perfiles LR4 (`techno.ts`, etc.) tienen thresholds calibrados contra magnitud.

**Mitigación:** El blueprint V3 ya especifica sqrt diferida — la sqrt se aplica **antes de retornar las bandas** (7 sqrt por banda). El pipeline interno opera en potencia, pero la **salida `GodEarBands` sigue siendo magnitud RMS**. Cero cambio visible para consumidores.

```
Interno:  power[k] = re² + im²          (sin sqrt)
Bandas:   bandRms = sqrt(Σ power·w / Σw)  (sqrt SÓLO aquí, 7 veces)
Salida:   GodEarBands.bass = bandRms      (mismo dominio que V2)
```

**Veredicto:** ✅ **Sin breaking change** si se respeta la sqrt en la salida de bandas. El ahorro de 2049→7 sqrt se preserva.

#### R-2: `SpectrumResult.spectralFlux` — semántica cambiada

**Ubicación:** `SpectrumAnalyzer.ts:147`

Hoy `spectralFlux` se calcula en `SpectrumAnalyzer` como:
```typescript
const currentEnergy = psycho.bass + psycho.mid + psycho.treble;
const spectralFlux = Math.min(1, Math.abs(currentEnergy - this.prevEnergy) * 2);
```

Es un **delta de energía agregada** (3 bandas), no un spectral flux verdadero. El V3 introduce un flux bin-a-bin normalizado con whitening. El valor cambia de escala y semántica.

**Consumidores impactados:** C3 (`buildPayload` lo empaqueta), C4 (`lastAudioData`), C9 (`SeleneColorEngine` no lo consume directamente pero viaja en el payload).

**Mitigación:** Renombrar el campo V3 a `spectralFluxV3` en `SpectrumResult` y mantener `spectralFlux` legacy intacto. El campo V3 viaja como `spectralFluxV3` en `ExtendedAudioAnalysis`. Consumidores actuales siguen leyendo `spectralFlux` (legacy). Consumidores nuevos opt-in a `spectralFluxV3`.

**Veredicto:** ⚠️ **Cambio aditivo** — nuevo campo, campo viejo preservado.

#### R-3: `IntervalBPMTracker.process()` — cambio de señal de entrada

**Ubicación:** `IntervalBPMTracker.ts:314`

Hoy recibe `rawBassEnergy: number` (suma de `bandsRaw.subBass + bandsRaw.bass`). El V3 propone alimentar con flux cuando `SI > 0.6`. Esto cambia el **significado del escalar** que el tracker recibe.

**Consumidores impactados:** C5 (TickEngine → BeatDetector → PLL → Chronos). El PLL depende de `workerBpm` y `workerBpmConfidence` — si el tracker produce BPMs diferentes porque su entrada cambió, el PLL puede desestabilizarse.

**Mitigación:** El crossfade `α·flux + (1−α)·energy` con `α = SI` garantiza que en música dinámica (SI≈0) la entrada es **idéntica** a V2. El tracker no necesita saber que su entrada cambió — recibe un escalar, como siempre. El riesgo es en la **transición** (SI subiendo de 0 a 1): si el flux tiene una escala diferente al energy, el tracker ve un salto.

**Solución:** Normalizar el flux al mismo rango dinámico que `rawBassEnergy` antes del crossfade:
```typescript
const kickSignal = SI * (fluxNormalized * rawBassEnergyRef) + (1 - SI) * rawBassEnergy;
```
Donde `rawBassEnergyRef` es un EMA lento del `rawBassEnergy` histórico (~1s). Esto asegura que el tracker siempre ve valores en el mismo orden de magnitud.

**Veredicto:** ⚠️ **Riesgo medio** — requiere calibración del factor de escala. Transparente para Chronos si el tracker sigue produciendo `GodEarBPMResult` con la misma interface.

### 2.2 🟡 RIESGOS MEDIOS (requieren adaptación pero no bloquean)

#### R-4: `GodEarMetadata.version` — union type string

**Ubicación:** `GodEarFFT.ts:118`

```typescript
version: '1.0.0' | '2.0.0';
```

El V3 necesita `'3.0.0'`. Si algún consumidor hace un switch exhaustivo sobre este union type, TypeScript marcará error.

**Mitigación:** Añadir `'3.0.0'` al union. Buscar consumers del campo `version` — según el mapeo, sólo se usa en `getInfo()` (string display). No hay switches exhaustivos.

**Veredicto:** ✅ **Cambio trivial** — añadir `'3.0.0'` al union type.

#### R-5: `SpectrumResult` — nuevo campo `photon`

**Ubicación:** `SpectrumAnalyzer.ts:30-74`

Añadir `photon?: GodEarPhoton` a `SpectrumResult`. Como es opcional, todos los consumidores existentes que destructuran `SpectrumResult` siguen funcionando.

**Consumidores impactados:** C2 (SensesPipeline), C3 (buildPayload).

**Mitigación:** Campo opcional. `buildPayload` debe propagarlo si existe.

**Veredicto:** ✅ **Cambio aditivo seguro.**

#### R-6: `ExtendedAudioAnalysis` — nuevo campo `photon`

**Ubicación:** `AnalysisResponseBuilder.ts:39` + `WorkerProtocol.ts:111`

`ExtendedAudioAnalysis extends AudioAnalysis`. Añadir `photon?` a `AudioAnalysis` o a `ExtendedAudioAnalysis`. El payload IPC se serializa con `postMessage` — Structured Clone maneja objetos arbitrarios, así que no hay riesgo de serialización.

**Consumidores impactados:** C4 (AudioPipelineManager desempaqueta selectivamente — ignora campos desconocidos), C12 (TrinityOrchestrator passthrough).

**Veredicto:** ✅ **Cambio aditivo seguro.** `AudioPipelineManager.lastAudioData` debe añadir `photon?` a su tipo interno.

### 2.3 🟢 RIESGOS BAJOS (informativos)

#### R-7: `SeleneBrainAdapter` — instancia propia de `GodEarAnalyzer`

**Ubicación:** `SeleneBrainAdapter.ts:147`

Tiene su propia instancia de `GodEarAnalyzer` para calibración. Al actualizar `GodEarAnalyzer`, este path se beneficia automáticamente pero también hereda cualquier cambio de comportamiento.

**Veredicto:** ✅ **Sin riesgo** — path de calibración, no hot path. Si las bandas mantienen el mismo dominio (R-1 mitigado), los Z-Scores del `ContextualMemory` no se alteran.

#### R-8: `SeleneColorEngine` — cromagrama latente

**Ubicación:** `SeleneColorEngine.ts:1109`

Hoy `SeleneColorEngine.generate()` recibe `ExtendedAudioAnalysis` y extrae `wave8.harmony.key`, `mood`, `energy`, `syncopation`. **No consume `chroma`**. El cromagrama viaja en el payload pero es ignorado por el color engine.

**Directiva estricta:** El chroma NO debe acoplarse dinámicamente al color engine todavía.

**Veredicto:** ✅ **Sin riesgo** — el campo `chroma` ya existe en `ExtendedAudioAnalysis` (WAVE 2301) y ya viaja sin ser consumido. El V3 añade `photon.hue` y `photon.colorSnap` como **sugerencias latentes** — el color engine puede ignorarlas hasta que se decida activarlas.

---

## 3. ESTRATEGIA DE DATA BRIDGING — Inyección Progresiva

### 3.1 Principio rector

> **El V3 es un superset del V2.** Todo campo V2 existe en V3 con el mismo tipo y semántica. Los campos V3 nuevos son **opcionales** y se inyectan como `undefined` hasta que cada consumidor opt-in explícitamente.

### 3.2 Fases de inyección

```
Fase 0 (WAVE 8001): Cosecha interna — LUT + Power Spectrum
  └─ GodEarAnalyzer cambia internamente, salida idéntica
  └─ Cero consumidores tocados

Fase 1 (WAVE 8002): Spectral Flux V3 — nuevo campo aditivo
  └─ SpectrumResult += spectralFluxV3?: number
  └─ ExtendedAudioAnalysis += spectralFluxV3?: number
  └─ IntervalBPMTracker: crossfade α=SI (interno, transparente)
  └─ Consumidores V2 leen spectralFlux (legacy) — sin cambio

Fase 2 (WAVE 8003): Photon Block — SaturationMeter + WallIntensity
  └─ GodEarSpectrum += photon?: GodEarPhoton
  └─ SpectrumResult += photon?: GodEarPhoton
  └─ ExtendedAudioAnalysis += photon?: GodEarPhoton
  └─ AudioPipelineManager.lastAudioData += photon?: GodEarPhoton
  └─ SeleneLux: lee photon.wallIntensity como lower-bound de dimmers
  └─ LiquidEngineBase: recibe photon opcional, ignora si undefined

Fase 3 (WAVE 8004): Strobe + Chroma Coupler
  └─ photon.strobe, photon.hue, photon.colorSnap poblados
  └─ SeleneLux: lee photon.strobe para override de strobe channel
  └─ SeleneColorEngine: NO consume photon.hue (latente)

Fase 4 (WAVE 8005): Activación progresiva
  └─ SeleneColorEngine: opt-in a photon.hue cuando estabilidad confirmada
  └─ Micro-NN Onset Validator (si dataset disponible)
```

### 3.3 Bridge por consumidor

#### C1 — SpectrumAnalyzer (punto de paso crítico)

**Estrategia:** Pasarela única. Toda la cadena pasa por aquí.

```typescript
// SpectrumResult añade campos opcionales:
export interface SpectrumResult {
  // ... todos los campos V2 intactos ...

  // V3 — opcionales, undefined si GodEar V2 (fallback)
  spectralFluxV3?: number;        // flux normalizado con whitening
  photon?: GodEarPhoton;          // bloque fotónico completo
}
```

**En `analyze()`:**
```typescript
const godEarResult = this.godEar.analyze(buffer);

// V2 path — intacto, sin cambios
const legacy = toLegacyFormat(godEarResult);
// ... psycho scaling, spectralFlux legacy ...

const result: SpectrumResult = {
  // ... todos los campos V2 ...
  spectralFlux,  // legacy: delta de energía agregada

  // V3 — sólo si GodEar V3 pobló estos campos
  spectralFluxV3: godEarResult.spectralFluxV3,
  photon: godEarResult.photon,
};

return result;
```

**GodEarSpectrum añade:**
```typescript
export interface GodEarSpectrum {
  // ... todos los campos V2 intactos ...

  // V3 — opcionales
  spectralFluxV3?: number;
  photon?: GodEarPhoton;
}
```

**GodEarAnalyzer.analyze()** pobla `spectralFluxV3` y `photon` sólo si los módulos V3 están inicializados. Si no, son `undefined` — comportamiento V2 puro.

#### C2 — SensesPipeline (orquestador)

**Estrategia:** Passthrough transparente. No destructura `photon`.

`SensesPipeline` pasa `spectrum` a `buildPayload()`. Como `SpectrumResult` ahora tiene campos opcionales extra, `buildPayload` los propaga. **Cero cambios en SensesPipeline.**

#### C3 — AnalysisResponseBuilder (empaquetador IPC)

**Estrategia:** Propagar campos V3 si existen.

```typescript
// ExtendedAudioAnalysis añade:
export interface ExtendedAudioAnalysis extends AudioAnalysis {
  // ... campos V2 ...
  spectralFluxV3?: number;
  photon?: GodEarPhoton;
}

// En buildPayload():
return {
  // ... todos los campos V2 ...

  spectralFluxV3: spectrum.spectralFluxV3,  // undefined si V2
  photon: spectrum.photon,                  // undefined si V2
};
```

**Coste:** 2 asignaciones condicionales. Despreciable.

#### C4 — AudioPipelineManager (desempaquetador)

**Estrategia:** Añadir `photon?` al tipo `lastAudioData`.

```typescript
private lastAudioData: {
  // ... todos los campos V2 ...
  spectralFluxV3?: number;
  photon?: GodEarPhoton;
} = { bass: 0, mid: 0, high: 0, energy: 0 }

// En el handler de audio-levels:
this.lastAudioData = {
  ...this.lastAudioData,
  // ... campos V2 ...
  spectralFluxV3: levels.spectralFluxV3,
  photon: levels.photon,
}
```

**Coste:** 2 asignaciones. El `...spread` ya copia todo — los campos nuevos viajan automáticamente.

#### C5 — TickEngine + Chronos (BPM authority)

**Estrategia:** Transparente. El tracker recibe el mismo escalar.

El `IntervalBPMTracker.process(rawBassEnergy)` sigue recibiendo un `number`. El crossfade flux/energy ocurre **dentro de `GodEarAnalyzer`** antes de retornar `bandsRaw`. El tracker no sabe que su entrada cambió de composición.

**TickEngine** lee `workerBpm`, `workerBpmConfidence`, `workerOnBeat`, `workerBeatPhase` — estos campos no cambian de tipo ni semántica. El PLL y el freewheel funcionan idéntico.

**Chronos** (timecoder) depende del `BeatDetector` que TickEngine alimenta. Como el `BeatDetector` recibe el mismo `GodEarBPMResult`, Chronos es **completamente transparente**.

**Único riesgo:** Si el flux produce BPMs más estables en brickwall (que es el objetivo), el `BPM_HYSTERESIS_PCT` del TickEngine puede comportarse diferente — pero esto es una **mejora**, no un breaking change. El hysteresis gate sigue funcionando: si el BPM cambia >8%, requiere 60 frames de confirmación.

#### C6 — SeleneLux (capa de reactividad)

**Estrategia:** Opt-in progresivo con lower-bound seguro.

**Fase 2 (Wall Intensity):**
```typescript
// En processFrame(), después de construir liquidInput:
const photon = audioMetrics.photon;  // undefined si V2

// Lower-bound anti-colapso: max(env_intensity, SI^0.7)
if (photon && photon.wallIntensity > 0) {
  // El dimmer nunca baja del piso del muro de sonido
  dimmerOverride = dimmerOverride !== null
    ? Math.max(dimmerOverride, photon.wallIntensity)
    : photon.wallIntensity;
}
```

**Propiedad:** Si `photon` es `undefined` (V2), este bloque es no-op. **Cero regresión.**

**Fase 3 (Strobe):**
```typescript
if (photon?.strobe?.active) {
  // El HAL decide si usa el strobe nativo del fixture o modula el dimmer
  // SeleneLux sólo expone la sugerencia — no escribe DMX directamente
  strobeOverride = {
    rate: photon.strobe.rateHz,
    duty: photon.strobe.duty,
  };
}
```

**Fase 4 (Color — latente):**
```typescript
// photon.hue y photon.colorSnap viajan pero NO se inyectan en SeleneColorEngine
// Se exponen en telemetry para validación offline
```

#### C7/C8 — LiquidEngineBase / LiquidStereoPhysics

**Estrategia:** Sin cambios en Fases 0-3.

Los motores de físicas consumen `LiquidStereoInput` que contiene `GodEarBands` + métricas escalares. Como las bandas mantienen el mismo dominio (R-1 mitigado), **no requieren ningún cambio**.

**Futura integración (Fase 4+):** `LiquidStereoInput` podría añadir:
```typescript
export interface LiquidStereoInput {
  // ... campos V2 ...
  photon?: GodEarPhoton;  // opcional — motores pueden leer SI para ajustar decay
}
```

Pero esto no es necesario para las Fases 0-3. El `wallIntensity` se inyecta como `dimmerOverride` en SeleneLux (C6), antes de llegar a los motores.

#### C9 — SeleneColorEngine

**Estrategia:** Latente. Cero cambios hasta Fase 4.

El color engine hoy recibe `ExtendedAudioAnalysis` y extrae `wave8.harmony.key`, `mood`, `energy`. El cromagrama V3 (`photon.hue`, `photon.colorSnap`) viaja en el payload pero **no se pasa a `SeleneColorEngine.generate()`**.

**Activación futura (Fase 4):** Cuando se decida acoplar, `SeleneColorEngine.generate()` recibirá un parámetro opcional:
```typescript
static generate(
  data: ExtendedAudioAnalysis,
  options?: GenerationOptions & {
    photonHue?: number;      // del ChromaCoupler V3
    photonSnap?: boolean;    // color snap flag
  }
): SelenePalette
```

Si `photonHue` es `undefined`, el color engine usa su lógica actual (key → hue). Si está definido, puede usarse como override o blend. **Pero esto es Fase 4 — no se implementa ahora.**

#### C10 — IntervalBPMTracker

**Estrategia:** Transparente. Ver C5.

El tracker recibe `rawBassEnergy: number`. El V3 modifica la **composición** de ese escalar (crossfade flux/energy) pero no su tipo ni interface. `process()` no cambia signature.

#### C11 — SeleneBrainAdapter

**Estrategia:** Herencia automática.

Usa `GodEarAnalyzer` directamente. Al actualizar el analyzer, este path se beneficia del LUT y power spectrum automáticamente. Como las bandas de salida mantienen dominio (R-1), los Z-Scores del `ContextualMemory` no se alteran.

**Único cambio:** Añadir `photon` y `spectralFluxV3` al `ExtractedMetrics` interface si se quiere telemetría de calibración V3. Opcional.

---

## 4. CONTRATO DE TIPOS V3 — Cambios exactos

### 4.1 `GodEarSpectrum` (GodEarFFT.ts)

```typescript
export interface GodEarSpectrum {
  // === V2 INTACTO ===
  bands: GodEarBands;
  bandsRaw: GodEarBands;
  spectral: GodEarSpectralMetrics;
  stereo: GodEarStereoMetrics | null;
  transients: GodEarTransients;
  agc: GodEarAGCState;
  meta: GodEarMetadata;
  dominantFrequency: number;
  totalEnergy: number;
  chroma: number[];

  // === V3 ADITIVO ===
  spectralFluxV3?: number;      // flux normalizado con whitening
  photon?: GodEarPhoton;        // bloque fotónico
}
```

### 4.2 `GodEarMetadata.version`

```typescript
export interface GodEarMetadata {
  // ...
  version: '1.0.0' | '2.0.0' | '3.0.0';  // añadir '3.0.0'
}
```

### 4.3 `GodEarPhoton` (nuevo, en GodEarFFT.ts)

```typescript
export interface GodEarPhoton {
  saturation: number;
  wallIntensity: number;
  strobe: { active: boolean; rateHz: number; duty: number; drive: number };
  hue: number;
  colorSnap: boolean;
  chromaFlux: number;
  spectralFlux: number;
  transientDensity: number;
  whiteNoiseScore: number;
}
```

### 4.4 `SpectrumResult` (SpectrumAnalyzer.ts)

```typescript
export interface SpectrumResult {
  // === V2 INTACTO ===
  // ... todos los campos existentes ...

  // === V3 ADITIVO ===
  spectralFluxV3?: number;
  photon?: GodEarPhoton;
}
```

### 4.5 `ExtendedAudioAnalysis` (AnalysisResponseBuilder.ts)

```typescript
export interface ExtendedAudioAnalysis extends AudioAnalysis {
  // === V2 INTACTO ===
  // ... todos los campos existentes ...

  // === V3 ADITIVO ===
  spectralFluxV3?: number;
  photon?: GodEarPhoton;
}
```

### 4.6 `AudioPipelineManager.lastAudioData`

```typescript
private lastAudioData: {
  // === V2 INTACTO ===
  // ... todos los campos existentes ...

  // === V3 ADITIVO ===
  spectralFluxV3?: number;
  photon?: GodEarPhoton;
} = { bass: 0, mid: 0, high: 0, energy: 0 }
```

### 4.7 `SeleneLuxAudioMetrics` (SeleneLux.ts)

```typescript
export interface SeleneLuxAudioMetrics {
  // === V2 INTACTO ===
  // ... todos los campos existentes ...

  // === V3 ADITIVO ===
  photon?: GodEarPhoton;
}
```

---

## 5. ORDEN DE MODIFICACIÓN — Secuencia segura

### Fase 0: Cosecha interna (WAVE 8001)

| Paso | Archivo | Cambio | Riesgo |
|------|---------|--------|--------|
| 0.1 | `GodEarFFT.ts` | Añadir `initTwiddleLUT()` + modificar `computeFFTCore` (3 líneas) | Cero — mismo output, menos CPU |
| 0.2 | `GodEarFFT.ts` | Añadir `computePowerSpectrum()` + `extractBandPower()` | Cero — interno, salida con sqrt final |
| 0.3 | `GodEarFFT.ts` | Migrar `calculateSpectralFlatness` a dominio potencia (umbral 0.8→0.64) | Bajo — recalibrar umbral |
| 0.4 | `GodEarFFT.ts` | Añadir `'3.0.0'` al union `version` | Trivial |
| 0.5 | `GodEarFFT.radix2.ts` | Extender test suite: comparación V2 vs V3 banda a banda | Verificación |

**Validación:** `GodEarFFT.radix2.ts` test suite extendido con:
- Parseval's theorem en dominio potencia
- Comparación banda a banda V2 vs V3 (tolerancia <1e-5)
- LUT vs runtime trig: bit-exact o <1 ULP

### Fase 1: Spectral Flux V3 (WAVE 8002)

| Paso | Archivo | Cambio | Riesgo |
|------|---------|--------|--------|
| 1.1 | `GodEarFFT.ts` | Añadir `computeSpectralFlux()` + buffers `prevPower`, `fluxWhitening` | Interno |
| 1.2 | `GodEarFFT.ts` | Añadir `spectralFluxV3?` a `GodEarSpectrum` | Aditivo |
| 1.3 | `GodEarFFT.ts` | Crossfade α=SI en `bandsRaw.subBass + bandsRaw.bass` para BPM feed | R-3 — calibrar escala |
| 1.4 | `SpectrumAnalyzer.ts` | Propagar `spectralFluxV3` de `godEarResult` a `SpectrumResult` | Aditivo |
| 1.5 | `AnalysisResponseBuilder.ts` | Propagar `spectralFluxV3` al payload | Aditivo |
| 1.6 | `AudioPipelineManager.ts` | Añadir `spectralFluxV3?` a `lastAudioData` | Aditivo |

### Fase 2: Photon Block (WAVE 8003)

| Paso | Archivo | Cambio | Riesgo |
|------|---------|--------|--------|
| 2.1 | `GodEarFFT.ts` | Añadir `GodEarPhoton` interface + `SaturationMeter` class | Nuevo |
| 2.2 | `GodEarFFT.ts` | Poblar `photon` en `analyze()` return | Aditivo |
| 2.3 | `SpectrumAnalyzer.ts` | Propagar `photon` | Aditivo |
| 2.4 | `AnalysisResponseBuilder.ts` | Propagar `photon` | Aditivo |
| 2.5 | `AudioPipelineManager.ts` | Añadir `photon?` a `lastAudioData` | Aditivo |
| 2.6 | `SeleneLux.ts` | Añadir `photon?` a `SeleneLuxAudioMetrics` + lower-bound `wallIntensity` en dimmer | R-6 — opt-in con guard |
| 2.7 | `GodEarFFT.ts` | AGC freeze cuando `SI > 0.6` | R-1 — verificar perfiles |

### Fase 3: Strobe + Chroma Coupler (WAVE 8004)

| Paso | Archivo | Cambio | Riesgo |
|------|---------|--------|--------|
| 3.1 | `GodEarFFT.ts` | Añadir `StrobeEngine` + `ChromaCoupler` classes | Nuevo |
| 3.2 | `GodEarFFT.ts` | Poblar `photon.strobe`, `photon.hue`, `photon.colorSnap` | Aditivo |
| 3.3 | `SeleneLux.ts` | Leer `photon.strobe` para strobe override | Opt-in con guard |
| 3.4 | — | `SeleneColorEngine` NO se toca | Latente |

### Fase 4: Activación progresiva (WAVE 8005+)

| Paso | Archivo | Cambio | Riesgo |
|------|---------|--------|--------|
| 4.1 | `SeleneColorEngine.ts` | `generate()` acepta `photonHue?` opcional | Opt-in |
| 4.2 | `LiquidStereoPhysics.ts` | `LiquidStereoInput` acepta `photon?` opcional | Opt-in |
| 4.3 | `GodEarFFT.ts` | `OnsetValidatorNN` hook en `OnsetCandidate` | Fase 2 ML |

---

## 6. MATRIZ DE COMPATIBILIDAD

```
                    V2 Consumer    V3 Fase 0   V3 Fase 1   V3 Fase 2   V3 Fase 3
                    (actual)       (Cosecha)   (Flux)      (Photon)    (Strobe)
┌───────────────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│ SpectrumAnalyzer  │   ✅     │   ✅     │   ✅+    │   ✅+    │   ✅+    │
│ SensesPipeline    │   ✅     │   ✅     │   ✅     │   ✅     │   ✅     │
│ AnalysisBuilder   │   ✅     │   ✅     │   ✅+    │   ✅+    │   ✅+    │
│ AudioPipelineMgr  │   ✅     │   ✅     │   ✅+    │   ✅+    │   ✅+    │
│ TickEngine        │   ✅     │   ✅     │   ✅*    │   ✅     │   ✅     │
│ IntervalBPMTracker│   ✅     │   ✅     │   ✅*    │   ✅     │   ✅     │
│ SeleneLux         │   ✅     │   ✅     │   ✅     │   ✅+    │   ✅+    │
│ LiquidEngineBase  │   ✅     │   ✅     │   ✅     │   ✅     │   ✅     │
│ LiquidStereoPhys  │   ✅     │   ✅     │   ✅     │   ✅     │   ✅     │
│ SeleneColorEngine │   ✅     │   ✅     │   ✅     │   ✅     │   ✅(L)  │
│ SeleneBrainAdapter│   ✅     │   ✅     │   ✅     │   ✅     │   ✅     │
│ TrinityOrchestrator│  ✅     │   ✅     │   ✅     │   ✅     │   ✅     │
└───────────────────┴──────────┴──────────┴──────────┴──────────┴──────────┘

✅  = sin cambios, funciona idéntico
✅+ = sin cambios V2, campos V3 nuevos disponibles (opcionales)
✅* = cambio interno transparente (crossfade en entrada del tracker)
(L) = latente (dato disponible pero no consumido)
```

---

## 7. PROTOCOLO DE ROLLBACK

Si cualquier fase produce regresiones en producción:

| Fase | Rollback | Mecanismo |
|------|----------|-----------|
| Fase 0 | Revertir LUT + Power Spectrum | Feature flag `USE_TWIDDLE_LUT` + `USE_POWER_SPECTRUM` en `GodEarAnalyzer` constructor |
| Fase 1 | Desactivar flux V3 | `spectralFluxV3 = undefined` — consumidores ya lo tratan como opcional |
| Fase 2 | Desactivar photon block | `photon = undefined` — SeleneLux ya tiene guard `if (photon)` |
| Fase 3 | Desactivar strobe | `photon.strobe.active = false` — no-op en SeleneLux |

**Feature flags maestros en `GodEarAnalyzer` constructor:**
```typescript
constructor(sampleRate, fftSize, options?: {
  useTwiddleLUT?: boolean;    // default: true
  usePowerSpectrum?: boolean; // default: true
  useSpectralFluxV3?: boolean;// default: true
  usePhotonBlock?: boolean;   // default: true
  useStrobeEngine?: boolean;  // default: true
  useChromaCoupler?: boolean; // default: true
})
```

Cualquier flag en `false` hace que el analyzer se comporte como V2 puro. Esto permite A/B testing en producción sin deploy reversión.

---

## 8. RESUMEN EJECUTIVO

| Métrica | Valor |
|---------|-------|
| Consumidores auditados | 12 |
| Breaking changes críticos | 0 (con mitigaciones aplicadas) |
| Cambios aditivos (campos opcionales) | 7 interfaces |
| Cambios internos transparentes | 3 (FFT core, power spectrum, BPM crossfade) |
| Consumidores que requieren modificación | 4 (SpectrumAnalyzer, AnalysisBuilder, AudioPipelineMgr, SeleneLux) |
| Consumidores sin cambios | 8 (SensesPipeline, TickEngine, IntervalBPMTracker, LiquidEngineBase, LiquidStereoPhysics, SeleneColorEngine, SeleneBrainAdapter, TrinityOrchestrator) |
| Feature flags de rollback | 6 |
| Fases de implementación | 5 (WAVE 8001-8005) |

**Conclusión:** La migración a V3 es **no-destructiva por diseño**. Todos los campos V3 son opcionales (`?`). Los consumidores V2 funcionan sin modificación. La adopción es progresiva por consumidor, con feature flags para rollback instantáneo. El chromagrama V3 (`photon.hue`) viaja latente sin tocar `SeleneColorEngine`, cumpliendo la directiva estricta.

---

*"La capa sensorial mide y sugiere; nunca rompe. El V3 es un superset silencioso — si no lo escuchas, es porque está funcionando."*
