# HAL-ADUANA-MAP.md

## Auditoría del Egress Path — WAVE 4553

**Scope:** Ruta de salida completa desde el pipeline Aether/Legacy hasta el hardware DMX físico.  
**Auditoría realizada:** 2026-05-05  
**Objetivo:** Preparar el Blueprint de Integración Final para el test con Fan Tungsten.

---

## 1. RESUMEN EJECUTIVO

El sistema LuxSync tiene **dos pipelines de egress** que coexisten en `TitanOrchestrator.processFrame()`:

| Pipeline | Estrategia de Buffer | Aduana (Output Gate) | Performance |
|---|---|---|---|
| **Aether Native** (NodeResolver → HAL) | `Uint8Array(512)` zero-copy por universo | **NO TIENE** — envía crudo directo | Zero-alloc, zero-copy |
| **Legacy** (HAL.renderFromTarget → FixtureMapper) | `DMXPacket[]` (objetos + `number[]`) por fixture | **SÍ** — gate de `outputEnabled` + `isVirtual` | Objetos por frame, mutable in-place |

### Hallazgo Crítico #1: La Aduana NO existe en Aether

El pipeline Aether (`sendUniverseRaw`) **bypassa completamente** el output gate de la Aduana.  
En el Legacy pipeline, `masterArbiter.isOutputEnabled()` determina si se envían ceros (ARMED) o valores reales (LIVE). En Aether, el `NodeResolver` resuelve y el HAL envía el buffer sin ningún gate equivalente.

**Riesgo:** Si un fixture está registrado en Aether y el operador tiene outputEnabled=false, el fixture seguirá enviando DMX al hardware.

### Hallazgo Crítico #2: Cuello de botella Legacy en `statesToDMXPackets`

El Legacy pipeline genera **N objetos `DMXPacket`** (uno por fixture físico) cada frame, cada uno con un `number[]` de canales. Luego `driver.send(packet)` los dispersa en buffers de universo. Esto es **alloc-heavy** comparado con el Aether pipeline que escribe directo a `Uint8Array(512)`.

### Hallazgo Crítico #3: Hyperion (Programmer) inyecta en el **Arbiter**, no en el HAL

Los overrides manuales del ProgrammerAetherBridge van a `NodeArbiter._manualOverrides` (L2), NO al HAL. Esto es correcto arquitectónicamente — el operador overridea la intención, no los bytes DMX.

---

## 2. EJE 1: LA FRONTERA HAL (Hardware Abstraction Layer)

### 2.1 Contrato del Driver (`IDMXDriver`)

```
Archivo: src/hal/drivers/DMXDriver.interface.ts
Líneas: 79-120
```

```typescript
export interface IDMXDriver {
  connect(): Promise<boolean>
  close(): Promise<void>
  send(packet: DMXPacket): boolean                    // packet = {universe, address, channels: number[]}
  sendUniverse(universe: number, data: Uint8Array): boolean  // data.length === 512
  blackout(): void
  sendAll?(): Promise<boolean>
  isConnected: boolean
}
```

**El punto de salida final** a hardware físico es `IDMXDriver.sendUniverse(universe, data: Uint8Array)`.

### 2.2 Adaptador USB (`USBDMXDriverAdapter`)

```
Archivo: src/hal/drivers/USBDMXDriverAdapter.ts
Líneas: 35-125
```

```typescript
class USBDMXDriverAdapter implements IDMXDriver {
  sendUniverse(universe: number, data: Uint8Array): boolean {
    universalDMX.setUniverse(data, universe)   // ← Buffer interno del Hydra
    return true
  }

  send(packet: DMXPacket): boolean {
    // Legacy path: packet.address es el DMX base del fixture
    universalDMX.setChannels(packet.address, packet.channels, packet.universe)
    return true
  }

  async sendAll(): Promise<boolean> {
    return await universalDMX.sendAll()         // ← Flush físico a serial/UDP
  }
}
```

