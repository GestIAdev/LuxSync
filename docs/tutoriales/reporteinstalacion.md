REPORTE: MAPEO DE RUTAS DE INSTALACIÓN Y ALMACENAMIENTO — WAVE 7590
1. Ruta Raíz de la App (userData)
Electron usa app.getPath('userData'), que en Windows se resuelve a:



%APPDATA%\LuxSync\
(es decir, C:\Users\<usuario>\AppData\Roaming\LuxSync\)

Esto está gobernado por "productName": "LuxSync" en package.json → electron-builder. Es predecible y seguro.

2. Subcarpetas Generadas (estado actual)
Subcarpetas CORRECTAS (dentro de userData)
Subcarpeta	Origen	Propósito
arsenal/	main.ts:747, genesisIpc.ts:504, KeyForgeIPCHandlers.ts:99	Efectos .lfx (builtin + custom)
arsenal/.builtin-manifest.json	main.ts:791	Manifest de sync incremental
license/license.luxlicense	main.ts:1270	Licencia activada
librerias	main.ts:1484	Copia de biblioteca de fixtures en prod
fixtures	main.ts:1508	Biblioteca custom de fixtures del usuario
shows	StagePersistence.ts:123	Shows guardados (.luxshow)
vibes/	VibeLabPersistence.ts:55	Vibes custom del usuario
ingenios/system/	IPCHandlers.ts:1509	Ingenios de fábrica (read-only)
ingenios/user/	IPCHandlers.ts:1510	Ingenios del usuario
selene-genesis.db	GenesisVaultService.ts:534	Base de datos SQLite del Genesis Vault
luxsync-config.json	ConfigManagerV2.ts:222	Config global de la app
lux-asesino.cpuprofile	main.ts:1838	Profiling de CPU (debug)
Subcarpeta REBELDE (FUERA de userData)
Ruta	Origen	Propósito	Problema
~/.luxsync/autosave/	ChronosIPCHandlers.ts:449	Auto-save de Chronos	USA os.homedir() EN LUGAR DE app.getPath('userData')
Esto genera una carpeta oculta C:\Users\<usuario>\.luxsync\autosave\ completamente fuera del control de Electron. Al mover la app a otro PC, los auto-saves quedan huérfanos y la recuperación de crash no funciona.

3. Rutas de Solo Lectura (resourcesPath, empaquetado)
Estas rutas son del paquete instalado (no escribibles, no persistidas):

Ruta	Origen	Propósito
process.resourcesPath/builtins/	main.ts:749	Efectos .lfx de fábrica (empaquetados)
librerias	main.ts:1479	Biblioteca de fixtures en dev
process.cwd()/librerias/	main.ts:1480	Biblioteca legacy
process.cwd()/resources/librerias/	main.ts:1481	Biblioteca empaquetada
__dirname/../../librerias/	main.ts:1482	Fallback dev
__dirname/../../../librerias/	main.ts:1483	Fallback dev
El PATHFINDER (main.ts:1478-1504) busca la biblioteca de fixtures en 6 ubicaciones distintas. En producción empaquetada, normalmente cae en resources/librerias/ o userData/librerias/.

4. Árbol de Directorios Resultante (Windows)


C:\Users\<usuario>\AppData\Roaming\LuxSync\          ← app.getPath('userData')
├── arsenal\                                         ← Efectos .lfx
│   ├── .builtin-manifest.json                       ← Manifest de sync
│   ├── fiesta-latina\                               ← Subcarpetas por vibe
│   ├── techno-club\
│   └── custom\                                      ← Efectos del usuario
├── license\
│   └── license.luxlicense                           ← Licencia
├── librerias\                                       ← Biblioteca de fixtures (copia prod)
├── fixtures\                                        ← Fixtures custom del usuario
├── shows\                                           ← Shows guardados (.luxshow)
├── vibes\                                           ← Vibes custom
├── ingenios\
│   ├── system\                                      ← Ingenios de fábrica (read-only)
│   └── user\                                        ← Ingenios del usuario
├── selene-genesis.db                                ← SQLite del Genesis Vault
├── luxsync-config.json                              ← Config global
└── lux-asesino.cpuprofile                           ← (solo si se profilea)
 
C:\Users\<usuario>\.luxsync\                         ← ⚠️ REBELDE
└── autosave\                                        ← Auto-save de Chronos
    └── *.luxshow                                    ← Shows auto-guardados
5. Diagnóstico de Problemas
PROBLEMA CRÍTICO #1: ~/.luxsync/autosave/ fuera de userData
Archivo: electron/ipc/ChronosIPCHandlers.ts:449



ts
const autoSaveDir = path.join(os.homedir(), '.luxsync', 'autosave')
Impacto:

Al desinstalar la app, los auto-saves quedan huérfanos en ~/.luxsync/
Al mover a otro PC, la recuperación de crash no encuentra los auto-saves
Viola el principio de "Ley Marcial" — una sola bóveda central
En macOS/Linux, ~/.luxsync es una carpeta oculta que el usuario no sabe que existe
Fix propuesto:



ts
const autoSaveDir = path.join(app.getPath('userData'), 'autosave')
PROBLEMA MENOR #2: PATHFINDER de librerías con 6 fallbacks
Archivo: electron/main.ts:1478-1484

El PATHFINDER busca librerias en 6 ubicaciones distintas. En producción empaquetada, solo 2 son relevantes (resources/librerias/ y userData/librerias/). Los otros 4 son fallbacks de dev que pueden causar confusión. No es crítico pero añade complejidad innecesaria.

PROBLEMA MENOR #3: librerias vs fixtures — nomenclatura duplicada
La app crea dos carpetas de fixtures en userData:

librerias — copia de la biblioteca de fábrica
fixtures — biblioteca custom del usuario
Esto es confuso para el usuario si explora la carpeta. Podría unificarse bajo fixtures/factory/ y fixtures/custom/.

6. Resumen
Estado	Cantidad	Rutas
Correcto (userData)	12 subcarpetas/archivos	arsenal, license, librerias, fixtures, shows, vibes, ingenios, genesis.db, config, cpuprofile
Rebelde (os.homedir)	1 subcarpeta	~/.luxsync/autosave/
Solo lectura (resources)	6 rutas	builtins, librerias (dev/prod)
Conclusión: El 95% del sistema ya respeta app.getPath('userData'). El único fugitivo es ChronosIPCHandlers.ts con os.homedir()/.luxsync/autosave/. Unificarlo es un fix de una línea.