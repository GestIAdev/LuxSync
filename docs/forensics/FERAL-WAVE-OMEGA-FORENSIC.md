# FORENSIC REPORT: Feral Wave Omega — El Efecto Inmortal

**Fecha:** 2026-08-19  
**WAVE:** 7545  
**Severidad:** CRÍTICO (producción-blocking)  
**Clasificación:** Manifest Sync Bug + Canonization Path Bug

---

## Síntoma

`Feral Wave Omega` existe como DUPLICADO en el arsenal:
- `custom/Feral Wave Omega.lfx` (ID: `00000000_8e8ab59a-...`)
- `custom/heph_Feral Wave Omega.lfx` (ID: `heph_8e8ab59a-...`)

Borrarlos de `userData/arsenal/custom/` no sirve: el manifest sync los regenera en cada arranque. Borrarlos de la UI tampoco funciona: el delete handler solo borra de `userData/`, no del repositorio `builtins/`.

Además, el efecto tiene `compatibleVibes: ["latin"]` cuando el sistema usa `fiesta-latina`, causando VIB=0.400 y rechazos constantes en el Dream Simulator.

---

## Cadena Causal

### 1. Los archivos están en el REPOSITORIO

```
src/core/arsenal/builtins/custom/
  ├── Feral Wave Omega.lfx          (ID: 00000000_8e8ab59a-...)
  ├── heph_Feral Wave Omega.lfx     (ID: heph_8e8ab59a-...)
  ├── heph_1782609140553_bto9fn.lfx
  ├── heph_1782937097650_pjisyy.lfx
  ├── heph_1784931422617_tpox7b.lfx
  └── heph_1784952802805_jigk8a.lfx
```

Estos archivos fueron commiteados al repositorio en algún punto del desarrollo caótico. La carpeta `custom/` dentro de `builtins/` es una contradicción: `builtins/` es para efectos de fábrica, `custom/` debería ser para efectos de usuario.

### 2. El manifest generator los incluye como "builtins"

**Archivo:** `scripts/generate-arsenal-manifest.ts`  
**Línea 51-68:** `scanDirectory()` escanea TODO el directorio `builtins/` recursivamente, SIN excluir `custom/`.

```typescript
function scanDirectory(dir: string, basePath: string, files: Record<string, ManifestEntry>): number {
  let count = 0
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      count += scanDirectory(fullPath, basePath, files)  // ← recursa en custom/
    } else if (entry.name.toLowerCase().endsWith('.lfx')) {
      const relPath = path.relative(basePath, fullPath).replace(/\\/g, '/')
      files[relPath] = { relPath, checksum: ..., size: ... }
      count++
    }
  }
  return count
}
```

**Resultado:** `manifest.json` incluye:
```json
"custom/Feral Wave Omega.lfx": { "checksum": "4d4d6842dc9a29ff", "size": 4763 },
"custom/heph_Feral Wave Omega.lfx": { "checksum": "875aec408613e8ae", "size": 4759 }
```

### 3. El manifest sync los regenera en cada arranque

**Archivo:** `electron/main.ts`  
**Líneas 728-754:** El sync logic itera sobre TODOS los archivos del manifest.

```typescript
for (const [relPath, entry] of Object.entries(_builtinFiles)) {
  const _destFile = path.join(_arsenalPath, relPath)   // userData/arsenal/custom/Feral Wave Omega.lfx
  const _srcFile = path.join(_builtinPath, relPath)     // builtins/custom/Feral Wave Omega.lfx

  if (!fs.existsSync(_destFile)) {
    fs.copyFileSync(_srcFile, _destFile)                 // ← LO COPIA SI NO EXISTE
    _syncedCount++
    _newCount++
  } else if (!_installedEntry || _installedEntry.checksum !== entry.checksum) {
    fs.copyFileSync(_srcFile, _destFile)                 // ← LO SOBRESCRIBE SI CAMBIÓ
    _syncedCount++
  }
}
```

