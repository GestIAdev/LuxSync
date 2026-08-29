Buen diagnóstico. Voy a tracear ambos síntomas con código real.

## SÍNTOMA 1: The Collision Bug

Primero busco TODAS las asignaciones a `pal.accent.h` en el archivo:

¡Encontrado! Línea 2539 — hay una asignación a `pal.accent.h` DESPUÉS del Prisma y ANTES del Titanium Lock. Déjame ver el contexto:

¡Ahí está! Línea 2539. Déjame ver el contexto completo del bloque:

Ahora veo el bloque del Barycenter Latch para el Síntoma 2:

Y el bloque donde se computa `_bassEMA` (Solar Gravity override):

Tengo el cuadro completo. Aquí está el reporte forense:

---

# 🔍 WAVE 7708: FORENSIC AUDIT — Dual Anomaly Report

## SÍNTOMA 1: The Collision Bug (SEC = ACC = 122°)

### Diagnóstico: CULPABLE ENCONTRADO

El bug **NO está en el Prisma**. El código del Prisma es correcto:

```typescript
// Línea 2462-2465 — CORRECTO
pal.secondary.h = SeleneColorEngine._applyAntiMustardShield((finalHue + secOffset) % 360);  // 92+30=122 ✓
pal.accent.h    = SeleneColorEngine._applyAntiMustardShield((finalHue + accOffset) % 360);  // 92+60=152 ✓
```

El Prisma asigna correctamente `accent = 152°`. **Pero 80 líneas después, un segundo bloque `tropicalMirror` lo sobreescribe:**

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/color/SeleneColorEngine.ts" lines="2530-2542" />

```typescript
// Línea 2531-2541 — EL CULPABLE
if (hasTropicalMirror) {
  pal.ambient.h = normalizeHue(pal.secondary.h + 180);     // sobreescribe Prisma ambient
  pal.accent.h  = normalizeHue(pal.primary.h + 30);         // sobreescribe Prisma accent ← BUG
}
```

### Trace exacto del bug

Con `Primary = 92°`, estrategia `analogous` (secOffset=30, accOffset=60):

1. **Prisma (línea 2462):** `pal.accent.h = 152°` ✅
2. **Tropical PRO block (línea 2539):** `pal.accent.h = normalizeHue(92 + 30) = 122°` 🔴

El accent es **sobreescrito** con `primary + 30°` — exactamente el mismo offset que el secondary. Por eso SEC = ACC = 122°.

### Por qué el bypass de WAVE 7707 no lo atrapó

En WAVE 7707 bypassé el **primer** `tropicalMirror` en línea 2365:
```typescript
if (options?.tropicalMirror && !isUranusActive) {  // ← primer bloque, bypassado
```

Pero **no sabía que existía un segundo bloque `tropicalMirror`** dentro del bloque "TROPICAL PRO" en línea 2513. Este segundo bloque está anidado dentro de `if (hasMudGuard || hasTropicalMirror)` y tiene su propio `if (hasTropicalMirror)` interno. **Se me escapó.**

### Fix propuesto

Añadir `!isUranusActive` al `hasTropicalMirror` interno en línea 2531:

```typescript
if (hasTropicalMirror && !isUranusActive) {  // ← WAVE 7708 fix
```

Esto preserva el mudGuard (que solo toca S/L) pero bloquea la sobreescritura del accent y ambient del Prisma.

---

## SÍNTOMA 2: The Breakdown Snap (Hysteresis)

### Diagnóstico: Confirmed

El Barycenter Latch actual usa un gate **instantáneo**:

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/color/SeleneColorEngine.ts" lines="1697-1701" />

```typescript
const _bassRawForLatch = ... clamp(data.bass, 0, 1) ...;
if (_bassRawForLatch > 0.25) {   // ← GATE INSTANTÁNEO
  _chromaMxEMA = (1 - CHROMA_ALPHA) * _chromaMxEMA + CHROMA_ALPHA * rawMx;
  _chromaMyEMA = (1 - CHROMA_ALPHA) * _chromaMyEMA + CHROMA_ALPHA * rawMy;
}
```

**El problema:** Un transient de 1 frame (~22ms) — tom drum, vocal plosive — produce `bassRaw > 0.25` por un solo frame. El latch se abre, y aunque `CHROMA_ALPHA = 0.01` es lento, el chroma vector del breakdown es **caótico** (ruido broadband sin estructura armónica). Un solo frame con un vector radicalmente diferente produce un salto visible en la EMA, que se traduce en un snap de `thetaChroma`.

