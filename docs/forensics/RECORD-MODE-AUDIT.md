## 9. Record Mode — Grabación en Vivo

### Concepto

> Record mode es, junto con Whisper, la función más divertida de Chronos.  
> En modo REC, el comportamiento cambia: las fichas de efectos del ArsenalDock se transforman en **botones**.  
> Un click (o un trigger hardware externo: botonera, mesa de faders, MIDI) **captura el efecto** y lo incluye en el timeline mediante **quantize o snap automático**.

### Estado actual del esqueleto

#### Lo que SÍ existe (esqueleto)

| Componente | Archivo | Estado |
|---|---|---|
| **ChronosRecorder** | `chronos/core/ChronosRecorder.ts` | ✅ Clase funcional con eventos, quantize, latch mode |
| **Botón ARM/REC** | `ArsenalDock.tsx` (ArmButton) | ✅ 3 estados: idle → armed → recording |
| **TransportBar** | `TransportBar.tsx` | ✅ Botón REC + toggle quantize |
| **CustomFXDock rec-mode** | `CustomFXDock.tsx` | ⚠️ Pads cambian a `rec-mode` (no draggable) pero click es TODO |
| **Living Clip** | `ChronosRecorder.tickActiveClips()` | ✅ Vibe clips crecen en tiempo real durante grabación |
| **Latch Mode** | `ChronosRecorder.recordVibe()` | ✅ Un nuevo vibe cierra el anterior automáticamente |
| **Quantize to beat** | `ChronosRecorder.snapToGrid()` | ✅ Snap a beat grid del BPM actual |
| **ChronosLayout wiring** | `ChronosLayout.tsx:738-808` | ✅ Recorder events → clipState.addClip/updateClip |

#### Lo que NO existe (gaps)

| Gap | Impacto | Descripción |
|---|---|---|
| **🔴 FX recording** | Crítico | `ChronosRecorder` solo tiene `recordVibe()`. No existe `recordFX()`. Los pads del CustomFXDock en REC mode hacen `// TODO: Preview momentáneo del clip` — no graban nada. |
| **🔴 RecordedClip type limitado** | Crítico | `RecordedClip.clipType` es `'vibe'` únicamente. No soporta `'fx'`. |
| **🔴 handleClipRecorded solo crea VibeClip** | Crítico | `ChronosLayout.tsx:744-757` — el handler siempre crea un `VibeClip` sin importar el tipo. No hay branch para FXClip. |
| **🟡 Hardware trigger** | Importe | No hay integración con botoneras físicas o mesas de faders. El MIDI clock existe pero solo controla transporte, no dispara recording de efectos. |
| **🟡 Quantize to transient** | Importe | Solo quantize a beat grid. No quantize a transients del GodEar FFT (kick/snare hits). |
| **🟡 Punch in/out** | Importe | No hay grabación por regiones. El REC es global (start/stop manual). |
| **🟡 Integración con ChronosStoreV2** | Importe | El recorder usa su propio `RecordedClip[]` interno. No escribe directamente en `ChronosStoreV2.tracks[].clips`. La integración es manual vía eventos en ChronosLayout. |
| **🟢 Undo durante REC** | Cosmético | `undoLastClip()` existe pero no está wired a un botón o shortcut en REC mode. |
| **🟢 Auto-stop en fin de audio** | Cosmético | Si el audio termina mientras REC está activo, la grabación sigue indefinidamente. |

### Anatomía del flujo Record actual

```
┌─── ARSENAL DOCK (Bottom Panel) ──────────────────────┐
│                                                       │
│  ┌─── CustomFXDock ────────┐  ┌─── Trigger Zone ───┐ │
│  │                         │  │                     │ │
│  │  EDIT mode: drag pads   │  │  ArmButton:         │ │
│  │  REC mode: click pads   │  │  idle → armed → REC │ │
│  │  (TODO: click no graba) │  │                     │ │
│  │                         │  │  MODE: REC / EDIT   │ │
│  │                         │  │  ACTION: CLICK/DRAG │ │
│  └─────────────────────────┘  └─────────────────────┘ │
└───────────────────────────────────────────────────────┘
         │ click en REC mode (TODO)
         ▼
┌─── ChronosRecorder ──────────────────────────────────┐
│                                                       │
│  startRecording() → isRecording = true                │
│                                                       │
│  recordVibe(vibeType, ...) → snapToGrid(playhead)     │
│    ├── LATCH: cierra vibe anterior                    │
│    ├── Crea RecordedClip { clipType: 'vibe' }         │
│    ├── activeVibeClipId = clip.id (latch open)        │
│    └── emit('clip-added', { clip })                   │
│                                                       │
│  tickActiveClips() → vibeClip.durationMs = playhead   │
│    └── emit('clip-growing') → UI actualiza endMs      │
│                                                       │
│  stopRecording() → closeActiveVibe() → emit('stop')   │
│                                                       │
│  ❌ NO recordFX() — FX clips no se graban             │
└───────────────────────────────────────────────────────┘
         │ events: clip-added, clip-updated, clip-growing
         ▼
┌─── ChronosLayout (Wiring) ───────────────────────────┐
│                                                       │
│  handleClipRecorded(data):                            │
│    ├── SIEMPRE crea VibeClip (sin branch FX) ❌       │
│    ├── clipState.addClip(timelineClip)                │
│    └── Aparece en TimelineCanvas                      │
│                                                       │
│  handleClipUpdated(data):                             │
│    └── clipState.updateClip(id, { endMs })            │
│                                                       │
│  handleClipGrowing(data):                             │
│    └── clipState.updateClip(id, { endMs }) (60fps)    │
└───────────────────────────────────────────────────────┘
```

