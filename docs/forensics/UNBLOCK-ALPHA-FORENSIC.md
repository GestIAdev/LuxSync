# OPERACIÓN "UNBLOCK ALPHA" — AUDITORÍA FORENSE DE I/O SÍNCRONO

**Fecha:** 2026-08-20
**Fase:** READ-ONLY (sin modificaciones de código)
**Objetivo:** Catalogar todas las operaciones de disco síncronas que pueden bloquear el event loop de ALPHA (main thread) durante el runtime.

---

## RESUMEN EJECUTIVO

| Métrica | Valor |
|---|---|
| Directorios escaneados | `src/core/`, `electron/`, `src/hal/` |
| Archivos con operaciones síncronas | 16 |
| Operaciones síncronas totales | 93 |
| Sospechosos CRÍTICOS (runtime, bucle sobre directorio) | 7 |
| Sospechosos MEDIOS (runtime, archivo único) | 5 |
| Sospechosos BAJOS (boot-only o archivo pequeño) | 14 |

**Hallazgo principal:** El handler `chronos:triggerHeph` hace **3 operaciones síncronas
en el hot path de runtime** (incluyendo un `readFileSync` redundante solo para log).
Y `rescanAllLibraries()` — invocada tras cada save/delete de fixture — orquesta
`fxtParser.scanFolder()` que hace `readdirSync` + `readFileSync` en bucle sobre
**dos** directorios completos.

---

## CATÁLOGO DE SOSPECHOSOS

### 🔴 CRÍTICOS — Runtime + bucle sobre directorio

---

#### C1. `chronos:triggerHeph` — 3 ops síncronas en hot path de runtime

**Ubicación:** `src/core/orchestrator/IPCHandlers.ts:397-426`

**Contexto:** `ipcMain.handle('chronos:triggerHeph', ...)` — disparado por la UI
cada vez que el usuario activa un efecto Hephaestus durante un show.

**Operaciones:**
```typescript
// Línea 407 — existsSync
if (!fs.existsSync(config.filePath)) { ... }

// Línea 412 — statSync
const stats = fs.statSync(config.filePath)

// Línea 422 — readFileSync (¡REDUNDANTE! solo para log de preview)
const content = fs.readFileSync(config.filePath, 'utf-8')
console.log(`[...] HEPH FILE PREVIEW: ${content.substring(0, 200)}...`)
```

**Riesgo:** ALTO. Este handler se dispara en runtime durante el show. La
`readFileSync` es **completamente redundante** — solo hace un log de los
primeros 200 caracteres del archivo. El `runtime.play()` que sigue usa el
índice en memoria, no toca disco. Las 3 operaciones síncronas son
diagnóstico/debug que debería eliminarse o moverse a async.

**Veredicto:** Sospechoso #1 del freeze de ALPHA.

---

#### C2. `rescanAllLibraries()` → `fxtParser.scanFolder()` — bucle síncrono doble

**Ubicación:** `electron/main.ts:321-325` (definición) + `src/core/library/FXTParser.ts:573-610`

**Contexto:** Llamado desde múltiples IPC handlers durante runtime:
- `lux:save-fixture-definition` (IPCHandlers.ts:1131) — tras guardar fixture
- `lux:delete-fixture-definition` (IPCHandlers.ts:1220) — tras borrar fixture
- `lux:library:save-user` (IPCHandlers.ts:1443) — tras guardar user fixture
- `lux:library:delete-user` (IPCHandlers.ts:~1520) — tras borrar user fixture

**Operaciones dentro de `scanFolder`:**
```typescript
// FXTParser.ts:576
if (!fs.existsSync(folderPath)) { ... }

// FXTParser.ts:581 — readdirSync sobre directorio completo
const files = fs.readdirSync(folderPath)

// FXTParser.ts:595 — readFileSync por cada .json en bucle
const jsonContent = fs.readFileSync(fullPath, 'utf-8')

// FXTParser.ts:299 — readFileSync por cada .fxt en bucle (via parseFile)
const content = fs.readFileSync(filePath, 'utf-8')
```

