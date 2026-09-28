# 🔬 WAVE 8276-RECON — LiquidEngineBase Acoustic Physics & Snare Audit

**Fecha:** 2026-05-23 · **Alcance:** ESTRICTAMENTE LECTURA · **Autor:** Devin (forense)
**Supersedes/extends:** `THEIA_SELENE_COGNITIVE_AUDIT.md` (WAVE 8274-RECON)

---

## Resumen ejecutivo

El músculo DSP de LuxSync es mucho más rico de lo que Theia recibe. Hay
**TRES detectores de snare** coexistiendo — el más simple alimenta el flag
`SNARE` del anillo, el más sofisticado (MACD 4D, ~30 sub-waves de calibración
7749.x) **nunca sale del motor**. Además: el flag `STROBE_ACTIVE` añadido en
WAVE 8275 lee una fuente **muerta por diseño** — el StrobeEngine de GodEarFFT
está desactivado permanentemente (`GodEarFFT.ts:2657`). El inventario de
envolventes latentes supera las 25 señales de alto valor. El anillo de
telemetría no tiene slots Float32 libres — pero hay 15 bits de flags libres
y varios slots candidatos a multiplex/packing.

---

## Misión 1 — Autopsia del Snare: TRES algoritmos, no dos

### Detector A — `OnsetDetector.detectOnset` (el que alimenta Theia)

`GodEarFFT.ts:2613` — `detectOnset('snare', mid + lowMid*0.5)` sobre bandas
**pre-AGC** (`rawBands`). Un detector de onset genérico por banda: compara
energía instantánea vs umbral adaptativo, produce `transients.snare` →
`lastAudioData.snareDetected` → `TickEngine` → **flag `SNARE` (bit 5)**.

| | |
|---|---|
| **Qué ve** | Una sola banda ancha 250–2 kHz (mid + lowMid×0.5) |
| **Qué ignora** | Crack 2–5 kHz, body 150–250 Hz, flux, WNS, ritmo |
| **Fallos** | Voces sostenidas en 500 Hz–2 kHz disparan FPs; en techno la caja sintética puede no mover mid (su energía vive en crack/treble) → falsos negativos sistemáticos |
| **A Theia** | ✅ El único de los tres que llega (flag SNARE + `snare_energy` slot 27) |

### Detector B — `RhythmicPercussionTracker` (la AND-gate que se muere de hambre)

`GodEarFFT.ts:1985-2244` — coincidencia **body (150–250 Hz) > EMA×2.0 AND
crack (2–5 kHz) > EMA×1.8** + cooldown 80 ms. Produce `snare_energy` (gated),
`snare_energy_ungated`, `snare_crack_flux`, `snare_body_factor`,
`raw_snare_delta` (crack-only), `raw_hh_delta`, `snare_absence_ms`,
`hh_absence_ms`, `rhythmic_void`.

**El fallo estructural** (documentado en WAVE 7749.74): en techno el kick
dispara cada beat hacia 150–250 Hz → `snareBodyEMA` se infla → el umbral
adaptativo sube → la AND-gate **se cierra permanentemente** → `snare_energy`
se asfixia a 0. La envolvente de release ~330 ms además destruye el
transitorio antes de que cualquier consumidor lo vea. La propia clase ya
exporta el antídoto (`snare_energy_ungated` = crack sin gate), pero **solo
LiquidEngineBase lo consume — Theia recibe la versión hambreada** en el
slot 27.

### Detector C — MACD "Momentum 4D" (el músculo que nunca sale)

`LiquidEngineBase.ts:1047-1620` — solo activo cuando el perfil define
`snareMomentumThreshold` (techno). ~570 líneas, ~30 sub-waves 7749.x de
calibración forense con logs por track (Brejcha/Tiesto/Opus/Minimal).

**Cadena de drive:**
```
crackDrive  = residual_NLMS × crackFlux × bodyFactor × smartSef
trebleGhost = rawHhDelta × smartSef × (1−spectralDensity) × rhythmMult
            × (1−gateHealth) × ghostResGate
snareDrive  = max(crackDrive, trebleGhost)
momentum    = EMA_fast(snareDrive) − EMA_slow(snareDrive)     // MACD
onset       = momentum cruza θ_dinámico al alza               // topológico,
                                                             // no cooldown
```

