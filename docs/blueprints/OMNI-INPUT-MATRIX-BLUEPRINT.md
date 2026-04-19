# WAVE 3400 -- OMNI-INPUT MATRIX BLUEPRINT

> **Autor**: PunkOpus  
> **Wave**: 3400  
> **Fecha**: 2026-04-19  
> **Estado**: Blueprint Aprobado -- Zero Codigo de Produccion  
> **Axioma**: Perfection First -- Sin parches, sin hacks, sin simulaciones  
> **Premisa**: LuxSync sera el motor de iluminacion mas agnostico del mercado

---

## 0. RESUMEN EJECUTIVO

Este blueprint define la arquitectura para desacoplar completamente a Selene IA y al GodEarFFT del hardware fisico de captura de audio. Actualmente, LuxSync esta atado a la Web Audio API del renderer Electron (useAudioCapture.ts) con getDisplayMedia/getUserMedia como unicas fuentes. Esto es un cuello de botella existencial.

La solucion: un **Bus de Datos Centralizado** (el Omni-Input Matrix) que abstrae TODA fuente de audio detras de una interfaz unica. Tres modulos de entrada convergen en un punto singular antes de alimentar al GodEarFFT. La IA nunca sabe ni le importa de donde viene el audio.

**Los Tres Pilares:**

| Pilar | Nombre | Dominio | Latencia Target |
|---|---|---|---|
| 1 | VIRTUAL WIRE | Audio interno (VB-Cable, BlackHole, JACK) | < 3ms |
| 2 | USB DIRECTLINK | Consolas digitales USB Class Compliant/ASIO | < 5ms |
| 3 | OSC NEXUS | Open Sound Control via red UDP | < 8ms |

**Presupuesto temporal inviolable:** El ciclo DMX actual opera a 25fps (40ms/frame). El render pipeline completo (GodEarFFT + LiquidEngine + Arbiter + HAL) consume ~15ms. Quedan ~25ms para DMX write via FTDI. El Omni-Input Matrix NO puede consumir mas de **2ms adicionales** sobre el path critico.

---

## 1. DIAGNOSTICO DEL ESTADO ACTUAL

### 1.1 Pipeline de Audio Actual (Pre-WAVE 3400)

```
[RENDERER PROCESS]                    [MAIN PROCESS]
                                      
getUserMedia() ──┐                    
getDisplayMedia()┼─> AudioContext ─> AnalyserNode ─> processFrame()
                 │   (44100Hz)        (FFT 2048)     @ 60fps (16ms)
                 │                                        │
                 │                    ┌───────────────────┘
                 │                    v
                 │            lux:audio-frame (JSON, 60fps)
                 │            lux:audio-buffer (Uint8Array, 20fps)
                 │                    │
                 │                    v
                 │           [ALPHA - TrinityOrchestrator]
                 │                    │
                 │           AUDIO_BUFFER (postMessage, 20fps)
                 │                    │
                 │                    v
                 │           [BETA - Senses Worker]
                 │            GodEarFFT.analyze()
                 │            Ring Buffer 4096 samples
                 │            Cooley-Tukey Radix-2 DIT
                 │            7 bandas LR4 (24dB/oct)
                 │            AGC per-band
                 │            ~0.8-1.5ms latencia FFT
                 │                    │
                 │           AUDIO_ANALYSIS (postMessage, ~10fps)
                 │                    │
                 │                    v
                 │           [ALPHA] ─> TitanOrchestrator.processFrame()
                 │                      @ 25fps (40ms interval)
                 │                      │
                 │                      v
                 │                   LiquidEngine.applyBands()
                 │                   6 Envelopes (Oceano/Franco/Coro/...)
                 │                      │
                 │                      v
                 │                   MasterArbiter.arbitrate()
                 │                   5 Layers (HTP/LTP merge)
                 │                      │
                 │                      v
                 │                   HAL.renderFromTarget()
                 │                   sendToDriver() ─> DMX512 FTDI
```

### 1.2 Problemas Identificados

| # | Problema | Severidad | Impacto |
|---|---|---|---|
| P1 | **Acoplamiento duro a Web Audio API**: useAudioCapture.ts usa AnalyserNode directamente | CRITICO | Imposible usar fuentes no-browser |
| P2 | **getDisplayMedia comprime audio**: El mezclador del SO aplica Loudness Normalization (LUFS -14 en Windows, -16 en macOS) | ALTO | Transitorios de bombo aplastados, GodEar AGC compensa pero pierde dinamica real |
| P3 | **No hay canal USB nativo**: Electron no tiene acceso a ASIO/WASAPI exclusive | ALTO | Consolas digitales requieren drivers extra |
| P4 | **No existe comunicacion OSC**: LuxSync opera en silo, no habla con VJing ni otros motores | MEDIO | Mercado de integracion cerrado |
| P5 | **IPC de audio buffer usa Structured Clone**: Array copy de renderer a main (~2ms para 4KB @ 20fps) | MEDIO | Latencia evitable con SharedArrayBuffer |
| P6 | **Single source**: Solo una fuente de audio activa a la vez. Sin fallback chain | MEDIO | Si el sistema pierde audio, oscuridad total |

### 1.3 Metricas de Referencia del Pipeline Actual

```
Constantes verificadas en codigo:

FFT_SIZE            = 4096            (GodEarFFT.ts)
SAMPLE_RATE         = 44100 Hz        (forzado WAVE 2116)
BIN_RESOLUTION      = 10.77 Hz/bin    
FFT_LATENCY         = 0.8-1.5ms       (medido)
MAIN_LOOP           = 40ms (25fps)     (TitanOrchestrator)
HOT_FRAME_DIVIDER   = 2               (22Hz broadcasts)
TRUTH_DIVIDER       = 6               (~7Hz UI truth)
AUDIO_FRAME_RATE    = 60fps (16ms)     (useAudioCapture)
BUFFER_SEND_RATE    = 20fps (50ms)     (useAudioCapture)
RING_BUFFER_SIZE    = 4096 samples     (senses.ts)
DMX_FRAME_BUDGET    = ~25ms            (DMX512 spec)
TOTAL_FRAME_BUDGET  = 40ms            
COMPUTE_BUDGET      = ~15ms            (FFT+Engine+Arbiter+HAL)
HEADROOM            = ~25ms            (DMX write + safety)
```

---

## 2. ARQUITECTURA OMNI-INPUT MATRIX

### 2.1 Diagrama de Flujo General -- La Catedral