### 2.3 UniversalDMXDriver — El Motor Físico

```
Archivo: src/hal/drivers/UniversalDMXDriver.ts
Líneas: 92-1083
```

**Buffers internos:**
```typescript
private universeBuffers: Map<number, Buffer>   // Buffer.alloc(513) — [0]=START_CODE, [1..512]=canales
```

**Métodos de entrada:**
```typescript
setChannel(channel, value, universe)     // Escribe 1 byte
setChannels(startChannel, values[], universe)  // Escribe N bytes desde offset
setUniverse(data: Buffer|Uint8Array|number[], universe)  // Reemplaza 512 bytes
```

**Flush físico:**
```typescript
async sendAll(): Promise<boolean> {
  // Semáforo: si isTransmitting, DROP silencioso (WAVE 2211)
  // Paraleliza envío por universo:
  //   - Driver-managed (EnttecPro): port.write(buffer) directo
  //   - Self-managed (OpenDMX Phantom Worker): messagePort.postMessage(buffer)
}
```

**Refresh rate:** 30Hz por defecto (WAVE 1101 Paranoia Protocol). Configurable hasta 44Hz.

### 2.4 Despacho de Protocolos Físicos

| Protocolo | Strategy | Implementación | Thread |
|---|---|---|---|
| **Enttec DMX USB Pro** | `EnttecProStrategy` | SerialPort en main thread, protocolo Label 6 | Main V8 isolate |
| **Open DMX (FTDI/CH340/PL2303/CP210x)** | `OpenDMXStrategy` | Phantom Worker (`worker_threads`) con bit-banging BREAK/MAB | Worker isolate (WAVE 2021.4 V8 aislamiento) |
| **ArtNet/sACN** | `CompositeDMXDriver` | UDP broadcast, recibe como `externalDriver` | Main thread |

**Auto-detección** (`detectStrategy` línea 849):
- Si `friendlyName` incluye "enttec" + "pro" → EnttecProStrategy
- Todo lo demás (FTDI puro, CH340, IMC UD 7S, genérico) → OpenDMXStrategy

---

## 3. EJE 2: LA "ADUANA" AETHER — EGRESS ROUTING

### 3.1 NodeResolver — Ensamblaje de Buffers DMX

```
Archivo: src/core/aether/resolver/NodeResolver.ts
Líneas: 138-312
```

**Pipeline `resolve(arbitrated: ArbitratedNodeMap)`:**

```
resolve()
  │
  ├── 1. Zero-fill todos los Uint8Array(512) registrados
  │   for (const [, buf] of this._universeBuffers) buf.fill(0)
  │
  ├── 2. Para cada [nodeId, channelValues] en arbitrated:
  │     _writeNode(nodeId, channelValues)
  │     // Escribe directamente en buf[baseAddr + offset] = dmxValue
  │
  ├── 3. Ensamblar packets de salida
  │   for (const universe of this._activeUniverses) {
  │     const buf = this._universeBuffers.get(universe)!
  │     const packet = this._getOrCreatePacket(universe)
  │     // COPIA: Uint8Array → number[] del packet (compat IDMXPacket)
  │     for (let i = 0; i < 512; i++) packet.channels[i] = buf[i]
  │   }
  │
  └── 4. return Array.from(this._framePackets.values())
```

**Buffers pre-allocated:**
```typescript
private readonly _universeBuffers = new Map<number, Uint8Array>()   // Uint8Array(512)
private readonly _packetPool: MutableDMXPacket[] = []              // Reutilizables
private readonly _framePackets = new Map<number, MutableDMXPacket>()
```

### 3.2 Ensamblaje en TitanOrchestrator — EGRESS AETHER

```
Archivo: src/core/orchestrator/TitanOrchestrator.ts
Líneas: 1798-1804
```

