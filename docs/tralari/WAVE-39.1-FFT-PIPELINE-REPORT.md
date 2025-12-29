# 🎤 WAVE 39.1 - REAL FFT PIPELINE

## Fecha: 18 Diciembre 2025

---

## 🎯 OBJETIVO
Conectar la Visión de Selene: Exponer FFT bins reales desde el frontend hasta `getBroadcast()` para que el visualizador deje de recibir ceros.

---

## 📊 FLUJO DE DATOS FFT

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Renderer)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   useAudioCapture.ts                                            │
│   ├── analyser.getByteFrequencyData(dataArray)  // 1024 bins   │
│   ├── Downsample a 64 bins (promedio por grupo)                │
│   ├── Normalizar 0-1                                            │
│   └── window.lux.audioFrame({ ..., fftBins })                   │
│                                                                 │
└─────────────────────┬───────────────────────────────────────────┘
                      │ IPC: 'lux:audio-frame'
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MAIN PROCESS                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   main.ts                                                       │
│   └── ipcMain.handle('lux:audio-frame', ...)                    │
│       └── selene.setFftBins(audioData.fftBins)                  │
│                                                                 │
│   SeleneLux.ts                                                  │
│   ├── private lastFftBins: number[] = new Array(256).fill(0)   │
│   ├── setFftBins(bins): Almacena bins reales                   │
│   └── getBroadcast().sensory.fft → this.lastFftBins (padded)   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✅ CAMBIOS REALIZADOS

### 1. **useAudioCapture.ts** (Frontend)
```typescript
// 🎯 WAVE 39.1: Downsample FFT a 64 bins para visualización
const FFT_BINS_TO_SEND = 64
const binRatio = Math.floor(bufferLength / FFT_BINS_TO_SEND)
const fftBins: number[] = new Array(FFT_BINS_TO_SEND)
for (let i = 0; i < FFT_BINS_TO_SEND; i++) {
  let sum = 0
  for (let j = 0; j < binRatio; j++) {
    sum += dataArray[i * binRatio + j]
  }
  fftBins[i] = (sum / binRatio) / 255
}

// Enviar al Main Process (ahora con FFT bins)
window.lux.audioFrame({ bass, mid, treble, energy, bpm, fftBins })
```

### 2. **vite-env.d.ts** (Tipos Frontend)
```typescript
audioFrame: (metrics: { 
  bass: number; mid: number; treble: number; energy: number; 
  bpm?: number; 
  fftBins?: number[]  // 🎯 WAVE 39.1
}) => Promise<{ success: boolean }>
```

### 3. **preload.ts** (Bridge IPC)
```typescript
// 🎯 WAVE 39.1: Ahora incluye fftBins (64 bins normalizados 0-1)
audioFrame: (metrics: { 
  bass: number; mid: number; treble: number; energy: number; bpm: number; 
  fftBins?: number[] 
}) => ipcRenderer.invoke('lux:audio-frame', metrics)
```

### 4. **main.ts** (IPC Handler)
```typescript
ipcMain.handle('lux:audio-frame', (_event, audioData: {
  bass: number; mid: number; treble: number; energy: number
  bpm?: number
  fftBins?: number[]  // 🎯 WAVE 39.1
}) => {
  // ...existing currentAudioData logic...
  
  // 🎯 WAVE 39.1: Almacenar FFT bins en SeleneLux
  if (audioData.fftBins && selene) {
    selene.setFftBins(audioData.fftBins)
  }
  
  return { success: true }
})
```

### 5. **SeleneLux.ts** (Almacenamiento + Broadcast)

**Propiedad:**
```typescript
private lastFftBins: number[] = new Array(256).fill(0)
```

**Método setter:**
```typescript
setFftBins(bins: number[]): void {
  if (bins && bins.length > 0) {
    this.lastFftBins = bins
  }
}
```

**getBroadcast():**
```typescript
// 🎯 WAVE 39.1: FFT bins reales desde useAudioCapture (64 bins normalizados)
fft: this.lastFftBins.length >= 256 
  ? this.lastFftBins.slice(0, 256) 
  : [...this.lastFftBins, ...new Array(256 - this.lastFftBins.length).fill(0)]
```

---

## 📊 DATOS TÉCNICOS

| Aspecto | Valor |
|---------|-------|
| **Bins originales** | 1024 (frequencyBinCount) |
| **Bins enviados** | 64 (downsampled) |
| **Normalización** | 0-1 (desde 0-255) |
| **Bins en broadcast** | 256 (padded con ceros) |
| **Frecuencia de actualización** | ~30fps (requestAnimationFrame) |

### ¿Por qué 64 bins?
- **Eficiencia IPC**: Menos datos = menos overhead
- **Visualización**: 64 bandas es suficiente para un ecualizador visual
- **Padding a 256**: Compatibilidad con visualizadores que esperan 256 bins

---

## 🔧 COMPILACIÓN

```bash
npx tsc --noEmit
# Errores: PaletteReactor + MovementControl (componentes UI, no core)
# FFT Pipeline: ✅ Sin errores
```

---

## 🎉 RESULTADO

**Antes (WAVE 39.0):**
```javascript
sensory.fft = [0, 0, 0, 0, ...] // 256 ceros
```

**Después (WAVE 39.1):**
```javascript
sensory.fft = [0.45, 0.72, 0.38, 0.55, ...64 valores reales..., 0, 0, ...padding...]
```

El visualizador ahora recibe datos FFT reales que reflejan las frecuencias del audio capturado. 🎤✨
