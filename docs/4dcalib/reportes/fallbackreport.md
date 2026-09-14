Voy a rastrear el ciclo de vida del Sidereal Clock, su interacción con el StrategyArbiter, y la tasa de colisión matemática. Primero leo las constituciones y el Sidereal Clock:

Ahora veo cómo TitanEngine invoca el Sidereal Clock y el ColorEngine:

Ahora veo el Sidereal Clock dentro del ColorEngine:

Ahora veo el `_resolveHarmonicHue` y qué `allowed` recibe:

Tengo toda la información. Aquí está el informe arquitectónico:

---

# INFORME ARQUITECTÓNICO: SIDEREAL CLOCK vs STRATEGY ARBITER + TASA DE COLISIÓN DE FALLBACKS

## 1. CICLO DE VIDA: SIDEREAL CLOCK vs STRATEGY ARBITER

### 1.1 — El StrategyArbiter se invoca CADA FRAME, no por slot

**Línea raíz:** `@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\TitanEngine.ts:696-705`

```ts
// 4. STRATEGY ARBITER: Rolling 15s → Analogous/Complementary/Triadic
const strategyInput: StrategyArbiterInput = {
  syncopation: processedContext.syncopation,
  ...
}
const strategyOutput = this.strategyArbiter.update(strategyInput)
```

El `strategyArbiter.update()` se llama en el hot-path de TitanEngine, **cada frame** (~22ms). No está anclado al Sidereal Clock.

### 1.2 — El Sidereal Clock se resuelve DENTRO de generate(), también cada frame

**Línea raíz:** `@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\color\SeleneColorEngine.ts:1509-1518`

```ts
if (options?.siderealClock) {
  const clock = options.siderealClock;
  if (clock.slots && clock.slots.length > 0) {
    const shiftedTime = performance.now() + this._sessionEntropy;
    const slotIndex = Math.floor(shiftedTime / clock.slotDurationMs) % clock.slots.length;
```

El slot se calcula por `performance.now() / slotDurationMs`. Cambia cada 4-6 minutos según la vibra. Pero se **reevalúa cada frame** — solo el `slotIndex` cambia lentamente.

### 1.3 — La estrategia se inyecta como `forceStrategy`, NO se ancla al slot

**Línea raíz:** `@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\TitanEngine.ts:793-807`

```ts
const mappedStrategy = strategyOutput.stableStrategy === 'split-complementary'
  ? 'complementary'
  : strategyOutput.stableStrategy as ('analogous' | 'triadic' | 'complementary');

if (!constitution.forceStrategy) {
  constitution = { ...constitution, forceStrategy: mappedStrategy };
}
```

El output del StrategyArbiter se **inyecta como `forceStrategy`** en la constitución. El Sidereal Clock **no captura ni sincroniza** la estrategia — son dos sistemas independientes que operan en paralelo:

| Sistema | Cadencia | Qué controla |
|---------|---------|--------------|
| StrategyArbiter | Rolling 15s + lock 10s | `forceStrategy` (analogous/triadic/complementary) |
| Sidereal Clock | 4-6 min por slot | `allowedHueRanges` del slot (rango cromático) |

### 1.4 — ¿Qué impide cambios frenéticos si arreglamos el bug Análogo?

**Respuesta: nada a nivel de Sidereal Clock.** El único freno es el `strategyCommitmentFrames` del StrategyArbiter:

`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\color\StrategyArbiter.ts:175-176`

```ts
private strategyCommitmentFrames = 180;  // WAVE 7719: 3s initial (was 30s)
private readonly STRATEGY_COMMITMENT_DURATION = 600;  // WAVE 7719: 10s (was 30s)
```

Tras un cambio, la estrategia se bloquea por 10s (600 frames). Pero **dentro de un slot de 4-6 minutos, la estrategia puede cambiar hasta 24-36 veces**. No hay anclaje entre el slot del Sidereal Clock y la estrategia activa.

**El interpolador suaviza las transiciones** (`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\TitanEngine.ts:848-852`), pero no las previene. La paleta puede cambiar de analogous→triadic→complementary varias veces dentro de un mismo slot cromático.

---

## 2. EL MISTERIO DE LOS FALLBACKS CONSTANTES

### 2.1 — Contradicción arquitectónica: `_resolveHarmonicHue` vs ALLOW-LIST

**El bug raíz está aquí:**

`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\color\SeleneColorEngine.ts:2049-2051`

```ts
if (effectiveOptions?.forbiddenHueRanges) {
  const forbidden = effectiveOptions.forbiddenHueRanges;
  const allowed = effectiveOptions.allowedHueRanges;  // ← SLOT's allowedHueRanges
```

