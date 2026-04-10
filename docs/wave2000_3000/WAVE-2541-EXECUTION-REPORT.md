# WAVE 2541 — EXECUTION REPORT
## "OPERATION: RESURRECT THE PHANTOM"
### La Odisea del Mid que No Existía y el Mover Que Nunca Bailó

**Fecha:** 10 abril 2026  
**Duración:** Una sesión brutal de investigación + cirugía de código  
**Estado:** ✅ VICTORIA TOTAL  

---

## EL PUNTO DE PARTIDA

### Síntomas al inicio de la sesión

El show de Chronos con "Spectral Drift.wav" generaba este horror en los logs:

```
B=0.407  M=0.000  H=0.312
ML:0.00  MR:1.00
```

- La banda **mid era literalmente cero** en todos los frames del heatmap
- El **mover izquierdo ML siempre en 0**, el derecho MR siempre en 1
- Las luces del escenario en modo techno: la mitad estaban muertas

WAVE 2541.1 (sesión anterior) había añadido normalización de pico (`normalizeBand`) en el worker offline y en el fallback de hilo principal. Se "rescató" el bass (B=0.407) pero el mid seguía en 0.000.

---

## FASE 1 — LA GRAN AUDITORÍA (descartando fantasmas)

### Lo que se verificó y descartó

Se auditó **toda la pipeline FFT** de punta a punta buscando el bug:

| Componente | Veredicto |
|------------|-----------|
| `GOD_EAR_BAND_CONFIG` — definición Mid: 500-2000Hz | ✅ Correcto |
| `computeFFTCore` — Cooley-Tukey Radix-2 DIT | ✅ Matemáticamente correcto |
| `computeMagnitudeSpectrum` — normFactor = 1/(n × 0.35875) | ✅ Correcto |
| `getLR4FilterMasks` — singleton cached, generado una vez | ✅ Correcto |
| `extractBandEnergy` — RMS ponderado con máscara LR4 | ✅ Correcto |
| `applyBlackmanHarrisWindow` — 4-term, -92dB sidelobes | ✅ Correcto |
| `removeDCOffset` — resta media correcta | ✅ Correcto |
| `getMonoSamples` — promedio de canales L+R correcto | ✅ Correcto |
| Nombres de campos en toda la cadena de datos | ✅ Sin mismatches |

**Resultado: el FFT estaba bien. El bug era arquitectural, no matemático.**

---

## FASE 2 — EL DESCUBRIMIENTO: TRES COPIAS, UNA OLVIDADA

### Los tres caminos de análisis offline

Se reveló que existen **tres implementaciones distintas** de `extractEnergyHeatmap()`:

```
1. godear-offline.worker.ts    → Web Worker (ruta PRIMARIA, 99% de los casos)
2. GodEarOffline.ts            → Main thread (fallback si worker falla)
3. phantomWorker.html          → Electron BrowserWindow oculta (ruta IPC separada)
```

WAVE 2541.1 había parcheado las rutas 1 y 2 con `normalizeBand()`.  
**La ruta 3 (phantomWorker.html) NO tenía normalización.** Silencio total.

### La cadena de datos completa

```
analyzeAudioFile()
  → godear-offline.worker.ts (Worker, ruta primaria)
  → GodEarOffline.ts (fallback main thread)
       ↓
  HeatmapData { mid?: number[] }
       ↓ IPC: chronos:load-heatmap
  IPCHandlers.ts → TitanEngine.setChronosHeatmap()
       ↓ phantom injection
  audio.mid = hm.mid[frameIndex]
  normalizedMid: phantomMid
       ↓
  NervousSystem → SeleneLux → bands.mid
       ↓
  LiquidEngine.applyBands()
```

---

## FASE 3 — EL VERDADERO ASESINO: phantomWorker NO TENÍA GodEarFFT

### El síntoma definitivo

```
[0:35:35] ⚠️ Energy heatmap extracted with FALLBACK zero-crossing (GodEarFFT not loaded)
```

**GodEarAnalyzer era null.** El phantom usaba zero-crossing como fallback — que por definición no calcula bandas espectrales. Mid = 0 siempre.

