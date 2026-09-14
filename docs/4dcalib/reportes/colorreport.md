Voy a hacer la auditoría forense. Primero leo las secciones clave del código actual:

Ahora veo el bloque de post-procesamiento WAVE 7755 que reemplaza los valores:

Ahora veo la selección de estrategia:

Ahora verifico la constitución de RaveX y el origen de la syncopation:

Busco el StrategyArbiter mencionado en los comentarios:

Ahora veo cómo TitanEngine conecta el StrategyArbiter con el ColorEngine:

Tengo toda la información. Aquí está el informe forense:

---

# INFORME FORENSE: SELENE COLOR ENGINE — Colapso Monocromático y Bloqueo de Estrategia

## 1. FORENSE DE EMPAREJAMIENTO (SEC == CON, ACC == AMB)

### Bug 1.1 — CON clonado con SEC en estrategia Complementary

**Línea raíz:** `@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\color\SeleneColorEngine.ts:2133-2141`

```ts
// 5️⃣ CONTRAST — ancla matemática a +180° del PRIMARIO (WAVE 7756).
pal.contrast.h = this._resolveHarmonicHue(
  [normalizeHue(priH + 180), normalizeHue(priH - 180), ...],
  forbidden, allowed,
);
```

**Línea conflictiva:** `@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\color\SeleneColorEngine.ts:1739-1741`

```ts
case 'complementary':
  secondaryHue = normalizeHue(finalHue + 180 + saltRotation + _cycleDelta);
```

**Causa lógica:** En estrategia Complementary, SEC = `priH + 180`. El primer candidato de CON (WAVE 7756) es también `priH + 180`. Si ese hue está limpio (no forbidden), `_resolveHarmonicHue` lo devuelve inmediatamente para AMBOS canales → **SEC == CON exactos**.

El "fix" WAVE 7756 reancló CON a `priH + 180` para preservar su naturaleza complementaria, pero no verificó que SEC en complementary YA ocupa ese grado. El ancla del CON colisiona estructuralmente con la definición del SEC.

### Bug 1.2 — SEC y AMB comparten fallbacks idénticos en Analogous

**Línea raíz SEC:** `@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\color\SeleneColorEngine.ts:2077-2081`

```ts
case 'analogous':
default:
  secPivots = [secMain, normalizeHue(priH + 25), normalizeHue(priH + PHI_A), normalizeHue(priH + PHI_B)];
```

**Línea raíz AMB:** `@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\color\SeleneColorEngine.ts:2125-2128`

```ts
case 'analogous':
default:
  ambPivots = [ambMain, normalizeHue(priH + 45), normalizeHue(priH + PHI_A), normalizeHue(priH + PHI_B)];
```

**Causa lógica:** SEC y AMB comparten el MISMO orden de fallbacks golden-ratio: `priH + 137.5` (PHI_A) luego `priH + 222.5` (PHI_B). Si `secMain` y `ambMain` colisionan, y sus segundos candidatos (`priH + 25`, `priH + 45`) también colisionan, AMBOS caen a `priH + 137.5` → **SEC == AMB**.

### Bug 1.3 — ACC y CON comparten fallback PHI_B

**Línea raíz ACC:** `@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\color\SeleneColorEngine.ts:2101-2104`

```ts
case 'analogous':
default:
  accPivots = [accMain, normalizeHue(priH - 25), normalizeHue(priH + PHI_B), normalizeHue(priH + PHI_A)];
```

**Causa lógica:** ACC cae a `priH + 222.5` (PHI_B) como tercer candidato. CON (línea 2135) tiene `priH + PHI_B` como último candidato. Si los candidatos principales de ambos colisionan, ambos convergen a `priH + 222.5` → **ACC == CON**.

### Resumen del emparejamiento

| Canales | Causa de clonado | Línea |
|---------|-----------------|-------|
| SEC == CON | Ambos = `priH + 180` en Complementary | 1741, 2135 |
| SEC == AMB | Fallbacks PHI_A/PHI_B idénticos en Analogous | 2080, 2127 |
| ACC == CON | Fallback PHI_B compartido en Analogous | 2103, 2135 |

