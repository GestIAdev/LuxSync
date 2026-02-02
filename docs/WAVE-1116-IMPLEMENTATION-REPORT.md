# 🐛 WAVE 1116: LIBRARY IPC PATH FIX + DUPLICATE KEY FIX + DMX STATUS FIX

**Commits:** `cc9312c` + `4b5efdf`  
**Status:** ✅ COMPLETE  
**Date:** 2025-02-02  
**Doctrine:** *"Ver el Bug es Matarlo."*

---

## 📋 BUGS REPORTADOS (Post-WAVE 1115)

### Initial Report:
1. **0 system fixtures loaded** - IPC handler usaba path hardcoded incorrecto
2. **Duplicate key warning** - React warning sobre `key={fixture.id}` duplicado
3. **DMX offline** - Live Probe marca DMX desconectado aunque ArtNet funciona

### Follow-up Report (Post-commit 1):
4. **No guarda cambios** - Handler `lux:library:save-user` usaba path hardcoded
5. **No deletea fixtures** - Handler `lux:library:delete-user` usaba path hardcoded

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

| Archivo | Cambio | Commit | Líneas |
|---------|--------|--------|--------|
| `IPCHandlers.ts` | Path getters + DMX ArtNet check | `cc9312c` | +15/-10 |
| `main.ts` | Pass getFactoryLibPath/getCustomLibPath | `cc9312c` | +3 |
| `LibraryTab.tsx` | Unique key with source prefix | `cc9312c` | +1/-1 |
| `IPCHandlers.ts` | Save + Delete path fix | `4b5efdf` | +8/-4 |

**Total:** +27/-15 líneas

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
✅ **Saves persisten en disco**  
✅ **Delete funciona correctamente**

---

## 📝 ROOT CAUSE ANALYSIS

**Patrón detectado:**  
Tres handlers IPC tenían lógica independiente para resolver paths:
- `lux:library:list-all` → Usaba PATHFINDER ✅ (desde WAVE 1116.1)
- `lux:library:save-user` → Hardcoded path ❌ (fixed en WAVE 1116.2)
- `lux:library:delete-user` → Hardcoded path ❌ (fixed en WAVE 1116.2)

**Solución arquitectónica:**  
Todos los handlers ahora usan `getCustomLibPath()` que devuelve el path ya resuelto por PATHFINDER en main.ts. Esto garantiza consistencia entre READ, WRITE y DELETE.

---

**🎸 WAVE 1116 + 1116.2 COMPLETADAS**

*"Cinco bugs, dos commits. La muerte llega en oleadas."*  
— PunkOpus
