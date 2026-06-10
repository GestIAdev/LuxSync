# WAVE 6018 — Aether Glass / HAL / Driver Audit Report
**Fecha:** 2025-06-09 (post-debug físico IMC UD 7S)
**Auditor:** Cascade (pair-programming)
**Destinatario:** Arquitecto de Sistemas (export-ready)

---

## TL;DR Ejecutivo

La migración a **Aether Glass** (SharedArrayBuffer / SAB) rompió la precisión de timing del output físico DMX. El `OpenDMXStrategy` fue movido al **Main Process** de Electron, donde el **Event Loop** y la **resolución de `setTimeout` en Windows (~15.6ms)** destruyen la señal eléctrica BREAK/MAB que los fixtures físicos necesitan para interpretar un frame válido. Además, el worker de alta precisión (`openDmxWorker.ts`) quedó **huérfano** y **ArtNet** quedó **desconectado del SAB**.

**Estado físico actual (post-parche):** los fixtures ENCENDEN pero parpadean/erran de color porque el baudrate-switch anidado en `setTimeout` de 1ms tiene jitter de ±15ms en Windows, desplazando canales DMX.

---

## 1. Flujo de Datos Aether Glass (Estado Actual)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TICK ENGINE (Main Process — 44Hz)                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────────┐  │
│  │ NodeArbiter  │───▶│ NodeResolver │───▶│ _universeSnapshots (Map)     │  │
│  └──────────────┘    └──────────────┘    └──────────────────────────────┘  │
│                                                    │                        │
│                                                    ▼                        │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │ dmxWriter.commitFrame(frameId, uniList, dirtyMask)          │           │
│  │   → Escribe en SharedArrayBuffer (DMX_UNIVERSE_SAB)       │           │
│  └─────────────────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ SAB (zero-copy)
┌─────────────────────────────────────────────────────────────────────────────┐
│  OPEN DMX STRATEGY (Main Process — 30Hz setInterval)                       │
│  ┌─────────────────┐    ┌──────────────────────────────────────────────┐  │
│  │ DmxUniverseReader│───▶│ reader.readCoherent(lastFrameId)            │  │
│  └─────────────────┘    │   → snapshot Uint8Array(512)                 │  │
│                         └──────────────────────────────────────────────┘  │
│                                                    │                        │
│                         ┌──────────────────────────▼──────────────┐         │
│                         │ Bit-banging: baudrate-switch BREAK    │         │
│                         │   1. port.update(76923 baud)          │         │
│                         │   2. port.write(0x00)                 │         │
│                         │   3. port.drain()                     │         │
│                         │   4. port.update(250000 baud)           │         │
│                         │   5. setTimeout(1ms) ← MAB            │         │
│                         │   6. port.write(513b DMX frame)       │         │
│                         └─────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Hallazgo Crítico: El HAL Legacy está desconectado del Aether

```
Legacy path (WAVE < 4592):  TickEngine → HAL.sendUniverseRaw() → USBDMXDriverAdapter → UniversalDMXDriver → SerialPort
Aether path (WAVE 6010):   TickEngine → SAB.commitFrame()      → OpenDMXStrategy.readCoherent() → SerialPort
```

El `HardwareAbstraction.ts` (`HAL`) y el `UniversalDMXDriver` **ya no reciben datos del pipeline Aether**. Su `sendUniverseRaw()` es un **código muerto** para fixtures registrados en el `NodeGraph`. Solo sirve para fixtures legacy no migrados a Aether.

---

## 2. La Barrera de los 33Hz — Origen y Consecuencias

### Origen
Las interfaces chinas (IMC UD 7S, clones FTDI/CH340/PL2303) **no tienen microcontrolador embebido** que gestione el frame DMX. Dependen de que el PC genere la señal eléctrica bit-a-bit (bit-banging) a través del chip USB-Serial.

- **BREAK** = línea TX bajada durante ≥88µs
- **MAB** = Mark After Break = ≥8µs a nivel alto
- **Frame DMX** = 513 bytes a 250,000 baud (~22.6ms de transmisión pura)

**Tiempo mínimo de un frame válido:** ~23ms → **máximo teórico: ~43Hz**. En la práctica, los chips chinos se saturan a partir de **33-35Hz** (buffer interno del chip o del driver Windows).

