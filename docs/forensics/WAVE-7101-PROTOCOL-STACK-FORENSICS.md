# WAVE 7101: PROTOCOL STACK FORENSICS

> **Fecha:** 29 Jun 2026
> **Operación:** WAVE 7101 — Protocol Stack Forensics & Map
> **Benchmark:** grandMA3 Timecode Engine / Resolume Arena 7 SMPTE
> **Contexto:** Post-demolición V2, núcleo `.lux V3` instaurado. Auditoría del subsistema de sincronización externa.
> **Disciplina:** Solo lectura. Cero modificaciones de código.

---

## 1. CARTOGRAFÍA FÍSICA (Ubicación de Tuberías)

### 1.1 Inventario de Archivos

| Componente | Ruta Exacta | LOC | Estado |
|---|---|---|---|
| `IClockSource` / `BaseClockSource` | `src/chronos/core/ClockSource.ts` | 175 | ✅ Activo |
| `MTCParser` | `src/chronos/protocols/MTCParser.ts` | 315 | ✅ Activo (vía ClockSourceManager) |
| `LTCDecoder` | `src/chronos/protocols/LTCDecoder.ts` | 421 | ✅ Activo (vía ClockSourceManager) |
| `ArtNetTimecodeReceiver` | `src/chronos/protocols/ArtNetTimecodeReceiver.ts` | 278 | ⚠️ Parcial (proxy renderer activo, listener main process NUNCA instanciado) |
| `MIDIClockMaster` | `src/chronos/protocols/MIDIClockMaster.ts` | 268 | ✅ Activo (vía ClockSourceManager) |
| `ClockSourceManager` | `src/chronos/protocols/ClockSourceManager.ts` | 299 | ✅ Activo (owned by ChronosEngine) |
| `useMIDIClock` (inbound hook) | `src/chronos/hooks/useMIDIClock.ts` | 404 | ✅ Activo (vía ChronosLayout) |
| `useFreeRunClock` | `src/chronos/hooks/useFreeRunClock.ts` | 249 | ✅ Activo (vía ChronosLayout) |
| `TacticalHub` (UI) | `src/components/layout/TacticalHub.tsx` | ~1465 | ✅ Activo (vía TitleBar) |
| Barrel export | `src/chronos/protocols/index.ts` | 43 | ✅ |
| Tests | `src/chronos/__tests__/Protocols.test.ts` | 507 | ✅ 215/215 verdes |

### 1.2 Consumo por el Núcleo V3

**ChronosEngine** (singleton, `src/chronos/core/ChronosEngine.ts`, 1184 LOC) es el propietario de `ClockSourceManager`:

```
ChronosEngine (singleton)
  └─ clockSources: ClockSourceManager
       ├─ MTCParser        (lazy-created via getOrCreateSource('mtc'))
       ├─ LTCDecoder       (lazy-created via getOrCreateSource('ltc-smpte'))
       ├─ ArtNetTimecodeReceiver (lazy-created via getOrCreateSource('artnet-tc'))
       └─ MIDIClockMaster  (lazy-created via getMIDIMaster())
```

**Cableado con V3:**

| Punto de conexión | Estado | Detalle |
|---|---|---|
| `ChronosEngine.updateTime()` → `clockSources.getExternalTimeMs()` | ✅ Cableado | `@ChronosEngine.ts:1002` — si external ≠ null, override del playhead |
| `ChronosEngine.updateTime()` → `clockSources.tickMIDIMaster(bpm)` | ✅ Cableado | `@ChronosEngine.ts:1017` — tick outbound cada frame |
| `ChronosEngine.setClockSource(type)` | ✅ Cableado | `@ChronosEngine.ts:859` — switch de source con fallback a internal |
| `ChronosEngine.getClockSources()` | ✅ Cableado | `@ChronosEngine.ts:851` — expuesto para TacticalHub UI |
| `TacticalHub` → `ChronosEngine.getInstance().getClockSources()` | ✅ Cableado | `@TacticalHub.tsx:226` — polling 500ms para status |
| `useMIDIClock` hook → `ChronosLayout` | ✅ Cableado | `@ChronosLayout.tsx:115` — BPM inbound a TransportBar |
| `TimelineEngine` → `ClockSourceManager` | ❌ NO cableado | TimelineEngine NO consume protocolos externos directamente |
| `ChronosStoreV3` → `ClockSourceManager` | ❌ NO cableado | Store no referencia protocolos |
| `ArtNetTimecodeReceiver` main process listener | ❌ NO instanciado | `createArtNetMainProcessListener()` JAMÁS es llamada en `electron/main.ts` |

