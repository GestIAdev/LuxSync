# WAVE 7030: PERSISTENCE AUDIT — State & Persistence Deep Scan

> **Fecha:** 2026-06-27  
> **Alcance:** Creación, carga y guardado de clips `.lfx` en Hephaestus V3  
> **Síntoma físico:** Cada archivo (ej. `void_mist.lfx`) se lee 4 veces consecutivas al iniciar el módulo.

---

## 1. EL ATAQUE DDOS INTERNO (El Bucle de Carga ×4)

### Diagnóstico: 4 llamadas IPC `heph:load` por archivo al montar HephaestusView

El flujo de carga de la librería está **duplicado** en dos componentes que se montan simultáneamente. Cada uno ejecuta su propio `loadLibrary()` en un `useEffect(..., [])` de montaje, y cada `loadLibrary()` hace dos cosas: (a) `heph:list` para obtener metadata, y (b) un loop `heph:load` por cada clip para precachear.

#### Vector 1 — `index.tsx` (HephaestusView Shell)

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\HephaestusView\index.tsx:156-197
const loadLibrary = useCallback(async () => {
  // ...
  const result = await window.luxsync.hephaestus.list()
  // ...
  for (const item of loadedClips) {
    if (!clipCacheRef.current.has(item.filePath)) {
      const loadResult = await window.luxsync.hephaestus.load(item.filePath)
      clipCacheRef.current.set(item.filePath, loadResult.clip)
    }
  }
}, [])

useEffect(() => {
  loadLibrary()
}, [])
```

- **Línea 156:** `loadLibrary` definida con `useCallback(..., [])` — dependencias vacías, nunca se recrea.
- **Línea 195-197:** `useEffect(() => { loadLibrary() }, [])` — se ejecuta **una vez** al montar `HephaestusView`.
- **Línea 174:** Por cada clip en la librería, llama `window.luxsync.hephaestus.load(item.filePath)` → IPC `heph:load`.
- **Impacto:** N llamadas `heph:load` (una por clip).

#### Vector 2 — `ForgeTab.tsx` (Tier 3 Sculpt Tab)

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\HephaestusView\tabs\ForgeTab.tsx:234-271
const loadLibrary = useCallback(async () => {
  // ... idéntico al de index.tsx ...
  const result = await window.luxsync.hephaestus.list()
  // ...
  for (const item of loadedClips) {
    if (!clipCacheRef.current.has(item.filePath)) {
      const loadResult = await window.luxsync.hephaestus.load(item.filePath)
      clipCacheRef.current.set(item.filePath, loadResult.clip)
    }
  }
}, [])
```

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\HephaestusView\tabs\ForgeTab.tsx:208-211
// Load library on mount
useEffect(() => {
  loadLibrary()
}, [])
```

- **Línea 234:** `loadLibrary` definida con `useCallback(..., [])` — **copia idéntica** del de `index.tsx`.
- **Línea 209-211:** `useEffect(() => { loadLibrary() }, [])` — se ejecuta **una vez** al montar `ForgeTab`.
- **Impacto:** Otras N llamadas `heph:load` (una por clip).

#### Vector 3 — `handleSave` dispara `loadLibrary` de nuevo

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\HephaestusView\index.tsx:215
await loadLibrary()
```

Cada vez que el usuario guarda (Save o Save As), `handleSave` llama `await loadLibrary()` para refrescar la lista. Esto re-ejecuta el loop `heph:load` por cada clip — aunque `clipCacheRef.current.has(item.filePath)` debería saltar los ya cacheados, **el cache de ForgeTab es independiente** (tiene su propio `clipCacheRef`), por lo que el cache hit de uno no protege al otro.

