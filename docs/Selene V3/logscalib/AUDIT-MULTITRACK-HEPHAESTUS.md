# AUDIT: Capacidad Multitrack del Editor Hephaestus V3

> **Fecha:** 2026-07-16  
> **Contexto:** El arquitecto pregunta si el editor UI actual permite añadir dos tracks del mismo `paramId` (ej: dos tracks `color` con zonas distintas). Este documento audita la cadena completa: Store → Serialización → I/O → UI.

---

## 1. Resumen Ejecutivo

| Capa | Soporta Multitrack | Estado |
|------|-------------------|--------|
| **Store** (`useHephaestusEditorStore.ts`) | ✅ Sí | Completo — CRUD per-track por `trackId` |
| **Serialización** (`serializeHephClip`) | ✅ Sí | Completo — deep-clone de todos los tracks |
| **File I/O** (`HephFileIO.ts`) | ✅ Sí | Completo — guarda/carga el clip tal cual |
| **Runtime** (`HephaestusRuntime.ts`) | ✅ Sí | Completo — ruteo per-track por zones |
| **UI Editor** (`ForgeTab.tsx` + `index.tsx`) | ❌ No | **ROTO** — asume 1 track por paramId (patrón V2.1) |

**Conclusión:** El motor y el store soportan multicelularidad total. El bottleneck está exclusivamente en la UI del editor, que hereda el patrón V2.1 de "un track por parámetro, zona global".

---

## 2. Análisis Detallado por Capa

### 2.1 Store — `useHephaestusEditorStore.ts`

El store **sí** soporta multitrack correctamente:

- **`addTrack(init)`** — Acepta `{ paramId, zones }` y genera un `trackId` único (UUID). No valida unicidad de `paramId`.
- **`duplicateTrack(trackId)`** — Clona un track completo (curva, keyframes, zones) con nuevo ID. Existe pero **nunca se invoca desde la UI**.
- **`setTrackZones(trackId, zones)`** — Modifica zones de UN track específico. Recalcula `spatialZones` como union. Existe pero **nunca se invoca desde la UI**.
- **`removeTrack(trackId)`** — Elimina por `trackId`, no por `paramId`.
- **`computeSpatialUnion(tracks)`** — Deriva `spatialZones` como la unión de todas las zones de todos los tracks. Correcto para V3.

**Veredicto:** El store está listo para multitrack. Las acciones `duplicateTrack` y `setTrackZones` están implementadas pero dormidas — la UI no las consume.

### 2.2 Serialización — `serializeHephClip()` en `types.ts`

```typescript
const cleanTracks: HephTrack[] = clip.tracks.map(track => ({
  id: track.id,
  paramId: track.paramId,
  zones: [...track.zones],
  curve: { ... },
  blendMode: track.blendMode,
  // ... todos los campos
}));
```

Mapea linealmente sobre `clip.tracks`. No filtra, no deduplica, no asume unicidad de `paramId`. Cada track se serializa con sus propias `zones`.

**Veredicto:** Serialización multitrack-ready.

### 2.3 File I/O — `HephFileIO.ts`

- **`saveClip(clip)`** — Serializa con `serializeHephClip`, calcula checksum sobre el JSON canónico, escribe a disco. No valida unicidad de `paramId`.
- **`loadClip(idOrPath)`** — Carga el JSON, lo pasa por `HephaestusClipIndex.upsert()` que valida estructura V3 (tracks array, zones no vacías, keyframes no vacíos). No valida unicidad de `paramId`.

**Veredicto:** I/O multitrack-ready.

### 2.4 Runtime — `HephaestusRuntime.ts`

```typescript
for (const t of clip.tracks) {
  const fixtureIds = resolveZonesToFixtures(t.zones)
  tracks.push(this._buildResolvedTrack(t.id, t.paramId, t.curve, t.blendMode, fixtureIds, ...))
}
```

Itera sobre todos los tracks. Cada track se resuelve independientemente por sus propias `zones`. Dos tracks con el mismo `paramId` y zones diferentes generan dos `ResolvedTrack` distintos que afectan fixtures distintos.

**Veredicto:** Runtime multitrack-ready. La multicelularidad funciona en ejecución.

---

## 3. La Brecha: UI del Editor (`ForgeTab.tsx` + `index.tsx`)

### 3.1 BUG CRÍTICO — `handleZonesChange` aplica zones a TODOS los tracks

**Archivo:** `index.tsx:385-393`

