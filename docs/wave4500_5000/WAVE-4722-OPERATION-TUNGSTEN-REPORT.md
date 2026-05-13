# WAVE 4722 — OPERATION TUNGSTEN
## Autopsia Completa + Informe de Ejecución

**Fecha de ejecución:** 13 de Mayo de 2026  
**Estado final:** ✅ COMPLETADA — 0 errores TypeScript  
**Archivos modificados:** 5  

---

## El Crimen Original

El fixture Tungsten de American Pro tenía un bypass quirúrgico hardcodeado directamente en `NodeExtractionPipeline.ts` desde **WAVE 4683**. El método `_buildTungstenBypassNodes` (~120 líneas) detectaba el fixture por nombre (`fixtureDef.name === 'Tungsten'`) y construía 9 nodos Aether sintéticos a mano, saltándose completamente la lógica del pipeline.

**Por qué existía:** El fixture JSON original tenía todos los canales tipados como `custom`, lo que hacía imposible que el pipeline genérico construyera nodos útiles. La solución rápida fue "parchear" el pipeline con un bypass específico por nombre.

**Por qué era un problema:**
- Arquitectura cancer — lógica de fixture metida en el pipeline de extracción
- No escalable: cada fixture complejo necesitaría su propio bypass
- Imposible de testear en aislamiento
- Violación del Axioma Perfection First

---

## Descubrimiento Crítico Durante el Análisis

Antes de poder borrar el bypass, el análisis reveló que estaba **profundamente entrelazado** con el sistema MIDI:

```
TitanOrchestrator.getTungstenNodeIds()
  → escanea devices con un nodo que termina en ':golden-master'
  → retorna { goldenMaster, petalL, petalC, petalR, kinetic }

AetherIPCHandlers.ts (línea 705-749)
  → usa getTungstenNodeIds() para rutear MIDI petal burst
  → 'petal-l' / 'petal-c' / 'petal-r' → node IDs específicos

MidiActionRegistry
  → registra 'tung-petal-l/c/r' como acciones MIDI
```

Borrar el bypass sin reemplazarlo con una ruta real habría **roto todos los controles MIDI** del Tungsten. La operación se expandió a 4 fases.

---

## Plan de 4 Fases

```
FASE 1  → Borrar el bypass del pipeline
FASE 2  → Actualizar schemas para soportar targetChannelIndex
FASE 2.5 → Crear la ruta nodeGraph en el pipeline (_buildNodesFromForgeGraph)
FASE 3  → Reescribir el fixture JSON con tipos correctos + nodeGraph completo
```

---

## FASE 1 — Eliminación del Bypass

**Archivo:** `src/core/aether/ingestion/NodeExtractionPipeline.ts`

Se eliminó íntegramente el método `_buildTungstenBypassNodes` y se reemplazó la ternaria de detección por nombre con una ruta limpia basada en la presencia de `nodeGraph`:

```typescript
// ANTES (hack por nombre)
const nodes = fixtureDef.name === 'Tungsten'
  ? this._buildTungstenBypassNodes(...)
  : this._buildAllNodes(...)

// DESPUÉS (ruta arquitectónica)
const fixtureGraph = (fixtureDef as FixtureDefinition & { nodeGraph?: IForgeNodeGraph }).nodeGraph
const nodes = fixtureGraph && fixtureGraph.nodes.length > 0
  ? this._buildNodesFromForgeGraph(resolvedDeviceId, resolvedZone, fixtureDef, fixtureGraph, resolvedPosition)
  : this._buildAllNodes(resolvedDeviceId, resolvedZone, fixtureDef, topology, resolvedPosition)
```

---

## FASE 2 — Upgrades de Schema

### `FixtureDefinition.ts`
Añadido `targetChannelIndex` como campo de máxima prioridad en `IgnitionDependency`:

```typescript
export interface IgnitionDependency {
  /** WAVE 4722: índice DMX 0-based del canal target (máxima prioridad). */
  targetChannelIndex?: number;
  channelType: ChannelType;
  requiredValue: number;
  mode?: 'hold' | 'release';
}
```

### `capability-node.ts`
Añadido `targetDmxOffset` al tipo inline de `INodeChannelDef.ignitionDeps`:

```typescript
readonly ignitionDeps?: readonly {
  readonly targetChannelType: AetherChannelType
  readonly requiredValue: number
  readonly mode: 'hold' | 'release'
  /** WAVE 4722: Offset DMX 0-based del canal master. Precedencia sobre targetChannelType. */
  readonly targetDmxOffset?: number
}[]
```

### `forge/types.ts`
Extendido `IOutputDmxConfig` con los campos requeridos por el nodeGraph:

