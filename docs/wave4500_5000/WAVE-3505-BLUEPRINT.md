# WAVE 3505 — THE AGNOSTIC ENGINE BLUEPRINT

Estado: DISENO ARQUITECTONICO (VISION V2)
Rama objetivo: `v2-agnostic`
Predecesores: `WAVE-3504-BLUEPRINT.md`, `WAVE-3504-EXT-BLUEPRINT.md`, `CORE-MODULAR-MAP.md`
Sucesor previsto: WAVE 3506 — Implementacion incremental
Alcance: Diseno fundacional del Motor Agnostico, Nodos de Capacidad y Sub-Emisores. NO escribir logica interna — solo estructura, responsabilidades, interfaces, flujos de datos y filosofia.

---

## 0) Manifiesto filosofico

### El problema

Luxsync piensa en **Aparatos DMX**. Un PAR LED es un blob de 8 canales. Un Beam 2R es otro blob de 16 canales. Un Fan de Tungsteno es un blob de 9 canales donde 6 de ellos son petalos independientes que deberian reaccionar individualmente al bombo, pero el motor los ve como un solo "fixture" con un solo dimmer.

El resultado: cada tipo nuevo de fixture requiere logica custom en `FixtureMapper`, hacks en `phantomChannels`, y rutas especiales en el Arbiter. La complejidad crece linealmente con cada aparato.

### La solucion

**Luxsync deja de ver Aparatos y empieza a ver Capacidades.**

Un "fixture" es una **carcasa fisica** — un contenedor inerte que agrupa **Nodos de Capacidad** (`CapabilityNode`). Cada nodo es una unidad atomica que el motor entiende nativamente:

- Un PAR LED RGB = 1x `COLOR_NODE` + 1x `IMPACT_NODE` (dimmer)
- Un Beam 2R = 1x `COLOR_NODE` (rueda) + 1x `KINETIC_NODE` (pan/tilt) + 1x `BEAM_NODE` (gobo/prism/zoom) + 1x `IMPACT_NODE` (shutter)
- Un Fan de Tungsteno = **6x `IMPACT_NODE`** (petalos) + 1x `COLOR_NODE` (dimmer master, si tiene)
- Una pantalla LED 50px = **50x `COLOR_NODE`** (pixel array)
- Una maquina de humo = 1x `ATMOSPHERE_NODE` (pump + fan)

El motor no necesita saber que es un "Beam 2R". Solo necesita saber que tiene un nodo de color tipo rueda, un nodo cinetico con steppers a 180 deg/s, y un nodo de haz con gobo + prisma.

### Principios fundamentales

1. **Capacidad como ciudadano de primera clase** — los sistemas del motor iteran sobre nodos, no sobre fixtures.
2. **Data-Oriented Design** — separar datos (componentes) de logica (sistemas). Inspirado en ECS, adaptado a TypeScript.
3. **Zero-alloc frame path** — el hot path de 44Hz no puede crear objetos. Pre-allocar todo en patch time.
4. **Backward compatible** — el pipeline existente (`LightingIntent -> Layer0_Titan -> FinalLightingTarget -> HAL`) sigue funcionando via adaptador. Migracion incremental, no big bang.
5. **Protocol agnostic** — los nodos no saben de DMX. La traduccion a protocolo fisico es responsabilidad exclusiva del HAL via `NodeResolver`.

---

## 1) Topologia de Nodos de Capacidad

### 1.1 Taxonomia de nodos

Cinco familias de nodos cubren el 100% del hardware de iluminacion profesional conocido:

| Node Type | Canales que engulle | Owner del motor | Ejemplo |
|---|---|---|---|
| `COLOR_NODE` | R, G, B, W, Amber, UV, CTO, CTB, CMY, `color_wheel` | `SeleneColorEngine` | LED wash: RGB directo. Beam: color wheel. |
| `IMPACT_NODE` | `dimmer`, `shutter`, `strobe` | `ImpactSystem` (fisica reactiva) | Dimmer de un PAR. Cada petalo de un Fan. Shutter de un Beam. |
| `KINETIC_NODE` | `pan`, `pan_fine`, `tilt`, `tilt_fine`, `speed`, `rotation` | `KineticSystem` (VMM + physics) | Pan/tilt de un mover. Rotacion continua de un mirror ball. |
| `BEAM_NODE` | `zoom`, `focus`, `iris`, `frost`, `gobo`, `gobo_rotation`, `prism`, `prism_rotation` | `BeamSystem` (Selene IA FX) | Gobo + prisma de un spot. Zoom de un wash. |
| `ATMOSPHERE_NODE` | `custom` (pump, fan, spark, etc.) | `AtmosphereSystem` (cue-driven) | Maquina de humo: pump + fan. Sparkular: chispas. |

**Regla de asignacion:** un canal DMX pertenece a **exactamente un nodo**. No hay canales compartidos entre nodos. Si un fixture tiene un canal `dimmer` que controla toda la unidad (master dimmer), ese canal pertenece al `IMPACT_NODE` principal. Si un petalo tiene su propio dimmer, es un `IMPACT_NODE` separado.

### 1.2 Anatomia de un CapabilityNode

```
+-----------------------------------------------------+
|                 CapabilityNode                       |
|                                                     |
|  nodeId:    "fan-tungsten-petal-3"                  |
|  nodeType:  IMPACT_NODE                             |
|  deviceId:  "fan-tungsten-01"      (Physical host)  |
|  zoneId:    "FLOOR_CENTER"                          |
|  role:      "percussion"           (Semantic hint)  |
|                                                     |
|  channels: [                                        |
|    { type: "dimmer", dmxOffset: 5, default: 0 }     |
|  ]                                                  |
|                                                     |
|  constraints: {                                     |
|    minChangeTimeMs: 0,                              |
|    maxValue: 255,                                   |
|    responseType: "digital"                          |
|  }                                                  |
|                                                     |
|  state: Float64Array(4)   <-- pre-allocated slot    |
|  [0] = target value                                 |
|  [1] = current value (post-physics)                 |
|  [2] = velocity                                     |
|  [3] = timestamp                                    |
+-----------------------------------------------------+
```

### 1.3 Sub-Emisores: un fixture, multiples nodos

El fixture **no existe** como entidad en el motor. Es un contenedor de empaquetado que vive solo en dos momentos:

1. **Patch time** — "La Forja" define el fixture y sus nodos.
2. **DMX flush time** — el `NodeResolver` reagrupa nodos por `deviceId` para construir el paquete DMX.

Entre patch y flush, el motor solo ve nodos.

**Ejemplo: Fan de Tungsteno (9 canales DMX)**

```
DeviceDefinition: "fan-tungsten"
+-- dmxAddress: 100
+-- universe: 1
+-- channelCount: 9
|
+-- nodes[0]: IMPACT_NODE "master-dimmer"
|   +-- channels: [{ type: "dimmer", dmxOffset: 0 }]
|
+-- nodes[1]: IMPACT_NODE "petal-1"  role: "percussion"
|   +-- channels: [{ type: "dimmer", dmxOffset: 1 }]
|
+-- nodes[2]: IMPACT_NODE "petal-2"  role: "percussion"
|   +-- channels: [{ type: "dimmer", dmxOffset: 2 }]
|
+-- nodes[3]: IMPACT_NODE "petal-3"  role: "percussion"
|   +-- channels: [{ type: "dimmer", dmxOffset: 3 }]
|
+-- nodes[4]: IMPACT_NODE "petal-4"  role: "percussion"
|   +-- channels: [{ type: "dimmer", dmxOffset: 4 }]
|
+-- nodes[5]: IMPACT_NODE "petal-5"  role: "percussion"
|   +-- channels: [{ type: "dimmer", dmxOffset: 5 }]
|
+-- nodes[6]: IMPACT_NODE "petal-6"  role: "percussion"
    +-- channels: [{ type: "dimmer", dmxOffset: 6 }]
```