#### Vector 4 — `handleCreateClip` también dispara `loadLibrary`

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\HephaestusView\index.tsx:369
await loadLibrary()
```

Al crear un clip nuevo desde el modal, se llama `loadLibrary()` para refrescar. Mismo problema.

### Cálculo del DDoS

| Evento | `heph:list` | `heph:load` por clip | Total para 10 clips |
|---|---|---|---|
| Montaje `index.tsx` | 1 | 10 | 10 |
| Montaje `ForgeTab` | 1 | 10 | 10 |
| **Subtotal boot** | **2** | **20** | **20** (2× por clip) |

Si el usuario guarda o crea un clip poco después del montaje:
| Save | 1 | 10 | 10 |
| Create | 1 | 10 | 10 |
| **Total acumulado** | **4** | **40** | **40** (4× por clip) |

**Esto coincide exactamente con el síntoma: "cada archivo se lee 4 veces".**

### Causa raíz

1. **Código duplicado:** `loadLibrary` está copy-pasteada en `index.tsx:156-193` y `ForgeTab.tsx:234-271`. Ambas hacen exactamente lo mismo: `heph:list` + loop `heph:load`.
2. **Caches aislados:** Cada componente tiene su propio `clipCacheRef = useRef<Map>()`. El cache de uno no protege al otro.
3. **`useEffect(..., [])` sin coordinación:** Ambos se disparan en paralelo al montar. No hay deduplicación ni debounce.
4. **`loadLibrary` en callback de Save/Create:** Re-escanea todo tras cada operación de escritura, sumando 2 pasadas más.

### Fix propuesto (no implementado en esta auditoría)

- Extraer `loadLibrary` a un hook compartido (`useHephLibrary`) con un solo `clipCacheRef` y un solo `useEffect` de montaje.
- O alternativamente, mover la carga al store Zustand (`useHephaestusEditorStore`) con un flag `libraryLoaded` que prevenga re-cargas.
- `handleSave`/`handleCreateClip` deberían llamar solo `heph:list` (metadata refresh), no re-precachear todos los clips.

---

## 2. ANATOMÍA DEL `NewClipModal` (La Brecha V2 vs V3)

### Qué hace el modal actual

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\HephaestusView\NewClipModal.tsx:188-222
const handleCreate = useCallback(() => {
  // ...
  const tracks: HephTrack[] = defaultParams.map(paramId => ({
    id: `track-${paramId}-${id}`,
    paramId,
    zones: (zones.length > 0 ? zones : ['all']) as readonly ZoneTarget[],
    curve: createDefaultCurve(paramId, durationMs),
  }))

  const newClip: HephAutomationClip = {
    id,
    name: name.trim(),
    author: 'LuxSync User',
    category,
    tags: [],
    vibeCompat: [],
    spatialZones: (zones.length > 0 ? zones : ['all']) as readonly ZoneTarget[],
    mixBus,
    priority: 50,
    durationMs,
    effectType: 'heph_custom',
    tracks,
    staticParams: {},
    schemaVersion: '3.0',
  }

  onCreate(newClip)
  onClose()
}, [name, durationMs, category, mixBus, zones, isValid, onCreate, onClose])
```

### Campos V3 que NO inicializa

| Campo V3 | Estado en el modal | Impacto |
|---|---|---|
| `cognitiveDNA` | **Ausente** (opcional en interfaz, pero el DnaRail lo espera) | `DnaRail` recibe `undefined` y debe fallbackar a `DEFAULT_COGNITIVE_DNA`. El editor DNA no puede funcionar hasta que el usuario "habilite" DNA manualmente. |
| `simulationMeta` | **Ausente** | `DnaRail` recibe `undefined` y fallbacka a `DEFAULT_SIMULATION_META`. Sin métricas de simulación. |
| `track.phaseConfig` | **Ausente** en cada track creado | `PhaseControls` en LabTab recibe `null` (vía `activePhaseConfig = track?.phaseConfig ?? null`). El `QuantumSpectrometer.drawSpectrumField` recibe `null` → early return (no dibuja spectrum). Funcionalmente seguro pero el espectro no se renderiza hasta que el usuario toca un control de fase. |
| `track.dimmerScale` | **Ausente** | Default implícito `1` en `buildTrack()` del store, pero no se persiste en el clip creado. |
| `track.blendMode` | **Ausente** | Default implícito `'max'` en `buildTrack()`, pero no se persiste. |
| `track.colorOverride` | **Ausente** | Correcto — solo relevante si `paramId === 'color'`. |

