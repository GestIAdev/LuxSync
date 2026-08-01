# POP/ROCK LIVE — Reporte de Envelopes y Configuración 4.1 / 7.1

**Perfil:** `poprock-live` (`POPROCK_PROFILE`)
**Fuente:** `electron-app/src/hal/physics/profiles/poprock.ts`
**Motor base:** `electron-app/src/hal/physics/LiquidEngineBase.ts`
**WAVE de referencia:** 2431 — The Acoustic Profile (verificado WAVE 2470)
**Referencia artística:** Metallica, Red Hot Chili Peppers, Arctic Monkeys, Foo Fighters, The Killers, Queens of the Stone Age, Pink Floyd
**Fecha del reporte:** 2026-07-30

---

## 0. Estado del perfil — VIRGEN / SIN CALIBRACIÓN REAL

Este perfil **nunca ha sido probado en producción con su propia identidad**. Su origen es un destilado del fracasado `RockStereoPhysics2.ts` (WAVE 1017-1019), del cual se eliminó la heurística de subgéneros (detección Prog/Hard con 30s de memoria). Los valores son una **traducción teórica** del `ROCK_UNIFIED_CONFIG` legacy al formato `ILiquidProfile`, sin validación con audio real ni Monte Carlo.

> El usuario reporta que el único show real de pop/rock se hizo con el perfil `latino-fiesta`, que "zafó medianamente bien". `poprock-live` está conectado vía `PROFILE_REGISTRY['pop-rock']` pero no se le ha dado protagonismo por falta de DSP dedicado.

### Diagnóstico inicial de debilidades (pre-calibración)

1. **Sin separación voces vs guitarras.** `envelopeVocal` (Mover R, "Lead/Sizzle") y `envelopeTreble` (Mover L, "Voice & Riff") **ambos cazan mid+highMid** con pesos solapados (`moverLHighMidWeight=0.80`, `moverLMidWeight=0.50` vs `bassSubtractBase=0.45`). Los dos movers reaccionan a la misma energía → voces y guitarras se mueven en espejo.
2. **`envelopeHighMid.gateOn = 0.03`** — extremadamente bajo. Cualquier murmullo de guitarra rítmica lo abre; en 4.1 con `max(snare, highMid)` el Back PAR se queda pegado a ~0.90 constante (el colchón de guitarras domina al snare).
3. **`envelopeHighMid.maxIntensity = 0.90`** + `decayBase = 0.80` — colchón de guitarras con sustain larguísimo y techo alto. En 4.1 compactado, **asfixia al Látigo** (snare `maxIntensity=0.85`) casi siempre.
4. **`envelopeSnare.ghostCap = 0.03`** — ghost residual en el Látigo. En techno es 0.00 (negro entre hits); en rock el 0.03 añade un halo que en compactación 4.1 se suma al colchón.
5. **Sin `overrides41` reales** — el bloque existe pero está vacío (`{}`). 4.1 hereda 100% del base, incluyendo los problemas 2 y 3.
6. **`ambientAttackMs = 250` / `ambientReleaseMs = 900`** — viscosidad ambiental enorme (1.15s de ventana). Para rock orgánico en 7.1 puede funcionar, pero en 4.1 con hardware DMX lento puede generar melaza visual.
7. **System of a Down / noise rock** — los umbrales `apocalypseHarshness=0.75` / `flatnessNoiseThreshold=0.75` son altos. Las "barreras de ruido blanco" de SOAD (distorsión + hat bursts) pueden no disparar ni apocalypse ni acid mode, quedándose en un limbo sin identidad visual.

---

## 1. Envelopes actuales (comunes a 4.1 y 7.1 — sin overrides)

### 1.1 `envelopeSubBass` — Front L (Kick Drum Acústico)
El bombo acústico + bajo eléctrico. Gate moderado para separar del bajo.

| Campo | Valor | Notas |
|---|---|---|
| `gateOn` | **0.15** | |
| `boost` | **2.8** | WAVE 2436.2: 3.0→2.8 sustain orgánico |
| `crushExponent` | **2.2** | convexa — kicks débiles se aplastan |
| `decayBase` | **0.65** | WAVE 2436.2: 0.25→0.65 resonancia de parche real |
| `decayRange` | **0.10** | |
| `maxIntensity` | **0.82** | WAVE 2436.2: 0.78→0.82 más headroom que techno |
| `squelchBase` | **0.03** | |
| `squelchSlope` | **0.45** | squelch dinámico fuerte |
| `ghostCap` | **0.04** | |
| `gateMargin` | **0.01** | |