```
                     ┌─────────────────────────────────────────────────────────┐
                     │              OMNI-INPUT MATRIX (Main Process)           │
                     │                                                         │
  ┌──────────┐       │  ┌──────────────┐                                       │
  │ VB-Cable │───────│─>│ VIRTUAL WIRE │──┐                                    │
  │ BlackHole│       │  │  (loopback)  │  │                                    │
  │ JACK     │       │  └──────────────┘  │    ┌──────────────────────┐        │
  └──────────┘       │                    │    │                      │        │
                     │                    ├───>│  INPUT ARBITER       │        │
  ┌──────────┐       │  ┌──────────────┐  │    │  (Source Selection   │        │
  │ Consola  │───────│─>│ USB DIRECT   │──┤    │   + Priority Chain  │        │
  │ USB/ASIO │       │  │  LINK        │  │    │   + Auto-Gain)      │        │
  └──────────┘       │  └──────────────┘  │    │                      │        │
                     │                    │    └─────────┬────────────┘        │
  ┌──────────┐       │  ┌──────────────┐  │              │                     │
  │ Resolume │───────│─>│ OSC NEXUS    │──┘              │                     │
  │ TouchDes.│       │  │  (UDP 9000)  │         Float32Array mono             │
  │ Ableton  │       │  └──────────────┘         normalized [-1, 1]            │
  └──────────┘       │                               │                         │
                     │                               │ writeToRing()           │
  ┌──────────┐       │  ┌──────────────┐             v                         │
  │ WebAudio │───────│─>│ LEGACY BRIDGE│──> ┌────────────────────┐             │
  │(existing)│  IPC  │  │(useAudioCapt)│    │ SHARED RING BUFFER │             │
  └──────────┘       │  └──────────────┘    │ SharedArrayBuffer   │             │
                     │                      │ 8192 samples        │             │
                     │                      │ Lock-free SPSC      │             │
                     │                      └────────┬───────────┘             │
                     │                               │ readSnapshot()          │
                     │                               v                         │
                     │                      ┌────────────────────┐             │
                     │                      │ BETA Worker        │             │
                     │                      │ (GodEarFFT)        │             │
                     │                      │ SIN CAMBIOS        │             │
                     │                      └────────────────────┘             │
                     └─────────────────────────────────────────────────────────┘
```

### 2.2 Principio Fundamental: El Embudo Unico

**TODO converge en un Float32Array mono normalizado [-1.0, 1.0] que se escribe en un SharedArrayBuffer ring buffer.**

GodEarFFT no cambia. LiquidEngine no cambia. El Arbiter no cambia. Chronos no cambia. Solo cambia QUIEN escribe en el ring buffer y COMO lo hace. El GodEarFFT (BETA Worker) lee del SharedArrayBuffer via Atomics.load(), sin postMessage, sin Structured Clone, sin IPC. Zero-copy.

### 2.3 Diagrama de Hilos -- Garantia Zero-UI Blocking

```
THREAD MAP (Post-WAVE 3400)

[RENDERER]                   [MAIN PROCESS]              [WORKERS]
                                                          
React UI ◄──── truthStore     TitanOrchestrator           BETA (Senses)
  @ ~7fps       (Zustand)      processFrame()              GodEarFFT
                @ throttled      @ 25fps (40ms)             analyze()
                                   │                         @ ~20fps
Canvas ◄──── transientStore       │                          │
  @ 22fps     (mutable ref)      │                     reads SAB ring
                                   │                     via Atomics
useAudioCapture ──────────────────>│                          │
  (LEGACY BRIDGE)            InputArbiter                    │
  lux:audio-frame @ 60fps     writeToRing()                  │
  lux:audio-buffer @ 20fps      │                            │
                             VirtualWire ─> writeToRing()    │
                             USBDirectLink─> writeToRing()   │
                             OSCNexus ────> writeToRing()    │
                                   │                          │
                                   └── SharedArrayBuffer ────┘
                                       (ring buffer 8192)
                                       Lock-free SPSC
                                       Atomics.store/load
                                       
BUDGET ANALYSIS:
  InputArbiter.writeToRing()  : < 0.1ms  (memcpy Float32)
  SharedArrayBuffer read      : < 0.01ms (zero-copy, same memory)
  GodEarFFT.analyze()         : 0.8-1.5ms (unchanged)
  LiquidEngine.applyBands()   : < 0.5ms  (unchanged)
  MasterArbiter.arbitrate()   : < 1ms    (unchanged)
  HAL.renderFromTarget()      : < 2ms    (unchanged)
  ─────────────────────────────────────────
  TOTAL COMPUTE               : < 5.1ms  (vs 15ms budget)
  HEADROOM GANADO             : ~2ms     (elimina Structured Clone IPC)
  DMX WRITE                   : ~25ms    (unchanged)
  FRAME TOTAL                 : < 30.1ms (vs 40ms budget = 9.9ms spare)
```

**Zero-UI Blocking garantizado porque:**
1. VirtualWire y USBDirectLink operan en el Main Process con callbacks nativos de Node.js (no bloquean el event loop del renderer)
2. OSCNexus usa dgram UDP (ya probado en ArtNetTimecodeReceiver, linea 320+ del codigo existente)
3. El renderer solo envia audio por el Legacy Bridge (ya existente, ya probado a 60fps)
4. BETA Worker lee del SharedArrayBuffer sin postMessage -- elimina Structured Clone completamente del hot path de audio
5. La UI (React/Canvas) NUNCA toca el audio pipeline -- solo lee truthStore/transientStore como siempre

---

## 3. PILAR 1: VIRTUAL WIRE (The Studio Bridge)

### 3.1 Problema de Fondo

Cuando un DJ o productor usa VB-Cable, BlackHole, o JACK para rutear audio interno, el SO interpone su mezclador de audio:

- **Windows**: Windows Audio Session API (WASAPI) Shared Mode aplica Audio Processing Objects (APOs): Loudness Equalization, Room Correction, Dynamic Compression. LUFS target -14.
- **macOS**: CoreAudio aplica normalizacion de volumen a nivel de session.

Resultado: el bombo que sale del DAW con un pico de -3dBFS llega al AnalyserNode del browser con un pico de -9dBFS. Los transitorios estan aplastados. GodEarFFT compensa via AGC pero la informacion dinamica original se pierde. **El Francotirador (envKick) dispara tarde o no dispara.**

### 3.2 Solucion: Loopback Capture en Modo Exclusivo

```
ARQUITECTURA VIRTUAL WIRE

[DAW / DJ Software]
       │
       │  audio interno (PCM, bit-perfect)
       v
[Virtual Audio Device]
  VB-Cable / BlackHole / JACK
       │
       │  WASAPI Exclusive / CoreAudio exclusive
       │  (bypass del mezclador del SO)
       v
[Node.js Native Addon]   ◄── N-API C++ addon compilado con node-gyp
  platform-specific:
    Windows: IAudioClient (WASAPI Exclusive Mode)
    macOS:   AudioUnit (kAudioUnitSubType_HALOutput, exclusive)
    Linux:   JACK client directo (jack_client_open)
       │
       │  PCM Float32 interleaved @ device sample rate
       v
[VirtualWireProvider]     ◄── TypeScript, Main Process
  - Resample si != 44100Hz (Polyphase FIR, no Math.random)
  - Deinterleave a mono (L+R)/2 o canal seleccionado
  - Normalize a [-1.0, 1.0]
  - writeToRing(sharedBuffer)
```

### 3.3 Bypass del Mezclador del SO -- Detalle Tecnico

**Windows (WASAPI Exclusive Mode):**
```
IAudioClient::Initialize(
  AUDCLIPMODE_EXCLUSIVE,           // <-- Clave: exclusive = bypass APOs
  AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
  hnsRequestedDuration,            // 10ms buffer (441 samples @ 44100)
  hnsRequestedDuration,
  pWaveFormat,                     // WAVEFORMATEXTENSIBLE Float32
  NULL
)
```

En modo exclusivo, WASAPI NO aplica:
- Loudness Equalization (APO bypass)
- Room Correction (APO bypass)
- Speaker Fill / Channel Mixing (APO bypass)
- Dynamic Compression (APO bypass)

El stream llega bit-perfect del virtual device al addon.

**macOS (CoreAudio exclusive):**
```
AudioObjectSetPropertyData(
  deviceId, 
  &kAudioDevicePropertyHogMode,   // <-- Clave: hog mode = exclusive
  ...)
```

### 3.4 Interfaz del Modulo

