# SEARCH & DESTROY — WAVE 4659

**Auditoría forense del pipeline de control manual (L2) y del motor cromático Selene.**
**Fecha:** 2026-05-08  
**Auditor:** Kimi (Cascade AI)  
**Estado:** 4 vectores analizados, causas raíz identificadas con líneas exactas.

---

## 🔍 VECTOR 1: LA FUGA DEL RADAR (Selection Isolation)

**Síntoma:** Al usar el radar individual sobre 1 mover, se mueven todos los fixtures seleccionados.

### Flujo de datos trazado

1. **Frontend — `KineticsBridge.ts`**
   - La suscripción a `spatialTarget` (líneas 99-114) llama a `_scheduleSpatialFlush` con `fixtureIds = getSelectedIds()`.
   - `getSelectedIds()` lee de `useSelectionStore.getState().getSelectedArray()` (líneas 38-41).

2. **IPC — `AetherIPCHandlers.ts`**
   - Handler `lux:aether:applySpatialTarget` (líneas 352-378) recibe el payload y delega a `masterArbiter.applySpatialTarget(target, fixtureIds, fanMode, fanAmplitude)`.
   - **NO hay filtrado adicional** de `fixtureIds` en el backend.

3. **Backend — `masterArbiter`**
   - `masterArbiter.applySpatialTarget()` recibe el array tal cual y calcula IK para cada fixture en la lista. Si la lista tiene 6 IDs, 6 movers se mueven.

### Causa raíz (hipótesis más probable)

El **frontend no está limpiando el `selectionStore`** al entrar al modo "radar individual". Si el usuario tenía 6 fixtures seleccionados en el `FixtureMatrix` y luego abre el radar individual (que visualmente muestra 1 fixture), `getSelectedIds()` sigue devolviendo los 6 IDs del store.

### Líneas exactas del crimen

```ts
// KineticsBridge.ts:39-41 — fuente de los fixtureIds
function getSelectedIds(): string[] {
  return useSelectionStore.getState().getSelectedArray()
}

// KineticsBridge.ts:102-109 — spatial target usa getSelectedIds sin filtrar por modo
const unsubSpatial = useMovementStore.subscribe(
  (s) => s.spatialTarget,
  (spatialTarget) => {
    const ids = getSelectedIds()   // ← AQUI: puede traer 6 fixtures
    if (ids.length === 0) return
    ...
    this._scheduleSpatialFlush(spatialTarget, ids, spatialFanMode, spatialFanAmplitude)
  },
)

// AetherIPCHandlers.ts:352-370 — backend no filtra, aplica a todos
ipcMain.handle(
  'lux:aether:applySpatialTarget',
  (_event, { target, fixtureIds, fanMode, fanAmplitude }) => {
    ...
    const results = masterArbiter.applySpatialTarget(
      target,
      fixtureIds,   // ← LLEGA EL ARRAY COMPLETO
      fanMode ?? 'converge',
      fanAmplitude ?? 0
    )
    ...
  }
)
```

### Destrucción propuesta

- **Opción A (frontend):** El componente de radar individual debe sobreescribir el `selectionStore` con `[singleFixtureId]` antes de emitir el spatial target, o usar un store de "target fixture" separado.
- **Opción B (bridge):** `_flushSpatial` debe recibir `fixtureIds` filtrados por el modo de radar (individual = 1, formación = todos los selected).

---

## 🔍 VECTOR 2: EL AGUJERO NEGRO DEL COLOR MANUAL

**Síntoma:** Los sliders de color RGB en la UI no afectan el hardware.

### Flujo de datos trazado

1. **Frontend — `ProgrammerAetherBridge.ts`**
   - `_flush()` (líneas 153-213) itera `activeFixtureIds` × `dirtySnapshot`.
   - Construye `nodeId = \`${fixtureId}:${FAMILY_LABEL[family]}\`` → ej: `mover-1:color`.
   - `extractColor()` (líneas 59-67) emite canales `red`, `green`, `blue`, `white`, `amber`.

2. **IPC — `AetherIPCHandlers.ts`**
   - Handler `lux:aether:setManualOverrides` (líneas 57-77) escribe cada payload en `arbiter.setManualOverride(nodeId, channels)`.

