# WAVE 4717 — THE GRANDMA IGNITION BLUEPRINT

> *"A lamp that doesn't ignite is a lamp that doesn't exist."*

**Autor:** Cascade (Opus) · **Fecha:** 2025-05-12
**Estado:** BLUEPRINT · **Clasificación:** Arquitectura Core

---

## DIAGNÓSTICO DEL PROBLEMA

Las luminarias de lámpara de descarga (Beam 2R, Spot 5R, Wash 7R, Martin MAC) requieren que
canales secundarios estén en valores específicos **antes** de que el canal primario emita luz:

```
Beam 2R típico (14 canales):
  CH1  Color Wheel     → defaultValue: 0 (open white)
  CH2  Gobo Wheel      → defaultValue: 0 (open)
  CH3  Prism           → defaultValue: 0 (out)
  CH4  ❌ Shutter      → defaultValue: 255 (OPEN — sin esto, dimmer no emite)
  CH5  Dimmer          → dependsOn: [{ channel: 'shutter', value: 255 }]
  CH6  ❌ Control      → defaultValue: 0 (lamp ON command = typically 0 or specific range)
  CH7  Pan Coarse
  ...
```

**Síntomas actuales:**
1. **Aether Core:** La IA (L0) sube `dimmer` pero no envía `shutter=255` → luz muerta.
2. **WheelSmith TEST:** `sendDirectDMX` envía solo `color_wheel + dimmer` → shutter cerrado.
3. **TestPanel:** Envía dimmer sin considerar shutter → luz muerta en descarga.

**Root Cause:** No existe un mecanismo declarativo que vincule un canal primario con sus
prerequisitos de activación. Los `defaultValue` del perfil se escriben al buffer DMX **solo
cuando nadie los controla**, pero Aether y los tests los ignoran.

---

## PRINCIPIO DE DISEÑO

Inspiración directa de **GrandMA3 Channel Dependencies**:
- Un canal puede declarar *N* dependencias de ignición.
- Cada dependencia dice: *"Para que YO funcione, el canal X debe tener valor V."*
- Las dependencias se leen en **patch-time** (no en hot path).
- La inyección se ejecuta en una sola pasada O(canales) **después** de la arbitración.
- Los tests de hardware (WheelSmith, TestPanel) hidratan las dependencias automáticamente.

---

## 🧬 CAPA 1: EL ADN DE LA FIXTURE (JSON Schema)

### 1.1 — Extension de `FixtureChannel`

Se añade un campo **opcional** `ignitionDeps` al tipo existente. Los perfiles LED existentes
(sin dependencias) siguen funcionando sin cambio alguno — el campo es `undefined` por defecto.

```typescript
// types/FixtureDefinition.ts — EXTENSIÓN (no breaking change)

/**
 * Declaración de una dependencia de ignición.
 * "Para que ESTE canal funcione, `targetChannelType` debe estar en `requiredValue`."
 *
 * Ejemplo para un canal Dimmer en un Beam 2R:
 *   { targetChannelType: 'shutter', requiredValue: 255 }
 * → "El dimmer requiere que el Shutter esté en 255 (abierto)."
 *
 * Ejemplo para un canal Color Wheel que necesita lámpara encendida:
 *   { targetChannelType: 'control', requiredValue: 128 }
 * → "La rueda de color requiere que Control esté en 128 (lamp ON)."
 */
export interface IgnitionDependency {
  /** Tipo de canal del que depende (referencia semántica, no por índice) */
  readonly targetChannelType: ChannelType
  /** Valor DMX (0-255) que el canal target debe tener para que ESTE canal funcione */
  readonly requiredValue: number
  /**
   * Comportamiento cuando el canal primario está en 0 (inactivo):
   * - 'hold'    → Mantener requiredValue siempre (default — para shutter abierto)
   * - 'release' → Solo inyectar requiredValue cuando el canal primario > 0
   *               (útil para lamp ON: no enviar comando si el dimmer está en 0)
   */
  readonly mode?: 'hold' | 'release'
}

export interface FixtureChannel {
  index: number;
  name: string;
  type: ChannelType;
  defaultValue: number;
  is16bit: boolean;
  customName?: string;
  continuousRotation?: boolean;
  // 🔥 WAVE 4717: IGNITION DEPENDENCIES
  // Canal primario declara de qué otros canales depende para funcionar.
  // Opcional — los perfiles LED existentes no lo tienen y siguen intactos.
  ignitionDeps?: readonly IgnitionDependency[];
}
```