### Por qué no lo cargaba

```
dist-electron/
  main.js          ← bundle principal Electron
  mind.js          ← worker Trinity
  senses.js        ← worker Senses
  openDmxWorker.js ← worker DMX
  preload.js
  ← GodEarFFT.js NO EXISTÍA
```

`GodEarFFT.ts` estaba bundleado **dentro del renderer de Vite** para uso como Web Worker del frontend. El phantomWorker.html necesita hacer `require()` (tiene `nodeIntegration: true`), pero no había ningún archivo `.js` separado que cargar.

### La búsqueda de rutas

El phantomWorker intentaba estas rutas y todas fallaban:

```javascript
path.join(__dirname, '..', '..', 'dist-electron-backend', 'src', 'workers', 'GodEarFFT.js')
// → No existe
path.join(__dirname, '..', 'dist-electron-backend', 'src', 'workers', 'GodEarFFT.js')
// → No existe
// Nada más. Fin del catálogo de búsqueda.
```

---

## FASE 4 — LA SOLUCIÓN REAL

### Fix 1: Añadir GodEarFFT como entry CJS en vite.config.ts

```typescript
// vite.config.ts — nuevo entry añadido
{
  entry: 'src/workers/GodEarFFT.ts',
  vite: {
    build: {
      outDir: 'dist-electron',
      lib: {
        entry: 'src/workers/GodEarFFT.ts',
        formats: ['cjs'],
        fileName: () => 'GodEarFFT.js',
      },
      rollupOptions: {
        external: ['worker_threads'],
        output: { exports: 'named' },
      },
    },
  },
},
```

**Resultado:** `dist-electron/GodEarFFT.js` (13.38 kB) — exporta `GodEarAnalyzer` como named CJS export.

### Fix 2: Rutas de búsqueda corregidas en phantomWorker.html

La ruta primaria correcta (phantomWorker está en `dist-electron/workers/`):

```javascript
path.join(__dirname, '..', 'GodEarFFT.js')  // dist-electron/GodEarFFT.js ← HIT
```

Con lookup robusto para cubrir named + default exports:

```javascript
GodEarAnalyzer = godEarModule.GodEarAnalyzer 
  || (godEarModule.default && godEarModule.default.GodEarAnalyzer)
  || godEarModule.default
```

### Fix 3: normalizeBand() añadida a phantomWorker.html (WAVE 2541.1 retroactivo)

Los valores raw del FFT son RMS pequeños (0.01–0.05). Sin normalización de pico, el downstream los interpreta como silencio. Se añadió la misma función `normalizeBand()` que ya tenían los otros dos caminos.

---

## FASE 5 — EL OTRO BUG: ML=0 en strict-split (LiquidEngineBase)

### El problema

Después de arreglar el FFT, el `mid` tenía valores reales pero ML seguía en 0.

**Causa raíz:** La fórmula del modo `strict-split` fue calibrada cuando los valores raw eran 0.01–0.05 (pre-normalización):

```typescript
// WAVE 911 LEGACY — calibrado para raw RMS
const rawMoverL = Math.max(0, bands.mid - bands.bass * 0.50)
// gate = 0.06, boost = 12.0
```

Con normalización de pico (range 0–1):
- `bass` pico → 1.0
- `bass * 0.50` = 0.50
- `mid` en frame típico = 0.3
- `rawMoverL = max(0, 0.3 - 0.5) = 0`
- Por debajo del gate 0.06 → ML = 0 para siempre

MR funcionaba porque usa `treble` directamente, sin sustracción.

### La solución: ratio-based separator (WAVE 2541.3)

```typescript
// Cuánto bass atenúa mid — nunca lo mata
const BASS_ATTENUATION_FACTOR = 0.60
const MID_FLOOR = 0.08  // Mid siempre tiene presencia mínima

const bassRatio = bands.bass > 0.001
  ? Math.min(2.0, bands.bass / Math.max(0.001, bands.mid))
  : 0
const bassAttenuation = 1.0 - Math.min(BASS_ATTENUATION_FACTOR, bassRatio * 0.30)
const rawMoverL = Math.max(MID_FLOOR, bands.mid * bassAttenuation)

// Gates recalibrados para range 0-1 normalizado
moverLeft  = calculateMover(rawMoverL, 0.10, 3.0)
moverRight = calculateMover(rawMoverR, 0.10, 3.0)
```