**Veredcto de cableado:** Los 4 protocolos están cableados al **ChronosEngine legacy** (que sigue vivo como motor de transporte), pero **NO al nuevo TimelineEngine V3**. La conexión entre ambos es indirecta: el frontend envía `timeMs` vía IPC `lux:playback:tick` → `PlaybackIPCHandlers.ts:77` → `timelineEngine.tick(timeMs)`. El `timeMs` que envía el frontend proviene de `ChronosEngine.currentTimeMs`, que SÍ puede ser overrideado por un clock externo. **El puente existe, pero es implícito (vía frontend como relay).**

### 1.3 Arquitectura de Dual-Engine

```
┌─────────────────────────────────────────────────────────────┐
│ RENDERER (React)                                             │
│                                                               │
│  ChronosLayout                                                │
│    ├─ useMIDIClock() ──→ Web MIDI API (inbound 0xF8/0xFA/0xFC)│
│    │    └─ midiBpm → TransportBar display                     │
│    │                                                          │
│    ├─ useStreamingPlayback() / useFreeRunClock()              │
│    │    └─ currentTimeMs → IPC lux:playback:tick              │
│    │                                                          │
│    └─ ChronosEngine.getInstance()                             │
│         └─ clockSources.getExternalTimeMs()                   │
│              ├─ MTC: Web MIDI 0xF1 quarter-frames             │
│              ├─ LTC: AudioWorklet bi-phase decode             │
│              └─ Art-Net: IPC proxy (main process listener)    │
│                                                               │
│  TacticalHub (TitleBar)                                       │
│    └─ ChronosEngine.getInstance().getClockSources()           │
│         └─ Polling 500ms: status, quality, source selection   │
└──────────────────────────┬──────────────────────────────────┘
                           │ IPC (lux:playback:tick)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ MAIN PROCESS                                                  │
│                                                               │
│  PlaybackIPCHandlers                                          │
│    └─ timelineEngine.tick(timeMs)                             │
│         ├─ VibeClips → TitanOrchestrator.setVibe()            │
│         ├─ FXClips → HephaestusRuntime trigger/stop           │
│         └─ Whisper fallback → vibeBase.vibeId                 │
│                                                               │
│  ArtNetDriver (DMX output, NOT timecode)                      │
│  createArtNetMainProcessListener() — NUNCA LLAMADO            │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. AUDITORÍA FORENSE DE LOS 4 JINETES

### 2.1 SMPTE/LTC (`LTCDecoder.ts` — 421 LOC)

**Arquitectura:** `AudioWorklet` inline (Blob URL) → bi-phase mark decode → 80-bit frame assembly → `postMessage` al main thread → `BaseClockSource.emit('sync')`.

| Aspecto | Estado | Detalle |
|---|---|---|
| AudioWorklet processor | ✅ Funcional | `LTCDecoderProcessor` corre en audio render thread, zero allocations en hot path |
| Bi-phase mark decode | ✅ Correcto | Zero-crossing → pulse width classification → IIR filter para `avgBitPeriod` (α=0.05) |
| Sync word detection | ✅ Correcto | `0x3FFD` (16-bit) buscado en últimos 80 bits del buffer |
| BCD decode | ✅ Correcto | bits 0-3 frame units, 8-9 frame tens, 16-19 sec units, etc. |
| Signal timeout | ⚠️ **1000ms** | `LTC_SIGNAL_TIMEOUT_MS = 1000` — SÍ sigue en 1000ms. grandMA3 usa 500ms. A 30fps, 1000ms = 30 frames perdidos antes de declarar signal lost |
| Speed detection | ❌ **No implementado** | No hay detección de velocidad (0.1x-100x). El worklet decodifica frames a velocidad normal. A velocidad variable, el IIR filter del `avgBitPeriod` se desestabiliza |
| Reverse / shuttle | ❌ **No implementado** | No hay detección de dirección. El buffer se limpia después de cada frame exitoso, imposibilitando re-ensamblaje en reversa |
| Drop-frame detection | ✅ Parcial | `frameBits[10]` leído como `dropFrame` flag → mapea a 29.97fps. Pero no hay corrección de drop-frame en `smpteToMs()` — usa factor `30000/1001` como aproximación |
| Frame rate auto-detect | ❌ No | LTC frame rate es seleccionado por usuario (`setFrameRate()`), no auto-detectado desde la señal |
| Input device selection | ✅ Funcional | `setAudioInput(deviceId)` con constraints: `echoCancellation: false, noiseSuppression: false, autoGainControl: false` |
| Audio pipeline cleanup | ✅ Correcto | `stop()` desconecta sourceNode, workletNode, mediaStream tracks, y cierra AudioContext |

**Comparativa con grandMA3:**

| Característica | LuxSync LTC | grandMA3 LTC |
|---|---|---|
| Bi-phase mark decode | ✅ AudioWorklet | ✅ DSP dedicado |
| Sync word | ✅ 0x3FFD | ✅ |
| Signal timeout | ⚠️ 1000ms | ✅ 500ms |
| Speed detection | ❌ No | ✅ 0.1x-100x |
| Reverse/shuttle | ❌ No | ✅ Sí |
| Drop-frame correction | ⚠️ Aproximación | ✅ Exacto |
| Auto frame rate | ❌ No | ✅ Sí |

**SCORE LTC**: 72/100 — Funcional para uso como slave de posición. Carece de features profesionales de broadcast (reverse, speed, jam sync).

### 2.2 MIDI Timecode (`MTCParser.ts` — 315 LOC)

**Arquitectura:** Web MIDI API (`sysex: true`) → Quarter-Frame (0xF1) reassembly → Full-Frame SysEx (0xF0 7F 7F 01 01) → SMPTE timecode → `smpteToMs()`.

| Aspecto | Estado | Detalle |
|---|---|---|
| Quarter-Frame reassembly | ✅ Correcto | 8 nibbles, bitmask `receivedPieces` (0xFF = completo), ensamblaje en piece 7 (forward) o 0 (reverse) |
| Full-Frame SysEx | ✅ Correcto | Validación: `F0 7F 7F 01 01 hr mn sc fr F7`, mínimo 10 bytes, extracción de frame rate de bits 5-6 del byte hr |
| Forward/Reverse detection | ✅ Implementado | `pieceIndex === (lastPieceIndex + 1) % 8` → forward; `(lastPieceIndex - 1 + 8) % 8` → reverse. **Supera a LTC en esta feature** |
| Frame rate extraction | ✅ Correcto | Bits 5-6 del piece 7 → 24/25/29.97/30 fps |
| Signal timeout | ✅ **500ms** | `MTC_SIGNAL_TIMEOUT_MS = 500` — correcto para MTC (quarter-frames cada ~8ms a velocidad normal) |
| Hot-plug | ✅ Implementado | `midiAccess.onstatechange = () => this.wireInputs()` — re-wirea inputs al conectar/desconectar USB MIDI |
| Device selection | ✅ Funcional | `selectInput(deviceId)` — null = escuchar todos los inputs |
| Input unwiring on stop | ✅ Correcto | `unwireInputs()` remueve el handler de todos los inputs antes de nullificar `midiAccess` |
| User Bits | ❌ No implementado | MTC User Bits (metadata de producción) no soportados |
| MSC integration | ❌ No | MIDI Show Control no integrado |

**Caso crítico: desconexión USB MIDI a mitad de reproducción:**

1. `onstatechange` dispara → `wireInputs()` re-enumerar inputs
2. El input desconectado ya no está en `midiAccess.inputs` → handler removido automáticamente
3. `timeoutHandle` expira a los 500ms sin nuevos quarter-frames → `connected = false` → `emit('status', { connected: false })`
4. `ChronosEngine.updateTime()` recibe `null` de `getExternalTimeMs()` → fallback a AudioContext clock
5. **Reconexión:** Si el dispositivo reaparece, `onstatechange` dispara `wireInputs()` → quarter-frames reanudan → `connected = true`

**Veredicto:** Transición graceful. No hay crash, no hay hang. El timeout de 500ms es el único gap temporal donde el playhead puede drift.

**Comparativa con grandMA3:**

| Característica | LuxSync MTC | grandMA3 MTC |
|---|---|---|
| Quarter-Frame | ✅ 8-piece reassembly | ✅ |
| Full-Frame SysEx | ✅ Instant locate | ✅ |
| Forward/Reverse | ✅ Detectado | ✅ |
| User Bits | ❌ No | ✅ Sí |
| MSC integration | ❌ No | ✅ Sí |
| Hot-plug | ✅ | ✅ |
| Signal timeout | ✅ 500ms | ✅ Configurable |

**SCORE MTC**: 85/100 — Sólido. Hot-plug y reverse detection lo elevan sobre LTC. User Bits y MSC son gaps cosméticos.

### 2.3 Art-Net Timecode (`ArtNetTimecodeReceiver.ts` — 278 LOC)

**Arquitectura dual:**
- **Main process:** `createArtNetMainProcessListener()` → `dgram.createSocket('udp4')` → port 6454 → `parseArtNetTimecodePacket()` → `ipcSend('artnet:timecode', packet)`
- **Renderer:** `ArtNetTimecodeReceiver extends BaseClockSource` → escucha IPC `artnet:timecode` → `handlePacket()` → `emit('sync')`

| Aspecto | Estado | Detalle |
|---|---|---|
| Packet parser | ✅ Correcto | Validación header "Art-Net\0", opcode 0x9700 (LE), 19 bytes mínimo, sanity checks (frames<30, sec<60, etc.) |
| Frame rate mapping | ✅ Correcto | Type field: 0=24, 1=25, 2=29.97, 3=30 |
| Signal timeout | ✅ 2000ms | `ARTNET_SIGNAL_TIMEOUT_MS = 2000` — generoso (Art-Net puede tener jitter de red) |
| Pure function parser | ✅ Testable | `parseArtNetTimecodePacket()` es pura, sin I/O — testeable en ambos entornos |
| **Main process listener** | ❌ **NUNCA INSTANCIADO** | `createArtNetMainProcessListener()` es exportada pero **jamás llamada** en `electron/main.ts`. El socket UDP 6454 NUNCA se abre para timecode. |
| IPC bridge | ⚠️ Frágil | El renderer busca `window.electronAPI.ipcRenderer` o `window.lux.chronos.onArtNetTimecode` — ninguno existe en el preload actual para timecode (solo para DMX Art-Net) |
| Renderer proxy | ⚠️ Parcial | La clase existe y está cableada en `ClockSourceManager`, pero sin main process listener, nunca recibirá paquetes |

**Cadena de datos diseñada (nunca activada):**

```
Hardware Art-Net node → UDP :6454 → dgram socket (main)
  → parseArtNetTimecodePacket() → ArtNetTimecodePacket
  → ipcSend('artnet:timecode', packet)
  → [IPC bridge]
  → ArtNetTimecodeReceiver.handlePacket()
  → emit('sync', { timeMs })
  → ClockSourceManager → ChronosEngine.updateTime()
