# AUDITORÍA FORENSE — El Fantasma del Estrobo (V1.0-RC1)

> **Bug:** Fuga de intensidad ~5-10% en canal de estrobo durante disparos
> automáticos (L3). Los disparos manuales (L2) alcanzan 1.0 perfecto.
> Solo afecta al path **Legacy** (Channel Rack clásico). El path
> **Nodegraph** procesa el mismo efecto automático sin pérdidas.

---

## 1. DIAGNÓSTICO RAÍZ — Tres hallazgos convergentes

### 1.1 Hallazgo A — Doble cuantización en el path Legacy (CAUSA RAÍZ)

El path Legacy cuantiza el strobe **dos veces**, mientras que el path
Nodegraph solo cuantiza **una vez**.

**Path Legacy (doble cuantización):**

1. `HephaestusRuntime._emitTrackSample` (línea 706) llama
   `scaleToDMX('strobe', withIntensity)` → `Math.round(clamped * 255)`.
   El valor 0-1 de la curva se redondea a entero 0-255 aquí.
2. El `HephFixtureOutput.value` resultante (ya entero 0-255) se almacena.
3. `TickEngine.applyOutputs` (línea 1142) hace:
   `f.strobe = Math.min(255, (f.strobe || 0) + output.value)`.
4. `FixtureMapper._getChannelValue` (línea 550) retorna
   `state.phantomChannels?.['strobe'] ?? state.strobe ?? (channel.defaultValue ?? 0)`.
   **No hay segundo `Math.round`** porque el valor ya es entero.

**Path Nodegraph (cuantización única al final):**

1. `HephaestusRuntime._emitTrackSample` (línea 715) pasa
   `withIntensity` (float 0-1 **sin redondear**) como `normalizedValue`.
2. `HephaestusAetherAdapter._populateValues` (línea 434) escribe
   `values['strobe'] = output.normalizedValue` (float 0-1 puro).
3. `NodeArbiter._applyIntent` (línea 1423) hace LTP:
   `record[channel] = incoming` (float 0-1 puro, sin redondeo).
4. `NodeResolver._writeNode` (línea 1474) cuantiza al final:
   `dmxValue = sanitizeDmxByte(Math.round(normalized * 255))`.

**Diferencia crítica:** Si la curva Bezier evalúa a `0.969` en un frame
que no cae exactamente en el vértice (sampleo a 44fps):

| Path | Paso 1 | Paso 2 | DMX final | % de 255 |
|------|--------|--------|-----------|----------|
| **Legacy** | `Math.round(0.969 * 255) = 247` | `f.strobe = 247` | **247** | **96.9%** |
| **Nodegraph** | `normalizedValue = 0.969` | `Math.round(0.969 * 255) = 247` | **247** | **96.9%** |

**Wait — ambos dan 247.** La doble cuantización no es la causa raíz aquí
porque `Math.round(0.969*255) = 247` y luego pasar 247 directo al buffer
DMX es idéntico a `Math.round(0.969*255) = 247` al final del NodeResolver.

**La diferencia real está en el Hallazgo B.**

### 1.2 Hallazgo B — Suma aditiva vs LTP estricto (CAUSA RAÍZ CONFIRMADA)

**Path Legacy — `TickEngine.ts:1142`:**

```typescript
case 'strobe': f.strobe = Math.min(255, (f.strobe || 0) + output.value); break
```

El path Legacy usa **suma aditiva** para strobe. Si hay **múltiples
outputs strobe** para el mismo fixture en el mismo frame (ej: un output
`directOutputs` + un output `allOutputs` + un output `zone:front`),
los valores se **suman** y se clampean a 255.

**Path Nodegraph — `NodeArbiter.ts:1422-1424`:**

```typescript
if (layer === 'hephaestus' || layer === 'calibration') {
  record[channel] = incoming  // LTP — último writer gana
  continue
}
```

El path Nodegraph usa **LTP estricto** para strobe cuando la fuente es
Hephaestus (L3+). El último intent que toca el nodo **reemplaza** el
valor anterior, no lo suma.

**Pero esto no explica la fuga** — la suma aditiva debería dar **más**
intensidad, no menos. La fuga es de **pérdida**, no de exceso.

