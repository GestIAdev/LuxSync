# WAVE 4826 — PSYCHOACOUSTIC CALIBRATION AUDIT
## LiquidEngineBase, LiquidEngine71, LiquidEngine41 — Auditoría Técnica

**Fecha:** 2026-05-15  
**Auditor:** Cascade (Kimi)  
**Objetivo:** Mapear matemáticamente el sangrado vocal en Back L/R, las curvas de decay atmosférico (Air, Ambient, Floor), y el embudado de layouts 7.1→4.1.

---

## 1. EL SANGRADO VOCAL (Back Left & Back Right)

### 1.1 ¿De qué bandas se alimentan Back L y Back R?

| Zona | Señal de entrada | Banda(s) primaria(s) | Proceso |
|------|------------------|----------------------|---------|
| **Back Left** (`backLeft`) | `midSynthInput` | `lowMid` + `mid` (con penalización vocal) | `envHighMid.process()` |
| **Back Right** (`backRight`) | `hybridSnare` | `trebleDelta` + `highMidDelta` + `midDelta` (gated) | Transient Shaper → `envSnare.process()` |

**Fórmula exacta — Back L (`midSynthInput`):**

```typescript
const midSynthInput = Math.max(0,
  bands.lowMid * p.backLLowMidWeight
  + bands.mid * p.backLMidWeight * (1.0 - vocalPenalty * 0.80)
  - bands.treble * p.backLTrebleSub
  - bands.bass * p.backLBassSub
)
let backLeft = this.envHighMid.process(midSynthInput, morphFactor, now, isBreakdown)
```

**Fórmula exacta — Back R (`hybridSnare`):**

```typescript
const trebleDelta  = Math.max(0, bands.treble  - this.lastTreble)
const highMidDelta = Math.max(0, bands.highMid - this.lastHighMid)
const midDelta     = Math.max(0, bands.mid     - this.lastMid)

const vocalPenalty = Math.min(0.75,
  this._vocalSustainEMA * Math.max(0,
    1.0 - midDelta / Math.max(0.001, this._vocalSustainEMA)
  )
)
const midDeltaGated = midDelta * (1.0 - vocalPenalty)
const midCentWeight = Math.min(1.0, (input.spectralCentroid ?? 0) / 1500)

const impactDelta = trebleDelta
  + (highMidDelta * 1.5)
  + (midDeltaGated * (0.8 + 0.7 * midCentWeight))

const cleanDelta = Math.max(0, impactDelta - 0.020)  // MIN_DELTA = 0.020
const baseSnare = cleanDelta * 2.0
const clapBonus = baseSnare * harshness * 2.0
let hybridSnare = baseSnare + clapBonus

// Centroid Shield (solo durante kick)
if (isKick) {
  const centroidFloor = 900 * (1.0 - morphFactor)
  if (spectralCentroid < centroidFloor && harshness < 0.024) {
    hybridSnare = 0.0
  }
}

let backRight = this.envSnare.process(hybridSnare, morphFactor, now, false)
```

---

### 1.2 Vocal Sustain EMA — El Filtro Anti-Vocal (WAVE 4812 M3)

**Fórmula del EMA:**

```typescript
if (bands.mid > this._vocalSustainEMA) {
  this._vocalSustainEMA = this._vocalSustainEMA * 0.75 + bands.mid * 0.25   // Attack α = 0.25  (~4 frames @ 44Hz)
} else {
  this._vocalSustainEMA = this._vocalSustainEMA * 0.96 + bands.mid * 0.04  // Release α = 0.04 (~25 frames)
}
```

**Penalización vocal (`vocalPenalty`):**

```typescript
vocalPenalty = Math.min(0.75,
  _vocalSustainEMA * Math.max(0, 1.0 - midDelta / max(0.001, _vocalSustainEMA))
)
```

| Estado de la señal | `midDelta` vs `_vocalSustainEMA` | `vocalPenalty` |
|-------------------|-----------------------------------|----------------|
| Vocal sostenida (plana) | `midDelta` ≈ 0, `_vocalSustainEMA` alta | ≈ `_vocalSustainEMA` (hasta 0.75 max) |
| Snare real (transiente) | `midDelta` >> `_vocalSustainEMA` | ≈ 0 (no penaliza) |

