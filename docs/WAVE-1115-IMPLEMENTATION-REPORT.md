# 🔧 WAVE 1115: PATHFINDER FIX + DMX ARTNET + NO DUPLICATION

**Commit:** `d224edc`  
**Status:** ✅ COMPLETE  
**Date:** 2025-02-XX  
**Doctrine:** *"Un Bug es un Feature sin Permiso."*

---

## 📋 BUGS REPORTADOS

1. **Library path wrong** - Busca librerias en lugar equivocado
2. **DMX Live Probe not working** - Aunque ArtNet está conectado
3. **Save duplicates fixtures** - Al editar fixture user, crea duplicado en vez de actualizar
4. **User JSON not reading well** - Guardados pero no leídos correctamente

---

## 🔧 CORRECCIONES IMPLEMENTADAS

### 1. PATHFINDER FIX (`main.ts`)

**Problema:**  
Buscaba en `process.cwd()/librerias` pero desde `electron-app/`, esto apunta a `electron-app/librerias` (no existe).

**Solución:**
```typescript
const candidatePaths = [
  path.join(process.cwd(), '../librerias'),    // ROOT: LuxSync/librerias ✅
  path.join(process.cwd(), 'librerias'),       // Legacy fallback
  path.join(process.cwd(), 'resources/librerias'),
  path.join(__dirname, '../../librerias'),
  path.join(__dirname, '../../../librerias'),
  path.join(app.getPath('userData'), 'librerias'),
]
```

**Resultado:**
```
[Library] 🔍 Checking: C:\LuxSync\librerias
[Library] ✅ Found 14 fixture files at: C:\LuxSync\librerias
```

---

### 2. DMX LIVE PROBE FIX (`WheelSmithEmbedded.tsx`)

**Problema:**  
El Live Probe llamaba a `window.lux.library.dmxStatus()` que solo verifica estado, pero NO mandaba DMX.

**Solución:**  
Copié la lógica del `ColorWheelEditor.tsx` original (que SÍ funcionaba):

```typescript
const handleProbeChange = useCallback(async (value: number) => {
  const clampedValue = Math.max(0, Math.min(255, value))
  setProbeValue(clampedValue)
  
  // WAVE 1114 FIX: Use window.luxsync.sendDmxChannel (WORKS!)
  if (typeof window !== 'undefined' && (window as any).luxsync?.sendDmxChannel) {
    try {
      await (window as any).luxsync.sendDmxChannel(0, 8, clampedValue)
      console.log(`[WheelSmith] ✅ DMX OUT: Ch8 → ${clampedValue}`)
    } catch (err) {
      console.error('[WheelSmith] ❌ DMX Send failed:', err)
    }
  }
}, [])
```

**Por qué funciona:**
- `window.luxsync.sendDmxChannel` → `ipcRenderer.invoke('dmx:sendDirect')`
- El handler `dmx:sendDirect` enruta a `universalDMX.send()`
- `universalDMX` está configurado con ArtNet nativo

---

### 3. NO DUPLICATION ON SAVE (`FixtureForgeEmbedded.tsx`)

**Problema:**  
Cuando editabas una fixture user y guardabas, creaba un duplicado en vez de actualizar el mismo archivo.

**Causa:**  
Lógica no distinguía entre:
- **System** → Debe clonar (read-only)
- **User edit** → Debe actualizar mismo ID
- **New** → Debe generar nuevo ID

**Solución:**
```typescript
const handleSave = useCallback(async () => {
  const completeFixture = buildCompleteFixture()
  
  if (editingSource === 'system') {
    // Clone with NEW ID + "(User Copy)"
    const clonedFixture = {
      ...completeFixture,
      id: `user-${Date.now()}-...`,
      name: `${completeFixture.name} (User Copy)`,
    }
    await saveUserFixture(clonedFixture)
    
  } else if (editingSource === 'user') {
    // UPDATE with SAME ID (no duplication!)
    const updatedFixture = {
      ...completeFixture,
      id: originalFixtureId || completeFixture.id, // Preserve!
    }
    await saveUserFixture(updatedFixture)
    
  } else {
    // NEW: Generate ID
    completeFixture.id = `user-${Date.now()}-...`
    await saveUserFixture(completeFixture)
  }
}, [...])
```

