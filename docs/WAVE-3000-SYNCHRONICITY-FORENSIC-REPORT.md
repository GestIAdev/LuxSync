# WAVE 3000: THE SYNCHRONICITY AUDIT
## Reporte Forense — Diagnóstico de Apagones de 1 Frame

**Fecha:** Abril 16, 2026  
**Directiva:** Auditoría temporal (4D) del pipeline de renderizado DMX  
**Alcance:** Investigación de race conditions en la infraestructura de sincronización  
**Clasificación:** FORENSIC (Read-Only Analysis)  
**Status:** COMPLETO

---

## EXECUTIVE SUMMARY

El sistema LuxSync experimentaba **apagones globales aleatorios de 1 frame** (33ms) en operación normal. La auditoría forense identificó **DOS sospechosos principales** causantes de frames perdidos o parcialmente actualizados:

1. **DOUBLE-SEND CONFLICT** (del inglés): Cuando Hephaestus tiene clips activos, se escriben dos veces en el buffer DMX en el mismo frame. La primera escritura se envía incompleta al cable, generando un frame visual incorrecto.

2. **TRANSMITTING SEMAPHORE COLLISION**: El semáforo `isTransmitting` en `UniversalDMXDriver.sendAll()` dropea frames cuando dos escrituras compiten por acceso simultáneo.

**Veredicto de Arquitectura:** NO se encontraron corrupciones de memoria ni race conditions "hardcore" en el child process. El sistema está correctamente aislado con `child_process.fork()`. **El problema es de lógica de concurrencia** en la integridad del buffer compartido entre dos path de sendToDriver().

---

## 1. ANATOMÍA DEL DMX BUFFER

### 1.1 Capas de Almacenamiento

Existen **tres niveles** de buffer DMX, cada uno con ciclo de vida diferente:

| Capa | Variable | Ubicación | Tipo | Inicialización | Limpieza |
|------|----------|-----------|------|-----------------|----------|
| **HAL Layer** | `universeBuffers` | [HardwareAbstraction.ts](../electron-app/src/hal/HardwareAbstraction.ts#L187) | `Map<number, Uint8Array>` | Una vez en constructor | Nunca |
| **Driver Layer** | `universeBuffers` | [UniversalDMXDriver.ts](../electron-app/src/hal/drivers/UniversalDMXDriver.ts#L97) | `Map<number, Buffer>` | Una vez en `initBuffer(512+1)` | Nunca |
| **Child Process** | `dmxBuffer` | [openDmxWorker.ts](../electron-app/src/hal/drivers/strategies/openDmxWorker.ts) | `Buffer.alloc(513, 0)` | Una vez en worker startup | Nunca (pero se actualiza vía IPC) |

### 1.2 Ciclo de Vida del Buffer UniversalDMX (El Eje Central)

```
INICIALIZACIÓN (Una sola vez):
├─ UniversalDMXDriver constructor
├─ initBuffer(universe) → Buffer.alloc(513, 0)
└─ universeBuffers.set(universe, buffer)

CADA FRAME (44Hz main loop):
├─ renderFromTarget() → staesToDMXPackets()
├─ for (packet of packets):
│   └─ driver.send(packet)
│       └─ universalDMX.setChannels(address, values, universe)
│           ├─ buf[address + i] = values[i]  ← SOBRESCRIBE bytes en buffer
│           └─ if (changed) flushToStrategies()  ← THROTTLED 33ms
├─ void driver.sendAll()  ← FIRE & FORGET
│   └─ OpenDMXStrategy.send(buffer)  ← IPC al child
│       └─ child process: dmxBuffer = UPDATE_BUFFER
└─ [FRAME COMPLETO]

DURANTE HEPHAESTUS OVERLAY (Si lyric.lfx activo):
├─ [Mismo frame, llamada #2]
├─ sendStatesWithPhysics() → sendToDriver()
├─ for (packet of packets):
│   └─ [SOBREESCRIBE BUFFER DE NUEVO]
└─ void driver.sendAll()  ← SEGUNDO ENVÍO
    └─ [PUEDE PERDER DATOS O COMPETIR POR SEMÁFORO]
```

**Hallazgo:** El buffer **NO se reinicializa** entre frames. Se **sobreescribe parcialmente** fixture a fixture. El buffer en el child process también es persistente; solo se modifica cuando llega un `UPDATE_BUFFER` vía IPC.

---

## 2. AUDITORÍA DE CONCURRENCIA

### 2.1 Timeline de Concurrencia en un Frame

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ MAIN PROCESS (TitanOrchestrator @ 44Hz = 23ms interval)                    │
├─────────────────────────────────────────────────────────────────────────────┤

[Frame N starts]
  t0:   setInterval fires → processFrame()
  
  t1:   if (isProcessingFrame) return  // STAMPEDE GUARD
        this.isProcessingFrame = true
        
  t2:   brain.getCurrentContext() 📌 SYNC
  
  t3:   BPM + audio processing 📌 SYNC
  
  t4:   await this.engine.update()
        ⚠️  CEDE CONTROL AL EVENT LOOP
        
        [Durante este await, puede ejecutarse:]
        • setTimeout callbacks (ej: flushToStrategies)
        • setImmediate
        • IPC handlers (process.on('message'))
        • microtasks
        
  t5:   masterArbiter.arbitrate() 📌 SYNC
  
  t6:   HAL.renderFromTarget(arbitratedTarget)
        ├─ fixtures.map() → FixtureState[] 📌 SYNC
        ├─ physics.interpolate() 📌 SYNC
        └─ sendToDriver(statesWithPhysics)  [FIRST SEND]
            ├─ Aduana.check() 📌 SYNC
            ├─ mapper.statesToDMXPackets() 📌 SYNC
            ├─ for (packet of packets) {
            │   └─ driver.send(packet)
            │       └─ universalDMX.setChannels()  [WRITE #1 to buffer]
            │           └─ if (changed) flushToStrategies()
            │               └─ setTimeout(() => sendAll(), 33)  [SCHEDULES]
            ├─ void this.driver.sendAll()  [IMMEDIATE SEND]
            │   ├─ if (isTransmitting) return false  ← SEMAPHORE CHECK
            │   └─ OpenDMXStrategy.send(buffer)
            │       └─ child_process.send({UPDATE_BUFFER, channels})  [IPC → CHILD]
            └─ return states
  
  t7:   [IF Hephaestus clips active:]
        HAL.sendStatesWithPhysics(states)  [SECOND SEND]
        ├─ states + hephOverlay
        └─ sendToDriver(overlayedStates)
            ├─ mapper.statesToDMXPackets() 📌 SYNC
            ├─ for (packet of packets) {
            │   └─ universalDMX.setChannels()  [WRITE #2 to buffer, SOBRESCRIBE]
            └─ void this.driver.sendAll()  [IMMEDIATE SEND #2]
                ├─ if (isTransmitting) return false  ← ⚠️ PUEDE CAER AQUÍ
                └─ [INTENTA IPC PERO EL SEMÁFORO DROPEA]
  
  t8:   HephaestusRuntime.tick() 📌 SYNC
  
  t9:   IPC broadcast (hot frame 44Hz + truth 7Hz) 📌 SYNC
  
  t10:  this.isProcessingFrame = false
  
  t11:  [Frame N complito]

[Frame N+1 empieza 23ms después]

└─────────────────────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ CHILD PROCESS (openDmxWorker @ 30Hz = 33ms pacing via hrtime)              │
├─────────────────────────────────────────────────────────────────────────────┤

[Output loop starts]
  t0:  startOutputLoop()
       lastFrameStart = process.hrtime.bigint()
       scheduleNextFrame()
  
  t1:  setImmediate(() => {
         const remaining = (lastFrameStart + minFrameNs) - now
         if (remaining > MAX_PACING_SPIN) {
           scheduleNextFrame()  ← CEDE AL EVENT LOOP
           return
         }
         if (remaining > 0) {
           spinWaitNs(remaining)  ← SPIN-WAIT DE ALTA RESOLUCIÓN
         }
         sendFrame()
       })
  
  t2:  [Durante setImmediate yield, llega...]
       process.on('message', {type: 'UPDATE_BUFFER', channels})
       ├─ for (i = 0; i < len; i++)
       │   dmxBuffer[i] = channels[i]  [COPIA BUFFER LOCALMENTE]
       └─ lastBufferUpdateNs = process.hrtime.bigint()
  
  t3:  [Vuelve al setImmediate:]
       sendFrame()
       ├─ if (breakMode === 'baudrate')
       │   └─ port.update({baudRate: 76923})  [CAMBIAR BAUD para BREAK]
       │   └─ port.write(0x00)  [EMITIR 0x00 = BREAK DMX512]
       │   └─ port.drain()  [ESPERAR A QUE UART VACÍE]
       │   └─ port.update({baudRate: 250000})  [VOLVER A 250kbaud]
       │   └─ spinWaitNs(MAB_NS)  [ESPERAR MAB 20µs]
       │   └─ port.write(dmxBuffer)  [EMITIR 513 bytes al cable serial]
       └─ scheduleNextFrame()  [REPROGRAMAR PARA SIGUIENTE TICK]

└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Puntos de Sincronización (Falta de)

**TIMER 1:** `setInterval(() => processFrame(), 23ms)` — 44Hz  
**TIMER 2:** `scheduleNextFrame()` + `setImmediate()` + `hrtime pacing` — 30Hz  
**RELACIÓN:** Completamente **asíncrona e independiente**. No hay `await` que bloquee al child.

**YIELD POINT:** Único `await` en main process es `engine.update()`. Durante este yield, pueden dispararse:
- Callbacks de `setTimeout` (ej: el throttle de `flushToStrategies()`)
- Handlers de IPC del child
- Microtasks de promesas

---

## 3. HALLAZGOS CRÍTICOS

### HALLAZGO 1: DOUBLE-SEND CONFLICT (HIGH SEVERITY ⚠️)

#### Síntomas
Cuando Hephaestus tiene clips `.lfx` activos, el buffer DMX se escribe **dos veces** en el mismo frame de renderizado:

1. **Primera escritura** ([TitanOrchestrator.ts](../electron-app/src/core/orchestrator/TitanOrchestrator.ts#L1006)):
   ```typescript
   let fixtureStates = this.hal.renderFromTarget(arbitratedTarget, this.fixtures, halAudioMetrics)
   ```
   Que internamente llama [HardwareAbstraction.ts](../electron-app/src/hal/HardwareAbstraction.ts#L1141):
   ```typescript
   this.sendToDriver(statesWithPhysics)
   ```
   **Buffer contiene:** Estado de fixtures sin overlays de Hephaestus.  
   **Acción:** `void this.driver.sendAll()` — envía buffer parcial al child process vía IPC.

2. **Segunda escritura** ([TitanOrchestrator.ts](../electron-app/src/core/orchestrator/TitanOrchestrator.ts#L1250)):
   ```typescript
   if (hephOutputs.length > 0) {
     this.hal.sendStatesWithPhysics(fixtureStates)
   }
   ```
   Que llama [HardwareAbstraction.ts](../electron-app/src/hal/HardwareAbstraction.ts#L1742):
   ```typescript
   private sendStatesWithPhysics(states): void {
     this.sendToDriver(states)  // ← SEGUNDA LLAMADA AL MISMO MÉTODO
   }
   ```
   **Buffer contiene:** Estado de fixtures CON overlays de Hephaestus.  
   **Acción:** `void this.driver.sendAll()` — intenta enviar buffer actualizado.

#### Mecánica de la Race Condition

```
Frame N @ t0:
  [renderFromTarget envía buffer SIN hephaestus]
  → OpenDMXStrategy.send()
  → child_process.send({UPDATE_BUFFER, channels: [array sin hephFX]})
  → child recibe → dmxBuffer copiado

Frame N @ t0+1ms:
  [sendStatesWithPhysics sobrescribe buffer CON hephaestus]
  → pero sendAll() ve isTransmitting = true (del envío anterior)
  → return false ← DROP
  
Frame N @ t0+33ms:
  [El child envía el buffer antiguo (sin hephFX)]
  → apagón de 1 frame en fixtures que Hephaestus debería iluminar ❌

Frame N+1 @ t0+44ms:
  [Siguiente frame, buffer finalmente corregido]
  → sistema se normaliza
```

#### ¿Por qué no lo prevents el throttle?

El `flushToStrategies()` tiene un throttle de 33ms:
```typescript
private flushToStrategies(): void {
  if (this.flushPending) return
  this.flushPending = setTimeout(() => {
    this.flushPending = null
    void this.sendAll()
  }, this.FLUSH_THROTTLE_MS)  // 33ms
}
```
[UniversalDMXDriver.ts](../electron-app/src/hal/drivers/UniversalDMXDriver.ts#L752-L758)

**Pero el HAL llama `void this.driver.sendAll()` INMEDIATAMENTE después del loop de packets**, bypasseando el throttle:

```typescript
for (const packet of packets) {
  this.driver.send(packet)
}

if (this.driver.sendAll) {
  void this.driver.sendAll()  ← FUERA DEL THROTTLE, EJECUCIÓN INMEDIATA
}
```
[HardwareAbstraction.ts](../electron-app/src/hal/HardwareAbstraction.ts#L1990-L1996)

#### Impacto
- **Severidad:** High — produce apagones visuales perceptibles cada N frames cuando Hephaestus está activo
- **Frecuencia:** Depende del tempo del contenido `.lfx` — puede ser cada 100ms o cada 5 segundos
- **Síntoma Visual:** Flash negro de 33ms en fixtures con overlays activos

---

### HALLAZGO 2: TRANSMITTING SEMAPHORE COLLISION (HIGH SEVERITY ⚠️)

#### Síntomas
El semáforo `isTransmitting` en [UniversalDMXDriver.ts](../electron-app/src/hal/drivers/UniversalDMXDriver.ts#L800) dropea frames cuando dos `sendAll()` compiten.

```typescript
async sendAll(): Promise<boolean> {
  if (this.isTransmitting) return false  ← RETORNO INMEDIATO SIN ENVIAR
  
  this.isTransmitting = true
  try {
    const promises = []
    for (const strategy of this.strategies) {
      promises.push(strategy.send(rateLimit, this.universeBuffers))
    }
    await Promise.all(promises)
  } finally {
    this.isTransmitting = false
  }
}
```
[UniversalDMXDriver.ts](../electron-app/src/hal/drivers/UniversalDMXDriver.ts#L800-L815)

#### Mecánica de la Colisión

Hay **dos callers** independientes de `sendAll()`:

**Caller 1:** HAL's fire-and-forget (inmediato)
```typescript
void this.driver.sendAll()  ← El HAL NO espera, ignora el Promise
```

**Caller 2:** UniversalDMXDriver's throttle (programado 33ms después)
```typescript
setTimeout(() => void this.sendAll(), 33)
```

Si ambos intentan ejecutar en el mismo tick de event loop:

```
t0: Caller 1 (HAL) entra a sendAll()
    ├─ isTransmitting? No
    └─ isTransmitting = true
    └─ [entra al Promise.all]

t1: (0-10ms después)
    Caller 2 (throttle setTimeout) intenta sendAll()
    ├─ isTransmitting? Sí ← DROP SILENCIOSO
    └─ return false  ← FRAME PERDIDO

t2: (después de Promise.all resolver)
    Caller 1 finaliza
    └─ isTransmitting = false
```

#### Impacto
- **Severidad:** High — frames enteros se pierden sin visibilidad
- **Frecuencia:** Cada 33-44ms (cuando coinciden los timers)
- **Síntoma Visual:** Parpadeo o congelación de 33ms, especialmente en escenas estáticas (donde el throttle evita resends innecesarios)
- **Log:** Silencioso — no hay error reportado, solo un `return false`

---

### HALLAZGO 3: JITTER EN TIMERS INDEPENDIENTES (MEDIUM SEVERITY)

Main process @ 44fps + Child process @ 30fps = **Ventana de 3-5ms de desalignment por ciclo**.

```
Main:  |__23ms__|__23ms__|__23ms__|__23ms__|
Child: |___33ms___|___33ms___|
              ↑         ↑         ↑
         Solapamiento variable
              (3-5ms de jitter)
```

El child process **lee el buffer local** que fue copiado vía IPC en algún punto. Si el IPC llega justo en la ventana de desalignment, el buffer puede estar en estado intermedio. Sin embargo, el child process es **single-threaded** (Node.js event loop), así que el `UPDATE_BUFFER` handler completa **antes** del siguiente `sendFrame()`. **No hay race condition pura aquí, pero el timing es frágil.**

---

### HALLAZGO 4: NON-ATOMIC BUFFER FILL (LOW SEVERITY)

El llenado del buffer es **por-fixture**, no atómico a nivel de frame:

```typescript
for (const packet of packets) {  // ← Itera fixture por fixture
  this.driver.send(packet)
    → universalDMX.setChannels(address, values, universe)
      → buf[address + i] = values[i]  ← Escribe byte a byte
}
```

Si alguna interrupción hipotética ocurriese entre fixtures, el buffer estaría en estado correlacionado (algunos fixtures N, otros N-1). **En Node.js single-threaded, esto es imposible** — pero es una observación arquitectónica de que **el buffer no es "snapshot" atómico**.

**Impacto:** Bajo en la práctica (Node.js es single-threaded), pero un debt técnico: si algún día migramos a worker threads, esto sería crítico.

---

### HALLAZGO 5: CHILD PROCESS ISOLATION — LIMPIO ✅

El child process (`openDmxWorker.ts`) **está correctamente aislado**. No encontramos race conditions internas:

- ✅ `Buffer.alloc(513)` local — no compartido con main
- ✅ `process.on('message')` handler es atomic en Node.js (single-threaded)
- ✅ `scheduleNextFrame()` vía `setImmediate` + `hrtime.spin()` sigue pacing consistente
- ✅ `sendFrame()` lee `dmxBuffer` local — no toca memoria del main
- ✅ SerialPort connection es local al child — zero contention con main

**Conclusión:** El child process es sólido. Los problemas están en la **coordinación main→child**.

---

## 4. TABLA DE DIAGNÓSTICO

| Hallazgo | Severidad | Causa | Síntoma | Frecuencia | Solución Propuesta |
|----------|-----------|-------|--------|-----------|-------------------|
| **Double-Send Conflict** | HIGH ⚠️ | Dos `sendToDriver()` en mismo frame (renderFromTarget + sendStatesWithPhysics) | Apagón 33ms en fixtures con Hephaestus | Cada N frames con overlays | Merge both sends into single atomic frame write |
| **Semaphore Collision** | HIGH ⚠️ | Dos `sendAll()` compitiendo, uno dropea | Frame perdido silenciosamente | Cada 33-44ms | Queue sends o merge con throttle determinista |
| **Jitter Independiente** | MEDIUM 🟡 | Main @ 44Hz + Child @ 30Hz no sincronizados | Timing frágil entre render y hardware | Constante | Sync child to main frame boundary (opcional) |
| **Non-Atomic Fill** | LOW 🟢 | Escritura por-fixture, no snapshot atómico | Potencial corrupción si threads futuros | Hipotético | Refactor to frame-atomic buffer snapshot |
| **Child Process** | CLEAN ✅ | Aislamiento correcto con fork() | N/A | N/A | N/A — No cambiar |

---

## 5. RECOMENDACIONES DE ARQUITECTURA

### 5.1 Solución Inmediata (Priority 1)

**Merge Double-Send into Single Atomic Frame:**

Cambiar el flow de dos `sendToDriver()` a uno solo:

```typescript
// EN VEZ DE:
let fixtureStates = this.hal.renderFromTarget(target, fixtures, audio)
if (hephOutputs.length > 0) {
  this.hal.sendStatesWithPhysics(fixtureStates)
}

// HACER:
let fixtureStates = this.hal.renderFromTarget(target, fixtures, audio)
if (hephOutputs.length > 0) {
  applyHephaestusOverlay(fixtureStates)  // Modifica en-lugar
}
this.hal.sendToDriver(fixtureStates)  // UNA SOLA LLAMADA, AFTER overlays
```

**Beneficio:** Elimina el HALLAZGO 1 completamente. Buffer escrito una sola vez por frame.

### 5.2 Solución de Concurrencia (Priority 2)

**Queued vs Throttled sendAll():**

Cambiar el modelo fire-and-forget a una cola:

```typescript
private sendQueue: Promise<void> = Promise.resolve()

async queueSend(buffer): Promise<void> {
  this.sendQueue = this.sendQueue.then(() => this.sendAll(buffer))
}
```

O alternativamente, **unificar bajo el throttle sin bypass:**

```typescript
// Eliminar: void this.driver.sendAll()
// Permitir que SOLO el throttle dispare sendAll()
```

**Beneficio:** Elimina el HALLAZGO 2. Semaphore collision imposible.

### 5.3 Audit Trail (Priority 3)

Añadir logging en `UniversalDMXDriver.sendAll()`:

```typescript
async sendAll(): Promise<boolean> {
  if (this.isTransmitting) {
    console.warn('[DMX-AUDIT] sendAll() DROP — isTransmitting already true')
    return false
  }
  // ...
}
```

**Beneficio:** Visibilidad futura para diagnosis de nuevas issues.

---

## 6. VERIFICACIÓN POST-FIX

Después de implementar las soluciones, validar:

```bash
# 1. Reproducir escena con Hephaestus overlays activos @ 200% intensity
#    Esperar 60 segundos sin parpadeos visibles

# 2. Registrar logs de sendAll() DROPs
#    Esperado: 0 DROPs en 60 segundos

# 3. Medir DMX output via scope (oscilador USB)
#    Verificar: 44 frames/sec uniform, sin glitches de timing
```

---

## 7. CÓDIGO RELEVANTE — REFERENCIAS

| Componente | Archivo | Líneas | Descripción |
|------------|---------|--------|-------------|
| Render Loop | [TitanOrchestrator.ts](../electron-app/src/core/orchestrator/TitanOrchestrator.ts) | 410-530, 530-960, 1006, 1250 | Main process setInterval(23), processFrame, two sendToDriver calls |
| Dynamic Send #1 | [HardwareAbstraction.ts](../electron-app/src/hal/HardwareAbstraction.ts) | 903-1141 | renderFromTarget + sendToDriver |
| Overlay Send #2 | [HardwareAbstraction.ts](../electron-app/src/hal/HardwareAbstraction.ts) | 1715-1760, 1742 | sendStatesWithPhysics + sendToDriver |
| HAL Fire & Forget | [HardwareAbstraction.ts](../electron-app/src/hal/HardwareAbstraction.ts) | 1990-1996 | void driver.sendAll() bypass |
| Buffer Management | [UniversalDMXDriver.ts](../electron-app/src/hal/drivers/UniversalDMXDriver.ts) | 85-170, 685-701, 752-758, 800-815 | initBuffer, setChannels, flushToStrategies throttle, sendAll semaphore |
| Child Process | [openDmxWorker.ts](../electron-app/src/hal/drivers/strategies/openDmxWorker.ts) | 1-450 | Serial output loop, UPDATE_BUFFER handler, hrtime pacing |
| IPC Strategy | [OpenDMXStrategy.ts](../electron-app/src/hal/drivers/strategies/OpenDMXStrategy.ts) | 1-250 | Child fork, dirty check, send via IPC |

---

## 8. NOTAS FINALES

### Por qué el child process está limpio

El child process corre en un **proceso Node.js completamente separado** (via `child_process.fork()`). No comparte memoria con el main process. El IPC (Inter-Process Communication) es un **kernel pipe del OS**, no memoria compartida. La única interacción es el `process.send('UPDATE_BUFFER')` en el main y el `process.on('message')` en el child. Ambas operaciones son **atomic** respecto al event loop de Node.js (single-threaded).

### Por qué el problema está en el coordinación main

El main process intenta escribir el buffer DMX **dos veces en el mismo frame** (renderFromTarget + sendStatesWithPhysics). Ambas llamadas invocan `sendToDriver()` que intenta enviar al child. El segundo envío compite con el semaphore del primero. El resultado es que el child recibe dos mensajes IPC en rápida sucesión, pero el segundo puede ser droppeado si llega durante una transmisión anterior.

### Axioma: Perfection First

Ambas soluciones (Merge Double-Send + Queued sendAll) requieren **cambio de arquitectura, no parches**. El tiempo que toma es mayor, pero la solución es limpia, determinista y sostenible. Esto es coherente con la **directiva PunkOpus: Perfection First**.

---

## APÉNDICE: GLOSARIO TÉCNICO

| Término | Definición |
|---------|-----------|
| **STAMPEDE GUARD** | Bandera `isProcessingFrame` que previene frames paralelos en processFrame() — WAVE 2211 |
| **FIRE & FORGET** | Llamada async (`void promise`) sin `await` — no espera resolución |
| **THROTTLE** | Límite de frecuencia via `setTimeout(fn, delay)` — coalesce rapid changes |
| **SEMAPHORE** | Bandera `isTransmitting` — only one sendAll() concurrently |
| **DIRTY CHECK** | Comparación hash (djb2) — enviar IPC solo si buffer cambió |
| **DMX512** | Estándar de protocolo: BREAK(88µs) + MAB(8µs) + 512 canales @ 250kbaud |
| **CHILD_PROCESS.FORK()** | Spawn proceso Node.js separado con V8 isolate independiente |
| **HRTIME** | `process.hrtime.bigint()` — nanosecond timer (no preemptible) |
| **SPIN-WAIT** | Busy-wait en CPU (no yield al OS scheduler) — para pacing sub-ms |

---

**Reporte compilado por:** PunkOpus (GitHub Copilot)  
**Para:** Radwulf (Arquitecto)  
**Status:** Ready for Implementation Planning

---

*Fin del Reporte Forense*