Cuando el bombo suena, el `ImpactSystem` itera sobre todos los `IMPACT_NODE` con `role: "percussion"` y les inyecta un spike de intensidad. Los 6 petalos reaccionan **individualmente** sin codigo custom. Magia pura.

---

## 2) Arquitectura del Motor: ECS pragmatico

### 2.1 Por que ECS (y por que pragmatico)

El patron **Entity-Component-System** de los motores de videojuegos resuelve exactamente nuestro problema:

| Concepto ECS | Equivalente Luxsync | Beneficio |
|---|---|---|
| **Entity** | `NodeId` (un u32 index en un SlotMap) | Identity pura, sin overhead de objeto |
| **Component** | `NodeData` (typed array slots para cada tipo de nodo) | Data-oriented, cache-coherent |
| **System** | `ColorSystem`, `ImpactSystem`, `KineticSystem`, `BeamSystem`, `AtmosphereSystem` | Logica desacoplada, iteracion por tipo |

**Pragmatico** porque no implementamos un ECS generico completo (eso seria sobre-ingenieria en TypeScript). En su lugar:

- Usamos un **NodeGraph** (SlotMap tipado) como el World.
- Cada System recibe una **vista tipada** del NodeGraph (solo los nodos de su tipo).
- Los Systems producen **NodeIntents** que se inyectan al Arbiter.
- No hay queries dinamicas ni archetypes — el tipado es estatico por familia de nodo.

### 2.2 El NodeGraph (World)

El `NodeGraph` es el registro central de todos los nodos activos. Es el corazon del Motor Agnostico.

```
+---------------------------------------------------------------+
|                          NodeGraph                            |
|                                                               |
|  Dense Arrays (pre-allocated at patch time):                  |
|  +----------------------------------------------------------+|
|  | colorNodes:    NodeSlot<ColorNodeData>[]     (N slots)    ||
|  | impactNodes:   NodeSlot<ImpactNodeData>[]    (M slots)    ||
|  | kineticNodes:  NodeSlot<KineticNodeData>[]   (K slots)    ||
|  | beamNodes:     NodeSlot<BeamNodeData>[]      (B slots)    ||
|  | atmosNodes:    NodeSlot<AtmosNodeData>[]     (A slots)    ||
|  +----------------------------------------------------------+|
|                                                               |
|  Index Maps (lookup):                                         |
|  +----------------------------------------------------------+|
|  | nodeIdToSlot:  Map<NodeId, { family, index }>             ||
|  | deviceIndex:   Map<DeviceId, NodeId[]>                    ||
|  | zoneIndex:     Map<ZoneId, NodeId[]>                      ||
|  | roleIndex:     Map<Role, NodeId[]>                        ||
|  | typeIndex:     Map<NodeType, NodeId[]>                    ||
|  +----------------------------------------------------------+|
|                                                               |
|  Methods:                                                     |
|  - registerDevice(def: DeviceDefinition): NodeId[]            |
|  - unregisterDevice(deviceId: DeviceId): void                 |
|  - getView<T>(nodeType: NodeType): NodeView<T>               |
|  - getNodesByZone(zoneId: ZoneId): NodeId[]                   |
|  - getNodesByRole(role: Role): NodeId[]                       |
|  - getDeviceNodes(deviceId: DeviceId): NodeId[]               |
|  - getNodeData(nodeId: NodeId): NodeData                      |
|  - snapshot(): NodeGraphSnapshot   (for debug/telemetry)      |
+---------------------------------------------------------------+
```

**Caracteristicas clave:**

- **Dense arrays** — los nodos de cada tipo viven en arrays contiguos. Cuando `ImpactSystem` itera, esta recorriendo memoria contigua (cache-friendly).
- **Slot stability** — `NodeId` es estable tras patch. Los arrays no se reordenan en runtime.
- **Zero-alloc views** — `getView<T>()` devuelve un wrapper ligero sobre el array existente, sin copiar.
- **Multi-index** — lookup por zona, rol, device o tipo es O(1) via mapas pre-construidos.

### 2.3 Los cinco Systems

Cada System es un modulo **stateless** (o con estado minimo encapsulado) que opera sobre una vista del NodeGraph y produce `NodeIntent[]`.

```
+-----------------------------------------------------------------------+
|                         FRAME PIPELINE                                |
|                                                                       |
|  MusicalContext + AudioMetrics + VibeProfile                         |
|       |                                                               |
|       +-->  ColorSystem.process(colorView, ctx)    -> ColorIntent[]   |
|       +-->  ImpactSystem.process(impactView, ctx)  -> ImpactIntent[]  |
|       +-->  KineticSystem.process(kineticView, ctx)-> KineticIntent[] |
|       +-->  BeamSystem.process(beamView, ctx)      -> BeamIntent[]    |
|       +-->  AtmosphereSystem.process(atmosView,ctx)-> AtmosIntent[]   |
|                                                                       |
|       Todos producen NodeIntent (nodeId -> channel values)            |
|       |                                                               |
|       v                                                               |
|  IntentBus.drain() -> NodeArbiter.arbitrate()                        |
|       |                                                               |
|       v                                                               |
|  ArbitratedNodeMap (nodeId -> final channel values)                   |
|       |                                                               |
|       v                                                               |
|  NodeResolver.resolve(arbitrated, nodeGraph) -> DMXPacket[]          |
|       |                                                               |
|       v                                                               |
|  HAL.flushToDriver(packets)                                          |
+-----------------------------------------------------------------------+
```

#### 2.3.1 ColorSystem

**Responsabilidad:** Asignar color a cada `COLOR_NODE` basandose en paleta del Vibe, zona, contexto musical y tipo de mezcla de color del nodo.

**Input:** `NodeView<ColorNodeData>`, `MusicalContext`, `VibeProfile`, `SelenePalette`
**Output:** `ColorIntent[]` — cada uno con `{ nodeId, channels: { r, g, b, w?, colorWheel? } }`

**Logica conceptual:**
- Para nodos RGB/RGBW -> asigna color de la paleta segun zona y paletteRole
- Para nodos de rueda -> delega a `ColorTranslator` (ya existente en HAL) para encontrar el color mas cercano
- Para nodos CMY -> conversion RGB -> CMY inversa
- Respeta `constraints.minChangeTimeMs` del nodo (proteccion mecanica para ruedas)

**Reemplaza:** `FixtureMapper.intentPaletteToRGB()`, `getColorRoleForZone()`, la logica de HAL translation inline.

#### 2.3.2 ImpactSystem

**Responsabilidad:** Calcular la intensidad de cada `IMPACT_NODE` basandose en las bandas de audio (bass, mid, high), la energia global, y el `role` del nodo.