3. **Arbitraje — `NodeArbiter.ts`**
   - L2 (manual) se aplica **después** de L3 (efectos) en `arbitrate()` (líneas 204-216). L2 gana por LTP.

4. **Resolución — `NodeResolver.ts`**
   - `_writeNode()` (líneas 445-626) para nodos COLOR evalúa:
     ```ts
     const rNorm = channelValues[CH_R] ?? channelValues[CH_RED]
     const gNorm = channelValues[CH_G] ?? channelValues[CH_GREEN]
     const bNorm = channelValues[CH_B] ?? channelValues[CH_BLUE]
     if (rNorm !== undefined && gNorm !== undefined && bNorm !== undefined) {
       translatedValues = this._translateColor(...)
     }
     ```
   - `_translateColor()` traduce RGB → canales físicos según `mixingType` (`rgb`, `rgbw`, `cmy`, `wheel`, `hybrid`).

### Causa raíz (múltiples escenarios)

#### Escenario A — Control parcial destruye la traducción cromática
Si el usuario solo ajusta el slider **rojo** (`red=1`, `green=null`, `blue=null`), el bridge envía:
```ts
{ nodeId: 'mover-1:color', channels: { red: 1 } }
```
En `NodeResolver._writeNode()`, `gNorm` y `bNorm` son `undefined`. La condición `rNorm !== undefined && gNorm !== undefined && bNorm !== undefined` es **FALSA**. **No entra en `_translateColor()`**.

Si el fixture es `mixingType: 'cmy'` o `'wheel'`, los canales físicos (`cyan`, `magenta`, `yellow`, `color_wheel`) nunca se calculan. El fixture permanece en su valor default.

**Líneas del crimen:**
```ts
// NodeResolver.ts:525-538
if (node.family === NodeFamily.COLOR) {
  const rNorm = channelValues[CH_R] ?? channelValues[CH_RED]
  const gNorm = channelValues[CH_G] ?? channelValues[CH_GREEN]
  const bNorm = channelValues[CH_B] ?? channelValues[CH_BLUE]
  if (rNorm !== undefined && gNorm !== undefined && bNorm !== undefined) {
    // ← SI FALLA ESTA CONDICIÓN, WHEEL/CMY NUNCA SE TRADUCEN
    translatedValues = this._translateColor(...)
  }
}
```

#### Escenario B — Canales abstractos vs físicos
El bridge envía claves `red`, `green`, `blue`. El `NodeResolver` busca `CH_R` (`'r'`) primero, fallback a `CH_RED` (`'red'`). Esto funciona para fixtures con canales `red/green/blue` o `r/g/b`. Pero si el fixture tiene `mixingType: 'wheel'` y los canales manuales son parciales, `_translateColor` no se invoca.

#### Escenario C — L0 vs L1 vs L2
Aunque L2 tiene prioridad sobre L1 y L3, existe una **capa oculta**: `ForgeNodeEvaluator` (WAVE 4548.6). Si el device tiene un `CompiledForgeGraph` registrado, `_writeNode()` hace **bypass total** del flujo legacy (líneas 468-496):
```ts
const compiled = this._forgeGraphs.get(node.deviceId)
if (compiled) {
  ForgeNodeEvaluator.evaluate(compiled, channelValues, ...)
  return  // BYPASS: no ejecutar flujo legacy
}
```
Si el fixture tiene un grafo Forge compilado, el `ForgeNodeEvaluator` recibe `channelValues` (incluyendo `red`, `green`, `blue`) pero **el grafo Forge debe tener nodos de entrada para esos canales**. Si el grafo Forge no expone puertos de color manual, los overrides L2 son ignorados.

### Destrucción propuesta

1. **En `ProgrammerAetherBridge.extractColor`:** Siempre emitir los 3 canales RGB, rellenando con `0` los no tocados. Esto garantiza que `_translateColor` reciba rNorm/gNorm/bNorm definidos.
   ```ts
   function extractColor(ov: ProgrammerOverrides): Record<string, number> | null {
     const ch: Record<string, number> = {}
     ch['red']   = ov.red   ?? 0   // ← forzar 0 en lugar de omitir
     ch['green'] = ov.green ?? 0
     ch['blue']  = ov.blue  ?? 0
     ...
   }
   ```

2. **En `NodeResolver._writeNode`:** Para nodos COLOR con override manual parcial, forzar la traducción cromática usando valores default (`0`) para los canales faltantes.