---

## 2. FORENSE DEL CONTRASTE — Pérdida de la naturaleza +180°

### Bug 2.1 — CON anclado al AMBIENT, no al PRIMARIO (pre-block)

**Línea raíz:** `@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\color\SeleneColorEngine.ts:1907-1915`

```ts
// 🪗 WAVE 7773: Contrast ahora es opuesto a la MASA PRINCIPAL (ambient),
// no al primary.
pal.contrast.h = normalizeHue(pal.ambient.h + 180);
```

**Causa lógica:** El WAVE 7773 redefinió el CON como complemento del **ambient** (wash/floor), no del primario. Si el ambient fue empujado por el evasor a un valor X, CON = X + 180. Esto rompe la identidad física del CON como opuesto del primario.

### Bug 2.2 — El post-block WAVE 7756 es condicional

**Línea raíz:** `@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\color\SeleneColorEngine.ts:2049-2050`

```ts
if (effectiveOptions?.forbiddenHueRanges) {
  // ... post-block que reancla CON a priH + 180
```

**Causa lógica:** El reanclaje del CON a `priH + 180` (WAVE 7756) SOLO se ejecuta si hay `forbiddenHueRanges` en la constitución. Si la constitución no define zonas prohibidas (ej: IDLE_CONSTITUTION, o constituciones custom sin forbidden), el post-block se omite y CON queda como `amb + 180` (del pre-block) — tratado como un tono análogo del ambient, no como complementario del primario.

### Bug 2.3 — Reescritura mutua entre pre-block y post-block

El flujo es:
1. **Pre-block** (línea 1913): `CON = AMB + 180`
2. **Post-block** (línea 2135, solo si forbidden): `CON = resolve([priH+180, ...])`

Si el post-block NO corre, CON mantiene `AMB + 180`. Si el post-block SÍ corre, CON se reescribe. Esto crea comportamiento inconsistente: el CON tiene naturaleza distinta según si la constitución tiene o no `forbiddenHueRanges`.

---

## 3. FORENSE DE ESTRATEGIA — Bloqueo permanente en Analogous

### Bug 3.1 — Inicialización inconsistente en StrategyArbiter

**Línea raíz 1:** `@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\color\StrategyArbiter.ts:159`

```ts
private stableStrategy: ColorStrategy = 'analogous';  // Default seguro
```

**Línea raíz 2:** `@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\color\StrategyArbiter.ts:177`

```ts
private lastCommittedStrategy: ColorStrategy = 'analogous';
```

**Línea raíz 3:** `@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\color\StrategyArbiter.ts:180`

```ts
private lastDecisionZone: 'low' | 'mid' | 'high' = 'mid';
```

**Causa lógica:** `stableStrategy` se inicializa a `'analogous'` (zona 'low'), pero `lastDecisionZone` se inicializa a `'mid'` (zona que mapea a `'triadic'`). Estas son **inconsistentes**. La zona 'mid' debería implicar `stableStrategy = 'triadic'`, no `'analogous'`.

### Bug 3.2 — Histéresis atrapa el estado inicial

**Línea raíz:** `@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\color\StrategyArbiter.ts:373-398`

```ts
private checkHysteresis(avgSync: number, targetStrategy: ColorStrategy): boolean {
  const hysteresis = this.config.hysteresisBand;  // 0.05

  if (avgSync < this.config.lowSyncThreshold - hysteresis) {       // < 0.35
    currentZone = 'low';
  } else if (avgSync > this.config.highSyncThreshold + hysteresis) { // > 0.70
    currentZone = 'high';
  } else if (avgSync > this.config.lowSyncThreshold + hysteresis &&  // > 0.45
             avgSync < this.config.highSyncThreshold - hysteresis) { // < 0.60
    currentZone = 'mid';
  } else {
    currentZone = this.lastDecisionZone;  // mantén zona anterior
  }

  if (currentZone !== this.lastDecisionZone) {
    this.lastDecisionZone = currentZone;
    return true;  // permite cambio
  }
  return false;  // bloquea cambio
}
```

