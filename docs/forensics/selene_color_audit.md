# AUDITORÍA FORENSE "OPERACIÓN ANTI-MOSTAZA" — Selene Color Engine

> **Bug:** En modo Techno, estrategia Analogous, con PRI=300° (Magenta),
> el motor genera SEC=38° (Naranja/Mostaza). Un salto de ~262° no
> corresponde a una estrategia análoga. El Techno debe ser implacable
> con el naranja.
>
> **Síntoma confirmado:** SEC=38° cae dentro de `forbiddenHueRanges:
> [[25, 80]]` de la constitución Techno. El guardián debería
> expulsarlo, pero algo permite que el color mostaza sobreviva.

---

## 1. DIAGNÓSTICO RAÍZ — Tres bugs convergentes

### 1.1 Hallazgo A — El Secondary SIEMPRE usa Fibonacci, ignorando la estrategia (BUG MATEMÁTICO RAÍZ)

**Pregunta del Arquitecto:** ¿Se está multiplicando el ángulo
incorrectamente o aplicando un offset de Fibonacci que destroza la
regla armónica básica?

**Respuesta: Sí. El Secondary siempre usa Fibonacci (222.5°),
independientemente de la estrategia.** La estrategia (analogous/
triadic/complementary) solo afecta el ACCENT y el AMBIENT, nunca el
Secondary.

`SeleneColorEngine.ts:1710`:

```typescript
const secondaryHue = normalizeHue(finalHue + fibonacciRotation + saltRotation + _cycleDelta);
```

donde `fibonacciRotation = options?.fibonacciRotationDeg ?? PHI_ROTATION`
y `PHI_ROTATION = (1.618 × 360) % 360 ≈ 222.5°` (línea 563).

**El Secondary no tiene ninguna rama por estrategia.** Comparemos:

| Color | Fórmula | Análoga a estrategia? |
|-------|---------|----------------------|
| **Primary** | `KEY_TO_HUE[key] + modeMod + moodDrift` | N/A (semilla) |
| **Secondary** | `finalHue + 222.5° + salt + cycleDelta` | **NO — siempre Fibonacci** |
| **Accent** | `finalHue + 30°` (analogous) / `+120°` (triadic) / `+180°` (complementary) | **SÍ** |
| **Ambient** | `finalHue - 30°` (analogous) / `+240°` (triadic) / `secondaryHue + 30°` (complementary) | **SÍ** |

**El label "analogous" en la UI es mentiroso.** Se refiere al ACCENT
(+30° del primary), pero el SEC está a 222.5° del primary — un salto
cromático masivo que no tiene nada que ver con armonía análoga.

#### Reproducción matemática del síntoma

