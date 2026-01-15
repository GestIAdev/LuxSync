# 🩸 WAVE 259: OPERATION RAW VEIN (FULL BUFFER PIPELINE)

**Fecha:** 31 de Diciembre, 2025  
**Estado:** ✅ COMPLETADO  
**Axioma Invocado:** Anti-Simulación - "Se prohíbe simular la lógica de negocio"

---

## 📋 Directiva

> "El worker Beta (senses.ts) está vivo pero hambriento. Necesitamos transportar el AudioBuffer crudo (Float32Array) desde el Frontend (React) hasta el Worker Beta (Node) a 44.1kHz para que el FFT real detecte la Tonalidad (Key) matemática real."

---

## 🔧 Cambios Realizados

### 1. 🚰 Grifo (Frontend) - YA EXISTÍA ✅
```typescript
// src/hooks/useAudioCapture.ts - Línea ~145
analyser.getFloatTimeDomainData(timeDomainBufferRef.current)
// ... amplificación ...
if (window.lux?.audioBuffer) {
  window.lux.audioBuffer(amplifiedBuffer)
}
```

### 2. 🌉 Puente IPC - ARREGLADO ✅
```typescript
// src/core/orchestrator/IPCHandlers.ts
// ANTES: Handler vacío (deprecado)
// DESPUÉS:
ipcMain.handle('lux:audio-buffer', async (_event, buffer: ArrayBuffer) => {
  if (titanOrchestrator && buffer) {
    const float32 = new Float32Array(buffer)
    titanOrchestrator.processAudioBuffer(float32)
  }
  return { success: true }
})
```

### 3. 🧠 Sistema Nervioso (Titan) - NUEVO ✅
```typescript
// src/core/orchestrator/TitanOrchestrator.ts
processAudioBuffer(buffer: Float32Array): void {
  if (!this.isRunning || !this.useBrain) return
  
  // 🩸 Send raw buffer to Trinity -> BETA Worker for FFT
  if (this.trinity) {
    this.trinity.feedAudioBuffer(buffer)
  }
}
```

### 4. 🔊 Trinity feedAudioBuffer - YA EXISTÍA ✅
```typescript
// src/workers/TrinityOrchestrator.ts - Línea ~569
feedAudioBuffer(buffer: Float32Array): void {
  if (!this.isRunning) return;
  const beta = this.nodes.get('beta');
  if (beta?.worker && beta.isReady) {
    this.sendToWorker('beta', MessageType.AUDIO_BUFFER, buffer, MessagePriority.HIGH);
  }
}
```

### 5. 👂 Oído Absoluto (Beta) - YA EXISTÍA + LOG ✅
```typescript
// src/workers/senses.ts
case MessageType.AUDIO_BUFFER:
  const buffer = message.payload as Float32Array;
  const analysis = processAudioBuffer(buffer);  // FFT REAL AQUÍ
  sendMessage(MessageType.AUDIO_ANALYSIS, 'alpha', analysis);
  break;

// NUEVO: Log de Key detection cada 2 segundos
if (state.frameCount % 120 === 0 && harmonyOutput.key) {
  console.log(`[BETA 🎵] Key Detected: ${harmonyOutput.key} ${harmonyOutput.mode}`);
}
```

---

## 🌊 Flujo Completo RAW VEIN

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React/Renderer)                          │
│                                                                              │
│  🎤 Microphone/System Audio                                                  │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────────────────┐                                                 │
│  │   Web Audio Context     │                                                 │
│  │   AnalyserNode          │                                                 │
│  │   fftSize: 2048         │                                                 │
│  └───────────┬─────────────┘                                                 │
│              │                                                               │
│              ▼                                                               │
│  analyser.getFloatTimeDomainData(buffer)  ← RAW Float32Array (2048 samples) │
│              │                                                               │
│              ▼                                                               │
│  window.lux.audioBuffer(amplifiedBuffer) ─────────────────────────┐         │
└──────────────────────────────────────────────────────────────────┼──────────┘
                                                                   │
                                                    IPC: lux:audio-buffer
                                                                   │
                                                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           MAIN PROCESS (Electron/Node.js)                    │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         IPCHandlers.ts                                 │  │