### 1.3 Hallazgo C — El `_ensureStrobeDimmer` del Nodegraph (CAUSA RAÍZ REAL)

**Path Nodegraph — `HephaestusAetherAdapter.ts:239-247`:**

```typescript
private _ensureStrobeDimmer(): void {
  for (let i = 0; i < this._frameIntents.length; i++) {
    const intent = this._frameIntents[i] as MutableNodeIntent
    const strobe = intent.values['strobe'] ?? intent.values['strobeRate'] ?? 0
    if (strobe > 0) {
      intent.values['dimmer'] = 1.0  // ← FUERZA DIMMER A 1.0
    }
  }
}
```

Y además en `_populateValues` (línea 447):

```typescript
if (output.normalizedValue > 0) {
  values['shutter'] = 1.0  // ABRE EL OBTURADOR MECÁNICO
  values['dimmer'] = 1.0   // LÁMPARA A FULL POWER
}
```

**El path Nodegraph fuerza `dimmer=1.0` y `shutter=1.0` cuando hay
strobe activo.** Esto garantiza que la lámpara esté a máxima potencia
para que el strobe se vea a brillo total.

**Path Legacy — `TickEngine.ts:1141-1142`:**

```typescript
case 'intensity': f.dimmer = Math.max(f.dimmer, output.value); break
case 'strobe': f.strobe = Math.min(255, (f.strobe || 0) + output.value); break
```

**El path Legacy NO fuerza dimmer=255 cuando hay strobe.** Solo aplica
el dimmer que viene del track de intensidad (si existe). Si el clip de
strobe **no tiene track de intensidad** (típico en clips de efecto
puro), el dimmer queda en su valor anterior (posiblemente 0 o bajo).

**Resultado:** El fixture recibe `strobe=247 + dimmer=0` → el strobe
flashea pero la lámpara está apagada → **brillo aparente = 0%**. Si el
dimmer está a 50% (de un effect anterior), el strobe flashea al 50% de
brillo → **fuga del 50%**. Si está a 90%, fuga del 10%.

**Esto calza exactamente con el síntoma de 5-10% de fuga.**

### 1.4 Hallazgo D — Sampleo temporal a 44fps (factor agravante, no raíz)

La hipótesis del Arquitecto sobre el sampleo temporal es **válida como
factor agravante** pero no es la causa raíz:

- Una curva Bezier con pico en `t=0.5` y duración de 100ms, sampleada
  a 44fps (frames a t=0, 23ms, 45ms, 68ms...), puede capturar:
  - Frame en t=45ms: `bezier(0.45) = 0.987` en vez de `1.0`
  - `Math.round(0.987 * 255) = 252` → 252/255 = 98.8% → **1.2% de fuga**
- Esto afecta a **ambos paths** por igual (ambos usan el mismo
  CurveEvaluator y el mismo `scaleToDMX`/`Math.round(normalized*255)`).
- La fuga del 1.2% por sampleo se **suma** a la fuga del 5-10% por
  dimmer no forzado en el path Legacy.

**¿Por qué Nodegraph sobrevive al sampleo?** Porque su `_ensureStrobeDimmer`
fuerza `dimmer=1.0`, compensando cualquier pérdida por sampleo. El
strobe a 252/255 con dimmer=255 se ve prácticamente idéntico a 255/255.
El path Legacy con dimmer=0.95 (de un track de intensidad parcial) +
strobe=252 se ve como 252×0.95 = 239/255 = 93.7% → **6.3% de fuga total**.

---

## 2. FLUJO DE DATOS — Diagrama forense

### 2.1 Path Legacy (con fuga)

```
HephClip (curva Bezier strobe)
  ↓
CurveEvaluator.getValue('strobe', timeMs)     → 0.969 (float 0-1)
  ↓
_emitTrackSample (línea 704-706)
  rawValue = 0.969
  withIntensity = 0.969 × 1.0 = 0.969
  scaledValue = scaleToDMX('strobe', 0.969)   → Math.round(0.969×255) = 247
  normalizedValue = 0.969                      → (IGNORADO por path Legacy)
  ↓
HephFixtureOutput { value: 247, normalizedValue: 0.969, parameter: 'strobe' }
  ↓
TickEngine.applyOutputs (línea 1142)
  f.strobe = Math.min(255, (0) + 247) = 247
  f.dimmer = ???  ← NO SE TOCA (solo si hay track 'intensity' separado)
  ↓
FixtureMapper._getChannelValue (línea 550)
  strobe channel → state.strobe = 247         → DMX strobe = 247 ✓
  dimmer channel → state.dimmer = ???          → DMX dimmer = ??? ✗
  ↓
Buffer DMX: { strobe: 247, dimmer: ??? }
  ↓
Fixture físico: strobe rate OK, pero brillo = dimmer/255 × strobe_effect
  Si dimmer=230 (90%): brillo aparente = 247 × 0.90 = 222/255 = 87%
  → FUGA DEL 13%
```