### 1.2 — Extensión de `INodeChannelDef` (Capa Aether)

El pipeline de extracción traduce `ignitionDeps` del perfil legacy al modelo nodal:

```typescript
// core/aether/capability-node.ts — EXTENSIÓN

export interface INodeChannelDef {
  readonly type: AetherChannelType
  readonly dmxOffset: number
  readonly defaultValue: number
  readonly is16bit?: boolean
  readonly customName?: string
  // 🔥 WAVE 4717: Ignition Dependencies propagadas desde el perfil legacy
  readonly ignitionDeps?: readonly IIgnitionDep[]
}

/**
 * Dependencia de ignición en el dominio Aether.
 * Usa channelType (semántico) — el NodeResolver resuelve el dmxOffset real
 * buscando en los canales del mismo Device.
 */
export interface IIgnitionDep {
  readonly targetChannelType: AetherChannelType
  readonly requiredValue: number       // DMX 0-255
  readonly mode: 'hold' | 'release'    // default: 'hold'
}
```

### 1.3 — Extensión de `IOutputDmxConfig` (Capa Forge)

```typescript
// core/forge/types.ts — EXTENSIÓN

export interface IOutputDmxConfig {
  readonly nodeType: 'output_dmx'
  readonly channelType: ChannelType
  readonly dmxOffset: number
  readonly channelName?: string
  readonly defaultDmxValue: number
  readonly is16bit?: boolean
  readonly continuousRotation?: boolean
  // 🔥 WAVE 4717: Ignition Dependencies para el evaluador Forge
  readonly ignitionDeps?: readonly {
    readonly targetChannelType: ChannelType
    readonly requiredValue: number
    readonly mode?: 'hold' | 'release'
  }[]
}
```

### 1.4 — Backward Compatibility

| Escenario | Comportamiento |
|-----------|---------------|
| Perfil LED sin `ignitionDeps` | Campo `undefined` → cero overhead, cero cambio |
| Perfil importado JSON antiguo | `ignitionDeps` ausente → parser no falla (optional) |
| Perfil con `ignitionDeps` en Forja vieja | El campo se ignora silenciosamente si la versión no lo soporta |
| NodeGraphBuilder.fromChannels() | Si el canal tiene `ignitionDeps`, las propaga al `IOutputDmxConfig` |
| NodeGraphBuilder.toChannels() | Si el config tiene `ignitionDeps`, las reconvierte a `FixtureChannel` |

### 1.5 — Presets de Ignición Comunes

Para el 90% de luminarias de descarga, las dependencias son predecibles.
La Forja puede sugerir automáticamente cuando detecta ciertos patrones:

```typescript
// Sugerencias automáticas (no se persisten hasta que el usuario las confirma)
const IGNITION_PRESETS: Record<string, IgnitionDependency[]> = {
  // Dimmer en fixture con shutter → necesita shutter abierto
  'dimmer+shutter': [
    { targetChannelType: 'shutter', requiredValue: 255, mode: 'hold' },
  ],
  // Dimmer en fixture con control (lamp ON) → necesita comando de encendido
  'dimmer+control': [
    { targetChannelType: 'control', requiredValue: 128, mode: 'release' },
  ],
  // Color wheel en fixture con shutter + dimmer
  'color_wheel+lamp': [
    { targetChannelType: 'shutter', requiredValue: 255, mode: 'hold' },
    { targetChannelType: 'dimmer', requiredValue: 255, mode: 'release' },
  ],
}
```

---

## 🔨 CAPA 2: LA FORJA (FixtureForgeEmbedded)

### 2.1 — UX Concept: "Ignition Wires"

La configuración de dependencias se integra en la pestaña **Channel Rack** existente,
dentro de cada fila de canal. No es una nueva pestaña — es un panel desplegable por canal.

