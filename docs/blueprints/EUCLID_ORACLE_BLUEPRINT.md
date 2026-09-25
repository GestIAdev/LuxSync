# EUCLID_ORACLE_BLUEPRINT.md — WAVE 8208

> **The Euclid Oracle — Theia Generative Engine (Architectural Blueprint)**
> *Euclid* = geometría pura (SDFs, raymarching). *Oracle* = Cassandra (predicción con ETA).
> Un motor visual híbrido que ve la música **antes** de que suene.
>
> Documentos base: `Theia_complete_audit.md` (8206) · WAVE 8207 (WebGL plumbing) · `THEIA_UI_TRIAGE.md` (8210) ·
> `GODEAR_FFT_V3_AUDIT.md` · `SELENE_V3_DUE_DILIGENCE_DEFINITIVE.md` · `OMNILIQUID_ENGINE_AUDIT.md`.
>
> **Solo arquitectura: layouts de buffer, contratos, GLSL de referencia. Cero TS funcional.**

> ### 🌊 WAVE 8215 — Enmienda de transporte (Glass Bridge Pivot)
> El transporte descrito abajo ("ipc invoke structured clone de SAB") está **vetado**: Chromium
> rechaza `SharedArrayBuffer` en la frontera Main↔Renderer ("An object could not be cloned").
> El **layout del ring de 256B no cambia**; solo cómo viaja:
> - `TheiaTelemetryPump` (main) copia el snapshot a un `ArrayBuffer` de 256B y lo publica por
>   `MessagePortMain` como **structured-clone** — 🩹 **WAVE 8216**: `MessagePortMain` rechaza
>   `ArrayBuffer` en su array `transfer` ("Port at index 0 is not a valid port"; solo acepta
>   otros `MessagePortMain`). 256B × 44Hz ≈ 11 KB/s: coste despreciable.
> - Cada consumidor espeja los 256B a su ring **local** (SAB intra-proceso, legal) y devuelve su
>   copia por `ack` **con transfer** (el `MessagePort` DOM→main sí transfiere `ArrayBuffer`) —
>   ping-pong estricto, pool fijo (3×256B por link), zero-alloc certificado.
> - El reloj maestro (FrameContext, 16B) viaja en la cabecera del mismo buffer; `theta.worker`
>   pollea su espejo local como siempre. El futuro `TelemetryWriter` de §2 escribe en el SAB de
>   main y el pump lo transporta sin cambiar el contrato.

---

## 0. Resumen ejecutivo

El pipeline actual (post-8207) mueve **píxeles** del worker a la ventana HDMI (8,3 MB/frame). Al motor generativo le falta la otra dirección: **datos musicales hacia la GPU**. El Euclid Oracle añade:

1. **`TheiaTelemetryRing`** — un `SharedArrayBuffer` de **256 bytes** que `TickEngine` (main process) escribe a 44 Hz con telemetría de los tres grandes motores: **Selene/Cassandra** (confianza, probabilidad, ETA predictivo), **GodEar FFT V3** (7 bandas + métricas perceptuales + chroma), **Omniliquid** (`morphFactor` y zonas).
2. **Uniform Bridge** en el worker — lectura lock-free (seqlock), suavizado 44→60 Hz, y exposición automática como diccionario estándar de uniforms (`u_kickEnergy`, `u_predictiveETA`, `u_morphFactor`…) en **cualquier** shader.
3. **Shader Contract** — compilación runtime de fragment shaders sin dependencias: preámbulo inyectado + cuerpo `mainImage()` compatible Shadertoy + epílogo de seguridad (masters, crossfade, limitador fotosensible).
4. **Reference shader** — un raymarcher KIFS (fractal plegado) donde el `morphFactor` controla la complejidad, el kick empuja la cámara y el **ETA de Cassandra tensa la geometría antes del drop**.

Hallazgo arquitectónico clave (§6): con el anillo de 256 B, **la ventana de salida puede renderizar el shader ella misma** — el SAB de vídeo de 8,3 MB deja de ser obligatorio para contenido generativo.

---

## 1. Topología — quién vive dónde

```
┌───────────────────────── MAIN PROCESS ─────────────────────────┐
│ TickEngine (44 Hz)                                              │
│   brain → engine.update() → Selene/Cassandra  ─┐                │
│   audioPipeline.lastAudioData (GodEar V3)     ─┼─► TelemetryWriter
│   LiquidEngineBase.ProcessedFrame (morph)     ─┘      │         │
│   ... DMX commitFrame() ◄── prioridad absoluta        │         │
│                                                       ▼         │
│   TrinityOrchestrator ── FrameContextRing SAB (16 B)  existente │
│                       └─ TheiaTelemetryRing SAB (256 B)  NUEVO  │
└──────────────┬──────────────────────────────┬──────────────────┘
               │ 🌊 WAVE 8215/8216: MessagePortMain — clone 256B (ida)
               │ + ack-transfer (vuelta) — el SAB ya NO cruza la frontera
   ┌───────────▼───────────┐       ┌──────────▼──────────────┐
   │ RENDERER (UI)          │       │ OUTPUT WINDOW (HDMI)     │
   │  ThetaOrchestrator     │       │  Modo A: blit video SAB  │
   │   └► theta.worker      │       │  Modo B: render shader   │
   │      TelemetryReader   │       │    propio + mismo ring   │
   │      Uniform Bridge    │       └──────────────────────────┘
   │      WebGL2 pipeline   │
   └────────────────────────┘
```