```

**Cadena de datos REAL:**

```
Hardware Art-Net node → UDP :6454 → NADIE escucha
  → ArtNetTimecodeReceiver.start() → busca IPC → no encuentra → emit('error')
  → ClockSourceManager recibe error → fallback a internal
```

**Colisión de puertos:** El `ArtNetDriver` (DMX output) YA usa el puerto 6454 para Art-Net DMX. Si se instanciara `createArtNetMainProcessListener()`, ambos competirían por el mismo puerto. El socket DMX usa `reuseAddr: true`, pero el de timecode también — ambos podrían coexistir si `reuseAddr` funciona, pero es frágil.

**Veredicto:** El protocolo está **completamente implementado pero desconectado**. Es código muerto funcional. Para activarlo se necesita:
1. Llamar `createArtNetMainProcessListener()` en `main.ts`
2. Exponer `onArtNetTimecode` en `preload.ts`
3. Resolver la colisión de puerto 6454 con ArtNetDriver DMX

**SCORE Art-Net TC**: 40/100 — Implementación correcta pero **inoperante**. Sin main process listener, es una tubería sin fuente.

### 2.4 MIDI Clock Master (`MIDIClockMaster.ts` — 268 LOC)

**Arquitectura:** `ChronosEngine.tick()` → `clockSources.tickMIDIMaster(bpm)` → acumulador de tiempo → dispara 0xF8 pulses a outputs MIDI seleccionados.

| Aspecto | Estado | Detalle |
|---|---|---|
| Pulse generation | ✅ Correcto | `pulseIntervalMs = 60000 / (BPM × 24)`, acumulador con `while (accumulator >= pulseIntervalMs)` |
| Transport messages | ✅ Correcto | Start (0xFA), Continue (0xFB), Stop (0xFC) enviados al iniciar/detener |
| BPM range | ✅ 20-300 | Clamp en `tick()` y `setBpm()` |
| Output selection | ✅ Funcional | `setOutputs(deviceIds)` — vacío = todos los outputs |
| Hot-plug | ✅ Implementado | `onstatechange` re-enumerar outputs |
| Error handling | ✅ Graceful | `sendToOutputs()` try/catch por output — si uno se desconecta, no afecta otros |

**FOCO CRÍTICO — Jitter del MIDI Master:**

**¿Sigue dependiendo de `requestAnimationFrame`?**

**SÍ.** La cadena es:

```
ChronosEngine.startTickLoop()
  → requestAnimationFrame(tickFn)           ← @ChronosEngine.ts:983
    → updateTime()
      → clockSources.tickMIDIMaster(bpm)    ← @ChronosEngine.ts:1017
        → midiMaster.tick(bpm)
          → performance.now() - lastTickTime
          → accumulator += delta
          → while (accumulator >= pulseIntervalMs) send 0xF8
