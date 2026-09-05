# AUDITORÍA FORENSE "CROMATISMO" — HAL Color Translator

> **Bug:** El usuario solicita azul puro RGB(14,118,170) → el motor
> selecciona CTB/Cool White RGB(200,220,255) en vez de Blue RGB(0,0,255).
> Naranja RGB(177,50,10) → selecciona CTO/Warm White RGB(255,200,150)
> en vez de Orange RGB(255,128,0).
>
> **Sospecha del Arquitecto:** El algoritmo de proximidad usa distancia
> Euclidiana en RGB. **Veredicto: peor que eso** — usa HSL hue-only,
> ignorando saturación y luminosidad completamente.

---

## 1. DIAGNÓSTICO RAÍZ — El Ojo Matemático está tuerto

### 1.1 Hallazgo A — El header miente: NO usa CIE76

El header del archivo (líneas 8-27) declara:

```
WAVE 2096.1: REWRITE — CIE L*a*b* perceptual distance
Wheel matching now uses CIE76 ΔE* (perceptually uniform)
```

**Esto es falso para el matching de rueda.** Las funciones CIE76
(`rgbToLab`, `deltaE76`, `xyzToLab`) existen en el archivo pero **solo
se usan en dos sitios**:

1. `debugDistances()` (línea 569) — método de debugging, no hot path.
2. `getCacheKey()` (línea 505) — cuantización para cache LRU, no matching.

El matching real ocurre en `findNearestColorLab()` (línea 390), que
**ignora completamente CIE76** y usa **HSL hue circular distance**.

### 1.2 Hallazgo B — El algoritmo real: HSL hue-only

`findNearestColorLab()` (líneas 390-498) hace lo siguiente:

```typescript
// 1. Convertir target a HSL
const targetHsl = rgbToHsl(target)
const targetIsChromatic = targetHsl.s > 0.15

// 2. Si target es neutro (s < 0.15): devolver slot Open/White
if (!targetIsChromatic) { ... return openSlot }

// 3. Golden Snap: si hue 35-55°, forzar Amber/Gold/CTO/Orange
if (targetHsl.h >= 35 && targetHsl.h <= 55) { ... }

// 4. Para cada slot: calcular hueDiff = circularHueDiff(target.h, slot.h)
//    Slots neutros (s < 0.15): hueDiff = 180° (penalización máxima)
for (let i = 0; i < wheel.colors.length; i++) {
  const slotHsl = rgbToHsl(wheel.colors[i].rgb)
  const slotIsChromatic = slotHsl.s > 0.15
  const hueDiff = slotIsChromatic
    ? circularHueDiff(targetHsl.h, slotHsl.h)  // ← SOLO hue
    : 180
  // ... track nearest + second nearest
}
```

**La métrica de distancia es:**

```
d(target, slot) = |hue_target - hue_slot|  (circular, 0-180°)
```

**No hay ningún término de saturación (S) ni luminosidad (L).** Dos
colores con el mismo hue pero luminosidad radicalmente diferente
(ej: Blue L=0.5 vs CTB L=0.89) tienen distancia **0°** si sus hues
coinciden.

### 1.3 Hallazgo C — Reproducción matemática del bug

#### Caso 1: Azul RGB(14, 118, 170) → selecciona CTB, no Blue

| Color | RGB | HSL | Hue diff al target |
|-------|-----|-----|---------------------|
| **Target** | (14, 118, 170) | h=203°, s=0.85, l=0.36 | — |
| **Blue** (0,0,255) | (0, 0, 255) | h=240°, s=1.0, l=0.5 | **37°** |
| **CTB** (200,220,255) | (200, 220, 255) | h=220°, s=1.0, l=0.89 | **17°** |

```
circularHueDiff(203, 240) = 37°
circularHueDiff(203, 220) = 17°  ← GANA CTB
```

**CTB gana porque su hue (220°) está más cerca del target (203°) que
el Blue puro (240°).** La luminosidad absurdamente diferente
(L=0.89 vs L=0.36) es invisible para el algoritmo.

#### Caso 2: Naranja RGB(177, 50, 10) → selecciona CTO, no Orange