### La función `createDefaultCurve`

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\HephaestusView\NewClipModal.tsx:75-96
function createDefaultCurve(paramId: HephParamId, durationMs: number): HephCurve {
  const isColor = paramId === 'color'
  return {
    paramId,
    valueType: isColor ? 'color' : 'number',
    range: [0, 1] as [number, number],
    defaultValue: isColor ? { h: 0, s: 100, l: 50 } : 0,
    keyframes: [
      { timeMs: 0, value: isColor ? { h: 0, s: 100, l: 50 } : 0, interpolation: 'linear' as const },
      { timeMs: durationMs, value: isColor ? { h: 360, s: 100, l: 50 } : 1, interpolation: 'hold' as const },
    ],
    mode: 'absolute',
  }
}
```

**Observación:** El `range` para color es `[0, 1]` pero debería ser `[0, 360]` según `_normalizeClipCurves` en `HephaestusClipIndex.ts:62` que espera `c.valueType === 'color' ? [0, 360] : [0, 1]`. El normalizador lo corrige en carga, pero el clip en memoria del store tiene `range: [0, 1]` hasta que se guarda y recarga. Esto puede causar bugs visuales en el `CurveEditor` si depende de `curve.range` para color.

### Tipo del callback: `HephAutomationClip` vs `HephAutomationClipV3`

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\HephaestusView\NewClipModal.tsx:133
onCreate: (clip: HephAutomationClip) => void
```

`HephAutomationClip` es un alias de `HephAutomationClipV3` (definido en `types.ts`), así que esto es correcto a nivel de tipos. Sin embargo, el objeto que se crea **omite campos opcionales** que el estándar V3 espera para un clip completo.

### Veredicto

El modal crea un clip **estructuralmente V3** (`schemaVersion: '3.0'`) pero **semánticamente V2**: le faltan `cognitiveDNA`, `simulationMeta`, y `phaseConfig` por track. El DnaRail y el QuantumSpectrometer tienen fallbacks defensivos, pero el usuario parte con un clip "incompleto" que debe ser enriquecido manualmente.

---

## 3. EL PIPELINE DE GUARDADO (`saveClip` / Serialization)

### Ruta completa: Botón Save → Disco

```
[User click Save]
  → index.tsx:handleSave() (línea 199)
    → serializeHephClip(clip) — extrae estado del store
    → window.luxsync.hephaestus.save(serialized) — IPC al main
      → HephIPCHandlers.ts:ipcMain.handle('heph:save') (línea 43)
        → hephFileIO.saveClip(clipData)
          → HephFileIO.ts:saveClip() (línea 158)
            → serializeHephClip(clip) — SEGUNDA serialización (redundante)
            → fs.writeFile(filePath, JSON.stringify(payload, null, 2))
            → HephaestusClipIndex.upsert(filePath, 'user') — re-lee de disco
    → await loadLibrary() — re-escanea TODO
    → CustomEvent('luxsync:heph-clip-saved') — notifica a Chronos
```