- **Productor único**: `TickEngine` en main (confirmado: `TitanOrchestrator` se instancia en `main.ts`, el tick escribe `advanceFrameContext` en `TickEngine.ts:333`).
- **Propietario del SAB**: `TrinityOrchestrator`, junto al `FrameContextRing` — mismo patrón eager, mismo ciclo de vida.
- **Transporte**: nuevo handler `theia:get-telemetry-ring` gemelo de `theia:get-frame-context` (el mecanismo SAB-por-IPC ya está validado en 8207).
- **Consumidores**: theta.worker (siempre) y la ventana de salida (Modo B, §6).

---

## 2. `TheiaTelemetryRing` — el anillo CPU→GPU

### 2.1 Requisitos

| Req | Valor |
|---|---|
| Tamaño | **256 B** exactos (64 slots × 4 B) — una línea de caché ×4, un solo `uniform1fv` |
| Frecuencia de escritura | 44 Hz (tick del `TickEngine`) |
| Frecuencia de lectura | libre (60 Hz display, 44 Hz tick, o ambos) |
| Bloqueo | **Ninguno** — el escritor nunca espera; el lector nunca bloquea al escritor |
| Asignación | Cero en hot-path (ambos lados) |
| Portabilidad | Solo `SharedArrayBuffer` + `Int32Array` + `Float32Array` + `Atomics` — testeable en Vitest/Node |

### 2.2 Protocolo de sincronización — Seqlock

`Float32Array` no admite `Atomics`. El patrón correcto para un bloque de floats con un escritor y N lectores es un **seqlock** con el contador en un slot `Int32`:

```
ESCRITOR (TickEngine, 1 vez por tick)          LECTOR (worker / output window)
─────────────────────────────────────          ──────────────────────────────────
s = Atomics.load(i32, SEQ)                      for (attempt < 3):
Atomics.store(i32, SEQ, s + 1)   // impar         s1 = Atomics.load(i32, SEQ)
  ...escribe TICK_ID, FLAGS, ENUMS (Atomics)       if (s1 & 1) continue        // escritura en curso
  ...escribe floats (f32[i] = v)                   copia 64 slots → scratch local
Atomics.store(i32, SEQ, s + 2)   // par           s2 = Atomics.load(i32, SEQ)
                                                   if (s1 === s2) → OK, usar scratch
                                                 fallback: conservar último scratch válido
```

- **Garantía de visibilidad**: en el modelo de memoria de JS, las operaciones `Atomics` son *sequentially consistent* y crean aristas *synchronizes-with*: todas las escrituras de floats anteriores al `store(SEQ, s+2)` son visibles para un lector que observe `s+2`.
- **Tearing**: el lector puede leer floats a medio escribir durante la carrera, pero el re-chequeo de `SEQ` lo descarta. Escrituras `f32` alineadas no se fragmentan en ninguna arquitectura soportada.
- **Acotación**: máximo 3 reintentos → nunca bucle infinito; a 44 Hz la ventana de escritura dura < 1 µs, la colisión es estadísticamente rara.
- **Detección de novedad**: el lector compara `SEQ` con el último observado — si no cambió, se salta la copia (idéntico a `FrameContextReader.readIfChanged()`).

### 2.3 Layout de bytes (schema v1)

Header `Int32` (slots 0–3) + payload `Float32` (slots 4–63). Ambas vistas sobre el mismo SAB.

#### Header (Int32, 16 B)

| Slot | Byte | Campo | Semántica |
|---|---|---|---|
| 0 | 0 | `SEQ` | Contador del seqlock (impar = escribiendo) |
| 1 | 4 | `TICK_ID` | `frameCount` del TickEngine — correlación con FrameContextRing |
| 2 | 8 | `FLAGS` | Bitfield booleano (tabla abajo) |
| 3 | 12 | `ENUMS` | Empaquetado 4×8 bits: `schemaVersion \| predictionType<<8 \| huntState<<16 \| energyZone<<24` |

**FLAGS (bit → significado)**

| Bit | Flag | Fuente |
|---|---|---|
| 0 | `AUDIO_LIVE` | `audioPipeline.hasRealAudio` |
| 1 | `PLL_LOCKED` | `beatState.pllLocked` |
| 2 | `ON_BEAT` | `workerOnBeat` |
| 3 | `KICK` | Omniliquid `isKick` (con frame-hold) |
| 4 | `KICK_EDGE` | Omniliquid `isKickEdge` (flanco único) |
| 5 | `SNARE` | `snareDetected` |
| 6 | `HIHAT` | `hihatDetected` |
| 7 | `PREDICTION_ACTIVE` | Cassandra tiene predicción viva (`prediction !== null`) |
| 8 | `BREAKDOWN` | Omniliquid `isBreakdown` |
| 9 | `APOCALYPSE` | Omniliquid (harshness ∧ flatness) |
| 10 | `ACID` | Omniliquid `acidMode` |
| 11 | `COLOR_SNAP` | GodEar `photon.colorSnap` |
| 12 | `RHYTHMIC_VOID` | GodEar `rhythmic.rhythmic_void` |
| 13–31 | reservado | — |

**ENUMS**

| Byte | Enum | Valores |
|---|---|---|
| 0 | `schemaVersion` | `1` |
| 1 | `predictionType` | 0 none · 1 `drop_incoming` · 2 `buildup_starting` · 3 `breakdown_imminent` · 4 `transition_beat` |
| 2 | `huntState` | 0 sleeping · 1 stalking · 2 evaluating · 3 striking · 4 learning |
| 3 | `energyZone` (Selene) | 0 calm · 1 rising · 2 peak · 3 falling |

#### Payload (Float32, 240 B)

