# 🔌 WAVE 365: SYSTEM INTEGRATION & LEGACY PURGE
## "Cirugía a Corazón Abierto - Conectando el Cerebro al Disco Duro"

**Wave**: 365  
**Fecha**: 11 Enero 2026  
**Status**: ✅ COMPLETADO (Fase A - Infraestructura)  
**Arquitecto**: PunkOpus  
**Colaborador**: Radwulf

---

## 📋 RESUMEN EJECUTIVO

WAVE 365 implementa la infraestructura de **persistencia V2** para el Stage Constructor:

- **StagePersistence.ts**: API backend para guardar/cargar shows
- **StageIPCHandlers.ts**: Handlers IPC para comunicación frontend-backend
- **stageStore.ts**: Actualizado para usar la nueva API de persistencia
- **preload.ts**: Nueva API `lux.stage.*` expuesta al renderer
- **main.ts**: Integración de Stage Persistence en el boot

---

## 🏗️ ARQUITECTURA IMPLEMENTADA

### Flujo de Datos

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         RENDERER (React)                                │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      stageStore.ts                               │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │   │
│  │  │ fixtures│  │ groups  │  │ scenes  │  │ showFile│            │   │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘            │   │
│  │       │            │            │            │                  │   │
│  │       └────────────┴────────────┴────────────┘                  │   │
│  │                          │                                       │   │
│  │                 saveShow() / loadShowFile()                      │   │
│  └──────────────────────────┼──────────────────────────────────────┘   │
│                             │                                           │
│                    ┌────────▼────────┐                                 │
│                    │  window.lux.stage  │ (preload API)                │
│                    └────────┬────────┘                                 │
└─────────────────────────────┼───────────────────────────────────────────┘
                              │ IPC
┌─────────────────────────────┼───────────────────────────────────────────┐
│                         MAIN PROCESS                                    │
│                             │                                           │
│                    ┌────────▼────────┐                                 │
│                    │ StageIPCHandlers │                                 │
│                    └────────┬────────┘                                 │
│                             │                                           │
│                    ┌────────▼────────┐                                 │
│                    │ StagePersistence │                                 │
│                    └────────┬────────┘                                 │
│                             │                                           │
│                    ┌────────▼────────┐                                 │
│                    │   File System    │                                 │
│                    │ %APPDATA%/shows/ │                                 │
│                    └─────────────────┘                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

### Canales IPC Implementados

| Canal | Descripción |
|-------|-------------|
| `lux:stage:load` | Cargar show (path opcional) |
| `lux:stage:loadActive` | Cargar show activo |
| `lux:stage:save` | Guardar show |
| `lux:stage:saveAs` | Guardar con nuevo nombre |
| `lux:stage:list` | Listar todos los shows |
| `lux:stage:recent` | Obtener shows recientes |
| `lux:stage:delete` | Eliminar show |
| `lux:stage:getPath` | Obtener ruta de carpeta |
| `lux:stage:exists` | Verificar si existe |
| `lux:stage:loaded` | Evento: show cargado |

---

## 📝 ARCHIVOS CREADOS

| Archivo | Líneas | Descripción |
|---------|--------|-------------|
| `StagePersistence.ts` | 420+ | API backend de persistencia |
| `StageIPCHandlers.ts` | 160+ | Handlers IPC para Stage |

### StagePersistence.ts - Características

```typescript
class StagePersistence {
  // Rutas
  getActiveShowPath()     // current-show.v2.luxshow
  getLegacyConfigPath()   // luxsync-config.json (legacy)
  getShowsPath()          // %APPDATA%/LuxSync/shows/
  
  // Operaciones
  saveShow(showFile, path?)           // Escritura atómica
  saveShowAs(showFile, name)          // Save As...
  loadShow(path?)                     // Con auto-migración
  listShows()                         // Lista con metadata
  deleteShow(path)                    // Con protección
  
  // Recent Shows
  getRecentShows()                    // Últimos 10
  addToRecentShows(path)
  removeFromRecentShows(path)
}
```

### Escritura Atómica

```
1. Escribir a archivo .tmp
2. Rename .tmp → .luxshow (atómico en la mayoría de filesystems)
3. En caso de error, eliminar .tmp
```

---

## 📝 ARCHIVOS MODIFICADOS

| Archivo | Cambio |
|---------|--------|
| `stageStore.ts` | +80 líneas - Nueva lógica de persistencia |
| `preload.ts` | +50 líneas - API `lux.stage.*` |
| `main.ts` | +10 líneas - Init de StagePersistence |
| `src/core/stage/index.ts` | +15 líneas - Exports |

