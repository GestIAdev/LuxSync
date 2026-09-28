# WAVE 8274-RECON — Theia Physics & Selene Cognitive Expansion Audit

**Tipo:** Auditoría forense (estrictamente lectura y análisis).
**Pregunta:** qué matemáticas de audio/física llegan hoy a los shaders GLSL de
Theia, qué datos cognitivos de Selene V3/Cassandra/Iliquidcore se están
desperdiciando, y cómo inyectarlos.

---

## 1. Arquitectura del flujo (verificado end-to-end)

```
PCM → GodEarFFT worker (FFT 2048, ~44 Hz)
        ├─ bands post-AGC (7 tácticas) + bandsRaw
        ├─ RhythmicPercussionTracker → rhythmic{...}
        ├─ ChromaCoupler → hue/chromaFlux/colorSnap
        ├─ StrobeEngine → photon{saturation,wallIntensity,strobe,wns,...}
        └─ computeChromaFromSpectrum → chroma[12]
        │
        ▼ IPC structured-clone
AudioPipelineManager.lastAudioData
        │
        ▼ TickEngine.publishEuclidTelemetry (post dmxWriter.commitFrame)
TelemetryWriter.publish() → TheiaTelemetryRing (SAB 256B, seqlock, 44 Hz)
        │
        ▼ TheiaTelemetryPump (snapshotTelemetryPayload + FrameContext header)
MessagePortMain ──clone──▶ theta.worker (mirror local SAB)
        │
        ▼ TelemetryWireReader (gen-barrier) → scratch[64] + flags + enums
        ▼ TelemetrySmoother.step() → out[60] + derivados
        ▼ gl.uniform1fv(u_tel) + escalares derivados por frame
        ▼ GLSL atoms (u_tel[i] macros + euChannels + u_gene[8])

Canal secundario: SeleneTheiaBridge (notify → AssetStateMachine → forceState)
```

## 2. Misión 1 — Físicas y color actuales en Theia

### 2.1 El worker NO hace FFT — los "pulsos" son derivados locales

`u_kickPulse`/`u_snarePulse` no se calculan analizando audio en el worker:
nace del flag `KICK_EDGE`/`SNARE` publicado por el TickEngine y lo reconstruye
`TelemetrySmoother` (`telemetry/TelemetrySmoother.ts:90-99,163-177,~265`):

```
pulse = exp(−(now − edgeMs) / τ),   τ = 0.25 beats (PULSE_TAU_BEATS, tempo-rel.)
```

`u_impact` se dispara con `KICK_EDGE ∧ PREDICTION_ACTIVE` o cuando el ETA
extrapolado cruza 0 (τ absoluto 220 ms). `u_approach` =
`(1 − clamp(etaBeats/8))·predProb·confidence` suavizado (k=0.3).
`u_beatTime` = integral de beats anclada suavemente a `BEAT_PHASE`
(k=0.15, escalable por `masterSpeed`/`u_speed`).

`u_bass`, `u_energy`, etc. son slots `linear` del schema: one-pole
attack/release con corrección de dt (`k' = 1−(1−k)^(dt·60)`) — idéntica
curva a 60 Hz y 144 Hz.

### 2.2 Los DOS algoritmos de snare (están AGUAS ARRIBA, no en Theia)

| | **A — EMA estándar** | **B — Momentum 4D (techno)** |
|---|---|---|
| Vida en | `GodEarFFT.ts:1985` `RhythmicPercussionTracker` | `LiquidEngineBase.ts:1257-1450` |
| Entrada | sub-bandas: body 150–250 Hz + crack 2–5 kHz + hh 5–15 kHz | `residual`, `crackFlux` (2–5 kHz localizado), `bodyFactor` [0.3,2], `smartSef`, `raw_hh_delta`, WNS, gateHealth |
| Detección | `body>2.0·EMA ∧ crack>1.8·EMA` (+ floor + cooldown 80 ms) | `snareDrive = max(crackDrive, trebleGhost)` → **MACD**: `emaFast−emaSlow > dynMomoTh` crossover topológico |
| Suavizado | attack 0.85 / release 0.06 (~330 ms) | las propias EMAs del MACD (drive va crudo) |
| Extras | `rhythmic_void` (√ ausencia snare·hh /3 s) | WNS soft-gate, rhythm gate PLL (backbeats), ghost refractory, dynamic floor por fluxBaseline·gateHealth |
| Salida | `snare_energy` (EMA) → **slot 27** | `_diagSnareDrive`, onset booleano → motores de física, **NO llega al anillo** |