`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\color\SeleneColorEngine.ts:2060`

```ts
pal.primary.h = this._resolveHarmonicHue([priH], forbidden, allowed);
```

`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\color\SeleneColorEngine.ts:2084`

```ts
pal.secondary.h = this._resolveHarmonicHue(secPivots, forbidden, allowed);
```

El `_resolveHarmonicHue` recibe `allowed = effectiveOptions.allowedHueRanges` que es el **slot's allowedHueRanges** (línea 1534: `eo.allowedHueRanges = slot.allowedHueRanges`). Y dentro de `_resolveHarmonicHue`, el `_isAllowed()` **rechaza cualquier candidato fuera del slot**.

Pero el ALLOW-LIST ENFORCEMENT block (líneas 2167-2220) dice explícitamente:

`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\color\SeleneColorEngine.ts:2167-2177`

> `// 🪗 WAVE 7773: LIBERACIÓN DE ARMONÍAS — El allowedHueRanges del slot astronómico SOLO aplica al PRIMARY. SEC/ACC/AMB/CONTRA ya no son aplastados hacia el rango del slot`

Y la aplicación real (línea 2220):

```ts
// 🪗 WAVE 7773: Solo el PRIMARY obedece al slot astronómico.
if (!isInAllowedRange(pal.primary.h))   pal.primary.h   = findNearestAllowedHue(pal.primary.h);
```

**Solo el PRIMARY** se evalúa contra el slot. Pero `_resolveHarmonicHue` (WAVE 7755/7756) **evalúa TODOS los canales contra el slot**. Esto es una contradicción directa: el WAVE 7773 liberó SEC/ACC/AMB/CON del slot, pero el WAVE 7755 los volvió a atrapar.

### 2.2 — Tasa de colisión matemática por vibe

El `allowed` que recibe `_resolveHarmonicHue` es el **slot's allowedHueRanges**, no el de la constitución. Calculo la cobertura:

#### RaveX (forbidden: [[20, 60]])

| Slot | allowedHueRanges | Cobertura | Triadic +120° | Complementary +180° |
|------|-----------------|-----------|---------------|---------------------|
| MAINSTAGE | [[260, 300]] | 40° (11%) | 20° → FORBIDDEN | 80° → fuera slot |
| DROP | [[300, 340]] | 40° (11%) | 60° → FORBIDDEN | 120° → fuera slot |
| BUILD-UP | [[100, 130]] | 30° (8%) | 220° → fuera slot | 280° → fuera slot |
| BREAKDOWN | [[130, 160]] | 30° (8%) | 250° → fuera slot | 310° → fuera slot |
| FINALE | [[290, 340]] | 50° (14%) | 50° → FORBIDDEN | 110° → fuera slot |

**Triadic en RaveX: 100% colisión.** El vértice +120° siempre cae en forbidden [20, 60] o fuera del slot. El vértice -120° cae en el gap [160, 260] (fuera del slot). Todos los candidatos principales son rechazados → fallback golden ratio → también fuera del slot → `_findNearestSafeHue` empuja al borde.

**Complementary en RaveX: ~75% colisión.** +180° desde [260, 340] = [80, 160]. Solo [100, 160] está en el slot BUILD-UP/BREAKDOWN. El resto cae en el gap [60, 100] o es rechazado por el slot.

#### Techno (forbidden: [[5, 80]])

| Slot | allowedHueRanges | Cobertura | Triadic +120° | Complementary +180° |
|------|-----------------|-----------|---------------|---------------------|
| BUNKER | [[170, 210]] | 40° (11%) | 290° → fuera slot | 350° → FORBIDDEN |
| MAGENTA | [[290, 340]] | 50° (14%) | 50° → FORBIDDEN | 110° → fuera slot |
| LASER | [[110, 160]] | 50° (14%) | 230° → fuera slot | 290° → fuera slot |
| ABISAL | [[210, 260]] | 50° (14%) | 330° → fuera slot | 30° → FORBIDDEN |
| TRANSGRESION | [[0, 20], [340, 360]] | 40° (11%) | 120° → fuera slot | 180° → fuera slot |

**Triadic en Techno: ~90% colisión.** El +120° casi siempre cae fuera del slot (que tiene 40-50° de ancho). El -120° cae en forbidden [5, 80] ~50% del tiempo.

**Complementary en Techno: ~80% colisión.** +180° desde un slot de 40° casi nunca cae en el mismo slot.

#### Latino (forbidden: [[45, 90], [155, 185], [255, 285]])

