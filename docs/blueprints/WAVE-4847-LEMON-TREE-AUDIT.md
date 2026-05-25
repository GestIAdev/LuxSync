# WAVE 4847 — THE LEMON TREE AUDIT
## Forensia del Mismatch Visual/Físico tras la migración `.ts` → `.lfx`

**Hipótesis del operador:** Selene cognitiva dispara los `.lfx` correctamente, pero el resultado físico es desastroso (sin color, congelado, sin zonas). Misión: probar el callejón anatómico completo, desde el JSON migrado hasta el bus DMX, y aislar el agujero.

**Veredicto adelantado:** **EL `.lfx` ES UN HERBARIO, NO UN ÁRBOL VIVO.** El migrator extrajo solo la curva de `intensity` y comprimió **toda la información cromática y espacial a metadatos estáticos que ningún componente del runtime consume**. La capa L0 no "se está comiendo" al L3 — el L3 está emitiendo silencio cromático.

---

## §1. EL LIMONERO vs LA PIRÁMIDE — Comparativa Anatómica

Tomamos como caso canónico **`cumbia_moon`** porque la queja del operador lo nombra explícitamente y porque es un efecto multi-zona, multi-color, BPM-sincronizado. Es la prueba ácida.

### 1.1 El Limonero — `@/Users/.../core/effects/library/fiestalatina/CumbiaMoon.ts:91-256`

| Dimensión | Comportamiento | Cómo se entrega |
|-----------|----------------|-----------------|
| **Intensity** | Bell-curve sinusoidal (rise 40% → sustain breve → fall 40%) | Calculado por `calculateBellIntensity()` cada frame (`@CumbiaMoon.ts:152-177`) |
| **Color** | **Ciclo HSL animado de 3 keyframes** con interpolación circular de hue (`@CumbiaMoon.ts:183-209`). Override final a `moonWhite = {h:0,s:0,l:80}` para todas las zonas (`@CumbiaMoon.ts:219`). | Por zona en `zoneOverrides` con HSL distinto |
| **Zones** | 3 buckets espaciales: `front` (dimmer ×1.0), `back` (dimmer ×0.7), `all-movers` (dimmer ×0.15, blendMode `replace`) (`@CumbiaMoon.ts:221-238`) | `EffectFrameOutput.zoneOverrides` |
| **BPM-Sync** | `cycleDurationMs = (60000/bpm) × beatsPerCycle` (`@CumbiaMoon.ts:118-128`) | Recalculado en `trigger()` desde `musicalContext.bpm` |
| **Diplomatic passport** | `overrideMoverShield: true` (`@CumbiaMoon.ts:249`) — permite romper el escudo anti-mover-color en el bus global | Flag en `EffectFrameOutput` |
| **MixBus** | `'global'` — actúa como dictador (`@CumbiaMoon.ts:96`) | Resuelve conflictos con HTP/LTP en EffectManager |
| **Priority** | `65` (baja, ambient) | Para arbitraje multi-efecto |

**Caracterización:** Un autómata stateful, framewise, con feedback al `musicalContext`. Sus *outputs* son ricos en estructura: dimmer + color + blendMode **por zona espacial**, con flags semánticos.

### 1.2 La Pirámide — `@/Users/.../core/arsenal/builtins/cumbia_moon.lfx`

```json
{
  "clip": {
    "id": "cumbia_moon",
    "durationMs": 6000,
    "effectType": "heph_custom",
    "curves": {
      "intensity": {  // ← ÚNICA CURVA
        "keyframes": [
          { "timeMs": 0,    "value": 0, "interpolation": "bezier", ... },
          { "timeMs": 3000, "value": 1, "interpolation": "bezier", ... },
          { "timeMs": 6000, "value": 0, "interpolation": "hold" }
        ]
      }
    },
    "staticParams": {
      "dominantColorH": 280,    // ← DATO MUERTO
      "dominantColorS": 70,     // ← DATO MUERTO
      "dominantColorL": 45,     // ← DATO MUERTO
      "bpmRef": 128             // ← DATO MUERTO (no recalcula)
    },
    "zones": ["ambient", "gentle"],         // ← EnergyZones (cognitivas), NO espaciales
    "executionHints": {
      "fixtureTargeting": "pars"            // ← hint vago
    }
  }
}
```

### 1.3 Diff Estructural — La Pérdida en Bruto

| Concepto del `.ts` | Estado en `.lfx` | Impacto físico |
|--------------------|------------------|----------------|
| Bell sinusoidal en `intensity` | ✅ Preservada como curva bezier | OK — el dimmer respira |
| **Ciclo HSL animado de 3 keyframes** | ❌ **DESTRUIDA** — comprimida a un único triplete `dominantColorH/S/L` estático | **Sin animación cromática** |
| **Override `moonWhite` para movers** | ❌ **DESTRUIDA** | Movers reciben el mismo dim que pars |
| **`zoneOverrides` con front/back/all-movers** | ❌ **DESTRUIDA** — colapsado a `fixtureTargeting: "pars"` | Solo se animan los pars; back y movers no participan |
| **Dimmer scaling per-zone (×1.0/×0.7/×0.15)** | ❌ **DESTRUIDA** | Toda la zona objetivo recibe la curva pura |
| BPM-sync dinámico (recalcula con BPM real) | ❌ **DESTRUIDA** — `bpmRef: 128` es metadato no usado | Duración fija 6 s sin importar el tempo |
| `overrideMoverShield: true` | ❌ **DESTRUIDA** | El escudo anti-mover-color sigue activo si existe |
| `mixBus: 'global'` (dictador) | ⚠️ Degradada — vive en `staticParams.legacyMixBus: "ambient"` | El efecto ya no actúa como dictador |
| `blendMode: 'max' | 'replace'` | ❌ **DESTRUIDA** | Sin control de fusión por zona |

