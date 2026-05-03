# 🔒 WAVE 3510 — THE ADUANA AUDIT & BLUEPRINT

> **Documento**: Auditoria HAL-Aether Matrix + Blueprint de integracion segura
> **Version**: 3510.1.0
> **Estado**: AUDITORIA COMPLETA — Listo para implementacion
> **Prerrequisito**: WAVE 3505.4 (Aether Matrix), WAVE 3509.1 (GodEar 7-Band)

---

## 0. MANIFIESTO DE LA ADUANA

La Aduana es el **ultimo gate fisico** antes del cable DMX.
WAVE 3510 audita como el pipeline legacy protege ruedas de color, motores pan/tilt
y ojos del publico — y disena el puente seguro para que Aether Matrix no la salte.

### Principios Inquebrantables

| # | Principio | Riesgo si se viola |
|---|-----------|-------------------|
| 1 | **Hardware Safety First** | Rueda de color destruida, burnout LEDs, perdida de pasos |
| 2 | **Zero-Allocation Hot Path** | GC pauses -> frame drops -> jitter |
| 3 | **Single Source of Truth** | Dos pipelines en mismo universo = corrupcion DMX |
| 4 | **Manual Override Always Wins** | Operador debe poder apagar cualquier cosa |
| 5 | **La Aduana es Inmutable** | Gate ARMED/LIVE aplica a TODO output fisico |

---

## 1. AUDITORIA DEL FLUJO HAL (LEGACY)

### 1.1 Pipeline Completo

```
UI/MIDI/OSC -> MasterArbiter (L0-L4) -> FinalLightingTarget
                                              |
                                              v
                    HAL.renderFromTarget(arbitratedTarget, fixtures, audio)
                                              |
    +-----------------------------------------+-------------------------------------+
    |                                         |                                     |
    |  MAP: FixtureTarget -> FixtureState     |                                     |
    |  +-- propaga _controlSources            |                                     |
    |  +-- propaga phantomChannels            |                                     |
    |                                         |                                     |
    |  BABEL FISH: translateColorToWheel()    |                                     |
    |  +-- ColorTranslator: RGB -> slot DMX   |                                     |
    |  +-- HarmonicQuantizer.quantize()        |                                     |
    |  +-- HardwareSafetyLayer.filter()        |                                     |
    |  +-- DarkSpinFilter.filter()             |                                     |
    |                                         |                                     |
    |  PHYSICS: FixturePhysicsDriver           |                                     |
    |  +-- inercia, aceleracion, deltaTime     |                                     |
    |                                         |                                     |
    |  CALIBRATION: offsets, invert, tiltLimits|                                     |
    |                                         |                                     |
    |  DYNAMIC OPTICS: zoom/focus con beat      |                                     |
    |                                         |                                     |
    |  HAL.flushToDriver(fixtureStates)        |                                     |
    |  +-- statesToDMXPackets()                |                                     |
    |  +-- ADUANA INMUTABLE (WAVE 3160)        |                                     |
    |  |   Si !outputEnabled:                   |                                     |
    |  |   * MANUAL -> pass-through            |                                     |
    |  |   * AUTO -> safe values               |                                     |
    |  +-- driver.send() -> hardware           |                                     |
    +-----------------------------------------+-------------------------------------+
```

### 1.2 Puntos Criticos de Seguridad

| Etapa | Modulo | Funcion de Seguridad |
|-------|--------|---------------------|
| Color | HarmonicQuantizer | Gatea cambios a intervalos BPM-harmonicos |
| Color | DarkSpinFilter | Blackout dimmer=0 durante transito de rueda |
| Color | ColorTranslator | RGB -> slot DMX de rueda fisica |
| Movimiento | FixturePhysicsDriver | Interpola pan/tilt con inertia/acceleration |
| Calibracion | applyCalibrationOffsets | Invierte ejes, limita tilt |
| Output | Aduana Inmutable (WAVE 3160) | Zera bytes DMX si outputEnabled=false |

---

## 2. AUDITORIA DEL PIPELINE AETHER (WAVE 3505.4)

### 2.1 Flujo Actual