### Propuesta: Record Mode V3

#### 1. FX Recording — `recordFX()`

```typescript
// ChronosRecorder.ts — nuevo método
recordFX(
  hephClip: HephAutomationClipV3,
  hephFilePath: string,
  displayName: string,
  defaultDurationMs: number,
  zones?: string[],
  priority?: number,
): RecordedClip | null {
  if (!this.state.isRecording) return null
  
  const startMs = this.snapToGrid(this.state.playheadMs)
  
  const clip: RecordedClip = {
    id: `rec-fx-${Date.now()}`,
    clipType: 'fx',          // ← NUEVO tipo
    effectId: hephClip.id,
    displayName,
    startMs,
    durationMs: defaultDurationMs,  // FX clips son fixed-duration
    color: MIXBUS_CLIP_COLORS[hephClip.mixBus] ?? '#ff6b2b',
    icon: '⬡',
    recordedAt: Date.now(),
    trackId: `zone-${zones?.[0] ?? 'all'}`,
    // Diamond Data embebido — self-contained
    hephClip,                // ← NUEVO campo
    hephFilePath,            // ← NUEVO campo
    zones,                   // ← NUEVO campo
    priority,                // ← NUEVO campo
  }
  
  this.state.clips.push(clip)
  this.state.recordCount++
  this.emit('clip-added', { clip })
  return clip
}
```

#### 2. RecordedClip extendido

```typescript
export type RecordedClipType = 'vibe' | 'fx'  // ← añadir 'fx'

export interface RecordedClip {
  // ... campos existentes ...
  clipType: RecordedClipType
  
  // ── FX-only fields (opcionales) ──
  hephClip?: HephAutomationClipV3   // Diamond Data embebido
  hephFilePath?: string             // referencia .lfx opcional
  zones?: string[]                  // zonas objetivo
  priority?: number                 // prioridad de blend
}
```

#### 3. CustomFXPad click handler en REC mode

```typescript
// CustomFXDock.tsx — handleClick en REC mode
const handleClick = useCallback(() => {
  if (isRecording) {
    // REC mode: grabar el efecto en el timeline
    const recorder = getChronosRecorder()
    recorder.recordFX(
      cachedClip!,           // HephAutomationClipV3 del cache
      clip.filePath,         // path .lfx
      clip.name,             // display name
      clip.durationMs,       // duración del .lfx
      cachedClip?.spatialZones as string[],
      cachedClip?.priority,
    )
  } else {
    // EDIT mode: preview momentáneo (TODO futuro)
    onClick?.(clip)
  }
}, [isRecording, clip, cachedClip])
```

#### 4. ChronosLayout handler — branch FX

```typescript
// ChronosLayout.tsx — handleClipRecorded
const handleClipRecorded = (data: { clip: RecordedClip }) => {
  const clip = data.clip
  
  if (clip.clipType === 'fx') {
    // FX clip: crear FXClip con Diamond Data
    const timelineClip: FXClip = createHephFXClip(
      clip.displayName,
      clip.hephFilePath!,
      clip.startMs,
      clip.durationMs,
      clip.trackId,
      clip.hephClip?.effectType ?? 'custom',
      clip.hephClip,
      clip.zones,
      clip.priority,
    )
    clipState.addClip(timelineClip)
  } else {
    // Vibe clip: crear VibeClip (existente)
    const timelineClip: VibeClip = {
      id: clip.id,
      type: 'vibe',
      label: clip.displayName,
      startMs: clip.startMs,
      endMs: clip.startMs + clip.durationMs,
      color: clip.color || '#FF6B35',
      trackId: clip.trackId,
      locked: false,
      vibeType: toVibeType(clip.effectId),
      intensity: 1.0,
      fadeInMs: 500,
      fadeOutMs: 500,
    }
    clipState.addClip(timelineClip)
  }
}
```

