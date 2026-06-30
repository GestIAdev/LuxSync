# WAVE 7100 — FASE 4: Audio Portable + Análisis Embebido

> **Fecha:** 29 Jun 2026
> **Premisa:** `.lux` V3 ahora es portable y auto-contenido. El análisis de audio se embebe en el archivo.
> **Estado:** ✅ Completado. tsc --noEmit: 0 errores. 22/22 tests verdes.

---

## 1. Objetivos

1. `audio.path` (absoluto) → `audio.relativePath` (relativo al `.lux`) — **portabilidad**
2. Resolver path absoluto al cargar: `path.join(luxDir, relativePath)` — **round-trip**
3. GodEar FFT worker: al terminar análisis, escribir `LuxAnalysisV3` en el `.lux` — **persistencia**
4. Al cargar `.lux` con `analysis` presente, usar directamente (sin re-análisis) — **performance**
5. Si no hay `analysis`, cargar audio y analizar on-demand — **fallback graceful**
6. Defensa NaN en TitanEngine: validar heatmap antes de inyectar bandas — **robustez**

---

## 2. Cambios de Schema

### 2.1 — `LuxAnalysisV3` expandido

**Antes (Fase 1):** `energyHeatmap: number[]` y `waveform: number[]` (flat, pérdida de datos).

**Ahora (Fase 4):** Estructura completa que preserva todos los datos del phantom worker:

```typescript
interface LuxHeatmapV3 {
  resolutionMs: number
  energy: number[]        // Total energy (0-1)
  bass: number[]          // Legacy bass
  high: number[]          // Legacy high
  flux: number[]          // Spectral flux
  // 7 tactical bands (optional, from GodEarFFT)
  subBass?: number[]      // 20-60Hz
  bassReal?: number[]     // 60-250Hz
  lowMid?: number[]       // 250-500Hz
  mid?: number[]          // 500-2000Hz
  highMid?: number[]      // 2000-6000Hz
  treble?: number[]       // 6000-16000Hz
  ultraAir?: number[]     // 16000-22000Hz
  spectralCentroid?: number[]
  spectralFlatness?: number[]
}

interface LuxWaveformV3 {
  samplesPerSecond: number
  peaks: number[]
  rms: number[]
}

interface LuxAnalysisV3 {
  detectedBpm: number
  bpmConfidence: number
  firstBeatMs: number          // NEW
  beatGrid: number[]
  sections: LuxSectionV3[]
  transients: LuxTransientV3[]
  heatmap: LuxHeatmapV3        // NEW (replaces energyHeatmap: number[])
  waveform: LuxWaveformV3      // NEW (replaces waveform: number[])
}
```

### 2.2 — Validación de schema actualizada

`LuxFileV3.schema.ts` ahora valida la estructura de `analysis.heatmap` y `analysis.waveform` como objetos con arrays internos, emitiendo warnings si están malformados.

---

## 3. Archivos Modificados