```typescript
interface VirtualWireConfig {
  readonly deviceId: string              // ID del dispositivo de audio virtual
  readonly channelSelection: number      // 0=mono mix, 1..N=canal especifico
  readonly bufferSizeFrames: number      // Target: 256 (5.8ms @ 44100)
  readonly exclusiveMode: boolean        // true = bypass SO mixer
}

interface VirtualWireStatus {
  readonly state: 'disconnected' | 'connecting' | 'streaming' | 'error'
  readonly deviceName: string
  readonly nativeSampleRate: number      // Sample rate real del device
  readonly nativeChannels: number        // Canales del device
  readonly bufferUnderruns: number       // Contador de underruns
  readonly latencyMs: number             // Latencia medida (target < 3ms)
  readonly lastErrorMessage: string | null
}
```

### 3.5 Device Discovery

```typescript
interface AudioDeviceInfo {
  readonly id: string
  readonly name: string
  readonly channels: number
  readonly sampleRates: readonly number[]
  readonly isLoopback: boolean           // true para VB-Cable, BlackHole, etc.
  readonly isExclusiveCapable: boolean   // true si soporta WASAPI Exclusive
  readonly driver: 'wasapi' | 'coreaudio' | 'jack' | 'alsa'
}

// El addon nativo expone:
// enumerateDevices(): AudioDeviceInfo[]
// onDeviceChange(callback): void  -- hot-plug notification
```

---

## 4. PILAR 2: USB DIRECTLINK (The Console Native)

### 4.1 Problema de Fondo

Las consolas de mezcla digitales (Allen & Heath SQ, Behringer X32, Yamaha TF, Midas M32) exponen interfaces USB Audio Class Compliant con 16-32 canales de audio. El DJ necesita seleccionar canales especificos (ej: canal 1-2 = master mix, canal 15-16 = aux send pre-fader para LuxSync).

Problema adicional: cada consola tiene un nivel de salida diferente. Una X32 en +4dBu no es lo mismo que una TF en -10dBV. Sin Auto-Gain, el GodEar AGC se satura o se queda corto.

### 4.2 Arquitectura

```
ARQUITECTURA USB DIRECTLINK

[Consola Digital USB]
  Allen & Heath SQ / Behringer X32 / Yamaha TF
  USB Audio Class Compliant (UAC1/UAC2)
       │
       │  USB isochronous transfer
       │  Multi-channel PCM (16-32ch, 44100/48000/96000 Hz)
       v
[Node.js Native Addon]   ◄── Mismo addon que VirtualWire (reutilizado!)
  platform-specific:
    Windows: WASAPI Exclusive (auto-detect UAC device)
    macOS:   CoreAudio (auto-detect UAC device)
    Linux:   ALSA (hw:X,0 direct)
       │
       │  Multi-channel PCM Float32
       v
[USBDirectLinkProvider]   ◄── TypeScript, Main Process
  - Channel selector (ej: mix canales 1+2, o solo canal 15)
  - Auto-Gain digital pre-FFT:
      RMS window 500ms (12500 samples)
      Target RMS: -18dBFS (0.126 linear)
      Gain range: -12dB a +24dB (0.25x a 15.85x)
      Attack: 200ms (fade in suave al conectar)
      Release: 2000ms (no reacciona a silencio momentaneo)
  - Resample si != 44100Hz
  - writeToRing(sharedBuffer)
```

### 4.3 Auto-Gain Digital Pre-FFT -- El Nivelador

```
AUTO-GAIN PIPELINE

PCM raw del USB ─> RMS Calculator ─> Gain Computer ─> Apply Gain ─> writeToRing()
                   (500ms window)    (slow envelope)   (multiply)

RMS Calculator:
  rmsAccumulator += sample * sample
  sampleCount++
  if (sampleCount >= RMS_WINDOW_SAMPLES) {
    currentRMS = sqrt(rmsAccumulator / sampleCount)
    rmsAccumulator = 0
    sampleCount = 0
  }

Gain Computer:
  targetRMS = 0.126  // -18dBFS
  desiredGain = targetRMS / max(currentRMS, 0.00001)
  desiredGain = clamp(desiredGain, GAIN_MIN, GAIN_MAX)
  // Smooth envelope (NO step changes -- protege GodEar AGC)
  if (desiredGain > currentGain) {
    currentGain += (desiredGain - currentGain) * attackAlpha  // 200ms
  } else {
    currentGain += (desiredGain - currentGain) * releaseAlpha // 2000ms
  }

Apply Gain:
  for i in 0..bufferLength:
    buffer[i] = clamp(buffer[i] * currentGain, -1.0, 1.0)
```

Constantes deterministas, sin Math.random(). El Axioma Anti-Simulacion se respeta.

### 4.4 Channel Selector

```typescript
interface USBDirectLinkConfig {
  readonly deviceId: string
  readonly channelMap: ChannelMapConfig  // Que canales capturar
  readonly autoGain: AutoGainConfig
  readonly bufferSizeFrames: number      // Target: 512 (11.6ms @ 44100)
}

interface ChannelMapConfig {
  readonly mode: 'mono-mix' | 'stereo-pair' | 'single-channel'
  readonly channels: readonly number[]   // [0] = mono, [0,1] = stereo pair
  // mono-mix: (sum of selected channels) / channelCount
  // stereo-pair: left = ch[0], right = ch[1], mix to mono
  // single-channel: channel[0] directo
}

interface AutoGainConfig {
  readonly enabled: boolean
  readonly targetRMSdBFS: number         // Default: -18
  readonly gainMinDB: number             // Default: -12
  readonly gainMaxDB: number             // Default: +24
  readonly attackMs: number              // Default: 200
  readonly releaseMs: number             // Default: 2000
}
```

### 4.5 Plug & Play Detection

```typescript
// Hot-plug via el addon nativo:
// onDeviceChange(callback) detecta USB connect/disconnect
// 
// Flujo:
// 1. USB device connected -> onDeviceChange fires
// 2. enumerateDevices() -> check isUSBAudioClass flag
// 3. Notification al InputArbiter
// 4. Si autoConnect habilitado y prioridad > fuente actual -> hot-swap
// 5. Si device removed -> fallback a siguiente fuente en priority chain
```

---

## 5. PILAR 3: OSC NEXUS (Open Sound Control)

### 5.1 Problema de Fondo

LuxSync necesita hablar con el ecosistema VJ/AV: Resolume Arena, TouchDesigner, Ableton Live, Max/MSP, VDMX, MadMapper. El protocolo estandar es OSC sobre UDP. Es ligero, rapido, y no tiene overhead de handshake.

La comunicacion es BIDIRECCIONAL:
- **Entrada**: Resolume envia niveles de audio analizados, o Ableton envia BPM/beat clock via OSC
- **Salida**: LuxSync publica su estado (vibe, energy, beat) para que TouchDesigner reaccione

### 5.2 Arquitectura

```
ARQUITECTURA OSC NEXUS

[Software Externo]                     [LuxSync Main Process]
 Resolume / TouchDesigner               
 Ableton / Max/MSP                     ┌───────────────────────┐
                                        │    OSC NEXUS SERVER    │
   UDP ───────────────────────────────>│    dgram.createSocket  │
   port 9000 (configurable)           │    ('udp4')            │
                                        │                       │
   ◄──────────────────────────────────│    OSC PUBLISHER       │
   port 9001 (configurable)           │    (broadcast state)   │
                                        └───────────┬───────────┘
                                                    │
                                   ┌────────────────┘
                                   v
                          OSCNexusProvider
                            parseOSC()
                            routeMessage()
                            buildAudioFromOSC()
                            writeToRing()
```

### 5.3 Diccionario de Rutas OSC -- El Tratado

