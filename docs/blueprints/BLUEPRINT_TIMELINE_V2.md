# BLUEPRINT: TIMELINE V2 — THE INFINITE MULTI-TRACK ARCHITECTURE

> **WAVE 2546** — Diseño técnico para el pivote de pistas infinitas y explícitas  
> Autor: PunkOpus · Fecha: 2026-04-10  
> Status: **DRAFT — Pendiente de implementación**

---

## 0. MOTIVACIÓN

La arquitectura actual de Chronos genera tracks FX **derivadas** del patch.
`getActiveZonesFromFixtures()` inspecciona las fixtures cargadas, extrae las
zonas activas y `generateZoneTracks()` crea una UI-track por zona.

Esto tiene tres problemas terminales:

1. **Acoplamiento patch → timeline**: Si no hay fixture en `air`, no existe
   track de `air`. El usuario no puede pre-programar zonas vacías sin el hack
   de `customZoneTracks`.
2. **Unicidad de zona**: Solo UNA track por `targetZone`. Imposible separar
   parámetros (Color ML en track 1, Movimiento ML en track 2) dentro de la
   misma zona.
3. **Doble modelo de datos**: El store (`ChronosProject.tracks[]` con
   `TimelineTrack`) y la UI (`Track` de TimelineCanvas.tsx) son tipos
   distintos. La UI regenera tracks en cada render; el store persiste otro
   formato. Reconciliar ambos es frágil.

**Timeline V2** elimina la generación derivada. El timeline es un array
plano de tracks explícitas, creadas por el usuario, persistidas tal cual.

---

## 1. MODELO DE DATOS: `TimelineTrackV2`

### 1.1. Interfaz del Store

```typescript
/**
 * WAVE 2546: Track explícita e independiente.
 * El usuario la crea, la nombra, la rutea. El motor la ejecuta.
 * NO se genera automáticamente desde fixtures.
 */
interface TimelineTrackV2 {
  /** UUID v4 — generado al crear la track */
  readonly id: string

  /** Zona canónica de ruteo DMX.
   *  Determina qué fixtures reciben los efectos de esta track.
   *  Múltiples tracks pueden apuntar a la MISMA zona.
   *  El MasterArbiter aplica HTP/LTP entre ellas.
   *  Valor especial 'global' → todas las fixtures (wildcard). */
  readonly targetZone: CanonicalZone | 'global'

  /** Etiqueta personalizable (UI-only, no afecta ruteo).
   *  Default: ZONE_LABELS[targetZone] + " (#n)" si repetida.
   *  El usuario puede renombrar libremente. */
  visualLabel: string

  /** Color de la track en la UI.
   *  Default: ZONE_COLORS[targetZone]. Editable. */
  color: string

  /** Clips en esta track — propiedad exclusiva.
   *  Un clip pertenece a exactamente una track. */
  clips: TimelineClip[]

  /** Automation lanes locales a esta track */
  automation: AutomationLane[]

  /** ¿Track habilitada? (false = mute) */
  enabled: boolean

  /** ¿Track en solo? */
  solo: boolean

  /** ¿Track bloqueada? (no editable en UI) */
  locked: boolean

  /** Orden visual en la UI (0 = arriba).
   *  Determinista — no afecta prioridad DMX. */
  order: number

  /** Altura en pixels para la UI. Default: 36 */
  height: number
}
```

### 1.2. Diferencias vs `TimelineTrack` actual (types.ts)

| Campo actual      | Campo V2          | Cambio                                    |
|--------------------|--------------------|--------------------------------------------|
| `name: string`     | `visualLabel`      | Renombrado para separar de routing         |
| `type: TrackType`  | *eliminado*        | Solo existen tracks FX; vibe/audio son structural |
| `targetZone?: string` | `targetZone: CanonicalZone \| 'global'` | Obligatorio, tipado estricto |
| —                  | —                  | `readonly` en `id` y `targetZone`          |

### 1.3. Tracks Estructurales (no editables por el usuario)

