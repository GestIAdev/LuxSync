# WAVE 3402 — NATIVE POWER: EXECUTION REPORT

**Fecha**: 2025-06-18  
**Fase**: 2 del OMNI-INPUT-MATRIX-BLUEPRINT  
**Status**: COMPLETADA  
**TypeScript**: 0 errores  
**Tests**: 87/87 passing (suite WAVE 3401 intacta)  

---

## RESUMEN EJECUTIVO

WAVE 3402 implementa la capa nativa de acceso directo al hardware de audio para LuxSync. El addon C++ (N-API v8) captura audio en modo exclusivo — WASAPI en Windows, CoreAudio Hog Mode en macOS, JACK en Linux — bypaseando completamente el DSP del sistema operativo (Loudness Equalization, Room Correction, Dynamic Compression).

Dos nuevos providers (`VirtualWireProvider`, `USBDirectLinkProvider`) conectan el addon nativo al AudioMatrix de WAVE 3401, incluyendo un remuestreador Polyphase FIR y un procesador Auto-Gain pre-FFT.

---

## ARCHIVOS CREADOS

### C++ Native Addon (9 archivos)

| Archivo | Propósito |
|---------|-----------|
| `native/binding.gyp` | Configuración node-gyp: Win/Mac/Linux, C++17, N-API v8 |
| `native/src/common.h` | Header con interfaces abstractas: `ICaptureStream`, `IDeviceEnumerator`, `AudioDeviceInfo` |
| `native/src/luxsync_audio.cpp` | Entry point N-API: `enumerateDevices()`, `startCapture()`, `stopCapture()`, `onDeviceChange()` |
| `native/src/capture_stream.cpp` | Dispatcher de plataforma |
| `native/src/platform/wasapi_capture.cpp` | WASAPI Exclusive Mode — Float32, 256 frames, bypass DSP |
| `native/src/platform/wasapi_enumerator.cpp` | IMMDeviceEnumerator + IMMNotificationClient hot-plug |
| `native/src/platform/coreaudio_capture.cpp` | CoreAudio AUHAL + Hog Mode exclusivo |
| `native/src/platform/coreaudio_enumerator.cpp` | CoreAudio device listing + AudioObjectAddPropertyListener |
| `native/src/platform/jack_capture.cpp` | JACK client capture |
| `native/src/platform/jack_enumerator.cpp` | JACK port enumeration + registration monitoring |

### TypeScript (5 archivos nuevos + 2 modificados)

| Archivo | Propósito |
|---------|-----------|
| `src/core/audio/PolyphaseResampler.ts` | Remuestreador FIR polyphase — ratio 147/160 (48kHz→44.1kHz), Kaiser window, coeficientes deterministas |
| `src/core/audio/AutoGainProcessor.ts` | Envolvente pre-FFT: RMS 500ms, target -18dBFS, attack 200ms, release 2000ms |
| `src/core/audio/NativeAudioBridge.ts` | Wrapper TypeScript del addon C++, singleton, graceful fallback |
| `src/core/audio/VirtualWireProvider.ts` | IInputProvider para VB-Cable / BlackHole / Soundflower |
| `src/core/audio/USBDirectLinkProvider.ts` | IInputProvider para consolas USB + Auto-Gain integrado |
| `src/core/audio/OmniInputTypes.ts` | **MODIFICADO**: AudioDeviceInfo extendido con isLoopback, isExclusiveCapable, driver, sampleRates |
| `package.json` | **MODIFICADO**: +bindings, +node-addon-api, +node-gyp, +asarUnpack nativo |

---

## ESPECIFICACIONES TÉCNICAS

### Polyphase FIR Resampler
- **Algoritmo**: Descomposición polyphase de filtro FIR windowed-sinc
- **Ventana**: Kaiser (β=5.0, -60dB sidelobe attenuation)
- **Taps por fase**: 16
- **Ratio canónico**: 147/160 (48000 → 44100 Hz)
- **Latencia**: < 0.2ms
- **Zero allocation** en hot path
- **Determinista**: coeficientes pre-calculados, sin Math.random()

### Auto-Gain Pre-FFT
- **RMS Window**: 500ms (22050 samples @ 44100Hz)
- **Target**: -18 dBFS (0.12589 linear)
- **Attack**: 200ms (ganancia sube lento)
- **Release**: 2000ms (ganancia baja muy lento — respeta la música)
- **Rango**: -12 dB a +24 dB
- **Hard Clamp**: [-1.0, 1.0]
- **Silence Floor**: -160 dBFS (evita bombeo en silencio)

### WASAPI Exclusive Mode (Windows)
- **Format**: WAVEFORMATEXTENSIBLE Float32
- **Buffer**: 256 frames (5.8ms @ 44100Hz)
- **Thread priority**: Pro Audio (AvSetMmThreadCharacteristics)
- **Fallback**: Shared mode si exclusive falla
- **Hot-plug**: IMMNotificationClient

### CoreAudio Hog Mode (macOS)
- **Capture**: AudioUnit (AUHAL) con kAudioOutputUnitProperty_EnableIO
- **Exclusive**: kAudioDevicePropertyHogMode via AudioObjectSetPropertyData
- **Format**: Float32 IsNonInterleaved
- **Deployment target**: macOS 11.0

### JACK (Linux)
- **Client**: jack_client_open con JackNoStartServer
- **Auto-connect**: First physical capture port
- **Xrun tracking**: jack_set_xrun_callback
- **Hot-plug**: jack_set_port_registration_callback

---

## PIPELINE DE AUDIO COMPLETO

```
Hardware / VB-Cable / Console USB
       ↓
[C++ Native Addon] (WASAPI/CoreAudio/JACK, Exclusive Mode)
       ↓
[NativeAudioBridge] (N-API ThreadSafeFunction → JS callback)
       ↓
[VirtualWireProvider / USBDirectLinkProvider]
  ├── Mono Downmix (if multichannel)
  ├── Polyphase FIR Resampler (if rate ≠ 44100)
  └── Auto-Gain Pre-FFT (USBDirectLink only)
       ↓
[AudioMatrix] (WAVE 3401 — hot-swap, priority chain, silence detection)
       ↓
[SharedRingBuffer] (SAB 32784 bytes, SPSC lock-free)
       ↓
[BETA Worker / GodEarFFT] (4096-sample FFT analysis)
```

---

## AXIOMA ANTI-SIMULACIÓN: CUMPLIMIENTO

- **PolyphaseResampler**: Coeficientes calculados por fórmula matemática cerrada (Bessel I₀, sinc, Kaiser). Zero uso de Math.random().
- **AutoGainProcessor**: Envolvente exponencial one-pole con constantes derivadas de la fórmula `α = 1 - exp(-1/(SR × T))`. Determinista.
- **Native Addon**: Captura real de hardware vía APIs del sistema operativo. Sin mocks ni simulación.

---

## INTEGRACIÓN CON WAVE 3401

Los nuevos providers implementan `IInputProvider` y se registran en `AudioMatrix` igual que `LegacyBridgeProvider`. La cadena de prioridad predeterminada:

```typescript
['usb-directlink', 'virtual-wire', 'legacy-bridge', 'osc-nexus']
```

USB DirectLink tiene la máxima prioridad (hardware dedicado → señal más limpia).