| Slot | Byte | Campo | Rango | Fuente (código real) |
|---|---|---|---|---|
| **CLOCK** |||||
| 4 | 16 | `T_SEC` | 0–3600 (wrap) | `Date.now()` — envuelto para precisión `float` |
| 5 | 20 | `BPM` | 0–300 | `context.bpm` (post-shield + EMA) |
| 6 | 24 | `BEAT_PHASE` | 0–1 | PLL phase si locked, si no worker phase |
| 7 | 28 | `BAR_PHASE` | 0–1 | `((beatCount % 4) + beatPhase) / 4` |
| 8 | 32 | `BEAT_CONFIDENCE` | 0–1 | `workerBpmConfidence` |
| 9 | 36 | `ENERGY` | 0–1 | `lastAudioData.energy` |
| **GODEAR — 7 bandas tácticas (post-AGC)** |||||
| 10 | 40 | `SUB_BASS` | 0–1 | 20–60 Hz |
| 11 | 44 | `BASS` | 0–1 | 60–250 Hz |
| 12 | 48 | `LOW_MID` | 0–1 | 250–500 Hz |
| 13 | 52 | `MID` | 0–1 | 500–2 kHz |
| 14 | 56 | `HIGH_MID` | 0–1 | 2–6 kHz |
| 15 | 60 | `TREBLE` | 0–1 | 6–16 kHz (`lastAudioData.high`) |
| 16 | 64 | `ULTRA_AIR` | 0–1 | 16–22 kHz |
| **GODEAR — métricas perceptuales** |||||
| 17 | 68 | `CENTROID_N` | 0–1 | `spectralCentroid / 8000` clamp — "brillo" |
| 18 | 72 | `FLATNESS` | 0–1 | Wiener entropy — ruido vs tono |
| 19 | 76 | `CREST_N` | 0–1 | `crestFactor` normalizado — dinámica |
| 20 | 80 | `HARSHNESS` | 0–1 | aspereza |
| 21 | 84 | `SPECTRAL_FLUX` | 0–1 | Flux V3 whitened |
| 22 | 88 | `TRANSIENT_DENSITY` | 0–1 | `photon.transientDensity` (ventana 500 ms) |
| 23 | 92 | `SATURATION` | 0–1 | `photon.saturation` — índice brickwall |
| 24 | 96 | `CHROMA_HUE` | 0–1 | `photon.hue / 360` — círculo de quintas |
| 25 | 100 | `CHROMA_FLUX` | 0–1 | velocidad de cambio armónico |
| **RITMO** |||||
| 26 | 104 | `KICK_ENERGY` | 0–1 | `pureBass = max(0, bass − lowMid·0.40)` (Omniliquid naked delta) |
| 27 | 108 | `SNARE_ENERGY` | 0–1 | `rhythmic.snare_energy` |
| 28 | 112 | `HIHAT_ENERGY` | 0–1 | `rhythmic.hh_energy` |
| 29 | 116 | `SYNCOPATION` | 0–1 | `context.syncopation` |
| **SELENE / CASSANDRA** |||||
| 30 | 120 | `SEL_CONFIDENCE` | 0–1 | `AITelemetry.confidence` |
| 31 | 124 | `SEL_PRED_PROB` | 0–1 | `predictionProbability` (organic confidence, colapsa sin PLL) |
| 32 | 128 | `SEL_ETA_MS` | 0–16000 | ms hasta el evento, **recalculado en el momento de publicar** |
| 33 | 132 | `SEL_ETA_BEATS` | 0–16 | `ETA_MS / msPerBeat` — cuantizado a rejilla PLL (FLUID 4) |
| 34 | 136 | `SEL_TENSION` | 0–1 | `emotionalTension` (FLUID 3) |
| 35 | 140 | `SEL_BEAUTY` | 0–1 | `beautyScore` |
| 36 | 144 | `SEL_ZSCORE_N` | 0–1 | Z-score de energía / 4 — proximidad a Glass Break |
| 37 | 148 | `SPECTRAL_BUILDUP` | 0–1 | `spectralBuildupScore` (rolloff↑ flatness↑ subbass↓) |
| **OMNILIQUID** |||||
| 38 | 152 | `MORPH_FACTOR` | 0–1 | profundidad armónica (`ProcessedFrame.morphFactor`) |
| 39 | 156 | `RECOVERY_FACTOR` | 0–1 | recuperación post-breakdown |
| 40 | 160 | `LQ_FLOOR` | 0–1 | zona floor (instantánea) |
| 41 | 164 | `LQ_AMBIENT` | 0–1 | zona ambient (EMA 800 ms / 10 s — "respiración") |
| 42 | 168 | `LQ_AIR` | 0–1 | zona air (soft-compressed) |
| 43 | 172 | reservado | — | — |
| **CHROMAGRAMA 12 bins** |||||
| 44–55 | 176–223 | `CHROMA[0..11]` | 0–1 | C → B normalizado (tonalidad para shaders) |
| **RESERVA** |||||
| 56–63 | 224–255 | reservado | — | stereo width/balance, futuros motores |

**Presupuesto de escritura**: 3 `Atomics.store` + ~52 `f32` stores ≈ **< 1 µs** por tick. Cero objetos.

### 2.4 Punto de publicación en `TickEngine`

```
processFrame()
  ├─ advanceFrameContext()            (línea 333 — reloj, sin cambios)
  ├─ análisis audio / BPM / PLL
  ├─ await engine.update()            (línea 864 — Selene + Omniliquid frescos)
  ├─ ... arbitraje, NodeResolver
  ├─ dmxWriter.commitFrame()          (línea 1750 — DMX SALE PRIMERO)
  └─► telemetryWriter.publish(...)    ◄── AQUÍ. Nunca retrasa un byte DMX.
```

Publicar **después** del commit DMX: la telemetría visual llega ~0,1 ms más tarde, imperceptible, y garantiza por construcción que Theia no puede afectar al presupuesto de 23 ms del tick.

### 2.5 Brechas de fuente detectadas (a resolver en la fase de implementación)