Las tracks de **ruler**, **waveform** (audio) y **vibe** no son
`TimelineTrackV2`. Son decoraciones de la UI renderizadas por
`TimelineCanvas` fuera del array de tracks del store.

```typescript
/** 
 * WAVE 2546: Tracks hardcoded de la UI.
 * No participan del multi-track store ni del playback engine.
 */
const STRUCTURAL_TRACKS: StructuralTrack[] = [
  { id: 'ruler',    type: 'ruler',    label: 'TIME',  height: 32, color: '#3b82f6' },
  { id: 'waveform', type: 'waveform', label: 'AUDIO', height: 64, color: '#22d3ee' },
  { id: 'vibe',     type: 'vibe',     label: 'VIBE',  height: 32, color: '#a855f7' },
]
```

Estas tracks se renderizan **antes** del `.map()` de `TimelineTrackV2[]`.
No se mezclan en el mismo array.

---

## 2. ESTADO DEL STORE: `ChronosProjectV2`

### 2.1. Forma del estado

```typescript
interface ChronosProjectV2 {
  readonly version: '2.0.0'
  readonly id: string
  meta: ChronosProjectMeta          // sin cambios
  playback: PlaybackConfig          // sin cambios
  analysis: AnalysisData | null     // sin cambios

  /**
   * WAVE 2546: Array plano de tracks del usuario.
   * Orden visual definido por `track.order`.
   * Crear = push. Eliminar = filter. Reordenar = reasignar `order`.
   * NO derivado de fixtures. NO filtrado por patch.
   */
  tracks: TimelineTrackV2[]

  /** Clips de Vibe (globales, no asociados a FX tracks) */
  vibeClips: VibeClip[]

  globalAutomation: AutomationLane[]
  markers: ChronosMarker[]
}
```

### 2.2. Acciones del Store

```typescript
interface ChronosStoreActions {
  // ─── Track CRUD ───────────────────────────────────────────────
  
  /** Crear nueva track. Genera UUID, asigna zone, label default, 
   *  order = último. Acepta la misma zona infinitas veces. */
  addTrack(targetZone: CanonicalZone | 'global'): TimelineTrackV2

  /** Eliminar track por id. Elimina todos sus clips. */
  removeTrack(trackId: string): void

  /** Reordenar track (mover arriba/abajo en la UI) */
  reorderTrack(trackId: string, newOrder: number): void

  /** Renombrar label visual */
  renameTrack(trackId: string, newLabel: string): void

  /** Toggle mute/solo/lock */
  setTrackEnabled(trackId: string, enabled: boolean): void
  setTrackSolo(trackId: string, solo: boolean): void
  setTrackLocked(trackId: string, locked: boolean): void

  // ─── Clip CRUD ────────────────────────────────────────────────

  /** Añadir clip a una track (validación: startMs no overlap) */
  addClip(trackId: string, clip: Omit<TimelineClip, 'id' | 'trackId'>): TimelineClip

  /** Mover clip a otra track (cambio de trackId) */
  moveClipToTrack(clipId: string, targetTrackId: string): void

  /** Eliminar clip */
  removeClip(clipId: string): void
}
```

### 2.3. Generación del Label Default

```typescript
function generateTrackLabel(
  targetZone: CanonicalZone | 'global',
  existingTracks: TimelineTrackV2[]
): string {
  const baseLabel = targetZone === 'global'
    ? 'GLOBAL'
    : ZONE_LABELS[targetZone].replace(/^.+?\s/, '')  // strip emoji

  // Contar cuántas tracks ya apuntan a esta zona
  const count = existingTracks.filter(t => t.targetZone === targetZone).length

  // Primera track: "FRONT (Main)". Segunda: "FRONT (Main) #2". Etc.
  return count === 0 ? baseLabel : `${baseLabel} #${count + 1}`
}
```

---

## 3. CATÁLOGO DE ZONAS (MENÚ [+ ADD ZONE TRACK])

### 3.1. Catálogo Estático

El dropdown no depende del patch. Es un catálogo fijo de todas las zonas
posibles del sistema, agrupado en categorías.

```typescript
/**
 * WAVE 2546: Catálogo completo para el dropdown [+ ADD ZONE TRACK].
 * Ningún filtro por fixtures. El usuario elige libremente.
 * La misma zona se puede añadir infinitas veces.
 */