### Consecuencia actual
El `TickEngine` genera datos a **44Hz** (22.7ms). El `OpenDMXStrategy` intenta leer y enviar a **30Hz** (33ms) con un `setInterval`. El problema: si el `TickEngine` escribe dos veces en el SAB entre lecturas del driver, el driver solo ve el último frame (no es grave). El problema REAL es que el **bit-banging ejecutado en el Main Process** compite con:

1. **V8 Garbage Collector** (puede pausar 5-20ms)
2. **Chromium compositor** (event loop de Electron)
3. **Timers de Windows** (resolución mínima ~15.6ms, a veces 1ms si hay otro timer alto-resolución corriendo, pero inconsistente)
4. **IPC del renderer** (MessagePort del Glass Bridge)

Resultado: el BREAK/MAB no mide 130µs + 20µs, sino que puede variar entre **1ms y 16ms** dependiendo del scheduler. Los fixtures interpretan mal la señal, pierden sincronía de frame, y los canales se desplazan.

---

## 3. Estado de los Workers DMX

### `openDmxWorker.ts` (WAVE 2021.5) — EL VERDADERO MOTOR, ABANDONADO
**Ubicación:** `src/hal/drivers/strategies/openDmxWorker.ts`

Este archivo contiene la implementación **más avanzada** de output DMX que existe en la codebase:

| Feature | `openDmxWorker.ts` | `OpenDMXStrategy.ts` actual |
|---------|-------------------|----------------------------|
| Aislamiento de proceso | `child_process.fork()` (V8 isolate propio) | Main Process (comparte GC con Chromium) |
| Prioridad OS | `os.setPriority(PRIORITY_HIGHEST)` | Normal (default Node/Electron) |
| Timing BREAK | `spinWaitNs(BREAK_NS)` — busy-wait de 110µs exactos | `setTimeout(1ms)` — jitter ±15ms |
| Timing MAB | `spinWaitNs(MAB_NS)` — 20µs exactos | `setTimeout(1ms)` — jitter ±15ms |
| Cadencia frame | `process.hrtime.bigint()` + adaptive pacing | `setInterval(33ms)` |
| Overlap detect | Sí ( `_overlapCount`, `_overlapPeakMs` ) | No |
| Starvation detect | Sí ( `_PHANTOM_STARVATION_MS` = 40ms ) | No |
| Jitter guard | Timestamp del último `UPDATE_BUFFER` | No |
| Baudrate-switch | Sí (mismo algoritmo que QLC+/Freestyler) | Sí (ahora copiado) |
| `port.set({brk})` | Sí (fallback) | No (eliminado) |
| Conexión a SAB | **NO** — recibe datos vía IPC `UPDATE_BUFFER` | **SÍ** — lee SAB directo |

**Veredicto:** `openDmxWorker.ts` está **muerto en el código**. Nadie lo invoca. La arquitectura WAVE 6012 decidió mover todo al Main Process para evitar problemas de `worker_threads` con addons nativos de `serialport`.

### `dmxPhantomWorker.ts` (WAVE 6010) — GHOST WORKER
**Ubicación:** `src/hal/drivers/strategies/dmxPhantomWorker.ts`

- Es un `worker_thread` (no child_process).
- Lee del SAB (`DmxUniverseReader`).
- Tiene VID/PID database para auto-detectar puertos.
- **NO genera BREAK**. Simplemente hace `port.write(Buffer.from(frame.data.subarray(0, 512)))`.
- **NO está instanciado por nadie**. El `README.md` de Glass lo menciona pero no hay `new Worker('./dmxPhantomWorker')` en ningún archivo.

**Veredicto:** Código muerto / placeholder. No debe usarse en producción porque envía frames sin BREAK.

---

## 4. Drivers HAL — Obsoletos vs Core

### Mapa de Drivers (Auditoría de Archivos)