### El serializador: `serializeHephClip`

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\hephaestus\types.ts:552-608
export function serializeHephClip(clip: HephAutomationClipV3): HephAutomationClipV3 {
  const cleanTracks: HephTrack[] = clip.tracks.map(track => ({
    id: track.id,
    paramId: track.paramId,
    zones: [...track.zones],
    curve: {
      paramId: track.curve.paramId,
      valueType: track.curve.valueType,
      range: Array.isArray(track.curve.range) && track.curve.range.length === 2
        ? [...track.curve.range] as [number, number]
        : (track.curve.valueType === 'color' ? [0, 360] : [0, 1]) as [number, number],
      defaultValue: typeof track.curve.defaultValue === 'object' && track.curve.defaultValue !== null
        ? { ...(track.curve.defaultValue as HSL) }
        : track.curve.defaultValue,
      keyframes: track.curve.keyframes.map(kf => ({
        timeMs: kf.timeMs,
        value: typeof kf.value === 'object' && kf.value !== null
          ? { ...(kf.value as HSL) }
          : kf.value,
        interpolation: kf.interpolation,
        bezierHandles: kf.bezierHandles ? [...kf.bezierHandles] as [number, number, number, number] : undefined,
        audioBinding: kf.audioBinding ? {
          source: kf.audioBinding.source,
          inputRange: [...kf.audioBinding.inputRange] as [number, number],
          outputRange: [...kf.audioBinding.outputRange] as [number, number],
          smoothing: kf.audioBinding.smoothing,
        } : undefined,
      })),
      mode: track.curve.mode ?? 'absolute',
    },
    dimmerScale: track.dimmerScale,
    colorOverride: track.colorOverride ? { ...track.colorOverride } : undefined,
    blendMode: track.blendMode,
    cell: track.cell,
    selector: track.selector ? JSON.parse(JSON.stringify(track.selector)) : undefined,
    phaseConfig: track.phaseConfig ? { ...track.phaseConfig } : undefined,
  }));

  return {
    id: clip.id,
    name: clip.name,
    author: clip.author,
    category: clip.category,
    tags: Array.isArray(clip.tags) ? [...clip.tags] : [],
    vibeCompat: Array.isArray(clip.vibeCompat) ? [...clip.vibeCompat] : [],
    spatialZones: Array.isArray(clip.spatialZones) ? [...clip.spatialZones] : [],
    mixBus: clip.mixBus,
    priority: clip.priority,
    durationMs: clip.durationMs,
    effectType: clip.effectType,
    tracks: cleanTracks,
    staticParams: clip.staticParams ? JSON.parse(JSON.stringify(clip.staticParams)) : {},
    cognitiveDNA: clip.cognitiveDNA ? JSON.parse(JSON.stringify(clip.cognitiveDNA)) : undefined,
    simulationMeta: clip.simulationMeta ? JSON.parse(JSON.stringify(clip.simulationMeta)) : undefined,
    schemaVersion: '3.0',
  };
}
```

### Análisis de cobertura de campos

| Campo del store | ¿Serializado? | Notas |
|---|---|---|
| `id`, `name`, `author`, `category` | ✅ | Directos |
| `tags`, `vibeCompat` | ✅ | Con fallback a `[]` |
| `spatialZones` | ✅ | Con fallback a `[]` |
| `mixBus`, `priority`, `durationMs`, `effectType` | ✅ | Directos |
| `tracks[].curve.keyframes[].bezierHandles` | ✅ | Con fallback a `undefined` |
| `tracks[].curve.keyframes[].audioBinding` | ✅ | Deep clone |
| `tracks[].dimmerScale` | ✅ | Passthrough |
| `tracks[].colorOverride` | ✅ | Shallow clone |
| `tracks[].blendMode` | ✅ | Passthrough |
| `tracks[].cell` | ✅ | Passthrough (reservado v3.0) |
| `tracks[].selector` | ✅ | Deep clone vía `JSON.parse(JSON.stringify())` |
| `tracks[].phaseConfig` | ✅ | Shallow clone `{ ...track.phaseConfig }` |
| `cognitiveDNA` | ✅ | Deep clone |
| `simulationMeta` | ✅ | Deep clone |
| `staticParams` | ✅ | Deep clone |

### Riesgos detectados

1. **Doble serialización:** `handleSave` en `index.tsx:208` llama `serializeHephClip(clip)` antes de enviar por IPC. Luego `HephFileIO.saveClip` en línea 164 vuelve a llamar `serializeHephClip(clip)` sobre el dato ya serializado. Es redundante pero no destructivo (la segunda pasada es idempotente sobre un objeto ya limpio).

2. **`phaseConfig` shallow clone:** `{ ...track.phaseConfig }` hace una copia superficial. `PhaseConfigPro` contiene solo primitivos (números, strings, `1 | -1`), por lo que es seguro en la práctica. Pero si en el futuro se añade un campo anidado, se romperá silenciosamente.

3. **`checksum` vacío en save:** `HephFileIO.saveClip` escribe `checksum: ''` (línea 165). El `LfxFileLoader._validateChecksum` puede rechazar archivos con checksum vacío dependiendo de la política. Actualmente el loader V3 no valida checksum (solo el path V2 lo hace), pero es un campo semánticamente incorrecto.

4. **No hay pérdida de datos:** El serializador cubre todos los campos de `HephAutomationClipV3`. Los campos efímeros del store (`selection`, `viewport`, `_undoStack`, `_redoStack`, `_dragSnapshot`, `isDirty`) se excluyen correctamente.

---

## 4. EL PIPELINE DE CARGA (`loadClip` / Deserialization)

### Ruta completa: Disco → Store

```
[User click clip in library]
  → index.tsx:handleLoad(clipId) (línea 271)
    → window.luxsync.hephaestus.load(clipId) — IPC al main
      → HephIPCHandlers.ts:ipcMain.handle('heph:load') (línea 72)
        → hephFileIO.loadClip(idOrPath)
          → HephFileIO.ts:loadClip() (línea 192)
            → HephaestusClipIndex.getById(idOrPath) — O(1) lookup en RAM
            → return loaded.clip as HephAutomationClipV3
        → serializeHephClip(clip) — serializa para IPC transport
        → return { success: true, clip: serialized }
    → temporalActions.resetWithClip(v3Clip)
      → useHephaestusEditorStore.loadClip(clip) (línea 236)
        → set(state => { state.clip = clip; state.isDirty = false; ... })
