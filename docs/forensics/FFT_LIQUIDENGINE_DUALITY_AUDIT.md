# FFT V3 ↔ LiquidEngine — Duality, Interaction & Incompatibility Audit

**Autor:** Cascade — Análisis de integración
**Fecha:** 2025-01-25
**Base:** `GODEAR_V3_INTEGRATION_BLUEPRINT.md` + código fuente desplegado
**Estado:** Diagnóstico forense — 0 código modificado

---

## 1. Executive Summary

El back (snare / backRight) está destruido tras la integración de GodEar V3. El front, movers, ambient y air funcionan correctamente. La causa raíz **no es un bug de código**, sino una **incompatibilidad semántica no detectada** entre una señal nueva (`snare_energy`) y un consumidor diseñado para un tipo de señal completamente distinto (`LiquidEnvelope`).

**Tesis central:** El blueprint de integración V3 garantizó compatibilidad para las 7 bandas principales (`GodEarBands`), pero **no contempló** la adición de `RhythmicPercussionTracker` (WAVE 8008), que inyecta una señal de naturaleza completamente diferente (EMA continua) directamente al path de snare del LiquidEngine. El LiquidEngine fue cableado a las nuevas señales sin adaptar su lógica de consumo.

**Veredicto preliminar:** No se requiere reconstrucción desde 0. Se requiere un **adaptador de señal** o un **nuevo modo de procesamiento** en `LiquidEnvelope` para señales EMA continuas. El esfuerzo estimado es de 2-4 horas, no 36.

---

## 2. El Plan V3 y Su Promesa de Compatibilidad

### 2.1 La doctrina del blueprint

`GODEAR_V3_INTEGRATION_BLUEPRINT.md` establece:

> *"El V3 es un superset del V2. Todo campo V2 existe en V3 con el mismo tipo y semántica. Los campos V3 nuevos son opcionales."*

La matriz de compatibilidad (Sección 6) marca `LiquidEngineBase` y `LiquidStereoPhysics` como **✅ (sin cambios)** en todas las fases (0-3). La justificación es la mitigación R-1:

> *"Las 7 bandas que salen de `extractBandEnergy` siguen siendo magnitud RMS. Cero cambio visible para consumidores."*

**Esto es correcto para las 7 bandas.** El front, los movers, el ambient y el air consumen `GodEarBands` y funcionan perfectamente.

### 2.2 Lo que el blueprint no cubre: WAVE 8008

El blueprint cubre las fases WAVE 8001-8005. **WAVE 8008** (`RhythmicPercussionTracker`) no aparece en el blueprint. Fue una adición posterior que introdujo dos campos nuevos en `LiquidStereoInput`:

```typescript
// LiquidStereoPhysics.ts:65-67
snare_energy?: number  // 0-1 — geometric mean of body (150-250Hz) + crack (2-5kHz)
hh_energy?: number     // 0-1 — high band (5-15kHz)
```

Estos campos viajan por la cadena:

```
RhythmicPercussionTracker.process()
  → GodEarRhythmicPercussion.snare_energy (EMA continua)
    → TickEngine.ts:547 (snare_energy: this.audioPipeline.lastAudioData.rhythmic?.snare_energy)
      → SeleneLux.ts:640 (snare_energy: audioMetrics.snare_energy)
        → LiquidEngineBase.ts:327 (rawSnare = input.snare_energy)
          → LiquidEnvelope.process(hybridSnare = rawSnare)  ← AQUÍ SE ROMPE
```

**El blueprint nunca auditó este path.** La matriz de compatibilidad dice "LiquidEngineBase: sin cambios" porque asume que solo consume `GodEarBands`. Pero WAVE 8008 añadió un consumidor nuevo (`snare_energy`) que bypassa el path de bandas y alimenta el envelope directamente con una señal de naturaleza incompatible.

---

## 3. La Dualidad: Dos Señales, Un Consumidor

### 3.1 Path V2/Legacy — Snare binario (lo que LiquidEnvelope espera)

