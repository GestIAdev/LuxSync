Vamos a auditar el downstream. Primero encuentro el archivo de Constitution y luego traceo el flujo:

Ahora traceo los sistemas downstream que mutan los hues después del Prisma. Déjame buscar cada uno:

Ahora veo el flujo completo. Déjame verificar el neon protocol y el mudGuard para ver si mutan H o solo S/L:

¡El Neon Protocol **MUTA H**! `hsl.h = normalizeHue(coldHue)` — línea 921. Ahora veo dónde se aplica:

Ahora veo el mudGuard fixDirtyColor:

Ahora veo el bloque completo del final para entender el orden exacto:

Ahora veo el `gamutMapHue` del primary:

Bien — el `gamutMapHue` del primary ya tiene bypass `!isUranusActive`. Ahora veo el `applyThermalGravity` para entender qué hace:

Tengo el cuadro completo. Ahora redacto el reporte forense:

---

# 🔍 WAVE 7706: DOWNSTREAM HAL AUDIT — Forensic Report

## Resumen Ejecutivo

El Prisma Geométrico (WAVE 7704/7705) calcula perfectamente los 4 hues y los pasa por el Anti-Mustard Shield. **Pero el pipeline downstream los muta después**, empujándolos de vuelta a la Void Zone `[25°, 80°]`. Hay **7 sistemas downstream** que mutan `pal.*.h` después del Prisma, y **5 de ellos no tienen bypass para Uranus**.

---

## Orden de Ejecución Downstream (después del Prisma)

El Prisma ejecuta en ~línea 2435. Esto es lo que pasa después, en orden:

### CULPABLE 1: `luxurySignatures` — Línea 2264-2271
<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/color/SeleneColorEngine.ts" lines="2264-2274" />

```typescript
if (key && options?.luxurySignatures) {
  const sig = options.luxurySignatures[keyIndex];
  if (sig !== undefined) {
    pal.secondary.h = sig.h;  // ← SOBREESCRIBE el Prisma
```

**Conflicto:** El Prisma calcula `pal.secondary.h = (H_primary + secOffset) % 360` con el offset geométrico. Luego `luxurySignatures` lo **reemplaza** con un valor fijo (ej: F→160°, A→230°). **Destruye la geometría completamente.**

**Constitución afectada:** `LATINO_CONSTITUTION` (líneas 251-254).

**Bypass Uranus:** ❌ NO TIENE.

---

### CULPABLE 2: `tropicalMirror` — Línea 2364-2368
<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/color/SeleneColorEngine.ts" lines="2364-2368" />

```typescript
if (options?.tropicalMirror) {
  pal.ambient.h = normalizeHue(pal.secondary.h + 180);  // ← SOBREESCRIBE el Prisma
```

**Conflicto:** El Prisma calcula `pal.ambient.h` con `ambOffset` (ej: 330° para analogous). Luego `tropicalMirror` lo **reemplaza** con `secondary + 180°`. Si el secondary está en 20° (shielded), el ambient va a 200° — pero la geometría analogous se pierde.

**Constitución afectada:** `LATINO_CONSTITUTION` (línea 238).

**Bypass Uranus:** ❌ NO TIENE.

---

### CULPABLE 3: Minimum Separation — Línea 2402-2407
<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/color/SeleneColorEngine.ts" lines="2402-2407" />

```typescript
if (shortestDistance < 30 && !options?.ambientLock && !options?.tropicalMirror) {
  pal.ambient.h = normalizeHue(pal.ambient.h + 45);  // ← puede empujar al void
```

**Conflicto:** Si el Prisma produce ambient y secondary a <30° (ej: monochromatic donde ambos son iguales), este bloque rota ambient +45°. Si ambient estaba en 20° (shielded), ahora va a 65° — **DENTRO de la Void Zone**.

**Bypass Uranus:** ❌ NO TIENE.

---

### CULPABLE 4: `hueRemapping` — Línea 2652-2657
<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/color/SeleneColorEngine.ts" lines="2652-2657" />

```typescript
if (options?.hueRemapping && options.hueRemapping.length > 0) {
  this._applyHueRemap(pal.primary, options.hueRemapping);
  this._applyHueRemap(pal.secondary, options.hueRemapping);
  this._applyHueRemap(pal.ambient, options.hueRemapping);
  this._applyHueRemap(pal.accent, options.hueRemapping);
```