**Efecto en Back L:** `bands.mid * backLMidWeight * (1.0 - vocalPenalty * 0.80)` → atenúa el mid en Back L hasta un **80%** cuando hay vocal sostenida.

**Efecto en Back R:** `midDeltaGated = midDelta * (1.0 - vocalPenalty)` → atenúa el midDelta en el Transient Shaper hasta un **100%**.

---

### 1.3 Transient Shaper — Parámetros por Perfil

| Parámetro | Techno | Latino | Delta |
|-----------|--------|--------|-------|
| `percMidSubtract` | 1.0 | 2.0 | **Latino purga 2× más mid del treble** |
| `percGate` | 0.06 | 0.045 | **Latino 25% más permisivo** |
| `percBoost` | 5.0 | 4.0 | Latino 20% menos boost |
| `percExponent` | 0.5 | 0.6 | Latino ligeramente más convexo |

**Interpretación:** En latino, `percGate=0.045` (vs 0.06 techno) significa que el Transient Shaper dispara con **transientes 25% más débiles**. Esto permite que hi-hats y claves del dembow pasen, pero también deja colar más micro-transientes vocales (consonantes T/K/S del autotune).

Además, en el override 4.1 del latino, `percGate` sube a 0.085 — pero solo cuando el layout es 4.1.

---

### 1.4 Bifurcación por Perfil — Back L & Back R

#### Back L (envHighMid)

| Parámetro | Techno | Latino | Impacto |
|-----------|--------|--------|---------|
| `gateOn` | 0.22 | 0.35 | **Latino +59% más estricto** |
| `boost` | 1.5 | 3.0 | Latino 2× más boost |
| `decayBase` | 0.28 | 0.14 | **Latino cae el doble de rápido** |
| `squelchBase` | 0.25 | 0.38 | **Latino piso 52% más alto** |
| `backLMidWeight` | 1.0 | 0.10 | **Techno: mid puro. Latino: mid casi ignorado** |
| `backLLowMidWeight` | 0.0 | 0.22 | Latino añade lowMid |
| `backLTrebleSub` | 0.0 | 0.28 | Latino resta treble |
| `backLBassSub` | 0.7 | 0.0 | **Techno resta bass. Latino no** |

**Diagnóstico del sangrado:**

En **Techno**, Back L = `mid × 1.0 - bass × 0.7`. El mid está completamente expuesto. Si hay vocales en mid (0.35-0.50), pasan directamente al envelope. El `gateOn=0.22` deja pasar mucho. El `vocalPenalty` del WAVE 4812 mitiga esto en un 80%, pero si `_vocalSustainEMA < 0.275`, el penalty no alcanza el máximo y parte de la voz pasa.

En **Latino**, Back L = `lowMid × 0.22 + mid × 0.10 × (1 - vocalPenalty × 0.80) - treble × 0.28`. El mid está **atenuado a 10%** (vs 100% techno). El `gateOn=0.35` es un muro alto. El `squelchBase=0.38` aplasta cualquier señal residual. **El sangrado vocal en Back L debería ser mínimo en latino.**

**Conclusión:** El sangrado vocal reportado en Back L/R durante reguetón **no debería venir de Back L** (latino tiene defensas agresivas). Probablemente viene de:
1. **Back R**: `percGate=0.045` en latino base deja pasar micro-transientes vocales. Consonantes T/K/S del autotune generan `trebleDelta` alto que el transient shaper interpreta como percusión.
2. **Mover L (outMoverL)**: En latino 7.1, `outMoverL = moverRight = envVocal`. Las voces van directo a Mover L físico. Si el operador percibe "vocales en Back", puede ser confusión espacial (Mover L en posición trasera en algunos rigs).
3. **Override 4.1**: Si el LD está en modo 4.1, `backPar = max(backLeft, backRight)`. El `backRight` (envSnare con decay 0.22 en override) puede tener cola de reverb vocal que se mezcla con backLeft.

---

## 2. COMPORTAMIENTO ATMOSFÉRICO (Air, Ambient, Floor)

### 2.1 Fórmulas de Cálculo Final