```typescript
// LiquidEngineBase.ts:541-561 (path fallback, sin rhythmic data)
const rawSpike = highMidDelta + trebleDelta
const snareSpectrum = Math.max(bands.mid, bands.treble * 0.4) * ((bands.treble * 0.5) + harshness)
const rawSnareCalc = (rawSpike * snareSpectrum * 10.0) > _snareThreshold
const isSnareImpact = rawSnareCalc && (now - this._lastSnareTime > 45)

const percRaw = this._snareHoldCounter > 0 ? 1.0 : 0.0  // ← BINARIO: 0 o 1
hybridSnare = percRaw
```

**Características de la señal V2:**
- **Discreta:** 0 o 1. No hay valores intermedios.
- **Impulso:** Pico instantáneo seguido de silencio absoluto.
- **Decaimiento:** El `LiquidEnvelope` aplica el decay internamente (`s.intensity *= decay`).
- **Gate hysteresis funcional:** `gateOff` funciona porque la señal vuelve a 0 entre hits.
- **Velocity significativa:** `velocity = signal - lastSignal` produce saltos de +1.0 en el ataque y -1.0 en el release — `isAttacking` es True solo en el frame del hit.

### 3.2 Path V3/WAVE 8008 — Snare EMA continuo (lo que LiquidEngine recibe ahora)

```typescript
// GodEarFFT.ts:1972-1977 (RhythmicPercussionTracker)
const snareEnergyRaw = snareAboveThresh ? Math.sqrt(snareBody * snareCrack) : 0
if (snareEnergyRaw > this._snareEnergyEMA) {
  this._snareEnergyEMA += 0.85 * (snareEnergyRaw - this._snareEnergyEMA)  // ATTACK
} else {
  this._snareEnergyEMA += 0.06 * (snareEnergyRaw - this._snareEnergyEMA)  // RELEASE ~330ms
}

// LiquidEngineBase.ts:537-539 (path directo, con rhythmic data)
if (hasRhythmic) {
  hybridSnare = rawSnare  // = snare_energy EMA continua, directamente al envelope
}
```

**Características de la señal V3:**
- **Continua:** Rango típico 0.15-0.35. Nunca vuelve a 0 entre hits (release de 330ms).
- **Suave:** EMA con attack 0.85 y release 0.06 — transiciones graduales, no impulsos.
- **Decaimiento integrado:** La señal ya tiene su propio envelope attack/release. `LiquidEnvelope` aplica decay **sobre** un signal que ya está decayendo → doble decay.
- **Gate hysteresis roto:** `gateOff` no funciona porque la señal nunca baja de `gateOff` entre hits.
- **Velocity casi cero:** `velocity = signal - lastSignal` produce deltas de ~0.01-0.05 (EMA suave), no saltos de 1.0. `isAttacking` es True en casi todos los frames.

### 3.3 Tabla comparativa

| Propiedad | V2 (Legacy) | V3 (RhythmicTracker) |
|-----------|-------------|----------------------|
| Tipo de señal | Binaria (0/1) | EMA continua (0.15-0.35) |
| Forma | Impulso → silencio | Ataque suave → cola de 330ms |
| Velocity por frame | ±1.0 (salto binario) | ±0.01-0.05 (EMA suave) |
| `isAttacking` | True solo en frame del hit | True en ~95% de frames |
| `gateOff` funcional | Sí (señal → 0) | No (señal nunca < gateOff) |
| `attackSlopeMin=0` | OK (velocity > 0 en hit) | Bloquea (velocity ~0 en meseta) |
| `dynamicGate` | avgSignal ≈ 0 → gate ≈ gateOn | avgSignal ≈ 0.20 → gate ≈ 0.21 |
| `squelchBase` calibrado | Para kickPower 0-1 | Para kickPower 0-0.15 (comprimido) |
| Decay | Una vez (envelope) | Dos veces (EMA + envelope) |

---

## 4. Incompatibilidades Detalladas en `LiquidEnvelope.process`

### 4.1 `isAttacking` — Falso positivo permanente

```typescript
// LiquidEnvelope.ts:228-235
const velocity = signal - s.lastSignal
const isRisingAttack = velocity >= -0.005  // ← EMA casi siempre cumple esto
const isGraceFrame = s.wasAttacking && velocity >= -0.03
const isAttacking = isRisingAttack || isGraceFrame
```

Para una señal binaria V2, `velocity` es +1.0 en el hit y -1.0 después. `isAttacking` es True solo en el frame del hit.