**Efecto:** El synth mid coexiste con el kick. Bass fuerte lo atenúa pero no lo borra. MID_FLOOR garantiza presencia mínima siempre.

---

## RESULTADO FINAL

```
[1:05:26] 🩻 Energy heatmap extracted with REAL GodEarFFT (7 tactical bands)
[1:05:26] 🩻 Band peaks after normalization: subBass=1.000 bass=1.000 mid=1.000 highMid=1.000 treble=1.000
[1:05:27] ✅ Analysis complete in 3104ms
```

**Las 4 bandas funcionando. ML y MR respondiendo. Las luces bailan.**

---

## ARCHIVOS MODIFICADOS

| Archivo | Cambio |
|---------|--------|
| `vite.config.ts` | Nuevo entry CJS para `GodEarFFT.ts` → `dist-electron/GodEarFFT.js` |
| `electron/workers/phantomWorker.html` | Rutas de búsqueda ampliadas + lookup robusto + normalizeBand retroactivo |
| `src/hal/physics/LiquidEngineBase.ts` | Strict-split recalibrado: ratio separator + MID_FLOOR + nuevos gates |
| `src/chronos/analysis/godear-offline.worker.ts` | Logging diagnóstico raw peaks (WAVE 2541.1 + 2541.3) |
| `src/chronos/analysis/GodEarOffline.ts` | Logging diagnóstico raw peaks (WAVE 2541.1 + 2541.3) |

---

## DEUDA TÉCNICA HEREDADA

- `phantomWorker.html` tiene tres implementaciones paralelas de `extractEnergyHeatmap`. Idealmente debería importar desde un módulo compartido. Actualmente son tres copias que pueden divergir.
- El logging diagnóstico (raw peaks, rutas fallidas) debería limpiarse cuando se confirme estabilidad.

---

## WAVE 2542 — PROPUESTA: TRASPLANTE DEL STAGE SIMULATOR

### El problema actual con StageSimulatorCinema.tsx

El componente actual (`src/chronos/ui/stage/StageSimulatorCinema.tsx`, ~1140 líneas) tiene:

- **30fps cap** — en hardware modesta se queda en ~14fps
- **Double-buffer canvas manual** — trails + fixtures en dos canvas superpuestos con mix-blend-mode
- **Código propio de layout, beam rendering, hit testing** — todo duplicado respecto a Hyperion
- **Sin switch 4.1/7.1**
- **Sin responsive scaling** — el canvas no se adapta al viewport de Chronos

### La solución: wrapper sobre TacticalCanvas

`TacticalCanvas.tsx` (en `src/components/hyperion/views/tactical/`) es el corazón del visor 2D de Hyperion:

- **60fps** con frame budget
- **5 capas renderizadas** en un solo canvas (Grid → Zone → Fixture → Selection → HUD)
- **Interpolación física** (SMOOTHING_FACTOR=0.10)
- **Beat visual envelope** (decay=0.88) — reactivo al audio
- **Hit testing** nativo
- Lee datos vía `getTransientTruth()` y hooks internos — **no necesita props de datos**

### Plan de implementación

#### 1. Nuevo StageSimulatorCinema.tsx (~120 líneas)