| Color | RGB | HSL | Hue diff al target |
|-------|-----|-----|---------------------|
| **Target** | (177, 50, 10) | h=16°, s=0.94, l=0.37 | — |
| **Orange** (255,128,0) | (255, 128, 0) | h=30°, s=1.0, l=0.5 | **14°** |
| **CTO** (255,200,150) | (255, 200, 150) | h=25°, s=1.0, l=0.79 | **9°** |

```
circularHueDiff(16, 30) = 14°
circularHueDiff(16, 25) = 9°  ← GANA CTO
```

**CTO gana porque su hue (25°) está más cerca del target (16°) que
el Orange (30°).** De nuevo, L=0.79 vs L=0.37 es ignorado.

#### El Golden Snap no rescata esto

El Golden Snap (línea 422) fuerza Amber/Gold/CTO/Orange cuando
`targetHsl.h >= 35 && targetHsl.h <= 55`. El target naranja tiene
h=16°, **por debajo del umbral de 35°**, así que el Golden Snap no
se dispara. Y aunque se disparara, su lista de nombres incluye
`'CTO'` junto a `'Orange'` — el `find()` retornaría el primero que
aparezca en la rueda, que podría ser CTO.

---

## 2. RESOLUCIÓN DE DUPLICADOS — El Problema Mecánico

### 2.1 Hallazgo D — No hay pathfinding mecánico

**Pregunta del Arquitecto:** ¿Existe un algoritmo de Shortest Path
que decida ir al DMX 31 o 141 para girar la menor cantidad de grados?

**Respuesta: No.** El algoritmo itera desde el índice 0 y mantiene el
primer match con el menor `hueDiff`. Si Magenta aparece en DMX 31
(índice N) y DMX 141 (índice M > N), el primero (DMX 31) gana siempre
porque el loop `for` procesa en orden y solo actualiza cuando
`hueDiff < smallestHueDiff` (estrictamente menor). Un duplicado con
hueDiff igual **no desplaza** al primero.

```typescript
if (hueDiff < smallestHueDiff) {        // ← estríctamente menor
  secondSmallestHueDiff = smallestHueDiff
  secondNearestIndex = nearestIndex
  smallestHueDiff = hueDiff
  nearestIndex = i
} else if (hueDiff < secondSmallestHueDiff) {
  secondSmallestHueDiff = hueDiff
  secondNearestIndex = i
}
```

**No hay tracking de `currentWheelDmx` ni cálculo de distancia
mecánica.** El algoritmo no sabe dónde está la rueda ahora mismo.

### 2.2 Hallazgo E — DarkSpin calcula distancia pero no la usa para elegir

El `AetherSafetyMiddleware.checkDarkSpin()` (líneas 381-441) sí
calcula `dmxDistance`:

```typescript
const rawDelta = Math.abs(currentWheelDmx - s.lastStableWheelDmx)
const dmxDistance = allowsContinuousSpin
  ? Math.min(rawDelta, 256 - rawDelta)  // ← shortest path circular
  : rawDelta
```

Pero esto es **solo para calcular el tiempo de blackout** (tránsito
mecánico), no para elegir qué DMX destino usar. El DMX destino ya
fue decidido por `findNearestColorLab()` antes de llegar al
DarkSpin. DarkSpin acepta lo que le dan.

### 2.3 Consecuencia práctica de los duplicados

Si la rueda está en DMX 141 (Magenta duplicado) y el usuario pide
Magenta, el motor selecciona DMX 31 (primer match). La rueda gira
**110 pasos** hacia atrás cuando podría haberse quedado en 141
(0 pasos). El DarkSpin aplica blackout por `110 × 4ms + 150ms = 590ms`
cuando el tránsito real sería 0ms.

---

## 3. FÓRMULAS MATEMÁTICAS EMPLEADAS

### 3.1 Métrica de distancia actual (HSL hue-only)

```
d(target, slot) = |hue_target - hue_slot|_circular
```

donde `|·|_circular` es la diferencia circular en [0, 180°]:

```
|Δh|_circular = min(|h1 - h2| mod 360, 360 - |h1 - h2| mod 360)
```

**Penalización para slots neutros:** d = 180° (constante).

**Ignora:** saturación (S), luminosidad (L), y toda información
cromática no-hue.

### 3.2 Métrica declarada pero NO usada (CIE76 ΔE*)

```
ΔE*ab = √((ΔL*)² + (Δa*)² + (Δb*)²)
```