```typescript
// 4. Resolver → DMX packets
aetherResolver.resolve(arbitrated)

// 5. Enviar al driver DMX directamente (zero-copy)
for (const universe of aetherResolver.registeredUniverses) {
  const rawBuf = aetherResolver.getUniverseBuffer(universe)
  if (rawBuf) this.hal.sendUniverseRaw(universe, rawBuf)
}
```

**`sendUniverseRaw` en HAL:**
```
Archivo: src/hal/HardwareAbstraction.ts
Líneas: 1768-1771
```

```typescript
public sendUniverseRaw(universe: number, data: Uint8Array): boolean {
  if (!this.driver.isConnected) return false
  return this.driver.sendUniverse(universe, data)
}
```

**Ruta zero-copy confirmada:**
```
NodeResolver._universeBuffers (Uint8Array)
  → getUniverseBuffer() retorna REFERENCIA (no copia)
  → HAL.sendUniverseRaw(universe, rawBuf) pasa la misma ref
  → USBDMXDriverAdapter.sendUniverse(universe, data) pasa la misma ref
  → UniversalDMXDriver.setUniverse(data, universe)
      // si data es Uint8Array: copia byte-a-byte a Buffer interno (inevitable, Node.js Buffer ≠ Uint8Array)
```

**Punto de copia:** `UniversalDMXDriver.setUniverse()` (líneas 707-714) copia de `Uint8Array` a `Buffer.alloc(513)`. Esto es **una copia de 512 bytes por universo por frame** — aceptable y necesaria porque `serialport` requiere `Buffer` de Node.js.

### 3.3 Ensamblaje Legacy — EGRESS CON "ADUANA"

```
Archivo: src/hal/HardwareAbstraction.ts
Líneas: 1753-2125 (sendToDriver)
```

```typescript
private sendToDriver(states: FixtureState[]): void {
  // 1. Filtro Virtual (WAVE 3110)
  const physicalStates = states.filter(s => !s.isVirtual)

  // 2. FixtureMapper: FixtureState[] → DMXPacket[]
  const packets = this.mapper.statesToDMXPackets(physicalStates)
  //    Crea N objetos DMXPacket, cada uno con channels: number[]

  // 3. Aduana (outputEnabled gate) — WAVE 3160
  if (!outputEnabled) {
    for (const packet of packets) {
      // Gate por canal: manual pasa, AI → safe values (dimmer=0, pan=128, etc.)
    }
  }

  // 4. Inyectar packets en buffers del driver
  for (const packet of packets) {
    this.driver.send(packet)  // setChannels parcial
  }

  // 5. Flush físico
  this.driver.sendAll()
}
```

**Comparativa de alloc por frame (1 universo, 10 fixtures):**

| Pipeline | Objetos creados | Arrays creados | Bytes copiados |
|---|---|---|---|
| **Aether** | 0 (pools) | 0 (Uint8Array reused) | 512 (Uint8Array → Buffer) |
| **Legacy** | 10 DMXPacket | 10 number[] | ~10×channels + 512 (Buffer) |

### 3.4 Cuello de Botella Legacy: `FixtureMapper.statesToDMXPackets()`

```
Archivo: src/hal/mapping/FixtureMapper.ts
```

Aunque no fue auditado en esta wave, la firma y el uso en `sendToDriver` (línea 1985) indican que:
- Recibe `FixtureState[]` (estado mutable post-physics)
- Para cada fixture, construye `DMXPacket = { universe, address, channels: number[] }`
- Aplica color translation, wheel mapping, calibration offsets, 16-bit split
- Genera un nuevo `number[]` por fixture cada frame

**Recomendación:** Migrar fixtures críticos al pipeline Aether para eliminar este overhead.

---

## 4. EJE 3: EL PUENTE HYPERION (Manual Overrides)

### 4.1 Frontend: ProgrammerStore

```
Archivo: src/stores/programmerStore.ts
Líneas: 1-200
```

