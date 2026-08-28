Tienes razón en pedir evidencias forenses antes de tocar nada. Voy a rastrear los paths de ejecución reales para confirmar o desmentir la teoría del caos.

**EVIDENCIA 1 encontrada.** Pillar III se ejecuta **SIEMPRE**, sin flag guard. Voy a confirmar los demás puntos.

**Confirmado**: la línea 1862 `finalHue = softplusRepel(finalHue)` se ejecuta **incondicionalmente** — sin `if (options?.useChromagramGravity)`. Ahora el Sidereal Clock:

**EVIDENCIA 2 encontrada.** El Sidereal Clock **sigue corriendo** siempre que `options?.siderealClock` exista. Solo el `allowedHueRanges` se bypassa cuando `useChromagramGravity` es true — pero el `slot.lightnessRange` y la selección de slot siguen activos. Ahora verifico quién llama a `generate()` y qué flags pasa:

El call site principal es via `colorInterpolator.update()`. Veamos qué options pasa:

Ahora veo el colorInterpolator. Veamos qué options pasa al `generate()`:

Ahora veamos qué `options` (constitution) pasa TitanEngine al interpolator:

El `constitution` se pasa como `options`. Ahora veamos qué constituciones definen `useChromagramGravity`:

**EVIDENCIA 4 crítica.** `useChromagramGravity` **no está seteado en NINGUNA constitución**. Es `undefined` en todas partes. Eso significa que Pillars I, II, y la derivación armónica de WAVE 7690 **están dormidos**. Pero Pillar III NO. Verifiquemos las constituciones:

**EVIDENCIA 2 y 5 confirmadas.** El Sidereal Clock del Techno tiene `slotDurationMs: 6 * 60 * 1000` = 6 minutos. Y `useChromagramGravity` no está activo. Ahora verifiquemos el segundo Sidereal Clock:

Ahora verifiquemos el override de WAVE 7690 — ¿se ejecuta después del legacy o lo pisa?

Ahora tengo todas las evidencias. Voy a actualizar los todos y presentar el informe forense:

---

# INFORME FORENSE — Caos Cromático en SeleneColorEngine

## Veredicto: **Tu teoría es CORRECTA, pero el mecanismo es más sutil de lo que pensabas**

No hay dos motores corriendo en paralelo. Hay **un solo motor con tres subsistemas de Uranus sin gating** pisando al motor legacy. Los Pillars I, II, y 7690 están dormidos (correctamente gated), pero **Pillar III está descontrolado**.

---

## EVIDENCIA 1: Pillar III se ejecuta SIEMPRE (sin flag guard)

**Síntoma:** El softplus repulsion y el rigid-body evacuation corren en cada frame, sin importar el flag.

| Sitio | Línea | ¿Gated? | Código |
|---|---|---|---|
| Primary `finalHue` | 1862 | **NO** | `finalHue = softplusRepel(finalHue);` |
| Ambient | 2284 | **NO** (solo `!ambientLock`) | `pal.ambient.h = softplusRepel(pal.ambient.h);` |
| Palette-wide Stage 1 | 2530 | **NO** | `_evacuatePaletteRigid(pal);` |
| Palette-wide Stage 2 | 2533-2536 | **NO** | `pal.primary.h = softplusRepel(...)` ×4 |

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\color\SeleneColorEngine.ts" lines="1862-1862" />

El comentario de WAVE 7688 dice "always active — anti-yellow" — fue una decisión de diseño deliberada en su momento, pero ahora significa que **el motor legacy está siendo modificado por código de Uranus sin que Uranus esté activado**.

---

## EVIDENCIA 2: El Sidereal Clock legacy sigue corriendo intacto

**Síntoma:** Cambios de paleta cada 6 minutos (Techno) y cada 4 minutos (Oceanic).

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\color\colorConstitutions.ts" lines="144-145" />

```typescript
siderealClock: {
  slotDurationMs: 6 * 60 * 1000,  // 6 minutos por slot  ← Techno
```

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\color\colorConstitutions.ts" lines="266-267" />

```typescript
siderealClock: {
  slotDurationMs: 4 * 60 * 1000,  // 4 minutos por slot  ← Oceanic
```

El Sidereal Clock se activa con `if (options?.siderealClock)` (línea 1961) — **sin ningún guard de `useChromagramGravity`**. Como ninguna constitución activa `useChromagramGravity`, el bypass de WAVE 7689 nunca dispara. El gamutMapHue legacy sigue clavando el hue al slot cada 6/4 minutos.

---

## EVIDENCIA 3: Pillars I, II, y WAVE 7690 están dormidos

**Búsqueda exhaustiva:** `useChromagramGravity: true` no aparece en **ningún** archivo del codebase fuera de `SeleneColorEngine.ts`.

```
grep "useChromagramGravity:\s*true" → 0 matches en todo el repo
```

Esto significa:
- **Pillar I** (barycentric hue override, línea 1771): **dormido** ✓
- **Pillar II** (Φ(t) rotation, línea 1660): **dormido** ✓
- **WAVE 7690** (harmonic palette derivation, línea 2324): **dormido** ✓

Los tres están correctamente gated. El problema NO está aquí.

---

## EVIDENCIA 4: El choque — Legacy + Pillar III = paleta híbrida

Este es el mecanismo del caos. El flujo de `generate()` cuando `useChromagramGravity` es **false** (estado actual):

