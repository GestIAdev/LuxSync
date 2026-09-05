# Liquid Zones Audit — Zonas Globales del LiquidEngineBase

> **Misión:** Mapeo completo de la arquitectura actual de las Zonas Globales
> (Ambient, Floor, Air, Strobe) que operan de forma **independiente al modo de
> posición** (4.1 / 7.1). Estas zonas se calculan en `applyBands()` y se empaquetan
> en `ProcessedFrame` **antes** de `routeZones()`, por lo que su señal de salida
> es idéntica sea cual sea el layout físico.
>
> Fuentes analizadas:
> - `electron-app/src/hal/physics/LiquidEngineBase.ts` (motor base, 2295 líneas)
> - `electron-app/src/hal/physics/LiquidEnvelope.ts` (clase universal de envelopes)
> - `electron-app/src/hal/physics/profiles/{techno,latino,poprock,chilllounge}.ts`
> - `electron-app/src/hal/physics/profiles/ILiquidProfile.ts` (contrato)
>
> **Fecha:** 2026-09-05 · **WAVE base:** 7749.52+ (Floor & Air onset-gated)

---

## 0. Resumen ejecutivo — Las 9 Zonas Canónicas

### Zonas Globales (independientes del layout 4.1/7.1)

| Zona     | Tipo de motor                         | Input principal              | ¿LiquidEnvelope? | ¿Depende del layout? |
|----------|---------------------------------------|------------------------------|------------------|----------------------|
| Ambient  | EMA asimétrica + doble curva exponencial | `subBass + mid×w`         | **No** (EMA propia) | No                |
| Floor    | LiquidEnvelope onset-gated             | `max(0, bassDelta) × 2.0`    | **Sí** (`envFloor`) | No                |
| Air      | LiquidEnvelope onset-gated             | `treble×0.6 + highMid×0.4`   | **Sí** (`envAir`)   | No                |
| Strobe   | Gate binario + hold temporal           | `treble`, `ultraAir`         | **No** (binario)    | No                |

### Zonas Posicionales (enrutadas por `routeZones()` según layout)

| Zona     | Envelope         | Input principal                                   | ¿Depende del layout? |
|----------|------------------|---------------------------------------------------|----------------------|
| Front L  | `envSubBass`     | `bands.subBass` (continuo)                        | Sí (compactación 4.1) |
| Front R  | `envKick`        | `isKick ? pureBassEnergy : 0` (binario gateado)   | Sí (compactación 4.1) |
| Back L   | `envHighMid`     | cross-filter lowMid/mid/treble + HH adapter       | Sí (compactación 4.1) |
| Back R   | `envSnare`       | `hybridSnare` (cascade 5-path o MACD momentum)    | Sí (compactación 4.1) |
| Mover L  | `envTreble`      | cross-filter highMid/treble/mid × gate tonal      | No (passthrough)     |
| Mover R  | `envVocal`       | `cleanMid - treble×sub` (bass-subtractor)         | No (passthrough)     |

> **Zona huérfana confirmada: STROBE.** Por diseño no puede tener física del
> LiquidEngine: es una compuerta binaria (0/1) con hold temporal de
> `strobeDuration` ms. No hay envelope, no hay decay exponencial, no hay crush.
> Se documenta en la §4 como zona canónica sin física líquida.

Las 6 zonas posicionales se calculan en `applyBands()` con su envelope
asignado, y luego `routeZones()` (implementado por `LiquidEngine41`/`LiquidEngine71`)
decide cómo se mapean a canales físicos según el layout. En 4.1, Front L/R se
compactan a `frontPar = max(...)`, Back L/R a `backPar = max(...)`; los Movers
pasan directos. En 7.1 cada zona va a su canal propio.

---

## 1. AMBIENT — El Pulmón Gigante

### 1.1 Frecuencias Asignadas (Input)

La señal de entrada se mezcla **antes** de la EMA, en `applyBands()` (línea 646):

```
_ambMix = bands.subBass + bands.mid × ambientMidWeight
```

- `ambientMidWeight` por defecto = **0** → Ambient se alimenta **solo de subBass**
  (comportamiento WAVE 4812 M2: "El Océano").
- Perfiles con `ambientMidWeight > 0` inyectan medios (guitarras rock, teclados)
  para que el "rugido constante" viva en medios cuando los graves son impulsivos.

**Fuente FFT:** `bands.subBass` y `bands.mid` vienen directos del `GodEarFFT`.
No hay MACD, no hay delta, no hay transient shaper — es energía **continua**.

### 1.2 Envelope y Dinámicas (EMA asimétrica)

El Ambient **NO usa `LiquidEnvelope`**. Tiene su propia EMA asimétrica
(líneas 643–651) con constantes de tiempo configurables por perfil:

```
_ambAttackAlpha  = min(1.0, 1000 / (ambientAttackMs  × 44))   // default 800ms
_ambReleaseAlpha = min(1.0, 1000 / (ambientReleaseMs × 44))   // default 10000ms

if (_ambMix > _ambientEMA):
    _ambientEMA = _ambientEMA × (1 - _ambAttackAlpha)  + _ambMix × _ambAttackAlpha
else:
    _ambientEMA = _ambientEMA × (1 - _ambReleaseAlpha) + _ambMix × _ambReleaseAlpha
```

> 44 = frame rate aprox. del GodEar (≈44 Hz). `alpha = 1000/(ms×44)` convierte
> una constante de tiempo en milisegundos a coeficiente EMA por frame.

#### Tiempos por perfil

| Perfil     | `ambientAttackMs` | `ambientReleaseMs` | `ambientMidWeight` | Nota |
|------------|------------------:|-------------------:|-------------------:|------|
| **Techno** | 30 ms             | 120 ms             | 0 (default)        | "La Guillotina Techno" — ultra-reactivo, corte brutal entre kicks |
| **Latino** | 65 ms             | 135 ms             | 0 (default)        | Tumbao elástico, respira entre golpes del dembow |
| **PopRock**| 80 ms             | 300 ms             | 0.50               | Inyecta 50% de mid (guitarras) — el rugido rock vive en medios |
| **Chill**  | 400 ms            | 1200 ms            | 0 (default)        | Bioluminiscencia oceánica — **PERO** `isPureAmbient=true` → osciladores de tiempo, no audio |
| *Default*  | 800 ms            | 10000 ms           | 0                  | Si el perfil no declara nada |

> **Caso especial Chill:** `isPureAmbient: true` cortocircuita todo el flujo
> audio-reactivo (línea 617). Las intensidades las generan osciladores basados
> en `Date.now()` en `[0.35–0.75]`, no el FFT. El ambient "escucha" tiempo, no sonido.

### 1.3 Filtros de Comportamiento (post-EMA)

Tras la EMA, la señal pasa por una **doble curva exponencial + gain + fade**
(líneas 2023–2043). Esto es lo que da "filo" o "melaza" al dimmer final:

```
_ambientRaw    = clamp(_ambientEMA, 0, 1)
_ambientCrush  = _ambientRaw ^ ambientCrushExponent        // default 2.0 (cuadrática)
preGainAmbient = min(1.0, _ambientCrushed × ambientGain)   // default 1.35
ambientIntensity = preGainAmbient ^ ambientOutputExponent  // default 1.3

// Fade suave anti-guillotina para Tungsten:
if (ambientIntensity < 0.03):
    ambientIntensity × 0.85
    if (ambientIntensity < 0.001): ambientIntensity = 0
```

#### Parámetros de curva por perfil

| Perfil     | `ambientCrushExponent` | `ambientGain` | `ambientOutputExponent` | Efecto |
|------------|----------------------:|--------------:|------------------------:|--------|
| **Techno** | 2.0 (default)          | 1.35 (default)| 1.3 (default)           | Doble guillotina ^2.0 + ^1.3 — contraste máximo, negro entre kicks |
| **Latino** | 1.3                    | 2.5           | 1.1                     | Curva suave + gain alto → washer Tungsten visible incluso con bass recortado |
| **PopRock**| 2.0 (default)          | 2.0           | 1.3 (default)           | Compresión cuadrática + gain 2.0 → base 40-50% con guitarras, clímax 100% |
| **Chill**  | (n/a — oscilador)      | (n/a)         | (n/a)                   | Tiempo puro, sin curva de audio |
| *Default*  | 2.0                    | 1.35          | 1.3                     | Hardcodeado WAVE 4814/4826.3 |

**Gate lógico:** No hay `gateOn` como en LiquidEnvelope. El "gate" es la
combinación `^2.0` (apaga señales débiles) + el fade `< 0.03 × 0.85` + el
blackout `< 0.001 → 0`. **No hay `recoveryFactor`** aplicado al Ambient
(línea 2020: "NOT gated by recoveryFactor") — el pulmón respira incluso
durante el rebound de silencio.

**Ejemplo numérico (Latino):** `subBass=0.30` → EMA≈0.30 → `0.30^1.3=0.21`
→ `×2.5=0.53` → `min(1.0,0.53)=0.53` → `0.53^1.1=0.50` → **50% dimmer**.

---

## 2. FLOOR — Láser de Barrido de Suelo (onset-gated)

### 2.1 Frecuencias Asignadas (Input)

El Floor **ya no reacciona a amplitud sostenida** (WAVE 7749.52). Se alimenta
**exclusivamente del delta transitorio del grave** (líneas 2018–2019):

```
bassDelta    = pureBassEnergy - _prevBassEnergy     // línea 698
_floorInput  = max(0, bassDelta) × 2.0              // amplifica el delta pequeño
floorIntensity = envFloor.process(_floorInput, morphFactor, now, isBreakdown)
```

- `pureBassEnergy` = banda bass cruda del GodEarFFT (post-filtrado anti-bleed).
- Una línea de bajo **sostenida** tiene `bassDelta ≈ 0` tras el primer frame →
  `envFloor` decae a 0 → **no strobea**. Un kick o note-onset tiene un pico
  afilado de `bassDelta` → `envFloor` dispara → el láser de suelo pulsa.
- El `× 2.0` amplifica el delta (típicamente pequeño) para que entre en el rango
  útil del gate del envelope.

> **Ruta de señal:** `bass FFT → delta → ×2.0 → envFloor (LiquidEnvelope)`.
> No hay MACD ni cross-filter. Es puramente **transiente impact, no sustain**.

### 2.2 Envelope y Dinámicas

Floor usa `LiquidEnvelope` con config default hardcodeada en `LiquidEngineBase`
(líneas 229–242). **Ningún perfil declara `envelopeFloor`** → todos usan el
default:

```
DEFAULT_ENVELOPE_FLOOR:
  name:           'Floor'
  gateOn:         0.08     // bajo — los bassDelta transientes son pequeños pero afilados
  boost:          3.0      // amplifica la señal delta pequeña
  crushExponent:  2.0      // selectivo — suprime ruido sub-umbral
  decayBase:      0.12     // decay rápido (~65ms) — el suelo responde a hits, no sustain
  decayRange:     0.05     // influencia morph mínima
  maxIntensity:   1.0
  squelchBase:    0.30
  squelchSlope:   0.20
  ghostCap:       0.01     // ghost glow mínimo — suelo oscuro entre hits
  gateMargin:     0.02     // hysteresis tight — respuesta rápida
  attackSlopeMin: 0.0      // sin mín de velocidad — bassDelta ya codifica velocidad
```

**Tiempos efectivos** (a 44 Hz, `decay = decayBase + decayRange×morph`):
- morph=0 (industrial): decay = 0.12 → half-life ≈ 1 frame ≈ **23ms**
- morph=1 (melódico):   decay = 0.17 → half-life ≈ 2 frames ≈ **45ms**

> **No hay `riseRate` definido** → ataque instantáneo (legacy). El Floor
> responde en 1 frame al impacto del grave.

#### Variación por perfil de género

**No varía.** `envelopeFloor` es `undefined` en los 4 perfiles (techno, latino,
poprock, chill). Todos heredan `DEFAULT_ENVELOPE_FLOOR`. El único thing que
cambia entre géneros es el `morphFactor` (que modula `decayRange` y `crushExponent`
dentro del `process()` del envelope).

### 2.3 Filtros de Comportamiento (dentro de LiquidEnvelope.process)

El pipeline completo de `envFloor.process()` (LiquidEnvelope.ts) aplica estas
10 etapas a `_floorInput`:

1. **Velocity Gate:** `velocity = signal - lastSignal`; `isAttacking = velocity ≥ -0.005` (+ grace frame "Undertow").
2. **EMA asimétrica:** attack `×0.98 + signal×0.02` (sube lento), decay `×0.88 + signal×0.12` (baja rápido).
3. **Peak Memory + Tidal Gate:** `avgSignalPeak` con decay adaptativo (0.993 normal / 0.985 dry spell / 0.95 stale).
4. **Adaptive Floor:** degradación del gate tras 3s sin fire (`gateOn - 0.12×drySpellFloorDecay`).
5. **Dynamic Gate:** `dynamicGate = max(avgSignal, avgSignalPeak×0.55, adaptiveFloor) + gateMargin(0.02)`.
6. **Anti-sustain tracker:** (desactivado para Floor — sin `sustainedSquelchStartFrames`).
7. **Decay:** `intensity × (decayBase + decayRange×morph)` = `×(0.12 + 0.05×morph)`.
8. **Main Gate + Crush:** si `signal > dynamicGate && isAttacking && signal > 0.15`:
   `crushExp = crushExponent + 0.3×(1-morph)` = `2.0 + 0.3×(1-morph)`
   `kickPower = ((signal - dynamicGate) / requiredJump) ^ crushExp`