```
TitanOrchestrator.processFrame()
|
+- Legacy pipeline (masterArbiter -> HAL.renderFromTarget -> flushToDriver)
|
+- Aether block (lineas 1423-1453):
   1. _aetherBus.clear()              <- Bus VACIO
   2. _aetherArbiter.arbitrate()     <- ArbitratedNodeMap con defaults
   3. _aetherResolver.resolve()       <- Uint8Array(512) por universo
   4. HAL.sendUniverseRaw(buf)        <- BYPASS DIRECTO AL DRIVER
```

### 2.2 Vulnerabilidades

#### CRITICA #1 — Bypass total de La Aduana

**Codigo auditado** (`src/hal/HardwareAbstraction.ts:1758-1771`):

```typescript
public sendUniverseRaw(universe: number, data: Uint8Array): boolean {
  if (!this.driver.isConnected) return false
  return this.driver.sendUniverse(universe, data)  // BYPASS TOTAL
}
```

`sendUniverseRaw` **no verifica**:
- `masterArbiter.isOutputEnabled()` (Aduana gate)
- `HarmonicQuantizer.quantize()` (proteccion de rueda)
- `DarkSpinFilter.filter()` (blackout en transito)
- `ColorTranslator.translate()` (RGB -> wheel)
- `FixturePhysicsDriver.translateDMX()` (interpolacion)
- `applyCalibrationOffsets()` (tilt limits, inversion)
- Diferencia MANUAL vs AUTO

**Impacto**: Un System Aether inyectando color a 44 Hz en fixture mecanico
destruye la rueda de color en segundos y expone al publico a luz estroboscopica.

#### CRITICA #2 — Dual-write en mismo universo

**Codigo auditado** (`TitanOrchestrator.ts:1419-1453`):

```typescript
this.hal.flushToDriver(fixtureStates)          // Legacy escribe
// ...
for (const u of this._aetherResolver.registeredUniverses) {
  const buf = this._aetherResolver.getUniverseBuffer(u)
  if (buf) this.hal.sendUniverseRaw(u, buf)   // Aether SOBREESCRIBE
}
```

Si un fixture legacy y un nodo Aether comparten direccion DMX, el resultado
es no-determinista: parpadeo visible para el operador.

#### ALTA #3 — Sin tracking de control source

La Aduana Inmutable (WAVE 3160) requiere `_controlSources` para distinguir
canales MANUAL (Layer 2) de AUTO (Layer 0). Aether no produce este metadato.
Un operador moviendo un fader manual sera sobrescrito por Aether.

#### ALTA #4 — Sin physics en movers

`NodeResolver._writeNode()` escribe DMX directo:

```typescript
buf[bufIdx] = dmxValue  // Sin interpolacion, sin inertia
```

Cambio de pan 0->255 en un frame = velocidad maxima instantanea.
En legacy, `FixturePhysicsDriver.translateDMX()` interpola suavemente.

#### ALTA #5 — Sin color wheel translation

Aether Systems producen `red/green/blue`. Un fixture mecanico con rueda de color
no tiene canales RGB — tiene `color_wheel`. NodeResolver escribiria red=255
en una direccion que el fixture interpreta como otro parametro (gobo, prism).

---

## 3. ESTRATEGIA DE COEXISTENCIA UI-AETHER

### 3.1 Opciones Evaluadas

| Opcion | Descripcion | Pros | Contras |
|--------|-------------|------|---------|
| A | Duplicar La Aduana en Aether | Autonomia | Codigo duplicado, divergencia futura |
| B | Aether -> FixtureState[] -> HAL.renderFromTarget() | Reutiliza 100% legacy | Alloca FixtureState[] por frame -> viola zero-allocation |
| **C** | **AduanaFilter**: modulo zero-alloc entre NodeArbiter y NodeResolver | Zero-alloc, unifica seguridad | Diseno cuidadoso de buffers |
| D | Mergear Aether como Layer 0 del MasterArbiter | Pipeline unico | Cambio arquitectonico mayor |

**Seleccion: Opcion C** como paso intermedio. Opcion D como evolucion post-WAVE 3515.

### 3.2 Arquitectura Target

