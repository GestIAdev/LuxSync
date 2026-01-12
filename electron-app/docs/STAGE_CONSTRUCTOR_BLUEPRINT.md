# 🏗️ STAGE CONSTRUCTOR BLUEPRINT
## Auditoría Forense del Sistema de Persistencia, Setup y Patcheo

**Versión**: Pre-diseño v1.0  
**Fecha**: 11 Enero 2026  
**Objetivo**: Documentar el estado actual antes de construir el Stage Constructor que humillará a GrandMA3

---

## 📋 RESUMEN EJECUTIVO

### El Problema Central
El sistema de persistencia de LuxSync es **funcional pero PRIMITIVO**. Fue construido para salir del paso (WAVE 10-26) y tiene las siguientes limitaciones críticas:

| Área | Estado | Veredicto |
|------|--------|-----------|
| Posiciones 3D de Fixtures | ❌ NO SE GUARDAN | Generadas algorítmicamente |
| Zonas | ⚠️ AUTO-ASIGNADAS | Sin edición manual persistente |
| Grupos | ❌ NO EXISTEN | Crítico para profesional |
| Escenas | ⚠️ PARCIAL | Solo en localStorage, no en showfile |
| Showfile | ⚠️ DUPLICADO | ConfigManager vs ShowManager |
| Fixture Editor | ⚠️ MUY BÁSICO | Solo DMX address y zona |

### La Oportunidad
Todo el sistema puede ser reemplazado por un **Stage Constructor unificado** que incluya:
- Drag & Drop de fixtures en grid 3D
- Persistencia completa de posiciones, zonas y grupos
- Librería de fixtures profesional con editor completo
- Eliminación de la duplicación ConfigManager/ShowManager

---

## 🗄️ ARQUITECTURA DE PERSISTENCIA ACTUAL

### 1. ConfigManager.ts (Singleton Backend)
**Ubicación**: `src/core/config/ConfigManager.ts`  
**Almacenamiento**: `%APPDATA%/LuxSync/luxsync-config.json`

```typescript
interface LuxSyncUserConfig {
  version: string
  lastSaved: string
  
  patchedFixtures: PatchedFixtureConfig[]  // 🎯 LA FUENTE DE VERDAD
  
  dmx: DMXConfig                           // Driver, port, universe
  audio: AudioConfig                       // Source, sensitivity, gain
  seleneMode: string                       // idle | reactive | autonomous
  installationType: 'ceiling' | 'floor'    // 🎯 WAVE 12.5
  
  ui: {                                    // Preferencias visuales
    lastView: string
    showBeams: boolean
    showGrid: boolean
    showZoneLabels: boolean
  }
}
```

**Flujo de Persistencia**:
```
Usuario edita fixture → IPCHandler → configManager.updateConfig()
                                   ↓
                        luxsync-config.json (disco)
                                   ↓
                        main.ts carga al iniciar
                                   ↓
                        patchedFixtures[] en memoria
```

### 2. ShowManager.ts (Gestión de Shows)
**Ubicación**: `src/core/library/ShowManager.ts`  
**Almacenamiento**: `%APPDATA%/LuxSync/shows/*.json`

```typescript
interface ShowData {
  name: string
  description: string
  createdAt: string
  modifiedAt: string
  
  audio: AudioConfig
  dmx: DMXConfig
  patchedFixtures: PatchedFixtureConfig[]  // ⚠️ DUPLICADO
  
  seleneMode: string
  installationType: 'ceiling' | 'floor'
}
```

**Problema CRÍTICO**: ShowManager y ConfigManager guardan la MISMA información de forma duplicada. 
- ConfigManager = "configuración activa" (auto-save)
- ShowManager = "shows guardados" (manual save)

### 3. SceneStore.ts (Escenas/Snapshots)
**Ubicación**: `src/stores/sceneStore.ts`  
**Almacenamiento**: `localStorage` (browser)

