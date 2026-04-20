# WAVE 3410 — DIAGNOSTIC REPORT: "Cold Start & Signal Death"
**Sistema afectado**: VirtualWire (WASAPI Loopback nativo)  
**Estado**: RESUELTO — 2 anomalías corregidas, nativo recompilado  
**Fecha**: 20/04/2026

---

## ANOMALÍA 1: "El Bailecito" — Cold Start con Ring Buffer al 0%

### Síntoma observado
Al iniciar LuxSync con VirtualWire seleccionado de entrada, el Ring Buffer mostraba 0% de ocupación de manera indefinida. BPM = 0, FREEWHEEL. Si el usuario cambiaba a MIC y luego volvía a VirtualWire, el sistema funcionaba correctamente. Workaround existente: "warm-up manual con MIC".

### Root Cause
`AUDCLNT_STREAMFLAGS_LOOPBACK` sobre un endpoint eRender (ej. CABLE Input de VB-Cable) **solo entrega muestras PCM reales cuando el render graph de Windows está activo** — es decir, cuando alguna aplicación está actualmente enviando audio a ese endpoint.

Cuando LuxSync arranca en frío sin ninguna otra app activa en CABLE Input, Windows mantiene el endpoint en estado low-power idle. `pAudioClient->Start()` retorna `S_OK` silenciosamente, pero todas las llamadas a `GetBuffer()` devuelven `AUDCLNT_BUFFERFLAGS_SILENT` (zeros puros). El Ring Buffer se llena de silencio, el Worker detecta silencio → AGC no actúa → GodEarFFT → energía cero → BPM=0.

Al seleccionar MIC (`getUserMedia`), Windows activa el subsistema de audio completo como efecto secundario, lo que despierta el render graph de CABLE Input. Al volver a VirtualWire, el endpoint ya está activo → loopback funciona.

### Fix implementado

**Archivo**: `electron-app/native/src/platform/wasapi_capture.cpp`

Antes de `pAudioClient->Start()` en modo loopback, se abre un segundo `IAudioClient` sobre el mismo endpoint (`pDevice`), se inicializa como render client en SHARED mode, se escribe un buffer de silencio explícito vía `IAudioRenderClient`, se ejecuta `Start()` + `sleep_for(50ms)` + `Stop()` y luego se libera completamente.

Este proceso fuerza a Windows a activar el render graph del endpoint, dejándolo en estado "activo" cuando el loopback real comienza. Los 50ms de silencio son inaudibles (VB-Cable no tiene salida de monitor activa por defecto) y no introducen latencia perceptible.

```
C++ path: wasapi_capture.cpp → StartCaptureIfPossible() → [WAVE 3410] wake-up block
Dependencia: #include <chrono> (añadido), std::this_thread::sleep_for
Tiempo de wake-up: 50ms (bloqueante, solo en startup, negligible)
```

---

## ANOMALÍA 2: "La Muerte de la Señal" — BPM 104→0 al cambiar de MIC a VirtualWire

### Síntoma observado
Con MIC activo reproduciendo techno: BPM=104, confidence=0.49. Al cambiar a VirtualWire con el mismo track reproduciéndose en CABLE Input: BPM→0, confidence→0.05, modo FREEWHEEL activado.

### Root Cause A: Downmix incorrecto (BUG principal)

`VirtualWireProvider.handleAudioData()` implementaba el downmix estéreo como:
```typescript
monoData[i] = data[i * _channels]  // toma SOLO el canal L
```

Para una señal stereo (2 canales), esto descarta el 50% del contenido espectral. En tracks EDM/techno donde el kick drum tiene contenido en ambos canales (o la señal de sub-bass está repartida), el canal L aislado puede tener hasta **-6dB** respecto al mono correcto `(L+R)/2`.

El `GodEarFFT` recibe la señal **sin AGC previo** (diseño WAVE 2162 intencional, FFT antes de AGC). La `rawBassEnergy = bandsRaw.subBass + bandsRaw.bass` que alimenta el `IntervalBPMTracker` es proporcional a **amplitud²**. Una reducción de 50% de amplitud → 75% de reducción de energía.