| # | Brecha | Evidencia | Resolución propuesta |
|---|---|---|---|
| T1 | **`morphFactor` no llega al TickEngine** | Vive en `LiquidEngineBase.ProcessedFrame` (`LiquidEngineBase.ts:44`); `SeleneLux` solo lo expone para chill (`morphFactor: number \| null`, `SeleneLux.ts:207`) | Getter zero-alloc `getLastMorphFactor()` en la cadena `TitanEngine → SeleneLux → liquid engine`. `LiquidTelemetryObserver` ya lo captura (línea 179) — reutilizable |
| T2 | **`getConsciousnessTelemetry()` devuelve un objeto nuevo** | `TitanEngine.ts:1544` — firma de objeto literal | A 44 Hz sería GC churn. Añadir accessor de campos escalares o un *out-param* pre-asignado |
| T3 | **ETA es un snapshot** | `predictionTimeMs` se calcula al predecir, no al publicar | Escribir `predictedEventAt − now` en el momento de `publish()`. El worker extrapola `ETA −= dt` entre ticks |
| T4 | **Dos taxonomías de `energyZone`** | Selene usa 4 estados (`calm/rising/peak/falling`), `.theia` usa 7 (`silence…peak`) | El anillo transporta la de Selene (runtime). El mapeo a 7 zonas es responsabilidad del matcher de átomos, no del shader |
| T5 | **`spectralBuildupScore` y `emotionalTension` son internos a Cassandra** | `PredictionEngine` privado | Exponer vía la misma telemetría escalar de T2 |
| T6 | **`photon.strobe` siempre `active:false`** | Decisión de diseño documentada en GodEar | No se transporta. El strobe visual lo decide el shader con `KICK_EDGE` + limitador §4.6 |

---

## 3. El pipeline WebGL del worker — Uniform Bridge

### 3.1 Desacoplar dos relojes (corrección necesaria del estado 8207)

Hoy el worker renderiza **cuando ve un tick nuevo** del `FrameContextRing` → el output es **44 fps**, no 60. El DoD de 8207 ("60 fps constantes") solo se cumple si se separan:

| Reloj | Frecuencia | Responsabilidad |
|---|---|---|
| **Telemetry clock** | 44 Hz (TickEngine) | Datos musicales — seqlock |
| **Render clock** | Refresco de pantalla | `requestAnimationFrame` en el `DedicatedWorkerGlobalScope` (disponible en Chromium junto a `OffscreenCanvas`) |

El render loop lee el anillo en cada frame de pantalla; si `SEQ` no cambió, reutiliza el scratch y solo avanza el suavizado/extrapolación. Resultado: movimiento a 60/120 Hz fluido sobre datos a 44 Hz.

### 3.2 Pipeline por frame

```
rAF(now) ─► dt = now − last
   │
   ├─ 1. TelemetryReader.read()   seqlock → scratchRaw: Float32Array(64)   [zero-alloc]
   ├─ 2. Smoother.step(dt)        scratchRaw → scratchSmooth (one-pole por slot, §3.3)
   ├─ 3. Derivations              u_beatTime, u_kickPulse, u_approach, ETA extrapolado (§3.4)
   ├─ 4. Upload                   gl.uniform1fv(loc_tel, scratchSmooth, 4, 60)  ← UNA llamada
   │                              + uniform1i(u_flags) + uniform4i(u_enums) + derivados
   ├─ 5. Draw                     fullscreen triangle, programa activo (o crossfade A→B)
   └─ 6. Output                   Modo A: readPixels → video SAB · Modo B: nada (§6)
```

### 3.3 Suavizado por slot (el schema como fuente única de verdad)

Un **descriptor declarativo** único alimenta al writer (main), al reader (worker), al generador del preámbulo GLSL y a los tests:

```
TELEMETRY_SCHEMA = [
  // slot  uniform            attack  release  notes
  { 10, 'u_subBass',          0.60,   0.10  },   // grave: ataque rápido, cola larga
  { 26, 'u_kickEnergy',       1.00,   0.25  },   // sin suavizar ataque — golpe seco
  { 21, 'u_spectralFlux',     0.80,   0.30  },
  { 38, 'u_morphFactor',      0.05,   0.02  },   // ya es EMA asimétrica en origen — solo anti-step
  { 32, 'u_predictiveETA',    —,      —     },   // NO se suaviza: se extrapola (§3.4)
  { 24, 'u_chromaHue',        circular        }, // interpolación angular (wrap 1→0)
  ...
]
```

- `attack/release` expresados como coeficiente por frame a 60 Hz; el worker los corrige por `dt` (`k' = 1 − (1−k)^(dt·60)`) para ser independiente del refresco.
- Tipos especiales: `circular` (hue), `none` (flags, enums), `extrapolate` (ETA, beat).

### 3.4 Uniforms derivados (calculados en el worker, no en el anillo)

| Uniform | Cálculo | Por qué en el worker |
|---|---|---|
| `u_time` | segundos monotónicos de render | Continuidad a 60 Hz |
| `u_dt` | delta del frame | — |
| `u_resolution` | `vec3(w, h, pixelRatio)` | — |
| `u_beatTime` | beats acumulados continuos: integra `BPM/60 · dt`, re-ancla a `BEAT_PHASE` con corrección suave | Rotaciones sincronizadas sin saltos entre ticks |
| `u_kickPulse` | `exp(−t_since_kickEdge / τ)`, `τ = 0.25 · msPerBeat` | Envolvente musical — decae en proporción al tempo |
| `u_snarePulse` | idem con flanco `SNARE` | — |
| `u_predictiveETA` | `SEL_ETA_MS/1000 − t_since_publish`, clamp ≥ 0 | Cuenta atrás fluida entre ticks |
| `u_approach` | `(1 − clamp(ETA/horizon, 0, 1)) · predProb · confidence`, horizon = 8 beats | **La rampa oráculo**: 0 → 1 cuando el drop se acerca, ponderada por cuánto se cree Cassandra su propia predicción |
| `u_impact` | pulso cuando `ETA` cruza 0 o `KICK_EDGE` con `PREDICTION_ACTIVE` | El "momento" del drop, derivado sin IPC extra |
| `u_brightness` `u_contrast` `u_blackout` | masters de la UI (`theia:set-uniform`) | Cierra los sliders placebo del triaje 8210 |