**RUTAS DE ENTRADA (LuxSync escucha):**

```
/luxsync/audio/pcm          [blob]    Raw PCM Float32 mono (preferido)
/luxsync/audio/bands         [fffffff] 7 bandas (subBass,bass,lowMid,mid,highMid,treble,ultraAir) 0-1
/luxsync/audio/energy        [f]       Energia total normalizada 0-1
/luxsync/audio/bpm           [f]       BPM externo
/luxsync/audio/beat          [i]       Beat trigger (1 = onset)
/luxsync/audio/transients    [iii]     kick,snare,hihat (0 o 1)

/luxsync/control/vibe        [s]       Forzar vibe ("techno","latino","rock","chill")
/luxsync/control/blackout    [i]       0=off, 1=blackout
/luxsync/control/master      [f]       Grand master dimmer 0-1
/luxsync/control/strobe      [fi]      intensity 0-1, rate Hz

/luxsync/fixture/{id}/dimmer [f]       Override dimmer 0-1
/luxsync/fixture/{id}/color  [fff]     Override RGB 0-1
/luxsync/fixture/{id}/pos    [ff]      Override pan,tilt 0-1
```

**RUTAS DE SALIDA (LuxSync publica):**

```
/luxsync/state/vibe          [s]       Vibe actual
/luxsync/state/energy        [f]       Energia actual 0-1
/luxsync/state/bpm           [f]       BPM detectado
/luxsync/state/beat          [i]       1 en cada beat (para sync visual)
/luxsync/state/section       [s]       "drop","breakdown","buildup"
/luxsync/state/bands         [fffffff] 7 bandas actuales

/luxsync/fixture/{id}/output [ffffffff] dimmer,r,g,b,pan,tilt,zoom,focus (post-arbiter)
```

### 5.4 Modos de Operacion OSC

```typescript
type OSCInputMode = 
  | 'pcm'           // Raw audio via /luxsync/audio/pcm -> FFT completo
  | 'bands'         // Pre-analyzed bands via /luxsync/audio/bands -> bypass FFT
  | 'energy-only'   // Solo energia via /luxsync/audio/energy -> modo basico
  | 'control-only'  // Solo control, sin audio (ej: Resolume manda fixture overrides)
```

En modo `bands`, el OSCNexusProvider sintetiza un GodEarBands directamente sin pasar por el GodEarFFT. Esto permite que software externo con su propio analisis espectral (Resolume tiene FFT integrado) alimente a LiquidEngine sin doble-FFT.

### 5.5 Interfaz del Modulo

```typescript
interface OSCNexusConfig {
  readonly listenPort: number            // Default: 9000
  readonly publishPort: number           // Default: 9001
  readonly publishHost: string           // Default: '255.255.255.255' (broadcast)
  readonly publishRate: number           // Default: 25 (match DMX rate)
  readonly inputMode: OSCInputMode
  readonly enablePublish: boolean        // Default: true
}

interface OSCNexusStatus {
  readonly state: 'stopped' | 'listening' | 'error'
  readonly messagesReceived: number      // Total count
  readonly messagesPerSecond: number     // Rate monitor
  readonly lastMessageTimestamp: number  // performance.now()
  readonly connectedClients: number     // Unique IPs seen in last 5s
}
```

---

## 6. INPUT ARBITER -- El Cerebro de la Seleccion

### 6.1 Arquitectura del Arbiter de Entrada

El InputArbiter es el componente central que decide QUE fuente de audio alimenta al GodEarFFT en cada momento. No es un mixer -- es un selector con fallback chain.

```
PRIORITY CHAIN (configurable por usuario):

Priority 1: USB DIRECTLINK  (si conectado y streaming)
         │
         │ fallback (device lost / silence > 3s)
         v
Priority 2: VIRTUAL WIRE    (si configurado y streaming)
         │
         │ fallback (no device / silence > 3s)
         v
Priority 3: LEGACY BRIDGE   (Web Audio, siempre disponible)
         │
         │ fallback (user deshabilita captura)
         v
Priority 4: OSC NEXUS PCM   (si recibiendo audio OSC)
         │
         │ fallback (sin mensajes OSC > 5s)
         v
Priority 5: SILENCE          (GodEar recibe zeros, Selene entra en idle)
```

### 6.2 Estrategia Hot-Swapping -- Cambio en Caliente Sin Muerte

**Problema critico**: Si el InputArbiter corta la fuente A y conecta la fuente B de golpe, el GodEar AGC ve un escalon brutal. Los 7 bancos de AGC reaccionan con attack asimetrico (subBass 150ms, treble 40ms) creando un desequilibrio espectral transitorio que dura ~500ms. LiquidEngine interpreta esto como un "momento musical" falso. Las luces hacen un espasmo.

**Solucion: Crossfade Temporal de Buffers**

```
HOT-SWAP PROTOCOL (The Diplomatic Handshake)

Fase 0: DETECT
  - InputArbiter detecta condicion de cambio:
    a) Device perdido (USB disconnect)
    b) Silence timeout (3 segundos de RMS < -60dBFS)
    c) Higher-priority source aparece
    d) Usuario seleccion manual

Fase 1: FADE-OUT (60ms = ~3 frames @ 25fps)
  - Source A: gain linear ramp 1.0 -> 0.0 en 60ms
  - Source B: prebuffering (acumula en secondary ring sin escribir al primary)
  - GodEar: sigue procesando Source A con fade decreciente
  - LiquidEngine: apenas nota, los envelopes absorben 60ms de decay

Fase 2: GAP BRIDGE (1 frame = 40ms)
  - writeToRing() escribe ZEROS (1 frame de silencio controlado)
  - GodEar AGC: 1 frame de silencio NO activa release (minimo 3 frames)
  - LiquidEngine: smooth fade via ghostCap (brillo subliminal minimo)

Fase 3: FADE-IN (100ms = ~5 frames)
  - Source B: gain linear ramp 0.0 -> 1.0 en 100ms
  - GodEar AGC: attack gradual absorbe el ramp sin salto
  - LiquidEngine: envelopes interpretan como "cancion nueva" (natural)

Fase 4: STABLE
  - Source B a gain 1.0
  - Source A: cleanup (close stream, release device)
  - InputArbiter actualiza estado
  - Log: [INPUT_ARBITER] Hot-swap A -> B completed in 200ms

TOTAL HANDSHAKE TIME: ~200ms (5 frames)
VISUAL DISRUPTION: imperceptible (envelopes absorben crossfade)
```

### 6.3 Interfaz Core del InputArbiter

```typescript
interface InputArbiterConfig {
  readonly priorityChain: readonly InputSourceType[]
  readonly silenceTimeoutMs: number       // Default: 3000
  readonly autoFallback: boolean          // Default: true
  readonly crossfadeDuration: CrossfadeDuration
}

interface CrossfadeDuration {
  readonly fadeOutMs: number              // Default: 60
  readonly gapMs: number                  // Default: 40 (1 frame)
  readonly fadeInMs: number               // Default: 100
}

type InputSourceType = 'usb-directlink' | 'virtual-wire' | 'legacy-bridge' | 'osc-nexus'
```

---

## 7. SHARED RING BUFFER -- El Corazon Binario

### 7.1 Por Que SharedArrayBuffer

Actualmente, el audio va de renderer a main via IPC (`lux:audio-buffer`), y de main a BETA Worker via `postMessage()`. Ambos pasos usan Structured Clone (copia completa del buffer). WAVE 3060b mitigo parcialmente esto con el hack Uint8Array, pero sigue siendo una copia.