9. **Ignition Squelch:** `squelch = min(0.98, max(0.02, 0.30 - 0.20×morph))`
   si `kickPower > squelch` → `hit = min(1.0, kickPower × (1.2 + 0.8×morph) × 3.0)`
10. **Smooth Fade + Blackout Gate:** `fadeZone=0.08`, cuadrático; si `faded < 0.005 → 0` (DMX 0 limpio).

**Gate lógico final:** Sí — el `gateOn=0.08` + `dynamicGate` adaptativo + el
`crushExponent=2.0` (convexo) + el squelch `0.30-0.20×morph` forman una
compuerta AND implícita. Solo los `bassDelta` que superan **simultáneamente**
el gate dinámico, el umbral 0.15, y el squelch, producen salida. El `boost=3.0`
es el multiplicador de intensidad post-gate.

> **Para rediseñar el Floor:** los puntos de palanca son `decayBase` (filo vs
> sustain), `crushExponent` (selectividad), `gateOn` (sensibilidad a bassDelta
> débiles), y el `×2.0` del input (cuánto se amplifica el delta antes del gate).

---

## 3. AIR — Láser Aéreo / Tungsten Fans (onset-gated)

### 3.1 Frecuencias Asignadas (Input)

El Air se alimenta de una mezcla fija de agudos y high-mid (líneas 2051–2052):

```
_airInput     = bands.treble × 0.60 + bands.highMid × 0.40
airIntensity  = envAir.process(_airInput, morphFactor, now, isBreakdown)
```

- `bands.treble` y `bands.highMid` directos del GodEarFFT.
- **Espectralmente aislado por encima del cuerpo del snare (2–6kHz)** — el
  comentario (línea 2049) lo explicita: "Ideal for aerial laser stabs and
  sharp beams".
- El `×0.60 / ×0.40` es una mezcla **hardcodeada**, no configurable por perfil.

> **Ruta de señal:** `treble/highMid FFT → mezcla 60/40 → envAir (LiquidEnvelope)`.
> No hay delta ni MACD — es amplitud de agudos, pero el envelope la convierte en
> respuesta transiente vía el gate de velocidad + crush alto.

### 3.2 Envelope y Dinámicas

Air usa `LiquidEnvelope` con config default hardcodeada (líneas 243–256).
**Ningún perfil declara `envelopeAir`** → todos usan el default:

```
DEFAULT_ENVELOPE_AIR:
  name:           'Air'
  gateOn:         0.35     // ALTO — solo transientes afilados de treble pasan
  boost:          4.0      // amplifica la señal gateada
  crushExponent:  2.5      // MUY selectivo — los láseres aéreos necesitan stabs nítidos
  decayBase:      0.08     // decay muy rápido (~45ms) — los stabs son instantáneos
  decayRange:     0.03     // influencia morph mínima
  maxIntensity:   1.0
  squelchBase:    0.40     // squelch alto — anti-pad-ghost agresivo
  squelchSlope:   0.20
  ghostCap:       0.01     // ghost glow mínimo — aire oscuro entre stabs
  gateMargin:     0.05     // hysteresis moderada — anti-flicker
  attackSlopeMin: 0.0      // sin mín de velocidad
```

**Tiempos efectivos** (a 44 Hz):
- morph=0 (industrial): decay = 0.08 → half-life ≈ 1 frame ≈ **23ms**
- morph=1 (melódico):   decay = 0.11 → half-life ≈ 1.5 frames ≈ **34ms**

> **Ataque:** sin `riseRate` → instantáneo (1 frame). El Air responde al stab
> de treble en el mismo frame que ocurre. **Decay ~45-65ms** → el láser se
> apaga casi tan rápido como se encendió.

#### Variación por perfil de género

**No varía.** `envelopeAir` es `undefined` en los 4 perfiles. Todos heredan
`DEFAULT_ENVELOPE_AIR`. Solo el `morphFactor` del perfil modula `decayRange`
y `crushExponent` dentro de `process()`.

### 3.3 Filtros de Comportamiento (dentro de LiquidEnvelope.process)

Mismo pipeline de 10 etapas que el Floor (§2.3), pero con los valores del Air:

- **Gate:** `gateOn=0.35` (alto) → solo treble transientes fuertes pasan.
- **Dynamic Gate:** `avgEffective + 0.05` (gateMargin moderado, anti-flicker).
- **Crush:** `crushExp = 2.5 + 0.3×(1-morph)` → **muy convexo**, suprime stabs débiles.
- **Squelch:** `min(0.98, max(0.02, 0.40 - 0.20×morph))` → alto, mata pad-ghost.
- **Hit:** `min(1.0, kickPower × (1.2 + 0.8×morph) × 4.0)` → boost 4.0 amplifica.
- **Smooth Fade + Blackout:** mismo `fadeZone=0.08` cuadrático + blackout `<0.005→0`.

**Gate lógico final:** Sí — compuerta AND implícita de `gateOn=0.35` +
`crushExponent=2.5` + `squelch=0.40`. Solo stabs de treble que superan los tres
umbrales producen salida. `boost=4.0` es el multiplicador post-gate.

> **Para darle "filo" al Air (láseres/Tungsten Fans):** los palancas son
> `decayBase` (0.08 → más corto = más staccato), `crushExponent` (2.5 → más
> alto = más selectivo, solo stabs brutales), `gateOn` (0.35 → más alto = menos
> falsos), y `boost` (4.0 → más alto = picos más brillantes). La mezcla
> `treble×0.6 + highMid×0.4` es **hardcodeada** — si se quiere aislar más el
> treble puro, habría que hacerla configurable.

---

## 4. STROBE — Zona Huérfana (sin física del LiquidEngine)

> **Confirmado:** Strobe es canónica pero **no tiene física del LiquidEngine**.
> Por diseño es una compuerta **binaria (0/1)** con hold temporal. No hay
> `LiquidEnvelope`, no hay EMA, no hay decay exponencial, no hay crush.

### 4.1 Frecuencias Asignadas (Input)

`calculateStrobe(treble, ultraAir, noiseMode)` (líneas 2265–2293):

```
effectiveThreshold = noiseMode ? strobeThreshold × strobeNoiseDiscount : strobeThreshold
isPureTreblePeak   = treble > effectiveThreshold
isUltraAirCombo    = ultraAir > 0.70 && treble > 0.60

if (isPureTreblePeak || isUltraAirCombo) && !_strobeActive:
    _strobeActive = true
    strobeStartTime = now
```

- **Input 1:** `bands.treble` (agudos FFT) vs `strobeThreshold`.
- **Input 2:** `bands.ultraAir` (banda ultra-aérea) en combo con treble > 0.60.
- **Modificador:** `noiseMode` (flatness alta) baja el threshold × `strobeNoiseDiscount`.

### 4.2 Envelope y Dinámicas

**No hay envelope.** Hay un **hold temporal binario**:

```
if (_strobeActive && now - strobeStartTime > strobeDuration):
    _strobeActive = false
intensity = _strobeActive ? 1.0 : 0
```