**Estado Zustand:**
```typescript
interface ProgrammerState {
  fixtureOverrides: Map<string, ProgrammerOverrides>   // fixtureId → overrides
  dirtyFamilies: Set<ProgrammerFamily>                    // IMPACT, COLOR, KINETIC, BEAM, EXTRAS
  activeFixtureIds: string[]
  displayDimmer: number   // 0-100 (UI)
  displayColor: { r, g, b } // 0-255 (UI)
}
```

**Normalización:** La UI habla en % y 0-255. El store interno guarda **0-1 normalizado**.

### 4.2 Bridge: ProgrammerAetherBridge

```
Archivo: src/bridges/ProgrammerAetherBridge.ts
Líneas: 112-202
```

```typescript
class ProgrammerAetherBridgeClass {
  private _flush(): void {
    const state = useProgrammerStore.getState()
    const { fixtureOverrides, dirtyFamilies, activeFixtureIds } = state

    // 1. Para cada fixture activo + familia dirty:
    //    Construir nodeId = `${fixtureId}:${familyLabel}`
    //    Extraer canales no-null del override
    //    Ej: { dimmer: 0.85, strobe: null, shutter: null } → { dimmer: 0.85 }

    // 2. IPC fire-and-forget
    window.lux.aether.setManualOverrides(setPayloads)   // nodeId + channels
    window.lux.aether.clearManualOverrides(clearNodeIds)

    // 3. Consumir dirty flags
    state.consumeDirty()
  }
}
```

**Frecuencia:** 44Hz (mismo tick que el frame loop). Singleton exportado como `ProgrammerAetherBridge`.

**Familia → NodeId label:**
```typescript
const FAMILY_LABEL = {
  IMPACT:  'impact',     // → nodeId: "fix-01:impact"
  COLOR:   'color',      // → nodeId: "fix-01:color"
  KINETIC: 'kinetic',    // → nodeId: "fix-01:kinetic"
  BEAM:    'beam',       // → nodeId: "fix-01:beam"
  EXTRAS:  'atmosphere', // → nodeId: "fix-01:atmosphere"
}
```

### 4.3 IPC Backend: AetherIPCHandlers

```
Archivo: src/core/aether/AetherIPCHandlers.ts
Líneas: 47-118
```

```typescript
ipcMain.handle('lux:aether:setManualOverrides', (_event, payloads) => {
  const arbiter = getTitanOrchestrator().getAetherArbiter()
  for (const { nodeId, channels } of payloads) {
    arbiter.setManualOverride(nodeId, channels)  // ← Escribe en L2 del NodeArbiter
  }
})

ipcMain.handle('lux:aether:clearManualOverrides', (_event, nodeIds) => {
  const arbiter = getTitanOrchestrator().getAetherArbiter()
  for (const nodeId of nodeIds) {
    arbiter.clearManualOverride(nodeId)
  }
})
```

**Punto clave:** Los overrides se inyectan en `NodeArbiter._manualOverrides` (capa L2), **NO** en el HAL ni en el NodeResolver. El operador controla la **intención**, no los bytes DMX.

### 4.4 Inhibit Limits (L2.5) — IPC Dedicado

```
Archivo: src/core/aether/AetherIPCHandlers.ts
Líneas: 130-178
```

```typescript
ipcMain.handle('lux:aether:setInhibitLimit', (_event, { nodeIds, limit }) => {
  const arbiter = getTitanOrchestrator().getAetherArbiter()
  for (const nodeId of nodeIds) {
    arbiter.setInhibitLimit(nodeId, limit)  // Cap post-arbitraje sobre dimmer
  }
})
```

Este es un **grand master per-fixture** que vive en el arbiter, no en el HAL.

---

## 5. EJE 4: EL ARBITRO — Interacción con el Egress

### 5.1 Capas del NodeArbiter (Aether)

```
Archivo: src/core/aether/NodeArbiter.ts
Líneas: 51-343
```