```typescript
interface Scene {
  id: string
  name: string
  createdAt: number
  metadata: {
    fadeTime: number
    tags: string[]
    previewColor: string
    fixtureCount: number
  }
  overrides: Record<string, SerializedOverride>  // Snapshot de overrideStore
}
```

**Problema**: Las escenas se guardan en localStorage, NO en el showfile. Si el usuario cambia de navegador/reinstala, las escenas se pierden.

---

## 🎯 ESTRUCTURA DE UN FIXTURE PATCHEADO

### PatchedFixtureConfig (lo que se guarda en disco)
```typescript
interface PatchedFixtureConfig {
  id: string              // "fix_01", "fix_02"...
  name: string            // "ADJ Vizi Beam 5R"
  type: string            // "moving_head" | "par" | "strobe"
  manufacturer: string    // "ADJ"
  channelCount: number    // 16
  dmxAddress: number      // 1-512
  universe: number        // 0, 1, 2...
  zone: string            // "FRONT_PARS" | "MOVING_LEFT" | etc
  filePath: string        // Ruta al .fxt
}
```

### ⚠️ LO QUE NO SE GUARDA:
| Propiedad | Situación | Impacto |
|-----------|-----------|---------|
| `position.x, y, z` | NO EXISTE | Posición 3D generada algorítmicamente |
| `rotation.x, y, z` | NO EXISTE | Orientación calculada por zona |
| `invertPan/Tilt` | Existe pero NO persiste | Se pierde al reiniciar |
| `swapXY` | Existe pero NO persiste | Se pierde al reiniciar |
| `orientation` | Existe en código pero NO en config | Se resetea |
| `channels[]` | Se carga de .fxt en runtime | OK |
| `groups[]` | NO EXISTE | CRÍTICO |

---

## 📍 POSICIONES 3D: EL VACÍO

### Estado Actual: layoutGenerator3D.ts
**Ubicación**: `src/utils/layoutGenerator3D.ts`

Las posiciones 3D son **GENERADAS EN RUNTIME** basándose en la zona del fixture:

```typescript
const ZONE_DEFINITIONS = {
  FRONT_PARS: {
    heightFactor: 0.3,      // Y = 1.5m
    depthFactor: 0.8,       // Z = frente
    xRange: [-0.7, 0.7],    // X distribuido
    defaultPitch: -30       // Rotación calculada
  },
  MOVING_LEFT: {
    fixedX: -0.85,          // Siempre a la izquierda
    distributeVertical: true // En columna
  },
  // ... etc
}
```

**Flujo Actual**:
```
fixtures[] → generateLayout3D() → Fixture3DLayout[]
                  ↓
     Zone + orden → algoritmo → posición calculada
```

### Problema
El usuario **NO PUEDE** colocar un fixture donde quiera. El sistema decide la posición automáticamente.

### Solución Propuesta
```typescript
interface FixturePosition3D {
  x: number          // -1 a +1 (normalizado)
  y: number          // 0 a 1 (altura)
  z: number          // -1 a +1 (profundidad)
  rotation: {
    x: number        // Pitch (radianes)
    y: number        // Yaw (radianes)
    z: number        // Roll (radianes)
  }
  isManuallyPlaced: boolean  // Si el usuario lo movió
}
```

---

## 🗂️ ZONAS: AUTO-ASIGNACIÓN ACTUAL

### autoAssignZone() en main.ts
**Ubicación**: `electron/main.ts` líneas 95-130

```typescript
function autoAssignZone(fixtureType: string, fixtureName?: string): FixtureZone {
  const typeUpper = (fixtureType || '').toUpperCase()
  
  // Moving heads: alternando LEFT/RIGHT
  if (typeUpper.includes('MOVING') || typeUpper.includes('BEAM')) {
    const zone = zoneCounters.moving % 2 === 0 ? 'MOVING_LEFT' : 'MOVING_RIGHT'
    zoneCounters.moving++
    return zone
  }
  
  // PARs: alternando FRONT/BACK
  if (typeUpper.includes('PAR')) {
    const zone = zoneCounters.par % 2 === 0 ? 'BACK_PARS' : 'FRONT_PARS'
    zoneCounters.par++
    return zone
  }
  
  return 'UNASSIGNED'
}
```

