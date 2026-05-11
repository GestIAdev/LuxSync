# ⚡ WAVE 4595 — THE PHOTON TRACE
## Diagnóstico Forense: ¿Por qué los fotones mueren antes de llegar al hardware?

**Estado:** Apagón General. Motores analíticos OK. DMX output = 0.  
**Método:** Trazado estático de la ruta del fotón desde `LiquidStereoResult` hasta `Uint8Array[512]`.

---

## 🗺️ MAPA DE LA RUTA DEL FOTÓN

```
LiquidEngine → LiquidAetherAdapter.ingest()
                         ↓
          NodeArbiter (bus de intents)
                         ↓
            NodeResolver.resolve()
                         ↓
              Uint8Array[512] → DMX
```

---

## 🔍 VECTOR 1 — EL ADN: NodeExtractionPipeline vs. fixtures legacy

### ¿Cómo se llama? (desde WAVE 4594)

```typescript
// TitanOrchestrator._syncFixturesToAether()
const deviceDef = pipeline.extract(
  fixture as FixtureDefinition,  // ← cast any → FixtureDefinition
  dmxAddress,
  universe,
  zone,
  fixture.id,
)
```

Esto usa la **firma legacy** de `extract()`. El pipeline no recibe `FixtureV2` sino el objeto `any` que llega por IPC desde el frontend.

### ¿Cuál es el shape del fixture que llega por IPC?

El objeto `fixtures[]` que llega por `lux:arbiter:setFixtures` es de tipo `FixtureV2` serializado. Su shape relevante:

```typescript
// ShowFileV2.ts — FixtureV2
interface FixtureV2 {
  id: string
  address: number          // ← "address" (NOT "dmxAddress")
  universe: number
  zone: string
  channels?: Array<{
    index: number          // ← 1-based
    name: string
    type: string           // ← string, no AetherChannelType
    is16bit: boolean
    defaultValue?: number  // ← OPCIONAL: a veces undefined
  }>
  capabilities?: { ... }
  // NO tiene "channels" del perfil .fxt — solo los channels del Stagebuilder
  // que son una copia inline del canal tal como llegó de la biblioteca
}
```

### ❌ BUG #1 — CAMPO channels[] INCOMPLETO O AUSENTE

**Ruta del código:**  
`TitanOrchestrator._syncFixturesToAether()` → `NodeExtractionPipeline._analyzeTopology()`

```typescript
// _analyzeTopology() opera sobre:
const chs = fixtureDef.channels     // ← fixtureDef ES el FixtureV2 casteado como any

// FixtureV2.channels es OPCIONAL (channels?: Array<{...}>)
// y contiene los canales inline del Stagebuilder.

// Filtro de impacto:
const impactChs = chs.filter(ch => IMPACT_CHANNEL_TYPES.has(ch.type))
// IMPACT_CHANNEL_TYPES = { 'dimmer', 'strobe', 'shutter' }
```

**El problema:** El tipo del canal en `FixtureV2.channels[].type` es `string` libre, sin garantía de que coincida exactamente con los strings de `IMPACT_CHANNEL_TYPES`. Si el canal viene del perfil legacy como `"Dimmer"` (capital D) o `"DIMMER"`, el filtro `Set.has()` falla silenciosamente. Resultado: `impactChs.length === 0` → **no se genera ningún IMPACT node**.

**Confirmación del guard ya existente:**  
```typescript
// _syncFixturesToAether():
if (!fixture.id || !Array.isArray(fixture.channels) || fixture.channels.length === 0) {
  continue  // ← salta fixture si no tiene channels[]
}
```

Si los fixtures del show actual tienen `channels: undefined` (campo opcional), **todos se saltan** y Aether registra definitivamente cero devices.

### ❌ BUG #2 — `dmxOffset` PUEDE SER NEGATIVO (off-by-one silencioso)

**Ruta del código:**  
`NodeExtractionPipeline._mapChannels()`

