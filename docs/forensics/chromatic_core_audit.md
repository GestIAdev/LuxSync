# 🔍 AUDITORÍA FORENSE: CHROMATIC CORE Y COLOR CONSTITUTION

**Fecha:** 2026-09-10  
**Alcance:** READ-ONLY — sin modificaciones de código  
**Archivos auditados:**
- `electron-app/src/engine/color/SeleneColorEngine.ts` (2735 líneas)
- `electron-app/src/engine/color/colorConstitutions.ts` (574 líneas)
- `electron-app/src/core/aether/adapters/zoneUtils.ts` (305 líneas)
- `electron-app/src/core/aether/adapters/ColorAdapter.ts` (220 líneas)
- `electron-app/src/hal/mapping/FixtureMapper.ts` (797 líneas)

---

## VECTOR 1: La Constitución y la Herejía Naranja (10°)

### 1.1 — Rangos exactos por Vibe

Los rangos están definidos en `colorConstitutions.ts`. Tabla consolidada:

| Vibe | `forbiddenHueRanges` | `allowedHueRanges` | `hueRemapping` | `mudGuard` | `neonProtocol` |
|---|---|---|---|---|---|
| **Techno** | `[[25, 80]]` | `[[0, 360]]` (todo) | `[{25→85→170}, {86→110→130}]` | **NO** | Sí: dangerZone `[15, 80]` |
| **Latino** | `[[45, 90], [155, 185], [255, 285]]` | `[[0, 360]]` (todo) | — | Sí: swamp `[45, 90]`, minL=50, minS=80 | NO |
| **Rock** | `[[80, 160], [260, 300]]` | `[[0, 60], [210, 260], [340, 360]]` | `[{80→160→0}, {260→300→40}]` | NO | NO |
| **Chill** | `[[340, 360], [0, 150]]` | `[[160, 290], [300, 330]]` | — | NO | NO |
| **Idle** | `undefined` | `undefined` | — | NO | NO |

> **Referencia:** `colorConstitutions.ts` líneas 41-174 (Techno), 202-301 (Latino), 313-350 (Rock), 388-462 (Chill), 470-494 (Idle).

### 1.2 — ¿Por qué un Hue de 10° pasa el filtro de Techno?

**El hue 10° NO está en el rango prohibido de Techno `[[25, 80]]`.** El rango prohibido empieza en 25°, no en 0°. La zona `[0, 25]` es deliberadamente libre — la constitución la llama "ZONA LIBRE: 0° - 20° (Rojos)".

**La cadena de producción del 10°:**

1. **Key → Hue base:** Si la tonalidad es C (0°) o C# (30°), el hue base cae en zona roja-naranja.  
   `SeleneColorEngine.ts:574` — `KEY_TO_HUE: { 'C': 0, 'C#': 30, 'D': 60 }`

