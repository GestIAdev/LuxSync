# TECHNO INDUSTRIAL — Reporte de Calibración de Envelopes y Profile

**Perfil:** `techno-industrial` (`TECHNO_PROFILE`)
**Fuente:** `electron-app/src/hal/physics/profiles/techno.ts`
**Motor base:** `electron-app/src/hal/physics/LiquidEngineBase.ts`
**WAVE de referencia:** 2411 — The Architecture Forge
**Referencia artística:** Boris Brejcha, Charlotte de Witte, Amelie Lens
**Fecha del reporte:** 2026-07-30

---

## 0. Hallazgo crítico de arquitectura

`techno.ts` **NO define `overrides41`**. Esto significa que **los valores de envelopes y escalares son idénticos en 4.1 y 7.1**. La única diferencia entre modos es el **enrutamiento de zonas** que hace cada motor (`LiquidEngine41.routeZones()` vs `LiquidEngine71.routeZones()`), no la parametría del perfil.

> Implicación para calibrar: cualquier tweak de `gateOn`, `decayBase`, `boost`, etc. afecta **a ambos layouts simultáneamente**. Si se quiere calibrar 4.1 y 7.1 de forma independiente, hace falta introducir un bloque `overrides41` en `techno.ts` (como ya lo tienen `latino.ts` y `poprock.ts`).

---

## 1. Envelopes actuales (comunes a 4.1 y 7.1)

Cada bloque corresponde a un `LiquidEnvelopeConfig`. Los campos son: `gateOn`, `boost`, `crushExponent`, `decayBase`, `decayRange`, `maxIntensity`, `squelchBase`, `squelchSlope`, `ghostCap`, `gateMargin` (algunos con extras `adaptiveNoiseAlpha` / `sustainedSquelchMaxBoost`).

### 1.1 `envelopeSubBass` — Front L (SubBass Groove)
El Océano de Subgraves. WAVE 2437 Monte Carlo co-optimizado con `envelopeKick`.

| Campo | Valor | Notas |
|---|---|---|
| `gateOn` | **0.08** | (comentario histórico 0.12→0.0656) responde a subgraves débiles |
| `boost` | **2.7054** | 3.5→2.7 — menos agresivo, equilibra con fR a maxI=1.0 |
| `crushExponent` | 1.0 | lineal |
| `decayBase` | **0.2218** | |
| `decayRange` | **0.166** | |
| `maxIntensity` | **0.5291** | 0.70→0.5291 — fL cede protagonismo al kick (fR=1.0) |
| `squelchBase` | **0.0613** | 0.04→0.0613 — limpiar el piso |
| `squelchSlope` | **0.5788** | |
| `ghostCap` | **0.0357** | |
| `gateMargin` | **0.0288** | |

### 1.2 `envelopeKick` — Front R (Kick Sniper)
El Francotirador. WAVE 2437 Monte Carlo 15k iter, fitness=756, 100% kick, 0 FP.

| Campo | Valor | Notas |
|---|---|---|
| `gateOn` | **0.28** | (comentario 0.15→0.1098) |
| `boost` | **3.3013** | 3.0→3.3 — compensa gate bajo |
| `crushExponent` | 1.0 | lineal |
| `decayBase` | **0.0077** | 0.04→0.0077 — killer fix: decay ultrarrápido, muere entre kicks |
| `decayRange` | **0.0329** | 0.10→0.0329 — rango estrecho, uniforme |
| `maxIntensity` | **0.80** | WAVE 2439.2 Cap de Dimmer — headroom para el slap del Snare |
| `squelchBase` | **0.0388** | |
| `squelchSlope` | **0.0** | sin squelch dinámico, gate fijo basta |
| `ghostCap` | **0.00** | |
| `gateMargin` | **0.0213** | |

### 1.3 `envelopeVocal` — Mover R (Vocal & Synth Wash)
WAVE 2419 Monte Carlo Right Hemisphere + WAVE 3491 Bozal de Mover.

| Campo | Valor | Notas |
|---|---|---|
| `gateOn` | **0.25** | WAVE 3491: 0.01→0.25 mínimo obligatorio Bozal |
| `boost` | **1.5** | |
| `crushExponent` | **3.5** | Bozal — aplasta colchón graves/medios |
| `decayBase` | **0.70** | |
| `decayRange` | **0.05** | |
| `maxIntensity` | **0.80** | |
| `squelchBase` | **0.30** | WAVE 3491: 0.02→0.30 piso estricto |
| `squelchSlope` | 0.10 | |
| `ghostCap` | 0.00 | |
| `gateMargin` | 0.01 | |