```
src/hal/drivers/
├── DMXDriver.interface.ts      ✅ CONTRATO VIGENTE (IDMXDriver)
├── MockDriver.ts               ✅ VIGENTE (testing / dev sin hardware)
├── ArtNetDriver.ts             ⚠️ VIGENTE PERO DESCONectado del SAB
├── ArtNetDriverAdapter.ts      ⚠️ VIGENTE PERO DESCONectado del SAB
├── CompositeDMXDriver.ts       ⚠️ VIGENTE PERO DESCONectado del SAB
├── USBDMXDriverAdapter.ts      ⚠️ VIGENTE PERO DESCONectado del pipeline Aether
├── UniversalDMXDriver.ts       ⚠️ VIGENTE PERO solo para legacy / no-Aether
├── ArtNetDiscovery.ts          ❓ Desconocido (no auditado en este WAVE)
└── strategies/
    ├── DMXSendStrategy.ts      ✅ CONTRATO VIGENTE
    ├── EnttecProStrategy.ts    ❓ No auditado (driver-managed, probablemente OK)
    ├── OpenDMXStrategy.ts      🔥 CORE ACTUAL (Main Process Direct I/O)
    ├── openDmxWorker.ts        💀 ABANDONADO (pero contiene la solución correcta)
    └── dmxPhantomWorker.ts     💀 GHOST (sin BREAK, no instanciado)
```

### Driver: `ArtNetDriver` — Olvidado en Glass

**Problema:** `ArtNetDriver` y `ArtNetDriverAdapter` implementan la interfaz `IDMXDriver`, pero el pipeline Aether **nunca llama** `hal.sendUniverseRaw()` ni `driver.sendUniverse()`. En su lugar, escribe al SAB.

**Resultado:** Si un usuario conecta una interfaz Art-Net (IMC Pro H1, node en red, etc.), el sistema detecta el driver, se conecta, pero **nunca recibe datos DMX del pipeline Aether** porque:
1. El `TickEngine` llama `dmxWriter.commitFrame()` al SAB.
2. El `OpenDMXStrategy` lee del SAB y envía por USB.
3. El `ArtNetDriver` nunca lee del SAB. Solo recibe datos si el HAL legacy le hace `send()` o `sendUniverse()`, lo cual no ocurre para fixtures Aether.

**Código del HAL:** `case 'artnet': return new MockDMXDriver({ debug: false })` — el HAL literalmente devuelve **Mock** si se pide ArtNet (!!!).

---

## 5. Causa Raíz del Bug Físico (Fix aplicado = dd182a15)

### Secuencia del desastre (pre-fix)

1. **Migración WAVE 6012:** Mover `OpenDMXStrategy` al Main Process, eliminar worker.
2. **Olvido del BREAK:** Quien migró pensó que `Buffer.alloc(513)` con `buf[0]=0x00` era suficiente. No se implementó bit-banging BREAK/MAB.
3. **Los fixtures físicos no interpretan el frame** porque la señal eléctrica no tiene el pulso de sincronía BREAK. El fixture queda esperando un frame válido para siempre.
4. **Nosotros aplicamos el fix:** inyectar baudrate-switch BREAK en `OpenDMXStrategy.ts` (commit dd182a15).
5. **Resultado parcial:** los fixtures encienden, pero el timing es errático porque los `setTimeout` anidados del Main Process tienen jitter.

### Por qué `openDmxWorker.ts` era la solución correcta

El worker tenía:
- **Proceso dedicado** con `PRIORITY_HIGHEST` → Windows le da CPU antes que a Chromium.
- **Busy-wait exacto** (`while (hrtime < end) {}`) → BREAK dura exactamente 110µs, ni 105 ni 120.
- **Sin Event Loop contention** → el `setImmediate` del worker solo atiende el output loop y mensajes IPC.

### Por qué no podemos simplemente "volver al worker" con IPC tradicional

El propósito de Glass era eliminar el IPC de 513 bytes × 30Hz = ~15KB/s. Con SAB, el worker puede leer directamente de memoria compartida sin IPC. La solución correcta es:

> **Resucitar el `openDmxWorker.ts` pero en lugar de recibir `UPDATE_BUFFER` por IPC, le pasamos el `SharedArrayBuffer` una sola vez en el `fork()` vía `workerData.sab`.**

Esto mantiene:
- **Zero-copy** (cero IPC de datos)
- **Timing atómico** (busy-wait en proceso dedicado)
- **Aislamiento de crashes** (si el addon nativo de serialport falla, no tumba Electron)

---

## 6. Recomendaciones Arquitectónicas (Para el Plan)

### R1: Worker DMX con SAB (Alta Prioridad)
- Convertir `openDmxWorker.ts` de `child_process` a un worker que acepte `workerData.sab`.
- Mover el bit-banging baudrate-switch del Main Process al worker.
- El `OpenDMXStrategy` en Main Process solo hace `fork()` y mantiene el `DmxUniverseReader` en el worker.
- **Beneficio:** se elimina el jitter de 15ms. Los fixtures reciben frames estables.