2. **Thermal Gravity (9500K, fuerza 0.22):** El polo frío es 240°. Para un hue de 30° (C#):  
   - Sin escape velocity: `delta = 240 - 30 = 210`, normalizado a `-150` (camino corto hacia atrás)  
   - `newHue = 30 + (-150 × 0.22) = 30 - 33 = -3 → normalizeHue → 357°` (magenta)  
   - **PERO** la escape velocity (línea 1014) activa para `hue ∈ [0, 85]` con `pole=240`:  
   - `delta = abs(240 - 30) = 210` (forzado hacia adelante)  
   - `newHue = 30 + 210 × 0.22 = 30 + 46.2 = 76.2°` (amarillo-naranja)  
   
   El comentario stale en la constitución (línea 63) dice:  
   > `45° con 22% gravedad → 45 - (165 × 0.22) = 45 - 36 = 9°`  
   
   Esto asume **sin escape velocity** (camino corto hacia atrás). Pero el código TIENE escape velocity activa. El resultado real con escape velocity para 45° sería `45 + 195×0.22 = 87.9°`.

3. **Forbidden check:** Si el resultado es 76.2° → cae en `[[25, 80]]` → elastic rotation de +15° → 91.2° → escapa.

4. **Pero si el resultado es 10° (sin escape velocity o por otro path):**  
   - 10° < 25° → **NO es forbidden** → pasa limpio.  
   - 10° < 25° → **NO entra hueRemapping** `[25→85]` → no se remapea.  
   - 10° está en el NeonProtocol dangerZone `[15, 80]`? → **NO, 10 < 15** → no se sanitiza.  
   - El Sidereal Clock slot TRANSGRESION permite `[[0, 20], [340, 360]]` → 10° es perfectamente válido.

**Conclusión Vector 1 — El 10° escapa por tres gaps alineados:**

| Filtro | Rango | ¿Atrapa 10°? |
|---|---|---|
| `forbiddenHueRanges` | `[25, 80]` | ❌ No (10 < 25) |
| `hueRemapping` | `[25, 85]` | ❌ No (10 < 25) |
| `neonProtocol.dangerZone` | `[15, 80]` | ❌ No (10 < 15) |
| Slot TRANSGRESION `allowedHueRanges` | `[0, 20]` | ✅ Lo permite explícitamente |

El 10° pasa porque **todos los filtros empiezan en 15° o 25°**, dejando un corredor libre `[0, 15]` que en fixtures LED reales se ve naranja, no rojo puro. El rojo puro en LED es ~0-3°; a partir de ~5° ya se percibe naranja-rojizo.

### 1.3 — Zonas de exclusión de barro/mostaza

**MudGuard (solo Latino):**  
`colorConstitutions.ts:231-236` — `swampZone: [45, 90]`, `minLightness: 50`, `minSaturation: 80`.  
Aplica a primary, secondary, ambient, accent (línea 2020-2025 de SeleneColorEngine.ts).

**NeonProtocol (solo Techno):**  
`colorConstitutions.ts:114-120` — `dangerZone: [15, 80]`, `minSaturation: 90`, `minLightness: 75`.  
Transforma colores en la danger zone a cyan/turquesa frío (líneas 779-784 de SeleneColorEngine.ts): distribuye `[15-80]` → `[170-210]`.

**Universal Swamp-Check Fallback (todos los vibes):**  
`SeleneColorEngine.ts:2221-2235` — zona universal barro `[45, 90]`. Si `S < 75` → `S = 75`; si `L < 45` → `L = 45`.  
**No rota el hue**, solo eleva vibrancia. Un hue de 10° con S=90, L=40 **no es atrapado** por este check (10° < 45°).

**Gap identificado:** El barro/mostaza clásico es hue `[25, 80]` con baja saturación/lightness. El Universal Swamp-Check solo cubre `[45, 90]`. La zona `[25, 45]` (naranja-mostaza) **no tiene protección universal** — solo el NeonProtocol de Techno la cubre, y solo si el hue supera 15°.

---

## VECTOR 2: Monocromatismo y Generación Aburrida (Los 5 Slots)

### 2.1 — Cómo se generan los 4 colores (PRI, SEC, ACC, AMB)

El motor genera los 4 colores en `SeleneColorEngine.ts` líneas 1703-1896. El flujo:

1. **Primary** (línea 1707): `pal.primary.h = finalHue` (hue base tras thermal gravity + constitutional enforcement + slot snap)

2. **Strategy** (línea 1718): Determinada por `forceStrategy` o por syncopation:
   - `syncopation < 0.40` → `analogous`
   - `syncopation < 0.65` → `triadic`
   - `syncopation >= 0.65` → `complementary`

3. **Secondary** (líneas 1762-1784): Offset desde primary según estrategia:

   | Estrategia | Secondary offset | 
   |---|---|
   | analogous | `primary - 30°` |
   | triadic | `primary + 120°` |
   | complementary | `primary + 180°` |

4. **Accent** (líneas 1809-1831): Offset desde primary:

   | Estrategia | Accent offset |
   |---|---|
   | analogous | `primary + 30°` |
   | triadic | `primary + 120°` |
   | complementary | `primary + 180°` |

5. **Ambient** (líneas 1857-1872): Offset desde primary:

   | Estrategia | Ambient offset |
   |---|---|
   | analogous | `primary - 30°` |
   | triadic | `primary + 240°` |
   | complementary | `secondary + 30°` |

### 2.2 — El cuello de botella matemático: Analogous produce 3 colores, no 4

**En estrategia `analogous`:**

| Color | Fórmula | Hue resultante |
|---|---|---|
| Primary | `finalHue` | H |
| Secondary | `H - 30°` | H - 30 |
| Accent | `H + 30°` | H + 30 |
| Ambient | `H - 30°` | **H - 30** (¡idéntico a Secondary!) |

**Secondary y Ambient son el mismo color en modo analogous.** La paleta completa solo tiene 3 colores distintos distribuidos en 60° de arco (H-30, H, H+30). Esto es monocromático por diseño.

Además, en `complementary`:
- Secondary = `H + 180°`
- Accent = `H + 180°` (¡mismo que Secondary!)
- Ambient = `secondary + 30° = H + 210°`

**En complementary, Secondary y Accent son el mismo color.** Solo 3 colores distintos.

Y en `triadic`:
- Secondary = `H + 120°`
- Accent = `H + 120°` (¡mismo que Secondary!)
- Ambient = `H + 240°`

**En triadic, Secondary y Accent son el mismo color.** Solo 3 colores distintos.

**Este es el bug fundamental:** En TODAS las estrategias, dos de los cuatro colores colisionan. La paleta nunca tiene 4 colores distintos.

### 2.3 — El desfase de 15° (_cycleDelta) y por qué no aporta dinamismo

`SeleneColorEngine.ts:1748-1749`:
```ts
const _cycleSeed = (this._sessionEntropy ^ (this._macroCycleCount * 2654435761)) >>> 0;
const _cycleDelta = ((_cycleSeed >> 16) % 31) - 15;  // -15 to +15
```

**El _cycleDelta:**
- Es **estable dentro de un slot** (no cambia frame a frame).
- Solo cambia cuando `_macroCycleCount` se incrementa.
- `_macroCycleCount` se incrementa cuando el Sidereal Clock completa un ciclo completo de slots (línea 1545-1546).
- Para Techno: 5 slots × 6 min = **30 minutos** por macro-ciclo.
- Para Latino: 6 slots × 4 min = **24 minutos** por macro-ciclo.

**Por qué no aporta dinamismo visible:**

1. **El delta se aplica a TODOS los offsets por igual** (secondary, accent, ambient). Si _cycleDelta = +10, entonces secondary pasa de `H-30` a `H-20`, accent de `H+30` a `H+40`, ambient de `H-30` a `H-20`. La paleta entera se desplaza 10° pero las distancias relativas entre colores no cambian. El "look" sigue siendo el mismo.

2. **El macro-cycle hue shift (137.5°) se re-snap al slot.** Líneas 1606-1629: después de aplicar `macroCycleHueShift`, el código re-snapa `finalHue` al centro del rango del slot activo. Si el slot TRANSGRESION permite `[0, 20]`, el shift de 137.5° mueve el hue a 137.5°, pero el re-snap lo devuelve al centro de `[0, 20]` = 10°. **El macro-cycle shift es anulado por el re-snap del slot.**

3. **El Sidereal Clock restringe los hue ranges por slot.** Cada slot tiene `allowedHueRanges` que sobreescribe el `allowedHueRanges` de la constitución base. Esto significa que aunque el _cycleDelta varíe, el slot snap fuerza el hue de vuelta al rango del slot. La "variedad" del delta se pierde en el snap.

**Conclusión Vector 2:** Las paletas son aburridas por tres razones concatenadas:
1. **Las armonías colisionan dos colores en todas las estrategias** (3 colores reales, no 4).
2. **El _cycleDelta desplaza la paleta entera uniformemente** — no cambia las distancias relativas.
3. **El re-snap del Sidereal Clock anula el macro-cycle shift** — el hue vuelve al centro del slot.

---

## VECTOR 3: Mapeo de Zonas y el Eslabón Perdido (floor)

### 3.1 — Los dos sistemas de mapeo de color (DIVERGENTES)

Existen **dos paths independientes** que mapean zonas a roles cromáticos, y **no coinciden**:

#### Path A — Aether Matrix (ColorAdapter → zoneUtils)

`zoneUtils.ts:277-305` — `selectColorRoleFromZone()`:

| Zone | Rol cromático |
|---|---|
| front-left, front-right, front | `primary` |
| back-left, back-right, back, left, right | `secondary` |
| movers-left | `secondary` |
| movers-right | `ambient` |
| air, strobe | `accent` |
| **ambient, floor**, default | `ambient` |

> **Floor → `ambient`** (mismo color que la zona ambient)

#### Path B — Legacy FixtureMapper

`FixtureMapper.ts:783-797` — `getColorRoleForZone()`:

| Zone | Rol cromático |
|---|---|
| FRONT_PARS, FLOOR, CENTER, UNASSIGNED | `primary` |
| BACK_PARS | `accent` |
| MOVING_LEFT | `secondary` |
| MOVING_RIGHT | `ambient` |
| STROBES | `accent` |
| AMBIENT | `ambient` |
| AIR | `secondary` |

> **FLOOR → `primary`** (mismo color que los front PARs)

**Discrepancia crítica:** Floor mapea a `ambient` en Aether y a `primary` en FixtureMapper. Si el sistema activo es Aether, floor recibe el color ambient; si es FixtureMapper, recibe el color primary. **Estos son colores distintos en la paleta.**

### 3.2 — ¿Floor ya está incluido?

**Sí, floor ya está mapeado en ambos paths.** No es que floor "falte" — es que floor **no tiene rol propio**. En ambos sistemas, floor hereda el color de otra zona (ambient en Aether, primary en FixtureMapper).

El usuario reports "falta incluir la nueva zona física floor". La interpretación correcta es: **floor necesita su propio rol cromático distinto**, no compartir el color de ambient o primary.

### 3.3 — El 5º color generado pero nunca usado: `contrast`

`SeleneColorEngine.ts:1965-1967`:
```ts
pal.contrast.h = normalizeHue(finalHue + 180);
pal.contrast.s = 30;
pal.contrast.l = 10;
```

Selene genera **5 colores** (primary, secondary, accent, ambient, contrast), pero:

- `IColorIngressPalette` (ColorAdapter.ts:73-78) solo tiene 4: primary, secondary, accent, ambient.
- `RGBPalette` (FixtureMapper.ts:774-781) solo convierte 4: primary, secondary, accent, ambient.
- `selectColorRoleFromZone` solo retorna 4 roles: primary, secondary, accent, ambient.

**El color `contrast` es código muerto.** Se calcula en cada frame pero nunca llega a ningún fixture. Este es el eslabón perdido: floor podría consumir `contrast` (o un nuevo rol derivado) en lugar de compartir `ambient`.

### 3.4 — Punto exacto para añadir floor con rol propio

**Opción A — Aether path (recomendado, es el path activo):**

`zoneUtils.ts:300-303` — Cambiar:
```ts
case 'ambient':
case 'floor':
default:
  return 'ambient'
```
a:
```ts
case 'ambient':
  return 'ambient'
case 'floor':
  return 'contrast'  // o un nuevo rol 'floor'
default:
  return 'ambient'
```

Y extender `IColorIngressPalette` (ColorAdapter.ts:73-78) para incluir `contrast`.

**Opción B — FixtureMapper path (legacy):**

`FixtureMapper.ts:791` — Cambiar `'FLOOR': 'primary'` a `'FLOOR': 'contrast'` (o nuevo rol).

Y extender `RGBPalette` (FixtureMapper.ts:774-781) para incluir `contrast`.

### 3.5 — Sobrecarga semántica de "ambient" — Mapa de clarificación

| Término | Dominio | Significado | Archivo |
|---|---|---|---|
| **Zona espacial `ambient`** | Aether / ShowFile | Zona física de wash de fondo (pars traseros suaves, hazers) | `zoneUtils.ts:188` |
| **Rol cromático `ambient`** | Selene / ColorAdapter | 4º color de la paleta (fills, backlighting suave) | `ColorAdapter.ts:77`, `SeleneColorEngine.ts:54` |
| **Color de salida `AMB`** | UI / Usuario | El color que el usuario percibe como "ambiente" en la app | LabTab / DnaRail |
| **`ambientIntensity`** | LiquidStereo | Intensidad energética de la zona ambient (campo del LiquidStereoResult) | `zoneUtils.ts:188` |
| **`tropicalAmbientBias`** | Constitución | Flag que empuja el color ambient hacia gama fría en vibes tropicales | `colorConstitutions.ts:257` |
| **`ambientLock`** | Constitución | Flag que bloquea el color ambient al primary (legacy, parece no usarse) | `SeleneColorEngine.ts` GenerationOptions |

**La confusión:** Cuando el usuario dice "ambient", puede referirse a la zona física (pars de fondo), al rol cromático (4º color), o al concepto perceptual (color de relleno). Floor comparte el rol `ambient` con la zona `ambient`, lo que significa que físicamente recibe el mismo color que los pars de fondo — pero floor es un plano horizontal (uplight), no un wash de fondo. Visualmente son planos distintos que merecen colores distintos.

---

## RESUMEN EJECUTIVO

### Hallazgos críticos

| # | Vector | Hallazgo | Severidad |
|---|---|---|---|
| 1 | Herejía Naranja | Hue 10° escapa por gap `[0, 15]` entre el final de los rangos libres y el inicio de los filtros | **Alta** |
| 2 | Herejía Naranja | El comentario stale en la constitución (línea 63) describe matemática sin escape velocity | Media |
| 3 | Herejía Naranja | Techno no tiene `mudGuard`; la zona `[25, 45]` no tiene protección universal de barro | Media |
| 4 | Monocromatismo | En **todas** las estrategias, dos de los 4 colores colisionan (3 colores reales, no 4) | **Crítica** |
| 5 | Monocromatismo | `_cycleDelta` desplaza la paleta uniformemente — no cambia distancias relativas | Alta |
| 6 | Monocromatismo | El re-snap del Sidereal Clock anula el macro-cycle shift de 137.5° | Alta |
| 7 | Zona floor | Dos paths de mapeo divergentes: Aether→`ambient`, FixtureMapper→`primary` | **Crítica** |
| 8 | Zona floor | El 5º color `contrast` se genera pero nunca se consume (código muerto) | Alta |
| 9 | Zona floor | Floor no tiene rol cromático propio — comparte color con otra zona | Alta |

### Valores hardcodeados clave

| Valor | Ubicación | Propósito |
|---|---|---|
| `forbiddenHueRanges: [[25, 80]]` | `colorConstitutions.ts:69` | Techno prohíbe naranja/amarillo |
| `neonProtocol.dangerZone: [15, 80]` | `colorConstitutions.ts:116` | Techno sanitiza calidez |
| `thermalGravityStrength: 0.22` | `colorConstitutions.ts:66` | Fuerza de arrastre térmico Techno |
| `atmosphericTemp: 9500` | `colorConstitutions.ts:57` | Polo frío Azul Rey (240°) |
| `elasticRotation: 15` | `colorConstitutions.ts:75` | Paso de rotación para escapar forbidden |
| `PHI_ROTATION ≈ 222.5°` | `SeleneColorEngine.ts:563` | Rotación Fibonacci default para secondary |
| `FIBONACCI_GOLDEN_ANGLE_A = 137.5°` | `SeleneColorEngine.ts:1084` | Shift por macro-ciclo |
| `_cycleDelta: ±15°` | `SeleneColorEngine.ts:1749` | Perturbación procedural estable |
| Analogous: `-30° / +30° / -30°` | `SeleneColorEngine.ts:1770,1820,1870` | Offsets SEC/ACC/AMB |
| `pal.contrast.h = finalHue + 180°` | `SeleneColorEngine.ts:1965` | 5º color (muerto) |

### Puntos exactos de intervención

| Vector | Archivo | Línea | Acción |
|---|---|---|---|
| 10° naranja | `colorConstitutions.ts` | 69 | Bajar el floor de `forbiddenHueRanges` de 25 a 5 (o 0) |
| 10° naranja | `colorConstitutions.ts` | 116 | Bajar `neonProtocol.dangerZone` de 15 a 5 (o 0) |
| Barro [25,45] | `SeleneColorEngine.ts` | 2224 | Ampliar `_universalSwamp` de `[45, 90]` a `[25, 90]` |
| Colisión SEC=AMB | `SeleneColorEngine.ts` | 1870 | Cambiar ambient analogous de `-30°` a un offset distinto (ej: `-60°` o `+60°`) |
| Colisión SEC=ACC | `SeleneColorEngine.ts` | 1823 | Cambiar accent triadic de `+120°` a `+240°` (3er punto real) |
| Colisión SEC=ACC | `SeleneColorEngine.ts` | 1826 | Cambiar accent complementary de `+180°` a `+150°` (split-complementary) |
| Re-snap anula macro-cycle | `SeleneColorEngine.ts` | 1612-1629 | Considerar no re-snap, o aplicar macro-cycle shift DESPUÉS del re-snap |
| Floor rol propio | `zoneUtils.ts` | 300-303 | Separar `case 'floor'` de `case 'ambient'` y asignar rol propio |
| Floor rol propio | `ColorAdapter.ts` | 73-78 | Extender `IColorIngressPalette` con `contrast` |
| Floor rol propio | `FixtureMapper.ts` | 791 | Cambiar `'FLOOR': 'primary'` a rol propio |
| Floor rol propio | `FixtureMapper.ts` | 774-781 | Extender `RGBPalette` con `contrast` |

---

*Auditoría completada. Sin modificaciones de código. Listo para fase de blueprint de corrección.*