Para una EMA V3 con release 0.06, `velocity` es ~-0.003 por frame durante el decay. Esto es **≥ -0.005**, así que `isRisingAttack` es True. **`isAttacking` es True en el 95%+ de los frames**, causando ametrallamiento.

### 4.2 `gateOff` hysteresis — Nunca se resetea

```typescript
// LiquidEnvelope.ts:338-346
if (c.gateOff !== undefined) {
  if (!s.gateEngaged && signal > dynamicGate) {
    s.gateEngaged = true
    gateJustEngaged = true  // ← Solo True en el primer frame
  } else if (s.gateEngaged && signal < c.gateOff) {
    s.gateEngaged = false  // ← Nunca ocurre con EMA continua
  }
}
```

Con V2, la señal vuelve a 0 < `gateOff` → `gateEngaged` se resetea → próximo hit dispara `gateJustEngaged`.

Con V3, la señal nunca baja de `gateOff` (0.02) → `gateEngaged` queda True para siempre → `gateJustEngaged` solo es True en el primer frame de la sesión → `kickPower = 0` para siempre.

**Fix aplicado:** Remover `gateOff` del config de `envelopeSnare`. Pero esto elimina la hysteresis → ametrallamiento.

### 4.3 `gateReengageDrop` — Parche sobre parche

Se añadió `gateReengageDrop: 0.10` como sustituto de `gateOff` para señales EMA. La latching flag `gateRearmed` resuelve el "catch-22" del drop, pero el mecanismo sigue siendo frágil:

- Si `snare_energy` tiene variaciones pequeñas entre hits (0.20 → 0.18 → 0.22), el drop de 0.10 nunca se cumple → no re-arm → no ignita.
- Si el drop es muy pequeño (0.05), se re-arma constantemente → ametrallamiento.
- El valor óptimo depende del material sonoro → no es robusto.

### 4.4 `attackSlopeMin` — Bloqueo silencioso

```typescript
// LiquidEnvelope.ts:332
const attackSlopeMin = c.attackSlopeMin ?? 0
// LiquidEnvelope.ts:371
if (gateCondition && signal > dynamicGate && isAttacking && signal > 0.15 && velocity >= attackSlopeMin) {
```

`envelopeSnare` no define `attackSlopeMin` → default 0. Esto significa que `velocity >= 0` es requerido. Pero una EMA en fase de decay tiene `velocity < 0`. Si el hit llega mientras la EMA aún está decayendo del hit anterior, `velocity` puede ser negativa → `kickPower = 0`.

`envelopeHighMid` sí lo define (`-0.01`), pero `envelopeSnare` no. Esto es una inconsistencia.

### 4.5 `dynamicGate` — Seguimiento asintótico

```typescript
// LiquidEnvelope.ts:243-248
if (signal > s.avgSignal) {
  s.avgSignal = s.avgSignal * 0.98 + signal * 0.02  // Attack lento
} else {
  s.avgSignal = s.avgSignal * 0.88 + signal * 0.12  // Decay rápido
}
// LiquidEnvelope.ts:282
const dynamicGate = avgEffective + c.gateMargin
```

Con señal binaria V2, `avgSignal` oscila entre 0 (entre hits) y el valor del hit. `dynamicGate` es bajo → fácil de cruzar.

Con EMA V3 continua (0.15-0.35), `avgSignal` converge a ~0.20. `dynamicGate` ≈ 0.21. La señal en un hit típico es 0.25-0.30 → apenas cruza el gate por 0.04-0.09. `kickPower = (0.04 / 0.14)^1.6 ≈ 0.08` → por debajo de `squelch` (0.06-0.10) → **no ignita**.

### 4.6 Doble decay — Asfixia del envelope

La señal V3 ya tiene su propio envelope (attack 0.85, release 0.06). `LiquidEnvelope` aplica decay adicional:

```typescript
// LiquidEnvelope.ts:323-324
const decay = c.decayBase + c.decayRange * morphFactor
s.intensity *= decay  // decayBase=0.04 → s.intensity *= 0.04-0.24
```

`decayBase: 0.04` significa que la intensidad cae al 4% por frame (sin morph). Esto es extremadamente agresivo y fue calibrado para impulsos binarios que inyectan `intensity = 1.0` y necesitan caer rápido. Con la EMA V3, `kickPower` ya es bajo (0.08-0.15), y multiplicar por 0.04 lo asfixia a ~0.003 en un frame.