**Input:** `NodeView<ImpactNodeData>`, `AudioMetrics`, `MusicalContext`, `VibeProfile`
**Output:** `ImpactIntent[]` — cada uno con `{ nodeId, channels: { dimmer, shutter? } }`

**Logica conceptual:**
- Role `percussion` -> responde a bass/sub-bass con ataque exponencial (la curva `audio^2.5 * 255`)
- Role `breath` -> responde a mid con respuesta suave (breathing)
- Role `accent` -> responde a high con strobes afilados
- Role `ambient` -> responde a energia global con floor minimo
- Cada nodo puede tener su propia curva de transferencia (linear, exponential, logarithmic)

**La Matriz de Bandas x Roles** se configura por Vibe:

```
+------------------+----------+-----------+----------+----------+
| Band \ Role      |percussion|  breath   |  accent  |  ambient |
+------------------+----------+-----------+----------+----------+
| SubBass (20-60)  |   0.80   |   0.10    |   0.00   |   0.10   |
| Bass (60-250)    |   0.60   |   0.20    |   0.05   |   0.15   |
| Mid (250-2k)     |   0.10   |   0.70    |   0.10   |   0.10   |
| HighMid (2k-6k)  |   0.05   |   0.15    |   0.70   |   0.10   |
| Presence (6k-12k)|   0.00   |   0.10    |   0.80   |   0.10   |
| Air (12k-20k)    |   0.00   |   0.05    |   0.60   |   0.35   |
| Energy (global)  |   0.20   |   0.30    |   0.20   |   0.30   |
+------------------+----------+-----------+----------+----------+
```

Los pesos son configurables por Vibe. Techno: percussion tiene 0.90 en SubBass. Chill: breath tiene 0.80 en Mid.

**Reemplaza:** `ZoneRouter` + `calculateZoneIntents()` + `calculateMasterIntensity()` del Engine/HAL actual.

#### 2.3.3 KineticSystem

**Responsabilidad:** Generar posiciones (pan, tilt, rotation) para cada `KINETIC_NODE` usando el VMM (VibeMovementManager), physics constraints, y stereo generation.

**Input:** `NodeView<KineticNodeData>`, `AudioMetrics`, `MusicalContext`, `VibeProfile`
**Output:** `KineticIntent[]` — cada uno con `{ nodeId, channels: { pan, tilt, panFine?, tiltFine?, speed?, rotation? } }`

**Logica conceptual:**
- Llama al VMM con `fixtureIndex` basado en la posicion fisica del nodo (no en una zona hardcoded)
- Aplica stereo mirror/snake automaticamente segun `position.x` del nodo
- Respeta `constraints.maxSpeed` del nodo (presupuesto del gearbox)
- Para nodos con `rotation`: calcula velocidad de rotacion basada en BPM
- Coordenadas normalizadas 0..1, la traduccion a 0..255 DMX es responsabilidad del `NodeResolver`

**Reemplaza:** `TitanEngine.calculateMovement()`, la logica de stereo pair generation, el Gearbox budget.

#### 2.3.4 BeamSystem

**Responsabilidad:** Controlar la conformacion de haz (zoom, focus, iris, gobos, prismas, frost) de cada `BEAM_NODE`.

**Input:** `NodeView<BeamNodeData>`, `MusicalContext`, `VibeProfile`, `SeleneDecision?`
**Output:** `BeamIntent[]` — cada uno con `{ nodeId, channels: { zoom?, focus?, gobo?, prism?, ... } }`

**Logica conceptual:**
- Valores base vienen del Vibe (optics config existente)
- Selene IA FX puede overridear para transiciones dramaticas (gobo change en drop, prisma en build)
- `DarkSpinFilter` ya existente se aplica a nodos con ruedas mecanicas
- Los gobos/prismas se mantienen estaticos por defecto; solo cambian por decision de Selene o Timeline

**Reemplaza:** `optics` del Engine, `DarkSpinFilter` inline en HAL.

#### 2.3.5 AtmosphereSystem

**Responsabilidad:** Controlar dispositivos no luminicos (humo, chispas, ventiladores). Opera exclusivamente por cues — no responde al audio frame a frame.

**Input:** `NodeView<AtmosNodeData>`, `AtmosphereCueQueue`
**Output:** `AtmosIntent[]` — cada uno con `{ nodeId, channels: Record<string, number> }`

**Logica conceptual:**
- El usuario programa cues de humo desde la UI o el Timeline
- El system evalua la cola de cues y emite valores DMX correspondientes
- Seguridad: tiempo maximo de activacion, cooldown, interlock (no humo + chispas simultaneo)

**No tiene equivalente actual** — es una extension nativa del Motor Agnostico.

---

## 3) Interfaces de datos del frame

### 3.1 Interfaces fundamentales

```ts
// === IDENTIDAD ===

/** Identificador estable de un nodo. Inmutable tras patch. */
type NodeId = string   // "device:channel-group" e.g. "fan-01:petal-3"

/** Identificador de dispositivo fisico (contenedor) */
type DeviceId = string // "fan-tungsten-01"

/** Familia de nodo */
type NodeFamily = 'COLOR' | 'IMPACT' | 'KINETIC' | 'BEAM' | 'ATMOSPHERE'

/** Rol semantico (hint para los Systems) */
type NodeRole =
  | 'primary'      // Nodo principal del device
  | 'percussion'   // Reacciona a golpes ritmicos (bass/kick)
  | 'breath'       // Respiracion suave (mid)
  | 'accent'       // Acentos agudos (high/snare)
  | 'ambient'      // Relleno ambiental
  | 'decoration'   // Efecto visual (gobos, prismas)
  | 'atmosphere'   // Humo, chispas
  | 'pixel'        // Pixel de array LED
  | string         // Extensible para roles custom

// === DEFINICION DE NODO ===

interface NodeChannelDef {
  /** Tipo de canal (red, green, blue, dimmer, pan, tilt, etc.) */
  type: ChannelType
  /** Offset DMX relativo al inicio del device */
  dmxOffset: number
  /** Valor default cuando nadie controla este canal */
  defaultValue: number
  /** Es 16-bit (ocupa 2 canales DMX)? */
  is16bit?: boolean
  /** Nombre custom (para canales 'custom') */
  customName?: string
}

interface NodeConstraints {
  /** Tipo de respuesta fisica */
  responseType: 'digital' | 'mechanical' | 'discharge'
  /** Tiempo minimo entre cambios (ms) — proteccion mecanica */
  minChangeTimeMs: number
  /** Valor DMX maximo permitido */
  maxValue: number
  /** Velocidad maxima (para cineticos: grados/s, para dimmers: DMX/s) */
  maxSpeed?: number
  /** Curva de transferencia sugerida */
  transferCurve?: 'linear' | 'exponential' | 'logarithmic' | 'scurve'
  /** Exponente para curva exponencial (default 2.5 para impact) */
  curveExponent?: number
}

interface CapabilityNodeDef {
  /** ID unico del nodo (generado en patch time) */
  nodeId: NodeId
  /** Familia del nodo */
  family: NodeFamily
  /** Device fisico que lo contiene */
  deviceId: DeviceId
  /** Zona espacial asignada */
  zoneId: string
  /** Posicion fisica 3D (para stereo routing) */
  position?: { x: number; y: number; z: number }
  /** Rol semantico */
  role: NodeRole
  /** Canales DMX que posee este nodo */
  channels: NodeChannelDef[]
  /** Restricciones de hardware */
  constraints: NodeConstraints
  /** Metadata extra del perfil HAL (color wheel def, etc.) */
  profileMeta?: Record<string, unknown>
}

// === DEVICE DEFINITION (Lo que La Forja produce) ===

interface DeviceDefinition {
  /** ID unico del device */
  deviceId: DeviceId
  /** Nombre legible */
  name: string
  /** Tipo original (para UI) */
  type: string
  /** Direccion DMX base */
  dmxAddress: number
  /** Universo DMX */
  universe: number
  /** Numero total de canales DMX */
  channelCount: number
  /** Nodos de capacidad que contiene */
  nodes: CapabilityNodeDef[]
  /** Datos de calibracion */
  calibration?: DeviceCalibration
  /** Es virtual (solo preview, no DMX fisico)? */
  isVirtual?: boolean
}

// === NODE INTENTS (Output de los Systems) ===

/** Intent generico: un nodo + sus valores de canal deseados */
interface NodeIntent {
  nodeId: NodeId
  /** Valores deseados para cada canal del nodo (type -> value 0-1 normalized) */
  values: Record<string, number>
  /** Prioridad de este intent (para resolver conflictos entre systems) */
  priority: number
  /** Confianza del system en este intent (0-1) */
  confidence: number
  /** Fuente del intent */
  source: 'color_system' | 'impact_system' | 'kinetic_system' | 'beam_system'
        | 'atmos_system' | 'selene_ai' | 'chronos' | 'manual' | 'effect'
}

/** Mapa aggregado: nodeId -> NodeIntent[] (multiples intents por nodo posible) */
type AggregatedNodeIntentMap = Map<NodeId, NodeIntent[]>

/** Mapa arbitrado: nodeId -> valores finales por canal */
type ArbitratedNodeMap = Map<NodeId, Record<string, number>>
```