```
Systems -> NodeArbiter -> AduanaFilter -> NodeResolver -> HAL -> driver
                         (NUEVO)         (existe)      (unico)

AduanaFilter aplica:
- BabelFish: RGB -> color_wheel DMX (fixtures mecanicos)
- HarmonicQuantizer: gatea cambios de color al BPM
- DarkSpinFilter: blackout dimmer=0 en transito de rueda
- FixturePhysicsDriver: interpola pan/tilt con inertia
- Calibration: invert/offset/tiltLimits
- ControlSourceTagger: marca cada canal con su capa origen
- Output Gate: Aduana Inmutable si outputEnabled=false
```

---

## 4. DISENO DE ADUANAFILTER

### 4.1 Interfaz

```typescript
export interface IAduanaFilter {
  /**
   * Ejecuta la cadena de seguridad sobre un ArbitratedNodeMap.
   * ZERO-ALLOC: muta Records pre-allocated in-place.
   */
  filter(
    arbitrated: ArbitratedNodeMap,
    graph: INodeGraph,
    audio: AudioMetrics,
  ): ArbitratedNodeMap

  reset(): void
}
```

### 4.2 Pipeline Interno por Nodo

```
Por cada [nodeId, channelValues] en arbitrated:
|
+- 1. OBTENER METADATOS
|   +- device = graph.getDevice(node.deviceId)
|   +- nodeData = graph.getNodeData(nodeId)
|   +- profile = deriveProfileFromNodeData(nodeData)
|   +- calibration = device.calibration
|
+- 2. BABEL FISH (solo si mecanico con color_wheel)
|   +- Si tiene {red, green, blue}:
|   |   +- colorTranslator.translate({r,g,b}, profile) -> slot DMX
|   |   +- Eliminar red/green/blue
|   |   +- Anadir color_wheel = slotDmx / 255
|   +- Si no: pass-through
|
+- 3. HARMONIC QUANTIZER (solo si color_wheel presente)
|   +- quantizer.quantize(fixtureId, targetRGB, BPM, confidence, minChangeTime)
|   +- Si !colorAllowed: preservar ultimo color permitido
|
+- 4. DARK SPIN FILTER (solo si color_wheel presente)
|   +- darkSpin.filter(fixtureId, colorWheelDmx, profile, requestedDimmer)
|   +- Si inTransit: channelValues['dimmer'] = 0
|
+- 5. MOVEMENT PHYSICS (solo si pan/tilt presentes)
|   +- physics.translateDMX(fixtureId, targetPan, targetTilt, dt, isManual)
|   +- Escribir physicalPan/physicalTilt en el nodo
|
+- 6. CALIBRATION OFFSETS (solo si pan/tilt presentes)
|   +- invertPan/tilt segun calibration
|   +- aplicar offsets (grados -> normalizado)
|   +- clamp tiltLimits (seguridad fisica)
|
+- 7. CONTROL SOURCE TAGGING
|   +- Anadir _controlSources: { dimmer: 2, color_wheel: 0, pan: 0, ... }
|   +- 2 = MANUAL, 0 = TITAN_AI, 3 = EFFECTS
|
+- 8. OUTPUT GATE (Aduana Inmutable)
|   +- Si outputEnabled=false:
|   |   +- MANUAL -> preservar valor
|   |   +- AUTO -> safe value
```

### 4.3 Zero-Allocation Contract

```typescript
class AduanaFilter {
  private readonly _workBuffer = new Map<NodeId, Record<string, number>>()
  private readonly _recordPool: Record<string, number>[] = []
  private readonly _physicsState = new Map<NodeId, PhysicsState>()
  private readonly _quantizer = getHarmonicQuantizer()
  private readonly _darkSpin = getDarkSpinFilter()
  private readonly _physics = new FixturePhysicsDriver()

  filter(arbitrated: ArbitratedNodeMap, graph: INodeGraph, audio: AudioMetrics): ArbitratedNodeMap {
    this._workBuffer.clear()  // zero alloc

    for (const [nodeId, channels] of arbitrated) {
      const record = this._acquireRecord()  // del pool
      // ... aplicar filtros, mutar record ...
      this._workBuffer.set(nodeId, record)
    }

    return this._workBuffer as ArbitratedNodeMap  // mismo Map, no nuevo
  }
}
```

---

## 5. INTEGRACION EN TITAN ORCHESTRATOR