const ZONE_CATALOG: Array<{ label: string; zones: Array<CanonicalZone | 'global'> }> = [
  {
    label: 'GLOBAL',
    zones: ['global'],
  },
  {
    label: 'CORE ZONES',
    zones: ['front', 'back', 'floor', 'center', 'air', 'ambient'],
  },
  {
    label: 'MOVERS',
    zones: ['movers-left', 'movers-right'],
  },
]
```

### 3.2. Reglas del Menú

1. **Sin filtros**: Todas las zonas siempre visibles. No se ocultan zonas
   "ya añadidas". El usuario puede tener 5 tracks de `movers-left`.
2. **Sin límites**: No hay cap de tracks. El SVG crece y el scroll
   container maneja el overflow.
3. **Zona `global`**: Targeting wildcard (`*`). Los clips de esta track
   se aplican a ALL fixtures. Útil para blackouts, master intensity, etc.
4. **Zona `unassigned`**: Excluida del catálogo. No es un destino útil.

### 3.3. Flujo de Interacción

```
[User clicks "+ ADD ZONE TRACK"]
  → Dropdown Portal aparece (position:fixed, z-index:9999)
  → Grupos: GLOBAL / CORE ZONES / MOVERS
  → [User clicks "FRONT (Main)"]
    → store.addTrack('front')
      → Genera UUID, label "FRONT (Main) #2" (si ya existe una),
        color = ZONE_COLORS['front'], order = último
      → Nuevo TimelineTrackV2 insertado en store.tracks[]
    → TimelineCanvas re-render → nueva track visible, vacía, lista
    → Dropdown se cierra
```

---

## 4. MOTOR DE PLAYBACK: THE MERGER

### 4.1. Cambio Fundamental

**Antes** (V1): El engine procesa clips agrupados por zona.
`resolveFixtureIds()` recibe la zona del track, busca fixtures en esa zona,
aplica efectos.

**Después** (V2): El engine procesa **por track**, no por zona. Cada track
produce una salida independiente. Si 3 tracks apuntan a `movers-left`, el
engine genera 3 outputs para los mismos fixtures. El `MasterArbiter`
los fusiona con HTP/LTP.

### 4.2. Pipeline de Playback (por frame)

```
┌─────────────────────────────────────────────────────────────────┐
│  FRAME TICK (currentTimeMs)                                     │
│                                                                 │
│  1. for (track of project.tracks)                               │
│     │  if (!track.enabled) continue                             │
│     │  if (soloActive && !track.solo) continue                  │
│     │                                                           │
│     │  2. activeClips = track.clips.filter(c =>                 │
│     │       c.enabled && c.startMs <= time < c.startMs+c.dur)   │
│     │                                                           │
│     │  3. fixtureIds = ZoneMapper.resolveZone(                  │
│     │       track.targetZone, allFixtures)                      │
│     │                                                           │
│     │  4. for (clip of activeClips)                              │
│     │     │  output = clip.effect.update(deltaMs)               │
│     │     │  envelope = calculateEnvelope(clip, time)           │
│     │     │                                                     │
│     │     │  5. MasterArbiter.dispatch({                        │
│     │     │       fixtureIds,                                   │
│     │     │       channels: output.channels,                    │
│     │     │       values: output.values * envelope,             │
│     │     │       blendMode: clip.mixBus,     // HTP|LTP|ADD   │
│     │     │       source: 'chronos',                            │
│     │     │       priority: LAYER_EFFECTS,    // layer 3        │
│     │     │     })                                              │
│     │     └                                                     │
│     └                                                           │
│                                                                 │
│  6. MasterArbiter.resolve()                                     │
│     │  Per fixture, per channel:                                 │
│     │    dimmer → HTP (max de todos los inputs)                 │
│     │    color  → LTP (último input por timestamp)              │
│     │    pos    → LTP (último input por timestamp)              │
│     │                                                           │
│  7. HAL.transmit(resolvedFrame)                                 │
│     → DMX universe buffer → USB adapter → cables → fixtures    │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3. Comportamiento con Tracks Duplicadas