### 3.2 Interfaces de los Systems

```ts
/** Vista tipada sobre un subconjunto del NodeGraph */
interface NodeView<T extends NodeData> {
  /** Numero de nodos activos de este tipo */
  readonly count: number
  /** Iterador eficiente sobre los nodos */
  forEach(fn: (node: T, index: number) => void): void
  /** Acceso directo por index (O(1)) */
  get(index: number): T
  /** Filtro por zona */
  byZone(zoneId: string): T[]
  /** Filtro por rol */
  byRole(role: NodeRole): T[]
}

// -- Color System --

interface IColorSystem {
  process(
    view: NodeView<ColorNodeData>,
    palette: SelenePalette,
    context: MusicalContext,
    vibeProfile: VibeProfile
  ): NodeIntent[]
}

interface ColorNodeData extends NodeData {
  family: 'COLOR'
  /** Tipo de mezcla: rgb, rgbw, cmy, wheel, hybrid */
  mixingType: ColorMixingType
  /** Definicion de rueda (si aplica) */
  colorWheel?: ColorWheelDefinition
  /** Ultimo color asignado (para interpolacion LERP) */
  currentColor: { r: number; g: number; b: number }
}

// -- Impact System --

interface IImpactSystem {
  process(
    view: NodeView<ImpactNodeData>,
    audio: EngineAudioMetrics,
    context: MusicalContext,
    vibeProfile: VibeProfile
  ): NodeIntent[]
}

interface ImpactNodeData extends NodeData {
  family: 'IMPACT'
  role: NodeRole
  /** Curva de transferencia para este nodo */
  transferCurve: TransferCurve
  /** Mezcla de bandas para este rol (configurable por Vibe) */
  bandMix: BandMixWeights
  /** Estado de envelope actual (para decay suave) */
  envelopeState: { current: number; velocity: number }
}

interface BandMixWeights {
  subBass: number   // 0-1
  bass: number
  mid: number
  highMid: number
  presence: number
  air: number
  energy: number    // Global energy weight
}

// -- Kinetic System --

interface IKineticSystem {
  process(
    view: NodeView<KineticNodeData>,
    audio: EngineAudioMetrics,
    context: MusicalContext,
    vibeProfile: VibeProfile,
    mechanicsOverride?: MechanicsOutput | null
  ): NodeIntent[]
}

interface KineticNodeData extends NodeData {
  family: 'KINETIC'
  /** Tipo de motor */
  motorType: 'stepper' | 'servo' | 'galvo'
  /** Velocidades maximas (grados/s) */
  maxPanSpeed: number
  maxTiltSpeed: number
  /** Posicion actual (para physics interpolation) */
  currentPosition: { pan: number; tilt: number }
  /** Posicion fisica 3D para stereo routing */
  physicalPosition: { x: number; y: number; z: number }
  /** Fixture index para VMM stereo generation */
  stereoIndex: number
  stereoTotal: number
}

// -- Beam System --

interface IBeamSystem {
  process(
    view: NodeView<BeamNodeData>,
    context: MusicalContext,
    vibeProfile: VibeProfile,
    seleneDecision?: SeleneBeamDecision
  ): NodeIntent[]
}

interface BeamNodeData extends NodeData {
  family: 'BEAM'
  hasGobo: boolean
  hasGoboRotation: boolean
  hasPrism: boolean
  hasPrismRotation: boolean
  hasZoom: boolean
  hasFocus: boolean
  hasFrost: boolean
  /** Estado actual de DarkSpin (debounce de rueda mecanica) */
  darkSpinState?: { lastChangeMs: number; isLocked: boolean }
}

// -- Atmosphere System --

interface IAtmosphereSystem {
  process(
    view: NodeView<AtmosNodeData>,
    cueQueue: AtmosphereCueQueue
  ): NodeIntent[]
}

interface AtmosNodeData extends NodeData {
  family: 'ATMOSPHERE'
  /** Tipo de device atmosferico */
  atmosType: 'fog' | 'haze' | 'spark' | 'fan' | 'pyro' | 'custom'
  /** Estado de seguridad */
  safety: { lastActivationMs: number; totalActiveMs: number; cooldownRemaining: number }
}
```

---

## 4) El NodeArbiter: composicion multicapa sobre nodos

### 4.1 De fixture-centric a node-centric

El `ArbitrationDirector` actual itera `fixtures[]` y para cada fixture mezcla canales de las capas L0-L4 usando HTP/LTP. El nuevo `NodeArbiter` hace lo mismo pero sobre **nodos**:

```
+---------------------------------------------------------------------+
|                         NodeArbiter                                 |
|                                                                     |
|  Inputs por frame:                                                  |
|  +-- L0: systemIntents    (IntentBus from 5 Systems)               |
|  +-- L1: seleneOverrides  (NodeIntent[] from Selene IA)            |
|  +-- L2: manualOverrides  (NodeIntent[] from UI/MIDI)              |
|  +-- L3: effectIntents    (NodeIntent[] from LiveFXEngine)         |
|  +-- L4: blackout         (boolean)                                 |
|  +-- LP: playbackIntents  (NodeIntent[] from Chronos Timeline)     |
|                                                                     |
|  Per-node merge:                                                    |
|  for each nodeId in nodeGraph:                                      |
|    candidates = gatherCandidates(nodeId, L0..LP)                    |
|    for each channelType in node.channels:                           |
|      strategy = getStrategy(channelType)  // HTP/LTP/ADD            |
|      finalValue = mergeStrategy.resolve(candidates)                 |
|    arbitratedMap.set(nodeId, finalValues)                            |
|                                                                     |
|  Output: ArbitratedNodeMap                                          |
+---------------------------------------------------------------------+
```