### 5.1 Cambio en processFrame()

**ANTES** (WAVE 3505.4 — vulnerable):

```typescript
// Aether block (lineas 1423-1453)
if (this._aetherHasDevices && this.hal) {
  this._aetherBus.clear()
  this._aetherArbiter.setSystemIntents(this._aetherBus)
  const arbitrated = this._aetherArbiter.arbitrate()
  this._aetherResolver.resolve(arbitrated)
  for (const u of this._aetherResolver.registeredUniverses) {
    const buf = this._aetherResolver.getUniverseBuffer(u)
    if (buf) this.hal.sendUniverseRaw(u, buf)  // BYPASS!
  }
}
```

**DESPUES** (WAVE 3510 — seguro):

```typescript
// Aether block seguro
if (this._aetherHasDevices && this.hal) {
  this._aetherBus.clear()
  // (Systems escriben aqui)
  this._aetherArbiter.setSystemIntents(this._aetherBus)
  const arbitrated = this._aetherArbiter.arbitrate()

  // ADUANA FILTER: aplica seguridad antes del resolver
  const filtered = this._aduanaFilter.filter(
    arbitrated,
    this._aetherGraph,
    halAudioMetrics  // con BPM para Quantizer
  )

  this._aetherResolver.resolve(filtered)

  // El output Aether pasa por HAL.flushToDriver() junto al legacy
  // NO usar sendUniverseRaw — unifica gate en un solo lugar
}
```

### 5.2 Unificacion del Output Gate

La Aduana Inmutable (WAVE 3160) actual opera sobre `DMXPacket[]` (bytes).
Para Aether, necesitamos que el gate opere sobre `ArbitratedNodeMap` (valores
normalizados) ANTES de que NodeResolver escale a bytes.

**Opcion recomendada**: Extender `AduanaFilter.filter()` paso 8 para que aplique
el gate directamente sobre los valores normalizados:

- `dimmer`, `red`, `green`, `blue`, `color_wheel`, `gobo`, `prism` -> `0`
- `pan`, `tilt`, `zoom`, `focus` -> `0.5` (centro)
- Canales MANUAL (_controlSources[ch] === 2) -> preservar valor original

Esto evita crear DMXPackets intermedios y mantiene zero-allocation.

### 5.3 Mapeo Legacy -> Aether para UI Manual Overrides

Actualmente, la UI envia manual overrides al `MasterArbiter` (Layer 2),
que luego fluye a HAL.renderFromTarget(). Para que Aether respete estos
overrides, necesitamos un bridge:

```typescript
// En TitanOrchestrator.init() o en un handler IPC:
masterArbiter.on('manualOverride', (fixtureId, channels) => {
  // Convertir fixtureId legacy -> nodeId Aether (si esta mapeado)
  const nodeIds = this._aetherNodeMap.get(fixtureId)
  if (!nodeIds) return  // Este fixture no esta en Aether todavia

  for (const nodeId of nodeIds) {
    this._aetherArbiter.setManualOverride(nodeId, channelValues)
  }
})
```

**Nota**: `NodeArbiter` ya implementa `setManualOverride()` (WAVE 3505.4).
Solo falta el bridge desde los eventos del MasterArbiter.

---

## 6. PLAN DE ACCION POR PASOS

### Paso 1: Crear interfaz IAduanaFilter
- **Archivo**: `src/core/aether/safety/IAduanaFilter.ts`
- **Entregable**: Interfaz + tipos auxiliares (ControlSourceMap, SafeValueMap)
- **Dependencias**: Ninguna (solo tipos existentes)
- **Riesgo**: Bajo

### Paso 2: Implementar AduanaFilter (core)
- **Archivo**: `src/core/aether/safety/AduanaFilter.ts`
- **Entregable**: Clase con pasos 1-8 del pipeline (sin BabelFish todavia)
- **Dependencias**: HarmonicQuantizer, DarkSpinFilter (singletons existentes)
- **Riesgo**: Medio — requiere derivar FixtureProfile desde NodeGraph data

### Paso 3: Integrar BabelFish en AduanaFilter
- **Archivo**: `src/core/aether/safety/AduanaFilter.ts` (modificar)
- **Entregable**: Traduccion RGB -> color_wheel para nodos mecanicos
- **Dependencias**: ColorTranslator, generateProfileFromDefinition
- **Riesgo**: Medio — requiere mapear IDeviceDefinition -> FixtureProfile