| Slot | allowedHueRanges | Cobertura |
|------|-----------------|-----------|
| ENTRADA | [[190, 255]] | 65° (18%) |
| ASCENSO | [[90, 190]] | 100° (28%) |
| FUEGO | [[0, 44], [300, 360]] | 104° (29%) |
| APEX | [[0, 360]] | 360° (100%) |
| DESCENSO | [[285, 360]] | 75° (21%) |
| NOCHE | [[195, 255]] | 60° (17%) |

Latino tiene mejor cobertura (17-29% por slot, excepto APEX que es 100%). Triadic +120° desde [190, 255] = [310, 15] → cae en FUEGO/DESCENSO pero fuera del slot ENTRADA. **~60% colisión para Triadic.**

#### Rock (forceStrategy: 'complementary', allowed: [[0, 60], [210, 260], [340, 360]])

Rock NO tiene Sidereal Clock. `allowedHueRanges` es el de la constitución: 130° total (36%). Complementary +180° desde [0, 60] = [180, 240] → [210, 240] está allowed, [180, 210] no. **~30% colisión.** Pero como `forceStrategy` es fijo, no hay fallback de estrategia.

#### Chill (forceStrategy: 'analogous', allowed: [[160, 290], [300, 330]])

Chill NO tiene Sidereal Clock (usa oceanic modulation en su lugar). allowedHueRanges = 160° total (44%). Analogous ±25° desde [160, 290] = [135, 315] → [135, 160] fuera allowed, [290, 315] parcialmente fuera. **~20% colisión.** Pero `forceStrategy` es fijo 'analogous', así que no hay pivote de estrategia.

#### Idle (sin restricciones)

`allowedHueRanges: undefined`, `forbiddenHueRanges: undefined`. **0% colisión.** El `_resolveHarmonicHue` no se invoca (el bloque `if (effectiveOptions?.forbiddenHueRanges)` es false).

### 2.3 — Confirmación: el `allowed` es demasiado estricto para estrategias abiertas

**Sí.** El problema es doble:

1. **El slot's allowedHueRanges es demasiado estrecho (8-18% del círculo)** para estrategias que rotan +120° (Triadic) o +180° (Complementary). Un slot de 40° no puede contener un triángulo de 120° — matemáticamente imposible.

2. **`_resolveHarmonicHue` aplica `allowed` a SEC/ACC/AMB/CON** cuando el WAVE 7773 dice explícitamente que solo PRIMARY debe obedecerlo. Esto hace que TODOS los canales derivados sean rechazados por el slot, detonen los fallbacks golden-ratio (que también caen fuera del slot), y terminen en `_findNearestSafeHue` empujados al borde del slot → colores idénticos.

---

## CONCLUSIÓN ARQUITECTÓNICA

| Incógnita | Respuesta | Línea(s) |
|-----------|-----------|----------|
| ¿StrategyArbiter por frame o por slot? | **Por frame** — no está anclado al Sidereal Clock | TitanEngine 705 |
| ¿El Sidereal Clock captura la estrategia? | **No** — son sistemas paralelos independientes | TitanEngine 793-807 |
| ¿Qué frena cambios frenéticos si arreglamos el bug? | Solo el commitment timer de 10s del StrategyArbiter | StrategyArbiter 176 |
| ¿allowedHueRanges demasiado estricto para Triadic? | **Sí** — slots de 30-50° no pueden contener triángulos de 120° | colorConstitutions 609-631 |
| ¿Por qué se detonen los fallbacks? | `_resolveHarmonicHue` aplica `allowed` (slot) a SEC/ACC/AMB/CON, contradiciendo WAVE 7773 | SeleneColorEngine 2051, 2084 |
| ¿Tasa de colisión RaveX Triadic? | **100%** en todos los slots | — |
| ¿Tasa de colisión Techno Triadic? | **~90%** en todos los slots | — |
| ¿Tasa de colisión Latino Triadic? | **~60%** (mejor cobertura) | — |

**El problema no es solo de RaveX.** Techno tiene una tasa de colisión aún peor (~90%) porque sus slots son igual de estrechos (40-50°). La diferencia es que Techno tiene `forceStrategy: undefined` (el StrategyArbiter decide) y el bug de histéresis lo mantiene en Analogous — donde ±25° SÍ caben dentro del slot. RaveX tiene `forceStrategy: 'complementary'` fijado, así que SIEMPRE intenta +180° que SIEMPRE colisiona con el slot.

**El bug raíz es arquitectónico:** el WAVE 7755/7756 introdujo `_resolveHarmonicHue` que aplica el slot's `allowedHueRanges` a TODOS los canales, contradiciendo el WAVE 7773 que liberó SEC/ACC/AMB/CON del slot. Esto hace que el 80-100% de los cálculos armónicos sanos sean rechazados, detonen los fallbacks, y colapsen al borde del slot.