#### Tiempos por perfil (`strobeDuration`)

| Perfil     | `strobeThreshold` | `strobeDuration` | `strobeNoiseDiscount` | Nota |
|------------|------------------:|-----------------:|----------------------:|------|
| **Techno** | 0.80              | 30 ms            | 0.80                  | Flash industrial, descuento en noise mode |
| **Latino** | 0.85              | 25 ms            | 0.85                  | Más alto (solo picos extremos), flash corto |
| **PopRock**| 0.88              | 20 ms            | 0.90                  | Conservador (concierto, no rave) |
| **Chill**  | 999.0 (imposible) | 10 ms            | 1.0                   | **Desactivado** — el océano no hace strobe |

### 4.3 Filtros de Comportamiento

**Efecto Güiro inyectado** (líneas 1986–1990) — un override de drop:

```
isDrop = bands.bass < 0.35 && bands.lowMid < 0.4
if (isDrop && trebleDelta > 0.25):
    strobeResult.active = true
    strobeResult.intensity = min(1.0, intensity + trebleDelta × 2.0)
```

- Detecta "drops" (graves ausentes + agudos presentes) y fuerza strobe con
  intensidad proporcional al `trebleDelta` (transiente de agudos).
- Esto es lo que genera el "FLASH dorado" en Tungsten durante drops realistas.

**No hay gate lógico tipo LiquidEnvelope.** Es un comparador simple con
histéresis temporal (no re-fire hasta que expira `strobeDuration`). La salida
es **siempre 0 o 1** (salvo el güiro que puede sumar `trebleDelta×2.0` capped a 1.0).

---

## 5. FRONT L — SubBass Continuo (El Océano)

### 5.1 Frecuencias Asignadas (Input)

```
frontLeft = envSubBass.process(bands.subBass, morphFactor, now, isBreakdown)
```

- **Input:** `bands.subBass` directo del GodEarFFT. **Sin cross-filter, sin delta,
  sin transient shaper.** Es la amplitud continua de la banda sub-grave.
- Es la zona más "cruda" del motor: lo que el FFT entrega en sub-grave va
  directo al envelope.

### 5.2 Envelope y Dinámicas (`envSubBass`)

Usa `LiquidEnvelope` con config `envelopeSubBass` del perfil. Pipeline de 10
etapas (§2.3). Config por perfil:

| Parámetro         | Techno | Latino | PopRock | Chill | Nota |
|-------------------|-------:|-------:|--------:|------:|------|
| `gateOn`          | 0.08   | 0.15   | 0.15    | 0.02  | Chill casi nulo — captura toda respiración |
| `boost`           | 2.71   | 2.5    | 2.8     | 1.5   | |
| `crushExponent`   | 1.0    | 1.0    | 2.2     | 1.8   | PopRock convexo (selectivo), techno lineal |
| `decayBase`       | 0.30   | 0.50   | 0.25    | 0.97  | Chill extremo (casi DC), techno staccato |
| `decayRange`      | 0.166  | 0.08   | 0.10    | 0.04  | |
| `maxIntensity`    | 0.53   | 0.80   | 0.82    | 0.85  | Techno cede al kick; chill suave |
| `squelchBase`     | 0.061  | 0.18   | 0.03    | 0.01  | |
| `squelchSlope`    | 0.579  | 0.50   | 0.45    | 0.10  | |
| `ghostCap`        | 0.00   | 0.00   | 0.04    | 0.20  | Chill: dimmer floor oceánico |
| `gateMargin`      | 0.029  | 0.01   | 0.01    | 0.005 | |

**Tiempos efectivos** (decay = decayBase + decayRange×morph, a 44Hz):
- Techno: 0.30–0.47 → half-life ~2-3 frames (~50-70ms)
- Latino: 0.50–0.58 → half-life ~1.4 frames (~70ms) — staccato dembow
- PopRock: 0.25–0.35 → half-life ~2 frames (~45ms) — golpe seco anti-melaza
- Chill: 0.97–1.01 → half-life ~24 frames (~550ms) — latido de ballena

> **Override 4.1 (Latino):** `decayBase 0.50, gateOn 0.22, boost 1.25,
> crushExponent 1.0, squelchBase 0.18, maxIntensity 0.80` — bloquea bajo melódico
> continuo, solo golpes reales de bombo pasan.

### 5.3 Filtros de Comportamiento

Pipeline estándar de LiquidEnvelope (§2.3). Sin filtros extra propios.
- **Gate lógico:** `gateOn` + dynamic gate adaptativo + `crushExponent`.
- **Sidechain 4.1 (strict-split):** `frontKickSidechainThreshold` + `auraCapBase`
  pueden guillotinar el subBass cuando el kick dispara (techno: `auraCapBase=0.25,
  auraCapExponent=2` → `auraCap = 0.25×morph^2`). Latino/PopRock: desactivado (0).

---

## 6. FRONT R — Kick Edge (El Francotirador)

### 6.1 Frecuencias Asignadas (Input)

```
kickSignal  = isKick ? pureBassEnergy : 0      // binario gateado por detección
frontRight  = envKick.process(kickSignal, morphFactor, now, isBreakdown)
```

- **Input:** `pureBassEnergy` (banda bass cruda) **solo si `isKick` es true**,
  sino 0. Es una señal **binaria gateada** por el detector de kicks.
- `isKick` se calcula vía `bassDelta = pureBassEnergy - _prevBassEnergy` +
  cooldown `KICK_COOLDOWN_MS = 150ms` + `kickEdgeMinInterval` (perfil).
- **Overlay Photon Strobe:** si `input.photon.strobe.active`, en la fase on-duty
  se fuerza `frontRight = max(frontRight, 1.0)` (flash a brillo total encima de
  la física normal, sin reemplazarla).

### 6.2 Envelope y Dinámicas (`envKick`)

| Parámetro         | Techno | Latino | PopRock | Chill | Nota |
|-------------------|-------:|-------:|--------:|------:|------|
| `gateOn`          | 0.28   | 0.18   | 0.12    | 0.05  | PopRock bajo (ghost notes), chill muy bajo |
| `boost`           | 3.30   | 2.5    | 2.8     | 1.8   | |
| `crushExponent`   | 1.0    | 1.0    | 0.7     | 1.5   | PopRock expansivo (kicks débiles saturan) |
| `decayBase`       | 0.06   | 0.60   | 0.04    | 0.90  | Techno/PopRock staccato; Latino/Chill fluido |
| `decayRange`      | 0.033  | 0.08   | 0.10    | 0.06  | |
| `maxIntensity`    | 0.80   | 0.80   | 0.82    | 0.75  | |
| `squelchBase`     | 0.039  | 0.10   | 0.03    | 0.02  | |
| `squelchSlope`    | 0.0    | 0.10   | 0.10    | 0.10  | Techno: sin squelch dinámico |
| `ghostCap`        | 0.00   | 0.00   | 0.00    | 0.20  | |
| `gateMargin`      | 0.021  | 0.01   | 0.01    | 0.005 | |