```
Capa   Prioridad   Método de inyección              Tipo de merge
─────────────────────────────────────────────────────────────────────────
L0     0-99        setSystemIntents(bus)            HTP/LTP por canal
L1     100-199     setSeleneOverrides(intents[])    HTP/LTP por canal
LP     200         setPlaybackIntents(intents[])    HTP/LTP por canal
L2     200-299     setManualOverride(nodeId, ch)    ESCRITURA DIRECTA (override total)
L2.5   N/A         setInhibitLimit(nodeId, cap)     Post-arbitraje: dimmer *= cap
L3     300-399     setEffectIntents(intents[])      HTP/LTP por canal
L3+    350         setHephaestusIntents(intents[])  HTP/LTP por canal
L4     900+        setBlackout(active)              Return mapa vacío
GM     N/A         setGrandMaster(value)            Multiplica HTP channels post-merge
```

**Orden de aplicación en `arbitrate()` (líneas 167-238):**

```
arbitrate()
  ├── L0: systemBus.getAll()       // Systems base (audio-reactive)
  ├── L1: _seleneOverrides         // IA overrides
  ├── LP: _playbackIntents         // Chronos timeline
  ├── L3: _effectIntents           // LiveFX
  ├── L3+: _hephaestusIntents      // Diamond Data
  ├── L2: _manualOverrides        // Hyperion (ESCRITURA DIRECTA, no merge)
  ├── GM: _grandMaster             // Atenuación global HTP
  └── L2.5: _inhibitLimits         // Cap per-fixture dimmer
```

### 5.2 Manual Override en el Arbiter (L2)

```
Archivo: src/core/aether/NodeArbiter.ts
Líneas: 199-211
```

```typescript
// L2: Manual overrides — escritura directa, sin merge
for (const [nodeId, channels] of this._manualOverrides) {
  let record = this._result.get(nodeId)
  if (!record) {
    record = this._acquireRecord()
    this._result.set(nodeId, record)
  }
  for (const key in channels) {
    record[key] = channels[key]   // OVERRIDE TOTAL: no HTP, no LTP, reemplazo puro
  }
}
```

**Semántica:** L2 no hace merge — **reemplaza completamente** los canales especificados. Canales no presentes en el override pasan through de las capas inferiores.

### 5.3 El Arbitro Legacy (`masterArbiter`)

```
Archivo: src/core/arbiter/index.ts (referenciado en HAL línea 67)
```

El `masterArbiter` es el arbitro **Legacy** que:
- Recibe `Layer0_Titan` (AI intent), manual overrides, effects, playback
- Produce `FinalLightingTarget` (fixture-level, no node-level)
- Expone `isOutputEnabled()` — usado por la Aduana en `sendToDriver()`

**Diferencia clave:**
- `masterArbiter` opera a nivel de **fixture** (Legacy)
- `NodeArbiter` opera a nivel de **capability node** (Aether V2)

---

## 6. MAPA COMPLETO DEL EGRESS