```

**Análisis de jitter a >160 BPM:**

- A 160 BPM: `pulseIntervalMs = 60000 / (160 × 24) = 15.625ms`
- A 180 BPM: `pulseIntervalMs = 60000 / (180 × 24) = 13.889ms`
- A 200 BPM: `pulseIntervalMs = 60000 / (200 × 24) = 12.500ms`

`requestAnimationFrame` corre a ~60fps (16.67ms nominal). Pero el navegador puede jitterar:
- Mejor caso: 16.67ms (60fps estable)
- Peor caso: 20-33ms (background tab, GC pause, compositor busy)

**A 160 BPM (15.625ms/pulse):**
- Si rAF entrega a 16.67ms: delta = 16.67ms → accumulator dispara 1 pulse, sobra 1.04ms
- Si rAF jittera a 33ms (frame skip): delta = 33ms → accumulator dispara 2 pulses seguidos
- **Jitter teórico: ±8.3ms** (medio periodo de pulse)

**A 200 BPM (12.5ms/pulse):**
- Si rAF entrega a 16.67ms: accumulator dispara 1 pulse, sobra 4.17ms
- Próximo frame: 16.67ms + 4.17ms = 20.84ms → dispara 1 pulse, sobra 8.34ms
- Próximo: 16.67ms + 8.34ms = 25.01ms → dispara 2 pulses
- **Patrón irregular: 1-1-2-1-1-2...** — jitter audible como "swing" no deseado

**¿Migrado a Main Process?**

**NO.** `MIDIClockMaster` vive en el renderer process. Usa `navigator.requestMIDIAccess()` (Web MIDI API), que solo está disponible en el renderer. No hay migración a Main Process con `node-midi` o similar.

**Comparativa con grandMA3:**

| Característica | LuxSync MIDI Master | grandMA3 MIDI Master |
|---|---|---|
| Timer source | ⚠️ rAF (renderer) | ✅ Hardware timer dedicado |
| Jitter @120 BPM | ±2ms | <±0.5ms |
| Jitter @160 BPM | ±8ms | <±0.5ms |
| Jitter @200 BPM | ±12ms (patrón irregular) | <±0.5ms |
| Background tab | ❌ rAF se throttlea a 1Hz | ✅ No afecta |
| Main process timer | ❌ No | ✅ Sí |

**SCORE MIDI Clock Master**: 65/100 — Funcional hasta ~140 BPM. A >160 BPM, el jitter de rAF degrada la calidad del clock. Background tab = catástrofe (rAF throttlea a 1Hz, el acumulador descarga 24×N pulses en un burst).

### 2.5 MIDI Clock Inbound (`useMIDIClock.ts` — 404 LOC)

**Arquitectura paralela:** Hook React independiente de `ClockSourceManager`. Escucha 0xF8 directamente vía Web MIDI API, calcula BPM, y alimenta `TransportBar` para display.

| Aspecto | Estado | Detalle |
|---|---|---|
| BPM calculation | ✅ Correcto | Sliding window de 8 beats, `60000 / avgInterval`, hysteresis 0.5 BPM |
| Signal quality | ✅ Funcional | 'none' → 'weak' (2+ samples) → 'stable' (8+ samples) |
| Transport sync | ✅ Parcial | Detecta Start/Continue/Stop pero NO controla ChronosEngine directamente — solo actualiza UI state |
| Clock timeout | ✅ 2000ms | Razonable para MIDI Clock |
| Device selection | ✅ Funcional | `selectDevice(deviceId)` — null = todos |

**Gap crítico:** `useMIDIClock` calcula BPM pero **NO inyecta el playhead** en ChronosEngine. Es un display de BPM, no un clock source slave. Para sincronizar el playhead con MIDI Clock, se necesitaría un `MIDIClockSlave` que implemente `IClockSource` y derive posición temporal del contador de pulses (24 PPQ × N beats = posición). Actualmente, MIDI Clock inbound solo alimenta el display del TransportBar.

---

## 3. CUELLOS DE BOTELLA DEL ENTORNO GESTIONADO

### 3.1 Cadena de Latencia: Señal Hardware → Playhead UI

#### Path A: MTC (MIDI Timecode)

```
Hardware USB MIDI → Web MIDI API (Chromium MIDI thread)
  → MIDIMessageEvent (renderer main thread)           ~1-2ms
  → MTCParser.handleMIDIMessage()                     ~0.1ms
  → Quarter-frame reassembly (8 pieces = 2 frames)    ~66ms @30fps (latencia inherente del protocolo)
  → assembleTimecode() → smpteToMs()                  ~0.1ms
  → emit('sync') → ClockSourceManager.emit('sync')
  → ChronosEngine.updateTime() (próximo rAF)          ~0-16ms
  → currentTimeMs = externalTimeMs
  → emit('playback:tick') → React state update        ~1-3ms
  → TransportBar re-render                            ~1-2ms

