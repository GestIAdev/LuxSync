# 🏛️ PLAN DE ACCIÓN — Núcleo Inmutable .lux V3

> **Fecha:** 29 Jun 2026  
> **Premisa:** `.lux` nace LIMPIA en V3. No hay shows V2 previos. No hay conversores legacy.  
> **Objetivo:** Crear el schema V3 como núcleo incorruptible de Chronos, 100% compatible con `.lfx V3`.  
> **Disciplina:** Schema primero → consumidores después. Nunca al revés.

---

## 📋 Índice

1. [Principios Rectores](#1-principios-rectores)
2. [Anatomía del Schema .lux V3](#2-anatomía-del-schema-lux-v3)
3. [Estrategia BPM](#3-estrategia-bpm)
4. [Compatibilidad con .lfx V3](#4-compatibilidad-con-lfx-v3)
5. [Fases de Implementación](#5-fases-de-implementación)
6. [Archivos a Crear/Modificar](#6-archivos-a-crearmodificar)
7. [Criterios de Aceptación](#7-criterios-de-aceptación)

---

## 1. Principios Rectores

### 1.1 — Schema Primero, Consumidores Después

```
┌─────────────────────────────────────────────────────────┐
│  PASO 1: Definir LuxFileV3 (schema inmutable)           │
│  PASO 2: Validar schema con tests unitarios              │
│  PASO 3: Recién entonces, adaptar consumidores           │
│         (ChronosStore, TimelineEngine, UI, IPC)          │
└─────────────────────────────────────────────────────────┘
```

### 1.2 — Sin Legacy, Sin Conversores

- **No existe `luxToChronosV2()`** — se elimina.
- **No existe `chronosV2ToLux()`** — se elimina.
- **No existe `detectProjectVersion()`** — solo V3.
- **No existe `PROJECT_VERSION = '2.0'`** — solo `'3.0'`.
- `LuxProject` (V2) se **reemplaza** por `LuxFileV3`.
- `ChronosProjectV2` se **reemplaza** por `ChronosProjectV3` (runtime).

### 1.3 — Un Solo Modelo, Dos Representaciones

```
┌─────────────────────────────────────────────────────────┐
│                                                          │
│   LuxFileV3 (.lux en disco)     ChronosProjectV3 (RAM)   │
│   ═══════════════════════       ═══════════════════════  │
│   • Serializado a disco         • Estado en memoria      │
│   • Tracks + clips              = LuxFileV3 + estado     │
│   • Audio portable                de edición (viewport,  │
│   • Análisis embebido             playhead, selección)   │
│   • VibeBase (whisper)                                   │
│   • BPM base (FFT)                = Mismo objeto base    │
│   • Safety declaration            + campos runtime       │
│                                                          │
│   Conversión: NINGUNA                                    │
│   LuxFileV3 → load() → ChronosProjectV3                  │
│   ChronosProjectV3 → save() → LuxFileV3                  │
│   (mismo objeto, solo se strip/restore campos runtime)   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 1.4 — Compatible Únicamente con .lfx V3

- Los FXClips embeben `HephAutomationClipV3` (schema `'3.0'`).
- No se aceptan clips V2.1 en `.lux V3`.
- El `LfxFileLoader` ya solo acepta `luxsync.lfx/3.0` (FASE 3 demolición completada).
- `$schema: 'luxsync.lux/3.0'` — discriminador literal exacto.

---

## 2. Anatomía del Schema .lux V3

### 2.1 — LuxFileV3 (archivo en disco)

```typescript
// ════════════════════════════════════════════════════════════════
// NÚCLEO INMUTABLE — .lux V3.0
// ════════════════════════════════════════════════════════════════

export interface LuxFileV3 {
  /** Discriminador de schema. Literal exacto 'luxsync.lux/3.0'. */
  readonly $schema: 'luxsync.lux/3.0'

  /** Metadatos del show */
  readonly meta: LuxMetaV3

  /** Referencia al archivo de audio (portable) */
  readonly audio: LuxAudioV3 | null

  /** Análisis pre-computado del GodEar FFT (embebido) */
  readonly analysis: LuxAnalysisV3 | null

  /** Vibe base — el "whisper" que toca el 90% del show */
  readonly vibeBase: VibeBaseV3 | null

  /** Tracks del timeline (persistidas tal cual) */
  readonly tracks: readonly LuxTrackV3[]

  /** Markers del usuario */
  readonly markers: readonly LuxMarkerV3[]

  /** Safety declaration a nivel show */
  readonly safety: LuxSafetyV3 | null

  /** Checksum SHA-256 sobre el contenido canónico */
  readonly checksum: string
}
```

### 2.2 — LuxMetaV3

```typescript
export interface LuxMetaV3 {
  /** Nombre del show */
  name: string

  /** Autor */
  author: string

  /** Descripción opcional */
  description?: string

  /** Fecha de creación (ISO 8601) */
  createdAt: string

  /** Última modificación (ISO 8601) */
  modifiedAt: string

  /** Duración total del show en ms */
  durationMs: number
}
```

### 2.3 — LuxAudioV3 (portable)

```typescript
export interface LuxAudioV3 {
  /** Nombre del archivo original */
  fileName: string

  /** Path relativo al .lux (portable) */
  relativePath: string

  /** Duración del audio en ms */
  durationMs: number

  /** Hash SHA-256 del archivo de audio (para verificar integridad) */
  audioHash?: string

  /** Offset de inicio del audio en el timeline (ms) */
  offsetMs: number
}
```

### 2.4 — LuxAnalysisV3 (GodEar FFT embebido)

```typescript
export interface LuxAnalysisV3 {
  /** BPM medio detectado por el FFT worker */
  detectedBpm: number

  /** Confianza del BPM detectado (0-1) */
  bpmConfidence: number

  /** Beat grid: timestamps en ms de cada beat */
  beatGrid: number[]

  /** Secciones detectadas (verso, chorus, drop, etc.) */
  sections: LuxSectionV3[]

  /** Transients detectados (kicks, snares) */
  transients: LuxTransientV3[]

  /** Heatmap de energía por segmento */
  energyHeatmap: number[]

  /** Forma de onda downsampled para UI */
  waveform: number[]
}

export interface LuxSectionV3 {
  startMs: number
  endMs: number
  label: string
  energy: number
}

export interface LuxTransientV3 {
  timeMs: number
  type: 'kick' | 'snare' | 'hihat' | 'unknown'
  intensity: number
}
```

### 2.5 — VibeBaseV3 (Whisper)

```typescript
export interface VibeBaseV3 {
  /** ID del vibe base (ej: 'techno-club', 'fiesta-latina') */
  vibeId: string

  /** Nombre display */
  displayName: string

  /** Intensidad base (0-1) */
  intensity: number

  /** Color representativo */
  color: string

  /** Icono emoji */
  icon: string
}
```

### 2.6 — LuxTrackV3

```typescript
export interface LuxTrackV3 {
  /** UUID v4 inmutable */
  readonly id: string

  /** Zona canónica de ruteo */
  readonly targetZone: string

  /** Label visual (UI-only) */
  visualLabel: string

  /** Color UI */
  color: string

  /** Clips en esta track */
  clips: readonly LuxClipV3[]

  /** ¿Track habilitada? */
  enabled: boolean

  /** ¿Track en solo? */
  solo: boolean

  /** ¿Track bloqueada? */
  locked: boolean

  /** Orden visual */
  order: number

  /** Altura en pixels (UI) */
  height: number
}
```

### 2.7 — LuxClipV3 (Vibe + FX unificados)

```typescript
export type LuxClipType = 'vibe' | 'fx'

export interface LuxClipV3 {
  readonly id: string
  type: LuxClipType

  /** Label display */
  label: string

  /** Inicio en ms */
  startMs: number

  /** Fin en ms */
  endMs: number

  /** Color UI */
  color: string

  /** ¿Bloqueado? */
  locked: boolean

  // ── VIBE-ONLY ──
  vibeType?: string
  intensity?: number
  fadeInMs?: number
  fadeOutMs?: number

  // ── FX-ONLY (Diamond Data embebido) ──
  /** HephAutomationClipV3 completo — self-contained */
  hephClip?: HephAutomationClipV3
  /** Path del .lfx origen (referencia opcional) */
  hephFilePath?: string
  /** Zonas objetivo del efecto */
  zones?: string[]
  /** Prioridad de blend */
  priority?: number
  /** MixBus routing */
  mixBus?: 'global' | 'htp' | 'ambient' | 'accent'
}
```

### 2.8 — LuxMarkerV3

```typescript
export interface LuxMarkerV3 {
  readonly id: string
  timeMs: number
  type: 'drop' | 'breakdown' | 'buildup' | 'section' | 'cue' | 'note'
  label: string
  color?: string
}
```

### 2.9 — LuxSafetyV3

```typescript
export interface LuxSafetyV3 {
  /** Merge de todos los safetyDeclarations de los hephClips embebidos */
  maxStrobeFreqHz: number
  containsRapidFlash: boolean
  communityTrusted: boolean
}
```

### 2.10 — ChronosProjectV3 (runtime = LuxFileV3 + estado de edición)

```typescript
export interface ChronosProjectV3 {
  // ── Mismo contenido que LuxFileV3 ──
  $schema: 'luxsync.lux/3.0'
  meta: LuxMetaV3
  audio: LuxAudioV3 | null
  analysis: LuxAnalysisV3 | null
  vibeBase: VibeBaseV3 | null
  tracks: LuxTrackV3[]
  markers: LuxMarkerV3[]
  safety: LuxSafetyV3 | null
  checksum: string

  // ── Campos runtime (NO se serializan a disco) ──
  /** Posición del playhead (ms) */
  playheadMs: number
  /** Viewport start (ms) */
  viewportStartMs: number
  /** Zoom level (pixels per second) */
  pixelsPerSecond: number
  /** BPM runtime actual (rBPM del Worker o fallback al detectado) */
  runtimeBpm: number
  /** IDs de clips seleccionados */
  selectedClipIds: Set<string>
}
```

---

## 3. Estrategia BPM

### 3.1 — Decisión: FFT detect + override manual

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  1. PRE-ANÁLISIS (GodEar FFT Worker — offline)               │
│     └─ Detecta BPM medio de la pista                         │
│     └─ Lo escribe en lux.analysis.detectedBpm                │
│     └─ Lo escribe en lux.audio.bpm (redundancia para UI)     │
│                                                              │
│  2. RUNTIME (Playback en vivo)                               │
│     └─ Worker GodEar (live) → rBPM dinámico                  │
│     └─ Si Worker activo (conf > 0.2) → usar rBPM live        │
│     └─ Si Worker sordo + memoria → freewheel (último estable)│
│     └─ Si sin audio o sin memoria → fallback a detectedBpm   │
│     └─ Si operador hace override manual → ese gana           │
│                                                              │
│  3. PERSISTENCIA                                             │
│     └─ .lux guarda detectedBpm (referencia, no runtime)      │
│     └─ .lux NO guarda runtimeBpm (es efímero)                │
│     └─ Al recargar: runtimeBpm = detectedBpm hasta que       │
│        el Worker lockee un BPM real                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 — Cadena de prioridad BPM en runtime

```
Prioridad 1: Override manual del operador (si existe)
Prioridad 2: rBPM del Worker (conf > 0.2) — verdad física
Prioridad 3: Freewheel memory (último BPM estable del Worker)
Prioridad 4: detectedBpm del .lux (análisis pre-computado)
Prioridad 5: 120 BPM (default absoluto, último recurso)
```

### 3.3 — Schema BPM

```typescript
// En LuxAudioV3:
export interface LuxAudioV3 {
  // ... otros campos ...
  /** BPM detectado por FFT (referencia base, no runtime) */
  detectedBpm: number
  /** Confianza del BPM detectado (0-1) */
  bpmConfidence: number
}

// En ChronosProjectV3 (runtime):
export interface ChronosProjectV3 {
  // ... campos de LuxFileV3 ...
  /** BPM runtime actual (del Worker o fallback) */
  runtimeBpm: number
  /** Override manual del operador (null = sin override) */
  manualBpmOverride: number | null
}
```

### 3.4 — ChronosRecorder + BPM

El `ChronosRecorder` ya tiene `setBpm()`. En V3:

```typescript
// Al iniciar playback:
recorder.setBpm(project.runtimeBpm)

// El ChronosLayout se suscribe al rBPM del Worker:
useEffect(() => {
  const unsub = streaming.onBpmChange((bpm) => {
    recorder.setBpm(bpm)
  })
  return unsub
}, [])
```

---

## 4. Compatibilidad con .lfx V3

### 4.1 — Reglas de matrimonio

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  .lux V3                     .lfx V3                         │
│  ═══════                     ═══════                         │
│  $schema: 'luxsync.lux/3.0'  $schema: 'luxsync.lfx/3.0'    │
│                                                              │
│  · FXClips embeben            · HephAutomationClipV3        │
│    HephAutomationClipV3         completo                     │
│    (Diamond Data)            · tracks: HephTrack[]          │
│                              · cognitiveDNA                 │
│  · hephFilePath es            · safetyDeclaration           │
│    REFERENCIA opcional         · schemaVersion: '3.0'       │
│    (el .lux es                · checksum: SHA-256           │
│     self-contained)                                          │
│                                                              │
│  · Si un .lfx se actualiza, el .lux NO se invalida:         │
│    el hephClip embebido es la verdad en runtime.            │
│    hephFilePath es solo para "re-importar" desde UI.        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 — Validación cruzada

- Al cargar un `.lux V3`, cada FXClip con `hephClip` se valida:
  - `hephClip.schemaVersion === '3.0'` (debe ser V3)
  - `hephClip.tracks.length > 0` (debe tener al menos 1 track)
  - Si `hephFilePath` está presente, es solo referencial
- No se carga el `.lfx` externo en runtime — el `hephClip` embebido es la verdad
- El `.lfx` se carga solo si el usuario explicitamente "re-importa" desde la UI

---

## 5. Fases de Implementación

### FASE 1 — Schema V3 (Núcleo inmutable) — SIN TOUCHING CONSUMERS

**Objetivo:** Definir todos los tipos V3, validarlos con tests, cero cambios en código existente.

1. Crear `src/chronos/core/LuxFileV3.ts` — todas las interfaces V3
2. Crear `src/chronos/core/LuxFileV3.schema.ts` — validación runtime (type guards)
3. Crear `src/chronos/core/LuxFileV3.factories.ts` — `createEmptyLuxV3()`, `createTrackV3()`, `createVibeClipV3()`, `createFXClipV3()`
4. Crear `src/chronos/core/LuxFileV3.serializer.ts` — `serializeLuxV3()` (→ JSON + checksum), `deserializeLuxV3()` (JSON → LuxFileV3 + validar checksum)
5. **Tests:** `LuxFileV3.test.ts` — round-trip serialize/deserialize, checksum validation, type guards

**Entregable:** Schema V3 definido, testeado, compilando. Cero impacto en código existente.

### FASE 2 — Demolición de V2 (Limpiar el camino)

**Objetivo:** Eliminar todo el código V2 que ya no sirve. Sin conversores, sin legacy.

1. Eliminar `LuxProject`, `ProjectMeta`, `ProjectAudio`, `ProjectTimeline`, `ProjectLibrary`, `HephEffectSummary` de `ChronosProject.ts`
2. Eliminar `ChronosProjectV2`, `ChronosProjectMeta`, `PlaybackConfig` de `types.ts` (o migrar a V3)
3. Eliminar `luxToChronosV2()`, `chronosV2ToLux()` de `ChronosProject.ts`
4. Eliminar `detectProjectVersion()` de `ChronosStore.ts`
5. Eliminar `PROJECT_VERSION = '2.0'` → reemplazar por `'3.0'`
6. Actualizar `ProjectTypes.ts` (barrel) para exportar solo V3
7. **Tests:** `ProjectTypes.test.ts` actualizado para V3

**Entregable:** Código V2 eliminado. Compilación rota esperada en consumidores (se arregla en Fase 3).

### FASE 3 — Adaptar Consumidores (al schema, no al revés)

**Objetivo:** Hacer que todos los consumidores del schema viejo usen V3.

3A. `ChronosStoreV3` (reemplaza ChronosStoreV2):
- `_applyLoadedJson()` → `deserializeLuxV3()`
- `save()` → `serializeLuxV3()`
- Estado interno = `ChronosProjectV3`

3B. `TimelineEngine`:
- `loadProject()` acepta `LuxFileV3`
- Filtra clips en `tracks[].clips` (no en `timeline.clips` plano)
- FXClips → `HephaestusRuntime.ingest(clip.hephClip)`
- VibeClips → `TitanOrchestrator.setVibe(clip.vibeType)`

3C. `ChronosLayout.tsx`:
- `bpm` state → `project.runtimeBpm`
- Sync con rBPM del Worker
- `clipState` → usa `ChronosProjectV3.tracks`

3D. `ChronosIPCHandlers.ts`:
- `chronos:save-project` → `serializeLuxV3()`
- `chronos:load-project` → `deserializeLuxV3()`

3E. `TransportBar.tsx`:
- BPM display → `runtimeBpm` (con indicador "detected" vs "live")

3F. `ChronosRecorder.ts`:
- `setBpm()` → se alimenta del rBPM del Worker

**Entregable:** Todos los consumidores usan V3. Compilación limpia.

### FASE 4 — Audio Portable + Análisis Embebido

1. `audio.path` (absoluto) → `audio.relativePath` (relativo al `.lux`)
2. Resolver path absoluto al cargar: `path.join(luxDir, relativePath)`
3. GodEar FFT worker: al terminar análisis, escribir `LuxAnalysisV3` en el `.lux`
4. Al cargar `.lux` con `analysis` presente, usar directamente (sin re-análisis)
5. Si no hay `analysis`, ofrecer "Analizar ahora" desde UI

### FASE 5 — VibeBase (Whisper)

1. Añadir `vibeBase` al schema (ya definido en Fase 1)
2. `TimelineEngine`: cuando no hay VibeClip activo, usar `vibeBase.vibeId`
3. UI: selector de vibe base en TransportBar o panel "Show Settings"

### FASE 6 — Record Mode V3

1. `ChronosRecorder.recordFX()` con `HephAutomationClipV3` embebido
2. `CustomFXPad` click en REC mode → `recordFX()`
3. `ChronosLayout.handleClipRecorded` — branch FX/Vibe
4. Quantize to transient (usando `analysis.transients`)
5. Hardware trigger (MIDI Note On → `recordFX()`)

---

## 6. Archivos a Crear/Modificar

### Crear (FASE 1)

| Archivo | Descripción |
|---|---|
| `src/chronos/core/LuxFileV3.ts` | Todas las interfaces V3 (schema inmutable) |
| `src/chronos/core/LuxFileV3.schema.ts` | Type guards y validación runtime |
| `src/chronos/core/LuxFileV3.factories.ts` | Factory functions (createEmpty, createTrack, etc.) |
| `src/chronos/core/LuxFileV3.serializer.ts` | Serialize/deserialize + checksum SHA-256 |
| `src/chronos/__tests__/LuxFileV3.test.ts` | Tests de round-trip, checksum, validación |

### Demoler (FASE 2)

| Archivo | Qué se elimina |
|---|---|
| `src/chronos/core/ChronosProject.ts` | `LuxProject`, `ProjectMeta`, `ProjectAudio`, `ProjectTimeline`, `ProjectLibrary`, `HephEffectSummary`, `luxToChronosV2()`, `chronosV2ToLux()`, `createEmptyProject()`, `createProjectFromState()`, `serializeProject()`, `deserializeProject()`, `validateProject()` |
| `src/chronos/core/types.ts` | `ChronosProjectV2`, `ChronosProjectMeta`, `PlaybackConfig` (migrar campos útiles a V3) |
| `src/chronos/core/ProjectTypes.ts` | Reescribir barrel para solo V3 |
| `src/chronos/core/ChronosStore.ts` | `detectProjectVersion()`, `_applyLoadedJson()` V2 path |

### Modificar (FASE 3+)

| Archivo | Cambio |
|---|---|
| `src/chronos/core/ChronosStore.ts` | → `ChronosStoreV3` con `ChronosProjectV3` |
| `src/core/engine/TimelineEngine.ts` | `loadProject(LuxFileV3)` |
| `src/chronos/ui/ChronosLayout.tsx` | BPM runtime, clipState V3 |
| `src/chronos/ui/transport/TransportBar.tsx` | BPM display runtime |
| `src/chronos/core/ChronosRecorder.ts` | setBpm from rBPM Worker |
| `electron/ipc/ChronosIPCHandlers.ts` | save/load V3 |
| `src/chronos/core/TimelineClip.ts` | Align con LuxClipV3 |

---

## 7. Criterios de Aceptación

### FASE 1 (Schema)
- [ ] `LuxFileV3.ts` define todas las interfaces sin imports de V2
- [ ] `serializeLuxV3()` → JSON → `deserializeLuxV3()` → objeto idéntico
- [ ] Checksum SHA-256 valido y verificado
- [ ] Type guards rechazan objetos malformados
- [ ] `tsc --noEmit` pasa sin errores en archivos V3
- [ ] Tests pasan: round-trip, checksum, validación

### FASE 2 (Demolición)
- [ ] No quedan referencias a `LuxProject`, `ChronosProjectV2`, `luxToChronosV2`, `chronosV2ToLux`
- [ ] No quedan referencias a `PROJECT_VERSION = '2.0'`
- [ ] `grep -r "ChronosProjectV2" src/` → 0 resultados
- [ ] `grep -r "luxToChronosV2" src/` → 0 resultados

### FASE 3 (Consumidores)
- [ ] `ChronosStoreV3` carga/salva V3
- [ ] `TimelineEngine` reproduce desde `LuxFileV3.tracks`
- [ ] `ChronosLayout` muestra BPM runtime del Worker
- [ ] `tsc --noEmit` pasa limpio
- [ ] Demo: crear show vacío → añadir vibe + FX clip → guardar → cargar → reproducir

### Demo-ready
- [ ] Show vacío se crea en V3
- [ ] Audio se carga con path relativo
- [ ] FFT detecta BPM y lo guarda en `analysis.detectedBpm`
- [ ] VibeBase seleccionable desde UI
- [ ] FXClips del Arsenal se arrastran al timeline
- [ ] Guardar .lux V3 → cargar .lux V3 → reproducir → DMX output
- [ ] Record mode: ARM REC → click FX → clip aparece en timeline

---

> **Corte:** El schema V3 es la constitución. Se define primero, se testa segundo,  
> y SOLO entonces se adaptan los consumidores.  
> `.lux` y `.lfx` son hermanos de batalla: mismo rigor, misma disciplina, mismo schema version.  
> El BPM del `.lux` es la referencia; el rBPM del Worker es la verdad en runtime.