3. **Audit de ForgeGraphs:** Verificar que los fixtures con grafo Forge compilado tengan puertos de entrada para `red`, `green`, `blue` (o sus equivalentes cromáticos).

---

## 🔍 VECTOR 3: LOS OSCILADORES MUDOS (Manual Patterns)

**Síntoma:** Los botones de patrón manual (Circle, Square, etc.) no producen movimiento.

### Flujo de datos trazado

1. **Frontend — `KineticsBridge.ts`**
   - Suscripción a `activePattern` (líneas 75-96) detecta cambios.
   - `_flushPattern()` (líneas 161-182) llama:
     ```ts
     await window.lux?.aether?.setManualPattern({
       fixtureIds,      // selectedIds
       pattern: enginePattern,  // 'circle' → 'circle_big', etc.
       speed: patternSpeed,
       amplitude: patternAmplitude,
     })
     ```

2. **IPC — `AetherIPCHandlers.ts`**
   - Handler `lux:aether:setManualPattern` (líneas 305-343) delega a `masterArbiter.setPattern(fixtureIds, { type, speed, size, center })`.

3. **Pipeline Aether (activo)**
   - `TitanOrchestrator` usa `KineticAdapter` (alias `VMMAdapter`, `src/core/aether/adapters/KineticAdapter.ts`).
   - `KineticAdapter.process()` (líneas 138-216) llama:
     ```ts
     const intent = this._vmm.generateIntent(vibeId, va, node.stereoIndex, node.stereoTotal, node.maxPanSpeed, phaseOffset)
     ```
   - `_vmm` es el singleton `vibeMovementManager` (línea 113).

4. **VibeMovementManager**
   - `generateIntent()` → `selectPattern()` (línea 921-938).
   - `selectPattern()` respeta `manualPatternOverride` (línea 923-925).
   - `manualPatternOverride` solo se establece via `setManualPattern()` (línea 591-614).

### Causa raíz — SPLIT-BRAIN CINÉTICO CONFIRMADO

**NADIE llama `vibeMovementManager.setManualPattern()` desde el pipeline Aether.**

- El `KineticsBridge` envía la orden manual a `masterArbiter.setPattern()` (pipeline **legacy**).
- El `KineticAdapter` lee de `vibeMovementManager.generateIntent()` (pipeline **Aether**).
- `vibeMovementManager.manualPatternOverride` permanece `null` para siempre.
- Resultado: `generateIntent()` siempre usa `selectPattern(config, audio)` que elige el patrón AI automático según el vibe. Los patrones manuales son **absorbidos por un agujero negro legacy**.

### Líneas exactas del crimen

```ts
// AetherIPCHandlers.ts:305-343 — la orden manual muere en masterArbiter LEGACY
ipcMain.handle(
  'lux:aether:setManualPattern',
  (_event, { fixtureIds, pattern, speed, amplitude }) => {
    ...
    masterArbiter.setPattern(fixtureIds, {   // ← LEGACY, NO AFECTA AETHER
      type: pattern as 'circle' | ...,
      speed: speedNorm,
      size: sizeNorm,
      center: { pan: anchorPos.pan, tilt: anchorPos.tilt },
    })
    ...
  }
)

// KineticAdapter.ts:113 — el adapter Aether lee de este singleton
private readonly _vmm: VibeMovementManager = vibeMovementManager

// KineticAdapter.ts:183 — generateIntent() SIEMPRE usa el VMM, nunca masterArbiter
const intent = this._vmm.generateIntent(vibeId, va, node.stereoIndex, ...)

// VibeMovementManager.ts:591-614 — setManualPattern() EXISTE pero NUNCA es llamado
// desde el pipeline Aether. El frontend no tiene ruta directa a este método.
```

### Destrucción propuesta

**Opción A (bridge directo, recomendada):**
En `KineticsBridge._flushPattern()`, además de enviar IPC a `masterArbiter`, llamar directamente al singleton:
```ts
// KineticsBridge.ts:161-182
private async _flushPattern(...): Promise<void> {
  const fixtureIds = getSelectedIds()
  if (fixtureIds.length === 0) return
  const enginePattern = toEnginePattern(activePattern)

  // WAVE 4659 FIX: alimentar también el VMM que usa KineticAdapter
  vibeMovementManager.setManualPattern(enginePattern)
  vibeMovementManager.setManualSpeed(patternSpeed)
  vibeMovementManager.setManualAmplitude(patternAmplitude)

  // IPC legacy (mantener hasta WAVE 4700)
  await window.lux?.aether?.setManualPattern({ fixtureIds, pattern: enginePattern, ... })
}
```