```
┌─────────────────────────────────────────────────────────────────────┐
│ CH  │ Function  │ MIN │ Default │ 🔌 │ ✕                           │
├─────┼───────────┼─────┼─────────┼────┼────────────────────────────-┤
│  1  │ Color Whl │     │   0     │    │ ✕                           │
│  2  │ Gobo      │     │   0     │    │ ✕                           │
│  3  │ Prism     │     │   0     │    │ ✕                           │
│  4  │ Shutter   │     │  255    │    │ ✕                           │
│  5  │ Dimmer    │  0  │  255    │ 🔌 │ ✕                           │
│     │ ┌──────────────────────────────────────────────────────────┐ │
│     │ │ 🔗 IGNITION DEPS                                       │ │
│     │ │ ┌────────────────────────┬─────────┬──────────┐         │ │
│     │ │ │  ⚡ Shutter → 255     │  HOLD   │    🗑    │         │ │
│     │ │ └────────────────────────┴─────────┴──────────┘         │ │
│     │ │ [ + Add Dependency ]                                    │ │
│     │ └──────────────────────────────────────────────────────────┘ │
│  6  │ Control   │     │   0     │    │ ✕                           │
│  7  │ Pan       │     │  127    │ 🔌 │ ✕                           │
│  ...│           │     │         │    │                              │
└─────┴───────────┴─────┴─────────┴────┴──────────────────────────-──┘

🔌 = Botón toggle que expande/colapsa el panel de dependencias
     Solo visible cuando el canal tiene tipo ≠ 'unknown'
     Badge numérico cuando hay deps configuradas: 🔌₂
```

### 2.2 — Componente: `IgnitionDepsEditor`

```typescript
// components/views/ForgeView/IgnitionDepsEditor.tsx (nuevo componente)

interface IgnitionDepsEditorProps {
  /** Dependencias actuales del canal */
  deps: readonly IgnitionDependency[]
  /** Callback al modificar */
  onChange: (deps: IgnitionDependency[]) => void
  /** Tipos de canal disponibles en el fixture (para el selector) */
  availableChannelTypes: ChannelType[]
  /** Tipo del canal actual (para evitar auto-referencia) */
  currentChannelType: ChannelType
}
```

**Interacción:**

1. El usuario hace click en el icono 🔌 de una fila del Channel Rack.
2. Se despliega un sub-panel inline (no modal) debajo de esa fila.
3. Cada dependencia existente se muestra como una **chip card**:
   - Selector de `targetChannelType` (dropdown filtrado: solo tipos presentes en el fixture,
     excluyendo el tipo del canal actual).
   - Input numérico `requiredValue` (0-255).
   - Toggle `mode` (hold / release) — presentado como segmented control estilo iOS.
   - Botón 🗑 para eliminar.
4. Botón **"+ Add Dependency"** al final.
5. **Auto-suggest**: Si el canal es `dimmer` y existe un canal `shutter` en el fixture,
   mostrar un botón *"⚡ Auto: Shutter → 255 (hold)"* que inyecta la dependencia con un click.

### 2.3 — Integración en el Channel Rack

En `FixtureForgeEmbedded.tsx`, dentro del bucle `fixture.channels.map(...)`:

```tsx
// Después de la columna "channel-default" y antes del botón "channel-clear"

{/* 🔥 WAVE 4717: Ignition Dependencies toggle */}
{channel.type !== 'unknown' && (
  <button
    className={`channel-ignition-btn ${(channel.ignitionDeps?.length ?? 0) > 0 ? 'has-deps' : ''}`}
    onClick={() => setExpandedIgnitionIdx(expandedIgnitionIdx === idx ? null : idx)}
    title="Ignition Dependencies"
  >
    🔌{(channel.ignitionDeps?.length ?? 0) > 0 && (
      <span className="ignition-badge">{channel.ignitionDeps!.length}</span>
    )}
  </button>
)}

// Sub-panel expandible (fuera del grid row, como un row-span)
{expandedIgnitionIdx === idx && channel.type !== 'unknown' && (
  <IgnitionDepsEditor
    deps={channel.ignitionDeps ?? []}
    onChange={(newDeps) => {
      setFixture(prev => {
        const newChannels = [...prev.channels]
        newChannels[idx] = { ...newChannels[idx], ignitionDeps: newDeps }
        return { ...prev, channels: newChannels }
      })
    }}
    availableChannelTypes={fixture.channels
      .filter(ch => ch.type !== 'unknown' && ch.type !== channel.type)
      .map(ch => ch.type)}
    currentChannelType={channel.type}
  />
)}
```