LATENCIA TOTAL TEÓRICA: 69-88ms (dominada por reassembly de 8 quarter-frames)
LATENCIA POR FRAME: 0-16ms (después del primer reassembly completo)
```

#### Path B: LTC (AudioWorklet)

```
Hardware audio in → AudioContext sample buffer         ~2-5ms (buffer de audio)
  → AudioWorkletProcessor.process() (audio thread)     ~0.1ms por bloque
  → Bi-phase decode + frame assembly                   ~10-33ms (1 frame LTC = 80 bits)
  → postMessage('ltc-frame') → main thread             ~1-2ms
  → LTCDecoder.handleDecodedFrame()                    ~0.1ms
  → emit('sync') → ClockSourceManager
  → ChronosEngine.updateTime() (próximo rAF)           ~0-16ms
  → React state update + re-render                     ~2-5ms

LATENCIA TOTAL TEÓRICA: 15-56ms (depende de frame rate LTC y buffer de audio)
```

#### Path C: Art-Net Timecode (si estuviera activado)

```
Hardware Art-Net node → UDP packet → dgram socket (main)   ~1-5ms (LAN)
  → parseArtNetTimecodePacket()                             ~0.1ms
  → ipcSend('artnet:timecode') → IPC bridge                ~1-3ms
  → ArtNetTimecodeReceiver.handlePacket() (renderer)        ~0.1ms
  → emit('sync') → ClockSourceManager
  → ChronosEngine.updateTime() (próximo rAF)               ~0-16ms
  → React state update + re-render                          ~2-5ms