### 1.2 `envelopeKick` — Front R (Kick Edge / Doble Pedal)
Bateristas humanos: double bass, blast beats, fills rápidos.

| Campo | Valor | Notas |
|---|---|---|
| `gateOn` | **0.12** | más bajo que techno (0.28) — ghost notes |
| `boost` | **2.8** | |
| `crushExponent` | **0.7** | expansivo — kicks débiles saturan |
| `decayBase` | **0.06** | rápido — pedal staccato |
| `decayRange` | **0.10** | |
| `maxIntensity` | **0.82** | |
| `squelchBase` | **0.03** | |
| `squelchSlope` | **0.10** | |
| `ghostCap` | **0.00** | |
| `gateMargin` | **0.01** | |

> **Nota:** `decayBase=0.06` es 7.5× más lento que el techno original (0.0077) pero 1.3× más rápido que el techno calibrado (0.08). En 4.1 con `default` strategy, el smoothing 0.88 del motor se aplica → puente entre frames de kick. Riesgo de melaza en redobles de doble pedal a 200+ BPM.

### 1.3 `envelopeVocal` — Mover R (Lead & Sizzle)
Solos de guitarra + crashes + voces agudas. Caza treble+highMid.

| Campo | Valor | Notas |
|---|---|---|
| `gateOn` | **0.10** | ROCK_UNIFIED gate=0.12, bajado para solos suaves |
| `boost` | **2.5** | ROCK_UNIFIED gain=1.8 ajustado |
| `crushExponent` | **1.2** | ligera compresión — picos extremos de solo |
| `decayBase` | **0.45** | ROCK_UNIFIED decay=0.50, ligeramente más rápido |
| `decayRange` | **0.08** | morph modula sustain en secciones intensas |
| `maxIntensity` | **0.85** | |
| `squelchBase` | **0.02** | |
| `squelchSlope` | **0.12** | |
| `ghostCap` | **0.00** | |
| `gateMargin` | **0.01** | |

### 1.4 `envelopeSnare` — Back R (Snare & Cymbal Snap)
El Látigo rockero. Transient shaper caza snap de snare/rimshot/crashes.

| Campo | Valor | Notas |
|---|---|---|
| `gateOn` | **0.10** | |
| `boost` | **3.5** | WAVE 2436.2: 3.0→3.5 más presencia rimshot/crash |
| `crushExponent` | **0.8** | |
| `decayBase` | **0.35** | WAVE 2436.2: 0.15→0.35 snap orgánico, parche resuena |
| `decayRange` | **0.12** | |
| `maxIntensity` | **0.85** | |
| `squelchBase` | **0.02** | |
| `squelchSlope` | **0.12** | |
| `ghostCap` | **0.03** | halo residual (vs techno 0.00) |
| `gateMargin` | **0.01** | |

### 1.5 `envelopeHighMid` — Back L (Rhythm Guitar & Keys)
Guitarra rítmica, órgano Hammond, pads. **El problema principal del perfil.**

| Campo | Valor | Notas |
|---|---|---|
| `gateOn` | **0.03** | ⚠️ extremadamente bajo — abre con cualquier murmullo |
| `boost` | **4.0** | |
| `crushExponent` | **1.0** | lineal |
| `decayBase` | **0.80** | ⚠️ sustain larguísimo — colchón pegado |
| `decayRange` | **0.05** | |
| `maxIntensity` | **0.90** | ⚠️ techo alto — domina el `max()` en 4.1 |
| `squelchBase` | **0.02** | |
| `squelchSlope` | **0.10** | |
| `ghostCap` | **0.05** | |
| `gateMargin` | **0.005** | |

### 1.6 `envelopeTreble` — Mover L (Voice & Riff)
Voz principal + guitarra mid + riffs. Mid+highMid pesado.

| Campo | Valor | Notas |
|---|---|---|
| `gateOn` | **0.08** | ROCK_UNIFIED gate=0.10, bajado para voces suaves |
| `boost` | **3.0** | ROCK_UNIFIED gain=1.8 ajustado |
| `crushExponent` | **1.0** | lineal — respeta rango dinámico humano |
| `decayBase` | **0.55** | ROCK_UNIFIED decay=0.65, ligeramente más rápido |
| `decayRange` | **0.06** | |
| `maxIntensity` | **0.88** | |
| `squelchBase` | **0.03** | |
| `squelchSlope` | **0.12** | |
| `ghostCap` | **0.04** | la voz nunca desaparece del todo |
| `gateMargin` | **0.008** | |

---

## 2. Configuración escalar del profile (común a 4.1 y 7.1)

### 2.1 Back R — Transient Shaper (trebleDelta×4)