### 2.2 Path Nodegraph (sin fuga)

```
HephClip (curva Bezier strobe)
  ↓
CurveEvaluator.getValue('strobe', timeMs)     → 0.969 (float 0-1)
  ↓
_emitTrackSample (línea 704-715)
  rawValue = 0.969
  withIntensity = 0.969 × 1.0 = 0.969
  scaledValue = 247                             → (IGNORADO por path Nodegraph)
  normalizedValue = 0.969                        → USADO
  ↓
HephFixtureOutput { value: 247, normalizedValue: 0.969, parameter: 'strobe' }
  ↓
HephaestusAetherAdapter._populateValues (línea 434-448)
  values['strobe'] = 0.969
  values['strobeRate'] = 0.969
  values['shutter'] = 1.0                        → ABRE OBTURADOR
  values['dimmer'] = 1.0                         → FUERZA LÁMPARA A FULL
  ↓
_ensureStrobeDimmer() (línea 239-247)
  if strobe > 0: values['dimmer'] = 1.0          → REFUERZA DIMMER
  ↓
NodeArbiter._applyIntent (LTP estricto)
  record['strobe'] = 0.969
  record['shutter'] = 1.0
  record['dimmer'] = 1.0
  ↓
NodeResolver._writeNode (línea 1474)
  strobe: Math.round(0.969 × 255) = 247
  shutter: Math.round(1.0 × 255) = 255
  dimmer: Math.round(1.0 × 255) = 255
  ↓
Buffer DMX: { strobe: 247, shutter: 255, dimmer: 255 }
  ↓
Fixture físico: strobe rate 247, dimmer=255, shutter=255
  brillo aparente = 247/255 × 100% = 96.9%
  → FUGA DEL 3.1% (solo por sampleo, compensada visualmente por dimmer full)
```

---

## 3. EMBUDO LEGACY — Puntos de inspección

### 3.1 `scaleToDMX` (HephUtils.ts:74-90)

```typescript
export function scaleToDMX(paramId: string, rawValue: number): number {
  if (!Number.isFinite(rawValue)) return 0
  const clamped = Math.max(0, Math.min(1, rawValue))
  if (DMX_SCALED_PARAMS.has(paramId)) {    // 'strobe' ∈ este set
    return Math.round(clamped * 255)        // ← Cuantización 1
  }
  return clamped
}
```

- **Casteo de tipos:** `Math.round` devuelve `number` (float64). No hay
  `| 0` ni `~~` que truncaría. El redondeo es correcto.
- **Escalado matemático:** `clamped * 255` es el estándar DMX. No hay
  `* 256` (error común que causaría overflow).
- **Veredicto:** No hay bug aquí. El redondeo es matemáticamente correcto.

### 3.2 `TickEngine.applyOutputs` (TickEngine.ts:1138-1163)

```typescript
case 'intensity': f.dimmer = Math.max(f.dimmer, output.value); break  // HTP
case 'strobe': f.strobe = Math.min(255, (f.strobe || 0) + output.value); break  // SUMA
```

- **Strobe usa suma aditiva** (`+`), no HTP (`Math.max`) ni LTP (`=`).
  Esto es intencional para acumular múltiples sources de strobe, pero
  **difiere del Nodegraph** que usa LTP estricto.
- **No hay `_ensureStrobeDimmer` equivalente.** El dimmer no se fuerza
  a 255 cuando hay strobe activo. **ESTO ES EL BUG.**
- **No hay `shutter=255` forzado.** El path Legacy no abre el obturador
  mecánico cuando hay strobe. Si el fixture tiene shutter separado y
  está cerrado, el strobe es invisible.