```

### Ingesta en el `HephaestusClipIndex`

El `HephaestusClipIndex.upsert()` (línea 140) es el punto de entrada real de disco → RAM:

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\hephaestus\HephaestusClipIndex.ts:140-222
public async upsert(filePath: string, source: 'builtin' | 'user'): Promise<LoadedClip | null> {
  const raw = await fs.readFile(filePath, 'utf-8')
  const parsed = JSON.parse(raw) as Record<string, unknown>
  const schema = parsed?.$schema as string | undefined

  if (schema === 'luxsync.lfx/3.0' && parsed?.clip && typeof parsed.clip === 'object') {
    const v3 = parsed.clip as HephAutomationClipV3
    // Validación: tracks[], curve.keyframes, zones
    clip = v3
  } else {
    // Rechazo: solo V3 aceptado
    return null
  }

  _normalizeClipCurves(clip) // asegura range, mode, tags, vibeCompat, spatialZones, staticParams
  // ... build LoadedClip, insert in maps
}
```

### Normalización en carga: `_normalizeClipCurves`

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\hephaestus\HephaestusClipIndex.ts:51-68
function _normalizeClipCurves(clip: HephAutomationClipV3): void {
  if (!Array.isArray(clip.tags)) clip.tags = []
  if (!Array.isArray(clip.vibeCompat)) clip.vibeCompat = []
  if (!Array.isArray(clip.spatialZones)) clip.spatialZones = []
  if (!clip.staticParams) clip.staticParams = {}

  for (const track of clip.tracks) {
    const c = track.curve
    if (!c) continue
    if (!Array.isArray(c.range) || c.range.length !== 2) {
      c.range = c.valueType === 'color' ? [0, 360] : [0, 1]
    }
    if (!c.mode) {
      c.mode = 'absolute'
    }
  }
}
```

### Manejo de archivos V2 antiguos

**No hay migración V2 → V3 en el `HephaestusClipIndex`.** El `upsert()` rechaza cualquier archivo que no tenga `$schema === 'luxsync.lfx/3.0'`:

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\hephaestus\HephaestusClipIndex.ts:176-179
} else {
  console.error(`[HephClipIndex] ❌ Invalid clip structure in ${filePath}: expected V3 schema 'luxsync.lfx/3.0' with tracks[]`)
  return null
}
```

El `LfxFileLoader` tiene un path V2 (`_parseV2`) que registra el clip en el `DynamicEffectRegistry`, pero **no lo inserta en el `HephaestusClipIndex`** — el loader V2 usa su propio path de registro. Esto significa que los archivos V2 son visibles para Selene/Chronos pero **no para el editor de Hephaestus**.

### ¿Qué pasa si un clip V2 llega al store?

Si un archivo V2 (sin `phaseConfig`, sin `cognitiveDNA`, sin `simulationMeta`) se carga de alguna manera:

| Campo | Comportamiento | ¿Crash? |
|---|---|---|
| `track.phaseConfig` | `undefined` → `LabTab.activePhaseConfig = track?.phaseConfig ?? null` → `PhaseControls` recibe `null` → renderiza con defaults internos | No crash |
| `QuantumSpectrometer.phaseConfig` | `null` → `drawSpectrumField` hace early return | No crash, no dibuja spectrum |
| `cognitiveDNA` | `undefined` → `DnaRail` fallbacka a `DEFAULT_COGNITIVE_DNA` | No crash |
| `simulationMeta` | `undefined` → `DnaRail` fallbacka a `DEFAULT_SIMULATION_META` | No crash |
| `track.curve.range` | Posiblemente ausente → `_normalizeClipCurves` lo corrige a `[0, 1]` o `[0, 360]` | No crash (corregido en carga) |
| `track.curve.mode` | Ausente → `_normalizeClipCurves` lo setea a `'absolute'` | No crash |

**Conclusión:** El store es defensivo. Un V2 no crashearía, pero llegar al store es imposible por el gate del `HephaestusClipIndex` que rechaza V2.