```typescript
export interface IOutputDmxConfig {
  // ... campos existentes ...
  readonly ignitionDeps?: readonly {
    readonly channelType: ChannelType
    readonly requiredValue: number
    /** WAVE 4722: Índice DMX 0-based del canal master. Precedencia sobre channelType. */
    readonly targetChannelIndex?: number
    readonly mode?: 'hold' | 'release'
  }[]
  /** WAVE 4722: ID del nodo Aether al que pertenece este output DMX. */
  readonly aetherNodeId?: string
  /** WAVE 4722: Zona Aether explícita para este nodo (overrides show zone). */
  readonly aetherZone?: string
}
```

También se propagó `targetDmxOffset` en `_mapChannels`:

```typescript
ignitionDeps: ch.ignitionDeps.map(dep => ({
  targetChannelType: this._normalizeChannelType(dep.channelType) as AetherChannelType,
  requiredValue: dep.requiredValue,
  mode: dep.mode ?? 'hold' as const,
  ...(dep.targetChannelIndex !== undefined && { targetDmxOffset: dep.targetChannelIndex }),
})),
```

---

## FASE 2.5 — `_buildNodesFromForgeGraph`

El hub de la operación. Cinco métodos nuevos añadidos al pipeline:

### `_buildNodesFromForgeGraph`
Agrupa los nodos `output_dmx` del grafo por `aetherNodeId` y construye un `ICapabilityNode` por grupo.

### `_mapForgeNodes`
Convierte `IOutputDmxConfig[]` → `INodeChannelDef[]`. **Usa `cfg.dmxOffset` directamente (0-based)**, sin la resta `-1` que tiene la ruta legacy (bug histórico documentado, no tocado en este WAVE intencionalmente).

### `_inferAetherSuffix`
Fallback para deducir el sufijo del nodo Aether cuando `aetherNodeId` no está presente en el config, por tipo de canal: `'color' | 'impact' | 'kinetic' | 'beam' | 'atmosphere'`.

### `_buildForgeGroupNode`
Despacha al constructor correcto según el `Set<string>` de tipos de canal del grupo:

| Tipos en el grupo | Nodo producido |
|---|---|
| `red|green|blue|white|cyan|...` | `COLOR_MIXING` |
| `dimmer|strobe` | `IMPACT` |
| `rotation` | `KINETIC` |
| `beam` | `BEAM` |
| resto | `ATMOSPHERE` |

### `_detectMixingTypeFromSet`
Detecta `'cmy' | 'wheel' | 'rgbw' | 'rgb'` desde el `Set<string>` de tipos de canal.

---

## FASE 3 — Fixture JSON Reescrito

**Archivo:** `fixtures/user-1775343513755-71zc1qeo4.json`

### Cambios en los metadatos del fixture

| Campo | Antes | Después | Por qué |
|---|---|---|---|
| `type` | `"fan"` | `"effect"` | Evita clasificación como ATMOSPHERE_FIXTURE_TYPES |
| `physics.motorType` | `"stepper-cheap"` | `"stepper"` | Tipo válido en MotorType enum |
| `capabilities.hasPan` | `true` | `false` | No es un moving head real |
| `capabilities.hasDimmer` | `false` | `true` | Tiene canal dimmer real |
| `capabilities.hasRotation` | ausente | `true` | Tiene rotación continua |

### Correcciones en el array `channels`

| índice | nombre | tipo antes | tipo después | cambio |
|---|---|---|---|---|
| 0 | Pan Kill | `pan` | `custom` + defaultValue 127 | Es un kill switch, no un pan real |
| 1 | X infinite | `custom` | `rotation` + `continuousRotation: true` | Canal de rotación continua |
| 2 | Golden dimmer | `custom` | `dimmer` | Canal master del bloque gold |
| 3 | Strobe | — | `strobe` | Ya estaba correcto |
| 4 | Gold 1 | `custom` | `dimmer` + `ignitionDeps[targetChannelIndex:2]` | Gateado por ch2 |
| 5 | Gold 2 | `custom` | `dimmer` + `ignitionDeps[targetChannelIndex:2]` | Gateado por ch2 |
| 6 | Gold 3 | `custom` | `dimmer` + `ignitionDeps[targetChannelIndex:2]` | Gateado por ch2 |
| 7 | Stainning dimmer | `custom` | `dimmer` | Canal master del bloque stain |
| 8 | Stainning strobe | `custom` | `strobe` | Tipo correcto |
| 9 | Stain red | `custom` | `red` + `ignitionDeps[targetChannelIndex:7]` | Gateado por ch7 |
| 10 | Stain green | `custom` | `green` + `ignitionDeps[targetChannelIndex:7]` | Gateado por ch7 |
| 11 | Stain blue | `custom` | `blue` + `ignitionDeps[targetChannelIndex:7]` | Gateado por ch7 |
| 12-15 | Red/Green/Blue/White | — | sin cambio | Ya estaban correctos |
| 16-19 | macros | — | sin cambio | Correctamente tipados como `custom` |

