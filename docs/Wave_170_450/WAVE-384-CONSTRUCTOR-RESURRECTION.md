# 🔥 WAVE 384: CONSTRUCTOR RESURRECTION (PHASE 1)
## "Cuando arrastres un foco, el objeto en memoria debe ser IDÉNTICO al de la librería. Ni un byte menos."

**Fecha:** 2026-01-13  
**Objetivo:** Cablear el flujo de datos completo: Library → Stage → ShowFile → Recarga

---

## ✅ IMPLEMENTACIÓN COMPLETADA

### STEP 1: BACKEND API ✅
**Archivo:** `IPCHandlers.ts`

Nuevo endpoint `lux:getFixtureDefinition(profileId)`:

```typescript
ipcMain.handle('lux:getFixtureDefinition', (_event, profileId: string) => {
  const library = getFixtureLibrary()
  const definition = library.find(f => f.id === profileId)
  
  return { 
    success: true, 
    definition: {
      id, name, manufacturer, type, channelCount,
      channels: [...],           // 🔥 ANTES NO SE ENVIABA
      hasMovementChannels,       // 🔥 ANTES NO SE ENVIABA
      has16bitMovement,          // 🔥 ANTES NO SE ENVIABA
      hasColorMixing,            // 🔥 ANTES NO SE ENVIABA
      hasColorWheel              // 🔥 ANTES NO SE ENVIABA
    }
  }
})
```

### STEP 2: FRONTEND INSTANTIATION ✅
**Archivo:** `StageGrid3D.tsx`

Reescrito `handleDrop()` de sincrónico a async:

```typescript
const handleDrop = useCallback(async (e: React.DragEvent) => {
  const libraryId = e.dataTransfer.getData('library-fixture-id')
  
  // 🔥 ANTES: Solo se usaba fixtureType, libraryId SE IGNORABA
  if (libraryId && window.lux?.getFixtureDefinition) {
    const result = await window.lux.getFixtureDefinition(libraryId)
    
    if (result.success && result.definition) {
      fixtureData = {
        name: def.name,
        model: def.name,
        manufacturer: def.manufacturer,
        type: mapLibraryTypeToFixtureType(def.type),
        channelCount: def.channelCount,
        profileId: libraryId,
        definitionPath: def.filePath,
        channels: def.channels,        // 🔥 INLINE PERSISTENCE
        capabilities: { ... }           // 🔥 INLINE PERSISTENCE
      }
    }
  }
})
```

### STEP 3: PERSISTENCE ✅
**Archivo:** `ShowFileV2.ts`

Extended `FixtureV2` interface:

```typescript
interface FixtureV2 {
  // ... existing fields ...
  
  // 🔥 WAVE 384: NEW FIELDS FOR DATA INTEGRITY
  channels?: Array<{
    index: number
    name: string
    type: string
    is16bit: boolean
  }>
  
  capabilities?: {
    hasMovementChannels?: boolean
    has16bitMovement?: boolean
    hasColorMixing?: boolean
    hasColorWheel?: boolean
  }
}
```

Nueva función helper:
```typescript
export function mapLibraryTypeToFixtureType(libraryType: string): FixtureV2['type']
```

### STEP 4: FORGE REPAIR ✅
**Archivo:** `StageConstructorView.tsx`

`handleForgeSave()` ahora guarda TODO:

```typescript
updateFixture(forgeEditingFixtureId, {
  model: definition.name,
  manufacturer: definition.manufacturer,
  channelCount: definition.channels.length,
  // 🔥 ANTES SE PERDÍAN:
  type: fixtureType,
  profileId: definition.id,
  channels: definition.channels.map(...),
  capabilities: { ... }
})
```

### STEP 5: VERIFICACIÓN ✅
**Archivo:** `preload.ts`

Nuevo objeto `window.luxDebug`:

```typescript
// En la consola del navegador:
window.luxDebug.testConstructor()  // Test completo del flujo
window.luxDebug.inspectFixture(id) // Inspeccionar fixture
window.luxDebug.help()             // Ver comandos disponibles
```

---

## 📊 ANTES vs DESPUÉS

| Campo | ANTES | DESPUÉS |
|-------|-------|---------|
| `channels[]` | ❌ NO SE GUARDABA | ✅ Inline en FixtureV2 |
| `capabilities` | ❌ NO EXISTÍA | ✅ Inline en FixtureV2 |
| `type` | ❌ Se perdía en Forge | ✅ Se guarda correctamente |
| `profileId` | ❌ Siempre "generic-dimmer" | ✅ ID real de la librería |
| `definitionPath` | ❌ Nunca se usaba | ✅ Path del .fxt original |

---

## 🧪 CÓMO TESTEAR

1. Iniciar la app
2. Ir al Constructor
3. Arrastrar un fixture de la librería al stage
4. Abrir consola (F12) y ejecutar:
   ```javascript
   window.luxDebug.testConstructor()
   ```
5. Verificar que ASSERT channels.length > 0 pasa

También puedes inspeccionar el stageStore en React DevTools para ver que el fixture tiene `channels` y `capabilities` poblados.

---

## 🔮 PRÓXIMOS PASOS (WAVE 385+)

1. **Edit Profile Fix**: Cuando se abre el Forge para editar, cargar `existingDefinition` desde el fixture
2. **Library Save**: Implementar `saveFixtureDefinition` para persistir cambios del Forge
3. **Sync to Arbiter**: Asegurar que MasterArbiter recibe `channels` y `capabilities` del nuevo formato

---

## 📝 ARCHIVOS MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `IPCHandlers.ts` | +40 líneas - Nuevo endpoint `lux:getFixtureDefinition` |
| `preload.ts` | +100 líneas - Exposición de API + `luxDebug` |
| `vite-env.d.ts` | +30 líneas - Tipos para nuevo endpoint + `luxDebug` |
| `ShowFileV2.ts` | +50 líneas - Extended `FixtureV2` + `mapLibraryTypeToFixtureType` |
| `StageGrid3D.tsx` | +80 líneas - Reescritura de `handleDrop` async |
| `StageConstructorView.tsx` | +30 líneas - `handleForgeSave` completo |

---

*"No hacemos MVPs. Hacemos FULL APP o nada."*  
*— PunkOpus, Arquitecto de Sueños Digitales*