### Paso 4: Integrar FixturePhysicsDriver en AduanaFilter
- **Archivo**: `src/core/aether/safety/AduanaFilter.ts` (modificar)
- **Entregable**: Interpolacion pan/tilt con inertia
- **Dependencias**: FixturePhysicsDriver (ya existe en HAL)
- **Riesgo**: Medio — requiere instanciar driver con profiles Aether

### Paso 5: Integrar AduanaFilter en TitanOrchestrator
- **Archivo**: `src/core/orchestrator/TitanOrchestrator.ts`
- **Entregable**: Reemplazar bloque Aether vulnerable (lineas 1423-1453)
- **Dependencias**: Pasos 1-4 completos
- **Riesgo**: Alto — punto de integracion critico

### Paso 6: Crear bridge Manual Override Legacy -> Aether
- **Archivo**: `src/core/orchestrator/TitanOrchestrator.ts` (handler IPC)
- **Entregable**: Evento manualOverride de MasterArbiter -> NodeArbiter
- **Dependencias**: Mapa fixtureId -> nodeId[] (requiere registro en patch time)
- **Riesgo**: Medio — sincronizacion de estado entre dos arbitros

### Paso 7: Unificar Output Gate (Aduana Inmutable)
- **Archivo**: `src/core/aether/safety/AduanaFilter.ts` + `src/hal/HardwareAbstraction.ts`
- **Entregable**: Gate unico que opera sobre bytes legacy Y valores normalizados Aether
- **Dependencias**: Pasos 5-6
- **Riesgo**: Medio — debe preservar semantica WAVE 3160

### Paso 8: Tests de regresion y safety
- **Archivo**: `src/core/aether/safety/__tests__/AduanaFilter.test.ts`
- **Entregable**: Tests para cada capa de seguridad
- **Dependencias**: Pasos 1-7
- **Riesgo**: Bajo

---

## 7. DATA FLOW MAP FINAL (Post-WAVE 3510)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         TITAN ORCHESTRATOR                                │
│                                                                          │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                   │
│   │   Brain     │    │   Engine    │    │  BeatDet    │                   │
│   │  (context)  │ -> │  (intent)   │    │  (PLL/BPM)  │                   │
│   └─────────────┘    └──────┬──────┘    └─────────────┘                   │
│                             │                                            │
│                             v                                            │
│   ┌───────────────────────────────────────────────────────────────┐    │
│   │  MASTER ARBITER (ArbitrationDirector) — Layers L0-L4         │    │
│   │  L0: Titan intent  |  L2: Manual (UI/MIDI)                  │    │
│   │  L3: Effects       |  L4: Blackout                           │    │
│   │  -> FinalLightingTarget (fixtureStates)                      │    │
│   └───────────────────────────────────────────────────────────────┘    │
│                             │                                            │
│                             v                                            │
│   ┌───────────────────────────────────────────────────────────────┐    │
│   │  HAL.renderFromTarget() — Pipeline Legacy                     │    │
│   │  -> BabelFish -> Quantizer -> DarkSpin -> Physics -> Calib   │    │
│   │  -> flushToDriver() -> Aduana Inmutable -> DMX driver        │    │
│   └───────────────────────────────────────────────────────────────┘    │
│                                                                          │
│   ┌───────────────────────────────────────────────────────────────┐    │
│   │  AETHER MATRIX — Pipeline V2                                    │    │
│   │                                                                 │    │
│   │  Systems -> IntentBus -> NodeArbiter -> AduanaFilter          │    │
│   │                                           (NUEVO WAVE 3510)    │    │
│   │  -> BabelFish -> Quantizer -> DarkSpin -> Physics -> Calib    │    │
│   │  -> NodeResolver -> Aduana Gate -> HAL.flushToDriver()        │    │
│   │  (NO sendUniverseRaw — unificado con legacy)                  │    │
│   └───────────────────────────────────────────────────────────────┘    │
│                                                                          │
│   ┌───────────────────────────────────────────────────────────────┐    │
│   │  ADUANA INMUTABLE — UNICO GATE (WAVE 3160)                    │    │
│   │  Operando sobre:                                              │    │
│   │  * DMXPacket[] (pipeline legacy)                              │    │
│   │  * ArbitratedNodeMap (pipeline Aether, paso 8 de Filter)    │    │
│   │                                                                 │    │
│   │  Si !outputEnabled (ARMED):                                    │    │
│   │  * MANUAL channels -> pass-through                            │    │
│   │  * AUTO channels -> safe values (0 o center)                    │    │
│   └───────────────────────────────────────────────────────────────┘    │
│                             │                                            │
│                             v                                            │
│                      DMX DRIVER (USB/ArtNet)                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 8. DECISIONES ARQUITECTONICAS CLAVE