### `loadClip` en el store: sin normalización adicional

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\hephaestus\store\useHephaestusEditorStore.ts:236-247
loadClip: (clip) => {
  const firstTrackId = clip?.tracks?.[0]?.id ?? null
  set((state) => {
    state.clip = clip as any
    state.isDirty = false
    state.selection.activeTrackId = firstTrackId
    state.selection.selectedKeyframeIndices = new Set()
    state._undoStack = []
    state._redoStack = []
    state._dragSnapshot = null
  })
},
```

El store **no aplica defaults** ni normalización al recibir el clip. Confía en que el `HephaestusClipIndex` ya hizo el trabajo. Esto es correcto para el flujo normal (load → index → store), pero si se inyecta un clip por otro path (ej. `NewClipModal` → `handleCreateClip` → `resetWithClip`), el clip no pasa por `_normalizeClipCurves`.

### Riesgo: `NewClipModal` bypassea el normalizador

El clip creado por `NewClipModal` se inyecta directamente al store vía `temporalActions.resetWithClip(newClip)` en `index.tsx:355`. No pasa por `HephaestusClipIndex.upsert()`. Esto significa:

- `curve.range` puede ser `[0, 1]` para color (incorrecto, debería ser `[0, 360]`).
- `track.dimmerScale` y `track.blendMode` no se setean (el store los defaulta en `buildTrack`, pero `NewClipModal` construye el track manualmente sin usar `buildTrack`).

---

## RESUMEN DE HALLAZGOS CRÍTICOS

| # | Severidad | Hallazgo | Archivo | Líneas |
|---|---|---|---|---|
| C1 | 🔴 Alta | `loadLibrary` duplicada en `index.tsx` y `ForgeTab.tsx` — 2× cargas al boot | `index.tsx` / `ForgeTab.tsx` | 156-197 / 234-271 |
| C2 | 🔴 Alta | `handleSave` y `handleCreateClip` re-disparan `loadLibrary` — 2× más | `index.tsx` | 215, 369 |
| C3 | 🟡 Media | `NewClipModal` no inyecta `cognitiveDNA`, `simulationMeta`, ni `phaseConfig` | `NewClipModal.tsx` | 203-218 |
| C4 | 🟡 Media | `NewClipModal` crea `range: [0, 1]` para color (debería ser `[0, 360]`) | `NewClipModal.tsx` | 80 |
| C5 | 🟡 Media | `NewClipModal` bypassea `_normalizeClipCurves` — clip no normalizado en store | `NewClipModal.tsx` → `index.tsx` | 220 → 355 |
| C6 | 🟢 Baja | Doble serialización en save path (`serializeHephClip` llamado 2×) | `index.tsx:208` + `HephFileIO.ts:164` | — |
| C7 | 🟢 Baja | `checksum: ''` escrito en disco — semánticamente incorrecto | `HephFileIO.ts` | 165 |
| C8 | 🟢 Baja | `HephaestusClipIndex` rechaza V2 — sin migración V2→V3 para el editor | `HephaestusClipIndex.ts` | 176-179 |
| C9 | 🟢 Baja | `phaseConfig` shallow clone en serializador (seguro hoy, frágil mañana) | `types.ts` | 587 |

---

## ARQUITECTURA PROPUESTA (Post-Auditoría)

```
┌─────────────────────────────────────────────────────────┐
│ useHephLibrary (hook único)                              │
│  ├── loadLibrary() — llamada UNA vez al montar           │
│  ├── clipCacheRef compartido (un solo Map)               │
│  ├── refreshMetadata() — solo heph:list, sin heph:load   │
│  └── invalidate(clipId) — remueve 1 entrada del cache    │
└─────────────────────────────────────────────────────────┘
          │
          ├── HephaestusView (shell) — consume hook
          ├── ForgeTab — consume hook (no tiene loadLibrary propia)
          └── LabTab — no necesita librería

┌─────────────────────────────────────────────────────────┐
│ NewClipModal V3 (propuesto)                              │
│  ├── Inyecta cognitiveDNA = DEFAULT_COGNITIVE_DNA        │
│  ├── Inyecta simulationMeta = DEFAULT_SIMULATION_META    │
│  ├── Inyecta track.phaseConfig = DEFAULT_PHASE_CONFIG_PRO│
│  ├── Usa range [0, 360] para color                       │
│  └── Pasa por _normalizeClipCurves antes del store       │
└─────────────────────────────────────────────────────────┘
```