El detector B es el sofisticado: fue calibrado empíricamente (Brejcha/Anyma/
Opus/Tiësto) para rescatar snares sintéticos cuando el crack gate está muerto.
Al anillo solo llega su versión más burda — `rhythmic.snare_energy` (EMA) y el
flag `SNARE` del tracker A. Todo el apartado `raw_snare_delta`,
`snare_energy_ungated`, `snare_crack_flux`, `snare_body_factor`,
`raw_hh_delta` viaja por IPC pero **se descarta en el fill** (solo se leen para
`m.snareDetected`).

### 2.3 Chromagrama → u_chromaHue (cadena completa)

1. `computeChromaFromSpectrum(powerSpectrum,…,chromaBuffer[12])` —
   folding del espectro de potencia a 12 clases de pitch C→B, normalizado.
2. `ChromaCoupler.process(chroma, deltaMs)` (`GodEarFFT.ts:1487-1602`):
   - **Hue** = centroide circular: máximo bin dominante + media ponderada
     w=chroma² (énfasis en el dominante) → hue [0,1) circular.
   - **chromaFlux** = EMA(0.12) de la distancia angular frame-a-frame.
   - **colorSnap** = salto de hue > umbral adaptativo, gated por
     `kickSignal` y `scaledBands.treble`, con `snapCooldown`.
3. Salida IPC: `photon{hue, colorSnap, chromaFlux}` + `chroma[12]`.
4. Fill: `p[24] = photon.hue` (kind `circular` — interpolación por el camino
   corto 1→0), `p[25] = chromaFlux`, flag `COLOR_SNAP` (bit 11),
   `p[44..55] = chroma[i]` verbatim → macro `u_chroma(i)`.

## 3. Misión 2 — Acoplamiento exacto Selene→Theia

### 3.1 Payload (Anillo Euclid, `TickEngine._euclidFill` + flags/enums)

| Bloque | Slots | Contenido |
|---|---|---|
| Header | 0–3 | SEQ, TICK_ID, FLAGS (13 bits), ENUMS (4×u8) |
| Clock | 4–8 | tSec, bpm, beatPhase, barPhase, beatConfidence |
| Energía | 9 | energy post-AGC |
| Bandas | 10–16 | subBass…ultraAir (7) |
| Perceptual | 17–25 | centroid, flatness, crestN, harshness, spectralFlux, transientDensity, saturation, chromaHue, chromaFlux |
| Ritmo | 26–29 | kickEnergy (bass−0.4·lowMid), snareEnergy(EMA-A), hhEnergy, syncopation |
| **Selene/Cassandra** | 30–37 | **confidence, predProb, ETA_ms, ETA_beats, tension, beauty, zScoreN, spectralBuildup** |
| Omniliquid | 38–42 | morphFactor, recoveryFactor, lqFloor/ambient/air |
| Reserva | 43 | libre |
| Chroma | 44–55 | 12 bins verbatim |
| Wire | 56–57 | FLAGS/ENUMS como int (solo wire buffer) |
| Integral | 58–59 | energyTime ∫, barCount |
| Reserva | 60–63 | libre |

- **FLAGS**: audioLive, pllLocked, onBeat, kick, kickEdge, snare, hihat,
  predictionActive, breakdown, apocalypse, acid, colorSnap, rhythmicVoid
  (bit 12 — libres 13..31).
- **ENUMS**: schema | predictionType(1-4) | huntState(0-4) | energyZone(0-3).
- **Derivados worker**: u_beatTime, u_kickPulse, u_snarePulse,
  u_predictiveETA, u_approach, u_impact.
- **GLSL**: `u_tel[60]` + macro por slot + `u_flags` + `u_enums` +
  `euChannels(tc,td,glitch,live,groove)` + `u_gene[8]` (genoma) +
  `u_state` (autómata RGBA16F) — `ShaderAssembler.ts:120-212`.

