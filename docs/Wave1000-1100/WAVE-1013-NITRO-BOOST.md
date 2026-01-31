# 🏎️ WAVE 1013: NITRO BOOST - 60 FPS TARGET

**Fecha:** 2026-01-27  
**Estado:** 🔴 EN IMPLEMENTACIÓN  
**Objetivo:** Alcanzar 60fps visual + 20fps FFT mediante Overlap Strategy  
**De:** Radwulf & GeminiPunk  
**Para:** Opus (Performance Engineer)

---

## 🎯 OBJETIVO

Romper el límite de velocidad:
- **Visual Layer:** 30fps → **60fps** (Frontend + TitanOrchestrator)
- **Spectral Layer:** 10fps → **20fps** (Worker Beta FFT)
- **Método:** Overlap/Sliding Window para FFT sin perder resolución

---

## ⚡ PILAR 1: FRONTEND OVERCLOCK

### Cambio 1.1: useAudioCapture.ts - Visual a 60fps

```typescript
// ANTES
const METRICS_INTERVAL_MS = 33    // 30fps

// DESPUÉS
const METRICS_INTERVAL_MS = 16    // 60fps (videojuego mode)
```

**Impacto:**
- Bass/mid/treble fluyen a velocidad de videojuego
- Latencia perceptual reducida a la mitad
- Electron puede manejar 60fps sin problemas

### Cambio 1.2: TitanOrchestrator.ts - Loop a 60fps

```typescript
// ANTES
this.mainLoopInterval = setInterval(() => {
  this.processFrame()
}, 33) // ~30fps

// DESPUÉS
this.mainLoopInterval = setInterval(() => {
  this.processFrame()
}, 16) // ~60fps
```

**Impacto:**
- Rendering visual a 60fps
- ArtNet/DMX puede manejar 44Hz standard, 60Hz lo descarta pero animación interna es fluida
- Better responsiveness para beats rápidos

---

## 🌊 PILAR 2: WORKER OVERLAP STRATEGY

### El Problema del FFT 4096

```
Buffer size: 4096 samples
Sample rate: 48000 Hz
Duration: 4096 / 48000 = 85.3ms

Enviar cada 50ms → NO LLENA EL BUFFER (solo 2400 samples)
```

### Solución: Ring Buffer / Sliding Window

```
┌─────────────────────────────────────────────────────┐
│  RING BUFFER (4096 samples)                         │
│                                                      │
│  [████████████████████████████████████████████]     │
│   ^                          ^                      │
│   old (2048)                 new (2048)             │
│                                                      │
│  T=0:   [A A A A] [ - - - - ]                       │
│  T=50:  [A A A A] [B B B B]  ← FFT ejecutado        │
│  T=100: [B B B B] [C C C C]  ← FFT ejecutado        │
│  T=150: [C C C C] [D D D D]  ← FFT ejecutado        │
│                                                      │
│  Overlap: 50% (2048 samples)                        │
│  Update rate: 20fps                                 │
│  Resolution: 4096 samples maintained                │
└─────────────────────────────────────────────────────┘
```

### Cambio 2.1: useAudioCapture.ts - Buffer a 20fps

```typescript
// ANTES
const BUFFER_INTERVAL_MS = 100    // 10fps

// DESPUÉS
const BUFFER_INTERVAL_MS = 50     // 20fps
```

### Cambio 2.2: senses.ts - Ring Buffer Implementation

**NUEVO:** Implementar Ring Buffer interno en Worker Beta:

```typescript
// Estado del Worker
const state = {
  // ... existing state
  ringBuffer: new Float32Array(4096),  // Buffer circular
  ringBufferIndex: 0,                   // Posición de escritura
  ringBufferFilled: false,              // ¿Ya se llenó al menos una vez?
}

function processAudioBuffer(incomingBuffer: Float32Array): ExtendedAudioAnalysis {
  // 1. Copiar incoming al ring buffer
  const incomingLength = incomingBuffer.length  // ~2400 samples @ 50ms
  
  for (let i = 0; i < incomingLength; i++) {
    state.ringBuffer[state.ringBufferIndex] = incomingBuffer[i]
    state.ringBufferIndex = (state.ringBufferIndex + 1) % 4096
  }
  
  if (state.ringBufferIndex >= 4096) {
    state.ringBufferFilled = true
  }
  
  // 2. Solo ejecutar FFT si tenemos buffer completo
  if (!state.ringBufferFilled) {
    return { /* return zeros */ }
  }
  
  // 3. Crear snapshot lineal del ring buffer para FFT
  const fftBuffer = new Float32Array(4096)
  for (let i = 0; i < 4096; i++) {
    const readIndex = (state.ringBufferIndex + i) % 4096
    fftBuffer[i] = state.ringBuffer[readIndex]
  }
  
  // 4. Ejecutar FFT sobre el snapshot
  const agcResult = agc.process(fftBuffer)
  const spectrum = performFFT(agcResult.processedBuffer, 48000)
  // ... rest of analysis
}
```