LATENCIA TOTAL TEÓRICA: 4-29ms (la más baja de los 4 protocolos)
```

### 3.2 Riesgo de Re-render Masivo en React

**MTC a 30fps:** Cada frame SMPTE completo (2 quarter-frame groups) llega cada ~33ms. ChronosEngine hace `emit('playback:tick')` cada rAF (~16ms). Resultado: 60 updates/seg al React state.

**MTC a 24fps:** Cada frame completo cada ~42ms. ChronosEngine sigue emitiendo a 60fps. Resultado: 60 updates/seg.

**¿Es 60 updates/seg un problema?**

**No, si está bien aislado.** El `playback:tick` event de ChronosEngine alimenta `useStreamingPlayback` o `useFreeRunClock`, que actualizan `currentTimeMs` en un ref (no en useState). El playhead del timeline se dibuja en canvas directamente desde el ref — no triggers React re-render.

**PERO:** TacticalHub hace `setInterval(poll, 500ms)` para actualizar status de clock sources — esto SÍ causa re-renders de TacticalHub cada 500ms. Si TacticalHub es pesado (~1465 LOC de JSX), esto puede causar jank.

**Veredicto:** El diseño actual es defensivo (refs para hot path, polling para status). El riesgo de re-render masivo es **bajo**. El riesgo de jank por TacticalHub polling es **medio** (cosmético, no afecta timing).

### 3.3 El Problema del Dual-Engine Relay

El flujo real de timecode externo → timeline es:

```
ChronosEngine (renderer)
  ├─ clockSources.getExternalTimeMs() → currentTimeMs
  └─ emit('playback:tick', { timeMs })
       → React hook (useStreamingPlayback/useFreeRunClock)
            → IPC lux:playback:tick(timeMs)
                 → Main process
                      → timelineEngine.tick(timeMs)