Capas defensivas acumuladas: NLMS asimétrico bass→crack (`_crackBleedK`),
flux localizado a la banda crack, body factor, smart-sEF con rescate de
gate muerto (`instantGateDead`/`partialGateBlind`), umbral dinámico por
`spectralDensity` (0.25·harsh + 0.15·flat + 0.60·hhE), rhythm gate por
posición en compás (backbeats 2&4), ghost refractory, bypass rescue,
density path (pintar luz en ruido blanco), suelo dinámico `_snareFloorEma`.

**A Theia: NADA.** La salida alimenta `envSnare` → `backRight` (Snare Slap
DMX) y se muere ahí. Ni el drive, ni el momentum, ni el onset llegan al
anillo.

### Fallos comparados (la tabla que pedía la misión)

| Detector | Starvation (techno) | Vocal FP | Synth FP | DoNgle re-trig | Latencia |
|---|---|---|---|---|---|
| A · Onset mid | Medio | **Alto** (voces en mid) | Medio | Medio | 1 frame |
| B · AND-gate | **Estructural** — gate muere | Bajo (gate×2.0) | Bajo | Bajo (80ms cd) | 1–2 frames |
| C · MACD 4D | Rescatado (ghost+density) | Bajo (NLMS+rhythm) | Bajo (flux+Res gates) | **Topológico** | 1–4 frames |

**Veredicto M1:** Theia escucha el peor de los tres detectores. El flag
`SNARE` salta con vocales y calla ante cajas sintéticas — y el slot
`u_snareEnergy` transporta la señal hambreada de B.

---

## Misión 2 — Minería: las envolventes que nunca salen

### 2.1 Señales calculadas y transportadas hasta `ad`/`lf` pero NO exportadas

Disponibles **ya** en el TickEngine (`ad.rhythmic`, `ad.photon`, `lf`) —
cero coste de captura, solo falta slot/flag:

| Señal | Fuente | Valor para GLSL |
|---|---|---|
| `rhythmic.rhythmic_void` (continuo 0–1) | GodEar B | La flag solo sube a ≥0.75 — el gradiente de "vacío rítmico" permite fundir átomos gradualmente |
| `rhythmic.snare_absence_ms` / `hh_absence_ms` | GodEar B | Relojes de ausencia percusiva — "cuánto lleva sin golpear" alimenta tension visual |
| `rhythmic.snare_energy_ungated` | GodEar B | Crack 2–5 kHz sin gate — el snare real en techno |
| `rhythmic.snare_crack_flux` | GodEar B | Transitorio localizado a 2–5 kHz — onset de caja sin contaminación de hats |
| `rhythmic.snare_body_factor` | GodEar B | Cuerpo membrana 150–250 Hz vs su EMA [0.3–2.0] |
| `rhythmic.raw_hh_delta` / `raw_snare_delta` | GodEar B | Deltas crudos pre-EMA — ataques a latencia cero |
| `photon.wallIntensity` | GodEarPhoton | Suelo fotónico anti-colapso (SI^0.7·0.85) — cuánto "ladrillo" queda |
| `photon.whiteNoiseScore` | GodEarPhoton | Densidad de ruido blanco con supresión de clipping — la firma de buildup techno |
| `ad.agcGainFactor` | AGC | Cuánto está comprimiendo la entrada — contexto de mastering |
| `lf.strobeActive` / `lf.strobeIntensity` | LiquidEngineBase | **El estrobo REAL** (isPureTreblePeak‖isUltraAirCombo, :2459) |
| `lf.snareAttack` | LiquidEngineBase | Envoltorio de ataque de caja para sidechain |
| `lf.rawTrebleDelta` / `rawHighMidDelta` / `rawMidDelta` | LiquidEngineBase | "Oro crudo" para Monte Carlo — deltas de banda sin filtrar |
| `lf.noiseMode` | LiquidEngineBase | flatness > umbral — modo ruido (sin flag hoy) |
| `lf.frontLeft/frontRight/backLeft/backRight/moverLeft/moverRight` | Envelopes zonales | Las 6 envolventes físicas finales del rig — física acústica ya procesada |

