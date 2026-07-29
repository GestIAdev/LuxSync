

Let me continue reading the rest of `LiquidEngineBase.applyBands()` to see the full envelope processing and zone routing:


Now let me read the rest of the latino profile (overrides41 section):

Now let me also check the techno overrides41:

Techno has no `overrides41` — it uses the base profile values directly for 4.1. Now let me also check the [LiquidEnvelope.process()](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:1497:2-1561:3) method to understand the envelope mechanics:

Now I have the complete picture. Here's the full audit report:

---

# Radiografía de Envelopes — Techno vs Latino

## Arquitectura del Pipeline

El motor [LiquidEngineBase.applyBands()](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/hal/physics/LiquidEngineBase.ts:261:2-723:3) recibe un `LiquidStereoInput` con las bandas de GodEarFFT (Photon) y las procesa a través de 6 [LiquidEnvelope](cci:2://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/hal/physics/LiquidEnvelope.ts:130:0-361:1) independientes. Cada envelope tiene su propia configuración extraída del perfil (`ILiquidProfile`). El resultado pasa a [routeZones()](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/hal/physics/LiquidEngineBase.ts:747:2-747:74) (en `LiquidEngine41` o `LiquidEngine71`) que mapea las 6 señales + zonas auxiliares a las zonas canónicas.

## Mapeo de Zonas Canónicas — Routing

### Layout 7.1 (ambos perfiles)

| Zona Canónica | Envelope | Variable photon consumida | Fórmula de entrada |
|---|---|---|---|
| **Front L** | `envSubBass` | `bands.subBass` | Directo |
| **Front R** | `envKick` | `bands.bass` (purificado) | `pureBassEnergy = max(0, bass - lowMid×0.40)`; gate por delta dinámico |
| **Back R** | `envSnare` | `bands.highMid` + `bands.treble` + `harshness` | Transient Shaper híbrido: `rawSpike = highMidDelta + trebleDelta`; `snareSpectrum = mid × (treble×0.5 + harshness)`; dispara si `(rawSpike × snareSpectrum × 10) > 0.19` |
| **Back L** | `envHighMid` | `bands.mid` + `bands.lowMid` + `bands.treble` | Cross-filter: `max(0, lowMid×w + cleanMidL×w - treble×sub - bass×sub)`; `cleanMidL = max(0, mid - bass×dmzFactor)` |
| **Mover L** | `envTreble` | `bands.highMid` + `bands.treble` + `bands.mid` | Cross-filter: `max(0, highMid×w + treble×w + mid×w) × isTonal`; gate tonal: `flatness < moverLTonalThreshold` |
| **Mover R** | `envVocal` | `bands.mid` + `bands.bass` + `bands.treble` | `cleanMid = max(0, mid - bass×subtractFactor)`; `max(0, cleanMid - treble×moverRTrebleSub)` |
| **Strobe/Flash** | Binario | `bands.treble` + `bands.ultraAir` | `treble > strobeThreshold` OR `ultraAir > 0.70 && treble > 0.60` |
| **Floor** | EMA directa | `bands.subBass` + `bands.lowMid` | `min(1, subBass×0.65 + lowMid×0.35)` — sin envelope, reacción instantánea |
| **Ambient** | EMA lenta | `bands.subBass` | EMA asimétrica: attack α=`1000/(ambientAttackMs×44)`, release α=`1000/(ambientReleaseMs×44)`; curva `^2.0` → `^1.3` |
| **Air** | EMA comprimida | `bands.treble` + `bands.highMid` | `1 - e^(-(treble×0.6 + highMid×0.4)×3)`; EMA attack α=0.12, release α=0.05; boost ×1.4 |

### Layout 4.1 — Techno (`strict-split`)

| Zona | Origen | Fórmula |
|---|---|---|
| **Front PAR** | `frontRight` (envKick) | Solo el kick — `frontPar = frontRight` |
| **Back PAR** | `backRight` (envSnare) | Solo el snare — `backPar = backRight` |
| **Mover L** | `moverLeft` (envTreble) | `max(0, highMid×1.0 + treble×0.0 + mid×0.4) × isTonal` |
| **Mover R** | `moverRight` (envVocal) | `max(0, mid - bass×(0.65-morph×0.45) - treble×0.3)` |

### Layout 4.1 — Latino (`strict-split`)

| Zona | Origen | Fórmula |
|---|---|---|
| **Front PAR** | `frontRight` (envKick) | Solo el kick — `frontPar = frontRight` |
| **Back PAR** | `backRight` (envSnare) | Solo el snare — `backPar = backRight` |
| **Mover L** | `moverRight` (envVocal) **SWAP** | Latino swap: `outMoverL = moverRight` (La Dama → Mover L físico) |
| **Mover R** | `moverLeft` (envTreble) **SWAP** | Latino swap: `outMoverR = moverLeft` (El Galán → Mover R físico) |

### Diferencia clave de routing 4.1

En **7.1**, Front L y Front R son zonas independientes (subBass y kick). En **4.1 strict-split**, Front PAR = solo kick (Front R), Back PAR = solo snare (Back R). Los Movers se swapean en Latino (vocal→L, treble→R) pero no en Techno.

---

## Auditoría de Envelopes — Valores Exactos

### Back R (envSnare) — El Látigo — **Causa del problema**

| Parámetro | Techno 7.1 | Techno 4.1 | Latino 7.1 | Latino 4.1 (override) |
|---|---|---|---|---|
| **gateOn** (threshold) | **0.35** | 0.35 (sin override) | **0.40** | **0.55** |
| **boost** | 1.0 | 1.0 | 3.5 | **2.5** |
| **crushExponent** | 1.0 | 1.0 | 1.0 | 1.0 |
| **decayBase** | **0.05** | 0.05 | **0.72** | **0.45** |
| **decayRange** | 0.40 | 0.40 | 0.10 | 0.10 |
| **maxIntensity** | 1.0 | 1.0 | 0.85 | 0.85 |
| **squelchBase** | 0.20 | 0.20 | 0.03 | **0.45** |
| **squelchSlope** | 0.10 | 0.10 | 0.15 | 0.15 |
| **ghostCap** | 0.00 | 0.00 | 0.04 | 0.01 |
| **gateMargin** | 0.01 | 0.01 | 0.01 | 0.01 |

**Análisis del problema — por qué los snares rápidos no encienden los Back PARs en Techno:**

El envelope `envSnare` en Techno tiene **decayBase = 0.05** — extremadamente rápido. La señal de entrada al envelope NO es `bands.snare` directo, sino `hybridSnare`, que es un **transient shaper binario**: vale `1.0` si se detecta impacto, `0.0` si no. 

El transient shaper requiere:
1. `rawSpike × snareSpectrum × 10.0 > 0.19` — donde `rawSpike = highMidDelta + trebleDelta` y `snareSpectrum = mid × (treble×0.5 + harshness)`
2. Debounce anti-jitter de **45ms** entre impactos
3. Hold counter de **4 frames (~90ms)** tras impacto

**El problema**: Para que un snare rápido encienda el Back PAR, necesita:
- Superar el **gateOn = 0.35** del envelope (la señal `hybridSnare` es binaria 0/1, así que siempre lo supera cuando hay impacto)
- PERO el **decayBase = 0.05** significa que la intensidad cae a **5% de su valor por frame**. En ~3 frames (~66ms) la intensidad ya es ~0.01 — prácticamente negro
- El **hold counter de 4 frames** mantiene `hybridSnare = 1.0` por ~90ms, pero el decay de 0.05 compite: tras 4 frames de hold, `intensity = 1.0 × 0.05^4 = 0.00000625`

**Esto es contradictorio**: el hold inyecta `1.0` por 4 frames, pero el decayBase 0.05 hace que cada frame la intensidad previa se multiplique por 0.05 antes de aplicar el nuevo `max(intensity, hit)`. Como `hit` se recalcula con `boost = 1.0` y `maxIntensity = 1.0`, el resultado es `max(0.05^N, 1.0)` = `1.0` durante el hold. **El decay NO mata el hold** porque `max(intensity, hit)` siempre gana el `hit = 1.0`.

Entonces el problema NO está en el decay. Está **antes del envelope**: el transient shaper no está disparando para snares rápidos de Techno (Boris Brejcha). Las condiciones son:

1. **`tonalSquelch`** (Harmonic Rejection Gate, línea 279-293): Si `percussiveRatio = (highMid + treble + ultraAir×0.5) / mid < 0.88` → `tonalSquelch = 0.0` (muerte absoluta). Si el snare de Brejcha tiene mucho contenido mid (caja electrónica con cuerpo), el ratio puede ser < 0.88 y **se anula antes de llegar al transient shaper**.

2. **`bassLeakage = lowMid × 1.5`** se resta a `rawSnare = max(0, highMid × tonalSquelch - bassLeakage)`. Si `lowMid` es alto (techno con bajo continuo), `rawSnare` puede ser 0.

3. **`rawSnareCalc = (rawSpike × snareSpectrum × 10.0) > 0.19`**: `snareSpectrum = mid × (treble×0.5 + harshness)`. Si `mid` es bajo (snare agudo seco sin cuerpo mid), `snareSpectrum` es pequeño y el producto no supera 0.19.

**Conclusión**: Los snares rápidos de Brejcha son probablemente **cajas electrónicas agudas con poco contenido mid** → `snareSpectrum = mid × (treble×0.5 + harshness)` es pequeño → `rawSpike × snareSpectrum × 10 < 0.19` → **no dispara**. Los "pings" (sonidos agudos puros) sí funcionan porque tienen `treble` muy alto que eleva `trebleDelta` y compensan la falta de mid.

---

### Front L (envSubBass) — El Océano

| Parámetro | Techno | Latino 7.1 | Latino 4.1 (override) |
|---|---|---|---|
| **gateOn** | 0.08 | 0.15 | **0.22** |
| **boost** | 2.7054 | 2.5 | **1.25** |
| **crushExponent** | 1.0 | 1.0 | 1.0 |
| **decayBase** | 0.2218 | 0.50 | 0.50 |
| **decayRange** | 0.166 | 0.08 | — |
| **maxIntensity** | 0.5291 | 0.80 | 0.80 |
| **squelchBase** | 0.0613 | 0.18 | 0.18 |
| **squelchSlope** | 0.5788 | 0.50 | — |
| **ghostCap** | 0.0357 | 0.00 | — |
| **gateMargin** | 0.0288 | 0.01 | — |

### Front R (envKick) — El Francotirador

| Parámetro | Techno | Latino 7.1 | Latino 4.1 (override) |
|---|---|---|---|
| **gateOn** | 0.28 | 0.18 | — |
| **boost** | 3.3013 | 2.5 | — |
| **crushExponent** | 1.0 | 1.0 | 1.0 |
| **decayBase** | **0.0077** | 0.60 | **0.10** |
| **decayRange** | 0.0329 | 0.08 | — |
| **maxIntensity** | 0.80 | 0.80 | 0.80 |
| **squelchBase** | 0.0388 | 0.10 | 0.10 |
| **squelchSlope** | 0.0 | 0.10 | — |
| **ghostCap** | 0.00 | 0.00 | — |
| **gateMargin** | 0.0213 | 0.01 | — |

### Back L (envHighMid) — Mid Synths / Tumbao

| Parámetro | Techno | Latino 7.1 | Latino 4.1 (override) |
|---|---|---|---|
| **gateOn** | 0.15 | 0.20 | **0.18** |
| **boost** | 1.5 | 3.0 | **2.2** |
| **crushExponent** | 1.0 | 2.0 | **1.5** |
| **decayBase** | 0.62 | **0.14** | **0.75** |
| **decayRange** | 0.25 | 0.03 | 0.03 |
| **maxIntensity** | 0.85 | 0.95 | 0.95 |
| **squelchBase** | 0.25 | 0.20 | 0.18 |
| **squelchSlope** | 0.10 | 0.10 | 0.08 |
| **ghostCap** | 0.00 | 0.00 | 0.04 |
| **attackSlopeMin** | — | 0.02 | 0.03 |

### Mover L (envTreble) — El Melodista / El Galán

| Parámetro | Techno | Latino 7.1 | Latino 4.1 (override) |
|---|---|---|---|
| **gateOn** | 0.25 | **0.02** | **0.02** |
| **boost** | 4.0 | **12.0** | **12.0** |
| **crushExponent** | 3.5 | **0.60** | **0.60** |
| **decayBase** | 0.78 | 0.72 | 0.72 |
| **decayRange** | 0.03 | 0.05 | — |
| **maxIntensity** | 1.0 | 0.85 | — |
| **squelchBase** | 0.30 | 0.12 | 0.12 |
| **squelchSlope** | 0.10 | 0.15 | — |
| **ghostCap** | 0.00 | 0.06 | 0.06 |
| **attackSlopeMin** | — | -0.05 | -0.05 |

### Mover R (envVocal) — El Coro / La Dama

| Parámetro | Techno | Latino 7.1 | Latino 4.1 (override) |
|---|---|---|---|
| **gateOn** | 0.25 | **0.02** | **0.02** |
| **boost** | 1.5 | **5.0** | **5.0** |
| **crushExponent** | 3.5 | **1.0** | **1.0** |
| **decayBase** | 0.70 | 0.72 | 0.72 |
| **decayRange** | 0.05 | 0.05 | — |
| **maxIntensity** | 0.80 | 0.85 | — |
| **squelchBase** | 0.30 | 0.08 | 0.08 |
| **squelchSlope** | 0.10 | 0.15 | — |
| **ghostCap** | 0.00 | 0.04 | 0.04 |
| **attackSlopeMin** | — | -0.05 | -0.05 |

### Floor, Ambient, Air — Sin envelope (EMA directa)

| Zona | Techno | Latino |
|---|---|---|
| **Floor** | `subBass×0.65 + lowMid×0.35` — instantáneo | Igual |
| **Ambient attack** | 30ms | 65ms |
| **Ambient release** | 120ms | 135ms |
| **Air** | EMA α=0.12/0.05, boost ×1.4 | Igual |

### Strobe

| Parámetro | Techno | Latino |
|---|---|---|
| **strobeThreshold** | 0.80 | 0.85 |
| **strobeDuration** | 30ms | 25ms |
| **strobeNoiseDiscount** | 0.80 | 0.85 |

---

## Diagnóstico: Por qué los Back PARs ignoran snares rápidos en Techno

El envelope `envSnare` en sí mismo NO es el problema (gateOn 0.35 con señal binaria 0/1 siempre pasa). **El problema está en el transient shaper que alimenta el envelope**:

1. **`tonalSquelch`** anula `rawSnare` y `rawHat` si `percussiveRatio < 0.88`. Un snare de Brejcha con cuerpo mid puede tener ratio < 0.88.

2. **`bassLeakage = lowMid × 1.5`** se resta de `rawSnare`. En techno con bajo continuo, `lowMid` es alto → `rawSnare ≈ 0` → `highMidDelta ≈ 0` → `rawSpike ≈ 0`.

3. **`snareSpectrum = mid × (treble×0.5 + harshness)`** — si el snare es agudo seco (poco mid), `snareSpectrum` es pequeño → `rawSpike × snareSpectrum × 10 < 0.19` → **no dispara**.

Los "pings" funcionan porque tienen `treble` extremo → `trebleDelta` alto → `rawSpike` alto → compensa el `snareSpectrum` bajo.

**Posible fix (no aplicado)**: Reducir el umbral `0.19` del transient shaper, o hacer `snareSpectrum` menos dependiente de `mid` (ej: `max(mid, treble×0.3) × (treble×0.5 + harshness)`), o reducir `bassLeakage` de `lowMid × 1.5` a `lowMid × 1.0` para techno.