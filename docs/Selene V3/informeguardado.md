Informe de Guardado y Ejecución — Carpetas Hephaestus vs Genesis
Rutas Actuales (resumen)
#	Qué	Ruta	Quién escribe	Quién lee
1	Builtins del repo (dev)	electron-app/src/core/arsenal/builtins/<vibe>/*.lfx	Desarrollador (manual)	Boot: LfxFileLoader.loadAll()
2	Builtins empaquetados (prod)	process.resourcesPath/builtins/<vibe>/*.lfx	Electron builder	Boot: LfxFileLoader.loadAll()
3	Hephaestus — saves del usuario	userData/effects/*.lfx	HephFileIO.saveClip()	Boot + hot-reload via index.upsert()
4	Genesis — canonización a builtins	userData/builtins/*.lfx	genesis:canonizeToBuiltins IPC	Boot + hot-reload via index.upsert()
5	Genesis DB	userData/selene-genesis.db	GenesisVaultService	GenesisVaultService
userData en Windows = C:\Users\<usuario>\AppData\Roaming\LuxSync (o el nombre configurado en package.json).

Flujo de Arranque (main.ts:573-637)
El boot escanea 3 fuentes y las alimenta al LfxFileLoader.loadAll():

Repo builtins — auto-descubre subcarpetas por vibe (techno/, latin/, etc.) dentro de src/core/arsenal/builtins/ (dev) o resourcesPath/builtins/ (packaged). Cada subcarpeta → un DirectorySpec con source: 'builtin'.
User effects — userData/effects/ con source: 'user' (WAVE 7033). Esto es donde Hephaestus guarda.
Canonized — userData/builtins/ con source: 'builtin' (WAVE 6000.V7). Esto es donde Genesis canoniza.
LfxFileLoader.loadAll() → por cada .lfx:

Llama HephaestusClipIndex.upsert(filePath, source) → puebla el índice en RAM (para heph:list → UI)
Llama DynamicEffectRegistry.registerEffectV3() → puebla el arsenal (para Selene IA)
Flujo de Guardado Hephaestus (HephFileIO.saveClip())


Usuario click Save
  → HephIPCHandlers: heph:save
    → hephFileIO.saveClip(clip)
      → escribe a: userData/effects/{clip.id}.lfx
      → HephaestusClipIndex.upsert(filePath, 'user')  ← índice en RAM
    → LfxFileLoader.loadFile(filePath, 'user')
      → DynamicEffectRegistry.registerEffectV3()       ← arsenal en RAM
Resultado: El clip aparece inmediatamente en la UI (índice) y en Selene (arsenal). ✓

Flujo de Canonización Genesis
Hay DOS caminos distintos:

Camino A: genesis:canonizeOrganism (DB only)


genesis:canonizeOrganism(organismId, customName)
  → INSERT INTO lfx_blueprints (nueva fila en SQLite)
  → UPDATE lfx_organisms SET status='canonized'
  → NO escribe archivo .lfx a disco
Resultado: El organismo queda inmortalizado en la DB de Genesis, pero NO aparece en Hephaestus ni en el arsenal de Selene. No hay .lfx en disco.

Camino B: genesis:canonizeToBuiltins (DB + .lfx file)


genesis:canonizeToBuiltins(clip, organismId)
  → escribe a: userData/builtins/{baptismName}.lfx
  → UPDATE lfx_organisms SET status='canonized'
  → HephaestusClipIndex.upsert(filePath, 'builtin')   ← índice en RAM
  → LfxFileLoader.loadFile(filePath, 'builtin')        ← arsenal en RAM
Resultado: El clip aparece en la UI (índice) y en Selene (arsenal). ✓

El Problema: "No se pintan en la UI"
La UI de Hephaestus (useHephLibrary) carga clips via heph:list → hephFileIO.listClips() → HephaestusClipIndex.getAllMetadata().

El índice se puebla:

En boot: LfxFileLoader.loadAll() escanea las 3 carpetas y hace upsert() por cada .lfx
En hot-reload: HephFileIO.saveClip() y genesis:canonizeToBuiltins hacen upsert() inmediatamente
Causa raíz probable del bug que reportas:

Si los efectos sí aparecen en el arsenal y se disparan (están en DynamicEffectRegistry) pero no se pintan en la UI (no están en HephaestusClipIndex), hay dos posibilidades:

Timing: useHephLibrary hace loadLibrary() en el primer mount (useEffect). Si el HephaestusClipIndex aún no se ha poblado cuando la UI monta (el boot asíncrono de LfxFileLoader no ha terminado), heph:list devuelve []. El hook tiene un guard _hasInitialized que no re-intenta después de la primera carga — aunque el índice se llene después, la UI no refresca.
Caminos divergentes: canonizeOrganism (Camino A) NO escribe .lfx ni hace upsert() al índice. Solo escribe a la DB de Genesis. Si el usuario canoniza por ese camino, el efecto nunca llega al HephaestusClipIndex → no aparece en la UI de Hephaestus. Sin embargo, si el organismo fue materializado y disparado via DynamicEffectRegistry por otra vía, sí se ejecuta.
Mapa de Caos


DISCO
├── electron-app/src/core/arsenal/builtins/     ← repo (dev only)
│   ├── techno/*.lfx
│   ├── latin/*.lfx
│   └── ...
├── userData/effects/                            ← Hephaestus saves
│   └── heph-xxxx-xxxx.lfx
├── userData/builtins/                           ← Genesis canonizeToBuiltins
│   └── BaptizedName.lfx
└── userData/selene-genesis.db                   ← Genesis DB (SQLite)
    ├── lfx_blueprints (canonizeOrganism → aquí solo)
    └── lfx_organisms
 
RAM (boot)
├── HephaestusClipIndex                          ← heph:list lee de aquí
│   ├── poblado por LfxFileLoader.loadAll() en boot
│   ├── poblado por HephFileIO.saveClip() en hot-reload
│   └── poblado por canonizeToBuiltins en hot-reload
│   ⚠️ NO poblado por canonizeOrganism (Camino A)
│
└── DynamicEffectRegistry                        ← Selene IA lee de aquí
    ├── poblado por LfxFileLoader.loadAll() en boot
    ├── poblado por HephFileIO.saveClip() en hot-reload
    └── poblado por canonizeToBuiltins en hot-reload
Problemas Identificados
3 carpetas distintas para .lfx: repo builtins, userData/effects/, userData/builtins/ — sin unificación
2 caminos de canonización en Genesis con comportamientos distintos (uno escribe .lfx, el otro no)
canonizeOrganism (Camino A) es un callejón sin salida para Hephaestus — el efecto vive solo en la DB, invisible a la UI y al arsenal
useHephLibrary no re-intenta la carga si el índice estaba vacío en el primer mount — si el boot asíncrono no terminó, la UI queda en blanco permanentemente hasta un refreshMetadata() manual
Tienes la palabra, arquitecto. Cuando decidas cómo unificar las carpetas, ejecuto los cambios.