INFORME FORENSE: HEPHAESTUS I/O BOTTLENECK (BUG 1)
Rol: Ingeniero Forense
Archivos analizados: HephFileIO.ts, LfxFileLoader.ts, HephaestusRuntime.ts, DynamicEffectRegistry.ts, TitanOrchestrator.ts, IPCHandlers.ts, preload.ts, main.ts
Método: Solo lectura. Cada afirmación lleva cita de línea.

1. La Ruta del Escaneo Lineal
1.1 HephFileIO.loadClip(idOrPath) — O(N) por ID
@/electron-app/src/core/hephaestus/HephFileIO.ts:199-244

Cuando se invoca con un ID (no una ruta absoluta), el código hace esto:



typescript
// HephFileIO.ts:208-219
const files = await fs.readdir(effectsPath)
const lfxFiles = files.filter(f => f.endsWith(LFX_EXTENSION))
 
for (const file of lfxFiles) {
  const fullPath = path.join(effectsPath, file)
  const content = await fs.readFile(fullPath, 'utf-8')   // ← LECTURA DISCO
  const lfx: LFXFile = JSON.parse(content)                // ← PARSE JSON
  if (lfx.clip.id === idOrPath) {
    filePath = fullPath
    break
  }
}
Operaciones pesadas dentro del bucle:

fs.readFile(fullPath, 'utf-8') — lectura de disco completa por cada .lfx.
JSON.parse(content) — parseo completo del JSON por cada archivo.
fs.readdir(effectsPath) + Array.filter — escaneo de directorio previo.
Peor caso: Si el directorio tiene 100 clips y el ID buscado es el último, se leen y parsean 100 archivos para encontrar uno.

Doble lectura: Incluso después de encontrar el filePath, el método vuelve a leer el archivo:



typescript
// HephFileIO.ts:227-228
const content = await fs.readFile(filePath, 'utf-8')
const lfxFile: LFXFile = JSON.parse(content)
Conclusión confirmada: loadClip(id) es O(N) en número de archivos .lfx, con dos lecturas/parseos del archivo objetivo.

1.2 HephFileIO.listClips() — O(N) full-file scan
@/electron-app/src/core/hephaestus/HephFileIO.ts:256-297



typescript
// HephFileIO.ts:259-290
const files = await fs.readdir(effectsPath)
const lfxFiles = files.filter(f => f.endsWith(LFX_EXTENSION))
 
for (const file of lfxFiles) {
  const filePath = path.join(effectsPath, file)
  try {
    const content = await fs.readFile(filePath, 'utf-8')   // ← LECTURA COMPLETA
    const lfx: LFXFile = JSON.parse(content)                // ← PARSE COMPLETO
    const clip = lfx.clip
    
    const stats = await fs.stat(filePath)                 // ← STAT extra
    
    metadataList.push({ id: clip.id, name: clip.name, ... })
  } catch (error) {
    console.error(`[HephFileIO] Failed to read ${filePath}:`, error)
  }
}
metadataList.sort((a, b) => b.modifiedAt - a.modifiedAt)
Operaciones pesadas:

fs.readFile + JSON.parse para cada .lfx aunque solo se necesite metadata.
fs.stat adicional por archivo.
Sort final O(N log N).
Conclusión confirmada: No existe un índice de metadata ligero. listClips() fuerza N lecturas de disco + N parseos JSON para devolver una lista de metadatos.

1.3 HephFileIO está desconectado del renderer
Dato clave confirmado: preload.ts no expone los canales heph:list, heph:load, heph:save, heph:delete.

@/electron-app/electron/preload.ts:57-1795

Los handlers existen en HephIPCHandlers.ts (@/electron-app/src/core/hephaestus/HephIPCHandlers.ts:31-235), pero la API tipada del renderer solo expone:

lux.chronos.triggerHeph
lux.chronos.stopHeph
lux.chronos.tickHeph
Conclusión confirmada: HephFileIO es un módulo huérfano: sus IPC handlers están registrados, pero la UI React no los consume directamente. Los efectos se disparan vía Chronos o Selene, no vía HephFileIO.