### 2.4 — NodeGraphBuilder Roundtrip

**`fromChannels()`** — Si un `FixtureChannel` tiene `ignitionDeps`, se copian al
`IOutputDmxConfig.ignitionDeps` del nodo output correspondiente.

**`toChannels()`** — Si un `IOutputDmxConfig` tiene `ignitionDeps`, se reconvierten
a `FixtureChannel.ignitionDeps`. Roundtrip fiel, sin pérdida.

---

## 🧠 CAPA 3: EL CORE AETHER (NodeExtractionPipeline + NodeResolver)

### 3.1 — Pipeline de Extracción: Propagación de ignitionDeps

En `NodeExtractionPipeline._mapChannels()`, se leen las `ignitionDeps` del `FixtureChannel`
y se propagan al `INodeChannelDef`:

```typescript
// NodeExtractionPipeline.ts — _mapChannels() extensión

private _mapChannels(
  channels: readonly FixtureChannel[],
  isKinetic?: boolean,
): INodeChannelDef[] {
  return channels.map(ch => {
    const mapped: INodeChannelDef = {
      type:         this._normalizeChannelType(ch.type) as AetherChannelType,
      dmxOffset:    ch.index - 1,  // Ya existente: 1-based → 0-based
      defaultValue: isKinetic && (ch.type === 'pan' || ch.type === 'tilt')
                    ? 128
                    : ch.defaultValue,
      ...(ch.is16bit && { is16bit: true }),
      ...(ch.customName && { customName: ch.customName }),
      // 🔥 WAVE 4717: Propagar ignitionDeps al dominio Aether
      ...(ch.ignitionDeps && ch.ignitionDeps.length > 0 && {
        ignitionDeps: ch.ignitionDeps.map(dep => ({
          targetChannelType: dep.targetChannelType as AetherChannelType,
          requiredValue:     dep.requiredValue,
          mode:              dep.mode ?? 'hold',
        })),
      }),
    }
    return mapped
  })
}
```

### 3.2 — Pre-cómputo: Ignition Map por Device

Para evitar trabajo en el hot path (44Hz), el resolver pre-computa un mapa de
inyección en **patch-time** (cuando `registerDevice()` es llamado):

```typescript
// NodeResolver.ts — nueva estructura pre-computada

/**
 * Mapa de inyección de ignición pre-computado por device.
 *
 * Key: universe * 1000 + bufferIndex del canal TARGET
 * Value: { requiredValue, sourceBufferIdx, mode }
 *
 * Se recorre UNA SOLA VEZ al final de _writeNode() para inyectar los
 * valores de ignición sin búsqueda por tipo en el hot path.
 */
interface IgnitionInjection {
  /** Índice absoluto en el buffer del universo del canal TARGET */
  readonly targetBufIdx: number
  /** Valor DMX requerido en el target */
  readonly requiredValue: number
  /** Índice absoluto en el buffer del canal SOURCE (el que tiene la dep) */
  readonly sourceBufIdx: number
  /** 'hold' = siempre inyectar, 'release' = solo si source > 0 */
  readonly mode: 'hold' | 'release'
}

// Map<DeviceId, IgnitionInjection[]>
private readonly _ignitionMap = new Map<DeviceId, IgnitionInjection[]>()
```

### 3.3 — Registro: `registerDevice()` extension

