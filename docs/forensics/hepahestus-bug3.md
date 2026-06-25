1. El Disparador de Carga
La función de carga se llama handleLoad en @/electron-app/src/components/views/HephaestusView/index.tsx:433-460:



index.tsx:433
const handleLoad = useCallback(async (clipId: string) => {
  if (!window.luxsync?.hephaestus?.load) {
    console.warn('[Hephaestus] IPC not available, cannot load')
    return
  }
 
  try {
    const result = await window.luxsync.hephaestus.load(clipId)
 
    if (result.success && result.clip) {
      // Deserialize (Record → Map)
      const loadedClip = deserializeHephClip(result.clip as HephAutomationClipSerialized)
      temporalActions.resetWithClip(loadedClip)
      setIsDirty(false)
      setSelectedKeyframeIdx(null)
 
      // Set first param as active
      const firstParam = Array.from(loadedClip.curves.keys())[0]
      if (firstParam) setActiveParam(firstParam)
 
      console.log(`[Hephaestus] Loaded clip: ${loadedClip.name}`)
    } else {
      console.error('[Hephaestus] Load failed:', result.error)
    }
  } catch (error) {
    console.error('[Hephaestus] Load error:', error)
  }
}, [])
El click en la barra lateral ejecuta handleLoad(item.id) en @/electron-app/src/components/views/HephaestusView/index.tsx:1624:



index.tsx:1624
onClick={() => handleLoad(item.id)}
También hay un auto-load desde Chronos en @/electron-app/src/components/views/HephaestusView/index.tsx:467-484 que llama a handleLoad(targetHephClipId).

2. La Falla de Hidratación
Causa inmediata
handleLoad asume que result.clip es siempre un HephAutomationClipSerialized (V2 con curves: Record<string, HephCurve>). Tras la refactorización de HephFileIO.loadClip, el backend ahora devuelve HephAutomationClip | HephAutomationClipV3.

Para un clip V3:

deserializeHephClip recibe un objeto con tracks: HephTrack[] en lugar de curves: Record<string, HephCurve>
El intento de iterar Object.entries(serialized.curves) en el deserializador encuentra un curves undefined
El loadedClip resultante tendría un curves: Map vacío o undefined
Por eso el editor muestra "No curve selected", parámetros vacíos y curvas en blanco
Dependencia ciega de curves en toda la vista
El componente HephaestusView está construido entero sobre el mapa curves de V2:



index.tsx:196
const activeCurve = useMemo(
  () => clip.curves.get(activeParam) ?? null,
  [clip, activeParam]
)
 
@/electron-app/src/components/views/HephaestusView/index.tsx:201
const paramIds = useMemo<HephParamId[]>(
  () => Array.from(clip.curves.keys()) as HephParamId[],
  [clip]
)
 
@/electron-app/src/components/views/HephaestusView/index.tsx:207
const availableParams = useMemo<HephParamId[]>(
  () => ALL_PARAM_IDS.filter((p: HephParamId) => !clip.curves.has(p)),
  [clip]
)
 
@/electron-app/src/components/views/HephaestusView/index.tsx:450
const firstParam = Array.from(loadedClip.curves.keys())[0]
useTemporalStore también está tipado exclusivamente a V2:



useTemporalStore.ts:56
export interface TemporalState {
  clip: HephAutomationClip
  ...
}
 
@/electron-app/src/components/views/HephaestusView/useTemporalStore.ts:162
export function useTemporalStore(
  initialClip: HephAutomationClip | (() => HephAutomationClip)
)
Y useHephPreview recibe un HephAutomationClip en @/electron-app/src/components/views/HephaestusView/index.tsx:160.

3. El Mapeo de ADN y Zonas
ADN y SimulationMeta
Tanto V2 como V3 comparten cognitiveDNA y simulationMeta como propiedades del clip. El panel DnaRail los consume correctamente:



index.tsx:1843
<DnaRail
  dna={clip.cognitiveDNA}
  simMeta={clip.simulationMeta}
El problema no está en el ADN en sí, sino en que la función de hidratación destruye el clip V3 antes de que llegue a la UI. Si deserializeHephClip devuelve un objeto con curves vacío, también pierde tracks, spatialZones y los selectors por fase.

Zonas
V2 tiene zones: EffectZone[] a nivel de clip y se usa aquí:



index.tsx:1441
<ZoneSelector
  selectedZones={clip.zones}
  onZonesChange={handleZonesChange}
V3 tiene spatialZones: readonly ZoneTarget[] a nivel de clip y cada track tiene su propio zones: ZoneTarget[]. La UI actual no sabe leer spatialZones, por lo que el ZoneSelector aparecería vacío al cargar un V3.

Selector de fase
V2 tiene selector?: FixtureSelector a nivel de clip, usado en:



index.tsx:1756
<PhaseControls
  config={clip.selector?.phase ?? null}
V3 tiene el selector embebido en cada track (track.selector). La UI no tiene mecanismo para elegir qué track editar, por lo que no hay forma de mapear la fase de V3 al panel actual.

4. Propuesta de Traducción Universal (Teórica)
Branching en handleLoad


