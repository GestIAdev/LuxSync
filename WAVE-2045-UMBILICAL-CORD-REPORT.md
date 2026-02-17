# 🎹 WAVE 2045: OPERATION "UMBILICAL CORD" — EXECUTION REPORT

**Fecha**: 2026-02-17  
**Tipo**: Conectividad Externa (MIDI + Audio Input)  
**Estado**: ✅ IMPLEMENTADO  
**Arquitecto**: PunkOpus  
**Comandante**: Radwulf  

---

## 🎯 MISIÓN CUMPLIDA

Tres capacidades nucleares implementadas para conectar LuxSync al mundo exterior:

| Misión | Descripción | Estado |
|--------|-------------|--------|
| 🎹 MIDI Clock In | Chronos obedece a un maestro MIDI externo | ✅ |
| 🎤 Live Audio Input | GodEar escucha por cable/micrófono en tiempo real | ✅ |
| 🎚️ Audio Source Selector | Toggle FILE/LIVE en TransportBar | ✅ |

---

## 📁 ARCHIVOS CREADOS

### 1. `useMIDIClock.ts` (~310 líneas)
**Path**: `electron-app/src/chronos/hooks/useMIDIClock.ts`

```
MIDI Protocol Implementation:
├── 0xF8 (Clock) → BPM calculation via 24 PPQ sliding window
├── 0xFA (Start) → Remote transport start
├── 0xFB (Continue) → Remote transport resume  
├── 0xFC (Stop) → Remote transport stop
├── BPM Hysteresis (0.5 BPM threshold anti-jitter)
├── Signal quality detection (none/weak/stable)
├── Clock timeout (2s → signal lost)
├── Device enumeration + hot-plug support
└── Zero external dependencies (Web MIDI API nativo)
```

**API Pública:**
- `enableMIDI()` / `disableMIDI()` / `toggleSource()`
- `selectDevice(deviceId)` / `refreshDevices()`
- `source: 'internal' | 'midi'`
- `midiBpm: number` (BPM derivado del clock externo)
- `isExternalPlaying: boolean` (transport remoto)
- `signalQuality: 'none' | 'weak' | 'stable'`

### 2. `useLiveAudioInput.ts` (~320 líneas)
**Path**: `electron-app/src/chronos/hooks/useLiveAudioInput.ts`

```
Audio Capture Pipeline:
├── getUserMedia (microphone/line-in)
│   └── echoCancellation: false, noiseSuppression: false
├── getDisplayMedia (system audio loopback)
│   └── Video track killed immediately
├── AudioContext (44100Hz) → AnalyserNode (FFT 4096)
├── Buffer send loop (20fps → window.lux.audioBuffer)
│   └── Same IPC path as useAudioCapture → Senses Worker
├── Metrics loop (60fps → UI level meter)
│   └── RMS calculation + peak tracking
├── audioFrame send (spectrum: bass/mid/treble + 64-bin FFT)
└── Anti-feedback: NOT connected to audioContext.destination
```

**API Pública:**
- `start(sourceType?)` / `stop()`
- `selectDevice(deviceId)` / `enumerateDevices()`
- `metrics: { level, hasSignal, peak }`
- `isActive: boolean`

### 3. SVG Icons (LuxIcons.tsx)
- `MidiClockIcon` — DIN-5 connector con pins + clock mark
- `MicrophoneIcon` — Micrófono con stand
- `LiveSignalIcon` — Punto central con ondas de radio

---

## 📁 ARCHIVOS MODIFICADOS

### 4. `TransportBar.tsx` (+70 líneas)
**Cambios:**
- Imports: MidiClockIcon, MicrophoneIcon, LiveSignalIcon
- Props: 8 nuevas props (midiClockSource, midiSignalQuality, midiBpm, onToggleMidiClock, audioSourceMode, isLiveActive, liveLevel, onToggleAudioSource)
- UI: Botón MIDI (al lado del BPM) con indicador de señal
- UI: Toggle SOURCE (FILE|LIVE) en zona derecha con mini VU meter

### 5. `TransportBar.css` (+130 líneas)
**Estilos:**
- `.ct-midi-btn` — Botón MIDI con estados active/signal-quality
- `.ct-midi-signal` — LED indicador (verde=stable, amarillo=weak, rojo=none)
- `.ct-source-btn` — Toggle FILE/LIVE con colores diferenciados
- `.ct-source-level` — Barra VU horizontal (2px, verde, animada)
- `@keyframes ct-midi-pulse` — Animación de búsqueda de señal

### 6. `ChronosLayout.tsx` (+55 líneas)
**Cambios:**
- Imports: useMIDIClock, useLiveAudioInput
- State: audioSourceMode ('file' | 'live')
- Hook instances: midiClock, liveAudio
- MIDI → BPM sync (useEffect: midiBpm → setBpm)
- MIDI → Transport sync (Start/Stop → streaming.play/stop)
- handleToggleAudioSource: FILE↔LIVE switching
- TransportBar props wiring (8 nuevas props)

---

## 🔄 FLUJO DE DATOS