con RGB → XYZ → Lab:

```
sRGB → linear:  c_linear = (c/255 ≤ 0.04045) ? c/255/12.92 : ((c/255+0.055)/1.055)^2.4
XYZ = M_sRGB × [R_linear, G_linear, B_linear]
Lab:  L = 116·f(Y/Yn) - 16,  a = 500·(f(X/Xn) - f(Y/Yn)),  b = 200·(f(Y/Yn) - f(Z/Zn))
```

Esta métrica **sí** capturaría la diferencia de luminosidad entre
Blue (L≈32) y CTB (L≈88), dándole a Blue una distancia mucho menor
al target (L≈40) que a CTB.

### 3.3 Interpolación de half-color (líneas 470-488)

Cuando el target cae entre dos slots adyacentes (hue diff > 3° y
segundo más cercano < 45°), el DMX se interpola linealmente:

```
t = smallestHueDiff / (smallestHueDiff + secondSmallestHueDiff)
interpolatedDmx = round(slot1.dmx + (slot2.dmx - slot1.dmx) × t)
```

**Problema:** Esta interpolación asume que los DMX están en orden
angular. Si hay duplicados o slots no adyacentes en la rueda física,
la interpolación puede saltar a posiciones mecánicamente lejanas.

### 3.4 Golden Snap (líneas 422-436)

```
if (target.h ∈ [35°, 55°]) → forzar slot con name ∈ {'Amber','Gold','CTO','Orange'}
```

**Problemas:**
- Umbral demasiado estrecho: naranjas rojizos (h < 35°) no se
  benefician.
- La lista mezcla CTO (warm white, L alto) con Orange (L medio) —
  `find()` retorna el primero que aparece en el array, no el más
  saturado.

---

## 4. POR QUÉ EL ALGORITMO ACTUAL FALLA

### 4.1 HSL hue-only es incorrecto para ruedas con CTB/CTO

El comentario del método (líneas 376-388) justifica el cambio a
hue-only:

> "El matching por ΔE LAB fallaba porque Blue puro (0,0,255) en Lab
> está muy lejos de un azul marino (5,114,182) — el algoritmo elegía
> White como 'más cercano'."

**Este razonamiento es correcto para el caso Blue→White, pero
catastrófico para Blue→CTB.** El hue-only resuelve el problema
"azul marino vs blanco puro" pero introduce el problema inverso:
"azul marino vs azul cielo (CTB)". Ambos tienen hue similar, pero
el CTB es un blanco azulado (L alto, S bajo en realidad), no un
azul saturado.

### 4.2 El umbral de saturación s > 0.15 es demasiado bajo

CTB RGB(200,220,255) tiene HSL s≈1.0 (en la fórmula HSL estándar).
Pero perceptualmente es un blanco teñido, no un color saturado.
El umbral `s > 0.15` lo clasifica como "cromático" y lo deja
competir con colores verdaderamente saturados.

**El problema es que HSL saturación no correlaciona con saturación
perceptual.** Un color con S_HSL = 1.0 puede ser un blanco teñido
(CTB) o un azul profundo (Blue) — HSL no distingue.

### 4.3 CIE76 habría funcionado mejor

Calculemos CIE76 para el caso del azul:

| Color | L* | a* | b* | ΔE* al target |
|-------|----|----|----|----------------|
| **Target** (14,118,170) | ~42 | ~-8 | ~-37 | — |
| **Blue** (0,0,255) | ~32 | ~79 | ~-107 | ~77 |
| **CTB** (200,220,255) | ~88 | ~-6 | ~-12 | ~50 |

**CTB sigue ganando en CIE76 puro** (ΔE*=50 vs 77). Esto confirma
que el comentario original del WAVE 3456 tenía razón: CIE76 puro
también falla para este caso.

### 4.4 La solución correcta: CIE76 con peso de saturación

La métrica ideal para ruedas mecánicas debe combinar:

1. **Hue circular** (para no penalizar diferencias de
   luminosidad que el dimmer controla).
2. **Saturación** (para distinguir Blue de CTB — ambos tienen
   hue similar pero S muy diferente en términos perceptuales).
3. **Penalización a slots neutros** cuando el target es saturado.

Una fórmula candidata:

```
if (target_cromático && slot_neutro_perceptual):
    d = 180°  (penalización máxima)
else:
    d = w_hue × circularHueDiff(h_target, h_slot)
      + w_sat × |S_perceptual_target - S_perceptual_slot|
      + w_light × |L_target - L_slot| × light_penalty_factor
```

donde `S_perceptual` podría ser CIE chroma `C* = √(a*² + b*²)` en
vez de HSL saturation, que sí distingue CTB (C*≈13) de Blue
(C*≈133).

---

## 5. RECOMENDACIONES DE FIX

### Opción A (mínima, V1.0): HSL hue + saturación HSL

Añadir un término de saturación a la distancia:

```typescript
const hueDiff = slotIsChromatic
  ? circularHueDiff(targetHsl.h, slotHsl.h) +
    Math.abs(targetHsl.s - slotHsl.s) * 60  // peso de saturación
  : 180
```

El factor `×60` convierte la diferencia de saturación (0-1) a
grados comparables con hue (0-180°). Con esto:

- Blue (s=1.0) vs target (s=0.85): satDiff = 0.15 × 60 = 9°
  → total = 37 + 9 = 46°
- CTB (s=1.0) vs target (s=0.85): satDiff = 0.15 × 60 = 9°
  → total = 17 + 9 = 26°

**CTB seguiría ganando** porque HSL saturation no distingue CTB de
Blue. Esta opción no resuelve el problema fundamental.

### Opción B (media, recomendada): HSL hue + CIE chroma

Usar hue circular para el matiz, pero CIE chroma `C*` para la
saturación perceptual:

```typescript
const targetLab = rgbToLab(target)
const slotLab = rgbToLab(slot.rgb)
const targetChroma = Math.sqrt(targetLab.a ** 2 + targetLab.b ** 2)
const slotChroma = Math.sqrt(slotLab.a ** 2 + slotLab.b ** 2)

const hueDiff = slotIsChromatic
  ? circularHueDiff(targetHsl.h, slotHsl.h) +
    Math.abs(targetChroma - slotChroma) * 0.5  // peso de chroma
  : 180
```

Con esto:

- Blue (C*≈133) vs target (C*≈38): chromaDiff = 95 × 0.5 = 47.5
  → total = 37 + 47.5 = 84.5
- CTB (C*≈13) vs target (C*≈38): chromaDiff = 25 × 0.5 = 12.5
  → total = 17 + 12.5 = 29.5

**CTB seguiría ganando** porque el target tiene chroma baja (es un
azul oscuro, no saturado). El problema es que el target
RGB(14,118,170) es perceptualmente más cercano a CTB que a Blue
puro en términos de chroma.

**Esto revela la verdad incómoda:** el target RGB(14,118,170) es un
azul marino oscuro, no un azul saturado. Blue puro (0,0,255) es
demasiado saturado y brillante. El motor está haciendo lo
matemáticamente correcto al elegir CTB — el problema es que el
usuario **quiere** el Blue de la rueda aunque sea perceptualmente
menos cercano.

### Opción C (arquitectónica): Hue-primary con veto de chroma

La solución correcta para ruedas mecánicas es **hue-primary**: el
hue es lo único que la rueda controla. Pero con un **veto de
chroma** para evitar que slots blancos teñidos (CTB/CTO) compitan
con slots saturados:

```typescript
// Clasificar slots como "saturado" o "teñido" usando CIE chroma
const SLOT_CHROMA_THRESHOLD = 30  // C* < 30 = blanco teñido
const slotChroma = Math.sqrt(slotLab.a ** 2 + slotLab.b ** 2)
const slotIsTintedWhite = slotChroma < SLOT_CHROMA_THRESHOLD

// Si el target es cromático y el slot es blanco teñido: veto
const hueDiff = (targetIsChromatic && slotIsTintedWhite)
  ? 180  // veto total — blancos teñidos no compiten con cromáticos
  : slotIsChromatic
    ? circularHueDiff(targetHsl.h, slotHsl.h)
    : 180
```

Con esto:

- Blue (C*≈133, saturado) vs target: hueDiff = 37° ← **compite**
- CTB (C*≈13, teñido) vs target: hueDiff = 180° ← **VETO**
- Orange (C*≈133, saturado) vs target: hueDiff = 14° ← **compite**
- CTO (C*≈20, teñido) vs target: hueDiff = 180° ← **VETO**