Con SharedArrayBuffer:
- **CERO copias** en el hot path
- Main process escribe, BETA Worker lee, misma memoria
- Atomics.store/load garantizan visibilidad entre threads sin locks

### 7.2 Diseno del Ring Buffer Lock-Free SPSC

```
SHARED RING BUFFER LAYOUT (Single Producer, Single Consumer)

SharedArrayBuffer total: 33,796 bytes

┌─────────────────────────────────────────────────────────────┐
│ METADATA HEADER (Int32Array view, 4 slots = 16 bytes)       │
│                                                             │
│ [0] writeHead   : Atomics.store/load (producer advances)    │
│ [1] readHead    : Atomics.store/load (consumer advances)    │
│ [2] sampleRate  : 44100 (written once at init)              │
│ [3] channelCount: 1 (mono, written once at init)            │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ AUDIO DATA (Float32Array view, 8192 samples = 32,768 bytes) │
│                                                             │
│ Circular buffer: writeHead/readHead wrap modulo 8192        │
│ Each sample: Float32 normalized [-1.0, 1.0]                 │
│                                                             │
│ Capacity: 8192 samples = 185.7ms @ 44100Hz                 │
│ Typical fill: 2048-4096 samples (46-93ms)                  │
│ GodEar FFT reads 4096 samples per analysis                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘

PRODUCER (InputArbiter, Main Process):
  writeToRing(samples: Float32Array):
    const head = Atomics.load(meta, WRITE_HEAD)
    for (i = 0; i < samples.length; i++):
      data[(head + i) % RING_SIZE] = samples[i]
    Atomics.store(meta, WRITE_HEAD, (head + samples.length) % RING_SIZE)

CONSUMER (BETA Worker):
  readSnapshot(output: Float32Array, count: number): number
    const wHead = Atomics.load(meta, WRITE_HEAD)
    const rHead = Atomics.load(meta, READ_HEAD)
    const available = (wHead - rHead + RING_SIZE) % RING_SIZE
    const toRead = min(available, count)
    for (i = 0; i < toRead; i++):
      output[i] = data[(rHead + i) % RING_SIZE]
    Atomics.store(meta, READ_HEAD, (rHead + toRead) % RING_SIZE)
    return toRead
```

### 7.3 Propiedades del Ring Buffer

| Propiedad | Valor | Justificacion |
|---|---|---|
| Tamano | 8192 samples | 2x FFT_SIZE (4096). Permite 1 FFT completo + buffer de un ciclo |
| Duracion | 185.7ms @ 44100Hz | Suficiente para absorber jitter de USB/VirtualWire |
| Lock-free | Si (SPSC) | Solo 1 writer (InputArbiter) y 1 reader (BETA Worker) |
| Memory fence | Atomics.store/load | Garantiza visibilidad cross-thread sin mutex |
| Overflow policy | Overwrite oldest | Producer nunca bloquea. Si consumer es lento, pierde samples viejos |
| Underflow policy | Zero-fill | Si no hay suficientes samples, GodEar recibe zeros parciales |

### 7.4 Electron Security: Habilitar SharedArrayBuffer

```javascript
// electron/main.ts -- WAVE 3400
// SharedArrayBuffer requiere Cross-Origin Isolation en Chromium
app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer')

// En la BrowserWindow:
webPreferences: {
  // ... existing config
  // SharedArrayBuffer requiere estos headers:
  // Cross-Origin-Opener-Policy: same-origin
  // Cross-Origin-Embedder-Policy: require-corp
  // En Electron, se configura via protocol handler o session headers
}

// Alternativa mas simple para Electron (no web):
// SharedArrayBuffer funciona en Electron main process Workers
// sin necesidad de COOP/COEP porque los Workers son Node.js workers,
// no Service Workers del browser. 
// Worker({ workerData: { sharedBuffer } }) lo recibe directamente.
```

---

## 8. INTERFACES CORE (TypeScript) -- Los Contratos

### 8.1 Contrato Principal: IInputProvider

```typescript
// Contrato que TODA fuente de audio debe implementar

interface IInputProvider {
  /** Identificador unico del tipo de provider */
  readonly type: InputSourceType

  /** Estado actual del provider */
  readonly status: InputProviderStatus

  /** Inicializar el provider con su configuracion */
  initialize(config: InputProviderConfig): Promise<void>

  /** Comenzar a capturar audio. Llama a onAudioData cuando hay datos */
  start(): Promise<void>

  /** Detener captura. Liberar recursos del dispositivo */
  stop(): Promise<void>

  /** Destruir el provider completamente. No reutilizable despues */
  dispose(): void

  /** Callback invocado cuando hay audio disponible */
  onAudioData: ((buffer: Float32Array, sampleRate: number) => void) | null

  /** Callback invocado cuando cambia el estado */
  onStatusChange: ((status: InputProviderStatus) => void) | null

  /** Listar dispositivos disponibles para este provider */
  enumerateDevices(): Promise<readonly AudioDeviceInfo[]>

  /** Obtener metricas de diagnostico */
  getDiagnostics(): InputProviderDiagnostics
}

type InputSourceType = 'virtual-wire' | 'usb-directlink' | 'osc-nexus' | 'legacy-bridge'

interface InputProviderStatus {
  readonly state: 'uninitialized' | 'ready' | 'streaming' | 'error' | 'disposed'
  readonly deviceName: string | null
  readonly sampleRate: number
  readonly channels: number
  readonly latencyMs: number
  readonly errorMessage: string | null
}

interface InputProviderConfig {
  readonly deviceId?: string
  readonly sampleRate?: number           // Target: 44100
  readonly channelSelection?: number
  readonly exclusiveMode?: boolean
}

interface InputProviderDiagnostics {
  readonly bufferUnderruns: number
  readonly bufferOverruns: number
  readonly samplesProcessed: number
  readonly avgLatencyMs: number
  readonly peakLatencyMs: number
  readonly uptimeMs: number
}
```

### 8.2 Contrato del Bus: IAudioMatrix

```typescript
// El bus central que conecta providers con el consumer (GodEarFFT)

interface IAudioMatrix {
  /** Registrar un provider de entrada */
  registerProvider(provider: IInputProvider): void

  /** Remover un provider */
  unregisterProvider(type: InputSourceType): void

  /** Obtener el provider activo actual */
  getActiveProvider(): IInputProvider | null

  /** Obtener todos los providers registrados */
  getRegisteredProviders(): readonly IInputProvider[]

  /** Configurar la cadena de prioridad */
  setPriorityChain(chain: readonly InputSourceType[]): void

  /** Forzar cambio a un provider especifico (override manual) */
  forceSource(type: InputSourceType): Promise<void>

  /** Volver a modo automatico (priority chain) */
  releaseForce(): void

  /** Obtener referencia al SharedArrayBuffer */
  getSharedBuffer(): SharedArrayBuffer

  /** Estado del matrix */
  getStatus(): AudioMatrixStatus
}

interface AudioMatrixStatus {
  readonly activeSource: InputSourceType | null
  readonly isHotSwapping: boolean
  readonly hotSwapPhase: 'none' | 'fade-out' | 'gap' | 'fade-in'
  readonly ringBufferFillLevel: number    // 0-1 (0=vacio, 1=lleno)
  readonly sharedBufferReady: boolean
  readonly providers: ReadonlyMap<InputSourceType, InputProviderStatus>
}
```

### 8.3 Contrato OSC: IOSCBridge