---

## 5. Por Qué el Front Sí Funciona

El front (`frontLeft`, `frontRight`) consume `GodEarBands.subBass` y `GodEarBands.bass` — las 7 bandas principales que sí mantienen el dominio magnitud RMS garantizado por R-1. Los envelopes `envelopeSubBass` y `envelopeBass` procesan señales que, aunque cambiaron sutilmente de dinámica con el power spectrum interno del V3, siguen siendo **bandas de frecuencia con comportamiento transitorio** (picos y valles), no EMAs continuas. Los thresholds calibrados (`gateOn`, `squelchBase`) tienen margen suficiente para absorber las diferencias sutiles del V3.

Los movers consumen `bands.highMid`, `bands.treble`, `bands.mid` — mismo caso que el front. Funcionan.

El ambient y el air usan EMAs propios internos del `LiquidEngineBase`, no del `RhythmicPercussionTracker`. No se ven afectados.

**El back está destruido específicamente porque es el único path que consume `snare_energy` del `RhythmicPercussionTracker`.**

---

## 6. Los 120 Parches — Por Qué Ninguno Funcionó

Todos los parches aplicados fueron intentos de hacer que `LiquidEnvelope` funcione con una señal EMA continua sin cambiar la naturaleza del consumo:

| Parche | Qué se hizo | Por qué falló |
|--------|-------------|---------------|
| Lower `gateOn` 0.22→0.08 | Bajar threshold | `dynamicGate` sigue la señal, siempre está cerca |
| Lower `squelchBase` 0.20→0.06 | Bajar umbral de ignición | `kickPower` sigue siendo ~0.08 por gate asintótico |
| Remove `gateOff` | Eliminar hysteresis | Ametrallamiento (no hay reset entre hits) |
| Add `gateReengageDrop` 0.10 | Drop relativo | Catch-22: drop solo se cumple cuando señal es baja, no cuando sube |
| Latching `gateRearmed` | Fix del catch-22 | Sigue frágil: depende de la amplitud relativa entre hits |
| Increase `retriggerLockoutMs` 50→120 | Anti-ametrallamiento | Suprime ametrallamiento pero también suprime hits reales rápidos |
| Lower `peakDecayRate` 0.993→0.97 | Acelerar peak decay | `dynamicGate` baja más rápido pero `avgSignal` sigue alto |

**Diagnóstico:** Todos los parches operan sobre **síntomas** (thresholds, hysteresis, lockout). Ninguno aborda la **causa raíz**: `LiquidEnvelope` fue diseñado para impulsos binarios y recibe EMAs continuas.

---

## 7. Reconstrucción vs. Adaptación

### 7.1 Reconstrucción desde 0 (NO recomendado)

- **Alcance:** Reescribir `LiquidEngineBase`, `LiquidStereoPhysics`, `LiquidEnvelope`, y todos los perfiles.
- **Coste:** 40-80 horas. Descarta 36h de calibración previa al V3.
- **Riesgo:** Alto — el front, movers, ambient y air funcionan. Reconstruir pone todo eso en riesgo.
- **Justificación:** Ninguna. El 85% del sistema funciona. Solo el path de snare está roto.

### 7.2 Adaptación dirigida (RECOMENDADO)

El problema está aislado en **una línea de código**:

```typescript
// LiquidEngineBase.ts:539
hybridSnare = rawSnare  // ← EMA continua alimentada directamente al envelope
```

Tres opciones de adaptación, ordenadas por esfuerzo:

#### Opción A: Pre-procesador de señal (mínimo esfuerzo, ~2h)

Convertir `snare_energy` EMA de vuelta a un impulso binario + decay antes de alimentar `LiquidEnvelope`:

```typescript
// Pseudocódigo — adapter en LiquidEngineBase
if (hasRhythmic) {
  // Detectar onset: cruce de derivada positiva sobre umbral adaptativo
  const snareDelta = rawSnare - this._prevSnareEnergy
  const snareOnset = snareDelta > 0.02 && rawSnare > 0.12 && (now - this._lastSnareOnset > 80)
  if (snareOnset) {
    this._lastSnareOnset = now
    this._snareImpulse = 1.0  // Impulso binario
  }
  this._snareImpulse *= 0.04  // Decay rápido (mismo que decayBase)
  hybridSnare = this._snareImpulse
}
```

