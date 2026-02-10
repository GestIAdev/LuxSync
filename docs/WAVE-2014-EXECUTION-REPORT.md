# 🧠 WAVE 2014 - THE MEMORY CORE: Execution Report

## 📋 WAVE Directive

> **WAVE 2014: THE MEMORY CORE**
> Implementar Sistema de Guardado/Carga y Formato de Archivo .lux

---

## 🎯 Mission Summary

Implementar persistencia completa de proyectos Chronos con formato de archivo `.lux`, integración nativa con Electron (diálogos nativos de guardar/abrir), detección de cambios no guardados, y shortcuts de teclado profesionales.

---

## ✅ Completed Tasks

### 1. 📦 LuxProject Format (`ChronosProject.ts`)

Definición completa del formato `.lux`:

```typescript
interface LuxProjectFile {
  luxsync: 'CHRONOS'
  version: '2.0'
  meta: LuxMeta
  audio: LuxAudio | null
  timeline: LuxTimeline
  library: LuxLibrary
}
```

**Secciones del archivo:**
- `meta`: Nombre, creador, timestamps, duración
- `audio`: Archivo de audio, BPM, offset, duración
- `timeline`: Clips serializados, tracks, zoom, scroll
- `library`: Vibes/FX personalizados (futuro)

**Funciones implementadas:**
- `serializeProject()` - Convierte proyecto a JSON
- `deserializeProject()` - JSON a proyecto
- `validateProject()` - Validación con lista de errores
- `createEmptyProject()` - Template para nuevo proyecto
- `createProjectFromState()` - Estado actual a proyecto

---

### 2. 💾 ChronosStore (State Manager)

Singleton para gestión del estado del proyecto:

```typescript
class ChronosStore {
  // Getters
  get currentProject(): LuxProject
  get currentPath(): string | null
  get hasUnsavedChanges(): boolean
  get projectName(): string
  get windowTitle(): string
  
  // Actions
  newProject(name: string): void
  updateFromSession(clips, audio, playheadMs): void
  markDirty(): void
  save(forceNewPath?: boolean): Promise<SaveResult>
  load(filePath?: string): Promise<LoadResult>
}
```

**Features:**
- Event system (project-new, project-loaded, project-saved, project-modified, audio-missing)
- Dirty state tracking (JSON diff contra último guardado)
- Browser fallback (download/file input) para desarrollo sin Electron
- Audio path validation

---

### 3. 📡 Electron IPC Handlers (`ChronosIPCHandlers.ts`)

Handlers añadidos al sistema IPC existente:

| Handler | Función |
|---------|---------|
| `chronos:save-project` | Diálogo nativo Save, escribe .lux |
| `chronos:load-project` | Diálogo nativo Open, lee .lux |
| `chronos:check-file-exists` | Valida path de audio |
| `chronos:browse-audio` | Diálogo para seleccionar audio |

**Dialog filters:**
```typescript
{
  name: 'LuxSync Project',
  extensions: ['lux']
}
```

---

### 4. 🌉 Preload Bridge (`preload.ts`)

API expuesta a renderer:

```typescript
window.luxsync.chronos = {
  // Existing: analyzeAudio, onProgress, onComplete, onError
  
  // WAVE 2014: Project Persistence
  saveProject: (request) => ipcRenderer.invoke('chronos:save-project', request),
  loadProject: (request) => ipcRenderer.invoke('chronos:load-project', request),
  checkFileExists: (filePath) => ipcRenderer.invoke('chronos:check-file-exists', filePath),
  browseAudio: () => ipcRenderer.invoke('chronos:browse-audio'),
}
```

---

### 5. ⚛️ React Hook (`useChronosProject.ts`)

Hook completo para UI:

```typescript
function useChronosProject(): {
  // State
  projectName: string
  hasUnsavedChanges: boolean
  isLoading: boolean
  lastError: string | null
  project: LuxProject | null
  
  // Actions
  save: () => Promise<SaveResult>
  saveAs: () => Promise<SaveResult>
  load: () => Promise<LoadResult>
  newProject: () => void
  markDirty: () => void
  updateFromSession: (clips, audio, playheadMs) => void
}
```

**Keyboard Shortcuts:**
- `Ctrl+S` → Save
- `Ctrl+Shift+S` → Save As
- `Ctrl+O` → Open
- `Ctrl+N` → New Project

**Safety Features:**
- `beforeunload` warning cuando hay cambios no guardados
- Confirmación antes de New/Open con cambios pendientes

---

### 6. 🎛️ TransportBar UI Updates

**Nuevos botones:**
- 📄 New Project
- 📂 Open Project  
- 💾 Save Project (con indicador de cambios •)

**Nuevas props:**
```typescript
interface TransportBarProps {
  // ... existing ...
  projectName?: string
  hasUnsavedChanges?: boolean
  onSaveProject?: () => void
  onLoadProject?: () => void
  onNewProject?: () => void
}
```