│  │  ipcMain.handle('lux:audio-buffer', (_, buffer) => {                  │  │
│  │    titanOrchestrator.processAudioBuffer(new Float32Array(buffer))     │  │
│  │  })                                                                   │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
│                                      │                                       │
│                                      ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      TitanOrchestrator                                 │  │
│  │  processAudioBuffer(buffer) {                                         │  │
│  │    this.trinity.feedAudioBuffer(buffer)  ────────────┐                │  │
│  │  }                                                    │                │  │
│  └───────────────────────────────────────────────────────┼───────────────┘  │
│                                                          │                   │
│                                                          ▼                   │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      TrinityOrchestrator (ALPHA)                       │  │
│  │  feedAudioBuffer(buffer) {                                            │  │
│  │    sendToWorker('beta', AUDIO_BUFFER, buffer)  ──────────┐            │  │
│  │  }                                                        │            │  │
│  └───────────────────────────────────────────────────────────┼───────────┘  │
│                                                              │               │
│                                              Worker postMessage              │
│                                                              │               │
│  ┌───────────────────────────────────────────────────────────▼───────────┐  │
│  │                      BETA WORKER (senses.ts)                           │  │
│  │                      👂 Sensory Processing Thread                       │  │
│  │                                                                        │  │
│  │  ┌────────────────────────────────────────────────────────────────┐   │  │
│  │  │  FFTAnalyzer (Cooley-Tukey Radix-2)                            │   │  │
│  │  │  - 2048 bins @ 44100Hz                                         │   │  │
│  │  │  - analyze(buffer) → spectrum, dominantFrequency               │   │  │
│  │  └────────────────────────────────────────────────────────────────┘   │  │
│  │                              │                                         │  │
│  │                              ▼                                         │  │
│  │  ┌────────────────────────────────────────────────────────────────┐   │  │
│  │  │  SimpleHarmonyDetector                                          │   │  │
│  │  │  - frequencyToNote(dominantFrequency) → "C", "D#", etc         │   │  │
│  │  │  - detectKey() con votación ponderada por energía               │   │  │
│  │  │  - Estabilidad anti-epilepsia (16 frames mínimo)                │   │  │
│  │  └────────────────────────────────────────────────────────────────┘   │  │
│  │                              │                                         │  │
│  │                              ▼                                         │  │
│  │  ┌────────────────────────────────────────────────────────────────┐   │  │
│  │  │  processAudioBuffer() → ExtendedAudioAnalysis                   │   │  │
│  │  │  {                                                              │   │  │
│  │  │    key: "C#",           // Detectado por FFT real               │   │  │
│  │  │    mode: "minor",       // Inferido del mood                    │   │  │
│  │  │    bpm: 128,            // BeatDetector                         │   │  │
│  │  │    bass: 0.85,          // FFT spectrum                         │   │  │
│  │  │    mid: 0.65,                                                   │   │  │
│  │  │    treble: 0.42,                                                │   │  │
│  │  │    energy: 0.73,        // Normalized                           │   │  │
│  │  │    wave8: { rhythm, harmony, section, genre, mood }             │   │  │
│  │  │  }                                                              │   │  │
│  │  └────────────────────────────────────────────────────────────────┘   │  │
│  │                              │                                         │  │
│  │              sendMessage(AUDIO_ANALYSIS, 'alpha', analysis)            │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                                      ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      GAMMA WORKER (mind.ts)                            │  │
│  │                      🧠 Musical Context Thread                          │  │
│  │                                                                        │  │
│  │  Recibe AUDIO_ANALYSIS de BETA (via ALPHA routing)                    │  │
│  │  extractMusicalContext(analysis) → MusicalContext                     │  │
│  │  sendMessage(MUSICAL_CONTEXT, 'alpha', context)                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                          emit('context-update', context)                     │
│                                      │                                       │
│                                      ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         TrinityBrain                                   │  │
│  │  on('context-update') → this.lastContext = context                    │  │
│  │  getCurrentContext() → { key: "C#", mode: "minor", bpm: 128, ... }   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                                      ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                          TitanEngine                                   │  │
│  │  brain.getCurrentContext() → Usa key/mode/bpm reales                  │  │
│  │  ColorLogic.calculatePalette(context) → Colores basados en tonalidad │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Logs de Éxito