**Causa lógica:** El buffer se inicializa a `0.45` (línea 207). La syncopation real de techno/EDM típicamente cae en 0.45-0.60 (zona 'mid'). Como `lastDecisionZone` empieza en 'mid', y `currentZone` calcula 'mid' para ese rango, `currentZone === lastDecisionZone` → `checkHysteresis` devuelve `false` → **el cambio NUNCA se aprueba**.

El flujo completo:
1. `stableStrategy = 'analogous'` (inicial)
2. `avgSync ≈ 0.45-0.60` → `instantStrategy = 'triadic'`
3. `effectiveStrategy ('triadic') !== stableStrategy ('analogous')` → entra hysteresis
4. `checkHysteresis`: `currentZone = 'mid'`, `lastDecisionZone = 'mid'` → devuelve `false`
5. **No hay cambio.** Strategy permanece 'analogous' indefinidamente.

Para que la estrategia cambie, la syncopation promediada tendría que cruzar un umbral duro (bajar a <0.35 o subir >0.70), lo cual es raro en techno 4/4 estable.

### Bug 3.3 — El parche WAVE 7755/7756 NO alteró la estrategia

**Respuesta directa a la directiva:** El parche anterior (WAVE 7755/7756) **no tocó**:
- La selección de estrategia en `SeleneColorEngine.ts` (líneas 1675-1691)
- El `StrategyArbiter.ts` en absoluto
- Los umbrales de syncopation (0.40 / 0.65)
- Los umbrales de mood/energy

El bloqueo en Analogous es un **bug pre-existente** del `StrategyArbiter`, causado por la inicialización inconsistente `stableStrategy='analogous'` vs `lastDecisionZone='mid'`. El WAVE 7719 (líneas 171-176) ya intentó mitigar el lock de 30s reduciéndolo a 10s, pero no tocó la inicialización inconsistente ni la trampa de histéresis.

### Bug 3.4 — RaveX no se ve afectado por este bug

**Línea raíz:** `@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\color\colorConstitutions.ts:542`

```ts
forceStrategy: 'complementary',
```

**Línea raíz:** `@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\TitanEngine.ts:801-805`

```ts
if (!constitution.forceStrategy) {
  constitution = { ...constitution, forceStrategy: mappedStrategy };
}
```

RaveX tiene `forceStrategy: 'complementary'` definido en su constitución. TitanEngine respeta ese flag y NO aplica el output del StrategyArbiter. Por lo tanto, RaveX NO se queda stuck en analogous — siempre es complementary. El bug del StrategyArbiter afecta a vibes SIN forceStrategy: **Techno, Latino, Idle** (todos `forceStrategy: undefined`).

---

## CONCLUSIÓN

| Bug | Causa | Línea(s) | Introducido por |
|-----|-------|----------|-----------------|
| SEC == CON (Complementary) | Ambos = `priH + 180` | 1741, 2135 | WAVE 7756 |
| SEC == AMB (Analogous) | Fallbacks PHI_A/PHI_B idénticos | 2080, 2127 | WAVE 7755 |
| ACC == CON (Analogous) | Fallback PHI_B compartido | 2103, 2135 | WAVE 7755/7756 |
| CON pierde +180° | Pre-block `CON = AMB + 180` | 1913 | WAVE 7773 (pre-existente) |
| CON condicional | Post-block solo si forbidden | 2049 | WAVE 7755 |
| Strategy stuck Analogous | Init `stableStrategy`≠`lastDecisionZone` | StrategyArbiter 159, 180 | Pre-existente |
| Hysteresis trap | `currentZone === lastDecisionZone` siempre 'mid' | StrategyArbiter 392 | Pre-existente |

Los bugs de emparejamiento fueron **introducidos por los parches WAVE 7755/7756** (fallbacks golden-ratio compartidos y reanclaje CON a priH+180 sin verificar SEC). El bloqueo de estrategia es **pre-existente** del StrategyArbiter y no fue alterado por los parches recientes.