**Riesgo:** ALTO. `rescanAllLibraries` escanea **dos** directorios completos
(factory + custom) con `readdirSync` + `readFileSync` por archivo. Si hay
50-100 fixtures, son 100-200 operaciones síncronas secuenciales en el main
thread. Y se llama tras CADA save/delete de fixture.

**Veredicto:** Sospechoso #2 del freeze de ALPHA.

---

#### C3. `lux:library:list-all` — escaneo síncrono doble de librería

**Ubicación:** `src/core/orchestrator/IPCHandlers.ts:1245-1310`

**Contexto:** `ipcMain.handle('lux:library:list-all', ...)` — disparado cuando
el usuario abre la librería de fixtures en la UI.

**Operaciones:**
```typescript
// Línea 1258 — existsSync + mkdirSync
if (!fs.existsSync(userPath)) { fs.mkdirSync(userPath, ...) }

// Línea 1266-1271 — readdirSync + readFileSync por cada .json (factory)
if (fs.existsSync(factoryPath)) {
  const factoryFiles = fs.readdirSync(factoryPath)
  for (const file of factoryFiles) {
    const content = fs.readFileSync(path.join(factoryPath, file), 'utf-8')
    // ... también parsea .fxt via fxtParser.parseFile() que es síncrono
  }
}

// Línea 1298-1303 — readdirSync + readFileSync por cada .json (user)
if (fs.existsSync(userPath)) {
  const userFiles = fs.readdirSync(userPath)
  for (const file of userFiles) {
    const content = fs.readFileSync(path.join(userPath, file), 'utf-8')
  }
}
```

**Riesgo:** ALTO. Escanea dos directorios completos con readdirSync +
readFileSync en bucle. Disparado por la UI al abrir la librería.

**Veredicto:** Sospechoso #3.

---

#### C4. `lux:delete-fixture-definition` — búsqueda síncrona en bucle

**Ubicación:** `src/core/orchestrator/IPCHandlers.ts:1149-1231`

**Contexto:** `ipcMain.handle('lux:delete-fixture-definition', ...)` — disparado
al borrar un fixture.

**Operaciones:**
```typescript
// Línea 1163 — existsSync
if (identifier.includes(path.sep) && fs.existsSync(identifier)) { ... }

// Línea 1182-1190 — readdirSync + readFileSync en bucle de búsqueda
for (const folder of searchFolders) {
  if (!fs.existsSync(folder)) continue
  const files = fs.readdirSync(folder)
  for (const file of files) {
    const content = fs.readFileSync(filePath, 'utf-8')
    // match por id o name
  }
}
```

**Riesgo:** MEDIO-ALTO. Busca en bucle sobre dos directorios hasta encontrar
el fixture por id/name. Tras borrar, llama a `rescanAllLibraries()` (C2).

---

#### C5. `lux:library:save-user` — readdirSync + readFileSync en bucle

**Ubicación:** `src/core/orchestrator/IPCHandlers.ts:1374-1459`

**Contexto:** `ipcMain.handle('lux:library:save-user', ...)` — guardar fixture
de usuario.

**Operaciones:**
```typescript
// Línea 1382 — existsSync + mkdirSync
if (!fs.existsSync(userPath)) { fs.mkdirSync(userPath, ...) }

// Línea 1395-1400 — readdirSync + readFileSync en bucle buscando duplicado
const existingFiles = fs.readdirSync(userPath)
for (const file of existingFiles) {
  const content = fs.readFileSync(path.join(userPath, file), 'utf-8')
  // match por id
}

// Línea 1435 — writeFileSync
fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8')

// Línea 1443 — rescanAllLibraries() (C2)
```

**Riesgo:** ALTO. Combina readdirSync + readFileSync en bucle + writeFileSync
+ rescanAllLibraries (que hace otro bucle doble). Todo en el mismo handler.

---