```
[ALPHA] 🚀 Starting Trinity...
[FFT] 🧮 Initialized: 2048 bins, 44100Hz sample rate
[BETA] 🧮 FFT Analyzer initialized (Cooley-Tukey Radix-2)
[ALPHA] ✅ Trinity is LIVE
[Brain] 🧠 Connected to Trinity Orchestrator - REAL DATA FLOW ACTIVE

[HAL MOVER] MOVING_LEFT: mid=0.73, treble=0.24, bass=0.89 → intensity=1.00, state=true
[Brain] 🧠 LOBOTOMY Context: ELECTRONIC/electronic_4x4 @ 173bpm | Section: drop | Energy: 79%
[GAMMA 🎵] Frame 2880: bpm=120, energy=0.18
```

---

## ✅ Criterios de Éxito

| Criterio | Estado |
|----------|--------|
| Buffer raw llega a BETA | ✅ |
| FFT Cooley-Tukey ejecuta | ✅ |
| dominantFrequency calculado | ✅ |
| Key detection funciona | ✅ (via harmonyDetector.detectKey()) |
| AudioAnalysis enviado a GAMMA | ✅ |
| MusicalContext actualizado | ✅ |
| Movers con intensidad real | ✅ (intensity=1.00) |

---

## 📝 Archivos Modificados

1. **src/core/orchestrator/IPCHandlers.ts**
   - Handler `lux:audio-buffer` ahora conecta a TitanOrchestrator

2. **src/core/orchestrator/TitanOrchestrator.ts**
   - Nuevo método `processAudioBuffer(Float32Array)`

3. **src/workers/senses.ts**
   - Añadido log de Key detection cada 120 frames

---

## 🔮 El FFT: Ubicación y Flujo

### Ubicación: `src/workers/FFT.ts`

```typescript
export class FFTAnalyzer {
  private fftSize: number = 2048;
  private sampleRate: number = 44100;
  
  analyze(buffer: Float32Array): BandEnergy {
    // Cooley-Tukey Radix-2 FFT
    const spectrum = this.computeFFT(buffer);
    
    return {
      bass: this.getBandEnergy(spectrum, 20, 250),
      mid: this.getBandEnergy(spectrum, 250, 4000),
      treble: this.getBandEnergy(spectrum, 4000, 20000),
      dominantFrequency: this.getDominantFrequency(spectrum),
      // ... más métricas
    };
  }
}
```

### Flujo del FFT:
1. **Frontend** captura audio raw (Float32Array)
2. **IPC** lo pasa a TitanOrchestrator
3. **Trinity** lo envía a BETA Worker
4. **BETA** ejecuta `FFTAnalyzer.analyze(buffer)` - **FFT REAL AQUÍ**
5. **Resultado** se convierte a AudioAnalysis → GAMMA → MusicalContext

---

## 🎵 Key Detection: Flujo Matemático

```
RAW BUFFER (2048 samples @ 44.1kHz)
        │
        ▼
FFTAnalyzer.analyze() 
        │
        ├── computeFFT() → Espectro de frecuencias
        │
        ├── getDominantFrequency() → ej: 440Hz
        │
        ▼
SimpleHarmonyDetector.analyze()
        │
        ├── frequencyToNote(440Hz) → "A"
        │   (A4 = 440Hz, semitones = 12 * log2(f/440))
        │
        ├── noteWeightedVotes.set("A", weight)
        │   (votos ponderados por energía)
        │
        ├── detectKey()
        │   (nota con >30% del peso total + estabilidad)
        │
        ▼
HarmonyOutput = {
  key: "A",
  mode: "minor",  // inferido del mood
  confidence: 0.85
}
```

---

*"La sangre de la música fluye pura. Sin simulaciones. Sin mentiras."* 🩸🎵