#### 5. Hardware trigger (botonera / mesa de faders / MIDI)

```typescript
// Propuesta: MIDI mapping para trigger de efectos en REC mode
// 
// El usuario mapea pads MIDI a efectos del Arsenal.
// En REC mode, un pad press dispara recordFX().
//
// Integración con useMidiLearn existente:
//   - MidiLearn ya captura CC/Note inputs
//   - En REC mode, un Note On dispara recordFX(efectoMapeado)
//   - En EDIT mode, un Note On dispara preview (TODO)

interface MidiRecordMapping {
  noteNumber: number
  channel: number
  hephClipId: string       // efecto del Arsenal
  hephFilePath: string
}
```

#### 6. Quantize to transient (GodEar FFT)

```typescript
// Propuesta: snap a transients además de beat grid
//
// snapToGrid(timeMs) actualmente solo usa BPM.
// Si analysis.transients está disponible, ofrecer snap al transient más cercano.
//
// Modos de quantize:
//   'beat'     → snap a beat grid (actual)
//   'transient' → snap al transient más cercano (kick/snare)
//   'off'      → sin quantize

private snapToGrid(timeMs: number): number {
  if (!this.state.quantizeEnabled) return timeMs
  
  if (this.state.quantizeMode === 'transient' && this.state.transients) {
    return this.snapToNearestTransient(timeMs)
  }
  
  // Default: beat grid
  const beatDurationMs = 60000 / this.state.bpm
  const beatIndex = Math.round(timeMs / beatDurationMs)
  return Math.max(0, beatIndex * beatDurationMs)
}
```

#### 7. Integración con ChronosStoreV2

```typescript
// Propuesta: el recorder escribe directamente en ChronosStoreV2
// en lugar de mantener su propia lista de RecordedClip[].
//
// Esto elimina la duplicación y asegura que los clips grabados
// pasen inmediatamente al store V2 (que es el modelo runtime).
//
// ChronosRecorder.recordFX() → storeV2.addClip(trackId, clip)
// ChronosRecorder.recordVibe() → storeV2.addClip(trackId, clip)
//
// Los eventos 'clip-added'/'clip-growing' siguen emitiéndose
// para que la UI actualice en tiempo real.
```

### Flujo Record Mode V3 propuesto

```
┌─── ARSENAL DOCK (REC MODE) ──────────────────────────┐
│                                                       │
│  ┌─── CustomFXDock ────────┐  ┌─── Trigger Zone ───┐ │
│  │                         │  │  ArmButton:         │ │
│  │  REC mode:              │  │  idle → armed → REC │ │
│  │  Click pad → recordFX() │  │                     │ │
│  │  MIDI pad → recordFX()  │  │  Quantize: beat/tr  │ │
│  │  Fader button → record  │  │  Mode: REC          │ │
│  │                         │  │  Count: N clips     │ │
│  └─────────────────────────┘  └─────────────────────┘ │
└───────────────────────────────────────────────────────┘
         │ recordFX() / recordVibe()
         ▼
┌─── ChronosRecorder V3 ───────────────────────────────┐
│                                                       │
│  recordVibe()  → snapToGrid → LATCH → emit clip-added │
│  recordFX()    → snapToGrid → FXClip fixed → emit     │
│                                                       │
│  Quantize modes:                                     │
│    beat      → snap a BPM grid                       │
│    transient → snap a GodEar transients               │
│    off       → free timing                           │
│                                                       │
│  Living clip: vibe crece en tiempo real               │
│  FX clip: duración fija del .lfx                      │
│                                                       │
│  → ChronosStoreV2.addClip(trackId, clip)              │
│  → emit('clip-added') → UI real-time                  │
└───────────────────────────────────────────────────────┘
         │
         ▼
┌─── TIMELINE CANVAS ──────────────────────────────────┐
│                                                       │
│  Vibe clip: crece visualmente (living clip)           │
│  FX clip: aparece con duración fija + hephClip data   │
│  Quantize: clips alineados a beat/transient grid      │
│                                                       │
│  Al parar REC → clips quedan en timeline              │
│  Guardar .lux V3 → clips persisten con tracks         │
└───────────────────────────────────────────────────────┘
```

### Interacción Whisper + Record

El modo Record se complementa con Whisper (`vibeBase`):

1. **Sin REC:** El motor usa `vibeBase` como L0 automático. El show "se toca solo".
2. **Con REC:** El operador graba **overrides** sobre la base. Los VibeClips cambian la vibe temporalmente. Los FXClips inyectan efectos puntuales.
3. **Post-REC:** Los clips grabados son editables. Se pueden mover, recortar, duplicar.
4. **Guardar:** Todo se persiste en `.lux V3` — `vibeBase` + clips grabados + análisis.