#### C6. `lux:library:delete-user` — readdirSync + readFileSync en bucle

**Ubicación:** `src/core/orchestrator/IPCHandlers.ts:1466-1531`

**Contexto:** `ipcMain.handle('lux:library:delete-user', ...)` — borrar fixture
de usuario.

**Operaciones:**
```typescript
// Línea 1474 — existsSync
if (!fs.existsSync(userPath)) { ... }

// Línea 1479-1486 — readdirSync + readFileSync en bucle
const files = fs.readdirSync(userPath)
for (const file of files) {
  const content = fs.readFileSync(path.join(userPath, file), 'utf-8')
  // match por id
}
```

**Riesgo:** MEDIO-ALTO. Bucle de búsqueda + rescanAllLibraries tras borrar.

---

#### C7. `lux:ingenio:list-all` + `scanIngeniFolder` — bucle síncrono

**Ubicación:** `src/core/orchestrator/IPCHandlers.ts:1534-1568`

**Contexto:** `ipcMain.handle('lux:ingenio:list-all', ...)` — listar ingenios.

**Operaciones dentro de `scanIngeniFolder`:**
```typescript
// Línea 1538 — existsSync
if (!fs.existsSync(folderPath)) return items

// Línea 1539 — readdirSync
for (const file of fs.readdirSync(folderPath)) {

// Línea 1542 — readFileSync en bucle
  const raw = fs.readFileSync(path.join(folderPath, file), 'utf-8')
```

**Riesgo:** MEDIO. Escanea dos carpetas (system + user) con bucle síncrono.

---

### 🟡 MEDIOS — Runtime + archivo único

---

#### M1. `lux:save-fixture-definition` — writeFileSync

**Ubicación:** `src/core/orchestrator/IPCHandlers.ts:1126`

**Contexto:** `ipcMain.handle('lux:save-fixture-definition', ...)` — guardar
definición de fixture.

**Operación:**
```typescript
fs.writeFileSync(filePath, JSON.stringify(definition, null, 2), 'utf-8')
```

**Riesgo:** MEDIO. Un solo archivo, pero `JSON.stringify` + `writeFileSync`
puede bloquear si el fixture es grande. Tras escribir, llama a
`rescanAllLibraries()` (C2) que es el verdadero problema.

---

#### M2. `lux:ingenio:save-user` — writeFileSync

**Ubicación:** `src/core/orchestrator/IPCHandlers.ts:1615`

**Contexto:** `ipcMain.handle('lux:ingenio:save-user', ...)` — guardar ingenio.

**Operación:**
```typescript
fs.writeFileSync(filePath, JSON.stringify(toSave, null, 2), 'utf-8')
```

**Riesgo:** MEDIO. Un archivo, pero síncrono.

---

#### M3. `genesisIPC:canonize-organism` — writeFileSync + mkdirSync

**Ubicación:** `src/core/genesis/genesisIpc.ts:505-526`

**Contexto:** Canonización de organismo Genesis → escribir .lfx al arsenal.

**Operaciones:**
```typescript
// Línea 505 — existsSync
if (!fs.existsSync(arsenalDir)) { fs.mkdirSync(arsenalDir, ...) }

// Línea 524 — mkdirSync
fs.mkdirSync(vibeDir, { recursive: true })

// Línea 526 — writeFileSync
fs.writeFileSync(filePath, lfxContent, 'utf-8')
```

**Riesgo:** MEDIO. Un archivo, pero se ejecuta durante el flujo de Genesis
que el usuario reportó como potencial disparador.

---

#### M4. `genesisIPC:delete-organism` — readdirSync + existsSync en bucle

**Ubicación:** `src/core/genesis/genesisIpc.ts:740-754`

**Contexto:** Borrar organismo canonizado.