**Beneficios:**
- **Tasa de refresco:** 10fps → 20fps
- **Resolución FFT:** Mantiene 4096 samples (11.7 Hz por bin)
- **Overlap:** 50% (técnica estándar en análisis espectral)
- **Sin pérdida:** Cada sample se analiza en múltiples ventanas

---

## 🧹 PILAR 3: LIMPIEZA DE CUELLOS DE BOTELLA

### 3.1: Audit de console.log

**Problema:**
```typescript
// 60fps * log de objetos gigantes = IPC saturation
console.log('[Titan]', { giant: objectWithFFTData })
```

**Acción:**
- Buscar todos los console.log en hot paths
- Condicionar con `if (frameCount % N === 0)` 
- Usar logging selectivo solo para debug

### 3.2: Transferable Objects

**Problema actual en useAudioCapture.ts:**
```typescript
window.lux.audioBuffer(rawBuffer)  // ¿Copia o transferencia?
```

**Verificar en IPCHandlers.ts:**
```typescript
ipcMain.on('lux:audioBuffer', (event, data) => {
  const float32 = new Float32Array(data)  // ¿Copia?
  titanOrchestrator.processAudioBuffer(float32)
})
```

**Acción:**
- Si es copia, cambiar a transferencia con `ArrayBuffer`
- Documentar que el buffer se transfiere (no se puede reusar en frontend)

---

## 📊 IMPACTO ESPERADO

### Antes (WAVE 1012.5)
| Layer | FPS | Latencia | Resolución FFT |
|-------|-----|----------|----------------|
| Visual | 30 | 33ms | N/A |
| Spectral | 10 | 100ms | 4096 samples |

### Después (WAVE 1013)
| Layer | FPS | Latencia | Resolución FFT |
|-------|-----|----------|----------------|
| Visual | **60** ✅ | **16ms** ✅ | N/A |
| Spectral | **20** ✅ | **50ms** ✅ | 4096 samples (maintained) ✅ |

**Ganancia total:**
- Visual: 2x más fluido
- Spectral: 2x más reactivo
- Sin pérdida de precisión FFT

---

## ⚠️ RIESGOS Y MITIGACIONES

### Riesgo 1: CPU Saturation
**Síntoma:** Electron laggy, ventilador a full  
**Mitigación:** 
- Monitorear CPU usage con Performance API
- Si >80%, degradar gracefully a 30fps

### Riesgo 2: DMX Frame Drop
**Síntoma:** Luces parpadean por saturación ArtNet  
**Mitigación:**
- ArtNet driver ya descarta frames excesivos
- Internal animation smooth, output throttled by driver

### Riesgo 3: Memory Pressure
**Síntoma:** Heap creciendo por ring buffers  
**Mitigación:**
- Ring buffer es reutilizado, NO crece
- Total overhead: ~32KB (4096 * 4 bytes * 2 buffers)

---

## 🎯 PLAN DE IMPLEMENTACIÓN

### Fase 1: Frontend Overclock (Bajo Riesgo)
1. ✅ Cambiar METRICS_INTERVAL_MS: 33 → 16
2. ✅ Cambiar BUFFER_INTERVAL_MS: 100 → 50
3. ✅ Cambiar TitanOrchestrator loop: 33 → 16
4. ⏳ Test visual: ¿Se ve más fluido?

### Fase 2: Worker Overlap (Medio Riesgo)
1. ✅ Agregar Ring Buffer state (ringBuffer, ringBufferWriteIndex, ringBufferFilled)
2. ✅ Implementar Ring Buffer en processAudioBuffer()
3. ✅ Early return mientras buffer se llena
4. ✅ Crear snapshot lineal para FFT
5. ⏳ Test espectral: ¿harshness/flatness más reactivos?

### Fase 3: Limpieza (Bajo Riesgo)
1. ⏳ Audit console.log en hot paths
2. ⏳ Verificar Transferable Objects
3. ⏳ Performance profiling

---

## 📁 ARCHIVOS A MODIFICAR

```
electron-app/src/hooks/useAudioCapture.ts
  ├─ METRICS_INTERVAL_MS: 33 → 16
  └─ BUFFER_INTERVAL_MS: 100 → 50

electron-app/src/core/orchestrator/TitanOrchestrator.ts
  └─ mainLoopInterval: 33 → 16

electron-app/src/workers/senses.ts
  ├─ Agregar ringBuffer state
  ├─ Implementar sliding window logic
  └─ Modificar processAudioBuffer()
```

---

*"El límite de velocidad no es el hardware. Es el miedo a romperlo."*

— WAVE 1013: Nitro Boost

---

**Estado actual:** � FASE 1 & 2 COMPLETADAS - PENDING TEST  
**Próximo paso:** Testing visual + spectral, luego Fase 3