> **Workflow típico:**
> 1. Cargar audio → GodEar FFT analiza en frío
> 2. Seleccionar `vibeBase` (ej: techno-club) → el 90% del show está hecho
> 3. ARM REC → click en efectos del Arsenal durante drops/climaxes
> 4. Stop REC → revisar/editar clips grabados
> 5. Guardar `.lux V3` → show self-contained, portable

---

## 10. Roadmap de Implementación

### Fase A: Schema V3 + Conversores (sin breaking changes)

1. Definir `LuxFileV3` interface en `ChronosProject.ts`
2. Implementar `luxV3ToRuntime()` y `runtimeToLuxV3()` conversores
3. Implementar `computeLuxChecksum()` (SHA-256)
4. Implementar `detectLuxSchema()` — discriminador `$schema`
5. Actualizar `ChronosStoreV2._applyLoadedJson()` para detectar V3 vs V2 legacy
6. Actualizar `ChronosStoreV2.save()` para serializar como V3
7. **Tests:** round-trip V3 preserva tracks, viewport, analysis

### Fase B: Tracks persistidas (round-trip fiel)

1. `runtimeToLuxV3()` serializa `tracks: TimelineTrackV2[]` tal cual
2. `luxV3ToRuntime()` carga tracks tal cual, sin inferencia
3. Mantener `luxToChronosV2()` solo para migración de V2 legacy
4. **Tests:** crear 3 tracks con labels/zones custom → guardar → cargar → tracks idénticas

### Fase C: Audio portable + Análisis embebido

1. `audio.path` → `audio.relativePath` (relativo al `.lux`)
2. Resolver path absoluto al cargar (`path.join(luxDir, relativePath)`)
3. `AnalysisData` se serializa dentro del `.lux`
4. Al cargar, si `analysis` está presente, se usa directamente
5. Si no está, se ofrece al usuario "Analizar ahora" (GodEar Offline)
6. **Tests:** guardar con análisis → cargar → análisis presente y válido

### Fase D: VibeBase (whisper)

1. Añadir `vibeBase: VibeBase | null` a `ChronosProjectV2` y `LuxFileV3`
2. `TimelineEngine` usa `vibeBase` cuando no hay VibeClip activo
3. UI: selector de vibe base en el TransportBar o un panel "Show Settings"
4. **Tests:** show sin VibeClips → vibeBase se aplica al reproducir

### Fase E: Safety + Polish

1. `safetyDeclaration` a nivel show (merge de todos los hephClips)
2. Timestamps ISO 8601
3. Eliminar `library` (redundante con hephClips embebidos)
4. Eliminar `presets: any[]`
5. Renombrar `ChronosProjectV2` → `ChronosProjectV3` (opcional, alinear con .lfx)
6. Actualizar `PROJECT_VERSION = '3.0'`
7. **Tests:** safety declaration válido, timestamps ISO, sin library

### Fase F: Reproductor .lux (post-schema, pre-UI)

1. Reconstruir `SceneBrowser` / reproductor de `.lux` en Hyperion
2. Cargar `.lux V3` → `TimelineEngine.loadProject()`
3. Visualización de waveform desde `analysis` embebido
4. Transporte: play/pause/seek con sync de audio
5. Modo híbrido: `vibeBase` + VibeClips + FXClips → L0 + HephaestusRuntime
6. **Tests:** cargar `.lux V3` real → playback → DMX output correcto

### Fase G: Record Mode V3 (grabación en vivo)

1. Extender `RecordedClipType` a `'vibe' | 'fx'` + campos FX opcionales
2. Implementar `ChronosRecorder.recordFX()` con Diamond Data embebido
3. Wire `CustomFXPad.handleClick` en REC mode → `recordFX()`
4. Branch FX en `ChronosLayout.handleClipRecorded` → `createHephFXClip()`
5. Integrar recorder con `ChronosStoreV2.addClip()` (eliminar duplicación)
6. Quantize to transient (modo `'beat' | 'transient' | 'off'`)
7. Hardware trigger: MIDI Note On → `recordFX(efectoMapeado)` vía `useMidiLearn`
8. Undo durante REC (wired a Ctrl+Z o botón)
9. Auto-stop al finalizar audio
10. **Tests:** grabar vibe + FX en sesión REC → clips en timeline → guardar `.lux V3` → recargar → clips intactos

---

> **Corte GM3:** El schema V3.0 debe estar blindado antes de tocar UI.  
> `.lux` y `.lfx` son hermanos de batalla: mismo rigor, misma disciplina.  
> El whisper (vibeBase) es la ventaja competitiva — el 90% del trabajo lo hace el L0.  
> Record mode es la diversión — el operador captura momentos sobre la base del whisper.