### 6.1 Pipeline AETHER (Native)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  AETHER NATIVE EGRESS                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TitanOrchestrator.processFrame()                                           │
│    │                                                                        │
│    ├── 1. Systems (5) + Adapters (4) → IntentBus / Arbiter direct           │
│    │                                                                      │
│    ├── 2. NodeArbiter.arbitrate()                                          │
│    │      Merge L0→L1→LP→L3→L3+ → L2 overrides → GM → Inhibit            │
│    │      Retorna: ArbitratedNodeMap (Map<NodeId, Record<channel,value>>) │
│    │                                                                      │
│    ├── 3. PhysicsPostProcessor.process(arbitrated, deltaMs)               │
│    │      Inercia PAN/TILT en KINETIC nodes (muta in-place)               │
│    │                                                                      │
│    ├── 4. NodeResolver.resolve(arbitrated)                                │
│    │      │                                                                │
│    │      ├── Zero-fill Uint8Array(512) por universo                      │
│    │      ├── _writeNode() para cada nodo                                  │
│    │      │   ├── SI compiled ForgeGraph:                                  │
│    │      │   │   ForgeNodeEvaluator.evaluate(compiled, values, ctx,      │
│    │      │   │                            buf, baseAddr)                │
│    │      │   │   // Escribe directo al Uint8Array del universo           │
│    │      │   └── SINO: flujo legacy (ColorTranslator, IK, TransferCurve)   │
│    │      └── Ensamblar IDMXPacket[] desde buffers activos                 │
│    │                                                                      │
│    └── 5. EGRESS HAL                                                        │
│           for (universe of resolver.registeredUniverses) {               │
│             const rawBuf = resolver.getUniverseBuffer(universe)          │
│             hal.sendUniverseRaw(universe, rawBuf)   // ZERO-COPY REF      │
│           }                                                                │
│                                                                             │
│  HAL.sendUniverseRaw(universe, data: Uint8Array)                           │
│    ├── Gate: if (!driver.isConnected) return false                        │
│    └── driver.sendUniverse(universe, data)                                 │
│        USBDMXDriverAdapter.sendUniverse()                                  │
│          └── universalDMX.setUniverse(data, universe)                    │
│              // Copia: Uint8Array → Buffer.alloc(513) [inevitable]         │
│                                                                             │
│  [Al final del frame loop, LEGACY también llama flushToDriver()]           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Pipeline LEGACY (coexistente)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  LEGACY EGRESS                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TitanOrchestrator.processFrame()                                           │
│    │                                                                        │
│    ├── 1. masterArbiter.setTitanIntent(intent)      // L0 AI               │
│    ├── 2. masterArbiter.setEffectIntents(effectMap)   // L3 Effects          │
│    ├── 3. const arbitrated = masterArbiter.arbitrate()                       │
│    │      // Merge L0+L1+L2+L3+L4 → FinalLightingTarget                    │
│    │                                                                      │
│    ├── 4. const states = HAL.renderFromTarget(arbitrated, fixtures, audio)│
│    │      // FixtureMapper: target → FixtureState[]                          │
│    │      // PhysicsEngine: pan/tilt interpolation                         │
│    │      // ColorTranslator: RGB → wheel/CMY                               │
│    │      // Retorna: FixtureState[] (mutable, para UI broadcast)           │
│    │                                                                      │
│    ├── 5. [post-HAL] HephaestusRuntime.tick() → muta fixtureStates[]      │
│    │      // L3+ Diamond Data post-procesado                               │
│    │                                                                      │
│    ├── 6. Hot-frame broadcast (22Hz) → Frontend UI                        │
│    │                                                                      │
│    └── 7. HAL.flushToDriver(states)              // La Aduana               │
│           │                                                                │
│           ├── sendToDriver(states)                                         │
│           │   ├── physicalStates = states.filter(!isVirtual)                │
│           │   ├── packets = mapper.statesToDMXPackets(physicalStates)      │
│           │   │   // Crea N objetos DMXPacket + number[] por frame          │
│           │   ├── ADUANA GATE (WAVE 3160):                                 │
│           │   │   if (!outputEnabled) {                                    │
│           │   │     // Manual pasa, AI → safe values (dimmer=0, pan=128)   │
│           │   │   }                                                        │
│           │   ├── for (packet of packets) driver.send(packet)             │
│           │   └── driver.sendAll()                                         │
│           │                                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Divergencia Crítica: La Aduana

| Feature | Legacy | Aether |
|---|---|---|
| **Virtual fixture gate** | ✅ `states.filter(!isVirtual)` | ❌ No implementado |
| **OutputEnabled gate** | ✅ Aduana zerifica bytes no-manual | ❌ No implementado |
| **Blackout** | ✅ `mapper.setBlackout()` + `driver.blackout()` | ❌ `NodeArbiter` retorna mapa vacío, pero no hay gate HAL |
| **Safe values (ARMED)** | ✅ `dimmer=0, pan=128, shutter=255` | ❌ No aplica — los valores arbitrados van crudos |