```typescript
const handleZonesChange = useCallback((zones: EffectZone[]) => {
  const zoneTargets = zones as readonly ZoneTarget[]
  setClip(prev => ({
    ...prev,
    spatialZones: zoneTargets,
    tracks: prev.tracks.map(t => ({ ...t, zones: zoneTargets })),  // ← APLICA A TODOS
  }))
  setIsDirty(true)
}, [])
```

Este es el patrón V2.1: un selector de zona global en el header que sobreescribe las zones de **todos** los tracks simultáneamente. En V3, cada track debe tener su propio selector de zones.

El `ZoneSelector` del header opera sobre `clip.spatialZones` (línea 518) y llama a `handleZonesChange`, que broadcastea a todos los tracks.

### 3.2 `paramIds` deduplica por paramId

**Archivo:** `ForgeTab.tsx:162-165`

```typescript
const paramIds = useMemo<HephParamId[]>(() => {
  if (!clip) return []
  return Array.from(new Set(clip.tracks.map(t => t.paramId)))  // ← SET DEDUPLICA
}, [clip])
```

Si hay dos tracks con `paramId: 'color'`, solo aparece uno en la lista. El segundo track es invisible en la sidebar.

### 3.3 `availableParams` filtra paramIds ya usados

**Archivo:** `ForgeTab.tsx:167-171`

```typescript
const availableParams = useMemo<HephParamId[]>(() => {
  if (!clip) return ALL_PARAM_IDS
  const used = new Set(clip.tracks.map(t => t.paramId))
  return ALL_PARAM_IDS.filter(p => !used.has(p))  // ← BLOQUEA DUPLICADOS
}, [clip])
```

Si ya existe un track `color`, el dropdown "ADD PARAMETER" no muestra `color` como opción disponible. Es imposible añadir un segundo track de color desde la UI.

### 3.4 `handleAddParam` bloquea paramIds duplicados explícitamente

**Archivo:** `ForgeTab.tsx:777-779`

```typescript
const handleAddParam = useCallback((paramId: HephParamId) => {
  setClip((prev: HephAutomationClipV3): HephAutomationClipV3 => {
    if (prev.tracks.some(t => t.paramId === paramId)) return prev  // ← BLOQUEA
    // ...
```

Guard adicional: si somehow se intenta añadir un paramId duplicado, el handler retorna el clip sin cambios.

### 3.5 `updateCurve` encuentra solo el PRIMER track con ese paramId

**Archivo:** `ForgeTab.tsx:362-381`

```typescript
const updateCurve = useCallback((paramId: HephParamId | null, updater: (curve: HephCurve) => HephCurve) => {
  if (!paramId) return
  const buildNext = (prev: HephAutomationClipV3): HephAutomationClipV3 => {
    const trackIdx = prev.tracks.findIndex(t => t.paramId === paramId)  // ← PRIMER MATCH
    if (trackIdx === -1) return prev
    // ... edita solo tracks[trackIdx]
```

`findIndex` retorna el índice del primer track con ese `paramId`. Si hay dos tracks `color`, las ediciones de curva siempre afectan al primero. El segundo track es ineditable desde la UI.

### 3.6 `setActiveParam` selecciona solo el PRIMER track

**Archivo:** `ForgeTab.tsx:179-184`

```typescript
const setActiveParam = useCallback((paramId: HephParamId) => {
  const currentClip = useHephaestusEditorStore.getState().clip
  if (!currentClip) return
  const track = currentClip.tracks.find(t => t.paramId === paramId)  // ← PRIMER MATCH
  if (track) selectTrack(track.id)
}, [selectTrack])
```

Click en una lane siempre selecciona el primer track con ese `paramId`.

### 3.7 `handleRemoveParam` elimina TODOS los tracks con ese paramId

**Archivo:** `ForgeTab.tsx:808-812`

```typescript
const handleRemoveParam = useCallback((paramId: HephParamId) => {
  setClip((prev: HephAutomationClipV3): HephAutomationClipV3 => {
    if (!prev.tracks.some(t => t.paramId === paramId)) return prev
    return { ...prev, tracks: prev.tracks.filter(t => t.paramId !== paramId) }  // ← BORRA TODOS
  })
```

Usa `filter` con `paramId !== paramId`, que elimina todos los tracks con ese paramId, no solo el activo.

### 3.8 ParameterLane usa `paramId` como key, no `track.id`

**Archivo:** `ForgeTab.tsx:1075-1087`