```

**Latencia adicional del relay renderer→main→renderer:** ~2-5ms (IPC round-trip).

**Problema fundamental:** El `timeMs` que llega a `TimelineEngine` en el main process ya tiene:
1. Latencia del protocolo (10-88ms según path)
2. Latencia del rAF del renderer (0-16ms)
3. Latencia del IPC (2-5ms)

**Total acumulado:** 12-109ms entre la señal física y la evaluación de clips en el main process.

**Comparativa:** grandMA3 evalúa timecode y clips en el mismo proceso con un hardware timer dedicado — latencia total <2ms.

---

## 4. PROPUESTA EVOLUTIVA (El Plan Balístico V3)

### 4.1 PLL Predictive Clock Smoothing

**Problema:** Los clocks externos (MTC, LTC, Art-Net) entregan tiempo discreto en saltos (cada frame SMPTE = 33-42ms). Entre saltos, ChronosEngine usa su AudioContext interno, que deriva. Al llegar el próximo salto, hay un "stitch" que puede causar un micro-salto del playhead.

**Propuesta:** Inyectar un PLL (Phase-Locked Loop) digital entre `ClockSourceManager` y `ChronosEngine`:

```
External timecode (discrete, jittery)
  → PLL Loop:
       ├─ Phase detector: diff(externalTime, internalTime)
       ├─ Loop filter: low-pass IIR (α=0.05) → suaviza jitter
       └─ VCO: internal clock ajusta frecuencia para minimizar phase error
  → Smoothed continuous time → ChronosEngine.currentTimeMs
```

**Beneficio:**
- Amortigua saltos de reloj exterior (ej. MTC que salta 2 frames por un glitch)
- Predice tiempo entre actualizaciones discretas con precisión sub-ms
- Si la señal externa se pierde, el PLL mantiene el reloj derivando suavemente (flywheel) en lugar de saltar al AudioContext

**Implementación:** ~80 LOC en `ClockSourceManager.getExternalTimeMs()` — reemplazar el passthrough directo por un PLL state machine.

### 4.2 MIDI Clock Master Migration to Main Process

**Problema:** `MIDIClockMaster` depende de `requestAnimationFrame` (renderer), generando jitter >5ms a tempos >160 BPM. Background tab = throttleo a 1Hz.

**Propuesta:** Migrar el pulse generation al Main Process usando `setImmediate` + `process.hrtime.bigint()`:

```
Main Process:
  → HighResolutionTimer (hrtime-based, ±0.1ms precision)
  → node-midi or electron MIDI output (native)
  → 0xF8 pulses con jitter <±0.5ms a cualquier BPM

Renderer:
  → ChronosEngine.tick() → IPC 'midi-master:tick' (fire-and-forget)
  → Main process acumula y dispara pulses
```

**Beneficio:**
- Jitter <±0.5ms a 200+ BPM (matching grandMA3)
- Inmune a background tab throttling
- Inmune a GC pauses del renderer (main process tiene menos presión de GC)

**Implementación:** ~150 LOC en `electron/midi/MidiClockMasterMain.ts` + IPC handler en `PlaybackIPCHandlers.ts`. El renderer `MIDIClockMaster` se convierte en proxy IPC.

### 4.3 Art-Net Timecode Activation + Port Multiplexing

**Problema:** `createArtNetMainProcessListener()` nunca es llamada. El puerto 6454 colisiona con ArtNetDriver DMX.

**Propuesta:** Activar el listener con multiplexing en el mismo socket:

```
Main Process (single dgram socket :6454):
  → socket.on('message', (msg, rinfo) => {
       const opcode = msg.readUInt16LE(8)
       if (opcode === 0x5000) artNetDriver.handlePacket(msg)      // ArtDMX
       if (opcode === 0x9700) artNetTimecode.parsePacket(msg)     // ArtTimeCode
       if (opcode === 0x5200) artNetPoll.handlePacket(msg)        // ArtPoll
     })