**Riesgo operativo:** Si el operador tiene `outputEnabled=false` (modo ARMED), los fixtures en pipeline Aether seguirán emitiendo DMX con los valores del engine. Solo los fixtures Legacy se apagarán/respetarán la Aduana.

---

## 7. GAPS Y RECOMENDACIONES PARA TEST CON FAN TUNGSTEN

### G1: Aduana Aether (SEVERIDAD: ALTA)

**Problema:** `sendUniverseRaw` no aplica ningún gate de `outputEnabled` ni `isVirtual`.

**Recomendación:**
- Opción A: Añadir un gate en `TitanOrchestrator` antes de `sendUniverseRaw`:
  ```typescript
  if (!masterArbiter.isOutputEnabled()) {
    // Enviar buffer vacío o no enviar
  }
  ```
- Opción B: Añadir `outputEnabled` al `ForgeFrameContext` y que el `ForgeNodeEvaluator` respete un flag global.
- Opción C (mínima): Documentar que fixtures en Aether siempre emiten DMX y el operador debe usar blackout del engine.

### G2: Virtual Fixture Gate (SEVERIDAD: MEDIA)

**Problema:** El pipeline Aether no filtra fixtures virtuales. Un fixture marcado `isVirtual=true` pero registrado en `NodeGraph` emitirá DMX al hardware.

**Recomendación:** Añadir filtro en `NodeResolver._writeNode()` o en `TitanOrchestrator` antes del loop de `registeredUniverses`.

### G3: Blackout Aether (SEVERIDAD: MEDIA)

**Problema:** `NodeArbiter.setBlackout(true)` retorna mapa vacío, lo cual hace que `NodeResolver` envíe buffers zero-filled. Esto funciona. Pero si hay una ruta paralela (por ejemplo, `ForgeNodeEvaluator` con valores internos de state), el evaluator podría no respetar el blackout.

**Recomendación:** Verificar que `ForgeNodeEvaluator.evaluate()` con `values=undefined` (mapa vacío) produzca ceros en DMX. Esto depende de que `compiled.inputMap` tenga `defaultValue=0` para todos los inputs.

### G4: Refresh Rate Mismatch (SEVERIDAD: BAJA)

**Problema:** Aether corre a 44Hz (frame loop del Orchestrator). UniversalDMX corre a 30Hz (WAVE 1101). Los buffers se actualizan 44 veces/segundo pero solo se envían 30 veces/segundo por `sendAll()`.

**Impacto:** El Orchestrator llama `sendUniverseRaw()` 44 veces/segundo, pero `universalDMX.sendAll()` solo se llama al final del frame loop Legacy (`flushToDriver`). Si Aether y Legacy comparten el mismo `sendAll()`, los 14 frames extra se sobreescriben en el buffer antes del flush.

**Recomendación:** Confirmar que `flushToDriver()` al final del frame loop envía el estado más reciente. No hay riesgo funcional, solo waste de CPU en 14 frames/segundo.

### G5: Programmer L2 + ForgeNodeEvaluator (SEVERIDAD: BAJA)

**Problema:** El `ProgrammerAetherBridge` inyecta overrides en `NodeArbiter._manualOverrides` usando nodeIds como `"fix-01:impact"`. Cuando `ForgeNodeEvaluator.evaluate()` recibe `channelValues` (del ArbitratedNodeMap), estos ya incluyen el override L2. El evaluador recibe el mapa completo arbitrado.

**Verificación:** Confirmar que `ForgeNodeEvaluator.evaluate()` lee `values` correctamente:
```typescript
for (const input of compiled.inputMap) {
  wire[input.wireOffset] = values[input.channelName] ?? input.defaultValue
}
```
Si `input.channelName` es `'dimmer'` y `values['dimmer']` fue overrideado a 0.85 por L2, el evaluador recibirá 0.85. **Funciona correctamente.**

