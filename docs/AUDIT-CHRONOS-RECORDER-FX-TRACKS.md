# AUDITORÍA: ChronosRecorder + Lógica de Tracks FX

**DE:** PunkOpus (Core Engineer)  
**PARA:** PunkGemini (Arquitecto)  
**FECHA:** 2026-02-13  
**ASUNTO:** Autopsia del Grabador, Estado de FX Tracks 3-4, y Propuesta de Semantic Tracks  
**CLASIFICACIÓN:** Documento Técnico para Decisión Arquitectónica

---

## ÍNDICE

1. [Hallazgo Principal: ¿Por qué FX 3 y 4 "parecen muertos"?](#1-hallazgo-principal)
2. [Análisis Completo del ChronosRecorder](#2-análisis-chronosrecorder)
3. [Análisis de Quantize](#3-análisis-de-quantize)
4. [Análisis de TimelineClip + useTimelineClips](#4-análisis-timelineclip)
5. [Propuesta: Clips Infinite-End para Vibes](#5-clips-infinite-end)
6. [Propuesta: Migración a Semantic Tracks](#6-semantic-tracks)
7. [Resumen de Decisiones Pendientes](#7-decisiones-pendientes)

---

## 1. HALLAZGO PRINCIPAL: ¿Por qué FX 3 y 4 "parecen muertos"? {#1-hallazgo-principal}

### TL;DR: NO están desactivados. Están infrautilizados por diseño.

**Los tracks FX 3 y 4 están 100% funcionales.** El problema es perceptual, no técnico. Aquí el por qué:

### 1.1 El MixBus Routing (EffectRegistry.ts, líneas 752-827)

El sistema de routing automático asigna efectos a tracks según su MixBus:

| MixBus | Track | Tipo de Efecto | Frecuencia Real |
|--------|-------|----------------|-----------------|
| `global` | **FX1** | Strobes, blinders, meltdowns, explosiones | **ALTA** (lo primero que grabas) |
| `htp` | **FX2** | Sweeps, chases, scans, waves, pulses, rhythms | **MUY ALTA** (el grueso de efectos) |
| `ambient` | **FX3** | Mists, rain, breath, void, aurora, fog, moon | **BAJA** (ambient es sutil) |
| `accent` | **FX4** | Sparks, flashes, hits, stabs (< 2s) | **MUY BAJA** (acentos puntuales) |

### 1.2 El Problema Real

```
DISTRIBUCIÓN DE LOS 45+ EFECTOS POR MIXBUS:
═══════════════════════════════════════════

FX1 (GLOBAL):  ~8 efectos  → Strobes de las 4 categorías
FX2 (HTP):     ~22 efectos → Sweeps, chases, pulses, rhythms, acid, gatling...
FX3 (AMBIENT): ~10 efectos → Mists, breaths, voids, auroras, rains
FX4 (ACCENT):  ~7 efectos  → Sparks, snaps, solos cortos (< 2s)
```

**FX2 absorbe casi la mitad de los efectos.** Un usuario grabando normalmente va a llenar FX1 y FX2 rápidamente, pero FX3 y FX4 solo se activan con efectos específicos (ambient/accent).

### 1.3 El Fallback Inteligente

Cuando un track preferido está ocupado, el recorder busca alternativas:

```typescript
// ChronosRecorder.ts, líneas 363-395
private getTrackForEffect(effectId, timeMs, durationMs): FXTrackId {
  const effectMeta = getEffectById(effectId)
  if (effectMeta) {
    const preferredTrack = getEffectTrackId(effectMeta)
    if (!this.isTrackBusy(preferredTrack, timeMs, durationMs)) {
      return preferredTrack  // ← Usa el track preferido
    }
    // Track ocupado → busca alternativa
  }
  return this.findAvailableFXTrack(timeMs, durationMs)
}
```

`findAvailableFXTrack()` (línea 389) itera `['fx1', 'fx2', 'fx3', 'fx4']` y devuelve el primero libre. Esto significa que **FX3 y FX4 SÍ reciben clips por overflow**, pero solo cuando FX1 y FX2 ya están ocupados en esa franja temporal.

### 1.4 Conclusión del Hallazgo

| Factor | Estado |
|--------|--------|
| ¿FX3/FX4 están hardcodeados como desactivados? | **NO** |
| ¿El recorder puede escribir en FX3/FX4? | **SÍ** |
| ¿El recorder escribe en FX3/FX4 frecuentemente? | **NO** — solo por MixBus `ambient`/`accent` o por overflow |
| ¿El usuario puede hacer drag & drop a FX3/FX4? | **SÍ** — funciona perfecto |
| ¿El TimelineCanvas renderiza clips en FX3/FX4? | **SÍ** — renderiza todo lo que haya |
| ¿Es un bug? | **NO** — es un diseño de routing que favorece FX1/FX2 |

---

## 2. ANÁLISIS COMPLETO DEL CHRONOS RECORDER {#2-análisis-chronosrecorder}

### 2.1 Arquitectura (603 líneas)

```
ChronosRecorder (Singleton)
├── Estado (RecorderState)
│   ├── isRecording: boolean
│   ├── playheadMs: number
│   ├── clips: RecordedClip[]
│   ├── bpm: number
│   ├── quantizeEnabled: boolean (default: TRUE)
│   └── activeVibeClipId: string | null
├── Event System (Browser-compatible, no Node EventEmitter)
│   ├── 'record-start'
│   ├── 'record-stop'
│   ├── 'clip-added'
│   ├── 'clip-updated'   → Latch mode (vibe duración cambia)
│   ├── 'clip-growing'   → Real-time vibe growth
│   └── 'playhead-update'
├── Recording Control
│   ├── startRecording()  → Limpia clips, activa flag
│   ├── stopRecording()   → Cierra vibe activa, devuelve clips
│   └── updatePlayhead()  → Sincroniza posición + tick living clips
├── Clip Recording
│   ├── recordEffect()    → MixBus routing → track auto-asignado
│   └── recordVibe()      → Latch mode (cierra anterior automáticamente)
├── MixBus Routing
│   ├── getTrackForEffect() → inferMixBus() → trackId
│   ├── isTrackBusy()       → Detección de colisión temporal
│   └── findAvailableFXTrack() → Fallback secuencial
└── Utilities
    ├── snapToGrid()     → Quantize a beat más cercano
    ├── closeActiveVibe() → Cierra vibe latched
    ├── undoLastClip()    → Undo del último clip
    └── exportClips()     → Serialización
```

### 2.2 Flujo de Grabación Completo

```
[1] Usuario ARM → handleRecord() en ChronosLayout.tsx
[2] recorder.startRecording() → Limpia estado, activa flag
[3] Usuario Play → streaming.play()
[4] Cada frame: streaming.currentTimeMs → recorder.updatePlayhead()
[5] updatePlayhead() → tickActiveClips() (crece vibe si hay una activa)
[6] Usuario click VibeCard → recorder.recordVibe()
    [6a] Cierra vibe anterior (latch)
    [6b] Crea nueva vibe en trackId='vibe'
    [6c] Emite 'clip-added'
[7] Usuario click EffectPad → recorder.recordEffect()
    [7a] snapToGrid(playheadMs)
    [7b] getTrackForEffect(effectId) → MixBus routing → trackId
    [7c] Crea RecordedClip con trackId asignado
    [7d] Emite 'clip-added'
[8] ChronosLayout escucha 'clip-added':
    [8a] Convierte RecordedClip → TimelineClip (VibeClip | FXClip)
    [8b] clipState.addClip(timelineClip) → aparece en TimelineCanvas
[9] Usuario Stop → recorder.stopRecording()
    [9a] Cierra vibe activa final
    [9b] Devuelve todos los clips
```

### 2.3 Problemas Detectados

| # | Severidad | Problema | Ubicación |
|---|-----------|----------|-----------|
| P1 | 🟡 Medium | **Quantize está SIEMPRE activado por defecto** y no hay UI para cambiarlo. `quantizeEnabled: true` en estado inicial. `setQuantize()` existe pero nunca se llama desde la UI. | `ChronosRecorder.ts:126` |
| P2 | 🟢 Low | **RecordedClip.icon guarda emojis** del EffectRegistry (`effect.icon`). Estos emojis ya no se renderizan en UI (WAVE 2041 los reemplazó por SVGs), pero se guardan en los datos del clip como metadata. No es un bug pero es inconsistencia de datos. | `ChronosRecorder.ts:432-433` |
| P3 | 🟡 Medium | **Vibe default duration es hardcoded a 8000ms** en ArsenalDock. Si el usuario no graba otra vibe y para el recording, la vibe queda con 8s de fallback (aunque el latch la extiende mientras graba). | `ArsenalDock.tsx:218` |
| P4 | 🟢 Low | **No hay validación de `effectId` en `recordEffect()`**. Si se pasa un effectId inválido, `getEffectById()` devuelve undefined y el routing cae a fallback (`findAvailableFXTrack`), que funciona pero sin la inteligencia MixBus. | `ChronosRecorder.ts:356` |

---

## 3. ANÁLISIS DE QUANTIZE {#3-análisis-de-quantize}

### 3.1 Estado Actual

```typescript
// ChronosRecorder.ts — Estado Inicial
quantizeEnabled: true  // ← SIEMPRE ACTIVO
```

**La lógica de quantize es:**

```typescript
private snapToGrid(timeMs: number): number {
  if (!this.state.quantizeEnabled) return timeMs
  
  const beatDurationMs = 60000 / this.state.bpm  // ej: 500ms a 120 BPM
  const beatIndex = Math.round(timeMs / beatDurationMs)
  const snappedTime = beatIndex * beatDurationMs
  
  return Math.max(0, snappedTime)
}
```

### 3.2 ¿Es configurable?

**En código: SÍ** — existe `setQuantize(enabled: boolean)`.  
**En UI: NO** — nadie llama a `setQuantize()` desde ningún componente.

### 3.3 Diferencia entre Snap y Quantize

| Concepto | Implementación | ¿Dónde? | ¿Cuándo? |
|----------|---------------|---------|----------|
| **Snap** | `snapToGrid()` en `useTimelineClips.ts` | Al **arrastrar** clips en el timeline | Interacción manual |
| **Quantize** | `snapToGrid()` en `ChronosRecorder.ts` | Al **grabar** en vivo | Grabación real-time |

Son dos implementaciones separadas del mismo concepto. El snap del timeline (`useTimelineClips`) usa un `beatGrid[]` precalculado con `snapThresholdMs` configurable. El quantize del recorder usa cálculo directo de beat más cercano.

### 3.4 Granularidad

**Actualmente: Solo quantize a beat (1/4).** No hay opción para 1/8, 1/16, o 1/1 (bar).

La fase 3 del `phaseschronos.md` propone unificar en un menú "Grid Settings" con opciones de subdivisión. Esto requeriría:

1. Un estado compartido de grid resolution (1/4, 1/8, 1/16, 1/1)
2. Ambos sistemas (snap manual + quantize de grabación) leyendo ese estado
3. Un componente UI en el TransportBar para el selector

---

## 4. ANÁLISIS DE TIMELINECLIP + USETIMELINECLIPS {#4-análisis-timelineclip}

### 4.1 TimelineClip (390 líneas)

```
TimelineClip = VibeClip | FXClip

BaseClip {
  id, type, startMs, endMs, trackId, selected?, locked?
}

VibeClip extends BaseClip {
  vibeType: VibeType           // fiesta-latina, techno-club, etc.
  label, color, intensity
  fadeInMs, fadeOutMs           // Transiciones
}

FXClip extends BaseClip {
  fxType: FXType               // strobe, sweep, pulse, chase...
  label, color
  keyframes: FXKeyframe[]      // Automatización multi-punto
  params: Record<string, any>
  hephClip?: HephAutomationClip  // Hephaestus integration
  hephFilePath?: string
  isHephCustom?: boolean
}
```

### 4.2 useTimelineClips (426 líneas)

Hook de React con estado + acciones completas:

```
CRUD: addClip, removeClip, updateClip
Selection: selectClip, selectAll, deselectAll, deleteSelected
D&D: createClipFromDrop, moveClip, resizeClip
Advanced: duplicateClip, duplicateSelected, pasteClips, splitClipAtTime
Snapping: toggleSnap, snapTime
Query: getClipsForTrack, getClipById
State: clips, selectedIds, snapEnabled, snapPosition, beatGrid
```

### 4.3 Observaciones Clave

| # | Observación |
|---|-------------|
| O1 | **Track IDs son strings libres** (`trackId: string`). No hay enum ni validación. Un clip puede tener `trackId: 'banana'` y nadie se queja. |
| O2 | **Los tracks se definen visualmente en TimelineCanvas** como `DEFAULT_TRACKS` (hardcoded array). No hay conexión entre el modelo de datos y la visual. |
| O3 | **`endMs` y `durationMs` son redundantes.** `BaseClip` usa `endMs`, `RecordedClip` usa `durationMs`. La conversión se hace manualmente en `ChronosLayout.tsx` línea 505: `endMs: clip.startMs + clip.durationMs`. |
| O4 | **`DragPayload` ya soporta source `hephaestus`**. El sistema de drag ya contempla fuentes externas. |
| O5 | **`createClipFromDrop` asigna el clip al track donde se dropea**, no al MixBus. Solo el recorder usa MixBus routing. El drag & drop manual respeta la decisión del usuario. |

---

## 5. PROPUESTA: CLIPS INFINITE-END PARA VIBES {#5-clips-infinite-end}

### 5.1 El Concepto

> "Que la duración de la Vibe sea virtualmente infinita hasta el siguiente evento."

Actualmente la vibe se crea con `durationMs: 8000` y crece con latch mode hasta que otra vibe la cierra. El problema es que si el usuario **no graba otra vibe**, la última queda con 8 segundos de fallback o con la duración hasta que para el recording.

### 5.2 Propuesta Técnica

**Opción A: Sentinel Value (`endMs = Infinity`)**

```typescript
// BaseClip permanece igual, pero se permite:
interface VibeClip extends BaseClip {
  // ...existing fields...
  /** If true, this vibe extends until the next vibe or song end */
  isOpenEnded?: boolean
}

// En el render, se traduce:
const effectiveEndMs = clip.isOpenEnded 
  ? (nextVibeStartMs ?? songDurationMs)
  : clip.endMs
```

**Ventajas:**
- No cambia la interfaz BaseClip
- El renderer calcula el end visual dinámicamente
- El TitanOrchestrator ya trabaja con "vibe activa hasta la siguiente"

**Desventajas:**
- Complejidad en queries de overlap
- Serialización necesita cuidado (no guardar `Infinity` en JSON)

**Opción B: Flag `isOpenEnded` + Cálculo en Render (RECOMENDADA)**

```typescript
// TimelineClip.ts — Añadir a VibeClip:
isOpenEnded?: boolean  // Default: false para clips manuales, true para latch recording

// ClipRenderer.tsx — Al calcular width:
const renderEndMs = vibeClip.isOpenEnded
  ? getNextVibeStart(clips, vibeClip.startMs) ?? durationMs
  : vibeClip.endMs
```

**Ventajas:**
- `endMs` siempre tiene un valor numérico válido (el último conocido)
- El flag es explícito y serializable
- Compatible con JSON import/export
- El renderer es el único que necesita calcular la extensión visual

### 5.3 Impacto en Archivos

| Archivo | Cambio |
|---------|--------|
| `TimelineClip.ts` | Añadir `isOpenEnded?: boolean` a `VibeClip` |
| `ChronosRecorder.ts` | Al crear vibe en latch mode, marcar `isOpenEnded: true`. Al cerrar latch, marcar `false` |
| `ChronosLayout.tsx` | En la conversión RecordedClip → TimelineClip, pasar el flag |
| `ClipRenderer.tsx` | Calcular `effectiveEndMs` basado en flag + siguiente vibe |
| `useTimelineClips.ts` | Sin cambios (ya trabaja con clips como objetos) |

### 5.4 Esfuerzo Estimado

**2-3 horas de implementación limpia.** No es un refactor — es un feature flag en 4-5 archivos.

---

## 6. PROPUESTA: MIGRACIÓN A SEMANTIC TRACKS {#6-semantic-tracks}

### 6.1 Estado Actual: "Fixed Tracks 0-4"

```typescript
// TimelineCanvas.tsx — Hardcoded
const DEFAULT_TRACKS: Track[] = [
  { id: 'ruler',    type: 'ruler',    label: 'TIME',   height: 32,  color: '#3b82f6' },
  { id: 'waveform', type: 'waveform', label: 'AUDIO',  height: 80,  color: '#22d3ee' },
  { id: 'vibe',     type: 'vibe',     label: 'VIBE',   height: 48,  color: '#a855f7' },
  { id: 'fx1',      type: 'fx',       label: 'FX 1',   height: 36,  color: '#f97316' },
  { id: 'fx2',      type: 'fx',       label: 'FX 2',   height: 36,  color: '#ef4444' },
  { id: 'fx3',      type: 'fx',       label: 'FX 3',   height: 36,  color: '#22d3ee' },
  { id: 'fx4',      type: 'fx',       label: 'FX 4',   height: 36,  color: '#10b981' },
]
```

**Problemas:**
- Los labels "FX 1", "FX 2" no comunican nada al usuario
- Los colores de los tracks no coinciden con los MixBus
- El usuario no sabe que FX1 = strobes y FX3 = ambient
- No hay jerarquía visual (todos miden lo mismo)

### 6.2 Propuesta: The State Ribbon

Renombrar y re-estilizar los tracks para reflejar su función semántica:

```typescript
// PROPUESTA — Semantic Tracks
const SEMANTIC_TRACKS: Track[] = [
  { id: 'ruler',    type: 'ruler',    label: 'BARS',       height: 32,  color: '#3b82f6' },
  { id: 'waveform', type: 'waveform', label: 'AUDIO',      height: 80,  color: '#22d3ee' },
  { id: 'vibe',     type: 'vibe',     label: 'VIBE',       height: 48,  color: '#a855f7' },
  { id: 'fx1',      type: 'fx',       label: 'GLOBAL',     height: 40,  color: '#ff4444' },
  { id: 'fx2',      type: 'fx',       label: 'MOVEMENT',   height: 40,  color: '#ff8800' },
  { id: 'fx3',      type: 'fx',       label: 'AMBIENT',    height: 36,  color: '#00ffcc' },
  { id: 'fx4',      type: 'fx',       label: 'ACCENT',     height: 32,  color: '#ffee00' },
]
```

### 6.3 Cambios Visuales (The State Ribbon)

```
ANTES:
┌──────────────────────────────────────────────────┐
│ FX 1  │ ████████████ STROBE GATLING ████████     │ ← ¿Qué tipo de FX es?
│ FX 2  │     ████ SWEEP ARCOÍRIS ████             │ ← No sé qué capa
│ FX 3  │                                          │ ← ¿Vacío? ¿Roto?
│ FX 4  │                                          │ ← ¿Para qué sirve?
└──────────────────────────────────────────────────┘

DESPUÉS:
┌──────────────────────────────────────────────────┐
│ GLOBAL   │ ████████ STROBE GATLING ████████      │ ← ¡Ah, takeover effects!
│ MOVEMENT │     ████ SWEEP ARCOÍRIS ████          │ ← Movimiento, chases
│ AMBIENT  │     ░░░░░░░ MIST AZUL ░░░░░░         │ ← Atmósfera de fondo
│ ACCENT   │          ▪ SPARK ▪                    │ ← Hits puntuales
└──────────────────────────────────────────────────┘
```

### 6.4 Tabla de Cambios para la Migración

| Archivo | Qué cambiar | Esfuerzo |
|---------|-------------|----------|
| `TimelineCanvas.tsx` | Renombrar `DEFAULT_TRACKS` labels + ajustar colores + alturas | 🟢 Trivial |
| `TimelineCanvas.css` | Colores de track labels si hay clases específicas | 🟢 Trivial |
| `EffectRegistry.ts` | Ya tiene el mapping. Sin cambios. | ✅ Nada |
| `ChronosRecorder.ts` | Ya usa MixBus routing. Sin cambios. | ✅ Nada |
| `useTimelineClips.ts` | Sin cambios (trackId son strings). | ✅ Nada |
| `ArsenalDock.tsx` | Opcional: tooltip que diga "Goes to GLOBAL track" | 🟡 Nice-to-have |

### 6.5 ¿Refactor o Rename?

**RENAME. No necesitamos refactorizar.**

Los `trackId` strings (`'fx1'`, `'fx2'`, `'fx3'`, `'fx4'`) se mantienen internamente. Solo cambiamos los `label` visibles. El MixBus routing sigue funcionando igual. Cero riesgo de rotura.

Si en el futuro queremos tracks dinámicos (el usuario añade/quita), ahí sí sería refactor. Pero para el State Ribbon, un rename de labels es suficiente.

### 6.6 Esfuerzo Estimado

**30 minutos.** Es literalmente cambiar 4 strings y 4 colores en `DEFAULT_TRACKS`.

---

## 7. RESUMEN DE DECISIONES PENDIENTES {#7-decisiones-pendientes}

### Para el Arquitecto (PunkGemini):

| # | Decisión | Opciones | Mi Recomendación |
|---|----------|----------|------------------|
| D1 | **¿Implementar Semantic Track Labels?** | A) Rename simple / B) Full refactor a tracks dinámicos | **A) Rename** — 30 min, zero risk |
| D2 | **¿Implementar Infinite-End Vibes?** | A) Flag `isOpenEnded` / B) Sentinel `Infinity` | **A) Flag** — limpio, serializable |
| D3 | **¿Unificar Snap + Quantize?** | A) Grid Settings compartido / B) Mantener separados | **A) Unificar** — pero requiere UI component |
| D4 | **¿Añadir UI para Quantize toggle?** | A) Botón en TransportBar / B) En Grid Settings | **B)** Grid Settings cuando implementemos D3 |
| D5 | **¿Ajustar distribución MixBus?** | A) Mantener actual / B) Rebalancear categorías | **A) Mantener** — el routing funciona bien, el problema era perceptual |
| D6 | **¿Jerarquía visual de track heights?** | A) Todos iguales / B) GLOBAL>MOVEMENT>AMBIENT>ACCENT | **B)** Heights graduales (40/40/36/32) |