Caso: Track A (`movers-left`, clip=`sweep`, mixBus=`htp`) y
Track B (`movers-left`, clip=`color-wash`, mixBus=`ltp`).

| Canal   | Track A output | Track B output | Arbiter result    |
|---------|---------------|----------------|-------------------|
| Dimmer  | 180           | 120            | 180 (HTP: max)    |
| Red     | 255           | 0              | 0 (LTP: B es último) |
| Green   | 0             | 128            | 128 (LTP)         |
| Blue    | 0             | 255            | 255 (LTP)         |
| Pan     | 127           | —              | 127 (solo A)      |

Resultado: Los movers-left tienen el dimmer del sweep pero el color del
wash. **Apilamiento DMX determinista, no visual.**

### 4.4. Track `global`

Cuando `track.targetZone === 'global'`:

```typescript
// ZoneMapper.resolveZone('global', fixtures) retorna TODOS los fixture IDs.
// Equivalente a: fixtures.map(f => f.id)
```

El efecto se aplica a todo el rig. El Arbiter mezcla normalmente.

---

## 5. FLUJO DE RENDERIZADO REACT

### 5.1. Principio "Dumb Canvas"

`TimelineCanvas` no calcula qué zonas existen. No inspecciona fixtures.
No filtra tracks. Solo hace `.map()`.

```tsx
// WAVE 2546: TimelineCanvas — puro render, cero cálculos de zonas
const TimelineCanvas = memo(({ project }: { project: ChronosProjectV2 }) => {
  const tracks = project.tracks
    .filter(t => /* solo visibilidad UI, no lógica de negocio */)
    .sort((a, b) => a.order - b.order)

  return (
    <div ref={containerRef} className="timeline-outer-wrapper">
      <div className="timeline-canvas-container">
        <svg width={dimensions.width} height={totalHeight}>
          {/* Structural tracks (ruler, waveform, vibe) — hardcoded */}
          <RulerTrackRenderer ... />
          <WaveformTrackRenderer ... />
          <VibeTrackRenderer ... />

          {/* User tracks — puro .map(), sin filtros de zona */}
          {tracks.map((track, i) => (
            <FXTrackRenderer
              key={track.id}
              track={track}
              yOffset={calculateYOffset(i)}
              ...
            />
          ))}
        </svg>
      </div>

      {/* HUD flotante — siempre visible, sin condición de zona */}
      <ZoneTrackFooter onAddTrack={store.addTrack} />
    </div>
  )
})
```

### 5.2. Eliminación de Código Derivado

Se eliminan de `TimelineCanvas.tsx`:

| Función / Variable            | Razón de eliminación                    |
|--------------------------------|-----------------------------------------|
| `getActiveZonesFromFixtures()` | Ya no se derivan tracks de fixtures      |
| `generateZoneTracks()`         | Las tracks vienen del store directamente |
| `customZoneTracks` state       | Absorbido por `store.tracks`             |
| `allTracks` useMemo            | Innecesario — `store.tracks` ES la verdad |
| `hasFreeZones` condición       | El catálogo es infinito, siempre visible |

### 5.3. Track Heights (Elastic Distribution)

El algoritmo `elasticTracks` se mantiene pero simplificado:

```typescript
const elasticHeights = useMemo(() => {
  const structuralH = STRUCTURAL_TRACKS.reduce((s, t) => s + t.height, 0)
  const userTracksH = tracks.reduce((s, t) => s + t.height, 0)
  const totalFixed = structuralH + userTracksH
  const viewport = dimensions.height

  if (viewport <= totalFixed) return tracks // No surplus — use defaults

  // Distribute surplus: 50% audio, 50% shared equally among user tracks
  const surplus = viewport - totalFixed
  const perTrackBonus = (surplus * 0.5) / Math.max(tracks.length, 1)
  return tracks.map(t => ({ ...t, height: t.height + perTrackBonus }))
}, [dimensions.height, tracks])
```