```typescript
paramIds.map(paramId => {
  const track = clip.tracks.find(t => t.paramId === paramId)  // ← PRIMER MATCH
  return (
  <ParameterLane
    key={paramId}  // ← KEY ES paramId, NO track.id
    paramId={paramId}
    curve={track!.curve}
    isActive={paramId === activeParam}
    onClick={() => setActiveParam(paramId)}
    onRemove={handleRemoveParam}
  />
  )
})
```

React key es `paramId`. Si hay dos tracks `color`, React ve solo uno (el último en renderizar sobreescribe al anterior por key collision).

### 3.9 ParameterLane no muestra zones

**Archivo:** `ParameterLane.tsx:130-180`

El componente `ParameterLane` recibe `paramId`, `curve`, `isActive`, `onClick`, `onRemove`. **No recibe `zones`**. No hay forma visual de saber a qué zonas está dirigido un track.

### 3.10 No existe botón "Duplicar Track" en la UI

El store tiene `duplicateTrack(trackId)` implementado, pero ningún componente de la UI lo invoca. No hay botón ni menú contextual para duplicar un track.

### 3.11 No existe selector de zones per-track en la UI

El store tiene `setTrackZones(trackId, zones)` implementado, pero ningún componente de la UI lo invoca. El único selector de zones es el `ZoneSelector` del header global, que aplica a todos los tracks.

---

## 4. Hidratación: Carga de .lfx V3 con Multitrack

### 4.1 Flujo de carga

1. **`HephFileIO.loadClip(id)`** → Lee JSON del disco → Retorna `HephAutomationClipV3` crudo
2. **`HephIPCHandlers`** → `serializeHephClip(clip)` para transporte IPC → Devuelve al renderer
3. **`index.tsx:handleLoad()`** → `temporalActions.resetWithClip(v3Clip)` → `loadClip(clip)` en store
4. **`store.loadClip(clip)`** → Hidrata V2 `selector.phase` → V3 `phaseConfig` → Set state

### 4.2 ¿Qué pasa si un .lfx tiene dos tracks `color`?

1. **`HephFileIO`**: Carga sin problema. No valida unicidad de paramId.
2. **`HephaestusClipIndex.upsert()`**: Valida que cada track tenga `zones` y `keyframes`. No valida unicidad de paramId. ✅
3. **`LfxFileLoader._parseAndValidateV3()`**: Mismas validaciones. No bloquea. ✅
4. **`store.loadClip(clip)`**: Carga el clip tal cual al estado. ✅
5. **`ForgeTab` renderiza**: `paramIds` deduplica con `Set` → solo muestra un lane `color`. El segundo track existe en el store pero es **invisible en la UI**. ❌
6. **`CurveEditor`**: Muestra la curva del primer track `color` encontrado. El segundo es ineditable. ❌
7. **`ZoneSelector` del header**: Muestra `spatialZones` (union de ambos tracks). Cambiarlo sobreescribe ambos tracks. ❌

**Conclusión:** Un .lfx con multitrack se carga correctamente al store, pero la UI lo degrada a single-track. El usuario no puede ver ni editar el segundo track.

---

## 5. Guardado: ¿Preserva Multitrack?

### 5.1 Flujo de guardado

1. **`index.tsx:handleSave()`** → `serializeHephClip(clip)` → IPC `hephaestus.save(serialized)`
2. **`HephIPCHandlers`** → `hephFileIO.saveClip(clip)`
3. **`HephFileIO.saveClip(clip)`** → `serializeHephClip(clip)` → JSON canónico → checksum → `fs.writeFile`

### 5.2 ¿Preserva dos tracks con el mismo paramId?

**Sí.** `serializeHephClip` mapea linealmente sobre `clip.tracks`. Si el store tiene dos tracks `color`, ambos se serializan y guardan.

**Pero:** Dado que la UI no permite crear ni editar multitrack, el único camino para que un .lfx tenga multitrack es:
- Edición manual del JSON
- Script mutador (como `mutate_lfx_v3.ts`)
- Génesis (mutación genética)

Una vez cargado, la UI no permite editar el segundo track, pero al guardar, ambos se preservan.

---

## 6. Inventario de Cambios Necesarios para Multitrack UI

### 6.1 ForgeTab.tsx — Cambios críticos