| Campo | Valor | Notas |
|---|---|---|
| `percMidSubtract` | **0.5** | moderado — guitarras distorsionadas tienen mid |
| `percGate` | **0.008** | bajo — ghost notes de caja |
| `percBoost` | **4.5** | entre techno (5.0) y latino (4.0) |
| `percExponent` | **0.6** | ligeramente expansivo — suaviza crashes |

### 2.2 Mover R (Lead/Sizzle) — Bass Subtractor

| Campo | Valor |
|---|---|
| `bassSubtractBase` | **0.45** |
| `bassSubtractRange` | **0.30** |

> `subtractFactor = 0.45 − morphFactor × 0.30` → rango [0.15, 0.45]. Moderado: el bajo eléctrico tiene presencia.

### 2.3 Back L (Rhythm Guitar) — Cross-filter

| Campo | Valor | Notas |
|---|---|---|
| `backLLowMidWeight` | **0.50** | cuerpo de guitarra rítmica |
| `backLMidWeight` | **0.70** | mid pesado — power chords, órgano |
| `backLTrebleSub` | **0.20** | resta treble moderada — no crashes aquí |
| `backLBassSub` | **0.15** | resta bass leve — separar del bajo eléctrico |

### 2.4 Mover L (Voice & Riff) — Cross-filter + tonal gate

| Campo | Valor | Notas |
|---|---|---|
| `moverLHighMidWeight` | **0.80** | highMid pesado — presencia de la voz |
| `moverLTrebleWeight` | **0.10** | poco treble — no competir con Lead/Sizzle |
| `moverLMidWeight` | **0.50** | mid pesado — cuerpo de voz, power chords |
| `moverLTonalThreshold` | **0.70** | ⚠️ MUY permisivo — distorsión ≠ tonal pero queremos que pase |

> **Colisión detectada:** Mover L (voz) y Mover R (lead) ambos pesan highMid. Con GodEarFFT V3 se podría separar por centroides: voz ~400-1200Hz, guitarra lead ~1500-4000Hz.

### 2.5 Mover R (Lead/Sizzle) — Resta de treble

| Campo | Valor | Notas |
|---|---|---|
| `moverRTrebleSub` | **0.15** | resta leve — solos de guitarra son treble |

### 2.6 Sidechain Guillotine — CASI NULO

| Campo | Valor | Notas |
|---|---|---|
| `sidechainThreshold` | **0.20** | alto — solo kicks extremos |
| `sidechainDepth` | **0.00** | WAVE 3457 exterminado globalmente |
| `snareSidechainDepth` | **0.03** | mínimo — snare no mata guitarra |
| `frontKickSidechainThreshold` | **0** | Guillotina 4.1 OFF |
| `auraCapBase` | **0** | OFF |
| `auraCapExponent` | **0** | OFF |

### 2.7 Strobe — Conservador (es concierto, no rave)

| Campo | Valor | Notas |
|---|---|---|
| `strobeThreshold` | **0.88** | MUY alto — solo picos extremos |
| `strobeDuration` | **20** | corto — flash puntual |
| `strobeNoiseDiscount` | **0.90** | casi sin descuento — rock ruidoso no merece strobe fácil |

### 2.8 Modes — umbrales altos (distorsión ≠ acid)

| Campo | Valor | Notas |
|---|---|---|
| `harshnessAcidThreshold` | **0.80** | MUY alto — distorsión del rock es normal |
| `flatnessNoiseThreshold` | **0.75** | alto — rock tiene armónicos, no ruido blanco |
| `apocalypseHarshness` | **0.75** | solo caos real (feedback, noise rock extremo) |
| `apocalypseFlatness` | **0.65** | ligeramente más permisivo — walls of sound |

### 2.9 Kick Detection — Rápido para doble pedal

| Campo | Valor | Notas |
|---|---|---|
| `morphFloor` | **0.20** | rock tiene mid desde la intro (guitarras) |
| `morphCeiling` | **0.60** | chorus rock al 60% de mid → morph pleno |
| `kickEdgeMinInterval` | **50** | MUY corto — blast beats 200+ BPM |
| `kickVetoFrames` | **0** | CERO — bombo no silencia guitarra |

### 2.10 Ambient Viscosity

| Campo | Valor | Notas |
|---|---|---|
| `ambientAttackMs` | **250** | ⚠️ viscoso — resonancia de parche real |
| `ambientReleaseMs` | **900** | ⚠️ larguísimo — 0.9s de ventana ambiental |

### 2.11 Estrategia de enrutamiento

| Campo | Valor |
|---|---|
| `layout41Strategy` | **`'default'`** |