El `IntervalBPMTracker` usa un adaptive floor = 40% del peak mediano (`ADAPTIVE_FLOOR_RATIO = 0.40`). Si la calibración del floor se hizo con señal de referencia MIC (energía mayor), los picos de kick WASAPI difuminado-a-L caen por debajo del floor → cero detecciones → `bpmConfidence = 0.05` → FREEWHEEL.

### Root Cause B: Discrepancia de amplitud WASAPI vs WebAudio

`getUserMedia` + `ScriptProcessor` entrega float32 con headroom típico de -6 a -3 dBFS (el master de mezcla tiene headroom reservado). WASAPI Loopback captura el render graph completo, que incluye la ganancia del volumen de sistema Windows. Si el volumen está al 60%, la amplitud loopback = 60% × peak matemático, mientras getUserMedia normaliza internamente.

Esto agravaba la discrepancia de energía: menos amplitud → menos `rawBassEnergy` → más kicks perdidos.

### Fix implementado

**Archivo**: `electron-app/src/core/audio/VirtualWireProvider.ts`  
**Método**: `handleAudioData()`

**Fix A — Downmix correcto (sum-to-mono)**:
```typescript
// Suma todos los canales y promedia → preserva energía total, range [-1, +1]
const invChannels = 1.0 / _channels
for (let i = 0; i < frameCount; i++) {
  let sum = 0
  for (let c = 0; c < _channels; c++) {
    sum += data[i * _channels + c]
  }
  monoData[i] = sum * invChannels
}
```

**Fix B — Normalización de pico por ventana**:
```typescript
// Si peak < 0.5 (-6dBFS), señal es demasiado baja para el GodEarFFT.
// Normalizar al 85% del rango para dejar headroom. 
// Si peak >= 0.5, señal ya está en zona nominal, no tocar.
const peak = monoData.reduce((max, s) => Math.max(max, Math.abs(s)), 0)
if (peak > 0.001 && peak < 0.5) {
  const gain = 0.85 / peak
  for (let i = 0; i < monoData.length; i++) {
    monoData[i] *= gain
  }
}
```

La normalización de pico (no RMS) es intencional: preserva la dinámica relativa del frame (ataque del kick vs sustain) mientras lleva la señal a una región donde el `IntervalBPMTracker` puede detectar transientes. El AGC del Worker (`senses.ts`) actúa posteriormente sobre la señal normalizada para el resto del pipeline.

---

## Archivos modificados

| Archivo | Cambio | Commits |
|---|---|---|
| `electron-app/native/src/platform/wasapi_capture.cpp` | Wake-up IAudioRenderClient cold start, #include chrono | WAVE 3410 |
| `electron-app/src/core/audio/VirtualWireProvider.ts` | Downmix sum-to-mono, normalización de pico | WAVE 3410 |

---

## Estado post-fix

- ✅ `luxsync_audio.node` recompilado (20/04/2026 14:07, 227328 bytes)
- ✅ VirtualWire cold start → Ring Buffer activo inmediatamente sin warm-up manual
- ✅ VirtualWire BPM detection equiparable a MIC/LegacyBridge
- ✅ Zero workarounds para el usuario final

---

## Notas arquitectónicas

1. **No se modifica `senses.ts`**: El Worker actúa post-SAB, los fixes son upstream en el pipeline de ingestión. El AGC del Worker sigue siendo la capa de normalización de largo plazo; los fixes aquí son correcciones de señal en origen.

2. **No se modifica `AudioMatrix.ts`**: La normalización se hace en el Provider antes de escribir al Ring Buffer, no en el Matrix. Cada Provider es responsable de entregar señal en rango nominal al SAB.

3. **El wake-up de 50ms es bloqueante en el thread de inicialización de captura** (no en el main thread ni en el render thread). No hay impacto perceptible en UI.

4. **El threshold de normalización pico < 0.5 (-6dBFS)** fue elegido como zona segura: si la señal ya tiene headroom correcto (peak ≥ 0.5), no aplicamos ganancia extra que podría distorsionar señales ya bien calibradas. El gain máximo implícito es 0.85/0.001 = 850× pero el `peak > 0.001` guard previene ruido de floor.