**Ventaja:** `LiquidEnvelope` funciona exactamente como con V2. Cero cambios al envelope. Cero cambios a perfiles.
**Desventaja:** Pierde la información de amplitud continua de la EMA (intensidad variable por hit).

#### Opción B: Nuevo método `processContinuous()` (~4h)

Añadir un modo de procesamiento a `LiquidEnvelope` diseñado para señales EMA:

- Trigger por **derivada** (velocity positiva significativa) en lugar de gate absoluto.
- Sin `gateOff` ni `gateReengageDrop` — el trigger es por derivada, no por umbral.
- Decay sincronizado con el release de la EMA (no doble decay).
- `squelch` basado en amplitud del hit, no en `kickPower` comprimido.

**Ventaja:** Preserva información de amplitud. Más expresivo.
**Desventaja:** Requiere calibrar un nuevo set de parámetros.

#### Opción C: Bypass del envelope para snare (~1h)

Para el snare, usar la EMA directamente como intensidad, con un gate de derivada simple:

```typescript
if (hasRhythmic) {
  const snareDelta = rawSnare - this._prevSnareEnergy
  const isOnset = snareDelta > 0.02 && rawSnare > 0.12
  if (isOnset) this._snareIntensity = Math.min(1.0, rawSnare * 1.8)
  this._snareIntensity *= 0.04  // decay
  hybridSnare = this._snareIntensity
  // Bypass envSnare.process — usar hybridSnare directamente como backRight
}
```

**Ventaja:** Mínimo código. Usa la EMA del tracker que ya está bien calibrada.
**Desventaja:** Pierde la morfología del envelope (crush exponent, morph factor, breakdown penalty).

---

## 8. Conclusión

| Pregunta | Respuesta |
|----------|-----------|
| ¿Hay que reconstruir desde 0? | **No.** El 85% del sistema funciona. El problema está aislado al path de snare. |
| ¿Cuál es la causa raíz? | `RhythmicPercussionTracker.snare_energy` es una EMA continua alimentada a `LiquidEnvelope`, que fue diseñado para impulsos binarios. |
| ¿Por qué el blueprint no lo detectó? | WAVE 8008 no era parte del blueprint (WAVE 8001-8005). El blueprint auditó `GodEarBands` pero no los campos `snare_energy`/`hh_energy` añadidos posteriormente. |
| ¿Por qué 120 parches no funcionaron? | Todos operaron sobre síntomas (thresholds, hysteresis). Ninguno abordó la incompatibilidad fundamental de tipo de señal. |
| ¿Qué se debe hacer? | Adaptación dirigida (Opción A, B o C). Esfuerzo: 1-4 horas. |
| ¿El front/movers/ambient/air están en riesgo? | No. Consumen `GodEarBands` que mantienen dominio magnitud RMS. |

---

## 9. Anexo: Archivos Clave

| Archivo | Líneas relevantes | Rol |
|---------|-------------------|-----|
| `GodEarFFT.ts` | 1839-2017 | `RhythmicPercussionTracker` — produce `snare_energy` EMA |
| `LiquidEngineBase.ts` | 317-332, 536-575 | Punto de bifurcación: path V3 (EMA directa) vs V2 (binario) |
| `LiquidEnvelope.ts` | 220-438 | Lógica de gate/decay/ignition — diseñada para impulsos |
| `LiquidStereoPhysics.ts` | 35-68 | `LiquidStereoInput` con campos `snare_energy`/`hh_energy` |
| `SeleneLux.ts` | 629-642 | Construcción de `LiquidStereoInput` desde audio metrics |
| `TickEngine.ts` | 546-548 | Forwarding de `rhythmic.snare_energy` al pipeline |
| `profiles/techno.ts` | 91-108 | Config de `envelopeSnare` — calibrada para binario, recibe EMA |
| `GODEAR_V3_INTEGRATION_BLUEPRINT.md` | 370-384 | C7/C8: "Sin cambios en Fases 0-3" — no contempló WAVE 8008 |

---

*"El V3 es un superset silencioso — si no lo escuchas, es porque está funcionando. Pero si le das un micrófono continuo a un interruptor binario, el interruptor no sabe qué hacer."*