**El usuario borra el archivo de `userData/arsenal/custom/`** → en el siguiente arranque, `!fs.existsSync(_destFile)` es `true` → **se vuelve a copiar**.

### 4. El delete handler no puede ganar

**Archivo:** `src/core/genesis/genesisIpc.ts`  
**Líneas 674-752:** `genesis:deleteCanonized` borra:
- ✅ El archivo `.lfx` de `userData/arsenal/`
- ✅ El entry del `HephaestusClipIndex`
- ✅ El entry del `DynamicEffectRegistry`
- ✅ La row de `lfx_organisms`
- ❌ **NO borra el archivo del repositorio `builtins/`**
- ❌ **NO marca el archivo como "borrado" en `.builtin-manifest.json`**

El manifest sync no tiene concepto de "archivo borrado por el usuario". Solo sabe si el archivo existe o no. Si no existe, lo copia.

### 5. El canonization path guarda en root, no en vibe folder

**Archivo:** `src/core/genesis/genesisIpc.ts`  
**Líneas 498-514:**

```typescript
const arsenalDir = path.join(app.getPath('userData'), 'arsenal')
const safeName = baptismName.replace(/[:<>|"*?/\\]/g, '_')
const fileName = `${safeName}.lfx`
const filePath = path.join(arsenalDir, fileName)   // ← ROOT, NO SUBFOLDER
fs.writeFileSync(filePath, lfxContent, 'utf-8')
```

Los efectos canonizados se guardan en `userData/arsenal/{name}.lfx` (root del arsenal), no en `userData/arsenal/{vibe}/{name}.lfx`. Esto es inconsistente con la organización por vibes de los builtins (`techno/`, `latin/`, `rock/`, etc.).

### 6. ¿Cómo llegaron a `builtins/custom/`?

No hay un script automático que copie de `userData/arsenal/` a `builtins/custom/`. Los archivos fueron commiteados manualmente al repositorio, probablemente durante el desarrollo caótico del guardado. El autor `"LuxSync-Migrator-v3 / WAVE 4848"` sugiere que fueron migrados por un script de migración que los escribió al repositorio en vez de a `userData/`.

---

## Impacto en Producción

### Escenario: Cliente crea un efecto, lo canoniza, luego quiere borrarlo

1. **Cliente canoniza** → efecto se guarda en `userData/arsenal/{name}.lfx`
2. **Cliente borra desde UI** → `deleteCanonized` borra el archivo ✅
3. **Cliente reinicia la app** → si el efecto NO está en `builtins/manifest.json`, **no se regenera** ✅

**ESTE caso funciona.** El problema es específico a los efectos que fueron commiteados a `builtins/custom/`.

### Escenario: Efecto commiteado a builtins/custom/ (el caso actual)

1. **Cliente borra desde UI** → `deleteCanonized` borra de `userData/` ✅
2. **Cliente reinicia** → manifest sync lo vuelve a copiar ❌
3. **Cliente borra a mano de `userData/`** → manifest sync lo vuelve a copiar ❌
4. **Cliente borra de `builtins/`** → requiere acceso al repositorio ❌ (imposible en producción con `app.isPackaged`)

**En producción empaquetada:** `builtins/` está en `process.resourcesPath/builtins` (dentro del `.asar` o alongside). El cliente NO puede borrar archivos de ahí. **El efecto es inmortal.**

---

## Vibe Incompatibility

`Feral Wave Omega` tiene:
```json
"vibeCompat": ["latin"],
"compatibleVibes": ["latin"]
```

Pero el sistema usa `fiesta-latina` como vibe ID. `"latin"` no matchea nada. Esto causa:
- `VIB=0.400` en el Dream Simulator (vibe mismatch penalty)
- `VIBE-AWARE PRE-BUFFER` rechaza el efecto en cada frame
- El efecto ocupa un slot en el ranking pero nunca se pre-buffera

El efecto fue creado cuando el sistema de vibes usaba `"latin"` como ID genérico. Cuando se migró a vibes específicos (`fiesta-latina`, `techno-club`, etc.), el `compatibleVibes` no se actualizó.