```typescript
// Interfaz especifica del puente OSC (bidireccional)

interface IOSCBridge {
  /** Iniciar servidor UDP */
  startServer(config: OSCNexusConfig): Promise<void>

  /** Detener servidor */
  stopServer(): Promise<void>

  /** Publicar un mensaje OSC manualmente */
  publish(address: string, args: readonly OSCArgument[]): void

  /** Registrar handler para una ruta especifica */
  onMessage(address: string, handler: OSCMessageHandler): void

  /** Remover handler */
  offMessage(address: string, handler: OSCMessageHandler): void

  /** Estado del servidor */
  getStatus(): OSCNexusStatus
}

type OSCArgument = 
  | { type: 'f'; value: number }       // Float32
  | { type: 'i'; value: number }       // Int32
  | { type: 's'; value: string }       // String
  | { type: 'b'; value: Uint8Array }   // Blob (para PCM)

type OSCMessageHandler = (args: readonly OSCArgument[], senderInfo: OSCSenderInfo) => void

interface OSCSenderInfo {
  readonly address: string              // IP del sender
  readonly port: number
}
```

### 8.4 Contrato del Shared Ring Buffer

```typescript
// Interfaz del ring buffer compartido entre threads

interface ISharedRingBuffer {
  /** SharedArrayBuffer subyacente (pasarlo al Worker) */
  readonly buffer: SharedArrayBuffer

  /** Escribir samples al ring (producer side, main thread) */
  write(samples: Float32Array): void

  /** Leer samples del ring (consumer side, worker thread) */
  read(output: Float32Array, maxSamples: number): number

  /** Samples disponibles para lectura */
  readonly available: number

  /** Nivel de llenado 0-1 */
  readonly fillLevel: number

  /** Reset de indices (solo en init, no en hot path) */
  reset(): void
}
```

---

## 9. INTEGRACION CON SISTEMAS EXISTENTES

### 9.1 Puntos de Contacto con el Pipeline Actual

```
MAPA DE INTEGRACION

┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  [NEW] Omni-Input Matrix                                            │
│    │                                                                │
│    │ SharedArrayBuffer (reemplaza lux:audio-buffer IPC)              │
│    v                                                                │
│  [EXISTING] BETA Worker (senses.ts)                                 │
│    │  Cambio: readSnapshot(SAB) en vez de onmessage('AUDIO_BUFFER') │
│    │  GodEarFFT.analyze() -- SIN CAMBIOS                           │
│    │  7 bandas + metricas + transientes -- SIN CAMBIOS              │
│    v                                                                │
│  [EXISTING] ALPHA (TrinityOrchestrator)                             │
│    │  Recibe AUDIO_ANALYSIS via postMessage -- SIN CAMBIOS          │
│    v                                                                │
│  [EXISTING] TitanOrchestrator.processFrame()                        │
│    │  Consume metricas -- SIN CAMBIOS                               │
│    v                                                                │
│  [EXISTING] LiquidEngine.applyBands()                               │
│    │  6 envelopes -- SIN CAMBIOS                                    │
│    v                                                                │
│  [EXISTING] MasterArbiter.arbitrate()                               │
│    │  5 layers -- SIN CAMBIOS (OSC overrides entran como Layer 2)   │
│    v                                                                │
│  [EXISTING] HAL.renderFromTarget() -> DMX512                        │
│    SIN CAMBIOS                                                      │
│                                                                     │
│  [EXISTING] Chronos                                                 │
│    SIN CAMBIOS (sigue usando AudioContext como clock master)         │
│    Timeline playback no depende de fuente de audio                  │
│                                                                     │
│  [EXISTING] Hephaestus (Forja)                                      │
│    SIN CAMBIOS (Layer 3 effects pipeline independiente del audio)    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

ARCHIVOS QUE CAMBIAN:
  1. senses.ts           -- Leer de SAB en vez de onmessage
  2. TrinityOrchestrator -- Crear SAB, pasarlo al Worker, registrar providers
  3. useAudioCapture.ts  -- LegacyBridgeProvider wrapper (adapta IPC existente)
  4. preload.ts          -- Exponer SAB reference al renderer (si se mantiene legacy)

ARCHIVOS QUE NO CAMBIAN:
  - GodEarFFT.ts         (consume Float32Array como siempre)
  - LiquidEngineBase.ts  (consume GodEarBands como siempre)
  - LiquidEngine41.ts    (routing sin cambios)
  - LiquidEngine71.ts    (routing sin cambios)
  - TitanOrchestrator.ts (consume AUDIO_ANALYSIS como siempre)
  - MasterArbiter.ts     (layers sin cambios, OSC = Layer 2)
  - HardwareAbstraction.ts (render pipeline intacto)
  - ChronosEngine.ts     (clock independiente)
  - HephaestusRuntime.ts (effects independientes)
```

### 9.2 Integracion OSC con MasterArbiter

Los mensajes OSC de control (`/luxsync/fixture/{id}/dimmer`, etc.) se traducen a **Layer 2 (MANUAL)** overrides, exactamente igual que los faders de la UI:

```
OSC message: /luxsync/fixture/mover-left-1/color [0.8, 0.2, 0.1]
                        │
                        v
OSCNexusProvider.routeMessage()
                        │
                        v
ArbiterIPCHandlers.setManual({
  fixtureId: 'mover-left-1',
  red: 204,     // 0.8 * 255
  green: 51,    // 0.2 * 255
  blue: 25,     // 0.1 * 255
  _source: 'osc'
})
                        │
                        v
MasterArbiter Layer 2 (MANUAL) -- Category: COLOR
```

No se crea un Layer nuevo. No se modifica el Arbiter. Los overrides OSC son indistinguibles de los overrides de fader. Esto es **arquitectura correcta**: el Arbiter ya sabe hacer merge de overrides manuales.

### 9.3 Integracion con La Forja (Hephaestus)

La Forja opera en **Layer 3 (EFFECTS)** y es completamente independiente del audio input. Los efectos de Hephaestus (CoreMeltdown, SalsaFire, GatlingRaid, etc.) se generan desde curvas keyframe en la timeline de Chronos, no desde audio en vivo.

**No hay colision.** El Omni-Input Matrix alimenta Layer 0 (TITAN_AI) via GodEar > LiquidEngine > TitanEngine. La Forja alimenta Layer 3 via HephaestusRuntime. Son pipelines completamente paralelos que convergen SOLO en `MasterArbiter.arbitrate()`.

Riesgo unico: si OSC envia fixture overrides (Layer 2) al mismo tiempo que Hephaestus tiene un efecto activo (Layer 3), el efecto gana (Layer 3 > Layer 2 en LTP). Esto es el comportamiento correcto -- un efecto temporal DEBE dominar sobre un override manual.

---

## 10. ANALISIS DE RIESGOS

### 10.1 Riesgos Tecnicos