### Solución teórica: Dual-mechanism Hysteresis

Hay dos enfoques posibles:

#### Opción A: Frame Counter Debounce (clásico)

```typescript
let _bassLatchFrames = 0;
const BASS_LATCH_OPEN_FRAMES = 30;   // ~0.7s a 44Hz para ABRIR
const BASS_LATCH_CLOSE_FRAMES = 15;  // ~0.34s para CERRAR

// Cada frame:
if (_bassRawForLatch > 0.30) {
  _bassLatchFrames = Math.min(_bassLatchFrames + 1, BASS_LATCH_OPEN_FRAMES);
} else if (_bassRawForLatch < 0.15) {
  _bassLatchFrames = Math.max(_bassLatchFrames - 1, 0);
}
// Latch solo abierto cuando el contador está saturado
if (_bassLatchFrames >= BASS_LATCH_OPEN_FRAMES) {
  _chromaMxEMA = ...;
  _chromaMyEMA = ...;
}
```

**Pros:** Clásico, probado, dual threshold (0.30 open / 0.15 close) evita fluttering.
**Contras:** Nuevo estado (`_bassLatchFrames`), 2 nuevas constantes.

#### Opción B: Usar `_bassEMA` como gate (elegante, RECOMENDADO)

El `_bassEMA` ya existe y tiene `α=0.03` (τ≈1.5s). Un transient de 1 frame no puede spikear el EMA por encima de 0.25 porque:

```
_bassEMA_new = 0.97 * _bassEMA_old + 0.03 * bassRaw
```

Si `_bassEMA_old = 0.10` (breakdown) y `bassRaw = 0.50` (transient):
```
_bassEMA_new = 0.97 * 0.10 + 0.03 * 0.50 = 0.097 + 0.015 = 0.112
```

El EMA sube de 0.10 a 0.112 — **ni se acerca a 0.25**. Se necesitan ~30 frames sostenidos de bass > 0.50 para que el EMA cruce 0.25.

**El fix:** Mover la computación de `_bassEMA` **antes** del chroma EMA block, y usar `_bassEMA > 0.25` como gate en lugar de `_bassRawForLatch > 0.25`.

```typescript
// 1. Computar bassEMA PRIMERO (mover desde el override block)
const _bassRawClamped = (data.bass !== undefined && Number.isFinite(data.bass)) ? clamp(data.bass, 0, 1) : 0;
_bassEMA = (1 - BASS_ALPHA) * _bassEMA + BASS_ALPHA * _bassRawClamped;

// 2. Gate con EMA (hysteresis natural — sin estado extra)
if (_bassEMA > 0.25) {
  _chromaMxEMA = (1 - CHROMA_ALPHA) * _chromaMxEMA + CHROMA_ALPHA * rawMx;
  _chromaMyEMA = (1 - CHROMA_ALPHA) * _chromaMyEMA + CHROMA_ALPHA * rawMy;
}

// 3. En el override block, _bassEMA ya está computado — solo calcular G
const G = Math.min(1, Math.pow(_bassEMA, GRAVITY_GAMMA_BASS));
```

**Pros:**
- **Cero estado nuevo** — reusa `_bassEMA` que ya existe
- **Cero constantes nuevas** — el threshold 0.25 y α=0.03 ya están calibrados
- **Hysteresis natural** — el EMA es inherentemente un low-pass filter; un transient de 1 frame no puede atravesarlo
- **Dual-purpose** — el mismo EMA sirve para el latch Y para G
- **Simplicidad** — menos código, menos estado, menos bugs

**Contras:**
- Requiere reordenar la computación (mover bass EMA antes del chroma EMA)
- El `_bassEMA` se computa incondicionalmente (incluso cuando Uranus no está activo) — pero es un scalar EMA, costo despreciable

### Recomendación

**Opción B** para el Síntoma 2. Es más elegante, menos código, y la hysteresis es una propiedad emergente del EMA en lugar de un mecanismo explícito. El EMA con τ≈1.5s requiere ~1 segundo de bass sostenido para cruzar el threshold — exactamente lo que queremos (un drop real dura segundos, un transient dura milisegundos).

Para el Síntoma 1, el fix es trivial: añadir `!isUranusActive` al segundo `tropicalMirror` en línea 2531.

Espero tu veredicto, Architect. 🔍