**CSS añadido:**
- `.transport-project` container
- `.project-btn` con estados hover/active
- `.dirty-indicator` (punto naranja pulsante)
- Animación `pulse-save` para unsaved state

---

### 7. 🔗 ChronosLayout Integration

**Conexiones:**
- Hook `useChronosProject()` inicializado
- Sync automático clips → project store
- TransportBar recibe todas las props de proyecto
- markDirty() en cambios de clips

---

## 📁 Files Created/Modified

### Created:
1. `chronos/core/ChronosProject.ts` - Formato .lux y serialización
2. `chronos/core/ChronosStore.ts` - State manager singleton
3. `chronos/hooks/useChronosProject.ts` - React hook

### Modified:
4. `electron/ipc/ChronosIPCHandlers.ts` - IPC handlers save/load
5. `electron/preload.ts` - API bridge chronos.saveProject/loadProject
6. `chronos/ui/transport/TransportBar.tsx` - Props proyecto
7. `chronos/ui/transport/TransportBar.css` - Estilos botones proyecto
8. `chronos/ui/ChronosLayout.tsx` - Integración hook y sync

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                               │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  TransportBar: [📄] [📂] [💾•] │ Project Name • │ ...        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              useChronosProject Hook                           │   │
│  │  - Keyboard shortcuts (Ctrl+S/O/N)                           │   │
│  │  - beforeunload warning                                       │   │
│  │  - Event subscriptions                                        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              ChronosStore (Singleton)                         │   │
│  │  - Project state                                              │   │
│  │  - Dirty tracking                                             │   │
│  │  - Serialize/Deserialize                                      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼ IPC                                   │
├─────────────────────────────────────────────────────────────────────┤
│                       ELECTRON MAIN                                  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              ChronosIPCHandlers                               │   │
│  │  - chronos:save-project → dialog.showSaveDialog()            │   │
│  │  - chronos:load-project → dialog.showOpenDialog()            │   │
│  │  - fs.promises.writeFile() / readFile()                      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              FILE SYSTEM                                      │   │
│  │              *.lux (JSON)                                     │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📊 .lux File Format Example

```json
{
  "luxsync": "CHRONOS",
  "version": "2.0",
  "meta": {
    "name": "My Amazing Show",
    "createdAt": "2026-02-09T12:00:00.000Z",
    "modifiedAt": "2026-02-09T14:30:00.000Z",
    "author": "Radwulf",
    "durationMs": 240000
  },
  "audio": {
    "name": "track.mp3",
    "path": "C:/Music/track.mp3",
    "bpm": 128,
    "offsetMs": 0,
    "durationMs": 240000
  },
  "timeline": {
    "clips": [
      {
        "id": "clip-001",
        "type": "vibe",
        "trackId": "vibe",
        "startMs": 0,
        "endMs": 8000,
        "label": "STROBE",
        "color": "#FF6B35",
        "locked": false,
        "vibeType": "strobe",
        "intensity": 1.0,
        "fadeInMs": 500,
        "fadeOutMs": 500
      }
    ],
    "playheadMs": 0,
    "zoom": 100,
    "scrollLeft": 0
  },
  "library": {
    "customVibes": [],
    "customFx": []
  }
}
```

---

## 🔐 Safety Features

| Feature | Implementation |
|---------|----------------|
| Unsaved indicator | Punto • pulsante en botón Save |
| Window close warning | `beforeunload` event |
| New/Open confirmation | `window.confirm()` antes de descartar |
| File overwrite | Dialog con `showOverwriteConfirmation` |
| Audio missing | Evento `audio-missing` + browse dialog |

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save project |
| `Ctrl+Shift+S` | Save As (new file) |
| `Ctrl+O` | Open project |
| `Ctrl+N` | New project |

---

## 🧪 Test Scenarios

1. **New Project** → Crear vacío → Nombre "Untitled Project"
2. **Add Clips** → Save → Archivo .lux válido
3. **Modify** → Indicador • aparece
4. **Ctrl+S** → Diálogo Save si es nuevo, silent save si existe
5. **Close con cambios** → Warning beforeunload
6. **Open .lux** → Restaura clips, audio path, BPM
7. **Audio missing** → Diálogo para seleccionar nuevo path
8. **Browser fallback** → Download/File input funciona sin Electron

---

## 📝 Notes

- El formato `.lux` es JSON legible para debugging
- Compatible con versiones futuras (version field)
- Audio no se embebe (solo path), mantiene archivos pequeños
- Library section preparada para custom effects (WAVE futura)

---

## 🔗 Dependencies

- Reutiliza el sistema IPC de `ChronosIPCHandlers.ts`
- Extiende la API `window.luxsync.chronos` existente
- No requiere nuevas dependencias npm

---

**WAVE 2014: THE MEMORY CORE - COMPLETE** 💾✨

*"Lo que se graba, permanece. Lo que permanece, inspira."*