**Operaciones:**
```typescript
// Línea 740 — existsSync
if (!fs.existsSync(fallbackPath)) {

// Línea 742 — readdirSync + filter
  const subdirs = fs.readdirSync(arsenalDir, { withFileTypes: true })
    .filter(d => d.isDirectory())

// Línea 746 — existsSync por cada subdirectorio en bucle
  for (const subdir of subdirs) {
    if (fs.existsSync(candidate)) { ... }
  }
}

// Línea 754 — existsSync final
if (fs.existsSync(fallbackPath)) { fs.unlinkSync(fallbackPath) }
```

**Riesgo:** MEDIO. Bucle sobre subdirectorios del arsenal buscando el .lfx.

---

#### M5. `PROFILER` — writeFileSync de CPU profile

**Ubicación:** `electron/main.ts:1627`

**Contexto:** `ipcMain.handle('profiler:start', ...)` — captura de CPU profile.

**Operación:**
```typescript
fs.writeFileSync(outputPath, JSON.stringify(profile))
```

**Riesgo:** BAJO-MEDIO. Solo se activa manualmente para debugging, pero el
profile puede ser grande (MBs) y el `JSON.stringify` + `writeFileSync` es
síncrono.

---

### 🟢 BAJOS — Boot-only o archivo pequeño

---

#### B1. `main.ts` — Arsenal sync en boot

**Ubicación:** `electron/main.ts:648-796`

**Contexto:** Sincronización de builtins → userData en arranque.

**Operaciones:** `readFileSync` (checksums), `readdirSync` (recursive copy),
`existsSync` (múltiples), `writeFileSync` (installed manifest), `copyFileSync`.

**Riesgo:** BAJO. Solo en boot. No se ejecuta durante runtime.

---

#### B2. `main.ts` — PATHFINDER library scan en boot

**Ubicación:** `electron/main.ts:1347-1395`

**Contexto:** Búsqueda de librería de fixtures en arranque.

**Operaciones:** `existsSync` + `readdirSync` por cada candidato.

**Riesgo:** BAJO. Solo en boot.

---

#### B3. `main.ts` — License validation

**Ubicación:** `electron/license/LicenseValidator.js:158, 229, 242`

**Contexto:** Validación de licencia.

**Operaciones:** `readFileSync` (main.js hash), `existsSync` + `readFileSync`
(license file).

**Riesgo:** BAJO. Archivo único, solo en boot o validación puntual.

---

#### B4. `ConfigManagerV2` — load/save config

**Ubicación:** `src/core/config/ConfigManagerV2.ts:220, 338, 344`

**Contexto:** Carga/guardado de preferencias.

**Operaciones:** `existsSync`, `readFileSync`, `writeFileSync` (atomic via rename).

**Riesgo:** BAJO. Archivo único pequeño. `save()` es sync pero solo en shutdown.

---

#### B5. `StagePersistence` — init + recent shows

**Ubicación:** `src/core/stage/StagePersistence.ts:120, 595`

**Contexto:** Inicialización + carga de lista de shows recientes.

**Operaciones:** `existsSync`, `mkdirSync`, `readFileSync`.

**Riesgo:** BAJO. Solo en boot (`init()`).

---

#### B6. `VibeLabPersistence` — getVibesDir

**Ubicación:** `src/core/vibe/VibeLabPersistence.ts:56`

**Contexto:** Helper de path para vibes.

**Operaciones:** `existsSync` + `mkdirSync` (cached en `_vibesDir`).

**Riesgo:** BAJO. Solo se ejecuta una vez (lazy init con cache).

---

#### B7. `GenesisVaultService.initialize()`

**Ubicación:** `src/core/genesis/GenesisVaultService.ts:240`

**Contexto:** Inicialización del vault SQLite.

**Operaciones:** `existsSync` + `mkdirSync`.

**Riesgo:** BAJO. Solo en boot.

---

#### B8. `AncestralIngestor` — escaneo de builtins

**Ubicación:** `src/core/genesis/AncestralIngestor.ts:40, 118, 191, 207`

**Contexto:** Ingesta de builtins al vault en boot.

**Operaciones:** `existsSync`, `readdirSync` (recursive walk).