---

## 8. SECUENCIA DE INTEGRACIÓN PARA FAN TUNGSTEN

Para testear el Fan Tungsten con el pipeline Aether completo:

```
1. PATCH TIME (una vez):
   a. Crear FixtureDefinitionV2 para Fan Tungsten con nodeGraph (Forge)
   b. TitanOrchestrator.registerAetherDevice(definition, nodeGraph)
   c. NodeGraph.registerDevice(definition) → nodeIds
   c. NodeResolver.registerUniverse(definition.universe)
   d. ForgeGraphCompiler.compile(nodeGraph, deviceId) → CompiledForgeGraph
   e. NodeResolver.registerForgeGraph(deviceId, compiled)

2. FRAME LOOP (cada ~23ms @ 44Hz):
   a. _aetherBus.clear()
   b. Systems.process() + Adapters.ingest() → bus/arbiter
   c. NodeArbiter.arbitrate() → ArbitratedNodeMap
   d. _forgeFrameCtx población in-place (audio, BPM, time, energy)
   e. aetherResolver.setForgeFrameContext(_forgeFrameCtx)
   f. aetherResolver.resolve(arbitrated) → IDMXPacket[]
   g. for each universe: hal.sendUniverseRaw(universe, rawBuf)
   h. (Legacy flushToDriver corre en paralelo para fixtures no-Aether)
```

---

## 9. MAPA DE ARCHIVOS DEL EGRESS

```
src/core/aether/
├── NodeArbiter.ts                  ← Merge multicapa + L2 manual overrides
├── resolver/
│   ├── NodeResolver.ts             ← Traduce arbitrated → DMX Uint8Array
│   └── PhysicsPostProcessor.ts     ← Inercia PAN/TILT post-arbitraje
├── AetherIPCHandlers.ts            ← IPC L2 + Inhibit limits + stubs Kinetic/Spatial

src/core/orchestrator/
└── TitanOrchestrator.ts            ← Frame loop, inyecta contexto, llama resolve + sendUniverseRaw

src/bridges/
└── ProgrammerAetherBridge.ts       ← Frontend 44Hz bridge (Zustand → IPC)

src/stores/
└── programmerStore.ts              ← Zustand store con overrides 0-1 + dirty flags

src/hal/
├── HardwareAbstraction.ts          ← sendUniverseRaw(), renderFromTarget(), flushToDriver()
├── drivers/
│   ├── DMXDriver.interface.ts    ← IDMXDriver contract (sendUniverse, sendAll)
│   ├── USBDMXDriverAdapter.ts    ← Adaptador IDMXDriver → UniversalDMX
│   ├── UniversalDMXDriver.ts     ← Buffers, setUniverse, sendAll, autoConnect
│   └── strategies/
│       ├── DMXSendStrategy.ts    ← Interface strategy
│       ├── OpenDMXStrategy.ts    ← Phantom Worker (bit-banging BREAK/MAB)
│       └── EnttecProStrategy.ts  ← SerialPort directo (Label 6)
├── mapping/
│   ├── FixtureMapper.ts          ← Legacy: FixtureState[] → DMXPacket[]
│   └── ZoneRouter.ts             ← Legacy: zone routing
├── physics/
│   └── PhysicsEngine.ts          ← Legacy: decay/inertia
├── translation/
│   ├── ColorTranslator.ts        ← Legacy + Aether: RGB → wheel/CMY
│   ├── HarmonicQuantizer.ts      ← Gate musical de cambios de rueda
│   └── HardwareSafetyLayer.ts    ← Debounce/strobe safety
└── drivers/
    └── (ArtNet, sACN en CompositeDMXDriver)
```

---

*Fin del Diagnóstico HAL & Aduana — WAVE 4553*