### 4.2 Comunicacion eficiente: el IntentBus

Para comunicar los 5 Systems con el NodeArbiter sin crear N*M objetos por frame, usamos un **IntentBus** — un buffer pre-allocated que se llena y se drena cada frame:

```ts
interface IIntentBus {
  /** Resetear el bus al inicio del frame (zero-alloc: solo mueve el write pointer) */
  clear(): void

  /** Escribir un intent (los Systems llaman esto) */
  push(intent: NodeIntent): void

  /** Leer todos los intents de un nodo (el Arbiter llama esto) */
  getIntentsForNode(nodeId: NodeId): NodeIntent[]

  /** Leer todos los intents (para debug/telemetry) */
  getAll(): ReadonlyArray<NodeIntent>

  /** Numero de intents en el frame actual */
  readonly count: number
}
```

**Implementacion interna:** un array pre-allocated de `MAX_INTENTS_PER_FRAME` (e.g. 2048). `clear()` resetea el write index a 0 sin desalocar. `push()` escribe en la siguiente posicion. `getIntentsForNode()` usa un index auxiliar (nodeId -> [startIdx, endIdx]) que se reconstruye tras el ultimo `push()` del frame.

Costo de un frame: **0 allocations, 0 GC pressure**. Solo escrituras en arrays pre-existentes.

### 4.3 Interfaz del NodeArbiter

```ts
interface INodeArbiter {
  /** Inyectar intents de los Systems (L0) */
  setSystemIntents(bus: IIntentBus): void

  /** Inyectar overrides de Selene IA (L1) */
  setSeleneOverrides(intents: NodeIntent[]): void

  /** Inyectar overrides manuales (L2) */
  setManualOverride(nodeId: NodeId, channels: Record<string, number>): void
  clearManualOverride(nodeId: NodeId): void

  /** Inyectar effect intents (L3) */
  setEffectIntents(intents: NodeIntent[]): void

  /** Inyectar playback intents (Chronos) */
  setPlaybackIntents(intents: NodeIntent[]): void

  /** Blackout (L4) */
  setBlackout(active: boolean): void

  /** Ejecutar arbitraje para el frame actual */
  arbitrate(): ArbitratedNodeMap

  /** Grand Master global (0-1) */
  setGrandMaster(value: number): void
}
```

### 4.4 Backward Compatibility: el BridgeAdapter

Durante la migracion incremental, el pipeline V1 (`LightingIntent -> Layer0_Titan`) coexiste con el pipeline V2 (`NodeIntent -> NodeArbiter`). Un `BridgeAdapter` traduce entre ambos mundos:

```ts
interface IBridgeAdapter {
  /**
   * V1 -> V2: Convierte un LightingIntent en NodeIntents.
   * Usado cuando TitanEngine aun produce LightingIntents y el NodeArbiter
   * los necesita como L0 input.
   */
  lightingIntentToNodeIntents(
    intent: LightingIntent,
    nodeGraph: INodeGraph
  ): NodeIntent[]

  /**
   * V2 -> V1: Convierte ArbitratedNodeMap en FinalLightingTarget.
   * Usado cuando el pipeline legacy aun espera FinalLightingTarget.
   */
  arbitratedToFinalTarget(
    arbitrated: ArbitratedNodeMap,
    nodeGraph: INodeGraph,
    frameNumber: number
  ): FinalLightingTarget

  /**
   * Legacy fixture -> V2 device: Convierte PatchedFixture en DeviceDefinition.
   * Para backward compat con fixtures no migrados.
   */
  patchedFixtureToDevice(fixture: PatchedFixture): DeviceDefinition
}
```

Esto permite migrar un System a la vez sin romper el pipeline existente.

---

## 5) El NodeResolver: de nodos abstractos a DMX

### 5.1 Responsabilidad

El `NodeResolver` es el ultimo paso antes del hardware. Toma el `ArbitratedNodeMap` (nodeId -> valores normalizados 0-1) y produce `DMXPacket[]` listos para enviar al driver.

```ts
interface INodeResolver {
  /**
   * Resuelve nodos abstractos a paquetes DMX fisicos.
   *
   * Pipeline interno:
   * 1. Reagrupar nodos por deviceId
   * 2. Para cada nodo, mapear channel values (0-1) -> DMX (0-255)
   * 3. Aplicar constraints (maxValue, 16-bit splitting, transfer curves)
   * 4. Ensamblar DMX packet por device (address + channel array)
   * 5. Aplicar calibration offsets (pan/tilt invert, limits)
   *
   * @returns Paquetes DMX ordenados por (universe, address)
   */
  resolve(
    arbitrated: ArbitratedNodeMap,
    nodeGraph: INodeGraph
  ): DMXPacket[]
}
```

### 5.2 Pipeline de resolucion

```
ArbitratedNodeMap
  |
  +- nodeId "fan-01:petal-3" -> { dimmer: 0.87 }
  |   +- lookup node def: dmxOffset=5, maxValue=255, curve=exponential(2.5)
  |   +- apply curve: 0.87^2.5 = 0.708
  |   +- scale to DMX: round(0.708 * 255) = 181
  |   +- insert at device "fan-01" dmxAddress=100, offset=5 -> channel[5] = 181
  |
  +- nodeId "beam-01:color" -> { colorWheel: 0.35 }
  |   +- lookup: wheel fixture, apply ColorTranslator -> nearest wheel color DMX=75
  |   +- apply DarkSpin safety -> check debounce -> pass
  |   +- insert at device "beam-01" dmxAddress=1, offset=6 -> channel[6] = 75
  |
  +- ... for all arbitrated nodes

Output: DMXPacket[] = [
  { universe: 1, address: 1,   channels: [255, 0, 0, 255, 127, 127, 75, ...] },
  { universe: 1, address: 100, channels: [200, 0, 181, 0, 0, 0, 0, 0, 0] },
  ...
]
```

### 5.3 Transfer Curves (la Morfologia Exponencial)

Las curvas de transferencia transforman el valor normalizado (0-1) del intent al rango DMX (0-255), respetando la percepcion no lineal del ojo humano y las caracteristicas del hardware:

```ts
type TransferCurve = {
  type: 'linear' | 'exponential' | 'logarithmic' | 'scurve' | 'gamma'
  exponent?: number    // Para exponential: default 2.5
  gamma?: number       // Para gamma: default 2.2
  noiseGate?: number   // Valor minimo de input debajo del cual output = 0
}

// Implementaciones (funciones puras):
// linear:      output = input
// exponential: output = input^exponent          (snappy attack, smooth decay)
// logarithmic: output = log(1 + input*9) / log(10)  (suave, gentle)
// scurve:      output = 3*input^2 - 2*input^3   (smooth start + end)
// gamma:       output = input^(1/gamma)          (correccion perceptual)
```

El `ImpactSystem` usa `exponential(2.5)` por defecto para los nodos `percussion`:
- Input < 0.05 (noise gate) -> output = 0 (silencio absoluto)
- Input = 0.3 -> output = 0.049 (luz baja, casi apagada)
- Input = 0.7 -> output = 0.408 (presencia media)
- Input = 0.95 -> output = 0.881 (explosion: la luz ya esta casi a tope)
- Input = 1.0 -> output = 1.0 (whiteout)