---

## 6. PERSISTENCIA Y MIGRACIÓN

### 6.1. Formato `.lux` V2

```json
{
  "version": "2.0.0",
  "id": "uuid-del-proyecto",
  "meta": { "name": "My Show", "bpm": 128, ... },
  "playback": { ... },
  "tracks": [
    {
      "id": "uuid-track-1",
      "targetZone": "front",
      "visualLabel": "FRONT (Main)",
      "color": "#ef4444",
      "clips": [ ... ],
      "automation": [],
      "enabled": true,
      "solo": false,
      "locked": false,
      "order": 0,
      "height": 36
    },
    {
      "id": "uuid-track-2",
      "targetZone": "movers-left",
      "visualLabel": "Mover L - Color",
      "color": "#f59e0b",
      "clips": [ ... ],
      "order": 1,
      "height": 36
    },
    {
      "id": "uuid-track-3",
      "targetZone": "movers-left",
      "visualLabel": "Mover L - Movement",
      "color": "#f59e0b",
      "clips": [ ... ],
      "order": 2,
      "height": 36
    }
  ],
  "vibeClips": [ ... ],
  "markers": [ ... ]
}
```

### 6.2. Migración V1 → V2

```typescript
function migrateProjectV1toV2(v1: ChronosProject): ChronosProjectV2 {
  // Cada TimelineTrack V1 de tipo 'effect'|'zone' se convierte a TimelineTrackV2
  const migratedTracks: TimelineTrackV2[] = v1.tracks
    .filter(t => t.type === 'effect' || t.type === 'zone')
    .map((t, i) => ({
      id: t.id,
      targetZone: normalizeZoneToCanonical(t.targetZone) ?? 'global',
      visualLabel: t.name,
      color: t.color,
      clips: t.clips,
      automation: t.automation,
      enabled: t.enabled,
      solo: t.solo,
      locked: t.locked,
      order: i,
      height: t.height,
    }))

  // Extraer vibe clips de tracks V1 tipo 'vibe'
  const vibeClips = v1.tracks
    .filter(t => t.type === 'vibe')
    .flatMap(t => t.clips)

  return {
    version: '2.0.0',
    id: v1.id,
    meta: v1.meta,
    playback: v1.playback,
    analysis: v1.analysis,
    tracks: migratedTracks,
    vibeClips,
    globalAutomation: v1.globalAutomation,
    markers: v1.markers,
  }
}

function normalizeZoneToCanonical(zone?: string): CanonicalZone | null {
  if (!zone) return null
  if (zone === '*' || zone === 'all') return null  // → 'global' en el caller
  return isCanonicalZone(zone) ? zone : normalizeZone(zone)
}
```

---

## 7. DIAGRAMA DE DEPENDENCIAS

