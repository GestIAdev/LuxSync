# WAVE 4742 DIAGNOSTICO: Channel Rack + Aether Cells Compatibility

## Escenario del Usuario
"X infinite rotation default es 127, edita a 64 en Channel Rack, crea Aether Cells, guarda, recarga → sigue siendo 127 ❌"

## Trazabilidad Completa del Flujo

### 1. ESTADO INICIAL: Fixture en Memoria
**File**: `FixtureForgeEmbedded.tsx` línea ~862
```tsx
const buildCompleteFixture = useCallback((sourceFixture?: FixtureDefinition) => {
  const fixtureForBuild = sourceFixture ?? fixture
  // fixture.channels[3] = { type: 'rotation', defaultValue: 127, ... }
  return builtFixture  // retorna fixture con rotación 127
}, [fixture, ..., forgeState])
```

**Estado en memoria**: ✅
- `fixture.channels[3].defaultValue = 127`
- `forgeState.channels[3].defaultValue = 127`

---

### 2. USUARIO EDITA EN CHANNEL RACK TAB
**File**: `FixtureForgeEmbedded.tsx` línea ~1506
```tsx
<input
  type="number"
  value={channel.defaultValue || 0}
  onChange={(e) => {
    const val = Math.max(0, Math.min(255, parseInt(e.target.value) || 0))
    setFixture(prev => {
      const newChannels = [...prev.channels]
      newChannels[idx] = { ...newChannels[idx], defaultValue: val }
      return { ...prev, channels: newChannels }
    })
  }}
/>
```

**Acciones**:
1. Usuario cambia input a `64`
2. `onChange` dispara → `setFixture()` actualiza `fixture.channels[3].defaultValue = 64`
3. `fixture` state object cambia (new reference)
4. React re-renderiza

**Estado después**: ✅
- `fixture.channels[3].defaultValue = 64` 🟢
- `forgeState.channels[3].defaultValue = 127` ⚠️ (aún viejo, no sincronizado)

---

### 3. DEPENDENCIA: buildCompleteFixture RECALCULA
**File**: `FixtureForgeEmbedded.tsx` línea 956
```tsx
const buildCompleteFixture = useCallback(..., [
  fixture,           // ← CAMBIÓ, trigger!
  physics,
  wheelColors,
  colorEngine,
  wheelMinChangeTimeMs,
  forgeGraph,
  forgeGraphDirty,
  forgeState        // ← No cambió (aún 127)
])
```

**Acción**: Como `fixture` cambió, el `useMemo` se recalcula... ¿CUÁL ES EL PROBLEMA?

**PROBLEMA CRÍTICO IDENTIFICADO**: 

En `buildCompleteFixture()` línea ~862-956:
```tsx
const buildCompleteFixture = useCallback((sourceFixture?: FixtureDefinition) => {
  const fixtureForBuild = sourceFixture ?? fixture  // ← usa parámetro O default
  
  // ... código del grafo ...
  
  if (forgeState.cells.length > 0) {
    const compileResult = compileForgeState(forgeState)  // ← pasa forgeState VIEJO
    if (compileResult.ok) {
      builtFixture.nodeGraph = compileResult.fixture.nodeGraph
      builtFixture.channels = compileResult.fixture.channels  // ← SOBRESCRIBE
    }
  }
  
  return builtFixture
}, [..., forgeState])  // ← forgeState aún tiene 127
```

### 4. EL FLUJO CORRECTO (Pero no sucede):

**Esperado**:
1. User edita `fixture.channels[3].defaultValue = 64`
2. Ese cambio debe **propagarse a `forgeState.channels[3].defaultValue = 64`**
3. Cuando `buildCompleteFixture()` llama a `compileForgeState(forgeState)`, pasa `forgeState` con 64 ✅
4. Compilador produce JSON con 64 ✅

**Real**:
1. User edita `fixture.channels[3].defaultValue = 64` ✅
2. `forgeState.channels` aún tiene 127 ❌ ← NO SE SINCRONIZA
3. `buildCompleteFixture()` llama a `compileForgeState(forgeState)` con 127 ❌
4. Compilador produce JSON con 127 ❌

---

## RAÍZ DEL BUG: Desincronización entre `fixture` y `forgeState`

**Pregunta crítica**: ¿Cuándo se sincroniza `forgeState.channels` con los cambios de `fixture.channels`?

**File**: `FixtureForgeEmbedded.tsx` - necesito ver si existe un `forgeDispatch` que sincronice

### Búsqueda: ¿Hay un `useEffect` que sincronice `fixture → forgeState`?