```
1. KEY_TO_HUE[key] → baseHue           (LEGACY — discreto, 12 valores)
2. Mode modifiers, mood drift          (LEGACY)
3. softplusRepel(finalHue)             (URANUS Pillar III — SIN GUARD)
4. gamutMapHue(finalHue, slot)         (LEGACY — Sidereal Clock clamp)
5. Syncopation → strategy → +30/+120/+180°  (LEGACY — Fibonacci)
6. softplusRepel(pal.ambient.h)        (URANUS Pillar III — SIN GUARD)
7. _evacuatePaletteRigid(pal)          (URANUS Pillar III — SIN GUARD)
8. softplusRepel(pal.primary/secondary/accent/ambient)  (URANUS — SIN GUARD)
```

**El motor legacy produce los colores, y luego Pillar III los evacua del vacío [25°, 80°].** Eso es lo que ves:

- **Cambios cada 6 minutos** → Sidereal Clock legacy cambiando de slot (BUNKER → MAGENTA → LASER...)
- **Cambios en ~40 segundos** → `softplusRepel` + `_evacuatePaletteRigid` reaccionando al chroma en tiempo real, rotando la paleta para escapar del vacío amarillo
- **Paletas 1 y 3 se repiten** → El gamutMapHue clava el hue al slot (ej: [170, 210]), pero el rigid-body rotation de Pillar III rota TODA la paleta, y luego el softplus la empuja fuera de [25, 80]. El resultado neto es que ciertas combinaciones de slot + rotación colapsan a los mismos grados

---

## EVIDENCIA 5: Análisis temporal — las dos frecuencias que ves

| Fenómeno | Período | Fuente |
|---|---|---|
| Cambio de slot | 6 min (Techno) / 4 min (Oceanic) | `siderealClock.slotDurationMs` |
| Rotación rigid-body | ~40 seg | `_evacuatePaletteRigid` — EMA α=0.3, responde al chroma |
| Softplus repulsion | Continuo | `softplusRepel` — función suave, no cuantiza |

Los "40 segundos" que percibes son el tiempo que tarda el EMA del rigid-body en asentar una nueva rotación ψ (α=0.3 → ~3 frames para 50% del cambio, pero la señal de chroma cambia continuamente). No es un período fijo — es la respuesta dinámica al contenido armónico.

---

## DIAGNÓSTICO FINAL

```
┌─────────────────────────────────────────────────────────┐
│  ESTADO ACTUAL (useChromagramGravity = false)           │
│                                                         │
│  LEGACY ENGINE: ████████████████████████  ACTIVO        │
│  ├── KEY_TO_HUE         ✓ corriendo                     │
│  ├── Sidereal Clock     ✓ corriendo (6 min slots)       │
│  ├── gamutMapHue        ✓ corriendo                     │
│  ├── Fibonacci +30/120  ✓ corriendo                     │
│  └── _enforceForbidden  ✓ corriendo (fallback)          │
│                                                         │
│  URANUS ENGINE: ██████████░░░░░░░░░░░░░░  PARCIAL       │
│  ├── Pillar I (gravity)  ✗ dormido (gated)              │
│  ├── Pillar II (Φ(t))    ✗ dormido (gated)              │
│  ├── Pillar III (void)   ⚠ ACTIVO SIN GUARD ← BUG       │
│  └── WAVE 7690 (harmony) ✗ dormido (gated)              │
│                                                         │
│  RESULTADO: Frankenstein — legacy produce, Uranus       │
│  evacúa. Dos lógicas de hue compitiendo en el mismo     │
│  pipeline.                                              │
└─────────────────────────────────────────────────────────┘
```

---

## PLAN DE ACCIÓN (WAVE 7691 — Clean Fork)

La directiva del Arquitecto es correcta en su objetivo pero el approach de "mover todo a dos métodos separados" es **arriesgado** dado el tamaño de `generate()` (~2700 líneas). Propongo un plan más seguro:

### Opción A: Fork estricto (directiva original)
- Extraer `generate()` en `_generateLegacy()` y `_generateUranus()`
- **Riesgo:** 2700 líneas de código con estado compartido (módulo-level accumulators, `_chromaMirror`, etc.). Mover es propenso a bugs.
- **Beneficio:** Separación arquitectónica limpia.

### Opción B: Gate quirúrgico (recomendado)
1. **Gate Pillar III detrás de `useChromagramGravity`** — los 4 sitios sin guard (líneas 1862, 2284, 2530, 2533-2536) se envuelven en `if (options?.useChromagramGravity)`. Cuando el flag está OFF, se restaura el `_enforceForbiddenHue` legacy.
2. **Añadir `useUranusEngine` como alias** de `useChromagramGravity` en `GenerationOptions` (o renombrar) para el UI toggle.
3. **Añadir el toggle al UI state** (EcoState/EngineConfig).
4. **Pasar el flag desde TitanEngine** al interpolator → `generate()`.

Esto restaura el estado "legacy puro" cuando el toggle está OFF, y activa "Uranus puro" cuando está ON. Sin refactor masivo.

### Mi recomendación: **Opción B** primero (estabilizar), **Opción A** después (limpieza arquitectónica)

El gate quirúrgico resuelve el choque **hoy** con riesgo mínimo. El fork estricto es una refactorización mayor que merece su propio WAVE con tests.

---

¿Procedo con la Opción B (gate quirúrgico + UI toggle) o prefieres que intente la Opción A (fork estricto) directamente?