### 2.12 Overrides 4.1

| Campo | Valor |
|---|---|
| `overrides41` | **`{}`** (vacío) |

---

## 3. Modo 7.1 — Asymmetric Split (7 zonas independientes)

Motor: `LiquidEngine71.routeZones()` — path **default** (no latino, no chill). Sin swap de movers: `outMoverL = moverLeft`, `outMoverR = moverRight`.

| Zona física | Envelope / señal | Rol semántico |
|---|---|---|
| **Front L** | `envSubBass.process()` | Bombo acústico + bajo eléctrico |
| **Front R** | `envKick.process()` | Kick edge / doble pedal |
| **Back L** | `envHighMid.process(midSynthInput)` × `1.75` (gain no-techno) | Guitarra rítmica + teclados |
| **Back R** | `envSnare.process(hybridSnare)` | Snare + rimshot + crashes |
| **Mover L** | `envTreble.process(moverLInput)` | Voz principal + riffs (mid+highMid) |
| **Mover R** | `envVocal.process(moverRInput)` | Lead guitar + crashes + voces agudas |
| **Strobe** | binario (umbral 0.88) | Solo en climax |
| **Floor / Ambient / Air** | passthrough 9-zone | capa atmosférica (attack 250ms, release 900ms) |

Notas 7.1 específicas (de `LiquidEngineBase.applyBands`):
- `dmzFactor = 0.30` (no-techno, bombo con cuerpo) para `cleanMidL` de Back L
- `backLeftGain = 1.75` (no-techno) aplicado post-`envHighMid`
- `vocalPenalty` ACTIVO (no-techno) — penaliza Back L cuando hay vocal sostenida
- Sidechain kick inline: `moverL *= (1 − 0.00)`, `moverR *= (1 − 0.00)` → inactivo

**Problema 7.1:** Mover L (voz) y Mover R (lead) reaccionan a bandas solapadas (mid+highMid). Sin separación espectral real, los dos movers se mueven en espejo cuando entra una voz o un solo.

---

## 4. Modo 4.1 — Default (compactación a 4 zonas + strobe)

Motor: `LiquidEngine41.routeZones()` con `isStrict = false` (por `layout41Strategy: 'default'`).

| Zona física | Señal efectiva | Notas |
|---|---|---|
| **Front PAR** (L+R espejo) | `max(envSubBass, envKick)` con smoothing 0.88 | Bombo + bajo fusionados |
| **Back PAR** (L+R espejo) | `max(envHighMid, envSnare)` | ⚠️ Guitarra rítmica (0.90) domina snare (0.85) |
| **Mover L** | `envTreble.process(moverLInput)` | Voz + riffs (idéntico a 7.1) |
| **Mover R** | `envVocal.process(moverRInput)` | Lead + crashes (idéntico a 7.1) |
| **Strobe** | binario (umbral 0.88) | Solo en climax |
| **Floor / Ambient / Air** | passthrough 9-zone | capa atmosférica |

### 4.1 Smoothing del Front PAR (default strategy)
A diferencia de techno (donde neutralizamos el smoothing en strict-split), poprock **mantiene** el release 0.88 porque `frontPar = max(subBass, kick)` se beneficia del bridge: subBass es continuo (bajo eléctrico), kick es impulsivo. El smoothing evita mini-strobo entre frames de kick.

### Diferencias estructurales 4.1 vs 7.1 (resumen)

| Aspecto | 7.1 | 4.1 default |
|---|---|---|
| Front L | `envSubBass` (bombo+bajo) | `max(subBass, kick)` — Front PAR fusionado |
| Front R | `envKick` (doble pedal) | fusionado en Front PAR |
| Back L | `envHighMid` (guitarra rítmica) | `max(highMid, snare)` — Back PAR |
| Back R | `envSnare` (snare+crashes) | `max(highMid, snare)` — Back PAR |
| Mover L | `envTreble` (voz+riff) | `envTreble` (idéntico) |
| Mover R | `envVocal` (lead+sizzle) | `envVocal` (idéntico) |
| Smoothing front | no | sí (0.88 release) |

**Trade-off clave 4.1:** el Back PAR fusiona guitarra rítmica (sustain 0.80, techo 0.90) + snare (sustain 0.35, techo 0.85). Con `max()`, **el colchón de guitarras gana casi siempre** → el snare desaparece visualmente tras el muro de mid. Mismo problema que techno tenía con el Coro vs Látigo, pero más agudo aquí porque `gateOn=0.03` deja el colchón permanentemente encendido.

---

## 5. Puntos calientes para calibrar (con GodEarFFT V3)