### 1.4 `envelopeSnare` — Back R (Percussion Slap)
El Látigo. WAVE 2427 Transient Shaper. `rawRight = trebleDelta×4`.

| Campo | Valor | Notas |
|---|---|---|
| `gateOn` | **0.28** | BACK-PAR TUNE: 0.35→0.28 — re-disparar fácil entre redoble |
| `boost` | **2.5** | WAVE 8009.3: 1.0→2.5 — igualar ganancia efectiva del Latino |
| `crushExponent` | 1.0 | |
| `decayBase` | **0.30** | BACK-PAR TUNE: 0.20→0.30 — ~200-250ms, respirar entre roll |
| `decayRange` | **0.40** | WAVE 2451 INTOCABLE — morfología líquida Back Pars |
| `maxIntensity` | **1.0** | WAVE 2439.5: 0.80→1.0 — Látigo sin cap |
| `squelchBase` | **0.20** | WAVE 6066: 0.52→0.20 — limpieza pre-envelope matemática |
| `squelchSlope` | 0.10 | |
| `ghostCap` | 0.00 | |
| `gateMargin` | 0.01 | |

### 1.5 `envelopeHighMid` — Back L (Mid Synths)
WAVE 2417 Monte Carlo Resurrection. Atmósfera / teclados.

| Campo | Valor | Notas |
|---|---|---|
| `gateOn` | **0.15** | OPERACIÓN Luz Líquida — baja compuerta para colas de voces |
| `boost` | **1.5** | |
| `crushExponent` | 1.0 | lineal — suavizar pulso atmosférico |
| `decayBase` | **0.62** | OPERACIÓN Onda de sierra — caída curva entre acordes |
| `decayRange` | **0.25** | WAVE 3492: 0.35→0.25 morph menos determinante |
| `maxIntensity` | **0.85** | WAVE 2436.2: 1.0→0.85 headroom para latino |
| `squelchBase` | **0.25** | mantiene a raya barro de graves |
| `squelchSlope` | 0.10 | |
| `ghostCap` | **0.00** | WAVE 3492: 0.05→0.00 negro entre golpes |
| `gateMargin` | **0.005** | |
| `adaptiveNoiseAlpha` | **0.0** | WAVE 8009.3 anti-freeze — sin deriva adaptativa |
| `sustainedSquelchMaxBoost` | **0.0** | WAVE 8009.3 anti-freeze — sin escalada squelch |

### 1.6 `envelopeTreble` — Mover L (Tonal Melodies)
WAVE 2417 + WAVE 3491 Bozal de Mover (arpegios agudos pasan, colchón graves NO).

| Campo | Valor | Notas |
|---|---|---|
| `gateOn` | **0.25** | WAVE 3491: 0.02→0.25 mínimo obligatorio Bozal |
| `boost` | **4.0** | |
| `crushExponent` | **3.5** | Bozal — solo picos afilados de arpegio |
| `decayBase` | **0.78** | |
| `decayRange` | **0.03** | |
| `maxIntensity` | **1.0** | |
| `squelchBase` | **0.30** | WAVE 3491: 0.02→0.30 piso estricto |
| `squelchSlope` | 0.10 | |
| `ghostCap` | **0.00** | WAVE 3491: 0.04→0.00 negro absoluto entre arpegios |
| `gateMargin` | **0.005** | |

---

## 2. Configuración escalar del profile (común a 4.1 y 7.1)

### 2.1 Back R — Schwarzenegger (WAVE 2408M)

| Campo | Valor | Notas |
|---|---|---|
| `percMidSubtract` | **1.0** | WAVE 2424 Escudo Absoluto — relación 1:1 |
| `percGate` | **0.04** | BACK-PAR TUNE: 0.06→0.04 — dejar hits suaves del redoble |
| `percBoost` | **5.0** | WAVE 2419: 8.0→5.0 |
| `percExponent` | **0.5** | WAVE 2419: 1.2→0.5 (raíz cuadrada, suaviza transitorio) |

### 2.2 Mover R (Voces) — Bass Subtractor (WAVE 2408g)

| Campo | Valor |
|---|---|
| `bassSubtractBase` | **0.65** |
| `bassSubtractRange` | **0.45** |

> `subtractFactor = 0.65 − morphFactor × 0.45` → rango [0.20, 0.65] según morph.

### 2.3 Back L (Mid Synths) — Ghost Mids Reform (WAVE 3464)