### 2.2 Señales internas de LiquidEngineBase (no llegan ni a `lf`)

| Señal | Semántica |
|---|---|
| `_vocalSustainEMA` | **Detector de aislamiento vocal** — EMA rápida de mid con release lento; vocal = mid sostenido con delta baja (:756). Hoy solo penaliza zones |
| `percussiveRatio` | transientTop/harmonicBase — separación armónica/percusiva continua (:655) |
| `tonalSquelch` | 1.0/0.5/0.3/0 — cuánto "sintetizador sostenido" hay (:650-670) |
| `snareDrive` / `momentum` | Drive compuesto NLMS×flux×body×sEF + MACD — la envolvente de caja más cara del repo |
| `gateHealth` | Salud estructural de la AND-gate [0–1] — mide cuánto miente `snare_energy` |
| `spectralDensity` | 0.25·harsh+0.15·flat+0.60·hhE — densidad espectral compuesta |
| `_fluxBaseline` (`fBL`) | Basal de flux — marca buildups densos (0.04 silencio → 0.12 clímax Opus) |
| `_crackBleedK` | Coeficiente NLMS bass→crack aprendido — acoplamiento kick↔caja |
| `vocalPenalty` | Penalización vocal aplicada a zones |
| `_ambientEMA` | SubBass lento (el océano, τ~10 s) — ya exportada vía `ambientIntensity` |
| `cleanMid` | mid − bass×subtract — vocal/synth limpio de resonancia de bombo |

### 2.3 Señales de GodEar no retransmitidas por el pipeline

| Señal | Estado |
|---|---|
| `stereo.correlation/width/balance` | `analyzeStereo()` existe (:1221) pero `stereo:null` en mono y **no viaja en `lastAudioData`** — el RESERVED_60-63 original las nombraba |
| `spectral.rolloff` / `spectral.clarity` | Calculados, no retransmitidos |
| `transients.strength` | Calculado, no retransmitido (los booleans sí) |
| `bandsRaw` (pre-AGC) | Disponibles en worker, no retransmitidos |
| `strobe.drive/rateHz/duty` | **Muertos** — engine desactivado (:2657) |

### 2.4 ⚠️ BUG encontrado — `STROBE_ACTIVE` (WAVE 8275) lee una fuente muerta

`GodEarFFT.ts:2654-2659`: `strobeState = { active: false, ... }` **hardcoded**
— "DESIGN DECISION: Strobe via FFT permanently disabled". El flag bit 14
empaquetado en `TickEngine` lee `photon?.strobe?.active` → **siempre 0**.
La fuente viva es `lf.strobeActive` (LiquidEngineBase:2459,
isPureTreblePeak‖isUltraAirCombo + strobeDuration). Fix trivial en
`publishEuclidTelemetry` — cambiar el origen del bit.

---

## Misión 3 — Limitación actual del código + estrategia de enrutamiento

### 3.1 Inventario de capacidad REAL tras WAVE 8275

| Recurso | Total | Usados | Libres |
|---|---|---|---|
| Payload Float32 (slots 4–63) | 60 | **60** | **0** |
| Flags u32 | 32 | 17 (0–16) | **15** (17–31) |
| Enums u32 | 32 bits | 4×8 (schema/pred/hunt/zone) | 0 útiles |
| Wire slots 56/57 | 2×Int32 | transporte bits | son el header, no reusables |

**El anillo está lleno en floats.** Todo slot tiene nombre, uniform y
consumidor real o potencial. Las opciones del Arquitecto, por coste:

### 3.2 Opción A — Flags (gratis hoy, 15 bits)

Eventos de nivel/borde caben sin tocar floats:
`VOCAL_ACTIVE` (vocalSustainEMA ∧ midDelta bajo) · `NOISE_MODE` ·
`EPIC_SILENCE` (rhythmic_void ≥ 0.9 sostenido) · `STROBE_ACTIVE` (fix a
`lf.strobeActive`) · `GATE_DEAD` (gateHealth < 0.1) · `SNARE_MACD` (onset del
detector C — flag alterno al SNARE del detector A).