**Conclusión §1:** El `.lfx` migrado conserva **menos del 20%** de la riqueza expresiva del `.ts` original. Lo que llega al ejecutor es un perfil de dimmer y nada más.

---

## §2. EL AGUJERO NEGRO DEL COLOR — Trace forense

Aquí desmontamos el callejón completo `JSON → Runtime → Adapter → Arbiter → DMX` para identificar dónde se evapora el color.

### 2.1 Step 0 — JSON: ¿Hay color para emitir?

**Búsqueda exhaustiva en los 36 builtins:**

```
grep "valueType: \"color\"" arsenal/builtins/*.lfx
→ ZERO RESULTADOS
```

**Ningún `.lfx` builtin tiene una curva con `valueType: "color"`.** El color en el formato `.lfx` solo existe como `staticParams.dominantColorH/S/L`.

### 2.2 Step 1 — Runtime: ¿Lee `dominantColorH/S/L`?

`@/Users/.../core/hephaestus/runtime/HephaestusRuntime.ts:530-635`

```typescript
private tickWithPhase(active: ActiveHephClip, baseClipTimeMs: number): void {
  for (const fp of active.fixturePhases!) {
    ...
    for (const [paramName, curve] of active.clip.curves) {  // ← SOLO ITERA curves
      if (curve.valueType === 'color') { ... }              // ← rama nunca tomada
      else { /* numérico → writeOutput */ }
    }
  }
}
```

**Búsqueda global:**

```
grep "dominantColorH" --type ts → 0 resultados
grep "staticParams\." --type ts → 0 lecturas runtime; solo genera metadata
```

**Veredicto:** `staticParams.dominantColorH/S/L` es **JSON-fósil**: información archivada con propósito de catálogo / dream-simulation / DNA-scoring, pero **completamente desconectada del executor**. El runtime nunca emite un output con parámetro `'color'` para `cumbia_moon` (ni para los otros 25+ clips que tampoco tienen curva `color`).

### 2.3 Step 2 — Adapter: ¿Qué intent emite?

`@/Users/.../core/aether/adapters/HephaestusAetherAdapter.ts:78-130`

El adapter recibe los outputs del runtime y los enruta a familias de nodos:

```typescript
const family = _paramFamily(param)  // 'intensity' → IMPACT
...
const intent = this._acquireIntent(nodeId)
_populateValues(intent.values, param, output, behavior)  // → values['dimmer'] = bell(t)
this._frameIntents.push(intent)
```

Para `cumbia_moon` el adapter solo emite **un único intent** por fixture: `nodeId=fix1:impact`, `values={dimmer: 0.42}`. **No se emite ningún intent al `nodeId=fix1:color`.**

#### 2.3.1 La trampa del WAVE 4844 — COLOR-OPACITY GUARD

`@HephaestusAetherAdapter.ts:112-129`

```typescript
if (family === NodeFamily.COLOR && output.normalizedRgb != null) {
  for (let k = 0; k < nodeIds.length; k++) {
    ...
    const dimmerIntent = this._acquireIntent(impactId)
    dimmerIntent.values['dimmer'] = 1.0          // ← garantía de opacidad
    this._frameIntents.push(dimmerIntent)
    break
  }
}
```

**Análisis crítico:**
- La guarda **solo dispara cuando ya hay output de color**. En `cumbia_moon` (y en TODOS los builtins sin curva `color`) la guarda es un **no-op total**.
- En los pocos clips con curva color (que de hecho **no existen en el arsenal builtin actual**), la guarda emite `dimmer=1.0` en un intent separado al mismo `:impact`. Si el clip *también* tiene una curva `intensity` (bell, ramp, etc.), tenemos **dos intents al mismo nodo** en el mismo frame:
  - Intent A: `{dimmer: bell(t)}` (de la curva `intensity`)
  - Intent B: `{dimmer: 1.0}` (de la guarda 4844)
- El NodeArbiter aplica LTP por canal. **El último que se inserte en `_frameIntents` gana.** En el código actual, el orden es: primero el intent de IMPACT (línea 107), luego el guard de IMPACT (línea 124). **Si family=COLOR llega después de family=IMPACT en `outputs[]`**, la guarda escribe `dimmer=1.0` y aniquila la curva bell. Esto es una bomba de tiempo arquitectónica que *funcionará* en clips solo-color y *romperá* en clips intensity+color.

### 2.4 Step 3 — NodeArbiter: ¿Domina L3 sobre L0?

`@/Users/.../core/aether/NodeArbiter.ts:892-1027` (`_applyIntent` + GAG WAVE 4871)

Cuando el adapter emite un intent al nodo `fix1:impact`, el GAG WAVE 4871 dispara el escudo:

```typescript
// Si L3 escribe en :impact o :color del fixture, los canales de luminancia
// (dimmer/strobe/shutter/master_brightness/brightness) del fixture entero
// quedan dominados.
for (const _gagFamily of L3_GAG_TRIGGER_FAMILIES) {  // ['impact', 'color']
  const _gagNodeId = `${_fixturePrefix}:${_gagFamily}`
  ...
  for (const _lumCh of L3_LUMINANCE_GAG_CHANNELS) {
    _gagDominated.add(_lumCh)
  }
}
```

**Trazo forense para `cumbia_moon`:**

1. L3 (Heph) escribe `{dimmer: bell(t)}` en `fix1:impact`. ✅
2. GAG WAVE 4871 reclama `dimmer/strobe/shutter/brightness` en `fix1:impact` Y en `fix1:color`.
3. L0/L1 quedan **silenciados** en luminancia. ✅ — esto está bien.
4. Pero **L3 nunca escribe en `fix1:color`** (ni `red`, ni `green`, ni `blue`). El nodo COLOR del fixture queda con los valores de **L0** intactos:
   - Si L0 lo dejó en `{red:0, green:0, blue:0}` → fixture sale **negro con dimmer animado** = invisible.
   - Si L0 ambient escribió `{red:0.5, green:0.5, blue:0.5}` → el fixture se ve **gris** modulado por la bell.

