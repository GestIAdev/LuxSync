# REPORTE FORENSE WAVE-SPLIT-BRAIN

## DIAGNÓSTICO EJECUTIVO

Existe una **esquizofrenia de coordenadas** entre el Stage Constructor 2D, el TacticalCanvas y el pipeline DMX. El Constructor 2D escribe `position.x` con signo correcto, pero marca todos sus fixtures como `isPlaced: false`. Esta decisión de diseño fuerza al TacticalCanvas a ignorar las coordenadas espaciales reales y distribuir los fixtures visualmente por **paridad de índice de array** (`index % 2 === 0`), mientras que el `NodeExtractionPipeline` DMX usa `position.x` para enrutar a `front-left` / `front-right`. Resultado: un foco soltado a la derecha en 2D puede pintarse a la izquierda en TacticalCanvas, pero el DMX lo manda por el canal derecho.

---

## 1. EL GUARDADO DEL CONSTRUCTOR 2D

### 1.1 Cálculo de `position.x` al hacer drop

`@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\StageConstructor\StageCanvas2D.tsx:194-200`

```typescript
const fromSVG = useCallback((px: number, py: number): [number, number] => {
  const xm = ((px - MARGIN) / stageW) * stageWidth - stageWidth / 2
  const zm = ((py - MARGIN) / stageH) * stageDepth - stageDepth / 2
  return [
    Math.max(-stageWidth / 2, Math.min(stageWidth / 2, xm)),
    Math.max(-stageDepth / 2, Math.min(stageDepth / 2, zm)),
  ]
}, [stageW, stageH, stageWidth, stageDepth, MARGIN])
```

- **Izquierda del canvas** (`px = MARGIN`) → `xm = -stageWidth/2` (negativo) ✅
- **Derecha del canvas** (`px = MARGIN + stageW`) → `xm = +stageWidth/2` (positivo) ✅

**Conclusión:** El signo de `position.x` es correcto. Un drop a la derecha genera `x > 0`.

### 1.2 Asignación de zona (`inferZone`)

`@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\StageConstructor\StageCanvas2D.tsx:91-99`

```typescript
function inferZone(xFrac: number, zFrac: number): CanonicalZone {
  if (xFrac < 0.12)  return 'movers-left'
  if (xFrac > 0.88)  return 'movers-right'
  if (zFrac < 0.08)  return 'air'
  if (zFrac < 0.25)  return 'back'
  if (zFrac > 0.75)  return 'front'
  if (xFrac > 0.20 && xFrac < 0.80 && zFrac > 0.60 && zFrac < 0.74) return 'floor'
  return 'center'
}
```

**Problema semántico:** Un PAR soltado en la franja frontal DERECHA (`zFrac > 0.75`, `xFrac ≈ 0.7`) recibe:
- `zone = 'front'` (NO `'front-right'` — esa zona no existe en `FixtureV2`)
- `position.x = positivo` (sí está a la derecha físicamente)

No hay campo `side` en `FixtureV2`. El "lado" es inferido implícitamente por `position.x`, nunca explícito.

### 1.3 El flag `isPlaced: false` — La sentencia de muerte

`@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\StageConstructor\StageCanvas2D.tsx:333-339`

```typescript
let partialData: Partial<FixtureV2> = {
  type: mappedType,
  position: { x: xm, y: yHeight, z: zm },   // ← coordenadas reales escritas
  zone: zone as FixtureZone,
  orientation,
  isPlaced: false,   // 🔴 2D ≡ unplaced — condena al fixture al fallback visual
}
```

Tanto Path A (drag desde UnplacedTray) como Path B (drag desde librería) asignan **incondicionalmente** `isPlaced: false`. El Constructor 2D es, por diseño actual, un "mundo de fixtures no colocados".

---

## 2. TACTICALCANVAS vs DMX NODERESOLVER

### 2.1 TacticalCanvas — El render visual

`@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\hyperion\views\tactical\useFixtureData.ts:231-245`

```typescript
// 🎯 Spatial Truth: project 3D→2D when explicitly placed
if (stageFixture?.isPlaced === true && stageFixture.position) {
  const stageW = stageDimensions?.width ?? 12
  const stageD = stageDimensions?.depth ?? 8
  const rawX = stageFixture.position.x / stageW        // [-0.5, +0.5]
  const rawY = stageFixture.position.z / stageD
  fixture.x = Math.max(MARGIN, Math.min(1 - MARGIN, rawX + 0.5))
  fixture.y = Math.max(MARGIN, Math.min(1 - MARGIN, rawY + 0.5))
  return
}
```

**El `isPlaced === true` bloquea el camino.** Todo fixture del Constructor 2D salta al `else` (fallback).

### 2.2 TacticalCanvas — Fallback por zona (el origen del flip)

`@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\hyperion\views\tactical\useFixtureData.ts:248-264`

```typescript
if (isVertical && layout.fixedX !== undefined) {
  fixture.x = layout.fixedX
  fixture.y = distributeVertically(localIdx, count, layout.y)
} else {
  const [xMin, xMax] = layout.xRange
  fixture.x = distributeInRange(localIdx, count, xMin, xMax)
  fixture.y = layout.y
}
```

Para zonas **con stereo split** (`front`, `back`, `floor`), el código alterna L/R por paridad de índice:

`@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\hyperion\shared\ZoneLayoutEngine.ts:353-359`