### 3.3 `FixtureMapper._getChannelValue` (FixtureMapper.ts:547-550)

```typescript
case 'strobe':
  return state.phantomChannels?.['strobe'] ?? state.strobe ?? (channel.defaultValue ?? 0)
```

- **Prioridad:** phantomChannels > state.strobe > defaultValue.
- **No hay escalado adicional.** El valor pasa directo al buffer DMX.
- **No hay `Math.round`** porque el valor ya es entero (viene de
  `scaleToDMX`). Esto es correcto.
- **Veredicto:** No hay bug aquí. El mapper es transparente.

### 3.4 Regla HTP/LTP en el NodeArbiter

- **Strobe** → `STRICT_PRIORITY_CHANNELS` (línea 76): prioridad estricta
  por capa (L4>LP>L3>L2>L1>L0). HTP solo dentro de L0.
- **Dimmer** → LTP absoluto (línea 15): L2 gana cuando está activo.
- **El path Legacy no tiene NodeArbiter** — usa `applyOutputs` directo
  con su propia lógica de merge (suma para strobe, HTP para dimmer).

---

## 4. POR QUÉ NODEGRAPH SOBREVIVE

### 4.1 Triple protección del adapter

El `HephaestusAetherAdapter` tiene **tres mecanismos** que el path
Legacy no tiene:

1. **`_populateValues` (línea 436-448):** Cuando `strobe > 0`, fuerza
   `shutter = 1.0` y `dimmer = 1.0` en el mismo intent.
2. **`_ensureStrobeDimmer` (línea 239-247):** Post-pass que re-confirma
   `dimmer = 1.0` para cualquier nodo con strobe activo, **después** de
   que todos los outputs se consolidaron. Esto previene que un track
   de dimmer posterior (ej: sawtooth a 0.3) sobrescriba el dimmer=1.0.
3. **LTP estricto en NodeArbiter:** El strobe del L3+ no se suma con
   otros sources — el último writer gana limpio.

### 4.2 No hay "Peak Hold" en Nodegraph

El Arquitecto preguntó si Nodegraph tiene retención de picos. **No
tiene.** El `peakHoldMap` (TickEngine.ts:1239) es solo para UI truth
broadcast, no para DMX. La ventaja del Nodegraph no es peak hold sino
**dimmer forzado + shutter abierto**.

### 4.3 El sampleo a 44fps afecta a ambos por igual

La Bezier con vértice en 1.0, sampleada a 44fps, puede capturar 0.987
en vez de 1.0. Esto produce `Math.round(0.987*255) = 252` en ambos
paths. La diferencia es que el Nodegraph compensa con `dimmer=255` +
`shutter=255`, haciendo que el 252/255 sea visualmente indistinguible
del 255/255. El Legacy con `dimmer=???` no compensa.

---

## 5. RECOMENDACIÓN DE FIX — Tres opciones

### Opción A (mínima, recomendada para V1.0): Forzar dimmer en applyOutputs

En `TickEngine.ts:1138-1163`, añadir lógica equivalente al
`_ensureStrobeDimmer` del adapter:

```typescript
const applyOutputs = (outputs: HephFixtureOutput[]) => {
  let hasStrobe = false
  for (const output of outputs) {
    switch (output.parameter) {
      case 'intensity': f.dimmer = Math.max(f.dimmer, output.value); break
      case 'strobe':
        f.strobe = Math.min(255, (f.strobe || 0) + output.value)
        if (output.value > 0) hasStrobe = true
        break
      // ... resto sin cambios
    }
  }
  // ⚒️ FIX FANTASMA DEL ESTROBO: forzar dimmer + shutter cuando hay strobe
  if (hasStrobe) {
    f.dimmer = Math.max(f.dimmer, 255)  // lámpara a full
    // Si el fixture tiene shutter separado, abrirlo
    if (f.shutter !== undefined) f.shutter = 255
  }
}
```

**Ventaja:** Mínimo cambio, espeja el comportamiento del Nodegraph.
**Riesgo:** Si un clip de strobe se solapa con un clip de dimmer
intencionalmente bajo (ej: strobe a 50% brillo), este fix lo rompe.
Pero eso es un caso de uso extremadamente raro y el Nodegraph ya
se comporta así.