**Tiempos efectivos:**
- Techno: 0.06–0.09 → half-life ~1 frame (~23ms) — snap brutal
- Latino: 0.60–0.68 → half-life ~1.3 frames (~65ms) — bombo gordo con swing
- PopRock: 0.04–0.14 → half-life ~1 frame (~23ms) — blast beats anti-melaza
- Chill: 0.90–0.96 → half-life ~10 frames (~230ms) — corriente lenta

> **Override 4.1 (Latino):** `decayBase 0.10, crushExponent 1.0, squelchBase 0.10,
> maxIntensity 0.80` — kick staccato en compactación.
> **Override 4.1 (Techno):** `decayRange 0.02` — uniforme (smoothing neutralizado).

### 6.3 Filtros de Comportamiento

- Pipeline LiquidEnvelope estándar.
- **Photon Strobe overlay** (línea 758-762): modula el front derecho con un
  strobe externo a `rateHz` sin tocar el envelope — es un `max()` no destructivo.
- **Sidechain 4.1 (strict-split):** en techno, `frontPar = envKick solo`
  (Metrónomo). El subBass se mueve a los Movers (Lienzo).

---

## 7. BACK R — Snare / Látigo (El Látigo)

### 7.1 Frecuencias Asignadas (Input)

```
backRight = envSnare.process(hybridSnare, morphFactor, now, false)
```

- **Input:** `hybridSnare` — la señal más compleja del motor. Dos caminos según perfil:
  1. **EMA Momentum (MACD-style)** — si `snareMomentumThreshold` definido (techno):
     ```
     emaFast += αF × (SnareE − emaFast)     // αF=1.0 (zero lag)
     emaSlow += αS × (SnareE − emaSlow)     // αS=0.05 (τ~450ms)
     momentum = emaFast − emaSlow
     onset = (momentum > θ) ∧ (momentumPrev ≤ θ)   // θ=0.01 techno
     hybridSnare = onset ? driveValue : 0
     ```
     Drive = `Res × cFx × bFct` (residual NLMS anti-bleed × crack-flux × body-factor).
  2. **Legacy 5-path cascade** — latino/poprock/chill: raw_snare_delta + WNS +
     spectralFlux + snare_energy + bassE context, con vetos tonales multi-eje.
- **Centroid Shield** (líneas 1788-1795): si `isKick` y
  `centroid < 900×(1-morph)` y `harshness < 0.024` → `hybridSnare = 0`
  (bloquea el cuerpo del bombo que se cuela en la banda de snare).
- **Apocalypse Mode:** si `harshness > apocalypseHarshness && flatness > apocalypseFlatness`,
  `backRight = max(backRight, max(mid, treble))` — inyección de caos.

### 7.2 Envelope y Dinámicas (`envSnare`)

| Parámetro         | Techno | Latino | PopRock | Chill | Nota |
|-------------------|-------:|-------:|--------:|------:|------|
| `gateOn`          | 0.28   | 0.40   | 0.10    | 0.15  | PopRock bajo (ghost notes); Latino alto |
| `boost`           | 2.5    | 3.5    | 3.5     | 2.5   | |
| `crushExponent`   | 1.0    | 1.0    | 0.8     | 0.9   | PopRock/Chill expansivos |
| `decayBase`       | 0.32   | 0.72   | 0.35    | 0.80  | Techno snap (~90ms); Latino/Chill respiran |
| `decayRange`      | 0.40   | 0.10   | 0.12    | 0.10  | Techno: morph líquido preservado |
| `maxIntensity`    | 1.0    | 0.85   | 0.85    | 0.85  | Techno: el Látigo sin cap |
| `squelchBase`     | 0.20   | 0.03   | 0.10    | 0.02  | |
| `squelchSlope`    | 0.10   | 0.15   | 0.12    | 0.10  | |
| `ghostCap`        | 0.00   | 0.00   | 0.00    | 0.20  | Chill: luz ambiental continua |
| `gateMargin`      | 0.01   | 0.01   | 0.01    | 0.01  | |

**Tiempos efectivos:**
- Techno: 0.32–0.72 → half-life ~1.5-2.5 frames (~35-55ms) — snap industrial
- Latino: 0.72–0.82 → half-life ~2.5 frames (~55ms) — TAcka respira
- PopRock: 0.35–0.47 → half-life ~1.5 frames (~35ms) — snap orgánico
- Chill: 0.80–0.90 → half-life ~6 frames (~140ms) — destello persistente

> **Override 4.1 (Latino):** `gateOn 0.55, squelchBase 0.45, decayBase 0.60,
> boost 2.5` — endurecimiento extremo, solo golpes brutos pasan.
> **Override 4.1 (Techno):** `gateOn 0.22` — más sensible en compactación.

### 7.3 Filtros de Comportamiento

- Pipeline LiquidEnvelope estándar.
- **Tonality Veto** (multi-eje AND-gate, profile-configurable): flatness + WNS +
  spectralFlux — veto multiplicativo sobre `hybridSnare` antes del envelope.
- **Sustain Choke:** `snareChokeFrames` + `snareChokeRate` — mata bleed de
  vocales en el envSnare tras N frames sin onset nuevo.
- **Snare Impulse Decay:** `snareImpulseDecay` — decay exponencial del impulso
  binario pre-envelope (techno 0.65, latino 0.25).

---

## 8. BACK L — Mid Synths / Guitarras (El Coro / Las Algas)

### 8.1 Frecuencias Asignadas (Input)

La zona con el cross-filter más elaborado (líneas 1920-1962):

```
// DMZ acústica — sustracción espectral del bombo en medios
dmzFactor      = isTechno ? 0.55 : 0.30
cleanMidL      = max(0, bands.mid - bands.bass × dmzFactor)

// Vocal gate (bypass techno)
vocalPenalty   = isTechno ? 0 : min(0.75, vocalSustainEMA × max(0, 1 - midDelta/vocalSustainEMA))

// Cross-filter principal
midSynthInput  = max(0,
    bands.lowMid × backLLowMidWeight
  + cleanMidL   × backLMidWeight × (1.0 - vocalPenalty × 0.80)
  - bands.treble × backLTrebleSub
  - bands.bass  × backLBassSub
)

// HH Energy Adapter — max-blend de hi-hat transients
hhBlendInput   = max(midSynthInput, hhImpulse × hhBlendGain)

// Gain post-envelope
backLeft       = min(1.0, envHighMid.process(hhBlendInput, ...) × backLeftGain)
```

- **Fuentes FFT:** `lowMid`, `mid` (limpio via DMZ), `treble` (resta), `bass` (resta).
- **Vocal Gate:** atenúa el `mid` cuando hay vocal sostenida (`vocalSustainEMA`
  alta + `midDelta` bajo). **Bypass completo en techno** (los sintes activarían
  el mute falsamente).