```typescript
if (layout.stereo) {
  const isLeft = index % 2 === 0
  const range = isLeft ? layout.stereo.leftRange : layout.stereo.rightRange
  const totalPerSide = Math.ceil(count / 2)
  const halfIndex = isLeft ? Math.floor(localIdx / 2) : Math.floor((localIdx - 1) / 2)
  x = distributeInRange(halfIndex, totalPerSide, range[0], range[1])
}
```

**Diagnóstico:** La posición visual de un fixture `front` en TacticalCanvas depende de **su orden en el array**, no de `position.x`. Si es el primer `front` (índice par), aparece a la **izquierda** (`leftRange: [0.08, 0.42]`) aunque su `position.x` sea positivo (derecha).

### 2.3 DMX NodeExtractionPipeline — El enrutado real

`@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\ingestion\NodeExtractionPipeline.ts:276-290`

```typescript
private _resolveStereoAwareZone(zoneRaw: string, position?: Position3D): ZoneId {
  const normalized = normalizeZoneId(zoneRaw)
  const x = position?.x

  if ((normalized === 'front' || normalized === 'back') && typeof x === 'number' && !Number.isNaN(x)) {
    if (x < -0.1) {
      return (normalized === 'front' ? 'front-left' : 'back-left') as ZoneId
    }
    if (x > 0.1) {
      return (normalized === 'front' ? 'front-right' : 'back-right') as ZoneId
    }
  }
  return normalized as ZoneId
}
```

**Diagnóstico:** El pipeline DMX **sí lee `position.x`**. Un fixture `front` con `x > 0.1` se enruta a `front-right`. El DMX hace lo correcto; el visualizador no.

### 2.4 Tabla comparativa del Split Brain

| Sistema | Input para decidir L/R | Un fixture `front` con `x = +3m` (derecha) |
|---|---|---|
| **Constructor 2D** | `position.x = +3` (correcto) | Se dibuja a la derecha en el SVG |
| **TacticalCanvas** | `index % 2 === 0` (paridad array) | Si es índice par → **IZQUIERDA** 🔴 |
| **DMX NodeResolver** | `position.x > 0.1` | `front-right` ✅ |

---

## 3. FIX RECOMENDADO

### Principio
No tocar `isPlaced` (rompería UnplacedTray y StageCanvas2D). El fix debe hacer que `useFixtureData.ts` use `position.x` como fuente de verdad espacial cuando el fixture tiene coordenadas reales, incluso si `isPlaced === false`.

### Corte A — `useFixtureData.ts` (TacticalCanvas)

`@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\hyperion\views\tactical\useFixtureData.ts:231-245`

**Cambio:** Relajar la guarda de `isPlaced` para que cualquier fixture con posición no-sentinel use la proyección espacial.

```typescript
// 🎯 Spatial Truth: project 3D→2D when fixture has real coordinates
const pos = stageFixture?.position
const hasRealPosition = pos && !(pos.x === 0 && pos.y === 3 && pos.z === 0)

if (hasRealPosition) {
  const stageW = stageDimensions?.width ?? 12
  const stageD = stageDimensions?.depth ?? 8
  const rawX = pos.x / stageW
  const rawY = pos.z / stageD
  fixture.x = Math.max(MARGIN, Math.min(1 - MARGIN, rawX + 0.5))
  fixture.y = Math.max(MARGIN, Math.min(1 - MARGIN, rawY + 0.5))
  return
}
```

El sentinela `{x:0, y:3, z:0}` es el default de `createDefaultFixture`. Cualquier fixture que haya recibido un drag en el Constructor 2D tendrá `y ≠ 3`, así que pasará la guarda.

### Corte B — `useFixtureData.ts` (Fallback estéreo consciente de posición)

`@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\hyperion\views\tactical\useFixtureData.ts:248-264`

**Cambio:** Para fixtures que NO tienen posición real (truly unplaced), mantener el fallback por zona, pero usar `position.x` para decidir L/R cuando exista.

```typescript
if (layout.stereo) {
  // 🔥 WAVE-SPLIT-BRAIN FIX: Usar position.x si existe en lugar de paridad ciega
  const pos = stageFixture?.position
  const hasRealPosition = pos && !(pos.x === 0 && pos.y === 3 && pos.z === 0)
  const isLeft = hasRealPosition
    ? pos.x < 0
    : index % 2 === 0

  const range = isLeft ? layout.stereo.leftRange : layout.stereo.rightRange
  const totalPerSide = Math.ceil(count / 2)
  const halfIndex = isLeft ? Math.floor(localIdx / 2) : Math.floor((localIdx - 1) / 2)
  fixture.x = distributeInRange(halfIndex, totalPerSide, range[0], range[1])
}
```

### Resultado esperado

| Sistema | Comportamiento tras fix |
|---|---|
| Constructor 2D | Sigue igual (drag → posición real, `isPlaced: false`) |
| TacticalCanvas | Usa `position.x` para proyectar. Foco a la derecha → dibuja a la derecha ✅ |
| DMX NodeResolver | Ya usaba `position.x` → sin cambios, ya alineado ✅ |

---

## ANEXO: Nota sobre `front-left` / `front-right`

`normalizeZone` en `ShowFileV2.ts` no reconoce `front-left` / `front-right` como zonas canónicas. Estas sub-zonas son **internas al motor DMX** (`ZoneId` en Aether), nunca se persisten en `FixtureV2.zone`. El `FixtureV2.zone` se queda como `'front'`, y el `NodeExtractionPipeline` deriva `front-left`/`front-right` dinámicamente en tiempo de patch. Esto es correcto por diseño; el fix no necesita tocar el modelo de datos.