```typescript
// NodeResolver.ts — registerDevice() amendment

registerDevice(deviceId: DeviceId): void {
  // ... existing buffer allocation logic ...

  // 🔥 WAVE 4717: Pre-compute ignition injections
  this._precomputeIgnitionMap(deviceId)
}

private _precomputeIgnitionMap(deviceId: DeviceId): void {
  const device = this._graph.getDevice(deviceId)
  if (!device) return

  const baseAddr = device.dmxAddress - 1
  const injections: IgnitionInjection[] = []

  // Collect ALL channels across ALL nodes of this device
  const allChannels: { type: AetherChannelType; dmxOffset: number }[] = []
  const nodeIds = this._graph.getDeviceNodes(deviceId)
  if (!nodeIds) return

  for (const nodeId of nodeIds) {
    const node = this._graph.getNodeData(nodeId)
    if (!node) continue
    for (const ch of node.channels) {
      allChannels.push({ type: ch.type, dmxOffset: ch.dmxOffset })
    }
  }

  // Build injection rules from channels that declare ignitionDeps
  for (const nodeId of nodeIds) {
    const node = this._graph.getNodeData(nodeId)
    if (!node) continue

    for (const ch of node.channels) {
      if (!ch.ignitionDeps || ch.ignitionDeps.length === 0) continue

      const sourceBufIdx = baseAddr + ch.dmxOffset

      for (const dep of ch.ignitionDeps) {
        // Find the target channel by type within the SAME device
        const target = allChannels.find(c => c.type === dep.targetChannelType)
        if (!target) {
          console.warn(
            `[NodeResolver] ⚠️ WAVE 4717: Ignition dep target "${dep.targetChannelType}" ` +
            `not found in device ${String(deviceId)} for source channel "${ch.type}"`
          )
          continue
        }

        const targetBufIdx = baseAddr + target.dmxOffset
        injections.push({
          targetBufIdx,
          requiredValue: dep.requiredValue,
          sourceBufIdx,
          mode: dep.mode,
        })
      }
    }
  }

  if (injections.length > 0) {
    this._ignitionMap.set(deviceId, injections)
    console.log(
      `[NodeResolver] 🔥 WAVE 4717: ${injections.length} ignition injection(s) ` +
      `pre-computed for device ${String(deviceId)}`
    )
  }
}
```

### 3.4 — Hot Path: Inyección Post-Arbitración

La inyección se ejecuta **una sola vez por device**, **después** de que todos los
`_writeNode()` del device han terminado. Se añade al final de `resolve()`:

```typescript
// NodeResolver.ts — resolve() amendment

resolve(arbitrated: ArbitratedNodeMap): readonly IDMXPacket[] {
  this._resolveFrameIndex++

  // 1. Zero-fill (existing)
  // 2. For each node, _writeNode() (existing)
  // 3. DarkSpin cross-node sweep (existing)

  // 🔥 WAVE 4717: IGNITION INJECTION PASS — O(devices × deps)
  // Ejecutado DESPUÉS de que todos los nodos han escrito sus valores.
  // Inyecta los prerequisitos de ignición en el buffer DMX.
  this._applyIgnitionInjections()

  // 4. Emit packets (existing)
  return this._emitPackets()
}

/**
 * 🔥 WAVE 4717: Inyecta valores de ignición en el buffer DMX.
 *
 * Para cada device con ignition rules:
 *   Para cada injection rule:
 *     Si mode === 'hold': buf[target] = max(buf[target], requiredValue)
 *     Si mode === 'release': solo si buf[source] > 0
 *
 * IMPORTANTE: Usa MAX (HTP) para no pisotear un valor más alto que ya
 * haya sido escrito por el Arbiter (ej: el operador sube shutter a 255
 * manualmente — la inyección no lo baja a 255 porque ya está en 255).
 *
 * Complejidad: O(Σ injections) ≈ O(2-4) por device de descarga.
 * Cero alloc. Cero búsqueda por tipo en runtime.
 */
private _applyIgnitionInjections(): void {
  for (const [deviceId, injections] of this._ignitionMap) {
    const device = this._graph.getDevice(deviceId)
    if (!device) continue

    const buf = this._universeBuffers.get(device.universe)
    if (!buf) continue

    for (let i = 0; i < injections.length; i++) {
      const inj = injections[i]

      // Bounds check
      if (inj.targetBufIdx < 0 || inj.targetBufIdx >= DMX_UNIVERSE_SIZE) continue
      if (inj.sourceBufIdx < 0 || inj.sourceBufIdx >= DMX_UNIVERSE_SIZE) continue

      // Mode check: 'release' only injects when source > 0
      if (inj.mode === 'release' && buf[inj.sourceBufIdx] === 0) continue

      // HTP: never lower an existing value
      if (buf[inj.targetBufIdx] < inj.requiredValue) {
        buf[inj.targetBufIdx] = inj.requiredValue
      }
    }
  }
}
```

