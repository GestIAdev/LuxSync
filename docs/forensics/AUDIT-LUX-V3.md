# 🔒 AUDIT .lux — Blindeado V3 y Hermano de Batalla con .lfx

> **Fecha:** 29 Jun 2026  
> **Estado:** Propuesta técnica post-demolición V1  
> **Contexto:** FASE 7 completada. El esqueleto V2 está limpio. Ahora se blinda `.lux` como verdad única de escenas/shows.

---

## 📋 Índice

1. [Estado Actual del .lux](#1-estado-actual-del-lux)
2. [Anatomía Comparada: .lux vs .lfx](#2-anatomía-comparada-lux-vs-lfx)
3. [Problemas Detectados](#3-problemas-detectados)
4. [Propuesta: .lux V3.0](#4-propuesta-lux-v30)
5. [Estructura del Schema V3.0](#5-estructura-del-schema-v30)
6. [Estrategia de Migración](#6-estrategia-de-migración)
7. [Whisper — La Vibe como Pista Base](#7-whisper--la-vibe-como-pista-base)
8. [Pre-análisis en Frío (GodEar FFT)](#8-pre-análisis-en-frío-godear-fft)
9. [Record Mode — Grabación en Vivo](#9-record-mode--grabación-en-vivo)
10. [Roadmap de Implementación](#10-roadmap-de-implementación)

---

## 1. Estado Actual del .lux

### Pipeline actual (post-FASE 7)

```
┌─── DISCO ──────────────────────────────────────────┐
│  archivo.lux (JSON, version: "2.0")                │
│                                                    │
│  {                                                 │
│    meta: { version: "2.0", name, author, ... },    │
│    audio: { path, bpm, durationMs, checksum },     │
│    timeline: {                                     │
│      clips: TimelineClip[],  ← lista plana         │
│      playheadMs, viewportStartMs, pixelsPerSecond  │
│    },                                              │
│    library: { customEffects: HephEffectSummary[] } │
│  }                                                 │
└────────────────────────────────────────────────────┘
         │  readFileSync / writeFile (ChronosIPCHandlers)
         ▼
┌─── FRONTEND (Renderer) ────────────────────────────┐
│  ChronosStoreV2._applyLoadedJson(json)             │
│    ├── detectProjectVersion(raw)                   │
│    │     ├── '2.0.0' → ChronosProjectV2 directo    │
│    │     └── 'lux'    → deserializeProject →       │
│    │                     luxToChronosV2 → V2       │
│    └── this.project = ChronosProjectV2             │
│                                                    │
│  ChronosStoreV2.save()                             │
│    └── chronosV2ToLux(this.project) → LuxProject   │
│        └── serializeProject(lux) → JSON string     │
└────────────────────────────────────────────────────┘
         │  IPC: lux:playback:load(project)
         ▼
┌─── BACKEND (Main) ─────────────────────────────────┐
│  TimelineEngine.loadProject(lux: LuxProject)       │
│    ├── fxClips = clips.filter(type === 'fx')       │
│    ├── vibeClips = clips.filter(type === 'vibe')   │
│    └── tick(timeMs) → HephaestusRuntime            │
└────────────────────────────────────────────────────┘
```

### Tipos involucrados

| Tipo | Archivo | Rol |
|---|---|---|
| `LuxProject` | `ChronosProject.ts:134` | Formato serializado en disco |
| `ProjectMeta` | `ChronosProject.ts:46` | Metadata del archivo (version, author, timestamps) |
| `ProjectAudio` | `ChronosProject.ts:67` | Referencia al archivo de audio |
| `ProjectTimeline` | `ChronosProject.ts:88` | Lista plana de clips + viewport |
| `ProjectLibrary` | `ChronosProject.ts:103` | Resumen de efectos Hephaestus usados |
| `TimelineClip` | `TimelineClip.ts:213` | `VibeClip \| FXClip` (unión concreta) |
| `ChronosProjectV2` | `types.ts:667` | Modelo runtime en memoria (version `'2.0.0'`) |

### Constantes actuales

```
PROJECT_VERSION = '2.0'        ← versión del .lux en disco
PROJECT_EXTENSION = '.lux'
PROJECT_MIME = 'application/x-luxsync-project'
```

---

## 2. Anatomía Comparada: .lux vs .lfx

### .lfx (Efectos — ya V3, blindado)

```json
{
  "$schema": "luxsync.lfx/3.0",       ← discriminador literal
  "clip": {                            ← HephAutomationClipV3 embebido
    "id": "heph_xxx",
    "name": "Strobe Storm",
    "schemaVersion": "3.0",            ← version del clip V3
    "tracks": [...],                   ← curvas multicelulares
    "spatialZones": [...],             ← zonas canónicas
    "mixBus": "htp",                   ← blend inter-clip
    "priority": 50,
    "durationMs": 8000,
    "effectType": "strobe",
    "staticParams": {...},
    "cognitiveDNA": {...},             ← opcional, para Selene
    "safetyDeclaration": {...}         ← opcional, safety
  },
  "checksum": "sha256..."              ← integridad criptográfica
}
```

### .lux (Escenas — actual V2, NO blindado)

```json
{
  "meta": {
    "version": "2.0",                  ← versión suelta, no discriminador
    "author": "user",
    "created": 1719650000000,          ← epoch ms (no ISO)
    "modified": 1719650100000,
    "durationMs": 180000,
    "name": "My Show"
  },
  "audio": {
    "name": "track.mp3",
    "path": "/music/track.mp3",        ← path absoluto (no portable)
    "bpm": 128,
    "offsetMs": 0,
    "durationMs": 240000,
    "checksum": "abc123"
  },
  "timeline": {
    "clips": [                         ← lista plana, sin tracks
      {
        "id": "clip-123",
        "type": "vibe",
        "vibeType": "techno-club",
        "startMs": 0,
        "endMs": 60000,
        "trackId": "chr_xxx",          ← trackId pero la track no está definida aquí
        "label": "TECHNO CLUB",
        "color": "#a855f7",
        "intensity": 1.0,
        "fadeInMs": 500,
        "fadeOutMs": 500
      },
      {
        "id": "clip-456",
        "type": "fx",
        "fxType": "heph-custom",
        "startMs": 32000,
        "endMs": 40000,
        "trackId": "chr_yyy",
        "label": "Strobe Storm",
        "color": "#f59e0b",
        "keyframes": [...],
        "params": { "effectType": "strobe" },
        "isHephCustom": true,
        "hephFilePath": "strobe-storm.lfx",  ← referencia opcional
        "hephClip": {                     ← HephAutomationClipV3 embebido
          "id": "heph_xxx",
          "schemaVersion": "3.0",
          "tracks": [...],
          "spatialZones": [...],
          "mixBus": "htp",
          ...
        },
        "zones": ["front", "movers-left"],
        "priority": 50
      }
    ],
    "playheadMs": 0,
    "viewportStartMs": 0,
    "pixelsPerSecond": 100
  },
  "library": {
    "customEffects": [
      {
        "fileName": "strobe-storm.lfx",
        "name": "Strobe Storm",
        "effectType": "strobe",
        "mixBus": "htp",
        "curveCount": 3
      }
    ],
    "presets": []
  }
}
```

### Tabla comparativa

| Aspecto | .lfx V3 | .lux V2 (actual) | Gap |
|---|---|---|---|
| **Discriminador** | `$schema: "luxsync.lfx/3.0"` (literal) | `meta.version: "2.0"` (suelto) | ❌ No hay `$schema` |
| **Checksum** | SHA-256 sobre `JSON.stringify(clip)` | Ninguno | ❌ Sin integridad |
| **Schema version** | `schemaVersion: "3.0"` dentro del clip | `meta.version: "2.0"` fuera | ❌ Inconsistente |
| **Tracks explícitas** | N/A (un clip = un efecto) | NO — lista plana de clips | ❌ Las tracks viven solo en runtime |
| **Audio portable** | N/A | Path absoluto (`/music/track.mp3`) | ❌ No portable entre máquinas |
| **Análisis embebido** | N/A | No incluido | ❌ Se pierde al cerrar |
| **Vibe base (whisper)** | N/A | VibeClips sueltos en la lista | ⚠️ Sin concepto de "pista base" |
| **Safety declaration** | `safetyDeclaration` opcional | No existe | ❌ Sin safety |
| **Cognitive DNA** | `cognitiveDNA` opcional | No existe | ❌ Sin metadata cognitiva |
| **Timestamps** | N/A | Epoch ms (números) | ⚠️ Funcional pero no ISO |
| **HephClip embebido** | Es el clip entero | `hephClip` dentro de FXClip | ✅ Ya funciona |
| **Self-contained** | Sí — no depende de .lfx externo | Sí — `hephClip` va embebido | ✅ Ya funciona |

---

## 3. Problemas Detectados

### 🔴 Críticos

1. **No hay `$schema` discriminador** — El loader usa `meta.version` que es un string suelto. No hay validación estricta de schema. Un archivo corrupto o con versión equivocada puede cargarse silenciosamente.

2. **Las tracks V2 se pierden al serializar** — `ChronosProjectV2` tiene `tracks: TimelineTrackV2[]` con `targetZone`, `visualLabel`, `order`, `color`. Pero `chronosV2ToLux()` aplana todo a `timeline.clips[]` perdiendo la estructura de tracks. Al recargar, `luxToChronosV2()` **re-infiere** las tracks desde las zones de los clips — no es round-trip fiel.

3. **Sin checksum** — No hay forma de verificar que un `.lux` no fue corruptado. `.lfx` tiene SHA-256.

4. **Audio path no portable** — `audio.path` es absoluto (`/music/track.mp3`). Entre máquinas o instalaciones, el path se rompe.

### 🟡 Importes

5. **`HephEffectSummary.mixBus` still referenced** — `extractHephEffects()` llama `getClipMixBus(fx)` que lee `hephClip.mixBus`. Funcional pero el summary debería usar `blendMode` de los tracks, no el mixBus a nivel clip.

6. **Sin análisis embebido** — `AnalysisData` (waveform, beatGrid, energyHeatmap, sections, transients) vive solo en runtime. Si se pre-analiza el audio con GodEar FFT, ese análisis se pierde al guardar. Habría que re-calcular cada vez.

7. **`ProjectLibrary.presets: any[]`** — Campo sin tipar, vacío, sin uso real.

8. **Dos versiones en conflicto conceptual** — `meta.version: "2.0"` (archivo .lux) vs `ChronosProjectV2.version: "2.0.0"` (runtime). No son lo mismo pero se confunden.

### 🟢 Cosméticos

9. **Comentarios stale** — `ChronosProject.ts` still dice "WAVE 2014 → WAVE 2081" y referencia V1.

10. **`PROJECT_VERSION = '2.0'`** — String suelto sin validación de semver.

---

## 4. Propuesta: .lux V3.0

### Filosofía

> `.lfx` es la verdad única de **efectos**.  
> `.lux` es la verdad única de **escenas/shows/pregrabados**.  
> Hermanos de batalla: mismo rigor, mismo schema discipline, mismo `$schema` discriminador.

### Cambios propuestos

| Cambio | Descripción | Prioridad |
|---|---|---|
| **`$schema` discriminador** | `"luxsync.lux/3.0"` como primer campo del JSON | 🔴 |
| **Checksum SHA-256** | Sobre `JSON.stringify({ tracks, audio, analysis, vibes })` sin pretty-print | 🔴 |
| **Tracks serializadas** | Las `TimelineTrackV2[]` se persisten tal cual, no se aplanan | 🔴 |
| **Audio portable** | Path relativo al `.lux` + checksum del audio | 🟡 |
| **Análisis embebido** | `AnalysisData` opcional dentro del `.lux` | 🟡 |
| **Vibe base (whisper)** | Campo `vibeBase` a nivel proyecto, no como clip suelto | 🟡 |
| **Safety declaration** | `safetyDeclaration` a nivel show (hereda de clips) | 🟢 |
| **Timestamps ISO** | `createdAt`/`modifiedAt` en ISO 8601 strings | 🟢 |
| **Eliminar `library`** | Redundante — los hephClips ya van embebidos en los FXClips | 🟢 |

### Renombrado de versiones

Para evitar confusión V2-runtime vs V2-archivo:

| Concepto | Actual | Propuesto |
|---|---|---|
| Versión del archivo .lux en disco | `meta.version: "2.0"` | `$schema: "luxsync.lux/3.0"` |
| Versión del runtime ChronosProjectV2 | `version: "2.0.0"` | `version: "3.0.0"` (rename a `ChronosProjectV3`) |
| Constante | `PROJECT_VERSION = '2.0'` | `PROJECT_VERSION = '3.0'` |
| Discriminador runtime | `detectProjectVersion()` busca `'2.0.0'` | Buscar `$schema === 'luxsync.lux/3.0'` |

> **Nota:** Renombrar `ChronosProjectV2` → `ChronosProjectV3` es opcional pero recomendado para alinear con `.lfx` V3. El contenido no cambia, solo el label de versión.

---

## 5. Estructura del Schema V3.0

```json
{
  "$schema": "luxsync.lux/3.0",
  "checksum": "sha256...",
  "meta": {
    "name": "My Show",
    "author": "user",
    "createdAt": "2026-06-29T08:00:00.000Z",
    "modifiedAt": "2026-06-29T08:15:00.000Z",
    "durationMs": 180000
  },
  "audio": {
    "name": "track.mp3",
    "relativePath": "audio/track.mp3",
    "bpm": 128,
    "offsetMs": 0,
    "durationMs": 240000,
    "checksum": "sha256-of-audio-file"
  },
  "vibeBase": {
    "vibeType": "techno-club",
    "intensity": 0.8,
    "label": "Base Techno"
  },
  "tracks": [
    {
      "id": "chr_xxx",
      "targetZone": "front",
      "visualLabel": "FRONT PARS",
      "color": "#ef4444",
      "order": 0,
      "height": 60,
      "enabled": true,
      "solo": false,
      "locked": false,
      "clips": [
        {
          "id": "clip-123",
          "type": "fx",
          "fxType": "heph-custom",
          "startMs": 32000,
          "endMs": 40000,
          "label": "Strobe Storm",
          "color": "#f59e0b",
          "keyframes": [...],
          "params": { "effectType": "strobe" },
          "isHephCustom": true,
          "hephFilePath": "strobe-storm.lfx",
          "hephClip": { ... HephAutomationClipV3 ... },
          "zones": ["front"],
          "priority": 50
        }
      ],
      "automation": []
    },
    {
      "id": "chr_yyy",
      "targetZone": "global",
      "visualLabel": "VIBES",
      "color": "#a855f7",
      "order": 1,
      "height": 60,
      "enabled": true,
      "solo": false,
      "locked": false,
      "clips": [
        {
          "id": "clip-vibe-1",
          "type": "vibe",
          "vibeType": "techno-club",
          "startMs": 0,
          "endMs": 180000,
          "label": "TECHNO CLUB",
          "color": "#a855f7",
          "intensity": 1.0,
          "fadeInMs": 500,
          "fadeOutMs": 500
        }
      ],
      "automation": []
    }
  ],
  "analysis": {
    "durationMs": 240000,
    "waveform": { "samplesPerSecond": 150, "peaks": [...], "rms": [...] },
    "energyHeatmap": { ... },
    "beatGrid": { ... },
    "sections": [...],
    "transients": [...]
  },
  "globalAutomation": [],
  "markers": [],
  "playback": {
    "loop": false,
    "loopRegion": null,
    "snapToBeat": true,
    "snapResolution": "beat",
    "overrideMode": "whisper",
    "latencyCompensationMs": 10
  },
  "viewport": {
    "playheadMs": 0,
    "viewportStartMs": 0,
    "pixelsPerSecond": 100
  },
  "safetyDeclaration": {
    "maxStrobeFreqHz": 8,
    "containsRapidFlash": true,
    "communityTrusted": true
  }
}
```

### Tipos TypeScript propuestos

```typescript
// ── Discriminador ──
export const LUX_SCHEMA = 'luxsync.lux/3.0' as const
export const PROJECT_VERSION = '3.0'

// ── Wrapper V3 ──
export interface LuxFileV3 {
  readonly $schema: 'luxsync.lux/3.0'
  readonly checksum: string
  meta: LuxMeta
  audio: LuxAudio | null
  vibeBase: VibeBase | null
  tracks: TimelineTrackV2[]
  analysis: AnalysisData | null
  globalAutomation: AutomationLane[]
  markers: ChronosMarker[]
  playback: PlaybackConfig
  viewport: LuxViewport
  safetyDeclaration?: SafetyDeclaration
}

export interface LuxMeta {
  name: string
  author: string
  createdAt: string        // ISO 8601
  modifiedAt: string       // ISO 8601
  durationMs: number
}

export interface LuxAudio {
  name: string
  relativePath: string     // relativo al .lux
  bpm: number
  offsetMs: number
  durationMs: number
  checksum?: string        // SHA-256 del archivo de audio
}

export interface VibeBase {
  vibeType: VibeType
  intensity: number        // 0-1
  label: string
}

export interface LuxViewport {
  playheadMs: number
  viewportStartMs: number
  pixelsPerSecond: number
}
```

---

## 6. Estrategia de Migración

### Detección de versión al cargar

```typescript
function detectLuxSchema(raw: unknown): '3.0' | '2.0' | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, any>
  
  // V3: discriminador $schema
  if (obj.$schema === 'luxsync.lux/3.0') return '3.0'
  
  // V2 legacy: meta.version
  if (obj.meta?.version === '2.0' && obj.timeline?.clips) return '2.0'
  
  return null
}
```

### Conversión V2 → V3 (al cargar .lux legacy)

```
.lux V2 (lista plana)
  → deserializeProject() → LuxProject
  → luxToChronosV2() → ChronosProjectV2 (tracks inferidas)
  → chronosV2ToLuxV3() → LuxFileV3 (tracks persistidas)
```

### Conversión V3 → runtime (al cargar .lux V3)

```
.lux V3 (tracks persistidas)
  → parseLuxV3(json) → LuxFileV3
  → luxV3ToRuntime(lux) → ChronosProjectV2 (tracks tal cual, sin inferencia)
```

### Guardado (siempre V3)

```
ChronosProjectV2 (runtime)
  → runtimeToLuxV3(ch) → LuxFileV3
  → computeChecksum(luxV3) → SHA-256
  → JSON.stringify(luxV3) → disco
```

### Round-trip fidelity

| Dirección | V2 (actual) | V3 (propuesto) |
|---|---|---|
| Guardar → Cargar | tracks se aplanan → se re-infilan ❌ | tracks se persisten tal cual ✅ |
| Track order/label/color | Se pierde ❌ | Se preserva ✅ |
| Viewport | Se guarda en `timeline` ⚠️ | Se guarda en `viewport` ✅ |
| Audio path | Absoluto ❌ | Relativo ✅ |
| Análisis | Se pierde ❌ | Se embebe ✅ |

---

## 7. Whisper — La Vibe como Pista Base

### Concepto

> La capa "IA" no es IA. Es la capa L0 automática desde:
> - **LiquidEngineBase** — físicas fotónicas líquidas
> - **SeleneColorEngine** — color + constitución
> - **VibeMovementManager + InverseKineticEngine** — movimiento clásico pan/tilt + espacial XYZ

> "Whisper" = seleccionar una vibe y dejarla como **pista base** del `.lux`.  
> Ahorra el 90% del trabajo. Es una visión diferente del mercado.

### Implementación en .lux V3

```json
{
  "vibeBase": {
    "vibeType": "techno-club",
    "intensity": 0.8,
    "label": "Base Techno"
  }
}
```

### Semántica

- `vibeBase` es **la pista base** del show — la vibe que corre por defecto.
- Los `VibeClip` en tracks son **cambios de vibe** puntuales (overrides temporales).
- Si no hay VibeClip activo en el timeline, el motor usa `vibeBase`.
- Si hay VibeClip activo, el motor hace crossfade al VibeClip.
- Al terminar el VibeClip, el motor vuelve a `vibeBase`.
- `overrideMode: 'whisper'` significa que Chronos sugiere la vibe, pero Selene puede refinar detalles (intensidad, color, movimiento).
- `overrideMode: 'full'` significa que Chronos dicta la vibe completa.

### Flujo en TimelineEngine

```
tick(timeMs):
  1. ¿Hay VibeClip activo en timeMs?
     SÍ → setVibe(vibeClip.vibeType) con envelope fadeIn/fadeOut
     NO → setVibe(vibeBase.vibeType) con intensity de vibeBase
  2. Procesar FXClips → HephaestusRuntime
  3. El L0 (LiquidEngine + SeleneColor + VMM) corre por debajo
     con la vibe activa como contexto base
```

### Ventaja competitiva

- En un timeline tradicional (Ableton, Resolume), el usuario tiene que programar TODO.
- En LuxSync con `vibeBase`, el usuario selecciona una vibe → el 90% del trabajo está hecho.
- Los FXClips y VibeClips son **overrides** sobre la base, no la base misma.
- El pre-análisis en frío permite que el motor sugiera automáticamente dónde poner overrides.

---

## 8. Pre-análisis en Frío (GodEar FFT)

### Concepto

> Antes de programar el show, el usuario carga el audio.  
> GodEar FFT analiza en frío (offline) y produce `AnalysisData`.  
> Ese análisis se **embebe en el .lux V3** para que no se recalcule.

### Datos pre-computados

| Dato | Uso | Generador |
|---|---|---|
| `waveform` | Visualización del timeline | GodEar Offline |
| `energyHeatmap` | Detección de energía por sección | GodEar Offline |
| `beatGrid` | Snap a beats, sincronización | GodEar Offline |
| `sections` | Detección de intro/verse/chorus/drop/etc | GodEar Offline |
| `transients` | Snap a hits (kick, snare, clap) | GodEar Offline |

### Embebido en .lux V3

```json
{
  "analysis": {
    "durationMs": 240000,
    "waveform": { "samplesPerSecond": 150, "peaks": [...], "rms": [...] },
    "energyHeatmap": { ... },
    "beatGrid": { "bpm": 128, "beats": [0, 469, 938, ...] },
    "sections": [
      { "startMs": 0, "endMs": 32000, "type": "intro", "confidence": 0.9 },
      { "startMs": 32000, "endMs": 64000, "type": "verse", "confidence": 0.85 },
      { "startMs": 64000, "endMs": 96000, "type": "chorus", "confidence": 0.92 }
    ],
    "transients": [0, 469, 938, 1407, ...]
  }
}
```

### Tamaño estimado

- Waveform @ 150 sps, 4 min: ~36K samples × 2 arrays (peaks + rms) × 8 bytes ≈ 576KB
- BeatGrid @ 128 BPM, 4 min: ~512 beats × 8 bytes ≈ 4KB
- Sections: ~10 sections × 100 bytes ≈ 1KB
- Transients: ~2000 transients × 8 bytes ≈ 16KB
- **Total análisis: ~600KB** — aceptable para embeber en JSON

### Ventajas

1. **Carga instantánea** — no hay re-análisis al abrir el proyecto.
2. **Portabilidad** — el análisis viaja con el `.lux`, no depende de la máquina.
3. **Modo híbrido** — el motor puede usar el análisis para sugerir automáticamente dónde poner VibeClips (cambios de sección) y FXClips (transients).

---