**Conflicto:** El `hueRemapping` reemplaza rangos de hue por targets fijos. Ejemplos:
- `ROCK_CONSTITUTION`: `{ from: 260, to: 300, target: 40 }` → empuja púrpura a **40° (VOID ZONE!)**
- `TECHNO_CONSTITUTION`: `{ from: 25, to: 85, target: 170 }` → este está bien (cyan)

El Rock mapea púrpura sucio a 40°, que está **dentro de [25, 80]**. El Anti-Mustard Shield empujó el color a 20°, pero el hueRemapping lo manda a 40°.

**Bypass Uranus:** ❌ NO TIENE.

---

### CULPABLE 5: `applyThermalGravity` en secondary/ambient/accent — Línea 2670-2674
<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/color/SeleneColorEngine.ts" lines="2670-2674" />

```typescript
if (options?.atmosphericTemp) {
  pal.secondary.h = applyThermalGravity(pal.secondary.h, options.atmosphericTemp, gravityStrength);
  pal.ambient.h   = applyThermalGravity(pal.ambient.h,   options.atmosphericTemp, gravityStrength);
  pal.accent.h    = applyThermalGravity(pal.accent.h,    options.atmosphericTemp, gravityStrength);
```

**Conflicto:** La gravedad térmica arrastra hues hacia el polo. Ejemplos:
- `ROCK_CONSTITUTION` (3200K): Polo cálido = 40°. Un secondary en 20° (shielded) se arrastra a ~28° — **DENTRO de la Void Zone**.
- `LATINO_CONSTITUTION` (6200K): Zona neutral, no aplica. ✅
- `TECHNO_CONSTITUTION` (9500K): Polo frío = 240°. Empuja lejos del void. ✅

**Bypass Uranus:** ❌ NO TIENE. (El primary ya tiene bypass en línea 1886 vía `!isUranusActive` en gamutMapHue, pero thermalGravity en línea 1886 se aplica a `finalHue` antes del Prisma, así que el Prisma recibe el hue con thermal ya aplicado. El problema es que se aplica **OTRA vez** a secondary/ambient/accent en línea 2670.)

---

### CULPABLE 6: `applyNeonProtocol` — Línea 2687-2690
<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/color/SeleneColorEngine.ts" lines="2687-2690" />

```typescript
applyNeonProtocol(pal.primary, options);
applyNeonProtocol(pal.secondary, options);
applyNeonProtocol(pal.ambient, options);
applyNeonProtocol(pal.accent, options);
```

**Conflicto:** El Neon Protocol **MUTA H** (línea 921: `hsl.h = normalizeHue(coldHue)`). Si un color está en la danger zone `[15, 80]`, lo rota a `[170, 210]` (cyan). Esto significa que un color shielded a 20° (que está en [15, 80]) será rotado a ~170°. **Destruye tanto la geometría como el shield.**

**Constitución afectada:** `TECHNO_CONSTITUTION` (líneas 114-120, dangerZone: [15, 80]).

**Bypass Uranus:** ❌ NO TIENE.

---

### NO-CULPABLE: `mudGuard` — Línea 2510-2524
<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/color/SeleneColorEngine.ts" lines="2514-2519" />

```typescript
const fixDirtyColor = (c: HSLColor): void => {
  const inSwamp = c.h >= swampMin && c.h <= swampMax;
  if (inSwamp) {
    c.l = Math.max(c.l, mg.minLightness);  // ← solo L
    c.s = Math.max(c.s, mg.minSaturation);  // ← solo S
  }
};
```

**Veredicto:** ✅ NO muta H. Solo sube S y L para evitar barro. No conflictúa con el Prisma.

---

### NO-CULPABLE: `gamutMapHue` del primary — Línea 2636
<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/color/SeleneColorEngine.ts" lines="2636-2643" />

```typescript
if (!isUranusActive && options?.allowedHueRanges && ...) {
  pal.primary.h = gamutMapHue(pal.primary.h, options.allowedHueRanges);
}
```

**Veredicto:** ✅ Ya tiene bypass `!isUranusActive`. No conflictúa.

---

### NO-CULPABLE: Forbidden zone elastic rotation — Línea 2589
<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/color/SeleneColorEngine.ts" lines="2602-2621" />