```tsx
// StageSimulatorCinema.tsx — WAVE 2542: TRASPLANTE INTELIGENTE
// Wrapper mínimo. Toda la lógica de render vive en TacticalCanvas.

import React, { memo, useRef, useEffect, useState, useCallback } from 'react'
import { TacticalCanvas } from '../../../components/hyperion/views/tactical/TacticalCanvas'
import './StageSimulatorCinema.css'

interface StagePreviewProps {
  visible: boolean
}

export const StagePreview = memo(function StagePreview({ visible }: StagePreviewProps) {
  const [liquidLayout, setLiquidLayout] = useState<'4.1' | '7.1'>('4.1')

  // Sincronizar layout con el engine al montar
  useEffect(() => {
    window.lux?.setLiquidLayout('4.1')
  }, [])

  const handleLayoutToggle = useCallback(() => {
    const newMode = liquidLayout === '4.1' ? '7.1' : '4.1'
    setLiquidLayout(newMode)
    window.lux?.setLiquidLayout(newMode)
  }, [liquidLayout])

  return (
    <div className={`stage-cinema ${!visible ? 'stage-cinema--hidden' : ''}`}>
      {/* Badge modo + switch layout */}
      <div className="stage-cinema__controls">
        <span className="stage-cinema__badge">CINEMA</span>
        <button
          className="stage-cinema__layout-toggle"
          onClick={handleLayoutToggle}
          title={`Switch to ${liquidLayout === '4.1' ? '7.1' : '4.1'}`}
        >
          {liquidLayout}
        </button>
      </div>

      {/* El corazón — TacticalCanvas a tamaño reducido */}
      <TacticalCanvas
        quality="HQ"
        showGrid={false}
        showZoneLabels={false}
        className="stage-cinema__tactical"
      />
    </div>
  )
})
```

#### 2. CSS actualizado

- Mantener `.stage-cinema` y `.stage-cinema--hidden` (mismo contrato con ChronosLayout)
- Añadir `.stage-cinema__controls` para el badge y el toggle
- Añadir `.stage-cinema__tactical` para override de tamaño
- `showGrid={false}` → sin grid en viewport pequeño

#### 3. ResizeObserver para scaling

TacticalCanvas tiene su propio ResizeObserver interno — ocupa `100%` de su contenedor. El contenedor `.stage-cinema` ya tiene `height: 100%` en el CSS existente. El scaling debería funcionar automáticamente.

Si se requiere escalar respecto a Hyperion (que usa viewport mayor), se puede añadir un `transform: scale(factor)` calculado con ResizeObserver externo.

#### 4. Rutas a verificar

```
src/chronos/ui/stage/StageSimulatorCinema.tsx
  → importa desde: ../../../components/hyperion/views/tactical/TacticalCanvas
  
src/chronos/ui/ChronosLayout.tsx
  → importa: { StagePreview } from './stage/StageSimulatorCinema'
  → usa: <StagePreview visible={stageVisible} />  ← contrato se mantiene
```

**No hay cambios en ChronosLayout.tsx.**

#### 5. Riesgos identificados

| Riesgo | Mitigación |
|--------|------------|
| `useFixtureData()` dentro de TacticalCanvas lee del store de Hyperion | Verificar que el store es el mismo que usa Chronos — probable que sí vía ipcRenderer `truthStore` |
| TacticalCanvas tiene hit-testing y selección — no necesario en Chronos | `onFixtureSelect` no se pasa → null → desactivado |
| `showGrid={false}` puede cambiar el aspect ratio del render | Test visual necesario |
| Performance en laptop cafetera | TacticalCanvas ya tiene frame budget de 16.67ms — debería ser mejor que 30fps manual |

---

## LECCIONES APRENDIDAS

1. **Siempre busca TODAS las implementaciones paralelas.** Si hay tres caminos de código que hacen lo mismo, patch los tres o factoriza en uno.

2. **"El archivo no existe" es diferente de "la ruta es incorrecta".** Antes de buscar la ruta correcta, confirma que el archivo se genera en el build.

3. **La calibración de fórmulas depende del rango de valores.** Al cambiar de raw RMS (0.01–0.05) a normalizado (0–1), todas las gates, boosts y factores de sustracción necesitan recalibración.

4. **`dist-electron/` es el único mundo que ve el proceso principal de Electron.** Lo que existe en `src/` solo existe en runtime si Vite lo compila como entry separado.

---

*Escrito a las 1:05 AM del 10 de abril de 2026. Después de una batalla larga.*  
*"Primero funciona. Después se hace arte."*