### 3.2 Canal secundario (grueso, por estado)

`SeleneTheiaBridge.notify({energy, sectionType, dropImminent, frameIndex})`
→ clasifica en `ambient|buildup|drop` con histéresis de energía y llama
`forceState` solo en transiciones. No lleva telemetría continua — es el
selector de escena/átomo, no un canal de físicas.

## 4. Datos Selene V3 DESPERDICIADOS (existentes, no transmitidos)

Verificados en `CognitiveFluidState.ts`, `SeleneTitanConscious.ts`,
`LiquidCognitionCore.ts`, `getConsciousnessTelemetry()` (TitanEngine:1601+):

| Señal | Fuente | Semántica | Estado |
|---|---|---|---|
| **epicness** | `_lastLiquidVerdict.epicness` — autoridad única para Divine/estrobos | presión acústica "épica" (EMA asimétrica α_up/α_down) | ❌ solo UI/council |
| **V(t) vaporPressure** | `fluid.vaporPressure` — refractario emergente post-ignición (β_v, valleyFactor, evaporación) | "sed acumulada" que modula gating | ❌ nunca a Theia |
| **X excitability** | `fluid.excitability` | excitación del fluido cognitivo | ❌ |
| **T temperature / μ viscosity / I impact / CF** | `liquidCognition{...}` (TitanEngine:1644+) | estado fluido completo | ❌ solo telemetría HUD |
| **Π percussiveness** | `FluidDescriptors` — tasa Poisson de crestas CF>2/s | descriptor de género: percusividad | ❌ solo SovereignGuard |
| **M melodicity** | `FluidDescriptors` (midPresence) | melodismo | ❌ |
| **dirtiness / groove** | `FluidDescriptors` | suciedad / groove cognitivo | ❌ (ojo: `groove` GLSL ya existe = beatConfidence — canal distinto) |
| **crestEvent** | `FluidDescriptors.crestEvent` — cresta CF>2, **latencia cero**, anti-voz | evento de impacto inmediato (corroboración soberana 0.5) | ❌ ni siquiera flag |
| **crestRate R(t)** | `FluidDescriptors.crestRate` | tasa de crestas pre-normalización | ❌ |
| **timeToEvent soberano** | `bufferStatus.timeToEvent` (pre-buffer Cassandra) | countdown del efecto bufferizado | ⚠️ cercano a SEL_ETA_MS pero es OTRO reloj (ejecución soberana vs predicción) |
| **s_DNA, s_Z, …** | `liquidCognition.sensors` | bloque sensorial completo | ❌ |
| **whiteNoiseScore** | `photon.whiteNoiseScore` | discriminante snare-real vs synth | ❌ (consumido por B, no por Theia) |
| **wallIntensity / strobe{drive,rate,active}** | `photon.wallIntensity`, `photon.strobe` | estrobo/muro sonoro GodEar | ❌ |
| **rhythmic_void (continuo)** | `rhythmic.rhythmic_void` | vacío percusivo 0-1 | ⚠️ solo como flag ≥0.75 |
| **snareDrive + 5 campos raw** | LiquidEngineBase / rhythmic | el algoritmo B entero | ❌ |
| **section.type** | `context.section` | sección musical nominal | ⚠️ solo vía bridge grueso |

## 5. Misión 3 — Propuesta de expansión cognitiva (sin implementar)

### 5.1 Presupuesto de anillo

Floats libres: **5 slots** (43, 60, 61, 62, 63). Flags libres: 19 bits
(13–31). ENUMS está lleno (4×u8) — un campo nuevo necesita repack o un
segundo enums-slot (un reservado puede actuar de int al estilo WIRE_FLAGS).

### 5.2 Mapeo propuesto (orden por ROI visual)