### Zonas Existentes
| Zona | Propósito | Auto-asignación |
|------|-----------|-----------------|
| `FRONT_PARS` | PARs frontales | Par impares |
| `BACK_PARS` | PARs traseros | Par pares |
| `MOVING_LEFT` | Movers izquierda | Moving impares |
| `MOVING_RIGHT` | Movers derecha | Moving pares |
| `STROBES` | Estrobos | Por tipo |
| `LASERS` | Láseres | Por tipo |
| `UNASSIGNED` | Sin zona | Fallback |

### Problema
- Las zonas se calculan al patchear, NO se pueden editar después
- El orden de patcheo determina la posición (irreversible sin clear patch)
- No hay zonas personalizadas (DJ Booth, Stage Left, etc.)

### Solución Propuesta: ZoneManager
```typescript
interface Zone {
  id: string
  name: string
  color: string           // Para visualización
  position3D: Position3D  // Centro de la zona
  fixtures: string[]      // IDs de fixtures en esta zona
  type: 'front' | 'back' | 'side' | 'overhead' | 'floor' | 'custom'
}
```

---

## 👥 GRUPOS: NO EXISTEN

### Estado Actual
**CERO código de grupos en todo el proyecto.**

```bash
# Búsqueda realizada:
grep -r "group|Group|grupos" **/*Store*.ts
# Resultado: No matches found
```

### Impacto
- No se puede seleccionar "todos los movers" con un click
- No se puede asignar un efecto a "front line"
- No hay shortcuts de grupo (Ctrl+1 = seleccionar grupo 1)
- Pérdida de tiempo masiva para operadores profesionales

### Solución Propuesta: groupStore.ts
```typescript
interface FixtureGroup {
  id: string
  name: string
  shortcut?: number      // 1-9 para quick-select
  color: string
  fixtureIds: string[]   // Referencias a fixtures
  isLocked: boolean      // Evitar edición accidental
}

interface GroupState {
  groups: FixtureGroup[]
  createGroup: (name: string, fixtureIds: string[]) => void
  deleteGroup: (id: string) => void
  addToGroup: (groupId: string, fixtureId: string) => void
  removeFromGroup: (groupId: string, fixtureId: string) => void
  selectGroup: (id: string) => void
}
```

---

## 📦 SHOWFILE: ANÁLISIS DE DUPLICACIÓN

### Dos Sistemas que Hacen lo Mismo

| Característica | ConfigManager | ShowManager |
|----------------|---------------|-------------|
| Auto-save | ✅ Sí (debounce 1s) | ❌ No (manual) |
| Multi-show | ❌ No (1 config activa) | ✅ Sí (carpeta shows/) |
| Fixtures | ✅ patchedFixtures[] | ✅ patchedFixtures[] |
| DMX config | ✅ dmx{} | ✅ dmx{} |
| Audio config | ✅ audio{} | ✅ audio{} |
| Escenas | ❌ No | ❌ No (están en localStorage) |
| Grupos | ❌ No | ❌ No |
| Posiciones 3D | ❌ No | ❌ No |

### Veredicto: ELIMINAR ShowManager

ConfigManager es suficiente si se expande con:
- Soporte multi-show (carpeta shows/)
- Escenas integradas (sacar de localStorage)
- Grupos
- Posiciones 3D

---

## 🔧 PATCHEO ACTUAL: ANÁLISIS DE UX