| # | Función/Variable | Problema | Fix Requerido |
|---|-----------------|----------|---------------|
| 1 | `paramIds` | Deduplica con `Set` | Reemplazar por `clip.tracks` (iterar tracks, no paramIds) |
| 2 | `availableParams` | Filtra paramIds ya usados | Mostrar todos los paramIds siempre (permitir duplicados) |
| 3 | `handleAddParam` | Bloquea paramId duplicado | Eliminar guard `if (prev.tracks.some(...))` |
| 4 | `updateCurve` | `findIndex` por paramId → primer match | Cambiar a buscar por `activeTrackId` (no por paramId) |
| 5 | `setActiveParam` | `find` por paramId → primer match | Ya tiene `selectTrack(trackId)` en store — usar directamente |
| 6 | `handleRemoveParam` | `filter` por paramId → borra todos | Cambiar a `removeTrack(trackId)` del store |
| 7 | ParameterLane render | `key={paramId}`, un lane por paramId | `key={track.id}`, un lane por track |
| 8 | ParameterLane props | No recibe `zones` | Añadir prop `zones` + mostrar badge de zona |

### 6.2 index.tsx — Cambios críticos

| # | Función | Problema | Fix Requerido |
|---|---------|----------|---------------|
| 9 | `handleZonesChange` | Broadcastea zones a todos los tracks | Eliminar broadcast. El header `ZoneSelector` debe ser solo display (spatialZones = union) o eliminarse en favor de selectores per-track |
| 10 | `ZoneSelector` del header | Opera sobre spatialZones global | Convertir a display-only (read-only badge de la union) o mover selector a per-track |

### 6.3 ParameterLane.tsx — Cambios

| # | Componente | Cambio |
|---|-----------|--------|
| 11 | `ParameterLane` | Añadir prop `zones: ZoneTarget[]` y mostrar mini-badge de zona |
| 12 | `ParameterLane` | Añadir prop `onDuplicate?: (trackId: string) => void` con botón de duplicar |
| 13 | `ParameterLane` | Cambiar `onRemove` de `(paramId) => void` a `(trackId: string) => void` |

### 6.4 Nuevo: ZoneSelector per-track

Necesario un mini `ZoneSelector` o popover dentro de cada `ParameterLane` que invoque `store.setTrackZones(trackId, zones)`. El `SmartZoneSelector` ya existe y es reutilizable.

---

## 7. Impacto en el Pipeline Existente

### 7.1 Runtime — Sin impacto

El runtime ya procesa multitrack correctamente. No requiere cambios.

### 7.2 LfxFileLoader / HephaestusClipIndex — Sin impacto

Las validaciones de carga no asumen unicidad de paramId. No requieren cambios.

### 7.3 Génesis (mutación genética) — Sin impacto

Génesis ya puede generar clips multitrack (el store lo soporta). El único límite era la UI.

### 7.4 Chronos / Timeline — Sin impacto

Chronos consume `HephAutomationClipV3` serializado. No inspecciona tracks individuales.

### 7.5 DnaRail — Sin impacto

DnaRail opera sobre `clip.cognitiveDNA`, no sobre tracks individuales.

---

## 8. Estimación de Esfuerzo

| Fase | Descripción | Líneas afectadas | Esfuerzo |
|------|------------|-----------------|----------|
| A | Refactor ForgeTab: iterar tracks en vez de paramIds | ~80 líneas | Medio |
| B | Refactor updateCurve: operar por trackId en vez de paramId | ~60 líneas | Medio |
| C | Añadir ZoneSelector per-track en ParameterLane | ~40 líneas nuevo | Bajo |
| D | Añadir botón Duplicate en ParameterLane | ~15 líneas nuevo | Bajo |
| E | Header ZoneSelector → display-only (o eliminar) | ~20 líneas | Bajo |
| F | Tests de regresión | — | Medio |

**Total estimado:** ~215 líneas modificadas/nuevas. Medio día de trabajo.

---

## 9. Conclusión

El arquitecto tiene razón: el motor V3 soporta multicelularidad completa. El store, la serialización, el I/O y el runtime están listos. **La UI es el único bottleneck.**

El error de novato del primer día fue heredar el patrón V2.1 de "un track por paramId, zona global" en la UI, cuando el modelo V3 es "N tracks por paramId, zona per-track". Las acciones del store (`duplicateTrack`, `setTrackZones`) ya están implementadas pero dormidas — la UI nunca las invoca.

El fix no requiere refactor arquitectónico. Es un cambio focalizado en `ForgeTab.tsx` (cambiar iteración de `paramIds` → `tracks`) y `ParameterLane.tsx` (añadir zone badge + botón duplicate). El header `ZoneSelector` debe degradarse a display-only.