| Slot | Señal | Kind | Uso shader sugerido |
|---|---|---|---|
| 43 | **EPICNESS** `u_epicness` | linear a=0.4 r=0.1 | intensidad de clímax: abre iris de zoom, satura paleta "divina", desbloquea atómicos de alto impacto (apócrifos) |
| 60 | **VAPOR_PRESSURE** `u_vaporPressure` | linear r=lento | **refracción**: distorsiona/agita el campo durante la "sed" post-evento — V(t) cae al disparar un efecto (sello visual de refractariedad) |
| 61 | **PERCUSSIVENESS** `u_percussiveness` | linear lento | densidad de geometrías: Π alto → subdivisión/réplicas rítmicas; Π bajo → campos orgánicos |
| 62 | **MELODICITY** `u_melodicity` | linear lento | tinte melódico: mezcla paleta armónica (u_chroma) vs paleta rítmica; modula coherencia espacial |
| 63 | **CREST_RATE** `u_crestRate` | linear a=0.7 r=0.2 | densidad de impactos/s: textura granular, "granulometría" del caos |

| Flag bit | Señal | Derivado propuesto (Smoother) |
|---|---|---|
| 13 | **CREST_EVENT** | `u_crestPulse` — como kickPulse pero τ≈80–120 ms (evento de latencia cero, más rápido que el beat) |
| 14 | **STROBE_ACTIVE** | `u_strobeGate` — compuerta física de estrobo (solo si photon.strobe.active) |
| 15 | **SOVEREIGN_COUNTDOWN** | valida u_predictiveETA como countdown de EJECUCIÓN, no solo predicción |
| 16 | **GLASS_BREAK** (aborto soberano) | `u_glassBreak` — pulso único de ruptura (efecto disparado fuera de countdown) |

`u_timeToEvent` y `u_confidence` **ya están cubiertos** (`u_predictiveETA`,
`u_seleneConfidence`, `u_predictionProb`, `u_approach`, `u_impact`) — no
duplicar; lo que falta es *calidad* de la predicción (huntState ya viaja en
enums.z para visualizar stalking/striking).

### 5.3 Tareas de cableado (TickEngine.fill + scratch)

- `EuclidSeleneFrame` += `epicness, vaporPressure, excitability` —
  getters escalares ya existen en `SeleneTitanConscious`
  (`_lastLiquidVerdict.epicness`, `.fluid.vaporPressure`, `.fluid.excitability`).
- `LiquidCognitionCore` ya expone `descriptors` (Π/M/dirtiness/groove) y
  `crestEvent`/`crestRate` — getters escalares directos, cero alloc si se
  leen en `fillEuclidSelene`.
- Flag CREST_EVENT se publica como `KICK_EDGE`: bit arriba solo en el tick
  del evento → el Smoother lo convierte en `u_crestPulse`.
- `photon.whiteNoiseScore`, `photon.wallIntensity`, `strobe.drive` —
  disponibles en `ad.photon` (ya consumido para saturation/flux/td).

### 5.4 Upgrade opcional de estructura

Si 5 slots quedan cortos: el slot 43 puede codificarse como
`LQ_PACKED` (4×u8: lqFloor/ambient/air + 1 libre) y liberar 40–42, o el
chromagrama puede transportarse 2-bins-por-slot (6 slots) liberando 44–55→6.
Recomiendo **NO reempaquetar** — 5 slots + 4 flags cubren el set cognitivo
prioritario y mantienen el contrato wire inmutable (schemaVersion=1).

### 5.5 Mutación del genoma (bonus)

`GenomeEvolver.notify` ya consume barCount/approach/dropActive/beauty.
Con `u_epicness`/`crestEvent` disponibles en el mismo fill, la selección de
fitness puede ponderar epicness sostenida (la autoridad Divine existente)
en lugar del proxy energético actual — los átomos mutan hacia "lo que el
público vivió como épico", no hacia "lo que sonó fuerte".

## 6. Veredicto

Theia **ya es predictiva** (ETA fluido, approach, impact, hunt/zone enums,
chromagrama completo) y su reloj musical es sólido (PLL + beatCount +
integrales). Lo que falta no es plomería — es **densidad cognitiva**: el
núcleo Iliquidcore produce un estado fluido completo (V(t), epicness, X, Π,
M, crestEvent) que hoy solo alimenta gating y HUD. Con 5 slots libres + 4
flags el paquete entra íntegro sin tocar el wire protocol: los átomos pasan
de reactivos-a-el-beat a **conscientes-del-contexto** (epicness para clímax,
V(t) para sed percibida, Π/M para forma-vs-color, crestEvent para chispa de
latencia cero).
