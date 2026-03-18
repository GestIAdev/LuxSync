# WAVE 2118: THE FREQUENCY SCALPEL 🔪

**Commit:** `3a4e0ab`  
**Archivos modificados:** `senses.ts`, `GodEarBPMTracker.ts`  
**Tests:** 18/18 ✅  
**Errores de compilación:** 0  

---

## 🩺 DIAGNÓSTICO

### Síntoma
Tras WAVE 2117, el BPM se bloquea en **161** en vez de ~126 al reproducir Boris Brejcha.

### Evidencia del Log (`debugBPM.md`)
```
[🥁 GODEAR BPM] 161bpm (raw=161) conf=0.40 kicks=13 intervals=[372,325,372,325,372,372]
[🥁 GODEAR BPM] 161bpm (raw=161) conf=0.74 kicks=39 intervals=[372,325,557,279,511,279]
```

- **372ms** = offbeat bass (no kicks reales)
- **279ms** = sub-beats contaminando
- **511ms** = kicks reales (~117 BPM)
- El IQR no filtra offbeats porque **son rítmicos y consistentes**

### Causa Raíz
```typescript
// ANTES (WAVE 1162):
rawBassEnergy = subBass + bass  // PESO IGUAL
```

El offbeat bass de Brejcha vive en **80-150Hz** (banda `bass`).  
El kick real vive en **40-50Hz** (banda `subBass`).  
Con peso igual, ambos producían picos similares → el tracker no podía distinguirlos.

---

## 🔪 LA CIRUGÍA

### Fórmula Ponderada (The Frequency Scalpel)
```typescript
// WAVE 2118:
const trackerEnergy = (spectrum.rawSubBassEnergy * 1.5) + (spectrum.rawBassOnlyEnergy * 0.4);
```

### Matemática del Foso

| Evento | subBass | bass | trackerEnergy | vs Promedio |
|--------|---------|------|---------------|-------------|
| **Kick real** (40-50Hz) | 0.25 | 0.05 | 0.395 | **ALTO** |
| **Offbeat bass** (80-150Hz) | 0.03 | 0.20 | 0.125 | **BAJO** |
| **Noise floor** | 0.02 | 0.03 | 0.042 | baseline |

- Kick produce **3.16×** más trackerEnergy que offbeat
- Offbeat produce solo **2.98×** el noise floor → **bajo el KICK_RATIO_THRESHOLD de 1.7**
- El foso entre kick y offbeat es de **~3:1** — discriminación natural

### Qué NO se tocó
- `rawBassEnergy` (subBass + bass sin ponderar) → **intacto** para BeatDetector e IPC
- `KICK_RATIO_THRESHOLD` → se mantiene en **1.7** (el Arquitecto lo validó)
- `KICK_DELTA_THRESHOLD` → se mantiene en **0.015**
- IQR filtering → intacto
- Adaptive debounce → intacto

### Campos Nuevos Expuestos
```typescript
rawSubBassEnergy: number;   // 20-60Hz RMS pre-AGC
rawBassOnlyEnergy: number;  // 60-250Hz RMS pre-AGC
```
Añadidos al return de `SpectrumAnalyzer.analyze()` para permitir la ponderación en el call site del tracker.

---

## 📐 ARQUITECTURA DEL CAMBIO

```
GodEarFFT.analyze()
  ↓ bandsRaw.subBass (20-60Hz)
  ↓ bandsRaw.bass (60-250Hz)
  ↓
SpectrumAnalyzer.analyze()
  ├─ rawBassEnergy = subBass + bass        → BeatDetector, IPC (sin cambio)
  ├─ rawSubBassEnergy = subBass            → NUEVO
  └─ rawBassOnlyEnergy = bass              → NUEVO
  ↓
processAudioBuffer()
  ↓
  trackerEnergy = subBass×1.5 + bass×0.4   → 🔪 WAVE 2118
  ↓
GodEarBPMTracker.process(trackerEnergy, kickDetected, timestamp)
```

---

## 🧪 TESTS

**18/18 PASSED** — Los tests alimentan energía directamente al tracker (no pasan por senses.ts), por lo que la fórmula ponderada no afecta la suite existente. El test del Brejcha (TEST 7) sigue en verde porque el `SyntheticBeatGenerator` ya separa kicks de offbeats por energía sintética.

---

## 📊 LÍNEA TEMPORAL BPM

| WAVE | Fix | Resultado |
|------|-----|-----------|
| 2112 | Resurrect GodEarBPMTracker | Tracker existe pero BPM inestable |
| 2113 | 6-genre test suite | 15/15 (luego 18/18) tests |
| 2116 | IQR + thresholds agresivos | BPM=0 permanente |
| 2117 | Thresholds recalibrados | BPM=161 bloqueado |
| **2118** | **FREQUENCY SCALPEL** | **subBass×1.5 + bass×0.4** |

---

## ⚠️ INSTRUCCIONES PARA DEPLOY

1. `npm run build` en electron-app
2. Lanzar LuxSync
3. Reproducir Brejcha (~126 BPM)
4. Verificar en debug overlay que BPM converge a ~124-128 (no 161)
5. Verificar que cambiando a "Gravity" (~126 BPM), el BPM se adapta

**Si BPM sigue en 161:** El problema estaría en las bandas del FFT, no en la ponderación. Siguiente paso sería verificar que `extractBandEnergy()` realmente separa 40-50Hz en subBass y 80-150Hz en bass.

---

*PunkOpus — WAVE 2118 — The Frequency Scalpel*