### 3.5 Diccionario estándar de uniforms (lo que ve un shader)

Generado desde el schema en el **preámbulo**. Un único array físico `u_tel[60]` + macros con nombre → una sola llamada de subida, nombres ergonómicos, y los uniforms no usados cuestan cero (el compilador los elimina).

```glsl
uniform float u_tel[60];          // slots 4..63 del anillo (índice = slot − 4)
uniform int   u_flags;
uniform ivec4 u_enums;            // x=schema y=predictionType z=huntState w=energyZone

#define u_bpm              u_tel[1]
#define u_beatPhase        u_tel[2]
#define u_barPhase         u_tel[3]
#define u_energy           u_tel[5]
#define u_subBass          u_tel[6]
#define u_bass             u_tel[7]
#define u_lowMid           u_tel[8]
#define u_mid              u_tel[9]
#define u_highMid          u_tel[10]
#define u_treble           u_tel[11]
#define u_ultraAir         u_tel[12]
#define u_brightnessSpec   u_tel[13]   // centroid normalizado
#define u_flatness         u_tel[14]
#define u_harshness        u_tel[16]
#define u_spectralFlux     u_tel[17]
#define u_saturation       u_tel[19]
#define u_chromaHue        u_tel[20]
#define u_kickEnergy       u_tel[22]
#define u_snareEnergy      u_tel[23]
#define u_hihatEnergy      u_tel[24]
#define u_seleneConfidence u_tel[26]
#define u_predictionProb   u_tel[27]
#define u_tension          u_tel[30]
#define u_spectralBuildup  u_tel[33]
#define u_morphFactor      u_tel[34]
#define u_lqAmbient        u_tel[37]
#define u_chroma(i)        u_tel[40 + (i)]
// ...(tabla completa generada automáticamente desde TELEMETRY_SCHEMA)

bool telFlag(int bit) { return ((u_flags >> bit) & 1) == 1; }
#define KICK       telFlag(3)
#define PREDICTING telFlag(7)
#define BREAKDOWN  telFlag(8)
```

> La numeración de macros **nunca se escribe a mano**: la genera el mismo descriptor que usa el writer. Si el layout cambia, `schemaVersion` sube y el preámbulo se regenera — ningún shader de usuario se rompe porque solo referencia nombres.

**Evolución WebGL2**: migrar `u_tel[]` a un **Uniform Buffer Object** (`std140`, 15 × `vec4`) con `bufferSubData` directo desde el scratch. Misma API de macros; ahorra validación por-uniform. No bloqueante para v1.

---

## 4. Contrato de shaders runtime (sin dependencias)

### 4.1 Anatomía del programa compilado

```
┌────────────────────────────────────────────┐
│ PREÁMBULO (generado por el worker)          │  #version 300 es · precision highp
│   versión, precisión, uniforms estándar,    │  u_tel[] + macros + derivados
│   aliases Shadertoy, librería Euclid        │  iTime/iResolution → u_time/u_resolution
├────────────────────────────────────────────┤
│ CUERPO (código del artista / atom .glsl)    │  debe definir:
│                                             │  void mainImage(out vec4 c, in vec2 fragCoord)
├────────────────────────────────────────────┤
│ EPÍLOGO (generado por el worker)            │  main(): llama mainImage, aplica
│                                             │  masters, crossfade con u_prevFrame,
│                                             │  limitador fotosensible, gamma
└────────────────────────────────────────────┘
```

- **`mainImage()` compatible Shadertoy** — decisión deliberada: acceso inmediato a un ecosistema enorme de shaders de referencia con solo reemplazar `iTime/iResolution` (los aliases ya están en el preámbulo).
- **Requisito WebGL2 / GLSL ES 3.00** para el camino generativo (bucles dinámicos, operaciones de bits, `texelFetch`). Si solo hay WebGL1, el worker cae al plasma interno de 8207 y reporta `generative: unsupported`.
- **Librería Euclid** (en el preámbulo, sin coste si no se usa): `rot2`, `sdSphere`, `sdBox`, `sdTorus`, `smin`, `opRep`, `palette` (Íñigo Quílez cosine), `hash21`, `noise3`.

### 4.2 Metadatos embebidos — `@euclid`

Cabecera en comentarios (inspirada en ISF, sin parser externo):

```glsl
// @euclid name     "Oracle KIFS"
// @euclid author   "LuxSync"
// @euclid genome   aggression=0.6 chaos=0.7 organicity=0.3
// @euclid zone     active..peak
// @euclid param    u_twist   float 0.0 2.0 0.6  "Twist"
// @euclid param    u_hueBias float 0.0 1.0 0.0  "Hue Bias"
// @euclid steps    96
```

- `genome`/`zone` → el shader es un **átomo** con el mismo ADN que un `.theia` de vídeo (propuesta *Hybrid Deck* de 8210: `source.kind = 'shader'`). Cassandra/el matcher no distinguen el medio.
- `param` → la UI genera sliders automáticamente con `data-midi-bind="theia.shader.<id>.<param>"` — MIDI Learn gratis.
- `steps` → sugerencia para el governor de rendimiento (§4.5).

### 4.3 Protocolo worker (mensajes nuevos)