```typescript
// Floor — instantáneo, gated por AGC recovery
const floorIntensity = Math.min(1.0, Math.max(0.0,
  (bands.subBass * 0.65 + bands.lowMid * 0.35) * recoveryFactor
))

// Ambient — EMA de subBass, curva cuadrática, noise-gate
const _ambientRaw = Math.min(1.0, Math.max(0.0, this._ambientEMA))
const _ambientCrushed = Math.pow(_ambientRaw, 2.0)
const ambientIntensity = _ambientCrushed < 0.03 ? 0.0 : _ambientCrushed

// Air — EMA comprimida, gated por AGC recovery
const airIntensity = Math.min(1.0, Math.max(0.0, this._airEMA * recoveryFactor))
```

| Zona | Fórmula | Fuente de audio | Gating |
|------|---------|-----------------|--------|
| **Floor** | `(subBass × 0.65 + lowMid × 0.35) × recoveryFactor` | SubBass + LowMid | `recoveryFactor` (AGC rebound) |
| **Ambient** | `pow(clamp(_ambientEMA), 2.0)` con gate < 0.03 → 0 | **SubBass puro** (WAVE 4812 M2) | Noise gate a 0.03 (antes 0.15) |
| **Air** | `_airEMA × recoveryFactor` | `treble × 0.6 + highMid × 0.4` (comprimida) | `recoveryFactor` (AGC rebound) |

---

### 2.2 EMAs — Velocidades de Ataque y Caída

#### Ambient EMA

```typescript
const _ambAttackAlpha  = Math.min(1.0, 1000 / ((p.ambientAttackMs  ?? 800) * 44))
const _ambReleaseAlpha = Math.min(1.0, 1000 / ((p.ambientReleaseMs ?? 10000) * 44))
const _ambMix = bands.subBass

if (_ambMix > this._ambientEMA) {
  this._ambientEMA = this._ambientEMA * (1 - _ambAttackAlpha) + _ambMix * _ambAttackAlpha
} else {
  this._ambientEMA = this._ambientEMA * (1 - _ambReleaseAlpha) + _ambMix * _ambReleaseAlpha
}
```

| Perfil | `ambientAttackMs` | `ambientReleaseMs` | Attack α | Release α | Frames attack | Frames release |
|--------|-------------------|--------------------|----------|-----------|---------------|----------------|
| **Techno** | 300 ms | 1000 ms | **0.076** | **0.023** | ~13 frames | ~43 frames (~1.0s) |
| **Latino** | 200 ms | 600 ms | **0.114** | **0.038** | ~9 frames | ~26 frames (~0.6s) |

**Diagnóstico del decay excesivo:**

El operador nota que **Ambient tiene desvanecimiento excesivamente largo**. La raíz está en el **release α del EMA**.

- Techno: release α = 0.023 → cada frame retiene el **97.7%** del valor anterior. Half-life ≈ 30 frames = **0.68s**.
- Latino: release α = 0.038 → cada frame retiene el **96.2%**. Half-life ≈ 18 frames = **0.41s**.

Pero el verdadero problema es la **curva cuadrática** (`Math.pow(_, 2.0)`):

| `_ambientEMA` (raw) | `_ambientCrushed = raw²` | `% de caída por frame` |
|---------------------|--------------------------|------------------------|
| 0.50 | 0.25 | 6.25% |
| 0.30 | 0.09 | 2.25% |
| 0.15 | 0.0225 | 0.56% → **CERO por gate=0.03** |

**¡El gate a 0.03 es el culpable del blackout brusco!** Cuando `_ambientCrushed` cae por debajo de 0.03, el valor salta a **0.0 instantáneamente**. Esto crea un "corte" perceptible cuando la música baja de intensidad. El operador percibe "decay excesivo" porque entre 0.03 y 0.0 no hay gradación — es un acantilado.

**Recomendación:** Cambiar el gate de 0.03 a una **curva de fade suave** (ej. lineal de 0.03→0 en 10 frames) o elevar el gate a 0.01 para permitir más rango de caída.

---

#### Air EMA

```typescript
const _airSignal = 1.0 - Math.exp(-(bands.treble * 0.60 + bands.highMid * 0.40) * 3.0)

if (_airSignal > this._airEMA) {
  this._airEMA = this._airEMA * 0.88 + _airSignal * 0.12   // Attack α = 0.12 (~8 frames)
} else {
  this._airEMA = this._airEMA * 0.95 + _airSignal * 0.05   // Release α = 0.05 (~20 frames)
}
```