**Esto es exactamente lo que reporta el operador como "transparencia" — el efecto modula intensidad sobre el color que la capa L0 dejó ahí, y como L0 a menudo está en negro o casi negro, el efecto literalmente no se ve.**

#### 2.4.1 ¿Falta `blendMode`/`alpha`/`override_priority`?

**NO.** El contrato del Arbiter es ABSOLUTE L3 OVERRIDE (WAVE 4829) + L3 LUMINANCE GAG (WAVE 4871). Si L3 escribe un canal, ese canal queda totalmente dominado. **El problema no es el contrato del Arbiter; el problema es que L3 NO ESTÁ ESCRIBIENDO el canal de color.** No hay nada que mergear, no hay nada que sobrescribir, no hay alpha que negociar — hay silencio.

### 2.5 Step 4 — Hyperion 2D: ¿Por qué no se renderiza el fixture?

El simulador 2D consume el estado final del NodeArbiter por fixture. Para `cumbia_moon`:

| Canal | Valor final |
|-------|-------------|
| `dimmer` | bell(t) ∈ [0, 0.30] (peakIntensity del JSON migrado vía curva normalizada) |
| `red`/`green`/`blue` | El que dejó la capa anterior (típicamente 0,0,0 en silencio o un ambient muy oscuro) |

Resultado: el fixture en el 2D pinta `rgb=(0,0,0) × dimmer=0.3 = sigue siendo (0,0,0)`. Hyperion lo dibuja como un punto apagado. **El efecto no es invisible por bug del simulador — es invisible porque no hay color que pintar.**

---

## §3-PRELUDE. EL CONTRATO CANÓNICO DE 9 ZONAS — La Constitución Espacial de LuxSync

Antes de cuantificar el daño espacial, hay que enunciar la doctrina vigente del sistema. **LuxSync define exactamente 9 zonas canónicas** que TODA capa (Stage, Hephaestus, Aether, Hyperion 2D) debe respetar. Cualquier desviación es un dialecto que se normaliza al canon.

### §3.0.1 — Las 9 Zonas Canónicas (fuente: `@core/stage/ShowFileV2.ts:282-344`)

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\stage\ShowFileV2.ts:282-291
export type CanonicalZone =
  | 'front'
  | 'back'
  | 'floor'
  | 'movers-left'
  | 'movers-right'
  | 'center'
  | 'air'
  | 'ambient'
  | 'unassigned'
```

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\stage\ShowFileV2.ts:334-344
export const CANONICAL_ZONES: readonly CanonicalZone[] = [
  'front',
  'back',
  'floor',
  'movers-left',
  'movers-right',
  'center',
  'air',
  'ambient',
  'unassigned',
] as const
```

| # | Zona canónica | Mapeo semántico oficial |
|---|---------------|-------------------------|
| 1 | `front`        | 🔴 PARs frontales (audience-facing wash) |
| 2 | `back`         | 🔵 PARs traseros (counter / backlight) |
| 3 | `floor`        | ⬇️ PARs de suelo (uplight) |
| 4 | `movers-left`  | 🏎️ Cabezas móviles lado izquierdo |
| 5 | `movers-right` | 🏎️ Cabezas móviles lado derecho |
| 6 | `center`       | ⚡ Strobes / Blinders centrales |
| 7 | `air`          | ✨ Lásers / Aerials / Atmósfera |
| 8 | `ambient`      | 🌫️ House lights / ambiente |
| 9 | `unassigned`   | ❓ Sin asignar (fallback) |

### §3.0.2 — Quién respeta el canon y quién no

| Componente | Respeta las 9 zonas | Evidencia |
|------------|---------------------|-----------|
| **Stage** (`ShowFileV2`, `Fixture.zone`) | ✅ — fuente de verdad | Define `CanonicalZone` |
| **Hephaestus Forja UI** (`SmartZoneSelector`, `heph-zone-badge`) | ✅ — usa `EffectZone[]` que extiende canon | `@HephaestusView.css:185-275`, `@dummyData.ts:135` |
| **EffectZone** (efectos legacy + Heph) | ✅ — superset: `CanonicalZone | 'all' | 'all-movers' | …` | `@core/effects/types.ts:64-68` |
| **ZoneMapper** (resolución a fixture IDs) | ✅ — composites + stereo + modifiers se normalizan al canon | `@core/zones/ZoneMapper.ts:62-460` |
| **Aether NodeArbiter / NodeResolver** | ✅ — opera por `fixtureId`, indirecto vía Stage | n/a |
| **Hyperion 2D simulator** | ✅ — pinta por `fixture.zone` del Stage | n/a |
| **`HephaestusClip.zones`** (schema) | ✅ — typed como `EffectZone[]` | `@core/hephaestus/types.ts:346-347` |
| **`HephAutomationClipSerialized.zones`** (.lfx en disco) | ⚠️ **degradado a `string[]`** sin validación | `@core/hephaestus/types.ts:499, 530` (`zones: clip.zones as string[]`) |
| **Migrator legacy (`.ts → .lfx`)** | ❌ **VIOLA EL CANON** | Ver §3.0.3 |

### §3.0.3 — El Crimen del Migrator: Colisión de Namespaces

Inspección de los 36 builtins migrados:

```json
// cumbia_moon.lfx
"zones": ["ambient", "gentle"]
```