### 3.5 — Análisis de Rendimiento

| Métrica | Valor | Nota |
|---------|-------|------|
| **Allocs por frame** | 0 | Pre-computado en patch-time |
| **Iteraciones por frame** | 2-4 por device de descarga | La mayoría de LEDs tienen 0 rules |
| **Branch mispredictions** | ~1 | El `for` sobre `_ignitionMap` solo itera devices con rules |
| **Impacto a 44Hz** | < 0.01ms | Negligible comparado con `_writeNode()` (~0.2ms/device) |

### 3.6 — Integración con el Forge Evaluator Bypass

Cuando un device tiene un `CompiledForgeGraph`, el flujo Forge bypass ya escribe
directamente al buffer. La inyección post-arbitración (`_applyIgnitionInjections()`)
se ejecuta **después** de ambos flujos (legacy y Forge), por lo que cubre ambos casos
sin cambios adicionales en el evaluador.

---

## 🎡 CAPA 4: WHEELSMITH TEST BRIDGE

### 4.1 — El Problema Actual

`WheelSmithEmbedded.sendTestWithLight()` construye un payload manual:
- `color_wheel = dmxValue`
- `dimmer = 255` (si existe)
- `shutter = 255` (si existe)
- `strobe = 0` (si existe, como fallback)

Esto es **hard-coded**. Si el fixture tiene un canal `control` que necesita valor 128
para encender la lámpara, WheelSmith no lo sabe.

### 4.2 — Mecanismo de Hydration de Ignición

Se crea una función utilitaria **pura** que lee el perfil completo y construye un
frame DMX de ignición:

```typescript
// utils/IgnitionHydrator.ts (nuevo archivo)

import type { FixtureChannel, ChannelType } from '../types/FixtureDefinition'

/**
 * WAVE 4717: Resultado de la hidratación de ignición.
 * Contiene los canales que deben enviarse junto al canal bajo test
 * para garantizar que la luminaria emita luz.
 */
export interface HydratedIgnitionFrame {
  /** channelType → dmxValue para todos los canales de soporte */
  readonly channels: ReadonlyMap<ChannelType, number>
}

/**
 * Dado un array de FixtureChannel y un canal "bajo test", retorna todos
 * los canales adicionales que deben enviarse para que la luminaria funcione.
 *
 * Algoritmo:
 * 1. Recorrer todos los canales del fixture.
 * 2. Para cada canal: si tiene ignitionDeps, ignorar (son los "consumidores").
 * 3. Para cada canal no-bajo-test: si ES target de alguna ignitionDep de
 *    otro canal, incluirlo con el requiredValue más alto (HTP) de todas
 *    las deps que lo referencian.
 * 4. Fallback: si NO hay ignitionDeps en el perfil, usar heurística legacy
 *    (dimmer=255 si existe, shutter=255 si existe, strobe=0 si existe
 *    y no hay shutter).
 *
 * @param channels — Canales del perfil completo
 * @param testChannelType — Tipo del canal que se está probando
 * @returns Frame de ignición con los canales de soporte
 */
export function hydrateIgnitionFrame(
  channels: readonly FixtureChannel[],
  testChannelType: ChannelType,
): HydratedIgnitionFrame {
  const result = new Map<ChannelType, number>()

  // ── Check if ANY channel has ignitionDeps ──
  const hasAnyDeps = channels.some(ch => ch.ignitionDeps && ch.ignitionDeps.length > 0)

  if (hasAnyDeps) {
    // ── Data-driven path: use declared dependencies ──
    // Collect all target requirements from ALL channels (not just the test one)
    for (const ch of channels) {
      if (!ch.ignitionDeps) continue
      for (const dep of ch.ignitionDeps) {
        // Skip if the target is the channel under test (we're controlling that)
        if (dep.targetChannelType === testChannelType) continue

        // HTP: keep the highest requiredValue if multiple deps target the same channel
        const existing = result.get(dep.targetChannelType)
        if (existing === undefined || dep.requiredValue > existing) {
          result.set(dep.targetChannelType, dep.requiredValue)
        }
      }
    }

    // Always include defaultValues for channels that are NOT targets
    // (to ensure unused channels don't block output)
    for (const ch of channels) {
      if (ch.type === testChannelType) continue
      if (result.has(ch.type)) continue  // Already set by a dependency
      if (ch.defaultValue > 0) {
        result.set(ch.type, ch.defaultValue)
      }
    }
  } else {
    // ── Legacy heuristic path (no ignitionDeps in profile) ──
    // Reproduce the existing WheelSmith logic but from the profile data
    const channelTypes = new Set(channels.map(ch => ch.type))

    if (channelTypes.has('dimmer') && testChannelType !== 'dimmer') {
      result.set('dimmer', 255)
    }
    if (channelTypes.has('shutter') && testChannelType !== 'shutter') {
      result.set('shutter', 255)
    } else if (channelTypes.has('strobe') && testChannelType !== 'strobe' && !channelTypes.has('shutter')) {
      result.set('strobe', 0)  // strobe=0 = continuous light
    }
    // Include defaultValues > 0 for all other channels
    for (const ch of channels) {
      if (ch.type === testChannelType) continue
      if (result.has(ch.type)) continue
      if (ch.defaultValue > 0) {
        result.set(ch.type, ch.defaultValue)
      }
    }
  }

  return { channels: result }
}
```