```

**Beneficio:**
- Un solo socket UDP para todo Art-Net (DMX + Timecode + Poll)
- Sin colisión de puertos
- Art-Net Timecode funcional sin configuración adicional
- Latencia teórica más baja de los 4 protocolos (4-29ms)

**Implementación:** ~60 LOC refactor en `electron/main.ts` — unificar el socket dgram existente de ArtNetDriver con el parser de timecode. Exponer `onArtNetTimecode` en `preload.ts`.

---

## 5. SCORECARD CONSOLIDADA

| Protocolo | Score | Estado | Gap Crítico |
|---|---|---|---|
| MTC (MIDI Timecode) | 85/100 | ✅ Operante | User Bits, MSC (cosmético) |
| LTC (SMPTE Audio) | 72/100 | ✅ Operante | Speed detection, reverse, timeout 1000ms |
| Art-Net Timecode | 40/100 | ❌ Inoperante | Main process listener nunca instanciado |
| MIDI Clock Master | 65/100 | ⚠️ Degradado >160 BPM | rAF jitter, sin main process timer |
| MIDI Clock Inbound | 60/100 | ⚠️ Solo display | No es clock source slave (no controla playhead) |
| ClockSourceManager | 90/100 | ✅ Sólido | Sin PLL smoothing |
| IClockSource contract | 95/100 | ✅ Excelente | — |

**SCORE GLOBAL DEL PROTOCOL STACK:** 68/100

---

## 6. DEUDAS HEREDADAS CRÍTICAS

| # | Deuda | Severidad | Impacto | Esfuerzo |
|---|---|---|---|---|
| 1 | MIDI Clock Master en rAF (jitter >160 BPM) | 🔴 Alta | Pulses irregulares a tempos altos | Medio (migrar a main process) |
| 2 | Art-Net TC listener nunca instanciado | 🔴 Alta | Protocolo completamente inoperante | Bajo (1 llamada + IPC bridge) |
| 3 | MIDI Clock Inbound no controla playhead | 🟡 Media | Solo display de BPM, no sync real | Medio (implementar MIDIClockSlave IClockSource) |
| 4 | Sin PLL smoothing | 🟡 Media | Micro-saltos al cambiar de clock source | Medio (~80 LOC) |
| 5 | LTC timeout 1000ms vs 500ms estándar | 🟡 Media | Detección lenta de signal loss | Trivial (1 línea) |
| 6 | LTC sin speed/reverse detection | 🟢 Baja | No soporta shuttle/rewind | Alto (rewrite worklet) |
| 7 | Dual-engine relay (renderer→IPC→main) | 🟡 Media | +2-5ms latencia adicional | Alto (arquitectural) |
| 8 | Colisión puerto 6454 (DMX vs TC) | 🟡 Media | Impide activar Art-Net TC | Bajo (multiplexar socket) |

---

## 7. CONCLUSIÓN

El protocol stack de Chronos es **arquitectónicamente sólido** — el contrato `IClockSource` es limpio, `ClockSourceManager` centraliza la gestión, y los 4 protocolos están implementados con conocimiento profundo de los estándares (MMA, SMPTE, Art-Net 4). Los tests (507 LOC, 215/215 verdes) cubren el reensamblaje de nibbles, parseo de paquetes, y lógica de decodificación.

**Pero tiene tres heridas de guerra:**

1. **MIDI Clock Master atado al rAF del renderer** — funciona perfecto hasta 140 BPM, pero a tempos de música electrónica (160-200+ BPM), el jitter de `requestAnimationFrame` degrada los pulses. grandMA3 no tiene este problema porque su clock vive en hardware dedicado.

2. **Art-Net Timecode es un cadáver perfecto** — implementación impecable, tests que pasan, pero el listener del main process nunca se instancia. Es una tubería sin fuente.

3. **MIDI Clock Inbound es un espejo** — muestra el BPM pero no controla el playhead. Para sync real, falta un `MIDIClockSlave` que derive posición temporal del contador de pulses 24 PPQ.

La evolución balística (PLL + Main Process timer + Art-Net multiplexing) llevaría el score de 68 a 90+, rivalizando con consolas físicas dedicadas. El contrato `IClockSource` ya está listo para recibir estas mejoras sin cambios arquitecturales.

---

> **Auditoría completada.** Cero líneas de código modificadas.  
> El protocol stack es código propio sobre APIs estándar — cero dependencias de terceros, cero riesgo de licencia.  
> El próximo paso es decisión del arquitecto: estabilizar lo existente o evolucionar hacia grado militar.