| Mensaje | Dirección | Payload | Efecto |
|---|---|---|---|
| `theia:attach-telemetry` | UI → worker | `{ sab }` | Crea `TelemetryReader` |
| `theia:load-shader` | UI → worker | `{ shaderId, source, meta }` | Compila y cachea (no activa) |
| `theia:activate-shader` | UI → worker | `{ shaderId, crossfadeMs }` | Cambia de programa con crossfade (el mecanismo `prevTex` de 8207 ya existe) |
| `theia:set-uniform` | UI → worker | `{ name, value }` | Masters + params `@euclid` |
| `theia:shader-status` | worker → UI | `{ shaderId, ok, compileMs, log?, line? }` | Error con **línea corregida** (restando líneas del preámbulo) |
| `theia:perf-report` | worker → UI | `{ fps, gpuMs?, renderScale }` | Telemetría del governor (~1 Hz) |

### 4.4 Ciclo de compilación

1. Hash del `source` → si está en caché LRU (máx. 8 programas), reutilizar.
2. Ensamblar preámbulo + cuerpo + epílogo.
3. Compilar con **`KHR_parallel_shader_compile`** si existe: sondear `COMPLETION_STATUS_KHR` en frames sucesivos → **nunca se congela el render** durante la compilación (el programa anterior sigue en pantalla).
4. Link → cachear locations de los uniforms estándar (una vez).
5. Error → programa anterior intacto, `shader-status { ok:false, log, line }`. Nunca pantalla negra por un typo.

### 4.5 Governor de rendimiento

| Mecanismo | Detalle |
|---|---|
| `u_renderScale` | Se renderiza a `scale × resolución` en un FBO y se escala al canvas. Default 0.75 en raymarching |
| Control adaptativo | Si el frame time medio > 15 ms durante 1 s → `scale −= 0.1` (mín. 0.4); si < 10 ms → `+0.05` (máx. 1.0). Histéresis para no oscilar |
| `EXT_disjoint_timer_query_webgl2` | Si está disponible, mide GPU real; si no, usa tiempo de frame del rAF |
| `MAX_STEPS` | `#define` inyectado desde `@euclid steps` y degradable por el governor |
| Context loss | Handlers de 8207 ya existentes: recompila la caché al restaurar |

### 4.6 Epílogo de seguridad (no negociable)

- **Masters**: `color = (color − 0.5) · contrast + 0.5; color *= brightness; color *= 1 − blackout`.
- **Crossfade**: `mix(texture(u_prevFrame, uv), color, u_blend)`.
- **Limitador fotosensible**: compara luminancia media con el frame anterior (mip de 1×1 de `u_prevFrame`); limita el delta a un máximo que impide más de **3 flashes/s** de alto contraste (criterio WCAG 2.3.1 para pantallas grandes — más estricto que el cap de 12 Hz del StrobeEngine, apropiado para muros LED que cubren todo el campo visual). Desactivable solo con flag explícito de operador.
- **Clamp final** a `[0,1]` + conversión sRGB.

---

## 5. Hello World generativo — Oracle KIFS (GLSL de referencia)

Raymarcher de un **fractal KIFS** (Kaleidoscopic Iterated Function System): pliegues de simetría + escalado iterado. Cada parámetro geométrico está atado a un motor:

| Parámetro visual | Uniform | Motor | Lectura musical |
|---|---|---|---|
| Complejidad del fractal (iteraciones, escala de pliegue) | `u_morphFactor` | Omniliquid | Techno industrial (0,1–0,3) → geometría dura y simple; melódico (0,6–0,8) → catedral fractal |
| Rotación global | `u_beatTime` | PLL | Una vuelta cada N beats — la geometría baila en rejilla |
| Empuje de cámara + escala | `u_kickPulse`, `u_kickEnergy` | Omniliquid/GodEar | Cada bombo "respira" la estructura |
| **Torsión y compresión pre-drop** | `u_approach`, `u_predictiveETA` | **Cassandra** | La geometría se retuerce y la cámara avanza **antes** del drop |
| Explosión en el drop | `u_impact` | Cassandra + kick | Expansión radial al cruzar ETA = 0 |
| Destellos de superficie | `u_hihatEnergy`, `u_treble` | GodEar | Brillo especular granular |
| Niebla / respiración | `u_lqAmbient`, `u_subBass` | Omniliquid | La sala respira |
| Paleta | `u_chromaHue` | GodEar ChromaCoupler | Color desde la tonalidad (círculo de quintas) |
| Distorsión glitch | `u_harshness`, `u_flatness` | GodEar | Solo en modo `APOCALYPSE` |