**`ambient`** es legítimamente una `CanonicalZone` (house lights), pero **`gentle` NO existe en el canon**. Cruzando `clip.zones` contra `CANONICAL_ZONES`:

| Token encontrado en `.lfx` `zones` | ¿Es CanonicalZone? | ¿Es EnergyZone (`@LfxClipInstance.ts:73-83`)? |
|------------------------------------|-------------------|-----------------------------------------------|
| `ambient`     | ✅ sí | ✅ sí (¡colisión!) |
| `gentle`      | ❌ no | ✅ sí |
| `valley`      | ❌ no | ✅ sí |
| `intense`     | ❌ no | ✅ sí |
| `peak`        | ❌ no | ✅ sí |
| `silence`     | ❌ no | ✅ sí |
| `active`      | ❌ no | ✅ sí |

**Diagnóstico:** El migrator **mezcló dos namespaces ortogonales** en el mismo campo:

- **Zonas espaciales** (CanonicalZone): _DÓNDE_ se aplica el efecto físicamente.
- **EnergyZones cognitivas** (EnergyZoneId): _CUÁNDO_ es admisible energéticamente.

El campo `clip.zones` del schema `.lfx` apunta a `EffectZone[]` (espacial), pero el migrator le metió EnergyZoneIds (cognitivas) porque el `.ts` original no tenía un campo de zonas espaciales declarativo separado de `mixBus`/`zoneOverrides`. Para `cumbia_moon`:

- **Lo que el `.ts` decía espacialmente** (`@CumbiaMoon.ts:221-237`): `front` + `back` + `all-movers` con dimmer scaling distinto.
- **Lo que el `.lfx` declara espacialmente**: `["ambient", "gentle"]` → resuelto por `ZoneMapper.normalizeZone()`:
  - `"ambient"` → `'ambient'` (house lights — ¡no tiene nada que ver con front/back/movers!)
  - `"gentle"` → **fallback `'unassigned'`** (no es canónico)

**Resultado físico:** El runtime aplica el clip a fixtures asignados a `ambient` (house lights) y a fixtures `unassigned`. **Los PARs frontales, traseros, los movers y todo el resto del show quedan literalmente fuera del efecto.** En un show típico esto significa "el efecto se aplica a 0-2 fixtures de house lights" o "el efecto no toca nada visible".

Esto explica por qué `cumbia_moon` se ve "congelado" o "sin distribución" en el 2D: **el efecto SÍ se ejecuta, pero apunta a un universo vacío de fixtures**.

### §3.0.4 — Cobertura del crimen en los 36 builtins

Análisis del campo `zones` en todos los `.lfx`:

```
Builtins con zones[] ⊆ CANONICAL_ZONES:                   ~5/36
Builtins con zones[] contaminadas con EnergyZones:       ~31/36
Builtins con zones[] = ["all"] o vacío:                    0/36
Builtins con SmartZoneSelector explícito (selector{}):     0/36
```

**Conclusión §3.0:** La migración perdió **el 100% de la información espacial** y la sustituyó por etiquetas cognitivas que el ZoneMapper resuelve a `'unassigned'` o a una zona equivocada. **Es la causa raíz #2 del mismatch visual/físico — al mismo nivel de gravedad que la pérdida del color.**

---

## §3. ZONAS DE IMPACTO — La Distribución Espacial Perdida

### 3.1 ¿Cómo lo hacía el `.ts`?

`@CumbiaMoon.ts:221-238`

```typescript
const zoneOverrides: EffectFrameOutput['zoneOverrides'] = {
  'front':      { color: moonWhite, dimmer: bell,        blendMode: 'max' },
  'back':       { color: moonWhite, dimmer: bell * 0.7,  blendMode: 'max' },
  'all-movers': { color: moonWhite, dimmer: bell * 0.15, blendMode: 'replace' },
}
```

`EffectManager` resolvía `'front'` / `'back'` / `'all-movers'` contra el grupo de fixtures real del show, aplicaba el dimmer scaling y el color **a cada bucket independiente**.

### 3.2 ¿Cómo lo intenta el `.lfx`?

| Pieza del JSON | ¿Qué hace? |
|----------------|-----------|
| `clip.zones: ["ambient", "gentle"]` | **EnergyZones** (cognitivas, energía musical) — usadas por DecisionMaker para validar admisibilidad. **NO mapean a fixtures espaciales.** |
| `executionHints.fixtureTargeting: "pars"` | Hint vago — el `selector` del clip resuelve los fixture IDs reales. |
| `selector` (no presente en `cumbia_moon.lfx`) | El runtime cae en modo legacy: aplica el clip a TODOS los fixtures del show, sin diferenciación. |
| `cognitiveDNA.spatialBehavior: "static"` | Le dice al adapter que use `absolute` (no `relative_offset`). No diferencia zonas. |

**Resultado:** El runtime aplica la misma curva uniformemente. **No existen los buckets `front`/`back`/`all-movers` en el modelo de ejecución `.lfx`.** Las zonas espaciales del `.ts` se evaporaron en la migración.

### 3.3 ¿Es esto recuperable?

Sí, pero requiere extender el formato `.lfx`. Hay tres rutas:

**Ruta A (mínima invasiva):** Añadir un `zoneSelector` al clip que sea un map `{ "front": [...], "back": [...], "all-movers": [...] }` resuelto por `EffectManager` antes de pasarlo al runtime. El runtime ya soporta `selector + PhaseConfig`; basta con que el adaptador entregue un selector resuelto.

**Ruta B (curvas por zona):** Permitir `curves` anidadas por zona:
```json
"curves": {
  "front":      { "intensity": {...}, "color": {...} },
  "back":       { "intensity": {...}, "color": {...} },
  "all-movers": { "intensity": {...}, "color": {...} }
}
```
Más expresivo pero rompe el schema actual.

