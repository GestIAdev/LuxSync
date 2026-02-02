# 🐛 WAVE 1116: LIBRARY IPC PATH FIX + DUPLICATE KEY FIX + DMX STATUS FIX

**Commit:** `cc9312c`  
**Status:** ✅ COMPLETE  
**Date:** 2025-02-XX  
**Doctrine:** *"Ver el Bug es Matarlo."*

---

## 📋 BUGS REPORTADOS (Post-WAVE 1115)

1. **0 system fixtures loaded** - IPC handler usaba path hardcoded incorrecto
2. **Duplicate key warning** - React warning sobre `key={fixture.id}` duplicado
3. **DMX offline** - Live Probe marca DMX desconectado aunque ArtNet funciona

---

## 🔧 CORRECCIONES IMPLEMENTADAS

### 1. IPC LIBRARY PATH FIX

**Problema:**  
El handler `lux:library:list-all` en IPCHandlers.ts tenía su propio path hardcoded:
```typescript
const factoryPath = isDev 
  ? path.join(__dirname, '../../../../librerias')  // WRONG!
  : path.join(app.getPath('userData'), 'librerias')
```

Esto NO usaba el PATHFINDER de main.ts que ya había resuelto el path correcto.

**Solución:**  
1. Añadí getters a `IPCDependencies`:
```typescript
export interface IPCDependencies {
  // ... existing ...
  getFactoryLibPath: () => string
  getCustomLibPath: () => string
}
```

2. En `main.ts`, paso los getters:
```typescript
const ipcDeps: IPCDependencies = {
  // ... existing ...
  getFactoryLibPath: () => factoryLibPath,
  getCustomLibPath: () => customLibPath,
}
```

3. En `IPCHandlers.ts`, uso los paths resueltos:
```typescript
ipcMain.handle('lux:library:list-all', async () => {
  // WAVE 1116 FIX: Use paths from PATHFINDER
  const factoryPath = getFactoryLibPath()
  const userPath = getCustomLibPath()
  
  console.log(`[Library IPC] 📂 Factory path: ${factoryPath}`)
  console.log(`[Library IPC] 📂 User path: ${userPath}`)
  
  // Scan files...
})
```

**Resultado:**
```
[Library IPC] 📂 Factory path: C:\LuxSync\librerias
[Library IPC] 📂 User path: C:\Users\...\AppData\Roaming\luxsync-electron\fixtures
[Library IPC] ✅ Loaded 16 system + 7 user fixtures
```

---

### 2. DUPLICATE KEY FIX

**Problema:**  
React warning:
```
Warning: Encountered two children with the same key, `944226ff-e66f-48db-a318-7bda149c9438`.
```

**Causa:**  
Si un fixture existe en AMBOS system y user con el mismo ID, React ve dos elementos con `key={fixture.id}`.

**Solución:**
```typescript
// BEFORE
<div key={fixture.id} ...>

// AFTER (WAVE 1116)
<div key={`${fixture.source}-${fixture.id}`} ...>
```

Ahora cada fixture tiene key única: `system-xyz` o `user-xyz`.

---

### 3. DMX STATUS FIX

**Problema:**  
Live Probe mostraba 🔴 DMX Offline aunque ArtNet estaba conectado.

**Causa:**  
El handler `lux:library:dmx-status` solo revisaba `universalDMX` (USB serial), NO revisaba `artNetDriver`.

**Solución:**
```typescript
ipcMain.handle('lux:library:dmx-status', () => {
  const { universalDMX, artNetDriver } = deps
  
  // Check USB DMX
  const usbConnected = universalDMX?.isConnected ?? false
  
  // Check ArtNet
  const artNetStatus = artNetDriver?.getStatus?.() || null
  const artNetConnected = artNetStatus?.connected ?? false
  
  // Return combined (connected if EITHER is active)
  const connected = usbConnected || artNetConnected
  const device = usbDevice || (artNetConnected ? 'ArtNet' : null)
  
  console.log(`[Library DMX Status] USB:${usbConnected} ArtNet:${artNetConnected} → ${connected}`)
  
  return { connected, device }
})
```

**Resultado:**
```
[Library DMX Status] USB:false ArtNet:true → true
```
Live Probe ahora muestra 🟢 cuando ArtNet está conectado.

---

## 📁 ARCHIVOS MODIFICADOS

| Archivo | Cambio | Líneas |
|---------|--------|--------|
| `IPCHandlers.ts` | Path getters + DMX ArtNet check | +15/-10 |
| `main.ts` | Pass getFactoryLibPath/getCustomLibPath | +3 |
| `LibraryTab.tsx` | Unique key with source prefix | +1/-1 |

**Total:** +19/-11 líneas

---

## 🧪 VERIFICACIÓN

### Test 1: System Fixtures Loaded
```bash
# Console frontend
[LibraryStore] ✅ Loaded 16 system + 7 user fixtures

# Console backend
[Library IPC] ✅ Loaded 16 system + 7 user fixtures
```

### Test 2: No Duplicate Key Warning
- Abrir Forge → Library
- Console NO debe mostrar "Encountered two children with the same key"

### Test 3: DMX Status Correct
- Abrir Forge → WheelSmith
- Indicador debe mostrar 🟢 CONNECTED (si ArtNet configurado)
- Console backend:
```
[Library DMX Status] USB:false ArtNet:true → true
```

---

## 🎯 RESULTADO

✅ **16 system fixtures cargados correctamente**  
✅ **0 React duplicate key warnings**  
✅ **Live Probe muestra DMX conectado (ArtNet)**

---

**🎸 WAVE 1116 COMPLETADA**

*"Tres bugs, un commit. Eficiencia punk."*  
— PunkOpus