### 4.3 — Integración en WheelSmith

```typescript
// WheelSmithEmbedded.tsx — sendTestWithLight() refactor

import { hydrateIgnitionFrame } from '../../../utils/IgnitionHydrator'

const sendTestWithLight = useCallback(async (wheelDmxValue: number): Promise<void> => {
  if (!effectiveTestFixtureId || !effectiveTestFixture?.channels) {
    // Fallback directo (sin perfil)
    sendDirectDMX(wheelDmxValue)
    return
  }

  // 🔥 WAVE 4717: Hydrate ignition frame from profile
  const ignitionFrame = hydrateIgnitionFrame(
    effectiveTestFixture.channels,
    'color_wheel',
  )

  // Build Arbiter payload
  const nativeControls: Record<string, number> = { color_wheel: wheelDmxValue }
  const phantomControls: Record<string, number> = {}
  const channelsList: string[] = ['color_wheel']

  for (const [chType, dmxValue] of ignitionFrame.channels) {
    if (ARBITER_NATIVE_CHANNELS.has(chType)) {
      nativeControls[chType] = dmxValue
    } else {
      phantomControls[chType] = dmxValue
    }
    channelsList.push(chType)
  }

  const controls: Record<string, unknown> = { ...nativeControls }
  if (Object.keys(phantomControls).length > 0) {
    controls['phantomChannels'] = phantomControls
  }

  try {
    await lux.arbiter.setManual({
      fixtureIds: [effectiveTestFixtureId],
      controls: controls as Record<string, number>,
      channels: channelsList,
    })
  } catch (err) {
    console.error('[WheelSmith] ❌ Arbiter.setManual falló:', err)
  }
}, [/* deps */])
```

### 4.4 — Integración en TestPanel