| Dirección | α | Frames @ 44Hz | Tiempo real |
|-----------|---|---------------|-------------|
| Attack | 0.12 | ~8 frames | ~180 ms |
| Release | 0.05 | ~20 frames | ~455 ms |

**Nota:** Air es **profile-agnóstico**. No hay diferenciación entre techno y latino en el código. Ambos perfiles usan los mismos α=0.12/0.05. La diferencia solo viene del `recoveryFactor` (AGC) que aplica igual a todos los perfiles.

**Diferenciación real:**
- Techno → `airIntensity = _airEMA × recoveryFactor`. Si hay un rebound AGC (`recoveryFactor < 1.0`), el air se atenúa.
- Latino → mismo cálculo. Pero latino tiene más `treble` (güira, metales), entonces `_airSignal` es naturalmente más alto. **El air "respira" más en latino por la fuente de audio, no por el motor.**

---

#### Floor

```typescript
const floorIntensity = Math.min(1.0, Math.max(0.0,
  (bands.subBass * 0.65 + bands.lowMid * 0.35) * recoveryFactor
))
```

**Floor es instantáneo** (sin EMA). Responde frame a frame. La única inercia es `recoveryFactor`, que es compartida por todas las zonas. No hay diferenciación por perfil en el código — la diferencia viene del audio (reguetón tiene más subBass sostenido que techno industrial).

---

### 2.3 Comparativa Técnica por Perfil

| Parámetro | Techno | Latino | Chill |
|-----------|--------|--------|-------|
| `ambientAttackMs` | 300 | 200 | (default 800) |
| `ambientReleaseMs` | 1000 | 600 | (default 10000) |
| `ambientAttack α` | 0.076 | 0.114 | 0.028 |
| `ambientRelease α` | 0.023 | 0.038 | 0.0023 |
| Noise gate threshold | 0.03 | 0.03 | 0.03 |
| Curva de crush | `x²` | `x²` | `x²` |

**Latino tiene ataque 50% más rápido y release 40% más corto que techno.** Esto debería hacer que el ambient "respire" más rápido en latino, siguiendo el tumbao. Sin embargo, el release de 600ms sigue siendo largo — en un dembow a 90 BPM, hay un golpe cada 667ms. El release de 600ms significa que el ambient **casi nunca llega a 0** entre golpes. Esto explica por qué el operador percibe "desvanecimiento excesivo": el ambient está siempre "encendido" porque el release es casi igual al período del beat.

**Recomendación:** Bajar `ambientReleaseMs` en latino a **250-350ms** para que el ambient caiga a cero entre golpes del dembow.

---

## 3. EL EMBUDADO DE LAYOUTS (7.1 vs 4.1)

### 3.1 LiquidEngine71 — routeZones (7 zonas independientes)

```typescript
// Techno (default):
frontLeftIntensity  = frontLeft   // envSubBass
frontRightIntensity = frontRight  // envKick
backLeftIntensity   = backLeft    // envHighMid
backRightIntensity  = backRight   // envSnare
moverLeftIntensity  = moverLeft   // envTreble
moverRightIntensity = moverRight  // envVocal

// Latino (WAVE 2468):
outMoverL = moverRight  // envVocal → Mover L físico (El Galán)
outMoverR = moverLeft   // envTreble → Mover R físico (La Dama)
// Front/Back: idénticos a techno (sin swap)

// Chill (WAVE 2470):
// Front/Back: osciladores de números primos (no audio-reactive)
// Movers: swap igual que latino
// floor=0, air=0, strobe=false
```

**En 7.1 cada zona es independiente.** No hay mezcla. Las 7 señales llegan a 7 canales de salida distintos.

---

### 3.2 LiquidEngine41 — routeZones (4 zonas compactadas)

```typescript
const frontPar = frontRight   // WAVE 4691: envKick (strict-split) o max(subBass,kick) (default)
const backPar  = backRight    // WAVE 4691: envSnare (strict-split) o max(snare,highMid) (default)

return {
  frontLeftIntensity:  frontPar,   // = frontPar (DUPLICADO)
  frontRightIntensity: frontPar,  // = frontPar (DUPLICADO)
  backLeftIntensity:   backPar,    // = backPar (DUPLICADO)
  backRightIntensity:  backPar,    // = backPar (DUPLICADO)
  moverLeftIntensity:  outMoverL,
  moverRightIntensity: outMoverR,
  ...
}
```