### MIDI Clock Pipeline:
```
┌──────────────────────┐
│ Ableton / Traktor /  │
│ Pioneer DJM          │
│ (MIDI Clock Master)  │
└────────┬─────────────┘
         │ USB/DIN-5
         ▼
┌──────────────────────┐
│ Web MIDI API         │
│ navigator.request    │
│ MIDIAccess()         │
└────────┬─────────────┘
         │ 0xF8 (24 PPQ)
         ▼
┌──────────────────────┐
│ useMIDIClock         │
│ ├─ 24 clocks = 1 beat│
│ ├─ avg over 8 beats  │
│ ├─ hysteresis 0.5BPM │
│ └─ midiBpm → setBpm  │
└────────┬─────────────┘
         │ 0xFA/0xFC
         ▼
┌──────────────────────┐
│ ChronosLayout        │
│ ├─ BPM override      │
│ ├─ Transport control  │
│ └─ audioStore sync    │
└──────────────────────┘
```

### Live Audio Pipeline:
```
┌──────────────────────┐
│ Microphone / Line-in │
│ / System Loopback    │
└────────┬─────────────┘
         │ PCM audio
         ▼
┌──────────────────────┐
│ getUserMedia         │
│ (no echo cancel,     │
│  no noise suppress)  │
└────────┬─────────────┘
         │ MediaStream
         ▼
┌──────────────────────┐
│ useLiveAudioInput    │
│ ├─ AudioContext      │
│ ├─ AnalyserNode 4096 │
│ ├─ Float32Array      │
│ └─ RMS level meter   │
└────────┬─────────────┘
         │ window.lux.audioBuffer()
         ▼
┌──────────────────────┐
│ Main Process (IPC)   │
│ → Senses Worker      │
│ → GodEar FFT         │
│ → BPM/Beat/Spectrum  │
└────────┬─────────────┘
         │ lux:state-update
         ▼
┌──────────────────────┐
│ TrinityProvider      │
│ → audioStore         │
│ → Lights react! 💡   │
└──────────────────────┘
```

---

## 🛡️ SEGURIDAD & EDGE CASES

| Caso | Comportamiento |
|------|---------------|
| MIDI no soportado | `isSupported = false`, error message |
| MIDI desconectado mid-session | Clock timeout 2s → signal quality: none |
| Micrófono denegado | Error message, cleanup automático |
| MIDI + LIVE simultáneos | ✅ Funciona — MIDI controla BPM, LIVE alimenta GodEar |
| Switch LIVE→FILE | Live capture se detiene, streaming playback disponible |
| Tab pierde foco | setInterval (no RAF) — sigue procesando |
| Audio feedback | AnalyserNode NO conectado a destination (zero feedback) |

---

## 🏗️ ARQUITECTURA: LO QUE NO SE TOCÓ

- **PhantomWorker**: INTACTO — sigue procesando archivos de audio
- **useStreamingPlayback**: INTACTO — sigue haciendo playback de archivos
- **useAudioCapture**: INTACTO — sigue siendo el pipeline de TrinityProvider
- **Senses Worker (GodEar)**: INTACTO — recibe buffers por la misma vía IPC
- **TrinityBrain**: INTACTO — procesa el mismo formato de AudioAnalysis

---

## 🧪 CÓMO TESTEAR

### MIDI Clock:
1. Conectar controlador MIDI por USB
2. Click en botón "INT" (al lado del BPM en TransportBar)
3. Debería cambiar a "MIDI" con LED de señal
4. En Ableton/Traktor: activar "Send MIDI Clock"
5. El BPM de Chronos debería seguir al maestro
6. Play/Stop en el maestro → Chronos responde

### Live Audio:
1. Click en "FILE" (zona derecha del TransportBar)
2. Cambia a "LIVE" con icono de señal
3. Aceptar permiso de micrófono
4. La barra verde en el botón muestra nivel de audio
5. Las luces deberían reaccionar a lo que capte el micro
6. Click de nuevo para volver a "FILE"

---

## 📊 METRICS

| Métrica | Valor |
|---------|-------|
| Archivos creados | 2 hooks + 3 iconos |
| Archivos modificados | 3 (TransportBar, CSS, ChronosLayout) |
| Líneas nuevas | ~850 |
| TypeScript errors | 0 |
| Dependencias externas | 0 (Web MIDI + getUserMedia nativos) |
| Performance overhead | ~0 cuando desactivados |

---

## 🤘 FILOSOFÍA

> "No necesitamos plugins de terceros para escuchar el mundo.
> Chromium ya tiene oídos — solo hay que abrirlos.
> El cordón umbilical conecta a LuxSync con cualquier fuente:
> Un DJ en Ableton, un guitarrista con un cable jack,
> o Spotify sonando por los altavoces.
> Zero dependencies. Maximum connectivity."

— PunkOpus, WAVE 2045 (The Umbilical Cord)

---

**WAVE 2045: OPERATION "UMBILICAL CORD"**  
*Because the light show should follow whatever is playing — not just MP3 files.*