### Flujo de Usuario Actual
```
1. Usuario abre Setup → Pestaña Patch
2. Click "Add Fixture"
3. Modal: seleccionar modelo de librería
4. Elegir cantidad, dirección inicial
5. Configurar orientación física (ceiling/floor)
6. Click "Confirm Patch"
7. Fixtures aparecen en tabla con zona AUTO-ASIGNADA
```

### Componentes Involucrados

| Componente | Líneas | Estado |
|------------|--------|--------|
| `SetupView/index.tsx` | 32 | Router de tabs |
| `tabs/PatchTab.tsx` | 762 | Lista de fixtures |
| `tabs/AddFixtureModal.tsx` | 237 | Modal de creación |
| `tabs/LibraryTab.tsx` | ~200 | Visor de .fxt |

### Funcionalidades de Edición (lux:edit-fixture)
```typescript
// IPCHandlers.ts línea 576
ipcMain.handle('lux:edit-fixture', (_event, data: {
  originalDmxAddress: number
  newDmxAddress: number
  universe?: number
  name?: string
  zone?: string             // ⚠️ Se puede editar
  physics?: {
    installationType?: string
    invert?: { pan?: boolean; tilt?: boolean }
    swapXY?: boolean
  }
}) => { ... })
```

### ⚠️ Problemas Detectados
1. **Zona editable pero NO GUARDADA**: El dropdown de zona existe en UI pero el cambio no persiste correctamente
2. **Physics no persiste**: invertPan, invertTilt, swapXY se pierden al reiniciar
3. **No hay reordenamiento**: Cambiar el orden de fixtures requiere borrar y re-patchear
4. **No hay duplicación**: No se puede clonar un fixture con su configuración

---

## 🔨 CREATE FIXTURE: ESTADO ACTUAL

### FXTParser.ts
**Ubicación**: `src/core/library/FXTParser.ts` (604 líneas)

Parsea archivos `.fxt` (FreeStyler format) con:
- Detección heurística de tipo (moving_head, par, etc.)
- Mapeo de nombres de canales a tipos (pan, tilt, dimmer, rgb...)
- Detección de 16-bit movement
- Confidence score

### FixtureEditorModal.tsx
**Ubicación**: `src/components/modals/FixtureEditor/`

Permite crear nuevos fixtures manualmente pero:
- ❌ No tiene vista previa visual
- ❌ No tiene drag & drop de canales
- ❌ No valida DMX footprint
- ❌ No genera .fxt compatible con FreeStyler

### Mejoras Propuestas para Fixture Editor
```
┌─────────────────────────────────────────────────────────────────┐
│ 🔧 FIXTURE FORGE - Professional Editor                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Manufacturer]  [Model Name]  [Type: Moving Head ▼]           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ CHANNEL MAP                                              │   │
│  │                                                          │   │
│  │  CH 1: [Pan Coarse ▼]      [8-bit]                      │   │
│  │  CH 2: [Pan Fine ▼]        [16-bit LSB]                 │   │
│  │  CH 3: [Tilt Coarse ▼]     [8-bit]                      │   │
│  │  CH 4: [Tilt Fine ▼]       [16-bit LSB]                 │   │
│  │  CH 5: [Dimmer ▼]          [8-bit]  [Master]            │   │
│  │  CH 6: [Red ▼]             [8-bit]                      │   │
│  │  CH 7: [Green ▼]           [8-bit]                      │   │
│  │  CH 8: [Blue ▼]            [8-bit]                      │   │
│  │                                                          │   │
│  │  [+ Add Channel]                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ MODES                                                    │   │
│  │  [Standard - 16ch]  [Compact - 8ch]  [+ Add Mode]       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 3D PREVIEW                                               │   │
│  │                                                          │   │
│  │        ╭───────────╮                                     │   │
│  │        │   🔦      │  ← Fixture visual                   │   │
│  │        ╰───────────╯                                     │   │
│  │                                                          │   │
│  │  Pan: ──●───── Tilt: ───●──── Dim: ────●──               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [Cancel]  [Save to Library]  [Export .fxt]                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 INICIALIZACIÓN: POR QUÉ HAY ESTADOS INCOHERENTES

### Flujo de Arranque Actual
```
app.whenReady()
    ↓