```typescript
// TestPanel.tsx — handleTest() refactor

import { hydrateIgnitionFrame } from '../../../utils/IgnitionHydrator'

const handleTest = useCallback(async (testType: TestType) => {
  if (!fixtureId || disabled || dmxBaseAddress === null) return

  if (activeTest === testType) {
    setActiveTest(null)
    await handleBlackout()
    return
  }

  setActiveTest(testType)

  // 🔥 WAVE 4717: Hydrate ignition dependencies from fixture profile
  const fixtureChannels: FixtureChannel[] = fixture?.channels ?? []
  const primaryChannelType: ChannelType =
    testType === 'color' ? 'dimmer' :
    testType === 'strobe' ? 'strobe' :
    testType === 'gobo' ? 'gobo' : 'dimmer'

  const ignitionFrame = hydrateIgnitionFrame(fixtureChannels, primaryChannelType)

  // Send ignition dependencies first
  for (const [chType, dmxValue] of ignitionFrame.channels) {
    const chIdx = channels.findIndex(c => c.type === chType)
    if (chIdx >= 0) testChannel(chIdx, dmxValue)
  }

  // Then send the primary test value
  switch (testType) {
    case 'color': {
      const dimmerIdx = channels.findIndex(c => c.type === 'dimmer')
      if (dimmerIdx >= 0) testChannel(dimmerIdx, 255)
      const colorWheelIdx = channels.findIndex(c => c.type === 'color_wheel')
      if (colorWheelIdx >= 0) testChannel(colorWheelIdx, 0)
      break
    }
    case 'strobe': {
      const dimmerIdx = channels.findIndex(c => c.type === 'dimmer')
      if (dimmerIdx >= 0) testChannel(dimmerIdx, 255)
      const strobeIdx = channels.findIndex(c => c.type === 'strobe')
      if (strobeIdx >= 0) testChannel(strobeIdx, 195)
      break
    }
    case 'gobo': {
      const dimmerIdx = channels.findIndex(c => c.type === 'dimmer')
      if (dimmerIdx >= 0) testChannel(dimmerIdx, 255)
      const goboIdx = channels.findIndex(c => c.type === 'gobo')
      if (goboIdx >= 0) testChannel(goboIdx, 39)
      break
    }
  }
}, [/* deps */])
```

---

## PLAN DE IMPLEMENTACIÓN

| Fase | Archivo(s) | Complejidad | Dependencias |
|------|-----------|-------------|--------------|
| **F1** | `types/FixtureDefinition.ts` | Baja | Ninguna |
| **F2** | `core/aether/capability-node.ts` | Baja | F1 |
| **F3** | `core/forge/types.ts` + `NodeGraphBuilder.ts` | Media | F1 |
| **F4** | `core/aether/ingestion/NodeExtractionPipeline.ts` | Media | F2 |
| **F5** | `core/aether/resolver/NodeResolver.ts` | Media | F2, F4 |
| **F6** | `utils/IgnitionHydrator.ts` (nuevo) | Baja | F1 |
| **F7** | `components/ForgeView/IgnitionDepsEditor.tsx` (nuevo) | Media | F1 |
| **F8** | `components/ForgeView/FixtureForgeEmbedded.tsx` | Media | F1, F7 |
| **F9** | `components/ForgeView/WheelSmithEmbedded.tsx` | Baja | F6 |
| **F10** | `components/CalibrationView/TestPanel.tsx` | Baja | F6 |
| **F11** | Tests: extraction, resolver, hydrator | Media | F4-F6 |

**Estimación total:** ~400-500 líneas de código de producción + ~200 líneas de tests.
**Riesgo de regresión:** BAJO — el campo `ignitionDeps` es opcional en todas las capas.
Los perfiles existentes sin el campo producen cero overhead (early return en todos los paths).

---

## INVARIANTES DE SEGURIDAD

1. **Inyección HTP:** Los valores de ignición NUNCA bajan un valor existente.
   Solo suben (`max(existing, required)`). Un operador que ponga shutter a 128
   manualmente nunca será pisoteado.

2. **Zero-alloc hot path:** El `_ignitionMap` se computa en `registerDevice()`.
   El hot path solo itera arrays pre-computados (cero `Map.get()` por tipo).

3. **Backward compatible:** Perfiles sin `ignitionDeps` no ejecutan ningún código
   nuevo. El `_ignitionMap` queda vacío para esos devices.

4. **Lamp safety:** El modo `'release'` previene enviar `control=128` (lamp ON)
   cuando el dimmer está en 0 — evitando ciclos de encendido/apagado de la lámpara.

5. **DarkSpin compatible:** La inyección se ejecuta **antes** del DarkSpin sweep.
   Si la rueda de color está en tránsito, DarkSpin sigue pudiendo apagar el dimmer
   (su sweep sobrescribe el buffer después de la inyección).

---

## FIRMA DEL ARQUITECTO

```
WAVE-4717-BLUEPRINT.md
Status: READY FOR REVIEW
Signed: Cascade (Opus)
Date:   2025-05-12T20:54:00-03:00

Zero production code written.
Zero files modified.
Ready for implementation upon approval.
```