typescript
const handleLoad = useCallback(async (clipId: string) => {
  const result = await window.luxsync.hephaestus.load(clipId);
  if (!result.success || !result.clip) return;
 
  const raw = result.clip;
 
  if (isHephAutomationClipV3(raw)) {
    // V3 PATH
    const hydrated = hydrateV3ForEditor(raw as HephAutomationClipV3);
    temporalActions.resetWithClip(hydrated as HephAutomationClip); // o adaptar TemporalState a unión
    setActiveParamFromHydrated(hydrated);
  } else {
    // V2 PATH (legacy)
    const loadedClip = deserializeHephClip(raw as HephAutomationClipSerialized);
    temporalActions.resetWithClip(loadedClip);
    const firstParam = Array.from(loadedClip.curves.keys())[0];
    if (firstParam) setActiveParam(firstParam);
  }
}, []);
Función teórica hydrateV3ForEditor
Objetivo: convertir HephAutomationClipV3 a una estructura que el CurveEditor pueda pintar, o bien extender el editor para que entienda tracks.

Opción A: Traducción V3 → pseudo-V2 en memoria



typescript
function hydrateV3ForEditor(v3: HephAutomationClipV3): any {
  // 1. Construir un Map<HephParamId, HephCurve> a partir de tracks.
  //    Un track V3 tiene: { id, paramId, zones, selector, curve }
  //    Donde curve es un HephCurve con keyframes.
  const curves = new Map<HephParamId, HephCurve>();
  const trackByParam = new Map<HephParamId, HephTrack>();
 
  for (const track of v3.tracks) {
    const paramId = track.paramId as HephParamId;
    curves.set(paramId, track.curve);
    trackByParam.set(paramId, track);
  }
 
  // 2. Elegir un track representativo para zones y selector.
  //    O combinar: spatialZones ya es la unión de todas las zonas.
  const representativeZones = v3.spatialZones ?? [];
  const representativeSelector = v3.tracks[0]?.selector;
 
  return {
    ...v3,
    curves,                         // Mapa que el CurveEditor espera
    zones: representativeZones,     // EfectZone[] o ZoneTarget[]
    selector: representativeSelector,
    cognitiveDNA: v3.cognitiveDNA,
    simulationMeta: v3.simulationMeta,
    _v3Source: v3,                  // Guardar referencia original para guardar
    _trackByParam: trackByParam,    // Para guardar el selector por track
  };
}
Opción B: Extender el editor a tracks nativos

Requiere cambiar todo el estado interno:

activeParam → activeTrackId (o un par { trackId, paramId })
clip.curves → clip.tracks
activeCurve busca track.curve en lugar de clip.curves.get(...)
ParameterLane lista tracks agrupados por paramId
ZoneSelector y PhaseControls operan sobre el track activo
Al guardar, se reconstruye HephAutomationClipV3 desde el estado
Mapeo de un track V3 al canvas
Un track V3:



typescript
interface HephTrack {
  id: string
  paramId: HephParamId
  zones: ZoneTarget[]
  selector?: FixtureSelector
  curve: HephCurve
}
Para el CurveEditor se necesita:

curve.keyframes → array de keyframes a dibujar
curve.valueType → 'number' | 'color'
curve.defaultValue → valor base
paramId → para el nombre del lane y el meta
track.selector?.phase → para PhaseControls (si se hace por track)
track.zones → para el ZoneSelector contextual
Consideraciones para guardar
Si se adopta la Opción A (pseudo-V2), al guardar hay que detectar que el clip original era V3 y traducir de vuelta:



typescript
function convertBackToV3(state: any): HephAutomationClipV3 {
  const tracks = [];
  for (const [paramId, curve] of state.curves.entries()) {
    const originalTrack = state._trackByParam?.get(paramId);
    tracks.push({
      id: originalTrack?.id ?? `${paramId}-track`,
      paramId,
      zones: originalTrack?.zones ?? state.spatialZones ?? [],
      selector: originalTrack?.selector ?? state.selector,
      curve,
    });
  }
 
  return {
    ...state._v3Source,
    tracks,
    spatialZones: state.spatialZones,
    staticParams: state.staticParams,
    cognitiveDNA: state.cognitiveDNA,
    simulationMeta: state.simulationMeta,
  };
}
Recomendación arquitectónica
Corto plazo: Opción A (V3 → pseudo-V2) con _v3Source guardado, para que el editor funcione hoy con mínimo cambio.
Medio plazo: Opción B (editor nativo de tracks) para soportar múltiples tracks con el mismo paramId sobre zonas distintas, que es el verdadero poder de V3.
Impacto adicional: Diamond Cache
El cache de drag-and-drop en handleDragStart también está acoplado a V2:



index.tsx:641
const curveCount = Object.keys(cachedClip.curves).length
Para V3 debe usar cachedClip.tracks?.length o normalizar el cache a un formato común.

Resumen: El editor no sabe leer V3 porque handleLoad fuerza deserializeHephClip (V2-only) y toda la vista asume clip.curves: Map. El ADN sí existe en V3, pero se pierde en la traducción forzada. La solución requiere branching en handleLoad y una capa de traducción V3→V2 o una refactorización del editor para tracks nativos.