### 5.1 Separación voces vs guitarras (el santo grial)
**Problema:** Mover L (voz) y Mover R (lead) ambos cazan mid+highMid con pesos solapados.
**Palanca GodEarFFT V3:** si el nuevo DSP expone centroides por banda o energía vocal separada, se podría:
- Mover L: peso fuerte en **mid puro** (~400-1200Hz) donde vive el cuerpo vocal
- Mover R: peso fuerte en **highMid+treble** (~1500-5000Hz) donde viven los armónicos de guitarra lead y crashes
- Ajustar `moverLTonalThreshold` más estricto (0.70→0.55) para rechazar distorsión de guitarra en el canal de voz

### 5.2 System of a Down / noise rock (atravesar barreras de ruido blanco)
**Problema:** SOAD mezcla distorsión densa + hat bursts + voces guturales. Los umbrales altos (`apocalypseHarshness=0.75`, `flatnessNoiseThreshold=0.75`) dejan al perfil en limbo — ni apocalypse ni acid mode se disparan, y el ruido blanco satura todos los envelopes a la vez.
**Palancas:**
- Bajar `flatnessNoiseThreshold` (0.75→0.60) para que el ruido blanco detectable active noise mode
- Bajar `apocalypseHarshness` (0.75→0.65) para que la distorsión extrema de SOAD dispare apocalypse
- Subir `percGate` (0.008→0.04) para que el Látigo no dispare con cada hat burst
- `envelopeSnare.squelchBase` (0.02→0.10) para pisar el ruido de fondo antes del envelope

### 5.3 Back PAR en 4.1 (guitarra rítmica vs snare)
**Problema:** `envelopeHighMid` (gateOn 0.03, decay 0.80, maxI 0.90) domina `max(envHighMid, envSnare)` → snare invisible.
**Palancas (overrides41):**
- `envelopeHighMid.maxIntensity` 0.90→0.65 (cap por debajo del pico del snare 0.85)
- `envelopeHighMid.decayBase` 0.80→0.55 (liberar entre golpes)
- `envelopeHighMid.gateOn` 0.03→0.10 (no abrir con murmullo)
- `envelopeSnare.gateOn` 0.10→0.06 (más sensible en compactación)

### 5.4 Melaza del doble pedal en 4.1
**Problema:** `envelopeKick.decayBase=0.06` + smoothing 0.88 del motor → en blast beats a 200+ BPM el Front PAR se queda pegado.
**Palancas:**
- `envelopeKick.decayBase` 0.06→0.04 (más staccato)
- En overrides41: considerar neutralizar el smoothing 0.88 para `default` strategy también (como hicimos en techno strict-split), o bajar `FRONTPAR_RELEASE` a 0.75

### 5.5 Viscosidad ambiental excesiva
**Problema:** `ambientAttackMs=250` + `ambientReleaseMs=900` = ventana de 1.15s. En 4.1 con hardware DMX lento genera melaza visual.
**Palancas:**
- `ambientAttackMs` 250→80
- `ambientReleaseMs` 900→300

### 5.6 Ghost residual del Látigo
**Problema:** `envelopeSnare.ghostCap=0.03` añade halo que en 4.1 se suma al colchón.
**Palanca:** `envelopeSnare.ghostCap` 0.03→0.00 (negro entre hits, como techno)

---

## 6. Comparativa rápida con techno (post-calibración WAVE 2520)

| Aspecto | Techno (calibrado) | PopRock (virgen) |
|---|---|---|
| `envelopeKick.decayBase` | 0.08 (anti-micro-strobe) | 0.06 (más rápido, riesgo melaza con smoothing) |
| `envelopeHighMid.maxIntensity` | 0.85 base / 0.60 en 4.1 | 0.90 / sin override → domina Back PAR |
| `envelopeHighMid.gateOn` | 0.15 | 0.03 ⚠️ |
| `envelopeSnare.ghostCap` | 0.00 | 0.03 |
| Movers (voz vs lead) | Bozal desbozalado (1.8/0.15) | Sin separación real, pesos solapados |
| `overrides41` | Completo (Back PAR isolation) | Vacío `{}` |
| `ambientReleaseMs` | 120 (cortante) | 900 ⚠️ (melaza) |
| Sidechain | 0.00 global | 0.00 global (igual) |

---

*Reporte generado desde `poprock.ts` (WAVE 2431/2470) + `LiquidEngineBase.ts` + `LiquidEngine41.ts` + `LiquidEngine71.ts` + `LiquidProfiles.test.ts`. Perfil sin calibración real — todos los valores son traducción teórica del ROCK_UNIFIED_CONFIG legacy.*