```typescript
// NodeExtractionPipeline.ts:683
dmxOffset: ch.index - 1,   // FixtureChannel.index es 1-based
```

Pero `FixtureV2.channels[].index` **también es 1-based** (WAVE 1008.7 lo confirma — es la posición del canal en el fixture). Esto está bien. Pero si algún canal tiene `index: 0` por un bug de serialización, `dmxOffset` = -1 y el resolver lo descarta silenciosamente:

```typescript
// NodeResolver._writeNode():
if (bufIdx < 0 || bufIdx >= DMX_UNIVERSE_SIZE) continue  // safety bound — ignora silenciosamente
```

**Veredicto Vector 1:**

| Condición | ¿Se generan IMPACT nodes? | ¿Se generan COLOR nodes? |
|-----------|--------------------------|--------------------------|
| `fixture.channels` undefined/vacío | ❌ Se salta el fixture (guard) | ❌ |
| `channels[].type` con casing incorrecto | ❌ IMPACT vacío, no se crea nodo | ❌ COLOR vacío |
| `channels[].type` correcto | ✅ IMPACT node creado | ✅ COLOR node creado |

**El fixture legacy del pipeline usa la firma legacy que espera `FixtureDefinition` (con `channels[]` del perfil .fxt), pero recibe `FixtureV2` (con `channels[]` inline opcionales y sin garantía de casing). La probabilidad de que el slot `channels` esté vacío o con tipos mal escritos es alta.**

---

## 🔍 VECTOR 2 — EL ADAPTADOR LÍQUIDO: LiquidAetherAdapter

### Código:

```typescript
// LiquidAetherAdapter.ingest()
ingest(frame: ProcessedFrame, result: LiquidStereoResult, bus: IIntentBus): void {
  this._routeImpactNodes(result, bus)
  if (result.strobeActive) { this._routeStrobeNodes(result, bus) }
  this._routeMoodToColorIntensity(result, frame, bus)
}
```

### ¿Llega el dimmer al bus?

```typescript
// _routeImpactNodes():
impactNodes.forEach((node) => {
  const zoneIntensity = selectZoneFromResult(result, node.zoneId)
  const falloff = computeEpicenterFalloff(node, epicenter, maxR)
  this._impactValues['dimmer'] = clamp01(zoneIntensity * falloff)
  this._impactScratch.nodeId = node.nodeId
  bus.push(this._impactScratch as INodeIntent)
})
```

**Este código es correcto** — empuja `{ dimmer: 0..1 }` para cada IMPACT node del grafo.

### ❌ BUG #3 — DEPENDENCIA FANTASMA: `_nodeGraph.getView(NodeFamily.IMPACT)` DEVUELVE VACÍO

```typescript
// Constructor del LiquidAetherAdapter:
constructor(
  private readonly _nodeGraph: INodeGraph,
  ...
)

// Uso:
const impactNodes: INodeView<IImpactNodeData> =
  this._nodeGraph.getView(NodeFamily.IMPACT)
```