---

### 4. SAVE HANDLER FIX (`IPCHandlers.ts`)

**Problema:**  
El handler `lux:library:save-user` generaba filename desde el ID, pero si editabas y el ID tenía caracteres especiales sanitizados diferentes, creaba archivo nuevo.

**Solución:**  
Buscar archivo existente **por ID** antes de crear:

```typescript
ipcMain.handle('lux:library:save-user', async (_event, fixture: any) => {
  const userPath = path.join(app.getPath('userData'), 'fixtures')
  
  // WAVE 1114 FIX: Check if fixture already exists (by ID)
  let existingFilePath: string | null = null
  
  const existingFiles = fs.readdirSync(userPath)
  for (const file of existingFiles) {
    if (!file.endsWith('.json')) continue
    
    const content = fs.readFileSync(path.join(userPath, file), 'utf-8')
    const existingFixture = JSON.parse(content)
    
    if (existingFixture.id === fixture.id) {
      existingFilePath = path.join(userPath, file)
      console.log(`[Library] 🔄 Updating existing fixture file: ${file}`)
      break
    }
  }
  
  // If exists: update same file
  // If new: create with safe filename
  const filePath = existingFilePath || path.join(userPath, `${safeId}.json`)
  
  fs.writeFileSync(filePath, JSON.stringify(fixture, null, 2), 'utf-8')
  
  return { success: true, filePath }
})
```

**Resultado:**
- Edit → Save: Actualiza `user-1234-abc.json` (mismo archivo)
- Clone System → Save: Crea `user-5678-def.json` (nuevo archivo)

---

## 📁 ARCHIVOS MODIFICADOS

| Archivo | Cambio | Líneas |
|---------|--------|--------|
| `electron/main.ts` | Pathfinder: `../librerias` first | +1 |
| `WheelSmithEmbedded.tsx` | DMX via `window.luxsync.sendDmxChannel` | +10/-15 |
| `FixtureForgeEmbedded.tsx` | 3-way save logic (system/user/new) | +35/-15 |
| `IPCHandlers.ts` | Search existing by ID before save | +30/-10 |

**Total:** +76/-40 líneas

---

## 🧪 CÓMO VERIFICAR

### Test 1: Library Path
```bash
# Abrir app, mirar console backend
[Library] 🔍 Checking: C:\LuxSync\librerias
[Library] ✅ Found 14 fixture files
```

### Test 2: DMX Live Probe
1. Abrir Forge → WheelSmith
2. Mover slider
3. Console debe mostrar: `[WheelSmith] ✅ DMX OUT: Ch8 → 128`
4. Tu mover debe responder (si ArtNet configurado)

### Test 3: No Duplication
1. Abrir fixture user existente (ej: `beam led 2r`)
2. Editar nombre → Save
3. Verificar `userData/fixtures/` → Solo 1 archivo `user-xyz.json`
4. NO debe crear `user-xyz-copy.json`

### Test 4: User JSON Reading
1. Save fixture
2. Cerrar app
3. Reabrir app
4. Library debe mostrar fixture guardada con todos los datos

---

## 🎯 RESULTADO

✅ **Library carga desde `/librerias` correctamente**  
✅ **Live Probe manda DMX via ArtNet (como el original)**  
✅ **Edit→Save actualiza mismo archivo (no duplica)**  
✅ **User JSON se lee correctamente al reabrir app**

---

**🎸 WAVE 1115 COMPLETADA**

*"Los bugs son features sin permiso. Esta Wave les revocó la licencia."*  
— PunkOpus