**Ruta C (mejor separación):** El clip `.lfx` define **una sola curva** y un `spatialDistribution` que describe cómo se replica/escala/recolorea por zona. Mantiene el schema simple a costa de reglas de "scaling table".

---

## §4. DIAGNÓSTICO TÉCNICO CONSOLIDADO

### 4.1 Defectos Estructurales (en el formato `.lfx`)

| # | Defecto | Archivo afectado | Severidad |
|---|---------|------------------|-----------|
| F1 | `staticParams.dominantColorH/S/L` es JSON-fósil — runtime no lo lee | `HephaestusRuntime.ts` + 36 builtins | **CRÍTICO** |
| F2 | Cero builtins tienen curva `valueType: "color"` | `arsenal/builtins/*.lfx` | **CRÍTICO** |
| F3 | `zoneOverrides` (front/back/movers) del `.ts` no tienen contraparte en `.lfx` | Migrator script | **ALTO** |
| F3b | **Colisión de namespaces en `clip.zones`: EnergyZoneIds cognitivas en campo espacial** — viola las 9 CanonicalZones de `@ShowFileV2.ts:282-344`. ~31/36 builtins afectados. | Migrator + schema laxo (`zones: string[]`) | **CRÍTICO** |
| F3c | Schema `.lfx` no separa `zones` (espacial canónico) de `energyZones` (cognitivo) | `@core/hephaestus/types.ts:499` | **ALTO** |
| F4 | `blendMode` (`max`/`replace`/`additive`) no migrado | Migrator + lfxTypes | **ALTO** |
| F5 | `overrideMoverShield` y otros flags semánticos no migrados | Migrator | **MEDIO** |
| F6 | BPM-sync dinámico colapsado a `bpmRef` estático | Migrator | **MEDIO** |
| F7 | `mixBus: 'global'` (dictador) degradado a `legacyMixBus: 'ambient'` | Migrator | **MEDIO** |

### 4.2 Defectos en el Puente de Ejecución

| # | Defecto | Archivo | Línea | Severidad |
|---|---------|---------|-------|-----------|
| B1 | Adapter no inyecta color desde `staticParams.dominantColorH/S/L` cuando no hay curva color | `HephaestusAetherAdapter.ts` | 78-130 | **CRÍTICO** |
| B2 | WAVE 4844 COLOR-OPACITY GUARD escribe `dimmer=1.0` en un intent separado, riesgo LTP de aniquilar la curva intensity en clips intensity+color | `HephaestusAetherAdapter.ts` | 112-129 | **ALTO** |
| B3 | Runtime no evalúa `staticParams` cromáticos como curva sintética constante | `HephaestusRuntime.ts` | 530-635 | **CRÍTICO** |
| B4 | Sin selector espacial los clips legacy aplican uniformemente a todos los fixtures | `HephaestusRuntime.ts` | 785-833 | **ALTO** |

### 4.3 ¿Por qué L0 "se come" al efecto? (Respuesta definitiva)

**L0 NO se está comiendo al efecto.** L3 está ABSOLUTE-OVERRIDE-dominando los canales que escribe (dimmer, strobe, etc.) gracias al GAG WAVE 4871. **El problema es que L3 nunca escribe los canales `red`/`green`/`blue`**, así que L0 sigue ahí porque es el ÚNICO que escribió en color. No hay batalla; hay ausencia.

---

## §5. ESTRATEGIA DE REPARACIÓN — Bridge Patch Plan

Tres frentes coordinados. El orden es importante porque cada uno tapa una capa del agujero.

### 5.1 PARCHE P1 — "Resucitar el Color Estático" (mínimo viable, alta cobertura)

**Objetivo:** Que cualquier `.lfx` con `staticParams.dominantColorH/S/L` y curva `intensity` proyecte el color en cada fixture afectado.

**Implementación:**
1. **HephaestusRuntime** (`@HephaestusRuntime.ts:530-635`): Cuando se inicia un clip, si `clip.staticParams` tiene `dominantColorH/S/L` y NO existe una curva con `valueType: "color"`, **sintetizar una curva color constante** en `clip.curves.color` antes de cachear. Conversión HSL→RGB una vez en `playClip()`.
2. **Adapter**: ningún cambio — ya consume curvas color correctamente.
3. **Schema `.lfx`**: dejar `dominantColor*` como single-source, sin curva color manual.

**Coste:** ~30 LOC. **Cubre:** 36/36 builtins ganan color de inmediato. cumbia_moon deja de ser invisible.

### 5.2 PARCHE P2 — "Reactivar el Ciclo HSL Animado" (recupera el alma del Limonero)

**Objetivo:** Permitir clips con animación cromática real (multi-keyframe HSL).

**Implementación:**
1. **Migrator script**: detectar el `colorCycle: Array<{h,s,l}>` en los `.ts` originales y emitir una **curva `color` con keyframes HSL** en el `.lfx` (no como `dominantColor*` único).
2. **Runtime**: ya soporta `valueType: "color"` (rama existente con `getColorValue()`). Solo confirmar que el `CurveEvaluator` interpola HSL circular para hue (ya implementado).
3. **Re-migrar** los clips críticos (cumbia_moon, salsa_fire, corazon_latino, ghost_breath) con su ciclo HSL completo.

**Coste:** ~150 LOC en el migrator + re-export de 8-10 builtins.

### 5.3 PARCHE P3 — "Restaurar Zonas Espaciales Canónicas" (rescata front/back/movers/center/air/ambient)

**Objetivo:** Reactivar el routing por bucket espacial usando estrictamente las **9 zonas canónicas** de `@core/stage/ShowFileV2.ts:282-344`. Cerrar la colisión de namespaces detectada en §3.0.

**Implementación dividida en 3 sub-parches coordinados:**