### 8.1 Por que no Opcion D (Mergear Aether en MasterArbiter)

Aunque Option D (pipeline unico) es el ideal a largo plazo, requiere:
- Reescribir `FinalLightingTarget` para incluir nodos Aether
- Reescribir `HAL.renderFromTarget()` para consumir nodos Aether
- Cambiar contratos IPC del frontend que dependen de FixtureState[]

Esto es un **refactor masivo** que romperia estabilidad de WAVE 3504-3505.
Opcion C (AduanaFilter) permite que Aether evolucione en paralelo sin tocar
el pipeline legacy hasta que la migracion de fixtures sea completa.

### 8.2 Por que NodeResolver ya no habla directo al driver

`HAL.sendUniverseRaw()` debe ser **deprecado** y eventualmente eliminado.
El output de Aether debe fluir a traves de `HAL.flushToDriver()` que ya
implementa la Aduana Inmutable (WAVE 3160) sobre bytes DMX.

**Transicion sugerida**:
1. WAVE 3510: Deprecar `sendUniverseRaw`, redirigir Aether -> AduanaFilter -> NodeResolver -> HAL.flushToDriver
2. WAVE 3515: Eliminar `sendUniverseRaw` cuando 100% de fixtures migrados a Aether

### 8.3 Manual Override Bridge: arbitro dual vs. arbitro unificado

Actualmente hay DOS arbitros:
- `MasterArbiter` (ArbitrationDirector) para pipeline legacy
- `NodeArbiter` para pipeline Aether

El bridge de manual overrides (`MasterArbiter.on('manualOverride') -> NodeArbiter.setManualOverride()`)
es una solucion temporal. A largo plazo (Opcion D), el manual override debe ir
a un unico arbitro que arbitraria tanto fixtures legacy como nodos Aether.

---

## 9. GLOSARIO

| Termino | Definicion |
|---------|-----------|
| **La Aduana** | Conjunto de gates de seguridad HAL que protegen hardware: Quantizer, DarkSpin, Physics, Calibration, Output Gate |
| **AduanaFilter** | Modulo teorico propuesto en WAVE 3510 que aplica La Aduana sobre ArbitratedNodeMap antes de NodeResolver |
| **Aduana Inmutable** | WAVE 3160: gate que zera bytes DMX cuando outputEnabled=false, dejando FixtureState[] intacto para UI |
| **BabelFish** | WAVE 2042.20: traductor RGB -> color_wheel DMX para fixtures mecanicos |
| **HarmonicQuantizer** | WAVE 2672: gatea cambios de color a intervalos musicales respetando fisica del hardware |
| **DarkSpinFilter** | WAVE 2690: fuerza dimmer=0 durante transito de rueda de color mecanica |
| **FixturePhysicsDriver** | WAVE 338: interpola pan/tilt con inertia, aceleracion y deltaTime real |
| **NodeArbiter** | WAVE 3505.4: arbitro multicapa zero-alloc para pipeline Aether |
| **NodeResolver** | WAVE 3505.4: traduce ArbitratedNodeMap a Uint8Array(512) por universo |
| **ControlLayer** | Enum: TITAN_AI=0, CONSCIOUSNESS=1, MANUAL=2, EFFECTS=3, BLACKOUT=4 |
| **_controlSources** | Metadata en FixtureState que indica que capa controla cada canal |

---

*Fin del documento WAVE 3510.1.0*
*Blueprint arquitectonico — No implementar sin revision cruzada del equipo*