| Campo | Valor | Notas |
|---|---|---|
| `backLLowMidWeight` | **0.0** | WAVE 2430 original no usaba lowMid |
| `backLMidWeight` | **0.85** | OPERACIÓN — cuerpo del sinte sin asfixia |
| `backLTrebleSub` | **-0.3** | WAVE 8009.3: 0.0→-0.3 inyecta 30% treble (hi-hats minimal) |
| `backLBassSub` | **0.0** | aislamiento estricto del bajo, sin fuga de bombo |

### 2.4 Mover L (Melodías) — Cross-filter + tonal gate (WAVE 2411→2430)

| Campo | Valor | Notas |
|---|---|---|
| `moverLHighMidWeight` | **1.0** | original = highMid×1.0 |
| `moverLTrebleWeight` | **0.0** | original no usaba treble directo aquí |
| `moverLMidWeight` | **0.4** | original = mid×0.4 |
| `moverLTonalThreshold` | **0.40** | flatness ≥ 0.40 → ruido, cortar |

### 2.5 Mover R (Voces) — resta de treble para sibilantes

| Campo | Valor |
|---|---|
| `moverRTrebleSub` | **0.3** |

### 2.6 Sidechain Guillotine

| Campo | Valor | Notas |
|---|---|---|
| `sidechainThreshold` | **0.1** | |
| `sidechainDepth` | **0.00** | WAVE 3457 sidechain exterminado globalmente |
| `snareSidechainDepth` | **0.15** | WAVE 2420: 0.80→0.15 libera Mover R |
| `frontKickSidechainThreshold` | **0.2** | legacy (no usado en strict-split) |
| `auraCapBase` | **0.25** | legacy |
| `auraCapExponent` | **2** | legacy |

### 2.7 Strobe (God Mode exacto)

| Campo | Valor |
|---|---|
| `strobeThreshold` | **0.80** |
| `strobeDuration` | **30** |
| `strobeNoiseDiscount` | **0.80** |

### 2.8 Modes (umbrales de modo)

| Campo | Valor |
|---|---|
| `harshnessAcidThreshold` | **0.60** |
| `flatnessNoiseThreshold` | **0.70** |
| `apocalypseHarshness` | **0.55** |
| `apocalypseFlatness` | **0.55** |

### 2.9 Kick Detection

| Campo | Valor | Notas |
|---|---|---|
| `morphFloor` | **0.30** | avgMid mínimo para arrancar morph (30%) |
| `morphCeiling` | **0.70** | avgMid máximo = morph pleno (70%) |
| `kickEdgeMinInterval` | **180** | WAVE 8005.2: 80→180 filtra subbass rodante |
| `kickVetoFrames` | **0** | WAVE 2419: 5→0 (veto asfixiaba Mover R) |

### 2.10 Ambient Guillotine (WAVE 4826.5)

| Campo | Valor | Notas |
|---|---|---|
| `ambientAttackMs` | **30** | dispara instantáneo con bombo |
| `ambientReleaseMs` | **120** | corte brutal entre kicks |

### 2.11 Estrategia de enrutamiento

| Campo | Valor |
|---|---|
| `layout41Strategy` | **`'strict-split'`** |

---

## 3. Modo 7.1 — Asymmetric Split (7 zonas independientes)

Motor: `LiquidEngine71.routeZones()` — **sin compactación `max()`**. Cada zona recibe su envelope directo. Front/Back se dividen en stereo L/R.

| Zona física | Envelope / señal | Rol semántico |
|---|---|---|
| **Front L** | `envSubBass.process()` | El Océano — sub continuo |
| **Front R** | `envKick.process()` | El Francotirador — bombo puro |
| **Back L** | `envHighMid.process(midSynthInput)` × `1.45` (gain techno) | El Coro — mid synths |
| **Back R** | `envSnare.process(hybridSnare)` | El Látigo — transient shaper |
| **Mover L** | `envTreble.process(moverLInput)` | El Melodista — cross-filter tonal (highMid×1.0 + mid×0.4) |
| **Mover R** | `envVocal.process(moverRInput)` | El Alma — cleanMid vocal (mid − bass×subtract) − treble×0.3 |
| **Strobe** | binario | God Mode |
| **Floor / Ambient / Air** | passthrough 9-zone | capa atmosférica |