La sensacion es de latigazo instantaneo cuando el bombo golpea, con una caida organica.

---

## 6) Hooks para extensibilidad

### 6.1 Hook: Selene IA

Selene opera como un **System mas** que produce `NodeIntent[]` en la capa L1. No tiene privilegios especiales sobre los otros systems; simplemente tiene una prioridad de layer superior (L1 > L0).

```ts
interface ISeleneNodeBridge {
  /**
   * Selene evalua el frame y produce overrides sobre nodos especificos.
   *
   * Ejemplos:
   * - Cambiar la paleta de un COLOR_NODE especifico en un momento dramatico
   * - Forzar un BEAM_NODE a cambiar gobo durante un build
   * - Sugerir una curva de transferencia mas agresiva para IMPACT_NODEs en un drop
   */
  evaluate(
    nodeGraph: INodeGraph,
    musicalContext: MusicalContext,
    consciousnessOutput: ConsciousnessOutput
  ): NodeIntent[]
}
```

**Nodos de interes para Selene:**
- `COLOR_NODE` — Selene puede sugerir hue shifts, saturation mods, palette overrides
- `BEAM_NODE` — Selene puede triggear cambios de gobo/prisma (las "Dream Simulations")
- `IMPACT_NODE` — Selene puede modificar la curva de transferencia en runtime (mas agresiva en drops, mas suave en verses)

### 6.2 Hook: FX Editor en vivo

El FX Editor opera como un productor de `NodeIntent[]` en la capa L3 (efectos). Cada efecto en el editor es un generador que produce intents para un subset de nodos:

```ts
interface ILiveFXEngine {
  /**
   * Evalua todos los efectos activos y produce NodeIntents.
   *
   * Cada efecto tiene:
   * - Un selector de nodos (por zona, tipo, rol, o IDs especificos)
   * - Un generador de valores (sine wave, chase, random, etc.)
   * - Parametros de timing (speed, phase, offset per node)
   */
  evaluate(
    nodeGraph: INodeGraph,
    timestamp: number,
    beatPhase: number
  ): NodeIntent[]
}

interface FXDefinition {
  /** Selector de nodos afectados */
  nodeSelector: NodeSelector
  /** Canales que el efecto controla */
  targetChannels: ChannelType[]
  /** Generador de forma de onda */
  waveform: 'sine' | 'square' | 'sawtooth' | 'triangle' | 'random' | 'chase'
  /** Velocidad (BPM-relativa o absoluta) */
  speed: number
  speedMode: 'bpm-sync' | 'absolute-hz'
  /** Offset de fase entre nodos (0 = todos iguales, 1 = full spread) */
  phaseSpread: number
  /** Amplitud (0-1) */
  amplitude: number
  /** Offset base (0-1) */
  offset: number
}

interface NodeSelector {
  /** Seleccion por familia de nodo */
  families?: NodeFamily[]
  /** Seleccion por zona */
  zones?: string[]
  /** Seleccion por rol */
  roles?: NodeRole[]
  /** Seleccion por IDs explicitos */
  nodeIds?: NodeId[]
  /** Seleccion por device */
  deviceIds?: DeviceId[]
}
```

Esto reemplaza los efectos hardcoded (`strobe`, `blinder`, `police`, `rainbow`) del `FixtureMapper` actual con un sistema generico que opera sobre nodos.

### 6.3 Hook: Pixel Mapping para LED arrays

Los arrays LED masivos (barras, paneles, pantallas) son simplemente **Nx COLOR_NODE** con posiciones fisicas consecutivas. El Motor Agnostico no necesita un subsistema especial; solo necesita:

1. La Forja genera N nodos `COLOR_NODE` con `role: "pixel"` y posiciones progresivas
2. El `ColorSystem` puede aplicar gradientes, mapas de calor, o texturas sobre el array usando las posiciones como coordenada
3. El `LiveFXEngine` puede generar chases y olas que se propagan por posicion

```ts
interface IPixelMapper {
  /**
   * Genera intents de color para un array de pixel nodes.
   * Opera sobre la posicion fisica de cada nodo para crear efectos espaciales.
   */
  generatePixelIntents(
    pixelNodes: NodeView<ColorNodeData>,
    effect: PixelEffect,
    timestamp: number,
    beatPhase: number
  ): NodeIntent[]
}

type PixelEffect =
  | { type: 'gradient'; colors: HSLColor[]; angle: number }
  | { type: 'chase'; color: HSLColor; width: number; speed: number }
  | { type: 'heatmap'; source: 'bass' | 'mid' | 'high' | 'energy'; colorMap: HSLColor[] }
  | { type: 'texture'; imageData: Uint8Array; width: number; height: number }
```

### 6.4 Hook: Chronos Timeline Bridge

El Chronos `TimelineEngine` ya produce `FixtureLightingTarget[]`. El bridge traduce estos a `NodeIntent[]` para inyectarlos como capa LP en el NodeArbiter:

```ts
interface IChronosNodeBridge {
  /**
   * Convierte playback frames de Chronos a NodeIntents.
   * Respeta el blendMode (HTP/LTP/ADD) definido en la timeline.
   */
  convertPlaybackFrame(
    chronosTargets: FixtureLightingTarget[],
    nodeGraph: INodeGraph,
    blendMode: 'htp' | 'ltp' | 'add'
  ): NodeIntent[]
}
```

---

## 7) Estructura de carpetas

```
src/core/agnostic/
+-- index.ts                              # Public API + composition root
+-- types.ts                              # NodeId, DeviceId, NodeFamily, NodeRole, etc.
|
+-- graph/
|   +-- NodeGraph.ts                      # SlotMap central - registro de nodos
|   +-- NodeView.ts                       # Vista tipada sobre subset del graph
|   +-- DeviceRegistry.ts                 # Registro de DeviceDefinitions
|   +-- types.ts                          # NodeData, ColorNodeData, ImpactNodeData, etc.
|
+-- systems/
|   +-- ColorSystem.ts                    # Asignacion de paleta -> COLOR_NODEs
|   +-- ImpactSystem.ts                   # Bandas de audio -> IMPACT_NODEs
|   +-- KineticSystem.ts                  # VMM/physics -> KINETIC_NODEs
|   +-- BeamSystem.ts                     # Optics/gobos -> BEAM_NODEs
|   +-- AtmosphereSystem.ts              # Cues -> ATMOSPHERE_NODEs
|   +-- types.ts                          # IColorSystem, IImpactSystem, etc.
|
+-- arbiter/
|   +-- NodeArbiter.ts                    # Merge multicapa sobre nodos
|   +-- IntentBus.ts                      # Buffer pre-allocated de NodeIntents
|   +-- types.ts                          # NodeIntent, AggregatedNodeIntentMap, etc.
|
+-- resolver/
|   +-- NodeResolver.ts                   # ArbitratedNodeMap -> DMXPacket[]
|   +-- TransferCurves.ts                 # Funciones puras de curva (exp, log, scurve)
|   +-- ChannelMapper.ts                  # 0-1 -> 0-255 con 16-bit splitting
|   +-- CalibrationApplier.ts            # Pan/tilt offsets, inverts, limits
|
+-- bridge/
|   +-- BridgeAdapter.ts                  # V1 <-> V2 translation layer
|   +-- LegacyFixtureConverter.ts        # PatchedFixture -> DeviceDefinition
|   +-- IntentConverter.ts               # LightingIntent -> NodeIntent[]
|
+-- hooks/
|   +-- SeleneNodeBridge.ts              # Selene IA -> NodeIntent[]
|   +-- LiveFXEngine.ts                  # FX Editor -> NodeIntent[]
|   +-- PixelMapper.ts                   # Pixel arrays -> NodeIntent[]
|   +-- ChronosNodeBridge.ts            # Timeline playback -> NodeIntent[]
|
+-- forge/
|   +-- NodeFactory.ts                    # DeviceDefinition -> CapabilityNodeDef[]
|   +-- AutoNodeDetector.ts              # Channels[] -> auto-generate nodes
|   +-- SubEmitterTemplates.ts           # Plantillas: Fan, Bar, Panel, etc.
|
+-- config/
|   +-- BandMixPresets.ts                # Presets de mezcla por Vibe
|   +-- TransferCurvePresets.ts          # Presets de curvas por tipo
|   +-- DefaultConstraints.ts            # Constraints default por familia
|
+-- __tests__/
    +-- NodeGraph.test.ts
    +-- ImpactSystem.test.ts
    +-- ColorSystem.test.ts
    +-- NodeArbiter.test.ts
    +-- NodeResolver.test.ts
    +-- TransferCurves.test.ts
    +-- BridgeAdapter.test.ts
```