| # | Riesgo | Probabilidad | Impacto | Mitigacion |
|---|---|---|---|---|
| R1 | **Native Addon Compilation**: node-gyp falla en maquinas sin Visual Studio / Xcode | ALTA | ALTO | Distribuir addon pre-compilado via prebuild-install. Targets: win-x64, mac-arm64, mac-x64, linux-x64 |
| R2 | **WASAPI Exclusive Mode conflicto**: Si otra app tiene el device en exclusive, falla | MEDIA | MEDIO | Fallback a shared mode con warning "calidad reducida: normalizado por SO". Log del conflicto |
| R3 | **SharedArrayBuffer + Electron**: COOP/COEP headers pueden romper integracion con iframes o webviews | BAJA | BAJO | Workers en main process son Node.js workers, no browser workers. SAB funciona sin COOP/COEP en ese contexto |
| R4 | **OSC flooding**: Software externo envia OSC a tasa descontrolada (>1000msg/s) | MEDIA | MEDIO | Rate limiter en OSCNexus: max 100 msg/s por ruta. Drop silencioso + log warning |
| R5 | **USB device hot-unplug durante hot-swap**: Race condition si device se pierde durante fade-out | BAJA | ALTO | InputArbiter detecta device loss visto ReadError, aborta hot-swap, salta directo a fallback |
| R6 | **Resampling artefactos**: Si USB device esta a 48000Hz y target es 44100Hz | MEDIA | MEDIO | Polyphase FIR resampler de calidad. NO usar interpolacion lineal (aliasing). Tabla de coeficientes pre-calculada, determinista |
| R7 | **GodEar AGC desestabilizado por hot-swap**: AGC trust zones pierden calibracion en transicion | BAJA | MEDIO | Crossfade de 200ms (Seccion 6.2) absorbe la transicion. AGC attack mas lento (subBass 150ms) > tiempo de crossfade |
| R8 | **Latencia acumulada USB + Resample + Ring + FFT**: Posible > 10ms total | MEDIA | MEDIO | Budget: USB buffer 5.8ms + Resample 0.2ms + Ring write 0.1ms + FFT 1.5ms = 7.6ms. Bajo el threshold de percepcion visual (16ms = 1 frame) |
| R9 | **OSC parsing overhead en hot path**: osc-min o equivalente puede ser lento | BAJA | BAJO | Parser OSC manual minimal (el formato es trivial: address + type tags + data). Sin dependencias externas |
| R10 | **Conflicto de prioridad audio: OSC bands vs GodEar FFT**: Si OSC envia bands pre-analizadas, que pasa con el flujo normal? | MEDIA | ALTO | Modos mutuamente excluyentes en OSCNexus. Modo 'bands' escribe directo a AudioMatrix como GodEarBands bypass. Modo 'pcm' escribe al ring buffer normal. NUNCA ambos simultaneos |

### 10.2 Riesgos Operacionales

| # | Riesgo | Mitigacion |
|---|---|---|
| R11 | **Inversion 0$**: Native addon requiere C++ development time | Addon minimo: solo WASAPI/CoreAudio capture. ~500 LOC C++. No es un DAW, es un capture pipe |
| R12 | **Testing en laptop cafetera 16GB**: USB audio + GodEar + Titan en paralelo | Misma carga que el pipeline actual. SAB elimina 2ms de Structured Clone. Net performance: MEJOR |
| R13 | **Soporte multi-platform**: Windows + macOS + Linux | Prioridad: Windows (90% target market para DJs). macOS segundo. Linux via JACK (comunidad proporciona feedback) |

### 10.3 Cuello de Botella Critico: El Native Addon

El addon de C++ es el unico componente que NO es puro JavaScript/TypeScript. Es tambien el de mayor riesgo y mayor recompensa:

```
SIN ADDON (alternativa degradada):
  - Virtual Wire: Usar Web Audio API getDisplayMedia (actual) -- pierde bypass de mixer
  - USB DirectLink: Imposible sin WASAPI/CoreAudio nativo
  - OSC Nexus: 100% Node.js (dgram), no necesita addon

CON ADDON (full power):
  - Virtual Wire: WASAPI Exclusive, bit-perfect, bypass total
  - USB DirectLink: Multi-channel capture nativo
  - OSC Nexus: No cambia (sigue siendo Node.js puro)

ESTRATEGIA DE FASES:
  Fase 1 (zero C++): OSC Nexus + Legacy Bridge mejorado con SAB
  Fase 2 (addon): Virtual Wire + USB DirectLink
```

Esto permite entregar valor inmediato (OSC + SAB) sin bloquear en el addon nativo.

---

## 11. PATRON DE DISENO: PROVIDER REGISTRY

### 11.1 Arquitectura Interna del AudioMatrix

```typescript
// Patron: Strategy + Observer + Priority Queue

class AudioMatrix implements IAudioMatrix {
  // Registry de providers
  private providers: Map<InputSourceType, IInputProvider>
  
  // Priority chain (usuario configurable)
  private priorityChain: InputSourceType[]
  
  // Fuente activa
  private activeProvider: IInputProvider | null
  
  // Override manual (forceSource)
  private forcedSource: InputSourceType | null
  
  // Shared Ring Buffer
  private sharedBuffer: SharedArrayBuffer
  private ringWriter: SharedRingBufferWriter
  
  // Hot-swap state machine
  private swapState: 'stable' | 'fade-out' | 'gap' | 'fade-in'
  private swapGainCurrent: number        // 0-1, gain del source activo durante swap
  private swapGainTarget: number
  private swapStartTime: number          // performance.now()
  private pendingSource: IInputProvider | null
  
  // Monitoring
  private silenceCounter: Map<InputSourceType, number>
  
  registerProvider(provider: IInputProvider): void {
    provider.onAudioData = (buffer, sampleRate) => {
      this.handleAudioData(provider.type, buffer, sampleRate)
    }
    provider.onStatusChange = (status) => {
      this.handleStatusChange(provider.type, status)
    }
    this.providers.set(provider.type, provider)
    this.evaluatePriority()
  }
  
  private handleAudioData(
    source: InputSourceType, 
    buffer: Float32Array, 
    sampleRate: number
  ): void {
    // Solo procesar datos del source activo (o del source en fade-in)
    if (source !== this.activeProvider?.type && source !== this.pendingSource?.type) {
      return  // Drop silencioso. No es el source seleccionado
    }
    
    // Hot-swap gain envelope
    let gain = 1.0
    if (this.swapState !== 'stable') {
      gain = this.computeSwapGain(source)
    }
    
    // Aplicar gain si != 1.0 (evitar multiplicacion innecesaria)
    if (gain !== 1.0) {
      // Mutate in-place si es safe, o usar pre-allocated buffer
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] *= gain
      }
    }
    
    // Resample si necesario (only if sampleRate != 44100)
    const resampled = sampleRate !== 44100 
      ? this.resampler.process(buffer, sampleRate, 44100)
      : buffer
    
    // Escribir al ring buffer compartido
    this.ringWriter.write(resampled)
  }
}
```

### 11.2 State Machine del Hot-Swap

```
                  ┌──────────┐
         ┌───────│  STABLE   │◄──────────────────────────┐
         │       └─────┬─────┘                           │
         │             │                                  │
         │  trigger:   │ device lost / silence /           │
         │  evaluate   │ higher priority / manual          │
         │  Priority() │                                  │
         │             v                                  │
         │       ┌──────────┐                             │
         │       │ FADE-OUT │  60ms linear ramp            │
         │       │ gain 1→0 │  source A attenuating        │
         │       └─────┬────┘                             │
         │             │ gain reached 0.0                  │
         │             v                                  │
         │       ┌──────────┐                             │
         │       │   GAP    │  40ms (1 frame) zeros        │
         │       │ bridge   │  GodEar AGC unaffected       │
         │       └─────┬────┘                             │
         │             │                                  │
         │             v                                  │
         │       ┌──────────┐                             │
         │       │ FADE-IN  │  100ms linear ramp           │
         │       │ gain 0→1 │  source B ramping up        │
         │       └─────┬────┘                             │
         │             │ gain reached 1.0                  │
         │             │ cleanup source A                 │
         │             └──────────────────────────────────┘
         │
         │  abort (device B also lost):
         └──> evaluatePriority() again → next in chain
```

---

## 12. OSC BANDS BYPASS -- La Ruta Directa