configManager.load()           ← Carga luxsync-config.json
    ↓
fxtParser.scanFolder()         ← Escanea /librerias/*.fxt
    ↓
patchedFixtures = savedConfig.patchedFixtures.map(f => ({
    ...f,
    zone: autoAssignZone(f.type, f.name)  ← ⚠️ RE-CALCULA ZONAS
}))
    ↓
createWindow()
    ↓
titanOrchestrator.setFixtures(hydratedFixtures)
    ↓
mainWindow.webContents.send('lux:fixtures-loaded', patchedFixtures)
```

### Problemas Detectados

#### 1. Zonas Re-calculadas al Iniciar
```javascript
// main.ts línea 322
patchedFixtures = savedConfig.patchedFixtures.map(f => ({
  ...f,
  zone: autoAssignZone(f.type, f.name)  // ⚠️ IGNORA zona guardada
}))
```

**Impacto**: Si el usuario editó la zona manualmente, al reiniciar se pierde.

#### 2. Counter de Zonas se Reinicia
```javascript
// main.ts línea 317
resetZoneCounters()  // ← Reinicia a 0
patchedFixtures = savedConfig.patchedFixtures.map(...) // ← Re-asigna
```

**Impacto**: El orden de zonas depende del orden en el array. Si el archivo JSON se modifica, las zonas cambian.

#### 3. Physics No Persiste
```javascript
// PatchedFixtureConfig NO incluye:
// - invertPan, invertTilt, swapXY
// - orientation (installationType se guarda globalmente, no por fixture)
```

**Impacto**: Configuración física se pierde al reiniciar.

### Solución: NO Re-calcular Zonas
```javascript
// PROPUESTO:
patchedFixtures = savedConfig.patchedFixtures.map(f => ({
  ...f,
  zone: f.zone || autoAssignZone(f.type, f.name)  // Preservar si existe
}))
```

---

## 🏗️ STAGE CONSTRUCTOR: PROPUESTA DE ARQUITECTURA

### Módulos del Stage Constructor

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          STAGE CONSTRUCTOR                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │  FIXTURE LIBRARY │  │   STAGE GRID     │  │  ZONE MANAGER    │          │
│  │                  │  │                  │  │                  │          │
│  │  - .fxt Browser  │  │  - 3D Canvas     │  │  - Zone List     │          │
│  │  - Fixture Forge │  │  - Drag & Drop   │  │  - Create Zone   │          │
│  │  - Import        │  │  - Multi-select  │  │  - Auto-assign   │          │
│  │  - Search        │  │  - Grid Snap     │  │  - Color coding  │          │
│  │                  │  │  - Rotate        │  │                  │          │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘          │
│           │                     │                     │                     │
│           └─────────────────────┼─────────────────────┘                     │
│                                 │                                           │
│                    ┌────────────▼────────────┐                              │
│                    │     GROUP MANAGER       │                              │
│                    │                         │                              │
│                    │  - Create from select   │                              │
│                    │  - Quick-select (1-9)   │                              │
│                    │  - Nested groups        │                              │
│                    └────────────┬────────────┘                              │
│                                 │                                           │
│                    ┌────────────▼────────────┐                              │
│                    │   UNIFIED SHOWFILE      │                              │
│                    │                         │                              │
│                    │  - Auto-save            │                              │
│                    │  - Fixtures + Positions │                              │
│                    │  - Zones + Groups       │                              │
│                    │  - Scenes (migradas)    │                              │
│                    └─────────────────────────┘                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ✅ DECISIONES DE DISEÑO

### 1. ¿Eliminar ShowManager?
**Decisión**: SÍ

ConfigManager se convierte en `StageManager` con:
- Soporte para múltiples escenarios (stages/)
- Todo en un solo JSON por escenario
- Escenas movidas de localStorage a showfile

### 2. ¿Extraer Patcheo del Setup?
**Decisión**: SÍ

El patcheo pasa a ser parte del Stage Constructor:
- Setup → Solo DMX/Audio config
- Stage Constructor → Fixtures, Posiciones, Zonas, Grupos

### 3. ¿Mantener Auto-assign de Zonas?
**Decisión**: SÍ, pero como opción

- Default: Auto-assign al patchear
- Override: Usuario puede editar y SE PERSISTE
- Al reiniciar: Respetar zona guardada

### 4. ¿Formato de Showfile?
**Decisión**: JSON expandido

```json
{
  "version": "2.0.0",
  "name": "Club Medusa Main Stage",
  "stage": {
    "width": 12,
    "depth": 8, 
    "height": 5
  },
  "fixtures": [
    {
      "id": "fix_01",
      "name": "ADJ Vizi Beam 5R",
      "dmxAddress": 1,
      "position": { "x": -0.5, "y": 0.8, "z": 0 },
      "rotation": { "x": -0.5, "y": 0, "z": 0 },
      "zone": "MOVING_LEFT",
      "groups": ["all_movers", "stage_left"],
      "physics": {
        "invertPan": false,
        "invertTilt": true,
        "swapXY": false
      }
    }
  ],
  "zones": [
    { "id": "MOVING_LEFT", "name": "Movers Izquierda", "color": "#ff0000" }
  ],
  "groups": [
    { "id": "all_movers", "name": "All Movers", "shortcut": 1 }
  ],
  "scenes": [
    { "id": "scene_001", "name": "Intro Blue", "overrides": {} }
  ]
}
```

---

## 📊 MATRIZ DE MIGRACIÓN

| Componente Actual | Estado | Acción | Prioridad |
|-------------------|--------|--------|-----------|
| ConfigManager | Funcional | Expandir a StageManager | 🔴 Alta |
| ShowManager | Duplicado | ELIMINAR | 🔴 Alta |
| SceneStore (localStorage) | Frágil | Migrar a showfile | 🔴 Alta |
| layoutGenerator3D | Algoritmo | Convertir a posiciones guardadas | 🔴 Alta |
| autoAssignZone() | Funcional | Hacer override-friendly | 🟡 Media |
| PatchTab.tsx | Funcional | Refactorizar para Stage Constructor | 🟡 Media |
| AddFixtureModal | Básico | Expandir a Fixture Forge | 🟡 Media |
| FXTParser | Funcional | Añadir export capability | 🟢 Baja |
| ZoneRouter (HAL) | Funcional | Sin cambios | ⚪ Ninguno |

---

## 🚀 ROADMAP - ACTUALIZADO WAVE 363

### Fase 1: Fundación (Persistencia) ✅ **COMPLETE - WAVE 360.1**
- [x] Crear nuevo `stageStore.ts` (Zustand unificado para Stage)
- [x] Crear `ShowFileV2.ts` con schema completo
- [x] Crear `ShowFileMigrator.ts` (migración silenciosa v1 → v2)
- [x] Añadir `position: {x,y,z}` (metros, 3D real)
- [x] Añadir `rotation: {pitch,yaw,roll}` (grados)
- [x] Añadir `physics: {motorType, maxAcceleration, maxVelocity, safetyCap, ...}`
- [x] Añadir `groups[]` a fixture schema
- [x] Schema: escenas migradas de localStorage a showfile
- [x] Zonas ahora son explícitas (no auto-calculadas al load)
- [x] ID generation determinístico (NO Math.random)
- [x] Barrel exports en `src/core/stage/index.ts`

**Archivos creados en WAVE 360.1:**
```
src/core/stage/ShowFileV2.ts      (600+ líneas) - Schema completo
src/core/stage/ShowFileMigrator.ts (400+ líneas) - Migración v1→v2
src/core/stage/index.ts           (barrel export)
src/stores/stageStore.ts          (550+ líneas) - Zustand unificado
```

### Fase 2: UI - Stage Grid ✅ **COMPLETE - WAVE 361**
- [x] Crear `StageGrid3D.tsx` con React Three Fiber + Drei
- [x] Implementar Grid infinito estilo Tron (color gris oscuro sutil)
- [x] OrbitControls (right-click rotate, scroll zoom)
- [x] Renderizar fixtures desde stageStore (posiciones REALES del JSON)
- [x] Click to select (integrado con selectionStore)
- [x] TransformControls (Gizmo) para mover fixtures
- [x] Persist position on drag end → stageStore.updateFixturePosition()
- [x] Crear `StageConstructorView.tsx` con layout 3 columnas
- [x] Sidebar izq: Fixture Library (lista de fixtures + grupos)
- [x] Sidebar der: Properties Panel (position, zone, physics, DMX)
- [x] Toolbar superior con Save/Open buttons
- [x] Añadir tab "CONSTRUCT" en Sidebar (PencilRuler icon)
- [x] Routing en ContentArea.tsx
- [x] CSS Dark Neon aesthetic

**Archivos creados en WAVE 361:**
```
src/components/views/StageConstructorView.tsx    (290+ líneas)
src/components/views/StageConstructorView.css    (470+ líneas)
src/components/views/StageConstructor/StageGrid3D.tsx (320+ líneas)
```

**Archivos modificados:**
```
src/stores/navigationStore.ts       - Added 'constructor' TabId
src/components/layout/Sidebar.tsx   - Added PencilRuler icon
src/components/layout/ContentArea.tsx - Added constructor case
```

### Fase 3: Grupos & Zonas ✅ **COMPLETE - WAVE 363**
- [x] GroupManagerPanel.tsx - Panel de gestión de grupos
- [x] Create group from selection (Ctrl+G)
- [x] Rename grupos con doble-click
- [x] Delete grupos
- [x] Asignar hotkeys 1-9 a grupos
- [x] Quick-select con teclas 1-9
- [x] ZoneOverlay.tsx - Visualización 3D de zonas
- [x] 9 zonas predefinidas con color-coding
- [x] Click en zona para asignar a fixtures seleccionados
- [x] Toggle zonas en toolbar (icono Map)
- [x] KeyboardShortcuts.ts - Sistema de atajos profesional
- [x] Tabs en sidebar derecho (Properties / Groups)
- [x] Dropdown de zona en Properties
- [x] Multi-select permite asignar zona a todos

**Archivos creados en WAVE 363:**
```
src/components/views/StageConstructor/GroupManagerPanel.tsx  (340+ líneas)
src/components/views/StageConstructor/GroupManagerPanel.css  (280+ líneas)
src/components/views/StageConstructor/ZoneOverlay.tsx        (230+ líneas)
src/components/views/StageConstructor/KeyboardShortcuts.ts   (220+ líneas)
```

**Archivos modificados:**
```
src/components/views/StageConstructorView.tsx  - Tabs, showZones, shortcuts
src/components/views/StageConstructorView.css  - Tabs styling, zone select
src/components/views/StageConstructor/StageGrid3D.tsx - ZoneOverlay integration
```

**Shortcuts implementados:**
| Shortcut | Acción |
|----------|--------|
| `1-9` | Seleccionar Grupo con hotkey |
| `Ctrl+G` | Crear grupo desde selección |
| `Escape` | Deseleccionar todo |
| `Delete` | Eliminar fixtures seleccionados |
| `Ctrl+A` | Seleccionar todos |
| `V` | Tool: Select |
| `B` | Tool: Box Selection |

### Fase 4: Fixture Forge ✅ **COMPLETE - WAVE 364**
- [x] FixtureForge.tsx - Modal principal con tabs
- [x] Channel Mapper UI - Drag & Drop con categorías
- [x] FixturePreview3D.tsx - Canvas 3D aislado con Pan/Tilt/Dimmer/RGB/Strobe
- [x] PhysicsTuner.tsx - Editor de física con motor types
- [x] Risk Level indicator (safe/moderate/high/extreme)
- [x] TEST DE ESTRÉS button - 3 segundos de stress test visual
- [x] Export a .fxt (FreeStyler format)
- [x] Import desde JSON
- [x] Integración con StageConstructorView ("Edit Profile" button)

**Archivos creados en WAVE 364:**
```
src/components/modals/FixtureEditor/FixtureForge.tsx      (540+ líneas)
src/components/modals/FixtureEditor/FixtureForge.css      (800+ líneas)
src/components/modals/FixtureEditor/FixturePreview3D.tsx  (300+ líneas)
src/components/modals/FixtureEditor/PhysicsTuner.tsx      (420+ líneas)
src/components/modals/FixtureEditor/index.ts              (barrel exports)
```

**Archivos modificados:**
```
src/components/views/StageConstructorView.tsx  - Forge modal, context, button
src/components/views/StageConstructorView.css  - Edit profile button styling
```

**Acceso al Forge:**
- Seleccionar fixture → Click "Edit Profile" en Properties panel

### Fase 5: Integración ✅ **IN PROGRESS - WAVE 365**
- [x] Crear `StagePersistence.ts` - API backend de persistencia
- [x] Crear `StageIPCHandlers.ts` - Handlers IPC para Stage
- [x] Canales IPC: load, save, saveAs, list, delete, recent
- [x] Escritura atómica (temp → rename)
- [x] Conectar stageStore a Electron IPC (preload API)
- [x] Auto-Save con debounce 2s
- [x] Recent shows tracking (últimos 10)
- [x] Flujo de migración al arranque
- [ ] Eliminar ShowManager (redundante) - Fase B
- [ ] Migrar ConfigManager a solo preferencias - Fase B
- [ ] Auto-migración transparente al cargar v1 - Fase B
- [ ] Tests E2E
- [ ] Importación desde QLC+, GrandMA

**Archivos creados en WAVE 365:**
```
src/core/stage/StagePersistence.ts    (420+ líneas) - API backend
src/core/stage/StageIPCHandlers.ts    (160+ líneas) - IPC handlers
```

**Archivos modificados:**
```
src/stores/stageStore.ts             - Conexión a IPC real (+80 líneas)
electron/preload.ts                  - API lux.stage.* (+50 líneas)
electron/main.ts                     - Init de StagePersistence
src/core/stage/index.ts              - Barrel exports
```

**IPC Channels:**
| Canal | Descripción |
|-------|-------------|
| `lux:stage:load` | Cargar show |
| `lux:stage:save` | Guardar show |
| `lux:stage:saveAs` | Save As... |
| `lux:stage:list` | Listar shows |
| `lux:stage:recent` | Shows recientes |
| `lux:stage:delete` | Eliminar show |

---

## 📝 CONCLUSIONES

### Lo que Funciona (No Tocar)
- ZoneRouter (HAL) - lógica de intensidades por zona
- FXTParser - parsing de fixtures
- TruthStore - arquitectura de estado
- TitanOrchestrator - core engine

### Lo que Necesita Refactor (Ampliar)
- ConfigManager → StageManager
- PatchTab → Stage Constructor UI
- AddFixtureModal → Fixture Forge

### Lo que Debe Morir (Eliminar)
- ShowManager (duplicación innecesaria)
- Escenas en localStorage
- Auto-assign forzado (debe ser override-able)
- layoutGenerator3D como única fuente (debe ser backup, no principal)

---

**Próximo Paso**: Esperar directiva para comenzar diseño detallado del Stage Constructor.

---

*"GrandMA3 cobra $10,000 por licencia. Nosotros vamos a darles una UX que los haga llorar... GRATIS."*  
— PunkOpus, 2026