**Blue gana. Orange gana.** Los blancos teñidos (CTB/CTO) quedan
excluidos de la competencia cuando el target es cromático.

### Opción D (pathfinding mecánico para duplicados)

Añadir tracking de `currentWheelDmx` al `ColorTranslator`:

```typescript
private currentWheelDmx = new Map<string, number>()  // profileId → last DMX

// En findNearestColorLab, después de encontrar el nearest:
const duplicates = wheel.colors.filter(c => c.name === finalColor.name)
if (duplicates.length > 1) {
  const currentDmx = this.currentWheelDmx.get(profileId) ?? 0
  // Elegir el duplicado con menor distancia mecánica
  let bestDmx = duplicates[0].dmx
  let bestDist = Math.abs(duplicates[0].dmx - currentDmx)
  for (const dup of duplicates) {
    const dist = wheel.allowsContinuousSpin
      ? Math.min(Math.abs(dup.dmx - currentDmx), 256 - Math.abs(dup.dmx - currentDmx))
      : Math.abs(dup.dmx - currentDmx)
    if (dist < bestDist) { bestDist = dist; bestDmx = dup.dmx }
  }
  interpolatedDmx = bestDmx
}
this.currentWheelDmx.set(profileId, interpolatedDmx)
```

---

## 6. VEREDICTO FORENSE

| Pregunta del Arquitecto | Respuesta |
|--------------------------|-----------|
| ¿Usa distancia Euclidiana RGB? | **No — peor.** Usa HSL hue circular únicamente, ignorando S y L |
| ¿Convierte a LAB/CIEDE2000? | **Declara CIE76 en el header pero NO lo usa en matching.** Solo en debug y cache key |
| ¿Cómo maneja duplicados DMX? | **Primer match gana** (iteración desde índice 0). No hay pathfinding |
| ¿Hay Shortest Path mecánico? | **No.** DarkSpin calcula distancia pero solo para tiempo de blackout, no para elegir DMX destino |
| **CAUSA RAÍZ** | **HSL hue-only clasifica CTB (C*≈13) como cromático porque HSL s=1.0, cuando perceptualmente es un blanco teñido. CTB compite con Blue puro y gana por tener hue más cercano. La saturación HSL no distingue blancos teñidos de colores saturados.** |

**El Ojo Matemático no está podrido — está tuerto.** Solo ve el hue,
ignora la saturación perceptual y la luminosidad. Los blancos teñidos
(CTB/CTO) se cuelan como colores cromáticos porque HSL los clasifica
con s=1.0.

---

## 7. REFERENCIAS DE CÓDIGO

- `ColorTranslator.ts:1-31` — Header declarando CIE76 (falso para matching)
- `ColorTranslator.ts:99-174` — Funciones CIE76 (solo usadas en debug/cache)
- `ColorTranslator.ts:180-203` — `rgbToHsl` + `circularHueDiff` (métrica real)
- `ColorTranslator.ts:390-498` — `findNearestColorLab` (algoritmo de matching)
- `ColorTranslator.ts:393` — `targetIsChromatic = targetHsl.s > 0.15`
- `ColorTranslator.ts:422-436` — Golden Snap (hue 35-55° → Amber/Gold/CTO/Orange)
- `ColorTranslator.ts:448-450` — hueDiff = circularHueDiff (métrica hue-only)
- `ColorTranslator.ts:452-460` — Loop de selección (primer match con menor hueDiff)
- `ColorTranslator.ts:470-488` — Interpolación half-color (DMX lineal entre slots)
- `ColorTranslator.ts:504-510` — `getCacheKey` (usa CIE76 para cuantización de cache)
- `FixtureProfiles.ts:135-182` — BEAM_2R_PROFILE (rueda del 7R)
- `FixtureProfiles.ts:300` — Regex `7r.?beam` → mapea a `beam-2r`
- `AetherSafetyMiddleware.ts:381-441` — `checkDarkSpin` (calcula dmxDistance pero no elige)
- `AetherSafetyMiddleware.ts:416-418` — `min(rawDelta, 256-rawDelta)` (solo para tiempo)

---

*Forense: GLM-5.2 High. Caso Cromatismo — el Ojo Matemático necesita gafas perceptuales.*