---

## 8) Integracion con el pipeline existente

### 8.1 Punto de insercion

Referenciado desde `CORE-MODULAR-MAP.md` seccion 3.1, el Motor Agnostico se inserta **entre** `engine.update()` y `masterArbiter.setTitanIntent()`:

```
FrameScheduler tick (23ms)
  +-- TitanOrchestrator.processFrame()
       |
       +-- 1-5. (igual que hoy: context, smoothing, metrics)
       |
       +-- 6. engine.update(context, metrics) -> LightingIntent
       |
       +-- 7. [NEW] agnosticEngine.processFrame(context, metrics, intent)
       |      |
       |      +-- bridgeAdapter.lightingIntentToNodeIntents(intent)  -> L0 base
       |      +-- colorSystem.process(colorView, palette, ...)       -> L0 override
       |      +-- impactSystem.process(impactView, audio, ...)       -> L0 override
       |      +-- kineticSystem.process(kineticView, audio, ...)     -> L0 override
       |      +-- beamSystem.process(beamView, ...)                  -> L0 override
       |      +-- seleneNodeBridge.evaluate(...)                     -> L1
       |      +-- liveFXEngine.evaluate(...)                         -> L3
       |      +-- chronosNodeBridge.evaluate(...)                    -> LP
       |      |
       |      +-- nodeArbiter.arbitrate() -> ArbitratedNodeMap
       |      |
       |      +-- bridgeAdapter.arbitratedToFinalTarget(arbitrated)
       |         -> FinalLightingTarget (compatible con pipeline existente)
       |
       +-- 8.  masterArbiter.setTitanIntent(titanLayer)  [unchanged]
       |       (ahora recibe el FinalLightingTarget del bridge)
       |
       +-- 9-14. (igual que hoy: arbiter, HAL, broadcast, flush)
```

### 8.2 Migracion incremental (3 fases)

**Fase 1: Coexistencia pasiva**
- El `AgnosticEngine` recibe el `LightingIntent` de TitanEngine y lo traduce a `NodeIntent[]` via `BridgeAdapter`.
- El pipeline existente sigue intacto. El `AgnosticEngine` es un observador que produce telemetria pero no altera la salida.
- Objetivo: validar que la traduccion es fiel (paridad bit-a-bit).

**Fase 2: Systems activos**
- Los 5 Systems empiezan a producir sus propios `NodeIntent[]` en paralelo al bridge.
- El `NodeArbiter` mezcla bridge intents (L0 legacy) con system intents (L0 native).
- Un flag `useNativeSystems: boolean` per-system permite activar uno a la vez:
  1. Primero `ImpactSystem` (reemplaza `calculateZoneIntents`)
  2. Luego `ColorSystem` (reemplaza palette routing del FixtureMapper)
  3. Luego `KineticSystem` (reemplaza `calculateMovement`)
  4. Finalmente `BeamSystem` y `AtmosphereSystem`

**Fase 3: Retirada del legacy**
- Todos los Systems activos. El `BridgeAdapter` deja de traducir `LightingIntent`.
- `TitanEngine.update()` se simplifica: solo produce `MusicalContext` enriquecido + palette (sin zones, sin movement).
- El `ArbitrationDirector` existente recibe `FinalLightingTarget` del bridge V2->V1, o se reemplaza por `NodeArbiter` + `NodeResolver` directamente.
- `FixtureMapper` retirado. `NodeResolver` es el nuevo ultimo paso antes de DMX.

### 8.3 Compatibilidad con La Forja

La Forja (editor de fixtures) necesita producir `DeviceDefinition[]` en lugar de (o ademas de) `FixtureDefinition[]`. Dos caminos:

**AutoNodeDetector** — dado un `FixtureDefinition` existente (con `channels[]` y `capabilities`), genera automaticamente los nodos. Funciona para el 90% de fixtures estandar.

**Manual Node Assignment** — para fixtures complejos (Fan de Tungsteno, barras LED), el usuario arrastra canales a nodos en un editor visual. La Forja almacena la asignacion como parte del `.fxt` JSON.

```ts
interface IAutoNodeDetector {
  /**
   * Genera DeviceDefinition a partir de un FixtureDefinition legacy.
   *
   * Heuristicas:
   * - Channels RGB/RGBW/CMY -> 1x COLOR_NODE
   * - Channel color_wheel -> 1x COLOR_NODE (tipo wheel)
   * - Channel dimmer -> 1x IMPACT_NODE (role: primary)
   * - Channel shutter/strobe -> incluido en IMPACT_NODE
   * - Channels pan/tilt -> 1x KINETIC_NODE
   * - Channels zoom/focus/gobo/prism -> 1x BEAM_NODE
   * - Channels custom/rotation -> 1x ATMOSPHERE_NODE o IMPACT_NODE segun tipo
   *
   * Para multiples dimmers (fan petals): requiere hint del usuario
   * o deteccion por nombre de canal ("petal-1", "petal-2", etc.)
   */
  detect(fixture: FixtureDefinition): DeviceDefinition
}
```

---

## 9) Escalabilidad: del dimmer a la pantalla LED masiva

### 9.1 Dimmer generico (1 canal DMX)

```
DeviceDefinition: "generic-dimmer"
+-- channelCount: 1
+-- nodes[0]: IMPACT_NODE "dimmer"  role: "primary"
    +-- channels: [{ type: "dimmer", dmxOffset: 0 }]
    +-- constraints: { responseType: "digital", transferCurve: "linear" }
```

Total nodos: 1. El `ImpactSystem` lo ve como un nodo mas y le asigna intensidad basada en audio.

### 9.2 Moving Head LED Wash (16 canales DMX)