### Orden de ejecución sugerido (si se aprueban):

```
1. D1 (Semantic Labels) → 30 min → Impacto visual inmediato
2. D6 (Track Heights)   → 10 min → Se hace junto con D1
3. D2 (Infinite Vibes)  → 2-3h  → Feature real
4. D3+D4 (Grid Settings)→ 4-6h  → Requiere nuevo componente UI
```

---

## ANEXO A: Mapa de Dependencias del Recorder

```
ChronosLayout.tsx (Orchestrator)
  ├── imports getChronosRecorder()
  ├── useMemo → recorder instance
  ├── useEffect → sync BPM, sync playhead
  ├── useEffect → listen 'clip-added', 'clip-updated', 'clip-growing'
  ├── handleRecord() → start/stop recording
  └── RecordedClip → TimelineClip conversion (clip-added handler)

ArsenalDock.tsx (Input)
  ├── imports getChronosRecorder()
  ├── VibeCard.handleClick() → recorder.recordVibe()
  └── EffectPad.handleClick() → recorder.recordEffect()

ChronosRecorder.ts (Core)
  ├── imports getEffectById, getEffectTrackId from EffectRegistry
  ├── MixBus routing → EffectRegistry.inferMixBus()
  └── Singleton via getChronosRecorder()

EffectRegistry.ts (Data)
  ├── 4 categorías, 45+ efectos
  ├── inferMixBus() → global/htp/ambient/accent
  └── getEffectTrackId() → fx1/fx2/fx3/fx4

TimelineCanvas.tsx (Visual)
  ├── DEFAULT_TRACKS hardcoded (ruler, audio, vibe, fx1-4)
  ├── Renders clips from useTimelineClips state
  └── No dependency on ChronosRecorder

useTimelineClips.ts (State)
  ├── CRUD + Selection + D&D + Snapping
  ├── No dependency on ChronosRecorder
  └── Clips injected via addClip() from ChronosLayout
```

## ANEXO B: Test Coverage

Los 488 tests pasan. Las funciones del recorder están cubiertas a través de:
- `EffectRegistry.test.ts` → MixBus inference, track routing
- Integración indirecta vía los tests de ArsenalDock y ChronosLayout

No hay tests unitarios dedicados para `ChronosRecorder` (no existe `ChronosRecorder.test.ts`). **Recomendación: Crear tests unitarios para el recorder antes de implementar Infinite-End Vibes (D2).**

---

*Documento generado por PunkOpus — "Destripamos las entrañas para que tú puedas soñar."*