**Riesgo:** BAJO. Solo en boot.

---

#### B9. `LfxFileLoader._loadDirectory` — existsSync guard

**Ubicación:** `src/core/arsenal/LfxFileLoader.ts:154`

**Contexto:** Guard antes de scan recursivo.

**Operación:** `fsSync.existsSync(spec.absolutePath)` — una sola llamada.

**Riesgo:** BAJO. El resto del scan es async (`fs.promises.readdir`). El
`existsSync` es un guard rápido de un solo path.

---

#### B10. `HephFileIO` — TODO ASYNC ✅

**Ubicación:** `src/core/hephaestus/HephFileIO.ts`

**Contexto:** Save/load/delete de clips Hephaestus.

**Veredicto:** LIMPIO. Usa `fs.promises` (async) en todas sus operaciones.
No es sospechoso.

---

#### B11. `HephIPCHandlers` — TODO ASYNC ✅

**Ubicación:** `src/core/hephaestus/HephIPCHandlers.ts`

**Contexto:** Handlers IPC de Hephaestus (save, load, list, delete).

**Veredicto:** LIMPIO. Todos los handlers son `async` y delegan a
`HephFileIO` (async) + `HephaestusRuntime.hotReload()` (que usa índice en
memoria, no toca disco).

---

#### B12. `HephaestusRuntime.hotReload()` — USA ÍNDICE EN MEMORIA ✅

**Ubicación:** `src/core/hephaestus/runtime/HephaestusRuntime.ts:301-318`

**Contexto:** Hot reload tras guardar efecto en vivo.

**Veredicto:** LIMPIO. `loadClip()` usa `getHephaestusClipIndex().getByPath()`
que es un lookup O(1) en Map en memoria. No toca disco.

---

#### B13. `LiquidTelemetryObserver.exportToFile()`

**Ubicación:** `src/hal/physics/LiquidTelemetryObserver.ts:266, 321`

**Contexto:** Export de telemetría de calibración.

**Operaciones:** `existsSync` + `mkdirSync` + `writeFileSync`.

**Riesgo:** BAJO. Solo se activa manualmente para calibración.

---

#### B14. `ShadowLogger.dump()`

**Ubicación:** `src/core/senses/services/ShadowLogger.ts:128`

**Contexto:** Dump de frames de shadow logging.

**Operación:** `writeFileSync` de JSON.

**Riesgo:** BAJO. Solo se activa manualmente para debugging.

---

#### B15. `EnergyLogger.initialize()`

**Ubicación:** `src/core/intelligence/EnergyLogger.ts:105`

**Contexto:** Inicialización del logger de energía.

**Operación:** `existsSync` + `mkdirSync`.

**Riesgo:** BAJO. Solo en init.

---

#### B16. `_fix_mutable.js` — script de un solo uso

**Ubicación:** `src/core/orchestrator/_fix_mutable.js:3, 71`

**Contexto:** Script de mantenimiento legacy.

**Riesgo:** NULO. No se ejecuta en runtime.

---

## ANÁLISIS ESPECÍFICO: HEPHAESTUS + GENESIS

### Hephaestus FX — Veredicto: LIMPIO (con una excepción)

El flujo de Hephaestus está **bien diseñado** para evitar I/O síncrono:

1. **`HephIPCHandlers.ts`** — todos los handlers son `async` ✅
2. **`HephFileIO.ts`** — usa `fs.promises` en todas sus operaciones ✅
3. **`HephaestusClipIndex.ts`** — usa `fs/promises` ✅
4. **`HephaestusRuntime.hotReload()`** — usa índice en memoria O(1) ✅
5. **`LfxFileLoader.loadFile()`** — async, usa el índice ✅

**LA EXCEPCIÓN:** El handler `chronos:triggerHeph` (C1) que dispara
efectos Hephaestus en runtime tiene 3 operaciones síncronas de
diagnóstico/debug. Este es el único punto donde Hephaestus toca disco
síncrono durante el show, y es completamente innecesario — el
`readFileSync` solo hace un log de preview.