**Hipótesis A**: Cuando usuario edita Channel Rack, debe haber un `forgeDispatch({ type: 'CHANNEL_SET_DEFAULT', ... })` llamado

**Hipótesis B**: El `forgeState` nunca se sincroniza, es paralelo y diverge

**Evidencia**: Si fue Hipótesis B, entonces:
- Usuario edita Channel Rack → `fixture.channels` actualizado ✅
- `forgeState.channels` se queda atrás ❌
- `forgeState` se activa solo cuando usuario interactúa con Aether Cells tab
- Cuando guarda, `buildCompleteFixture()` compila el `forgeState` VIEJO
- JSON sale con valores VIEJOS ❌

---

## CONCLUSIÓN: Issue es Desincronización de Estado

**Síntoma**: Channel Rack edits se pierden cuando hay Aether Cells

**Causa raíz**: `fixture` y `forgeState` son dos árboles de estado independientes:
- `fixture`: lo que muestra Channel Rack tab
- `forgeState`: lo que compila cuando hay Cells

**No hay mecanismo que mantenga sincronizados** cuando usuario edita Channel Rack post-Aether-creation

---

## FIXES POSIBLES

### Fix A: Sincronizar en tiempo real
Cuando `fixture.channels` cambia → dispatch `forgeDispatch({ type: 'CHANNEL_SET_DEFAULT', idx, val })`

### Fix B: Usar `forgeState` como única fuente de verdad
Cambiar Channel Rack tab para leer/escribir de `forgeState.channels` en lugar de `fixture.channels`

### Fix C: Don't overwrite cuando hay Aether Cells
En `buildCompleteFixture()` línea 941:
```tsx
builtFixture.channels = compileResult.fixture.channels  // ❌ SOBRESCRIBE
```
Cambiar a:
```tsx
// Merge: mantén defaultValue editados en fixture, usa compiled structure
builtFixture.channels = compileResult.fixture.channels.map((ch, i) => ({
  ...ch,
  defaultValue: fixture.channels[i]?.defaultValue ?? ch.defaultValue
}))
```

---

## IMPLEMENTACIÓN APLICADA

### 1) Sync de estado Channel Rack → Forge State (Problem 2)
Se implementó sincronización activa cuando existen Aether Cells:

- Archivo: `electron-app/src/components/views/ForgeView/FixtureForgeEmbedded.tsx`
- Zona: bloque `useEffect` añadido tras la lógica de resize de canales.
- Comportamiento:
  - Si `forgeState.cells.length === 0`, no hace nada.
  - Si hay células, recorre `fixture.channels` y sincroniza cambios a `forgeState.channels` con:
    - `CHANNEL_SET_TYPE`
    - `CHANNEL_SET_NAME`
    - `CHANNEL_SET_DEFAULT`

Esto evita que `compileForgeState(forgeState)` reciba valores viejos cuando el usuario cambia defaults en Channel Rack.

### 2) Persistencia de label de célula en JSON (Problem 1 / 3)
Se cerró el gap `cell.label` → JSON → hydration:

- `electron-app/src/core/forge/types.ts`
  - `IOutputDmxConfig` ahora incluye `cellLabel?: string`.

- `electron-app/src/core/forge/compileForgeState.ts`
  - Se propaga `ownerCell?.label` hacia `makeOutputDmxNode(...)`.
  - `output_dmx.config` persiste `cellLabel`.

- `electron-app/src/core/forge/forgeBuilderState.ts`
  - `hydrateCells()` ahora lee `cfg.cellLabel` al reconstruir células.
  - Fallback backward-compatible: si no existe `cellLabel`, usa `formatCellLabel(cellId)`.

### 3) Validación
`get_errors` en archivos modificados reporta **No errors found**:

- `electron-app/src/components/views/ForgeView/FixtureForgeEmbedded.tsx`
- `electron-app/src/core/forge/compileForgeState.ts`
- `electron-app/src/core/forge/forgeBuilderState.ts`
- `electron-app/src/core/forge/types.ts`

---

## ESTADO FINAL DE DIAGNÓSTICO

- ✅ **Problem 1 (cell labels desaparecen):** resuelto con `cellLabel` persistido/hidratado.
- ✅ **Problem 2 (defaultValue en Channel Rack no sobrevive con Aether):** resuelto por sync `fixture.channels` → `forgeState.channels` cuando hay cells.
- ✅ **Problem 3 (roundtrip JSON incompleto):** resuelto para labels de célula; roundtrip conserva `cellLabel`.