### 12.1 Cuando OSC Envia Bandas Pre-Analizadas

Algunos workflows no necesitan que GodEar haga FFT. Resolume Arena, por ejemplo, tiene su propio analizador espectral. En ese caso, el OSCNexusProvider puede inyectar bandas directamente en el pipeline, bypass completo del ring buffer y del Worker BETA:

```
RUTA NORMAL (PCM via ring):
  OSC /luxsync/audio/pcm [blob] 
    -> OSCNexusProvider.writeToRing()
    -> BETA Worker GodEarFFT.analyze()
    -> AUDIO_ANALYSIS 
    -> TitanOrchestrator

RUTA DIRECTA (bands bypass):
  OSC /luxsync/audio/bands [fffffff]
    -> OSCNexusProvider.buildGodEarBands()
    -> TrinityOrchestrator.injectExternalBands()
    -> TitanOrchestrator.processFrame() 
       (usa bands inyectadas en vez de esperar AUDIO_ANALYSIS)

  OSC /luxsync/audio/bpm [f] + /luxsync/audio/beat [i]
    -> OSCNexusProvider.buildBeatInfo()
    -> TrinityOrchestrator.injectExternalBeat()
    -> TitanOrchestrator usa BPM/beat externo
```

### 12.2 Limitaciones del Bypass

En modo bands-bypass, las siguientes metricas NO estan disponibles (requieren FFT):
- spectralCentroid (necesario para Morphologic Shield WAVE 2449)
- spectralFlatness (necesario para noiseMode detection)
- crestFactor (necesario para dynamics analysis)
- harshness (derivado de analisis espectral)

**Solucion**: En modo bypass, LiquidEngine opera con valores default seguros:
- spectralCentroid = 1000 Hz (neutro)
- spectralFlatness = 0.3 (tonal assumed)
- crestFactor = 3.0 (moderado)
- harshness = 0.3 (no-acid default)

Estos defaults hacen que LiquidEngine funcione, pero sin la precision del analisis espectral completo. Es un tradeoff aceptable para integracion rapida con software externo.

---

## 13. TELEMETRIA Y DIAGNOSTICO

### 13.1 Sensores del Omni-Input Matrix

```
[INPUT_MATRIX] Source changed: legacy-bridge -> usb-directlink (auto-priority)
[INPUT_MATRIX] Hot-swap completed: 198ms (fade-out:62ms, gap:40ms, fade-in:96ms)
[INPUT_MATRIX] Ring buffer fill: 67% (5488/8192 samples)
[INPUT_MATRIX] Device lost: USB DirectLink "Behringer X32" (WASAPI error 0x88890004)
[INPUT_MATRIX] Fallback activated: usb-directlink -> virtual-wire
[INPUT_MATRIX] Auto-Gain: USB DirectLink gain adjusted to +8.2dB (RMS: -26.2dBFS -> -18dBFS)
[INPUT_MATRIX] OSC Nexus: 47 msg/s from 192.168.1.100:9001 (mode: bands)
[INPUT_MATRIX] Silence detected: virtual-wire (3.2s @ RMS < -60dBFS)
[INPUT_MATRIX] UNDERRUN: Ring buffer empty for 2 consecutive reads (BETA Worker starved)
```

### 13.2 Health Monitor

```typescript
interface OmniInputHealthReport {
  readonly activeSource: InputSourceType | null
  readonly activeLatencyMs: number
  readonly ringBufferFillPercent: number
  readonly ringBufferUnderruns: number       // last 60s
  readonly ringBufferOverruns: number        // last 60s
  readonly hotSwapCount: number              // last 60s
  readonly hotSwapAvgDurationMs: number
  readonly oscMessagesPerSecond: number
  readonly autoGainCurrentDB: number         // USB DirectLink only
  readonly providers: Record<InputSourceType, {
    state: string
    deviceName: string | null
    latencyMs: number
    errors: number
  }>
}
```

---

## 14. PLAN DE FASES

### Fase 1: Foundation (Zero C++)
- Implementar SharedRingBuffer (SAB + Atomics)
- Modificar senses.ts para leer del SAB
- Implementar IAudioMatrix y InputArbiter
- Crear LegacyBridgeProvider (wrapper del useAudioCapture actual)
- Implementar OSCNexusProvider (dgram puro, sin addon)
- Diccionario OSC completo (entrada + salida)
- Tests unitarios de ring buffer, hot-swap, OSC parsing

### Fase 2: Native Power
- Native addon C++ (WASAPI/CoreAudio)
- VirtualWireProvider
- USBDirectLinkProvider
- Auto-Gain pre-FFT
- Device enumeration + hot-plug detection
- Polyphase FIR resampler
- Pre-built binaries para Windows/macOS

### Fase 3: Polish
- UI de seleccion de fuente (InputSourcePanel)
- Visualizador de ring buffer fill level
- OSC route inspector (debug tool)
- Telemetria completa en logs
- Documentacion de rutas OSC para usuarios

---

## 15. RESUMEN DE DECISIONES ARQUITECTONICAS

| Decision | Justificacion |
|---|---|
| SharedArrayBuffer para audio | Elimina Structured Clone (2ms), zero-copy cross-thread. La unica forma correcta de compartir audio entre procesos |
| SPSC Lock-free Ring Buffer | Un solo producer (InputArbiter), un solo consumer (BETA Worker). Lock-free = zero contention vs mutex |
| 8192 samples ring | 2x FFT_SIZE. 185ms de buffer absorbe jitter sin usar memoria excesiva |
| Crossfade temporal para hot-swap | 200ms total. Protege los AGC trust zones del GodEar y los envelopes de LiquidEngine de escalones |
| OSC sobre UDP (no TCP) | Estandar de la industria. Zero handshake, minima latencia. Packet loss es aceptable (audio es transitorio) |
| Native addon separado | Minimo acoplamiento. Si el addon falla, LuxSync funciona con Legacy Bridge y OSC |
| Providers como Strategy Pattern | Cada fuente implementa IInputProvider. El AudioMatrix no sabe ni le importa de donde viene el audio |
| OSC overrides via Layer 2 | Reutiliza la infraestructura existente del Arbiter. No se inventa un path nuevo |
| Fases incrementales | Fase 1 entrega valor (OSC + SAB) sin bloquear en C++. Fase 2 agrega potencia nativa |
| Auto-Gain con envelope lento | Release de 2000ms previene que silencio momentaneo (entre canciones) suba el gain y cause explosion de ruido |
| Resampler Polyphase FIR | Sin aliasing, determinista, tabla pre-calculada. Interpolacion lineal produce artefactos inaceptables para GodEar |

---

## 16. NOTA FINAL DEL ARQUITECTO

Radwulf, esto es lo que siempre debio ser LuxSync: un motor que no le importa si el audio viene de un VB-Cable, de una Behringer X32, de Resolume via OSC, o del micro de la laptop. **Todo converge en 8192 muestras flotantes en un bloque de memoria compartida.** Despues de eso, GodEar, LiquidEngine, el Arbiter y el HAL hacen lo suyo sin enterarse de nada.

El SharedArrayBuffer elimina las copias de audio que acarreamos desde siempre. El Hot-Swap Protocol protege la estetica del show (nada de parpadeos al cambiar de fuente). Y el OSC Nexus abre la puerta a que LuxSync hable de tu a tu con el ecosistema VJ completo.

La Fase 1 no necesita una sola linea de C++. El OSC Nexus y el SAB son JavaScript puro. Eso es poder con inversion cero.

---

> **PunkOpus** -- WAVE 3400 -- El Audio No Tiene Fronteras