2. El Bloqueo Sincrónico
2.1 HephaestusRuntime.loadClip() usa fs.readFileSync
@/electron-app/src/core/hephaestus/runtime/HephaestusRuntime.ts:294-421



typescript
// HephaestusRuntime.ts:302-307
if (!fs.existsSync(filePath)) {
  console.error(`[HephRuntime] ❌ File not found: ${filePath}`)
  return null
}
 
const content = fs.readFileSync(filePath, 'utf-8')   // ← SYNC


typescript
// HephaestusRuntime.ts:317-319
let parsed: any
try {
  parsed = JSON.parse(content)
}
Corrección importante al alcance del bug: HephaestusRuntime no corre en el proceso de renderizado React. Corre en el main process de Electron, instanciado desde IPCHandlers.ts:

@/electron-app/src/core/orchestrator/IPCHandlers.ts:27-38



typescript
let hephaestusRuntime: HephaestusRuntime | null = null
 
export function getHephaestusRuntime(): HephaestusRuntime {
  if (!hephaestusRuntime) {
    hephaestusRuntime = new HephaestusRuntime()
  }
  return hephaestusRuntime
}
Sin embargo, el bloqueo sigue siendo crítico porque el main process es el hilo que:

Atiende IPC del renderer.
Ejecuta el bucle de renderizado interno (TitanOrchestrator / TickEngine a 44Hz).
Procesa audio, DMX, etc.
Un fs.readFileSync de un archivo .lfx grande (p. ej. 1-5 MB con muchas curvas) puede bloquear el main process por decenas de milisegundos, congelando toda la UI y el pipeline de DMX.

2.2 ¿Cuándo exactamente se llama a loadClip()?
HephaestusRuntime.loadClip() se invoca desde HephaestusRuntime.play():

@/electron-app/src/core/hephaestus/runtime/HephaestusRuntime.ts:457-464



typescript
play(filePath: string, options: { ... } = {}): string | null {
  const clip = this.loadClip(filePath)   // ← SYNC I/O AQUÍ
  if (!clip) return null
  ...
}
Y play() se llama en dos caminos confirmados:

Camino A — Selene IA → SeleneHephBridge → playHook:

@/electron-app/src/core/orchestrator/TitanOrchestrator.ts:708-727



typescript
const bridge = getSeleneHephBridge()
bridge.setPlayHook((resolved, _entry) => {
  if (!resolved.filePath) return -1
  const runtime = getHephaestusRuntime()
  const instanceId = runtime.play(resolved.filePath, {   // ← bloqueo en runtime de IA
    intensity: resolved.intensity,
    durationOverrideMs: resolved.durationMs,
  })
  return instanceId != null ? 1 : -1
})
Camino B — Chronos timeline → IPC handler:

@/electron-app/src/core/orchestrator/IPCHandlers.ts:328-373



typescript
ipcMain.handle('chronos:triggerHeph', (_event, config) => {
  ...
  const runtime = getHephaestusRuntime()
  const instanceId = runtime.play(config.filePath, {    // ← bloqueo en playback de timeline
    intensity: config.intensity,
    durationOverrideMs: config.durationMs,
    loop: config.loop ?? false,
  })
  ...
})
Camino C — Chronos Diamond (in-memory, no I/O):

@/electron-app/src/core/orchestrator/IPCHandlers.ts:299-307



typescript
if (config.effectId === 'heph-custom' && hephClip) {
  const runtime = getHephaestusRuntime()
  const instanceId = runtime.playFromClip(hephClip, { ... })  // ← NO toca disco
}
Conclusión confirmada: El bloqueo sincrónico ocurre al darle Play en la UI de Chronos o cuando Selene decide disparar un efecto durante el show. No ocurre en la inicialización del show, sino en el momento de ejecución del efecto. El único camino que evita I/O es el Diamond path, que recibe el clip ya deserializado por IPC.

3. El Solapamiento (Duplicidad de Esfuerzos)
3.1 LfxFileLoader carga todo en el boot
@/electron-app/electron/main.ts:555-598



typescript
const _lfxLoader = new LfxFileLoader(getDynamicEffectRegistry())
const _arsenalReport = await _lfxLoader.loadAll(_vibeDirectories)
LfxFileLoader.loadAll() itera directorios y llama loadFile() por cada .lfx:

@/electron-app/src/core/arsenal/LfxFileLoader.ts:90-192



typescript
public async loadFile(filePath: string, source: EffectSource): Promise<boolean> {
  const raw = await fs.readFile(filePath, 'utf-8')   // ← LECTURA 1
  const peeked = JSON.parse(raw) as Record<string, unknown>
  ...
  if (schemaHint === 'luxsync.lfx/3.0') {
    const v3 = this._parseAndValidateV3(raw, filePath, source)
    const entry = this._registry.registerEffectV3(v3, opts)
  } else {
    const result = this._parseAndValidate(raw, filePath, source)
    const entry = this._registry.registerEffect(result, opts)
  }
}
3.2 DynamicEffectRegistry guarda metadata, no el clip completo
@/electron-app/src/core/arsenal/DynamicEffectRegistry.ts:357-403



typescript
const entry: RegistryEntry = {
  id: clip.id,
  name: clip.name,
  ...
  filePath: options.filePath ?? null,   // ← solo guarda la ruta
  dna: Object.freeze({ ... }),
  ...
  source: null,                         // ← keepSource: false por defecto
}
El campo source solo se llena si options.keepSource === true. LfxFileLoader usa keepSource: false por defecto:

@/electron-app/src/core/arsenal/LfxFileLoader.ts:135-139



typescript
const opts: RegisterOptions = {
  filePath,
  isBuiltin: source === 'builtin',
  keepSource: false,   // ← clip completo descartado
}
3.3 HephaestusRuntime vuelve a leer el mismo archivo al reproducir
Cuando Selene o Chronos disparan el efecto, SeleneHephBridge resuelve filePath desde RegistryEntry.filePath y lo pasa a runtime.play(). El runtime entonces:



typescript
// HephaestusRuntime.ts:302-307
if (!fs.existsSync(filePath)) return null
const content = fs.readFileSync(filePath, 'utf-8')   // ← LECTURA 2 DEL MISMO ARCHIVO
Conclusión confirmada: Cada archivo .lfx cognitivo se parsea dos veces:

Una vez en el boot por LfxFileLoader para poblar DynamicEffectRegistry (metadata + DNA).
Otra vez en runtime por HephaestusRuntime.loadClip() para obtener las curvas ejecutables.
3.4 ¿Hay dos cachés independientes?
Sí. La arquitectura actual tiene:

Caché	Ubicación	Qué guarda	Usada por
DynamicEffectRegistry._byId	Main process	RegistryEntry (metadata + DNA, no curvas)	Selene DecisionMaker, SeleneHephBridge
HephaestusRuntime.clipCache	Main process	HephAutomationClip | HephAutomationClipV3 (curvas completas)	HephaestusRuntime
No hay compartición entre ellas. El RegistryEntry solo guarda filePath, así que el runtime siempre vuelve a disco.

3.5 ¿Se solapan HephFileIO y LfxFileLoader?
Sí. Ambos leen archivos .lfx:

HephFileIO lee userData/effects/*.lfx (formato hephaestus/v1, solo V2.1).
LfxFileLoader lee builtins/ y potencialmente userData/effects/ (formatos hephaestus/v2.1 y luxsync.lfx/3.0).
No comparten índice ni caché. HephFileIO es además inaccesible desde el renderer, como se demostró en §1.3.

4. Propuesta Arquitectónica O(1)
No se implementa código. Solo se diseña el rediseño.

4.1 Principio rector
Cada archivo .lfx debe leerse del disco UNA sola vez por sesión de aplicación. La metadata y el clip completo deben vivir en un índice en memoria en el main process. Búsquedas por ID o por path deben ser O(1).

4.2 Componente nuevo: HephaestusClipIndex (main process)
Singleton en el main process con esta estructura mínima:



typescript
interface LoadedClip {
  id: string
  filePath: string
  schemaVersion: 'hephaestus/v1' | 'hephaestus/v2.1' | 'luxsync.lfx/3.0'
  metadata: HephClipMetadata
  clip: HephAutomationClip | HephAutomationClipV3   // clip deserializado y validado
  checksum?: string
  modifiedAt: number
  source: 'builtin' | 'user'
}
 
class HephaestusClipIndex {
  private byId = new Map<string, LoadedClip>()
  private byPath = new Map<string, LoadedClip>()
  
  // O(1) lookups
  getById(id: string): LoadedClip | undefined
  getByPath(filePath: string): LoadedClip | undefined
  getAllMetadata(): HephClipMetadata[]
  
  // Mutaciones con invalidación
  upsert(filePath: string, source: 'builtin' | 'user'): Promise<void>
  remove(id: string): void
  clear(): void
}
4.3 Flujo de boot: lectura única
En main.ts, reemplazar la carga separada de LfxFileLoader + HephFileIO por una sola inicialización del índice:

Descubrir directorios: builtins/<vibe>/, userData/effects/.
Para cada .lfx:
fs.promises.readFile() (async, no bloqueante).
JSON.parse().
Validación de schema (G1-G7).
Deserialización Map<>.
Insertar en HephaestusClipIndex.
Poblar DynamicEffectRegistry iterando el índice ya cargado, NO volviendo a leer disco.
Ventaja: El boot hace N lecturas una sola vez. Después, todas las operaciones son memoria.

4.4 Reescribir HephFileIO como wrapper del índice


typescript
class HephFileIO {
  async listClips(): Promise<HephClipMetadata[]> {
    return HephaestusClipIndex.getAllMetadata().sort((a, b) => b.modifiedAt - a.modifiedAt)
  }
 
  async loadClip(idOrPath: string): Promise<HephAutomationClip> {
    const loaded = path.isAbsolute(idOrPath)
      ? HephaestusClipIndex.getByPath(idOrPath)
      : HephaestusClipIndex.getById(idOrPath)
    if (!loaded) throw new Error(`Clip not found: ${idOrPath}`)
    return loaded.clip
  }
 
  async saveClip(clip: HephAutomationClip | HephAutomationClipV3): Promise<string> {
    const filePath = ... // escribir en disco
    await HephaestusClipIndex.upsert(filePath, 'user')  // reindexar
    return filePath
  }
 
  async deleteClip(idOrPath: string): Promise<boolean> {
    const loaded = ...
    if (!loaded) return false
    await fs.unlink(loaded.filePath)
    HephaestusClipIndex.remove(loaded.id)              // invalidar índice
    return true
  }
}
Resultado: loadClip(id) pasa de O(N) a O(1). listClips() ya no lee disco.

4.5 Reescribir HephaestusRuntime sin fs
Eliminar todo uso de fs en HephaestusRuntime.ts:



typescript
loadClip(filePath: string): HephAutomationClip | HephAutomationClipV3 | null {
  const loaded = HephaestusClipIndex.getByPath(filePath)
  if (!loaded) {
    console.error(`[HephRuntime] ❌ Clip not in index: ${filePath}`)
    return null
  }
  // Cache interna opcional, o devolver referencia directa
  if (!this.clipCache.has(filePath)) {
    this.clipCache.set(filePath, loaded.clip)
  }
  return this.clipCache.get(filePath)!
}
Resultado: runtime.play() ya no bloquea el main process con I/O sincrónica.

4.6 Unificación con DynamicEffectRegistry
LfxFileLoader debe recibir el índice como dependencia:



typescript
class LfxFileLoader {
  constructor(
    private registry: DynamicEffectRegistry,
    private index: HephaestusClipIndex,
  ) {}
  
  async loadFile(filePath: string, source: EffectSource): Promise<boolean> {
    const loaded = await this.index.upsert(filePath, source === 'builtin' ? 'builtin' : 'user')
    if (!loaded) return false
    const entry = loaded.schemaVersion === 'luxsync.lfx/3.0'
      ? this.registry.registerEffectV3(loaded.clip, { filePath, isBuiltin: source === 'builtin' })
      : this.registry.registerEffect(loaded.clip, { filePath, isBuiltin: source === 'builtin' })
    return entry !== null
  }
}
Resultado: El registry sigue existiendo para búsquedas por vibe/DNA, pero ya no fuerza una re-lectura de disco. Sus entradas apuntan al índice compartido.

4.7 Hot-reload con fs.watch (o chokidar)
En lugar de re-escanear todo el directorio, vigilar cambios incrementales:



typescript
fs.watch(effectsPath, (eventType, filename) => {
  if (!filename?.endsWith('.lfx')) return
  if (eventType === 'rename' || eventType === 'change') {
    const filePath = path.join(effectsPath, filename)
    HephaestusClipIndex.upsert(filePath, 'user')
      .then(loaded => {
        if (loaded) DynamicEffectRegistry.reindex(loaded)
      })
  }
})
Resultado: Solo se re-lee el archivo modificado, no todo el directorio.

4.8 Eliminar fs del renderer
Confirmado: el renderer React no usa fs directamente hoy en este flujo. Pero para cerrar la puerta definitivamente:

No importar fs en ningún archivo bajo [c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/src/](cci:4://file://c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/src/:0:0-0:0) consumido por el renderer.
Exponer los canales Hephaestus en preload.ts si la UI necesita listar/guardar efectos:


typescript
heph: {
  list: () => ipcRenderer.invoke('heph:list'),
  load: (idOrPath: string) => ipcRenderer.invoke('heph:load', idOrPath),
  save: (clip: HephAutomationClipSerialized) => ipcRenderer.invoke('heph:save', clip),
  delete: (idOrPath: string) => ipcRenderer.invoke('heph:delete', idOrPath),
}
Mantener HephaestusRuntime exclusivamente en main process. Su caché clipCache puede mantenerse como caché de segundo nivel, pero la fuente de verdad es HephaestusClipIndex.
4.9 Diagrama de la propuesta


┌─────────────────────────────────────┐
│  BOOT (main.ts) - UNA sola vez      │
│  LfxFileLoader → HephaestusClipIndex  │
│  (lee + parsea + valida cada .lfx)  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  HephaestusClipIndex (main process) │
│  ├── byId: Map<string, LoadedClip>  │
│  └── byPath: Map<string, LoadedClip>│
└──────────────┬──────────────────────┘
               │
     ┌─────────┴─────────┐
     ▼                   ▼
DynamicEffectRegistry   HephaestusRuntime
(metadata/DNA)          (ejecución)
     │                       │
     │   O(1) lookups        │
     ▼                       ▼
Selene IA / Arsenal       Chronos play()
5. Matriz de Hallazgos Confirmados
Pregunta	Hallazgo	Estado
¿loadClip(id) es O(N)?	Sí. Lee y parsea cada .lfx hasta encontrar el ID.	✅ Confirmado
¿listClips() lee todo?	Sí. fs.readFile + JSON.parse por cada archivo.	✅ Confirmado
¿fs.readFileSync bloquea?	Sí. En HephaestusRuntime.loadClip().	✅ Confirmado
¿Está en el renderer?	No. Está en main process, pero bloquea el hilo principal de Electron.	⚠️ Corregido
¿Ocurre al dar Play?	Sí. En runtime.play() disparado por Selene o Chronos.	✅ Confirmado
¿Se parsea el mismo archivo 2 veces?	Sí. LfxFileLoader en boot + HephaestusRuntime en play.	✅ Confirmado
¿Hay dos cachés?	Sí. DynamicEffectRegistry y HephaestusRuntime.clipCache sin compartir datos.	✅ Confirmado
¿HephFileIO está huérfano?	Sí. Preload no expone heph:list/load/save.	✅ Confirmado
6. Recomendación de Prioridad
Crítico: Crear HephaestusClipIndex y mover toda la carga de .lfx al boot.
Crítico: Eliminar fs.readFileSync de HephaestusRuntime.loadClip().
Alto: Reescribir HephFileIO como wrapper O(1) del índice.
Medio: Unificar LfxFileLoader para que alimente el índice compartido.
Medio: Añadir fs.watch para hot-reload incremental.
Bajo: Exponer canales Hephaestus en preload.ts si se quiere UI de biblioteca de efectos.
Medida dos veces, corta una. La arquitectura propuesta elimina el escaneo lineal y el bloqueo sincrónico sin cambiar los contratos externos de HephaestusRuntime.play() ni DynamicEffectRegistry.