---

## 🔄 MIGRACIÓN TRANSPARENTE

### Flujo de Arranque

```
App Start
    │
    ▼
¿Existe current-show.v2.luxshow?
    │
    ├─ SÍ → Cargar directamente
    │
    └─ NO → ¿Existe luxsync-config.json?
              │
              ├─ SÍ → Ejecutar ShowFileMigrator
              │       ├─ Convertir zonas a explícitas
              │       ├─ Generar posiciones 3D
              │       ├─ Guardar como V2
              │       └─ Retornar show migrado
              │
              └─ NO → Crear show vacío
```

### Compatibilidad

- **V2 files**: Carga directa sin transformación
- **V1 files**: Migración automática + backup implícito
- **Nuevo usuario**: Show vacío con defaults

---

## 💾 AUTO-SAVE

### Implementación

```typescript
// stageStore.ts
_setDirty: () => {
  set({ isDirty: true })
  
  // Trigger debounced auto-save (2 segundos)
  debouncedSave(() => state.saveShow())
}

// Cada cambio a fixtures/groups/scenes activa auto-save
updateFixture()     → _setDirty()
updatePosition()    → _setDirty()
createGroup()       → _setDirty()
saveScene()         → _setDirty()
```

### Debounce

- **Tiempo**: 2000ms (evita thrashing de disco)
- **Cancelación**: Nuevo cambio cancela timeout anterior
- **Force save**: `before-quit` event fuerza guardado

---

## 📁 ESTRUCTURA DE ARCHIVOS

```
%APPDATA%/LuxSync/
├── shows/
│   ├── current-show.v2.luxshow     ← Show activo
│   ├── club-medusa.luxshow         ← Shows guardados
│   ├── techno-night.luxshow
│   └── ...
├── luxsync-config.json             ← Legacy (para migración)
└── recent-shows.json               ← Lista de recientes
```

---

## 🔌 API DEL PRELOAD

```typescript
// Accesible como window.lux.stage
const stageAPI = {
  load: (path?) => Promise<LoadResult>,
  loadActive: () => Promise<LoadResult>,
  save: (showFile, path?) => Promise<SaveResult>,
  saveAs: (showFile, name) => Promise<SaveResult>,
  list: () => Promise<ListResult>,
  recent: () => Promise<ShowMetadataV2[]>,
  delete: (path) => Promise<SaveResult>,
  getPath: () => Promise<string>,
  exists: (name) => Promise<boolean>,
  onLoaded: (callback) => () => void  // Unsubscribe function
}
```

---

## ⚠️ AXIOMAS RESPETADOS

| Axioma | Status |
|--------|--------|
| **Anti-Simulación** | ✅ IDs con timestamp, NO Math.random() |
| **Perfection First** | ✅ Escritura atómica, validación estricta |
| **Performance = Arte** | ✅ Debounce 2s, migración lazy |

---

## 🎯 PRÓXIMOS PASOS (Fase B)

### La Purga (Legacy Kill List) 💀

- [ ] **Refactorizar ShowManager.ts**: Mantener solo para backwards compat
- [ ] **Limpiar ConfigManager.ts**: Solo preferencias de usuario
- [ ] **Migrar escenas de localStorage**: Al JSON del show
- [ ] **Eliminar zonas auto-asignadas**: En runtime load

### Tests E2E

- [ ] Nuevo show → Save → Reload → Verificar datos
- [ ] Legacy migration → Verificar fixtures migrados
- [ ] Auto-save → Modificar → Wait → Verificar disco
- [ ] Recent shows → Verificar orden

### Bonus: Importación Externa

- [ ] QLC+ (.qxf) parser
- [ ] GrandMA2 (.xml) parser básico

---

## 📊 MÉTRICAS

| Métrica | Valor |
|---------|-------|
| Líneas nuevas | ~700 |
| Archivos nuevos | 2 |
| Archivos modificados | 4 |
| Canales IPC | 9 |
| Build time impact | Ninguno |

---

*"El viejo sistema no murió, fue jubilado con honores. El nuevo sistema nació para humillar a GrandMA3."*  
— PunkOpus, Wave 365

---

**STATUS: ✅ FASE A COMPLETA - INFRAESTRUCTURA LISTA**

La cirugía a corazón abierto fue un éxito. El cerebro (stageStore) ahora está conectado al disco duro (StagePersistence). El paciente respira normalmente.