| Archivo | Cambio |
|---|---|
| `src/chronos/core/LuxFileV3.ts` | Nuevas interfaces `LuxHeatmapV3`, `LuxWaveformV3`. `LuxAnalysisV3` expandido con `heatmap`, `waveform` objetos + `firstBeatMs`. |
| `src/chronos/core/LuxFileV3.schema.ts` | Validación de `analysis.heatmap` (objeto + `energy` array + `resolutionMs`) y `analysis.waveform` (objeto + `peaks` array). |
| `src/chronos/core/LuxFileV3.factories.ts` | Nuevas funciones: `analysisDataToLuxAnalysisV3()`, `luxHeatmapToHeatmapData()`, `luxWaveformToWaveformData()`, `normalizeTransients()`. Import de tipos `AnalysisData`, `HeatmapData`, `WaveformData`, `DetectedSection`. |
| `src/chronos/core/ChronosStore.ts` | Funciones `toRelativePath()` / `resolveAbsolutePath()` para conversión portable. `save()` convierte absoluto→relativo antes de serializar. `load()` resuelve relativo→absoluto después de deserializar. Nuevos métodos `setAnalysisData()` y `hasEmbeddedAnalysis()`. |
| `src/chronos/hooks/useAudioLoaderPhantom.ts` | `loadFromPath()` acepta `skipAnalysis: boolean`. Cuando `true`, carga audio para playback sin disparar phantom analysis. |
| `src/chronos/ui/ChronosLayout.tsx` | Tras análisis phantom: llama `store.setAnalysisData()` para embeber. Al cargar proyecto con analysis: usa `loadFromPath(path, true)` (skip analysis) e inyecta heatmap embebido a TitanEngine. |
| `src/engine/TitanEngine.ts` | `setChronosHeatmap()`: valida `energy` array, `resolutionMs`, y spot-check NaN antes de aceptar. Inyección de bandas usa `safe()` helper para NaN-safe reads. |
| `src/chronos/__tests__/LuxFileV3.test.ts` | Test fixture actualizado al nuevo schema (`heatmap` objeto + `waveform` objeto + `firstBeatMs`). |

---

## 4. Flujo de Datos

### 4.1 — Análisis nuevo (drag & drop)

```
User drops audio
  → useAudioLoaderPhantom.loadFile()
  → Phantom worker: decodeAudioData → GodEarFFT → AnalysisData
  → ChronosLayout useEffect:
      1. lux.chronos.loadHeatmap(energyHeatmap) → TitanEngine
      2. store.setAnalysisData(analysisData) → embeds LuxAnalysisV3 in project
  → User saves → serializeLuxV3() → analysis embebido en .lux
```

### 4.2 — Carga de proyecto con análisis embebido

```
User opens .lux
  → ChronosStore.load() → deserializeLuxV3()
  → resolveAbsolutePath(luxPath, relativePath) → audio path absoluto
  → ChronosLayout handleProjectLoaded:
      if (project.analysis) {
        → audioLoader.loadFromPath(absolutePath, skipAnalysis=true)
        → lux.chronos.loadHeatmap(project.analysis.heatmap) → TitanEngine
        → NO re-analysis needed
      } else {
        → audioLoader.loadFromPath(absolutePath) → triggers phantom analysis
      }
```

### 4.3 — Portabilidad de paths

```
Save: absoluteAudioPath → toRelativePath(luxFilePath, absolute) → "audio/track.mp3"
Load: "audio/track.mp3" → resolveAbsolutePath(luxFilePath, "audio/track.mp3") → "C:/Shows/audio/track.mp3"
```

---

## 5. Defensa NaN

### 5.1 — TitanEngine.setChronosHeatmap()

Validación a la entrada:
- `energy` debe ser array no vacío
- `resolutionMs` debe ser finito y > 0
- Spot-check primeros 5 frames de `energy` para NaN/Infinity
- Si falla: rechaza el heatmap completo, loguea error, `chronosHeatmap = null`

### 5.2 — Inyección de bandas (hot-path 44Hz)

Función `safe(arr, idx, fallback)`:
```typescript
const safe = (arr, idx, fallback = 0) => {
  const v = arr?.[idx]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}
```
Cada banda se lee via `safe()`. Si un frame tiene NaN/undefined, usa fallback (0 o valor previo del audio). El `normalizeAudioMetrics()` existente en línea 530 sigue como safety net final.

---

## 6. Pendiente

- **UI: botón "Analizar ahora"** cuando no hay analysis embebido (Fase 4 item 5 del plan). Funcionalidad implícita: al cargar audio sin analysis, el phantom se ejecuta automáticamente. El botón explícito es mejora UX, no bloqueante.
- **Fase 5: VibeBase (Whisper)** — selector de vibe base en TransportBar.
- **Fase 6: Record Mode V3** — ChronosRecorder con HephAutomationClipV3 embebido.

---

## 7. Verificación

```
tsc --noEmit: 0 errores
vitest LuxFileV3: 22/22 passed
```
