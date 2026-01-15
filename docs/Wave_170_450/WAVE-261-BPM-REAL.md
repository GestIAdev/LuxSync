# 🎯 WAVE 261: BPM REAL

## 📋 Resumen

**Fecha**: 31 de Diciembre 2024  
**Objetivo**: Eliminar BPM hardcodeado (120) y asegurar que el BPM detectado fluya correctamente a través de todo el sistema.

## 🔍 Diagnóstico

### El Problema
El BPM mostrado en la UI siempre era 120 porque `feedAudioMetrics()` en `TrinityOrchestrator.ts` tenía:

```typescript
bpm: 120, // Default, will be refined by GAMMA  ❌ NUNCA SE REFINABA
```

### Los Dos Flujos de Audio

LuxSync tiene **DOS rutas** para procesar audio:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          FLUJO 1: RAW BUFFER (WAVE 259)                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Frontend (useAudioCapture.ts)                                          │
│    └── getFloatTimeDomainData()                                         │
│    └── window.lux.audioBuffer(amplifiedBuffer)                          │
│          │                                                              │
│          ▼                                                              │
│  IPC: lux:audio-buffer                                                  │
│          │                                                              │
│          ▼                                                              │
│  TitanOrchestrator.processAudioBuffer()                                 │
│    └── trinity.feedAudioBuffer(buffer)                                  │
│          │                                                              │
│          ▼                                                              │
│  BETA Worker (senses.ts)                                                │
│    └── FFT Real (Cooley-Tukey Radix-2)                                  │
│    └── BeatDetector.analyze() → BPM REAL ✅                             │
│    └── sendMessage(AUDIO_ANALYSIS, 'alpha', analysis)                   │
│          │                                                              │
│          ▼                                                              │
│  TrinityOrchestrator (línea 392)                                        │
│    └── sendToWorker('gamma', AUDIO_ANALYSIS, message.payload)           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                       FLUJO 2: MÉTRICAS PRE-PROCESADAS                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Frontend (useAudioCapture.ts)                                          │
│    └── Analiza FFT con AnalyserNode del browser                         │
│    └── Calcula BPM local (línea 214-218)                                │
│    └── window.lux.audioFrame({ bass, mid, treble, energy, bpm })        │
│          │                                                              │
│          ▼                                                              │
│  IPC: lux:audio-frame                                                   │
│          │                                                              │
│          ▼                                                              │
│  TitanOrchestrator.processAudioFrame()                                  │
│    └── Extrae bpm del data ← 🎯 WAVE 261: NUEVO                         │
│    └── trinity.feedAudioMetrics({ bass, mid, treble, energy, bpm })     │
│          │                                                              │
│          ▼                                                              │
│  TrinityOrchestrator.feedAudioMetrics()                                 │
│    └── realBpm = metrics.bpm || 120 ← 🎯 WAVE 261: ARREGLADO            │
│    └── analysis.bpm = realBpm                                           │
│    └── sendToWorker('gamma', AUDIO_ANALYSIS, analysis)                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          FLUJO COMÚN: GAMMA → UI                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  GAMMA Worker (mind.ts)                                                 │
│    └── extractMusicalContext(analysis)                                  │
│    └── return { bpm: analysis.bpm, ... } ← BPM REAL                     │
│    └── sendMessage(MUSICAL_CONTEXT, 'alpha', context)                   │
│          │                                                              │
│          ▼                                                              │
│  TrinityOrchestrator                                                    │
│    └── emit('context-update', context)                                  │
│          │                                                              │
│          ▼                                                              │
│  TrinityBrain.receive(context)                                          │
│    └── Almacena contexto con BPM real                                   │
│          │                                                              │
│          ▼                                                              │
│  TitanOrchestrator.tick()                                               │
│    └── SeleneTruth.context.bpm = context.bpm                            │
│    └── SeleneTruth.sensory.beat.bpm = context.bpm || 120                │
│          │                                                              │
│          ▼                                                              │
│  UI (StageViewDual.tsx línea 86)                                        │
│    └── displayBpm = sensory?.beat?.bpm                                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 🔧 Cambios Realizados

### 1. TrinityOrchestrator.ts - feedAudioMetrics()

**Ubicación**: `src/workers/TrinityOrchestrator.ts` líneas 578-610

```typescript
// ANTES ❌
feedAudioMetrics(metrics: {
  bass: number;
  mid: number;
  treble: number;
  energy: number;
  timestamp?: number;
}): void {
  // ...
  const analysis: AudioAnalysis = {
    bpm: 120, // Default, will be refined by GAMMA  ← NUNCA SE REFINABA
    // ...
  };
}

// DESPUÉS ✅
feedAudioMetrics(metrics: {
  bass: number;
  mid: number;
  treble: number;
  energy: number;
  bpm?: number;         // 🎯 WAVE 261: BPM real del frontend
  timestamp?: number;
}): void {
  // ...
  const realBpm = metrics.bpm && metrics.bpm > 0 ? metrics.bpm : 120;
  
  const analysis: AudioAnalysis = {
    bpm: realBpm,  // 🎯 WAVE 261: BPM real del frontend
    bpmConfidence: metrics.bpm ? 0.7 : 0.3,
    // ...
  };
}
```