### Genesis — Veredicto: RIESGO MEDIO

El flujo de Genesis tiene operaciones síncronas en dos puntos:

1. **Canonización** (M3): `writeFileSync` + `mkdirSync` al escribir el .lfx
   canonizado al arsenal. Un archivo, pero síncrono.

2. **Borrado** (M4): `readdirSync` + `existsSync` en bucle buscando el .lfx
   por subcarpetas.

Estos se ejecutan cuando el usuario canoniza o borra organismos desde
Genesis, que son operaciones menos frecuentes que activar efectos, pero
siguen siendo síncronas en runtime.

---

## TOP 3 SOSPECHOSOS DEL FREEZE DE ALPHA

### #1 — `chronos:triggerHeph` (C1)
- **Por qué:** Se dispara en cada activación de efecto Hephaestus en runtime.
  3 ops síncronas (existsSync + statSync + readFileSync) por cada trigger.
  El `readFileSync` es redundante (solo para log).
- **Impacto estimado:** 5-50ms por trigger dependiendo del tamaño del .lfx
  y el estado del cache del OS. No debería causar 5s de freeze por sí solo,
  pero si coincide con GC pressure, puede sumar.

### #2 — `rescanAllLibraries()` (C2)
- **Por qué:** Tras cada save/delete de fixture, escanea DOS directorios
  completos con `readdirSync` + `readFileSync` por archivo. Si hay 50-100
  fixtures, son 100-200 ops síncronas secuenciales.
- **Impacto estimado:** 100-500ms por rescan. Si el directorio está en un
  disco lento o el OS está bajo presión, puede escalar a segundos.

### #3 — `lux:library:list-all` (C3)
- **Por qué:** Al abrir la librería de fixtures en la UI, escanea dos
  directorios completos con readdirSync + readFileSync en bucle.
- **Impacto estimado:** Similar a C2. Disparado por la UI al abrir la
  librería.

---

## RECOMENDACIONES PARA EL ARQUITECTO (FASE 2)

> **Nota:** Estas recomendaciones son para la próxima fase. NO se modifica
> código en esta fase forense.

1. **C1 (crítico):** Eliminar las 3 ops síncronas de `chronos:triggerHeph`.
   El `readFileSync` de preview es redundante — el `runtime.play()` ya usa
   el índice en memoria. El `existsSync` + `statSync` pueden reemplazarse
   por un check async o eliminarse (el runtime ya valida internamente).

2. **C2 (crítico):** Convertir `FXTParser.scanFolder()` a async usando
   `fs.promises.readdir` + `fs.promises.readFile`. Esto desbloquea
   `rescanAllLibraries()` y todos los handlers que la llaman.

3. **C3-C7 (alto):** Convertir los handlers `lux:library:*` y
   `lux:ingenio:*` a async. Siguen el mismo patrón: `readdirSync` +
   `readFileSync` en bucle.

4. **M3-M4 (medio):** Convertir canonización y borrado de Genesis a async.

5. **General:** Auditar si `fxtParser` (singleton) puede mantener un cache
   en memoria para evitar el rescan completo tras cada save/delete. Un
   patrón de "upsert en cache" sería más eficiente que rescannear todo.

---

## CONCLUSIÓN

El flujo de **Hephaestus está sorprendentemente limpio** — el equipo hizo
un buen trabajo migrándolo a async. El problema está en el flujo de
**fixtures/librería** (`FXTParser`, `IPCHandlers`), que sigue usando el
patrón síncrono legacy. Y el handler `chronos:triggerHeph` tiene ops
síncronas de debug que se colaron en el hot path.

El candado de 4 gates (ThermodynamicVetoEngine) no tiene culpa — es un
sistema de lógica, no de I/O. El freeze viene de I/O síncrono en handlers
IPC disparados por la UI durante el runtime.

---

*Generado por auditoría forense read-only — 2026-08-20*