### El `nodeGraph` — 20 nodos `output_dmx`

Cada nodo tiene: `id`, `type`, `category`, `inputs`, `outputs`, `config` (con `aetherNodeId` + `aetherZone`), `uiPosition`, `label`.

**Mapa de asignaciones:**

| offset DMX | canal | aetherNodeId | aetherZone | ignitionDeps |
|---|---|---|---|---|
| 0 | Pan Kill | `atmosphere` | `unassigned` | — |
| 1 | X infinite | `kinetic` | `unassigned` | — |
| 2 | Golden dimmer | `golden-master` | `flash` | — |
| 3 | Strobe | `golden-master` | `flash` | — |
| 4 | Gold 1 | `petal-l` | `flash` | ch2 ≥ 255 |
| 5 | Gold 2 | `petal-c` | `flash` | ch2 ≥ 255 |
| 6 | Gold 3 | `petal-r` | `flash` | ch2 ≥ 255 |
| 7 | Stainning dimmer | `wash` | `ambient` | — |
| 8 | Stainning strobe | `wash` | `ambient` | — |
| 9 | Stain red | `wash-color` | `ambient` | ch7 ≥ 255 |
| 10 | Stain green | `wash-color` | `ambient` | ch7 ≥ 255 |
| 11 | Stain blue | `wash-color` | `ambient` | ch7 ≥ 255 |
| 12 | Red | `beam-color` | `air` | — |
| 13 | Green | `beam-color` | `air` | — |
| 14 | Blue | `beam-color` | `air` | — |
| 15 | White | `beam-color` | `air` | — |
| 16 | macro gold | `atmosphere` | `unassigned` | — |
| 17 | macro stain | `atmosphere` | `unassigned` | — |
| 18 | macro beam | `atmosphere` | `unassigned` | — |
| 19 | repo | `atmosphere` | `unassigned` | — |

---

## Nodos Aether Producidos por el Pipeline (runtime)

Una vez que el pipeline procese el fixture, construirá exactamente estos 8 nodos:

```
{deviceId}:atmosphere    → ICapabilityNode (ATMOSPHERE)  — offsets 0,16,17,18,19
{deviceId}:kinetic       → ICapabilityNode (KINETIC)     — offset 1
{deviceId}:golden-master → ICapabilityNode (IMPACT)      — offsets 2,3
{deviceId}:petal-l       → ICapabilityNode (IMPACT)      — offset 4
{deviceId}:petal-c       → ICapabilityNode (IMPACT)      — offset 5
{deviceId}:petal-r       → ICapabilityNode (IMPACT)      — offset 6
{deviceId}:wash          → ICapabilityNode (IMPACT)      — offsets 7,8
{deviceId}:wash-color    → ICapabilityNode (COLOR_MIXING) — offsets 9,10,11
{deviceId}:beam-color    → ICapabilityNode (COLOR_MIXING) — offsets 12,13,14,15
```

`TitanOrchestrator.getTungstenNodeIds()` detecta `:golden-master` → devuelve los 5 IDs de MIDI petal burst sin ningún cambio. MIDI intacto.

---

## Nota Técnica — Bug Histórico Documentado (NO Reparado en Este WAVE)

Durante el análisis se descubrió que `_mapChannels` en la ruta legacy hace `ch.index - 1` comentando "1-based", pero **todos los fixture JSONs usan índices 0-based**. Esto significa que la ruta legacy tiene un off-by-one bug que lleva funcionando desde el inicio.

**Decisión:** No tocar en WAVE 4722. El bug afecta solo la ruta legacy (fixtures sin `nodeGraph`). El nuevo `_mapForgeNodes` usa `cfg.dmxOffset` directamente, sin resta. El bug legacy quedó registrado para una WAVE de deuda técnica futura.

---

## Resultado Final

```
NodeExtractionPipeline.ts  ✅  0 errores — bypass eliminado, ruta nodeGraph operativa
FixtureDefinition.ts       ✅  0 errores — targetChannelIndex añadido
capability-node.ts         ✅  0 errores — targetDmxOffset añadido
forge/types.ts             ✅  0 errores — aetherNodeId/aetherZone añadidos
fixture JSON               ✅  20 canales tipados, nodeGraph 20 nodos, ignitionDeps correctos
```

**El hack de 120 líneas se convirtió en 20 líneas de JSON declarativo. El pipeline sabe ahora leer cualquier fixture con nodeGraph, no solo el Tungsten.**