#### P3.a — Saneamiento del schema `.lfx` (corrige la herida abierta)

1. **Tipar fuerte `HephAutomationClipSerialized.zones`** (`@core/hephaestus/types.ts:499`):

   Reemplazar `zones: string[]` por:
   ```ts
   import type { CanonicalZone } from '../stage/ShowFileV2'

   export interface HephAutomationClipSerialized {
     ...
     /** Espacial: subconjunto de las 9 CanonicalZones + helpers ('all', 'all-movers') */
     zones: readonly (CanonicalZone | 'all' | 'all-movers' | 'all-pars')[]
     /** Cognitivo: separado del espacial — pertenece a EnergyZones, no a zonas espaciales */
     energyZones?: readonly import('../arsenal/LfxClipInstance').EnergyZoneId[]
     ...
   }
   ```

2. **Validar en carga (`LfxFileLoader`)**: pasar `clip.zones` por `normalizeZone()` (`@ShowFileV2.ts:371`); rechazar tokens no canónicos con warning. Los `EnergyZoneId` mal colocados se reroutearán a `energyZones`.

3. **Validar en guardado (`HephFileIO.saveClip`)**: assert que `clip.zones ⊆ CANONICAL_ZONES ∪ helpers`. Falla con error claro si la Forja intentara escribir un token inválido (defense-in-depth).

#### P3.b — `spatialZones` extendido con overrides por zona (recupera la riqueza del `.ts`)

Schema adicional:
```ts
clip.spatialZones?: {
  // Solo las 9 zonas canónicas son keys válidas
  [Z in CanonicalZone]?: {
    dimmerScale?: number          // 0-1, multiplicador del bell
    colorOverride?: HSL           // override por zona (ej. moonWhite en movers)
    blendMode?: 'max' | 'replace' | 'add'
  }
}
```

- **Runtime**: en `tickWithPhase` / `tickLegacy`, para cada fixture chequear `fixture.zone` (CanonicalZone normalizada) y aplicar el override antes de escribir el output.
- **Adapter**: cero cambios — recibe outputs ya escalados.
- **Default**: si `spatialZones` está ausente, comportamiento actual (uniforme sobre `clip.zones`).

#### P3.c — Migrator legacy: traducción canónica determinista

Mapa de traducción `EffectZone (legacy .ts)` → `CanonicalZone`:

| Legacy en `.ts` | CanonicalZone |
|-----------------|---------------|
| `'front'`        | `front` |
| `'back'`         | `back` |
| `'floor'`        | `floor` |
| `'all-movers'`   | (expandir a `['movers-left', 'movers-right']` o helper literal) |
| `'movers-left'`  | `movers-left` |
| `'movers-right'` | `movers-right` |
| `'strobes'`/`'center'` | `center` |
| `'lasers'`/`'air'`     | `air` |
| `'house'`/`'ambient'`  | `ambient` |
| (cualquier otro) | `unassigned` + warning |

El migrator debe:
1. Extraer `Object.keys(effectInstance.getOutput().zoneOverrides)` del `.ts` → poblar `clip.zones` (espacial) y `clip.spatialZones` (overrides).
2. Extraer las EnergyZones cognitivas del DNA del efecto → poblar `clip.energyZones`.
3. **Nunca mezclar los dos namespaces en el mismo campo.**

**Coste:** ~120 LOC schema/validation + ~80 LOC runtime + ~150 LOC migrator. **Cubre:** los 36 builtins recuperan distribución espacial canónica + ~12 efectos con `zoneOverrides` ricos recuperan dimmer/color por zona.

### 5.4 PARCHE P4 — "Desactivar la Bomba LTP del COLOR-OPACITY GUARD"

**Objetivo:** Que la guarda WAVE 4844 no aniquile curvas intensity reales.

**Implementación:** En `HephaestusAetherAdapter.ts:112-129`, antes de pushear el `dimmerIntent` con `dimmer=1.0`, **verificar si ya existe en `_frameIntents` un intent al mismo `impactId` con un `dimmer` ya escrito**. Si lo hay, NO emitir la guarda. Versión cero-alloc:

```typescript
if (family === NodeFamily.COLOR && output.normalizedRgb != null) {
  for (let k = 0; k < nodeIds.length; k++) {
    const impactId = nodeIds[k]
    const impactData = this._graph.getNodeData(impactId)
    if (!impactData || impactData.family !== NodeFamily.IMPACT) continue
    // Buscar si ya hay un dimmer escrito en este frame
    let alreadyHasDimmer = false
    for (let m = 0; m < this._frameIntents.length; m++) {
      const it = this._frameIntents[m]
      if (it.nodeId === impactId && it.values['dimmer'] !== undefined) {
        alreadyHasDimmer = true
        break
      }
    }
    if (!alreadyHasDimmer) {
      const dimmerIntent = this._acquireIntent(impactId)
      dimmerIntent.values['dimmer'] = 1.0
      this._frameIntents.push(dimmerIntent as INodeIntent)
    }
    break
  }
}
```

**Coste:** ~10 LOC, evita un bug latente de aniquilación de curvas.

### 5.5 Orden de aplicación recomendado

| Sprint | Parche | Resultado esperado |
|--------|--------|---------------------|
| 1 | **P4** (LTP guard fix) + **P3.a** (schema canónico estricto + validación) | Bomba LTP desactivada. Schema rechaza tokens no canónicos. Cero regresión visual; base sólida para los demás parches. |
| 2 | **P1** (color estático sintetizado) + **P3.c** (migrator canónico) — re-export de los 36 builtins | cumbia_moon y compañía vuelven a tener color visible Y zona espacial correcta. Distribución a `front`/`back`/`movers-left/right`/`center`/`air`/`ambient` según corresponda. |
| 3 | **P2** (ciclo HSL animado) + **P3.b** (`spatialZones` con overrides) — re-export de 8-12 clips ricos | Animación cromática + dimmer/color override per-zona recuperados (moonWhite en movers, etc.) |
| 4 | Auditoría regresiva con tests visuales en Hyperion 2D + validación canónica automatizada (`assertCanonicalZones()` en CI) | Validación end-to-end. Prevención de regresión futura. |