**Opción B (AetherIPCHandlers como proxy):**
En `AetherIPCHandlers.ts` handler `lux:aether:setManualPattern`, añadir:
```ts
// WAVE 4659 FIX: propagar al VMM para que KineticAdapter lo lea
vibeMovementManager.setManualPattern(pattern as string)
```

**Nota:** `vibeMovementManager` es un singleton global; llamar `setManualPattern()` desde cualquier lado afecta a TODOS los fixtures. Esto es correcto para patrones manuales (son globales por diseño), pero hay que verificar que `fixtureIds` no se usen para filtrar qué fixtures aplican el patrón. El `KineticAdapter` ya itera sobre los nodos KINETIC del graph; todos los nodos recibirán el mismo patrón global del VMM.

---

## 🔍 VECTOR 4: EL CUELLO DE BOTELLA DE SELENE (Color Engine Audit)

**Síntoma:** Los movers Left y Right pintan el **mismo color**; no hay variación L/R. Front y back sí reciben colores diferentes.

### Arquitectura de color actual

1. **`SeleneColorEngine.generate()`** (líneas 1081-1480) produce **una sola paleta** con 5 colores:
   - `primary`, `secondary`, `accent`, `ambient`, `contrast`

2. **`ColorAdapter.process()`** (`src/core/aether/adapters/ColorAdapter.ts`, líneas 140-175) asigna un **rol** a cada nodo COLOR basado en su zona:
   ```ts
   const role = selectColorRoleFromZone(node.zoneId ?? '')
   const rgb  = ingress[role]   // ← TODOS los nodos del mismo rol = MISMO color
   ```

3. **`selectColorRoleFromZone()`** (`src/core/aether/adapters/zoneUtils.ts`, líneas 213-236):
   ```ts
   case 'movers-left':
   case 'movers-right':
     return 'accent'   // ← AMBOS mapean al MISMO rol
   ```

### Causa raíz — MONO-ACENTO

`SeleneColorEngine` es **monopaleta por frame**: genera un único `accent` que se comparte por todos los movers. No existe `accentLeft` / `accentRight`. `ColorAdapter` tampoco aplica offset de fase ni modulación lateral al color.

Comparación con movimiento (donde SÍ hay variación L/R):
- `VibeMovementManager` aplica `stereoConfig.type === 'mirror'` o `'snake'` con `phaseOffset` (líneas 846-876).
- `KineticAdapter` pasa `phaseOffset = (node.physicalPosition?.x ?? 0) > 0 ? Math.PI : 0` (línea 181).
- **No existe equivalente cromático.** El color fluye mono.

### Líneas exactas del crimen

```ts
// SeleneColorEngine.ts:1576-1580 — accent es UNO solo
const accent: HSLColor = {
  h: normalizeHue(accentHue),
  s: 100,
  l: Math.max(70, primaryLight + 20),
};
// No hay accentL / accentR / accentLeft / accentRight.

// zoneUtils.ts:227-229 — L y R comparten el mismo rol
export function selectColorRoleFromZone(zoneId: string): 'primary' | 'secondary' | 'accent' | 'ambient' {
  switch (normalizeZoneId(zoneId)) {
    ...
    case 'movers-left':
    case 'movers-right':
      return 'accent'   // ← MISMO BALDE PARA AMBOS
    ...
  }
}

// ColorAdapter.ts:152-153 — todos los accent reciben el mismo RGB
const role = selectColorRoleFromZone(node.zoneId ?? '')
const rgb  = ingress[role]   // ← si role='accent', rgb es idéntico para L y R
```

### Destrucción propuesta

**Opción A — Zonificación cromática en Selene:**
Modificar `SeleneColorEngine.generate()` para que, cuando el vibe lo permita, genere `accentLeft` y `accentRight` con offset de hue (ej: ±15° del accent central). Esto mantiene la coherencia musical pero añade variación espacial.