---

## Fixes Propuestos

### Fix A: Excluir `custom/` del manifest generator (URGENTE)

**Archivo:** `scripts/generate-arsenal-manifest.ts`  
Excluir la subcarpeta `custom/` del escaneo recursivo:

```typescript
if (entry.isDirectory()) {
  if (entry.name === 'custom') continue  // ← WAVE 7545: custom/ is user space, not builtin
  count += scanDirectory(fullPath, basePath, files)
}
```

### Fix B: Excluir `custom/` del manifest sync (URGENTE)

**Archivo:** `electron/main.ts`  
Saltar archivos cuya `relPath` empieza con `custom/`:

```typescript
for (const [relPath, entry] of Object.entries(_builtinFiles)) {
  if (relPath.startsWith('custom/')) continue  // ← WAVE 7545: never sync custom/ as builtin
  // ... existing logic
}
```

### Fix C: Canonization path con subfolder por vibe (MEJORA)

**Archivo:** `src/core/genesis/genesisIpc.ts`  
Guardar en `userData/arsenal/{vibe}/{name}.lfx` en vez de root:

```typescript
const primaryVibe = clip.vibeCompat?.[0] ?? clip.cognitiveDNA?.compatibleVibes?.[0] ?? 'custom'
const vibeDir = path.join(arsenalDir, primaryVibe)
fs.mkdirSync(vibeDir, { recursive: true })
const filePath = path.join(vibeDir, fileName)
```

### Fix D: Delete handler con "tombstone" en manifest installed (DEFENSA)

**Archivo:** `electron/main.ts` + `genesisIpc.ts`  
Cuando se borra un efecto, escribir su checksum en `.builtin-manifest.json` como "tombstone" para que el sync no lo regenere:

```typescript
// En deleteCanonized:
const installedManifestPath = path.join(arsenalDir, '.builtin-manifest.json')
const installed = JSON.parse(fs.readFileSync(installedManifestPath, 'utf-8'))
installed.files[relPath] = { ...entry, tombstone: true }
fs.writeFileSync(installedManifestPath, JSON.stringify(installed, null, 2))

// En sync logic:
if (_installedEntry?.tombstone) continue  // ← user deleted this, don't regenerate
```

### Fix E: Borrar los archivos del repositorio (LIMPIEZA)

Borrar de `src/core/arsenal/builtins/custom/`:
- `Feral Wave Omega.lfx`
- `heph_Feral Wave Omega.lfx`
- `heph_1782609140553_bto9fn.lfx`
- `heph_1782937097650_pjisyy.lfx`
- `heph_1784931422617_tpox7b.lfx`
- `heph_1784952802805_jigk8a.lfx`

Y regenerar `manifest.json` con `npm run forge:manifest`.

### Fix F: Migrar `vibeCompat: ["latin"]` → `["fiesta-latina"]` (DATA FIX)

Los efectos con `compatibleVibes: ["latin"]` deben migrarse a `["fiesta-latina"]`. Esto aplica a ambos Feral Wave Omega y cualquier otro efecto legacy.

---

## Pregunta del Usuario: ¿Por qué se guardan en /custom?

**Respuesta:** Los efectos canonizados NO se guardan en `/custom`. Se guardan en el ROOT de `userData/arsenal/` (`genesisIpc.ts` línea 513). La carpeta `builtins/custom/` en el repositorio fue creada manualmente durante el desarrollo caótico — probablemente un script de migración o un commit manual que copió efectos de `userData/` al repositorio. El manifest generator los escanea porque no distingue `custom/` de `techno/` o `latin/`.

---

## Conclusión

El efecto es inmortal porque:
1. Está en el repositorio (`builtins/custom/`)
2. El manifest generator lo incluye como "builtin"
3. El manifest sync lo regenera en cada arranque
4. El delete handler no puede borrar del repositorio
5. En producción empaquetada, el repositorio es de solo lectura

**Sin Fix A + B + E, este problema afectaría a cualquier cliente que reciba un build con efectos en `builtins/custom/`.**
