# 🏚️ WAVE 383: CONSTRUCTOR RECONSTRUCTION AUDIT
## "El Forense del Frankenstein Roto"

**Fecha:** 2026-01-13  
**Objetivo:** Documentar dónde se pierden los datos del fixture y por qué el Constructor está roto.

---

## 📊 EXECUTIVE SUMMARY

| Issue | Severity | Root Cause | Location |
|-------|----------|------------|----------|
| Fixtures sin metadata al instanciar | 🔴 CRÍTICO | `handleDrop` no carga perfil de librería | `StageGrid3D.tsx:760-770` |
| Forja no guarda channels/type | 🔴 CRÍTICO | `handleForgeSave` solo guarda 3 campos | `StageConstructorView.tsx:726-741` |
| Edit Profile abre Forja vacía | 🔴 CRÍTICO | No se pasa `existingDefinition` al Forge | `StageConstructorView.tsx:820-828` |
| Library no expone channels | 🟡 MEDIO | `getFixtureLibrary` no retorna channels | `FXTParser/IPCHandlers` |
| Type perdido = movers genéricos | 🔴 CRÍTICO | Cadena de pérdida desde instanciación | Múltiples archivos |

---

## 🩸 FLUJO DE DATOS DEL CONSTRUCTOR

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 📚 FIXTURE LIBRARY (Backend)                                            │
│ Fuente: /librerias/*.fxt + /librerias/*.json                            │
│ Parser: FXTParser.ts                                                    │
│                                                                          │
│ Datos completos del perfil:                                              │
│ {                                                                        │
│   id, name, manufacturer, type,                                          │
│   channels: [ { type, name, defaultValue } ],  ✅ EXISTE                 │
│   channelCount,                                                          │
│   capabilities: { hasColor, hasMovement, ... }  ✅ EXISTE               │
│ }                                                                        │
└───────────────────────────────────────┬─────────────────────────────────┘
                                        │
                                        │ IPC: lux:getFixtureLibrary
                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 📋 getFixtureLibrary() Response                                          │
│ Archivo: electron/IPCHandlers.ts                                         │
│                                                                          │
│ PROBLEMA #1: ⚠️ Retorna metadata reducida                                │
│ {                                                                        │
│   id, name, manufacturer, type, channelCount,                            │
│   filePath                                                               │
│   ❌ NO CHANNELS                                                         │
│   ❌ NO CAPABILITIES                                                     │
│ }                                                                        │
└───────────────────────────────────────┬─────────────────────────────────┘
                                        │
                                        │ React State
                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 🎨 FixtureLibrarySidebar (UI)                                            │
│ Archivo: StageConstructorView.tsx:170-400                                │
│                                                                          │
│ libraryFixtures = [ { id, name, manufacturer, type, channelCount } ]     │
│ ❌ NO CHANNELS                                                           │
│                                                                          │
│ Al arrastrar:                                                            │
│   e.dataTransfer.setData('fixture-type', type)                           │
│   e.dataTransfer.setData('library-fixture-id', libFix.id)  ← TIENE ID   │
│                                                                          │
│ PROBLEMA #2: ⚠️ Se pasa ID pero NO se usa para cargar definición         │
└───────────────────────────────────────┬─────────────────────────────────┘
                                        │
                                        │ Drag & Drop
                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 📍 handleDrop() - StageGrid3D.tsx:716-775                                │
│                                                                          │
│ CÓDIGO ACTUAL:                                                           │
│ ```tsx                                                                   │
│ const fixtureType = e.dataTransfer.getData('fixture-type') || 'par'     │
│ // ❌ library-fixture-id NUNCA SE USA!                                   │
│                                                                          │
│ const newFixture = createDefaultFixture(fixtureId, nextAddress, {       │
│   type: fixtureType as FixtureV2['type'],  // Solo el type string       │
│   position: { x, y: 3, z },                                              │
│   zone: autoZone                                                         │
│ })                                                                       │
│ ```                                                                      │
│                                                                          │
│ PROBLEMA #3: 🔴 CRÍTICO                                                  │
│ - NO carga la definición completa de la librería                         │
│ - NO copia channels                                                      │
│ - NO copia capabilities                                                  │
│ - NO copia manufacturer/model reales                                     │
│ - Crea fixture "vacío" con solo type genérico                            │
└───────────────────────────────────────┬─────────────────────────────────┘
                                        │
                                        │ addFixture(newFixture)
                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 📦 stageStore.fixtures[]                                                 │
│                                                                          │
│ Fixture guardado:                                                        │
│ {                                                                        │
│   id: "fixture-1234567890",                                              │
│   name: "Fixture 9",                   ← Genérico                        │
│   model: "Generic",                    ← Genérico                        │
│   manufacturer: "Unknown",             ← Genérico                        │
│   type: "moving-head",                 ← OK (del drag)                   │
│   channelCount: 1,                     ← ❌ INCORRECTO (default)         │
│   profileId: "generic-dimmer",         ← ❌ INCORRECTO (default)         │
│   ❌ NO CHANNELS ARRAY                                                   │
│   ❌ NO CAPABILITIES                                                     │
│ }                                                                        │
└───────────────────────────────────────┬─────────────────────────────────┘
                                        │
                                        │ JSON.stringify → .luxshow
                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 💾 PERSISTENCIA (.luxshow file)                                          │
│                                                                          │
│ El archivo SE GUARDA correctamente, pero con datos incompletos:          │
│ - fixtures[] tiene todos los campos de FixtureV2                         │
│ - PERO los valores son genéricos porque nunca se poblaron                │
│                                                                          │
│ Al RECARGAR el show:                                                     │
│ - Los fixtures siguen siendo genéricos                                   │
│ - No hay forma de recuperar la metadata original                         │
│ - El type puede sobrevivir, pero channels NO                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔴 HALLAZGO #1: INSTANCIACIÓN CIEGA

### Ubicación
`StageGrid3D.tsx` → `handleDrop()` → Lines 716-775

### Código Problemático
```tsx
const handleDrop = useCallback((e: React.DragEvent) => {
  // ...
  const fixtureType = e.dataTransfer.getData('fixture-type') || 'par'
  // ⚠️ library-fixture-id está disponible pero NUNCA SE USA:
  // const libraryFixtureId = e.dataTransfer.getData('library-fixture-id')
  
  const newFixture = createDefaultFixture(fixtureId, nextAddress, {
    type: fixtureType as FixtureV2['type'],  // ❌ Solo pasa el type
    position: { x: worldX, y: 3, z: worldZ },
    zone: autoZone
  })
  
  addFixture(newFixture)
}, [addFixture, setDraggedFixtureType])
```

### El Problema
1. El `library-fixture-id` se envía en el drag pero **NUNCA SE LEE**
2. No hay llamada IPC para cargar la definición completa
3. El fixture se crea con valores por defecto de `createDefaultFixture()`

### Solución Propuesta
```tsx
const handleDrop = useCallback(async (e: React.DragEvent) => {
  const fixtureType = e.dataTransfer.getData('fixture-type') || 'par'
  const libraryId = e.dataTransfer.getData('library-fixture-id')
  
  // 🔧 FIX: Cargar definición completa si viene de la librería
  let fixtureData: Partial<FixtureV2> = { type: fixtureType as FixtureV2['type'] }
  
  if (libraryId && window.lux?.getFixtureDefinition) {
    const definition = await window.lux.getFixtureDefinition(libraryId)
    if (definition) {
      fixtureData = {
        ...fixtureData,
        name: definition.name,
        model: definition.name,
        manufacturer: definition.manufacturer,
        channelCount: definition.channels.length,
        profileId: libraryId,
        // Guardar channels en un campo extendido o en el showfile
      }
    }
  }
  
  const newFixture = createDefaultFixture(fixtureId, nextAddress, {
    ...fixtureData,
    position: { x: worldX, y: 3, z: worldZ },
    zone: autoZone
  })
  
  addFixture(newFixture)
}, [addFixture])
```

---

## 🔴 HALLAZGO #2: FORGE SAVE INCOMPLETO

### Ubicación
`StageConstructorView.tsx` → `handleForgeSave()` → Lines 726-741

### Código Problemático
```tsx
const handleForgeSave = useCallback((definition: FixtureDefinition, physics: PhysicsProfile) => {
  if (forgeEditingFixtureId) {
    updateFixture(forgeEditingFixtureId, {
      model: definition.name,
      manufacturer: definition.manufacturer,
      channelCount: definition.channels.length
      // ❌ NO SE GUARDA: type, channels, capabilities
    })
    updateFixturePhysics(forgeEditingFixtureId, physics)
  }
  // TODO: Save definition to library for new fixtures  ← ¡EL TODO ETERNO!
}, [...])
```

### El Problema
1. Solo guarda 3 campos: `model`, `manufacturer`, `channelCount`
2. **NO GUARDA**: `type`, `channels[]`, `capabilities`
3. El TODO para guardar en librería **NUNCA SE IMPLEMENTÓ**

### Solución Propuesta
```tsx
const handleForgeSave = useCallback(async (definition: FixtureDefinition, physics: PhysicsProfile) => {
  if (forgeEditingFixtureId) {
    // Actualizar fixture existente con TODOS los datos
    updateFixture(forgeEditingFixtureId, {
      model: definition.name,
      manufacturer: definition.manufacturer,
      type: mapDefinitionTypeToFixtureType(definition.type),
      channelCount: definition.channels.length,
      // Guardar referencia a la definición
      profileId: definition.id
    })
    updateFixturePhysics(forgeEditingFixtureId, physics)
  }
  
  // 🔧 FIX: Siempre guardar la definición en la librería
  if (window.lux?.saveFixtureDefinition) {
    await window.lux.saveFixtureDefinition(definition)
  }
}, [...])
```

---

## 🔴 HALLAZGO #3: EDIT PROFILE SIN DATOS

### Ubicación
`StageConstructorView.tsx` → `<FixtureForge />` → Lines 820-828

### Código Problemático
```tsx
<FixtureForge
  isOpen={isForgeOpen}
  onClose={() => { ... }}
  onSave={handleForgeSave}
  editingFixture={forgeEditingFixtureId 
    ? fixtures.find(f => f.id === forgeEditingFixtureId) 
    : null}
  // ❌ FALTA: existingDefinition - la Forja no recibe la definición actual!
/>
```

### El Problema
1. La Forja recibe `editingFixture` (el FixtureV2 del stage)
2. **NO recibe** `existingDefinition` (el FixtureDefinition con channels)
3. La Forja abre vacía porque no sabe qué channels tiene el fixture

### Solución Propuesta
```tsx
// Cargar definición cuando se edita
const [editingDefinition, setEditingDefinition] = useState<FixtureDefinition | null>(null)

useEffect(() => {
  if (forgeEditingFixtureId) {
    const fixture = fixtures.find(f => f.id === forgeEditingFixtureId)
    if (fixture?.profileId && window.lux?.getFixtureDefinition) {
      window.lux.getFixtureDefinition(fixture.profileId)
        .then(def => setEditingDefinition(def))
    }
  } else {
    setEditingDefinition(null)
  }
}, [forgeEditingFixtureId, fixtures])

<FixtureForge
  isOpen={isForgeOpen}
  onClose={() => { ... }}
  onSave={handleForgeSave}
  editingFixture={...}
  existingDefinition={editingDefinition}  // 🔧 FIX: Pasar la definición
/>
```

---

## 🟡 HALLAZGO #4: LIBRARY NO EXPONE CHANNELS

### Ubicación
Backend: `IPCHandlers.ts` o donde se implementa `lux:getFixtureLibrary`

### Código Actual (Inferido)
La respuesta de `getFixtureLibrary` solo incluye metadata básica:
```typescript
{
  id, name, manufacturer, type, channelCount, filePath
  // ❌ NO channels[]
  // ❌ NO capabilities
}
```

### El Problema
El frontend **NO PUEDE** obtener la definición completa porque la API no la expone.

### Solución Propuesta
1. Añadir endpoint IPC: `lux:getFixtureDefinition(id)`
2. O incluir `channels[]` en la respuesta de `getFixtureLibrary`
3. Cachear definiciones en el frontend

---

## 🔴 HALLAZGO #5: INTERFACE FixtureV2 INCOMPLETA

### Ubicación
`ShowFileV2.ts` → `interface FixtureV2` → Lines 207-265

### Código Actual
```typescript
export interface FixtureV2 {
  id: string
  name: string
  model: string
  manufacturer: string
  type: 'moving-head' | 'par' | 'wash' | 'strobe' | 'laser' | 'blinder' | 'generic'
  address: number
  universe: number
  channelCount: number
  profileId: string  // ← ESTO DEBERÍA REFERENCIAR A LA DEFINICIÓN
  position: Position3D
  rotation: Rotation3D
  physics: PhysicsProfile
  zone: FixtureZone
  definitionPath?: string  // ← EXISTE PERO NO SE USA
  // ❌ NO HAY: channels[], capabilities
}
```

### El Problema
1. `profileId` existe pero **NUNCA SE POPULA CORRECTAMENTE**
2. `definitionPath` existe pero **NUNCA SE USA**
3. No hay campo para guardar `channels[]` inline (todo depende de profileId)

### Opciones de Solución
**Opción A**: Guardar channels inline en FixtureV2
```typescript
interface FixtureV2 {
  // ...existing
  channels?: FixtureChannel[]  // Copia local de los canales
  capabilities?: FixtureCapabilities
}
```

**Opción B**: Usar profileId correctamente
- Poblar `profileId` con el ID real de la librería
- Crear endpoint `getFixtureDefinition(profileId)`
- La UI carga la definición cuando necesita los channels

---

## 🏥 PLAN DE CORRECCIÓN RECOMENDADO

### FASE 1: Backend API (Prioridad Alta)
**Archivos:** `IPCHandlers.ts`, `FXTParser.ts`

1. **Añadir IPC**: `lux:getFixtureDefinition(id)`
   - Input: `profileId` o `filePath`
   - Output: `FixtureDefinition` completo con `channels[]`

2. **Extender `getFixtureLibrary`**
   - Incluir `channels[]` en cada fixture
   - O al menos `capabilities` para UI

### FASE 2: Instanciación Correcta (Prioridad Alta)
**Archivos:** `StageGrid3D.tsx`

1. Leer `library-fixture-id` del dataTransfer
2. Llamar `lux:getFixtureDefinition` si hay ID
3. Poblar `profileId`, `model`, `manufacturer`, `channelCount` desde definición

### FASE 3: Forge Save Completo (Prioridad Media)
**Archivos:** `StageConstructorView.tsx`, `FixtureForge.tsx`

1. `handleForgeSave` debe guardar el `type` correcto
2. Implementar `saveFixtureDefinition` para persistir en librería
3. Pasar `existingDefinition` a la Forja cuando se edita

### FASE 4: Properties Panel (Prioridad Baja)
El panel actualmente lee correctamente del stageStore. Los datos incorrectos vienen de la instanciación, no del panel.

---

## 📋 CONEXIONES UI ↔ CONSTRUCTOR

```
┌─────────────────────────────────────────────────────────────────────┐
│                    STAGE CONSTRUCTOR VIEW                            │
│                                                                      │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐   │
│  │ FixtureLibrary  │   │   StageGrid3D   │   │ PropertiesPanel │   │
│  │    Sidebar      │   │    (Canvas)     │   │   (Right)       │   │
│  │                 │   │                 │   │                 │   │
│  │ • Drag source   │──▶│ • Drop target   │   │ • Selection     │   │
│  │ • Library list  │   │ • Fixture mesh  │◀──│ • Zone edit     │   │
│  │ • Forge button  │   │ • Raycasting    │   │ • Physics info  │   │
│  └────────┬────────┘   └────────┬────────┘   └────────┬────────┘   │
│           │                     │                     │             │
│           ▼                     ▼                     ▼             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      STORES                                  │   │
│  │                                                              │   │
│  │  stageStore.fixtures[] ◀───────────────────────────────────│   │
│  │  selectionStore.selectedIds ◀──────────────────────────────│   │
│  │  controlStore (globalMode, etc.) ◀─────────────────────────│   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   PERSISTENCE                                │   │
│  │  StagePersistence.save() → .luxshow file                    │   │
│  │  TitanSyncBridge → Backend (MasterArbiter, Orchestrator)    │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘

PROBLEMA CENTRAL:
La flecha de "Drag source" → "Drop target" pierde la metadata.
El fixture llega al stageStore como un objeto genérico.
```

---

## 🎯 CONCLUSIÓN

**El Constructor tiene un problema de DISEÑO, no solo bugs:**

1. **Separación excesiva**: La definición de fixture (channels, capabilities) vive en la librería (backend), pero el fixture instanciado (stageStore) solo guarda una referencia débil (`profileId`) que **NUNCA SE USA** para recuperar los datos.

2. **Drag & Drop incompleto**: Se diseñó el mecanismo de arrastrar con `library-fixture-id` pero **NUNCA SE IMPLEMENTÓ** el código que lo lee y carga la definición.

3. **Forja desconectada**: La Forja puede crear/editar definiciones pero no tiene un flujo claro para:
   - Guardar en librería (el TODO eterno)
   - Cargar al editar un fixture existente
   - Propagar cambios a fixtures ya instanciados

**WAVE 384 debería enfocarse en:**
1. Crear `lux:getFixtureDefinition(id)` endpoint
2. Implementar carga de definición en `handleDrop`
3. Completar `handleForgeSave` para guardar todo

---

*Reporte generado: WAVE 383 - Constructor Reconstruction Audit*  
*Arquitecto: PunkOpus*  
*"No hay prisa. Hacemos FULL APP o nada."*