```glsl
// @euclid name    "Oracle KIFS — Hello World Generativo"
// @euclid genome  aggression=0.55 chaos=0.60 organicity=0.45
// @euclid zone    gentle..peak
// @euclid param   u_twist float 0.0 2.0 0.6 "Twist"
// @euclid steps   96
//
// El preámbulo ya declara: u_time, u_resolution, u_tel[] + macros,
// u_beatTime, u_kickPulse, u_approach, u_impact, u_predictiveETA,
// telFlag(), rot2(), palette(), hash21().

uniform float u_twist;

// ─── SDF: fractal KIFS ──────────────────────────────────────────────────
// morphFactor → profundidad armónica = profundidad geométrica.
float mapFractal(vec3 p) {
    // ORACLE: la torsión crece a medida que Cassandra ve venir el drop.
    // u_approach ya está ponderado por predictionProb × confidence:
    // si Selene no está segura, la geometría no miente.
    float twist = u_twist + u_approach * 2.5;
    p.xy *= rot2(p.z * twist * 0.15);

    // Compresión pre-drop: el espacio se contrae (muelle cargándose)...
    // ...y u_impact lo libera en el instante del evento.
    float squeeze = 1.0 - 0.25 * u_approach + 0.45 * u_impact;
    p /= squeeze;

    float scale  = mix(1.75, 2.35, u_morphFactor);           // pliegue más fino con armonía
    int   iters  = 4 + int(u_morphFactor * 4.0 + 0.5);       // 4..8 iteraciones
    vec3  offset = vec3(1.0, 1.0, 1.0) * (0.9 + 0.2 * u_kickPulse);

    float k = 1.0;
    for (int i = 0; i < 8; i++) {
        if (i >= iters) break;
        p = abs(p);                                   // pliegue de simetría
        if (p.x < p.y) p.xy = p.yx;                   // pliegues kaleidoscópicos
        if (p.x < p.z) p.xz = p.zx;
        if (p.y < p.z) p.yz = p.zy;
        p.xy *= rot2(0.18 + u_beatTime * 0.0625);     // 1 vuelta cada 16 beats... escalada por pliegue
        p = p * scale - offset * (scale - 1.0);
        k *= scale;
    }
    return (length(p) - 1.2) / k * squeeze;
}

// ─── Normal (técnica del tetraedro: 4 evaluaciones) ────────────────────
vec3 calcNormal(vec3 p) {
    const vec2 e = vec2(1.0, -1.0) * 0.0008;
    return normalize(e.xyy * mapFractal(p + e.xyy) + e.yyx * mapFractal(p + e.yyx) +
                     e.yxy * mapFractal(p + e.yxy) + e.xxx * mapFractal(p + e.xxx));
}

// ─── Raymarch ──────────────────────────────────────────────────────────
float march(vec3 ro, vec3 rd, out int steps) {
    float t = 0.0;
    for (steps = 0; steps < MAX_STEPS; steps++) {     // MAX_STEPS inyectado por el governor
        float d = mapFractal(ro + rd * t);
        if (d < 0.0006 * t) return t;
        t += d * 0.9;
        if (t > 20.0) break;
    }
    return -1.0;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * u_resolution.xy) / u_resolution.y;

    // Glitch APOCALYPSE: desplazamiento de línea por aspereza espectral
    if (telFlag(9)) {
        uv.x += (hash21(vec2(floor(uv.y * 80.0), floor(u_time * 30.0))) - 0.5)
                * u_harshness * 0.08;
    }

    // ─── Cámara ────────────────────────────────────────────────────────
    // Órbita en rejilla de beats; kick empuja; el oráculo hace dolly-in
    // durante la anticipación (la cámara "se inclina hacia" el drop).
    float orbit = u_beatTime * 0.125;
    float dist  = 5.0 - 1.6 * u_approach - 0.35 * u_kickPulse + 1.2 * u_impact;
    vec3 ro = vec3(sin(orbit) * dist, 0.6 * sin(u_time * 0.1), cos(orbit) * dist);
    vec3 ta = vec3(0.0);
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = cross(uu, ww);
    float fov = 1.6 + 0.4 * u_approach;               // túnel: el FOV se cierra antes del drop
    vec3 rd = normalize(uv.x * uu + uv.y * vv + fov * ww);

    // ─── Paleta desde la tonalidad ─────────────────────────────────────
    // Desaturación pre-drop: el color se retira mientras la tensión carga.
    float sat = 1.0 - 0.6 * u_approach + 0.6 * u_impact;

    int steps;
    float t = march(ro, rd, steps);
    vec3 col = vec3(0.0);

    if (t > 0.0) {
        vec3 p = ro + rd * t;
        vec3 n = calcNormal(p);
        vec3 l = normalize(vec3(0.6, 0.8, -0.4));
        float diff = max(dot(n, l), 0.0);
        float ao   = 1.0 - float(steps) / float(MAX_STEPS);       // AO barato por coste de march
        float spec = pow(max(dot(reflect(-l, n), -rd), 0.0), 32.0);

        vec3 base = palette(u_chromaHue + length(p) * 0.08 + u_lowMid * 0.2,
                            vec3(0.5), vec3(0.5 * sat), vec3(1.0), vec3(0.0, 0.33, 0.67));
        col  = base * (0.15 + 0.85 * diff) * ao;
        col += spec * (0.3 + 2.5 * u_hihatEnergy);                // destellos granulares
        col += base * u_kickPulse * 0.35;                         // bombo = pulso emisivo
    }

    // Niebla que respira con la zona ambient de Omniliquid
    float fog = 1.0 - exp(-0.02 * (t > 0.0 ? t * t : 400.0) * (0.6 + u_lqAmbient));
    vec3 fogCol = palette(u_chromaHue + 0.5, vec3(0.05), vec3(0.08), vec3(1.0), vec3(0.2, 0.1, 0.3));
    col = mix(col, fogCol * (0.4 + u_subBass), fog);

    // Destello radial en el impacto (el limitador del epílogo lo mantiene seguro)
    col += u_impact * 0.6 * exp(-4.0 * length(uv));

    fragColor = vec4(col, 1.0);
}
```

**Comportamiento esperado en una pista con drop**:

| Momento | Selene | Visual |
|---|---|---|
| Verso (morph 0,3) | sin predicción | KIFS simple, órbita lenta a ritmo, pulsos de kick |
| Buildup detectado (`SPECTRAL_BUILDUP` > 0,4, ETA 8 beats, prob 0,7) | `PREDICTING`, `u_approach` sube | La geometría empieza a retorcerse, la cámara avanza, el FOV se cierra, el color se desatura |
| ETA → 0 | `u_approach` ≈ 1 | Máxima torsión y compresión — el "muelle" cargado |
| **Drop** | `u_impact` | Expansión radial, saturación total, destello limitado |
| PLL sin lock | prob colapsa a ~55% (ORGANIC 1) | `u_approach` se atenúa proporcionalmente — el visual **no promete** lo que Cassandra no sabe |

---

## 6. Hallazgo arquitectónico — dónde debe ejecutarse el shader