Notas 7.1 específicas (de `LiquidEngineBase.applyBands`):
- `dmzFactor = 0.55` (techno, bombo seco) para `cleanMidL` de Back L
- `backLeftGain = 1.45` (techno) aplicado post-`envHighMid`
- `vocalPenalty = 0` (bypass para techno — sintes activarían falsamente el mute)
- Sidechain kick inline: `moverL *= (1 − 0.00)`, `moverR *= (1 − 0.00)` → **inactivo** (sidechainDepth=0)
- `snareSidechainDepth = 0.15` se aplica dentro del transient shaper (no en routeZones)

---

## 4. Modo 4.1 — Strict-Split (compactación a 4 zonas + strobe)

Motor: `LiquidEngine41.routeZones()` con `isStrict = true` (por `layout41Strategy: 'strict-split'`).

| Zona física | Señal efectiva | Notas |
|---|---|---|
| **Front PAR** (L+R espejo) | `envKick` (frontRight) | **Metrónomo puro** — solo el bombo |
| **Back PAR** (L+R espejo) | `max(envHighMid, envSnare)` | `max(backLeft, backRight)` — siempre ambos canales (el strict-split solo afecta front) |
| **Mover L** | `envTreble.process(moverLInput)` | Lienzo L — melodías tonales |
| **Mover R** | `envVocal.process(moverRInput)` | Lienzo R — voces/synth wash |
| **Strobe** | binario | God Mode |
| **Floor / Ambient / Air** | passthrough 9-zone | capa atmosférica |

### 4.1 Smoothing exclusivo del Front PAR
`LiquidEngine41` aplica un **release envelope** al frontPar para evitar mini-strobo entre frames de kick:

```ts
_frontParSmooth = Math.max(frontParTarget, _frontParSmooth * 0.88)
// FRONTPAR_RELEASE = 0.88 — attack instantáneo, release ~0.88/frame
```

> Esto **no existe en 7.1**. En 7.1 Front R (`envKick`) tiene `decayBase=0.0077` ultrarrápido y muere entre kicks; en 4.1 el smoothing 0.88 **tiende un puente** entre frames de kick para hardware DMX (dimmers/LEDs no digieren 1-frame flash + 19-frame darkness).

### Diferencias estructurales 4.1 vs 7.1 (resumen)

| Aspecto | 7.1 | 4.1 strict-split |
|---|---|---|
| Front L | `envSubBass` (Océano) | **perdido** — Front PAR = solo kick |
| Front R | `envKick` | Front PAR (con smoothing 0.88) |
| Back L | `envHighMid` (Coro) | `max(highMid, snare)` — Back PAR |
| Back R | `envSnare` (Látigo) | `max(highMid, snare)` — Back PAR |
| Mover L | `envTreble` (Melodista) | `envTreble` (idéntico) |
| Mover R | `envVocal` (Alma) | `envVocal` (idéntico) |
| SubBass (Océano) | visible en Front L | **sacrificado** en 4.1 strict-split |
| Smoothing front | no | sí (0.88 release) |

**Trade-off clave 4.1:** el Océano de Subgraves (Front L) se pierde para dar protagonismo absoluto al Metrónomo (kick). El Back PAR fusiona Látigo + Coro vía `max()`, perdiendo la separación snare vs synths.

---

## 5. Puntos calientes para calibrar

1. **`envelopeKick.decayBase = 0.0077`** — extremadamente rápido. En 7.1 produce silencio entre kicks (contraste máximo); en 4.1 el smoothing 0.88 lo compensa. Si el kick en 4.1 se ve "pasty", bajar `FRONTPAR_RELEASE` o subir `decayBase`.
2. **`envelopeSubBass.maxIntensity = 0.5291`** — cede protagonismo al kick. En 4.1 strict-split este envelope **no se ruta** (Front PAR = kick only), así que este valor solo impacta en 7.1.
3. **`envelopeSnare.maxIntensity = 1.0`** + `decayRange = 0.40` — Látigo sin cap. En 4.1 compite con `envHighMid` vía `max()`; revisar si el Coro domina y tapa el Látigo en compactación.
4. **`backLMidWeight = 0.85`** + `backLeftGain = 1.45` (hardcodeado en Base para techno) — Back L recibe doble empuje. En 4.1 esto infla el Back PAR.
5. **`sidechainDepth = 0.00`** global — sin ducking de movers ante kick. Si los movers en 4.1 compiten con el Front PAR, aquí hay palanca.
6. **Sin `overrides41`** — cualquier cambio afecta ambos layouts. Recomendación: introducir bloque `overrides41` antes de calibrar 4.1 y 7.1 por separado.

---

*Reporte generado desde `techno.ts` (WAVE 2411) + `LiquidEngineBase.ts` + `LiquidEngine41.ts` + `LiquidEngine71.ts`.*