**Si el NodeGraph no tiene IMPACT nodes registrados** (consecuencia directa del BUG #1), `impactNodes.forEach()` no itera nada. El bus L0 queda vacío. El NodeArbiter arbitra vacío. El resolver escribe ceros.

**El adaptador liquid ES correcto y empujaría correctamente.  
El problema es upstream: si no hay IMPACT nodes en el NodeGraph, el adaptador opera sobre un view vacío.**

### ❌ BUG #4 — ZONA 'unassigned' FILTRA A CERO

```typescript
// zoneUtils.ts — selectZoneFromResult():
// (inferido del uso — se selecciona por zoneId semántico del nodo)
const zoneIntensity = selectZoneFromResult(result, node.zoneId)
```

En `_syncFixturesToAether()`:
```typescript
const zone = fixture.zone || 'unassigned'
```

Si `fixture.zone` es `undefined` o vacío, el zoneId del nodo queda como `'unassigned'`. La función `selectZoneFromResult` puede no tener un bucket para `'unassigned'` y devolver `0`, lo que produce `dimmer = 0` incluso si el nodo existe.

**Verificar `selectZoneFromResult` para la zona `'unassigned'` es crítico.**

---

## 🔍 VECTOR 3 — EL SHUTTER / DEFAULTS

### Lógica en NodeResolver._writeNode():

```typescript
// Línea 429-431 — NodeResolver.ts
const rawNormalized: number = translatedValues[chDef.type] !== undefined
  ? translatedValues[chDef.type]
  : chDef.defaultValue / 255   // ← FALLBACK cuando NO hay intent en el bus
```

### Cómo se asigna el `defaultValue` del canal shutter:

```typescript
// NodeExtractionPipeline._mapChannels() — línea 684
defaultValue: ch.defaultValue ?? (
  kinetic && (ch.type === 'pan' || ch.type === 'tilt') ? 128 : 0
)
```

**El `defaultValue` de un canal `shutter` es `ch.defaultValue ?? 0`.**

### ⚠️ BUG #5 — SHUTTER DEFAULT PUEDE SER 0 SI FALTA METADATO

**Análisis actualizado tras revisión de código:**

El `NodeResolver._getDefaultNormalizedValue()` tiene lógica especial para shutter:

```typescript
// NodeResolver.ts:563-565
if (chDef.type === SHUTTER_CHANNEL) {
  return (chDef.defaultValue > 0 ? chDef.defaultValue : 255) / 255
}
```

**Si `chDef.defaultValue` es 0, usa 255 (abierto). Si `chDef.defaultValue` es > 0, usa ese valor.**

Sin embargo, en `NodeExtractionPipeline._mapChannels()`:

```typescript
// NodeExtractionPipeline.ts:684-687
defaultValue: ch.defaultValue ?? (
  kinetic && (ch.type === 'pan' || ch.type === 'tilt') ? 128 :
  (this._normalizeChannelType(ch.type) === 'shutter' || this._normalizeChannelType(ch.type) === 'strobe') ? 255 :
  0
)
```

**El pipeline SÍ pone default 255 para shutter/strobe cuando `ch.defaultValue` es undefined.**

**Entonces, ¿cuál es el bug real?**

El bug existe solo si:
1. `FixtureV2.channels[].defaultValue` está explícitamente seteado a `0` (no undefined)
2. O si el fixture fue guardado con un `defaultValue: 0` incorrecto en el shutter

**Esto es menos probable que el Bug #1, pero sigue siendo un vector de fallo si los metadatos del fixture están corruptos.**

**Nota adicional:** El `LiquidAetherAdapter._routeStrobeNodes()` solo escribe `shutter=1.0` cuando `strobeActive === true`. En modo normal (sin strobe), el shutter queda en su defaultValue. Si el defaultValue es correcto (255), esto funciona. Si el defaultValue es 0 por corrupción de metadatos, el shutter queda cerrado.

---

## 📋 TABLA DE BUGS ENCONTRADOS

| # | Vector | Archivo | Línea | Severidad | Descripción |
|---|--------|---------|-------|-----------|-------------|
| 1 | Extracción | `TitanOrchestrator.ts` | `_syncFixturesToAether` | 🔴 CRÍTICO | Se pasa `fixture as FixtureDefinition` pero es `FixtureV2`. `channels[]` puede ser `undefined` → guard descarta TODOS los fixtures → NodeGraph vacío. |
| 2 | Extracción | `NodeExtractionPipeline.ts` | `_analyzeTopology` | 🔴 CRÍTICO | Si `channels[].type` tiene casing diferente al esperado (`"Dimmer"` vs `"dimmer"`), `IMPACT_CHANNEL_TYPES.has()` falla → cero IMPACT nodes → cero dimmer. |
| 3 | Adaptador | `LiquidAetherAdapter.ts` | `_routeImpactNodes` | 🟡 CONSECUENCIA | Con NodeGraph vacío, `getView(IMPACT).forEach()` no itera. Bus L0 vacío. Correcto por diseño pero bloqueado por Bug #1. |
| 4 | Zona | `_syncFixturesToAether` | `zone || 'unassigned'` | 🟠 POSIBLE | Si `fixture.zone` es vacío, zoneId = `'unassigned'`. `selectZoneFromResult` puede retornar 0 → dimmer=0 aunque el nodo exista. |
| 5 | Shutter | `NodeExtractionPipeline.ts` | `_mapChannels` L684 | � POSIBLE | Si `FixtureV2.channels[].defaultValue` está explícitamente en `0` (corrupción de metadatos), shutter queda cerrado. El pipeline usa `?? 255` para undefined y NodeResolver tiene fallback a 255, pero si el valor es explícitamente 0 no hay corrección. Menos probable que Bug #1. |

---

## 🎯 CAUSA RAÍZ PRINCIPAL (orden de probabilidad)

### 1º → BUG #1: La ruta de extracción está rota en su entrada

`_syncFixturesToAether` usa la **firma legacy** de `extract()` pero los datos de entrada son `FixtureV2` (no `FixtureDefinition`). La firma legacy espera `fixtureDef.channels` como `FixtureChannel[]` con tipos seguros, pero recibe el tipo inline de `FixtureV2` donde `channels` es opcional y tipado como `string` libre. Si `channels` es `undefined`, el guard ya existente **descarta el fixture antes de llamar al pipeline**. Resultado: NodeGraph a cero devices → `_aetherHasDevices` nunca se pone a `true` → el bloque Aether de 44Hz ni siquiera corre.

**La solución correcta es usar la firma FixtureV2 (la firma preferida) en lugar de la legacy.**

### 2º → BUG #2: Casing incorrecto en tipos de canal

Si los fixtures tienen `channels[].type` con casing diferente al esperado (ej: `"Dimmer"` en lugar de `"dimmer"`), el filtro `IMPACT_CHANNEL_TYPES.has()` falla silenciosamente. Esto puede ocurrir si los fixtures fueron creados manualmente o importados de una fuente que no normaliza los tipos.

### 3º → BUG #4: Zona 'unassigned' potencialmente mapeada a 0

Dependiente de la implementación de `selectZoneFromResult`.

---

## 🔧 SOLUCIONES PROPUESTAS

### FIX #1 (Bug #1 + #2) — Usar firma FixtureV2 en `_syncFixturesToAether`

El objeto que llega por IPC **es** un `FixtureV2`. Usar la firma correcta:

```typescript
// TitanOrchestrator._syncFixturesToAether() — CAMBIO PROPUESTO
const deviceDef = pipeline.extract(
  fixture as FixtureDefinition,    // ← WRONG: cast de FixtureV2 a FixtureDefinition
  dmxAddress,
  universe,
  zone,
  fixture.id,
)

// CORRECCIÓN:
const deviceDef = pipeline.extract(
  fixture as import('../../types/FixtureDefinition').FixtureDefinition,
  fixture as import('../stage/ShowFileV2').FixtureV2,  // ← usa la firma FixtureV2
)
// La firma FixtureV2 lee address, universe, zone, channels[] con tipos seguros
// y no necesita que channels sea un FixtureDefinition.channels[]
```

O, si el fixture `any` no tiene la forma exacta de FixtureV2 completo (puede faltar `position`, `calibration`, etc.), la alternativa segura es construir el `FixtureDefinition` a partir de los datos del fixture:

```typescript
// Construir un FixtureDefinition minimal desde el fixture any
const fixtureDef: FixtureDefinition = {
  id:           fixture.id,
  name:         fixture.name || fixture.id,
  manufacturer: fixture.manufacturer || '',
  type:         fixture.type || 'par',
  channels:     (fixture.channels || []).map((ch: any) => ({
    type:         (ch.type as string).toLowerCase(),  // ← normalizar casing
    index:        ch.index,
    name:         ch.name,
    defaultValue: ch.defaultValue,
    is16bit:      ch.is16bit ?? false,
  })),
}
```

**La normalización `.toLowerCase()` en `type` elimina el Bug #2 de casing.**

### FIX #2 (Bug #5) — Validación de metadatos de shutter

El pipeline ya tiene el default correcto (255 para shutter). El fix es defensivo: validar que `FixtureV2.channels[].defaultValue` no sea explícitamente 0 para canales de shutter/strobe durante la extracción, y forzar 255 si es 0.

```typescript
// NodeExtractionPipeline._mapChannels() — VALIDACIÓN ADICIONAL
let finalDefault = ch.defaultValue
if ((ch.type === 'shutter' || ch.type === 'strobe') && finalDefault === 0) {
  finalDefault = 255  // Corregir metadatos corruptos
}
defaultValue: finalDefault ?? (
  kinetic && (ch.type === 'pan' || ch.type === 'tilt') ? 128 :
  (this._normalizeChannelType(ch.type) === 'shutter' || this._normalizeChannelType(ch.type) === 'strobe') ? 255 :
  0
),
```

### FIX #3 (Bug #4) — Zona 'unassigned' con fallback de intensidad

En `_syncFixturesToAether`, mapear fixtures sin zona a `'front'` u otra zona real, o verificar que `selectZoneFromResult` tenga fallback para `'unassigned'`.

---

## 📊 ÁRBOL DE DECISIÓN PARA EL APAGÓN

```
¿_aetherHasDevices === true?
├─ NO → Bug #1 activo: fixture.channels undefined → guard descarta all → go to FIX #1
└─ SÍ → ¿NodeGraph.totalDevices > 0?
   ├─ NO → Bug #1 parcial: extract() devuelve nodos vacíos → channels[] mal tipados → FIX #1
   └─ SÍ → ¿IMPACT nodes > 0 en NodeGraph?
      ├─ NO → Bug #2: tipo 'dimmer' no matchea en IMPACT_CHANNEL_TYPES → FIX #1 (lowercase)
      └─ SÍ → ¿LiquidAetherAdapter pushea dimmer > 0?
         ├─ NO → Bug #4: zona 'unassigned' → zoneIntensity = 0 → FIX #3
         └─ SÍ → ¿shutter en DMX > 0?
            ├─ NO → Bug #5: shutter.defaultValue = 0 → persiana cerrada → FIX #2
            └─ SÍ → TODO OK (este caso no es el actual)
```

---

## 🚦 VEREDICTO FINAL

**El Fotón muere en el Bug #1.** Los fixtures que llegan por `lux:arbiter:setFixtures` son `FixtureV2` con `channels?` opcional. Si el campo está ausente, el guard existente en `_syncFixturesToAether` descarta silenciosamente todos los fixtures. NodeGraph queda vacío. `_aetherHasDevices` nunca se activa. La ruta de 44Hz nunca procesa Aether.

**Bug #5 (shutter) es menos crítico de lo que se pensaba inicialmente.** El pipeline ya tiene default 255 para shutter/strobe cuando `defaultValue` es undefined, y NodeResolver tiene un fallback adicional a 255. El bug solo ocurre si el metadato `defaultValue` está explícitamente seteado a 0 (corrupción de datos), lo cual es menos probable.

**Fix mínimo viable:** normalizar el `channels[].type` a lowercase en `_syncFixturesToAether` antes de llamar al pipeline. Esto elimina el Bug #2 de casing.  
**Fix correcto:** usar la firma FixtureV2 de `extract()` pasando el fixture completo como `FixtureV2` en lugar de castear a `FixtureDefinition`.

---

*WAVE 4595 — THE PHOTON TRACE | Diagnóstico generado 2026-05-07*