#### Estrategia 'default' (Latino, Pop-Rock, Chill):

| Salida 4.1 | Fórmula | Señales mezcladas |
|-----------|---------|-------------------|
| `frontPar` | `max(frontLeft, frontRight)` | **max(envSubBass, envKick)** |
| `backPar` | `max(backLeft, backRight)` | **max(envHighMid, envSnare)** |
| `outMoverL` | `moverLeft` | envTreble |
| `outMoverR` | `moverRight` | envVocal |

#### Estrategia 'strict-split' (Techno industrial):

| Salida 4.1 | Fórmula | Señales mezcladas |
|-----------|---------|-------------------|
| `frontPar` | `frontRight` | **envKick SOLO** |
| `backPar` | `backRight` | **envSnare SOLO** |
| `outMoverL` | `moverLeft` | `max(subBass, highMid, treble)` |
| `outMoverR` | `moverRight` | `max(subBass, highMid, vocal)` |

---

### 3.3 Impacto del Embudado — Análisis de Pérdida

**Problema 1: Air y Ambient en 4.1**

Ni Air ni Ambient se fusionan con otras señales. Son **passthrough**:

```typescript
// En 4.1 y 7.1:
floorIntensity: floorIntensity   // idéntico
ambientIntensity: ambientIntensity // idéntico
airIntensity: airIntensity         // idéntico
```

**No hay embudado de atmósferas.** Las 3 zonas atmosféricas llegan intactas sin importar el layout. La única diferencia es que en Chill, `airIntensity = 0` y `floorIntensity = 0` por decisión de ruteo.

**Problema 2: Back L y Back R en 4.1 (modo 'default')**

En 7.1 latino:
- Back L = envHighMid (congas, palmas) con decay=0.14, gateOn=0.35
- Back R = envSnare (TAcka) con decay=0.45, gateOn=0.28

En 4.1 latino (`max(backLeft, backRight)`):
- Si Back L tiene un tumbao sostenido (mid alto) y Back R tiene un TAcka puntual → `max()` siempre elige Back L.
- El TAcka (Back R) se **aplasta** y nunca se ve.
- Esto es exactamente lo que describe el comentario de WAVE 2435: *"tumbao continuo asfixia TAcka porque max() nunca se apaga."*

**Solución aplicada (WAVE 2459):** En latino overrides41, `envelopeSnare` tiene `decayBase=0.22` y `gateOn=0.52` — el TAcka se vuelve **más corto y más selectivo** para competir mejor en el `max()`.

**Problema 3: Front L y Front R en 4.1 (modo 'default')**

En 7.1 latino:
- Front L = envSubBass (TÚN continuo) con decay=0.50
- Front R = envKick (golpe puntual) con decay=0.08

En 4.1 latino (`max(frontLeft, frontRight)`):
- El subBass sostenido (frontLeft) mantiene `frontPar` alto entre kicks.
- El kick puntual (frontRight) se pierde en el max() porque frontLeft ya está alto.

**Solución aplicada (WAVE 2461/2462):** En latino overrides41, `envelopeSubBass` tiene `gateOn=0.22` (vs 0.15 base) y `decayBase=0.50` — el subBass se vuelve más selectivo y staccato para no dominar el max().

---

### 3.4 Tabla Resumen del Embudado

| Layout | Zonas físicas | Mezcla | Pérdida de información |
|--------|--------------|--------|------------------------|
| **7.1** | 7 independientes | Ninguna | 0% |
| **4.1 strict-split** | 4 (front=mono, back=mono, 2 movers) | Front=Kick, Back=Snare | Front L (SubBass) se pierde; Back L (HighMid) se pierde |
| **4.1 default** | 4 (front=mono, back=mono, 2 movers) | Front=max(Sub,Kick), Back=max(Snare,Mid) | Señal más fuerte gana; la débil se pierde |

---

## ANEXO A: Mapa de Constantes Numéricas