- **HH Energy Adapter:** convierte `hh_energy` (EMA del RhythmicPercussionTracker)
  en impulso binario con decay 0.03/frame (~70ms) y lo max-blendea con el
  midSynthInput. Aísla hi-hats sin matar el pad textural.
- **Gain post-envelope:** `backLeftGain = 1.45` (techno) / `1.75` (otros).

#### Cross-filter weights por perfil

| Parámetro            | Techno | Latino | PopRock | Chill | Nota |
|----------------------|-------:|-------:|--------:|------:|------|
| `backLLowMidWeight`  | 0.0    | 0.45   | 0.50    | 0.80  | Techno no usa lowMid |
| `backLMidWeight`     | 0.85   | 0.15   | 0.70    | 0.90  | PopRock/Chill: mid pesado (guitarras/pads) |
| `backLTrebleSub`     | -0.3   | 0.28   | 0.20    | 0.10  | Techno: **inyecta** treble (hi-hats minimal) |
| `backLBassSub`       | 0.0    | 0.0    | 0.15    | 0.05  | |
| `hhBlendGain`        | 0.8    | 0.5    | (0.6)   | 0.0   | Techno: hats driving; Chill: sin hats |

> **Override 4.1 (Latino):** `backLMidWeight 0.50, backLLowMidWeight 0.45,
> backLTrebleSub -0.8` — trasvase de medios + inyección agresiva de agudos.

### 8.2 Envelope y Dinámicas (`envHighMid`)

| Parámetro         | Techno | Latino | PopRock | Chill | Nota |
|-------------------|-------:|-------:|--------:|------:|------|
| `gateOn`          | 0.15   | 0.20   | 0.03    | 0.02  | PopRock/Chill casi nulo (pads) |
| `boost`           | 1.5    | 3.0    | 4.0     | 2.5   | |
| `crushExponent`   | 1.0    | 2.0    | 1.0     | 1.0   | Latino convexo (selectivo) |
| `decayBase`       | 0.50   | 0.14   | 0.35    | 0.95  | Latino: guillotina snap; Chill: tejido eterno |
| `decayRange`      | 0.25   | 0.03   | 0.05    | 0.04  | |
| `maxIntensity`    | 0.85   | 0.95   | 0.90    | 0.88  | |
| `squelchBase`     | 0.25   | 0.20   | 0.02    | 0.01  | |
| `squelchSlope`    | 0.10   | 0.10   | 0.10    | 0.08  | |
| `ghostCap`        | 0.00   | 0.00   | 0.05    | 0.21  | Chill: algas siempre presentes |
| `gateMargin`      | 0.005  | 0.005  | 0.005   | 0.003 | |

> **Override 4.1 (Techno):** `maxIntensity 0.60, decayBase 0.45` — capar el
> colchón para que el Látigo (snare) gane el `max()` en backPar.
> **Override 4.1 (PopRock):** `maxIntensity 0.65, decayBase 0.30, gateOn 0.10`.
> **Override 4.1 (Latino):** `gateOn 0.18, squelchBase 0.18, boost 2.2,
> decayBase 0.75, crushExponent 1.5, maxIntensity 0.95` + lobotomía del filtro
> de ruido (`adaptiveNoiseAlpha 0.0, sustainedSquelchMaxBoost 0.0`).

### 8.3 Filtros de Comportamiento

- Pipeline LiquidEnvelope estándar.
- **Vocal Gate** (pre-envelope): `vocalPenalty` atenúa el mid si hay vocal
  sostenida. Solo activo fuera de techno.
- **DMZ Acústica** (pre-envelope): sustracción de bass del mid para limpiar
  resonancia del bombo. `dmzFactor` adaptativo por perfil.
- **HH Adapter** (pre-envelope): max-blend de impulsos de hi-hat.
- **Gain post-envelope** (`backLeftGain`): empuja el pico hacia 1.0.

---

## 9. MOVER L — Melodías Tonales (El Galán / La Voz del Mar)

### 9.1 Frecuencias Asignadas (Input)

```
moverLRaw   = max(0,
    bands.highMid × moverLHighMidWeight
  + bands.treble  × moverLTrebleWeight
  + bands.mid     × moverLMidWeight
)
isTonal       = flatness < moverLTonalThreshold ? 1.0 : 0.0   // gate tonal
moverLInput   = moverLRaw × isTonal
moverLeft     = envTreble.process(moverLInput, morphFactor, now, isBreakdown)
```

- **Fuentes FFT:** `highMid`, `treble`, `mid` con pesos configurables.
- **Gate Tonal:** si `flatness >= moverLTonalThreshold` → la señal es "ruido"
  (distorsión, hat burst) → se corta a 0. Si es tonal (flatness baja) → pasa.
- **Sidechain del kick inline:** si `isKick`, `moverLeft *= (1 - sidechainDepth)`.

#### Cross-filter weights por perfil

| Parámetro               | Techno | Latino | PopRock | Chill | Nota |
|-------------------------|-------:|-------:|--------:|------:|------|
| `moverLHighMidWeight`   | 1.0    | 2.50   | 0.30    | 0.30  | Latino: turboboost congas |
| `moverLTrebleWeight`    | 0.0    | 1.50   | 0.0     | 0.15  | Techno/PopRock: sin treble aquí |
| `moverLMidWeight`       | 0.4    | 1.50   | 0.90    | 0.90  | PopRock/Chill: mid puro (voz) |
| `moverLTonalThreshold`  | 0.40   | 0.45   | 0.55    | 0.30  | PopRock estricto (rechaza distorsión) |

> **Override 4.1 (Latino):** `moverLTonalThreshold 0.99` — desactivado (el mid
> es melodía, no ruido).

### 9.2 Envelope y Dinámicas (`envTreble`)

| Parámetro         | Techno | Latino | PopRock | Chill | Nota |
|-------------------|-------:|-------:|--------:|------:|------|
| `gateOn`          | 0.25   | 0.08   | 0.08    | 0.08  | Techno: Bozal (mínimo obligatorio) |
| `boost`           | 4.0    | 9.0    | 3.0     | 3.0   | Latino: megáfono del Galán |
| `crushExponent`   | 1.8    | 0.90   | 1.0     | 0.8   | Techno: desbozalado parcial; Chill expansivo |
| `decayBase`       | 0.78   | 0.72   | 0.55    | 0.88  | Techno/Chill: sustain; PopRock: rasgueo |
| `decayRange`      | 0.03   | 0.05   | 0.06    | 0.14  | Chill: rango alto (abismo = destellos breves) |
| `maxIntensity`    | 1.0    | 0.85   | 0.88    | 0.90  | |
| `squelchBase`     | 0.15   | 0.12   | 0.03    | 0.03  | |
| `squelchSlope`    | 0.10   | 0.15   | 0.12    | 0.12  | |
| `ghostCap`        | 0.00   | 0.00   | 0.04    | 0.23  | Chill: deriva oceánica continua |
| `gateMargin`      | 0.005  | 0.01   | 0.008   | 0.008 | |
| `attackSlopeMin`  | —      | 0.02   | —       | —     | Latino: exige transitorio real |