### R2: ArtNet SAB Bridge (Media Prioridad)
- Crear un `ArtNetSABReader` (similar a `DmxUniverseReader`) que lea del SAB.
- Ejecutar en un `setInterval` independiente a ~40Hz (ArtNet soporta 44Hz nativamente, es UDP).
- **Beneficio:** ArtNet vuelve a funcionar con Aether Glass.

### R3: Deprecar / Eliminar Código Muerto
- `dmxPhantomWorker.ts` → eliminar (sin BREAK, no instanciado).
- `HardwareAbstraction.sendUniverseRaw()` → marcar como `@deprecated` para pipeline legacy; no eliminar todavía porque fixtures no-Aether aún lo usan.
- `UniversalDMXDriver.sendAll()` con strategies → revisar si aún necesita existir o puede ser un simple proxy al SAB.

### R4: Throttle de 44Hz → 33Hz para Open DMX
- El `TickEngine` debe respetar la velocidad máxima del hardware físico.
- Opción A: `NodeResolver` escribe en SAB a 44Hz, pero el worker DMX lee a 33Hz (skip de frames).
- Opción B: `AetherSafetyMiddleware` throttles la escritura al SAB para universos conectados a OpenDMX a 33Hz.
- **Nota:** Enttec Pro y ArtNet SÍ pueden ir a 44Hz. El throttle debe ser **por estrategia/universo**, no global.

### R5: Unificación de Estrategias
- Actualmente hay **tres** estrategias OpenDMX:
  1. `OpenDMXStrategy.ts` (Main Process Direct) — la que estamos usando
  2. `openDmxWorker.ts` (child_process fork) — abandonado, pero mejor
  3. `dmxPhantomWorker.ts` (worker_thread) — fantasma, sin BREAK
- Consolidar en **una sola** estrategia que use `child_process` + SAB.

---

## 7. Métricas y Logs Clave para Validación

Los siguientes logs deben aparecer en un sistema sano:

```
[openDmxWorker] Output loop started — hrtime pacing, setImmediate scheduling
[openDmxWorker] 🔧 BREAK mode: baudrate
[openDmxWorker] [CARDIOGRAMA WORKER] 🫠 heartbeat — peak:33.4ms (last 5s)
[NodeResolver] commitFrame → frameId=12345, dirtyMask=0x1
[DmxUniverseReader] readCoherent → new frame 12345 (no tearing)
```

Los siguientes logs indican **problema**:

```
[OpenDMX 🩺] frameId=... maxVal=255@ch22  ← Si el maxVal cambia cada 2s sin razón = jitter
[UniversalDMX] 🔄 Output flush: reactive mode (selfManaged strategies)  ← Indica que el driver
                                                                              legacy está idle
[NodeResolver 🚨 SILENT-BLACKOUT?] ... gateOpen=false  ← Smart Gate bloqueando output
```

---

## 8. Resumen Visual: Estado de Conexión

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   TickEngine    │────▶│  DMX_UNIVERSE_SAB │────▶│  OpenDMXStrategy    │
│   (44Hz)        │     │  (SharedArray)   │     │  (Main Process)     │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
         │                                                 │
         │ (legacy, no-Aether)                           │ (Aether pipeline)
         ▼                                                 ▼
┌─────────────────┐                              ┌──────────────┐
│  HAL (legacy)   │                              │  SerialPort  │
│  sendUniverseRaw│                              │  (USB COM5)  │
└─────────────────┘                              └──────────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│ USBDMXDriverAdapter│─▶│ UniversalDMXDriver│
└─────────────────┘     └──────────────────┘
                              │
                              ▼
                        ┌──────────────┐
                        │  OpenDMX     │
                        │  Strategy    │
                        │  (selfManaged)│
                        └──────────────┘
                              │
                              ▼ (ESTO YA NO SE USA para Aether)
                        ┌──────────────┐
                        │  openDmxWorker│  ← MUERTO pero era el bueno
                        │  (child_process)
                        └──────────────┘

┌─────────────────┐
│  ArtNetDriver    │  ← VIVO pero NADIE le da datos del SAB
│  (UDP 6454)      │
└─────────────────┘
```

---

*Fin del informe. Listo para discusión de plan de acción con el arquitecto.*
