1. Cuello de botella del guardado (Save)
Firma exacta actual en @/electron-app/src/core/hephaestus/HephFileIO.ts:157:



typescript
async saveClip(clip: HephAutomationClip): Promise<string> {
Solo acepta HephAutomationClip (V2 con curves: Map).
No acepta HephAutomationClipV3 (que usa tracks: HephTrack[] y schemaVersion: '3.0').
El tipo de retorno HephAutomationClip en loadClip también está desfasado: ya debería ser HephAutomationClip | HephAutomationClipV3 | null.
Cambios de tipado necesarios:

Importar HephAutomationClipV3 en @/electron-app/src/core/hephaestus/HephFileIO.ts:23.
Cambiar la firma de saveClip a:


typescript
async saveClip(clip: HephAutomationClip | HephAutomationClipV3): Promise<string>
Cambiar LFXFile.clip para soportar tanto HephAutomationClipSerialized como HephAutomationClipV3 (o definir un tipo wrapper unión).
Actualizar loadClip para devolver HephAutomationClip | HephAutomationClipV3 (la fase 3 ya lo convirtió en O(1) mediante el índice, pero el tipo sigue siendo HephAutomationClip).
2. Bloqueo del schema
En @/electron-app/src/core/hephaestus/HephFileIO.ts:36 hay una constante rígida:



typescript
const SCHEMA_VERSION = 'hephaestus/v1'
Y en @/electron-app/src/core/hephaestus/HephFileIO.ts:173 se inyecta siempre:



typescript
$schema: SCHEMA_VERSION,
Esto fuerza que todo archivo se escriba como hephaestus/v1, aunque el clip sea V3.

Decisión de schema correcta:

Si el objeto a guardar es HephAutomationClipV3 (tiene tracks y schemaVersion === '3.0'), el wrapper debe usar $schema: 'luxsync.lfx/3.0' y contener clip: <HephAutomationClipV3>.
Si es HephAutomationClip (V2 con curves: Map), el wrapper debe usar $schema: 'hephaestus/v2.1' y contener clip: HephAutomationClipSerialized.
El schemaVersion interno del clip V3 ('3.0') es distinto del $schema del wrapper ('luxsync.lfx/3.0'). El wrapper debe reflejar el formato del archivo; el clip interno refleja la versión de sus datos.
Esto exige convertir la interfaz LFXFile en un tipo discriminated union o relajar clip a HephAutomationClipSerialized | HephAutomationClipV3.

3. Brecha en el Asset Store
En @/electron-app/src/stores/assetAdapters.ts:21:



typescript
export type AssetType = 'fixture' | 'ingenio'
Falta 'effect' en el tipo.

En @/electron-app/src/stores/assetAdapters.ts:60:



typescript
readonly _raw: FixtureDefinition | IIngenioDefinition
Falta la unión con HephAutomationClip | HephAutomationClipV3.

En @/electron-app/src/stores/assetLibraryStore.ts:94-105 el estado solo tiene:



typescript
fixtures: LibraryAsset[]
ingenios: LibraryAsset[]
Falta:



typescript
effects: LibraryAsset[]
Falta también una acción de ingesta:



typescript
ingestEffects: (effects: HephClipMetadata[]) => void
En @/electron-app/src/stores/assetLibraryStore.ts:183-199 el estado inicial no incluye effects: [].

En @/electron-app/src/stores/assetLibraryStore.ts:241-248 el clear() no limpia effects.

En @/electron-app/src/stores/assetLibraryStore.ts:252-277 toggleFavorite solo actualiza fixtures e ingenios; debe actualizar effects.

En @/electron-app/src/stores/assetLibraryStore.ts:321-376 getFilteredAssets y getAvailableTags no incluyen la rama case 'effect'.

En @/electron-app/src/stores/assetLibraryStore.ts:403-406 getTotalCount no suma effects.

Además, en @/electron-app/src/stores/assetAdapters.ts falta un adaptador hephClipToAsset que convierta HephClipMetadata en LibraryAsset con:

type: 'effect'
creator: clip.author
subtype: clip.effectType
tags: [...clip.tags]
summary: ${clip.paramCount} params • ${clip.durationMs}ms``
icon: '✨' o similar
accentColor: '#bf5af2'
filePath: clip.filePath
itemCount: clip.paramCount
updatedAt: clip.modifiedAt
4. Propuesta arquitectónica de guardado unificado (teórica)
4.1. Flujo del usuario pulsa "Guardar Efecto"
UI/Renderer invoca el IPC expuesto heph:saveClip con un objeto serializable que es HephAutomationClip | HephAutomationClipV3. El renderer no toca fs.
Main process recibe el objeto en HephIPCHandlers y lo pasa a HephFileIO.saveClip(clip).
HephFileIO.saveClip:
Detecta el tipo por la presencia de tracks y schemaVersion === '3.0'.
Si es V3: envuelve el clip directamente en { $schema: 'luxsync.lfx/3.0', clip: v3, checksum }.
Si es V2: serializa curves a Record y envuelve en { $schema: 'hephaestus/v2.1', clip: serialized, checksum }.
Escribe el archivo en userData/effects/ con fs.promises.writeFile.
Devuelve el filePath.
Después de escribir en disco, HephFileIO.saveClip llama a:
const index = getHephaestusClipIndex(); await index.upsert(filePath, 'user');



   Esto re-lee el archivo desde disco (validación de ida y vuelta), lo parsea y lo coloca en los mapas `byId` y `byPath`.
5. **[HephaestusClipIndex.upsert](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/core/hephaestus/HephaestusClipIndex.ts:129:2-248:3)** ya devuelve un [LoadedClip](cci:2://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/core/hephaestus/HephaestusClipIndex.ts:30:0-38:1) con `metadata`. Esa metadata es la fuente de verdad para el Asset Store.
6. **Notificación al Asset Store**:
   - [HephFileIO.saveClip](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/core/hephaestus/HephFileIO.ts:149:2-186:3) (o un hook post-save) invoca el store:
     ```typescript
     useAssetLibraryStore.getState().addOrUpdateEffect(loaded.metadata);
     ```
   - Alternativa: el componente [useLoadAssetLibrary.ts](cci:7://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/components/shared/AssetBrowser/useLoadAssetLibrary.ts:0:0-0:0) se suscribe a un evento `effect:updated` emitido por [HephFileIO](cci:2://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/core/hephaestus/HephFileIO.ts:111:0-308:1) y refresca el pool de efectos.
   - La forma más limpia es que el mismo [saveClip](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/core/hephaestus/HephFileIO.ts:149:2-186:3) exponga un `EventEmitter` o que el [HephaestusClipIndex](cci:2://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/core/hephaestus/HephaestusClipIndex.ts:91:0-249:1) dispare eventos, evitando importar el store directamente desde [HephFileIO](cci:2://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/core/hephaestus/HephFileIO.ts:111:0-308:1) y manteniendo las capas desacopladas.
 
### 4.2. Integración con el boot
 
- Al arrancar, [LfxFileLoader.loadAll()](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/core/arsenal/LfxFileLoader.ts:80:2-112:3) ya alimenta [HephaestusClipIndex](cci:2://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/core/hephaestus/HephaestusClipIndex.ts:91:0-249:1) (Fase 2 completada).
- Una vez finalizado el boot, [useLoadAssetLibrary.ts](cci:7://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/components/shared/AssetBrowser/useLoadAssetLibrary.ts:0:0-0:0) debe llamar a:
  ```typescript
  useAssetLibraryStore.getState().ingestEffects(getHephaestusClipIndex().getAllMetadata());
Esto convierte los efectos en ciudadanos de primera clase junto a fixtures e ingenios.
4.3. Límites y no-objetivos de esta fase
No se modifica código en esta fase.
El checksum se mantiene opcional.
La separación de HephaestusClipIndex vs DynamicEffectRegistry se respeta: el índice es source of truth para clips; el registry es source of truth para matching de Selene.
El renderer sigue sin acceder a fs en ningún punto. ``