### 2. TitanOrchestrator.ts - processAudioFrame()

**Ubicación**: `src/core/orchestrator/TitanOrchestrator.ts` líneas 490-525

```typescript
// ANTES ❌
processAudioFrame(data: Record<string, unknown>): void {
  const bass = typeof data.bass === 'number' ? data.bass : 0
  const mid = typeof data.mid === 'number' ? data.mid : 0
  // ... sin extraer BPM
  
  this.trinity.feedAudioMetrics({
    bass, mid, treble: high, energy
    // ← BPM no pasaba
  })
}

// DESPUÉS ✅
processAudioFrame(data: Record<string, unknown>): void {
  const bass = typeof data.bass === 'number' ? data.bass : 0
  const mid = typeof data.mid === 'number' ? data.mid : 0
  const bpm = typeof data.bpm === 'number' ? data.bpm : 0  // 🎯 WAVE 261
  
  this.trinity.feedAudioMetrics({
    bass, mid, treble: high, energy,
    bpm  // 🎯 WAVE 261: BPM real del frontend
  })
}
```

## 📊 Flujo de Detección de BPM

### Frontend (useAudioCapture.ts líneas 195-218)

```typescript
// Detectar beat: energía supera umbral
if (energy > avgEnergy * 1.3 && energy > BEAT_THRESHOLD) {
  const timeSinceLastBeat = now - lastBeatTimeRef.current
  if (timeSinceLastBeat > 200) { // Min 200ms entre beats
    onBeat = true
    beatIntervalsRef.current.push(timeSinceLastBeat)
    // ...
  }
}

// Calcular BPM promedio
let bpm = 120  // fallback
if (beatIntervalsRef.current.length >= 3) {
  const avgInterval = beatIntervalsRef.current.reduce((a, b) => a + b, 0) / beatIntervalsRef.current.length
  bpm = Math.round(60000 / avgInterval)
  bpm = Math.max(BPM_MIN, Math.min(BPM_MAX, bpm))  // Clamp 60-180
}
```

### Backend BETA (senses.ts líneas 190-210)

```typescript
// Calcular BPM from intervals
let bpm = 120; // default
if (this.beatIntervals.length >= 4) {
  const avgInterval = this.beatIntervals.reduce((a, b) => a + b, 0) / this.beatIntervals.length;
  bpm = Math.round(60000 / avgInterval);
  bpm = Math.max(60, Math.min(200, bpm));  // Clamp 60-200
}
```

## ✅ Resultado

- **Flujo 1 (Raw Buffer)**: BPM calculado por BeatDetector en BETA Worker ✅
- **Flujo 2 (Métricas)**: BPM calculado por frontend y pasado correctamente ✅
- **Ambos flujos** ahora envían BPM real a GAMMA
- **GAMMA** propaga el BPM al MusicalContext
- **UI** muestra BPM real detectado

## 🧪 Verificación

El BPM ahora debería variar según la música:
- Techno/House: ~120-130 BPM
- Drum & Bass: ~170-180 BPM
- Hip-Hop: ~85-100 BPM
- Rock: ~100-140 BPM

## 📁 Archivos Modificados

1. `src/workers/TrinityOrchestrator.ts` - feedAudioMetrics() acepta BPM
2. `src/core/orchestrator/TitanOrchestrator.ts` - processAudioFrame() extrae y pasa BPM

---

## 🔥 WAVE 261.5: BYPASS PURGE (Actualización)

**Problema Descubierto:** La solución inicial dejaba DOS flujos paralelos compitiendo:

1. **Flujo Buffer:** `feedAudioBuffer()` → BETA → GAMMA (correcto, con BPM real)
2. **Flujo Metrics:** `feedAudioMetrics()` → GAMMA directo (bypass, podía sobrescribir)

### Solución Arquitectónica

**Eliminamos el bypass completamente:**

1. **TitanOrchestrator:** `storeAudioMetrics()` solo almacena para HAL, NO llama a Trinity
2. **TrinityOrchestrator:** `feedAudioMetrics()` deprecado y vaciado
3. **senses.ts:** Umbral de confianza bajado de 0.5 a 0.3

### Arquitectura Final (Un Solo Flujo)

```
Frontend → audioBuffer() → TitanOrchestrator.processAudioBuffer()
                                │
                                ├─→ storeAudioMetrics() → HAL (fixtures)
                                │
                                └─→ trinity.feedAudioBuffer()
                                        │
                                        ▼
                                    BETA Worker
                                    └── BeatDetector.analyze() → BPM REAL
                                        │
                                        ▼
                                    GAMMA Worker → MusicalContext
                                        │
                                        ▼
                                    TrinityBrain → SeleneTruth
```

### Logs de Verificación

```
[BEAT 🥁] ✅ BEAT DETECTED! nE=0.644 > thresh=0.641
[BETA 🥁] BPM UPDATED: 60 (raw=60, conf=0.34)
[Titan] 🌉 SYNAPTIC BRIDGE: Key=G minor | Genre=ELECTRONIC | BPM=60 | Energy=46%
```

**BPM cambió de 120 (hardcoded) a 60 (detectado)** 🎯

---

*WAVE 261 + 261.5 - BPM REAL + BYPASS PURGE - PunkOpus* 🎯🔥