### 3.3 Opción B — Packing 3×uint8 en un Float32 (hasta ~4 señales/slot)

La mantissa de f32 tiene 24 bits → caben **tres bytes exactos** por slot:
`f = a·65536 + b·256 + c` con decode `mod`/`floor` en GLSL (resolución
1/256 ≈ 0.4%, imperceptible). Un solo slot `LQ_PACKED` transporta
`vocalPresence | synthSustain | rhythmicVoid`; un segundo `WN_PACKED`
lleva `whiteNoise | wallIntensity | agcStress`. En el worker, el
TelemetrySmoother desempaqueta o el shader decodifica con 3 líneas.
**Coste: el slot debe ser kind 'none' (suavizar un packed rompe los bytes).**

### 3.4 Opción C — Reasignar slots infrautilizados/rotos

Candidatos por auditoría:

| Slot | Estado | Propuesta |
|---|---|---|
| 27 `SNARE_ENERGY` | Señal hambreada en techno (gate muerta) | **Alimentarla de `snare_energy_ungated`** o de `snareDrive` — mismo semántico, mejor señal |
| 56/57 `WIRE_*` | Ya transportan bits Int32 | Podrían multiplexar 4×uint16 de eventos raros en el Int32 (riesgo: rompe contrato pump) |
| 24/25 `CHROMA_HUE/FLUX` | Vivos | No tocar |
| 44–55 `CHROMA_0..11` | 12 slots para pitch-class | Reducir a 4 slots packed 3×8 (audaz — rompe `u_chroma(i)` existente; solo si se necesitan ≥8 slots) |
| 29 `SYNCOPATION` | `ctx.syncopation` — uso bajo en átomos | Candidato honesto de reasignación |

### 3.5 Opción D — Extensión de protocolo (página 2)

El header ya lleva `SCHEMA_VERSION` en enums. El pump podría publicar una
segunda página de 64 floats (ring 512B) o un segundo SAB — sin romper
consumidores viejos (ignorarían la página). **Es la respuesta correcta si
las envolventes zonales (6 intensidades) deben viajar**: no caben packed
de forma útil y son el payload más valioso para shaders "rig-aware".

### 3.6 Recomendación del forense

1. **Inmediato (bugfix):** reconectar `STROBE_ACTIVE` a `lf.strobeActive`.
2. **Corto plazo (Opción A+B):** flags de evento (VOCAL_ACTIVE, EPIC_SILENCE,
   GATE_DEAD) + 1 slot packed (vocal|sustain|void) + 1 slot packed
   (whiteNoise|wallIntensity|agcStress) → los 6 indicadores top del inventario
   por **2 slots**. Los slots a recuperar: 27 SNARE_ENERGY → drive mejorado;
   y 29 SYNCOPATION si el Arquitecto acepta reasignación, o página 2.
3. **Estratégico (Opción D):** si las 6 envolventes zonales + vocal sustain
   continuo + percussiveRatio + snareDrive/momentum han de viajar a 44 Hz
   como floats suavizables — página 2 del anillo. Las señales de detector C
   (`snareDrive`, `gateHealth`, `spectralDensity`) merecen floats propios,
   no bytes.

### Nota sobre `rhythmic_void`

El flag `RHYTHMIC_VOID` (≥0.75) sigue siendo correcto para el gate; pero el
**valor continuo** es un tercio natural de un slot packed (Opción B) —
"silencio épico" como gradiente, no como borde.

---

## Apéndice — el mapa de los 300+

`ProcessedFrame` expone ~30 campos; `GodEarRhythmicPercussion` 10;
`GodEarPhoton` 9; `GodEarSpectralMetrics` 5; `GodEarStereoMetrics` 3;
`GodEarTransients` 5; LiquidEngineBase mantiene ~40 EMAs/deltas internos
con nombres propios (las `_diag*` además duplican 20 para forense). De
~100 señales computadas a 44 Hz, **~30 llegan a GLSL**. Las seleccionadas
en §2 son las de mayor densidad de información por bit de anillo.