> **Override 4.1 (Latino):** `gateOn 0.15, boost 5.5, decayBase 0.82,
> crushExponent 0.90, attackSlopeMin 0.05` — miel, sustain fluido, sin clipping.

### 9.3 Filtros de Comportamiento

- Pipeline LiquidEnvelope estándar.
- **Gate Tonal** (pre-envelope): `flatness < threshold` — separa voz/melodía
  (tonal, flatness baja) de distorsión/ruido (flatness alta).
- **Sidechain del kick:** `moverLeft *= (1 - sidechainDepth)` cuando `isKick`.
  Techno/Latino/PopRock: `sidechainDepth = 0.00` (exterminado WAVE 3457).
  Chill: `sidechainThreshold = 999.0` (imposible).

---

## 10. MOVER R — Voces / Lead (La Dama / Lead & Sizzle)

### 10.1 Frecuencias Asignadas (Input)

```
subtractFactor = bassSubtractBase - morphFactor × bassSubtractRange
cleanMid       = max(0, bands.mid - bands.bass × subtractFactor)
moverRInput    = max(0, cleanMid - bands.treble × moverRTrebleSub)
moverRight     = envVocal.process(moverRInput, morphFactor, now, isBreakdown)
```

- **Fuentes FFT:** `mid` (limpio via bass-subtractor) con resta de `treble`.
- **Bass Subtractor adaptativo:** `subtractFactor` decrece con morphFactor →
  en modo industrial (morph bajo) resta más bass; en melódico resta menos.
- **Inversión de treble:** si `moverRTrebleSub < 0` (PopRock: -0.40), **inyecta**
  treble en lugar de restarlo — los armónicos de guitarra lead y crashes
  alimentan el canal directamente.
- **Sidechain del kick inline:** `moverRight *= (1 - sidechainDepth)` si `isKick`.
- **Snare Sidechain:** `moverRight *= (1 - snareSidechainDepth)` (aplicado en
  ruta posterior según perfil).

#### Cross-filter weights por perfil

| Parámetro            | Techno | Latino | PopRock | Chill | Nota |
|----------------------|-------:|-------:|--------:|------:|------|
| `bassSubtractBase`   | 0.65   | 0.25   | 0.60    | 0.20  | Techno/PopRock: resta agresiva |
| `bassSubtractRange`  | 0.45   | 0.20   | 0.20    | 0.10  | |
| `moverRTrebleSub`    | 0.30   | 0.15   | -0.40   | 0.05  | PopRock: **inversión** (inyecta treble) |

### 10.2 Envelope y Dinámicas (`envVocal`)

| Parámetro         | Techno | Latino | PopRock | Chill | Nota |
|-------------------|-------:|-------:|--------:|------:|------|
| `gateOn`          | 0.25   | 0.08   | 0.10    | 0.03  | Techno: Bozal; Chill: pads suaves |
| `boost`           | 1.5    | 5.0    | 2.5     | 2.0   | Latino: La Dama brilla |
| `crushExponent`   | 1.8    | 1.0    | 1.2     | 1.2   | Techno: desbozalado parcial |
| `decayBase`       | 0.70   | 0.72   | 0.45    | 0.94  | Chill: sustain de pad de 4 compases |
| `decayRange`      | 0.05   | 0.05   | 0.08    | 0.05  | |
| `maxIntensity`    | 0.80   | 0.85   | 0.85    | 0.82  | |
| `squelchBase`     | 0.15   | 0.08   | 0.02    | 0.02  | |
| `squelchSlope`    | 0.10   | 0.15   | 0.12    | 0.08  | |
| `ghostCap`        | 0.00   | 0.00   | 0.00    | 0.22  | Chill: susurro residual |
| `gateMargin`      | 0.01   | 0.01   | 0.01    | 0.005 | |
| `attackSlopeMin`  | —      | 0.02   | —       | —     | Latino: exige transitorio real |

> **Override 4.1 (Latino):** `gateOn 0.12, boost 4.5, decayBase 0.85,
> crushExponent 1.0, attackSlopeMin 0.05` — más miel que el Galán.

### 10.3 Filtros de Comportamiento

- Pipeline LiquidEnvelope estándar.
- **Bass Subtractor adaptativo** (pre-envelope): limpia el mid del bombo.
- **Inversión de treble** (PopRock): `moverRTrebleSub = -0.40` → inyecta
  armónicos de guitarra lead y crashes.
- **Sidechain del kick** + **snare sidechain** (post-envelope, según perfil).
- **Anti-sustain** (Latino): `sustainedSquelchStartFrames: 9999` → nunca
  penaliza notas sostenidas (la voz latina debe respirar).

---

## 11. Tabla maestra — Configuración por perfil

### 11.1 Ambient

| Parámetro              | Techno | Latino | PopRock | Chill | Default |
|------------------------|-------:|-------:|--------:|------:|--------:|
| `ambientAttackMs`      | 30     | 65     | 80      | 400   | 800     |
| `ambientReleaseMs`     | 120    | 135    | 300     | 1200  | 10000   |
| `ambientMidWeight`     | 0      | 0      | 0.50    | 0     | 0       |
| `ambientCrushExponent` | 2.0    | 1.3    | 2.0     | n/a   | 2.0     |
| `ambientGain`          | 1.35   | 2.5    | 2.0     | n/a   | 1.35    |
| `ambientOutputExponent`| 1.3    | 1.1    | 1.3     | n/a   | 1.3     |
| `isPureAmbient`        | false  | false  | false   | **true** | false |

### 11.2 Floor (todos usan DEFAULT_ENVELOPE_FLOOR)

| Parámetro         | Valor | ¿Configurable por perfil? |
|-------------------|------:|:--------------------------|
| `gateOn`          | 0.08  | Sí (`envelopeFloor`) — nadie lo overridea |
| `boost`           | 3.0   | Sí — nadie lo overridea |
| `crushExponent`   | 2.0   | Sí — nadie lo overridea |
| `decayBase`       | 0.12  | Sí — nadie lo overridea |
| `decayRange`      | 0.05  | Sí — nadie lo overridea |
| `maxIntensity`    | 1.0   | Sí — nadie lo overridea |
| `squelchBase`     | 0.30  | Sí — nadie lo overridea |
| `ghostCap`        | 0.01  | Sí — nadie lo overridea |
| Input `×2.0`      | 2.0   | **No — hardcodeado** |

### 11.3 Air (todos usan DEFAULT_ENVELOPE_AIR)

