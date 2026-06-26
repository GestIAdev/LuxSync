REPORTE FORENSE: CABLES ROTOS V2→V3
1. ESTADO DE LOS TESTS E2E (HephaestusE2E.test.ts)
Diagnóstico: 100% acoplado a V2 — no existe un solo test V3
El archivo importa y construye exclusivamente tipos V2:



typescript
// @/electron-app/src/core/hephaestus/__tests__/HephaestusE2E.test.ts:30
import type { HephAutomationClip, HephCurve, HephParamId, HSL } from '../types'
El helper forgeClip construye clips V2 con curves: Map:



typescript
// :123-144
function forgeClip(
  name: string,
  curves: [HephParamId, HephCurve][],
  durationMs: number = 1000,
  zones: EffectZone[] = ['all']
): HephAutomationClip {
  return {
    // ...
    zones,               // ← V2: EffectZone[] (V3 usa spatialZones: readonly ZoneTarget[])
    curves: new Map(curves),  // ← V2: Map<HephParamId, HephCurve> (V3: tracks: HephTrack[])
    staticParams: {},
  }
}
Aserciones que explotan con V3
Todas las pruebas instancian CurveEvaluator pasándole clip.curves (un Map):



typescript
// :310
const evaluator = new CurveEvaluator(clip.curves, clip.durationMs)
En V3 no existe clip.curves. El clip tiene clip.tracks: HephTrack[] donde cada track contiene track.curve: HephCurve. Hay que extraer las curvas de los tracks antes de pasarlas al evaluator.

El iterador de parámetros también asume el Map V2:



typescript
// :398
for (const [paramName, curve] of clip.curves) {
Esto falla con tracks (array, no Map).

Lo que hay que cambiar en los mocks
forgeClip debe construir HephAutomationClipV3 con tracks: HephTrack[], spatialZones, schemaVersion: '3.0', sin curves ni zones.
constantCurve / linearCurve / stepCurve deben envolver su HephCurve dentro de un HephTrack ({ id, paramId, zones, curve, dimmerScale, blendMode }).
CurveEvaluator debe recibir un array de curvas extraídas de tracks, no un Map. O bien se crea un adaptador tracksToCurveMap(tracks) para compatibilidad del evaluator.
applyHephaestusMerge usa output.zone (string) — en V3 las zonas viven en track.zones y el output del runtime incluye trackZones.
2. CONTENEDOR PRINCIPAL (index.tsx)
Importación del store muerto:


typescript
// @/electron-app/src/components/views/HephaestusView/index.tsx:44
import { useTemporalStore } from './useTemporalStore'


typescript
// :111
const { state: temporal, actions: temporalActions } = useTemporalStore(createDummyClip)
const clip = temporal.clip
const setClip = temporalActions.setClip
useTemporalStore tipa el clip como HephAutomationClip (V2). createDummyClip genera un clip V2 con curves: Map.

Tipos importados V2 que van a fallar:


typescript
// :47-56
import type { 
  HephCurve, 
  HephParamId, 
  HephInterpolation, 
  HephCurveMode, 
  HephAutomationClip,        // ← V2 (debe ser HephAutomationClipV3)
  HephAutomationClipSerialized,
  HephKeyframe,
  PhaseConfig                // ← Legacy (debe ser PhaseConfigPro)
} from '../../../core/hephaestus/types'
Variables derivadas que explotan:
activeCurve — busca en clip.curves.get(activeParam):



typescript
// :196-199
const activeCurve = useMemo(
  () => clip.curves.get(activeParam) ?? null,
  [clip, activeParam]
)
En V3 no existe .curves. Debe buscar en clip.tracks.find(t => t.id === activeTrackId)?.curve.

paramIds — extrae keys del Map V2:



typescript
// :201-204
const paramIds = useMemo<HephParamId[]>(
  () => Array.from(clip.curves.keys()) as HephParamId[],
  [clip]
)
En V3 debe mapear clip.tracks.map(t => t.paramId) (con duplicados posibles — múltiples tracks pueden compartir paramId).

availableParams — filtra params no presentes en el Map:



typescript
// :207-210
const availableParams = useMemo<HephParamId[]>(
  () => ALL_PARAM_IDS.filter((p: HephParamId) => !clip.curves.has(p)),
  [clip]
)
En V3 debe verificar contra clip.tracks.some(t => t.paramId === p).

Estado de selección V2:


typescript
// :116
const [activeParam, setActiveParam] = useState<HephParamId>('intensity')
V3 reemplaza activeParam por activeTrackId (string UUID). La selección de keyframes pasa a ser relativa al track activo, no al parámetro.

Uso del clip V2 en handlers y JSX:


typescript
// :1780-1806
{activeCurve ? (
  <CurveEditor
    curve={activeCurve}
    durationMs={clip.durationMs}
    // ...
    initialViewport={temporal.viewport}
    onViewportChange={temporalActions.setViewport}
  />


typescript
// :1844-1849
<DnaRail
  dna={clip.cognitiveDNA}
  simMeta={clip.simulationMeta}
  onDnaChange={(dna: CognitiveDNA) => {
    temporalActions.snapshot()
    setClip(prev => ({ ...prev, cognitiveDNA: dna }))
temporalActions.snapshot() y setClip(prev => ...) no existen en el store V3. Deben reemplazarse por useHephaestusEditorStore actions (setCognitiveDNA, etc.).

3. EL LIENZO (CurveEditor.tsx)
Props exactas — recibe UNA sola HephCurve:


typescript
// @/electron-app/src/components/views/HephaestusView/CurveEditor.tsx:49-50
interface CurveEditorProps {
  curve: HephCurve
  durationMs: number
No recibe el mapa entero ni tracks. Recibe una curva individual.

Arquitectura: estrictamente una curva en pantalla
El componente opera sobre curve.keyframes como un array único y plano:



typescript
// :54
onKeyframeAdd: (timeMs: number, value: number) => void
// :55
onKeyframeMove: (index: number, timeMs: number, value: number) => void
// :56
onKeyframeDelete: (index: number) => void
Los callbacks asumen índices lineales dentro de UNA curva. No hay concepto de trackId en ningún callback:

onKeyframeAdd no recibe trackId
onKeyframeMove no recibe trackId
onKeyframeDelete no recibe trackId
onInterpolationChange no recibe trackId
No está preparado para múltiples curvas superpuestas
El CurveEditor renderiza un único SVG con una sola serie de keyframes. No hay:

Sistema de layers o lanes para apilar curvas de diferentes tracks
Discriminación por color/track para keyframes superpuestos
Concepto de "curva activa" vs "curva de fondo" (ghost overlay)
Manejo de blendMode o zones por track
Lo que debe cambiar para V3:
Props: curve: HephCurve → tracks: HephTrack[] + activeTrackId: string | null (o un array de curvas con metadata de track).
Callbacks: todos deben incluir trackId como primer argumento.
Render: debe soportar N curvas superpuestas (ghost/active pattern) o un sistema de tabs/lanes.
Selección: selectedKeyframeIdx debe ser relativo al track activo, no global.