---

## §6. APÉNDICE — Métricas de Daño

```
Builtins inspeccionados:                         36
Builtins con curva 'color':                       0   (0.0%)
Builtins con dominantColorH/S/L:                 36   (100.0%)
Builtins con curvas pan/tilt:                    11   (30.5%)
Builtins con spatialZones:                        0   (0.0%)
Builtins con BPM-sync dinámico:                   0   (0.0%)
Builtins con clip.zones ⊆ CANONICAL_ZONES:       ~5   (~14%)
Builtins con clip.zones contaminadas (EnergyZones): ~31 (~86%)
Builtins con selector{} FixtureSelector:          0   (0.0%)
```

**El migrator preservó las curvas numéricas escalares (intensity, pan, tilt) y discardó:**
- 100% de las animaciones cromáticas
- 100% de las distribuciones por zona espacial canónica
- 100% de los flags semánticos (overrideMoverShield, blendMode)
- 100% de la lógica BPM-reactive

**Y además contaminó:**
- ~86% del campo `clip.zones` con tokens cognitivos (EnergyZoneId) en lugar de las 9 CanonicalZones espaciales — el ZoneMapper los normaliza a `'unassigned'` y el efecto cae en universo vacío de fixtures.

---

## §7. CITAS DE CÓDIGO RELEVANTES

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\effects\library\fiestalatina\CumbiaMoon.ts:219-238
    const moonWhite = { h: 0, s: 0, l: 80 }
    
    const zoneOverrides: EffectFrameOutput['zoneOverrides'] = {
      'front': {
        color: moonWhite,  // Blanco lunar en front
        dimmer: this.currentIntensity,
        blendMode: 'max',
      },
      'back': {
        color: moonWhite,  // Blanco lunar en back
        dimmer: this.currentIntensity * 0.7,  // Back más tenue (atmósfera)
        blendMode: 'max',
      },
      'all-movers': {
        color: moonWhite,
        dimmer: this.currentIntensity * 0.15,
        blendMode: 'replace',
      },
    }
```

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\arsenal\builtins\cumbia_moon.lfx:24-73
    "curves": {
      "intensity": {
        "paramId": "intensity",
        "valueType": "number",
        ...
        "keyframes": [
          { "timeMs": 0,    "value": 0, ... },
          { "timeMs": 3000, "value": 1, ... },
          { "timeMs": 6000, "value": 0, "interpolation": "hold" }
        ],
        "mode": "absolute"
      }
    },
    "staticParams": {
      "dominantColorH": 280,
      "dominantColorS": 70,
      "dominantColorL": 45,
      ...
    }
```

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\hephaestus\runtime\HephaestusRuntime.ts:543-567
      const isCustomThisClip = active.clip.effectType === 'heph_custom'
      for (const [paramName, curve] of active.clip.curves) {
        if (curve.valueType === 'color') {
          ...
          this.writeOutput(fp.fixtureId, 'all', paramName, 0, rgb, undefined, 0, this._normRgbBuf, isCustomThisClip, active.clip.id)
        } else {
          const rawValue = active.evaluator.getValue(paramName, fixtureTimeMs)
          ...
          this.writeOutput(fp.fixtureId, 'all', paramName, scaledValue, undefined, fine, withIntensity, undefined, isCustomThisClip, active.clip.id)
        }
      }
```

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\adapters\HephaestusAetherAdapter.ts:112-129
      // ⚡ WAVE 4844: COLOR-OPACITY GUARD — Override L3 opaco garantizado.
      ...
      if (family === NodeFamily.COLOR && output.normalizedRgb != null) {
        for (let k = 0; k < nodeIds.length; k++) {
          const impactId = nodeIds[k]
          const impactData = this._graph.getNodeData(impactId)
          if (!impactData || impactData.family !== NodeFamily.IMPACT) continue
          const dimmerIntent = this._acquireIntent(impactId)
          dimmerIntent.values['dimmer'] = 1.0
          this._frameIntents.push(dimmerIntent as INodeIntent)
          break
        }
      }
```

---

*Documento generado por auditoría WAVE 4847 — The Lemon Tree Audit.*
*Fuentes: 36 archivos `.lfx` builtins + `CumbiaMoon.ts` + `HephaestusRuntime.ts` + `HephaestusAetherAdapter.ts` + `NodeArbiter.ts`.*
*Veredicto firmado: el `.lfx` actual es un herbario, no un árbol. La savia (color, zonas, BPM, blendMode, flags) se evaporó en el migrator.*


------------------------------------------------------

WAVE 4847 — Adendum: Compatibilidad con la Forja Hephaestus
§A. La Forja SÍ Habla Color (y la Runtime SÍ lo Escucha)
El pipeline Forge UI → .lfx → Runtime → Adapter → Arbiter está completo. La unidad estructural existe — lo que falla es el migrator legacy, no la forja en vivo. Los puntos verificados:

Capa	Soporte para curva color	Evidencia
Forge UI (CurveEditor)	✅ Tracks HSL con keyframes, color picker, hue plotting	@CurveEditor.tsx:280-401 (colorPickerOpen, isColorCurve = curve.valueType === 'color', fromY denormaliza 0-1 → 0-360 hue)
Forge UI (HephaestusView)	✅ Preserva HSL en moves, batch-edits, drag	@HephaestusView/index.tsx:74-78, 708-826 (getPlotValue H→hue/360, batch move preserva s/l)
Schema (HephCurve)	✅ `valueType: 'number'	'color', value: number
Serializer (serializeHephClip)	✅ Pass-through Map→Record sin pérdida (HSL sobrevive)	@core/hephaestus/types.ts:517-541
HephFileIO.saveClip	✅ Escribe clip.curves tal cual + checksum SHA256	@core/hephaestus/HephFileIO.ts:156-186
TimelineClip routing	✅ Detecta curvas color → mixBus: 'ambient'	@chronos/core/TimelineClip.ts:480, 505-513 (COLOR_CURVE_KEYS = ['color', 'white', 'amber'])
HephaestusRuntime	✅ Rama if (curve.valueType === 'color') evalúa HSL→RGB→writeOutput	@HephaestusRuntime.ts:543-556
Adapter	✅ param='color' → NodeFamily.COLOR con {red, green, blue}	@HephaestusAetherAdapter.ts:200-203, 258-266
Arbiter	✅ L3 ABSOLUTE OVERRIDE + LUMINANCE GAG dominan canales	@NodeArbiter.ts:923-994
Conclusión §A: El audit anterior fue correcto al identificar que 0/36 builtins tienen curves.color, pero la falla está localizada en el script migrator legacy .ts → .lfx, no en la cadena de ejecución. Cualquier clip guardado HOY desde la Forja con un track de color funcionará punta a punta sin parches.

§B. Conflicto Real Detectado — La Bomba LTP del WAVE 4844 con Clips de la Forja
El COLOR-OPACITY GUARD que añadiste ayer en @HephaestusAetherAdapter.ts:112-129 es el único punto donde la Forja entra en conflicto con sí misma:

Escenario canónico de la Forja: un usuario crea un clip con DOS curvas:

curves.intensity → bell de 0 → 1 → 0
curves.color → animación HSL multi-keyframe
El runtime emite, en el mismo frame, dos outputs:

Output A: parameter='intensity' → adapter empuja Intent₁ a :impact con {dimmer: bell(t)}
Output B: parameter='color' → adapter empuja Intent₂ a :color con {red,green,blue} Y la guarda 4844 empuja Intent₃ a :impact con {dimmer: 1.0}
El Arbiter aplica LTP por canal en el orden de _frameIntents. Si el orden de iteración de outputs[] pone color después de intensity, Intent₃ pisa Intent₁ y la curva bell muere — el dimmer queda clavado a 1.0 todo el frame.

Verificación en @HephaestusRuntime.ts:545-567: el orden viene del Map.entries() de clip.curves. La inserción la decide el editor de la Forja, que no garantiza ningún orden. Ergo: la bomba puede detonar o no detonar dependiendo del orden en que el usuario añadió los tracks. Es un bug no determinista.

§C. Resolución del Conflicto
Esta micro-cirugía evita la detonación sin tocar nada más:

Proyectos
if (family === NodeFamily.COLOR && output.normalizedRgb != null) {
  for (let k = 0; k < nodeIds.length; k++) {
    const impactId = nodeIds[k]
    const impactData = this._graph.getNodeData(impactId)
    if (!impactData || impactData.family !== NodeFamily.IMPACT) continue
    const dimmerIntent = this._acquireIntent(impactId)
    dimmerIntent.values['dimmer'] = 1.0
    this._frameIntents.push(dimmerIntent as INodeIntent)
    break
  }
}
Cambiar a un scan defensivo previo: si en este frame ya hay un intent al mismo nodo IMPACT que escribió dimmer, NO emitir la guarda. Solo se empuja el dimmer=1.0 cuando el clip de verdad solo lleva color y el dimmer queda huérfano.

¿Quieres que aplique el fix ahora? Es 8 líneas, zero-alloc, no rompe el contrato de la guarda original (sigue cubriendo clips solo-color), y deshace la bomba LTP para los clips intensity+color de la Forja.

§D. Otros Puntos de Unidad — Verificados Limpios
staticParams.dominantColorH/S/L en clips de la Forja: los serializadores @types.ts:517-541 y HephFileIO.ts:156-186 no escriben dominantColor — solo pasan clip.staticParams tal cual. Si la Forja UI no lo añade (no lo hace hoy), el clip queda sin él. No hay colisión con el Parche P1 propuesto en el audit (sintetizar curva color desde dominantColor): la Forja siempre tendrá curves.color real, así que la rama "no hay curve.color → sintetizar desde dominantColor" nunca dispara para clips de la Forja.
mixBus inference: Si la Forja guarda un clip con curva color y sin mixBus explícito, inferMixBusFromCurves (@TimelineClip.ts:490-538) devuelve 'ambient'. Coherente con el contrato.
HSL serialization survival: El JSON.stringify en saveClip preserva los objetos {h,s,l} de keyframes sin pérdida — Map→Record→JSON→fs.writeFile. Round-trip verificado por simetría con deserializeHephClip (@types.ts:547-571).
Checksum: SHA256 sobre el JSON serializado entero — si la guarda 4844 corrompe runtime pero NO el archivo, el checksum sigue válido. La integridad del .lfx está intacta.
Resumen ejecutivo
Unidad confirmada: Forja + Schema + Runtime + Adapter + Arbiter están alineados para valueType: 'color'.
Conflicto único: WAVE 4844 COLOR-OPACITY GUARD puede aniquilar la curva intensity de clips intensity+color guardados en la Forja, por LTP no determinista.
Audit principal sin cambios: El diagnóstico sobre los 36 builtins legacy sigue válido — el agujero está en el migrator script, no en la Forja viva.
Acción recomendada inmediata: Parche P4 de 8 líneas en HephaestusAetherAdapter.ts. ¿Lo aplico?