| Parámetro         | Valor | ¿Configurable por perfil? |
|-------------------|------:|:--------------------------|
| `gateOn`          | 0.35  | Sí (`envelopeAir`) — nadie lo overridea |
| `boost`           | 4.0   | Sí — nadie lo overridea |
| `crushExponent`   | 2.5   | Sí — nadie lo overridea |
| `decayBase`       | 0.08  | Sí — nadie lo overridea |
| `decayRange`      | 0.03  | Sí — nadie lo overridea |
| `maxIntensity`    | 1.0   | Sí — nadie lo overridea |
| `squelchBase`     | 0.40  | Sí — nadie lo overridea |
| `ghostCap`        | 0.01  | Sí — nadie lo overridea |
| Mezcla treble/hM  | 0.6/0.4 | **No — hardcodeada** |

### 11.4 Strobe

| Parámetro              | Techno | Latino | PopRock | Chill |
|------------------------|-------:|-------:|--------:|------:|
| `strobeThreshold`      | 0.80   | 0.85   | 0.88    | 999.0 |
| `strobeDuration`       | 30 ms  | 25 ms  | 20 ms   | 10 ms |
| `strobeNoiseDiscount`  | 0.80   | 0.85   | 0.90    | 1.0   |

---

## 12. Notas para el rediseño (Floor & Air)

### Floor — darle más filo / comportamiento de barrido

1. **`decayBase` (0.12)** es el palanca principal. Bajarlo (0.08) = más staccato
   (láser punzante). Subirlo (0.20) = más "barrido" sostenido.
2. **`crushExponent` (2.0)** controla selectividad. Subir a 2.5-3.0 = solo
   bassDelta brutales disparan (kicks puros, no wobble de reggaetón).
3. **El `×2.0` del input es hardcodeado** — si se quiere más sensibilidad a
   onsets sutiles, subir a 3.0 amplifica el delta antes del gate.
4. **`gateOn` (0.08)** es bajo por diseño (bassDelta es pequeño). Si se sube,
   se pierden golpes suaves; si se baja, hi-hats con bleed de bass disparan.
5. **No hay `riseRate`** → ataque instantáneo. Si se quiere un "ramp" de
   barrido (láser que sube en vez de flash), añadir `riseRate: 0.15` daría
   una rampa de 15%/frame.

### Air — darle filo para láseres y Tungsten Fans

1. **`decayBase` (0.08)** ya es muy rápido (~45ms). Para Tungsten Fans (que
   tienen inercia térmica) puede ser **demasiado rápido** — el fan no alcanza
   a moverse. Subir a 0.15-0.20 daría un "stab" más visible físicamente.
2. **`crushExponent` (2.5)** es muy selectivo. Si se quiere que stabs medios
   también disparen, bajar a 1.8-2.0.
3. **`gateOn` (0.35)** es alto. Para láseres que deben reaccionar a cualquier
   treble transiente, bajar a 0.25. Para Tungsten Fans que solo deben moverse
   en picos brutales, mantener o subir a 0.45.
4. **La mezcla `treble×0.6 + highMid×0.4` es hardcodeada** — para aislar láseres
   al treble puro (sin contaminación de highMid del snare), hacerla configurable
   y usar `treble×1.0 + highMid×0.0`.
5. **`boost` (4.0)** amplifica post-gate. Para Tungsten Fans (necesitan más
   energía para verse), subir a 5.0-6.0. Para láseres (responden a poca luz),
   mantener 4.0.
6. **Considerar `riseRate`** para los fans: un `riseRate: 0.20` suavizaría el
   ataque anti-tembleque (WAVE 3493, originalmente para movers latinos).

### Strobe — huérfana por diseño

No se recomienda añadir física del LiquidEngine al strobe. Su naturaleza binaria
es correcta para un flash. Si se quiere un "strobe con decay", eso sería una
zona nueva (ej. "StrobeFade") o reusar `envAir` con config extrema, no modificar
el strobe canónico.

---

## 13. Referencias de código

- `LiquidEngineBase.ts:229-256` — `DEFAULT_ENVELOPE_FLOOR` / `DEFAULT_ENVELOPE_AIR`
- `LiquidEngineBase.ts:643-651` — EMA del Ambient
- `LiquidEngineBase.ts:2018-2052` — Cálculo final de Floor / Ambient / Air
- `LiquidEngineBase.ts:2265-2293` — `calculateStrobe()` (zona huérfana)
- `LiquidEngineBase.ts:1986-1990` — Efecto Güiro inyectado en strobe
- `LiquidEnvelope.ts:183-401` — `process()` pipeline de 10 etapas
- `ILiquidProfile.ts:354-393` — Contrato de parámetros Ambient
- `ILiquidProfile.ts:51-57` — `envelopeFloor` / `envelopeAir` (opcionales)
- `techno.ts:312-315` — Ambient viscosity techno
- `latino.ts:293-315` — Ambient viscosity + boost latino
- `poprock.ts:316-319` — Ambient mid injection rock
- `chilllounge.ts:239,293-294` — `isPureAmbient: true`, ambient oceánico

### Zonas Posicionales

- `LiquidEngineBase.ts:747` — Front L: `envSubBass.process(bands.subBass, ...)`
- `LiquidEngineBase.ts:752-753` — Front R: `kickSignal = isKick ? pureBassEnergy : 0` → `envKick`
- `LiquidEngineBase.ts:758-762` — Photon Strobe overlay sobre Front R
- `LiquidEngineBase.ts:794-1802` — Back R: cascade detección `hybridSnare` → `envSnare`
- `LiquidEngineBase.ts:1788-1795` — Centroid Shield (bloqueo de cuerpo de bombo)
- `LiquidEngineBase.ts:1892-1899` — Mover L: cross-filter tonal → `envTreble`
- `LiquidEngineBase.ts:1905-1908` — Mover R: bass-subtractor → `envVocal`
- `LiquidEngineBase.ts:1911-1913` — Sidechain del kick inline sobre movers
- `LiquidEngineBase.ts:1916-1930` — Back L: DMZ + vocal gate + cross-filter
- `LiquidEngineBase.ts:1939-1960` — HH Energy Adapter (max-blend hi-hats)
- `LiquidEngineBase.ts:1961-1962` — Back L: gain post-envelope (`backLeftGain`)
- `LiquidEngineBase.ts:1971-1976` — Apocalypse Mode (inyección de caos)
- `LiquidEngineBase.ts:698` — `bassDelta = pureBassEnergy - _prevBassEnergy`
- `LiquidEngineBase.ts:654-658` — Vocal Sustain EMA (para vocal gate de Back L)
- `ILiquidProfile.ts:33-43` — Contrato de los 6 envelopes posicionales
- `ILiquidProfile.ts:66-128` — Cross-filter weights (Back L, Mover L, Mover R)
- `ILiquidProfile.ts:133-138` — Sidechain Guillotine
- `techno.ts:33-153` — Envelopes posicionales techno
- `latino.ts:45-172` — Envelopes posicionales latino
- `poprock.ts:59-179` — Envelopes posicionales poprock
- `chilllounge.ts:65-179` — Envelopes posicionales chill

---

*Fin del reporte. Listo para rediseño con el Arquitecto.*
