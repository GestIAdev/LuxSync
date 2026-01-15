# WAVE 438.1 - FIX: IPC LISTENER INITIALIZATION

## 🐛 PROBLEMA DETECTADO

El show se cargaba en el backend pero NO se actualizaba en el frontend:

```
✅ [ActiveSession] Show loaded: C:\...\10fixxturesREAL.v2.luxshow
```

Pero el card de Active Session permanecía sin cambios.

---

## 🔍 DIAGNÓSTICO

1. **Backend IPC Handler:** ✅ Funcionando correctamente
   - `ipcMain.handle('lux:stage:openDialog')` → OK
   - `stagePersistence.loadShow()` → OK
   - `mainWindow.webContents.send('lux:stage:loaded')` → OK

2. **StageStore Listener:** ⚠️ Definido pero NO inicializado
   - Función `setupStageStoreListeners()` existía
   - Listener `lux.stage.onLoaded()` configurado
   - **PERO nunca se llamaba a `setupStageStoreListeners()`**

3. **Resultado:** El evento IPC se emitía pero nadie lo escuchaba

---

## ✅ SOLUCIÓN APLICADA

### Inicializar listeners en `AppCommander.tsx`:

```tsx
// AppCommander.tsx
import { setupStageStoreListeners } from './stores/stageStore'

function AppContent() {
  useEffect(() => {
    // 🔌 WAVE 438: Setup stageStore IPC listeners
    const unsubscribeStageListeners = setupStageStoreListeners()
    
    console.log('[Selene UI] 🚀 System Ready')
    
    // Cleanup on unmount
    return () => {
      unsubscribeStageListeners()
    }
  }, [])
  
  return <MainLayout />
}
```

### El listener en stageStore.ts:

```typescript
export function setupStageStoreListeners(): () => void {
  const lux = (window as any).lux
  
  const unsubscribe = lux.stage.onLoaded((data: { 
    showFile: ShowFileV2
    migrated?: boolean
  }) => {
    console.log('[stageStore] 📨 Received show:', data.showFile.name)
    
    // Update store
    useStageStore.setState({
      showFile: data.showFile,
      showFilePath: 'active',
      isLoading: false,
      isDirty: false
    })
    
    // Sync derived state (fixtures, groups, scenes)
    useStageStore.getState()._syncDerivedState()
  })
  
  return unsubscribe
}
```

---

## 🔄 FLUJO COMPLETO (FIXED)

```
User → LOAD SHOW
     ↓
window.lux.stage.openDialog()
     ↓
Native file dialog opens
     ↓
User selects "10fixxturesREAL.v2.luxshow"
     ↓
Backend: stagePersistence.loadShow()
     ↓
Backend broadcasts: 'lux:stage:loaded'
     ↓
✨ setupStageStoreListeners() RECEIVES EVENT
     ↓
useStageStore.setState({ showFile })
     ↓
_syncDerivedState() updates fixtures/groups/scenes
     ↓
React re-renders all subscribers
     ↓
ActiveSession card shows:
   - Name: "10-fixtures.v2"
   - Fixtures: 10 fixtures
   - Date: 15/1/2026
```

---

## ARCHIVOS MODIFICADOS

```
electron-app/src/
└── AppCommander.tsx
    ├── Import setupStageStoreListeners
    ├── Call it in useEffect
    └── Cleanup on unmount
```

---

## ✅ VALIDACIÓN

**ANTES:**
- Backend carga el show ✅
- Backend emite evento ✅
- Frontend NO escucha ❌
- UI NO actualiza ❌

**DESPUÉS:**
- Backend carga el show ✅
- Backend emite evento ✅
- Frontend escucha evento ✅
- UI actualiza reactivamente ✅

---

*WAVE 438.1 - Critical Fix Applied*  
*IPC listeners initialized → Reactive updates working*