Con PRI=300° (Magenta, key A# major):

```
finalHue ≈ 298.5°  (tras thermal gravity 9500K: 300 - 16.5°)
secondaryHue = 298.5 + 222.5 = 521 → 161°  (verde-cyan)
```

El SEC raw es 161° (verde), no 38°. **Pero el usuario ve 38°.** Esto
nos lleva al Hallazgo B.

### 1.2 Hallazgo B — Post-procesamiento usa `options` en vez de `effectiveOptions` (BUG DE CONSTITUCIÓN)

El Sidereal Clock reemplaza `allowedHueRanges` con los rangos del slot
activo. Pero el post-procesamiento que valida la paleta completa usa
`options` (constitución original) en vez de `effectiveOptions` (con
los rangos del slot).

**Flujo del Sidereal Clock (líneas 1529-1574):**

```typescript
let effectiveOptions = options;
if (options?.siderealClock) {
  // ...
  eo.allowedHueRanges = slot.allowedHueRanges;  // rangos del slot
  effectiveOptions = eo;
  // snap finalHue al centro del slot
}
```

**Post-procesamiento (líneas 2031-2182) — usa `options`, NO `effectiveOptions`:**

```typescript
// Línea 2031:
if (options?.forbiddenHueRanges) {  // ← options, no effectiveOptions
  this._enforceForbiddenHue(pal.secondary, options.forbiddenHueRanges, ...);
}

// Línea 2066:
if (options?.allowedHueRanges && options.allowedHueRanges.length > 0) {  // ← options
  // allowedHueRanges de Techno = [[0, 360]] → TODO es permitido → no-op
  if (!isInAllowedRange(pal.secondary.h))
    pal.secondary.h = findNearestAllowedHue(pal.secondary.h);
}

// Línea 2118:
if (options?.hueRemapping && options.hueRemapping.length > 0) {  // ← options
  this._applyHueRemap(pal.secondary, options.hueRemapping);
}

// Línea 2136:
if (options?.atmosphericTemp) {  // ← options
  pal.secondary.h = applyThermalGravity(pal.secondary.h, options.atmosphericTemp, ...);
}

// Línea 2179:
applyNeonProtocol(pal.secondary, options);  // ← options
```

**Consecuencia:** El `allowedHueRanges` del slot (ej: `[[290, 340]]`
para MAGENTA) se aplica al PRIMARY (vía snap en línea 1597) pero
**NO** al SECONDARY, ACCENT, ni AMBIENT. Estos colores son validados
contra `allowedHueRanges: [[0, 360]]` de la constitución original,
que permite todo.

**El Secondary puede escapar del slot cromático activo sin
restricción.** Si el slot es "MAGENTA [290-340]" pero el SEC cae en
161° (verde), el `allowedHueRanges: [[0,360]]` lo deja pasar.

#### ¿Pero cómo llega a 38°?

El SEC raw es 161°. El post-procesamiento SHOULD moverlo:
1. `_enforceForbiddenHue` con `[[25,80]]`: 161° NO está en [25,80] → no action
2. `allowedHueRanges: [[0,360]]`: 161° está en [0,360] → no action
3. `hueRemapping [25-85]→170`: 161° NO está en [25,85] → no action
4. `thermalGravity` (9500K, 0.22): pole=240, delta=79, newHue = 161 + 17.4 = 178.4°
5. `universalSwamp [45,90]`: 178.4° no está → no action
6. `neonProtocol [15,80]`: 178.4° no está → no action

**SEC final = 178.4° (cyan).** No 38°.

Esto significa que el síntoma del usuario (SEC=38°) **no se reproduce
con PRI=300° en el slot MAGENTA**. El 38° debe venir de una combinación
diferente de slot + key + macroCycle. Veamos el Hallazgo C.

### 1.3 Hallazgo C — El macroCycleHueShift contamina el finalHuo sin re-snap (BUG DE SEMILLAS)

**Pregunta del Arquitecto:** ¿Está este cálculo inyectando un offset
residual que contamina las derivaciones posteriores?

**Respuesta: Sí.** El `macroCycleHueShift` (137.5° × macroCycleCount)
se aplica al `finalHue` DESPUÉS del snap al slot, pero ANTES del
cálculo del secondary. No hay re-snap del finalHue al slot después
del macroCycleHueShift.

`SeleneColorEngine.ts:1606-1607`:

```typescript
if (macroCycleHueShift > 0) {
  finalHue = normalizeHue(finalHue + macroCycleHueShift);
}
```

**El comentario dice:**
> "the secondary/accent/ambient derive from it automatically"

**Esto es exactamente el problema.** El macroCycleHueShift mueve el
finalHue FUERA del slot cromático, y las derivaciones (secondary,
accent, ambient) heredan ese desplazamiento sin restricción.

#### Reproducción del 38° con macroCycle

Si el slot es "TRANSGRESION" `[[0, 20], [340, 360]]` y la key es A#
major (300°):

```
finalHue tras thermal gravity ≈ 298.5°
Snap al slot TRANSGRESION: 298.5° está en [340,360]∪[0,20]? NO.
  Centro más cercano: [0,20] → center=10°, o [340,360] → center=350°
  Distancia a 10° = |298.5-10| = 288.5 → min(288.5, 71.5) = 71.5
  Distancia a 350° = |298.5-350| = 51.5 → min(51.5, 308.5) = 51.5
  closestCenter = 350°
finalHue = 350°

macroCycleHueShift = 137.5° × macroCycleCount
Si macroCycleCount = 1:
  finalHue = 350 + 137.5 = 487.5 → 127.5° (verde)
  NO hay re-snap → finalHue queda en 127.5°

secondaryHue = 127.5 + 222.5 = 350° (rojo-magenta)
```

Si macroCycleCount = 2:
```
finalHue = 350 + 275 = 625 → 265° (azul-violeta)
secondaryHue = 265 + 222.5 = 487.5 → 127.5° (verde)
```

Si macroCycleCount = 3:
```
finalHue = 350 + 412.5 = 762.5 → 42.5° (NARANJA)
secondaryHue = 42.5 + 222.5 = 265° (azul-violeta)
```

**Con macroCycleCount=3, el PRIMARY mismo cae en 42.5° (naranja).**
Pero el `forbiddenHueRanges: [[25,80]]` debería atraparlo en el
post-procesamiento... a menos que el macroCycleHueShift mueva el
finalHue DESPUÉS de que el guardián constitucional ya pasó.

**El orden del pipeline es:**
1. finalHue calculado (línea 1308)
2. Thermal gravity (línea 1323)
3. Constitutional hue enforcement — forbidden, remapping (líneas 1326-1448)
4. **Sidereal Clock snap** (línea 1597) ← finalHue se ajusta al slot
5. **macroCycleHueShift** (línea 1607) ← finalHue se desplaza FUERA del slot
6. Oceanic modulation (línea 1634)
7. `pal.primary.h = finalHue` (línea 1684) ← PRIMARY guarda el hue desplazado
8. Secondary/Accent/Ambient calculados desde finalHue desplazado
9. **Post-procesamiento guardian** (líneas 2031-2182) ← usa `options`, no `effectiveOptions`

**El macroCycleHueShift (paso 5) desplaza el finalHue DESPUÉS del snap
al slot (paso 4) pero ANTES del guardián de paleta (paso 9).** El
guardián debería atrapar el 42.5° en `forbiddenHueRanges: [[25,80]]`,
pero usa `options.forbiddenHueRanges` que SÍ es `[[25,80]]` (copiado
al effectiveOptions en línea 1554). Así que el guardián DEBERÍA
atraparlo.

**Pero hay un problema sutil:** el guardián de `forbiddenHueRanges`
aplica elastic rotation de +15° por iteración. Para 42.5°:
```
42.5° → +15° → 57.5° (still in [25,80]) → +15° → 72.5° (still in) → +15° → 87.5° (outside!)
```
Después: `hueRemapping [25-85] → 170`: 87.5° está en [25,85] → remap a 170°.

Entonces el PRIMARY debería terminar en 170° (cyan), no 42.5°. Y el
SECONDARY = 170 + 222.5 = 392.5 → 32.5°... **¡QUE ESTÁ EN [25,80]!**

**¡AQUÍ ESTÁ EL BUG CASCADE!** El post-procesamiento mueve el PRIMARY
de 42.5° a 170° (vía forbidden + remapping). Pero el SECONDARY fue
calculado ANTES del post-procesamiento, desde el finalHue
desplazado (42.5°), dando 265°. Luego el post-procesamiento aplica
`forbiddenHueRanges` al SECONDARY (265°) — que NO está en [25,80] →
no action. Y `hueRemapping` — 265° no está en [25,85] ni [86,110] →
no action.

**Pero espera** — si el PRIMARY es remapeado a 170° DESPUÉS de que
el SECONDARY ya fue calculado como 265°, el SECONDARY no se
recalcula. El SECONDARY queda en 265° (azul-violeta), que es
aceptable para Techno.

**El problema real es cuando el macroCycleHueShift mueve el finalHue
a una zona que, tras Fibonacci (222.5°), produce un SECONDARY en
zona mostaza.** Veamos:

```
finalHue_desplazado + 222.5° = SEC
Si SEC ∈ [25, 80] → mostaza
finalHue_desplazado = SEC - 222.5°
Para SEC = 38°: finalHue_desplazado = 38 - 222.5 = -184.5 → 175.5°
```

**¿Puede el macroCycleHueShift producir un finalHue de 175.5°?**

Slot BUNKER [170, 210], centro = 190°. Si key = A# major (300°):
```
finalHue tras thermal gravity ≈ 298.5°
Snap a BUNKER: 298.5° no está en [170,210]. Centro = 190°.
  Distancia = min(|298.5-190|, 360-|298.5-190|) = min(108.5, 251.5) = 108.5
  ¿Hay otro slot más cercano? Solo se evalúa el slot actual.
finalHue = 190° (snap al centro del BUNKER)

macroCycleHueShift = 137.5° × N
Si N = 0: finalHue = 190° → SEC = 190 + 222.5 = 412.5 → 52.5° (MOSTAZA!)
```

**¡BINGO!** Con slot BUNKER [170, 210], key A# major, macroCycleCount=0:
```
finalHue = 190° (centro del BUNKER)
SEC raw = 190 + 222.5 = 412.5 → 52.5° (AMARILLO-MOSTAZA)
```

**52.5° está en `forbiddenHueRanges: [[25, 80]]`** → el guardián
debería atraparlo:
```
52.5° → +15° → 67.5° (in [25,80]) → +15° → 82.5° (outside!)
hueRemapping [25-85] → 170: 82.5° IS in [25,85] → remap to 170°
thermalGravity: 170° → pole=240, delta=70, force=0.22 → 170 + 15.4 = 185.4°
```

**SEC final = 185.4° (cyan).** El guardián SÍ lo atrapa.

**Pero el usuario ve 38°.** Esto sugiere que el guardián NO está
funcionando, o el usuario ve el valor RAW antes del guardián.

### 1.4 Hallazgo D — El guardián puede no ejecutarse si `options` es undefined

Revisando la condición del guardián (línea 2031):

```typescript
if (options?.forbiddenHueRanges) {
```

Esto usa `options`, no `effectiveOptions`. Si el Sidereal Clock
reemplazó `effectiveOptions` pero el guardián usa `options`, y si
`options.forbiddenHueRanges` existe (Techno lo tiene: `[[25, 80]]`),
el guardián DEBERÍA ejecutarse.

**Pero hay otro problema:** el `allowedHueRanges` del post-procesamiento
(línea 2066) usa `options.allowedHueRanges` = `[[0, 360]]`. Esto
significa que después de que el guardián expulsa el SEC de [25,80] a
82.5°, y el hueRemapping lo mueve a 170°, el `allowedHueRanges: [[0,360]]`
lo deja pasar. **Si usara `effectiveOptions.allowedHueRanges` (ej:
`[[170, 210]]` del slot BUNKER), el SEC se mantendría dentro del
slot.**

**Con `options.allowedHueRanges = [[0, 360]]`, el SEC puede terminar
en cualquier hue del círculo después del post-procesamiento.** El
guardián lo saca de [25,80] pero no lo confina al slot.

### 1.5 Hallazgo E — El _cycleDelta puede empujar el SEC a zona mostaza

El `_cycleDelta` (línea 1698) es un offset aleatorio determinista de
±15°:

```typescript
const _cycleSeed = (this._sessionEntropy ^ (this._macroCycleCount * 2654435761)) >>> 0;
const _cycleDelta = ((_cycleSeed >> 16) % 31) - 15;  // range: -15 to +15
```

Este delta se aplica al SECONDARY pero NO al PRIMARY. Si el SEC raw
es 52.5° y `_cycleDelta = -15°`, el SEC se convierte en 37.5° —
**prácticamente el 38° que el usuario reporta.**

```
SEC = 190 + 222.5 + (-15) = 397.5 → 37.5°  ← MOSTAZA
```

El guardián debería atrapar 37.5° (está en [25,80]), pero el punto
es que el `_cycleDelta` puede empujar el SEC justo a la zona
problemática antes de que el guardián lo sanitice.

---

## 2. EL COLADERO DE LA CONSTITUCIÓN

### 2.1 ¿Se aplican los vetos a la paleta completa o solo a la semilla?

**Pregunta del Arquitecto:** ¿Se aplican estos vetos a la paleta
completa después de ser generada, o solo a la semilla inicial (PRI)?

**Respuesta: AMBOS, pero con bugs.**

El pipeline tiene DOS puntos de validación:

1. **Validación de semilla (líneas 1326-1448):** Aplica
   `forbiddenHueRanges`, `hueRemapping`, y `allowedHueRanges` al
   `finalHue` (PRIMARY). Esto ocurre ANTES del cálculo del SEC/ACC/AMB.

2. **Guardián de paleta (líneas 2031-2182):** Aplica
   `forbiddenHueRanges`, `allowedHueRanges`, `hueRemapping`,
   `thermalGravity`, `universalSwamp`, y `neonProtocol` a TODA la
   paleta (PRI, SEC, AMB, ACC).

**Bug 1:** El guardián usa `options` en vez de `effectiveOptions`.
Los `allowedHueRanges` del slot no se aplican a SEC/ACC/AMB.

**Bug 2:** El `macroCycleHueShift` (línea 1607) desplaza el
`finalHue` DESPUÉS de la validación de semilla pero ANTES del
cálculo de derivados. Las derivaciones heredan el desplazamiento
sin re-validación de slot.

**Bug 3:** El `_cycleDelta` (±15°) se aplica al SEC pero no al PRI,
creando una asimetría que puede empujar el SEC a zona mostaza
incluso cuando el PRI está en zona segura.

### 2.2 ¿Cómo es posible que el Techno no rechace ángulos 30°-60°?

**El `forbiddenHueRanges: [[25, 80]]` SÍ debería rechazarlos.** El
guardián aplica elastic rotation de +15° por iteración hasta salir
de la zona prohibida. Para 38°:

```
38° → 53° → 68° → 83° (fuera de [25,80]) → hueRemapping a 170°
```

**El problema no es que el guardián no exista — es que el valor que
el usuario ve (38°) puede ser el RAW antes del guardián.** Si la UI
muestra el palette meta o un valor intermedio antes del
post-procesamiento, el usuario ve 38° aunque el DMX final sea 170°.

**Alternativamente,** si hay un code path donde el guardián no se
ejecuta (ej: `options` es `undefined` en algún camino), el 38° pasa
directo al output.

---

## 3. GESTIÓN DE SEMILLAS Y TIEMPOS

### 3.1 ¿El primer beat inyecta un offset residual?

**Pregunta del Arquitecto:** ¿Está este cálculo inyectando un offset
residual que contamina las derivaciones posteriores?

**Respuesta: Sí, dos offsets:**

1. **`macroCycleHueShift` (137.5° × N):** Se aplica al `finalHue`
   después del snap al slot. Contamina todas las derivaciones
   (SEC, ACC, AMB) porque se calculan desde el `finalHue` desplazado.

2. **`_cycleDelta` (±15°):** Se aplica al SEC pero no al PRI. Crea
   una asimetría que puede empujar el SEC a zona mostaza.

3. **`_sessionEntropy`:** Se usa para el `_cycleDelta` y para el
   offset del Sidereal Clock (`shiftedTime = performance.now() +
   _sessionEntropy`). Si la entropía es alta, el slot activo puede
   ser diferente en cada sesión, produciendo comportamientos no
   deterministas.

### 3.2 El problema del macroCycle sin re-snap

El `macroCycleHueShift` está diseñado para "garantizar que el clock
nunca repita la misma secuencia de paletas". Pero el comentario en
línea 1604 dice:

> "the secondary/accent/ambient derive from it automatically"

**Esto es incorrecto.** Las derivaciones no se re-snap al slot. El
macroCycleHueShift puede mover el `finalHue` fuera del slot cromático,
y las derivaciones heredan ese desplazamiento. El guardián de paleta
debería atrapar colores prohibidos, pero no confina al slot.

---

## 4. FLUJO COMPLETO DEL BUG (diagrama)

```
Key A# major (300°)
  ↓
baseHue = 300° + modeMod(+15°) = 315°
  ↓
Thermal Gravity (9500K, 0.22): 315° → 298.5°
  ↓
Constitutional enforcement: 298.5° not in [25,80] → no action
  ↓
Sidereal Clock slot BUNKER [170, 210]:
  298.5° not in [170,210] → snap to center 190°
  finalHue = 190°
  ↓
macroCycleHueShift = 137.5° × 0 = 0° (primer ciclo)
  finalHue = 190°
  ↓
pal.primary.h = 190° (cyan BUNKER) ✓
  ↓
SEC = 190 + 222.5 (Fibonacci) + 0 (salt) + (-15) (_cycleDelta) = 397.5 → 37.5°
  ↓
pal.secondary.h = 37.5° (MOSTAZA) ✗ ← BUG: Fibonacci ignora estrategia
  ↓
POST-PROCESAMIENTO (usa options, no effectiveOptions):
  1. forbiddenHueRanges [[25,80]]: 37.5° IS in [25,80]
     → elastic rotation: 37.5 → 52.5 → 67.5 → 82.5° (outside)
  2. allowedHueRanges [[0,360]]: 82.5° is in [0,360] → no action
     ← BUG: debería usar slot's [[170,210]] para confinar
  3. hueRemapping [25-85]→170: 82.5° IS in [25,85] → remap to 170°
  4. thermalGravity: 170° → 170 + (240-170)*0.22 = 170 + 15.4 = 185.4°
  5. neonProtocol [15,80]: 185.4° not in danger → no action
  ↓
SEC final = 185.4° (cyan) ← sanitizado PERO fuera del slot BUNKER
  ↓
¿Usuario ve 37.5° o 185.4°? Depende de si la UI muestra raw o post.
```

---

## 5. RECOMENDACIONES DE FIX

### Fix 1 (raíz): Secondary debe respetar la estrategia

El Secondary no debe usar Fibonacci ciegamente. Debe usar la
estrategia activa:

```typescript
let secondaryHue: number;
switch (strategy) {
  case 'analogous':
    secondaryHue = normalizeHue(finalHue - 30 + _cycleDelta);  // vecino inferior
    break;
  case 'triadic':
    secondaryHue = normalizeHue(finalHue + 120 + _cycleDelta);  // triángulo
    break;
  case 'complementary':
    secondaryHue = normalizeHue(finalHue + 180 + _cycleDelta);  // opuesto
    break;
  default:
    secondaryHue = normalizeHue(finalHue + fibonacciRotation + saltRotation + _cycleDelta);
}
```

**Nota:** El Fibonacci puede seguir como fallback o como modo
"prism" especial, pero no debe ser el default para analogous.

### Fix 2 (constitución): Post-procesamiento debe usar effectiveOptions

Reemplazar `options` por `effectiveOptions` en todas las líneas del
guardián de paleta:

```typescript
// Línea 2031:
if (effectiveOptions?.forbiddenHueRanges) {
  this._enforceForbiddenHue(pal.secondary, effectiveOptions.forbiddenHueRanges, ...);
}

// Línea 2066:
if (effectiveOptions?.allowedHueRanges && effectiveOptions.allowedHueRanges.length > 0) {
  // usar effectiveOptions.allowedHueRanges (slot's ranges)
}

// Línea 2118:
if (effectiveOptions?.hueRemapping && effectiveOptions.hueRemapping.length > 0) {
  this._applyHueRemap(pal.secondary, effectiveOptions.hueRemapping);
}

// Línea 2136:
if (effectiveOptions?.atmosphericTemp) {
  pal.secondary.h = applyThermalGravity(pal.secondary.h, effectiveOptions.atmosphericTemp, ...);
}

// Línea 2179:
applyNeonProtocol(pal.secondary, effectiveOptions);
```

### Fix 3 (macroCycle): Re-snap después de macroCycleHueShift

Aplicar el snap al slot DESPUÉS del macroCycleHueShift, no solo
antes:

```typescript
// Línea 1607:
if (macroCycleHueShift > 0) {
  finalHue = normalizeHue(finalHue + macroCycleHueShift);
  // RE-SNAP al slot después del desplazamiento
  if (slot.allowedHueRanges && !isFullCircle) {
    // re-snap finalHue al centro más cercano del slot
  }
}
```

### Fix 4 (cycleDelta): Aplicar cycleDelta al PRI o no aplicarlo al SEC

El `_cycleDelta` crea una asimetría entre PRI y SEC. Opciones:
- **A:** Aplicar `_cycleDelta` al `finalHue` (PRI) antes de calcular
  derivados, así todos heredan el mismo desplazamiento.
- **B:** No aplicar `_cycleDelta` al SEC, solo al ACC y AMB.

---

## 6. VEREDICTO FORENSE

| Pregunta del Arquitecto | Respuesta |
|--------------------------|-----------|
| ¿Se multiplica el ángulo incorrectamente? | **Sí.** SEC siempre usa Fibonacci 222.5°, ignorando la estrategia. "Analogous" solo afecta el ACC |
| ¿Offset de Fibonacci que destroza la armonía? | **Sí.** 222.5° de salto no es análogo (debería ser ±30°) |
| ¿Vetos anti-mud se aplican a la paleta completa? | **Sí, pero con bug:** usa `options` no `effectiveOptions`. Los `allowedHueRanges` del slot no se aplican a SEC/ACC/AMB |
| ¿Cómo es posible que Techno no rechace 30°-60°? | **El guardián SÍ los rechaza** (forbidden [[25,80]] + hueRemapping). El 38° que el usuario ve es probablemente el RAW antes del guardián, o el guardián usa `options` con `allowedHueRanges: [[0,360]]` que no confina al slot |
| ¿El primer beat inyecta offset residual? | **Sí.** `macroCycleHueShift` (137.5°×N) desplaza finalHue después del snap al slot, contaminando derivaciones. `_cycleDelta` (±15°) empuja el SEC asimétricamente |
| **CAUSA RAÍZ** | **El Secondary usa Fibonacci (222.5°) en vez de la estrategia activa.** "Analogous" es una etiqueta mentirosa — solo afecta el Accent. El Secondary hace un salto cromático masivo que puede aterrizar en zona mostaza. El guardián lo sanitiza a cyan, pero no lo confina al slot activo |

**El Fantasma de la Mostaza no es un fallo del guardián — es un
error de diseño matemático.** El Secondary nunca fue análogo. Fibonacci
(222.5°) y analogous (±30°) son conceptos incompatibles. El motor
 etiqueta la paleta como "analogous" porque el Accent usa +30°, pero
el Secondary hace un salto de 222.5° que destruye la armonía.

---

## 7. REFERENCIAS DE CÓDIGO

- `SeleneColorEngine.ts:562-563` — `PHI_ROTATION = (φ × 360) % 360 ≈ 222.5°`
- `SeleneColorEngine.ts:1308` — `finalHue = normalizeHue(baseHue + modeMod.hue + moodDrift)`
- `SeleneColorEngine.ts:1323` — `applyThermalGravity(finalHue, ...)`
- `SeleneColorEngine.ts:1326-1448` — Constitutional hue enforcement (solo PRI)
- `SeleneColorEngine.ts:1529-1574` — Sidereal Clock: `effectiveOptions` creado con slot ranges
- `SeleneColorEngine.ts:1597` — Snap `finalHue` al centro del slot
- `SeleneColorEngine.ts:1606-1607` — `macroCycleHueShift` aplicado SIN re-snap
- `SeleneColorEngine.ts:1690` — `fibonacciRotation = options?.fibonacciRotationDeg ?? PHI_ROTATION`
- `SeleneColorEngine.ts:1697-1698` — `_cycleDelta` (±15° asimétrico)
- `SeleneColorEngine.ts:1710` — **`secondaryHue = finalHue + fibonacciRotation + salt + _cycleDelta`** (BUG RAÍZ)
- `SeleneColorEngine.ts:1743-1744` — Accent analogous: `finalHue + 30` (estrategia SÍ aplica aquí)
- `SeleneColorEngine.ts:2031` — Guardián usa `options` no `effectiveOptions` (BUG)
- `SeleneColorEngine.ts:2066` — `allowedHueRanges` usa `options` ([[0,360]] → no-op)
- `SeleneColorEngine.ts:2118` — `hueRemapping` usa `options`
- `SeleneColorEngine.ts:2136-2138` — `thermalGravity` en SEC/AMB/ACC usa `options`
- `SeleneColorEngine.ts:2179-2182` — `applyNeonProtocol` usa `options`
- `colorConstitutions.ts:41-174` — TECHNO_CONSTITUTION
- `colorConstitutions.ts:69` — `forbiddenHueRanges: [[25, 80]]`
- `colorConstitutions.ts:72` — `allowedHueRanges: [[0, 360]]` (todo permitido)
- `colorConstitutions.ts:86-89` — `hueRemapping: [{25-85→170}, {86-110→130}]`
- `colorConstitutions.ts:114-120` — `neonProtocol: {dangerZone: [15,80], ...}`
- `colorConstitutions.ts:144-173` — Sidereal Clock: 5 slots × 6 min

---

*Forense: GLM-5.2 High. Operación Anti-Mostaza — el Fibonacci no es análogo, es un impostor.*