**Veredicto:** ✅ Ya tiene bypass `!isUranusActive` (WAVE 7704). No conflictúa.

---

## Matriz de Conflictos por Vibe

| Vibe | luxurySignatures | tropicalMirror | minSeparation | hueRemapping | thermalGravity | neonProtocol |
|---|---|---|---|---|---|---|
| **Techno** | ❌ no | ❌ no | ⚠️ sí | ✅ safe (→170°) | ✅ safe (→240°) | 🔴 **DESTRUYE** |
| **Latino** | 🔴 **DESTRUYE** | 🔴 **DESTRUYE** | ⚠️ sí | ❌ no | ✅ neutral | ❌ no |
| **Rock** | ❌ no | ❌ no | ⚠️ sí | 🔴 **→40° VOID** | 🔴 **→40° VOID** | ❌ no |
| **Chill** | ❌ no | ❌ no | ⚠️ sí | ❌ no | ✅ safe (→240°) | ❌ no |
| **Idle** | ❌ no | ❌ no | ⚠️ sí | ❌ no | ✅ neutral | ❌ no |

**Conclusión:** Techno, Latino, y Rock tienen conflictos críticos. Chill e Idle están mayormente limpios.

---

## Análisis de Soluciones

### Opción A: Bypass flags individuales (estilo WAVE 7689)
Añadir `if (!isUranusActive)` antes de cada uno de los 5 culpables.

**Pros:** Surgically precise, preserva legacy.
**Contras:** 5 puntos de bypass distintos, fácil olvidar uno en el futuro. No protege contra futuros sistemas downstream.

### Opción B: Re-aplicar Anti-Mustard Shield al final (última línea de defensa)
Añadir justo antes de `return pal` (línea 2699):
```typescript
if (isUranusActive) {
  pal.primary.h   = SeleneColorEngine._applyAntiMustardShield(pal.primary.h);
  pal.secondary.h = SeleneColorEngine._applyAntiMustardShield(pal.secondary.h);
  pal.accent.h    = SeleneColorEngine._applyAntiMustardShield(pal.accent.h);
  pal.ambient.h   = SeleneColorEngine._applyAntiMustardShield(pal.ambient.h);
}
```

**Pros:** Una sola línea, protege contra TODO downstream mutation, garantiza invariant.
**Contras:** No preserva la geometría — si thermalGravity movió el secondary de 20° a 28°, el shield lo empuja de vuelta a 20°, pero el offset geométrico original ya se perdió. La paleta puede quedar desbalanceada.

### Opción C: Híbrido — Bypass + Shield final (RECOMENDADO)
1. **Bypass los 5 culpables** con `!isUranusActive` (Opción A) — preserva la geometría del Prisma
2. **Re-aplicar Shield al final** (Opción B) — safety net por si algo se escapa

**Pros:** Geometría preservada + invariant garantizado. Defense in depth.
**Contras:** Más código, pero es lo más robusto.

### Opción D: Bypass total del post-procesamiento para Uranus
Envolver TODO el post-procesamiento (líneas 2264-2690) en `if (!isUranusActive) { ... }`.

**Pros:** Máxima limpieza — Uranus produce la paleta final, punto.
**Contras:** Pierde S/L adjustments útiles (mudGuard, saturationRange, lightnessRange, neonProtocol S/L). La paleta Uranus tendría hues perfectos pero S/L sin refinar.

---

## Recomendación del Ingeniero

**Opción C (Híbrido)** es la más segura:

1. **Bypass los 5 sistemas que mutan H** con `!isUranusActive`:
   - `luxurySignatures` (línea 2264)
   - `tropicalMirror` (línea 2364)
   - `minimumSeparation` (línea 2402)
   - `hueRemapping` (línea 2652)
   - `thermalGravity` en secondary/ambient/accent (línea 2670)

2. **Mantener S/L adjustments** (mudGuard, saturationRange, lightnessRange) — no mutan H.

3. **Re-aplicar Anti-Mustard Shield al final** como safety net — garantiza que ningún hue entre a [25, 80] sin importar qué.

4. **Para el Neon Protocol:** bypass completo cuando `isUranusActive` — el Prisma ya garantiza mostaza-free, no necesitamos que el Neon rote hues a cyan.

Espero tu veredicto, Architect. 🔍