El anillo de 256 B cambia la economía del pipeline:

| | **Modo A — render en worker** (estado 8207) | **Modo B — render en output window** |
|---|---|---|
| Dónde corre el shader | theta.worker | Proceso de la ventana HDMI (WebGL propio) |
| Qué cruza procesos | 8,3 MB/frame (`readPixels` → video SAB → `ImageData` copy) | **256 B** (telemetry ring) + uniforms de UI |
| Coste de readback | `readPixels` síncrono (stall GPU 2–6 ms a 1080p) + copia SAB→`ImageData` en la ventana | Cero |
| Resolución máxima | 1920×1080 (límite del SAB) | La nativa del muro (4K+) |
| Twin-output DMX (pixel mapping, `TheiaThumbBuffer`) | Directo | El worker renderiza el **mismo shader a 64×64** solo para el thumb (coste GPU trivial) |
| Vídeo `.mp4` | Nativo (WebCodecs en worker) | La ventana necesita su propio decode o seguir en Modo A |

**Recomendación**: arquitectura **dual-mode por tipo de fuente**:
- Átomos `kind: 'shader'` → **Modo B** (render nativo en la ventana HDMI + thumb 64×64 en el worker para DMX).
- Átomos `kind: 'video'` → **Modo A** (pipeline 8207 intacto).
- El mismo `.glsl` compila en ambos contextos — el preámbulo/epílogo es idéntico.

**Mejora intermedia de Modo A** (antes de Modo B): readback asíncrono con **PBO** (WebGL2 `PIXEL_PACK_BUFFER` + `fenceSync` + `getBufferSubData` diferido un frame) — elimina el stall síncrono de `readPixels`.

---

## 7. Garantías de aislamiento DMX

| Riesgo | Mitigación por diseño |
|---|---|
| El writer retrasa el tick | Publica **después** de `dmxWriter.commitFrame()`; < 1 µs; cero alloc; cero `Atomics.wait` |
| El lector bloquea al escritor | Seqlock: el escritor no sabe que hay lectores |
| GC en main por telemetría | Brechas T2/T5 exigen accessors escalares — sin objetos por tick |
| Shader pesado degrada la UI | Worker aislado (hilo propio); en Modo B, proceso propio; governor adaptativo |
| Shader colgado (TDR) | Context-loss handlers → recompilación; el programa anterior en caché |
| Compilación congela el render | `KHR_parallel_shader_compile` + programa anterior en pantalla |
| Flash fotosensible | Limitador de luminancia en epílogo (no desactivable por shaders) |

---

## 8. Testabilidad (cierra el gap G12 "cero tests de Theia")

Todo el núcleo es **TS puro sobre SAB** — testeable en Vitest/Node sin GPU:

- `TelemetryRing`: round-trip writer→reader de todos los slots; `SEQ` impar descartado; reintentos acotados; `readIfChanged` sin cambios → no copia.
- Concurrencia: writer en `worker_threads` a alta frecuencia + reader — nunca devuelve un snapshot mezclado (verificable escribiendo un patrón donde todos los slots = tickId).
- `TELEMETRY_SCHEMA`: el generador de preámbulo produce macros con índices = slot − 4; sin colisiones; nombres únicos.
- Suavizado: `k'` corregido por `dt` produce la misma curva a 60 y 120 Hz.
- Ensamblado de shader: corrección de número de línea en errores.
- Parser `@euclid`: cabecera → meta estructurada.

---

## 9. Roadmap de implementación

| Fase | Contenido | Dependencias | Riesgo |
|---|---|---|---|
| **E0** | `TheiaTelemetryRing` (writer/reader + schema) + tests Vitest | — | Bajo |
| **E1** | Accessors escalares zero-alloc (T1 morphFactor, T2/T5 Selene) + `publish()` post-DMX en TickEngine + IPC `theia:get-telemetry-ring` | E0 | Medio — toca TickEngine (hot path) |
| **E2** | Worker: render clock `rAF` desacoplado + Uniform Bridge + derivados (`u_beatTime`, `u_kickPulse`, `u_approach`) sobre el plasma existente | E1 | Bajo |
| **E3** | Shader Contract: preámbulo/epílogo, `load/activate-shader`, compilación paralela, caché, errores con línea, governor, limitador | E2 | Medio |
| **E4** | Oracle KIFS como átomo `kind:'shader'` + parser `@euclid` + sliders automáticos en el Hybrid Deck (8210 H3) | E3 + triage H3 | Medio |
| **E5** | Modo B (render nativo en output window) + thumb 64×64 para DMX + PBO async en Modo A | E3 | Alto — segundo contexto GL |

## 10. Definition of Done (motor completo)

- [ ] El anillo publica a 44 Hz con `TICK_ID` idéntico al `FrameContextRing`; tests de concurrencia verdes.
- [ ] Profiling del tick: la publicación añade < 5 µs al percentil 99 y **cero** alloc (heap snapshot estable 10 min).
- [ ] El worker renderiza a la frecuencia de refresco (60/120 Hz) con telemetría a 44 Hz sin judder visible.
- [ ] Un `.glsl` con error de sintaxis muestra la línea correcta en la UI y el output no parpadea.
- [ ] Oracle KIFS: en una pista con buildup→drop, `u_approach` sube antes del drop y `u_impact` coincide con el evento (±1 beat).
- [ ] Con PLL sin lock, la anticipación visual se atenúa (ORGANIC 1 se propaga hasta el píxel).
- [ ] Limitador fotosensible: una señal de flash forzada a 10 Hz nunca supera 3 flashes/s en la salida.
- [ ] Hephaestus/DMX: jitter del tick sin cambios medibles con Theia generativa activa a 1080p.

---

*Fin del blueprint. La geometría ya sabe contar hasta el drop — solo falta darle el número.*