### Ambient
| Constante | Valor | Línea |
|-----------|-------|-------|
| Default `ambientAttackMs` | 800 ms | ILiquidProfile.ts:219 |
| Default `ambientReleaseMs` | 10000 ms | ILiquidProfile.ts:221 |
| Techno `ambientAttackMs` | 300 ms | techno.ts:235 |
| Techno `ambientReleaseMs` | 1000 ms | techno.ts:236 |
| Latino `ambientAttackMs` | 200 ms | latino.ts:284 |
| Latino `ambientReleaseMs` | 600 ms | latino.ts:285 |
| Noise gate threshold | 0.03 | LiquidEngineBase.ts:630 |
| Crush exponent | 2.0 | LiquidEngineBase.ts:629 |

### Air
| Constante | Valor | Línea |
|-----------|-------|-------|
| Treble weight | 0.60 | LiquidEngineBase.ts:337 |
| HighMid weight | 0.40 | LiquidEngineBase.ts:337 |
| Compression factor | 3.0 | LiquidEngineBase.ts:337 |
| Attack α | 0.12 | LiquidEngineBase.ts:339 |
| Release α | 0.05 | LiquidEngineBase.ts:341 |

### Floor
| Constante | Valor | Línea |
|-----------|-------|-------|
| SubBass weight | 0.65 | LiquidEngineBase.ts:620 |
| LowMid weight | 0.35 | LiquidEngineBase.ts:620 |

### Transient Shaper
| Constante | Valor | Línea |
|-----------|-------|-------|
| `MIN_DELTA` | 0.020 | LiquidEngineBase.ts:432 |
| `highMidDelta` multiplier | 1.5 | LiquidEngineBase.ts:436 |
| `midDelta` base weight | 0.8 | LiquidEngineBase.ts:436 |
| `midDelta` morph bonus | 0.7 | LiquidEngineBase.ts:436 |
| `baseSnare` multiplier | 2.0 | LiquidEngineBase.ts:438 |
| `clapBonus` harshness mult | 2.0 | LiquidEngineBase.ts:439 |
| Centroid floor base | 900 Hz | LiquidEngineBase.ts:454 |
| Dubstep harshness threshold | 0.024 | LiquidEngineBase.ts:456 |

### Vocal Sustain EMA
| Constante | Valor | Línea |
|-----------|-------|-------|
| Attack α | 0.25 | LiquidEngineBase.ts:329 |
| Release α | 0.04 | LiquidEngineBase.ts:331 |
| `vocalPenalty` max | 0.75 | LiquidEngineBase.ts:434 |
| Back L vocal attenuation | 0.80 | LiquidEngineBase.ts:564 |

---

## ANEXO B: Recomendaciones de Calibración para el Lead Designer

### A. Sangrado Vocal en Back R (Latino)
**Problema:** `percGate=0.045` en latino base es demasiado permisivo. Micro-transientes vocales (T/K/S del autotune) colan.
**Fix:** Subir `percGate` a 0.065 en latino base (alinear con techno 0.06 + margen) o implementar un segundo gate post-vocalPenalty que requiera `trebleDelta > vocalPenalty × 0.5`.

### B. Decay Excesivo de Ambient
**Problema:** Release de 600ms (latino) / 1000ms (techno) + gate brusco a 0.03 = blackout perceptible.
**Fix:**
1. Bajar `ambientReleaseMs` latino a **250-300ms** para que caiga entre golpes del dembow.
2. Reemplazar el gate binario (`<0.03 → 0`) por una **curva de fade exponencial** en el rango [0.03, 0.0] durante 8-12 frames.

### C. Air Profile-Agnóstico
**Problema:** Air usa los mismos α=0.12/0.05 para todos los perfiles. En techno debería ser más cortante; en latino más fluido.
**Fix:** Añadir `airAttackMs` / `airReleaseMs` a `ILiquidProfile` y reemplazar los α hardcodeados por cálculos profile-configurables.

### D. Embudado 4.1 Latino
**Problema:** `max(backLeft, backRight)` en 4.1 sigue aplastando el TAcka (backRight) cuando el tumbao (backLeft) es sostenido.
**Fix:** En 4.1 latino, usar **suma ponderada** en lugar de `max()`:
```typescript
backPar = backLeft * 0.40 + backRight * 0.60  // El TAcka siempre visible
```
O implementar un "anti-dominance" gate que atenúe backLeft si ha estado activo > 20 frames consecutivos.