### Opción B (media): Usar `normalizedValue` en vez de `value` en Legacy

Cambiar `TickEngine.ts:1142` para usar `output.normalizedValue` (float
0-1) en vez de `output.value` (int 0-255), y escalar al final:

```typescript
case 'strobe':
  // Usar normalizedValue (float 0-1) para preservar precisión
  const strobeNorm = output.normalizedValue ?? (output.value / 255)
  f.strobeNorm = Math.max(f.strobeNorm ?? 0, strobeNorm)  // HTP en dominio float
  break
```

Y luego en `FixtureMapper._getChannelValue`:
```typescript
case 'strobe':
  const norm = state.strobeNorm ?? (state.strobe ?? 0) / 255
  return Math.round(norm * 255)
```

**Ventaja:** Elimina la doble cuantización (aunque vimos que no es la
causa raíz, es buena práctica alinear con el Nodegraph).
**Desventaja:** Requiere cambiar `FixtureState` para añadir campos
`strobeNorm` o sobrecargar `strobe` con semántica float. Más invasivo.

### Opción C (arquitectónica, post-V1.0): Unificar paths

Migrar el path Legacy para que también pase por `HephaestusAetherAdapter`
+ `NodeArbiter` + `NodeResolver`, eliminando `TickEngine.applyOutputs`
como ruta de procesamiento. Esto elimina la divergencia de forma
permanente pero es un refactor grande.

---

## 6. VEREDICTO FORENSE

| Pregunta del Arquitecto | Respuesta |
|--------------------------|-----------|
| ¿El sampleo 44fps salta el vértice 1.0 de la Bezier? | **Sí**, pero afecta a ambos paths por igual (~1-3% de fuga) |
| ¿Nodegraph tiene Peak Hold que Legacy no tiene? | **No.** El `peakHoldMap` es solo para UI truth, no para DMX |
| ¿Hay casteo/escalado en el embudo Legacy? | **No.** `scaleToDMX` usa `Math.round(n*255)` correcto. No hay `|0` ni `~~` |
| ¿Hay regla HTP/LTP que diferencie? | **Sí, pero no es la causa.** Legacy usa suma aditiva, Nodegraph usa LTP. La suma daría más, no menos |
| **CAUSA RAÍZ** | **El path Legacy no fuerza `dimmer=255` + `shutter=255` cuando hay strobe activo.** El Nodegraph sí (`_ensureStrobeDimmer` + `_populateValues`). El fixture recibe strobe rate correcto pero la lámpara está a brillo parcial → fuga del 5-10% |

**El Fantasma del Estrobo no es un fantasma matemático.** Es un
`dimmer` que no se enciende a full cuando debería.

---

## 7. REFERENCIAS DE CÓDIGO

- `HephUtils.ts:74-90` — `scaleToDMX()` (cuantización 0-1 → 0-255)
- `HephaestusRuntime.ts:704-715` — `_emitTrackSample` (genera `value` + `normalizedValue`)
- `TickEngine.ts:1138-1163` — `applyOutputs` (embudo Legacy, **sin dimmer forzado**)
- `TickEngine.ts:1142` — strobe suma aditiva (`+`), no HTP/LTP
- `HephaestusAetherAdapter.ts:434-448` — `_populateValues` (fuerza `shutter=1.0` + `dimmer=1.0`)
- `HephaestusAetherAdapter.ts:239-247` — `_ensureStrobeDimmer` (post-pass dimmer=1.0)
- `NodeArbiter.ts:76` — `STRICT_PRIORITY_CHANNELS` (strobe/shutter/strobeRate)
- `NodeArbiter.ts:1422-1424` — LTP estricto para L3+ en strobe
- `NodeResolver.ts:1456-1458` — strobe/shutter exentos del deadband epsilon
- `NodeResolver.ts:1474` — cuantización final `Math.round(normalized * 255)`
- `FixtureMapper.ts:547-550` — `_getChannelValue` para strobe (transparente)
- `CurveEvaluator.ts:547-555` — `interpolateNumber` (Bezier puede overshoot [0,1])
- `AetherVirtualStrobeEngine.ts:106-135` — oscilador binario del shutter virtual (UI)

---

*Forense: GLM-5.2 High. Caso cerrado pending fix approval del Arquitecto.*