```
DeviceDefinition: "wash-led-36x10w"
+-- channelCount: 16
+-- nodes[0]: COLOR_NODE "color"  role: "primary"
|   +-- channels: [
|       { type: "red", dmxOffset: 4 },
|       { type: "green", dmxOffset: 5 },
|       { type: "blue", dmxOffset: 6 },
|       { type: "white", dmxOffset: 7 }
|   ]
|   +-- constraints: { mixingType: "rgbw", responseType: "digital" }
|
+-- nodes[1]: IMPACT_NODE "intensity"  role: "primary"
|   +-- channels: [
|       { type: "dimmer", dmxOffset: 0 },
|       { type: "shutter", dmxOffset: 1 }
|   ]
|
+-- nodes[2]: KINETIC_NODE "movement"  role: "primary"
|   +-- channels: [
|       { type: "pan", dmxOffset: 8 },
|       { type: "pan_fine", dmxOffset: 9 },
|       { type: "tilt", dmxOffset: 10 },
|       { type: "tilt_fine", dmxOffset: 11 },
|       { type: "speed", dmxOffset: 12 }
|   ]
|   +-- constraints: { maxPanSpeed: 540, maxTiltSpeed: 270, motorType: "servo" }
|
+-- nodes[3]: BEAM_NODE "optics"  role: "decoration"
    +-- channels: [
        { type: "zoom", dmxOffset: 13 },
        { type: "focus", dmxOffset: 14 }
    ]
```

Total nodos: 4. Cada System procesa solo el nodo relevante a su dominio. El `KineticSystem` no sabe que hay un color node; el `ColorSystem` no sabe que hay movimiento.

### 9.3 Barra LED 12 pixeles (36+ canales DMX)

```
DeviceDefinition: "led-bar-12px"
+-- channelCount: 36
+-- nodes[0..11]: COLOR_NODE "pixel-N"  role: "pixel"  (x12)
    +-- channels: [
        { type: "red", dmxOffset: N*3 },
        { type: "green", dmxOffset: N*3+1 },
        { type: "blue", dmxOffset: N*3+2 }
    ]
    +-- position: { x: -0.5 + (N/11), y: 0, z: 0 }
```

Total nodos: 12. El `ColorSystem` + `PixelMapper` genera gradientes que se propagan por la posicion `x` de cada nodo. Cada pixel reacciona a una fase distinta de la ola.

### 9.4 Pantalla LED masiva (50x30 = 1500 pixeles)

```
DeviceDefinition: "led-screen-50x30"
+-- channelCount: 4500  (1500 * 3)
+-- nodes[0..1499]: COLOR_NODE "px-X-Y"  role: "pixel"  (x1500)
    +-- channels: [{ type: "red/green/blue", dmxOffset: calculated }]
    +-- position: { x: col/49, y: row/29, z: 0 }
```

Total nodos: 1500. El `PixelMapper` puede aplicar texturas, heatmaps, o efectos 2D sobre toda la grilla. El `ImpactSystem` NO itera estos nodos (no son IMPACT_NODE).

**Performance a 1500 nodos:** con arrays densos y zero-alloc, el `ColorSystem` puede iterar 1500 nodos en ~0.3ms (holgura de sobra para 23ms frames). Si no basta, el `PixelMapper` puede usar WebAssembly SIMD para las operaciones de color masivas.

---

## 10) Composicion root y DI

### 10.1 Composition Root del Motor Agnostico

```ts
// src/core/agnostic/index.ts

// -- Graph --
const nodeGraph       = new NodeGraph()
const deviceRegistry  = new DeviceRegistry(nodeGraph)

// -- Systems (puros, sin estado externo) --
const colorSystem     = new ColorSystem()
const impactSystem    = new ImpactSystem()
const kineticSystem   = new KineticSystem()
const beamSystem      = new BeamSystem()
const atmosSystem     = new AtmosphereSystem()

// -- Arbiter --
const intentBus       = new IntentBus(2048)  // pre-alloc 2048 slots
const nodeArbiter     = new NodeArbiter(nodeGraph, intentBus)

// -- Resolver --
const transferCurves  = new TransferCurveRegistry()
const channelMapper   = new ChannelMapper(transferCurves)
const calibration     = new CalibrationApplier()
const nodeResolver    = new NodeResolver(nodeGraph, channelMapper, calibration)

// -- Hooks --
const seleneNodeBridge  = new SeleneNodeBridge(nodeGraph)
const liveFXEngine      = new LiveFXEngine(nodeGraph)
const pixelMapper       = new PixelMapper()
const chronosNodeBridge = new ChronosNodeBridge(nodeGraph)

// -- Bridge (backward compat) --
const bridgeAdapter   = new BridgeAdapter(nodeGraph)

// -- Coordinator --
export const agnosticEngine = new AgnosticEnginePipeline({
  nodeGraph,
  systems: { colorSystem, impactSystem, kineticSystem, beamSystem, atmosSystem },
  arbiter: nodeArbiter,
  resolver: nodeResolver,
  bus: intentBus,
  hooks: { seleneNodeBridge, liveFXEngine, pixelMapper, chronosNodeBridge },
  bridge: bridgeAdapter,
})
```

### 10.2 Reglas de DI

1. **Prohibido** importar `agnosticEngine` o `nodeGraph` como singleton fuera del composition root. Solo inyeccion por constructor.
2. Los 5 **Systems son puros** — no reciben colaboradores con estado en el constructor. Toda dependencia entra como parametro de `process()`.
3. El **IntentBus** es la unica estructura mutable compartida entre Systems y Arbiter. Se resetea al inicio de cada frame.
4. El **NodeGraph** es inmutable durante el frame (solo cambia en patch events, nunca mid-frame).
5. El **NodeResolver** NO conoce la existencia de TitanEngine, Selene, ni el Arbiter legacy. Solo ve nodos y valores.

---

## 11) Metricas de exito del blueprint

- **NodeGraph** soporta hasta 2000 nodos activos sin superar 2ms por frame
- **IntentBus** con 0 allocations medido via `--trace-gc` en 60s de audio real
- **BridgeAdapter** produce paridad bit-a-bit con el pipeline V1 en Fase 1
- **ImpactSystem** reemplaza `ZoneRouter + calculateZoneIntents()` con curvas exponenciales perceptibles como mejora subjetiva
- **ColorSystem** soporta wheel/RGB/CMY/RGBW sin bifurcacion en el motor
- **NodeResolver** produce DMXPackets identicos a `FixtureMapper.statesToDMXPackets()` para fixtures legacy
- **Sub-emitters** del Fan de Tungsteno funcionan sin codigo custom
- **Pixel arrays** de hasta 1500 nodos corren dentro del budget de frame (23ms)
- 0 imports de singletons fuera del composition root

---

## 12) Lo que este blueprint NO hace (fuera de alcance)

- No implementa logica interna de los Systems (eso es WAVE 3506+).
- No modifica `TitanEngine`, `SensesPipeline`, `ArbitrationDirector` ni `HardwareAbstraction` existentes.
- No cambia el formato de `FixtureDefinition` en La Forja (el `AutoNodeDetector` consume el formato actual).
- No introduce nuevos protocolos de comunicacion (IPC, Worker, etc.).
- No optimiza el rendering de pixeles con WASM (eso es una mejora posterior si el JS puro no basta).
- No define la UI del editor de nodos en La Forja (eso es UX, no arquitectura de motor).

---

*Documento de diseno arquitectonico. WAVE 3505 / Abril 2026.*
*Listo para revision de Direccion de Arquitectura antes de pasar a implementacion.*