```
┌──────────────────────────────────────────────────────────────────┐
│                           UI LAYER                               │
│                                                                  │
│  TimelineCanvas ──────────────────── ZoneTrackFooter             │
│    │ .map(store.tracks)                │ store.addTrack(zone)    │
│    │ puro render                       │ catálogo estático       │
│    ▼                                   │ sin filtros             │
│  FXTrackRenderer                       │                         │
│    │ renderiza clips del track         │                         │
└────┼───────────────────────────────────┼─────────────────────────┘
     │                                   │
     │  store.tracks (single source)     │
     │                                   │
┌────┼───────────────────────────────────┼─────────────────────────┐
│    ▼              STORE LAYER          ▼                         │
│                                                                  │
│  ChronosStore                                                    │
│    tracks: TimelineTrackV2[]                                     │
│    vibeClips: VibeClip[]                                         │
│    addTrack() / removeTrack() / addClip() / moveClipToTrack()   │
│                                                                  │
└────┬─────────────────────────────────────────────────────────────┘
     │
     │  project.tracks (serialized snapshot)
     │
┌────┼─────────────────────────────────────────────────────────────┐
│    ▼             ENGINE LAYER                                    │
│                                                                  │
│  TimelineEngine                                                  │
│    for (track of tracks)                                         │
│      for (clip of track.clips)                                   │
│        fixtureIds = ZoneMapper.resolveZone(track.targetZone)     │
│        output = clip.effect.update(delta)                        │
│        MasterArbiter.dispatch(fixtureIds, output, mixBus)        │
│                               │                                  │
│                               ▼                                  │
│                        MasterArbiter                             │
│                          HTP: dimmer                             │
│                          LTP: color, position                    │
│                          5-layer priority                        │
│                               │                                  │
│                               ▼                                  │
│                            HAL                                   │
│                          DMX out                                 │
└──────────────────────────────────────────────────────────────────┘
```

---

## 8. INVARIANTES DEL SISTEMA

1. **Track = Source of Truth**: `store.tracks[]` es la única fuente de
   verdad para las tracks del timeline. La UI no genera, filtra ni
   transforma tracks.

2. **Zona ≠ Identidad**: Dos tracks con `targetZone: 'front'` son
   entidades distintas con IDs distintos. La zona es solo el destino
   de ruteo DMX.

3. **Clips = Propiedad Exclusiva**: Un clip pertenece a una y solo una
   track. `moveClipToTrack()` cambia el `trackId` pero no duplica.

4. **Catálogo Infinito**: El menú [+ ADD ZONE TRACK] muestra TODAS las
   zonas siempre. No depende del patch. No se ocultan zonas "ya añadidas".

5. **Merge en Arbiter, no en UI**: Si dos tracks apuntan a la misma
   zona, el Arbiter resuelve la colisión con HTP/LTP. La UI nunca
   intenta resolver conflictos.

6. **Structural Tracks = Decoración**: Ruler, Waveform y Vibe no son
   `TimelineTrackV2`. Son decoración de la UI con rendering hardcoded.

7. **Anti-Simulación**: El catálogo de zonas se define como constante
   compilada (`ZONE_CATALOG`), no se genera dinámicamente. Las zonas
   son las 8 canónicas + `global`. Determinista.

---

## 9. RIESGOS Y MITIGACIONES

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Muchas tracks → SVG enorme → lag de render | Performance UI | `memo()` por track + virtualización si > 30 tracks |
| Multiples tracks misma zona → fixture overload DMX | Flickering | Arbiter HTP/LTP ya resuelve; documentar al usuario |
| Migración V1 rompe shows existentes | Data loss | Migración automática en `loadProject()` + backup `.bak` |
| `global` track + zone tracks → doble efecto | Duplicación visual | Documentar que `global` apila con zone-específicas |
| Store crece con tracks vacías | Bloat | `removeTrack()` disponible; no crear límites artificiales |

---

## 10. WAVES DE IMPLEMENTACIÓN (SUGERIDAS)

| Wave | Nombre | Scope |
|------|--------|-------|
| 2547 | **Store V2** | `TimelineTrackV2` interface + `ChronosProjectV2` + `addTrack`/`removeTrack` actions |
| 2548 | **Canvas V2** | Eliminar `generateZoneTracks`, `customZoneTracks`, `allTracks`. Puro `.map(store.tracks)` |
| 2549 | **Catálogo Infinito** | `ZONE_CATALOG` constante + dropdown sin filtros + zona repetible |
| 2550 | **Engine V2** | Iteración por track (no por zona) + dispatch per-track al Arbiter |
| 2551 | **Migración** | `migrateV1toV2()` + detección de versión en `loadProject()` + backup |
| 2552 | **Track Management UI** | Rename, reorder (drag), mute/solo/lock, delete per-track |

---

*Fin del blueprint. Ningún código de implementación ha sido escrito.
Este documento es la especificación técnica para las waves 2547-2552.*