```ts
// SeleneColorEngine.ts ~ línea 1576
const accent: HSLColor = { h: normalizeHue(accentHue), s: 100, l: ... };
// WAVE 4659: variación estéreo cromática
const accentLeft: HSLColor  = { ...accent, h: normalizeHue(accent.h - 15) };
const accentRight: HSLColor = { ...accent, h: normalizeHue(accent.h + 15) };
```

**Opción B — Diferenciación en zoneUtils + ColorAdapter:**
```ts
// zoneUtils.ts
export function selectColorRoleFromZone(zoneId: string): 'primary' | 'secondary' | 'accentLeft' | 'accentRight' | 'ambient' {
  switch (normalizeZoneId(zoneId)) {
    case 'movers-left':  return 'accentLeft'
    case 'movers-right': return 'accentRight'
    ...
  }
}

// ColorAdapter.ts:62 — expandir IColorIngressPalette
export interface IColorIngressPalette {
  readonly primary: RgbColor
  readonly secondary: RgbColor
  readonly accentLeft: RgbColor   // ← nuevo
  readonly accentRight: RgbColor  // ← nuevo
  readonly ambient: RgbColor
}
```

**Opción C — Modulación de fase en ColorAdapter (mínima invasión):**
En `ColorAdapter.process()`, detectar si el nodo es `movers-left`/`movers-right` y aplicar un desfase de hue al color `accent` antes de normalizar a RGB:
```ts
// ColorAdapter.ts:152-159
let rgb = ingress[role]
if (node.zoneId?.includes('movers')) {
  const hueShift = node.zoneId.includes('left') ? -15 : +15
  rgb = applyHueShift(rgb, hueShift)   // función HSL→shift→RGB
}
```

**Recomendación:** Opción B es la más limpia arquitectónicamente porque mantiene la separación de responsabilidades: Selene genera la paleta, zoneUtils mapea zonas a roles, ColorAdapter consume roles sin lógica adicional.

---

## 📋 RESUMEN EJECUTIVO

| Vector | Síntoma | Causa raíz | Líneas críticas | Fix recomendado |
|--------|---------|------------|-----------------|-----------------|
| **V1** | Radar individual mueve todos | `getSelectedIds()` no filtra por modo de radar | `KineticsBridge.ts:39-41`, `KineticsBridge.ts:102-109` | Filtrar `fixtureIds` según modo de radar antes de `_scheduleSpatialFlush` |
| **V2** | Color manual no llega | Control parcial destruye `_translateColor()`; Forge bypass puede ignorar canales manuales | `NodeResolver.ts:525-538`, `NodeResolver.ts:468-496` | Emitir siempre RGB completos desde bridge; auditar ForgeGraph inputs |
| **V3** | Patrones manuales mudos | Split-brain cinético: `masterArbiter` recibe la orden pero `KineticAdapter` lee de `vibeMovementManager` que nunca se entera | `AetherIPCHandlers.ts:305-343`, `KineticAdapter.ts:113`, `KineticAdapter.ts:183` | Propagar `setManualPattern()` al singleton `vibeMovementManager` desde `KineticsBridge` o `AetherIPCHandlers` |
| **V4** | Movers L/R mismo color | `SeleneColorEngine` genera un único `accent`; `zoneUtils` mapea `movers-left` y `movers-right` al mismo rol | `SeleneColorEngine.ts:1576`, `zoneUtils.ts:227-229`, `ColorAdapter.ts:152-153` | Expandir paleta a `accentLeft`/`accentRight` o diferenciar en zoneUtils |

---

## 🎯 Siguiente paso sugerido

1. **Prioridad P0 — V3 (Osciladores):** Es el fix más simple y de mayor impacto visual. Añadir 3 líneas en `KineticsBridge._flushPattern()` para alimentar el `vibeMovementManager`.
2. **Prioridad P1 — V4 (Selene L/R):** Requiere tocar `zoneUtils.ts`, `ColorAdapter.ts`, y opcionalmente `SeleneColorEngine.ts`. Cambio de interfaz `IColorIngressPalette`.
3. **Prioridad P2 — V1 (Radar):** Requiere decisión de UX: ¿el radar individual debe limpiar la selección global o usar un store propio?
4. **Prioridad P3 — V2 (Color manual):** Requiere verificación del comportamiento real del `programmerStore` (no auditado en este wave) y posible ajuste de `extractColor`.
